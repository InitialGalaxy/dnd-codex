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
    pg.click('[data-act=edit]'); pg.wait_for_timeout(500)
    btn=pg.locator('[data-act=sbaoe]').nth(1); btn.scroll_into_view_if_needed(); btn.click(); pg.wait_for_timeout(300)
    # paint a cone-ish area by dragging
    def cell(x,y): return pg.locator(f'.aoecell[data-x="{x}"][data-y="{y}"]')
    b1=cell(5,3).bounding_box(); b2=cell(7,5).bounding_box()
    pg.mouse.move(b1['x']+5,b1['y']+5); pg.mouse.down(); pg.mouse.move(b1['x']+30,b1['y']+30, steps=5); pg.mouse.move(b2['x']+5,b2['y']+5, steps=8); pg.mouse.up()
    pg.click('[data-color="#4aa3df"]'); cell(6,4).click(); cell(5,4).click()
    pg.click('[data-tool=mv]'); cell(3,6).click()
    pg.click('[data-tool=en]'); cell(7,2).click()
    pg.screenshot(path='aoe-editor.png')
    pg.click('[data-x=save]'); pg.wait_for_timeout(300)
    pg.locator('.sbaoe').nth(1).screenshot(path='aoe-sbitem.png')
    print('modal still open', pg.locator('form[data-form=entry]').count())
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(800)
    f=pg.evaluate("S.entries.get('cmarshspear').statblock.features"); i=f.find('{{aoe'); print(f[i-120:i+60])
    print('figs', pg.locator('.aoefig').count())
    pg.locator('.aoefig').first.scroll_into_view_if_needed(); pg.screenshot(path='aoe-page.png')
    # rich text toolbar in a lore entry
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(400)
    pg.click('.top [data-act=new]'); pg.wait_for_timeout(400); pg.fill('#ed-title','AoE test'); pg.select_option('#ed-type','creature')
    pg.locator('#ed-body').locator('xpath=..').locator('.rtedit').click(); pg.keyboard.type('A breath weapon.')
    pg.locator('#ed-body').locator('xpath=..').locator('[data-rt=aoe]').click(); pg.wait_for_timeout(300)
    cell(4,2).click(); pg.click('[data-x=save]'); pg.wait_for_timeout(300)
    print('body', pg.input_value('#ed-body')[:120])
    b.close()
print('ERRORS',errs)
