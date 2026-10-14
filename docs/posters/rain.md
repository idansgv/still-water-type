# Rain

**Status:** published 2026-10-14. Test at `/?p=rain`.

**Brief (Idan).** Source: metalforge.xyz/drench (black jacket on orange; each drop leaves a mark). "Think of a 3d text that's the same color as the background and gradually rain is mark making on it in color / black." Word: Idan Segev. Black and white as always. Marks accumulate (no fade). Rain follows the cursor; a press makes it pour heavily.

**What it does.** The word is extruded 3D type in exactly the page colour, so it is almost invisible; only the tops and sides are tinted a few per cent. Rain falls where the cursor is. Every drop that lands leaves a splatter on the surface it hit (front, top or side), and the marks stay. A press pours. Double tap dries the word again.

**How.** An extruded type mask ray-marched in the fragment shader (orthographic camera). Drops are simulated on the CPU, slanted straight falls tested against the same mask. A hit is stamped into paint: a 2D picture for front faces and a small 3D volume for tops and sides. The shader reads the paint through a noisy threshold (splatter edges). Rain streaks are GL lines.

**Font.** Leida (local trial files only) with Bitter as the live fallback, the same pair as Still Water. The saved settings were tuned with Leida; on the live site Bitter stands in at the same weight. Any Google font can be typed into the panel.

**Settings (panel).** Type, 3D depth, camera, tone (light, body shade, tint, gloss, streaks), rain, marks, behaviour.

**Open.** Not tested by hand on a phone; dark theme not yet looked at by Idan. Marks are round blots: more elongated splashes and drips were not tried.
