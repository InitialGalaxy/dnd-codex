from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Keep'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page")
    names=lambda: G.locator('.vlvname').all_inner_texts()
    G.click('[data-act=vttaddlvl][data-v=above]'); G.fill('#vaskv','Tower'); G.keyboard.press('Enter'); G.wait_for_timeout(700)
    G.click('[data-act=vttaddlvl][data-v=below]'); G.fill('#vaskv','Cellar'); G.keyboard.press('Enter'); G.wait_for_timeout(700)
    print('levels', [n.replace('\n',' ') for n in names()], 'editing', G.evaluate('VTT.lvl'))
    # put something on each level: a picture on the cellar, a wall on the cellar, stairs between ground and cellar
    G.evaluate(f"""(async()=>{{const p=S.vttPages.get('{pid}');
      await vPatch('vttpages/{pid}',{{objs:(p.objs||[]).concat([{{id:'cel',x:2,y:2,w:6,h:5,layer:'map',level:-1,src:'images/art1.png'}},{{id:'tow',x:2,y:2,w:6,h:5,layer:'map',level:1,src:'images/art1.png'}}]),
        walls:(p.walls||[]).concat([[2,2,8,2,-1],[2,2,2,7,0]]), links:[{{id:'st',kind:'stairs',x:3,y:3,w:1,h:1,levels:[0,-1]}}]}}); }})()""")
    G.wait_for_timeout(700)
    cid=G.evaluate("[...S.chars.keys()][0]")
    G.evaluate(f"vSave('vtttokens/hero',{{page:'{pid}',layer:'token',x:3,y:3,size:1,img:'',name:'Hero',ref:'',owner:'{cid}'}})")
    G.evaluate(f"vSave('vtttokens/rat',{{page:'{pid}',layer:'token',x:5,y:4,size:1,img:'',name:'Rat',ref:'',owner:'',lvl:-1}})")
    G.wait_for_timeout(700)
    vis=lambda pg: sorted(pg.evaluate("[...document.querySelectorAll('.vtok')].filter(e=>getComputedStyle(e).display!=='none'&&!e.classList.contains('vhide')).map(e=>S.vttTokens.get(e.dataset.tid).name)"))
    lv=lambda pg: pg.evaluate("[...document.querySelectorAll('.vrlv')].map(e=>e.dataset.lvl+':'+(getComputedStyle(e).display))")
    G.click('.vlvrow:has([data-v="0"]) .vlvname'); G.wait_for_timeout(400)
    print('GM editing ground: cellar picture hidden', G.locator('.vobj[data-oid=cel].lvlhid').count(), 'rat shown', vis(G))
    G.click('.vlvrow:has([data-v="-1"]) .vlvname'); G.wait_for_timeout(400)
    print('GM filtered to cellar sees', vis(G), 'cellar pic visible', G.locator('.vobj[data-oid=cel]:not(.lvlhid)').count())
    G.screenshot(path='/tmp/base1.png')
    G.click('[data-act=vttlvlall]'); G.wait_for_timeout(300)
    # player
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1500)
    print('player on ground sees', vis(P), 'level pictures', lv(P), 'stairs button', P.locator('.vgo button').all_inner_texts())
    P.click('.vgo button'); P.wait_for_timeout(1000)
    print('player went down: hero lvl', P.evaluate("S.vttTokens.get('hero').lvl"), 'sees', vis(P), 'level pictures', lv(P))
    P.screenshot(path='/tmp/base2.png')
    # move the cellar up: swap -1 and 0
    G.click('.vlvrow:has([data-v="-1"]) .vlvname'); G.wait_for_timeout(300)
    G.click('[data-act=vttlvlmove][data-v="-1"][data-d="1"]'); G.wait_for_timeout(900)
    pg=G.evaluate(f"S.vttPages.get('{pid}')")
    print('after moving Cellar up: names', [n.replace('\n',' ') for n in names()], 'cellar pic level', [o['level'] for o in pg['objs'] if o['id']=='cel'], 'walls', [w[4] for w in pg['walls']], 'stairs', pg['links'][0]['levels'], 'rat', G.evaluate("S.vttTokens.get('rat').lvl"), 'hero', G.evaluate("S.vttTokens.get('hero').lvl"))
    G.locator('.vlvgroup').screenshot(path='/tmp/base3.png')
    print('ERRORS', errs); b.close()
