from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    if not G.locator('.vcamp a').count():
        G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Test'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    else: G.click('.vcamp a >> nth=0'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page")
    # a Large creature with a stat block: give it Con 16 and HP 60
    eid=G.evaluate("[...S.entries.entries()].find(([k,v])=>v.type==='creature'&&v.statblock)[0]")
    G.evaluate(f"(async()=>{{const e=S.entries.get('{eid}'); const sb=Object.assign({{}},e.statblock,{{subtitle:'Large monstrosity, unaligned',con:'16',hp:'60 (8d10 + 16)',exhaust:''}}); await S.db.doc('entries/{eid}').set(Object.assign({{}},e,{{statblock:sb}}));}})()"); G.wait_for_timeout(600)
    G.evaluate(f"vSave('vtttokens/mon',{{page:'{pid}',layer:'token',x:3,y:3,size:2,img:'',name:'Brute',ref:'e:{eid}',owner:'',hp:60,hpMax:60}})"); G.wait_for_timeout(700)
    G.evaluate("VTT.sel={kind:'tok',id:'mon'}; vRefresh()"); G.wait_for_timeout(500)
    bars=lambda: G.evaluate("vBars(S.vttTokens.get('mon')).map(b=>b.label+' '+b.cur+'/'+b.max)")
    print('bars', bars())
    def dmg(n):
        G.fill('.vhpn',str(n)); G.click('[data-act=vttdmg][data-v=dmg]'); G.wait_for_timeout(500)
    dmg(20); print('after 20', bars())
    dmg(20); print('after 40 more', bars())
    G.screenshot(path='/tmp/ex1.png')
    G.click('[data-act=vttexfill]'); G.wait_for_timeout(500); print('refilled', bars())
    G.click('[data-act=vttopts]'); G.wait_for_timeout(400)
    G.click('[data-act=vttcbaradd]'); G.wait_for_timeout(600)
    G.fill('.vcbrow [data-cb=name]','Rage'); G.locator('.vcbrow [data-cb=name]').dispatch_event('change'); G.wait_for_timeout(300)
    G.fill('.vcbrow [data-cb=max]','3'); G.locator('.vcbrow [data-cb=max]').dispatch_event('change'); G.wait_for_timeout(300)
    G.fill('.vcbrow [data-cb=cur]','3'); G.locator('.vcbrow [data-cb=cur]').dispatch_event('change'); G.wait_for_timeout(400)
    G.locator('#modal .mbox').screenshot(path='/tmp/ex2.png')
    G.click('.mbox button[data-act=closemodal]'); G.wait_for_timeout(300)
    G.click('[data-act=vttcbar][data-v="-1"]'); G.wait_for_timeout(500); print('rage used', bars())
    G.screenshot(path='/tmp/ex3.png')
    print('heal leaves exhaust:'); G.fill('.vhpn','10'); G.click('[data-act=vttdmg][data-v=heal]'); G.wait_for_timeout(500); print(bars())
    print('ERRORS', errs); b.close()
