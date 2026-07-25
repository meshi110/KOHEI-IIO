#!/bin/bash
# 週次実行のエントリポイント(cronから呼ぶのはこれ)。
#
# cron はログイン時の環境変数を引き継がず、PATHも最小限(/usr/bin:/bin)しか無い。
# そのため python3 は明示的に探し、作業ディレクトリも絶対パスで移動する。
#
# 重要(macOS): vaultが ~/Desktop, ~/Documents, ~/Downloads 配下にある場合、
# cron から書き込むには /usr/sbin/cron に「フルディスクアクセス」の許可が必要。
# 未設定だと "Operation not permitted" で失敗する。手順はREADMEを参照。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

# python3 を探す。PYTHON 環境変数で明示指定も可能。
find_python() {
  if [ -n "${PYTHON:-}" ]; then
    echo "$PYTHON"
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  for candidate in \
    /usr/bin/python3 \
    /opt/homebrew/bin/python3 \
    /usr/local/bin/python3 \
    /Library/Developer/CommandLineTools/usr/bin/python3
  do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

{
  echo "=========================================="
  echo "開始: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=========================================="

  if ! PYTHON_BIN="$(find_python)"; then
    echo "エラー: python3 が見つかりません。"
    echo "  ターミナルで 'which python3' を実行し、そのパスを"
    echo "  このスクリプトの PYTHON= に設定してください。"
    exit 1
  fi
  echo "python3: $PYTHON_BIN"

  "$PYTHON_BIN" -m arthroplasty_watch run
  echo "終了: $(date '+%Y-%m-%d %H:%M:%S')"
} >> "$LOG_FILE" 2>&1
