// ---------- Local folder mode (the copy that lives in your DnDCodex folder) ----------
// Mimics the small part of the online database the app uses, but keeps everything in
// library.json (same format as an exported library file) and pictures in images/.
// SERVER: the page is served by server.js from the DnDCodex folder, and every device on the network shares it live.
const SERVER = !!window.__CODEX_SERVER && !window.__CODEX_DATA;
// GH: the web version (GitHub Pages). The library lives on this device and syncs with a private GitHub repository.
const GH = !!window.__CODEX_GH && !SERVER && !window.__CODEX_DATA;
const LOCAL = (!!window.__CODEX_LOCAL || SERVER || GH) && !window.__CODEX_DATA;
const LF = { dir: null, store: new Map(), subs: [], saveTimer: null, saving: false, dirty: false, lastError: "" };

function lfSnapDoc(path) {
  const d = LF.store.get(path);
  return { id: path.split("/").pop(), exists: !!d, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } };
}
function lfNotify() { setTimeout(() => LF.subs.forEach(f => f()), 0); }
function lfColl(cpath) {
  const depth = cpath.split("/").length + 1;
  return {
    path: cpath,
    doc: id => lfDoc(cpath + "/" + (id || ("d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)))),
    onSnapshot(next) {
      const fire = () => {
        const docs = [...LF.store.keys()].filter(k => k.startsWith(cpath + "/") && k.split("/").length === depth).sort().map(lfSnapDoc);
        next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });
      };
      LF.subs.push(fire); setTimeout(fire, 0); return () => { LF.subs = LF.subs.filter(f => f !== fire); };
    }
  };
}
function lfDoc(path) {
  return {
    path, id: path.split("/").pop(),
    async get() { return lfSnapDoc(path); },
    async set(d) { LF.store.set(path, JSON.parse(JSON.stringify(d))); lfWrote(path); },
    async update(d) {
      if (!LF.store.has(path)) throw { code: "invalid_argument", message: "missing" };
      LF.store.set(path, Object.assign({}, LF.store.get(path), JSON.parse(JSON.stringify(d)))); lfWrote(path);
    },
    async delete() { LF.store.delete(path); lfWrote(path); },
    onSnapshot(next) { const fire = () => next(lfSnapDoc(path)); LF.subs.push(fire); setTimeout(fire, 0); return () => { LF.subs = LF.subs.filter(f => f !== fire); }; },
    collection: p => lfColl(path + "/" + p)
  };
}
const lfDb = { doc: lfDoc, collection: lfColl };

// library.json <-> store
function lfToFile() {
  const pick = prefix => { const o = {}; for (const [k, v] of LF.store) if (k.startsWith(prefix + "/") && k.split("/").length === 2) o[k.split("/")[1]] = v; return o; };
  const meta = LF.store.get("map/meta");
  let towns = [];
  if (meta) for (let k = 0; k < (meta.chunks || 0); k++) { const c = LF.store.get("maptowns/c" + k); if (c && c.importId === meta.importId) towns = towns.concat(c.towns); }
  return { kind: "lore-codex-backup", version: 2, at: new Date().toISOString(), entries: pick("entries"), tags: pick("tags"), books: pick("books"), characters: pick("characters"), encounters: pick("encounters"), vttcamps: pick("vttcamps"), vttpages: pick("vttpages"), vtttokens: pick("vtttokens"), vttfog: pick("vttfog"), vttdraw: pick("vttdraw"), settings: pick("settings"), map: meta ? { meta, towns } : null };
}
function lfFromFile(data) {
  LF.store.clear();
  for (const [col, obj] of [["entries", data.entries], ["tags", data.tags], ["books", data.books], ["characters", data.characters], ["encounters", data.encounters], ["vttcamps", data.vttcamps], ["vttpages", data.vttpages], ["vtttokens", data.vtttokens], ["vttfog", data.vttfog], ["vttdraw", data.vttdraw], ["settings", data.settings]]) for (const [id, v] of Object.entries(obj || {})) LF.store.set(col + "/" + id, v);
  if (data.map && data.map.meta && Array.isArray(data.map.towns)) {
    const importId = data.map.meta.importId || "local", per = 300, chunks = Math.ceil(data.map.towns.length / per);
    for (let k = 0; k < chunks; k++) LF.store.set("maptowns/c" + k, { importId, idx: k, towns: data.map.towns.slice(k * per, (k + 1) * per) });
    LF.store.set("map/meta", Object.assign({}, data.map.meta, { importId, chunks }));
  }
}
function lfChanged() { LF.dirty = true; lfStatus("Saving…"); clearTimeout(LF.saveTimer); LF.saveTimer = setTimeout(lfSave, 500); lfNotify(); }
async function lfSave() {
  if (LF.saving) { clearTimeout(LF.saveTimer); LF.saveTimer = setTimeout(lfSave, 300); return; }
  LF.saving = true; LF.dirty = false;
  try {
    const fh = await LF.dir.getFileHandle("library.json", { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(lfToFile(), null, 1));
    await w.close();
    LF.lastError = ""; lfStatus("Saved");
  } catch (e) { LF.dirty = true; LF.lastError = (e && e.message) || "error"; lfStatus("Not saved: " + LF.lastError, true); }
  LF.saving = false;
}
function lfStatus(text, bad) { const el = document.getElementById("savestate"); if (el) { el.textContent = text; el.classList.toggle("bad", !!bad); } }
window.addEventListener("beforeunload", ev => { if (LOCAL && !GH && (LF.dirty || LF.saving)) { ev.preventDefault(); ev.returnValue = ""; } });

// pictures go into images/ beside the page, so they load straight from disk
const lfAssets = {
  async upload(file) {
    const ext = ((file.name || "").match(/\.(png|jpe?g|webp|gif)$/i) || [, (file.type || "image/png").split("/")[1]])[1].toLowerCase().replace("jpeg", "jpg");
    const name = Date.now().toString(36) + "-" + (slugify((file.name || "image").replace(/\.[^.]+$/, "")) || "image") + "." + ext;
    const imgs = await LF.dir.getDirectoryHandle("images", { create: true });
    const w = await (await imgs.getFileHandle(name, { create: true })).createWritable();
    await w.write(file); await w.close();
    return { id: name, url: "images/" + name, sizeBytes: file.size, contentType: file.type };
  }
};
async function lfReadImage(path) {
  if (SERVER || GH) return await (await fetch(path)).blob();
  const name = path.replace(/^images\//, "");
  const imgs = await LF.dir.getDirectoryHandle("images");
  return await (await imgs.getFileHandle(name)).getFile();
}
const lfDownloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: filename });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        return { status: "saved" };
      } catch (e) { if (e && e.name === "AbortError") throw { code: "declined" }; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    return { status: "saved" };
  }
};

