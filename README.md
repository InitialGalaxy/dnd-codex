# DnD Codex

A D&D lore, character and virtual-tabletop app that runs on your own computer.

**To use it:** download this repository (Code → Download ZIP), unzip it into a folder, and double-click
`Start DnD Codex.bat`. You need [Node.js](https://nodejs.org) installed. See `README.txt` for everything else.

**To update it:** double-click `Update Codex.bat`. Your library, pictures and passwords are kept.

**On your phone:** https://initialgalaxy.github.io/dnd-codex/ (the web version). It keeps your library on the device,
works offline, and syncs with your private library repository using a key only you have. Without the key it's an
empty codex.

## What's here

| | |
|---|---|
| `DnD Codex.html`, `server.js`, `*.bat`, `dict-en.txt`, `README.txt` | the ready-to-run app |
| `index.html`, `sw.js`, `manifest.webmanifest`, `icon-*.png` | the web version (GitHub Pages) |
| `source/` | the code it's built from (`python3 source/build.py`, then `python3 source/web/make_web.py`) |

No campaign data lives in this repository: `library.json`, `images/`, `backups/` and `codex-config.json`
stay on your computer and are ignored by git.
