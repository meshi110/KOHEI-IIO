/*
 * ROMレコーダー app
 * タブ切替・記録ダイアログ・記録一覧/経過グラフ・設定・初回免責表示。
 */
(function (global) {
  "use strict";

  const AC = global.AngleCore;
  const Store = global.Store;
  const Refs = global.Refs;

  const $ = (id) => document.getElementById(id);

  let liveCtl = null, vidCtl = null, photoCtl = null, mmtCtl = null;
  let recChart = null;
  let editingId = null;

  const App = {
    getSettings: () => Store.loadSettings(),
    saveSettings: (patch) => Store.saveSettings(patch),
    toast, openSaveDialog, downloadText,
    refreshRecords,
    stamp: () => stamp(),
    ensureVoiceConsent,
    showVoiceMode,
  };

  // 音声認識が端末内処理かサーバー処理かを、利用者に分かるように表示する
  function showVoiceMode(mode) {
    const local = mode === "local";
    const msg = local
      ? "音声は端末内で処理されています(外部送信なし)"
      : "音声は認識サーバーへ送信されて処理されます。患者情報は声に出さないでください";
    $("voiceLocalStatus").textContent = (local ? "🔒 " : "☁️ ") + msg;
    $("voiceLocalStatus").classList.toggle("warn", !local);
    if (!local) toast("☁️ サーバー処理で認識中(患者情報は言わないでください)");
  }

  // ---- 共通ユーティリティ ----

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }

  // ---- タブ ----

  const TAB_DEACTIVATE = {
    live: () => liveCtl && liveCtl.deactivate(),
    video: () => vidCtl && vidCtl.deactivate(),
    mmt: () => mmtCtl && mmtCtl.deactivate(),
    records: () => stopRecVoice(),
  };
  let currentTab = "live";

  function switchTab(name) {
    if (name === currentTab) return;
    if (TAB_DEACTIVATE[currentTab]) TAB_DEACTIVATE[currentTab]();
    currentTab = name;
    document.querySelectorAll(".tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
    if (name === "records") refreshRecords();
    if (name === "photo" && photoCtl) photoCtl.redraw();
    if (name === "mmt" && mmtCtl) mmtCtl.refresh();
  }

  // ---- 音声入力の同意 ----
  // 音声データが外部の認識サーバへ送られ得るため、初回に必ず明示的な同意を取る。

  function ensureVoiceConsent() {
    return new Promise((resolve) => {
      const s = Store.loadSettings();
      if (s.voiceEnabled && s.voiceAck) { resolve(true); return; }
      const dlg = $("voiceDialog");
      const onAck = () => { cleanup(); Store.saveSettings({ voiceAck: true, voiceEnabled: true }); syncVoiceSetting(); resolve(true); };
      const onNo = () => { cleanup(); resolve(false); };
      function cleanup() {
        $("voiceAck").removeEventListener("click", onAck);
        $("voiceDecline").removeEventListener("click", onNo);
        dlg.close();
      }
      $("voiceAck").addEventListener("click", onAck);
      $("voiceDecline").addEventListener("click", onNo);
      dlg.showModal();
    });
  }

  function syncVoiceSetting() {
    const s = Store.loadSettings();
    $("setVoice").checked = !!(s.voiceEnabled && s.voiceAck);
  }

  // ---- 記録ダイアログ ----

  function openSaveDialog(prefill) {
    prefill = prefill || {};
    editingId = prefill.id || null;
    $("saveTitle").textContent = editingId ? "記録を編集" : "計測を記録";
    $("savePatient").value = prefill.patient ?? $("savePatient").value ?? "";
    if (editingId) $("savePatient").value = prefill.patient || "";
    $("saveJoint").value = prefill.joint ?? "";
    $("saveMotion").value = prefill.motion ?? "";
    $("saveSide").value = prefill.side || "";
    $("saveAngle").value = prefill.angle ?? "";
    $("saveMethod").value = prefill.method || "手入力";
    $("saveMemo").value = prefill.memo ?? "";
    updatePatientList();
    $("saveDialog").showModal();
  }

  function submitSave(ev) {
    ev.preventDefault();
    const angle = Number($("saveAngle").value);
    if (!isFinite(angle)) { toast("角度を入力してください"); return; }
    const rec = {
      patient: $("savePatient").value.trim(),
      joint: $("saveJoint").value.trim(),
      motion: $("saveMotion").value.trim(),
      side: $("saveSide").value,
      angle,
      method: $("saveMethod").value.trim(),
      memo: $("saveMemo").value.trim(),
    };
    if (editingId) {
      Store.updateRecord(editingId, rec);
      toast("記録を更新しました");
    } else {
      Store.addRecord(rec);
      toast("記録しました");
    }
    editingId = null;
    $("saveDialog").close();
    refreshRecords();
  }

  function updatePatientList() {
    const dl = $("patientList");
    dl.innerHTML = "";
    for (const p of Store.listPatients()) {
      const o = document.createElement("option");
      o.value = p;
      dl.appendChild(o);
    }
  }

  // ---- 記録一覧 ----

  function currentFilter() {
    return {
      patient: $("recFilterPatient").value,
      joint: $("recFilterJoint").value,
    };
  }

  function filteredRecords() {
    const f = currentFilter();
    return Store.loadRecords().filter((r) =>
      (!f.patient || r.patient === f.patient) &&
      (!f.joint || r.joint === f.joint)
    );
  }

  function fillSelect(sel, values, allLabel) {
    const prev = sel.value;
    sel.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    sel.appendChild(all);
    for (const v of values) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    }
    if (values.includes(prev)) sel.value = prev;
  }

  function refreshRecords() {
    const records = Store.loadRecords();
    updatePatientList();
    fillSelect($("recFilterPatient"), Array.from(new Set(records.map((r) => r.patient).filter(Boolean))).sort(), "全患者");
    fillSelect($("recFilterJoint"), Array.from(new Set(records.map((r) => r.joint).filter(Boolean))).sort(), "全関節");

    const list = filteredRecords();
    const tbody = $("recTableBody");
    tbody.innerHTML = "";
    $("recEmpty").style.display = list.length ? "none" : "";
    $("recCount").textContent = list.length ? list.length + "件" : "";
    const LIMIT = 300;
    for (const r of list.slice(0, LIMIT)) {
      const tr = document.createElement("tr");
      const cells = [
        Store.fmtDate(r.ts) + " " + Store.fmtTime(r.ts),
        r.patient || "-",
        (r.joint + " " + r.motion).trim() || "-",
        r.side || "-",
        r.angle + "°",
        r.method || "-",
        r.memo || "",
      ];
      for (const c of cells) {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      }
      const tdOps = document.createElement("td");
      tdOps.className = "ops";
      const edit = document.createElement("button");
      edit.type = "button"; edit.className = "icon-btn"; edit.textContent = "✏️"; edit.title = "編集";
      edit.addEventListener("click", () => openSaveDialog(r));
      const del = document.createElement("button");
      del.type = "button"; del.className = "icon-btn danger"; del.textContent = "🗑️"; del.title = "削除";
      del.addEventListener("click", () => {
        if (confirm("この記録を削除しますか?\n" + cells[0] + " " + cells[1] + " " + cells[2] + " " + cells[4])) {
          Store.deleteRecord(r.id);
          refreshRecords();
        }
      });
      tdOps.appendChild(edit);
      tdOps.appendChild(del);
      tr.appendChild(tdOps);
      tbody.appendChild(tr);
    }
    if (list.length > LIMIT) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.textContent = "…ほか " + (list.length - LIMIT) + " 件(CSVエクスポートで全件出力できます)";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    refreshMMTRecords();
    refreshProgress(records);
  }

  // ---- MMT記録一覧 ----

  function refreshMMTRecords() {
    const f = currentFilter();
    const list = Store.loadMMT().filter((r) => !f.patient || r.patient === f.patient);
    const tbody = $("mmtRecTableBody");
    tbody.innerHTML = "";
    $("mmtRecEmpty").style.display = list.length ? "none" : "";
    $("mmtRecCount").textContent = list.length ? list.length + "件" : "";
    const LIMIT = 200;
    for (const r of list.slice(0, LIMIT)) {
      const tr = document.createElement("tr");
      const cells = [
        Store.fmtDate(r.ts) + " " + Store.fmtTime(r.ts),
        r.patient || "-", r.level, r.muscle, r.side,
        Store.gradeText(r), r.method || "-", r.memo || "",
      ];
      for (const c of cells) {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      }
      const tdOps = document.createElement("td");
      tdOps.className = "ops";
      const del = document.createElement("button");
      del.type = "button"; del.className = "icon-btn danger"; del.textContent = "🗑️"; del.title = "削除";
      del.addEventListener("click", () => {
        if (confirm("このMMT記録を削除しますか?\n" + cells[0] + " " + cells[1] + " " + r.side + r.level + " " + Store.gradeText(r))) {
          Store.deleteMMT(r.id);
          refreshRecords();
          if (mmtCtl) mmtCtl.refresh();
        }
      });
      tdOps.appendChild(del);
      tr.appendChild(tdOps);
      tbody.appendChild(tr);
    }
    if (list.length > LIMIT) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.textContent = "…ほか " + (list.length - LIMIT) + " 件(MMT CSVで全件出力できます)";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  // ---- 経過グラフ ----

  function seriesKey(r) { return [r.joint, r.motion, r.side].join("|"); }

  function refFor(joint, motion) {
    const preset = AC.PRESETS.find((p) => p.joint === joint && p.motion === motion);
    if (!preset) return null;
    const v = Store.loadSettings().refValues[preset.refKey];
    return (v === null || v === undefined || v === "") ? null : Number(v);
  }

  function refreshProgress(records) {
    const patients = Array.from(new Set(records.map((r) => r.patient).filter(Boolean))).sort();
    fillSelect($("progPatient"), patients, "患者を選択");
    const pat = $("progPatient").value;
    const subset = records.filter((r) => r.patient === pat);
    const keys = Array.from(new Set(subset.map(seriesKey))).sort();
    const sel = $("progSeries");
    const prev = sel.value;
    sel.innerHTML = "";
    for (const k of keys) {
      const [joint, motion, side] = k.split("|");
      const o = document.createElement("option");
      o.value = k;
      o.textContent = ((side ? side + " " : "") + joint + " " + motion).trim();
      sel.appendChild(o);
    }
    if (keys.includes(prev)) sel.value = prev;

    const key = sel.value;
    const data = subset
      .filter((r) => seriesKey(r) === key)
      .map((r) => ({ x: Date.parse(r.ts), y: r.angle }))
      .sort((a, b) => a.x - b.x);
    if (!recChart) {
      recChart = global.createLineChart($("recChart"), {
        xType: "date",
        emptyText: "患者と計測項目を選ぶと経過が表示されます(2件以上で折れ線)",
      });
    }
    if (key) {
      const [joint, motion] = key.split("|");
      const rv = refFor(joint, motion);
      recChart.setRef(rv, "参考");
    } else {
      recChart.setRef(null);
    }
    recChart.setData(data);
  }

  // ---- 設定 ----

  function renderRefTable() {
    const tbody = $("refTableBody");
    const refValues = Store.loadSettings().refValues;
    tbody.innerHTML = "";
    for (const item of Refs.REF_ITEMS) {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.textContent = item.joint + " " + item.motion;
      const td2 = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.step = "1";
      input.inputMode = "numeric";
      input.placeholder = "未設定";
      const v = refValues[item.key];
      input.value = (v === null || v === undefined) ? "" : v;
      input.addEventListener("change", () => {
        const next = Object.assign({}, Store.loadSettings().refValues);
        if (input.value === "") delete next[item.key];
        else next[item.key] = Number(input.value);
        Store.saveSettings({ refValues: next });
        refreshRecords();
      });
      td2.appendChild(input);
      const unit = document.createElement("span");
      unit.textContent = " °";
      td2.appendChild(unit);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    }
  }

  function renderSourceList(ul, sources) {
    ul.innerHTML = "";
    for (const s of sources) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = s.label;
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  function renderRefSources() {
    renderSourceList($("refSources"), Refs.REF_SOURCES);
  }

  function renderMMTInfo() {
    const D = global.MMTDefs;
    $("mmtDefsNote").textContent = D.SCALE_NOTE;
    $("mmtSourceNote").textContent = D.SOURCE_NOTE;
    renderSourceList($("mmtSources"), D.SOURCES);
    renderSourceList($("voiceSources"), D.VOICE_SOURCES);
  }

  function prefillRefs() {
    const msg =
      "一般的な参考可動域の候補値をまとめて入力します。\n\n" +
      "注意: この候補値は二次情報(Web上の要約)由来で、学会原典PDFとの照合は済んでいません(特に上肢は資料間で差異あり)。\n" +
      "臨床で使う前に、設定画面のリンクから原典をご確認のうえ必要なら修正してください。\n\n入力しますか?";
    if (!confirm(msg)) return;
    const next = Object.assign({}, Store.loadSettings().refValues);
    for (const [k, v] of Object.entries(Refs.REF_CANDIDATES)) next[k] = v;
    Store.saveSettings({ refValues: next });
    renderRefTable();
    refreshRecords();
    toast("候補値を入力しました(要確認)");
  }

  // ---- データ管理 ----

  function wireDataOps() {
    $("recAdd").addEventListener("click", () => openSaveDialog({ method: "手入力" }));
    $("recCSV").addEventListener("click", () => {
      const list = filteredRecords();
      if (!list.length) { toast("エクスポートする記録がありません"); return; }
      downloadText("rom-records-" + stamp() + ".csv", Store.recordsToCSV(list), "text/csv");
    });
    $("recBackup").addEventListener("click", () => {
      downloadText("rom-backup-" + stamp() + ".json", Store.exportJSON(), "application/json");
    });
    $("recRestoreInput").addEventListener("change", async () => {
      const f = $("recRestoreInput").files[0];
      $("recRestoreInput").value = "";
      if (!f) return;
      try {
        const text = await f.text();
        const replace = confirm("OK: 既存の記録に追記(推奨)\nキャンセル: 置き換えの確認へ進む");
        let result;
        if (replace) {
          result = Store.importJSON(text, "merge");
        } else {
          if (!confirm("現在の記録をすべて置き換えます。よろしいですか?")) return;
          result = Store.importJSON(text, "replace");
        }
        toast("復元しました(角度 " + result.total + "件 / MMT " + result.mmtTotal + "件)");
        refreshRecords();
        renderRefTable();
        if (mmtCtl) mmtCtl.refresh();
      } catch (e) {
        alert("復元に失敗しました: " + e.message);
      }
    });
    $("recClearAll").addEventListener("click", () => {
      const n = Store.loadRecords().length;
      const m = Store.loadMMT().length;
      if (!n && !m) { toast("記録はありません"); return; }
      if (!confirm("角度 " + n + "件・MMT " + m + "件をすべて削除します。よろしいですか?")) return;
      if (!confirm("最終確認: 削除すると元に戻せません。先にバックアップ(JSON)を取ることを推奨します。削除しますか?")) return;
      for (const r of Store.loadRecords()) Store.deleteRecord(r.id);
      for (const r of Store.loadMMT()) Store.deleteMMT(r.id);
      refreshRecords();
      if (mmtCtl) mmtCtl.refresh();
      toast("すべての記録を削除しました");
    });
    $("recFilterPatient").addEventListener("change", refreshRecords);
    $("recFilterJoint").addEventListener("change", refreshRecords);
    $("progPatient").addEventListener("change", () => refreshProgress(Store.loadRecords()));
    $("progSeries").addEventListener("change", () => refreshProgress(Store.loadRecords()));
  }

  // ---- 角度の音声入力 ----
  // 認識できたら記録ダイアログに流し込み、保存は医師の確認(1タップ)で行う。
  // 患者IDは音声では扱わず、記録タブのフィルタで選択中の患者を初期値にする。

  let recRecognizer = null;
  let saveRecognizer = null;
  let voicePatient = "";   // 音声で指定された対象患者(次の記録に適用)

  function stopRecVoice() {
    if (recRecognizer && recRecognizer.isRunning()) recRecognizer.stop();
  }

  function setVoiceBtnUI(btn, on, labelOff) {
    btn.classList.toggle("armed", on);
    btn.textContent = on ? "🎤 停止" : labelOff;
  }

  async function startRecVoice() {
    if (recRecognizer && recRecognizer.isRunning()) { stopRecVoice(); return; }
    if (!(await ensureVoiceConsent())) return;
    if (!global.Voice.isSupported()) {
      toast("このブラウザは音声入力に対応していません(Chrome/Edge/Safariをお試しください)");
      return;
    }
    if (!recRecognizer) {
      recRecognizer = global.Voice.createRecognizer({
        lang: "ja-JP",
        onStart: () => setVoiceBtnUI($("recVoiceBtn"), true, "🎤 音声で角度を記録"),
        onEnd: () => setVoiceBtnUI($("recVoiceBtn"), false, "🎤 音声で角度を記録"),
        onMode: (mode) => showVoiceMode(mode),
        onError: (_k, msg) => toast(msg),
        onResult: (text, isFinal) => {
          if (!isFinal) return;
          const VP = global.VoiceParse;
          // 「患者 A12」で対象患者を先に指定できる(ID形式のみ。氏名は採用されない)
          if (/(患者|かんじゃ|ペイシェント)/.test(VP.toHalfWidth(text))) {
            const pt = VP.parsePatient(text, Store.listPatients());
            if (pt) {
              voicePatient = pt.patient;
              toast("患者 " + pt.patient + " を対象にします");
            } else {
              toast("患者IDとして採用できません(ID形式のみ・氏名は登録されません)");
            }
            return;
          }
          const parsed = VP.parseROM(text);
          if (!parsed) { toast("解釈できません: 「" + text + "」 例: 「膝 屈曲 右 120」"); return; }
          stopRecVoice();
          openSaveDialog({
            patient: voicePatient || $("recFilterPatient").value || "",
            joint: parsed.joint,
            motion: parsed.motion,
            side: parsed.side,
            angle: parsed.angle,
            method: "音声",
            memo: "音声認識: " + parsed.transcript,
          });
        },
      });
    }
    recRecognizer.start();
  }

  async function startSaveVoice() {
    if (saveRecognizer && saveRecognizer.isRunning()) { saveRecognizer.stop(); return; }
    if (!(await ensureVoiceConsent())) return;
    if (!global.Voice.isSupported()) {
      toast("このブラウザは音声入力に対応していません");
      return;
    }
    if (!saveRecognizer) {
      saveRecognizer = global.Voice.createRecognizer({
        lang: "ja-JP",
        onStart: () => setVoiceBtnUI($("saveVoiceBtn"), true, "🎤 音声で入力(部位・左右・数値のみ)"),
        onEnd: () => setVoiceBtnUI($("saveVoiceBtn"), false, "🎤 音声で入力(部位・左右・数値のみ)"),
        onMode: (mode) => showVoiceMode(mode),
        onError: (_k, msg) => { $("saveVoiceEcho").textContent = msg; },
        onResult: (text, isFinal) => {
          $("saveVoiceEcho").textContent = (isFinal ? "" : "…") + text;
          if (!isFinal) return;
          const parsed = global.VoiceParse.parseROM(text);
          if (!parsed) { $("saveVoiceEcho").textContent = "解釈できません: 「" + text + "」 例: 「膝 屈曲 右 120」"; return; }
          if (parsed.joint) $("saveJoint").value = parsed.joint;
          if (parsed.motion) $("saveMotion").value = parsed.motion;
          if (parsed.side) $("saveSide").value = parsed.side;
          $("saveAngle").value = parsed.angle;
          $("saveMethod").value = "音声";
          $("saveMemo").value = "音声認識: " + parsed.transcript;
          $("saveVoiceEcho").textContent = "✓ " + (parsed.side || "") + parsed.joint + parsed.motion + " " + parsed.angle + "°";
        },
      });
    }
    saveRecognizer.start();
  }

  // ---- 初回免責 ----

  function maybeShowDisclaimer() {
    if (!Store.loadSettings().disclaimerAck) {
      $("disclaimerDialog").showModal();
    }
  }

  // ---- 初期化 ----

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tabs button").forEach((b) => {
      b.addEventListener("click", () => switchTab(b.dataset.tab));
    });

    $("saveForm").addEventListener("submit", submitSave);
    $("saveCancel").addEventListener("click", () => { editingId = null; $("saveDialog").close(); });
    $("saveDialog").addEventListener("close", () => {
      if (saveRecognizer && saveRecognizer.isRunning()) saveRecognizer.stop();
      $("saveVoiceEcho").textContent = "";
    });
    $("saveVoiceBtn").addEventListener("click", startSaveVoice);
    $("recVoiceBtn").addEventListener("click", startRecVoice);

    $("setVoice").addEventListener("change", async () => {
      if ($("setVoice").checked) {
        const ok = await ensureVoiceConsent();
        if (!ok) $("setVoice").checked = false;
      } else {
        Store.saveSettings({ voiceEnabled: false });
      }
    });
    $("showVoiceNotice").addEventListener("click", () => $("voiceDialog").showModal());

    const isncsciChk = $("setIsncsci");
    isncsciChk.checked = !!Store.loadSettings().isncsciMode;
    isncsciChk.addEventListener("change", () => {
      Store.saveSettings({ isncsciMode: isncsciChk.checked });
      if (mmtCtl) mmtCtl.refresh();
      toast(isncsciChk.checked
        ? "ISNCSCI準拠モード: 0〜5の整数のみで採点します"
        : "通常モード: 「+」「−」の中間表記も使えます");
    });

    $("discAck").addEventListener("click", () => {
      Store.saveSettings({ disclaimerAck: true });
      $("disclaimerDialog").close();
    });
    $("showDisclaimer").addEventListener("click", () => $("disclaimerDialog").showModal());

    const modelSel = $("setModel");
    modelSel.value = Store.loadSettings().modelVariant;
    modelSel.addEventListener("change", () => {
      Store.saveSettings({ modelVariant: modelSel.value });
      toast(modelSel.value === "full"
        ? "高精度モデルは初回にネット接続が必要です(次回のカメラ/解析開始から適用)"
        : "軽量モデルを使用します(次回のカメラ/解析開始から適用)");
    });

    $("refPrefill").addEventListener("click", prefillRefs);

    photoCtl = global.PhotoMeasure.init(App);
    liveCtl = global.AiLive.init(App);
    vidCtl = global.AiVideo.init(App);
    mmtCtl = global.MMT.init(App);

    renderRefTable();
    renderRefSources();
    renderMMTInfo();
    syncVoiceSetting();
    wireDataOps();
    refreshRecords();
    maybeShowDisclaimer();

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW登録失敗", e));
    }
  });

  global.App = App;
})(window);
