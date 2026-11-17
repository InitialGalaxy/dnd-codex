// ---------- Spellcasting with spell points (rules from The Codex of Energies) ----------
// c.caster = { on, kind: "full"|"half"|"halfup"|"third", ability: "int"|"wis"|"cha", spOverride, maxOverride, used, high: { "6": true, … } }
// c.spells = [{ name, level (0 = cantrip), notes, desc }]
const SP_COST = [0, 2, 3, 5, 6, 7, 9, 10, 11, 13];
const SP_TABLE = [0, 4, 6, 14, 17, 27, 32, 38, 44, 57, 64, 73, 73, 83, 83, 94, 94, 107, 114, 123, 133];
const CASTER_KINDS = [["full", "Full caster (bard, cleric, druid, sorcerer, wizard)"], ["half", "Half caster (paladin, ranger): half level, round down"], ["halfup", "Artificer: half level, round up"], ["third", "Third caster (eldritch knight, arcane trickster)"], ["pact", "Warlock: pact magic, spells up to 5th level"]];
const LEVEL_NAME = ["Cantrips", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];
const ordinal = n => ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"][n] || n + "th";
// Highest spell level follows the normal 5e class tables (half and third casters keep their usual limits).
function maxSpellLevel(kind, lvl) {
  const steps = kind === "half" ? [2, 5, 9, 13, 17] : kind === "halfup" ? [1, 5, 9, 13, 17] : kind === "third" ? [3, 7, 13, 19] : kind === "pact" ? [1, 3, 5, 7, 9] : [1, 3, 5, 7, 9, 11, 13, 15, 17];
  return steps.filter(s => lvl >= s).length;
}
function casterOf(c) {
  const k = c.caster || {}; if (!k.on) return null;
  const lvl = Math.max(0, Number(c.level) || 0), kind = k.kind || "full";
  const cl = Math.min(20, kind === "half" ? Math.floor(lvl / 2) : kind === "halfup" ? Math.ceil(lvl / 2) : kind === "third" ? Math.floor(lvl / 3) : lvl);
  const ab = k.ability || "int", mod = cMod(c, ab), pb = cPB(c);
  const max = String(k.spOverride || "").trim() ? Number(k.spOverride) || 0 : SP_TABLE[cl] || 0;
  const maxLvl = String(k.maxOverride || "").trim() ? Number(k.maxOverride) || 0 : maxSpellLevel(kind, lvl);
  const used = Math.min(max, Math.max(0, Number(k.used) || 0));
  return { kind, casterLevel: cl, ability: ab, mod, dc: 8 + pb + mod, atk: pb + mod, max, left: max - used, maxLvl, high: k.high || {} };
}
function spBarHtml(c, id, big) {
  const k = casterOf(c); if (!k) return "";
  const pct = k.max ? (k.left / k.max) * 100 : 0, P = canPlay();
  return `<div class="spbox${big ? " big" : ""}"><div class="spnums"><span class="vl">Spell points</span><strong>${k.left}<small> / ${k.max}</small></strong>
      ${P ? `<span class="spadj"><button class="iconbtn" data-act="spadj" data-v="-1" data-id="${esc(id)}" aria-label="Spend a spell point">−</button><button class="iconbtn" data-act="spadj" data-v="1" data-id="${esc(id)}" aria-label="Regain a spell point">+</button></span>` : ""}</div>
    <div class="spbar" role="img" aria-label="${k.left} of ${k.max} spell points"><i style="width:${pct}%"></i></div></div>`;
}
function spellsSectionHtml(c, id, E, P) {
  const k = casterOf(c); if (!k) return "";
  const list = (c.spells || []).map((s, i) => [s, i]);
  const stat = (l, v) => `<div class="vit"><span class="vl">${l}</span><strong>${v}</strong></div>`;
  const head = `<div class="spstats">${stat("Ability", ({ int: "Intelligence", wis: "Wisdom", cha: "Charisma" })[k.ability] || k.ability.toUpperCase())}${stat("Spell save DC", k.dc)}${stat("Spell attack", signed(k.atk))}${stat("Highest level", k.maxLvl ? ordinal(k.maxLvl) : "—")}</div>${spBarHtml(c, id, true)}`;
  let body;
  if (E) {
    body = `<div class="spedit">${list.map(([s, i]) => `<div class="sbitem"><div class="frow tight">
        <label class="grow"><span>Spell</span>${cField(`spells.${i}.name`, s.name)}</label>
        <label><span>Level</span><select class="cf" data-cf="spells.${i}.level" data-num="1">${LEVEL_NAME.map((l, n) => `<option value="${n}"${(Number(s.level) || 0) === n ? " selected" : ""}>${n ? ordinal(n) + " (" + SP_COST[n] + " SP)" : "Cantrip"}</option>`).join("")}</select></label>
        <label class="grow"><span>Short note</span>${cField(`spells.${i}.notes`, s.notes, { ph: "e.g. concentration, 60 ft" })}</label>
        <label><span>Combat spells</span><select class="cf" data-cf="spells.${i}.combat"><option value="">Auto${isCombatSpell(findSpell(s.ref, s.name)) ? " (yes)" : " (no)"}</option><option value="yes"${s.combat === "yes" ? " selected" : ""}>Always show</option><option value="no"${s.combat === "no" ? " selected" : ""}>Never show</option></select></label>
        <button class="iconbtn" data-act="clistdel" data-v="spells" data-k="${i}" aria-label="Remove ${esc(s.name)}">✕</button></div>
        ${cField(`spells.${i}.desc`, s.desc, { area: 1, rich: 1, rows: 2, ph: "What it does (optional)" })}</div>`).join("")}</div>
      <div class="spadd"><input id="spadd" type="text" list="allspells" placeholder="Add from the spell list, e.g. Fireball" autocomplete="off"><button class="btn small" data-act="spadd" data-id="${esc(id)}">+ Add</button>
        <datalist id="allspells">${allSpells().map(sp => `<option value="${esc(sp.name)}">${esc(spellLevelLine(sp))}</option>`).join("")}</datalist>
        <button class="btn ghost small" data-act="clistadd" data-v="spells">+ Blank spell</button></div>`;
  } else if (!list.length) body = `<p class="muted small">No spells yet. Add them in Edit sheet.</p>`;
  else {
    const levels = [...new Set(list.map(([s]) => Number(s.level) || 0))].sort((a, b) => a - b);
    body = levels.map(L => `<h3 class="fgh splh">${LEVEL_NAME[L]}${L ? ` <span>${SP_COST[L]} SP</span>` : ""}${L >= 6 ? ` <span class="muted">· once per long rest${k.high[L] ? ", used" : ""}</span>` : ""}</h3>
      <div class="splist">${list.filter(([s]) => (Number(s.level) || 0) === L).sort((a, b) => byName(a[0].name, b[0].name)).map(([s, i]) => {
        const over = L > k.maxLvl, ups = L ? Array.from({ length: Math.max(0, k.maxLvl - L + 1) }, (_, j) => L + j) : [];
        const castBtn = !P || !L ? "" : over ? `<span class="muted small">Above your highest level</span>`
          : `<span class="spcast">${ups.length > 1 ? `<select id="spl-${i}" aria-label="Cast ${esc(s.name)} at level">${ups.map(u => `<option value="${u}">${ordinal(u)} · ${SP_COST[u]} SP</option>`).join("")}</select>` : ""}<button class="btn small" data-act="spcast" data-k="${i}" data-id="${esc(id)}"${k.left < SP_COST[L] || (L >= 6 && k.high[L]) ? " disabled" : ""}>Cast${ups.length > 1 ? "" : ` · ${SP_COST[L]} SP`}</button></span>`;
        const sp = findSpell(s.ref, s.name);
        const inner = `${sp ? spellShapeSvg(sp, "mini") : ""}<strong>${sp ? `<a href="${spellHref(sp)}">${esc(s.name || sp.name)}</a>` : esc(s.name || "Unnamed spell")}</strong>${s.notes ? ` <span class="muted">${esc(s.notes)}</span>` : sp ? ` <span class="muted">${esc(rangeShort(sp))}${sp.conc ? " · concentration" : ""}</span>` : ""}`;
        return `<div class="sprow">${s.desc ? `<details class="fitem"><summary>${inner}</summary><div class="prose">${md(s.desc, { base: 3 })}</div></details>` : `<div class="fitem plain">${inner}</div>`}${castBtn}</div>`;
      }).join("")}</div>`).join("");
  }
  return `<section class="csec cspells" data-tab="spells"><h2 class="csh">Spells</h2>${head}${body}</section>`;
}
function casterEditHtml(c) {
  const k = c.caster || {};
  return `<div class="frow casterrow"><label class="check inline"><input type="checkbox" class="cf" data-cf="caster.on"${k.on ? " checked" : ""}> Is a spellcaster</label>
    ${k.on ? `<label><span>Caster type</span><select class="cf" data-cf="caster.kind">${CASTER_KINDS.map(([v, l]) => `<option value="${v}"${(k.kind || "full") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label><span>Spellcasting ability</span><select class="cf" data-cf="caster.ability">${[["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]].map(([v, l]) => `<option value="${v}"${(k.ability || "int") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label><span>Max spell points</span>${cField("caster.spOverride", k.spOverride, { cls: "mini", ph: String((casterOf(c) || {}).max != null && !String(k.spOverride || "").trim() ? casterOf(c).max : "auto") })}</label>
      <label><span>Highest level</span>${cField("caster.maxOverride", k.maxOverride, { cls: "mini", ph: String(!String(k.maxOverride || "").trim() && casterOf(c) ? casterOf(c).maxLvl : "auto") })}</label>` : ""}</div>
    ${k.on ? `<p class="muted small">Spell points come from the Codex of Energies table using ${(casterOf(c) || {}).casterLevel || 0} caster levels; highest spell level follows the normal 5e table for the class. Type in the boxes to override them.</p>` : ""}`;
}
function spellAction(a, el, id, c) {
  if (a === "spadd") {
    const nm = (($("#spadd") || {}).value || "").trim(); if (!nm) { toast("Type a spell name first.", "bad"); return true; }
    const sp = findSpell("", nm);
    charChange(id, x => { x.spells = x.spells || []; x.spells.push(sp ? { name: sp.name, level: sp.level, ref: sp.id, notes: "", desc: "" } : { name: nm, level: 0, notes: "", desc: "" }); });
    toast(sp ? `${sp.name} added` : `${nm} added. It isn't in the spell list, so set its level by hand.`);
    return true;
  }
  if (a === "spadj") { const d = Number(el.dataset.v); charChange(id, x => { const k = x.caster = x.caster || {}; const info = casterOf(x); k.used = Math.min(info.max, Math.max(0, (Number(k.used) || 0) - d)); }); return true; }
  if (a === "spcast") {
    const i = Number(el.dataset.k), s = (c.spells || [])[i]; if (!s) return true;
    const sel = document.getElementById("spl-" + i), L = sel ? Number(sel.value) : Number(s.level) || 0, cost = SP_COST[L] || 0, info = casterOf(c);
    if (info.left < cost) { toast(`Not enough spell points: ${s.name} at ${ordinal(L)} level costs ${cost}.`, "bad"); return true; }
    if (L >= 6 && info.high[L]) { toast(`A ${ordinal(L)}-level spell has already been cast since the last long rest.`, "bad"); return true; }
    charChange(id, x => { const k = x.caster; k.used = (Number(k.used) || 0) + cost; if (L >= 6) { k.high = Object.assign({}, k.high, { [L]: true }); } });
    toast(`Cast ${s.name}${L !== (Number(s.level) || 0) ? ` at ${ordinal(L)} level` : ""} · ${info.left - cost} SP left`);
    return true;
  }
  return false;
}
