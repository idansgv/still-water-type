// Writes one tiny share page per poster (p/<slug>/index.html) from the registry and the home page.
// Link previews (LinkedIn, X, iMessage, WhatsApp) read the HTML they are served and never run
// JavaScript, so each poster needs its own file to have its own title and description.
//
//   node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTERS as ALL } from '../src/posters/index.js';
const POSTERS = ALL.filter((p) => !p.draft || p.standalone);        // the published ones, and the standalone pages (no menu, no shuffle)

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const home = readFileSync(join(root, 'index.html'), 'utf8');
const ORIGIN = 'https://idansegev.com';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

for (const p of POSTERS) {
  const url = `${ORIGIN}/p/${p.slug}/`;
  const title = `${p.title} · Idan Segev`;
  const own = existsSync(join(root, 'assets', `og-${p.slug}.png`));                  // made by tools/og-posters.cjs
  const image = own ? `${ORIGIN}/assets/og-${p.slug}.png` : `${ORIGIN}/assets/og.png`;
  const alt = own ? `${p.title}: ${p.blurb}` : null;
  // the homepage's intro paragraph is for the home page only; each share page has its own title and description
  let html = home.replace(/<p class="sr-only">[\s\S]*?<\/p>\n?/, '')
    .replace('<html lang="en">', `<html lang="en" data-poster="${p.slug}"${p.standalone ? ' data-bare' : ''}>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(p.blurb)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(p.blurb)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`)
    .replace(/(<meta property="og:image:alt" content=")[^"]*(")/, (m, a, b) => (alt ? `${a}${esc(alt)}${b}` : m))
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(p.blurb)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${image}$2`);
  const dir = join(root, 'p', p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  console.log('wrote p/' + p.slug + '/index.html');
}

// The sitemap lists the homepage and the published share pages; robots.txt allows everything and points to it.
const today = new Date().toISOString().slice(0, 10);
const urls = [`${ORIGIN}/`, ...POSTERS.filter((p) => !p.standalone).map((p) => `${ORIGIN}/p/${p.slug}/`)];
writeFileSync(join(root, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n');
writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
console.log('wrote sitemap.xml (' + urls.length + ' urls) and robots.txt');
