# Phases (was Moiré phase)

**Status:** published 2026-10-29. Test at `/?p=moire-phase`.

**Brief (Idan, 28 Oct 2026).** "I want to explore the concept of Moire via the phased approach that Steve reich developed towards music in the 70s"

**The two halves.**
- *Moiré:* two near-identical fine patterns laid on top of each other make a third, much larger pattern that neither of them contains. The large pattern moves fast when the layers move slowly.
- *Reich's phasing* (It's Gonna Rain 1965, Piano Phase 1967, Clapping Music 1972): two players start in unison on the same pattern. One stays put; the other drifts ahead, either smoothly (tape loops, Piano Phase) or one step at a time (Clapping Music). The resulting patterns come from the gap between them, not from either part. After a full cycle they lock back into unison.

**Idea.** Two identical layers of the name, made only of fine lines or dots. One holds tempo and the other drifts. The name is never drawn on its own: it shows up as the interference between them. It sharpens, washes to grey, flips to its negative and comes back as the two drift through a cycle. *Moment:* two textures that look the same and say nothing until they slip against each other, and then the name rolls through them.

**Directions** (one test page, like Voronoi):
1. **Piano Phase:** smooth drift. The page is one fine line grating, and inside the letters the lines are shifted half a period. A second, plain grating drifts over it a hair slower. Unison: the name is solid. Quarter phase: it is gone (even grey). Half phase: it comes back in negative. The drift keeps going and the name keeps breathing.
2. **Clapping Music:** stepped drift. A dot grid of the name on a 12-step rhythm. The second layer jumps one cell per bar, so you get 12 distinct resultant patterns in turn and then unison again.
3. **Tape loop (It's Gonna Rain):** rotation and scale moiré. The name is built from concentric contour lines, and a copy turns or swells by a fraction of a degree. Big moiré bands sweep across the letters and the cycle stretches out the way the loops in the piece do.

**Interaction (to agree).** The pointer is the second player. Horizontal position or drag speed sets how far it leads, so a drag pushes the phase the way the pianist leans ahead. Hold locks it back to unison. Release lets it drift. Double tap starts over from unison. The three-tap reveal pulls the two layers apart, with the second one offset, so you can see there are only two plain patterns.

**Open questions.**
- Motion at rest: phasing *is* motion. A slow standing drift (like Moonlit's breeze) or still until touched?
- Sound: Reich is music. A quiet click track per layer, off by default, or none?
- Fineness against screens: the gratings must survive device pixel ratio and phone scaling (render at device pixels, period ≥ 3 px).
- Face: a heavy grotesk reads best through gratings. Pick at the still.

**Test page (28 Oct 2026):** Idan picked Piano Phase. https://claude.ai/artifact/6EXsKwCtox6SKnNCLVP77v (source `docs/posters/prototypes/moire-phase.html`). WebGL2 with a box-filtered square wave per voice. Standing drift in Reich steps: 12 per 36 s cycle, held 60% of each step. Drag across slides voice 2 like a transparency; drag up or down tilts it, which rolls bands through the name, then springs back. Tap jumps one beat ahead, hold settles into unison, double tap starts over, three taps lift voice 2 off from the bottom. Settings sheet with Copy settings.

**Richer looks (28 Oct 2026).** Idan: "I want more interesting visuals", with reference https://www.magnific.com/vectors/moire-effect (flowing warped line fields like draped silk, line weight modelling light, contour lines bent over relief, ring and radial rosettes). Six stills in `output/stills/moire/moire-looks-sheet.png`: Silk, Silk with weighted lines, Contour relief, Rosette, Spiral pair, Silk on a black page. Idan: "3 seems interesting, but I think the missing part is going 3d".

**3D (28 Oct 2026).** Stills in `output/stills/moire/moire-3d-sheet.png`. A: line relief, the name as an extruded slab under a sheet of ridge lines seen at an angle (hidden lines removed), with a flat second grating over it, so moiré bands swirl across the surface and bend at the letters. B: shadow moiré, a grating casting its shadow onto the raised name, so the fringes are the name's contour lines. This is real metrology, and shifting the grating is literally called phase-shifting moiré. C: two line screens in space, the name in the front one, turned in perspective. All three keep the type as the object, with no scene. Idan picked A ("Line relief build"), then corrected it mid-build: "Currently we have 3d for the letters and a grid projected on them. Make the 3d the grid and moire it".

**Folding grid (28 Oct 2026, same test link, v1 kept in `prototypes/moire-phase-v1.html`).** No letter relief. One WebGL2 sheet (480×400 grid, ±6 × ±5 world units so its edge never shows) folds in z by three long sines that move slowly. Both voices are lines on that sheet, drawn in the fragment shader in the sheet's own coordinates. Voice 1 sits half a line over inside the letters; voice 2 has a tempo offset and a slight angle, plus the Reich-step phase. So the moiré and the name bend with the folds, and folds hide parts of the name. Line weight thickens in shade (light from the normal). Drag turns the sheet (yaw ±50°, tilt up to 58°) and springs back; tap is one beat, hold is unison, double tap starts over, three taps lift voice 2 off from the bottom. Idan: "Nope. Think lines bended in3d moving in phases through the space creating letters via gestalt occasionally".

**Strands (28 Oct 2026, target still `output/stills/moire/moire-strands-sheet.png`).** Separate lines, not a sheet: two voices of ~150 strands each, every strand a curve bent in 3D (waves in z and y), seen in perspective. Voice 2 is the same strands with a phase lag. Voice 1 steps half a line over where a strand crosses a letter at unison. At unison the bends coincide and the name appears by gestalt. As voice 2 lags, the bends part and the name dissolves into moiré and folds, then comes back at the next unison. Idan: "apply this and build", with settings from the folding grid sheet.

**Strands build (29 Oct 2026, same test link; folding grid kept in `prototypes/moire-phase-fold.html`).** WebGL2, no mesh buffers: each strand is an instanced screen-space ribbon (360 segments) computed in the vertex shader. The field is ±5 × ±4 world units so the strands always cover the frame. Bends are three long sines in z plus a small one in y, and they travel with time ("Bends travel"). Voice 1 samples a screen-space mask of the name and steps half a line over (in y0, so it lands between neighbours on the bent surface). Voice 2's bends lag by the Reich-step phase. Its spacing and angle part only away from unison (scaled by sin(π·lag)), so it is exactly back in step once a cycle. Width follows depth and the light; lines finer than a pixel fade instead of vanishing. Defaults are his settings: fold 0.53, scale 0.45, breath 0.8, pitch 38, yaw 7, zoom 1.25, 138 lines, weight 0.42, light 0.55, tempo 0.022, tilt 1.2, cycle 50 s, 12 steps, pause 0.4, size 0.79, Alfa Slab One, white page. Gestures are unchanged.

**Staged on the site (29 Oct 2026, draft, local, not committed).** `src/posters/moire-phase.js`, registry row `draft: true`, `?p=moire-phase` (`&tune` for the panel), scene in `tools/scenes.cjs`. Same model as the test page, with Idan's settings as defaults; the shell owns black/white (both themes). Gestures through `src/gestures.js`. The reveal (three taps) lifts voice 2 off under a drawing of the two voices. The standing drift stays (his choice), frozen under reduced motion. Static gate passes except the two publish-only items (INTERACTIONS.md entry, menu preview).

**Published (29 Oct 2026).** Idan retuned it on the site (fold 0.51, scale 0.65, breath 1.07, pitch 28, yaw -8, zoom 2, 178 lines, weight 0.28, light 0.69, tempo 0.018, tilt 1.15) and said publish. Gate fixes: the theme check reads corners as a grey mix for a line field (`LINE_FIELD` in `tools/tests/lib.cjs`, thresholds 128); the reveal draws the two voices as a score so the layer has real ink; colour scene is a press. Menu preview is taken at unison (`debug.unison()`). Next: a more rewarding interaction.

**Renamed Phases (29 Oct 2026, Idan).** Title only; the slug and URL stay `moire-phase`.

**Tune it (29 Oct 2026, test link only, not on the site yet).** Idan picked "you are voice 2". A horizontal drag sets voice 2's lag directly (full width = one cycle, `span`); the clock stops while you tune. Within `snap` (0.035 of a cycle) of unison it snaps in and the name appears. A vertical drag tilts the view. Settings: span, snap. Sound was tried and removed the same day: Idan: "I'd avoid sound" (option 3 was misread as part of his pick; no sound on this poster).

**Camera back (29 Oct 2026, test link).** Drag-to-tune had taken the turn away. Now: right-drag or Alt-drag turns and tilts (yaw ±80°), the wheel zooms (0.4 to 3x), and on touch two fingers turn and tilt and a pinch zooms. A plain one-finger drag still tunes (across) or tilts (up and down). The view stays where you leave it (no spring back); double tap starts over and brings the view home.

**On the site (29 Oct 2026, Idan: "Port to site").** Drag-to-tune (span 1, snap 0.035, fixed constants, no settings) and the camera controls (right/Alt-drag, wheel, two fingers, pinch) are in `src/posters/moire-phase.js`; no sound. Full gate 17/17.
