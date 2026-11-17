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
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(9000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.evaluate("openEditor(null,{type:'item'})"); pg.wait_for_timeout(500)
    pg.fill('#ed-title','Test Gauntlet'); pg.select_option('#it-cat','Martial weapon'); pg.check('#it-res-on')
    pg.fill('.itresrow >> nth=0 >> .ir-name','Surges'); pg.select_option('.itresrow >> nth=0 >> .ir-amtmode','pb')
    print('max hidden', pg.evaluate("document.querySelector('.itresrow .ir-max').hidden"))
    pg.click('[data-act=itresadd]')
    pg.fill('.itresrow >> nth=1 >> .ir-name','Kills'); pg.select_option('.itresrow >> nth=1 >> .ir-style','counter'); pg.select_option('.itresrow >> nth=1 >> .ir-reset','long')
    print('amt hidden', pg.evaluate("document.querySelectorAll('.itresrow .ir-amtwrap')[1].hidden"))
    pg.locator('#it-res-wrap').screenshot(path='ires2-editor.png')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(900)
    eid=pg.evaluate("[...S.entries].find(([k,v])=>v.title==='Test Gauntlet')[0]")
    print('saved', pg.evaluate(f"S.entries.get('{eid}').item.res"))
    pg.goto(f'http://localhost:8765/index.html#entry-{eid}'); pg.wait_for_timeout(500); pg.locator('.ires').screenshot(path='ires2-page.png')
    cid='cvakryn'
    pg.evaluate(f"charChange('{cid}', x=>{{x.inv=x.inv||{{cols:6,rows:5,slots:{{}}}}; x.inv.slots=Object.assign({{}},x.inv.slots,{{w4:{{ref:'e:{eid}',qty:1,name:'Test Gauntlet'}}}}); x.resources=(x.resources||[]).concat([{{name:'Channel',amt:'pb',max:1,used:0,reset:'short'}},{{name:'Souls',style:'counter',count:0,reset:'none',color:'#b04ad0'}}])}})")
    pg.goto(f'http://localhost:8765/index.html#char-{cid}'); pg.wait_for_timeout(500); pg.evaluate("CS.tab='play';render()"); pg.wait_for_timeout(300)
    for i in range(5): pg.click('[data-act=cresadj][data-v="1"] >> nth=-1'); pg.wait_for_timeout(150)
    pg.click('[data-act=ciresadj][data-v="1"]'); pg.click('[data-act=ciresadj][data-v="1"]'); pg.wait_for_timeout(200)
    pg.click('[data-act=cres][data-j="0"] >> nth=-1'); pg.wait_for_timeout(200)
    c=pg.evaluate(f"S.chars.get('{cid}')"); print('pb', pg.evaluate(f"cPB(S.chars.get('{cid}'))"), 'res', c['resources'][-2:], 'itemRes', c.get('itemRes'))
    pg.locator('.csec.cres').screenshot(path='ires2-sheet.png')
    pg.evaluate(f"charChange('{cid}', x=>{{charResRest(x,true); itemResRest(x,true);}})"); pg.wait_for_timeout(200)
    c=pg.evaluate(f"S.chars.get('{cid}')"); print('after long', c['resources'][-2:], c.get('itemRes'))
    pg.click('[data-act=cedit] >> nth=0'); pg.wait_for_timeout(400); pg.locator('.csec.cres').screenshot(path='ires2-edit.png')
    pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(400)
    print(pg.locator('.pcres').first.inner_text())
    b.close()
print('ERRORS',errs)
