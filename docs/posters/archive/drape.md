# Drape

**Status:** built and removed on 5 October 2026, in a single round. Idan: "too soft as a geometry". Code: git history at commit `90a158a` (`src/posters/drape.js`). Replaced by Skyline.

**Concept.** Flat "Idan / Segev" projected onto a cloth stretched over hidden balls. Head-on it is flat (the camera starts at the projector); move the view and the print slides over the lumps and gives the balls away.

**How it worked.** The cloth was a height field (a damped wave equation, pinned at the edge, like a drum skin) simulated on the CPU at 120 Hz and uploaded each frame as a float texture, drawn from a grid laid out in the vertex shader. Six to eight spheres were small rigid bodies on a hidden floor; wherever one reached through the cloth it held it up. Touch near one and it jumped and rolled. About 1 ms a frame.

**Why it failed.** A membrane has smooth tents and no folds or edges; the projection reads as weak when nothing cuts the print. The lesson that shaped Skyline: the hidden geometry must be hard-edged so the print is visibly sliced and displaced at every edge.
