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
    pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(300)
    pg.evaluate("openEditor(null,{type:'item'})"); pg.wait_for_timeout(500)
    print('bar', pg.locator('.impbar').is_visible(), 'stats on', pg.is_checked('#it-stats-on'), 'use on', pg.is_checked('#it-use-on'), 'stats wrap vis', pg.locator('#it-stats-wrap').is_visible(), 'use vis', pg.locator('#it-use-wrap').is_visible())
    pg.click('.imphead [data-act=impopen]'); pg.fill('#imp-paste', """Sun Blade
Weapon (longsword), rare (requires attunement)
This item appears to be a longsword hilt. While grasping the hilt, you can use a bonus action to cause a blade of pure radiance to spring into existence.
Radiant Blade. While the blade exists, this magic longsword has the finesse property.
Sunlight. While the blade is ignited, you can use an action to expand or reduce its radius of bright light by 5 feet.""")
    pg.locator('.modal').first.screenshot(path='imp-open.png') if pg.locator('.modal').count() else pg.screenshot(path='imp-open.png')
    pg.click('[data-act=impgo]'); pg.wait_for_timeout(400)
    print('item', pg.input_value('#ed-title'), pg.input_value('#it-cat'), pg.input_value('#it-base'), pg.input_value('#ed-rarity'), pg.is_checked('#it-attune'), pg.is_checked('#it-stats-on'), pg.text_content('#it-linepreview'))
    print('abilities', pg.evaluate("DRAFT.it[0].items.map(x=>x.name+': '+x.desc.slice(0,30))"))
    pg.check('#it-use-on'); pg.check('#it-holds-on'); pg.locator('fieldset[data-for=item]').screenshot(path='item-form.png')
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(800)
    e=pg.evaluate("[...S.entries.values()].find(e=>e.title==='Sun Blade')"); print('saved', e['item']['use'], e['item'].get('stats'), e['item']['rarity'])
    # ring
    pg.evaluate("openEditor(null,{type:'item'})"); pg.wait_for_timeout(500)
    pg.click('.imphead [data-act=impopen]'); pg.fill('#imp-paste', "Ring of Protection\nRing, rare (requires attunement)\nYou gain a +1 bonus to AC and saving throws while wearing this ring.")
    pg.click('[data-act=impgo]'); pg.wait_for_timeout(300)
    print('ring', pg.input_value('#ed-title'), pg.input_value('#it-cat'), pg.input_value('#ed-rarity'), pg.is_checked('#it-stats-on'), pg.text_content('#it-linepreview'))
    pg.evaluate("document.querySelector('[data-act=closemodal]').click()")
    # spell via bar
    pg.evaluate("openEditor(null,{type:'spell'})"); pg.wait_for_timeout(500)
    print('old sp box', pg.locator('#sp-import').count())
    pg.click('.imphead [data-act=impopen]'); pg.fill('#imp-paste', "Fire Bolt\nEvocation cantrip\nCasting Time: 1 action\nRange: 120 feet\nComponents: V, S\nDuration: Instantaneous\nYou hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage.")
    pg.click('[data-act=impgo]'); pg.wait_for_timeout(300); print('spell', pg.input_value('#ed-title'), pg.input_value('#sp-range'))
    # switch type to feat -> bar text changes
    pg.select_option('#ed-type','feat'); pg.wait_for_timeout(200); print('feat bar', pg.text_content('#imp-what'))
    pg.select_option('#ed-type','creature'); pg.wait_for_timeout(200); print('creature bar visible', pg.locator('.impbar').is_visible())
    b.close()
print('ERRORS',errs)
