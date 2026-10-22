# Splat type

**Status:** published (21 Oct 2026).

**Brief (Idan, 17 Oct 2026).** Round one of the five ideas after the PlayCanvas v2.23.0 release ("Let's start with 1"): the name made of gaussian splats. Parked, then tuned on the test page, and published with his settings on 21 Oct 2026: `reach 115, force 2100, back 1.2, grain 1.85, settle on, breath on`.

**What it is.** About 40,000 to 110,000 soft, translucent gaussians sampled inside the letters, each sized to fit within the letter, so together they read as solid type with a grainy, painterly body. A press throws the dust near it outward; a drag pushes it along and stretches it into streaks while it flies; a mouse only breathes on it. Then every splat springs back home. WebGL2, instanced quads, a spring per splat on the CPU; nothing is drawn at rest.

**Test page:** https://claude.ai/artifact/3stf91yCC35rVXYA5T3K5A (source `docs/posters/prototypes/splat-type.html`). Site code: `src/posters/splat-type.js`.

**Colour:** from the first press the splats take the palette down the page (shared framework, `colourOf`).
