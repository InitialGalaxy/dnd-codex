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
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(6000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    # new entry types
    pg.click('[data-act=new]'); pg.wait_for_timeout(400)
    print('types', pg.evaluate("[...document.querySelectorAll('#ed-type option')].map(o=>o.value).join(',')"))
    # spell import
    pg.select_option('#ed-type','spell'); pg.wait_for_timeout(200)
    pg.fill('#sp-paste', open('/tmp/fireball.txt').read()); pg.click('[data-act=spimport]'); pg.wait_for_timeout(300)
    print('spell', pg.evaluate("[ $('#ed-title').value, $('#sp-level').value, $('#sp-school').value, $('#sp-range').value, $('#sp-dmg').value, $('#sp-dtype').value, $('#sp-attack').value, $('#sp-save').value, $('#sp-shape').value, $('#sp-size').value, $('#ed-body').value.slice(0,40)].join(' | ')"))
    pg.locator('.mbox').screenshot(path='spell-import.png')
    pg.click('[data-act=closemodal] >> nth=-1'); pg.wait_for_timeout(200)
    # class editor tag pickers
    pg.goto('http://localhost:8765/index.html#entry-class-rogue'); pg.wait_for_timeout(500); pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
    pg.locator('[data-tpk=cl-weapons] .tpkin').click(); pg.keyboard.type('long'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('fieldset[data-for=class]').scrollIntoView()")
    pg.screenshot(path='class-tags.png')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
    pg.locator('[data-tpk=cl-skill] .tpkin').click(); pg.keyboard.type('arca'); pg.keyboard.press('Enter')
    pg.locator('[data-tpk=cl-save] .tpkchip .tpkx').first.click()
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(600)
    print('rogue', pg.evaluate("JSON.stringify((({weapons,skills,saves})=>({weapons,skills,saves}))(S.entries.get('class-rogue').cls))"))
    # handout
    hid=pg.evaluate("[...S.entries].find(([k,v])=>v.type==='handout')[0]")
    pg.goto('http://localhost:8765/index.html#entry-'+hid); pg.wait_for_timeout(500); pg.screenshot(path='handout-old.png')
    pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
    pg.check('.ho-edge[value=left]'); pg.uncheck('.ho-edge[value=bottom]'); pg.wait_for_timeout(200)
    pg.locator('fieldset[data-for=handout]').screenshot(path='handout-edit.png')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(600)
    pg.screenshot(path='handout-new.png', full_page=True)
    print('handout', pg.evaluate("JSON.stringify(S.entries.get('%s').handout)"%hid), pg.evaluate("S.entries.get('%s').body.slice(0,80)"%hid))
    # book editor: side index, tables, spelling
    pg.goto('http://localhost:8765/index.html#bookedit-bthe-art-of-not-dying-to-a-dragon'); pg.wait_for_timeout(1200)
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.screenshot(path='bookedit-side.png')
    print('toc items', pg.locator('#bstoc [data-bsgo]').count())
    pg.locator('#bstoc [data-bsgo]').nth(8).click(); pg.wait_for_timeout(800); pg.screenshot(path='bookedit-jump.png')
    # table edit
    print('tables', pg.locator('.rtedit table.rttable').count())
    cell=pg.locator('.rtedit table.rttable td').nth(5); cell.click(); pg.keyboard.press('End'); pg.keyboard.type(' Fire Bolt'); pg.wait_for_timeout(200)
    print('tbar', pg.is_visible('.rttbar'))
    pg.click('.rttbar [data-tb=rowdown]'); pg.wait_for_timeout(1600)
    body=pg.evaluate("window.__store.get('books/bthe-art-of-not-dying-to-a-dragon').body"); i=body.find('Warlock Level'); print(body[i-60:i+260])
    pg.click('[data-ins=spellcheck]'); pg.wait_for_timeout(2500)
    pg.screenshot(path='bookedit-spell.png')
    print(pg.inner_text('#bsresults')[:500])
    b.close()
print('ERRORS',errs)
