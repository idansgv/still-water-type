# To-do before release

Status as of 29 Oct 2026. Tick items off here as they land.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Slinky: composition, possibly the font, and the coil colour | Open | Needs Idan's target for composition and colour |
| 5 | Make it clear that a click clears a poster | Open | Needs copy and placement from Idan. Most posters use a single tap for something else, so the clear needs a home that doesn't clash |
| 6 | Torn: look better and fix performance | Done | Letters sleep when still (solver about 35 ms to about 1.3 ms while one letter is dragged, 0 at rest). Starch keeps each untouched letter in shape, so SEGEV no longer hangs as SFCFV
| 8 | Share image: improve it | Done | Each published poster has its own share image (`assets/og-<slug>.png`, made by `tools/og-posters.cjs`), with a per-poster alt text
| 10 | Review every poster: click clears, and double tap has an effect on the letters | Open | Audit table below. Needs a run of each poster to confirm |
| 13 | Customize interaction: more posters take the visitor's name | Mostly done | 14 of 19 take it. Still Idan-only: Collapse, Explode, Metal, Slinky type (letters built as physics bodies) and Brandbook. Known: Fan clips accents above the capitals; Soft type drops accents (its letters are hand-drawn skeletons, now the full A to Z) |
| 14 | Customize share: the name in the share preview | Done | Live and checked: a link with `?n=` gets its own title and a preview image of the name in the poster's face (`middleware.js`, `api/share.js`, `api/og.js`) |

**Proposals (not built, for approval)**


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
