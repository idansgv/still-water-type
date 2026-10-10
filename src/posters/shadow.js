// Shadow. A cloud of wooden toy blocks (cylinders, half-rounds, cubes, planks, wedges) hangs in front of a wall under one low, directional
// light, and the shadows they cast are the letters of IDAN SEGEV (after Kumi Yamashita's wall pieces: the blocks are densest where the
// shadow is, and thin out and scatter toward the light). Where blocks are many their shadows merge into one solid mass; at the edges and
// among the strays, single shadows show beside their blocks. Move the light and the type is shown to be nothing but shadow.
//
// The light is one far lamp from the upper right, low, so shadows are long. A point at height z above the wall throws its shadow to
// (x - z * lx, y - z * ly), with |l| large. A block's shadow is the outline of all its corners thrown that way: the block moved by its
// distance from the wall and stretched along the light by its own depth (a peg standing out of the wall casts a long streak).
//
// The plan (solved, not scattered): the letters are drawn into a mask. Blocks are added one at a time, edges of the letters first so the
// outline comes out crisp, then the inside. For a bare spot many candidates are tried (kind of block, size, how it lies, height); each
// candidate's real shadow is scored by the new letter it covers, minus what it spills outside the letters, minus what it covers twice
// (a block that repeats another does nothing, so it does not stay), minus a little for crowding another block or leaving the page. The
// best stays, and only if it brings enough that is its own. Heights are mostly low, so the blocks sit densely near their shadows and a few
// stand far out: the cloud thins toward the light.
//
// Look: shadows are solid ink on the wall; the blocks are lit solids (faces tinted by how squarely the light meets them, hairline edges).
// Black on white, then white on black.
//
// Touch: the light's slant follows the pointer (a dragging finger, or a tilt: stage.look); a small plateau around home snaps the letters
// back. A tap on a block spins it (and its neighbours) a full turn. Left alone, the light eases home. Double tap on empty space: a new
// plan. Three quick taps: reveal (the page inverts; each block's shadow outlined, a ray from every block to its shadow, and the light).
// The hint: until the first touch, the light swings once, slowly, now and then and returns.
import { createReveal, ink as rvInk, grid, corners, titleBlock } from './reveal.js';
import { SKELETON, radiusFor } from './lettering.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';

const smooth = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

// ---------- the blocks: a box of wooden toy blocks, each a unit mesh (circumradius 1) with faces and outward normals ----------
function build3(v, f, round) {
  const sc = Math.max(...v.map((p) => Math.hypot(...p)));
  v = v.map((p) => p.map((q) => q / sc));
  const n = f.map((face) => {
    const [a, b, c] = face.map((i) => v[i]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    let cx = 0, cy = 0, cz = 0; for (const i of face) { cx += v[i][0]; cy += v[i][1]; cz += v[i][2]; }
    if (x * cx + y * cy + z * cz < 0) { x = -x; y = -y; z = -z; }
    return [x, y, z];
  });
  return { v, f, n, round };
}
const box = (a, b, c) => { const v = []; for (let m = 0; m < 8; m++) v.push([m & 1 ? a : -a, m & 2 ? b : -b, m & 4 ? c : -c]); return build3(v, [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [1, 3, 7, 5], [0, 2, 6, 4]], false); };
function extrude(poly, h, round) {                         // a flat shape (list of [x, y]) pulled out along z, 2h long
  const k = poly.length, v = [...poly.map((p) => [p[0], p[1], -h]), ...poly.map((p) => [p[0], p[1], h])], f = [];
  for (let i = 0; i < k; i++) f.push([i, (i + 1) % k, k + (i + 1) % k, k + i]);
  f.push([...Array(k).keys()]); f.push([...Array(k).keys()].map((i) => k + i));
  return build3(v, f, round);
}
const ngon = (k, rr) => Array.from({ length: k }, (_, i) => [Math.cos(i / k * Math.PI * 2) * rr, Math.sin(i / k * Math.PI * 2) * rr]);
const half = (rr) => { const p = []; for (let i = 0; i <= 7; i++) { const a = i / 7 * Math.PI; p.push([Math.cos(a) * rr, Math.sin(a) * rr - rr * 0.45]); } return p; };
const arch = (rr) => { const p = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; p.push([Math.cos(a) * rr, Math.sin(a) * rr - rr * 0.5]); } p.push([rr * 0.5, -rr * 0.5], [rr * 0.5, -rr * 0.5 + 0.01]); for (let i = 8; i >= 0; i--) { const a = i / 8 * Math.PI; p.push([Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5 - rr * 0.5]); } return p; };
// the vocabulary: cubes, planks, bars; cylinders (a stub, a rod, a disc); a half-round; a wedge (triangular prism)
const KINDS = [
  box(0.62, 0.62, 0.62), box(0.7, 0.7, 0.5), box(0.8, 0.7, 0.42), box(0.55, 0.55, 0.85), box(0.75, 0.6, 0.6),   // cubes, thick slabs, a short bar: bulky, none thin
  extrude(ngon(14, 0.65), 0.7, true), extrude(ngon(14, 0.55), 0.9, true), extrude(ngon(16, 0.8), 0.45, true),    // cylinders: a stub, a post, a fat disc
  extrude(half(0.85), 0.7, true), extrude(half(0.7), 0.85, true),                                                  // half-rounds
  extrude([[-0.8, -0.5], [0.8, -0.5], [0, 0.8]], 0.75, false),                                                    // wedge
];

