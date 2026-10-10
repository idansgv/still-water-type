// Shadow. The type is drafted first, as exact stroke shapes (bands, bars, arcs). Then each piece of the type becomes one solid: the piece
// extruded along the light, at a height of its own, with its two ends cut at slants of their own. Under the one directional light the
// shadow of every solid is exactly its piece, and the pieces together are exactly the type. There are about 25 solids, never more than 50.
//
// Why it is exact: the light is a far lamp with slant l. A point at height z above the wall throws its shadow to (x - z * lx, y - z * ly).
// So the point whose shadow must land on p, at height z, sits at p + z * l; whatever height each point of the piece is given, its shadow
// lands on p. A solid whose bottom and top faces are the piece lifted to any heights (and so slanted any way) therefore casts exactly the
// piece. The sides of the solid are parallel to the light: it is a beam of light made solid.
//
// So the heights and slants are free, and they are the sculpture: every solid hangs at its own height and its ends lean their own way. Move
// the light and each shadow shears by the height of every point of it: the tall ends swing far, the low ends barely, and the type tears.
// At first glance the solids are a few slanting slabs; the type is only in the shadow.
//
// Look: shadows are solid ink on the wall; the solids are lit (faces tinted by how squarely the light meets them, hairline edges).
// Black on white, then white on black.
//
// Touch: the light's slant follows the pointer (a dragging finger, or a tilt: stage.look); a small plateau around home snaps the type
// back. A tap on a solid slides it along the light and back: the shadow, at home, does not move. Left alone, the light eases home.
// Double tap on empty space: a new plan (new heights and slants). Three quick taps: reveal (the page inverts; the drafted type outlined,
// a ray from each solid to its piece, the light). The hint: until the first touch, the light swings once, slowly, now and then.
import { createReveal, ink as rvInk, grid, corners, titleBlock } from './reveal.js';
import { SKELETON, radiusFor } from './lettering.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';

