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
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(800)
    pg.click('[data-act=imagic][data-v=harvest]'); pg.wait_for_timeout(300)
    pg.click('.sizecfg summary')
    lo=pg.locator('[data-garg="0"]'); hi=pg.locator('[data-garg="1"]')
    lo.fill('6'); lo.dispatch_event('change'); pg.wait_for_timeout(300); print('open?', pg.evaluate("[...document.querySelectorAll('.sizecfg')].map(d=>d.open)"))
    hi=pg.locator('.sizecfg [data-garg="1"]'); hi.fill('12'); hi.dispatch_event('change'); pg.wait_for_timeout(300)
    print('cfg', pg.evaluate("S.harvestCfg"), pg.text_content('#garg-show'))
    pg.locator('.sizecfg').screenshot(path='garg-cfg.png')
    # new harvested part editor
    pg.click('[data-act=newharvest]'); pg.wait_for_timeout(400)
    vis=lambda sel: pg.locator(sel).first.is_visible()
    print('harvest mode: base', vis('#it-base'), 'props', vis('#it-props'), 'rarity', vis('#ed-holder'), 'dc', vis('#hv-dc'), 'lore', vis('#it-lore'), 'abil', vis('#itsections'))
    pg.locator('form[data-form=entry]').screenshot(path='hv-form.png')
    pg.select_option('#it-cat', index=0); pg.wait_for_timeout(100)
    print('normal mode: base', vis('#it-base'), 'dc', vis('#hv-dc'), 'abil', vis('#itsections'))
    pg.evaluate("document.querySelector('[data-act=closemodal]').click()")
    # creature: make marshspear gargantuan
    pg.goto('http://localhost:8765/index.html#entry-cmarshspear'); pg.wait_for_timeout(600)
    pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
    print('garg hidden at start', not vis('#loot-gargwrap'))
    pg.select_option('#loot-size','Gargantuan'); pg.wait_for_timeout(100)
    print('garg shown', vis('#loot-gargwrap'), pg.get_attribute('#loot-garg','min'), pg.get_attribute('#loot-garg','max'))
    if not pg.locator('#loot-rows .lootrow').count(): pg.click('[data-act=lootadd]')
    r=pg.locator('#loot-rows .lootrow').first; r.locator('.lt-n').fill(r.locator('.lt-n').input_value() or 'Hide'); r.locator('.lt-qty').fill('1 × size'); r.locator('.lt-qty').dispatch_event('input')
    pg.locator('#loot-garg').fill('10'); pg.locator('#loot-garg').dispatch_event('input')
    print('calc', r.locator('.lt-qcalc').text_content(), pg.text_content('#loot-gargval'))
    pg.locator('#loot-gargwrap').locator('xpath=..').screenshot(path='garg-creature.png')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(800)
    e=pg.evaluate("S.entries.get('cmarshspear')"); print('saved', e.get('lootSize'), e.get('lootGarg'))
    print('card', pg.locator('.loot .lootstats').first.text_content())
    b.close()
print('ERRORS',errs)
