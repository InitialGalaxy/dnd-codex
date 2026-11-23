from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append('G '+str(e)))
    G.goto('http://localhost:3300/#items'); G.wait_for_timeout(1200)
    # 1. a cart made in the editor
    G.click('header [data-act=new]'); G.wait_for_timeout(300)
    G.fill('#ed-title','Farm Cart'); G.select_option('#ed-type','item'); G.select_option('#it-cat','Land vehicle'); G.wait_for_timeout(200)
    print('1 vehicle fields', G.locator('#it-vehicle').is_visible(), '| token pics field', G.locator('#ed-toks').is_visible(), '| properties hidden', not G.locator('#it-props').is_visible())
    G.fill('#veh-size','2'); G.fill('#veh-hull','30'); G.fill('#veh-seats','3')
    G.locator('#veh-speeds [data-vs=move]').first.fill('30'); G.locator('#veh-speeds [data-vs=travel]').first.fill('4')
    G.click('[data-vehact=fuel][data-v=refuel]'); G.wait_for_timeout(100); print('  refuel shows tank', G.locator('#veh-capw').is_visible(), 'res hidden', not G.locator('#veh-resw').is_visible())
    G.click('[data-vehact=fuel][data-v=manual]'); G.wait_for_timeout(100); print('  manual hides uses', not G.locator('#veh-uses').is_visible())
    G.click('[data-vehact=addspeed]'); G.wait_for_timeout(100); print('  speed rows', G.locator('.vehspd').count())
    G.locator('.vehspd').nth(1).locator('[data-vs=mode]').select_option('naval'); G.locator('.vehspd').nth(1).locator('[data-vs=move]').fill('10'); G.locator('.vehspd').nth(1).locator('[data-vs=travel]').fill('1')
    G.screenshot(path='/tmp/veh-editor.png', full_page=False)
    G.click('form[data-form=entry] button[type=submit]'); G.wait_for_timeout(900)
    cart=G.evaluate("[...S.entries].find(([,e])=>e.title==='Farm Cart')[0]"); print('  saved', G.evaluate(f"JSON.stringify(S.entries.get('{cart}').item.vehicle)"))
    G.screenshot(path='/tmp/veh-page.png')
    now="new Date().toISOString()"
    G.evaluate(f"""(async()=>{{
      await S.db.doc('entries/crawl').set({{type:'item',title:'Steam Crawler',body:'',tags:[],item:{{category:'Land vehicle',magical:false,vehicle:{{size:2,hull:40,seats:2,speeds:[{{mode:'ground',move:40,travel:6}}],fuel:{{type:'refuel',use:'efficient',amt:1,cap:5}}}}}},updated:{now}}});
      await S.db.doc('entries/boil').set({{type:'item',title:'Boiler Barge',body:'',tags:[],item:{{category:'Sea vehicle',magical:false,vehicle:{{size:3,hull:60,seats:4,speeds:[{{mode:'naval',move:30,travel:5}}],fuel:{{type:'refuel',use:'inefficient',amt:2,cap:10}}}}}},updated:{now}}});
      await S.db.doc('entries/skiff').set({{type:'item',title:'Arcane Skiff',body:'',tags:[],hidden:true,item:{{category:'Air vehicle',magical:true,vehicle:{{size:2,hull:20,seats:2,speeds:[{{mode:'flight',move:60,travel:8}}],fuel:{{type:'power',use:'efficient',amt:2,res:'Spell points'}}}}}},updated:{now}}});
    }})()"""); G.wait_for_timeout(800)
    G.goto('http://localhost:3300/#items'); G.wait_for_timeout(800); G.click('[data-act=imagic][data-v=vehicle]'); G.wait_for_timeout(500)
    print('2 vehicles tab', G.locator('.libhead p.muted').first.inner_text(), '|', G.locator('h2.sect').all_inner_texts()); G.screenshot(path='/tmp/veh-tab.png')
    # 3. tabletop
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Roads'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); cid=G.evaluate("[...S.chars].find(([,c])=>!c.hidden)[0]")
    G.evaluate(f"vPatch('vttcamps/'+vCampId(),{{playerPage:'{pid}'}})")
    G.click('[data-act=vtttokpick]'); G.wait_for_timeout(500); print('3 picker vehicles', G.locator('.vtpicks h3').all_inner_texts())
    G.locator('.vtpick[data-name="Farm Cart"]').click(); G.wait_for_timeout(800)
    tid=G.evaluate("[...S.vttTokens].find(([,t])=>t.name==='Farm Cart')[0]"); print('  placed', G.evaluate(f"JSON.stringify((t=>({{size:t.size,hp:t.hp,hpMax:t.hpMax}}))(S.vttTokens.get('{tid}')))"))
    G.evaluate(f"vPatch('vtttokens/{tid}',{{x:3,y:3}})")
    G.evaluate(f"vSave('vtttokens/pc',{{page:'{pid}',layer:'token',x:3,y:3,size:1,img:'',name:'Hero',ref:'c:{cid}',owner:'{cid}'}})")
    for tk,ref,x,y,fuel in [('cr','crawl',8,3,5),('bg','boil',3,8,10),('sk','skiff',9,9,None)]:
        G.evaluate(f"vSave('vtttokens/{tk}',{{page:'{pid}',layer:'token',x:{x},y:{y},size:{3 if tk=='bg' else 2},img:'',name:'{ref}',ref:'e:{ref}',owner:'',hp:30,hpMax:30{',fuel:'+str(fuel) if fuel else ''}}})")
    G.wait_for_timeout(900)
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1800)
    pos=lambda pg,i: pg.evaluate(f"(t=>t?[t.x,t.y,t.mount||null,t.pilot||null,t.fuel]:null)(S.vttTokens.get('{i}'))")
    def drag(pg, tid2, cx, cy):
        el=pg.locator(f'.vtok[data-tid={tid2}]'); bb=el.bounding_box(); z=pg.evaluate("VTT.zoom"); st=pg.locator('#vstage').bounding_box(); C=pg.evaluate("VCELL")
        pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); pg.mouse.down(); tx=st['x']+cx*z*C; ty=st['y']+cy*z*C
        pg.mouse.move(tx,ty,steps=8); pg.mouse.up(); pg.wait_for_timeout(1000)
    P.evaluate("VTT.lastDrop='pc'; vDraw()"); print('4 player buttons on the cart', P.locator('.vgo').all_inner_texts())
    P.click(f'.vgo button[data-mount={tid}]'); P.wait_for_timeout(1300); print('  boarded', pos(P,'pc'), 'cart pilot', pos(G,tid)[3])
    drag(P,'pc',12.5,6.5); G.wait_for_timeout(800); print('  pilot drove the cart', pos(G,tid)[:2], 'hero', pos(G,'pc')[:3])
    P.evaluate("VTT.sel={kind:'tok',id:'pc'}; vRefresh()"); P.wait_for_timeout(300); P.click('[data-act=vttdismount][data-id=pc]'); P.wait_for_timeout(1000); print('  got out', pos(G,'pc')[:3])
    # 5. crawler: 1 fuel a square, tank 5
    P.evaluate("vPatch('vtttokens/pc',{x:8,y:3})"); P.wait_for_timeout(700); P.evaluate("vRideOn('pc','cr')"); P.wait_for_timeout(1000)
    drag(P,'pc',12.5,4.5); G.wait_for_timeout(1200); print('5 crawler moved', pos(G,'cr')[:2], 'fuel', pos(G,'cr')[4])
    drag(P,'pc',14.5,4.5); G.wait_for_timeout(1200); print('  again', pos(G,'cr')[:2], 'fuel', pos(G,'cr')[4], 'GM toast', G.locator('.toast').all_inner_texts()[-1:])
    drag(P,'pc',10.5,10.5); G.wait_for_timeout(800); print('  empty, tried again', pos(G,'cr')[:2], 'player toast', P.locator('.toast').all_inner_texts()[-1:])
    P.evaluate("VTT.sel={kind:'tok',id:'cr'}; vRefresh()"); P.wait_for_timeout(300); print('  panel', P.locator('.vvehinfo').inner_text().replace('\n',' | '))
    G.evaluate("VTT.sel={kind:'tok',id:'cr'}; vRefresh()"); G.wait_for_timeout(300); G.screenshot(path='/tmp/veh-crawler.png')
    # 6. barge: 2 fuel on the pilot's turn
    G.evaluate("vDismount('pc')"); G.wait_for_timeout(800); G.evaluate("vRideOn('pc','bg')"); G.wait_for_timeout(1000)
    G.evaluate("vPatch('vttcamps/'+vCampId(),{init:{list:[{id:'i1',tok:'pc',name:'Hero',val:10},{id:'i2',gm:true,name:'GM',val:5}],cur:'i2',round:1}})"); G.wait_for_timeout(1000)
    print('6 barge fuel before the pilot turn', pos(G,'bg')[4])
    G.evaluate("vPatch('vttcamps/'+vCampId(),{init:{list:[{id:'i1',tok:'pc',name:'Hero',val:10},{id:'i2',gm:true,name:'GM',val:5}],cur:'i1',round:2}})"); G.wait_for_timeout(1500)
    print('  on the pilot turn', pos(G,'bg')[4]); G.evaluate("vDraw()"); G.wait_for_timeout(800); print('  redraws charge nothing more', pos(G,'bg')[4])
    G.evaluate("vPatch('vttcamps/'+vCampId(),{init:{list:[{id:'i1',tok:'pc',name:'Hero',val:10},{id:'i2',gm:true,name:'GM',val:5}],cur:'i1',round:3}})"); G.wait_for_timeout(1500); print('  next round', pos(G,'bg')[4])
    G.evaluate("vPatch('vttcamps/'+vCampId(),{init:{list:[],cur:'',round:0}})")
    # 7. powered skiff (hidden from players) uses the pilot's spell points
    G.evaluate(f"charChange('{cid}', x => {{ x.caster = {{on:true, kind:'full', ability:'int', used:0}}; }}, false)"); G.wait_for_timeout(800)
    sp=lambda: G.evaluate(f"casterOf(S.chars.get('{cid}')).left")
    G.evaluate("vDismount('pc')"); G.wait_for_timeout(800); P.evaluate("vPatch('vtttokens/pc',{x:9,y:9})"); P.wait_for_timeout(800); P.evaluate("VTT.lastDrop='pc'; vDraw()"); P.wait_for_timeout(300)
    print('7 player sees the hidden skiff: buttons', P.locator('.vgo').all_inner_texts(), 'bars', P.evaluate("vBars(S.vttTokens.get('sk')).map(b=>b.label)"))
    P.click('.vgo button[data-mount=sk]'); P.wait_for_timeout(1200); before=sp()
    drag(P,'pc',13.5,9.5); G.wait_for_timeout(1500); print('  skiff moved', pos(G,'sk')[:2], 'spell points', before, '->', sp())
    # 8. hull to 0: thrown clear
    G.evaluate("vPatch('vtttokens/sk',{hp:0})"); G.wait_for_timeout(1500); print('8 wrecked: hero', pos(G,'pc')[:3], G.locator('.toast').all_inner_texts()[-1:])
    P.evaluate("VTT.sel={kind:'tok',id:'pc'}; vRefresh()"); P.screenshot(path='/tmp/veh-player.png')
    print('ERRORS', errs); b.close()
