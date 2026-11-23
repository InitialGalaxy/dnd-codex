@echo off
title Update DnD Codex
cd /d "%~dp0"
echo.
echo  Updating DnD Codex from GitHub...
echo  (Close the DnD Codex window first if it is running.)
echo  Your library, pictures, backups and passwords are not touched.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; $z=Join-Path $env:TEMP 'dndcodex-update.zip'; $d=Join-Path $env:TEMP 'dndcodex-update'; Invoke-WebRequest 'https://github.com/InitialGalaxy/dnd-codex/archive/refs/heads/main.zip' -OutFile $z -UseBasicParsing; if (Test-Path $d) { Remove-Item $d -Recurse -Force }; Expand-Archive $z $d -Force; $s=(Get-ChildItem $d -Directory | Select-Object -First 1).FullName; foreach ($f in @('DnD Codex.html','server.js','dict-en.txt','README.md','Start DnD Codex.bat','Start DnD Codex (home Wi-Fi only).bat','DnD Codex.vbs','DnD Codex.ico','Make taskbar shortcut.bat')) { $p=Join-Path $s $f; if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination . -Force } }; if (Test-Path -LiteralPath 'README.txt') { Remove-Item -LiteralPath 'README.txt' -Force }; Copy-Item -LiteralPath (Join-Path $s 'Update Codex.bat') -Destination 'Update Codex.new.bat' -Force; Remove-Item $z -Force; Remove-Item $d -Recurse -Force; Write-Host ' Updated files from GitHub.' } catch { Write-Host (' Error: ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 (
  echo.
  echo  The update did not finish. Check the internet connection and try again.
  pause
  exit /b 1
)
echo.
echo  Done! Start DnD Codex as usual.
echo.
pause
(move /y "Update Codex.new.bat" "Update Codex.bat" >nul 2>&1 & exit /b 0)
