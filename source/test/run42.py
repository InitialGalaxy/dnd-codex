import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
docs['entries/cchangelisk']={'title':'Changelisk','type':'creature','tags':[],'body':'','statblock':{'ac':'15 (natural armour)','cha':'10','con':'18','cr':'3','dex':'14','features':'## Traits\n\n***Predator of Kin.*** The Changelisk has advantage on attack rolls against dragon-type creatures.\n\n***Shifting Hide (Reaction, 1/turn).*** When hit by an attack, roll 1d6.\n- It assumes that creature.\n\n## Actions\n\n***Multiattack.*** The Changelisk makes two attacks: one with its Bite and one with its Claw.\n\n***Bite.*** *Melee Weapon Attack:* +5 to hit, reach 5 ft., one target. *Hit:* 9 (2d6 + 3) piercing damage.\n\n***Claw.*** *Melee Weapon Attack:* +5 to hit, reach 5 ft., one target. *Hit:* 7 (1d8 + 3) slashing damage.','hp':'64 (8d8 + 32)','int':'10','prof':'+2','speed':'40 ft., fly 30 ft.','str':'17','subtitle':'Medium dragon (Classic Dragon, Mystery Class), unaligned','wis':'14'}}
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type in('warning','error') and errs.append(m.text))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(5000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    # give Saahan a weapon and a potion in his grid
    pg.evaluate("""(async()=>{const db=await claude.use('db');const c=S.chars.get('csaahan');const w=SRD_EQUIP.find(x=>x.title==='Longsword');const p=SRD_EQUIP.find(x=>/Healer|Potion|Oil|Acid/.test(x.title));const inv={cols:6,rows:4,slots:{}};inv.slots['0']={ref:'s:'+w.id,qty:1};inv.slots['2']={ref:'s:chain-mail',qty:1};inv.slots['3']={ref:'s:shield',qty:1};await db.doc('entries/potheal').set({title:'Potion of Healing',type:'item',tags:['potion'],body:'',item:{category:'Potion',magical:true,rarity:'Common',use:{type:'single',uses:1}}});inv.slots['1']={ref:'e:potheal',qty:2};await db.doc('characters/csaahan').set(Object.assign({},c,{inv,summons:[]}))})()"""); pg.wait_for_timeout(600)
    print(pg.evaluate("JSON.stringify([[...S.entries].filter(([k,e])=>e.type==='item'&&e.item&&e.item.stats&&e.item.stats.damage).map(x=>x[0]).slice(0,3),[...S.entries].filter(([k,e])=>e.type==='item'&&isConsumable(e)).map(x=>x[0]).slice(0,3), S.chars.get('csaahan').inv])"))
    pg.click('[data-act=cview][data-v=sum]'); pg.wait_for_timeout(300)
    pg.fill('#smq', 'Changelisk'); pg.click('[data-act=smadd]'); pg.wait_for_timeout(900)
    pg.fill('.smname', 'Thornbelly'); pg.keyboard.press('Tab'); pg.wait_for_timeout(900)
    pg.fill('[data-smamt]', '9'); pg.click('[data-act=smhp][data-v=dmg]'); pg.wait_for_timeout(900)
    pg.click('.smslot[data-k=r0c0]'); pg.wait_for_timeout(300); 
    if pg.locator('[data-act=smgive]').count(): pg.locator('[data-act=smgive]').first.click(); pg.wait_for_timeout(900)
    for k in ['r0c1','r0c2']:
        pg.click('.smslot[data-k='+k+']'); pg.wait_for_timeout(300)
        pg.locator('[data-act=smgive]').first.click(); pg.wait_for_timeout(900)
    pg.click('.smslot[data-k=r1c0]'); pg.wait_for_timeout(300)
    if pg.locator('[data-act=smgive]').count(): pg.locator('[data-act=smgive]').first.click(); pg.wait_for_timeout(900)
    s=pg.evaluate("JSON.stringify(S.chars.get('csaahan').summons.map(s=>[s.name,s.hp,s.inv]))"); print(s)
    print('char inv', pg.evaluate("JSON.stringify(S.chars.get('csaahan').inv.slots)"))
    pg.screenshot(path='summon2.png', full_page=True)
    pg.locator('.smab').first.click(); pg.wait_for_timeout(200); pg.screenshot(path='summon-ab.png')
    pg.locator('.smab').first.click(); pg.click('.smfull > summary'); pg.wait_for_timeout(200); pg.locator('.smfull').screenshot(path='summon-full.png')
    b.close()
print('ERRORS',errs)
