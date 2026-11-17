import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
jorg=json.load(open('/tmp/jorg.json')); jorg['profs']['weapons']='Simple weapons, Firearms'; jorg['profs']['armour']='Light armour, Medium armour, Shields'
docs['characters/cjorg']=jorg
docs['entries/emusket']={"type":"item","title":"Musket","tags":[],"body":"","item":{"category":"Ranged weapon","base":"","props":[{"id":"ammunition","param":"Firearm"},{"id":"loading","param":""}],"magical":False,"stats":{"damage":"1d12","dtype":"piercing"}}}
docs['entries/eplate']={"type":"item","title":"Dwarven Plate","tags":["armour"],"body":"","item":{"category":"Armour","base":"plate","magical":True,"extra":"+1","stats":{"ac":"19","dex":False,"dexMax":""}}}
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type in('warning','error') and errs.append(m.text))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(9000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    print('vakryn', pg.evaluate("['armour','weapons','tools'].map(k=>profList(S.chars.get('cvakryn'),k))"))
    print('jorg', pg.evaluate("['armour','weapons','tools'].map(k=>profList(S.chars.get('cjorg'),k))"))
    print('weapon opts', pg.evaluate("profOptions('weapons').slice(0,8)"), len(pg.evaluate("profOptions('weapons')")))
    print('armour opts', pg.evaluate("profOptions('armour')"))
    print('wizard', pg.evaluate("profParse('weapons', SRD_CLASS_BASICS.Wizard.weapons)"), pg.evaluate("profParse('weapons', SRD_CLASS_BASICS.Bard.weapons)"), pg.evaluate("profParse('tools', SRD_CLASS_BASICS.Bard.tools)"), pg.evaluate("profParse('weapons', SRD_CLASS_BASICS.Druid.weapons)"))
    print('has musket', pg.evaluate("profHas(S.chars.get('cjorg'),'weapons',S.entries.get('emusket'))"), 'plate', pg.evaluate("profHas(S.chars.get('cjorg'),'armour',S.entries.get('eplate'))"), 'plate weight', pg.evaluate("armourWeight(S.entries.get('eplate'))"))
    pg.goto('http://localhost:8765/index.html#char-cjorg'); pg.wait_for_timeout(600)
    pg.evaluate("CS.tab='features';render()"); pg.wait_for_timeout(300)
    pg.locator('.proflist').screenshot(path='prof-view.png')
    pg.click('[data-act=cedit] >> nth=0'); pg.wait_for_timeout(400)
    pg.locator('.proflist').screenshot(path='prof-edit1.png')
    # remove the Firearms chip, add Ranged weapons
    pg.evaluate("""(()=>{const w=document.querySelector('.tpk[data-tpk="cprof-weapons"]');[...w.querySelectorAll('.tpkchip')].find(c=>c.dataset.v==='Firearms').querySelector('.tpkx').click();})()""")
    pg.fill('.tpk[data-tpk="cprof-weapons"] .tpkin','ranged'); pg.wait_for_timeout(200)
    print('menu', pg.locator('.tpk[data-tpk="cprof-weapons"] .tpkopt').all_inner_texts())
    pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    print('saved', pg.evaluate("S.chars.get('cjorg').profs.weapons"))
    pg.fill('.tpk[data-tpk="cprof-weapons"] .tpkin','Fire'); pg.wait_for_timeout(200)
    print('free?', pg.locator('.tpk[data-tpk="cprof-weapons"] .tpkopt').all_inner_texts())
    print('has musket', pg.evaluate("profHas(S.chars.get('cjorg'),'weapons',S.entries.get('emusket'))"))
    pg.click('[data-act=cedit] >> nth=0'); pg.wait_for_timeout(400)
    pg.evaluate("CS.tab='features';render()"); pg.wait_for_timeout(300)
    pg.locator('.proflist').screenshot(path='prof-view2.png')
    # quick create a wizard
    pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(400)
    pg.click('[data-act=newchar] >> nth=0'); pg.wait_for_timeout(300)
    pg.fill('#qc-name','Wiz'); pg.select_option('#qc-race', label='Human'); pg.select_option('#qc-class','Wizard'); pg.click('[data-act=qcgo]'); pg.wait_for_timeout(800)
    print('wiz profs', pg.evaluate("S.chars.get(location.hash.slice(6)).profs"))
    # class basics on vakryn (legacy strings)
    print('vakryn plan', pg.evaluate("classBasicsPlan(S.chars.get('cvakryn'),'Barbarian').out"))
    # attack table + armour warning: equip plate on wiz
    wid=pg.evaluate("location.hash.slice(6)")
    pg.evaluate(f"charChange('{wid}', c=>{{c.inv=c.inv||{{cols:6,rows:5,slots:{{}}}}; c.inv.slots=Object.assign({{}},c.inv.slots,{{ar:{{ref:'e:eplate',qty:1,name:'Dwarven Plate'}},w0:{{ref:'e:emusket',qty:1,name:'Musket'}}}})}})")
    pg.wait_for_timeout(400); pg.evaluate("CS.tab='play';render()"); pg.wait_for_timeout(300)
    print(pg.locator('.eqac').inner_text()); print(pg.locator('tr.auto').first.inner_text())
    b.close()
print('ERRORS',errs)
