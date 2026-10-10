const { test, expect } = require('@playwright/test');
const { DARK_AT_REST, posters, watch, open, inkRatio, touch } = require('./lib.cjs');

let LIST = [];
test.beforeAll(async () => { LIST = await posters(); });

// 1. Smoke: every poster mounts, draws something, and raises no errors.
test('1 smoke: every poster mounts and draws', async ({ page }) => {
  const out = [];
  for (const p of LIST) {
    const errs = watch(page);
    await open(page, p.slug);
    const ink = await inkRatio(page);
    const fallback = await page.locator('#stage .fallback').count();
    out.push({ slug: p.slug, ink: +ink.toFixed(3), fallback, errs: errs.slice() });
    page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
  }
  console.table(out.map((o) => ({ slug: o.slug, ink: o.ink, fallback: o.fallback, errors: o.errs.length })));
  for (const o of out) {
    expect.soft(o.errs, `${o.slug} errors`).toEqual([]);
    expect.soft(o.fallback, `${o.slug} fell back to the no-WebGL words`).toBe(0);
    if (!DARK_AT_REST.has(o.slug)) expect.soft(o.ink, `${o.slug} canvas looks blank`).toBeGreaterThan(0.005);
  }
});

// 2. Shuffle and destroy cycle: listeners, canvases and heap should not pile up.
test('2 shuffle cycle: no leaks over 40 shuffles', async ({ page }) => {
  await page.addInitScript(() => {
    const counts = {}; window.__lc = counts;
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    const key = (t, type) => (t === window ? 'window' : t === document ? 'document' : (t.id ? '#' + t.id : t.tagName || 'other')) + ':' + type;
    EventTarget.prototype.addEventListener = function (type, fn, o) { const k = key(this, type); counts[k] = (counts[k] || 0) + 1; return add.call(this, type, fn, o); };
    EventTarget.prototype.removeEventListener = function (type, fn, o) { const k = key(this, type); counts[k] = (counts[k] || 0) - 1; return rem.call(this, type, fn, o); };
  });
  const errs = watch(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__poster && window.__poster.stage, null, { timeout: 20000 });
  const snap = async () => page.evaluate(async () => {
    if (window.gc) window.gc(); await new Promise((r) => setTimeout(r, 200)); if (window.gc) window.gc();
    return { canvases: document.querySelectorAll('#stage canvas.poster-canvas').length, nodes: document.querySelectorAll('*').length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1, listeners: { ...window.__lc } };
  });
  for (let i = 0; i < 6; i++) { await page.click('#btn-shuffle'); await page.waitForTimeout(500); }   // warm up
  const a = await snap();
  const seen = new Set();
  for (let i = 0; i < 40; i++) { await page.click('#btn-shuffle'); await page.waitForTimeout(450); seen.add(await page.evaluate(() => window.__poster.slug)); }
  const b = await snap();
  console.log('posters seen:', [...seen].join(', '));
  console.log('canvases', a.canvases, '->', b.canvases, ' nodes', a.nodes, '->', b.nodes, ' heap MB', a.heap, '->', b.heap);
  const grown = Object.keys(b.listeners).filter((k) => !k.startsWith('CANVAS:') && (b.listeners[k] || 0) - (a.listeners[k] || 0) > 2)   // listeners on the poster's own canvas die with it.map((k) => `${k} ${a.listeners[k] || 0}->${b.listeners[k]}`);
  console.log('listener growth:', grown.length ? grown.join(', ') : 'none');
  expect(errs, 'errors while shuffling').toEqual([]);
  expect(b.canvases).toBe(1);
  expect(b.nodes - a.nodes).toBeLessThan(40);
  expect(grown, 'listeners not removed on destroy').toEqual([]);
  if (a.heap > 0) expect(b.heap - a.heap, 'JS heap growth (MB)').toBeLessThan(40);
});

