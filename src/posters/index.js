// The poster registry. Pure data plus lazy loaders, so Node can read it too (tools/build.mjs writes
// the per-poster share pages from this list). To add a poster: write src/posters/<slug>.js, add a row
// here, then run `node tools/build.mjs`.
//
//   words    the poster's type, for the no-WebGL fallback and screen readers
//   hint     one quiet line that appears only if the visitor has not touched anything for a while
//   themes   relative odds of dark and light each time the poster is drawn
//   blurb    what a shared link says
//   draft    not in the random rotation, no share page; still reachable with ?p=<slug> while it is worked on

export const POSTERS = [
  {
    slug: 'still-water',
    title: 'Still Water',
    words: ['Idan', 'Segev'],
    blurb: 'Type that remembers every touch. Ripples, and a lamp if you find it.',
    hint: null,
    themes: { dark: 1, light: 0 },
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
    title: 'Soft type',
    words: ['Idan', 'Segev'],
    blurb: 'Letters made of one soft material. Drag them, squash them, hold one until it pops.',
    hint: null,
    themes: { dark: 0.15, light: 0.85 },
    load: () => import('./soft-type.js'),
  },
  {
    slug: 'collapse',
    title: 'Collapse',
    words: ['Idan', 'Segev'],
    blurb: 'Flat type that is really standing columns. Knock one over and watch them fall on each other.',
    hint: null,
    themes: { dark: 1, light: 0 },
    load: () => import('./collapse.js'),
  },
  {
    slug: 'explode',
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
    title: 'Liquid metal',
    words: ['Idan', 'Segev'],
    blurb: 'The name as liquid metal: black, with a few bright highlights. Pull it, scatter it, fuse it.',
    hint: null,
    themes: { dark: 0.15, light: 0.85 },
    load: () => import('./liquid-metal.js'),
  },
];

export const bySlug = (slug) => POSTERS.find((p) => p.slug === slug);
export const PUBLISHED = POSTERS.filter((p) => !p.draft);

export function pickTheme(poster, rand) {
  const { dark, light } = poster.themes;
  return rand() * (dark + light) < dark ? 'dark' : 'light';
}
