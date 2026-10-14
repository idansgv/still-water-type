// Ship a poster in one command: tests, menu preview, share pages, commit, and (only with --push) push to both branches and wait for the live site.
//   NODE_PATH=$(npm root -g) node tools/ship.cjs <slug> [-m "message"] [--full] [--push]
//   without --push it stops after the commit; --full runs the whole test tier instead of the quick one
// The review ("is it right?") stays Idan's: run this when he has said yes; --push is the outward step.
const { spawnSync, execSync } = require('child_process');
const path = require('path');
const { serve } = require('./lib-serve.cjs');
const root = path.join(__dirname, '..');

const args = process.argv.slice(2), slug = args.find((a) => !a.startsWith('-') && args[args.indexOf(a) - 1] !== '-m');
const flag = (f) => args.includes(f), msg = args.includes('-m') ? args[args.indexOf('-m') + 1] : `${slug}: ship`;
if (!slug) { console.error('usage: node tools/ship.cjs <slug> [-m "message"] [--full] [--push]'); process.exit(1); }
const run = (cmd, argv, env = {}) => { const r = spawnSync(cmd, argv, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } }); return r.status === 0; };
const step = (n, t) => console.log(`\n\x1b[1m${n}. ${t}\x1b[0m`);
const fail = (m) => { console.error('\n\x1b[31m✗ ' + m + '\x1b[0m'); process.exit(1); };

(async () => {
  step(1, 'static checks');
  if (!run('node', ['tools/graduate.mjs', 'check', slug, '--fast'])) fail('the static checks failed (node tools/graduate.mjs check ' + slug + ')');
  step(2, flag('--full') ? 'tests (full tier)' : 'tests (quick tier: smoke, interaction, reveal, menu)');
  const grep = flag('--full') ? [] : ['-g', 'smoke|mouse|touch|reveal|menu|theme'];
  if (!run('npx', ['playwright', 'test', '-c', 'tools/tests', ...grep], { SLUGS: slug })) fail('tests failed');
  step(3, 'menu preview');
  const srv = await serve();
  const okPrev = run('node', ['tools/previews.cjs', slug], { BASE_URL: srv.base }); srv.stop();
  if (!okPrev) fail('the preview could not be made (add a scene for ' + slug + ' in tools/scenes.cjs)');
  step(4, 'share pages');
  if (!run('node', ['tools/build.mjs'])) fail('build failed');
  step(5, 'commit');
  execSync('git add -A src p assets docs tools index.html', { cwd: root });
  const dirty = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root }).status !== 0;
  if (dirty) { if (!run('git', ['commit', '-q', '-m', `${msg}\n\nCo-Authored-By: Claude <noreply@anthropic.com>`])) fail('commit failed'); } else console.log('  nothing new to commit');
  if (!flag('--push')) { console.log('\n\x1b[32m✓ ready.\x1b[0m Nothing is pushed: run again with --push (after the yes) to publish.'); return; }
  step(6, 'push portfolio-v1 and main');
  const branch = execSync('git branch --show-current', { cwd: root }).toString().trim();
  if (!run('git', ['push', 'origin', branch]) || !run('git', ['push', 'origin', `${branch}:main`])) fail('push failed');
  step(7, 'wait for the live site');
  const url = `https://idansegev.com/p/${slug}/`, t0 = Date.now(), want = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
  for (;;) {
    try { const r = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) { console.log(`  ${r.status} ${url}`); break; } } catch (e) { /* retry */ }
    if (Date.now() - t0 > 240000) fail('the live site did not answer in 4 minutes');
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(`\n\x1b[32m✓ published (${want}).\x1b[0m`);
})();
