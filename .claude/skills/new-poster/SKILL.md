---
name: new-poster
description: Develop, test visually, refine and ship a poster on idansegev.com (type-posters repo). Use when adding a poster, changing one, or tuning its behaviour, layout or name support. Covers the draft in the registry, local checks on desktop and phone, taste calls left to Idan, and shipping with explicit approval.
---

# New poster

Work one poster through four stages. Stop at each gate and say what happened before moving on.

## 1. Develop

- Start the poster as a draft: `draft: true` in `src/posters/index.js`, with `slug`, `title`, `words`, `blurb`, `prompt` and `themes`. Put design notes in `docs/posters/<slug>.md`.
- Name support is a separate step. Add `nameable: true` and a `face` only after the poster reads its words from `stage.words` (through `linesFor` / `lettersFor` in `src/name.js`).
- Shape-based posters use `src/posters/lettering.js`. Font-based posters load their face with `text=` or a full family.

## 2. Test visually

- Run `python3 tools/dev.py` and open `/?p=<slug>`. Check each variant:
  - default (no name)
  - a one-word name, for example `&n=Andre`
  - a two-word name, for example `&n=Jane%20Doe`
- Check both a desktop viewport and a phone viewport (390 wide). On a phone, look for the static fallback, which means the poster threw an error.
- Check the console for errors. Physics and WebGL posters often draw only after a tap, so wake them with a real click before judging.
- Compare with the live version (`https://idansegev.com/p/<slug>/`) when changing an existing poster.
- If a headless browser runs differently from a real phone, say so and ask Idan to confirm on his device.

## 3. Refine

- Make small edits and re-check. Keep a note of what changed and why.
- Taste calls are Idan's: composition, colour, timing, font choice, and what a tap or double tap does. Ask rather than decide them.
- Watch for these known traps:
  - `const` reassigned in layout code (a phone-only crash that shows the fallback)
  - name splits producing single-letter rows (keep at least two letters a row)
  - zoom or fit that clamps letters small on phones
  - unused state left behind after a gesture changes

## 4. Ship

- Commit locally with the Co-Authored-By line. Use one commit per change.
- Push and publish only on an explicit yes from Idan, using the push command in the repo notes. Never push on "looks good" alone.
- After a push, confirm the change is live: fetch the served file with curl and grep for a new string, then load the page.
- If `src/posters/index.js` changed, run `node tools/build.mjs` and commit the regenerated `p/` pages, `sitemap.xml` and `robots.txt`.
- Never stage another session's files (for example `moire-phase`, `wet-glass`, `cards`, `cats-paw`, `vessel`, `voronoi-3d`, `test-results/`).
