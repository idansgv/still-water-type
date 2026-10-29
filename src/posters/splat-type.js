// Splat type: the name is thousands of soft, translucent splats, each a gaussian smear (as in gaussian splatting) sized to fit
// inside the letter, so together they read as solid type with a slightly painterly, grainy body. Press and the dust near it is
// thrown outward (a few grains far, most a little); drag and it is pushed along the stroke, stretched into streaks while it
// flies; a mouse moving over it can breathe on it (off by default). Then it drifts home, a spring each, and the letters close up again.
//
// Under the picture (WebGL2): one instanced quad per splat; the vertex shader stretches each along its flight and fades it a
// little with speed; the fragment shader is the gaussian, premultiplied, blended over the page. The physics is a spring
// per splat toward its home, on the CPU; nothing is drawn while everything is at rest.
//
// Colour (about one showing in twenty, src/colour.js): from the first press, the splats take the palette down the page.
// gestures: press / tap = a burst; drag = pushes the dust along; hover (mouse) = a breath; hold = nothing more; double tap on
// empty page = pulls everything home now (REFORM_DELAY_MS after, so a third tap can still mean reveal).

import { getGL } from '../engine.js';
import { colourOf } from '../colour.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { linesFor } from '../name.js';

const FACE = '900 100px Archivo, "Arial Black", "Helvetica Neue", sans-serif';
const DEF = { settle: 1, breath: 0, reach: 115, force: 2400, back: 0.5, grain: 2.5 };

const VS = `#version 300 es
layout(location=0) in vec2 aC;
layout(location=1) in vec4 iA;      // x, y (css px), vx, vy (px/s)
layout(location=2) in vec4 iB;      // radius (px), opacity, rest angle, rest aspect
uniform vec2 uRes;
out vec2 vU; out float vO; out float vT;
void main() {
  vec2 v = iA.zw; float sp = length(v);
  float m = smoothstep(8.0, 90.0, sp);
  vec2 rest = vec2(cos(iB.z), sin(iB.z));
  vec2 dir = normalize(mix(rest, sp > 1e-3 ? v / sp : rest, m) + vec2(1e-5, 0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  float st = 1.0 + m * min(sp / 260.0, 3.5);
  float r = iB.x * 1.9;
  vec2 p = iA.xy + dir * aC.x * r * st + nrm * aC.y * r * mix(iB.w, 1.0, m) / sqrt(st);
  vU = aC; vO = iB.y * mix(1.0, 0.75, m); vT = p.y / uRes.y;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const FS = `#version 300 es
