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
    pg.wait_for_timeout(5000)
    def make(name, race, sub, cls, lvl, subcls=None, hidden=False):
        pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(400)
        pg.click('[data-act=newchar] >> nth=0'); pg.wait_for_timeout(300)
        pg.fill('#qc-name', name); pg.fill('#qc-level', str(lvl)); pg.locator('#qc-level').dispatch_event('change')
        pg.select_option('#qc-race', label=race); pg.wait_for_timeout(100)
        if sub: pg.select_option('#qc-subrace', label=sub)
        pg.select_option('#qc-class', cls); pg.wait_for_timeout(100)
        if subcls: pg.select_option('#qc-sub', label=subcls); print('sub sel', pg.input_value('#qc-sub'))
        if hidden: pg.check('#qc-hidden')
        if name=='Brannoc': pg.locator('.mbox').screenshot(path='qc-dialog.png')
        pg.click('[data-act=qcgo]'); pg.wait_for_timeout(800)
        cid=pg.evaluate("location.hash.slice(6)"); c=pg.evaluate(f"S.chars.get('{cid}')")
        print(name, c['race'], c['classes'], c['level'], c.get('subclass'), c['abilities'], 'HP', c['hp']['max'], 'AC', c['ac'], 'speed', c['speed'], 'saves', list(c['saves']), 'skills', list(c['skills']), 'hidden', c.get('hidden'))
        print('   feats', [f['name'] for f in c['features']][:14], len(c['features']), 'inv', [s['name'] for s in (c.get('inv') or {}).get('slots',{}).values()], 'caster', c.get('caster'))
        return cid
    a=make('Brannoc','Dwarf','Hill Dwarf','Fighter',5,'Champion')
    pg.screenshot(path='qc-sheet.png')
    print('equipped AC suggestion button', pg.locator('[data-act=cuseac]').count())
    make('Ilyra','Elf','High Elf','Wizard',1)
    make('Grask','Half-Orc',None,'Barbarian',8, hidden=True)
    make('Mira','Human',None,'Cleric',3)
    make('Tess','Half-Elf',None,'Bard',4)
    pg.goto('http://localhost:8765/index.html#characters'); pg.wait_for_timeout(500)
    print('sections', pg.locator('.chsect').all_text_contents())
    pg.screenshot(path='qc-list.png', full_page=True)
    # manual
    pg.click('[data-act=newchar] >> nth=0'); pg.wait_for_timeout(300); pg.click('[data-act=qcmanual]'); pg.wait_for_timeout(600)
    print('manual edit', pg.evaluate("CS.edit"), pg.evaluate("S.chars.get(location.hash.slice(6)).name"))
    b.close()
print('ERRORS',errs)
