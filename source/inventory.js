// ---------- Inventory: a slot grid per character, filled from codex items and the SRD ----------
// Stored on the character as inv: { cols, rows, slots: { "<index>": { ref: "e:<entryId>" | "s:<srdId>", qty, name } } }
const INV = { q: "", kind: "", sel: null, pick: null, drag: null, pay: { amt: "", unit: "gp", note: "" } };
// ---- coin maths: everything in copper ----
const COIN = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const COIN_ORDER = ["cp", "sp", "ep", "gp", "pp"];
function payCp() { const n = parseFloat(String(INV.pay.amt).replace(",", ".")); return n > 0 ? Math.round(n * COIN[INV.pay.unit]) : 0; }
function coinsText(m) { return ["pp", "gp", "ep", "sp", "cp"].filter(k => m[k]).map(k => `${fmt(m[k])} ${k}`).join(", ") || "nothing"; }
// Work out which coins leave the purse and what change comes back. Uses small coins first,
// then breaks the smallest coin that covers the rest, with change in gp, sp and cp.
// Work out which coins leave the purse and what change comes back, the way you would at a counter:
// pay exactly if the coins allow it, otherwise pay with one kind of coin and take change,
// otherwise pay what you can and break one more coin. Change comes back in gp, sp and cp.
function payPlan(money, cost) {
  if (!cost) return null;
  const have = Object.fromEntries(COIN_ORDER.map(k => [k, Math.max(0, Number(money[k]) || 0)]));
  const total = COIN_ORDER.reduce((t, k) => t + have[k] * COIN[k], 0);
  if (total < cost) return { short: cost - total };
  const giveChange = (left, back) => { const ch = {}; for (const c of ["gp", "sp", "cp"]) { const n = Math.floor(back / COIN[c]); if (n) { ch[c] = n; left[c] += n; back -= n * COIN[c]; } } return ch; };
  // 1. Exact, biggest coins first.
  let out = {}, left = Object.assign({}, have), rem = cost;
  for (const k of [...COIN_ORDER].reverse()) { const n = Math.min(left[k], Math.floor(rem / COIN[k])); if (n) { out[k] = n; left[k] -= n; rem -= n * COIN[k]; } }
  if (!rem) return { out, change: {}, after: left };
  // 2. Enough of one kind of coin to cover the price (2 gp for 1 gp 5 sp), smallest coin first.
  const one = COIN_ORDER.find(k => have[k] * COIN[k] >= cost);
  if (one) { const n = Math.ceil(cost / COIN[one]); left = Object.assign({}, have); left[one] -= n; return { out: { [one]: n }, change: giveChange(left, n * COIN[one] - cost), after: left }; }
  // 3. Pay what fits, then break the smallest coin that covers the rest.
  const k = COIN_ORDER.find(k => left[k] > 0 && COIN[k] > rem);
  out[k] = (out[k] || 0) + 1; left[k] -= 1;
  return { out, change: giveChange(left, COIN[k] - rem), after: left };
}
function payPreview(plan) {
  if (!plan) return "Type an amount, e.g. 2 sp for a meal. Spend works out which coins to hand over and the change.";
  if (plan.short) return `<span class="neg">Not enough coin: short by ${coinsText(splitCp(plan.short))}.</span>`;
  return `Pays <strong>${coinsText(plan.out)}</strong>${Object.keys(plan.change).length ? `, gets <strong>${coinsText(plan.change)}</strong> back` : ""}.`;
}
function splitCp(cp) { const m = {}; for (const k of ["gp", "sp", "cp"]) { const n = Math.floor(cp / COIN[k]); if (n) { m[k] = n; cp -= n * COIN[k]; } } return m; }
const INV_DEFAULT = { cols: 6, rows: 5 };
function invOf(c) { const v = c.inv || {}; return { cols: Number(v.cols) || INV_DEFAULT.cols, rows: Number(v.rows) || INV_DEFAULT.rows, slots: v.slots || {} }; }
// Resolve a reference to something displayable. A codex item that was deleted falls back to its stored name.
function invResolve(ref, name) {
  if (ref && ref.startsWith("e:")) { const id = ref.slice(2), e = S.entries.get(id); if (e) return { ref, id, e, name: e.title, src: "codex" }; }
  if (ref && ref.startsWith("s:")) { const x = SRD_BY_ID.get(ref.slice(2)); if (x) return { ref, e: srdEntry(x), name: x.title, src: "srd", bundle: srdBundle(x) }; }
  // A quick custom item that isn't in the codex: just a name ("n:Flare").
  if (ref && ref.startsWith("n:")) { const nm = ref.slice(2); return { ref, e: { title: nm, type: "item", body: "", item: { category: "", magical: false } }, name: nm, src: "custom" }; }
  return { ref, e: { title: name || "Unknown item", type: "item", item: {} }, name: name || "Unknown item", src: "gone" };
}
function srdBundle(x) { const m = String(x.item.extra || "").match(/bundle of (\d+)/); return m ? Number(m[1]) : 1; }
function invKind(e) { return itemKind(e); }
const INV_ICON = { weapon: "⚔", armour: "🛡", item: "◆" };
function invPlace(c, slot, ref, qty) {
  const inv = invOf(c), slots = Object.assign({}, inv.slots), r = invResolve(ref);
  const cur = slots[slot];
  if (cur && cur.ref === ref) cur.qty = (Number(cur.qty) || 1) + qty;
  else if (!cur) slots[slot] = { ref, qty, name: r.name };
  else return false;
  c.inv = { cols: inv.cols, rows: inv.rows, slots };
  return true;
}
// Equipped slots: "ar" holds body armour, "w0".."w5" hold anything in hand or worn (weapons, shields, rings…).
const EQ_KEYS = ["w0", "w1", "w2", "w3", "w4", "w5"];
const isGridKey = k => /^\d+$/.test(String(k));
function isBodyArmour(e) { return invKind(e) === "armour" && !/shield/i.test((e.item || {}).category || ""); }
// Consumable slots: "p0".."p5" take consumables only (an item with one-time or reusable uses set,
// a potion or scroll, or anything tagged "consumable"/"potion").
const POT_KEYS = ["p0", "p1", "p2", "p3", "p4", "p5"];
// Storage items (item.holds = { n, row }) such as a Ring of Arms: while one sits in a regular equipped or consumable
// slot, it adds n extra slots to that row, keyed on from w6 / p6 upwards. Each group is drawn under the item's name.
function holdsOf(e) { const h = e && e.item && e.item.holds, n = h ? Math.max(0, Math.min(40, Number(h.n) || 0)) : 0; return n ? { n, row: h.row === "cons" ? "cons" : "equip", only: Array.isArray(h.only) ? h.only.filter(Boolean) : [] } : null; }
// What a storage item may hold: "kind:weapon", "kind:armour", "kind:item", "cons" (consumables) or "cat:<category>". Empty = anything.
function holdOptions() { return [["kind:weapon", "Any weapon"], ["kind:armour", "Any armour or shield"], ["cons", "Any consumable"], ["kind:item", "Any other item"], ...ITEM_CATEGORIES.map(c => ["cat:" + c, c])]; }
function holdOk(only, e) {
  if (!only || !only.length) return true;
  const cat = String((e.item || {}).category || "").toLowerCase();
  return only.some(o => o === "cons" ? isConsumable(e) : o.startsWith("kind:") ? invKind(e) === o.slice(5) : o.startsWith("cat:") ? cat === o.slice(4).toLowerCase() : false);
}
const HOLD_SHORT = { "kind:weapon": "weapons", "kind:armour": "armour and shields", "cons": "consumables", "kind:item": "other items" };
const holdLabel = only => only.map(o => HOLD_SHORT[o] || o.replace(/^\w+:/, "")).join(", ");
function holdGroupOf(c, key) { if (!c || !/^[wp]\d+$/.test(key) || Number(key.slice(1)) < 6) return null; return invHoldGroups(c, key[0] === "p" ? "cons" : "equip").find(g => g.keys.includes(key)) || null; }
function invHoldGroups(c, row) {
  const inv = invOf(c), base = row === "cons" ? POT_KEYS : ["ar", ...EQ_KEYS], pre = row === "cons" ? "p" : "w";
  let next = 6; const out = [];
  ["ar", ...EQ_KEYS, ...POT_KEYS].forEach(k => {
    const s = inv.slots[k]; if (!s) return;
    const r = invResolve(s.ref, s.name), h = holdsOf(r.e); if (!h || h.row !== row) return;
    out.push({ k, name: r.name, n: h.n, only: h.only, keys: Array.from({ length: h.n }, (_, i) => pre + (next + i)) }); next += h.n;
  });
  return out;
}
const eqKeysOf = c => [...EQ_KEYS, ...invHoldGroups(c, "equip").flatMap(g => g.keys)];
const potKeysOf = c => [...POT_KEYS, ...invHoldGroups(c, "cons").flatMap(g => g.keys)];
// After a change: anything left in a storage slot that no longer exists (the ring was taken off) goes back to the pack.
function invNormalize(x) {
  if (!x || !x.inv || !x.inv.slots) return 0;
  const ok = new Set(["ar", ...eqKeysOf(x), ...potKeysOf(x)]); let moved = 0;
  for (const k of Object.keys(x.inv.slots)) {
    if (!/^[wp]\d+$/.test(k) || ok.has(k)) continue;
    const s = x.inv.slots[k]; delete x.inv.slots[k];
    const inv = invOf(x), same = Object.keys(inv.slots).find(g => isGridKey(g) && inv.slots[g].ref === s.ref);
    let g = same || invFreeGrid(x);
    if (g == null) { x.inv.rows = invOf(x).rows + 1; g = invFreeGrid(x); }
    if (same) x.inv.slots[same].qty = (Number(x.inv.slots[same].qty) || 1) + (Number(s.qty) || 1); else x.inv.slots[g] = s;
    moved++;
  }
  return moved;
}
function isConsumable(e) { return !!useInfo(e.item) || (e.tags || []).some(t => /^(potions?|consumables?)$/.test(t)); }
// Charges left on the top item of a stack (reusable items only).
function slotLeft(s, u) { return s.left == null ? u.uses : Math.max(0, Number(s.left) || 0); }
function chargeBadge(s, e) { const u = useInfo(e.item); return u && u.type === "reusable" ? `<span class="ichg${slotLeft(s, u) ? "" : " out"}">${slotLeft(s, u)}/${u.uses}</span>` : ""; }
function slotAccepts(key, ref, c) {
  const e = invResolve(ref).e; if (key === "ar") return isBodyArmour(e);
  if (/^p\d+$/.test(key) && !isConsumable(e)) return false;
  const g = holdGroupOf(c, key); return g ? holdOk(g.only, e) && !holdsOf(e) : true;
}
function slotRefusal(key, c) {
  if (key === "ar") return "Only body armour goes in the armour slot.";
  const g = holdGroupOf(c, key); if (g && g.only.length) return `The ${g.name} only holds: ${holdLabel(g.only)}.`;
  if (g) return `A storage item can't go inside the ${g.name}.`;
  return "Only consumables go in the consumable slots.";
}
// Where a new item goes: weapons and shields to a free equipped slot, body armour to the armour slot if empty, else the grid.
function invAutoSlot(c, ref) {
  const inv = invOf(c), e = invResolve(ref).e;
  const EQK = eqKeysOf(c), POK = potKeysOf(c);
  for (const k of ["ar", ...EQK, ...POK]) { const s = inv.slots[k]; if (s && s.ref === ref) return k; }
  if (isConsumable(e) && invKind(e) === "item") { const k = POK.find(k => !inv.slots[k] && slotAccepts(k, ref, c)); if (k) return k; }
  if (isBodyArmour(e) && !inv.slots.ar) return "ar";
  if (invKind(e) === "weapon" || (invKind(e) === "armour" && !isBodyArmour(e))) { const k = EQK.find(k => !inv.slots[k] && slotAccepts(k, ref, c)); if (k) return k; }
  const g = invFirstFree(c, ref); return g < 0 ? null : String(g);
}
function invFreeGrid(c) { const inv = invOf(c), n = inv.cols * inv.rows; for (let k = 0; k < n; k++) if (!inv.slots[k]) return String(k); return null; }
function invFirstFree(c, ref) {
  const inv = invOf(c), n = inv.cols * inv.rows;
  // Stack onto an existing pile of the same thing first (arrows, rations, torches…).
  for (let k = 0; k < n; k++) { const s = inv.slots[k]; if (s && s.ref === ref) return k; }
  for (let k = 0; k < n; k++) if (!inv.slots[k]) return k;
  return -1;
}
function invListHtml(c) {
  const q = INV.q.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean), kk = INV.kind;
  const ok = (title, e, extra) => (!kk || invKind(e) === kk) && words.every(w => (title + " " + (extra || "")).toLowerCase().includes(w));
  const mine = String(c.name || "").trim().toLowerCase();
  const codex = [...S.entries.entries()].filter(([, e]) => e.type === "item" && ok(e.title, e, buildItemLine(e.item || {}) + " " + ((e.item || {}).holder || "")))
    .sort((a, b) => { const ha = String((a[1].item || {}).holder || "").toLowerCase() === mine ? 0 : 1, hb = String((b[1].item || {}).holder || "").toLowerCase() === mine ? 0 : 1; return ha - hb || byName(a[1].title, b[1].title); });
  const srd = SRD_EQUIP.filter(x => !srdInCodex(x.id) && ok(x.title, srdEntry(x), x.sub + " " + x.item.category)).sort((a, b) => byName(a.title, b.title));
  const row = (ref, e, sub, extra) => {
    const r = e.item && e.item.rarity && e.item.magical !== false ? " r-" + slugify(e.item.rarity) : "";
    return `<li class="invpick${INV.pick === ref ? " on" : ""}" draggable="true" data-ref="${esc(ref)}">
      <button class="invpname" data-act="invpick" data-v="${esc(ref)}" aria-pressed="${INV.pick === ref}"><span class="invico k-${invKind(e)}" aria-hidden="true">${INV_ICON[invKind(e)]}</span><span><strong class="${r}">${esc(e.title)}</strong><span class="muted">${esc(sub)}</span></span></button>
      ${extra || ""}<button class="iconbtn" data-act="invadd" data-v="${esc(ref)}" aria-label="Add ${esc(e.title)} to inventory" title="Add to the first free slot">+</button></li>`;
  };
  const limit = words.length || kk ? 80 : 30;
  return `<h3 class="fgh">In your codex <span>${codex.length}</span></h3>
    ${codex.length ? `<ul class="invlist">${codex.slice(0, limit).map(([id, e]) => row("e:" + id, e, [itemStatShort(e), e.item && e.item.magical === false ? "mundane" : e.item && e.item.rarity].filter(Boolean).join(" · ") || (e.item || {}).category || "", String((e.item || {}).holder || "").toLowerCase() === mine && mine ? `<span class="pill t-faction small" title="This item's holder is ${esc(c.name)}">Held</span>` : "")).join("")}</ul>` : `<p class="muted small">No codex items match.</p>`}
    <h3 class="fgh">From the SRD <span>${srd.length}</span></h3>
    ${srd.length ? `<ul class="invlist">${srd.slice(0, limit).map(x => row("s:" + x.id, srdEntry(x), [srdStat(x), costText(x.item.stats)].filter(Boolean).join(" · ") || x.sub)).join("")}</ul>${srd.length > limit ? `<p class="muted small">Showing ${limit} of ${srd.length}. Search to narrow it down.</p>` : ""}` : `<p class="muted small">No SRD items match.</p>`}`;
}
function slotCell(inv, k, P, label) {
  const s = inv.slots[k];
  if (!s) return `<button class="islot empty${INV.pick || INV.sel != null ? " target" : ""}" data-act="invslot" data-k="${k}" data-slot="${k}" aria-label="Empty ${label ? label.toLowerCase() + " " : ""}slot"${P ? "" : " disabled"}>${label ? `<span class="slab">${label}</span>` : ""}</button>`;
  const r = invResolve(s.ref, s.name), e = r.e, kind = invKind(e);
  const rar = e.item && e.item.rarity && e.item.magical !== false ? " rar-" + slugify(e.item.rarity) : "";
  const hv = isHarvest(e);
  return `<button class="islot k-${kind}${rar}${hv ? " harvest" : ""}${INV.sel === k ? " sel" : ""}${r.src === "gone" ? " gone" : ""}" data-act="invslot" data-k="${k}" data-slot="${k}" draggable="${P}" aria-label="${esc(r.name)}${s.qty > 1 ? ", " + s.qty : ""}" title="${esc(r.name)}">
      <span class="iico" aria-hidden="true">${hv ? (e.image ? `<img src="${esc(e.image)}" alt="">` : "✦") : isConsumable(e) && kind === "item" ? "⚗" : INV_ICON[kind]}</span><span class="iname">${esc(r.name)}</span>${Number(s.qty) > 1 ? `<span class="iqty">×${Number(s.qty)}</span>` : ""}${chargeBadge(s, e)}</button>`;
}
function invGridHtml(c, id) {
  const inv = invOf(c), n = inv.cols * inv.rows, P = canPlay();
  const used = Object.keys(inv.slots).filter(k => isGridKey(k) && Number(k) < n).length;
  let cells = "";
  for (let k = 0; k < n; k++) cells += slotCell(inv, String(k), P);
  const sel = INV.sel != null ? inv.slots[INV.sel] : null;
  let detail = "";
  if (sel) {
    const r = invResolve(sel.ref, sel.name);
    detail = `<div class="invdetail">
      <div class="invdhead"><strong>${esc(r.name)}</strong>
        ${P ? `<div class="qty"><button class="iconbtn" data-act="invqty" data-v="-1" aria-label="One fewer">−</button><span>${Number(sel.qty) || 1}</span><button class="iconbtn" data-act="invqty" data-v="1" aria-label="One more">+</button></div>
        <button class="btn ghost small" data-act="invrm">Remove</button>` : ""}
        ${r.id ? `<a class="btn ghost small" href="#entry-${esc(r.id)}">Open in codex</a>` : ""}
        <button class="iconbtn" data-act="invclose" aria-label="Close">✕</button></div>
      ${r.src === "custom" ? `<p class="muted small">A quick item with just a name. Make it a codex Item to give it stats, uses and a description.</p>` : r.src === "gone" ? `<p class="muted small">This item was deleted from the codex. Its slot keeps the name.</p>` : `<div class="invcard">${itemPageHtml(r.id || "", r.e).replace(/<div class="iimg"><button[^>]*data-act="(addlore|portrait)"[^>]*>[^<]*<\/button><\/div>/g, "")}</div>`}
      ${P ? `<p class="muted small">Tap an empty slot to move it there, or drag it.</p>` : ""}
    </div>`;
  }
  const money = c.money || {}, rate = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
  const worth = Object.keys(rate).reduce((t, k) => t + (Number(money[k]) || 0) * rate[k], 0);
  const purse = `<div class="purse"><div class="pursehead"><h2 class="csh">Coin purse</h2><span class="muted small">Worth ${fmt(Math.round(worth * 100) / 100)} gp</span></div>
    <div class="coinrow">${[["pp", "Platinum"], ["gp", "Gold"], ["ep", "Electrum"], ["sp", "Silver"], ["cp", "Copper"]].map(([k, l]) => `<label class="coin2 ${k}"><span class="cdisc" aria-hidden="true">${k.toUpperCase()}</span><span class="clab">${l}</span>${P ? cField("money." + k, money[k] || 0, { num: 1, label: l + " pieces" }) : `<strong>${fmt(money[k] || 0)}</strong>`}</label>`).join("")}</div></div>`;
  const pay = INV.pay, plan = payPlan(money, payCp());
  const ledger = (c.ledger || []).slice(0, 8);
  const till = P ? `<div class="till">
      <div class="tillrow"><input id="payamt" type="text" inputmode="decimal" placeholder="Amount" value="${esc(pay.amt)}" aria-label="Amount">
        <select id="payunit" aria-label="Coin">${["cp", "sp", "ep", "gp", "pp"].map(k => `<option${pay.unit === k ? " selected" : ""}>${k}</option>`).join("")}</select>
        <input id="paynote" type="text" placeholder="What for? (optional)" value="${esc(pay.note)}" aria-label="What for">
        <button class="btn danger" data-act="paygo" data-v="spend">Spend</button><button class="btn" data-act="paygo" data-v="get">Receive</button></div>
      <p class="tillhint muted small" id="payprev">${payPreview(plan)}</p>
      ${ledger.length ? `<details class="ledger"><summary>Recent <span class="muted">${ledger.length}</span></summary><ul>${ledger.map((l, k) => `<li><span class="${l.dir === "spend" ? "neg" : "pos"}">${l.dir === "spend" ? "−" : "+"}${esc(l.amt)} ${esc(l.unit)}</span><span class="muted">${esc(l.note || "")}</span>${k === 0 ? `<button class="linkbtn" data-act="payundo">Undo</button>` : ""}</li>`).join("")}</ul></details>` : ""}
    </div>` : "";
  const equip = `<div class="equip"><div class="invhead"><h2 class="csh">Equipped</h2><span class="muted small">Weapons here show up as attacks on the sheet</span></div>
    <div class="eqrow"><div class="eqarm">${slotCell(inv, "ar", P, "Armour")}</div><div class="eqhands">${EQ_KEYS.map(k => slotCell(inv, k, P, "Equip")).join("")}</div></div>
    ${invHoldGroups(c, "equip").map(g => `<div class="eqrow holds"><div class="potlab"><span aria-hidden="true">◈</span>${esc(g.name)}<small>holds ${g.n}${g.only.length ? " · " + esc(holdLabel(g.only)) : ""}</small></div><div class="eqhands">${g.keys.map(k => slotCell(inv, k, P, g.only.length === 1 ? holdLabel(g.only).replace(/s$/, "").replace(/^\w/, ch => ch.toUpperCase()) : "Equip")).join("")}</div></div>`).join("")}
    <div class="eqrow pots"><div class="potlab"><span aria-hidden="true">⚗</span>Consumables</div><div class="eqhands">${POT_KEYS.map(k => slotCell(inv, k, P, "Consumable")).join("")}</div></div>
    ${invHoldGroups(c, "cons").map(g => `<div class="eqrow pots holds"><div class="potlab"><span aria-hidden="true">◈</span>${esc(g.name)}<small>holds ${g.n}${g.only.length ? " · " + esc(holdLabel(g.only)) : ""}</small></div><div class="eqhands">${g.keys.map(k => slotCell(inv, k, P, g.only.length === 1 ? holdLabel(g.only).replace(/s$/, "").replace(/^\w/, ch => ch.toUpperCase()) : "Consumable")).join("")}</div></div>`).join("")}</div>`;
  return `${purse}${till}${equip}<div class="invhead"><h2 class="csh">Inventory <span class="muted">${used}/${n} slots</span></h2>
      ${P ? `<div class="invsize"><span class="muted small">Rows</span><button class="iconbtn" data-act="invrows" data-v="-1" aria-label="Remove a row">−</button><span>${inv.rows}</span><button class="iconbtn" data-act="invrows" data-v="1" aria-label="Add a row">+</button></div>` : ""}</div>
    ${INV.pick ? `<p class="invhint">Tap a slot to place <strong>${esc(invResolve(INV.pick).name)}</strong>. <button class="linkbtn" data-act="invpick" data-v="${esc(INV.pick)}">Cancel</button></p>` : ""}
    <div class="igrid" style="--cols:${inv.cols}">${cells}</div>${detail}`;
}
function invViewHtml(c, id) {
  const P = canPlay();
  return `<div class="invwrap">
    ${P ? `<section class="csec invside"><h2 class="csh">Add items</h2>
      <label class="search"><span class="sr">Filter items</span><input id="invq" type="search" placeholder="Filter, e.g. sword, rope" value="${esc(INV.q)}" autocomplete="off"></label>
      <div class="seg kindseg small" role="group" aria-label="Kind">${[["", "All"], ["weapon", "Weapons"], ["armour", "Armour"], ["item", "Gear"]].map(([k, l]) => `<button class="${INV.kind === k ? "on" : ""}" data-act="invkind" data-v="${k}" aria-pressed="${INV.kind === k}">${l}</button>`).join("")}</div>
      <p class="muted small">Drag an item onto a slot, or tap it and then tap a slot. <b>+</b> drops it in the first free slot.</p>
      <div class="quickadd"><input id="invnew" type="text" placeholder="Not in the codex? Type a name" aria-label="Quick item name"><button class="btn ghost small" data-act="invnew">+ Add</button></div>
      <div id="invlist" class="invscroll">${invListHtml(c)}</div></section>` : ""}
    <section class="csec invmain">${invGridHtml(c, id)}</section>
  </div>`;
}

