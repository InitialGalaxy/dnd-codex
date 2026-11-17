import json
from playwright.sync_api import sync_playwright
exec(open('run16.py').read().split("    pg.goto('http://localhost:8765/index.html#char-csaahan')")[0].replace("with sync_playwright() as p:","p=sync_playwright().start()\nif 1:"))
d=json.load(open('/home/claude/sheets/draeden.json'))
pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(1200)
pg.evaluate("(async(c)=>{const db=await claude.use('db');await db.doc('characters/cdraeden').set(c)})(%s)"%json.dumps(d)); pg.wait_for_timeout(300)
pg.goto('http://localhost:8765/index.html#char-cdraeden'); pg.wait_for_timeout(500)
pg.add_style_tag(content='#toasts{display:none!important}')
pg.screenshot(path='draeden.png', full_page=True)
print(pg.evaluate("[cSkill(S.chars.get('cdraeden'),'perception'),cSkill(S.chars.get('cdraeden'),'survival'),cSave(S.chars.get('cdraeden'),'str'),cSave(S.chars.get('cdraeden'),'dex'),cPB(S.chars.get('cdraeden')),10+cSkill(S.chars.get('cdraeden'),'perception')]"))
pg.click('[data-act=cview][data-v=inv]'); pg.wait_for_timeout(300)
pg.fill('#invnew','Test thing'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
pg.screenshot(path='draeden-inv.png', full_page=True)
print(errs)
