# Explode

**Status:** live, in the shuffle (added 5 October 2026). Files: `src/posters/explode.js` (a three-line wrapper) on `columns-core.js`, with `physics.js`, `shatter.js`, `dust.js`, `lib3d.js`, `lettering.js`. Link: `idansegev.com/p/explode/`. Settings: `?p=explode&tune`.

## Concept
"Idan Segev" as flat type on a white page that is really solid extruded columns, seen straight down through an orthographic camera so only the tops show. Tap a letter and it shatters into pieces; the pieces and the blast knock, crack or set off the others.

## At rest
Plain bold black type on white (the default; background and foreground are sliders, black to white only). The letters are the Soft type skeletons thickened into overlapping boxes, mitred at the joints so curves stay smooth, and extruded to a height you can set (default 0.85, a low slab).

## What is underneath
- **Rapier rigid bodies** through the `physics.js` wrapper. The standing letters are static bodies of coarse boxes; their smooth look is drawn from finer boxes. Physics runs at 90 Hz.
- **Shattering** (`shatter.js`): each box is broken into irregular convex pieces (a Voronoi cell per jittered seed, each built by cutting the box with bisecting planes; volume is conserved). Every piece is a convex rigid body and a free-form mesh. Size and irregularity are settings; up to 220 pieces per box and 4,000 in the world.
- **Rendering:** standing columns are one instanced draw; pieces are one growing vertex buffer, each placed every frame from a float texture of transforms. Tops are pure foreground, the face the letter is cut into stays bright even when a piece lies down, sides are grey.
- **Dust** (`dust.js`): soft or hard-edged puffs from impacts, from a letter turning to dust (up to 260 particles sampled over the surface its boxes occupied) and from cracks. Off by default.
- **Camera** for setting up: tilt, turn, zoom, perspective. Taps and picking follow the camera by casting a ray through the pixel.

## Interactions
- **Tap a letter:** it blows at once from the point you touched. Only the tapped letter has power of its own.
- **Struck letters break apart** (toggle, on): a letter set off by a flying piece, or a box broken off by one, spawns pieces at rest and hands them only the momentum of what hit them, falling off sharply with distance from the impact point (about 1.2 units), so the near side is shoved and the rest slumps. No burst lines for these.
- **Cracks:** damage accumulates in a standing column's boxes (their tops darken). At "Damage that starts a crack" a box cracks in place: it becomes pieces that may only slide and turn about the vertical, with heavy damping (so the letter stays standing with slightly offset slabs and seams), by an amount set by Jitter. At damage 1 a box breaks away. Damage comes from the blast (as far as Crack reach, falling off with distance) and from flying pieces (scaled by "Damage from flying pieces", default 0.35, only above 5.5 units a second).
- **Chain:** a piece hitting another letter harder than "Impact that sets a letter off" sets the whole letter off, at a fraction of the strength ("Strength kept per step") each time.
- **Reset:** double tap empty space, or Re-form in the panel. Detonate all sets every letter off left to right.

## Settings and defaults (`?tune`)
World: extrusion height 0.85 (0.05 to 8; changing it re-forms), gravity 26, bounce 0.95, slipperiness 0.32. Blast: power 0.4, outward speed 1.12, lift 0.4, spin 1.4 (power and speed go down to 0.02). Chain and cracks: chain impact 30, strength kept 0.3, cracking 0.25, crack at 0.46, jitter 0.05, reach 2.95, damage from flying pieces 0.35, struck letters break apart on with momentum 0.2. Pieces (next blast): size **0.16** (down to 0.03), irregularity 2 (up to 2), fit 0.8. Effects: adapt to slow devices on, burst lines off, shake off, dust 0 (amount, puff size 0.4, lasts 1.6 s, dust from impacts off, tone 0.5, softness 0.6, opacity 0.8). Colour: background 1, foreground 0. Camera: tilt 0, turn 0, zoom 1, perspective 0 (flat). These are Idan's tuned values (third set, 5 October 2026), with the piece size raised from 0.1 to 0.16 and the piece-damage scale added afterwards as the middle ground between size and performance.

## Performance
Measured on desktop with the defaults: a tap on a letter makes about 525 pieces and a frame costs about 5 ms (at the previous size 0.1: about 1,100 pieces, about 12 ms; at 0.22: about 200 pieces, 2.5 ms; at 0.3: about 115, 1.3 ms). **Adapting to slow devices:** a piece-size multiplier starts at 1.15 on a touch device and 1.8 on a touch device with 4 or fewer cores or 3 GB or less of memory, and a frame-time governor raises it by 35% (to 4) when frames average over 27 ms for about 24 frames while more than 120 pieces exist, clearing 30 to 50% of the pieces that have come to rest (oldest first). It never touches pieces still moving. The 2 MB physics engine loads when the poster opens. Not measured on an old phone.

