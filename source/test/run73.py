import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':1000}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#bestiary'); pg.wait_for_timeout(9000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    def save(): pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(900)
    for cid in pg.evaluate("[...S.entries].filter(([k,v])=>v.statblock&&v.statblock.features).map(([k])=>k)"):
        before=pg.evaluate(f"S.entries.get('{cid}').statblock.features")
        pg.evaluate(f"openEditor('{cid}')"); pg.wait_for_timeout(500)
        modes=pg.evaluate("DRAFT.sb.flatMap(s=>s.items.filter(i=>i.mode==='multi'||i.rch).map(i=>i.name+':'+(i.mode||'')+':'+(i.rch||'')))")
        save()
        after=pg.evaluate(f"S.entries.get('{cid}').statblock.features")
        print(cid, 'same' if before==after else 'CHANGED', modes[:4])
        if before!=after:
            import difflib; print('\n'.join(list(difflib.unified_diff(before.split('\n'),after.split('\n'),lineterm=''))[:12]))
    pg.evaluate("openEditor('cchangelisk')"); pg.wait_for_timeout(500)
    it=pg.locator('#sbsections .sbitem', has=pg.locator('.multif')).first
    it.screenshot(path='multi-1.png')
    # rivensnout: convert multiattack to multi with custom row
    pg.evaluate("openEditor('cmarshspear')"); pg.wait_for_timeout(500)
    idx=pg.evaluate("(()=>{const s=DRAFT.sb.findIndex(x=>x.items.some(i=>/multiattack/i.test(i.name)));return [s, DRAFT.sb[s].items.findIndex(i=>/multiattack/i.test(i.name))]})()")
    box=pg.locator('.multif').first
    box.locator('.mrow-n').first.fill('2'); box.locator('.mrow-pick').first.select_option('__custom'); box.locator('.mrow-text').first.fill('with any attack that has a recharge of 3–6 or lower')
    print('prev', box.locator('.mprev').inner_text())
    box.locator('[data-act=mrowadd]').click(); pg.wait_for_timeout(200)
    box.locator('.mrow-pick').nth(1).select_option('Hooked Beak'); box.locator('.mrow-n').nth(1).fill('1')
    print('prev2', box.locator('.mprev').inner_text())
    # set a recharge via the box on another action
    sel=pg.locator('#sbsections .sbitem .itrch').nth(3); sel.select_option('custom'); pg.locator('#sbsections .sbitem .itrchc').nth(3).fill('3/Day')
    pg.locator('#sbsections .sbitem', has=pg.locator('.multif')).first.screenshot(path='multi-2.png')
    save()
    f=pg.evaluate("S.entries.get('cmarshspear').statblock.features"); 
    import re; print([l[:140] for l in f.split('\n') if 'Multiattack' in l or '3/Day' in l])
    b.close()
print('ERRORS',errs)
