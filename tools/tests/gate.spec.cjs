// The graduation gate: checks that only make sense one poster at a time, run by `node tools/graduate.mjs check <slug>` (SLUGS=<slug>)
// together with the site suite (site.spec.cjs). Everything here is behaviour in the browser; the file and registry checks are in tools/graduate.mjs.
const { test, expect } = require('@playwright/test');
const { DARK_AT_REST, posters, watch, open, inkRatio, touch } = require('./lib.cjs');

let LIST = [];
test.beforeAll(async () => { LIST = await posters(); });

// destroy() must leave nothing behind: no canvas, no node, no window/document listener.
test('gate: destroy leaves nothing behind', async ({ page }) => {
  await page.addInitScript(() => {
    const c = {}; window.__lc = c;
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    const key = (t, type) => (t === window ? 'window' : t === document ? 'document' : 'other') + ':' + type;
    EventTarget.prototype.addEventListener = function (type, fn, o) { const k = key(this, type); c[k] = (c[k] || 0) + 1; return add.call(this, type, fn, o); };
    EventTarget.prototype.removeEventListener = function (type, fn, o) { const k = key(this, type); c[k] = (c[k] || 0) - 1; return rem.call(this, type, fn, o); };
  });
  for (const p of LIST) {
    const errs = watch(page);
    await open(page, p.slug);
    const before = await page.evaluate(() => ({ ...window.__lc }));
    const after = await page.evaluate(() => {
      const { inst, stage } = window.__poster;
      if (inst && inst.destroy) inst.destroy();
      stage.destroy();
      return { left: document.querySelectorAll('#stage canvas').length, lc: { ...window.__lc }, cls: document.documentElement.className };
    });
    console.log(`${p.slug}: canvases left ${after.left}; html class "${after.cls}"; listeners left on window/document:`, Object.entries(after.lc).filter(([k, v]) => (k.startsWith('window') || k.startsWith('document')) && v > 0 && /keydown|keyup|deviceorientation/.test(k)).map(([k, v]) => `${k}=${v}`).join(', ') || 'none');
    expect.soft(after.left, `${p.slug}: canvases left after destroy`).toBe(0);
    expect.soft(after.cls.includes('revealed'), `${p.slug}: page still inverted after destroy`).toBe(false);
    expect.soft((after.lc['window:keydown'] || 0), `${p.slug}: window keydown listeners left`).toBeLessThanOrEqual(2);   // the shell's own two: the shuffle keys, and Escape for the links
    expect.soft(errs, `${p.slug} errors`).toEqual([]);
    page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
  }
});

// Reveal must show something: a layer is drawn over the poster (or the poster does its own, like Still Water's lamp).
test('gate: reveal draws something of its own', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const rows = [];
  for (const p of LIST) {
    await open(page, p.slug);
    const x = 640, y = 690;
    for (let i = 0; i < 3; i++) { await page.mouse.click(x, y); await page.waitForTimeout(70); }
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const layers = [...document.querySelectorAll('#stage canvas:not(.poster-canvas)')];
      let ink = 0;
      for (const c of layers) { const t = document.createElement('canvas'); t.width = 64; t.height = 40; const g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0, 64, 40); const d = g.getImageData(0, 0, 64, 40).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) ink++; }
      return { revealed: window.__poster.stage.revealed, inverted: document.documentElement.classList.contains('revealed'), layers: layers.length, ink: +(ink / 2560).toFixed(3) };
    });
    rows.push({ slug: p.slug, ...r });
  }
  console.table(rows);
  for (const r of rows) {
    expect.soft(r.revealed, `${r.slug}: three taps toggle reveal`).toBe(true);
    if (r.inverted) expect.soft(r.ink, `${r.slug}: the reveal layer is empty`).toBeGreaterThan(0.01);   // posters with their own look (Still Water's lamp) do not invert the page
  }
});

