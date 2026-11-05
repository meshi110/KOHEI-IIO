#!/usr/bin/env python3
"""ROMレコーダーをローカル配信する簡易サーバ。

使い方:
    python serve.py           → http://localhost:8000 で起動(ブラウザも自動で開く)
    python serve.py 8080      → ポート指定

ブラウザのカメラ(getUserMedia)は https か localhost でしか動かないため、
index.html をダブルクリック(file://)で開くとAIカメラ機能が使えません。
このスクリプト経由(localhost)なら全機能が動作します。
"""
import http.server
import mimetypes
import os
import socketserver
import sys
import webbrowser

# ES module / WASM / MediaPipeモデルを正しいMIMEで配信する
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/octet-stream", ".task")
mimetypes.add_type("application/manifest+json", ".webmanifest")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url = f"http://localhost:{PORT}/"
    print(f"ROMレコーダー: {url} で起動しました (Ctrl+C で終了)")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n終了しました")
