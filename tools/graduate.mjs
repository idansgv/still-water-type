// The graduation gate: what a draft poster must pass to become published, and the step that publishes it.
//
//   node tools/graduate.mjs check <slug> [--fast]   static checks, then the browser gate (tools/tests, SLUGS=<slug>); --fast skips the browser
//   node tools/graduate.mjs apply <slug>            after a passing check: removes `draft: true`, writes the share page, flips the docs status
//   node tools/graduate.mjs status                  every poster, its stage and whether it passes the static checks
//
// It never commits or pushes: see docs/PIPELINE.md for the last steps (commit, push to portfolio-v1 and main as idansgv).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTERS } from '../src/posters/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
// published before the gesture standard existed (10 Oct 2026); they keep passing, with a note
const GRANDFATHERED = new Set(['still-water', 'soft-type', 'collapse', 'explode', 'metal']);
const [cmd = 'status', slug, ...flags] = process.argv.slice(2);
const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m), bad = (m) => console.log('  \x1b[31m✗\x1b[0m ' + m), warn = (m) => console.log('  \x1b[33m!\x1b[0m ' + m);

// the poster's source plus the local modules it imports (one level), so a poster built on a shared core is read through
function sourceOf(row) {
  const m = /import\('\.\/([^']+)'\)/.exec(row.load.toString());
  if (!m) return { file: null, text: '' };
  const file = 'src/posters/' + m[1];
  if (!existsSync(join(root, file))) return { file, text: '' };
  let text = read(file);
  for (const [, rel] of text.matchAll(/from '\.\/([^']+\.js)'/g)) { const f = 'src/posters/' + rel; if (existsSync(join(root, f))) text += '\n' + read(f); }
  return { file, text };
}

