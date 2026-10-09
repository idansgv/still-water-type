# Slinky (draft)

`?p=slinky` (the panel: `&tune`). Draft, not in the shuffle. One colour (black on white, white on black on every second shuffle). The full chronological log of how it got here is in [slinky-log.md](slinky-log.md); this page is the current state.

**Brief (Idan).** A Slinky from letters. Stage one: get the spring right. Stage two (not started): lay the chain along the letter strokes (the font's skeleton paths), rings perpendicular to the path, so a letter can be stretched, squeezed and sprung.

## What it is now

One poster, two scenes, one camera. Switch with the panel or **M**; six views (keys **1** to **6**: isometric, side, front, top, close, wide), drag empty space to orbit.

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

## Settings that matter (current defaults)

| | Stairs | Factory (Idan's soft set, 10 Oct) |
|---|---|---|
| look | 40 coils, radius 0.11, wire 0.03, gap 0.035 | radius 0.09, wire 0.035, gap 0.21, pitch 0.18 |
| wire | spring 1392, wireDamp 7 | spring 100 (slider goes down to 5), wireDamp 22.5 |
| rings | lean 58, leanK 0.25, square 0, inertia 0.45, spin 1.7 | lean 37.8, leanK 1.09, square 1, inertia 1.1, spin 0.42 |
| world | gravity 22.5, grip 0.42, bounce 0.6, contact 21 | gravity 15, grip 0.5, bounce 0.2, contact 9 (damping 0.34) |
| caps | endFlat 1.85, capInertia 3 | endFlat 1.55, capInertia 8 |
| start | arch 6 coils, archW 2.8, archH 1.8, push 2.4 | feed 560 px/s, longest 90, shelf ends at 0.32 W, steps 0.17 W deep |

`turn` (new, both scenes, default 1): the ring in hand is driven to turn with the move: its facing follows the direction the hand is going, at the rate that direction turns (a hand carrying an end over a half-circle arc in time T turns it by pi at omega = pi / T). Without it a radial move only dragged the cap; with it the head ring flips 180 degrees in all four scripted gestures (2 of 4 without). **X** is the reform shortcut (factory: Sweep up, stairs: Re-form).

`square` (new): a soft pull turning each ring square to the path through its neighbours (the hard `lean` limit only acts past 38 degrees, so without it the rings of a gentle bend stayed vertical and the streaming head ring did not lean down the arch). At 1 the head ring leans down with the arch and the flip test passes on 2 of 3 gestures with the soft set (0.53 without).

The stairs set is now Idan's hand-tuned one (10 Oct, evening); the bench's autopilot (two taps) gets 3.1 steps with it and then stalls, so it is for driving by hand. The earlier searched set walked 4.9 steps in 11 s without a tap (8 of 9 stair shapes): spring 2131, gap 0.12, arch 14.7, archW 1.2, archH 1.1, lean 42, leanK 0.66, wireDamp 5.35, contact 14.7, spin 2.07, inertia 0.49, endFlat 0.6. The factory set is tuned to **flip**: momentum carries the coils over (below). Both scenes have all settings in the panel (groups Stream, Rings, World, Stairs, Look). Presets in the factory: **Bouncy slinky**, **Calm slinky**; actions **Drop one standing**, **Stand one up (drag its top over)**, **Hang it (the Slinky drop)**, **Let go**, **Sweep up**.

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
