# To-do before release

Status as of 29 Oct 2026. Tick items off here as they land.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Slinky: composition, possibly the font, and the coil colour | Open | Needs Idan's target for composition and colour |
| 2 | Marbled: change the font | Open | Needs Idan's pick of font |
| 3 | Shuffle order: Still Water first more often | Done | About 55% of visits open on Still Water (`12e711a`) |
| 4 | Dark-only posters (Glint, Glitter, Moonlit, Goblet) only on black turns | Done locally | `src/main.js`: pool filter in `pickOther` and `pickFirst`. Checked over 25 shuffles in the browser. Confirm which poster "Sparkles" is |
| 5 | Make it clear that double tap clears a poster | Open | Needs copy and placement from Idan |
| 6 | Torn: look better and fix performance | Open | Investigate performance first |
| 7 | Rename the watercolour poster to Wash | Done locally | Title changed in `src/posters/index.js`. Slug stays `wash-script` so the live share link keeps working |
| 8 | Share image: improve it | Check | `69c9240` already changed it to an Idan Segev wordmark. Check whether that's what Idan wanted |
| 9 | Glint: double tap for a moon reveal, or a silent lightning and thunder effect | Open | Assumes "glow" means Glint |
| 10 | Review every poster: double tap clears, and double tap has an effect on the letters | Open | Covers all published posters |

Also pending: the name feature (`0564db4` on `portfolio-v1`) is committed locally and not pushed. Pushing deploys to production.
