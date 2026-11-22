from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Night'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); camp=G.evaluate("vCampId()")
    chars=G.evaluate("[...S.chars.keys()]"); pc=chars[0]
    # an NPC: a hidden character sheet with a picture and HP
    G.evaluate("""(async()=>{ await S.db.doc('characters/npc1').set({name:'Captain Vex', hidden:true, image:'images/art1.png', hp:{cur:22,max:30,temp:0}, classes:[], updated:new Date().toISOString()}); })()""")
    G.wait_for_timeout(500)
    # 1) a summon wearing chain mail (AC 16) with natural AC 12
    G.evaluate(f"""charChange('{pc}', x => {{ x.summons = [{{id:'sm1', ref:'', kind:'Wolf', name:'Fang', sb:{{subtitle:'Medium beast', ac:'12 (natural armour)', hp:'11', con:'12', dex:'14'}}, active:true, hp:11, inv:{{slots:{{'r0c0':{{ref:'s:chain-mail',qty:1,name:'Chain mail'}}}}}}}}]; }}, false)"""); G.wait_for_timeout(500)
    G.evaluate(f"vSave('vtttokens/fang',{{page:'{pid}',layer:'token',x:2,y:2,size:1,img:'',name:'Fang',ref:'s:{pc}:sm1',owner:'{pc}',bars:'all'}})")
    G.evaluate(f"vSave('vtttokens/hero',{{page:'{pid}',layer:'token',x:4,y:2,size:1,img:'',name:'Hero',ref:'c:{pc}',owner:'{pc}'}})")
    G.evaluate(f"vSave('vtttokens/vex',{{page:'{pid}',layer:'token',x:9,y:2,size:1,img:'',name:'Captain Vex',ref:'c:npc1',owner:'npc1'}})")
    G.wait_for_timeout(800)
    print('1) summon AC on token', G.evaluate("vTokAC(S.vttTokens.get('fang'))"))
    # turn order: hero, fang, vex
    G.evaluate(f"""vInitSave('{camp}', {{list:[{{id:'i1',tok:'hero',name:'Hero',val:18}},{{id:'i2',tok:'fang',name:'Fang',val:12}},{{id:'i3',tok:'vex',name:'Captain Vex',val:9}}],cur:'',round:0}})"""); G.wait_for_timeout(500)
    G.evaluate("VTT.initOpen=true; vInitDraw(true)"); G.wait_for_timeout(300)
    G.click('[data-act=vttinitnext]'); G.wait_for_timeout(400)
    G.fill('.vtround input','3'); G.locator('.vtround input').dispatch_event('change'); G.wait_for_timeout(500)
    for i in range(3): G.click('[data-act=vttinitnext]'); G.wait_for_timeout(350)
    print('4) round after setting 3 and going past the top', G.evaluate(f"vInitOf('{camp}').round"), 'turn', G.evaluate(f"vInitOf('{camp}').cur"))
    G.locator('#vturns').screenshot(path='/tmp/g-turns.png')
    G.click('#vturns [data-act=vttinitsel][data-tok=vex] >> nth=0'); G.wait_for_timeout(400); print('3) GM picks Vex from turn order:', G.evaluate("VTT.sel"))
    # player
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1800)
    print('2) player: Vex token shown', P.locator('.vtok[data-tid=vex]').count(), 'img', P.evaluate("(document.querySelector('.vtok[data-tid=vex] img')||{}).src||''")[-20:], 'bars', P.evaluate("[...document.querySelectorAll('.vtok[data-tid=vex] .vbar')].map(e=>e.title)"))
    print('   player sees Vex sheet?', P.evaluate("S.chars.has('npc1')"), ' Vex counts as theirs?', P.evaluate("vPlayerTok(S.vttTokens.get('vex'))"))
    G.evaluate("charChange('npc1', x => { x.hp = Object.assign({}, x.hp, {cur: 10}); }, false)"); P.wait_for_timeout(1200)
    print('   after GM hurts Vex, player sees', P.evaluate("[...document.querySelectorAll('.vtok[data-tid=vex] .vbar')].map(e=>e.title)"))
    print('   turn order picks for player', P.locator('#vturns [data-act=vttinitsel]').evaluate_all("els=>els.map(e=>e.dataset.tok)"))
    P.click('#vturns [data-act=vttinitsel][data-tok=fang] >> nth=0'); P.wait_for_timeout(500); print('3) player picks Fang:', P.evaluate("VTT.sel"))
    print('   player round display', P.locator('#vturns .vthead strong').inner_text())
    # can the player move Vex? (server should refuse)
    r=P.evaluate("fetch('/api/ops',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ops:[{path:'vtttokens/vex',doc:Object.assign({},S.vttTokens.get('vex'),{x:1,y:1})}]})}).then(r=>r.json())")
    print('   player move Vex rejected', r)
    P.screenshot(path='/tmp/g-player.png')
    print('ERRORS', errs); b.close()
