# Headbang

**Status:** published 2026-11-05. Test at `/?p=headbang`. Poster: `src/posters/headbang.js` (settings: `&tune`). Test page: https://claude.ai/artifact/41ErYe8fR7Wt6JiUquYD8S, prototype `docs/posters/prototypes/headbang.html`.

**What it is:** the name grown into a symmetric metal-band logo, procedurally: antlers (or thorns, roots, wings) sprout from the letter edges, mirrored about the word's centre and melted into the letters with Embers' blur + threshold. Pirata One.

## Interactions (site)
- **Load:** the logo grows once (the self-demo). Nothing moves at rest; under reduced motion it is grown at once.
- **Tap:** another style (antlers, death thorns, black roots, wings, brutal) and a new seed.
- **Drag:** left/right turns the hooks; down/up drips or raises the beams. Live.
- **Hold:** a new antler (and its mirror) grows from the nearest letter toward the finger for as long as it is held; it follows the finger.
- **Double tap:** takes the last antler back (a beat later, so a third tap can still mean reveal).
- **Three taps (reveal):** the seeds on the letter edges, each joined to its twin across the dashed mirror axis.
- **Headbang (easter egg):** shake the phone (iOS asks for motion access on the first touch) or scribble fast left and right. The page, and only the page, tears down the mirror axis onto blood red `#a3080c` (the logo turns black), with a crack, flung halves, a screen shake, a logo punch and one flash frame; again to tear back. Red is Idan's exception to black and white (5 Nov 2026).

## The development log (from the test page)

**Status:** idea, test page (5 Nov 2026): https://claude.ai/artifact/41ErYe8fR7Wt6JiUquYD8S. Prototype: `docs/posters/prototypes/metal-logo.html`.

Idea (Idan, 5 Nov 2026), from death/black metal band logos, and it grew out of Embers (the blob strands). It has to be procedural.

