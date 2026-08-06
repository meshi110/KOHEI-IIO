# 既存ソフト・文献調査メモ(角度計測・動作解析)

調査日: 2026-08-06 / 方法: Web検索・公式サイト/ストア確認・PubMed(MCP)
方針: **出典で確認できた情報のみ記載**し、確認できなかった項目は「未確認」「要確認」と明記する(推測で埋めない)。
注記: 調査環境の制約で、日本語公式サイト・学会PDFの多く(下記に列挙)が機械取得できず(HTTP 403)、その部分は検索スニペット由来=「要確認」としている。

---

## 1.「フォーティップ」という動作解析ソフトについて

**結論: 「フォーティップ」という名称の動作解析製品は確認できなかった(検索ヒットは Fortinet/Fortive 等の無関係語のみ)。**
整形外科・リハビリ文脈で該当しそうな最有力候補は **Sportip Pro(スポーティップ プロ)** で、「スポーティップ→フォーティップ」の聞き取り・表記ゆれの可能性が高い(断定はできないため、実際の製品ロゴ・画面でご確認を)。

| 項目 | 内容 |
|---|---|
| 製品名 | Sportip Pro(スポーティップ プロ) |
| 提供元 | 株式会社Sportip(筑波大学発) — https://www.sportip.jp/ |
| 価格 | **非公開・要問い合わせ**(申込後1週間無料の記載: https://orgo.co.jp/media/sportip/ ・ https://wellup.jp/healthcheck/sportip.php) |
| 機能 | スマホ/タブレット撮影の画像・動画からAIで姿勢・歩行・関節可動域(ROM)・トレーニングフォーム等を解析。リハビリ業務支援(関連: Rihacare, Sportip Motion) |
| プラットフォーム | iOSアプリ(App Store id1513931447) |
| 医療機器認証 | 公開情報で**確認できず(未確認)** |

他の国産候補(音韻的にはより遠い): VisionPose、ゆがみーるクラウド、シセイカルテ、リハサク 等。

## 2. 既存の角度計測・動作解析ソフト比較

医療機器認証は、下記いずれも公開情報からは**明示確認できず(未確認)**。

| 名称 | 提供元 | 価格 | プラットフォーム | 主な機能 | 出典 |
|---|---|---|---|---|---|
| Goniometer Pro 等のゴニオメーターアプリ | 各開発元 | 未確認(無料/有料混在) | iPhone/iPad | 端末センサ・カメラで関節角度計測 | https://apps.apple.com/us/app/goniometer-pro/id6444093932 ・ 妥当性: [PMID 27632853](https://pubmed.ncbi.nlm.nih.gov/27632853/) |
| **Kinovea** | OSS | **無料** | Windows | 2D動画解析(角度・距離・時間・点追跡)。スポーツ/リハで定番 | https://www.kinovea.org/ |
| **ImageJ / Fiji** | NIH ほか(OSS) | **無料** | Win/Mac/Linux | 画像の角度・距離計測、追跡プラグイン | https://imagej.net/ |
| **Tracker** | Open Source Physics(OSS) | **無料** | Win/Mac/Linux | 動画解析・分度器ツール | https://opensourcephysics.github.io/tracker-website/ |
| **OpenCap** | Stanford大 | **無料** | Web + iPhone 2台 | マーカーレス**3D**キネマティクス・筋骨格動力学。従来型ラボの1%未満のコストと報告 | [PLOS Comput Biol 2023, DOI:10.1371/journal.pcbi.1011462](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1011462) |
| Sportip Pro | (株)Sportip | 非公開 | iOS | 上記セクション1参照 | https://www.sportip.jp/ |
| VisionPose | (株)ネクストシステム | 非公開・要問い合わせ | Windows SDK | AI骨格検出エンジン(約30キーポイント/最大60fps)。医療・リハ・スポーツ向け | https://www.next-system.com/visionpose |

### 姿勢推定ライブラリのライセンス(自作時の選択肢)

| ライブラリ | ライセンス | 出典 |
|---|---|---|
| **Google MediaPipe** | **Apache-2.0(商用可)** ← 本アプリで採用 | https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE |
| OpenPose(CMU) | 非商用・学術のみ無償。商用は年額 USD 25,000 との報告、スポーツ分野不可の条項 | https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/LICENSE |
| MoveNet(TensorFlow) | TensorFlow配布は Apache-2.0(モデルカード原文は**要確認**) | https://en.wikipedia.org/wiki/TensorFlow |

`@mediapipe/tasks-vision` の最新版は **1.0.1**(2026-08-06時点、npmレジストリで確認)。

## 3. 参考可動域角度の照合状況(重要)

日本整形外科学会・日本リハビリテーション医学会「関節可動域表示ならびに測定法」(2022年4月改訂)の一次資料は、調査環境からはすべて **HTTP 403 で機械取得できず本文未照合**。

一次資料(利用者自身での確認を推奨):
- J-STAGE 本文: https://www.jstage.jst.go.jp/article/jjrmc/58/10/58_58.1188/_article/-char/ja/ (DOI: 10.2490/jjrmc.58.1188)
- 両学会連名資料(日本スポーツ協会掲載PDF): https://jspo.jp/pdf/rangeofmotion2022.pdf
- 日本リハビリテーション医学会 告知: https://www.jarm.or.jp/member/kadou.html

二次情報(検索スニペット)で得られた一般的な値 — **全体を「要確認」扱い**:

| 部位 | 運動 | 値(要確認) | 二次情報での一致度 |
|---|---|---|---|
| 肩 | 屈曲 180 / 伸展 50 / 外転 180 / 外旋 60 / 内旋 80 | ° | 概ね一致 |
| 肘 | 屈曲 145 / 伸展 5 | ° | **不一致あり**(146/4 という実測平均値が混在) |
| 前腕 | 回内 90 / 回外 90 | ° | **不一致あり**(87/93 が混在) |
| 手 | 背屈 70 / 掌屈 90 | ° | **不一致あり**(80/86 が混在) |
| 股 | 屈曲 125 / 伸展 15 / 外転 45 / 内転 20 | ° | 複数ソースで一致 |
| 膝 | 屈曲 130 / 伸展 0 | ° | 複数ソースで一致 |
| 足関節 | 背屈 20 / 底屈 45 | ° | 複数ソースで一致 |

→ このためアプリの参考値は**既定で空欄**とし、設定画面の一括入力ボタン(要確認と明記)+原典リンクで運用する設計にした。特に**上肢は原典照合を強く推奨**。

## 4. マーカーレス姿勢推定によるROM計測の妥当性(PubMed)

1. [PMID 39281584](https://pubmed.ncbi.nlm.nih.gov/39281584/) — Asaeda ら, Heliyon 2024. 片脚着地の膝外反角を MediaPipe vs 光学式(VICON)で比較。**絶対値誤差 18.8–19.7°と大きい**が、変化量に正規化すると信頼性・妥当性は良好。
2. [PMID 37744429](https://pubmed.ncbi.nlm.nih.gov/37744429/) — Menychtas ら, Front Rehabil Sci 2023. 高齢者歩行で OpenPose/MediaPipe vs Vicon/Kinovea。大きな運動は良好、**足関節など小さな運動はランドマーク誤認による誤差**。
3. [PMID 41755089](https://pubmed.ncbi.nlm.nih.gov/41755089/) — Ferraris ら, Sensors 2026. パーキンソン病の姿勢評価で MediaPipe vs Azure Kinect。低〜中複雑度の課題では**信頼できる代替**(ρ>0.72–0.75)。
4. [PMID 42215670](https://pubmed.ncbi.nlm.nih.gov/42215670/) — Das ら, Sci Rep 2026. 肘屈曲・膝伸展・股外旋ROMで MediaPipe+ファジィ推論 vs 光学式。**ICC 0.005–0.68とばらつき大、臨床導入は時期尚早**。

**本アプリへの反映**: AI計測は「経過記録・スクリーニング補助」と位置づけ、アプリ内・READMEに限界を明記。確定計測は手動(写真計測タブ/ゴニオメーター)を推奨。

## 5. 未確認事項まとめ

- フォーティップ=Sportip Pro は**推定**(音韻類似による最有力候補)であり確定ではない
- 商用製品の価格・医療機器認証はいずれも公開情報で未確認
- 参考可動域の数値は一次資料未照合(セクション3)
- MoveNet のモデルカード原文は未確認
