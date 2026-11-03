// Drop: the name (or an album title) in thick clear glass, its letters falling onto the floor. A letter that lands hard breaks where it
// touches: the bottom stops, the rest keeps falling into it, so the break climbs the letter. About one in three lands whole. The
// pieces heap up on each other and dissolve where they lie a few seconds later; the title drops again on a loop.
// Port of the test page docs/posters/prototypes/drop.html with Idan's tuning (3 Nov 2026). Idea after mrdoob's Codevember 2026 / 02
// "Shatter" (MIT; ideas only, own code): glass with real thickness, the split keeps the letter's motion, a break threshold, a pile.
//
// Under the picture (three.js 0.160, vendored): Archivo Black traced to contours (glyph-contours.js), triangulated and extruded;
// a break cuts the glyph into Voronoi cells (2D, clipped to the letter, extruded), the break faces in a rougher glass. Physics is our
// own small rigid-body solver: gravity, the outline's points against the floor (restitution, friction), piece on piece (points
// against the other solid's exact outline, a spatial grid), sleep. The floor shows only shadows over the flat page, so there is no
// horizon. On a narrow screen the camera frames one letter's width and the letters come one at a time into the middle.
//
// Gestures (src/gestures.js): tap a whole letter to break it where you tapped; tap a piece to flick it; tapping the background does
// nothing; hold has no action. Double tap on empty space drops the title again now (after the re-form beat). Reveal: every body's
// contact points, which way it is moving, and the letters still whole. The first drop on load is the intro; under reduced motion the
// pile is shown already settled and nothing moves.

import * as THREE from '../vendor/three.module.min.js';
import { getGL } from '../engine.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';
import { glyphContours } from './glyph-contours.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Archivo Black', WEIGHT = 400, NAME = 'IdanSegv';
const FACE = `"${FAMILY}", "Arial Black", sans-serif`;
// Idan's tuning from the test page (3 Nov 2026); the colour fringe (dispersion) is left out: the site is black and white
const DEF = {
  depth: 0.37, rough: 0.04, absorb: 2.7, ior: 1.59, env: 3, exposure: 0.9,
  height: 2.4, toughness: 4.5, survive: 0.3, pieces: 41, cluster: 0.77, spread: 2.2, bounce: 0.67, friction: 0.36, timeScale: 0.27,
  loop: 14.5, life: 5.5, fade: 1.4, seq: 1.6,
};
const CAP = 0.72, G = 9.8, H_STEP = 1 / 240, MAX_BODIES = 900;

// ---------- geometry helpers ----------
const pip = (p, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
const insideGlyph = (p, contours) => { let n = 0; for (const c of contours) if (pip(p, c)) n++; return n % 2 === 1; };
const area2 = (poly) => { let s = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; return s; };
function clipHalf(poly, nx, ny, c) {
  const out = []; const L = poly.length;
  for (let i = 0; i < L; i++) {
    const a = poly[i], b = poly[(i + 1) % L];
    const da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function clipConvex(poly, cell) {
  let out = poly;
  for (let i = 0; i < cell.length && out.length > 2; i++) { const p = cell[i], q = cell[(i + 1) % cell.length]; const nx = q[1] - p[1], ny = -(q[0] - p[0]); out = clipHalf(out, nx, ny, nx * p[0] + ny * p[1]); }
  return out;
}
const boxOf = (poly) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of poly) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; };
const overlap = (A, B) => A[0] <= B[2] && B[0] <= A[2] && A[1] <= B[3] && B[1] <= A[3];
// inside by a small margin: pieces fresh from one break share faces exactly, and that must not count as contact
const inConvex = (p, poly) => { for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[j], b = poly[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; if (((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / L < 0.006) return false; } return true; };

// a letter as contours (even-odd) and triangles, in world units with the baseline on y = 0
function glyph(ch, xc) {
  const g = glyphContours(ch, FACE, WEIGHT, 160, 0.02);
  const loops = g.loops.map((l) => ({ hole: l.hole, pts: l.pts.map(([x, y]) => [x * CAP + xc, y * CAP + CAP / 2]) }));
  const contours = loops.map((l) => l.pts), tris = [];
  for (const o of loops.filter((l) => !l.hole)) {
    const holes = loops.filter((l) => l.hole && pip(l.pts[0], o.pts)).map((l) => l.pts);
    const all = [o.pts, ...holes].flat();
    const faces = THREE.ShapeUtils.triangulateShape(o.pts.map((p) => new THREE.Vector2(p[0], p[1])), holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1]))));
    for (const f of faces) { let t = [all[f[0]], all[f[1]], all[f[2]]]; const a = area2(t); if (Math.abs(a) < 1e-9) continue; if (a < 0) t = [t[0], t[2], t[1]]; tris.push(t); }
  }
  return { contours, tris, box: boxOf(contours.flat()) };
}

