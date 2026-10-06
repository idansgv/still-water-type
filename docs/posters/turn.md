# Turn (draft)

**Status:** first draft, 6 Oct 2026, replacing Backlight as the direction (Backlight stays as a draft). Not in the shuffle. Test at `/?p=turn` (add `&tune`).

**Brief (Idan).** Minimal impact, not immersive. Type placed in 3D, hidden at first, legible only when backlit. Letters rotate horizontally (and spin) one by one; the light source does not move.

**What it is.** A fixed luminous panel with nine thin black extruded letters in front of it, each turned edge-on, so the panel reads as empty but for hairlines. Drag a letter sideways to turn it: it appears as a silhouette against the light, sides catching the glow. Tap a letter to spin it like a coin, pushed from the side you touched. Letters keep momentum, then settle on a quarter turn: facing you, or edge-on. They never rest back-to-front (a mirrored name). On desktop, hovering a hidden letter opens it a few degrees.

**How.** One ray-marching pass. Each letter has its own distance-field texture (a layer of a texture array, computed once on the CPU), extruded and rotated about its own vertical axis. A long lens keeps edge-on letters thin. Coverage-based edge smoothing.

**Open.** Silhouette edges are a little noisy in motion. Not measured on a phone. Resting and spin values are guesses until Idan tunes them.
