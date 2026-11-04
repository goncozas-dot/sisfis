@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto node_missing

if not exist "node_modules\express\package.json" (
  echo No se encontraron las dependencias incluidas.
  echo Ejecuta npm install desde esta carpeta y vuelve a intentarlo.
  pause
  exit /b 1
)

start "" /min powershell.exe -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"
node server.js
echo.
echo El servidor se ha detenido.
pause
exit /b

:node_missing
echo SISFIS requiere Node.js 18 o posterior.
echo Se abrira la pagina oficial para instalarlo.
start "" "https://nodejs.org/"
pause
