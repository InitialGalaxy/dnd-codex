import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
docs['settings/imports']={'imageLinks':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#home'); pg.wait_for_timeout(1200)
    pg.screenshot(path='home-chars.png')
    pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(500)
    pg.screenshot(path='party.png', full_page=True)
    pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(500)
    pg.screenshot(path='saahan.png', full_page=True)
    # damage 10 with temp 5
    pg.fill('#hpamt','5'); pg.click('[data-act=chp][data-v=temp]'); pg.wait_for_timeout(100)
    pg.fill('#hpamt','10'); pg.click('[data-act=chp][data-v=dmg]'); pg.wait_for_timeout(100)
    print('hp', pg.evaluate("JSON.stringify(S.chars.get('csaahan').hp)"))
    pg.click('[data-act=cres][data-k="2"][data-j="4"]'); pg.click('[data-act=cres][data-k="0"][data-j="0"]'); pg.wait_for_timeout(100)
    print('res', pg.evaluate("S.chars.get('csaahan').resources.map(r=>r.name+':'+r.used).join(',')"))
    pg.click('[data-act=chd][data-k="7"]'); pg.wait_for_timeout(100); print('hd', pg.evaluate("JSON.stringify(S.chars.get('csaahan').hd)"))
    pg.wait_for_timeout(900); print('stored', pg.evaluate("JSON.stringify(window.__store.get('characters/csaahan').hp)"))
    pg.click('[data-act=crest][data-v=long]'); pg.wait_for_timeout(200); pg.click('#modal button.btn:not(.ghost)'); pg.wait_for_timeout(200)
    print('after long', pg.evaluate("JSON.stringify([S.chars.get('csaahan').hp,S.chars.get('csaahan').hd,S.chars.get('csaahan').resources.map(r=>r.used)])"))
    print('skills', pg.evaluate("[cSkill(S.chars.get('csaahan'),'perception'), cSkill(S.chars.get('csaahan'),'intimidation'), cSave(S.chars.get('csaahan'),'str'), cPB(S.chars.get('csaahan'))]"))
    # edit mode
    pg.click('[data-act=cedit]'); pg.wait_for_timeout(300)
    pg.screenshot(path='saahan-edit.png', full_page=True)
    pg.fill('#cf-abilities-wis','14'); pg.wait_for_timeout(900)
    print('wis', pg.evaluate("S.chars.get('csaahan').abilities.wis"), 'focus', pg.evaluate("document.activeElement.id"))
    pg.click('[data-act=cskill][data-v=athletics]'); pg.wait_for_timeout(100)
    print('athl', pg.evaluate("S.chars.get('csaahan').skills.athletics"))
    pg.click('[data-act=clistadd][data-v=resources]'); pg.wait_for_timeout(200); pg.keyboard.type('Indomitable')
    pg.wait_for_timeout(800); print('newres', pg.evaluate("JSON.stringify(window.__store.get('characters/csaahan').resources.slice(-1))"))
    print('rich editors', pg.evaluate("document.querySelectorAll('.sheet .rt, .sheet [contenteditable]').length"))
    pg.click('[data-act=cedit]'); pg.wait_for_timeout(200)
    pg.goto('http://localhost:8765/index.html#char-cvakryn'); pg.wait_for_timeout(400)
    pg.screenshot(path='vakryn.png', full_page=True)
    pg.set_viewport_size({'width':400,'height':860}); pg.wait_for_timeout(300)
    pg.screenshot(path='vakryn-phone.png', full_page=True)
    pg.click('.ctabs [data-v=stats]'); pg.wait_for_timeout(100); pg.screenshot(path='vakryn-phone-stats.png', full_page=True)
    pg.click('.ctabs [data-v=features]'); pg.wait_for_timeout(100); pg.screenshot(path='vakryn-phone-feat.png', full_page=True)
    b.close()
print('ERRORS',errs)
