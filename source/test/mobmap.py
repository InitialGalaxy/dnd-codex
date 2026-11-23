from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1280,'height':900}); G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Phone build'); G.keyboard.press('Enter'); G.wait_for_timeout(1200); camp=G.evaluate("vCampId()")
    M=b.new_context(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True).new_page(); M.on('pageerror',lambda e:errs.append(str(e)+' '+str(e.stack)[:600]))
    M.goto(f'http://localhost:3300/#vtt-{camp}'); M.wait_for_timeout(2000)
    pg=lambda: M.evaluate("(c=>JSON.parse(JSON.stringify(c.p)))(vPageNow())")
    def scr(x,y):
        st=M.locator('#vstage').bounding_box(); z=M.evaluate("VTT.zoom"); C=M.evaluate("VCELL"); return st['x']+x*C*z, st['y']+y*C*z
    def tap(x,y): M.touchscreen.tap(*scr(x,y)); M.wait_for_timeout(120)
    M.click('.vtoolsbtn'); M.wait_for_timeout(300); M.click('[data-act=vtttool][data-v=wall]'); M.wait_for_timeout(300)
    print('sheet closed', M.evaluate("!document.querySelector('.vttwrap').classList.contains('toolsopen')"), 'tool', M.evaluate("VTT.tool"))
    tap(2,2); M.wait_for_timeout(500); tap(6,2); M.wait_for_timeout(500); tap(6,6); tap(6,6); M.wait_for_timeout(800)
    print('walls by tapping', pg().get('walls'))
    M.click('.vtoolsbtn'); M.wait_for_timeout(300); M.screenshot(path='/tmp/mobmap-tools.png'); M.click('[data-act=vttundo]'); M.wait_for_timeout(800); print('after undo', pg().get('walls'))
    print('ERRORS', errs); b.close()
