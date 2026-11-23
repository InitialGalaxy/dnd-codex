from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Lights'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pg=lambda: G.evaluate("(c=>JSON.parse(JSON.stringify(c.p)))(vPageNow())")
    def scr(x,y):
        st=G.locator('#vstage').bounding_box(); z=G.evaluate("VTT.zoom"); C=G.evaluate("VCELL"); return st['x']+x*C*z, st['y']+y*C*z
    def click(x,y): G.mouse.click(*scr(x,y)); G.wait_for_timeout(300)
    def dragp(a,b2): G.mouse.move(*scr(*a)); G.mouse.down(); G.mouse.move(*scr(*b2), steps=8); G.mouse.up(); G.wait_for_timeout(700)
    G.click('[data-act=vttlayer][data-v=lights]'); click(5,5); click(5,5); print('D1 lights after two clicks on the same spot', len(pg().get('lights',[])), 'sel', G.evaluate("JSON.stringify(VTT.sel)"))
    lid=pg()['lights'][0]['id']
    G.evaluate(f"VTT.sel={{kind:'light',id:'{lid}'}}; vRefresh()"); G.wait_for_timeout(300)
    if G.locator('[data-lf=bright]').count():
        G.fill('[data-lf=bright]','40'); G.locator('[data-lf=bright]').dispatch_event('change'); G.wait_for_timeout(600); print('  bright', pg()['lights'][0]['bright'])
        G.select_option('[data-lf=preset]', index=2); G.wait_for_timeout(600); print('  preset', pg()['lights'][0]['name'])
    else: print('  NO LIGHT PANEL', G.locator('#vside').inner_text()[:200])
    dragp((5,5),(8,3)); print('D2 dragged light', [(l['x'],l['y']) for l in pg()['lights']])
    G.keyboard.press('Delete'); G.wait_for_timeout(600); print('D3 after Delete', len(pg().get('lights',[])))
    # pictures: resize handle, rotate, fit, order
    G.evaluate("vPatch('vttpages/'+VTT.page,{objs:[{id:'o1',layer:'map',img:'',x:1,y:1,w:3,h:2,level:0},{id:'o2',layer:'map',img:'',x:6,y:6,w:2,h:2,level:0}]})"); G.wait_for_timeout(700)
    G.click('[data-act=vttlayer][data-v=map]'); G.wait_for_timeout(200); click(2,2); print('D4 selected', G.evaluate("JSON.stringify(VTT.sel)"))
    h=G.locator('[data-handle]'); print('  resize handle', h.count())
    if h.count():
        bb=h.first.bounding_box(); G.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); G.mouse.down(); G.mouse.move(*scr(7,5), steps=8); G.mouse.up(); G.wait_for_timeout(700)
        o=[q for q in pg()['objs'] if q['id']=='o1'][0]; print('  resized', round(o['w'],2), round(o['h'],2))
    G.click('[data-act=vttobjrot][data-v="90"]') if G.locator('[data-act=vttobjrot][data-v="90"]').count() else G.locator('[data-act=vttobjrot]').nth(1).click(); G.wait_for_timeout(600); print('  rot', [q.get('rot') for q in pg()['objs'] if q['id']=='o1'])
    G.click('[data-act=vttobjz][data-v=front]'); G.wait_for_timeout(600); print('  order', [q['id'] for q in pg()['objs']])
    G.click('[data-act=vttobjfit]'); G.wait_for_timeout(600); o=[q for q in pg()['objs'] if q['id']=='o1'][0]; print('  fit', o['x'],o['y'],round(o['w'],2),round(o['h'],2))
    # copy / paste a picture
    G.keyboard.press('Control+c'); G.mouse.move(*scr(10,4)); G.keyboard.press('Control+v'); G.wait_for_timeout(700); print('D5 pictures after copy+paste', [(q['x'],q['y'],q['w']) for q in pg()['objs']])
    G.keyboard.press('Control+z'); G.wait_for_timeout(700); print('  undo paste', len(pg()['objs']))
    # box select tokens and delete together, then undo
    G.click('[data-act=vttlayer][data-v=token]')
    for i in range(3): G.evaluate(f"vSave('vtttokens/b{i}',{{page:VTT.page,layer:'token',x:{10+i},y:10,size:1,img:'',name:'T{i}'}})")
    G.wait_for_timeout(700); G.keyboard.down('Shift'); dragp((9.5,9.5),(13.5,11.5)); G.keyboard.up('Shift'); print('D6 box selected', G.evaluate("VTT.multi.size"))
    G.keyboard.press('Delete'); G.wait_for_timeout(800); print('  deleted, left', G.evaluate("[...S.vttTokens.keys()].filter(k=>k.startsWith('b')).length"))
    G.keyboard.press('Control+z'); G.wait_for_timeout(900)
    print('  after one undo', G.evaluate("[...S.vttTokens.keys()].filter(k=>k.startsWith('b')).length"))
    print('ERRORS', errs); b.close()
