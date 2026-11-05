/*
 * ROMレコーダー refs
 * 参考可動域(基準値)の項目定義。
 *
 * データ真正性の方針: 既定値は「空」。
 * 学会原典PDF(下記リンク)を本アプリ作成時に機械的に照合できなかったため、
 * 数値は確定情報としては埋め込まない。設定画面のボタンから
 * 「一般的な候補値(二次情報由来・原典未照合=要確認)」を明示的に入力するか、
 * 利用者自身が原典を確認のうえ入力する。
 */
(function (global) {
  "use strict";

  const REF_ITEMS = [
    { key: "shoulder_flexion", joint: "肩", motion: "屈曲(前方挙上)" },
    { key: "shoulder_abduction", joint: "肩", motion: "外転(側方挙上)" },
    { key: "elbow_flexion", joint: "肘", motion: "屈曲" },
    { key: "hip_flexion", joint: "股", motion: "屈曲" },
    { key: "hip_abduction", joint: "股", motion: "外転" },
    { key: "knee_flexion", joint: "膝", motion: "屈曲" },
    { key: "ankle_dorsiflexion", joint: "足", motion: "背屈" },
    { key: "ankle_plantarflexion", joint: "足", motion: "底屈" },
  ];

  // 二次情報(検索要約)由来の一般的な値。原典未照合のため「要確認」。
  // 下肢は複数の二次情報で一致、上肢(肘など)は資料間で差異が見られた。
  // 詳細と原典リンクは docs/software-survey.md を参照。
  const REF_CANDIDATES = {
    shoulder_flexion: 180,
    shoulder_abduction: 180,
    elbow_flexion: 145,
    hip_flexion: 125,
    hip_abduction: 45,
    knee_flexion: 130,
    ankle_dorsiflexion: 20,
    ankle_plantarflexion: 45,
  };

  const REF_SOURCES = [
    {
      label: "J-STAGE: 関節可動域表示ならびに測定法改訂について(2022年4月改訂) DOI:10.2490/jjrmc.58.1188",
      url: "https://www.jstage.jst.go.jp/article/jjrmc/58/10/58_58.1188/_article/-char/ja/",
    },
    {
      label: "日本整形外科学会・日本リハビリテーション医学会 連名資料(日本スポーツ協会掲載PDF)",
      url: "https://jspo.jp/pdf/rangeofmotion2022.pdf",
    },
    {
      label: "日本リハビリテーション医学会 改訂告知ページ",
      url: "https://www.jarm.or.jp/member/kadou.html",
    },
  ];

  global.Refs = { REF_ITEMS, REF_CANDIDATES, REF_SOURCES };
})(window);
