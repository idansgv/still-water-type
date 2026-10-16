// Colour, rarely. About one visit in twenty a poster appears in colour instead of black and white: unexpected, not a setting. Every poster has a coloured version,
// two ways, and the shell decides which:
//
//   (the colour only comes up after the first press on the poster; ?colourat=load shows it at once)
//   the colour pass (default, framework): a gradient laid over the stage with a blend mode, so the ink takes the gradient and the paper stays paper
//       (screen on black-on-white, multiply on white-on-black). No poster code needed; it works on anything that is drawn in black and white.
//   native: a poster that colours itself (registry `colour: 'native'`) reads `stage.colour` ({ index, name, g: [A, B] }, each three hex stops, top to bottom) and the shell adds no overlay.
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
export function colourPass(stageEl, c, { dark, immediate = false }) {
  clearColourPass();
  const el = document.createElement('div');
  el.className = 'colour-pass';
  el.setAttribute('aria-hidden', 'true');
  el.style.background = cssGradient(c);
  el.style.mixBlendMode = dark ? 'multiply' : 'screen';   // multiply: black stays black, white ink becomes the gradient, greys are tinted in proportion; screen is the same for black ink on white
  stageEl.appendChild(el);
  const wake = () => {
    stageEl.removeEventListener('pointerdown', wake, true);
    stageEl.classList.toggle('colour-dark', !!dark);        // dark: the poster's own greys are lifted first (CSS), or a dark chrome would only tint to near black
    el.classList.add('on');                                 // the CSS fades the gradient in
    stageEl.dataset.colour = 'on';
  };
  if (immediate) wake(); else stageEl.addEventListener('pointerdown', wake, true);
  undo = () => { stageEl.removeEventListener('pointerdown', wake, true); el.remove(); stageEl.classList.remove('colour-dark'); delete stageEl.dataset.colour; };
}
