from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Look'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    def scr(x,y):
        st=G.locator('#vstage').bounding_box(); z=G.evaluate("VTT.zoom"); C=G.evaluate("VCELL"); return st['x']+x*C*z, st['y']+y*C*z
    def click(x,y): G.mouse.click(*scr(x,y)); G.wait_for_timeout(250)
    def dragp(a,b2, hold=False):
        G.mouse.move(*scr(*a)); G.mouse.down(); G.mouse.move(*scr(*b2), steps=8)
        if not hold: G.mouse.up(); G.wait_for_timeout(600)
    def tool(t): G.click(f'[data-act=vtttool][data-v={t}]'); G.wait_for_timeout(250)
    tool('wall'); [click(*q) for q in [(2,2),(9,2),(9,8),(2,8)]]; click(2,2); click(2,2); G.wait_for_timeout(500)
    tool('area'); dragp((5.5,2.5),(8.5,7.5)); tool('link'); dragp((3.5,6.5),(4.5,7.5))
    G.evaluate("VTT.lvl=0; vDraw()"); G.click('[data-act=vttlayer][data-v=lights]'); tool('select'); click(4,4)
    G.click('[data-act=vttlayer][data-v=token]'); G.wait_for_timeout(200)
    tool('measure'); dragp((3,4),(7,5), hold=True); G.wait_for_timeout(300); G.screenshot(path='/tmp/mapC-measure.png'); G.mouse.up(); G.wait_for_timeout(300)
    G.keyboard.press('Escape'); tool('scale'); dragp((1,12),(6,12)); G.fill('#vsc-a','1'); G.click('.vscaleform button[type=submit]'); G.wait_for_timeout(600)
    tool('travel'); click(1,13); click(8,13); G.mouse.move(*scr(12,10)); G.wait_for_timeout(400); G.screenshot(path='/tmp/mapC-travel.png')
    G.keyboard.press('Enter'); G.wait_for_timeout(400); G.screenshot(path='/tmp/mapC-travel2.png')
    print('ERRORS', errs); b.close()
