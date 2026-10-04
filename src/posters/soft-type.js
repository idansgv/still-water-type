// Soft type: every letter is a few skeleton strokes, sampled into round particles that behave like one
// elastic material. The thick, bubbly look is a round-capped stroke along the particle path.
//
// Study: colederochie.com (hand-written Canvas 2D; position-based dynamics on stroke particles, with a
// spatial hash for contacts and a weak pull back to each letter's own rest shape). This is our own
// implementation of that idea, written from how it behaves; no code was copied, and the skeletons are our own.
//
// Drag a letter: it bends, squashes against its neighbours and keeps where you left it.
// Hold a letter without moving: air flows in through a point on the letter (its mouth). The tube swells, starting at
// the mouth and spreading along the stroke; the letter itself only grows a little, it is the stroke that fattens.
// Let go: the air rushes out of the mouth and the letter rockets the other way. There is no steering and no gravity.
// As the air runs out the tube goes limp and thin, the thrust dies and the letter stops. Then air creeps back in
// through the mouth and it re-inflates where it is. Every visit starts with slightly uneven letters.
//
// Hold too long and it goes critical: the stroke trembles and distorts, the letter flickers out a few times as a
// warning, and if you are still holding it bursts. The burst throws every other letter across the page and draws
// a few cartoon motion lines. Let go during the warning and it just lets the air out.
//
// Mass follows size: a letter weighs its stroke length times its stroke width, so a swollen letter is heavier.
// Heavy letters shove light ones in contacts and keep their momentum longer. The air is the stored energy.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- skeletons: unit box, x in -.3..+.3, y in -.35..+.35 (y down) ----
const line = (...p) => ({ pts: p.map(([x, y]) => ({ x, y })), sharp: true });
function arc(a0, a1, cx = 0, cy = 0, rx = 0.31, ry = 0.35, closed = false) {
  const n = 28;
  return { closed, pts: Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }; }) };
}
const PI = Math.PI;
const SKELETON = {
  I: { wf: 0.34, s: () => [line([0, -0.35], [0, 0.35])] },
  D: { wf: 0.86, s: () => [line([-0.3, -0.35], [-0.3, 0.35]), arc(-PI / 2, PI / 2, -0.3, 0, 0.6, 0.35)] },
  A: { wf: 0.98, s: () => [line([-0.3, 0.35], [0, -0.35], [0.3, 0.35]), line([-0.19, 0.1], [0.19, 0.1])] },
  N: { wf: 0.9, s: () => [line([-0.3, 0.35], [-0.3, -0.35], [0.3, 0.35], [0.3, -0.35])] },
  S: { wf: 0.78, s: () => {
    const top = arc(-0.15 * PI, -1.5 * PI, 0, -0.175, 0.29, 0.175), bot = arc(-0.5 * PI, 0.85 * PI, 0, 0.175, 0.29, 0.175);
    return [{ pts: top.pts.concat(bot.pts.slice(1)) }];
  } },
  E: { wf: 0.76, s: () => [line([-0.29, -0.35], [-0.29, 0.35]), line([-0.29, -0.35], [0.3, -0.35]), line([-0.29, 0], [0.22, 0]), line([-0.29, 0.35], [0.3, 0.35])] },
  G: { wf: 0.92, s: () => [arc(-0.28 * PI, -2 * PI, 0, 0, 0.31, 0.35), line([0.31, 0.02], [0.04, 0.02])] },
  V: { wf: 0.98, s: () => [line([-0.3, -0.35], [0, 0.35], [0.3, -0.35])] },
};
const ratio = (c, w, h) => (c === 'I' ? h * 0.11 : Math.min(w * 0.25, h * (c === 'E' ? 0.1 : 0.118)));
const radiusFor = (c, w, h) => Math.max(6, ratio(c, w, h));

const AREST = 0.5, rm = (q) => (q <= 0.5 ? 0.3 + 1.4 * q : 1 + 3.2 * (q - 0.5));   // air level -> stroke thickness; the rest level gives exactly the designed stroke

