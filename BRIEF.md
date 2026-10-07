# Idan Segev, personal site: brief

Version 0.3, 5 October 2026. Live on idansegev.com (`main`): Still Water, Sheet and Soft type in a random rotation.
The Work section is built but held back (section 16). Written for Idan and for any Claude Code session that picks this
up later, so it records decisions, reasons and dead ends, not only wishes. The running record is section 14; what each
live poster is and how it is tuned is section 17; what comes next is section 18.

---

## 1. What this is

A design leadership portfolio that opens with play. The front of the site is a series of interactive
typographic posters about design and technology coming apart. Each one looks like a simple, bold, black and
white graphic and hides a real piece of web technology underneath: a fluid simulation, a ray-marched slab,
a cloud of tens of thousands of points that only resolves from one viewpoint. Visitors get a different poster
on every load. A little behind that, in a magazine-like section, sit the case studies from Idan's current and
previous roles.

The thesis, in one line: **the craft is the credential.** A design leader who can make type melt in a shader
is telling you something about how their teams work, without a paragraph saying so.

## 2. Who it is for, and what it has to do

| Audience | What they should leave with |
|---|---|
| Hiring leaders and peers arriving from LinkedIn | Taste, technical fluency, and a sense of humour, in ten seconds. Then, if they look, credible leadership work. |
| The design community | Something worth sharing: a poster, not a profile. |
| Idan's own teams and candidates | Proof that the person who asks for craft practises it. |

Success looks like: someone refreshes three times to see what else is in there; someone shares one poster
link and the preview looks great; a recruiter finds the work in under thirty seconds without being told where.

## 3. Principles

1. **Simple on top, wild underneath.** Every poster reads as flat black and white type at rest. The technology
   is a discovery, not a banner. If a poster needs instructions, it is not finished.
2. **Random is the theme.** Random poster, random seed, random theme, random tagline, random ASCII sparks.
   Randomness is a design material here, so it is seeded, bounded and reproducible (section 6).
3. **Hidden, not lost.** The work section is quiet, never missing. A visitor who looks for it finds it.
4. **Mobile is the main screen.** Touch, tilt and a phone-sized composition come first; desktop is the wide
   version of the same thing.
5. **One loud thing.** The posters are the boldness. Everything around them (chrome, Work, copy) stays
   disciplined and quiet.
6. **No build, no dependencies.** Plain ES modules and hand-written shaders, deployable by copying files. It
   stays hackable and it will not rot. One deliberate exception (5 October 2026): `src/vendor/rapier.es.js`, the Apache-2.0 rigid-body physics engine Rapier (a WASM build, 2 MB, 0.77 MB gzipped), vendored as a single file with its licence beside it, for Collapse, Explode and Skyline only; it loads when one of those posters opens. (It replaced cannon-es, which was in for a few hours: see section 17.)

## 4. Experience map

```
 /                 a random poster, full bleed          Shuffle · Share · Work · LinkedIn · Instagram · X
 /p/<slug>/        one specific poster (what Share links to)
 /work/            the index: masthead, one feature per case
 /work/moovit/     a case study (the first)
```

Keys on the front: Space, Enter, → or R shuffle. S shares. T opens a poster's settings panel when it has one. Still Water also has L (lamp), X (rain). (The Work routes and the W key are not live: see section 16.)

### The door to Work: options

The brief says "a little hidden". These are the candidates, with what each costs.

| Option | Feels like | Risk |
|---|---|---|
| **A. Quiet text link plus the W key** (shipped in v0.1) | Page furniture, like a magazine's folio | Not hidden, only unemphasised. Safest for recruiters. |
| B. A hot spot inside each poster, a random ASCII glyph that opens Work when clicked | A real easter egg, and on theme | Some visitors never find it |
| C. Pull-up handle at the bottom edge, drag to lift the poster off and reveal the index | Mobile-native, tactile | Competes with posters that use vertical drag |
| D. Long-press anywhere for one second | Invisible | Undiscoverable and unreliable on iOS |
| E. Reveal after the third shuffle ("you stayed, here is more") | Rewards curiosity, fits random | Hides work from people in a hurry |

Recommendation: ship A now, add B as a delight on top, and judge from real visits whether A can go.
To make it fully hidden today, delete the `Work` link in `index.html` and keep the W key.

## 5. The poster series

> Status note (5 October 2026): this section is the original thinking and the history of every poster tried. Only Still Water, Sheet and Soft type are live; Meltdown, Breath, Puff and Point of view were removed, Emboss was rejected. Section 17 describes the live ones as they are now.

### What makes a poster

1. A flat, bold typographic composition, black and white, readable in one glance.
2. One hidden depth: a real technique, cleverly masked by the flatness.
3. An interaction discovered by touch, with no instructions. At most one quiet hint line after 6.5 seconds of
   no interaction, and only if the poster defines one.
4. Works with mouse, finger drag and device tilt, through the shared `look` vector.
5. Degrades to static type if WebGL2 is missing or the poster throws.
6. Honours reduced motion, and both themes where it makes sense.

### Where each poster stands

Only posters that clear the bar are in the random rotation (`PUBLISHED` in `src/posters/index.js`). Drafts stay
reachable with `?p=<slug>` while they are reworked, and get no share page.

The bar, taken from Still Water: one material rather than an effect; the type stays intact and legible; the
response is proportional and continuous, with memory that decays; a small, asymmetric composition with plenty of
empty space; still at rest; nothing instructional.

| Poster | Status | At rest | Hidden underneath | Touch |
|---|---|---|---|---|
| **Still Water** (`still-water`) | **Published.** The benchmark | White "Idan / Segev" on black | Wave-equation ripple simulation on the GPU; a lamp (L, or three taps) casting caustics through the water | Move to wake the water; tap to drop |
| **Sheet** (`sheet`) | Draft. Idan: "Like it" | A flat white sheet with black type ("Nothing to see here.") | Type projected onto paper whose shape is a baked cloth simulation; flat from the projector's view, wrinkles appear on tilt | Move or drag or tilt to reveal; click to crumple, throw, and unfold a new sheet |
| **Breath** (`breath`) | Draft. Idan: "has potential" | Dark frosted glass with "Clear." behind it, soft and legible | A fog field that regrows from its neighbours, read through a fixed grain map so it breaks into patches | Drag to wipe a clear path; hover wipes lightly; the fog closes back from the edges, specks last |
| *Meltdown* (`meltdown`) | Draft. Not at the bar | "MELT / DOWN" in crisp type | A heat field plus a shader that finds the nearest letter upstream along gravity and pours it as round-tipped drips | Hold or drag to melt; it re-solidifies |
| *Point of view* (`point-of-view`) | Draft. Not at the bar | A drifting cloud that nearly reads "POINT OF VIEW" | 20–40k points on sight lines from one secret viewpoint (an anamorphosis), random per load | Move or drag to look around; find the angle |
| ~~Emboss~~ (`emboss`) | **Rejected** ("sucks"). Do not revisit | "Flat. / Not entirely." blind-embossed paper | Height field from the type mask, a raking light, finger dents | Move the light; press to dent |
| ~~Flat~~ | Retired | The word FLAT, ray-marched as a solid slab | Ray-marched extrusion | Orbit |