// a solid from glyph polygons: faces and side walls; walls inside the glyph are break faces (their own material). Centred on its centroid.
function solid(polys, contours, depth) {
  let A = 0, cx = 0, cy = 0;
  for (const p of polys) for (let i = 1; i < p.length - 1; i++) {
    const a = ((p[i][0] - p[0][0]) * (p[i + 1][1] - p[0][1]) - (p[i + 1][0] - p[0][0]) * (p[i][1] - p[0][1])) / 2;
    A += a; cx += a * (p[0][0] + p[i][0] + p[i + 1][0]) / 3; cy += a * (p[0][1] + p[i][1] + p[i + 1][1]) / 3;
  }
  cx /= A; cy /= A;
  const q = (v) => Math.round(v * 2e4), edges = new Map();
  for (const p of polys) for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    if (q(a[0]) === q(b[0]) && q(a[1]) === q(b[1])) continue;
    edges.set(q(a[0]) + ',' + q(a[1]) + '|' + q(b[0]) + ',' + q(b[1]), [a, b]);
  }
  const h = depth / 2, O = [], ON = [], I = [], IN = [], pts = [];
  const push = (arr, nrm, x, y, z, nx, ny, nz) => { arr.push(x - cx, y - cy, z); nrm.push(nx, ny, nz); };
  for (const p of polys) for (let i = 1; i < p.length - 1; i++) {
    push(O, ON, p[0][0], p[0][1], h, 0, 0, 1); push(O, ON, p[i][0], p[i][1], h, 0, 0, 1); push(O, ON, p[i + 1][0], p[i + 1][1], h, 0, 0, 1);
    push(O, ON, p[0][0], p[0][1], -h, 0, 0, -1); push(O, ON, p[i + 1][0], p[i + 1][1], -h, 0, 0, -1); push(O, ON, p[i][0], p[i][1], -h, 0, 0, -1);
  }
  for (const [k, [a, b]] of edges) {
    const [s, e] = k.split('|'); if (edges.has(e + '|' + s)) continue;
    let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    const crack = insideGlyph([(a[0] + b[0]) / 2 + nx * 0.004, (a[1] + b[1]) / 2 + ny * 0.004], contours);
    const V = crack ? I : O, N = crack ? IN : ON;
    push(V, N, a[0], a[1], -h, nx, ny, 0); push(V, N, b[0], b[1], -h, nx, ny, 0); push(V, N, b[0], b[1], h, nx, ny, 0);
    push(V, N, a[0], a[1], -h, nx, ny, 0); push(V, N, b[0], b[1], h, nx, ny, 0); push(V, N, a[0], a[1], h, nx, ny, 0);
    pts.push([a[0] - cx, a[1] - cy, -h], [a[0] - cx, a[1] - cy, h]);   // the outline is what touches
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(O.concat(I), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(ON.concat(IN), 3));
  geo.addGroup(0, O.length / 3, 0); geo.addGroup(O.length / 3, I.length / 3, 1);
  const step = Math.max(1, Math.floor(pts.length / 120)), cp = [];
  for (let i = 0; i < pts.length; i += step) cp.push(new THREE.Vector3(...pts[i]));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const v of cp) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); }
  return { geo, cx, cy, area: A, pts: cp, dims: [x1 - x0, y1 - y0, depth], h, bb: [x0, y0, x1, y1], r: Math.hypot(x1 - x0, y1 - y0, depth) / 2 + 0.02,
    polys: polys.map((p) => p.map(([x, y]) => [x - cx, y - cy])) };
}

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas, { depth: true });
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark', light = !dark;
  const P = { ...DEF };
  const offs = [];
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);

  // ---------- the face: Archivo Black from Google Fonts, only the letters needed ----------
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=Archivo+Black&text=${encodeURIComponent(lettersFor(stage, NAME) + 'H')}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  const words = linesFor(stage, ['Idan', 'Segev']);
  try { await Promise.race([document.fonts.load(`${WEIGHT} 100px "${FAMILY}"`, words.join('') + 'H'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }

  // ---------- renderer, studio ----------
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(dark ? 0x000000 : 0xffffff);
  // reflections: a black room with bright, thin softboxes, so the glass shows hard glints
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene(); env.background = new THREE.Color(light ? 0x080808 : 0x161616);   // dark on both pages: on white the glass mirrors dark and reads as glass, not white plastic; on black a faint ground keeps a letter visible before it glints
  const box = (w, h, x, y, z, v) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.material.color.setScalar(v); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  box(16, 3, 0, 9, 3, 22); box(0.8, 12, -8, 2, 5, 30); box(0.8, 10, 8, 2, -3, 16); box(30, 1.2, 0, 1.2, 12, 9); box(0.5, 6, 3, 3, 10, 24); box(6, 6, 2, -6, 5, 0.6); box(24, 9, 0, 7, -10, 2.2); box(40, 40, 0, 14, 0, 0.35);
  if (!light) box(26, 10, 0, 2, 14, 11);   // on black: a soft panel behind the camera gives the letters' fronts a sheen, so a falling letter shows before it glints
  const envRT = pmrem.fromScene(env, 0.02);
  scene.environment = envRT.texture;
  env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  // even light from above; the floor shows only shadows over the flat page
  const key = new THREE.DirectionalLight(0xffffff, light ? 2.4 : 2.8);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003;
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 40 });
  key.position.set(-3, 12, 4); scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, light ? 0.9 : 0.05));
  const floorMat = new THREE.ShadowMaterial({ opacity: light ? 0.3 : 0.75 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);

  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, transmission: 1, specularIntensity: 1 });
  const breakMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, transmission: 1, specularIntensity: 1 });
  const MATS = [glassMat, breakMat];
  function applyLook() {
    for (const m of MATS) {
      m.roughness = m === breakMat ? Math.min(1, P.rough + 0.12) : P.rough;
      m.ior = P.ior; m.thickness = P.depth;
      m.attenuationColor.setScalar(light ? 0.18 : 0.45); m.attenuationDistance = P.absorb * (light ? 0.22 : 1);   // Beer-Lambert: thick glass darkens; smokier on a white page, where clear glass washes out
      m.envMapIntensity = P.env; m.needsUpdate = true;
    }
    renderer.toneMappingExposure = P.exposure * (light ? 0.7 : 1);   // the page's white isn't tone mapped, so this darkens only the glass
  }
  applyLook();

  // ---------- the title as glyphs on one line ----------
  let title = null;
  function layoutTitle() {
    const line = words.join(' ');
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = `${WEIGHT} 100px ${FACE}`;
    const capA = mc.measureText('H').actualBoundingBoxAscent || 72, k = CAP / capA, w = mc.measureText(line).width * k;
    const out = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') continue;
      const g0 = glyphContours(line[i], FACE, WEIGHT, 160, 0.02);
      const g = glyph(line[i], -w / 2 + mc.measureText(line.slice(0, i)).width * k + g0.lb * CAP);
      if (g.tris.length) out.push(g);
    }
    return { glyphs: out, width: w };
  }

  // ---------- pieces: Voronoi cells clipped to the glyph, seeds crowded toward the contact ----------
  function fracture(g, lx, ly, depth) {
    const n = Math.round(P.pieces), [bx0, by0, bx1, by1] = g.box, r0 = 0.12 + (1 - P.cluster) * 0.6;
    const S = []; let tries = 0;
    while (S.length < n && tries++ < n * 600) {
      const x = bx0 + Math.random() * (bx1 - bx0), y = by0 + Math.random() * (by1 - by0);
      if (Math.random() > (1 - P.cluster) * 0.3 + P.cluster * Math.exp(-Math.hypot(x - lx, y - ly) / r0) + 0.03) continue;
      if (insideGlyph([x, y], g.contours)) S.push([x, y]);
    }
    for (let t = 0; S.length < 3 && t < 2000; t++) { const x = bx0 + Math.random() * (bx1 - bx0), y = by0 + Math.random() * (by1 - by0); if (insideGlyph([x, y], g.contours)) S.push([x, y]); }
    const pad = 0.05, R = [[bx0 - pad, by0 - pad], [bx1 + pad, by0 - pad], [bx1 + pad, by1 + pad], [bx0 - pad, by1 + pad]];
    const triBoxes = g.tris.map(boxOf), out = [];
    S.forEach((s, i) => {
      let cell = R;
      for (let j = 0; j < S.length && cell.length > 2; j++) { if (j === i) continue; const t = S[j], nx = t[0] - s[0], ny = t[1] - s[1]; cell = clipHalf(cell, nx, ny, (t[0] * t[0] + t[1] * t[1] - s[0] * s[0] - s[1] * s[1]) / 2); }
      if (cell.length < 3) return;
      const cb = boxOf(cell), polys = [];
      g.tris.forEach((t, k) => { if (!overlap(cb, triBoxes[k])) return; const p = clipConvex(t, cell); if (p.length > 2 && area2(p) > 1e-8) polys.push(p); });
      if (polys.length) out.push(solid(polys, g.contours, depth));
    });
    return out;
  }

  // ---------- physics: rigid bodies, the floor and each other ----------
  const bodies = [];
  let nextId = 0, realT = 0, simT = 0;
  const _r = new THREE.Vector3(), _v = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _a = new THREE.Vector3();
  const _R = new THREE.Matrix3(), _D = new THREE.Matrix3(), _RT = new THREE.Matrix3(), _M4 = new THREE.Matrix4();
  function invIworld(b, out) {   // R diag(invI) R^T
    _R.setFromMatrix4(_M4.makeRotationFromQuaternion(b.q)); _RT.copy(_R).transpose();
    _D.set(b.invI.x, 0, 0, 0, b.invI.y, 0, 0, 0, b.invI.z);
    return out.copy(_R).multiply(_D).multiply(_RT);
  }
  const applyI = (M, v) => v.clone().applyMatrix3(M);
  function makeBody(sol, g, isLetter) {
    const mesh = new THREE.Mesh(sol.geo, MATS); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    const mass = Math.max(1e-4, sol.area * sol.dims[2]), [a, b, c] = sol.dims;
    const I = new THREE.Vector3(mass * (b * b + c * c) / 12, mass * (a * a + c * c) / 12, mass * (a * a + b * b) / 12);
    return { id: nextId++, mesh, sol, glyph: g, isLetter, mass, invI: new THREE.Vector3(1 / I.x, 1 / I.y, 1 / I.z), Iw: new THREE.Matrix3(),
      p: new THREE.Vector3(), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: new THREE.Vector3(),
      still: 0, asleep: false, wait: 0, tough: P.toughness, dieAt: realT + P.life + (isLetter ? 3 : Math.random()), dying: false, breakAt: null, kin: 0, kinT: 0 };
  }
  function wake(b) { if (b.asleep) { b.asleep = false; b.still = 0; invIworld(b, b.Iw); } }
  function stepBody(b, dt) {
    if (b.asleep) return null;
    if (b.wait > 0) { b.wait -= dt; return null; }
    invIworld(b, b.Iw);
    b.v.y -= G * dt;
    b.p.addScaledVector(b.v, dt);
    _q.set(b.w.x * dt * 0.5, b.w.y * dt * 0.5, b.w.z * dt * 0.5, 0).multiply(b.q);
    b.q.x += _q.x; b.q.y += _q.y; b.q.z += _q.z; b.q.w += _q.w; b.q.normalize();
    b.w.multiplyScalar(1 - 0.4 * dt);
    let pen = 0, hard = 0, hitAt = null;
    const Iw = b.Iw;
    for (const lp of b.sol.pts) {
      _r.copy(lp).applyQuaternion(b.q);
      const y = b.p.y + _r.y; if (y >= 0) continue;
      pen = Math.max(pen, -y);
      _v.copy(b.w).cross(_r).add(b.v);
      const vn = _v.y; if (vn >= 0) continue;
      if (b.isLetter && -vn > b.tough && -vn > hard) { hard = -vn; hitAt = _r.clone(); }
      const rn = _r.clone().cross(_n), k = 1 / b.mass + _n.dot(applyI(Iw, rn).cross(_r));
      const e = vn < -0.6 ? P.bounce : 0, j = -(1 + e) * vn / k;
      b.v.y += j / b.mass; b.w.add(applyI(Iw, _r.clone().cross(_n).multiplyScalar(j)));
      _v.copy(b.w).cross(_r).add(b.v); _t.set(_v.x, 0, _v.z); const vt = _t.length();
      if (vt > 1e-5) {
        _t.divideScalar(vt);
        const rt = _r.clone().cross(_t), kt = 1 / b.mass + _t.dot(applyI(Iw, rt).cross(_r));
        const jt = Math.min(vt / kt, P.friction * j);
        b.v.addScaledVector(_t, -jt / b.mass); b.w.add(applyI(Iw, _r.clone().cross(_t).multiplyScalar(-jt)));
      }
    }
    if (hitAt) return hitAt;
    if (pen > 0) b.p.y += pen;
    if (b.v.lengthSq() < 0.0025 && b.w.lengthSq() < 0.01 && pen > 0) { b.still += dt; if (b.still > 0.4) { b.asleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0); } } else b.still = 0;
    return null;
  }
  // a letter breaks: the pieces take its motion at the split; those by the contact get a small kick along the floor
  function breakLetter(b, hitAt) {
    const lc = hitAt.clone().applyQuaternion(b.q.clone().invert());
    const gx = lc.x + b.sol.cx, gy = lc.y + b.sol.cy;
    for (const s of fracture(b.glyph, gx, gy, P.depth)) {
      const c = makeBody(s, null, false); c.kin = b.id + 1; c.kinT = simT;
      const off = new THREE.Vector3(s.cx - b.sol.cx, s.cy - b.sol.cy, 0).applyQuaternion(b.q);
      c.p.copy(b.p).add(off); c.q.copy(b.q);
      c.v.copy(b.w).cross(off).add(b.v); c.w.copy(b.w);
      const d = Math.hypot(s.cx - gx, s.cy - gy), near = Math.exp(-d / 0.18), dir = off.clone().sub(hitAt); dir.y = 0;
      if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      c.v.addScaledVector(dir, P.spread * near * (0.6 + Math.random() * 0.8)).add(_a.set(0, P.spread * near * 0.5 * Math.random(), (Math.random() - 0.3) * P.spread * near));
      c.w.add(_a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(8 * near));
      c.mesh.position.copy(c.p); c.mesh.quaternion.copy(c.q); invIworld(c, c.Iw);
      bodies.push(c);
    }
    remove(b);
  }
  function remove(b) {
    scene.remove(b.mesh); b.mesh.geometry.dispose();
    if (b.mesh.material[0] !== glassMat) for (const m of b.mesh.material) m.dispose();
    const i = bodies.indexOf(b); if (i >= 0) bodies.splice(i, 1);
  }
  // piece on piece: A's outline points against B's solid, pushed out through the nearest face
  const _wp = new THREE.Vector3(), _lp = new THREE.Vector3(), _qi = new THREE.Quaternion(), _nn = new THREE.Vector3(), _rA = new THREE.Vector3(), _rB = new THREE.Vector3(), _vA = new THREE.Vector3(), _vB = new THREE.Vector3(), _x = new THREE.Vector3();
  function pointsInto(A, B) {
    _qi.copy(B.q).invert();
    const S = B.sol, bb = S.bb;
    for (const lp of A.sol.pts) {
      _wp.copy(lp).applyQuaternion(A.q).add(A.p);
      _lp.copy(_wp).sub(B.p).applyQuaternion(_qi);
      if (Math.abs(_lp.z) >= S.h || _lp.x <= bb[0] || _lp.x >= bb[2] || _lp.y <= bb[1] || _lp.y >= bb[3]) continue;
      const q2 = [_lp.x, _lp.y];
      if (B.isLetter ? !insideGlyph([_lp.x + S.cx, _lp.y + S.cy], B.glyph.contours) : !S.polys.some((pl) => inConvex(q2, pl))) continue;
      const d = [S.h - _lp.z, _lp.z + S.h, _lp.x - bb[0], bb[2] - _lp.x, _lp.y - bb[1], bb[3] - _lp.y];
      let k = 0; for (let i = 1; i < 6; i++) if (d[i] < d[k]) k = i;
      _nn.set(k === 2 ? -1 : k === 3 ? 1 : 0, k === 4 ? -1 : k === 5 ? 1 : 0, k === 0 ? 1 : k === 1 ? -1 : 0).applyQuaternion(B.q);
      resolve(A, B, _wp, _nn, d[k]);
    }
  }
  function resolve(A, B, wp, n, pen) {
    _rA.copy(wp).sub(A.p); _rB.copy(wp).sub(B.p);
    _vA.copy(A.w).cross(_rA).add(A.v); _vB.copy(B.w).cross(_rB).add(B.v);
    const vn = _x.copy(_vA).sub(_vB).dot(n);
    if (vn < -0.25) { wake(A); wake(B); }
    if (A.isLetter && !A.breakAt && -vn > A.tough) A.breakAt = _rA.clone();
    if (B.isLetter && !B.breakAt && -vn > B.tough) B.breakAt = _rB.clone();
    const iA = A.asleep ? 0 : 1 / A.mass, iB = B.asleep ? 0 : 1 / B.mass;
    if (iA + iB === 0) return;
    const corr = Math.min(pen, 0.02) * 0.5 / (iA + iB);
    A.p.addScaledVector(n, corr * iA); B.p.addScaledVector(n, -corr * iB);
    if (vn >= 0) return;
    const tA = _rA.clone().cross(n).applyMatrix3(A.Iw).cross(_rA), tB = _rB.clone().cross(n).applyMatrix3(B.Iw).cross(_rB);
    const k = iA + iB + (A.asleep ? 0 : n.dot(tA)) + (B.asleep ? 0 : n.dot(tB));
    const j = -(1 + Math.min(0.2, P.bounce)) * vn / k;
    const apply = (b, r, imp, sign) => { if (b.asleep) return; b.v.addScaledVector(imp, sign / b.mass); b.w.add(r.clone().cross(imp).multiplyScalar(sign).applyMatrix3(b.Iw)); };
    const J = n.clone().multiplyScalar(j); apply(A, _rA, J, 1); apply(B, _rB, J, -1);
    _vA.copy(A.w).cross(_rA).add(A.v); _vB.copy(B.w).cross(_rB).add(B.v);
    const vt = _x.copy(_vA).sub(_vB); vt.addScaledVector(n, -vt.dot(n)); const lt = vt.length();
    if (lt > 1e-5) { const jt = Math.min(lt / k, P.friction * j); const T = vt.multiplyScalar(-jt / lt); apply(A, _rA, T, 1); apply(B, _rB, T, -1); }
  }
  const gridM = new Map();
  function collidePairs() {
    gridM.clear();
    const C = 0.7, hk = (x, z) => x * 73856093 ^ z * 19349663;
    for (const b of bodies) {
      if (b.wait > 0) continue;
      const r = b.sol.r, x0 = Math.floor((b.p.x - r) / C), x1 = Math.floor((b.p.x + r) / C), z0 = Math.floor((b.p.z - r) / C), z1 = Math.floor((b.p.z + r) / C);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = hk(x, z); let c = gridM.get(k); if (!c) gridM.set(k, (c = [])); c.push(b); }
    }
    const seen = new Set();
    for (const cell of gridM.values()) for (let i = 0; i < cell.length; i++) for (let j = i + 1; j < cell.length; j++) {
      const A = cell[i], B = cell[j]; if (A.asleep && B.asleep) continue;
      if (A.kin && A.kin === B.kin && simT - A.kinT < 0.15) continue;   // siblings from one break separate before they collide
      const pk = A.id < B.id ? A.id * 1e6 + B.id : B.id * 1e6 + A.id; if (seen.has(pk)) continue; seen.add(pk);
      const rr = A.sol.r + B.sol.r; if (A.p.distanceToSquared(B.p) > rr * rr) continue;
      pointsInto(A, B); pointsInto(B, A);
    }
  }
  function advance(sec) {
    let n = Math.min(240, Math.round(sec / H_STEP));
    while (n-- > 0) {
      simT += H_STEP;
      for (const b of [...bodies]) { const hit = stepBody(b, H_STEP); if (hit) breakLetter(b, hit); }
      collidePairs();
      for (const b of [...bodies]) if (b.breakAt) breakLetter(b, b.breakAt);
    }
    for (const b of bodies) { b.mesh.position.copy(b.p); b.mesh.quaternion.copy(b.q); b.mesh.visible = b.wait <= 0; }
  }
  // pieces go when their time is up: their own copy of the glass fades out where they lie
  function life() {
    for (const b of [...bodies]) {
      if (b.wait > 0 || realT < b.dieAt) continue;
      if (!b.dying) { b.dying = true; b.mesh.material = MATS.map((m) => { const c = m.clone(); c.transparent = true; c.depthWrite = false; return c; }); }
      const k = Math.min(1, (realT - b.dieAt) / P.fade), o = 1 - k * k * (3 - 2 * k);
      for (const m of b.mesh.material) m.opacity = o;
      b.mesh.castShadow = o > 0.35;
      if (k >= 1) remove(b);
    }
  }

  // ---------- dropping the title; a narrow screen gets big letters one at a time ----------
  let W = stage.W, H = stage.H, nextDrop = 0, drops = 0, viewTop = 3;
  const narrow = () => W / H < 0.9;
  function dropTitle() {
    if (!title) title = layoutTitle();
    while (bodies.length > MAX_BODIES) remove(bodies[0]);
    const nar = narrow(), z = (drops % 3 - 1) * 0.35 * (drops > 0 ? 1 : 0);
    title.glyphs.forEach((g, i) => {
      const sol = solid(g.tris, g.contours, P.depth), b = makeBody(sol, g, true);
      // it starts just inside the top of the frame, already moving as if it had fallen from the full height: the same hit, and it is there from the first frame
      const h = P.height + Math.random() * 0.25, h0 = Math.max(0.2, Math.min(h, viewTop - 0.05 - g.box[3]));
      b.p.set(nar ? (Math.random() - 0.5) * 0.2 : sol.cx, sol.cy + h0, z + (Math.random() - 0.5) * 0.15);
      b.v.y = -Math.sqrt(2 * G * (h - h0));
      b.q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4));
      b.w.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2);
      if (nar) { b.wait = i * P.seq * P.timeScale; b.dieAt += i * P.seq; }
      if (Math.random() < P.survive) b.tough = Infinity;   // this one lands whole
      b.mesh.position.copy(b.p); b.mesh.quaternion.copy(b.q); b.mesh.visible = b.wait <= 0; invIworld(b, b.Iw);
      bodies.push(b);
    });
    drops++;
    nextDrop = realT + (nar ? Math.max(P.loop, title.glyphs.length * P.seq + P.life) : P.loop);
  }
  function clearAll() { while (bodies.length) remove(bodies[0]); }

  // ---------- camera: front-on, a little above, the title (or one letter) filling the width ----------
  function frameCamera() {
    W = stage.W; H = stage.H;
    renderer.setSize(stage.pw, stage.ph, false);
    if (!title) title = layoutTitle();
    const w = narrow() ? 2.1 : title.width + 1.2, aspect = W / H;
    const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
    const dist = Math.max(4.5, (w / 2) / Math.tan(hf / 2) * 0.95);
    camera.aspect = aspect;
    camera.position.set(0, 0.45 + dist * Math.sin(0.26), dist * Math.cos(0.26)); camera.lookAt(0, 0.45, 0);
    viewTop = 0.45 + dist * (Math.sin(0.26) + Math.cos(0.26) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2) - 0.26));   // the frame's top edge, over the floor's middle
    camera.updateProjectionMatrix();
  }

  // ---------- gestures ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(bodies.filter((b) => b.wait <= 0 && !b.dying).map((b) => b.mesh), false)[0];
    return h ? { b: bodies.find((q) => q.mesh === h.object), point: h.point } : null;
  }
  const press = pressTracker();
  let lastTap = -1, reform = 0, downHit = null;
  offs.push(stage.on('down', (q, e) => { if (!press.down(q, e.pointerId)) return; downHit = hit(q.x, q.y); }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (q.type === 'mouse' && !press.active) stage.root.style.cursor = hit(q.x, q.y) ? 'pointer' : '';
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (!r) return;
    const h = downHit; downHit = null;
    if (!r.tap || stage.reduced) return;
    const now = performance.now();
    clearTimeout(reform);
    if (h && bodies.includes(h.b)) {                                  // a letter breaks where you tapped; a piece is flicked
      lastTap = -1; const b = h.b; wake(b);
      if (b.isLetter) breakLetter(b, h.point.clone().sub(b.p));
      else { b.v.y += 2.2; b.v.x += (Math.random() - 0.5) * 1.5; b.w.add(_a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(10)); }
      return;
    }
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) { lastTap = -1; reform = setTimeout(() => { if (alive && !stage.revealed) dropTitle(); }, REFORM_DELAY_MS); }
    else lastTap = now;
  }));

  // ---------- reveal: every body's contact points, which way it moves, the letters still whole ----------
  const _pr = new THREE.Vector3();
  const toScreen = (v) => { _pr.copy(v).project(camera); return [(_pr.x + 1) / 2 * W, (1 - _pr.y) / 2 * H]; };
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    c.lineWidth = 1;
    const _d = new THREE.Vector3();
    for (const b of bodies) {
      if (b.wait > 0) continue;
      c.fillStyle = colr((b.isLetter ? 0.9 : 0.5) * k);
      const step = b.isLetter ? 2 : 1;
      for (let i = 0; i < b.sol.pts.length; i += step) { _d.copy(b.sol.pts[i]).applyQuaternion(b.q).add(b.p); const s = toScreen(_d); c.fillRect(s[0] - 1, s[1] - 1, 2, 2); }
      const o = toScreen(b.p);
      if (b.v.lengthSq() > 0.01) { const e = toScreen(_d.copy(b.p).addScaledVector(b.v, 0.12)); c.strokeStyle = colr(0.7 * k); c.beginPath(); c.moveTo(o[0], o[1]); c.lineTo(e[0], e[1]); c.stroke(); }
      if (b.isLetter) { c.strokeStyle = colr(0.8 * k); c.beginPath(); c.arc(o[0], o[1], 7, 0, Math.PI * 2); c.stroke(); label(c, b.tough === Infinity ? 'whole' : 'breaks', o[0] + 10, o[1] - 6, colr, k); }
    }
    titleBlock(c, W_, H_, ['DROP · STRUCTURE', '· where each solid can touch (its outline)', '— which way it is moving', '○ a letter still whole', `${bodies.length} bodies`], colr, k);
  }, { dim: 0.6 });

  // ---------- settings ----------
  const Ctl = (key2, label2, min, max, step) => ({ key: key2, label: label2, min, max, step });
  const LOOK = new Set(['rough', 'absorb', 'ior', 'env', 'exposure', 'depth']);
  const tune = {
    title: 'Drop', values: P, defaults: DEF,
    groups: [
      { name: 'Glass', items: [Ctl('depth', 'Thickness (next drop)', 0.08, 0.8, 0.01), Ctl('absorb', 'Clearness', 0.15, 4, 0.05), Ctl('rough', 'Roughness', 0, 0.4, 0.005), Ctl('ior', 'Refraction (IOR)', 1, 2.2, 0.01), Ctl('env', 'Reflections', 0, 4, 0.05), Ctl('exposure', 'Exposure', 0.3, 2.5, 0.05)] },
      { name: 'Fall', items: [Ctl('height', 'Drop height', 0.6, 7, 0.1), Ctl('toughness', 'Breaks above (speed)', 0.5, 8, 0.1), Ctl('survive', 'Letters that land whole', 0, 1, 0.05), Ctl('pieces', 'Pieces per letter', 4, 60, 1), Ctl('cluster', 'Smaller pieces where it hits', 0, 1, 0.01), Ctl('spread', 'Kick at the break', 0, 2.5, 0.05), Ctl('bounce', 'Bounce', 0, 0.8, 0.01), Ctl('friction', 'Friction', 0, 1.2, 0.01), Ctl('timeScale', 'Time (slow motion)', 0.05, 1.5, 0.01)] },
      { name: 'Loop', items: [Ctl('loop', 'Drops again every (s)', 3, 30, 0.5), Ctl('life', 'Pieces dissolve after (s)', 1, 30, 0.5), Ctl('fade', 'Dissolve takes (s)', 0.2, 5, 0.1), Ctl('seq', 'Narrow screens: time between letters (s)', 0.3, 5, 0.1)] },
    ],
    set(key2, v) { P[key2] = v; if (LOOK.has(key2)) applyLook(); },
    reset() { Object.assign(P, DEF); applyLook(); },
  };

  // ---------- the frame ----------
  function render() { renderer.setViewport(0, 0, stage.pw, stage.ph); renderer.render(scene, camera); }
  function frame(dt) {
    if (!stage.reduced) {
      dt = Math.min(dt, 1 / 20);
      realT += dt; advance(dt * P.timeScale); life();
      if (realT >= nextDrop && !stage.revealed) dropTitle();
    }
    render();
    rv.draw(performance.now());
  }

  frameCamera();
  dropTitle();                                                         // the intro: the first drop
  if (stage.reduced) { for (let i = 0; i < 24; i++) advance(0.25); for (const b of bodies) b.mesh.visible = true; }   // the pile, already settled
  offs.push(stage.frame((dt) => frame(dt)));
  let rt = 0; offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) frameCamera(); }, 120); }));

  return {
    tune,
    debug: { bodies: () => bodies, advance, dropTitle },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reform);
      rv.destroy(); offs.forEach((f) => f());
      clearAll(); floor.geometry.dispose(); floorMat.dispose(); for (const m of MATS) m.dispose();
      envRT.dispose(); pmrem.dispose(); renderer.dispose();
      stage.root.style.cursor = '';
      link.remove(); stage.setBackdrop(null);
    },
  };
}
