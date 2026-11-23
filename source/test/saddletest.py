from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    # a saddle made in the item editor
    G.click('header [data-act=new]'); G.wait_for_timeout(300)
    G.fill('#ed-title','Two-seat Saddle'); G.select_option('#ed-type','item'); G.uncheck('#it-magical'); G.select_option('#it-cat','Saddle'); G.wait_for_timeout(200)
    print('seats box visible', G.locator('#it-seats').is_visible(), 'value', G.input_value('#it-seats'))
    G.fill('#it-seats','2'); G.screenshot(path='/tmp/saddle-ed.png'); G.click('form[data-form=entry] button[type=submit]'); G.wait_for_timeout(800)
    sid=G.evaluate("[...S.entries].find(([,e])=>e.title==='Two-seat Saddle')[0]"); print('saved', G.evaluate(f"JSON.stringify(S.entries.get('{sid}').item.seats)"), G.evaluate(f"S.entries.get('{sid}').item.category"))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Saddle'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); now="new Date().toISOString()"
    G.evaluate(f"""(async()=>{{
      await S.db.doc('entries/horse').set({{type:'creature',title:'Warhorse',body:'',tags:[],statblock:{{subtitle:'Large beast',hp:'19',con:'13',ac:'11'}},updated:{now}}});
      await S.db.doc('entries/gob').set({{type:'creature',title:'Goblin',body:'',tags:[],statblock:{{subtitle:'Small humanoid',hp:'7',con:'10',ac:'15'}},updated:{now}}});
      await S.db.doc('entries/wolf').set({{type:'creature',title:'Wolf',body:'',tags:[],statblock:{{subtitle:'Medium beast',hp:'11',con:'12',ac:'13'}},updated:{now}}});
    }})()"""); G.wait_for_timeout(800)
    cid=G.evaluate("[...S.chars].find(([,c])=>!c.hidden)[0]")
    G.evaluate(f"""charChange('{cid}', x => {{ x.summons = [{{id:'sm1', ref:'horse', kind:'Warhorse', name:'Clover', sb: JSON.parse(JSON.stringify(S.entries.get('horse').statblock)), active:true, inv:{{slots:{{}}}}, hp:19, form:''}}]; }}, false)"""); G.wait_for_timeout(500)
    G.evaluate(f"vSave('vtttokens/pc',{{page:'{pid}',layer:'token',x:1,y:1,size:1,img:'',name:'Hero',ref:'c:{cid}',owner:'{cid}'}})")
    G.evaluate(f"vSave('vtttokens/pal',{{page:'{pid}',layer:'token',x:1,y:3,size:1,img:'',name:'Squire',ref:'e:gob',owner:'{cid}',hp:7,hpMax:7}})")
    G.evaluate(f"vSave('vtttokens/hz',{{page:'{pid}',layer:'token',x:5,y:5,size:2,img:'',name:'Clover',ref:'s:{cid}:sm1',owner:'{cid}'}})")
    G.evaluate(f"vSave('vtttokens/wolf',{{page:'{pid}',layer:'token',x:10,y:10,size:1,img:'',name:'Wolf',ref:'e:wolf',owner:'',hp:11,hpMax:11}})")
    G.evaluate(f"vSave('vtttokens/g1',{{page:'{pid}',layer:'token',x:12,y:10,size:1,img:'',name:'Gob',ref:'e:gob',owner:'',hp:7,hpMax:7}})")
    G.evaluate(f"vPatch('vttcamps/'+vCampId(),{{playerPage:'{pid}'}})"); G.wait_for_timeout(900)
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1800)
    pos=lambda pg,i: pg.evaluate(f"(t=>t?[t.x,t.y,t.mount||null]:null)(S.vttTokens.get('{i}'))")
    cap=lambda pg,i: pg.evaluate(f"vMountCap(S.vttTokens.get('{i}'))")
    print('caps: horse', cap(G,'hz'), 'wolf', cap(G,'wolf'))
    P.evaluate("vPatch('vtttokens/pc',{x:5,y:5})"); P.wait_for_timeout(700); P.evaluate("vRideOn('pc','hz')"); P.wait_for_timeout(1000); print('hero on horse', pos(P,'pc'))
    P.evaluate("vPatch('vtttokens/pal',{x:6,y:6})"); P.wait_for_timeout(900); P.evaluate("VTT.lastDrop='pal'; vDraw()"); print('squire buttons (no saddle):', P.locator('.vgo').all_inner_texts())
    P.evaluate("vRideOn('pal','hz')"); P.wait_for_timeout(800); print('  squire tried', pos(P,'pal'))
    # equip the saddle on the summon
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{inv:{{slots:{{r0c0:{{ref:'e:{sid}', name:'Two-seat Saddle'}}}}}}}})); }}, false)"); G.wait_for_timeout(1200)
    print('with saddle cap', cap(P,'hz'), 'buttons', P.locator('.vgo').all_inner_texts())
    P.click('.vgo button[data-mount=hz]'); P.wait_for_timeout(1200); print('  squire on', pos(P,'pal'), 'hero', pos(P,'pc'))
    G.evaluate("VTT.sel={kind:'tok',id:'hz'}; vRefresh()"); G.wait_for_timeout(400); print('  GM panel', G.locator('.vmountrow').all_inner_texts())
    G.screenshot(path='/tmp/saddle-2.png')
    # take the saddle off: one has to get off
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{inv:{{slots:{{}}}}}})); }}, false)"); G.wait_for_timeout(1500)
    print('saddle off: hero', pos(G,'pc'), 'squire', pos(G,'pal'), 'toast', G.locator('.toast').all_inner_texts()[-1:])
    # Medium wolf carries one Small goblin; GM can overload with a warning
    G.evaluate("vRideOn('g1','wolf')"); G.wait_for_timeout(900); print('goblin on wolf', pos(G,'g1'))
    G.evaluate("vDismount('pal'); vPatch('vtttokens/pal',{x:10,y:10})"); G.wait_for_timeout(900); P.evaluate("VTT.lastDrop='pal'; vDraw()"); print('player squire at wolf:', P.locator('.vgo').all_inner_texts())
    print('ERRORS', errs); b.close()
