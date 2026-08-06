/*
 * ROMレコーダー store
 * 記録・設定の永続化(localStorage)と CSV/JSON 入出力。
 * データはすべてこの端末のブラウザ内にのみ保存される(外部送信なし)。
 */
(function (global) {
  "use strict";

  const REC_KEY = "romrec.records.v1";
  const SET_KEY = "romrec.settings.v1";

  const DEFAULT_SETTINGS = {
    use3D: false,
    mirror: false, // 既定は背面カメラ想定。前面カメラ選択時はUI側で自動ON
    modelVariant: "lite",
    disclaimerAck: false,
    refValues: {}, // refKey -> 参考可動域(ユーザー編集可)
  };

  let storageImpl = null;
  function storage() {
    if (storageImpl) return storageImpl;
    return global.localStorage;
  }

  function parseJSON(text, fallback) {
    try {
      const v = JSON.parse(text);
      return v === null || v === undefined ? fallback : v;
    } catch (_e) {
      return fallback;
    }
  }

  function genId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function sanitizeRecord(r) {
    if (!r || typeof r !== "object") return null;
    const angle = Number(r.angle);
    if (!isFinite(angle)) return null;
    return {
      id: typeof r.id === "string" && r.id ? r.id : genId(),
      ts: typeof r.ts === "string" && !isNaN(Date.parse(r.ts)) ? r.ts : new Date().toISOString(),
      patient: String(r.patient ?? "").trim(),
      joint: String(r.joint ?? "").trim(),
      motion: String(r.motion ?? "").trim(),
      side: String(r.side ?? "").trim(),
      angle: Math.round(angle * 10) / 10,
      method: String(r.method ?? "").trim(),
      memo: String(r.memo ?? "").trim(),
    };
  }

  function loadRecords() {
    const arr = parseJSON(storage().getItem(REC_KEY), []);
    if (!Array.isArray(arr)) return [];
    return arr.map(sanitizeRecord).filter(Boolean);
  }

  function persistRecords(records) {
    storage().setItem(REC_KEY, JSON.stringify(records));
  }

  function addRecord(partial) {
    const rec = sanitizeRecord(partial);
    if (!rec) return null;
    const records = loadRecords();
    records.unshift(rec);
    records.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
    persistRecords(records);
    return rec;
  }

  function updateRecord(id, patch) {
    const records = loadRecords();
    const i = records.findIndex((r) => r.id === id);
    if (i < 0) return null;
    const merged = sanitizeRecord(Object.assign({}, records[i], patch, { id }));
    if (!merged) return null;
    records[i] = merged;
    records.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
    persistRecords(records);
    return merged;
  }

  function deleteRecord(id) {
    const records = loadRecords();
    const next = records.filter((r) => r.id !== id);
    persistRecords(next);
    return records.length !== next.length;
  }

  function listPatients() {
    const set = new Set();
    for (const r of loadRecords()) if (r.patient) set.add(r.patient);
    return Array.from(set).sort();
  }

  // ---- 設定 ----

  function loadSettings() {
    const s = parseJSON(storage().getItem(SET_KEY), {});
    return Object.assign({}, DEFAULT_SETTINGS, s, {
      refValues: Object.assign({}, DEFAULT_SETTINGS.refValues, (s && s.refValues) || {}),
    });
  }

  function saveSettings(patch) {
    const next = Object.assign({}, loadSettings(), patch);
    storage().setItem(SET_KEY, JSON.stringify(next));
    return next;
  }

  // ---- CSV / JSON ----

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

  const CSV_HEADERS = ["日付", "時刻", "患者ID", "関節", "運動", "側", "角度(度)", "方法", "メモ"];

  // Excelで文字化けしないよう BOM 付き UTF-8 / CRLF
  function recordsToCSV(records) {
    const rows = records.map((r) =>
      [fmtDate(r.ts), fmtTime(r.ts), r.patient, r.joint, r.motion, r.side, r.angle, r.method, r.memo]
        .map(csvEscape).join(",")
    );
    return "﻿" + CSV_HEADERS.join(",") + "\r\n" + (rows.length ? rows.join("\r\n") + "\r\n" : "");
  }

  // 動画解析の時系列 [{t: 秒, value: 度}] を CSV に
  function seriesToCSV(series) {
    const rows = series.map((p) => (Math.round(p.t * 1000) / 1000) + "," + (Math.round(p.value * 10) / 10));
    return "﻿時間(秒),角度(度)\r\n" + (rows.length ? rows.join("\r\n") + "\r\n" : "");
  }

  function exportJSON() {
    return JSON.stringify({
      app: "rom-recorder",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: loadRecords(),
      settings: loadSettings(),
    }, null, 2);
  }

  // mode: "merge"(同じidは既存優先で追加のみ) | "replace"(全置換)
  function importJSON(text, mode) {
    const data = parseJSON(text, null);
    if (!data || data.app !== "rom-recorder" || !Array.isArray(data.records)) {
      throw new Error("バックアップファイルの形式が正しくありません(rom-recorderのJSONではありません)");
    }
    const incoming = data.records.map(sanitizeRecord).filter(Boolean);
    let records;
    if (mode === "replace") {
      records = incoming;
    } else {
      records = loadRecords();
      const known = new Set(records.map((r) => r.id));
      for (const r of incoming) if (!known.has(r.id)) records.push(r);
    }
    records.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
    persistRecords(records);
    if (data.settings && typeof data.settings === "object") {
      saveSettings(Object.assign({}, data.settings, { disclaimerAck: loadSettings().disclaimerAck }));
    }
    return { added: incoming.length, total: records.length };
  }

  const api = {
    DEFAULT_SETTINGS, CSV_HEADERS,
    loadRecords, addRecord, updateRecord, deleteRecord, listPatients,
    loadSettings, saveSettings,
    fmtDate, fmtTime, csvEscape, recordsToCSV, seriesToCSV,
    exportJSON, importJSON, sanitizeRecord,
    __setStorage(s) { storageImpl = s; },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Store = api;
})(typeof window !== "undefined" ? window : globalThis);
