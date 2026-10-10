// The gesture standard (docs/PIPELINE.md, docs/INTERACTIONS.md). Every poster that graduates to published uses these numbers,
// so a tap, a hold and a double tap mean the same thing everywhere. Three quick taps (reveal) live in the engine and use TAP too.
export const TAP = { ms: 250, px: 8 };      // a tap: released within ms, moved less than px
export const HOLD_MS = 250;                  // a hold: still for this long (a poster decides what it does; none is also fine)
export const DOUBLE_MS = 380;                // two taps on empty space this close: re-form (if the poster has one), a beat later so a third tap can still mean reveal
export const REFORM_DELAY_MS = 420;

/** Tracks one press. down(q, id) on pointer down, move(q) on move, up(q, id) on up; up returns { tap, hold, ms, moved } or null for another pointer. */
export function pressTracker() {
  let d = null;
  return {
    get active() { return !!d; },
    get ms() { return d ? performance.now() - d.t : 0; },
    get moved() { return d ? d.moved : 0; },
    /** still, and down for HOLD_MS or more: use in the frame loop for a hold action */
    get holding() { return !!d && d.moved < TAP.px && performance.now() - d.t >= HOLD_MS; },
    down(q, id) { if (d) return false; d = { x: q.x, y: q.y, t: performance.now(), id, moved: 0 }; return true; },
    move(q, id) { if (d && (id === undefined || id === d.id)) d.moved = Math.max(d.moved, Math.hypot(q.x - d.x, q.y - d.y)); },
    up(q, id) {
      if (!d || (id !== undefined && id !== d.id)) return null;
      this.move(q, id);
      const ms = performance.now() - d.t, moved = d.moved, r = { tap: moved < TAP.px && ms < TAP.ms, hold: moved < TAP.px && ms >= HOLD_MS, ms, moved };
      d = null; return r;
    },
    cancel() { d = null; },
  };
}
