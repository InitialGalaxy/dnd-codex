from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1280,'height':900}); G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1200); G.click('.vcamp a >> nth=0'); G.wait_for_timeout(1200)
    camp=G.evaluate("vCampId()")
    G.screenshot(path='/tmp/desk.png')
    for who in ('gm','player'):
        ctx=b.new_context(viewport={'width':390,'height':844}, has_touch=True)
        M=ctx.new_page(); M.on('pageerror',lambda e:errs.append(who+' '+str(e)))
        host='localhost' if who=='gm' else '192.0.2.2'
        M.goto(f'http://{host}:3300/'); M.wait_for_timeout(1000)
        if who=='player': M.click('[data-act=srvlogin][data-v=player]'); M.wait_for_timeout(2500)
        M.goto(f'http://{host}:3300/#vtt-{camp}'); M.wait_for_timeout(2000)
        M.screenshot(path=f'/tmp/mob-{who}.png')
        print(who, 'board', M.evaluate("(()=>{const b=document.querySelector('.vview').getBoundingClientRect();return [Math.round(b.y),Math.round(b.height)]})()"))
        if who=='gm':
            M.click('.vtoolsbtn'); M.wait_for_timeout(400); M.screenshot(path='/tmp/mob-gm-tools.png')
            M.click('[data-act=vtttool][data-v=measure]')
            M.wait_for_timeout(300); print(' tools closed after picking a tool', not M.evaluate("document.querySelector('.vttwrap').classList.contains('toolsopen')"), 'tool', M.evaluate("VTT.tool"))
            M.evaluate("VTT.sel={kind:'tok',id:'hero'}; vRefresh()"); M.wait_for_timeout(400); M.screenshot(path='/tmp/mob-gm-sel.png')
            print(' with a token selected, board', M.evaluate("(()=>{const b=document.querySelector('.vview').getBoundingClientRect();return [Math.round(b.y),Math.round(b.height)]})()"))
        else:
            M.evaluate("VTT.sel={kind:'tok',id:'hero'}; vRefresh()"); M.wait_for_timeout(400); M.screenshot(path='/tmp/mob-player-sel.png')
    print(errs); b.close()
