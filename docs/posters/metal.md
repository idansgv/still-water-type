# Liquid metal (draft)

**Status:** first draft, 7 Oct 2026. Not in the shuffle. Test at `/?p=metal`. File: `src/posters/liquid-metal.js` (a sibling of `ink.js`).

**Brief (Idan).** Ink flowing back to its original spot felt odd. Try liquid metal instead: about 95% black, a few shiny highlights.

**What changed from Ink.**
- **Memory.** Each droplet's "home" slowly follows the droplet (time constant 0.45 s, only while nothing is held). Pull a letter and it stays where you leave it; two letters pushed together stay fused. While it settles, surface tension beads a stretched thread into droplets. Double-tap empty space to pour it back into the name (panel: Re-form).
- **Look.** The metaball field is blurred and lit as a mirror: its slope gives a normal, the view is reflected, and the reflection looks into a black room with two small lamps (upper left, lower right) plus a faint rim. Result: black metal with a few crisp highlights that slide as it moves.

**How it is drawn.** Droplet kernels are added into a half-resolution field, then smoothed with a separable blur (so the highlights are clean streaks, not lattice specks); the sharp field gives the silhouette, the blurred field gives the normals.

**Open.** Not tuned by feel yet: lamp positions and sizes (the 95% black), how quickly it forgets (`TAU`), cohesion. Not measured on a phone. No settings panel.
