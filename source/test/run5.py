import json
from playwright.sync_api import sync_playwright
d=json.load(open('../seed-docs.json'))
docs={}
for k,v in d['tags'].items(): docs['tags/'+k]=v
for k,v in d['entries'].items(): docs['entries/'+k]=v
for k,v in d['books'].items(): docs['books/'+k]=v
docs['settings/imports']={'imageLinks':True}
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    # 1) export a library file from the online version
    pg=b.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(path='mockdb.js'); pg.add_init_script(script="window.__seedDocs=%s;"%json.dumps(docs))
    pg.add_init_script(script="(async()=>{const db=await window.claude.use('db');for(const [p,v] of Object.entries(window.__seedDocs))await db.doc(p).set(v);})()")
    pg.goto('http://localhost:8765/index.html#world'); pg.wait_for_timeout(1200)
    pg.set_input_files('#mapfile','/mnt/user-data/uploads/dnd/Dryrones 2026-10-13-18-00.map'); pg.wait_for_function("document.querySelector('table.towns')",timeout=20000)
    pg.click('[data-act=export]'); pg.click('[data-act=dllibrary]'); pg.wait_for_function('window.__saved',timeout=10000)
    lib=pg.evaluate('window.__saved'); open('/tmp/lib.json','w').write(lib['data']); print('library file', lib['filename'], len(lib['data']))
    # 2) local copy
    lp=b.new_page(viewport={'width':1300,'height':900}); lp.on('pageerror',lambda e:errs.append('LOCAL '+str(e)))
    lp.add_init_script(path='fakefs.js')
    lp.goto('http://localhost:8765/DnD%20Codex.html'); lp.wait_for_timeout(500)
    print('setup:', lp.inner_text('main')[:120].replace('\n',' '))
    lp.click('[data-act=lfpick]'); lp.wait_for_timeout(400)
    print('no-lib screen:', 'no library' in lp.inner_text('main').lower())
    lp.set_input_files('#lffirst','/tmp/lib.json'); lp.wait_for_timeout(1500)
    print('saved state', lp.inner_text('#savestate'), 'library.json bytes', lp.evaluate("(window.__fs['library.json']||'').length"))
    lp.evaluate("location.hash='entry-cflame-cutter'"); lp.wait_for_timeout(400)
    print('reopened, title:', lp.inner_text('h1'))
    lp.click('[data-act=togglehide]'); lp.wait_for_timeout(1200)
    saved=json.loads(lp.evaluate("window.__fs['library.json']")); print('hidden saved in library.json:', saved['entries']['cflame-cutter'].get('hidden'), 'towns', len(saved['map']['towns']))
    print('backup exists', 'library.backup.json' in lp.evaluate("Object.keys(window.__fs)"))
    lp.screenshot(path='local-entry.png')
    # image upload through the folder
    lp.evaluate("""async()=>{const blob=await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob(); const f=new File([blob],'dragon art.png',{type:'image/png'}); const r=await S.assets.upload(f); await S.db.doc('entries/cflame-cutter').update({image: assetPath(r)}); window.__img=r.url;}""")
    lp.wait_for_timeout(900); print('image path', lp.evaluate('window.__img'), 'img in page', lp.evaluate("!!document.querySelector('.portrait img')"))
    # read-only export from the local copy excludes hidden
    lp.evaluate("window.__dl=null; S.downloads={save:async({filename,data})=>{window.__dl={filename,data};return {status:'saved'}}}")
    lp.click('[data-act=export]'); lp.wait_for_timeout(200); print('dialog note:', lp.inner_text('.mbox')[:400].replace('\n',' | '))
    lp.click('[data-act=exportro]'); lp.wait_for_function('window.__dl',timeout=10000)
    ro=lp.evaluate('window.__dl.data'); print('RO has flame cutter?', 'cflame-cutter' in ro, 'has local flag?', '__CODEX_LOCAL' in ro, 'has savestate?', 'savestate' in ro)
    open('/tmp/ro2.html','w').write(ro)
    rp=b.new_page(); rp.on('pageerror',lambda e:errs.append('RO '+str(e))); rp.goto('file:///tmp/ro2.html#bestiary'); rp.wait_for_timeout(600)
    print('RO cards', rp.evaluate("document.querySelectorAll('.cards .card').length"), 'readonly class', rp.evaluate("document.body.className"))
    b.close()
print('ERRORS',errs)
