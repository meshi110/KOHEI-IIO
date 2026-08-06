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

  // ---- 撮影方向の判定 ----
  //
  // 単眼3D推定は奥行き(z)方向の誤差が大きいため、計測面がカメラに正対している
  // 向きでしか信用できない。そこで撮影方向を判定し、その向きで信頼できる指標
  // だけを採用する。
  //   正面(前額面): 外転・1st外旋・2nd回旋
  //   側面(矢状面): 挙上(屈曲)・伸展 …ただし遠い側の腕は体に隠れるため、
  //                 カメラに近い側のみ採用する
  //
  // worldLandmarks は画像に沿った軸(x:右, y:下, z:奥行き)を持つため、
  // 両肩ベクトルが画像内で横に広がっていれば正面、奥行き方向を向いていれば側面。
  function detectView(world) {
    if (!world) return null;
    const ls = world[LM.left_shoulder], rs = world[LM.right_shoulder];
    if (!ls || !rs) return null;
    const d = sub(rs, ls);
    const lateral = Math.abs(d.x);
    const depth = Math.abs(d.z);
    if (lateral < 1e-6 && depth < 1e-6) return null;
    return lateral >= depth ? "front" : "side";
  }

  // 側面撮影でカメラに近い側(= 可視性が高い側)を返す
  function nearSide(norm) {
    if (!norm) return null;
    const vis = (i) => (norm[i] && typeof norm[i].visibility === "number" ? norm[i].visibility : 0);
    const r = vis(LM.right_shoulder) + vis(LM.right_elbow) + vis(LM.right_wrist);
    const l = vis(LM.left_shoulder) + vis(LM.left_elbow) + vis(LM.left_wrist);
    if (Math.abs(r - l) < 0.15) return null; // 差が小さいときは判定しない
    return r > l ? "right" : "left";
  }

  // 体幹の傾き(代償の目安)。垂直からの側方傾斜と前後傾斜(度)
  function trunkLean(frame) {
    if (!frame) return null;
    const u = frame.u; // 体幹の上方向(画像座標系: y下向き)
    return {
      lateral: Math.abs(Math.atan2(u.x, -u.y) * RAD2DEG),
      sagittal: Math.abs(Math.atan2(u.z, -u.y) * RAD2DEG),
    };
  }

  // ---- 姿勢ゲート(定数) ----
  const GATE = {
    elevMin: 10,            // 挙上として数える最小角
    extMax: 80,             // 伸展のありえる上限(誤分類対策)
    elbowMin: 50, elbowMax: 130, // 回旋計測に必要な肘屈曲
    pos1ElevMax: 30,        // 1st肢位: 上腕下垂
    pos23ElevMin: 60, pos23ElevMax: 120, // 2nd/3rd肢位: 90°付近
    minFrames: 5,           // 指標を採用する最小有効フレーム数
    minVis: 0.5,            // 角度を採用するのに必要な可視性
    // 「反対側の腕が挙がっているか」の判定は概略位置で足りるため、
    // 側面撮影で隠れている腕でも両手/片手を見分けられるよう閾値を下げる
    activeVis: 0.2,
    activeElev: 30,         // 「その腕を動かしている」とみなす挙上角
    leanWarn: 10,           // これを超える体幹傾斜は代償として警告
  };

  // view: この指標を信用できる撮影方向
  const METRICS = [
    { key: "flex", motion: "挙上(屈曲)", view: "side" },
    { key: "abd", motion: "外転", view: "front" },
    { key: "ext", motion: "伸展", view: "side" },
    { key: "er1", motion: "1st外旋", view: "front" },
    { key: "er2", motion: "2nd外旋", view: "front" },
    { key: "ir2", motion: "2nd内旋", view: "front" },
    { key: "er3", motion: "3rd外旋", view: "any", note: "単一方向では不安定。0°基準=前腕垂直下(暫定・要確認)" },
    { key: "ir3", motion: "3rd内旋", view: "any", note: "単一方向では不安定。0°基準=前腕垂直下(暫定・要確認)" },
  ];

  function metricsForView(view) {
    return METRICS.filter((m) => m.view === "any" || m.view === view);
  }

  function visOK(src, indices, min) {
    const th = (min === undefined) ? GATE.minVis : min;
    for (const i of indices) {
      const p = src && src[i];
      const v = p && typeof p.visibility === "number" ? p.visibility : 1;
      if (!p || v < th) return false;
    }
    return true;
  }

  // 中央値平滑化(窓5)した系列の最大値とその時刻・そのときの体幹傾斜
  function seriesMax(series) {
    if (!series || series.length < GATE.minFrames) return null;
    let best = null;
    for (let i = 0; i < series.length; i++) {
      const w = series.slice(Math.max(0, i - 2), i + 3).map((p) => p.v).sort((a, b) => a - b);
      const med = w[Math.floor(w.length / 2)];
      if (!best || med > best.v) best = { v: med, t: series[i].t, lean: series[i].lean };
    }
    const out = { value: Math.round(best.v * 10) / 10, t: Math.round(best.t * 100) / 100 };
    if (best.lean) {
      out.lean = Math.round(Math.max(best.lean.lateral, best.lean.sagittal) * 10) / 10;
      out.compensated = out.lean > GATE.leanWarn;
    }
    return out;
  }

  function emptySeries() {
    return { flex: [], abd: [], ext: [], er1: [], er2: [], ir2: [], er3: [], ir3: [] };
  }

  // opts.view: "front" | "side" | "auto"(既定。フレームから多数決で判定)
  function createSession(opts) {
    opts = opts || {};
    // 条件別(uni=その腕だけを動かした / bi=両手同時)に分けて蓄積する。
    // 両手同時では健側が患側に引っ張られる(あるいは体幹代償が入る)ことがあるため、
    // 片手の値と並べて提示し、判断は人が行えるようにする。
    const series = {
      left: { uni: emptySeries(), bi: emptySeries() },
      right: { uni: emptySeries(), bi: emptySeries() },
    };
    let frames = 0;
    const viewVotes = { front: 0, side: 0 };
    const nearVotes = { right: 0, left: 0 };

    function add(world, norm, t) {
      const vsrc = norm || world;
      if (!visOK(vsrc, [LM.nose, LM.left_shoulder, LM.right_shoulder, LM.left_hip, LM.right_hip])) return;
      const frame = trunkFrame(world);
      if (!frame) return;
      frames++;

      const v = detectView(world);
      if (v) viewVotes[v]++;
      const n = nearSide(vsrc);
      if (n) nearVotes[n]++;

      const lean = trunkLean(frame);

      // 先に両側の挙上角を求めて「どちらの腕が動いているか」を決める。
      // 判定は低い可視性でも行い(側面で隠れた腕でも両手/片手を見分けるため)、
      // 角度の採用は minVis を満たす側だけに限る。
      const m = {}, measurable = {};
      for (const side of ["left", "right"]) {
        const idx = LM[side + "_elbow"];
        m[side] = visOK(vsrc, [idx], GATE.activeVis) ? frameMetrics(world, side, frame) : null;
        measurable[side] = visOK(vsrc, [idx]);
      }
      const active = {
        left: !!(m.left && m.left.elev >= GATE.activeElev),
        right: !!(m.right && m.right.elev >= GATE.activeElev),
      };
      const bothActive = active.left && active.right;

      for (const side of ["left", "right"]) {
        const mm = m[side];
        if (!mm || !measurable[side]) continue;
        // 反対側も挙上していれば「両手同時」、していなければ「片手」として記録
        const cond = bothActive ? "bi" : "uni";
        const S = series[side][cond];
        const push = (arr, val) => arr.push({ t, v: val, lean });

        if (mm.azim !== null && mm.elev >= GATE.elevMin) {
          if (mm.azim >= 45 && mm.azim <= 135) push(S.flex, mm.elev);
          else if (mm.azim >= -30 && mm.azim < 45) push(S.abd, mm.elev);
          else if (mm.azim > -135 && mm.azim < -30 && mm.elev <= GATE.extMax) push(S.ext, mm.elev);
        }

        const wristOK = visOK(vsrc, [LM[side + "_wrist"]]);
        const elbowOK = mm.elbowFlex !== null && mm.elbowFlex >= GATE.elbowMin && mm.elbowFlex <= GATE.elbowMax;
        if (wristOK && elbowOK) {
          if (mm.elev < GATE.pos1ElevMax && mm.rot1 !== null) push(S.er1, mm.rot1);
          if (mm.elev >= GATE.pos23ElevMin && mm.elev <= GATE.pos23ElevMax && mm.azim !== null) {
            if (mm.azim >= -30 && mm.azim < 45 && mm.rot2 !== null) {
              push(S.er2, mm.rot2);
              push(S.ir2, -mm.rot2);
            }
            if (mm.azim >= 45 && mm.azim <= 135 && mm.rot3 !== null) {
              push(S.er3, mm.rot3);
              push(S.ir3, -mm.rot3);
            }
          }
        }
      }
    }

    function resolvedView() {
      if (opts.view === "front" || opts.view === "side") return opts.view;
      if (!viewVotes.front && !viewVotes.side) return null;
      return viewVotes.front >= viewVotes.side ? "front" : "side";
    }

    function finalize() {
      const view = resolvedView();
      const near = (nearVotes.right === nearVotes.left) ? null : (nearVotes.right > nearVotes.left ? "right" : "left");
      const usable = metricsForView(view).map((m) => m.key);
      const out = {
        frames, view, nearSide: near,
        // 側面では遠い側の腕が体に隠れるため、近い側のみ採用する
        sides: view === "side" && near ? [near] : ["right", "left"],
        left: {}, right: {},
      };
      for (const side of ["left", "right"]) {
        const skip = view === "side" && near && side !== near;
        for (const mt of METRICS) {
          if (skip || usable.indexOf(mt.key) < 0) { out[side][mt.key] = null; continue; }
          out[side][mt.key] = {
            uni: seriesMax(series[side].uni[mt.key]),
            bi: seriesMax(series[side].bi[mt.key]),
          };
          if (!out[side][mt.key].uni && !out[side][mt.key].bi) out[side][mt.key] = null;
        }
      }
      return out;
    }

    return { add, finalize, get frames() { return frames; } };
  }

  const api = {
    METRICS, GATE, metricsForView,
    trunkFrame, frameMetrics, detectView, nearSide, trunkLean,
    seriesMax, createSession,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.ShoulderExam = api;
})(typeof window !== "undefined" ? window : globalThis);
