# 人工関節(膝・肩)文献監視エージェント v1

PubMedから膝・肩の人工関節に関する新着論文を週次で取得し、Obsidian vaultにMarkdownで出力する。
**臨床判断は行わない。情報収集のみ。** LLMによる要約・評価はv1に含まない。

外部パッケージ不要(Python標準ライブラリのみ)。`pip install` は不要。

---

## 0. リポジトリを取得する(Mac側で1回だけ)

**vaultフォルダの中ではなく、別の場所にcloneする。**
vault内に置くとObsidianがコードを取り込み、`.env`(メールアドレス・APIキー)がiCloudに同期されてしまうため。

ホーム直下に置く場合:

```bash
cd ~
git clone https://github.com/meshi110/KOHEI-IIO.git
cd KOHEI-IIO
git checkout claude/joint-arthroplasty-literature-agent-9h5xm4
```

以降の作業はすべてこの `~/KOHEI-IIO` の中で行う。
別のターミナルを開き直したときは `cd ~/KOHEI-IIO` してから実行すること。

## 1. セットアップ(Mac側で1回だけ)

```bash
cp .env.example .env
open -e .env
```

`.env` を開いて最低限これだけ設定する:

```
NCBI_EMAIL=あなたのメールアドレス     # NCBI規約により必須
NCBI_API_KEY=                        # 任意。あれば10req/秒、無ければ3req/秒
VAULT_DIR=~/Desktop/Claude/文献監視エージェント
```

APIキーの取得(任意・推奨): <https://account.ncbi.nlm.nih.gov/> → Account settings → API Key Management

### vaultパスの確認

iCloud Driveの「デスクトップとドキュメント」同期が有効なMacでは `~/Desktop` がiCloud上の
デスクトップを指すため、既定値のままでよい。パスが違う場合は `.env` の `VAULT_DIR` を実体パスに変える:

```
VAULT_DIR=~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Claude/文献監視エージェント
```

設定が正しいかは次で確認できる(ネットに出ない):

```bash
python3 -m arthroplasty_watch stats
```

---

## 2. 動作確認

まず件数だけ見る(書き込みも状態更新もしない):

```bash
python3 -m arthroplasty_watch run --dry-run
```

問題なければ本番実行:

```bash
python3 -m arthroplasty_watch run
```

vaultフォルダをまだ作っていない場合は、初回だけ `--create-vault` を付ける:

```bash
python3 -m arthroplasty_watch run --create-vault
```

テスト(ネットに出ない):

```bash
python3 -m unittest discover -s tests -t .
```

---

## 3. cron登録(STEP 3)

**まだ登録していない。** 上の動作確認が済んでから登録すること。

```bash
chmod +x run_weekly.sh
crontab -e
```

毎週月曜 8:00 に実行する例(パスは実際の設置場所に置き換える):

```cron
0 8 * * 1 /Users/<ユーザ名>/<設置場所>/run_weekly.sh
```

注意点:

- cron はログイン時の環境変数を引き継がない。`run_weekly.sh` は絶対パスで動くようにしてある。
- `python3` の場所が `/usr/bin/python3` でない場合は `which python3` で確認し、
  `run_weekly.sh` の `PYTHON=` を書き換える。
- macOS では cron に「フルディスクアクセス」が必要な場合がある
  (システム設定 → プライバシーとセキュリティ → フルディスクアクセス → `/usr/sbin/cron` を追加)。
- 実行ログは `logs/YYYY-MM-DD.log` に残る。
- Macがスリープしていると cron は動かない。確実に動かしたい場合は launchd の
  `StartCalendarInterval` を使う(スリープ復帰後に実行される)。

---

## 4. 出力

```
<VAULT_DIR>/
  人工関節/
    2026-07-25.md              週次の新着(チャンネルA∪B)
    症例報告/
      2026-07-25.md            症例報告(チャンネルC)
```

同じ日に2回実行しても、1回目のノートは上書きしない
(新着があれば `2026-07-25_2.md` に書き、新着が無ければ既存を触らない)。

状態ファイルはiCloud上には置かない(同期競合を避けるため)。既定はリポジトリ内:

```
state/seen_pmids.json      取得済みPMID(差分抽出用)
state/case_reports.jsonl   症例報告の保管庫(検索用)
```

`state/` と `.env` は `.gitignore` 済み。

---

## 5. 症例報告について

症例報告はチャンネルA/Bから除外しつつ、**捨てずにチャンネルCとして別建てで保管**する。
後から「◯◯の症例報告はあるか?」を検索できる。

