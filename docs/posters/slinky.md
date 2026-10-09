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

## Settings (shared by both scenes since 10 Oct)

`slinky-params.js`: one object of shared settings, bound into both scenes (`bindParams`); a slider moved in one scene is moved in the other, Reset resets both, changing `size` or `gap` re-forms the other scene when you switch to it. Each scene keeps its own few:

- **Shared** (Idan's hand-tuned set): size 0.11, wire 0.03, spring 1392, gap 0.035, gravity 22.5, grip 0.42, damping 0.21, bounce 0.6, wireDamp 7, contact 21 (damping 0.02), inertia 0.45, lean 58, leanK 0.25, spin 1.7, shear 0, square 0, endFlat 1.85, capInertia 3, and the hand: turn 4, turnReach 10, turnDelay 2.
- **Stairs only:** coils 40, arch 6, pack 0.1, archW 2.8, archH 1.8, stepW 6.9, drop 2.3, push 2.4.
- **Factory only:** feed 560, pitch 0.18, keep 3, longest 90, steps 5, run 0.17, start 0.32.

Earlier separate sets, for reference: the factory's soft set (spring 100, gravity 15, wireDamp 22.5, contact 9, size 0.09, gap 0.21, inertia 1.1, lean 37.8, leanK 1.09, spin 0.42, square 1, endFlat 1.55, capInertia 8) and the searched stairs set (spring 2131, gap 0.12, arch 14.7, archW 1.2, archH 1.1, lean 42, leanK 0.66, wireDamp 5.35, contact 14.7, spin 2.07, inertia 0.49, endFlat 0.6), which walked 4.9 steps in 11 s without a tap (8 of 9 stair shapes); the hand-tuned set stalls at 3 steps in the bench's autopilot, so it is for driving by hand.

**The ring in hand** (`turn`, default 4): the ring you hold is driven to turn with the move: its facing follows the direction the hand is going, at the rate that direction turns (a half circle in time T turns it by pi at omega = pi / T). The rings behind it follow as a wave (`turnReach` rings, each `turnDelay` frames later and 18% weaker), so a hand that circles turns the end over and the turn runs down the slinky. A scripted semicircle over a standing slinky: with the head ring only, 1.1 rad at the head and 0.2 at ring 13; with the wave at turn 1, 1.9 to 1.1 rad over the first 14 rings; at turn 3, 2.7 to 1.7 rad (up to 155 degrees). The four scripted flip gestures all flip at turn 4. **X** reforms (factory: Sweep up, stairs: Re-form). `square` turns each ring square to the path through its neighbours (the hard `lean` limit alone left the streaming head ring vertical); 0 in the shared set, 1 gave the head ring a lean down the arch.

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
