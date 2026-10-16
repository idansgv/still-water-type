// What wakes each poster's colour, performed in the browser (used by the colour sheet and the gate's colour check). The colour is an easter egg that answers a touch,
// and each poster answers differently: the generic pass wakes on a press (Collapse, Shatter) or a long drag (Fan); the others colour one thing.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const drag = async (p, pts, step = 16) => { await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down(); for (const [x, y] of pts.slice(1)) { await p.mouse.move(x, y, { steps: 3 }); await sleep(step); } };
const wiggle = (x0, y0, n = 24, dx = 22) => Array.from({ length: n }, (_, i) => [x0 + i * dx, y0 + Math.sin(i / 2) * 60]);

const COLOUR_SCENES = {
  'still-water': async (p) => { await drag(p, wiggle(120, 240)); await sleep(500); await p.mouse.up(); await sleep(300); },                              // ripples from a drag
  'soft-type': async (p) => { await p.evaluate(() => { const d = window.__poster.inst.debug; d.burst(2); d.burst(6); }); await sleep(500); },               // two balloons burst
  collapse: async (p) => { await p.mouse.click(300, 200); await sleep(1500); },                                                                           // the pass wakes on a press
  explode: async (p) => { await p.mouse.click(420, 200); await sleep(1500); },
  metal: async (p) => { await drag(p, wiggle(150, 200, 20, 18)); await p.mouse.up(); await sleep(1500); },                                                // the blobs you pulled
  'slinky-type': async (p) => { await p.evaluate(() => { const d = window.__poster.inst.debug; d.click(1); d.click(6); d.run(340); }); await sleep(1500); },   // a letter drops off and comes back
  fan: async (p) => { await drag(p, wiggle(60, 300, 40, 18), 12); await sleep(300); await p.mouse.up(); await sleep(1500); },                             // a long drag (over about 520 px of path)
  rain: async (p) => { await p.mouse.move(100, 200); await sleep(100); for (let i = 0; i < 30; i++) { await p.mouse.move(120 + i * 20, 220 + Math.sin(i / 3) * 70); await sleep(30); } await sleep(300); },   // the light rain that follows the cursor, no press                  // rain from the first move
  fontapalloza: async (p) => { await p.mouse.move(200, 200); await sleep(200); await p.mouse.move(420, 260); await sleep(300); await p.evaluate(() => window.__poster.inst.debug.glow(2)); await sleep(1100); },   // after a touch, now and then a letter takes a colour; here two are forced
};
module.exports = { COLOUR_SCENES };
