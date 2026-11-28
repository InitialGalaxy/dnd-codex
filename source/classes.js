// ---------- Classes as library entries ----------
// e.type "class", e.cls = { hd, primary: [abil], saves: [abil], armour, weapons, tools, skillsN, skills: [skill ids],
//   caster: ""|full|half|halfup|third|pact, castAbil, subTitle, subLv, asi: [levels], features: [{ n, lv, d }] }
// A class entry wins over the built-in SRD data with the same name, so editing "Ranger" in the library changes every Ranger sheet.
const ARTIFICER_BASICS = { hd: 8, saves: ["con", "int"], armour: "Light armour, Medium armour, Shields", weapons: "Simple weapons", tools: "Thieves' tools, Tinker's tools, one type of artisan's tools", skillsN: 2, skills: ["arcana", "history", "investigation", "medicine", "nature", "perception", "sleight-of-hand"], caster: "halfup", castAbil: "int", primary: ["int"] };
const ABIL_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
const ABIL_LONG = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
function classEntry(name) {
  const k = String(name || "").trim().toLowerCase(); if (!k) return null;
  for (const [id, e] of S.entries) if (e.type === "class" && String(e.title || "").trim().toLowerCase() === k) return [id, e];
  return null;
}
function allClassNames() {
  const s = new Map(Object.keys(SRD_CLASS_FEATS).map(k => [k.toLowerCase(), k]));
  for (const [, e] of S.entries) if (e.type === "class" && e.title && !s.has(e.title.trim().toLowerCase())) s.set(e.title.trim().toLowerCase(), e.title.trim());
  return [...s.values()].sort(byName);
}
const srdBasics = name => SRD_CLASS_BASICS[name] || (name === "Artificer" ? ARTIFICER_BASICS : null);
// { id?, hd, subs, flavor, subLv, asi, f, basics } for a class name: library entry first, built-in data second.
function classFeats(name) {
  if (!name) return null;
  const key = Object.keys(SRD_CLASS_FEATS).find(k => k.toLowerCase() === String(name).trim().toLowerCase());
  const srd = key ? SRD_CLASS_FEATS[key] : null, ce = classEntry(name);
  if (!ce) return srd ? Object.assign({}, srd, { basics: srdBasics(key) }) : null;
  const c = ce[1].cls || {};
  return { id: ce[0], hd: Number(c.hd) || 8, subs: srd ? srd.subs : [], flavor: c.subTitle || (srd || {}).flavor || "Subclass", subLv: Number(c.subLv) || (srd || {}).subLv || 3,
    asi: (Array.isArray(c.asi) && c.asi.length ? c.asi : (srd || {}).asi || [4, 8, 12, 16, 19]).map(Number),
    f: [...(c.features || []).filter(f => (f.n || "").trim()).map(f => Object.assign({ n: f.n, lv: Number(f.lv) || 1, d: f.d || "" }, Array.isArray(f.opts) && f.opts.length ? { opts: f.opts, pick: Number(f.pick) || 1 } : {})), ...(srd ? srd.f.filter(f => f.sub) : [])], basics: c };
}
// A class entry built from the SRD (or the Artificer summary), for the one-time move into the library.
function srdClassDoc(name, now) {
  const d = SRD_CLASS_FEATS[name], b = srdBasics(name) || {};
  return { title: name, type: "class", tags: [], body: "", source: d.nonSrd ? "Tasha's Cauldron of Everything (summary)" : "SRD 5.1 (2014)", created: now, updated: now,
    cls: { hd: b.hd || d.hd, primary: b.primary || [], saves: b.saves || [], armour: b.armour || "", weapons: b.weapons || "", tools: b.tools || "", skillsN: b.skillsN || 2, skills: b.skills || [],
      caster: b.caster || "", castAbil: b.castAbil || "", subTitle: d.flavor, subLv: d.subLv, asi: d.asi,
      features: d.f.filter(f => !f.sub && !/^Ability Score Improvement/.test(f.n)).map(f => ({ n: f.n, lv: f.lv, d: f.d || "" })) } };
}

