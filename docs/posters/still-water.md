# Still Water

**Status:** live, in the shuffle. The benchmark every other poster is measured against. File: `src/posters/still-water.js`. Link: `idansegev.com/p/still-water/`.

## Concept
Flat white "Idan / Segev" on black over a real water surface. The type never breaks: the water moves over it and remembers every touch, then forgets.

## At rest
A small, asymmetric composition with a lot of black, perfectly still.

## What is underneath
- A **wave-equation ripple simulation** stepped on the GPU: a height field in a texture (height now, height last step), with the edges clamped.
- **Refraction** of the type through the moving surface.
- A hidden **lamp** that throws caustics (light gathered where the surface curves) through the water onto the type, after the lamp scene of the caustic-volume demo.

## Interactions
- Move the pointer or a finger to wake the water; a drag lays a continuous ripple; a tap drops a stone.
- **Lamp:** press L, or tap three times quickly. It fades in, follows the pointer, wanders on its own after 2.5 s of stillness, and while on it drips a ripple about every 1.1 s.
- **Rain:** press X.
- Reduced motion lowers every amplitude to 45% and stops the lamp's drip.

## Other facts
- Theme: dark only (odds 1:0).
- Needs float render targets; throws (and the page shows the static type) if the browser lacks them.
- Lyrics support is parked in the code (`lyrics: []`); `?live` mirrors a local Wordflow3d server's current word, off by default because a public page contacting localhost can trigger Chrome's local-network prompt.
- No settings panel.

## History
It was the single poster of the site before the portfolio existed (tagged `still-water-v1`), ported into the poster system unchanged in spirit. Why it works: one material and one gesture, type that stays intact, a response with memory, a small asymmetric composition, still at rest, nothing instructional.
