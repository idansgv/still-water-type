# Turn (draft)

**Status:** second direction, 6 Oct 2026 (the first, a white panel with edge-on letters, was a misreading and is replaced). Backlight stays as a separate draft. Not in the shuffle. Test at `/?p=turn` (add `&tune`).

**Brief (Idan).** Minimal impact, not immersive. Type placed in 3D, hidden at first, legible only when light is reflected on it. All black; letters become visible only while turning. Letters rotate horizontally (and spin) one by one; the light does not move.

**What it is.** Black letters, glossy, in a black room, with a fixed strip of light far off to one side. At rest nothing shows. A letter is visible only when turned to the angle where its face mirrors the strip into the camera: it flashes white, with a soft gradient across the face as the angle approaches. Drag a letter sideways to turn it by hand; tap it to spin it like a coin and watch it flash as it passes the angle. Let go near the angle and it settles into it, lit and legible. On desktop, hovering a dark letter turns it a little toward the light.

**How.** One ray-marching pass. Each letter is an extruded distance-field (a layer per letter in a texture array, computed once on the CPU), rotated about its own vertical axis, with exact flat-face and side-wall normals. Shading is a mirror: reflect the view ray, intersect the light's plane, test against the strip. The angle at which each letter mirrors the light is computed per letter (they differ across the word).

**Controls.** Light position, width, distance, edge softness, gloss; thickness, hover peek, lens; drag gain, tap spin, friction, how close to the lit angle a letter settles.

**Open.** Not measured on a phone. Silhouette edges are not anti-aliased against black. Defaults are guesses until Idan tunes them.
