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
| 所在地 | 〒113-0033 東京都文京区本郷4-1-4 Design Place α 7階(**利用者提供の情報**。本調査での独自確認は未実施) |
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

## 5. MMT(徒手筋力テスト)の基準

### 5-1. ISNCSCI の key muscle function(髄節と筋の対応)

ASIA/ISCoS International Standards Worksheet (2019)、SCIRE Project(UEMS/LEMS)、Kirshblum SC et al. ([PMID 22330108](https://pubmed.ncbi.nlm.nih.gov/22330108/)) で内容の一致を確認。

| 髄節 | Key muscle function | 主な筋 | テスト動作 |
|---|---|---|---|
| C5 | Elbow flexors | 上腕二頭筋・上腕筋 | 肘関節屈曲(前腕回外位) |
| C6 | Wrist extensors | 長・短橈側手根伸筋 | 手関節背屈 |
| C7 | Elbow extensors | 上腕三頭筋 | 肘関節伸展 |
| C8 | Finger flexors | 中指の深指屈筋 | 中指DIP屈曲 |
| T1 | Small finger abductors | 小指外転筋 | 小指の外転 |
| L2 | Hip flexors | 腸腰筋 | 股関節屈曲 |
| L3 | Knee extensors | 大腿四頭筋 | 膝関節伸展 |
| L4 | Ankle dorsiflexors | 前脛骨筋 | 足関節背屈 |
| L5 | Long toe extensors | 長母趾伸筋 | 母趾IP関節伸展 |
| S1 | Ankle plantar flexors | 腓腹筋・ヒラメ筋 | 足関節底屈 |

補足: 2011年改訂以降、正式には "key muscle **functions**"(キー筋機能)と呼ぶ。L4(前脛骨筋)は解剖学的にL4/L5の二重支配であり、ISNCSCIの割り当ては「代表的キー筋機能」としてのもの。UEMS(上肢)50点・LEMS(下肢)50点・Total Motor Score 100点満点。運動評価は仰臥位が標準。

### 5-2. グレード定義(ISNCSCI運動スコア)

0=完全麻痺 / 1=触知・視認できる収縮 / 2=重力除去下で全可動域 / 3=重力に抗して全可動域 / 4=重力＋中等度抵抗に抗して全可動域 / 5=重力＋最大抵抗に抗して全可動域(正常) / NT=検査不能

MRCスケール(0〜5)も同等の段階構成。初出は1943年 *Aids to the Investigation of Peripheral Nerve Injuries* (War Memorandum No.7)、[MRC Muscle Scale (UKRI)](https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-muscle-scale/)。

### 5-3. 「4+」「3−」等の中間表記について(設計判断の根拠)

- **ISNCSCIでは「0〜5で採点し、プラス・マイナスは付けない」と規定**(SCIRE・Physiopedia等で一致。ASIA公式PDF原本の逐語確認は**未実施**)
- MRC自身も1974年の続編でgrade 4の細分化(slight/moderate/strong resistance)を提案したが、各段階が**定義されていない**
- grade 4 は筋力スペクトラムの最大96%を占めうるとの指摘があり、grade 4・5 は本質的に主観的
- **「4+」を追加しても評価者間一致は改善しない**: 標準MRC 一致率64% vs 修正(4+あり)48%、Fleiss κ 0.02 vs 0.13(いずれも不良) — Nielsen SO et al. Chiropr Man Therap 2017, [PMID 29051814](https://pubmed.ncbi.nlm.nih.gov/29051814/)(全文確認済み)
- Paternostro-Sluga et al. 2008でも、±付き修正スケールは完全一致35.9%にとどまる ([DOI 10.2340/16501977-0235](https://doi.org/10.2340/16501977-0235))

→ **本アプリの設計**: 通常モードでは慣用の±を使えるようにし、設定の「ISNCSCI準拠モード」で±を無効化してUEMS/LEMS合計を表示する二段構えとした。

## 6. 音声入力(Web Speech API)の仕様とプライバシー

| 項目 | 内容 | 出典 |
|---|---|---|
| **音声の送信** | 「Chromeなどの一部ブラウザでは、Webページ上の音声認識はサーバーベースの認識エンジンを用いる。**あなたの音声はWebサービスに送信され**認識処理される。そのためオフラインでは動作しない」 | [MDN: Using the Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API) |
| **端末内処理** | `processLocally = true` で端末内処理を強制でき、その場合「音声も文字起こし結果も第三者サービスに送信されない」。**既定は false**(＝リモート処理が許容される) | [MDN: processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally) |
| **可否の照会** | `SpeechRecognition.available({langs, processLocally})` / `install()` で言語パックを取得 | [Chrome Status](https://chromestatus.com/feature/6090916291674112) |
| **Safari** | Safari 14.1 / iOS 14.5 以降で対応(webkit接頭辞、Siri有効化が必要)。「Siriと同じエンジン」との記載はあるが、**Web APIの音声がAppleサーバーへ送信されるかは公式情報で確認できず(未確認)** | [WebKit Blog](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/) |
| **Firefox** | **非対応** | MDN Baseline判定 |
| **HTTPS** | HTTPS配信では権限が永続化、HTTP配信では毎回要求。localhostは開発用に可 | [Chrome for Developers](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api) |
| **仕様上の要求** | ユーザーのインフォームド・コンセントなしに音声をキャプチャしてはならない／中止手段・同意撤回が可能であること | [WICG Web Speech API](https://wicg.github.io/speech-api/) |

→ **本アプリの設計**: 既定オフ＋初回同意ダイアログ、端末内処理が使える環境では自動優先し画面に「🔒端末内/☁️サーバー」を表示、音声で扱うのは部位・左右・数値のみ(患者IDは画面選択)。

**未確認**: 日本語(ja-JP)のオンデバイス言語パックの提供状況、MDN互換表の具体的バージョン番号、最新ChromeがHTTPオリジンで完全にブロックするか。

## 7. 未確認事項まとめ

- フォーティップ=Sportip Pro は**推定**(音韻類似による最有力候補)であり確定ではない
- Sportipの所在地は利用者提供の情報であり、本調査での独自確認は未実施
- 商用製品の価格・医療機器認証はいずれも公開情報で未確認
- 参考可動域の数値は一次資料未照合(セクション3)
- MoveNet のモデルカード原文は未確認
- ASIA公式ワークシートPDF原本の逐語表現、および各key muscleの標準テスト肢位の詳細は未照合(セクション5)
- Safariの音声処理がローカルかサーバーかは公式情報で確認できず。医療情報を扱う判断としてはサーバー送信の可能性がある前提で運用する(セクション6)
- 日本語のMMT等級呼称(Good=「優」か「良」か等)は資料間で揺れがあるため、本アプリでは採用していない
