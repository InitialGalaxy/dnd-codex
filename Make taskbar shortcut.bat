@echo off
title Make DnD Codex shortcut
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Location).Path; $w=New-Object -ComObject WScript.Shell; $made=@(); foreach ($f in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) { $s=$w.CreateShortcut((Join-Path $f 'DnD Codex.lnk')); $s.TargetPath=(Join-Path $env:WINDIR 'System32\wscript.exe'); $s.Arguments='\"'+(Join-Path $d 'DnD Codex.vbs')+'\"'; $s.WorkingDirectory=$d; $s.IconLocation=(Join-Path $d 'DnD Codex.ico')+',0'; $s.Description='DnD Codex'; $s.Save(); $made+=$f }; Write-Host ''; Write-Host ' Made a DnD Codex shortcut on your desktop and in the Start menu.'; Write-Host ' To pin it: right-click the desktop shortcut, choose Show more options, then Pin to taskbar.'"
echo.
pause
