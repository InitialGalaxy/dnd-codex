// ---------- Part sets: a named, tagged group of harvested parts ----------
// e.type "partset", e.partset = { parts: [itemId, …] }, e.tags = which creatures it suits (e.g. "beast").
// Editing a creature suggests the part sets whose tags match the creature's tags (or their parents).
const PS = { ids: [], q: "", drag: null };
const harvestParts = () => [...S.entries].filter(([, e]) => isHarvest(e)).sort((a, b) => byName(a[1].title, b[1].title));
function psChip(id, e, inSet) {
  const h = harvestOf(e);
  return `<div class="pschip${inSet ? " inset" : ""}" draggable="true" data-pid="${esc(id)}" role="button" tabindex="0" title="${inSet ? "Drag out or press ✕ to remove" : "Drag into the set, or click to add"}">
    <span class="psico">${e.image ? `<img src="${esc(e.image)}" alt="">` : "✦"}</span><span class="psname">${esc(e.title)}</span>${h.dc ? `<span class="psdc">DC ${esc(h.dc)}</span>` : ""}
    ${inSet ? `<button type="button" class="psx" data-psx="${esc(id)}" aria-label="Remove ${esc(e.title)}">✕</button>` : ""}</div>`;
}
function partsetFields(e) {
  return `<div class="psed">
    <div class="pscol"><span class="flabel">Harvested parts <small class="muted">drag into the set, or click one</small></span>
      <input id="ps-q" type="text" placeholder="Search parts…" autocomplete="off">
      <div id="ps-pal" class="psgrid psdrop" data-zone="pal"></div></div>
    <div class="pscol"><span class="flabel">In this set <span class="muted small" id="ps-n"></span></span>
      <div id="ps-set" class="psgrid psdrop psset" data-zone="set"></div>
      <p class="muted small">Tag the set (above) with a creature type, like Beast. Creatures with that tag will suggest these parts when you edit them.</p></div>
  </div>`;
}
function psInit(e) { PS.ids = [...(((e || {}).partset || {}).parts || [])].filter(id => S.entries.has(id)); PS.q = ""; psDraw(); }
function psDraw() {
  const pal = $("#ps-pal"), set = $("#ps-set"); if (!pal || !set) return;
  const q = PS.q.toLowerCase();
  const avail = harvestParts().filter(([id, e]) => !PS.ids.includes(id) && (!q || e.title.toLowerCase().includes(q)));
  pal.innerHTML = avail.map(([id, e]) => psChip(id, e, false)).join("") || `<p class="muted small">${harvestParts().length ? "All parts are in the set." : "No harvested parts yet. Add some from Items → Harvested parts."}</p>`;
  set.innerHTML = PS.ids.map(id => psChip(id, S.entries.get(id), true)).join("") || `<p class="psempty">Drop parts here</p>`;
  $("#ps-n").textContent = PS.ids.length ? `${PS.ids.length} part${PS.ids.length === 1 ? "" : "s"}` : "";
}
function psAdd(id, before) { if (!id || !S.entries.has(id)) return; PS.ids = PS.ids.filter(x => x !== id); const k = before ? PS.ids.indexOf(before) : -1; if (k >= 0) PS.ids.splice(k, 0, id); else PS.ids.push(id); psDraw(); }
function psRemove(id) { PS.ids = PS.ids.filter(x => x !== id); psDraw(); }
const readPartsetFields = () => ({ parts: PS.ids.slice() });
document.addEventListener("input", ev => { if (ev.target.id === "ps-q") { ev.stopPropagation(); PS.q = ev.target.value; psDraw(); } }, true);
document.addEventListener("click", ev => {
  const x = ev.target.closest && ev.target.closest("[data-psx]"); if (x) { ev.preventDefault(); psRemove(x.dataset.psx); return; }
  const c = ev.target.closest && ev.target.closest("#ps-pal .pschip"); if (c) psAdd(c.dataset.pid);
});
document.addEventListener("keydown", ev => { const c = ev.target.closest && ev.target.closest(".pschip"); if (c && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); if (c.classList.contains("inset")) psRemove(c.dataset.pid); else psAdd(c.dataset.pid); } });
document.addEventListener("dragstart", ev => { const c = ev.target.closest && ev.target.closest(".pschip"); if (!c) return; PS.drag = c.dataset.pid; ev.dataTransfer.effectAllowed = "move"; try { ev.dataTransfer.setData("text/plain", c.dataset.pid); } catch (e) {} c.classList.add("dragging"); });
document.addEventListener("dragend", () => { PS.drag = null; document.querySelectorAll(".pschip.dragging, .psdrop.over").forEach(n => n.classList.remove("dragging", "over")); });
document.addEventListener("dragover", ev => { const z = PS.drag && ev.target.closest && ev.target.closest(".psdrop"); if (!z) return; ev.preventDefault(); z.classList.add("over"); });
document.addEventListener("dragleave", ev => { const z = ev.target.closest && ev.target.closest(".psdrop"); if (z && !z.contains(ev.relatedTarget)) z.classList.remove("over"); });
document.addEventListener("drop", ev => {
  const z = PS.drag && ev.target.closest && ev.target.closest(".psdrop"); if (!z) return;
  ev.preventDefault(); z.classList.remove("over");
  if (z.dataset.zone === "set") { const over = ev.target.closest(".pschip.inset"); psAdd(PS.drag, over && over.dataset.pid !== PS.drag ? over.dataset.pid : null); }
  else psRemove(PS.drag);
  PS.drag = null;
});

