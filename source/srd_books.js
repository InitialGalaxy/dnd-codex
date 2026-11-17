// ---------- Source books: official 2014 rules from the SRD 5.1, read-only ----------
const SPELL_LEVEL_TITLE = ["Cantrips", "1st-level spells", "2nd-level spells", "3rd-level spells", "4th-level spells", "5th-level spells", "6th-level spells", "7th-level spells", "8th-level spells", "9th-level spells"];
function srdSpellLine(s) { return s.l ? `${["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"][s.l]}-level ${s.s.toLowerCase()}${s.ri ? " (ritual)" : ""}` : `${s.s} cantrip`; }
function srdSpellMd(s, head) {
  const comp = s.c.replace(/^([VSM ]+)/, m => m.trim().split(/\s+/).join(", ") + " ");
  return `${head} ${s.n}\n\n*${srdSpellLine(s)}*\n\n- **Casting Time:** ${s.t}\n- **Range:** ${s.r}\n- **Components:** ${comp.trim()}\n- **Duration:** ${s.co ? "Concentration, " + s.d.replace(/^Up to/, "up to") : s.d}\n- **Classes:** ${s.cl.join(", ")}\n\n${s.x}${s.h ? `\n\n***At Higher Levels.*** ${s.h}` : ""}`;
}
let SRD_SPELLS_MD = null;
const SRD_BOOK_LIST = [
  { id: "srd-rules", title: "Basic Rules", blurb: "Ability scores, adventuring, combat, spellcasting, equipment rules and conditions.", body: () => SRD_RULES_MD },
  { id: "srd-classes", title: "Races, Classes & Backgrounds", blurb: "The nine SRD races, all twelve classes with their features by level, one subclass each, and backgrounds.", body: () => SRD_CLASSES_MD },
  { id: "srd-spells", title: "Spells", blurb: `All ${SRD_SPELLS.length} SRD spells, from cantrips to 9th level, with casting details and the classes that get them.`,
    body: () => SRD_SPELLS_MD || (SRD_SPELLS_MD = `*Spells from the System Reference Document 5.1. In this campaign spells cost spell points instead of slots (see The Codex of Energies).*\n\n` + [...new Set(SRD_SPELLS.map(s => s.l))].map(L => `# ${SPELL_LEVEL_TITLE[L]}\n\n` + SRD_SPELLS.filter(s => s.l === L).map(s => srdSpellMd(s, "##")).join("\n\n")).join("\n\n")) }
];
const SRD_BOOK_BY_ID = new Map(SRD_BOOK_LIST.map(b => [b.id, b]));
const srdWords = {};
function srdBook(id) {
  const d = SRD_BOOK_BY_ID.get(id); if (!d) return null;
  const body = d.body();
  return { title: d.title, status: "Source", body, base: true, blurb: d.blurb, words: srdWords[id] || (srdWords[id] = body.split(/\s+/).length) };
}
const SRD_CREDIT = `<p class="muted small srdcredit">Contains material from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under CC-BY-4.0. This is official rules text, not campaign homebrew.</p>`;
function sourceShelfHtml() {
  return `<h2 class="sect">Source books <span class="srcpill">Source</span> <span class="muted small">Official 2014 rules (SRD 5.1), not written by you</span></h2>
    <div class="shelf">${SRD_BOOK_LIST.map(d => { const b = srdBook(d.id); return `<a class="bookcard source" href="#book-${d.id}"><span class="spine"></span><div><h3>${esc(b.title)} <span class="srcpill">Source</span></h3><p>${esc(d.blurb)}</p><span class="muted small">${fmt(b.words)} words</span></div></a>`; }).join("")}</div>`;
}