precision mediump float;
in vec2 vU; in float vO; in float vT;
uniform vec3 uInk; uniform float uCol; uniform vec3 uG[6];
out vec4 o;
vec3 grad(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.24) return mix(uG[0], uG[1], t / 0.24);
  if (t < 0.46) return mix(uG[1], uG[2], (t - 0.24) / 0.22);
  if (t < 0.54) return mix(uG[2], uG[3], (t - 0.46) / 0.08);
  if (t < 0.77) return mix(uG[3], uG[4], (t - 0.54) / 0.23);
  return mix(uG[4], uG[5], (t - 0.77) / 0.23);
}
void main() {
  float a = exp(-dot(vU, vU) * 4.2) * vO;
  if (a < 0.003) discard;
  vec3 c = mix(uInk, grad(vT), uCol);
  o = vec4(c * a, a);
}`;

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';
  const P = { ...DEF };
  const col = colourOf(stage);
  const offs = [];
  if (col) offs.push(col.wakeOnPress({ move: true }));
  stage.setBackdrop(dark ? 0 : 1);
  const ink = dark ? [1, 1, 1] : [0, 0, 0];
  const timers = new Set(); const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  const U = (n) => gl.getUniformLocation(prog, n);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const bufA = gl.createBuffer(), bufB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(1, 1);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(2, 1);
  const gUni = col ? col.uniform() : new Float32Array(18);

  // ---------- the splats ----------
  let W = stage.W, H = stage.H, N = 0, X, Y, VX, VY, HX, HY, A, B, awake = 1, alive = true, pull = 0, ready = false;
  async function build() {
    W = stage.W; H = stage.H;
    try { await Promise.race([document.fonts.load('900 100px Archivo'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }
    if (!alive) return;
    const m = document.createElement('canvas'); m.width = Math.ceil(W); m.height = Math.ceil(H);
    const x = m.getContext('2d', { willReadFrequently: true });
    const portrait = W / H < 0.8, lines = linesFor(stage, portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'], { upper: true });
    x.font = FACE; const widest = Math.max(...lines.map((l) => x.measureText(l).width));
    const size = Math.min(W * 0.84 / widest * 100, H * Math.min(portrait ? 0.22 : 0.34, 0.68 / lines.length));
    x.font = FACE.replace('100px', size + 'px'); x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#000';
    const lead = size * 0.93, top = H / 2 - (lines.length * lead) / 2 + size * 0.78 - H * 0.02;
    lines.forEach((l, i) => x.fillText(l, W / 2, top + i * lead));
    const d = x.getImageData(0, 0, m.width, m.height).data, MW = m.width, MH = m.height;
    const inside = (px, py) => px >= 0 && py >= 0 && px < MW && py < MH && d[((py | 0) * MW + (px | 0)) * 4 + 3] > 128;
    let area = 0; for (let i = 3; i < d.length; i += 4 * 9) if (d[i] > 128) area += 9;
    N = Math.round(Math.min(stage.reduced ? 40000 : 110000, Math.max(9000, area * 0.42 * P.grain)));
    X = new Float32Array(N); Y = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N); HX = new Float32Array(N); HY = new Float32Array(N);
    A = new Float32Array(N * 4); B = new Float32Array(N * 4);
    const out = (px, py, r) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (!inside(px + Math.cos(a) * r, py + Math.sin(a) * r)) return true; } return false; };
    const RADII = [1.5, 3, 5, 8, 12, 17, 24];
    let n = 0, guard = 0;
    while (n < N && guard++ < N * 60) {
      const px = stage.rand() * W, py = stage.rand() * H; if (!inside(px, py)) continue;
      let dist = 26; for (const rr of RADII) if (out(px, py, rr)) { dist = rr; break; }      // how deep inside: a splat never reaches past the edge
      const r = Math.max(0.45, Math.min(dist / 1.9, (0.6 + stage.rand() * 0.4) * (dist < 3 ? 1 : (3 + stage.rand() * 6) / Math.sqrt(P.grain))));
      X[n] = HX[n] = px; Y[n] = HY[n] = py;
      B[n * 4] = r; B[n * 4 + 1] = dist < 3 ? 0.55 + stage.rand() * 0.35 : 0.35 + stage.rand() * 0.4; B[n * 4 + 2] = stage.rand() * Math.PI; B[n * 4 + 3] = 0.45 + stage.rand() * 0.55;
      n++;
    }
    N = n;
    for (let i = 0; i < N; i++) { const o = i * 4; A[o] = X[i]; A[o + 1] = Y[i]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.bufferData(gl.ARRAY_BUFFER, B.subarray(0, N * 4), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.bufferData(gl.ARRAY_BUFFER, A.byteLength, gl.DYNAMIC_DRAW); gl.bufferSubData(gl.ARRAY_BUFFER, 0, A, 0, N * 4);
    awake = 1; ready = true;
  }

  // ---------- touch ----------
  // A press throws the dust near it outward (a few grains far, most a little); a drag pushes along; a passing pointer breathes on it.
  function blow(px, py, R, F, dirx, diry, along) {
    const R2 = R * R;
    for (let i = 0; i < N; i++) {
      const dx = X[i] - px, dy = Y[i] - py, dd2 = dx * dx + dy * dy; if (dd2 > R2) continue;
      const dd = Math.sqrt(dd2) || 1, f = Math.pow(1 - dd / R, 1.3), k = stage.rand(), s = F * f * (0.25 + k * k * 1.6);
      let ux = dx / dd, uy = dy / dd;
      if (along) { ux = ux * 0.35 + dirx * 0.65; uy = uy * 0.35 + diry * 0.65; }
      VX[i] += ux * s + (stage.rand() - 0.5) * s * 0.5; VY[i] += uy * s + (stage.rand() - 0.5) * s * 0.5 - f * F * 0.08;
    }
    awake = 1;
  }
  const press = pressTracker();
  let down = null, last = null, lastTap = 0, reformT = 0;
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId)) return;
    down = e.pointerId; last = { x: q.x, y: q.y, t: performance.now() };
    if (ready) blow(q.x, q.y, P.reach, P.force * (stage.reduced ? 0.4 : 1), 0, 0, false);
  }));
  offs.push(stage.on('move', (q, e) => {
    if (!ready) return;
    const now = performance.now();
    if (down !== null && e.pointerId !== down) return;
    if (down !== null) press.move(q, e.pointerId);
    if (!last) { last = { x: q.x, y: q.y, t: now }; return; }
    const dx = q.x - last.x, dy = q.y - last.y, dt = Math.max(8, now - last.t) / 1000, len = Math.hypot(dx, dy) || 1, sp = len / dt;
    last = { x: q.x, y: q.y, t: now };
    if (sp < 30) return;
    const ux = dx / len, uy = dy / len;
    if (down !== null) blow(q.x, q.y, P.reach * 0.6, Math.min(sp, 2600) * 0.5 * (P.force / 1100), ux, uy, true);          // a drag pushes the dust along
    else if (P.breath && e.pointerType === 'mouse') blow(q.x, q.y, P.reach * 0.42, Math.min(sp, 2400) * 0.09 * (P.force / 1100), ux, uy, true);   // a breath
  }));
  const release = (q, e) => {
    if (e.pointerId !== down) return;
    const r = press.up(q, e.pointerId); down = null;
    if (r && r.tap) {
      const now = performance.now();
      if (now - lastTap < DOUBLE_MS) {                                 // two taps: everything home now, a beat later so a third tap can still mean reveal
        clearTimeout(reformT); reformT = later(() => { if (!stage.revealed) { pull = 1.6; awake = 1; } }, REFORM_DELAY_MS); lastTap = 0;
      } else lastTap = now;
    }
  };
  offs.push(stage.on('up', release));
  offs.push(stage.on('reveal', () => clearTimeout(reformT)));

  // ---------- reveal: the grains, a few of them, and their homes ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    c.fillStyle = colr(0.8 * k);
    for (let i = 0; i < N; i += Math.max(1, Math.round(N / 1400))) { const rr = Math.max(1, B[i * 4] * 0.9); c.beginPath(); c.arc(HX[i], HY[i], rr, 0, 7); c.fill(); }
    c.strokeStyle = colr(0.35 * k); c.lineWidth = 1;
    for (let i = 0; i < N; i += Math.max(1, Math.round(N / 300))) if (Math.abs(X[i] - HX[i]) + Math.abs(Y[i] - HY[i]) > 2) { c.beginPath(); c.moveTo(HX[i], HY[i]); c.lineTo(X[i], Y[i]); c.stroke(); }
    label(c, `${N} splats`, W_ * 0.5 - 30, H_ - 28, colr, k);
    titleBlock(c, W_, H_, ['SPLAT TYPE · STRUCTURE', '● a splat, at home  ─ where it has been thrown', `reach ${P.reach} px · force ${P.force} · grain ×${P.grain}`], colr, k);
  });

  // ---------- settings ----------
  const Ctl = (key, label2, min, max, step) => ({ key, label: label2, min, max, step });
  const tune = {
    title: 'Splat type', values: P, defaults: DEF,
    groups: [
      { name: 'Touch', items: [Ctl('reach', 'Reach of a touch (px)', 60, 420, 5), Ctl('force', 'Force', 100, 2400, 20), { key: 'breath', label: 'A passing pointer breathes on it', type: 'toggle' }] },
      { name: 'Dust', items: [{ key: 'settle', label: 'Dust settles back into the letters', type: 'toggle' }, Ctl('back', 'How fast it settles', 0.2, 6, 0.1), Ctl('grain', 'Splats (fewer, coarser to more, finer)', 0.3, 2.5, 0.05)] },
    ],
    actions: { 'Back to the letters': () => { pull = 1.6; awake = 1; } },
    set(key, v) { P[key] = v; awake = 1; if (key === 'grain') rebuild(); },
    reset() { Object.assign(P, DEF); rebuild(); },
  };
  let rt = 0; const rebuild = () => { clearTimeout(rt); rt = setTimeout(() => build(), 180); };

  // ---------- the frame ----------
  function draw() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, stage.pw, stage.ph);
    const bg = dark ? 0 : 1; gl.clearColor(bg, bg, bg, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(prog); gl.bindVertexArray(vao);
    gl.uniform2f(U('uRes'), W, H); gl.uniform3fv(U('uInk'), ink); gl.uniform1f(U('uCol'), col ? col.amount : 0);
    gl.uniform3fv(U('uG[0]'), gUni);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, N);
  }
  let colDrawn = 0;
  offs.push(stage.frame((dt0) => {
    if (!ready) return;
    const dt = Math.min(0.033, dt0);
    if (col) { col.update(dt); if (col.amount !== colDrawn) { colDrawn = col.amount; awake = awake || 2; } }
    const settle = P.settle || pull > 0, k = settle ? (pull > 0 ? 9 : P.back * P.back) : 0, damp = settle ? 2 * Math.sqrt(k) * 0.95 + 1.2 : 5.5;
    if (pull > 0) pull -= dt;
    let moving = 0;
    if (awake) {
      const e = Math.exp(-damp * dt);
      for (let i = 0; i < N; i++) {
        let vx = VX[i], vy = VY[i];
        if (k) { vx += (HX[i] - X[i]) * k * dt; vy += (HY[i] - Y[i]) * k * dt; }
        vx *= e; vy *= e;
        if (Math.abs(vx) + Math.abs(vy) < 0.5 && (!k || Math.abs(HX[i] - X[i]) + Math.abs(HY[i] - Y[i]) < 0.3)) { vx = vy = 0; if (k) { X[i] = HX[i]; Y[i] = HY[i]; } }
        else moving++;
        X[i] += vx * dt; Y[i] += vy * dt; VX[i] = vx; VY[i] = vy;
        const o = i * 4; A[o] = X[i]; A[o + 1] = Y[i]; A[o + 2] = vx; A[o + 3] = vy;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.bufferSubData(gl.ARRAY_BUFFER, 0, A, 0, N * 4);
      awake = moving > 0 || pull > 0 ? 1 : 0;
      draw();
    }
    rv.draw();
  }));
  offs.push(stage.on('resize', () => { W = stage.W; H = stage.H; rebuild(); }));
  await build(); draw();

  return {
    tune,
    debug: { blow, build, count: () => N },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reformT); timers.forEach(clearTimeout); rv.destroy(); offs.forEach((f) => f()); stage.setBackdrop(null);
      gl.deleteBuffer(bufA); gl.deleteBuffer(bufB); gl.deleteBuffer(quad); gl.deleteVertexArray(vao); gl.deleteProgram(prog);
    },
  };
}
