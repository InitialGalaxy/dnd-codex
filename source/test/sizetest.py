from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Test'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); now="new Date().toISOString()"
    G.evaluate(f"""(async()=>{{
      await S.db.doc('entries/shf').set({{type:'creature',title:'Skinwalker',body:'',tags:['shapeshifter'],statblock:{{subtitle:'Medium monstrosity',hp:'30',con:'12',ac:'13'}},updated:{now}}});
      await S.db.doc('entries/bear').set({{type:'creature',title:'Dire Bear',body:'',tags:[],hidden:true,statblock:{{subtitle:'Large beast',hp:'50',con:'16',ac:'12'}},updated:{now}}});
      await S.db.doc('entries/wyrm').set({{type:'creature',title:'Wyrm',body:'',tags:[],statblock:{{subtitle:'Huge dragon',hp:'90',con:'20',ac:'17'}},updated:{now}}});
    }})()"""); G.wait_for_timeout(800)
    cid=G.evaluate("[...S.chars.keys()][0]")
    G.evaluate(f"""charChange('{cid}', x => {{ x.summons = [{{id:'sm1', ref:'shf', kind:'Skinwalker', name:'Wisp', sb: JSON.parse(JSON.stringify(S.entries.get('shf').statblock)), active:true, inv:{{slots:{{}}}}, hp:30, form:''}}]; }}, false)"""); G.wait_for_timeout(500)
    G.evaluate(f"vSave('vtttokens/smt',{{page:'{pid}',layer:'token',x:2,y:2,size:1,img:'',name:'Wisp',ref:'s:{cid}:sm1',owner:'{cid}'}})")
    G.evaluate(f"vSave('vtttokens/mon',{{page:'{pid}',layer:'token',x:8,y:2,size:1,img:'',name:'Changeling',ref:'e:shf',owner:'',hp:30,hpMax:30}})"); G.wait_for_timeout(700)
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1500)
    px=lambda pg,i: pg.evaluate(f"(e=>e?Math.round(e.getBoundingClientRect().width/VTT.zoom):null)(document.querySelector('.vtok[data-tid={i}]'))")
    sz=lambda pg,i: pg.evaluate(f"vTokSz(S.vttTokens.get('{i}'))")
    def show(l): print(l, 'GM smt',sz(G,'smt'),'mon',sz(G,'mon'),'| player smt',sz(P,'smt'),'mon',sz(P,'mon'), '| player sees bear entry', P.evaluate("S.entries.has('bear')"))
    show('true forms')
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{form:'bear', fhp:null}})); }}, false)"); G.wait_for_timeout(900)
    G.evaluate("vPatch('vtttokens/mon',{form:'wyrm'})"); G.wait_for_timeout(900)
    show('summon->bear, monster->wyrm'); print(' drawn px GM', px(G,'smt'), px(G,'mon'))
    # manual override while shifted
    G.evaluate("VTT.sel={kind:'tok',id:'smt'}; vRefresh()"); G.wait_for_timeout(400); G.click('[data-act=vttopts]'); G.wait_for_timeout(500)
    print(' note:', G.locator('.vsznote').inner_text())
    G.click('[data-act=vttsize][data-v="4"]'); G.wait_for_timeout(700); print(' after 4x4 note:', G.locator('.vsznote').inner_text())
    G.screenshot(path='/tmp/size-opts.png')
    G.click('.mbox button[data-act=closemodal]'); G.wait_for_timeout(500); show('override bear=4')
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{form:'', fhp:null}})); }}, false)"); G.wait_for_timeout(900)
    show('summon back to true form')
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{form:'bear', fhp:null}})); }}, false)"); G.wait_for_timeout(900)
    show('bear again keeps override')
    G.evaluate("VTT.sel={kind:'tok',id:'smt'}; vRefresh()"); G.wait_for_timeout(400); G.click('[data-act=vttopts]'); G.wait_for_timeout(500)
    G.click('[data-act=vttsizeauto]'); G.wait_for_timeout(700); print(' reset note:', G.locator('.vsznote').inner_text())
    G.click('.mbox button[data-act=closemodal]'); G.wait_for_timeout(500); show('reset to form size')
    G.evaluate("vPatch('vtttokens/mon',{form:''})"); G.wait_for_timeout(900); show('monster reverted')
    G.evaluate("VTT.sel=null; vRefresh()"); G.evaluate("vPatch('vtttokens/mon',{form:'wyrm'})"); G.wait_for_timeout(900); G.screenshot(path='/tmp/size-board.png')
    print('ERRORS', errs); b.close()
