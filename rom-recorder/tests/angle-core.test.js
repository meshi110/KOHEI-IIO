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
  Store.saveSettings({ refValues: { knee_flexion: 130 } });
  assert.strictEqual(Store.loadSettings().refValues.knee_flexion, 130);
});

console.log("\n" + passed + " tests passed");
