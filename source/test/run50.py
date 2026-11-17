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
    pg.evaluate("(async()=>{const e=S.entries.get('cchangelisk');await S.db.doc('entries/cchangelisk').set(Object.assign({},e,{shapeshift:{allow:'tags',tags:['bird-wyvern'],mode:'replace'}}))})()"); pg.wait_for_timeout(400)
    sid=pg.evaluate("SRD_EQUIP.find(x=>/^shield$/i.test(x.title)).id")
    pg.goto('http://localhost:8765/index.html#char-cvakryn'); pg.wait_for_timeout(800)
    pg.click('[data-act=cview][data-v=sum]'); pg.wait_for_timeout(300)
    pg.fill('#smq','Changelisk'); pg.click('[data-act=smadd]'); pg.wait_for_timeout(600)
    pg.evaluate("(sid)=>charChange('cvakryn',x=>{x.summons=x.summons.map(s=>Object.assign({},s,{inv:{slots:{r0c0:{ref:'s:'+sid,name:'Shield',qty:1}}}}))})", sid); pg.wait_for_timeout(500)
    def stats(): return pg.evaluate("[...document.querySelectorAll('.summon .hpnums strong')].map(x=>x.textContent)")
    print('before', stats())
    pg.select_option('.summon .sspanel select', index=1); pg.wait_for_timeout(600)
    print('shifted', stats(), 'atk', pg.locator('.smatks tbody tr').count())
    pg.fill('[data-smamt]','80'); pg.click('[data-act=smhp][data-v=dmg]'); pg.wait_for_timeout(500)
    print('after 80 dmg', stats(), pg.evaluate("S.chars.get('cvakryn').summons.map(s=>[s.form,s.hp,s.fhp])"))
    # custom ability
    pg.click('[data-act=smabil]'); pg.fill('.smabilform [data-f=name]','Pounce'); pg.fill('.smabilform [data-f=hit]','6'); pg.fill('.smabilform [data-f=dmg]','2d6+3 piercing'); pg.fill('.smabilform [data-f=text]','Leaps up to 20 ft.')
    pg.click('[data-act=smabilsave]'); pg.wait_for_timeout(500)
    pg.click('[data-act=smabil]'); pg.fill('.smabilform [data-f=name]','Keen Smell'); pg.select_option('.smabilform [data-f=kind]','ability'); pg.click('[data-act=smabilsave]'); pg.wait_for_timeout(500)
    print('custom rows', pg.locator('.smcustrow').count(), 'chips', pg.locator('.smab.cust').count(), pg.evaluate("S.chars.get('cvakryn').summons[0].abil"))
    # custom summon
    pg.click('[data-act=smnew]'); pg.wait_for_timeout(300)
    f=lambda k,v: pg.fill(f'.smstats [data-f={k}]',v)
    f('name','Spirit Wolf'); pg.select_option('.smstats [data-f=size]','Large'); f('type','fey'); f('ac','13'); f('hp','30'); f('speed','50 ft.'); f('dex','16')
    pg.click('[data-act=smsave]'); pg.wait_for_timeout(600)
    print('summons', pg.locator('.summon').count(), pg.locator('.summon.custom').count())
    pg.locator('.summon.custom [data-act=smedit]').click(); pg.wait_for_timeout(300); pg.fill('.smstats [data-f=hp]','40'); pg.click('[data-act=smsave]'); pg.wait_for_timeout(500)
    print('custom stats', pg.evaluate("[...document.querySelectorAll('.summon.custom .hpnums strong')].map(x=>x.textContent)"))
    pg.locator('.summon').first.screenshot(path='sm2-a.png'); pg.locator('.summon.custom').screenshot(path='sm2-b.png')
    pg.select_option('.summon .sspanel select', index=1); pg.wait_for_timeout(500); pg.locator('.summon').first.screenshot(path='sm2-c.png')
    b.close()
print('ERRORS',errs)
