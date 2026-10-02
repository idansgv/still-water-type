// The small runtime every poster shares. No dependencies, no build step.
//
// A poster gets a Stage: a canvas, a clock, one unified "look" vector (mouse hover, finger drag or
// device tilt), pointer events in CSS pixels, a seeded random, the theme colours, and helpers for
// type masks and WebGL. Posters stay small because everything fiddly lives here.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const THEMES = {
  dark: { name: 'dark', bg: '#000000', fg: '#ffffff', dim: '#8a8a8a' },
  light: { name: 'light', bg: '#ffffff', fg: '#000000', dim: '#767676' },
};

// ---------- fonts ----------
export async function fontsReady() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('900 100px Archivo', 'MELTDOWNFLATPOINTOFVIEWIdanSegev'),
        document.fonts.load('700 100px Archivo', 'Segev'),
        document.fonts.load('400 12px "IBM Plex Mono"', 'Shuffle'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fall back to whatever is installed */ }
}

// ---------- device tilt (shared across posters and shuffles) ----------
// Android and desktop browsers just start. iOS wants a user gesture and a system prompt; if it is
// refused, or blocked on a managed phone, this quietly does nothing.
const tiltState = { x: 0, y: 0, gx: 0, gy: -1, active: false, asked: false, base: null, ang: 0 };

function screenAngle() {
  return (screen.orientation && screen.orientation.angle) || window.orientation || 0;
}
function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  let gx = e.gamma, gy = e.beta;
  const a = screenAngle();
  if (a === 90) [gx, gy] = [gy, -gx];
  else if (a === 270 || a === -90) [gx, gy] = [-gy, gx];
  else if (a === 180) [gx, gy] = [-gx, -gy];
  if (!tiltState.base || tiltState.ang !== a) { tiltState.base = { gx, gy }; tiltState.ang = a; }
  tiltState.x = clamp((gx - tiltState.base.gx) / 30, -1, 1);
  tiltState.y = clamp((tiltState.base.gy - gy) / 30, -1, 1);
  const roll = clamp(gx, -80, 80) * Math.PI / 180;
  tiltState.gx = Math.sin(roll);
  tiltState.gy = -Math.cos(roll);
  tiltState.active = true;
}
export function askTilt() {
  if (tiltState.asked) return;
  tiltState.asked = true;
  const D = window.DeviceOrientationEvent;
  if (!D) return;
  const start = () => addEventListener('deviceorientation', onOrientation, { passive: true });
  if (typeof D.requestPermission === 'function') {
    try { D.requestPermission().then((r) => { if (r === 'granted') start(); }).catch(() => {}); } catch (e) { /* ignore */ }
  } else start();
}
if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') askTilt();

