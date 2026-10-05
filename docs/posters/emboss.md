# Emboss

**Status:** draft, **rejected** ("sucks"). Do not revisit. File: `src/posters/emboss.js` (still in the repository; `?p=emboss` loads it).

## Concept
Paper that is flat, mostly. The type ("Flat. / Not entirely.") is blind-embossed: the same tone as the paper, shown only by relief. The cursor is a raking light, so shadows and highlights slide across the letters; a pressed finger dents the soft stock, and the paper slowly relaxes.

## What is underneath
A height field built from the type mask, finite-difference normals, a point light held low over the surface, and a little paper tooth.

## Why it was rejected
Simulated lighting on a surface made an effect applied to type, not a material the type lives in. It sat well below Still Water's elegance. The lesson is recorded in the project doc: prefer physical, familiar materials behind the type, where the response has memory.
