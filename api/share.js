// A shared link with a visitor's name (/p/<slug>/?n=<name>, sent here by vercel.json): the poster's own share page, with the name in
// its title and a preview image that shows it. Link previews never run JavaScript, so this is the only way the name reaches them.
// The page itself is unchanged: the shell reads ?n= and the poster draws the name. Links without a name never come here.
import { bySlug } from '../src/posters/index.js';
import { validateName } from '../src/name.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const meta = (html, re, value) => html.replace(re, `$1${esc(value)}$2`);

export async function GET(request) {
  const url = new URL(request.url), q = url.searchParams;
  const slug = q.get('slug') || '', poster = bySlug(slug);
  const page = await fetch(new URL(`/p/${encodeURIComponent(slug)}/`, url.origin));   // the static share page (no ?n=, so not this function again)
  let html = await page.text();
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=86400' };
  const { name } = validateName(q.get('n'));
  if (!page.ok || !poster || !poster.nameable || !name) return new Response(html, { status: page.status, headers });

  const n = encodeURIComponent(name), title = `${name} · ${poster.title}`;
  const link = `${url.origin}/p/${slug}/?n=${n}`, image = `${url.origin}/api/og?slug=${slug}&n=${n}`;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = meta(html, /(<meta property="og:title" content=")[^"]*(")/, title);
  html = meta(html, /(<meta name="twitter:title" content=")[^"]*(")/, title);
  html = meta(html, /(<meta property="og:url" content=")[^"]*(")/, link);
  html = meta(html, /(<meta property="og:image" content=")[^"]*(")/, image);
  html = meta(html, /(<meta name="twitter:image" content=")[^"]*(")/, image);
  html = meta(html, /(<meta property="og:image:alt" content=")[^"]*(")/, `${name}, set as the poster ${poster.title}`);
  return new Response(html, { headers });
}
