// Copy-prompt lint: every published poster has a prompt, and the prompt names the typeface the poster is set in.
// No browser needed. Reads the registry (src/posters/index.js) directly.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const REGISTRY = path.join(__dirname, '..', '..', 'src', 'posters', 'index.js');

// Posters that set their type in a face other than the registry's share-image face.
const DRAWN_IN = { 'slinky-type': 'Boldonse' };

test('every published poster has a copy prompt that names its typeface', async () => {
  const { PUBLISHED } = await import(pathToFileURL(REGISTRY).href);
  const problems = [];
  for (const p of PUBLISHED) {
    if (!p.prompt) { problems.push(`${p.slug}: no prompt`); continue; }
    // Names its typeface, or says it draws its own letters, or is set in any Google Font (fontapalloza).
    const named = DRAWN_IN[p.slug] || (p.face && p.face.family);   // registry face, unless the poster draws in another (its share image still uses the registry face)
    if (named && !p.prompt.includes(named) && !/its own letters|Google Font/.test(p.prompt)) problems.push(`${p.slug}: prompt does not name a typeface`);
  }
  expect(problems).toEqual([]);
});
