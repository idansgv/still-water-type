# Slinky (draft)

`?p=slinky` (the panel: `&tune`). Draft, not in the shuffle. One colour (black on white, white on black on every second shuffle). The full chronological log of how it got here is in [slinky-log.md](slinky-log.md); this page is the current state.

**Brief (Idan).** A Slinky from letters. Stage one: get the spring right. Stage two (not started): lay the chain along the letter strokes (the font's skeleton paths), rings perpendicular to the path, so a letter can be stretched, squeezed and sprung.

## What it is now

One poster, three scenes, one camera. Switch with the panel or **M** (factory, stairs, plane); **L** locks the camera (it stops following the slinky; views and orbit still work); six views (keys **1** to **6**: isometric, side, front, top, close, wide), drag empty space to orbit.

- **Factory** (`slinky-factory.js`): a spout turned sideways. Hold the mouse (or a finger) and coils stream out, falling in an arc; let go and the piece lands on a shelf under the spout, is carried to its edge and goes down five steps to the floor. Take the loose first coil of a piece on the floor and drag it.
- **Stairs** (`slinky-phys.js`): one slinky draped over the edge of a step. Tap an end ring (or **Nudge it**) and it walks down. Drag an end ring to pull it.
- Earlier stages kept: `?mode=spring` (a hanging spring), `?mode=css` (a scripted walk, `slinky-walk.js`).

Files: `slinky.js` (mounts the scenes, the switch, the panel), `slinky-view.js` (camera), `slinky-rings.js` (the solver), the two scenes above, `tools/slinky-bench.js` (tests and searches, run in the page console on `/?p=slinky&debug`).

## The physics (`slinky-rings.js`)

Seen from the side every coil is a **rigid ring**: a rod with a centre, an angle and a spin (mass 1, inertia `inertia` x R^2). Everything is a force, integrated at 960 Hz (16 substeps a frame), y up. Nothing snaps and nothing is corrected after the fact.

- **Wire:** zero-length springs top to top and bottom to bottom (`spring`; pre-tensioned, so it stretches a long way and stacks tight), damped (`wireDamp`); optional diagonals (`shear`).
- **Lean limit:** a ring may lean `lean` degrees off square to the path through its neighbours; past that a torque (`leanK`) turns it back, with the equal couple on the neighbours. This is what fans the rings across an arch.
- **Rings push each other off:** segment to segment, springs (`contact`, `contactDamp`), neighbours and the next four.
- **The world:** steps and floor are boxes; penalty contact at the ring ends and at the step corners, friction (`grip`), bounce from a damping ratio (`bounce`); the page edges are walls in the factory.
- **End rings:** `endFlat` pulls the first and last ring toward lying flat (firm on a surface); `capInertia` makes them heavier. The two caps carry a marker (a stick with a dot, along the ring's own normal, pointing away from the body; the side is fixed when the chain is made, so it turns with the ring).
- Units: pixels, seconds; gravity and stiffness are accelerations; sizes in radii (`size` is the radius as a share of the shorter side).

Why this solver: the earlier one (point chain, then rods with position corrections and an order rule) snapped rings to 13 degrees off the path, which produced the pin-cushion of rods in every messy frame; and its start pose broke its own rule. Details in the log.

## Settings (shared by both scenes since 10 Oct)

`slinky-params.js`: one object of shared settings, bound into both scenes (`bindParams`); a slider moved in one scene is moved in the other, Reset resets both, changing `size` or `gap` re-forms the other scene when you switch to it. Each scene keeps its own few:

- **Shared** (Idan's hand-tuned set): size 0.11, wire 0.03, spring 1392, gap 0.035, gravity 22.5, grip 0.42, damping 0.21, bounce 0.6, wireDamp 7, contact 21 (damping 0.02), inertia 0.45, lean 58, leanK 0.25, spin 1.7, shear 0, square 0.2, bend 1, endFlat 1.85, capInertia 3, and the hand: turn 4, turnReach 10, turnDelay 2.
- **Stairs only:** coils 40, arch 6, pack 0.1, archW 2.8, archH 1.8, stepW 6.9, drop 2.3, push 2.4.
- **Factory only:** feed 560, pitch 0.18, keep 3, longest 90, steps 5, run 0.17, start 0.32.

Earlier separate sets, for reference: the factory's soft set (spring 100, gravity 15, wireDamp 22.5, contact 9, size 0.09, gap 0.21, inertia 1.1, lean 37.8, leanK 1.09, spin 0.42, square 1, endFlat 1.55, capInertia 8) and the searched stairs set (spring 2131, gap 0.12, arch 14.7, archW 1.2, archH 1.1, lean 42, leanK 0.66, wireDamp 5.35, contact 14.7, spin 2.07, inertia 0.49, endFlat 0.6), which walked 4.9 steps in 11 s without a tap (8 of 9 stair shapes); the hand-tuned set stalls at 3 steps in the bench's autopilot, so it is for driving by hand.

**The ring in hand** (`turn`, default 4, slider 0 to 14 in steps of 0.1 (it is a gain, not degrees; stable up to 360 when tested): a full hand circle turns the head ring 333 degrees at 4 and 361 at 360, two circles 693 and 715, so there is no 180 degree limit and above about 20 it only follows the hand more tightly): the ring you hold is driven to turn with the move: its facing follows the direction the hand is going, at the rate that direction turns (a half circle in time T turns it by pi at omega = pi / T). The rings behind it follow as a wave (`turnReach` rings, each `turnDelay` frames later and 18% weaker), so a hand that circles turns the end over and the turn runs down the slinky. A scripted semicircle over a standing slinky: with the head ring only, 1.1 rad at the head and 0.2 at ring 13; with the wave at turn 1, 1.9 to 1.1 rad over the first 14 rings; at turn 3, 2.7 to 1.7 rad (up to 155 degrees). The four scripted flip gestures all flip at turn 4. **X** reforms (factory: Sweep up, stairs: Re-form). `square` turns each ring square to the path through its neighbours (the hard `lean` limit alone left the streaming head ring vertical); 0 in the shared set, 1 gave the head ring a lean down the arch.

## Behaviours checked (bench, 10 Oct 2026)

- **Walk down the stairs:** `walk`, `gridScore` (3x3 stair shapes), `search3` / `search4` (random search; `search4` needs a candidate to walk on the default stairs, on small changes of arch / lean / gravity / stiffness, and on two other stairs). A lucky point that fell over when its numbers were rounded is why the search became robust: always verify rounded values.
- **Slinky drop** (`dropTest`): hung by the top coil and let go, the bottom hovers while the top falls when the wire is soft: stiffness 150 gives 26 frames of hover, stretch 3x; 60 gives 31 frames and 7x; 1200 and up is rigid (5 frames).
- **Standing drop** (`standTest`): the end ring lands flat within 40 frames, the stack recoils 80 to 150 px and falls over into an arch.
- **Momentum flip** (`flipTest`, `search5`): an upright slinky, its top ring taken by the rim and carried over in an arch (scripted, three variants). Needed: low spin damping, higher ring inertia (a stiff damped column only leans and topples). The head ring turns over fully, the coils fan from flat at the base to over-turned at the head.
- **Sketches (Idan):** (1) an arch of rings fanned across the path, the front ring flat on the step, the rear lifting over and landing: matches in frames on the stairs. (2) the standing slinky dragged over, the top cap ending facing down: matches in frames in the factory.

## Known limits, open items

- Not tried with a real pointer: streaming by hold, grabbing a loose coil, tapping the stairs slinky (all only through debug calls).
- The two scenes use different tunings (walk vs flip); one set for both is untried. Steps wider than about 12 radii do not walk.
- Searches overfit: keep them robust (several stairs, small perturbations), check frames, not only scores.
- The factory's chain cap marker for the live (streaming) piece is a fixed forward / backward facing.
- Stage two (letters) not started.
- Pushing: `main` auto-deploys; the repo is `idansgv/still-water-type` (`gh auth switch -u idansgv`).

## Why the stream did not bend down (10 Oct 2026)

Two things: the rings were not following the path (`square` 0), and the soft pull toward square, when it was on, also put a couple on the neighbours, which straightens a chain, so turning it up made the stream stiffer (droop 108 px at 55 frames with square 0, 18 px with square 1). Now the soft pull only turns the ring (a hinge); only the hard `lean` limit still puts the couple on the neighbours. Measured at 70 frames: droop 132 px (square 0), 190 (0.2), 163 (1), 193 (2); the head ring leans with the path. Trade-off with the hand flip: the flip test scores 0.97 / 0.85 / 0.71 / 0.53 at square 0 / 0.2 / 1 / 2 (the square pull fights the hand's turning), so the shared default is 0.2. New shared `bend` (default 1): scales the part of the wire's pull that bends the slinky (the difference between the top and bottom wire), 0 makes it droop like a rope while it stays stiff along its length; it barely changed the stream (108 to 123 px), the bending stiffness was in `square`, not the wire.

## Plane, lock, standing start, letter rings (10 Oct 2026)

- **Plane** (`?mode=plane`, **M**): the stairs scene on a flat floor, the slinky standing in the middle, for dragging its ends over and flipping it by hand (same shared settings, its own start). `createPhys(stage, V, shared, { id, flat })` serves both.
- **Lock the camera** (**L**, panel): `V.lock` freezes the follow in all scenes.
- **Standing start** (stairs: own settings `stand` 1, `lean0` 0.1): the slinky starts standing on its end on the top step, its base just behind the edge, leaning a little toward it, instead of draped over the edge (`stand` 0). The bench autopilot (two taps) gets 2.4 steps from it with the shared hand-tuned set, then it lies down on a step; a search (`search6`, near the current settings) found a set that reaches 4.4 steps on 4 of 5 stairs, but it fell apart when rounded (inertia 0.3, endFlat 2.3, lean 66, grip 0.41, spin 1.3, wireDamp 4.8, contact 20.5, gravity 23.8, spring 1470, bounce 0.53, push 1.75, lean0 0.11), so it is not adopted. Walking from standing is for driving by hand for now.
- **Letter rings** (shared setting `letter`, panel Look/View: type a letter, empty = round): each ring is drawn as the outline of the letter (`slinky-shape.js`, from `glyph-contours.js`), the cap height along the ring's rod and the width in depth; the physics still treats a ring as a rod. Seen from the front a lying slinky is a row of letters; it reads best with few coils (set Coils lower).

## Slinky type (`?p=slinky-type`, draft, 9 Oct 2026)

IDAN SEGEV laid across the plane like the other posters (IDAN / SEGEV, three rows on a phone), each letter a slinky of letter-shaped rings (`ringShape(ch, { top: true })`: glyph x along the rod, glyph y in depth) standing on its end, read from the top view. One 2D chain per letter from `slinky-rings.js`, shared settings from `slinky-params.js` (own: `coils` 14, `lean0`). Tap a letter: its head ring is lifted and carried over (about 1.1 s) and it topples flat, flipped, about two radii off its place; drag the head ring to do it by hand; drag empty space to orbit; keys 1 to 6 views, **X** stands them up, **L** locks the camera. Kicks by impulse only slid the stiff column, so taps use the carried hand. Not tried: real pointer on a phone, the other views with many letters, lying letters colliding with their neighbours (chains are independent, they overlap).

Slinky type, all axes: each letter's chain lives in a vertical plane turned `th` about the vertical axis. A standing letter takes a random direction on a tap, or the direction it is dragged (the drag point is read on the horizontal plane under the pointer, so it needs a view that is not edge-on); a lying one keeps its plane. Chains are still 2D inside their plane, so a letter falls over along a line, it does not twist.
