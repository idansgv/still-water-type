// The posters' own words when a visitor hasn't set a name: an album title, drawn at random.
// Every title passes validateName (src/name.js), so it sets like a name: one line per word, up to 14 characters.
// Each viewer walks a shuffled deck, remembered in their browser, so they don't see a title again until they've seen them all.

export const ALBUMS = [
  ['Rubber Soul', 'The Beatles'], ['Revolver', 'The Beatles'], ['Abbey Road', 'The Beatles'], ['Let It Be', 'The Beatles'],
  ['Pet Sounds', 'The Beach Boys'], ['Blue', 'Joni Mitchell'], ['Hejira', 'Joni Mitchell'], ['Thriller', 'Michael Jackson'],
  ['Off the Wall', 'Michael Jackson'], ['Purple Rain', 'Prince'], ['Nevermind', 'Nirvana'], ['In Utero', 'Nirvana'],
  ['OK Computer', 'Radiohead'], ['Kid A', 'Radiohead'], ['Amnesiac', 'Radiohead'], ['In Rainbows', 'Radiohead'],
  ['The Bends', 'Radiohead'], ['Graceland', 'Paul Simon'], ['Kind of Blue', 'Miles Davis'], ['Bitches Brew', 'Miles Davis'],
  ['A Love Supreme', 'John Coltrane'], ['Blue Train', 'John Coltrane'], ['Time Out', 'The Dave Brubeck Quartet'], ['Mingus Ah Um', 'Charles Mingus'],
  ['Hunky Dory', 'David Bowie'], ['Low', 'David Bowie'], ['Heroes', 'David Bowie'], ['Blackstar', 'David Bowie'],
  ['Let It Bleed', 'The Rolling Stones'], ['Sticky Fingers', 'The Rolling Stones'], ['Harvest', 'Neil Young'], ['Astral Weeks', 'Van Morrison'],
  ['Pink Moon', 'Nick Drake'], ['Horses', 'Patti Smith'], ['Marquee Moon', 'Television'], ['Parallel Lines', 'Blondie'],
  ['London Calling', 'The Clash'], ['Closer', 'Joy Division'], ['Loveless', 'My Bloody Valentine'], ['Screamadelica', 'Primal Scream'],
  ['Doolittle', 'Pixies'], ['Surfer Rosa', 'Pixies'], ['Ten', 'Pearl Jam'], ['Dummy', 'Portishead'],
  ['Mezzanine', 'Massive Attack'], ['Blue Lines', 'Massive Attack'], ['Homogenic', 'Björk'], ['Violator', 'Depeche Mode'],
  ['Lust for Life', 'Iggy Pop'], ['Ready to Die', 'The Notorious B.I.G.'], ['Aquemini', 'OutKast'], ['Stankonia', 'OutKast'],
  ['Parklife', 'Blur'], ['Yeezus', 'Kanye West'], ['Graduation', 'Kanye West'], ['Blonde', 'Frank Ocean'],
  ['Channel Orange', 'Frank Ocean'], ['Frank', 'Amy Winehouse'], ['Back to Black', 'Amy Winehouse'], ['Ctrl', 'SZA'],
  ['1989', 'Taylor Swift'], ['21', 'Adele'], ['Discovery', 'Daft Punk'], ['Moon Safari', 'Air'],
  ['Sea Change', 'Beck'], ['Rain Dogs', 'Tom Waits'], ['Bone Machine', 'Tom Waits'], ['Blood Money', 'Tom Waits'],
  ['Closing Time', 'Tom Waits'], ['Geogaddi', 'Boards of Canada'], ['Inferno', 'Boards of Canada'], ['SOS', 'SZA'],
  ['GNX', 'Kendrick Lamar'], ['DAMN', 'Kendrick Lamar'], ['ye', 'Kanye West'], ['Demon Days', 'Gorillaz'],
  ['Plastic Beach', 'Gorillaz'], ['Donuts', 'J Dilla'], ['Half Moon Bay', 'Bill Evans'], ['On the Beach', 'Neil Young'],
  ['Harvest Moon', 'Neil Young'], ['Wish', 'The Cure'], ['Bryter Layter', 'Nick Drake'], ['Dream River', 'Bill Callahan'],
  ['Skeleton Tree', 'Nick Cave & The Bad Seeds'], ['Play', 'Moby'], ['Cheat Codes', 'Danger Mouse'], ['Wildflower', 'The Avalanches'],
  ['Odelay', 'Beck'], ['Mutations', 'Beck'], ['Fun House', 'The Stooges'], ['The Idiot', 'Iggy Pop'],
  ['Old Ideas', 'Leonard Cohen'], ['Dirt', 'Alice In Chains'], ['Stony Hill', 'Damian Marley'], ['Third', 'Portishead'],
  ['Giant Steps', 'John Coltrane'], ['Ascension', 'John Coltrane'], ['Knock Knock', 'Smog'], ['Person Pitch', 'Panda Bear'],
  ['Treasure', 'Cocteau Twins'], ['Endless Summer', 'Fennesz'], ["X's", 'Cigarettes After Sex'], ['Black Earth', 'Bohren & Der Club Of Gore'],
  ['Raw Power', 'The Stooges'], ['Longing', 'Bell Witch'], ['18', 'Moby'], ['Black One', 'sunn O)))'],
  ['Travel', 'The Necks'], ['Bleed', 'The Necks'], ['Piñata', 'Freddie Gibbs'], ['Mosaic', 'Fennesz'],
  ['Venice', 'Fennesz'], ['Meditations', 'John Coltrane'], ['Natty Dread', 'Bob Marley & The Wailers'], ['Uprising', 'Bob Marley & The Wailers'],
  ['Squared Roots', 'Seefeel'], ['Small Change', 'Tom Waits'], ['Blue Valentine', 'Tom Waits'], ['Alice', 'Tom Waits'],
  ['Bad as Me', 'Tom Waits'], ['Real Gone', 'Tom Waits'], ['Hi Scores', 'Boards of Canada'], ['Sun', 'Cat Power'],
  ['Ruff Draft', 'J Dilla'], ['Talkie Walkie', 'Air'], ['Homework', 'Daft Punk'], ['Go', 'Dexter Gordon'],
  ['Sleep', 'Max Richter'], ['Drumming', 'Steve Reich'], ['The Blueprint', 'JAY-Z'],
];

const KEY = 'swt:albums';
let deck = null;   // indexes into ALBUMS still to come for this viewer

function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v) && v.length && v.every((i) => Number.isInteger(i) && ALBUMS[i])) return v; } catch (e) { /* private mode, or junk */ }
  const fresh = ALBUMS.map((_, i) => i);
  for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
  return fresh;
}

// The next album title for this viewer.
export function nextAlbum() {
  if (!deck || !deck.length) deck = load();
  const [title, artist] = ALBUMS[deck.shift()];
  try { if (deck.length) localStorage.setItem(KEY, JSON.stringify(deck)); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  return { title, artist };
}
