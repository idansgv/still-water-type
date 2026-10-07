# Ink (draft)

**Status:** first draft, 7 Oct 2026. Not in the shuffle. Test at `/?p=ink`.

**Why.** A test of "liquid ink" as a different material from Soft type's balloon (inflate, rocket, burst). Written from scratch rather than adapted from Soft type: no links, no rods, no stroke tubes, no air.

**What it is.** The name as a pool of ink. Black on white (dark 15%), flat, plain at rest.
- **Drag** pulls a tongue of ink after your finger; it stretches into a thread that thins and snaps back.
- **Push a letter into a neighbour** and the two fuse where they touch.
- **Tap** splashes the ink outward; it flows home slowly, as a liquid does.
- **Hint** (until the first touch): every few seconds a slow swell runs along one letter.

**How the ink behaves.** About 1,000 particles ("droplets") laid in rows along every stroke, each remembering its home. Close pairs push apart (volume). Pairs that have been moved off their place pull together (surface tension, which is what necks a thread and rounds a droplet); that pull fades far from home so the ink can flow back. Neighbours share velocity (viscosity). A spring holds each droplet to its home. Nothing else holds the ink together, so it can tear and join freely.

**How it is drawn.** Each droplet is a soft round kernel added into a half-resolution field (WebGL); the ink is wherever the sum is over a threshold (a metaball surface), so nearby drops melt into one shape and a stretched bridge thins away before it breaks. The threshold is calibrated at start so a stroke has its designed thickness.

**Open.** Tuned only by numbers so far, not by feel: the cohesion, viscosity and home spring (constants at the top of `stepOnce`) decide how stringy it is. Not measured on a phone. No settings panel yet.
