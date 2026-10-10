// Shared bits for the site checks. Slinky posters are left out for now (still in draft and in progress).
const SKIP = new Set(['slinky', 'slinky-type']);
// Posters that are black until the visitor finds something (Backlight: the light), so a blank canvas at rest is correct.
const DARK_AT_REST = new Set(['backlight']);

// Registry rows, read through the same file the site uses.
async function posters() {
  const { POSTERS } = await import('../../src/posters/index.js');
  const all = process.env.SET === 'all';                       // default: the published posters only (SET=all adds the drafts)
  return POSTERS.filter((p) => !SKIP.has(p.slug) && (all || !p.draft));
}

// Collect errors from the page: console errors, uncaught exceptions, failed requests for our own files.
function watch(page) {
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('exception: ' + String(e.message).slice(0, 200)));
  page.on('requestfailed', (r) => { if (r.url().startsWith('http://127.0.0.1') || r.url().includes('idansegev')) errs.push('request failed: ' + r.url()); });
  page.on('response', (r) => { if (r.status() >= 400 && (r.url().startsWith('http://127.0.0.1') || r.url().includes('idansegev'))) errs.push(`HTTP ${r.status()}: ${r.url()}`); });
  return errs;
}

// Open a poster and wait until it has mounted (window.__poster is set after mount).
async function open(page, slug, extra = '') {
  await page.goto(`/?p=${slug}${extra}`, { waitUntil: 'load' });
  await page.waitForFunction((s) => window.__poster && window.__poster.slug === s, slug, { timeout: 20000 });
  await page.waitForTimeout(800);
}

// Fraction of distinct pixels on the poster canvas: 0 = blank. Reads from a 2D copy so WebGL needs no preserveDrawingBuffer.
async function inkRatio(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#stage canvas');
    if (!c) return -1;
    const t = document.createElement('canvas'); t.width = 64; t.height = 40;
    const x = t.getContext('2d', { willReadFrequently: true });
    x.drawImage(c, 0, 0, 64, 40);
    const d = x.getImageData(0, 0, 64, 40).data;
    let diff = 0; const r0 = d[0], g0 = d[1], b0 = d[2];
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 24) diff++;
    return diff / (64 * 40);
  });
}

// Touch through CDP, so the page gets real touch pointer events (Playwright only offers taps).
async function touch(page, steps) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  for (const s of steps) {
    if (s.wait) await page.waitForTimeout(s.wait); else await send(s.type, s.pts || []);
  }
  await cdp.detach();
}

module.exports = { SKIP, DARK_AT_REST, posters, watch, open, inkRatio, touch };
