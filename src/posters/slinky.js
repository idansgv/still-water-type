// Slinky. Stage one: just the spring. A chain of coils, each joined to the next by a pre-tensioned spring: its force grows from
// zero distance (a zero-length spring), which is what makes a real Slinky stack up tight when it is pushed and stretch a long
// way when it is pulled, and why a hanging one is stretched at the top and bunched at the bottom. A coil cannot get closer to
// the next than the thickness of the wire (that is the stack), and a spring shows no sag, so waves run along it and bounce.
// Hang it by the top, grab any coil and pull, let go and watch the wave go up and down. Drag the top coil to walk it.
// Stage two (not yet): lay the chain along the strokes of the letters.
//
// One colour, black on white or white on black (it swaps on every second shuffle).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mount(stage) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];

  const DEFAULTS = {
    coils: 38, width: 0.2, thick: 0.012,            // number of coils, coil radius (of the screen width), wire thickness (of the coil radius ratio)
    spring: 1100, gap: 0.016, damping: 1.4,         // stiffness, closest two coils can get (of the screen height), damping along the spring
    gravity: 1500, air: 0.08, pinned: 1,            // gravity (px/s^2), air drag, hang it from the top
    tilt: 0.3, handle: 1,                           // how round the coils look (ellipse height / width), whether dragging the top coil moves the hanger
  };
  const P = { ...DEFAULTS };

  let W = 1, H = 1, N = 0, X = [], Y = [], VX = [], VY = [], FX = [], FY = [], R = 60, gap = 12;
  let hangX = 0, hangY = 0, grab = null, acc = 0, pid = null;

  function build() {
    W = stage.W; H = stage.H;
    N = Math.round(P.coils); R = Math.min(W, H) * P.width; gap = Math.max(2, H * P.gap);
    hangX = W / 2; hangY = Math.max(24, H * 0.05);
    X = new Float32Array(N); Y = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N); FX = new Float32Array(N); FY = new Float32Array(N);
    const rest = gap * 1.6;                                           // starts nearly stacked, then settles under gravity
    for (let i = 0; i < N; i++) { X[i] = hangX; Y[i] = hangY + i * rest; }
    grab = null;
  }

  function step(h) {
    FX.fill(0); FY.fill(0);
    const k = P.spring, kc = k * 60, c = P.damping;
    for (let i = 0; i < N - 1; i++) {                                 // a zero-length spring between neighbours, and the stack when they touch
      const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i], d = Math.hypot(dx, dy) || 1e-4, nx = dx / d, ny = dy / d;
      let f = k * d;
      if (d < gap) f -= kc * (gap - d);                                // too close: the wire is in the way
      const rv = (VX[i + 1] - VX[i]) * nx + (VY[i + 1] - VY[i]) * ny;
      f += c * rv * 20;
      FX[i] += nx * f; FY[i] += ny * f; FX[i + 1] -= nx * f; FY[i + 1] -= ny * f;
    }
    for (let i = 0; i < N; i++) FY[i] += P.gravity;
    if (grab) {                                                        // the hand: a soft spring from the held coil to the pointer
      const i = grab.i; FX[i] += (grab.x - X[i]) * 900 - VX[i] * 30; FY[i] += (grab.y - Y[i]) * 900 - VY[i] * 30;
    }
    const drag = Math.exp(-P.air * h * 10);
    for (let i = 0; i < N; i++) {
      if (i === 0 && P.pinned && !(grab && grab.i === 0)) { X[i] = hangX; Y[i] = hangY; VX[i] = VY[i] = 0; continue; }
      VX[i] = (VX[i] + FX[i] * h) * drag; VY[i] = (VY[i] + FY[i] * h) * drag;
      X[i] += VX[i] * h; Y[i] += VY[i] * h;
      const floor = H - 90;
      if (Y[i] > floor) { Y[i] = floor; VY[i] = -Math.abs(VY[i]) * 0.2; VX[i] *= 0.9; }
      X[i] = clamp(X[i], 4, W - 4);
    }
  }

  function draw() {
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.5, R * 0.05);
    if (P.pinned) { ctx.beginPath(); ctx.moveTo(hangX, 0); ctx.lineTo(hangX, hangY); ctx.stroke(); }
    for (let i = 0; i < N; i++) {
      const a = i > 0 ? Math.atan2(Y[i] - Y[i - 1], X[i] - X[i - 1]) : Math.atan2(Y[1] - Y[0], X[1] - X[0]);
      ctx.save(); ctx.translate(X[i], Y[i]); ctx.rotate(a - Math.PI / 2);
      ctx.beginPath(); ctx.ellipse(0, 0, R, R * P.tilt, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  const nearest = (q) => { let best = -1, bd = (R * 1.6) ** 2; for (let i = 0; i < N; i++) { const d = (X[i] - q.x) ** 2 + (Y[i] - q.y) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return;
    const i = nearest(q); if (i < 0) return;
    pid = e.pointerId; grab = { i, x: q.x, y: q.y };
  }));
  offs.push(stage.on('move', (q, e) => {
    if (grab && e.pointerId === pid) { grab.x = clamp(q.x, 4, W - 4); grab.y = clamp(q.y, 4, H - 4); }
    else if (q.type === 'mouse') stage.root.style.cursor = nearest(q) >= 0 ? 'grab' : '';
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (grab && grab.i === 0 && P.pinned && P.handle) { hangX = clamp(grab.x, 4, W - 4); hangY = clamp(grab.y, 4, H - 4); }   // let go of the top coil and it hangs from there
    grab = null; pid = null;
  }));
  offs.push(stage.on('resize', build));
  build();

  function stepAll() { for (let s = 0; s < 6; s++) step(1 / 360); }
  offs.push(stage.frame((dt) => {
    acc = Math.min(acc + dt, 0.05);
    while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(); }
    draw();
  }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Spring', items: [Ctl('spring', 'Stiffness', 200, 4000, 50), Ctl('gap', 'Coil spacing when stacked', 0.004, 0.05, 0.001), Ctl('damping', 'Damping', 0, 8, 0.1), Ctl('gravity', 'Gravity', 0, 4000, 50), Ctl('air', 'Air drag', 0, 1, 0.01)] },
        { name: 'Body', items: [Ctl('coils', 'Coils (re-forms)', 10, 90, 1), Ctl('width', 'Coil radius (re-forms)', 0.05, 0.4, 0.005), Ctl('tilt', 'How round the coils look', 0.05, 0.9, 0.01)] },
      ],
      actions: { 'Re-form': build, 'Let go of the top': () => { P.pinned = 0; }, 'Hang it': () => { P.pinned = 1; hangX = W / 2; hangY = Math.max(24, H * 0.05); } },
      set(key, value) { P[key] = value; if (key === 'coils' || key === 'width' || key === 'gap') build(); },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { run: (n) => { for (let i = 0; i < n; i++) stepAll(); draw(); }, state: () => ({ N, X: Array.from(X), Y: Array.from(Y) }), P },
    destroy() { offs.forEach((f) => f()); stage.root.style.cursor = ''; stage.setBackdrop(null); },
  };
}
