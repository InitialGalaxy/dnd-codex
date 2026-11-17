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
    # an old-style encounter to check it converts
    pg.evaluate("S.db.doc('encounters/encold').set({name:'Old one',mons:[{ref:'cbriargullet',n:2}],party:[],updated:'2020-01-01'})"); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8765/index.html#encounters'); pg.wait_for_timeout(800)
    print('old rows', pg.locator('.cbt').count(), pg.locator('.cbname b').all_text_contents())
    pg.click('[data-act=encnew] >> nth=0'); pg.wait_for_timeout(400)
    pg.fill('.encname','Swamp ambush'); pg.locator('.encname').dispatch_event('change'); pg.wait_for_timeout(300)
    pg.fill('#encq','Marshspear'); pg.fill('#encqn','2'); pg.click('[data-act=encadd]'); pg.wait_for_timeout(400)
    pg.fill('#encq','Changelisk'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    pg.click('[data-act=encparty]'); pg.wait_for_timeout(400)
    print('rows', pg.locator('.cbt').count(), pg.locator('.cbname b').all_text_contents())
    pg.click('[data-act=encroll]'); pg.wait_for_timeout(300)
    inp=pg.locator('[data-cbinit]'); 
    pcs=pg.locator('.cbt.pc [data-cbinit]')
    pcs.nth(0).fill('18'); pcs.nth(0).dispatch_event('change'); pg.wait_for_timeout(300)
    pg.locator('.cbt.pc [data-cbinit]').nth(1).fill('3'); pg.locator('.cbt.pc [data-cbinit]').nth(1).dispatch_event('change'); pg.wait_for_timeout(300)
    print('order', [ (pg.locator('.cbt').nth(k).locator('.cbname b').text_content(), pg.locator('.cbt').nth(k).locator('[data-cbinit]').input_value()) for k in range(pg.locator('.cbt').count())])
    pg.click('[data-act=encnext]'); pg.wait_for_timeout(300); pg.click('[data-act=encnext]'); pg.wait_for_timeout(300)
    print('turn', pg.locator('.cbt.turn .cbname b').text_content(), pg.text_content('.encround strong'))
    # damage marshspear 1
    row=pg.locator('.cbt', has_text='Marshspear 1')
    row.locator('[data-cbamt]').fill('50'); row.locator('[data-v=dmg]').click(); pg.wait_for_timeout(400)
    row=pg.locator('.cbt', has_text='Marshspear 1'); print('hp', row.locator('.cbhpn').text_content(), row.locator('.bloodied').count())
    row.locator('.cbaddc summary').click(); row.locator('.cbclist button', has_text='Prone').click(); pg.wait_for_timeout(400)
    row=pg.locator('.cbt', has_text='Marshspear 1'); print('conds', row.locator('.cond').all_text_contents())
    row.locator('[data-cbamt]').fill('100'); row.locator('[data-v=dmg]').click(); pg.wait_for_timeout(400)
    print('down', pg.locator('.cbt.down').count())
    row=pg.locator('.cbt', has_text='Marshspear 2'); row.locator('.cbname').click(); pg.wait_for_timeout(300)
    print('side', pg.locator('.encside .statblock .sbname').first.text_content(), pg.locator('.encside [data-cblabel]').input_value())
    pg.fill('.encside [data-cblabel]','Big Marsh'); pg.locator('.encside [data-cblabel]').dispatch_event('change'); pg.wait_for_timeout(400)
    for k in range(5): pg.click('[data-act=encnext]'); pg.wait_for_timeout(200)
    print('round', pg.text_content('.encround strong'), pg.locator('.cbt.turn .cbname b').text_content())
    pg.screenshot(path='trk-a.png', full_page=True)
    pg.set_viewport_size({'width':420,'height':900}); pg.wait_for_timeout(300); pg.screenshot(path='trk-m.png')
    pg.set_viewport_size({'width':1300,'height':900})
    pg.goto('http://localhost:8765/index.html#entry-cchangelisk'); pg.wait_for_timeout(600); pg.click('[data-act=encto]'); pg.wait_for_timeout(400)
    print('added', [ [c['label'] for c in e.get('list',[])] for e in pg.evaluate("[...S.encs.values()]")])
    b.close()
print('ERRORS',errs)