function staticChecks(row) {
  const out = [];   // [level, message]; level: 'fail' | 'warn' | 'ok'
  const add = (level, msg) => out.push([level, msg]);
  const need = (cond, good, badMsg) => add(cond ? 'ok' : 'fail', cond ? good : badMsg);
  need(/^[a-z0-9-]+$/.test(row.slug), `slug "${row.slug}"`, 'slug must be lowercase letters, digits and dashes');
  need(!!row.title, 'title', 'missing title');
  need(Array.isArray(row.words) && row.words.length > 0, 'words (the no-WebGL fallback and screen readers)', 'missing words');
  need(!!row.blurb && row.blurb.length <= 140, 'blurb (what a shared link says)', 'blurb missing or over 140 characters');
  need(row.hint === null || (typeof row.hint === 'string' && row.hint.length <= 40), 'hint is null or one short line', 'hint must be null or under 40 characters');
  need(row.themes && row.themes.dark + row.themes.light > 0, 'themes', 'missing themes');
  const { file, text } = sourceOf(row);
  need(!!text, `source ${file}`, `source file not found (${file})`);
  if (text) {
    need(/export\s+(async\s+)?function\s+mount\b|export\s+const\s+mount\b|export\s*\{[^}]*\bmount\b/.test(read(file)), 'exports mount(stage)', 'the poster must export mount(stage)');
    need(/destroy\s*\(/.test(text), 'returns destroy()', 'no destroy(): the shell calls it on every shuffle');
    need(/createReveal|\.on\('reveal'|setReveal/.test(text), 'handles reveal (three quick taps)', 'no reveal: use createReveal from reveal.js (or stage.on(\'reveal\'))');
    need(/stage\.theme|\.flip\b|ctx\.theme/.test(text), 'follows the black and white sequence (stage.theme / stage.flip)', 'does not read stage.theme or stage.flip, so it ignores the black and white sequence');
    const usesStd = /gestures\.js/.test(text) || /gestures: n\/a/.test(text);
    if (usesStd) add('ok', 'uses the gesture standard (src/gestures.js)');
    else if (GRANDFATHERED.has(row.slug)) add('warn', 'predates the gesture standard (grandfathered): move to src/gestures.js when next touched');
    else add('fail', 'does not import src/gestures.js (or say "gestures: n/a" with a reason in a comment)');
    if (/Math\.random\(\)/.test(text) && !/stage\.seed|mulberry32/.test(text)) add('warn', 'uses Math.random without the stage seed: a shared link will not reproduce it');
    if (/\b(onclick|alert\(|innerHTML\s*=)/.test(text)) add('warn', 'check for onclick / alert / innerHTML use');
    if (/fetch\(|XMLHttpRequest|localhost/.test(text) && !/\?live/.test(text)) add('warn', 'network access found: a public page contacting localhost can trigger a browser prompt');
  }
  need(existsSync(join(root, `docs/posters/${row.slug}.md`)), `docs/posters/${row.slug}.md`, `missing docs/posters/${row.slug}.md`);
  need(read('docs/INTERACTIONS.md').toLowerCase().includes(row.title.toLowerCase()), 'listed in docs/INTERACTIONS.md', `add ${row.title} to the tables in docs/INTERACTIONS.md`);
  const fonts = execSync('git ls-files assets/fonts', { cwd: root }).toString().trim().split('\n').filter((f) => f && !f.endsWith('README.md'));
  need(fonts.length === 0, 'no trial fonts tracked', 'trial fonts are tracked in git: ' + fonts.join(', '));
  return out;
}

function report(row) {
  console.log(`\n${row.title} (${row.slug}), ${row.draft ? 'draft' : 'published'}`);
  const res = staticChecks(row);
  for (const [l, m] of res) (l === 'ok' ? ok : l === 'warn' ? warn : bad)(m);
  return res.filter(([l]) => l === 'fail').length;
}

const find = (s) => { const r = POSTERS.find((p) => p.slug === s); if (!r) { console.error(`No poster "${s}". Known: ${POSTERS.map((p) => p.slug).join(', ')}`); process.exit(2); } return r; };

if (cmd === 'status') {
  for (const p of POSTERS) { const n = staticChecks(p).filter(([l]) => l === 'fail').length; console.log(`${p.draft ? 'draft    ' : 'published'}  ${p.slug.padEnd(12)} ${n ? `${n} failing static check${n > 1 ? 's' : ''}` : 'passes static checks'}`); }
} else if (cmd === 'check') {
  const row = find(slug), fails = report(row);
  if (!flags.includes('--fast')) {
    console.log('\nBrowser gate (Playwright, Chrome):');
    let nodePath = ''; try { nodePath = execSync('npm root -g').toString().trim(); } catch (e) { /* ignore */ }
    const r = spawnSync('npx', ['playwright', 'test', '-c', 'tools/tests'], { cwd: root, stdio: 'inherit', env: { ...process.env, SLUGS: row.slug, NODE_PATH: nodePath } });
    if (r.status !== 0) { console.log('\n\x1b[31mGate failed.\x1b[0m'); process.exit(1); }
  }
  if (fails) { console.log(`\n\x1b[31m${fails} static check${fails > 1 ? 's' : ''} failing.\x1b[0m`); process.exit(1); }
  console.log(`\n\x1b[32m${row.slug} passes${flags.includes('--fast') ? ' the static checks (browser gate skipped)' : ' the gate'}.\x1b[0m` + (row.draft ? ` Next: node tools/graduate.mjs apply ${row.slug}` : ''));
} else if (cmd === 'apply') {
  const row = find(slug);
  if (!row.draft) { console.log(`${slug} is already published.`); process.exit(0); }
  if (report(row)) { console.log('\nFix the failing checks first (node tools/graduate.mjs check ' + slug + ').'); process.exit(1); }
  const f = join(root, 'src/posters/index.js'); let s = readFileSync(f, 'utf8');
  const i = s.indexOf(`slug: '${slug}'`), j = s.indexOf('load:', i), seg = s.slice(i, j);
  if (!/\n\s*draft: true,/.test(seg)) { console.error('Could not find `draft: true` in the registry row.'); process.exit(1); }
  s = s.slice(0, i) + seg.replace(/\n\s*draft: true,/, '') + s.slice(j); writeFileSync(f, s);
  execSync('node tools/build.mjs', { cwd: root, stdio: 'inherit' });
  const d = join(root, `docs/posters/${slug}.md`); let md = readFileSync(d, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  md = /\*\*Status:\*\*[^\n]*/.test(md) ? md.replace(/\*\*Status:\*\*[^\n]*/, `**Status:** published ${today}. Test at \`/?p=${slug}\`.`) : md.replace(/\n/, `\n\n**Status:** published ${today}.\n`);
  writeFileSync(d, md);
  console.log(`\n${slug} is published: draft flag removed, share page written (p/${slug}/index.html), docs status updated.\nLast steps (see docs/PIPELINE.md): review the diff, commit, push to portfolio-v1 then main as idansgv.`);
} else { console.log('usage: node tools/graduate.mjs status | check <slug> [--fast] | apply <slug>'); process.exit(2); }
