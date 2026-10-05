# idansegev.com: the project

Status on 5 October 2026. Live at https://idansegev.com (the `main` branch). Repository: `idansgv/still-water-type` (public). Local checkout: `~/Documents/Coding/lyric-ripple`.

## 1. What it is

A personal site for a design leader that opens with play. The front page is a random interactive typographic poster: simple, bold, black and white type that reads as plain at rest and hides a real piece of technology underneath (a fluid simulation, a baked cloth simulation, soft-body physics, rigid-body physics with fracture). Every load shows a different poster. The thesis in one line: **the craft is the credential.** A design leader who can make type melt in a shader is saying something about how their teams work without a paragraph saying so.

A magazine-style "Work" section (the Moovit case first) is built but **not live**; it is preserved on the `work-moovit` branch until the case's asset rights and a font licence are settled.

Audiences: hiring leaders and peers arriving from LinkedIn (taste, technical fluency and humour in ten seconds), the design community (something worth sharing: a poster, not a profile), and Idan's own teams and candidates.

## 2. Principles

1. **Simple on top, wild underneath.** A poster reads as flat black and white type at rest. The technology is a discovery, not a banner. If a poster needs instructions it is not finished.
2. **Random is the theme.** Random poster, seed, theme, tagline, click sparks. Randomness is seeded, bounded and reproducible (`#s=<seed>`).
3. **Hidden, not lost.** Work is quiet, never missing.
4. **Mobile is the main screen.** Touch, tilt and phone-sized composition come first.
5. **One loud thing.** The posters are the boldness. Everything around them (the footer, copy) stays disciplined and quiet.
6. **No build, no dependencies.** Plain ES modules and hand-written shaders, deployable by copying files. One deliberate exception: the Rapier physics engine (a WASM file, 2 MB) is vendored for the physics posters.

### Taste rules (Idan's, stated in review rounds)

