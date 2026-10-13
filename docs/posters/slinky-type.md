# Slinky type

**Status:** published 2026-10-13. Test at `/?p=slinky-type`.

**Brief (Idan, 12 Oct 2026).** The delight comes from a magical, surprising interaction. Tilted view with solid caps for the letters; each letter a condensed slinky, released on user interaction. Letters should fall toward the camera, not sideways, and motion should cover x and y as well as z.

## What it is (13 Oct 2026, after Idan's sketch)
An upright backdrop with IDAN SEGEV on it and a ledge in front (the sketch: a wall, a stair, arrows down). Each letter is a condensed slinky stood out of the wall, rings upright, the head ring (the solid cap) facing you: from the front it reads as flat type. Idan's Slinky settings and camera (yaw 50, pitch 20, isometric) apply (`POSTER_DEFAULTS`, `slinky-params.js`).

## Interactions
- **Click a letter:** a bump: it is shoved forward off the wall (the head ring leads, so the coil opens as it goes) with a small hop, lands on the ledge and bounces.
- **Click it again:** a harder bump: it goes over the edge and falls off the screen; once it is out of sight it is back on the wall.
- **Drag a letter's cap:** grab it and pull; the rest of the coil follows, and it falls from wherever you let go.
- **Drag empty space:** orbits the camera. Keys 1 to 6 are views, X puts every letter back, L locks the camera.
- **Three quick taps:** reveal (spine, ring tilts, head rings).
- Tap time and travel are the shared ones (`src/gestures.js`). Letters start asleep and sleep again when still, so nothing moves at rest.

## Limits
- Each letter moves in its own vertical plane running out from the wall: it can fall toward you, not sideways. Full 3D would need a new solver.
- The ledge is a floor with a wall behind it for the rings; the scene is framed to fit whatever the view.
- Not tried on a phone. No hint is shown.
