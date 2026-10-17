// Downloads the open-licence fonts the site loads from Google Fonts (latin subset) into assets/fonts/offline/ (git-ignored), so the posters look the same with no connection.
// src/local-fonts.js registers them on localhost. Run once while online, on any new machine:
//   node tools/fetch-offline-fonts.mjs
// Then check it:  NODE_PATH=$(npm root -g) node tools/offline-check.cjs slinky-type
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts', 'offline');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';   // a modern browser gets woff2
const SHEETS = [
  'https://fonts.googleapis.com/css2?family=Bungee+Inline&display=swap',
  'https://fonts.googleapis.com/css2?family=Archivo:wght@700;900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap',   // the same as index.html
];
mkdirSync(OUT, { recursive: true });
let n = 0;
for (const sheet of SHEETS) {
  const css = await (await fetch(sheet, { headers: { 'User-Agent': UA } })).text();
  for (const m of css.matchAll(/\/\* (\S+) \*\/\s*@font-face \{([\s\S]*?)\}/g)) {
    if (m[1] !== 'latin') continue;
    const family = /font-family: '([^']+)'/.exec(m[2])[1], weight = /font-weight: (\d+)/.exec(m[2])[1], url = /url\((https[^)]+)\)/.exec(m[2])[1];
    const file = `${family.toLowerCase().replace(/ /g, '-')}-${weight}.woff2`;
    writeFileSync(join(OUT, file), Buffer.from(await (await fetch(url)).arrayBuffer()));
    console.log('saved', file); n++;
  }
}
if (n !== 7) { console.error(`expected 7 files, got ${n}: has Google Fonts changed its CSS?`); process.exit(1); }
console.log('done: assets/fonts/offline/ has', n, 'files');
