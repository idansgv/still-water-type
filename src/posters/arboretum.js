// Arboretum: the name's centre lines grow as plants, and each species is a typeface. Every letter is one plant rooted at its
// lowest point; trunk width follows the pipe model (a stem is as thick as everything it carries), and each of 21 species brings
// its own branching, foliage, flowers and bark. Once grown, limbs live on their own clocks: grow, hold, age (the foliage drifts
// down), stand bare, fade while dying back from the tip, and a new one grows somewhere else. The letters never change.
//
// Under the picture: the name in Inter Tight thinned to a one-pixel centre line (Zhang-Suen), a BFS tree from each letter's
// lowest pixel, spurs pruned, per-pixel flow for the pipe model, smoothed chains, grafts where a letter's loop meets itself.
// Branching is either a 2D port of github.com/dgreenheck/ez-tree's per-level model (MIT; ideas, own code) or classic turtle
// twigs. Wind: every twig and branch is a damped spring tuned by its thickness and length; a gust starts at the pointer and
// crosses the page in its direction, noise breaks it up, leaves flutter and pendants trail. Idea from SkyeShark/SeedThree
// (species-specific growth rules; no code). Ported from the test page docs/posters/prototypes/arboretum.html (4 Nov 2026).
//
// gestures: move or drag = wind; tap = grow the name again as the next species (a beat later, so a double or triple tap can
// mean something else); double tap = grow the same species again (REFORM_DELAY_MS after). Three taps (reveal) show the
// skeleton: the centre lines each letter grows from, its roots and grafts.
// The life cycle is continuous motion at rest, which the site's "no idle motion" rule normally forbids: Idan asked for it
// (3 Nov 2026). Under reduced motion the name is drawn grown and still.

import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, ink as rvInk } from './reveal.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Inter Tight', WEIGHT = 600;
const DEF = { model: 'ez', species: 'oak', seed: 59, thick: 0.65, gnarl: 1, twigs: 2.25, twigLen: 1.9, leaves: 1.9, grow: 3, cycle: 1, wind: 1.45 };   // Idan's settings from the test page

