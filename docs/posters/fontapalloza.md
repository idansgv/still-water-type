# Fontapalloza

**Status:** published 2026-10-14. Test at `/?p=fontapalloza`.

**Brief (Idan).** "A heavy rotation of fonts for each letter while mouse press. Extremely fast. Perhaps hover should swap and hold, and while pressed swap at a crazy rate."

**What it does.** "Idan / Segev", nine cells, one letter each, every glyph scaled to fill its cell. Hover a letter: it swaps to a new typeface once and holds. Press anywhere: every letter thrashes on its own random clock (about every 0-34 ms, with occasional longer pauses, so they never move in step) until release, and keeps the last one it landed on. Under reduced motion the press rate drops to about 3 a second per letter.

**How.** 2D canvas. 100 Google display families on load, then 50 more after the first touch (or 5 s idle), requested with `text=` so each downloads only the glyphs used. A face joins the pool once it has loaded, so the rotation grows as the network answers; metrics are cached per face and letter only after loading (cached fallback metrics broke the fit once). Reveal (three taps) outlines each cell and names its face.

**Open.** Colour is the shell's pass. Phone untested by hand. On touch there is no hover; press-and-drag swaps the cell under the finger, press alone thrashes. Pool curation (some faces are weak at nine letters or at heavy weight) is untried.
