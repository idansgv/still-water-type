# Fold

**Status:** draft (reachable with `?p=fold`; not in the shuffle, no share page). File: `src/posters/fold.js`. Settings: `?p=fold&tune`. Born from Idan's verdict that Sheet is the weakest poster: "give the folding effect to each letter and remove the sheet of paper". Sheet itself is unchanged and still live.

## Concept
Every letter is its own piece of folded paper. There is no sheet. "Idan / Segev" is nine small papers that are the shapes of the letters.

## At rest
Flat white letters on black, perfectly crisp.

## The trick (shared with Sheet)
The camera starts exactly where the projector is, so each letter lands as a flat shape and the creases give nothing away. Tilt the view (cursor, finger or phone) and the folds appear in every letter as facets that catch the light, and the outlines warp.

## What is underneath
- Each letter is a patch of GPU point sprites laid out from `gl_VertexID` (about 237,000 points in all on desktop, 150,000 on a phone-width screen), whose shape is the baked Houdini Vellum cloth simulation Sheet uses (`data/crumple.bin`, MIT, notice beside it), plus hand-made extra creases that differ per letter.
- The point cloud is cut to the letter: every pixel outside the type is discarded, so the letter is the paper. The patch is 28% larger than the letter's ink so folds can curl past the outline.
- The type is a mask looked up through the projector at the resting camera. It has **three channels** (red, green, blue): a letter uses channel `index mod 3`, so a letter's neighbours are never in its channel and one texture serves all nine letters.
- Letter positions come from measuring the text in the canvas (justified to the width, like the other posters).

## Interactions
- Move, drag or tilt: reveals the folds.
- **Tap a letter** (a tap, not a drag): that letter crumples into a ball (the simulation played forward), is thrown off in a random direction, and a new letter (new folds) arrives as a ball and unfolds into its place. Only that letter moves; the others stay.
- Panel actions: New folds (re-roll every letter), Crumple all (staggered, 0.09 s apart).

## Settings
Folds: relief (default 2), fold depth (frame 21), extra creases, count, crease length, width, softness, scatter, edge lift. Letters: type size, margin, points. Look: shadows on, background 0 (black), paper 1, shading 1.5, crease shadow 0.8. View: tilt sideways and up, follow speed, opening sway. Crumple: crumple, throw and unfold times.

## Checked (5 October 2026, desktop preview)
Flat head-on; tilted, every letter shows its own creases; tapping the "a" crumpled only the "a" (it became a small ball, was thrown, and a fresh "a" unfolded); no WebGL errors. Not seen on a phone.

## Open
The folds are subtle at the default view angle; relief, shading and the tilt range are the levers. Whether letters should also fold on hover or on a drag. Whether to replace Sheet in the shuffle with this. Cost: about 14 texture reads per point in the vertex shader, as in Sheet.

## Update: hard shadows, persistent balls
- Shadows are hard-edged: `shadowSoft` 0 (hard) to 1 (soft), `shadowLevels` flat tones, `shadowCut` where a shadow starts, `shadowDepth` how dark.
- Crumpled letters stay on the page as balls that roll, spin, collide and bounce (`ballSize`, `bounce`, `drag`, `toss`, `maxBalls`). Tap a ball to knock it. Actions: New folds, Crumple all, Sweep up.
- Defaults are Idan's tuned set.

## Update: balls have weight
Tossed letters are now thrown up in an arc, land with a thud, hop lower each time, then roll with rolling resistance. They kick each other up on contact, hit the page edges with a hop, and cast a hard dark shadow that drifts and grows with height. Params: `hop`, `gravity`, `thud`, `roll`.

## Status
Parked (2026-10-06). Stays a draft, not in the shuffle. Idan: the ball physics and shadows still looked bad after the second pass.
