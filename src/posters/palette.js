// The colour system for posters that step outside black and white (first user: fan-color, a draft). Shared so every poster
// gets the same palettes, the same segmented settings panel and the same shader snippet.
//
//   import { COLOUR_DEF, colourGroups, gradientUniforms, GLSL_GRADIENT, paperGrey } from './palette.js';
//
//   state      P = { ...COLOUR_DEF, dark: 1 | 0 }   (put these keys on the poster's tune.values)
//   panel      tune.groups = [ ...yourGroups, ...colourGroups() ]
//   shader     paste GLSL_GRADIENT into the fragment shader; vary `vec3 vG` = (t over the block, t within the line, line number),
//              both 0 at the top and 1 at the bottom; then  vec3 c = gradientColour(vG);
//   uniforms   gradientUniforms(gl, prog.u, P) each draw
//   background paperGrey(P) gives the page grey (0 black .. 1 white); call stage.setBackdrop(it) when P.dark or P.bgTone change
//
// A gradient is three stops (top, middle, bottom). A palette is two gradients; lines alternate between them (or all use the first).

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

export const PALETTES = [
  { name: 'North Sea', g: [['#2ee6ff', '#6fe0a0', '#d4f01a'], ['#ff4fe0', '#ff5a9a', '#ff6b5e']] },
  { name: 'Hot', g: [['#ff3fe8', '#ff4d9b', '#ff6a3d'], ['#ff3fe8', '#ff4d9b', '#ff6a3d']] },
  { name: 'Sunset', g: [['#ffe14a', '#ff8a2b', '#ff2f7a'], ['#ff9b2e', '#ff3d6e', '#a62bff']] },
  { name: 'Acid', g: [['#d9ff2a', '#5cf08a', '#19d5ff'], ['#19d5ff', '#5aa0ff', '#b35bff']] },
  { name: 'Violet', g: [['#b78bff', '#6a6bff', '#27b9ff'], ['#ff7be5', '#b078ff', '#5a7bff']] },
  { name: 'Ember', g: [['#fff1b0', '#ffb347', '#ff4a1c'], ['#ffd08a', '#ff6a3d', '#c4177d']] },
];
// The same six names for a light page: deeper, richer stops, because the neon set above washes out on white (cyan, lime and yellow have no weight there).
// The colour pass (src/colour.js) picks the set by the page; fan-color and the other native users keep PALETTES.
export const PALETTES_LIGHT = [
  { name: 'North Sea', g: [['#0a7fb5', '#0f9d8a', '#4a9a1a'], ['#c2185b', '#e0455a', '#e8652e']] },
  { name: 'Hot', g: [['#c2188f', '#d81b60', '#e8501c'], ['#c2188f', '#d81b60', '#e8501c']] },
  { name: 'Sunset', g: [['#d9a300', '#e8710a', '#d81b4e'], ['#e8710a', '#c2185b', '#6a1fc2']] },
  { name: 'Acid', g: [['#7aa600', '#1f9e57', '#0b87b8'], ['#0b87b8', '#2d6fd6', '#7a3fd0']] },
  { name: 'Violet', g: [['#7b4fe0', '#3a45d6', '#0a8fcf'], ['#c2399f', '#8a46d6', '#3d5bd6']] },
  { name: 'Ember', g: [['#b8860b', '#d9751a', '#d02a12'], ['#c0762a', '#d84a1c', '#9c1466']] },
];
export const CUSTOM = PALETTES.length;                       // palette index that reads the hue sliders

export const COLOUR_DEF = {
  dark: 1, bgTone: 0,                                        // background: dark or light, and how far from pure black / white
  palette: 0,                                                // 0..5 presets, 6 custom
  hA0: 190, hA1: 70, hB0: 310, hB1: 5, sat: 0.9, light: 0.6, // custom palette: top and bottom hue of each gradient, shared saturation and lightness
  perLine: 1, alternate: 1, reverse: 0, spread: 1, shift: 0, depth: 0,   // mapping
};

