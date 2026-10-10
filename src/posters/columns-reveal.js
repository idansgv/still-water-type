// The reveal drawings for Collapse and Explode (three quick taps; see reveal.js). Both are drafted in the poster's own foreground
// colour; the page inversion turns the sheet into white lines on black (or black on white).
//   Collapse  a plan of the operating forces: every column's boxes as wireframes, its centre of mass, weight into the page,
//             reaction at the floor, the support polygon, the lean (overturning direction) and the speed, and the last knock.
//   Explode   the fracture cells of every letter, the reach of a blast, and the chain between neighbours.
import { ink, grid, corners, arrow, label, titleBlock } from './reveal.js';

const hull = (pts) => {                                    // convex hull (monotone chain), points [x,y]
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};
const EDGES = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

export function blueprint(a) {                              // a: { stage, toPx, letters, S, colH, qrot, qmul, knock }
  const { stage, toPx, qrot, qmul } = a;
  return (c, W, H, k, t) => {
    const col = (x) => ink(stage, x);
    c.fillStyle = col(0.0); grid(c, W, H, Math.max(16, Math.round(a.S * 0.25)), col, k); corners(c, W, H, 16, col, k);
    const letters = a.letters();
    let still = 0, moving = 0;
    for (const b of letters) {
      const floor = [], boxes = [];
      for (let i = 0; i < b.shapes.length; i++) {
        const sh = b.shapes[i], qa = qmul(b.quaternion, b.shapeOrientations[i]), vo = qrot(b.quaternion, b.shapeOffsets[i]);
        const cs = [];
        for (let m = 0; m < 8; m++) {
          const v = qrot(qa, { x: (m & 1 ? 1 : -1) * sh.halfExtents.x, y: (m & 2 ? 1 : -1) * sh.halfExtents.y, z: (m & 4 ? 1 : -1) * sh.halfExtents.z });
          const w = { x: b.position.x + vo.x + v.x, y: b.position.y + vo.y + v.y, z: b.position.z + vo.z + v.z };
          cs.push(w); if (w.z < 0.04) floor.push([w.x, w.y]);
        }
        boxes.push(cs);
      }
      // wireframe of every box the physics uses
      c.strokeStyle = col(0.55 * k); c.lineWidth = 0.75; c.beginPath();
      for (const cs of boxes) { const p = cs.map((w) => toPx(w.x, w.y, w.z)); for (const [i, j] of EDGES) { c.moveTo(p[i][0], p[i][1]); c.lineTo(p[j][0], p[j][1]); } }
      c.stroke();
      // support polygon: where the column touches the floor
      const hp = hull(floor);
      const [cx, cy] = toPx(b.position.x, b.position.y, b.position.z);
      if (hp.length >= 3) {
        c.beginPath(); hp.forEach(([x, y], i) => { const [px, py] = toPx(x, y, 0); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath();
        c.fillStyle = col(0.09 * k); c.fill(); c.setLineDash([5, 4]); c.strokeStyle = col(0.9 * k); c.lineWidth = 1; c.stroke(); c.setLineDash([]);
      }
      // centre of mass: a quartered circle; weight goes into the page (circle with a cross); reaction comes out of it (circle with a dot)
      const up = qrot(b.quaternion, { x: 0, y: 0, z: 1 });
      const lean = Math.acos(Math.max(-1, Math.min(1, up.z))), sp = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z);
      const r = Math.max(5, a.S * 0.12);
      c.strokeStyle = col(k); c.lineWidth = 1.25; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.moveTo(cx - r * 0.7, cy - r * 0.7); c.lineTo(cx + r * 0.7, cy + r * 0.7); c.moveTo(cx + r * 0.7, cy - r * 0.7); c.lineTo(cx - r * 0.7, cy + r * 0.7); c.stroke();
      if (hp.length) {                                       // reaction dots at the support polygon's corners
        c.fillStyle = col(0.9 * k); for (const [x, y] of hp) { const [px, py] = toPx(x, y, 0); c.beginPath(); c.arc(px, py, 1.8, 0, 7); c.fill(); }
      }
      // lean: the horizontal part of the column's own axis, drawn from the centre of mass
      if (lean > 0.03) { const L = Math.min(1, Math.sin(lean)) * a.S * 1.2, d = Math.hypot(up.x, up.y) || 1; c.strokeStyle = col(k); c.lineWidth = 1.5; arrow(c, cx, cy, cx + up.x / d * L, cy - up.y / d * L, 8); label(c, Math.round(lean * 57.3) + '°', cx + up.x / d * (L + 8), cy - up.y / d * (L + 8) + 3, col, k); }
      // velocity
      if (sp > 0.15) { c.setLineDash([2, 3]); c.strokeStyle = col(0.9 * k); c.lineWidth = 1; arrow(c, cx, cy, cx + b.velocity.x * a.S * 0.35, cy - b.velocity.y * a.S * 0.35, 6); c.setLineDash([]); moving++; } else still++;
      label(c, b.ch, cx - r - 6, cy - r - 6, col, k, 'right', 11);
    }
    // the last knock: a point and the push it gave
    const kn = a.knock();
    if (kn && t - kn.t < 4) { const f = k * (1 - (t - kn.t) / 4), [x, y] = toPx(kn.x, kn.y, kn.z), L = a.S * 0.9; c.strokeStyle = col(f); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 7, 0, 7); c.stroke(); arrow(c, x, y, x + kn.dx * L, y - kn.dy * L, 8); label(c, 'J', x + 10, y - 10, col, f); }
    titleBlock(c, W, H, ['COLLAPSE · PLAN', '⊗ weight  ◎ reaction', '→ lean  ┄ speed  J impulse', `${still} at rest · ${moving} moving`], col, k);
  };
}