- Pure black and white. No accent colour. (Posters that offer colour controls offer black to white only.)
- No automatic effects at rest beyond one short intro. A hint may be motion (Soft type's breeze and breathing letters), never words. No instructional text.
- Nothing decorative that does not belong to the material. Restraint: effects are proportional and continuous, with memory that decays.
- Never show debug text to visitors.
- Show a preview and wait for a "push" or "publish" before changing `main` (in practice Idan says "push" and the work goes to `main` in the same round).

### The bar for a poster (taken from Still Water)

One material rather than an effect; the type stays intact and legible; the response is proportional with memory; a small, asymmetric composition with plenty of empty space; still at rest; nothing instructional.

## 3. Repository layout

```
index.html              the shell page: meta and share tags, stage, footer, no-JavaScript fallback
src/main.js             picks a poster, mounts it, shuffle, share, keys, click sparks, panel wiring
src/engine.js           the stage every poster gets (canvas, clock, input, tilt, seeded random, GL and type helpers)
src/panel.js            the settings panel (?tune, or T)
src/shell.css           page styles, panel styles, mobile behaviour
src/posters/index.js    the registry: one row per poster (pure data plus lazy loaders)
src/posters/*.js        one file per poster; shared modules listed below
src/vendor/             rapier.es.js (Rapier WASM build, Apache-2.0) and its licence
p/<slug>/index.html     generated share pages (node tools/build.mjs); one per published poster
assets/                 favicon, touch icon, share image
tools/                  dev.py, build.mjs, og.html + save-server.py, vat-extract.mjs, motion-check.html, sync-moovit.sh
docs/                   this documentation
BRIEF.md                the running record
vercel.json             trailing slashes, asset caching
```

Shared poster modules: `lettering.js` (the I D A N S E G V letter skeletons and stroke thickness, used by Soft type, Collapse and Explode), `physics.js` (the Rapier wrapper), `shatter.js` (convex fracture), `dust.js` (GPU particles), `lib3d.js` (matrix helpers), `columns-core.js` (the engine behind Collapse and Explode).

## 4. How the front end works

**Shell (`src/main.js`).** Picks a poster at random from `PUBLISHED` (never the one shown last, remembered in `localStorage`), mounts it, and keeps the page furniture honest: the footer with the name and a random tagline ("Design leadership and Builder culture, ..."), a folio ("Soft type 3/4"), LinkedIn and X links, and Shuffle and Share buttons. Keys: Space, Enter, right arrow or R shuffle; S shares; T opens a poster's settings panel. Every press on the stage throws a burst of six random ASCII glyphs (the click spark). The footer text is selectable; the poster, the buttons and the page background are not, and the long-press menu is blocked on the stage so a long press on a phone does not select the page. A poster that throws, or a browser without WebGL2, falls back to the poster's words set in big type.

**Engine (`src/engine.js`).** `createStage(root, options)` returns a stage `ctx` with:

| Member | What it is |
|---|---|
| `canvas`, `W`, `H`, `pw`, `ph`, `dpr`, `scale` | the canvas, its CSS size and its pixel size |
| `look` | x and y in -1..1, smoothed: mouse hover, finger drag or device tilt, one vector for all three |
| `ptr`, `on('down'\|'move'\|'up'\|'resize', fn)` | pointer events in CSS pixels |
| `frame(fn)` | the animation loop, `fn(dt, t)`; the loop pauses when the tab is hidden |
| `step(ms)` | advance the loop by hand (used in tests, where a hidden tab pauses requestAnimationFrame) |
| `rand()` | seeded random (mulberry32), so a poster can be reproduced from a seed |
| `theme`, `colors`, `reduced`, `adaptive`, `setBackdrop(level)`, `setScale(s)` | colours, reduced-motion flag, an optional frame-time governor, and a way for a poster to set the page background |
| `typeMask`, `coverage`, `compile`, `texture`, `uploadCanvas`, `getGL` | type and WebGL helpers |

A poster exports `mount(ctx)` (it may be async) and returns `{ destroy(), tune?, debug? }`. `tune` hands the settings panel its controls (see section 6). `debug` is for tests. A poster is registered with a row `{ slug, title, words, blurb, hint, themes, draft?, load }`; `draft: true` keeps it out of the random rotation and out of share pages, but `?p=<slug>` still loads it.

**Share pages.** `node tools/build.mjs` writes `p/<slug>/index.html` for every published poster, with that poster's own title, description and preview so a link unfurls well. Shuffling away from a share page returns the address bar to `/`.

## 5. The physics, GPU and effects stack

- **Rapier** (Apache-2.0, a WASM build vendored as one file, 2 MB, 0.77 MB gzipped) runs the rigid-body posters (Collapse, Explode, Skyline). It loads when one of those posters opens (about 55 ms from cache). The posters never call Rapier directly: `src/posters/physics.js` presents bodies as plain objects (`position`, `quaternion`, `velocity`, refreshed after each step, and only for bodies that are awake) and offers `fixed`, `dynamic`, `box`, `hull`, `castDown`, `cast`, `contactPoint`, `step(dt, onHit)`. A future engine swap is local to that file. cannon-es (pure JavaScript, 140 KB) was used for a few hours first and replaced after measurement: on real posters a frame cost 20 to 27 ms there against 0.7 to 1.8 ms on Rapier.
- **Fracture** (`shatter.js`): a box is broken into irregular convex pieces by scattering seed points through it and giving each seed the part of the box closer to it than to any other seed, built by cutting the box with the bisecting planes. Volume is conserved (checked), pieces are convex so they can be rigid bodies directly.
- **Dust** (`dust.js`): a GPU particle system, a ring buffer of up to 9,000 particles each with a start position, velocity, birth time, life and size; the vertex shader works out where each one is at any moment (thrown, slowed by drag, drifting up, spreading as it thins) so the CPU does nothing per frame. Camera-facing quads, noise-eroded so a puff is ragged, with controls for tone, softness and opacity.
- **Instanced drawing**: standing columns are one instanced draw of boxes; shattered pieces are free-form meshes in one growing vertex buffer, each placed every frame from a float texture of transforms.
- **Projection** (Sheet, Skyline): the print is a type mask looked up through a projector that sits exactly where the camera starts, so at rest the print is flat whatever geometry it lands on; moving the view reveals the geometry.
- **Letters** (`lettering.js`): each of I D A N S E G V is a few skeleton strokes in a unit box. Soft type turns them into particles; Collapse and Explode turn them into overlapping boxes with mitred joins.

## 6. The settings panel

`src/panel.js`. Open it with `?tune` on the address or by pressing T (on a phone, only `&tune` works). A poster returns `tune = { title, values, defaults, groups, actions, set(key, value), reset() }`; items are sliders or on/off toggles; actions are buttons. "Copy settings" puts the current values on the clipboard as JSON, which can be pasted into the poster's defaults (that is how Idan's tuned values became the Explode and Sheet defaults). Values persist per poster in the browser while `?tune` is on. Posters with a panel: Sheet, Soft type (Re-form), Collapse, Explode, Skyline.

## 7. Address switches

