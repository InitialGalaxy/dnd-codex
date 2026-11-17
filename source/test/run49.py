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
    def cxy(x,y):
        r=pg.locator('.aoeboard svg').bounding_box(); w=pg.evaluate("document.querySelector('.aoeboard svg').viewBox.baseVal.width")/24; h=pg.evaluate("document.querySelector('.aoeboard svg').viewBox.baseVal.height")/24
        return (r['x']+(x+.5)*r['width']/w, r['y']+(y+.5)*r['height']/h)
    def dragc(a,b):
        pg.mouse.move(*cxy(*a)); pg.mouse.down(); pg.mouse.move(*cxy(*b), steps=8); pg.mouse.up(); pg.wait_for_timeout(100)
    def st(): return pg.evaluate("document.querySelector('.aoehead small').textContent")
    pg.click('[data-tool=creature]'); pg.click('[data-size="3"]'); pg.mouse.click(*cxy(4,4))
    pg.click('[data-tool=en]'); pg.click('[data-size="2"]'); pg.mouse.click(*cxy(1,1)); pg.click('[data-size="4"]')
    pg.mouse.click(*cxy(7,7)); pg.click('[data-size="2"]')
    pg.click('[data-tool=mv]'); pg.mouse.click(*cxy(6,1))
    pg.click('[data-tool=paint]'); dragc((0,6),(2,8))
    pg.screenshot(path='aoe4-a.png')
    pg.click('[data-tool=move]'); dragc((4,4),(5,5)); dragc((1,1),(2,2))
    pg.click('[data-tool=flip]'); pg.click('[data-flip=h]')
    pg.click('[data-x=save]'); pg.wait_for_timeout(300)
    import re,urllib.parse
    t=pg.evaluate("document.querySelector('.sbaoe') && document.querySelector('.sbaoe').outerHTML.length")
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(800)
    f=pg.evaluate("S.entries.get('cmarshspear').statblock.features"); m=re.search(r'\{\{aoe:([^}]+)\}\}',f); print(urllib.parse.unquote(m.group(1)))
    pg.locator('.aoefig').first.screenshot(path='aoe4-fig.png')
    b.close()
print('ERRORS',errs)
