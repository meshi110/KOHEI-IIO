/*
 * ROMレコーダー voice-parse
 * 音声認識で得たテキストを、角度記録 / MMT記録の構造データに変換する純粋関数群。
 *
 * 設計方針:
 *  - 患者情報は音声で扱わない。患者IDは事前にUIで選択する前提で、
 *    このパーサーは「部位・側・数値」しか解釈しない(氏名等は解釈対象外)。
 *  - 臨床定義(髄節と筋の対応など)はここに持たず、呼び出し側から defs として受け取る。
 *  - ブラウザとNodeテストの双方から使う。
 */
(function (global) {
  "use strict";

  // ---- 数値の正規化 ----

  // 全角英数字 → 半角
  function toHalfWidth(s) {
    return String(s == null ? "" : s).replace(/[Ａ-Ｚａ-ｚ０-９＋－]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );
  }

  const KANJI_DIGIT = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

  // 漢数字(〜999)を数値へ。"百二十"=120, "九十"=90, "五"=5
  function kanjiToNumber(s) {
    if (!s) return null;
    let total = 0, current = 0, seen = false;
    for (const ch of s) {
      if (ch in KANJI_DIGIT) { current = KANJI_DIGIT[ch]; seen = true; continue; }
      if (ch === "十") { total += (current || 1) * 10; current = 0; seen = true; continue; }
      if (ch === "百") { total += (current || 1) * 100; current = 0; seen = true; continue; }
      return null; // 想定外の文字が混ざる場合は解釈しない
    }
    if (!seen) return null;
    return total + current;
  }

  // かな読みの数字(音声認識が数字を漢字/かなで返す場合の保険)
  const KANA_NUM = [
    ["ぜろ", 0], ["れい", 0], ["いち", 1], ["に", 2], ["さん", 3], ["よん", 4], ["し", 4],
    ["ご", 5], ["ろく", 6], ["なな", 7], ["しち", 7], ["はち", 8], ["きゅう", 9], ["く", 9],
  ];

  // 文字列中の最初の数値を取り出す。負値(底屈などのマイナス表現)にも対応。
  // 戻り値: {value, index, length} | null
  function findNumber(text) {
    const s = toHalfWidth(text);
    const m = /(-|マイナス|まいなす)?\s*(\d+(?:\.\d+)?)/.exec(s);
    if (m) {
      const v = Number(m[2]) * (m[1] ? -1 : 1);
      return { value: v, index: m.index, length: m[0].length };
    }
    const km = /(-|マイナス|まいなす)?\s*([〇零一二三四五六七八九十百]+)/.exec(s);
    if (km) {
      const v = kanjiToNumber(km[2]);
      if (v !== null) return { value: v * (km[1] ? -1 : 1), index: km.index, length: km[0].length };
    }
    for (const [kana, v] of KANA_NUM) {
      const i = s.indexOf(kana);
      if (i >= 0) return { value: v, index: i, length: kana.length };
    }
    return null;
  }

  // ---- 側(左右)の判定 ----
  // 注意: MMTの髄節表記(L4など)の "L" と 左(Left) の "L" が衝突するため、
  //       単独の L/R は「英字の直後に数字が来ない」場合のみ側とみなす。

  const SIDE_PATTERNS = [
    { re: /(右側|みぎがわ|ミギガワ|右|みぎ|ミギ)/, side: "右" },
    { re: /(左側|ひだりがわ|ヒダリガワ|左|ひだり|ヒダリ)/, side: "左" },
    { re: /(両側|りょうそく|両方|りょうほう)/, side: "両側" },
  ];

  function detectSide(text) {
    const s = toHalfWidth(text);
    let both = /(両側|りょうそく|両方|りょうほう)/.exec(s);
    if (both) return { side: "両側", index: both.index, length: both[0].length };
    for (const p of SIDE_PATTERNS) {
      if (p.side === "両側") continue;
      const m = p.re.exec(s);
      if (m) return { side: p.side, index: m.index, length: m[0].length };
    }
    // 単独のR/L(直後に数字がないもの)を側として扱う
    const rl = /\b([RL])(?!\s*\d)\b/i.exec(s);
    if (rl) return { side: rl[1].toUpperCase() === "R" ? "右" : "左", index: rl.index, length: rl[0].length };
    return null;
  }

  // ---- 関節・運動の辞書(角度記録用) ----

  const JOINTS = [
    { name: "肩", words: ["肩", "かた", "カタ", "肩関節"] },
    { name: "肘", words: ["肘", "ひじ", "ヒジ", "肘関節"] },
    { name: "手", words: ["手関節", "手首", "てくび", "手"] },
    { name: "前腕", words: ["前腕", "ぜんわん"] },
    { name: "股", words: ["股関節", "こかんせつ", "また", "股"] },
    { name: "膝", words: ["膝関節", "膝", "ひざ", "ヒザ"] },
    { name: "足", words: ["足関節", "足首", "あしくび", "足"] },
    { name: "頸椎", words: ["頸椎", "けいつい", "首", "くび"] },
    { name: "腰椎", words: ["腰椎", "ようつい", "腰", "こし"] },
  ];

  const MOTIONS = [
    { name: "屈曲", words: ["屈曲", "くっきょく", "前屈"] },
    { name: "伸展", words: ["伸展", "しんてん", "後屈"] },
    { name: "外転", words: ["外転", "がいてん"] },
    { name: "内転", words: ["内転", "ないてん"] },
    { name: "外旋", words: ["外旋", "がいせん"] },
    { name: "内旋", words: ["内旋", "ないせん"] },
    { name: "背屈", words: ["背屈", "はいくつ"] },
    { name: "底屈", words: ["底屈", "ていくつ"] },
    { name: "掌屈", words: ["掌屈", "しょうくつ"] },
    { name: "回内", words: ["回内", "かいない"] },
    { name: "回外", words: ["回外", "かいがい"] },
    { name: "側屈", words: ["側屈", "そっくつ"] },
    { name: "挙上", words: ["挙上", "きょじょう"] },
  ];

  // 辞書から最初に一致した項目を返す(長い語を優先して誤一致を避ける)
  function matchDict(text, dict) {
    const s = toHalfWidth(text);
    let best = null;
    for (const entry of dict) {
      for (const w of entry.words) {
        const i = s.indexOf(w);
        if (i < 0) continue;
        if (!best || w.length > best.word.length || (w.length === best.word.length && i < best.index)) {
          best = { name: entry.name, word: w, index: i, entry };
        }
      }
    }
    return best;
  }

  /**
   * 角度記録の音声を解釈する。
   * 例: 「膝 屈曲 右 120」「右膝屈曲120度」「肩外転 左 九十」
   * 戻り値: {joint, motion, side, angle, transcript} / 解釈不能なら null
   */
  function parseROM(text) {
    if (!text || !String(text).trim()) return null;
    const raw = String(text).trim();
    const s = toHalfWidth(raw);

    const num = findNumber(s);
    if (!num) return null;
    // 角度としてありえない値は採用しない(誤認識の混入を防ぐ)
    if (num.value < -180 || num.value > 360) return null;

    const joint = matchDict(s, JOINTS);
    const motion = matchDict(s, MOTIONS);
    const sideHit = detectSide(s);

    // 関節・運動がどちらも取れない場合は角度だけの入力とみなさず、解釈失敗とする
    if (!joint && !motion) return null;

    return {
      joint: joint ? joint.name : "",
      motion: motion ? motion.name : "",
      side: sideHit ? sideHit.side : "",
      angle: num.value,
      transcript: raw,
    };
  }

  // ---- MMT ----

  // 髄節表記の抽出: C5 / T1 / L4 / S1 、カタカナ読み(シー5/エル4/エス1)にも対応
  const KANA_LEVEL = { シー: "C", ｼｰ: "C", ティー: "T", テー: "T", エル: "L", エス: "S" };

  function detectLevel(text, validLevels) {
    const s = toHalfWidth(text).toUpperCase();
    const set = validLevels ? new Set(validLevels) : null;

    const re = /([CTLS])\s*(\d)/g;
    let m;
    while ((m = re.exec(s))) {
      const lv = m[1] + m[2];
      if (!set || set.has(lv)) return { level: lv, index: m.index, length: m[0].length };
    }
    const kre = /(シー|ｼｰ|ティー|テー|エル|エス)\s*([0-9]|[一二三四五六七八九])/g;
    const src = toHalfWidth(text);
    while ((m = kre.exec(src))) {
      const letter = KANA_LEVEL[m[1]];
      const digit = /\d/.test(m[2]) ? m[2] : String(kanjiToNumber(m[2]));
      const lv = letter + digit;
      if (!set || set.has(lv)) return { level: lv, index: m.index, length: m[0].length };
    }
    return null;
  }

  // MMTグレードの抽出: 0〜5 と +/− 修飾
  // 例: "4" "4+" "4プラス" "3マイナス" "五"
  function detectGrade(text) {
    const s = toHalfWidth(text);
    // 数字 + 直後の記号/かな修飾
    const re = /([0-5])\s*(\+|-|プラス|ぷらす|マイナス|まいなす)?/;
    const m = re.exec(s);
    if (m) {
      let mod = "";
      if (m[2]) mod = /(\+|プラス|ぷらす)/.test(m[2]) ? "+" : "-";
      return { grade: Number(m[1]), modifier: mod, index: m.index, length: m[0].length };
    }
    const km = /([〇零一二三四五])\s*(\+|-|プラス|ぷらす|マイナス|まいなす)?/.exec(s);
    if (km) {
      const v = kanjiToNumber(km[1]);
      if (v !== null && v >= 0 && v <= 5) {
        let mod = "";
        if (km[2]) mod = /(\+|プラス|ぷらす)/.test(km[2]) ? "+" : "-";
        return { grade: v, modifier: mod, index: km.index, length: km[0].length };
      }
    }
    return null;
  }

  /**
   * MMTの音声を解釈する。
   * defs: [{level, muscleJa, words:[...]}...] を呼び出し側から渡す(臨床定義はここに持たない)
   * 例: 「右 L4 4」「左 前脛骨筋 3プラス」「L4 右 よん」
   * 戻り値: {level, side, grade, modifier, transcript} / 解釈不能なら null
   */
  function parseMMT(text, defs) {
    if (!text || !String(text).trim()) return null;
    const raw = String(text).trim();
    const s = toHalfWidth(raw);
    const levels = (defs || []).map((d) => d.level);

    const lv = detectLevel(s, levels.length ? levels : null);
    // 髄節が明示されない場合は筋名からの解決を試みる
    let level = lv ? lv.level : null;
    let consumed = lv ? { index: lv.index, length: lv.length } : null;
    if (!level && defs && defs.length) {
      const dict = defs.map((d) => ({ name: d.level, words: d.words || [d.muscleJa] }));
      const hit = matchDict(s, dict);
      if (hit) { level = hit.name; consumed = { index: hit.index, length: hit.word.length }; }
    }
    if (!level) return null;

    const sideHit = detectSide(s);
    if (!sideHit) return null; // 左右の取り違えは重大なので、明示されない限り採用しない

    // 髄節表記に含まれる数字をグレードと誤認しないよう、該当部分を除去してから探す
    let rest = s;
    if (consumed) {
      rest = s.slice(0, consumed.index) + " " + s.slice(consumed.index + consumed.length);
    }
    const g = detectGrade(rest);
    if (!g) return null;

    return {
      level,
      side: sideHit.side,
      grade: g.grade,
      modifier: g.modifier,
      transcript: raw,
    };
  }

  // ---- 患者IDの音声指定 ----
  //
  // 氏名が音声に混入しないよう、構造的な歯止めを二重にかける:
  //   1) 「患者」等の合図語がある発話しか患者切替として扱わない
  //   2) 合図語の後ろが「英字＋数字」のID形式でなければ採用しない
  //      (日本語の氏名はこの形に合致しないため、言ってしまっても登録されない)

  // 音声認識は英字を読み(カタカナ)で返すことがあるため、読み→英字に変換する
  const KANA_ALPHA = [
    ["ダブリュー", "W"], ["エックス", "X"], ["エイチ", "H"], ["エッチ", "H"],
    ["ジェイ", "J"], ["ジェー", "J"], ["ゼット", "Z"], ["ディー", "D"], ["デー", "D"],
    ["ティー", "T"], ["テー", "T"], ["アール", "R"], ["キュー", "Q"], ["ブイ", "V"],
    ["ワイ", "Y"], ["エフ", "F"], ["エヌ", "N"], ["エム", "M"], ["エル", "L"],
    ["エス", "S"], ["ケー", "K"], ["ピー", "P"], ["ビー", "B"], ["シー", "C"],
    ["ジー", "G"], ["アイ", "I"], ["オー", "O"], ["ユー", "U"], ["エー", "A"], ["エイ", "A"],
    ["イー", "E"],
  ];

  function kanaToAlpha(s) {
    let out = s;
    for (const [kana, ch] of KANA_ALPHA) out = out.split(kana).join(ch);
    return out;
  }

  // 患者切替の合図語
  const PATIENT_TRIGGER = /(患者(?:ID|アイディー|番号)?|かんじゃ(?:ID|ばんごう)?|ペイシェント)/;

  // 比較用に正規化(記号・空白を除いて大文字化)
  function normalizeId(s) {
    return toHalfWidth(String(s == null ? "" : s)).toUpperCase().replace(/[\s\-_ー－・.]/g, "");
  }

  /**
   * 患者IDの音声を解釈する。
   * 例: 「患者 A12」「かんじゃ エー12」「患者ID 0034」
   * knownPatients: 既存の患者ID一覧(あれば読みの揺れを吸収して既存IDに解決する)
   * 戻り値: {patient, matched:"known"|"pattern", transcript} / 採用できなければ null
   */
  function parsePatient(text, knownPatients) {
    if (!text || !String(text).trim()) return null;
    const raw = String(text).trim();
    const s = toHalfWidth(raw);

    const trig = PATIENT_TRIGGER.exec(s);
    if (!trig) return null; // 合図語がなければ患者切替とみなさない

    // 合図語より後ろだけを対象にする
    const after = s.slice(trig.index + trig[0].length);
    if (!after.trim()) return null;

    const candidate = normalizeId(kanaToAlpha(after));
    if (!candidate) return null;

    // 既存の患者IDに一致すれば、その正式表記(ハイフン等を含む元の文字列)を返す
    const known = Array.isArray(knownPatients) ? knownPatients : [];
    for (const p of known) {
      if (normalizeId(p) === candidate) {
        return { patient: p, matched: "known", transcript: raw };
      }
    }

    // 新規はID形式(英字0〜3文字＋数字1〜6桁)のみ受け付ける。氏名はここで弾かれる
    if (/^[A-Z]{0,3}\d{1,6}$/.test(candidate)) {
      return { patient: candidate, matched: "pattern", transcript: raw };
    }
    return null;
  }

  const api = {
    toHalfWidth, kanjiToNumber, findNumber, detectSide, matchDict,
    detectLevel, detectGrade, parseROM, parseMMT, parsePatient,
    kanaToAlpha, normalizeId,
    JOINTS, MOTIONS,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.VoiceParse = api;
})(typeof window !== "undefined" ? window : globalThis);
