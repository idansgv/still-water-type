// Slinky bench: run in the page console (or javascript_tool) on /?p=slinky&debug. Scores the two scenes and has a small hill-climb.
//   await slinkyBench.walk(params)    stairs: does it go down the steps by itself?  -> { descended, secs, crossed, spread, score }
//   await slinkyBench.dropTest(params) factory rods: Slinky drop (the bottom hovers while the top falls) and recoil -> { hover, recoil, score }
//   await slinkyBench.climb(scene, base, space, iters, cands) hill-climb, logs each iteration
window.slinkyBench = (() => {
  const P = () => window.__poster.inst, D = () => P().debug;
  const crossed = (s) => { const N = s.N; let v = 0; for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); const dx = (s.px[2 * b] + s.px[2 * b + 1] - s.px[2 * a] - s.px[2 * a + 1]) / 2, dy = (s.py[2 * b] + s.py[2 * b + 1] - s.py[2 * a] - s.py[2 * a + 1]) / 2; const rx = s.px[2 * i] - s.px[2 * i + 1], ry = s.py[2 * i] - s.py[2 * i + 1]; if ((rx * dy - ry * dx) / (Math.hypot(rx, ry) * Math.hypot(dx, dy) || 1) > -0.1) v++; } return v; };
  const xcount = (s) => { let c = 0; const N = s.N; for (let i = 0; i < N; i++) for (let j = i + 1; j < Math.min(N, i + 5); j++) { const ax = s.px[2 * i], ay = s.py[2 * i], bx = s.px[2 * i + 1], by = s.py[2 * i + 1], cx = s.px[2 * j], cy = s.py[2 * j], dx = s.px[2 * j + 1], dy = s.py[2 * j + 1]; const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax), o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx); if (o1 * o2 < 0 && o3 * o4 < 0) c++; } return c; };
  function walk(params, frames = 2400) {
    const d = D(), t = P().tune; d.setMode('stairs'); t.reset(); const rebuild = ['coils', 'stepW', 'drop', 'arch', 'pack', 'archW', 'archH', 'size'];
    for (const k in params) if (!rebuild.includes(k)) t.set(k, params[k]);
    for (const k of rebuild) if (k in params) t.set(k, params[k]); t.set('coils', params.coils || 25);
    const sd = d.stairs; const s0 = sd.state(); const cy = (s) => { let c = 0; for (let i = 0; i < s.N; i++) c += (s.py[2 * i] + s.py[2 * i + 1]) / 2; return c / s.N; }, cx = (s) => { let c = 0; for (let i = 0; i < s.N; i++) c += (s.px[2 * i] + s.px[2 * i + 1]) / 2; return c / s.N; };
    const y0 = cy(s0), Hs = s0.Hs; let xsum = 0, xn = 0, taps = 0, lastGain = 0, maxDesc = 0, tDone = null, cr = 0, bad = false, last = null;
    for (let f = 0; f < frames; f += 30) {
      sd.run(30); const s = sd.state(); if (!isFinite(s.px[0])) { bad = true; break; }
      const desc = (y0 - cy(s)) / Hs; if (desc > maxDesc + 0.3) lastGain = f; if (desc > maxDesc) maxDesc = desc; if (tDone === null && desc >= 4.2) tDone = (f + 30) / 60; cr = Math.max(cr, crossed(s)); xsum += xcount(s); xn++; last = s;
      if (tDone !== null && f > tDone * 60 + 90) break;                 // got down and settled
      if (f - lastGain > 240 && taps < 2 && tDone === null) { sd.nudge(params.push !== undefined ? params.push : 0.6); taps++; lastGain = f; }   // a human taps the front coil when it stalls (at most twice)
      else if (f - lastGain > 780) break;                                  // stuck for good
    }
    let spread = 0; if (last) { let mn = 1e9, mx = -1e9; for (let i = 0; i < last.N; i++) { const x = (last.px[2 * i] + last.px[2 * i + 1]) / 2; mn = Math.min(mn, x); mx = Math.max(mx, x); } spread = (mx - mn) / last.R; }
    const down = Math.min(maxDesc, 4.5) / 4.5, speed = tDone ? Math.max(0, 1 - tDone / 40) : 0;
    const score = bad ? -1 : down * 0.7 + speed * 0.2 - Math.min(cr, 10) * 0.02 - Math.max(0, spread - 30) * 0.005;
    return { descended: +maxDesc.toFixed(2), secs: tDone, crossed: cr, spread: +spread.toFixed(1), taps, xover: +(xsum / Math.max(1, xn)).toFixed(2), score: +score.toFixed(3) };
  }
  function dropTest(params) {
    const d = D(), t = P().tune; d.setMode('factory'); t.reset(); for (const k in params) t.set(k, params[k]); t.set('steps', 0); t.set('loose', 8);
    const p = d.factory.hang(14, 900), n = p.n; t.set('loose', params.loose !== undefined ? params.loose : 0.12);
    const y0 = [p.y[0], p.y[n - 1]], stretch = ((p.y[6] - p.y[0]) / 6) / Math.max(1, (p.y[n - 1] - p.y[n - 6]) / 5); delete p.hold0;
    let hover = null, low = 0, rise = 0;
    for (let f = 1; f <= 170; f++) { d.run(1); if (hover === null && p.y[n - 1] - y0[1] > 2) hover = f; const dy = p.y[0] - y0[0]; if (dy > low) low = dy; else rise = Math.max(rise, low - dy); }
    const hov = hover || 0, recoil = low > 0 ? rise / low : 0;
    const score = Math.min(hov, 24) / 24 * 0.4 + Math.min(recoil / 0.2, 1) * 0.3 + Math.min(stretch / 1.6, 1) * 0.3;
    return { hover: hov, recoil: +recoil.toFixed(2), stretch: +stretch.toFixed(2), score: +score.toFixed(3) };
  }
  const lockedWalk = (m) => m.descended >= 4.5 && m.crossed <= 2 && m.secs !== null && m.secs <= 20 && m.spread < 12;
  const lockedDrop = (m) => m.hover >= 15 && m.hover <= 45 && m.recoil >= 0.15 && m.stretch >= 1.6;
  // does it walk on other stairs too? (a grid of step widths and drops: how many of them it gets down)
  function robust(base, widths = [5.5, 6.9, 8.9], drops = [2.3, 2.8, 3.3]) { let ok = 0, n = 0; const detail = []; for (const w of widths) for (const dr of drops) { const m = walk({ ...base, stepW: w, drop: dr }); n++; const pass = lockedWalk(m); if (pass) ok++; detail.push([w, dr, m.descended, m.secs, m.crossed, pass ? 1 : 0, m.taps, m.xover]); } return { ok, n, detail }; }
  async function climb(scene, base, space, iters = 10, cands = 6, target = 0.9) {
    const run = scene === 'stairs' ? walk : dropTest; let best = { ...base }, bs = run(best), log = [{ it: 0, best: bs.score, params: { ...best }, m: bs }];
    for (let it = 1; it <= iters && !(scene === 'stairs' ? lockedWalk(bs) : lockedDrop(bs)); it++) {
      let improved = false; const spanScale = 1 / (1 + it * 0.25);
      for (let c = 0; c < cands; c++) {
        const cand = { ...best }; for (const k in space) { if (Math.random() < 0.5) continue; const [lo, hi] = space[k]; cand[k] = Math.min(hi, Math.max(lo, (cand[k] !== undefined ? cand[k] : (lo + hi) / 2) + (Math.random() * 2 - 1) * (hi - lo) * 0.25 * spanScale)); }
        const m = run(cand); if (m.score > bs.score) { best = cand; bs = m; improved = true; }
      }
      log.push({ it, best: bs.score, params: { ...best }, m: bs });
    }
    return { best, bs, log };
  }
  // one refinement round on the stairs: tweak, test on the whole grid, keep what is better. State lives on window.__L so a round can be run per call.
  const SPACE = { spring: [500, 2600], gap: [0.1, 0.3], pack: [0.15, 0.45], grip: [0.5, 1], damping: [0, 1.5], bounce: [0, 0.6], gravity: [20, 60], push: [0.2, 1.2], cross: [0, 1], archW: [1.5, 3.5], archH: [0.6, 1.6], arch: [6, 14] };
  const gridScore = (base) => { const r = robust(base); const meanD = r.detail.reduce((t, x) => t + Math.min(x[2], 4.6), 0) / r.n / 4.6; const cr = r.detail.reduce((t, x) => t + x[4], 0) / r.n, taps = r.detail.reduce((t, x) => t + x[6], 0) / r.n, xo = r.detail.reduce((t, x) => t + x[7], 0) / r.n; return { ...r, xover: +xo.toFixed(2), score: r.ok + meanD * 0.8 - cr * 0.05 - taps * 0.1 - xo * 0.5 }; };
  function round(cands = 5, rng = Math.random) {
    const L = window.__L; L.it++; const span = 1 / (1 + (L.it - 1) * 0.3); const t0 = performance.now(); let tried = 0;
    for (let c = 0; c < cands; c++) {
      const cand = { ...L.best }; for (const k in SPACE) { if (rng() < 0.55) continue; const [lo, hi] = SPACE[k]; cand[k] = Math.min(hi, Math.max(lo, (cand[k] !== undefined ? cand[k] : (lo + hi) / 2) + (rng() * 2 - 1) * (hi - lo) * 0.3 * span)); }
      const g = gridScore(cand); tried++; if (g.score > L.bestG.score) { L.best = cand; L.bestG = g; }
    }
    L.log.push({ it: L.it, ok: L.bestG.ok, score: +L.bestG.score.toFixed(2), ms: Math.round(performance.now() - t0) });
    return { it: L.it, ok: L.bestG.ok, score: +L.bestG.score.toFixed(2), locked: L.bestG.ok >= 7 && L.bestG.xover < 0.3 };
  }
  function start(base) { window.__L = { it: 0, best: { ...base }, bestG: gridScore(base), log: [] }; return { ok: window.__L.bestG.ok, score: +window.__L.bestG.score.toFixed(2) }; }
  return { start, round, gridScore, walk, dropTest, climb, crossed, lockedWalk, lockedDrop, robust };
})();
'ready';
