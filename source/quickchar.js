// ---------- New character: quick create (race, class, level → a ready sheet) or manual ----------
const QC_PRIO = {
  Barbarian: ["str", "con", "dex", "wis", "cha", "int"], Bard: ["cha", "dex", "con", "wis", "int", "str"], Cleric: ["wis", "con", "str", "dex", "cha", "int"],
  Druid: ["wis", "con", "dex", "int", "cha", "str"], Fighter: ["str", "con", "dex", "wis", "cha", "int"], Monk: ["dex", "wis", "con", "str", "int", "cha"],
  Paladin: ["str", "cha", "con", "wis", "dex", "int"], Ranger: ["dex", "wis", "con", "str", "int", "cha"], Rogue: ["dex", "con", "int", "wis", "cha", "str"],
  Sorcerer: ["cha", "con", "dex", "wis", "int", "str"], Warlock: ["cha", "con", "dex", "wis", "int", "str"], Wizard: ["int", "con", "dex", "wis", "cha", "str"],
  Artificer: ["int", "con", "dex", "wis", "str", "cha"]
};
// Starting gear: [weapons…], armour, shield. Ids are SRD equipment.
const QC_GEAR = {
  Barbarian: [["greataxe", "handaxe"], "", false], Bard: [["rapier", "dagger"], "leather-armor", false], Cleric: [["mace", "crossbow-light"], "scale-mail", true],
  Druid: [["scimitar", "quarterstaff"], "leather-armor", true], Fighter: [["longsword", "longbow"], "chain-mail", true], Monk: [["shortsword", "dagger"], "", false],
  Paladin: [["longsword", "javelin"], "chain-mail", true], Ranger: [["longbow", "shortsword"], "leather-armor", false], Rogue: [["rapier", "shortbow", "dagger"], "leather-armor", false],
  Sorcerer: [["crossbow-light", "dagger"], "", false], Warlock: [["crossbow-light", "dagger"], "leather-armor", false], Wizard: [["quarterstaff", "dagger"], "", false],
  Artificer: [["crossbow-light", "mace"], "scale-mail", true]
};
const QC_ARRAY = [15, 14, 13, 12, 10, 8];
const ABN_RE = { str: /strength/i, dex: /dexterity/i, con: /constitution/i, int: /intelligence/i, wis: /wisdom/i, cha: /charisma/i };

