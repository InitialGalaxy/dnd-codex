import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':1000}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(11000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    def save(): pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(900)
    feats=pg.evaluate("[...S.entries].filter(([k,v])=>v.type==='feat').map(([k])=>k)"); print('feats', len(feats))
    for fid in feats:
        before=pg.evaluate(f"S.entries.get('{fid}').body")
        pg.evaluate(f"openEditor('{fid}')"); pg.wait_for_timeout(400)
        n=pg.locator('#ftsections .sbitem').count()
        save(); after=pg.evaluate(f"S.entries.get('{fid}').body")
        print(fid, n, 'same' if before==after else ('CHANGED', before[:200], '=>', after[:200]))
    fid=feats[0]
    pg.evaluate(f"openEditor('{fid}')"); pg.wait_for_timeout(400)
    pg.fill('#ft-lore','Taught in the pit-fighting rings of Grael.')
    pg.click('#ftsections [data-act=sbadd]'); pg.wait_for_timeout(200)
    pg.fill('#ftsections .sbitem >> nth=-1 >> .itname','Ability Score Increase')
    pg.evaluate("(()=>{const t=[...document.querySelectorAll('#ftsections .sbitem')].pop().querySelector('textarea.itdesc');t.value='Increase your Strength or Dexterity by 1.';t.dispatchEvent(new Event('input',{bubbles:true}))})()")
    pg.locator('fieldset[data-for=feat]').screenshot(path='feat-edit.png')
    save()
    print('lore', pg.evaluate(f"S.entries.get('{fid}').feat"), '\nbody', pg.evaluate(f"S.entries.get('{fid}').body")[-200:])
    pg.goto(f'http://localhost:8765/index.html#entry-{fid}'); pg.wait_for_timeout(500)
    pg.locator('.hbblock.feat').screenshot(path='feat-view.png')
    # import
    pg.evaluate("openEditor(null,{type:'feat'})"); pg.wait_for_timeout(400)
    pg.evaluate("featImportApply('Tough Brawler\\nPrerequisite: Strength 13\\nYou are hardened by fights.\\n\\n***Iron Jaw.*** You have advantage on saves against being stunned.\\n\\n***Brawl.*** Your unarmed strikes deal 1d6.')"); pg.wait_for_timeout(300)
    print('import items', pg.evaluate("DRAFT.ft[0].items.map(i=>i.name+'|'+i.desc.slice(0,30))"))
    b.close()
print('ERRORS',errs)