const casterLabel = k => ({ full: "Full caster", half: "Half caster (half your level, rounded down)", halfup: "Half caster (half your level, rounded up)", third: "Third caster", pact: "Pact magic (spells up to 5th level)" })[k] || "";
function classHtml(id, e, noTitle) {
  const c = e.cls || {}, lvOrd2 = n => lvOrd(n);
  const feats = (c.features || []).filter(f => (f.n || "").trim()).slice().sort((a, b) => (Number(a.lv) || 1) - (Number(b.lv) || 1));
  const asi = (c.asi || []).map(Number), subLv = Number(c.subLv) || 3, subT = c.subTitle || "Subclass";
  const rows = [];
  for (let L = 1; L <= 20; L++) {
    const names = feats.filter(f => (Number(f.lv) || 1) === L).map(f => f.n);
    if (L === subLv && !names.some(n => n.toLowerCase() === subT.toLowerCase())) names.unshift(subT);
    if (asi.includes(L)) names.push("Ability Score Improvement");
    rows.push(`<tr><td>${lvOrd2(L)}</td><td>+${Math.ceil(L / 4) + 1}</td><td>${names.map(esc).join(", ") || "—"}</td></tr>`);
  }
  const subs = homebrewSubclasses(e.title), srd = SRD_CLASS_FEATS[e.title];
  const skillNames = (c.skills || []).map(k => (SKILLS.find(s => s[0] === k) || [k, k])[1]);
  const line = (label, v) => v ? `<p><b>${label}:</b> ${esc(v)}</p>` : "";
  return `<div class="hbblock classblock">
    <p class="hbkind">Class</p>
    ${noTitle ? "" : `<h2 class="hbtitle">${esc(e.title)}</h2>`}
    ${e.body && e.body.trim() ? `<div class="prose hbdesc">${md(e.body, { entryId: id, noEmbed: true })}</div>` : ""}
    <div class="clsbasics">
      <div><h4>Hit points</h4>
        <p><b>Hit Dice:</b> 1d${esc(c.hd || 8)} per ${esc(e.title)} level</p>
        <p><b>At 1st level:</b> ${esc(c.hd || 8)} + your Constitution modifier</p>
        <p><b>Higher levels:</b> 1d${esc(c.hd || 8)} (or ${Math.floor((Number(c.hd) || 8) / 2) + 1}) + your Constitution modifier per level</p></div>
      <div><h4>Proficiencies</h4>
        ${line("Armour", c.armour || "None")}${line("Weapons", c.weapons || "None")}${line("Tools", c.tools || "None")}
        ${line("Saving throws", (c.saves || []).map(a => ABIL_LONG[a]).join(", "))}
        ${skillNames.length ? `<p><b>Skills:</b> choose ${esc(c.skillsN || 2)} from ${esc(skillNames.join(", "))}</p>` : ""}</div>
      ${c.caster ? `<div><h4>Spellcasting</h4><p>${esc(casterLabel(c.caster))}${c.castAbil ? `, using ${esc(ABIL_LONG[c.castAbil] || c.castAbil)}` : ""}. Spell points follow the Codex of Energies.</p></div>` : ""}
      ${(c.primary || []).length ? `<div><h4>Primary ability</h4><p>${esc(c.primary.map(a => ABIL_LONG[a]).join(" or "))}</p></div>` : ""}
    </div>
    <h3 class="hbsub">The ${esc(e.title)}</h3>
    <div class="tablewrap doc"><table class="hbtable cltable"><thead><tr><th>Level</th><th>Proficiency bonus</th><th>Features</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    <h3 class="hbsub">Class features</h3>
    ${feats.length ? feats.map(f => `<div class="hbfeat"><h4>${esc(f.n)} <span class="lvchip">${lvOrd2(f.lv)} level</span></h4><div class="prose">${md(f.d || "", { entryId: id, noEmbed: true }) || (f.opts && f.opts.length ? "" : `<p class="muted">No description yet.</p>`)}</div>${hbOptsHtml(f, id)}</div>`).join("") : `<p class="muted">No features yet.</p>`}
    <h3 class="hbsub">${esc(subT)}s</h3>
    <p>${[...(srd ? srd.subs.filter(s => !subs.some(([, se]) => (se.subclass || {}).alias === s || se.title === s)).map(s => `<span class="flink">${esc(s)} <span class="srcpill">SRD</span></span>`) : []), ...subs.map(([sid, se]) => `<a class="flink" href="#entry-${esc(sid)}">${esc(se.title)}</a>`)].join(" ") || `<span class="muted">None yet. Add one with + Subclass in a book, or + New entry.</span>`}</p>
  </div>`;
}

