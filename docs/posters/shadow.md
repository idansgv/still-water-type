# Shadow

**Status:** draft (10 Oct 2026). Test at `/?p=shadow` (panel: `&tune`). File: `src/posters/shadow.js`. First poster built through the graduation pipeline ([PIPELINE.md](../PIPELINE.md)).

**Brief (Idan).** The letters shown are actually the shadows of random shapes, carefully organised so that the shadows they cast make the typography. Consider user interactions.

## What it is
A few hundred solid objects (cube, octahedron, tetrahedron, icosahedron, hexagonal / triangular / long square prisms, two pyramids) hang at different depths in front of a wall. Each one is placed so that its shadow from one lamp lands on a stroke of IDAN SEGEV (strokes from `lettering.js`, the same composition as the other type posters). From the lamp's home position the shadows join into the name; from anywhere else the same objects throw a scatter of unrelated shapes.

**Geometry.** Point light at height D over a wall at depth 0. An object at depth z casts its shadow magnified by `m = D / (D - z)`, to `L + (P - L) * m`. To land a shadow on target T the object is put at `L0 + (T - L0) / m` and drawn `1/m` as big, so the objects form a smaller, layered cloud in front of the full-size shadow letters. Moving the lamp slides each shadow by `(m - 1)` times the move, nearer objects further, which tears the letters apart. Depth comes from a slow field over the page plus a jitter, so the cloud reads as one hung sculpture.

**Look.** Shadows are solid ink (black on white, white on black on alternate shuffles). Objects are ghost line drawings that invert what is behind them (`globalCompositeOperation = 'difference'`), so they never hide a letter. All edges go into one path per frame, because drawing a shared edge twice with `difference` would cancel it.

## Interactions
- **Lamp:** follows the pointer (mouse hover; a dragging finger; device tilt), via `stage.look`. A plateau around home (`snap`) holds the letters exact.
- **Tap an object:** it and its neighbours turn a full turn (the nearest first); the shadows boil and settle.
- **Left alone:** after `rest` seconds (4) the lamp eases home; a finger's drag offset is let go too.
- **Double tap empty space:** new objects (a beat later, so a third tap can mean reveal).
- **Three quick taps:** reveal. The page inverts and the plan is drawn: the lamp, a ray from the lamp through each object to its shadow, the ring where the letters are exact, depth range.
- **Hint:** until the first touch, the lamp makes one slow swing now and then (3.5 s, then every 9 to 13 s) and returns. Off under reduced motion.
- Gestures use `src/gestures.js` (tap 250 ms / 8 px).

## Open
- Shadow edges are polygonal blobs; more and smaller objects (`size`) sharpen them at a cost in frames.
- Not measured on a phone. Letters collide visually where two strokes cross at similar depth.
- Ideas: a real soft penumbra; objects that settle with a small drop when re-formed; two lamps.
