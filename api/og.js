// The share image for a poster with a visitor's name: /api/og?slug=<slug>&n=<name>. The name, one line per word, in the poster's
// face (registry `face`, fetched from Google Fonts as a subset of just these letters), black on white, the poster's title small below.
// Only for posters that take a name; anything else is a 404. Cached hard: the same name always draws the same picture.
import { ImageResponse } from '@vercel/og';
import { bySlug } from '../src/posters/index.js';
import { validateName } from '../src/name.js';

const W = 1200, H = 630;
const fonts = new Map();
async function face(family, weight, italic, text) {
  const key = `${family}|${weight}|${italic}|${text}`;
  if (!fonts.has(key)) {
    const axes = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${axes}&text=${encodeURIComponent(text)}`)).text();
    const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    if (!url) throw new Error(`no ${family} for this text`);
    fonts.set(key, await (await fetch(url)).arrayBuffer());
  }
  return fonts.get(key);
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const poster = bySlug(q.get('slug') || '');
  const { name } = validateName(q.get('n'));
  if (!poster || !poster.nameable || !name) return new Response('Not found', { status: 404 });

  const { family = 'Bitter', weight = 400, italic = false, upper = false } = poster.face || {};
  const lines = (upper ? name.toLocaleUpperCase() : name).split(' '), foot = `${poster.title} · idansegev.com`;
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.round(Math.min((H * 0.7) / (lines.length * 1.02), (W * 0.84) / (longest * (upper ? 0.72 : 0.56))));
  let font = [];
  try { font = [{ name: family, data: await face(family, weight, italic, lines.join('') + foot), weight: 400, style: 'normal' }]; } catch (e) { /* the built-in face */ }

  const ink = poster.darkOnly ? '#fff' : '#000', page = poster.darkOnly ? '#000' : '#fff';   // a poster that only exists on black shares on black
  const el = (type, style, children) => ({ type, props: { style, children } });
  const tree = el('div', { width: W, height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: page, color: ink, fontFamily: family, position: 'relative' }, [
    ...lines.map((l) => el('div', { fontSize: size, lineHeight: 1.02, letterSpacing: '-0.01em' }, l)),
    el('div', { position: 'absolute', left: 40, bottom: 30, fontSize: 22, color: '#767676' }, foot),
  ]);
  return new ImageResponse(tree, { width: W, height: H, fonts: font, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' } });
}
