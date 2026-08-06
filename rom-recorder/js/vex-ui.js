/*
 * ボイス検査タブ UI
 * 準備 → 実施(音声のみで進行) → 結果確認 → 保存。シート編集はダイアログ。
 * 音声使用の同意はアプリ共通(Store.voiceAck)を再利用する。
 */
(function (global) {
  "use strict";

  const VStore = global.VexStore;
  const Items = global.VexItems;
  const VSession = global.VexSession;
  const VSpeech = global.VexSpeech;
  const $ = (id) => document.getElementById(id);

  let app = null;
  let runner = null;
  let recognizer = null;
  let wakeLock = null;
  let steps = [];
  let pending = null;
  let editTplId = null;

  function showView(v) {
    for (const name of ["Setup", "Exec", "Result"]) {
      $("vex" + name).hidden = (name.toLowerCase() !== v);
    }
  }

  // ---- 準備 ----

  function refreshSetup() {
    const sel = $("vexTemplate");
    const prev = sel.value;
    sel.innerHTML = "";
    for (const t of VStore.loadTemplates()) {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name + "(" + VSession.buildSteps(t.items).length + "項目)";
      sel.appendChild(o);
    }
    if (Array.from(sel.options).some((o) => o.value === prev)) sel.value = prev;
    const ng = [];
    if (!VSpeech.ttsSupported()) ng.push("このブラウザは読み上げに対応していません");
    if (!VSpeech.srSupported()) ng.push("このブラウザは音声認識に対応していません(iPhoneはSafari、PCはChrome/Edge)");
    $("vexSupport").textContent = ng.join(" / ");
    $("vexStart").disabled = ng.length > 0;
  }

  async function start() {
    // 音声使用の同意はアプリ共通(MMTタブと同じダイアログ)を再利用する
    if (!(await app.ensureVoiceConsent())) return;
    const tpl = VStore.loadTemplates().find((t) => t.id === $("vexTemplate").value);
    if (!tpl) { app.toast("シートを選択してください"); return; }
    steps = VSession.buildSteps(tpl.items);
    if (!steps.length) { app.toast("シートに項目がありません(シートを編集から追加)"); return; }
    const patient = $("vexPatient").value.trim();
    const s = VStore.loadSettings();

    try { wakeLock = await navigator.wakeLock.request("screen"); } catch (_e) { wakeLock = null; }

    recognizer = VSpeech.createRecognizer({
      onText(t, isFinal) {
        $("vexInterim").textContent = (isFinal ? "" : "…") + t;
        if (isFinal && runner) runner.handleText(t);
      },
      onState(st) {
        $("vexMic").textContent = st === "listening" ? "🎤 認識中" : (st === "denied" ? "🚫 マイク不許可" : "…");
      },
    });
    if (!recognizer) { app.toast("音声認識を初期化できませんでした"); return; }

    const io = {
      speak: (t) => VSpeech.speak(t, { rate: s.rate, voiceURI: s.voiceURI }),
      startListen: () => recognizer && recognizer.start(),
      stopListen: () => recognizer && recognizer.stop(),
    };
    runner = VSession.createRunner(steps, io, {
      echo: s.echo,
      onUpdate: renderExec,
      onDone: (results, meta) => finish(tpl, patient, results, meta),
    });
    $("vexInterim").textContent = "";
    showView("exec");
    runner.start();
  }

  function renderExec(st) {
    $("vexProgress").textContent = Math.min(st.idx + 1, st.total) + " / " + st.total;
    $("vexBar").style.width = (st.total ? Math.round((st.idx / st.total) * 100) : 0) + "%";
    $("vexItem").textContent = st.step ? st.step.label : "完了";
    const hint = {
      prompting: "🔊 読み上げ中…",
      listening: "🎤 どうぞ",
      paused: "⏸ 一時停止中(「再開」で続行)",
      done: "完了",
    };
    $("vexStatus").textContent = hint[st.status] || "";
    $("vexPause").textContent = st.status === "paused" ? "再開" : "一時停止";
    const prev = st.idx > 0 ? st.results[st.idx - 1] : null;
    $("vexLast").textContent = prev
      ? "直前: " + steps[st.idx - 1].label + " → " + (prev.status === "skip" ? "スキップ" : prev.display)
      : "";
    const next = [];
    for (let i = st.idx + 1; i < Math.min(st.total, st.idx + 4); i++) next.push(steps[i].label);
    $("vexNext").textContent = next.length ? "次: " + next.join(" / ") : "";
  }

  function finish(tpl, patient, results, meta) {
    if (recognizer) recognizer.stop();
    if (wakeLock) { try { wakeLock.release(); } catch (_e) {} wakeLock = null; }
    pending = { patient, templateName: tpl.name, steps, results, aborted: meta.aborted };
    renderResult();
    showView("result");
  }

  function renderResult() {
    const tbody = $("vexResultBody");
    tbody.innerHTML = "";
    let done = 0, skip = 0, miss = 0;
    pending.steps.forEach((st, i) => {
      const r = pending.results[i];
      if (r && r.status === "done") done++;
      else if (r && r.status === "skip") skip++;
      else miss++;
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.textContent = st.label;
      const td2 = document.createElement("td");
      const input = document.createElement("input");
      input.value = r && r.status === "done" ? String(r.value) : "";
      input.placeholder = r && r.status === "skip" ? "スキップ" : "未実施";
      input.dataset.i = i;
      td2.appendChild(input);
      const td3 = document.createElement("td");
      td3.className = "raw";
      td3.textContent = r && r.raw ? r.raw : "";
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      tbody.appendChild(tr);
    });
    $("vexResultSummary").textContent =
      (pending.patient ? "患者 " + pending.patient + " ／ " : "") + pending.templateName +
      " ／ 記入 " + done + "・スキップ " + skip + "・未実施 " + miss +
      (pending.aborted ? " ／ 途中終了" : "");
  }

  function save() {
    $("vexResultBody").querySelectorAll("input").forEach((input) => {
      const i = Number(input.dataset.i);
      const v = input.value.trim();
      const orig = pending.results[i];
      if (v === "") {
        if (orig && orig.status === "done") pending.results[i] = null;
        return;
      }
      if (!orig || orig.status !== "done" || String(orig.value) !== v) {
        pending.results[i] = {
          status: "done", value: v, display: v,
          raw: (orig && orig.raw ? orig.raw + " " : "") + "(手修正)",
        };
      }
    });
    const rec = VStore.addSession(pending);
    if (!rec) { app.toast("保存に失敗しました"); return; }
    app.toast("評価シートを保存しました");
    pending = null;
    showView("setup");
    renderHistory();
  }

  // ---- 履歴 ----

  function miniBtn(label, fn, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sm" + (cls ? " " + cls : "");
    b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  }

  function renderHistory() {
    const wrap = $("vexHisList");
    const list = VStore.loadSessions();
    wrap.innerHTML = "";
    $("vexHisEmpty").style.display = list.length ? "none" : "";
    for (const s of list.slice(0, 50)) {
      const card = document.createElement("div");
      card.className = "his-card";
      const head = document.createElement("div");
      head.className = "his-head";
      const done = s.results.filter((r) => r && r.status === "done").length;
      head.textContent = VStore.fmtDate(s.ts) + " " + VStore.fmtTime(s.ts) + " ／ " +
        (s.patient || "(患者未記入)") + " ／ " + s.templateName +
        " ／ 記入" + done + "/" + s.steps.length + (s.aborted ? " ／ 途中終了" : "");
      const detail = document.createElement("div");
      detail.hidden = true;
      const btns = document.createElement("div");
      btns.className = "btn-row wrap";
      btns.appendChild(miniBtn("表示", () => {
        detail.hidden = !detail.hidden;
        if (!detail.hidden && !detail.dataset.filled) {
          const tw = document.createElement("div");
          tw.className = "table-wrap narrow";
          const tb = document.createElement("table");
          tb.innerHTML = "<thead><tr><th>項目</th><th>結果</th></tr></thead>";
          const body = document.createElement("tbody");
          s.steps.forEach((st, i) => {
            const r = s.results[i];
            const tr = document.createElement("tr");
            const a = document.createElement("td"); a.textContent = st.label;
            const b = document.createElement("td");
            b.textContent = !r ? "未実施" : (r.status === "skip" ? "スキップ" : String(r.value));
            tr.appendChild(a); tr.appendChild(b);
            body.appendChild(tr);
          });
          tb.appendChild(body);
          tw.appendChild(tb);
          detail.appendChild(tw);
          detail.dataset.filled = "1";
        }
      }));
      btns.appendChild(miniBtn("CSV", () =>
        app.downloadText("exam-" + (s.patient || "no-id") + "-" + app.stamp() + ".csv", VStore.sessionToCSV(s), "text/csv")));
      btns.appendChild(miniBtn("削除", () => {
        if (confirm("この記録を削除しますか?")) { VStore.deleteSession(s.id); renderHistory(); }
      }, "danger"));
      card.appendChild(head);
      card.appendChild(btns);
      card.appendChild(detail);
      wrap.appendChild(card);
    }
  }

  // ---- シート編集 ----

  function currentTpl() {
    const list = VStore.loadTemplates();
    return list.find((t) => t.id === editTplId) || list[0] || null;
  }

  function commit(tpl) {
    VStore.saveTemplate(tpl);
    renderEditor();
    refreshSetup();
  }

  function renderEditor() {
    const list = VStore.loadTemplates();
    if (!list.length) { VStore.saveTemplate({ name: "新しいシート", items: [] }); return renderEditor(); }
    if (!editTplId || !list.some((t) => t.id === editTplId)) editTplId = list[0].id;
    const sel = $("vexTplSelect");
    sel.innerHTML = "";
    for (const t of list) {
      const o = document.createElement("option");
      o.value = t.id; o.textContent = t.name;
      sel.appendChild(o);
    }
    sel.value = editTplId;
    const tpl = currentTpl();
    $("vexTplName").value = tpl.name;
    const wrap = $("vexTplItems");
    wrap.innerHTML = "";
    tpl.items.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "tpl-row";

      const name = document.createElement("input");
      name.value = it.name;
      name.className = "tpl-name";
      name.addEventListener("change", () => { it.name = name.value.trim() || it.name; commit(tpl); });

      const say = document.createElement("input");
      say.value = it.say || "";
      say.className = "tpl-say";
      say.placeholder = "読み(省略可)";
      say.title = "読み上げに使う日本語。英語略語のときに設定します";
      say.addEventListener("change", () => { it.say = say.value.trim(); commit(tpl); });

      const type = document.createElement("select");
      for (const [val, label] of Object.entries(Items.TYPE_LABELS)) {
        const o = document.createElement("option");
        o.value = val; o.textContent = label;
        type.appendChild(o);
      }
      type.value = it.type;
      type.addEventListener("change", () => { it.type = type.value; commit(tpl); });

      const bi = document.createElement("label");
      bi.className = "chk sm";
      const bic = document.createElement("input");
      bic.type = "checkbox";
      bic.checked = it.bilateral;
      bic.addEventListener("change", () => { it.bilateral = bic.checked; commit(tpl); });
      bi.appendChild(bic);
      bi.appendChild(document.createTextNode("両側"));

      row.appendChild(name);
      row.appendChild(say);
      row.appendChild(type);
      row.appendChild(bi);
      row.appendChild(miniBtn("↑", () => {
        if (i > 0) { tpl.items.splice(i - 1, 0, tpl.items.splice(i, 1)[0]); commit(tpl); }
      }));
      row.appendChild(miniBtn("↓", () => {
        if (i < tpl.items.length - 1) { tpl.items.splice(i + 1, 0, tpl.items.splice(i, 1)[0]); commit(tpl); }
      }));
      row.appendChild(miniBtn("✕", () => { tpl.items.splice(i, 1); commit(tpl); }, "danger"));
      wrap.appendChild(row);
    });
    $("vexTplCount").textContent = VSession.buildSteps(tpl.items).length + "項目(両側展開後)";
  }

  function renderLibrary() {
    const box = $("vexLibBody");
    box.innerHTML = "";
    for (const g of Items.LIBRARY) {
      const h = document.createElement("h3");
      h.textContent = g.group;
      box.appendChild(h);
      const row = document.createElement("div");
      row.className = "chip-row";
      for (const d of g.items) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = d[0];
        b.addEventListener("click", () => {
          const tpl = currentTpl();
          tpl.items.push(Items.makeItem(d[0], d[1], d[2], d[3], d[4]));
          commit(tpl);
          app.toast("追加: " + d[0]);
        });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
  }

  // ---- 設定 ----

  function fillVoices() {
    const sel = $("vexVoice");
    if (!sel) return;
    const s = VStore.loadSettings();
    sel.innerHTML = "";
    const auto = document.createElement("option");
    auto.value = ""; auto.textContent = "自動(日本語)";
    sel.appendChild(auto);
    for (const v of VSpeech.jaVoices()) {
      const o = document.createElement("option");
      o.value = v.voiceURI; o.textContent = v.name;
      sel.appendChild(o);
    }
    sel.value = s.voiceURI || "";
  }

  function init(appRef) {
    app = appRef;

    $("vexStart").addEventListener("click", start);
    $("vexSkip").addEventListener("click", () => runner && runner.skip());
    $("vexBack").addEventListener("click", () => runner && runner.back());
    $("vexRepeat").addEventListener("click", () => runner && runner.repeat());
    $("vexPause").addEventListener("click", () => {
      if (!runner) return;
      if (runner.state().status === "paused") runner.resume(); else runner.pause();
    });
    $("vexEnd").addEventListener("click", () => {
      if (runner && confirm("評価を終了しますか?(ここまでの結果は残ります)")) runner.finish();
    });
    $("vexResultSave").addEventListener("click", save);
    $("vexResultDiscard").addEventListener("click", () => {
      if (confirm("この評価結果を破棄しますか?")) { pending = null; showView("setup"); }
    });

    $("vexEditSheets").addEventListener("click", () => { renderEditor(); $("vexSheetDialog").showModal(); });
    $("vexSheetClose").addEventListener("click", () => { $("vexSheetDialog").close(); refreshSetup(); });
    $("vexTplSelect").addEventListener("change", () => { editTplId = $("vexTplSelect").value; renderEditor(); });
    $("vexTplName").addEventListener("change", () => {
      const tpl = currentTpl();
      tpl.name = $("vexTplName").value.trim() || tpl.name;
      commit(tpl);
    });
    $("vexTplNew").addEventListener("click", () => {
      const t = VStore.saveTemplate({ name: "新しいシート", items: [] });
      editTplId = t.id;
      renderEditor();
    });
    $("vexTplCopy").addEventListener("click", () => {
      const t = VStore.duplicateTemplate(editTplId);
      if (t) { editTplId = t.id; renderEditor(); app.toast("複製しました(自分用に並べ替えできます)"); }
    });
    $("vexTplDelete").addEventListener("click", () => {
      const tpl = currentTpl();
      if (confirm("シート「" + tpl.name + "」を削除しますか?")) {
        VStore.deleteTemplate(tpl.id);
        editTplId = null;
        renderEditor();
        refreshSetup();
      }
    });
    $("vexTplAddLib").addEventListener("click", () => { renderLibrary(); $("vexLibDialog").showModal(); });
    $("vexLibClose").addEventListener("click", () => $("vexLibDialog").close());
    $("vexTplAddCustom").addEventListener("click", () => {
      const name = $("vexCustomName").value.trim();
      if (!name) { app.toast("項目名を入力してください"); return; }
      const tpl = currentTpl();
      const type = $("vexCustomType").value;
      tpl.items.push(Items.makeItem(name, $("vexCustomSay").value.trim(), type, $("vexCustomBi").checked, type === "num" ? "°" : ""));
      $("vexCustomName").value = "";
      $("vexCustomSay").value = "";
      commit(tpl);
    });

    $("vexHisAllCSV").addEventListener("click", () => {
      if (!VStore.loadSessions().length) { app.toast("記録がありません"); return; }
      app.downloadText("exam-all-" + app.stamp() + ".csv", VStore.allSessionsCSV(), "text/csv");
    });

    $("vexRate").addEventListener("input", () => {
      $("vexRateVal").textContent = "×" + Number($("vexRate").value).toFixed(2);
      VStore.saveSettings({ rate: Number($("vexRate").value) });
    });
    $("vexEcho").addEventListener("change", () => VStore.saveSettings({ echo: $("vexEcho").checked }));
    $("vexVoice").addEventListener("change", () => VStore.saveSettings({ voiceURI: $("vexVoice").value }));
    $("vexTest").addEventListener("click", () => {
      const s = VStore.loadSettings();
      VSpeech.speak("次、右、上腕二頭筋反射。", { rate: s.rate, voiceURI: s.voiceURI });
    });
    if (global.speechSynthesis && global.speechSynthesis.addEventListener) {
      global.speechSynthesis.addEventListener("voiceschanged", fillVoices);
    }

    const s = VStore.loadSettings();
    $("vexRate").value = s.rate;
    $("vexRateVal").textContent = "×" + Number(s.rate).toFixed(2);
    $("vexEcho").checked = s.echo;
    fillVoices();

    showView("setup");
    refreshSetup();
    renderHistory();

    return {
      deactivate() {
        if (runner && runner.state().status !== "done") runner.finish();
        if (recognizer) recognizer.stop();
      },
      refresh() { refreshSetup(); renderHistory(); },
    };
  }

  global.VexUI = { init };
})(window);
