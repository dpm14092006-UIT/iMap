#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Cần cài Node.js >= 20.19"; exit 1; }
command -v npm >/dev/null || { echo "Không tìm thấy npm"; exit 1; }
if [ ! -d node_modules ]; then
  echo "Đang cài thư viện lần đầu..."
  npm install
fi
printf '\nRouteTwin API: http://localhost:4000/api/health\nRouteTwin Web: http://localhost:5173\n\n'
npm run dev
