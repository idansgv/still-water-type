// The visitor's own name for the posters that take one. Letters, spaces, hyphens and apostrophes, up to NAME_MAX characters.
// Each space starts a new line in the poster, so the name is handed to a poster as its words.

export const NAME_MAX = 14;
const ALLOWED = /^[\p{L}\p{M}0-9' -]+$/u;

// Returns { name } for a usable name, or { error } with a short message for the editor.
export function validateName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return { error: 'Type a name, or reset.' };
  if (name.length > NAME_MAX) return { error: `Up to ${NAME_MAX} characters.` };
  if (!ALLOWED.test(name)) return { error: 'Letters, numbers, spaces, hyphens and apostrophes only.' };
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

// On a tall, narrow screen a long word would set small, so a word of LONG_WORD letters or more is broken over two lines, near
// its middle and between two consonants where it can be (VALEN / TINE, SCREAMA / DELICA).
export const LONG_WORD = 8;
const VOWEL = /[aeiouyàáâãäåèéêëìíîïòóôõöùúûüæø]/i;
const PAIR = /^(ck|ch|sh|th|ph|wh|gh|qu|[bcdfgpt][lr]|s[cklmnpqtw]|tw)$/i;   // letters that stay together: BLACK / STAR, not BLAC / KSTAR
export function breakLong(words) {
  if (!words) return words;
  return words.flatMap((w) => {
    if ([...w].length < LONG_WORD) return [w];
    const ch = [...w], mid = ch.length / 2;
    let best = Math.round(mid), cost = Infinity;
    for (let i = 3; i <= ch.length - 3; i++) {
      const a = ch[i - 1], b = ch[i], c = ch[i + 1] || '', con = (x) => /\p{L}/u.test(x) && !VOWEL.test(x);
      const soft = con(a) && con(b) && !PAIR.test(a + b) || VOWEL.test(a) && con(b) && (VOWEL.test(c) || PAIR.test(b + c));
      const k = Math.abs(i - mid) + (soft ? 0 : 1.5);
      if (k < cost) { cost = k; best = i; }
    }
    return [ch.slice(0, best).join(''), ch.slice(best).join('')];
  });
}

// For a poster: the lines it sets. The visitor's words, one per line (in capitals for a poster set in capitals), or its own lines.
export function linesFor(stage, own, { upper = false } = {}) {
  if (!stage.words || !stage.words.length) return own;
  return upper ? stage.words.map((w) => w.toLocaleUpperCase()) : stage.words.slice();
}
// The letters a poster has to load a font subset for: its own, plus the visitor's.
export function lettersFor(stage, own) {
  return stage.words ? own + stage.words.join('') + stage.words.join('').toLocaleUpperCase() : own;
}
