#!/usr/bin/env bash
# Rebuilds the Moovit case study (the React port in ~/Documents/Coding/portfolio/app) and vendors the
# result into work/moovit/. The source repo is never touched: everything is patched in a scratch copy.
#
#   tools/sync-moovit.sh [path/to/portfolio/app]
#
# Patches applied to the scratch copy only:
#   - asset URLs honour Vite's base path, so the case can live at /work/moovit/
#   - Leida (the serif) is NOT shipped: its licence is unconfirmed, so the serif roles fall back to Georgia.
#     To ship it once licensed: set USE_SELF_HOSTED back to true, drop the three woff2 files into
#     work/moovit/fonts/, and the case picks them up.
#   - the case's old Readymag / idansegev.com/teaching links point at /work/
#   - share metadata and a way back to the index are added to the page head/body
set -euo pipefail

SRC="${1:-$HOME/Documents/Coding/portfolio/app}"
SITE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

rsync -a --exclude node_modules --exclude verify-out --exclude compare-out --exclude fonts-src \
  --exclude public/fonts --exclude scripts "$SRC/" "$TMP/"
ln -s "$SRC/node_modules" "$TMP/node_modules"

sed -i '' 's|`/assets/${name}`|`${import.meta.env.BASE_URL}assets/${name}`|' "$TMP/src/components/Widget.tsx"
sed -i '' 's|export const USE_SELF_HOSTED = true|export const USE_SELF_HOSTED = false|' "$TMP/src/engine/fonts.ts"
for f in "$TMP/src/data/content.json" "$TMP/src/data/additions.ts"; do
  sed -i '' 's|https://readymag.com/u22433248/pastwork/|/work/|g; s|https://idansegev.com/teaching|/work/|g' "$f"
done

python3 - "$TMP/index.html" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
head = '''    <meta name="description" content="Moovit: design strategy, accessibility and community for a 400M-user urban mobility app. A case study by Idan Segev." />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Idan Segev" />
    <meta property="og:title" content="Moovit · Idan Segev" />
    <meta property="og:description" content="Design strategy, accessibility and community for a 400M-user urban mobility app." />
    <meta property="og:url" content="https://idansegev.com/work/moovit/" />
    <meta property="og:image" content="https://idansegev.com/assets/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <style>.site-back{position:fixed;left:16px;top:12px;z-index:9999;font:500 12px/1 "IBM Plex Mono",ui-monospace,Menlo,monospace;color:#fff;mix-blend-mode:difference;text-decoration:none;padding:8px 0}.site-back:hover{text-decoration:underline}</style>
'''
s = s.replace('<title>Moovit — Idan Segev</title>', '<title>Moovit · Idan Segev</title>\n' + head)
s = s.replace('<div id="root"></div>', '<a class="site-back" href="/work/">&larr; Work</a>\n    <div id="root"></div>')
open(p, 'w').write(s)
EOF

(cd "$TMP" && npx --no-install vite build --base=/work/moovit/)

rm -rf "$SITE/work/moovit"
mkdir -p "$SITE/work/moovit"
cp -R "$TMP/dist/." "$SITE/work/moovit/"
echo "Moovit synced into work/moovit ($(du -sh "$SITE/work/moovit" | cut -f1))"
