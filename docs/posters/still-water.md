# Still Water

**Status:** live, in the shuffle. The benchmark every other poster is measured against. File: `src/posters/still-water.js`. Link: `idansegev.com/p/still-water/`.

## Concept
"IDAN / SEGEV" (flat, one colour) over a real water surface. The type never breaks: the water moves over it and remembers every touch, then forgets.

## At rest
(Changed 8 Oct 2026.) The same composition as the other type posters: IDAN over SEGEV (IDAN, SE, GEV on a narrow screen), as large as the width allows, each row centred, the same margins and footer room. One colour only, in the font Leida when its local files are present (Archivo on the live site). Black on white by default, white on black on every second shuffle (the same alternation as Explode). Perfectly still. The old composition (a small "Idan" top left with a dim "Segev") and the dim second colour are gone.

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
- Colours: black on white, swapped on every second shuffle; the lamp is always a night scene (light on black), whichever colours the page has.
- Needs float render targets; throws (and the page shows the static type) if the browser lacks them.
- Lyrics support is parked in the code (`lyrics: []`); `?live` mirrors a local Wordflow3d server's current word, off by default because a public page contacting localhost can trigger Chrome's local-network prompt.
- No settings panel.

## History
It was the single poster of the site before the portfolio existed (tagged `still-water-v1`), ported into the poster system unchanged in spirit. Why it works: one material and one gesture, type that stays intact, a response with memory, a small asymmetric composition, still at rest, nothing instructional.

**Lighter (8 Oct 2026).** The type is now Leida Book (weight 350) instead of Black, to make the poster gentler; the panel (`?p=still-water&tune`, or T) has a Weight slider from 200 to 900. On the live site, where Leida is absent, Archivo falls back to its nearest weight (700).

**Not all caps (8 Oct 2026).** The type is "Idan / Segev" in mixed case again (two rows on every screen shape). The block is fitted from the top of the d to the bottom of the g, centred, with the same margins as the other posters.

## Reveal (10 Oct 2026)
The triple tap is now an engine gesture shared by every poster (`stage.setReveal`); here it still toggles the lamp, which is this poster's reveal. L does the same.
