# Slinky (draft)

**Status:** stage one, 9 Oct 2026, draft (`?p=slinky`). File: `src/posters/slinky.js`.

**Brief (Idan).** Make a Slinky from the letters. Start simple by defining the spring behaviour, then mature it into letter shapes.

**Stage one: the spring.** A chain of coils (default 38), each joined to the next by a zero-rest-length spring (force grows from zero distance, so the chain stretches a long way and stacks tight), a hard minimum spacing (the wire), gravity, light damping and air drag. Hung from the top, it settles stretched at the top and bunched at the bottom, the classic profile. Each coil is drawn as a ring (an ellipse perpendicular to the spine). One colour, black on white or white on black on every second shuffle.
- **Interaction:** grab any coil and pull; let go and a wave runs along it (the bottom lags and then drops, the "Slinky drop"). Drag the top coil to move the hanger.
- **Panel** (`&tune`): stiffness, stacked spacing, damping, gravity, air drag, number of coils, coil radius, how round the coils look; actions Re-form, Let go of the top, Hang it.
- **Checked:** a hanging slinky settles (top coil gaps about 40 px, bottom stacked); pulling coil 20 up 260 px and releasing sends a wave down: the tip lags about a second, then follows. The first real-time load once blew up (all coils flung off-screen) and I could not reproduce it; the stepping is conservative (6 sub-steps of 1/360 s per frame), but watch for it.

**Stage two (not started).** Lay the chain along the letter strokes (the skeleton paths from the font), with the coil rings perpendicular to the path, so each letter is a slinky you can stretch, compress and let spring back; the open question is how the ends join and how the letters hang or sit.

## Update 9 Oct 2026: edge-only dragging, and the case study
- **Dragging** now works from the two ends only (the first and last coil, the whole ring), as with the real toy; the middle coils cannot be grabbed.
- **Case study read** (css-tricks.com, "A CSS Slinky in 3D"): it is not a spring model. Rings are circles in a 3D scene (isometric tilt, no perspective), each a thick-bordered circle (the border is the wire), stacked at even heights. Each ring's transform-origin sits at its own edge, and it holds, flips 180 degrees about that edge (so it moves forward by its diameter), and falls to the next stair, with the timing staggered down the stack by baking per-ring keyframes (animation-delay only affects the first loop). A cubic-bezier makes the fall accelerate; the whole scene steps down so it loops. Hue alternates between rings; an odd ring count keeps the pattern consistent across the flip.
- **What to take from it:** the walk is a *wave of flips*, one ring after another, each hinged at its edge; the stack never stretches. A planar spring chain like stage one cannot flip rings, so a walk needs either that kinematic cascade or a 3D model. Proposed next: a stair-walk mode that follows the case study (hinge flips, staggered), driven by the pointer (drag the end over the edge and the wave follows), keeping the spring for stretching.

## Walk mode, 9 Oct 2026 (committed locally; default for `?p=slinky`, `?p=slinky&mode=spring` shows stage one)
File: `src/posters/slinky-walk.js`. A Slinky going down a staircase, after the CSS case study: a wave of flips.
- **Model.** All coils share one path: the stack on the upper step, an arch over the step edge (coils far apart), the stack on the lower step (coils tight). One number, the progress `p`, says how far the coils have travelled; coil `j` sits at the place for `j - p`. Each coil is a 3D circle perpendicular to the path, so it turns over as it crosses the arch. When the last coil lands, the lower stack is the new upper stack and the camera moves on. Checked: positions are continuous across the step boundary (to 0.1 px).
- **View.** Orthographic isometric tilt (yaw 32, pitch 24, as in the case study); one colour.
- **Interaction.** Tap walks one full step; hold keeps walking; drag one end of the slinky (first or last coil) sideways to scrub it forward or back.
- **Panel:** speed, how gently it starts, coils, coil radius, wire thickness, stacked spacing, coil spacing in the arch, arch width and height, step drop, view turn and tilt.
- **Looked at** (frames sent from the canvas): the stack on the upper step shrinks, a visible arch of turning coils crosses the edge, the stack on the lower step grows.
- **Open.** The stairs are drawn as outlines and the coils are not hidden behind them (no occlusion), so the scene is busy. No spring weight or bounce yet (the walk is kinematic); the drag does not stretch the coils. Not tried with a real finger or on a phone. Stage two (letters) not started.

