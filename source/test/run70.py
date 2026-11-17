import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
docs['settings/imports']={'imageLinks':True,'avgRule':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1300,'height':1000}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#bestiary'); pg.wait_for_timeout(9000)
    pg.add_style_tag(content='#toasts{display:none!important}')
    def sbsave():
        pg.evaluate("document.querySelector('form[data-form=entry] button[type=submit]').click()"); pg.wait_for_timeout(900)
    for cid in ['cspinclade','cnoxious-darter','cmarshspear']:
        before=pg.evaluate(f"S.entries.get('{cid}').statblock")
        pg.evaluate(f"openEditor('{cid}')"); pg.wait_for_timeout(600)
        print(cid, 'form', pg.evaluate("[sbm_size=document.getElementById('sbm-size').value, document.getElementById('sbm-type').value, document.getElementById('sbm-align').value, document.getElementById('sbm-hdn').value, document.getElementById('sbm-die').value, document.getElementById('sb-speed').value]"))
        print('   prev', pg.inner_text('#sbm-hpprev'))
        if cid=='cspinclade': pg.locator('.sbmeta').screenshot(path='sb-meta.png')
        sbsave()
        after=pg.evaluate(f"S.entries.get('{cid}').statblock")
        print('   changed', {k:(before.get(k),after.get(k)) for k in set(before)|set(after) if before.get(k)!=after.get(k)})
    # new creature
    pg.evaluate("openEditor(null,{type:'creature'})"); pg.wait_for_timeout(600)
    pg.fill('#ed-title','Test Wyrm')
    if pg.locator('#sbm-size').count()==0:
        print('no sb form open; buttons', pg.locator('[data-act]').evaluate_all("els=>els.map(e=>e.dataset.act).filter(a=>/sb/.test(a))"))
    pg.select_option('#sbm-size','Huge'); pg.fill('#sbm-type','dragon (Elder)'); pg.select_option('#sbm-align','__custom'); pg.fill('#sbm-alignc','typically chaotic evil')
    pg.fill('#sb-con','20'); pg.fill('#sbm-hdn','15'); pg.fill('#sb-cr','13'); pg.fill('#sb-ac','18 (natural armour)')
    pg.fill('#sbm-speeds .sbsp-n','40')
    pg.click('[data-act=sbspadd]'); pg.fill('#sbm-speeds .sbsprow >> nth=1 >> .sbsp-n','80'); pg.check('#sbm-speeds .sbsprow >> nth=1 >> .sbsp-hover')
    pg.click('[data-act=sbspadd]'); pg.fill('#sbm-speeds .sbsprow >> nth=2 >> .sbsp-n','40')
    pg.locator('.sbformleft').screenshot(path='sb-form2.png'); pg.locator('.sbprevwrap').screenshot(path='sb-prev.png'); pg.locator('.sbmeta').screenshot(path='sb-meta2.png')
    pg.select_option('#sbm-die','12'); 
    print('custom die prev', pg.inner_text('#sbm-hpprev'))
    pg.select_option('#sbm-die','')
    sbsave()
    nid=pg.evaluate("[...S.entries].find(([k,v])=>v.title==='Test Wyrm')[0]")
    sb=pg.evaluate(f"S.entries.get('{nid}').statblock"); print('new sb', {k:sb.get(k) for k in ['subtitle','hp','speed','exhaust','prof','cr']})
    pg.goto(f'http://localhost:8765/index.html#entry-{nid}'); pg.wait_for_timeout(500)
    pg.locator('.statblock').first.screenshot(path='sb-view.png')
    b.close()
print('ERRORS',errs)
