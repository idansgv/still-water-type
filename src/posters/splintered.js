// Splintered: a realistic render of Shatter's idea. The name is polished extruded type; a tap blows it apart from that point, the
// shards fly toward the lens, and time is directed: a forceful hit, then an ease into slow motion, so the depth of field comes
// into play as pieces pass the camera. Port of the test pages docs/posters/prototypes/explode-slomo.html and splintered-glass.html;
// Idan's tuning as the defaults, one set for each page (29 Oct 2026): on black the letters are bevelled glass (after the
// PP Fragment posters), on white they are porcelain.
//
// Under the picture (three.js 0.160, vendored): the letters are traced from Archivo Black (glyph-contours.js), given a rounded
// bevel round every contour, and cut into Voronoi shards at the moment of the tap (finer near the hit). Crack faces are their own
// material and glow, then cool. Motion is closed-form in simulated time (drift, spin, drag, gravity), so the clock can run at any
// speed, or backwards. The render is an HDR scene with a depth texture, then a gather depth of field at half size (with near-field
// spill), bloom and an ACES tone map, composited over the page colour. Metal reflects a black studio (softboxes, a horizon behind
// the camera); glass has only reflections, no diffuse, premultiplied so the page shows through, in a room lit from above and the
// sides with nothing behind the camera, so faces that look at you stay dark and the bevels catch the light.
//
// Gestures (src/gestures.js): tap a letter and it explodes from there (on black, a beat after the hit); tap a flying shard and
// the pieces are kicked again; tapping the background does nothing. Hold rewinds time and the shards fly back together. Double tap
// re-forms at once (after the re-form beat) and brings the camera home. Once it has burst the camera flies: drag turns round the
// flying pieces, the wheel or a pinch flies in and out (the lens widens and focus follows the middle of the frame), two fingers
// turn too. Reveal: the cut, drawn over the type: every shard's outline and the hit. One self-demo after 3.5 s untouched
// (explode, then rewind); off under reduced motion. Colour (native, when the shell rolls it): the first press anodises the type,
// or tints the glass's reflections, in the palette.

import * as THREE from '../vendor/three.module.min.js';
import { getGL } from '../engine.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';
import { glyphContours } from './glyph-contours.js';
import { colourOf } from '../colour.js';

const FAMILY = 'Archivo Black', NAME = 'IdanSegv';
const MATERIALS = ['chrome', 'graphite', 'black lacquer', 'white ceramic'];
// Idan's tunings from the test pages (29 Oct 2026): black is glass, white is porcelain
const DARK = { glass: 1, material: 0, depth: 0.05, bevel: 0.05, glassEnv: 3.6, glassRough: 0, clarity: 1, inner: 0.85,
  env: 2.95, exposure: 1.8, shadow: 0.25, wall: 0.02,
  pieces: 26, cluster: 0.24, force: 3.7, forward: 1.2, spread: 1, spin: 5.6, reach: 3.2, gravity: 0, drag: 0.31,
  hitSpeed: 1.15, hold: 0.04, ramp: 0.35, slow: 0.04, rewind: 1, crackTime: 0.16,
  lens: 69, aperture: 2.17, maxBlur: 22, follow: 0, yaw: 0, pitch: 0, shake: 0.6,
  flash: 25, glowLevel: 1.6, cool: 0.15, sparks: 220, bloom: 0.6, threshold: 2.5, res: 1.5 };
const LIGHT = { glass: 0, material: 3, depth: 0.05, bevel: 0, glassEnv: 1.6, glassRough: 0.03, clarity: 0.92, inner: 1,
  env: 2, exposure: 0.65, shadow: 0, wall: 0.31,
  pieces: 24, cluster: 0.24, force: 3.7, forward: 1.15, spread: 1, spin: 5.6, reach: 4.65, gravity: 0, drag: 0.31,
  hitSpeed: 1.15, hold: 0.04, ramp: 0.3, slow: 0.055, rewind: 1, crackTime: 0,
  lens: 69, aperture: 1.41, maxBlur: 36, follow: 0, yaw: 0, pitch: 0, shake: 1.55,
  flash: 25, glowLevel: 7.2, cool: 0.33, sparks: 270, bloom: 1.6, threshold: 3.05, res: 1.5 };
const DEMO_AFTER = 3.5, DEMO_REWIND = 6.5;

// ---------- geometry helpers: 2D polygons as arrays of [x, y] ----------
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
function clipHalf(poly, nx, ny, c) {                       // keep nx*x + ny*y <= c; points may carry more than x, y (all interpolate)
  const out = []; const L = poly.length;
  for (let i = 0; i < L; i++) {
    const a = poly[i], b = poly[(i + 1) % L];
    const da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push(a.map((v, j) => v + (b[j] - v) * t)); }
  }
  return out;
}
function clipConvex(poly, cell) {                          // poly against a convex counter-clockwise cell
  let out = poly;
  for (let i = 0; i < cell.length && out.length > 2; i++) {
    const p = cell[i], q = cell[(i + 1) % cell.length];
    const nx = q[1] - p[1], ny = -(q[0] - p[0]);
    out = clipHalf(out, nx, ny, nx * p[0] + ny * p[1]);
  }
  return out;
}
const boxOf = (poly) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of poly) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; };
const overlap = (A, B) => A[0] <= B[2] && B[0] <= A[2] && A[1] <= B[3] && B[1] <= A[3];
function distOutline(x, y, segs) {                       // distance to the nearest outline segment
  let best = 1e9;
  for (let i = 0; i < segs.length; i += 4) {
    const ax = segs[i], ay = segs[i + 1], ex = segs[i + 2] - ax, ey = segs[i + 3] - ay;
    const l2 = ex * ex + ey * ey, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
    const dx = x - ax - ex * t, dy = y - ay - ey * t, d = dx * dx + dy * dy; if (d < best) best = d;
  }
  return Math.sqrt(best);
}
const segsOf = (contours) => { const a = []; for (const c of contours) for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; a.push(p[0], p[1], q[0], q[1]); } return new Float64Array(a); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- post-processing shaders ----------
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const LIN = `uniform float cNear, cFar; float lin(float d){ return -(cNear * cFar) / ((cFar - cNear) * d - cFar); }
  uniform float focus, aperture, maxR; float coc(float z){ return clamp(aperture * abs(1.0 - focus / z), 0.0, 1.0) * maxR; }`;
const FS_DOF = `
  uniform sampler2D tCol, tDep; uniform vec2 texel; uniform float radScale; varying vec2 vUv; ${LIN}
  void main() {
    float zc = lin(texture2D(tDep, vUv).x); float cc = coc(zc);
    vec4 col = texture2D(tCol, vUv); float tot = 1.0; float r = radScale; float ang = 0.0;
    for (int i = 0; i < 360; i++) {
      if (r >= maxR) break;
      vec2 uv = vUv + vec2(cos(ang), sin(ang)) * texel * r;
      vec4 s = texture2D(tCol, uv); float zs = lin(texture2D(tDep, uv).x); float cs = coc(zs);
      if (zs > zc) cs = min(cs, cc * 2.0);
      float m = smoothstep(r - 0.5, r + 0.5, cs);
      col += mix(col / tot, s, m); tot += 1.0; r += radScale / r; ang += 2.39996323;
    }
    gl_FragColor = col / tot;
  }`;
const FS_BRIGHT = `uniform sampler2D t; uniform float thr; varying vec2 vUv;
  void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * max(l - thr, 0.0) / max(l, 1e-4), 1.0); }`;
const FS_DOWN = `uniform sampler2D t; uniform vec2 texel; varying vec2 vUv;
  void main(){ vec3 c = texture2D(t, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(t, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(t, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(t, vUv + texel * vec2(1.0, 1.0)).rgb; gl_FragColor = vec4(c * 0.25, 1.0); }`;