// remember the folder between visits (the browser still asks once per visit to allow edits)
function lfIdb() { return new Promise((res, rej) => { const r = indexedDB.open("dnd-codex", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function lfRemember(handle) { try { const db = await lfIdb(); db.transaction("kv", "readwrite").objectStore("kv").put(handle, "dir"); } catch (e) {} }
async function lfRecall() { try { const db = await lfIdb(); return await new Promise(res => { const q = db.transaction("kv").objectStore("kv").get("dir"); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }

function lfSetupScreen(html) { $("#main").innerHTML = `<section class="narrow setup"><h1>DnD Codex</h1>${html}</section>`; }
async function localBoot() {
  if (SERVER) { srvBoot(); return; }
  if (GH) { ghmBoot(); return; }
  if (!window.showDirectoryPicker) {
    lfSetupScreen(`<p>This copy of the codex saves into a folder on your computer, which needs <strong>Chrome</strong> or <strong>Microsoft Edge</strong>. Open this file in one of those browsers.</p>`);
    return;
  }
  const saved = await lfRecall();
  lfSetupScreen(saved
    ? `<p class="muted">Your codex lives in the <strong>${esc(saved.name)}</strong> folder. Your browser asks once each visit before the page can save there.</p>
       <div class="row"><button class="btn" data-act="lfopen">Open my codex</button><button class="btn ghost" data-act="lfpick">Use a different folder</button></div>`
    : `<p class="muted">Pick the folder this file is in (your DnDCodex folder). The codex saves everything there as <code>library.json</code>, with pictures in an <code>images</code> folder, and OneDrive keeps it in step between your computers.</p>
       <div class="row"><button class="btn" data-act="lfpick">Choose my DnDCodex folder</button></div>`);
}
async function lfUseFolder(handle) {
  let perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") perm = await handle.requestPermission({ mode: "readwrite" });
  if (perm !== "granted") { toast("The codex needs permission to save in that folder.", "bad"); return; }
  LF.dir = handle; lfRemember(handle);
  let data = null;
  try { const f = await (await handle.getFileHandle("library.json")).getFile(); data = JSON.parse(await f.text()); } catch (e) { data = null; }
  if (!data) {
    lfSetupScreen(`<p>There's no library in <strong>${esc(handle.name)}</strong> yet.</p>
      <p class="muted">To bring over everything from the online codex: open it on claude.ai, click <strong>Export → Export library file</strong>, then load that file here.</p>
      <div class="row"><label class="btn" for="lffirst">Load a library file…</label><input id="lffirst" type="file" accept=".json,application/json" class="sr"><button class="btn ghost" data-act="lfempty">Start an empty codex</button></div>`);
    return;
  }
  // Keep the previous copy each time the codex is opened, in case something goes wrong.
  try { const w = await (await handle.getFileHandle("library.backup.json", { create: true })).createWritable(); await w.write(JSON.stringify(data)); await w.close(); } catch (e) {}
  lfStart(data);
}
function lfStart(data) {
  lfFromFile(data);
  S.assets = GH ? ghmAssets : lfAssets; S.downloads = lfDownloads;
  connectDb(lfDb);
  lfStatus("Saved");
  render();
}
async function lfFirstFile(file) {
  let data; try { data = JSON.parse(await file.text()); } catch (e) { toast("That isn't a codex library file.", "bad"); return; }
  if (!data || data.kind !== "lore-codex-backup") { toast("That isn't a codex library file.", "bad"); return; }
  lfStart(data); lfChanged();
  toast("Library loaded and saved to your folder");
}
document.addEventListener("click", async ev => {
  if (!LOCAL) return;
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act;
  try {
    if (a === "lfpick") { const h = await window.showDirectoryPicker({ id: "dnd-codex", mode: "readwrite" }); await lfUseFolder(h); }
    else if (a === "lfopen") { const h = await lfRecall(); if (h) await lfUseFolder(h); }
    else if (a === "lfempty") { lfStart({ kind: "lore-codex-backup", entries: {}, tags: {}, books: {} }); lfChanged(); }
  } catch (e) { if (!(e && e.name === "AbortError")) toast("Couldn't open that folder (" + ((e && e.message) || "error") + ").", "bad"); }
});
document.addEventListener("change", ev => { if (LOCAL && ev.target.id === "lffirst" && ev.target.files[0]) lfFirstFile(ev.target.files[0]); });


// ---------- Server mode: talk to server.js; changes from other devices arrive as they happen ----------
const SRV = { id: "c" + Math.random().toString(36).slice(2, 10), queue: [], sending: false, es: null, info: null, online: true, inflight: null, held: {} };
function lfWrote(path) {
  if (GH) { ghmChanged(); return; }
  if (!SERVER) { lfChanged(); return; }
  lfNotify();
  SRV.queue = SRV.queue.filter(o => o.path !== path);
  SRV.queue.push({ path, doc: LF.store.has(path) ? LF.store.get(path) : null });
  srvFlush();
}
async function srvFlush() {
  if (SRV.sending || !SRV.queue.length) return;
  SRV.sending = true; lfStatus("Saving…");
  const batch = SRV.queue.slice(); SRV.inflight = new Set(batch.map(o => o.path)); SRV.held = {};
  try {
    const r = await fetch("api/ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: SRV.id, ops: batch }) });
    if (r.status === 401) { location.reload(); return; }
    if (!r.ok) throw new Error("server said " + r.status);
    const out = await r.json().catch(() => ({}));
    if (out.rejected && out.rejected.length) { toast("Players can only change characters. That change wasn't saved.", "bad"); srvLoadAll().then(lfNotify).catch(() => {}); }
    // Anything written again while sending stays queued.
    SRV.queue = SRV.queue.filter(o => !batch.includes(o));
    // Changes others made to the same docs while ours was on its way: whichever the server took last wins.
    let changed = false;
    for (const path of SRV.inflight) {
      if (SRV.queue.some(o => o.path === path)) continue;
      const sv = (out.saved || {})[path], h = SRV.held[path];
      if (h && (!sv || h.seq == null || h.seq > sv.seq)) { if (h.doc) LF.store.set(path, h.doc); else LF.store.delete(path); changed = true; }
      else if (sv && sv.doc) { LF.store.set(path, sv.doc); changed = true; }
    }
    SRV.inflight = null; SRV.held = {}; if (changed) lfNotify();
    lfStatus(SRV.queue.length ? "Saving…" : "Saved");
  } catch (e) { SRV.inflight = null; SRV.held = {}; lfStatus("Not saved yet: can't reach the codex computer. Retrying…", true); setTimeout(() => { SRV.sending = false; srvFlush(); }, 3000); return; }
  SRV.sending = false;
  if (SRV.queue.length) srvFlush();
}
async function srvLoadAll() {
  const r = await fetch("api/all", { cache: "no-store" }); if (!r.ok) throw new Error("server said " + r.status);
  const all = await r.json();
  LF.store.clear();
  for (const [p, d] of Object.entries(all.docs || {})) LF.store.set(p, d);
  for (const o of SRV.queue) { if (o.doc) LF.store.set(o.path, o.doc); else LF.store.delete(o.path); }
  SRV.info = all.info || SRV.info;
  return all;
}
function srvListen() {
  const es = new EventSource("api/events?c=" + SRV.id); SRV.es = es;
  let dropped = false;
  es.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.from === SRV.id) return;
    // Our own change to this doc is on its way: keep this until the server says which came last.
    if (SRV.inflight && SRV.inflight.has(m.path)) { SRV.held[m.path] = m; return; }
    if (SRV.queue.some(o => o.path === m.path)) return; // our own newer change wins
    if (m.doc) LF.store.set(m.path, m.doc); else LF.store.delete(m.path);
    lfNotify();
  };
  es.addEventListener("reload", () => srvLoadAll().then(lfNotify).catch(() => {}));
  es.addEventListener("github", ev => { try { if (SRV.info) SRV.info.github = JSON.parse(ev.data); srvGhRefresh(); } catch (e) {} });
  es.onerror = () => { dropped = true; SRV.online = false; lfStatus("Reconnecting to the codex computer…", true); };
  es.onopen = () => { SRV.online = true; if (dropped) { dropped = false; srvLoadAll().then(() => { lfNotify(); lfStatus("Saved"); srvFlush(); }).catch(() => {}); } };
}
const srvAssets = {
  async upload(file) {
    const r = await fetch("api/upload?name=" + encodeURIComponent(file.name || "image") + "&type=" + encodeURIComponent(file.type || ""), { method: "POST", body: file });
    if (!r.ok) throw { code: r.status === 413 ? "too_large" : r.status === 415 ? "unsupported_type" : "error" };
    return await r.json();
  }
};
async function srvBoot() {
  if (window.__CODEX_ROLE === "ask") { srvChooseRole(); return; }
  lfSetupScreen(`<p class="muted">Opening your codex…</p>`);
  let all;
  try { all = await srvLoadAll(); }
  catch (e) { lfSetupScreen(`<p>Can't reach the computer the codex runs on.</p><p class="muted">Check that <strong>Start DnD Codex</strong> is still running there, and that this device is on the same Wi-Fi. Then reload this page.</p>`); return; }
  if (!LF.store.size && PLAYER) { lfSetupScreen(`<p>The GM hasn't loaded a library yet.</p><p class="muted">Ask them to open the codex on their computer, then reload this page.</p>`); return; }
  if (!LF.store.size) {
    lfSetupScreen(`<p>Your codex folder doesn't have a library yet.</p>
      <p class="muted">To bring over everything from the online codex: open it on claude.ai, go to <strong>Library file</strong>, click <strong>Download library file</strong>, then load that file here. Pictures you uploaded there come along inside the file.</p>
      <div class="row"><label class="btn" for="srvfirst">Load a library file…</label><input id="srvfirst" type="file" accept=".json,application/json" class="sr"><button class="btn ghost" data-act="srvempty">Start an empty codex</button></div>`);
    return;
  }
  srvStart();
}
function srvStart() {
  S.assets = srvAssets; S.downloads = lfDownloads;
  if (PLAYER) document.body.classList.add("readonly", "player");
  const sv = document.getElementById("savestate");
  if (sv && !window.__CODEX_HOST && !document.querySelector(".rolebtn")) sv.insertAdjacentHTML("afterend", `<button type="button" class="rolebtn" data-act="srvrole" title="Sign out and choose again"><span class="rbfull">${PLAYER ? "Player" : "GM"} · switch</span><span class="rbshort">Switch</span></button>`);
  connectDb(lfDb); srvListen(); lfStatus("Saved"); render();
}
async function srvImport(file) {
  let text; try { text = await file.text(); const d = JSON.parse(text); if (!d || d.kind !== "lore-codex-backup") throw 0; } catch (e) { toast("That isn't a codex library file.", "bad"); return; }
  lfSetupScreen(`<p class="muted">Loading your library…</p>`);
  const r = await fetch("api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
  if (!r.ok) { toast("The codex computer couldn't load that file.", "bad"); srvBoot(); return; }
  await srvLoadAll(); srvStart(); toast("Library loaded. Every device on your network now sees it.");
}
document.addEventListener("change", ev => { if (SERVER && ev.target.id === "srvfirst" && ev.target.files[0]) srvImport(ev.target.files[0]); });
document.addEventListener("click", async ev => {
  if (!SERVER) return;
  const el = ev.target.closest("[data-act]"); if (!el) return;
  if (el.dataset.act === "srvempty") { const r = await fetch("api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "lore-codex-backup", entries: {}, tags: {}, books: {} }) }); if (r.ok) { await srvLoadAll(); srvStart(); } }
});
// Where other devices can open it, for the Library file page.
function srvLinksHtml() {
  const urls = (SRV.info && SRV.info.urls) || [], pub = SRV.info && SRV.info.publicUrl, note = SRV.info && SRV.info.funnel;
  const net = pub ? `<div class="srvlinks"><p><strong>From anywhere</strong> (mobile data, a friend's house): players need the player password.</p><p class="srvurl"><a href="${esc(pub)}">${esc(pub)}</a> <button class="btn ghost small" data-act="copyurl" data-v="${esc(pub)}">Copy</button></p>${note ? `<p class="small" style="color:var(--bad)">${esc(note)}</p>` : ""}<p class="muted small">This link works while the Start DnD Codex window is open. Closing it turns the link off.</p></div>`
    : note ? `<div class="srvlinks"><p><strong>From anywhere</strong></p><p class="muted small">${esc(note)}</p></div>` : "";
  return net + (urls.length ? `<div class="srvlinks"><p><strong>Open it on your phone or another computer</strong> on the same Wi-Fi:</p>${urls.map(u => `<p class="srvurl"><a href="${esc(u)}">${esc(u)}</a> <button class="btn ghost small" data-act="copyurl" data-v="${esc(u)}">Copy</button></p>`).join("")}<p class="muted small">Changes made on any device show up on the others straight away. The codex keeps running as long as the Start DnD Codex window stays open on this computer.</p></div>` : "");
}

// ---------- GM or player ----------
function srvChooseRole() {
  document.body.classList.add("readonly", "choosing");
  lfSetupScreen(`<p class="muted">Who's joining?</p>
    <div class="rolepick">
      <div class="rolecard"><h2>🛡 Player</h2><p class="muted">See the world, the books and the bestiary entries the GM has shared, and keep your character sheet up to date.</p>${!window.__CODEX_PLAYER_PW ? `<button class="btn" data-act="srvlogin" data-v="player">Join as a player</button>`
        : window.__CODEX_PLAYER_PW_SET ? `<label><span class="sr">Player password</span><input id="srvppw" type="password" placeholder="Player password" autocomplete="current-password"></label><button class="btn" data-act="srvlogin" data-v="player">Join as a player</button>`
        : `<p class="muted"><strong>Not open to players yet.</strong> The GM needs to set a player password first.</p>`}</div>
      <div class="rolecard"><h2>📜 Game Master</h2>${window.__CODEX_PIN_SET ? `<p class="muted">Everything, including what's hidden from players. Needs the GM password.</p>
        <label><span class="sr">GM password</span><input id="srvpin" type="password" placeholder="GM password" autocomplete="current-password"></label><button class="btn" data-act="srvlogin" data-v="gm">Join as GM</button>`
        : `<p class="muted">To use the GM view on this device, first set a GM password on the computer running the codex: open it there, go to <strong>Library file</strong> and set one.</p>`}</div>
    </div>`);
  const pin = document.getElementById("srvpin"); if (pin) pin.addEventListener("keydown", ev => { if (ev.key === "Enter") document.querySelector('[data-act="srvlogin"][data-v="gm"]').click(); });
  const ppw = document.getElementById("srvppw"); if (ppw) ppw.addEventListener("keydown", ev => { if (ev.key === "Enter") document.querySelector('[data-act="srvlogin"][data-v="player"]').click(); });
}
async function srvLogin(role) {
  const pin = (document.getElementById(role === "gm" ? "srvpin" : "srvppw") || {}).value || "";
  const r = await fetch("api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, pin }) });
  if (r.ok) { location.reload(); return; }
  const e = await r.json().catch(() => ({}));
  toast(e.error === "wrong" ? `That's not the ${role === "gm" ? "GM" : "player"} password.` : e.error === "wait" ? `Too many wrong passwords. Try again in ${e.minutes || 15} minute${e.minutes === 1 ? "" : "s"}.` : e.error === "nopin" ? "Set a GM password on the codex computer first." : e.error === "noplayerpw" ? "The GM hasn't set a player password yet." : "Couldn't sign in.", "bad");
}
// Library file page (GM): the password other devices use for the GM view.
function srvPinHtml() {
  if (PLAYER) return "";
  return `<div class="gmpin"><p><strong>GM password for other devices</strong> <span class="muted small">${window.__CODEX_PIN_SET || (SRV.info && SRV.info.pinSet) ? "Set. Changing it signs other GM devices out." : "Not set yet: other devices can only join as players."}</span></p>
    <div class="row"><label><span class="sr">New GM password</span><input id="srvnewpin" type="password" placeholder="New GM password (4+ characters)" autocomplete="new-password"></label><button class="btn" data-act="srvsetpin">Save password</button></div>
    <p style="margin-top:14px"><strong>Player password</strong> <span class="muted small">${window.__CODEX_PLAYER_PW_SET || (SRV.info && SRV.info.playerPwSet) ? "Set. Changing it signs every player out." : "Not set yet: players can't join from the internet, and join freely on your home Wi-Fi."}</span></p>
    <div class="row"><label><span class="sr">New player password</span><input id="srvnewppw" type="password" placeholder="New player password (4+ characters)" autocomplete="new-password"></label><button class="btn" data-act="srvsetppw">Save password</button></div>
    <p class="muted small">This computer is always the GM. Players see everything except entries and books marked hidden, and can only change characters. Once a player password is set, players need it on your home Wi-Fi too. Five wrong passwords lock that device out for 15 minutes.</p></div>
    <div id="ghsync">${srvGhInner()}</div>`;
}
// ---------- Sync with GitHub (GM): the library and pictures kept in a private repository ----------
function srvGhInner() {
  const g = (SRV.info && SRV.info.github) || {}, host = window.__CODEX_HOST;
  const ago = t => { if (!t) return "never"; const m = Math.round((Date.now() - Date.parse(t)) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(t).toLocaleString(); };
  if (g.connected) return `<div class="gmpin ghsync"><p><strong>Sync with GitHub</strong> <span class="muted small">On: <strong>${esc(g.repo)}</strong></span></p>
    <p class="small">Last sync: <strong>${esc(ago(g.lastSync))}</strong>${g.busy ? " · syncing…" : ""}${g.note && !g.lastError ? ` <span class="muted">(${esc(g.note)})</span>` : ""}</p>
    ${g.lastError ? `<p class="small" style="color:var(--bad)">Last try didn't work: ${esc(g.lastError)}</p>` : ""}
    <div class="row"><button class="btn" data-act="ghsync">Sync now</button>${host ? `<button class="btn ghost small" data-act="ghoff">Turn off</button>` : ""}</div>
    <p class="muted small">Syncs when the codex starts, a minute after changes (at most every 5 minutes during a game), and when you close it. Edits made elsewhere are combined entry by entry; if the same entry was changed in both places, the more recent edit is kept, and a copy of the library from before is saved in backups.</p></div>`;
  return `<div class="gmpin ghsync"><p><strong>Sync with GitHub</strong> <span class="muted small">Off</span></p>
    ${host ? `<p class="muted small">Keep your library and pictures in a <strong>private</strong> GitHub repository, so other computers (and the phone version) can load it without this computer being on.</p>
    <details class="ghhow"><summary>How to make the key</summary><ol class="small">
      <li>On github.com, signed in as you, open <strong>Settings → Developer settings → Personal access tokens → Fine-grained tokens</strong>, then <strong>Generate new token</strong>.</li>
      <li>Name it "DnD Codex", and pick an expiry (a year is fine).</li>
      <li>Repository access: <strong>Only select repositories</strong>, and choose your library repository.</li>
      <li>Permissions: <strong>Contents → Read and write</strong>. Nothing else.</li>
      <li>Generate it, copy it, and paste it below. GitHub only shows it once.</li></ol></details>
    <div class="row"><label><span class="sr">Repository</span><input id="ghrepo" type="text" value="InitialGalaxy/dnd-codex-library" placeholder="owner/repository" autocomplete="off" spellcheck="false"></label></div>
    <div class="row"><label><span class="sr">Key</span><input id="ghtoken" type="password" placeholder="Paste the key (github_pat_…)" autocomplete="off" spellcheck="false"></label><button class="btn" data-act="ghon">Connect</button></div>
    <p class="muted small">The key is kept only on this computer (in codex-config.json) and is only ever sent to GitHub. Other devices and players never see it. The repository must be private.</p>`
      : `<p class="muted small">Set this up on the computer that runs the codex.</p>`}</div>`;
}
function srvGhRefresh() { const box = document.getElementById("ghsync"); if (box) box.innerHTML = srvGhInner(); }
document.addEventListener("click", async ev => {
  if (!SERVER) return;
  const el = ev.target.closest("[data-act]"); if (!el || !/^gh(on|off|sync)$/.test(el.dataset.act)) return;
  const a = el.dataset.act, post = body => fetch("api/github", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json().catch(() => ({})));
  el.disabled = true; const was = el.textContent; el.textContent = a === "ghoff" ? "Turning off…" : a === "ghon" ? "Connecting…" : "Syncing…";
  let r;
  if (a === "ghon") r = await post({ action: "connect", repo: (document.getElementById("ghrepo") || {}).value || "", token: (document.getElementById("ghtoken") || {}).value || "" });
  else if (a === "ghoff") { if (!(await confirmBox("Stop syncing with GitHub? Your library stays on this computer and on GitHub; the key is removed from this computer.", "Turn off"))) { el.disabled = false; el.textContent = was; return; } r = await post({ action: "disconnect" }); }
  else r = await post({ action: "sync" });
  if (SRV.info) SRV.info.github = { connected: r.connected, repo: r.repo, lastSync: r.lastSync, lastError: r.lastError, note: r.note, busy: false };
  if (r.error && !r.connected) toast(r.error, "bad"); else if (r.error) toast("GitHub: " + r.error, "bad"); else if (a !== "ghoff") toast("GitHub: " + (r.note || "done"));
  srvGhRefresh();
});
document.addEventListener("click", async ev => {
  if (!SERVER) return;
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act;
  if (a === "srvlogin") srvLogin(el.dataset.v);
  else if (a === "srvrole") { await fetch("api/logout", { method: "POST" }); location.reload(); }
  else if (a === "srvsetpin") {
    const pin = (document.getElementById("srvnewpin") || {}).value || "";
    if (pin.length < 4) { toast("Use at least 4 characters.", "bad"); return; }
    const r = await fetch("api/gmpin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (r.ok) { window.__CODEX_PIN_SET = true; if (SRV.info) SRV.info.pinSet = true; toast("GM password saved"); render(); } else toast("Couldn't save the password.", "bad");
  }
  else if (a === "srvsetppw") {
    const pin = (document.getElementById("srvnewppw") || {}).value || "";
    if (pin.length < 4) { toast("Use at least 4 characters.", "bad"); return; }
    const r = await fetch("api/playerpw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (r.ok) { window.__CODEX_PLAYER_PW_SET = true; if (SRV.info) { SRV.info.playerPwSet = true; SRV.info.funnel = ""; } toast("Player password saved"); render(); } else toast("Couldn't save the password.", "bad");
  }
});


// ---------- Web version (GitHub Pages): library kept on this device, synced with a private GitHub repository ----------
// IndexedDB "dnd-codex-web" holds: cfg {repo, token, branch}, lib (library file), base (library at last sync),
// pending (pictures not uploaded yet: [name]), lastSync, note. Pictures sit in Cache Storage "codex-images" under
// images/<name>; the service worker (sw.js) fetches missing ones from the repository with the key.
const GHM = { cfg: null, timer: null, busy: null, dirty: false, saveT: null, last: "", note: "", err: "" };
function ghmIdb() { return new Promise((res, rej) => { const r = indexedDB.open("dnd-codex-web", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function ghmGet(k) { const db = await ghmIdb(); return new Promise(res => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result === undefined ? null : q.result); q.onerror = () => res(null); }); }
async function ghmPut(k, v) { const db = await ghmIdb(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); if (v === null) t.objectStore("kv").delete(k); else t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
const GHM_API = window.__CODEX_GH_API || "https://api.github.com"; // tests point this at a stand-in
async function ghmReq(method, url, body, token) {
  const r = await fetch(GHM_API + url, { method, headers: { Authorization: "Bearer " + (token || GHM.cfg.token), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) { const er = new Error((d && d.message) || ("GitHub said " + r.status)); er.status = r.status; throw er; }
  return d;
}
const ghmB64 = str => { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const ghmUnB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), c => c.charCodeAt(0)));
const ghmBlobB64 = blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
// Library file <-> { "entries/abc": {...} }
function ghmDocs(file) { const keep = new Map(LF.store); lfFromFile(file || { entries: {} }); const out = Object.fromEntries(LF.store); LF.store = keep; return out; }
const ghmJ = v => v === undefined ? undefined : JSON.stringify(v);
function ghmSame(a, b) { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; for (const k of ka) if (!(k in b) || ghmJ(a[k]) !== ghmJ(b[k])) return false; return true; }
function ghmMerge(base, local, remote) {
  const out = {}; let fromRemote = 0, clashes = 0;
  for (const k of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
    const b = ghmJ(base[k]), l = ghmJ(local[k]), r = ghmJ(remote[k]); let pick = l;
    if (l === r) pick = l; else if (l === b) { pick = r; fromRemote++; } else if (r === b) pick = l;
    else {
      // Changed in both places: the more recently edited version wins (by its "updated" time); otherwise this side's.
      clashes++; const tl = Date.parse((local[k] || {}).updated || ""), tr = Date.parse((remote[k] || {}).updated || "");
      if (tr > tl) { pick = r; fromRemote++; }
    }
    if (pick !== undefined) out[k] = pick === l ? local[k] : remote[k];
  }
  return { out, fromRemote, clashes };
}
function ghmStatus() {
  const off = !navigator.onLine, when = GHM.last ? (m => m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago")(Math.round((Date.now() - Date.parse(GHM.last)) / 60000)) : "not yet";
  lfStatus(GHM.busy ? "Syncing…" : off ? "Saved on this device (offline)" : GHM.err ? "Saved here · sync didn't work" : GHM.dirty ? "Saved here · syncing soon" : "Synced " + when, !!GHM.err && !off);
  const box = document.getElementById("ghmbox"); if (box) box.innerHTML = ghmPanelInner();
}
async function ghmBoot() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  GHM.cfg = await ghmGet("cfg"); GHM.last = (await ghmGet("lastSync")) || ""; GHM.note = (await ghmGet("note")) || "";
  if (!GHM.cfg) { ghmSetup(); return; }
  const lib = await ghmGet("lib");
  lfStart(lib || { kind: "lore-codex-backup", entries: {}, tags: {}, books: {} });
  ghmStatus(); ghmSync("on open");
  window.addEventListener("online", () => ghmSync("back online"));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && GHM.dirty) ghmSync("on leave"); });
  setInterval(() => { if (navigator.onLine && !GHM.busy) ghmSync("check"); }, 5 * 60000);
}
function ghmSetup(msg) {
  lfSetupScreen(`<p class="muted">This is the web version of your codex. It keeps your library on this device and syncs it with your <strong>private</strong> GitHub repository, so it works on the train too.</p>
    ${msg ? `<p style="color:var(--bad)">${esc(msg)}</p>` : ""}
    <label class="ghmf"><span>Repository</span><input id="ghmrepo" type="text" value="InitialGalaxy/dnd-codex-library" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <label class="ghmf"><span>Key</span><input id="ghmtoken" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <div class="row"><button class="btn" data-act="ghmgo">Open my codex</button></div>
    <details class="ghhow"><summary>How to make the key</summary><ol class="small">
      <li>On github.com open <strong>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</strong>.</li>
      <li>Repository access: <strong>Only select repositories</strong> → your library repository.</li>
      <li>Permissions: <strong>Contents → Read and write</strong>. Nothing else.</li>
      <li>Copy it and paste it above. You can use the same key on your PC.</li></ol></details>
    <p class="muted small">The key is kept only on this device and only sent to GitHub. Without it this page is an empty codex: nobody can see or change your library.</p>`);
  const t = document.getElementById("ghmtoken"); if (t) t.addEventListener("keydown", ev => { if (ev.key === "Enter") document.querySelector("[data-act=ghmgo]").click(); });
}
async function ghmConnect(repo, token) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return "Write the repository as owner/name.";
  if (!token) return "Paste the key from GitHub.";
  let info; try { info = await ghmReq("GET", "/repos/" + repo, null, token); }
  catch (e) { return e.status === 401 ? "GitHub didn't accept that key. Check it was copied in full." : e.status === 404 ? "Couldn't find that repository with this key: check the name, and that the key was given access to it." : "Couldn't reach GitHub (" + e.message + ")."; }
  if (!info.private) return "That repository is public, so anyone could read your library. Make it private first.";
  if (info.permissions && !info.permissions.push) return "That key can't save to the repository. Give it Contents: Read and write.";
  GHM.cfg = Object.assign({ repo, token, branch: info.default_branch || "main" }, GHM_API !== "https://api.github.com" ? { api: GHM_API } : {}); await ghmPut("cfg", GHM.cfg);
  return "";
}
function ghmChanged() {
  lfNotify(); GHM.dirty = true; ghmStatus();
  clearTimeout(GHM.saveT); GHM.saveT = setTimeout(() => ghmPut("lib", lfToFile()).catch(e => lfStatus("Couldn't save on this device: " + e.message, true)), 400);
  clearTimeout(GHM.timer); GHM.timer = setTimeout(() => ghmSync("after changes"), 8000);
}
function ghmSync(why) {
  if (!GHM.cfg) return Promise.resolve();
  if (!navigator.onLine) { ghmStatus(); return Promise.resolve(); }
  if (GHM.busy) { GHM.again = true; return GHM.busy; }
  GHM.busy = ghmSyncOnce(why).then(note => { GHM.err = ""; GHM.note = note; GHM.last = new Date().toISOString(); ghmPut("lastSync", GHM.last); ghmPut("note", note); return note; },
    e => { GHM.err = e.status === 401 ? "GitHub no longer accepts the key (it may have expired). Sign out and add a new one." : e.message; GHM.dirty = true; })
    .then(r => { GHM.busy = null; ghmStatus(); if (GHM.again) { GHM.again = false; ghmSync("again"); } return r; });
  ghmStatus();
  return GHM.busy;
}
async function ghmSyncOnce(why, retry) {
  const R = "/repos/" + GHM.cfg.repo, br = GHM.cfg.branch || "main";
  GHM.dirty = false; clearTimeout(GHM.timer);
  let head; try { head = await ghmReq("GET", R + "/git/ref/heads/" + br); } catch (e) { if (e.status === 404 || e.status === 409) throw new Error("The repository is empty: add a README to it on GitHub first."); throw e; }
  const headSha = head.object.sha, commit = await ghmReq("GET", R + "/git/commits/" + headSha);
  const tree = await ghmReq("GET", R + "/git/trees/" + commit.tree.sha + "?recursive=1");
  const files = new Map((tree.tree || []).filter(t => t.type === "blob").map(t => [t.path, t.sha]));
  let remote = {}, hadLib = false;
  if (files.has("library.json")) { hadLib = true; const b = await ghmReq("GET", R + "/git/blobs/" + files.get("library.json")); remote = ghmDocs(JSON.parse(ghmUnB64(b.content))); }
  const base = ghmDocs(await ghmGet("base")), local = Object.fromEntries(LF.store);
  const { out, fromRemote, clashes } = ghmMerge(base, local, remote);
  if (!ghmSame(out, local)) { LF.store = new Map(Object.entries(out)); lfNotify(); await ghmPut("lib", lfToFile()); }
  const pending = ((await ghmGet("pending")) || []).filter(n => !files.has("images/" + n));
  const needLib = !hadLib || !ghmSame(out, remote);
  let sent = 0;
  if (needLib || pending.length) {
    const entries = [], cache = await caches.open("codex-images");
    if (needLib) { const b = await ghmReq("POST", R + "/git/blobs", { content: ghmB64(JSON.stringify(lfToFile(), null, 1)), encoding: "base64" }); entries.push({ path: "library.json", mode: "100644", type: "blob", sha: b.sha }); }
    for (const n of pending) { const hit = await cache.match(new URL("images/" + n, location.href).href); if (!hit) continue; const b = await ghmReq("POST", R + "/git/blobs", { content: await ghmBlobB64(await hit.blob()), encoding: "base64" }); entries.push({ path: "images/" + n, mode: "100644", type: "blob", sha: b.sha }); sent++; }
    const t = await ghmReq("POST", R + "/git/trees", { base_tree: commit.tree.sha, tree: entries });
    const c = await ghmReq("POST", R + "/git/commits", { message: "Codex sync from the web version (" + why + ")", tree: t.sha, parents: [headSha] });
    try { await ghmReq("PATCH", R + "/git/refs/heads/" + br, { sha: c.sha, force: false }); }
    catch (e) { if ((e.status === 422 || e.status === 409) && !retry) return ghmSyncOnce(why, true); throw e; }
  }
  await ghmPut("pending", []);
  await ghmPut("base", lfToFile());
  const bits = [];
  if (fromRemote) bits.push(fromRemote + " change" + (fromRemote === 1 ? "" : "s") + " from GitHub");
  if (needLib) bits.push("saved to GitHub");
  if (sent) bits.push(sent + " picture" + (sent === 1 ? "" : "s") + " uploaded");
  if (clashes) bits.push(clashes + " entr" + (clashes === 1 ? "y" : "ies") + " changed in both places (kept the newer edit)");
  return bits.join(", ") || "already up to date";
}
async function ghmFirstPull() {
  const R = "/repos/" + GHM.cfg.repo, head = await ghmReq("GET", R + "/git/ref/heads/" + (GHM.cfg.branch || "main"));
  const commit = await ghmReq("GET", R + "/git/commits/" + head.object.sha), tree = await ghmReq("GET", R + "/git/trees/" + commit.tree.sha + "?recursive=1");
  const t = (tree.tree || []).find(x => x.path === "library.json"); if (!t) return null;
  return JSON.parse(ghmUnB64((await ghmReq("GET", R + "/git/blobs/" + t.sha)).content));
}
// Pictures added here: kept in the cache straight away (so they show offline) and uploaded on the next sync.
const ghmAssets = {
  async upload(file) {
    const ext = ((file.name || "").match(/\.(png|jpe?g|webp|gif)$/i) || [, (file.type || "image/png").split("/")[1]])[1].toLowerCase().replace("jpeg", "jpg");
    const name = Date.now().toString(36) + "-" + (slugify((file.name || "image").replace(/\.[^.]+$/, "")) || "image") + "." + ext;
    const cache = await caches.open("codex-images");
    await cache.put(new URL("images/" + name, location.href).href, new Response(file, { headers: { "Content-Type": file.type || "image/" + ext } }));
    const pend = (await ghmGet("pending")) || []; pend.push(name); await ghmPut("pending", pend);
    GHM.dirty = true; clearTimeout(GHM.timer); GHM.timer = setTimeout(() => ghmSync("new picture"), 8000);
    return { id: name, url: "images/" + name, sizeBytes: file.size, contentType: file.type };
  }
};
function ghmPanelInner() {
  if (!GHM.cfg) return "";
  return `<div class="gmpin ghsync"><p><strong>Sync with GitHub</strong> <span class="muted small">${esc(GHM.cfg.repo)}</span></p>
    <p class="small">Last sync: <strong>${esc(GHM.last ? new Date(GHM.last).toLocaleString() : "not yet")}</strong>${GHM.busy ? " · syncing…" : ""}${GHM.note && !GHM.err ? ` <span class="muted">(${esc(GHM.note)})</span>` : ""}</p>
    ${GHM.err ? `<p class="small" style="color:var(--bad)">${esc(GHM.err)}</p>` : ""}${!navigator.onLine ? `<p class="small muted">Offline: changes are saved on this device and sync when you're back online.</p>` : ""}
    <div class="row"><button class="btn" data-act="ghmsync">Sync now</button><button class="btn ghost small" data-act="ghmout">Sign out of this device</button></div>
    <p class="muted small">Your library is kept on this device, so it works offline. It syncs when you open the codex, a few seconds after changes, and when you switch away. If the same entry was changed here and elsewhere, the more recent edit is kept.</p></div>`;
}
document.addEventListener("click", async ev => {
  if (!GH) return;
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act;
  if (a === "ghmgo") {
    el.disabled = true; el.textContent = "Connecting…";
    const err = await ghmConnect((document.getElementById("ghmrepo") || {}).value.trim(), (document.getElementById("ghmtoken") || {}).value.trim());
    if (err) { ghmSetup(err); return; }
    el.textContent = "Downloading your library…";
    // A new device takes the library from GitHub before starting, so it doesn't add its own built-in entries on top.
    if (!(await ghmGet("lib"))) { try { const f = await ghmFirstPull(); if (f) { await ghmPut("lib", f); await ghmPut("base", f); } } catch (e) {} }
    lfStart((await ghmGet("lib")) || { kind: "lore-codex-backup", entries: {}, tags: {}, books: {} });
    await ghmSync("first open"); toast(GHM.err ? "GitHub: " + GHM.err : "Connected: " + GHM.note, GHM.err ? "bad" : "");
    window.addEventListener("online", () => ghmSync("back online"));
  }
  else if (a === "ghmsync") { await ghmSync("by hand"); toast(GHM.err ? "GitHub: " + GHM.err : "GitHub: " + GHM.note, GHM.err ? "bad" : ""); }
  else if (a === "ghmout") {
    const unsynced = GHM.dirty || ((await ghmGet("pending")) || []).length;
    if (!(await confirmBox(unsynced ? "Some changes haven't reached GitHub yet and would be lost. Sign out anyway?" : "Remove your library and key from this device? Everything stays safe on GitHub.", "Sign out"))) return;
    for (const k of ["cfg", "lib", "base", "pending", "lastSync", "note"]) await ghmPut(k, null);
    try { await caches.delete("codex-images"); } catch (e) {}
    location.reload();
  }
});