#### Sheet in detail

- **Concept.** "Type projected on a lightly wrinkled piece of paper; only on camera tilt does it become clear,
  otherwise it looks completely flat." The camera at rest sits exactly where the projector is, so the type is a
  perfectly flat print and the paper shows no relief and no shading. Moving the view makes the same projected
  type slide across the folds (warps in the lettering, a trace of shading, curling corners and edge).
- **The paper.** A cloud of 170–250k GPU point sprites laid out from `gl_VertexID`, so a new sheet costs almost
  nothing. Its shape is a real cloth simulation: a Houdini Vellum crumple baked as a Vertex Animation Texture by
  Toi Nagasawa (MIT, `github.com/item-develop/paper-crumple-demo`, from the Codrops article "Building an
  Interactive Crumpled Paper Effect with Houdini VAT and Three.js"). `tools/vat-extract.mjs` decodes it offline
  into `src/posters/data/crumple.bin` (1.75 MB, 50 frames of a 70×50 grid, with normals and a cavity term); the
  licence notice sits beside it. In the browser the data becomes two `TEXTURE_2D_ARRAY`s sampled in the vertex shader.
- **Resting wrinkles** are an early frame of the paper buckling (frames 13–19 buckle without shrinking), default
  frame 16, adjustable as "Wrinkle depth". Each sheet mirrors the data randomly, jitters the frame, and adds a
  little hand-made crease noise, so no two match.
- **Crumple and unfold.** A click or tap (not a drag) plays the simulation forward into a ball with real folds,
  the type folding into the creases; the ball tumbles off a random edge. The next sheet arrives as a tumbling
  ball from the opposite side and the simulation plays back to unfold it, with the next line of copy.
- **Reveal logic.** Shading is a difference from the view at rest, and the crease-shadow (ambient-occlusion
  stand-in, baked) is gated by how far the view has moved, so rest stays flat. While crumpled it uses plain lighting.
- **Not adopted from the article:** the physics engine (grab, push, roll, throw) and the SSAO post pass.
- **Copy.** Eight dry one-liners are placeholders (editable in the panel): Nothing to see here. / Still flat. / Look
  again. / Handle with care. / Version 7. Final. / Please do not fold. / Draft. / Not a poster.
- **Tuning panel.** `?p=sheet&tune` (or press T): a Shadows on/off switch (off removes all shading and creases'
  shadow, leaving only the geometry), background, paper and type greys (0 black to 1 white; the page chrome
  follows the background), relief, wrinkle depth, extra creases, sheet size, point count,
  shading, crease shadow, tilt range and follow speed, opening sway, the lines of type, type size and margin,
  crumple / throw / unfold times. Values persist per browser while `?tune` is on; "Copy settings" outputs JSON to
  paste into `DEFAULTS` in `src/posters/sheet.js`. The panel is `src/panel.js`; any poster can use it by returning
  `tune` from `mount()`.
- **Open risk.** Each point does about 14 texture reads in the vertex shader. The frame-time governor lowers pixel
  resolution but not point count, so on a slow phone the "Points" slider is the lever. Not yet measured on a phone.

### Backlog (ideas, unranked)

- **Drop**: letters are rigid bodies that fall under real gravity (tilt sets it), pile up, can be thrown.
- **Kerning**: type that swells and narrows under the cursor, using the variable axes of Archivo.
- **Orbit**: a word wrapped round a sphere you can only read by turning it.
- **Print**: halftone misregistration, CMYK plates that slide apart when you press.
- **Cut**: paper layers with real parallax and soft shadows, tilt to peel.
- **Static**: a CRT and signal-loss poster; the picture tears and re-locks.
- **Rain**: the whole word built from ASCII, which falls and re-forms (links to the click sparks).
- **Ink**: type bleeding into a fluid you can stir.
- **Echo**: audio-reactive, tied to the Wordflow3d work, only on request (microphone permission).

### Adding a poster

1. `src/posters/<slug>.js` exporting `mount(ctx)`; return `{ destroy() }`.
2. Add a row to `src/posters/index.js` (title, words, blurb, hint, theme odds, loader).
3. `node tools/build.mjs` to write its share page.
4. Check at phone width, in both themes, with and without reduced motion.

`ctx` gives a poster: `canvas`, `W/H` (CSS px) and `pw/ph` (canvas px), `look` (x, y in −1..1, smoothed;
mouse hover, finger drag or tilt), `ptr` and `on('down'|'move'|'up'|'resize')`, `frame(fn)`, `tilt`
(raw sensor, plus `gx/gy` real gravity direction), `rand()` (seeded), `colors`, `theme`, `reduced`,
`toast()`, and `adaptive = true` to opt into the frame-time governor. `src/engine.js` also has
`typeMask()` (poster-style type fitting, with rotation for phones), `getGL`, `compile`, `texture`.

## 6. The random system

| What | How |
|---|---|
| Which poster | Uniform pick, never the one just shown (remembered in `localStorage`) |
| Seed | One 32-bit number per load; every random choice inside a poster comes from it |
| Theme | Per-poster odds (Sheet and Breath are dark only as built; Still Water is dark only). Forced with `?theme=` |
| Tagline | One of six lines under the name, per load |
| Click spark | Six ASCII glyphs per press, random character, angle, size |
| Inside posters | Melt origin, the secret viewpoint, the scatter of points |

A shared link carries its seed: `/p/point-of-view/#s=1k9x2a` replays the same variation, including the same
secret viewpoint. Rules: randomness must never make a worse poster, so every variant has to be checked at
both extremes; and there are no automatic effects at rest (Idan removed the idle drips early on). Each
poster gets exactly one short intro gesture on load so the first second says "touch me".

## 7. Work: the cases

**Direction.** The inverse of the playground. White paper, black type, a very large word, serif text set to be
read. Magazine devices (masthead, feature, "next issue") rather than a card grid. Immersive reading comes
from full-bleed images, generous measure, scroll-driven reveals and pull quotes, case by case.

**Shape of a case** (a suggestion, not a template; the Moovit port predates it and keeps its own form):
the question; context and constraints; role and team; three or four decisions, each with its artefact;
what happened; what I would do differently. Leadership work should show how decisions were made, not only
what shipped.

**Pilot: Moovit.** A faithful React port of the earlier Readymag case, rebuilt from an archived save, lives in
its own repo (`~/Documents/Coding/portfolio`, branch `custom-engine-optimised`) and is vendored here at
`work/moovit/` by `tools/sync-moovit.sh`. That script patches only a scratch copy, so the source repo is
untouched. On phones it uses the port's own stacked fallback. Still open, from that repo's `HANDOFF.md`:
two outbound URLs, a lower-page re-save, and the "Welcome to Chicago" screen.

**Content Idan needs to supply or confirm**

- Which roles become cases, in what order, and the one-line framing of each.
- Approval from the relevant employer for anything from a current or recent role, and any NDA limits.
- Numbers and credits that can be public.
- A short bio for the index, if wanted.

## 8. Visual system

| | |
|---|---|
| Colour | Black `#000`, white `#fff`, one dim grey (`#8a8a8a` on black, `#767676` on white). No accent. A light theme appears at random on the playground; Work is always paper |
| Type | Archivo 900 for posters and the Work masthead; IBM Plex Mono for page furniture, sentence case; Newsreader for text on Work |
| Motion | Only what answers a touch, plus one intro gesture per poster. Cross-page fades via view transitions. No scroll-reveal confetti |
| Micro | The ASCII click spark, on every press, everywhere on the playground |
| Voice | Plain, dry, short. Sentence case. "Shuffle", "Share", "Link copied". Taglines may joke; labels never do |

## 9. Sharing and mobile

- **Share previews.** `assets/og.png` (1200×630: the name, melting) for the site. Every poster has its own page at
  `/p/<slug>/` because link-preview crawlers do not run JavaScript, so per-poster titles and descriptions have
  to be in static HTML. Per-poster images are supported: drop `assets/og-<slug>.png` and rebuild.
- **Share button.** Uses the system share sheet where there is one, otherwise copies the link.
- **Phone details.** `viewport-fit=cover` with safe-area padding; browser chrome colour follows the poster
  (`theme-color`); `100%` heights rather than `100vh`; generous touch targets in the page furniture on coarse pointers.
- **Tilt.** Android and desktop browsers start it automatically. iOS asks once, on the first touch, and if the
  device refuses (including managed phones that block motion access) the site silently carries on without it.
- **Performance.** Pixel ratio capped at 2. Expensive posters opt into a frame-time governor that lowers render
  resolution when frames run long and restores it when there is room. Particle counts are capped on small
  screens. Rendering pauses when the tab is hidden.
- **Accessibility.** A visually hidden `h1`; canvases are `aria-hidden`; if WebGL2 is missing or a poster
  throws, the poster's words are shown as large static type; visible focus; reduced motion softens or removes
  intro gestures, sparks and tilt.

## 10. Technical notes

```
index.html            shell, meta, page furniture
src/engine.js         stage, clock, input, tilt, GL and type helpers
src/main.js           picking, mounting, shuffle, share, keys, sparks
src/panel.js          the tuning panel (?tune, or T)
src/shell.css
src/posters/*.js      one file per poster, plus index.js (the registry)
src/posters/data/     crumple.bin (baked cloth simulation) and its MIT licence notice
p/<slug>/index.html   generated share pages (node tools/build.mjs)
work/                 Work index; work/moovit is vendored from its own repo
assets/               favicon.svg, apple-touch-icon.png, og.png
tools/                dev.py (no-cache dev server), build.mjs, sync-moovit.sh, vat-extract.mjs, og.html + save-server.py, motion-check.html
```

Hosting: Vercel project `ripple`, repo `idansgv/still-water-type`, `main` deploys to idansegev.com. Other branches
get preview deployments (which Vercel may put behind login). The pre-portfolio single-poster site is tagged
`still-water-v1`. Share images are drawn in the browser by `tools/og.html` and saved by `tools/save-server.py`.

Local preview: `python3 tools/dev.py` (a no-cache server; plain `http.server` lets browsers keep stale ES modules). Even so, Chrome can reuse an *imported* module from memory within a tab, so if a change does not show up, hard-reload (Cmd+Shift+R) or open DevTools with "Disable cache" ticked.
Dev switches: `?p=<slug>`, `?theme=light|dark`, `#s=<seed>`, `?tune` (settings panel), `?debug` (show poster errors on screen), `?live` (Still Water mirrors a local Wordflow3d server;
off by default because a public page reaching for localhost can trigger a local-network permission prompt).

## 11. Roadmap

- **Done.** Shell, engine, share pages, brief; Still Water, Sheet and Soft type live; Work built and parked; tuning panel;
  dev server; mobile long-press blocked; seven posters tried, four removed, one rejected (Emboss).
- **Next.** Section 18: three new posters (a rethought garden, a type that is projected over hidden geometry, extruded
  type that falls and explodes), each proposed, approved, built one at a time. Also: measure Sheet and Soft type on a real
  phone; decide when Work can return.
- **v0.3.** Per-poster share images; "save this poster as an image" (and share it as a file on phones); Work option B,
  the hidden glyph; a second case; compress the Moovit assets.
- **Later.** Teaching and talks; a case template once two exist; privacy-friendly analytics; a short about page; poster
  order and weights tuned from what people actually do.

## 12. Decisions for Idan

1. Door to Work: keep the quiet link (A), or go fully hidden now?
2. **The Leida typeface.** The Moovit port uses Leida from a free-font aggregator; its licence for web use and
   redistribution is unconfirmed, so it is **not** shipped, and the case falls back to Georgia. Buy a licence or pick
   a licensed serif.
3. Rename the GitHub repo (`still-water-type`) and the Vercel project (`ripple`) to match the site.
4. Which cases next, and who has to approve them.
5. How often should the light theme appear? Currently 0–70% depending on the poster.
6. Keep the Wordflow3d live mode in Still Water?
7. Redirect `www.idansegev.com` to the bare domain?
8. Sheet: keep the placeholder one-liners, or write your own? And do you want grab-and-throw physics on the paper?
9. Promote `portfolio-v1` to `main` now with only Still Water published, or wait until a second poster clears the bar?
10. Apple's ml-sharp model was not used (research-only licence, 2.8 GB). If you want real depth from a photo of paper, that is your call under that licence.

## 13. Risks and notes

- **Rights.** The repo is public and the Moovit case carries screenshots and photographs. Confirm the right to
  publish them, or make the repo private (Vercel deploys private repos fine).
- **Weight.** `work/moovit/assets` is 19 MB. Convert the large PNGs and GIFs to WebP/AVIF and video before launch.
- **WebGL2.** Required by every poster; the static fallback covers the rest.
- **Local network prompt.** Recent Chrome asks visitors for permission when a public page contacts localhost. That
  is why `?live` is opt-in.
- **Phones in managed fleets** can block motion sensors entirely. `tools/motion-check.html` diagnoses it.
- **Shuffle never reloads** the page. On `/` the URL stays `/`, and refresh always gives a new poster. Shuffling away from a `/p/<slug>/` page returns the address bar to `/`.

## 14. Progress log

**Before this brief.** idansegev.com served one poster, Still Water (wave-equation ripples under flat white type,
black background, a hidden lamp). It moved off Readymag onto Vercel (project `ripple`, repo `idansgv/still-water-type`,
DNS at iwantmyname), with real profile links, a click spark of random ASCII glyphs, pure `#fff` type, an optional gyro
parallax, and a `?live` mode mirroring Wordflow3d lyrics. That version is tagged `still-water-v1`.

**2 October 2026, the portfolio build (branch `portfolio-v1`).**

1. **Platform.** A shared engine (`src/engine.js`: stage, clock, unified `look` from mouse, drag or tilt, seeded
   random, GL and type-mask helpers, a frame-time governor), a shell (`src/main.js`: random pick that never repeats,
   shuffle, share, keys, sparks, per-poster permalinks with replayable seeds), per-poster static share pages
   (`tools/build.mjs`), a 1200×630 share image and icons drawn in the browser (`tools/og.html`).
2. **Work.** A white-paper magazine index (`work/`) and the existing Moovit React port vendored under
   `work/moovit/` by `tools/sync-moovit.sh` (the Leida font deliberately not shipped: unconfirmed licence).
3. **Posters, one pass of four** (Still Water ported; Meltdown, Flat, Point of view new). Idan's verdict: none close to
   Still Water's elegance. Flat and Emboss were replaced; Meltdown and Point of view were parked as drafts. A draft
   system was added (`draft: true`) so only posters at the bar are in rotation.
4. **Emboss** (paper relief under a raking light, finger dents). Built, then rejected: "sucks". Parked; not to be
   revisited.
5. **Breath** (frosted glass that wipes clear and fogs back). "Has potential." Parked as a draft.
6. **Sheet** (type projected onto lightly wrinkled paper). Brief from Idan, using the technique of
   `cullenwebber/three-ml-sharp`. First version procedural (point cloud, tilt reveals folds). "Like it." Then added a
   tuning panel and the click interaction (crumple, throw, new sheet). Then rebuilt around the baked Houdini cloth
   simulation from the Codrops VAT article, for realistic wrinkles, crumple and unfold.
7. **Infrastructure along the way.** `src/panel.js` (settings panel), `tools/dev.py` (no-cache server, after a
   stale-module scare), `?debug` error toasts, the draft flag, a guard so Shuffle works with one published poster.
8. **Puff up and away (removed).** Idan's standalone Vite project (Canvas 2D, each letter a balloon on an elastic spring
   mesh) was ported as a draft, and its balloon-rocket idea became the seed of Soft type. Removed from the site later; in
   git history (`e09f0ad` and earlier).
