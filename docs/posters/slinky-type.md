# Slinky type

**Status:** published 2026-10-13. Test at `/?p=slinky-type`.

**Brief (Idan, 12 Oct 2026).** The delight comes from a magical, surprising interaction. Tilted view with solid caps for the letters; each letter a condensed slinky, released on user interaction. Letters should fall toward the camera, not sideways, and motion should cover x and y as well as z.

## What it is
IDAN SEGEV laid out like the other posters (IDAN / SEGEV; three rows on a phone), each letter its own slinky: a stack of 12 rings in the shape of the letter, packed tight (gap 0.045) so that at rest it reads as a bold solid block letter. The camera is tilted 46 degrees; the head ring of each letter is a solid fill (the cap, the letter itself) and the rest of the coil is wire, so the ribs show only as thin lines. Nothing says it is a Slinky until you touch it.

## Interactions
- **Tap a letter:** it is kicked over and unspools as it falls toward the camera, leaning left or right toward the side of the letter that was touched (up to about 43 degrees, plus a small random wobble). A tap in the middle falls straight toward the viewer.
- **Drag a letter's top:** it falls the way it is pulled, in any direction on the plane.
- **Drag empty space:** orbits the camera. Keys 1 to 6 are views, X stands the letters up again, L locks the camera.
- **Three quick taps:** reveal. The page inverts and each letter shows its spine, the tilt of every ring, its head ring and the ring count.
- Tap and hold thresholds are the shared ones (`src/gestures.js`).

## Limits
- Each letter's coil moves in one vertical plane (aimed by the tap or drag); it cannot twist or tumble sideways mid-air. Full 3D would need a new solver.
- A letter in the back row lands on the front row. Letters in the front row fall off the bottom of the screen.
- A release where the coil springs up and drops was tried and parked: the stiff coil carries the whole stack up with the hand.
- Not tried on a phone. No hint is shown.
