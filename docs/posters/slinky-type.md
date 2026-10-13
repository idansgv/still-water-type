# Slinky type

**Status:** published 2026-10-13. Test at `/?p=slinky-type`.

**Brief (Idan, 12 Oct 2026).** The delight comes from a magical, surprising interaction. Tilted view with solid caps for the letters; each letter a condensed slinky, released on user interaction. Letters should fall toward the camera, not sideways, and motion should cover x and y as well as z.

## What it is (13 Oct 2026, after Idan's sketch)
An upright backdrop with IDAN SEGEV on it and a ledge in front (the sketch: a wall, a stair, arrows down). Each letter is a condensed slinky stood out of the wall, rings upright, the head ring (the solid cap) facing you: from the front it reads as flat type. Idan's Slinky settings and camera (yaw 50, pitch 20, isometric) apply (`POSTER_DEFAULTS`, `slinky-params.js`, plus the 14 Oct set for this poster: spring 958, gravity 23, bounce 0.81, inertia 0.3, ledge 5 radii, bump 4.1, push 9.5). Pulling the cap further than about 1.5 radii on the first bump flips the coil off the ledge, so the first pull stays short.

## Interactions
- **Click a letter:** a bump: the cap is taken and pulled ahead for a third of a second (`pull`, 1.3 radii) while the coil is shoved forward (`bump`, head hardest, small hop), so the spring opens as it leaves the wall; it lands on the ledge and settles.
- **Click it again:** a harder bump (`push`, and the cap pulled further, `pull2` 2.8 radii): it goes over the edge and falls off the screen; once it is out of sight it is back on the wall.
- **Drag a letter's cap:** grab it and pull; the rest of the coil follows, and it falls from wherever you let go.
- **Drag empty space:** orbits the camera. **Wheel / pinch** zooms; **Shift-drag or right-drag** pans. Keys 1 to 6 are views, 0 the default camera, + and - zoom, X puts every letter back, L locks the camera.
- **Settings panel (`?tune`):** a Camera group (turn, tilt, zoom, shift) with Face on / From above / Default buttons; Copy settings includes the camera.
- **Back on the wall:** a letter that returns fades in as an outline first, then fills (1.6 s).
- **Three quick taps:** reveal (spine, ring tilts, head rings).
- Tap time and travel are the shared ones (`src/gestures.js`). Letters start asleep and sleep again when still, so nothing moves at rest.

## Limits
- Each letter moves in its own vertical plane running out from the wall: it can fall toward you, not sideways. Full 3D would need a new solver.
- The ledge is a floor with a wall behind it for the rings; the scene is framed to fit whatever the view.
- Not tried on a phone. No hint is shown.
