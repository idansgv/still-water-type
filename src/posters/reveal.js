// Reveal: three quick taps on any poster invert the colours and lay over it a drawing of what it is made of
// (a blueprint of the forces, the fracture cells, the particles and their springs, the droplets and where they live).
// The shell inverts the whole page with a CSS filter; this file owns the 2D layer on top and a few drafting helpers.
//
//   const rv = createReveal(stage, (c, W, H, k, t) => { ... });   // draw(c, W, H, k, t): k is 0..1 and eases in and out; pre-invert colours
//   rv.draw()    // call once per frame; cheap when hidden
//   rv.destroy()
//
// The layer is drawn in the poster's own foreground colour (stage.colors.fg): the page inversion turns it into the opposite.

export function createReveal(stage, draw, opts = {}) {
  const layer = document.createElement('canvas');
  layer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  layer.setAttribute('aria-hidden', 'true');
  stage.root.appendChild(layer);
  const c = layer.getContext('2d');
  let k = 0, last = 0, lastW = 0, lastH = 0;
  const target = () => (stage.revealed ? 1 : 0);
  const off = stage.on('reveal', (on) => {
    document.documentElement.classList.toggle('revealed', on);
    if (opts.onChange) opts.onChange(on);
    if (stage.toast && opts.toast) stage.toast(on ? opts.toast[0] : opts.toast[1], 1600);
  });
  function resize() { layer.width = stage.pw; layer.height = stage.ph; lastW = stage.pw; lastH = stage.ph; }
  resize();
  const offR = stage.on('resize', resize);
  return {
    get k() { return k; },
    draw(now = performance.now()) {
      const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
      const tg = target();
      k += (tg - k) * Math.min(1, dt * (stage.reduced ? 40 : 6));
      if (Math.abs(tg - k) < 0.004) k = tg;
      stage.canvas.style.opacity = k > 0 ? String(1 - (1 - (opts.dim ?? 0.22)) * k) : '';   // the poster steps back so the drawing can be read
      if (stage.pw !== lastW || stage.ph !== lastH) resize();
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, layer.width, layer.height);
      if (k <= 0) return;
      c.setTransform(stage.pw / stage.W, 0, 0, stage.ph / stage.H, 0, 0);
      draw(c, stage.W, stage.H, k, now / 1000);
    },
    destroy() { off(); offR(); layer.remove(); stage.canvas.style.opacity = ''; document.documentElement.classList.remove('revealed'); },
  };
}

// ---------- drafting helpers (all take the 2D context; colour is set by the caller as `ink`) ----------
export const ink = (stage, a) => { const f = stage.colors.fg; return `rgba(${f[0] * 255 | 0},${f[1] * 255 | 0},${f[2] * 255 | 0},${a})`; };

/** a fine grid with heavier lines every 5th */
export function grid(c, W, H, step, col, k) {
  c.lineWidth = 0.5;
  for (let i = 0, x = 0; x <= W; x += step, i++) { c.strokeStyle = col(i % 5 === 0 ? 0.16 * k : 0.07 * k); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let i = 0, y = 0; y <= H; y += step, i++) { c.strokeStyle = col(i % 5 === 0 ? 0.16 * k : 0.07 * k); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
}
/** a registration cross at the four corners of the sheet */
export function corners(c, W, H, m, col, k) {
  c.strokeStyle = col(0.7 * k); c.lineWidth = 1;
  for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) { c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + 8, y); c.moveTo(x, y - 8); c.lineTo(x, y + 8); c.stroke(); }
}
/** an arrow from (x0,y0) to (x1,y1) with a small head */
export function arrow(c, x0, y0, x1, y1, head = 6) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
  c.moveTo(x1, y1); c.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4));
  c.moveTo(x1, y1); c.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4)); c.stroke();
}
/** small mono label */
export function label(c, text, x, y, col, k, align = 'left', size = 10) {
  c.font = `500 ${size}px "IBM Plex Mono", ui-monospace, Menlo, monospace`; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.fillStyle = col(0.85 * k); c.fillText(text, x, y);
}
/** the title block in the top-right corner of the sheet */
export function titleBlock(c, W, H, lines, col, k) {
  const x1 = W - 22, y0 = 20, w = 196, h = 10 + lines.length * 13;
  c.strokeStyle = col(0.7 * k); c.lineWidth = 1; c.strokeRect(x1 - w, y0, w, h);
  lines.forEach((t, i) => label(c, t, x1 - w + 8, y0 + 17 + i * 13, col, k));
}
