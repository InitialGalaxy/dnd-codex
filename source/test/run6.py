import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
docs['settings/imports']={'imageLinks':True}
docs['entries/ikillipheir']['item']['rarity']='divine'; docs['entries/ishadow-mantle']['item']['rarity']='unique'
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#world'); pg.wait_for_timeout(1200)
    pg.set_input_files('#mapfile','/mnt/user-data/uploads/dnd/Dryrones 2026-10-13-18-00.map'); pg.wait_for_function("document.querySelector('table.towns')",timeout=20000)
    pg.evaluate("location.hash='home'"); pg.wait_for_timeout(800)
    print('map thumb dots', pg.evaluate("document.querySelectorAll('.thumb circle').length"), 'land', pg.evaluate("(document.querySelector('#land')||{}).getAttribute ? document.querySelector('#land').getAttribute('href').length : 0"))
    pg.locator('.tile[data-go=world]').screenshot(path='worldtile.png')
    print('route home?', pg.evaluate("!!document.querySelector('.tiles')"), 'tiles', pg.evaluate("document.querySelectorAll('.tile').length"))
    pg.screenshot(path='home.png', full_page=True)
    pg.click('.tile[data-go=books] header'); pg.wait_for_timeout(200); print('tile click ->', pg.evaluate('location.hash'))
    pg.evaluate("location.hash='home'"); pg.wait_for_timeout(300)
    pg.fill('#homeq','manti'); pg.wait_for_timeout(1000); print('search ->', pg.evaluate('location.hash'), pg.evaluate("document.querySelectorAll('.cards .card').length"))
    pg.set_viewport_size({'width':390,'height':844}); pg.evaluate("location.hash='home'"); pg.wait_for_timeout(500)
    pg.screenshot(path='home-phone.png')
    b.close()
print('ERRORS',errs)
