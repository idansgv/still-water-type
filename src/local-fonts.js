// Local font files. The licensed or trial fonts Idan tries (Leida, GT Pantheon, GT Maru) live in assets/fonts, which is NOT
// committed (they are trial licences and the repository is public), so on the live site these files are simply absent and
// every poster falls back to the Google fonts it was built with. Locally, the files load here and the posters pick them up.
const DIR = 'assets/fonts/';
const FILES = [
  ['Leida', 200, 'leida-font-family-1761628710-0/LeidaTrial-ExtraLight-BF6476af5861e6a.otf'],
  ['Leida', 300, 'leida-font-family-1761628710-0/LeidaTrial-Light-BF6476af58722bb.otf'],
  ['Leida', 350, 'leida-font-family-1761628710-0/LeidaTrial-Book-BF6476af585c98f.otf'],
  ['Leida', 500, 'leida-font-family-1761628710-0/LeidaTrial-Medium-BF6476af5862cd0.otf'],
  ['Leida', 900, 'leida-font-family-1761628710-0/LeidaTrial-Black-BF6476af5832542.otf'],
  ['Leida', 800, 'leida-font-family-1761628710-0/LeidaTrial-ExtraBold-BF6476af5869da1.otf'],
  ['Leida', 700, 'leida-font-family-1761628710-0/LeidaTrial-Bold-BF6476af585fde7.otf'],
  ['Leida', 400, 'leida-font-family-1761628710-0/LeidaTrial-Regular-BF6476af586cf25.otf'],
  ['GT Pantheon', 900, 'GT-Pantheon/GT-Pantheon-Display-Black-Trial.woff2'],
  ['GT Pantheon', 700, 'GT-Pantheon/GT-Pantheon-Display-Bold-Trial.woff2'],
  ['GT Pantheon', 400, 'GT-Pantheon/GT-Pantheon-Display-Regular-Trial.woff2'],
  ['GT Maru', 900, 'GT-Maru/GT-Maru-Black-Trial.woff2'],
  ['GT Maru', 700, 'GT-Maru/GT-Maru-Bold-Trial.woff2'],
  ['GT Maru', 500, 'GT-Maru/GT-Maru-Medium-Trial.woff2'],
  ['GT Maru', 400, 'GT-Maru/GT-Maru-Regular-Trial.woff2'],
];
let done = null;
export function registerLocalFonts() {
  return (done ??= Promise.all(FILES.map(async ([family, weight, file]) => {
    try {
      const f = new FontFace(family, `url("${DIR}${file}")`, { weight: String(weight) });
      await f.load();
      document.fonts.add(f);
      return true;
    } catch (e) { return false; }                                    // not present (the live site): fall back silently
  })));
}
