// Goblet: every letter is a chubby glass bottle about half full of ink. Pick a letter up and it hangs from where you hold it; the
// ink's surface sloshes as it moves (after MinionsArt's Unity liquid shader: the surface is a plane that tilts against the felt
// acceleration, a damped spring). Hold a letter by its foot and it swings over; once its neck is under the ink, the ink pours out.
// Port of the test page docs/posters/prototypes/inkwell.html with Idan's tuning (29 Oct 2026), renamed Goblet by him.
//
// Under the picture (three.js 0.160, vendored): the letters are traced from Fredoka 700 (glyph-contours.js) and extruded twice:
// the glass with a deep rounded bevel, the ink smaller by the glass's thickness. The ink's shader discards everything above a plane
// and paints its back faces as the liquid's top. The plane's height comes from about 1,400 points sampled inside the letter, so the
// ink keeps its volume at any angle. A neck and lip sit on each letter's highest point; pouring lowers the fill and throws drops.
//
// Gestures (src/gestures.js): drag a letter to carry it (it hangs from the grip under gravity); tap a letter to jiggle it; tapping
// the background does nothing; hold has no action of its own. Double tap fills every letter again (after the re-form beat).
// Reveal: the ink's surface in every letter, its fill, and each neck. One self-demo after 3.5 s untouched (the S is nudged and
// sloshes); off under reduced motion, which also fills the letters at once. Black: white ink in clear glass; white: dark ink (both themes take the same code path).

import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/room-environment.js';
import { getGL } from '../engine.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';
import { glyphContours } from './glyph-contours.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Fredoka', NAME = 'IdanSegv', WEIGHT = 700;
// Idan's tuning from the test page (29 Oct 2026)
const DEF = { fill: 0.58, puff: 1, depth: 1, wall: 0.014, wobble: 0.7, settle: 0.12, slosh: 0.8, pour: 1.2, grav: 1, spring: 0.6, tint: 0.36 };
const DEMO_AFTER = 3500, MAXD = 900, NVOL = 1400;
// Khronos PBR Neutral, as three's NeutralToneMapping (r162; the vendored build is r160): the test page was tuned with it
const NEUTRAL = `vec3 CustomToneMapping( vec3 color ) {
  const float S = 0.76, Ds = 0.15;
  color *= toneMappingExposure;
  float x = min( color.r, min( color.g, color.b ) );
  color -= x < 0.08 ? x - 6.25 * x * x : 0.04;
  float peak = max( color.r, max( color.g, color.b ) );
  if ( peak < S ) return color;
  float d = 1. - S, np = 1. - d * d / ( peak + d - S );
  color *= np / peak;
  return mix( color, vec3( np ), 1. - 1. / ( Ds * ( peak - np ) + 1. ) );
}`;
const STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

