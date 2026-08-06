/*
 * ボイス検査 items
 * 診察ルーティーンのシート定義と項目ライブラリ。
 *
 * 収載内容は「利用者(整形外科医)から提示された外来診察ルーティーン」を
 * そのまま初期シートにしたものであり、特定の標準評価表を主張するものではない。
 * 項目・順番・両側の有無はすべて画面から編集できる。
 *
 * item: { id, name(表示), say(読み上げ。省略時はname), type, bilateral, unit }
 * type: pm(±) / num(数値) / mmt(0-5±) / reflex(0〜4+) / level(脊椎レベル)
 *       / nrs(0-10) / text(自由発話)
 */
(function (global) {
  "use strict";

  function gid() {
    return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // [表示名, 読み, type, bilateral, unit]
  const SPINE_UPPER_MMT = [
    ["Deltoid", "三角筋", "mmt", true, ""],
    ["Biceps", "上腕二頭筋", "mmt", true, ""],
    ["Triceps", "上腕三頭筋", "mmt", true, ""],
    ["Wrist extension", "手関節背屈", "mmt", true, ""],
    ["Wrist flexion", "手関節掌屈", "mmt", true, ""],
    ["Finger extension", "手指伸展", "mmt", true, ""],
    ["Finger flexion", "手指屈曲", "mmt", true, ""],
    ["ADM", "小指外転筋", "mmt", true, ""],
    ["Interosseous", "骨間筋", "mmt", true, ""],
  ];
  const SPINE_UPPER_REFLEX = [
    ["BTR", "上腕二頭筋反射", "reflex", true, ""],
    ["BRR", "腕橈骨筋反射", "reflex", true, ""],
    ["TTR", "上腕三頭筋反射", "reflex", true, ""],
    ["Hoffman", "ホフマン", "pm", true, ""],
  ];
  const SPINE_CERVICAL_TEST = [
    ["Jackson", "ジャクソン", "pm", true, ""],
    ["Spurling", "スパーリング", "pm", true, ""],
  ];
  const SPINE_LOWER_MMT = [
    ["Psoas", "腸腰筋", "mmt", true, ""],
    ["Quadriceps", "大腿四頭筋", "mmt", true, ""],
    ["Hamstrings", "ハムストリング", "mmt", true, ""],
    ["TA", "前脛骨筋", "mmt", true, ""],
    ["Gastrocnemius", "腓腹筋", "mmt", true, ""],
    ["EHL", "長母趾伸筋", "mmt", true, ""],
    ["FHL", "長母趾屈筋", "mmt", true, ""],
    ["Peroneus", "腓骨筋", "mmt", true, ""],
  ];
  const SPINE_LOWER_REFLEX = [
    ["PTR", "膝蓋腱反射", "reflex", true, ""],
    ["ATR", "アキレス腱反射", "reflex", true, ""],
    ["Babinski", "バビンスキー", "pm", true, ""],
  ];
  const SPINE_LOCAL = [
    ["Spinous process knock pain", "棘突起叩打痛。高位もどうぞ", "text", false, ""],
    ["PVM tenderness", "傍脊柱筋圧痛", "pm", true, ""],
  ];
  const SPINE_TENSION = [
    ["SLR", "エスエルアール", "pm", true, ""],
    ["FNST", "大腿神経伸展テスト", "pm", true, ""],
  ];
  const SPINE_OTHER = [
    ["Sensory disturbance", "感覚障害。部位もどうぞ", "text", false, ""],
    ["排尿障害", "排尿障害", "pm", false, ""],
  ];

  const SHOULDER_ROM = [
    ["Elevation", "挙上", "num", true, "°"],
    ["Abduction", "外転", "num", true, "°"],
    ["ER", "外旋", "num", true, "°"],
    ["IR(母指最高位)", "内旋。母指の最高位", "level", true, ""],
  ];
  const SHOULDER_TEST = [
    ["Full can", "フルカン", "pm", true, ""],
    ["Empty can", "エンプティカン", "pm", true, ""],
    ["Belly press", "ベリープレス", "pm", true, ""],
    ["Swallow tail sign", "スワローテイルサイン", "pm", true, ""],
  ];
  const SHOULDER_TENDER = [
    ["圧痛 Coracoid", "圧痛。烏口突起", "pm", true, ""],
    ["圧痛 CHL", "圧痛。烏口上腕靱帯", "pm", true, ""],
    ["圧痛 LHB", "圧痛。上腕二頭筋長頭腱", "pm", true, ""],
    ["圧痛 SSp", "圧痛。棘上筋", "pm", true, ""],
    ["圧痛 ISp", "圧痛。棘下筋", "pm", true, ""],
  ];

  const KNEE_ROM = [
    ["Extension", "膝伸展", "num", true, "°"],
    ["Flexion", "膝屈曲", "num", true, "°"],
  ];
  const KNEE_TEST = [
    ["Ballottement", "膝蓋跳動", "pm", true, ""],
    ["Medial FT joint tenderness", "内側関節裂隙圧痛", "pm", true, ""],
    ["Lateral FT joint tenderness", "外側関節裂隙圧痛", "pm", true, ""],
    ["McMurray", "マックマレー", "pm", true, ""],
    ["Appley", "アプレイ", "pm", true, ""],
    ["Watson-Jones", "ワトソンジョーンズ", "pm", true, ""],
    ["Lachman", "ラックマン", "pm", true, ""],
    ["Valgus stress", "外反ストレス", "pm", true, ""],
    ["Varus stress", "内反ストレス", "pm", true, ""],
    ["Sagging", "サギング", "pm", true, ""],
  ];

  const LIBRARY = [
    { group: "脊椎: 上肢MMT", items: SPINE_UPPER_MMT },
    { group: "脊椎: 上肢反射", items: SPINE_UPPER_REFLEX },
    { group: "脊椎: 頸椎誘発", items: SPINE_CERVICAL_TEST },
    { group: "脊椎: 下肢MMT", items: SPINE_LOWER_MMT },
    { group: "脊椎: 下肢反射", items: SPINE_LOWER_REFLEX },
    { group: "脊椎: 局所所見", items: SPINE_LOCAL },
    { group: "脊椎: Tension sign", items: SPINE_TENSION },
    { group: "脊椎: その他", items: SPINE_OTHER },
    { group: "肩: ROM", items: SHOULDER_ROM },
    { group: "肩: 誘発テスト", items: SHOULDER_TEST },
    { group: "肩: 圧痛", items: SHOULDER_TENDER },
    { group: "膝: ROM", items: KNEE_ROM },
    { group: "膝: 徒手テスト", items: KNEE_TEST },
    {
      group: "汎用",
      items: [
        ["安静時痛 NRS", "安静時痛", "nrs", false, ""],
        ["運動時痛 NRS", "運動時痛", "nrs", false, ""],
        ["夜間痛", "夜間痛", "pm", false, ""],
        ["MMT(任意)", "МMT", "mmt", true, ""],
        ["数値(度)", "角度", "num", true, "°"],
        ["メモ(自由発話)", "メモ", "text", false, ""],
      ],
    },
  ];

  function makeItem(name, say, type, bilateral, unit) {
    return { id: gid(), name, say: say || "", type, bilateral: !!bilateral, unit: unit || "" };
  }

  function fromDefs(defs) {
    return defs.map((d) => makeItem(d[0], d[1], d[2], d[3], d[4]));
  }

  // 初期シート(利用者の外来ルーティーンそのまま。編集・並べ替え可)
  function defaultTemplates() {
    return [
      {
        id: "tpl-spine",
        name: "脊椎 診察ルーティーン",
        items: [].concat(
          fromDefs(SPINE_UPPER_MMT), fromDefs(SPINE_UPPER_REFLEX), fromDefs(SPINE_CERVICAL_TEST),
          fromDefs(SPINE_LOWER_MMT), fromDefs(SPINE_LOWER_REFLEX),
          fromDefs(SPINE_LOCAL), fromDefs(SPINE_TENSION), fromDefs(SPINE_OTHER)
        ),
      },
      {
        id: "tpl-shoulder",
        name: "肩 診察ルーティーン",
        items: [].concat(fromDefs(SHOULDER_ROM), fromDefs(SHOULDER_TEST), fromDefs(SHOULDER_TENDER)),
      },
      {
        id: "tpl-knee",
        name: "膝 診察ルーティーン",
        items: [].concat(fromDefs(KNEE_ROM), fromDefs(KNEE_TEST)),
      },
    ];
  }

  const TYPE_LABELS = {
    pm: "±(陽性/陰性)",
    num: "数値",
    mmt: "MMT(0-5±)",
    reflex: "反射(0〜4+)",
    level: "脊椎レベル",
    nrs: "NRS(0-10)",
    text: "自由発話",
  };

  const api = { LIBRARY, makeItem, defaultTemplates, TYPE_LABELS, gid };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.VexItems = api;
})(typeof window !== "undefined" ? window : globalThis);
