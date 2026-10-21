// The lock sheet: one poster in every variation, on one page, so it can be checked before it is locked.
//   columns: light, dark, light + colour, dark + colour      rows: at rest, after a tap, after a drag, after a long press (1.2 s, still)
//   NODE_PATH=$(npm root -g) node tools/lock-sheet.cjs <slug>   ->  output/shots/lock-<slug>.png, and the default settings printed
const { chromium } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const { sleep } = require('./scenes.cjs');
const { serve } = require('./lib-serve.cjs');
const COLS = [['light', 'light'], ['dark', 'dark'], ['light · colour', 'light', 'on'], ['dark · colour', 'dark', 'on']];
const ROWS = ['at rest', 'after a tap', 'after a drag', 'after a long press'];
(async () => {
  const slug = process.argv[2]; if (!slug) { console.error('usage: node tools/lock-sheet.cjs <slug>'); process.exit(1); }
  const W = 620, H = 390, srv = await serve(), browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
  const tiles = []; let defaults = null;
  for (const [ri, row] of ROWS.entries()) for (const [label, theme, colour] of COLS) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage(), errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${srv.base}/?p=${slug}&theme=${theme}&colour=${colour ? 'on' : 'off'}${colour ? '&colourat=load' : ''}`);
    await page.waitForFunction(() => window.__poster && window.__poster.inst, null, { timeout: 30000 });
    await sleep(1800);
    if (!defaults) defaults = await page.evaluate(() => { const t = window.__poster.inst.tune; return t ? JSON.stringify(t.defaults) : null; });
    const x = (f) => Math.round(W * f), y = (f) => Math.round(H * f);
    if (ri === 1) { await page.mouse.click(x(0.3), y(0.62)); await sleep(500); await page.mouse.click(x(0.72), y(0.3)); await sleep(500); }
    if (ri === 2) { await page.mouse.move(x(0.15), y(0.5)); await page.mouse.down(); for (let i = 0; i <= 26; i++) { await page.mouse.move(x(0.15 + i * 0.028), y(0.5 + Math.sin(i / 3) * 0.06)); await sleep(14); } await page.mouse.up(); await sleep(500); }
    if (ri === 3) { await page.mouse.move(x(0.5), y(0.45)); await page.mouse.down(); await sleep(1200); }
    await page.addStyleTag({ content: '.chrome, #hint, #toast, #menu-corner { display: none !important; }' });
    tiles.push({ label: `${row} · ${label}${errs.length ? ' · ERROR ' + errs[0].slice(0, 40) : ''}`, data: (await page.screenshot()).toString('base64') });
    await page.close();
  }
  const html = `<body style="margin:0;background:#777;font:12px monospace;color:#fff"><div style="display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;padding:8px">${tiles.map((t) => `<figure style="margin:0"><img style="width:${W}px;display:block" src="data:image/png;base64,${t.data}"><figcaption style="padding:3px 0">${t.label}</figcaption></figure>`).join('')}</div></body>`;
  const sheet = await (await browser.newContext({ viewport: { width: W * 4 + 40, height: 400 } })).newPage();
  await sheet.setContent(html); await sleep(500);
  const out = path.join(__dirname, '..', 'output', 'shots'); fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `lock-${slug}.png`); await sheet.screenshot({ path: file, fullPage: true });
  await browser.close(); srv.stop(); console.log(file); console.log('defaults', defaults);
})();