/** the six stops (two gradients of three) as a Float32Array(18) for the uG uniform */
export function gradientData(P) {
  let g;
  if (Math.round(P.palette) >= CUSTOM) {
    const mk = (h0, h1) => [hsl(h0, P.sat, P.light), hsl((h0 + h1) / 2, P.sat, P.light), hsl(h1, P.sat, P.light)];
    g = [mk(P.hA0, P.hA1), mk(P.hB0, P.hB1)];
  } else g = PALETTES[Math.max(0, Math.round(P.palette))].g.map((s) => s.map(hex));
  if (!P.alternate) g = [g[0], g[0]];
  if (P.reverse) g = g.map((s) => [s[2], s[1], s[0]]);
  return new Float32Array(g.flat(2));
}
export function gradientUniforms(gl, u, P) {
  gl.uniform3fv(u['uG[0]'], gradientData(P));
  gl.uniform4f(u.uGP, P.spread, P.shift, P.perLine ? 1 : 0, P.depth);
}
export const paperGrey = (P) => (P.dark ? P.bgTone : 1 - P.bgTone);

/** fragment-shader snippet. Needs `in float vDepth;` (0 at the page plane, up to 1 far behind it) if depth fade is wanted; pass 0 otherwise. */
export const GLSL_GRADIENT = `
uniform vec3 uG[6]; uniform vec4 uGP;   // gradient stops; (spread, shift, per line, depth fade)
vec3 gradientColour(vec3 vG, float vDepth, vec3 paper) {
  float g = clamp((mix(vG.x, vG.y, uGP.z) - 0.5) * uGP.x + 0.5 + uGP.y, 0.0, 1.0);
  int b = int(mod(floor(vG.z + 0.5), 2.0)) * 3;
  vec3 c = g < 0.5 ? mix(uG[b], uG[b + 1], g * 2.0) : mix(uG[b + 1], uG[b + 2], g * 2.0 - 1.0);
  return mix(c, paper, clamp(vDepth * uGP.w, 0.0, 1.0));
}`;

/** the settings-panel groups, segmented: Background, Palette, Custom palette, Mapping */
export function colourGroups() {
  const names = PALETTES.map((p, i) => `${i} ${p.name}`).concat(`${CUSTOM} Custom`).join(' · ');
  return [
    { name: 'Colour · Background', items: [{ key: 'dark', label: 'Dark background', type: 'toggle' }, { key: 'bgTone', label: 'Lift from black / white', min: 0, max: 0.4, step: 0.01 }] },
    { name: 'Colour · Palette', items: [{ key: 'palette', label: names, min: 0, max: CUSTOM, step: 1 }] },
    { name: 'Colour · Custom palette (6)', items: [
      { key: 'hA0', label: 'Gradient A top hue', min: 0, max: 360, step: 1 }, { key: 'hA1', label: 'Gradient A bottom hue', min: 0, max: 360, step: 1 },
      { key: 'hB0', label: 'Gradient B top hue', min: 0, max: 360, step: 1 }, { key: 'hB1', label: 'Gradient B bottom hue', min: 0, max: 360, step: 1 },
      { key: 'sat', label: 'Saturation', min: 0, max: 1, step: 0.01 }, { key: 'light', label: 'Lightness', min: 0.2, max: 0.9, step: 0.01 }] },
    { name: 'Colour · Mapping', items: [
      { key: 'perLine', label: 'Gradient per line (off: across the block)', type: 'toggle' }, { key: 'alternate', label: 'Lines alternate A / B', type: 'toggle' }, { key: 'reverse', label: 'Reverse direction', type: 'toggle' },
      { key: 'spread', label: 'Spread', min: 0.3, max: 3, step: 0.01 }, { key: 'shift', label: 'Shift', min: -0.6, max: 0.6, step: 0.01 }, { key: 'depth', label: 'Depth fade (far strips sink into the page)', min: 0, max: 1.5, step: 0.01 }] },
  ];
}
