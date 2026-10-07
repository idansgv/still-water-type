# Liquid metal (draft)

**Status:** first draft, 7 Oct 2026. Not in the shuffle. Test at `/?p=metal`. File: `src/posters/liquid-metal.js` (a sibling of `ink.js`).

**Brief (Idan).** Ink flowing back to its original spot felt odd. Try liquid metal instead: about 95% black, a few shiny highlights.

**What changed from Ink.**
- **Memory.** Each droplet's "home" slowly follows the droplet (time constant 0.45 s, only while nothing is held). Pull a letter and it stays where you leave it; two letters pushed together stay fused. While it settles, surface tension beads a stretched thread into droplets. Double-tap empty space to pour it back into the name (panel: Re-form).
- **Look.** The metaball field is blurred and lit as a mirror: its slope gives a normal, the view is reflected, and the reflection looks into a black room with two small lamps (upper left, lower right) plus a faint rim. Result: black metal with a few crisp highlights that slide as it moves.

**How it is drawn.** Droplet kernels are added into a half-resolution field, then smoothed with a separable blur (so the highlights are clean streaks, not lattice specks); the sharp field gives the silhouette, the blurred field gives the normals.

**Open.** Not tuned by feel yet: lamp positions and sizes (the 95% black), how quickly it forgets (`TAU`), cohesion. Not measured on a phone. No settings panel.

## Update 7 Oct 2026: mercury behaviour
The metal now has two moods. At rest it holds its shape. When disturbed (pulled, splashed, or knocked by a fast bead) each droplet becomes *agitated*, and agitation spreads to whatever touches it and fades over about 2 s. While agitated: the home is forgotten, surface tension runs at full strength, stickiness and friction nearly vanish. The result is round beads that roll, skitter, bounce off the edges, merge on contact and shed smaller beads when stretched. When the agitation dies, everything stays where it ended. Taps splash harder (wider, faster, fully agitating). On touch devices, tilting rolls loose beads downhill.
Checked in the browser: a splash scattered beads, and after settling the pulled and splashed letters had pooled into round bright-spotted blobs with a few loose droplets; untouched letters were unchanged. Constants to tune: `K_ATT`, `CALM`, `K_REP` (in `stepOnce`'s header line). Tilt untested on a device.
