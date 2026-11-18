from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':1000}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#characters'); G.wait_for_timeout(1500)
    cid=G.evaluate("[...S.chars.keys()][0]")
    G.evaluate("S.db.doc('entries/potx').set({type:'item',title:'Healing draught',body:'',tags:[],item:{category:'Potion'},updated:new Date().toISOString()})")
    G.wait_for_timeout(500)
    # an old inventory with stacks
    G.evaluate(f"""charChange('{cid}', x => {{ x.inv = {{cols:6, rows:2, slots:{{ '0':{{ref:'s:dagger',qty:3,name:'Dagger'}}, '1':{{ref:'e:potx',qty:2,name:'Healing draught'}}, '2':{{ref:'s:arrow',qty:20,name:'Arrow'}}, '3':{{ref:'s:chain-mail',qty:2,name:'Chain mail'}} }} }}; }}, false)""")
    G.wait_for_timeout(300)
    sl=lambda: G.evaluate(f"Object.entries(S.chars.get('{cid}').inv.slots).map(([k,s])=>k+':'+s.ref.slice(2)+'x'+s.qty).join(' ')")
    print('after unstack:', sl())
    G.goto(f'http://localhost:3300/#char-{cid}'); G.wait_for_timeout(1000)
    G.evaluate("CS.view='inv'; render()"); G.wait_for_timeout(600)
    G.click('.islot[data-slot="2"]'); G.wait_for_timeout(300)
    print('arrow buttons', G.locator('.invdetail .btn').all_inner_texts())
    G.click('[data-act=invtake1]'); G.wait_for_timeout(500); print('take one:', sl(), 'sel', G.evaluate('INV.sel'))
    G.click('.islot[data-slot="2"]'); G.wait_for_timeout(300); G.click('[data-act=invsplit]'); G.wait_for_timeout(300)
    G.fill('#vaskv','5'); G.keyboard.press('Enter'); G.wait_for_timeout(500); print('split 5:', sl())
    G.click('.islot[data-slot="0"]'); G.wait_for_timeout(300); print('dagger buttons', G.locator('.invdetail .btn').all_inner_texts())
    G.click('[data-act=invdup]'); G.wait_for_timeout(400); print('another dagger:', sl())
    # adding items from the list
    G.evaluate(f"invAction('invadd', {{dataset:{{v:'s:dagger'}}}})"); G.wait_for_timeout(300)
    G.evaluate(f"invAction('invadd', {{dataset:{{v:'s:arrow'}}}})"); G.wait_for_timeout(300)
    print('after adding dagger + arrows:', sl())
    G.screenshot(path='/tmp/inv.png')
    print('ERRORS', errs); b.close()
