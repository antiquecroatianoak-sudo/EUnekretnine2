#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd "$(dirname "$0")/.." && pwd)
dom_dir=${1:?Pass the directory containing pinned DOM test node_modules}
"$dom_dir/node_modules/.bin/esbuild" "$repo_root/sites-review/app/platform.tsx" --bundle --platform=node --format=esm --jsx=automatic --alias:@/lib="$repo_root/sites-review/lib" --external:react --external:react-dom --external:lucide-react --outfile="$dom_dir/app.mjs"
"$dom_dir/node_modules/.bin/esbuild" "$repo_root/sites-review/scripts/check-possible-pairs-dom.jsx" --bundle --platform=node --format=esm --jsx=automatic --external:jsdom --external:react --external:react-dom --external:./app.mjs --external:./domain-server.mjs --outfile="$dom_dir/check.mjs"
cp "$repo_root/supabase/functions/sites-platform/domain.mjs" "$dom_dir/domain-server.mjs"
cp "$repo_root/supabase/functions/sites-platform/facts.mjs" "$dom_dir/facts.mjs"
cp "$repo_root/supabase/functions/sites-platform/travel.mjs" "$dom_dir/travel.mjs"
node "$dom_dir/check.mjs"
node "$repo_root/sites-review/scripts/test-platform-route.mjs" "$dom_dir"
"$dom_dir/node_modules/.bin/esbuild" "$repo_root/sites-review/scripts/check-offer-workflow-dom.jsx" --bundle --platform=node --format=esm --jsx=automatic --alias:@/lib="$repo_root/sites-review/lib" --external:jsdom --external:react --external:react-dom --external:lucide-react --outfile="$dom_dir/offer-check.mjs"
node "$dom_dir/offer-check.mjs"
