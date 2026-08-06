/*
 * shoulder-exam のユニットテスト (Node実行: node tests/shoulder-exam.test.js)
 * すべて幾何学的に構成した合成3D姿勢(実測データではない)との突き合わせ。
 * 座標系: y下向き・患者左=+x・前方=-z を仮定してフィクスチャを作るが、
 * 解析側は鼻の位置から前方を自己決定するため軸規約に依存しない。
 */
"use strict";
const assert = require("assert");
const SE = require("../js/shoulder-exam.js");

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log("  ok - " + name);
}
function near(actual, expected, tol, msg) {
  assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) <= tol,
    (msg || "") + " expected " + expected + "±" + tol + ", got " + actual);
}

const P = (x, y, z, v) => ({ x, y, z, visibility: v === undefined ? 1 : v });

// 直立・正面向きの基本骨格(両腕下垂・肘伸展)
function makeWorld(over) {
  const w = [];
  for (let i = 0; i < 33; i++) w[i] = P(0, -0.4, 0);
  w[0] = P(0, -0.25, -0.12);   // nose
  w[11] = P(0.15, 0, 0);       // left_shoulder
  w[12] = P(-0.15, 0, 0);      // right_shoulder
  w[23] = P(0.1, 0.5, 0);      // left_hip
  w[24] = P(-0.1, 0.5, 0);     // right_hip
  w[13] = P(0.18, 0.3, 0);     // left_elbow (下垂)
  w[14] = P(-0.18, 0.3, 0);    // right_elbow (下垂)
  w[15] = P(0.18, 0.55, 0);    // left_wrist (肘伸展)
  w[16] = P(-0.18, 0.55, 0);   // right_wrist
  if (over) for (const [i, p] of Object.entries(over)) w[Number(i)] = p;
  return w;
}

console.log("trunkFrame:");

ok("体幹座標系: 直交・前方は鼻側(-z)", () => {
  const f = SE.trunkFrame(makeWorld());
  near(f.u.x * f.r.x + f.u.y * f.r.y + f.u.z * f.r.z, 0, 1e-9, "u⊥r");
  near(f.u.y, -1, 1e-9, "上=-y");
  near(f.f.z, -1, 1e-9, "前方=-z");
});

console.log("frameMetrics(右):");

function rm(over) {
  const w = makeWorld(over);
  return SE.frameMetrics(w, "right", SE.trunkFrame(w));
}

ok("下垂で挙上0°", () => {
  const m = rm({ 14: P(-0.15, 0.3, 0) });
  near(m.elev, 0, 0.5);
});

ok("外転90°: 挙上90・方位0(側方)", () => {
  const m = rm({ 14: P(-0.45, 0, 0) });
  near(m.elev, 90, 0.5);
  near(m.azim, 0, 0.5);
});

ok("前方挙上90°: 方位+90(屈曲面)", () => {
  const m = rm({ 14: P(-0.15, 0, -0.3) });
  near(m.elev, 90, 0.5);
  near(m.azim, 90, 0.5);
});

ok("後方挙上(伸展)40°: 方位-90", () => {
  const c = Math.cos(40 / 180 * Math.PI), s = Math.sin(40 / 180 * Math.PI);
  const m = rm({ 14: P(-0.15, 0.3 * c, 0.3 * s) });
  near(m.elev, 40, 0.5);
  near(m.azim, -90, 0.5);
});

ok("肘90°屈曲の検出", () => {
  const m = rm({ 14: P(-0.18, 0.3, 0), 16: P(-0.18, 0.3, -0.25) });
  near(m.elbowFlex, 90, 1);
});

ok("1st外旋: 前腕前方=0°, 外側45°=+45", () => {
  const m0 = rm({ 14: P(-0.18, 0.3, 0), 16: P(-0.18, 0.3, -0.25) });
  near(m0.rot1, 0, 0.5);
  const k = 0.25 / Math.SQRT2;
  const m45 = rm({ 14: P(-0.18, 0.3, 0), 16: P(-0.18 - k, 0.3, -k) });
  near(m45.rot1, 45, 0.5);
});

ok("2nd回旋: 前方水平=0, 真上=+90(外旋), 真下=-90(内旋)", () => {
  const elbow = P(-0.45, 0, 0); // 外転90
  near(rm({ 14: elbow, 16: P(-0.45, 0, -0.25) }).rot2, 0, 0.5);
  near(rm({ 14: elbow, 16: P(-0.45, -0.25, 0) }).rot2, 90, 0.5);
  near(rm({ 14: elbow, 16: P(-0.45, 0.25, 0) }).rot2, -90, 0.5);
});

