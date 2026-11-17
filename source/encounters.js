// ---------- Encounter tracker ----------
// encounters/<id> = { name, notes, list: [combatant], round, turn: uid, party: [charIds], size, level, updated }
// combatant = { uid, ref, label, hp, max, temp, init, conds: [], note }   ref "char:<id>" is a party member.
// Older encounters stored mons: [{ ref, n }]; those are expanded into one combatant each when read.
// Difficulty (a small chip) uses the 5e (2014) XP thresholds and the multiplier for the number of monsters.
const ENC = { sel: null, pick: null, amt: {} };
const ENC_CONDS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralysed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious", "Concentrating", "Exhaustion"];
const XP_BY_CR = { "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
const XP_THRESH = {
  easy: [25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800],
  medium: [50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700],
  hard: [75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500],
  deadly: [100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700]
};
const ENC_MULT = [0.5, 1, 1.5, 2, 2.5, 3, 4];
const ENC_DIFF = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["deadly", "Deadly"]];

// XP from the stat block: "3 (700 XP)" wins, otherwise the CR table.
function crXp(cr) {
  const s = String(cr || ""), m = s.match(/\(\s*([\d,]+)\s*XP/i); if (m) return Number(m[1].replace(/,/g, ""));
  const w = firstWord(s); if (!w) return null;
  return XP_BY_CR[w] != null ? XP_BY_CR[w] : XP_BY_CR[String(crNum(w))] != null ? XP_BY_CR[String(crNum(w))] : null;
}
const encList = () => [...(S.encs || new Map())].sort((a, b) => String(b[1].updated || "").localeCompare(String(a[1].updated || "")));
const encUid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const hpOf = sb => { const n = parseInt(firstWord((sb || {}).hp), 10); return isNaN(n) ? 0 : n; };
function encItems(en) {
  if (Array.isArray(en.list)) return en.list;
  const out = [];
  (Array.isArray(en.mons) ? en.mons : []).filter(m => m && m.ref).forEach(m => { const e = S.entries.get(m.ref), n = Math.max(1, Number(m.n) || 1); for (let k = 0; k < n; k++) out.push(encNewMon(m.ref, e, out)); });
  return out;
}
function encNewMon(ref, e, list) {
  const t = e ? e.title : "Creature", same = list.filter(c => c.ref === ref).length, max = hpOf(e && e.statblock);
  return { uid: encUid(), ref, label: t + " " + (same + 1), hp: max, max, temp: 0, init: "", conds: [], note: "" };
}
const isPc = c => String(c.ref || "").startsWith("char:");
// Monsters only, as { ref, n }, for the difficulty maths.
const encMons = en => { const m = new Map(); encItems(en).filter(c => !isPc(c)).forEach(c => m.set(c.ref, (m.get(c.ref) || 0) + 1)); return [...m].map(([ref, n]) => ({ ref, n })); };
// Initiative order: highest first; no initiative yet goes last in the order added.
function encOrder(en) {
  return encItems(en).map((c, i) => ({ c, i })).sort((a, b) => { const x = a.c.init === "" || a.c.init == null, y = b.c.init === "" || b.c.init == null; if (x !== y) return x ? 1 : -1; if (!x && Number(b.c.init) !== Number(a.c.init)) return Number(b.c.init) - Number(a.c.init); return a.i - b.i; }).map(o => o.c);
}
const cbDown = c => !isPc(c) && Number(c.hp) <= 0;
function encParty(en) {
  const ids = (en.party || []).filter(id => S.chars.has(id));
  if (ids.length) return ids.map(id => ({ id, name: S.chars.get(id).name || "Character", level: Math.min(20, Math.max(1, Number(S.chars.get(id).level) || 1)) }));
  const n = Math.max(1, Number(en.size) || 4), l = Math.min(20, Math.max(1, Number(en.level) || 1));
  return Array.from({ length: n }, () => ({ level: l }));
}
function encMath(en) {
  const mons = encMons(en), party = encParty(en);
  let xp = 0, count = 0, noCr = 0;
  mons.forEach(m => { const e = S.entries.get(m.ref), n = Math.max(1, Number(m.n) || 1), x = e && e.statblock ? crXp(e.statblock.cr) : null; count += n; if (x == null) noCr += n; else xp += x * n; });
  let step = count <= 0 ? 1 : count === 1 ? 1 : count === 2 ? 2 : count <= 6 ? 3 : count <= 10 ? 4 : count <= 14 ? 5 : 6;
  if (count && party.length < 3) step = Math.min(6, step + 1); else if (count && party.length >= 6) step = Math.max(0, step - 1);
  const mult = count ? ENC_MULT[step] : 1, adj = Math.round(xp * mult);
  const th = Object.fromEntries(ENC_DIFF.map(([k]) => [k, party.reduce((t, p) => t + XP_THRESH[k][p.level - 1], 0)]));
  let diff = "trivial"; ENC_DIFF.forEach(([k]) => { if (adj >= th[k]) diff = k; });
  return { xp, adj, mult, count, noCr, party, th, diff };
}
const diffLabel = k => k === "trivial" ? "Trivial" : ENC_DIFF.find(d => d[0] === k)[1];

function viewEncounters() {
  if (READONLY) return `<div class="empty">The encounter tracker is only on your own copy.</div>`;
  const list = encList();
  if (!ENC.sel || !S.encs.has(ENC.sel)) ENC.sel = list.length ? list[0][0] : null;
  const en = ENC.sel && S.encs.get(ENC.sel);
  return `<section class="enctrack">
    <div class="enctop"><h1>Encounters</h1>
      ${list.length ? `<label><span class="sr">Encounter</span><select data-encpick>${list.map(([id, e]) => `<option value="${esc(id)}"${id === ENC.sel ? " selected" : ""}>${esc(e.name || "Untitled encounter")} (${encItems(e).length})</option>`).join("")}</select></label>` : ""}
      <button class="btn" data-act="encnew">+ New encounter</button>
      ${en ? `<span class="spacer"></span><button class="btn ghost small" data-act="encdup" data-id="${esc(ENC.sel)}">Duplicate</button><button class="btn ghost small" data-act="encdel" data-id="${esc(ENC.sel)}">Delete</button>` : ""}</div>
    ${en ? encTrackerHtml(ENC.sel, en) : `<div class="empty">Start an encounter, then add the creatures in the fight. Each one gets its own hit points, initiative and conditions, with its stat block a click away.<div class="acts"><button class="btn" data-act="encnew">+ New encounter</button></div></div>`}
  </section>`;
}
function encTrackerHtml(id, en) {
  const order = encOrder(en), m = encMath(en), items = encItems(en);
  const creatures = [...S.entries].filter(([, e]) => e.type === "creature" && e.statblock).sort((a, b) => byName(a[1].title, b[1].title));
  if (!ENC.pick || !items.some(c => c.uid === ENC.pick)) ENC.pick = en.turn && items.some(c => c.uid === en.turn) ? en.turn : (order[0] || {}).uid || null;
  const pick = items.find(c => c.uid === ENC.pick);
  const inParty = new Set(items.filter(isPc).map(c => c.ref.slice(5))), missing = [...S.chars].filter(([cid, ch]) => !ch.hidden && !inParty.has(cid)).map(([cid]) => cid);
  return `<div class="enced" data-enc="${esc(id)}">
    <div class="enchead"><label class="grow"><span class="sr">Encounter name</span><input type="text" class="encname" data-encf="name" value="${esc(en.name || "")}" placeholder="Encounter name"></label>
      ${m.count ? `<span class="encchip" title="${m.xp.toLocaleString()} XP, ${m.adj.toLocaleString()} adjusted for ${m.count} creatures against ${m.party.length} players">${m.adj.toLocaleString()} XP · <b class="encd d-${m.diff}">${diffLabel(m.diff)}</b></span>` : ""}</div>
    <div class="encturn">
      <div class="encround"><span class="vl">Round</span><strong>${Number(en.round) || 0}</strong></div>
      <button class="btn ghost small" data-act="encprev" aria-label="Previous turn">◀</button>
      <button class="btn" data-act="encnext">${en.turn ? "Next turn ▶" : "Start combat ▶"}</button>
      <button class="btn ghost small" data-act="encroll" title="Roll d20 + Dex for every creature without an initiative">🎲 Roll initiative</button>
      ${en.turn || Number(en.round) ? `<button class="btn ghost small" data-act="encend">End combat</button>` : ""}
    </div>
    <div class="encadd"><label class="grow"><span class="sr">Creature from the bestiary</span><input id="encq" type="text" list="enclist" placeholder="Add a creature from the bestiary…" autocomplete="off"></label>
      <datalist id="enclist">${creatures.map(([, e]) => `<option value="${esc(e.title)}">${e.statblock.cr ? "CR " + esc(firstWord(e.statblock.cr)) : ""}</option>`).join("")}</datalist>
      <label><span class="sr">How many</span><input id="encqn" type="number" min="1" max="30" value="1" class="mini" aria-label="How many"></label>
      <button class="btn" data-act="encadd">Add</button>
      ${missing.length ? `<button class="btn ghost" data-act="encparty">+ Add the party</button>` : ""}</div>
    <div class="encgrid">
      <div class="enccombat">${order.length ? order.map(c => cbRowHtml(en, c, c.uid === ENC.pick)).join("") : `<p class="muted">Nobody in this fight yet.</p>`}</div>
      <aside class="encside">${pick ? cbSideHtml(en, pick) : `<p class="muted">Click a creature to see its stat block here.</p>`}</aside>
    </div>
    <h3 class="fgh">Notes</h3>
    <label><span class="sr">Notes</span><textarea data-encf="notes" rows="3" placeholder="Terrain, tactics, treasure…">${esc(en.notes || "")}</textarea></label>
  </div>`;
}
function cbRowHtml(en, c, picked) {
  const pc = isPc(c), ch = pc && S.chars.get(c.ref.slice(5)), e = !pc && S.entries.get(c.ref), sb = (e && e.statblock) || {};
  const max = pc ? Number(ch && ch.hp && ch.hp.max) || 0 : Number(c.max) || 0, cur = pc ? Number(ch && ch.hp && ch.hp.cur) || 0 : Number(c.hp) || 0, temp = pc ? Number(ch && ch.hp && ch.hp.temp) || 0 : Number(c.temp) || 0;
  const pct = max ? Math.max(0, Math.min(100, cur / max * 100)) : 0, down = cbDown(c), bloodied = !pc && max && cur > 0 && cur <= max / 2;
  const ac = pc ? (ch ? (typeof cAC === "function" ? cAC(ch) : ch.ac) : "") : firstWord(sb.ac);
  const conds = (c.conds || []);
  return `<div class="cbt${en.turn === c.uid ? " turn" : ""}${picked ? " picked" : ""}${down ? " down" : ""}${pc ? " pc" : ""}" data-uid="${esc(c.uid)}">
    <label class="cbinit"><span class="sr">Initiative</span><input type="number" data-cbinit="${esc(c.uid)}" value="${esc(c.init == null ? "" : c.init)}" placeholder="–" title="Initiative"></label>
    <button class="cbname" data-act="cbpick" data-uid="${esc(c.uid)}" aria-pressed="${picked}">
      <b>${down ? "☠ " : ""}${esc(c.label || (pc ? (ch && ch.name) : e && e.title) || "Creature")}</b>
      <span class="muted small">${pc ? "Party" : esc(e ? e.title : "Missing creature")}${bloodied ? ` · <span class="bloodied">Bloodied</span>` : ""}</span>
    </button>
    ${ac ? `<span class="cbac" title="Armour Class">🛡 ${esc(ac)}</span>` : ""}
    <div class="cbhp"><div class="cbhpn"><b>${cur}</b><span class="muted">/ ${max}</span>${temp ? `<span class="cbtemp">+${temp}</span>` : ""}</div><div class="cbbar"><i style="width:${pct}%" class="${pct <= 25 ? "low" : pct <= 50 ? "mid" : ""}"></i></div></div>
    ${pc ? `<a class="btn ghost small" href="#char-${esc(c.ref.slice(5))}">Sheet</a>` : `<div class="cbdmg"><label><span class="sr">Amount</span><input type="number" min="0" class="mini" data-cbamt="${esc(c.uid)}" value="${esc(ENC.amt[c.uid] || "")}" placeholder="0"></label><button class="btn small bad" data-act="cbhp" data-v="dmg" data-uid="${esc(c.uid)}">Dmg</button><button class="btn small" data-act="cbhp" data-v="heal" data-uid="${esc(c.uid)}">Heal</button><button class="btn ghost small" data-act="cbhp" data-v="temp" data-uid="${esc(c.uid)}" title="Temporary hit points">Temp</button></div>`}
    <div class="cbconds">${conds.map(k => `<button class="cond" data-act="cbcond" data-uid="${esc(c.uid)}" data-v="${esc(k)}" title="Remove ${esc(k)}">${esc(k)} ✕</button>`).join("")}
      <details class="cbaddc"><summary aria-label="Add a condition">+ Condition</summary><div class="cbclist">${ENC_CONDS.filter(k => !conds.includes(k)).map(k => `<button data-act="cbcond" data-uid="${esc(c.uid)}" data-v="${esc(k)}">${esc(k)}</button>`).join("")}</div></details></div>
    ${!pc && (c.locked || []).length ? `<span class="cblocks">${c.locked.map(k => `<span class="rchchip" title="Used, waiting to recharge">🔒 ${esc(k.replace(/\b\w/g, ch => ch.toUpperCase()))}</span>`).join("")}</span>` : ""}
    <button class="iconbtn cbrm" data-act="cbrm" data-uid="${esc(c.uid)}" aria-label="Remove from the encounter">✕</button>
    ${picked ? `<div class="cbinline">${cbSideHtml(en, c)}</div>` : ""}
  </div>`;
}
function cbSideHtml(en, c) {
  const pc = isPc(c);
  if (pc) { const ch = S.chars.get(c.ref.slice(5)); return `<div class="cbside"><h3>${esc(ch ? ch.name : "Character")}</h3><p class="muted small">${esc(ch ? charSub(ch) : "")}</p><a class="btn" href="#char-${esc(c.ref.slice(5))}">Open sheet</a></div>`; }
  const e = S.entries.get(c.ref), sb = (e && e.statblock) || {};
  if (!e) return `<p class="muted">This creature isn't in the bestiary any more.</p>`;
  return `<div class="cbside">
    <div class="frow"><label class="grow"><span>Name in this fight</span><input type="text" data-cblabel="${esc(c.uid)}" value="${esc(c.label || "")}"></label><label><span>Max HP</span><input type="number" data-cbmax="${esc(c.uid)}" value="${esc(c.max)}"></label></div>
    ${statBlockHtml(Object.assign({}, sb, { hp: `${Number(c.hp) || 0} / ${Number(c.max) || 0}${Number(c.temp) ? ` (+${c.temp} temp)` : ""} · stat block: ${sb.hp || "—"}` }), e.title, "core")}
    ${sb.features ? featuresHtml(sb, c.ref, `cb:${ENC.sel}:${c.uid}`) : ""}
    <label><span>Notes for this one</span><textarea rows="2" data-cbnote="${esc(c.uid)}" placeholder="Marked by the ranger, used its breath…">${esc(c.note || "")}</textarea></label>
    <p><a href="#entry-${esc(c.ref)}" class="small">Open ${esc(e.title)}'s page</a></p>
  </div>`;
}

async function encSave(id, fn, msg) {
  const cur = S.encs.get(id); if (!cur) return;
  const next = JSON.parse(JSON.stringify(cur)); next.list = encItems(cur).map(c => Object.assign({}, c)); delete next.mons;
  fn(next); next.updated = new Date().toISOString();
  S.encs.set(id, next); setTimeout(render);
  await safeWrite(() => S.db.doc("encounters/" + id).set(next), msg);
}
const encBlank = list => ({ name: "New encounter", list: list || [], round: 0, turn: "", party: [...S.chars].filter(([, c]) => !c.hidden).map(([k]) => k), size: 4, level: 1, notes: "", updated: new Date().toISOString() });
async function encCreate(doc, msg) {
  const nid = "enc" + Date.now().toString(36); S.encs.set(nid, doc); ENC.sel = nid; ENC.pick = null; render();
  await safeWrite(() => S.db.doc("encounters/" + nid).set(doc), msg);
  return nid;
}
const encUpd = (uid, fn) => encSave(ENC.sel, en => { en.list = en.list.map(c => c.uid === uid ? (fn(c) || c) : c); });
async function encAction(a, el) {
  const id = ENC.sel, uid = el.dataset.uid;
  if (a === "encnew") { await encCreate(encBlank()); const n = document.querySelector(".encname"); if (n) { n.focus(); n.select(); } }
  else if (a === "encdup") {
    const src = S.encs.get(el.dataset.id); if (!src) return;
    const doc = Object.assign(JSON.parse(JSON.stringify(src)), { name: (src.name || "Encounter") + " (copy)", list: encItems(src).map(c => Object.assign({}, c, { uid: encUid() })), updated: new Date().toISOString(), turn: "", round: 0 }); delete doc.mons;
    await encCreate(doc, "Duplicated");
  } else if (a === "encdel") {
    if (!confirmInline(el)) return;
    const did = el.dataset.id; S.encs.delete(did); ENC.sel = null; render();
    await safeWrite(() => S.db.doc("encounters/" + did).delete(), "Encounter deleted");
  } else if (a === "encadd") {
    const q = ($("#encq") || {}).value || "", n = Math.min(30, Math.max(1, Number(($("#encqn") || {}).value) || 1));
    const hit = [...S.entries].find(([, e]) => e.type === "creature" && e.statblock && e.title.toLowerCase() === q.trim().toLowerCase());
    if (!hit) { toast(q.trim() ? `No creature with a stat block called “${q.trim()}”.` : "Pick a creature first.", "bad"); return; }
    let first = null;
    await encSave(id, en => { for (let k = 0; k < n; k++) { const c = encNewMon(hit[0], hit[1], en.list); if (!first) first = c.uid; en.list.push(c); } });
    ENC.pick = first;
    setTimeout(() => { const q2 = $("#encq"); if (q2) { q2.value = ""; q2.focus(); } });
  } else if (a === "encparty") {
    await encSave(id, en => { const have = new Set(en.list.filter(isPc).map(c => c.ref)); [...S.chars].forEach(([cid, ch]) => { if (!ch.hidden && !have.has("char:" + cid)) en.list.push({ uid: encUid(), ref: "char:" + cid, label: ch.name || "Character", init: "", conds: [] }); }); });
  } else if (a === "cbpick") { ENC.pick = ENC.pick === uid && window.innerWidth < 900 ? null : uid; render(); }
  else if (a === "cbrm") { if (!confirmInline(el)) return; await encSave(id, en => { en.list = en.list.filter(c => c.uid !== uid); if (en.turn === uid) en.turn = ""; }); }
  else if (a === "cbhp") {
    const amt = Math.abs(parseInt(ENC.amt[uid], 10)); if (!amt) { toast("Type an amount first.", "bad"); return; }
    ENC.amt[uid] = "";
    await encUpd(uid, c => { const v = el.dataset.v; let temp = Number(c.temp) || 0, hp = Number(c.hp) || 0;
      if (v === "dmg") { const t = Math.min(temp, amt); temp -= t; hp = Math.max(0, hp - (amt - t)); }
      else if (v === "heal") hp = Math.min(Number(c.max) || hp + amt, hp + amt); else temp = Math.max(temp, amt);
      c.hp = hp; c.temp = temp; if (hp <= 0 && !(c.conds || []).includes("Unconscious")) c.conds = c.conds || []; });
  } else if (a === "cbcond") {
    const k = el.dataset.v; await encUpd(uid, c => { const s = new Set(c.conds || []); s.has(k) ? s.delete(k) : s.add(k); c.conds = [...s]; });
  } else if (a === "encnext" || a === "encprev") {
    const en = S.encs.get(id), order = encOrder(en).filter(c => !cbDown(c)); if (!order.length) return;
    const i = order.findIndex(c => c.uid === en.turn);
    await encSave(id, x => {
      if (i < 0) { x.turn = order[0].uid; x.round = Math.max(1, Number(x.round) || 0); return; }
      let j = i + (a === "encnext" ? 1 : -1), r = Number(x.round) || 1;
      if (j >= order.length) { j = 0; r++; } else if (j < 0) { j = order.length - 1; r = Math.max(1, r - 1); }
      x.turn = order[j].uid; x.round = r;
    });
    ENC.pick = S.encs.get(id).turn;
  } else if (a === "encend") { await encSave(id, x => { x.turn = ""; x.round = 0; }); }
  else if (a === "encroll") {
    let n = 0;
    await encSave(id, en => { en.list.forEach(c => { if (isPc(c) || (c.init !== "" && c.init != null)) return; const e = S.entries.get(c.ref), dx = parseInt(((e && e.statblock) || {}).dex, 10) || 10; c.init = 1 + Math.floor(Math.random() * 20) + Math.floor((dx - 10) / 2); n++; }); });
    toast(n ? `Rolled initiative for ${n} creature${n === 1 ? "" : "s"}. Type the party's rolls in their boxes.` : "Every creature already has an initiative. Clear a box to roll it again.");
  } else if (a === "encto") {
    // From a creature's page: add it to the encounter picked in the select next to the button.
    const sel = el.parentElement.querySelector("select"), eid = sel && sel.value, ref = el.dataset.id, e = S.entries.get(ref);
    if (eid === "__new") { const doc = encBlank(); doc.list.push(encNewMon(ref, e, [])); await encCreate(doc, "Added to a new encounter"); return; }
    if (!eid || !S.encs.has(eid)) return;
    ENC.sel = eid;
    await encSave(eid, en => { en.list.push(encNewMon(ref, e, en.list)); }, `Added to ${S.encs.get(eid).name || "the encounter"}`);
  }
}
// Small control on a creature's page.
function encToHtml(id, e) {
  if (READONLY || !e || e.type !== "creature" || !e.statblock) return "";
  const list = encList();
  return `<span class="encto"><label><span class="sr">Encounter</span><select>${list.map(([eid, en]) => `<option value="${esc(eid)}"${eid === ENC.sel ? " selected" : ""}>${esc(en.name || "Untitled encounter")}</option>`).join("")}<option value="__new">New encounter…</option></select></label><button class="btn ghost" data-act="encto" data-id="${esc(id)}">⚔ Add to encounter</button></span>`;
}
document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.id === "encq") { ev.preventDefault(); const b = document.querySelector('[data-act="encadd"]'); if (b) b.click(); }
  if (ev.key === "Enter" && ev.target.dataset && ev.target.dataset.cbamt) { ev.preventDefault(); const b = ev.target.closest(".cbt").querySelector('[data-v="dmg"]'); if (b) b.click(); } });
document.addEventListener("input", ev => { const t = ev.target; if (t.dataset && t.dataset.cbamt) ENC.amt[t.dataset.cbamt] = t.value; });
document.addEventListener("change", ev => {
  const t = ev.target;
  if (t.matches && t.matches("select[data-encpick]")) { ENC.sel = t.value; ENC.pick = null; render(); return; }
  const box = t.closest && t.closest(".enced"); if (!box) return;
  const id = box.dataset.enc, d = t.dataset;
  if (d.encf) encSave(id, en => { en[d.encf] = d.encf === "name" ? (t.value.trim() || "Untitled encounter") : t.value; });
  else if (d.cbinit) encUpd(d.cbinit, c => { c.init = t.value === "" ? "" : Number(t.value); });
  else if (d.cblabel) encUpd(d.cblabel, c => { c.label = t.value.trim() || c.label; });
  else if (d.cbmax) encUpd(d.cbmax, c => { const n = Math.max(1, Number(t.value) || 1), full = Number(c.hp) >= Number(c.max); c.max = n; c.hp = full ? n : Math.min(Number(c.hp) || 0, n); });
  else if (d.cbnote) encUpd(d.cbnote, c => { c.note = t.value; });
});
