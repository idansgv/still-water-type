# Interactions and hints

What each published poster does today, and the rules every poster should follow. Written 10 Oct 2026 from the code (an audit of every poster); the drafts are not listed. Slinky is out for now.

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

## In the pipeline (draft)

| | Shadow |
|---|---|
| Hover / drag | the lamp follows the pointer, a dragging finger or a tilt; a plateau at home keeps the letters exact |
| Tap on an object | it and its neighbours turn a full turn (under 250 ms, 8 px) |
| Tap on background | nothing |
| Hold | nothing |
| Double tap (empty) | new objects (a beat later) |
| Three taps (reveal) | page inverts; plan of the lamp, rays through each object to its shadow, the exact-letters ring |
| Self-demo | the lamp swings once at 3.5 s, then every 9 to 13 s, until the first touch; off under reduced motion |
| Idle | lamp eases home after 4 s |

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
