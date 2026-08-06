/*
 * ボイス検査 parse
 * 音声認識テキストを回答タイプ別に解釈する純粋関数群。
 * (rom-recorder の voice-parse を土台に、徒手検査向けに再構成)
 * Node のテストからも使う。
 */
(function (global) {
  "use strict";

  function toHalfWidth(s) {
    return String(s == null ? "" : s)
      .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[．]/g, ".")
      // 注意: 長音「ー」は変換しない(「えーっと」等がマイナス扱いになるため)
      .replace(/[－―‐−]/g, "-");
  }

  const KANJI_DIGIT = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

  // 「九十五」「百二十」「四十五」などを数値へ(0〜999)
  function kanjiToNumber(s) {
    if (!s) return null;
    let rest = s, total = 0, any = false;
    const take = (ch, mult) => {
      const i = rest.indexOf(ch);
      if (i < 0) return;
      const head = rest.slice(0, i);
      const d = head === "" ? 1 : KANJI_DIGIT[head];
      if (d === undefined) return;
      total += d * mult;
      rest = rest.slice(i + 1);
      any = true;
    };
    take("百", 100);
    take("十", 10);
    if (rest !== "") {
      const d = KANJI_DIGIT[rest];
      if (d === undefined) return any ? null : (KANJI_DIGIT[s] !== undefined ? KANJI_DIGIT[s] : null);
      total += d;
      any = true;
    }
    return any ? total : null;
  }

  // 文中の最初の数値(算用/漢数字、小数、マイナス対応)
  function findNumber(text) {
    const s = toHalfWidth(text);
    const m = s.match(/(-|マイナス|―)?\s*(\d+(?:\.\d+)?)/);
    if (m) {
      const v = parseFloat(m[2]);
      return m[1] ? -v : v;
    }
    const km = s.match(/(マイナス)?\s*([〇零一二三四五六七八九十百]+)/);
    if (km) {
      const v = kanjiToNumber(km[2]);
      if (v !== null) return km[1] ? -v : v;
    }
    return null;
  }

  // 英字の読み(カタカナ)→英字
  const KANA_ALPHA = [
    ["ティーエイチ", "TH"], ["ティーエッチ", "TH"], ["テーエイチ", "TH"],
    ["エス", "S"], ["エル", "L"], ["シー", "C"], ["ティー", "T"], ["テー", "T"], ["エイチ", "H"], ["エッチ", "H"],
  ];
  function kanaToAlpha(s) {
    let out = s;
    for (const [kana, ch] of KANA_ALPHA) out = out.split(kana).join(ch);
    return out;
  }

  // ---- 回答タイプ別パーサー ----
  // 戻り値: {value, display} / 解釈できなければ null

  function parsePM(text) {
    const s = toHalfWidth(text);
    if (/(判定不能|判定できない|不明|どちらとも)/.test(s)) return { value: "判定不能", display: "判定不能" };
    if (/(陽性|ようせい|プラス|\+|あり(?!ません))/.test(s)) return { value: "+", display: "プラス" };
    if (/(陰性|いんせい|マイナス|-|なし|ありません)/.test(s)) return { value: "-", display: "マイナス" };
    return null;
  }

  function parseNum(text, unit) {
    const v = findNumber(text);
    if (v === null || !isFinite(v)) return null;
    if (v < -400 || v > 400) return null; // 誤認識対策のゆるい範囲
    return { value: v, display: String(v) + (unit || "") };
  }

  function parseMMT(text) {
    const s = toHalfWidth(text);
    const m = s.match(/(?<![\d.])([0-5])(?![\d.])\s*(プラス|\+|マイナス|-)?/);
    let grade = null, mod = "";
    if (m) {
      grade = Number(m[1]);
      mod = m[2] ? (/(プラス|\+)/.test(m[2]) ? "+" : "-") : "";
    } else {
      const k = s.match(/([〇零一二三四五])\s*(プラス|マイナス)?/);
      if (!k) return null;
      grade = kanjiToNumber(k[1]);
      if (grade === null || grade > 5) return null;
      mod = k[2] ? (k[2] === "プラス" ? "+" : "-") : "";
    }
    const value = grade + mod;
    return { value, display: grade + (mod === "+" ? "プラス" : mod === "-" ? "マイナス" : "") };
  }

  const LEVELS = ["C7"]
    .concat(Array.from({ length: 12 }, (_, i) => "Th" + (i + 1)))
    .concat(Array.from({ length: 5 }, (_, i) => "L" + (i + 1)))
    .concat(["仙骨部", "殿部", "大腿"]);

  function parseLevel(text) {
    let s = toHalfWidth(kanaToAlpha(String(text)));
    s = s.replace(/胸椎/g, "TH").replace(/腰椎/g, "L").replace(/頸椎|けいつい/g, "C");
    if (/仙骨/.test(s)) return { value: "仙骨部", display: "仙骨部" };
    if (/殿部|でんぶ|おしり/.test(s)) return { value: "殿部", display: "殿部" };
    if (/大腿|ふともも/.test(s)) return { value: "大腿", display: "大腿" };
    const m = s.toUpperCase().match(/\b(C\s*7|TH\s*(1[0-2]|[1-9])|L\s*([1-5]))\b/);
    if (!m) return null;
    const raw = m[1].replace(/\s+/g, "");
    const norm = raw === "C7" ? "C7" : raw.startsWith("TH") ? "Th" + raw.slice(2) : raw;
    if (!LEVELS.includes(norm)) return null;
    return { value: norm, display: norm };
  }

  function parseNRS(text) {
    const v = findNumber(text);
    if (v === null || !Number.isInteger(v) || v < 0 || v > 10) return null;
    return { value: v, display: String(v) };
  }

  // 腱反射(DTR)。0〜4+ の標準スケールに正規化する(2+が正常)。
  // 記述語(消失/低下/正常/亢進/クローヌス)と数値(2プラス等)の両方に対応。
  // ±は減弱として別値で保持する。生の認識テキストは別途保存されるため、
  // 正規化に迷いがあっても原発話は失われない。
  function parseReflex(text) {
    const s = toHalfWidth(String(text)).replace(/\s/g, "");
    const R = (value, note) => ({ value, display: value + " " + note });
    // 「プラスマイナス」は「マイナス」を含むため、消失判定より先に見る
    if (/(プラスマイナス|プラマイ|±)/.test(s)) return R("±", "減弱");
    if (/消失|そうしつ|マイナス/.test(s)) return R("0", "消失");
    if (/クローヌス|著明|ちょめい/.test(s)) return R("4+", "著明亢進");
    if (/亢進|こうしん/.test(s)) return R("3+", "亢進");
    if (/正常|せいじょう/.test(s)) return R("2+", "正常");
    if (/減弱|低下|ていか|げんじゃく/.test(s)) return R("1+", "低下");
    // 数値(0〜4)+プラス。漢数字も可
    let d = null;
    const m = s.match(/([0-4])/);
    if (m) d = Number(m[1]);
    else {
      const km = s.match(/([〇零一二三四])/);
      if (km) d = kanjiToNumber(km[1]);
    }
    if (d === null || d < 0 || d > 4) return null;
    const notes = ["消失", "低下", "正常", "亢進", "著明亢進"];
    return R(d === 0 ? "0" : d + "+", notes[d]);
  }

  function parseText(text) {
    const t = String(text).trim();
    return t ? { value: t, display: t } : null;
  }

  function answer(type, text) {
    if (!text || !String(text).trim()) return null;
    switch (type) {
      case "pm": return parsePM(text);
      case "num": return parseNum(text);
      case "mmt": return parseMMT(text);
      case "reflex": return parseReflex(text);
      case "level": return parseLevel(text);
      case "nrs": return parseNRS(text);
      case "text": return parseText(text);
      default: return null;
    }
  }

  // 単位付き(numのみ表示に単位を足す)
  function answerWithUnit(step, text) {
    if (step.type === "num") {
      const r = parseNum(text, step.unit);
      return r;
    }
    return answer(step.type, text);
  }

  // ---- 進行コマンド ----
  function command(text) {
    const s = toHalfWidth(String(text)).trim();
    if (/^(スキップ|パス|飛ばして|とばして)/.test(s)) return "skip";
    if (/^(戻る|もどる|前へ|まえへ|バック)/.test(s)) return "back";
    if (/^(もう一度|もういちど|繰り返し|くりかえし|リピート)/.test(s)) return "repeat";
    if (/^(一時停止|いちじていし|ポーズ|待って|まって)/.test(s)) return "pause";
    if (/^(再開|さいかい|続き|つづき)/.test(s)) return "resume";
    if (/^(終了|しゅうりょう|中止|ちゅうし|おわり|終わり)/.test(s)) return "end";
    return null;
  }

  const api = {
    toHalfWidth, kanjiToNumber, findNumber, kanaToAlpha,
    parsePM, parseNum, parseMMT, parseReflex, parseLevel, parseNRS, parseText,
    answer, answerWithUnit, command, LEVELS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.VexParse = api;
})(typeof window !== "undefined" ? window : globalThis);