// ---------- small 3x3 rotation helpers ----------
const rotAxis = (ax, ay, az, a) => {
  const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay, t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax, t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c];
};
const mul3 = (A, B) => [A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8]];

function hull(pts) {                                       // convex hull of [x, y] points (monotone chain)
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// a block's outline on the screen and its shadow on the wall, for the light slant (lx, ly)
function project(mesh, M, x, y, z, r, lx, ly) {          // r scales the mesh (1: it is already in px)
  const v = mesh.v, V = new Array(v.length), SH = new Array(v.length);
  for (let i = 0; i < v.length; i++) {
    const p = v[i], a = M[0] * p[0] + M[1] * p[1] + M[2] * p[2], b = M[3] * p[0] + M[4] * p[1] + M[5] * p[2], c = M[6] * p[0] + M[7] * p[1] + M[8] * p[2];
    const X = x + a * r, Y = y + b * r, Z = Math.max(0, z + c * r);
    V[i] = [X, Y]; SH[i] = [X - Z * lx, Y - Z * ly];
  }
  return { V, SH };
}

export function mount(stage) {
  const c2 = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const bg = dark ? '#000' : '#fff', fg = dark ? '#fff' : '#000';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];
  let seedBump = 0;

  const DEFAULTS = { slant: 2.2, depth: 0.11, size: 1.1, range: 0.5, snap: 0.07, rest: 4 };
  const P = { ...DEFAULTS };
  const DIR = [0.9, -0.43];                                                  // where the light comes from: the upper right, so shadows fall to the lower left
  const home = () => [DIR[0] * P.slant, DIR[1] * P.slant];

  let W = 1, H = 1, shapes = [], tR = 20, cover = 0, spill = 0;
  let dirty = true, now = 0, lastMove = 0, calm = 1, touched = false, idleT = 0, nextDemo = 3.5, demo = null, reformT = 0, lastEmpty = 0, revealed = false, lastLook = [0, 0], lampPos = [0, 0];
  const press = pressTracker();

  // ---------- layout: the same composition as the other type posters ----------
  function layout() {
    const portrait = W / H < 0.85;
    const rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96;
    const availW = (W - 2 * padX) * (W / H < 0.85 ? 1 : 0.9), availH = H - top - bottom, gap = 0.06;
    const advance = (c, h) => h * (0.6 * SKELETON[c].wf + 2 * (c === 'I' ? 0.11 : Math.min(SKELETON[c].wf * 0.6 * 0.25, c === 'E' ? 0.1 : 0.118)) + gap);
    let h = Infinity;
    for (const row of rows) h = Math.min(h, availW / [...row].reduce((s, c) => s + advance(c, 1), 0));
    const rowGap = 0.02;
    h = Math.min(h, availH / (rows.length * (1.02 + rowGap)));
    const total = rows.length * h * 1.02 + (rows.length - 1) * h * rowGap;
    let y = top + (availH - total) / 2 + h * 0.51;
    const out = [];
    for (const row of rows) {
      const rowW = [...row].reduce((s, c) => s + advance(c, h), 0);
      let x = padX + (availW - rowW) / 2;
      for (const c of row) { const a = advance(c, h); out.push({ ch: c, x: x + a / 2, y, w: SKELETON[c].wf * h, h }); x += a; }
      y += h * (1.02 + rowGap);
    }
    return out;
  }

  // ---------- the solver ----------
  function build() {
    const rand = (() => { let a = (stage.seed ^ (seedBump * 0x9e3779b1)) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const poses = layout(), [lx, ly] = home();
    tR = radiusFor(poses[0].ch, poses[0].w, poses[0].h) * 0.8;               // the stroke's half thickness
    // the letters as a mask, at half size
    const mw = Math.ceil(W / 2), mh = Math.ceil(H / 2), mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
    const mx = mc.getContext('2d', { willReadFrequently: true });
    mx.fillStyle = '#000'; mx.fillRect(0, 0, mw, mh); mx.strokeStyle = '#fff'; mx.lineWidth = tR * 1.1; mx.lineCap = 'round'; mx.lineJoin = 'round';
    for (const pose of poses) for (const st of SKELETON[pose.ch].s()) {
      mx.beginPath(); st.pts.forEach((q, i) => { const X = (pose.x + q.x * pose.w) / 2, Y = (pose.y + q.y * pose.h) / 2; i ? mx.lineTo(X, Y) : mx.moveTo(X, Y); }); if (st.closed) mx.closePath(); mx.stroke();
    }
    const px = mx.getImageData(0, 0, mw, mh).data, mask = new Uint8Array(mw * mh); let total = 0;
    for (let i = 0; i < mask.length; i++) if (px[i * 4] > 128) { mask[i] = 1; total++; }
    const cov = new Uint8Array(mw * mh), edge = [], inner = [], E = 4;
    const at = (x, y) => (x < 0 || y < 0 || x >= mw || y >= mh ? 0 : mask[y * mw + x]);
    for (let y = 0; y < mh; y += 2) for (let x = 0; x < mw; x += 2) if (mask[y * mw + x]) (!at(x - E, y) || !at(x + E, y) || !at(x, y - E) || !at(x, y + E) ? edge : inner).push([x, y]);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const seeds = shuffle(edge).concat(shuffle(inner));                       // the outline first, so it comes out crisp, then the inside

    const list = [], zmax = P.depth * H, STEP = 2, minOwn = Math.max(12, tR * tR * 0.018);
    let covered = 0, spilled = 0;
    for (const [sx, sy] of seeds) {
      if (covered > total * 0.975 || list.length > 230) break;
      if (cov[sy * mw + sx]) continue;
      let best = null;
      for (let c = 0; c < 90; c++) {
        const mesh = KINDS[Math.floor(rand() * KINDS.length)];
        const r = tR * P.size * (0.62 + 0.7 * rand()), z = zmax * (0.25 + 0.75 * Math.pow(rand(), 1.2));
        const mode = rand(), tilt = (rand() - 0.5) * 0.6;                      // how it lies: flat on its side, standing out of the wall like a peg, or any angle
        const M0 = mul3(rotAxis(0, 0, 1, rand() * 6.283), mode < 0.84 ? rotAxis(1, 0, 0, Math.PI / 2 + tilt) : mode < 0.91 ? rotAxis(1, 0, 0, tilt * 0.8) : rotAxis(rand() - 0.5, rand() - 0.5, rand() - 0.5 + 0.01, rand() * 3.2));
        const tx = sx * 2 + (rand() - 0.5) * r * 0.5, ty = sy * 2 + (rand() - 0.5) * r * 0.5;
        const a = project(mesh, M0, 0, 0, z, r, lx, ly), sh = hull(a.SH);
        let cxs = 0, cys = 0; for (const p of sh) { cxs += p[0]; cys += p[1]; } cxs /= sh.length; cys /= sh.length;
        const x = tx - cxs, y = ty - cys;                                      // the block goes where its shadow's centre lands on the target
        const poly = sh.map((p) => [p[0] + x, p[1] + y]);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        let nw = 0, out = 0, twice = 0, inn = 0;
        for (let yy = Math.max(0, Math.floor(y0 / 2)); yy <= Math.min(mh - 1, Math.ceil(y1 / 2)); yy += STEP) for (let xx = Math.max(0, Math.floor(x0 / 2)); xx <= Math.min(mw - 1, Math.ceil(x1 / 2)); xx += STEP) {
          if (!inside(poly, xx * 2, yy * 2)) continue; inn++;
          if (!mask[yy * mw + xx]) out++; else if (cov[yy * mw + xx]) twice++; else nw++;
        }
        if (inn < 3) continue;
        let crowd = 0; for (const o of list) { const d = Math.hypot(o.x - x, o.y - y), lim = (o.r + r) * 0.7; if (d < lim) crowd += (lim - d) / lim; }
        const off = (x < -r ? 1 : 0) + (x > W + r ? 1 : 0) + (y < -r ? 1 : 0) + (y > H + r ? 1 : 0);
        const score = nw - 8 * out - 1.2 * twice - crowd * inn * 0.35 - off * inn * 2;
        if (!best || score > best.score) best = { score, mesh, r, z, M0, x, y, poly, x0, x1, y0, y1, nw, out };
      }
      if (!best || best.nw < minOwn || best.out > best.nw * 0.15) continue;   // it must bring a piece of letter that is its own, with little spill
      for (let yy = Math.max(0, Math.floor(best.y0 / 2)); yy <= Math.min(mh - 1, Math.ceil(best.y1 / 2)); yy++) for (let xx = Math.max(0, Math.floor(best.x0 / 2)); xx <= Math.min(mw - 1, Math.ceil(best.x1 / 2)); xx++) {
        if (!inside(best.poly, xx * 2, yy * 2)) continue;
        if (mask[yy * mw + xx]) { if (!cov[yy * mw + xx]) { cov[yy * mw + xx] = 1; covered++; } } else spilled++;
      }
      list.push({ x: best.x, y: best.y, z: best.z, r: best.r, mesh: best.mesh, M0: best.M0, spin: null, hull: null, sh: null, shs: null });
    }
    cover = covered / Math.max(1, total); spill = spilled / Math.max(1, covered + spilled);
    shapes = list.sort((a, b) => a.z - b.z);                                  // low to high, for drawing
    dirty = true;
  }
  const reform = () => { shapes = []; seedBump++; build(); };

  // ---------- the light ----------
  function lamp() {                                                           // the slant: home, plus what the pointer adds (zero on the home plateau)
    const [hx, hy] = home();
    let dx = stage.look.x, dy = -stage.look.y;
    if (demo) { const u = demo.t / demo.dur, a = Math.sin(u * Math.PI) * Math.sin(u * Math.PI * 2); dx += Math.cos(demo.ang) * a * 0.22; dy += Math.sin(demo.ang) * a * 0.22; }
    const r = Math.hypot(dx, dy), s0 = P.snap * 0.5, s1 = P.snap * 1.6;
    const k = r < 1e-6 ? 0 : smooth((r - s0) / (s1 - s0)) * calm;            // a plateau at home, where the letters are exact
    return [hx + dx * k * P.range * P.slant, hy + dy * k * P.range * P.slant];
  }

  // ---------- the frame ----------
  function frame(t) {
    const [lx, ly] = lamp(), ll = Math.hypot(lx, ly, 1);
    c2.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    c2.fillStyle = bg; c2.fillRect(0, 0, W, H);
    for (const s of shapes) {
      let M = s.M0;
      if (s.spin) { const u = (t - s.spin.t0) / s.spin.dur; if (u >= 1) s.spin = null; else if (u > 0) M = mul3(rotAxis(s.spin.ax, s.spin.ay, s.spin.az, Math.PI * 2 * smooth(u)), s.M0); }
      const { V, SH } = project(s.mesh, M, s.x, s.y, s.z, s.r, lx, ly);
      s.V = V; s.M = M; s.sh = hull(SH); s.hull = hull(V);
      s.shs = s.mesh.segs ? s.mesh.segs.map((ix) => hull(ix.map((i) => SH[i]))) : [s.sh];
    }
    c2.beginPath();
    for (const s of shapes) for (const poly of s.shs) { c2.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) c2.lineTo(poly[i][0], poly[i][1]); c2.closePath(); }
    c2.fillStyle = fg; c2.fill();                                             // the shadows: solid ink on the wall
    // the blocks, low first; each face is tinted by how squarely the light meets it
    c2.lineJoin = 'round'; c2.lineWidth = 1; const edge = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
    for (const s of shapes) {
      const { f, n, round } = s.mesh, M = s.M, nf = f.length;
      for (let k = 0; k < nf; k++) {
        const nz = M[6] * n[k][0] + M[7] * n[k][1] + M[8] * n[k][2];
        if (nz <= 0.01) continue;                                             // facing away
        const nx = M[0] * n[k][0] + M[1] * n[k][1] + M[2] * n[k][2], ny = M[3] * n[k][0] + M[4] * n[k][1] + M[5] * n[k][2];
        const lit = Math.max(0, (nx * lx + ny * ly + nz) / ll);
        const tone = Math.round(255 * (dark ? 0.1 + 0.42 * lit : 0.42 + 0.56 * lit));
        const q = f[k].map((i) => s.V[i]);
        c2.beginPath(); c2.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c2.lineTo(q[i][0], q[i][1]); c2.closePath();
        c2.fillStyle = `rgb(${tone},${tone},${tone})`; c2.fill();
        c2.strokeStyle = round && q.length === 4 ? `rgb(${tone},${tone},${tone})` : edge; c2.stroke();   // a round block shows edges on its ends only
      }
    }
    lampPos = [lx, ly];
  }

  // ---------- reveal: a ray from each block to its shadow, the light and its slant ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const col = (x) => rvInk(stage, x), [lx, ly] = lampPos;
    grid(c, W_, H_, 24, col, k); corners(c, W_, H_, 16, col, k);
    c.lineWidth = 0.8;
    c.strokeStyle = col(0.7 * k); c.lineWidth = 1; c.setLineDash([5, 4]);                               // each piece's shadow, outlined
    for (const s of shapes) for (const poly of s.shs || []) { c.beginPath(); c.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) c.lineTo(poly[i][0], poly[i][1]); c.closePath(); c.stroke(); }
    c.setLineDash([]); c.lineWidth = 0.8;
    for (const s of shapes) {
      const q = s.sh && s.sh.length ? s.sh.reduce((a, p) => [a[0] + p[0] / s.sh.length, a[1] + p[1] / s.sh.length], [0, 0]) : [s.x, s.y];
      c.strokeStyle = col(0.55 * k); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(q[0], q[1]); c.stroke(); c.setLineDash([]);
      c.fillStyle = col(0.9 * k); c.beginPath(); c.arc(s.x, s.y, 2.2, 0, 7); c.fill();
      c.strokeStyle = col(0.9 * k); c.beginPath(); c.moveTo(q[0] - 3.5, q[1]); c.lineTo(q[0] + 3.5, q[1]); c.moveTo(q[0], q[1] - 3.5); c.lineTo(q[0], q[1] + 3.5); c.stroke();
    }
    const cx = W_ - 70, cy = 120, len = Math.hypot(lx, ly) || 1;               // the light: a sun in the corner it comes from, with the way its shadows fall
    c.strokeStyle = col(k); c.lineWidth = 1.4; c.beginPath(); c.arc(cx, cy, 14, 0, 7); c.stroke();
    for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(an) * 19, cy + Math.sin(an) * 19); c.lineTo(cx + Math.cos(an) * 26, cy + Math.sin(an) * 26); c.stroke(); }
    c.setLineDash([4, 3]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - lx / len * 70, cy - ly / len * 70); c.stroke(); c.setLineDash([]);
    const z0 = shapes.length ? Math.round(Math.min(...shapes.map((s) => s.z)) / H * 100) : 0, z1 = shapes.length ? Math.round(Math.max(...shapes.map((s) => s.z)) / H * 100) : 0;
    titleBlock(c, W_, H_, ['SHADOW · PLAN', '● block  ┄ ray  + shadow', `${shapes.length} blocks · height ${z0}–${z1}% of the wall`, `light ${Math.round(Math.atan(len) * 57.3)}° from the wall`, `letters covered ${Math.round(cover * 100)}% · spill ${Math.round(spill * 100)}%`], col, k);
  });
  offs.push(stage.on('reveal', (on) => { revealed = on; dirty = true; }));

  // ---------- input ----------
  const hitShape = (q) => { for (let i = shapes.length - 1; i >= 0; i--) { const s = shapes[i]; if (s.hull && inside(s.hull, q.x, q.y)) return s; } return null; };
  offs.push(stage.on('down', (q, e) => { press.down(q, e.pointerId); lastMove = now; touched = true; demo = null; dirty = true; }));
  offs.push(stage.on('move', (q, e) => { press.move(q, e.pointerId); lastMove = now; dirty = true; }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId); lastMove = now; dirty = true;
    if (!r || !r.tap) return;
    const s = hitShape(q);
    if (s) {                                                                  // a tap on a block: it and its neighbours turn a full turn, the nearest first
      const ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() - 0.5;
      for (const o of shapes) { const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < s.r * 3 + tR) o.spin = { t0: now + d / (tR * 14), dur: 1.1, ax, ay, az }; }
    } else {                                                                  // empty space: two quick taps make a new plan (a beat later, so a third tap can mean reveal)
      const t = performance.now();
      if (t - lastEmpty < DOUBLE_MS) { clearTimeout(reformT); reformT = setTimeout(reform, REFORM_DELAY_MS); }
      lastEmpty = t;
    }
  }));
  offs.push(stage.on('reveal', () => clearTimeout(reformT)));
  function resize() { W = stage.W; H = stage.H; shapes = []; build(); }
  offs.push(stage.on('resize', resize));
  resize();

  offs.push(stage.frame((dt, t) => {
    now = t;
    // the light eases home when left alone, and a finger's drag offset is let go after the same wait
    const idle = now - lastMove;
    if (P.rest > 0 && idle > P.rest) { calm = Math.max(0, calm - dt / 1.2); if (stage.ptr.type !== 'mouse' && !stage.ptr.down) { stage.look.tx *= 1 - Math.min(1, dt * 2.5); stage.look.ty *= 1 - Math.min(1, dt * 2.5); } }
    else calm = Math.min(1, calm + dt / 0.25);
    // the hint: until the first touch, the light swings once, slowly, now and then
    if (!touched && !stage.interacted && !stage.reduced) {
      idleT += dt;
      if (!demo && idleT > nextDemo) demo = { t: 0, dur: 3.4, ang: Math.random() * 6.28 };
      if (demo) { demo.t += dt; if (demo.t >= demo.dur) { demo = null; nextDemo = idleT + 9 + Math.random() * 4; } }
    } else demo = null;
    const spinning = shapes.some((s) => s.spin);
    const moving = Math.abs(stage.look.x - lastLook[0]) + Math.abs(stage.look.y - lastLook[1]) > 1e-4 || (calm < 1 && calm > 0) || demo || spinning;
    lastLook = [stage.look.x, stage.look.y];
    if (dirty || moving || revealed) { frame(now); dirty = false; }
    rv.draw();
  }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Shadow', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Light', items: [Ctl('slant', 'How low the light sits (longer shadows, re-forms)', 0.5, 4, 0.05), Ctl('range', 'How far the light swings', 0.1, 1.2, 0.01), Ctl('snap', 'Snap-to-home plateau', 0, 0.2, 0.005), Ctl('rest', 'Light returns home after (s, 0 = never)', 0, 20, 0.5)] },
        { name: 'Blocks', items: [Ctl('size', 'Block size (re-forms)', 0.5, 2.2, 0.05), Ctl('depth', 'How far blocks stand from the wall (re-forms)', 0.08, 0.8, 0.01)] },
      ],
      actions: { 'New plan': reform },
      set(key, value) { P[key] = value; if (key === 'size' || key === 'depth' || key === 'slant') reform(); dirty = true; },
      reset() { Object.assign(P, DEFAULTS); reform(); },
    },
    debug: { shapes: () => shapes, lamp: () => lampPos, frame: () => frame(now), count: () => shapes.length, cover: () => [cover, spill] },
    destroy() { clearTimeout(reformT); rv.destroy(); offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