async function invAction(a, el) {
  const sh = document.querySelector(".sheet"), id = sh && sh.dataset.id, c = id && S.chars.get(id);
  if (!c) return false;
  if (a === "paygo") {
    const cost = payCp(), spend = el.dataset.v === "spend";
    if (!cost) { toast("Type an amount first.", "bad"); const i = $("#payamt"); if (i) i.focus(); return true; }
    const before = Object.assign({}, c.money || {});
    if (spend) {
      const plan = payPlan(before, cost);
      if (plan.short) { toast("Not enough coin for that.", "bad"); return true; }
      charChange(id, x => { x.money = Object.assign({}, x.money, plan.after); x.ledger = [{ dir: "spend", amt: INV.pay.amt, unit: INV.pay.unit, note: INV.pay.note.trim(), before, at: new Date().toISOString() }, ...(x.ledger || [])].slice(0, 20); }, false);
      toast(`Paid ${coinsText(plan.out)}${Object.keys(plan.change).length ? `, got ${coinsText(plan.change)} back` : ""}`);
    } else {
      const add = parseFloat(String(INV.pay.amt).replace(",", "."));
      if (!Number.isInteger(add)) { toast("Receive whole coins, e.g. 3 gp.", "bad"); return true; }
      charChange(id, x => { x.money = Object.assign({}, x.money); x.money[INV.pay.unit] = (Number(x.money[INV.pay.unit]) || 0) + add; x.ledger = [{ dir: "get", amt: INV.pay.amt, unit: INV.pay.unit, note: INV.pay.note.trim(), before, at: new Date().toISOString() }, ...(x.ledger || [])].slice(0, 20); }, false);
      toast(`Received ${fmt(add)} ${INV.pay.unit}`);
    }
    INV.pay.amt = ""; INV.pay.note = ""; render();
    return true;
  }
  if (a === "payundo") {
    const l = (c.ledger || [])[0]; if (!l) return true;
    charChange(id, x => { x.money = Object.assign({}, l.before); x.ledger = (x.ledger || []).slice(1); });
    toast("Undone");
    return true;
  }
  if (a === "invkind") { INV.kind = el.dataset.v; const l = $("#invlist"); if (l) l.innerHTML = invListHtml(c); document.querySelectorAll('[data-act="invkind"]').forEach(b => { b.classList.toggle("on", b.dataset.v === INV.kind); b.setAttribute("aria-pressed", b.dataset.v === INV.kind); }); return true; }
  if (a === "invpick") { INV.pick = INV.pick === el.dataset.v ? null : el.dataset.v; INV.sel = null; render(); return true; }
  if (a === "invnew") {
    const nm = ($("#invnew") || {}).value.trim(); if (!nm) { toast("Type a name first.", "bad"); return true; }
    const ref = "n:" + nm.slice(0, 80), k = invAutoSlot(c, ref);
    if (k == null) { toast("The inventory is full. Add a row or clear a slot.", "bad"); return true; }
    charChange(id, x => invPlace(x, k, ref, 1)); toast(`${nm} added`);
    return true;
  }
  if (a === "invadd") {
    const ref = el.dataset.v, k = invAutoSlot(c, ref);
    if (k == null) { toast("The inventory is full. Add a row or clear a slot.", "bad"); return true; }
    const r = invResolve(ref);
    charChange(id, x => invPlace(x, k, ref, r.bundle || 1));
    toast(`${r.name} ${isGridKey(k) ? "added" : "added and equipped"}`);
    return true;
  }
  if (a === "invslot") {
    const k = el.dataset.k, inv = invOf(c), s = inv.slots[k];
    if (INV.pick) {
      const ref = INV.pick, r = invResolve(ref);
      if (s && s.ref !== ref) { INV.sel = k; INV.pick = null; render(); return true; }
      if (!slotAccepts(k, ref, c)) { toast(slotRefusal(k, c), "bad"); return true; }
      INV.pick = null; INV.sel = k;
      charChange(id, x => invPlace(x, k, ref, r.bundle || 1));
      return true;
    }
    if (!s && INV.sel != null && inv.slots[INV.sel]) { const from = INV.sel; if (!slotAccepts(k, inv.slots[from].ref, c)) { toast(slotRefusal(k, c), "bad"); return true; } INV.sel = k; charChange(id, x => invMove(x, from, k)); return true; }
    INV.sel = s ? (INV.sel === k ? null : k) : null; render(); return true;
  }
  if (a === "invclose") { INV.sel = null; render(); return true; }
  if (a === "invqty") {
    const k = INV.sel, d = Number(el.dataset.v);
    charChange(id, x => { const v = invOf(x); const s = v.slots[k]; if (!s) return; s.qty = Math.max(1, (Number(s.qty) || 1) + d); x.inv = v; });
    return true;
  }
  if (a === "invrm") { const k = INV.sel; INV.sel = null; charChange(id, x => { const v = invOf(x); delete v.slots[k]; x.inv = v; }); return true; }
  if (a === "invrows") {
    const d = Number(el.dataset.v), inv = invOf(c), rows = inv.rows + d;
    if (rows < 1 || rows > 20) return true;
    if (d < 0 && Object.keys(inv.slots).some(k => isGridKey(k) && Number(k) >= rows * inv.cols)) { toast("Empty the bottom row first.", "bad"); return true; }
    charChange(id, x => { const v = invOf(x); v.rows = rows; x.inv = v; });
    return true;
  }
  return false;
}
function invMove(x, from, to) {
  const v = invOf(x), a = v.slots[from], b = v.slots[to];
  if (!a || from === to) return;
  if (!slotAccepts(to, a.ref, x) || (b && b.ref !== a.ref && !slotAccepts(from, b.ref, x))) return;
  if (b && b.ref === a.ref) { b.qty = (Number(b.qty) || 1) + (Number(a.qty) || 1); delete v.slots[from]; }
  else { v.slots[to] = a; if (b) v.slots[from] = b; else delete v.slots[from]; }
  x.inv = v;
}
// Drag and drop (mouse). Touch uses tap-to-pick instead.
document.addEventListener("dragstart", ev => {
  const t = ev.target.closest && ev.target.closest("[data-ref], .islot[data-slot]"); if (!t || !canPlay()) return;
  INV.drag = t.dataset.ref ? { ref: t.dataset.ref } : { from: t.dataset.slot };
  ev.dataTransfer.effectAllowed = "move"; try { ev.dataTransfer.setData("text/plain", t.dataset.ref || "slot"); } catch (e) {}
  t.classList.add("dragging");
});
document.addEventListener("dragend", ev => { INV.drag = null; document.querySelectorAll(".dragging, .islot.over").forEach(n => n.classList.remove("dragging", "over")); });
document.addEventListener("dragover", ev => { const s = INV.drag && ev.target.closest && ev.target.closest(".islot"); if (!s) return; ev.preventDefault(); document.querySelectorAll(".islot.over").forEach(n => n !== s && n.classList.remove("over")); s.classList.add("over"); });
document.addEventListener("drop", ev => {
  const s = INV.drag && ev.target.closest && ev.target.closest(".islot"); if (!s) return;
  ev.preventDefault();
  const sh = document.querySelector(".sheet"), id = sh && sh.dataset.id, k = s.dataset.slot, d = INV.drag; INV.drag = null;
  if (!id) return;
  if (d.ref) {
    const c = S.chars.get(id), cur = invOf(c).slots[k], r = invResolve(d.ref);
    if (cur && cur.ref !== d.ref) { toast("That slot is taken. Drop it on an empty slot.", "bad"); render(); return; }
    if (!slotAccepts(k, d.ref, c)) { toast(slotRefusal(k, c), "bad"); render(); return; }
    INV.sel = k; charChange(id, x => invPlace(x, k, d.ref, r.bundle || 1));
  } else {
    const cc = S.chars.get(id), v = invOf(cc), a = v.slots[d.from], b = v.slots[k];
    if (a && (!slotAccepts(k, a.ref, cc) || (b && b.ref !== a.ref && !slotAccepts(d.from, b.ref, cc)))) { toast(slotRefusal(!slotAccepts(k, a.ref, cc) ? k : d.from, cc), "bad"); render(); return; }
    INV.sel = k; charChange(id, x => invMove(x, d.from, k));
  }
});
function payRefresh() { const sh = document.querySelector(".sheet"), c = sh && S.chars.get(sh.dataset.id), p = $("#payprev"); if (c && p) p.innerHTML = payPreview(payPlan(c.money || {}, payCp())); }
document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.id === "invnew") { ev.preventDefault(); const b = document.querySelector('[data-act="invnew"]'); if (b) b.click(); return; } if (ev.key === "Enter" && ["payamt", "paynote"].includes(ev.target.id)) { ev.preventDefault(); const b = document.querySelector('[data-act="paygo"][data-v="spend"]'); if (b) b.click(); } });
// ---------- Equipped gear on the sheet ----------
function magicBonus(e) { const m = String(e.title || "").match(/^\+(\d)\b|\s\+(\d)\b/) || String((e.item || {}).extra || "").match(/\+(\d)\b/); return m ? Number(m[1] || m[2]) : 0; }
function weaponProficient(c, e) { return profHas(c, "weapons", e) !== false; }
function weaponAttack(c, e) {
  const it = e.item || {}, st = it.stats || {}, props = (it.props || []).map(p => p.id);
  const str = cMod(c, "str"), dex = cMod(c, "dex");
  const ranged = /ranged/i.test(it.category || "") || props.includes("ammunition") || (props.includes("range") && !props.includes("thrown"));
  const ab = props.includes("finesse") ? (dex > str ? "dex" : "str") : ranged ? "dex" : "str";
  const mod = cMod(c, ab), bonus = magicBonus(e), prof = weaponProficient(c, e);
  const hit = mod + (prof ? cPB(c) : 0) + bonus, dm = mod + bonus;
  const dmg = d => d ? `${d}${dm ? (dm > 0 ? "+" : "−") + Math.abs(dm) : ""}` : "";
  const vers = (it.props || []).find(p => p.id === "versatile" && p.param);
  const more = damageParts(st).slice(1).map(p => p.damage + (p.dtype ? " " + p.dtype : "")).join(" + ");
  return { hit: signed(hit), dmg: dmg(st.damage), two: vers ? dmg(vers.param) : "", type: st.dtype || "", more, ab: ab.toUpperCase(), prof,
    props: (it.props || []).filter(p => p.id !== "versatile").map(propLabel).join(", ") };
}
// ---------- Armour class ----------
// Unarmoured options come from features: Unarmoured Defence (Con, or Wis for a monk: no shield),
// Draconic Resilience (13 + Dex), or any feature that says "13 + your Dexterity modifier" style AC.
function acUnarmoured(c) {
  const dex = cMod(c, "dex"), opts = [{ v: 10 + dex, label: `10 + Dex ${signed(dex)}`, shield: true }];
  for (const f of c.features || []) {
    const name = String(f.name || ""), txt = name + " " + (f.note || "") + " " + (f.desc || "");
    if (/unarmou?red defen[cs]e/i.test(name)) {
      const wis = /wisdom/i.test(txt) || (/monk/i.test(txt + " " + (c.classes || "")) && !/constitution/i.test(txt));
      const ab = wis ? "wis" : "con", m = cMod(c, ab);
      opts.push({ v: 10 + dex + m, label: `${esc(name)}: 10 + Dex ${signed(dex)} + ${wis ? "Wis" : "Con"} ${signed(m)}`, shield: !wis });
    } else if (/draconic resilience/i.test(name)) opts.push({ v: 13 + dex, label: `${esc(name)}: 13 + Dex ${signed(dex)}`, shield: true });
    else if (/natural armou?r|armou?red (shell|casing)|integrated protection/i.test(name)) {
      const m = String(f.desc || "").match(/(\d{2})\s*\+\s*your Dexterity/i), flat = String(f.desc || "").match(/AC (?:of|is|equals?|equal to) (\d{2})\b/i);
      if (m) opts.push({ v: Number(m[1]) + dex, label: `${esc(name)}: ${m[1]} + Dex ${signed(dex)}`, shield: true });
      else if (flat) opts.push({ v: Number(flat[1]), label: `${esc(name)}: ${flat[1]}`, shield: true });
    }
  }
  return opts;
}
function acCalc(c) {
  const inv = invOf(c), occ = ["ar", ...eqKeysOf(c)].filter(k => inv.slots[k]).map(k => ({ k, r: invResolve(inv.slots[k].ref, inv.slots[k].name) }));
  const body = occ.find(o => o.k === "ar" && invKind(o.r.e) === "armour" && armourWeight(o.r.e) !== "shield");
  const shields = occ.filter(o => o !== body && invKind(o.r.e) === "armour");
  const warn = e => profHas(c, "armour", e) === false ? ` <span class="warnchip" title="Not on the sheet's armour proficiencies">not proficient</span>` : "";
  let total, parts = [];
  if (body) {
    const st = (body.r.e.item || {}).stats || {}, base = parseInt(st.ac, 10) || 10, dx = st.dex ? Math.min(cMod(c, "dex"), String(st.dexMax || "").trim() ? Number(st.dexMax) : 99) : 0, mb = magicBonus(body.r.e);
    total = base + dx + mb; parts.push(`${esc(body.r.name)} ${base}${st.dex ? ` + Dex ${signed(dx)}` : ""}${mb ? ` + ${mb}` : ""}${warn(body.r.e)}`);
  } else {
    // Best unarmoured option; a monk's loses to the shield-friendly ones when a shield is held.
    const opts = acUnarmoured(c);
    const usable = shields.length ? opts.filter(o => o.shield) : opts;
    const best = usable.reduce((x, y) => (y.v > x.v ? y : x));
    total = best.v; parts.push(best.label);
  }
  shields.forEach(o => { const v = parseInt(((o.r.e.item || {}).stats || {}).ac, 10) || 2, mb = magicBonus(o.r.e); total += v + mb; parts.push(`${esc(o.r.name)} +${v + mb}${warn(o.r.e)}`); });
  return { total, parts, body, shields };
}
// The AC the sheet shows: what was typed, or worked out from what is worn when the box is blank.
function cAC(c) { const t = String(c.ac == null ? "" : c.ac).trim(); return t || String(acCalc(c).total); }
function equippedParts(c, id) {
  const inv = invOf(c), P = canPlay();
  const occ = ["ar", ...eqKeysOf(c)].filter(k => inv.slots[k]).map(k => ({ k, s: inv.slots[k], r: invResolve(inv.slots[k].ref, inv.slots[k].name) }));
  const weapons = occ.filter(o => invKind(o.r.e) === "weapon");
  const shields = occ.filter(o => o.k !== "ar" && invKind(o.r.e) === "armour");
  const others = occ.filter(o => invKind(o.r.e) === "item" && !damageText((o.r.e.item || {}).stats));
  const dmgItems = occ.filter(o => invKind(o.r.e) === "item" && damageText((o.r.e.item || {}).stats));
  const body = occ.find(o => o.k === "ar");
  const unequip = o => P ? `<button class="iconbtn tiny" data-act="cuneq" data-v="${o.k}" data-id="${esc(id)}" title="Put back in the inventory" aria-label="Unequip ${esc(o.r.name)}">✕</button>` : "";
  const nameLink = o => o.r.id ? `<a href="#entry-${esc(o.r.id)}">${esc(o.r.name)}</a>` : esc(o.r.name);
  const rows = weapons.map(o => { const w = weaponAttack(c, o.r.e); return `<tr class="auto"><td>${nameLink(o)}${Number(o.s.qty) > 1 ? ` <span class="muted">×${o.s.qty}</span>` : ""}
      <div class="muted small">${esc([w.props, w.ab + (w.prof ? "" : ", not proficient")].filter(Boolean).join(" · "))}</div></td>
      <td class="num big">${esc(w.hit)}</td><td>${diceify(esc(w.dmg))} <span class="muted">${esc(w.type)}</span>${w.more ? ` + ${diceify(esc(w.more))}` : ""}${w.two ? `<div class="muted small">Two hands: ${diceify(esc(w.two))}</div>` : ""}</td><td class="x">${unequip(o)}</td></tr>`; });
  dmgItems.forEach(o => rows.push(`<tr class="auto"><td>${nameLink(o)}<div class="muted small">${esc((o.r.e.item || {}).category || "Item")}</div></td><td class="num big">—</td><td>${diceify(esc(damageText(o.r.e.item.stats)))}</td><td class="x">${unequip(o)}</td></tr>`));
  // Armour class from what is worn (or unarmoured).
  const A = acCalc(c), blank = !String(c.ac == null ? "" : c.ac).trim();
  const ac = `<div class="eqac"><span class="vl">${A.body ? "Armour" : "Unarmoured"}</span><span>${A.parts.join(" · ")} = <strong>AC ${A.total}</strong>${blank ? ` <span class="muted small">(used on the sheet)</span>` : ""}</span>
      ${!blank && String(c.ac) !== String(A.total) && P ? `<button class="btn ghost small" data-act="cuseac" data-v="" data-id="${esc(id)}" title="The sheet's AC is ${esc(c.ac || "—")}. This clears it so it follows what's worn.">Use ${A.total}</button>` : ""}
      ${body ? unequip(body) : ""}</div>`;
  const chips = [...shields, ...others].length ? `<div class="eqitems">${[...shields, ...others].map(o => `<details class="eqchip k-${invKind(o.r.e)}"><summary title="${esc(o.r.name)}"><span aria-hidden="true">${INV_ICON[invKind(o.r.e)]}</span>${esc(o.r.name)}${Number(o.s.qty) > 1 ? ` ×${o.s.qty}` : ""}</summary>
      <div class="eqpop">${o.r.src === "gone" ? `<p class="muted small">Deleted from the codex.</p>` : itemPageHtml(o.r.id || "", o.r.e).replace(/<div class="iimg"><button[^>]*data-act="(addlore|portrait)"[^>]*>[^<]*<\/button><\/div>/g, "")}
      <p class="eqpopacts">${o.r.id ? `<a class="btn ghost small" href="#entry-${esc(o.r.id)}">Open in codex</a>` : ""}${P ? `<button class="btn ghost small" data-act="cuneq" data-v="${o.k}" data-id="${esc(id)}">Unequip</button>` : ""}</p></div></details>`).join("")}</div>` : "";
  const bag = Object.keys(inv.slots).filter(isGridKey).map(k => ({ k, r: invResolve(inv.slots[k].ref, inv.slots[k].name) })).sort((a, b) => byName(a.r.name, b.r.name));
  const free = eqKeysOf(c).some(k => !inv.slots[k]) || !inv.slots.ar || potKeysOf(c).some(k => !inv.slots[k]);
  const picker = P && bag.length ? `<label class="eqpick"><span class="sr">Equip from inventory</span><select data-eqpick="1" data-id="${esc(id)}"${free ? "" : " disabled"}><option value="">${free ? "+ Equip from inventory…" : "Equipped slots are full"}</option>${bag.map(b => `<option value="${b.k}">${INV_ICON[invKind(b.r.e)]} ${esc(b.r.name)}</option>`).join("")}</select></label>` : "";
  const pots = potKeysOf(c).filter(k => inv.slots[k]).map(k => ({ k, s: inv.slots[k], r: invResolve(inv.slots[k].ref, inv.slots[k].name) }));
  const potions = pots.length ? `<div class="potsec"><h3 class="fgh">⚗ Consumables</h3><div class="eqitems">${pots.map(o => {
      const u = useInfo((o.r.e || {}).item) || { type: "single", uses: 1, recharge: "none" }, left = slotLeft(o.s, u), qty = Number(o.s.qty) || 1;
      const pips = u.type === "reusable" ? `<span class="cpips" aria-label="${left} of ${u.uses} charges">${Array.from({ length: Math.min(u.uses, 10) }, (_, j) => `<i class="${j < left ? "on" : ""}"></i>`).join("")}${u.uses > 10 ? ` ${left}/${u.uses}` : ""}</span>` : "";
      const useBtn = !P ? "" : u.type === "reusable" ? (left ? `<button class="btn small" data-act="cdrink" data-v="${o.k}" data-id="${esc(id)}">Use a charge</button>` : `<button class="btn small" disabled>Out of charges${u.recharge !== "none" ? " · " + esc(u.recharge === "dawn" ? "recharges at dawn" : "recharges on a " + u.recharge + " rest") : ""}</button>`) : `<button class="btn small" data-act="cdrink" data-v="${o.k}" data-id="${esc(id)}">Use one</button>`;
      return `<details class="eqchip potion${u.type === "reusable" && !left ? " spent" : ""}"><summary title="${esc(o.r.name)}">${esc(o.r.name)}${qty > 1 ? `<b class="pq">×${qty}</b>` : ""}${pips}</summary>
      <div class="eqpop">${o.r.src === "gone" ? `<p class="muted small">Deleted from the codex.</p>` : itemPageHtml(o.r.id || "", o.r.e).replace(/<div class="iimg"><button[^>]*data-act="(addlore|portrait)"[^>]*>[^<]*<\/button><\/div>/g, "")}
      <p class="eqpopacts">${useBtn}${o.r.id ? `<a class="btn ghost small" href="#entry-${esc(o.r.id)}">Open in codex</a>` : ""}${P ? `<button class="btn ghost small" data-act="cuneq" data-v="${o.k}" data-id="${esc(id)}">Put away</button>` : ""}</p></div></details>`; }).join("")}</div></div>` : "";
  return { rows, ac, chips, picker, potions, any: occ.length };
}
function invEquipFromGrid(x, from) {
  const v = invOf(x), s = v.slots[from]; if (!s) return false;
  const e = invResolve(s.ref).e;
  const to = isConsumable(e) && potKeysOf(x).find(k => !v.slots[k] && slotAccepts(k, s.ref, x)) || (isBodyArmour(e) && !v.slots.ar ? "ar" : eqKeysOf(x).find(k => !v.slots[k] && slotAccepts(k, s.ref, x)));
  if (!to) return false;
  v.slots[to] = s; delete v.slots[from]; x.inv = v; return true;
}

