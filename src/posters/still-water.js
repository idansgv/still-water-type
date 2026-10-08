// Still Water. Flat white type on black over a real wave-equation ripple simulation, stepped on the GPU.
// Under the flat graphic: a height field, refraction, and a hidden lamp (press L, or tap three times)
// that throws caustics through the water onto the type, after caustic-volume's lamp scene.

import { getGL, compile, texture, uploadCanvas, VS_TRI } from '../engine.js';

const DEFAULT = { title: 'Idan', artist: 'Segev', lyrics: [] };   // lyrics are parked, not removed
const LINE_MS = 9000;
const FONT = '"Leida", "Archivo", "Arial Black", "Helvetica Neue", sans-serif';   // Leida (local trial files, assets/fonts) when present; Archivo on the live site

export function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  if (!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) throw new Error('float targets unavailable');

  const AMP = ctx.reduced ? 0.45 : 1;
  let song = { ...DEFAULT };
  let lineIdx = 0, lineTimer = 0;
  const offs = [];

  // ---------- type, drawn into an offscreen canvas as channel masks ----------
  // R = bright type, G = dim type
  const tc = document.createElement('canvas');
  const tx = tc.getContext('2d');
  const fitSize = (text, weight, maxW, maxSize) => {
    tx.font = `${weight} 100px ${FONT}`;
    return Math.min(maxSize, (maxW / (tx.measureText(text).width || 1)) * 100);
  };
  const wrap = (words, maxW) => {
    const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (cur && tx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  function drawType(W, H, dpr) {
    tc.width = W; tc.height = H;
    tx.fillStyle = '#000'; tx.fillRect(0, 0, W, H);
    tx.textBaseline = 'alphabetic';
    if ('letterSpacing' in tx) tx.letterSpacing = '0px';
    const pad = Math.max(16 * dpr, W * 0.045);
    const maxW = W - pad * 2;

    const tSize = fitSize(song.title, 900, maxW, H * 0.2);
    const tBase = pad + tSize * 0.78;
    tx.font = `900 ${tSize}px ${FONT}`;
    tx.fillStyle = 'rgb(255,0,0)';
    tx.fillText(song.title, pad - tSize * 0.04, tBase);

    const aSize = Math.max(tSize * 0.3, 18 * dpr);
    const aBase = tBase + aSize * 1.3;
    tx.font = `700 ${aSize}px ${FONT}`;
    tx.fillStyle = 'rgb(0,255,0)';
    tx.fillText(song.artist, pad, aBase);

    // lyric: as big as fits, bottom-aligned above the page furniture
    const line = song.lyrics[lineIdx % Math.max(1, song.lyrics.length)] || '';
    const words = line.split(/\s+/).filter(Boolean);
    const chrome = document.querySelector('.chrome');
    const chromeH = (chrome && chrome.offsetHeight) || 48;
    const bottom = H - Math.max(pad, (chromeH + 20) * dpr);
    const avail = bottom - (aBase + aSize * 1.2);
    let size = Math.min(W * 0.15, H * 0.22), lines = [];
    for (let i = 0; i < 40; i++) {
      tx.font = `900 ${size}px ${FONT}`;
      lines = wrap(words, maxW);
      const widest = Math.max(0, ...lines.map((l) => tx.measureText(l).width));
      if (lines.length * size * 0.95 <= avail && widest <= maxW) break;
      size *= 0.93;
    }
    tx.fillStyle = 'rgb(255,0,255)';
    const lh = size * 0.95;
    lines.forEach((l, i) => tx.fillText(l, pad - size * 0.04, bottom - (lines.length - 1 - i) * lh));
  }

  // ---------- shaders ----------
  // The ripple field: the wave equation on a grid. r = height now, g = height last step. Edges clamp,
  // so waves bounce off the screen edges.
  const SIM_FS = `#version 300 es
  precision highp float;
  uniform sampler2D uPrev, uText;
  uniform vec2 uRes;
  uniform vec4 uDrops[8];          // x, y (sim px), radius (sim px), amplitude
  uniform vec4 uSeg; uniform vec2 uSegP;   // pointer wake: a.xy, b.xy; amplitude, radius
  uniform vec3 uStampW; uniform float uStamp;
  uniform float uDamp;
  out vec4 o;
  void main(){
    vec2 px = 1.0 / uRes, uv = gl_FragCoord.xy * px;
    vec4 c = texture(uPrev, uv);
    float nb = texture(uPrev, uv + vec2(px.x, 0.0)).r + texture(uPrev, uv - vec2(px.x, 0.0)).r
             + texture(uPrev, uv + vec2(0.0, px.y)).r + texture(uPrev, uv - vec2(0.0, px.y)).r;
    float h = (nb * 0.5 - c.g) * uDamp;
    vec2 p = gl_FragCoord.xy;
    for (int i = 0; i < 8; i++) {
      vec2 q = (p - uDrops[i].xy) / max(uDrops[i].z, 1e-3);
      h += uDrops[i].w * exp(-dot(q, q));
    }
    vec2 a = uSeg.xy, ba = uSeg.zw - uSeg.xy;
    float t = clamp(dot(p - a, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    float d = length(p - a - ba * t);
    h += uSegP.x * exp(-d * d / (uSegP.y * uSegP.y));
    h += uStamp * dot(texture(uText, uv).rgb, uStampW);   // the type itself splashes in
    o = vec4(h, c.r, 0.0, 1.0);
  }`;

  // Display: the type is seen through the water. Refraction only, then a hard threshold, so however hard
  // the surface moves, the letters stay flat and solid.
  const OUT_FS = `#version 300 es
  precision highp float;
  in vec2 uv;
  uniform sampler2D uSim, uText;
  uniform vec2 uSimRes, uRes;
  uniform float uRefract;
  uniform vec3 uBg, uFg, uDim;
  uniform float uLamp;
  uniform vec2 uLampPos, uCss;
  uniform vec2 uTilt;
  out vec4 o;
  void main(){
    vec2 s = 1.0 / uSimRes;
    float c = texture(uSim, uv).r;
    float r = texture(uSim, uv + vec2(s.x, 0.0)).r, l = texture(uSim, uv - vec2(s.x, 0.0)).r;
    float u = texture(uSim, uv + vec2(0.0, s.y)).r, d = texture(uSim, uv - vec2(0.0, s.y)).r;
    vec2 off = vec2(r - l, u - d) * uRefract / uRes + uTilt / uRes;
    vec3 t = texture(uText, uv - off).rgb;
    float bright = smoothstep(0.38, 0.62, t.r), dim = smoothstep(0.38, 0.62, t.g);
    vec3 col = mix(uBg, uDim, dim);
    col = mix(col, uFg, bright);

    if (uLamp > 0.0) {
      // The lamp's light passes through the moving surface; where it curves, light gathers into bright
      // lines (caustics) and thins out between them.
      float ur = texture(uSim, uv + s).r, dl = texture(uSim, uv - s).r;
      float ul = texture(uSim, uv + vec2(-s.x, s.y)).r, dr = texture(uSim, uv + vec2(s.x, -s.y)).r;
      vec3 hs = vec3(r - 2.0 * c + l, u - 2.0 * c + d, (ur - ul - dr + dl) * 0.25);
      hs = sign(hs) * max(abs(hs) - 0.003, 0.0);
      vec3 m = 80.0 * hs;
      float det = (1.0 + m.x) * (1.0 + m.y) - m.z * m.z;
      float caus = 1.0 / max(abs(det), 0.06);
      float line = smoothstep(1.35, 2.1, caus), shade = smoothstep(0.45, 0.9, caus);
      vec2 dp = (uv - uLampPos) * uCss;
      float pool = exp(-dot(dp, dp) / (0.09 * dot(uCss, uCss)));
      float lit = pool * (0.35 + 0.65 * shade) + pool * line * 0.9;
      float type = max(bright, dim * 0.6);
      vec3 night = uFg * type * clamp(0.06 + lit, 0.0, 1.0) + uFg * (1.0 - type) * pool * line * 0.22;
      col = mix(col, night, uLamp);
    }
    o = vec4(col, 1.0);
  }`;

  const sim = compile(gl, VS_TRI, SIM_FS);
  const out = compile(gl, VS_TRI, OUT_FS);

  // ---------- state ----------
  let dpr = 1, SW = 0, SH = 0, simScale = 1, cur = 0;
  let sims = [], fbos = [];
  const textTex = texture(gl, { w: 1, h: 1 });
  const drops = [];
  const STAMP_STEPS = 60;          // a splash eases in over ~0.5 s so type sinks in instead of slamming
  let stampTotal = 0, stampStep = STAMP_STEPS, stampW = [0, 0, 0];
  const dropU = new Float32Array(32);
  let ptr = null, last = null;
  let acc = 0;
  const lamp = { on: false, fade: 0, x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, idle: 0, drip: 0 };
  const tilt = { x: 0, y: 0 };

  function uploadType() { drawType(ctx.pw, ctx.ph, dpr); uploadCanvas(gl, textTex, tc); }
  function resize() {
    dpr = ctx.pw / ctx.W;
    simScale = Math.max(2, Math.ceil(ctx.W / 480)) * dpr;
    SW = Math.ceil(ctx.pw / simScale); SH = Math.ceil(ctx.ph / simScale);
    sims.forEach((t) => gl.deleteTexture(t)); fbos.forEach((f) => gl.deleteFramebuffer(f));
    sims = [0, 1].map(() => texture(gl, { w: SW, h: SH, internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT }));
    fbos = sims.map((t) => {
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return f;
    });
    uploadType();
  }
  offs.push(ctx.on('resize', resize));
  resize();

  const toSim = (x, y) => [(x * dpr) / simScale, SH - (y * dpr) / simScale];
  const drop = (x, y, a = 3, r = 7) => drops.push([x, y, r, a * AMP]);
  const splash = (w, amt) => { stampW = w; stampTotal = amt * AMP; stampStep = 0; };
  const rain = (n = 14) => {
    for (let i = 0; i < n; i++) setTimeout(() => drop(Math.random() * SW, Math.random() * SH, (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5), 3 + Math.random() * 4), i * 60);
  };

  // ---------- input ----------
  let downAt = null, taps = [];
  offs.push(ctx.on('move', (p) => {
    ptr = toSim(p.x, p.y); if (!last) last = ptr;
    lamp.tx = p.x / ctx.W; lamp.ty = 1 - p.y / ctx.H; lamp.idle = 0;
  }));
  offs.push(ctx.on('down', (p) => { downAt = [p.x, p.y]; ptr = last = toSim(p.x, p.y); }));
  offs.push(ctx.on('up', (p) => {
    if (downAt && Math.hypot(p.x - downAt[0], p.y - downAt[1]) < 8) { const [x, y] = toSim(p.x, p.y); drop(x, y, -4, 9); }
    downAt = null;
    if (p.type !== 'mouse') ptr = last = null;
    const now = performance.now();
    taps = taps.filter((t) => now - t.t < 650 && Math.hypot(t.x - p.x, t.y - p.y) < 50);
    taps.push({ t: now, x: p.x, y: p.y });
    if (taps.length >= 3) { taps = []; setLamp(!lamp.on); }
  }));
  canvas.addEventListener('pointerleave', () => { ptr = last = null; });
  function setLamp(v) {
    lamp.on = v;
    ctx.toast(v ? 'Lamp on. L to switch off.' : 'Lamp off.');
    if (v) rain(8);
  }
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'l' || e.key === 'L') setLamp(!lamp.on);
    else if (e.key === 'x' || e.key === 'X') rain();
  };
  addEventListener('keydown', onKey);

  // ---------- stepping ----------
  function step() {
    sim.use(); const u = sim.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[1 - cur]); gl.viewport(0, 0, SW, SH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sims[cur]); gl.uniform1i(u.uPrev, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textTex); gl.uniform1i(u.uText, 1);
    gl.uniform2f(u.uRes, SW, SH);
    gl.uniform1f(u.uDamp, 0.993);
    dropU.fill(0);
    drops.splice(0, 8).forEach((d, i) => dropU.set(d, i * 4));
    gl.uniform4fv(u.uDrops, dropU);
    if (ptr && last) {
      const dist = Math.hypot(ptr[0] - last[0], ptr[1] - last[1]);
      gl.uniform4f(u.uSeg, last[0], last[1], ptr[0], ptr[1]);
      gl.uniform2f(u.uSegP, Math.min(dist * 0.05, 0.6) * AMP, 3.5);
      last = ptr;
    } else gl.uniform2f(u.uSegP, 0, 1);
    let stamp = 0;
    if (stampStep < STAMP_STEPS) { stamp = stampTotal * Math.sin(Math.PI * (stampStep + 0.5) / STAMP_STEPS) * Math.PI / (2 * STAMP_STEPS); stampStep++; }
    gl.uniform3fv(u.uStampW, stampW); gl.uniform1f(u.uStamp, stamp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = 1 - cur;
  }
  function render() {
    out.use(); const u = out.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sims[cur]); gl.uniform1i(u.uSim, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textTex); gl.uniform1i(u.uText, 1);
    gl.uniform2f(u.uSimRes, SW, SH); gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform1f(u.uRefract, 26 * dpr);
    gl.uniform3f(u.uBg, ...ctx.colors.bg);
    gl.uniform3f(u.uFg, ...ctx.colors.fg);
    gl.uniform3f(u.uDim, ...ctx.colors.dim);
    gl.uniform1f(u.uLamp, lamp.fade);
    gl.uniform2f(u.uLampPos, lamp.x, lamp.y); gl.uniform2f(u.uCss, ctx.W, ctx.H);
    gl.uniform2f(u.uTilt, tilt.x * 6 * dpr, tilt.y * 6 * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  offs.push(ctx.frame((dt, t) => {
    acc += dt;
    let n = 0; while (acc >= 1 / 120 && n < 6) { step(); acc -= 1 / 120; n++; }
    if (n === 6) acc = 0;
    if (song.lyrics.length && !live && (lineTimer += dt * 1000) > LINE_MS) nextLine();

    // lamp
    lamp.fade += ((lamp.on ? 1 : 0) - lamp.fade) * Math.min(1, dt * 3);
    if (lamp.fade < 0.002) lamp.fade = 0;
    if ((lamp.idle += dt) > 2.5) {
      lamp.tx = 0.5 + 0.3 * Math.sin(t * 0.21); lamp.ty = 0.5 + 0.22 * Math.sin(t * 0.33 + 1.3);
    }
    const k = Math.min(1, dt * 4);
    lamp.x += (lamp.tx - lamp.x) * k; lamp.y += (lamp.ty - lamp.y) * k;
    if (lamp.on && !ctx.reduced && (lamp.drip += dt) > 1.1) { lamp.drip = 0; drop(Math.random() * SW, Math.random() * SH, 0.9, 3 + Math.random() * 2); }

    // device tilt: a light parallax of the type against the black, on phones that allow it
    const tl = ctx.tilt.active && !ctx.reduced ? ctx.tilt : { x: 0, y: 0 };
    tilt.x += (tl.x - tilt.x) * Math.min(1, dt * 4); tilt.y += (tl.y - tilt.y) * Math.min(1, dt * 4);
    render();
  }));

  // ---------- lyrics (parked) and the optional live feed ----------
  function nextLine() {
    if (!song.lyrics.length) return;
    lineIdx = (lineIdx + 1) % song.lyrics.length;
    uploadType();
    splash([0, 0, 1], -0.4);
    lineTimer = 0;
  }

  // Only when the page is opened with ?live: mirror the current word from a Wordflow3d server running on
  // this machine. Off by default, because a public page reaching for localhost can trigger a
  // local-network permission prompt in visitors' browsers.
  const live = new URLSearchParams(location.search).has('live');
  let liveOn = false, liveTrack = null, liveWord = '', pollTimer = 0;
  async function pollSpotify() {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 900);
    try {
      const res = await fetch('http://127.0.0.1:8888/status', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(to);
      if (!res.ok) throw 0;
      const s = await res.json();
      if (!s.playing || !s.track_id) throw 0;
      liveOn = true;
      if (s.track_id !== liveTrack) { liveTrack = s.track_id; liveWord = ''; song = { title: s.track || '', artist: s.artist || '', lyrics: [''] }; }
      if (s.word && s.word !== '...' && s.word !== liveWord) {
        liveWord = s.word; song.lyrics = [liveWord]; lineIdx = 0;
        uploadType(); splash([0, 0, 1], -0.16);
      }
    } catch (e) {
      clearTimeout(to);
      if (liveOn) { liveOn = false; liveTrack = null; liveWord = ''; song = { ...DEFAULT }; lineIdx = 0; uploadType(); }
    }
  }
  if (live) pollTimer = setInterval(pollSpotify, 250);

  // an opening splash, so the poster says "touch me"
  splash([1, 0.6, 0], -1.2);

  return {
    destroy() {
      offs.forEach((off) => off());
      removeEventListener('keydown', onKey);
      clearInterval(pollTimer);
    },
  };
}
