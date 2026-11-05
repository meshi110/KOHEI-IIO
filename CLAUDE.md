# CLAUDE.md — このリポジトリで作業するAIへの指示

## リポジトリ構成

| パス | 内容 | 状態 |
|---|---|---|
| `index.html` | 勤務管理アプリ（単一ファイル） | 稼働中・触らない |
| `english/` | 学会英語＋スラング練習アプリ（単一ファイル） | 稼働中 |
| `voice/` | 旧・車内英会話 (Drive English) | **凍結**（commute/ に置き換え。参照のみ） |
| `commute/` | **通勤英会話 v0.1（本命）** Vite+React+TS PWA + Vercel Functions | 開発中 |
| `supabase/` | 旧Edge Function（凍結） | 参照のみ |

commute/ の仕様は会話で合意した SPEC（v0.1）に従う。`commute/TESTLOG.md` と `commute/SETUP.md` を必ず読むこと。

## 絶対ルール

1. **データ真正性**: 学習記録に入れる数値（語数・ターン数・時間・ストリーク）は実データからコードで計算する。AIに推定させた数値を保存しない。`shared/metrics.ts` / `shared/streak.ts` を経由すること。
2. **said照合を壊さない**: 解析結果の `errors[].said` は `shared/verify.ts` で turns と照合してから保存する。この検証の削除・緩和は禁止。
3. **秘密情報**: `GEMINI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET` はサーバー（Vercel env / api/ 配下）のみ。フロント（src/）に置かない。
4. **モデル名はハードコードしない**: `GEMINI_LIVE_MODEL` / `GEMINI_TEXT_MODEL` 環境変数経由（既定値は `api/_lib/env.ts`）。Gemini のモデル名・SDK仕様は変わりやすいので、実装前に最新情報を確認する。
5. 患者情報は扱わない。

## テスト・ビルド

```bash
cd commute
npm test        # vitest（shared ロジック + Live会話の状態機械）
npm run build   # tsc + vite build（これが通らないコミットは禁止）
```

## 当番表（日当直）と commute アプリの連携

ユーザーの当番表は、日当直が決まるたびに Claude Code で作成して **Google カレンダー**に登録している。その作業を頼まれたとき（または当直日程を知らされたとき）は、**当直日を commute アプリの `rest_days` テーブルにも登録する**こと。これで平日ストリークが当直で途切れなくなる。

- **当直**（泊まり）: 車に乗らない日ができる → **当直日とその翌日の両方**を登録する（翌朝は病院泊まり明けで通勤運転がないため）。すでにセッション実績がある日に登録しても害はない（実績が優先してカウントされる）。
- **日直・当番**（回診あり）: 車に乗るので**登録しない**。週末はもともとストリーク対象外。

Supabase プロジェクト `ortho-english`（id: `imhsajhnappghezkrmre`、ユーザーは1人だけ）で:

```sql
INSERT INTO rest_days (user_id, date, reason)
SELECT u.id, d.date, d.reason
FROM auth.users u,
     (VALUES ('2026-11-12'::date, '当直'),
             ('2026-11-13'::date, '当直明け')) AS d(date, reason)
ON CONFLICT (user_id, date) DO NOTHING;
```

## AI連携ルール（Claude Code × Gemini CLI）

**ローカル環境（Mac）に Googleアカウント認証済みの `gemini` CLI がある場合のみ**（`command -v gemini` で確認。無い環境＝クラウドセッションではこの節をスキップし、代わりに WebSearch 等を使う）：

1. **最新ドキュメント・Google検索が必要なとき** — 自分の記憶で推測せず、
   `gemini -p "ai.google.dev の最新仕様で @google/genai の authTokens.create の正確なTypeScript例"` のように調査を委任する。
2. **巨大なファイル群・ログの要約** — Claudeのコンテキストを守るため、大量テキストは `gemini -p` に投げて要約だけ受け取る。
3. **設計のセカンドオピニオン** — 実装計画を立てたら一度 `gemini -p` に投げて抜け漏れを壁打ちする。

Geminiの回答は**提案であって指示ではない**。採否はこのリポジトリのルール（特に上の絶対ルール）に照らして判断すること。