## History
Born as "Columns" (one poster with a hold-to-burst gesture), split on 5 October 2026 into Collapse and Explode at Idan's request. Explode went through: a first version with extruded triangular prisms (chain reaction, tap to detonate); the Rapier switch (cannon-es cost 20 to 27 ms a frame on the same scene); free-form shattering; cracking, then cracks that jitter in place instead of collapsing; "struck letters break apart"; camera controls; dust (impacts, letter-to-dust, cracks), then dust tone, softness and opacity (a black, hard-edged version was tested); extrusion height; and many rounds of Idan pasting tuned values that became defaults.

## Bugs found and fixed (worth remembering)
1. Pieces all drawn at the centre of the stage: the transform texture's data array was smaller than the texture, so WebGL refused the upload. Sized from the texture now, with a startup check.
2. An invisible rectangle boxing in debris on phones: the walls were placed before the world-to-pixel scale was known, so they used a stale default. The scale is computed first now.
3. All letters wiped out by one tap: the first chain was too eager and cracks cascaded; fixed with a higher impact threshold, a weaker chain, a separate piece-damage scale and a lower start piece count.

## Known limits
A resize rebuilds the world and resets the poster. The smallest sizes saturate the per-box and world piece caps and the size coarsens as rubble builds. Not measured on a real older phone.

## Update 6 Oct 2026
Fourth tuned set applied as defaults (size 0.03, blast 0.08, chain 23.5, crack 1.25, adapt 0, black dust). Shuffle now swaps black-on-white and white-on-black on every shuffle.

## Update 7 Oct 2026: performance and fractured letters (re-architecture)

**Why.** Measured: with the tuned defaults (`size` 0.03) a blast made about 3,600 independent rigid bodies and one physics step cost about 140 ms in the test browser. Physics, not drawing, was the cost.

**What changed.**
- A letter is still a standing column drawn from smooth boxes. On its first hit it is *fractured*: each smooth box is cut into fragments (at most 9 per box) drawn as meshes where the boxes were, so nothing visibly changes. The fragments have no physics.
- Damage is per fragment. Blows (a blast's shock, a flying chunk) add damage near the impact. A damaged fragment shrinks a little about its centre (a dark seam opens round it), and past `crackAt` it is shoved and tilted out of line, so a hit letter shows a web of cracks. Full damage breaks a fragment away, and the cracks run on to its neighbours. When most of a box has gone, the rest of it lets go and the box stops being solid.
- Fragments that break away together are grouped into **chunks**; only chunks are rigid bodies (one convex hull each). The more bodies already exist, the larger new chunks are. Detonating a whole letter releases at most 48 chunks.
- Physics wrapper: only awake bodies are visited per step (a settled pile costs nothing); shards no longer raise collision events (only letters, and the floor when impact dust is on).
- New setting `chunk` (what flies; small = more bodies); `size` is now fracture detail.

**Result.** About 2 ms per physics step with 230 bodies after Detonate all, against about 140 ms before.

**Trade-off.** Debris is chunks of seamed fragments, not thousands of independent crumbs, so it reads chunkier than the old tiny pieces. Lower `chunk` to taste.

**Smaller chunks (7 Oct 2026).** Chunk size now goes down to 0.02 and fracture detail to 0.03 (up to 30 fragments per smooth box); the tiniest chunks are boxes. The body budget scales: up to 260 chunks per release while the world is quiet, fewer as it fills (more than 300, 600, 900 bodies). Measured at chunk 0.03: about 700 bodies and 8 ms per step in the test browser (0.16: about 230 bodies, 2 ms).

Fifth tuned set applied as defaults (7 Oct 2026): chunk 0.02, blast 0.44, speed 0.43, chain 27, jitter 1.05, reach 2.25, passive off, black type on white by default (the shuffle still alternates).

Shuffle (7 Oct 2026): every shuffle swaps black-on-white and white-on-black; direct links start black on white.

## Reveal (10 Oct 2026)
Three quick taps invert the page and show the fracture cells of every letter (broken ones dashed, damage shaded), the reach of a blast around each letter and the chain between neighbours (`columns-reveal.js`).
