from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e))); G.on('response', lambda r: errs.append('404 '+r.url) if r.status>=400 else None)
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Builder'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pg=lambda: G.evaluate("(c=>JSON.parse(JSON.stringify(c.p)))(vPageNow())")
    def pick(selector, path):
        with G.expect_file_chooser() as fc: G.evaluate(f"document.querySelector('{selector.split(' >> ')[0]}').click()")
        fc.value.set_files(path); G.wait_for_timeout(1800)
    # --- New map from an image, grid in the name
    G.click('[data-act=vttmaps]'); G.wait_for_timeout(400)
    pick('[data-act=vttnewmapimg] >> nth=0', '/tmp/mapimgs/Old Tavern 20x15.png')
    p0=pg(); print('A1 new map from image:', G.evaluate("vPageNow().p.name"), p0['w'], p0['h'], [(o['layer'],o['w'],o['h']) for o in p0.get('objs',[])])
    # --- Page settings: map image added while on the Tokens layer goes onto the map layer
    G.evaluate("VTT.layer='token'; VTT.sel=null; vRefresh()"); G.wait_for_timeout(300)
    pick('[data-act=vttmapimg]', '/tmp/mapimgs/plain.png')
    if G.locator('#vkeep').count(): G.click('#vkeep'); G.wait_for_timeout(800)
    p1=pg(); print('A2 map image from page settings, layers:', [o['layer'] for o in p1['objs']])
    # --- Page settings fields
    G.evaluate("VTT.sel=null; vRefresh()"); G.wait_for_timeout(300)
    side=G.locator('#vside')
    print('A3 settings fields:', side.locator('input,select').evaluate_all("els=>els.map(e=>(e.dataset.ps||e.dataset.pf||e.name||e.id||e.type)+':'+e.type)"))
    G.screenshot(path='/tmp/mapA-settings.png')
    # --- Select the map image on the map layer, move, rotate, resize, z-order, delete
    G.evaluate("document.querySelector('.vmaps [data-act=vttmaps]') && document.querySelector('.vmaps [data-act=vttmaps]').click()"); G.wait_for_timeout(300); G.click('[data-act=vttlayer][data-v=map]'); G.wait_for_timeout(300)
    oid=p1['objs'][-1]['id']
    el=G.locator(f'.vobj[data-oid="{oid}"]'); bb=el.bounding_box(); print('A4 obj box', bb is not None)
    G.mouse.click(bb['x']+40, bb['y']+40); G.wait_for_timeout(400); print('  selected', G.evaluate("JSON.stringify(VTT.sel)"), 'panel', side.locator('h2').first.inner_text() if side.locator('h2').count() else '')
    G.mouse.move(bb['x']+40, bb['y']+40); G.mouse.down(); G.mouse.move(bb['x']+120, bb['y']+90, steps=6); G.mouse.up(); G.wait_for_timeout(700)
    o=[q for q in pg()['objs'] if q['id']==oid][0]; print('  moved to', round(o['x'],2), round(o['y'],2))
    print('  obj side buttons:', side.locator('button').all_inner_texts()[:14])
    print('ERRORS', errs); b.close()
