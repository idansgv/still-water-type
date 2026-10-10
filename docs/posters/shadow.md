# Shadow

**Status:** draft (10 Oct 2026). Test at `/?p=shadow` (panel: `&tune`). File: `src/posters/shadow.js`. First poster built through the graduation pipeline ([PIPELINE.md](../PIPELINE.md)).

**Brief (Idan).** The letters shown are actually the shadows of random shapes, carefully organised so that the shadows they cast make the typography. Consider user interactions.

## What it is (current build, 11 Oct 2026)
Idan's latest direction: *light is directional but omni, coming from the side of the surface; items are located ON the surface (glued), casting shadows according to the light source.* (Before that: draft the type first, then at most 50 extruded objects, so the shadow makes up the type precisely.)

**The type is drafted first** as a mask of exact stroke bands (`draftMask()`; square-ended strokes from `lettering.js`).

**It is cut into fins.** The light grazes along the wall (azimuth `angle`, low elevation: `slant` = 1/tan(elevation), default 3.2, about 17 degrees). A point at height h throws its shadow a distance `h * slant` straight away from the light. So lines parallel to the light cut every letter into runs; each run has a lit end and a far end. A thin fin (about 14% of the stroke, `ridge`) stands on the wall at the lit end, as high as the run is long divided by `slant` (less its own thickness), so the shadow of its top ends exactly at the far end. Runs that line up are one fin, a smooth ridge whose height follows the run length; where the lit edge steps (an arm of the E against its stem) a new fin begins: a tall post for the long run, a low ridge for the short one. About 30 fins for IDAN SEGEV (cap 50). `cutRuns()` does the cutting; `build()` makes the fins.

**Exact at home, physics elsewhere.** The fins and their shadows together are the type. The shadows are computed from the fins' real geometry for the light as it is now, so moving the light (any side, any height) turns and stretches every shadow by its own fin's height, with no special case: the type shears into italic and tears.

**Glued, not floating.** Every fin stands on the wall (z = 0), thin, with a flat top at its own height per vertex. Seen from the front it is a thin lit ridge beside its shadow; the camera (below) shows the relief.

**Look.** Shadows are solid ink (black on white, white on black on alternate shuffles). The fins are lit solids, faces tinted by how squarely the light meets them, `glass` for transparency, hairline edges.

Earlier attempts (in git): beams hung off the wall along the light (`5ae6c65`, the "beam of light made solid" version: shadows exact, solids floating); toy-block clouds from a coverage solver (`fa97b54`); beams and tubes per stroke (`865085c`).

## Camera
Drag empty space to orbit (the light holds still while you drag). Keys **1** front, **2** side (the fins' heights in profile, with the grazing rays), **3** top, **4** from the light. **L** shows the light: a parallel ray along every shadow, from the lamp's side to where the shadow ends, and the lamp. The wall appears as a sheet once the view is not straight on.

## Interactions
- **Light:** its slant follows the pointer (mouse hover; a dragging finger; device tilt), via `stage.look`. A plateau around home (`snap`) holds the letters exact.
- **Tap a fin:** it grows (or shrinks) once and settles, and its shadow lengthens or shortens with it: the shadow is exactly the fin's height times the slant.
- **Left alone:** after `rest` seconds (4) the light eases home; a finger's drag offset is let go too.
- **Double tap empty space:** a new plan, with new heights and tilts (a beat later, so a third tap can mean reveal).
- **Three quick taps:** reveal. The page inverts and the plan is drawn: the far edge of every run (dashed) and a ray along each shadow, from the fin's ridge to the far edge, the light and its slant, the height range.
- **Hint:** until the first touch, the light makes one slow swing now and then (3.5 s, then every 9 to 13 s) and returns. Off under reduced motion.
- Gestures use `src/gestures.js` (tap 250 ms / 8 px).

## Open
- A few hairline seams remain in A and N where the drafted strokes meet at a diagonal.
- The type is a plain geometric stroke face (the skeletons in `lettering.js`), cut to a stencil-like look by the light; a more refined drafted face is possible.
- "Omni": the light azimuth is a panel slider (`angle`, re-forms) and the pointer swings it a little around home (`range`). A pointer-driven full circle (light placed at the pointer, anywhere around the wall) is not built.
- Not measured on a phone. Idan has not yet commented on this direction.
