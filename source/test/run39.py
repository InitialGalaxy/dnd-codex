import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
docs['settings/imports']={'imageLinks':True,'avgRule':True}
docs['entries/item-old-pelt']={'title':'Old Pelt','type':'item','tags':[],'body':'***Harvest DC.*** 8\n\n***Available.*** 2 per creature\n\n***Weight.*** 10 lb','item':{'category':'Material','magical':False,'meta':'Material'}}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1440,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type in('warning','error') and errs.append(m.text))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(16000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.click('.top [data-act=new]'); pg.wait_for_timeout(400)
    pg.select_option('#ed-type','partset'); pg.wait_for_timeout(200)
    pg.fill('#ed-title','Beast parts'); pg.fill('#ed-tag','Monster'); pg.keyboard.press('Enter')
    pg.drag_and_drop('#ps-pal .pschip[data-pid="item-raw-meat"]','#ps-set'); pg.wait_for_timeout(200)
    pg.drag_and_drop('#ps-pal .pschip[data-pid="item-pelt"]','#ps-set'); pg.wait_for_timeout(200)
    pg.click('#ps-pal .pschip[data-pid="item-heart"]'); pg.click('#ps-pal .pschip[data-pid="item-claw"]'); pg.wait_for_timeout(200)
    pg.fill('#ps-q','tu'); pg.wait_for_timeout(200)
    pg.locator('fieldset[data-for=partset]').screenshot(path='partset-edit.png')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(700)
    pg.screenshot(path='partset-page.png', full_page=True)
    print(pg.evaluate("JSON.stringify([...S.entries.values()].filter(e=>e.type==='partset').map(e=>[e.title,e.tags,e.partset]))"))
    pg.goto('http://localhost:8765/index.html#entry-cowlbear'); pg.wait_for_timeout(500); pg.click('[data-act=edit]'); pg.wait_for_timeout(500)
    pg.fill('#loot-addname','Bones'); pg.click('[data-act=lootaddname]'); pg.fill('#loot-addname','Skull'); pg.click('[data-act=lootaddname]'); pg.fill('#loot-addname','Scales'); pg.click('[data-act=lootaddname]')
    pg.select_option('#loot-size','Large'); pg.wait_for_timeout(200)
    rows=pg.locator('#loot-rows .lootrow')
    rows.nth(0).locator('.lt-qty').fill(''); rows.nth(0).locator('.lt-qty').type('2*size'); pg.wait_for_timeout(100)
    print([ (rows.nth(i).locator('.lt-n').input_value(), rows.nth(i).locator('.lt-qty').input_value(), rows.nth(i).locator('.lt-qcalc').inner_text(), rows.nth(i).locator('.lt-wt').input_value(), rows.nth(i).locator('.lt-wcalc').inner_text()) for i in range(rows.count())])
    pg.evaluate("document.querySelector('#loot-rows').scrollIntoView()")
    pg.locator('fieldset[data-for=creature]').first.screenshot(path='loot-formula.png')
    print('reset visible', rows.nth(0).locator('[data-act=lootreset]').is_visible())
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(700)
    print(pg.evaluate("JSON.stringify([S.entries.get('cowlbear').lootSize, S.entries.get('cowlbear').loot])"))
    pg.locator('.loot').first.screenshot(path='loot-formula-cards.png')
    b.close()
print('ERRORS',errs)
