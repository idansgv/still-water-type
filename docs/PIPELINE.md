# From a rough idea to a published poster

The rhythm we already work in, written down, with a gate at the end that enforces the standard. Shadow (`docs/posters/shadow.md`) is the first poster built this way (10 Oct 2026).

## The stages

| # | Stage | What happens | Who |
|---|---|---|---|
| 1 | **Idea** | A rough sentence. It goes into `docs/posters/<slug>.md` as the brief, in Idan's words. | Idan |
| 2 | **Draft** | `src/posters/<slug>.js` (`mount(stage)` returns `{ destroy, tune?, debug? }`), a registry row with `draft: true` in `src/posters/index.js`, the docs page. Reachable at `/?p=<slug>` (settings panel: `&tune`). A draft is not in the shuffle and has no share page, so it is safe to push. | Claude |
| 3 | **Iterate** | Build, look at a screenshot (1280x800, both themes, a moved lamp or a touched state), adjust, repeat. Small commits, pushed to `portfolio-v1` then `main` as `idansgv`. Idan reacts to the live draft; each reaction is one more round. Failed attempts and why go to the poster's docs page (or `-log.md` when long). | both |
| 4 | **Standard** | The rules below. Built in from the start, not added at the end. | Claude |
| 5 | **Gate** | `node tools/graduate.mjs check <slug>`: static checks, then the browser gate. Must pass. | Claude |
| 6 | **Review** | Idan looks at the draft on desktop and phone and says yes. This is the only gate that is taste, so it is not automated. | Idan |
| 7 | **Publish** | `node tools/graduate.mjs apply <slug>` removes `draft: true`, writes the share page, flips the docs status. Move the poster's row into the published table in `docs/INTERACTIONS.md`, commit, push to `portfolio-v1` then `main`, check the live page returns 200. Update the memory note. | Claude, on Idan's yes |

Nothing is committed or pushed by the scripts. Publishing is outward-facing: it only happens after stage 6.

## The standard (what every graduating poster must do)

- **Mount and destroy.** Returns `destroy()`; the shell calls it on every shuffle. It removes its own listeners, canvases and backdrop (the gate checks).
- **Black and white.** Read `stage.theme.name` / `stage.flip`. The first poster is black on white and each shuffle swaps (`src/main.js` owns it). Strictly black, white and greys; nothing coloured.
- **Gestures.** Use `src/gestures.js`: tap under 250 ms and 8 px, hold at 250 ms (a per-poster action, or none), double tap on empty space 380 ms (re-form, if the poster has one, after a 420 ms beat so a third tap can mean reveal). Tapping the background does nothing else.
- **Reveal.** Three quick taps invert the page and show what the poster is made of, with `createReveal` from `src/posters/reveal.js` (or `stage.on('reveal')` for a poster with its own look, like Still Water's lamp). Drawn in the poster's foreground colour; the page inversion does the rest.
- **Hints.** No instruction text. Either none, or one quiet self-demo after about 3.5 s untouched that stops at the first touch and is off under reduced motion. A registry `hint` is one short line, null by default.
- **Calm.** No idle motion except that demo. Under `prefers-reduced-motion` a poster stands still (the gate checks).
- **Settings panel.** Optional, for tuning (`tune`); no settings required to look right.
- **Docs.** `docs/posters/<slug>.md` (brief, what it is, interactions, open items) and a column or section in `docs/INTERACTIONS.md`.
- **Fonts.** Trial fonts stay local (`assets/fonts/*` is git-ignored); the gate fails if any are tracked.

## The gate

`node tools/graduate.mjs check <slug>` (add `--fast` to skip the browser). `status` lists every poster and whether it passes the static checks.

Static (`tools/graduate.mjs`): registry fields (slug, title, words, blurb up to 140 characters, hint, themes), exports `mount`, returns `destroy`, handles reveal, reads the theme, uses `gestures.js`, docs page exists, listed in `docs/INTERACTIONS.md`, no trial fonts tracked.

Browser (`tools/tests`, Playwright with Google Chrome, `SLUGS=<slug>`):
- `gate.spec.cjs`: destroy leaves nothing behind; reveal draws a layer; calm under reduced motion; background tap, hold and double tap are harmless.
- `site.spec.cjs`: mounts and draws without errors; responsive (phone, tablet, desktop, both themes, no scroll); mouse and touch interaction; frame time; theme alternation; reveal on and off (mouse and touch).

The whole published site: `npm test` (published posters only; `SET=all` adds drafts, `BASE_URL=https://...` tests another build). Needs `@playwright/test` installed globally and Chrome.

## Grandfathered

Still Water, Soft type, Collapse, Explode and Liquid metal were published before the gesture standard. They pass the gate with a note (they keep their own tap thresholds, listed in `docs/INTERACTIONS.md`) and move to `gestures.js` when next touched. Slinky is out of scope until Idan says otherwise.

## The rhythm, in short

Rough idea, then a draft you can touch within minutes; look, react, adjust; the standard is part of the build; the gate runs before anyone is asked to review; one yes publishes; docs and the memory note are updated in the same push.
