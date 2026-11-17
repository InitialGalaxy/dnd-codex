// ---------- Import bar: one strip across the top of the entry editor for every type that can be pasted in ----------
const IMPORTERS = {
  spell: { what: "spell", ph: "Paste the whole spell: name, level and school, casting time, range, components, duration and description.", apply: t => spellImportApply(t) },
  feat: { what: "feat", ph: "Paste the whole feat: name, any prerequisite or feat type line, and what it does.", apply: t => featImportApply(t) },
  item: { what: "item", ph: "Paste the whole item: name, the type and rarity line (e.g. “Ring, rare (requires attunement)”) and its description.", apply: t => itemImportApply(t) }
};
function importBarHtml(type) {
  const im = IMPORTERS[type];
  return `<div class="impbar"${im ? "" : " hidden"}>
    <div class="imphead"><span class="impicon" aria-hidden="true">📋</span><span class="grow"><strong>Import from text</strong> <span class="muted small" id="imp-what">Copy ${im && /^[aeiou]/.test(im.what) ? "an" : "a"} ${esc(im ? im.what : "")} from a book, wiki or the SRD and paste it here to fill in the form.</span></span>
      <button type="button" class="btn small" data-act="impopen" aria-expanded="false">Import</button></div>
    <div class="impbox" hidden>
      <textarea id="imp-paste" rows="7" placeholder="${esc(im ? im.ph : "")}"></textarea>
      <div class="acts"><button type="button" class="btn" data-act="impgo">Fill in from text</button><button type="button" class="btn ghost" data-act="impopen">Cancel</button><span class="muted small">Any layout is fine. Check the result before saving.</span></div>
    </div></div>`;
}
function impRefresh() {
  const bar = document.querySelector(".impbar"), ty = $("#ed-type"); if (!bar || !ty) return;
  const im = IMPORTERS[ty.value]; bar.hidden = !im; if (!im) return;
  $("#imp-what").textContent = `Copy ${/^[aeiou]/.test(im.what) ? "an" : "a"} ${im.what} from a book, wiki or the SRD and paste it here to fill in the form.`;
  $("#imp-paste").placeholder = im.ph;
}
function impAction(a) {
  const bar = document.querySelector(".impbar"); if (!bar) return;
  const box = bar.querySelector(".impbox"), btn = bar.querySelector('.imphead [data-act="impopen"]');
  if (a === "impopen") { box.hidden = !box.hidden; btn.setAttribute("aria-expanded", String(!box.hidden)); btn.textContent = box.hidden ? "Import" : "Close"; if (!box.hidden) $("#imp-paste").focus(); return; }
  const im = IMPORTERS[$("#ed-type").value], t = $("#imp-paste").value;
  if (!im || !t.trim()) { toast("Paste something first.", "bad"); return; }
  im.apply(t);
  box.hidden = true; btn.textContent = "Import"; btn.setAttribute("aria-expanded", "false"); $("#imp-paste").value = "";
}
document.addEventListener("change", ev => { if (ev.target.id === "ed-type") impRefresh(); });

