import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
docs['entries/eboom']={"type":"item","title":"Boom Fists","tags":[],"body":"","item":{"category":"Martial weapon","base":"gauntlets","stats":{"damage":"1d8","dtype":"bludgeoning"},"res":[{"name":"Left hand","max":3,"style":"box","color":"#e0703a","reset":"long-empty"},{"name":"Surge","amt":"pb","style":"box","color":"#4aa3e0","reset":"short"}]}}
docs['entries/epot']={"type":"item","title":"Estus flask","tags":[],"body":"heal","item":{"category":"Potion","use":{"type":"reusable","uses":3,"recharge":"short"}}}
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':1000}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#bestiary'); pg.wait_for_timeout(9000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    # add resources to the griffon's first trait in the editor
    pg.evaluate("openEditor('cgriffon')"); pg.wait_for_timeout(600)
    pg.click('#sbsections .sbitem >> nth=0 >> [data-act=sbresadd]')
    pg.fill('#sbsections .sbitem >> nth=0 >> .fresl .ir-name','Legendary Resistance'); pg.fill('#sbsections .sbitem >> nth=0 >> .fresl .ir-max','3')
    pg.click('#sbsections .sbitem >> nth=0 >> [data-act=sbresadd]')
    pg.fill('#sbsections .sbitem >> nth=0 >> .fresl .itresrow >> nth=1 >> .ir-name','Fury'); pg.select_option('#sbsections .sbitem >> nth=0 >> .fresl .itresrow >> nth=1 >> .ir-style','counter')
    pg.locator('#sbsections .sbitem >> nth=0').screenshot(path='fres-editor.png')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(900)
    feats=pg.evaluate("S.entries.get('cgriffon').statblock.features"); print('marker' , '{{res:' in feats, feats[:300].replace('\n',' | '))
    # reopen editor: rows come back, save unchanged
    pg.evaluate("openEditor('cgriffon')"); pg.wait_for_timeout(600)
    print('rows back', pg.locator('#sbsections .fresl .itresrow').count())
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(900)
    print('stable', pg.evaluate("S.entries.get('cgriffon').statblock.features")==feats)
    pg.goto('http://localhost:8765/index.html#entry-cgriffon'); pg.wait_for_timeout(600)
    pg.click('.fres.live [data-fres=pip][data-j="0"]'); pg.wait_for_timeout(300)
    pg.click('.fres.live [data-fres=adj][data-v="1"]'); pg.wait_for_timeout(300); pg.click('.fres.live [data-fres=adj][data-v="1"]'); pg.wait_for_timeout(300)
    pg.locator('.fres.live').first.screenshot(path='fres-view.png')
    print('mem', pg.evaluate("[...FRES]"))
    # encounter
    pg.goto('http://localhost:8765/index.html#encounters'); pg.wait_for_timeout(500)
    pg.click('[data-act=encnew] >> nth=0'); pg.wait_for_timeout(500)
    pg.fill('#encq','Griffon'); pg.click('[data-act=encadd]'); pg.wait_for_timeout(600)
    pg.click('[data-act=cbpick] >> nth=0') if pg.locator('[data-act=cbpick]').count() else None
    pg.wait_for_timeout(400)
    if pg.locator('.fres.live [data-fres=pip]').count():
        pg.evaluate("""[...document.querySelectorAll('.fres.live [data-fres=pip][data-j="1"]')].find(b=>b.offsetParent).click()"""); pg.wait_for_timeout(500)
        print('enc fres', pg.evaluate("[...S.encs.values()].map(e=>e.list.map(c=>c.fres))"))
    else: print('no live fres in encounter')
    # summon with Boom Fists + potion
    cid='cvakryn'
    pg.evaluate(f"""charChange('{cid}', x=>{{ x.summons=[{{id:'s1',ref:'cgriffon',kind:'Griffon',name:'Pip',sb:JSON.parse(JSON.stringify(S.entries.get('cgriffon').statblock)),active:true,inv:{{slots:{{r0c0:{{ref:'e:eboom',qty:1,name:'Boom Fists'}}, r1c0:{{ref:'e:epot',qty:2,name:'Estus flask'}}}}}}}}]; }})""")
    pg.goto(f'http://localhost:8765/index.html#char-{cid}'); pg.wait_for_timeout(500); pg.evaluate("CS.view='sum';render()"); pg.wait_for_timeout(400)
    pg.click('[data-act=smirespip][data-k="0"][data-j="1"]'); pg.wait_for_timeout(300)
    pg.click('.potion summary'); pg.click('[data-act=smuse]'); pg.wait_for_timeout(300)
    pg.locator('article.summon').screenshot(path='fres-summon.png')
    s=pg.evaluate(f"S.chars.get('{cid}').summons[0]"); print('summon itemRes', s.get('itemRes'), 'pot', s['inv']['slots'].get('r1c0'))
    pg.evaluate("CS.view='sheet';render()"); pg.wait_for_timeout(200)
    pg.evaluate(f"charChange('{cid}', x=>{{ x.summons = x.summons.map(sm=>smRest(JSON.parse(JSON.stringify(sm)), true)); }})"); pg.wait_for_timeout(300)
    s=pg.evaluate(f"S.chars.get('{cid}').summons[0]"); print('after rest', s.get('itemRes'), s.get('fres'), s['inv']['slots'].get('r1c0'))
    b.close()
print('ERRORS',errs)
