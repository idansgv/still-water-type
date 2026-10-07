# Liquid metal (draft)

**Status:** in the shuffle since 7 Oct 2026 (added with Explode). Test at `/?p=metal`. File: `src/posters/liquid-metal.js` (a sibling of `ink.js`).

**Brief (Idan).** Ink flowing back to its original spot felt odd. Try liquid metal instead: about 95% black, a few shiny highlights.

**What changed from Ink.**
- **Memory.** Each droplet's "home" slowly follows the droplet (time constant 0.45 s, only while nothing is held). Pull a letter and it stays where you leave it; two letters pushed together stay fused. While it settles, surface tension beads a stretched thread into droplets. Double-tap empty space to pour it back into the name (panel: Re-form).
- **Look.** The metaball field is blurred and lit as a mirror: its slope gives a normal, the view is reflected, and the reflection looks into a black room with two small lamps (upper left, lower right) plus a faint rim. Result: black metal with a few crisp highlights that slide as it moves.

**How it is drawn.** Droplet kernels are added into a half-resolution field, then smoothed with a separable blur (so the highlights are clean streaks, not lattice specks); the sharp field gives the silhouette, the blurred field gives the normals.

**Open.** Not tuned by feel yet: lamp positions and sizes (the 95% black), how quickly it forgets (`TAU`), cohesion. Not measured on a phone. No settings panel.

## Update 7 Oct 2026: mercury behaviour
The metal now has two moods. At rest it holds its shape. When disturbed (pulled, splashed, or knocked by a fast bead) each droplet becomes *agitated*, and agitation spreads to whatever touches it and fades over about 2 s. While agitated: the home is forgotten, surface tension runs at full strength, stickiness and friction nearly vanish. The result is round beads that roll, skitter, bounce off the edges, merge on contact and shed smaller beads when stretched. When the agitation dies, everything stays where it ended. Taps splash harder (wider, faster, fully agitating). On touch devices, tilting rolls loose beads downhill.
Checked in the browser: a splash scattered beads, and after settling the pulled and splashed letters had pooled into round bright-spotted blobs with a few loose droplets; untouched letters were unchanged. Constants to tune: `K_ATT`, `CALM`, `K_REP` (in `stepOnce`'s header line). Tilt untested on a device.

## Update 7 Oct 2026: settings panel, calmer defaults
Panel (`?p=metal&tune`, or T): **Mercury** (surface tension, how far agitation spreads, calm-down time, speed that agitates a bead, edge bounce, tilt), **Feel** (stickiness, friction, firmness, pull to the name while calm, how fast it forgets, top speed), **Touch** (splash power and radius, grab radius and strength), **Look** (relief, two highlights with size and brightness, rim light, base grey). Defaults are calmer than the first mercury pass: tension 900 (was 1500), spread 0.92, calm 1.2 s, trigger 240, splash 0.7, bounce 0.45, tilt 220. "Copy settings" gives JSON to paste back as defaults.

Your settings (tension 400, friction 12.5, calm 1.1, forget 0.15, max speed 1000, splash 0.6, tilt 300, relief 6, main highlight 1.05) are now the defaults. On a black page the metal is inverted: white, with a few dark reflections.

Black page (7 Oct 2026): the inverted white metal looked like chalk, so the default is now chrome: the reflection looks into a bright sky above and to the left and a dark room below, so strokes have a dark middle and bright, directional edges. Panel: "Black page: chrome (1) or inverted (0)". The light page is unchanged.

Black page, second try (7 Oct 2026): chrome was rejected. The black page now shows the same black metal (obsidian) with a stronger rim and a slightly lifted base so the letters read against the black; the highlights are unchanged. Panel: "Black page: rim light" and "base grey". The inverted and chrome looks are removed.
