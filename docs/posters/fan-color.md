# Fan color (draft)

**Status:** draft, 14 Oct 2026. The colour test of [Fan](fan.md): same strips, springs, centre-line fan and camera, with the ink as a gradient. Idan: "test color, use the gradients in the example, open to more", and a light/dark toggle in the tuning sliders.

- Gradients are three stops (top, middle, bottom) of a line, or of the whole block (toggle *Gradient per line*); lines alternate between the palette's two gradients (the reference has cyan to lime on NORTH and pink to coral on SEA). Palettes: North Sea, Hot, Sunset, Acid, Violet, Ember (`PALETTES` in `src/posters/fan-color.js`).
- Settings panel, group Colour: Dark background (toggle), Palette (0 to 5), Gradient per line, Spread, Shift.
- Colour is outside the house rule (black and white), so this does not graduate unless Idan decides colour is allowed here. The shell's black/white sequence is ignored by this draft after load; the toggle owns the background.

## Interaction notes (16 Oct 2026)
- Drag: the split line follows the pointer's height (above it leans up, below leans down); sideways swings the fan; vertical distance also tips the strips into depth and lengthens them. Release and the line glides back to the middle.
- Camera: starts from the tuned view nudged by a seeded random orbit, roll, pan and zoom (toggle *Random start camera*, button *New camera*, *Reset camera* returns to the exact tuned view).