function qcRaces() {
  const srd = (typeof SRD_RACE_DOCS !== "undefined" ? SRD_RACE_DOCS : []).map(r => ["srd:" + r.title, r.title]);
  const lib = [...S.entries].filter(([, e]) => e.type === "race" && !e.srd).sort((a, b) => byName(a[1].title, b[1].title)).map(([id, e]) => ["hb:" + id, e.title]);
  return { srd, lib };
}
function qcSubraces(race) { const n = race.startsWith("srd:") ? race.slice(4) : ""; return n && SRD_RACE_TRAITS[n] ? Object.keys(SRD_RACE_TRAITS[n].sub || {}) : []; }
function qcSubclasses(cls) {
  const d = cls && classFeats(cls); const out = [];
  (homebrewSubclasses(cls) || []).forEach(([id, e]) => out.push(["hb:" + id, e.title]));
  (d && d.subs || []).forEach(s => { if (!out.some(o => o[1].toLowerCase() === s.toLowerCase())) out.push(["srd:" + s, s]); });
  return out;
}
function qcDialog() {
  const { srd, lib } = qcRaces(), classes = allClassNames();
  openModal(`<h2>New character</h2>
    <div class="qcmodes"><button class="qcmode on" type="button" data-qcmode="quick"><b>⚡ Quick create</b><span class="muted small">Pick a race, class and level. Ability scores, hit points, AC, proficiencies, features and starting gear are filled in for you.</span></button>
      <button class="qcmode" type="button" data-act="qcmanual"><b>✎ Manual</b><span class="muted small">A blank sheet to fill in yourself.</span></button></div>
    <div class="qcform">
      <div class="frow"><label class="grow"><span>Name</span><input id="qc-name" type="text" placeholder="e.g. Brannoc" autocomplete="off"></label><label><span>Level</span><input id="qc-level" type="number" min="1" max="20" value="1" class="mini"></label></div>
      <div class="frow"><label class="grow"><span>Race</span><select id="qc-race">${srd.length ? `<optgroup label="SRD">${srd.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</optgroup>` : ""}${lib.length ? `<optgroup label="Your library">${lib.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</optgroup>` : ""}</select></label>
        <label class="grow" id="qc-subwrap"><span>Subrace</span><select id="qc-subrace"></select></label></div>
      <div class="frow"><label class="grow"><span>Class</span><select id="qc-class">${classes.map(c => `<option${c === "Fighter" ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <label class="grow"><span>Subclass</span><select id="qc-sub"></select></label></div>
      <div class="frow"><label class="grow"><span>Ability scores</span><select id="qc-scores"><option value="array">Standard array (15, 14, 13, 12, 10, 8), placed for the class</option><option value="roll">Roll 4d6, drop the lowest, placed for the class</option></select></label></div>
      <label class="check"><input type="checkbox" id="qc-gear" checked> Starting weapons and armour, equipped</label>
      ${READONLY ? "" : `<label class="check"><input type="checkbox" id="qc-hidden"> Hide from players (an NPC)</label>`}
      <p class="muted small">Spells aren't picked for you: choose them on the sheet once it's made. Everything can be changed afterwards.</p>
      <div class="acts"><button class="btn ghost" type="button" data-act="closemodal">Cancel</button><button class="btn" type="button" data-act="qcgo">Create character</button></div>
    </div>`, m => { qcSync(); m.querySelector("#qc-name").focus(); });
}
function qcSync() {
  const race = ($("#qc-race") || {}).value || "", subs = qcSubraces(race);
  $("#qc-subwrap").hidden = !subs.length;
  $("#qc-subrace").innerHTML = subs.map(s => `<option>${esc(s)}</option>`).join("");
  const cls = ($("#qc-class") || {}).value || "", d = classFeats(cls), subLv = d && d.subLv ? Number(d.subLv) : d && d.f ? (d.f.find(f => /archetype|tradition|domain|circle|college|oath|patron|origin|path|conclave|subclass|specialist/i.test(f.n)) || {}).lv || 3 : 3;
  const lv = Number(($("#qc-level") || {}).value) || 1;
  const opts = qcSubclasses(cls), keep = ($("#qc-sub") || {}).value;
  $("#qc-sub").innerHTML = `<option value="">${lv < subLv ? `None yet (chosen at level ${subLv})` : "None"}</option>` + opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  $("#qc-sub").disabled = lv < subLv;
  if (lv >= subLv && opts.length) $("#qc-sub").value = opts.some(o => o[0] === keep) ? keep : opts[0][0];
}
document.addEventListener("change", ev => { if (["qc-race", "qc-class", "qc-level"].includes(ev.target.id)) qcSync(); });
document.addEventListener("input", ev => { if (ev.target.id === "qc-level") qcSync(); });

// Racial increases, read from the race's text: "+2 Strength", "Your Dexterity score increases by 2", "ability scores each increase by 1".
function qcRaceAsi(race, sub, prio) {
  const add = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  const texts = [];
  if (race.startsWith("srd:")) {
    const doc = SRD_RACE_DOCS.find(r => r.title === race.slice(4)); if (doc) texts.push(doc.race.asi || "");
    const st = (doc && doc.race.traits || []).find(t => t.n === sub + " (subrace)"); if (st) texts.push((st.d.match(/\*\*Ability Score Increase\.\*\*([^\n]*)/) || [])[1] || "");
  } else { const e = S.entries.get(race.slice(3)); if (e && e.race) texts.push(e.race.asi || ""); }
  for (const t of texts) {
    if (/scores? each increase by 1|all.*ability scores.*increase by 1/i.test(t)) { Object.keys(add).forEach(k => add[k] += 1); continue; }
    for (const part of t.split(/[,;]|\band\b/)) for (const [k, re] of Object.entries(ABN_RE)) { const m = part.match(new RegExp(re.source + "[^\\d]{0,40}?(?:by\\s*)?\\+?(\\d)", "i")) || part.match(new RegExp("\\+(\\d)\\s*" + re.source, "i")); if (m) add[k] += Number(m[1]); }
    // "two other ability scores of your choice increase by 1" (half-elf and the like)
    const ch = t.match(/(two|one|three) (?:other |different )?ability scores? of your choice (?:each )?increases? by (\d)/i);
    if (ch) { let n = { one: 1, two: 2, three: 3 }[ch[1].toLowerCase()]; for (const k of prio) { if (!n) break; if (!add[k]) { add[k] += Number(ch[2]); n--; } } }
  }
  return add;
}
const qcRoll = () => { const r = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a); return r[0] + r[1] + r[2]; };

function qcBuild() {
  const name = ($("#qc-name").value || "").trim() || "New character", lvl = Math.max(1, Math.min(20, Number($("#qc-level").value) || 1));
  const race = $("#qc-race").value, subrace = $("#qc-subwrap").hidden ? "" : $("#qc-subrace").value, cls = $("#qc-class").value, subV = $("#qc-sub").disabled ? "" : $("#qc-sub").value;
  const d = classFeats(cls) || {}, b = d.basics || SRD_CLASS_BASICS[cls] || {};
  const prio = QC_PRIO[cls] || [...(b.primary || []), "con", "dex", "wis", "str", "int", "cha"].filter((v, i, a) => a.indexOf(v) === i);
  const c = blankCharacter(name);
  // Ability scores: array or rolls, highest to the class's most important ability; then race; then each Ability Score Improvement.
  const vals = $("#qc-scores").value === "roll" ? Array.from({ length: 6 }, qcRoll).sort((x, y) => y - x) : QC_ARRAY.slice();
  prio.forEach((k, i) => { c.abilities[k] = vals[i]; });
  const radd = qcRaceAsi(race, subrace, prio); Object.keys(radd).forEach(k => { c.abilities[k] += radd[k]; });
  // Ability Score Improvements are recorded as level-up choices (so they show on the sheet and can be changed), not baked in.
  const asiLevels = (Array.isArray(d.asi) && d.asi.length ? d.asi : (d.f || []).filter(f => /^Ability Score Improvement/i.test(f.n)).map(f => f.lv)).map(Number).filter(l => l <= lvl).sort((x, y) => x - y);
  const work = Object.assign({}, c.abilities); c.asi = {};
  for (const L of asiLevels) {
    const top = prio.find(a => work[a] < 20); if (!top) break;
    if (work[top] <= 18) { work[top] += 2; c.asi[L] = { type: "one", a: top }; continue; }
    const two = prio.filter(a => work[a] < 20).slice(0, 2);
    if (two.length === 2) { two.forEach(a => work[a]++); c.asi[L] = { type: "two", a: two[0], b: two[1] }; }
    else if (two.length === 1) { work[two[0]]++; c.asi[L] = { type: "two", a: two[0], b: prio.find(a => a !== two[0]) }; }
  }
  const mod = a => Math.floor((work[a] - 10) / 2);
  // Race details
  let raceName = "", speed = "30ft";
  if (race.startsWith("srd:")) { const doc = SRD_RACE_DOCS.find(r => r.title === race.slice(4)); raceName = subrace || race.slice(4); if (doc) speed = String(doc.race.speed || "30").replace(/\s*feet?/i, "ft").replace(/\s+/g, ""); }
  else { const e = S.entries.get(race.slice(3)); raceName = e ? e.title : ""; if (e && e.race && e.race.speed) speed = String(e.race.speed).replace(/\s*feet?/i, "ft").replace(/\s+/g, ""); }
  c.race = raceName; c.speed = speed; c.classes = cls; c.level = lvl;
  // Class basics: hit dice, saves, proficiencies, spellcasting
  const die = Number(b.hd || d.hd || 8);
  c.hd = { die: "1d" + die, total: lvl, used: 0 };
  (b.saves || []).forEach(a => { c.saves[a] = true; });
  c.profs = { armour: profParse("armour", b.armour), weapons: profParse("weapons", b.weapons), tools: profParse("tools", b.tools), languages: "Common" };
  if (b.caster) c.caster = { on: true, kind: b.caster, ability: b.castAbil || prio[0], used: 0, high: {} };
  // Skills: the class's choices that suit the character's best abilities
  const pool = (b.skills || []).map(k => SKILLS.find(s => s[0] === k)).filter(Boolean).sort((x, y) => mod(y[2]) - mod(x[2]));
  pool.slice(0, Number(b.skillsN) || 2).forEach(s => { c.skills[s[0]] = 1; });
  // Subclass
  if (subV.startsWith("hb:")) { const e = S.entries.get(subV.slice(3)); if (e) { c.subclass = e.title; c.subclassRef = subV.slice(3); } }
  else if (subV.startsWith("srd:")) c.subclass = subV.slice(4);
  if (d.id) c.classRef = d.id;
  // Features from the class (and subclass) and the race
  const withSub = !!subV;
  const feats = [...fillClassFeatures(c, cls, lvl, withSub).map(f => ({ name: f.n, source: "Class", note: (f.sub ? f.sub + " · " : "") + "level " + f.lv, desc: f.d || "" })),
    ...fillRaceTraits(race.startsWith("srd:") ? race.slice(4) : race, subrace).map(f => ({ name: f.n, source: "Race", note: raceName, desc: f.d || "" }))];
  const seen = new Set(); c.features = feats.filter(f => { if (/^Ability Score Improvement/i.test(f.name)) return false; const k = featKey(f.name); if (seen.has(k)) return false; seen.add(k); return true; });
  // One "Ability Score Improvement" line per improvement, saying what it went into.
  const ABN = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
  asiLevels.forEach(L => { const p = c.asi[L]; if (!p) return; c.features.push({ name: "Ability Score Improvement", source: "Class", note: "level " + L, lv: L, desc: p.type === "one" ? `+2 ${ABN[p.a]}.` : `+1 ${ABN[p.a]} and +1 ${ABN[p.b]}.` }); });
  c.resources = qcResources(cls, lvl, c.subclass || "", mod);
  // Hit points: full die at level 1, the average after that, plus Constitution each level (and Dwarven Toughness)
  const tough = c.features.some(f => /dwarven toughness/i.test(f.name)) ? lvl : 0;
  const hp = Math.max(1, die + (lvl - 1) * (die / 2 + 1) + mod("con") * lvl + tough);
  c.hp = { max: hp, cur: hp, temp: 0 };
  // Gear and AC
  const [weps, armour, shield] = QC_GEAR[cls] || [["dagger"], "", false];
  const want = $("#qc-gear").checked, slots = {};
  let ac = 10 + mod("dex");
  if (cls === "Barbarian") ac = 10 + mod("dex") + mod("con");
  if (cls === "Monk") ac = 10 + mod("dex") + mod("wis");
  const eq = id => SRD_EQUIP.find(x => x.id === id);
  if (want) {
    const ar = armour && eq(armour);
    if (ar) { const st = ar.item.stats || {}, dx = st.dex ? Math.min(mod("dex"), String(st.dexMax || "").trim() ? Number(st.dexMax) : 99) : 0; ac = (parseInt(st.ac, 10) || 10) + dx; slots.ar = { ref: "s:" + ar.id, qty: 1, name: ar.title }; }
    if (shield && eq("shield")) { ac += 2; slots.w5 = { ref: "s:shield", qty: 1, name: "Shield" }; }
    weps.forEach((w, i) => { const it = eq(w); if (it) slots["w" + i] = { ref: "s:" + it.id, qty: /dagger|javelin|handaxe/.test(w) ? (w === "javelin" ? 4 : 2) : 1, name: it.title }; });
    c.inv = { cols: INV_DEFAULT.cols, rows: INV_DEFAULT.rows, slots };
  }
  c.ac = ""; // blank: the sheet works AC out from the armour worn (or Unarmoured Defence)
  if (($("#qc-hidden") || {}).checked) c.hidden = true;
  return c;
}
async function qcCreate() {
  let c; try { c = qcBuild(); } catch (e) { console.warn(e); toast("Couldn't build that character.", "bad"); return; }
  const nid = "c" + Date.now().toString(36);
  closeModal();
  if (await safeWrite(() => S.db.doc("characters/" + nid).set(c))) { S.chars.set(nid, c); CS.edit = false; CS.tab = "play"; CS.view = "sheet"; location.hash = "char-" + nid; toast(`${c.name} is ready: a level ${c.level} ${c.race} ${c.classes}.`); }
}
async function qcManual() {
  closeModal();
  const nid = "c" + Date.now().toString(36), ch = blankCharacter("New character");
  if (await safeWrite(() => S.db.doc("characters/" + nid).set(ch))) { S.chars.set(nid, ch); CS.edit = true; CS.tab = "play"; location.hash = "char-" + nid; }
}

// Class resources with limited uses, by level (2014 rules). Spell slots aren't here: the sheet's spellcasting handles those.
function qcResources(cls, lvl, sub, mod) {
  const r = [], add = (name, max, reset) => { if (max > 0) r.push({ name, max, used: 0, reset }); };
  const step = (table) => { let v = 0; for (const [l, n] of table) if (lvl >= l) v = n; return v; };
  if (cls === "Barbarian") add("Rage", lvl >= 20 ? 99 : step([[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]), "long");
  if (cls === "Bard") add("Bardic Inspiration", Math.max(1, mod("cha")), lvl >= 5 ? "short" : "long");
  if (cls === "Cleric") add("Channel Divinity", step([[2, 1], [6, 2], [18, 3]]), "short");
  if (cls === "Druid") add("Wild Shape", lvl >= 2 ? 2 : 0, "short");
  if (cls === "Fighter") {
    add("Second Wind", 1, "short"); add("Action Surge", step([[2, 1], [17, 2]]), "short"); add("Indomitable", step([[9, 1], [13, 2], [17, 3]]), "long");
    if (/battle master/i.test(sub)) add("Superiority Dice", step([[3, 4], [7, 5], [15, 6]]), "short");
  }
  if (cls === "Monk") add("Ki", lvl >= 2 ? lvl : 0, "short");
  if (cls === "Paladin") { add("Divine Sense", 1 + Math.max(0, mod("cha")), "long"); add("Lay on Hands (hit points)", 5 * lvl, "long"); add("Channel Divinity", lvl >= 3 ? 1 : 0, "short"); }
  if (cls === "Sorcerer") add("Sorcery Points", lvl >= 2 ? lvl : 0, "long");
  if (cls === "Wizard") add("Arcane Recovery", 1, "long");
  if (cls === "Artificer") add("Flash of Genius", lvl >= 7 ? Math.max(1, mod("int")) : 0, "long");
  return r;
}
