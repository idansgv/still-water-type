// Writes one tiny share page per poster (p/<slug>/index.html) from the registry and the home page.
// Link previews (LinkedIn, X, iMessage, WhatsApp) read the HTML they are served and never run
// JavaScript, so each poster needs its own file to have its own title and description.
//
//   node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLISHED as POSTERS } from '../src/posters/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const home = readFileSync(join(root, 'index.html'), 'utf8');
const ORIGIN = 'https://idansegev.com';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

for (const p of POSTERS) {
  const url = `${ORIGIN}/p/${p.slug}/`;
  const title = `${p.title} · Idan Segev`;
  const image = existsSync(join(root, 'assets', `og-${p.slug}.png`)) ? `${ORIGIN}/assets/og-${p.slug}.png` : `${ORIGIN}/assets/og.png`;
  let html = home
    .replace('<html lang="en">', `<html lang="en" data-poster="${p.slug}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(p.blurb)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(p.blurb)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(p.blurb)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${image}$2`);
  const dir = join(root, 'p', p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  console.log('wrote p/' + p.slug + '/index.html');
}
