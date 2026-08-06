/*
 * angle-core / store のユニットテスト (Node実行: node tests/angle-core.test.js)
 * すべて幾何学的に導出した期待値との突き合わせ(実測データは使用しない)。
 */
"use strict";
const assert = require("assert");
const AC = require("../js/angle-core.js");
const Store = require("../js/store.js");

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log("  ok - " + name);
}
function near(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol,
    (msg || "") + " expected " + expected + "±" + tol + ", got " + actual);
}

console.log("angle-core:");

ok("angleAt: 直角90°", () => {
  near(AC.angleAt({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 90, 1e-9);
});

ok("angleAt: 一直線180°", () => {
  near(AC.angleAt({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 180, 1e-9);
});

ok("angleAt: 3D 90°", () => {
  near(AC.angleAt({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), 90, 1e-9);
});

ok("angleBetween: 零ベクトルはNaN", () => {
  assert.ok(isNaN(AC.angleBetween({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })));
});

ok("acute: 120°→60°, 45°→45°", () => {
  near(AC.acute(120), 60, 1e-9);
  near(AC.acute(45), 45, 1e-9);
});

const elbow = AC.PRESETS.find((p) => p.id === "elbow_flex");
ok("肘プリセット: 完全伸展で0°", () => {
  // 肩(0,0) 肘(0,1) 手首(0,2) — 一直線
  const r = AC.computeAngle(elbow, [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]);
  near(r.value, 0, 1e-9);
});
ok("肘プリセット: 90°屈曲", () => {
  const r = AC.computeAngle(elbow, [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
  near(r.value, 90, 1e-9);
});
ok("肘プリセット: 同一点はnull", () => {
  assert.strictEqual(AC.computeAngle(elbow, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }]), null);
});

const ankle = AC.PRESETS.find((p) => p.id === "ankle");
ok("足プリセット: 中間位0°・背屈+・底屈−", () => {
  // points順: ankle, knee, heel, foot_index (画像座標系: y下向き+)
  const neutral = AC.computeAngle(ankle, [
    { x: 0, y: 1 }, { x: 0, y: 0 }, { x: -0.1, y: 1.15 }, { x: 0.45, y: 1.15 },
  ]);
  near(neutral.value, 0, 1e-6);
  const dorsi = AC.computeAngle(ankle, [
    { x: 0, y: 1 }, { x: 0, y: 0 }, { x: -0.1, y: 1.15 }, { x: 0.3, y: 1.0 },
  ]);
  assert.ok(dorsi.value > 5, "背屈で正: " + dorsi.value);
  const plantar = AC.computeAngle(ankle, [
    { x: 0, y: 1 }, { x: 0, y: 0 }, { x: -0.1, y: 1.15 }, { x: 0.3, y: 1.35 },
  ]);
  assert.ok(plantar.value < -5, "底屈で負: " + plantar.value);
});

const hipAbd = AC.PRESETS.find((p) => p.id === "hip_abd");
ok("股外転プリセット: 30°外転", () => {
  // mid_shoulder(0,0) mid_hip(0,1) hip(0.15,1) knee=hip+0.9*(sin30, cos30)
  const r = AC.computeAngle(hipAbd, [
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0.15, y: 1 },
    { x: 0.15 + 0.9 * 0.5, y: 1 + 0.9 * Math.sqrt(3) / 2 },
  ]);
  near(r.value, 30, 0.01);
});

const shoulderFlex = AC.PRESETS.find((p) => p.id === "shoulder_flex");
ok("肩挙上プリセット: 下垂0°・水平90°", () => {
  // hip(0,1) shoulder(0,0) elbow: 下垂(0,0.35) → 0° / 前方水平(0.35,0) → 90°
  const down = AC.computeAngle(shoulderFlex, [{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0.35 }]);
  near(down.value, 0, 1e-9);
  const horiz = AC.computeAngle(shoulderFlex, [{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0.35, y: 0 }]);
  near(horiz.value, 90, 1e-9);
});

ok("roleSpecs: 左肘 → LM 11,13,15", () => {
  const specs = AC.roleSpecs(elbow, "left");
  assert.deepStrictEqual(specs.map((s) => s.idx), [11, 13, 15]);
});

ok("describeValue: 足関節の符号表示", () => {
  assert.strictEqual(AC.describeValue(ankle, -20).display, "底屈 20°");
  assert.strictEqual(AC.describeValue(ankle, 15).display, "背屈 15°");
  assert.strictEqual(AC.describeValue(elbow, 90.04).display, "90°");
});

console.log("store:");

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
Store.__setStorage(memStorage());

ok("addRecord → loadRecords 往復", () => {
  const rec = Store.addRecord({ patient: "A-01", joint: "膝", motion: "屈曲", side: "右", angle: 123.44, method: "テスト", memo: "" });
  assert.ok(rec.id);
  const list = Store.loadRecords();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].angle, 123.4);
});

ok("不正な角度は保存されない", () => {
  assert.strictEqual(Store.addRecord({ patient: "A-01", angle: "abc" }), null);
  assert.strictEqual(Store.loadRecords().length, 1);
});

ok("updateRecord / deleteRecord", () => {
  const rec = Store.loadRecords()[0];
  const upd = Store.updateRecord(rec.id, { memo: "更新" });
  assert.strictEqual(upd.memo, "更新");
  assert.strictEqual(Store.deleteRecord(rec.id), true);
  assert.strictEqual(Store.loadRecords().length, 0);
});

ok("CSV: BOM・ヘッダ・エスケープ", () => {
  Store.addRecord({ patient: 'P"1', joint: "膝", motion: "屈曲", side: "右", angle: 90, method: "手入力", memo: "カンマ,改行\nあり" });
  const csv = Store.recordsToCSV(Store.loadRecords());
  assert.strictEqual(csv.charCodeAt(0), 0xfeff, "BOM");
  assert.ok(csv.includes("日付,時刻,患者ID"), "ヘッダ");
  assert.ok(csv.includes('"P""1"'), "引用符エスケープ");
  assert.ok(csv.includes('"カンマ,改行\nあり"'), "カンマ・改行の引用");
});

ok("seriesToCSV", () => {
  const csv = Store.seriesToCSV([{ t: 0.5, value: 12.34 }, { t: 1, value: -3 }]);
  assert.ok(csv.includes("時間(秒),角度(度)"));
  assert.ok(csv.includes("0.5,12.3"));
  assert.ok(csv.includes("1,-3"));
});

ok("importJSON: merge重複除外 / replace / 形式検証", () => {
  const before = Store.loadRecords().length;
  const dump = Store.exportJSON();
  let r = Store.importJSON(dump, "merge");
  assert.strictEqual(r.total, before, "同一idはmergeで増えない");
  r = Store.importJSON(dump, "replace");
  assert.strictEqual(r.total, before);
  assert.throws(() => Store.importJSON('{"foo":1}', "merge"), /形式/);
});

ok("settings: 既定値・保存・refValues", () => {
  const s = Store.loadSettings();
  assert.strictEqual(s.modelVariant, "lite");
  assert.strictEqual(s.voiceEnabled, false, "音声入力は既定オフ");
  assert.strictEqual(s.voiceAck, false);
  Store.saveSettings({ refValues: { knee_flexion: 130 } });
  assert.strictEqual(Store.loadSettings().refValues.knee_flexion, 130);
});

console.log("store(MMT):");

ok("addMMT → loadMMT 往復", () => {
  const rec = Store.addMMT({ patient: "A-01", level: "L4", muscle: "前脛骨筋", side: "右", grade: 4, modifier: "+", method: "音声", memo: "音声認識: 右 L4 4プラス" });
  assert.ok(rec && rec.id);
  const list = Store.loadMMT();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].grade, 4);
  assert.strictEqual(list[0].modifier, "+");
  assert.strictEqual(Store.gradeText(list[0]), "4+");
});

