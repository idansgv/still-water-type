# Progress log

A running summary of the poster work, newest first. The detail lives in `docs/posters/<slug>.md`, the process in `docs/PIPELINE.md`, the interactions in `docs/INTERACTIONS.md`.

## 14 to 18 Oct 2026: Slinky, colour, new ideas, the workflow tools

**Published or locked:** Slinky type (Bungee Inline, locked), Marbled and Glint (published 17 Oct, passed the full gate; pulled back to draft later for the launch set, see `git log`).

**Colour, rarely** (`src/colour.js`): about 1 showing in 20, never twice in a row, black and white until the poster's own wake-up; a bright palette set on dark pages, a deeper set on light. Each poster colours one thing (see PIPELINE.md, "Colour"). What wakes each one: `tools/colour-scenes.cjs`.

**Workflow tools:** `npm run shot -- <slug>` (contact sheet), the settings panel's Save as defaults (`src/posters/params/<slug>.json`), `npm run test:quick`, `npm run colours`, `npm run ship -- <slug> [-m msg] [--push]`.

**New-idea rounds** (private Artifact test pages; sources in `docs/posters/prototypes/`):

| Idea | State |
|---|---|
| Splat type | parked (`splat.md`) |
| Glint | loved, ported as a draft poster |
| Portal type | tested, not chosen yet |
| Marbled | loved, ported as a draft poster |
| Pin screen | discarded: no moment of surprise |
| Unravel | string behaviour loved; now a running stitch in monoline faces, a new face each peel |
| Golden hour | volumetric light study, first take shared |
| Rigged / Torn | cloth on strings (other session) |

Untried: Gravity scale, Poster foundry (headless PlayCanvas), Iron filings, Peel.

**Open:** Glint on a white page (inverted negative: weakest look); a `new <slug>` scaffold; collapse `portfolio-v1` and `main` into one branch; the full test suite takes about 11 minutes with 11 posters (consider a per-poster gate in CI).
