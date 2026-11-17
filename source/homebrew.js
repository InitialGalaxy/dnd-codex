// ---------- Homebrew subclasses and races (library entries that books embed and character sheets use) ----------
// Subclass entry: e.type "subclass", e.subclass = { cls, features: [{ n, lv, d }] }, e.body = description.
// Race entry:     e.type "race",     e.race = { size, speed, asi, traits: [{ n, d }] }, e.body = description.
const SRD_CLASS_NAMES = () => allClassNames();
function homebrewSubclasses(cls) {
  const k = String(cls || "").toLowerCase();
  return [...S.entries.entries()].filter(([, e]) => e.type === "subclass" && e.subclass && (!k || String(e.subclass.cls || "").toLowerCase() === k))
    .sort((a, b) => byName(a[1].title, b[1].title));
}
function homebrewRaces() { return [...S.entries.entries()].filter(([, e]) => e.type === "race" && !e.srd).sort((a, b) => byName(a[1].title, b[1].title)); }
function subclassFeatures(e, level) {
  return ((e.subclass || {}).features || []).filter(f => (f.n || "").trim() && (level == null || (Number(f.lv) || 1) <= level)).slice().sort((a, b) => (Number(a.lv) || 1) - (Number(b.lv) || 1));
}
function raceTraits(e) {
  const r = e.race || {}, out = [];
  if ((r.asi || "").trim()) out.push({ n: "Ability Score Increase", d: r.asi.trim() });
  if ((r.size || "").trim()) out.push({ n: "Size", d: "Your size is " + r.size.trim() + "." });
  if ((r.speed || "").trim()) out.push({ n: "Speed", d: "Your base walking speed is " + r.speed.trim().replace(/\.$/, "") + "." });
  return out.concat((r.traits || []).filter(t => (t.n || "").trim()));
}
const lvOrd = n => { n = Number(n) || 1; const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

function subclassHtml(id, e, noTitle) {
  const sc = e.subclass || {}, feats = subclassFeatures(e);
  return `<div class="hbblock subclass">
    <p class="hbkind">${esc(sc.cls || "Class")} subclass</p>
    ${noTitle ? "" : `<h2 class="hbtitle">${esc(e.title)}</h2>`}
    ${e.body && e.body.trim() ? `<div class="prose hbdesc">${md(e.body, { entryId: id, noEmbed: true })}</div>` : ""}
    ${feats.length ? `<table class="hbtable"><thead><tr><th>${esc(sc.cls || "Class")} level</th><th>Feature</th></tr></thead><tbody>${feats.map(f => `<tr><td>${lvOrd(f.lv)}</td><td>${esc(f.n)}</td></tr>`).join("")}</tbody></table>
      ${feats.map(f => `<div class="hbfeat"><h4>${esc(f.n)} <span class="lvchip">${lvOrd(f.lv)} level</span></h4><div class="prose">${md(f.d || "", { entryId: id, noEmbed: true }) || `<p class="muted">No description yet.</p>`}</div></div>`).join("")}`
      : `<p class="muted">No features yet.</p>`}
  </div>`;
}
function raceHtml(id, e, noTitle) {
  const tr = raceTraits(e);
  return `<div class="hbblock race">
    <p class="hbkind">Race${e.srd ? ` <span class="srcpill">${esc(e.srd)}</span>` : ""}</p>
    ${noTitle ? "" : `<h2 class="hbtitle">${esc(e.title)}</h2>`}
    ${e.image ? `<div class="hbimg">${imageHtml(e.image, e.title, id)}</div>` : ""}
    ${e.body && e.body.trim() ? `<div class="prose hbdesc">${md(e.body, { entryId: id, noEmbed: true })}</div>` : ""}
    ${tr.length ? `<h3 class="hbsub">${esc(e.title)} traits</h3>${tr.map(t => `<div class="prose hbtrait">${md(`***${t.n.replace(/\.$/, "")}.*** ${t.d || ""}`, { entryId: id, noEmbed: true })}</div>`).join("")}` : `<p class="muted">No traits yet.</p>`}
  </div>`;
}

// ----- Editor fields (inside the entry editor) -----
function hbRow(kind, f) {
  f = f || {};
  return `<div class="hbrow" data-hbrow="${kind}">
    <div class="frow tight">${kind !== "rc" ? `<label class="lvin"><span>Level</span><input type="number" min="1" max="20" class="hb-lv" value="${esc(f.lv || "")}"></label>` : ""}
      <label class="grow"><span>${kind !== "rc" ? "Feature" : "Trait"}</span><input type="text" class="hb-n" value="${esc(f.n || "")}" placeholder="${kind === "sc" ? "e.g. Dragon Binding" : kind === "cl" ? "e.g. Extra Attack" : "e.g. Darkvision"}"></label>
      <button type="button" class="btn ghost small hbdel" data-act="hbdel" title="Remove">✕</button></div>
    <div class="field"><textarea class="hb-d" rows="3" placeholder="What it does">${esc(f.d || "")}</textarea></div>
  </div>`;
}
function subclassFields(e) {
  const sc = e.subclass || {}, names = SRD_CLASS_NAMES(), cls = sc.cls || "";
  const feats = (sc.features || []).length ? sc.features : [{ lv: (classFeats(cls) || {}).subLv || 3 }];
  return `<div class="frow"><label><span>For the class</span><select id="sc-cls">${names.map(n => `<option${n === cls ? " selected" : ""}>${n}</option>`).join("")}${cls && !names.includes(cls) ? `<option selected>${esc(cls)}</option>` : ""}</select></label>
      <p class="muted small grow">Players of this class can pick it in their level-up choices, and the sheet's fill button adds its features as they reach each level.</p></div>
    <div id="sc-rows" class="hbrows">${feats.map(f => hbRow("sc", f)).join("")}</div>
    <button type="button" class="btn ghost small" data-act="hbadd" data-v="sc">+ Add a feature</button>`;
}
function raceFields(e) {
  const r = e.race || {};
  return `<div class="frow"><label><span>Size</span><select id="rc-size">${["Small", "Medium", "Large"].map(s => `<option${s === (r.size || "Medium") ? " selected" : ""}>${s}</option>`).join("")}</select></label>
      <label><span>Speed</span><input id="rc-speed" type="text" value="${esc(r.speed || "")}" placeholder="30 feet"></label>
      <label class="grow"><span>Ability Score Increase</span><input id="rc-asi" type="text" value="${esc(r.asi || "")}" placeholder="Your Strength score increases by 2."></label></div>
    <div id="rc-rows" class="hbrows">${((r.traits || []).length ? r.traits : [{}]).map(t => hbRow("rc", t)).join("")}</div>
    <button type="button" class="btn ghost small" data-act="hbadd" data-v="rc">+ Add a trait</button>`;
}
function hbAddRow(kind) {
  const box = $("#" + kind + "-rows"); if (!box) return;
  const last = box.querySelector(".hbrow:last-child .hb-lv");
  box.insertAdjacentHTML("beforeend", hbRow(kind, { lv: last ? last.value : "" }));
  const row = box.lastElementChild;
  richify(row.querySelector("textarea"), { tools: "small", base: 3 });
  const n = row.querySelector(".hb-n"); if (n) n.focus();
}
function readHbRows(kind) {
  return [...document.querySelectorAll(`#${kind}-rows .hbrow`)].map(r => {
    const o = { n: r.querySelector(".hb-n").value.trim(), d: r.querySelector("textarea.hb-d").value.trim() };
    if (kind !== "rc") o.lv = Math.max(1, Math.min(20, Number(r.querySelector(".hb-lv").value) || 1));
    return o;
  }).filter(o => o.n || o.d);
}
function readSubclassFields() { return { cls: $("#sc-cls").value, features: readHbRows("sc").sort((a, b) => a.lv - b.lv) }; }
function readRaceFields() { return { size: $("#rc-size").value, speed: $("#rc-speed").value.trim(), asi: $("#rc-asi").value.trim(), traits: readHbRows("rc") }; }

// ----- Artificer: not part of the SRD, so its features are short summaries in our own words (full text: Tasha's Cauldron of Everything) -----
const ARTIFICER_FEATS = [
  { n: "Magical Tinkering", lv: 1, d: "With thieves' or artisan's tools, give a Tiny nonmagical object one small magical property: it sheds dim light, plays a short recorded message, gives off a smell or sound, or shows a still image. You can keep a number of these going equal to your Intelligence modifier." },
  { n: "Infuse Item", lv: 2, d: "You learn artificer infusions and can put them into nonmagical objects at the end of a long rest, turning them into magic items. The number of infusions you know and can keep active at once grows as you level." },
  { n: "The Right Tool for the Job", lv: 3, d: "Spend an hour with thieves' tools or artisan's tools to make one set of artisan's tools of your choice. It lasts until you use this feature again." },
  { n: "Tool Expertise", lv: 6, d: "Your proficiency bonus is doubled for any ability check that uses a tool you're proficient with." },
  { n: "Flash of Genius", lv: 7, d: "When you or a creature you can see within 30 feet makes an ability check or saving throw, use your reaction to add your Intelligence modifier to it. Uses equal to your Intelligence modifier per long rest." },
  { n: "Magic Item Adept", lv: 10, d: "You can attune to up to four magic items. Crafting a common or uncommon magic item takes you a quarter of the usual time and half the usual gold." },
  { n: "Spell-Storing Item", lv: 11, d: "After a long rest, store a 1st- or 2nd-level artificer spell with a casting time of 1 action in a weapon or spellcasting focus. Anyone holding it can cast the stored spell with your spellcasting modifier, a number of times equal to twice your Intelligence modifier." },
  { n: "Magic Item Savant", lv: 14, d: "You can attune to up to five magic items, and you ignore class, race, spell and level requirements for using or attuning to them." },
  { n: "Magic Item Master", lv: 18, d: "You can attune to up to six magic items." },
  { n: "Soul of Artifice", lv: 20, d: "You gain +1 to all saving throws for each magic item you're attuned to. When you drop to 0 hit points without dying, you can end one of your infusions to drop to 1 hit point instead." }
];
if (typeof SRD_CLASS_FEATS !== "undefined" && !SRD_CLASS_FEATS.Artificer)
  SRD_CLASS_FEATS.Artificer = { hd: 8, subs: [], flavor: "Artificer Specialist", subLv: 3, asi: [4, 8, 12, 16, 19], f: ARTIFICER_FEATS, nonSrd: true };
