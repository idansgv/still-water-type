// The poster registry. Pure data plus lazy loaders, so Node can read it too (tools/build.mjs writes
// the per-poster share pages from this list). To add a poster: write src/posters/<slug>.js, add a row
// here, then run `node tools/build.mjs`.
//
//   words    the poster's type, for the no-WebGL fallback and screen readers
//   hint     one quiet line that appears only if the visitor has not touched anything for a while
//   themes   relative odds of dark and light each time the poster is drawn
//   blurb    what a shared link says
//   prompt   what the footer's Prompt button copies: a brief to recreate the poster in your own AI tool
//   draft    not in the random rotation, no share page; still reachable with ?p=<slug> while it is worked on

export const POSTERS = [
  {
    slug: 'still-water',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    prompt: "Flat black type reading \"Idan Segev\" on a white page (with an inverted white-on-black variant), drawn with WebGL2. Underneath the flat graphic runs a real 2D wave-equation height field, stepped on the GPU with ping-pong float textures. Pointer and touch drop ripples into it that spread, reflect off the edges and slowly fade, and the type refracts through the surface so every touch distorts the letters. Hidden extra: press L (or tap three times) to turn on a lamp that throws caustics through the water onto the type. Only black and white, no UI, no instructions.",
    title: 'Still Water',
    words: ['Idan', 'Segev'],
    blurb: 'Type that remembers every touch. Ripples, and a lamp if you find it.',
    hint: null,
    themes: { dark: 0, light: 1 },
    load: () => import('./still-water.js'),
  },
  {
    slug: 'emboss',
    title: 'Emboss',
    words: ['Flat.', 'Not entirely.'],
    blurb: 'Paper that is flat, mostly. Move the light.',
    hint: null,
    themes: { dark: 0.35, light: 0.65 },
    draft: true,
    load: () => import('./emboss.js'),
  },
  {
    slug: 'sheet',
    title: 'Sheet',
    words: ['Nothing', 'to see', 'here.'],
    blurb: 'A flat poster. Tilt it.',
    hint: null,
    themes: { dark: 1, light: 0 },
    draft: true,
    load: () => import('./sheet.js'),
  },
  {
    slug: 'soft-type',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    prompt: "The name \"Idan Segev\" in huge bold type, where each letter is a few skeleton strokes sampled into round particles that behave like one soft elastic material (position-based dynamics: distance links, a bending-smoothing pass, a spatial hash for contacts, a weak pull back to each letter's rest shape). The thick bubbly look is a round-capped stroke drawn along the particle path. Drag a letter and it bends and squashes against its neighbours. Hold one without moving and it inflates through a point on the letter; let go and air rushes out, rocketing it the other way. Hold too long and it trembles, then bursts, throwing the other letters across the page. Cartoon speed lines and little flicks tell the story. Black on white, canvas 2D.",
    title: 'Soft',
    words: ['Idan', 'Segev'],
    blurb: 'Letters made of one soft material. Drag them, squash them, hold one until it pops.',
    hint: null,
    themes: { dark: 0.15, light: 0.85 },
    load: () => import('./soft-type.js'),
  },
  {
    slug: 'collapse',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    prompt: "The name \"Idan Segev\" as flat black-and-white type that is secretly a field of tall standing columns, seen straight down through an orthographic camera so only the tops show. Use a 3D rigid-body engine (Rapier, WASM) and render with WebGL. Columns are cut from the letter shapes as overlapping boxes. Tap a column and it is knocked over and falls onto its neighbours; drag one and it follows the pointer on a spring. At rest it must look like plain flat type.",
    title: 'Collapse',
    words: ['Idan', 'Segev'],
    blurb: 'Flat type that is really standing columns. Knock one over and watch them fall on each other.',
    hint: null,
    themes: { dark: 1, light: 0 },
    load: () => import('./collapse.js'),
  },
  {
    slug: 'explode',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    prompt: "The name \"Idan Segev\" as flat black-and-white type that is secretly a field of solid anchored columns, seen straight down through an orthographic camera. Use a 3D rigid-body engine (Rapier, WASM) and render with WebGL. Tap a letter and its column blows into triangular slabs; slabs that hit another letter hard enough set that one off too, a little weaker each time, so a chain reaction spreads. At rest it must look like plain flat type.",
    title: 'Shatter',
    words: ['Idan', 'Segev'],
    blurb: 'Flat type that is really solid. Touch a letter and it shatters, and the pieces set off the rest.',
    hint: null,
    themes: { dark: 1, light: 0 },
    load: () => import('./explode.js'),
  },
  {
    slug: 'skyline',
    title: 'Skyline',
    words: ['Idan', 'Segev'],
    blurb: 'Flat type, printed over hard-edged blocks. Move, and it gives them away.',
    hint: null,
    themes: { dark: 1, light: 0 },
    draft: true,
    load: () => import('./skyline.js'),
  },
  {
    slug: 'fold',
    title: 'Fold',
    words: ['Idan', 'Segev'],
    blurb: 'Every letter is folded paper. Tilt to see the creases; tap a letter to crumple it.',
    hint: null,
    themes: { dark: 1, light: 0 },
    draft: true,
    load: () => import('./fold.js'),
  },
  {
    slug: 'backlight',
    title: 'Backlight',
    words: ['Idan', 'Segev'],
    blurb: 'Solid type in a black room. Nothing shows until you find the light behind it.',
    hint: 'Find the light.',
    themes: { dark: 1, light: 0 },
    draft: true,
    load: () => import('./backlight.js'),
  },
  {
    slug: 'turn',
    title: 'Turn',
    words: ['Idan', 'Segev'],
    blurb: 'Thin black letters, edge-on against a light. Turn each one to read it.',
    hint: 'Turn the letters.',
    themes: { dark: 1, light: 0 },
    draft: true,
    load: () => import('./turn.js'),
  },
  {
    slug: 'ink',
    title: 'Ink',
    words: ['Idan', 'Segev'],
    blurb: 'The name as a pool of ink. Pull it into threads, push letters together to fuse them, tap to splash.',
    hint: null,
    themes: { dark: 0.15, light: 0.85 },
    draft: true,
    load: () => import('./ink.js'),
  },
  {
    slug: 'metal',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    prompt: "The name \"Idan Segev\" as liquid mercury: about 95% black, lit like a mirror that reflects a black room with two small lamps, so only a few crisp highlights slide across it as it moves. Particles drawn as a metaball field, with surface tension (close pairs push apart, displaced pairs pull together) and neighbours sharing velocity. Left alone it holds its letter shapes. Pull a letter and the metal follows the finger, thins to a thread and beads into droplets that stay where they land; push two letters together and they fuse; tap to scatter into beads; double-tap empty space to pour it back into the name. On a phone, tilting rolls the beads.",
    title: 'Liquid metal',
    words: ['Idan', 'Segev'],
    blurb: 'The name as liquid metal: black, with a few bright highlights. Pull it, scatter it, fuse it.',
    hint: null,
    themes: { dark: 0.15, light: 0.85 },
    load: () => import('./liquid-metal.js'),
  },
  {
    slug: 'soft-maru',
    title: 'Soft type (Maru)',
    words: ['Idan', 'Segev'],
    blurb: 'Soft type, drawn with real letters from GT Maru.',
    hint: null,
    themes: { dark: 0.15, light: 0.85 },
    draft: true,
    load: () => import('./soft-maru.js'),
  },
  {
    slug: 'extrude',
    title: 'Extrude',
    words: ['Idan', 'Segev'],
    blurb: 'The letters are cut-outs. Press one and dough squeezes through.',
    hint: null,
    themes: { dark: 0, light: 1 },
    draft: true,
    load: () => import('./extrude.js'),
  },
  {
    slug: 'slinky',
    title: 'Slinky',
    words: ['Idan', 'Segev'],
    blurb: 'A Slinky on the stairs. Tap an end and it walks down.',
    hint: null,
    themes: { dark: 0, light: 1 },
    draft: true,
    load: () => import('./slinky.js'),
  },
  {
    slug: 'slinky-type',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    title: 'Slinky',
    words: ['Idan', 'Segev'],
    blurb: 'Solid letters that are really coiled Slinkys. Tap one and it springs free.',
    hint: null,
    themes: { dark: 0, light: 1 },
    load: () => import('./slinky-type.js'),
  },
  {
    slug: 'shadow',
    title: 'Shadow',
    words: ['Idan', 'Segev'],
    blurb: 'The letters are shadows of scattered objects. Move the lamp.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    draft: true,
    load: () => import('./shadow.js'),
  },
  {
    slug: 'fan',
    colourTrigger: 'drag',       // the colour pass wakes on a long drag, not a touch
    title: 'Fan',
    words: ['Idan', 'Segev'],
    blurb: 'The name, cut into strips that fan, scatter and snap back. Drag it, or tap.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./fan.js'),
  },
  {
    slug: 'rain',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    title: 'Rain',
    words: ['Idan', 'Segev'],
    blurb: 'Heavy type the colour of the page. Rain follows you and leaves its mark. Press, and it pours.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./rain.js'),
  },
  {
    slug: 'rain-color',
    title: 'Rain color',
    words: ['Idan', 'Segev'],
    blurb: 'Rain, in colour. A test: the marks are a gradient, light or dark.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    draft: true,
    load: () => import('./rain-color.js'),
  },
  {
    slug: 'fontapalloza',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    title: 'Fontapalloza',
    words: ['Idan', 'Segev'],
    blurb: 'Every letter in a different typeface. Hover to swap one, press to make them all go.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./fontapalloza.js'),
  },
  {
    slug: 'marbled',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    title: 'Marbled',
    words: ['Idan', 'Segev'],
    blurb: 'The name floats as ink on water. Stir it, drag to comb it into marbled patterns, tap to drop more ink.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./marbled.js'),
    prompt: "The name \"Idan Segev\" as ink floating on water, like Japanese suminagashi marbling, as black-and-white vector shapes on a canvas. Set it in a heavy Helvetica-style black (Arial Black) and trace its outline into closed loops of points and apply every move to those points so the ink stays sharp. A tap drops ink: push all the ink outward around the tap keeping its area (p' = c + (p - c) * sqrt(1 + r^2 / |p - c|^2)), then drop clear water into the middle so it lands as a ring. A drag combs: drag every point beside the stroke along it, less the farther away (an exponential falloff), and keep curves smooth by inserting a point wherever a stretch has opened a gap. A mouse moving over the ink without a button gently stirs it: draw the ink displaced by a springy field that the mouse pushes and that swings back and settles, never changing the shapes. Pressing and holding makes the ink give slightly under the finger. Nothing ever resets by itself.",
  },
  {
    slug: 'glint',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    title: 'Glint',
    words: ['Idan', 'Segev'],
    blurb: 'Black type on black, seen only where a small lamp catches its edges. Move the lamp; the light fills the air.',
    hint: null,
    themes: { dark: 1, light: 0 },
    darkOnly: true,              // black only: a lamp in the dark has no white version; the shell always shows it dark (themes alone is only a hint for previews)
    load: () => import('./glint.js'),
    prompt: "The name \"Idan Segev\" as a bevelled slab in black on black, nearly invisible, seen only where a small lamp low over the page catches the edges of the letters, rendered with WebGL2. Build a height field of the type with a smooth bevel, light it with a point lamp (specular on the bevel, a bloom from a blurred copy), and add volumetric light: a screen-space light-scattering pass marched from each pixel toward the lamp that the letters block, so beams spread from the lamp and the letters throw shafts of shadow away from it. The lamp follows the pointer.",
  },
  {
    slug: 'splat-type',
    colour: 'native',            // colours itself (src/colour.js colourOf): the shell adds no overlay
    title: 'Splat type',
    words: ['Idan', 'Segev'],
    blurb: 'The name as thousands of soft splats. Press to scatter them, drag to push them along; they drift home.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./splat-type.js'),
    prompt: "The name \"Idan Segev\" in heavy Archivo as thousands of soft, translucent splats, rendered with WebGL2: sample about 40,000 to 110,000 points inside the letters; each is an instanced quad drawn as a gaussian (exp(-4.2 r^2)), premultiplied alpha over the page, sized to fit inside the letter (the radius is capped by its distance to the nearest edge, so nothing reaches past it), with a random rest angle and aspect so the body looks grainy and painterly. A press throws the splats near it outward (the push falls off as (1 - d/R)^1.3, most grains a little and a few far, with a little jitter and a slight lift); a drag pushes them along the stroke; a mouse moving over it only breathes on it. Each splat is a spring toward its home with damping, so the letters close up again; while it flies, stretch its quad along its velocity and fade it a little. Draw nothing while everything is at rest. Black and white only.",
  },
  {
    slug: 'rigged',
    title: 'Rigged',
    words: ['Idan', 'Segev'],
    blurb: 'The name as cloth, held by a few ropes, pulleys and weights drawn like a Leonardo study. Cut a rope; pull the cloth.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    draft: true,               // back in the archive 24 Oct 2026: not ready for publishing yet
    load: () => import('./rigged.js'),
    prompt: "The name \"Idan Segev\" in Alfa Slab One as cloth, held by a sparse rig drawn like a page of Leonardo da Vinci's mechanical studies, rendered with WebGL. Cut each letter from the glyph as a triangle mesh and step it with a position-based cloth solver in 3D (stretch and fold constraints, plus a few long weak ties across each letter like battens in a sail), so spare cloth folds out of the page. Rig only the outer corners: a corner facing up hangs on a rope that rises to a pulley on a thin rail above the line and drops to a counterweight resting on a small ledge (rope length = cloth to pulley + pulley to weight, so pulling the cloth lifts the weight); a corner facing down carries a swinging plumb bob. Draw the rig in pale hairlines behind the cloth. Tap a rope to cut it: the corner sags and the rope is tied again and reeled in after a pause. Drag to pull the cloth against the weights. Black and white only.",
  },
  {
    slug: 'wash-script',
    colour: 'native',            // its own colour, always, on your brush; the writing is black. The shell adds no overlay
    title: 'Wash script',
    words: ['Idan', 'Segev'],
    blurb: 'A wet brush writes the name in watercolour. Drag through it with a brush of coloured water; double tap to blot.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./wash-script.js'),
    prompt: "The name \"Idan Segev\" written by a wet brush in black watercolour, with WebGL2. Render the name in a script or handwriting face (Parisienne), thin it to a one-pixel centre line (Zhang-Suen) and walk that into strokes; a brush follows them in reading order, pressing in at the start of each stroke and heavier on downstrokes. The paper is a GPU simulation with ping-pong float textures: water, ink floating in the water, ink settled into the paper. Water bleeds into dry paper where a paper-fibre noise lets it; floating ink flows to shallower water (a conservative flux between neighbours) so strokes dry with a dark rim and a pale middle; ink settles more in the paper's valleys (granulation). The visitor's finger is a brush of clear water carrying a colour (stored as absorbance per channel so it mixes like paint): it lifts the ink, drags it along and dries with its own rim. Hold to flood; double tap to blot and write it again in another script.",
  },
  {
    slug: 'brandbook',
    title: 'Brandbook',
    words: ['Idan', 'Segev'],
    blurb: 'A black-and-white brand book for a venture that does not exist. Click to rebrand it; drag a don’t to break the rule.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./brandbook.js'),
  },
  {
    slug: 'crystallize',
    title: 'Crystallize',
    words: ['Idan', 'Segev'],
    blurb: 'A Voronoi crackle where the name is never drawn: cells split inside the letters until it shows. Stir it; tap to knock a hole.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./crystallize.js'),
    prompt: "The name \"Idan Segev\" condensing out of a Voronoi diagram, on a 2D canvas with d3-delaunay. Never draw the type: render it once (Fraunces 900, two lines) into a hidden mask. Start with about 160 random seeds and draw only the Voronoi cell edges as thin lines. Every frame do one weighted Lloyd step: sample points over the page, kept with a probability equal to the density (1 inside the letters, 0.28 outside); move each seed to the centroid of the samples in its cell, and split any cell holding more than 1.6 times its share (a second seed beside it), up to about 9000 cells. The letters fill with fine cells while the field stays coarse, so the name appears. Drag stirs the seeds, a tap clears a disk down to a few big cells that refine back, hold jitters the cells under the finger, double tap starts over.",
  },
  {
    slug: 'glitter',
    title: 'Glitter',
    words: ['Idan', 'Segev'],
    blurb: 'The name is the only water on a black page. Move the moon over it and the letters show as glitter where its light lands.',
    hint: null,
    themes: { dark: 1, light: 0 },
    darkOnly: true,              // black only: moonlight on water has no white version, like Glint
    load: () => import('./glitter.js'),
    prompt: "The name \"Idan Segev\" in Bitter as the only water on a black page, seen from straight above, with WebGL2; the pointer is a small moon above the page. Inside the letters sum about 24 ripples (3 to 240 px, every direction, gravity-capillary dispersion); ripples too fine for a pixel become slope variance. At each pixel take the half vector between the view and the moon, compare it with the surface normal through a Beckmann slope distribution, and draw the glints as a Poisson count per pixel from that expected radiance, so near the moon they are separate sparkles and further off a glow. Moves leave a wake of ripples (a low-resolution field that spreads and decays); hold raises the wind over every letter. HDR with a bloom. A calm letter is a black mirror. Black and white only.",
  },
  {
    slug: 'lace',
    title: 'Lace',
    words: ['Idan', 'Segev'],
    blurb: 'The name in sea foam. Touch it and the foam ages the way real foam does, opening along its bubbles into lace.',
    hint: null,
    themes: { dark: 0.3, light: 0.7 },
    draft: true,                 // on hold (25 Oct 2026): out of the shuffle, still at ?p=lace
    load: () => import('./lace.js'),
    prompt: "The name \"Idan Segev\" in heavy Bitter as sea foam, with WebGL2 and float textures at screen size. Keep three things per pixel: foam density, how fast it is ageing, and where that bit of foam started (advected with the foam, so the pattern stretches when pulled). Draw foam only where a two-scale bubble-raft pattern (Voronoi, the distance between the nearest and second nearest seed, so bubble middles are high and the films between them low) lies below the density: fresh foam is solid, and as it ages the bubble middles open first and the films last, so the letters thin into lace. A touch makes the foam age; a drag also pushes it along a short-lived wind field; hold is a gale that blows it into rows; double tap sends a breaker across that lays fresh foam. Black foam on white, or white on black.",
  },
  {
    slug: 'torn',
    title: 'Torn',
    words: ['Idan', 'Segev'],
    blurb: 'The name cut from cloth and hung from pegs. Stir the air, pull a peg, and pull hard enough to tear it.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    load: () => import('./torn.js'),
    prompt: "The name \"Idan Segev\" in Alfa Slab One cut from black cloth and hung from a row of pegs along the top of each letter, rendered with WebGL. Make each letter a triangle mesh cut from the glyph, a little larger than the letter, and step it with a position-based cloth solver in 3D (stretch and fold constraints, gravity) so it drapes and folds out of the page; each peg pins a small patch. Every triangle edge is a thread that snaps when stretched past about 2.25 times its length and takes its triangles with it, so a hard pull rips the cloth along the line of most stress and the pieces fall and pile on the floor. A moving pointer pushes air at the cloth; drag pulls it; a tap pulls out the nearest peg; double tap drops everything and lowers a fresh set on its pegs. Black and white only.",
  },
  {
    slug: 'moire-phase',
    title: 'Moiré phase',
    words: ['Idan', 'Segev'],
    blurb: 'Two voices of lines drift out of phase, like Reich. Now and then they fall back into step and the name appears between them.',
    hint: null,
    themes: { dark: 0.5, light: 0.5 },
    draft: true,                 // staged for review (29 Oct 2026)
    load: () => import('./moire-phase.js'),
    prompt: "The name \"Idan Segev\" in Alfa Slab One made only of moiré, after Steve Reich's phasing, with WebGL2. Two voices of about 140 fine lines across the height, each line bent in 3D by a few long sines that travel slowly, seen in perspective from a tilted camera. Voice 1 holds still; inside the letters (a screen-space mask) it steps half a line over. Voice 2 is the same lines with the phase of their bends lagging behind in Reich's steps (12 per 50 s cycle, held a moment on each), its spacing and angle parting slightly away from unison. When the voices fall back into step once a cycle the name appears by gestalt, then dissolves into moiré. Lines thicken in shade. Drag turns the view, tap is one beat ahead, hold settles into unison, double tap starts over. Black and white only.",
  },
  {
    slug: 'moonlit',
    title: 'Moonlit',
    words: ['Idan', 'Segev'],
    blurb: 'The name is a slick on a moonlit sea: where the wind roughens the water it glitters, and the letters stay glassy and dark.',
    hint: null,
    themes: { dark: 1, light: 0 },
    darkOnly: true,              // black only: a night sea
    load: () => import('./moonlit.js'),
    prompt: "The name \"Idan Segev\" in Bitter 900 as a slick on a night sea seen from straight above, with WebGL2. A slick damps the smallest ripples: inside the letters short waves are almost gone, mid waves halved, the swell untouched. Sum about 28 directional waves (5 to 380 px, gravity-capillary dispersion); ripples too fine for a pixel become slope variance. Light it with a moon outside the frame through a Beckmann slope distribution and draw the glints as a Poisson count per small cell, so rough water is a field of separate sparkles and the letters stay dark mirrors. A quarter-size wind field (pointer moves inject gusts that drift downwind and decay) plus a light breeze everywhere outside the letters, so the name shows at rest. Hold for a gale: swell, foam on the crests, the slick tears into strands and later heals. Black and white only.",
  },
];

export const bySlug = (slug) => POSTERS.find((p) => p.slug === slug);
export const PUBLISHED = POSTERS.filter((p) => !p.draft);

export function pickTheme(poster, rand) {
  const { dark, light } = poster.themes;
  return rand() * (dark + light) < dark ? 'dark' : 'light';
}
