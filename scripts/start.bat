@echo off
rem Khoi chay MS Hub tren Windows - tu cai dependencies va build neu thieu.
cd /d "%~dp0.."

if not exist server\node_modules (
  echo [MS Hub] Cai dependencies server...
  call npm install --prefix server || goto :err
)
if not exist web\node_modules (
  echo [MS Hub] Cai dependencies web...
  call npm install --prefix web || goto :err
)
echo [MS Hub] Kiem tra / tai Chromium cho trinh duyet nhung...
call npx --prefix server playwright install chromium

if not exist web\dist\index.html (
  echo [MS Hub] Build giao dien...
  call npm run build --prefix web || goto :err
)

echo [MS Hub] Khoi dong - http://localhost:3689
node server\src\index.js
goto :eof

:err
echo [MS Hub] Loi cai dat. Kiem tra Node.js ^>= 20 da duoc cai chua: https://nodejs.org
pause