// 3. Responsive: phone, tablet, desktop, both themes. No horizontal scroll, poster fills the stage, footer fits.
const VIEWS = [['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1280, 800]];
test('3 responsive: layout and themes', async ({ page }) => {
  const rows = [];
  for (const [name, w, h] of VIEWS) {
    await page.setViewportSize({ width: w, height: h });
    for (const theme of ['light', 'dark']) {
      for (const p of LIST) {
        const errs = watch(page);
        await open(page, p.slug, `&theme=${theme}`);
        const m = await page.evaluate(() => {
          const c = document.querySelector('#stage canvas'), r = c && c.getBoundingClientRect();
          const f = document.querySelector('footer.chrome').getBoundingClientRect();
          return { sx: document.documentElement.scrollWidth - innerWidth, sy: document.documentElement.scrollHeight - innerHeight, cw: r ? Math.round(r.width) : 0, ch: r ? Math.round(r.height) : 0, fr: Math.round(f.right), theme: document.documentElement.dataset.theme };
        });
        const ink = await inkRatio(page);
        rows.push({ view: name, theme, slug: p.slug, ...m, ink: +ink.toFixed(3), errs: errs.length });
        page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
      }
    }
  }
  const bad = rows.filter((r) => r.sx > 0 || r.sy > 0 || r.cw < 100 || r.fr > r.cw + 1 || (r.ink < 0.005 && !DARK_AT_REST.has(r.slug)) || r.errs);
  console.log(`checked ${rows.length} combinations; problems: ${bad.length}`);
  if (bad.length) console.table(bad);
  expect(bad).toEqual([]);
});

// 4. Pointer and touch: tap letter area, tap background, press-hold, drag, then check nothing broke.
for (const mode of ['mouse', 'touch']) {
  test(`4 ${mode}: tap, background, hold, drag on every poster`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: mode === 'touch' ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mode === 'touch', isMobile: mode === 'touch', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const rows = [];
    for (const p of LIST) {
      const errs = watch(page);
      await open(page, p.slug);
      const W = page.viewportSize().width, H = page.viewportSize().height;
      const spots = [[W * 0.5, H * 0.45], [W * 0.3, H * 0.5], [W * 0.08, H * 0.12]];  // middle of the type, off-centre, empty corner
      const before = await inkRatio(page);
      if (mode === 'mouse') {
        for (const [x, y] of spots) { await page.mouse.click(x, y); await page.waitForTimeout(250); }
        await page.mouse.move(W * 0.5, H * 0.45); await page.mouse.down(); await page.waitForTimeout(1600); await page.mouse.up(); await page.waitForTimeout(300);   // hold
        await page.mouse.move(W * 0.35, H * 0.45); await page.mouse.down(); await page.mouse.move(W * 0.65, H * 0.55, { steps: 12 }); await page.mouse.up();         // drag
        await page.mouse.move(W * 0.1, H * 0.9, { steps: 5 }); await page.mouse.down(); await page.mouse.move(W * 0.9, H * 0.1, { steps: 12 }); await page.mouse.up(); // drag across background
      } else {
        const t = (x, y) => [[x, y]];
        for (const [x, y] of spots) { await touch(page, [{ type: 'touchStart', pts: t(x, y) }, { wait: 80 }, { type: 'touchEnd' }, { wait: 250 }]); }
        await touch(page, [{ type: 'touchStart', pts: t(W * 0.5, H * 0.45) }, { wait: 1600 }, { type: 'touchEnd' }, { wait: 300 }]);
        const path = []; for (let i = 0; i <= 12; i++) path.push({ type: 'touchMove', pts: t(W * (0.35 + 0.3 * i / 12), H * (0.45 + 0.1 * i / 12)) });
        await touch(page, [{ type: 'touchStart', pts: t(W * 0.35, H * 0.45) }, ...path, { type: 'touchEnd' }]);
      }
      await page.waitForTimeout(500);
      const after = await inkRatio(page);
      const alive = await page.evaluate(() => !!(window.__poster && window.__poster.stage));
      rows.push({ slug: p.slug, mode, before: +before.toFixed(3), after: +after.toFixed(3), alive, errs: errs.slice() });
      page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
    }
    console.table(rows.map((r) => ({ slug: r.slug, before: r.before, after: r.after, alive: r.alive, errors: r.errs.length })));
    for (const r of rows) {
      expect.soft(r.errs, `${r.slug} errors`).toEqual([]);
      expect.soft(r.alive, `${r.slug} stage survived`).toBe(true);
      if (!DARK_AT_REST.has(r.slug)) expect.soft(r.after, `${r.slug} canvas blank after interaction`).toBeGreaterThan(0.002);
    }
    await ctx.close();
  });
}

// 5. Performance: frame times per poster (informational on software GL; fails only if a poster is badly slow).
test('5 performance: frame time per poster', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const rows = [];
  for (const p of LIST) {
    await open(page, p.slug);
    await page.mouse.move(400, 400);
    const r = await page.evaluate(() => new Promise((res) => {
      const d = []; let last = performance.now(), n = 0;
      const f = (t) => { d.push(t - last); last = t; if (++n < 150) requestAnimationFrame(f); else { d.shift(); d.sort((a, b) => a - b); res({ p50: d[Math.floor(d.length * 0.5)], p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1] }); } };
      requestAnimationFrame(f);
    }));
    rows.push({ slug: p.slug, p50: +r.p50.toFixed(1), p95: +r.p95.toFixed(1), max: +r.max.toFixed(1) });
  }
  console.table(rows);
  for (const r of rows) expect.soft(r.p95, `${r.slug} p95 frame ms`).toBeLessThan(100);
});

