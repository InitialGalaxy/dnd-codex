// ---------- Classes on the sheet: picked from the library, any number of them (multiclassing) ----------
// c.classList = [{ name, level, subclass, subclassRef, rolls: { "<class level>": hp roll } }]. The first is the class the
// character started in; its subclass stays in c.subclass / c.subclassRef as before. c.classes ("Fighter", or
// "Fighter 5 / Wizard 3" when there's more than one) and c.level (the total) are kept in step, so everything that reads
// them (proficiency bonus, the tabletop, quick characters) carries on working.
// Hit points: with c.hpAuto on, max HP comes from the classes' hit dice: the first level of the first class is the die's
// maximum, every other level the roll written for it, or the average (half the die + 1) if none is; plus the Con modifier
// each level (at least 1 a level) and c.hpBonus a level (Tough, a hill dwarf). Current HP moves with the max.
function charClasses(c) {
  if (Array.isArray(c.classList) && c.classList.length) return c.classList;
  const t = String(c.classes || "").trim(); if (!t) return [];
  const names = allClassNames().slice().sort((a, b) => b.length - a.length), out = [];
  for (const p of t.split(/\s*[\/,&+]\s*|\s+and\s+/i).filter(Boolean)) { const nm = names.find(k => p.toLowerCase().includes(k.toLowerCase())), m = p.match(/\d+/); if (nm) out.push({ name: nm, level: m ? Number(m[0]) : 0 }); }
  if (!out.length) return [{ name: t.replace(/\s*\d+.*$/, "").trim() || t, level: Math.max(1, Number(c.level) || 1) }];
  if (out.length === 1) out[0].level = Math.max(1, Number(c.level) || out[0].level || 1); else out.forEach(x => { if (!x.level) x.level = 1; });
  return out;
}
const charMulti = c => charClasses(c).length > 1;
// How many levels the character has in a class (0 if none).
function classLevelOf(c, name) { const k = String(name).toLowerCase(); return charClasses(c).filter(x => String(x.name).toLowerCase() === k).reduce((a, x) => a + (Number(x.level) || 0), 0); }
function hpDie(name) { const d = classFeats(name); return d ? Number((d.basics && d.basics.hd) || d.hd) || 8 : 8; }
const hpAvg = die => Math.floor(die / 2) + 1;
function hpAutoMax(c) {
  const L = charClasses(c); if (!L.length) return 0;
  const con = cMod(c, "con"), bonus = Number(c.hpBonus) || 0; let t = 0;
  L.forEach((x, i) => { const die = hpDie(x.name), rolls = x.rolls || {};
    for (let lv = 1; lv <= (Number(x.level) || 1); lv++) { const r = i === 0 && lv === 1 ? die : Math.min(die, Math.max(1, Number(rolls[lv]) || hpAvg(die))); t += Math.max(1, r + con) + bonus; } });
  return t;
}
// Run on every change to a sheet (from charChange).
function charDerive(c) {
  if (Array.isArray(c.classList) && c.classList.length) {
    c.classList = c.classList.map(x => Object.assign({}, x, { level: Math.max(1, Math.min(20, Math.round(Number(x.level) || 1))) }));
    c.level = c.classList.reduce((a, x) => a + x.level, 0);
    c.classes = c.classList.length === 1 ? c.classList[0].name : c.classList.map(x => x.name + " " + x.level).join(" / ");
    const ce = classEntry(c.classList[0].name); if (ce) c.classRef = ce[0]; else delete c.classRef;
    if (c.hd && Number(c.hd.total) && Number(c.hd.total) !== c.level) c.hd = Object.assign({}, c.hd, { total: c.level, used: Math.min(Number(c.hd.used) || 0, c.level) });
  }
  if (c.hpAuto) { const m = hpAutoMax(c); if (m) { const h = c.hp = Object.assign({ max: 0, cur: 0, temp: 0 }, c.hp), was = Number(h.max) || 0;
    if (m !== was) { h.cur = Math.max(0, Math.min(m, (Number(h.cur) || 0) + (m - was))); h.max = m; } } }
}
// Multiclassing needs 13 in the class's main abilities (in the one you're leaving and the one you're joining).
function multiclassWarnings(c) {
  if (!charMulti(c)) return [];
  return charClasses(c).map(x => { const d = classFeats(x.name), pr = d && d.basics && Array.isArray(d.basics.primary) ? d.basics.primary : [];
    const either = /^fighter$/i.test(x.name), low = pr.filter(a => cScore(c, a) < 13); // (a fighter needs Strength or Dexterity)
    return low.length && (!either || low.length === pr.length) ? `${x.name} needs ${pr.filter(a => either || low.includes(a)).map(a => ABIL_LONG[a] + " 13").join(either ? " or " : " and ")}` : ""; }).filter(Boolean);
}
// The class rows on the sheet (Edit sheet).
function classPickHtml(c) {
  const L = charClasses(c), names = allClassNames(), rows = L.length ? L : [{ name: "", level: Math.max(1, Number(c.level) || 1) }];
  const opts = sel => `${sel && !names.includes(sel) ? `<option selected>${esc(sel)}</option>` : ""}${sel ? "" : `<option value="" selected>Choose a class…</option>`}${names.map(n => `<option${n === sel ? " selected" : ""}>${esc(n)}</option>`).join("")}`;
  const warn = multiclassWarnings(c);
  return `<div class="clpick"><span class="flabel">Class${rows.length > 1 ? `es <small class="muted">level ${rows.reduce((a, x) => a + (Number(x.level) || 0), 0)} in all</small>` : ""}</span>
    ${rows.map((x, i) => `<div class="clrow"><select data-cl="${i}" data-k="name" aria-label="Class ${i + 1}">${opts(x.name)}</select><label class="cllv"><span>Level</span><input type="number" min="1" max="20" inputmode="numeric" data-cl="${i}" data-k="level" value="${Number(x.level) || 1}"></label>${rows.length > 1 ? `<button class="iconbtn" data-act="clrm" data-k="${i}" aria-label="Take away ${esc(x.name || "this class")}">✕</button>` : ""}</div>`).join("")}
    <button class="btn ghost small" data-act="cladd"${L.length ? "" : " disabled"}>+ Multiclass</button>
    ${warn.length ? `<p class="small clwarn">⚠ Multiclassing: ${esc(warn.join("; "))}.</p>` : ""}</div>`;
}
// Max HP by level (Edit sheet): automatic from the hit dice, or typed in.
function hpLevelsHtml(c) {
  const auto = !!c.hpAuto, L = charClasses(c), con = cMod(c, "con");
  const head = `<div class="hplv"><div class="frow tight"><label><span>Max HP</span><select class="cf" data-cf="hpAuto"><option value=""${auto ? "" : " selected"}>Typed in</option><option value="1"${auto ? " selected" : ""}>Goes up with level</option></select></label>
    ${auto ? `<label><span>Extra a level <small class="muted">Tough, hill dwarf</small></span>${cField("hpBonus", c.hpBonus, { num: 1, cls: "mini", ph: "0" })}</label>` : ""}</div>`;
  if (!auto) return head + `<p class="muted small">Pick "Goes up with level" to work it out from the class hit dice: the average each level, or the dice you rolled.</p></div>`;
  if (!L.length) return head + `<p class="muted small">Choose a class first.</p></div>`;
  const rows = L.map((x, i) => { const die = hpDie(x.name), rolls = x.rolls || {};
    return `<div class="hplvc"><span class="hplvn">${esc(x.name)} <small class="muted">d${die}</small></span><div class="hplvr">${Array.from({ length: Number(x.level) || 1 }, (_, k) => { const lv = k + 1;
      if (i === 0 && lv === 1) return `<label title="The first level is the die's maximum"><span>${lv}</span><input type="number" value="${die}" disabled></label>`;
      return `<label><span>${lv}</span><input type="number" min="1" max="${die}" inputmode="numeric" data-hproll="${i}" data-lv="${lv}" value="${rolls[lv] != null ? esc(rolls[lv]) : ""}" placeholder="${hpAvg(die)}" aria-label="${esc(x.name)} level ${lv} roll"></label>`; }).join("")}</div></div>`; }).join("");
  return head + rows + `<p class="muted small">Leave a level blank for the average. ${con ? `Your Con modifier (${signed(con)}) is added each level` : "Your Con modifier is added each level"}; the total is ${hpAutoMax(c)}.</p></div>`;
}
// Changes from the class rows and the HP rolls.
function classListInput(t) {
  const sh = t.closest(".sheet"); if (!sh) return false; const id = sh.dataset.id;
  if (t.dataset.cl != null) { const i = Number(t.dataset.cl), k = t.dataset.k, v = t.value; if (k === "name" && !v) return true;
    charChange(id, x => { const L = charClasses(x).map(q => Object.assign({}, q)); if (!L[i]) L[i] = { name: "", level: Math.max(1, Number(x.level) || 1) };
      if (k === "name") { if (L[i].name !== v) { L[i].name = v; L[i].rolls = {}; if (i === 0) { delete x.subclass; delete x.subclassRef; } else { delete L[i].subclass; delete L[i].subclassRef; } } }
      else L[i].level = Math.max(1, Math.min(20, Number(v) || 1));
      x.classList = L.filter(q => q.name); }, false); setTimeout(render, 0);
    return true; }
  if (t.dataset.hproll != null) { const i = Number(t.dataset.hproll), lv = t.dataset.lv, v = t.value.trim();
    charChange(id, x => { const L = charClasses(x).map(q => Object.assign({}, q)); if (!L[i]) return; const r = Object.assign({}, L[i].rolls);
      if (v === "") delete r[lv]; else r[lv] = Math.max(1, Math.min(hpDie(L[i].name), Number(v) || 1)); L[i].rolls = r; x.classList = L; }, false); setTimeout(render, 0);
    return true; }
  return false;
}
function classListAction(a, el, id) {
  if (a === "cladd") { charChange(id, x => { const L = charClasses(x).map(q => Object.assign({}, q)), have = new Set(L.map(q => q.name)), nm = allClassNames().find(n => !have.has(n)) || "Fighter";
    L.push({ name: nm, level: 1 }); x.classList = L; }); return true; }
  if (a === "clrm") { const i = Number(el.dataset.k); charChange(id, x => { const L = charClasses(x).map(q => Object.assign({}, q)); if (L.length < 2) return;
    if (i === 0) { x.subclass = L[1].subclass || ""; if (L[1].subclassRef) x.subclassRef = L[1].subclassRef; else delete x.subclassRef; delete L[1].subclass; delete L[1].subclassRef; }
    L.splice(i, 1); x.classList = L; }); return true; }
  return false;
}
// A class's subclass entry from the library (by link, or by name).
function subEntryOf(cls, sub, ref) {
  if (ref && S.entries.has(ref)) return [ref, S.entries.get(ref)];
  const n = String(sub || "").trim().toLowerCase(); if (!n) return null; const is = e => String(e.title).trim().toLowerCase() === n || String((e.subclass || {}).alias || "").toLowerCase() === n;
  return homebrewSubclasses(cls).find(([, e]) => is(e)) || null;
}
// Spellcasting across classes (the multiclass spellcaster rule): two or more classes that cast add up their caster
// levels (all of a full caster's, half a half caster's, a third of a third caster's; pact magic stays apart) and use the
// full caster table. One casting class among others uses that class's own level.
function multiCaster(c, kind) {
  if (!(Array.isArray(c.classList) && c.classList.length > 1)) return null;
  const ks = c.classList.map(x => ({ x, kd: ((classFeats(x.name) || {}).basics || {}).caster || "" })), cast = ks.filter(q => q.kd && q.kd !== "pact");
  if (cast.length >= 2) { const cl = cast.reduce((a, q) => a + (q.kd === "full" ? q.x.level : q.kd === "half" ? Math.floor(q.x.level / 2) : q.kd === "halfup" ? Math.ceil(q.x.level / 2) : q.kd === "third" ? Math.floor(q.x.level / 3) : 0), 0);
    return { cl: Math.min(20, cl), maxLvl: maxSpellLevel("full", Math.min(20, cl)), kind: "full" }; }
  const one = cast[0] || ks.find(q => q.kd === "pact") || ks[0], lvl = one.x.level, k = kind || one.kd || "full";
  return { cl: Math.min(20, k === "half" ? Math.floor(lvl / 2) : k === "halfup" ? Math.ceil(lvl / 2) : k === "third" ? Math.floor(lvl / 3) : lvl), maxLvl: maxSpellLevel(k, lvl), kind: k };
}
// Class features for every class, each up to its own level (Fill from the source books).
function fillAllClassFeatures(c, withSub) {
  return charClasses(c).flatMap((x, i) => { const hb = i === 0 ? charSubclassEntry(c) : subEntryOf(x.name, x.subclass, x.subclassRef), d = classFeats(x.name);
    const srdSub = !hb && d && (i === 0 ? c.subclass : x.subclass) && (i === 0 ? c.subclass : x.subclass) === d.subs[0];
    const own = hb && withSub ? subclassFeatures(hb[1], x.level).map(f => ({ n: f.n, lv: Number(f.lv) || 1, d: f.d || "", sub: hb[1].title })) : [];
    return [...srdClassFeatures(x.name, x.level, withSub && srdSub), ...own].map(f => Object.assign({}, f, { cls: x.name })); });
}
