import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items():
    if k!='wondrous-item': docs['tags/'+k]=v
for k,v in d['entries'].items():
    v['tags']=[t for t in v['tags'] if t!='wondrous-item']; docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
docs['settings/imports']={'imageLinks':True}
for k,r in [('ikillipheir','artifact'),('iheartsheath','unique'),('iinverted-blade','unique'),('igatling-wand','divine'),('imagic-armour-zenith','divine'),('ishadow-mantle','very rare')]: docs['entries/'+k]['item']['rarity']=r
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1366,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(1200)
    print('rarity options', pg.evaluate("[...document.querySelectorAll('#irar option')].map(o=>o.textContent)"))
    pg.select_option('#irar','unique'); pg.wait_for_timeout(200); print('unique items', pg.evaluate("[...document.querySelectorAll('.cards .card h2')].map(h=>h.textContent)"))
    pg.screenshot(path='items-rar.png')
    pg.evaluate("location.hash='bestiary'"); pg.wait_for_timeout(400)
    print('rows', pg.evaluate("document.querySelectorAll('.brow').length"), 'detail', pg.evaluate("(document.querySelector('.bdhead h2')||{}).textContent"))
    pg.select_option('#bsort','cr'); pg.wait_for_timeout(200)
    print('top by CR', pg.evaluate("[...document.querySelectorAll('.brow .bname')].slice(0,3).map(x=>x.textContent)"))
    pg.click('.brow[data-id=cmanticore]'); pg.wait_for_timeout(300)
    print('after click hash', pg.evaluate('location.hash'), 'detail', pg.evaluate("document.querySelector('.bdhead h2').textContent"))
    pg.screenshot(path='bestiary-pc.png')
    pg.set_viewport_size({'width':390,'height':844}); pg.wait_for_timeout(300)
    pg.screenshot(path='bestiary-phone.png')
    pg.click('.brow[data-id=cgriffon]'); pg.wait_for_timeout(300); print('phone click hash', pg.evaluate('location.hash'))
    b.close()
print('ERRORS',errs)
