// The "hero" moment of each poster: what a menu preview and a contact sheet show. Add a scene here when a poster is added.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCENES = {
  'still-water': async (p) => { await p.mouse.move(250, 250); await p.mouse.down(); for (let i = 0; i <= 24; i++) { await p.mouse.move(250 + i * 28, 250 + Math.sin(i / 3) * 90); await sleep(16); } await p.mouse.up(); await sleep(350); },
  'soft-type': async (p) => { await p.mouse.move(300, 300); await p.mouse.down(); for (let i = 0; i <= 14; i++) { await p.mouse.move(300 + i * 26, 300 + i * 6); await sleep(16); } await sleep(150); await p.mouse.up(); await sleep(250); },
  collapse: async (p) => { await p.mouse.click(430, 260); await sleep(900); },
  explode: async (p) => { await p.mouse.click(640, 260); await sleep(450); },
  metal: async (p) => { await p.mouse.move(420, 300); await p.mouse.down(); for (let i = 0; i <= 16; i++) { await p.mouse.move(420 + i * 22, 300 - i * 9); await sleep(16); } await p.mouse.up(); await sleep(400); },
  fan: async (p) => { await p.mouse.move(560, 420); await p.mouse.down(); for (let i = 0; i <= 10; i++) { await p.mouse.move(560 + i * 9, 420 - i * 4); await sleep(16); } await sleep(500); },
  fontapalloza: async (p) => { await p.mouse.move(250, 250); await sleep(300); await p.mouse.move(700, 250); await p.mouse.move(600, 560); await p.mouse.down(); await sleep(400); await p.mouse.up(); await sleep(300); },
  rain: async (p) => { await p.mouse.move(420, 330); await p.mouse.down(); for (let i = 0; i <= 30; i++) { await p.mouse.move(300 + i * 14, 300 + Math.sin(i / 4) * 70); await sleep(30); } await p.mouse.up(); await sleep(900); },
  'rain-color': async (p) => { await p.mouse.move(420, 330); await p.mouse.down(); for (let i = 0; i <= 30; i++) { await p.mouse.move(300 + i * 14, 300 + Math.sin(i / 4) * 70); await sleep(30); } await p.mouse.up(); await sleep(900); },
  'slinky-type': async (p) => { await p.evaluate(() => { const d = window.__poster.inst.debug, t = window.__poster.inst.tune; t.set('zoom', 1.75); t.set('panY', 0.065); d.click(1); d.click(6); d.run(14); }); await sleep(1200); await p.evaluate(() => window.__poster.inst.debug.run(1)); },
  marbled: async (p) => { for (const [x, y] of [[300, 470], [900, 210]]) { await p.mouse.click(x, y); await sleep(260); } await p.mouse.move(180, 300); await p.mouse.down(); for (let i = 0; i <= 30; i++) { await p.mouse.move(180 + i * 24, 300 + Math.sin(i / 3) * 24); await sleep(14); } await p.mouse.up(); await sleep(300); },
  'splat-type': async (p) => { await p.mouse.click(330, 300); await sleep(120); await p.mouse.move(620, 380); await p.mouse.down(); for (let i = 0; i <= 14; i++) { await p.mouse.move(620 + i * 14, 380 - i * 6); await sleep(14); } await p.mouse.up(); await sleep(260); },   // a burst, a push, the dust mid-flight
  glint: async (p) => { await p.mouse.move(300, 330, { steps: 6 }); await sleep(900); },
  rigged: async (p) => { await sleep(2600); },                               // the intro hoist, settled: the name on its rig
  'wash-script': async (p) => { await sleep(9000); await p.mouse.move(200, 330); await p.mouse.down(); for (let i = 0; i <= 40; i++) { await p.mouse.move(200 + i * 22, 330 + Math.sin(i / 6) * 50); await sleep(16); } await p.mouse.up(); await sleep(1500); },   // written, then one coloured drag through it
  brandbook: async (p) => { await sleep(3200); },                            // the cover of a rolled brand, its device and the name
  crystallize: async (p) => { await sleep(6000); },                          // the name, crystallized out of the crackle
  glitter: async (p) => { await p.mouse.move(520, 300, { steps: 4 }); for (let i = 0; i <= 18; i++) { await p.mouse.move(380 + i * 24, 360 - Math.sin(i / 5) * 60); await sleep(20); } await sleep(500); },   // the moon drawn across the name, its wake glittering
  lace: async (p) => { await p.mouse.click(470, 280); await sleep(200); await p.mouse.move(380, 470); await p.mouse.down(); for (let i = 0; i <= 24; i++) { await p.mouse.move(380 + i * 18, 470 - Math.sin(i / 6) * 40); await sleep(20); } await p.mouse.up(); await sleep(2500); },   // a patch of lace and a pulled stroke
  torn: async (p) => { await sleep(3800); },                                 // down on its pegs and settled: the name hanging
  'moire-phase': async (p) => { await p.evaluate(() => window.__poster.inst.debug.unison()); await sleep(600); },   // at unison: the name between the two voices
  splintered: async (p) => { await p.evaluate(() => window.__poster.inst.debug.explode()); await sleep(1600); },   // blown apart, in slow motion
  moonlit: async (p) => { await p.mouse.move(200, 330); for (let i = 0; i <= 30; i++) { await p.mouse.move(200 + i * 26, 330 + Math.sin(i / 5) * 60); await sleep(20); } await sleep(700); },   // a gust drawn across the name
  goblet: async (p) => { await sleep(2200); await p.mouse.move(650, 455); await p.mouse.down(); for (let i = 0; i <= 24; i++) { await p.mouse.move(650 + i * 6, 455 - i * 9); await sleep(16); } await sleep(1100); },   // the S held by its foot, upside down and pouring
  gyosho: async (p) => { await p.evaluate(() => window.__poster.inst.debug.finish()); await p.mouse.move(180, 560); await p.mouse.down(); for (let i = 0; i <= 30; i++) { await p.mouse.move(180 + i * 30, 560 - Math.sin(i / 9) * 90); await sleep(16 + i); } await p.mouse.up(); await sleep(300); },   // written, then one stroke of your own drying out across it
  arboretum: async (p) => { await sleep(4200); await p.mouse.move(150, 300); for (let i = 0; i <= 24; i++) { await p.mouse.move(150 + i * 36, 300); await sleep(16); } await sleep(500); },   // grown, with a gust crossing it
  drop: async (p) => { await sleep(3600); },   // mid-break: some letters in pieces, the pile building, a whole one standing
  handbang: async (p) => { await sleep(3200); },   // grown: the name as an antlered, mirrored logo
  embers: async (p) => { await sleep(7500); },   // held: the name as merged glowing blobs (after the self-demo's release has come back)
  jet: async (p) => { await sleep(2600); await p.mouse.move(380, 250); await p.mouse.down(); for (let i = 0; i <= 10; i++) { await p.mouse.move(380 + i * 40, 250 + i * 22); await sleep(16); } await p.mouse.up(); await sleep(350); },   // just after a cut: the water flies off, the stream still reads
  rewind: async (p) => { await sleep(1500); await p.mouse.click(640, 400); await sleep(2300); },   // mid-splash: a tap lets the letters go, in slow motion
};

const PREVIEW_THEME = { embers: 'dark', handbang: 'dark', glint: 'dark', glitter: 'dark', moonlit: 'dark', goblet: 'dark', drop: 'dark' };                // the menu preview is black on white unless a poster's picture is a night scene
module.exports = { SCENES, PREVIEW_THEME, sleep };
