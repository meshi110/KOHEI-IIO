/*
 * ROMレコーダー mmt-defs
 * MMT(徒手筋力テスト)の臨床定義。出典で確認できた内容のみを記載する。
 *
 * 【出典と確認状況】
 * - 髄節ごとのkey muscle function(下記ITEMS)は ISNCSCI(ASIA/ISCoS 国際標準)に基づく。
 *   ASIA/ISCoS International Standards Worksheet (2019) / SCIRE Project (UEMS・LEMS) /
 *   Kirshblum SC et al. ISNCSCI revised 2011 (PMID 22330108) で内容の一致を確認。
 * - グレード定義(GRADES)は ISNCSCI の運動スコア定義に基づく。
 *   ISNCSCIでは「0〜5で採点し、プラス・マイナスは付けない」と規定されている。
 * - MRCスケール(0〜5)の定義も併記。初出は1943年 Aids to the Investigation of
 *   Peripheral Nerve Injuries (War Memorandum No.7)。
 * - 「4+」「3-」等の中間表記はMRC/ISNCSCI標準の一部ではなく臨床上の慣用。
 *   評価者間一致を改善しないとの報告がある(PMID 29051814: 一致率 標準64% vs 修正48%、
 *   Fleiss κ 0.02 vs 0.13 でいずれも不良)。本アプリでは既定で使用可能としつつ、
 *   ISNCSCI準拠モードでは無効化する。
 *
 * 【未確認事項】(アプリ内・READMEにも明記)
 * - ASIA公式PDF原本の逐語表現、および各key muscleの標準テスト肢位の詳細パラメータは
 *   本アプリ作成時に機械的な原典照合ができていない。運用前に原典で確認すること。
 * - 日本語のMMT等級呼称(Good=「優」か「良」か等)は資料により揺れがあるため採用していない。
 */
