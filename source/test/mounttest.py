from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Ride'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); now="new Date().toISOString()"
    G.evaluate(f"""(async()=>{{
      await S.db.doc('entries/shf').set({{type:'creature',title:'Skinwalker',body:'',tags:['shapeshifter'],statblock:{{subtitle:'Medium monstrosity',hp:'30',con:'12',ac:'13'}},updated:{now}}});
      await S.db.doc('entries/bear').set({{type:'creature',title:'Dire Bear',body:'',tags:[],statblock:{{subtitle:'Large beast',hp:'50',con:'16',ac:'12'}},updated:{now}}});
      await S.db.doc('entries/horse').set({{type:'creature',title:'Wild Horse',body:'',tags:[],statblock:{{subtitle:'Large beast',hp:'19',con:'12',ac:'10'}},updated:{now}}});
      await S.db.doc('entries/wyrm').set({{type:'creature',title:'Wyrm',body:'',tags:[],statblock:{{subtitle:'Huge dragon',hp:'90',con:'20',ac:'17'}},updated:{now}}});
      await S.db.doc('entries/gob').set({{type:'creature',title:'Goblin',body:'',tags:[],statblock:{{subtitle:'Small humanoid',hp:'7',con:'10',ac:'15'}},updated:{now}}});
    }})()"""); G.wait_for_timeout(800)
    cid=G.evaluate("[...S.chars].find(([,c])=>!c.hidden)[0]")
    G.evaluate(f"""charChange('{cid}', x => {{ x.summons = [{{id:'sm1', ref:'shf', kind:'Skinwalker', name:'Wisp', sb: JSON.parse(JSON.stringify(S.entries.get('shf').statblock)), active:true, inv:{{slots:{{}}}}, hp:30, form:''}}]; }}, false)"""); G.wait_for_timeout(500)
    G.evaluate(f"vSave('vtttokens/pc',{{page:'{pid}',layer:'token',x:1,y:1,size:1,img:'',name:'Hero',ref:'c:{cid}',owner:'{cid}'}})")
    G.evaluate(f"vSave('vtttokens/smt',{{page:'{pid}',layer:'token',x:4,y:4,size:1,img:'',name:'Wisp',ref:'s:{cid}:sm1',owner:'{cid}'}})")
    G.evaluate(f"vSave('vtttokens/horse',{{page:'{pid}',layer:'token',x:10,y:4,size:2,img:'',name:'Wild Horse',ref:'e:horse',owner:'',hp:19,hpMax:19}})")
    G.evaluate(f"vSave('vtttokens/wyrm',{{page:'{pid}',layer:'token',x:9,y:10,size:3,img:'',name:'Wyrm',ref:'e:wyrm',owner:'',hp:90,hpMax:90}})")
    G.evaluate(f"vSave('vtttokens/g1',{{page:'{pid}',layer:'token',x:1,y:10,size:1,img:'',name:'Gob A',ref:'e:gob',owner:'',hp:7,hpMax:7}})")
    G.evaluate(f"vSave('vtttokens/g2',{{page:'{pid}',layer:'token',x:1,y:12,size:1,img:'',name:'Gob B',ref:'e:gob',owner:'',hp:7,hpMax:7}})")
    G.evaluate(f"(async()=>{{ const c=await S.db.doc('vttcamps/'+vCampId()).get(); await vPatch('vttcamps/'+vCampId(),{{playerPage:'{pid}'}}); }})()"); G.wait_for_timeout(900)
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1800)
    pos=lambda pg,i: pg.evaluate(f"(t=>t?[t.x,t.y,t.mount||null]:null)(S.vttTokens.get('{i}'))")
    db=lambda i: G.evaluate(f"(async()=>{{const d=(await S.db.doc('vtttokens/{i}').get()).data(); return [d.x,d.y,d.mount||null]}})()")
    def drag(pg, tid, cx, cy):
        el=pg.locator(f'.vtok[data-tid={tid}]'); bb=el.bounding_box(); z=pg.evaluate("VTT.zoom"); st=pg.locator('#vstage').bounding_box()
        pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); pg.mouse.down()
        tx=st['x']+cx*z*pg.evaluate("VCELL"); ty=st['y']+cy*z*pg.evaluate("VCELL")
        pg.mouse.move((bb['x']+tx)/2,(bb['y']+ty)/2,steps=4); pg.mouse.move(tx,ty,steps=4); pg.mouse.up(); pg.wait_for_timeout(900)
    # 1. player drags Hero onto the Medium summon: too small
    drag(P,'pc',4.5,4.5); print('1 hero on medium wisp:', pos(P,'pc'), 'buttons', P.locator('.vgo').all_inner_texts())
    # 2. GM turns the summon into a bear (Large): now it can carry him
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{form:'bear', fhp:null}})); }}, false)"); G.wait_for_timeout(1200)
    print('2 after bear:', P.locator('.vgo').all_inner_texts())
    P.click('.vgo button[data-mount=smt]'); P.wait_for_timeout(1200); print('  dismount buttons before select', P.locator('.vgo button[data-dismount]').count())
    print('  mounted: player sees hero', pos(P,'pc'), 'bear', pos(P,'smt'), '| GM sees', pos(G,'pc'), '| saved', db('pc'))
    P.screenshot(path='/tmp/mount-1.png')
    # 3. player moves the bear (it's their summon): hero comes along
    drag(P,'smt',8.3,2.3); G.wait_for_timeout(800); print('3 bear moved: P hero', pos(P,'pc'), 'bear', pos(P,'smt'), '| GM hero', pos(G,'pc'), '| saved', db('pc'))
    G.evaluate("VTT.sel={kind:'tok',id:'smt'}; vRefresh()"); G.wait_for_timeout(400); print('  GM panel:', G.locator('.vmountrow').all_inner_texts())
    G.goto(f'http://localhost:3300/#char-{cid}'); G.wait_for_timeout(1200); print('  sheet:', G.locator('.cride').all_inner_texts()); G.go_back(); G.wait_for_timeout(1500)
    # 4. the bear turns back: too small, hero is thrown off
    G.evaluate(f"charChange('{cid}', x => {{ x.summons = x.summons.map(s => Object.assign({{}}, s, {{form:'', fhp:null}})); }}, false)"); G.wait_for_timeout(1500)
    print('4 shifted back: hero', pos(G,'pc'), 'saved', db('pc'), 'toast', G.locator('.toast').all_inner_texts()[-1:] if G.locator('.toast').count() else None)
    # 5. player jumps on the GM's wild horse; GM drags the horse; player dismounts with the button
    P.wait_for_timeout(500); drag(P,'pc',10.7,4.7); print('5 on horse square, buttons', P.locator('.vgo').all_inner_texts())
    P.click('.vgo button[data-mount=horse]'); P.wait_for_timeout(1200); print('  mounted horse', pos(P,'pc'), db('pc'))
    G.evaluate("VTT.layer='token'"); drag(G,'horse',13,6); G.wait_for_timeout(1200); print('  GM moved horse: P hero', pos(P,'pc'), 'horse', pos(P,'horse'), 'saved', db('pc'))
    drag(P,'pc',16.5,2.5); print('  player dragged hero off the horse', pos(P,'pc'), db('pc'))
    # 6. GM puts two goblins on the wyrm
    G.evaluate("vRideOn('g1','wyrm'); vRideOn('g2','wyrm')"); G.wait_for_timeout(1200); print('6 two goblins on wyrm', pos(G,'g1'), pos(G,'g2'), 'wyrm', pos(G,'wyrm'), 'P sees', pos(P,'g1'))
    G.screenshot(path='/tmp/mount-2.png')
    # 7. the wyrm is knocked prone: both thrown
    G.evaluate("vPatch('vtttokens/wyrm',{conds:[{c:'prone',n:1}]})"); G.wait_for_timeout(1500); print('7 wyrm prone:', pos(G,'g1'), pos(G,'g2'))
    # 8. GM mounts goblin on horse, then drags it off
    G.evaluate("vRideOn('g1','horse')"); G.wait_for_timeout(1000); print('8 goblin on horse', pos(G,'g1')); drag(G,'g1',3,6); print('  GM grabbed goblin: horse moved', pos(G,'horse'), 'goblin', pos(G,'g1'), 'dismount buttons', G.locator('.vgo button[data-dismount]').count()); G.click('.vgo button[data-dismount][data-tok=g1]'); G.wait_for_timeout(1000); print('  dismount button', pos(G,'g1'), db('g1'))
    # 9. player cannot mount a GM-only token (server refuses)
    G.evaluate("vPatch('vtttokens/g2',{layer:'gm'})"); G.wait_for_timeout(600)
    P.evaluate("vPatch('vtttokens/pc',{mount:'g2'})"); P.wait_for_timeout(1000); print('9 player onto hidden token, saved', db('pc'))
    print('ERRORS', errs); b.close()
