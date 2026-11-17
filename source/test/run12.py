import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={'tags/'+k:v for k,v in d['tags'].items()}; docs.update({'entries/'+k:v for k,v in d['entries'].items()})
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_page(viewport={'width':1300,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(1200)
    pg.click('[data-act=new][data-type],header [data-act=new]'); pg.wait_for_timeout(300)
    pg.fill('#ed-title','Longsword'); pg.select_option('#ed-type','item'); pg.wait_for_timeout(100)
    pg.uncheck('#it-magical'); pg.wait_for_timeout(100)
    print('rarity hidden', pg.evaluate("document.querySelector('#ed-rarity').closest('label').hidden"), 'attune hidden', pg.evaluate("document.querySelector('#it-attune').closest('label').hidden"))
    pg.select_option('#it-cat','Martial weapon'); pg.fill('#it-base','longsword'); pg.select_option('#it-propsel','versatile'); pg.click('[data-act=itaddprop]'); pg.keyboard.type('1d10')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
    print('page rarity label', pg.inner_text('.irar'), '| line', pg.inner_text('.isub'))
    pg.evaluate("location.hash='items'"); pg.wait_for_timeout(300)
    print('nav', pg.inner_text('[data-nav=items]'), '| h1', pg.inner_text('main h1'), '| bars', pg.evaluate("[...document.querySelectorAll('.kindseg button')].map(b=>b.innerText.replace(/\\n/g,' '))"))
    pg.click('[data-act=imagic][data-v=mundane]'); pg.wait_for_timeout(200)
    print('mundane cards', pg.evaluate("[...document.querySelectorAll('.cards .card h2')].map(h=>h.textContent)"))
    pg.click('[data-act=imagic][data-v=""]'); pg.wait_for_timeout(200); pg.screenshot(path='items3.png')
    pg.evaluate("location.hash='home'"); pg.wait_for_timeout(300); print('home tile', pg.inner_text('.tile[data-go=items] header'))
    b.close()
print('ERRORS',errs)