(function (global) {
  "use strict";

  // ISNCSCI の key muscle functions (上肢5・下肢5)
  // words: 音声入力で髄節を特定するための言い換え(筋名・動作名)
  const ITEMS = [
    {
      level: "C5", region: "cervical",
      muscleJa: "肘屈筋(上腕二頭筋・上腕筋)", muscleEn: "Elbow flexors (biceps, brachialis)",
      action: "肘関節屈曲(前腕回外位)",
      words: ["上腕二頭筋", "じょうわんにとうきん", "肘屈曲", "ひじくっきょく", "上腕筋"],
    },
    {
      level: "C6", region: "cervical",
      muscleJa: "手関節伸筋(長・短橈側手根伸筋)", muscleEn: "Wrist extensors (ECRL/ECRB)",
      action: "手関節背屈(伸展)",
      words: ["橈側手根伸筋", "手関節伸展", "手関節背屈", "しゅかんせつはいくつ"],
    },
    {
      level: "C7", region: "cervical",
      muscleJa: "肘伸筋(上腕三頭筋)", muscleEn: "Elbow extensors (triceps)",
      action: "肘関節伸展",
      words: ["上腕三頭筋", "じょうわんさんとうきん", "肘伸展", "ひじしんてん", "三頭筋"],
    },
    {
      level: "C8", region: "cervical",
      muscleJa: "手指屈筋(中指の深指屈筋)", muscleEn: "Finger flexors (FDP to middle finger)",
      action: "中指DIP(末節)屈曲",
      words: ["深指屈筋", "しんしくっきん", "手指屈曲", "指屈曲", "中指屈曲"],
    },
    {
      level: "T1", region: "cervical",
      muscleJa: "小指外転筋", muscleEn: "Small finger abductors (abductor digiti minimi)",
      action: "小指の外転",
      words: ["小指外転筋", "しょうしがいてんきん", "小指外転"],
    },
    {
      level: "L2", region: "lumbar",
      muscleJa: "股屈筋(腸腰筋)", muscleEn: "Hip flexors (iliopsoas)",
      action: "股関節屈曲",
      words: ["腸腰筋", "ちょうようきん", "股屈曲", "股関節屈曲", "こかんせつくっきょく"],
    },
    {
      level: "L3", region: "lumbar",
      muscleJa: "膝伸筋(大腿四頭筋)", muscleEn: "Knee extensors (quadriceps)",
      action: "膝関節伸展",
      words: ["大腿四頭筋", "だいたいしとうきん", "膝伸展", "ひざしんてん", "四頭筋"],
    },
    {
      level: "L4", region: "lumbar",
      muscleJa: "足関節背屈筋(前脛骨筋)", muscleEn: "Ankle dorsiflexors (tibialis anterior)",
      action: "足関節背屈",
      words: ["前脛骨筋", "ぜんけいこつきん", "足背屈", "足関節背屈", "あしはいくつ"],
    },
    {
      level: "L5", region: "lumbar",
      muscleJa: "長母趾伸筋", muscleEn: "Long toe extensors (EHL)",
      action: "母趾IP関節伸展",
      words: ["長母趾伸筋", "ちょうぼししんきん", "母趾伸展", "ぼししんてん", "母趾背屈"],
    },
    {
      level: "S1", region: "lumbar",
      muscleJa: "足関節底屈筋(腓腹筋・ヒラメ筋)", muscleEn: "Ankle plantar flexors (gastrocnemius, soleus)",
      action: "足関節底屈",
      words: ["腓腹筋", "ひふくきん", "ヒラメ筋", "足底屈", "足関節底屈", "あしていくつ"],
    },
  ];

  // ISNCSCI の運動スコア定義(0〜5)。NTは本アプリでは「未入力」で表現する。
  const GRADES = [
    { value: 5, label: "重力＋最大抵抗に抗して全可動域(正常)" },
    { value: 4, label: "重力＋中等度の抵抗に抗して全可動域" },
    { value: 3, label: "重力に抗して全可動域" },
    { value: 2, label: "重力を除けば全可動域" },
    { value: 1, label: "触知/視認できる収縮のみ" },
    { value: 0, label: "完全麻痺(収縮なし)" },
  ];

  const SCALE_NOTE =
    "グレードはISNCSCI(ASIA/ISCoS国際標準)の運動スコア定義に基づきます。" +
    "髄節と筋の対応はISNCSCIのkey muscle functionです。テスト肢位の詳細は原典をご確認ください(本アプリでは原典PDFの逐語照合は未実施)。";

  const SOURCE_NOTE =
    "ISNCSCIでは運動スコアを0〜5の整数で採点し、プラス・マイナスは付けないと規定されています。" +
    "「4+」等の中間表記は臨床上の慣用で、評価者間一致を改善しないとの報告があります(PMID 29051814: 一致率 標準64%→修正48%)。" +
    "ASIA/ISCoSの評価として記録する場合は、設定の「ISNCSCI準拠モード」を有効にしてください。";

  const SOURCES = [
    {
      label: "ASIA/ISCoS International Standards Worksheet (2019) — 公式ワークシート",
      url: "https://asia-spinalinjury.org/wp-content/uploads/2019/04/ASIA-ISCOS-IntlWorksheet_2019.pdf",
    },
    {
      label: "Kirshblum SC et al. ISNCSCI (Revised 2011). J Spinal Cord Med — PMID 22330108",
      url: "https://pubmed.ncbi.nlm.nih.gov/22330108/",
    },
    {
      label: "SCIRE Project — Upper/Lower Extremity Motor Score (UEMS/LEMS)",
      url: "https://scireproject.com/outcome/upper-extremity-score-uems/",
    },
    {
      label: "MRC Muscle Scale (UKRI) — MRCスケール0〜5の原典解説",
      url: "https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-muscle-scale/",
    },
    {
      label: "Nielsen SO et al. 「4+」は一致度を改善しない. Chiropr Man Therap 2017 — PMID 29051814",
      url: "https://pubmed.ncbi.nlm.nih.gov/29051814/",
    },
  ];

  const VOICE_SOURCES = [
    {
      label: "MDN: Using the Web Speech API — Chrome等では音声がWebサービスに送信される旨の記載",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API",
    },
    {
      label: "MDN: SpeechRecognition.processLocally — 端末内処理の指定(既定はfalse)",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally",
    },
    {
      label: "Chrome Status: On-device Web Speech API — 端末内音声認識の対応状況",
      url: "https://chromestatus.com/feature/6090916291674112",
    },
  ];

  // UEMS/LEMS の満点(ISNCSCI: 各50点、合計100点)
  const MAX_SCORE = { cervical: 50, lumbar: 50, total: 100 };

  global.MMTDefs = { ITEMS, GRADES, SCALE_NOTE, SOURCE_NOTE, SOURCES, VOICE_SOURCES, MAX_SCORE };
})(window);
