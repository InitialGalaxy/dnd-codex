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
    for cid in list(pg.evaluate("[...S.entries].filter(([k,v])=>v.statblock&&v.statblock.details).map(([k])=>k)")):
        before=pg.evaluate(f"S.entries.get('{cid}').statblock.details")
        pg.evaluate(f"openEditor('{cid}')"); pg.wait_for_timeout(500)
        notes=pg.locator('.sbdnote').all_inner_texts(); notes=[n for n in notes if n.strip()]
        save()
        after=pg.evaluate(f"S.entries.get('{cid}').statblock.details")
        print(cid, 'unchanged' if before==after else ('CHANGED', before, after), notes)
    pg.evaluate("openEditor('crivensnout')"); pg.wait_for_timeout(500)
    pg.locator('.sbdetails').screenshot(path='sbd-1.png')
    # change: tick Dex save, add a skill, add resistance, add telepathy, raise WIS
    pg.check('.sbsave[data-ab=dex]')
    pg.click('[data-act=sbdadd][data-f="1"]'); pg.select_option('.sbdet[data-f="1"] .sbdrow >> nth=-1 >> .sbd-v','Stealth'); pg.select_option('.sbdet[data-f="1"] .sbdrow >> nth=-1 >> .sbd-p','exp')
    pg.click('[data-act=sbdadd][data-f="3"]'); pg.select_option('.sbdet[data-f="3"] .sbdrow >> nth=-1 >> .sbd-v','Cold')
    pg.click('[data-act=sbdadd][data-f="7"]'); pg.select_option('.sbdet[data-f="7"] .sbdrow >> nth=-1 >> .sbd-v','Telepathy'); pg.fill('.sbdet[data-f="7"] .sbdrow >> nth=-1 >> .sbd-n','120')
    pg.click('[data-act=sbdadd][data-f="6"]'); pg.select_option('.sbdet[data-f="6"] .sbdrow >> nth=-1 >> .sbd-v','other'); pg.fill('.sbdet[data-f="6"] .sbdrow >> nth=-1 >> .sbd-text','blindsight 10 ft. (blind beyond)')
    pg.locator('.sbdetails').screenshot(path='sbd-2.png')
    save()
    print(pg.evaluate("S.entries.get('crivensnout').statblock.details"))
    print(pg.evaluate("S.entries.get('crivensnout').statblock.str"), pg.evaluate("S.entries.get('crivensnout').statblock.wis"), pg.evaluate("S.entries.get('crivensnout').statblock.prof"))
    b.close()
print('ERRORS',errs)
