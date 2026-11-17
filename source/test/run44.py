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
    dragc((5,3),(7,3)); dragc((5,4),(7,4))
    pg.click('[data-tool=mv]'); pg.mouse.click(*cxy(2,6)); pg.click('[data-tool=en]'); pg.mouse.click(*cxy(7,1))
    pg.click('[data-edge="left+"]'); print('after left+', st())
    pg.click('[data-edge="top-"]'); print('after top-', st())
    pg.screenshot(path='aoe2-a.png')
    pg.click('[data-tool=move]'); dragc((6,2),(6,5)); pg.screenshot(path='aoe2-b.png')
    dragc((3,5),(1,7))  # move token (mv was at 2,6 -> left+ =>3,6 ; top- => 3,5)
    pg.click('[data-tool=copy]'); dragc((6,5),(6,1))
    pg.click('[data-color="#4aa3df"]') if pg.locator('[data-color="#4aa3df"]').count() else None
    pg.screenshot(path='aoe2-c.png')
    pg.click('[data-x=save]'); pg.wait_for_timeout(300)
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(800)
    f=pg.evaluate("S.entries.get('cmarshspear').statblock.features"); import re,urllib.parse
    m=re.search(r'\{\{aoe:([^}]+)\}\}',f); print(urllib.parse.unquote(m.group(1)) if m else 'none')
    pg.locator('.aoefig').first.scroll_into_view_if_needed(); pg.locator('.aoefig').first.screenshot(path='aoe2-fig.png')
    b.close()
print('ERRORS',errs)
