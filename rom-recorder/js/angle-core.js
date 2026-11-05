/*
 * ROMレコーダー angle-core
 * 角度計算の純粋関数と関節プリセット定義。
 * ブラウザ(グローバル AngleCore)と Node のテスト(module.exports)の両方から使う。
 * 座標系: 画像座標(x右+, y下+)。3D時は z を含む同一スケールの座標を渡すこと。
 */
(function (global) {
  "use strict";

  const RAD2DEG = 180 / Math.PI;

  // MediaPipe Pose Landmarker (BlazePose 33点) のランドマーク番号
  const LM = {
    nose: 0,
    left_shoulder: 11, right_shoulder: 12,
    left_elbow: 13, right_elbow: 14,
    left_wrist: 15, right_wrist: 16,
    left_index: 19, right_index: 20,
    left_hip: 23, right_hip: 24,
    left_knee: 25, right_knee: 26,
    left_ankle: 27, right_ankle: 28,
    left_heel: 29, right_heel: 30,
    left_foot_index: 31, right_foot_index: 32,
  };

  function vec(from, to) {
    return {
      x: to.x - from.x,
      y: to.y - from.y,
      z: (typeof to.z === "number" && typeof from.z === "number") ? to.z - from.z : 0,
    };
  }

  // 2ベクトルのなす角 (0..180°)
  function angleBetween(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const n1 = Math.hypot(v1.x, v1.y, v1.z);
    const n2 = Math.hypot(v2.x, v2.y, v2.z);
    if (!n1 || !n2) return NaN;
    const c = Math.min(1, Math.max(-1, dot / (n1 * n2)));
    return Math.acos(c) * RAD2DEG;
  }

  // 3点 A-B-C の頂点 B における角度 (0..180°)
  function angleAt(a, b, c) {
    return angleBetween(vec(b, a), vec(b, c));
  }

  // 2直線 P1→P2 / P3→P4 のなす角 (ベクトルとして 0..180°)
  function angleOfLines(p1, p2, p3, p4) {
    return angleBetween(vec(p1, p2), vec(p3, p4));
  }

  // 直線同士の交角としての鋭角 (0..90°)
  function acute(deg) {
    return deg > 90 ? 180 - deg : deg;
  }

  // 値の変換:
  //  flex180: 屈曲角 = 180° - 3点角 (完全伸展でほぼ180°になる関節)
  //  raw:     測った角度をそのまま表示
  //  ankle90: 底背屈 = 90° - (下腿軸と足底軸のなす角)。背屈が+、底屈が−
  function applyTransform(kind, raw) {
    switch (kind) {
      case "flex180": return 180 - raw;
      case "ankle90": return 90 - raw;
      default: return raw;
    }
  }

  // AIモードで使う関節プリセット。
  // points の役割名は side("left"/"right") と組み合わせて LM 番号に解決される。
  // type "3pt": points[1] を頂点とする3点角 / "2vec": vec(p0→p1) と vec(p2→p3) のなす角
  const PRESETS = [
    {
      id: "shoulder_flex", joint: "肩", motion: "屈曲(前方挙上)",
      type: "3pt", points: ["hip", "shoulder", "elbow"], transform: "raw",
      view: "真横から撮影(矢状面)。体幹ラインを基準にした挙上角",
      refKey: "shoulder_flexion",
    },
    {
      id: "shoulder_abd", joint: "肩", motion: "外転(側方挙上)",
      type: "3pt", points: ["hip", "shoulder", "elbow"], transform: "raw",
      view: "正面から撮影(前額面)。体幹ラインを基準にした挙上角",
      refKey: "shoulder_abduction",
    },
    {
      id: "elbow_flex", joint: "肘", motion: "屈曲",
      type: "3pt", points: ["shoulder", "elbow", "wrist"], transform: "flex180",
      view: "真横から撮影。完全伸展=0°、過伸展は0°未満と区別できない点に注意",
      refKey: "elbow_flexion",
    },
    {
      id: "hip_flex", joint: "股", motion: "屈曲",
      type: "3pt", points: ["shoulder", "hip", "knee"], transform: "flex180",
      view: "真横から撮影。体幹(肩-股)ラインと大腿のなす角。骨盤後傾で過大評価に注意",
      refKey: "hip_flexion",
    },
    {
      id: "hip_abd", joint: "股", motion: "外転",
      type: "2vec", points: ["mid_shoulder", "mid_hip", "hip", "knee"], transform: "raw",
      view: "正面から撮影。体幹正中線と大腿のなす角",
      refKey: "hip_abduction",
    },
    {
      id: "knee_flex", joint: "膝", motion: "屈曲",
      type: "3pt", points: ["hip", "knee", "ankle"], transform: "flex180",
      view: "真横から撮影。完全伸展=0°",
      refKey: "knee_flexion",
    },
    {
      id: "ankle", joint: "足", motion: "背屈(+)/底屈(−)",
      type: "2vec", points: ["ankle", "knee", "heel", "foot_index"], transform: "ankle90",
      view: "真横から撮影。下腿軸と足底(踵-つま先)のなす角。中間位=0°",
      refKey: "ankle_dorsiflexion",
    },
  ];

  // preset.points を LM 番号仕様に解決する。
  // 戻り値: [{idx} | {mid:[idxA, idxB]}] の配列
  function roleSpecs(preset, side) {
    return preset.points.map((role) => {
      if (role === "mid_shoulder") return { mid: [LM.left_shoulder, LM.right_shoulder] };
      if (role === "mid_hip") return { mid: [LM.left_hip, LM.right_hip] };
      const idx = LM[side + "_" + role];
      return { idx };
    });
  }

  // プリセットに関与する LM 番号一覧(可視性判定・強調描画用)
  function involvedIndices(preset, side) {
    const out = [];
    for (const spec of roleSpecs(preset, side)) {
      if (spec.mid) out.push(spec.mid[0], spec.mid[1]);
      else out.push(spec.idx);
    }
    return out;
  }

  // pts は preset.points と同順の座標配列
  function computeAngle(preset, pts) {
    if (!pts || pts.length < (preset.type === "3pt" ? 3 : 4) || pts.some((p) => !p)) return null;
    let raw;
    if (preset.type === "3pt") raw = angleAt(pts[0], pts[1], pts[2]);
    else raw = angleBetween(vec(pts[0], pts[1]), vec(pts[2], pts[3]));
    if (!isFinite(raw)) return null;
    return { raw, value: applyTransform(preset.transform, raw) };
  }

  // 表示用: 足関節は符号で背屈/底屈を言い分ける
  function describeValue(preset, value) {
    const v = Math.round(value * 10) / 10;
    if (preset && preset.transform === "ankle90") {
      if (v >= 0) return { label: "背屈", display: "背屈 " + v + "°" };
      return { label: "底屈", display: "底屈 " + (-v) + "°" };
    }
    return { label: preset ? preset.motion : "", display: v + "°" };
  }

  const api = {
    LM, PRESETS,
    vec, angleBetween, angleAt, angleOfLines, acute,
    applyTransform, roleSpecs, involvedIndices, computeAngle, describeValue,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.AngleCore = api;
})(typeof window !== "undefined" ? window : globalThis);
