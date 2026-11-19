from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    G=b.new_page(viewport={'width':1440,'height':900}); G.on('pageerror',lambda e:errs.append('G '+str(e)))
    G.goto('http://localhost:3300/'); G.wait_for_timeout(1000)
    G.set_input_files('#srvfirst','/tmp/libfile.json'); G.wait_for_timeout(3000)
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(800)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Dryrones'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    with G.expect_file_chooser() as fc: G.click('[data-act=vttlayer][data-v=map]'); G.click('[data-act=vttaddimg]')
    fc.value.set_files('/tmp/battlemap.png'); G.wait_for_timeout(1500); G.click('#vgrow'); G.wait_for_timeout(1000)
    pid=G.evaluate("VTT.page")
    # ground walls around room 1 (2..9 x 2..8) with door gap on right wall 4.6-5.6
    walls=[[9,4.6,9,2],[9,2,2,2],[2,2,2,8],[2,8,9,8],[9,8,9,5.6]]
    G.evaluate(f"vPatch('vttpages/{pid}',{{walls:{walls}, light:true}})"); G.wait_for_timeout(500)
    # add level 1
    G.click('[data-act=vttaddlvl]'); G.fill('#vaskv','Rooftops'); G.keyboard.press('Enter'); G.wait_for_timeout(700)
    print('lvl', G.evaluate("VTT.lvl"), G.evaluate(f"S.vttPages.get('{pid}').levelNames"))
    # roof image at level 1
    with G.expect_file_chooser() as fc: G.click('[data-act=vttlayer][data-v=map]'); G.click('[data-act=vttaddimg]')
    fc.value.set_files('/tmp/roof.png'); G.wait_for_timeout(1500)
    oid=G.evaluate("VTT.sel.id"); G.evaluate(f"vObjSet('{oid}',{{x:2,y:2,w:7,h:6}})"); G.wait_for_timeout(500)
    # area tool: draw room outline
    G.click('[data-act=vtttool][data-v=area]'); G.wait_for_timeout(200)
    def cell(x,y):
        st=G.evaluate("(()=>{const r=document.getElementById('vstage').getBoundingClientRect();return [r.left,r.top]})()"); z=G.evaluate('VTT.zoom')
        return st[0]+x*70*z, st[1]+y*70*z
    def drag(a,b,alt=False):
        if alt: G.keyboard.down('Alt')
        G.mouse.move(*cell(*a)); G.mouse.down(); G.mouse.move(*cell(*b),steps=6); G.mouse.up()
        if alt: G.keyboard.up('Alt')
        G.wait_for_timeout(600)
    G.click('[data-act=vttlvl][data-v="0"]'); G.wait_for_timeout(200); G.click('[data-act=vtttool][data-v=area]'); G.wait_for_timeout(200)
    print('tool forces level', G.evaluate("VTT.lvl"), 'layer', G.evaluate("VTT.layer"))
    drag((2.5,2.5),(8.5,7.5))
    print('cells after add', len(G.evaluate(f"S.vttPages.get('{pid}').areas[0].cells")))
    drag((8.5,7.5),(8.5,6.5),True)
    a=G.evaluate(f"S.vttPages.get('{pid}').areas"); print('areas', len(a), 'cells after remove', len(a[0]['cells']), [8,7] in a[0]['cells'])
    drag((12.5,2.5),(13.5,3.5))
    print('cells after second patch', len(G.evaluate(f"S.vttPages.get('{pid}').areas[0].cells")), 'svg edges', G.locator('.varea.cells .aedge').count())
    G.screenshot(path='/tmp/z-cells.png')
    print('areas', G.evaluate(f"S.vttPages.get('{pid}').areas"))
    G.click('[data-act=vtttool][data-v=select]'); G.wait_for_timeout(200)
    def addtok(name,x,y,extra,owner='csaahan'):
        G.evaluate(f"vSave('vtttokens/t{name}', Object.assign({{page:'{pid}',layer:'token',x:{x},y:{y},size:1,img:'',name:'{name}',ref:'',owner:'{owner}'}}, {extra}))")
    addtok('Bram',3,6,'{}'); addtok('Lyra',5,4,'{lvl:1}'); addtok('Gob',12,10,'{}',''); addtok('Bat',6,5,'{lvl:1}',''); G.wait_for_timeout(800)
    # ---- GM level filter ----
    print('rows', G.locator('.vlvrow').count(), 'show all on', G.locator('.vlvall.on').count())
    G.click('.vlvrow:has([data-v="1"]) .vlvname'); G.wait_for_timeout(400)
    print('filter L1: lvl', G.evaluate("VTT.lvl"), 'show', G.evaluate("[...VTT.lvlShow]"), 'all on', G.locator('.vlvall.on').count())
    print('  GM sees toks', sorted(G.evaluate("[...document.querySelectorAll('.vtok')].filter(e=>getComputedStyle(e).display!=='none').map(e=>S.vttTokens.get(e.dataset.tid).name)")), 'hidden ground pics', G.locator('.vobj.lvlhid').count(), 'visible pics', G.locator('.vobj:not(.lvlhid)').count(), 'hidden walls', G.locator('.vwalls line.lvlhid').count(), 'hidden toks', G.locator('.vtok.lvlhid').count())
    G.click('[data-act=vttlayer][data-v=walls]'); G.wait_for_timeout(200)
    st=G.evaluate("(()=>{const r=document.getElementById('vstage').getBoundingClientRect();return [r.left,r.top]})()"); z=G.evaluate('VTT.zoom')
    G.mouse.click(st[0]+2*70*z, st[1]+5*70*z); G.wait_for_timeout(300); print('  click ground wall selects', G.evaluate("VTT.sel"))
    G.screenshot(path='/tmp/z-filter.png')
    G.click('.vlvrow:has([data-v="0"]) .vlvtick input'); G.wait_for_timeout(300); print('tick ground too: show', sorted(G.evaluate("[...VTT.lvlShow]")), 'lvl', G.evaluate("VTT.lvl"))
    G.click('[data-act=vttlvlall]'); G.wait_for_timeout(300); print('show all again', G.evaluate("VTT.lvlShow"), G.locator('.lvlhid').count())
    # ---- player floors ----
    P=b.new_context(viewport={'width':1280,'height':800}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0') if P.locator('.vcamp').count() else None; P.wait_for_timeout(1500)
    clip=lambda: P.evaluate("[...document.querySelectorAll('.vrlv')].map(e=>e.style.clipPath.length)")
    print('player bar', P.locator('#vfloors:not([hidden]) button').all_inner_texts(), 'clip all', clip())
    vis=lambda: sorted(P.evaluate("[...document.querySelectorAll('.vtok')].filter(e=>getComputedStyle(e).display!=='none').map(e=>S.vttTokens.get(e.dataset.tid).name)"))
    print('all floors see', vis())
    P.click('#vfloors [data-act=vttpfloor][data-v="0"]'); P.wait_for_timeout(500); print('ground view clip', clip(), 'sees', vis()); P.screenshot(path='/tmp/z-pground.png')
    P.click('#vfloors [data-act=vttpfloor][data-v="1"]'); P.wait_for_timeout(500); print('upstairs view clip', clip(), 'sees', vis()); P.screenshot(path='/tmp/z-pup.png')
    G.evaluate("vPatch('vtttokens/tLyra',{lvl:0})"); P.wait_for_timeout(1200); print('after Lyra goes down sees', vis()); print('after Lyra goes down: bar hidden', P.evaluate("document.getElementById('vfloors').hidden"), 'pfloor', P.evaluate("VTT.pfloor"))
    b.close()
print('ERRORS', errs)
