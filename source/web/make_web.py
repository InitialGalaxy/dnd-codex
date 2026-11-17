# Makes index.html (the web version for GitHub Pages) from "DnD Codex.html".
import sys, re, os
here = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "DnD Codex.html")
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, "index.html")
html = open(src, encoding="utf-8").read()
flag = '<script id="codex-local">window.__CODEX_GH = true;</script>'
html, n = re.subn(r'<script id="codex-local">[^<]*</script>', flag, html)
assert n == 1, "couldn't find the mode flag"
head = ('<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#12151b">'
        '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-title" content="Codex"><link rel="apple-touch-icon" href="icon-192.png">')
html = html.replace(flag, flag + head, 1)
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, len(html))
