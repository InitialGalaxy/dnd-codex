import json
from playwright.sync_api import sync_playwright
exec(open('run16.py').read().split("    pg.goto('http://localhost:8765/index.html#char-csaahan')")[0].replace("with sync_playwright() as p:","p=sync_playwright().start()\nif 1:"))
sp=None
pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(1500)
spear=pg.evaluate("[...S.entries].find(([k,v])=>/spear/i.test(v.title)&&v.type==='item')[0]")
pg.goto('http://localhost:8765/index.html#entry-'+spear); pg.wait_for_timeout(400)
pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
print('kind', pg.evaluate("readItemFields().category"))
box='.dmgrows[data-kind="weapon"]'
pg.fill(box+' .dmg-dice','1d8'); pg.fill(box+' .dmg-type','force')
pg.click('[data-act=dmgadd][data-kind=weapon]'); pg.wait_for_timeout(100)
pg.keyboard.type('1d8'); pg.locator(box+' .dmgrow:last-child .dmg-type').fill('lightning')
pg.locator('.statpanel[data-kind=weapon]').screenshot(path='dmg-editor.png')
pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
print(pg.evaluate(f"JSON.stringify(window.__store.get('entries/{spear}').item.stats)"))
pg.locator('.itempage').screenshot(path='dmg-item.png')
# gear item: rope cost preserved + damage
pg.goto('http://localhost:8765/index.html#srd'); pg.wait_for_timeout(300); pg.fill('#srdq','rope'); pg.wait_for_timeout(200); pg.click('[data-act=srdcopy][data-v=rope-hempen-50-feet]'); pg.wait_for_timeout(400)
rid=pg.evaluate("[...S.entries].find(([k,v])=>v.srd==='rope-hempen-50-feet')[0]")
pg.goto('http://localhost:8765/index.html#entry-'+rid); pg.wait_for_timeout(300); pg.click('[data-act=edit]'); pg.wait_for_timeout(300)
pg.fill('.dmgrows[data-kind="item"] .dmg-dice','1d4'); pg.fill('.dmgrows[data-kind="item"] .dmg-type','bludgeoning')
pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
print(pg.evaluate(f"JSON.stringify(window.__store.get('entries/{rid}').item.stats)"))
pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(400)
pg.click('[data-act=cview][data-v=inv]'); pg.wait_for_timeout(300)
pg.fill('#invq','spear'); pg.wait_for_timeout(200); pg.click(f'[data-act=invadd][data-v="e:{spear}"]'); pg.wait_for_timeout(200)
pg.fill('#invq','rope'); pg.wait_for_timeout(200); pg.click(f'[data-act=invadd][data-v="e:{rid}"]'); pg.wait_for_timeout(200)
pg.select_option('select[data-eqpick]', label=None, index=1) if False else None
pg.click('[data-act=cview][data-v=sheet]'); pg.wait_for_timeout(200)
pg.select_option('select[data-eqpick]', index=1); pg.wait_for_timeout(300)
pg.locator('.catk').screenshot(path='dmg-sheet.png')
print(errs)