export function fractureMap(a) {                            // a: { stage, toPx, letters, P, S, colH, UNIT_H }
  const { stage, toPx } = a;
  return (c, W, H, k, t) => {
    const col = (x) => ink(stage, x), P = a.P;
    grid(c, W, H, Math.max(16, Math.round(a.S * 0.25)), col, k); corners(c, W, H, 16, col, k);
    const letters = a.letters(), z = a.colH;
    let cells = 0, gone = 0;
    for (const b of letters) {
      if (!b.cells) continue;
      let sx = 0, sy = 0;
      for (const cell of b.cells) {
        const cs = Math.cos(cell.a), sn = Math.sin(cell.a), pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([ux, uy]) => toPx(b.position.x + cell.x + cs * ux * cell.hx - sn * uy * cell.hy, b.position.y + cell.y + sn * ux * cell.hx + cs * uy * cell.hy, z));
        c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
        cells++; sx += cell.x; sy += cell.y;
        if (!cell.alive) { gone++; c.setLineDash([3, 3]); c.strokeStyle = col(0.45 * k); c.lineWidth = 0.75; c.stroke(); c.setLineDash([]); continue; }
        c.strokeStyle = col(0.8 * k); c.lineWidth = 0.9; c.stroke();
        if (cell.dmg > 0.02) { c.fillStyle = col(Math.min(0.5, cell.dmg * 0.6) * k); c.fill(); }
      }
      const n = b.cells.length || 1, [cx, cy] = toPx(b.position.x + sx / n, b.position.y + sy / n, z);
      b.__c = [cx, cy];
      c.strokeStyle = col(0.3 * k); c.lineWidth = 0.75; c.setLineDash([2, 4]); c.beginPath(); c.arc(cx, cy, P.reach * a.S, 0, 7); c.stroke(); c.setLineDash([]);   // how far the shock cracks things
    }
    // the chain: neighbours a blast can pass to, as arcs between letter centres
    c.strokeStyle = col(0.7 * k); c.lineWidth = 1;
    for (let i = 0; i < letters.length; i++) for (let j = i + 1; j < letters.length; j++) {
      const p = letters[i].__c, q = letters[j].__c; if (!p || !q) continue;
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > P.reach * a.S * 1.15 || d < 1) continue;
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2 - d * 0.16;
      c.setLineDash([6, 4]); c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(mx, my, q[0], q[1]); c.stroke(); c.setLineDash([]);
    }
    titleBlock(c, W, H, ['EXPLODE · FRACTURE', `${cells} cells · ${gone} broken`, `reach ${P.reach} · chain ${P.chain}`], col, k);
  };
}
