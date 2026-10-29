// One share image per published poster (assets/og-<slug>.png, 1200 x 630), the picture a link preview shows. Each is the poster a
// moment after a touch, on the live fonts, with no page furniture. tools/build.mjs picks them up for the share pages.
//   NODE_PATH=$(npm root -g) node tools/og-posters.cjs [slug ...]      then: node tools/build.mjs
const { chromium } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { serve } = require('./lib-serve.cjs');
const { SCENES, PREVIEW_THEME, sleep } = require('./scenes.cjs');
const W = 1200, H = 630;
// A share image has to read as the name. Most posters use their preview scene (a moment after a touch); these get their own moment.
const REST = (ms) => async () => { await sleep(ms); };
const OG_THEME = { splintered: 'dark' };   // glass reads on black; on white it is porcelain, nearly invisible at rest
const MOMENT = {
  glint: async (page) => { await page.mouse.move(W * 0.5, H * 0.66); await sleep(1200); await page.mouse.click(W * 0.5, H * 0.66); await sleep(450); },   // the flare, just past its peak, lights every edge
  moonlit: async (page) => { await sleep(2000); await page.mouse.move(W * 0.5, H * 0.5); await page.mouse.down(); await sleep(3000); },   // a held gale: glitter everywhere but the name
  crystallize: REST(6000),                  // fully condensed
  splintered: REST(1500), metal: REST(1500), 'slinky-type': REST(2500), collapse: REST(2500), explode: REST(1500),   // at rest: whole letters
};
const OUT = path.join(__dirname, '..', 'assets');

(async () => {
  const { PUBLISHED } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'posters', 'index.js')).href);
  const which = process.argv.slice(2), slugs = which.length ? which : PUBLISHED.map((p) => p.slug);
  const srv = await serve(), browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
  for (const slug of slugs) {
    const p = PUBLISHED.find((x) => x.slug === slug);
    const theme = p && p.darkOnly ? 'dark' : (OG_THEME[slug] || PREVIEW_THEME[slug] || 'light');
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/assets/fonts/**', (r) => r.abort());                          // the live fonts only
    await page.goto(`${srv.base}/?p=${slug}&theme=${theme}&colour=off`);
    await page.waitForFunction(() => window.__poster && window.__poster.inst, null, { timeout: 30000 });
    await sleep(1500);
    if (MOMENT[slug]) await MOMENT[slug](page);
    else if (SCENES[slug]) await SCENES[slug](page);
    else { await page.mouse.click(W / 2, H / 2); await sleep(900); }
    await page.addStyleTag({ content: '.chrome, #hint, #toast, #menu-corner, #index, #peek, #name-form { display: none !important; }' });
    const file = path.join(OUT, `og-${slug}.png`);
    await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
    console.log('wrote', path.relative(process.cwd(), file));
    await ctx.close();
  }
  await browser.close(); srv.stop();
})().catch((e) => { console.error(e); process.exit(1); });
