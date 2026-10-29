// The letters the poster family is built from: each one a few skeleton strokes in a unit box
// (x from -.3 to +.3, y from -.35 to +.35, y down), plus how thick a stroke should be for a given letter size.
// Shared by Soft type and Columns.

// ---- skeletons: unit box, x in -.3..+.3, y in -.35..+.35 (y down) ----
export const line = (...p) => ({ pts: p.map(([x, y]) => ({ x, y })), sharp: true });
export function arc(a0, a1, cx = 0, cy = 0, rx = 0.31, ry = 0.35, closed = false) {
  const n = 28;
  return { closed, pts: Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }; }) };
}
const PI = Math.PI;
export const SKELETON = {
  I: { wf: 0.34, s: () => [line([0, -0.35], [0, 0.35])] },
  D: { wf: 0.86, s: () => [line([-0.3, -0.35], [-0.3, 0.35]), arc(-PI / 2, PI / 2, -0.3, 0, 0.6, 0.35)] },
  A: { wf: 0.98, s: () => [line([-0.3, 0.35], [0, -0.35], [0.3, 0.35]), line([-0.19, 0.1], [0.19, 0.1])] },
  N: { wf: 0.9, s: () => [line([-0.3, 0.35], [-0.3, -0.35], [0.3, 0.35], [0.3, -0.35])] },
  S: { wf: 0.78, s: () => {
    const top = arc(-0.15 * PI, -1.5 * PI, 0, -0.175, 0.29, 0.175), bot = arc(-0.5 * PI, 0.85 * PI, 0, 0.175, 0.29, 0.175);
    return [{ pts: top.pts.concat(bot.pts.slice(1)) }];
  } },
  E: { wf: 0.76, s: () => [line([-0.29, -0.35], [-0.29, 0.35]), line([-0.29, -0.35], [0.3, -0.35]), line([-0.29, 0], [0.22, 0]), line([-0.29, 0.35], [0.3, 0.35])] },
  G: { wf: 0.92, s: () => [arc(-0.28 * PI, -2 * PI, 0, 0, 0.31, 0.35), line([0.31, 0.02], [0.04, 0.02])] },
  V: { wf: 0.98, s: () => [line([-0.3, -0.35], [0, 0.35], [0.3, -0.35])] },
  // the rest of the alphabet (29 Oct 2026), so a visitor's own name can be set: the same geometric monoline
  B: { wf: 0.8, s: () => [line([-0.3, -0.35], [-0.3, 0.35]), arc(-PI / 2, PI / 2, -0.3, -0.175, 0.52, 0.175), arc(-PI / 2, PI / 2, -0.3, 0.175, 0.6, 0.175)] },
  C: { wf: 0.88, s: () => [arc(-0.25 * PI, -1.75 * PI, 0, 0, 0.31, 0.35)] },
  F: { wf: 0.72, s: () => [line([-0.29, 0.35], [-0.29, -0.35], [0.3, -0.35]), line([-0.29, 0], [0.2, 0])] },
  H: { wf: 0.9, s: () => [line([-0.3, -0.35], [-0.3, 0.35]), line([0.3, -0.35], [0.3, 0.35]), line([-0.3, 0], [0.3, 0])] },
  J: { wf: 0.66, s: () => [{ pts: line([0.3, -0.35], [0.3, 0.1]).pts.concat(arc(0, PI, 0, 0.1, 0.3, 0.25).pts.slice(1)) }] },
  K: { wf: 0.84, s: () => [line([-0.3, -0.35], [-0.3, 0.35]), line([0.3, -0.35], [-0.3, 0.06]), line([-0.1, -0.08], [0.3, 0.35])] },
  L: { wf: 0.68, s: () => [line([-0.3, -0.35], [-0.3, 0.35], [0.3, 0.35])] },
  M: { wf: 1.1, s: () => [line([-0.3, 0.35], [-0.3, -0.35], [0, 0.15], [0.3, -0.35], [0.3, 0.35])] },
  O: { wf: 0.96, s: () => [arc(0, 2 * PI, 0, 0, 0.31, 0.35, true)] },
  P: { wf: 0.78, s: () => [line([-0.3, 0.35], [-0.3, -0.35]), arc(-PI / 2, PI / 2, -0.3, -0.12, 0.6, 0.23)] },
  Q: { wf: 0.96, s: () => [arc(0, 2 * PI, 0, 0, 0.31, 0.35, true), line([0.08, 0.15], [0.33, 0.4])] },
  R: { wf: 0.82, s: () => [line([-0.3, 0.35], [-0.3, -0.35]), arc(-PI / 2, PI / 2, -0.3, -0.12, 0.6, 0.23), line([-0.04, 0.11], [0.3, 0.35])] },
  T: { wf: 0.8, s: () => [line([-0.3, -0.35], [0.3, -0.35]), line([0, -0.35], [0, 0.35])] },
  U: { wf: 0.88, s: () => [{ pts: line([-0.3, -0.35], [-0.3, 0.05]).pts.concat(arc(PI, 0, 0, 0.05, 0.3, 0.3).pts.slice(1), line([0.3, 0.05], [0.3, -0.35]).pts.slice(1)) }] },
  W: { wf: 1.2, s: () => [line([-0.3, -0.35], [-0.15, 0.35], [0, -0.1], [0.15, 0.35], [0.3, -0.35])] },
  X: { wf: 0.9, s: () => [line([-0.3, -0.35], [0.3, 0.35]), line([0.3, -0.35], [-0.3, 0.35])] },
  Y: { wf: 0.9, s: () => [line([-0.3, -0.35], [0, 0]), line([0.3, -0.35], [0, 0], [0, 0.35])] },
  Z: { wf: 0.82, s: () => [line([-0.3, -0.35], [0.3, -0.35], [-0.3, 0.35], [0.3, 0.35])] },
  '-': { wf: 0.5, s: () => [line([-0.2, 0.02], [0.2, 0.02])] },
  "'": { wf: 0.3, s: () => [line([0, -0.35], [0, -0.14])] },
};
// A name in these letters: capitals, accents dropped (É is E), anything without a skeleton left out.
export const lettered = (s) => [...s.toLocaleUpperCase().normalize('NFD').replace(/\p{M}/gu, '')].filter((c) => SKELETON[c]).join('');
export const ratio = (c, w, h) => (c === 'I' ? h * 0.11 : Math.min(w * 0.25, h * (c === 'E' ? 0.1 : 0.118)));
export const radiusFor = (c, w, h) => Math.max(6, ratio(c, w, h));

