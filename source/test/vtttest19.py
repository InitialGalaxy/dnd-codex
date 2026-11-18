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
    G.click('[data-act=vtttool][data-v=select]'); G.click('[data-act=vttlvl][data-v="0"]'); G.click('[data-act=vttlayer][data-v=token]'); G.wait_for_timeout(300)
    def addtok(name,x,y,extra):
        G.evaluate(f"vSave('vtttokens/t{name}', Object.assign({{page:'{pid}',layer:'token',x:{x},y:{y},size:1,img:'',name:'{name}',ref:'',owner:'csaahan'}}, {extra}))")
    G.check('[data-act=vttpreview]'); G.wait_for_timeout(400)
    clip=lambda: G.evaluate("[...document.querySelectorAll('.vrlv')].map(e=>e.style.clipPath.length)")
    addtok('Out',12,10,'{}'); G.wait_for_timeout(700); print('outside clip', clip())
    G.evaluate("vDel('vtttokens/tOut')"); addtok('In',3,6,'{}'); G.wait_for_timeout(700); print('inside left clip', clip()); G.screenshot(path='/tmp/z-inL.png')
    # rotate the roof 90 degrees: old check would fail at the left edge
    G.evaluate(f"vObjSet('{oid}',{{rot:90}})"); G.wait_for_timeout(700); print('rotated, inside left clip', clip()); G.screenshot(path='/tmp/z-inrot.png')
    G.evaluate("vDel('vtttokens/tIn')"); addtok('Roof',4,3,'{lvl:1}'); G.wait_for_timeout(700); print('on roof clip', clip())
    G.evaluate("vDel('vtttokens/tRoof')"); addtok('Patch',12,2,'{}'); G.wait_for_timeout(700); print('second patch clip', G.evaluate("document.querySelector('.vrlv').style.clipPath.slice(0,140)"))
    b.close()
print('ERRORS', errs)
