#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd "$(dirname "$0")/.." && pwd)
dom_dir=${1:?Pass pinned accessibility dependency directory}
"$dom_dir/node_modules/.bin/esbuild" "$repo_root/sites-review/app/platform.tsx" --bundle --platform=node --format=esm --jsx=automatic --alias:@/lib="$repo_root/sites-review/lib" --external:react --external:react-dom --external:lucide-react --outfile="$dom_dir/accessibility-app.mjs"
"$dom_dir/node_modules/.bin/esbuild" "$repo_root/sites-review/scripts/check-accessibility-dom.jsx" --bundle --platform=node --format=esm --jsx=automatic --external:jsdom --external:react --external:react-dom --external:axe-core --external:./accessibility-app.mjs --outfile="$dom_dir/check-accessibility.mjs"
node "$dom_dir/check-accessibility.mjs"
