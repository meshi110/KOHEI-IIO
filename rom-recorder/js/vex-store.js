/*
 * ボイス検査 store
 * シート(テンプレート)・実施記録・設定の永続化(localStorage)とCSV/JSON入出力。
 * データはすべて端末内にのみ保存される(外部送信なし)。
 */
(function (global) {
  "use strict";

  const Items = (typeof module !== "undefined" && module.exports)
    ? require("./vex-items.js")
    : global.VexItems;

  const TPL_KEY = "vexam.templates.v1";
  const SES_KEY = "vexam.sessions.v1";
  const SET_KEY = "vexam.settings.v1";

  const DEFAULT_SETTINGS = { rate: 1.0, echo: true, voiceURI: "" };

  let storageImpl = null;
  function storage() { return storageImpl || global.localStorage; }

  function parseJSON(text, fallback) {
    try {
      const v = JSON.parse(text);
      return v === null || v === undefined ? fallback : v;
    } catch (_e) { return fallback; }
  }

  function gid() {
    return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---- シート ----

  function sanitizeItem(it) {
    if (!it || typeof it !== "object" || !String(it.name || "").trim()) return null;
    const type = ["pm", "num", "mmt", "reflex", "level", "nrs", "text"].includes(it.type) ? it.type : "pm";
    return {
      id: typeof it.id === "string" && it.id ? it.id : Items.gid(),
      name: String(it.name).trim(),
      say: String(it.say || "").trim(),
      type,
      bilateral: !!it.bilateral,
      unit: String(it.unit || "").trim(),
    };
  }

  function sanitizeTemplate(t) {
    if (!t || typeof t !== "object" || !String(t.name || "").trim()) return null;
    return {
      id: typeof t.id === "string" && t.id ? t.id : gid(),
      name: String(t.name).trim(),
      items: Array.isArray(t.items) ? t.items.map(sanitizeItem).filter(Boolean) : [],
    };
  }

  function loadTemplates() {
    const arr = parseJSON(storage().getItem(TPL_KEY), null);
    if (Array.isArray(arr)) return arr.map(sanitizeTemplate).filter(Boolean);
    // 初回: 診察ルーティーンのシートを用意(以後は利用者の編集内容を保持)
    const seeded = Items.defaultTemplates().map(sanitizeTemplate).filter(Boolean);
    storage().setItem(TPL_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function persistTemplates(list) {
    storage().setItem(TPL_KEY, JSON.stringify(list));
  }

  function saveTemplate(t) {
    const tpl = sanitizeTemplate(t);
    if (!tpl) return null;
    const list = loadTemplates();
    const i = list.findIndex((x) => x.id === tpl.id);
    if (i >= 0) list[i] = tpl; else list.push(tpl);
    persistTemplates(list);
    return tpl;
  }

  function deleteTemplate(id) {
    const list = loadTemplates().filter((t) => t.id !== id);
    persistTemplates(list);
  }

  function duplicateTemplate(id) {
    const src = loadTemplates().find((t) => t.id === id);
    if (!src) return null;
    const copy = {
      id: gid(),
      name: src.name + " のコピー",
      items: src.items.map((it) => Object.assign({}, it, { id: Items.gid() })),
    };
    return saveTemplate(copy);
  }

  // ---- 実施記録 ----

  function addSession(s) {
    if (!s || !Array.isArray(s.steps) || !Array.isArray(s.results)) return null;
    const rec = {
      id: gid(),
      ts: typeof s.ts === "string" ? s.ts : new Date().toISOString(),
      patient: String(s.patient || "").trim(),
      templateName: String(s.templateName || "").trim(),
      aborted: !!s.aborted,
      steps: s.steps.map((st) => ({
        label: st.label, name: st.name, side: st.side || "",
        type: st.type, unit: st.unit || "",
      })),
      // 記録タブ側から参照する集計用の簡易サマリ
      summary: s.steps.map((st, i) => {
        const r = s.results[i];
        return st.label + ": " + (!r ? "未実施" : (r.status === "skip" ? "スキップ" : String(r.value)));
      }).join(" / "),
      results: s.results.map((r) => r ? {
        status: r.status || "done",
        value: r.value === undefined ? "" : r.value,
        display: r.display || "",
        raw: r.raw || "",
      } : null),
    };
    const list = loadSessions();
    list.unshift(rec);
    storage().setItem(SES_KEY, JSON.stringify(list));
    return rec;
  }

  function loadSessions() {
    const arr = parseJSON(storage().getItem(SES_KEY), []);
    return Array.isArray(arr) ? arr : [];
  }

  function deleteSession(id) {
    const list = loadSessions().filter((s) => s.id !== id);
    storage().setItem(SES_KEY, JSON.stringify(list));
  }

  // ---- CSV ----

  function pad2(n) { return String(n).padStart(2, "0"); }
  function fmtDate(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  const CSV_HEADERS = ["日付", "時刻", "患者ID", "シート", "項目", "側", "結果", "認識テキスト"];

  function sessionRows(s) {
    const rows = [];
    for (let i = 0; i < s.steps.length; i++) {
      const st = s.steps[i];
      const r = s.results[i];
      const result = !r ? "未実施" : (r.status === "skip" ? "スキップ" : String(r.value));
      rows.push([fmtDate(s.ts), fmtTime(s.ts), s.patient, s.templateName, st.name, st.side, result, r && r.raw ? r.raw : ""]
        .map(csvEscape).join(","));
    }
    return rows;
  }

  function sessionToCSV(s) {
    return "﻿" + CSV_HEADERS.join(",") + "\r\n" + sessionRows(s).join("\r\n") + "\r\n";
  }

  function allSessionsCSV() {
    const rows = [];
    for (const s of loadSessions()) rows.push.apply(rows, sessionRows(s));
    return "﻿" + CSV_HEADERS.join(",") + "\r\n" + (rows.length ? rows.join("\r\n") + "\r\n" : "");
  }

  // ---- 設定 / バックアップ ----

  function loadSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, parseJSON(storage().getItem(SET_KEY), {}));
  }
  function saveSettings(patch) {
    const next = Object.assign({}, loadSettings(), patch);
    storage().setItem(SET_KEY, JSON.stringify(next));
    return next;
  }

  function exportJSON() {
    return JSON.stringify({
      app: "voice-exam", version: 1, exportedAt: new Date().toISOString(),
      templates: loadTemplates(), sessions: loadSessions(), settings: loadSettings(),
    }, null, 2);
  }

  function importJSON(text, mode) {
    const data = parseJSON(text, null);
    if (!data || data.app !== "voice-exam") {
      throw new Error("バックアップファイルの形式が正しくありません(voice-examのJSONではありません)");
    }
    if (Array.isArray(data.templates)) {
      const cur = mode === "replace" ? [] : loadTemplates();
      const known = new Set(cur.map((t) => t.id));
      for (const t of data.templates.map(sanitizeTemplate).filter(Boolean)) {
        if (!known.has(t.id)) cur.push(t);
      }
      persistTemplates(cur);
    }
    if (Array.isArray(data.sessions)) {
      const cur = mode === "replace" ? [] : loadSessions();
      const known = new Set(cur.map((s) => s.id));
      for (const s of data.sessions) if (s && s.id && !known.has(s.id)) cur.push(s);
      cur.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
      storage().setItem(SES_KEY, JSON.stringify(cur));
    }
    return { templates: loadTemplates().length, sessions: loadSessions().length };
  }

  const api = {
    DEFAULT_SETTINGS, CSV_HEADERS,
    loadTemplates, saveTemplate, deleteTemplate, duplicateTemplate, sanitizeTemplate,
    addSession, loadSessions, deleteSession,
    sessionToCSV, allSessionsCSV, fmtDate, fmtTime,
    loadSettings, saveSettings, exportJSON, importJSON,
    __setStorage(s) { storageImpl = s; },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.VexStore = api;
})(typeof window !== "undefined" ? window : globalThis);
