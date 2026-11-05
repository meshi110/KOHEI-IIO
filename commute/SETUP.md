# SETUP.md — 初回セットアップ手順（所要 約20分）

構成: iPhone(PWA) → Vercel(フロント配信+API) → Supabase(DB/認証) / Gemini API(会話・解析)

## 1. Supabase にログインユーザーを作る（3分）

プロジェクトは作成済み: `ortho-english` (imhsajhnappghezkrmre, 東京)

1. [Authentication → Users](https://supabase.com/dashboard/project/imhsajhnappghezkrmre/auth/users) → **Add user** → **Create new user**
   - 自分のメールアドレスと強いパスワード → **Auto Confirm User にチェック** → 作成
2. 第三者の登録を防ぐ: [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/imhsajhnappghezkrmre/auth/providers) → Email → **「Allow new users to sign up」をOFF**
3. [Settings → API Keys](https://supabase.com/dashboard/project/imhsajhnappghezkrmre/settings/api-keys) で **service_role キー**をコピーしておく（手順3で使う）

## 2. Gemini API キーを発行（3分）

1. [Google AI Studio](https://aistudio.google.com/apikey) → **Get API key** → キーを作成しコピー
2. **無料枠でOK**（請求先アカウントを紐付けなければ課金は発生しない）。
   - 注意: 無料枠は入力データがGoogleの品質改善に使われる規約。患者情報を話さない前提なら許容（仕様書11どおり、最終判断はユーザー）。
   - 将来、無料枠のLive API上限（同時接続・日次回数）が窮屈になったら、同じキーのプロジェクトに請求先を紐付けるだけで有料枠に切替可能。**コード変更は不要**。

## 3. Vercel にデプロイ（10分）

前提: このブランチ（claude/orthopedic-conference-english-app-d3plqi）を main にマージしておく（GitHubでPR作成→マージ）。

1. [vercel.com](https://vercel.com) にGitHubアカウントでサインアップ（無料Hobbyプラン）
2. **Add New → Project** → リポジトリ `meshi110/KOHEI-IIO` を Import
3. **Root Directory を `commute` に変更**（重要。Framework は Vite と自動認識される）
4. **Environment Variables** に以下を登録:

| 名前 | 値 |
|---|---|
| `GEMINI_API_KEY` | 手順2のキー |
| `SUPABASE_URL` | `https://imhsajhnappghezkrmre.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | 手順1-3のservice_roleキー |
| `CRON_SECRET` | ランダムな長い文字列（パスワード生成機で作る） |

   （モデル名を変えたいときだけ `GEMINI_LIVE_MODEL` / `GEMINI_TEXT_MODEL` を追加。既定は `gemini-3.8-live` / `gemini-3.8-flash`）
5. **Deploy** → 完了すると `https://〜.vercel.app` のURLが発行される

## 4. Cron（朝のブリーフィング）の確認（2分）

- Vercel の Project → **Settings → Cron Jobs** に `/api/cron/briefing`（`30 20 * * *` = JST毎日5:30。土日当番の通勤にも対応）が表示されていればOK
- 手動テスト（Macのターミナル）:
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<あなたのURL>.vercel.app/api/cron/briefing
  ```
  → `{"date":"...","results":{"<user_id>":"ok (2 stories)"}}` が返れば成功
- 注意: **Hobbyプランの Cron は指定時刻から最大約1時間遅れる**ことがある（5:30設定→最悪6:30頃生成）。6:45以降の出発なら問題なし。

## 5. モデル名の実在確認（1分・初回のみ）

Gemini のモデル名は改名が速い。初回に [AI Studio](https://aistudio.google.com/) のモデル一覧で
`gemini-3.8-live` と `gemini-3.8-flash` が存在するか確認。無ければ、表示されている現行のLive系/Flash系モデル名を
Vercel の `GEMINI_LIVE_MODEL` / `GEMINI_TEXT_MODEL` に設定して Redeploy。
（セッション開始時に500エラーが出る場合も、まずモデル名を疑う）

## 6. iPhone に入れる（2分）

1. Safari で `https://〜.vercel.app` を開き、手順1のメール/パスワードでログイン
2. 共有ボタン → **ホーム画面に追加**
3. 以後は TESTLOG.md の手順3〜6（机上→iPhone→車内→通勤）を順に実施して結果を追記

## 運用メモ

- **Supabaseの自動休止**: 無料枠は約1週間アクセスが無いと休止する。毎朝のcronが叩くので通常は休止しないが、長期休暇後はダッシュボードで Restore が必要なことがある。
- 旧テーブル `legacy_sessions` / `legacy_vocabularies` / `legacy_feedback_logs`（全て空）と旧Edge Function `api` は不要になったらダッシュボードから削除してよい。
- キー類をフロントに書かないこと（リポジトリの CLAUDE.md 参照）。
