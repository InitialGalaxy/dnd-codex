import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={'tags/'+k:v for k,v in d['tags'].items()}; docs.update({'entries/'+k:v for k,v in d['entries'].items()})
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
def newitem(pg, title, cat, f):
    pg.click('header [data-act=new]'); pg.wait_for_timeout(250)
    pg.fill('#ed-title',title); pg.select_option('#ed-type','item'); pg.uncheck('#it-magical'); pg.select_option('#it-cat',cat); pg.wait_for_timeout(100)
    f(); pg.wait_for_timeout(100)
    prev=pg.evaluate("(document.querySelector('#st-acprev')||{}).textContent")
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(400)
    return prev, pg.evaluate("[...document.querySelectorAll('.istats div')].map(x=>x.innerText.replace(/\\n/,': '))")
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_page(viewport={'width':1300,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(1200)
    print('half plate', newitem(pg,'Half Plate','Armour', lambda:(pg.fill('#st-ac','15'), pg.check('#st-dex'), pg.fill('#st-dexmax','2'), pg.fill('.st-cost[data-kind=armour]','750'))))
    print('full plate', newitem(pg,'Plate','Armour', lambda:(pg.fill('#st-ac','18'), pg.fill('.st-cost[data-kind=armour]','1500 gp'))))
    print('leather', newitem(pg,'Leather','Armour', lambda:(pg.fill('#st-ac','11'), pg.check('#st-dex'))))
    print('shield', newitem(pg,'Shield','Shield', lambda:(pg.fill('#st-ac','2'))))
    print('longsword', newitem(pg,'Longsword','Martial weapon', lambda:(pg.fill('#st-damage','1d8'), pg.fill('#st-dtype','slashing'), pg.fill('.st-cost[data-kind=weapon]','15'))))
    pg.screenshot(path='weaponpage.png')
    # prefill from Inverted Blade's old "Damage." ability
    pg.evaluate("location.hash='entry-iinverted-blade'"); pg.wait_for_timeout(300); pg.click('[data-act=edit]'); pg.wait_for_timeout(300)
    print('inverted prefill', pg.input_value('#st-damage'), pg.input_value('#st-dtype'), '| abilities left', pg.evaluate("DRAFT.it[0].items.map(i=>i.name)"))
    pg.keyboard.press('Escape')
    pg.evaluate("location.hash='items'"); pg.wait_for_timeout(300)
    print('card stats', pg.evaluate("[...document.querySelectorAll('.card')].filter(c=>c.querySelector('.istatshort')).map(c=>c.querySelector('h2').textContent+': '+c.querySelector('.istatshort').textContent)"))
    pg.evaluate("location.hash='entry-'+[...S.entries].find(([i,e])=>e.title==='Half Plate')[0]"); pg.wait_for_timeout(300); pg.locator('.itempage').screenshot(path='halfplate.png')
    b.close()
print('ERRORS',errs)
