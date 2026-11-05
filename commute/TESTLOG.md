# TESTLOG.md — 動作確認の記録（仕様書10）

記法: ✅ 合格 / ❌ 不合格 / ⬜ 未実施（実機が必要） / 🚫 この開発環境では実施不可能

## 0. 実装時の仕様確認（2026-11-05, クラウド開発環境）

- ✅ **SDKの形状確認**: `@google/genai v2.32.0` の型定義を直接検査し、以下を確認した。
  - `ai.authTokens.create({config})`: `uses`(既定1)・`expireTime`(既定30分/最大20時間)・`newSessionExpireTime`(既定60秒)・`liveConnectConstraints{model, config}`。**「Resuming a Live API session does not count as a use.」**（uses:1 でも再接続可能）。v1alpha限定・@experimental。
  - クライアント側は `new GoogleGenAI({apiKey: token.name, httpOptions:{apiVersion:'v1alpha'}})`。
  - `LiveConnectConfig`: `systemInstruction` / `inputAudioTranscription` / `outputAudioTranscription` / `contextWindowCompression{slidingWindow}` / `sessionResumption{handle}` あり。
  - `LiveServerMessage`: `serverContent{modelTurn, turnComplete, interrupted, generationComplete, inputTranscription{text,finished}, interimInputTranscription, outputTranscription}` / `goAway{timeLeft}` / `sessionResumptionUpdate{newHandle, resumable}`。
  - `session.sendRealtimeInput({audio:{data,mimeType}} | {text})`。
- 🚫 **ai.google.dev の直接閲覧**: この開発環境からはDNS遮断で不可。モデル名は WebSearch で確認：公式モデルページ最新は `gemini-3.8-live`（`gemini-3.1-flash-live-preview` はlegacy表示）、テキストは `gemini-3.8-flash`。ソース間に鮮度差があるため**両方とも環境変数で差し替え可能**にした。→ 初回デプロイ時に AI Studio で実在確認すること（SETUP.md 手順5）。
- ✅ **エフェメラルトークンの設計判断**: `liveConnectConstraints` はモデルのみ固定し、config は固定しない（sessionResumption の handle が再接続ごとに変わるため、config固定は再接続と干渉する恐れ。仕様書3からの意図的な変更）。

## 1. ユニットテスト（31件 全通過・このリポジトリで再現可能）

```
cd commute && npm test
```

- ✅ `leitner.test.ts`（7件）: box遷移（正解+1/上限5/不正解=1）、間隔1/2/4/7/14日、JST日付境界（UTC前日15:30→JST当日）、月またぎ加算
- ✅ `metrics.test.ts`（4件）: 語数・ターン数の実データ計算、duration（欠損・負値は null — 仕様書4「計算できない値は null」）
- ✅ `verify.test.ts`（6件）: said照合 — 完全一致採用／大文字小文字・句読点・アポストロフィのゆらぎ吸収／AI発話からの引用は不採用／捏造引用は不採用（仕様書9）
- ✅ `liveTurns.test.ts`（6件）: turnComplete で user→ai 順に確定・seq連番／interrupted で再生キュー破棄＋AI途中発話の確定／音声データの再生キュー投入／短い "Finish" で自動終了・長文中の finish では誤発火しない／resumableハンドル保持
- ✅ `streak.test.ts`（8件）: 平日ストリーク — 週末スキップ（金→月は連続）／今日未実施でも維持／抜けで停止

## 2. ビルド・スモーク（このリポジトリで再現可能）

- ✅ `npm run build`（tsc strict + vite）通過
- ✅ Chromiumスモーク: 起動→ログイン画面描画→誤認証でエラー表示、コンソールエラーなし
- 🚫 Supabase への実通信: 開発サンドボックスの外向き遮断により「Failed to fetch」まで確認（＝エラーハンドリング経路は検証済み）。**実疎通は手順3の初回ログインで確認する**

## 3. 机上テスト（Mac + イヤホン）⬜ ユーザー実施

SETUP.md 完了後、Macのブラウザで本番URLを開いて：

- ⬜ ログインできる（＝Supabase疎通OK）
- ⬜ Start → AIが挨拶→復習（カードがあれば）→ニュースの順で話し始める
- ⬜ こちらの発話に応答する／"Repeat"・"Slower"・"Wait"→"Go" が効く
- ⬜ End → 「保存・解析中…」→ 完了画面に要約・指摘・新カード・ストリークが出る
- ⬜ 履歴タブにセッション・弱点・カードが表示される
- ⬜ 翌朝、冒頭で前日のカードがクイズに出る（＝1サイクル完成）

## 4. iPhoneテスト（停車中）⬜ ユーザー実施

- ⬜ ホーム画面に追加したPWAでマイク許可が出る・会話できる
- ⬜ 会話中に画面が消灯しない（Wake Lock）。消灯する場合は iOS 設定の自動ロックを「なし」に
- ⬜ 画面を手で消した場合の挙動（復帰後に再接続するか）を記録する

## 5. 車内テスト（駐車中）⬜ ユーザー実施

- ⬜ Bluetooth/CarPlay 接続中、マイクが iPhone側か車側か（コントロールセンターで確認）
- ⬜ エコー（AIの声をマイクが拾って自分で割り込む現象）の有無 — 発生したら音量を下げる/iPhoneマイクに切替
- ⬜ ロードノイズ想定での聞き取り精度、応答遅延の体感

## 6. 通勤での初回使用 ⬜ ユーザー実施

- ⬜ 約10分ごとの再接続が自動で行われる（チャイム音のみで会話が続く）
- ⬜ 30分間、操作なしで完走する
- ⬜ 下車後の解析結果が妥当（言っていないミスを指摘されていないか＝said照合の実地確認）

結果はこのファイルに追記してください（✅/❌と日付、気づいたこと）。
