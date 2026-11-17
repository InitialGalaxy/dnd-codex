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
    pg=b.new_page(viewport={'width':1440,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type in('warning','error') and errs.append(m.text))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(12000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    print('imports', pg.evaluate("Object.keys(S.imports).join(',')")); print([e['title'] for e in pg.evaluate("[...S.entries.values()].filter(e=>e.item&&e.item.category==='Material')")])
    print('subs', pg.evaluate("[...S.entries.values()].filter(e=>e.type==='subclass').length"))
    body=pg.evaluate("S.books.get('ba-merchants-guide-to-deadly-monsters').body"); i=body.find('Harvesting Roll'); print(body[i:i+600])
    pg.goto('http://localhost:8765/index.html#book-ba-merchants-guide-to-deadly-monsters'); pg.wait_for_timeout(800)
    pg.locator('.embedwrap').first.scroll_into_view_if_needed(); pg.wait_for_timeout(300); pg.screenshot(path='loot-book.png')
    pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(600); pg.click('[data-act=cedit]'); pg.wait_for_timeout(300)
    print(pg.evaluate("[...document.querySelectorAll('[data-lvsub] option')].map(o=>o.textContent).join(' / ')"))
    print(pg.inner_text('.levelup')[:400])
    pg.goto('http://localhost:8765/index.html#entry-subclass-path-of-the-totem-warrior'); pg.wait_for_timeout(500); pg.screenshot(path='totem.png', full_page=True)
    pg.goto('http://localhost:8765/index.html#entry-class-cleric'); pg.wait_for_timeout(500)
    print(pg.inner_text('.classblock h3:last-of-type + p'))
    # creature loot editor
    pg.goto('http://localhost:8765/index.html#entry-cowlbear'); pg.wait_for_timeout(500); pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
    pg.click('[data-act=lootadd]'); pg.fill('#loot-rows .lootrow:last-child .lt-n','Owlbear feather'); pg.fill('#loot-rows .lootrow:last-child .lt-dc','8'); pg.fill('#loot-rows .lootrow:last-child .lt-qty','6'); pg.fill('#loot-rows .lootrow:last-child .lt-wt','1 lb')
    pg.click('[data-act=lootadd]'); pg.fill('#loot-rows .lootrow:last-child .lt-n','Owlbear beak'); pg.fill('#loot-rows .lootrow:last-child .lt-dc','14'); pg.fill('#loot-rows .lootrow:last-child .lt-qty','1'); pg.fill('#loot-rows .lootrow:last-child .lt-wt','3 lb')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(600); pg.screenshot(path='owlbear-loot.png', full_page=True)
    b.close()
print('ERRORS',errs)
