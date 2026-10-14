// The "hero" moment of each poster: what a menu preview and a contact sheet show. Add a scene here when a poster is added.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCENES = {
  'still-water': async (p) => { await p.mouse.move(250, 250); await p.mouse.down(); for (let i = 0; i <= 24; i++) { await p.mouse.move(250 + i * 28, 250 + Math.sin(i / 3) * 90); await sleep(16); } await p.mouse.up(); await sleep(350); },
  'soft-type': async (p) => { await p.mouse.move(300, 300); await p.mouse.down(); for (let i = 0; i <= 14; i++) { await p.mouse.move(300 + i * 26, 300 + i * 6); await sleep(16); } await sleep(150); await p.mouse.up(); await sleep(250); },
  collapse: async (p) => { await p.mouse.click(430, 260); await sleep(900); },
  explode: async (p) => { await p.mouse.click(640, 260); await sleep(450); },
  metal: async (p) => { await p.mouse.move(420, 300); await p.mouse.down(); for (let i = 0; i <= 16; i++) { await p.mouse.move(420 + i * 22, 300 - i * 9); await sleep(16); } await p.mouse.up(); await sleep(400); },
  'slinky-type': async (p) => { await p.evaluate(() => { const d = window.__poster.inst.debug, t = window.__poster.inst.tune; t.set('zoom', 1.75); t.set('panY', 0.065); d.click(1); d.click(6); d.run(14); }); await sleep(1200); await p.evaluate(() => window.__poster.inst.debug.run(1)); },
};

module.exports = { SCENES, sleep };
