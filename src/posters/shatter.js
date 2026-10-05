// Shatter: break a box into irregular convex pieces, the way glass or stone breaks.
//
// Seeds are scattered through the box on a jittered grid, and every seed owns the part of the box that is closer to
// it than to any other seed (its Voronoi cell). Each cell is built by starting with the box and cutting it with the
// bisecting plane between this seed and each neighbour. Everything is convex, so the pieces can be used directly as
// rigid bodies. Pure geometry, no dependencies.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// a box as six counter-clockwise (seen from outside) polygons
function boxFaces(hx, hy, hz) {
  return [
    [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]],
    [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]],
    [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]],
    [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]],
    [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]],
    [[-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz]],
  ];
}

// keep the part of a convex polyhedron where dot(n, p) <= d, closing the cut with a new face
function clip(faces, n, d) {
  const out = [], cut = [];
  for (const poly of faces) {
    const keep = [], m = poly.length;
    for (let i = 0; i < m; i++) {
      const a = poly[i], b = poly[(i + 1) % m], da = dot(n, a) - d, db = dot(n, b) - d;
      if (da <= 0) keep.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        keep.push(p); cut.push(p);
      }
    }
    if (keep.length >= 3) out.push(keep);
  }
  if (cut.length >= 3) {
    const pts = [];
    for (const p of cut) if (!pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-6)) pts.push(p);
    if (pts.length >= 3) {
      const c = [0, 0, 0]; for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; }
      const t = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = norm(cross(n, t)), v = cross(n, u);
      pts.sort((p, q) => Math.atan2(dot(sub(p, c), v), dot(sub(p, c), u)) - Math.atan2(dot(sub(q, c), v), dot(sub(q, c), u)));
      out.push(pts);
    }
  }
  return out.length >= 4 ? out : null;
}

// One convex piece, ready for physics and drawing, centred on its own centroid.
function piece(faces, shrink) {
  const key = (p) => Math.round(p[0] * 1e4) + ',' + Math.round(p[1] * 1e4) + ',' + Math.round(p[2] * 1e4);
  const idx = new Map(), verts = [];
  for (const f of faces) for (const p of f) if (!idx.has(key(p))) { idx.set(key(p), verts.length); verts.push(p); }
  const c = [0, 0, 0]; for (const p of verts) { c[0] += p[0] / verts.length; c[1] += p[1] / verts.length; c[2] += p[2] / verts.length; }
  const rel = verts.map((p) => [(p[0] - c[0]) * shrink, (p[1] - c[1]) * shrink, (p[2] - c[2]) * shrink]);
  const idxFaces = faces.map((f) => f.map((p) => idx.get(key(p))));
  let vol = 0; const tris = [];
  for (const f of idxFaces) {
    const a = rel[f[0]];
    const nrm = norm(cross(sub(rel[f[1]], a), sub(rel[f[2]], a)));
    for (let i = 1; i < f.length - 1; i++) {
      const b = rel[f[i]], d = rel[f[i + 1]];
      vol += dot(a, cross(b, d)) / 6;
      tris.push(a[0], a[1], a[2], nrm[0], nrm[1], nrm[2], b[0], b[1], b[2], nrm[0], nrm[1], nrm[2], d[0], d[1], d[2], nrm[0], nrm[1], nrm[2]);
    }
  }
  if (!(vol > 1e-5)) return null;
  return { c, verts: rel, faces: idxFaces, tris: new Float32Array(tris), vol };
}

/** Break a box of half extents (hx, hy, hz) into pieces of about `size`. jitter 0..1 is how irregular the cuts are. */
export function shatterBox(hx, hy, hz, size, jitter = 0.8, shrink = 0.97, cap = 36, rand = Math.random) {
  let nx, ny, nz, s = size;
  do {                                                                // never more than `cap` pieces from one box
    nx = Math.max(1, Math.round(2 * hx / s)); ny = Math.max(1, Math.round(2 * hy / s)); nz = Math.max(1, Math.round(2 * hz / s)); s *= 1.12;
  } while (nx * ny * nz > cap);
  const seeds = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const cl = (v, h) => Math.max(-h * 0.98, Math.min(h * 0.98, v));   // jitter past 1 lets a seed wander into the next cell, so pieces differ a lot in size
    seeds.push([cl(-hx + (i + 0.5 + (rand() - 0.5) * jitter) * 2 * hx / nx, hx), cl(-hy + (j + 0.5 + (rand() - 0.5) * jitter) * 2 * hy / ny, hy), cl(-hz + (k + 0.5 + (rand() - 0.5) * jitter) * 2 * hz / nz, hz)]);
  }
  const reach = 2.4 * Math.max(2 * hx / nx, 2 * hy / ny, 2 * hz / nz), out = [];
  for (let i = 0; i < seeds.length; i++) {
    let faces = boxFaces(hx, hy, hz);
    for (let j = 0; j < seeds.length && faces; j++) {
      if (j === i) continue;
      const dv = sub(seeds[j], seeds[i]), dist = Math.hypot(dv[0], dv[1], dv[2]);
      if (dist > reach) continue;
      const n = [dv[0] / dist, dv[1] / dist, dv[2] / dist], mid = [(seeds[i][0] + seeds[j][0]) / 2, (seeds[i][1] + seeds[j][1]) / 2, (seeds[i][2] + seeds[j][2]) / 2];
      faces = clip(faces, n, dot(n, mid));
    }
    if (!faces) continue;
    const p = piece(faces, shrink);
    if (p) out.push(p);
  }
  return out;
}
