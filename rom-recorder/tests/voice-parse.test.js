/*
 * voice-parse のユニットテスト (node tests/voice-parse.test.js)
 * 音声認識テキストの解釈が、誤った記録を生まないことを確認する。
 */
"use strict";
const assert = require("assert");
const VP = require("../js/voice-parse.js");

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("  ok - " + name); }

// テスト用のMMT定義(実際の臨床定義は js/mmt-defs.js が持つ)
const DEFS = [
  { level: "C5", muscleJa: "上腕二頭筋", words: ["上腕二頭筋", "肘屈曲"] },
  { level: "C7", muscleJa: "上腕三頭筋", words: ["上腕三頭筋", "肘伸展"] },
  { level: "L3", muscleJa: "大腿四頭筋", words: ["大腿四頭筋", "膝伸展"] },
  { level: "L4", muscleJa: "前脛骨筋", words: ["前脛骨筋", "足背屈"] },
  { level: "S1", muscleJa: "腓腹筋", words: ["腓腹筋", "足底屈"] },
];

console.log("数値の正規化:");

ok("全角数字→半角", () => {
  assert.strictEqual(VP.toHalfWidth("１２０"), "120");
});

ok("漢数字: 百二十/九十/五", () => {
  assert.strictEqual(VP.kanjiToNumber("百二十"), 120);
  assert.strictEqual(VP.kanjiToNumber("九十"), 90);
  assert.strictEqual(VP.kanjiToNumber("五"), 5);
  assert.strictEqual(VP.kanjiToNumber("十"), 10);
});

ok("findNumber: 半角/全角/漢数字", () => {
  assert.strictEqual(VP.findNumber("膝屈曲120度").value, 120);
  assert.strictEqual(VP.findNumber("膝屈曲１２０度").value, 120);
  assert.strictEqual(VP.findNumber("膝屈曲百二十度").value, 120);
});

console.log("左右の判定:");

ok("右/左/両側", () => {
  assert.strictEqual(VP.detectSide("右膝").side, "右");
  assert.strictEqual(VP.detectSide("ひだり肩").side, "左");
  assert.strictEqual(VP.detectSide("両側").side, "両側");
});

ok("L4のLを左と誤認しない", () => {
  const s = VP.detectSide("L4 4");
  assert.strictEqual(s, null, "L4のLは側として解釈してはならない");
});

ok("単独のR/Lは側として解釈", () => {
  assert.strictEqual(VP.detectSide("R 膝 屈曲 120").side, "右");
});

console.log("角度記録(parseROM):");

ok("標準形: 膝 屈曲 右 120", () => {
  const r = VP.parseROM("膝 屈曲 右 120");
  assert.strictEqual(r.joint, "膝");
  assert.strictEqual(r.motion, "屈曲");
  assert.strictEqual(r.side, "右");
  assert.strictEqual(r.angle, 120);
});

ok("語順が違っても解釈: 右膝屈曲120度", () => {
  const r = VP.parseROM("右膝屈曲120度");
  assert.strictEqual(r.joint, "膝");
  assert.strictEqual(r.motion, "屈曲");
  assert.strictEqual(r.side, "右");
  assert.strictEqual(r.angle, 120);
});

ok("かな読み: ひざ くっきょく みぎ 120", () => {
  const r = VP.parseROM("ひざ くっきょく みぎ 120");
  assert.strictEqual(r.joint, "膝");
  assert.strictEqual(r.motion, "屈曲");
  assert.strictEqual(r.side, "右");
});

ok("肩外転 左 九十", () => {
  const r = VP.parseROM("肩外転 左 九十");
  assert.strictEqual(r.joint, "肩");
  assert.strictEqual(r.motion, "外転");
  assert.strictEqual(r.side, "左");
  assert.strictEqual(r.angle, 90);
});

ok("側の指定がなくても角度は取れる(側は空)", () => {
  const r = VP.parseROM("肘屈曲 145");
  assert.strictEqual(r.side, "");
  assert.strictEqual(r.angle, 145);
});

ok("「足関節」は「足」に、「手関節」は「手」に解決(長い語優先)", () => {
  assert.strictEqual(VP.parseROM("足関節 背屈 右 20").joint, "足");
  assert.strictEqual(VP.parseROM("手関節 掌屈 左 80").joint, "手");
});

ok("解釈不能な入力は null", () => {
  assert.strictEqual(VP.parseROM(""), null);
  assert.strictEqual(VP.parseROM("こんにちは"), null);
  assert.strictEqual(VP.parseROM("120"), null, "部位が無ければ採用しない");
  assert.strictEqual(VP.parseROM("膝屈曲"), null, "数値が無ければ採用しない");
});

ok("ありえない角度は棄却(誤認識対策)", () => {
  assert.strictEqual(VP.parseROM("膝屈曲 999"), null);
  assert.strictEqual(VP.parseROM("膝屈曲 -200"), null);
});

console.log("MMT(parseMMT):");

ok("標準形: 右 L4 4", () => {
  const r = VP.parseMMT("右 L4 4", DEFS);
  assert.strictEqual(r.level, "L4");
  assert.strictEqual(r.side, "右");
  assert.strictEqual(r.grade, 4);
  assert.strictEqual(r.modifier, "");
});

