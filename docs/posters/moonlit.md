# Moonlit

**Status:** published 2026-10-25. Test at `/?p=moonlit`.

**Concept.** The name is a slick on a moonlit sea, seen from straight above. A slick damps the smallest ripples, so where the wind roughens the water it breaks into moon glitter, and the letters stay glassy and dark inside it. The type is made of an absence. After Open Water (github.com/Leonxlnx/open-water, MIT): ideas, own code.

**Source:** `src/posters/moonlit.js`; the test page it came from is `docs/posters/prototypes/cats-paw.html` (top-down v1), https://claude.ai/artifact/Po1zZFnQnPoXPMjtRByRRL. The horizon branch (`cats-paw-horizon.html`) is a separate test and not this poster.

**Idan's tuning (25 Oct 2026), the defaults:** `{"day":false,"density":2.6,"moon":50,"ripple":1.25,"gust":50,"last":3.9,"edge":0,"weight":900,"trace":0.16,"foam":0.8,"thunder":false}`. Night only (no day version), no thunder. The trace of 0.16 is a light breeze everywhere outside the letters, so the name shows at rest as dark water in a field of glitter that keeps shimmering.

## Interactions
- **Hover / drag:** wind under the pointer; gusts drift downwind (left to right) and die away.
- **Tap:** a puff of wind.
- **Hold:** a gale: swell, foam on the crests, and the slick tears into strands of foam; it heals over several seconds after you let go.
- **Double tap:** calm (after the re-form beat).
- **Reveal (three taps):** lightning beyond the frame and a gust across the whole page; drawn over it: the wind and a title block.
- **Self-demo:** once, after 3.5 s untouched, a gust crosses the page.
- **Reduced motion:** no demo, and the sea is frozen (no wave motion, no glitter flicker).

## Note
The standing breeze means the glitter moves at rest. That is Idan's choice for this poster (the name has to show); under reduced motion it stands still.
