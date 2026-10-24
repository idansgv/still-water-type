# Wash script (draft; started as the Wash idea)

**Status:** draft (Wash script), 24 Oct 2026. Test at `/?p=wash-script` (settings: `&tune`). Code: `src/posters/wash-script.js`. The first idea (water as a lens, then a stain) has a target still only: `docs/posters/wash-still.png`.

**Reference.** Kynd, "Wet and material strokes" (kynd.info/unlock/wet-material-strokes, CC BY-SA 4.0): strokes that sample and move what is under them; watercolour rims and bleed; glass strokes with a height field that refract the canvas. Look and idea only; the demos expose no code and none is copied.

**What it is.** The name in heavy, fresh black ink on pure white.
- **Drag** lays a bead of clear water. At first it smears nothing: it is a lens, and the letters under it swell and bend.
- **The moment.** A second later the water sinks in. The ink under it lifts, bleeds outward and dries into a sharp dark rim that traces the gesture, the type washed pale inside. You drew with water; you are left with a drawing in the name's own ink. Where the stroke crossed only paper it leaves a faint tide line.
- **Hold** adds water: a wider bead, a stronger lens, a bigger bleed.
- **Double tap** blots: the paper dries flat and the type re-forms.
- **Three taps** reveal (standard). One self-drawn stroke until first touch; nothing at rest; no instruction text.
- **Colour easter egg:** the dried rims take the colour.

**Why it is not a repeat.** Marbled drags the surface, Rain stains where it falls, Liquid metal is chrome. Here the stroke changes material, lens to stain. No lit relief (Emboss was rejected).

**Branch: Wash script (24 Oct 2026).** Idan: "lets branch to creating wet brush strokes following script monoline type like we did for 'Unravel'." Test page `docs/posters/prototypes/wash-script.html` (WebGL 2, no library). The name's centre line comes from a script face thinned to one pixel (Unravel's method; Sacramento, Great Vibes, Allura, Parisienne, Pinyon Script, Dancing Script), and a brush writes along it in watercolour, as the one self-demo. The paper is a small simulation: water, ink floating in it, ink settled into the paper. Water bleeds into dry paper where the fibres let it; floating ink runs to the shallow edge as it dries (a flux, so the middle pales and the rim darkens); ink settles more in the paper's valleys (granulation); the brush presses in, pools at the start of a stroke and is heavier on downstrokes. **Drag** is a brush of clear water: it lifts the ink and drags it along (Kynd's drag). **Hold** floods. **Double tap** blots it up and writes it again in the next face. Settings: brush width, writing speed, water, ink, bleed, dark rim, drying speed, granulation, drag reach, how much water lifts dried ink.

**Tuned (24 Oct 2026).** Idan: "this is decent", with brush 8.5, speed 650, water 0.9, ink 0.86, bleed 0.095, rim 1.5, dry 1.2, granulation 0.68, reach 0.9, lift 0.013. Now the page defaults (`DEF`). Test link: https://claude.ai/artifact/X6oV7Kctwkcv4gFfeypYbm

**Colour on your brush (24 Oct 2026).** Idan: "perhaps we can include color on user interaction." The writer stays black; each drag picks the next colour from the site's palettes (never the same twice running) and lays it as watercolour that runs, rims and mixes with the black ink it drags. Colour is stored as absorbance per channel (two extra textures, written with the state in one pass), so it stains white paper and glows on black. Settings: Colour on your brush, Colour strength. Note this goes past the site's rule that colour is a rare easter egg; decide before porting.

**Open.** Agree the still first: lens strength, rim weight, how pale the washed type goes, whether the tide line on bare paper is wanted.

**Ported to the site as a draft (24 Oct 2026).** Idan: "Port Wash script into the site as a draft poster, keeping colour on the brush." `src/posters/wash-script.js`, registry row `wash-script` (`draft: true`, `colour: 'native'`). Drawn straight onto the stage canvas with WebGL 2, like Still Water. The faces load from Google Fonts with only the name's letters (`text=IdanSegv`). The paper only steps while something is wet (9 s after the last stroke), so nothing moves at rest; under reduced motion the name is written and dried in one go. Gestures from `gestures.js`: drag is your brush, hold floods, double tap blots and writes again (a beat later, so a third tap can still mean reveal). Reveal: the centre line the brush follows and where each stroke starts.

**Open.** Colour is on every drag, which goes past the site's rule that colour is a rare easter egg (and the easter egg is switched off site-wide since 24 Oct): Idan's call at review. Not measured on a phone; the simulation is heavier than most posters (2.2 million cells at most, three steps a frame while wet). The writing takes about 8 s at the tuned speed. No self-demo beyond the writing.

**Faces (24 Oct 2026).** Idan: "i dont like all the script fonts, can you put together a mini catalog i can pick and choose from?" Catalog: `docs/posters/prototypes/wash-script-faces.html` (private link https://claude.ai/artifact/54ks5tj2YHkmjFAEB2ejxx): 51 Google script and handwriting faces, each drawn as the centre line the brush would follow (found at poster size, so hairlines survive the thinning). His picks, in his order, are now the poster's faces: Parisienne, WindSong, Dancing Script, Mr Dafoe, Comforter, Zeyada, Nothing You Could Do, Reenie Beanie, Caveat, Gloria Hallelujah. All ten checked through the poster at 900 x 560; they load and fit. `debug.face(n)` jumps to a face.
