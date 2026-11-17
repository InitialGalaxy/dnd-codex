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
    pg.goto('http://localhost:8765/index.html#entry-cchangelisk'); pg.wait_for_timeout(800)
    print('panel', pg.locator('.sspanel').count(), pg.locator('.sspanel select option').count())
    pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
    print('fields visible', pg.locator('#ss-fields').is_visible())
    pg.select_option('#ss-allow','tags'); pg.locator('.tpk[data-tpk="ss-tags"] .tpkin').fill('bird'); pg.keyboard.press('Enter'); pg.fill('#ss-maxcr','8')
    pg.locator('#ss-fields').screenshot(path='ss-fields.png')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(800)
    print('saved', pg.evaluate("S.entries.get('cchangelisk').shapeshift"))
    opts=pg.locator('.sspanel select option').all_text_contents(); print('opts', opts[:6])
    pg.select_option('.sspanel select', index=1); pg.wait_for_timeout(600)
    print('form shown', pg.locator('.ssform').count(), pg.evaluate("S.entries.get('cchangelisk').shapeshift.current"))
    pg.locator('.sspanel').scroll_into_view_if_needed(); pg.screenshot(path='ss-entry.png')
    # mode form
    pg.click('[data-act=edit]'); pg.wait_for_timeout(400); pg.check('input[name=ss-mode][value=form]')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(800)
    print('note', pg.locator('.ssnote').count(), pg.locator('.ssform').count())
    pg.click('[data-act=edit]'); pg.wait_for_timeout(400); pg.check('input[name=ss-mode][value=replace]')
    # tag removal hides
    n=pg.locator('#ed-tagchips .tag').count()
    for k in range(n): pg.locator('#ed-tagchips .tag').first.click()
    print('hidden after untag', not pg.locator('#ss-fields').is_visible())
    pg.evaluate("document.querySelector('[data-act=closemodal]').click()")
    pg.evaluate("(async()=>{const e=S.entries.get('cchangelisk');await S.db.doc('entries/cchangelisk').set(Object.assign({},e,{shapeshift:Object.assign({},e.shapeshift,{mode:'replace'})}))})()"); pg.wait_for_timeout(400)
    pg.goto('http://localhost:8765/index.html#char-cvakryn'); pg.wait_for_timeout(800)
    pg.click('[data-act=cview][data-v=sum]') if pg.locator('[data-act=cview][data-v=sum]').count() else None
    pg.wait_for_timeout(300); pg.fill('#smq','Changelisk'); pg.click('[data-act=smadd]'); pg.wait_for_timeout(600)
    print('summon panel', pg.locator('.summon .sspanel').count())
    pg.select_option('.summon .sspanel select', index=1); pg.wait_for_timeout(600)
    print('shifted', pg.locator('.summon.shifted').count(), 'form rows', pg.locator('.ssrow').count(), pg.evaluate("S.chars.get('cvakryn').summons.map(s=>s.form)"))
    pg.locator('.summon').screenshot(path='ss-summon.png')
    b.close()
print('ERRORS',errs)
