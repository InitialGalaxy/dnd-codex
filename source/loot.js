// ---------- Harvest (loot) tables: on creatures, and in books as | Material | Harvest DC | Available | Weight | tables ----------
// e.loot = [{ n, dc, qty, wt, img }]
function isLootTable(block) {
  const first = block.find(l => !/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l.trim()));
  if (!first) return false;
  const h = splitRow(first).map(c => unescapeCell(c).replace(/\*/g, "").trim().toLowerCase());
  return h[0] === "material" && /harvest dc/.test(h[1] || "");
}
function parseLootTable(block) {
  const rows = block.filter(l => !/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l.trim())).slice(1).map(splitRow).map(r => r.map(c => unescapeCell(c).trim()));
  return rows.filter(r => r.some(Boolean)).map(r => ({ n: r[0] || "", dc: r[1] || "", qty: r[2] || "", wt: r[3] || "", img: r[4] || "" }));
}
function lootHtml(items, title, size) {
  items = (items || []).filter(i => (i.n || "").trim());
  if (!items.length) return "";
  return `<div class="loot">${title ? `<h3 class="loottitle">${esc(title)}</h3>` : ""}<div class="lootgrid">${items.map(i => `<div class="lootitem">
      <div class="lootimg">${!i.img && i.ref && S.entries.has(i.ref) && S.entries.get(i.ref).image ? `<img src="${esc(S.entries.get(i.ref).image)}" alt="" loading="lazy">` : i.img && /^(https?:\/\/|\/_blob\/|images\/|data:image\/)/i.test(i.img) ? `<img src="${esc(i.img)}" alt="" loading="lazy">` : `<span aria-hidden="true">✦</span>`}</div>
      <div class="lootname">${(() => { const hit = i.ref && S.entries.has(i.ref) ? [i.ref] : [...S.entries].find(([, e]) => e.type === "item" && String(e.title).toLowerCase() === String(i.n).toLowerCase()); return hit && !READONLY ? `<a href="#entry-${esc(hit[0])}">${esc(i.n)}</a>` : esc(i.n); })()}</div>
      <dl class="lootstats"><div><dt>DC</dt><dd>${esc(i.dc || "—")}</dd></div><div><dt>Available</dt><dd${hasFormula(i.qty) ? ` title="${esc(i.qty)}"` : ""}>${esc((size != null && size !== "" ? evalHarvest(i.qty, size) : i.qty) || "—")}</dd></div><div><dt>Weight</dt><dd${hasFormula(i.wt) ? ` title="${esc(i.wt)}"` : ""}>${esc((size != null && size !== "" ? evalHarvest(i.wt, size) : i.wt) || "—")}</dd></div></dl>
    </div>`).join("")}</div></div>`;
}
// Editor rows for a creature's harvest table.
function lootRow(i) {
  i = i || {};
  return `<div class="lootrow"${i.ref ? ` data-ref="${esc(i.ref)}"` : ""}><input type="text" class="lt-n" value="${esc(i.n || "")}" placeholder="Material, e.g. Pelt" aria-label="Material">
    <input type="text" class="lt-dc" value="${esc(i.dc || "")}" placeholder="DC" aria-label="Harvest DC" inputmode="numeric">
    <div class="ltcell"><input type="text" class="lt-qty" value="${esc(i.qty || "")}" placeholder="2 or 1 × size" aria-label="Available"><small class="lt-qcalc"></small></div>
    <div class="ltcell"><input type="text" class="lt-wt" value="${esc(i.wt || "")}" placeholder="10 lb × size" aria-label="Weight"><small class="lt-wcalc"></small></div>
    <input type="text" class="lt-img" value="${esc(i.img || "")}" placeholder="Image link (optional)" aria-label="Image">
    ${S.assets ? `<button type="button" class="btn ghost small" data-act="lootimg" title="Upload an image">🖼</button>` : ""}<button type="button" class="btn ghost small" data-act="lootreset" title="Go back to the part's formula" style="display:none">↺</button><button type="button" class="btn ghost small" data-act="lootdel" title="Remove" aria-label="Remove">✕</button></div>`;
}
function lootFields(e) {
  return `<p class="muted small">What can be butchered from this creature. Shows as loot cards under its stat block. Numbers you change here only affect this creature.</p>
    <div class="frow tight"><label><span>Size for harvesting</span><select id="loot-size"><option value="">From the stat block (${esc(sizeFromSubtitle(((e.statblock || {}).subtitle)) || "Medium")})</option>${SIZES.map(s => `<option${e.lootSize === s ? " selected" : ""}>${s}</option>`).join("")}</select></label>
      <div id="loot-gargwrap" class="gargpick"${creatureSize(e) === "Gargantuan" ? "" : " hidden"}><span class="flabel">How gargantuan? <strong id="loot-gargval">${gargClamp(e.lootGarg)}</strong></span>
        <div class="gargslide"><small id="loot-garglo">${gargRange()[0]}</small><input id="loot-garg" type="range" min="${gargRange()[0]}" max="${gargRange()[1]}" step="1" value="${gargClamp(e.lootGarg)}" aria-label="Size value for this Gargantuan creature"><small id="loot-garghi">${gargRange()[1]}</small></div></div>
      <p class="muted small grow">Available and weight start as the part's formula (like “1 × size”) and work out from this size. Type a plain number to set one by hand; ↺ puts the formula back.</p></div>
    <div id="loot-suggest" class="lootsugs"></div>
    <div class="frow tight"><label class="grow"><span class="sr">Add a harvested part</span><input id="loot-addname" type="text" list="loot-partlist" placeholder="Add any harvested part by name…" autocomplete="off"></label><button type="button" class="btn ghost small" data-act="lootaddname">Add</button></div>
    <datalist id="loot-partlist"></datalist>
    <div class="lootrowhead"><span>Material</span><span>Harvest DC</span><span>Available</span><span>Weight</span><span>Image</span><span></span><span></span><span></span></div>
    <div id="loot-rows">${(e.loot || []).map(lootRow).join("")}</div>
    <button type="button" class="btn ghost small" data-act="lootadd">+ Add a custom material</button>`;
}
function readLootFields() {
  return [...document.querySelectorAll("#loot-rows .lootrow")].map(r => ({ ...(r.dataset.ref ? { ref: r.dataset.ref } : {}), n: r.querySelector(".lt-n").value.trim(), dc: r.querySelector(".lt-dc").value.trim(), qty: r.querySelector(".lt-qty").value.trim(), wt: r.querySelector(".lt-wt").value.trim(), img: r.querySelector(".lt-img").value.trim() })).filter(i => i.n);
}

