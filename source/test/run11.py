import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#bestiary'); pg.wait_for_timeout(1200)
    pg.click('#beasttags summary'); pg.wait_for_timeout(300)
    print('groups', pg.evaluate("[...document.querySelectorAll('.tpgroup summary')].map(s=>s.innerText.replace(/\\n/,' '))"))
    pg.screenshot(path='tagpick.png')
    pg.click('.tpgroup[data-root=dragon] summary'); pg.wait_for_timeout(150)
    pg.click('.pchip[data-v=fire-breather]'); pg.wait_for_timeout(300)
    print('still open', pg.evaluate("document.getElementById('beasttags').open"), 'rows', pg.evaluate("document.querySelectorAll('.brow').length"), 'dragon group open', pg.evaluate("document.querySelector('.tpgroup[data-root=dragon]').open"))
    pg.fill('#tagq','class'); pg.wait_for_timeout(200)
    print('search visible chips', pg.evaluate("[...document.querySelectorAll('.tpchips .pchip')].filter(c=>!c.hidden && c.offsetParent).map(c=>c.dataset.name)"))
    pg.screenshot(path='tagpick2.png')
    pg.mouse.click(1250, 850); pg.wait_for_timeout(200); print('closed on outside click', not pg.evaluate("document.getElementById('beasttags').open"))
    pg.set_viewport_size({'width':390,'height':844}); pg.click('#beasttags summary'); pg.wait_for_timeout(300); pg.fill('#tagq',''); pg.wait_for_timeout(200)
    pg.screenshot(path='tagpick-phone.png')
    b.close()
print('ERRORS',errs)
