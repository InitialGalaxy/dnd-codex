import json, re
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items():
    if v.get('statblock'): v['statblock']['features']=re.sub(r'\n\n!\[[^\]]*\]\([^)]*\)','',v['statblock']['features'])
    docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
docs['settings/imports']={'gdocs':'x'}
docs['entries/ishadow-mantle']['item']['rarity']='unique'
docs['entries/ikillipheir']['item']['rarity']='divine'
errs=[]; U='http://localhost:8765/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:m.type=='error' and 'favicon' not in m.text and errs.append(m.text))
    pg.add_init_script(path='mockdb.js')
    pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto(U+'#library'); pg.wait_for_timeout(2500)
    print('imports', pg.evaluate("JSON.stringify(window.__store.get('settings/imports'))"))
    print('manticore imgs', pg.evaluate("(window.__store.get('entries/cmanticore').statblock.features.match(/!\\[/g)||[]).length"))
    print('dup banner', pg.evaluate("document.querySelector('[data-act=mergedupes]')?document.querySelector('.banner.import').innerText.slice(0,120):'none'"))
    # and/or
    pg.click('[data-act=ftag][data-v=giant]'); pg.click('[data-act=ftag][data-v=behemoth]'); pg.wait_for_timeout(150)
    print('AND count', pg.evaluate("document.querySelectorAll('.cards .card').length"))
    pg.click('[data-act=fmode][data-v=or]'); pg.wait_for_timeout(150)
    print('OR count', pg.evaluate("document.querySelectorAll('.cards .card').length"))
    pg.click('[data-act=mergedupes]'); pg.wait_for_timeout(200); pg.click('#cyes'); pg.wait_for_timeout(600)
    print('after merge dup banner', pg.evaluate("!!document.querySelector('[data-act=mergedupes]')"), 'ithlluid docs', pg.evaluate("[...window.__store.keys()].filter(k=>k.includes('ithlluid')||k.includes('gtrolls'))"))
    print('trolls body has From?', pg.evaluate("Object.values(Object.fromEntries(window.__store)).filter(e=>e.title==='Trolls').map(e=>e.body.includes('### From'))"))
    pg.screenshot(path='lib-or.png')
    pg.goto(U+'#entry-cmanticore'); pg.wait_for_timeout(400); pg.screenshot(path='manticore.png', full_page=True)
    print('withimg rows', pg.evaluate("document.querySelectorAll('.withimg').length"))
    pg.goto(U+'#entry-ikillipheir'); pg.wait_for_timeout(300); pg.screenshot(path='divine.png', full_page=True)
    pg.goto(U+'#items'); pg.wait_for_timeout(300); pg.screenshot(path='items2.png')
    pg.goto(U+'#entry-hrecovered-journal-entry'); pg.wait_for_timeout(500); pg.screenshot(path='handout2.png', full_page=True)
    pg.goto(U+'#backup'); pg.wait_for_timeout(300); print(pg.inner_text('main')[:300])
    b.close()
print('ERRORS',errs)
