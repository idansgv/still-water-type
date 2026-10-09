// Slinky bench: run in the page console (or javascript_tool) on /?p=slinky&debug. Scores the two scenes and has a small hill-climb.
//   await slinkyBench.walk(params)    stairs: does it go down the steps by itself?  -> { descended, secs, crossed, spread, score }
//   await slinkyBench.dropTest(params) factory rods: Slinky drop (the bottom hovers while the top falls) and recoil -> { hover, recoil, score }
//   await slinkyBench.climb(scene, base, space, iters, cands) hill-climb, logs each iteration
window.slinkyBench = (() => {
  const P = () => window.__poster.inst, D = () => P().debug;
  const crossed = () => 0;                                                    // (the rigid-ring solver has no wrong side; rod crossings are counted by xcount)
  const xcount = (s) => { let c = 0; const N = s.N; for (let i = 0; i < N; i++) for (let j = i + 1; j < Math.min(N, i + 5); j++) { const ax = s.px[2 * i], ay = s.py[2 * i], bx = s.px[2 * i + 1], by = s.py[2 * i + 1], cx = s.px[2 * j], cy = s.py[2 * j], dx = s.px[2 * j + 1], dy = s.py[2 * j + 1]; const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax), o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx); if (o1 * o2 < 0 && o3 * o4 < 0) c++; } return c; };
  function walk(params, frames = 2400) {
    const d = D(), t = P().tune; d.setMode('stairs'); t.reset(); const rebuild = ['coils', 'stepW', 'drop', 'arch', 'pack', 'archW', 'archH', 'size', 'settle'];
    for (const k in params) if (!rebuild.includes(k)) t.set(k, params[k]);
    for (const k of rebuild) if (k in params) t.set(k, params[k]); t.set('coils', params.coils || t.values.coils);
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
    const d = D(), t = P().tune; d.setMode('factory'); t.reset(); for (const k in params) t.set(k, params[k]); t.set('steps', 0);
    const keep = { damping: t.values.damping, wireDamp: t.values.wireDamp }; t.set('damping', 6); t.set('wireDamp', 40);        // settle it hung, heavily damped, then let go with its own damping
    const p = d.factory.hang(14, 900), n = p.n; t.set('damping', keep.damping); t.set('wireDamp', keep.wireDamp);
    const y0 = [p.y[0], p.y[n - 1]], stretch = ((p.y[6] - p.y[0]) / 6) / Math.max(1, (p.y[n - 1] - p.y[n - 6]) / 5); delete p.hold0;
    let hover = null, low = 0, rise = 0;
    for (let f = 1; f <= 170; f++) { d.run(1); if (hover === null && p.y[n - 1] - y0[1] > 2) hover = f; const dy = p.y[0] - y0[0]; if (dy > low) low = dy; else rise = Math.max(rise, low - dy); }
    const hov = hover || 0, recoil = low > 0 ? rise / low : 0;
    const score = Math.min(hov, 24) / 24 * 0.4 + Math.min(recoil / 0.2, 1) * 0.3 + Math.min(stretch / 1.6, 1) * 0.3;
    return { hover: hov, recoil: +recoil.toFixed(2), stretch: +stretch.toFixed(2), score: +score.toFixed(3) };
  }
  // a slinky standing on its end, dropped: does the end ring land flat, does it recoil, does it fall over into an arch?
  function standTest(params, frames = 400) {
    const d = D(), t = P().tune; d.setMode('factory'); t.reset(); for (const k in params) t.set(k, params[k]); t.set('steps', 0);
    const act = t.actions['Drop one standing']; act(); const p = d.pieces()[0], n = p.n; let low = 0, minAfter = 1e9, maxSpread = 0, endFlat = 1;
    for (let f = 1; f <= frames; f++) { d.run(1); if (p.y[0] > low) { low = p.y[0]; minAfter = 1e9; } else minAfter = Math.min(minAfter, p.y[0]); let mn = 1e9, mx = -1e9; for (let j = 0; j < n; j++) { mn = Math.min(mn, p.x[j]); mx = Math.max(mx, p.x[j]); } maxSpread = Math.max(maxSpread, mx - mn); if (f === 40) endFlat = Math.abs(p.ry[n - 1]); }
    return { rise: Math.round(low - minAfter), spread: Math.round(maxSpread), endFlatAt40: +endFlat.toFixed(2) };
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
  const SPACE = { spring: [500, 2600], gap: [0.1, 0.3], pack: [0.15, 0.45], grip: [0.5, 1], damping: [0, 1.5], bounce: [0, 0.6], gravity: [12, 45], push: [0.2, 1.2], cross: [0, 1], archW: [1.5, 3.5], archH: [0.6, 1.6], arch: [6, 14] };
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
  // The look of the walk (Idan's sketch): while an arch stands, the rings along it should fan out square to the path (E near 0) and the end coil planted on the step should lie flat (F near 0).
  function look(params, frames = 1500) {
    const d = D(), t = P().tune; d.setMode('stairs'); t.reset(); const rebuild = ['coils', 'stepW', 'drop', 'arch', 'pack', 'archW', 'archH', 'size', 'settle'];
    for (const k in params) if (!rebuild.includes(k)) t.set(k, params[k]); for (const k of rebuild) if (k in params) t.set(k, params[k]); t.set('coils', params.coils || t.values.coils);
    const sd = d.stairs, s0 = sd.state(), cy = (s) => { let c = 0; for (let i = 0; i < s.N; i++) c += (s.py[2 * i] + s.py[2 * i + 1]) / 2; return c / s.N; }, y0 = cy(s0), Hs = s0.Hs;
    let Es = 0, Fs = 0, na = 0, maxDesc = 0, cr = 0, tDone = null, taps = 0, lastGain = 0, bad = false, xo = 0, xn = 0;
    for (let f = 0; f < frames; f += 15) {
      sd.run(15); const s = sd.state(); if (!isFinite(s.px[0])) { bad = true; break; } const N = s.N;
      const cxs = [], cys = []; for (let i = 0; i < N; i++) { cxs.push((s.px[2 * i] + s.px[2 * i + 1]) / 2); cys.push((s.py[2 * i] + s.py[2 * i + 1]) / 2); }
      const desc = (y0 - cy(s)) / Hs; if (desc > maxDesc + 0.3) lastGain = f; if (desc > maxDesc) maxDesc = desc; if (tDone === null && desc >= 4.2) tDone = (f + 15) / 60;
      cr = Math.max(cr, crossed(s)); xo += xcount(s); xn++;
      const endTop = Math.max(cys[0], cys[N - 1]); let peak = -1e9; for (let i = 1; i < N - 1; i++) peak = Math.max(peak, cys[i]);
      if (peak - endTop > 1.2 * s.R) {                                                  // an arch stands
        let E = 0, c = 0; for (let i = 1; i < N - 1; i++) { const dx = cxs[i + 1] - cxs[i - 1], dy = cys[i + 1] - cys[i - 1], rx = s.px[2 * i] - s.px[2 * i + 1], ry = s.py[2 * i] - s.py[2 * i + 1]; E += Math.abs((rx * dx + ry * dy) / (Math.hypot(rx, ry) * Math.hypot(dx, dy) || 1)); c++; }
        const e = cys[0] < cys[N - 1] ? 0 : N - 1; const ry = s.py[2 * e] - s.py[2 * e + 1], rx = s.px[2 * e] - s.px[2 * e + 1], F = Math.abs(ry) / (Math.hypot(rx, ry) || 1);
        Es += E / c; Fs += F; na++;
      }
      if (tDone !== null && f > tDone * 60 + 90) break;
      if (f - lastGain > 240 && taps < 2 && tDone === null) { sd.nudge(params.push !== undefined ? params.push : 0.6); taps++; lastGain = f; } else if (f - lastGain > 780) break;
    }
    return { descended: +maxDesc.toFixed(2), secs: tDone, taps, crossed: cr, xover: +(xo / Math.max(1, xn)).toFixed(2), E: na ? +(Es / na).toFixed(2) : null, F: na ? +(Fs / na).toFixed(2) : null, archFrames: na, bad };
  }
  // Idan's sketch as numbers (stairs). While an arch stands: spacing even (CV of centre gaps), neighbouring rings fan smoothly (C: mean turn between rods, radians),
  // rings square to the path (E), and the end coil planted on the step lies flat (F). Plus it walks, and the arch lasts (archFrames).
  function look2(params, frames = 1500) {
    const d = D(), t = P().tune; d.setMode('stairs'); t.reset(); const rebuild = ['coils', 'stepW', 'drop', 'arch', 'pack', 'archW', 'archH', 'size', 'settle'];
    for (const k in params) if (!rebuild.includes(k)) t.set(k, params[k]); for (const k of rebuild) if (k in params) t.set(k, params[k]); t.set('coils', params.coils || t.values.coils);
    const sd = d.stairs, s0 = sd.state(), cyf = (s) => { let c = 0; for (let i = 0; i < s.N; i++) c += (s.py[2 * i] + s.py[2 * i + 1]) / 2; return c / s.N; }, y0 = cyf(s0), Hs = s0.Hs;
    let sCV = 0, sC = 0, sE = 0, sF = 0, na = 0, maxDesc = 0, cr = 0, tDone = null, taps = 0, lastGain = 0, bad = false, xo = 0, xn = 0, maxArch = 0;
    for (let f = 0; f < frames; f += 15) {
      sd.run(15); const s = sd.state(); if (!isFinite(s.px[0])) { bad = true; break; } const N = s.N, cxs = [], cys = [], ang = [];
      for (let i = 0; i < N; i++) { cxs.push((s.px[2 * i] + s.px[2 * i + 1]) / 2); cys.push((s.py[2 * i] + s.py[2 * i + 1]) / 2); ang.push(Math.atan2(s.py[2 * i] - s.py[2 * i + 1], s.px[2 * i] - s.px[2 * i + 1])); }
      const desc = (y0 - cyf(s)) / Hs; if (desc > maxDesc + 0.3) lastGain = f; if (desc > maxDesc) maxDesc = desc; if (tDone === null && desc >= 4.2) tDone = (f + 15) / 60;
      cr = Math.max(cr, crossed(s)); xo += xcount(s); xn++;
      const endTop = Math.max(cys[0], cys[N - 1]); let peak = -1e9; for (let i = 1; i < N - 1; i++) peak = Math.max(peak, cys[i]); const archH = (peak - endTop) / s.R; maxArch = Math.max(maxArch, archH);
      const span = Math.abs(cxs[0] - cxs[N - 1]) / s.R;
      if (archH > 1.5 && span > 3) {                                                    // a real arch: the ends well apart, the middle well above them
        const gaps = []; for (let i = 0; i < N - 1; i++) gaps.push(Math.hypot(cxs[i + 1] - cxs[i], cys[i + 1] - cys[i])); const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length, cv = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) / (mean || 1);
        let C = 0; for (let i = 0; i < N - 1; i++) { let da = Math.abs(ang[i + 1] - ang[i]); if (da > Math.PI) da = 2 * Math.PI - da; C += Math.min(da, Math.PI - da); } C /= N - 1;
        let E = 0, c = 0; for (let i = 1; i < N - 1; i++) { const dx = cxs[i + 1] - cxs[i - 1], dy = cys[i + 1] - cys[i - 1], rx = s.px[2 * i] - s.px[2 * i + 1], ry = s.py[2 * i] - s.py[2 * i + 1]; E += Math.abs((rx * dx + ry * dy) / (Math.hypot(rx, ry) * Math.hypot(dx, dy) || 1)); c++; }
        const e = cys[0] < cys[N - 1] ? 0 : N - 1, ry = s.py[2 * e] - s.py[2 * e + 1], rx = s.px[2 * e] - s.px[2 * e + 1];
        sCV += cv; sC += C; sE += E / c; sF += Math.abs(ry) / (Math.hypot(rx, ry) || 1); na++;
      }
      if (tDone !== null && f > tDone * 60 + 90) break;
      if (f - lastGain > 240 && taps < 2 && tDone === null) { sd.nudge(params.push !== undefined ? params.push : 0.6); taps++; lastGain = f; } else if (f - lastGain > 780) break;
    }
    const m = na ? { CV: sCV / na, C: sC / na, E: sE / na, F: sF / na } : { CV: 1, C: 1, E: 1, F: 1 };
    const walk = bad ? 0 : Math.min(maxDesc, 4.5) / 4.5 * (tDone !== null && tDone <= 25 ? 1 : 0.4), arch = Math.min(na / 16, 1);       // the arch should last (16 samples = 4 s)
    const score = walk * 0.25 + arch * 0.35 + (1 - Math.min(m.F / 0.6, 1)) * 0.15 + (1 - Math.min(m.E / 0.6, 1)) * 0.1 + (1 - Math.min(m.C / 0.5, 1)) * 0.1 + (1 - Math.min(m.CV / 0.6, 1)) * 0.05 - Math.min(cr, 5) * 0.02 - Math.min(xo / Math.max(1, xn), 3) * 0.05;
    return { score: +score.toFixed(3), descended: +maxDesc.toFixed(2), secs: tDone, taps, archFrames: na, maxArch: +maxArch.toFixed(1), CV: +m.CV.toFixed(2), C: +m.C.toFixed(2), E: +m.E.toFixed(2), F: +m.F.toFixed(2), crossed: cr, xover: +(xo / Math.max(1, xn)).toFixed(2) };
  }
  const SPACE2 = { spring: [1000, 6000], gap: [0.12, 0.3], pack: [0.15, 0.45], grip: [0.5, 1], damping: [0, 1.2], bounce: [0, 0.6], gravity: [12, 45], push: [0.3, 1.4], archW: [1.5, 4], archH: [0.6, 2], arch: [6, 14], align: [0, 0.3], lean: [25, 70], shear: [0, 1.2], cross: [0.3, 1] };
  function start2(base) { window.__M = { it: 0, best: { ...base }, bestR: look2(base), log: [] }; return window.__M.bestR; }
  function round2(cands = 5) {
    const M = window.__M; M.it++; const span = 1 / (1 + (M.it - 1) * 0.25); let tried = 0;
    for (let c = 0; c < cands; c++) {
      const cand = { ...M.best }; for (const k in SPACE2) { if (Math.random() < 0.5) continue; const [lo, hi] = SPACE2[k]; cand[k] = Math.min(hi, Math.max(lo, (cand[k] !== undefined ? cand[k] : (lo + hi) / 2) + (Math.random() * 2 - 1) * (hi - lo) * 0.3 * span)); }
      const r = look2(cand); tried++; if (r.score > M.bestR.score) { M.best = cand; M.bestR = r; }
    }
    M.log.push({ it: M.it, score: M.bestR.score }); return { it: M.it, ...M.bestR };
  }
  // a random search on how far down the stairs it gets (and how soon), nothing else: the first question is whether it can walk at all
  const SP3 = { wireDamp: [0, 10], contactDamp: [0.02, 0.5], spin: [0, 3], damping: [0, 0.5], bounce: [0.2, 0.9], grip: [0.1, 1], gravity: [12, 45], spring: [600, 3000], contact: [10, 60], leanK: [0.2, 2], lean: [25, 60], arch: [12, 20], push: [0.5, 3], inertia: [0.3, 1.2] };
  function search3(base, cands = 40) {
    window.__S = window.__S || { best: { ...base }, bestR: walk(base), tried: 0 }; const S = window.__S;
    for (let c = 0; c < cands; c++) {
      const cand = { ...S.best }; const sc = Math.max(0.15, 1 / (1 + S.tried / 60));
      for (const k in SP3) { if (Math.random() < 0.55) continue; const [lo, hi] = SP3[k]; cand[k] = Math.min(hi, Math.max(lo, (cand[k] !== undefined ? cand[k] : (lo + hi) / 2) + (Math.random() * 2 - 1) * (hi - lo) * 0.35 * sc)); }
      const r = walk(cand); S.tried++; if (r.descended > S.bestR.descended + 0.05 || (r.descended >= S.bestR.descended - 0.05 && r.score > S.bestR.score)) { S.best = cand; S.bestR = r; }
    }
    return { tried: S.tried, ...S.bestR };
  }
  // the same search, but a candidate has to walk on several stairs at once (a lucky point that falls over when a number is rounded is no use)
  // the default stairs and its neighbours: a little more or less of a few settings, and two other stairs
  const VARIANTS = [{}, { _p: (c) => ({ arch: c.arch - 0.7 }) }, { _p: (c) => ({ arch: c.arch + 0.7 }) }, { _p: (c) => ({ lean: c.lean + 3 }) }, { _p: (c) => ({ gravity: c.gravity * 1.06 }) }, { _p: (c) => ({ spring: c.spring * 0.93 }) }, { stepW: 5.5 }, { stepW: 8.9, drop: 2.8 }];
  const robustScore = (cand) => { let tot = 0, ok = 0; const det = []; for (const v of VARIANTS) { const full = { arch: 14, lean: 42, gravity: 22.5, spring: 2131, ...cand }, extra = v._p ? v._p(full) : v; const vv = { ...v }; delete vv._p; const r = walk({ ...cand, ...vv, ...(v._p ? extra : {}) }); const d = Math.min(r.descended, 4.6); tot += d / 4.6; if (r.descended >= 4.4) ok++; det.push(r.descended); } return { score: tot / VARIANTS.length + ok * 0.12, ok, det }; };
  function search4(base, cands = 6) {
    window.__S4 = window.__S4 || { best: { ...base }, bestR: robustScore(base), tried: 0 }; const S = window.__S4;
    for (let c = 0; c < cands; c++) {
      const cand = { ...S.best }; const sc = Math.max(0.12, 1 / (1 + S.tried / 40));
      for (const k in SP3) { if (Math.random() < 0.6) continue; const [lo, hi] = SP3[k]; cand[k] = Math.min(hi, Math.max(lo, (cand[k] !== undefined ? cand[k] : (lo + hi) / 2) + (Math.random() * 2 - 1) * (hi - lo) * 0.3 * sc)); }
      const r = robustScore(cand); S.tried++; if (r.score > S.bestR.score) { S.best = cand; S.bestR = r; }
    }
    return { tried: S.tried, score: +S.bestR.score.toFixed(3), ok: S.bestR.ok, det: S.bestR.det };
  }
  return { search4, robustScore, standTest, search3, look, look2, start2, round2, start, round, gridScore, walk, dropTest, climb, crossed, lockedWalk, lockedDrop, robust };
})();
'ready';
