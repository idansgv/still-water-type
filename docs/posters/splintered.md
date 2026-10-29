# Splintered

**Status:** published 2026-10-29 (draft the same day). Live at `/p/splintered/`; settings with `?p=splintered&tune`.

**Brief (Idan, 29 Oct 2026).** A realistic render (depth of field, shiny materials with reflections, radiance, shadows) applied to an explosion of 3D extruded type, as in Shatter. The text explodes and sends pieces toward the camera, so the depth of field comes into play, and the speed of time is directed: a forceful impact that shifts into slow motion.

Then: glass letters with light fractures, rendered like the PP Fragment posters (pp-fragment.com); after the burst, camera controls so you can fly between the shards. Test page: `docs/posters/prototypes/splintered-glass.html`.

## How it works
- On black the letters are glass: a rounded bevel round every contour, no diffuse, only reflections, premultiplied so the page shows through. Their own environment is lit from above and the sides with nothing behind the camera, so faces that look at you stay dark and the bevels catch the light; back faces draw first, which gives the inner edges seen through the front. Glass crack walls stay hidden until the pieces part.
- The name is set from a real font (Archivo Black by default), extruded, and cut into Voronoi shards at the moment of the tap, with smaller shards near the hit. Crack faces are their own material and glow hot, then cool.
- Motion is closed-form in simulated time (position, spin, drag, gravity), so the clock can run at any speed, or backwards. The time curve: "Speed at impact" for "Impact lasts", then an ease into "Slow-motion speed".
- Render: HDR scene with a depth texture, a gather depth of field (half resolution, near-field spill), bloom, ACES, composited over the page colour. A black studio environment (softboxes, a horizon behind the camera) gives chrome its hard light. A flash light at the hit, sparks that turn into bokeh near the lens, a shadow on an invisible wall behind the type (shows on the light page).

## Interactions
- **Tap:** explode from that point. Tapping again while it is flying kicks the pieces again.
- **Hold:** rewind time; the pieces fly back together.
- **Double tap:** re-form at once; the camera comes home.
- **Once it has burst:** drag turns the camera round the middle of the flying pieces; the wheel or a pinch flies in and out (the lens widens, focus follows the middle of the frame); two fingers turn too.
- One self-demo on load (explode, then rewind); off under reduced motion.

## Defaults
Idan's tunings are `DARK` and `LIGHT` in `src/posters/splintered.js`: glass with a 0.05 bevel, 26 pieces a letter, 69 mm at aperture 2.17, exposure 1.8 and a 0.16 s beat before the burst on black; on white, glass with a 0.032 bevel, 40 pieces, 87 mm, the same beat, in a room of a small white wall in a near-black void (`WALL`, `VOID`), with light through the bevels bent toward the void (`bend` 1, flat faces `faceBend` 0.55). Registry `themes: { dark: 1, light: 0 }` (a hint for previews; the shell still alternates).

## Port notes
- The letters are traced from the page font with `glyph-contours.js` (no opentype, no font file in the repo), scaled to em units so the test page's numbers carry over.
- Ember glow dropped (black and white only). The material and "focus follows a shard" are panel settings.
- Background taps do nothing (on the test page they hit the nearest letter).
- The glass test page's light running along the cracks (cap shader) was left out: Idan tuned it to zero.

## Open
Phone performance unmeasured (each frame is a scene pass, a depth of field pass and a bloom chain; glass adds a back-face pass). Glass on the white page: since 29 Oct, tuned on `docs/posters/prototypes/splintered-glass-white.html`. The bend through the edges is faked (three times one surface's refraction), not traced.

Shelved: Glow (29 Oct 2026). After the Glow effect in hjunhuh/glass (MIT): glass that bends light hard at its edges, a low bloom threshold and lens colour fringes (which break black and white). Test page `docs/posters/prototypes/splintered-glow.html`, with Idan's tuning as its defaults; private link https://claude.ai/artifact/4XJb4TVHZ2c5gPEJ1Mjb4k. About 4x the frame time of the plain glass in headless renders.