// ----- Items: read "Name / Ring, rare (requires attunement) / description" from most sources -----
const SIMPLE_WEAPONS = ["club", "dagger", "greatclub", "handaxe", "javelin", "light hammer", "mace", "quarterstaff", "sickle", "spear"];
const RANGED_WEAPONS = ["crossbow", "bow", "sling", "dart", "blowgun", "net"];
function parseItemText(raw) {
  const lines = String(raw || "").replace(/\r/g, "").replace(/ /g, " ").split("\n").map(l => l.trim());
  while (lines.length && !lines[0]) lines.shift();
  const clean = l => l.replace(/^#+\s*/, "").replace(/^[*_]+|[*_]+$/g, "").trim();
  const out = { name: lines.length ? clean(lines.shift()) : "", category: "", base: "", rarity: "", attune: false, attuneBy: "", magical: null, desc: "" };
  const RAR = /\b(common|uncommon|rare|very rare|legendary|artifact|artefact|unique|varies)\b/i;
  let i = 0;
  while (i < lines.length && !lines[i]) i++;
  const meta = i < lines.length ? clean(lines[i]) : "";
  const mm = meta.match(/^(.*?)(?:,\s*|\s+)((?:very )?(?:common|uncommon|rare)|legendary|artifact|artefact|unique|rarity varies|varies)\b(.*)$/i);
  if (mm && mm[1].length < 60) {
    i++;
    out.rarity = mm[2].toLowerCase().replace("artefact", "artifact").replace(/^rarity varies$|^varies$/, "");
    out.magical = true;
    const at = (mm[3] || "").match(/requires attunement\s*([^)]*)/i); if (at) { out.attune = true; out.attuneBy = at[1].trim(); }
    let type = mm[1].trim(), m;
    if ((m = type.match(/^weapon\s*\(([^)]+)\)/i))) {
      out.base = m[1].trim(); const b = out.base.toLowerCase();
      out.category = RANGED_WEAPONS.some(w => b.includes(w)) ? "Ranged weapon" : SIMPLE_WEAPONS.some(w => b === w) ? "Simple weapon" : "Martial weapon";
    } else if ((m = type.match(/^armou?r\s*\(([^)]+)\)/i))) { out.base = m[1].trim(); out.category = /shield/i.test(out.base) ? "Shield" : "Armour"; }
    else if (/^shield/i.test(type)) out.category = "Shield";
    else { const hit = ITEM_CATEGORIES.find(c => c.toLowerCase() === type.toLowerCase() || type.toLowerCase().startsWith(c.toLowerCase())); out.category = hit || type.replace(/\b\w/g, ch => ch.toUpperCase()).replace(/\bItem\b/, "item"); }
  }
  const rest = lines.slice(i);
  out.desc = rest.reduce((t, l) => t + (t ? (/^[-•]/.test(l) && /(^|\n)- [^\n]*$/.test(t) ? "\n" : "\n\n") : "") + l.replace(/^[•●▪]\s*/, "- "), "").replace(/\n{3,}/g, "\n\n").trim();
  return out;
}
// Description paragraphs that start with a short "Name." become their own abilities; the rest is one unnamed ability.
function itemImportApply(text) {
  const p = parseItemText(text); if (!p.name && !p.desc) { toast("Couldn't find an item in that text.", "bad"); return; }
  const set = (id, v) => { const el = $("#" + id); if (el && v != null && v !== "") { if (el.type === "checkbox") el.checked = !!v; else el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); } };
  if (p.name) set("ed-title", p.name);
  if (p.magical) set("it-magical", true);
  if (p.category) {
    const known = ITEM_CATEGORIES.find(c => c.toLowerCase() === p.category.toLowerCase());
    if (known) set("it-cat", known); else { set("it-cat", "__other"); set("it-catother", p.category); }
  }
  if (p.base) set("it-base", p.base);
  if (p.attune) set("it-attune", true);
  if (p.attuneBy) set("it-extra", p.attuneBy.replace(/^by\s+/i, "attuned by "));
  if (p.rarity) set("ed-rarity", p.rarity);
  const paras = p.desc.split(/\n\s*\n/).filter(x => x.trim()), items = [], plain = [];
  paras.forEach(x => { const m = x.match(/^\**([A-Z][^.\n]{1,40}?)\.\**\s+([\s\S]+)$/); if (m && m[1].split(/\s+/).length <= 6) items.push({ name: m[1].replace(/\*/g, "").trim(), desc: m[2].trim() }); else if (items.length) items[items.length - 1].desc += "\n\n" + x; else plain.push(x); });
  if (plain.length) items.unshift({ name: "", desc: plain.join("\n\n") });
  if (items.length) { DRAFT.it = [{ name: "", items }]; redrawSections(null, "it"); }
  if (typeof updateItemLine === "function") updateItemLine();
  if (typeof updateStatPanels === "function") updateStatPanels();
  toast(`Filled in ${[p.name && "name", p.category && "category", p.rarity && "rarity", p.attune && "attunement", items.length && "description"].filter(Boolean).join(", ") || "what it could"}. Check it over before saving.`);
}