const smooth = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
const area = (poly) => { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; return a / 2; };
const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// ---------- drafting the type: every stroke of every letter as exact shapes ----------
// a band of width w around a path (a curve), with its ends squared off and lengthened by ext
function band(pts, w, ext) {
  const n = pts.length, P = pts.map((p) => [p.x, p.y]);
  const tan = (i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const t0 = tan(0), t1 = tan(n - 1);
  P[0] = [P[0][0] - t0[0] * ext, P[0][1] - t0[1] * ext]; P[n - 1] = [P[n - 1][0] + t1[0] * ext, P[n - 1][1] + t1[1] * ext];
  const L = [], R = [];
  for (let i = 0; i < n; i++) { const t = tan(i), nx = -t[1] * w / 2, ny = t[0] * w / 2; L.push([P[i][0] + nx, P[i][1] + ny]); R.push([P[i][0] - nx, P[i][1] - ny]); }
  return L.concat(R.reverse());
}
function draft(poses, w) {
  const pieces = [];
  for (const pose of poses) for (const st of SKELETON[pose.ch].s()) {
    const pts = st.pts.map((q) => ({ x: pose.x + q.x * pose.w, y: pose.y + q.y * pose.h }));
    if (st.sharp) { for (let i = 0; i < pts.length - 1; i++) pieces.push({ ch: pose.ch, poly: band([pts[i], pts[i + 1]], w, w * 0.3) }); }   // a straight stroke: one bar
    else pieces.push({ ch: pose.ch, poly: band(pts.filter((_, i, A) => i % 2 === 0 || i === A.length - 1), w, w * 0.12) });                  // a curve: one bent band
  }
  return pieces;
}

export function mount(stage) {
  const c2 = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const bg = dark ? '#000' : '#fff', fg = dark ? '#fff' : '#000';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];
  let seedBump = 0;

  const DEFAULTS = { showLight: 0, glass: 0.5, angle: 20, slant: 1.8, span: 0.72, weight: 1, depth: 0.15, length: 0.06, lean: 0.35, range: 0.5, snap: 0.07, rest: 4 };
  const P = { ...DEFAULTS };
  const home = () => { const a = P.angle * Math.PI / 180; return [Math.cos(a) * P.slant, -Math.sin(a) * P.slant]; };   // where the light comes from: 0 is the right, 90 the top; shadows fall the other way

  let W = 1, H = 1, objs = [], pieces = [], tR = 20;
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

  // ---------- the plan: one solid per piece of the type ----------
  function build() {
    const rand = (() => { let a = (stage.seed ^ (seedBump * 0x9e3779b1)) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const poses = layout();
    tR = radiusFor(poses[0].ch, poses[0].w, poses[0].h) * 0.8;
    pieces = draft(poses, tR * 2 * P.weight).slice(0, 50);                   // never more than 50
    objs = pieces.map((pc) => {
      const poly = pc.poly, n = poly.length, c = [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
      const z0 = H * P.depth * (0.35 + 0.65 * rand()), dz = H * P.length * (0.55 + 0.9 * rand());      // its own height, and its own length along the light
      const ang = () => rand() * Math.PI * 2, mag = () => (0.3 + 0.7 * rand()) * P.lean;
      const ab = ang(), mb = mag(), at = ang(), mt = mag();                   // how each end leans (px of height per px across)
      const zb = poly.map((p) => Math.max(H * 0.012, z0 + mb * (Math.cos(ab) * (p[0] - c[0]) + Math.sin(ab) * (p[1] - c[1]))));
      const zt = poly.map((p, i) => zb[i] + Math.max(H * 0.03, dz + mt * (Math.cos(at) * (p[0] - c[0]) + Math.sin(at) * (p[1] - c[1]))));
      return { ch: pc.ch, poly, c, zb, zt, sgn: Math.sign(area(poly)) || 1, slide: null, faces: [], zmid: zb.reduce((s, v, i) => s + v + zt[i], 0) / (2 * n) };
    }).sort((a, b) => a.zmid - b.zmid);
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
      let s = 0;
      if (o.slide) { const u = (t - o.slide.t0) / o.slide.dur; if (u >= 1) o.slide = null; else if (u > 0) s = Math.sin(Math.PI * smooth(u)) * o.slide.amp * H; }
      const n = o.poly.length;
      // the solid's corners: the piece, lifted to heights zb (bottom) and zt (top), each corner sitting at p + z * l(home)
      const B = [], Tp = [];
      for (let i = 0; i < n; i++) {
        const zb = o.zb[i] + s, zt = o.zt[i] + s;
        B.push([o.poly[i][0] + zb * hx, o.poly[i][1] + zb * hy, zb]); Tp.push([o.poly[i][0] + zt * hx, o.poly[i][1] + zt * hy, zt]);
      }
      const faces = [];
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push({ v: [B[i], B[j], Tp[j], Tp[i]], kind: 'side', i }); }
      faces.push({ v: B, kind: 'bottom' }); faces.push({ v: Tp, kind: 'top' });
      for (const f of faces) {
        // its shadow on the wall for the light now (the corners thrown along it)
        const sp = f.v.map((p) => [p[0] - Math.max(0, p[2]) * lx, p[1] - Math.max(0, p[2]) * ly]);
        if (area(sp) < 0) sp.reverse();
        if (f.kind === 'top') o.sc = [sp.reduce((a, p) => a + p[0], 0) / sp.length, sp.reduce((a, p) => a + p[1], 0) / sp.length];   // where the middle of this solid's shadow falls
        shadow.push(sp.map((p) => pr(p[0], p[1], 0)));
        // its normal, outward (in the world), and whether the camera sees it
        let nx, ny, nz;
        if (f.kind === 'side') {
          const i = f.i, j = (i + 1) % n, ex = o.poly[j][0] - o.poly[i][0], ey = o.poly[j][1] - o.poly[i][1], el = Math.hypot(ex, ey) || 1;
          const ox = o.sgn * ey / el, oy = -o.sgn * ex / el;                  // outward in the plane
          const cx = ey, cy = -ex, cz = ex * hy - ey * hx;                    // edge x beam axis (hx, hy, 1)
          const sg = cx * ox + cy * oy < 0 ? -1 : 1, l = Math.hypot(cx, cy, cz) || 1; nx = sg * cx / l; ny = sg * cy / l; nz = sg * cz / l;
        } else {
          let sx = 0, sy = 0, sz = 0; const r = f.v;
          for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; sx += (a[1] - b[1]) * (a[2] + b[2]); sy += (a[2] - b[2]) * (a[0] + b[0]); sz += (a[0] - b[0]) * (a[1] + b[1]); }
          const l = Math.hypot(sx, sy, sz) || 1; nx = sx / l; ny = sy / l; nz = sz / l;
          const along = nx * hx + ny * hy + nz;                                // along the beam toward the lamp: that is the top face's outside
          if ((f.kind === 'top') !== (along > 0)) { nx = -nx; ny = -ny; nz = -nz; }
        }
        f.n = [nx, ny, nz];
        f.s = f.v.map((p) => pr(p[0], p[1], p[2]));                            // on the screen: x, y, depth
        f.d = f.s.reduce((a, p) => a + p[2], 0) / f.s.length;
        f.cz = R[6] * nx + R[7] * ny + R[8] * nz;                              // its normal's depth: it faces the camera when positive
      }
      o.faces = faces.filter((f) => f.cz > 0.005).sort((a, b) => a.d - b.d);
      o.depth = o.faces.length ? o.faces.reduce((a, f) => a + f.d, 0) / o.faces.length : -1e9;
    }
    c2.beginPath();
    for (const sp of shadow) { c2.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) c2.lineTo(sp[i][0], sp[i][1]); c2.closePath(); }
    c2.fillStyle = fg; c2.fill();                                             // the shadows: solid ink on the wall
    c2.lineJoin = 'round'; c2.lineWidth = 1; c2.strokeStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
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
    c.strokeStyle = col(0.9 * k); c.lineWidth = 1.1; c.setLineDash([5, 4]);                            // the type as drafted
    for (const o of objs) { c.beginPath(); o.poly.forEach((p, i) => { const q = pr(p[0], p[1], 0); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.stroke(); }
    c.setLineDash([3, 3]); c.lineWidth = 0.8; c.strokeStyle = col(0.55 * k);
    for (const o of objs) {                                                                              // a ray from the middle of the solid's top face to the middle of its piece
      const f = o.faces.find((q) => q.kind === 'top'), t = f ? f.s : null; if (!t) continue;
      const m = [t.reduce((a, p) => a + p[0], 0) / t.length, t.reduce((a, p) => a + p[1], 0) / t.length], w = pr(o.c[0], o.c[1], 0);
      c.beginPath(); c.moveTo(m[0], m[1]); c.lineTo(w[0], w[1]); c.stroke();
      c.fillStyle = col(0.9 * k); c.beginPath(); c.arc(m[0], m[1], 2.4, 0, 7); c.fill();
    }
    c.setLineDash([]);
    const cx = W_ - 70, cy = 120, len = Math.hypot(lx, ly) || 1;               // the light: a sun in the corner it comes from, with the way its shadows fall
    c.strokeStyle = col(k); c.lineWidth = 1.4; c.beginPath(); c.arc(cx, cy, 14, 0, 7); c.stroke();
    for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(an) * 19, cy + Math.sin(an) * 19); c.lineTo(cx + Math.cos(an) * 26, cy + Math.sin(an) * 26); c.stroke(); }
    c.setLineDash([4, 3]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - lx / len * 70, cy - ly / len * 70); c.stroke(); c.setLineDash([]);
    const zs = objs.flatMap((o) => [...o.zb, ...o.zt]), z0 = zs.length ? Math.round(Math.min(...zs) / H * 100) : 0, z1 = zs.length ? Math.round(Math.max(...zs) / H * 100) : 0;
    titleBlock(c, W_, H_, ['SHADOW · PLAN', '● solid  ┄ ray  ┈ the type as drafted', `${objs.length} solids · height ${z0}–${z1}% of the wall`, `light ${Math.round(Math.atan(len) * 57.3)}° from the wall`], col, k);
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
    if (o) { o.slide = { t0: now, dur: 1.7, amp: 0.1 * (Math.random() < 0.5 ? 1 : -1) }; }              // a tap: the solid slides along the light and back; at home its shadow does not move
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
        { name: 'Light', items: [Ctl('angle', 'Where the light comes from (0 right, 90 top, 180 left)', -90, 270, 1), Ctl('slant', 'How low the light sits', 0.4, 3.5, 0.05), Ctl('range', 'How far the light swings', 0.1, 1.2, 0.01), Ctl('snap', 'Snap-to-home plateau', 0, 0.2, 0.005), Ctl('rest', 'Light returns home after (s, 0 = never)', 0, 20, 0.5)] },
        { name: 'View', items: [Ctl('showLight', 'Show the light (L)', 0, 1, 1)] },
        { name: 'Type and solids', items: [Ctl('span', 'How much of the page the type spans (re-forms)', 0.4, 1, 0.01), Ctl('weight', 'Letter weight (re-forms)', 0.6, 2, 0.05), Ctl('depth', 'Height of the lowest ends (re-forms)', 0.03, 0.4, 0.005), Ctl('length', 'How long each solid is along the light (re-forms)', 0.03, 0.4, 0.005), Ctl('lean', 'How much the ends lean (re-forms)', 0, 1, 0.01), Ctl('glass', 'How solid the faces are', 0.1, 1, 0.01)] },
      ],
      actions: { 'New plan': reform, 'L  Show or hide the light': () => { P.showLight = P.showLight ? 0 : 1; dirty = true; }, '1  Front': () => view('front'), '2  Side (how far each solid stands out)': () => view('side'), '3  Top': () => view('top'), '4  From the light (the solids line up as the type)': () => view('light') },
      set(key, value) { P[key] = value; if (['weight', 'depth', 'length', 'lean', 'angle', 'slant', 'span'].includes(key)) reform(); dirty = true; },
      reset() { Object.assign(P, DEFAULTS); reform(); },
    },
    debug: { cam, view, pr, R: () => R, home, objs: () => objs, lamp: () => lampPos, frame: () => frame(now), count: () => objs.length },
    destroy() { removeEventListener('keydown', onKey); clearTimeout(reformT); rv.destroy(); offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