ok("3rd回旋: 前腕垂直下=0, 外側=+90, 内側=-90", () => {
  const elbow = P(-0.15, 0, -0.3); // 屈曲90
  near(rm({ 14: elbow, 16: P(-0.15, 0.25, -0.3) }).rot3, 0, 0.5);
  near(rm({ 14: elbow, 16: P(-0.4, 0, -0.3) }).rot3, 90, 0.5);
  near(rm({ 14: elbow, 16: P(0.1, 0, -0.3) }).rot3, -90, 0.5);
});

ok("左側の対称性: 左外転90 → 方位0", () => {
  const w = makeWorld({ 13: P(0.45, 0, 0) });
  const m = SE.frameMetrics(w, "left", SE.trunkFrame(w));
  near(m.elev, 90, 0.5);
  near(m.azim, 0, 0.5);
});

console.log("seriesMax:");

ok("5フレーム未満はnull", () => {
  assert.strictEqual(SE.seriesMax([{ t: 0, v: 90 }, { t: 1, v: 90 }]), null);
});

ok("単発スパイクは中央値平滑化で無視", () => {
  const s = [10, 10, 10, 90, 10, 10, 10].map((v, i) => ({ t: i, v }));
  const r = SE.seriesMax(s);
  assert.ok(r.value < 20, "spike suppressed: " + r.value);
});

ok("最大値と発生時刻", () => {
  const s = [10, 20, 80, 82, 84, 82, 20, 10].map((v, i) => ({ t: i * 0.1, v }));
  const r = SE.seriesMax(s);
  near(r.value, 82, 3);
  assert.ok(r.t >= 0.2 && r.t <= 0.6, "t=" + r.t);
});

console.log("撮影方向の判定:");

ok("正面: 両肩が画像内で横に並ぶ", () => {
  assert.strictEqual(SE.detectView(makeWorld()), "front");
});

ok("側面: 両肩が奥行き方向に並ぶ", () => {
  // 患者が90°回転した状態(肩が z 方向に並ぶ)
  const w = makeWorld({ 11: P(0, 0, 0.15), 12: P(0, 0, -0.15) });
  assert.strictEqual(SE.detectView(w), "side");
});

ok("側面: 可視性の高い側をカメラに近い側と判定", () => {
  const w = makeWorld({
    12: P(0, 0, -0.15, 0.95), 14: P(-0.18, 0.3, 0, 0.95), 16: P(-0.18, 0.55, 0, 0.95),
    11: P(0, 0, 0.15, 0.4), 13: P(0.18, 0.3, 0, 0.4), 15: P(0.18, 0.55, 0, 0.4),
  });
  assert.strictEqual(SE.nearSide(w), "right");
  assert.strictEqual(SE.nearSide(makeWorld()), null, "差が小さければ判定しない");
});

console.log("体幹傾斜(代償の指標):");

ok("直立で0°、側方に傾けると角度が出る", () => {
  near(SE.trunkLean(SE.trunkFrame(makeWorld())).lateral, 0, 0.5);
  // 肩を右にずらして体幹を側屈させる
  const lean = makeWorld({ 11: P(0.15 - 0.2, 0, 0), 12: P(-0.15 - 0.2, 0, 0) });
  assert.ok(SE.trunkLean(SE.trunkFrame(lean)).lateral > 15, "側屈が検出される");
});

console.log("createSession(通し):");

// 前方挙上90°(肘伸展)の姿勢を作る
function flexPose(sides) {
  const o = {};
  if (sides.indexOf("left") >= 0) { o[13] = P(0.15, 0, -0.3); o[15] = P(0.15, 0, -0.6); }
  if (sides.indexOf("right") >= 0) { o[14] = P(-0.15, 0, -0.3); o[16] = P(-0.15, 0, -0.6); }
  return makeWorld(o);
}

ok("正面撮影では挙上(屈曲)・伸展を採用しない(奥行き方向のため)", () => {
  const sess = SE.createSession({ view: "front" });
  for (let i = 0; i < 10; i++) sess.add(makeWorld(), null, i * 0.1);
  for (let i = 10; i < 30; i++) sess.add(flexPose(["left", "right"]), null, i * 0.1);
  const res = sess.finalize();
  assert.strictEqual(res.view, "front");
  assert.strictEqual(res.right.flex, null, "正面ではflexを出さない");
  assert.strictEqual(res.right.ext, null, "正面ではextを出さない");
});

ok("側面撮影では挙上を採用し、外転は採用しない", () => {
  const sess = SE.createSession({ view: "side" });
  for (let i = 0; i < 10; i++) sess.add(makeWorld(), null, i * 0.1);
  for (let i = 10; i < 30; i++) sess.add(flexPose(["left", "right"]), null, i * 0.1);
  const res = sess.finalize();
  near(res.right.flex.uni ? res.right.flex.uni.value : res.right.flex.bi.value, 90, 1);
  assert.strictEqual(res.right.abd, null, "側面ではabdを出さない");
});

