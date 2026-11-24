from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    now="new Date().toISOString()"
    G.evaluate(f"S.db.doc('entries/ship').set({{type:'item',title:'Boat',body:'',tags:[],item:{{category:'Sea vehicle',magical:false,vehicle:{{cx:'complex',hull:100,turn:30,speeds:[{{mode:'naval',move:30,travel:5}}],fuel:{{type:'manual'}}}}}},updated:{now}}})"); G.wait_for_timeout(400)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Floors'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); chars=G.evaluate("[...S.chars].filter(([,c])=>!c.hidden).map(([id])=>id)"); print('player characters', len(chars))
    c1=chars[0]; c2=chars[1] if len(chars)>1 else chars[0]
    # a building: raised squares for level 1, a roof picture on level 1
    cells=[[x,y] for x in range(4,10) for y in range(4,10)]
    G.evaluate(f"""vPatch('vttpages/{pid}',{{w:40,h:30,maxLevel:1,areas:[{{id:'a1',level:1,cells:{cells}}}],objs:[{{id:'roof',layer:'map',img:'images/art1.png',x:4,y:4,w:6,h:6,level:1}}]}}); vPatch('vttcamps/'+vCampId(),{{playerPage:'{pid}'}})""")
    # a boat: decks -1, 0, 1
    G.evaluate(f"""vSave('vtttokens/boat',{{page:'{pid}',layer:'token',x:25,y:15,rot:0,size:1,img:'',name:'Boat',ref:'e:ship',owner:'',hp:100,hpMax:100,int:{{w:10,h:4,com:[5,2],front:0,objs:[{{id:'h',layer:'map',img:'images/boat-hold.png',x:0,y:0,w:10,h:4,level:-1}},{{id:'m',layer:'map',img:'images/boat-main.png',x:0,y:0,w:10,h:4,level:0}},{{id:'u',layer:'map',img:'images/boat-fore.png',x:0,y:0,w:4,h:4,level:1}}],walls:[],links:[],lights:[],helm:[],levelNames:{{}},minLevel:-1,maxLevel:1}}}})""")
    G.evaluate(f"vSave('vtttokens/A',{{page:'{pid}',layer:'token',x:6,y:6,size:1,img:'',name:'Ana',ref:'c:{c1}',owner:'{c1}'}})")
    G.evaluate(f"vSave('vtttokens/B',{{page:'{pid}',layer:'token',x:15,y:20,size:1,img:'',name:'Bo',ref:'c:{c2}',owner:'{c2}'}})"); G.wait_for_timeout(900)
    P=b.new_context(viewport={'width':1280,'height':850}).new_page(); P.on('pageerror',lambda e:errs.append('P '+str(e)))
    P.goto('http://192.0.2.2:3300/'); P.wait_for_timeout(800); P.click('[data-act=srvlogin][data-v=player]'); P.wait_for_timeout(2500)
    P.goto('http://192.0.2.2:3300/#vtt'); P.wait_for_timeout(800); P.click('.vcamp a >> nth=0'); P.wait_for_timeout(1800)
    roof=lambda: P.evaluate("(e=>e?[e.style.display||'shown', e.style.clipPath?'holes':'whole']:null)(document.querySelector('.vrlv[data-lvl=\"1\"]'))")
    decks=lambda: P.evaluate("[...document.querySelectorAll('.vship[data-ship=boat] .vsdeck')].map(e=>e.dataset.deck)")
    picker=lambda: P.evaluate("(b=>b&&!b.hidden?[...b.querySelectorAll('button')].map(x=>x.textContent.trim()):'none')(document.getElementById('vfloors'))")
    def st(label): P.evaluate("vDraw()"); P.wait_for_timeout(300); print(label, '| roof', roof(), '| boat decks', decks(), '| picker', picker())
    def mv(i, f): G.evaluate(f"vPatch('vtttokens/{i}',{f})"); G.wait_for_timeout(900)
    st('B1 Ana inside the building (G), Bo outside:')
    mv('A',"{lvl:1}"); st('B2 Ana upstairs (L1), Bo outside:')
    P.evaluate("VTT.pfloor=0; vDraw()"); st('   picker on Ground:'); P.evaluate("VTT.pfloor=1; vDraw()"); st('   picker on Level 1:'); P.evaluate("VTT.pfloor=null")
    mv('A',"{lvl:0,x:30,y:30}"); mv('A',"{x:2,y:2}")
    # boat
    mv('B',"{ship:'boat',sx:6,sy:1,deck:0}"); st('S1 Bo aboard on the main deck (G), Ana on the map:')
    mv('B',"{deck:1,sx:1,sy:1}"); st('S2 Bo up on deck 1, Ana on the map:')
    mv('B',"{deck:-1,sx:5,sy:1}"); st('S3 Bo below deck (B1), Ana on the map:')
    mv('A',"{ship:'boat',sx:7,sy:2,deck:0}"); st('S4 both aboard: Bo below, Ana main deck:')
    toks=lambda: P.evaluate("[...document.querySelectorAll('.vtok')].filter(e=>!e.classList.contains('vflooroff')&&!e.classList.contains('vhide')).map(e=>e.dataset.tid)")
    print('   tokens showing', toks(), '| tabs', P.locator('.vdecktabs button').all_inner_texts())
    G.evaluate(f"vSave('vtttokens/N',{{page:'{pid}',layer:'token',x:1,y:1,size:1,img:'',name:'Guard',ref:'e:ship',owner:'',ship:'boat',sx:2,sy:1,deck:1}})"); G.wait_for_timeout(900)
    P.evaluate("VTT.sel={kind:'tok',id:'boat'}; vRefresh()"); P.wait_for_timeout(300); print('P1 panel deck choices (an NPC on deck 1 adds none)', P.locator('.vdeckbtns button').all_inner_texts())
    P.click('.vdecktabs button[data-v="-1"]'); P.wait_for_timeout(400); P.screenshot(path='/tmp/deckpick-player.png'); print('P2 tab: Bo deck -> decks', decks(), '| tokens showing', toks())
    P.click('.vdeckbtns button[data-v="0"]'); P.wait_for_timeout(400); print('P3 panel: Ana deck -> decks', decks(), '| tokens showing', toks())
    P.click('.vdeckbtns button[data-v=""]'); P.wait_for_timeout(400); print('P4 Auto -> decks', decks(), '| tokens showing', toks())
    P.click('[data-act=vttdecktabs]'); P.wait_for_timeout(400); print('P5 tabs hidden', P.locator('.vdecktabs').count())
    mv('B',"{ship:null,sx:null,sy:null,deck:null,x:6,y:6,lvl:1}"); print('P6 Bo upstairs in the building, Ana aboard: map picker', picker(), '| boat decks', decks())
    G.evaluate("VTT.sel={kind:'tok',id:'boat'}; vRefresh(); vDraw()"); G.wait_for_timeout(300); print('G1 GM panel choices', G.locator('.vdeckbtns button').all_inner_texts(), '| GM tabs', G.locator('.vdecktabs button').all_inner_texts())
    G.click('.vdeckbtns button[data-v="1"]'); G.wait_for_timeout(400); print('G2 GM picks deck 1: decks', G.evaluate("[...document.querySelectorAll('.vship[data-ship=boat] .vsdeck')].map(e=>e.dataset.deck)"), 'tokens hidden', G.evaluate("[...document.querySelectorAll('.vtok.vflooroff')].map(e=>e.dataset.tid)"))
    G.screenshot(path='/tmp/deckpick-gm.png')
    P.screenshot(path='/tmp/floors2.png'); print('ERRORS', errs); b.close()