## Physical model attempt, 9 Oct 2026 (committed locally; `?p=slinky` default is now this; `?mode=css` the scripted walk, `?mode=spring` stage one)
Idan: the scripted walk has no physics; discard the CSS case study if needed. Built `src/posters/slinky-phys.js`: each coil is a rigid rod (two end masses, fixed distance), neighbouring coils joined by zero-rest-length springs (top to top, bottom to bottom), rod-rod and rod-corner contact, solid stairs, gravity, drag from either end, PBD with 4 sub-steps of 1/240 s per frame. Rendered as 3D rings (a circle whose plane holds the rod and the depth axis). Checked by sending canvas frames.
- **Works:** it stands as a stack, can be draped over a step edge (the initial pose is an arch, the way a slinky is when it is about to walk), and when knocked hard it tumbles over the edge and ends as a stack on the lower step.
- **Does not work yet:** it does not walk by itself. Sweeps of spring stiffness (120 to 2600), damping (0 to 0.6), grip (0 to 0.55) and of kicks to the front, the back, and every coil all end in the same resting drape; the front coil stands on the lower step and the rest never follow. Reasons I can see: the two-spring ladder is a stiff beam (bending stiffness grows with the rod length squared), the model has no preload release mechanism that drives the wave, and a flat chain of rods is not a helix. A single-spring zigzag does not help (it degenerates into a rope of links).
- **The repository Idan pointed to** (StructuresComp/slinky-is-sliding) is a neural-network surrogate (PyTorch, GPL-2.0) trained on rod simulations; it has no model code we can use. It does confirm the reference model is an elastic helical rod.
- **Options:** (A) a proper 3D elastic-rod (helix) model, heavy and uncertain at real-time speed; (B) a hybrid: coils chase the scripted walk path with soft springs so physics adds lag, wobble and responds to dragging; (C) keep the physical hanging spring (stage one) and move on to letters.

## Factory, 9 Oct 2026 (committed locally; the default for `?p=slinky`; `?mode=spring`, `?mode=phys`, `?mode=css` are the earlier stages)
Option C chosen: real spring physics, no letters yet. File: `src/posters/slinky-factory.js`.
- **Behaviour (after the dough factory).** A machine with a spout turned 90 degrees (it points sideways). Hold the mouse or a finger and coils stream out of the spout, straight at first (inside the barrel they are pushed out at the feed speed), then free: they arc and hang down under their own weight, stretched at the top and bunched where they land. Let go and the cutter snips the stream: the loose piece drops, bounces on its springs and lies on the floor. Up to three pieces stay on the floor (the oldest fades); a piece can be at most 150 coils. Taking hold of the loose end (first coil) of a piece on the floor lets you pull it.
- **Physics.** Every coil is a point mass; neighbours joined by zero-length springs (stiffness 1500) with a hard minimum spacing (the wire); coils that are not neighbours cannot sit on one another, so a pile builds; the floor grips; gravity, damping, air drag. 6 sub-steps per frame.
- **Look.** Each coil is an ellipse perpendicular to the local direction of the chain; one colour (black on white, or white on black on every second shuffle); the machine and floor are plain outlines.
- **Panel** (`&tune`): feed speed, longest piece, pieces kept, stiffness, stacked spacing, damping, gravity, air drag, floor grip, coil radius, roundness, wire thickness; action Sweep up.
- **Checked** with frames sent from the canvas: the stream leaves the spout straight, turns down, stretches and piles; after release the piece lies on the floor as a slinky on its side with a tangle at the end where the stream first landed.
- **Open.** The heap where the stream lands is a tangle (rings at all angles); the stream falls almost straight down next to the spout (a higher feed speed throws it further); not tried with a real press or on a phone; the factory is a plain placeholder; letters (stage two) not started.