const pip = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas, { depth: true });   // the glass and the ink inside it need a depth buffer
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';                          // black only: the shell always shows it dark (darkOnly)
  const P = { ...DEF };
  const offs = [];
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);

  // ---------- the face: Fredoka from Google Fonts, only the letters of the name ----------
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${FAMILY}:wght@${WEIGHT}&text=${encodeURIComponent(lettersFor(stage, NAME))}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(`${WEIGHT} 100px "${FAMILY}"`, NAME), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }
  const FACE = `"${FAMILY}", "Arial Rounded MT Bold", sans-serif`;

  // ---------- renderer and scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(STUB, NEUTRAL);   // put back in destroy()
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const bgV = dark ? 0 : 1;
  scene.background = new THREE.Color(bgV, bgV, bgV);
  // the room the glass reflects: three's RoomEnvironment, as on the test page Idan tuned
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  room.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-0.5, 1, 1); scene.add(key);
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 20000);
  const root = new THREE.Group(); scene.add(root);

  // ---------- materials ----------
  const inkV = dark ? 0.955 : 0.02;
  const glassMat = (fs) => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, ior: 1.5, thickness: fs * 0.12,
    specularIntensity: 1, clearcoat: 0.6, clearcoatRoughness: 0.03, envMapIntensity: 1.1,
    attenuationColor: new THREE.Color(dark ? 0x9a9a9a : 0x8c8c8c), attenuationDistance: fs * (2.2 - 2 * P.tint) + 1,
  });
  const inkMat = (plane) => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(inkV, inkV, inkV), roughness: 0.25, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.08,
      side: THREE.DoubleSide, envMapIntensity: dark ? 1.2 : 0.5,
    });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uN = plane.n; sh.uniforms.uD = plane.d; sh.uniforms.uSurf = plane.surf;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform vec3 uN; uniform float uD; uniform vec3 uSurf;')
        .replace('void main() {', 'void main() {\n  float above = dot(vWP, uN) - uD; if (above > 0.0) discard;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if (!gl_FrontFacing) { float rim = smoothstep(-6.0, 0.0, above); gl_FragColor = vec4(mix(uSurf, uSurf * 1.6 + 0.04, rim), 1.0); }');
    };
    m.customProgramCacheKey = () => 'goblet-ink';
    return m;
  };
  const dropMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(inkV, inkV, inkV), roughness: 0.15, clearcoat: 1, envMapIntensity: 1.2 });

  // ---------- the letters ----------
  let W = stage.W, H = stage.H, fs = 200, letters = [];
  const mats = [];
  function makeLetter(ch, inkCx, base, cap) {
    const g = glyphContours(ch, FACE, WEIGHT, 200, 0.012);
    const toV = (p) => new THREE.Vector2(p[0] * cap, p[1] * cap);
    const outer = g.loops.find((l) => !l.hole), holes = g.loops.filter((l) => l.hole);
    const shape = new THREE.Shape(outer.pts.map(toV));
    for (const h of holes) shape.holes.push(new THREE.Path(h.pts.map(toV)));
    const D = fs * 0.1 * P.depth, bt = fs * 0.075 * P.puff, bs = fs * 0.03 * P.puff, wall = fs * P.wall;
    const opts = (depth, thick, size, off) => ({ depth, bevelEnabled: true, bevelThickness: thick, bevelSize: size, bevelOffset: off, bevelSegments: 8, curveSegments: 8 });
    const gG = new THREE.ExtrudeGeometry(shape, opts(D, bt, bs, 0)); gG.translate(0, 0, -D / 2); gG.computeVertexNormals();
    const bsI = Math.max(0.5, bs * 0.45), btI = Math.max(1, bt - wall);
    const gI = new THREE.ExtrudeGeometry(shape, opts(D, btI, bsI, bs - wall - bsI)); gI.translate(0, 0, -D / 2); gI.computeVertexNormals();
    // volume samples inside the ink (x, y in the outline, z through the depth): the level that keeps the volume at any angle
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, top = -1e9, tx = 0, nt = 0;
    for (const p of outer.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (const p of outer.pts) { const y = p[1] * cap; if (y > top + 1) { top = y; tx = p[0] * cap; nt = 1; } else if (Math.abs(y - top) <= 1) { tx = (tx * nt + p[0] * cap) / (nt + 1); nt++; } }
    const polys = g.loops.map((l) => l.pts), vol = new Float32Array(NVOL * 3), zr = D / 2 + btI * 0.8;
    let n = 0, tries = 0, sx = 0, sy = 0;
    while (n < NVOL && tries++ < 80000) {
      const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
      let c = 0; for (const pl of polys) if (pip(x, y, pl)) c++;
      if (c % 2 === 0) continue;
      vol[n * 3] = x * cap; vol[n * 3 + 1] = y * cap; vol[n * 3 + 2] = (Math.random() * 2 - 1) * zr; sx += x * cap; sy += y * cap; n++;
    }
    // the letter turns about its centre of mass
    const cx = sx / n, cy = sy / n;
    for (let i = 0; i < n; i++) { vol[i * 3] -= cx; vol[i * 3 + 1] -= cy; }
    let rg2 = 0; for (let i = 0; i < n; i++) rg2 += vol[i * 3] ** 2 + vol[i * 3 + 1] ** 2; rg2 /= n;
    gG.translate(-cx, -cy, 0); gI.translate(-cx, -cy, 0);
    const nr = fs * 0.038 * Math.max(0.8, P.puff), nl = fs * 0.075, mx = tx - cx, my = top - cy + bs * 0.4;
    const neckG = new THREE.CylinderGeometry(nr, nr * 1.2, nl + bt, 28, 1, true); neckG.translate(mx, my + (nl - bt) / 2, 0);
    const lipG = new THREE.TorusGeometry(nr * 1.02, fs * 0.012, 12, 32); lipG.rotateX(Math.PI / 2); lipG.translate(mx, my + nl, 0);

    const plane = { n: { value: new THREE.Vector3(0, 1, 0) }, d: { value: 0 }, surf: { value: new THREE.Color().setScalar(dark ? 0.78 : 0.12) } };
    const gm = glassMat(fs), im = inkMat(plane); mats.push(gm, im);
    const group = new THREE.Group();
    const glass = new THREE.Mesh(gG, gm), neck = new THREE.Mesh(neckG, gm);
    group.add(new THREE.Mesh(gI, im), glass, neck, new THREE.Mesh(lipG, gm));
    root.add(group);
    const hx = inkCx - W / 2 + cx, hy = base + cy;
    group.position.set(hx, hy, 0);
    return {
      ch, group, glass, neck, plane, vol, nV: n, rg2, sorted: new Float32Array(n), mouth: new THREE.Vector3(mx, my + nl, 0),
      x: hx, y: hy, hx, hy, th: 0, vx: 0, vy: 0, om: 0, ax: 0, rx: 0, ry: 0,
      tiltX: 0, tiltZ: 0, tvx: 0, tvz: 0, fill: P.fill, refill: false, grab: null, pourAcc: 0, level: 0,
    };
  }
  function clearLetters() {
    for (const L of letters) { root.remove(L.group); L.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    mats.forEach((m) => m.dispose()); mats.length = 0; letters = [];
  }
  function build() {
    W = stage.W; H = stage.H;
    renderer.setSize(stage.pw, stage.ph, false);
    const dist = (H / 2) / Math.tan(THREE.MathUtils.degToRad(14)), pitch = THREE.MathUtils.degToRad(9);
    camera.aspect = W / H; camera.position.set(0, dist * Math.sin(pitch), dist * Math.cos(pitch)); camera.lookAt(0, 0, 0);
    camera.near = dist * 0.3; camera.far = dist * 3; camera.updateProjectionMatrix();
    clearLetters();
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = `${WEIGHT} 100px ${FACE}`;
    const capA = mc.measureText('H').actualBoundingBoxAscent || 70;
    const lines = linesFor(stage, W / H < 0.95 ? ['Idan', 'Segev'] : ['Idan Segev']);
    const w100 = Math.max(...lines.map((l) => mc.measureText(l).width));
    fs = Math.min((W * 0.8) / w100 * 100, H * Math.min(lines.length === 1 ? 0.4 : 0.28, 0.6 / lines.length));
    mc.font = `${WEIGHT} ${fs}px ${FACE}`;
    const cap = capA / 100 * fs, lh = fs * 1.05;
    let base = (lh * (lines.length - 1)) / 2;                       // y up: the middle of the cap band of the first line
    for (const line of lines) {
      const x0 = (W - mc.measureText(line).width) / 2;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') continue;
        const pen = x0 + mc.measureText(line.slice(0, i)).width, g = glyphContours(line[i], FACE, WEIGHT, 200, 0.012);
        letters.push(makeLetter(line[i], pen + g.lb * cap, base, cap));   // contours are measured from the ink's centre
      }
      base -= lh;
    }
    makeDrops();
    fillStart = performance.now();
  }

  // ---------- drops ----------
  let drops = null, dNext = 0;
  const dp = new Float32Array(MAXD * 3), dv = new Float32Array(MAXD * 3), dr = new Float32Array(MAXD), dAlive = new Uint8Array(MAXD);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const dropGeo = new THREE.SphereGeometry(1, 14, 10);
  function makeDrops() {
    if (drops) root.remove(drops);
    drops = new THREE.InstancedMesh(dropGeo, dropMat, MAXD); drops.frustumCulled = false;
    dAlive.fill(0); for (let i = 0; i < MAXD; i++) drops.setMatrixAt(i, ZERO);
    root.add(drops);
  }
  function emit(x, y, z, vx, vy, vz, r) {
    const i = dNext; dNext = (dNext + 1) % MAXD;
    dp.set([x, y, z], i * 3); dv.set([vx, vy, vz], i * 3); dr[i] = r; dAlive[i] = 1;
  }
  function stepDrops(dt) {
    const g = 2200 * P.grav;
    for (let i = 0; i < MAXD; i++) {
      if (!dAlive[i]) continue;
      dv[i * 3 + 1] -= g * dt;
      for (let k = 0; k < 3; k++) dp[i * 3 + k] += dv[i * 3 + k] * dt;
      if (dp[i * 3 + 1] < -H / 2 - 80) { dAlive[i] = 0; drops.setMatrixAt(i, ZERO); continue; }
      _v.set(dv[i * 3], dv[i * 3 + 1], dv[i * 3 + 2]);
      const sp = _v.length(), st = 1 + Math.min(0.9, sp * 0.0005);
      _q.setFromUnitVectors(_up, sp > 1 ? _v.multiplyScalar(1 / sp) : _up);
      _s.set(dr[i] / Math.sqrt(st), dr[i] * st, dr[i] / Math.sqrt(st));
      drops.setMatrixAt(i, _m.compose(_p.set(dp[i * 3], dp[i * 3 + 1], dp[i * 3 + 2]), _q, _s));
    }
    drops.instanceMatrix.needsUpdate = true;
  }

  // ---------- physics: each letter is a rigid body; the ink's surface is a damped spring ----------
  const mouse = { x: 0, y: 0 };
  function stepLetters(dt) {
    const gB = 2200 * P.grav;
    for (const L of letters) {
      const pvx = L.vx;
      let ax, ay, al;
      if (L.grab) {
        const gw = 30, zg = 0.55, c = Math.cos(L.th), s = Math.sin(L.th);
        const rx = L.grab.lx * c - L.grab.ly * s, ry = L.grab.lx * s + L.grab.ly * c;
        const fx = gw * gw * (mouse.x - (L.x + rx)) - 2 * zg * gw * (L.vx - L.om * ry);
        const fy = gw * gw * (mouse.y - (L.y + ry)) - 2 * zg * gw * (L.vy + L.om * rx);
        ax = fx; ay = fy - gB;
        al = (rx * fy - ry * fx) / L.rg2 - 1.5 * L.om;               // it hangs from where you hold it
      } else {
        const wh = 9 * P.spring, wa = 10 * P.spring, zh = 0.3, za = 0.22;
        let d = L.th % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; L.th = d;
        ax = wh * wh * (L.hx - L.x) - 2 * zh * wh * L.vx;
        ay = wh * wh * (L.hy - L.y) - 2 * zh * wh * L.vy;
        al = -wa * wa * d - 2 * za * wa * L.om;
      }
      L.vx += ax * dt; L.vy += ay * dt; L.om += al * dt;
      const sp = Math.hypot(L.vx, L.vy); if (sp > 3000) { L.vx *= 3000 / sp; L.vy *= 3000 / sp; }
      L.om = Math.max(-16, Math.min(16, L.om));
      L.x += L.vx * dt; L.y += L.vy * dt; L.th += L.om * dt;
      L.ax += ((L.vx - pvx) / dt - L.ax) * 0.3;                      // the acceleration the ink feels
      const trY = Math.max(-0.5, Math.min(0.5, L.vx * 0.00035)), trX = Math.max(-0.5, Math.min(0.5, -L.vy * 0.00035));
      L.ry += (trY - L.ry) * 0.15; L.rx += (trX - L.rx) * 0.15;    // a little 3D swing from moving through the air
      const ww = 7 * P.wobble, zz = P.settle;
      const tgtX = P.slosh * (-L.ax / gB + L.om * 0.02), tgtZ = P.slosh * (L.om * 0.05 + (L.ry - trY) * 0.6);
      L.tvx += (ww * ww * (tgtX - L.tiltX) - 2 * zz * ww * L.tvx) * dt;
      L.tvz += (ww * ww * (tgtZ - L.tiltZ) - 2 * zz * ww * L.tvz) * dt;
      L.tiltX = Math.max(-1.2, Math.min(1.2, L.tiltX + L.tvx * dt));
      L.tiltZ = Math.max(-1.2, Math.min(1.2, L.tiltZ + L.tvz * dt));
    }
  }
  const _n = new THREE.Vector3(), _iq = new THREE.Quaternion(), _nl = new THREE.Vector3(), _mw = new THREE.Vector3(), _ax = new THREE.Vector3();
  function updateLevels(dt, now) {
    const fillT = stage.reduced ? 1 : Math.min(1, (now - fillStart) / 1300);
    for (const L of letters) {
      L.group.position.set(L.x, L.y, 0);
      L.group.rotation.set(L.rx, L.ry, L.th, 'ZYX');
      L.group.updateMatrixWorld(true);
      if (L.refill) { L.fill = Math.min(P.fill, L.fill + dt * 0.6); if (L.fill >= P.fill) L.refill = false; }
      const fill = L.fill * fillT;
      _n.set(L.tiltX, 1, L.tiltZ).normalize();
      _nl.copy(_n).applyQuaternion(_iq.copy(L.group.quaternion).invert());   // the surface's normal in the letter's own frame
      const V = L.vol, S = L.sorted;
      for (let i = 0; i < L.nV; i++) S[i] = V[i * 3] * _nl.x + V[i * 3 + 1] * _nl.y + V[i * 3 + 2] * _nl.z;
      S.sort();
      const dLocal = fill <= 0.002 ? S[0] - 50 : S[Math.min(L.nV - 1, Math.floor(fill * L.nV))];
      L.plane.n.value.copy(_n); L.plane.d.value = dLocal + _n.dot(L.group.position); L.level = fill;
      // pour: the neck is under the surface
      const mh = L.mouth.x * _nl.x + L.mouth.y * _nl.y + L.mouth.z * _nl.z;
      if (L.refill || fillT < 1 || L.fill <= 0 || mh >= dLocal) continue;
      const head = Math.min(1, (dLocal - mh) / (fs * 0.25)), out = Math.min(L.fill, P.pour * (0.08 + 0.5 * head) * dt);
      L.fill -= out; L.pourAcc += out * 900;
      _mw.copy(L.mouth).applyMatrix4(L.group.matrixWorld);
      _ax.set(0, 1, 0).applyQuaternion(L.group.quaternion);
      while (L.pourAcc >= 1) {
        L.pourAcc -= 1;
        const sp = 140 + 260 * head, mx = _mw.x - L.x, my = _mw.y - L.y;
        const evx = L.vx - L.om * my + _ax.x * sp + (Math.random() - 0.5) * 50, evy = L.vy + L.om * mx + _ax.y * sp + (Math.random() - 0.5) * 50;
        const lag = Math.random() * dt;                                // spread the frame's drops along the stream, not in one clump
        emit(_mw.x + evx * lag + (Math.random() - 0.5) * fs * 0.02, _mw.y + evy * lag + (Math.random() - 0.5) * fs * 0.02, _mw.z,
          evx, evy, (Math.random() - 0.5) * 30, fs * (0.016 + Math.random() * 0.02));
      }
    }
  }

  // ---------- gestures ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), _hp = new THREE.Vector3();
  const toWorld = (x, y) => {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(zPlane, _hp) ? { x: _hp.x, y: _hp.y } : { x: x - W / 2, y: H / 2 - y };
  };
  function hit(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(letters.flatMap((L) => [L.glass, L.neck]), false)[0];
    return h ? { L: letters.find((q) => q.glass === h.object || q.neck === h.object), x: h.point.x, y: h.point.y } : null;
  }
  const jiggle = (L, dir) => { L.om -= dir * 4.5; L.vx += dir * 260; L.vy += 120; };
  const refill = () => { for (const L of letters) if (L.fill < P.fill) L.refill = true; for (let i = 0; i < MAXD; i++) if (dAlive[i]) { dAlive[i] = 0; drops.setMatrixAt(i, ZERO); } };
  const press = pressTracker();
  let touched = false, fillStart = performance.now(), lastTap = -1, reform = 0, downL = null;
  const born = performance.now();
  let demoDone = !!stage.reduced;
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId)) return;
    touched = true; demoDone = true;
    const w = toWorld(q.x, q.y); mouse.x = w.x; mouse.y = w.y;
    const h = hit(q.x, q.y); downL = h ? h.L : null;
    if (h) {
      const L = h.L, dx = h.x - L.x, dy = h.y - L.y, c = Math.cos(L.th), s = Math.sin(L.th);
      L.grab = { lx: dx * c + dy * s, ly: -dx * s + dy * c };
    }
  }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    const w = toWorld(q.x, q.y); mouse.x = w.x; mouse.y = w.y;
    if (q.type === 'mouse' && !press.active) stage.root.style.cursor = hit(q.x, q.y) ? 'grab' : '';
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (!r) return;
    for (const L of letters) L.grab = null;
    const L = downL; downL = null;
    if (!r.tap) return;
    const now = performance.now();
    clearTimeout(reform);
    if (L) { lastTap = -1; jiggle(L, Math.sign(mouse.x - L.x) || 1); return; }
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) { lastTap = -1; reform = setTimeout(() => { if (alive && !stage.revealed) refill(); }, REFORM_DELAY_MS); }
    else lastTap = now;
  }));

  // ---------- reveal: the ink's surface in every letter, its fill and its neck ----------
  const _pr = new THREE.Vector3();
  const toScreen = (v) => { _pr.copy(v).project(camera); return [(_pr.x + 1) / 2 * W, (1 - _pr.y) / 2 * H]; };
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    c.lineWidth = 1;
    const _d = new THREE.Vector3();
    for (const L of letters) {
      // the volume samples the level is read from: under the surface solid, above it faint
      const n0 = L.plane.n.value, d0 = L.plane.d.value;
      for (let i = 0; i < L.nV; i += 2) {
        _d.set(L.vol[i * 3], L.vol[i * 3 + 1], L.vol[i * 3 + 2]).applyMatrix4(L.group.matrixWorld);
        const under = _d.dot(n0) <= d0, s2 = toScreen(_d);
        c.fillStyle = colr((under ? 0.85 : 0.25) * k); c.fillRect(s2[0] - 1, s2[1] - 1, 2, 2);
      }
      // the surface: the plane's line across the letter, through the point of the plane nearest the letter's centre
      const n = L.plane.n.value, d = L.plane.d.value - n.dot(L.group.position);
      const o = new THREE.Vector3(L.x, L.y, 0).addScaledVector(n, d), t = new THREE.Vector3(n.y, -n.x, 0).normalize().multiplyScalar(fs * 0.45);
      const a = toScreen(o.clone().sub(t)), b = toScreen(o.clone().add(t));
      c.strokeStyle = colr(0.9 * k); c.setLineDash([]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      const m = toScreen(L.mouth.clone().applyMatrix4(L.group.matrixWorld));
      c.strokeStyle = colr(0.7 * k); c.beginPath(); c.arc(m[0], m[1], 6, 0, Math.PI * 2); c.stroke();
      const g = toScreen(new THREE.Vector3(L.x, L.y, 0));
      c.setLineDash([3, 4]); c.beginPath(); c.moveTo(g[0], g[1]); c.lineTo(g[0] + n.x * 40, g[1] - n.y * 40); c.stroke(); c.setLineDash([]);
      label(c, `${Math.round(L.level * 100)}%`, b[0] + 6, b[1] - 4, colr, k);
    }
    titleBlock(c, W_, H_, ['GOBLET · STRUCTURE', '— the ink\'s surface (a plane that keeps the volume)', '· the volume samples it is read from', '○ the neck: under the surface, it pours', '┄ which way is up for the ink'], colr, k);
  }, { dim: 0.6 });

  // ---------- settings ----------
  const Ctl = (key2, label2, min, max, step) => ({ key: key2, label: label2, min, max, step });
  const REBUILD = new Set(['puff', 'depth', 'wall', 'tint']);
  const tune = {
    title: 'Goblet', values: P, defaults: DEF,
    groups: [
      { name: 'Bottles', items: [Ctl('fill', 'How full', 0.15, 0.9, 0.01), Ctl('puff', 'Chubbiness', 0.3, 1.6, 0.05), Ctl('depth', 'Depth', 0.3, 2, 0.05), Ctl('wall', 'Glass thickness', 0.006, 0.03, 0.001), Ctl('tint', 'Glass tint', 0, 1, 0.02)] },
      { name: 'Ink', items: [Ctl('wobble', 'Wobble speed', 0.3, 2.5, 0.05), Ctl('settle', 'Wobble settles', 0.02, 0.6, 0.01), Ctl('slosh', 'Slosh strength', 0, 3, 0.05), Ctl('pour', 'Pour rate', 0.2, 4, 0.05)] },
      { name: 'Motion', items: [Ctl('grav', 'Gravity', 0.3, 2.5, 0.05), Ctl('spring', 'Letter springiness', 0.3, 2, 0.05)] },
    ],
    set(key2, v) { P[key2] = v; if (REBUILD.has(key2)) build(); if (key2 === 'fill') refill(); },
    reset() { Object.assign(P, DEF); build(); },
  };

  // ---------- the frame ----------
  function frame(dt) {
    const now = performance.now();
    dt = Math.min(dt, 1 / 30);
    if (!touched && !demoDone && now - born > DEMO_AFTER) {           // the self-demo: the S is nudged once and sloshes
      demoDone = true; const L = letters.find((q) => q.ch === 'S') || letters[0]; if (L) jiggle(L, 1);
    }
    for (let k = 0; k < 3; k++) stepLetters(dt / 3);
    updateLevels(dt, now);
    stepDrops(dt);
    renderer.setViewport(0, 0, stage.pw, stage.ph);
    renderer.render(scene, camera);
    rv.draw(now);
  }

  build();
  offs.push(stage.frame((dt) => frame(dt)));
  let rt = 0; offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) build(); }, 120); }));

  return {
    tune,
    debug: { letters: () => letters, jiggle, refill, toWorld },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reform);
      rv.destroy(); offs.forEach((f) => f());
      clearLetters(); if (drops) root.remove(drops); dropGeo.dispose(); dropMat.dispose();
      envRT.dispose(); pmrem.dispose(); renderer.dispose();
      THREE.ShaderChunk.tonemapping_pars_fragment = chunk;
      stage.root.style.cursor = '';
      link.remove(); stage.setBackdrop(null);
    },
  };
}
