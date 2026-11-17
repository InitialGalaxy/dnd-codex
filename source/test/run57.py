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
    pg.check('#it-holds-on'); pg.fill('#it-holds-n','10'); pg.locator('.holdsrow').screenshot(path='holds-form.png')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(800)
    rid=pg.evaluate("[...S.entries].find(([,e])=>e.title==='Ring of Arms')[0]"); print('holds', pg.evaluate("(r)=>S.entries.get(r).item.holds", rid))
    pg.evaluate("openEditor(null,{type:'item'})"); pg.wait_for_timeout(500)
    pg.fill('#ed-title','Potion Bandolier'); pg.select_option('#it-cat','Trinket'); pg.check('#it-holds-on'); pg.fill('#it-holds-n','4'); pg.select_option('#it-holds-row','cons')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(800)
    bid=pg.evaluate("[...S.entries].find(([,e])=>e.title==='Potion Bandolier')[0]")
    ls=pg.evaluate("SRD_EQUIP.find(x=>/^longsword$/i.test(x.title)).id"); da=pg.evaluate("SRD_EQUIP.find(x=>/^dagger$/i.test(x.title)).id")
    pg.evaluate("([r,b,ls,da])=>charChange('cvakryn',x=>{const v=invOf(x);v.slots.w5={ref:'e:'+r,qty:1,name:'Ring of Arms'};v.slots.w4={ref:'e:'+b,qty:1,name:'Potion Bandolier'};v.slots.w7={ref:'s:'+ls,qty:1,name:'Longsword'};v.slots.w8={ref:'s:'+da,qty:2,name:'Dagger'};x.inv=v;})", [rid,bid,ls,da]); pg.wait_for_timeout(400)
    pg.goto('http://localhost:8765/index.html#char-cvakryn'); pg.wait_for_timeout(600)
    print('banner', pg.locator('.xattack').text_content() if pg.locator('.xattack').count() else None)
    print('attack rows', pg.locator('.atktab tbody tr').all_text_contents()[:8])
    pg.locator('.csec', has_text='Equipped').first.screenshot(path='xatk.png')
    pg.click('[data-act=cview][data-v=inv]'); pg.wait_for_timeout(400)
    print('hold rows', pg.locator('.eqrow.holds').count(), pg.locator('.eqrow.holds .islot').count())
    pg.locator('.equip').screenshot(path='holds-inv.png')
    pg.evaluate("charChange('cvakryn',x=>{delete x.inv.slots.w5})"); pg.wait_for_timeout(400)
    print('after unequip', pg.evaluate("Object.entries(S.chars.get('cvakryn').inv.slots).filter(([k,s])=>/Long|Dagg/.test(s.name)).map(([k,s])=>k+':'+s.name)"))
    pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(500)
    print(pg.evaluate("JSON.stringify(attacksPerAction(S.chars.get('csaahan')))"), pg.locator('.csec[data-tab=play]').count(), pg.locator('#catk, [data-sec=catk]').count())
    print('saahan banner', pg.locator('.xattack strong').text_content() if pg.locator('.xattack').count() else None)
    b.close()
print('ERRORS',errs)
