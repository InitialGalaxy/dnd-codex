// DnD Codex server: run with "node server.js" (or double-click "Start DnD Codex.bat").
// Serves the codex to this computer and to any phone or computer on the same network, and keeps them in sync.
// Everything is saved in this folder: library.json (same format as an exported library file), images/, backups/.
// No installs needed beyond Node.js itself.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto"), { exec } = require("child_process");

const DIR = __dirname;
const LIB = path.join(DIR, "library.json"), IMG = path.join(DIR, "images"), BAK = path.join(DIR, "backups");
const PAGE = path.join(DIR, "DnD Codex.html");
const START_PORT = Number(process.env.PORT || process.argv[2]) || 3210;
// A second door, only reachable from this computer, that Tailscale Funnel points at. Everything that comes in
// through it is treated as coming from the internet: never the GM by default, and passwords are always needed.
const PUBLIC_PORT = Number(process.env.PUBLIC_PORT) || 3290;
const USE_FUNNEL = !/^(0|no|off|false)$/i.test(String(process.env.FUNNEL || "on"));
const KEEP_BACKUPS = 14;
const CONF = path.join(DIR, "codex-config.json");

// ---------- who is connecting: the GM (this computer, or anyone with the GM password) or a player ----------
// Players see everything except entries and books marked hidden, and can only change characters.
let conf = { pinHash: "", playerHash: "", sessions: {} };
try { conf = Object.assign(conf, JSON.parse(fs.readFileSync(CONF, "utf8"))); } catch (e) {}
const saveConf = () => { try { fs.writeFileSync(CONF, JSON.stringify(conf, null, 1)); } catch (e) { console.error("  Couldn't save codex-config.json: " + e.message); } };
const hashPin = pin => crypto.createHash("sha256").update("dnd-codex:" + String(pin)).digest("hex");
// From the internet: anything through the Funnel door. This computer: loopback on the main door only.
const isPublic = req => req.socket.localPort === PUBLIC_PORT;
const isLocal = req => !isPublic(req) && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
// Who's knocking, for counting wrong passwords. Through Funnel the connection comes from Tailscale on this computer,
// which passes the visitor's address along; that header is only trusted on the Funnel door.
const clientAddr = req => isPublic(req) ? (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "internet") : req.socket.remoteAddress;
// Players need the player password from the internet always, and on the home network once one is set.
const playerPwNeeded = req => isPublic(req) || !!conf.playerHash;
const cookie = (req, k) => { const m = String(req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + k + "=([^;]+)")); return m ? decodeURIComponent(m[1]) : ""; };
function roleOf(req) {
  if (isLocal(req)) return "gm";
  const t = cookie(req, "codex_session"), sess = t && conf.sessions[t];
  return sess ? sess.role : "";
}
const PLAYER_SETTINGS = new Set(["harvest", "dictionary", "vttconds", "vttlights"]);
function playerSees(p, doc) {
  const [col, id] = p.split("/");
  if (col === "entries" || col === "books") return !!doc && !doc.hidden;
  if (col === "characters") return !!doc && !doc.hidden;
  if (col === "tags" || col === "map" || col === "maptowns") return true;
  if (col === "settings") return PLAYER_SETTINGS.has(id);
  if (col === "vttcamps") return !!doc;
  // Maps: only the one the party is on, and any the GM has opened to players.
  if (col === "vttpages") return !!doc && vttVisible(id, doc);
  if (col === "vttfog") return !!doc && vttVisible(id);
  if (col === "vtttokens") return !!doc && doc.layer !== "gm" && vttVisible(doc.page);
  if (col === "vttlive") return !!doc && vttVisible(doc.page);
  if (col === "vttdraw") return !!doc && vttVisible(doc.page);
  return false;
}
function vttVisible(pageId, pageDoc) {
  const pg = pageDoc || docs["vttpages/" + pageId]; if (!pg) return false;
  if (pg.open) return true;
  const camp = docs["vttcamps/" + pg.camp]; return !!camp && camp.playerPage === pageId;
}
const vttVisibleSig = () => Object.keys(docs).filter(k => k.startsWith("vttpages/") && vttVisible(k.slice(9))).sort().join(",");
// What a player receives of a doc they may see: tabletop pages lose their GM-layer pictures.
// A shapeshifted token takes its form's size; players may not be able to see the form's entry, so send the size.
const SIZE_SQ = { large: 2, huge: 3, gargantuan: 4 };
function entrySquares(e) { const m = String((e && e.lootSize) || (e && e.statblock && e.statblock.subtitle) || "").match(/\b(tiny|small|medium|large|huge|gargantuan)\b/i); return (m && SIZE_SQ[m[1].toLowerCase()]) || 1; }
function tokenFormId(t) {
  if (typeof t.ref === "string" && t.ref.startsWith("s:")) { const [, cid, sid] = t.ref.split(":"), c = docs["characters/" + cid], sm = c && Array.isArray(c.summons) && c.summons.find(x => x && x.id === sid); return (sm && sm.form) || ""; }
  return typeof t.form === "string" ? t.form : "";
}
function playerCopy(p, doc) {
  if (doc && p.startsWith("vtttokens/")) { const f = tokenFormId(doc), e = f && docs["entries/" + f]; if (e) doc = Object.assign({}, doc, { formSz: entrySquares(e) }); }
  if (doc && p.startsWith("vttcamps/") && Array.isArray(doc.quests) && doc.quests.some(q => q && q.hidden)) doc = Object.assign({}, doc, { quests: doc.quests.filter(q => q && !q.hidden) });
  if (doc && p.startsWith("vttcamps/") && doc.init && Array.isArray(doc.init.list)) {
    // Turn order: leave out GM-only tokens, so hidden monsters don't give themselves away.
    const hide = e => e && e.tok && (!docs["vtttokens/" + e.tok] || docs["vtttokens/" + e.tok].layer === "gm");
    const list = doc.init.list.filter(e => !hide(e)), cur = list.some(e => e.id === doc.init.cur) ? doc.init.cur : "";
    return Object.assign({}, doc, { init: Object.assign({}, doc.init, { list, cur }) });
  }
  // A token for a hidden character sheet (an NPC): players get its picture and hit points, never the sheet.
  if (doc && p.startsWith("vtttokens/") && typeof doc.ref === "string" && doc.ref.startsWith("c:")) {
    const c = docs["characters/" + doc.ref.slice(2)];
    if (!c || c.hidden) { const hp = c && c.hp || {}; return Object.assign({}, doc, { npc: c ? { img: c.token || c.image || "", hp: { cur: Number(hp.cur) || 0, max: Number(hp.max) || 0, temp: Number(hp.temp) || 0 } } : { img: "", hp: null } }); }
  }
  // A token for a hidden bestiary entry (a secret monster, or an NPC's own entry): just its picture, and the size and
  // Constitution its Exhaust Meter is worked out from.
  if (doc && p.startsWith("vtttokens/") && typeof doc.ref === "string" && doc.ref.startsWith("e:")) {
    const e = docs["entries/" + doc.ref.slice(2)];
    if (!e || e.hidden) { const sb = e && e.statblock || {}; return Object.assign({}, doc, { npc: { img: e ? e.token || e.image || "" : "", sb: { subtitle: String(sb.subtitle || "").split(/[,(]/)[0].trim(), con: sb.con || "", exhaust: sb.exhaust || "" } } }); }
  }
  if (!doc || !p.startsWith("vttpages/")) return doc;
  return Object.assign({}, doc, { objs: (doc.objs || []).filter(o => o && o.layer !== "gm"), walls: (doc.walls || []).map(w => Array.isArray(w) && w[5] && w[5].secret ? w.slice(0, 5) : w) });
}
const PLAYER_COLS = ["entries", "books", "tags", "characters", "map", "maptowns", "settings", "vttcamps", "vttpages", "vtttokens", "vttfog", "vttlive", "vttdraw"];
// Doodles: players may add drawings on a map they can see, and rub any of them out.
function playerDraw(p, doc) {
  if (!/^vttdraw\/[A-Za-z0-9_-]{1,40}$/.test(p)) return false;
  const old = docs[p];
  if (!doc) return !!old && vttVisible(old.page);
  if (old) return false;
  return typeof doc.page === "string" && vttVisible(doc.page) && Array.isArray(doc.pts) && doc.pts.length <= 4000 && JSON.stringify(doc).length < 120000 && !doc.gm;
}
// Live measurements and pings: one small doc per device, never saved to the library. Players can't pull the view.
function playerLive(p, doc) {
  if (!/^vttlive\/[A-Za-z0-9_-]{1,40}$/.test(p)) return false;
  if (!doc) return true;
  if (JSON.stringify(doc).length > 3000 || doc.gm || (doc.ping && doc.ping.pull) || typeof doc.page !== "string" || !vttVisible(doc.page)) return false;
  return true;
}
// Players may move a token that a character controls (only its position changes) and add to what's been explored.
function playerTokenMove(p, doc) {
  if (!/^vtttokens\/[A-Za-z0-9_.-]+$/.test(p)) return false;
  const old = docs[p]; if (!old || !old.owner || old.layer === "gm" || !doc) return false;
  if (!docs["characters/" + old.owner] || docs["characters/" + old.owner].hidden) return false;
  const keys = new Set([...Object.keys(old), ...Object.keys(doc)]);
  for (const k of keys) if (k !== "x" && k !== "y" && k !== "fly" && k !== "lvl" && k !== "conds" && k !== "light" && JSON.stringify(old[k]) !== JSON.stringify(doc[k])) return false;
  if (doc.conds !== undefined && !(Array.isArray(doc.conds) && doc.conds.length <= 200 && doc.conds.every(c => c && typeof c.c === "string" && c.c.length < 60 && Number.isFinite(c.n) && Object.keys(c).length <= 2))) return false;
  if (doc.light != null && !(typeof doc.light === "object" && JSON.stringify(doc.light).length < 300 && Number.isFinite(doc.light.bright) && Number.isFinite(doc.light.dim) && doc.light.bright <= 600 && doc.light.dim <= 600)) return false;
  return typeof doc.x === "number" && typeof doc.y === "number" && isFinite(doc.x) && isFinite(doc.y) && vttVisible(old.page);
}
// Players may place and remove their own character's summons ("s:<character>:<summon>") on a map they can see.
function playerSummonToken(p, doc) {
  if (!/^vtttokens\/[A-Za-z0-9_.-]+$/.test(p)) return false;
  const old = docs[p];
  const ok = t => t && typeof t.ref === "string" && t.ref.startsWith("s:") && t.owner && t.ref.split(":")[1] === t.owner && t.layer !== "gm" && vttVisible(t.page) && docs["characters/" + t.owner] && !docs["characters/" + t.owner].hidden;
  if (!doc) return ok(old);
  if (!old) return ok(doc) && typeof doc.x === "number" && typeof doc.y === "number";
  return false;
}
// Players open and close doors: only the open flag of doors that aren't locked or secret changes; everything else stays as the GM has it.
function playerDoorWrite(p, doc) {
  if (!/^vttpages\/[A-Za-z0-9_.-]+$/.test(p) || !doc || !Array.isArray(doc.walls)) return null;
  const old = docs[p]; if (!old || !vttVisible(p.slice(9), old)) return null;
  const want = new Map(); doc.walls.forEach(w => { if (Array.isArray(w) && w[5] && typeof w[5].id === "string") want.set(w[5].id, !!w[5].open); });
  let changed = false;
  const walls = (old.walls || []).map(w => { const m = Array.isArray(w) && w[5]; if (!m || m.k !== "door" || m.locked || m.secret || !want.has(m.id) || want.get(m.id) === !!m.open) return w; changed = true; return w.slice(0, 5).concat([Object.assign({}, m, { open: want.get(m.id) })]); });
  return changed ? Object.assign({}, old, { walls }) : null;
}
const playerMayWrite = (p, doc) => /^characters\/[A-Za-z0-9_.-]+$/.test(p) || (/^vttfog\/[A-Za-z0-9_.-]+$/.test(p) && !!doc && typeof doc.bits === "string" && doc.bits.length < 400000) || playerTokenMove(p, doc) || playerSummonToken(p, doc) || playerLive(p, doc) || playerDraw(p, doc);
// Wrong passwords: 5 in 15 minutes locks that address out for 15 minutes; 30 from the internet in total
// in 15 minutes turns internet sign-ins off for 15 minutes (in case someone keeps changing address).
const tries = new Map(), WINDOW = 15 * 60000;
let publicFails = [], publicLockUntil = 0;
function lockedOut(req) {
  const now = Date.now(), t = tries.get(clientAddr(req));
  if (t && t.until > now) return Math.ceil((t.until - now) / 60000);
  if (isPublic(req) && publicLockUntil > now) return Math.ceil((publicLockUntil - now) / 60000);
  return 0;
}
function failed(req) {
  const now = Date.now(), k = clientAddr(req), t = tries.get(k) || { fails: [], until: 0 };
  t.fails = t.fails.filter(x => now - x < WINDOW); t.fails.push(now);
  if (t.fails.length >= 5) { t.until = now + WINDOW; t.fails = []; console.log("  Too many wrong passwords from " + k + ": locked out for 15 minutes."); }
  tries.set(k, t);
  if (isPublic(req)) {
    publicFails = publicFails.filter(x => now - x < WINDOW); publicFails.push(now);
    if (publicFails.length >= 30) { publicLockUntil = now + WINDOW; publicFails = []; console.log("  Lots of wrong passwords from the internet: internet sign-ins paused for 15 minutes."); }
  }
}
setInterval(() => { const now = Date.now(); for (const [k, t] of tries) if (t.until < now && !t.fails.some(x => now - x < WINDOW)) tries.delete(k); }, WINDOW).unref();

// ---------- the library: kept in memory as { "entries/abc": {...} }, saved to library.json ----------
let docs = {};
function fromFile(data) {
  const out = {};
  for (const col of ["entries", "tags", "books", "characters", "encounters", "settings", "vttcamps", "vttpages", "vtttokens", "vttfog", "vttdraw"]) for (const [id, v] of Object.entries((data && data[col]) || {})) out[col + "/" + id] = v;
  if (data && data.map && data.map.meta && Array.isArray(data.map.towns)) {
    const importId = data.map.meta.importId || "local", per = 300, chunks = Math.ceil(data.map.towns.length / per);
    for (let k = 0; k < chunks; k++) out["maptowns/c" + k] = { importId, idx: k, towns: data.map.towns.slice(k * per, (k + 1) * per) };
    out["map/meta"] = Object.assign({}, data.map.meta, { importId, chunks });
  }
  return out;
}
function toFile() {
  const pick = col => { const o = {}; for (const [k, v] of Object.entries(docs)) { const p = k.split("/"); if (p.length === 2 && p[0] === col) o[p[1]] = v; } return o; };
  const meta = docs["map/meta"]; let towns = [];
  if (meta) for (let k = 0; k < (meta.chunks || 0); k++) { const c = docs["maptowns/c" + k]; if (c && c.importId === meta.importId) towns = towns.concat(c.towns); }
  return { kind: "lore-codex-backup", version: 2, at: new Date().toISOString(), entries: pick("entries"), tags: pick("tags"), books: pick("books"), characters: pick("characters"), encounters: pick("encounters"), vttcamps: pick("vttcamps"), vttpages: pick("vttpages"), vtttokens: pick("vtttokens"), vttfog: pick("vttfog"), vttdraw: pick("vttdraw"), settings: pick("settings"), map: meta ? { meta, towns } : null };
}
function load() {
  if (!fs.existsSync(LIB)) { docs = {}; return; }
  const raw = fs.readFileSync(LIB, "utf8");
  try { docs = fromFile(JSON.parse(raw)); }
  catch (e) {
    console.error("\n  library.json couldn't be read (" + e.message + ").");
    console.error("  It has been left as it is. Restore one from the backups folder, or remove it to start fresh.\n");
    process.exit(1);
  }
}
// One dated copy per day, the newest 14 kept.
function dailyBackup() {
  if (!fs.existsSync(LIB)) return;
  fs.mkdirSync(BAK, { recursive: true });
  const name = path.join(BAK, "library-" + new Date().toISOString().slice(0, 10) + ".json");
  if (!fs.existsSync(name)) fs.copyFileSync(LIB, name);
  const all = fs.readdirSync(BAK).filter(f => /^library-\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
  all.slice(0, Math.max(0, all.length - KEEP_BACKUPS)).forEach(f => { try { fs.unlinkSync(path.join(BAK, f)); } catch (e) {} });
}
// Measurements left up by a device that went away disappear after an hour.
setInterval(() => { const now = Date.now(); for (const k of Object.keys(docs)) if (k.startsWith("vttlive/") && now - (docs[k]._at || 0) > 3600000) { delete docs[k]; broadcast({ path: k, doc: null }); } }, 300000).unref();
let saveTimer = null, saving = false, again = false;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); ghSoon(); }
function save() {
  if (saving) { again = true; return; }
  saving = true;
  const text = JSON.stringify(toFile(), null, 1), tmp = LIB + ".tmp";
  try {
    fs.writeFileSync(tmp, text);
    try { fs.renameSync(tmp, LIB); }
    catch (e) { fs.writeFileSync(LIB, text); try { fs.unlinkSync(tmp); } catch (e2) {} } // OneDrive sometimes holds the file open
  } catch (e) { console.error("  Couldn't save library.json: " + e.message + " (will try again)"); setTimeout(scheduleSave, 3000); }
  saving = false;
  if (again) { again = false; scheduleSave(); }
}

