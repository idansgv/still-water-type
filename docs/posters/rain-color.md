# Rain color (draft)

**Status:** colour test, 14 Oct 2026. Draft (`?p=rain-color`), not in the shuffle, not published, never auto-graduated (colour is outside the house black-and-white rule). File: `src/posters/rain-color.js`; shared colour system: `src/posters/palette.js`; saved settings: `src/posters/params/rain-color.json` (a copy of Rain's, so the form is identical). The published Rain is untouched.

**What changed from Rain.** Only the ink. The marks are painted with a gradient from the palette instead of black or white. Everything else is the same: the type, rain, camera, gestures (hover rain, press pours, double tap dries), reveal, `destroy()`, calm under reduced motion.

**What "block" and "line" mean here.**
- **Block:** the whole word, from the top of the first line of type to the bottom of the last.
- **Line:** one row of type, found from the rows of the type mask that carry ink ("Idan", "Segev"). Lines alternate gradient A and B (palette 0, North Sea: cyan to lime on the first line, pink to coral on the second).
- A mark takes its colour from where it lands on the surface (its world height), so a mark on a top or side face matches the front face beside it. **Depth fade** sinks marks that sit far behind the front face (deep in the sides) into the page colour.

**Background.** `stage.setBackdrop(paperGrey(P))`: a dark/light toggle and a lift from pure black or white. The word body (the page colour) and the faint tint on its tops and sides follow it. Reset restores the theme's dark or light.

**Panel.** Everything from Rain, plus the shared Colour groups: Background, Palette (0-5, 6 custom), Custom palette, Mapping.
