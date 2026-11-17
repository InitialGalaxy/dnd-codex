import json,time
from playwright.sync_api import sync_playwright
exec(open('run16.py').read().split("    pg.goto('http://localhost:8765/index.html#char-csaahan')")[0].replace("with sync_playwright() as p:","p=sync_playwright().start()\nif 1:"))
pg.goto('http://localhost:8765/index.html#books'); pg.wait_for_timeout(1500)
pg.screenshot(path='books.png', full_page=True)
for b in ['srd-rules','srd-classes','srd-spells']:
  t=time.time(); pg.goto('http://localhost:8765/index.html#book-'+b); pg.wait_for_timeout(300)
  print(b, round(time.time()-t,2), pg.evaluate("document.querySelectorAll('.toc li').length"))
pg.screenshot(path='book-spells.png')
pg.evaluate("document.querySelectorAll('.bookprose h3')[40].scrollIntoView()"); pg.wait_for_timeout(200); pg.screenshot(path='book-spells2.png')
print(errs)
