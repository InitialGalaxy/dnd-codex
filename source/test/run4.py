import json, re
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
docs['settings/imports']={'gdocs':'x','imageLinks':True}
docs['entries/ikillipheir']['item']['rarity']='divine'
errs=[]; U='http://localhost:8765/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js')
    pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto(U+'#world'); pg.wait_for_timeout(1500)
    pg.set_input_files('#mapfile', '/mnt/user-data/uploads/dnd/Dryrones 2026-10-13-18-00.map')
    pg.wait_for_function("document.querySelector('table.towns')", timeout=20000)
    pg.click('[data-act=export]'); pg.wait_for_timeout(200); pg.screenshot(path='exportdlg.png')
    pg.click('[data-act=exportro]'); pg.wait_for_function("window.__saved", timeout=20000)
    sv=pg.evaluate("window.__saved"); print(sv['filename'], len(sv['data']))
    open('/tmp/ro.html','w').write(sv['data'])
    print('scripts in export', len(re.findall(r'<script', sv['data'])))
    ro=b.new_page(viewport={'width':1300,'height':900}); ro.on('pageerror',lambda e:errs.append('RO '+str(e)))
    ro.goto('file:///tmp/ro.html#bestiary'); ro.wait_for_timeout(800)
    print('ro cards', ro.evaluate("document.querySelectorAll('.cards .card').length"), 'visible edit/new buttons', ro.evaluate("[...document.querySelectorAll('[data-act=new],[data-act=edit],[data-act=export]')].filter(b=>b.offsetParent).length"))
    ro.goto('file:///tmp/ro.html#entry-cmanticore'); ro.wait_for_timeout(500)
    print('img tags', ro.evaluate("[...document.querySelectorAll('figure.img img')].map(i=>i.src).slice(0,2)"), 'edit visible', ro.evaluate("!!document.querySelector('[data-act=edit]').offsetParent"))
    ro.screenshot(path='ro-manticore.png')
    ro.goto('file:///tmp/ro.html#world'); ro.wait_for_timeout(500); print('ro towns rows', ro.evaluate("document.querySelectorAll('table.towns tbody tr').length"))
    ro.goto('file:///tmp/ro.html#entry-ikillipheir'); ro.wait_for_timeout(300); print('ro item', ro.evaluate("!!document.querySelector('.itempage.rar-divine')"))
    b.close()
print('ERRORS',errs)