// ----- Creatures: a stat block copied from a book, the SRD, D&D Beyond or a wiki (2014 or 2024 layout) -----
const SB_SECTIONS = /^(traits|actions|bonus actions|reactions|legendary actions|lair actions|mythic actions|regional effects)\s*:?$/i;
const ABIL = ["str", "dex", "con", "int", "wis", "cha"];
function parseCreatureText(raw) {
  const lines = String(raw || "").replace(/\r/g, "").replace(/ /g, " ").replace(/[–—−]/g, m => m === "−" ? "-" : m).split("\n").map(l => l.replace(/^[#>*_\s]+|[*_\s]+$/g, "").replace(/\*\*/g, "").trim()).filter(Boolean);
  const sb = { subtitle: "", ac: "", hp: "", speed: "", cr: "", prof: "", str: "", dex: "", con: "", int: "", wis: "", cha: "" };
  const det = {}, sections = [{ name: "Traits", items: [] }];
  let name = lines.length ? lines.shift() : "", inStats = true, scores = [];
  if (lines[0] && /^(tiny|small|medium|large|huge|gargantuan)\b/i.test(lines[0])) sb.subtitle = lines.shift();
  const DET = [[/^(saving throws|saves)\b/i, "Saving Throws"], [/^skills\b/i, "Skills"], [/^(damage )?vulnerabilities\b/i, "Damage Vulnerabilities"], [/^(damage )?resistances\b/i, "Damage Resistances"], [/^damage immunities\b/i, "Damage Immunities"], [/^condition immunities\b/i, "Condition Immunities"], [/^immunities\b/i, "Damage Immunities"], [/^senses\b/i, "Senses"], [/^languages\b/i, "Languages"], [/^gear\b/i, "Gear"]];
  const cur = () => sections[sections.length - 1];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]; let m;
    if (inStats) {
      if ((m = l.match(/^(?:armou?r class|ac)\b\s*:?\s*(.+)$/i))) { const v = m[1].replace(/\s*initiative\s*([+-]\d+)(\s*\(\d+\))?/i, ""); sb.ac = v.trim(); const ini = m[1].match(/initiative\s*([+-]\d+)/i); if (ini) det.Initiative = ini[1]; continue; }
      if ((m = l.match(/^(?:hit points|hp)\b\s*:?\s*(.+)$/i))) { sb.hp = m[1].trim(); continue; }
      if ((m = l.match(/^speed\b\s*:?\s*(.+)$/i))) { sb.speed = m[1].trim(); continue; }
      if ((m = l.match(/^(?:challenge|cr)\b\s*:?\s*(.+)$/i))) {
        const pb = m[1].match(/(?:proficiency bonus|pb)\s*:?\s*([+-]?\d+)/i); if (pb) sb.prof = (/^[+-]/.test(pb[1]) ? "" : "+") + pb[1];
        const xp = m[1].match(/([\d,]+)\s*xp|xp\s*([\d,]+)/i);
        sb.cr = (m[1].match(/^\s*([\d/]+)/) || ["", m[1]])[1] + (xp ? ` (${(xp[1] || xp[2])} XP)` : ""); continue;
      }
      if ((m = l.match(/^proficiency bonus\b\s*:?\s*([+-]?\d+)/i))) { sb.prof = (/^[+-]/.test(m[1]) ? "" : "+") + m[1]; continue; }
      // One ability per line, 2024 style: "Str 18 +4 +4" or "STR 18 (+4)"
      if ((m = l.match(/^(str|dex|con|int|wis|cha)\b\s*:?\s*(\d{1,2})\b/i)) && !/^(str|dex)\w*\s+\d+\s*\(.*\)\s+(str|dex|con)/i.test(l)) {
        const rest = l.match(/\b(str|dex|con|int|wis|cha)\b\s*:?\s*(\d{1,2})/gi);
        if (rest && rest.length > 1) rest.forEach(t => { const mm = t.match(/(\w{3})\s*:?\s*(\d+)/); sb[mm[1].toLowerCase()] = mm[2]; });
        else sb[m[1].toLowerCase()] = m[2];
        continue;
      }
      // Header row "STR DEX CON INT WIS CHA" then the scores, on one line or several.
      if (/^str\b.*\bdex\b/i.test(l) || /^(str|dex|con|int|wis|cha)$/i.test(l) || /^mod\s+save/i.test(l)) { continue; }
      const nums = [...l.matchAll(/(\d{1,2})\s*\(\s*[+-]?\d+\s*\)/g)].map(x => x[1]);
      if (nums.length && /^[\d\s()+-]+$/.test(l)) { scores.push(...nums); continue; }
      const hit = DET.find(([re]) => re.test(l));
      if (hit) { det[hit[1]] = l.replace(hit[0], "").replace(/^\s*:?\s*/, "").trim(); continue; }
    }
    if ((m = l.match(SB_SECTIONS))) { inStats = false; const nm = m[1].replace(/\b\w/g, c => c.toUpperCase()); if (nm === "Traits") continue; sections.push({ name: nm, items: [] }); continue; }
    if ((m = l.match(/^([A-Z][^.:]{0,60}?(?:\s*\([^)]{1,40}\))?)\.\s+(.+)$/)) && m[1].split(/\s+/).length <= 8) { inStats = false; cur().items.push({ name: m[1].trim(), desc: m[2].trim() }); continue; }
    if (inStats && !sections.some(s => s.items.length)) { if (!sb.subtitle && /^(tiny|small|medium|large|huge|gargantuan)\b/i.test(l)) { sb.subtitle = l; continue; } }
    inStats = false;
    const last = cur().items[cur().items.length - 1];
    if (last) last.desc += (/^[-•]/.test(l) ? "\n" : "\n\n") + l.replace(/^•\s*/, "- "); else cur().items.push({ name: "", desc: l });
  }
  scores.slice(0, 6).forEach((v, k) => { if (!sb[ABIL[k]]) sb[ABIL[k]] = v; });
  if (!sb.prof && sb.cr) { const c = crNum(firstWord(sb.cr)); if (isFinite(c)) sb.prof = "+" + (c < 5 ? 2 : c < 9 ? 3 : c < 13 ? 4 : c < 17 ? 5 : c < 21 ? 6 : c < 25 ? 7 : c < 29 ? 8 : 9); }
  const knownDet = DETAIL_FIELDS.map(([k]) => k);
  sb.details = Object.entries(det).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
  sb.features = serializeFeatures(sections);
  return { name, sb, found: [sb.ac && "AC", sb.hp && "hit points", sb.speed && "speed", ABIL.every(k => sb[k]) && "ability scores", sb.cr && "challenge", Object.keys(det).length && "details", sections.some(s => s.items.length) && "traits and actions"].filter(Boolean) };
}
function creatureImportApply(text) {
  const p = parseCreatureText(text); if (!p.name) { toast("Couldn't find a stat block in that text.", "bad"); return; }
  if (p.name) $("#ed-title").value = p.name;
  const fs = $("#sbsections") && $("#sbsections").closest("fieldset"); if (!fs) return;
  const legend = fs.querySelector("legend"); fs.innerHTML = ""; if (legend) fs.appendChild(legend);
  fs.insertAdjacentHTML("beforeend", sbFields(p.sb));
  richifyAll(fs, "textarea.itdesc, textarea.atk-extra", { tools: "small", base: 1 });
  if (typeof lootCalcAll === "function") lootCalcAll();
  toast(`Filled in ${p.found.join(", ") || "what it could"}. Check it over before saving.`);
}