// Reduced motion: with nothing touched, a poster that has been told to be calm stands still (the taste rule: no idle motion).
test('gate: calm under reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const rows = [];
  for (const p of LIST) {
    const errs = watch(page);
    await open(page, p.slug);
    await page.waitForTimeout(6000);                                                       // a short intro on load is allowed (Slinky settles for about 5 s); after that, stillness
    const snap = () => page.evaluate(() => { const c = document.querySelector('#stage canvas.poster-canvas'), t = document.createElement('canvas'); t.width = 96; t.height = 60; const g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0, 96, 60); return Array.from(g.getImageData(0, 0, 96, 60).data); });
    const a = await snap(); await page.waitForTimeout(1500); const b = await snap();
    let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]); const motion = +(d / (a.length / 4) / 255).toFixed(4);
    rows.push({ slug: p.slug, motion, errs: errs.length });
    page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
  }
  console.table(rows);
  for (const r of rows) { expect.soft(r.motion, `${r.slug}: moves by itself under reduced motion`).toBeLessThan(0.002); expect.soft(r.errs).toBe(0); }
  await ctx.close();
});

// The standard's gestures must not break anything: a tap on empty background changes no state of the shell, a hold and a double tap raise no errors, nothing toggles reveal by itself.
test('gate: background tap, hold and double tap are harmless', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const p of LIST) {
    const errs = watch(page);
    await open(page, p.slug);
    await page.mouse.click(60, 700); await page.waitForTimeout(300);                         // a single background tap
    await page.mouse.move(60, 700); await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up();   // a hold on the background
    await page.mouse.click(60, 700); await page.waitForTimeout(90); await page.mouse.click(60, 700); await page.waitForTimeout(900);   // a double tap
    const st = await page.evaluate(() => ({ revealed: window.__poster.stage.revealed, alive: !!window.__poster.stage }));
    expect.soft(st.revealed, `${p.slug}: reveal must need three taps`).toBe(false);
    expect.soft(errs, `${p.slug} errors`).toEqual([]);
    page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
  }
});

// Colour: every poster has a coloured version (src/colour.js). With ?colour=on it mounts, draws, and the page really has colour in it, in both themes.
test('gate: a coloured version exists and shows colour (light and dark)', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 });
  for (const p of LIST) for (const theme of ['light', 'dark']) {
    const errs = watch(page);
    await open(page, p.slug, `&colour=on&theme=${theme}`);
    expect.soft(await page.evaluate(() => getComputedStyle(document.querySelector('.colour-pass')).opacity), `${p.slug}: the colour shows before any touch`).toBe('0');   // an easter egg: black and white until the first press
    await page.mouse.move(180, 200); await page.mouse.down();            // a poster that is blank until touched (Rain) shows itself while pressed
    for (let i = 0; i <= 16; i++) { await page.mouse.move(180 + i * 26, 200 + Math.sin(i / 2) * 70); await page.waitForTimeout(30); }
    const info = await page.evaluate(() => ({ colour: window.__poster.colour, pass: !!document.querySelector('.colour-pass') }));
    const measure = async () => {                                   // the share of pixels that are clearly coloured (saturated and not near black)
      const shot = await page.screenshot();
      return page.evaluate(async (b64) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = 160; c.height = 100; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 160, 100);
        const d = x.getImageData(0, 0, 160, 100).data; let n = 0;
        for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx > 90 && (mx - mn) / mx > 0.35) n++; }
        return n / (160 * 100);
      }, shot.toString('base64'));
    };
    let coloured = await measure();
    for (let k = 0; k < 4 && coloured <= 0.004; k++) { await page.waitForTimeout(1000); coloured = await measure(); }   // a poster that loads its fonts from the network may need a moment
    await page.mouse.up();
    console.log(`${p.slug} ${theme}: colour ${info.colour}, pass ${info.pass}, coloured pixels ${(coloured * 100).toFixed(1)}%`);
    expect.soft(info.colour, `${p.slug}: no palette chosen`).toBeTruthy();
    expect.soft(coloured, `${p.slug} (${theme}): the coloured version shows no colour`).toBeGreaterThan(0.004);
    expect.soft(errs, `${p.slug} errors`).toEqual([]);
    page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
  }
});
