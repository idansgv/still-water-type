# Interactions and hints

What each published poster does today, and the rules every poster should follow. Written 10 Oct 2026 from the code (an audit of every poster); the drafts are not listed. Slinky is out for now.

## The menu (13 Oct 2026)
Hover the top-left corner and a quiet "Posters" appears (on a touch screen it is always faintly there). Click it and the published posters are listed in large type (Archivo, a number at the right); the hovered row nudges left and the others dim, and a preview image follows the pointer with easing (not on touch). Click a row to go to that poster (a middle or modifier click opens its share page); Escape, the corner ("Close") or a click beside the list closes it; with it open the arrow keys walk the list and nothing shuffles. The previews are `assets/previews/<slug>.jpg`, made by `tools/previews.cjs` (the poster a moment after a touch, on the live fonts). It is built from the registry, so a poster that graduates joins the list, and the same list can carry Work later.

## Rules for every poster

| Gesture | Rule | State |
|---|---|---|
| **Three quick taps** (anywhere, close together, each a short still tap) | **Reveal**: the page inverts and the poster draws what it is made of; three more put it back. One engine gesture (`stage.revealed`, `stage.on('reveal')`, `src/engine.js`). | Done on all five published posters |
| Black and white | The first poster is black on white; every shuffle swaps (white on black, black on white). Every poster follows `stage.theme` / `stage.flip`. `?theme=light|dark` overrides. | Done (one rule in `src/main.js`) |
| Tap | Under 0.25 s and under 8 px. | **Open**: today 0.22 s to 0.45 s, 8 or 10 px (table below) |
| Hold | 0.25 s or longer, with a per-poster action. | **Open** |
| Tap on background | Nothing, except the double tap. | **Open**: still does something in Still Water |
| Double tap on empty space | Re-form (a beat later, so a third tap can still mean reveal). | Collapse, Explode, Metal only |
| Idle hint | One quiet self-demo after about 3.5 s without a press, stopping at the first press anywhere; off under reduced motion. | **Open**: each poster has its own |
| Keys | Shell only: Space, Enter, ArrowRight, R shuffle; S share; T settings. Poster keys are extras (Still Water: L, X). | as is |

## Published posters today

| | Still Water | Soft type | Collapse | Explode | Liquid metal |
|---|---|---|---|---|---|
| Hover (mouse) | wakes ripples, moves the lamp | cursor only | cursor `grab` | cursor `pointer` | cursor only |
| Tap on a letter | stone ripple (under 8 px, no time cap) | letter inflates then rockets (under 0.22 s) | knocks the column over (under 0.22 s, 8 px) | detonates on the press itself | splash (under 8 px, 260 ms) |
| Tap on background | same as on a letter | nothing | nothing | nothing | nothing |
| Hold | nothing | 0.22 s: inflates (0.24 per s), flickers at full, bursts after 1.15 s and throws the rest | 0.22 s: nothing | nothing | nothing |
| Drag | wake trail | bend and squash the letter | spring-drag the column | nothing | pull threads, fuse |
| Release | nothing | rocket, home or burst | topple or drop | nothing | splash if tap; otherwise rests, then **returns to the name after 6 s** |
| Double tap (empty) | none | none | re-form | re-form | re-form |
| Three taps (reveal) | lamp on: caustics, a night scene | particles, springs, homes, air gauge | blueprint: boxes, centre of mass, weight, reaction, support polygon, lean, speed, last knock | fracture cells, reach, chain | droplets, bonds, homes, tethers |
| Keys | L lamp, X rain | none | none | none | none |
| Tilt | type parallax | none | none | none | rolls loose beads (touch only) |
| Multi-touch | no guard | one pointer | one pointer | one pointer | one pointer |
| Registry hint (6.5 s, only if untouched) | none | none | none | none | none |
| Self-demo | opening splash; lamp wanders after 2.5 s still | breeze at 3 s, a letter breathes every 4.5 to 7.5 s, until a letter is pressed | none | none | ripple along a letter at 3.5 s then every 5 to 8 s, until a droplet is grabbed |
| Reduced motion | amplitudes 45%, no drip | demo off | not read | not read | demo off |

## Fan (published 14 Oct 2026, was jazz-fan)

