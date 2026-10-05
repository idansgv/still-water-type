# Sheet

**Status:** live, in the shuffle. File: `src/posters/sheet.js`. Data: `src/posters/data/crumple.bin`. Link: `idansegev.com/p/sheet/`.

## Concept
Type projected onto a lightly wrinkled sheet of paper. Head-on it is perfectly flat; only when the view moves does it read as paper.

## At rest
A flat white-on-black print with one dry line of copy ("Nothing to see here." and three others).

## The trick
The camera at rest sits exactly where the projector is, so the type lands as a perfectly flat, crisp print and the paper shows no relief or shading. Moving the view makes the same projected type slide across the folds: warps in the lettering, a trace of shading, curling corners and edge. The idea of a flat image that is secretly 3D and revealed by camera movement follows the three-ml-sharp demo (idea only, no code).

## What is underneath
- The paper is a cloud of 170,000 to 250,000 GPU point sprites laid out from `gl_VertexID`, so a new sheet costs almost nothing.
- Its shape is a real cloth simulation: a Houdini Vellum crumple baked as a Vertex Animation Texture (data from item-develop/paper-crumple-demo, MIT, notice in `data/crumple.LICENSE.txt`). `tools/vat-extract.mjs` decodes it offline into `crumple.bin` (50 frames of a 70 by 50 grid, with normals and a cavity term). In the browser it becomes two `TEXTURE_2D_ARRAY`s read in the vertex shader.
- The resting wrinkles are an early frame of the paper buckling (frame 21 by default), mirrored randomly per sheet, jittered, plus a little hand-made crease noise, so no two sheets match.
- Shading is a difference from the view at rest, and the crease shadow is gated by how far the view has moved, so rest stays flat.

## Interactions
- Move, drag or tilt: reveals the folds.
- Click or tap (not a drag): the sheet crumples into a ball, tumbles off a random edge; a new sheet arrives as a tumbling ball from the other side and unfolds, with the next line of copy.

## Settings (`?p=sheet&tune` or T)
Shadows on or off, background / paper / type greys (black to white only; the page chrome follows the background), relief, wrinkle depth, extra creases, sheet size, point count, shading, crease shadow, tilt range and follow speed, opening sway, the lines of copy, type size and margin, crumple / throw / unfold times. Defaults are Idan's tuned values (relief 0, shadows off, light page 0.95). Dark theme default; the panel is closed unless `?tune` or T.

## Performance and limits
About 14 texture reads per point in the vertex shader. The frame-time governor lowers pixel resolution but not point count, so on a slow phone the Points setting is the lever. Not measured on a phone.

## History
Built after Idan's brief ("type projected on a lightly wrinkled piece of paper, only clear on camera tilt"). A first procedural version (point cloud) was liked; it gained a tuning panel and the crumple interaction; it was then rebuilt around the baked cloth simulation from the Codrops VAT article for realistic wrinkles. Not adopted from the article: its physics engine (grab, push, roll, throw) and SSAO pass. Apple's ml-sharp was not used (research-only licence, 2.8 GB).
