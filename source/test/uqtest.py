from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1280,'height':900}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1200)
    G.evaluate("""S.db.doc('entries/wolf').set({type:'creature',title:'Wolf',body:'Wolves hunt in packs across the northern wilds.',tags:['beast'],token:'images/face2.png',statblock:{subtitle:'Medium beast, unaligned',ac:'13 (natural armour)',hp:'11 (2d8 + 2)',speed:'40 ft.',str:'12',dex:'15',con:'12',int:'3',wis:'12',cha:'6',cr:'1/4',features:'***Pack Tactics.*** Advantage when an ally is near.'},updated:new Date().toISOString()})"""); G.wait_for_timeout(500)
    G.click('.vcamp a >> nth=0'); G.wait_for_timeout(1500)
    G.evaluate("vPlaceToken('e:wolf','Wolf')"); G.wait_for_timeout(700)
    tid=G.evaluate("[...S.vttTokens.entries()].find(([k,t])=>t.ref==='e:wolf')[0]")
    G.evaluate(f"vPatch('vtttokens/{tid}',{{x:3,y:7,hp:4}})"); G.wait_for_timeout(300)
    G.evaluate(f"VTT.sel={{kind:'tok',id:'{tid}'}}; vRefresh()"); G.wait_for_timeout(300); G.click('[data-act=vttopts]'); G.wait_for_timeout(500)
    G.locator('#modal .vnpcbox').screenshot(path='/tmp/uq1-button.png')
    G.click('[data-act=vttunique]'); G.wait_for_timeout(500)
    G.fill('#vuq-name','Scared Wolf')
    G.fill('#vuq-lore','Fled the party at the river crossing with an arrow in its flank. It remembers their scent.')
    G.locator('#modal .mbox').screenshot(path='/tmp/uq2-popup.png')
    G.click('#vuqform button[type=submit]'); G.wait_for_timeout(1500)
    t=G.evaluate(f"S.vttTokens.get('{tid}')"); ne=G.evaluate(f"S.entries.get('{t['ref'][2:]}')")
    print('token', t['name'], t['ref'][:2], 'hp kept', t.get('hp'), '| entry', ne['title'], ne.get('hidden'), ne['body'][:60].replace('\n',' '), '| stat block hp', ne['statblock']['hp'])
    G.goto(f"http://localhost:3300/#entry-{t['ref'][2:]}"); G.wait_for_timeout(1500)
    G.screenshot(path='/tmp/uq3-entry.png', full_page=True)
    # humanoid commoner shows only the NPC sheet option
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(800); G.click('.vcamp a >> nth=0'); G.wait_for_timeout(1200)
    cm=G.evaluate("([...S.vttTokens.entries()].find(([k,t])=>t.ref==='e:commoner')||[])[0]")
    if cm:
        G.evaluate(f"VTT.sel={{kind:'tok',id:'{cm}'}}; vRefresh()"); G.wait_for_timeout(300); G.click('[data-act=vttopts]'); G.wait_for_timeout(500)
        print('commoner options:', G.locator('#modal .vnpcbox').inner_text().replace('\n',' | ')); G.locator('#modal .vnpcbox').screenshot(path='/tmp/uq4-humanoid.png')
    print('ERRORS', errs); b.close()