const FS_UP = `uniform sampler2D t, tAdd; uniform vec2 texel; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(t, vUv).rgb * 4.0;
    c += (texture2D(t, vUv + texel * vec2(-1.0, 0.0)).rgb + texture2D(t, vUv + texel * vec2(1.0, 0.0)).rgb + texture2D(t, vUv + texel * vec2(0.0, -1.0)).rgb + texture2D(t, vUv + texel * vec2(0.0, 1.0)).rgb) * 2.0;
    c += texture2D(t, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(t, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(t, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(t, vUv + texel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(c / 16.0 + texture2D(tAdd, vUv).rgb, 1.0);
  }`;
const FS_FINAL = `
  uniform sampler2D tScene, tDep, tDof, tBloom; uniform vec2 texelHalf; uniform float bloom, exposure; uniform vec3 bg; varying vec2 vUv; ${LIN}
  vec3 aces(vec3 c){
    const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    c = I * (c / 0.6); vec3 a = c * (c + 0.0245786) - 0.000090537; vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081; return clamp(O * (a / b), 0.0, 1.0);
  }
  vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main(){
    float zc = lin(texture2D(tDep, vUv).x);
    float f = smoothstep(0.35, 1.4, coc(zc));
    for (int k = 0; k < 12; k++) {                         // a blurred near shard spills over what is behind it
      float a = float(k) * 2.39996323; float rr = maxR * (k < 6 ? 0.4 : 0.85);
      vec2 o = vec2(cos(a), sin(a)) * rr;
      float zs = lin(texture2D(tDep, vUv + o * texelHalf).x);
      if (zs < zc) f = max(f, smoothstep(rr - 1.0, rr + 1.0, coc(zs)));
    }
    vec4 c = mix(texture2D(tScene, vUv), texture2D(tDof, vUv), f);
    vec3 L = c.rgb + texture2D(tBloom, vUv).rgb * bloom;
    vec3 outc = aces(L * exposure) + bg * (1.0 - clamp(c.a, 0.0, 1.0));
    gl_FragColor = vec4(srgb(clamp(outc, 0.0, 1.0)), 1.0);
  }`;

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';
  const DEF = dark ? DARK : LIGHT;
  const P = { ...DEF };
  const offs = [];
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);

  // ---------- the face: Archivo Black from Google Fonts, only the letters of the name ----------
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${FAMILY.replace(/ /g, '+')}&text=${encodeURIComponent(NAME)}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(`400 100px "${FAMILY}"`, 'Idan Segev'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }
  const FACE = `"${FAMILY}", "Arial Black"`;

  // ---------- renderer and scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // the studio for reflections: black, a few softboxes and a bright horizon behind the camera, so polished faces show hard light and dark
  const studio = new THREE.Scene();
  const box = (w, h, x, y, z, v, at) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.material.color.setScalar(v); m.position.set(x, y, z); m.lookAt(at || new THREE.Vector3()); studio.add(m); };
  box(14, 4, 0, 7, 5, 5);                                            // overhead softbox, front
  box(1.2, 10, -7, 0, 4, 9);                                         // tall strip, left
  box(1.2, 8, 7.5, 1, -1, 4);                                        // strip, right and behind
  box(40, 12, 0, 6, 9, 1.4, new THREE.Vector3(0, 6, 0));             // horizon behind the camera at eye level: bright above
  box(40, 12, 0, -6.02, 9, 0.06, new THREE.Vector3(0, -6.02, 0));    // the ground under it, barely lit
  box(4, 4, 3, -6, 6, 0.5);                                          // faint bounce from below right
  const envRT = pmrem.fromScene(studio, 0.02);
  scene.environment = envRT.texture;
  studio.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  // the glass's own room: a ceiling and two tall strips, nothing behind the camera; inverted on white (white room, black strips)
  const gStudio = new THREE.Scene(); gStudio.background = new THREE.Color(dark ? 0x000000 : 0xffffff);
  const gbox = (w, h, x, y, z, v) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.material.color.setScalar(dark ? v : Math.max(0, 1 - v / 3)); m.position.set(x, y, z); m.lookAt(new THREE.Vector3()); gStudio.add(m); };
  gbox(40, 24, 0, 10, 0, 2.6);                                       // ceiling: top edges catch it, faces that look at you don't
  gbox(1.6, 18, -9, 0, 2, 6);                                        // tall strip, left
  gbox(1.2, 18, 9, -1, 1, 3);                                        // tall strip, right, dimmer
  gbox(36, 1, 0, -8, 2, 0.8);                                        // faint strip below
  const glassEnvRT = pmrem.fromScene(gStudio, 0.02);
  gStudio.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.015;
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  const flash = new THREE.PointLight(0xffffff, 0, 0, 2);
  scene.add(key, key.target, rim, flash);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: P.shadow }));
  wall.receiveShadow = true; scene.add(wall);

  const outerMat = new THREE.MeshPhysicalMaterial(), innerMat = new THREE.MeshPhysicalMaterial();
  const MATS = [outerMat, innerMat];
  function applyMaterial() {
    const set = (m, o) => { m.color.set(o.color); m.metalness = o.metal; m.roughness = o.rough; m.clearcoat = o.coat || 0; m.clearcoatRoughness = 0.04; m.envMapIntensity = P.env; m.needsUpdate = true; };
    const which = MATERIALS[Math.round(P.material)] || 'chrome';
    if (which === 'chrome') { set(outerMat, { color: 0xf4f4f4, metal: 1, rough: 0.07 }); set(innerMat, { color: 0xcfcfcf, metal: 1, rough: 0.42 }); }
    else if (which === 'graphite') { set(outerMat, { color: 0x3a3a3a, metal: 1, rough: 0.22, coat: 0.6 }); set(innerMat, { color: 0x2a2a2a, metal: 1, rough: 0.6 }); }
    else if (which === 'black lacquer') { set(outerMat, { color: 0x060606, metal: 0, rough: 0.14, coat: 1 }); set(innerMat, { color: 0x101010, metal: 0, rough: 0.7 }); }
    else { set(outerMat, { color: 0xf2f2f2, metal: 0, rough: 0.28, coat: 1 }); set(innerMat, { color: 0xdedede, metal: 0, rough: 0.85 }); }
    innerMat.emissive.set(0xffffff);
    outerBase.copy(outerMat.color); innerBase.copy(innerMat.color);
  }
  const outerBase = new THREE.Color(), innerBase = new THREE.Color(), tint = new THREE.Color();
  const colour = colourOf(stage);
  if (colour) { colour.wakeOnPress(); const [r, g, b] = colour.rgb(0.4); tint.setRGB(r, g, b, THREE.SRGBColorSpace); }
  applyMaterial();

  // glass: no diffuse, only reflections; what is behind shows through. Premultiplied, so the page colour comes through alpha. Back
  // faces draw first (three's two passes for double-sided transparent), which gives the inner edges seen through the front.
  const glassU = { uClar: { value: 1 }, uInner: { value: 1 } };
  function glassMaterial() {
    const m = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, ior: 1.5, side: THREE.DoubleSide, transparent: true, depthWrite: true });
    m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    m.envMap = glassEnvRT.texture;
    m.customProgramCacheKey = () => 'splintered-glass';
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, glassU);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uClar, uInner;').replace('#include <opaque_fragment>', `
        float NdV = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        float Fr = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
        float a = max(1.0 - uClar * (1.0 - Fr), clamp(dot(totalEmissiveRadiance, vec3(0.3)), 0.0, 1.0));
        gl_FragColor = vec4(outgoingLight * (gl_FrontFacing ? 1.0 : uInner), a);`);
    };
    return m;
  }
  const glassOuter = glassMaterial(), glassInner = glassMaterial();
  glassInner.emissive.set(0xffffff);
  const GMATS = [glassOuter, glassInner];
  function applyGlass() {
    glassU.uClar.value = P.clarity; glassU.uInner.value = P.inner;
    for (const m of GMATS) { m.envMapIntensity = P.glassEnv; m.roughness = P.glassRough; }
  }
  applyGlass();

  // sparks: analytic points, bright, so the lens turns the near ones into bokeh discs
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { tau: { value: 0 }, drag: { value: 0.5 }, grav: { value: 1 }, scale: { value: 300 }, impact: { value: new THREE.Vector3() }, col: { value: new THREE.Color(4, 4, 4) } },
    vertexShader: `
      attribute vec3 dir; attribute float life; attribute float sz;
      uniform float tau, drag, grav, scale; uniform vec3 impact; varying float vI;
      void main() {
        float k = drag * 2.0 + 0.6; float E = exp(-k * tau); float f1 = (1.0 - E) / k;
        vec3 p = impact + dir * f1 + vec3(0.0, -grav, 0.0) * (tau - f1) / k;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vI = exp(-tau / life) * smoothstep(0.0, 0.004, tau);
        gl_PointSize = max(1.5, sz * scale / -mv.z);
      }`,
    fragmentShader: `
      uniform vec3 col; varying float vI;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        if (d > 0.5 || vI < 0.01) discard;
        gl_FragColor = vec4(col * vI * (1.0 - d * 1.4), 1.0);
      }`,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    depthWrite: true, transparent: true,
  });
  const sparkGeo = new THREE.BufferGeometry();
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false; sparks.visible = false;
  scene.add(sparks);

  // ---------- the name: traced outlines, triangulated, in em units (the test page's units, so the tuning carries over) ----------
  let glyphs = [], textBox = [0, 0, 1, 1], twoLines = null;
  function layoutText() {
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = `400 100px ${FACE}`;
    const capEm = (mc.measureText('H').actualBoundingBoxAscent || 72) / 100;
    const lines = twoLines ? ['Idan', 'Segev'] : ['Idan Segev'];
    glyphs = [];
    lines.forEach((line, li) => {
      const w = mc.measureText(line).width / 100;
      const baseY = -((li - (lines.length - 1) / 2) * 0.92 + 0.35);
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]; if (ch === ' ') continue;
        const m = mc.measureText(ch);
        const cx = -w / 2 + mc.measureText(line.slice(0, i)).width / 100 + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 200;
        const gc = glyphContours(ch, FACE, 400, 200, 0.03);
        const contours = gc.loops.map((l) => l.pts.map((p) => [cx + p[0] * capEm, baseY + (p[1] + 0.5) * capEm]));
        if (!contours.length) continue;
        const depth = contours.map((c, k) => contours.reduce((n, d, j) => n + (j !== k && pip(c[0], d) ? 1 : 0), 0));
        const tris = [];
        contours.forEach((c, k) => {
          if (depth[k] % 2) return;
          const holes = contours.filter((h, j) => depth[j] === depth[k] + 1 && pip(h[0], c));
          const all = [c, ...holes].flat();
          const faces = THREE.ShapeUtils.triangulateShape(c.map((p) => new THREE.Vector2(p[0], p[1])), holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1]))));
          for (const f of faces) {
            let t = [all[f[0]], all[f[1]], all[f[2]]];
            const a = area2(t);
            if (Math.abs(a) < 1e-9) continue;
            if (a < 0) t = [t[0], t[2], t[1]];
            tris.push(t);
          }
        });
        const flat = contours.flat();
        glyphs.push({ contours, tris, box: boxOf(flat), segs: segsOf(contours), solid: buildSolid(contours, depth) });
      }
    });
    textBox = glyphs.reduce((b, g) => [Math.min(b[0], g.box[0]), Math.min(b[1], g.box[1]), Math.max(b[2], g.box[2]), Math.max(b[3], g.box[3])], [1e9, 1e9, -1e9, -1e9]);
  }

  // ---------- the bevelled solid: a rounded bevel round every contour, flat faces inside it. Triangles carry [x, y, z, nx, ny, nz]
  // so the fracture clips them like the flat ones ----------
  const bevelDims = () => { const h = P.depth / 2, s = Math.max(1e-4, P.bevel), t = Math.max(1e-4, Math.min(P.bevel, h * 0.9)); return { h, s, t, zb: h - t }; };
  function buildSolid(contours, par) {
    const { h, s, t, zb } = bevelDims(), K = P.bevel > 0.002 ? 6 : 1;
    const tris = [], insets = [];
    contours.forEach((c) => {
      const n = c.length;
      let left = 0;                                        // is the letter on the left of this contour?
      for (let k2 = 0; k2 < 3; k2++) {
        const i = Math.floor(k2 * n / 3), a = c[i], b = c[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
        left += insideGlyph([(a[0] + b[0]) / 2 - ey / l * 1e-3, (a[1] + b[1]) / 2 + ex / l * 1e-3], contours) ? 1 : -1;
      }
      const sg = left > 0 ? 1 : -1, o = [], m = [], vn = [], sm = [];
      for (let i = 0; i < n; i++) { const a = c[i], b = c[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1; o.push([sg * ey / l, -sg * ex / l]); }
      for (let i = 0; i < n; i++) {
        const p = o[(i - 1 + n) % n], q = o[i], L = Math.hypot(p[0] + q[0], p[1] + q[1]);
        const f = L < 1e-6 ? 0 : Math.min(2.5, 2 / L) / L;   // miter, clamped at sharp corners
        m.push(L < 1e-6 ? [-q[0], -q[1]] : [-(p[0] + q[0]) * f, -(p[1] + q[1]) * f]);
        vn.push(L < 1e-6 ? q : [(p[0] + q[0]) / L, (p[1] + q[1]) / L]);
        sm.push(p[0] * q[0] + p[1] * q[1] > 0.82);         // smooth normals round gentle turns, crisp at corners
      }
      insets.push(c.map((pt, i) => [pt[0] + m[i][0] * s, pt[1] + m[i][1] * s]));
      const ring = (pt, mm, nn, k2, side) => {
        const th = k2 / K * Math.PI / 2, cs = Math.cos(th), sn = Math.sin(th);
        const nx = nn[0] * cs * t, ny = nn[1] * cs * t, nz = sn * s * side, nl = Math.hypot(nx, ny, nz) || 1;
        return [pt[0] + mm[0] * s * (1 - cs), pt[1] + mm[1] * s * (1 - cs), side * (zb + t * sn), nx / nl, ny / nl, nz / nl];
      };
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, nA = sm[i] ? vn[i] : o[i], nB = sm[j] ? vn[j] : o[i], P0 = c[i], P1 = c[j];
        const w = (pt, nn, z) => [pt[0], pt[1], z, nn[0], nn[1], 0];
        tris.push([w(P0, nA, -zb), w(P1, nB, -zb), w(P1, nB, zb)], [w(P0, nA, -zb), w(P1, nB, zb), w(P0, nA, zb)]);
        for (const side of [1, -1]) for (let k2 = 0; k2 < K; k2++) {
          const a0 = ring(P0, m[i], nA, k2, side), b0 = ring(P1, m[j], nB, k2, side), a1 = ring(P0, m[i], nA, k2 + 1, side), b1 = ring(P1, m[j], nB, k2 + 1, side);
          tris.push([a0, b0, b1], [a0, b1, a1]);
        }
      }
    });
    const v2 = (p) => new THREE.Vector2(p[0], p[1]);
    contours.forEach((c, i) => {
      if (par[i] % 2) return;
      const hs = contours.map((d, j) => j).filter((j) => par[j] === par[i] + 1 && pip(contours[j][0], c)).map((j) => insets[j]);
      const all = [insets[i], ...hs].flat();
      for (const f of THREE.ShapeUtils.triangulateShape(insets[i].map(v2), hs.map((x) => x.map(v2)))) for (const side of [1, -1]) {
        const v = (q) => [q[0], q[1], side * h, 0, 0, side];
        tris.push([v(all[f[0]]), v(all[f[1]]), v(all[f[2]])]);
      }
    });
    return { tris, boxes: tris.map(boxOf) };
  }

  // ---------- fracture: Voronoi cells (finer near the hit) clipped against the glyph triangles ----------
  function fracture(ix, iy) {
    const total = Math.round(P.pieces * glyphs.length);
    const r0 = Math.max(0.3, P.reach * 0.35);
    const weight = (x, y) => (1 - P.cluster) * 0.25 + P.cluster * Math.exp(-Math.hypot(x - ix, y - iy) / r0) + 0.02;
    const seeds = glyphs.map(() => []);
    const [bx0, by0, bx1, by1] = textBox;
    let tries = 0, got = 0;
    while (got < total && tries < total * 400) {
      tries++;
      const x = bx0 + Math.random() * (bx1 - bx0), y = by0 + Math.random() * (by1 - by0);
      if (Math.random() > weight(x, y)) continue;
      const gi = glyphs.findIndex((g) => x >= g.box[0] && x <= g.box[2] && y >= g.box[1] && y <= g.box[3] && insideGlyph([x, y], g.contours));
      if (gi < 0) continue;
      seeds[gi].push([x, y]); got++;
    }
    const out = [];
    glyphs.forEach((g, gi) => {
      const S = seeds[gi];
      for (let guard = 0; S.length < 3 && guard < 500; guard++) { const x = g.box[0] + Math.random() * (g.box[2] - g.box[0]), y = g.box[1] + Math.random() * (g.box[3] - g.box[1]); if (insideGlyph([x, y], g.contours)) S.push([x, y]); }
      const pad = 0.05, R = [[g.box[0] - pad, g.box[1] - pad], [g.box[2] + pad, g.box[1] - pad], [g.box[2] + pad, g.box[3] + pad], [g.box[0] - pad, g.box[3] + pad]];
      const triBoxes = g.tris.map(boxOf);
      S.forEach((s, i) => {
        let cell = R;
        for (let j = 0; j < S.length && cell.length > 2; j++) {
          if (j === i) continue;
          const t = S[j];
          cell = clipHalf(cell, t[0] - s[0], t[1] - s[1], (t[0] * t[0] + t[1] * t[1] - s[0] * s[0] - s[1] * s[1]) / 2);
        }
        if (cell.length < 3) return;
        const cb = boxOf(cell), polys = [];
        g.tris.forEach((t, k) => {
          if (!overlap(cb, triBoxes[k])) return;
          const p = clipConvex(t, cell);
          if (p.length > 2 && area2(p) > 1e-8) polys.push(p);
        });
        if (!polys.length) return;
        const solid = [];
        g.solid.tris.forEach((t, k2) => { if (!overlap(cb, g.solid.boxes[k2])) return; const p = clipConvex(t, cell); if (p.length > 2) solid.push(p); });
        out.push(makePiece(polys, solid, g));
      });
    });
    return out;
  }

  function makePiece(polys, solid, g) {
    let A = 0, cx = 0, cy = 0;
    for (const p of polys) for (let i = 1; i < p.length - 1; i++) {
      const a = ((p[i][0] - p[0][0]) * (p[i + 1][1] - p[0][1]) - (p[i + 1][0] - p[0][0]) * (p[i][1] - p[0][1])) / 2;
      A += a; cx += a * (p[0][0] + p[i][0] + p[i + 1][0]) / 3; cy += a * (p[0][1] + p[i][1] + p[i + 1][1]) / 3;
    }
    cx /= A; cy /= A;
    const q = (v) => Math.round(v * 2e4);
    const edges = new Map();
    for (const p of polys) for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      if (q(a[0]) === q(b[0]) && q(a[1]) === q(b[1])) continue;
      edges.set(q(a[0]) + ',' + q(a[1]) + '|' + q(b[0]) + ',' + q(b[1]), [a, b]);
    }
    const { h, s, t, zb } = bevelDims();
    const O = [], ON = [], I = [], IN = [], outline = [];
    const tri = (V, N, a, b, c) => {                       // one triangle, wound to face the way its normals point
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const flip = (uy * vz - uz * vy) * (a[3] + b[3] + c[3]) + (uz * vx - ux * vz) * (a[4] + b[4] + c[4]) + (ux * vy - uy * vx) * (a[5] + b[5] + c[5]) < 0;
      for (const p of flip ? [a, c, b] : [a, b, c]) { const nl = Math.hypot(p[3], p[4], p[5]) || 1; V.push(p[0] - cx, p[1] - cy, p[2]); N.push(p[3] / nl, p[4] / nl, p[5] / nl); }
    };
    for (const p of solid) for (let i = 1; i < p.length - 1; i++) tri(O, ON, p[0], p[i], p[i + 1]);
    // crack walls: as tall as the solid, which thins over the bevel near the outline
    const zAt = (x, y) => { const d = distOutline(x, y, g.segs); if (d >= s) return h; const c = 1 - d / s; return zb + t * Math.sqrt(Math.max(0, 1 - c * c)); };
    for (const [key2, [a, b]] of edges) {
      const [ks, ke] = key2.split('|');
      if (edges.has(ke + '|' + ks)) continue;              // shared inside the shard
      let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny); nx /= l; ny /= l;
      const crack = insideGlyph([(a[0] + b[0]) / 2 + nx * 0.004, (a[1] + b[1]) / 2 + ny * 0.004], g.contours);
      outline.push(a[0] - cx, a[1] - cy, b[0] - cx, b[1] - cy, crack ? 1 : 0);
      if (!crack) continue;                                // the outline: the solid has it
      const da = distOutline(a[0], a[1], g.segs) < s, db = distOutline(b[0], b[1], g.segs) < s;
      const us = [0, 1], span = Math.min(0.5, 1.6 * s / l);
      for (let j = 1; j <= 6; j++) { const u = span * (j / 6) ** 2; if (da) us.push(u); if (db) us.push(1 - u); }
      us.sort((x, y) => x - y);
      const pts = us.map((u) => { const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u; return [x, y, zAt(x, y)]; });
      const v = (r, z) => [r[0], r[1], z, nx, ny, 0];
      for (let j = 0; j < pts.length - 1; j++) {
        const p = pts[j], r = pts[j + 1];
        tri(I, IN, v(p, -p[2]), v(r, -r[2]), v(r, r[2])); tri(I, IN, v(p, -p[2]), v(r, r[2]), v(p, p[2]));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(O.concat(I), 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(ON.concat(IN), 3));
    geo.addGroup(0, O.length / 3, 0); geo.addGroup(O.length / 3, I.length / 3, 1);
    const mesh = new THREE.Mesh(geo, P.glass ? GMATS : MATS);
    mesh.castShadow = !P.glass; mesh.receiveShadow = !P.glass;
    mesh.position.set(cx, cy, 0);
    return { mesh, area: A, outline, home: new THREE.Vector3(cx, cy, 0), p0: new THREE.Vector3(cx, cy, 0), v0: new THREE.Vector3(), q0: new THREE.Quaternion(), w: new THREE.Vector3(), moving: false };
  }

  // ---------- motion: closed form in simulated time, so time can run at any speed, or backwards ----------
  let pieces = [], avgArea = 1;
  const group = new THREE.Group(); scene.add(group);
  function setPieces(list) {
    for (const p of pieces) { group.remove(p.mesh); p.mesh.geometry.dispose(); }
    pieces = list; for (const p of pieces) group.add(p.mesh);
    avgArea = pieces.reduce((s, p) => s + p.area, 0) / Math.max(1, pieces.length);
  }
  const kRot = () => P.drag * 1.5 + 0.15;
  const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
  function poseAt(pc, t, outP, outQ, outV, outW) {
    const k = P.drag, g = pc.moving ? P.gravity : 0;
    let f1, f2, E;
    if (k < 1e-4) { f1 = t; f2 = t * t / 2; E = 1; } else { E = Math.exp(-k * t); f1 = (1 - E) / k; f2 = (t - f1) / k; }
    outP.set(pc.p0.x + pc.v0.x * f1, pc.p0.y + pc.v0.y * f1 - g * f2, pc.p0.z + pc.v0.z * f1);
    const wl = pc.w.length(), kr = kRot();
    if (wl > 1e-6) { _ax.copy(pc.w).divideScalar(wl); _q.setFromAxisAngle(_ax, wl * (1 - Math.exp(-kr * t)) / kr); outQ.multiplyQuaternions(_q, pc.q0); }
    else outQ.copy(pc.q0);
    if (outV) outV.set(pc.v0.x * E, pc.v0.y * E - g * f1, pc.v0.z * E);
    if (outW) outW.copy(pc.w).multiplyScalar(Math.exp(-kr * t));
  }

  let mode = 'rest';                                       // rest | crack (the hit has landed, nothing moves yet) | go
  let crackT = 0;
  let tau = 0, tr = 0, tauDone = 0;                        // sim time in this base, real time since its kick, sim time of earlier bases
  let stack = [];                                          // earlier bases, so a hold can rewind past a second tap
  const impact = new THREE.Vector3();
  let rewinding = false, heldFor = 0, hero = null, rackT = 0;

  function sparkBurst(at) {
    const n = Math.round(P.sparks);
    const dir = new Float32Array(n * 3), life = new Float32Array(n), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const sp = P.force * (0.5 + Math.random() * 1.6);
      dir[i * 3] = s * Math.cos(a) * sp * (0.6 + P.spread * 0.6); dir[i * 3 + 1] = s * Math.sin(a) * sp * (0.6 + P.spread * 0.6); dir[i * 3 + 2] = (Math.abs(u) * 0.7 + 0.3) * sp * (0.5 + P.forward * 0.7);
      life[i] = 0.05 + Math.random() * 0.3; sz[i] = 0.008 + Math.random() * Math.random() * 0.03;
    }
    for (const nm of ['dir', 'life', 'sz', 'position']) sparkGeo.deleteAttribute(nm);
    sparkGeo.setAttribute('dir', new THREE.BufferAttribute(dir, 3));
    sparkGeo.setAttribute('life', new THREE.BufferAttribute(life, 1));
    sparkGeo.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    sparkGeo.setDrawRange(0, n);
    sparkMat.uniforms.impact.value.copy(at);
  }

  const _P = new THREE.Vector3(), _Q = new THREE.Quaternion(), _V = new THREE.Vector3(), _W = new THREE.Vector3();
  function kickFrom(at, strength, fresh) {
    if (!fresh) stack.push({ tau, base: pieces.map((p) => ({ p0: p.p0.clone(), v0: p.v0.clone(), q0: p.q0.clone(), w: p.w.clone(), moving: p.moving })), impact: impact.clone(), sparks: { dir: sparkGeo.getAttribute('dir'), life: sparkGeo.getAttribute('life'), sz: sparkGeo.getAttribute('sz'), pos: sparkGeo.getAttribute('position') } });
    for (const p of pieces) {
      if (!fresh) { poseAt(p, tau, _P, _Q, _V, _W); p.p0.copy(_P); p.q0.copy(_Q); p.v0.copy(_V); p.w.copy(_W); }
      const dx = p.p0.x - at.x, dy = p.p0.y - at.y, dz = p.p0.z - at.z;
      const d = Math.hypot(dx, dy, dz) + 0.05;
      const fall = Math.exp(-d / P.reach);
      const sp = P.force * strength * fall * (0.55 + Math.random() * 0.9) * Math.pow(p.area / avgArea, -0.22);
      if (sp < 0.12) continue;
      const dir = new THREE.Vector3((dx / d) * P.spread * (0.6 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5, (dy / d) * P.spread * (0.6 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5, P.forward * (0.5 + Math.random())).normalize();
      p.v0.addScaledVector(dir, sp);
      p.w.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(P.spin * fall * strength * (0.3 + Math.random())));
      p.moving = true;
    }
    if (!fresh) tauDone += tau;
    impact.copy(at); tau = 0; tr = 0; mode = 'go';
    sparkBurst(at);
    const cand = pieces.filter((p) => p.moving && p.area > avgArea * 0.8).sort((a, b) => b.v0.z - a.v0.z);
    hero = cand[Math.min(cand.length - 1, 2)] || null;     // the shard the lens may follow: a good-sized one heading for the camera
  }
  function explode(at) {
    setPieces(fracture(at.x, at.y));
    stack = []; tauDone = 0; tau = 0; tr = 0;
    impact.copy(at); crackT = 0; mode = 'crack';
    if (P.crackTime <= 0) kickFrom(at, 1, true);
  }
  function reform() {
    camT.yaw = camT.pitch = camT.zoom = 0;
    for (const p of pieces) { p.p0.copy(p.home); p.v0.set(0, 0, 0); p.q0.identity(); p.w.set(0, 0, 0); p.moving = false; p.mesh.position.copy(p.home); p.mesh.quaternion.identity(); p.mesh.visible = true; }
    stack = []; tau = 0; tauDone = 0; tr = 0; mode = 'rest'; rewinding = false;
  }
  function popBase() {
    const b = stack.pop();
    tauDone -= b.tau;
    pieces.forEach((p, i) => { const s = b.base[i]; p.p0.copy(s.p0); p.v0.copy(s.v0); p.q0.copy(s.q0); p.w.copy(s.w); p.moving = s.moving; });
    impact.copy(b.impact); sparkMat.uniforms.impact.value.copy(b.impact);
    sparkGeo.setAttribute('dir', b.sparks.dir); sparkGeo.setAttribute('life', b.sparks.life); sparkGeo.setAttribute('sz', b.sparks.sz); sparkGeo.setAttribute('position', b.sparks.pos);
    sparkGeo.setDrawRange(0, b.sparks.dir.count);
    tau = b.tau; tr = 99;
  }
  function rate() {                                        // simulated seconds per real second
    if (rewinding) return -P.rewind * (0.12 + 1.3 * smooth(0, 1.1, heldFor));
    if (tr < P.hold) return P.hitSpeed;
    return P.slow + (P.hitSpeed - P.slow) * (1 - smooth(P.hold, P.hold + P.ramp, tr));
  }

  // ---------- post: HDR scene with depth, depth of field, bloom, tone map ----------
  const FS = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const fsScene = new THREE.Scene(); fsScene.add(FS);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const camU = () => ({ cNear: { value: camera.near }, cFar: { value: camera.far }, focus: { value: 10 }, aperture: { value: 1 }, maxR: { value: 10 } });
  const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const dofMat = mat(FS_DOF, { tCol: { value: null }, tDep: { value: null }, texel: { value: new THREE.Vector2() }, radScale: { value: 1 }, ...camU() });
  const brightMat = mat(FS_BRIGHT, { t: { value: null }, thr: { value: 1 } });
  const downMat = mat(FS_DOWN, { t: { value: null }, texel: { value: new THREE.Vector2() } });
  const upMat = mat(FS_UP, { t: { value: null }, tAdd: { value: null }, texel: { value: new THREE.Vector2() } });
  const finalMat = mat(FS_FINAL, { tScene: { value: null }, tDep: { value: null }, tDof: { value: null }, tBloom: { value: null }, texelHalf: { value: new THREE.Vector2() }, bloom: { value: 1 }, exposure: { value: 1 }, bg: { value: new THREE.Vector3() }, ...camU() });
  const POST = [dofMat, brightMat, downMat, upMat, finalMat];

  let rtScene = null, rtDof = null, rtBright = null, downs = [], ups = [], W = 1, H = 1, k = 1;
  const hf = (w, h) => new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, depthBuffer: false });
  function makeTargets() {
    [rtScene, rtDof, rtBright, ...downs, ...ups].forEach((t) => t && t.dispose());
    if (rtScene) rtScene.depthTexture.dispose();
    const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    rtScene.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    rtDof = hf(hw, hh); rtBright = hf(hw, hh);
    downs = []; ups = [];
    let dw = hw, dh = hh;
    for (let i = 0; i < 5; i++) { dw = Math.ceil(dw / 2); dh = Math.ceil(dh / 2); downs.push(hf(dw, dh)); ups.push(hf(dw, dh)); }
  }
  function blit(m, target) { FS.material = m; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }
  function renderFrame(focusDist) {
    const maxRHalf = P.maxBlur * k / 2;
    for (const m of [dofMat, finalMat]) { m.uniforms.focus.value = focusDist; m.uniforms.aperture.value = P.aperture; m.uniforms.maxR.value = maxRHalf; m.uniforms.cNear.value = camera.near; m.uniforms.cFar.value = camera.far; }
    renderer.setRenderTarget(rtScene); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    dofMat.uniforms.tCol.value = rtScene.texture; dofMat.uniforms.tDep.value = rtScene.depthTexture;
    dofMat.uniforms.texel.value.set(1 / rtDof.width, 1 / rtDof.height); dofMat.uniforms.radScale.value = Math.max(0.7, maxRHalf / 11);
    blit(dofMat, rtDof);
    brightMat.uniforms.t.value = rtDof.texture; brightMat.uniforms.thr.value = P.threshold; blit(brightMat, rtBright);
    let src = rtBright;
    for (const d of downs) { downMat.uniforms.t.value = src.texture; downMat.uniforms.texel.value.set(0.5 / src.width, 0.5 / src.height); blit(downMat, d); src = d; }
    let lower = downs[downs.length - 1];
    for (let i = downs.length - 2; i >= 0; i--) {
      upMat.uniforms.t.value = lower.texture; upMat.uniforms.tAdd.value = downs[i].texture;
      upMat.uniforms.texel.value.set(1 / lower.width, 1 / lower.height);
      blit(upMat, ups[i]); lower = ups[i];
    }
    const f = finalMat.uniforms;
    f.tScene.value = rtScene.texture; f.tDep.value = rtScene.depthTexture; f.tDof.value = rtDof.texture; f.tBloom.value = ups[0].texture;
    f.texelHalf.value.set(1 / rtDof.width, 1 / rtDof.height);
    f.bloom.value = P.bloom * 0.35; f.exposure.value = P.exposure;
    const b = dark ? 0 : 1; f.bg.value.set(b, b, b);
    renderer.setViewport(0, 0, stage.pw, stage.ph);
    blit(finalMat, null);
  }

  // ---------- camera, lights, layout ----------
  let camDist = 10, camR = 10, afD = 10;
  const target = new THREE.Vector3(), _fw = new THREE.Vector3(), _p = new THREE.Vector3();
  const cam = { yaw: 0, pitch: 0, zoom: 0 }, camT = { yaw: 0, pitch: 0, zoom: 0 };   // the flown camera (zoom: log of distance), and where it eases to
  const piv = new THREE.Vector3(), cloud = new THREE.Vector3(), _sum = new THREE.Vector3();
  const flown = () => Math.abs(cam.zoom) > 0.02 || Math.abs(cam.yaw) > 0.5 || Math.abs(cam.pitch) > 0.5;
  function placeCamera(shakeAmt = 0) {
    const fov = 2 * Math.atan(12 / P.lens) * 180 / Math.PI;
    camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
    const tw = (textBox[2] - textBox[0]) / 0.78, th = (textBox[3] - textBox[1]) / 0.62;
    const vt = Math.tan(fov * Math.PI / 360);
    camDist = Math.max(th / 2 / vt, tw / 2 / (vt * camera.aspect));
    target.set((textBox[0] + textBox[2]) / 2, (textBox[1] + textBox[3]) / 2, 0);
    const yaw = (P.yaw + cam.yaw) * Math.PI / 180, pitch = (P.pitch + cam.pitch) * Math.PI / 180;
    camR = camDist * Math.exp(-cam.zoom);
    // flying in: turn round the middle of the flying pieces, not the empty spot where the name was, and widen the lens
    piv.copy(target).lerp(cloud, Math.min(1, Math.max(0, cam.zoom)));
    camera.fov = 2 * Math.atan(12 / Math.max(18, P.lens * Math.exp(-Math.max(0, cam.zoom) * 0.45))) * 180 / Math.PI; camera.updateProjectionMatrix();
    camera.position.set(piv.x + Math.sin(yaw) * Math.cos(pitch) * camR, piv.y + Math.sin(pitch) * camR, piv.z + Math.cos(yaw) * Math.cos(pitch) * camR);
    if (shakeAmt) camera.position.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).multiplyScalar(shakeAmt));
    camera.lookAt(piv);
    camera.updateMatrixWorld();
    sparkMat.uniforms.scale.value = H * k / (2 * Math.tan(camera.fov * Math.PI / 360));
  }
  function placeLights() {
    const s = Math.max(textBox[2] - textBox[0], textBox[3] - textBox[1]);
    key.target.position.copy(target);
    key.position.copy(target).add(new THREE.Vector3(-0.45, 0.75, 1).multiplyScalar(s * 1.4));
    const sc = key.shadow.camera; sc.left = -s * 1.1; sc.right = s * 1.1; sc.top = s * 1.1; sc.bottom = -s * 1.1; sc.near = 0.1; sc.far = s * 5; sc.updateProjectionMatrix();
    rim.position.copy(target).add(new THREE.Vector3(0.8, 0.5, -1).multiplyScalar(s));
    wall.position.set(target.x, target.y, -P.depth / 2 - P.wall);
    wall.material.opacity = P.shadow; wall.visible = P.shadow > 0;
  }
  function rebuild() {
    twoLines = W / H < 1.35;
    layoutText();
    setPieces(fracture((textBox[0] + textBox[2]) / 2, (textBox[1] + textBox[3]) / 2));
    reform();
    cloud.copy(target);
    placeCamera(); placeLights();
  }
  function resize() {
    W = stage.W; H = stage.H; k = Math.min(stage.dpr, P.res);
    renderer.setSize(stage.pw, stage.ph, false);
    makeTargets();
    if ((W / H < 1.35) !== twoLines) rebuild(); else placeCamera();
  }

  // ---------- input ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x, y) {                                    // the point on a shard under the finger, or null
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pieces.filter((p) => p.mesh.visible).map((p) => p.mesh), false);
    return hits.length ? hits[0].point.clone() : null;
  }
  let demoAt = stage.reduced ? Infinity : DEMO_AFTER, demoBack = 0, clock = 0;
  // the camera flies once it has burst: drag turns round the pieces, the wheel or a pinch flies in and out, two fingers turn too
  const press = pressTracker(), pts = new Map();
  let lastTap = -1, reformT = 0, drag = null, two = null;
  const pair = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
  const clampPitch = (v) => Math.max(-80, Math.min(80, v));
  const flyTo = (z) => { camT.zoom = Math.min(Math.log(camDist / 1.2), Math.max(-0.5, z)); };   // stops short of the empty middle
  offs.push(stage.on('down', (q, e) => {
    demoAt = Infinity; demoBack = 0;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { two = { ...pair(), yaw: camT.yaw, pitch: camT.pitch, zoom: camT.zoom }; press.cancel(); drag = null; return; }
    if (pts.size > 2 || two) return;
    if (press.down(q, e.pointerId)) drag = { x: q.x, y: q.y, yaw: camT.yaw, pitch: camT.pitch };
  }));
  offs.push(stage.on('move', (q, e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (two && pts.size >= 2) {
      if (mode !== 'go') return;
      const c = pair();
      camT.yaw = two.yaw - (c.x - two.x) / W * 120; camT.pitch = clampPitch(two.pitch + (c.y - two.y) / H * 90);
      if (two.d > 20) flyTo(two.zoom + Math.log(c.d / two.d) * 1.5);
      return;
    }
    press.move(q, e.pointerId);
    if (!drag || press.moved < 8 || mode !== 'go' || rewinding) return;
    camT.yaw = drag.yaw - (q.x - drag.x) / W * 160; camT.pitch = clampPitch(drag.pitch + (q.y - drag.y) / H * 110);
  }));
  const onWheel = (e) => { if (mode !== 'go' || stage.revealed) return; e.preventDefault(); flyTo(camT.zoom - e.deltaY * 0.0012); };
  stage.root.addEventListener('wheel', onWheel, { passive: false });
  offs.push(stage.on('up', (q, e) => {
    pts.delete(e.pointerId);
    if (two) { if (pts.size === 0) two = null; return; }
    drag = null;
    const r = press.up(q, e.pointerId);
    if (!r) return;
    if (rewinding) { rewinding = false; tr = Math.max(tr, P.hold + P.ramp); return; }
    if (!r.tap || stage.revealed) return;
    const now = performance.now();
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) {       // re-form, a beat later so a third tap can still mean reveal
      lastTap = -1; clearTimeout(reformT);
      reformT = setTimeout(() => { if (alive && !stage.revealed) reform(); }, REFORM_DELAY_MS);
      return;
    }
    lastTap = now;
    const at = pick(q.x, q.y);
    if (!at) return;                                       // the background does nothing
    if (mode === 'rest') explode(at); else if (mode === 'go') kickFrom(at, 0.75, false);
  }));

  // ---------- reveal: the cut, over the type ----------
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const rv = createReveal(stage, (c, W_, H_, kk) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, kk); corners(c, W_, H_, 16, colr, kk);
    const toScr = (v) => [(v.x * 0.5 + 0.5) * W_, (-v.y * 0.5 + 0.5) * H_];
    c.lineWidth = 0.8;
    for (const crack of [0, 1]) {
      c.strokeStyle = colr((crack ? 0.9 : 0.45) * kk); c.setLineDash(crack ? [] : [3, 3]);
      c.beginPath();
      for (const p of pieces) {
        if (!p.mesh.visible) continue;
        const o = p.outline, z = P.depth / 2;
        for (let i = 0; i < o.length; i += 5) {
          if (o[i + 4] !== crack) continue;
          _a.set(o[i], o[i + 1], z).applyQuaternion(p.mesh.quaternion).add(p.mesh.position).project(camera);
          _b.set(o[i + 2], o[i + 3], z).applyQuaternion(p.mesh.quaternion).add(p.mesh.position).project(camera);
          if (_a.z > 1 || _b.z > 1) continue;
          const [x0, y0] = toScr(_a), [x1, y1] = toScr(_b);
          c.moveTo(x0, y0); c.lineTo(x1, y1);
        }
      }
      c.stroke();
    }
    c.setLineDash([]);
    if (mode === 'go') {
      _a.copy(impact).project(camera); const [ix, iy] = toScr(_a);
      c.strokeStyle = colr(0.9 * kk); c.beginPath(); c.arc(ix, iy, 9, 0, Math.PI * 2); c.moveTo(ix - 16, iy); c.lineTo(ix + 16, iy); c.moveTo(ix, iy - 16); c.lineTo(ix, iy + 16); c.stroke();
      label(c, 'the hit', ix + 14, iy - 12, colr, kk);
    }
    label(c, '— cracks · cut by Voronoi cells, finer near the hit', 40, 50, colr, kk);
    label(c, '- - the letter outline', 40, 66, colr, kk);
    titleBlock(c, W_, H_, ['SPLINTERED · STRUCTURE', `${pieces.length} shards · ${P.glass ? 'glass' : MATERIALS[Math.round(P.material)] || 'chrome'}`,
      mode === 'go' ? `time ×${Math.abs(rate()).toFixed(3)}${rewinding ? ' · rewinding' : ''}` : 'whole', `lens ${Math.round(P.lens)} mm · aperture ${P.aperture.toFixed(2)}`], colr, kk);
  }, { dim: 0.6 });

  // ---------- settings ----------
  const Ctl = (key2, label2, min, max, step) => ({ key: key2, label: label2, min, max, step });
  const tune = {
    title: 'Splintered', values: P, defaults: DEF,
    groups: [
      { name: 'Glass', items: [{ key: 'glass', label: 'Glass letters', type: 'toggle' }, Ctl('bevel', 'Bevel', 0, 0.05, 0.001), Ctl('glassEnv', 'Reflections', 0, 6, 0.05),
        Ctl('glassRough', 'Polish (lower is sharper)', 0, 0.3, 0.005), Ctl('clarity', 'Clarity', 0, 1, 0.01), Ctl('inner', 'Inner edges', 0, 4, 0.05)] },
      { name: 'Look', items: [Ctl('material', 'Material when not glass (chrome, graphite, lacquer, ceramic)', 0, 3, 1), Ctl('depth', 'Extrusion depth', 0.05, 1.5, 0.01), Ctl('env', 'Reflections', 0, 3, 0.05),
        Ctl('exposure', 'Exposure', 0.3, 3, 0.05), Ctl('shadow', 'Shadow on the wall', 0, 1, 0.01), Ctl('wall', 'Wall distance', 0.02, 3, 0.01)] },
      { name: 'Blast', items: [Ctl('pieces', 'Pieces per letter (next blast)', 6, 120, 1), Ctl('cluster', 'Smaller pieces near the hit', 0, 1, 0.01), Ctl('force', 'Force', 1, 40, 0.1),
        Ctl('forward', 'Toward the camera', 0, 4, 0.05), Ctl('spread', 'Outward spread', 0, 3, 0.05), Ctl('spin', 'Spin', 0, 30, 0.1), Ctl('reach', 'Reach of the blast', 0.3, 12, 0.05),
        Ctl('gravity', 'Gravity', 0, 20, 0.1), Ctl('drag', 'Air drag', 0, 3, 0.01)] },
      { name: 'Time', items: [Ctl('hitSpeed', 'Speed at impact', 0.2, 4, 0.05), Ctl('hold', 'Impact lasts (s)', 0, 0.6, 0.01), Ctl('ramp', 'Ease into slow motion (s)', 0.05, 4, 0.05),
        Ctl('slow', 'Slow-motion speed', 0.005, 1, 0.005), Ctl('rewind', 'Rewind speed (hold)', 0.1, 4, 0.05), Ctl('crackTime', 'Beat before the burst (s)', 0, 0.6, 0.01)] },
      { name: 'Lens', items: [Ctl('lens', 'Lens (mm)', 18, 135, 1), Ctl('aperture', 'Aperture (blur strength)', 0, 3, 0.01), Ctl('maxBlur', 'Largest blur (px)', 2, 60, 1),
        { key: 'follow', label: 'Focus follows a shard', type: 'toggle' }, Ctl('yaw', 'Camera turn', -45, 45, 0.5), Ctl('pitch', 'Camera tilt', -30, 30, 0.5), Ctl('shake', 'Shake at impact', 0, 3, 0.05)] },
      { name: 'Light', items: [Ctl('flash', 'Flash at impact', 0, 300, 1), Ctl('glowLevel', 'Glow in the cracks', 0, 20, 0.1), Ctl('cool', 'Glow cools over', 0.02, 3, 0.01),
        Ctl('sparks', 'Sparks', 0, 1500, 10), Ctl('bloom', 'Bloom', 0, 3, 0.01), Ctl('threshold', 'Bloom threshold', 0.1, 8, 0.05), Ctl('res', 'Resolution', 0.5, 2, 0.05)] },
    ],
    set(key2, v) {
      P[key2] = v;
      if (key2 === 'material' || key2 === 'env') applyMaterial();
      else if (key2 === 'depth' || key2 === 'bevel' || key2 === 'glass') rebuild();
      else if (['glassEnv', 'glassRough', 'clarity', 'inner'].includes(key2)) applyGlass();
      else if (key2 === 'res') resize();
      else if (key2 === 'shadow' || key2 === 'wall') placeLights();
    },
    reset() { Object.assign(P, DEF); applyMaterial(); applyGlass(); resize(); rebuild(); },
  };

  // ---------- the frame ----------
  function frame(dt) {
    dt = Math.min(dt, 1 / 30); clock += dt;
    if (clock > demoAt) {                                  // one self-demo: a hit left of centre, then it rewinds
      demoAt = Infinity;
      const at = new THREE.Vector3(textBox[0] + (textBox[2] - textBox[0]) * 0.38, (textBox[1] + textBox[3]) / 2 + 0.1, P.depth / 2);
      explode(at); demoBack = clock + DEMO_REWIND;
    }
    if (demoBack && clock > demoBack) { demoBack = 0; if (mode === 'go') { rewinding = true; heldFor = 0; } }
    if (press.holding && mode === 'go' && !rewinding && !stage.revealed) { rewinding = true; heldFor = 0; }
    if (rewinding) heldFor += dt;
    if (mode === 'crack') { crackT += dt; if (crackT >= P.crackTime) kickFrom(impact.clone(), 1, true); }
    const ke = 1 - Math.exp(-dt * 7);
    for (const c in cam) cam[c] += (camT[c] - cam[c]) * ke;
    if (mode === 'go') {
      tau += rate() * dt; tr += dt;
      while (tau < 0 && stack.length) { const over = tau; popBase(); tau += over; }
      if (tau <= 0) reform();
    }
    camera.getWorldDirection(_fw);
    for (const p of pieces) {
      if (!p.moving) continue;
      poseAt(p, tau, p.mesh.position, p.mesh.quaternion);
      p.mesh.visible = _p.copy(p.mesh.position).sub(camera.position).dot(_fw) > camera.near + 0.15;
    }
    let nMov = 0; _sum.set(0, 0, 0);                       // the middle of the flying pieces, for the flown camera to turn round
    for (const p of pieces) if (p.moving) { _sum.add(p.mesh.position); nMov++; }
    if (mode === 'go' && nMov) cloud.lerp(_sum.divideScalar(nMov), Math.min(1, dt * 3)); else cloud.copy(target);
    if (colour) {                                          // anodised in the palette once the first press wakes it
      const a = colour.update(dt);
      outerMat.color.copy(outerBase).lerp(tint, a); innerMat.color.copy(innerBase).lerp(tint, a); innerMat.emissive.setRGB(1, 1, 1).lerp(tint, a);
      for (const m of GMATS) m.specularColor.setRGB(1, 1, 1).lerp(tint, a);
      glassInner.emissive.setRGB(1, 1, 1).lerp(tint, a);
    }
    const go = mode === 'go', T = tauDone + tau;
    flash.position.copy(impact).add(new THREE.Vector3(0, 0, 0.6));
    flash.intensity = go ? P.flash * Math.exp(-tau / 0.035) * smooth(0, 0.003, tau) : mode === 'crack' ? P.flash * 0.5 * Math.exp(-crackT / 0.03) : 0;
    innerMat.emissiveIntensity = go ? P.glowLevel * Math.exp(-T / P.cool) * smooth(0, 0.01, T) : 0;
    glassInner.emissiveIntensity = innerMat.emissiveIntensity;
    glassInner.visible = go;                               // glass crack walls stay hidden until the pieces part
    sparkMat.uniforms.tau.value = tau; sparkMat.uniforms.drag.value = P.drag; sparkMat.uniforms.grav.value = P.gravity;
    sparks.visible = go && P.sparks > 0;
    placeCamera(go && !rewinding && tr < 0.45 ? P.shake * 0.06 * Math.exp(-tr / 0.09) : mode === 'crack' ? P.shake * 0.025 * Math.exp(-crackT / 0.05) : 0);
    const nameDist = camR - P.depth / 2;
    let focus = nameDist;
    if (flown()) {                                         // flying: focus on whatever is in the middle of the frame
      ndc.set(0, 0); ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pieces.filter((p) => p.mesh.visible).map((p) => p.mesh), false)[0];
      afD += ((hit ? hit.distance : nameDist) - afD) * Math.min(1, dt * 5);
      focus = afD;
    } else afD = nameDist;
    if (P.follow && go && hero && hero.mesh.visible && !flown()) {
      rackT += ((rewinding ? 0 : smooth(0.25, 1.6, tr)) - rackT) * Math.min(1, dt * 3);
      const hd = _p.copy(hero.mesh.position).sub(camera.position).dot(_fw);
      focus = nameDist + (Math.max(camera.near + 0.3, hd) - nameDist) * rackT;
    } else rackT *= 0.9;
    renderFrame(focus);
    rv.draw(performance.now());
  }

  W = stage.W; H = stage.H; k = Math.min(stage.dpr, P.res);
  renderer.setSize(stage.pw, stage.ph, false);
  makeTargets();
  rebuild();
  offs.push(stage.frame((dt) => frame(dt)));
  let rt = 0; offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) resize(); }, 120); }));

  return {
    tune,
    debug: { pick: (x, y) => pick(x, y), get tau() { return tau; }, get mode() { return mode; }, get pieces() { return pieces.length; }, cam, camT,
      explode: (fx = 0.38, fy = 0.5) => explode(new THREE.Vector3(textBox[0] + (textBox[2] - textBox[0]) * fx, textBox[1] + (textBox[3] - textBox[1]) * fy, P.depth / 2)), reform },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reformT);
      rv.destroy(); offs.forEach((f) => f()); stage.root.removeEventListener('wheel', onWheel);
      setPieces([]);
      [rtScene, rtDof, rtBright, ...downs, ...ups].forEach((t) => t && t.dispose());
      if (rtScene) rtScene.depthTexture.dispose();
      [...POST, sparkMat, outerMat, innerMat, ...GMATS, wall.material].forEach((m) => m.dispose());
      FS.geometry.dispose(); wall.geometry.dispose(); sparkGeo.dispose();
      envRT.dispose(); glassEnvRT.dispose(); pmrem.dispose(); key.shadow.map && key.shadow.map.dispose();
      renderer.dispose();
      link.remove(); stage.setBackdrop(null);
    },
  };
}
