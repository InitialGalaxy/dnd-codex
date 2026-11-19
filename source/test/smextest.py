from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Test'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page")
    now="new Date().toISOString()"
    # a Medium shapeshifter (no meter) and a Large bear form (Con 16 -> 32, +16), and a Huge wyrm form (Con 20 -> 40, +20)
    G.evaluate(f"""(async()=>{{
      await S.db.doc('entries/shf').set({{type:'creature',title:'Skinwalker',body:'',tags:['shapeshifter'],statblock:{{subtitle:'Medium monstrosity',hp:'30',con:'12',ac:'13'}},updated:{now}}});
      await S.db.doc('entries/bear').set({{type:'creature',title:'Dire Bear',body:'',tags:[],statblock:{{subtitle:'Large beast',hp:'50',con:'16',ac:'12'}},updated:{now}}});
      await S.db.doc('entries/wyrm').set({{type:'creature',title:'Wyrm',body:'',tags:[],statblock:{{subtitle:'Huge dragon',hp:'90',con:'20',ac:'17'}},updated:{now}}});
    }})()"""); G.wait_for_timeout(800)
    cid=G.evaluate("[...S.chars.keys()][0]")
    G.evaluate(f"""charChange('{cid}', x => {{ x.summons = [{{id:'sm1', ref:'shf', kind:'Skinwalker', name:'Wisp', sb: JSON.parse(JSON.stringify(S.entries.get('shf').statblock)), active:true, inv:{{slots:{{}}}}, hp:30, form:''}}]; }}, false)"""); G.wait_for_timeout(500)
    G.evaluate(f"vSave('vtttokens/smt',{{page:'{pid}',layer:'token',x:2,y:2,size:1,img:'',name:'Wisp',ref:'s:{cid}:sm1',owner:'{cid}',bars:'all'}})")
    G.evaluate(f"vSave('vtttokens/mon',{{page:'{pid}',layer:'token',x:6,y:2,size:1,img:'',name:'Changeling',ref:'e:shf',owner:'',hp:30,hpMax:30}})"); G.wait_for_timeout(700)
    bars=lambda i: G.evaluate(f"vBars(S.vttTokens.get('{i}')).map(b=>b.label+' '+b.cur+'/'+b.max)")
    def sel(i): G.evaluate(f"VTT.sel={{kind:'tok',id:'{i}'}}; vRefresh()"); G.wait_for_timeout(400)
    def dmg(n, mode=None):
        if mode: G.click(f'[data-act=vttdmgmode][data-v={mode}]'); G.wait_for_timeout(200)
        G.fill('.vhpn',str(n)); G.click('[data-act=vttdmg][data-v=dmg]'); G.wait_for_timeout(600)
    print('SUMMON true form', bars('smt'))
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{form:'bear', fhp:null}})); }}, false)"); G.wait_for_timeout(500)
    sel('smt'); print('summon as bear', bars('smt'), 'damage buttons', G.locator('.vdmgtype button').count())
    dmg(20,'bps'); print(' bps 20', bars('smt'))
    dmg(20); print(' bps 20 more', bars('smt'))
    dmg(5,'hp'); print(' hp only 5', bars('smt'))
    G.click('[data-act=vttexfill]'); G.wait_for_timeout(600); print(' refill', bars('smt'))
    dmg(10,'ex'); print(' exhaust only 10', bars('smt'))
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{form:'wyrm', fhp:null}})); }}, false)"); G.wait_for_timeout(500)
    print(' into wyrm', bars('smt'))
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{form:'bear', fhp:null}})); }}, false)"); G.wait_for_timeout(500)
    print(' back to bear keeps its meter', bars('smt'))
    print('MONSTER true form', bars('mon'))
    G.evaluate("vPatch('vtttokens/mon',{form:'bear'})"); G.wait_for_timeout(500); sel('mon')
    print('monster as bear', bars('mon')); dmg(40,'bps'); print(' bps 40', bars('mon'))
    G.evaluate("vPatch('vtttokens/mon',{form:''})"); G.wait_for_timeout(500); print(' reverted', bars('mon'))
    G.evaluate("vPatch('vtttokens/mon',{form:'bear'})"); G.wait_for_timeout(500); print(' bear again', bars('mon'))
    # custom bar on the summon token
    sel('smt'); G.click('[data-act=vttopts]'); G.wait_for_timeout(400); G.click('[data-act=vttcbaradd]'); G.wait_for_timeout(500)
    G.fill('.vcbrow [data-cb=name]','Ki'); G.locator('.vcbrow [data-cb=name]').dispatch_event('change'); G.wait_for_timeout(400)
    print('summon options has exhaust fields', G.locator('#modal [data-vf=exMax]').count())
    G.click('.mbox button[data-act=closemodal]'); G.wait_for_timeout(300); print('summon with custom bar', bars('smt'))
    G.screenshot(path='/tmp/smex.png')
    # the player sees and can use it
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1500)
    P.evaluate("VTT.sel={kind:'tok',id:'smt'}; vRefresh()"); P.wait_for_timeout(500)
    print('player damage buttons', P.locator('.vdmgtype button').count(), 'refill', P.locator('[data-act=vttexfill]').count())
    P.fill('.vhpn','4'); P.click('[data-act=vttdmgmode][data-v=bps]'); P.wait_for_timeout(200); P.click('[data-act=vttdmg][data-v=dmg]'); P.wait_for_timeout(900)
    print('after player 4 bps', bars('smt'))
    print('ERRORS', errs); b.close()
