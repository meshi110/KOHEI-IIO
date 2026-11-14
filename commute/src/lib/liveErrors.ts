// Gemini Live の接続エラーを、画面に出せる日本語にする。
//
// 2026-11-12〜14 の障害では、実際の原因（前払いクレジット枯渇: 402 / RESOURCE_EXHAUSTED）が
// 画面に出ず「切断されました」「発話がなかった」に置き換わり、原因特定に時間がかかった。
// 元のメッセージは必ず残し（推測で言い換えて情報を消さない）、既知の原因だけ説明を前に付ける。

export function describeLiveError(raw: string | null | undefined): string | null {
  const msg = (raw ?? "").trim();
  if (!msg) return null;
  let hint: string | null = null;
  if (/prepayment|credits? (are|is) depleted|\b402\b|billing/i.test(msg)) {
    hint = "Gemini API のクレジット残高がありません。AI Studio（ai.studio/projects）で入金してください。";
  } else if (/quota|RESOURCE_EXHAUSTED|\b429\b|rate limit/i.test(msg)) {
    hint = "Gemini API の利用上限（クォータ）に達しました。";
  } else if (/api key|permission|unauthori[sz]ed|\b40[13]\b|PERMISSION_DENIED/i.test(msg)) {
    hint = "Gemini API の認証・権限エラーです。";
  } else if (/not found|\b404\b|model/i.test(msg)) {
    hint = "Gemini のモデル名が見つからない可能性があります（GEMINI_LIVE_MODEL を確認）。";
  }
  return hint ? `${hint}（詳細: ${msg}）` : msg;
}

/** CloseEvent から、表示に使える文字列を作る（理由が空なら null） */
export function closeEventMessage(e: { code?: number; reason?: string } | null | undefined): string | null {
  if (!e) return null;
  const reason = (e.reason ?? "").trim();
  if (!reason) return null;
  return e.code != null ? `${reason} (code ${e.code})` : reason;
}
