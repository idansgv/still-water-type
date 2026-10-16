// Colour, rarely. About one visit in twenty a poster appears in colour instead of black and white: unexpected, not a setting. Every poster has a coloured version,
// two ways, and the shell decides which:
//
//   (the colour only comes up after the first press on the poster; ?colourat=load shows it at once)
//   the colour pass (default, framework): a gradient laid over the stage with a blend mode, so the ink takes the gradient and the paper stays paper
//       (screen on black-on-white, multiply on white-on-black). No poster code needed; it works on anything that is drawn in black and white.
//   native: a poster that colours itself (registry `colour: 'native'`) calls colourOf(stage) and decides what turns colour and when (Still Water's ripples, the Slinky letter that comes back,
//       the Metal blobs you touched...); the shell adds no overlay. colourOf() gives it the palette, an eased 0..1 `amount`, wake(), and colour lookups for JS and shaders.
//
// ?colour=on forces it, ?colour=off forbids it, ?colour=<0..5> forces that palette. The palettes are the shared ones in src/posters/palette.js.
import { PALETTES, PALETTES_LIGHT } from './posters/palette.js';

export const COLOUR_ODDS = 1 / 19;                        // with never two in a row this comes out at one showing in twenty: an easter egg, not a feature
let lastWasColour = false;                              // never two in a row: rare has to feel rare

/** decide, for one showing of a poster, whether it is coloured; returns null (black and white) or the palette to use. `rand` is injectable for tests. */
export function rollColour(params = new URLSearchParams(), rand = Math.random, { odds = COLOUR_ODDS, remember = true, dark = true } = {}) {
  const ask = params.get('colour');
  let pick = null;
  if (ask === 'off' || ask === 'no') pick = null;
  else if (ask !== null && ask !== '') pick = /^[0-5]$/.test(ask) ? +ask : Math.floor(rand() * PALETTES.length);       // on, or a palette number
  else if (!lastWasColour && rand() < odds) pick = Math.floor(rand() * PALETTES.length);
  if (remember) lastWasColour = pick !== null;
  if (pick === null) return null;
  const p = (dark ? PALETTES : PALETTES_LIGHT)[pick];                 // the bright set suits a dark page; a light page gets the deeper one
  return { index: pick, name: p.name, g: p.g };
}
export const forgetColour = () => { lastWasColour = false; };

/** the CSS gradient for a palette: gradient A down the top half, B down the bottom half (the two lines of the name), a short soft seam between */
export function cssGradient(c) {
  const [a, b] = c.g;
  return `linear-gradient(180deg, ${a[0]} 0%, ${a[1]} 24%, ${a[2]} 46%, ${b[0]} 54%, ${b[1]} 77%, ${b[2]} 100%)`;
}

let undo = null;
/** remove the colour pass and anything it armed (the shell calls this before every poster) */
export function clearColourPass() { if (undo) { undo(); undo = null; } }

/** lay the colour pass over a stage element. It starts invisible: the poster stays black and white until the first press on the stage, and then the colour comes up
 *  (an easter egg that answers a touch). `immediate` (?colourat=load) skips the wait. Returns nothing; clearColourPass() takes it away. */
