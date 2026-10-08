// Letter shapes from a real font, as boxes. The glyph is drawn on a canvas and read back; from the pixels we make
//   fine   many thin boxes, one per scanline run, merged downward where neighbouring rows match: what is DRAWN
//          (so curves keep their real outline)
//   coarse a grid of cells cut into a few larger boxes: what the physics collides with
// All numbers are in "cap units": the letter's cap height is 1, x is from the ink's centre, y is from the middle of the
// cap-height band (up is positive), so the baselines of different letters line up. Works with any font the browser can draw.

const cache = new Map();

export function glyphBoxes(ch, family, weight = 900, rows = 170, cells = 34) {
  const key = `${ch}|${family}|${weight}|${rows}|${cells}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  g.font = `${weight} 100px ${family}`;
  const capA = g.measureText('H').actualBoundingBoxAscent || 70;
  const fs = 100 * rows / capA;
  g.font = `${weight} ${fs}px ${family}`;
  const m = g.measureText(ch), l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
  const W = Math.ceil(l + r) + 6, H = Math.ceil(a + d) + 6, ox = 3, oy = Math.ceil(a) + 3;     // the pen origin in the canvas: (ox + l, oy)
  c.width = W; c.height = H;
  g.font = `${weight} ${fs}px ${family}`; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
  g.fillText(ch, ox + l, oy);
  const px = g.getImageData(0, 0, W, H).data, on = (x, y) => px[(y * W + x) * 4 + 3] > 127;
  const inkCx = ox + (l + r) / 2, capCy = oy - rows / 2;
  const toBox = (x0, y0, x1, y1) => ({ x: ((x0 + x1) / 2 - inkCx) / rows, y: (capCy - (y0 + y1) / 2) / rows, hx: (x1 - x0) / 2 / rows, hy: (y1 - y0) / 2 / rows });

  // fine boxes: runs per row, merged downward when the run is the same (to a pixel)
  const fine = []; let open = [];
  for (let y = 0; y < H; y++) {
    const next = [];
    for (let x = 0; x < W;) {
      if (!on(x, y)) { x++; continue; }
      let x1 = x; while (x1 < W && on(x1, y)) x1++;
      const o = open.find((q) => Math.abs(q.x0 - x) <= 1 && Math.abs(q.x1 - x1) <= 1);
      if (o) { o.y1 = y + 1; open.splice(open.indexOf(o), 1); next.push(o); }
      else next.push({ x0: x, x1, y0: y, y1: y + 1 });
      x = x1;
    }
    for (const q of open) fine.push(toBox(q.x0, q.y0, q.x1, q.y1));
    open = next;
  }
  for (const q of open) fine.push(toBox(q.x0, q.y0, q.x1, q.y1));

  // coarse boxes: a grid, a cell is solid if at least half of it is ink; then greedy rectangles
  const gp = rows / cells, gw = Math.ceil(W / gp), gh = Math.ceil(H / gp), solid = new Uint8Array(gw * gh), used = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    let n = 0, t = 0;
    for (let y = Math.floor(j * gp); y < Math.min(H, Math.floor((j + 1) * gp)); y++) for (let x = Math.floor(i * gp); x < Math.min(W, Math.floor((i + 1) * gp)); x++) { t++; if (on(x, y)) n++; }
    solid[j * gw + i] = t && n / t >= 0.5 ? 1 : 0;
  }
  const coarse = [];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    if (!solid[j * gw + i] || used[j * gw + i]) continue;
    let i1 = i; while (i1 < gw && solid[j * gw + i1] && !used[j * gw + i1]) i1++;
    let j1 = j + 1;
    for (; j1 < gh; j1++) { let ok = true; for (let k = i; k < i1; k++) if (!solid[j1 * gw + k] || used[j1 * gw + k]) { ok = false; break; } if (!ok) break; }
    for (let q = j; q < j1; q++) for (let k = i; k < i1; k++) used[q * gw + k] = 1;
    coarse.push(toBox(i * gp, j * gp, i1 * gp, j1 * gp));
  }
  const out = { fine, coarse, ink: (l + r) / rows, adv: m.width / rows, lb: (r - l) / 2 / rows };
  cache.set(key, out);
  return out;
}
