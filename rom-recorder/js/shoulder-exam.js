/*
 * ROMレコーダー shoulder-exam
 * 肩の一連動作動画から、両側の可動域指標を自動抽出する計算コア。
 *
 * 方法: MediaPipeのworldLandmarks(単眼3D推定)を体幹基準の座標系
 *   u=上(骨盤中点→肩中点) / r=左肩→右肩 / f=前方(鼻の位置で向きを自己決定)
 * に変換し、毎フレーム両側について
 *   挙上角(上腕と体幹下方向のなす角) と 挙上方位(前方/側方/後方) 、
 *   肘屈曲角、肢位ごとの回旋角 を計算。姿勢ゲートを満たすフレームだけを
 * 各指標の時系列に蓄積し、中央値平滑化後の最大値と発生時刻を返す。
 *
 * 注意: 単眼3D推定に基づく「目安」。特に回旋系は実験的。
 * 3rd肢位の回旋は「前腕が垂直下向き=0°、外側+/内側−」を暫定基準とする(要確認)。
 */
(function (global) {
  "use strict";

  const AC = (typeof module !== "undefined" && module.exports)
    ? require("./angle-core.js")
    : global.AngleCore;
  const LM = AC.LM;
  const RAD2DEG = 180 / Math.PI;

  // ---- 3Dベクトル ----
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const len = (a) => Math.hypot(a.x, a.y, a.z);
  const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
  function normalize(a) {
    const n = len(a);
    return n > 1e-9 ? scale(a, 1 / n) : null;
  }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
  // vからn方向成分を除く(nは単位ベクトル)
  const reject = (v, n) => sub(v, scale(n, dot(v, n)));

  // ---- 体幹座標系 ----
  // 戻り値 {u,r,f}: u=上, r=左肩→右肩, f=前方(いずれも単位ベクトル)。作れなければnull
  function trunkFrame(world) {
    if (!world) return null;
    const ls = world[LM.left_shoulder], rs = world[LM.right_shoulder];
    const lh = world[LM.left_hip], rh = world[LM.right_hip];
    const nose = world[LM.nose];
    if (!ls || !rs || !lh || !rh || !nose) return null;
    const midSh = mid(ls, rs), midHip = mid(lh, rh);
    const u = normalize(sub(midSh, midHip));
    if (!u) return null;
    let r = normalize(reject(sub(rs, ls), u));
    if (!r) return null;
    let f = normalize(cross(r, u));
    if (!f) return null;
    // 前方の符号は「鼻は肩より前にある」ことで自己決定(座標系の軸規約に依存しない)
    const noseDir = reject(sub(nose, midSh), u);
    if (dot(noseDir, f) < 0) f = scale(f, -1);
    return { u, r, f };
  }

  // ---- 1フレーム分の指標(片側) ----
  // 戻り値 {elev, azim, elbowFlex, rot1, rot2, rot3} (計算不能な項目はnull)
  function frameMetrics(world, side, frame) {
    if (!world || !frame) return null;
    const sh = world[LM[side + "_shoulder"]];
    const el = world[LM[side + "_elbow"]];
    const wr = world[LM[side + "_wrist"]];
    if (!sh || !el) return null;

    const { u, r, f } = frame;
    const latSign = side === "right" ? 1 : -1; // 体から外側方向の符号

    const a = sub(el, sh); // 上腕ベクトル
    const an = normalize(a);
    if (!an) return null;

    // 挙上角: 体幹下方向(-u)とのなす角。0=下垂, 180=真上
    const elev = Math.acos(Math.min(1, Math.max(-1, -dot(an, u)))) * RAD2DEG;

    // 挙上方位: 前方成分と外側成分から。0=真横(外転面), +90=前方(屈曲面), -90=後方(伸展)
    const aF = dot(a, f);
    const aLat = latSign * dot(a, r);
    const horiz = Math.hypot(aF, aLat);
    const azim = horiz > 1e-6 ? Math.atan2(aF, aLat) * RAD2DEG : null;

    let elbowFlex = null, rot1 = null, rot2 = null, rot3 = null;
    if (wr) {
      const raw = AC.angleAt(sh, el, wr);
      if (isFinite(raw)) elbowFlex = 180 - raw;
      const w = sub(wr, el); // 前腕ベクトル

      // 1st肢位外旋: 水平面内で前方=0°、外側+
      const wh = reject(w, u);
      if (len(wh) > 1e-6) {
        rot1 = Math.atan2(latSign * dot(wh, r), dot(wh, f)) * RAD2DEG;
      }

      // 2nd肢位回旋: 前腕が前方水平=0°、真上=+90(外旋)、真下=-90(内旋)
      const wUp = dot(w, u); // uは体幹の「上」単位ベクトル
      const wF = dot(w, f);
      if (Math.hypot(wUp, wF) > 1e-6) {
        rot2 = Math.atan2(wUp, wF) * RAD2DEG;
      }

      // 3rd肢位回旋: 上腕軸まわり。前腕が垂直下=0°、外側+(暫定基準・要確認)
      const down = scale(u, -1);
      const eDown = normalize(reject(down, an));
      const eLat = normalize(reject(scale(r, latSign), an));
      if (eDown && eLat) {
        const wd = dot(w, eDown), wl = dot(w, eLat);
        if (Math.hypot(wd, wl) > 1e-6) rot3 = Math.atan2(wl, wd) * RAD2DEG;
      }
    }
    return { elev, azim, elbowFlex, rot1, rot2, rot3 };
  }

  // ---- 姿勢ゲート(定数) ----
  const GATE = {
    elevMin: 10,            // 挙上として数える最小角
    extMax: 80,             // 伸展のありえる上限(誤分類対策)
    elbowMin: 50, elbowMax: 130, // 回旋計測に必要な肘屈曲
    pos1ElevMax: 30,        // 1st肢位: 上腕下垂
    pos23ElevMin: 60, pos23ElevMax: 120, // 2nd/3rd肢位: 90°付近
    minFrames: 5,           // 指標を採用する最小有効フレーム数
    minVis: 0.5,
  };

  const METRICS = [
    { key: "flex", motion: "挙上(屈曲)" },
    { key: "abd", motion: "外転" },
    { key: "ext", motion: "伸展" },
    { key: "er1", motion: "1st外旋" },
    { key: "er2", motion: "2nd外旋" },
    { key: "ir2", motion: "2nd内旋" },
    { key: "er3", motion: "3rd外旋", note: "0°基準=前腕垂直下(暫定・要確認)" },
    { key: "ir3", motion: "3rd内旋", note: "0°基準=前腕垂直下(暫定・要確認)" },
  ];

  function visOK(src, indices) {
    for (const i of indices) {
      const p = src && src[i];
      const v = p && typeof p.visibility === "number" ? p.visibility : 1;
      if (!p || v < GATE.minVis) return false;
    }
    return true;
  }

  // 中央値平滑化(窓5)した系列の最大値とその時刻
  function seriesMax(series) {
    if (!series || series.length < GATE.minFrames) return null;
    let best = null;
    for (let i = 0; i < series.length; i++) {
      const w = series.slice(Math.max(0, i - 2), i + 3).map((p) => p.v).sort((a, b) => a - b);
      const med = w[Math.floor(w.length / 2)];
      if (!best || med > best.v) best = { v: med, t: series[i].t };
    }
    return { value: Math.round(best.v * 10) / 10, t: Math.round(best.t * 100) / 100 };
  }

  function createSession() {
    const series = {
      left: { flex: [], abd: [], ext: [], er1: [], er2: [], ir2: [], er3: [], ir3: [] },
      right: { flex: [], abd: [], ext: [], er1: [], er2: [], ir2: [], er3: [], ir3: [] },
    };
    let frames = 0;

    function add(world, norm, t) {
      const vsrc = norm || world;
      if (!visOK(vsrc, [LM.nose, LM.left_shoulder, LM.right_shoulder, LM.left_hip, LM.right_hip])) return;
      const frame = trunkFrame(world);
      if (!frame) return;
      frames++;
      for (const side of ["left", "right"]) {
        if (!visOK(vsrc, [LM[side + "_elbow"]])) continue;
        const m = frameMetrics(world, side, frame);
        if (!m) continue;
        const S = series[side];
        const push = (arr, v) => arr.push({ t, v });

        if (m.azim !== null && m.elev >= GATE.elevMin) {
          if (m.azim >= 45 && m.azim <= 135) push(S.flex, m.elev);
          else if (m.azim >= -30 && m.azim < 45) push(S.abd, m.elev);
          else if (m.azim > -135 && m.azim < -30 && m.elev <= GATE.extMax) push(S.ext, m.elev);
        }

        const wristOK = visOK(vsrc, [LM[side + "_wrist"]]);
        const elbowOK = m.elbowFlex !== null && m.elbowFlex >= GATE.elbowMin && m.elbowFlex <= GATE.elbowMax;
        if (wristOK && elbowOK) {
          if (m.elev < GATE.pos1ElevMax && m.rot1 !== null) push(S.er1, m.rot1);
          if (m.elev >= GATE.pos23ElevMin && m.elev <= GATE.pos23ElevMax && m.azim !== null) {
            if (m.azim >= -30 && m.azim < 45 && m.rot2 !== null) {
              push(S.er2, m.rot2);
              push(S.ir2, -m.rot2);
            }
            if (m.azim >= 45 && m.azim <= 135 && m.rot3 !== null) {
              push(S.er3, m.rot3);
              push(S.ir3, -m.rot3);
            }
          }
        }
      }
    }

    function finalize() {
      const out = { left: {}, right: {}, frames };
      for (const side of ["left", "right"]) {
        for (const mt of METRICS) {
          out[side][mt.key] = seriesMax(series[side][mt.key]);
        }
      }
      return out;
    }

    return { add, finalize, get frames() { return frames; } };
  }

  const api = { METRICS, GATE, trunkFrame, frameMetrics, seriesMax, createSession };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.ShoulderExam = api;
})(typeof window !== "undefined" ? window : globalThis);
