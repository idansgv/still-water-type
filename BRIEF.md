# Idan Segev, personal site: brief

Version 0.2, 2 October 2026. Lives on the `portfolio-v1` branch until promoted; `main` (idansegev.com) still serves
the single Still Water poster. Written for Idan and for any Claude Code session that picks this up later, so it
records decisions, reasons and dead ends, not only wishes. The running record is section 14.

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
   stays hackable and it will not rot.

## 4. Experience map

```
 /                 a random poster, full bleed          Shuffle · Share · Work · LinkedIn · Instagram · X
 /p/<slug>/        one specific poster (what Share links to)
 /work/            the index: masthead, one feature per case
 /work/moovit/     a case study (the first)
```

Keys on the front: Space, Enter, → or R shuffle. S shares. W opens Work. Still Water also has L (lamp), X (rain).

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

- **Done (v0.1 to v0.2, this branch).** Shell, engine, share pages, Work index with Moovit vendored, brief; Still Water
  ported as the one published poster; Sheet, Breath, Meltdown, Point of view built as drafts; tuning panel; dev server.
- **Next.** Refine Sheet with the panel (wrinkle strength, timing, copy) and measure it on a real phone; decide whether
  to add the article's grab-and-throw physics; rework Breath (the word, the wipe edge, fog speed); then promote the posters
  that clear the bar into the rotation and merge `portfolio-v1` to `main`.
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
8. **Commits.** Seven commits are local only and not yet pushed: Emboss, parking Emboss, Breath, Sheet, Sheet panel and
   click, dev server, Sheet simulation. The pushed state of `portfolio-v1` is the first portfolio commit.
9. **Puff up and away (draft).** Idan's standalone Vite project (`~/Downloads/puff`: Canvas 2D, each letter a balloon
   with an elastic spring mesh) ported to `src/posters/puff.js` as a draft poster, `?p=puff`. Its own rules are kept:
   pure black/white (via the stage theme and `setBackdrop`), DynaPuff 700 (loaded by the poster, not the shell), no
   outlines or corners. Its gravity and slow-motion controls became the settings panel (`T`). Open items from the
   original project (tear effect, keyboard control, high-DPI seam check, split into modules) are not done. The original
   `reference/balloon-rockets-blobs.html` stays in Downloads. Not yet tested on a real phone.
10. **Soft type (draft).** Reverse-engineered colederochie.com: a hand-written Canvas 2D soft-body. Each letter is a few
    skeleton strokes sampled into round particles; the bubbly look is one round-capped stroke along the particle path.
    Position-based dynamics: distance links, a bending-smoothing pass, spatial-hash contacts, a weak pull toward each
    letter's own rest shape (so a dragged letter keeps where you leave it), velocity damping 0.94, substeps for fast drags.
    Hold a letter to swell, tremble and pop back with an elastic wobble. Our own implementation in
    `src/posters/soft-type.js` (no code copied, no sound, our own skeletons for I D A N S E G V). Draft, `?p=soft-type`.
    Balloon-rocket mode (from Puff) added: hold still to inflate, drag to aim, release to launch; thrust leaves through the knot
    and whips the soft letter, air runs out, it lands and springs home. Letters can now rotate (shape matching). Mass and energy: mass is ink area (heavier letters give way less in contacts and coast longer), inflating raises size and
    therefore mass and stored air; thrust and burn time scale with it; air runs out, the letter shrinks to a minimal size (0.8),
    thrust and motion die, it drifts, then re-inflates to normal and returns. Revision: no gravity, no user aim. Each inflation puts a knot at a random spot; thrust leaves through it and turns with the
    letter as it spins. Letters deflate to 0.28x and stay tiny and where they stopped (inflate again, or Re-form). Each visit
    starts with slightly uneven letters (tilt, offset, size, seeded). Lesson: a stroke end must not weld onto its own neighbouring particle (it chamfered corners). Re-form is in the panel (`T`).

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
- **Idan's taste rules** (also in the assistant's memory): no automatic effects at rest beyond one short intro; no
  instructional text; pure white on black; no accent colour; never show debug text to visitors; confirm before
  pushing to `main`.
- **Technique notes.** In GLSL `flat` is a reserved word. Inside a ray march use `textureLod`, not `texture`
  (derivatives are meaningless there). Hash-only navigation does not reload a page in the preview browser: add a
  `&v=N` query. A background or hidden tab pauses `requestAnimationFrame`: step the poster manually
  (`window.__poster.stage.step(16)`) when testing. Local `file://` does not work with ES modules: use `tools/dev.py`.
- **Process notes.** Apple's `ml-sharp` is research-only and 2.8 GB, so a personal portfolio should not depend on it.
  Cloudflare-protected pages (Codrops) need the preview browser, not `curl`. Three GitHub accounts are logged into
  `gh`; pushing this repo needs `idansgv` (switch, push, switch back).