// ---------- the stage ----------
export function createStage(root, { seed = 1, theme = THEMES.dark, toast = () => {}, setBackdrop = () => {} } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'poster-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  root.appendChild(canvas);

  const handlers = { down: new Set(), move: new Set(), up: new Set(), resize: new Set() };
  const frames = new Set();

  const ctx = {
    root, canvas, seed, theme, reduced, toast, setBackdrop,
    rand: mulberry32(seed),
    W: 1, H: 1, dpr: 1, scale: 1, pw: 1, ph: 1,    // css size, device ratio, quality scale, canvas px
    t: 0, dt: 0,
    look: { x: 0, y: 0, tx: 0, ty: 0 },             // -1..1, y up. Mouse hover, finger drag, plus tilt.
    ptr: { x: 0, y: 0, u: 0.5, v: 0.5, down: false, type: 'mouse', vx: 0, vy: 0 },
    tilt: tiltState,
    adaptive: false,                                // posters that are expensive opt in to the governor
    interacted: false,
    on(type, fn) { handlers[type].add(fn); return () => handlers[type].delete(fn); },
    frame(fn) { frames.add(fn); return () => frames.delete(fn); },
    colors: { bg: hexToRgb(theme.bg), fg: hexToRgb(theme.fg), dim: hexToRgb(theme.dim) },
    setScale(s) { ctx.scale = clamp(s, 0.4, 1); resize(); },
    destroy,
    step,
  };

  // --- sizing ---
  function resize() {
    const r = root.getBoundingClientRect();
    ctx.W = Math.max(1, Math.round(r.width));
    ctx.H = Math.max(1, Math.round(r.height));
    ctx.dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.pw = Math.max(1, Math.round(ctx.W * ctx.dpr * ctx.scale));
    ctx.ph = Math.max(1, Math.round(ctx.H * ctx.dpr * ctx.scale));
    canvas.width = ctx.pw; canvas.height = ctx.ph;
    handlers.resize.forEach((fn) => fn(ctx));
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(root);

  // --- pointer ---
  const drag = { on: false, sx: 0, sy: 0, lx: 0, ly: 0 };
  function local(e) {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function setPtr(e) {
    const p = local(e);
    const q = ctx.ptr;
    q.vx = p.x - q.x; q.vy = p.y - q.y;
    q.x = p.x; q.y = p.y; q.u = p.x / ctx.W; q.v = 1 - p.y / ctx.H; q.type = e.pointerType || 'mouse';
    return q;
  }
  const unit = () => Math.min(ctx.W, ctx.H) * 0.75;
  function onDown(e) {
    ctx.interacted = true;
    askTilt();
    const q = setPtr(e); q.down = true; q.vx = q.vy = 0;
    if (q.type !== 'mouse') { drag.on = true; drag.sx = q.x; drag.sy = q.y; drag.lx = ctx.look.tx; drag.ly = ctx.look.ty; }
    try { root.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    handlers.down.forEach((fn) => fn(q, e));
  }
  function onMove(e) {
    const q = setPtr(e);
    if (q.type === 'mouse') { ctx.look.tx = clamp(q.u * 2 - 1, -1.2, 1.2); ctx.look.ty = clamp(q.v * 2 - 1, -1.2, 1.2); }
    else if (drag.on) {
      ctx.look.tx = clamp(drag.lx + (q.x - drag.sx) / unit(), -1.2, 1.2);
      ctx.look.ty = clamp(drag.ly - (q.y - drag.sy) / unit(), -1.2, 1.2);
    }
    if (q.type === 'mouse' || q.down) ctx.interacted = true;
    handlers.move.forEach((fn) => fn(q, e));
  }
  function onUp(e) {
    const q = setPtr(e); q.down = false; drag.on = false;
    handlers.up.forEach((fn) => fn(q, e));
  }
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);

  // --- clock ---
  let raf = 0, last = 0, running = false, ema = 16, slow = 0, fast = 0;
  function update(dt) {
    ctx.t += dt; ctx.dt = dt;
    const k = 1 - Math.exp(-dt * 9);
    const tl = tiltState.active ? tiltState : { x: 0, y: 0 };
    ctx.look.x += (clamp(ctx.look.tx + tl.x, -1.4, 1.4) - ctx.look.x) * k;
    ctx.look.y += (clamp(ctx.look.ty + tl.y, -1.4, 1.4) - ctx.look.y) * k;
    for (const fn of frames) fn(dt, ctx.t, ctx);
    if (ctx.adaptive && !ctx.reduced) governor(dt);
  }
  // Frame-time governor: drop render resolution when frames run long, bring it back when there is room.
  function governor(dt) {
    ema += (dt * 1000 - ema) * 0.08;
    if (ema > 24) { slow++; fast = 0; } else if (ema < 13) { fast++; slow = 0; } else { slow = fast = 0; }
    if (slow > 40 && ctx.scale > 0.45) { ctx.setScale(ctx.scale * 0.85); slow = 0; ema = 16; }
    else if (fast > 240 && ctx.scale < 1) { ctx.setScale(ctx.scale * 1.12); fast = 0; }
  }
  function tick(now) {
    if (!running) return;
    const dt = clamp((now - last) / 1000, 0.0005, 0.05);
    last = now;
    update(dt);
    raf = requestAnimationFrame(tick);
  }
  function step(ms = 16) { update(ms / 1000); }          // for tests: advance without a browser frame
  function start() {
    if (running) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  function destroy() {
    stop();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerup', onUp);
    root.removeEventListener('pointercancel', onUp);
    try {
      const gl = canvas.getContext('webgl2');
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (err) { /* ignore */ }
    canvas.remove();
    handlers.down.clear(); handlers.move.clear(); handlers.up.clear(); handlers.resize.clear(); frames.clear();
  }

  resize();
  ctx.start = start;
  return ctx;
}

// ---------- WebGL helpers ----------
export function getGL(canvas, { depth = false } = {}) {
  return canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth, stencil: false,
    powerPreference: 'high-performance', preserveDrawingBuffer: true,
  });
}

export const VS_TRI = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 uv;
void main() { vec2 p = P[gl_VertexID]; uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

export function compile(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vsSrc], [gl.FRAGMENT_SHADER, fsSrc]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const cache = {};
  const u = new Proxy(cache, { get: (t, k) => (k in t ? t[k] : (t[k] = gl.getUniformLocation(p, k))) });
  return { p, u, use: () => gl.useProgram(p) };
}

export function texture(gl, { w = 1, h = 1, internal, format, type, filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, data = null } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal ?? gl.RGBA8, w, h, 0, format ?? gl.RGBA, type ?? gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}

export function uploadCanvas(gl, tex, source, { mipmap = false } = {}) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
  if (mipmap) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

// ---------- type masks ----------
// Draws white type on black into a 2D canvas, sized to fill the poster the way a printed poster would:
//   justify  every line is stretched to the full measure (lines get different sizes)
//   fit      one size for all lines, as large as the widest line allows
// rotate: true sets the type up the side (bottom to top), 'auto' does it for one short line on a tall screen.
export function typeMask(w, h, { lines, weight = 900, family = 'Archivo', pad = 0.045, mode = 'justify', rotate = false, valign = 'top', align = 'left', gap = 0.1, bottomReserve = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = '0px';

  // the type lives above the reserved strip (where the page furniture sits)
  const hh = Math.max(1, h - bottomReserve);
  const portrait = w / hh < 0.8;
  const rot = rotate === 'auto' ? (portrait && lines.length === 1) : !!rotate;
  const p = Math.round(pad * Math.min(w, hh));
  const bw = (rot ? hh : w) - p * 2;
  const bh = (rot ? w : hh) - p * 2;

  const font = (s) => `${weight} ${s}px "${family}", "Arial Black", "Helvetica Neue", sans-serif`;
  g.font = font(100);
  const cap100 = g.measureText('H').actualBoundingBoxAscent || 72;
  const widths = lines.map((l) => g.measureText(l).width || 1);

  let sizes = widths.map((wd) => (bw / wd) * 100);
  if (mode === 'fit') { const s = Math.min(...sizes); sizes = sizes.map(() => s); }
  const capsOf = (ss) => ss.map((s) => (cap100 * s) / 100);
  const gapOf = (caps) => (lines.length - 1) * gap * Math.min(...caps);
  let caps = capsOf(sizes);
  let total = caps.reduce((a, b) => a + b, 0) + gapOf(caps);
  if (total > bh) { const k = bh / total; sizes = sizes.map((s) => s * k); caps = capsOf(sizes); total = bh; }
  const gapPx = gap * Math.min(...caps);

  g.save();
  if (rot) { g.translate(0, hh); g.rotate(-Math.PI / 2); }
  let y = p + (valign === 'top' ? 0 : valign === 'bottom' ? bh - total : (bh - total) / 2);
  lines.forEach((l, i) => {
    g.font = font(sizes[i]);
    const m = g.measureText(l);
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    let x = p + m.actualBoundingBoxLeft;
    if (align === 'center') x = p + (bw - inkW) / 2 + m.actualBoundingBoxLeft;
    y += caps[i];
    g.fillText(l, x, y);
    y += gapPx;
  });
  g.restore();

  c.info = { rotated: rot, sizes, padding: p, usedHeight: hh };
  return c;
}

// How much of a mask is lit (0..1). Used to size particle counts.
export function coverage(canvas) {
  const t = document.createElement('canvas');
  t.width = 64; t.height = Math.max(1, Math.round(64 * canvas.height / canvas.width));
  const g = t.getContext('2d');
  g.drawImage(canvas, 0, 0, t.width, t.height);
  const d = g.getImageData(0, 0, t.width, t.height).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i];
  return s / 255 / (t.width * t.height);
}
