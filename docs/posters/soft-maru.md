# Soft type (Maru) (draft test)

**Status:** test, 8 Oct 2026. Draft: `?p=soft-maru`. File: `src/posters/soft-maru.js` (a copy of `soft-type.js`); letters from `src/posters/glyph-skeleton.js`. Needs the local GT Maru trial files (`assets/fonts/GT-Maru`, not committed, see `assets/fonts/README.md`); without them it falls back to whatever the browser draws.

**What it tests.** Soft type's material and behaviour (inflate, rocket, burst) are unchanged. Only the letters differ: instead of the hand-made skeleton strokes in `lettering.js`, each letter's centre lines are extracted from GT Maru Bold. The glyph is drawn on a canvas, thinned to a one-pixel skeleton (Zhang and Suen), turned into a graph (touching junction pixels merged, bends joined, short spurs dropped), simplified, and handed to the same particle tube builder. The stroke radius is measured from the glyph (ink area divided by skeleton length).

**Findings.** All eight letters come out readable and tube-like on a first pass (Maru is a mono-line rounded face, so a stroke really is a tube). The A is slightly lopsided where the skeleton meets the crossbar. Not looked at on a phone; the physics is the pre-optimisation-equivalent code of Soft type (same optimised solver).
