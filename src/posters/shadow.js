// Shadow. The type is drafted first, as exact letterforms. Then it is built as relief glued to the wall: thin raised fins standing on the
// surface, lit by one directional light that grazes along the wall from the side. Each fin throws a long shadow across the wall, and the
// shadows (with the fins themselves) are the type, exactly. There are about 30 fins, never more than 50.
//
// How the type is cut into fins. The light has a direction along the wall and a low elevation (|l| = 1 / tan(elevation), large). A point at
// height h above the wall throws its shadow a distance h * |l| away from the light, along the wall. So a letter is cut by lines parallel
// to the light into runs. Each run has a lit end (toward the light) and a far end; a fin stands at the lit end, as high as the run is
// long divided by |l| (less its own thickness), so the shadow of its top reaches exactly to the far end. Neighbouring runs that line up
// are one fin: a smooth ridge, with the height changing along it as the run length does. Where the lit edge steps (an arm of the E
// against the stem), a new fin starts: a tall post for the long run, a low ridge for the short one. Every fin is as high as its shadow is long,
// so every fin matters, and the heights are the sculpture.
//
// Move the light (any side, any height) and every shadow turns and stretches by its own fin's height: the type tears apart. At home it is exact.
//
// Look: shadows are solid ink on the wall; the fins are lit solids (faces tinted by how squarely the light meets them, hairline edges).
// Black on white, then white on black. The camera orbits (drag; keys 1 to 4); L shows the light.
//
// Touch: the light follows the pointer (a dragging finger, or a tilt: stage.look); a small plateau around home snaps the type back. A tap on a
// fin makes it grow and shrink once, and its shadow with it. Left alone, the light eases home. Double tap on empty space: a new plan.
// Three quick taps: reveal (the page inverts; the lit edge, the far edge, and a ray along each shadow). The hint: until the first touch,
// the light swings once, slowly, now and then.
import { createReveal, ink as rvInk, grid, corners, titleBlock } from './reveal.js';
import { SKELETON, radiusFor } from './lettering.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';

const smooth = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
const area = (poly) => { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; return a / 2; };
const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// ---------- drafting the type, and cutting it into fins ----------
// the type as a mask (half size): every stroke of every letter, drawn as a band of width w
function draftMask(poses, w, mw, mh) {
  const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
  const mx = mc.getContext('2d', { willReadFrequently: true });
  mx.fillStyle = '#000'; mx.fillRect(0, 0, mw, mh); mx.strokeStyle = '#fff'; mx.lineWidth = w / 2; mx.lineCap = 'square'; mx.lineJoin = 'miter';
  for (const pose of poses) for (const st of SKELETON[pose.ch].s()) {
    mx.beginPath(); st.pts.forEach((q, i) => { const X = (pose.x + q.x * pose.w) / 2, Y = (pose.y + q.y * pose.h) / 2; i ? mx.lineTo(X, Y) : mx.moveTo(X, Y); }); mx.stroke();
  }
  const px = mx.getImageData(0, 0, mw, mh).data, m = new Uint8Array(mw * mh); let total = 0;
  for (let i = 0; i < m.length; i++) if (px[i * 4] > 128) { m[i] = 1; total++; }
  return { m, total };
}
// cut the mask by lines parallel to the light (unit vector lh, toward the light) into runs, link the runs that line up into chains
function cutRuns(mask, mw, mh, lh) {
  const [lx, ly] = lh, nx = -ly, ny = lx, cs = [[0, 0], [mw, 0], [mw, mh], [0, mh]];
  const ts = cs.map((c) => c[0] * nx + c[1] * ny), ss = cs.map((c) => c[0] * lx + c[1] * ly);
  const t0 = Math.ceil(Math.min(...ts)), t1 = Math.floor(Math.max(...ts)), s0 = Math.min(...ss), s1 = Math.max(...ss), rows = [];
  for (let t = t0; t <= t1; t++) {
    const runs = []; let cur = null;
    for (let s = s0; s <= s1; s += 0.5) {
      const x = Math.round(t * nx + s * lx), y = Math.round(t * ny + s * ly), on = x >= 0 && y >= 0 && x < mw && y < mh && mask[y * mw + x];
      if (on) { if (!cur) cur = { a: s, b: s, t, next: null, prev: null }; else cur.b = s; } else if (cur) { if (cur.b - cur.a >= 2) runs.push(cur); cur = null; }
    }
    if (cur && cur.b - cur.a >= 2) runs.push(cur);
    rows.push(runs);
  }
  for (let k = 0; k + 1 < rows.length; k++) {
    const cand = (a) => rows[k + 1].filter((b) => Math.min(a.b, b.b) - Math.max(a.a, b.a) > 1 && Math.abs(a.b - b.b) <= 6);   // they overlap and the lit ends line up
    for (const a of rows[k]) { const c = cand(a); if (c.length === 1) { const back = rows[k].filter((q) => Math.min(q.b, c[0].b) - Math.max(q.a, c[0].a) > 1 && Math.abs(q.b - c[0].b) <= 6); if (back.length === 1) { a.next = c[0]; c[0].prev = a; } } }
  }
  const chains = [];
  for (const r of rows) for (const a of r) if (!a.prev) { const ch = []; for (let q = a; q; q = q.next) ch.push(q); chains.push(ch); }
  return chains;
}

