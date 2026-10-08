# Slinky (draft)

**Status:** stage one, 9 Oct 2026, draft (`?p=slinky`). File: `src/posters/slinky.js`.

**Brief (Idan).** Make a Slinky from the letters. Start simple by defining the spring behaviour, then mature it into letter shapes.

**Stage one: the spring.** A chain of coils (default 38), each joined to the next by a zero-rest-length spring (force grows from zero distance, so the chain stretches a long way and stacks tight), a hard minimum spacing (the wire), gravity, light damping and air drag. Hung from the top, it settles stretched at the top and bunched at the bottom, the classic profile. Each coil is drawn as a ring (an ellipse perpendicular to the spine). One colour, black on white or white on black on every second shuffle.
- **Interaction:** grab any coil and pull; let go and a wave runs along it (the bottom lags and then drops, the "Slinky drop"). Drag the top coil to move the hanger.
- **Panel** (`&tune`): stiffness, stacked spacing, damping, gravity, air drag, number of coils, coil radius, how round the coils look; actions Re-form, Let go of the top, Hang it.
- **Checked:** a hanging slinky settles (top coil gaps about 40 px, bottom stacked); pulling coil 20 up 260 px and releasing sends a wave down: the tip lags about a second, then follows. The first real-time load once blew up (all coils flung off-screen) and I could not reproduce it; the stepping is conservative (6 sub-steps of 1/360 s per frame), but watch for it.

**Stage two (not started).** Lay the chain along the letter strokes (the skeleton paths from the font), with the coil rings perpendicular to the path, so each letter is a slinky you can stretch, compress and let spring back; the open question is how the ends join and how the letters hang or sit.
