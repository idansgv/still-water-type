# Glitter (draft)

**Status:** published 2026-10-25. Test at `/?p=glitter`.

**Brief (Idan, 24 Oct 2026).** One of three type-as-material posters from Open Water (with Lace and Vessel), after Cat's paw was parked: no scene, the letters are the material. "3 options sound cool. lets create all as different posters."

**Concept.** The name is the only water on a black page, and the pointer is the moon. A calm letter is a black mirror, so the name barely shows. When the moon passes, the letters appear as thousands of separate glints: sharp sparkles where the light is close, a soft glow where it isn't. The name exists only where the light finds it.

**Test page:** source `docs/posters/prototypes/glitter.html` (WebGL2, no library). Link: https://claude.ai/artifact/T8Uz8Vt3KwSkizoZXU1uaa

## Interactions
- **Move:** the moon follows; the move leaves a wake of ripples, so the glitter flares behind it and then settles.
- **Tap:** a splash of ripples.
- **Hold:** wind. Every letter roughens and the glitter spreads across the name.
- **Double tap:** calm.
- **Reveal (three taps):** the moon climbs high and a breeze crosses every letter, so the whole name blazes for a moment.
- At rest: still, the name a faint dark grey ("The name, seen at rest"). One self-demo on load: the moon crosses low, trailing a breeze, then rests high above the middle. Off under reduced motion.

## How (from Open Water's glitter model)
24 ripples from 3 to 240 px; ripples too fine for a pixel become slope variance (roughness). The moon is a small light above the page; at each pixel the expected glint radiance comes from the slope distribution, and the glints are drawn as a Poisson count, so close to the light they are discrete sparkles and further off a glow. HDR with a quarter-size bloom. The wake is a quarter-resolution field that spreads and decays.

## Notes
Black only, like Glint (light on black). Nearest neighbour is Glint ("light finds the type"); the difference is the material: liquid, stochastic sparkle rather than a bevel.

## Open questions (on Settings)
Moon height (how far the glitter reaches), moonlight, glint density, ripples from a move, how long ripples last, bloom, how visible the name is at rest, type weight.

**Tuned by Idan (24 Oct 2026), now the defaults:** `{"height":1.42,"moon":2.7,"grain":0.65,"rough":2.45,"last":3.8,"bloom":0.7,"rest":0,"weight":700}`

**In the site (24 Oct 2026):** draft poster `src/posters/glitter.js`, `?p=glitter` (settings: `&tune`). Not in the shuffle, no share page. Black only (`darkOnly`). Reveal (three taps, the engine gesture) makes the moon climb and draws the moon and its reach; double tap calms; the self-demo now waits 3.5 s untouched, per the standard.
