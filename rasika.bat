@echo off
rem Rasika: double-click to start everything and open the app in your browser.
rem   1. Docker Desktop (Postgres, Redis, RustFS storage and the render worker run in it)
rem   2. the containers (docker compose up -d)
rem   3. the web app on http://localhost:3000 (built first if it has never been built)
title Rasika
cd /d "%~dp0"

echo [1/3] Docker...
docker info >nul 2>&1
if not errorlevel 1 goto dockerup
echo       starting Docker Desktop, this can take a few minutes
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
set /a tries=0
:waitdocker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if not errorlevel 1 goto dockerup
set /a tries+=1
if %tries% lss 120 goto waitdocker
echo       Docker did not start in 10 minutes. Open Docker Desktop yourself, then run this again.
pause
exit /b 1
:dockerup

echo [2/3] Containers...
docker compose up -d
if errorlevel 1 (
  echo       docker compose failed, see the messages above.
  pause
  exit /b 1
)

echo [3/3] Web app...
curl -s -o nul http://localhost:3000 && goto open
if not exist "apps\web\.next\BUILD_ID" (
  echo       first run: building the web app
  call pnpm --filter web build
)
start "Rasika web (close this window to stop the app)" cmd /k "pnpm --filter web start -p 3000"
set /a tries=0
:waitweb
timeout /t 2 /nobreak >nul
curl -s -o nul http://localhost:3000 && goto open
set /a tries+=1
if %tries% lss 60 goto waitweb
echo       the web app did not answer on port 3000, see the "Rasika web" window.
pause
exit /b 1

:open
echo Rasika is running: http://localhost:3000
start "" http://localhost:3000
