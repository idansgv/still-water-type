# Fonts (local only)

Font files here are **not committed** (`.gitignore`): the ones in use are trial licences (Leida, GT Pantheon, GT Maru) and the repository is public and auto-deploys. `src/local-fonts.js` loads them when they exist, so locally the posters use them and the live site falls back to Archivo.

To ship one, buy the web licence, then remove its line from `.gitignore` (and keep the licence file next to it).

Files in use: `leida-font-family-1761628710-0/` (Still Water), `GT-Pantheon/` (Collapse), `GT-Maru/` (the Soft type test).

The live Still Water uses **Bitter** (open licence, Google Fonts); Leida is used first only where these local files exist.


## Offline copies of the open fonts (14 to 17 Oct 2026)

`assets/fonts/offline/` holds local copies of the open-licence Google fonts the site uses (Bungee Inline for Slinky type, Archivo, IBM Plex Mono and Sans), so the posters look the same with no connection. `src/local-fonts.js` loads them on localhost only (the live site keeps using Google Fonts and never asks for these files). Folder is git-ignored; on a new machine run `node tools/fetch-offline-fonts.mjs` once while online, then check with `NODE_PATH=$(npm root -g) node tools/offline-check.cjs slinky-type`.
