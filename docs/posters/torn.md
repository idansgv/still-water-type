# Torn

**Status:** published 25 Oct 2026 (`src/posters/torn.js`, `?p=torn`). The test page `docs/posters/prototypes/torn.html` stays as the tuning bench.

**Brief (Idan, 19 Oct 2026).** Split from Rigged: "1 poster should maximize cloth behavior including tear." What he loved in Rigged round 1 was the letters cut loose from their strings, hanging and moving like fabric.

**Test page:** `docs/posters/prototypes/torn.html` (same WebGL cloth and position-based solver as Rigged). The name in Bungee, each letter a piece of cloth hung from a few pegs along its top edge, so it drapes: IDAN reads, the arms of S, E, G droop. Moving the pointer pushes air at the cloth. Drag pulls it; pull hard and threads snap (an edge stretched past `tear` times its length takes its triangles with it, so the rip runs along the line of most stress) and the pieces fall and pile on the floor. Tap pulls out the nearest peg; double tap opens the floor, lets the old cloth fall away and lowers a fresh set on its pegs (also the one self-demo on load). Three taps invert the page and draw every thread by how hard it is pulled. Settings: face, pegs per letter, tear, slack, fold stiffness, gravity, air, detail, fold light.

**Gotchas found while building.** A peg must hold a small patch, not one point, or the cloth tears off its pegs under its own weight. The descent of a fresh set runs on simulation time and tearing is off while it comes down, or the pegs braking rip the cloth.

**Tuned defaults (Idan, 21 Oct 2026).** Alfa Slab One, 6 pegs per letter, tear 2.25, slack 1.05, fold stiffness 0.05, gravity 1650, air 0.6, detail 5200, fold light 0.15. Now the page defaults (test link version 2).
