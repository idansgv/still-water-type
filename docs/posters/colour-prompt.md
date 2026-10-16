# Colour prompt (carry over to another poster)

Paste this into a session on any poster in `type-posters`. Written 14 Oct 2026 from `fan-color`. Colour is outside the house black-and-white rule, so the result is a draft (`<slug>-color`) for testing, never auto-graduated.

```
Make a colour test version of the poster "<slug>" as a new draft "<slug>-color". Copy src/posters/<slug>.js to src/posters/<slug>-color.js, add a draft registry row in src/posters/index.js, a scene in tools/scenes.cjs, and docs/posters/<slug>-color.md. Do not touch the published poster. Do not push anything; I review it locally first.

Use the shared colour system in src/posters/palette.js, do not re-invent it:
- State: put { ...COLOUR_DEF, dark: <1 if stage.theme is dark> } on the poster's tune.values.
- Panel: append ...colourGroups() to tune.groups. It is already segmented: Background (dark/light toggle, lift from black/white), Palette (0-5 presets, 6 custom), Custom palette (top/bottom hue of gradient A and B, saturation, lightness), Mapping (gradient per line or across the block, lines alternate A/B, reverse, spread, shift, depth fade).
- Background: stage.setBackdrop(paperGrey(P)) on load and whenever dark or bgTone change; clear the canvas to that grey; the poster's reset() restores the theme's dark/light.
- Shader (WebGL): paste GLSL_GRADIENT into the fragment shader and call gradientColour(vG, vDepth, paper). vG = (position over the whole block 0 top..1 bottom, position within its line 0..1, line number); vDepth = 0 on the page plane up to 1 far behind it. Call gradientUniforms(gl, prog.u, P) every draw.
- Canvas 2D posters: use gradientData(P) (Float32Array of six RGB stops) and build a canvas gradient per line from the same stops, same mapping.
- Decide what "line" and "block" mean for this poster (rows of type, strips, columns, particles by their home y) and say so in the docs page.
- Keep everything else identical: gestures, reveal, destroy(), calm under reduced motion. Palette defaults: 0 North Sea (cyan to lime on the first line, pink to coral on the second).
- Verify with a screenshot of every palette, custom, light and dark, before telling me it is ready. Show me the contact sheet.
```
