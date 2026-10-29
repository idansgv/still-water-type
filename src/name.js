// The visitor's own name for the posters that take one. Letters, spaces, hyphens and apostrophes, up to NAME_MAX characters.
// Each space starts a new line in the poster, so the name is handed to a poster as its words.

export const NAME_MAX = 14;
const ALLOWED = /^[\p{L}\p{M}' -]+$/u;

// Returns { name } for a usable name, or { error } with a short message for the editor.
export function validateName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return { error: 'Type a name, or reset to Idan Segev.' };
  if (name.length > NAME_MAX) return { error: `Up to ${NAME_MAX} characters.` };
  if (!ALLOWED.test(name)) return { error: 'Letters, spaces, hyphens and apostrophes only.' };
  return { name };
}

// Stored per viewer, never sent anywhere. Storage can be blocked (private windows), so every access is guarded.
const KEY = 'swt:name';
export function savedName() {
  try { const v = localStorage.getItem(KEY); return v && validateName(v).name || null; } catch (e) { return null; }
}
export function saveName(name) {
  try { if (name) localStorage.setItem(KEY, name); else localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
}

// The words a poster is given: null means the poster keeps its own name.
export function nameWords(name) {
  return name ? name.split(' ') : null;
}
