# Shadow: the brief (read this before touching `shadow.js`)

Written 10 Oct 2026 after Idan said "I feel like you're not listening to me." Everything below is his, in his words and order. The code history shows the opposite of listening: five different posters in a row, each a guess pushed before it was agreed. **Rule for the next session: no code and no push until the target image below is agreed.**

## His words (verbatim, in order)
1. "Poster idea: Letters shown are actually the shadow of random shapes carefully organized so to the shadows they cast creates the typography. Consider user interactions etc."
2. (Two reference photos) "You didn't get me right. See these."
3. "Shapes should be larger. More carefully selected and placed in the space. Light should be directional casting long shadows."
4. "Think of it as a sculpture planned to be elegant and bold planned carefully by the shadow it casts. Every bit the sculpture is made of should have a distinctive impact on the shadow so that when it moves the shadow will be affected noticeably. At first glance the fact that letters are cast shadows should be invisible to the viewer."
5. "Better but 1. Place them close or on the plane of the shadow. Have curved shapes as well to cast rounded shapes wherever needed."
6. "You don't seem to consider the images I sent. See the type of shapes and the distribution there."
7. "Not cloud. Should lay on the plane."
8. "Also less shapes larger and bulkier."

## The references (local only: `docs/posters/shadow-refs/`, git-ignored, someone else's artwork)
Kumi Yamashita style wall pieces. My reading of them, to confirm with Idan before building:
- **Shapes:** wooden toy blocks only: cylinders (lying), half-rounds, cubes, planks, wedges. Chunky, individually distinct, mounted on the wall.
- **Scale:** the blocks are small next to the silhouette (a face or a running figure about 10 blocks across). The image is a big solid shape; the blocks are its grain.
- **Distribution:** blocks lie close to the wall surface, densest over and beside the silhouette, thinning and scattering away toward the light. Not a 3D cloud.
- **Shadows:** one directional light from the side/above; where blocks are many the shadows merge into one solid dark mass with a clean edge; at the edges and among strays, single block shadows are visible next to their blocks.

## Requirements as a checklist
- [ ] Letters are made only of cast shadows of blocks. No printed type.
- [ ] Block vocabulary and distribution as in the references (above), lying on or close to the wall plane.
- [ ] Fewer, larger, bulkier blocks; curved shapes where a curve is needed.
- [ ] One directional light, low, long shadows.
- [ ] Every block matters: remove it and its piece of the shadow is gone; moving the light moves each piece noticeably.
- [ ] Elegant and bold, planned, not scattered.
- [ ] At first glance the viewer reads typography, not "shadows of blocks".
- [ ] Interactions considered (what exists today: light follows pointer, tap spins a block, double tap new plan, three taps reveal, hint swing). Idan has not yet commented on these.
- [ ] House rules still apply: black and white only, no instruction text, no idle motion except the one self-demo, the standard in `docs/PIPELINE.md`.

## The real design problem (my diagnosis, to put to Idan)
In the references the silhouette is about 10 times the width of a block. Here a letter stroke is about one block wide, so letters cannot be built cleanly from blocks of that size, and bulky blocks with long shadows fuse the counters of D, A and G. Options to put to him, with a mock of each before any code:
1. **Much heavier letterforms** (stroke at least 3 blocks wide, solid like a silhouette) and blocks smaller relative to them.
2. **Larger letters, fewer of them** (for example one word at a time, or IDAN / SEGEV on two lines at a far bigger scale).
3. **A lower light** only if the letters can stay open; long shadows and legibility pull against each other.

## What exists (draft, not published, not in the shuffle)
`?p=shadow`, `src/posters/shadow.js`, last commit `fa97b54`. It has: a mask-based block solver (outline first, scores each candidate's real shadow polygon, rejects redundant or spilling blocks), a toy-block vocabulary, a low directional light, the interaction set above, a reveal view, and it passes the gate (`node tools/graduate.mjs check shadow`). Earlier versions are in git: `b77ce8d` and `865085c` (a frame of beams and tubes, one per stroke; not what Idan asked for). Nothing here is approved.

## How to work on this (the rhythm Idan wants)
1. Re-read this page and look at the two reference images with Idan's notes beside them.
2. Make **one still image** of the intended result (a mock, not the poster) and show it with the single decision it needs. Wait.
3. Only then code, in small steps, checking each against the references, not against the previous attempt.
4. Answer in a few lines. No long reports. No pushing drafts, no publish, without his yes.
