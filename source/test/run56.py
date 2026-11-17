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
    pg.wait_for_timeout(6000)
    print('imports', pg.evaluate("S.imports.srdFeatsRaces"), pg.evaluate("[...S.entries.values()].filter(e=>e.type==='feat').length"), pg.evaluate("[...S.entries.values()].filter(e=>e.type==='race').map(e=>e.title)"))
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(500)
    pg.click('[data-act=ftype][data-v=feat]'); pg.wait_for_timeout(300)
    print('lib feats', pg.locator('.card, .ecard, .entrycard').count())
    fid=pg.evaluate("featByName('Grappler')[0]")
    pg.goto('http://localhost:8765/index.html#entry-'+fid); pg.wait_for_timeout(500)
    pg.locator('main').screenshot(path='feat-view.png')
    rid=pg.evaluate("[...S.entries].find(([,e])=>e.type==='race'&&e.title==='Dwarf')[0]")
    pg.goto('http://localhost:8765/index.html#entry-'+rid); pg.wait_for_timeout(500); pg.locator('main').screenshot(path='race-view.png')
    # new feat via paste
    pg.goto('http://localhost:8765/index.html#library'); pg.wait_for_timeout(300)
    pg.evaluate("openEditor(null,{type:'feat'})"); pg.wait_for_timeout(500)
    pg.click('.imphead [data-act=impopen]'); pg.fill('#imp-paste', """Sentinel
General Feat (Prerequisite: Level 4+, Strength or Dexterity 13+)
You gain the following benefits.
Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20.
Guardian. Immediately after a creature within 5 feet of you takes the Disengage action or hits a target other than you with an attack, you can make an Opportunity Attack against that creature.
Halt. When you hit a creature with an Opportunity Attack, the creature's Speed becomes 0 for the rest of the current turn.""")
    pg.click('[data-act=impgo]'); pg.wait_for_timeout(300)
    print('filled', pg.input_value('#ed-title'), pg.input_value('#ft-kind'), pg.input_value('#ft-prereq'))
    pg.locator('form[data-form=entry]').screenshot(path='feat-edit.png')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(800)
    e=pg.evaluate("featByName('Sentinel')[1]"); print('saved', e['feat'], e['body'][:220])
    pg.locator('main').screenshot(path='feat-new.png')
    print('fill races', pg.evaluate("homebrewRaces().length"))
    b.close()
print('ERRORS',errs)
