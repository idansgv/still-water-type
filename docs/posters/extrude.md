# Extrude (draft)

**Status:** first draft, 8 Oct 2026, draft (`?p=extrude`). File: `src/posters/extrude.js`; letter outlines from `src/posters/glyph-contours.js`.

**Brief (Idan).** The letters are cut-outs in the page. On click, simulate a classic children's dough toy (a Play-Doh Fun Factory): dough squeezed through a cut-out shape. Material inspired by a translucent jelly study (artifact "Material Studies No. 009"). Black and white only.

**What it does.** The page shows the letters as holes in a plate (black holes on white, or white on black on every second shuffle). Press a letter and dough comes out of the hole as a solid prism of that letter, growing toward you and sagging under its own weight. Let go and the cutter snips it off: the piece drops down the page and lands on a ledge near the bottom, where it stays (the oldest sink away after six). A tap gives a short squirt (about half a letter high), a hold keeps pushing up to about 1.15 letter heights.

**How.** Each piece of dough is a chain of ring frames (a spine of particles, position-based dynamics: fixed segment length, bending stiffness, gravity, sticky damping; while feeding, the first particle is pinned in the die and the dough is released ring by ring). The letter's outline (from the font: canvas, marching squares, smoothing, even resampling; see `glyph-contours.js`) is swept along the spine on the GPU: the vertex shader reads ring frames and outline points from float textures and builds the surface, with normals from neighbouring points. A flat cap, masked by a picture of the letter, closes the free end and the cut end. Frames use parallel transport so the letter keeps its orientation along a bend.

**Material.** Black dough: dark body, tight highlight (two lobes), a faint light rim where the surface turns away (the "thin edge" glow of the jelly reference), darker where it leaves the page. White dough on the black page: shaded down from white by form and edge.

**Open.** First pass. Checked in the browser: the dough extrudes in the right letter shape, sags, is cut, falls and lands; the cap shows the right letter. Not tuned by feel and not yet checked with a real press. The final retuning (stiffer while feeding, darker body) was not looked at after the change. Not tested on a phone. Pieces do not collide with each other, only with the page behind and the ledge. No translucency yet beyond the rim; no shadow of the dough on the page.

**Status:** parked on 8 Oct 2026 ("it's a start"). Stays a draft, not in the shuffle.