`/?p=<slug>` forces a poster; `&theme=light|dark` forces a theme; `#s=<seed>` replays a random variation; `?tune` shows the settings panel; `?debug` shows poster errors as an on-screen toast; `?live` makes Still Water mirror a local Wordflow3d server (off by default, because a public page reaching for localhost can trigger Chrome's local-network prompt).

## 8. Development and testing

- Local preview: `python3 tools/dev.py 8910` (a no-cache server; plain `http.server` lets browsers keep stale ES modules). `file://` does not work with ES modules. Even with no-cache, Chrome can reuse an imported module from memory within a tab: hard-reload (Cmd+Shift+R) if an edit does not show.
- After changing the registry: `node tools/build.mjs`.
- Testing in the preview browser: a hidden tab pauses `requestAnimationFrame`, so drive a poster with `window.__poster.stage.step(16)`; `window.__poster.inst.debug` exposes each poster's internals. A freshly opened preview pane can be 1 by 1 pixels: resize it, then reload. Screenshots can be stale by one capture; overlaying `canvas.toDataURL()` images in a div is a reliable way to inspect frames.
- **Verify pixels, not just state.** One bug (pieces all drawn at the centre of the stage) passed every check that counted bodies and particles; only a rendered frame shows it.
- Share images are drawn in the browser by `tools/og.html` and saved by `tools/save-server.py`.

## 9. Deployment

- Hosting: Vercel, project `ripple`, repo `idansgv/still-water-type`. `main` deploys to idansegev.com (DNS at iwantmyname.com). Other branches get preview deployments, which Vercel may put behind its login.
- Working branch: `portfolio-v1` (kept equal to `main` once pushed). The Work section lives on `work-moovit`. The single-poster version of the site is tagged `still-water-v1`.
- Three GitHub accounts are signed in to `gh`; this repository needs `idansgv`. A 403 on push means the active account has changed: `gh auth switch -u idansgv`, then push again.
- Releasing = fast-forward `main` to `portfolio-v1` and push; the site updates within a minute. Verify with a request for a file that changed.

## 10. Licences and third-party material

| What | Where | Licence / status |
|---|---|---|
| Rapier physics (WASM build) | `src/vendor/rapier.es.js` | Apache-2.0, notice beside it |
| Crumple simulation data (Sheet) | `src/posters/data/crumple.bin` | MIT, Toi Nagasawa / ITEM Inc., notice beside it |
| Archivo, IBM Plex Mono | Google Fonts | open fonts, loaded from Google |
| DynaPuff (only the removed Puff poster) | Google Fonts | open font |
| Leida (Moovit case) | not shipped | licence unconfirmed; the case falls back to Georgia |
| Apple ml-sharp | not used | research-only licence, 2.8 GB; deliberately not run |
| cullenwebber/three-ml-sharp | idea only | no licence; no code copied |
| Soft type's idea of soft-bodied type | idea only | our own implementation; no code copied |

The Moovit case carries screenshots and photographs whose publishing rights are unconfirmed; that is one of the two reasons Work is held back (the other is a 19 MB asset weight).

## 11. How we work

One poster at a time: propose, get a yes, build one, show it, iterate in short rounds. Idan reviews on a preview and tunes values in the settings panel, pastes the JSON, and those become the defaults. Each round is committed with a clear message and recorded in `BRIEF.md`. A rejected idea is recorded and not revisited (Emboss; Drape was removed in one round for being too soft).

## 12. Known risks and open items

- **Phones.** Sheet, Soft type and Explode have been looked at on a phone only in part. Explode adapts to slow devices (a piece-size multiplier that starts coarser on weak phones and a frame-time governor that coarsens it further and clears resting rubble), but has not been measured on an old phone.
- **Work is held back**: asset rights, 19 MB of assets, an unlicensed font. Rebuild from the `work-moovit` branch (`tools/sync-moovit.sh`) when ready.
- **One old commit message** (`062b520`) names the site that inspired Soft type; removing it needs a history rewrite and a force-push, which has not been done.
- **Resize resets a physics poster**, because it rebuilds the world for the new size.
- **Rapier is 2 MB** and loads when a physics poster opens; a slow connection will notice the first time.
- **Repo and Vercel project names** (`still-water-type`, `ripple`) predate the site; renaming is an open decision.

## 13. Roadmap

Nearest: tune and check Explode, Collapse and Skyline on real phones; decide which of Collapse and Skyline join the shuffle; build the Garden (see the archive entry); return Work. Later: per-poster share images, "save this poster as an image", a second case study, privacy-friendly analytics, a short about page, poster weights tuned from what people do.

## 14. Lessons that shaped the work

- Why Still Water works: one material and one gesture; the type never breaks; the water remembers, then forgets; a small asymmetric composition with a lot of black; still at rest.
- What did not work: effects applied to type rather than a material the type lives in; simulated lighting on a surface (Emboss); soft geometry for a projection (Drape); building several posters in one pass without Idan in the loop.
- What is landing: physical, familiar materials behind the type (glass, paper, cloth, stone, balloons), where the response has memory; real simulation data beats procedural noise; hand-drawn cartoon marks (curved, round-capped strokes that travel out and thin away) beat schematic lines.
- Engineering: measure before choosing an engine (the cannon-es to Rapier switch); create anything placed from a screen scale after the scale is known (an invisible wall bug on phones); size a texture's data from the texture itself.
