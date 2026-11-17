// ---------- Proficiencies: picked from the codex's own item types and items ----------
// A character's armour, weapon and tool proficiencies are lists of tags:
//   "cat:Martial weapon"  any item with that category
//   "arm:light|medium|heavy"  armour of that weight (from the item's base, or worked out from its Dex rule)
//   "w:longsword", "a:plate", "t:thieves' tools"  one kind of item, matched on its base or its name
// Older sheets kept free text ("Simple weapons, longswords"); profList() reads those as tags until the sheet is next edited.
const PROF_KINDS = [["armour", "Armour"], ["weapons", "Weapons"], ["tools", "Tools"]];
function profNorm(s) { return String(s || "").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim(); }
function profSing(s) { return profNorm(s).replace(/(ch|sh|x|ss)es$/, "$1").replace(/([^s])s$/, "$1"); }
function profItems() {
  const out = SRD_EQUIP.map(x => ({ title: x.title, item: x.item }));
  for (const e of S.entries.values()) if (e.type === "item" && e.item && !(PLAYER && e.hidden)) out.push(e);
  return out;
}
function armourWeight(e) {
  const it = e.item || {};
  if (/shield/i.test(it.category || "")) return "shield";
  const b = profNorm(it.base); if (/^(light|medium|heavy)$/.test(b)) return b;
  const st = it.stats || {};
  if (st.dex === false) return "heavy";
  if (String(st.dexMax || "").trim()) return "medium";
  return st.dex ? "light" : "";
}
// The name an item is known by for proficiency: its base ("longsword" for Killipheir), else its title.
function profItemName(e) { const it = e.item || {}, b = profNorm(it.base); return b && !/^(light|medium|heavy)$/.test(b) ? b : profNorm(e.title); }
function profOptions(kind) {
  const items = profItems(), opts = [], seen = new Set();
  const push = (v, l) => { if (!seen.has(v)) { seen.add(v); opts.push([v, l]); } };
  const cats = want => [...new Set(items.filter(e => itemKind(e) === want).map(e => String((e.item || {}).category || "").trim()).filter(Boolean))];
  // Shown as first typed (base or title), with a capital first letter; matched lower-case.
  const names = (want, pre) => { const m = new Map(); items.filter(want).forEach(e => { const it = e.item || {}, n = profItemName(e), raw = String(n === profNorm(it.base) ? it.base : e.title).trim(); if (n && !m.has(n)) m.set(n, raw.charAt(0).toUpperCase() + raw.slice(1)); }); return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([n, l]) => [pre + n, l]); };
  if (kind === "weapons") {
    ["Simple weapon", "Martial weapon", "Ranged weapon", ...cats("weapon").sort()].forEach(c => push("cat:" + c, c + "s"));
    names(e => itemKind(e) === "weapon", "w:").forEach(o => push(...o));
  } else if (kind === "armour") {
    [["arm:light", "Light armour"], ["arm:medium", "Medium armour"], ["arm:heavy", "Heavy armour"], ["cat:Shield", "Shields"]].forEach(o => push(...o));
    cats("armour").filter(c => !/^(armou?r|shield)$/i.test(c)).sort().forEach(c => push("cat:" + c, c));
    names(e => itemKind(e) === "armour" && armourWeight(e) !== "shield", "a:").forEach(o => push(...o));
  } else {
    [...new Set(items.filter(e => /^(tool|kit)s?$/i.test(String((e.item || {}).category || "").trim())).map(e => profNorm(e.title)))].sort().forEach(n => push("t:" + n, n.charAt(0).toUpperCase() + n.slice(1)));
  }
  return opts;
}
function profLabel(kind, v, opts) { const o = (opts || profOptions(kind)).find(x => x[0] === v); return o ? o[1] : String(v).replace(/^(cat|arm|[wat]):/, ""); }
function profKnown(v) { return /^(cat|arm|[wat]):/.test(v); }
// Free text from an old sheet or a class's basics → tags. Anything that matches nothing is kept as typed.
function profParse(kind, text, opts) {
  opts = opts || profOptions(kind);
  const out = [], add = v => { if (v && !out.includes(v)) out.push(v); };
  String(text || "").split(/\s*(?:,|;|\n|\band\b)\s*/i).map(s => s.trim().replace(/\.$/, "")).filter(s => s && !/^none$/i.test(s)).forEach(p => {
    const n = profNorm(p), s1 = profSing(p);
    if (kind === "tools" && /choice|one type|any one|of your|^one |^three |^two /i.test(n)) return; // "one musical instrument of your choice" is a choice, not a proficiency
    if (kind === "weapons") { if (/^simple( weapons?)?$/.test(n)) return add("cat:Simple weapon"); if (/^martial( weapons?)?$/.test(n)) return add("cat:Martial weapon"); }
    if (kind === "armour") {
      if (/^all armou?r$/.test(n)) { ["light", "medium", "heavy"].forEach(w => add("arm:" + w)); return; }
      const m = n.match(/^(light|medium|heavy)( armou?r)?$/); if (m) return add("arm:" + m[1]);
      if (/^shields?$/.test(n)) return add("cat:Shield");
    }
    const hit = opts.find(o => { const l = profNorm(o[1]), id = o[0].replace(/^(cat|arm|[wat]):/, ""); return l === n || profSing(o[1]) === s1 || id === n || id === s1; });
    add(hit ? hit[0] : p.replace(/^\w/, ch => ch.toUpperCase()));
  });
  return out;
}
function profList(c, kind) { const v = (c.profs || {})[kind]; return Array.isArray(v) ? v.filter(Boolean) : profParse(kind, v); }
// true/false: proficient or not. null: no weapons listed at all, so old blank sheets keep their to-hit bonus. Armour with nothing listed is not proficient.
function profHas(c, kind, e) {
  const list = profList(c, kind); if (!list.length) return kind === "armour" ? false : null;
  const it = e.item || {}, cat = profNorm(it.category), weight = kind === "armour" ? armourWeight(e) : "";
  const names = new Set([it.base, e.title].filter(Boolean).flatMap(x => [profNorm(x), profSing(x)]));
  return list.some(v => {
    if (v.startsWith("cat:")) return profNorm(v.slice(4)) === cat;
    if (v.startsWith("arm:")) return weight === v.slice(4);
    if (/^[wat]:/.test(v)) return names.has(v.slice(2));
    return names.has(profNorm(v)) || names.has(profSing(v)) || (cat && (cat === profSing(v) || cat === profNorm(v)));
  });
}
function profSectionHtml(c, E) {
  const pr = c.profs || {};
  const rows = PROF_KINDS.map(([k, l]) => {
    const opts = profOptions(k), list = profList(c, k), odd = list.filter(v => !profKnown(v));
    const body = E
      ? `${tagPickHtml("cprof-" + k, opts, list, { free: k === "tools", ph: k === "weapons" ? "Add a weapon type or weapon…" : k === "armour" ? "Add an armour type or armour…" : "Add a tool…" })}
        ${odd.length && k !== "tools" ? `<p class="profwarn small">${odd.map(v => `“${esc(v)}”`).join(", ")} ${odd.length === 1 ? "doesn't" : "don't"} match any item type or item in the codex, so ${odd.length === 1 ? "it gives" : "they give"} no proficiency. Remove ${odd.length === 1 ? "it" : "them"} and pick from the list.</p>` : ""}`
      : list.length ? `<span class="pchips">${list.map(v => `<span class="pchip${profKnown(v) ? "" : " free"}"${profKnown(v) ? "" : ` title="Not linked to an item type in the codex"`}>${esc(profLabel(k, v, opts))}</span>`).join("")}</span>` : `<span class="cv">—</span>`;
    return `<div><dt>${l}</dt><dd>${body}</dd></div>`;
  }).join("");
  const lang = `<div><dt>Languages</dt><dd>${E ? cField("profs.languages", pr.languages) : `<span class="cv">${esc(pr.languages || "—")}</span>`}</dd></div>`;
  return `<dl class="proflist">${rows}${lang}</dl>${E ? `<p class="muted small">Weapons and armour come from the item categories and items in the codex. A weapon you're not proficient with loses your proficiency bonus to hit; armour shows a warning. Leave weapons empty to count every weapon as proficient (older sheets rely on this).</p>` : ""}`;
}
document.addEventListener("tpkchange", ev => {
  const w = ev.target, m = /^cprof-(\w+)$/.exec((w.dataset || {}).tpk || ""); if (!m) return;
  const sh = w.closest(".sheet"), id = sh && sh.dataset.id; if (!id) return;
  const vals = tagPickRead(w.dataset.tpk);
  charChange(id, c => { c.profs = Object.assign({}, c.profs); c.profs[m[1]] = vals; }, false);
});
