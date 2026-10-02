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
    slug: 'meltdown',
    title: 'Meltdown',
    words: ['Melt', 'down'],
    blurb: 'Design and technology, at the point where both give way.',
    hint: 'Touch it.',
    themes: { dark: 0.7, light: 0.3 },
    draft: true,
    load: () => import('./meltdown.js'),
  },
  {
    slug: 'emboss',
    title: 'Emboss',
    words: ['Flat.', 'Not entirely.'],
    blurb: 'Paper that is flat, mostly. Move the light.',
    hint: null,
    themes: { dark: 0.35, light: 0.65 },
    load: () => import('./emboss.js'),
  },
  {
    slug: 'point-of-view',
    title: 'Point of view',
    words: ['Point', 'of', 'view'],
    blurb: 'It only reads from one place. Find it.',
    hint: 'Find the angle.',
    themes: { dark: 0.8, light: 0.2 },
    draft: true,
    load: () => import('./point-of-view.js'),
  },
];

export const bySlug = (slug) => POSTERS.find((p) => p.slug === slug);
export const PUBLISHED = POSTERS.filter((p) => !p.draft);

export function pickTheme(poster, rand) {
  const { dark, light } = poster.themes;
  return rand() * (dark + light) < dark ? 'dark' : 'light';
}
