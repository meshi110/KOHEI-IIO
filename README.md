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
NCBI_EMAIL=あなたのメールアドレス
NCBI_API_KEY=
VAULT_DIR=~/Desktop/KOHEI-Vault
```

`NCBI_EMAIL` はNCBIの規約により必須。`NCBI_API_KEY` は任意で、設定すると10req/秒、
未設定なら3req/秒になる。
APIキーの取得: <https://account.ncbi.nlm.nih.gov/> → Account settings → API Key Management

### vaultパスの確認

**`VAULT_DIR` には必ず「Obsidianが実際に読みに行くvault」を指定する。**
別の場所に出力するとノートがObsidianに取り込まれず、検索もリンクも効かない。

iCloud Driveの「デスクトップとドキュメント」同期が有効なMacでは `~/Desktop` がiCloud上の
デスクトップを指すため、既定値のままでよい。パスが違う場合は実体パスに変える:

```
VAULT_DIR=~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/KOHEI-Vault
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

手動実行の動作確認が済んでから登録すること。

### 3-1. スクリプトに実行権限を付ける

```bash
cd ~/KOHEI-IIO
chmod +x run_weekly.sh
```

### 3-2. フルディスクアクセスを許可する(重要)

**vaultが `~/Desktop` / `~/Documents` / `~/Downloads` 配下にある場合、この設定をしないと
cronからの書き込みがmacOSのプライバシー保護でブロックされ、"Operation not permitted" で失敗する。**

1. システム設定 → プライバシーとセキュリティ → フルディスクアクセス
2. 「＋」をクリック
3. ファイル選択画面で `Command + Shift + G` を押し、`/usr/sbin/cron` と入力して開く
4. 追加された `cron` のスイッチをオンにする

`/usr/sbin` は通常のFinderでは見えないため、手順3のパス入力が必要。

### 3-3. スクリプト単体で動作確認する

```bash
./run_weekly.sh
cat logs/$(date +%Y-%m-%d).log
```

ログに「終了:」の行が出ていれば成功。

### 3-4. cronに登録する

エディタを開かずに追記する(毎週日曜 20:00 の場合):

```bash
(crontab -l 2>/dev/null; echo "0 20 * * 0 $HOME/KOHEI-IIO/run_weekly.sh") | crontab -
```

cronの書式は `分 時 日 月 曜日` で、曜日は 0=日曜, 1=月曜 ... 6=土曜。

| 実行タイミング | 記述 |
|---|---|
| 毎週日曜 20:00 | `0 20 * * 0` |
| 毎週月曜 8:00 | `0 8 * * 1` |
| 毎日 20:00 | `0 20 * * *` |

登録内容の確認:

```bash
crontab -l
```

### 3-5. 実際に発火するか確認する(推奨)

フルディスクアクセスが効いているかは、実際にcronから動かさないと確認できない。
数分後の時刻を一時的に登録して試す。

現在時刻を確認し、2〜3分後の「分」と「時」を入れて登録する:

```bash
date
```

例えば14:23なら、14:25に発火させる一時設定:

```bash
(crontab -l 2>/dev/null; echo "25 14 * * * $HOME/KOHEI-IIO/run_weekly.sh") | crontab -
```

その時刻を過ぎたらログを確認する:

```bash
cat ~/KOHEI-IIO/logs/$(date +%Y-%m-%d).log
```

「終了:」まで出ていれば成功。確認できたら一時設定を消して本設定だけにする:

```bash
crontab -l | grep -v "^25 14" | crontab -
```

### 登録内容を変更・削除したいとき

`crontab -e` は既定でviが開いて操作が難しいため、nanoを指定する:

```bash
EDITOR=nano crontab -e
```

nanoは `Control + O` → `Enter` で保存、`Control + X` で終了。

すべて削除する場合は `crontab -r`(確認なしで全消去されるので注意)。

### その他の注意点

- cronはログイン時の環境変数を引き継がない。`run_weekly.sh` は絶対パスで動き、
  python3も自動検出するようにしてある。
- 実行ログは `logs/YYYY-MM-DD.log` に残る。失敗時も残るので原因追跡に使える。
- **Macがスリープしているとcronは実行されない。** 常時起動でない場合はlaunchdの
  `StartCalendarInterval` を使う(スリープ復帰後に取りこぼし分が実行される)。

---

## 4. 出力

```
KOHEI-Vault/
  文献監視/
    人工関節/
      2026-07-25.md              週次の新着(チャンネルA∪B)
      症例報告/
        2026-07-25.md            症例報告(チャンネルC)
```

出力先フォルダは `.env` の `SUBDIR` で変えられる(既定 `文献監視/人工関節`)。

各ノートのフロントマターにタグが入るため、Obsidianのタグペインや検索から辿れる。

- 本体ノート: `文献監視` `人工関節`
- 症例報告ノート: `文献監視` `人工関節` `症例報告`

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