// ---------- GitHub sync: the library and its pictures, kept in a private repository ----------
// conf.github = { repo: "owner/name", token, branch, lastSync, lastError, lastSha }. The token stays in codex-config.json
// on this computer and is only ever sent to GitHub. github-base.json is the library as it was at the last sync, so
// changes made here and elsewhere can be combined entry by entry: if both sides changed the same entry, this computer wins.
const GH_BASE = path.join(DIR, "github-base.json"), GH_API = (process.env.GH_API || "https://api.github.com").replace(/\/$/, "");
const ghConf = () => conf.github && conf.github.token && conf.github.repo ? conf.github : null;
let ghTimer = null, ghBusy = null, ghDirty = false;
function ghStatus() { const g = conf.github || {}; return { connected: !!ghConf(), repo: g.repo || "", lastSync: g.lastSync || "", lastError: g.lastError || "", note: g.note || "", busy: !!ghBusy }; }
// After changes settle for a minute, and no more than every five minutes while a game is running (fog of war changes a lot).
function ghSoon(now) {
  if (!ghConf()) return; ghDirty = true; clearTimeout(ghTimer);
  const since = Date.now() - (Date.parse((conf.github || {}).lastSync || "") || 0);
  ghTimer = setTimeout(() => ghSync("after changes"), now ? 1500 : Math.max(60000, 300000 - since));
}
// Same library, whatever order the entries are in.
function ghSame(a, b) { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; for (const k of ka) if (!(k in b) || ghJ(a[k]) !== ghJ(b[k])) return false; return true; }
async function ghReq(method, url, body, token) {
  if (typeof fetch !== "function") throw new Error("GitHub sync needs Node.js 18 or newer: update it from nodejs.org");
  const r = await fetch(GH_API + url, { method, headers: { Authorization: "Bearer " + (token || conf.github.token), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "dnd-codex", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
  if (!r.ok) { const err = new Error((data && data.message) || ("GitHub said " + r.status)); err.status = r.status; throw err; }
  return data;
}
async function ghConnect(repo, token) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return { ok: false, error: "Write the repository as owner/name, e.g. InitialGalaxy/dnd-codex-library." };
  if (!token) return { ok: false, error: "Paste the key (token) from GitHub." };
  let info;
  try { info = await ghReq("GET", "/repos/" + repo, null, token); }
  catch (e) { return { ok: false, error: e.status === 401 ? "GitHub didn't accept that key. Check it was copied in full and hasn't expired." : e.status === 404 ? "Couldn't find that repository with this key. Check the name, and that the key was given access to it." : e.message }; }
  if (!info.private) return { ok: false, error: "That repository is public, so anyone could read your library. Make it private on GitHub first." };
  if (info.permissions && !info.permissions.push) return { ok: false, error: "That key can read the repository but not save to it. Give it Contents: Read and write." };
  conf.github = { repo, token, branch: info.default_branch || "main" }; saveConf();
  try { fs.unlinkSync(GH_BASE); } catch (e) {}
  const r = await ghSync("first link");
  return r.ok ? { ok: true, note: r.note } : r;
}
const ghJ = v => v === undefined ? undefined : JSON.stringify(v);
// Entry-by-entry merge of three versions of the library ({ "entries/abc": {...} } maps).
function ghMerge(base, local, remote) {
  const out = {}; let fromRemote = 0, clashes = 0;
  for (const k of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
    const b = ghJ(base[k]), l = ghJ(local[k]), r = ghJ(remote[k]);
    let pick = l;
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
function ghSync(why) {
  if (!ghConf()) return Promise.resolve({ ok: false, error: "GitHub sync isn't set up." });
  if (ghBusy) { ghDirty = true; return ghBusy; }
  ghBusy = ghSyncOnce(why).catch(e => ({ ok: false, error: e.message })).then(r => {
    ghBusy = null; const g = conf.github; if (!g) return r;
    if (r.ok) { g.lastSync = new Date().toISOString(); g.lastError = ""; g.note = r.note; } else g.lastError = r.error;
    saveConf(); const st = "event: github\ndata: " + JSON.stringify(ghStatus()) + "\n\n"; for (const c of clients) if (c.role === "gm") c.write(st);
    if (r.ok && ghDirty) ghSoon();
    return r;
  });
  return ghBusy;
}
async function ghSyncOnce(why, retry) {
  const g = conf.github, R = "/repos/" + g.repo, br = g.branch || "main";
  ghDirty = false;
  // 1. What's on GitHub now.
  let head;
  try { head = await ghReq("GET", R + "/git/ref/heads/" + br); }
  catch (e) { if (e.status === 404 || e.status === 409) throw new Error("The repository is empty. On GitHub, add a README to it first, then sync again."); throw e; }
  const headSha = head.object.sha, commit = await ghReq("GET", R + "/git/commits/" + headSha);
  const tree = await ghReq("GET", R + "/git/trees/" + commit.tree.sha + "?recursive=1");
  const files = new Map((tree.tree || []).filter(t => t.type === "blob").map(t => [t.path, t.sha]));
  let remote = {}, remoteFile = null;
  if (files.has("library.json")) {
    const blob = await ghReq("GET", R + "/git/blobs/" + files.get("library.json"));
    remoteFile = JSON.parse(Buffer.from(blob.content, "base64").toString("utf8"));
    // Pictures packed into the file (from an export or the web version) become files in images/, named as they'd be here.
    remote = unpackImages(fromFile(remoteFile));
  }
  // 2. Combine with what's here.
  let base = {}; try { base = fromFile(JSON.parse(fs.readFileSync(GH_BASE, "utf8"))); } catch (e) {}
  const local = fromFile(toFile());
  const { out, fromRemote, clashes } = ghMerge(base, local, remote);
  const live = Object.fromEntries(Object.entries(docs).filter(([k]) => k.startsWith("vttlive/")));
  const changedHere = !ghSame(out, local);
  if (changedHere) {
    if (fs.existsSync(LIB)) { fs.mkdirSync(BAK, { recursive: true }); fs.copyFileSync(LIB, path.join(BAK, "library-before-sync-" + new Date().toISOString().slice(0, 10) + ".json")); }
    docs = Object.assign({}, out, live); clearTimeout(saveTimer); save(); broadcast({}, "reload");
  }
  // Pictures: fetch ones only GitHub has, send ones only this computer has.
  fs.mkdirSync(IMG, { recursive: true });
  const localImgs = new Set(fs.readdirSync(IMG).filter(f => !f.startsWith(".")));
  let got = 0;
  for (const [pth, sha] of files) {
    if (!pth.startsWith("images/") || pth.split("/").length !== 2) continue;
    const name = pth.slice(7); if (localImgs.has(name) || !/^[A-Za-z0-9._-]+$/.test(name)) continue;
    const b = await ghReq("GET", R + "/git/blobs/" + sha); fs.writeFileSync(path.join(IMG, name), Buffer.from(b.content, "base64")); localImgs.add(name); got++;
  }
  const newImgs = [...localImgs].filter(n => !files.has("images/" + n) && /^[A-Za-z0-9._-]+$/.test(n));
  const needLib = !remoteFile || !ghSame(fromFile(toFile()), remote);
  let sent = 0;
  if (needLib || newImgs.length) {
    // 3. One commit with the library and any new pictures.
    const entries = [];
    if (needLib) { const b = await ghReq("POST", R + "/git/blobs", { content: Buffer.from(JSON.stringify(toFile(), null, 1)).toString("base64"), encoding: "base64" }); entries.push({ path: "library.json", mode: "100644", type: "blob", sha: b.sha }); }
    for (const n of newImgs) { const b = await ghReq("POST", R + "/git/blobs", { content: fs.readFileSync(path.join(IMG, n)).toString("base64"), encoding: "base64" }); entries.push({ path: "images/" + n, mode: "100644", type: "blob", sha: b.sha }); sent++; }
    const t = await ghReq("POST", R + "/git/trees", { base_tree: commit.tree.sha, tree: entries });
    const c = await ghReq("POST", R + "/git/commits", { message: "Codex sync (" + why + ")" + (sent ? ", " + sent + " picture" + (sent === 1 ? "" : "s") : ""), tree: t.sha, parents: [headSha] });
    try { await ghReq("PATCH", R + "/git/refs/heads/" + br, { sha: c.sha, force: false }); }
    catch (e) {
      // Someone else saved in the meantime: start again from their version (once).
      if ((e.status === 422 || e.status === 409) && !retry) return ghSyncOnce(why, true);
      throw e;
    }
  }
  fs.writeFileSync(GH_BASE, JSON.stringify(toFile()));
  const bits = [];
  if (fromRemote) bits.push(fromRemote + " change" + (fromRemote === 1 ? "" : "s") + " from GitHub");
  if (needLib) bits.push("saved to GitHub");
  if (got) bits.push(got + " picture" + (got === 1 ? "" : "s") + " downloaded");
  if (sent) bits.push(sent + " picture" + (sent === 1 ? "" : "s") + " uploaded");
  if (clashes) bits.push(clashes + " entr" + (clashes === 1 ? "y" : "ies") + " changed in both places (kept the newer edit)");
  return { ok: true, note: bits.length ? bits.join(", ") : "already up to date", fromRemote, clashes };
}

// ---------- pictures: data: URLs inside saved documents are written to images/ and replaced by a link ----------
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif" };
function saveImage(buf, ext, hint) {
  fs.mkdirSync(IMG, { recursive: true });
  const name = (hint ? hint.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40).toLowerCase() + "-" : "") + crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12) + "." + ext;
  const file = path.join(IMG, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return "images/" + name;
}
const DATA_URL = /data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)/g;
function unpackImages(v) {
  if (typeof v === "string") return v.length > 200 && v.includes("data:image/") ? v.replace(DATA_URL, (m, t, b64) => saveImage(Buffer.from(b64, "base64"), EXT["image/" + t] || "png")) : v;
  if (Array.isArray(v)) return v.map(unpackImages);
  if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = unpackImages(x); return o; }
  return v;
}

// ---------- live updates (server-sent events) ----------
const clients = new Set();
// Players only hear about what they're allowed to see; something hidden after they loaded it is removed from their screen.
function broadcast(msg, event) {
  const line = (event ? "event: " + event + "\n" : "") + "data: " + JSON.stringify(msg) + "\n\n";
  let pline = null;
  for (const c of clients) {
    if (c.role !== "player" || event) { c.write(line); continue; }
    if (pline === null) { const [col] = String(msg.path || "").split("/"); pline = PLAYER_COLS.includes(col) ? "data: " + JSON.stringify(playerSees(msg.path, msg.doc) ? Object.assign({}, msg, { doc: playerCopy(msg.path, msg.doc) }) : { path: msg.path, doc: null, from: msg.from }) + "\n\n" : ""; }
    if (pline) c.write(pline);
  }
}
setInterval(() => { for (const c of clients) c.write(": ping\n\n"); }, 25000);
// Tokens for a hidden sheet or entry carry what players may see of it, so they're sent again when it changes.
function npcTokensChanged(ref) {
  if (![...clients].some(c => c.role === "player")) return;
  const sm = ref.startsWith("c:") ? "s:" + ref.slice(2) + ":" : null; // and the character's summons, whose form may have changed
  for (const [k, t] of Object.entries(docs)) if (k.startsWith("vtttokens/") && t && (t.ref === ref || (sm && typeof t.ref === "string" && t.ref.startsWith(sm))) && playerSees(k, t)) {
    const line = "data: " + JSON.stringify({ path: k, doc: playerCopy(k, t) }) + "\n\n";
    for (const c of clients) if (c.role === "player") c.write(line);
  }
}

// ---------- http ----------
function addresses(port) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === "IPv4" && !a.internal && !/^169\.254\./.test(a.address)) out.push("http://" + a.address + ":" + port + "/");
  return out;
}
function readBody(req, limit) {
  return new Promise((res, rej) => {
    const chunks = []; let n = 0;
    req.on("data", c => { n += c.length; if (n > limit) { rej(Object.assign(new Error("too large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => res(Buffer.concat(chunks))); req.on("error", rej);
  });
}
const send = (res, code, body, type) => { res.writeHead(code, { "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const MIME = { ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".json": "application/json", ".ico": "image/x-icon" };
let PORT = START_PORT;

async function handle(req, res) {
  const url = new URL(req.url, "http://x"), p = decodeURIComponent(url.pathname);
  try {
    if (p === "/" || p === "/index.html") {
      if (!fs.existsSync(PAGE)) return send(res, 500, "DnD Codex.html is missing from the folder.", "text/plain");
      let html = fs.readFileSync(PAGE, "utf8");
      const flags = `window.__CODEX_SERVER = true; window.__CODEX_ROLE = ${JSON.stringify(roleOf(req) || "ask")}; window.__CODEX_HOST = ${isLocal(req)}; window.__CODEX_PIN_SET = ${!!conf.pinHash}; window.__CODEX_PLAYER_PW = ${playerPwNeeded(req)}; window.__CODEX_PLAYER_PW_SET = ${!!conf.playerHash};`;
      html = html.replace(/<script id="codex-local">[^<]*<\/script>/, '<script id="codex-local">' + flags + '</script>');
      if (!html.includes("__CODEX_SERVER")) html = html.replace("<title>", '<script id="codex-local">' + flags + '</script><title>');
      return send(res, 200, html, MIME[".html"]);
    }
    if (p === "/api/login" && req.method === "POST") {
      const b = JSON.parse((await readBody(req, 10000)).toString("utf8") || "{}");
      const role = b.role === "gm" ? "gm" : "player";
      const wait = lockedOut(req); if (wait) return send(res, 429, { error: "wait", minutes: wait });
      if (role === "gm") {
        if (!conf.pinHash) return send(res, 403, { error: "nopin" });
        if (hashPin(b.pin) !== conf.pinHash) { failed(req); return send(res, 403, { error: "wrong" }); }
      } else if (playerPwNeeded(req)) {
        if (!conf.playerHash) return send(res, 403, { error: "noplayerpw" });
        if (hashPin("player:" + String(b.pin || "")) !== conf.playerHash) { failed(req); return send(res, 403, { error: "wrong" }); }
      }
      const token = crypto.randomBytes(24).toString("hex");
      conf.sessions[token] = { role, at: new Date().toISOString(), from: isPublic(req) ? "internet" : "home" }; saveConf();
      res.setHeader("Set-Cookie", "codex_session=" + token + "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax" + (isPublic(req) ? "; Secure" : ""));
      console.log("  " + (role === "gm" ? "GM" : "A player") + " signed in" + (isPublic(req) ? " from the internet" : "") + ".");
      return send(res, 200, { ok: true, role });
    }
    if (p === "/api/logout" && req.method === "POST") {
      const t = cookie(req, "codex_session"); if (t && conf.sessions[t]) { delete conf.sessions[t]; saveConf(); }
      res.setHeader("Set-Cookie", "codex_session=; Path=/; Max-Age=0"); return send(res, 200, { ok: true });
    }
    const role = roleOf(req);
    if (p.startsWith("/api/") && !role) return send(res, 401, { error: "choose a role first" });
    if (p === "/api/gmpin" && req.method === "POST") {
      if (role !== "gm") return send(res, 403, { error: "gm only" });
      const b = JSON.parse((await readBody(req, 10000)).toString("utf8") || "{}"), pin = String(b.pin || "");
      if (pin.length < 4) return send(res, 400, { error: "short" });
      conf.pinHash = hashPin(pin);
      // A new password signs out every GM on other devices; players stay signed in.
      for (const [t, sess] of Object.entries(conf.sessions)) if (sess.role === "gm") delete conf.sessions[t];
      saveConf(); return send(res, 200, { ok: true });
    }
    if (p === "/api/playerpw" && req.method === "POST") {
      if (role !== "gm") return send(res, 403, { error: "gm only" });
      const b = JSON.parse((await readBody(req, 10000)).toString("utf8") || "{}"), pw = String(b.pin || "");
      if (pw.length < 4) return send(res, 400, { error: "short" });
      conf.playerHash = hashPin("player:" + pw);
      // A new player password signs every player out; they sign in again with the new one.
      for (const [t, sess] of Object.entries(conf.sessions)) if (sess.role === "player") delete conf.sessions[t];
      saveConf(); for (const c of clients) if (c.role === "player") c.write("event: reload\ndata: {}\n\n");
      return send(res, 200, { ok: true });
    }
    if (p === "/api/github") {
      if (role !== "gm") return send(res, 403, { error: "gm only" });
      if (req.method === "GET") return send(res, 200, ghStatus());
      const body = req.method === "POST" ? JSON.parse((await readBody(req, 64 * 1024)).toString("utf8") || "{}") : {};
      if (body.action === "sync") { const r = await ghSync("by hand"); return send(res, r.ok ? 200 : 400, Object.assign(ghStatus(), r)); }
      // Connecting and disconnecting only from this computer itself: the key never travels over the network.
      if (!isLocal(req)) return send(res, 403, { error: "Set up GitHub sync on the computer that runs the codex." });
      if (body.action === "disconnect") { delete conf.github; saveConf(); try { fs.unlinkSync(GH_BASE); } catch (e) {} return send(res, 200, ghStatus()); }
      if (body.action === "connect") { const r = await ghConnect(String(body.repo || "").trim(), String(body.token || "").trim()); return send(res, r.ok ? 200 : 400, Object.assign(ghStatus(), r)); }
      return send(res, 400, { error: "unknown action" });
    }
    if (p === "/api/all" && req.method === "GET") {
      const out = role === "gm" ? docs : Object.fromEntries(Object.entries(docs).filter(([k, d]) => playerSees(k, d)).map(([k, d]) => [k, playerCopy(k, d)]));
      return send(res, 200, { docs: out, info: { urls: addresses(PORT), role, pinSet: !!conf.pinHash, playerPwSet: !!conf.playerHash, publicUrl: role === "gm" ? publicUrl : "", funnel: role === "gm" ? funnelNote : "", github: role === "gm" ? ghStatus() : null } });
    }
    if (p === "/api/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      res.role = role; res.write("retry: 2000\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return;
    }
    if (p === "/api/ops" && req.method === "POST") {
      const body = JSON.parse((await readBody(req, 80 * 1024 * 1024)).toString("utf8")), rejected = [];
      const visBefore = role === "gm" && (body.ops || []).some(o => /^vtt(camps|pages)\//.test(String(o.path))) ? vttVisibleSig() : null;
      for (const op of body.ops || []) {
        if (typeof op.path !== "string" || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(op.path)) continue;
        // Players may only touch characters they can see, and can't hide or unhide one.
        if (role !== "gm" && op.path.startsWith("vttpages/")) { const merged = playerDoorWrite(op.path, op.doc); if (!merged) { rejected.push(op.path); continue; } docs[op.path] = merged; broadcast({ path: op.path, doc: merged, from: body.from }); continue; }
        if (role !== "gm" && (!playerMayWrite(op.path, op.doc) || (docs[op.path] && docs[op.path].hidden))) { rejected.push(op.path); continue; }
        if (role !== "gm" && op.doc) { op.doc = Object.assign({}, op.doc); delete op.doc.hidden; }
        if (op.doc && op.path.startsWith("vttlive/")) op.doc = Object.assign({}, op.doc, { _at: Date.now() });
        if (op.doc) { const d = unpackImages(op.doc); docs[op.path] = d; broadcast({ path: op.path, doc: d, from: body.from }); if (op.path.startsWith("characters/")) npcTokensChanged("c:" + op.path.slice(11)); else if (op.path.startsWith("entries/")) npcTokensChanged("e:" + op.path.slice(8)); }
        else { delete docs[op.path]; broadcast({ path: op.path, doc: null, from: body.from }); }
      }
      // Opening or closing maps to players: their devices reload what they're allowed to see.
      if (visBefore !== null && visBefore !== vttVisibleSig()) for (const c of clients) if (c.role === "player") c.write("event: reload\ndata: {}\n\n");
      if ((body.ops || []).some(o => !String(o.path).startsWith("vttlive/"))) scheduleSave();
      return send(res, 200, { ok: true, rejected });
    }
    if (p === "/api/import" && req.method === "POST") {
      if (role !== "gm") return send(res, 403, { error: "gm only" });
      const data = JSON.parse((await readBody(req, 300 * 1024 * 1024)).toString("utf8"));
      if (!data || data.kind !== "lore-codex-backup") return send(res, 400, { error: "not a library file" });
      if (fs.existsSync(LIB)) { fs.mkdirSync(BAK, { recursive: true }); fs.copyFileSync(LIB, path.join(BAK, "library-before-import-" + Date.now() + ".json")); }
      docs = unpackImages(fromFile(data)); save(); broadcast({}, "reload"); ghSoon(true);
      console.log("  Library loaded: " + Object.keys(docs).filter(k => k.startsWith("entries/")).length + " entries.");
      return send(res, 200, { ok: true });
    }
    if (p === "/api/upload" && req.method === "POST") {
      const type = String(url.searchParams.get("type") || "").toLowerCase(), name = String(url.searchParams.get("name") || "image");
      const ext = EXT[type] || ((name.match(/\.(png|jpe?g|webp|gif)$/i) || [])[1] || "").toLowerCase().replace("jpeg", "jpg");
      if (!ext) return send(res, 415, { error: "unsupported" });
      const buf = await readBody(req, 20 * 1024 * 1024);
      const u = saveImage(buf, ext, name.replace(/\.[^.]+$/, ""));
      return send(res, 200, { id: u.slice(7), url: u, sizeBytes: buf.length, contentType: type });
    }
    // Plain files from the folder: pictures and the spelling dictionary. Nothing outside the folder.
    if (req.method === "GET" && (/^\/images\/[^/\\]+$/.test(p) || p === "/dict-en.txt" || p === "/favicon.ico")) {
      const file = path.join(DIR, p);
      if (!file.startsWith(DIR) || !fs.existsSync(file)) return send(res, 404, "Not found", "text/plain");
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "public, max-age=86400" });
      return fs.createReadStream(file).pipe(res);
    }
    send(res, 404, "Not found", "text/plain");
  } catch (e) { send(res, e.status || 500, { error: e.message }); }
}

load(); dailyBackup();

// ---------- Tailscale Funnel: a public https link to the Funnel door ----------
let publicUrl = "", funnelNote = "";
function tailscaleExe() {
  if (process.platform !== "win32") return "tailscale";
  const pf = path.join(process.env.ProgramFiles || "C:\\Program Files", "Tailscale", "tailscale.exe");
  return fs.existsSync(pf) ? '"' + pf + '"' : "tailscale";
}
function ts(args, timeout) { return new Promise(resolve => exec(tailscaleExe() + " " + args, { timeout: timeout || 20000, windowsHide: true }, (err, out, errOut) => resolve({ err, out: String(out || ""), errOut: String(errOut || "") }))); }
async function startFunnel() {
  if (!USE_FUNNEL) { funnelNote = "Funnel is turned off (FUNNEL=off)."; return; }
  const st = await ts("status --json", 10000);
  if (st.err) { funnelNote = "Tailscale isn't installed or isn't running, so there's no internet link. Home Wi-Fi links still work."; console.log("  " + funnelNote + "\n"); return; }
  let dns = ""; try { dns = String((JSON.parse(st.out).Self || {}).DNSName || "").replace(/\.$/, ""); } catch (e) {}
  console.log("  Turning on the internet link (Tailscale Funnel)...");
  // The first time, Tailscale asks you to approve Funnel in the browser and waits; it carries on by itself once approved.
  const r = await new Promise(resolve => {
    const exe = tailscaleExe().replace(/^"|"$/g, "");
    let out = "", asked = false, done = false;
    const finish = (err) => { if (!done) { done = true; resolve({ err, out, errOut: "" }); } };
    let child;
    try { child = require("child_process").spawn(exe, ["funnel", "--bg", "http://127.0.0.1:" + PUBLIC_PORT], { windowsHide: true }); }
    catch (e) { return finish(e); }
    const onData = d => {
      out += String(d);
      const consent = !asked && (out.match(/https:\/\/login\.tailscale\.com\/\S+/) || [])[0];
      if (consent) {
        asked = true; funnelNote = "Waiting for you to approve Funnel in the page that opened.";
        console.log("\n  Funnel isn't turned on for your Tailscale account yet. A page is opening to turn it on:\n  " + consent + "\n  Approve it there; the codex carries on by itself.\n");
        exec((process.platform === "win32" ? 'start "" ' : process.platform === "darwin" ? "open " : "xdg-open ") + '"' + consent + '"', () => {});
      }
    };
    child.stdout.on("data", onData); child.stderr.on("data", onData);
    child.on("error", e => finish(e));
    child.on("close", code => finish(code ? new Error((out.trim().split("\n").pop() || "exit " + code)) : null));
    const giveUp = msg => { if (done) return; try { child.kill(); } catch (e) {} finish(new Error(msg)); };
    setTimeout(() => { if (!asked) giveUp("Tailscale didn't answer."); else setTimeout(() => giveUp("Funnel wasn't approved within 10 minutes. Restart the codex to try again."), 540000).unref(); }, 60000).unref();
  });
  const text = r.out;
  if (r.err) { funnelNote = "Tailscale couldn't turn on Funnel: " + String(r.err.message || "").trim().split("\n")[0]; console.log("  " + funnelNote + "\n"); return; }
  publicUrl = (text.match(/https:\/\/[a-z0-9.-]+\.ts\.net\S*/i) || [])[0] || (dns ? "https://" + dns + "/" : "");
  if (publicUrl && !publicUrl.endsWith("/")) publicUrl += "/";
  funnelNote = conf.playerHash ? "" : "Set a player password (Library file page) so players can sign in from the internet.";
  console.log("  From anywhere (players need the player password):\n                      " + publicUrl + "\n");
  if (!conf.pinHash || !conf.playerHash) console.log("  Set " + [!conf.playerHash && "a player password", !conf.pinHash && "a GM password"].filter(Boolean).join(" and ") + " on the Library file page before sharing it.\n");
}
let funnelStopped = false;
function stopFunnel() {
  if (!publicUrl || funnelStopped) return; funnelStopped = true;
  try { require("child_process").execSync(tailscaleExe() + " funnel --https=443 off", { timeout: 8000, windowsHide: true, stdio: "ignore" }); } catch (e) {}
}

const server = http.createServer(handle);
server.on("error", e => {
  if (e.code === "EADDRINUSE" && PORT < START_PORT + 10) { PORT++; server.listen(PORT, "0.0.0.0"); }
  else { console.error("  Couldn't start: " + e.message); process.exit(1); }
});
// The Funnel door listens on this computer only, so nobody on the network can reach it directly.
const publicServer = http.createServer(handle);
publicServer.on("error", e => { console.error("  The internet door (port " + PUBLIC_PORT + ") couldn't open: " + e.message + ". Home Wi-Fi still works."); });
server.listen(PORT, "0.0.0.0", () => {
  const n = Object.keys(docs).filter(k => k.startsWith("entries/")).length;
  console.log("\n  DnD Codex is running" + (n ? " (" + n + " entries)" : " (no library yet: load one in the browser)") + ".\n");
  console.log("  On this computer:   http://localhost:" + PORT + "/");
  const lan = addresses(PORT);
  if (lan.length) { console.log("  On your phone or other devices on the same Wi-Fi:"); lan.forEach(u => console.log("                      " + u)); }
  console.log("\n  Keep this window open while you use the codex. Close it (or press Ctrl+C) to stop.\n");
  if (!process.env.NO_BROWSER) exec((process.platform === "win32" ? 'start "" ' : process.platform === "darwin" ? "open " : "xdg-open ") + "http://localhost:" + PORT + "/", () => {});
  publicServer.listen(PUBLIC_PORT, "127.0.0.1", () => { startFunnel(); });
  if (ghConf()) ghSync("on start").then(r => console.log(r.ok ? "  GitHub: " + r.note : "  GitHub sync didn't work: " + r.error));
  // The taskbar launcher reads this to find the server (the port can move up if 3210 is busy).
  try { fs.writeFileSync(path.join(DIR, "codex-port.txt"), String(PORT)); } catch (e) {}
});
// Started from the taskbar launcher (no console window): stop by ourselves once every codex window,
// ours and the players', has been closed for a couple of minutes.
if (process.env.CODEX_AUTOSTOP) {
  let idleSince = Date.now();
  setInterval(() => {
    if (clients.size) { idleSince = Date.now(); return; }
    if (Date.now() - idleSince > 2.5 * 60 * 1000) { console.log("  Every window is closed, so the codex is stopping."); shutdown(); }
  }, 20 * 1000).unref();
}
function shutdown() {
  clearTimeout(saveTimer); try { save(); } catch (e) {} stopFunnel();
  try { fs.unlinkSync(path.join(DIR, "codex-port.txt")); } catch (e) {}
  // Give GitHub a few seconds to take the last changes (Windows allows about five when the window is closed).
  if (ghConf() && ghDirty) { const done = () => process.exit(0); ghSync("on close").then(done, done); setTimeout(done, process.env.CODEX_AUTOSTOP ? 30000 : 4000); return; }
  process.exit(0);
}
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown); process.on("SIGHUP", shutdown); process.on("SIGBREAK", shutdown);
