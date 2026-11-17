// ---------- One-time move: creatures, spells and subclasses written in books become embedded library entries ----------
// Each book's original text is kept in settings/backup-<bookId> first.
// - Creatures: a heading that names a bestiary creature (and the text under it, down to the next heading) becomes {{embed:id}}.
//   Any paragraph in the book that the entry doesn't already have is added to the entry, so nothing is lost.
// - Subclasses: a "## …" section under "# Classes" with real features becomes a subclass entry.
// - Spells: a spell written as a one-cell table under "# Spells" becomes a spell entry.
const MIG_N = s => String(s || "").toLowerCase().replace(/\\(.)/g, "$1").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const MIG_K = s => MIG_N(s).replace(/ /g, "");
const migTitleKey = t => MIG_K(String(t).replace(/\\(.)/g, "$1").replace(/\s+-\s+.*$/, ""));
const migHead = l => { const m = String(l).match(/^(#{1,6})(?:\s+(.*))?$/); return m ? { lv: m[1].length, t: (m[2] || "").trim() } : null; };
const migSlug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleCase = s => String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

function migCovered(para, entryParas, entryAll) {
  const p = MIG_N(para); if (!p) return true;
  if (entryAll.includes(p.replace(/ /g, ""))) return true;
  return entryParas.some(q => similar(p, q));
}
// Section of level-1 heading `name` → [start, end) line indices, or null.
function migTop(lines, name) {
  const s = lines.findIndex(l => { const h = migHead(l); return h && h.lv === 1 && h.t.toLowerCase() === name; });
  if (s < 0) return null;
  let e = s + 1; while (e < lines.length && !((migHead(lines[e]) || {}).lv === 1)) e++;
  return [s, e];
}
function migLevel(text, fallback) {
  const m = String(text).match(/(\d+)(?:st|nd|rd|th)\s+level|level\s+(\d+)/i);
  return m ? Number(m[1] || m[2]) : fallback;
}
function migParseSpell(cell) {
  const t = String(cell).replace(/\\(.)/g, "$1").replace(/\s+/g, " ").trim();
  const name = t.split("#")[0].trim();
  const lm = t.match(/\*\*\*\s*(\d)(?:st|nd|rd|th)[- ]level,?\s*([A-Za-z]+)\s*\*\*\*/i) || t.match(/\*\*\*\s*([A-Za-z]+)\s+cantrip\s*\*\*\*/i);
  const field = (label, next) => { const m = t.match(new RegExp("\\*\\*" + label + "\\*\\*\\s*(.*?)(?=\\*\\*(?:" + next + ")\\*\\*)", "i")); return m ? m[1].trim() : ""; };
  const durM = t.match(/\*\*Duration\*\*\s*(-|—|Instantaneous|Permanent|Until dispelled|Concentration, up to [^A-Z]*?\d+ \w+|[^A-Z]*?\d+ \w+)\s*(?=[A-Z])/);
  const afterDur = durM ? t.slice(t.indexOf(durM[0]) + durM[0].length) : "";
  const [desc, higher] = afterDur.split(/\*\*\*\s*At Higher Levels\.?\s*\*\*\*/i);
  if (!name || !lm) return null;
  const level = /^\d$/.test(lm[1]) ? Number(lm[1]) : 0, school = titleCase(/^\d$/.test(lm[1]) ? lm[2] : lm[1]);
  let comp = field("Components", "Duration");
  const parts = comp.split(/,\s*(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
  const order = ["V", "S"]; const vs = order.filter(k => parts.includes(k)), mat = parts.filter(x => x.startsWith("M"));
  if (vs.length || mat.length) comp = [...vs, ...mat].join(", ");
  const dur = durM ? durM[1].trim() : "";
  return { name: titleCase(name), level, school, time: field("Casting Time", "Range"), range: field("Range", "Components"), comp, dur: dur === "-" || dur === "—" ? "Permanent" : dur,
    desc: (desc || "").trim().replace(/\s*\|\s*$/, ""), higher: (higher || "").trim().replace(/\s*\|\s*$/, "") };
}

const MIG_DONE = {};
async function migrateBookEmbeds() {
  if (migrating || MIG_DONE.bookEmbeds) return;
  migrating = true; MIG_DONE.bookEmbeds = true;
  const report = { creatures: 0, added: 0, subclasses: [], spells: [], books: [] };
  try {
    const now = new Date().toISOString();
    const entries = new Map([...S.entries].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    const touched = new Set(), created = new Set();
    const byTitle = new Map();
    for (const [id, e] of entries) if (e.type === "creature") { const k = migTitleKey(e.title); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(id); }
    const classNames = allClassNames();
    const bookOut = new Map();
    for (const [bid, b] of S.books) {
      const orig = String(b.body || ""); let lines = orig.split("\n"); let changed = false;

      // Subclasses
      const cl = migTop(lines, "classes");
      if (cl) {
        const heads = []; for (let i = cl[0] + 1; i < cl[1]; i++) { const h = migHead(lines[i]); if (h && h.lv === 2 && h.t) heads.push(i); }
        for (const i of heads.reverse()) {
          let end = i + 1; while (end < cl[1] && !((migHead(lines[end]) || {}).lv <= 2) && !EMBED_RE.test(lines[end])) end++;
          const sec = lines.slice(i + 1, end), head = migHead(lines[i]).t.replace(/\\(.)/g, "$1");
          const desc = [], feats = []; let cur = null;
          for (const l of sec) { const h = migHead(l); if (h && h.lv === 3) { cur = { n: h.t.replace(/\\(.)/g, "$1"), d: [] }; feats.push(cur); continue; } (cur ? cur.d : desc).push(l); }
          const real = feats.filter(f => !/^asdf$/i.test(f.n) && f.d.join(" ").replace(/[\s\\]/g, "").length > 30);
          if (real.length < 2) continue; // an empty heading or a template still being drafted
          let m, title = head, cls = "";
          if ((m = head.match(/^(\w+)\s+(?:subclass|archetype)\s*:?\s*(.+)$/i))) { cls = m[1]; title = m[2]; }
          cls = classNames.find(c => new RegExp("\\b" + c + "\\b", "i").test(cls || head)) || "";
          if (!cls) { const txt = sec.join(" "); let best = 0; for (const c of classNames) { const n = (txt.match(new RegExp("\\b" + c + "\\b", "gi")) || []).length; if (n > best) { best = n; cls = c; } } }
          if (!cls) continue;
          let lastLv = (SRD_CLASS_FEATS[cls] || {}).subLv || 3;
          const features = feats.map(f => { const d = f.d.join("\n").trim(); const lv = migLevel(d, lastLv); lastLv = lv; return { n: f.n, lv, d }; });
          const existing = [...entries].find(([, e]) => e.type === "subclass" && MIG_K(e.title) === MIG_K(title));
          const eid = existing ? existing[0] : "subclass-" + migSlug(title);
          if (!existing) { entries.set(eid, { title, type: "subclass", tags: [], body: desc.join("\n").trim(), subclass: { cls, features }, source: bid, created: now, updated: now }); created.add(eid); report.subclasses.push(title + " (" + cls + ")"); }
          lines.splice(i, end - i, embedToken(eid), "");
          changed = true;
        }
      }

      // Spells
      const sp = migTop(lines, "spells");
      if (sp) {
        for (let i = sp[1] - 1; i > sp[0]; i--) {
          if (!lines[i].trim().startsWith("|")) continue;
          let s = i; while (s > sp[0] && lines[s - 1].trim().startsWith("|")) s--;
          const block = lines.slice(s, i + 1), cells = block.map(l => l.trim().replace(/^\||\|$/g, "").trim()).filter(c => c && !/^:?-+:?$/.test(c));
          const cell = cells.find(c => /Casting Time/i.test(c));
          const parsed = cell && migParseSpell(cell);
          if (parsed) {
            const existing = [...entries].find(([, e]) => e.type === "spell" && MIG_K(e.title) === MIG_K(parsed.name));
            const eid = existing ? existing[0] : "spell-" + migSlug(parsed.name);
            if (!existing) {
              entries.set(eid, { title: parsed.name, type: "spell", tags: [], body: parsed.desc, source: bid, created: now, updated: now,
                spell: { level: parsed.level, school: parsed.school, time: parsed.time, range: parsed.range, comp: parsed.comp, dur: parsed.dur, conc: /concentration/i.test(parsed.dur), ritual: false, classes: "", attack: "", save: "", half: false, dmg: "", dtype: "", scale: "", heal: "", aoe: null, higher: parsed.higher } });
              created.add(eid); report.spells.push(parsed.name);
            }
            lines.splice(s, i + 1 - s, embedToken(eid)); changed = true;
          }
          i = s;
        }
      }

      // Creatures (bottom-up so line numbers stay valid)
      for (let i = lines.length - 1; i >= 0; i--) {
        const h = migHead(lines[i]); if (!h || h.lv < 2 || !h.t) continue;
        const ids = byTitle.get(migTitleKey(h.t)); if (!ids) continue;
        const id = ids.find(x => entries.get(x).source === bid) || ids[0], e = entries.get(id);
        let end = i + 1; while (end < lines.length && !migHead(lines[end]) && !EMBED_RE.test(lines[end])) end++;
        const paras = lines.slice(i + 1, end).join("\n").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        const sbText = e.statblock ? MIG_K(JSON.stringify(e.statblock)) : "";
        const eParas = String(e.body || "").split(/\n\s*\n/).map(MIG_N).filter(Boolean);
        const eAll = MIG_K(e.body) + sbText;
        const missing = paras.filter(p => !(p.startsWith("|") && e.statblock) && !migCovered(p, eParas, eAll));
        if (missing.length) { e.body = [String(e.body || "").trim(), ...missing].filter(Boolean).join("\n\n"); e.updated = now; touched.add(id); report.added += missing.length; }
        lines.splice(i, end - i, embedToken(id), "");
        changed = true; report.creatures++;
      }

      if (changed) {
        const body = lines.join("\n").replace(/\n{3,}/g, "\n\n");
        if (body !== orig) bookOut.set(bid, { orig, body });
      }
    }
    // The Artificer class, so the Siege Creation Artificer has a class to belong to.
    if (!entries.has("class-artificer")) { entries.set("class-artificer", artificerClassDoc(now)); created.add("class-artificer"); }
    // Write: backups first, then entries, then books.
    for (const [bid, { orig }] of bookOut) await S.db.doc("settings/backup-" + bid).set({ body: orig, at: now, reason: "Before moving creatures, spells and subclasses into embedded entries" });
    for (const id of [...created, ...touched]) await S.db.doc("entries/" + id).set(entries.get(id));
    for (const [bid, { body }] of bookOut) { const b = S.books.get(bid); await S.db.doc("books/" + bid).set(Object.assign({}, b, { body, words: bookWords(body), updated: now })); report.books.push(b.title); }
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { bookEmbeds: now, bookEmbedsReport: report }));
    if (bookOut.size) toast(`Moved ${report.creatures} creatures${report.spells.length ? `, ${report.spells.length} spell${report.spells.length === 1 ? "" : "s"}` : ""}${report.subclasses.length ? ` and ${report.subclasses.length} subclass${report.subclasses.length === 1 ? "" : "es"}` : ""} into your books as library entries.`);
  } catch (err) { console.warn("Book embed move failed", err); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}


function artificerClassDoc(now) {
  const d = srdClassDoc("Artificer", now);
  d.body = "*Masters of invention who use tools and ingenuity to channel magic into objects. The Artificer isn't in the SRD, so its features here are short summaries; the full class is in Tasha's Cauldron of Everything.*";
  return d;
}
// Every class becomes a library entry (built from the SRD; the Artificer from its summary) so it can be edited like a subclass.
async function migrateClassEntries() {
  if (migrating || MIG_DONE.classEntries) return;
  migrating = true; MIG_DONE.classEntries = true;
  try {
    const now = new Date().toISOString(); let n = 0;
    for (const name of Object.keys(SRD_CLASS_FEATS)) {
      const id = "class-" + migSlug(name), cur = S.entries.get(id);
      if (cur && cur.type === "class") continue;
      if (!cur && classEntry(name)) continue;
      const doc = name === "Artificer" ? artificerClassDoc(now) : srdClassDoc(name, now);
      if (cur) { doc.created = cur.created || now; doc.tags = cur.tags || []; if (cur.hidden) doc.hidden = true; }
      await S.db.doc("entries/" + id).set(doc); S.entries.set(id, doc); n++;
    }
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { classEntries: now }));
    if (n) toast(`Added ${n} classes to your library. Edit any of them like a subclass.`);
  } catch (err) { console.warn("Class move failed", err); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}

// The Player's Handbook subclasses (SRD ones in full, the rest summarised) become subclass entries.
async function migratePhbSubclasses() {
  if (migrating || MIG_DONE.phbSubs) return;
  migrating = true; MIG_DONE.phbSubs = true;
  try {
    const now = new Date().toISOString(); let n = 0;
    for (const doc of phbSubclassDocs(now)) {
      const id = "subclass-" + migSlug(doc.title);
      if (S.entries.has(id) || [...S.entries.values()].some(e => e.type === "subclass" && MIG_K(e.title) === MIG_K(doc.title))) continue;
      await S.db.doc("entries/" + id).set(doc); S.entries.set(id, doc); n++;
    }
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { phbSubs: now }));
    if (n) toast(`Added ${n} Player's Handbook subclasses to your library.`);
  } catch (err) { console.warn("Subclass import failed", err); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}
// Harvest tables written the Google Docs way (DC, available and weight squeezed into cells) become clean
// loot tables: | Material | Harvest DC | Available | Weight |, shown as loot cards.
function migLootBlock(block) {
  const rows = block.filter(l => !/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l.trim())).map(splitRow).map(r => r.map(c => unescapeCell(c).replace(/\*/g, "").replace(/\s+/g, " ").trim()));
  const items = []; let names = null, nameStart = 0;
  for (const r of rows) {
    if (!r.some(c => /HARVEST\s*DC/i.test(c))) { names = r; nameStart = items.length; continue; }
    r.forEach((c, i) => {
      const m = c.match(/HARVEST\s*DC\s*:?\s*(\S+)/i); if (!m) return;
      const near = r.slice(i, i + 3).join(" ");
      const av = near.match(/AVA\w*ABLE\s*:?\s*(\d+)/i), wt = near.match(/WEIGHT\s*:?\s*([\d.]+\s*\w*)/i);
      const named = (names || []).filter(Boolean), raw = named[items.length - nameStart] || "Material";
      const name = raw.replace(/\s+/g, " ").toLowerCase().replace(/^./, ch => ch.toUpperCase());
      items.push([name, m[1], av ? av[1] : "", wt ? wt[1].trim() : ""]);
    });
  }
  if (!items.length) return null;
  return ["| Material | Harvest DC | Available | Weight |", "| --- | --- | --- | --- |", ...items.map(i => "| " + i.join(" | ") + " |")];
}
// The example harvest tables become item entries (one per material) embedded in the book.
async function migrateHarvestItems() {
  if (migrating || MIG_DONE.harvest) return;
  migrating = true; MIG_DONE.harvest = true;
  try {
    const now = new Date().toISOString(), made = [];
    for (const [bid, b] of S.books) {
      if (!/merchant/i.test(b.title || "")) continue; // only the guide's worked examples; templates stay as they are
      const lines = String(b.body || "").split("\n"); let changed = false;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim().startsWith("|")) continue;
        let s = i; while (s > 0 && lines[s - 1].trim().startsWith("|")) s--;
        const block = lines.slice(s, i + 1);
        let rows = null;
        if (block.some(l => /HARVEST\s*DC/i.test(l.replace(/[\\*]/g, "")))) { const nb = migLootBlock(block); if (nb) rows = parseLootTable(nb); }
        else if (isLootTable(block)) rows = parseLootTable(block);
        if (rows && rows.length) {
          const tokens = [];
          for (const r of rows) {
            const title = r.n.replace(/(^|\s)[a-z]/g, ch => ch.toUpperCase());
            let id = [...S.entries].find(([, e]) => e.type === "item" && MIG_K(e.title) === MIG_K(title));
            id = id ? id[0] : "item-" + migSlug(title);
            if (!S.entries.has(id)) {
              const doc = { title, type: "item", tags: [], source: bid, created: now, updated: now,
                body: "",
                item: { category: "Harvested part", base: "", props: [], attune: false, extra: "", rarity: "", holder: "", lore: "", magical: false, stats: null, meta: "Harvested part", harvest: { dc: r.dc, qty: r.qty, wt: r.wt } } };
              await S.db.doc("entries/" + id).set(doc); S.entries.set(id, doc); made.push(title);
            }
            tokens.push(embedToken(id), "");
          }
          lines.splice(s, i + 1 - s, ...tokens); changed = true;
        }
        i = s;
      }
      if (changed) {
        await S.db.doc("settings/backup-harvest-" + bid).set({ body: b.body, at: now, reason: "Before turning harvest tables into items" });
        const body = lines.join("\n").replace(/\n{3,}/g, "\n\n");
        await S.db.doc("books/" + bid).set(Object.assign({}, b, { body, words: bookWords(body), updated: now }));
      }
    }
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { harvestItems: now }));
    if (made.length) toast(`Added ${made.join(", ")} as items.`);
  } catch (err) { console.warn("Harvest items failed", err); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}

