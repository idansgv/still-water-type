# Puff up and away

**Status:** removed on 5 October 2026. It was ported from Idan's standalone Vite project (`~/Downloads/puff`), shipped as a draft and briefly live. Code: git history, last at commit `e09f0ad` (`src/posters/puff.js`).

**Concept.** Each letter of "PUFF UP AND AWAY" is a balloon: hold to inflate, drag to aim, release to launch. Letters are elastic and return to their place after flying.

**Rules of the original (kept in the port).** Black or white only; no outlines or strokes; no corners (ovals, circles and pills only); DynaPuff 700; short active-voice copy.

**How it worked.** Letters are rigid bodies with states (home, inflating, flying, free, returning). Each renders from a pre-drawn sprite warped by a grid mesh of damped springs, which lags behind the body (excited by acceleration, spin and a stretch toward the aim while inflating). Flying letters vent air out of the knot (thrust drops with remaining air, jitter on the angle makes them wobble). A flying or inflating letter knocks home letters free.

**Legacy.** Its balloon-rocket idea became the seed of Soft type. Open items from the original project (a tear effect, keyboard control, a high-DPI seam check, splitting `main.js`) were never done.
