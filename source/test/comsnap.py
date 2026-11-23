from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    G=b.new_page(viewport={'width':1440,'height':950}); G.on('pageerror',lambda e:errs.append(str(e)))
    G.goto('http://localhost:3300/#vtt'); G.wait_for_timeout(1000)
    now="new Date().toISOString()"
    G.evaluate(f"S.db.doc('entries/ship').set({{type:'item',title:'Raft',body:'',tags:[],item:{{category:'Sea vehicle',magical:false,vehicle:{{cx:'complex',hull:100,turn:30,speeds:[{{mode:'naval',move:30,travel:5}}],fuel:{{type:'manual'}}}}}},updated:{now}}})"); G.wait_for_timeout(400)
    G.click('[data-act=vttnewcamp]'); G.fill('#vaskv','Snap'); G.keyboard.press('Enter'); G.wait_for_timeout(1500)
    pid=G.evaluate("VTT.page"); G.evaluate(f"vPatch('vttpages/{pid}',{{w:40,h:40}})")
    for nm,(w,h,cx,cy) in {'s3':(3,3,1.5,1.5),'s4':(4,4,2,2),'s34':(3,4,1.5,2)}.items():
        G.evaluate(f"vSave('vtttokens/{nm}',{{page:'{pid}',layer:'token',x:20,y:20,rot:0,size:1,img:'',name:'{nm}',ref:'e:ship',owner:'',hp:100,hpMax:100,int:{{w:{w},h:{h},objs:[],walls:[],links:[],lights:[],helm:[],com:[{cx},{cy}],front:270,levelNames:{{}},minLevel:0,maxLevel:0}}}})")
    G.wait_for_timeout(800)
    for nm in ['s3','s4','s34']:
        for tgt,opt in [([27.3,12.8],'{}'),([24.1,25.7],'{}'),([27.3,12.8],'{angle:true}'),([31.2,21.4],'{angle:true}'),([27.3,12.8],'{direct:true}'),([27.3,12.8],'{free:true}')]:
            r=G.evaluate(f"(p=>[p.end.map(v=>Math.round(v*100)/100), Math.round(p.rot*10)/10, p.why])(vShipPath(S.vttTokens.get('{nm}'),{tgt},{opt}))")
            print(nm, opt, '->', r)
    print('ERRORS', errs); b.close()