// ----- Harvested parts: items in the "Harvested part" category, shown as small cards -----
const isHarvestCat = c => /^(harvested part|material)$/i.test(String(c || "").trim());
const isHarvest = e => !!(e && e.type === "item" && e.item && isHarvestCat(e.item.category));
function harvestOf(e) {
  const h = Object.assign({}, (e.item || {}).harvest || {});
  const body = String(e.body || "");
  const grab = re => { const m = body.match(re); return m ? m[1].trim() : ""; };
  if (h.dc == null) h.dc = grab(/\*\*\*Harvest DC\.\*\*\*\s*([^\n]+)/i);
  if (h.qty == null) h.qty = grab(/\*\*\*Available\.\*\*\*\s*(\d+)/i);
  if (h.wt == null) h.wt = grab(/\*\*\*Weight\.\*\*\*\s*([^\n]+)/i);
  return h;
}
const harvestBody = e => String(e.body || "").split(/\n\s*\n/).filter(p => !/^\*\*\*(Harvest DC|Available|Weight)\.\*\*\*/i.test(p.trim())).join("\n\n").trim();
function harvestCardHtml(id, e, mode) {
  const big = mode === true || mode === "big", full = big || mode === "full";
  const h = harvestOf(e), lore = (e.item || {}).lore || "", note = harvestBody(e);
  return `<div class="lootitem${big ? " big" : ""}" data-embed="${esc(id)}">
    <div class="lootimg">${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy">` : `<span aria-hidden="true">✦</span>`}</div>
    <div class="lootname">${big || READONLY ? esc(e.title) : `<a href="#entry-${esc(id)}">${esc(e.title)}</a>`}</div>
    <dl class="lootstats"><div><dt>DC</dt><dd>${esc(h.dc || "—")}</dd></div><div><dt>Available</dt><dd>${esc(h.qty || "—")}</dd></div><div><dt>Weight</dt><dd>${esc(h.wt || "—")}</dd></div></dl>
    ${full && (lore || note) ? `<div class="lootnote">${lore ? `<p><em>${esc(lore)}</em></p>` : ""}${note ? md(note, { entryId: id, noEmbed: true }) : ""}</div>` : ""}
  </div>`;
}
function harvestPageHtml(id, e) {
  return `<div class="loot"><div class="lootgrid one">${harvestCardHtml(id, e, true)}</div>
    ${S.assets && !READONLY ? `<div class="iimg"><button class="btn ghost small" data-act="portrait" data-id="${esc(id)}">${e.image ? "Replace picture" : "Add a picture"}</button></div>` : ""}</div>`;
}
function harvestFieldsHtml(it) {
  const h = it.harvest || {};
  return `<div class="frow" id="it-harvest"${isHarvestCat(it.category) ? "" : " hidden"}>
    <label><span>Harvest DC</span><input id="hv-dc" type="text" inputmode="numeric" value="${esc(h.dc || "")}" placeholder="6"></label>
    <label><span>Available</span><input id="hv-qty" type="text" inputmode="numeric" value="${esc(h.qty || "")}" placeholder="4"></label>
    <label><span>Weight</span><input id="hv-wt" type="text" value="${esc(h.wt || "")}" placeholder="10 lb"></label></div>`;
}
function harvestListHtml(parts, q, section) {
  const list = parts.filter(([, e]) => itemMatchesQ(e, q)).sort((a, b) => byName(a[1].title, b[1].title));
  if (section) return list.length ? `<h2 class="sect">Harvested parts <span class="muted small">${list.length}</span></h2><div class="loot"><div class="lootgrid wide">${list.map(([id, e]) => harvestCardHtml(id, e, "full")).join("")}</div></div>` : "";
  return `${READONLY ? "" : sizeCfgHtml()}<p class="muted small">Parts that can be butchered from creatures. Click a name for its full page.${READONLY ? "" : ` <button class="btn ghost small" data-act="newharvest">+ New harvested part</button>`}</p>
    ${list.length ? `<div class="loot"><div class="lootgrid wide">${list.map(([id, e]) => harvestCardHtml(id, e, "full")).join("")}</div></div>` : `<div class="empty">${parts.length ? "No parts match." : "No harvested parts yet."}</div>`}`;
}

// ----- Size formulas: "4^size", "1 × size", "2 lb × size" work out from the creature's size -----
const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const SIZE_DEFAULT = { Tiny: 1, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4 };
const sizeVal = sz => { if (sz === "Gargantuan") return gargRange()[0]; const v = ((S.harvestCfg || {}).sizes || {})[sz]; return v != null && v !== "" ? Number(v) : (SIZE_DEFAULT[sz] || 1); };
function sizeFromSubtitle(t) { const m = String(t || "").match(/\b(tiny|small|medium|large|huge|gargantuan)\b/i); return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : ""; }
function creatureSize(e) { return (e && e.lootSize) || sizeFromSubtitle(((e || {}).statblock || {}).subtitle) || "Medium"; }
// Gargantuan has no upper limit, so it's a range set under Items → Harvested parts; each Gargantuan creature picks a value in it.
const GARG_MAX = 20;
function gargRange() { const g = (S.harvestCfg || {}).garg; return Array.isArray(g) && g.length === 2 ? [Number(g[0]), Number(g[1])] : [4, 10]; }
const gargClamp = v => { const [lo, hi] = gargRange(), n = Number(v); return v === "" || v == null || !isFinite(n) ? lo : Math.min(hi, Math.max(lo, n)); };
function creatureSizeNum(e) { const sz = creatureSize(e); return sz === "Gargantuan" ? gargClamp(e && e.lootGarg) : sizeVal(sz); }
const hasFormula = s => /size/i.test(String(s || ""));
function evalHarvest(expr, size) {
  const s = String(expr || "").trim(); if (!hasFormula(s)) return s;
  const unit = (s.match(/\b(lbs?|kg|oz)\b/i) || [])[1] || "";
  const x = s.replace(/\b(lbs?|kg|oz)\b/gi, "").replace(/size/gi, "(" + (typeof size === "number" ? size : sizeVal(size)) + ")").replace(/[×x*]/gi, "*").replace(/\^/g, "**").replace(/\s+/g, "");
  if (!/^[\d.+\-*/()]+$/.test(x)) return s;
  try { const v = Function('"use strict";return (' + x + ")")(); if (!isFinite(v)) return s; return String(Math.round(v * 100) / 100) + (unit ? " " + unit : ""); } catch (e) { return s; }
}
function lootCalcAll() {
  const rows = document.querySelectorAll("#loot-rows .lootrow");
  const sel = $("#loot-size"), sub = ($("#sb-subtitle") || {}).value;
  const sname = (sel && sel.value) || sizeFromSubtitle(sub) || "Medium";
  const gw = $("#loot-gargwrap"), gi = $("#loot-garg");
  if (gw) { gw.hidden = sname !== "Gargantuan"; const [lo, hi] = gargRange(); gi.min = lo; gi.max = hi; $("#loot-gargval").textContent = gi.value; $("#loot-garglo").textContent = lo; $("#loot-garghi").textContent = hi; }
  const size = sname === "Gargantuan" && gi ? Number(gi.value) : sname;
  const opt = sel && sel.querySelector('option[value=""]'); if (opt) opt.textContent = `From the stat block (${sizeFromSubtitle(sub) || "Medium"})`;
  rows.forEach(r => {
    const part = r.dataset.ref && S.entries.get(r.dataset.ref), ph = part ? harvestOf(part) : {};
    [["lt-qty", "lt-qcalc", "qty"], ["lt-wt", "lt-wcalc", "wt"]].forEach(([inp, out, key]) => {
      const v = r.querySelector("." + inp).value, o = r.querySelector("." + out);
      if (o) o.textContent = hasFormula(v) ? "= " + evalHarvest(v, size) : part && v.trim() && v !== (ph[key] || "") ? "set by hand" : "";
    });
    const p = r.dataset.ref && S.entries.get(r.dataset.ref), rb = r.querySelector("[data-act=lootreset]");
    if (rb) { const h = p ? harvestOf(p) : {}; rb.style.display = !p || (r.querySelector(".lt-qty").value === (h.qty || "") && r.querySelector(".lt-wt").value === (h.wt || "")) ? "none" : ""; }
  });
}
function lootReset(btn) {
  const r = btn.closest(".lootrow"), p = r && S.entries.get(r.dataset.ref); if (!p) return;
  const h = harvestOf(p); r.querySelector(".lt-qty").value = h.qty || ""; r.querySelector(".lt-wt").value = h.wt || ""; lootCalcAll();
}
document.addEventListener("input", ev => { if (ev.target.closest && (ev.target.closest("#loot-rows") || ev.target.id === "sb-subtitle")) lootCalcAll(); });
document.addEventListener("change", ev => { if (ev.target.id === "loot-size") lootCalcAll(); });
document.addEventListener("input", ev => { if (ev.target.id === "loot-garg") lootCalcAll(); });
let SIZECFG_OPEN = false;
document.addEventListener("toggle", ev => { if (ev.target.classList && ev.target.classList.contains("sizecfg")) SIZECFG_OPEN = ev.target.open; }, true);
function sizeCfgHtml() {
  return `<details class="sizecfg"${SIZECFG_OPEN ? " open" : ""}><summary>How much is “size”?</summary><p class="muted small">Formulas like “4^size” or “2 lb × size” use these numbers for the creature's size. Type a plain number on a creature to set it by hand.</p>
    <div class="frow tight">${SIZES.filter(s => s !== "Gargantuan").map(s => `<label><span>${s}</span><input type="text" inputmode="decimal" class="mini" data-hsize="${s}" value="${esc(sizeVal(s))}"></label>`).join("")}</div>
    <div class="gargcfg"><span class="flabel">Gargantuan range <strong id="garg-show">${gargRange()[0]}–${gargRange()[1]}</strong></span>
      <p class="muted small">Anything bigger than Huge. Each Gargantuan creature gets its own slider inside this range.</p>
      <div class="dualrange"><div class="drtrack"><div class="drfill" style="left:${gargRange()[0] / GARG_MAX * 100}%;right:${100 - gargRange()[1] / GARG_MAX * 100}%"></div></div>
        <input type="range" min="0" max="${GARG_MAX}" step="1" value="${gargRange()[0]}" data-garg="0" aria-label="Smallest Gargantuan size value"><input type="range" min="0" max="${GARG_MAX}" step="1" value="${gargRange()[1]}" data-garg="1" aria-label="Largest Gargantuan size value"></div>
      <div class="drticks"><span>0</span><span>5</span><span>10</span><span>15</span><span>20</span></div></div></details>`;
}
function gargRead(t) {
  const box = t.closest(".gargcfg"), [a, b] = [...box.querySelectorAll("[data-garg]")].map(i => Number(i.value));
  let lo = Math.min(a, b), hi = Math.max(a, b);
  box.querySelector("#garg-show").textContent = lo + "–" + hi;
  const f = box.querySelector(".drfill"); f.style.left = lo / GARG_MAX * 100 + "%"; f.style.right = 100 - hi / GARG_MAX * 100 + "%";
  return [lo, hi];
}
document.addEventListener("input", ev => { if (ev.target.dataset && ev.target.dataset.garg != null) gargRead(ev.target); });
document.addEventListener("change", async ev => {
  if (!ev.target.dataset || ev.target.dataset.garg == null) return;
  const garg = gargRead(ev.target);
  if (await safeWrite(() => S.db.doc("settings/harvest").set(Object.assign({}, S.harvestCfg, { garg })), `Gargantuan range set to ${garg[0]}–${garg[1]}`)) S.harvestCfg = Object.assign({}, S.harvestCfg, { garg });
});
document.addEventListener("change", async ev => {
  if (!ev.target.dataset || !ev.target.dataset.hsize) return;
  const sizes = Object.assign({}, (S.harvestCfg || {}).sizes); sizes[ev.target.dataset.hsize] = Number(ev.target.value) || 0;
  if (await safeWrite(() => S.db.doc("settings/harvest").set(Object.assign({}, S.harvestCfg, { sizes })), "Size values saved")) S.harvestCfg = Object.assign({}, S.harvestCfg, { sizes });
});
// Typing * in an available or weight box turns it into ×.
document.addEventListener("input", ev => {
  const t = ev.target; if (!t.matches || !t.matches(".lt-qty, .lt-wt, #hv-qty, #hv-wt") || !t.value.includes("*")) return;
  const pos = t.selectionStart; t.value = t.value.replace(/\*/g, "×");
  try { t.setSelectionRange(pos, pos); } catch (e) {}
}, true);
