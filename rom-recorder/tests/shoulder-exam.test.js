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

console.log("createSession(通し):");

ok("下垂→両側前方挙上90°: flexのみ検出・他はnull", () => {
  const sess = SE.createSession();
  for (let i = 0; i < 20; i++) sess.add(makeWorld(), null, i * 0.1);
  const up = makeWorld({
    13: P(0.15, 0, -0.3), 15: P(0.15, 0, -0.6),   // 左: 前方挙上・肘伸展
    14: P(-0.15, 0, -0.3), 16: P(-0.15, 0, -0.6), // 右: 前方挙上・肘伸展
  });
  for (let i = 20; i < 40; i++) sess.add(up, null, i * 0.1);
  const res = sess.finalize();
  for (const side of ["left", "right"]) {
    near(res[side].flex.value, 90, 1, side + " flex");
    assert.strictEqual(res[side].abd, null, side + " abd");
    assert.strictEqual(res[side].ext, null, side + " ext");
    assert.strictEqual(res[side].er1, null, side + " er1");
    assert.strictEqual(res[side].er2, null, side + " er2");
  }
  assert.strictEqual(res.frames, 40);
});

ok("2nd肢位で前腕上げ: er2=90が検出され、時刻リンク用のtが付く", () => {
  const sess = SE.createSession();
  const pose = makeWorld({
    14: P(-0.45, 0, 0), 16: P(-0.45, -0.25, 0), // 右: 外転90・肘90・前腕上
  });
  for (let i = 0; i < 10; i++) sess.add(pose, null, i * 0.1);
  const res = sess.finalize();
  near(res.right.er2.value, 90, 1);
  assert.ok(typeof res.right.er2.t === "number");
  assert.strictEqual(res.left.er2, null, "左は下垂のまま(肘伸展)なので検出されない");
});

ok("1st外旋45°の検出(肘90°ゲート付き)", () => {
  const sess = SE.createSession();
  const k = 0.25 / Math.SQRT2;
  const pose = makeWorld({ 14: P(-0.18, 0.3, 0), 16: P(-0.18 - k, 0.3, -k) });
  for (let i = 0; i < 10; i++) sess.add(pose, null, i * 0.1);
  near(sess.finalize().right.er1.value, 45, 1);
});

ok("可視性が低いフレームは捨てる", () => {
  const sess = SE.createSession();
  const w = makeWorld({ 12: P(-0.15, 0, 0, 0.2) }); // 右肩の可視性低
  for (let i = 0; i < 10; i++) sess.add(w, w, i * 0.1);
  assert.strictEqual(sess.finalize().frames, 0);
});

console.log("\n" + passed + " tests passed");
