# Gyosho (idea)

**Status:** draft, 2 Nov 2026. In the site at `/?p=gyosho` (`src/posters/gyosho.js`, settings with `&tune`). Ported from the dry test page `docs/posters/prototypes/gyosho.html` (Artifact version 4); the wet branch (`gyosho-wet.html`) is not in it.

**Reference.** Amiens jazz festival poster (Gold, European Design Awards 2026): "Jazz" painted huge in a loaded, streaky brush, laid over plain sans information that it half covers.

**Idan's three phases.**
1. Expressive handwriting: built from a font, but read as a hand. Lots of movement, a dynamic composition, a calligraphic lean; in spirit close to Gyosho (semi-cursive: strokes run into each other, corners soften, the brush rarely lifts).
2. A highly textured ink treatment.
3. Laid over modern type: the album title in ink, over its song names in a clear modern sans.

**How the still is made.**
- *Letters from a font:* each letter is drawn from a face, thinned to its centre line (Zhang-Suen, as in Wash script) and walked into strokes.
- *The hand:* letters are set huge (a few to a row, overlapping), each turned and scaled a little. Strokes are warped with a slow wobble, start with a press, and end either blunt or in a flick that curls off. "Flow" joins strokes into one movement with thin connecting hairlines, inside a letter and then across letters (the Gyosho part).
- *The ink:* a brush of many bristles. Each bristle carries its own ink; the brush dries along the stroke, faster on fast straight runs and at the edges, so white streaks open in the black (flying white). Paper grain lifts a few pinholes.
- *The type:* the tracklist in Inter Tight, large, left-aligned, hyphenated where a word won't fit. Ink and type either merge (both black, like the reference) or knock out where they cross.

**Open (for Idan).** The source face (sans skeleton, Caveat, or a monoline hand); how much movement; whether the ink should merge or knock out; what the interaction's surprise is (ideas: the brush writes it live in one breath; a drag is a second, drier brush; hold re-inks the brush and the next stroke is heavy and wet).

**Decisions (2 Nov 2026).**
- Look: Idan, on the target still: "Look is close".
- Interaction: live writing + your brush. On load the brush writes the title in one breath (slow through turns, quick on straight runs, short lifts between movements). Your drag continues with the same brush: slow is heavy and wet, fast goes thin and dry, a quick release flicks off. Tap writes it again with a new hand.
- Make it your own: the visitor's name goes in ink over the tracklist of the album that would have shown (no new copy invented).
- inkField (github.com/ileivoivm/inkField) studied for wet ink: its licence reserves modification and derivative works, so no code or shaders are taken. Ideas to reimplement ourselves: per-bristle random breaks with short memory (fixes the parallel-outline look), stroke-direction fibre texture, and a WebGL wet-spread + edge-pooling pass while ink is fresh.
- Ink v2 (inkField ideas 1+2, own code): each bristle breaks on its own in short runs and flicks a speck where it lifts; fibre cuts (thin white streaks along the stroke, long and fine) open more as the brush dries. Each piece is painted in a scratch canvas so cuts never open ink already down.
- Defaults: Idan's tuned values (2 Nov 2026), set on the pre-fibre version: Pink Moon, brush 1.4, movement 1.55, flow 0.25, dry 0.2, grain 1, speed 7.3, seed 304174.
- Song names now start with the track length, no leading zero (3:12). Lengths are from memory, not yet checked against a source.
- Wet branch (2 Nov 2026), `prototypes/gyosho-wet.html`, own Artifact link: inkField idea 3, own code. A half-resolution WebGL1 pass: each pixel keeps the darker of itself and what a wet neighbour gives it, weighted by a fibre paper texture, so fresh ink feathers into the paper for a couple of seconds and then sets. Only the bleed onto bare paper shows; the crisp brush and its fibre cuts stay on top. Settings: Wet ink (0 = the main page), Dark rim. Falls back to no bleed without WebGL.

**In the site (draft, 2 Nov 2026).**
- *Words.* The ink writes `stage.words`. With no name the shell gives an album title (`src/albums.js`); the song names come from the poster's own table of 12 albums with tracklists (`3:12 Title`, no leading zero). A visitor's name goes in ink over the songs of one of those 12 (drawn by the stage seed, or the album of the same name if the name is one of the 12).
- *Fallback (Claude's call, for Idan).* Most of the shell's ~130 titles have no tracklist here. Then the poster shows one of its own 12 instead (title and songs together), and returns it as `album` so the shell's share link and analytics carry what was shown (`src/main.js`: `stage.album`, and `current.album` follows the poster). Alternatives: ink only with no songs for those titles, or the shell drawing only from the 12 for this poster.
- *Track lengths* are still from memory, unchecked.
- *Gestures.* As on the test page, except the tap: it writes it again a beat later (420 ms, `REFORM_DELAY_MS`), so two taps are one rewrite and three are reveal.
- *Reveal.* What the ink is made of: each movement's centre line (hairlines and flicks broken), both edges of the brush's width, a dot where it presses and a cross where it lifts, and a title block (movements, bristles, face, flow, dry).
- *Settings* (`&tune`): album (-1 follows the words), face (0 sans, 1 Caveat, 2 monoline, loaded only when chosen), song names, knock out, brush, movement, flow, speed, dry, grain; Write it again, Next album, Save as defaults (`src/posters/params/gyosho.json`, which holds Idan's tuned values). The page's "Black page" is gone: the site's black and white sequence decides.
- *Under reduced motion* the still is drawn at once; your drag still paints.

**Open.** Real phones not looked at; track lengths unchecked; the fallback above; whether the tap's 420 ms beat feels slow; wet ink (the other branch) may be folded in later.
