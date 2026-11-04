// The site's share image (assets/og.png, 1200 x 630): "Idan Segev" with every letter cut from a different poster's share image,
// so the preview says what the site does: same name, a different poster every visit. Run tools/og-posters.cjs first; the letters
// come from those captures. The letter-to-poster map is fixed, so the image only changes when a source capture does.
//   NODE_PATH=$(npm root -g) node tools/og-ransom.cjs
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { serve } = require('./lib-serve.cjs');
const W = 1200, H = 630;
// [line][letter] -> poster slug. Neighbours differ in weight and style so every cut reads.
const MAP = [['collapse', 'explode', 'fontapalloza', 'metal'], ['slinky-type', 'soft-type', 'still-water', 'torn', 'collapse']];
const BOX = { w: 600, h: 470 };   // inside the 630 x 630 centre square, which is what WhatsApp and iMessage crop to

// Runs in the page. Finds the two text lines of each capture (the emptiest row near the middle splits them), then the letters of a
// line (runs of inked columns), and sets the chosen letters on one baseline per line.
function compose({ MAP, W, H, BOX }) {
  const load = (slug) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `/assets/og-${slug}.png`; });
  const inked = (d, i) => 255 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) > 60;
  function bbox(c, x0 = 0, y0 = 0, x1 = c.width, y1 = c.height) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let a = x1, b = y1, e = -1, f = -1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inked(d, (y * c.width + x) * 4)) { a = Math.min(a, x); b = Math.min(b, y); e = Math.max(e, x); f = Math.max(f, y); }
    return { x: a, y: b, w: e - a + 1, h: f - b + 1 };
  }
  function crop(src, r) { const c = document.createElement('canvas'); c.width = r.w; c.height = r.h; c.getContext('2d').drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); return c; }
  function lines(img) {
    const c = crop(img, { x: 0, y: 0, w: img.width, h: img.height }), ink = crop(c, bbox(c));
    const d = ink.getContext('2d').getImageData(0, 0, ink.width, ink.height).data;
    let best = Infinity, split = ink.height >> 1;
    for (let y = Math.floor(ink.height * 0.3); y < ink.height * 0.7; y++) {
      let s = 0; for (let x = 0; x < ink.width; x += 2) s += inked(d, (y * ink.width + x) * 4);
      if (s < best) { best = s; split = y; }
    }
    const top = crop(ink, { x: 0, y: 0, w: ink.width, h: split }), bot = crop(ink, { x: 0, y: split, w: ink.width, h: ink.height - split });
    return [crop(top, bbox(top)), crop(bot, bbox(bot))];
  }
  function letters(line, n) {
    const d = line.getContext('2d').getImageData(0, 0, line.width, line.height).data, runs = [];
    const col = (x) => { for (let y = 0; y < line.height; y += 2) if (inked(d, (y * line.width + x) * 4)) return true; return false; };
    for (let x = 0; x < line.width; x++) if (col(x)) { const s = x; while (x < line.width && col(x)) x++; if (x - s > line.width * 0.02) runs.push([s, x]); }
    if (runs.length !== n) throw new Error(`found ${runs.length} letters, expected ${n}`);
    return runs.map(([a, b]) => crop(line, { x: a, y: 0, w: b - a, h: line.height }));
  }
  return (async () => {
    const cache = {};
    const glyphs = [];
    for (let l = 0; l < MAP.length; l++) {
      glyphs.push([]);
      for (let i = 0; i < MAP[l].length; i++) {
        const slug = MAP[l][i];
        cache[slug] = cache[slug] || lines(await load(slug));
        glyphs[l].push(letters(cache[slug][l], MAP[l].length)[i]);
      }
    }
    // Set each line at a common cap height, then scale the whole name into BOX and centre it.
    const LH = 200, GAP = 12, LEAD = 30;
    const sized = glyphs.map((row) => row.map((g) => ({ g, w: g.width * LH / g.height })));
    const widths = sized.map((row) => row.reduce((s, x) => s + x.w, 0) + GAP * (row.length - 1));
    const nameW = Math.max(...widths), nameH = LH * 2 + LEAD, k = Math.min(BOX.w / nameW, BOX.h / nameH);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const ctx = out.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.imageSmoothingQuality = 'high';
    let y = (H - nameH * k) / 2;
    sized.forEach((row, l) => {
      let x = (W - widths[l] * k) / 2;
      for (const { g, w } of row) { ctx.drawImage(g, x, y, w * k, LH * k); x += (w + GAP) * k; }
      y += (LH + LEAD) * k;
    });
    return out.toDataURL('image/png');
  })();
}

(async () => {
  const srv = await serve(), browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto(`${srv.base}/robots.txt`);   // any same-origin page, so the captures load without tainting the canvas
  const url = await page.evaluate(compose, { MAP, W, H, BOX });
  const file = path.join(__dirname, '..', 'assets', 'og.png');
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', path.relative(process.cwd(), file));
  await browser.close(); srv.stop();
})().catch((e) => { console.error(e); process.exit(1); });
