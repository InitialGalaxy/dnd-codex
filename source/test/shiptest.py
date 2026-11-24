from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append('G '+str(e)+' '+str(e.stack)[:300]))
    G.goto('http://localhost:3300/#items'); G.wait_for_timeout(1200)
    # 1. a complex ship in the editor
    G.click('header [data-act=new]'); G.wait_for_timeout(300)
    G.fill('#ed-title','Merchant Ship'); G.select_option('#ed-type','item'); G.select_option('#it-cat','Sea vehicle'); G.wait_for_timeout(200)
    G.click('[data-vehact=cx][data-v=complex]'); G.wait_for_timeout(100)
    print('1 complex: size hidden', not G.locator('#veh-size').is_visible(), '| turning shown', G.locator('#veh-turn').is_visible(), '| omni/rev boxes', G.locator('[data-vs=omni]').count(), G.locator('[data-vs=rev]').count())
    G.fill('#veh-hull','300'); G.fill('#veh-turn','40')
    G.locator('#veh-speeds [data-vs=mode]').first.select_option('naval'); G.locator('#veh-speeds [data-vs=move]').first.fill('30'); G.locator('#veh-speeds [data-vs=travel]').first.fill('5')
    G.click('form[data-form=entry] button[type=submit]'); G.wait_for_timeout(900)
    sid=G.evaluate("[...S.entries].find(([,e])=>e.title==='Merchant Ship')[0]"); print('  saved', G.evaluate(f"JSON.stringify(S.entries.get('{sid}').item.vehicle)"))
    G.goto(f'http://localhost:3300/#entry-{sid}'); G.wait_for_timeout(800); print('  page button', G.locator('[data-act=vttvehmap]').inner_text())
    G.click('[data-act=vttvehmap]'); G.wait_for_timeout(2000)
    print('2 workshop', G.evaluate("location.hash"), G.evaluate("(c=>c&&[c.p.vehicle,c.p.camp,c.p.w,c.p.h])(vPageNow())"), '| tools', G.locator('[data-act=vtttool][data-v=helm]').count(), G.locator('[data-act=vtttool][data-v=com]').count())
    wpid=G.evaluate("vPageNow().id")
    G.evaluate(f"""vPatch('vttpages/{wpid}',{{w:26,h:7,front:180,minLevel:-2,maxLevel:1,levelNames:{{'-2':'Hold','-1':'Lower deck','0':'Main deck','1':'Upper decks'}},
      objs:[{{id:'h',layer:'map',img:'images/boat-hold.png',x:0,y:0,w:26,h:7,level:-2}},{{id:'l',layer:'map',img:'images/boat-lower.png',x:0,y:0,w:26,h:7,level:-1}},{{id:'m',layer:'map',img:'images/boat-main.png',x:0,y:0,w:26,h:7,level:0}},{{id:'f',layer:'map',img:'images/boat-fore.png',x:0,y:-0.0,w:8.4,h:7,level:1}},{{id:'q',layer:'map',img:'images/boat-quarter.png',x:17.3,y:0,w:8.7,h:7,level:1}}],
      walls:[[0,0.3,26,0.3,-1],[0,6.7,26,6.7,-1],[1,0,1,7,-2],[12,0.3,12,6.7,0,{{k:'door',id:'d1'}}]],
      links:[{{id:'k1',kind:'stairs',x:10,y:3,w:1,h:1,levels:[-1,0]}},{{id:'k2',kind:'stairs',x:9,y:1,w:1,h:1,levels:[0,1]}}]}})"""); G.wait_for_timeout(800)
    G.click('[data-act=vtttool][data-v=helm]'); G.wait_for_timeout(200)
    def scr(pg,x,y):
        st=pg.locator('#vstage').bounding_box(); z=pg.evaluate("VTT.zoom"); C=pg.evaluate("VCELL"); return st['x']+x*C*z, st['y']+y*C*z
    G.evaluate("VTT.lvl=0; vDraw(); vFit()"); G.wait_for_timeout(300); G.mouse.click(*scr(G,21.5,3.5)); G.wait_for_timeout(500)
    G.click('[data-act=vtttool][data-v=com]'); G.wait_for_timeout(200); G.mouse.click(*scr(G,13,3.5)); G.wait_for_timeout(600)
    print('  helm', G.evaluate("JSON.stringify(vPageNow().p.helm)"), 'com', G.evaluate("JSON.stringify(vPageNow().p.com)"))
    G.screenshot(path='/tmp/ship-workshop.png')
    # 3. a battle map, and the ship on it
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000); print('3 workshop hidden from the campaign list', G.locator('.vcamp h2').all_inner_texts())
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Sea'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); cid=G.evaluate("[...S.chars].find(([,c])=>!c.hidden)[0]")
    G.evaluate(f"vPatch('vttpages/{pid}',{{w:50,h:30}}); vPatch('vttcamps/'+vCampId(),{{playerPage:'{pid}'}})"); G.wait_for_timeout(600); G.evaluate("vFit()")
    G.click('[data-act=vtttokpick]'); G.wait_for_timeout(500); G.locator('.vtpick[data-name="Merchant Ship"]').click(); G.wait_for_timeout(1000)
    shid=G.evaluate("[...S.vttTokens].find(([,t])=>t.int)[0]"); G.evaluate(f"vPatch('vtttokens/{shid}',{{x:25,y:15}})"); G.wait_for_timeout(600)
    print('  ship token', G.evaluate(f"(t=>[t.x,t.y,t.rot,t.int.w,t.int.h,t.int.helm.length])(S.vttTokens.get('{shid}'))"), '| decks drawn', G.locator(f'.vship[data-ship={shid}] .vsdeck').count())
    G.evaluate(f"vSave('vtttokens/pc',{{page:'{pid}',layer:'token',x:5,y:5,size:1,img:'',name:'Hero',ref:'c:{cid}',owner:'{cid}'}})"); G.wait_for_timeout(600)
    G.screenshot(path='/tmp/ship-map.png')
    # 4. a player boards and takes the helm
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)+' '+str(e.stack)[:300]))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1800); P.evaluate("vFit()"); P.wait_for_timeout(300)
    def drag(pg, sel, to):
        bb=pg.locator(sel).bounding_box(); pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); pg.mouse.down(); pg.mouse.move(*to, steps=10); pg.mouse.up(); pg.wait_for_timeout(1200)
    tk=lambda pg,i: pg.evaluate(f"(t=>t?[Math.round(t.x*100)/100,Math.round(t.y*100)/100,t.lvl||0,t.ship||null,t.sx,t.sy,t.deck]:null)(S.vttTokens.get('{i}'))")
    m2=lambda pg,lx,ly: pg.evaluate(f"vShipToMap(S.vttTokens.get('{shid}'),{lx},{ly})")
    drag(P,'.vtok[data-tid=pc]', scr(P,*m2(P,6.5,3.5))); print('4 boarded', tk(P,'pc'), '| GM', tk(G,'pc'), '| player sees decks', P.evaluate(f"[...document.querySelectorAll('.vship[data-ship={shid}] .vsdeck')].map(e=>e.dataset.deck)"))
    drag(P,'.vtok[data-tid=pc]', scr(P,*m2(P,21.5,3.5))); print('  at the helm', tk(G,'pc'), '| helm', P.evaluate(f"(h=>h&&h[0])(vShipHelm('{shid}'))"), '| ring', P.locator('.vhelmarrow').count())
    P.screenshot(path='/tmp/ship-helm.png')
    # 5. steer: ahead and a little to the side
    t0=G.evaluate(f"(t=>[t.x,t.y,t.rot])(S.vttTokens.get('{shid}'))")
    bb=P.locator('.vhelmarrow').bounding_box(); P.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); P.mouse.down()
    P.mouse.move(*scr(P,19,20), steps=12); P.wait_for_timeout(300)
    print('5 steering label', P.locator('.vsteerlbl').inner_html(), '| over-speed line', P.locator('.vsp.over').count())
    P.screenshot(path='/tmp/ship-steer.png'); P.mouse.up(); P.wait_for_timeout(300)
    print('  popup', P.locator('.vsteerpop button').all_inner_texts())
    P.click('.vsteerpop button[data-steer=move]'); P.wait_for_timeout(2500)
    print('  moved', t0, '->', G.evaluate(f"(t=>[Math.round(t.x*100)/100,Math.round(t.y*100)/100,Math.round(t.rot)])(S.vttTokens.get('{shid}'))"), '| hero still aboard', tk(G,'pc'))
    # 6. behind it: too tight; with Ctrl straight there
    bb=P.locator('.vhelmarrow').bounding_box(); P.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); P.mouse.down()
    hx,hy=P.evaluate(f"(t=>[t.x,t.y])(S.vttTokens.get('{shid}'))"); hd=P.evaluate(f"vShipHeading(S.vttTokens.get('{shid}'))*Math.PI/180")
    import math
    P.mouse.move(*scr(P, hx-math.cos(hd)*4, hy-math.sin(hd)*4), steps=8); P.wait_for_timeout(200); print('6 behind:', P.locator('.vsteerlbl').inner_html())
    P.keyboard.down('Control'); P.mouse.move(*scr(P, hx-math.cos(hd)*4+0.1, hy-math.sin(hd)*4), steps=2); P.wait_for_timeout(200); print('  with Ctrl:', P.locator('.vsteerlbl').inner_html()); P.keyboard.up('Control')
    P.mouse.up(); P.wait_for_timeout(200); P.click('.vsteerpop button[data-steer=abandon]'); P.wait_for_timeout(300); print('  abandoned: no popup', P.locator('.vsteerpop').count())
    # 7. a wall across its way
    ax,ay=hx+math.cos(hd)*6, hy+math.sin(hd)*6; px,py=-math.sin(hd)*10, math.cos(hd)*10
    G.evaluate(f"vPatch('vttpages/{pid}',{{walls:[[{ax-px},{ay-py},{ax+px},{ay+py},0]]}})"); G.wait_for_timeout(800)
    bb=P.locator('.vhelmarrow').bounding_box(); P.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); P.mouse.down()
    P.mouse.move(*scr(P, hx+math.cos(hd)*10, hy+math.sin(hd)*10), steps=8); P.wait_for_timeout(200); print('7 wall ahead:', P.locator('.vsteerlbl').inner_html(), 'X marks', P.locator('.hitx').count())
    P.mouse.up(); P.wait_for_timeout(200); P.click('.vsteerpop button[data-steer=abandon]')
    # 8. stairs down
    drag(P,'.vtok[data-tid=pc]', scr(P,*m2(P,10.5,3.5))); P.wait_for_timeout(300); print('8 stairs buttons', P.locator('.vgo button').all_inner_texts())
    bb=P.locator('.vgo button[data-deck="-1"]').bounding_box(); print('  btn', bb, 'hit', P.evaluate(f"document.elementFromPoint({bb['x']+bb['width']/2},{bb['y']+bb['height']/2}).outerHTML.slice(0,100)"))
    P.click('.vgo button[data-deck="-1"]'); P.wait_for_timeout(1200); print('  below', tk(G,'pc'), '| player stage below-deck', P.evaluate("document.getElementById('vstage').classList.contains('vbelow')"), '| decks shown', P.evaluate(f"[...document.querySelectorAll('.vship[data-ship={shid}] .vsdeck')].map(e=>e.dataset.deck)"))
    P.screenshot(path='/tmp/ship-below.png')
    # 9. levels dialog: put the lower deck at G
    P.click('.vgo button[data-deck="0"]'); P.wait_for_timeout(1200); drag(P,'.vtok[data-tid=pc]', scr(P,*m2(P,9.5,1.5))); P.wait_for_timeout(500); print('8b stairs up', P.locator('.vgo button').all_inner_texts())
    P.click('.vgo button[data-deck="1"]'); P.wait_for_timeout(1200); print('  up top', tk(G,'pc'), '| player sees decks', P.evaluate(f"[...document.querySelectorAll('.vship[data-ship={shid}] .vsdeck')].map(e=>e.dataset.deck)"))
    P.click('.vgo button[data-deck="0"]'); P.wait_for_timeout(1200); drag(P,'.vtok[data-tid=pc]', scr(P,*m2(P,10.5,3.5))); P.click('.vgo button[data-deck="-1"]'); P.wait_for_timeout(1200)
    G.click('[data-act=vttlvldlg]'); G.wait_for_timeout(400); print('9 dialog decks', G.locator('.vlvdeck span').all_inner_texts())
    G.select_option(f'[data-lvship={shid}][data-deck="-1"]', '0'); G.wait_for_timeout(800); G.screenshot(path='/tmp/ship-levels.png'); G.click('[data-lvd=close]'); G.wait_for_timeout(800)
    print('  hero now at map level', tk(G,'pc')[2])
    # 10. the GM turns it with the handle and drags it
    G.evaluate(f"VTT.sel={{kind:'tok',id:'{shid}'}}; vDraw(); vRefresh()"); G.wait_for_timeout(300)
    bb=G.locator('.vshiprot').bounding_box(); sx,sy=G.evaluate(f"(t=>[t.x,t.y])(S.vttTokens.get('{shid}'))")
    G.mouse.move(bb['x']+15, bb['y']+15); G.mouse.down(); G.mouse.move(*scr(G, sx, sy-8), steps=8); G.mouse.up(); G.wait_for_timeout(800)
    print('10 GM turned it to', G.evaluate(f"Math.round(S.vttTokens.get('{shid}').rot)"), 'heading', G.evaluate(f"Math.round(vShipHeading(S.vttTokens.get('{shid}')))"))
    # 11. workshop edit flows to the placed ship
    G.evaluate(f"vPatch('vttpages/{wpid}',{{walls:(S.vttPages.get('{wpid}').walls||[]).concat([[2,2,2,5,0]])}})"); G.wait_for_timeout(1500)
    print('11 placed ship walls', G.evaluate(f"S.vttTokens.get('{shid}').int.walls.length"), 'workshop', G.evaluate(f"S.vttPages.get('{wpid}').walls.length"))
    # 12. a door on the ship, opened by the player
    P.wait_for_timeout(500); print('12 door before', G.evaluate(f"!!S.vttTokens.get('{shid}').int.walls[3][5].open"))
    P.evaluate(f"vShipDoor('{shid}',3)"); P.wait_for_timeout(1200); print('  player opened it', G.evaluate(f"!!S.vttTokens.get('{shid}').int.walls[3][5].open"))
    # 13. off the ship
    P.click('.vgo button[data-deck="0"]') if P.locator('.vgo button[data-deck="0"]').count() else None; P.wait_for_timeout(800)
    drag(P,'.vtok[data-tid=pc]', scr(P,3,3)); print('13 stepped off', tk(G,'pc'))
    G.screenshot(path='/tmp/ship-final.png'); print('ERRORS', errs); b.close()