ok("側面では遠い側(可視性が低い側)を採用しない", () => {
  const sess = SE.createSession({ view: "side" });
  const mk = (over) => {
    const w = makeWorld(over);
    // 左を遠い側に(体幹判定は通る値を保ちつつ、腕の可視性だけ落とす)
    w[11].visibility = 0.6; w[13].visibility = 0.3; w[15].visibility = 0.3;
    return w;
  };
  for (let i = 0; i < 10; i++) sess.add(mk(), null, i * 0.1);
  for (let i = 10; i < 30; i++) {
    sess.add(mk({ 14: P(-0.15, 0, -0.3), 16: P(-0.15, 0, -0.6) }), null, i * 0.1);
  }
  const res = sess.finalize();
  assert.strictEqual(res.nearSide, "right");
  assert.deepStrictEqual(res.sides, ["right"]);
  assert.ok(res.right.flex, "近い側(右)は採用");
  assert.strictEqual(res.left.flex, null, "遠い側(左)は採用しない");
});

ok("両手同時と片手を別々に集計する", () => {
  const sess = SE.createSession({ view: "side" });
  for (let i = 0; i < 10; i++) sess.add(makeWorld(), null, i * 0.1);
  // 両手同時: 右は90°まで挙がる
  for (let i = 10; i < 25; i++) sess.add(flexPose(["left", "right"]), null, i * 0.1);
  for (let i = 25; i < 30; i++) sess.add(makeWorld(), null, i * 0.1);
  // 右だけ: 前方45°までしか挙がらない姿勢(肩から45°方向へ伸ばす)
  const c = Math.SQRT1_2;
  const rightOnly = makeWorld({
    14: P(-0.15, 0.3 * c, -0.3 * c),
    16: P(-0.15, 0.55 * c, -0.55 * c),
  });
  for (let i = 30; i < 50; i++) sess.add(rightOnly, null, i * 0.1);
  const res = sess.finalize();
  assert.ok(res.right.flex.bi, "両手の値がある");
  assert.ok(res.right.flex.uni, "片手の値がある");
  near(res.right.flex.bi.value, 90, 2);
  near(res.right.flex.uni.value, 45, 3);
  assert.ok(res.right.flex.bi.value > res.right.flex.uni.value,
    "両手のほうが大きい(引っ張られ/代償の検出)");
});

ok("体幹が傾いた計測には代償フラグが付く", () => {
  const sess = SE.createSession({ view: "side" });
  const tilt = { 11: P(0.15 - 0.25, 0, 0), 12: P(-0.15 - 0.25, 0, 0) };
  for (let i = 0; i < 10; i++) sess.add(makeWorld(tilt), null, i * 0.1);
  for (let i = 10; i < 30; i++) {
    sess.add(makeWorld(Object.assign({}, tilt, { 14: P(-0.15, 0, -0.3), 16: P(-0.15, 0, -0.6) })), null, i * 0.1);
  }
  const r = sess.finalize().right.flex;
  const v = r.uni || r.bi;
  assert.ok(v.lean > 10, "体幹傾斜が記録される: " + v.lean);
  assert.strictEqual(v.compensated, true);
});

ok("2nd肢位で前腕上げ: er2=90が検出され、時刻リンク用のtが付く", () => {
  const sess = SE.createSession({ view: "front" });
  const pose = makeWorld({
    14: P(-0.45, 0, 0), 16: P(-0.45, -0.25, 0), // 右: 外転90・肘90・前腕上
  });
  for (let i = 0; i < 10; i++) sess.add(pose, null, i * 0.1);
  const res = sess.finalize();
  const v = res.right.er2.uni || res.right.er2.bi;
  near(v.value, 90, 1);
  assert.ok(typeof v.t === "number");
  assert.strictEqual(res.left.er2, null, "左は下垂のまま(肘伸展)なので検出されない");
});

ok("1st外旋45°の検出(肘90°ゲート付き)", () => {
  const sess = SE.createSession({ view: "front" });
  const k = 0.25 / Math.SQRT2;
  const pose = makeWorld({ 14: P(-0.18, 0.3, 0), 16: P(-0.18 - k, 0.3, -k) });
  for (let i = 0; i < 10; i++) sess.add(pose, null, i * 0.1);
  const r = sess.finalize().right.er1;
  near((r.uni || r.bi).value, 45, 1);
});

ok("可視性が低いフレームは捨てる", () => {
  const sess = SE.createSession();
  const w = makeWorld({ 12: P(-0.15, 0, 0, 0.2) }); // 右肩の可視性低
  for (let i = 0; i < 10; i++) sess.add(w, w, i * 0.1);
  assert.strictEqual(sess.finalize().frames, 0);
});

ok("撮影方向は自動判定される(明示指定なし)", () => {
  const sess = SE.createSession();
  for (let i = 0; i < 10; i++) sess.add(makeWorld(), null, i * 0.1);
  assert.strictEqual(sess.finalize().view, "front");
});

console.log("\n" + passed + " tests passed");
