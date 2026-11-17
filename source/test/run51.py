import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type in('warning','error') and errs.append(m.text))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#entry-cmarshspear'); pg.wait_for_timeout(5000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.goto('http://localhost:8765/index.html#encounters'); pg.wait_for_timeout(800)
    print('nav', pg.locator('[data-nav=encounters].on').count())
    pg.click('[data-act=encnew] >> nth=0'); pg.wait_for_timeout(400)
    pg.fill('.encname','Swamp ambush'); pg.locator('.encname').dispatch_event('change'); pg.wait_for_timeout(300)
    for n in ['Marshspear','Briar Gullet','Briar Gullet']:
        pg.fill('#encq', n); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    print('rows', pg.locator('.encmon').count(), pg.evaluate("[...document.querySelectorAll('.encbig strong')].map(x=>x.textContent)"))
    pg.click('.encmon >> nth=0 >> [data-act=encn][data-v="1"]'); pg.wait_for_timeout(300)
    print('after +1', pg.evaluate("[...document.querySelectorAll('.encbig strong')].map(x=>x.textContent)"), pg.evaluate("[...document.querySelectorAll('.encbig .muted')].map(x=>x.textContent)"))
    pg.click('.encmon >> nth=1 >> [data-act=encopen]'); pg.wait_for_timeout(300)
    print('sb open', pg.locator('.encsb .statblock').count())
    pg.screenshot(path='enc-a.png', full_page=True)
    pg.uncheck('[data-encparty=csaahan]'); pg.wait_for_timeout(300)
    print('one pc', pg.evaluate("[...document.querySelectorAll('.encbig strong')].map(x=>x.textContent)"))
    pg.uncheck('[data-encparty=cvakryn]'); pg.wait_for_timeout(300)
    print('manual', pg.locator('[data-encf=size]').count(), pg.evaluate("[...document.querySelectorAll('.encbig strong')].map(x=>x.textContent)"))
    # from creature page
    pg.goto('http://localhost:8765/index.html#entry-cchangelisk'); pg.wait_for_timeout(600)
    pg.click('[data-act=encto]'); pg.wait_for_timeout(400)
    print('saved', pg.evaluate("[...S.encs.values()].map(e=>[e.name,e.mons])"))
    pg.locator('.encto').screenshot(path='enc-b.png')
    b.close()
print('ERRORS',errs)
