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
    pg.fill('#ed-title','Boom Fists')
    pg.select_option('#it-cat','Martial weapon')
    pg.check('#it-res-on'); pg.wait_for_timeout(100)
    pg.fill('.itresrow >> nth=0 >> .ir-name','Left hand'); pg.fill('.itresrow >> nth=0 >> .ir-max','3'); pg.select_option('.itresrow >> nth=0 >> .ir-reset','long-empty')
    pg.evaluate("document.querySelector('.itresrow .ir-color').value='#e0703a'")
    pg.click('[data-act=itresadd]'); pg.wait_for_timeout(100)
    pg.fill('.itresrow >> nth=1 >> .ir-name','Right hand'); pg.fill('.itresrow >> nth=1 >> .ir-max','3'); pg.select_option('.itresrow >> nth=1 >> .ir-reset','long-empty')
    pg.evaluate("document.querySelectorAll('.itresrow .ir-color')[1].value='#4aa3e0'")
    pg.click('[data-act=itresadd]'); pg.wait_for_timeout(100)
    pg.fill('.itresrow >> nth=2 >> .ir-name','Power'); pg.fill('.itresrow >> nth=2 >> .ir-max','20'); pg.select_option('.itresrow >> nth=2 >> .ir-style','slider')
    pg.locator('#it-res-wrap').screenshot(path='ires-editor.png')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(900)
    eid=pg.evaluate("[...S.entries].find(([k,v])=>v.title==='Boom Fists')[0]")
    print('saved res', pg.evaluate(f"S.entries.get('{eid}').item.res"))
    pg.goto(f'http://localhost:8765/index.html#entry-{eid}'); pg.wait_for_timeout(500)
    pg.locator('.itempage').screenshot(path='ires-page.png')
    cid='cvakryn'
    pg.evaluate(f"charChange('{cid}', x=>{{x.inv=x.inv||{{cols:6,rows:5,slots:{{}}}}; x.inv.slots=Object.assign({{}},x.inv.slots,{{w4:{{ref:'e:{eid}',qty:1,name:'Boom Fists'}}}}); x.resources=(x.resources||[]).concat([{{name:'Ki',max:8,used:3,reset:'short',style:'slider',color:'#4ad0a0'}}]); x.caster={{on:true,kind:'full',ability:'wis',used:4,high:{{}}}}}})")
    pg.goto(f'http://localhost:8765/index.html#char-{cid}'); pg.wait_for_timeout(500)
    pg.evaluate("CS.tab='play';render()"); pg.wait_for_timeout(300)
    pg.locator('.csec.cres').screenshot(path='ires-sheet.png')
    # click pip 2 of left hand → have 2
    pg.click('[data-act=cires][data-k="0"][data-j="1"]'); pg.wait_for_timeout(300)
    pg.click('[data-act=ciresadj][data-k="2"][data-v="1"]'); pg.wait_for_timeout(300)
    box=pg.locator('[data-act=ciresbar]').bounding_box(); pg.mouse.click(box['x']+box['width']*0.5, box['y']+box['height']/2); pg.wait_for_timeout(300)
    print('itemRes', pg.evaluate(f"S.chars.get('{cid}').itemRes"))
    box=pg.locator('[data-act=cresbar]').bounding_box(); pg.mouse.click(box['x']+box['width']*0.25, box['y']+box['height']/2); pg.wait_for_timeout(300)
    print('ki used', pg.evaluate(f"S.chars.get('{cid}').resources.slice(-1)[0].used"))
    pg.locator('.csec.cres').screenshot(path='ires-sheet2.png')
    pg.evaluate(f"charChange('{cid}', x=>{{ (x.resources||[]).forEach(r=>{{if(true) r.used=0}}); itemResRest(x,true); }})"); pg.wait_for_timeout(300)
    print('after long rest', pg.evaluate(f"S.chars.get('{cid}').itemRes"))
    pg.click('[data-act=cedit] >> nth=0'); pg.wait_for_timeout(400)
    pg.locator('.csec.cres').screenshot(path='ires-edit.png')
    b.close()
print('ERRORS',errs)