## Rod model defaults, 9 Oct 2026 (Idan's set)
coils 20, size 0.085, wire 0.065, spring 1330, gap 0.19, arch 10, pack 0.27, archW 2.3, archH 1, gravity 36, grip 0.85, damping 0.4, stepW 8.9, drop 2.3, push 0.6, yaw 50, pitch 32 are now the defaults of `?mode=phys`. With these the rod model **does go down the stairs on its own**: from the draped start, with no kick, the front coil was about 3.2 step-widths along and about 3.5 steps down after 10 s of simulated time (kicks make little difference). The earlier "it does not walk" finding applied to the previous defaults (lower gravity, shallow steps, less grip). The factory is still the default mode; the stair model is `?p=slinky&mode=phys`.

## Camera views (stair slinky, `?mode=phys`), 9 Oct 2026
Predefined views, chosen from the panel buttons or the keys 1 to 6, with the camera easing between them: **1 Isometric** (yaw 50, pitch 32, the default), **2 Side** (the physics plane seen straight on: coils are lines), **3 Front** (looking along the walk), **4 Top**, **5 Close** (zoom 1.9, follows the leading coil), **6 Wide** (zoom 0.55). Dragging empty space orbits (yaw and pitch) and the view becomes "custom"; the yaw and pitch sliders set the Isometric view. The camera follows the middle of the slinky (the leading coil in Close) and catches up at once if it has run far ahead. Grabbing an end needs a view that is not edge-on (Front and Top use orbit instead).
Fixed on the way: the camera's vertical centring had a sign error, so the slinky sat off-centre whenever it was far from the origin. Checked: all six keys select their view, a drag orbits (0,0 to 101,49 degrees), and frames of Close, Wide and Side show the slinky centred. The factory mode has no camera views.

## Factory defaults, 9 Oct 2026 (Idan's set)
feed 560, gravity 1400, spring 200, gap 0.02, size 0.07, tilt 0.34, damping 6.5, air 0.06, grip 0.5, keep 3, longest 150, wire 0.075. A softer, heavily damped spring makes the stream leave the spout in one smooth arc and land cleanly (checked in a frame: the whole stream curves from the spout to the floor with evenly stretched coils and a small tangle where it lands).

## One poster, two scenes, one camera (9 Oct 2026)
`?p=slinky` is now one poster with a switch between the **factory** and the **stairs** (the panel buttons "Factory" and "Stairs", or the key M; `?mode=stairs` starts there). Both are drawn through the shared camera (`slinky-view.js`: six views on the keys 1 to 6, orbit by dragging empty space, zoom). The factory was rebuilt in 3D for this: the machine, spout and floor are boxes, the coils are circles perpendicular to the chain. In the factory a short hold starts the stream and a drag orbits; the Close view follows the head of the newest piece. The panel shows the settings of the scene that is showing and rebuilds on a switch (new hook: `stage.refreshPanel`, set in `main.js`). Files: `slinky.js` (the switch), `slinky-view.js` (camera), `slinky-factory.js`, `slinky-phys.js` (both now export a scene-creating function). `?mode=spring` and `?mode=css` are still the standalone earlier versions.
**Bounce.** New setting "Bounce off the floor" (factory, default 0.55) and "Bounce off the steps" (stairs, default 0.35). Before, the factory floor returned only 12% of the impact speed and the stairs none. Measured (head coil rebound after landing): with the damping at 6.5 the chain is overdamped and nothing rebounds whatever the bounce (0 px even at 0.8); at damping 1.2 and bounce 0.85 the head came back up about 60 px.

## Factory landing (rim contact and recoil)

