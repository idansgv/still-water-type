# Shadow

**Status:** draft (10 Oct 2026). Test at `/?p=shadow` (panel: `&tune`). File: `src/posters/shadow.js`. First poster built through the graduation pipeline ([PIPELINE.md](../PIPELINE.md)).

**Brief (Idan).** The letters shown are actually the shadows of random shapes, carefully organised so that the shadows they cast make the typography. Consider user interactions.

## What it is (current build, 11 Oct 2026)
Idan's spec: *draft the type first, then place no more than 50 objects, extruded at different heights and placed at different angles, so that the directional light casts a shadow that makes up the type precisely.*

**The type is drafted first** (`draft()` in `shadow.js`): every stroke of every letter as exact shapes, a straight bar for a straight stroke and one bent band for a curve (22 pieces for IDAN SEGEV, never more than 50).

**Each piece becomes one solid.** The light is a far lamp with slant `l`; a point at height z above the wall throws its shadow to `(x - z*lx, y - z*ly)`. So the point whose shadow must land on p, at height z, sits at `p + z*l`. Give every corner of the piece any height at all and its shadow still lands on p. A solid whose bottom and top faces are the piece lifted to heights of its own (so each end can be tilted any way) therefore casts exactly the piece, and its sides are parallel to the light (a beam of light made solid). At the home light the shadow is the type exactly; the heights and tilts are free, and they are the sculpture. Move the light and each corner's shadow shears by its height: tall ends swing far, low ends barely.

**Not on the plane.** The solids hang above the wall (heights 3 to 20% of its height, `depth` and `length`), because a solid that touched the wall would hide its own shadow; the front view flattens that, which is why there is a camera.

**Look.** Shadows are solid ink (black on white, white on black on alternate shuffles). The solids are drawn painter's order from the camera, faces tinted by how squarely the light meets them and half transparent (`glass`) so the type shows through, hairline edges.

## Camera (11 Oct)
Drag empty space to orbit (the light holds still while you drag; a drag is more than 8 px). Keys **1** front, **2** side (how far each solid stands out), **3** top, **4** from the light: looking down the beams, the solids line up and read as the type, which shows why the shadow is exact. **L** (or the panel) shows the light: a parallel ray for every solid, from the lamp's side down to where that solid's shadow falls (each passes through its solid), and the lamp at the far end (drawn as near as keeps it on the screen). It follows the light as you move it. The wall appears as a sheet once the view is not straight on. The panel has the same four views as buttons.

Earlier attempts (in git, not what Idan asked for): a point light with 300 polyhedra; 1,500 and then 230 scattered toy blocks from a coverage solver (`fa97b54`); a beam or tube per stroke (`b77ce8d`, `865085c`).

## Interactions
- **Light:** its slant follows the pointer (mouse hover; a dragging finger; device tilt), via `stage.look`. A plateau around home (`snap`) holds the letters exact.
- **Tap a solid:** it slides along the light and back (the shadow, at home, does not move: the proof that the shadow depends only on where the beam points).
- **Left alone:** after `rest` seconds (4) the light eases home; a finger's drag offset is let go too.
- **Double tap empty space:** a new plan, with new heights and tilts (a beat later, so a third tap can mean reveal).
- **Three quick taps:** reveal. The page inverts and the plan is drawn: the type as drafted (dashed) and a ray from each solid to its piece, the light and its slant, the height range.
- **Hint:** until the first touch, the light makes one slow swing now and then (3.5 s, then every 9 to 13 s) and returns. Off under reduced motion.
- Gestures use `src/gestures.js` (tap 250 ms / 8 px).

## Open
- The solids still sit over part of the type from the front (glass faces soften it). Raising `depth` or lowering `span` moves them off it at the cost of reach.
- The letterforms are plain geometric strokes (from `lettering.js` skeletons), not a refined face.
- Not measured on a phone. Idan has not yet commented on the interactions or the camera.
