import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
dr=json.load(open('/home/claude/sheets/draeden.json')); dr['subclass']='Dragon Warden'; docs['characters/cdraeden']=dr
docs['settings/imports']={'imageLinks':True}
body='''Intro to the book.

# Classes

## Ranger subclass: Dragon Warden

Any character that starts with this class should have a low CR dragon.

### Dragon Warden Spells

At 3rd level, you learn an additional spell.

|  |  |
| :-: | :-: |
| \\*\\*Ranger Level\\*\\* | \\*\\*Spells\\*\\* |
| Level 3 (L1) | Healing word |

### Dragon Binding

Additionally, at 3rd level, you can bind a dragon.

### Draconic Control

Starting from 7th level, your control has increased.

### Summoner proficiency

Additionally, at level 7, your fulfilment level increases.

### Greater proficiency

Starting from 15th level, you learn one cantrip.

# 

# Spells

Some spells.'''
docs['books/bthe-art-of-not-dying-to-a-dragon']={'title':'The Art of Not Dying to a Dragon','status':'In progress','body':body,'order':2,'created':'2026-11-09T02:30:00.000Z','updated':'2026-11-09T02:30:00.000Z'}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='warning' and errs.append(m.text))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#book-bthe-art-of-not-dying-to-a-dragon'); pg.wait_for_timeout(2000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    print('migrated', pg.evaluate("JSON.stringify(S.entries.get('subclass-dragon-warden')&&S.entries.get('subclass-dragon-warden').subclass.features.map(f=>[f.n,f.lv]))"))
    print('body', pg.evaluate("S.books.get('bthe-art-of-not-dying-to-a-dragon').body"))
    pg.screenshot(path='book-embed.png', full_page=True)
    # editor
    pg.click('a[href="#bookedit-bthe-art-of-not-dying-to-a-dragon"]'); pg.wait_for_timeout(600)
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.screenshot(path='bookedit.png')
    # type in the editor, autosave
    pg.click('.rtedit p >> nth=0'); pg.keyboard.press('End'); pg.keyboard.type(' Added words here.'); pg.wait_for_timeout(1800)
    print('saved', 'Added words here' in pg.evaluate("window.__store.get('books/bthe-art-of-not-dying-to-a-dragon').body"), pg.inner_text('#besave'))
    # scroll down and check sticky toolbar
    pg.mouse.wheel(0,900); pg.wait_for_timeout(300); pg.screenshot(path='bookedit-scrolled.png')
    # new subclass via insert
    pg.click('.rtedit p >> nth=0')
    pg.click('[data-ins=subclass]'); pg.wait_for_timeout(400)
    pg.fill('#ed-title','Giant Fighter'); pg.select_option('#sc-cls','Fighter')
    pg.fill('#sc-rows .hb-n','Giant Grip'); pg.fill('#sc-rows .hb-lv','3')
    pg.click('[data-act=hbadd][data-v=sc]'); pg.wait_for_timeout(200)
    pg.locator('#sc-rows .hbrow').nth(1).locator('.hb-n').fill('Titan Swing'); pg.locator('#sc-rows .hbrow').nth(1).locator('.hb-lv').fill('7')
    pg.locator('#sc-rows .hbrow').nth(1).locator('.rtedit').click(); pg.keyboard.type('Swing really hard.')
    pg.locator('fieldset[data-for=subclass]').screenshot(path='subclass-editor.png')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(1800)
    print('hash', pg.evaluate("location.hash"), 'embeds', pg.locator('.rtedit .embedblock').count())
    st=pg.evaluate("window.__store.get('books/bthe-art-of-not-dying-to-a-dragon').body"); print('stored body head', st[:220])
    # picker
    pg.click('[data-ins=lib]'); pg.wait_for_timeout(300); pg.fill('#bepq','a'); pg.wait_for_timeout(200)
    pg.screenshot(path='picker.png')
    first=pg.locator('.bepick').first; t=first.inner_text(); first.click(); pg.wait_for_timeout(300); print('picked', t.replace('\n',' '), pg.locator('.rtedit .embedblock').count())
    # edit embed in place
    pg.locator('.rtedit .embedblock [data-embact=edit]').first.click(); pg.wait_for_timeout(400)
    print('editing', pg.input_value('#ed-title')); pg.click('[data-act=closemodal] >> nth=-1'); pg.wait_for_timeout(200)
    # leave the page quickly after typing: flush
    pg.click('.rtedit p >> nth=0'); pg.keyboard.type(' Quick leave.'); pg.evaluate("location.hash='books'"); pg.wait_for_timeout(600)
    print('flushed', 'Quick leave' in pg.evaluate("window.__store.get('books/bthe-art-of-not-dying-to-a-dragon').body"))
    pg.goto('http://localhost:8765/index.html#book-bthe-art-of-not-dying-to-a-dragon'); pg.wait_for_timeout(1500)
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.screenshot(path='book-embed2.png', full_page=True)
    # character: level up dropdown + fill
    pg.goto('http://localhost:8765/index.html#char-cdraeden'); pg.wait_for_timeout(800)
    print('class', pg.evaluate("S.chars.get('cdraeden').classes"), pg.evaluate("S.chars.get('cdraeden').level"))
    pg.click('[data-act=cedit]'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(300)
    lv=pg.locator('.levelup'); print('levelup', lv.count())
    if lv.count(): lv.screenshot(path='levelup-hb.png')
    f=pg.locator('.srdfill'); 
    if f.count(): f.screenshot(path='fill-hb.png'); print(f.inner_text()[:400])
    # new book flow
    pg.goto('http://localhost:8765/index.html#books'); pg.wait_for_timeout(500)
    pg.click('[data-act=newbook]'); pg.wait_for_timeout(800); print('newbook', pg.evaluate("location.hash"))
    pg.set_viewport_size({'width':400,'height':860}); pg.wait_for_timeout(300); pg.screenshot(path='bookedit-phone.png')
    b.close()
print('ERRORS',errs)
