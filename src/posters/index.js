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
    prompt: "The name \"Idan Segev\" in huge bold type, where each letter is a few skeleton strokes sampled into round particles that behave like one soft elastic material (position-based dynamics: distance links, a bending-smoothing pass, a spatial hash for contacts, a weak pull back to each letter's rest shape). The thick bubbly look is a round-capped stroke drawn along the particle path. Drag a letter and it bends and squashes against its neighbours. Hold one without moving and it inflates through a point on the letter; let go and air rushes out, rocketing it the other way. Hold too long and it trembles, then bursts, throwing the other letters across the page. Cartoon speed lines and little flicks tell the story. Black on white, canvas 2D.",
    title: 'Soft type',
    words: ['Idan', 'Segev'],
    blurb: 'Letters made of one soft material. Drag them, squash them, hold one until it pops.',
    hint: null,
    themes: { dark: 0.15, light: 0.85 },
    load: () => import('./soft-type.js'),
  },
  {
    slug: 'collapse',
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
    prompt: "The name \"Idan Segev\" as flat black-and-white type that is secretly a field of solid anchored columns, seen straight down through an orthographic camera. Use a 3D rigid-body engine (Rapier, WASM) and render with WebGL. Tap a letter and its column blows into triangular slabs; slabs that hit another letter hard enough set that one off too, a little weaker each time, so a chain reaction spreads. At rest it must look like plain flat type.",
    title: 'Explode',
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
    title: 'Slinky type',
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
];

export const bySlug = (slug) => POSTERS.find((p) => p.slug === slug);
export const PUBLISHED = POSTERS.filter((p) => !p.draft);

export function pickTheme(poster, rand) {
  const { dark, light } = poster.themes;
  return rand() * (dark + light) < dark ? 'dark' : 'light';
}
