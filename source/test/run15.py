import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
docs['settings/imports']={'imageLinks':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#home'); pg.wait_for_timeout(1200)
    pg.goto('http://localhost:8765/index.html#srd'); pg.wait_for_timeout(1200)
    pg.fill('#srdq','longsword'); pg.wait_for_timeout(300)
    print(pg.inner_text('#srdresults')[:200])
    pg.click('[data-act=srdopen][data-v=longsword]'); pg.wait_for_timeout(200)
    pg.screenshot(path='srd-longsword.png', full_page=True)
    pg.click('[data-act=srdcopy][data-v=longsword]'); pg.wait_for_timeout(500)
    e=pg.evaluate("JSON.stringify([...window.__store.entries()].filter(([k,v])=>v&&v.srd==='longsword'))"); print(e)
    pg.fill('#srdq','plate'); pg.wait_for_timeout(300); pg.click('[data-act=srdopen][data-v=half-plate-armor]'); pg.wait_for_timeout(200)
    pg.click('[data-act=srdcopy][data-v=half-plate-armor]'); pg.wait_for_timeout(400)
    pg.click('[data-act=srdgroup][data-v=gear]'); pg.wait_for_timeout(200); pg.fill('#srdq','explorer'); pg.wait_for_timeout(300)
    pg.click('[data-act=srdopen][data-v=explorers-pack]'); pg.wait_for_timeout(200); pg.screenshot(path='srd-pack.png')
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(400); pg.click('[data-act=imagic][data-v=mundane]'); pg.wait_for_timeout(200); pg.screenshot(path='items-mundane.png')
    lid=pg.evaluate("[...S.entries].find(([k,v])=>v.srd==='longsword')[0]")
    pg.goto('http://localhost:8765/index.html#entry-'+lid); pg.wait_for_timeout(400); pg.screenshot(path='srd-entry.png')
    pg.click('[data-act=edit]'); pg.wait_for_timeout(400); pg.screenshot(path='srd-edit.png')
    pg.set_viewport_size({'width':400,'height':860}); pg.keyboard.press('Escape'); pg.goto('http://localhost:8765/index.html#srd'); pg.wait_for_timeout(400); pg.fill('#srdq','bow'); pg.wait_for_timeout(300); pg.screenshot(path='srd-phone.png')
    b.close()
print('ERRORS',errs)
