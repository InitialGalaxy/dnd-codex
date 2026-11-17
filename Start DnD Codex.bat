@echo off
title DnD Codex
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   DnD Codex needs Node.js, which is not installed on this computer yet.
  echo   Install the LTS version from https://nodejs.org ^(the page is opening now^),
  echo   then double-click "Start DnD Codex" again.
  echo.
  start "" https://nodejs.org/
  pause
  exit /b
)
node server.js
echo.
echo   The codex has stopped.
pause
