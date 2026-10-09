// A ring that is not a circle: the outline of a letter (from glyph-contours.js), for a slinky of letter-shaped coils. The cap height spans the rod (so the letter stands along the
// ring's rod and its width runs through the depth), in units of the ring's radius: u along the rod, z in depth.
import { glyphContours } from './glyph-contours.js';

const cache = new Map();
export function ringShape(text) {
  const ch = text ? [...String(text)][0] : '';
  if (!ch || ch === ' ') return null;
  if (cache.has(ch)) return cache.get(ch);
  let loops = null;
  try { const gc = glyphContours(ch, 'Arial Black, Helvetica Neue, Helvetica, sans-serif', 900, 120, 0.06); loops = gc.loops.map((l) => l.pts.map(([x, y]) => [y / 0.5, x / 0.5])); } catch (e) { loops = null; }   // [u, z] in radii
  cache.set(ch, loops); return loops;
}
