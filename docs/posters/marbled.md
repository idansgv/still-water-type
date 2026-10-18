# Marbled type (test)

**Status:** draft. Published 2026-10-17, pulled from the launch set 2026-10-18: needs more refinement first.

**Brief (Idan, 17 Oct 2026).** Picked from a second round of five ideas ("2"): the name floats as ink on water, like Japanese suminagashi. Drag to comb it into feathered marbled patterns; tap to drop a new ring of ink. It never resets on its own, so each visitor leaves their own pattern.

**Test page:** source `docs/posters/prototypes/marbled.html` (Canvas 2D, no library). The ink is vector: the outline of the type is traced once, then every move is applied to its points, so it stays sharp however far it is pulled (the drop is the area-preserving one from "Mathematical Marbling"; the comb drags the ink beside each stroke with a fast falloff, so a long stroke stays local). A tap drops ink and then clear water into its middle, so it lands as a ring. Settings: rings, comb teeth and spacing, feathering sharpness, pull, drop size, colour easter egg, start again.
