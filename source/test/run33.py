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
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(14000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    print('imports', pg.evaluate("Object.keys(S.imports).join(',')"))
    print(pg.evaluate("JSON.stringify([...S.entries.values()].filter(e=>e.item&&/harvest|material/i.test(e.item.category)).map(e=>[e.title,e.item.category,e.item.harvest,e.body]))"))
    pg.goto('http://localhost:8765/index.html#book-ba-merchants-guide-to-deadly-monsters'); pg.wait_for_timeout(800)
    pg.locator('.loot').first.scroll_into_view_if_needed(); pg.wait_for_timeout(300); pg.screenshot(path='harvest-book.png')
    pg.goto('http://localhost:8765/index.html#entry-item-raw-meat'); pg.wait_for_timeout(500); pg.screenshot(path='harvest-page.png')
    pg.click('[data-act=edit]'); pg.wait_for_timeout(400); pg.fill('#hv-dc','7'); pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
    print(pg.evaluate("JSON.stringify(S.entries.get('item-raw-meat').item.harvest)"))
    pg.goto('http://localhost:8765/index.html#bookedit-ba-merchants-guide-to-deadly-monsters'); pg.wait_for_timeout(1000)
    pg.locator('.embedblock').first.scroll_into_view_if_needed(); pg.screenshot(path='harvest-edit.png')
    b.close()
print('ERRORS',errs)
