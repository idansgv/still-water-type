// Soft type: every letter is a few skeleton strokes, sampled into round particles that behave like one
// elastic material. The thick, bubbly look is just a round-capped stroke along the particle path.
//
// Study: colederochie.com (hand-written Canvas 2D; position-based dynamics on stroke particles, with a
// spatial hash for contacts and a weak pull back to each letter's own rest shape). This is our own
// implementation of that idea, written from how it behaves; no code was copied, and the skeletons are our own.
//
// Drag a letter: it bends, squashes against its neighbours and keeps where you left it.
// Hold a letter without moving: it inflates like a balloon. Drag to aim, let go: it rockets off, spins as the air
// runs out, drops, and finds its way home.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

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

class Glyph {
  constructor(ch, pose) {
    this.ch = ch; this.w = pose.w; this.h = pose.h; this.scale = 1;
    this.r0 = radiusFor(ch, this.w, this.h); this.r = this.r0;
    this.nodes = []; this.paths = []; this.links = []; this.puff = null;
    this.state = 'home'; this.air = 0; this.aim = -Math.PI / 2; this.t = 0; this.ret = 0; this.ph = Math.random() * 6.28;
    const r = this.r0;
    for (const st of SKELETON[ch].s()) {
      const pts = st.pts.map((p) => ({ x: p.x * this.w, y: p.y * this.h }));
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
        if (!node) { node = { g: this, ox: s.x, oy: s.y, x: pose.x + s.x, y: pose.y + s.y, vx: 0, vy: 0 }; this.nodes.push(node); }
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
  }
  link(a, b) { this.links.push({ a, b, len: Math.hypot(a.ox - b.ox, a.oy - b.oy) }); }
  center() {
    let x = 0, y = 0; for (const n of this.nodes) { x += n.x; y += n.y; }
    this.cx = x / this.nodes.length; this.cy = y / this.nodes.length;
  }
  hit(p) { const rr = this.r * 1.1; return this.nodes.some((n) => (p.x - n.x) ** 2 + (p.y - n.y) ** 2 <= rr * rr); }
  // Scale the letter about its centre: rest shape, stroke width and current pose together.
  rescale(k) {
    this.center(); this.scale *= k; this.r *= k;
    for (const n of this.nodes) { n.ox *= k; n.oy *= k; n.x = this.cx + (n.x - this.cx) * k; n.y = this.cy + (n.y - this.cy) * k; }
    for (const l of this.links) l.len *= k;
  }
}

export function mount(stage) {
  const ctx = stage.canvas.getContext('2d');
  const dark = stage.theme.name === 'dark';
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  stage.setBackdrop(dark ? 0 : 1);

  let W = 1, H = 1, glyphs = [], nodes = [], neighbors = new Set();
  let drag = null, press = null, quiet = 0, acc = 0;
  const HOLD_DELAY = 0.22, HOLD_SIZE = 1.55;

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
        out.push({ ch: c, x: x + a / 2, y, w: SKELETON[c].wf * h, h });
        x += a;
      }
      y += h * (1.02 + rowGap);
    }
    return out;
  }

  function build() {
    glyphs = layout().map((p) => new Glyph(p.ch, p));
    nodes = glyphs.flatMap((g) => g.nodes);
    nodes.forEach((n, i) => { n.id = i; });
    neighbors = new Set();
    for (const g of glyphs) {
      for (const a of g.nodes) for (const b of g.nodes) if (a.id < b.id && Math.hypot(a.ox - b.ox, a.oy - b.oy) < g.r * 2.1) neighbors.add(a.id + ':' + b.id);
      for (const l of g.links) neighbors.add(Math.min(l.a.id, l.b.id) + ':' + Math.max(l.a.id, l.b.id));
    }
    drag = null; press = null;
    for (let i = 0; i < 25; i++) solve();
    for (const n of nodes) { n.vx = n.vy = 0; }
    nodes.forEach((n) => { n.hx = n.x; n.hy = n.y; });
    quiet = 0;
  }

  function confine(n) {
    const r = n.g.r, floor = H - (W < 720 ? 78 : 70);
    n.x = clamp(n.x, r + 3, W - r - 3); n.y = clamp(n.y, r + 3, Math.max(r + 4, floor - r));
  }

  function solve() {
    for (const g of glyphs) {
      for (const l of g.links) {
        const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, d = Math.hypot(dx, dy) || 1, k = (d - l.len) / d * 0.24;
        l.a.x += dx * k; l.a.y += dy * k; l.b.x -= dx * k; l.b.y -= dy * k;
      }
      for (const path of g.paths) {                         // bending stiffness: a stroke bows, then springs straight
        const ns = path.nodes, c = ns.length, s = path.closed ? 0 : 1, e = path.closed ? c : c - 1;
        for (let i = s; i < e; i++) {
          const n = ns[i], a = ns[(i - 1 + c) % c], b = ns[(i + 1) % c];
          const dx = ((a.x + b.x) / 2 - n.x + (n.ox - (a.ox + b.ox) / 2)) * 0.18;
          const dy = ((a.y + b.y) / 2 - n.y + (n.oy - (a.oy + b.oy) / 2)) * 0.18;
          n.x += dx; n.y += dy; a.x -= dx / 2; a.y -= dy / 2; b.x -= dx / 2; b.y -= dy / 2;
        }
      }
    }
    // contacts through a spatial hash: strokes squash against each other and never interlock
    let rmax = 8; for (const g of glyphs) rmax = Math.max(rmax, g.r);
    const cell = rmax * 2 + 3, grid = new Map();
    for (const a of nodes) {
      const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let x = gx - 1; x <= gx + 1; x++) for (let y = gy - 1; y <= gy + 1; y++) {
        const bucket = grid.get(x * 4099 + y); if (!bucket) continue;
        for (const b of bucket) {
          if (a.g === b.g && neighbors.has(b.id + ':' + a.id)) continue;
          const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 0.001, over = a.g.r + b.g.r + 1.8 - d;
          if (over > 0) { const k = over * 0.5 / d; a.x += dx * k; a.y += dy * k; b.x -= dx * k; b.y -= dy * k; }
        }
      }
      const key = gx * 4099 + gy; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(a);
    }
    for (const n of nodes) confine(n);
  }

  function followPuffs() {
    for (const g of glyphs) {
      const p = g.puff; if (!p) continue;
      const k = p.elastic ? 220 : 260, c = p.elastic ? 7 : 32;
      p.v += ((p.target - p.size) * k - p.v * c) / 60;
      const next = Math.max(0.6, p.size + p.v / 60);
      g.rescale(next / p.size); p.size = next;
      if (p.target === 1 && Math.abs(p.size - 1) < 0.001 && Math.abs(p.v) < 0.01) { g.rescale(1 / p.size); g.puff = null; }
    }
  }
  const setPuff = (g, target, elastic = false) => { g.puff ??= { size: 1, v: 0 }; g.puff.target = target; g.puff.elastic = elastic; quiet = 0; };

  // The balloon life cycle: home -> inflating (held still) -> flying (air runs out) -> free (lands) -> returning -> home.
  function lifecycle(dt) {
    if (press && press.live) {
      press.t += dt;
      if (press.t > HOLD_DELAY && press.g.state === 'home') {
        const g = press.g; drag = null;
        g.state = 'inflating'; g.air = 0.12; g.t = 0;
        g.aim = Math.atan2(press.y - g.cy, press.x - g.cx);
        if (Math.hypot(press.x - g.cx, press.y - g.cy) < 16) g.aim = -Math.PI / 2;
      }
    }
    for (const g of glyphs) {
      g.t += dt;
      if (g.state === 'inflating') { g.air = Math.min(1, g.air + dt * 0.75); setPuff(g, 1 + (HOLD_SIZE - 1) * smooth(g.air)); }
      else if (g.state === 'flying') {
        g.air -= dt * (0.55 + 0.4 * g.air);
        if (g.air <= 0) { g.air = 0; g.state = 'free'; g.t = 0; setPuff(g, 1, true); }
        else setPuff(g, 1 + (HOLD_SIZE - 1) * smooth(g.air));
      } else if (g.state === 'free') { if (g.t > 2.4) { g.state = 'returning'; g.ret = 180; } }
      else if (g.state === 'returning') { if (--g.ret <= 0) g.state = 'home'; }
    }
  }
  function forces() {
    for (const g of glyphs) {
      if (g.state === 'returning') {
        const pull = 0.05 * Math.min(1, g.ret / 60);
        for (const n of g.nodes) { n.vx += (n.hx - n.x) * pull; n.vy += (n.hy - n.y) * pull; }
      }
      if (g.state === 'flying' || g.state === 'free') for (const n of g.nodes) n.vy += g.h * 0.0016;
      if (g.state === 'flying') {                           // thrust leaves through the knot, opposite the aim; it whips the letter around
        const jit = Math.sin(g.t * 26 + g.ph) * 0.28 * (0.4 + g.air) + Math.sin(g.t * 13 + g.ph * 2) * 0.18;
        const dir = g.aim + jit, T = (0.25 + 0.75 * g.air) * g.h * 0.011, ext = g.h * 0.5 * g.scale;
        const kx = g.cx - Math.cos(dir) * ext, ky = g.cy - Math.sin(dir) * ext;
        for (const n of g.nodes) {
          const d = Math.hypot(n.x - kx, n.y - ky), w = 0.3 + 0.7 * Math.exp(-((d / ext) ** 2));
          n.vx += Math.cos(dir) * T * w; n.vy += Math.sin(dir) * T * w;
        }
      }
    }
  }

  function step() {
    followPuffs();
    forces();
    const old = nodes.map((n) => [n.x, n.y]);
    for (const g of glyphs) {                                // shape memory: pulled toward its own rest shape, free to rotate
      g.center();
      let mx = 0, my = 0; for (const n of g.nodes) { mx += n.ox; my += n.oy; } mx /= g.nodes.length; my /= g.nodes.length;
      let sa = 0, sb = 0;
      for (const n of g.nodes) { const ox = n.ox - mx, oy = n.oy - my, dx = n.x - g.cx, dy = n.y - g.cy; sa += ox * dy - oy * dx; sb += ox * dx + oy * dy; }
      const th = Math.atan2(sa, sb) * (g.state === 'flying' || g.state === 'inflating' ? 1 : 0.85), c = Math.cos(th), sn = Math.sin(th);
      for (const n of g.nodes) {
        const ox = n.ox - mx, oy = n.oy - my;
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
    for (const g of glyphs) thin = Math.min(thin, g.r);
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
      n.vx = clamp((n.x - old[i][0]) * 0.94, -30, 30); n.vy = clamp((n.y - old[i][1]) * 0.94, -30, 30);
      e += n.vx * n.vx + n.vy * n.vy;
    });
    return Math.sqrt(e / nodes.length);
  }

  function pathTo(p) {
    const ns = p.nodes, c = ns.length;
    if (c < 2) return;
    const mid = (a, b) => [(a.x + b.x) / 2, (a.y + b.y) / 2];
    if (p.closed) {
      const m0 = mid(ns[c - 1], ns[0]); ctx.moveTo(m0[0], m0[1]);
      for (let i = 0; i < c; i++) { const m = mid(ns[i], ns[(i + 1) % c]); ctx.quadraticCurveTo(ns[i].x, ns[i].y, m[0], m[1]); }
      ctx.closePath();
    } else {
      ctx.moveTo(ns[0].x, ns[0].y);
      for (let i = 1; i < c - 1; i++) { const m = mid(ns[i], ns[i + 1]); ctx.quadraticCurveTo(ns[i].x, ns[i].y, m[0], m[1]); }
      ctx.lineTo(ns[c - 1].x, ns[c - 1].y);
    }
  }
  function draw() {
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const g of glyphs) {
      ctx.lineWidth = g.r * 2;
      ctx.beginPath(); for (const p of g.paths) pathTo(p); ctx.stroke();
    }
    ctx.fillStyle = ink;
    for (const g of glyphs) {
      if (g.state !== 'inflating') continue;
      const base = g.h * 0.5 * g.scale + g.r;
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath(); ctx.arc(g.cx + Math.cos(g.aim) * (base + 26 * k), g.cy + Math.sin(g.aim) * (base + 26 * k), 5 - k * 0.8, 0, Math.PI * 2); ctx.fill();
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
    if (g.state !== 'home') { g.state = 'home'; g.air = 0; setPuff(g, 1); }
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
    if (g && g.state === 'inflating') { if (Math.hypot(q.x - g.cx, q.y - g.cy) > 16) g.aim = Math.atan2(q.y - g.cy, q.x - g.cx); quiet = 0; }
    else if (drag) { drag.x = clamp(q.x, 5, W - 5); drag.y = clamp(q.y, 5, H - 5); quiet = 0; }
    else if (q.type === 'mouse') stage.root.style.cursor = hit(q) ? 'grab' : '';
  }));
  const release = (q, e) => {
    if (e.pointerId !== pid) return;
    const g = press && press.g;
    if (g && g.state === 'inflating') {
      if (g.air > 0.15) { g.state = 'flying'; g.t = 0; } else { g.state = 'home'; g.air = 0; setPuff(g, 1); }
    }
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
    const busy = drag || glyphs.some((g) => g.puff || g.state !== 'home');
    quiet = !busy && e < 0.08 ? quiet + 1 : 0;
    if (quiet < 40) draw();
    else if (quiet === 40) { for (const n of nodes) n.vx = n.vy = 0; draw(); }
  }));

  const reform = () => { for (const g of glyphs) { g.state = 'returning'; g.ret = 180; g.air = 0; setPuff(g, 1); } quiet = 0; };
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
