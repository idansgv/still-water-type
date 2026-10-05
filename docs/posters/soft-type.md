# Soft type

**Status:** live, in the shuffle. File: `src/posters/soft-type.js` (letters from `lettering.js`). Link: `idansegev.com/p/soft-type/`.

## Concept
"Idan / Segev" as thick black strokes on white, plain at rest, a soft elastic material underneath: drag it, squash it, fill a letter with air until it rockets across the page or bursts.

## At rest
Black on white (85% of loads; dark 15%), the name set in thick round-capped strokes. Each visit starts slightly uneven: letters tilted up to about 4 degrees, nudged and resized a few percent, seeded per visit so a resize keeps it.

## Model
Each letter is hand-defined skeleton strokes sampled into round particles. The thick look is a round-capped stroke along the particle path, drawn piece by piece so its width can vary. Position-based dynamics: distance links, a bending-smoothing pass, brace links at junctions, spatial-hash contacts, a weak pull toward each letter's own rest shape (free to translate and rotate, so a dragged letter keeps where you leave it), damping 0.94. Strokes that meet are welded; a stroke end must not weld onto its own neighbour (that chamfered corners).

**Air.** Each letter has an air level (rest 0.5) and a *mouth* particle (random on every inflation). Air flows in and out through the mouth and diffuses along the tube, so a swell or deflation travels along the stroke. Air maps to stroke thickness: 0.3 at empty, 1.0 at rest, 2.6 at full. The skeleton only stretches 30% of the swell, so a limp letter keeps its footprint (an early version scaled whole letters and looked mismatched). **Mass** is ink area (compressed) times length stretch times mean thickness: swollen letters are heavier, give way less in contacts and coast farther.

## Interactions
| Gesture | What happens |
|---|---|
| Drag (move over 8 px) | the letter bends, squashes against neighbours, stays where you leave it |
| Quick tap (under 0.22 s) | inflates by itself over 0.85 s (eased), then rockets |
| Hold still | inflates at 0.24 air per second; releasing before full launches a rocket |
| Hold to full | "critical" for 1.15 s: the skin ripples, the letter shudders, stress flicks bristle off it; release launches at full power, still holding bursts |
| Burst | the letter empties at once, every other letter is thrown away (lighter ones farther), 16 curved cartoon lines, a short shake |
| Rocket | thrust leaves through the mouth, so as the letter spins the push turns with it; no steering, no gravity; the air burns down in about 0.7 s, the tube thins to limp, motion dies |
| Afterwards | the letter stays where it stopped, drifts a moment, then air creeps back in through the mouth and it re-inflates in place. Re-form (panel) springs every letter home |

**Marks.** One hand-drawn family: curved, round-capped strokes that travel out then thin away. Speed streaks spawn behind a rocketing letter and stay in the world; stress flicks are three-stroke fans off the letter's real skin.

**Hint (until the first touch).** After about 3 s a faint breeze sways the letters (about 6 px, out of step), and every 4.5 to 7.5 s one letter breathes in and out, eased at both ends. Both stop at the first press. Skipped under reduced motion. No instructional text anywhere.

## Details
- Mobile: text selection and the context menu are blocked on the stage.
- Panel (`?tune` or T): Re-form only.
- Debug: `window.__poster.inst.debug` exposes `glyphs()`, `marks()`, `step()`.
- Limits: a resize rebuilds and resets it. Not measured on a phone.

## History
Inspired by a soft-bodied type site (idea only; our own implementation). Many short rounds with Idan: balloon-rocket behaviour (from the Puff experiment), mass equals size, air as stored energy, inflation as a force on the stroke rather than a scale, no gravity, no user aim (the mouth decides), deflate to a limp tube, a critical phase and a burst, marks that look hand-drawn, a tap that fires by itself, the breeze-and-breathing hint, no blink in the warning.
