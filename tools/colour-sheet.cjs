// A sheet of every published poster in colour, after what wakes each one's colour (tools/colour-scenes.cjs),, light and dark, at rest and a moment after a touch: the check that each has a good coloured version.
//   NODE_PATH=$(npm root -g) node tools/colour-sheet.cjs [palette 0..5]   ->  output/shots/colour.png
const { chromium } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const { sleep } = require('./scenes.cjs');
const { COLOUR_SCENES } = require('./colour-scenes.cjs');
const { serve } = require('./lib-serve.cjs');
(async () => {
  const pal = process.argv[2] ?? '1', srv = await serve(), browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
  const { PUBLISHED } = await import('../src/posters/index.js');
  const tiles = [];
  for (const p of PUBLISHED) for (const theme of ['light', 'dark']) {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage(), errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${srv.base}/?p=${p.slug}&theme=${theme}&colour=${pal}`);
    await page.waitForFunction(() => window.__poster && window.__poster.inst, null, { timeout: 30000 });
    await sleep(2000);
    if (COLOUR_SCENES[p.slug]) await COLOUR_SCENES[p.slug](page);                       // each poster's own way of waking its colour
    await page.addStyleTag({ content: '.chrome, #hint, #toast, #menu-corner { display: none !important; }' });
    tiles.push({ label: `${p.slug} · ${theme}${errs.length ? ' · ERROR ' + errs[0].slice(0, 50) : ''}`, data: (await page.screenshot()).toString('base64') });
  }
  const html = `<body style="margin:0;background:#777;font:12px monospace;color:#fff"><div style="display:grid;grid-template-columns:repeat(4,400px);gap:10px;padding:10px">${tiles.map((t) => `<figure style="margin:0"><img style="width:400px;display:block" src="data:image/png;base64,${t.data}"><figcaption style="padding:4px 0">${t.label}</figcaption></figure>`).join('')}</div></body>`;
  const sheet = await (await browser.newContext({ viewport: { width: 1700, height: 400 } })).newPage();
  await sheet.setContent(html); await sleep(400);
  const out = path.join(__dirname, '..', 'output', 'shots'); fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, 'colour.png'); await sheet.screenshot({ path: file, fullPage: true });
  await browser.close(); srv.stop(); console.log(file);
})();
