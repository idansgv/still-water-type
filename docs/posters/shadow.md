# Shadow

**Status:** draft (10 Oct 2026). Test at `/?p=shadow` (panel: `&tune`). File: `src/posters/shadow.js`. First poster built through the graduation pipeline ([PIPELINE.md](../PIPELINE.md)).

**Brief (Idan).** The letters shown are actually the shadows of random shapes, carefully organised so that the shadows they cast make the typography. Consider user interactions.

## What it is
A sculpture planned by the shadow it casts (Idan, 10 Oct 2026, after Kumi Yamashita's wall pieces; his references and three corrections shaped it: the light must be directional with long shadows; every part of the sculpture must matter to the shadow; at first glance the letters must not look like cast shadows). About 22 pieces hang close to the wall (a depth of about 10% of its height, so the sculpture is nearly in the plane of its own shadow) under one very low light from the right (slant 2.6, so even a small height throws the shadow well clear): square beams for straight strokes and smooth round tubes for the curves (S, D, G); their shadows are IDAN SEGEV. At first glance it is bold type with a tangle of beams in front of it; move the light and the type is shown to be nothing but shadow.

**The plan** (`build()` in `shadow.js`). Every stroke of every letter (from `lettering.js`) becomes one piece: a straight run is a square beam, a curve is one tube swept along it (14 sides, a ring every few degrees; the shadow of a bent body is the union of the hulls of its short pieces). The light is a far lamp with slant `l`; a point at height z above the wall throws its shadow to `(x - z*lx, y - z*ly)`, so a beam end that must shade the point S at height z goes at `S + z*l`, and the beam's shadow lands exactly on the run. The piece's thickness is fitted (three passes) until its shadow is as wide as the stroke. Heights come from a plane per letter: a base by row, minus a squeeze along the light (`gam`, 0.4 to 0.55 at the default tilt of 0.6), plus a sideways lean (`gp`, plus or minus 0.27 to 0.5). The squeeze bunches the positions up along the light and the lean slants them. Close to the wall there is little room for it (the heights are bounded), so the sculpture keeps some of the letters' outline: that is the price of 'close to the plane of the shadow' (Idan's note, 10 Oct). Raise `tilt` (panel) to scramble it more, at the cost of reach.

**Why it matters for the shadow.** There is no redundant piece: one beam is the only thing making its run of stroke. Moving the light slides each shadow by z times the change, so tall beams swing far and low ones barely, and the letters shear and stretch into long streaks (a snap plateau at home keeps them exact).

**Look.** Shadows are solid ink (black on white, white on black on alternate shuffles). Beams are lit solids, painter's order, faces tinted by how squarely the light meets them, hairline edges. A few ms a frame.

Earlier attempts, kept for the record: a point light in front of the wall with 300 floating polyhedra (wrong reading of the brief); 1,500 scattered blocks under an oblique light (a debris cloud, letters unreadable); a coverage solver with 120 toy blocks (bold, but the letters were fragments and it read as scatter).

## Interactions
- **Light:** its slant follows the pointer (mouse hover; a dragging finger; device tilt), via `stage.look`. A plateau around home (`snap`) holds the letters exact.
- **Tap a beam:** it and its neighbours turn a full turn about a random axis (the nearest first); their shadows boil and settle.
- **Left alone:** after `rest` seconds (4) the light eases home; a finger's drag offset is let go too.
- **Double tap empty space:** a new plan, with new leans (a beat later, so a third tap can mean reveal).
- **Three quick taps:** reveal. The page inverts and the plan is drawn: a ray from each beam to its shadow, the light and its slant, the height range.
- **Hint:** until the first touch, the light makes one slow swing now and then (3.5 s, then every 9 to 13 s) and returns. Off under reduced motion.
- Gestures use `src/gestures.js` (tap 250 ms / 8 px).

## Open
- Close to the wall the sculpture partly reads as letters (S, E, N, V show). More tilt scrambles it but needs taller pieces.
- Round ends: tubes and beams end flat (lengthened slightly so shadows join).
- Not measured on a phone. Letters collide visually where two strokes cross at similar depth.
- Ideas: a soft penumbra; a pool of light on the wall as in the reference; round beams and arcs for the curves; beams that drop in when re-formed.
