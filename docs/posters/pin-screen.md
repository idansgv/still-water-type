# Pin screen (test)

**Brief (Idan, 17 Oct 2026).** From the second round of ideas ("Now 3"): the name pressed into a pin-art toy, seen from above with soft shading. Pressing pushes the pins in under your finger, leaving your own imprint. A double tap shakes the board back to the name.

**Test page:** source `docs/posters/prototypes/pin-screen.html` (WebGL2, no library). One instanced quad per pin, drawn twice: a domed head with depth, then a soft shadow that only darkens what is lower than the head, so raised letters shade the flat pins beside them. A press is a round fingertip, deepest in the middle; held still it goes deeper; a drag ploughs a groove. Pressed pins stay pressed. Double tap: every pin springs back to the name with a rattle. Settings: pin size, fingertip, press depth, how far the name stands out, viewing angle, light direction, colour easter egg (only the pins you pressed).