// ----- Editor fields -----
const listOpts = a => a.map(x => [x, x]);
const splitList = s => String(s || "").split(/,\s*(?![^(]*\))/).map(x => x.trim()).filter(x => x && !/^none$/i.test(x));
function classProfOptions(kind) {
  const eq = typeof SRD_EQUIP !== "undefined" ? SRD_EQUIP : [];
  if (kind === "armour") return listOpts(["Light armour", "Medium armour", "Heavy armour", "All armour", "Shields", ...eq.filter(x => x.group === "armour").map(x => x.title)]);
  if (kind === "weapons") return listOpts(["Simple weapons", "Martial weapons", ...eq.filter(x => x.group === "weapon").map(x => x.title)]);
  return listOpts(["Thieves' tools", "Tinker's tools", "One type of artisan's tools", "One musical instrument", "Herbalism kit", "Navigator's tools", "Disguise kit", "Forgery kit", "Poisoner's kit",
    ...eq.filter(x => /Artisan's Tools|Gaming Sets|Musical Instrument|Other Tools|Kits/.test(x.sub)).map(x => x.title)].filter((v, k, a) => a.indexOf(v) === k));
}
function classFields(e) {
  const c = e.cls || {};
  const abil = ABIL_KEYS.map(k => [k, ABIL_LONG[k]]), skills = SKILLS.map(([k, l]) => [k, l]);
  const fld = (label, html) => `<div class="field"><span class="flabel">${label}</span>${html}</div>`;
  return `<div class="clsgrid">
    <div class="frow"><label><span>Hit die</span><select id="cl-hd">${[6, 8, 10, 12].map(n => `<option value="${n}"${Number(c.hd || 8) === n ? " selected" : ""}>d${n}</option>`).join("")}</select></label>
      <div class="grow">${fld("Primary ability", tagPickHtml("cl-prim", abil, c.primary, { ph: "Add an ability…" }))}</div></div>
    ${fld("Saving throw proficiencies", tagPickHtml("cl-save", abil, c.saves, { ph: "Add a saving throw…" }))}
    <div class="frow"><div class="grow">${fld("Armour", tagPickHtml("cl-armour", classProfOptions("armour"), splitList(c.armour), { free: true, ph: "Search armour…" }))}</div>
      <div class="grow">${fld("Weapons", tagPickHtml("cl-weapons", classProfOptions("weapons"), splitList(c.weapons), { free: true, ph: "Search weapons…" }))}</div></div>
    ${fld("Tools", tagPickHtml("cl-tools", classProfOptions("tools"), splitList(c.tools), { free: true, ph: "Search tools…" }))}
    ${fld(`Skills: players choose <input id="cl-skn" type="number" min="0" max="6" value="${esc(c.skillsN != null ? c.skillsN : 2)}" class="mini" aria-label="Number of skills"> from`, tagPickHtml("cl-skill", skills, c.skills, { ph: "Add a skill…" }))}
    <div class="frow"><label><span>Spellcasting</span><select id="cl-caster"><option value="">Not a spellcaster</option>${CASTER_KINDS.map(([v, l]) => `<option value="${v}"${c.caster === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label><span>Spellcasting ability</span><select id="cl-castab"><option value="">—</option>${ABIL_KEYS.map(k => `<option value="${k}"${c.castAbil === k ? " selected" : ""}>${ABIL_LONG[k]}</option>`).join("")}</select></label></div>
    <div class="frow"><label class="grow"><span>Subclass is called</span><input id="cl-subt" type="text" value="${esc(c.subTitle || "")}" placeholder="e.g. Ranger Archetype"></label>
      <label><span>Chosen at level</span><input id="cl-sublv" type="number" min="1" max="20" value="${esc(c.subLv || 3)}" class="mini"></label>
      <label class="grow"><span>Ability Score Improvements at levels</span><input id="cl-asi" type="text" value="${esc((c.asi || [4, 8, 12, 16, 19]).join(", "))}"></label></div>
    <span class="flabel">Class features</span>
    <div id="cl-rows" class="hbrows">${((c.features || []).length ? c.features : [{ lv: 1 }]).map(f => hbRow("cl", f)).join("")}</div>
    <button type="button" class="btn ghost small" data-act="hbadd" data-v="cl">+ Add a feature</button>
  </div>`;
}
function readClassFields() {
  return { hd: Number($("#cl-hd").value) || 8, primary: tagPickRead("cl-prim"), saves: tagPickRead("cl-save"), armour: tagPickRead("cl-armour").join(", "), weapons: tagPickRead("cl-weapons").join(", "), tools: tagPickRead("cl-tools").join(", "),
    skillsN: Math.max(0, Number($("#cl-skn").value) || 0), skills: tagPickRead("cl-skill"), caster: $("#cl-caster").value, castAbil: $("#cl-castab").value,
    subTitle: $("#cl-subt").value.trim(), subLv: Math.max(1, Math.min(20, Number($("#cl-sublv").value) || 3)),
    asi: $("#cl-asi").value.split(/[^0-9]+/).map(Number).filter(n => n >= 1 && n <= 20),
    features: readHbRows("cl").sort((a, b) => a.lv - b.lv) };
}

// ----- On the character sheet: apply a class's basics -----
function classBasicsPlan(c, cls) {
  const d = classFeats(cls); if (!d || !d.basics) return null;
  const b = d.basics, lvl = Math.max(1, Number(c.level) || 1), out = [];
  const die = "1d" + (b.hd || d.hd);
  if ((c.hd || {}).die !== die || Number((c.hd || {}).total) !== lvl) out.push(["hd", `Hit dice ${lvl}d${b.hd || d.hd}`]);
  const newSaves = (b.saves || []).filter(a => !(c.saves || {})[a]);
  if (newSaves.length) out.push(["saves", `${newSaves.map(a => ABIL_LONG[a]).join(" and ")} saving throw${newSaves.length > 1 ? "s" : ""}`]);
  for (const [k, label] of [["armour", "armour"], ["weapons", "weapons"], ["tools", "tools"]]) {
    const opts = profOptions(k), have = profList(c, k), add = profParse(k, b[k], opts).filter(v => !have.includes(v));
    if (add.length) out.push([k, `${label}: ${add.map(v => profLabel(k, v, opts)).join(", ")}`, [...have, ...add]]);
  }
  const k = c.caster || {};
  if (b.caster && (!k.on || k.kind !== b.caster || (b.castAbil && k.ability !== b.castAbil))) out.push(["caster", `spellcasting (${casterLabel(b.caster).toLowerCase()}${b.castAbil ? ", " + ABIL_LONG[b.castAbil] : ""})`]);
  return { d, b, out };
}
function classBasicsHtml(c) {
  const cls = CS.fill && CS.fill.cls != null ? CS.fill.cls : detectSrdClass(c); if (!cls) return "";
  const plan = classBasicsPlan(c, cls); if (!plan) return "";
  const { b, out, d } = plan;
  const skills = (b.skills || []).map(k => (SKILLS.find(s => s[0] === k) || [k, k])[1]);
  const picked = (b.skills || []).filter(k => Number((c.skills || {})[k]) > 0).length;
  return `<div class="clsapply"><span class="flabel">${esc(cls)} basics ${d.id ? `<a class="small" href="#entry-${esc(d.id)}">open the class →</a>` : ""}</span>
    ${out.length ? `<p class="small">Adds ${out.map(o => esc(o[1])).join(" · ")}.</p><button class="btn small" data-act="clsapply" data-v="${esc(cls)}">Apply ${esc(cls)} basics</button>` : `<p class="muted small">Hit dice, saving throws, proficiencies and spellcasting already match the class.</p>`}
    ${skills.length ? `<p class="muted small">Skills: choose ${esc(b.skillsN || 2)} from ${esc(skills.join(", "))} on the Stats tab (${picked} picked).</p>` : ""}</div>`;
}
function classBasicsApply(id, c, cls) {
  const plan = classBasicsPlan(c, cls); if (!plan) return;
  const { b, d, out } = plan, lvl = Math.max(1, Number(c.level) || 1);
  charChange(id, x => {
    for (const o of out) {
      if (o[0] === "hd") x.hd = Object.assign({ used: 0 }, x.hd, { die: "1d" + (b.hd || d.hd), total: lvl });
      else if (o[0] === "saves") { x.saves = Object.assign({}, x.saves); (b.saves || []).forEach(a => { x.saves[a] = true; }); }
      else if (o[0] === "caster") x.caster = Object.assign({ used: 0, high: {} }, x.caster, { on: true, kind: b.caster, ability: b.castAbil || (x.caster || {}).ability || "int" });
      else { x.profs = Object.assign({}, x.profs); x.profs[o[0]] = o[2]; }
    }
    if (d.id) x.classRef = d.id;
  });
  toast(`Applied ${cls} basics`);
}
