# Splintered (draft)

**Status:** draft in the pipeline (29 Oct 2026), at `/?p=splintered` (settings: `&tune`). Files: `src/posters/splintered.js`, three.js 0.160 vendored as `src/vendor/three.module.min.js` (MIT, `three.LICENSE.txt`). Test page (named Explode while it was an idea): `docs/posters/prototypes/explode-slomo.html`, https://claude.ai/artifact/BvoJLC5UEportWxQsXFhAs. Idan: "this is very cool. name it Splintered. push it into the pipeline"; "It does work better on dark."

**Brief (Idan, 29 Oct 2026).** A realistic render (depth of field, shiny materials with reflections, radiance, shadows) applied to an explosion of 3D extruded type, as in Shatter. The text explodes and sends pieces toward the camera, so the depth of field comes into play, and the speed of time is directed: a forceful impact that shifts into slow motion.

## How it works
- The name is set from a real font (Archivo Black by default), extruded, and cut into Voronoi shards at the moment of the tap, with smaller shards near the hit. Crack faces are their own material and glow hot, then cool.
- Motion is closed-form in simulated time (position, spin, drag, gravity), so the clock can run at any speed, or backwards. The time curve: "Speed at impact" for "Impact lasts", then an ease into "Slow-motion speed".
- Render: HDR scene with a depth texture, a gather depth of field (half resolution, near-field spill), bloom, ACES, composited over the page colour. A black studio environment (softboxes, a horizon behind the camera) gives chrome its hard light. A flash light at the hit, sparks that turn into bokeh near the lens, a shadow on an invisible wall behind the type (shows on the light page).

## Interactions
- **Tap:** explode from that point. Tapping again while it is flying kicks the pieces again.
- **Hold:** rewind time; the pieces fly back together.
- **Double tap:** re-form at once.
- One self-demo on load (explode, then rewind); off under reduced motion.

## Defaults
Idan's two tunings from the test page are `DARK` and `LIGHT` in `src/posters/splintered.js`: chrome, depth 0.05, 17 pieces a letter, 135 mm lens on black; white ceramic, 24 pieces, 69 mm, more glow and blur on white. Registry `themes: { dark: 1, light: 0 }` (a hint for previews; the shell still alternates).

## Port notes
- The letters are traced from the page font with `glyph-contours.js` (no opentype, no font file in the repo), scaled to em units so the test page's numbers carry over.
- Ember glow dropped (black and white only). The material and "focus follows a shard" are panel settings.
- Background taps do nothing (on the test page they hit the nearest letter).

## Open
Not yet seen by Idan in the site; phone performance unmeasured (each frame is a scene pass, a depth of field pass and a bloom chain).
