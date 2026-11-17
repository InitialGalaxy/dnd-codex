// ---------- Feats: a library type with a paste-to-fill editor ----------
// e.feat = { kind, prereq, repeatable, src }   description lives in e.body
const FEAT_KINDS = ["General", "Origin", "Fighting Style", "Epic Boon", "Racial", "Other"];
const featEntries = () => [...S.entries].filter(([, e]) => e.type === "feat").sort((a, b) => byName(a[1].title, b[1].title));
const featByName = n => { const k = String(n || "").trim().toLowerCase(); return featEntries().find(([, e]) => e.title.trim().toLowerCase() === k) || null; };

function featHtml(id, e, noTitle) {
  const f = e.feat || {};
  const line = [f.kind ? f.kind + " feat" : "Feat", f.prereq ? "Prerequisite: " + f.prereq : ""].filter(Boolean).join(" · ");
  return `<div class="hbblock feat">
    <p class="hbkind">${esc(line)}${f.src ? ` <span class="srcpill">${esc(f.src)}</span>` : ""}</p>
    ${noTitle ? "" : `<h2 class="hbtitle">${esc(e.title)}</h2>`}
    ${e.image ? `<div class="hbimg">${imageHtml(e.image, e.title, id)}</div>` : ""}
    ${f.lore ? `<p class="hblore"><em>${esc(f.lore)}</em></p>` : ""}
    ${e.body && e.body.trim() ? `<div class="prose hbdesc">${md(e.body, { entryId: id, noEmbed: true })}</div>` : `<p class="muted">No description yet.</p>`}
    ${f.repeatable && !/repeatable/i.test(e.body || "") ? `<p class="small"><strong>Repeatable.</strong> ${esc(f.repeatable === true ? "You can take this feat more than once." : f.repeatable)}</p>` : ""}
  </div>`;
}
function featFields(e) {
  const f = e.feat || {};
  return `<div class="frow">
      <label><span>Kind</span><select id="ft-kind">${FEAT_KINDS.map(k => `<option${k === (f.kind || "General") ? " selected" : ""}>${k}</option>`).join("")}</select></label>
      <label class="grow"><span>Prerequisite <small class="muted">optional</small></span><input id="ft-prereq" type="text" value="${esc(f.prereq || "")}" placeholder="e.g. Strength 13 or higher, level 4+"></label>
      <label class="grow"><span>Source <small class="muted">optional</small></span><input id="ft-src" type="text" value="${esc(f.src || "")}" placeholder="e.g. Homebrew, SRD 5.1"></label>
    </div>
    <label class="check"><input type="checkbox" id="ft-rep"${f.repeatable ? " checked" : ""}> Can be taken more than once</label>
    <div class="field"><span class="flabel">Lore <small class="muted">optional flavour, shown in italics</small></span><textarea id="ft-lore" rows="3" placeholder="Where the technique comes from, who teaches it…">${esc(f.lore || "")}</textarea></div>
    <div class="field"><span class="flabel">Features</span><div id="ftsections" class="sbsections">${featDraft(e)}</div></div>`;
}
// The feat's text as a list of features (a name and what it does); text with no name stays as an unnamed paragraph.
// SRD feats write their parts as **Name.** (bold) rather than ***Name.***; those keep their style when saved.
function featItems(text) {
  return parseFeatures(text).flatMap(sec => sec.items).map(it => { const m = !it.name && String(it.desc).match(/^\*\*([^*]+?)\.\*\*\s+([\s\S]*)$/); return m ? { name: m[1].trim(), desc: m[2].trim(), b2: true } : it; });
}
function featDraft(e) {
  DRAFT.ft = [{ name: "", items: featItems(e.type === "feat" ? e.body : "") }];
  if (!DRAFT.ft[0].items.length) DRAFT.ft[0].items.push({ name: "", desc: "" });
  return sectionsHtml("ft");
}
function readFeatFields() {
  const v = id => (($("#" + id) || {}).value || "").trim();
  const out = { kind: v("ft-kind") || "General", prereq: v("ft-prereq"), src: v("ft-src") };
  if (v("ft-lore")) out.lore = v("ft-lore");
  if (($("#ft-rep") || {}).checked) out.repeatable = true;
  return out;
}
// Reads a pasted feat: name, "Prerequisite: …", "Origin Feat (Prerequisite: …)" style lines, "Repeatable", and the text.
function parseFeatText(raw) {
  let lines = String(raw || "").replace(/\r/g, "").replace(/ /g, " ").split("\n").map(l => l.trim());
  while (lines.length && !lines[0]) lines.shift();
  const out = { name: "", kind: "", prereq: "", repeatable: false, desc: "" };
  const clean = l => l.replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").replace(/^_+|_+$/g, "").trim();
  if (lines.length) out.name = clean(lines.shift()).replace(/\s*\[.*?\]\s*$/, "");
  const rest = [];
  for (const l0 of lines) {
    const l = clean(l0);
    let m;
    if ((m = l.match(/^(origin|general|fighting style|epic boon|racial)\s+feat\b\s*(?:\((?:prerequisites?\s*:?\s*)?([^)]*)\))?/i))) { out.kind = FEAT_KINDS.find(k => k.toLowerCase() === m[1].toLowerCase()) || ""; if (m[2]) out.prereq = m[2].trim(); continue; }
    if ((m = l.match(/^prerequisites?\s*:\s*(.+)$/i))) { out.prereq = m[1].replace(/\.$/, "").trim(); continue; }
    if (/^repeatable\b/i.test(l)) { out.repeatable = true; const t = l.replace(/^repeatable\.?\s*/i, ""); if (t) rest.push("**Repeatable.** " + t); continue; }
    rest.push(l0.replace(/^[•●▪]\s*/, "- "));
  }
  // Each line is its own paragraph, except list items, which stay together.
  out.desc = rest.reduce((t, l) => t + (t ? (/^- /.test(l) && /(^|\n)- [^\n]*$/.test(t) ? "\n" : "\n\n") : "") + l, "").replace(/\n{3,}/g, "\n\n").trim()
    // A short "Title Case Words." at the start of a line is a benefit name: make it bold like the books do.
    .replace(/^(?!- |\*\*)([A-Z][\w'’-]*(?: [A-Z][\w'’-]*| of| the| and| to){0,5})\. (?=\S)/gm, "**$1.** ");
  if (!out.kind && /fighting style/i.test(out.prereq)) out.kind = "Fighting Style";
  return out;
}
function featImportApply(text) {
  const p = parseFeatText(text != null ? text : ($("#ft-paste") || {}).value); if (!p.name && !p.desc) { toast("Couldn't find a feat in that text.", "bad"); return; }
  const set = (id, v) => { const el = $("#" + id); if (el && v != null && v !== "") { if (el.type === "checkbox") el.checked = !!v; else el.value = v; } };
  if (p.name) set("ed-title", p.name);
  set("ft-kind", p.kind); set("ft-prereq", p.prereq); if (p.repeatable) set("ft-rep", true);
  if (p.desc) { DRAFT.ft = [{ name: "", items: featItems(p.desc) }]; if (!DRAFT.ft[0].items.length) DRAFT.ft[0].items.push({ name: "", desc: "" }); redrawSections(null, "ft"); }
  const det = $("#ft-import"); if (det) det.open = false;
  toast(`Filled in ${[p.name && "name", p.kind && "kind", p.prereq && "prerequisite", p.desc && "description"].filter(Boolean).join(", ") || "what it could"}. Check it over before saving.`);
}

// One-time: put the SRD races and feats into the library (skipping any you already have with the same name).
async function migrateSrdFeatsRaces() {
  if (MIG_DONE.srdFeatsRaces) return;
  migrating = true;
  try {
    const now = new Date().toISOString(), have = t => [...S.entries.values()].some(e => e.type === t[0] && e.title.trim().toLowerCase() === t[1].toLowerCase());
    let n = 0;
    for (const r of SRD_RACE_DOCS) { if (have(["race", r.title])) continue; const id = newId(); await S.db.doc("entries/" + id).set({ type: "race", title: r.title, race: r.race, body: r.body, tags: [], srd: "SRD 5.1", created: now, updated: now }); n++; }
    for (const f of SRD_FEAT_DOCS) { if (have(["feat", f.title])) continue; const id = newId(); await S.db.doc("entries/" + id).set({ type: "feat", title: f.title, feat: f.feat, body: f.body, tags: [], srd: f.feat.src, created: now, updated: now }); n++; }
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { srdFeatsRaces: true }));
    MIG_DONE.srdFeatsRaces = true;
    if (n) toast(`Added ${n} SRD races and feats to the library`);
  } catch (e) { console.warn("SRD races and feats import failed", e); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}
