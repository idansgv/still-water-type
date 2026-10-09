// The settings the two Slinky scenes (the factory and the stairs) share: one object, so a slider moved in one is moved in the other, and Reset puts both back. Each scene keeps
// its own few (the stream, the stairs, the start pose). The scenes see them through `bindParams`, as plain properties.
export const SHARED_DEFAULTS = {                     // Idan's hand-tuned set (10 Oct 2026)
  size: 0.11, wire: 0.03,                            // coil radius (of the shorter side), drawn wire thickness (of the radius)
  spring: 1392, gap: 0.035,                          // wire stiffness, closest coils (of the radius)
  gravity: 22.5, grip: 0.42, damping: 0.21, bounce: 0.6,   // gravity (radii per s^2), friction, air drag, bounce
  wireDamp: 7, contact: 21, contactDamp: 0.02, inertia: 0.45, lean: 58, leanK: 0.25, spin: 1.7, shear: 0, square: 0,   // wire damping, ring on ring stiffness and damping, ring inertia, lean limit (deg) and how hard it is held, spin damping, diagonal wire, rings square to the path
  turn: 4, turnReach: 10, turnDelay: 2, endFlat: 1.85, capInertia: 3,   // the ring in hand turns with the move, how many rings it carries along and how late each is, end rings lie flat, caps' weight
};
const GEOMETRY = ['size', 'gap'];                    // changing these means a scene has to be formed again
export function bindParams(shared, own) {
  const P = { ...own };
  for (const k of Object.keys(SHARED_DEFAULTS)) Object.defineProperty(P, k, { enumerable: true, get: () => shared[k], set: (v) => { shared[k] = v; if (GEOMETRY.includes(k)) shared.__geom = (shared.__geom || 0) + 1; } });
  return P;
}
