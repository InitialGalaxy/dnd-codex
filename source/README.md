# Building

`python3 build.py` (run in this folder) joins the scripts into `chars_app.js` and writes `index.html`
and `DnD Codex.html`. Copy `DnD Codex.html` and `server/server.js` to the top of the repository to release.

`test/` holds the browser tests (Playwright). They expect a library file at `/tmp/libfile.json`.
