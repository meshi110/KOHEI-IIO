#!/bin/bash
# 週次実行のエントリポイント(cronから呼ぶのはこれ)。
#
# cron はログイン時の環境変数を引き継がないため、絶対パスで動かす。
# ログは logs/ に日付つきで残す。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# python3 の場所は環境によって違う。必要ならここを実体パスに書き換える。
# 確認: which python3
PYTHON="${PYTHON:-/usr/bin/python3}"

LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

{
  echo "=========================================="
  echo "開始: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=========================================="
  "$PYTHON" -m arthroplasty_watch run
  echo "終了: $(date '+%Y-%m-%d %H:%M:%S')"
} >> "$LOG_FILE" 2>&1
