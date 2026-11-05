# Jet

**Status:** published 2026-11-05. Test at `/?p=jet`.

Idea taken from github.com/prinzipiell/tsl, *Splish Splash* (SPH water running along a torus knot, with spray that recovers). The repo has no license, so only the idea is used; the code is our own (Rewind's liquid and renderer, Arboretum's skeleton).

**Concept: water as the stroke.** The name is written by a stream of water flowing in mid-air along each letter's centre line, as if a hose could write. No pipe, no floor, no scene: just the water holding the letter shapes. Each letter's water rises from its lowest point and runs out to the stroke ends. Pulses travel along the stream, so you can see it flowing.

**The surprise:** you can cut it. A drag across the name knocks the water out of the stream: it flies off as spray and loose sheets and falls away. The gap is then carried downstream and new water keeps coming from the source, so the letters re-form by themselves.

## Interactions
- **Drag:** cuts the stream where it crosses. The water flies off along the drag.
- **Tap on the water:** splashes the stream at that point.
- **Tap on the page:** drains it: as if held, with the sources shut, until the letters are empty; then they fill again (Idan, 5 Nov 2026).
- **Hold:** turns up the pressure. The stream runs faster and wider, and the stroke ends spray out in arcs, like a fountain.
- **Double tap:** the loose water flies back into the stream.
- **Load:** one cut across the name, played by itself, until the first touch.

## How it works
- *Paths:* text mask (Inter Tight 600), then Zhang–Suen thinning, a tree from the lowest pixel, short spurs pruned, smoothed chains (as Arboretum). Each chain runs from the root out to its end.
- *Water:* a live 2D particle liquid (Clavet double-density relaxation, as Rewind, but run per frame and not baked). Particles in the stream are kinematic: emitted at each chain's start at a fixed rate, moved along the chain at the flow speed, with a lateral offset inside the jet's width. Loose particles fall under gravity with the liquid forces (surface tension makes the sheets and droplets), fade out and go back into a shared reserve that feeds the sources.
- *Render:* Rewind's metaball splat (a summed Gaussian field plus droplet discs, thresholded), in pure ink on the page colour.
- *Defaults:* Idan's tuning from the test page (5 Nov 2026), `DEF` in `src/posters/jet.js`.

## Open questions
- Water flowing at rest is idle motion; Idan chose it (like Arboretum's wind). Under reduced motion it stands still until touched.
- Reveal (three taps): the centre lines, each source and every particle.
