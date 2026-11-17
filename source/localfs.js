// ---------- Local folder mode (the copy that lives in your DnDCodex folder) ----------
// Mimics the small part of the online database the app uses, but keeps everything in
// library.json (same format as an exported library file) and pictures in images/.
// SERVER: the page is served by server.js from the DnDCodex folder, and every device on the network shares it live.
const SERVER = !!window.__CODEX_SERVER && !window.__CODEX_DATA;
const LOCAL = (!!window.__CODEX_LOCAL || SERVER) && !window.__CODEX_DATA;
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
window.addEventListener("beforeunload", ev => { if (LOCAL && (LF.dirty || LF.saving)) { ev.preventDefault(); ev.returnValue = ""; } });

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
  if (SERVER) return await (await fetch(path)).blob();
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
  S.assets = lfAssets; S.downloads = lfDownloads;
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
const SRV = { id: "c" + Math.random().toString(36).slice(2, 10), queue: [], sending: false, es: null, info: null, online: true };
function lfWrote(path) {
  if (!SERVER) { lfChanged(); return; }
  lfNotify();
  SRV.queue = SRV.queue.filter(o => o.path !== path);
  SRV.queue.push({ path, doc: LF.store.has(path) ? LF.store.get(path) : null });
  srvFlush();
}
async function srvFlush() {
  if (SRV.sending || !SRV.queue.length) return;
  SRV.sending = true; lfStatus("Saving…");
  const batch = SRV.queue.slice();
  try {
    const r = await fetch("api/ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: SRV.id, ops: batch }) });
    if (r.status === 401) { location.reload(); return; }
    if (!r.ok) throw new Error("server said " + r.status);
    const out = await r.json().catch(() => ({}));
    if (out.rejected && out.rejected.length) { toast("Players can only change characters. That change wasn't saved.", "bad"); srvLoadAll().then(lfNotify).catch(() => {}); }
    // Anything written again while sending stays queued.
    SRV.queue = SRV.queue.filter(o => !batch.includes(o));
    lfStatus(SRV.queue.length ? "Saving…" : "Saved");
  } catch (e) { lfStatus("Not saved yet: can't reach the codex computer. Retrying…", true); setTimeout(() => { SRV.sending = false; srvFlush(); }, 3000); return; }
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
  if (sv && !window.__CODEX_HOST && !document.querySelector(".rolebtn")) sv.insertAdjacentHTML("afterend", `<button type="button" class="rolebtn" data-act="srvrole" title="Sign out and choose again">${PLAYER ? "Player" : "GM"} · switch</button>`);
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
    <p class="muted small">Syncs when the codex starts, a minute after changes (at most every 5 minutes during a game), and when you close it. Edits made elsewhere are combined entry by entry; if the same entry was changed in both places, this computer's version is kept, and a copy of the library from before is saved in backups.</p></div>`;
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