ok("MMT: 側が右/左でない記録は保存しない", () => {
  const before = Store.loadMMT().length;
  assert.strictEqual(Store.addMMT({ patient: "A-01", level: "L4", side: "", grade: 4 }), null);
  assert.strictEqual(Store.addMMT({ patient: "A-01", level: "L4", side: "両側", grade: 4 }), null);
  assert.strictEqual(Store.loadMMT().length, before);
});

ok("MMT: グレードは0〜5の整数のみ", () => {
  const before = Store.loadMMT().length;
  assert.strictEqual(Store.addMMT({ level: "L4", side: "右", grade: 6 }), null);
  assert.strictEqual(Store.addMMT({ level: "L4", side: "右", grade: -1 }), null);
  assert.strictEqual(Store.addMMT({ level: "L4", side: "右", grade: 3.5 }), null);
  assert.strictEqual(Store.addMMT({ level: "L4", side: "右", grade: "abc" }), null);
  assert.strictEqual(Store.loadMMT().length, before);
  const okRec = Store.addMMT({ level: "L4", side: "右", grade: 0 });
  assert.ok(okRec, "0は有効なグレード");
  Store.deleteMMT(okRec.id);
});

ok("MMT: 不正なmodifierは空に正規化", () => {
  const r = Store.addMMT({ level: "C5", side: "左", grade: 3, modifier: "*" });
  assert.strictEqual(r.modifier, "");
  Store.deleteMMT(r.id);
});

