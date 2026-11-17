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
    pg.goto('http://localhost:8765/index.html#bookedit-bthe-art-of-not-dying-to-a-dragon'); pg.wait_for_timeout(1800)
    pg.add_style_tag(content='#toasts{display:none!important}')
    pg.click('[data-ins=race]'); pg.wait_for_timeout(300)
    pg.fill('#ed-title','Dragoneel Born'); pg.fill('#rc-speed','30 feet'); pg.fill('#rc-asi','Your Constitution score increases by 2.')
    pg.fill('#rc-rows .hb-n','Scaled Hide'); pg.locator('#rc-rows .rtedit').click(); pg.keyboard.type('Your AC is 12 + Dex.')
    pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(1800)
    rid=pg.evaluate("[...S.entries].find(([k,v])=>v.type==='race')[0]")
    pg.goto('http://localhost:8765/index.html#entry-'+rid); pg.wait_for_timeout(500); pg.screenshot(path='race-page.png')
    pg.goto('http://localhost:8765/index.html#char-cdraeden'); pg.wait_for_timeout(500); pg.click('[data-act=cedit]'); pg.wait_for_timeout(300)
    pg.select_option('#fill-race','hb:'+rid); pg.wait_for_timeout(300); print(pg.locator('.srdfill button').inner_text())
    pg.click('[data-act=srdfill]'); pg.wait_for_timeout(300)
    print([ (f['name'],f.get('note')) for f in pg.evaluate("S.chars.get('cdraeden').features") if f.get('source') in ('Race','Class')][-12:])
    b.close()
print('ERRORS',errs)
