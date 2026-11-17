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
    pg.wait_for_timeout(9000)
    print('imports', pg.evaluate("S.imports.bookLib"), 'linked', pg.evaluate("[...S.entries.values()].filter(e=>e.fromBook).map(e=>e.title)"))
    print('backup', pg.evaluate("S.db.doc('settings/backup-booklib').get().then(d=>d.exists?Object.values(d.data().entries).map(x=>x.title):[])"))
    import difflib
    bk=pg.evaluate("S.db.doc('settings/backup-booklib').get().then(d=>d.data().entries)")
    for id,v in list(bk.items())[:4]:
        now=pg.evaluate("id=>S.entries.get(id).body", id)
        a=v['body'].split('\n'); b=now.split('\n')
        d=[l for l in difflib.unified_diff(a,b,lineterm='',n=0) if l[:1] in '+-' and not l.startswith(('+++','---'))]
        print('==', v['title'], len(a), len(b)); print('\n'.join(x[:150] for x in d[:8]))
        if len(a)==len(b):
            for x,y in zip(a,b):
                if x!=y and not x.startswith('#'):
                    k=next(i for i in range(min(len(x),len(y))) if x[i]!=y[i]) if any(x[i]!=y[i] for i in range(min(len(x),len(y)))) else min(len(x),len(y)); print('CHAR', repr(x[k-20:k+30]), '|', repr(y[k-20:k+30])); break
    b.close()
print('ERRORS',errs)
