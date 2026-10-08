// Centre lines of a real font's letters, for Soft type. The letter is drawn on a canvas, thinned to a one-pixel skeleton
// (Zhang and Suen), walked into polylines between junctions and ends, short spurs are dropped, and each line is simplified.
// The result is shaped like the hand-made strokes (a list of { pts, closed }) but in pixels, with the stroke's half thickness.
// Works best on mono-line rounded faces such as GT Maru, where the stroke really is a tube.

const cache = new Map();

export function glyphSkeleton(ch, family, weight = 700, rows = 220) {
  const key = `${ch}|${family}|${weight}|${rows}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  g.font = `${weight} 100px ${family}`;
  const capA = g.measureText('H').actualBoundingBoxAscent || 70, fs = 100 * rows / capA;
  g.font = `${weight} ${fs}px ${family}`;
  const m = g.measureText(ch), l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
  const pad = 4, W = Math.ceil(l + r) + pad * 2, H = Math.ceil(a + d) + pad * 2, oy = Math.ceil(a) + pad;
  c.width = W; c.height = H;
  g.font = `${weight} ${fs}px ${family}`; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(ch, pad + l, oy);
  const px = g.getImageData(0, 0, W, H).data, img = new Uint8Array(W * H);
  let area = 0; for (let i = 0; i < W * H; i++) { img[i] = px[i * 4 + 3] > 127 ? 1 : 0; area += img[i]; }
  const inkCx = pad + (l + r) / 2, capCy = oy - rows / 2;

  // thinning
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const del = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (!img[i]) continue;
        const p2 = img[i - W], p3 = img[i - W + 1], p4 = img[i + 1], p5 = img[i + W + 1], p6 = img[i + W], p7 = img[i + W - 1], p8 = img[i - 1], p9 = img[i - W - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]; let A = 0; for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) A++;
        if (A !== 1) continue;
        if (step === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue; } else { if (p2 * p4 * p8 || p2 * p6 * p8) continue; }
        del.push(i);
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
  }
  const nb = (i) => { const o = []; for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) { if (!dx && !dy) continue; const j = i + dy * W + dx; if (img[j]) o.push(j); } return o; };
  const sk = []; for (let i = W; i < W * H - W; i++) if (img[i]) sk.push(i);
  const deg = new Map(); for (const i of sk) deg.set(i, nb(i).length);
  const half = Math.max(2, area / Math.max(1, sk.length * 1.12) / 2);       // the stroke's half thickness, in raster pixels

  // The skeleton as a graph. Junction pixels that touch are one junction (thinning leaves little staircases); ends are their own
  // vertices; the edges are the runs of ordinary pixels between them. A junction left with only two edges is not a junction: its
  // edges are joined into one line. Short spurs that end in a junction are dropped.
  const cluster = new Map(), verts = [];
  for (const i of sk) {
    if (deg.get(i) < 3 || cluster.has(i)) continue;
    const id = verts.length, pix = [i], q = [i]; cluster.set(i, id);
    while (q.length) { const c0 = q.pop(); for (const j of nb(c0)) if (deg.get(j) >= 3 && !cluster.has(j)) { cluster.set(j, id); pix.push(j); q.push(j); } }
    verts.push({ pix, junction: true, edges: [], x: pix.reduce((t, k) => t + (k % W), 0) / pix.length, y: pix.reduce((t, k) => t + Math.floor(k / W), 0) / pix.length });
  }
  for (const i of sk) if (deg.get(i) === 1) { cluster.set(i, verts.length); verts.push({ pix: [i], junction: false, edges: [], x: i % W, y: Math.floor(i / W) }); }
  const edges = [], used = new Set(), seenPair = new Set();
  const addEdge = (a, b, px) => { const e = { a, b, px }; edges.push(e); verts[a].edges.push(e); if (b >= 0 && b !== a) verts[b].edges.push(e); else if (b === a) verts[a].edges.push(e); return e; };
  verts.forEach((v, vi) => {
    for (const p0 of v.pix) for (const n0 of nb(p0)) {
      if (cluster.has(n0)) { const w = cluster.get(n0); if (w !== vi) { const key = Math.min(vi, w) + ':' + Math.max(vi, w) + ':0'; if (!seenPair.has(key)) { seenPair.add(key); addEdge(vi, w, []); } } continue; }
      if (used.has(n0)) continue;
      const path = []; let prev = p0, cur = n0, end = -1;
      for (;;) {
        used.add(cur); path.push(cur);
        const nexts = nb(cur).filter((j) => j !== prev);
        const next = nexts.find((j) => cluster.has(j)) ?? nexts.find((j) => !used.has(j));
        if (next === undefined) break;
        if (cluster.has(next)) { end = cluster.get(next); break; }
        prev = cur; cur = next;
      }
      addEdge(vi, end, path);
    }
  });
  const edgeLen = (e) => { let t = 0, px = e.px; for (let k = 1; k < px.length; k++) t += Math.hypot((px[k] % W) - (px[k - 1] % W), Math.floor(px[k] / W) - Math.floor(px[k - 1] / W)); return t + 2; };
  const dropEdge = (e) => { for (const v of verts) v.edges = v.edges.filter((x) => x !== e); edges.splice(edges.indexOf(e), 1); };
  for (const e of edges.slice()) {                                              // spurs
    if (e.b < 0 || e.a === e.b) continue;
    const va = verts[e.a], vb = verts[e.b];
    const spur = (!va.junction && vb.junction && vb.edges.length >= 3) || (!vb.junction && va.junction && va.edges.length >= 3);
    if (spur && edgeLen(e) < half * 1.5) dropEdge(e);
  }
  let merged = true;
  while (merged) {                                                              // a junction with two edges is just a bend
    merged = false;
    for (const v of verts) {
      if (!v.junction || v.edges.length !== 2) continue;
      const [e1, e2] = v.edges; if (e1 === e2) continue;
      const vi = verts.indexOf(v);
      const o1 = e1.a === vi ? e1.b : e1.a, o2 = e2.a === vi ? e2.b : e2.a;
      const p1 = e1.a === vi ? e1.px.slice().reverse() : e1.px.slice(), p2 = e2.a === vi ? e2.px.slice() : e2.px.slice().reverse();
      const joined = { a: o1, b: o2, px: p1.concat([{ junction: vi }], p2) };      // keeps the junction's centre as a point on the line
      v.edges = []; edges.splice(edges.indexOf(e1), 1); edges.splice(edges.indexOf(e2), 1); edges.push(joined);
      if (o1 >= 0) { const w = verts[o1]; w.edges = w.edges.map((x) => (x === e1 ? joined : x)); }
      if (o2 >= 0) { const w = verts[o2]; w.edges = w.edges.map((x) => (x === e2 ? joined : x)); if (o1 === o2) { /* a loop back to the same junction */ } }
      merged = true; break;
    }
  }
  const point = (k) => (typeof k === 'object' ? { x: verts[k.junction].x, y: verts[k.junction].y } : { x: k % W, y: Math.floor(k / W) });
  let strokes = [];
  for (const e of edges) {
    if (e.a < 0) continue;
    const poly = [{ x: verts[e.a].x, y: verts[e.a].y }, ...e.px.map(point)];
    if (e.b >= 0) poly.push({ x: verts[e.b].x, y: verts[e.b].y });
    if (poly.length >= 3 || (poly.length === 2 && Math.hypot(poly[1].x - poly[0].x, poly[1].y - poly[0].y) > 3)) strokes.push({ p: poly, closed: e.a === e.b && e.b >= 0 });
  }
  for (const i of sk) {                                                          // loops with no junction at all
    if (used.has(i) || cluster.has(i)) continue;
    const path = []; let prev = -1, cur = i;
    for (;;) { used.add(cur); path.push(cur); const next = nb(cur).find((j) => j !== prev && !used.has(j)); if (next === undefined) break; prev = cur; cur = next; }
    if (path.length > 6) strokes.push({ p: path.map((k) => ({ x: k % W, y: Math.floor(k / W) })), closed: true });
  }
  // simplify (Douglas and Peucker)
  const dp = (p, eps) => {
    if (p.length < 3) return p;
    let dmax = 0, idx = 0; const a = p[0], b = p[p.length - 1], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    for (let k = 1; k < p.length - 1; k++) { const dd = Math.abs((p[k].x - a.x) * dy - (p[k].y - a.y) * dx) / L; if (dd > dmax) { dmax = dd; idx = k; } }
    if (dmax <= eps) return [a, b];
    return dp(p.slice(0, idx + 1), eps).slice(0, -1).concat(dp(p.slice(idx), eps));
  };
  const out = strokes.map((s) => ({ closed: s.closed, pts: dp(s.closed ? s.p.concat([s.p[0]]) : s.p, 1.6).map((q) => ({ x: (q.x - inkCx) / rows, y: (q.y - capCy) / rows })) }));
  const res = { strokes: out, half: half / rows, ink: (l + r) / rows, adv: m.width / rows, lb: (r - l) / 2 / rows };   // cap units: cap height = 1, y down
  cache.set(key, res);
  return res;
}
