# To-do before release

Status as of 29 Oct 2026. Tick items off here as they land.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Slinky: composition, possibly the font, and the coil colour | Open | Needs Idan's target for composition and colour |
| 2 | Marbled: change the font | Open | Needs Idan's pick of font |
| 3 | Shuffle order: Still Water first more often | Done | About 55% of visits open on Still Water (`12e711a`) |
| 4 | Dark-only posters (Glint, Glitter, Moonlit) only on black turns | Done | `src/main.js`: pool filter in `pickOther` and `pickFirst`. Checked over 25 shuffles in the browser. Confirm which poster "Sparkles" is |
| 5 | Make it clear that double tap clears a poster | Open | Needs copy and placement from Idan |
| 6 | Torn: look better and fix performance | Open | Investigate performance first |
| 7 | Rename the watercolour poster to Wash | Done locally | Title changed in `src/posters/index.js`. Slug stays `wash-script` so the live share link keeps working |
| 8 | Share image: improve it | Check | `69c9240` already changed it to an Idan Segev wordmark. Check whether that's what Idan wanted |
| 9 | Glint: double tap for a moon reveal, or a silent lightning and thunder effect | Open | Assumes "glow" means Glint |
| 10 | Review every poster: double tap clears, and double tap has an effect on the letters | Open | Covers all published posters |

Also pending: the name feature (`0564db4` on `portfolio-v1`) is committed locally and not pushed. Pushing deploys to production.

## Audit (item 10): double tap, from docs/INTERACTIONS.md

Source: the doc's own rows, not a run of each poster. "Clears" means the double tap resets or empties the poster. "On letters" means the double tap visibly acts on the letters.

| Poster | Double tap today | Clears | On letters |
|---|---|---|---|
| Still Water | none listed | no | no |
| Soft type | none listed | no | no |
| Collapse | re-forms (empty space) | yes | not listed |
| Explode | re-forms (empty space) | yes | not listed |
| Splintered | re-forms, camera home | yes | not listed |
| Goblet | every letter refills | partly | yes |
| Metal | re-forms (empty space) | yes | not listed |
| Slinky type | not in the doc | check | check |
| Fan | none listed | no | no |
| Rain | dries the word again | yes | no |
| Fontapalloza | none listed | no | no |
| Marbled | starts again | yes | no |
| Glint | none listed | no | no |
| Splat type | pulls everything home | yes | not listed |
| Wash | blots up, writes again | yes | yes |
| Brandbook | not in the doc | check | check |
| Crystallize | starts over | yes | no |
| Torn | floor opens, fresh set | yes | not listed |
| Moonlit | calm | no | no |

Gaps: Still Water, Soft type, Fan, Fontapalloza, Glint and Moonlit have no clear. Most posters have no letter effect. Next step: run each poster and check the double tap by eye, then decide the per-poster effect with Idan.
