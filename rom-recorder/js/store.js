/*
 * ROMレコーダー store
 * 記録・設定の永続化(localStorage)と CSV/JSON 入出力。
 * データはすべてこの端末のブラウザ内にのみ保存される(外部送信なし)。
 */
(function (global) {
  "use strict";

  const REC_KEY = "romrec.records.v1";
  const MMT_KEY = "romrec.mmt.v1";
  const SET_KEY = "romrec.settings.v1";

  const DEFAULT_SETTINGS = {
    use3D: false,
    mirror: false, // 既定は背面カメラ想定。前面カメラ選択時はUI側で自動ON
    modelVariant: "lite",
    disclaimerAck: false,
    voiceEnabled: false, // 音声入力は明示的にオンにしたときだけ使う(外部送信の注意があるため)
    voiceAck: false,     // 音声入力の注意事項に同意済みか
    isncsciMode: false,  // ISNCSCI準拠(0〜5整数のみ、+/-を使わない)
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
    // Number(null)===0 のため、null/undefined/空文字は明示的に「角度なし」として扱う
    const angle = (r.angle === null || r.angle === undefined || r.angle === "") ? NaN : Number(r.angle);
    const valueText = String(r.valueText ?? "").trim();
    // 角度(数値)か、レベル等のテキスト値(例: 結帯動作の到達レベル Th7)のどちらかが必須
    if (!isFinite(angle) && !valueText) return null;
    return {
      id: typeof r.id === "string" && r.id ? r.id : genId(),
      ts: typeof r.ts === "string" && !isNaN(Date.parse(r.ts)) ? r.ts : new Date().toISOString(),
      patient: String(r.patient ?? "").trim(),
      joint: String(r.joint ?? "").trim(),
      motion: String(r.motion ?? "").trim(),
      side: String(r.side ?? "").trim(),
      angle: isFinite(angle) ? Math.round(angle * 10) / 10 : null,
      valueText,
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
    for (const r of loadMMT()) if (r.patient) set.add(r.patient);
    return Array.from(set).sort();
  }

  // ---- MMT(徒手筋力テスト)記録 ----
  // grade は 0〜5 の整数、modifier は "" / "+" / "-"。
  // 音声入力時は memo に認識テキストをそのまま残し、後から検証できるようにする。

  function sanitizeMMT(r) {
    if (!r || typeof r !== "object") return null;
    const grade = Number(r.grade);
    if (!Number.isInteger(grade) || grade < 0 || grade > 5) return null;
    const side = String(r.side ?? "").trim();
    if (side !== "右" && side !== "左") return null; // 側が確定しない記録は保存しない
    const mod = String(r.modifier ?? "").trim();
    return {
      id: typeof r.id === "string" && r.id ? r.id : genId(),
      ts: typeof r.ts === "string" && !isNaN(Date.parse(r.ts)) ? r.ts : new Date().toISOString(),
      patient: String(r.patient ?? "").trim(),
      level: String(r.level ?? "").trim(),
      muscle: String(r.muscle ?? "").trim(),
      side,
      grade,
      modifier: (mod === "+" || mod === "-") ? mod : "",
      method: String(r.method ?? "").trim(),
      memo: String(r.memo ?? "").trim(),
    };
  }

  function loadMMT() {
    const arr = parseJSON(storage().getItem(MMT_KEY), []);
    if (!Array.isArray(arr)) return [];
    return arr.map(sanitizeMMT).filter(Boolean);
  }

  function persistMMT(list) {
    storage().setItem(MMT_KEY, JSON.stringify(list));
  }

  function addMMT(partial) {
    const rec = sanitizeMMT(partial);
    if (!rec) return null;
    const list = loadMMT();
    list.unshift(rec);
    list.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
    persistMMT(list);
    return rec;
  }

  // 同一診察(同じ患者・髄節・側)の値を上書きするか新規追加するか:
  // 画面上のグリッド編集では sessionTs を渡して同一セッション内の重複を防ぐ
  function upsertMMT(partial, sessionTs) {
    if (!sessionTs) return addMMT(partial);
    const list = loadMMT();
    const i = list.findIndex((r) =>
      r.ts === sessionTs && r.patient === String(partial.patient ?? "").trim() &&
      r.level === String(partial.level ?? "").trim() && r.side === partial.side
    );
    const rec = sanitizeMMT(Object.assign({}, partial, { ts: sessionTs, id: i >= 0 ? list[i].id : undefined }));
    if (!rec) return null;
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    list.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
    persistMMT(list);
    return rec;
  }

  function updateMMT(id, patch) {
    const list = loadMMT();
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) return null;
    const merged = sanitizeMMT(Object.assign({}, list[i], patch, { id }));
    if (!merged) return null;
    list[i] = merged;
    persistMMT(list);
    return merged;
  }

  function deleteMMT(id) {
    const list = loadMMT();
    const next = list.filter((r) => r.id !== id);
    persistMMT(next);
    return list.length !== next.length;
  }

  function gradeText(r) {
    return String(r.grade) + (r.modifier || "");
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

  const CSV_HEADERS = ["日付", "時刻", "患者ID", "関節", "運動", "側", "角度(度)", "値(レベル等)", "方法", "メモ"];

  // Excelで文字化けしないよう BOM 付き UTF-8 / CRLF
  function recordsToCSV(records) {
    const rows = records.map((r) =>
      [fmtDate(r.ts), fmtTime(r.ts), r.patient, r.joint, r.motion, r.side,
        (r.angle === null || r.angle === undefined) ? "" : r.angle, r.valueText || "", r.method, r.memo]
        .map(csvEscape).join(",")
    );
    return "﻿" + CSV_HEADERS.join(",") + "\r\n" + (rows.length ? rows.join("\r\n") + "\r\n" : "");
  }

  // 動画解析の時系列 [{t: 秒, value: 度}] を CSV に
  function seriesToCSV(series) {
    const rows = series.map((p) => (Math.round(p.t * 1000) / 1000) + "," + (Math.round(p.value * 10) / 10));
    return "﻿時間(秒),角度(度)\r\n" + (rows.length ? rows.join("\r\n") + "\r\n" : "");
  }

  const MMT_HEADERS = ["日付", "時刻", "患者ID", "髄節", "筋", "側", "MMT", "方法", "メモ"];

  function mmtToCSV(list) {
    const rows = list.map((r) =>
      [fmtDate(r.ts), fmtTime(r.ts), r.patient, r.level, r.muscle, r.side, gradeText(r), r.method, r.memo]
        .map(csvEscape).join(",")
    );
    return "﻿" + MMT_HEADERS.join(",") + "\r\n" + (rows.length ? rows.join("\r\n") + "\r\n" : "");
  }

  function exportJSON() {
    return JSON.stringify({
      app: "rom-recorder",
      version: 2,
      exportedAt: new Date().toISOString(),
      records: loadRecords(),
      mmt: loadMMT(),
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

    // MMTは version 2 以降に含まれる(古いバックアップには存在しない)
    const incomingMMT = Array.isArray(data.mmt) ? data.mmt.map(sanitizeMMT).filter(Boolean) : [];
    let mmt;
    if (mode === "replace") {
      mmt = incomingMMT;
    } else {
      mmt = loadMMT();
      const knownM = new Set(mmt.map((r) => r.id));
      for (const r of incomingMMT) if (!knownM.has(r.id)) mmt.push(r);
    }
    mmt.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
    persistMMT(mmt);

    if (data.settings && typeof data.settings === "object") {
      const cur = loadSettings();
      saveSettings(Object.assign({}, data.settings, {
        disclaimerAck: cur.disclaimerAck,
        voiceAck: cur.voiceAck, // 同意状態は端末ごとの判断なので引き継がない
      }));
    }
    return { added: incoming.length, total: records.length, mmtAdded: incomingMMT.length, mmtTotal: mmt.length };
  }

  const api = {
    DEFAULT_SETTINGS, CSV_HEADERS, MMT_HEADERS,
    loadRecords, addRecord, updateRecord, deleteRecord, listPatients,
    loadMMT, addMMT, upsertMMT, updateMMT, deleteMMT, sanitizeMMT, gradeText, mmtToCSV,
    loadSettings, saveSettings,
    fmtDate, fmtTime, csvEscape, recordsToCSV, seriesToCSV,
    exportJSON, importJSON, sanitizeRecord,
    __setStorage(s) { storageImpl = s; },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Store = api;
})(typeof window !== "undefined" ? window : globalThis);
