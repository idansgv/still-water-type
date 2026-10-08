// A letter's outline as closed loops, from a real font, for sweeping and extruding. The glyph is drawn on a canvas, read back,
// and traced with marching squares; the loops are smoothed (the pixel staircase goes away) and resampled to an even spacing.
// Orientation: the ink is always on the left of a loop's direction (outer loops run counter-clockwise, the loops of holes
// clockwise), so "the right-hand side" is always away from the ink.
//
// Numbers are in cap units: the letter's cap height is 1, x is from the ink's centre, y is up from the middle of the cap band.

const cache = new Map();

export function glyphContours(ch, family, weight = 900, rows = 200, spacing = 0.018) {
  const key = `${ch}|${family}|${weight}|${rows}|${spacing}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  g.font = `${weight} 100px ${family}`;
  const capA = g.measureText('H').actualBoundingBoxAscent || 70, fs = 100 * rows / capA;
  g.font = `${weight} ${fs}px ${family}`;
  const m = g.measureText(ch), l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
  const pad = 4, W = Math.ceil(l + r) + pad * 2, H = Math.ceil(a + d) + pad * 2, oy = Math.ceil(a) + pad;
  c.width = W; c.height = H;
  g.font = `${weight} ${fs}px ${family}`; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(ch, pad + l, oy);
  const px = g.getImageData(0, 0, W, H).data;
  const on = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : px[(y * W + x) * 4 + 3] > 127 ? 1 : 0);

  // marching squares on the pixel grid: vertices are the midpoints of grid edges
  const segs = new Map();                                              // vertex key -> neighbouring vertex keys
  const vert = new Map();                                              // key -> [x, y]
  const vkey = (kind, x, y) => { const k = kind + x + ',' + y; if (!vert.has(k)) vert.set(k, kind === 'h' ? [x + 0.5, y] : [x, y + 0.5]); return k; };
  const link = (p, q) => { (segs.get(p) || segs.set(p, []).get(p)).push(q); (segs.get(q) || segs.set(q, []).get(q)).push(p); };
  for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
    const tl = on(x, y), tr = on(x + 1, y), br = on(x + 1, y + 1), bl = on(x, y + 1), idx = tl * 8 + tr * 4 + br * 2 + bl;
    if (idx === 0 || idx === 15) continue;
    const T = () => vkey('h', x, y), B = () => vkey('h', x, y + 1), L = () => vkey('v', x, y), R = () => vkey('v', x + 1, y);
    switch (idx) {
      case 1: case 14: link(L(), B()); break;
      case 2: case 13: link(B(), R()); break;
      case 3: case 12: link(L(), R()); break;
      case 4: case 11: link(T(), R()); break;
      case 5: link(L(), T()); link(B(), R()); break;
      case 6: case 9: link(T(), B()); break;
      case 7: case 8: link(L(), T()); break;
      case 10: link(L(), B()); link(T(), R()); break;
    }
  }
  const seen = new Set(), loops = [];
  for (const start of segs.keys()) {
    if (seen.has(start)) continue;
    const pts = []; let prev = null, cur = start;
    for (;;) {
      seen.add(cur); pts.push(vert.get(cur));
      const next = (segs.get(cur) || []).find((k) => k !== prev && !seen.has(k)) ?? null;
      if (next === null) break;
      prev = cur; cur = next;
    }
    if (pts.length > 8) loops.push(pts);
  }

  const inkCx = pad + (l + r) / 2, capCy = oy - rows / 2;
  const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return s / 2; };
  const out = [];
  for (let pts of loops) {
    for (let it = 0; it < 4; it++) {                                   // smooth the staircase
      pts = pts.map((p, i) => { const a0 = pts[(i - 1 + pts.length) % pts.length], b0 = pts[(i + 1) % pts.length]; return [(a0[0] + 2 * p[0] + b0[0]) / 4, (a0[1] + 2 * p[1] + b0[1]) / 4]; });
    }
    let P = pts.map((p) => [(p[0] - inkCx) / rows, (capCy - p[1]) / rows]);       // cap units, y up
    // ink on the left: in y-up coordinates the outer loop must be counter-clockwise (positive area)
    const ar = area(P);
    const outer = ar > 0 ? true : false;
    // we cannot tell outer from hole by sign alone (both orientations come out of the trace), so decide by nesting: a loop whose area is the largest is the outer one
    out.push({ P, ar });
  }
  out.sort((x, y) => Math.abs(y.ar) - Math.abs(x.ar));
  const loopsOut = out.map((o, i) => {
    let P = o.P; const wantPositive = i === 0;                         // the biggest loop is the outline; the others are holes
    if ((area(P) > 0) !== wantPositive) P = P.slice().reverse();
    // resample to an even spacing
    const n = P.length, cum = [0]; for (let k = 1; k <= n; k++) cum.push(cum[k - 1] + Math.hypot(P[k % n][0] - P[k - 1][0], P[k % n][1] - P[k - 1][1]));
    const total = cum[n], cnt = Math.max(24, Math.round(total / spacing)), res = [];
    for (let k = 0; k < cnt; k++) {
      const dd = total * k / cnt; let j = 1; while (j < n && cum[j] < dd) j++;
      const t = (dd - cum[j - 1]) / (cum[j] - cum[j - 1] || 1), p0 = P[(j - 1) % n], p1 = P[j % n];
      res.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
    }
    return { pts: res, hole: !wantPositive };
  });
  const res = { loops: loopsOut, ink: (l + r) / rows, adv: m.width / rows, lb: (r - l) / 2 / rows, rows };
  cache.set(key, res);
  return res;
}
