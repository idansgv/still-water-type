// What wakes each poster's colour, performed in the browser (used by the colour sheet and the gate's colour check). The colour is an easter egg that answers a touch,
// and each poster answers differently: the generic pass wakes on a press (Collapse, Shatter) or a long drag (Fan); the others colour one thing.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drag = async (p, pts, step = 16) => { await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down(); for (const [x, y] of pts.slice(1)) { await p.mouse.move(x, y, { steps: 3 }); await sleep(step); } };
const wiggle = (x0, y0, n = 24, dx = 22) => Array.from({ length: n }, (_, i) => [x0 + i * dx, y0 + Math.sin(i / 2) * 60]);

const COLOUR_SCENES = {
  'still-water': async (p) => { await drag(p, wiggle(120, 240)); await sleep(500); await p.mouse.up(); await sleep(300); },                              // ripples from a drag
  'soft-type': async (p) => { await p.evaluate(() => { const d = window.__poster.inst.debug; d.burst(2); d.burst(6); }); await sleep(500); },               // two balloons burst
  collapse: async (p) => { await p.mouse.click(300, 200); await sleep(1500); },                                                                           // the pass wakes on a press
  explode: async (p) => { await p.mouse.click(300, 175); await sleep(1800); },                                                                       // the letter that shatters (and the ones it sets off) take the gradient
  metal: async (p) => { await drag(p, wiggle(150, 200, 20, 18)); await p.mouse.up(); await sleep(1500); },                                                // the blobs you pulled
  'slinky-type': async (p) => { await p.evaluate(() => { const d = window.__poster.inst.debug; d.click(1); d.click(6); d.run(14); }); await sleep(250); },   // a click: the coils open as the letter goes
  fan: async (p) => { await drag(p, wiggle(60, 300, 40, 18), 12); await sleep(300); await p.mouse.up(); await sleep(1500); },                             // a long drag (over about 520 px of path)
  rain: async (p) => { await p.mouse.move(100, 200); await sleep(100); await p.mouse.down(); for (let i = 0; i < 30; i++) { await p.mouse.move(120 + i * 20, 220 + Math.sin(i / 3) * 70); await sleep(40); } await sleep(1200); },   // press: it pours, and the stains pile up on the letters
  fontapalloza: async (p) => { await p.mouse.move(200, 200); await sleep(200); await p.mouse.move(420, 260); await sleep(300); await p.evaluate(() => window.__poster.inst.debug.glow(2)); await sleep(1100); },   // after a touch, now and then a letter takes a colour; here two are forced
  marbled: async (p) => { await p.mouse.click(260, 380); await sleep(400); await p.mouse.click(620, 220); await sleep(400); await drag(p, wiggle(120, 300, 20, 24), 14); await p.mouse.up(); await sleep(300); },   // from the first touch, every drop is a colour
  rigged: async (p) => { await p.mouse.click(400, 250); await sleep(1500); },  // the pass wakes on a press (it also cuts a rope)
  'splat-type': async (p) => { await p.mouse.click(300, 300); await sleep(500); },   // the pass wakes on a press; the splats take the palette down the page
  'wash-script': async (p) => { await sleep(1500); await drag(p, wiggle(160, 330, 30, 20), 16); await p.mouse.up(); await sleep(400); },   // its own colour on your brush, from the first drag
  torn: async (p) => { await sleep(2600); await p.mouse.click(400, 250); await sleep(1500); },   // the pass wakes on a press
  glint: async (p) => { await p.mouse.move(180, 250, { steps: 5 }); await sleep(300); await p.mouse.move(620, 330, { steps: 8 }); await sleep(1200); },   // the light takes the palette from the first move
  brandbook: async (p) => { await sleep(2500); await p.mouse.click(400, 250); await sleep(1500); },   // the pass wakes on a press
  crystallize: async (p) => { await sleep(1500); await p.mouse.click(400, 250); await sleep(1500); },   // the pass wakes on a press (it also knocks a hole)
  glitter: async (p) => { await sleep(1500); await p.mouse.click(600, 330); await sleep(1500); },
  lace: async (p) => { await sleep(1500); await p.mouse.click(600, 330); await sleep(1500); },
  splintered: async (p) => { await sleep(1500); await p.mouse.click(100, 240); await sleep(1500); },   // native: a press on a letter (the I) wakes the colour and blows it apart
  'moire-phase': async (p) => { await sleep(1500); await p.mouse.click(400, 250); await sleep(1500); },   // the pass wakes on a press (it is also a beat)
  moonlit: async (p) => { await sleep(1500); await p.mouse.move(400, 250); await p.mouse.down(); await sleep(3500); },   // the pass wakes on the press; a held gale makes enough glitter to carry it (the test lets go)
};
module.exports = { COLOUR_SCENES };