ok("upsertMMT: 同一診察・同一髄節・同一側は上書き(言い直し対応)", () => {
  const ts = new Date("2026-08-06T10:00:00Z").toISOString();
  const a = Store.upsertMMT({ patient: "B-01", level: "L5", muscle: "長母趾伸筋", side: "左", grade: 3 }, ts);
  const b = Store.upsertMMT({ patient: "B-01", level: "L5", muscle: "長母趾伸筋", side: "左", grade: 4 }, ts);
  assert.strictEqual(a.id, b.id, "同じ記録が更新される");
  const list = Store.loadMMT().filter((r) => r.patient === "B-01");
  assert.strictEqual(list.length, 1, "重複して増えない");
  assert.strictEqual(list[0].grade, 4);
});

ok("upsertMMT: 側が違えば別記録", () => {
  const ts = new Date("2026-08-06T10:00:00Z").toISOString();
  Store.upsertMMT({ patient: "B-01", level: "L5", side: "右", grade: 5 }, ts);
  const list = Store.loadMMT().filter((r) => r.patient === "B-01");
  assert.strictEqual(list.length, 2);
});

ok("listPatients: 角度記録とMMT記録の両方から集約", () => {
  const ps = Store.listPatients();
  assert.ok(ps.includes("A-01"), "角度記録の患者");
  assert.ok(ps.includes("B-01"), "MMT記録のみの患者");
});

ok("mmtToCSV: BOM・ヘッダ・グレード表記", () => {
  const csv = Store.mmtToCSV(Store.loadMMT());
  assert.strictEqual(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes("日付,時刻,患者ID,髄節,筋,側,MMT,方法,メモ"));
  assert.ok(csv.includes("4+"), "modifier付きグレードが出力される");
});

ok("JSON: MMTを含めて往復し、重複追加しない", () => {
  const beforeMMT = Store.loadMMT().length;
  const dump = Store.exportJSON();
  assert.ok(JSON.parse(dump).mmt.length === beforeMMT);
  const r = Store.importJSON(dump, "merge");
  assert.strictEqual(r.mmtTotal, beforeMMT, "同一idはmergeで増えない");
  const r2 = Store.importJSON(dump, "replace");
  assert.strictEqual(r2.mmtTotal, beforeMMT);
});

ok("JSON: MMTを含まない旧バックアップも読める", () => {
  const old = JSON.stringify({ app: "rom-recorder", version: 1, records: [], settings: {} });
  const r = Store.importJSON(old, "merge");
  assert.strictEqual(r.mmtAdded, 0);
});

ok("deleteMMT", () => {
  const list = Store.loadMMT();
  const n = list.length;
  assert.strictEqual(Store.deleteMMT(list[0].id), true);
  assert.strictEqual(Store.loadMMT().length, n - 1);
  assert.strictEqual(Store.deleteMMT("no-such-id"), false);
});

console.log("\n" + passed + " tests passed");