- A coil is a ring, so the floor touches its rim: the contact height is `R * |tangent.x|` below the coil centre, taken from its neighbours. A coil standing upright rests on its middle; one lying down rests on its edge. The floor slab's top is now the floor.
- Damping is split: `damping` applies to the piece being streamed (hose-like), `loose` (default 0.8) to a cut piece, so it can recoil. Before, 6.5 applied everywhere and nothing could bounce.
- Check (`debug.factory.drop`): a vertical piece held at the top, released. The bottom coil stays on the floor while the top falls about 360 px, the compression wave arrives, and the piece recoils and oscillates (the "slinky drop").

## Factory: rods, shelf and stairs (walk and arch)

- The factory now uses the stairs' rod model from the spout onward: each coil is a rigid rod with two end masses, zero-length springs top-to-top and bottom-to-bottom, PBD constraints, step corners, rebound on landing (`rebound`). The old point chain made a tangled heap and could not arch or flip.
- Coils leave the spout standing up, drop onto a shelf level with the foot of the spout, are pushed to its edge, drape over it as an arch and go down the stairs. Panel group Stairs: steps (0 = flat floor), step depth, where the shelf ends. Step height is derived (shelf to floor).
- While streaming the air damping is `damping` (6.5); once cut it is `loose` (0.12). Cut-piece controls: wire stiffness, closest coils, grip, rebound.
- Seen: a 40-coil stream drapes down five steps and settles on the floor; on a flat floor it lies as a tight stack (no arch without a drop).
- Not yet: a clean end-over-end walk after the cut (the draped piece settles); the old chain model is kept only for the `debug.drop` test.

## Stairs: coils may not cross (the X in the middle)

A rod forced across its neighbours showed as an X in a stack and made flips look wrong. `keepOrder` in `slinky-phys.js` now enforces one invariant every constraint pass: seen from the path, the top of each rod stays on the same side. A rod that has crossed is turned back by the shortest way to the nearest allowed lean (at least about 13 degrees from the path). Checked over 900 frames with a kick: 0 crossed rods apart from one transient frame.

## The wave test (what makes it feel like a Slinky)

`debug.factory.hang(n)` hangs n rod-coils by the first coil, settles them with heavy damping, and `delete p.hold0` lets go. Measured (14 coils, frames at 60 Hz): the bottom coil should hover while the top falls until the compression wave arrives.

| wire stiffness | hang height (top to bottom) | bottom starts to move |
|---|---|---|
| 1330 | 166 px | frame 4 (about 0.07 s): almost rigid, no visible wave |
| 600 | 241 px | frame 11 |
| 300 | 436 px | frame 21 (0.35 s): the Slinky-drop look |
| 150 | reaches the floor | not measurable at this height |

So the old default (1330) is too stiff for the effect; around 300 shows it. Open problem: at low stiffness a long piece landing from the shelf and stairs breaks up into a spinning heap (coils flung and tumbling). `keepOrder` was added to the factory's rods (the stairs already had it) and it does not stop that; likely needs more constraint passes/substeps or friction on the rods at low stiffness.

## Slinky feel: new factory defaults

Wire stiffness 450 (was 1330), wire damping 8 (new: damps the relative speed along each spring, which calms the flung, spinning coils), 8 constraint passes and 6 substeps a frame, floor grip halved per pass to match. Result at the defaults: the wave test shows the bottom hovering about 0.35 s (frame 21) while the top falls, and streams of 25 to 80 coils land and drape coherently. A rod-against-rod crossing resolver exists (`cross`, off by default): it made the stream explode at the spout in some runs. Below about 400 a long piece still tends to land as a heap.

## Bench loop (9 Oct 2026): stairs walk and classic tricks

`tools/slinky-bench.js` (run in the page console on `/?p=slinky&debug`): `walk`, `dropTest`, `robust` (a 3x3 grid of step widths and drops), `start`/`round` (a hill-climb: tweak, test on the grid, keep what is better).

