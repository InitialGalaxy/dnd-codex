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
    pg.evaluate("(async()=>{const db=await claude.use('db');const e=S.entries.get('item-raw-meat');await db.doc('entries/item-raw-meat').set(Object.assign({},e,{item:Object.assign({},e.item,{lore:'Tough, gamey and best cooked over an open fire.'})}))})()"); pg.wait_for_timeout(400)
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(600); pg.screenshot(path='items-all.png')
    pg.click('[data-act=imagic][data-v=harvest]'); pg.wait_for_timeout(400); pg.screenshot(path='items-harvest.png')
    pg.click('[data-act=newharvest]'); pg.wait_for_timeout(400); print('cat', pg.input_value('#it-cat'), pg.is_visible('#hv-dc'))
    b.close()
print('ERRORS',errs)
