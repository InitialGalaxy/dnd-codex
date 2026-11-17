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
    pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(5000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    name=pg.evaluate("[...S.entries.values()].filter(e=>e.type==='creature'&&e.statblock).map(e=>e.title).sort()[0]")
    print('creature', name)
    pg.click('[data-act=cview][data-v=sum]'); pg.wait_for_timeout(300)
    pg.fill('#smq', name); pg.click('[data-act=smadd]'); pg.wait_for_timeout(900)
    pg.click('[data-act=smhp][data-v="-1"]'); pg.wait_for_timeout(900)
    print(pg.evaluate("JSON.stringify(S.chars.get('csaahan').summons.map(s=>[s.name,s.hp]))"))
    pg.screenshot(path='summons.png', full_page=True)
    b.close()
print('ERRORS',errs)
