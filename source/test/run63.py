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
    pg.wait_for_timeout(9000)
    print('imports', pg.evaluate("S.imports.bookLib"), 'linked', pg.evaluate("[...S.entries.values()].filter(e=>e.fromBook).map(e=>e.title)"))
    print('backup', pg.evaluate("S.db.doc('settings/backup-booklib').get().then(d=>d.exists?Object.values(d.data().entries).map(x=>x.title):[])"))
    gid='ggiants-practical-h'
    print('giants body start', pg.evaluate("S.entries.get('ggiants-practical-h').body.slice(0,200)"))
    pg.goto('http://localhost:8765/index.html#entry-'+gid); pg.wait_for_timeout(600)
    print('frombook', pg.locator('.frombook').text_content())
    pg.click('[data-act=editinbook]'); pg.wait_for_timeout(1500)
    print('hash', pg.evaluate("location.hash"), 'flash', pg.locator('.rtedit .flash').count(), 'atoms', pg.locator('.libblock').count())
    pg.locator('.libblock').first.scroll_into_view_if_needed(); pg.screenshot(path='lib-editor.png')
    # add a new library entry: click into an h2 without one
    hs=pg.locator('.bookeditor .rtedit h2')
    target=None
    for k in range(hs.count()):
        h=hs.nth(k)
        if not h.evaluate("n=>n.nextElementSibling&&n.nextElementSibling.classList.contains('libblock')"): target=h; break
    title=target.text_content().strip(); print('target', title)
    target.click(); pg.wait_for_timeout(200); print('btn visible', pg.locator('[data-ins=libentry]').is_visible()); pg.evaluate("document.querySelector('[data-ins=libentry]').click()"); pg.wait_for_timeout(300)
    pg.screenshot(path='lib-dlg.png'); print('dlg', pg.locator('#lb-type').count());
    pg.select_option('#lb-type','history'); pg.locator('[data-tpk="lb-tags"] .tpkin').fill('giants'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100); pg.evaluate("document.querySelector('#lb-ok').click()"); pg.wait_for_timeout(300)
    pg.evaluate("beSave()"); pg.wait_for_timeout(1200)
    print('new entry', pg.evaluate("t=>[...S.entries.values()].filter(e=>e.fromBook&&e.title===t).map(e=>[e.type,e.tags,e.body.length])", title))
    # edit text under heading and save -> entry updates
    target=pg.locator('.bookeditor .rtedit h2', has_text=title).first
    nxt=target.locator('xpath=following-sibling::p[1]'); nxt.click(); pg.keyboard.press('End'); pg.keyboard.type(' ZEBRA TEST.'); pg.wait_for_timeout(200)
    pg.evaluate("beSave()"); pg.wait_for_timeout(1200)
    print('updated', pg.evaluate("t=>[...S.entries.values()].find(e=>e.fromBook&&e.title===t).body.includes('ZEBRA TEST')", title))
    # remove marker
    pg.locator('.libblock', has_text='History').locator('[data-libed=rm]').click(); pg.evaluate("beSave()"); pg.wait_for_timeout(1200)
    print('unlinked', pg.evaluate("t=>[...S.entries.values()].filter(e=>e.title===t).map(e=>!!e.fromBook)", title))
    pg.goto('http://localhost:8765/index.html#book-bpractical-handbooks-in-felling-giants'); pg.wait_for_timeout(800)
    print('notes', pg.locator('.libnote').count())
    pg.locator('.libnote').first.scroll_into_view_if_needed(); pg.screenshot(path='lib-read.png')
    b.close()
print('ERRORS',errs)
