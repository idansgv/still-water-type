# Shadow

**Status:** draft (10 Oct 2026). Test at `/?p=shadow` (panel: `&tune`). File: `src/posters/shadow.js`. First poster built through the graduation pipeline ([PIPELINE.md](../PIPELINE.md)).

**Brief (Idan).** The letters shown are actually the shadows of random shapes, carefully organised so that the shadows they cast make the typography. Consider user interactions.

## What it is
About 230 bulky wooden toy blocks (cubes, thick slabs, short bars, stub and fat cylinders, half-rounds, a wedge; nothing thin) lie on the wall plane, a thin layer standing out about 11% of the wall's height at most, under one low directional light from the upper right; they are not a 3D cloud (Idan, 10 Oct: "not cloud, should lay on the plane"; "fewer, larger, bulkier") ; the shadows they cast are IDAN SEGEV. The reference is Kumi Yamashita's wall pieces, which Idan shared on 10 Oct 2026 and pointed back to twice: the *kind* of shapes (toy blocks, not abstract polyhedra, beams or tubes) and the *distribution* (densest where the shadow is, thinning and scattering toward the light; where blocks are many the shadows merge into one solid mass, and at the edges single shadows show beside their blocks). His other notes: bigger shapes, carefully chosen and placed; a directional light with long shadows; every part of the sculpture must have a noticeable effect on the shadow.

**Geometry.** A far light with slant `l` (|l| 2.2, from the upper right). A point at height z above the wall throws its shadow to `(x - z*lx, y - z*ly)`; a block's shadow is the hull of its corners thrown that way, so it is the block moved by its distance from the wall and stretched along the light by its own depth (a peg standing out of the wall throws a long streak). Moving the light slides every shadow by z times the change: tall blocks swing far, low ones barely, and the letters tear apart (a plateau at home, `snap`, keeps them exact).

**The plan** (`build()` in `shadow.js`, solved, not scattered). The letters are drawn into a half-size mask. Blocks are added one at a time, the outline first (so edges come out crisp), then the inside. For each bare spot 90 candidates are tried (kind, size, how it lies: 84% flat on the wall, 7% a peg standing out of it, the rest at any angle; height: `0.25 + 0.75 * u^1.2` of the depth). A candidate's real shadow polygon is scored: `new letter - 8 * spill - 1.2 * covered twice - crowding - leaving the page`. The best stays only if it brings enough that is its own and spills little (under 15% of its gain), so no block is redundant. About 90% of the letters are covered with 8% spill (shown in the reveal).

**Look.** Shadows are solid ink (black on white; white on black on alternate shuffles). Blocks are lit solids, painter's order low first, faces tinted by how squarely the light meets them, hairline edges (round blocks show edges on their ends only). Nothing is drawn when nothing changes.

Earlier attempts, kept for the record: a point light in front of the wall with 300 polyhedra; 1,500 small polyhedra; a few dozen blocks (letters were fragments); one beam or tube per stroke close to the wall (a clever frame, but not the shapes or the distribution of the reference; it is in the git history as `b77ce8d` and `865085c`).

## Interactions
- **Light:** its slant follows the pointer (mouse hover; a dragging finger; device tilt), via `stage.look`. A plateau around home (`snap`) holds the letters exact.
- **Tap a block:** it and its neighbours turn a full turn about a random axis (the nearest first); their shadows boil and settle.
- **Left alone:** after `rest` seconds (4) the light eases home; a finger's drag offset is let go too.
- **Double tap empty space:** a new plan, with new blocks (a beat later, so a third tap can mean reveal).
- **Three quick taps:** reveal. The page inverts and the plan is drawn: each block's shadow outlined and a ray from each block to it, the light and its slant, the height range.
- **Hint:** until the first touch, the light makes one slow swing now and then (3.5 s, then every 9 to 13 s) and returns. Off under reduced motion.
- Gestures use `src/gestures.js` (tap 250 ms / 8 px).

## Open
- Fewer and bulkier blocks cost legibility: letters are readable but fragmentary (counters of D, A, G fill in). Fewer, larger blocks and long shadows pull against each other; a lower slant or thinner letters would recover it.
- Letters are legible but rough-edged (they are made of block shadows); smaller blocks (`size`) sharpen them.
- Not measured on a phone.
- Ideas: a pool of light on the wall as in the reference; warm wood tones are not allowed (black and white only), so the wood is carried by shading alone; blocks that drop in when re-formed.
