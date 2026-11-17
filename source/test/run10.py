import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
docs['settings/imports']={'imageLinks':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':950}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(2500)
    m=pg.evaluate("window.__store.get('entries/cmanticore').statblock")
    print('avg flag', pg.evaluate("JSON.stringify(window.__store.get('settings/imports'))"), '| manticore hp', m['hp'], '| rake:', [l for l in m['features'].split('\n\n') if l.startswith('***Rake')][0][:110])
    # item editor on the spear
    pg.evaluate("location.hash='entry-igiant-sealing-spear'"); pg.wait_for_timeout(400)
    print('page line before edit:', pg.inner_text('.isub'))
    pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
    print('cat', pg.input_value('#it-cat'), '| base', pg.input_value('#it-base'), '| props', pg.evaluate("draftProps.map(p=>p.id)"), '| line', pg.inner_text('#it-linepreview'))
    print('lore', repr(pg.input_value('#it-lore')), '| abilities', pg.evaluate("DRAFT.it[0].items.map(i=>i.name||'(text)')"))
    pg.select_option('#it-propsel','versatile'); pg.click('[data-act=itaddprop]'); pg.keyboard.type('1d12'); pg.wait_for_timeout(100)
    print('line after versatile', pg.inner_text('#it-linepreview'))
    pg.click('.propchip:nth-child(4) [data-act=itdelprop]'); pg.wait_for_timeout(100)
    # rich lore: type with bold via toolbar
    ed=pg.locator('#it-lore').locator('xpath=..').locator('.rtedit')
    ed.click(); pg.keyboard.type('A spear of ')
    pg.click('#it-lore >> xpath=.. >> .rtbtn[data-rt=b]'); pg.keyboard.type('giant-bone'); pg.click('#it-lore >> xpath=.. >> .rtbtn[data-rt=b]'); pg.keyboard.type(' and old rope.')
    print('lore md', repr(pg.input_value('#it-lore')))
    pg.locator('.mbox').screenshot(path='itemeditor.png')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
    it=pg.evaluate("window.__store.get('entries/igiant-sealing-spear')")
    print('saved meta', it['item']['meta'], '| lore', it['item']['lore'], '| body start', it['body'][:80])
    pg.screenshot(path='itempage2.png', full_page=True)
    # Beads: single-italic names become abilities
    pg.evaluate("location.hash='entry-ibeads-of-flowing-strikes'"); pg.wait_for_timeout(300)
    pg.click('[data-act=edit]'); pg.wait_for_timeout(300)
    print('beads abilities', pg.evaluate("DRAFT.it[0].items.slice(0,4).map(i=>i.name)"), 'lore starts', pg.input_value('#it-lore')[:40])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # Add lore button on an item without lore
    pg.evaluate("location.hash='entry-ispear-of-atonement'"); pg.wait_for_timeout(300)
    print('add lore btn', pg.evaluate("!!document.querySelector('[data-act=addlore]')"), 'image-to-come text', 'Image to come' in pg.inner_text('main'))
    pg.click('[data-act=addlore]'); pg.wait_for_timeout(200); pg.keyboard.type('Blessed at the temple of dawn.'); pg.click('form[data-form=lore] button[type=submit]'); pg.wait_for_timeout(400)
    print('lore saved', pg.evaluate("window.__store.get('entries/ispear-of-atonement').item.lore"))
    # creature entry body rich editor + untouched round trip
    before=pg.evaluate("window.__store.get('entries/cmarshspear').body")
    pg.evaluate("location.hash='entry-cmarshspear'"); pg.wait_for_timeout(300); pg.click('[data-act=edit]'); pg.wait_for_timeout(300)
    print('body editor is rich', pg.evaluate("!!document.querySelector('#ed-body').closest('.rt')"), '| itdesc rich', pg.evaluate("document.querySelectorAll('.sbitem .rt').length"))
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(400)
    print('marshspear body unchanged', before==pg.evaluate("window.__store.get('entries/cmarshspear').body"))
    # book editor with tables
    pg.evaluate("location.hash='book-btemplates'"); pg.wait_for_timeout(300); pg.click('[data-act=editbook]'); pg.wait_for_timeout(500)
    print('book atomic blocks', pg.evaluate("document.querySelectorAll('.mdblock').length"))
    pg.locator('.mbox').screenshot(path='bookeditor.png')
    b.close()
print('ERRORS',errs)