ok("髄節の数字をグレードと取り違えない", () => {
  const r = VP.parseMMT("左 L5 3", DEFS.concat([{ level: "L5", muscleJa: "長母趾伸筋", words: ["長母趾伸筋"] }]));
  assert.strictEqual(r.level, "L5");
  assert.strictEqual(r.grade, 3, "L5の5をグレードにしてはならない");
});

ok("プラス/マイナス修飾: 右 L4 4プラス", () => {
  const r = VP.parseMMT("右 L4 4プラス", DEFS);
  assert.strictEqual(r.grade, 4);
  assert.strictEqual(r.modifier, "+");
  const r2 = VP.parseMMT("左 C5 3マイナス", DEFS);
  assert.strictEqual(r2.grade, 3);
  assert.strictEqual(r2.modifier, "-");
});

ok("記号表記: 右 L4 4+", () => {
  const r = VP.parseMMT("右 L4 4+", DEFS);
  assert.strictEqual(r.modifier, "+");
});

ok("筋名で髄節を解決: 左 前脛骨筋 3", () => {
  const r = VP.parseMMT("左 前脛骨筋 3", DEFS);
  assert.strictEqual(r.level, "L4");
  assert.strictEqual(r.side, "左");
  assert.strictEqual(r.grade, 3);
});

ok("カタカナ読みの髄節: みぎ エル4 5", () => {
  const r = VP.parseMMT("みぎ エル4 5", DEFS);
  assert.strictEqual(r.level, "L4");
  assert.strictEqual(r.grade, 5);
});

ok("側が無ければ採用しない(左右取り違えの防止)", () => {
  assert.strictEqual(VP.parseMMT("L4 4", DEFS), null);
});

ok("定義にない髄節は採用しない", () => {
  assert.strictEqual(VP.parseMMT("右 L1 4", DEFS), null);
});

ok("グレード範囲外・解釈不能はnull", () => {
  assert.strictEqual(VP.parseMMT("右 L4 9", DEFS), null);
  assert.strictEqual(VP.parseMMT("", DEFS), null);
  assert.strictEqual(VP.parseMMT("おはようございます", DEFS), null);
});

ok("全角入力にも対応: 右 Ｌ４ ４", () => {
  const r = VP.parseMMT("右 Ｌ４ ４", DEFS);
  assert.strictEqual(r.level, "L4");
  assert.strictEqual(r.grade, 4);
});

console.log("患者ID(parsePatient):");

const KNOWN = ["A-012", "B-3", "0034"];

ok("合図語＋ID形式: 患者 A12", () => {
  const r = VP.parsePatient("患者 A12", []);
  assert.strictEqual(r.patient, "A12");
  assert.strictEqual(r.matched, "pattern");
});

ok("既存IDの表記に解決する(A12 → A-012 ではなく完全一致のみ)", () => {
  const r = VP.parsePatient("患者 A012", KNOWN);
  assert.strictEqual(r.patient, "A-012", "ハイフン等を無視して既存IDに一致させる");
  assert.strictEqual(r.matched, "known");
});

ok("カタカナ読みの英字: かんじゃ エー012", () => {
  const r = VP.parsePatient("かんじゃ エー012", KNOWN);
  assert.strictEqual(r.patient, "A-012");
});

ok("数字のみのID: 患者ID 0034", () => {
  const r = VP.parsePatient("患者ID 0034", KNOWN);
  assert.strictEqual(r.patient, "0034");
});

ok("合図語がなければ患者切替にしない", () => {
  assert.strictEqual(VP.parsePatient("A12", KNOWN), null);
  assert.strictEqual(VP.parsePatient("右 L4 4", KNOWN), null);
});

ok("氏名は採用しない(ID形式でないため弾かれる)", () => {
  assert.strictEqual(VP.parsePatient("患者 山田太郎", KNOWN), null);
  assert.strictEqual(VP.parsePatient("患者 やまだたろう", KNOWN), null);
  assert.strictEqual(VP.parsePatient("患者 田中さん", KNOWN), null);
  assert.strictEqual(VP.parsePatient("患者 スミス", KNOWN), null);
});

ok("英字だけ・記号だけも採用しない", () => {
  assert.strictEqual(VP.parsePatient("患者 ABC", KNOWN), null, "数字が無いIDは受け付けない");
  assert.strictEqual(VP.parsePatient("患者 ", KNOWN), null);
});

ok("長すぎる数字列は採用しない(誤認識対策)", () => {
  assert.strictEqual(VP.parsePatient("患者 12345678", KNOWN), null);
});

ok("MMT発話を患者切替と誤認しない / 患者発話をMMTと誤認しない", () => {
  assert.strictEqual(VP.parsePatient("右 L4 4", KNOWN), null);
  assert.strictEqual(VP.parseMMT("患者 A12", DEFS), null, "患者発話はMMTとして解釈されない");
});

ok("transcriptに元の認識テキストを保持(監査用)", () => {
  const r = VP.parseMMT("右 L4 4", DEFS);
  assert.strictEqual(r.transcript, "右 L4 4");
  const r2 = VP.parseROM("膝 屈曲 右 120");
  assert.strictEqual(r2.transcript, "膝 屈曲 右 120");
});

console.log("\n" + passed + " tests passed");
