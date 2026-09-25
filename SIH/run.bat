@echo off
echo ========================================================
echo  Starting Audience Intelligence Telemetry Studio
echo ========================================================

cd /d "%~dp0"

echo [1/3] Ensuring TimescaleDB container is running...
docker compose up -d db

echo [2/3] Opening browser at http://localhost:8000 ...
start http://localhost:8000

echo [3/3] Launching FastAPI Web Application...
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload

pause
