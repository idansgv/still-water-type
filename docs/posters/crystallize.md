# Crystallize

**Status:** published 2026-10-24. Test at `/?p=crystallize`.

**Brief (Idan, 24 Oct 2026).** "Explore the concept of Voronoi diagram and propose a few directions that make the letters show up from within the Voronoi render." Four directions went to a test link (https://claude.ai/artifact/U6zbcyqECZ8e2ZV9h8vV9F): Crystallize, Develop, Fault line, Wave. He tuned Crystallize (Fraunces, 9000 cells, outside density 0.28, growth 0.35, line 1.3): "this is great. push and publish".

**Idea.** The page is a Voronoi diagram: every seed owns the patch of page closest to it. The name is never drawn. It starts as an even, coarse crackle; each frame the cells relax toward the weighted centre of what they cover (Lloyd's method) and any cell holding too much of the name splits. Inside the letters they keep splitting, outside they stay large, so the name condenses out of the pattern. *Moment:* a uniform pattern that suddenly knows where the letters are.

**How.** 2D canvas. d3-delaunay 6.0.4 (ISC) is vendored as an ES module in `src/vendor/d3-delaunay.es.js`. Seeds live in one Float64Array the triangulation reads in place. The samples for a Lloyd step are kept with a probability equal to the density (1 in the letters, 0.28 outside), so a step costs one `find()` per sample. Once the seeds stop moving and nothing splits, the poster stops computing and drawing.

**Interactions:** see `docs/INTERACTIONS.md` (Crystallize). Hover or drag stirs; tap knocks a coarse hole that refines back; hold melts; double tap starts over; three taps switch to dots only (Idan, 25 Oct 2026): the seeds without their cell edges, inverted, still live.

**The other directions** (still on the test page): Develop (seeds dropped under the pointer sharpen a coarse mosaic), Fault line (only the borders between letter cells and the rest are inked; springy seeds), Wave (a tap flips the cells card by card through the graph).

**Open:** real phones not looked at; the outside density is high (0.28), so on a small screen the name is subtle.
