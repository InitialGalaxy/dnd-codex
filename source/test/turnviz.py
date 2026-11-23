from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#items'); G.wait_for_timeout(1200)
    G.click('header [data-act=new]'); G.wait_for_timeout(300)
    G.fill('#ed-title','Ship'); G.select_option('#ed-type','item'); G.select_option('#it-cat','Sea vehicle'); G.wait_for_timeout(200)
    print('hidden for simple', not G.locator('#veh-turnviz').is_visible())
    G.click('[data-vehact=cx][data-v=complex]'); G.wait_for_timeout(200); print('shown for complex', G.locator('#veh-turnviz').is_visible(), G.locator('#veh-turnviz p').inner_text())
    G.locator('#veh-turnviz').scroll_into_view_if_needed(); G.locator('#veh-turnviz').screenshot(path='/tmp/turn30.png')
    G.fill('#veh-turn','60'); G.wait_for_timeout(200); print('60:', G.locator('#veh-turnviz p').inner_text()); G.locator('#veh-turnviz').screenshot(path='/tmp/turn60.png')
    G.fill('#veh-turn','0'); G.wait_for_timeout(200); print('0:', G.locator('#veh-turnviz p').inner_text()); G.locator('#veh-turnviz').screenshot(path='/tmp/turn0.png')
    G.fill('#veh-turn','25'); G.wait_for_timeout(200); G.locator('#veh-turnviz').screenshot(path='/tmp/turn25.png')
    print('ERRORS', errs); b.close()