```bash
python3 -m arthroplasty_watch search-cases "infection"
python3 -m arthroplasty_watch search-cases "periprosthetic fracture" --limit 50
```

検索対象はタイトル・抄録・雑誌名・キーワード(大文字小文字は区別しない)。

保管庫は週次実行で少しずつ貯まる。**過去分を最初にまとめて入れたい場合**は遡り取得を使う
(過去1年の症例報告は実測281件。5年分でも1400件程度):

まず件数を確認する:

```bash
python3 -m arthroplasty_watch backfill --from 2021/01/01 --to 2026/07/25 --dry-run
```

問題なければ実行する(件数によっては数分かかる):

```bash
python3 -m arthroplasty_watch backfill --from 2021/01/01 --to 2026/07/25
```

---

## 6. 検索式(STEP 1で検証済み)

言語制限は設けない(翻訳可能なため、質の高い研究は言語を問わず取り込む)。
質の担保は「A=研究デザイン」「B=コア誌」で行う。

| チャンネル | 内容 | 過去1年の実測 |
|---|---|--:|
| A 高エビデンス | KS AND (RCT[pt] OR meta-analysis[pt] OR registry[tiab] OR survivorship[tiab]) NOT 症例報告 | 804件 |
| B コアジャーナル | KS AND (9誌) NOT 症例報告 | 1,214件 |
| C 症例報告 | KS AND case reports[pt] | 281件 |

※ 件数は2026-07-24時点でPubMedに問い合わせた実測値。日々変動する。
※ A∪Bは重複があるため単純合計より少ない。実数は初回実行時に表示される。

### STEP 1 検証結果

- MeSH 4語すべてが正式見出し語であることを確認(`[Mesh]` → `[MeSH Terms]` に解決)
- 雑誌9誌すべてが正式NLM略称であることを確認(`[ta]` → `[Journal]` に解決)
- 「Knee」は誌名 *The Knee* であることをレコードのメタデータで確認
- KSの全tiab語(12語)・チャンネルAの全フィルタ語が0件でないことを確認(静かな0件なし)

検索式を変更した場合は、同じ検証(各語の単体件数確認)をやり直すこと。
検索式は `arthroplasty_watch/queries.py` にある。実際に使った式は毎回ノート末尾にも記録される。

---

## 7. 厳守事項と、その実装

| 方針 | 実装 |
|---|---|
| abstractは原文をそのまま保存する。要約・改変・翻訳をしない | XMLのテキストをそのまま保持。構造化ラベル(BACKGROUND等)も収載データの一部として保持。原語抄録(OtherAbstract)も翻訳せず別掲 |
| PubMedから取得していない数値・記述を一切生成しない | ノートに書く件数はすべてesearch/efetchの実測値。推定値は書かない |
| 取得失敗時は空欄にせず「取得失敗」と明記する | 取得失敗は `取得失敗`。元データに項目が無い場合は `記載なし(PubMed収載データに該当項目なし)` として区別する(DOIの無い論文を「取得失敗」と書くのは事実に反するため) |
| 各記事に必ずPMIDを付す | PMIDの無いレコードは取り込まない。取得失敗時もPMIDだけは必ず記載する |

取得に失敗したPMIDは「取得済み」として記録しないため、次回実行時に自動で再取得を試みる。

### NCBI規約への対応

- 全リクエストに `tool=` と `email=` を付与
- APIキーありで10req/秒、なしで3req/秒を超えない(実効9.0/2.8req/秒で上限に触れない)
- 429/5xxは指数バックオフ(1秒→2秒→4秒→8秒)で最大4回リトライ

---

## 8. コマンド一覧

| コマンド | 用途 |
|---|---|
| `python3 -m arthroplasty_watch run` | 週次取得 |
| `python3 -m arthroplasty_watch run --dry-run` | 件数だけ確認 |
| `python3 -m arthroplasty_watch run --reldate 30` | 直近30日で取得 |
| `python3 -m arthroplasty_watch backfill --from 2021/01/01 --to 2026/07/25` | 遡り取得 |
| `python3 -m arthroplasty_watch search-cases "検索語"` | 症例報告の検索 |
| `python3 -m arthroplasty_watch stats` | 現在の状態 |

### 注意: コマンドをコピーするとき

macOSの既定シェル(zsh)は対話モードで行末の `#` をコメントとして扱わない。
`コマンド  # 説明` の形をそのまま貼ると、説明文がコマンドの引数として渡されて失敗する。
このREADMEのコマンドは注記を付けていないので、そのまま貼って問題ない。
