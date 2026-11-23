from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append('G '+str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Hexes'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); cid=G.evaluate("[...S.chars].find(([,c])=>!c.hidden)[0]"); now="new Date().toISOString()"
    G.evaluate(f"""(async()=>{{
      await S.db.doc('entries/cart').set({{type:'item',title:'Cart',body:'',tags:[],item:{{category:'Land vehicle',magical:false,vehicle:{{size:1,hull:20,seats:2,speeds:[{{mode:'ground',move:30,travel:4}}],fuel:{{type:'manual'}}}}}},updated:{now}}});
      await S.db.doc('entries/crawl').set({{type:'item',title:'Steam Crawler',body:'',tags:[],item:{{category:'Land vehicle',magical:false,vehicle:{{size:1,hull:40,seats:2,speeds:[{{mode:'ground',move:40,travel:6}}],fuel:{{type:'refuel',use:'efficient',amt:2,cap:10}}}}}},updated:{now}}});
    }})()"""); G.wait_for_timeout(700)
    pg=lambda: G.evaluate("(c=>JSON.parse(JSON.stringify(c.p)))(vPageNow())")
    G.evaluate("VTT.sel=null; vRefresh()"); G.wait_for_timeout(300)
    G.select_option('#vside [data-ps=gridType]', 'hexpointy'); G.wait_for_timeout(900)
    q=pg(); print('H1 grid', q.get('gridType'), 'open', q.get('open'), 'hexMi', q.get('hexMi'), 'toast', G.locator('.toast').all_inner_texts()[-1:])
    G.fill('#vside [data-ps=hexMi]','4'); G.locator('#vside [data-ps=hexMi]').dispatch_event('change'); G.wait_for_timeout(700); print('  hexMi', pg().get('hexMi'))
    G.evaluate(f"vSave('vtttokens/pc',{{page:'{pid}',layer:'token',x:1,y:1,size:1,img:'',name:'Hero',ref:'c:{cid}',owner:'{cid}'}})")
    G.evaluate(f"vSave('vtttokens/cr',{{page:'{pid}',layer:'token',x:3,y:3,size:1,img:'',name:'Crawler',ref:'e:crawl',owner:'',hp:40,hpMax:40,fuel:10}})"); G.wait_for_timeout(800)
    def scr(x,y):
        st=G.locator('#vstage').bounding_box(); z=G.evaluate("VTT.zoom"); C=G.evaluate("VCELL"); return st['x']+x*C*z, st['y']+y*C*z
    def dragp(a,b2, pgx=None):
        G.mouse.move(*scr(*a)); G.mouse.down(); G.mouse.move(*scr(*b2), steps=8); G.mouse.up(); G.wait_for_timeout(800)
    dragp((1.5,1.5),(5.2,4.1)); t=G.evaluate("(t=>[t.x,t.y])(S.vttTokens.get('pc'))"); print('H2 dropped at', t, 'centre on a hex', G.evaluate(f"(c=>{{const h=vHexNear(c,{t[0]}+.5,{t[1]}+.5), k=vHexCenter(c,h); return [h, k]}})(vPageNow().p)"))
    G.click('[data-act=vtttool][data-v=measure]'); G.wait_for_timeout(200)
    G.mouse.move(*scr(1.5,1.5)); G.mouse.down(); G.mouse.move(*scr(7.5,1.5), steps=6); G.wait_for_timeout(200)
    print('H3 ruler', G.evaluate("vMeasShape(VTT.meas).label")); G.screenshot(path='/tmp/hex-ruler.png'); G.mouse.up(); G.keyboard.press('Escape')
    G.click('[data-act=vtttool][data-v=travel]'); G.wait_for_timeout(300)
    for x,y in [(1,1),(8,1),(8,8)]: G.mouse.click(*scr(x,y)); G.wait_for_timeout(250)
    G.keyboard.press('Enter'); G.wait_for_timeout(400)
    print('H4 on foot', G.evaluate("vMeasShape(VTT.meas).label"))
    opts=G.locator('.vtravelby option').all_inner_texts(); print('  travelling by options', opts)
    G.select_option('.vtravelby', index=1); G.wait_for_timeout(400); print('  by', G.input_value('.vtravelby'), '->', G.evaluate("vMeasShape(VTT.meas).label"))
    G.select_option('.vtravelby', label=[o for o in opts if o.startswith('Cart')][0]); G.wait_for_timeout(300); print('  by cart ->', G.evaluate("vMeasShape(VTT.meas).label"))
    G.click('[data-act=vtttpace][data-v=fast]'); G.wait_for_timeout(300); print('  fast on foot ->', G.evaluate("vMeasShape(VTT.meas).label"), '| select', G.input_value('.vtravelby'))
    G.screenshot(path='/tmp/hex-travel.png')
    # flat-topped
    G.evaluate("VTT.sel=null; vRefresh()"); G.wait_for_timeout(300); G.select_option('#vside [data-ps=gridType]', 'hexflat'); G.wait_for_timeout(700); G.click('[data-act=vtttclear]') if G.locator('[data-act=vtttclear]').count() else None
    G.screenshot(path='/tmp/hex-flat.png')
    # a player plans travel
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    G.evaluate(f"vPatch('vttcamps/'+vCampId(),{{playerPage:'{pid}'}})"); G.wait_for_timeout(500); P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1800)
    G.evaluate(f"vPatch('vttcamps/'+vCampId(),{{playerPage:'{pid}'}})"); P.wait_for_timeout(1500)
    print('H5 player travel button', P.locator('[data-act=vtttool][data-v=travel]').count())
    P.click('[data-act=vtttool][data-v=travel]'); P.wait_for_timeout(300); print('  P state', P.evaluate("[vPageNow()&&vPageNow().id, VTT.tool, VTT.zoom]"), pid, P.locator('#vstage').bounding_box())
    st=P.locator('#vstage').bounding_box(); z=P.evaluate("VTT.zoom"); C=P.evaluate("VCELL")
    for x,y in [(1,5),(6,5)]: P.mouse.click(st['x']+x*C*z, st['y']+y*C*z); P.wait_for_timeout(250)
    P.screenshot(path='/tmp/hexdbg.png'); print('  pre-enter meas', P.evaluate("JSON.stringify(VTT.meas)"), P.evaluate("document.elementFromPoint(%f,%f).outerHTML.slice(0,120)" % (st['x']+1*C*z, st['y']+1*C*z)))
    P.keyboard.press('Enter'); P.wait_for_timeout(300); print('  player route', P.evaluate("vMeasShape(VTT.meas).label"))
    P.click('[data-act=vtttpace][data-v=slow]'); P.wait_for_timeout(300); print('  player slow pace', P.evaluate("vMeasShape(VTT.meas).label"))
    P.select_option('.vtravelby', index=1); P.wait_for_timeout(300); print('  player by', P.input_value('.vtravelby'), P.evaluate("vMeasShape(VTT.meas).label"))
    P.screenshot(path='/tmp/hex-player.png')
    # square map with a scale, by vehicle
    G.evaluate("vPatch('vttpages/'+VTT.page,{gridType:'', scale:{len:5, amt:1, unit:'day', mi:24}})"); G.wait_for_timeout(700)
    G.click('[data-act=vtttool][data-v=travel]') if G.evaluate("VTT.tool")!='travel' else None; G.wait_for_timeout(200)
    for x,y in [(1,1),(11,1)]: G.mouse.click(*scr(x,y)); G.wait_for_timeout(250)
    G.keyboard.press('Enter'); G.wait_for_timeout(300); G.select_option('.vtravelby', value=''); G.wait_for_timeout(200); print('H6 squares on foot', G.evaluate("vMeasShape(VTT.meas).label"))
    G.select_option('.vtravelby', index=1); G.wait_for_timeout(300); print('  by', G.input_value('.vtravelby'), G.evaluate("vMeasShape(VTT.meas).label"))
    print('ERRORS', errs); b.close()