export function colourPass(stageEl, c, { dark, immediate = false, trigger = 'press' }) {
  clearColourPass();
  const el = document.createElement('div');
  el.className = 'colour-pass';
  el.setAttribute('aria-hidden', 'true');
  el.style.background = cssGradient(c);
  el.style.mixBlendMode = dark ? 'multiply' : 'screen';   // multiply: black stays black, white ink becomes the gradient, greys are tinted in proportion; screen is the same for black ink on white
  stageEl.appendChild(el);
  const wake = () => {
    for (const [t, f] of [['pointerdown', wake], ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp]]) stageEl.removeEventListener(t, f, true);
    stageEl.classList.toggle('colour-dark', !!dark);        // dark: the poster's own greys are lifted first (CSS), or a dark chrome would only tint to near black
    el.classList.add('on');                                 // the CSS fades the gradient in
    stageEl.dataset.colour = 'on';
  };
  let moved = 0, last = null;                                                     // trigger 'drag': a long drag, not a touch (the path of one press, in px)
  const onDown = (e) => { moved = 0; last = [e.clientX, e.clientY]; };
  const onMove = (e) => { if (!last || !e.buttons) return; moved += Math.hypot(e.clientX - last[0], e.clientY - last[1]); last = [e.clientX, e.clientY]; if (moved > 520) wake(); };
  const onUp = () => { last = null; };
  const longDrag = trigger === 'drag';
  if (immediate) wake();
  else if (longDrag) { stageEl.addEventListener('pointerdown', onDown, true); stageEl.addEventListener('pointermove', onMove, true); stageEl.addEventListener('pointerup', onUp, true); }
  else stageEl.addEventListener('pointerdown', wake, true);
  undo = () => { for (const [t, f] of [['pointerdown', wake], ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp]]) stageEl.removeEventListener(t, f, true); el.remove(); stageEl.classList.remove('colour-dark'); delete stageEl.dataset.colour; };
}


// ---------- native colour: what a poster that colours itself uses ----------
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const STOPS = [0, 0.24, 0.46, 0.54, 0.77, 1];            // where the six stops sit from the top of the page to the bottom (the same as cssGradient)
const toCss = (v) => `rgb(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)})`;

/** null when this showing is not in colour; otherwise { palette, amount, wake(), update(dt), rgb(t), css(t), pick(), uniform() }.
 *  amount eases 0 -> 1 after wake(): a poster multiplies its colour by it so the colour fades up. `t` is a place from the top (0) to the bottom (1) of the page. */
export function colourOf(stage) {
  const c = stage.colour; if (!c) return null;
  const stops = c.g.flat().map(hexRGB);
  const rgb = (t) => {
    t = Math.min(1, Math.max(0, t));
    let i = 0; while (i < 4 && t > STOPS[i + 1]) i++;
    const k = (t - STOPS[i]) / (STOPS[i + 1] - STOPS[i]), a = stops[i], b = stops[i + 1];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  const ctl = {
    palette: c, amount: 0, target: 0, woke: false,
    wake() { ctl.target = 1; ctl.woke = true; },
    update(dt) { ctl.amount += (ctl.target - ctl.amount) * Math.min(1, dt * 3.2); if (Math.abs(ctl.target - ctl.amount) < 0.002) ctl.amount = ctl.target; return ctl.amount; },
    rgb, css: (t) => toCss(rgb(t)),
    pick: (rand = Math.random) => ctl.css(rand()),                                    // a colour from anywhere along the palette
    uniform: () => new Float32Array(stops.flat()),                                    // the six stops, for a `uniform vec3 uG[6]`
    wakeOnPress({ move = false } = {}) {                                              // the first press on the poster wakes the colour (move: or the first movement over it); returns the function that stops listening
      const types = move ? ['pointerdown', 'pointermove'] : ['pointerdown'];
      const off = () => types.forEach((t) => stage.root.removeEventListener(t, f, true));
      const f = () => { off(); ctl.wake(); };
      types.forEach((t) => stage.root.addEventListener(t, f, true));
      return off;
    },
  };
  if (new URLSearchParams(location.search).get('colourat') === 'load') ctl.wake();
  return ctl;
}
/** GLSL for a shader that colours along the page: needs `uniform vec3 uG[6];`; gradientAt(0.0) is the top of the page, gradientAt(1.0) the bottom */
export const GLSL_PAGE_GRADIENT = `
uniform vec3 uG[6];
vec3 gradientAt(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.24) return mix(uG[0], uG[1], t / 0.24);
  if (t < 0.46) return mix(uG[1], uG[2], (t - 0.24) / 0.22);
  if (t < 0.54) return mix(uG[2], uG[3], (t - 0.46) / 0.08);
  if (t < 0.77) return mix(uG[3], uG[4], (t - 0.54) / 0.23);
  return mix(uG[4], uG[5], (t - 0.77) / 0.23);
}`;