| | Fan |
|---|---|
| Hover (mouse) | a moving mouse nudges the strips it passes sideways (they slide like a reel and spring back) |
| Tap | a stab: a wave of flicks runs out from the tap, row by row (under 250 ms, 8 px) |
| Tap on background | the same stab (the whole poster is strips) |
| Hold | nothing |
| Drag | pressed point is the pivot; right or left swings the fan, up or down tips it into depth; release springs home |
| Camera | wheel zooms, Alt-drag orbits, Shift-drag pans; the settings panel has orbit, roll, zoom, pan and Reset camera |
| Double tap | nothing |
| Three taps (reveal) | the strip rows, the centre line and each strip's swing |
| Self-demo | after about 3.2 s untouched: fan, hold, scatter, resolve, repeat, until the first touch; off under reduced motion |
| Multi-touch | one pointer |

## Rain (published 14 Oct 2026)

| | Rain |
|---|---|
| Hover (mouse) | light rain falls where the cursor is and marks the letters it lands on; marks never fade |
| Tap / press | pours: a dense, wide downpour while pressed and for 1.3 s after release |
| Touch | no hover rain; rain falls at the finger while pressed |
| Tap on background | the same pour (rain only marks the letters) |
| Hold | keeps pouring |
| Drag | the rain follows |
| Double tap | dries the word again (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | the extruded outline front and back, and the rain's direction |
| Self-demo | off in the saved settings (the panel has a switch: a slow sweep across each line until the first touch) |
| Settings | `?p=rain&tune` or T; Save as defaults writes `src/posters/params/rain.json` |
| Multi-touch | one pointer |

## Fontapalloza (published 14 Oct 2026)

| | Fontapalloza |
|---|---|
| Hover (mouse) | the letter under the cursor swaps to a new typeface once, and holds it |
| Tap / press | every letter thrashes through the collection, each on its own random clock (0 to 34 ms, now and then a pause of 40 to 150 ms), until release; each keeps the last face it landed on |
| Touch | no hover; press thrashes, dragging a finger over a letter swaps that one |
| Tap on background | the same thrash while pressed |
| Hold | keeps thrashing |
| Double tap | nothing |
| Three taps (reveal) | each letter's cell, tinted, with the name of the face it holds, and how many faces have loaded |
| Self-demo | none |
| Reduced motion | the thrash slows to about three swaps a second per letter |
| Multi-touch | one pointer |

## In the pipeline (draft): Rigged (published 21 Oct 2026, back to draft 24 Oct)

| | Rigged |
|---|---|
| Hover (mouse) | nothing |
| Tap | cuts the nearest rope (a hoist or a plumb): the corner sags, the weight stays on its ledge or the bob falls; after a pause the rope is tied again and reeled in (under 250 ms, 8 px) |
| Tap on background | nothing, unless a rope is within about a third of a cap height |
| Hold | takes hold of the cloth (250 ms) |
| Drag | pulls the cloth against the weights: counterweights lift off their ledges, bobs swing; release and it settles back |
| Double tap | ties every cut rope now (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | the whole rig at full strength, and the runs the cloth hides (the bridles, ropes behind arms), dashed |
| Intro | the ropes start slack and the rig hoists the name once on load; none under reduced motion |
| Colour | the framework's colour pass, on the first press |
| Multi-touch | one pointer |

## Marbled (published 21 Oct 2026)

| | Marbled |
|---|---|
| Tap / press | a drop of ink: it pushes all the ink outward keeping its area, then clear water into its middle, so it lands as a ring (under 250 ms, 8 px) |
| Drag | combs the ink: the ink beside the stroke is dragged along it, less the farther away; curves stay smooth |
| Hover (mouse) | gently stirs the ink: it is drawn displaced by a springy field the mouse pushes, swings back with a small bounce and settles exactly where it was; the shapes are never changed. Counts as the first touch (no self-demo after) |
| Touch | the same; one pointer |
| Ripple | every touch sends a ring of push out through the water (drawn only, settles back); a drag keeps sending a few a second |
| Hold | the ink under the finger gives a few pixels, in a soft ring, and springs back on release (drawn only) |
| Idle | after 2.5 s untouched, a faint shiver every 3.5 to 6 s, at a random point on the ink; drawn only, settles back (off under reduced motion, and during the opening demo) |
| Double tap (empty) | start again: the clean name (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | page inverts; every shape's outline and points, and each drop with its ring |
| Face | "Idan Segev" in Arial Black (Helvetica Bold where it is missing) |
| Self-demo | one slow comb stroke through the name at 3.5 s, until the first touch or hover; off under reduced motion |
| Reduced motion | no self-demo; everything else is touch |
| Colour (rare) | from the first touch, each drop of ink is a colour from the palette |

## Glint (published 21 Oct 2026)

| | Glint |
|---|---|
| Hover / drag | the lamp follows the mouse, or a finger |
| Tap / hold | nothing more: the lamp is where you put it |
| Double tap | nothing |
| Three taps (reveal) | page inverts; the lamp, the rays it throws, its position and height, the bevel and reach |
| Self-demo | the lamp takes one slow turn through the name at 3.5 s, then stops; off under reduced motion |
| Theme | black only (`darkOnly: true` in the registry): the shell always shows it dark and the black/white sequence carries on from it; `?theme=light` is ignored. A lamp in the dark has no white version (the inverted negative was the weakest look) |
| Reduced motion | no self-demo; the lamp rests at the left until you take it |
| Colour (rare) | from the first move, the light takes the palette down the page |

## Splat type (published 21 Oct 2026)

| | Splat type |
|---|---|
| Tap / press | a burst: the splats near it are thrown outward, most a little and a few far (reach 115 px; under 250 ms, 8 px is a tap) |
| Drag | pushes the dust along the stroke; it stretches into streaks while it flies |
| Hover (mouse) | a breath: a light push from a passing pointer (off by default; a toggle in settings); nothing on touch |
| Hold | nothing more than the press |
| Double tap (empty) | pulls everything home now (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | page inverts; a sample of the grains at home, and where the thrown ones are |
| Settling | every splat is a spring toward its home, so the letters close up by themselves |
| Reduced motion | fewer splats (40,000 at most) and a weaker burst |
| Colour (rare) | from the first press, the splats take the palette down the page |
| Multi-touch | one pointer |

## Crystallize (published 24 Oct 2026)

| | Crystallize |
|---|---|
| Intro | a coarse, even crackle; the cells inside the letters keep splitting until the name shows (a few seconds); under reduced motion it opens settled |
| Hover / drag | stirs the cells near the pointer; they relax back |
| Tap | knocks a coarse hole (a fifth of the short side): the fine cells there go, a few big ones take their place and refine back (under 250 ms, 8 px) |
| Hold | melts the cells under the finger (250 ms) |
| Double tap | starts over from the coarse crackle (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | dots only: the page inverts, the cell edges go and only the seeds stay, still moving with every gesture; the taps leave no hole (the seeds are put back as they were before the first tap) |
| Face | Fraunces 900 (Google Fonts, the name's letters only) |
| Colour (rare) | the framework's colour pass, on the first press |
| Multi-touch | one pointer |

## Brandbook (published 24 Oct 2026)

| | Brandbook |
|---|---|
| Layout | the whole book on one screen (default, Idan's pick); settings (`&tune`) also offer 0 a wall you scroll inside the poster and 2 one slide at a time |
| Tap (click) | after a 420 ms beat (so two or three quick taps never start it), the brand turns into the next one, played through from where you tapped |
| Hold (250 ms, still, not on a misuse tile) | the brand morphs into the next one: each display letter changes face at its own moment, the device melts into the next shape, the new brand shows through growing dots or thickening lines of its own screen; ripples out from the finger; let go before halfway and it rewinds |
| Drag on a misuse tile | breaks that rule by hand (stretch, squash, tilt, fade, shadow, outline, crowd); let go and it springs back corrected, the cross goes and the caption says thank you |
| Drag elsewhere | scrolls the wall (layout 0) or swipes to the next slide (layout 2) |
| Three taps (reveal) | page inverts; the 12-column grid and margins, baselines, cap and x-heights, each mark's box, circles, diagonals and clear space, and how each device is built (sphere and light, burst rays, ring bands, the letter's square, the wave) |
| Self-demo | once, about 2 s after the next brand is ready and only if untouched: a third of a morph and back; off under reduced motion |
| Reduced motion | no demo; the morph runs faster |
| Colour | the framework's pass on a press |

## Glitter (published 25 Oct 2026)

| | Glitter |
|---|---|
| Hover / drag | the moon follows the pointer (or a finger); the move leaves a wake of ripples, so the glitter flares behind it and settles |
| Tap | a splash of ripples (under 250 ms, 8 px) |
| Hold | wind over every letter (250 ms, still): the glitter spreads across the whole name; let go and it calms |
| Double tap | calm water (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | the moon climbs high and a breeze crosses every letter, so the whole name blazes; drawn over it: the moon, how far its glints reach |
| Self-demo | once, after 3.5 s untouched: the moon crosses low trailing a breeze, then rests high above the middle; off under reduced motion |
| Theme | black only (`darkOnly: true`), like Glint |
| Reduced motion | no demo; ripples at half strength |
| Face | Bitter 700 (Google Fonts, the name's letters only) |

## Lace (on hold: back to draft 25 Oct 2026, was published the same day)

| | Lace |
|---|---|
| Hover (mouse) | a breath: the foam under the pointer ages a little |
| Drag | ages the foam faster and pulls it a little along the stroke |
| Tap | opens a patch of lace (under 250 ms, 8 px) |
| Hold | a gale (250 ms, still): all the foam ages and is blown along in rows; it can thin away entirely |
| Double tap | a breaker rolls across from the left and lays fresh foam (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | page inverts; the touch's reach and the bubble sizes the lace follows |
| Self-demo | once, after 3.5 s untouched: a slow breath crosses the middle and opens some lace; off under reduced motion |
| Theme | both: black foam on white (Idan's pick, the likelier draw), white foam on black |
| Reduced motion | no demo; touches at half strength |
| Face | Bitter 840 (Google Fonts, the name's letters only) |

## Wash script (published 25 Oct 2026)

| | Wash script |
|---|---|
| Intro | a wet brush writes the name in black watercolour along the centre line of a script or handwriting face, once on load; it dries with a darker rim |
| Drag | a brush of clear water with a colour on it: it lifts the ink and drags it along, the colour running into it; it dries with its own rim |
| Touch | the same; one pointer |
| Hold | floods: the brush grows and lays more water, so the ink spreads |
| Double tap | blots it all up and writes it again in the next script face (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | page inverts; the centre line the brush follows and where each stroke starts |
| Face | Parisienne, then WindSong, Dancing Script, Mr Dafoe, Comforter, Zeyada, Nothing You Could Do, Reenie Beanie, Caveat, Gloria Hallelujah: Idan's picks (Google Fonts, the name's letters only) |
| Self-demo | none beyond the writing |
| Reduced motion | the name is written and dried in one go; nothing moves until touched |
| Colour | its own, on every drag (each press the next colour of the page's palette); the writing stays black |

## Torn (published 25 Oct 2026)

| | Torn |
|---|---|
| Hover (mouse) | the moving pointer pushes air at the cloth: it sways and flutters out of the page |
| Tap | pulls out the nearest peg (a beat later, so a double or triple tap does not): the letter swings down from the rest |
| Tap on background | nothing, unless a peg or a letter is within about half a cap height |
| Hold | takes hold of the cloth (250 ms) |
| Drag | pulls the cloth; pull hard and it tears along the line of most stress, and the pieces fall and pile on the floor |
| Double tap | the floor opens, the old cloth falls away and a fresh set comes down on its pegs (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | every thread, heavier the harder it is pulled, with the peg and tear counts |
| Intro | the name comes down on its pegs once on load; under reduced motion it is simply hanging |
| Colour | the framework's colour pass, on the first press |
| Multi-touch | one pointer |

## Moonlit (published 25 Oct 2026)

| | Moonlit |
|---|---|
| At rest | a light breeze outside the letters keeps the sea glittering, so the name shows as dark, glassy water (Idan's tuning) |
| Hover / drag | wind under the pointer; gusts drift left to right and die away |
| Tap | a puff of wind (under 250 ms, 8 px) |
| Hold | a gale (250 ms, still): swell, foam on the crests, the slick tears into strands; heals after you let go |
| Double tap | calm (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | lightning beyond the frame and a gust across the page; drawn over it: the wind |
| Self-demo | once, after 3.5 s untouched: a gust crosses the page; off under reduced motion |
| Theme | black only (`darkOnly: true`) |
| Reduced motion | no demo; the sea is frozen |
| Face | Bitter 900 (Google Fonts, the name's letters only) |

## Phases (published 29 Oct 2026, was Moiré phase)

| | Phases |
|---|---|
| At rest | two voices of lines bent in 3D; the bends travel slowly and voice 2 lags behind in Reich's steps (12 per 50 s cycle). Once a cycle they fall back into step and the name appears by gestalt, then dissolves into moiré (Idan's standing drift) |
| Drag | turns the view through the lines; springs back on release |
| Tap | voice 2 one beat ahead (under 250 ms, 8 px; after the double-tap window) |
| Hold | settles into unison and waits there: the name (250 ms, still) |
| Double tap | starts the cycle over from unison (a beat later, so a third tap can still mean reveal) |
| Three taps (reveal) | voice 2 lifts off, leaving the one set of lines that carries the name; drawn over it: grid, the two voices, the current lag |
| Self-demo | none (the drift is the demo) |
| Theme | black on white or white on black |
| Reduced motion | the drift is frozen |
| Face | Alfa Slab One (Google Fonts, the name's letters only) |

## In the pipeline (draft)

| | Shadow |
|---|---|
| Hover / drag | the light's slant follows the pointer, a dragging finger or a tilt; a plateau at home keeps the letters exact |
| Tap on a fin | it grows or shrinks once and settles, its shadow with it (under 250 ms, 8 px) |
| Drag on background | orbits the camera; the light holds still |
| Tap on background | nothing |
| Hold | nothing |
| Keys | 1 front, 2 side, 3 top, 4 from the light; L shows the light |
| Double tap (empty) | a new plan (a beat later) |
| Three taps (reveal) | page inverts; the far edge of every run and a ray along each shadow, the light and its slant |
| Self-demo | the light swings once at 3.5 s, then every 9 to 13 s, until the first touch; off under reduced motion |
| Idle | light eases home after 4 s |

## Slinky

| | Slinky |
|---|---|
| Tap an end ring | the slinky is nudged forward and walks down the steps (under 250 ms) |
| Drag an end ring | pulls it |
| Drag on background | orbits the camera |
| Tap on background | nothing |
| Hold | nothing (the factory scene: holding streams coils) |
| Keys | M scene (stairs, factory, plane), 1 to 6 views, L lock the camera, X re-form |
| Three taps (reveal) | the spine and rings, the settings |
| Self-demo | none |

## Slinky type

| | Slinky type |
|---|---|
| Tap on a letter | kicked over, falls toward the camera, leaning to the touched side (under 250 ms, 8 px) |
| Drag a letter's top | falls the way it is pulled |
| Drag on background | orbits the camera; wheel / pinch zooms; Shift- or right-drag pans |
| Tap on background | nothing |
| Hold | nothing |
| Keys | 1 to 6 views, X stand up, L lock the camera |
| Three taps (reveal) | spine, ring tilts, head ring and ring count |
| Self-demo | none |

## Known inconsistencies still to settle

1. Tap length and travel differ (0.22 s, 260 ms, 380 ms, 450 ms; 8 or 10 px); Still Water and Explode have no cap.
2. Hold means three things: inflate (Soft type), nothing (Collapse), feed dough (Extrude, draft).
3. A background tap does something only in Still Water (published); Soft type and Metal's demos keep running after a background tap or hover because they wait for a letter press.
4. Only Collapse, Explode and Metal re-form on a double tap; Soft type and Still Water offer no reset gesture.
5. Explode fires on the press, the others on release.
6. No poster has a registry hint; the only two that do are drafts (Backlight, Turn), and the hint never shows to a desktop visitor who moves the mouse in the first 6.5 s.
7. Reduced motion is read by some posters and not others.

## Tests

`tools/tests/` (Playwright, Google Chrome): smoke, shuffle leaks, responsive and themes, mouse and touch, frame time, the black and white sequence, reveal. Run:

```
NODE_PATH=$(npm root -g) npx playwright test -c tools/tests
```

Published posters only; `SET=all` adds the drafts; `BASE_URL=https://...` tests another build.