9. **Soft type.** Reverse-engineering a soft-bodied type site showed the idea: letters as particles with a shape memory,
   so type behaves as one elastic material. Our own implementation, then many short rounds with Idan: balloon-rocket
   behaviour, mass equals size, air as stored energy, inflation as a force on the stroke rather than a scale, a
   critical phase and a burst, cartoon marks, a tap that fires by itself, a breeze-and-breathing hint. Full spec in
   section 17.
10. **Release 1** (see section 16): three posters published, four removed, Work held back.

**References parked for later** (not opened or analysed): an Instagram post, reactbits.dev and its tech-text animation,
balloons.shader.se, spacetypegenerator.com, `cullenwebber.github.io/three-html-to-canvas` (flagged by Idan as the most
important), and `github.com/cullenwebber/three-ml-sharp` (its technique informed Sheet; its code was not copied, and
the Apple model it depends on is research-only, so it was not run).

## 15. What we learned making posters

- **Why Still Water works.** One material and one gesture. The type never breaks. The water remembers, then forgets.
  A small, asymmetric composition with a lot of black. Still at rest.
- **What did not.** Effects applied to type rather than a material the type lives in (Meltdown's stock drips, Flat's
  generic extrusion, Point of view's noisy stipple); simulated lighting on a surface (Emboss); building several
  posters in one pass without Idan in the loop. **Rule: propose, get a yes, build one, show it, iterate in short rounds.**
- **What is landing.** Physical, familiar materials behind the type (glass, paper), where the response has memory and
  the reveal needs a gesture. Real simulation data beats procedural noise for realism (Sheet's cloth).
- **Idan's taste rules** (also in the assistant's memory): no automatic effects at rest beyond one short intro (Idan later
  asked Soft type for a faint breeze and recurring breathing as a hint until the first touch, so a hint may be motion, never
  words); no instructional text; pure white on black; no accent colour; never show debug text to visitors; confirm before
  pushing to `main`.
- **Technique notes.** In GLSL `flat` is a reserved word. Inside a ray march use `textureLod`, not `texture`
  (derivatives are meaningless there). Hash-only navigation does not reload a page in the preview browser: add a
  `&v=N` query. A background or hidden tab pauses `requestAnimationFrame`: step the poster manually
  (`window.__poster.stage.step(16)`) when testing. Local `file://` does not work with ES modules: use `tools/dev.py`.
- **Process notes.** Apple's `ml-sharp` is research-only and 2.8 GB, so a personal portfolio should not depend on it.
  Cloudflare-protected pages (Codrops) need the preview browser, not `curl`. Three GitHub accounts are logged into
  `gh`; pushing this repo needs `idansgv` (switch, push, switch back).



## 16. Release 1 (live)

- **Live on idansegev.com (`main`):** Still Water, Sheet, Soft type. Shuffle and a fresh load pick one at random, never the
  same twice in a row.
- **Removed at Idan's request:** Breath ("Clear"), Meltdown, Puff, Point of view. Files and share pages deleted; they are in
  git history (commit `e09f0ad` and earlier). **Emboss** stays a draft (rejected, `?p=emboss`).
- **Work is not live.** The Work index and the Moovit case are preserved on the `work-moovit` branch (rebuild with
  `tools/sync-moovit.sh`). Reasons to wait: Moovit assets are about 19 MB with unconfirmed rights, and the Leida font is
  unlicensed (Georgia fallback). The footer link, the W key and the vendored files were removed from the release.
- **Unverified:** Sheet and Soft type have never been run on a real phone; Sheet's per-frame cost is unmeasured.
- **Credit and trace hygiene:** Soft type's comments describe it as our own work. One old commit message (`062b520`)
  still names the site that inspired it; removing it needs a history rewrite and a force-push, which has not been done.

## 17. The live posters, in detail

### Still Water
A wave-equation ripple simulation under flat white type on black; touch stirs it, the surface remembers then forgets.
Keys L (a hidden lamp) and X (rain). `?live` mirrors a local Wordflow3d server (off by default: a public page that
contacts localhost can trigger Chrome's local-network prompt).

### Sheet
Type projected onto a lightly wrinkled sheet of paper; flat at rest, it only reads as paper when the view moves. The
paper is a baked Houdini Vellum cloth simulation (data from item-develop/paper-crumple-demo, MIT, notice in
`src/posters/data/crumple.LICENSE.txt`, extraction in `tools/vat-extract.mjs`): 50 frames, a 70 by 50 grid stored as
vertex-animation textures. Camera-at-rest equals projector, so the print is flat until the view moves. A click crumples
the sheet, throws it, and a new one arrives as a ball and unfolds. Settings panel at `?tune` or T; defaults are Idan's
tuned values (relief 0, shadows off, light page 0.95). Technique informed by cullenwebber/three-ml-sharp (no code copied;
Apple's ml-sharp model is research-only and was not run).

### Soft type (`src/posters/soft-type.js`)
"IDAN / SEGEV" as thick black strokes on white (a dark theme exists at 15%), plain at rest, a soft material underneath.

**Model.** Each letter is hand-defined skeleton strokes (I D A N S E G V), sampled into round particles. The thick look is
a round-capped stroke along the particle path, drawn piece by piece so its width can vary. Position-based dynamics: distance
links, a bending-smoothing pass, brace links at junctions, spatial-hash contacts, a weak pull toward each letter's own rest
shape (the letter may translate and rotate freely and keeps where you leave it), damping 0.94. Strokes that meet are welded;
a stroke end must not weld onto its own neighbour (that chamfered corners). Every visit starts slightly uneven (tilt ±0.07 rad,
offset ±3.5% of letter height, size ±5%), seeded from the stage seed so a resize keeps it. A resize rebuilds and resets.

**Air.** Each letter has an air level (rest 0.5) and a *mouth* particle (random on every inflation). Air flows in and out
through the mouth and diffuses along the tube, so a swell or a deflation travels along the stroke. Air maps to stroke
thickness `rm(q)`: 0.3 at empty, 1.0 at rest, 2.6 at full. The skeleton itself only stretches 30% of the swell, so a limp
letter keeps its footprint (an early version scaled whole letters and looked mismatched). Mass is ink area (compressed so an
I is light) times length stretch times mean thickness: swollen letters are heavier. In contacts the heavier body gives way
less; heavy letters also coast farther.

**Interactions.**
| Gesture | What happens |
|---|---|
| Drag (move more than 8 px) | the letter bends, squashes against neighbours, stays where you leave it |
| Quick tap (under 0.22 s, no move) | inflates by itself over 0.85 s (eased), then rockets |
| Hold still | inflates at 0.24 air/s from rest to full in about 2 s; releasing before full launches a rocket |
| Hold to full air | *critical* for 1.15 s: the skin ripples, the letter shudders, stress flicks bristle off its outline; release launches at full power, still holding bursts |
| Burst | the letter empties at once, every other letter is thrown away (lighter letters farther, 34 px per frame at the centre falling to zero at 0.6 of the screen), the canvas shakes for 0.4 s, 16 curved cartoon lines fly out |
| Rocket | thrust leaves through the mouth, so as the letter spins the push turns with it; no steering, no gravity; the air burns down in about 0.7 s, the tube thins to limp, thrust and motion die |
| After a rocket or burst | the letter stays where it stopped, drifts a moment, then air creeps back in through the mouth (0.22 air/s) and it re-inflates in place. Over-filled letters leak at 0.9 air/s. Re-form in the panel (T) springs every letter home |

**Marks.** One hand-drawn family in the explosion's language: curved, round-capped strokes that travel out then thin away.
Streaks spawn behind a rocketing letter from its velocity and stay in the world; stress flicks are three-stroke fans spawned
off the letter's real skin, more as it nears the limit.

**Hint, until the first touch.** After about 3 seconds a faint breeze (about 6 px of sway, out of step between letters)
begins, and every 4.5 to 7.5 seconds one random letter breathes in and out, eased at both ends. Both stop at the first
press on a letter. Skipped under reduced motion. No instructional text anywhere.

**Mobile.** Text selection, the long-press callout and the context menu are blocked shell-wide.

**Constants worth knowing** (all in the file): `HOLD_DELAY 0.22`, inflate `0.24`, `FLICKER_T 1.15` (the critical
duration; the name is a leftover from the blink that was removed), thrust `g.h * 0.06 * air`, burn `(0.95 + 0.7 air) /
max(0.7, rm)`, velocity cap 70 flying and 36 otherwise, stress starts at 72% air, ripple 0.055, shudder 0.45 inflating and
1.2 critical. Debug: `window.__poster.inst.debug` exposes `glyphs()`, `marks()`, `step()`.

**What shaped it** (each was a round with Idan): no gravity; no user aim (the mouth decides); deflate to a limp tube rather
than shrink; no blink in the warning; marks should look hand-drawn, not schematic; tap should fire by itself; inflation slower
and rockets faster and more kinetic.

### Collapse and Explode (drafts, `?p=collapse`, `?p=explode`)
Two posters on one core (`src/posters/columns-core.js`, thin wrappers `collapse.js` and `explode.js`). Idan's framing (5
October 2026): three different posters, projection, columns collapse, columns explode (plus a fourth, the garden, after).

**Shared look and model.** "IDAN / SEGEV" as flat white type on black that is really tall columns, seen straight down
through an orthographic camera, so only the tops show. The letters are the Soft type skeletons (`lettering.js`) thickened
into overlapping boxes (mitred at joints so curves stay smooth) and extruded 3.4 units tall (a letter is 2 high). Physics
is Rapier. Rendering is instanced WebGL2: tops pure white, the letter-shaped face stays bright even when a column lies
down, sides grey. A double tap on empty space re-forms the letters (also Re-form in the panel, T). Dark theme only for now.

**Collapse.** (also has the Colour sliders) Columns are free rigid bodies, all the same mass so a falling letter can carry the next. The floor grips and
letters are slippery against each other, so a push tips a column instead of sliding it. Tap = a firm knock at the top, away
from where you touched (default strength 26: in 16 test taps every one toppled the letter, and a neighbour went over 1.6 times
on average, so chains are probabilistic, like dominoes). Drag = a spring from the grabbed point to your finger: it tilts and
rocks back, or goes over if you pull far enough. Physics at 120 Hz; letter restitution 0.55 (friction takes the larger of two surfaces, restitution the smaller, so the floor grips and
letters are slippery against each other). Settings: gravity, tap push.

**Explode.** Columns are anchored (static). Tap = it blows at once, from the point you touched, into free-form pieces
(`src/posters/shatter.js`): each stroke box is shattered by cutting it with the bisecting planes between jittered seed points
(a Voronoi cell per seed, all convex, volume conserved), so no two pieces are alike. Every piece is a real convex rigid body
and a free-form mesh (one growing vertex buffer, each piece placed each frame from a float texture). Pieces that hit another
letter harder than 12 units per second set that whole letter off, at half the strength each generation. **Struck letters break apart instead of bursting** (toggle, on by default): only the tapped letter has power of its own; a letter set
off by an impact (or a box broken off by one) spawns pieces at rest and hands them just the momentum of what hit them, falling off
sharply with distance from the impact point (about 1.2 units), so the near side is shoved and the rest slumps. No burst lines for
those. Settings: the toggle, and how much momentum is passed on (default 0.7). Lesser blows **crack**
the standing letters: each physics box has a damage value (its smooth top darkens as it grows); the blast damages the nearest
boxes of other letters, and hard-ish piece impacts damage the box they hit; at 1 that box breaks off into pieces and the rest of
the letter stands with a hole. 16 hand-flicked lines and a short shake go with each detonation. Cost: about 5 ms per frame with
default pieces (50 to 60 per letter), more with small pieces; the piece size coarsens automatically as rubble builds up (cap 900
pieces). Settings (T, or `?tune` on a phone): World (gravity, bounce, slipperiness), Blast (power, outward speed, lift, spin),
Chain and cracks (impact that sets a letter off, strength kept, cracking where 0 means whole-or-gone), Pieces for the next blast
(size down to 0.22, irregularity, fit), Effects (lines, shake), Colour (background and foreground, black to white only), and
actions Re-form and Detonate all.

**Lessons while building them.** Infinite wall planes at the screen edge stopped tall towers from falling, so use low boxes.
Equal masses, bouncier letter contacts and a fixed generous knock beat sizing the knock from tipping energy. A first Explode
chain wiped out all nine letters in half a second and cost 20 to 40 ms a frame: fewer, larger slabs, fewer solver iterations,
coarse physics shapes, a higher chain threshold and a weaker chain fixed both.

### Skyline (draft, `?p=skyline`)
Flat white "Idan / Segev" on black, projected onto a field of hard-edged blocks of different heights. Replaces **Drape**
(a cloth over hidden balls, built and then removed on 5 October 2026: Idan found a soft geometry too weak; it is in git history
at commit `90a158a`). The lesson: the hidden geometry has to be hard-edged, so the print is visibly cut and displaced at every
edge when the view moves.

**The trick.** The camera starts exactly where the projector is, so the print lands perfectly flat however the blocks stand
(as in Sheet). Move the cursor, drag a finger or tilt the phone and the print stays put while the blocks move under it: the
lettering is sliced at every block edge and jumps from height to height; block sides appear. Shading is absent at rest and
appears with camera movement and with disturbance (`reveal`).

**Model.** About 70 rigid bodies (Rapier) standing on a floor and tiling the sheet (a grid of blocks with a hair of gap),
heights from smooth noise quantised into whole steps (0.12 to 1.5 units; the camera is 5 away) so they read as a stepped
skyline. One instanced WebGL2 draw (plus a floor slab); the type mask is looked up per pixel through the projector, so every
surface, the floor included, carries the print. About 0.1 ms per frame on desktop when settled.

**Interactions.** Touch: blocks within 1.5 units are thrown up and aside, harder the nearer, and tumble, land on each other and
leave gaps through to the floor. Dragging pushes the blocks it passes. Moving the pointer is the camera. Settings (T): camera
yaw and pitch, block size (Re-form), poke strength, gravity.

**Open questions.** What the blocks should do after they are thrown (they stay where they land; Re-form is in the panel and a
double tap is not wired yet); whether tops should be tilted facets rather than flat steps; a hint; a light theme; real phones.

## 18. The next chapter (proposed, not built)

**The brief from Idan (5 October 2026).** Take Soft type's level of scrutiny to the basic concept: the first impression is
very simple, just plain text; interaction reveals that it sits on top of a rich, complex system, always with physics
behaviour. Three new posters:

1. **A rethink of Type Garden** (type-garden.vercel.app): typing makes vines, leaves and roses grow out of the word in flat
   colour. Our version has to be its own thing, inside the site's rules (black and white, no typing UI, no instruction text).
2. **Type projected over hidden geometry**, in the manner of cullenwebber/three-ml-sharp: type that reads as flat at first,
   and the geometry it lies on is revealed by interaction.
3. **Type that is secretly extruded 3D**, viewed straight from above with no perspective so it reads as flat. Interaction
   topples the columns so they fall onto and knock each other over; a second mode explodes them (after the Codrops
   "Exploding 3D objects" technique, per-triangle displacement) and the pieces impact each other.

**Process, unchanged:** propose, get a yes, build one, show it, iterate in short rounds. Taste rules apply (section 15).

**Decisions (5 October 2026):** build the columns first; use a vendored physics library (first cannon-es, then Rapier) rather than writing
one; split them into two posters (Collapse and Explode); Explode is tap-to-detonate with a chain reaction and triangular slabs;
the hidden form for the projection poster was first a cloth over hidden balls (Drape, rejected as too soft), then **hard-edged
blocks** (Skyline); the garden is a fourth, after those. **Status:** Collapse and Explode are built as
drafts awaiting Idan's review; Skyline (the projection poster, hard-edged blocks, after Drape was rejected as too soft) is built as a first draft and awaiting review; the garden is not started.

**Explode defaults (5 October 2026).** Idan's tuned values are now the defaults: gravity 40, blast 0.4, speed 0.3, lift 0, spin 0, chain impact 20 and strength kept 0.2 (chains almost never fire), piece size 0.4, irregularity 1, fit 0.8, cracking 2.9, bounce 0.05, slipperiness 0.98 (very grippy), burst lines and shake off, white background with black type, struck letters break apart with momentum passed 0.7. Pieces under size 0.65 collide as boxes (cheaper); measured 1 to 10 ms per frame after a tap on desktop, up to about 22 ms for D with its pile of pieces, so watch phones.

**Physics engine: cannon-es replaced by Rapier (5 October 2026).** cannon-es (pure JS, 140 KB) was measured against Rapier (Rust compiled to WASM, 2 MB) on the same box piles in the browser (60, 120 and 250 boxes: 0.6, 1.2, 2.7 ms against 0.28, 0.45, 1.0 ms) and, more tellingly, in the real posters: with Idan's Explode defaults a tap cost 5 ms per physics step for 250 box pieces and 16 ms with 80 convex pieces, a whole frame 20 to 27 ms. The same posters on Rapier cost 0.7 to 1.8 ms a whole frame. Collapse behaves the same (16 of 16 test taps topple the letter, 1.56 neighbours on average); Explode and Skyline were re-tested. The code talks to Rapier through `src/posters/physics.js`, a thin wrapper that presents bodies as plain objects (position, quaternion, velocity refreshed after each step, only for awake bodies), so a future swap is local. Differences to know: Rapier reports that two things touched but not how hard, so Explode takes the impact speed as the piece's own speed just before the step; Explode's blast and chain numbers were tuned on cannon-es and may feel slightly different; the 2 MB WASM loads when Collapse, Explode or Skyline opens (about 55 ms from cache).

**Explode: smaller bits, more irregularity, camera (5 October 2026, after the Rapier switch).** Piece size now goes down to 0.1 (was 0.22) and irregularity up to 2 (was 1; above 1 seeds wander into neighbouring cells, so pieces differ a lot in size). Budget: up to 140 pieces from one box, 2,500 pieces and 400,000 mesh vertices in the world (was 900 and 150,000); the size coarsens as rubble builds (every 1,400 pieces adds 100%). Every piece now collides as an exact convex hull (boxes only below size 0.2). Measured on desktop with size 0.14 and irregularity 2: one tap on G made 904 pieces in 68 ms, with about 2,200 bodies awake after the cracking cascade and frame cost 18 to 37 ms, so very small sizes are a desktop setting, not a phone one. **Camera (Collapse and Explode, for setting up and previewing):** Tilt, Turn, Zoom, Perspective (0 = the flat orthographic view the poster ships with) and Reset camera. Picking and dragging follow the camera by casting a ray through the pixel, so you can tap letters from a tilted view; burst lines are projected through the same camera. Reset camera and the other actions now refresh the sliders.

**Explode: cracks that jitter, not only collapse (5 October 2026).** Damage to a standing column now has two tiers. At "Damage that starts a crack" (default 0.25) a box *cracks in place*: it becomes irregular pieces that are shoved and twisted a little (the Jitter setting), so the letter stays standing with slightly offset slabs and dark seams. The pieces may only slide and turn about the vertical (Rapier's locked rotations and z translation) with heavy damping, which is what stops a tall stack from toppling; a first version without the locks made the whole word collapse. At damage 1 the box breaks away as before, carrying the momentum of the blow. Damage now reaches as far as the "Crack reach" setting (default 3 units) whatever the blast power, and falls off as distance to the 1.6 power, so near letters break and farther ones only crack. In a test with Idan's tuned values, tapping G left 19 of 36 boxes standing with 30 cracked or broken pieces among the neighbours, against 29 of 36 and none with Jitter 0. New settings: Crack reach, Damage that starts a crack, Jitter (0 turns cracking back into break-away only).

**Dust (Collapse and Explode, 5 October 2026).** Soft grey puffs, as in Idan's note about impact dust (the Three.js MeshSurfaceSampler idea, rebuilt without Three: no new dependency). `src/posters/dust.js` is a GPU particle system: a ring buffer of up to 9,000 particles, each born with a position, velocity, birth time, life and size, drawn as one instanced draw of camera-facing quads; the vertex shader works out where each particle is at any moment (thrown, slowed by drag, drifting up, spreading as it thins) and fades it, and the fragment shader erodes each quad with value noise so a puff is ragged rather than a disc. Nothing is updated per frame on the CPU. Three sources: (1) **impacts**: Rapier's collision events, with the contact point from the narrow phase, so a piece hitting the floor, a column or another piece kicks up a few puffs, more and faster the harder the hit (needs a relative speed over 2.4 units a second, a 0.3 s cooldown per body and 14 bursts a frame); (2) **a letter turning to dust**: when a letter detonates, up to 260 particles are sampled over the surface its boxes occupied, weighted by area (the surface-sampler idea), and thrown away from the blow, plus a puff at the touch point; (3) **cracks**: a puff at each box that cracks or breaks off. Colour is the mid grey between the background and foreground sliders, so it works on white and on black. Settings: Dust amount (0 = off), puff size, how long it lasts, and a toggle for dust from impacts. Measured: no visible frame cost (about 3 ms a frame with dust against 4 without in a test).

**Explode defaults, extrusion, ranges, dust look (5 October 2026, later).** Idan's second tuned set is now the Explode default: gravity 20, blast 0.4, speed 0.3, lift 0, spin 0, chain impact 20 and strength kept 0.2, piece size 0.1, irregularity 2, fit 0.8, cracking 0 (so a letter is whole or gone), crack-at 0.05, jitter 0, reach 1, struck letters break apart with momentum 0.2, bounce 0.95, slipperiness 0.32, no lines or shake, white page with black type, dust 0.95 at size 0.4 lasting 1.6 s. New: **Extrusion height** (0.05 to 8, default 3.4; changing it re-forms the letters; Collapse has it too), so the type can be a thin slab or a tall tower. Ranges now go much smaller: power and outward speed from 0.02, strength kept from 0.02, momentum from 0.01, piece size from 0.03, crack reach from 0.2, fit from 0.5, chain impact from 1 (the per-box piece cap is 220 and the world cap 4,000 pieces, so the smallest sizes saturate and the size coarsens as rubble builds). The shard transform texture is now a 2,048-wide block of rows rather than one long row (some phones cap texture width at 4,096). **Dust look:** new Dust tone (0 black to 1 white, default 0.5), Dust softness (0 = crisp-edged ink blots, 1 = feathered smoke, default 0.6) and Dust opacity (default 0.8). Tested soft grey against hard black (tone 0, softness 0, opacity 1): the black version reads as ragged ink-black blots that thin with age. Measured with the tuned defaults: about 1,000 pieces from one tap on G and about 10 ms a frame on desktop.

**Bug fixed: pieces drawn at the centre of the stage (5 October 2026).** After the shard transform texture became a 2,048-wide block of rows, its CPU array was sized `MAX_SHARDS * 8` floats (32,000) but the texture needed 2,048 x 4 rows x 4 = 32,768, so WebGL refused the upload, the texture stayed empty, and every piece was drawn at the origin whatever the physics did. The physics, piece counts and dust were all fine, which is why checks that counted pieces missed it. The array is now sized from the texture itself, and a startup check logs a console error if the texture is refused. Lesson: when a rendering path changes, verify pixels (a screenshot or a pixel read), not just simulation state.

**Explode defaults, third set (5 October 2026).** Gravity 26, blast 0.4, outward speed 1.12, lift 0.4, spin 1.4, chain impact 30 and strength kept 0.3, piece size 0.1, irregularity 2, fit 0.8, cracking 0.25 starting at damage 0.46 with jitter 0.05 and reach 2.95, struck letters break apart with momentum 0.2, bounce 0.95, slipperiness 0.32, no lines or shake, white page with black type, **dust off** (amount 0 and dust from impacts off, the dust look settings unchanged), and **extrusion height 0.85** (a low slab rather than a tower).

**Bug fixed: an invisible box around the debris on phones (5 October 2026).** `build()` made the physics world, and with it the walls at the screen edges, before it had worked out the scale between world units and pixels, so on the first build the walls used a stale default scale (100 pixels per unit). On a desktop that put them just outside the screen, but on a phone, where the real scale is about 55, they sat well inside it, so the debris piled against hard, straight edges: a visible rectangle. The scale is now computed first. Checked in a 390 x 800 view: the side walls sit at x = 0 and x = 390 and the debris spreads across the whole width. Lesson: anything placed from a screen-derived scale must be created after that scale is known, including after a resize.

**Explode joined the shuffle (5 October 2026).** The rotation is now Still Water, Sheet, Soft type and Explode (a share page exists at `/p/explode/`). Collapse and Skyline remain drafts. Explode loads the 2 MB Rapier WASM, and with the shipped defaults one tap makes about 1,350 pieces (about 21 ms a frame on desktop), so it is the poster most likely to struggle on an old phone.

**Explode adapts to slow devices (5 October 2026).** A multiplier on piece size, `perf`: it starts at 1 on a desktop, 1.15 on a touch device, and 1.8 on a touch device with 4 or fewer cores or 3 GB or less of memory (`navigator.hardwareConcurrency` and `deviceMemory`, where the browser reports them). A frame-time governor raises it by 35% (up to 4) whenever frame time has averaged over 27 ms for about 24 frames while more than 120 pieces exist, and at the same time clears 30% (50% if over 40 ms) of the pieces that have come to rest, oldest first; it never touches pieces still moving, so what you are looking at does not change. The per-box piece cap shrinks with it. A tap on D made 1,048 pieces at 1, 387 at 1.8 and 126 at 3. Simulated slow frames (45 ms) took it from 1 to 2.46 in a few seconds. A new panel toggle, "Adapt to slow devices" (on by default), turns the whole thing off for testing. Not yet measured on a real older phone.

**Explode: a middle ground on size and performance (5 October 2026).** Measured on desktop with the tuned settings, tapping a letter (average of D, G, S): size 0.1 gave about 1,117 pieces and 12 ms a frame; 0.16 gave about 525 pieces and 4.9 ms; 0.22 about 200 and 2.5 ms; 0.3 about 114 and 1.3 ms. The default piece size is now **0.16**, with the device adaptation on top. New setting "Damage from flying pieces" (`hit`, default 0.35, 0 to 3), and flying pieces now damage a standing box only above 5.5 units a second (it was 4.5), so other letters are shattered much less by impact; in these taps no other-letter box was lost at either 0.35 or 1. **Documentation:** a doc for the project and one for every poster, including drafts and removed ones, is in `docs/` (see `docs/README.md`).

**Footer tagline rethought (5 October 2026).** Idan chose direction B: a short fixed role line plus one rotating aside. The footer now reads "Idan Segev  Design leadership. Builder culture.  <aside>", the aside a little dimmer, chosen at random per load from eight: Teams, systems, and things that break on purpose. / Craft is the credential. / Prototypes over decks. / Handle with care. / Mostly flat. / Some cracks are intentional. / Load-bearing. / Please refresh. The rest of the page copy (title, descriptions, the no-JavaScript fallback) is unchanged. Considered and not chosen: keep the claim and vary the aside (A), a constant line (C), a line per poster (D, which was the recommendation).

**Role line (5 October 2026).** Changed to "Design leader. Builder of builders." (Idan wanted it to imply that he empowers others to become builders); the page title, descriptions and no-JavaScript fallback say the same in longer form ("Idan Segev is a design leader who helps others become builders.").

**Fold, a per-letter rethink of Sheet (5 October 2026, draft `?p=fold`).** Idan called Sheet the weakest poster and asked for the folding effect on each letter with the sheet removed. Built as a new draft so the live Sheet is untouched: each of the nine letters of "Idan / Segev" is its own patch of point sprites driven by the same baked crumple simulation, the point cloud is cut to the letter (non-ink fragments are discarded, so the paper is the letter), a single three-channel type mask serves all letters (a letter uses channel index mod 3 so neighbours never share one), and a tap crumples, throws and re-unfolds only the tapped letter. Defaults: relief 2, shading 1.5, crease shadow 0.8, white letters on black, about 237,000 points. Checked flat head-on, tilted (per-letter creases and warped outlines) and on a tap; see `docs/posters/fold.md`. Also in this round: the footer role line became "Design leader. Builder of builders."

**Session 6-7 October 2026 (summary of rounds).**

- **Fold** (draft): Sheet rethought as per-letter folded paper; hard-edged shadows; crumpled letters persist as balls. Idan: it looked terrible, parked. Ball rebuild (arc, thud, hops, rolling resistance, hard shadow) kept in code.
- **Explode**: fourth then fifth tuned defaults (the fifth: chunk 0.02, blast 0.44, speed 0.43, chain 27, jitter 1.05, reach 2.25, passive off), black type on white by default. Shuffle now alternates colours every shuffle. **Re-architected** for performance and fractured structures: letters become pre-fractured meshes with per-fragment damage (seams, shoved fragments, spalling, cracks that run on); only grouped chunks are rigid bodies; physics visits only awake bodies; chunk size down to 0.02 and fracture detail down to 0.03. Measured: 140 ms to 2 ms per step.
- **Backlight** (draft, kept): raymarched solid type in a black room, hidden until a rectangular light behind it is found. Not what Idan wanted (too immersive).
- **Turn** (draft): first a white panel with edge-on letters (a misreading), then the intended version: all black, glossy letters that show only at the angle where they mirror a fixed strip of light; drag or tap to turn them one by one.
- **Soft type**: optimised (typed arrays, hashed grid, batched strokes). Idan worried the code was too close to the reference; the balloon behaviour stays, and liquid ink was tried in a duplicate instead.
- **Ink** (draft): from-scratch particle liquid with cohesion, metaball render. Idan: odd that it flows back home.
- **Liquid metal** (live): ink that keeps its new shape, lit as black mirror metal; mercury behaviour (agitation, beading, low friction, merge); a 23-control settings panel; Idan's tuned defaults; black page: inverted white and chrome were both rejected, so the page shows the same black metal (obsidian) with a stronger rim.
- **Shuffle and furniture**: the shuffle is now Still Water, Soft type, Explode and Liquid metal; Sheet moved to drafts; the poster name, social links and Share are hidden (parked, to return later).
- **Next**: Idan wants to get back to the columns posters (Collapse is next).

**Collapse joined the shuffle; footer text (7 October 2026).** Collapse took Idan's tuned defaults (gravity 21, height 5.2) and joined the shuffle, which is now Still Water, Soft type, Collapse, Explode and Liquid metal. The footer role line is now "Design leader. Builder." with no rotating aside, "for now"; both, plus the hidden furniture and the old descriptions, are listed under "To reconsider" in `docs/PROJECT.md` section 12.
