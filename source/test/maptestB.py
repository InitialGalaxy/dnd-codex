from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]; bad=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.on('response', lambda r: bad.append(r.url) if r.status>=400 else None)
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Builder'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pg=lambda: G.evaluate("(c=>JSON.parse(JSON.stringify(c.p)))(vPageNow())")
    def scr(x,y):
        st=G.locator('#vstage').bounding_box(); z=G.evaluate("VTT.zoom"); C=G.evaluate("VCELL"); return st['x']+x*C*z, st['y']+y*C*z
    def click(x,y, **k): G.mouse.click(*scr(x,y), **k); G.wait_for_timeout(250)
    def dragp(a,b2, steps=6, alt=False):
        if alt: G.keyboard.down('Alt')
        G.mouse.move(*scr(*a)); G.mouse.down(); G.mouse.move(*scr(*b2), steps=steps); G.mouse.up(); G.wait_for_timeout(600)
        if alt: G.keyboard.up('Alt')
    def tool(t): G.click(f'[data-act=vtttool][data-v={t}]'); G.wait_for_timeout(250)
    # --- Walls: three clicks then Enter; then a second line finished by clicking twice
    G.keyboard.press('w'); G.wait_for_timeout(200); print('B1 tool after W key', G.evaluate("VTT.tool"), 'layer', G.evaluate("VTT.layer"))
    click(2,2); click(8,2); click(8,6); G.keyboard.press('Enter'); G.wait_for_timeout(700)
    print('  walls after Enter', pg().get('walls'))
    click(2,2.1); click(2,6.2); click(2,6.2); G.wait_for_timeout(700); print('  walls after double click', pg().get('walls')[2:])
    click(5,5); G.keyboard.press('Escape'); G.wait_for_timeout(300); print('  Esc cancels draft', G.evaluate("VTT.draft"), len(pg()['walls']))
    # --- Select a wall (with the select tool, on the walls layer) and make it a door
    tool('select'); G.click('[data-act=vttlayer][data-v=walls]'); G.wait_for_timeout(300)
    click(5,2); print('B2 selected', G.evaluate("JSON.stringify(VTT.sel)"))
    if G.locator('[data-act=vttwtype][data-v=door]').count():
        G.click('[data-act=vttwtype][data-v=door]'); G.wait_for_timeout(700); print('  door', pg()['walls'][0])
        G.check('[data-wf=locked]'); G.wait_for_timeout(600); print('  locked', pg()['walls'][0][5].get('locked'))
    # --- move a wall end
    G.evaluate("VTT.sel={kind:'wall',i:1}; vDraw(); vRefresh()"); G.wait_for_timeout(300)
    wh=G.locator('.vwh'); print('B3 wall handles', wh.count())
    if wh.count():
        bb=wh.nth(1).bounding_box(); G.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); G.mouse.down(); G.mouse.move(*scr(9,7), steps=6); G.mouse.up(); G.wait_for_timeout(700)
        print('  walls after moving the corner', pg()['walls'][1:3])
    G.keyboard.press('Delete'); G.wait_for_timeout(700); print('  after Delete', len(pg()['walls']), 'walls')
    # --- Lights: place one, move it, change it, delete
    G.click('[data-act=vttlayer][data-v=lights]'); G.wait_for_timeout(300)
    click(4,4); G.wait_for_timeout(600); L=pg().get('lights') or []; print('B4 lights', L)
    G.screenshot(path='/tmp/mapB-light.png')
    # --- Raised squares on level 1 then remove some with Alt
    G.click('[data-act=vttlayer][data-v=walls]'); tool('area'); dragp((10.5,2.5),(13.5,4.5)); a=pg().get('areas'); print('B5 areas', [(x['level'],len(x.get('cells',[]))) for x in a], 'lvl', G.evaluate("VTT.lvl"))
    dragp((10.5,2.5),(10.5,4.5), alt=True); a=pg().get('areas'); print('  after alt-drag', [(x['level'],len(x.get('cells',[]))) for x in a])
    # --- Stairs between ground and level 1
    tool('link'); dragp((14.5,6.5),(15.5,7.5)); print('B6 links', pg().get('links'))
    # --- Levels: add above/below, rename, reorder
    G.evaluate("VTT.sel=null; vRefresh()"); n0=G.locator('.vlvgroup [data-act=vttlvl]').count()
    G.click('[data-act=vttaddlvl][data-v=below]'); G.wait_for_timeout(400); G.fill('#vaskv','Cellar'); G.keyboard.press('Enter'); G.wait_for_timeout(700)
    G.click('[data-act=vttlvl][data-v="0"]'); G.wait_for_timeout(300); G.click('.vlvrow.on [data-act=vttrenlvl]'); G.wait_for_timeout(300); G.fill('#vaskv','Taproom'); G.keyboard.press('Enter'); G.wait_for_timeout(700)
    G.click('[data-act=vttlvl][data-v="-1"]'); G.wait_for_timeout(300); G.click('.vlvrow.on [data-act=vttlvlmove][data-d="1"]'); G.wait_for_timeout(900); print('  after moving the cellar up', G.locator('.vlvgroup').inner_text().replace('\n',' | ')[:200], '| link levels', pg().get('links')[0]['levels'], '| area level', pg()['areas'][0]['level'])
    G.click('.vlvrow.on [data-act=vttlvlmove][data-d="-1"]'); G.wait_for_timeout(900)
    print('B7 level buttons', n0, '->', G.locator('.vlvgroup [data-act=vttlvl]').count(), G.locator('.vlvgroup').inner_text().replace('\n',' | ')[:200])
    # --- Draw and erase
    tool('draw'); dragp((3,10),(7,12)); d=G.evaluate("[...S.vttDraw.values()].length"); print('B8 drawings', d)
    G.click('[data-act=vttpenerase]'); G.wait_for_timeout(200); dragp((3,10),(7,12)); print('  after erase', G.evaluate("[...S.vttDraw.values()].length"))
    # --- Travel scale and route
    tool('scale'); dragp((1,13),(6,13))
    G.fill('#vsc-a','1'); G.click('.vscaleform button[type=submit]'); G.wait_for_timeout(700)
    print('B9 scale', pg().get('scale'))
    tool('travel'); click(1,14); click(11,14); G.keyboard.press('Enter'); G.wait_for_timeout(500); print('  travel readout', G.locator('#vhint').inner_text()[:120])
    # --- Measure shapes
    tool('measure'); dragp((2,8),(6,8)); print('B10 measure', G.locator('#vmeas text').all_inner_texts()[:3])
    G.keyboard.press('Escape')
    # --- Ping
    tool('ping'); click(5,5); print('B11 ping ok')
    G.keyboard.press('v'); G.wait_for_timeout(200); G.screenshot(path='/tmp/mapB.png')
    print('BAD URLS', bad[:5]); print('ERRORS', errs); b.close()
