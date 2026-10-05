# Skyline

**Status:** draft (reachable with `?p=skyline`; not in the shuffle). File: `src/posters/skyline.js`, with `physics.js`. Settings: `?p=skyline&tune`. It replaced Drape.

## Concept
Flat white "Idan / Segev" on black, projected onto a field of **hard-edged** blocks of different heights. Head-on it is flat; move the view and the lettering is sliced at every block edge and jumps from one height to the next.

## The trick
The camera starts exactly where the projector is, so the print lands perfectly flat however the blocks stand (the same idea as Sheet). Moving the cursor, dragging a finger or tilting the phone moves the camera; the print stays where the projector put it, so block edges cut it and block sides appear. Shading is absent at rest and appears with camera movement and with disturbance.

## What is underneath
About 70 Rapier rigid blocks standing on a floor and tiling the sheet (a grid with a hair of gap). Heights come from smooth noise quantised into whole steps (0.12 to 1.5 units; the camera is 5 away), so they read as a stepped skyline. One instanced draw (plus a floor slab). The type is a mask that every surface, the floor included, looks up per pixel through the projector. About 0.1 to 0.7 ms per frame on desktop; every block goes to sleep once it settles.

## Interactions
- Touch: blocks within 1.5 units are thrown up and aside, harder the nearer, and tumble, land on each other and leave gaps through to the floor. The print keeps landing on whatever is in front of it.
- Dragging pushes the blocks it passes.
- Moving the pointer, dragging or tilting is the camera.

## Settings
Camera yaw (0.5) and pitch (0.34), block size (re-forms), poke strength, gravity. Re-form in the panel.

## Open
What blocks do after they are thrown (they stay where they land; no double-tap reset yet); tilted facets instead of flat tops; a hint; a light theme; a real-phone check.

## History
The projection idea began as Drape (a cloth over hidden balls), which Idan found too soft; the geometry has to be hard-edged so the print is visibly cut and displaced at every edge. Skyline was the replacement, first on cannon-es then Rapier.
