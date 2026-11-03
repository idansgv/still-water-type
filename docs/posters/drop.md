# Drop

**Status:** published 2026-11-03. Test at `/?p=drop`.

## What it is
The name (or an album title) in thick clear glass, Archivo Black, falling onto a floor that shows only shadows over the flat page. A letter that lands hard breaks where it touches: the bottom stops and the rest keeps falling into it. About a third land whole. The pieces heap up on each other and dissolve where they lie; the title drops again on a loop. On a narrow screen the letters stay big and come one at a time.

## Interactions
Tap a whole letter: it breaks where you tapped. Tap a piece: it flicks up. Background tap and hold: nothing. Double tap: drop the title again now. Three taps: reveal (contact points, motion, letters still whole). Reduced motion: the settled pile, still.

## Port notes (3 Nov 2026)
- `src/posters/drop.js`, three.js r160 (vendored). Left out from the test page: the colour fringe (dispersion needs r163, and the site is black and white). The page is pure black or white (the site rule) instead of the test page's #141414 / #f1f1f1, so on black the shadows don't show.
- Tap no longer drops the title (a background tap must do nothing); double tap does, and a tap on a letter breaks it.
- No orbit drag (the site has no camera control on other posters).

**Reference.** mrdoob, Codevember 2026 / 02 "Shatter" (MIT, https://mrdoob.github.io/codevember-2026/02/). Ideas taken, own code: solid glass with real thickness (thick parts darker, Beer-Lambert), a little dispersion, a seamless studio floor with a pool of light, pieces cut as closed solids, momentum kept at the split (no outward blast), a break threshold, a pile that stays. He tried letters and went back to primitives; this does letters.

**Idan's choices (3 Nov 2026).** What falls: the title's letters. The floor: a seamless studio floor (his look), chosen knowingly over the "no name in a scene" rule; worth checking whether it holds once seen.

**The idea.** The album title in thick clear glass. The letters fall one after another onto a seamless floor. A letter that lands hard breaks where it touches: the bottom stops, the rest keeps falling into it, so the break climbs the letter. A gentle landing doesn't break it; it bounces and lies down whole. The pieces stay, so each drop adds to the pile.

**How it works (test page).**
- Type: Archivo Black (embedded, Artifact pages can't fetch fonts), contours triangulated and extruded; Explode slomo's fracture (2D Voronoi cells clipped to the glyph, extruded, break faces in their own material), seeds crowded toward the contact point.
- Physics: own small rigid-body solver, floor only (no piece-on-piece contact yet): gravity, vertex contacts with restitution and friction, sleep. Pieces inherit the letter's velocity at the split plus a small kick near the contact.
- Look: three.js MeshPhysicalMaterial glass (transmission, thickness, attenuation, dispersion), black studio environment for highlights, spot pool of light on the floor, fog to the background so the floor has no edge.
- Gestures: tap drops the title again onto the pile; drag orbits. `window.poster.advance(s)` steps the simulation for tests.

**Open (for Idan).** Dark or light studio. Letters one by one or all at once. Whether pieces need to collide with each other (a real pile) — expensive. What a hold does (rewind?).

**v1 (3 Nov 2026), https://claude.ai/artifact/En7HEEatXhydpPVfYexUUF.** Physics works (fall, break at the contact, pieces settle, the pile stays). Look lessons on the way:
- Clear glass only reads as glass against contrast. On an evenly lit floor it looks like grey plastic. What worked: a dark floor, a tight soft pool from a spot straight above and just behind the title, thin very bright strips in the reflection studio.
- In three.js r170, `scene.environment` lights a MeshStandard floor regardless of its `envMapIntensity`, which flattened the pool. The floor is MeshLambert now (no environment light).
- Camera pitch about 15 degrees: lower and the flat pieces only mirror the black above; higher and the pool fills the frame.
- Defaults: drop height 2.4, breaks above 6.4 (most letters still break; corner hits add spin speed).
- Headless check: Playwright on the real GPU (`--use-angle=metal`) and `window.poster.advance(s)` (max 1 s per call).

**v2 (3 Nov 2026).** Idan's tuned values are the defaults (Kind of Blue, all at once, thick 0.61, clearness 1.85, fringe 1.05, reflections 3, 41 pieces, kick 2.2, bounce 0.67, friction 0.36, time 0.27). His asks:
- Loop: the title drops again every 9 s (real seconds; 0 = only on tap).
- Pieces vanish 5 s after the break: they shrink away where they lie; anything resting on them wakes and settles.
- Real pile: pieces collide with each other (outline points against the other solid's exact outline, pushed out through the nearest face; spatial grid). Siblings from one break ignore each other for 0.15 s and edge tests have a small margin, or shared faces shove them upright into spikes. Letters can also break on the pile.
- Some letters land whole: 30% by default ("Letters that land whole").
- Cost: about 8 ms per physics step with ~400 pieces (M4 Pro); at time 0.27 that's one step a frame. Phones untested.
- v2.1: shrinking away didn't feel physical (Idan). Now the floor lets go under an expiring piece: no floor contact, a slight tumble, gravity takes it through and the opaque floor hides it; pieces resting on it wake and follow or settle.
- Defaults (3 Nov 2026, Idan, same for light and dark): thickness 0.37, clearness 2.7, fringe 1.2, IOR 1.59, loop 14.5 s, pieces vanish after 5.5 s; the rest as v2.
- v2.3 narrow screens (width/height < 0.9), Idan's ask: the camera frames one letter's width so letters stay big, and the letters drop one at a time into the middle (1.6 s apart, setting "Narrow screens: time between letters"), each landing on what's left of the one before. The loop waits until the last letter has had its time.
- v2.4 (Idan: "get rid of the arena shade"): no spotlight pool, falloff or horizon. Even directional light from above-front, the floor is a ShadowMaterial over a flat page colour (light #f1f1f1, dark #141414 so shadows still show). The glass now has only reflections to work with: black glass with glints on dark, pale and quiet on light.
- Idan kept the seamless page (3 Nov 2026).
- v2.5 (Idan): instead of vanishing, pieces slide away as if down a slope. When their time is up the floor tilts under them (ramping in over 1.5 s), friction drops to a quarter and they slide downhill (default away from the camera, slope 0.3); removed once 40 units out. Settings: Then they (slide away / sink through the floor), Slope, Downhill is (away / left / right / toward you).
- v2.6: "it stopped shattering". Cause: letters hit the floor at 6.7-7.1 against a break threshold of 6.4, so small differences (corner hits, frame rate) tipped letters into staying whole. Since "Letters that land whole" now decides survivors, the threshold default is 4.5 (about 7 of 10 letters break every drop). Pieces drift toward the camera (Idan).
- v2.7 (Idan): a simple dissolve instead of drifting. When its time is up a piece gets its own copy of the glass and fades out where it lies over 1.4 s ("Dissolve takes"); its shadow goes about a third of the way in; it keeps holding up what rests on it until it's gone. Slide and sink stay as options.
- On the site's pure pages (Idan chose to keep them, 3 Nov 2026): on white the glass washed out to pale plastic, so on the light page the glass is smokier (attenuation distance x0.22, exposure x0.7) and its reflections are dark; on black a falling letter's front reflected only black, so the dark page's reflection studio has a soft panel behind the camera and a faint grey ground. Menu preview uses the dark page.
- Each letter starts just inside the top of the frame, already moving as if it had fallen from the full drop height: the same impact, and something is on screen from the first frame (the gate's blank-canvas check on a phone).
- Gate: 17/17 (3 Nov 2026), run against a Node static server because python can't read ~/Documents from this session.
