# Still Water

Interactive typographic posters about design and technology coming apart. Each one is the name "Idan Segev" set in type you can touch: ripple it, tear it, pour it. Refresh for another.

**Live site:** https://idansegev.com

## How to play

- **Touch it.** Click, drag or tap the poster. Each one responds differently.
- **Shuffle** (or press space or →) for another poster.
- **Posters** in the top-left corner lists them all. Each has a **Copy prompt** button that copies a brief for recreating that poster in your own AI tool.
- **Share** copies a link to the exact variation you're looking at.

## The posters

| Poster | What it does |
|---|---|
| Still Water | Type that remembers every touch. Ripples, and a lamp if you find it. |
| Soft | Letters made of one soft material. Drag them, squash them, hold one until it pops. |
| Collapse | Flat type that is really standing columns. Knock one over and watch them fall on each other. |
| Shatter | Flat type that is really solid. Touch a letter and it shatters, and the pieces set off the rest. |
| Splintered | Polished type. Touch it and it blows apart toward you, then slows to a drift. Hold to rewind. |
| Goblet | Every letter is a chubby glass bottle half full of ink. Pick one up and the ink sloshes. |
| Liquid metal | The name as liquid metal: black, with a few bright highlights. Pull it, scatter it, fuse it. |
| Slinky | Solid letters that are really coiled Slinkys. Tap one and it springs free. |
| Fan | The name, cut into strips that fan, scatter and snap back. |
| Rain | Heavy type the colour of the page. Rain follows you and leaves its mark. |
| Fontapalloza | Every letter in a different typeface. Hover to swap one, press to make them all go. |
| Marbled | The name floats as ink on water. Stir it, comb it, drop more ink. |
| Glint | Black type on black, seen only where a small lamp catches its edges. |
| Splat type | The name as thousands of soft splats. Press to scatter them; they drift home. |
| Wash | A wet brush writes the name in watercolour. Drag through it; double tap to blot. |
| Brandbook | A black-and-white brand book for a venture that does not exist. Click to rebrand it. |
| Crystallize | A Voronoi crackle where the name is never drawn: cells split until it shows. |
| Torn | The name cut from cloth and hung from pegs. Pull hard enough to tear it. |
| Moonlit | The name is a slick on a moonlit sea: the letters stay glassy and dark. |

## Run it locally

```bash
python3 tools/dev.py          # then open http://127.0.0.1:8910
node tools/build.mjs          # after changing the poster list: rebuilds the share pages
```

Useful URL options: `/?p=soft-type` opens a specific poster, `&theme=light` or `&theme=dark` forces a theme, and `#s=<seed>` replays a variation.

## How it's built

Plain HTML, CSS and JavaScript with no build step. Each poster is a module in `src/posters/`, and `index.html` plus `src/` hold the shell. Share pages in `p/<slug>/` are generated so link previews show each poster's own title and image.
