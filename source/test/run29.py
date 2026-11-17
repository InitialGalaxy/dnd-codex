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
    pg.goto('http://localhost:8765/index.html#books'); pg.wait_for_timeout(6000)
    print(pg.evaluate("JSON.stringify(S.imports.bookEmbedsReport)"))
    st=pg.evaluate("Object.fromEntries([...window.__store].filter(([k])=>k.startsWith('books/')||k.startsWith('entries/subclass')||k.startsWith('entries/spell')||k.startsWith('entries/class')).map(([k,v])=>[k,v]))")
    json.dump(st,open('/home/claude/mig/after.json','w'),indent=1)
    pg.add_style_tag(content='#toasts{display:none!important}')
    for bid in ['bpractical-handbooks-in-felling-giants','bthe-art-of-not-dying-to-a-dragon']:
        pg.goto('http://localhost:8765/index.html#book-'+bid); pg.wait_for_timeout(800); pg.screenshot(path=bid[:20]+'.png',full_page=True)
    pg.goto('http://localhost:8765/index.html#entry-class-artificer'); pg.wait_for_timeout(500); pg.screenshot(path='artificer.png',full_page=True)
    pg.goto('http://localhost:8765/index.html#entry-spell-draconic-enchanting'); pg.wait_for_timeout(500); pg.screenshot(path='spell-dragon.png')
    b.close()
print('ERRORS',errs)
