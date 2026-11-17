// ---------- SRD search: official 2014 equipment you can copy into the codex ----------
const SRD_GROUPS = [["weapon", "Weapons"], ["armour", "Armour"], ["gear", "Gear"]];
const SRDS = { q: "", group: "", open: null };
const SRD_BY_ID = new Map(SRD_EQUIP.map(x => [x.id, x]));
function srdInCodex(sid) { for (const [id, e] of S.entries) if (e.srd === sid) return id; return null; }
function srdStat(x) {
  const k = x.group;
  if (k === "weapon") return damageText(x.item.stats);
  if (k === "armour") { const a = acText(x.item.stats, x.item.category === "Shield"); return a ? "AC " + a : ""; }
  return "";
}
function srdMatches() {
  const q = SRDS.q.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
  return SRD_EQUIP.filter(x => (!SRDS.group || x.group === SRDS.group) && words.every(w => (x.title + " " + x.sub + " " + x.item.category + " " + x.item.base).toLowerCase().includes(w)))
    .sort((a, b) => {
      if (q) { const sa = a.title.toLowerCase().startsWith(q) ? 0 : 1, sb = b.title.toLowerCase().startsWith(q) ? 0 : 1; if (sa !== sb) return sa - sb; }
      return byName(a.title, b.title);
    });
}
function srdResultsHtml() {
  const list = srdMatches();
  const can = !READONLY && !!S.db;
  if (!list.length) return `<div class="empty"><p>Nothing in the SRD matches “${esc(SRDS.q)}”.</p></div>`;
  return `<p class="muted small">${list.length} result${list.length === 1 ? "" : "s"}</p><ul class="srdlist">${list.map(x => {
    const have = srdInCodex(x.id), open = SRDS.open === x.id;
    return `<li class="srdrow${open ? " open" : ""}">
      <button class="srdhead" data-act="srdopen" data-v="${esc(x.id)}" aria-expanded="${open}">
        <span class="srdname"><strong>${esc(x.title)}</strong><span class="muted">${esc(x.sub)}</span></span>
        <span class="srdstat">${esc(srdStat(x))}</span><span class="srdcost">${esc(costText(x.item.stats))}</span>
      </button>
      <span class="srdact">${have ? `<a class="btn ghost small" href="#entry-${esc(have)}">In codex · Open</a>` : can ? `<button class="btn small" data-act="srdcopy" data-v="${esc(x.id)}">Copy to codex</button>` : ""}</span>
      ${open ? `<div class="srdprev">${itemPageHtml("", srdEntry(x)).replace(/<div class="iimg"><button[^>]*data-act="(addlore|portrait)"[^>]*>[^<]*<\/button><\/div>/g, "")}</div>` : ""}
    </li>`;
  }).join("")}</ul>`;
}
function srdEntry(x) {
  const item = JSON.parse(JSON.stringify(x.item));
  item.meta = buildItemLine(item);
  return { title: x.title, type: "item", tags: [], body: x.body, item, srd: x.id, source: "SRD 5.1 (2014)" };
}
function viewSrd() {
  const cnt = g => SRD_EQUIP.filter(x => !g || x.group === g).length;
  return `<section class="srd">
    <div class="libhead"><h1>SRD equipment</h1><p class="muted">Official 2014 weapons, armour and gear. Copy any of them into your Items to use or homebrew.</p>
      <div class="segrow"><div class="seg kindseg" role="group" aria-label="Kind">${[["", "All"], ...SRD_GROUPS].map(([g, l]) => `<button class="${SRDS.group === g ? "on" : ""}" data-act="srdgroup" data-v="${g}" aria-pressed="${SRDS.group === g}">${l} <span>${cnt(g)}</span></button>`).join("")}</div></div>
      <label class="search big"><span class="sr">Search the SRD</span><input id="srdq" type="search" placeholder="Search, e.g. longsword, chain mail, rope" value="${esc(SRDS.q)}" autocomplete="off"></label>
    </div>
    <div id="srdresults">${srdResultsHtml()}</div>
    <p class="muted small srdcredit">Contains material from the System Reference Document 5.1 and 5.2 by Wizards of the Coast LLC, licensed under CC-BY-4.0.</p>
  </section>`;
}
async function srdAction(a, el) {
  if (a === "srdgroup") { SRDS.group = el.dataset.v; SRDS.open = null; render(); return true; }
  if (a === "srdopen") { SRDS.open = SRDS.open === el.dataset.v ? null : el.dataset.v; const r = $("#srdresults"); if (r) r.innerHTML = srdResultsHtml(); return true; }
  if (a === "srdcopy") {
    const x = SRD_BY_ID.get(el.dataset.v); if (!x || srdInCodex(x.id)) return true;
    const now = new Date().toISOString(), id = newId();
    const doc = Object.assign(srdEntry(x), { created: now, updated: now });
    el.disabled = true; el.textContent = "Copying…";
    if (await safeWrite(() => S.db.doc("entries/" + id).set(doc), `${x.title} added to Items`)) { S.entries.set(id, doc); }
    const r = $("#srdresults"); if (r) r.innerHTML = srdResultsHtml();
    return true;
  }
  return false;
}
