// One contact sheet for a poster, so a change can be judged in one look: desktop and phone, light and dark, at rest and a moment after a touch.
//   NODE_PATH=$(npm root -g) node tools/shot.cjs <slug> [--url "&font=Name"]   ->  output/shots/<slug>.png  (and prints the path)
// Uses the poster's scene from tools/scenes.cjs for the touched state (a plain tap in the middle if it has none). Starts the dev server itself.
const { chromium } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const { SCENES, sleep } = require('./scenes.cjs');
const { serve } = require('./lib-serve.cjs');

const TILES = [
  { label: 'desktop · light · rest', w: 1280, h: 800, theme: 'light', touched: false },
  { label: 'desktop · light · touched', w: 1280, h: 800, theme: 'light', touched: true },
  { label: 'desktop · dark · touched', w: 1280, h: 800, theme: 'dark', touched: true },
  { label: 'phone · light · rest', w: 390, h: 844, theme: 'light', touched: false, phone: true },
  { label: 'phone · dark · touched', w: 390, h: 844, theme: 'dark', touched: true, phone: true },
];

(async () => {
  const args = process.argv.slice(2), slug = args.find((a) => !a.startsWith('--'));
  const extra = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || '';
  if (!slug) { console.error('usage: node tools/shot.cjs <slug> [--url "&font=Name"]'); process.exit(1); }
  const srv = await serve(), browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
  const out = path.join(__dirname, '..', 'output', 'shots'); fs.mkdirSync(out, { recursive: true });
  const shots = [];
  for (const t of TILES) {
    const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, hasTouch: !!t.phone, isMobile: !!t.phone, deviceScaleFactor: 1 });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 160)); });
    await page.goto(`${srv.base}/?p=${slug}&theme=${t.theme}${extra}`);
    await page.waitForFunction(() => window.__poster && window.__poster.inst, null, { timeout: 30000 });
    await sleep(2200);
    if (t.touched) {
      if (SCENES[slug] && !t.phone) await SCENES[slug](page);
      else if (t.phone) { await page.touchscreen.tap(t.w / 2, t.h / 2); await sleep(900); }
      else { await page.mouse.click(t.w / 2, t.h / 2); await sleep(900); }
    }
    await page.addStyleTag({ content: '#toast { display: none !important; }' });
    shots.push({ label: t.label + (errs.length ? ` · ${errs.length} ERROR(S): ${errs[0].slice(0, 60)}` : ''), data: (await page.screenshot()).toString('base64'), w: t.w, h: t.h });
    await ctx.close();
  }
  const H = 360, html = `<body style="margin:0;background:#888;font:12px monospace;color:#fff"><div style="display:flex;gap:12px;padding:12px;align-items:flex-start">${shots.map((s) => `<figure style="margin:0"><img style="height:${H}px;display:block" src="data:image/png;base64,${s.data}"><figcaption style="padding:6px 0">${s.label}</figcaption></figure>`).join('')}</div></body>`;
  const sheet = await (await browser.newContext({ viewport: { width: 2300, height: H + 70 } })).newPage();
  await sheet.setContent(html); await sleep(300);
  const file = path.join(out, slug + '.png'); await sheet.screenshot({ path: file, fullPage: true });
  await browser.close(); srv.stop(); console.log(file);
})();