// Using a consumable: one-time items are used up; reusable ones lose a charge and are destroyed
// when empty unless they recharge. Returns a message for the toast.
function useConsumable(x, k) {
  const v = invOf(x), t = v.slots[k]; if (!t) return "";
  const r = invResolve(t.ref, t.name), u = useInfo(r.e.item) || { type: "single", uses: 1, recharge: "none" };
  let msg;
  if (u.type === "reusable") {
    const left = slotLeft(t, u) - 1;
    if (left > 0) { t.left = left; msg = `${r.name}: ${left} charge${left === 1 ? "" : "s"} left`; }
    else if (u.recharge === "none") {
      t.qty = (Number(t.qty) || 1) - 1; delete t.left;
      if (t.qty <= 0) { delete v.slots[k]; msg = `${r.name} used its last charge and is destroyed`; } else msg = `${r.name} used its last charge and is destroyed · ${t.qty} left`;
    } else { t.left = 0; msg = `${r.name} is out of charges until ${u.recharge === "dawn" ? "dawn" : `a ${u.recharge} rest`}`; }
  } else {
    t.qty = (Number(t.qty) || 1) - 1;
    if (t.qty <= 0) { delete v.slots[k]; msg = `${r.name} used · none left`; } else msg = `${r.name} used · ${t.qty} left`;
  }
  x.inv = v; return msg;
}
// Rests recharge reusable items anywhere in the inventory.
function rechargeItems(x, long) {
  const v = invOf(x); let n = 0;
  for (const t of Object.values(v.slots)) { if (t.left == null) continue; const u = useInfo(invResolve(t.ref, t.name).e.item); if (u && u.type === "reusable" && (u.recharge === "short" || (long && u.recharge !== "none"))) { delete t.left; n++; } }
  x.inv = v; return n;
}
