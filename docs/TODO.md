# To-do before release

Status as of 29 Oct 2026. Tick items off here as they land.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Slinky: composition, possibly the font, and the coil colour | Open | Needs Idan's target for composition and colour |
| 5 | Make it clear that a click clears a poster | Open | Needs copy and placement from Idan. Most posters use a single tap for something else, so the clear needs a home that doesn't clash |
| 6 | Torn: look better and fix performance | Partly done | Rest skip is live (`71c052e`), unmeasured. Still to do: the full-canvas copy each frame while moving, and the look |
| 8 | Share image: improve it | Check | `69c9240` already changed it to an Idan Segev wordmark. Check whether that's what Idan wanted |
| 9 | Moonlit: double tap for a moon reveal, or a silent lightning and thunder effect | Open | Corrected from Glint. Proposal below |
| 10 | Review every poster: click clears, and double tap has an effect on the letters | Open | Audit table below. Needs a run of each poster to confirm |
| 11 | Crystallize: auto reboot after a delay | Open | Needs Idan's delay and whether it restarts the cells or the whole poster |
| 12 | Glint: add a click interaction | Open | Proposal below |
| 13 | Customize interaction: more posters take the visitor's name | Open | Only Still Water takes it so far. Each poster opts in with `nameable: true` and needs its letters drawn from `stage.words` |
| 14 | Customize share: share a customized poster with the name | Open | The share link carries `?n=` for Still Water. Check that the share page and its preview carry the name too |

**Proposals (not built, for approval)**
- **Moonlit, double tap:** a silent lightning flash. The whole sea goes white for two frames, the letters go dark in the flash, then a rumble of ripples rolls out from the tap point over about 1.5 s. No audio.
- **Glint, click:** a click drops a stone into the water. A ring of ripples spreads out from the click, and each glint it passes flares for a moment before it settles.


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
