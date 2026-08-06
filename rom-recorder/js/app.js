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

  let liveCtl = null, vidCtl = null, photoCtl = null;
  let recChart = null;
  let editingId = null;

  const App = {
    getSettings: () => Store.loadSettings(),
    saveSettings: (patch) => Store.saveSettings(patch),
    toast, openSaveDialog, downloadText,
    refreshRecords,
  };

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
    refreshProgress(records);
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

  function renderRefSources() {
    const ul = $("refSources");
    ul.innerHTML = "";
    for (const s of Refs.REF_SOURCES) {
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
        toast("復元しました(計 " + result.total + " 件)");
        refreshRecords();
        renderRefTable();
      } catch (e) {
        alert("復元に失敗しました: " + e.message);
      }
    });
    $("recClearAll").addEventListener("click", () => {
      const n = Store.loadRecords().length;
      if (!n) { toast("記録はありません"); return; }
      if (!confirm("全 " + n + " 件の記録を削除します。よろしいですか?")) return;
      if (!confirm("最終確認: 削除すると元に戻せません。先にバックアップ(JSON)を取ることを推奨します。削除しますか?")) return;
      for (const r of Store.loadRecords()) Store.deleteRecord(r.id);
      refreshRecords();
      toast("すべての記録を削除しました");
    });
    $("recFilterPatient").addEventListener("change", refreshRecords);
    $("recFilterJoint").addEventListener("change", refreshRecords);
    $("progPatient").addEventListener("change", () => refreshProgress(Store.loadRecords()));
    $("progSeries").addEventListener("change", () => refreshProgress(Store.loadRecords()));
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

    renderRefTable();
    renderRefSources();
    wireDataOps();
    refreshRecords();
    maybeShowDisclaimer();

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW登録失敗", e));
    }
  });

  global.App = App;
})(window);
