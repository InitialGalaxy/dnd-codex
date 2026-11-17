import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
docs['settings/imports']={'imageLinks':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#entry-cchangelisk'); pg.wait_for_timeout(1200)
    print(pg.evaluate("['2d6+3','1d8 + 3','3d10 + 4','8d10','4d6 + 4 + 1d6','2d8 − 1'].map(x=>x+' => '+JSON.stringify(diceAvg(x)))"))
    print('dice spans', pg.evaluate("document.querySelectorAll('.statblock .dice').length"), pg.evaluate("document.querySelector('.statblock .dice').outerHTML"))
    pg.hover('.statblock.feats .dice'); pg.wait_for_timeout(200); pg.locator('.statblock.feats').screenshot(path='dicetip.png')
    # round trip: existing descs stay custom & unchanged
    pg.click('[data-act=edit]'); pg.wait_for_timeout(300)
    print('modes', pg.evaluate("draftSections.map(s=>s.name+':'+s.items.map(i=>i.mode||'custom').join(','))"))
    # switch the Bite action to attack mode
    bite=pg.evaluate("(()=>{for(const [si,s] of draftSections.entries())for(const [ii,i] of s.items.entries())if(/^Bite/.test(i.name))return [si,ii];})()")
    pg.click(f'[data-act=sbmode][data-si="{bite[0]}"][data-ii="{bite[1]}"][data-v=attack]'); pg.wait_for_timeout(200)
    print('bite mode', pg.evaluate(f"draftSections[{bite[0]}].items[{bite[1]}].mode"))
    print('parsed bite', pg.evaluate(f"JSON.stringify(draftSections[{bite[0]}].items[{bite[1]}].atk)"))
    # add a new action
    pg.click(f'.sbsec[data-si="{bite[0]}"] [data-act=sbadd]'); pg.wait_for_timeout(150)
    pg.keyboard.type('Claw Rake')
    it=f'.sbsec[data-si="{bite[0]}"] .sbitem:last-of-type'
    pg.fill(it+' .atk-hit','+6'); pg.fill(it+' .atk-dice','2d6 + 3'); pg.fill(it+' .atk-dtype','slashing'); pg.fill(it+' .atk-extra','plus 3 (1d6) poison damage.')
    pg.wait_for_timeout(150)
    print('preview', pg.inner_text(it+' .atkprevtext'), '|', pg.inner_text(it+' .avgnote'))
    pg.select_option(it+' .atk-kind','Ranged Weapon Attack'); pg.wait_for_timeout(100); print('reach now', pg.input_value(it+' .atk-reach'))
    pg.select_option(it+' .atk-kind','Melee Weapon Attack'); pg.wait_for_timeout(100)
    pg.locator(it).screenshot(path='atkbuilder.png')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
    f=pg.evaluate("window.__store.get('entries/cchangelisk').statblock.features")
    print([l for l in f.split('\n\n') if 'Claw Rake' in l or l.startswith('***Bite')])
    pg.click('[data-act=edit]'); pg.wait_for_timeout(300)
    print('reopened modes', pg.evaluate("draftSections.map(s=>s.name+':'+s.items.map(i=>(i.name||'-')+'='+(i.mode||'custom')).join(','))"))
    b.close()
print('ERRORS',errs)
