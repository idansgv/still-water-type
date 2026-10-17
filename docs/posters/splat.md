# Splat type (parked)

**Brief (Idan, 17 Oct 2026).** Picked from five ideas after the PlayCanvas v2.23.0 release: "Let's start with 1." The idea as proposed: the name is a cloud of thousands of soft Gaussian splats, flat and crisp at rest. A touch scatters them like breath on dust, and they settle back. The rare colour pass gives the splats the palette.

**Target still (for agreement before any code):** `output/shots/splat-still.png` (local). Left: at rest, ~70,000 splats sized by how deep inside the letter they sit (fine at the edge, large inside), so it reads as solid type with a grain only up close. Right: a moment after a touch: splats near the finger thrown outward, stretched along their flight, the far ones barely moved.

**Open questions for Idan:**
- Settle back (dust returning to the letters) or stay where it lands until reset?
- Hover too (a breath as the pointer passes), or touch only?
- Engine: PlayCanvas gsplat (real 3D anisotropic splats, sorting, LOD; a new dependency, the first in the repo) or our own instanced splats in WebGL (no dependency, 2.5D only). Proposal: our own first for the look, PlayCanvas if depth (orbiting the cloud) turns out to matter.

**Parked (17 Oct 2026).** An interactive test was built and shared: https://claude.ai/artifact/3stf91yCC35rVXYA5T3K5A (source: `docs/posters/prototypes/splat-type.html`, a flat WebGL2 page, no PlayCanvas). Idan: "Cool. Park it." The open questions above are still open; the test page has toggles for them.
