# Lace (draft)

**Status:** draft in the site (`?p=lace`), 24 Oct 2026; settings tuned by Idan. Not in the shuffle, not published.

**Brief (Idan, 24 Oct 2026).** After Cat's paw was parked ("3d and text dont blend when they're plainly put together"): pitch ideas that apply Open Water's materials to the letterforms with no scene. "3 options sound cool. lets create all as different posters." Lace is one of the three (with Glitter and Vessel).

**Concept.** The name is made of sea foam. At rest it is solid, crisp type. Touched, the foam ages the way real foam does (after Open Water): a fresh whitecap does not shrink as a blob, it opens up along the bubble network. Bubble middles open first and the films between them last, so heavy type thins into lace that still reads as the name.

**Test page:** source `docs/posters/prototypes/lace.html` (WebGL2, no library).

## Interactions
- **Move** (desktop): a breath ages the foam a little under the pointer.
- **Drag:** ages the foam faster and pulls it a little along the stroke.
- **Tap:** a strong puff; a patch of lace opens.
- **Hold:** a gale. All the foam ages, is blown along in rows, and can thin away entirely.
- **Double tap:** fresh foam (whipped up again).
- **Reveal (three taps):** a breaker rolls across from the left and lays fresh foam as it passes.
- At rest: perfectly still. One self-demo on load: a slow breath crosses the middle and opens some lace. Off under reduced motion.

## How
- **State** at screen resolution, float textures: foam density, how fast each bit is ageing, and where that bit of foam started. The start position travels with the foam, so the bubble pattern stretches when the foam is pulled, rather than sliding under it.
- **Wind** is a second field: drags push it, it decays in a quarter of a second, and tiny drift is zeroed so still foam stays sharp.
- **Drawing:** foam shows where a two-scale bubble-raft pattern (Voronoi films, big and small bubbles) lies below the local density. Thin films are drawn slightly dimmer than solid cores.
- Colours: white foam on black; "Light page" in Settings swaps to black foam on white.

## Open questions (on Settings)
Bubble sizes, how fast foam ages, how much lace survives (the floor that keeps it readable), drag pull, touch size, type weight (Bitter).

**Test link (24 Oct 2026):** https://claude.ai/artifact/GFUnQeo1yicyh3wRN7fcP4

**Tuned by Idan (24 Oct 2026), now the defaults:** `{"light":true,"big":8,"small":15,"rate":0.2,"floor":0.11,"pull":1.25,"brush":65,"weight":840}`

**In the site (24 Oct 2026):** draft poster `src/posters/lace.js`, `?p=lace` (settings: `&tune`). Not in the shuffle, no share page. Follows the black and white sequence (themes weighted 0.7 to the light page, Idan's pick). The prototype's three-tap breaker is now the double tap (re-form); three taps are the engine's reveal. The self-demo waits 3.5 s untouched, per the standard. Needs float render targets.