// ----- Races: name, then "Ability Score Increase. …", "Size. …", "Speed. …" and traits as "Name. text" -----
function parseRaceText(raw) {
  const lines = String(raw || "").replace(/\r/g, "").replace(/ /g, " ").split("\n").map(l => l.replace(/^[#>\s]+/, "").trim());
  while (lines.length && !lines[0]) lines.shift();
  const out = { name: lines.length ? lines.shift().replace(/^\*+|\*+$/g, "").replace(/\s+traits$/i, "").trim() : "", size: "", speed: "", asi: "", traits: [], body: [] };
  let cur = null; const intro = [];
  for (const l0 of lines) {
    const l = l0.replace(/^\*\*\*?|\*\*\*?(?=\.)/g, "").replace(/\*\*/g, "").trim(); if (!l) continue;
    const m = l.match(/^([A-Z][^.:]{0,40}?)[.:]\s+(.+)$/);
    if (m && m[1].split(/\s+/).length <= 6) {
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (/^ability score (increase|increases)$/.test(k)) { out.asi = v; cur = null; continue; }
      if (k === "size") { out.size = (v.match(/\b(small|medium|large)\b/i) || [, ""])[1].replace(/^\w/, c => c.toUpperCase()); out.body.push(`**Size.** ${v}`); cur = null; continue; }
      if (k === "speed") { const sp = v.match(/(\d+)\s*(feet|ft)/i); out.speed = sp ? sp[1] + " feet" : v; cur = null; continue; }
      if (["age", "alignment", "languages", "creature type"].includes(k)) { out.body.push(`**${m[1]}.** ${v}`); cur = null; continue; }
      cur = { n: m[1].trim(), d: v }; out.traits.push(cur); continue;
    }
    if (cur) cur.d += "\n\n" + l; else intro.push(l);
  }
  if (intro.length) out.body.unshift(intro.join("\n\n"));
  return out;
}
function raceImportApply(text) {
  const p = parseRaceText(text); if (!p.name) { toast("Couldn't find a race in that text.", "bad"); return; }
  $("#ed-title").value = p.name;
  if (p.size) $("#rc-size").value = p.size;
  if (p.speed) $("#rc-speed").value = p.speed;
  if (p.asi) $("#rc-asi").value = p.asi;
  const box = $("#rc-rows");
  if (box && p.traits.length) { box.innerHTML = p.traits.map(t => hbRow("rc", t)).join(""); richifyAll(box, "textarea.hb-d", { tools: "small", base: 3 }); }
  if (p.body.length) setRichValue($("#ed-body"), p.body.join("\n\n"), 2);
  toast(`Filled in ${[p.asi && "ability scores", p.size && "size", p.speed && "speed", p.traits.length && p.traits.length + " traits", p.body.length && "description"].filter(Boolean).join(", ") || "what it could"}. Check it over before saving.`);
}
IMPORTERS.creature = { what: "stat block", ph: "Paste the whole stat block: name, size and type, AC, HP, speed, ability scores, the detail lines, then traits and actions.", apply: t => creatureImportApply(t) };
IMPORTERS.race = { what: "race", ph: "Paste the race: its name, then lines like “Ability Score Increase. …”, “Size. …”, “Speed. …” and each trait.", apply: t => raceImportApply(t) };
