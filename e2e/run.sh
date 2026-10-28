#!/usr/bin/env bash
# Browser checks of the real dashboard (e2e/README.md). Usage: e2e/run.sh <deps-dir> <artifacts-dir>
# <deps-dir>/node_modules holds esbuild, react, react-dom, lucide-react and playwright (Chromium installed).
# Needs TEST_POSTGRES_URL (psycopg, admin database) and E2E_DB_URL (postgres.js URL of the e2e_* database), PG_MODULE.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
deps=${1:?deps dir}; out=${2:?artifacts dir}; port=${E2E_PORT:-4317}
mkdir -p "$out"
NODE_PATH="$deps/node_modules" "$deps/node_modules/.bin/esbuild" "$root/e2e/entry.jsx" --bundle --platform=browser --format=esm --jsx=automatic \
 --alias:@/lib="$root/sites-review/lib" --define:process.env.NODE_ENV='"production"' --log-level=warning --outfile="$out/app.js"
db=$(node -e "console.log(new URL(process.env.E2E_DB_URL).pathname.slice(1))")
python "$root/e2e/prepare_db.py" "$db"
node "$root/e2e/server.mjs" "$out/app.js" "$port" > "$out/server.log" 2>&1 &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$port/" > /dev/null && break; sleep 0.25; done
curl -sf -X POST "http://127.0.0.1:$port/api/platform" -d '{"action":"refresh"}' > /dev/null
E2E_URL="http://127.0.0.1:$port" E2E_ARTIFACTS="$out" PLAYWRIGHT_MODULE="$deps/node_modules/playwright" node --test "$root/e2e/dashboard.test.mjs"
