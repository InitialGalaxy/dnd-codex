import json
from playwright.sync_api import sync_playwright
exec(open('run16.py').read().split("    pg.goto('http://localhost:8765/index.html#char-csaahan')")[0].replace("with sync_playwright() as p:","p=sync_playwright().start()\nif 1:"))
pg.goto('http://localhost:8765/index.html#items'); pg.wait_for_timeout(1500)
pg.evaluate("""(async()=>{const db=await claude.use('db');
await db.doc('entries/ipothealing').set({title:'Potion of Healing',type:'item',tags:[],body:'You regain 2d4 + 2 hit points.',item:{category:'Potion',base:'',props:[],attune:false,extra:'',rarity:'common',holder:'',lore:'',magical:true,stats:null}});
await db.doc('entries/iwand').set({title:'Wand of Sparks',type:'item',tags:[],body:'Shoots sparks.',item:{category:'Wand',base:'',props:[],attune:false,extra:'',rarity:'uncommon',holder:'',lore:'',magical:true,stats:{cost:'',damage:'1d8',dtype:'fire'}}});
await db.doc('entries/ibomb').set({title:'Thunder Bomb',type:'item',tags:[],body:'Boom.',item:{category:'Trinket',base:'',props:[],attune:false,extra:'',rarity:'',holder:'',lore:'',magical:false,stats:null}});})()""")
pg.wait_for_timeout(400)
# set wand reusable via editor
pg.goto('http://localhost:8765/index.html#entry-iwand'); pg.wait_for_timeout(400); pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
pg.select_option('#it-usetype','reusable'); pg.fill('#it-uses','3'); pg.select_option('#it-recharge','dawn')
pg.locator('.usepanel').screenshot(path='use-editor.png')
pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
print(pg.evaluate("JSON.stringify(window.__store.get('entries/iwand').item.use)"))
pg.locator('.itempage .istats').screenshot(path='use-page.png')
pg.goto('http://localhost:8765/index.html#entry-ibomb'); pg.wait_for_timeout(400); pg.click('[data-act=edit]'); pg.wait_for_timeout(400)
pg.select_option('#it-usetype','reusable'); pg.fill('#it-uses','2'); pg.select_option('#it-recharge','none')
pg.click('form[data-form=entry] button[type=submit]'); pg.wait_for_timeout(500)
pg.goto('http://localhost:8765/index.html#char-csaahan'); pg.wait_for_timeout(400)
pg.click('[data-act=cview][data-v=inv]'); pg.wait_for_timeout(300)
for q,ref,n in [('healing','e:ipothealing',2),('sparks','e:iwand',1),('thunder','e:ibomb',2)]:
  pg.fill('#invq',q); pg.wait_for_timeout(250)
  for i in range(n): pg.click(f'[data-act=invadd][data-v="{ref}"]'); pg.wait_for_timeout(150)
print(pg.evaluate("JSON.stringify(S.chars.get('csaahan').inv.slots)"))
pg.add_style_tag(content='#toasts{display:none!important}'); pg.locator('.equip').screenshot(path='use-inv.png')
pg.click('[data-act=cview][data-v=sheet]'); pg.wait_for_timeout(300)
def use(k):
  pg.click(f'.eqchip:has([data-v="{k}"]) summary'); pg.wait_for_timeout(100)
  pg.click(f'[data-act=cdrink][data-v="{k}"]'); pg.wait_for_timeout(250)
  print(k, pg.evaluate(f"JSON.stringify(S.chars.get('csaahan').inv.slots['{k}']||null)"), '|', pg.evaluate("[...document.querySelectorAll('#toasts > *')].pop()?.textContent"))
use('p1'); use('p1'); use('p1')
use('p2'); use('p2'); use('p2'); use('p2')
use('p0')
pg.add_style_tag(content='#toasts{display:none!important}'); pg.evaluate("document.querySelectorAll('.eqchip').forEach(d=>d.open=false); document.querySelector('.eqchip.potion.spent').open=true"); pg.wait_for_timeout(150); pg.screenshot(path='use-sheet2.png')
pg.locator('.potsec').screenshot(path='use-sheet.png')
pg.click('[data-act=crest][data-v=long]'); pg.wait_for_timeout(200); pg.click('#modal button.btn:not(.ghost)'); pg.wait_for_timeout(300)
print('after long rest', pg.evaluate("JSON.stringify(S.chars.get('csaahan').inv.slots)"))
print(errs)
