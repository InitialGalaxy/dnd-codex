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
    pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(1200)
    pg.click('[data-act=cview][data-v=inv]'); pg.wait_for_timeout(300)
    pg.screenshot(path='inv-empty.png')
    pg.fill('#invq','arrow'); pg.wait_for_timeout(300); pg.click('[data-act=invadd][data-v="s:arrow"]'); pg.wait_for_timeout(200)
    pg.click('[data-act=invadd][data-v="s:arrow"]'); pg.wait_for_timeout(200)
    pg.fill('#invq',''); pg.wait_for_timeout(300)
    # tap-to-place
    print('rope', pg.locator('[data-act=invpick][data-v="s:rope-hempen-50-feet"]').count(), pg.evaluate("SRD_EQUIP.filter(x=>/rope/i.test(x.id)).map(x=>x.id)"))
    pg.fill('#invq','rope'); pg.wait_for_timeout(300); pg.click('[data-act=invpick][data-v="s:rope-hempen-50-feet"]')
    pg.wait_for_timeout(200); pg.click('.islot[data-k="7"]'); pg.wait_for_timeout(200)
    # drag a codex item
    kp=pg.evaluate("[...S.entries].find(([k,v])=>v.type==='item')?.[0]"); print('killpheir',kp)
    pg.fill('#invq',''); pg.wait_for_timeout(300)
    if kp: pg.drag_and_drop(f'li[data-ref="e:{kp}"]', '.islot[data-k="1"]'); pg.wait_for_timeout(300)
    print(pg.evaluate("JSON.stringify(S.chars.get('csaahan').inv)"))
    # move slot 7 -> 12 by drag
    pg.drag_and_drop('.islot[data-k="7"]', '.islot[data-k="12"]'); pg.wait_for_timeout(300)
    print(pg.evaluate("Object.keys(S.chars.get('csaahan').inv.slots)"))
    pg.click('.islot[data-k="1"]'); pg.wait_for_timeout(200)
    pg.screenshot(path='inv.png', full_page=True)
    pg.click('[data-act=invqty][data-v="1"]'); pg.wait_for_timeout(200); print('qty', pg.evaluate("S.chars.get('csaahan').inv.slots[0].qty"))
    pg.wait_for_timeout(800); print('stored', pg.evaluate("JSON.stringify(window.__store.get('characters/csaahan').inv)")[:200])
    pg.set_viewport_size({'width':400,'height':860}); pg.wait_for_timeout(300); pg.screenshot(path='inv-phone.png', full_page=True)
    b.close()
print('ERRORS',errs)
