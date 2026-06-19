@echo off
REM ===== Age of Shadows - Character Generator (Windows launcher) =====
REM Double-click this file to start the generator and open it in your browser.
cd /d "%~dp0"
echo Starting the Age of Shadows character generator...
echo If your browser does not open automatically, go to:  http://localhost:8080
start "" http://localhost:8080
node serve.js
pause