export function mount(stage) {
  const c2 = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const bg = dark ? '#000' : '#fff', fg = dark ? '#fff' : '#000';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];
  let seedBump = 0;

  const DEFAULTS = { showLight: 0, glass: 0.75, angle: 0, slant: 3.2, span: 0.9, weight: 1, ridge: 0.14, range: 0.35, snap: 0.07, rest: 4 };
  const P = { ...DEFAULTS };
  const home = () => { const a = P.angle * Math.PI / 180; return [Math.cos(a) * P.slant, -Math.sin(a) * P.slant]; };   // where the light comes from: 0 is the right, 90 the top; shadows fall the other way

  let W = 1, H = 1, objs = [], tR = 20, cover = 0;
  let cam = { yaw: 0, pitch: 0, ty: 0, tp: 0 }, R = [1, 0, 0, 0, 1, 0, 0, 0, 1], lookS = [0, 0], held = null, drag = null, dirty = true, now = 0, lastMove = 0, calm = 1, touched = false, idleT = 0, nextDemo = 3.5, demo = null, reformT = 0, lastEmpty = 0, revealed = false, lastLook = [0, 0], lampPos = [0, 0];
  const press = pressTracker();

  // ---------- layout: the same composition as the other type posters, kept to the left so the solids, which hang toward the light, stay on the page ----------
  function layout() {
    const portrait = W / H < 0.85;
    const rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96;
    const availW = (W - 2 * padX) * (portrait ? 0.84 : P.span), availH = H - top - bottom, gap = 0.06;
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

  // ---------- the plan: cut the drafted type into fins ----------
  function build() {
    const poses = layout();
    tR = radiusFor(poses[0].ch, poses[0].w, poses[0].h) * 0.8;
    const w = tR * 2 * P.weight, [hx, hy] = home(), L = Math.hypot(hx, hy) || 1, lh = [hx / L, hy / L], mw = Math.ceil(W / 2), mh = Math.ceil(H / 2);
    const { m, total } = draftMask(poses, w, mw, mh), nx = -lh[1], ny = lh[0], delta = Math.max(5, Math.min(14, w * P.ridge));
    const chains = cutRuns(m, mw, mh, lh).map((c) => (c.length === 1 ? [c[0], { ...c[0], t: c[0].t + 1 }] : c));
    let got = 0;
    objs = chains.map((ch) => {
      const R = [], I = [], h = [], ends = [], step = Math.max(1, Math.round(ch.length / 40)), idx = [];
      for (let i = 0; i < ch.length; i += step) idx.push(i);
      if (idx[idx.length - 1] !== ch.length - 1) idx.push(ch.length - 1);
      for (const i of idx) {
        const r = ch[i], d = (r.b - r.a) * 2 + 1, dl = Math.min(delta, d * 0.5), cx = (r.t * nx + r.b * lh[0]) * 2, cy = (r.t * ny + r.b * lh[1]) * 2;
        R.push([cx, cy]); I.push([cx - dl * lh[0], cy - dl * lh[1]]); h.push(Math.max(2, (d - dl) / L)); ends.push([cx - d * lh[0], cy - d * lh[1]]);
        got += d;
      }
      for (const [arr, at, sg] of [[R, 0, -1], [I, 0, -1], [ends, 0, -1], [R, R.length - 1, 1], [I, I.length - 1, 1], [ends, ends.length - 1, 1]]) { arr[at] = [arr[at][0] + sg * nx * 1.5, arr[at][1] + sg * ny * 1.5]; }   // a run is a row of the mask: reach half a row past the ends so neighbouring fins overlap and leave no seam
      const c = [R.reduce((a, p) => a + p[0], 0) / R.length, R.reduce((a, p) => a + p[1], 0) / R.length];
      return { R, I, h, ends, c, slide: null, faces: [], sc: null, depth: 0, mid: R.length >> 1, hmax: Math.max(...h) };
    }).slice(0, 50).sort((a, b) => a.hmax - b.hmax);
    cover = Math.min(1, got / Math.max(1, total * 4));
    dirty = true;
  }
  const reform = () => { objs = []; seedBump++; build(); };

  // ---------- the light ----------
  function lamp() {                                                           // the slant: home, plus what the pointer adds (zero on the home plateau)
    const [hx, hy] = home();
    let dx = lookS[0], dy = -lookS[1];
    if (demo) { const u = demo.t / demo.dur, a = Math.sin(u * Math.PI) * Math.sin(u * Math.PI * 2); dx += Math.cos(demo.ang) * a * 0.22; dy += Math.sin(demo.ang) * a * 0.22; }
    const r = Math.hypot(dx, dy), s0 = P.snap * 0.5, s1 = P.snap * 1.6;
    const k = r < 1e-6 ? 0 : smooth((r - s0) / (s1 - s0)) * calm;            // a plateau at home, where the type is exact
    return [hx + dx * k * P.range * P.slant, hy + dy * k * P.range * P.slant];
  }

  // ---------- the camera: orbit about the middle of the wall ----------
  const cam3 = () => {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    R = [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy];           // Rx(pitch) * Ry(yaw)
  };
  const pr = (x, y, z) => { const dx = x - W / 2, dy = y - H / 2; return [W / 2 + R[0] * dx + R[2] * z, H / 2 + R[3] * dx + R[4] * dy + R[5] * z, R[6] * dx + R[7] * dy + R[8] * z]; };
  const view = (name) => {                                                    // preset views
    const [hx, hy] = home();
    if (name === 'front') { cam.ty = 0; cam.tp = 0; }
    else if (name === 'side') { cam.ty = -Math.PI / 2; cam.tp = 0; }          // along the wall: how far each solid stands out
    else if (name === 'top') { cam.ty = 0; cam.tp = -Math.PI / 2; }
    else if (name === 'light') { cam.ty = Math.atan(-hx); const z1 = (-hx * Math.sin(cam.ty) + Math.cos(cam.ty)); cam.tp = Math.atan2(hy, z1); }   // from the lamp, looking down the beams: the solids line up as the type
    if (stage.reduced) { cam.yaw = cam.ty; cam.pitch = cam.tp; }
    dirty = true;
  };

  // ---------- the frame ----------
  function frame(t) {
    const [lx, ly] = lamp(), [hx, hy] = home(), ll = Math.hypot(lx, ly, 1);
    cam3();
    c2.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    c2.fillStyle = bg; c2.fillRect(0, 0, W, H);
    const framed = Math.abs(cam.yaw) + Math.abs(cam.pitch) > 0.002;
    if (framed) {                                                             // the wall, as a sheet, once the view is not straight on
      const q = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => pr(x, y, 0));
      c2.beginPath(); q.forEach((p, i) => (i ? c2.lineTo(p[0], p[1]) : c2.moveTo(p[0], p[1]))); c2.closePath();
      c2.fillStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)'; c2.fill(); c2.strokeStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'; c2.lineWidth = 1; c2.stroke();
    }
    const shadow = [];
    for (const o of objs) {
      let k = 1;
      if (o.slide) { const u = (t - o.slide.t0) / o.slide.dur; if (u >= 1) o.slide = null; else if (u > 0) k = 1 + Math.sin(Math.PI * smooth(u)) * o.slide.amp; }   // a tap: the fin grows (or shrinks) and settles
      const m = o.R.length, faces = [];
      const rv = (i, z) => [o.R[i][0], o.R[i][1], z], iv = (i, z) => [o.I[i][0], o.I[i][1], z];
      for (let i = 0; i + 1 < m; i++) {
        const j = i + 1, hi = o.h[i] * k, hj = o.h[j] * k, mid = [(o.R[i][0] + o.R[j][0] + o.I[i][0] + o.I[j][0]) / 4, (o.R[i][1] + o.R[j][1] + o.I[i][1] + o.I[j][1]) / 4, (hi + hj) / 4];
        faces.push({ v: [rv(i, hi), rv(j, hj), iv(j, hj), iv(i, hi)], kind: 'top', ref: mid });
        faces.push({ v: [rv(i, 0), rv(j, 0), rv(j, hj), rv(i, hi)], kind: 'side', ref: mid });
        faces.push({ v: [iv(i, 0), iv(j, 0), iv(j, hj), iv(i, hi)], kind: 'side', ref: mid });
      }
      const e = (i) => ({ v: [rv(i, 0), iv(i, 0), iv(i, o.h[i] * k), rv(i, o.h[i] * k)], kind: 'side', ref: [(o.R[i][0] + o.I[i][0]) / 2 + (i ? 0 : 0), (o.R[i][1] + o.I[i][1]) / 2, o.h[i] * k / 2] });
      const e0 = e(0), e1 = e(m - 1);
      e0.ref = [e0.ref[0] - (o.R[1][0] - o.R[0][0]), e0.ref[1] - (o.R[1][1] - o.R[0][1]), e0.ref[2]];                       // outward means away from the rest of the fin
      e1.ref = [e1.ref[0] - (o.R[m - 2][0] - o.R[m - 1][0]), e1.ref[1] - (o.R[m - 2][1] - o.R[m - 1][1]), e1.ref[2]];
      faces.push(e0, e1);
      for (const f of faces) {
        // its shadow on the wall for the light now (the corners thrown along it)
        const sp = f.v.map((p) => [p[0] - p[2] * lx, p[1] - p[2] * ly]);
        if (area(sp) < 0) sp.reverse();
        shadow.push(sp.map((p) => pr(p[0], p[1], 0)));
        // its normal, outward (in the world), and whether the camera sees it
        const [a0, a1, , a3] = f.v, ux = a1[0] - a0[0], uy = a1[1] - a0[1], uz = a1[2] - a0[2], vx = a3[0] - a0[0], vy = a3[1] - a0[1], vz = a3[2] - a0[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz);
        if (l < 1e-6) { f.cz = -1; f.s = []; continue; }
        nx /= l; ny /= l; nz /= l;
        const cx = f.v.reduce((a, p) => a + p[0], 0) / f.v.length - f.ref[0], cy = f.v.reduce((a, p) => a + p[1], 0) / f.v.length - f.ref[1], cz = f.v.reduce((a, p) => a + p[2], 0) / f.v.length - f.ref[2];
        if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        f.n = [nx, ny, nz];
        f.s = f.v.map((p) => pr(p[0], p[1], p[2]));                            // on the screen: x, y, depth
        f.d = f.s.reduce((a, p) => a + p[2], 0) / f.s.length;
        f.cz = R[6] * nx + R[7] * ny + R[8] * nz;                              // its normal's depth: it faces the camera when positive
      }
      const mi = o.mid, hm = o.h[mi] * k;
      o.sc = [o.R[mi][0] - hm * lx, o.R[mi][1] - hm * ly];                      // where the shadow of the middle of the ridge falls
      o.faces = faces.filter((f) => f.cz > 0.005).sort((a, b) => a.d - b.d);
      o.depth = o.faces.length ? o.faces.reduce((a, f) => a + f.d, 0) / o.faces.length : -1e9;
    }
    c2.beginPath();
    for (const sp of shadow) { c2.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) c2.lineTo(sp[i][0], sp[i][1]); c2.closePath(); }
    c2.fillStyle = fg; c2.fill();                                             // the shadows: solid ink on the wall
    c2.lineJoin = 'round'; c2.lineWidth = 0.6; c2.strokeStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
    for (const o of objs.slice().sort((a, b) => a.depth - b.depth)) for (const f of o.faces) {
      const lit = Math.max(0, (f.n[0] * lx + f.n[1] * ly + f.n[2]) / ll), tone = Math.round(255 * (dark ? 0.1 + 0.46 * lit : 0.4 + 0.58 * lit));
      c2.beginPath(); c2.moveTo(f.s[0][0], f.s[0][1]); for (let i = 1; i < f.s.length; i++) c2.lineTo(f.s[i][0], f.s[i][1]); c2.closePath();
      c2.fillStyle = `rgba(${tone},${tone},${tone},${P.glass})`; c2.fill(); c2.stroke();           // faces are part glass, so the shadow type shows through the solids
    }
    if (P.showLight) drawLight(lx, ly);
    lampPos = [lx, ly];
  }

  // The light, shown: a ray for every solid, parallel, from the lamp's side down to where that solid's shadow falls (each passes through its
  // solid), and the lamp itself at the far end. A directional light is infinitely far; the lamp is drawn as near as keeps it on the screen.
  function drawLight(lx, ly) {
    const col = (a) => (dark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`), m = Math.max(W, H);
    let zl = 0.85 * m, Lp = pr(W / 2 + lx * zl, H / 2 + ly * zl, zl);
    for (let i = 0; i < 10 && !(Lp[0] > 50 && Lp[0] < W - 50 && Lp[1] > 50 && Lp[1] < H - 50); i++) { zl *= 0.78; Lp = pr(W / 2 + lx * zl, H / 2 + ly * zl, zl); }
    c2.save(); c2.lineWidth = 0.9; c2.setLineDash([7, 5]); c2.strokeStyle = col(0.6);
    for (const o of objs) {
      if (!o.sc) continue;
      const a = pr(o.sc[0], o.sc[1], 0), b = pr(o.sc[0] + lx * zl, o.sc[1] + ly * zl, zl);
      c2.beginPath(); c2.moveTo(a[0], a[1]); c2.lineTo(b[0], b[1]); c2.stroke();
    }
    c2.setLineDash([]); c2.strokeStyle = col(0.95); c2.fillStyle = bg; c2.lineWidth = 1.6;                      // the lamp
    c2.beginPath(); c2.arc(Lp[0], Lp[1], 15, 0, 7); c2.fill(); c2.stroke();
    for (let a = 0; a < 10; a++) { const an = a / 10 * Math.PI * 2; c2.beginPath(); c2.moveTo(Lp[0] + Math.cos(an) * 21, Lp[1] + Math.sin(an) * 21); c2.lineTo(Lp[0] + Math.cos(an) * 31, Lp[1] + Math.sin(an) * 31); c2.stroke(); }
    c2.restore();
  }

  // ---------- reveal: the drafted type, a ray from each solid to its piece, the light ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const col = (x) => rvInk(stage, x), [lx, ly] = lampPos;
    grid(c, W_, H_, 24, col, k); corners(c, W_, H_, 16, col, k);
    c.strokeStyle = col(0.9 * k); c.lineWidth = 1.1; c.setLineDash([5, 4]);                            // the far end of every run: where the type's dark edge is drafted
    for (const o of objs) { c.beginPath(); o.ends.forEach((p, i) => { const q = pr(p[0], p[1], 0); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); }
    c.setLineDash([3, 3]); c.lineWidth = 0.8; c.strokeStyle = col(0.55 * k);
    for (const o of objs) {                                                                              // a ray along the shadow: from the middle of the fin's ridge to the middle of the far edge
      const q = pr(o.R[o.mid][0], o.R[o.mid][1], 0), z = pr(o.ends[o.mid][0], o.ends[o.mid][1], 0);
      c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(z[0], z[1]); c.stroke();
      c.fillStyle = col(0.9 * k); c.beginPath(); c.arc(q[0], q[1], 2.4, 0, 7); c.fill();
    }
    c.setLineDash([]);
    const cx = W_ - 70, cy = 120, len = Math.hypot(lx, ly) || 1;               // the light: a sun in the corner it comes from, with the way its shadows fall
    c.strokeStyle = col(k); c.lineWidth = 1.4; c.beginPath(); c.arc(cx, cy, 14, 0, 7); c.stroke();
    for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(an) * 19, cy + Math.sin(an) * 19); c.lineTo(cx + Math.cos(an) * 26, cy + Math.sin(an) * 26); c.stroke(); }
    c.setLineDash([4, 3]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - lx / len * 70, cy - ly / len * 70); c.stroke(); c.setLineDash([]);
    const zs = objs.flatMap((o) => o.h), z0 = zs.length ? Math.round(Math.min(...zs) / H * 100) : 0, z1 = zs.length ? Math.round(Math.max(...zs) / H * 100) : 0;
    titleBlock(c, W_, H_, ['SHADOW · PLAN', '● fin  ┄ shadow  ┈ far edge of the type', `${objs.length} fins · height ${z0}–${z1}% of the wall`, `light ${Math.round(Math.atan(1 / len) * 57.3)}° above the wall`, `type covered ${Math.round(cover * 100)}%`], col, k);
  });
  offs.push(stage.on('reveal', (on) => { revealed = on; dirty = true; }));

  // ---------- input ----------
  const hitObj = (q) => { for (const o of objs.slice().sort((a, b) => b.depth - a.depth)) for (let k = o.faces.length - 1; k >= 0; k--) if (inside(o.faces[k].s, q.x, q.y)) return o; return null; };
  offs.push(stage.on('down', (q, e) => { press.down(q, e.pointerId); lastMove = now; touched = true; demo = null; drag = { x: q.x, y: q.y, on: false, id: e.pointerId }; dirty = true; }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId); lastMove = now; dirty = true;
    if (drag && e.pointerId === drag.id) {                                    // a drag (more than the tap's 8 px) turns the camera; the light stays where it was
      if (!drag.on && Math.hypot(q.x - drag.x, q.y - drag.y) > 8) { drag.on = true; held = [lookS[0], lookS[1]]; drag.x = q.x; drag.y = q.y; }
      if (drag.on) { cam.ty = cam.yaw = Math.max(-Math.PI, Math.min(Math.PI, cam.yaw + (q.x - drag.x) * 0.006)); cam.tp = cam.pitch = Math.max(-1.55, Math.min(1.55, cam.pitch + (q.y - drag.y) * 0.006)); drag.x = q.x; drag.y = q.y; }
    }
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId); lastMove = now; dirty = true;
    if (drag && e.pointerId === drag.id) { drag = null; held = null; }
    if (!r || !r.tap) return;
    const o = hitObj(q);
    if (o) { o.slide = { t0: now, dur: 1.5, amp: Math.random() < 0.5 ? 0.7 : -0.6 }; }                       // a tap: the fin grows (or shrinks) and settles, and its shadow with it
    else {                                                                    // empty space: two quick taps make a new plan (a beat later, so a third tap can mean reveal)
      const t = performance.now();
      if (t - lastEmpty < DOUBLE_MS) { clearTimeout(reformT); reformT = setTimeout(reform, REFORM_DELAY_MS); }
      lastEmpty = t;
    }
  }));
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, textarea, [contenteditable]'))) return;
    const v = { 1: 'front', 2: 'side', 3: 'top', 4: 'light' }[e.key]; if (v) view(v);
    if (e.key === 'l' || e.key === 'L') { P.showLight = P.showLight ? 0 : 1; dirty = true; if (stage.refreshPanel) stage.refreshPanel(); }
  };
  addEventListener('keydown', onKey);
  offs.push(stage.on('reveal', () => clearTimeout(reformT)));
  function resize() { W = stage.W; H = stage.H; objs = []; build(); }
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
    const sliding = objs.some((o) => o.slide);
    const tgt = held || [stage.look.x, stage.look.y], k = stage.reduced ? 1 : 1 - Math.exp(-dt * 12);       // the light follows the pointer, eased; while you drag the camera it holds
    lookS[0] += (tgt[0] - lookS[0]) * k; lookS[1] += (tgt[1] - lookS[1]) * k;
    const ck = stage.reduced ? 1 : 1 - Math.exp(-dt * 7);
    const camMoving = Math.abs(cam.ty - cam.yaw) + Math.abs(cam.tp - cam.pitch) > 1e-3;
    if (camMoving) { cam.yaw += (cam.ty - cam.yaw) * ck; cam.pitch += (cam.tp - cam.pitch) * ck; }
    const moving = Math.abs(lookS[0] - lastLook[0]) + Math.abs(lookS[1] - lastLook[1]) > 1e-4 || (calm < 1 && calm > 0) || demo || sliding || camMoving;
    lastLook = [lookS[0], lookS[1]];
    if (dirty || moving || revealed) { frame(now); dirty = false; }
    rv.draw();
  }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Shadow', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Light', items: [Ctl('angle', 'Where the light comes from (0 right, 90 top, 180 left)', -90, 270, 1), Ctl('slant', 'How low the light sits (re-forms)', 0.8, 6, 0.05), Ctl('range', 'How far the light swings', 0.1, 1.2, 0.01), Ctl('snap', 'Snap-to-home plateau', 0, 0.2, 0.005), Ctl('rest', 'Light returns home after (s, 0 = never)', 0, 20, 0.5)] },
        { name: 'View', items: [Ctl('showLight', 'Show the light (L)', 0, 1, 1)] },
        { name: 'Type and solids', items: [Ctl('span', 'How much of the page the type spans (re-forms)', 0.4, 1, 0.01), Ctl('weight', 'Letter weight (re-forms)', 0.6, 2, 0.05), Ctl('ridge', 'Thickness of each fin (re-forms)', 0.05, 0.4, 0.005), Ctl('glass', 'How solid the faces are', 0.1, 1, 0.01)] },
      ],
      actions: { 'New plan': reform, 'L  Show or hide the light': () => { P.showLight = P.showLight ? 0 : 1; dirty = true; }, '1  Front': () => view('front'), '2  Side (how far each solid stands out)': () => view('side'), '3  Top': () => view('top'), '4  From the light (the solids line up as the type)': () => view('light') },
      set(key, value) { P[key] = value; if (['weight', 'ridge', 'angle', 'slant', 'span'].includes(key)) reform(); dirty = true; },
      reset() { Object.assign(P, DEFAULTS); reform(); },
    },
    debug: { cam, view, pr, R: () => R, home, cover: () => cover, objs: () => objs, lamp: () => lampPos, frame: () => frame(now), count: () => objs.length },
    destroy() { removeEventListener('keydown', onKey); clearTimeout(reformT); rv.destroy(); offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
