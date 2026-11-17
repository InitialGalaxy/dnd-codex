import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json')); ch=json.load(open('/home/claude/sheets/chars.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
for k,v in ch.items(): docs['characters/'+k]=v
docs['settings/imports']={'imageLinks':True,'avgRule':True,'dragonWarden':True,'bookEmbeds':'x'}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type in('warning','error') and errs.append(m.text))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#books'); pg.wait_for_timeout(3000)
    print(pg.evaluate("""(()=>{const lines=S.books.get('bpractical-handbooks-in-felling-giants').body.split('\\n');const cl=migTop(lines,'classes');return JSON.stringify([cl, cl&&lines.slice(cl[0],cl[0]+4)])})()"""))
    print(pg.evaluate("""(()=>{const b=S.books.get('bthe-art-of-not-dying-to-a-dragon').body;const i=b.indexOf('DRACONIC');const cell=b.slice(i,b.indexOf('\\n',i));return JSON.stringify(migParseSpell(cell.replace(/\\|\\s*$/,'')))})()"""))
    b.close()
print(errs)
