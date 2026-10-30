@echo off
title Shadows of the Labyrinth - Game Server
cd /d "%~dp0"
echo Starting Shadows of the Labyrinth server...
start http://localhost:8080
node server.js
pause
