from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Undo'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pg=lambda: G.evaluate("(c=>JSON.parse(JSON.stringify(c.p)))(vPageNow())")
    def scr(x,y):
        st=G.locator('#vstage').bounding_box(); z=G.evaluate("VTT.zoom"); C=G.evaluate("VCELL"); return st['x']+x*C*z, st['y']+y*C*z
    def click(x,y): G.mouse.click(*scr(x,y)); G.wait_for_timeout(250)
    def dragp(a,b2): G.mouse.move(*scr(*a)); G.mouse.down(); G.mouse.move(*scr(*b2), steps=8); G.mouse.up(); G.wait_for_timeout(700)
    def tool(t): G.click(f'[data-act=vtttool][data-v={t}]'); G.wait_for_timeout(250)
    st=lambda: (G.locator('[data-act=vttundo]').is_disabled(), G.locator('[data-act=vttredo]').is_disabled())
    print('U0 buttons disabled (undo, redo)', st())
    tool('wall'); click(2,2); click(6,2); click(6,5); G.keyboard.press('Enter'); G.wait_for_timeout(700)
    tool('wall'); click(8,8); click(10,8); G.keyboard.press('Enter'); G.wait_for_timeout(700)
    print('U1 walls', len(pg().get('walls',[])), 'buttons', st(), G.locator('[data-act=vttundo]').get_attribute('title'))
    G.keyboard.press('Escape'); G.mouse.click(5,5); G.keyboard.press('Control+z'); G.wait_for_timeout(800); print('U2 ctrl+z walls', len(pg().get('walls',[])), st())
    G.click('[data-act=vttundo]'); G.wait_for_timeout(800); print('U3 undo button walls', len(pg().get('walls',[])))
    G.keyboard.press('Control+Shift+z'); G.wait_for_timeout(800); print('U4 redo walls', len(pg().get('walls',[])))
    G.keyboard.press('Control+y'); G.wait_for_timeout(800); print('U5 redo again walls', len(pg().get('walls',[])), st())
    # raised squares
    tool('area'); dragp((10.5,2.5),(12.5,3.5)); print('U6 area cells', [len(a.get('cells',[])) for a in pg().get('areas',[])])
    G.keyboard.press('Control+z'); G.wait_for_timeout(800); print('  undone', pg().get('areas'), 'maxLevel', pg().get('maxLevel'))
    # token placed and deleted
    tool('select'); G.click('[data-act=vttlayer][data-v=token]'); G.wait_for_timeout(200)
    G.evaluate("vSave('vtttokens/tk1',{page:VTT.page,layer:'token',x:3,y:3,size:1,img:'',name:'Bob'})"); G.wait_for_timeout(600)
    G.evaluate("VTT.sel={kind:'tok',id:'tk1'}; vRefresh()"); G.keyboard.press('Delete'); G.wait_for_timeout(700); print('U7 token deleted', G.evaluate("S.vttTokens.has('tk1')"))
    G.keyboard.press('Control+z'); G.wait_for_timeout(800); print('  undo delete', G.evaluate("S.vttTokens.has('tk1')"), G.evaluate("(S.vttTokens.get('tk1')||{}).name"))
    G.keyboard.press('Control+z'); G.wait_for_timeout(800); print('  undo placing', G.evaluate("S.vttTokens.has('tk1')"))
    # a level swap with a token on it
    G.evaluate("vSave('vtttokens/tk2',{page:VTT.page,layer:'token',x:4,y:4,size:1,img:'',name:'Up',lvl:1})"); G.wait_for_timeout(500)
    G.evaluate("vPatch('vttpages/'+VTT.page,{maxLevel:1, walls:(vPageNow().p.walls||[]).concat([[1,1,1,4,1]])})"); G.wait_for_timeout(700)
    G.click('[data-act=vttlvl][data-v="1"]'); G.wait_for_timeout(300); G.click('.vlvrow.on [data-act=vttlvlmove][data-d="-1"]'); G.wait_for_timeout(900)
    print('U8 swapped: token lvl', G.evaluate("S.vttTokens.get('tk2').lvl"), 'wall lvl', pg()['walls'][-1][4])
    G.keyboard.press('Control+z'); G.wait_for_timeout(900); print('  undone: token lvl', G.evaluate("S.vttTokens.get('tk2').lvl"), 'wall lvl', pg()['walls'][-1][4], 'toast', G.locator('.toast').all_inner_texts()[-1:])
    # page settings name typed: one step
    G.evaluate("VTT.sel=null; vRefresh()"); G.wait_for_timeout(300)
    nm=G.locator('#vside input[type=text]').first; nm.fill('Cellar map'); nm.dispatch_event('change'); G.wait_for_timeout(600)
    G.mouse.click(700,600); G.keyboard.press('Control+z'); G.wait_for_timeout(800); print('U9 name after undo', pg().get('name'))
    # moving a picture: drag then undo
    G.evaluate("vPatch('vttpages/'+VTT.page,{objs:[{id:'o1',layer:'map',img:'',x:0,y:0,w:3,h:3,level:0}]})"); G.wait_for_timeout(700)
    G.click('[data-act=vttlayer][data-v=map]'); G.evaluate("VTT.sel=null; VTT.lvl=0; vDraw()"); G.wait_for_timeout(300); dragp((1,1),(5,6)); print('U10 picture moved', [ (o['x'],o['y']) for o in pg()['objs']])
    G.keyboard.press('Control+z'); G.wait_for_timeout(800); print('  undone', [(o['x'],o['y']) for o in pg()['objs']])
    print('ERRORS', errs); b.close()