// Items made as "Material" become "Harvested part" with their numbers as fields.
async function migrateHarvestParts() {
  if (migrating || MIG_DONE.harvestParts) return;
  migrating = true; MIG_DONE.harvestParts = true;
  try {
    const now = new Date().toISOString();
    for (const [id, e] of S.entries) {
      if (e.type !== "item" || !e.item || !/^material$/i.test(String(e.item.category || ""))) continue;
      const h = harvestOf(e);
      const doc = Object.assign({}, e, { body: harvestBody(e), updated: now, item: Object.assign({}, e.item, { category: "Harvested part", meta: "Harvested part", harvest: { dc: h.dc || "", qty: h.qty || "", wt: h.wt || "" } }) });
      await S.db.doc("entries/" + id).set(doc); S.entries.set(id, doc);
    }
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { harvestParts: now }));
  } catch (err) { console.warn("Harvested parts update failed", err); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}
// Harvested parts from the Templates book's Beast Entries: one item per part ("Horn/Antlers" makes two),
// keeping the size notes as written ("4^size"). The tables there become the part cards.
function migRawLoot(block) {
  const rows = block.filter(l => !/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l.trim())).map(splitRow)
    .map(r => r.map(c => String(c).replace(/\\\\/g, "\\").replace(/\\([*^#])/g, "$1").replace(/\\/g, "").replace(/\*\*/g, "").replace(/^\*|\*$/g, "").replace(/\s+/g, " ").trim()));
  const out = []; let names = null, start = 0;
  for (const r of rows) {
    if (!r.some(c => /HARVEST\s*DC/i.test(c))) { names = r.filter(c => c && !/^image$/i.test(c)); start = out.length; continue; }
    r.forEach((c, i) => {
      const m = c.match(/HARVEST\s*DC\s*:?\s*(.+)$/i); if (!m) return;
      const near = r.slice(i + 1, i + 3);
      const av = (near.find(x => /AVAILABLE/i.test(x)) || "").replace(/^.*?AVAILABLE\s*:?\s*/i, "").replace(/\*/g, "×").trim();
      const wt = (near.find(x => /WEIGHT/i.test(x)) || "").replace(/^.*?WEIGHT\s*:?\s*/i, "").replace(/\*/g, "×").replace(/(\d)(lbs?)\b/, "$1 $2").trim();
      const tidy = x => x.replace(/\s*×\s*/g, " × ");
      out.push({ names: String((names || [])[out.length - start] || "").split("/").map(x => x.trim()).filter(Boolean), dc: m[1].trim(), qty: /^x$/i.test(av) ? "" : tidy(av), wt: /^x$/i.test(wt) ? "" : tidy(wt) });
    });
  }
  return out;
}
async function migrateTemplateParts() {
  if (migrating || MIG_DONE.templateParts) return;
  migrating = true; MIG_DONE.templateParts = true;
  const made = [];
  try {
    const now = new Date().toISOString();
    const tb = [...S.books].find(([, b]) => /^templates?$/i.test(String(b.title || "").trim()));
    const cap = s => s.toLowerCase().replace(/(^|\s)[a-z]/g, c => c.toUpperCase());
    const ensure = async (name, r) => {
      const title = cap(name);
      const hit = [...S.entries].find(([, e]) => e.type === "item" && MIG_K(e.title) === MIG_K(title));
      if (hit) return hit[0];
      const id = "item-" + migSlug(title);
      const doc = { title, type: "item", tags: [], body: "", source: tb ? tb[0] : "", created: now, updated: now,
        item: { category: "Harvested part", base: "", props: [], attune: false, extra: "", rarity: "", holder: "", lore: "", magical: false, stats: null, meta: "Harvested part", harvest: { dc: r.dc || "", qty: r.qty || "", wt: r.wt || "" } } };
      await S.db.doc("entries/" + id).set(doc); S.entries.set(id, doc); made.push(title);
      return id;
    };
    if (tb) {
      const [bid, b] = tb, lines = String(b.body || "").split("\n");
      const sec = migTop(lines, "beast entries");
      let changed = false;
      if (sec) for (let i = sec[1] - 1; i > sec[0]; i--) {
        if (!lines[i].trim().startsWith("|")) continue;
        let s = i; while (s > sec[0] && lines[s - 1].trim().startsWith("|")) s--;
        const parts = migRawLoot(lines.slice(s, i + 1));
        if (parts.length) {
          const tokens = [];
          for (const p of parts) for (const n of p.names) tokens.push(embedToken(await ensure(n, p)));
          lines.splice(s, i + 1 - s, ...tokens.flatMap(t => [t, ""])); changed = true;
        }
        i = s;
      }
      if (changed) {
        await S.db.doc("settings/backup-templates-" + bid).set({ body: b.body, at: now, reason: "Before turning beast loot tables into harvested part cards" });
        const body = lines.join("\n").replace(/\n{3,}/g, "\n\n");
        await S.db.doc("books/" + bid).set(Object.assign({}, b, { body, words: bookWords(body), updated: now }));
      }
    }
    // Monsters have a monster core instead of a heart (Monstrosities Entries note).
    await ensure("Monster Core", {});
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { templateParts: now }));
    if (made.length) toast(`Added ${made.length} harvested parts: ${made.join(", ")}.`);
  } catch (err) { console.warn("Template parts failed", err); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}
