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
    pg.wait_for_timeout(3000)
    print(pg.evaluate("[...S.chars.values()].map(c=>[c.name,c.classes,c.level,charSub(c)])"))
    pg.goto('http://localhost:8765/index.html#char-cvakryn'); pg.wait_for_timeout(600)
    pg.click('[data-act=cedit]') if pg.locator('[data-act=cedit]').count() else None
    pg.wait_for_timeout(300)
    f=pg.locator('[data-cf=classes]'); print('label', pg.locator('label:has([data-cf=classes]) span').first.text_content())
    f.fill('Barbarian 9'); f.dispatch_event('change'); pg.wait_for_timeout(500)
    print(pg.evaluate("[S.chars.get('cvakryn').classes,S.chars.get('cvakryn').level]"))
    print('split', pg.evaluate("JSON.stringify(splitClassLevel({classes:'Fighter 5 / Wizard 3'}))"), pg.evaluate("JSON.stringify(splitClassLevel({classes:'Level 4 Rogue'}))"))
    b.close()
print('ERRORS',errs)
