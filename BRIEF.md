# Idan Segev, personal site: brief

Version 0.1, 2 October 2026. Lives on the `portfolio-v1` branch until promoted. Written for Idan and for any
Claude Code session that picks this up later, so it records decisions and reasons, not only wishes.

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

### In v0.1

Only posters that clear the bar are in the random rotation (`PUBLISHED` in `src/posters/index.js`). Drafts stay reachable with `?p=<slug>` while they are reworked, and get no share page.

The bar, taken from Still Water: one material rather than an effect; the type stays intact and legible; the response is proportional and continuous, with memory that decays; a small, asymmetric composition with plenty of empty space; still at rest; nothing instructional.

| Poster | At rest | Hidden underneath | Touch |
|---|---|---|---|
| **Still Water** (`still-water`) | White "Idan / Segev" on black | Wave-equation ripple simulation on the GPU; a lamp (L, or three taps) casting caustics through the water | Move to wake the water; tap to drop |
| *Draft:* **Meltdown** (`meltdown`) | "MELT / DOWN" in crisp type | A heat field plus a shader that finds the nearest letter upstream along gravity and pours it as round-tipped drips; phones drip toward real gravity | Hold or drag to melt; it re-solidifies over a few seconds |
| **Emboss** (`emboss`) | "Flat. / Not entirely." blind-embossed: the type is the same tone as the paper and shows only as relief | A height field built from the type mask, finite-difference normals, a low point light that follows the cursor, a little paper tooth; a pressed finger dents the soft stock and it relaxes over a few seconds | Move the light; press to dent |
| *Draft:* **Point of view** (`point-of-view`) | A drifting cloud that nearly reads "POINT OF VIEW" | 20–40k points placed along sight lines from one secret viewpoint (an anamorphosis). The viewpoint is random per load. Near it, points pull into the word and a crisp solid fades in | Move or drag to look around; find the angle |


**Sheet** (draft) also has a tuning panel and a click interaction. `?p=sheet&tune` (or press T on any poster that offers settings) opens sliders for relief, creases, softness, sheet size, point count, tilt range, shading, the lines of type and the crumple timing. Settings persist per browser while `?tune` is on; "Copy settings" puts them on the clipboard as JSON to paste into `DEFAULTS` in `src/posters/sheet.js`. A click or tap (not a drag) crumples the sheet, throws it off a random edge, and a new one arrives as a tumbling ball and unfolds into place, with new folds and the next line. The paper's shape is a real cloth simulation (Houdini Vellum) baked by Toi Nagasawa as a Vertex Animation Texture, MIT licensed, from github.com/item-develop/paper-crumple-demo (see the Codrops article "Building an Interactive Crumpled Paper Effect with Houdini VAT and Three.js"). `tools/vat-extract.mjs` turns it into `src/posters/data/crumple.bin` (1.75 MB; the licence notice sits beside it). The resting wrinkles are an early frame of the paper buckling (adjustable: "Wrinkle depth"), the crumple is the simulation played forward, the unfold is it played back. Not adopted from the article: the physics engine (grab, throw, roll) and the SSAO pass; creases are darkened from a cavity term baked into the data, shown only once the view moves. The panel lives in `src/panel.js` and any poster can use it by returning `tune` from `mount()`.

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
| Theme | Per-poster odds (Flat prefers paper, Still Water is dark only). Forced with `?theme=` |
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
src/shell.css
src/posters/*.js      one file per poster, plus index.js (the registry)
p/<slug>/index.html   generated share pages (node tools/build.mjs)
work/                 Work index; work/moovit is vendored from its own repo
assets/               favicon.svg, apple-touch-icon.png, og.png
tools/                build.mjs, sync-moovit.sh, og.html + save-server.py, motion-check.html
```

Hosting: Vercel project `ripple`, repo `idansgv/still-water-type`, `main` deploys to idansegev.com. Other branches
get preview deployments (which Vercel may put behind login). The pre-portfolio single-poster site is tagged
`still-water-v1`. Share images are drawn in the browser by `tools/og.html` and saved by `tools/save-server.py`.

Dev switches: `?p=<slug>`, `?theme=light|dark`, `#s=<seed>`, `?live` (Still Water mirrors a local Wordflow3d server;
off by default because a public page reaching for localhost can trigger a local-network permission prompt).

## 11. Roadmap

- **v0.1 (this branch).** Shell, engine, two published posters (Still Water, Emboss) and two drafts, Work index, Moovit vendored, share previews, brief.
- **v0.2.** Per-poster share images; two or three more posters from the backlog; "save this poster as an image"
  (and share it as a file on phones); Work option B, the hidden glyph; a second case.
- **v0.3.** Teaching and talks; a case template once two exist; privacy-friendly analytics to learn which posters
  get shared; a short about page; poster order/weights tuned from what people actually do.

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

## 13. Risks and notes

- **Rights.** The repo is public and the Moovit case carries screenshots and photographs. Confirm the right to
  publish them, or make the repo private (Vercel deploys private repos fine).
- **Weight.** `work/moovit/assets` is 19 MB. Convert the large PNGs and GIFs to WebP/AVIF and video before launch.
- **WebGL2.** Required by every poster; the static fallback covers the rest.
- **Local network prompt.** Recent Chrome asks visitors for permission when a public page contacts localhost. That
  is why `?live` is opt-in.
- **Phones in managed fleets** can block motion sensors entirely. `tools/motion-check.html` diagnoses it.
- **Shuffle never reloads** the page. On `/` the URL stays `/`, and refresh always gives a new poster. Shuffling away from a `/p/<slug>/` page returns the address bar to `/`.
