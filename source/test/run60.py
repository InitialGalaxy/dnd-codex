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
    def imp(t, txt):
        pg.evaluate("t=>openEditor(null,{type:t})", t); pg.wait_for_timeout(500)
        pg.click('.imphead [data-act=impopen]'); pg.fill('#imp-paste', txt); pg.click('[data-act=impgo]'); pg.wait_for_timeout(400)
    for txt in ['Goblin\nSmall humanoid (goblinoid), neutral evil\nArmor Class 15 (leather armor, shield)\nHit Points 7 (2d6)\nSpeed 30 ft.\nSTR\n8 (-1)\nDEX\n14 (+2)\nCON\n10 (+0)\nINT\n10 (+0)\nWIS\n8 (-1)\nCHA\n8 (-1)\nSkills Stealth +6\nSenses darkvision 60 ft., passive Perception 9\nLanguages Common, Goblin\nChallenge 1/4 (50 XP)\nNimble Escape. The goblin can take the Disengage or Hide action as a bonus action on each of its turns.\nActions\nScimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.\nShortbow. Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.','Goblin Warrior\nSmall Fey (Goblinoid), Chaotic Neutral\nAC 15     Initiative +2 (12)\nHP 10 (3d6)\nSpeed 30 ft.\nStr 8 −1 −1   Dex 15 +2 +2   Con 10 +0 +0\nInt 10 +0 +0   Wis 8 −1 −1   Cha 8 −1 −1\nSkills Stealth +6\nGear Leather Armor, Scimitar, Shield, Shortbow\nSenses Darkvision 60 ft.; Passive Perception 9\nLanguages Common, Goblin\nCR 1/4 (XP 50; PB +2)\nActions\nScimitar. Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.\nBonus Actions\nNimble Escape. The goblin takes the Disengage or Hide action.']:
        imp('creature', txt)
        sb=pg.evaluate("readSbFields()"); print(pg.input_value('#ed-title'), {k:sb[k] for k in ['subtitle','ac','hp','speed','cr','prof','str','dex','con','int','wis','cha']}); print(sb['details']); print(sb['features'][:400]); print('---')
        pg.locator('fieldset[data-for=creature]', has=pg.locator('#sbsections')).screenshot(path='imp-cr.png')
        pg.evaluate("document.querySelector('[data-act=closemodal]').click()")
    imp('race', 'Half-Orc\nAbility Score Increase. Your Strength score increases by 2, and your Constitution score increases by 1.\nAge. Half-orcs mature a little faster than humans, reaching adulthood around age 14.\nSize. Half-orcs are somewhat larger and bulkier than humans, and they range from 5 to well over 6 feet tall. Your size is Medium.\nSpeed. Your base walking speed is 30 feet.\nDarkvision. Thanks to your orc blood, you have superior vision in dark and dim conditions.\nMenacing. You gain proficiency in the Intimidation skill.\nRelentless Endurance. When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead.')
    print(pg.evaluate("readRaceFields()"), pg.input_value('#ed-body')[:200])
    pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(800)
    pg.locator('main').screenshot(path='imp-race.png')
    b.close()
print('ERRORS',errs)
