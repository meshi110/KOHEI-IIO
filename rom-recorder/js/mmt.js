/*
 * ROMレコーダー mmt
 * 脊椎疾患の診察で使う徒手筋力テスト(MMT)を、その場でタップまたは音声で入力する画面。
 *
 * 方針:
 *  - 患者IDは画面で選択する(音声では扱わない)。音声は「側・髄節・数値」のみ。
 *  - 入力した値は即座に保存し、同一診察内での言い直しは上書きする(取りこぼし防止)。
 *  - 音声入力の値には認識テキストをメモとして残し、後から検証できるようにする。
 */
(function (global) {
  "use strict";

  const Store = global.Store;
  const VP = global.VoiceParse;

  function init(app) {
    const $ = (id) => document.getElementById(id);

    const patientInput = $("mmtPatient");
    const regionSeg = { cervical: $("mmtRegionC"), lumbar: $("mmtRegionL"), all: $("mmtRegionA") };
    const tbody = $("mmtTableBody");
    const statusEl = $("mmtStatus");
    const voiceBtn = $("mmtVoiceBtn");
    const voiceEcho = $("mmtVoiceEcho");
    const newSessionBtn = $("mmtNewSession");
    const historyEl = $("mmtHistory");

    let region = "all";
    let sessionTs = null;               // 現在の診察のタイムスタンプ
    let grid = {};                      // "L4|右" -> {grade, modifier, method, memo}
    let recognizer = null;
    let pickerTarget = null;            // {level, side}

    const defs = global.MMTDefs.ITEMS;

    function visibleDefs() {
      if (region === "cervical") return defs.filter((d) => d.region === "cervical");
      if (region === "lumbar") return defs.filter((d) => d.region === "lumbar");
      return defs;
    }

    function key(level, side) { return level + "|" + side; }

    function ensureSession() {
      if (!sessionTs) sessionTs = new Date().toISOString();
      return sessionTs;
    }

    function patient() { return patientInput.value.trim(); }

    function status(msg) { statusEl.textContent = msg || ""; }

    function filledCount() { return Object.keys(grid).length; }

    function updateStatus() {
      const n = filledCount();
      if (!n) { status(sessionTs ? "この診察: 未入力" : "患者IDを選び、タップまたは音声で入力してください"); return; }
      status("この診察: " + n + "件を保存済み" + (sessionTs ? "(" + Store.fmtTime(sessionTs) + ")" : ""));
    }

    // ---- グリッド描画 ----

    // 表は一度だけ組み立て、以後はセルの表示を更新するだけにする。
    // (DOMを作り直すと、直前の操作で発生した再描画によってタップが取りこぼされるため)
    const cellRefs = new Map(); // "L4|右" -> button
    const rowRefs = new Map();  // "L4" -> tr

    function buildTable() {
      tbody.innerHTML = "";
      cellRefs.clear();
      rowRefs.clear();
      for (const def of defs) {
        const tr = document.createElement("tr");

        const tdLv = document.createElement("td");
        tdLv.className = "mmt-level";
        tdLv.textContent = def.level;
        tr.appendChild(tdLv);

        const tdMuscle = document.createElement("td");
        const name = document.createElement("div");
        name.textContent = def.muscleJa;
        const act = document.createElement("div");
        act.className = "mmt-action";
        act.textContent = def.action;
        tdMuscle.appendChild(name);
        tdMuscle.appendChild(act);
        tr.appendChild(tdMuscle);

        for (const side of ["左", "右"]) {
          const td = document.createElement("td");
          td.className = "mmt-cellwrap";
          const b = document.createElement("button");
          b.type = "button";
          b.className = "mmt-cell";
          b.addEventListener("click", () => openPicker(def.level, side));
          td.appendChild(b);
          cellRefs.set(key(def.level, side), b);
          tr.appendChild(td);
        }
        rowRefs.set(def.level, tr);
        tbody.appendChild(tr);
      }
    }

    function render() {
      const shown = new Set(visibleDefs().map((d) => d.level));
      for (const def of defs) {
        const tr = rowRefs.get(def.level);
        if (tr) tr.style.display = shown.has(def.level) ? "" : "none";
        for (const side of ["左", "右"]) {
          const b = cellRefs.get(key(def.level, side));
          if (!b) continue;
          const v = grid[key(def.level, side)];
          b.textContent = v ? String(v.grade) + (v.modifier || "") : "−";
          b.classList.toggle("filled", !!v);
          b.classList.toggle("low", !!v && v.grade <= 3); // 3以下は視認しやすく
          b.setAttribute("aria-label", side + " " + def.level + " " + def.muscleJa +
            (v ? " MMT " + v.grade + (v.modifier || "") : " 未入力"));
        }
      }
      updateStatus();
      renderScore();
    }

    // ---- グレード選択ダイアログ ----

    function openPicker(level, side) {
      pickerTarget = { level, side };
      const def = defs.find((d) => d.level === level);
      $("mmtPickerTitle").textContent = side + " " + level + " " + (def ? def.muscleJa : "");
      $("mmtPickerAction").textContent = def ? def.action : "";
      const cur = grid[key(level, side)];
      renderPickerButtons(cur);
      $("mmtPicker").showModal();
    }

    function isncsciMode() { return !!app.getSettings().isncsciMode; }

    function renderPickerButtons(cur) {
      const wrap = $("mmtPickerGrades");
      wrap.innerHTML = "";
      const strict = isncsciMode();
      for (const g of global.MMTDefs.GRADES) {
        const row = document.createElement("div");
        row.className = "grade-row";

        const main = document.createElement("button");
        main.type = "button";
        main.className = "grade-btn";
        if (cur && cur.grade === g.value && !cur.modifier) main.classList.add("active");
        main.innerHTML = "<strong>" + g.value + "</strong><span>" + g.label + "</span>";
        main.addEventListener("click", () => commitPicker(g.value, ""));
        row.appendChild(main);

        // 「+」「−」はMRC/ISNCSCI標準の一部ではない慣用表記のため、準拠モードでは出さない
        if (!strict) {
          for (const mod of ["+", "-"]) {
            if ((g.value === 5 && mod === "+") || (g.value === 0 && mod === "-")) continue;
            const b = document.createElement("button");
            b.type = "button";
            b.className = "grade-mod";
            if (cur && cur.grade === g.value && cur.modifier === mod) b.classList.add("active");
            b.textContent = mod;
            b.addEventListener("click", () => commitPicker(g.value, mod));
            row.appendChild(b);
          }
        }
        wrap.appendChild(row);
      }
      $("mmtPickerNote").textContent = strict
        ? "ISNCSCI準拠モード: 0〜5の整数のみで採点します(「+」「−」は使いません)。"
        : "「+」「−」は臨床で慣用的に使われる中間表記です(MRC/ISNCSCI標準の一部ではありません)。";
    }

    // ISNCSCI準拠モードでのみ、UEMS/LEMS(各50点満点)を表示する。
    // 慣用の「+」「−」が混じる採点では合計の意味が保証されないため通常モードでは出さない。
    function renderScore() {
      const el = $("mmtScore");
      if (!isncsciMode()) { el.textContent = ""; return; }
      const sum = { cervical: 0, lumbar: 0 };
      const filled = { cervical: 0, lumbar: 0 };
      for (const def of defs) {
        for (const side of ["左", "右"]) {
          const v = grid[key(def.level, side)];
          if (!v) continue;
          sum[def.region] += v.grade;
          filled[def.region]++;
        }
      }
      const parts = [];
      if (filled.cervical) parts.push("UEMS(上肢) " + sum.cervical + "/50" + (filled.cervical < 10 ? "(" + filled.cervical + "/10項目)" : ""));
      if (filled.lumbar) parts.push("LEMS(下肢) " + sum.lumbar + "/50" + (filled.lumbar < 10 ? "(" + filled.lumbar + "/10項目)" : ""));
      if (filled.cervical === 10 && filled.lumbar === 10) {
        parts.push("Total Motor Score " + (sum.cervical + sum.lumbar) + "/100");
      }
      el.textContent = parts.join(" ／ ");
    }

    function commitPicker(grade, modifier) {
      if (!pickerTarget) return;
      setGrade(pickerTarget.level, pickerTarget.side, grade, modifier, "タップ", "");
      $("mmtPicker").close();
      pickerTarget = null;
    }

    $("mmtPickerClear").addEventListener("click", () => {
      if (!pickerTarget) return;
      clearGrade(pickerTarget.level, pickerTarget.side);
      $("mmtPicker").close();
      pickerTarget = null;
    });
    $("mmtPickerCancel").addEventListener("click", () => {
      $("mmtPicker").close();
      pickerTarget = null;
    });

    // ---- 値の設定・保存 ----

    function setGrade(level, side, grade, modifier, method, memo) {
      const def = defs.find((d) => d.level === level);
      if (!def) return false;
      if (isncsciMode() && modifier) modifier = ""; // 準拠モードでは中間表記を保存しない
      const ts = ensureSession();
      const rec = Store.upsertMMT({
        patient: patient(),
        level,
        muscle: def.muscleJa,
        side,
        grade,
        modifier: modifier || "",
        method: method || "タップ",
        memo: memo || "",
      }, ts);
      if (!rec) { app.toast("保存できませんでした(値を確認してください)"); return false; }
      grid[key(level, side)] = { grade, modifier: modifier || "", method, memo, id: rec.id };
      render();
      renderHistory();
      return true;
    }

    function clearGrade(level, side) {
      const cur = grid[key(level, side)];
      if (cur && cur.id) Store.deleteMMT(cur.id);
      delete grid[key(level, side)];
      render();
      renderHistory();
    }

    // ---- 音声入力 ----

    function stopVoice() {
      if (recognizer && recognizer.isRunning()) recognizer.stop();
    }

    function setVoiceUI(on) {
      voiceBtn.classList.toggle("armed", on);
      voiceBtn.textContent = on ? "🎤 音声入力中(タップで停止)" : "🎤 音声で入力";
      if (!on) voiceEcho.textContent = "";
    }

    function handleVoiceText(text, isFinal) {
      voiceEcho.textContent = (isFinal ? "" : "…") + text;
      if (!isFinal) return;

      // 「患者 A12」のように合図語がある発話は患者切替として扱う。
      // ID形式でない発話(氏名など)はここで採用されない。
      if (/(患者|かんじゃ|ペイシェント)/.test(VP.toHalfWidth(text))) {
        const pt = VP.parsePatient(text, Store.listPatients());
        if (pt) {
          switchPatient(pt.patient);
          voiceEcho.textContent = "✓ 患者 " + pt.patient + " に切り替えました";
          app.toast("患者 " + pt.patient + " に切り替え");
        } else {
          voiceEcho.textContent = "患者IDとして採用できません: 「" + text + "」" +
            " ※ID形式(英字＋数字)のみ。氏名は登録されません";
        }
        return;
      }

      const parsed = VP.parseMMT(text, defs);
      if (!parsed) {
        voiceEcho.textContent = "解釈できません: 「" + text + "」 例: 「右 L4 4」「患者 A12」";
        return;
      }
      if (!visibleDefs().some((d) => d.level === parsed.level)) {
        // 表示範囲外の髄節を言われた場合は範囲を広げて反映する
        region = "all";
        syncRegionButtons();
      }
      const okSet = setGrade(parsed.level, parsed.side, parsed.grade, parsed.modifier, "音声", "音声認識: " + parsed.transcript);
      if (okSet) {
        voiceEcho.textContent = "✓ " + parsed.side + " " + parsed.level + " → MMT " + parsed.grade + (parsed.modifier || "");
        app.toast(parsed.side + parsed.level + " MMT " + parsed.grade + (parsed.modifier || "") + " を記録");
      }
    }

    voiceBtn.addEventListener("click", async () => {
      if (recognizer && recognizer.isRunning()) { stopVoice(); return; }
      const okToUse = await app.ensureVoiceConsent();
      if (!okToUse) return;
      if (!global.Voice.isSupported()) {
        app.toast("このブラウザは音声入力に対応していません(Chrome/Edge/Safariをお試しください)");
        return;
      }
      if (!recognizer) {
        recognizer = global.Voice.createRecognizer({
          lang: "ja-JP",
          onResult: handleVoiceText,
          onStart: () => setVoiceUI(true),
          onEnd: () => setVoiceUI(false),
          onMode: (mode) => app.showVoiceMode(mode),
          onError: (_kind, msg) => { voiceEcho.textContent = msg; app.toast(msg); },
        });
      }
      recognizer.start();
    });

    // ---- 診察セッション ----

    newSessionBtn.addEventListener("click", () => {
      if (filledCount() && !confirm("新しい診察として入力を始めます。\n(いま入力済みの記録は保存済みのまま残ります)")) return;
      sessionTs = null;
      grid = {};
      render();
      app.toast("新しい診察を開始しました");
    });

    // ---- 直近の記録表示 ----

    function renderHistory() {
      const p = patient();
      historyEl.innerHTML = "";
      if (!p) return;
      const list = Store.loadMMT().filter((r) => r.patient === p);
      if (!list.length) return;

      // 診察(タイムスタンプ)ごとにまとめ、直近3件を表示
      const bySession = new Map();
      for (const r of list) {
        if (!bySession.has(r.ts)) bySession.set(r.ts, []);
        bySession.get(r.ts).push(r);
      }
      const sessions = Array.from(bySession.entries()).slice(0, 3);
      for (const [ts, items] of sessions) {
        const card = document.createElement("div");
        card.className = "mmt-history-card";
        const h = document.createElement("div");
        h.className = "mmt-history-date";
        h.textContent = Store.fmtDate(ts) + " " + Store.fmtTime(ts) +
          (ts === sessionTs ? "(入力中)" : "") + " ・ " + items.length + "件";
        card.appendChild(h);
        const body = document.createElement("div");
        body.className = "mmt-history-items";
        items.slice().sort((a, b) => a.level.localeCompare(b.level)).forEach((r) => {
          const chip = document.createElement("span");
          chip.className = "mmt-history-chip";
          if (r.grade <= 3) chip.classList.add("low");
          chip.textContent = r.side + r.level + " " + Store.gradeText(r);
          if (r.method === "音声") chip.title = r.memo;
          body.appendChild(chip);
        });
        card.appendChild(body);
        historyEl.appendChild(card);
      }
    }

    // ---- 領域切替・患者選択 ----

    function syncRegionButtons() {
      for (const [k, btn] of Object.entries(regionSeg)) {
        btn.classList.toggle("active", k === region);
      }
      render();
    }
    for (const [k, btn] of Object.entries(regionSeg)) {
      btn.addEventListener("click", () => { region = k; syncRegionButtons(); });
    }

    // 患者が変わったら別の診察として扱う。値が変わっていない場合は何もしない
    // (入力欄からフォーカスが外れるたびに状態を捨てないようにするため)
    let lastPatient = patientInput.value.trim();

    function switchPatient(id) {
      patientInput.value = id;
      if (id === lastPatient) return;
      lastPatient = id;
      sessionTs = null;
      grid = {};
      render();
      renderHistory();
    }

    patientInput.addEventListener("change", () => switchPatient(patient()));

    $("mmtCSV").addEventListener("click", () => {
      const p = patient();
      const list = Store.loadMMT().filter((r) => !p || r.patient === p);
      if (!list.length) { app.toast("エクスポートするMMT記録がありません"); return; }
      const name = "mmt-records-" + (p ? p.replace(/[^A-Za-z0-9_-]/g, "") + "-" : "") + app.stamp() + ".csv";
      app.downloadText(name, Store.mmtToCSV(list), "text/csv");
      // どの範囲を書き出したかを明示する(患者が選ばれていると絞り込まれるため)
      app.toast(p ? "患者 " + p + " のMMT " + list.length + "件を書き出しました"
                  : "全患者のMMT " + list.length + "件を書き出しました");
    });

    buildTable();
    render();
    renderHistory();

    return {
      deactivate() { stopVoice(); },
      refresh() { render(); renderHistory(); },
    };
  }

  global.MMT = { init };
})(window);
