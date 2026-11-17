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
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.goto('http://localhost:8765/index.html#entry-cbriargullet'); pg.wait_for_timeout(700)
    print('entry rch', pg.locator('.rch').count())
    pg.locator('.rch').first.hover(); pg.locator('.rch').first.locator('[data-rch=on]').click(); pg.wait_for_timeout(300)
    print('locked', pg.locator('.rch.locked').count())
    pg.locator('.rch.locked').first.scroll_into_view_if_needed(); pg.locator('.statblock.feats').first.screenshot(path='rch-entry.png')
    pg.locator('.rch.locked [data-rch=off]').click(); pg.wait_for_timeout(300); print('unlocked', pg.locator('.rch.locked').count())
    # tracker
    pg.goto('http://localhost:8765/index.html#encounters'); pg.wait_for_timeout(500)
    pg.click('[data-act=encnew] >> nth=0'); pg.wait_for_timeout(400)
    pg.fill('#encq','Briar Gullet'); pg.fill('#encqn','2'); pg.click('[data-act=encadd]'); pg.wait_for_timeout(500)
    pg.locator('.encside .rch').nth(1).locator('[data-rch=on]').click(); pg.wait_for_timeout(500)
    print('cb locked', pg.locator('.encside .rch.locked').count(), pg.evaluate("[...S.encs.values()][0].list.map(c=>c.locked)"))
    pg.locator('.cbt').nth(1).locator('.cbname').click(); pg.wait_for_timeout(300)
    print('other creature locked', pg.locator('.encside .rch.locked').count())
    pg.locator('.cbt').nth(0).locator('.cbname').click(); pg.wait_for_timeout(300)
    pg.screenshot(path='rch-trk.png')
    # summon
    pg.goto('http://localhost:8765/index.html#char-cvakryn'); pg.wait_for_timeout(600); pg.click('[data-act=cview][data-v=sum]'); pg.wait_for_timeout(300)
    pg.fill('#smq','Briar Gullet'); pg.click('[data-act=smadd]'); pg.wait_for_timeout(600)
    pg.locator('.summon tr[data-rchkey] .rchmini').first.click(); pg.wait_for_timeout(500)
    print('sm locked', pg.locator('.summon tr.rchrow').count(), pg.evaluate("S.chars.get('cvakryn').summons.map(s=>s.locked)"))
    pg.locator('.summon .smfull summary').click(); pg.wait_for_timeout(200)
    print('sm sb locked', pg.locator('.summon .smfull .rch.locked').count())
    pg.locator('.summon').screenshot(path='rch-sm.png')
    b.close()
print('ERRORS',errs)
