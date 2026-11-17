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
    pg.goto('http://localhost:8765/index.html#entry-cmarshspear'); pg.wait_for_timeout(5000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(400)
    pg.evaluate("openEditor(null,{type:'item'})"); pg.wait_for_timeout(500)
    pg.fill('#ed-title','Ring of Arms'); pg.select_option('#it-cat','Ring')
    print('opts hidden', pg.locator('.holdsopts').is_hidden())
    pg.check('#it-holds-on'); pg.fill('#it-holds-n','10')
    pg.locator('[data-tpk="it-holds-only"] .tpkin').fill('weap'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.locator('.holdsrow').screenshot(path='holds-form.png')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(800)
    rid=pg.evaluate("[...S.entries].find(([,e])=>e.title==='Ring of Arms')[0]"); print('holds', pg.evaluate("(r)=>S.entries.get(r).item.holds", rid))
    ls=pg.evaluate("SRD_EQUIP.find(x=>/^longsword$/i.test(x.title)).id"); rope=pg.evaluate("SRD_EQUIP.find(x=>/rope/i.test(x.title)).id")
    pg.evaluate("([r])=>charChange('cvakryn',x=>{const v=invOf(x);v.slots.w5={ref:'e:'+r,qty:1,name:'Ring of Arms'};x.inv=v;})", [rid]); pg.wait_for_timeout(300)
    c="S.chars.get('cvakryn')"
    print('accept sword', pg.evaluate(f"slotAccepts('w6','s:{ls}',{c})"), 'accept rope', pg.evaluate(f"slotAccepts('w6','s:{rope}',{c})"), pg.evaluate(f"slotRefusal('w6',{c})"))
    print('normal slot rope', pg.evaluate(f"slotAccepts('w0','s:{rope}',{c})"))
    pg.goto('http://localhost:8765/index.html#char-cvakryn'); pg.wait_for_timeout(500); pg.evaluate("CS.view='inv';render()"); pg.wait_for_timeout(300)
    pg.locator('.equip').screenshot(path='holds-inv2.png')
    # items search
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(500)
    n0=pg.locator('.card, .ecard').count()
    pg.locator('#itemq').type('ring', delay=40); pg.wait_for_timeout(500)
    print('search', n0, '->', pg.locator('#main .cards > *').count(), pg.evaluate("document.activeElement.id"), pg.input_value('#itemq'))
    pg.screenshot(path='items-search.png')
    b.close()
print('ERRORS',errs)
