# Embers

**Status:** published 2026-11-05. Test at `/?p=embers`.

Idea taken from github.com/prinzipiell/tsl, *Ember Flow*. The repo has no license, so only the idea is used; the code is our own.

**Concept:** the strands of Strands (a few thousand curl-noise threads held inside the letterforms), but the glowing trails are blurred and thresholded like a metaball field, so neighbouring strands merge into soft white blobs: the name as a slow lava lamp. Black page only.

**The surprise:** a tap lets go of the hold; the blobs break up and drift out into the black, then are drawn back and merge into the letters again.

## Interactions
- **Drag:** stirs. **Tap:** lets go, then they are drawn back. **Hold:** a gust, faster and brighter. **Double tap:** calls them back at once. **Load:** one release, until the first touch.

## How it works
- Strands' simulation unchanged (full-page distance field from Inter Tight 600, curl-noise particles, walls while held, pull back outside).
- Render: line segments into a fading float trail buffer, then repeated small Gaussian blur passes at half resolution (wide taps alias into stripes), then a smooth threshold. Options: blob size, threshold, edge softness, strands on top, outline only.

## Idan's defaults (5 Nov 2026)
`{"blob":2.9,"th":0.95,"soft":0.07,"mix":0,"count":8300,"speed":1.18,"curl":1.15,"evolve":0.5,"life":4.6,"trail":1.18,"bright":2.23,"gain":1.6,"spark":0.66,"wall":1.45,"push":0.45,"away":3.1,"back":0.5,"pull":1.5,"stir":0.65,"blow":1.2}`

## Open questions
- The flow moves at rest (idle motion): Idan's call, as with Jet.
- Reveal (three taps): the distance field's contours and every strand (site version only).
