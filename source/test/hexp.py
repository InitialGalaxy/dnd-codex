from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','HexP'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); G.evaluate(f"vPatch('vttpages/{pid}',{{gridType:'hexflat',hexMi:6,open:true}}); vPatch('vttcamps/'+vCampId(),{{playerPage:'{pid}'}})"); G.wait_for_timeout(800)
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1800)
    print('page', P.evaluate("vPageNow() && vPageNow().id")==pid, 'travel btn', P.locator('[data-act=vtttool][data-v=travel]').count())
    P.click('[data-act=vtttool][data-v=travel]'); P.wait_for_timeout(300); print('tool', P.evaluate("VTT.tool"))
    st=P.locator('#vstage').bounding_box(); z=P.evaluate("VTT.zoom"); C=P.evaluate("VCELL")
    for x,y in [(1,1),(6,1)]: P.mouse.click(st['x']+x*C*z, st['y']+y*C*z); P.wait_for_timeout(300)
    P.keyboard.press('Enter'); P.wait_for_timeout(300); print('meas', P.evaluate("VTT.meas && vMeasShape(VTT.meas).label"))
    P.click('[data-act=vtttpace][data-v=slow]'); P.wait_for_timeout(300); print('slow', P.evaluate("VTT.meas && vMeasShape(VTT.meas).label"))
    P.screenshot(path='/tmp/hex-player.png'); print('ERRORS', errs); b.close()