**Concept:** the name grows into a symmetric metal-band logo. What makes those logos read as metal: mirror symmetry (faked, since letters aren't symmetric), tapered, hooked spikes from the stroke ends, a direction for each style (thorns, roots and drips, wings), and only just being legible.

## How it works
- Distance field of the name (Embers' EDT). Seeds are edge cells weighted by facing (tops, bottoms, outer sides) and by distance from the centre.
- One agent per pair is simulated on the left. Its twin is drawn mirrored about the word's centre, offset to the nearest matching edge on the right, so the ornament is exactly symmetric while the letters are not.
- A spike is a stream of discs (MAX blend) whose radius tapers along its length. It turns by a hook that grows toward the tip (bent outward by default), Perlin wiggle, a pull to vertical, drip and fan-out. It branches at random points. The outer letters grow longer spikes (wings).
- Legibility: seeds aimed into a counter or at the next letter are rejected. Spikes steer around other ink and stop if they still hit it.
- An optional centre spike (dagger) on the axis, with mirrored branches.
- Finish: Embers' blur + threshold ("Melt") gives the joins fillets.

## Gestures (test page)
Load grows it once. A tap grows again with a new seed. A double tap moves to the next style (death, black, wings, brutal). Holding keeps sprouting more pairs. Nothing moves at rest.

## Open
Which style, the base face (Inter Tight vs blackletter options), the drag gesture (a spike reaches toward the pointer and its mirror the other way), and the reveal.

## Antlers (5 Nov 2026, Idan's ask: "thorns as antlers with a bit of a bone structure")
New default style, and an "Antler structure" toggle that works on any style. Each spike becomes a main beam that tapers slowly to a rounded tip ("Blunt tips"). It carries a set number of tines ("Tines per beam") spaced along it, the first one (the brow tine) near the base, all rising from the same side of the beam (the side heading further along the beam's own up or down). A tine may fork once. A bone texture comes from a knuckle swelling at each joint ("Knuckles"), a burr (a ring of knobs) where the beam leaves the letter, and low-frequency bumps in the width ("Bony bumps"). Preset: 12 pairs, length 1.3, width 0.13, taper 0.6, 3 tines, angle 48°, blunt 0.28, bumps 0.12, knuckles 1.25, no small thorns. Saved settings moved to a new key (`metal-logo-2`).

## Idan's defaults (5 Nov 2026)
`{"genre":"antler","face":"pirata","axis":true,"soft":0.04,"size":0.5,"grow":1.6,"antler":true,"tines":3,"blunt":0.28,"gnarl":0.12,"knuckle":1.25,"pairs":193,"thorns":9,"len":2,"lenVar":0.63,"width":0.085,"taper":0.6,"wing":1.5,"up":1.05,"down":0.3,"side":2.05,"curve":0.85,"outward":1,"wiggle":0.25,"vert":0.7,"gravity":0.73,"fan":0.45,"branch":0,"bAngle":48,"bScale":0.72,"melt":0.9}`
Next: make the interactions more rewarding (his ask).

## Kaleidoscope (5 Nov 2026, Idan: "a metal band type kaleidoscope, given the symmetries")
A metal logo is already one mirror; the kaleidoscope adds more. The antlers render into their own buffer. A composite pass folds them into a wedge about the name's centre (2π/N sectors, mirrored), clears them from around the letters (the name's distance field as a texture, "Clear around the name"), lays the unfolded name on top, then runs Embers' blur + threshold as before.
- **Drag:** turns the tube. The pointer's angle about the centre turns the mirrors, and pulling outward zooms in. The first drag switches it on at "Mirrors on first drag" (6). A flick coasts to a stop ("Spin friction").
- **Double tap:** plain logo, then 3, 4, 6, 8 mirrors, then back to plain (replaces next style; style is now Settings only).
- **Tap:** regrows the bones; the pattern changes with them. **Hold:** still sprouts more.
First look: six skull-like shapes formed in a ring around the name, which stayed readable.

## Twist replaces the kaleidoscope as the drag (5 Nov 2026)
Idan: the kaleidoscope "has to keep the metal logo type structures". Folding pixels cuts the antlers off at their roots, so the symmetry has to come from the growth instead. Growth is now deterministic per seed, so the same seed always gives the same logo. Turning the drag around the name's centre adds a twist to every beam's starting angle (the mirrored twin twists the other way), and pulling outward stretches the beams. The logo regrows in one go every frame (about 9 ms on desktop), so it reshapes live and is always a valid, rooted, symmetric logo. Double tap goes back to the next style; tap = new seed; Settings: "Twist per turn", "Pull to stretch", Untwist. The old pixel fold stays as an off-by-default Settings toggle ("Fold into mirrors") for comparison.

## Each axis drives one attribute (5 Nov 2026, Idan's ask)
The drag no longer twists around the centre. Horizontal movement drives one attribute and vertical movement another; a sweep across the whole screen covers the whole range (times "Sensitivity"), and the logo regrows live from the same seed. Defaults: left/right = Hook (straight to curled), down/up = Rise/drip (up: the beams grow skyward like a crown; down: they hang and drip, so negative "Drip" means rise). Either axis can instead drive length, tines, thickness, fan out, wiggle, tine angle or twist (Settings → Drag). Values are saved when the drag ends; the sliders follow the drag.

## Tap shuffles the style, hold adds a node (5 Nov 2026)
- **Tap:** a random different style plus a new seed (it used to keep the style).
- **Drag:** each axis tweaks its attribute, as before.
- **Hold:** adds a node. After 250 ms, an antler (and its mirror) grows from the nearest left-hand letter edge toward the finger (a finger on the right is mirrored to the left). It keeps growing while held ("Hold: node growth speed"), follows the finger if it moves, and gets tines and knuckles like any beam.
- **Double tap:** takes the last node back. Settings: "Clear nodes".
- Each spike now carries its own random stream, so adding or removing a node never reshapes the rest of the logo. Nodes are cleared when the words change.

## Easter egg: blood red (5 Nov 2026, Idan's ask)
Three quick taps toggle black bones on #FF1111 (faded in over ~0.3 s); three more go back. Taps are now counted and acted on once they stop (380 ms): one = shuffle style, two = take the last node back, three = blood red. **Conflict when porting:** triple tap is the site-wide Reveal (`src/posters/reveal.js`; the shell also inverts the page, which would turn the red cyan). The proposed site gesture is a headbang: shake the phone (`devicemotion`) or scribble fast on desktop. Idan to decide.

## Easter egg: blood red (5 Nov 2026, Idan's ask)
Three quick taps toggle black bones on #FF1111 (faded in over about 0.3 s); three more go back. Taps are now counted and acted on once they stop (380 ms): one = shuffle style, two = take the last node back, three = blood red. **Conflict when porting:** triple tap is the site-wide Reveal (`src/posters/reveal.js`; the shell also inverts the page, which would turn the red cyan). The proposed site gesture is a headbang: shake the phone (`devicemotion`) or scribble fast on desktop. Idan to decide.

## Headbang: headbang + tear (5 Nov 2026)
Idan named the poster **Headbang** (first published as "Handbang" by mistake on 5 Nov 2026; `/p/handbang/` redirects here) and chose shake over triple tap (which stays the site's Reveal). Shaking the phone (4 jolts within 0.9 s, `devicemotion`; iOS asks for motion access on the first touch) or scribbling fast left and right during a drag (5 direction flips at > 900 px/s within 0.9 s) toggles blood red. The change tears the page down the logo's mirror axis: the two halves rotate away from their top outer corners and fall, each carrying the old scheme and half the logo, with a grey torn-paper core along the jagged edge, while the new scheme lies underneath. This works both ways (black to red, red to black). Settings: Shake sensitivity, Tear time (0.9 s), "Headbang now". Under reduced motion it switches without the tear. The file keeps its name (`prototypes/metal-logo.html`) so the test link stays the same.

**Update (5 Nov 2026, Idan):** only the background tears. The logo stays in place and whole, inked white over the old (black) page and black over the new (red) one as the tear opens. Deeper red: `#a3080c` by default, with a "Blood colour" picker in Settings.

**More aggressive tear (5 Nov 2026, Idan asked):** in 0.45 s (was 0.9). Over the first 18% a thin crack zips from top to bottom. Then the halves are flung apart (cubic ease-out, 0.75 of the width, rotating 0.55 rad) and fall (quadratic drop). On impact the view shakes (18 px, decaying over ~0.3 s), the logo punches out (+12%) and one frame flashes white. The rip has serrated teeth. Each of these has a slider: Tear time, Serrated edge, Screen shake, Logo punch, Flash. The setting is `tearS` (a new key, so stored values from before don't keep the old 0.9 s).

**Shake sensitivity default 2.3** (Idan, 5 Nov 2026). Idan: "we're good" with the test page as it stands.
