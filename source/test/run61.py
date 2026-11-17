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
    pg.evaluate("(async()=>{for(const id of ['cmarshspear','cbriargullet']){const e=S.entries.get(id);await S.db.doc('entries/'+id).set(Object.assign({},e,{loot:[{n:'Pelt',dc:'8',qty:'2',wt:'10 lb'}]}))}})()"); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8765/index.html#bestiary'); pg.wait_for_timeout(600)
    c=lambda: pg.locator('.libhead > p.muted').text_content().split(' creatures')[0]
    print('start', c())
    for k in range(3): pg.click('[data-v=bsbonly]'); pg.wait_for_timeout(150); print('sb', k, c(), pg.text_content('[data-v=bsbonly]'))
    for k in range(3): pg.click('[data-v=bmat]'); pg.wait_for_timeout(150); print('mat', k, c(), pg.text_content('[data-v=bmat]'))
    pg.click('[data-v=bsbonly]'); pg.click('[data-v=bmat]'); pg.click('[data-v=bmat]'); pg.wait_for_timeout(150)
    pg.locator('.libhead').screenshot(path='tri.png'); print('combo', c())
    b.close()
print('ERRORS',errs)
