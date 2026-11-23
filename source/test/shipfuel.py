from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    now="new Date().toISOString()"
    G.evaluate(f"S.db.doc('entries/ship').set({{type:'item',title:'Steamer',body:'',tags:[],item:{{category:'Sea vehicle',magical:false,vehicle:{{cx:'complex',hull:100,turn:20,speeds:[{{mode:'naval',move:30,travel:5}}],fuel:{{type:'refuel',use:'efficient',amt:1,cap:50}}}}}},updated:{now}}})"); G.wait_for_timeout(500)
    G.evaluate("vOpenWorkshop('ship')"); G.wait_for_timeout(2500)
    G.click('[data-act=vttnewcamp]') if G.evaluate("location.hash")=='#vtt' else None
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(800); G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Fuel'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    G.evaluate("vPatch('vttpages/'+VTT.page,{w:40,h:30})"); G.wait_for_timeout(500)
    G.click('[data-act=vtttokpick]'); G.wait_for_timeout(500); G.locator('.vtpick[data-name="Steamer"]').click(); G.wait_for_timeout(1000)
    sid=G.evaluate("[...S.vttTokens].find(([,t])=>t.int)[0]"); print('fuel at start', G.evaluate(f"S.vttTokens.get('{sid}').fuel"))
    G.evaluate(f"vPatch('vtttokens/{sid}',{{x:20,y:15,mv:{{len:7.3,at:Date.now()}}}})"); G.wait_for_timeout(1200)
    print('after a 7.3-square move', G.evaluate(f"S.vttTokens.get('{sid}').fuel"))
    G.evaluate("vDraw()"); G.wait_for_timeout(600); print('redraw charges nothing', G.evaluate(f"S.vttTokens.get('{sid}').fuel"))
    G.evaluate(f"vPatch('vtttokens/{sid}',{{hp:0}})"); G.wait_for_timeout(800); print('wrecked class', G.locator(f'.vship[data-ship={sid}].wreck').count())
    print('ERRORS', errs); b.close()
