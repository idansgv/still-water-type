# Fan (was Jazz, then jazz-fan): brief (idea stage, no code yet)

**Status:** published 2026-10-14.

Opened 14 Oct 2026. Idan: "New poster: Jazz. Explore this:" Studio Dumbar's North Sea Jazz 50th-anniversary identity, Instagram post DbVzYkQDGSw, slide 4 (a motion piece, not a still). Reference is someone else's artwork: look, don't copy. Nothing is saved locally.

## What slide 4 does (frames watched in the browser)
1. **Rest:** the word JAZZ, one line, very heavy wide grotesque, flat hot pink on pure black. Centred, fills the width.
2. **Slice:** the letters are cut into thin horizontal strips (a stack of 20 to 30 lines per letter height). The strips stay in the letter shape but each is its own bar.
3. **Fan:** strips shear sideways by different amounts, so the word sweeps into a perspective fan, leaning and curving like a pulled-open deck of cards. Colour runs from magenta at one end to orange-red at the other, and a gap opens between strips so the black shows through.
4. **Scatter:** strips drift apart horizontally into dashes (words become rows of short bars), with the bottom strips still solid. Then it snaps back to the clean word.
So: one idea, a stripe cut (scanlines) as the instrument, rhythm like a jazz stab: hold, break, resolve.

## Why it is a good fit here
- Type only, one colour field, motion is the whole poster, like the rest of the set.
- Strip offset is a single scalar field per row, so it is cheap, crisp at any size, and easy to hand to the pointer.

## Answers (14 Oct 2026)
1. Colour: black and white. 2. Motion: both (self-demo loop until first touch, then pointer: drag, hover nudge, tap stab). 3. Word: IDAN / SEGEV (the poster is still called Jazz).

## Open questions (answered above)
1. **Colour:** the house rule is black and white only (shell owns the swap). Reference is pink-on-black. Stay B/W (my default), or is this the one that gets a colour?
2. **Motion:** make it pointer-driven (drag/hover shears strips by row, release snaps back) or an autonomous loop like the reference? Default: pointer-driven, one self-demo until first touch.
3. **Word:** just JAZZ, as in the reference?

## Proposed first target still (to agree before code)
JAZZ in a heavy wide face (Bungee/Archivo Black class, fills the width), black on white, cut into about 24 horizontal strips with a thin gap, caught mid-fan: top strips shifted left, bottom strips shifted right in a smooth curve, so the word leans and the baseline flares. One still, no colour.

## Next steps
1. Idan answers the three questions and OKs or redirects the still.
2. Draft `src/posters/fan.js` (`?p=fan&tune`), with `destroy()`, gestures, reveal, per `docs/PIPELINE.md`.
3. `npm run shot -- jazz`, panel Save as defaults, `npm run ship -- jazz` (no push without his yes).

## Status
Published 14 Oct 2026 as `jazz-fan`, renamed `fan` the same day (the old URL /p/jazz-fan/ no longer exists). WebGL, one textured quad per strip (45 per line), five springs per strip (swing, yaw, pitch, length, slide); the fan pivots on one centre line through the block (above leans up, below leans down). Camera: wheel zoom, Alt-drag orbit, Shift-drag pan, panel sliders. Idan's tuned values are `DEF` in `src/posters/fan.js`. Colour experiments live in `fan-color` (draft).
