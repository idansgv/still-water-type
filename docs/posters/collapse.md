# Collapse

**Status:** draft (reachable with `?p=collapse`; not in the shuffle, no share page). Files: `src/posters/collapse.js` (a three-line wrapper) on `columns-core.js`, `physics.js`, `lettering.js`, `dust.js`, `lib3d.js`. Settings: `?p=collapse&tune`.

## Concept
"Idan Segev" as flat white type on black that is really tall columns, seen straight down through an orthographic camera, so only the tops show. Knock one over and it falls on its neighbours like dominoes.

## At rest
Plain bold white type on black. The letters are the Soft type skeletons thickened into overlapping boxes (mitred at joints, about 130 boxes in all) and extruded to a height you can set (default 3.4 units; a letter is 2 high).

## Model
Each letter is one Rapier compound rigid body, and **all letters weigh the same** so a falling letter can carry the next. The floor grips (friction 1, restitution 0.04) and letters are slippery against each other (friction 0.18, restitution 0.55); friction takes the larger of two surfaces and restitution the smaller. Physics at 120 Hz. Low boxes edge the screen instead of infinite planes, so tall columns can lean out over them.

## Interactions
- **Quick tap:** a firm knock at the top, away from where you touched (default strength 26). In 16 test taps every one toppled the letter, and a neighbour went over about 1.6 times on average, so chains are probabilistic, like dominoes.
- **Drag:** a spring from the point you grabbed to your finger; the letter tilts and rocks back, or goes over if pulled far enough.
- **Reset:** double tap empty space, or Re-form in the panel.
- **Dust** (soft grey puffs where hard bodies land): amount, puff size, how long it lasts, tone, softness, opacity.

## Settings
Extrusion height (re-forms), gravity, tap push, dust, background and foreground (black to white only), and the camera (tilt, turn, zoom, perspective; picking follows the camera).

## Lessons
Infinite wall planes at the screen edge stopped tall towers from falling: use low boxes. Equal masses, bouncier letter contacts and a fixed generous knock beat sizing the knock from tipping energy. The original Columns poster also had a hold-to-burst gesture; that became Explode.

## History and what is open
Split from the original "Columns" poster on 5 October 2026. Built on cannon-es first (a push into a tight row mostly leaned and rocked back), moved to Rapier with identical results (16 of 16 taps, 1.56 neighbours). Open: whether to join the shuffle, a light theme, a hint, a real-phone check.

Idan's tuned set applied as defaults (7 Oct 2026): gravity 21, extrusion height 5.2 (everything else as before). Collapse remains a draft.

**Status:** in the shuffle since 7 Oct 2026 (a share page exists at `/p/collapse/`).
