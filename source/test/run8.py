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
    pg.goto('http://localhost:8765/index.html#bestiary'); pg.wait_for_timeout(1200)
    # round trip every stat block
    res=pg.evaluate("""()=>{const out=[];for(const [id,e] of S.entries){if(!e.statblock)continue;const f=e.statblock.features||'';const r=serializeFeatures(parseFeatures(f));const n=x=>x.replace(/\\s+/g,' ').trim();
      const det=parseDetails(e.statblock.details);const dl=[...DETAIL_FIELDS.map(([k])=>det.known[k]?k+': '+det.known[k]:'').filter(Boolean),...det.other.split('\\n').filter(Boolean)];
      const sameDet=new Set(dl).size===new Set((e.statblock.details||'').split('\\n').filter(Boolean)).size && dl.every(l=>(e.statblock.details||'').includes(l));
      out.push([e.title, n(f)===n(r), sameDet, det.other]);}return out}""")
    for r in res: print(r)
    # UI: open Manticore editor, save untouched, compare
    before=pg.evaluate("JSON.stringify(window.__store.get('entries/cmanticore').statblock)")
    pg.goto('http://localhost:8765/index.html#entry-cmanticore'); pg.wait_for_timeout(500)
    pg.click('[data-act=edit]'); pg.wait_for_timeout(300)
    print('sections in editor', pg.evaluate("[...document.querySelectorAll('.secname')].map(i=>i.value+':'+i.closest('.sbsec').querySelectorAll('.sbitem').length)"))
    pg.locator('.mbox').screenshot(path='editor-manticore.png')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
    after=pg.evaluate("JSON.stringify(window.__store.get('entries/cmanticore').statblock)")
    bj, aj = json.loads(before), json.loads(after)
    print('manticore unchanged:', {k:(bj.get(k)==aj.get(k)) for k in set(bj)|set(aj)})
    # new creature flow
    pg.click('header [data-act=new]'); pg.wait_for_timeout(300)
    pg.fill('#ed-title','Test Drake'); pg.select_option('#ed-type','creature'); pg.wait_for_timeout(100)
    pg.fill('#sb-ac','14 (natural armour)'); pg.fill('#sb-hp','52 (8d10 + 8)'); pg.fill('#sb-str','16')
    pg.fill('#sbd-6','Darkvision 60 ft., Passive Perception 12'); pg.fill('#sbd-1','Stealth +4')
    pg.click('.sbsec[data-si="0"] [data-act=sbadd]'); pg.wait_for_timeout(100)
    print('focus after add', pg.evaluate("document.activeElement.className"))
    pg.keyboard.type('Pack Tactics'); pg.fill('.sbsec[data-si="0"] .sbitem:last-of-type .itdesc','Advantage on attacks when an ally is within 5 ft.')
    pg.click('.sbsec[data-si="1"] [data-act=sbadd]'); pg.wait_for_timeout(100)
    pg.keyboard.type('Bite (Recharge 5–6)'); pg.fill('.sbsec[data-si="1"] .sbitem:last-of-type .itdesc','Melee Weapon Attack: +5 to hit. Hit: 10 (2d6 + 3) piercing damage.')
    pg.select_option('#sb-newsec','Reactions'); pg.click('[data-act=sbaddsec]'); pg.wait_for_timeout(100)
    pg.keyboard.type('Tail Flick'); pg.fill('.sbsec:last-of-type .sbitem:last-of-type .itdesc','Adds 2 to its AC against one attack.')
    pg.locator('.mbox').screenshot(path='editor-new.png')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
    nid=pg.evaluate("location.hash").replace('#entry-','')
    sb=pg.evaluate(f"window.__store.get('entries/{nid}').statblock")
    print('details:', repr(sb['details'])); print('features:', repr(sb['features']))
    pg.screenshot(path='new-drake.png', full_page=True)
    b.close()
print('ERRORS',errs)
