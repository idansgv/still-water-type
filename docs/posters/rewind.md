# Rewind

**Status:** published 2026-11-04. Test at `/?p=rewind`.

## What it is
The name (or an album title) in Anton, one word per line, as a block of liquid. The letters stand still until touched. A tap lets them go: they collapse, fall and splash, in slow motion, until the liquid settles above the foot line. The surprise is running it backwards: the splash climbs back up into crisp letters.

**Family: baked time.** After [mjurczyk/alembic](https://github.com/mjurczyk/alembic), a JS reader for Alembic (.abc) caches: a simulation is baked frame by frame and played back by sampling it at a time t, so it scrubs both ways. Nothing the visitor does feeds back into the simulation.

## Interactions
- **Tap:** play forward in slow motion (0.6x) until the liquid settles. A tap at the end plays again from the letters.
- **Hold** (250 ms, still): time runs backwards while held, spinning up like a motor and easing into the letters.
- **Sideways drag:** scrubs time, eased like handling tape.
- **Double tap:** rewinds all the way to the letters (a 420 ms beat later, so a third tap can still mean reveal), from where the first tap found the tape.
- **Three taps:** reveal: every particle as a dot (one frame of the cache), the tape with how far the bake has got, and the playhead.
- **Load:** the letters stand still until the first touch; no intro, no self-demo (Idan, 4 Nov 2026).

## How it works
- *Sim:* about 14,500 particles (about 10,000 on a phone) seeded on a hex lattice inside the letters. 2D double-density relaxation liquid (Clavet et al. 2005) with a uniform-grid spatial hash, 8 steps per baked frame. Negative pressure is the surface tension; viscosity damps; the screen edges are walls and the floor sits just above the site's foot line.
- *Bake:* in a blob Worker built from the same function (main-thread fallback in chunks), 10 s of sim at 30 frames a second, one Float32 (x, y) pair per particle per frame (about 35 MB). Chunks of 6 frames are posted as they finish; the playhead waits at the baked frontier. On a laptop the bake takes about 9 s, ahead of the 0.6x playback.
- *Render:* raw WebGL2. Particles are splatted into a float texture (red: a summed Gaussian field; alpha: the largest droplet disc) and thresholded into one smooth body in pure ink on the page colour. Near t = 0 the letter mask fades in over the field, so the rest frame is the clean type.

## Idan's tuning (4 Nov 2026)
Splash render, Anton, 14,500 particles, viscosity 0.89, surface tension 1.4, gravity 0.5, bake 10 s, play speed 0.6, scrub sensitivity 0.3, threshold 0.31, blur 1.15, droplet 0.55. Settings panel: `?p=rewind&tune`.

## Port notes (4 Nov 2026)
- `src/posters/rewind.js` from the test page `docs/posters/prototypes/rewind.html` (private Artifact link). Left out: the face menu, the Liquid body render (from Chronophotograph) and the words field (the site gives the words).
- Changed from the test page: the floor sits above the site's foot line (52 px, or 7% of the height on a phone) so the foot stays readable; phones seed 70% of the particles so the bake stays ahead of playback.
- Porting to a real .abc / .wabc: replace `startBake()` with loading the file into `bake.data`; `draw(t)` only reads `bake.data`, `bake.done` and `bake.N`, the same as `getSample(t)`.

## Open
- Not measured on a real phone: bake speed on a mid-range phone, and memory (about 25 MB on a phone).
