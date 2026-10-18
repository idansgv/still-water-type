# Glint (parked for refinement)

**Status:** draft. Published 2026-10-17, pulled from the launch set 2026-10-18: needs more refinement first.

**Brief (Idan, 17 Oct 2026).** Picked from five ideas after the PlayCanvas v2.23.0 release ("let's try 3"): solid black type on black, nearly invisible, seen only where a small low lamp catches the edges of the letters, with a bloom. Then: "Can we make volumetric light so strong that it's visible?"

**Test page:** https://claude.ai/artifact/RJ6YeuNsxcbNHm9e7sNP2z (source: `docs/posters/prototypes/glint.html`, WebGL2, no library). The name is a bevelled height field; the lamp follows the pointer (it drifts on its own until then); the edges facing it glint, with a bloom; the air is lit by a screen-space light-scattering pass, so beams spread from the lamp and the letters throw shafts of shadow away from it. Settings: light in the air, lamp height, reach, glint sharpness, bloom, bevel, how much the face shows, and the colour easter egg.

**Open:** a light-page version (the site alternates black and white); whether the lamp is the cursor or something you place; touch on a phone (the lamp follows the finger).

**Parked for refinement (17 Oct 2026).** Idan: "Looks amazing. Park it for refinement."