// 6. Black and white: the shell alternates black-on-white and white-on-black on every shuffle, and every poster follows it.
test('6 theme sequence: alternates, and every poster follows it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const corner = () => page.evaluate(() => {   // brightness of the poster's top-left pixels, 0..255
    const c = document.querySelector('#stage canvas.poster-canvas'), t = document.createElement('canvas'); t.width = 8; t.height = 8;
    const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 16, 16, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return Math.round(s / 64);
  });
  const rows = [];
  await page.goto('/', { waitUntil: 'load' });
  for (let i = 0; i < 10; i++) {
    await page.waitForFunction(() => window.__poster && window.__poster.stage, null, { timeout: 20000 });
    await page.waitForTimeout(1200);
    rows.push({ n: i, slug: await page.evaluate(() => window.__poster.slug), theme: await page.evaluate(() => document.documentElement.dataset.theme), flip: await page.evaluate(() => window.__poster.stage.flip), corner: await corner() });
    await page.click('#btn-shuffle'); await page.waitForTimeout(500);
  }
  console.table(rows);
  rows.forEach((r, i) => {
    expect.soft(r.theme, `shuffle ${i}`).toBe(i % 2 === 0 ? 'light' : 'dark');
    expect.soft(r.flip).toBe(i % 2 === 1);
    if (r.theme === 'light') expect.soft(r.corner, `${r.slug} should be white`).toBeGreaterThan(200); else expect.soft(r.corner, `${r.slug} should be black`).toBeLessThan(55);
  });
  const miss = [];
  for (const p of LIST) for (const theme of ['light', 'dark']) {
    await open(page, p.slug, `&theme=${theme}`);
    const c = await corner();
    if (theme === 'light' ? c < 200 : c > 55) miss.push(`${p.slug} ${theme} corner=${c}`);
  }
  console.log('posters not following the theme:', miss.length ? miss.join('; ') : 'none');
  expect(miss).toEqual([]);
});

// 7. Reveal: three quick taps invert the page and show the poster's structure; three more put it back. Mouse and touch.
for (const mode of ['mouse', 'touch']) {
  test(`7 reveal (${mode}): three taps on, three taps off, on every poster`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: mode === 'touch' ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mode === 'touch', isMobile: mode === 'touch' });
    const page = await ctx.newPage();
    const rows = [];
    for (const p of LIST) {
      const errs = watch(page);
      await open(page, p.slug);
      const W = page.viewportSize().width, H = page.viewportSize().height, x = W * 0.5, y = H * 0.86;
      const triple = async () => {
        if (mode === 'mouse') for (let i = 0; i < 3; i++) { await page.mouse.click(x, y); await page.waitForTimeout(70); }
        else for (let i = 0; i < 3; i++) await touch(page, [{ type: 'touchStart', pts: [[x, y]] }, { wait: 40 }, { type: 'touchEnd' }, { wait: 70 }]);
        await page.waitForTimeout(900);
      };
      const state = () => page.evaluate(() => ({ stage: window.__poster.stage.revealed, html: document.documentElement.classList.contains('revealed') }));
      await triple(); const on = await state(); const inkOn = await inkRatio(page);
      await triple(); const off = await state();
      rows.push({ slug: p.slug, on: JSON.stringify(on), off: JSON.stringify(off), inkOn: +inkOn.toFixed(3), errs: errs.slice() });
      page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
    }
    console.table(rows.map((r) => ({ slug: r.slug, on: r.on, off: r.off, errors: r.errs.length })));
    for (const r of rows) {
      const on = JSON.parse(r.on), off = JSON.parse(r.off);
      expect.soft(on.stage, `${r.slug} reveals on three taps`).toBe(true);
      if (r.slug !== 'still-water') expect.soft(on.html, `${r.slug} inverts the page`).toBe(true);   // Still Water's lamp is its own night scene
      expect.soft(off.stage, `${r.slug} reveals off on three more`).toBe(false);
      expect.soft(off.html, `${r.slug} un-inverts`).toBe(false);
      expect.soft(r.errs, `${r.slug} errors`).toEqual([]);
    }
    await ctx.close();
  });
}