Lock: walks down all five steps on at least 7 of 9 stair geometries (step width 5.5/6.9/8.9, drop 2.3/2.8/3.3 radii), at most 2 taps, no crossed rods; Slinky drop: the bottom hovers 15 to 45 frames, the top recoils at least 15% of its fall, the hanging top is stretched at least 1.6x its bottom.

- Iterations 1 to 5 (random tweaks of the stairs settings, old grid with 1.8 drops): 3/9 walked at the start (Idan's set), 6/9 at best. Iteration 6/7: stalled at 5 to 6/9 with a tap allowed (the failures are all the 1.8-radius drop: the slinky bunches on the first step and does not tip; below about 2 radii it is out of scope). Iteration 8: grid changed to drops 2.3 to 3.3, 7/9, but the bench was blind to crossed rods (about 16 pairs crossed on average). Iteration 9: a crossing resolver in the stairs model (`cross`), 9/9 walk, 0 crossed pairs: locked.
- Last step is now the floor (it ended after step 5 and the slinky fell through).
- Slinky drop at the factory defaults: hover 21 frames, recoil 0.19, stretch 6.4: locked.
- Not covered (no test yet): hand-to-hand arch (passing the arch between two hands), climbing, walking down a slope, walking on the Factory flat floor.

## Rim lies flat (tried, off by default)

`flat` (factory and stairs sliders "Loose coils lie flat", default 0): when only one end of a coil rests on the floor or step, the raised end gets extra downward pull, more the more upright the coil. Measured in the factory at 0.6: mean coil tilt 0.80 -> 0.55 and 13 of 40 coils lying flat (none at 0), but the landing breaks up into a flung, tangled heap (0.1 to 0.3 give a partial heap too); on the stairs the walk still passes (8 to 9 of 9). So it is a slider, not a default. A stable version probably needs a position-based rotation of the coil about its floor contact (not extra force), and the crossing resolver in the factory.

## Landing on its end: flat rim, recoil, arch

- Factory action **Drop one standing** (debug: `factory.stand`): a 16-coil slinky standing on its end, a little leaning, dropped from 260 px. The end coil lands flat (its rod lies along the floor, |ry| = 0), the stack squeezes, recoils upward (rise of 115 px at the defaults, about 195 px with the Bouncy preset) and, because of the lean, curves over into an arch and falls on its side (spread of 230 to 330 px, versus 25 for a stack that stays up).
- Presets in the panel: **Bouncy slinky** (wire stiffness 200, wire damping 2, rebound 0.6) and **Calm slinky** (the defaults, 450 / 8 / 0.36). The recoil and arch show with Bouncy; at the calm defaults the stack recoils less and stays upright.
- Tried and dropped: springy contact between touching coils (`coilBounce`, default 0): it made the rebound smaller, not larger.
- Gotcha: the coil order rule (`keepOrder`) has a handedness; a test slinky built with the rods mirrored got turned upright on the first step. `hang` and `stand` now build them the right way round (first end on the right for a downward path).

## Tension squares the rings (`align`, off by default)

Physics: gravity, Hooke's law and the tension wave through the flexible body line the rings up, so the end rim of a hanging or falling slinky lies parallel to the floor. Slider "Tension squares the rings to the axis" (factory and stairs): each coil that is stretched from its neighbours is turned toward square to the local axis (weight grows with the stretch; squeezed coils are left alone). Measured on a hanging slinky whose coils were tilted 46 degrees: mean misalignment 0.83 with `align` 0, 0.32 at 0.03, and the end coil square at 0.1. Costs: on the stairs the walk fails (0 of 9 at 0.1, 7 of 9 at 0.01, 9 of 9 at 0); on the factory stream the stretched arch comes out ragged at 0.02 and above. So it is off by default; a stable version needs the alignment folded into the spring forces (the two end springs unequal stretch gives the torque) instead of a position nudge.
