// Checks the posters look the same with no connection: every request that is not localhost is blocked, then the page must still have its fonts.
//   python3 tools/dev.py &   (or an already running dev server)
//   NODE_PATH=$(npm root -g) node tools/offline-check.cjs [slug]      default: slinky-type
const { chromium } = require('@playwright/test');
(async () => {
  const slug = process.argv[2] || 'slinky-type', base = process.env.BASE_URL || 'http://localhost:8910';
  const b = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } }), blocked = [];
  await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => { blocked.push(new URL(r.request().url()).hostname); r.abort(); });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${base}/?p=${slug}&theme=light`);
  await p.waitForFunction(() => window.__poster && window.__poster.inst, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  const f = await p.evaluate(() => ({ 'Bungee Inline': document.fonts.check('400 100px "Bungee Inline"'), Archivo: document.fonts.check('900 100px Archivo'), 'IBM Plex Mono': document.fonts.check('400 12px "IBM Plex Mono"') }));
  const ok = Object.values(f).every(Boolean) && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL', slug, JSON.stringify(f), 'blocked hosts:', [...new Set(blocked)].join(', ') || 'none', errs.length ? 'errors: ' + errs.join('; ') : '');
  await b.close(); process.exit(ok ? 0 : 1);
})();
