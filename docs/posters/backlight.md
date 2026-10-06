# Backlight (draft)

**Status:** first draft, 6 Oct 2026. Not in the shuffle. Test at `/?p=backlight` (add `&tune` for the panel).

**Idea.** After three.js's RectAreaLight example. The name is solid 3D type standing on a glossy black floor in a black room, and at rest nothing shows. A rectangular light hangs behind it: move the pointer (or drag) and the light wakes and follows. Letters appear as silhouettes against the glow, only where the light is behind them. The floor shows long soft shadows and a mirror image of the light and the type.

**How.** One full-screen ray-marching pass, no libraries. The type is a real extrusion: a signed distance field of the word (exact distance transform on the CPU, uploaded as an R16F texture) combined with a thickness. The light is a rectangle behind the type, with a bloom. Floor lighting uses the nearest point of the rectangle plus a soft shadow march; the reflection is one bounce. With the light off the whole frame is black.

**Controls.** Brightness, light size, height and distance, glow, travel, follow speed, letter thickness, floor reflection, camera sway.

**Open.** Mobile cost not measured; the floor shadow march and reflection are the expensive parts. Letter faces are pure black; a hint of rim light on the sides is the only shaping.
