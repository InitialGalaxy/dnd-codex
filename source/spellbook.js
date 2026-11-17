// ---------- Spellbook: SRD spells plus your own, each with its own page ----------
// Homebrew spells are codex entries of type "spell": e.spell = { level, school, time, range, comp, dur, conc, ritual, classes,
//   higher, attack: ""|"melee"|"ranged"|"save", save, half, dmg, dtype, scale: ""|"char", heal, aoe: { shape, size } } and e.body = description.
const SPELL_SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const AOE_SHAPES = [["", "None (single target)"], ["cone", "Cone"], ["line", "Line"], ["sphere", "Sphere / radius"], ["cube", "Cube"], ["cylinder", "Cylinder"]];
const SPELL_CLASSES = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const SBS = { q: "", lvl: "", cls: "", combat: false, src: "" };
function spellFromSrd(x) {
  return { id: "srd-" + x.id, src: "srd", name: x.n, level: x.l, school: x.s, time: x.t, range: x.r, comp: x.c.replace(/^([VSM ]+)/, m => m.trim().split(/\s+/).join(", ") + " ").trim(), dur: x.d, conc: !!x.co, ritual: !!x.ri,
    classes: x.cl, desc: x.x, higher: x.h, attack: x.at || (x.dc ? "save" : ""), save: x.dc ? x.dc.t : "", half: x.dc ? x.dc.s === "half" : false,
    dtype: x.dt || "", dmgSlot: x.ds || null, dmgChar: x.dcl || null, heal: x.hl || null, aoe: x.ao ? { shape: x.ao.t, size: x.ao.s } : null };
}
function spellFromEntry(id, e) {
  const s = e.spell || {};
  return { id: "e:" + id, entryId: id, src: "codex", name: e.title, level: Number(s.level) || 0, school: s.school || "", time: s.time || "", range: s.range || "", comp: s.comp || "",
    dur: s.dur || "", conc: !!s.conc, ritual: !!s.ritual, classes: String(s.classes || "").split(/,\s*/).filter(Boolean), desc: e.body || "", higher: s.higher || "",
    attack: s.attack || "", save: s.save || "", half: !!s.half, dtype: s.dtype || "", dmg: s.dmg || "", scale: s.scale || "", heal: s.heal ? { [Number(s.level) || 1]: s.heal } : null,
    aoe: s.aoe && s.aoe.shape ? { shape: s.aoe.shape, size: Number(s.aoe.size) || 0 } : null, hidden: !!e.hidden };
}
let SRD_SPELL_OBJS = null;
function srdSpellObjs() { return SRD_SPELL_OBJS || (SRD_SPELL_OBJS = SRD_SPELLS.map(spellFromSrd)); }
function allSpells() { return [...[...S.entries.entries()].filter(([, e]) => e.type === "spell").map(([id, e]) => spellFromEntry(id, e)), ...srdSpellObjs()]; }
// Find a spell by a character sheet reference, falling back to its name (your own spells win over the SRD).
function findSpell(ref, name) {
  if (ref && ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)); if (e) return spellFromEntry(ref.slice(2), e); }
  if (ref && ref.startsWith("srd-")) { const x = srdSpellObjs().find(s => s.id === ref); if (x) return x; }
  const n = String(name || "").trim().toLowerCase(); if (!n) return null;
  for (const [id, e] of S.entries) if (e.type === "spell" && String(e.title || "").toLowerCase() === n) return spellFromEntry(id, e);
  return srdSpellObjs().find(s => s.name.toLowerCase() === n) || null;
}
const spellHref = sp => sp.entryId ? `#entry-${sp.entryId}` : `#spell-${sp.id}`;
const isCombatSpell = sp => !!(sp && (sp.attack || sp.dmg || sp.dmgSlot || sp.dmgChar || sp.heal));
const ABIL_NAME = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
function spellLevelLine(sp) { return sp.level ? `${ordinal(sp.level)}-level ${String(sp.school || "").toLowerCase()}${sp.ritual ? " (ritual)" : ""}` : `${sp.school || "Spell"} cantrip`; }
// Damage at a character level (cantrips) or slot level (levelled spells).
function spellDamage(sp, charLvl, slot) {
  if (sp.dmgChar) { const k = Object.keys(sp.dmgChar).map(Number).filter(n => n <= (charLvl || 1)).sort((a, b) => b - a)[0] || 1; return sp.dmgChar[k]; }
  if (sp.dmgSlot) return sp.dmgSlot[slot || sp.level] || sp.dmgSlot[Object.keys(sp.dmgSlot)[0]];
  if (sp.dmg) {
    if (sp.scale === "char") { const tier = 1 + [5, 11, 17].filter(n => (charLvl || 1) >= n).length; return String(sp.dmg).replace(/^(\d+)d/, (m, n) => (Number(n) * tier) + "d"); }
    return sp.dmg;
  }
  return "";
}
function spellHeal(sp, slot, mod) { if (!sp.heal) return ""; const h = sp.heal[slot || sp.level] || Object.values(sp.heal)[0] || ""; return String(h).replace(/\s*\+\s*MOD/, mod ? (mod > 0 ? " + " + mod : " − " + Math.abs(mod)) : ""); }
function rangeShort(sp) {
  const r = String(sp.range || "").replace(/\bfeet\b/g, "ft").replace(/\bfoot\b/g, "ft");
  if (!sp.aoe) return r || "—";
  const a = `${sp.aoe.size} ft ${sp.aoe.shape === "sphere" ? "radius" : sp.aoe.shape}`;
  return /^self/i.test(r) ? `Self · ${a}` : `${r} · ${a}`;
}
// A small picture of where the spell lands: caster (filled dot), target or area (outline).
function spellShapeSvg(sp, cls) {
  const a = sp.aoe && sp.aoe.shape, self = /^self/i.test(String(sp.range || "")), touch = /^touch/i.test(String(sp.range || ""));
  const caster = (x, y) => `<circle cx="${x}" cy="${y}" r="4.5" class="cst"/>`;
  let g;
  if (a === "cone") g = `${caster(8, 20)}<path d="M12 20 L62 6 Q66 20 62 34 Z" class="area"/>`;
  else if (a === "line") g = `${caster(8, 20)}<rect x="13" y="16" width="52" height="8" rx="2" class="area"/>`;
  else if (a === "cube") g = self ? `${caster(8, 20)}<rect x="13" y="5" width="30" height="30" rx="2" class="area"/>` : `${caster(8, 20)}<path d="M13 20 H34" class="ray"/><rect x="38" y="6" width="28" height="28" rx="2" class="area"/>`;
  else if (a === "sphere" || a === "cylinder") g = self ? `<circle cx="36" cy="20" r="16" class="area"/>${caster(36, 20)}` : `${caster(8, 20)}<path d="M13 20 H32" class="ray"/><circle cx="50" cy="20" r="15" class="area"/>${a === "cylinder" ? `<ellipse cx="50" cy="9" rx="10" ry="3" class="area thin"/>` : ""}`;
  else if (touch) g = `${caster(26, 20)}<circle cx="40" cy="20" r="5.5" class="tgt"/>`;
  else if (self) g = `<circle cx="36" cy="20" r="11" class="area thin"/>${caster(36, 20)}`;
  else g = `${caster(8, 20)}<path d="M13 20 H54" class="ray"/><path d="M50 16 L56 20 L50 24" class="ray"/><circle cx="62" cy="20" r="5.5" class="tgt"/>`;
  return `<svg class="spshape${cls ? " " + cls : ""}" viewBox="0 0 72 40" role="img" aria-label="${esc(rangeShort(sp))}">${g}</svg>`;
}
function spellCardHtml(sp, actions, noTitle) {
  const row = (l, v) => v ? `<div><dt>${l}</dt><dd>${v}</dd></div>` : "";
  const dmg = spellDamage(sp, 1), heal = spellHeal(sp);
  const hit = sp.attack === "save" ? `${ABIL_NAME[sp.save] || "Saving"} save${sp.half ? ", half on success" : ""}` : sp.attack ? `${sp.attack === "melee" ? "Melee" : "Ranged"} spell attack` : "";
  return `<article class="spellcard">
    <header>${noTitle ? "" : `<h1>${esc(sp.name)}</h1>`}<p class="spline">${esc(spellLevelLine(sp))}</p>${sp.src === "srd" ? `<span class="srcpill">Source · SRD 5.1</span>` : `<span class="pill t-spell">Homebrew</span>`}${actions || ""}</header>
    <div class="spgrid">
      <dl>${row("Casting time", esc(sp.time))}${row("Range", esc(sp.range))}${row("Components", esc(sp.comp))}${row("Duration", esc((sp.conc ? "Concentration, " : "") + sp.dur))}${row("Classes", esc(sp.classes.join(", ")))}</dl>
      <div class="spfig">${spellShapeSvg(sp, "big")}<span>${esc(rangeShort(sp))}</span></div>
    </div>
    ${hit || dmg || heal ? `<div class="spcombat">${hit ? `<span><b>Attack</b> ${esc(hit)}</span>` : ""}${dmg ? `<span><b>Damage</b> ${diceify(esc(dmg))} ${esc(sp.dtype)}${sp.dmgChar || sp.scale === "char" ? " <small>(grows at levels 5, 11, 17)</small>" : sp.level && sp.dmgSlot ? ` <small>(at ${ordinal(sp.level)} level)</small>` : ""}</span>` : ""}${heal ? `<span><b>Healing</b> ${esc(heal)} + spellcasting modifier</span>` : ""}</div>` : ""}
    <div class="prose">${md(sp.desc || "", { base: 3 }) || `<p class="muted">No description yet.</p>`}${sp.higher ? `<p><strong><em>At Higher Levels.</em></strong> ${esc(sp.higher)}</p>` : ""}</div>
    ${sp.src === "srd" ? `<p class="muted small">Contains material from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under CC-BY-4.0.</p>` : ""}
  </article>`;
}
function viewSpellPage(id) {
  const sp = srdSpellObjs().find(s => s.id === id);
  if (!sp) return `<div class="empty">No spell found. <a href="#spells">Back to spells</a></div>`;
  const copied = [...S.entries.entries()].find(([, e]) => e.type === "spell" && e.srd === id);
  const act = READONLY ? "" : copied ? `<a class="btn ghost small" href="#entry-${esc(copied[0])}">Your copy · Open</a>` : `<button class="btn ghost small" data-act="spellcopy" data-v="${esc(id)}">Copy to codex to change it</button>`;
  return `<div class="crumbs"><a href="#spells">← Spells</a></div>${spellCardHtml(sp, `<div class="acts">${act}</div>`)}`;
}
function viewSpells() {
  const q = SBS.q.trim().toLowerCase();
  const list = allSpells().filter(sp => (SBS.lvl === "" || sp.level === Number(SBS.lvl)) && (!SBS.cls || sp.classes.includes(SBS.cls)) && (!SBS.combat || isCombatSpell(sp))
    && (!SBS.src || sp.src === SBS.src || (SBS.src === "codex" && sp.src === "codex")) && (!q || (sp.name + " " + sp.school + " " + sp.dtype).toLowerCase().includes(q)))
    .sort((a, b) => a.level - b.level || byName(a.name, b.name));
  const levels = [...new Set(list.map(s => s.level))];
  const own = [...S.entries.values()].filter(e => e.type === "spell").length;
  return `<section class="spellsview">
    <div class="libhead"><h1>Spells</h1><p class="muted">${list.length} of ${srdSpellObjs().length + own} spells · ${own} of your own</p>
      ${READONLY ? "" : `<div><button class="btn" data-act="new" data-type="spell">+ New spell</button></div>`}</div>
    <div class="spfilters">
      <label class="search"><span class="sr">Search spells</span><input id="spq" type="search" placeholder="Search spells, e.g. fire, healing" value="${esc(SBS.q)}" autocomplete="off"></label>
      <div class="seg kindseg small" role="group" aria-label="Level"><button class="${SBS.lvl === "" ? "on" : ""}" data-act="sbf" data-k="lvl" data-v="">All</button>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="${SBS.lvl === String(n) ? "on" : ""}" data-act="sbf" data-k="lvl" data-v="${n}">${n ? n : "C"}</button>`).join("")}</div>
      <select id="spcls" aria-label="Class"><option value="">Any class</option>${SPELL_CLASSES.map(c => `<option${SBS.cls === c ? " selected" : ""}>${c}</option>`).join("")}</select>
      <select id="spsrc" aria-label="Source"><option value="">All sources</option><option value="codex"${SBS.src === "codex" ? " selected" : ""}>Homebrew</option><option value="srd"${SBS.src === "srd" ? " selected" : ""}>SRD source</option></select>
      <label class="check inline"><input type="checkbox" id="spcombat"${SBS.combat ? " checked" : ""}> Combat only</label>
    </div>
    <div id="spresults">${levels.length ? levels.map(L => `<h2 class="sect">${L ? ordinal(L) + " level" : "Cantrips"} <span class="muted small">${list.filter(s => s.level === L).length}</span></h2>
      <div class="splib">${list.filter(s => s.level === L).map(sp => { const d = spellDamage(sp, 1), h = spellHeal(sp);
        return `<a class="sprowlink${sp.hidden ? " hiddenrow" : ""}" href="${spellHref(sp)}">${spellShapeSvg(sp)}<span class="spn"><strong>${esc(sp.name)}</strong><span class="muted">${esc(spellLevelLine(sp))}${sp.conc ? " · concentration" : ""}</span></span>
          <span class="spr">${esc(rangeShort(sp))}</span><span class="spd">${d ? `${esc(d)} ${esc(sp.dtype)}` : h ? `heals ${esc(h.replace(" + MOD", ""))}` : ""}</span>${sp.src === "srd" ? `<span class="srcpill">Source</span>` : `<span class="pill t-spell">Homebrew</span>`}</a>`; }).join("")}</div>`).join("") : `<div class="empty">No spells match.</div>`}</div>
  </section>`;
}
// ----- homebrew spell editor (inside the entry editor) -----
function spellFields(e) {
  const s = e.spell || {}, sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}"${String(v || "") === String(k) ? " selected" : ""}>${l}</option>`).join("")}</select>`;
  return `<div class="frow">
      <label><span>Level</span>${sel("sp-level", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, n ? ordinal(n) + " (" + SP_COST[n] + " SP)" : "Cantrip"]), s.level || 0)}</label>
      <label><span>School</span>${sel("sp-school", [["", "—"], ...SPELL_SCHOOLS.map(x => [x, x])], s.school)}</label>
      <label><span>Casting time</span><input id="sp-time" type="text" value="${esc(s.time || "1 action")}"></label>
      <label><span>Range</span><input id="sp-range" type="text" value="${esc(s.range || "")}" placeholder="120 feet, Self, Touch"></label>
    </div>
    <div class="frow">
      <label class="grow"><span>Components</span><input id="sp-comp" type="text" value="${esc(s.comp || "")}" placeholder="V, S, M (a pinch of soot)"></label>
      <label><span>Duration</span><input id="sp-dur" type="text" value="${esc(s.dur || "Instantaneous")}"></label>
      <label class="check inline"><input id="sp-conc" type="checkbox"${s.conc ? " checked" : ""}> Concentration</label>
      <label class="check inline"><input id="sp-ritual" type="checkbox"${s.ritual ? " checked" : ""}> Ritual</label>
    </div>
    <label><span>Classes <small class="muted">comma separated</small></span><input id="sp-classes" type="text" value="${esc(s.classes || "")}" placeholder="Wizard, Sorcerer"></label>
    <span class="flabel">In combat <small class="muted">fill these in and it shows under the character's combat spells</small></span>
    <div class="frow">
      <label><span>Attack</span>${sel("sp-attack", [["", "No attack or save"], ["ranged", "Ranged spell attack"], ["melee", "Melee spell attack"], ["save", "Saving throw"]], s.attack)}</label>
      <label><span>Save</span>${sel("sp-save", [["", "—"], ...Object.entries(ABIL_NAME)], s.save)}</label>
      <label class="check inline"><input id="sp-half" type="checkbox"${s.half ? " checked" : ""}> Half damage on a save</label>
    </div>
    <div class="frow">
      <label><span>Damage</span><input id="sp-dmg" type="text" value="${esc(s.dmg || "")}" placeholder="8d6"></label>
      <label><span>Damage type</span><input id="sp-dtype" type="text" list="dtypes2" value="${esc(s.dtype || "")}" placeholder="fire"></label>
      <datalist id="dtypes2">${DAMAGE_TYPES.map(d => `<option value="${d}"></option>`).join("")}</datalist>
      <label class="check inline"><input id="sp-scale" type="checkbox"${s.scale === "char" ? " checked" : ""}> Cantrip damage grows at 5, 11, 17</label>
      <label><span>Healing</span><input id="sp-heal" type="text" value="${esc(s.heal || "")}" placeholder="1d8 + MOD"></label>
    </div>
    <div class="frow">
      <label><span>Area shape</span>${sel("sp-shape", AOE_SHAPES, (s.aoe || {}).shape)}</label>
      <label><span>Area size (ft)</span><input id="sp-size" type="text" inputmode="numeric" value="${esc((s.aoe || {}).size || "")}" placeholder="15"></label>
    </div>
    <label><span>At higher levels <small class="muted">optional</small></span><input id="sp-higher" type="text" value="${esc(s.higher || "")}"></label>`;
}
function readSpellFields() {
  const v = id => ($("#" + id) || {}).value || "", c = id => !!($("#" + id) || {}).checked;
  const shape = v("sp-shape");
  return { level: Number(v("sp-level")) || 0, school: v("sp-school"), time: v("sp-time").trim(), range: v("sp-range").trim(), comp: v("sp-comp").trim(), dur: v("sp-dur").trim(),
    conc: c("sp-conc"), ritual: c("sp-ritual"), classes: v("sp-classes").trim(), attack: v("sp-attack"), save: v("sp-save"), half: c("sp-half"),
    dmg: v("sp-dmg").trim(), dtype: v("sp-dtype").trim().toLowerCase(), scale: c("sp-scale") ? "char" : "", heal: v("sp-heal").trim(),
    aoe: shape ? { shape, size: Number(v("sp-size")) || 0 } : null, higher: v("sp-higher").trim() };
}
async function spellCopy(id) {
  const sp = srdSpellObjs().find(s => s.id === id); if (!sp) return;
  const now = new Date().toISOString(), nid = newId();
  const doc = { title: sp.name, type: "spell", tags: [], body: sp.desc, srd: id, source: "SRD 5.1 (2014)", created: now, updated: now,
    spell: { level: sp.level, school: sp.school, time: sp.time, range: sp.range, comp: sp.comp, dur: sp.dur, conc: sp.conc, ritual: sp.ritual, classes: sp.classes.join(", "),
      attack: sp.attack, save: sp.save, half: sp.half, dmg: spellDamage(sp, 1), dtype: sp.dtype, scale: sp.dmgChar ? "char" : "", heal: sp.heal ? (sp.heal[sp.level] || "") : "", aoe: sp.aoe, higher: sp.higher } };
  if (await safeWrite(() => S.db.doc("entries/" + nid).set(doc), `${sp.name} copied to your spells`)) { S.entries.set(nid, doc); location.hash = "entry-" + nid; }
}
// ----- on the character sheet -----
// Combat spells: from the character's list, auto-detected from attack/damage/healing, or ticked by hand.
function combatSpellsHtml(c, id) {
  const k = casterOf(c); if (!k) return "";
  const rows = (c.spells || []).map(s => ({ s, sp: findSpell(s.ref, s.name) })).filter(({ s, sp }) => s.combat === "yes" || (s.combat !== "no" && isCombatSpell(sp)));
  if (!rows.length) return "";
  const lvl = Number(c.level) || 1;
  return `<section class="csec ccombat" data-tab="play"><h2 class="csh">Combat spells</h2><div class="cslist">${rows.map(({ s, sp }) => {
    if (!sp) return `<div class="csrow"><span class="spshape"></span><div class="csmain"><strong>${esc(s.name)}</strong><span class="muted small">Not in the spell list. Add it on the Spells tab to see its details.</span></div></div>`;
    const L = Number(s.level) || sp.level, dmg = spellDamage(sp, lvl, L), heal = spellHeal(sp, L, k.mod);
    const hit = sp.attack === "save" ? `DC ${k.dc} ${String(sp.save || "").toUpperCase()}${sp.half ? " · half" : ""}` : sp.attack ? `${signed(k.atk)} to hit` : "";
    return `<a class="csrow" href="${spellHref(sp)}">${spellShapeSvg(sp)}<div class="csmain"><strong>${esc(sp.name)}</strong><span class="csrange">${esc(rangeShort(sp))}</span></div>
      <div class="csnums">${hit ? `<span class="cshit">${esc(hit)}</span>` : ""}${dmg ? `<span>${diceify(esc(dmg))} ${esc(sp.dtype)}</span>` : ""}${heal ? `<span class="csheal">heals ${diceify(esc(heal))}</span>` : ""}${L ? `<span class="muted small">${SP_COST[L]} SP</span>` : `<span class="muted small">cantrip</span>`}</div></a>`;
  }).join("")}</div></section>`;
}
