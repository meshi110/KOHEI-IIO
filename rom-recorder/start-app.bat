@echo off
rem ROMレコーダーをローカルで起動します(Windows用)
cd /d "%~dp0"
where py >nul 2>nul && (py serve.py) || (python serve.py)
pause