// ---------- Class features and racial traits for character sheets ----------
const featKey = n => String(n || "").toLowerCase().replace(/armou?r/g, "armor").replace(/favou?r/g, "favor").replace(/\s*\(.*?\)\s*$/, "").replace(/[^a-z]/g, "");
function detectSrdClass(c) {
  if (c.classRef) { const e = S.entries.get(c.classRef); if (e && e.type === "class") return e.title.trim(); }
  const t = String(c.classes || "").toLowerCase(); return allClassNames().sort((a, b) => b.length - a.length).find(k => t.includes(k.toLowerCase())) || "";
}
function detectSrdRace(c) { const t = String(c.race || "").toLowerCase(); return Object.keys(SRD_RACE_TRAITS).sort((a, b) => b.length - a.length).find(k => t.includes(k.toLowerCase())) || ""; }
// Features the class gives up to a level. Scaling features (Brutal Critical (2 dice)) keep only the highest version.
// Ability Score Improvements, spell slot Spellcasting and "subclass feature" placeholders are left out.
function srdClassFeatures(cls, level, withSub) {
  const d = classFeats(cls); if (!d) return [];
  const best = new Map();
  for (const f of d.f) {
    if (f.lv > level || (f.sub && !withSub)) continue;
    if (/^Ability Score Improvement/.test(f.n) || /^Spellcasting/.test(f.n) || / feature$/i.test(f.n)) continue;
    const k = featKey(f.n), cur = best.get(k);
    if (!cur || f.lv >= cur.lv) best.set(k, f);
  }
  return [...best.values()].sort((a, b) => a.lv - b.lv || byName(a.n, b.n));
}
function srdRaceTraits(race, sub) { const r = SRD_RACE_TRAITS[race]; if (!r) return []; return [...r.t, ...((sub && r.sub[sub]) || [])]; }
// Homebrew races from the library show in the race list as "hb:<id>".
function detectRaceChoice(c) {
  const t = String(c.race || "").toLowerCase();
  const hb = homebrewRaces().filter(([, e]) => e.title && t.includes(String(e.title).toLowerCase())).sort((a, b) => b[1].title.length - a[1].title.length)[0];
  return hb ? "hb:" + hb[0] : detectSrdRace(c);
}
function fillRaceTraits(race, sub) {
  if (String(race).startsWith("hb:")) { const e = S.entries.get(race.slice(3)); return e ? raceTraits(e) : []; }
  return srdRaceTraits(race, sub);
}
function fillClassFeatures(c, cls, lvl, withSub) {
  const hb = charSubclassEntry(c);
  const own = hb && withSub ? subclassFeatures(hb[1], lvl).map(f => ({ n: f.n, lv: Number(f.lv) || 1, d: f.d || "", sub: hb[1].title })) : [];
  return [...srdClassFeatures(cls, lvl, withSub && !hb), ...own];
}
function srdFillHtml(c) {
  const cls = CS.fill && CS.fill.cls != null ? CS.fill.cls : detectSrdClass(c), race = CS.fill && CS.fill.race != null ? CS.fill.race : detectRaceChoice(c);
  const hb = charSubclassEntry(c);
  const sub = CS.fill && CS.fill.sub || "", lvl = Number(c.level) || 1;
  const subName = hb ? hb[1].title : cls && classFeats(cls) ? classFeats(cls).subs[0] || "" : "";
  const withSub = CS.fill && CS.fill.withSub != null ? !!CS.fill.withSub : !!(hb || (cls && classFeats(cls) && c.subclass && c.subclass === classFeats(cls).subs[0]));
  const subs = race && SRD_RACE_TRAITS[race] ? Object.keys(SRD_RACE_TRAITS[race].sub) : [];
  const have = new Set((c.features || []).map(f => featKey(f.name)));
  const list = [...fillClassFeatures(c, cls, lvl, withSub).map(f => ["Class", f]), ...fillRaceTraits(race, sub || subs[0]).map(f => ["Race", f])];
  const newOnes = list.filter(([, f]) => !have.has(featKey(f.n))).length, fills = list.filter(([, f]) => have.has(featKey(f.n)) && (c.features || []).some(x => featKey(x.name) === featKey(f.n) && !String(x.desc || "").trim())).length;
  const hbr = homebrewRaces();
  return `<div class="srdfill"><span class="flabel">Fill from the source books <span class="srcpill">Source</span></span>
    <div class="frow tight">
      <label><span>Class</span><select id="fill-cls"><option value="">None</option>${allClassNames().map(k => `<option${k === cls ? " selected" : ""}>${k}</option>`).join("")}</select></label>
      <label><span>Up to level</span><input type="text" value="${lvl}" disabled class="cf mini"></label>
      ${subName ? `<label class="check inline"><input type="checkbox" id="fill-sub"${withSub ? " checked" : ""}> Include ${esc(subName)} subclass${hb ? " (your book)" : ""}</label>` : ""}
      <label><span>Race</span><select id="fill-race"><option value="">None</option>${Object.keys(SRD_RACE_TRAITS).map(k => `<option${k === race ? " selected" : ""}>${k}</option>`).join("")}${hbr.length ? `<optgroup label="From your books">${hbr.map(([rid, e]) => `<option value="hb:${esc(rid)}"${race === "hb:" + rid ? " selected" : ""}>${esc(e.title)}</option>`).join("")}</optgroup>` : ""}</select></label>
      ${subs.length ? `<label><span>Subrace</span><select id="fill-subrace">${subs.map(k => `<option${k === (sub || subs[0]) ? " selected" : ""}>${k}</option>`).join("")}<option value="-"${sub === "-" ? " selected" : ""}>None</option></select></label>` : ""}
      <button class="btn small" data-act="srdfill"${newOnes || fills ? "" : " disabled"}>${newOnes ? `Add ${newOnes} feature${newOnes === 1 ? "" : "s"}` : "Nothing new to add"}${fills ? ` · fill ${fills} description${fills === 1 ? "" : "s"}` : ""}</button>
    </div>
    <p class="muted small">Adds what the class and subclass give up to level ${lvl} and the race's traits, skipping anything already on the sheet. Subclasses and races written in your books count too. Ability Score Improvements and spell slots stay yours to pick.</p></div>`;
}
function srdFillApply(id, c) {
  const cls = ($("#fill-cls") || {}).value || "", race = ($("#fill-race") || {}).value || "", sb = ($("#fill-subrace") || {}).value || "", withSub = !!($("#fill-sub") || {}).checked;
  const lvl = Number(c.level) || 1;
  const raceName = race.startsWith("hb:") ? ((S.entries.get(race.slice(3)) || {}).title || "Race") : race;
  const add = [...fillClassFeatures(c, cls, lvl, withSub).map(f => ({ name: f.n, source: "Class", note: (f.sub ? f.sub + " · " : "") + "level " + f.lv, desc: f.d })),
    ...fillRaceTraits(race, sb === "-" ? "" : sb).map(f => ({ name: f.n, source: "Race", note: raceName, desc: f.d }))];
  let added = 0, filled = 0;
  charChange(id, x => {
    x.features = x.features || [];
    for (const f of add) {
      const cur = x.features.find(y => featKey(y.name) === featKey(f.name));
      if (!cur) { x.features.push(f); added++; }
      else if (!String(cur.desc || "").trim()) { cur.desc = f.desc; filled++; }
    }
  });
  toast(added || filled ? `Added ${added} feature${added === 1 ? "" : "s"}${filled ? `, filled ${filled} description${filled === 1 ? "" : "s"}` : ""}` : "Nothing new to add");
}