class Glyph {
  constructor(ch, pose) {
    const jf = pose.f || 1, ja = pose.a || 0, jc = Math.cos(ja), js = Math.sin(ja);
    this.ch = ch; this.w = pose.w * jf; this.h = pose.h * jf;
    this.r0 = radiusFor(ch, this.w, this.h);
    this.nodes = []; this.paths = []; this.links = [];
    this.stress = 0; this.m = 1; this.base = 1; this.lk = 1; this.state = 'home'; this.air = AREST; this.air0 = AREST;
    this.mouth = null; this.angle = 0; this.t = 0; this.ret = 0; this.ph = Math.random() * 6.28;
    const r = this.r0;
    for (const st of SKELETON[ch].s()) {
      const pts = st.pts.map((p) => { const x = p.x * this.w, y = p.y * this.h; return { x: x * jc - y * js, y: x * js + y * jc }; });
      const samples = [];
      if (st.sharp) {                                     // straight strokes: keep every corner, space the rest
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(len / (r * 0.6)));
          for (let k = i === 1 ? 0 : 1; k <= n; k++) samples.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
        }
      } else {                                            // curves: even spacing along the length
        const L = [0];
        for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        const total = L[L.length - 1], n = Math.max(3, Math.ceil(total / (r * 0.6)));
        for (let k = 0; k <= n; k++) {
          if (st.closed && k === n) break;
          const d = total * k / n; let j = 1; while (j < L.length - 1 && L[j] < d) j++;
          const t = (d - L[j - 1]) / (L[j] - L[j - 1] || 1);
          samples.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t });
        }
      }
      const path = [];
      samples.forEach((s, i) => {
        const end = !st.closed && (i === 0 || i === samples.length - 1);
        let best = r * (end ? 1.1 : 0.28), node = null;       // stroke ends weld onto whatever they touch
        for (const m of this.nodes) { if (path.includes(m)) continue; const d = Math.hypot(m.ox - s.x, m.oy - s.y); if (d < best) { best = d; node = m; } }
        if (!node) { node = { g: this, ox: s.x, oy: s.y, x: pose.x + s.x, y: pose.y + s.y, vx: 0, vy: 0, q: AREST, rad: this.r0 }; this.nodes.push(node); }
        if (path[path.length - 1] !== node) path.push(node);
      });
      for (let i = 1; i < path.length; i++) this.link(path[i - 1], path[i]);
      if (st.closed) this.link(path[path.length - 1], path[0]);
      this.paths.push({ nodes: path, closed: !!st.closed });
    }
    // brace junctions so they bend instead of hinging
    const owner = new Map(this.nodes.map((n) => [n, new Set()]));
    this.paths.forEach((p, i) => p.nodes.forEach((n) => owner.get(n).add(i)));
    this.nodes.forEach((a, i) => this.nodes.forEach((b, j) => {
      if (i >= j || [...owner.get(a)].some((k) => owner.get(b).has(k))) return;
      if (Math.hypot(a.ox - b.ox, a.oy - b.oy) < r * 2.2) this.link(a, b);
    }));
    this.cx = pose.x; this.cy = pose.y;
    this.mouth = this.nodes[Math.floor(Math.random() * this.nodes.length)];
  }
  link(a, b) { this.links.push({ a, b, len0: Math.hypot(a.ox - b.ox, a.oy - b.oy) }); }
  center() {
    let x = 0, y = 0; for (const n of this.nodes) { x += n.x; y += n.y; }
    this.cx = x / this.nodes.length; this.cy = y / this.nodes.length;
  }
  hit(p) { return this.nodes.some((n) => { const rr = Math.max(n.rad * 1.1, 20); return (p.x - n.x) ** 2 + (p.y - n.y) ** 2 <= rr * rr; }); }
  // Air moves through the tube from the mouth: the mouth follows the glyph's air level, and every other
  // particle follows its neighbours, so a swell or a deflation travels along the stroke.
  flow() {
    const m = this.mouth;
    m.q += (this.air - m.q) * 0.5;
    for (let it = 0; it < 5; it++) for (const l of this.links) { const d = (l.b.q - l.a.q) * 0.3; l.a.q += d; l.b.q -= d; }
    let sum = 0, off = 0;
    const stress = clamp((this.air - 0.72) / 0.28, 0, 1) * (this.state === 'inflating' || this.state === 'critical' ? 1 : 0);
    this.stress = stress;
    for (const n of this.nodes) {
      n.rad = this.r0 * rm(n.q) * (1 + stress * 0.1 * Math.sin(this.t * 38 + n.id * 1.9));   // the skin strains and ripples near its limit
      sum += n.rad; off = Math.max(off, Math.abs(n.q - this.air)); }
    const mean = sum / this.nodes.length / this.r0;
    this.lk = 1 + 0.3 * (mean - 1);                      // the skeleton only stretches a little; the stroke does the swelling
    this.m = this.base * this.lk * mean;
    return off;
  }
}