export async function mount(stage) {
  let alive = true;
  const offs = [];

  // ---------- the face: Inter Tight from Google Fonts, only the letters of the name ----------
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=Inter+Tight:wght@${WEIGHT}&text=${encodeURIComponent(lettersFor(stage, 'IdanSegv'))}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(`${WEIGHT} 220px "${FAMILY}"`, linesFor(stage, ['Idan', 'Segev']).join(' ')), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }

  const P = { ...DEF, seed: 1 + (stage.seed % 99) };
  // Per-species tuning: switching species loads its own values into the sliders; slider edits write back here.
  const TUNED = ['thick', 'gnarl', 'twigs', 'twigLen', 'leaves'];
  const TUNE = {
    oak: { thick: 0.65, gnarl: 1, twigs: 2.25, twigLen: 1.9, leaves: 1.9 },
    willow: { thick: 0.8, gnarl: 1, twigs: 1.2, twigLen: 1, leaves: 1.2 },
    pine: { thick: 0.8, gnarl: 1, twigs: 1.2, twigLen: 1.2, leaves: 1.3 },
    saguaro: { thick: 0.9, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1.3 },
    birch: { thick: 0.8, gnarl: 1, twigs: 1.3, twigLen: 1.3, leaves: 1.5 },
    cherry: { thick: 0.65, gnarl: 1, twigs: 1.3, twigLen: 1.2, leaves: 1.5 },
    joshua: { thick: 0.7, gnarl: 1, twigs: 0.8, twigLen: 0.8, leaves: 1.6 },
    fir: { thick: 0.75, gnarl: 1, twigs: 0.9, twigLen: 0.7, leaves: 1.2 },
    apple: { thick: 0.6, gnarl: 1, twigs: 1.3, twigLen: 1.2, leaves: 1.5 },
    dogwood: { thick: 0.7, gnarl: 1, twigs: 0.9, twigLen: 0.8, leaves: 1.4 },
    wisteria: { thick: 0.7, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1.3 },
    bamboo: { thick: 0.9, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1.5 },
    mangrove: { thick: 0.7, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1 },
    bonsai: { thick: 0.55, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1.6 },
    fern: { thick: 0.9, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1.5 },
    ivy: { thick: 0.9, gnarl: 1, twigs: 1.2, twigLen: 1, leaves: 1.5 },
    weepingCherry: { thick: 0.7, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1.3 },
    baobab: { thick: 0.8, gnarl: 1, twigs: 1, twigLen: 1, leaves: 0.9 },
    palm: { thick: 0.9, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1.3 },
    pricklyPear: { thick: 1, gnarl: 1, twigs: 1, twigLen: 1, leaves: 1.3 },
    banyan: { thick: 0.65, gnarl: 1, twigs: 1.2, twigLen: 1.2, leaves: 1.3 },
  };
  // the ez-tree model reads the twig sliders on its own scale, so its species keep a separate set
  const TUNE_EZ = {};
  for (const k in TUNE) TUNE_EZ[k] = { ...TUNE[k], twigs: 1, twigLen: 1 };
  const tuneSet = () => (useEz(SPECIES[P.species]) ? TUNE_EZ : TUNE)[P.species];
  const loadTune = () => Object.assign(P, tuneSet());

  // Sizes are fractions of the cap height H.
  const SPECIES = {
    oak: {
      common: 'White oak', latin: 'Quercus alba', trunk: 0.17, tip: 0.02, exp: 0.5, gnarl: 0.6,
      br: { levels: 3, every: 0.28, maxW: 0.04, angle: [0, 54, 58, 32], children: [0, 3, 2, 0], length: [0, 0.26, 0.22, 0.12], radius: [0, 0.7, 0.69, 0.9], taper: [0, 0.42, 0.69, 0.75], gnarl: [0, 0.1, 0.15, 0.09], start: [0, 0, 0.06, 0.12], sections: [0, 6, 4, 2], force: { dir: [0, -1], s: 0.02 } },
      tw: { every: 0.15, ang: 62, angJ: 25, up: 0.2, len: 0.24, steps: 9, depth: 2, decay: 0.58, childEvery: 3, grav: 0.25, jit: 0.22, w: 0.034 },
      leaf: 'cluster',
    },
    willow: {
      common: 'Weeping willow', latin: 'Salix babylonica', trunk: 0.13, tip: 0.022, exp: 0.5, gnarl: 0.35,
      tw: { every: 0.06, ang: 40, angJ: 18, up: 0.3, len: 0.6, steps: 18, depth: 0, grav: 10, jit: 0.04, w: 0.011 },
      leaf: 'dash',
    },
    pine: {
      common: 'Ponderosa pine', latin: 'Pinus ponderosa', trunk: 0.11, tip: 0.03, exp: 0.35, gnarl: 0.06,
      br: { type: 'evergreen', levels: 1, every: 0.05, maxW: 0.02, angle: [0, 100], children: [0, 0], length: [0, 0.22], radius: [0, 0.4], taper: [0, 1], gnarl: [0, 0.06], start: [0, 0], sections: [0, 6], force: { dir: [0, -1], s: -0.003 } },
      tw: { every: 0.055, ang: 86, angJ: 6, up: 0, len: 0.2, steps: 6, depth: 0, grav: 1.0, jit: 0.03, w: 0.014, byWidth: true },
      leaf: 'needle',
    },
    saguaro: {
      common: 'Saguaro', latin: 'Carnegiea gigantea', trunk: 0.12, tip: 0.12, exp: 0, gnarl: 0.08, tw: null, leaf: 'spine', body: 'ribbed',
    },
    birch: {
      common: 'Paper birch', latin: 'Betula papyrifera', trunk: 0.13, tip: 0.035, exp: 0.35, gnarl: 0.18,
      br: { levels: 2, every: 0.14, maxW: 0.014, angle: [0, 40, 32], children: [0, 3, 0], length: [0, 0.3, 0.2], radius: [0, 0.6, 0.7], taper: [0, 0.3, 0.7], gnarl: [0, 0.12, 0.12], start: [0, 0, 0.35], sections: [0, 8, 6], force: { dir: [0, -1], s: 0.015 } },
      tw: { every: 0.13, ang: 36, angJ: 12, up: 0.45, len: 0.28, steps: 9, depth: 2, decay: 0.55, childEvery: 3, grav: -0.15, jit: 0.1, w: 0.016 },
      leaf: 'catkin', body: 'outline', inflo: { per: 1, forms: ['catkin', 'catkin', 'catkin', 'catkinUp', 'none'], size: 0.02 },
    },
    cherry: {
      common: 'Sweet cherry', latin: 'Prunus avium', trunk: 0.15, tip: 0.02, exp: 0.5, gnarl: 0.45,
      br: { levels: 3, every: 0.18, maxW: 0.035, angle: [0, 48, 60, 50], children: [0, 3, 3, 0], length: [0, 0.24, 0.14, 0.07], radius: [0, 0.63, 0.76, 0.7], taper: [0, 0.7, 0.7, 0.7], gnarl: [0, 0.2, 0.2, 0.09], start: [0, 0, 0.33, 0], sections: [0, 7, 5, 3], force: { dir: [0, -1], s: 0.01 } },
      tw: { every: 0.15, ang: 50, angJ: 20, up: 0.3, len: 0.22, steps: 9, depth: 2, decay: 0.6, childEvery: 3, grav: 0.1, jit: 0.15, w: 0.03 },
      leaf: 'blossom', inflo: { per: 1, forms: ['umbel', 'umbel', 'umbel', 'corymb', 'solitary', 'cyme'], size: 0.024, petals: [5, 5, 5, 6], shape: 'notched', dbl: 0.15, buds: 0.2, side: 0.2, droop: 0.45 },
    },
    joshua: {
      common: 'Joshua tree', latin: 'Yucca brevifolia', trunk: 0.16, tip: 0.05, exp: 0.4, gnarl: 0.35,
      tw: { every: 0.3, ang: 30, angJ: 10, up: 0.5, len: 0.2, steps: 6, depth: 2, decay: 0.8, fork: true, grav: 0, jit: 0.12, w: 0.045 },
      leaf: 'pompom', inflo: { extra: true, per: 1, forms: ['none', 'none', 'panicle'], size: 0.018, petals: [6], shape: 'pointed', buds: 0.3, side: 1 },
    },
    fir: {
      common: 'Douglas fir', latin: 'Pseudotsuga menziesii', trunk: 0.11, tip: 0.03, exp: 0.35, gnarl: 0.05,
      br: { type: 'evergreen', levels: 2, every: 0.045, maxW: 0.018, angle: [0, 95, 50], children: [0, 6, 0], length: [0, 0.24, 0.06], radius: [0, 0.4, 0.6], taper: [0, 1, 1], gnarl: [0, 0.04, 0.05], start: [0, 0, 0.1], sections: [0, 8, 3], force: { dir: [0, 1], s: 0.01 } },
      tw: { every: 0.045, ang: 90, angJ: 5, up: 0, len: 0.24, steps: 8, depth: 0, grav: 7, jit: 0.02, w: 0.012, byWidth: true },
      leaf: 'needle',
    },
    apple: {
      common: 'Cultivated apple', latin: 'Malus domestica', trunk: 0.16, tip: 0.025, exp: 0.5, gnarl: 0.8,
      br: { levels: 3, every: 0.24, maxW: 0.035, angle: [0, 70, 60, 45], children: [0, 3, 2, 0], length: [0, 0.18, 0.12, 0.07], radius: [0, 0.65, 0.7, 0.7], taper: [0, 0.6, 0.6, 0.7], gnarl: [0, 0.35, 0.35, 0.2], start: [0, 0, 0.2, 0.1], sections: [0, 6, 4, 3], force: { dir: [0, 1], s: 0.006 } },
      tw: { every: 0.14, ang: 65, angJ: 30, up: 0.1, len: 0.17, steps: 8, depth: 2, decay: 0.6, childEvery: 2, grav: 0.4, jit: 0.35, w: 0.03 },
      leaf: 'fruit', inflo: { extra: true, per: 1, forms: ['none', 'corymb', 'corymb', 'cyme', 'solitary'], size: 0.022, petals: [5], shape: 'round', buds: 0.3, side: 0.25, droop: 0.15 },
    },
    dogwood: {
      common: 'Flowering dogwood', latin: 'Cornus florida', trunk: 0.13, tip: 0.02, exp: 0.45, gnarl: 0.3,
      br: { levels: 2, every: 0.15, maxW: 0.028, angle: [0, 80, 50], children: [0, 3, 0], length: [0, 0.24, 0.12], radius: [0, 0.6, 0.7], taper: [0, 0.6, 0.7], gnarl: [0, 0.06, 0.1], start: [0, 0, 0.3], sections: [0, 8, 5], force: { dir: [0, -1], s: -0.004 } },
      tw: { every: 0.13, ang: 70, angJ: 15, up: 0.1, level: 0.5, len: 0.22, steps: 9, depth: 1, decay: 0.55, childEvery: 3, grav: 0, jit: 0.06, w: 0.022 },
      leaf: 'bract', inflo: { per: 2, forms: ['bracts', 'bracts', 'bracts', 'bracts2', 'none'], size: 0.026, petals: [4, 4, 4, 5], shape: 'notched', hollow: true, buds: 0.15 },
    },
    wisteria: {
      common: 'Chinese wisteria', latin: 'Wisteria sinensis', trunk: 0.13, tip: 0.02, exp: 0.5, gnarl: 0.7,
      tw: { every: 0.1, ang: 55, angJ: 20, up: 0.35, len: 0.2, steps: 9, depth: 0, grav: 2.5, jit: 0.12, w: 0.014 },
      leaf: 'raceme', inflo: { per: 1, forms: ['raceme', 'raceme', 'raceme', 'raceme', 'racemeYoung'], size: 0.028, len: 0.24, pea: true, hang: true },
    },
    bamboo: {
      common: 'Moso bamboo', latin: 'Phyllostachys edulis', trunk: 0.09, tip: 0.09, exp: 0, gnarl: 0.04,
      tw: { every: 0.2, ang: 45, angJ: 12, up: 0.3, len: 0.12, steps: 4, depth: 0, grav: 0.5, jit: 0.05, w: 0.007 },
      leaf: 'blade', body: 'jointed',
    },
    mangrove: {
      common: 'Red mangrove', latin: 'Rhizophora mangle', trunk: 0.14, tip: 0.03, exp: 0.45, gnarl: 0.5,
      tw: { every: 0.16, ang: 70, angJ: 15, up: 0, arch: true, len: 0.5, steps: 14, depth: 1, decay: 0.25, fork: true, grav: 5, jit: 0.04, w: 0.02 },
      leaf: 'none',
    },
    bonsai: {
      common: 'Bonsai juniper', latin: 'Juniperus chinensis', trunk: 0.2, tip: 0.025, exp: 0.6, gnarl: 1.4,
      br: { levels: 2, every: 0.24, maxW: 0.045, angle: [0, 85, 60], children: [0, 3, 0], length: [0, 0.2, 0.12], radius: [0, 0.6, 0.7], taper: [0, 0.6, 0.7], gnarl: [0, 0.35, 0.3], start: [0, 0, 0.3], sections: [0, 7, 4], force: { dir: [0, -1], s: 0.004 } },
      tw: { every: 0.24, ang: 80, angJ: 20, up: 0.1, level: 0.6, len: 0.2, steps: 8, depth: 1, decay: 0.6, childEvery: 3, grav: 0.3, jit: 0.25, w: 0.03 },
      leaf: 'pad',
    },
    fern: {
      common: 'Ostrich fern', latin: 'Matteuccia struthiopteris', trunk: 0.08, tip: 0.02, exp: 0.4, gnarl: 0.15,
      tw: { every: 0.15, ang: 50, angJ: 12, up: 0.5, len: 0.32, steps: 18, depth: 0, grav: 0.4, curl: 1.1, jit: 0.02, w: 0.01 },
      leaf: 'pinna',
    },
    ivy: {
      common: 'English ivy', latin: 'Hedera helix', trunk: 0.09, tip: 0.03, exp: 0.3, gnarl: 0.3,
      tw: { every: 0.12, ang: 14, angJ: 10, up: 0, len: 0.34, steps: 14, depth: 0, grav: 0, jit: 0.3, w: 0.007 },
      leaf: 'ivy', inflo: { extra: true, per: 1, forms: ['none', 'none', 'none', 'ball', 'ball'], size: 0.014 },
    },
    weepingCherry: {
      common: 'Weeping cherry', latin: 'Prunus pendula', trunk: 0.14, tip: 0.022, exp: 0.5, gnarl: 0.5,
      tw: { every: 0.07, ang: 40, angJ: 18, up: 0.35, len: 0.55, steps: 16, depth: 0, grav: 9, jit: 0.04, w: 0.01 },
      leaf: 'weep', inflo: { per: 0, forms: [], size: 0.02, petals: [5], shape: 'notched', dbl: 0.3, buds: 0.25, side: 0.3 },
    },
    baobab: {
      common: 'Baobab', latin: 'Adansonia digitata', trunk: 0.26, tip: 0.08, exp: 0.25, gnarl: 0.25,
      tw: { endsOnly: true, count: 5, spread: 2.2, up: 0.5, ang: 30, angJ: 8, len: 0.2, steps: 7, depth: 1, decay: 0.6, fork: true, grav: 0, jit: 0.15, w: 0.035 },
      leaf: 'cluster',
    },
    palm: {
      common: 'Date palm', latin: 'Phoenix dactylifera', trunk: 0.1, tip: 0.08, exp: 0.2, gnarl: 0.1,
      tw: { endsOnly: true, count: 9, spread: 3.6, up: 0.4, ang: 0, angJ: 10, len: 0.42, steps: 14, depth: 0, grav: 3.5, jit: 0.02, w: 0.009 },
      leaf: 'frond', body: 'scarred',
    },
    pricklyPear: {
      common: 'Prickly pear', latin: 'Opuntia ficus-indica', trunk: 0.045, tip: 0.045, exp: 0, gnarl: 0.1, tw: null, leaf: 'none', body: 'paddles',
    },
    banyan: {
      common: 'Banyan', latin: 'Ficus benghalensis', trunk: 0.16, tip: 0.025, exp: 0.5, gnarl: 0.5,
      br: { levels: 2, every: 0.16, maxW: 0.04, angle: [0, 70, 55], children: [0, 4, 0], length: [0, 0.28, 0.16], radius: [0, 0.65, 0.7], taper: [0, 0.5, 0.7], gnarl: [0, 0.15, 0.2], start: [0, 0, 0.2], sections: [0, 8, 5], force: { dir: [0, -1], s: 0.005 } },
      tw: { every: 0.16, ang: 65, angJ: 20, up: 0.15, level: 0.3, len: 0.22, steps: 9, depth: 1, decay: 0.6, childEvery: 3, grav: 0.2, jit: 0.18, w: 0.03 },
      leaf: 'cluster', body: 'aerial',
    },
  };
  const ORDER = Object.keys(SPECIES);

  const ctx = stage.canvas.getContext('2d');
  const reduce = stage.reduced;
  let cssW = stage.W, cssH = stage.H;
  let skel = null;     // skeleton in work units, cached per text + layout
  let skelKey = '';
  let tree = null;     // display geometry for the current species
  let t0 = performance.now(), grownAt = 0;
  let wind = 0, windT = 0, dirty = true;

  // ---------- utilities
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash2(a, b, s) {
    let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  }
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- skeleton (work units)
  function buildSkeleton(lines) {
    const fs = 220, font = `${WEIGHT} ${fs}px "${FAMILY}", Arial, sans-serif`;
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    g.font = font;
    const cap = g.measureText('H').actualBoundingBoxAscent;
    const lh = fs * 1.12, pad = Math.round(fs * 0.3);
    const W = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width))) + pad * 2;
    const H = Math.ceil(cap + (lines.length - 1) * lh + fs * 0.32) + pad * 2;
    c.width = W; c.height = H;
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
    lines.forEach((l, i) => g.fillText(l, W / 2, pad + cap + i * lh));
    const px = g.getImageData(0, 0, W, H).data;
    const m = new Uint8Array(W * H);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 127) {
      m[y * W + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    thin(m, W, x0, y0, x1, y1);

    const N8 = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
    const seen = new Uint8Array(W * H);
    const parent = new Int32Array(W * H).fill(-1);
    const dist = new Float32Array(W * H);
    const comps = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const s = y * W + x;
      if (!m[s] || seen[s]) continue;
      // flood the component, find its lowest pixel (closest to centre on ties) as the root
      const pix = [s]; seen[s] = 1;
      for (let k = 0; k < pix.length; k++) for (const o of N8) { const j = pix[k] + o; if (m[j] && !seen[j]) { seen[j] = 1; pix.push(j); } }
      if (pix.length < 10) continue;
      let root = pix[0], ry = -1, rcx = 0;
      for (const p of pix) rcx += p % W; rcx /= pix.length;
      for (const p of pix) { const py = (p / W) | 0, pxx = p % W; if (py > ry || (py === ry && Math.abs(pxx - rcx) < Math.abs(root % W - rcx))) { ry = py; root = p; } }
      // tree from the root, straight steps before diagonal ones
      const order = [root]; const inT = new Set([root]); dist[root] = 0;
      for (let k = 0; k < order.length; k++) {
        const p = order[k];
        for (const o of [-W, -1, 1, W, -W - 1, -W + 1, W - 1, W + 1]) {
          const j = p + o;
          if (m[j] && !inT.has(j)) { inT.add(j); parent[j] = p; dist[j] = dist[p] + (o === -W || o === W || o === 1 || o === -1 ? 1 : Math.SQRT2); order.push(j); }
        }
      }
      comps.push({ root, order });
    }

    // prune short leaf spurs (thinning artefacts at corners and terminals)
    const alive = new Uint8Array(W * H), kidsN = new Int32Array(W * H);
    for (const cp of comps) for (const p of cp.order) { alive[p] = 1; if (parent[p] >= 0) kidsN[parent[p]]++; }
    const minSpur = cap * 0.13;
    for (let pass = 0; pass < 3; pass++) for (const cp of comps) for (const leaf of cp.order) {
      if (!alive[leaf] || kidsN[leaf] > 0) continue;
      const path = [leaf]; let cur = parent[leaf];
      while (cur >= 0 && kidsN[cur] === 1) { path.push(cur); cur = parent[cur]; }
      if (cur < 0 || dist[leaf] - dist[cur] >= minSpur) continue;
      for (const p of path) alive[p] = 0;
      kidsN[cur]--;
    }

    // flow (pixels carried) and chains between branch points
    const flow = new Float32Array(W * H);
    const out = { comps: [], cap, bbox: [x0, y0, x1, y1] };
    for (const cp of comps) {
      const ord = cp.order.filter(p => alive[p]);
      for (let k = ord.length - 1; k >= 0; k--) { const p = ord[k]; flow[p] += 1; if (parent[p] >= 0) flow[parent[p]] += flow[p]; }
      const kids = new Map();
      for (const p of ord) if (parent[p] >= 0) { if (!kids.has(parent[p])) kids.set(parent[p], []); kids.get(parent[p]).push(p); }
      const rootF = flow[cp.root];
      const pt = p => ({ x: p % W, y: (p / W) | 0, d: dist[p], f: flow[p] / rootF });
      const chains = [];
      const stack = [cp.root];
      while (stack.length) {
        const s = stack.pop();
        for (const c0 of kids.get(s) || []) {
          const ch = [s, c0]; let cur = c0;
          while ((kids.get(cur) || []).length === 1) { cur = kids.get(cur)[0]; ch.push(cur); }
          if ((kids.get(cur) || []).length > 1) stack.push(cur);
          const sm = smooth(ch.map(pt));
          sm.terminal = !(kids.get(cur) || []).length;
          chains.push(sm);
        }
      }
      // loops in the letter (a, e, g …): where two branches meet again without sharing a near ancestor, graft them
      const grafts = [];
      const aliveSet = new Set(ord);
      for (const p of ord) for (const o of N8) {
        const q = p + o;
        if (q < p || !aliveSet.has(q) || parent[q] === p || parent[p] === q) continue;
        const anc = new Set(); let a = p; for (let k = 0; k < 14 && a >= 0; k++) { anc.add(a); a = parent[a]; }
        let b = q, met = false; for (let k = 0; k < 14 && b >= 0; k++) { if (anc.has(b)) { met = true; break; } b = parent[b]; }
        if (!met) grafts.push([pt(p), pt(q)]);
      }
      out.comps.push({ chains, grafts, root: pt(cp.root) });
    }
    return out;
  }

  function smooth(pts) {
    if (pts.length < 5) return pts;
    const r = 3, o = pts.map(p => ({ ...p }));
    for (let i = 1; i < pts.length - 1; i++) {
      const k = Math.min(r, i, pts.length - 1 - i);
      let sx = 0, sy = 0;
      for (let j = -k; j <= k; j++) { sx += pts[i + j].x; sy += pts[i + j].y; }
      o[i].x = sx / (2 * k + 1); o[i].y = sy / (2 * k + 1);
    }
    return o;
  }

  // Zhang-Suen thinning inside the ink bounds
  function thin(m, W, x0, y0, x1, y1) {
    const del = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (let pass = 0; pass < 2; pass++) {
        del.length = 0;
        for (let y = Math.max(1, y0); y <= Math.min(y1, (m.length / W) - 2); y++) for (let x = Math.max(1, x0); x <= x1; x++) {
          const i = y * W + x; if (!m[i]) continue;
          const p2 = m[i - W], p3 = m[i - W + 1], p4 = m[i + 1], p5 = m[i + W + 1], p6 = m[i + W], p7 = m[i + W - 1], p8 = m[i - 1], p9 = m[i - W - 1];
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
          if (A !== 1) continue;
          if (pass === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
          del.push(i);
        }
        if (del.length) { changed = true; for (const i of del) m[i] = 0; }
      }
    }
  }

  // ---------- display geometry for one species
  function layoutLines() {
    const words = linesFor(stage, ['Idan', 'Segev']);
    return cssW / cssH < 1 ? words : [words.join(' ')];
  }

  function buildTree() {
    const lines = layoutLines();
    const key = lines.join('\n');
    if (key !== skelKey) { skel = buildSkeleton(lines); skelKey = key; }
    const sp = SPECIES[P.species];
    const [x0, y0, x1, y1] = skel.bbox;
    const bw = x1 - x0, bh = y1 - y0;
    const narrow = cssW < 640;
    const k = Math.min((narrow ? 0.8 : 0.66) * cssW / bw, (lines.length > 1 ? 0.5 : 0.36) * cssH / bh);
    const ox = cssW / 2 - (x0 + bw / 2) * k, oy = cssH * 0.45 - (y0 + bh / 2) * k;
    const H = skel.cap * k;
    const rnd = rng(P.seed * 9973 + ORDER.indexOf(P.species) * 131);
    const gAmp = sp.gnarl * P.gnarl * H * 0.06, gS = P.seed;
    const disp = (x, y) => [
      gAmp * (noise(x / (H * 0.38), y / (H * 0.38), gS) + 0.4 * noise(x / (H * 0.12), y / (H * 0.12), gS + 5)),
      gAmp * (noise(x / (H * 0.38) + 17, y / (H * 0.38) + 9, gS) + 0.4 * noise(x / (H * 0.12) + 3, y / (H * 0.12) + 11, gS + 5)),
    ];
    const width = f => H * P.thick * (sp.tip + (sp.trunk - sp.tip) * (sp.exp ? Math.pow(f, sp.exp) : 1));
    const toD = (p, delay) => {
      const X = ox + p.x * k, Y = oy + p.y * k, [dx, dy] = disp(X, Y);
      return { x: X + dx, y: Y + dy, d: p.d * k + delay, w: width(p.f) };
    };

    const T = { H, chains: [], grafts: [], twigs: [], marks: [], pending: [], maxD: 0 };
    for (const cp of skel.comps) {
      const delay = rnd() * H * 0.35;
      for (const ch of cp.chains) {
        const pts = ch.map(p => toD(p, delay));
        pts.terminal = ch.terminal;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
          const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          pts[i].tx = (b.x - a.x) / l; pts[i].ty = (b.y - a.y) / l;
          T.maxD = Math.max(T.maxD, pts[i].d);
        }
        T.chains.push(pts);
        spawnTwigs(T, pts, sp, rnd);
        spawnMarks(T, pts, sp, rnd, toD(cp.root, 0).y);
      }
      for (const [a, b] of cp.grafts) T.grafts.push([toD(a, delay), toD(b, delay)]);
    }
    for (const tw of T.twigs) T.maxD = Math.max(T.maxD, tipD(tw));
    T.maxD += H * 0.15;
    tree = T;
  }

  function tipD(tw) { let m = tw.d + tw.len; for (const c of tw.kids) m = Math.max(m, tipD(c.tw || c.br)); return m; }

  // ---------- ez-tree branching (after dgreenheck/ez-tree, MIT), flattened to 2D.
  // Per level: children, angle, length, radius, taper, gnarliness, start, sections; one growth force.
  // Thin wood wiggles and bends more than thick wood (both scale with 1/radius), children are spread
  // stratified along the parent, deciduous branches continue as a terminal leader, and each child gets a
  // random angle around its parent, projected to the page, so some point at the viewer and read short.
  const useEz = sp => P.model === 'ez' && !!sp.br;
  const radN = (w, H) => Math.max(0.02, w / 2 / (H * 0.04));   // width → ez-tree's radius units
  function makeBranch(level, len, w, d, br, sp, rnd, H) {
    const ev = br.type === 'evergreen', n = br.sections[level], sl = len / n;
    const wr = [], dA = [], fs = [];
    for (let i = 0; i <= n; i++) {
      let r = ev ? w * (1 - i / n) : w * (1 - br.taper[level] * (i / n));
      if (i === n && level === br.levels) r = w * 0.15;
      wr.push(r);
    }
    for (let i = 0; i < n; i++) {
      const rn = radN(wr[i], H);
      dA.push((rnd() * 2 - 1) * br.gnarl[level] * P.gnarl * Math.max(1, 1 / Math.sqrt(rn)));
      fs.push(br.force.s / rn);
    }
    const b = { br: true, len, n, sl, w, wr, dA, fs, st: dA, d, level, side: 1, kids: [], leaf: [] };
    if (level < br.levels) {
      if (!ev) b.kids.push({ j: n, rel: 0, br: makeBranch(level + 1, br.length[level + 1] * H * P.twigLen, wr[n], d + len, br, sp, rnd, H) });
      const count = Math.max(0, Math.round(br.children[level] * P.twigs));
      const start = br.start[level + 1] || 0, step = (1 - start) / Math.max(1, count), off = rnd();
      const slots = [...Array(count).keys()].sort(() => rnd() - 0.5);
      for (let i = 0; i < count; i++) {
        const t = start + (i + rnd()) * step, j = clamp(Math.round(t * n), 1, n);
        const { rel, fore } = project(br.angle[level + 1], 2 * Math.PI * (off + (slots[i] + rnd() - 0.5) / count));
        const cl = br.length[level + 1] * H * P.twigLen * (ev ? 1 - t : 1) * (0.85 + 0.3 * rnd()) * fore;
        b.kids.push({ j, rel, br: makeBranch(level + 1, cl, br.radius[level + 1] * wr[j], d + j * sl, br, sp, rnd, H) });
      }
    }
    if (level === br.levels || sp.leaf === 'needle' || !b.kids.length) {
      const nl = { cluster: 7, catkin: 2, needle: n, blossom: 4, fruit: 4, bract: 2, pad: 6 }[sp.leaf] || 0;
      for (let i = 0; i < nl; i++) b.leaf.push({ r1: rnd(), r2: rnd(), r3: rnd(), on: rnd() < P.leaves / 1.2 });
    }
    return b;
  }
  // a child at `deg` from its parent, turned `radial` around it, as seen on the page
  function project(deg, radial) {
    const a = deg * Math.PI / 180, px = Math.sin(a) * Math.cos(radial), py = Math.cos(a);
    return { rel: Math.atan2(px, py), fore: Math.max(0.35, Math.hypot(px, py)) };
  }
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  function pull(a, target, s) {
    const diff = wrapA(target - a), m = Math.abs(diff);
    return Math.sign(diff) * clamp(s, -m, m);
  }
  function drawBranch(b, x, y, a, front, sp, H) {
    if (front <= b.d) return;
    const F = sp.br.force, ft = Math.atan2(F.dir[1], F.dir[0]);
    const s = sway(b, x, H), rot = s.x * -Math.sin(a), bend = 2 / (b.n * (b.n + 1));
    let px = x, py = y, done = true;
    const at = [];
    ctx.lineCap = 'round';
    for (let i = 0; i < b.n; i++) {
      const d0 = b.d + i * b.sl;
      if (d0 >= front) { done = false; break; }
      a += b.dA[i] + pull(a, ft, b.fs[i]) + rot * bend * (i + 1);
      const u = Math.min(1, (front - d0) / b.sl);
      const nx = px + Math.cos(a) * b.sl * u, ny = py + Math.sin(a) * b.sl * u;
      ctx.lineWidth = Math.max(0.6, (b.wr[i] + b.wr[i + 1]) / 2);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      px = nx; py = ny; at.push([px, py, a, d0 + b.sl * u]);
      if (u < 1) { done = false; break; }
    }
    for (const c of b.kids) { const p = at[c.j - 1]; if (p) drawBranch(c.br, p[0], p[1], p[2] + c.rel, front, sp, H); }
    useFL(s);
    drawLeaves(b, at, done && !b.kids.some(c => c.rel === 0), front, sp, H);
  }

  // level-1 limbs along the letter; mostly to the sides so the stroke stays readable
  function spawnBranches(T, pts, sp, rnd) {
    const br = sp.br, H = T.H;
    if (P.twigs <= 0) return;
    const every = br.every * H / P.twigs;
    let acc = every * rnd(), next = every * (0.6 + 0.8 * rnd());
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      if (acc < next || p.d < H * 0.14) continue;
      acc = 0; next = every * (0.6 + 0.8 * rnd());
      T.twigs.push(ezLimbAt(T, p, sp, rnd));
    }
  }
  function ezLimbAt(T, p, sp, rnd) {
    const br = sp.br, H = T.H;
    {
      let radial = rnd() * Math.PI * 2;
      if (Math.abs(Math.cos(radial)) < 0.5) radial = (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.6;
      const { rel, fore } = project(br.angle[1], radial);
      const a = Math.atan2(p.ty, p.tx) + rel;
      let len = br.length[1] * H * P.twigLen * (0.8 + 0.4 * rnd()) * fore;
      if (br.type === 'evergreen') len *= clamp(p.w / (sp.trunk * H * P.thick), 0.3, 1);
      const b = makeBranch(1, len, Math.min(p.w * br.radius[1], br.maxW * H * 1.6), p.d, br, sp, rnd, H);
      b.x = p.x + Math.cos(a) * p.w * 0.35; b.y = p.y + Math.sin(a) * p.w * 0.35; b.a = a;
      return b;
    }
  }

  function spawnTwigs(T, pts, sp, rnd) {
    if (useEz(sp)) return spawnBranches(T, pts, sp, rnd);
    const tw = sp.tw;
    if (!tw || P.twigs <= 0) return;
    if (tw.endsOnly) {
      // a crown only where a stroke ends (palm, baobab)
      if (!pts.terminal || pts.length < 3) return;
      const p = pts[pts.length - 1], n = Math.max(1, Math.round(tw.count * P.twigs)), H = T.H;
      for (let k = 0; k < n; k++) {
        let a = Math.atan2(p.ty, p.tx) + (n > 1 ? k / (n - 1) - 0.5 : 0) * tw.spread + (rnd() * 2 - 1) * tw.angJ * Math.PI / 180;
        const vx = Math.cos(a) * (1 - tw.up), vy = Math.sin(a) * (1 - tw.up) - tw.up;
        a = Math.atan2(vy, vx);
        T.twigs.push(makeTwig(p.x, p.y, a, tw.len * H * P.twigLen * (0.75 + 0.5 * rnd()), Math.min(p.w * 0.6, tw.w * H * 1.6), p.d, 0, tw, sp, rnd, k < n / 2 ? -1 : 1));
      }
      return;
    }
    const H = T.H, every = (tw.every * H) / P.twigs;
    let acc = every * rnd(), side = rnd() < 0.5 ? 1 : -1, next = every * (0.6 + 0.8 * rnd());
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      if (acc < next || p.d < H * 0.14) continue;
      acc = 0; next = every * (0.6 + 0.8 * rnd()); side = -side;
      T.twigs.push(classicLimbAt(T, p, side, sp, rnd));
    }
  }
  function classicLimbAt(T, p, side, sp, rnd) {
    const tw = sp.tw, H = T.H;
    {
      const ta = Math.atan2(p.ty, p.tx);
      let a = ta + side * (tw.ang + (rnd() * 2 - 1) * tw.angJ) * Math.PI / 180;
      let vx = Math.cos(a) * (1 - tw.up), vy = (Math.sin(a) * (1 - tw.up) - tw.up) * (1 - (tw.level || 0));
      if (tw.arch) { vx = Math.sign(vx || 1) * Math.max(Math.abs(vx), 0.6); vy = -Math.abs(vy) * 0.3 - 0.25; }  // prop roots: out, then down
      a = Math.atan2(vy, vx);
      let len = tw.len * H * P.twigLen * (0.65 + 0.6 * rnd());
      if (tw.byWidth) len *= clamp(p.w / (sp.trunk * H * P.thick), 0.3, 1);
      const base = { x: p.x + Math.cos(a) * p.w * 0.35, y: p.y + Math.sin(a) * p.w * 0.35 };
      return makeTwig(base.x, base.y, a, len, Math.min(p.w * 0.55, tw.w * H * 1.6), p.d, 0, tw, sp, rnd, side);
    }
  }

  // one new limb somewhere on the letters, for the life cycle
  function respawnLimb(T, sp, rnd) {
    const ez = useEz(sp), tw = sp.tw, H = T.H;
    if (!ez && !tw) return null;
    if (!ez && tw.endsOnly) {
      const ends = T.chains.filter(c => c.terminal && c.length > 2);
      if (!ends.length) return null;
      const c = ends[(rnd() * ends.length) | 0], p = c[c.length - 1];
      let a = Math.atan2(p.ty, p.tx) + (rnd() - 0.5) * tw.spread;
      a = Math.atan2(Math.sin(a) * (1 - tw.up) - tw.up, Math.cos(a) * (1 - tw.up));
      return makeTwig(p.x, p.y, a, tw.len * H * P.twigLen * (0.75 + 0.5 * rnd()), Math.min(p.w * 0.6, tw.w * H * 1.6), p.d, 0, tw, sp, rnd, rnd() < 0.5 ? -1 : 1);
    }
    const total = T.chains.reduce((s, c) => s + c.length, 0);
    for (let tries = 0; tries < 12; tries++) {
      let r = rnd() * total, c = T.chains[0];
      for (const ch of T.chains) { if (r < ch.length) { c = ch; break; } r -= ch.length; }
      const p = c[(rnd() * c.length) | 0];
      if (!p || p.d < H * 0.14 || p.tx === undefined) continue;
      return ez ? ezLimbAt(T, p, sp, rnd) : classicLimbAt(T, p, rnd() < 0.5 ? -1 : 1, sp, rnd);
    }
    return null;
  }

  function makeTwig(x, y, a, len, w, d, depth, tw, sp, rnd, side = 1) {
    const st = []; for (let i = 0; i < tw.steps; i++) st.push((rnd() * 2 - 1) * tw.jit);
    const t = { x, y, a, len, w, d, st, side, kids: [], leaf: [] };
    if (tw.fork && depth < tw.depth) {
      // dichotomous: the twig ends in a Y
      for (const sd of [-1, 1]) {
        const rel = sd * (tw.ang + (rnd() * 2 - 1) * tw.angJ) * Math.PI / 180;
        t.kids.push({ j: tw.steps - 1, rel, tw: makeTwig(0, 0, 0, len * tw.decay * (0.8 + 0.4 * rnd()), w * 0.8, d + len, depth + 1, tw, sp, rnd) });
      }
    } else if (depth < (tw.depth || 0)) {
      let side = rnd() < 0.5 ? 1 : -1;
      for (let j = 2; j < tw.steps - 1; j += tw.childEvery + (rnd() < 0.5 ? 1 : 0)) {
        side = -side;
        const rel = side * (tw.ang * 0.75 + (rnd() * 2 - 1) * tw.angJ) * Math.PI / 180;
        const cl = len * tw.decay * (0.7 + 0.5 * rnd()) * (1 - j / tw.steps * 0.4);
        t.kids.push({ j, rel, tw: makeTwig(0, 0, 0, cl, w * 0.6, d + (j / tw.steps) * len, depth + 1, tw, sp, rnd) });
      }
    }
    // foliage seeds
    const n = { cluster: 7, catkin: 2, dash: tw.steps, needle: tw.steps, blossom: 4, pompom: 1, fruit: 4, bract: 2, raceme: 1, blade: 3, pad: 6, pinna: tw.steps, ivy: tw.steps, weep: tw.steps, frond: tw.steps }[sp.leaf] || 0;
    for (let i = 0; i < n; i++) t.leaf.push({ r1: rnd(), r2: rnd(), r3: rnd(), on: rnd() < P.leaves / 1.2 });
    return t;
  }

  // species bark marks along the trunk (saguaro spines, birch lenticels)
  function spawnMarks(T, pts, sp, rnd, groundY) {
    if (sp.body === 'paddles') {
      // chains of flat pads, each laid along a stretch of the stroke
      const H = T.H;
      let s = 0, acc = 0, L = H * 0.3 * (0.85 + 0.3 * rnd());
      for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        const last = i === pts.length - 1;
        if (acc < L && !last) continue;
        if (acc > H * 0.1) {
          const m = pts[(s + i) >> 1], ar = [];
          for (let k = 0; k < 7; k++) ar.push([rnd() * 2 - 1, rnd() * 2 - 1]);
          T.marks.push({ x: m.x, y: m.y, a: Math.atan2(m.ty, m.tx), d0: pts[s].d, d1: pts[i].d, len: acc, ar });
        }
        s = i; acc = 0; L = H * 0.3 * (0.85 + 0.3 * rnd());
      }
      return;
    }
    if (sp.body === 'aerial') {
      // roots dropped from the branches to the letter's footing
      const H = T.H;
      let acc = 0, next = H * 0.08 * rnd();
      for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (acc < next) continue; acc = 0; next = H * (0.06 + 0.06 * rnd());
        const p = pts[i];
        if (p.y > groundY - H * 0.15 || rnd() > 0.75) continue;
        T.marks.push({ x: p.x, y: p.y, d: p.d, g: groundY + H * 0.04, r: rnd() });
      }
      return;
    }
    if (sp.body === 'scarred') {
      const H = T.H;
      let acc = 0, next = H * 0.05 * rnd();
      for (let i = 1; i < pts.length - 2; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (acc < next) continue; acc = 0; next = H * (0.04 + 0.015 * rnd());
        T.marks.push({ i, pts });
      }
      return;
    }
    const H = T.H;
    if (sp.body === 'ribbed') {
      let acc = 0, next = H * 0.04;
      for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (acc < next) continue; acc = 0; next = H * (0.03 + 0.03 * rnd());
        if (rnd() > P.leaves * 0.75) continue;
        T.marks.push({ i, pts, side: rnd() < 0.5 ? 1 : -1, r: rnd() });
      }
    } else if (sp.body === 'jointed') {
      let acc = 0, next = H * 0.12 * rnd();
      for (let i = 1; i < pts.length - 2; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (acc < next) continue; acc = 0; next = H * (0.16 + 0.05 * rnd());
        T.marks.push({ i, pts, joint: true });
      }
    } else if (sp.body === 'outline') {
      let acc = 0, next = H * 0.05;
      for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (acc < next) continue; acc = 0; next = H * (0.03 + 0.07 * rnd());
        if (pts[i].w < H * 0.05) continue;
        T.marks.push({ i, pts, off: (rnd() * 2 - 1) * 0.3, len: 0.25 + 0.4 * rnd(), r: rnd() });
      }
    }
  }

  // ---------- drawing
  const rgb = (f) => `rgb(${f[0] * 255 | 0},${f[1] * 255 | 0},${f[2] * 255 | 0})`;
  function ink() { return rgb(stage.colors.fg); }
  function page() { return rgb(stage.colors.bg); }

  function strokeChain(pts, front, wMul, wAdd, offN) {
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a.d > front) break;
      let bx = b.x, by = b.y;
      if (b.d > front) { const u = (front - a.d) / Math.max(1e-6, b.d - a.d); bx = a.x + (b.x - a.x) * u; by = a.y + (b.y - a.y) * u; }
      const w = b.w * wMul + wAdd;
      if (w <= 0.2) continue;
      let ax = a.x, ay = a.y;
      if (offN) { ax += -a.ty * a.w * offN; ay += a.tx * a.w * offN; bx += -b.ty * b.w * offN; by += b.tx * b.w * offN; }
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
  }

  function drawTwig(tw, x, y, a, front, sp, H) {
    if (front <= tw.d) return false;
    const T = sp.tw, n = tw.st.length, sl = tw.len / n;
    const s = sway(tw, x, H), rot = s.x * -Math.sin(a), bend = 2 / (n * (n + 1));
    let px = x, py = y, done = true;
    const at = [];
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const d0 = tw.d + i * sl;
      if (d0 >= front) { done = false; break; }
      a += tw.st[i] + (T.curl || 0) * tw.side * Math.pow((i + 1) / n, 3) + T.grav * (sl / H) * Math.cos(a) + rot * bend * (i + 1);
      const u = Math.min(1, (front - d0) / sl);
      const nx = px + Math.cos(a) * sl * u, ny = py + Math.sin(a) * sl * u;
      ctx.lineWidth = Math.max(0.6, tw.w * (1 - 0.72 * (i / n)));
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      px = nx; py = ny; at.push([px, py, a, d0 + sl * u]);
      if (u < 1) { done = false; break; }
    }
    for (const c of tw.kids) if (at[c.j]) drawTwig(c.tw, at[c.j][0], at[c.j][1], at[c.j][2] + c.rel, front, sp, H);
    useFL(s);
    drawLeaves(tw, at, done, front, sp, H);
    return true;
  }

  // ---------- wind
  // Every twig and branch is a damped spring that swings from its base. Thin, long wood is slow and soft;
  // thick, short wood is quick and stiff. A gust starts at the pointer and crosses the page in its
  // direction of travel, and noise breaks it up, so neighbours move out of step, overshoot and settle.
  const SIM = { now: 0, dt: 0, last: 0, e: 0 };
  const GUST = { hist: [], x: 0, dir: 1, live: -1e9 };
  const FL = { x: 0, v: 0, flut: 0, now: 0 };   // the sway of the node whose foliage is being drawn
  function windAt(x) {
    const h = GUST.hist, dx = (x - GUST.x) * GUST.dir;
    if (!h.length) return 0;
    const t = SIM.now - (Math.max(0, dx) / Math.max(1, cssW)) * 1100, fade = dx < 0 ? Math.exp(dx / (cssW * 0.3)) : 1;
    if (h[0][0] > t) return 0;
    let lo = 0, hi = h.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (h[m][0] <= t) lo = m; else hi = m - 1; }
    return h[lo][1] * fade;
  }
  function sway(o, x, H) {
    let s = o.o;
    if (!s) {
      const f = clamp(0.8 * Math.sqrt(Math.max(o.w, 0.5) / (H * 0.015)) * (H * 0.25 / Math.max(o.len, H * 0.03)), 0.4, 3.2);
      s = o.o = { x: 0, v: 0, t: -1, fl: 0, f, c: clamp(0.03 / (f * f), 0.006, 0.2), ph: (o.d * 0.37 + o.len * 1.7) % 50 };
    }
    if (s.t !== SIM.now) {
      s.t = SIM.now;
      const w = windAt(x) * P.wind;
      if (SIM.dt > 0) {
        const g = w * (1 + 0.6 * noise(SIM.now * 0.0012 * s.f + s.ph, s.ph, 3));
        const X = 0.9 * Math.tanh((g * s.c) / 0.9), om = 2 * Math.PI * s.f;
        s.v += (om * om * (X - s.x) - 2 * 0.12 * om * s.v) * SIM.dt;
        s.x += s.v * SIM.dt;
      }
      s.fl = Math.min(1.2, Math.abs(w) * 0.2 + Math.abs(s.v) * 0.15);
      SIM.e = Math.max(SIM.e, Math.abs(s.x) + Math.abs(s.v) * 0.1);
    }
    return s;
  }
  function useFL(s) { FL.x = s.x; FL.v = s.v; FL.flut = s.fl; }
  // leaves flutter faster than the wood that holds them
  const flut = (l, k = 1) => FL.flut * k * Math.sin(FL.now * (0.012 + 0.01 * l.r2) + l.r1 * 40);
  // pendants (racemes, catkins, fruit) hang, swing further than their twig, and trail behind it
  const hangA = (k = 1.3) => Math.PI / 2 - FL.x * k + FL.v * 0.04;

  // ---------- inflorescences
  // A flowering tip carries one or two inflorescences. Each picks a form from its species' list, and every
  // flower gets its own size, petal count, tilt, view and final stage, so no two tips match.
  const TAU = Math.PI * 2;
  const pick = (r, arr) => arr[(r() * arr.length) | 0];
  const seedOf = (l, i = 0) => ((l.r1 * 4294967296) ^ (l.r2 * 65536 + i * 7919)) >>> 0;
  const fate = (r, st) => { const q = r(); return q < (st.buds || 0) ? 0.12 + 0.15 * r() : q < (st.buds || 0) + 0.15 ? 0.5 : 1; };
  const kind = (r, st) => ({ n: pick(r, st.petals || [5]), shape: st.shape, dbl: r() < (st.dbl || 0), hollow: st.hollow, side: r() < (st.side || 0), rot: r() * TAU, tilt: 0.35 + 0.65 * r(), ta: r() * TAU });
  function stem(x0, y0, x1, y1, w) { ctx.lineWidth = Math.max(0.5, w); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }

  // one flower of radius r facing `dir`: a bud below 0.3 open, a half-open cup below 0.65, then a face
  // foreshortened by its tilt
  function flower(x, y, r, dir, k, open) {
    if (r < 0.4) return;
    if (open < 0.3) {
      const b = r * (0.3 + 0.6 * open);
      ctx.beginPath(); ctx.ellipse(x + Math.cos(dir) * b * 0.5, y + Math.sin(dir) * b * 0.5, b, b * 0.6, dir, 0, TAU); ctx.fill();
      return;
    }
    if (open < 0.65 || k.side) {
      const u = k.side ? 1 : (open - 0.3) / 0.35, spr = 0.25 + 0.45 * u, pl = r * (0.8 + 0.35 * u);
      ctx.beginPath();
      for (const dd of [-1, 1, 0]) {
        const pa = dir + dd * spr, cx = x + Math.cos(pa) * pl * 0.5, cy = y + Math.sin(pa) * pl * 0.5;
        ctx.moveTo(cx + Math.cos(pa) * pl * 0.5, cy + Math.sin(pa) * pl * 0.5); ctx.ellipse(cx, cy, pl * 0.5, pl * (0.24 + 0.08 * u), pa, 0, TAU);
      }
      ctx.fill();
      return;
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(k.ta); ctx.scale(1, k.tilt); ctx.rotate(-k.ta);
    const n = k.n, [lx, ly] = k.shape === 'pointed' ? [0.56, 0.22] : k.shape === 'round' ? [0.5, 0.42] : [0.52, 0.34];
    const ring = (rr, off, sc = 1) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const pa = k.rot + off + i * TAU / n, cx = Math.cos(pa) * rr * 0.5, cy = Math.sin(pa) * rr * 0.5;
        ctx.moveTo(cx + Math.cos(pa) * rr * lx * sc, cy + Math.sin(pa) * rr * lx * sc); ctx.ellipse(cx, cy, rr * lx * sc, rr * ly * sc, pa, 0, TAU);
      }
    };
    ring(r, 0); ctx.fill();
    if (k.hollow) { ctx.fillStyle = page(); ring(r, 0, 0.66); ctx.fill(); ctx.fillStyle = ink(); }
    if (k.dbl) { ctx.strokeStyle = page(); ctx.lineWidth = Math.max(0.6, r * 0.1); ring(r * 0.62, Math.PI / n); ctx.stroke(); ctx.fill(); ctx.strokeStyle = ink(); }
    if (k.shape === 'notched' && r > 2.5) {
      ctx.fillStyle = page(); ctx.beginPath();
      for (let i = 0; i < n; i++) { const pa = k.rot + i * TAU / n, px = Math.cos(pa) * r * 1.02, py = Math.sin(pa) * r * 1.02; ctx.moveTo(px + r * 0.14, py); ctx.arc(px, py, r * 0.14, 0, TAU); }
      ctx.fill(); ctx.fillStyle = ink();
    }
    // the eye, ringed with stamens when there is room
    ctx.fillStyle = page(); ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = ink();
    ctx.beginPath();
    if (r > 3.2) for (let i = 0; i < 7; i++) { const sa = k.rot * 3 + i * TAU / 7, px = Math.cos(sa) * r * 0.19, py = Math.sin(sa) * r * 0.19; ctx.moveTo(px + r * 0.055, py); ctx.arc(px, py, r * 0.055, 0, TAU); }
    else ctx.arc(0, 0, r * 0.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function inflorescence(form, x, y, a, s, H, st, r) {
    const R = H * st.size, ph = r() * TAU, sw = i => FL.flut * 0.3 * Math.sin(FL.now * 0.013 + i * 2.1 + ph);
    const open = (dl, mx) => Math.min(mx, clamp((s - dl) / 0.5, 0, 1));
    const lean = (ang, k) => ang + wrapA(hangA() - ang) * k;
    ctx.lineCap = 'round';
    if (form === 'solitary') {
      const d = lean(a + (r() - 0.5) * 0.8, st.droop || 0) + sw(0), L = R * (0.8 + r()) * s;
      const fx = x + Math.cos(d) * L, fy = y + Math.sin(d) * L;
      stem(x, y, fx, fy, R * 0.1); flower(fx, fy, R * (1.25 + 0.3 * r()) * s, d, kind(r, st), open(0, Math.max(0.5, fate(r, st))));
    } else if (form === 'umbel' || form === 'ball') {
      // stalks from one point; a ball (ivy) is a full sphere of short ones tipped with tiny flowers
      const ball = form === 'ball', m = ball ? 10 + ((r() * 8) | 0) : 2 + ((r() * 4) | 0);
      const c = lean(a, st.droop || 0), spr = ball ? Math.PI : 0.8 + 0.5 * r();
      for (let i = 0; i < m; i++) {
        const d = c + ((i + 0.5) / m - 0.5) * spr * 2 + (r() - 0.5) * 0.3 + sw(i), L = R * (ball ? 1.4 + 0.4 * r() : 1.8 + 1.4 * r()) * s;
        const fx = x + Math.cos(d) * L, fy = y + Math.sin(d) * L, fr = R * (0.75 + 0.4 * r()) * s;
        stem(x, y, fx, fy, R * 0.08);
        if (ball) { ctx.beginPath(); ctx.arc(fx, fy, fr * 0.45, 0, TAU); ctx.fill(); }
        else flower(fx, fy, fr, d, kind(r, st), open(0.25 * i / m, fate(r, st)));
      }
    } else if (form === 'corymb') {
      // stalks up a short axis, longer below, so the flowers sit level; the king flower opens first
      const c = lean(a, (st.droop || 0) * 0.5), L = R * (1.8 + r()) * s, m = 4 + ((r() * 3) | 0);
      const ex = x + Math.cos(c) * L, ey = y + Math.sin(c) * L;
      stem(x, y, ex, ey, R * 0.12);
      for (let i = 0; i < m; i++) {
        const u = i / m, bx = x + Math.cos(c) * L * u, by = y + Math.sin(c) * L * u, sd = i % 2 ? 1 : -1;
        const d = c + sd * (0.7 + 0.5 * r()) + sw(i), pl = R * (2.2 * (1 - u) + 0.9) * s;
        const fx = bx + Math.cos(d) * pl, fy = by + Math.sin(d) * pl;
        stem(bx, by, fx, fy, R * 0.07); flower(fx, fy, R * (0.8 + 0.3 * r()) * s, d, kind(r, st), open(0.15 + 0.3 * u, fate(r, st)));
      }
      flower(ex, ey, R * 1.15 * s, c, kind(r, st), open(0, 1));
    } else if (form === 'cyme') {
      // a central flower, then two side arms each ending in a younger flower and a bud
      const c = lean(a, (st.droop || 0) * 0.5), L = R * 1.2 * s, cx = x + Math.cos(c) * L, cy = y + Math.sin(c) * L;
      stem(x, y, cx, cy, R * 0.1);
      for (const sd of [-1, 1]) {
        const d = c + sd * (0.7 + 0.3 * r()) + sw(sd), al = R * (1.5 + 0.6 * r()) * s, ax = x + Math.cos(d) * al, ay = y + Math.sin(d) * al;
        stem(x, y, ax, ay, R * 0.08); flower(ax, ay, R * 0.85 * s, d, kind(r, st), open(0.2, Math.min(0.6, fate(r, st)) + 0.4 * r()));
        const d2 = d + sd * 0.6, bx = ax + Math.cos(d2) * R * 1.1 * s, by = ay + Math.sin(d2) * R * 1.1 * s;
        stem(ax, ay, bx, by, R * 0.06); flower(bx, by, R * 0.6 * s, d2, kind(r, st), open(0.4, 0.25));
      }
      flower(cx, cy, R * 1.1 * s, c, kind(r, st), open(0, 1));
    } else if (form === 'raceme' || form === 'racemeYoung') {
      // a hanging axis that trails behind its twig; open at the top, buds toward the tip
      const young = form === 'racemeYoung', m = young ? 7 + ((r() * 4) | 0) : 12 + ((r() * 14) | 0);
      const len = H * (st.len || 0.2) * (young ? 0.3 : 0.55 + 0.8 * r()) * s, sl = len / m, curve = (r() - 0.5) * 0.05;
      let ang = young ? lean(a, 0.4) : lean(a, 0.85), px = x, py = y;
      for (let i = 0; i < m; i++) {
        const u = i / m;
        ang += curve + wrapA(hangA(1.3 + u) - ang) * (young ? 0.03 : 0.12) - FL.v * 0.006 * u;
        const nx = px + Math.cos(ang) * sl, ny = py + Math.sin(ang) * sl;
        stem(px, py, nx, ny, R * 0.14 * (1 - u * 0.6));
        const sd = i % 2 ? 1 : -1, fa = ang + sd * (1 + 0.3 * r()) + sw(i) * 0.5, fr = R * (1 - u * 0.55) * (0.85 + 0.3 * r()) * s;
        const mx = young ? 0.2 : u < 0.5 ? 1 : u < 0.78 ? 0.5 : 0.18;
        flower(nx + Math.cos(fa) * fr * 0.5, ny + Math.sin(fa) * fr * 0.5, fr, fa, { side: st.pea || r() < 0.5 }, open(0.05 + 0.45 * u, mx));
        px = nx; py = ny;
      }
    } else if (form === 'panicle') {
      // an upright spire of branched stalks hung with bells, buds at the top
      const c = a + wrapA(-Math.PI / 2 - a) * 0.75 + sw(0) * 0.3, len = H * (0.12 + 0.1 * r()) * s, m = 6 + ((r() * 3) | 0);
      const ex = x + Math.cos(c) * len, ey = y + Math.sin(c) * len;
      stem(x, y, ex, ey, R * 0.25);
      for (let i = 0; i < m; i++) {
        const u = (i + 0.5) / m, bx = x + Math.cos(c) * len * u, by = y + Math.sin(c) * len * u, sd = i % 2 ? 1 : -1;
        const d = c + sd * (1 + 0.2 * r()), bl = R * (2.6 * (1 - u) + 0.7) * s, tx = bx + Math.cos(d) * bl, ty = by + Math.sin(d) * bl;
        stem(bx, by, tx, ty, R * 0.1);
        for (let j = 0; j < 3; j++) {
          const v = (j + 1) / 3, fx = bx + (tx - bx) * v, fy = by + (ty - by) * v, hd = hangA(0.8) + sw(i + j);
          flower(fx + Math.cos(hd) * R * 0.5, fy + Math.sin(hd) * R * 0.5, R * (0.9 - 0.3 * u) * s, hd, { side: true }, open(0.1 + 0.5 * u, u > 0.8 ? 0.2 : fate(r, st)));
        }
      }
      flower(ex, ey, R * 0.6 * s, c, {}, open(0.6, 0.2));
    } else if (form === 'bracts' || form === 'bracts2') {
      // dogwood heads: four outlined bracts round a knot of florets, each head tilted its own way
      const m = form === 'bracts2' ? 2 : 1;
      for (let i = 0; i < m; i++) {
        const d = a + (m > 1 ? (i - 0.5) * 1.1 : (r() - 0.5) * 0.5) + sw(i), L = R * (m > 1 ? 1.4 : 0.5) * s;
        const fx = x + Math.cos(d) * L, fy = y + Math.sin(d) * L, o = open(0.1 * i, fate(r, st));
        if (m > 1) stem(x, y, fx, fy, R * 0.07);
        flower(fx, fy, R * (0.75 + 0.35 * r()) * (0.4 + 0.6 * o) * s, d, kind(r, st), o < 0.3 ? o : 1);
      }
    } else if (form === 'catkin' || form === 'catkinUp') {
      // male catkins hang in twos and threes and swing; the female stands short and upright
      const up = form === 'catkinUp', m = up ? 1 : 1 + (r() < 0.4);
      for (let i = 0; i < m; i++) {
        const len = R * (up ? 2 + r() : 4 + 4 * r()) * s, n = 8, sl = len / n, cw = R * (up ? 0.8 : 0.55);
        let ang = up ? a + wrapA(-Math.PI / 2 - a) * 0.5 : lean(a, 0.8) + (i - (m - 1) / 2) * 0.35, px = x, py = y;
        const pts = [[px, py]];
        for (let j = 0; j < n; j++) {
          if (!up) ang += wrapA(hangA(1.5) + (i - (m - 1) / 2) * 0.25 - ang) * 0.15 - FL.v * 0.008 * (j / n);
          px += Math.cos(ang) * sl; py += Math.sin(ang) * sl; pts.push([px, py, ang]);
        }
        ctx.lineWidth = cw * s; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
        if (cw * s > 2.5) {
          ctx.strokeStyle = page(); ctx.lineWidth = Math.max(0.6, cw * 0.12); ctx.beginPath();
          for (let j = 2; j < pts.length - 1; j++) { const [qx, qy, qa] = pts[j], sd = j % 2 ? 1 : -1, nx = -Math.sin(qa) * sd, ny = Math.cos(qa) * sd; ctx.moveTo(qx, qy); ctx.lineTo(qx + (nx - Math.cos(qa) * 0.6) * cw * 0.35, qy + (ny - Math.sin(qa) * 0.6) * cw * 0.35); }
          ctx.stroke(); ctx.strokeStyle = ink();
        }
      }
    }
  }
  function tipInflo(tw, at, front, sp, H) {
    const st = sp.inflo, [x, y, a, d] = at[at.length - 1];
    const s = clamp((front - d) / (H * 0.12), 0, 1);
    if (s <= 0) return;
    for (let i = 0; i < Math.min(st.per, tw.leaf.length); i++) {
      const l = tw.leaf[i]; if (!l.on) continue;
      const r = rng(seedOf(l, i)), form = pick(r, st.forms);
      if (form !== 'none') inflorescence(form, x, y, a + (i ? (r() - 0.5) * 1.4 : 0), s, H, st, r);
    }
  }

  // leaves let go while a limb ages: the whole spray drifts down and fades
  const LF = { fall: 0 };
  function drawLeaves(tw, at, done, front, sp, H) {
    if (LF.fall <= 0) return drawFoliage(tw, at, done, front, sp, H);
    if (LF.fall >= 1) return;
    const f = LF.fall, sw = Math.sin(tw.d * 0.13 + (tw.len || 0) * 0.07);
    ctx.save();
    ctx.globalAlpha *= 1 - f * f;
    ctx.translate(sw * H * 0.07 * f, (f * f * 0.5 + f * 0.06) * H);
    drawFoliage(tw, at, done, front, sp, H);
    ctx.restore();
  }
  function drawFoliage(tw, at, done, front, sp, H) {
    if (P.leaves <= 0 || !at.length) return;
    const L = sp.leaf;
    if (sp.inflo && sp.inflo.per && done && !tw.kids.length) tipInflo(tw, at, front, sp, H);
    if (sp.inflo && !sp.inflo.extra && L !== 'weep') return;
    if (L === 'cluster' && done && !tw.kids.length) {
      const [x, y, a, d] = at[at.length - 1];
      const s = clamp((front - d) / (H * 0.12), 0, 1);
      if (s <= 0) return;
      for (const l of tw.leaf) {
        if (!l.on) continue;
        const ang = a + (l.r1 * 2 - 1) * 1.9 + flut(l, 0.5), r = H * 0.03 * l.r2 * s;
        const lx = x + Math.cos(ang) * r * 1.4, ly = y + Math.sin(ang) * r * 1.4;
        ctx.beginPath(); ctx.ellipse(lx, ly, H * (0.017 + 0.012 * l.r3) * s, H * (0.011 + 0.006 * l.r1) * s, ang, 0, Math.PI * 2); ctx.fill();
      }
    } else if (L === 'dash') {
      for (let i = 3; i < at.length; i += 1) {
        const l = tw.leaf[i]; if (!l || !l.on) continue;
        const [x, y, a] = at[i];
        const side = l.r1 < 0.5 ? 1 : -1, la = a + side * (0.35 + 0.3 * l.r2) + flut(l, 0.6);
        ctx.beginPath(); ctx.ellipse(x + Math.cos(la) * H * 0.012, y + Math.sin(la) * H * 0.012, H * 0.016, H * 0.0045, la, 0, Math.PI * 2); ctx.fill();
      }
    } else if (L === 'needle') {
      ctx.lineWidth = Math.max(0.6, H * 0.0035);
      for (let i = 1; i < at.length; i++) {
        const l = tw.leaf[i]; if (!l || !l.on) continue;
        const [x, y, a] = at[i], nl = H * (0.03 + 0.015 * l.r1);
        ctx.beginPath();
        for (const sd of [-1, 1]) { const na = a + sd * (0.75 + 0.2 * l.r2); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl); }
        ctx.stroke();
      }
    } else if ((L === 'pompom' || L === 'fruit') && done && !tw.kids.length) {
      const [x, y, a, d] = at[at.length - 1];
      const s = clamp((front - d) / (H * 0.12), 0, 1);
      if (s <= 0) return;
      if (L === 'pompom') {
        // spiky rosette: dense blades all round, a skirt of dead leaves below
        const l = tw.leaf[0]; if (!l.on) return;
        ctx.lineWidth = Math.max(0.6, H * 0.004); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let k = 0; k < 26; k++) {
          const ba = a + (k / 26 - 0.5) * Math.PI * 1.7 + Math.sin(k * 12.9898 + l.r1 * 40) * 0.08;
          const bl = H * (0.05 + 0.025 * Math.abs(Math.sin(k * 78.233 + l.r2 * 40))) * s;
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ba) * bl, y + Math.sin(ba) * bl);
        }
        for (let k = 0; k < 10; k++) {
          const ba = hangA(0.5) + (k / 9 - 0.5) * 1.6, bl = H * 0.035 * s;
          ctx.moveTo(x, y + H * 0.008); ctx.lineTo(x + Math.cos(ba) * bl, y + H * 0.008 + Math.sin(ba) * bl);
        }
        ctx.stroke();
      } else if (L === 'fruit') {
        for (const l of tw.leaf.slice(0, 3)) {
          if (!l.on) continue;
          const ang = a + (l.r1 * 2 - 1) * 1.6 + flut(l, 0.5);
          ctx.beginPath(); ctx.ellipse(x + Math.cos(ang) * H * 0.02, y + Math.sin(ang) * H * 0.02, H * 0.018 * s, H * 0.008 * s, ang, 0, Math.PI * 2); ctx.fill();
        }
        const f = tw.leaf[3];
        if (f.on && f.r3 < 0.55) {
          const sa = hangA(1.6) + (f.r1 - 0.5) * 0.4, sl = H * 0.022 * s, fr = H * (0.02 + 0.006 * f.r2) * s;
          const fx = x + Math.cos(sa) * (sl + fr), fy = y + Math.sin(sa) * (sl + fr);
          ctx.lineWidth = Math.max(0.6, H * 0.004);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(sa) * sl, y + Math.sin(sa) * sl); ctx.stroke();
          ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = page(); ctx.beginPath(); ctx.arc(fx - fr * 0.35, fy - fr * 0.35, fr * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = ink();
        }
      }
    } else if ((L === 'blade' || L === 'pad') && done && !tw.kids.length) {
      const [x, y, a, d] = at[at.length - 1];
      const s = clamp((front - d) / (H * 0.12), 0, 1);
      if (s <= 0) return;
      if (L === 'blade') {
        for (let k = 0; k < 3; k++) {
          const l = tw.leaf[k]; if (!l.on) continue;
          let ba = a + (k - 1) * 0.55 + (l.r1 - 0.5) * 0.3;
          ba += (Math.PI / 2 - ba) * 0.35 - FL.x * 0.8 + flut(l, 0.5);
          const bl = H * (0.08 + 0.04 * l.r2) * s, bw = H * 0.011 * s, ex = x + Math.cos(ba) * bl, ey = y + Math.sin(ba) * bl;
          const mx = x + Math.cos(ba) * bl * 0.4, my = y + Math.sin(ba) * bl * 0.4, nx = -Math.sin(ba) * bw, ny = Math.cos(ba) * bw;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx + nx, my + ny, ex, ey); ctx.quadraticCurveTo(mx - nx, my - ny, x, y); ctx.fill();
        }
      } else {
        // flat cloud pad
        ctx.beginPath();
        for (const l of tw.leaf) {
          if (!l.on) continue;
          const cx = x + (l.r1 * 2 - 1) * H * 0.045 * s, cy = y - H * 0.008 + (l.r2 * 2 - 1) * H * 0.01 * s, rx = H * (0.026 + 0.012 * l.r3) * s;
          ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, rx * 0.42, 0, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    } else if (L === 'pinna') {
      // leaflets both sides, shrinking toward the curled tip
      ctx.beginPath();
      for (let i = 1; i < at.length; i++) {
        const u = i / tw.st.length; if (u > 0.78) break;
        const l = tw.leaf[i]; if (!l || !l.on) continue;
        const [x, y, a] = at[i], pl = H * 0.032 * (1 - u * 0.8);
        for (const sd of [-1, 1]) {
          const pa = a + sd * 1.15 + flut(l, 0.3), cx = x + Math.cos(pa) * pl * 0.55, cy = y + Math.sin(pa) * pl * 0.55;
          ctx.moveTo(cx + pl * 0.5 * Math.cos(pa), cy + pl * 0.5 * Math.sin(pa)); ctx.ellipse(cx, cy, pl * 0.5, pl * 0.17, pa, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    } else if (L === 'weep') {
      // single flowers, pairs and threes along the strands, each at its own stage and tilt
      const st = sp.inflo;
      ctx.lineCap = 'round';
      for (let i = 3; i < at.length; i += 2) {
        const l = tw.leaf[i]; if (!l || !l.on) continue;
        const [x, y, a] = at[i], r = rng(seedOf(l, i)), sd = l.r1 < 0.5 ? 1 : -1, R = H * st.size * (0.7 + 0.5 * l.r2);
        const m = 1 + (r() < 0.45) + (r() < 0.2);
        for (let j = 0; j < m; j++) {
          let da = a + sd * (0.9 + 0.5 * r()) + (j - (m - 1) / 2) * 0.8 + flut(l, 0.5);
          da += wrapA(hangA() - da) * 0.4;
          const L = R * (m > 1 ? 1.3 + 0.8 * r() : 0.9), fx = x + Math.cos(da) * L, fy = y + Math.sin(da) * L;
          if (m > 1) stem(x, y, fx, fy, R * 0.08);
          flower(fx, fy, R * (0.8 + 0.4 * r()), da, kind(r, st), fate(r, st));
        }
      }
    } else if (L === 'frond') {
      // long leaflets both sides, drooping, longest a third of the way out
      ctx.lineWidth = Math.max(0.6, H * 0.004); ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 1; i < at.length; i++) {
        const l = tw.leaf[i]; if (!l || !l.on) continue;
        const u = i / tw.st.length, [x, y, a] = at[i], fl = H * 0.07 * (1 - Math.abs(u - 0.35) * 1.2);
        for (const sd of [-1, 1]) {
          let fa = a + sd * 0.8 + flut(l, 0.3); fa += (hangA() - fa) * 0.25;
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(fa) * fl, y + Math.sin(fa) * fl);
        }
      }
      ctx.stroke();
    } else if (L === 'ivy') {
      ctx.lineWidth = Math.max(0.6, H * 0.003);
      for (let i = 2; i < at.length; i += 2) {
        const l = tw.leaf[i]; if (!l || !l.on) continue;
        const [x, y, a] = at[i], sd = l.r1 < 0.5 ? 1 : -1, pa = a + sd * 1.2 + flut(l, 0.6), r = H * (0.008 + 0.004 * l.r2);
        const cx = x + Math.cos(pa) * r * 2, cy = y + Math.sin(pa) * r * 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.beginPath();
        for (const da of [-0.9, 0, 0.9]) { const lx = cx + Math.cos(pa + da) * r, ly = cy + Math.sin(pa + da) * r; ctx.moveTo(lx + r, ly); ctx.arc(lx, ly, r, 0, Math.PI * 2); }
        ctx.fill();
      }
    }
  }

  function drawLimb(tw, front, sp, H) { (tw.br ? drawBranch : drawTwig)(tw, tw.x, tw.y, tw.a, front, sp, H); }

  // Once the name has grown, limbs live on their own clocks: grow, hold, age (leaves fall), stand bare,
  // then fade while dying back from the tip. Each dead limb is replaced somewhere else on the letters.
  const lifeRnd = stage.rand;
  const easeOut = x => 1 - Math.pow(1 - x, 2.2);
  function lifeStep(now, sp, H) {
    const T = tree, k = P.cycle;
    for (let i = T.twigs.length - 1; i >= 0; i--) {
      const tw = T.twigs[i];
      if (!tw.life) tw.life = { st: now, grow: 0, hold: 2 + 16 * lifeRnd(), bare: 1.5 + 3 * lifeRnd() };
      const L = tw.life, e = ((now - L.st) / 1000) * k;
      if (tw.tip === undefined) tw.tip = tipD(tw);
      const tH = L.grow + L.hold, tA = tH + 3, tB = tA + L.bare, tF = tB + 2.5;
      let f = 1e9, fall = 0, alpha = 1;
      if (e < L.grow) f = tw.d + (tw.tip - tw.d + H * 0.15) * easeOut(e / L.grow);
      else if (e < tH) {}
      else if (e < tA) fall = (e - tH) / 3;
      else if (e < tB) fall = 1;
      else if (e < tF) { const v = (e - tB) / 2.5; fall = 1; alpha = 1 - v; f = tw.tip - (tw.tip - tw.d) * 0.4 * v; }
      else { T.twigs.splice(i, 1); T.pending.push(now + ((0.4 + 2 * lifeRnd()) * 1000) / k); continue; }
      LF.fall = fall;
      ctx.globalAlpha = alpha;
      drawLimb(tw, f, sp, H);
      ctx.globalAlpha = 1;
    }
    LF.fall = 0;
    for (let i = T.pending.length - 1; i >= 0; i--) {
      if (now < T.pending[i]) continue;
      T.pending.splice(i, 1);
      const nl = respawnLimb(T, sp, lifeRnd);
      if (nl) { nl.life = { st: now, grow: 2.2 + 1.2 * lifeRnd(), hold: 5 + 10 * lifeRnd(), bare: 1.5 + 3 * lifeRnd() }; T.twigs.unshift(nl); }
    }
  }

  function draw(now) {
    const sp = SPECIES[P.species], T = tree, H = T.H;
    const u = reduce ? 1 : clamp((now - t0) / (P.grow * 1000), 0, 1);
    const front = T.maxD * (1 - Math.pow(1 - u, 2.2)) * 1.0001 + (u >= 1 ? 1e9 : 0);
    ctx.setTransform(stage.pw / cssW, 0, 0, stage.ph / cssH, 0, 0);
    ctx.fillStyle = page(); ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = ink(); ctx.fillStyle = ink();

    if (u < 1 || !(P.cycle > 0) || reduce) for (const tw of T.twigs) drawLimb(tw, front, sp, H);
    else lifeStep(now, sp, H);

    for (const ch of T.chains) strokeChain(ch, front, 1, 0, 0);
    for (const [a, b] of T.grafts) if (a.d < front && b.d < front) { ctx.lineWidth = Math.min(a.w, b.w); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }

    if (sp.body === 'outline') {
      const rim = Math.max(1, H * 0.014);
      ctx.strokeStyle = page();
      for (const ch of T.chains) strokeChain(ch, front, 1, -2 * rim, 0);
      for (const [a, b] of T.grafts) if (a.d < front && b.d < front) { ctx.lineWidth = Math.max(0, Math.min(a.w, b.w) - 2 * rim); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.strokeStyle = ink(); ctx.lineCap = 'butt';
      for (const m of T.marks) {
        const p = m.pts[m.i]; if (p.d > front) continue;
        const nx = -p.ty, ny = p.tx, c = m.off * p.w, hl = m.len * (p.w - 2 * rim) * 0.5;
        const cx = p.x + nx * c, cy = p.y + ny * c;
        ctx.lineWidth = Math.max(0.8, H * (0.006 + 0.006 * m.r));
        ctx.beginPath(); ctx.moveTo(cx - nx * hl * 0.2 - p.tx * hl, cy - ny * hl * 0.2 - p.ty * hl); ctx.lineTo(cx + p.tx * hl, cy + p.ty * hl); ctx.stroke();
      }
    } else if (sp.body === 'paddles') {
      for (const m of T.marks) {
        const s = clamp((front - m.d0) / (m.d1 - m.d0 + H * 0.1), 0, 1);
        if (s <= 0) continue;
        const rx = m.len * 0.62 * s, ry = H * 0.095 * P.thick * s, c = Math.cos(m.a), sn = Math.sin(m.a);
        ctx.fillStyle = ink(); ctx.beginPath(); ctx.ellipse(m.x, m.y, rx, ry, m.a, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = page(); ctx.beginPath();
        for (const [u, v] of m.ar) {
          const lx = u * rx * 0.7, ly = v * ry * 0.6, px = m.x + lx * c - ly * sn, py = m.y + lx * sn + ly * c, r = Math.max(0.8, H * 0.006 * s);
          ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2);
        }
        ctx.fill(); ctx.fillStyle = ink();
      }
    } else if (sp.body === 'aerial') {
      ctx.lineCap = 'round';
      for (const m of T.marks) {
        if (front <= m.d) continue;
        const full = m.g - m.y, L = Math.min(full, front - m.d);
        ctx.lineWidth = Math.max(0.6, H * (L >= full ? 0.009 : 0.005));
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.quadraticCurveTo(m.x + (m.r - 0.5) * H * 0.04, m.y + L / 2, m.x + (m.r - 0.5) * H * 0.015, m.y + L); ctx.stroke();
      }
    } else if (sp.body === 'scarred') {
      ctx.strokeStyle = page(); ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(0.8, H * 0.004);
      ctx.beginPath();
      for (const m of T.marks) {
        const p = m.pts[m.i]; if (p.d > front) continue;
        const nx = -p.ty, ny = p.tx, hw = p.w * 0.42;
        ctx.moveTo(p.x - nx * hw, p.y - ny * hw); ctx.lineTo(p.x + nx * hw + p.tx * H * 0.006, p.y + ny * hw + p.ty * H * 0.006);
      }
      ctx.stroke(); ctx.strokeStyle = ink();
    } else if (sp.body === 'jointed') {
      // node rings: a thin gap across the culm with a raised collar either side
      ctx.lineCap = 'butt';
      for (const m of T.marks) {
        const p = m.pts[m.i]; if (p.d > front) continue;
        const nx = -p.ty, ny = p.tx, hw = p.w * 0.62;
        ctx.strokeStyle = ink(); ctx.lineWidth = H * 0.018;
        ctx.beginPath(); ctx.moveTo(p.x - nx * hw, p.y - ny * hw); ctx.lineTo(p.x + nx * hw, p.y + ny * hw); ctx.stroke();
        ctx.strokeStyle = page(); ctx.lineWidth = Math.max(1, H * 0.005);
        ctx.beginPath(); ctx.moveTo(p.x - nx * hw * 1.1, p.y - ny * hw * 1.1); ctx.lineTo(p.x + nx * hw * 1.1, p.y + ny * hw * 1.1); ctx.stroke();
      }
      ctx.strokeStyle = ink();
    } else if (sp.body === 'ribbed') {
      ctx.strokeStyle = page();
      for (const off of [-0.27, 0, 0.27]) for (const ch of T.chains) strokeChain(ch, front, 0, Math.max(0.8, H * 0.006), off);
      ctx.strokeStyle = ink(); ctx.lineWidth = Math.max(0.6, H * 0.0035); ctx.lineCap = 'round';
      ctx.beginPath();
      for (const m of T.marks) {
        const p = m.pts[m.i]; if (p.d > front - H * 0.05) continue;
        const nx = -p.ty * m.side, ny = p.tx * m.side;
        const bx = p.x + nx * p.w * 0.5, by = p.y + ny * p.w * 0.5, ba = Math.atan2(ny, nx), sl = H * (0.02 + 0.015 * m.r);
        for (const da of [-0.5, 0, 0.5]) { ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ba + da) * sl, by + Math.sin(ba + da) * sl); }
      }
      ctx.stroke();
    }
    return u < 1;
  }

  function frame(now) {
    SIM.dt = SIM.last ? Math.min(0.04, (now - SIM.last) / 1000) : 0; SIM.last = now; SIM.now = FL.now = now; SIM.e = 0;
    windT *= 0.93;
    wind += (windT - wind) * 0.15;
    GUST.hist.push([now, wind]);
    while (GUST.hist.length && now - GUST.hist[0][0] > 2500) GUST.hist.shift();
    if (Math.abs(wind) > 0.002) GUST.live = now;
    const growing = draw(now);
    dirty = false;
    if (!(growing || (P.cycle > 0 && !reduce) || now - GUST.live < 2000 || SIM.e > 0.002)) { wind = 0; windT = 0; running = false; SIM.last = 0; GUST.hist.length = 0; }
  }
  let running = false;
  function kick() { running = true; }

  function regrow() { t0 = performance.now(); buildTree(); kick(); }
  function nextSpecies() { P.species = ORDER[(ORDER.indexOf(P.species) + 1) % ORDER.length]; loadTune(); P.seed = 1 + ((P.seed * 37 + 11) % 99); syncValues(); regrow(); }

  // ---------- input ----------
  const press = pressTracker();
  let lastTap = -1, pending = 0, lastMove = 0;
  offs.push(stage.on('down', (q, e) => { press.down(q, e.pointerId); }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    const now = performance.now(), dt = Math.max(8, now - (lastMove || now - 16));
    lastMove = now;
    if (!q.vx) return;
    windT = clamp(windT + (q.vx / dt) * 0.35, -3, 3);
    if (Math.abs(q.vx) > 1) { GUST.x = q.x; GUST.dir = Math.sign(q.vx); }
    kick();
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (!r || !r.tap) return;
    const now = performance.now();
    clearTimeout(pending);
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) { lastTap = -1; pending = setTimeout(() => { if (alive && !stage.revealed) regrow(); }, REFORM_DELAY_MS); }
    else { lastTap = now; pending = setTimeout(() => { if (alive && !stage.revealed) nextSpecies(); }, DOUBLE_MS); }
  }));
  offs.push(stage.on('reveal', () => { clearTimeout(pending); lastTap = -1; kick(); }));

  // ---------- reveal: the skeleton each letter grows from, its roots and the grafts that close its loops ----------
  const rv = createReveal(stage, (cx, W_, H_, k) => {
    if (!tree) return;
    cx.strokeStyle = cx.fillStyle = rvInk(stage, k); cx.lineWidth = 1.5; cx.lineCap = 'round';
    cx.beginPath();
    for (const ch of tree.chains) { cx.moveTo(ch[0].x, ch[0].y); for (const p of ch) cx.lineTo(p.x, p.y); }
    cx.stroke();
    cx.lineWidth = 0.75; cx.beginPath();                                     // the pipe model: each stem as wide as everything it carries
    for (const ch of tree.chains) for (const sd of [-0.5, 0.5]) {
      ch.forEach((p, i) => { const x = p.x - p.ty * p.w * sd, y = p.y + p.tx * p.w * sd; if (i) cx.lineTo(x, y); else cx.moveTo(x, y); });
    }
    cx.stroke();
    cx.setLineDash([3, 3]); cx.beginPath();
    for (const [a, b] of tree.grafts) { cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); }
    cx.stroke(); cx.setLineDash([]);
    cx.beginPath();
    for (const ch of tree.chains) {
      const a = ch[0], b = ch[ch.length - 1];
      cx.moveTo(a.x + 3, a.y); cx.arc(a.x, a.y, 3, 0, Math.PI * 2);                 // where the stroke forks (or the root)
      if (ch.terminal) { cx.moveTo(b.x + 1.5, b.y); cx.arc(b.x, b.y, 1.5, 0, Math.PI * 2); }
    }
    cx.fill();
  }, { dim: 0.12 });

  // ---------- settings ----------
  const V = {};
  function syncValues() { Object.assign(V, P, { species: ORDER.indexOf(P.species), model: P.model === 'ez' ? 1 : 0 }); }
  syncValues();
  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Arboretum', values: V, defaults: { ...DEF, species: 0, model: 1 },
    groups: [
      { name: 'Plant', items: [Ctl('species', 'Species (0 oak … 20 banyan)', 0, ORDER.length - 1, 1), { key: 'model', label: 'ez-tree branching', type: 'toggle' }, Ctl('seed', 'Seed', 1, 99, 1)] },
      { name: 'Growth', items: [Ctl('thick', 'Trunk weight', 0.4, 1.8, 0.05), Ctl('gnarl', 'Gnarl', 0, 2.5, 0.05), Ctl('twigs', 'Twig density', 0, 2.5, 0.05), Ctl('twigLen', 'Twig length', 0.3, 2, 0.05), Ctl('leaves', 'Foliage', 0, 2, 0.05)] },
      { name: 'Time', items: [Ctl('grow', 'Growth (s)', 0.8, 8, 0.1), Ctl('cycle', 'Life cycle speed (0 = off)', 0, 4, 0.1), Ctl('wind', 'Wind response', 0, 3, 0.05)] },
    ],
    set(key, v) {
      V[key] = v;
      if (key === 'species') { P.species = ORDER[v | 0]; loadTune(); syncValues(); regrow(); return; }
      if (key === 'model') { P.model = v ? 'ez' : 'classic'; loadTune(); syncValues(); regrow(); return; }
      P[key] = v;
      if (TUNED.includes(key)) tuneSet()[key] = v;
      if (key === 'grow' || key === 'wind' || key === 'cycle') { kick(); return; }
      buildTree(); kick();
    },
    reset() { Object.assign(P, DEF); loadTune(); syncValues(); regrow(); },
  };

  // ---------- the frame ----------  (ink and page follow stage.theme through stage.colors, so the black and white sequence holds)
  loadTune(); syncValues();
  buildTree(); t0 = performance.now(); kick();
  let rt = 0;
  offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; cssW = stage.W; cssH = stage.H; skelKey = ''; buildTree(); kick(); }, 120); }));
  offs.push(stage.frame(() => {
    const now = performance.now();
    if (running) frame(now);
    rv.draw(now);
  }));

  return {
    tune,
    debug: { dark: stage.theme.name === 'dark', get species() { return P.species; }, next: nextSpecies, regrow, get tree() { return tree; }, gust(v = 2, x = 0, dir = 1) { windT = v; GUST.x = x; GUST.dir = dir; kick(); } },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(pending);
      rv.destroy(); offs.forEach((f) => f()); link.remove();
    },
  };
}
