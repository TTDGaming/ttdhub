#!/usr/bin/env bash
# Khởi chạy MS Hub trên Linux/macOS — tự cài dependencies và build nếu thiếu.
set -e
cd "$(dirname "$0")/.."

if [ ! -d server/node_modules ]; then
  echo "[MS Hub] Cài dependencies server..."
  npm install --prefix server
fi
if [ ! -d web/node_modules ]; then
  echo "[MS Hub] Cài dependencies web..."
  npm install --prefix web
fi
if ! npx --prefix server playwright install --dry-run chromium >/dev/null 2>&1; then
  echo "[MS Hub] Tải Chromium cho trình duyệt nhúng..."
  npx --prefix server playwright install --with-deps chromium || npx --prefix server playwright install chromium
fi
if [ ! -f web/dist/index.html ]; then
  echo "[MS Hub] Build giao diện..."
  npm run build --prefix web
fi

echo "[MS Hub] Khởi động — http://localhost:${PORT:-3689}"
exec node server/src/index.js
