// One preview image per published poster, for the menu (assets/previews/<slug>.jpg). Each is the poster a moment after a touch, on the live fonts
// (the local trial fonts are blocked so they never end up in an image). Needs the dev server (python3 tools/dev.py) and Playwright + Chrome.
//   NODE_PATH=$(npm root -g) node tools/previews.cjs [slug ...]
const { chromium } = require('@playwright/test');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8910';
const OUT = path.join(__dirname, '..', 'assets', 'previews');
const W = 1200, H = 750;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCENES = {
  'still-water': async (p) => { await p.mouse.move(250, 250); await p.mouse.down(); for (let i = 0; i <= 24; i++) { await p.mouse.move(250 + i * 28, 250 + Math.sin(i / 3) * 90); await sleep(16); } await p.mouse.up(); await sleep(350); },
  'soft-type': async (p) => { await p.mouse.move(300, 300); await p.mouse.down(); for (let i = 0; i <= 14; i++) { await p.mouse.move(300 + i * 26, 300 + i * 6); await sleep(16); } await sleep(150); await p.mouse.up(); await sleep(250); },
  collapse: async (p) => { await p.mouse.click(430, 260); await sleep(900); },
  explode: async (p) => { await p.mouse.click(640, 260); await sleep(450); },
  metal: async (p) => { await p.mouse.move(420, 300); await p.mouse.down(); for (let i = 0; i <= 16; i++) { await p.mouse.move(420 + i * 22, 300 - i * 9); await sleep(16); } await p.mouse.up(); await sleep(400); },
  'slinky-type': async (p) => { await p.evaluate(() => { const d = window.__poster.inst.debug; d.click(1); d.click(6); d.run(34); }); await sleep(100); await p.evaluate(() => window.__poster.inst.debug.run(1)); },
};

(async () => {
  const which = process.argv.slice(2), slugs = which.length ? which : Object.keys(SCENES);
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
  for (const slug of slugs) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/assets/fonts/**', (r) => r.abort());                          // the live fonts only
    await page.goto(`${BASE}/?p=${slug}&theme=light`);
    await page.waitForFunction(() => window.__poster && window.__poster.inst, null, { timeout: 30000 });
    await sleep(1500);
    await SCENES[slug](page);
    await page.addStyleTag({ content: '.chrome, #hint, #toast, #menu-corner, #index, #peek { display: none !important; }' });
    const png = path.join(OUT, slug + '.jpg');
    await page.screenshot({ path: png, type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: W, height: H } });
    console.log('wrote', path.relative(process.cwd(), png));
    await ctx.close();
  }
  await browser.close();
})();
