# Building

`python3 build.py` (run in this folder) joins the scripts into `chars_app.js` and writes `index.html`
and `DnD Codex.html`. Copy `DnD Codex.html` and `server/server.js` to the top of the repository to release.

`test/` holds the browser tests (Playwright). They expect a library file at `/tmp/libfile.json`.

The web version: `python3 web/make_web.py "DnD Codex.html" web/index.html` turns the built page into `index.html`
for GitHub Pages; copy it with `web/sw.js`, `web/manifest.webmanifest` and the icons to the top of the repository.