export function mount(stage) {
  const ctx = stage.canvas.getContext('2d');
  const dark = stage.theme.name === 'dark';
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  stage.setBackdrop(dark ? 0 : 1);

  let W = 1, H = 1, glyphs = [], nodes = [], neighbors = new Set();
  let drag = null, press = null, quiet = 0, acc = 0, settling = false;
  const HOLD_DELAY = 0.22, FLICKER_T = 1.15;
  let bursts = [], shake = 0;
  const blinkOff = (t) => [0.18, 0.44, 0.7].some((b) => t > b && t < b + 0.13);
  const rng = (() => { const r = []; for (let i = 0; i < 12; i++) r.push([stage.rand() - 0.5, stage.rand() - 0.5, stage.rand() - 0.5, stage.rand() - 0.5]); return r; })();

  function layout() {
    const portrait = W / H < 0.85;
    const rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96;
    const availW = W - 2 * padX, availH = H - top - bottom;
    const gap = 0.06;
    const advance = (c, h) => h * (0.6 * SKELETON[c].wf + 2 * ratio(c, SKELETON[c].wf * h, h) / h + gap);
    let h = Infinity;
    for (const row of rows) {
      const unit = [...row].reduce((s, c) => s + advance(c, 1), 0);
      h = Math.min(h, availW / unit);
    }
    const rowGap = 0.02;
    h = Math.min(h, availH / (rows.length * (1.02 + rowGap)));
    const total = rows.length * h * 1.02 + (rows.length - 1) * h * rowGap;
    let y = top + (availH - total) / 2 + h * 0.51;
    const out = [];
    for (const row of rows) {
      const rowW = [...row].reduce((s, c) => s + advance(c, h), 0);
      let x = (W - rowW) / 2;
      for (const c of row) {
        const a = advance(c, h);
        const j = rng[out.length % rng.length];
        out.push({ ch: c, x: x + a / 2 + j[0] * h * 0.07, y: y + j[1] * h * 0.07, a: j[2] * 0.14, f: 1 + j[3] * 0.1, w: SKELETON[c].wf * h, h });
        x += a;
      }
      y += h * (1.02 + rowGap);
    }
    return out;
  }

  function build() {
    glyphs = layout().map((p) => new Glyph(p.ch, p));
    const raw = glyphs.map((g) => g.links.reduce((t, l) => t + l.len0, 0) * g.r0), ref = raw.reduce((a, b) => a + b, 0) / raw.length;
    glyphs.forEach((g, i) => { g.base = Math.pow(raw[i] / ref, 0.6); g.m = g.base; });   // rest mass from ink area, compressed so an I is light but not weightless
    nodes = glyphs.flatMap((g) => g.nodes);
    nodes.forEach((n, i) => { n.id = i; });
    neighbors = new Set();
    for (const g of glyphs) {
      for (const a of g.nodes) for (const b of g.nodes) if (a.id < b.id && Math.hypot(a.ox - b.ox, a.oy - b.oy) < g.r0 * 2.1) neighbors.add(a.id + ':' + b.id);
      for (const l of g.links) neighbors.add(Math.min(l.a.id, l.b.id) + ':' + Math.max(l.a.id, l.b.id));
    }
    drag = null; press = null;
    for (let i = 0; i < 25; i++) solve();
    for (const n of nodes) { n.vx = n.vy = 0; }
    nodes.forEach((n) => { n.hx = n.x; n.hy = n.y; });
    quiet = 0;
  }

  function confine(n) {
    const r = n.rad, floor = H - (W < 720 ? 78 : 70);
    n.x = clamp(n.x, r + 3, W - r - 3); n.y = clamp(n.y, r + 3, Math.max(r + 4, floor - r));
  }

  function solve() {
    for (const g of glyphs) {
      const lk = g.lk;
      for (const l of g.links) {
        const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, d = Math.hypot(dx, dy) || 1, k = (d - l.len0 * lk) / d * 0.24;
        l.a.x += dx * k; l.a.y += dy * k; l.b.x -= dx * k; l.b.y -= dy * k;
      }
      for (const path of g.paths) {                         // bending stiffness: a stroke bows, then springs straight
        const ns = path.nodes, c = ns.length, s = path.closed ? 0 : 1, e = path.closed ? c : c - 1;
        for (let i = s; i < e; i++) {
          const n = ns[i], a = ns[(i - 1 + c) % c], b = ns[(i + 1) % c];
          const dx = ((a.x + b.x) / 2 - n.x + (n.ox - (a.ox + b.ox) / 2) * lk) * 0.18;
          const dy = ((a.y + b.y) / 2 - n.y + (n.oy - (a.oy + b.oy) / 2) * lk) * 0.18;
          n.x += dx; n.y += dy; a.x -= dx / 2; a.y -= dy / 2; b.x -= dx / 2; b.y -= dy / 2;
        }
      }
    }
    // contacts through a spatial hash: strokes squash against each other and never interlock
    let rmax = 8; for (const n of nodes) rmax = Math.max(rmax, n.rad);
    const cell = rmax * 2 + 3, grid = new Map();
    for (const a of nodes) {
      const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let x = gx - 1; x <= gx + 1; x++) for (let y = gy - 1; y <= gy + 1; y++) {
        const bucket = grid.get(x * 4099 + y); if (!bucket) continue;
        for (const b of bucket) {
          if (a.g === b.g && neighbors.has(b.id + ':' + a.id)) continue;
          const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 0.001, over = a.rad + b.rad + 1.8 - d;
          if (over > 0) {                                  // the heavier body gives way less
            const wa = 1 / a.g.m, wb = 1 / b.g.m, ta = wa / (wa + wb) * over / d, tb = wb / (wa + wb) * over / d;
            a.x += dx * ta; a.y += dy * ta; b.x -= dx * tb; b.y -= dy * tb;
          }
        }
      }
      const key = gx * 4099 + gy; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(a);
    }
    for (const n of nodes) confine(n);
  }

  // The balloon life cycle: home -> inflating (held still) -> flying (air runs out) -> spent (limp) -> home (air creeps back).
  // 'returning' is only used by Re-form.
  function lifecycle(dt) {
    if (press && press.live) {
      press.t += dt;
      if (press.t > HOLD_DELAY && press.g.state === 'home') {
        const g = press.g; drag = null;
        g.state = 'inflating'; g.air0 = g.air; g.t = 0;
        g.mouth = g.nodes[Math.floor(Math.random() * g.nodes.length)];   // a new mouth each time
      }
    }
    for (const g of glyphs) {
      g.t += dt;
      if (g.state === 'inflating') { g.air = Math.min(1, g.air + dt * 0.4); if (g.air >= 1) { g.state = 'critical'; g.t = 0; } }
      else if (g.state === 'critical') { if (g.t > FLICKER_T) explode(g); }
      else if (g.state === 'flying') {                      // the fuller the balloon, the longer the burn
        g.air -= dt * (0.55 + 0.4 * g.air) / Math.max(0.6, rm(g.air));
        if (g.air <= 0) { g.air = 0; g.state = 'spent'; g.t = 0; }
      } else if (g.state === 'spent') { if (g.t > 1.3) g.state = 'home'; }
      else if (g.state === 'returning') { g.air = AREST; if (--g.ret <= 0) g.state = 'home'; }
      else if (g.state === 'home') {                        // air creeps in through the mouth, or leaks out of an over-filled letter
        if (g.air < AREST) g.air = Math.min(AREST, g.air + dt * 0.22);
        else if (g.air > AREST) g.air = Math.max(AREST, g.air - dt * 0.9);
      }
    }
  }
  // The burst: the letter empties at once, every other letter is thrown away from it, and cartoon lines fly out.
  function explode(g) {
    g.center();
    const cx = g.cx, cy = g.cy, size = g.h;
    g.air = 0; g.state = 'spent'; g.t = 0; g.stress = 0;
    for (const n of g.nodes) n.q = 0;
    const R = Math.max(W, H) * 0.6;
    for (const o of glyphs) {
      if (o === g) continue;
      const inv = 1 / clamp(o.m, 0.6, 2.5);
      for (const n of o.nodes) {
        const dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy) || 1, f = Math.max(0, 1 - d / R) ** 1.1;
        const v = 34 * f * inv;
        n.vx += dx / d * v; n.vy += dy / d * v;
      }
    }
    const lines = [], N = 16;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2 + (Math.random() - 0.5) * 0.3, long = i % 2 === 0;
      const s0 = size * (0.5 + Math.random() * 0.15), e0 = s0 + size * (long ? 0.7 + Math.random() * 0.6 : 0.28 + Math.random() * 0.2);
      lines.push({ a, s0, e0, bend: (Math.random() - 0.5) * 0.35, w: long ? 7 + Math.random() * 2.5 : 5 });
    }
    bursts.push({ x: cx, y: cy, t: 0, lines });
    shake = 0.4; quiet = 0;
  }
  function forces() {
    for (const g of glyphs) {
      if (g.state === 'returning') {
        const pull = 0.05 * Math.min(1, g.ret / 60);
        for (const n of g.nodes) { n.vx += (n.hx - n.x) * pull; n.vy += (n.hy - n.y) * pull; }
      }
      if (g.stress > 0) {                                   // near the limit the whole letter shudders
        const k = g.stress * (g.state === 'critical' ? 2.4 : 1.0);
        for (const n of g.nodes) { n.vx += (Math.random() - 0.5) * k; n.vy += (Math.random() - 0.5) * k; }
      }
      if (g.state === 'flying') {                           // the jet leaves through the mouth, so as the letter spins the push turns with it
        const m = g.mouth, ext = g.h * 0.5;
        let ax = g.cx - m.x, ay = g.cy - m.y; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
        const jit = Math.sin(g.t * 26 + g.ph) * 0.28 * (0.4 + g.air) + Math.sin(g.t * 13 + g.ph * 2) * 0.18;
        const dir = Math.atan2(ay, ax) + jit, T = g.air * g.h * 0.03;
        for (const n of g.nodes) {
          const d = Math.hypot(n.x - m.x, n.y - m.y), w = 0.3 + 0.7 * Math.exp(-((d / ext) ** 2));
          n.vx += Math.cos(dir) * T * w; n.vy += Math.sin(dir) * T * w;
        }
      }
    }
  }

  function step() {
    forces();
    const old = nodes.map((n) => [n.x, n.y]);
    for (const g of glyphs) {                                // shape memory: pulled toward its own rest shape, free to rotate
      g.center();
      let mx = 0, my = 0; for (const n of g.nodes) { mx += n.ox; my += n.oy; } mx /= g.nodes.length; my /= g.nodes.length;
      let sa = 0, sb = 0;
      for (const n of g.nodes) { const ox = n.ox - mx, oy = n.oy - my, dx = n.x - g.cx, dy = n.y - g.cy; sa += ox * dy - oy * dx; sb += ox * dx + oy * dy; }
      g.angle = Math.atan2(sa, sb);
      const th = g.angle * (g.state === 'flying' || g.state === 'inflating' ? 1 : 0.85), c = Math.cos(th), sn = Math.sin(th), lk = g.lk;
      for (const n of g.nodes) {
        const ox = (n.ox - mx) * lk, oy = (n.oy - my) * lk;
        n.vx += (g.cx + ox * c - oy * sn - n.x) * 0.024; n.vy += (g.cy + ox * sn + oy * c - n.y) * 0.024;
      }
    }
    const move = nodes.map((n) => [n.vx, n.vy]); let held = null;
    if (drag) {                                              // the held point tracks the pointer; the rest is carried partway
      const n = drag.node, mx = clamp(drag.x + drag.dx - n.x, -60, 60), my = clamp(drag.y + drag.dy - n.y, -60, 60);
      for (const m of drag.g.nodes) { move[m.id][0] += mx * 0.2; move[m.id][1] += my * 0.2; }
      held = { n, x0: n.x, y0: n.y, x: n.x + mx, y: n.y + my };
    }
    let far = 0, thin = Infinity;
    for (const n of nodes) thin = Math.min(thin, n.rad);
    for (const [x, y] of move) far = Math.max(far, Math.hypot(x, y));
    if (held) far = Math.max(far, Math.hypot(held.x - held.x0, held.y - held.y0));
    const steps = clamp(Math.ceil(far / (thin * 0.5)), 1, 8), passes = Math.ceil(6 / steps);
    for (let s = 1; s <= steps; s++) {
      nodes.forEach((n, i) => { n.x += move[i][0] / steps; n.y += move[i][1] / steps; });
      for (let i = 0; i < passes; i++) {
        solve();
        if (held) { const t = s / steps; held.n.x = held.x0 + (held.x - held.x0) * t; held.n.y = held.y0 + (held.y - held.y0) * t; confine(held.n); }
      }
    }
    let e = 0;
    nodes.forEach((n, i) => {
      const g = n.g, k = g.state === 'spent' ? 0.8 : g.state === 'flying' ? 1 - 0.06 / clamp(g.m, 0.5, 3) : 0.94;   // heavy letters coast; a spent one has no motion left
      const cap = g.state === 'flying' ? 46 : 36;
      n.vx = clamp((n.x - old[i][0]) * k, -cap, cap); n.vy = clamp((n.y - old[i][1]) * k, -cap, cap);
      e += n.vx * n.vx + n.vy * n.vy;
    });
    let off = 0; for (const g of glyphs) off = Math.max(off, g.flow());
    settling = off > 0.004;
    return Math.sqrt(e / nodes.length);
  }

  // Each stroke is drawn piece by piece so its thickness can change along the tube: a swell travels from the mouth.
  function strokePath(p) {
    const ns = p.nodes, c = ns.length;
    if (c < 2) return;
    const mid = (a, b) => [(a.x + b.x) / 2, (a.y + b.y) / 2];
    for (let i = 0; i < c; i++) {
      const n = ns[i];
      let a, b;
      if (p.closed) { a = mid(ns[(i - 1 + c) % c], n); b = mid(n, ns[(i + 1) % c]); }
      else { a = i === 0 ? [n.x, n.y] : mid(ns[i - 1], n); b = i === c - 1 ? [n.x, n.y] : mid(n, ns[i + 1]); }
      ctx.lineWidth = n.rad * 2;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(n.x, n.y, b[0], b[1]); ctx.stroke();
    }
  }
  function draw() {
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    if (shake > 0) { const a = shake / 0.4 * 9; ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
    ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const g of glyphs) { if (g.state === 'critical' && blinkOff(g.t)) continue; for (const p of g.paths) strokePath(p); }
    for (const b of bursts) {                                // minimal cartoon motion lines: each stroke travels out and thins away
      const ease = (u) => 1 - (1 - clamp(u, 0, 1)) ** 3;
      for (const l of b.lines) {
        const head = l.s0 + (l.e0 - l.s0) * ease(b.t / 0.32), tail = l.s0 + (l.e0 - l.s0) * ease((b.t - 0.1) / 0.42);
        if (tail >= head - 0.5) continue;
        const c = Math.cos(l.a), sn = Math.sin(l.a), mid = (head + tail) / 2, off = l.bend * (head - tail);
        ctx.lineWidth = l.w * (1 - clamp((b.t - 0.3) / 0.4, 0, 0.6));
        ctx.beginPath();
        ctx.moveTo(b.x + c * tail, b.y + sn * tail);
        ctx.quadraticCurveTo(b.x + c * mid - sn * off, b.y + sn * mid + c * off, b.x + c * head, b.y + sn * head);
        ctx.stroke();
      }
    }
  }

  // ---- input ----
  let pid = null;
  const hit = (p) => { for (let i = glyphs.length - 1; i >= 0; i--) if (glyphs[i].hit(p)) return glyphs[i]; return null; };
  const offs = [];
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return;
    const g = hit(q); if (!g) return;
    pid = e.pointerId;
    if (g.state !== 'home') g.state = 'home';                // grabbing a flying or limp letter catches it
    const node = g.nodes.reduce((a, b) => (Math.hypot(a.x - q.x, a.y - q.y) < Math.hypot(b.x - q.x, b.y - q.y) ? a : b));
    drag = { g, node, x: q.x, y: q.y, dx: node.x - q.x, dy: node.y - q.y };
    glyphs.splice(glyphs.indexOf(g), 1); glyphs.push(g);     // newest on top for hit testing
    press = { g, live: true, t: 0, x: q.x, y: q.y };
    quiet = 0;
  }));
  offs.push(stage.on('move', (q, e) => {
    if (pid !== null && e.pointerId !== pid) return;
    if (press && press.live && Math.hypot(q.x - press.x, q.y - press.y) > 8) press.live = false;   // moved: a drag, not a hold
    const g = press && press.g;
    if (g && (g.state === 'inflating' || g.state === 'critical')) quiet = 0;
    else if (drag) { drag.x = clamp(q.x, 5, W - 5); drag.y = clamp(q.y, 5, H - 5); quiet = 0; }
    else if (q.type === 'mouse') stage.root.style.cursor = hit(q) ? 'grab' : '';
  }));
  const release = (q, e) => {
    if (e.pointerId !== pid) return;
    const g = press && press.g;
    if (g && g.state === 'inflating') {
      if (g.air > g.air0 + 0.12) { g.state = 'flying'; g.t = 0; } else g.state = 'home';
    } else if (g && g.state === 'critical') g.state = 'home';   // let go during the warning: it just lets the air out
    press = null; drag = null; pid = null; quiet = 0;
  };
  offs.push(stage.on('up', release));

  function resize() {
    W = stage.W; H = stage.H;
    build();
  }
  offs.push(stage.on('resize', resize));
  resize();
  draw();

  offs.push(stage.frame((dt) => {
    if (stage.reduced && quiet > 2) return;
    acc = Math.min(acc + dt, 0.05);
    let e = 0, ran = false;
    while (acc >= 1 / 60) {
      acc -= 1 / 60; lifecycle(1 / 60); e = step(); ran = true;
    }
    if (!ran) return;
    for (const b of bursts) b.t += 1 / 60;
    bursts = bursts.filter((b) => b.t < 0.8); shake = Math.max(0, shake - 1 / 60);
    const busy = drag || settling || bursts.length || shake || glyphs.some((g) => g.state !== 'home' || g.air !== AREST);
    quiet = !busy && e < 0.08 ? quiet + 1 : 0;
    if (quiet < 40) draw();
    else if (quiet === 40) { for (const n of nodes) n.vx = n.vy = 0; draw(); }
  }));

  const reform = () => { for (const g of glyphs) { g.state = 'returning'; g.ret = 180; g.air = AREST; } quiet = 0; };
  return {
    tune: {
      title: 'Soft type', values: {}, defaults: {}, groups: [],
      actions: { 'Re-form': reform },
      set() {}, reset() { reform(); },
    },
    debug: { glyphs: () => glyphs, step: () => step() },
    destroy() {
      offs.forEach((f) => f());
      stage.root.style.cursor = '';
      stage.setBackdrop(null);
    },
  };
}
