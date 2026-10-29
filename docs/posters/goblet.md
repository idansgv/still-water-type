# Goblet

**Status:** published 2026-10-29 (draft the same day). Live at `/p/goblet/`; settings with `?p=goblet&tune`.

**Brief (Idan, 29 Oct 2026).** "Letters are vessels for liquid. They're round, chubby and cute. The liquid (ink) spills out when interacting." Reference: MinionsArt's Unity liquid shader (patreon.com/minionsart/posts/unity-liquid-18245226): liquid in a container whose surface wobbles when the container moves (look and behaviour only, no code). After a 2D first take he asked for "3d vessels and liquid behavior"; he tuned the 3D test page on black and named it Goblet ("p&p call it goblet").

**Test pages:** `docs/posters/prototypes/inkwell.html` (3D, https://claude.ai/artifact/B6CPiytE6bGGzeoeBBx7FW) and `inkwell-2d.html` (the first 2D take, particle ink in outlined glass).

## What it is
"Idan Segev" in Fredoka 700, every letter a chubby glass bottle (a deep rounded bevel, a small neck and lip on its highest point), about 58% full of white ink on black. At rest it is still. The type is the object; the camera sits 9 degrees above so the ink's surface reads.

## Interactions
- **Drag a letter:** you carry it from where you grabbed it, and it hangs from there under gravity; moving it swings it a little in 3D and the ink sloshes.
- **Hold it by its foot:** it swings upside down; once its neck is under the ink, the ink pours out as drops that fall off the page.
- **Release:** springs home upright and wobbles. **Tap a letter:** a jiggle. **Tap on background:** nothing. **Hold:** no action of its own.
- **Double tap:** every letter fills up again (after the re-form beat).
- **Reveal (three taps):** each letter's ink surface as a line with its fill, the neck, and which way is up for the ink.
- **Self-demo:** once, after 3.5 s untouched, the S is nudged and sloshes. Reduced motion: no demo, letters full at once.

## How
`src/posters/goblet.js`, three.js 0.160 (vendored). Outlines from `glyph-contours.js` (Fredoka from Google Fonts, the name's letters only), extruded twice: glass (MeshPhysicalMaterial, transmission) and the ink, smaller by the glass's thickness. The ink's shader discards above a plane and paints back faces as the liquid's top (the MinionsArt trick). The plane's height is the fill quantile of about 1,400 volume samples along its normal, so the ink keeps its volume at any angle; its normal is a damped spring toward the felt gravity (wobble). Each letter is a rigid body on a spring home; held, it hangs from the grip. When the neck is below the surface the fill drops and instanced drops are thrown. Idan's tuning is `DEF`: fill 0.58, wobble 0.7, settle 0.12, slosh 0.8, pour 1.2, spring 0.6, tint 0.36.

## Open
Ink seen through the glass reads a little grey; drops leave in small clumps rather than a stream; spilled ink falls off the page (stain, pool, or pour into other letters?). Not measured on a phone; transmission is the heavy part.
