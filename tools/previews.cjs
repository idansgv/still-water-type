// One preview image per published poster, for the menu (assets/previews/<slug>.jpg). Each is the poster a moment after a touch, on the live fonts
// (the local trial fonts are blocked so they never end up in an image). Needs the dev server (python3 tools/dev.py) and Playwright + Chrome.
//   NODE_PATH=$(npm root -g) node tools/previews.cjs [slug ...]
const { chromium } = require('@playwright/test');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8910';
const OUT = path.join(__dirname, '..', 'assets', 'previews');
const W = 1200, H = 750;

const { SCENES, sleep } = require('./scenes.cjs');

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
