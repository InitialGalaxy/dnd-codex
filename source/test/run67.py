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
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(9000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    def make(name, cls, lvl):
        pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(400)
        pg.click('[data-act=newchar] >> nth=0'); pg.wait_for_timeout(300)
        pg.fill('#qc-name', name); pg.fill('#qc-level', str(lvl)); pg.locator('#qc-level').dispatch_event('change')
        pg.select_option('#qc-race', label='Human'); pg.select_option('#qc-class', cls); pg.click('[data-act=qcgo]'); pg.wait_for_timeout(800)
        return pg.evaluate("location.hash.slice(6)")
    for cls in ['Barbarian','Monk','Fighter','Wizard']:
        cid=make(cls+'Guy',cls,3)
        c=f"S.chars.get('{cid}')"
        print(cls, 'ac field', repr(pg.evaluate(c+'.ac')), 'shown', pg.evaluate(f"cAC({c})"), pg.evaluate(f"acCalc({c}).parts"))
        if cls=='Barbarian':
            pg.evaluate("CS.tab='play';render()"); pg.wait_for_timeout(300)
            pg.locator('.vitals').screenshot(path='ac-vitals.png'); pg.locator('.eqac').screenshot(path='ac-eq.png')
            # unequip armour -> unarmoured defence + shield
            pg.evaluate(f"charChange('{cid}', x=>{{delete x.inv.slots.ar; x.inv.slots.w5={{ref:'s:shield',qty:1,name:'Shield'}}}})"); pg.wait_for_timeout(300)
            print('  barb no armour', pg.evaluate(f"cAC({c})"), pg.evaluate(f"acCalc({c}).parts"))
            pg.locator('.eqac').screenshot(path='ac-eq2.png')
        if cls=='Monk':
            pg.evaluate(f"charChange('{cid}', x=>{{x.inv.slots.w5={{ref:'s:shield',qty:1,name:'Shield'}}}})"); pg.wait_for_timeout(300)
            print('  monk w shield', pg.evaluate(f"cAC({c})"), pg.evaluate(f"acCalc({c}).parts"))
    print('vakryn typed', pg.evaluate("cAC(S.chars.get('cvakryn'))"), pg.evaluate("S.chars.get('cvakryn').ac"))
    b.close()
print('ERRORS',errs)