function partsetHtml(id, e) {
  const ids = ((e.partset || {}).parts || []).filter(x => S.entries.has(x));
  const tags = e.tags || [];
  const fits = tags.length ? [...S.entries].filter(([, c]) => c.type === "creature" && (c.tags || []).some(t => tags.includes(t) || ancestors(t).some(a => tags.includes(a)))).length : 0;
  return `<p class="muted">${ids.length} part${ids.length === 1 ? "" : "s"}${tags.length ? ` · suggested for ${fits} creature${fits === 1 ? "" : "s"} tagged ${tags.map(t => esc(tagName(t))).join(" or ")}` : " · add a tag so creatures can find this set"}</p>
    ${ids.length ? `<div class="loot"><div class="lootgrid wide">${ids.map(x => harvestCardHtml(x, S.entries.get(x), "full")).join("")}</div></div>` : `<p class="muted">No parts in this set yet.</p>`}`;
}

// ----- In the creature editor: suggestions from matching part sets -----
function creatureTagSet() { const s = new Set(); (draftTags || []).forEach(t => { s.add(t); ancestors(t).forEach(a => s.add(a)); }); return s; }
function lootSuggestDraw() {
  const box = $("#loot-suggest"); if (!box) return;
  const tags = creatureTagSet();
  const sets = [...S.entries].filter(([, e]) => e.type === "partset" && (e.tags || []).some(t => tags.has(t)));
  const have = new Set([...document.querySelectorAll("#loot-rows .lootrow")].map(r => r.dataset.ref || r.querySelector(".lt-n").value.trim().toLowerCase()));
  const chip = pid => { const p = S.entries.get(pid); if (!p) return ""; const on = have.has(pid) || have.has(p.title.toLowerCase());
    return `<button type="button" class="lootsugbtn${on ? " on" : ""}" data-act="lootpick" data-v="${esc(pid)}"${on ? " disabled" : ""}>${on ? "✓" : "+"} ${esc(p.title)}</button>`; };
  box.innerHTML = sets.length ? sets.map(([sid, s]) => `<div class="lootsug"><div class="lootsughead"><b>${esc(s.title)}</b><span class="muted small">part set · ${(s.tags || []).map(t => esc(tagName(t))).join(", ")}</span><button type="button" class="btn ghost small" data-act="lootpickall" data-v="${esc(sid)}">Add all</button></div>
      <div class="lootsugrow">${((s.partset || {}).parts || []).map(chip).join("")}</div></div>`).join("")
    : `<p class="muted small">${draftTags.length ? "No part sets match this creature's tags." : "Tag this creature (for example Beast) to see matching part sets."} You can make one with + New entry → Part set.</p>`;
  const dl = $("#loot-partlist"); if (dl) dl.innerHTML = harvestParts().map(([, e]) => `<option value="${esc(e.title)}"></option>`).join("");
}
function lootAddPart(pid) {
  const p = S.entries.get(pid); if (!p) return;
  const h = harvestOf(p);
  $("#loot-rows").insertAdjacentHTML("beforeend", lootRow({ ref: pid, n: p.title, dc: h.dc, qty: h.qty, wt: h.wt, img: p.image || "" }));
  lootSuggestDraw(); lootCalcAll();
}
function lootAddByName() {
  const inp = $("#loot-addname"), v = (inp.value || "").trim(); if (!v) return;
  const hit = harvestParts().find(([, e]) => e.title.toLowerCase() === v.toLowerCase());
  if (hit) lootAddPart(hit[0]); else { $("#loot-rows").insertAdjacentHTML("beforeend", lootRow({ n: v })); lootSuggestDraw(); }
  inp.value = "";
}
