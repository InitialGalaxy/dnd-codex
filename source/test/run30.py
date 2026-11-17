import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type in('warning','error') and errs.append(m.text))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(7000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    print(pg.evaluate("JSON.stringify([...S.entries].filter(([k,v])=>v.type==='class').map(([k,v])=>[k,v.title,v.cls.features.length,JSON.stringify(v).length]))"))
    print('imports', pg.evaluate("JSON.stringify(Object.keys(S.imports))"))
    pg.goto('http://localhost:8765/index.html#entry-class-ranger'); pg.wait_for_timeout(600); pg.screenshot(path='class-ranger.png', full_page=True)
    pg.click('[data-act=edit]'); pg.wait_for_timeout(500)
    pg.locator('fieldset[data-for=class]').screenshot(path='class-editor.png')
    pg.fill('#cl-tools',"Herbalism kit"); pg.locator('#cl-rows .hbrow').first.locator('.hb-n').fill('Favoured Enemy')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(800)
    print('saved tools', pg.evaluate("S.entries.get('class-ranger').cls.tools"))
    # sheet
    pg.goto('http://localhost:8765/index.html#char-cvakryn'); pg.wait_for_timeout(600); pg.click('[data-act=cedit]'); pg.wait_for_timeout(300)
    pg.locator('.clsapply').screenshot(path='clsapply.png'); print(pg.inner_text('.clsapply'))
    pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(600)
    print(pg.inner_text('.clsapply'))
    pg.click('[data-act=clsapply]'); pg.wait_for_timeout(400)
    x=pg.evaluate("JSON.stringify((({hd,saves,profs,caster,classRef})=>({hd,saves,profs,caster,classRef}))(S.chars.get('csaahan')))"); print(x)
    print(pg.inner_text('.clsapply'))
    # artificer character
    pg.evaluate("(async()=>{const db=await claude.use('db');await db.doc('characters/ctest').set({name:'Tink',classes:'Artificer 5',level:5,abilities:{str:10,dex:14,con:14,int:17,wis:10,cha:8},saves:{},skills:{},features:[],hp:{max:30,cur:30,temp:0}})})()"); pg.wait_for_timeout(400)
    pg.goto('http://localhost:8765/index.html#char-ctest'); pg.wait_for_timeout(600)
    pg.locator('.levelup').screenshot(path='levelup-art.png'); print(pg.inner_text('.levelup'))
    b.close()
print('ERRORS',errs)
