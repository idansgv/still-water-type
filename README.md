# idansegev.com

Interactive typographic posters about design and technology coming apart, and a quiet index of work.
Static files, no build step, no dependencies. Read [BRIEF.md](BRIEF.md) for the thinking.

```bash
python3 -m http.server 8910      # then open http://127.0.0.1:8910
node tools/build.mjs             # after changing the poster registry: rewrites p/<slug>/ share pages
bash tools/sync-moovit.sh        # rebuild the Moovit case into work/moovit
```

Dev switches: `/?p=meltdown` forces a poster, `&theme=light|dark` forces a theme, `#s=<seed>` replays a
random variation, `?live` mirrors a local Wordflow3d server in Still Water.

| Path | What |
|---|---|
| `index.html`, `src/` | The shell, the shared engine, and the posters (`src/posters/`) |
| `p/<slug>/` | Generated share pages, one per poster (link previews need their own HTML) |
| `work/` | The Work index, and the Moovit case vendored from its own repo |
| `assets/` | Favicon, touch icon, share image |
| `tools/` | Stub generator, Moovit sync, share-image maker, motion-sensor check |

The single-poster version of this site is tagged `still-water-v1`.
