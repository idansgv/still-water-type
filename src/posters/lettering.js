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
};
export const ratio = (c, w, h) => (c === 'I' ? h * 0.11 : Math.min(w * 0.25, h * (c === 'E' ? 0.1 : 0.118)));
export const radiusFor = (c, w, h) => Math.max(6, ratio(c, w, h));

