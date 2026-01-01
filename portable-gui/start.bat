@echo off
echo Starting GitToys Portable GUI...
cd /d "%~dp0"
npm install && node server.js
pause
