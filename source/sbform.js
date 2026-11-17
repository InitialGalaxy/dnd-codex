// ---------- Creature stat block form: size/type/alignment, hit dice, speeds ----------
// The stat block still stores plain text (subtitle, hp, speed) so everything that reads it keeps working;
// this form builds that text from dropdowns and numbers, and reads old text back into them.
const SB_SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const SB_DIE = { Tiny: 4, Small: 6, Medium: 8, Large: 10, Huge: 12, Gargantuan: 20 };
const SB_ALIGN = ["unaligned", "lawful good", "neutral good", "chaotic good", "lawful neutral", "neutral", "chaotic neutral", "lawful evil", "neutral evil", "chaotic evil", "any alignment"];
const SB_SPEEDS = [["walk", "Walking"], ["fly", "Flying"], ["swim", "Swimming"], ["climb", "Climbing"], ["burrow", "Burrowing"], ["other", "Other (type it)"]];
const sbCap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "";
const sbConMod = con => { const n = parseInt(con, 10); return isFinite(n) ? Math.floor((n - 10) / 2) : 0; };

// ----- Size, type, alignment -----
function sbParseSub(s) {
  s = String(s || "").trim();
  const m = s.match(/^(tiny|small|medium|large|huge|gargantuan)\b\s*(.*)$/i);
  let size = m ? sbCap(m[1]) : "", rest = m ? m[2] : s, align = "";
  // The alignment is the last comma part outside brackets, when it reads like one.
  let depth = 0, cut = -1;
  for (let i = 0; i < rest.length; i++) { const ch = rest[i]; if (ch === "(") depth++; else if (ch === ")") depth--; else if (ch === "," && !depth) cut = i; }
  if (cut >= 0) { const tail = rest.slice(cut + 1).trim(); if (/aligned|alignment|lawful|chaotic|neutral|good|evil|\bany\b/i.test(tail)) { align = tail; rest = rest.slice(0, cut).trim(); } }
  return { size, type: rest.trim(), align };
}
function sbBuildSub(size, type, align) { return [[size, type].filter(Boolean).join(" "), align].filter(Boolean).join(", "); }

// ----- Hit points -----
function sbParseHp(s) { const m = String(s || "").match(/^\s*\d+\s*\(\s*(\d+)\s*d\s*(\d+)/i); return m ? { n: Number(m[1]), die: Number(m[2]) } : null; }
function sbHpText(n, die, con) {
  const cm = sbConMod(con), bonus = n * cm, avg = Math.max(1, Math.floor(n * (die + 1) / 2) + bonus);
  return `${avg} (${n}d${die}${bonus ? (bonus > 0 ? " + " : " − ") + Math.abs(bonus) : ""})`;
}

// ----- Speed -----
function sbParseSpeed(s) {
  s = String(s || "").trim(); if (!s) return [{ type: "walk", n: "" }];
  const rows = [];
  for (const seg of s.split(/\s*,\s*/)) {
    const m = seg.match(/^(?:(walk|fly|swim|climb|burrow)\s+)?(\d+)\s*(?:ft\.?|feet)\s*(\(hover\))?$/i);
    if (!m) return [{ type: "other", text: s }];
    rows.push({ type: (m[1] || "walk").toLowerCase(), n: m[2], hover: !!m[3] });
  }
  return rows;
}
function sbBuildSpeed(rows) {
  const ok = rows.filter(r => r.type === "other" ? String(r.text || "").trim() : String(r.n || "").trim());
  ok.sort((a, b) => (a.type === "walk" ? 0 : 1) - (b.type === "walk" ? 0 : 1));
  return ok.map(r => r.type === "other" ? r.text.trim() : r.type === "walk" ? `${r.n} ft.` : `${r.type} ${r.n} ft.${r.type === "fly" && r.hover ? " (hover)" : ""}`).join(", ");
}
function sbSpeedRowHtml(r) {
  r = r || { type: "walk", n: "" };
  return `<div class="sbsprow"><select class="sbsp-type" aria-label="Kind of movement">${SB_SPEEDS.map(([v, l]) => `<option value="${v}"${r.type === v ? " selected" : ""}>${l}</option>`).join("")}</select>
    <input class="sbsp-n" type="number" min="0" step="5" value="${esc(r.n || "")}" placeholder="30" aria-label="Feet"${r.type === "other" ? " hidden" : ""}><span class="muted small sbsp-ft"${r.type === "other" ? " hidden" : ""}>ft.</span>
    <input class="sbsp-text" type="text" value="${esc(r.text || "")}" placeholder="30 ft. (60 ft. while raging)" aria-label="Speed as text"${r.type === "other" ? "" : " hidden"}>
    <label class="check inline sbsp-hoverwrap"${r.type === "fly" ? "" : " hidden"}><input class="sbsp-hover" type="checkbox"${r.hover ? " checked" : ""}> hover</label>
    <button type="button" class="iconbtn" data-act="sbspdel" aria-label="Remove this speed">✕</button></div>`;
}
function sbReadSpeedRows() {
  return [...document.querySelectorAll("#sbm-speeds .sbsprow")].map(row => ({ type: row.querySelector(".sbsp-type").value, n: row.querySelector(".sbsp-n").value.trim(), text: row.querySelector(".sbsp-text").value, hover: row.querySelector(".sbsp-hover").checked }));
}

// ----- Worked out when left blank (on the stat block itself) -----
// Exhaust Meter: Large or bigger creatures get double their Con score, rising by their Con score.
function sbAutoExhaust(sb) {
  const con = parseInt((sb || {}).con, 10), sz = sizeFromSubtitle((sb || {}).subtitle);
  return ["Large", "Huge", "Gargantuan"].includes(sz) && isFinite(con) && con > 0 ? `${2 * con} (→ +${con})` : "";
}
// Proficiency bonus from CR, on the same steps a character's level uses: CR 0–4 +2, 5–8 +3, … 29–30 +9.
function sbAutoProf(sb) {
  const c = crNum((sb || {}).cr || ""); if (!(c >= 0)) return "";
  return "+" + (2 + Math.floor((Math.max(1, Math.ceil(c)) - 1) / 4));
}

// ----- The form pieces -----
function sbMetaHtml(sb) {
  const p = sbParseSub(sb.subtitle), known = SB_ALIGN.find(a => a === p.align.toLowerCase()), custom = p.align && !known;
  return `<div class="sbmeta">
    <div class="frow tight">
      <label><span>Size</span><select id="sbm-size"><option value="">—</option>${SB_SIZES.map(z => `<option${p.size === z ? " selected" : ""}>${z}</option>`).join("")}</select></label>
      <label class="grow"><span>Type <small class="muted">optional</small></span><input id="sbm-type" type="text" value="${esc(p.type)}" placeholder="dragon (Drake, Striker Class)"></label>
      <label><span>Alignment</span><select id="sbm-align"><option value="">—</option>${SB_ALIGN.map(a => `<option value="${a}"${known === a ? " selected" : ""}>${sbCap(a)}</option>`).join("")}<option value="__custom"${custom ? " selected" : ""}>Custom…</option></select></label>
      <label id="sbm-alignc-wrap"${custom ? "" : " hidden"}><span>Custom alignment</span><input id="sbm-alignc" type="text" value="${esc(custom ? p.align : "")}" placeholder="typically chaotic evil"></label>
    </div>
    <input type="hidden" id="sb-subtitle" value="${esc(sb.subtitle || "")}">
  </div>`;
}
function sbHpHtml(sb) {
  const h = sbParseHp(sb.hp), size = sizeFromSubtitle(sb.subtitle), auto = SB_DIE[size] || 8, manual = h && h.die !== auto ? h.die : "";
  return `<div class="sbhp"><span class="flabel">Hit Points</span>
    <div class="sbhpctl"><input id="sbm-hdn" type="number" min="1" max="999" value="${h ? h.n : ""}" placeholder="13" aria-label="Number of hit dice"><span class="muted">hit dice of</span>
      <select id="sbm-die" aria-label="Hit die"><option value="">${esc(size || "Medium")}: d${auto}</option>${[4, 6, 8, 10, 12, 20].map(d => `<option value="${d}"${manual === d ? " selected" : ""}>d${d} (custom)</option>`).join("")}</select></div>
    <div id="sbm-hpprev" class="sbprev small"></div>
    <input type="hidden" id="sb-hp" value="${esc(sb.hp || "")}"></div>`;
}
function sbSpeedHtml(sb) {
  return `<div class="sbspeed"><span class="flabel">Speed</span><div id="sbm-speeds">${sbParseSpeed(sb.speed).map(sbSpeedRowHtml).join("")}</div>
    <button type="button" class="btn ghost small" data-act="sbspadd">+ Add a speed</button>
    <input type="hidden" id="sb-speed" value="${esc(sb.speed || "")}"></div>`;
}
function sbPreviewHtml() { return `<div class="sbpreview" id="sbm-preview" aria-live="polite"></div>`; }

// Rebuild the stored text from the controls, and refresh the previews and the "auto" hints.
let SB_HP_TOUCHED = false;
function sbFormSync(initial) {
  if (!document.getElementById("sbm-size")) return;
  if (initial) SB_HP_TOUCHED = false;
  const g = id => document.getElementById(id);
  const size = g("sbm-size").value, alignSel = g("sbm-align").value;
  g("sbm-alignc-wrap").hidden = alignSel !== "__custom";
  const align = alignSel === "__custom" ? g("sbm-alignc").value.trim() : alignSel;
  const sub = sbBuildSub(size, g("sbm-type").value.trim(), align);
  const subEl = g("sb-subtitle"); if (subEl.value !== sub) { subEl.value = sub; subEl.dispatchEvent(new Event("input", { bubbles: true })); }
  // Hit points: the default die follows the size.
  const auto = SB_DIE[size] || 8, dieSel = g("sbm-die"); dieSel.options[0].textContent = `${size || "Medium"}: d${auto}`;
  const n = parseInt(g("sbm-hdn").value, 10), con = (g("sb-con") || {}).value;
  const calc = n > 0 ? sbHpText(n, Number(dieSel.value) || auto, con) : "";
  // Only rewrite the stored HP once something that feeds it has been changed, so opening an old creature never alters it.
  if (calc && SB_HP_TOUCHED) g("sb-hp").value = calc;
  g("sbm-hpprev").innerHTML = n > 0 ? (g("sb-hp").value === calc || !g("sb-hp").value ? `= <b>${esc(calc)}</b> <span class="muted">average, with Con ${signed(sbConMod(con))} per die</span>`
      : `<b>${esc(g("sb-hp").value)}</b> <span class="muted">as written. The formula gives ${esc(calc)}; change the dice or Con to use it.</span> <button type="button" class="btn ghost small" data-act="sbhpuse">Use ${esc(calc.split(" ")[0])}</button>`)
    : g("sb-hp").value ? `<span class="muted">Currently “${esc(g("sb-hp").value)}”. Enter the number of hit dice to work it out.</span>` : `<span class="muted">Enter the number of hit dice.</span>`;
  // Speeds.
  document.querySelectorAll("#sbm-speeds .sbsprow").forEach(row => {
    const t = row.querySelector(".sbsp-type").value;
    row.querySelector(".sbsp-n").hidden = row.querySelector(".sbsp-ft").hidden = t === "other";
    row.querySelector(".sbsp-text").hidden = t !== "other";
    row.querySelector(".sbsp-hoverwrap").hidden = t !== "fly";
  });
  g("sb-speed").value = sbBuildSpeed(sbReadSpeedRows());
  // Blank Exhaust / Proficiency show what will be used.
  const sbNow = { subtitle: sub, con, cr: (g("sb-cr") || {}).value };
  const ex = g("sb-exhaust"), pr = g("sb-prof");
  if (ex) ex.placeholder = sbAutoExhaust(sbNow) ? `Auto: ${sbAutoExhaust(sbNow)}` : "Only Large and bigger";
  if (pr) pr.placeholder = sbAutoProf(sbNow) ? `Auto: ${sbAutoProf(sbNow)}` : "From CR";
  sbDetSync();
  // Preview of the top of the stat block.
  const pv = g("sbm-preview");
  if (pv) {
    const name = (g("ed-title") || {}).value || "Creature", row = (l, v) => v ? `<p><b>${l}</b> ${esc(v)}</p>` : "";
    pv.innerHTML = `<div class="statblock mini"><h2 class="sbname">${esc(name)}</h2>${sub ? `<p class="sbsub">${esc(sub)}</p>` : ""}<div class="taper"></div>
      <div class="sbred">${row("Armour Class", (g("sb-ac") || {}).value)}${row("Hit Points", g("sb-hp").value)}${row("Speed", g("sb-speed").value)}${row("Exhaust Meter", (ex && ex.value.trim()) || sbAutoExhaust(sbNow))}${row("Proficiency Bonus", (pr && pr.value.trim()) || sbAutoProf(sbNow))}</div>
      ${document.querySelector(".sbdetails") ? `<div class="taper"></div><div class="sbred">${DETAIL_FIELDS.map(([k], i) => row(k, (g("sbd-" + i) || {}).value)).join("")}</div>` : ""}</div>`;
  }
}
function sbSpeedAction(a, el) {
  if (a === "sbspadd") { const box = document.getElementById("sbm-speeds"); const used = sbReadSpeedRows().map(r => r.type); const next = (SB_SPEEDS.find(([v]) => v !== "other" && !used.includes(v)) || ["fly"])[0]; box.insertAdjacentHTML("beforeend", sbSpeedRowHtml({ type: next, n: "" })); box.lastElementChild.querySelector(".sbsp-n").focus(); }
  if (a === "sbhpuse") SB_HP_TOUCHED = true;
  if (a === "sbspdel") { const row = el.closest(".sbsprow"), box = row.parentElement; row.remove(); if (!box.children.length) box.insertAdjacentHTML("beforeend", sbSpeedRowHtml()); }
  sbFormSync();
}
["input", "change"].forEach(t => document.addEventListener(t, ev => {
  const x = ev.target; if (!x || !x.id && !x.closest) return;
  if (/^(sbm-hdn|sbm-die|sbm-size|sb-con)$/.test(x.id || "")) SB_HP_TOUCHED = true;
  if (/^(sbm-|sb-con$|sb-cr$|sb-ac$|sb-exhaust$|sb-prof$|ed-title$)/.test(x.id || "") || (x.closest && x.closest("#sbm-speeds"))) sbFormSync();
}));

// ---------- Stat block details: saves as ticks, everything else as rows like Speed ----------
// Each detail line is still stored as "Label: value" text. Rows are built from the text when the form opens,
// and the text is only rewritten once that line (or an ability score / proficiency feeding it) is changed.
const SB_ABS = ["str", "dex", "con", "int", "wis", "cha"];
const SB_DMG = ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder", "bludgeoning, piercing and slashing from nonmagical attacks"];
const SB_CONDS = ["Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];
const SB_SENSES = ["Blindsight", "Darkvision", "Tremorsense", "Truesight"];
const SB_LANGS = ["—", "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc", "Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon", "Telepathy"];
// Which rows each line uses. num: the option takes a distance in feet.
const SB_DET = {
  1: { add: "skill", opts: SKILLS.map(s => s[1]) },
  2: { add: "vulnerability", opts: SB_DMG }, 3: { add: "resistance", opts: SB_DMG }, 4: { add: "immunity", opts: SB_DMG },
  5: { add: "condition", opts: SB_CONDS },
  6: { add: "sense", opts: SB_SENSES, num: () => true },
  7: { add: "language", opts: SB_LANGS, num: v => v === "Telepathy" }
};
const SB_DET_DIRTY = new Set();
const sbNum = v => { const n = parseInt(String(v || "").replace("−", "-"), 10); return isFinite(n) ? n : null; };
function sbFormVals() {
  const g = id => (document.getElementById(id) || {}).value || "";
  const ab = {}; SB_ABS.forEach(k => ab[k] = parseInt(g("sb-" + k), 10));
  const mod = k => isFinite(ab[k]) ? Math.floor((ab[k] - 10) / 2) : 0;
  const pb = sbNum(g("sb-prof")) ?? sbNum(sbAutoProf({ cr: g("sb-cr") })) ?? 2;
  return { mod, pb };
}
const sbSkillAb = name => (SKILLS.find(s => s[1].toLowerCase() === String(name).toLowerCase()) || [])[2];
function sbSkillBonus(name, lvl, V) { return V.mod(sbSkillAb(name)) + (lvl === "exp" ? 2 : 1) * V.pb; }

// ----- Reading the stored text into rows -----
function sbParseSaves(text) { const on = {}; String(text || "").split(/\s*,\s*/).forEach(p => { const m = p.match(/^(str|dex|con|int|wis|cha)\b/i); if (m) on[m[1].toLowerCase()] = true; }); return on; }
function sbParseDet(f, text, V) {
  text = String(text || "").trim(); if (!text) return [];
  const cfg = SB_DET[f], find = s => cfg.opts.find(o => o.toLowerCase() === String(s).trim().toLowerCase());
  if (f === 1) return text.split(/\s*,\s*/).map(p => {
    const m = p.match(/^(.+?)\s*([+\-−]\s*\d+)$/), name = m && find(m[1]);
    if (!name) return { v: "other", text: p };
    const n = sbNum(m[2].replace(/\s/g, ""));
    return n === sbSkillBonus(name, "exp", V) ? { v: name, p: "exp" } : n === sbSkillBonus(name, "prof", V) ? { v: name, p: "prof" } : { v: "other", text: p };
  });
  if (f >= 2 && f <= 4) {
    const rows = [];
    text.split(/\s*;\s*/).forEach(seg => {
      if (find(seg)) return rows.push({ v: find(seg) });
      if (/nonmagical|magic|silvered|adamantine|except/i.test(seg)) return rows.push({ v: "other", text: seg });
      seg.split(/\s*,\s*/).forEach(p => rows.push(find(p) ? { v: find(p) } : { v: "other", text: p }));
    });
    return rows;
  }
  return text.split(/\s*,\s*/).map(p => {
    if (f === 6 && /^passive perception\b/i.test(p)) return null; // worked out from Wisdom and Perception
    const m = p.match(/^(.+?)\s+(\d+)\s*ft\.?$/i);
    if (m && find(m[1]) && cfg.num && cfg.num(find(m[1]))) return { v: find(m[1]), n: m[2] };
    return find(p) && !(cfg.num && cfg.num(find(p))) ? { v: find(p) } : { v: "other", text: p };
  }).filter(Boolean);
}
// ----- Building the text from rows -----
function sbBuildDet(f, rows, V) {
  const ok = rows.filter(r => r.v === "other" ? String(r.text || "").trim() : r.v);
  if (f === 1) return ok.map(r => r.v === "other" ? r.text.trim() : `${r.v} ${signed(sbSkillBonus(r.v, r.p, V))}`).join(", ");
  if (f >= 2 && f <= 4) {
    const simple = ok.filter(r => r.v !== "other" && !r.v.includes(",")).map(r => r.v), long = ok.filter(r => r.v === "other" || r.v.includes(",")).map(r => r.v === "other" ? r.text.trim() : r.v);
    const out = [simple.join(", "), ...long].filter(Boolean).join("; ");
    return out.charAt(0).toUpperCase() + out.slice(1);
  }
  const cfg = SB_DET[f], parts = ok.map(r => r.v === "other" ? r.text.trim() : cfg.num && cfg.num(r.v) ? `${r.v} ${r.n || 0} ft.` : r.v);
  if (f === 6) parts.push(`Passive Perception ${sbPassive(V)}`);
  if (f === 7 && parts.length > 1) return parts.filter(p => p !== "—").join(", ");
  return parts.join(", ");
}
// 10 + Perception: the Perception skill row if there is one, else Wisdom.
function sbPassive(V) {
  const row = sbReadDetRows(1).find(r => r.v === "Perception");
  if (row) return 10 + sbSkillBonus("Perception", row.p, V);
  const other = sbReadDetRows(1).map(r => r.v === "other" && String(r.text).match(/^perception\s*([+\-−]\s*\d+)/i)).find(Boolean);
  return 10 + (other ? sbNum(other[1].replace(/\s/g, "")) : V.mod("wis"));
}

// ----- The form -----
function sbDetRowHtml(f, r, V) {
  r = r || { v: "" }; const cfg = SB_DET[f], other = r.v === "other", num = !other && cfg.num && cfg.num(r.v);
  return `<div class="sbsprow sbdrow"><select class="sbd-v" aria-label="${esc(SB_DET[f].add)}"><option value="">Choose…</option>${cfg.opts.map(o => `<option value="${esc(o)}"${r.v === o ? " selected" : ""}>${esc(o.length > 24 ? "B/P/S from nonmagical attacks" : o === "—" ? "None (—)" : o)}</option>`).join("")}<option value="other"${other ? " selected" : ""}>Other (type it)</option></select>
    ${f === 1 ? `<select class="sbd-p" aria-label="Proficiency"${other ? " hidden" : ""}><option value="prof"${r.p !== "exp" ? " selected" : ""}>Proficient</option><option value="exp"${r.p === "exp" ? " selected" : ""}>Expertise</option></select><b class="sbd-bonus"${other || !r.v ? " hidden" : ""}>${r.v && !other ? esc(signed(sbSkillBonus(r.v, r.p, V))) : ""}</b>` : ""}
    <input class="sbd-n" type="number" min="0" step="5" value="${esc(r.n || "")}" placeholder="60" aria-label="Feet"${num ? "" : " hidden"}><span class="muted small sbd-ft"${num ? "" : " hidden"}>ft.</span>
    <input class="sbd-text" type="text" value="${esc(r.text || "")}" aria-label="Type it"${other ? "" : " hidden"}>
    <button type="button" class="iconbtn" data-act="sbddel" aria-label="Remove">✕</button></div>`;
}
function sbReadDetRows(f) {
  return [...document.querySelectorAll(`.sbdet[data-f="${f}"] .sbdrow`)].map(row => ({ v: row.querySelector(".sbd-v").value, p: (row.querySelector(".sbd-p") || {}).value, n: row.querySelector(".sbd-n").value.trim(), text: row.querySelector(".sbd-text").value }));
}
function sbDetailsHtml(sb, det) {
  const V = { mod: k => { const n = parseInt(sb[k], 10); return isFinite(n) ? Math.floor((n - 10) / 2) : 0; }, pb: sbNum(sb.prof) ?? sbNum(sbAutoProf(sb)) ?? 2 };
  SB_DET_DIRTY.clear();
  const hidden = (i, k) => `<input type="hidden" id="sbd-${i}" value="${esc(det.known[k] || "")}">`;
  const saves = sbParseSaves(det.known["Saving Throws"]);
  return `<div class="sbdetails">
    <div class="sbdet sbsaves" data-f="0"><span class="flabel">Saving Throws <small class="muted">ability modifier + proficiency</small></span>
      <div class="sbsavegrid">${SB_ABS.map(k => `<label class="check inline"><input type="checkbox" class="sbsave" data-ab="${k}"${saves[k] ? " checked" : ""}> <span>${k[0].toUpperCase() + k.slice(1)} <b class="sbsave-v">${signed(V.mod(k) + V.pb)}</b></span></label>`).join("")}</div>
      <div class="sbdnote small muted"></div>${hidden(0, "Saving Throws")}</div>
    ${[1, 2, 3, 4, 5, 6, 7].map(f => { const k = DETAIL_FIELDS[f][0], rows = sbParseDet(f, det.known[k], V); return `<div class="sbdet" data-f="${f}"><span class="flabel">${esc(k)}${f === 6 ? ` <small class="muted">Passive Perception is added for you</small>` : ""}</span>
      <div class="sbdrows">${rows.map(r => sbDetRowHtml(f, r, V)).join("")}</div>
      <button type="button" class="btn ghost small" data-act="sbdadd" data-f="${f}">+ Add ${/^[aeiou]/.test(SB_DET[f].add) ? "an" : "a"} ${esc(SB_DET[f].add)}</button><div class="sbdnote small muted"></div>${hidden(f, k)}</div>`; }).join("")}
  </div>`;
}
function sbDetSync() {
  if (!document.querySelector(".sbdetails")) return;
  const V = sbFormVals();
  // Saves.
  document.querySelectorAll(".sbsave").forEach(cb => { cb.parentElement.querySelector(".sbsave-v").textContent = signed(V.mod(cb.dataset.ab) + V.pb); });
  if (SB_DET_DIRTY.has(0)) document.getElementById("sbd-0").value = [...document.querySelectorAll(".sbsave:checked")].map(cb => `${cb.dataset.ab[0].toUpperCase() + cb.dataset.ab.slice(1)} ${signed(V.mod(cb.dataset.ab) + V.pb)}`).join(", ");
  // Rows: show the right inputs, the skill bonus, and rebuild changed lines.
  document.querySelectorAll(".sbdet[data-f] .sbdrow").forEach(row => {
    const f = Number(row.closest(".sbdet").dataset.f), cfg = SB_DET[f], v = row.querySelector(".sbd-v").value, other = v === "other", num = !other && v && cfg.num && cfg.num(v);
    row.querySelector(".sbd-text").hidden = !other; row.querySelector(".sbd-n").hidden = row.querySelector(".sbd-ft").hidden = !num;
    const p = row.querySelector(".sbd-p"), b = row.querySelector(".sbd-bonus");
    if (p) { p.hidden = other; b.hidden = other || !v; if (v && !other) b.textContent = signed(sbSkillBonus(v, p.value, V)); }
  });
  for (let f = 1; f <= 7; f++) if (SB_DET_DIRTY.has(f)) document.getElementById("sbd-" + f).value = sbBuildDet(f, sbReadDetRows(f), V);
  // A note under a line whose stored text isn't what the rows would give (only until it's changed).
  document.querySelectorAll(".sbdet[data-f]").forEach(box => {
    const f = Number(box.dataset.f), stored = document.getElementById("sbd-" + f).value;
    const built = f === 0 ? [...box.querySelectorAll(".sbsave:checked")].map(cb => `${cb.dataset.ab[0].toUpperCase() + cb.dataset.ab.slice(1)} ${signed(V.mod(cb.dataset.ab) + V.pb)}`).join(", ") : sbBuildDet(f, sbReadDetRows(f), V);
    const norm = s => String(s).replace(/−/g, "-").replace(/\s+/g, " ").toLowerCase();
    box.querySelector(".sbdnote").innerHTML = stored && norm(stored) !== norm(built) && !SB_DET_DIRTY.has(f) ? `As written: “${esc(stored)}”. <button type="button" class="linkbtn" data-act="sbdetuse" data-f="${f}">Use “${esc(built || "nothing")}”</button>` : "";
  });
}
function sbDetAction(a, el) {
  if (a === "sbdadd") { const f = Number(el.dataset.f), box = el.closest(".sbdet").querySelector(".sbdrows"); box.insertAdjacentHTML("beforeend", sbDetRowHtml(f, { v: "" }, sbFormVals())); box.lastElementChild.querySelector(".sbd-v").focus(); SB_DET_DIRTY.add(f); }
  if (a === "sbddel") { const box = el.closest(".sbdet"); SB_DET_DIRTY.add(Number(box.dataset.f)); el.closest(".sbdrow").remove(); }
  if (a === "sbdetuse") SB_DET_DIRTY.add(Number(el.dataset.f));
  sbFormSync();
}
["input", "change"].forEach(t => document.addEventListener(t, ev => {
  const x = ev.target; if (!x || !x.closest) return;
  const box = x.closest(".sbdet[data-f]");
  if (box) { SB_DET_DIRTY.add(Number(box.dataset.f)); sbFormSync(); return; }
  // Ability scores and proficiency feed saves, skills and passive Perception.
  if (/^sb-(str|dex|con|int|wis|cha|prof|cr)$/.test(x.id || "")) { [0, 1, 6].forEach(f => SB_DET_DIRTY.add(f)); sbFormSync(); }
}));

// ---------- Recharge as its own box, and a Multiattack builder ----------
// Recharge is still saved in the name ("Bite (Recharge 5–6)") so everything that reads names keeps working.
const RCH_OPTS = [["", "No recharge"], ["6", "Recharge 6"], ["5–6", "Recharge 5–6"], ["4–6", "Recharge 4–6"], ["3–6", "Recharge 3–6"], ["2–6", "Recharge 2–6"], ["rest", "Short or long rest"], ["custom", "Custom…"]];
function rchSplit(name) {
  const m = String(name || "").match(/\s*\(((?:recharges?|recharge)\b[^)]*)\)\s*\.?\s*$/i);
  if (!m) return { name: String(name || ""), rch: "", rchc: "" };
  const t = m[1].trim(), base = name.slice(0, m.index).trim();
  const d = t.match(/^recharge\s+(\d)(?:\s*[–-]\s*6)?$/i);
  if (d) { const v = d[1] === "6" ? "6" : `${d[1]}–6`; if (RCH_OPTS.some(o => o[0] === v)) return { name: base, rch: v, rchc: "" }; }
  if (/^recharges after a short or long rest$/i.test(t)) return { name: base, rch: "rest", rchc: "" };
  return { name: base, rch: "custom", rchc: t };
}
function rchLabel(it) {
  if (!it || !it.rch) return "";
  if (it.rch === "rest") return " (Recharges after a Short or Long Rest)";
  if (it.rch === "custom") return it.rchc && it.rchc.trim() ? ` (${it.rchc.trim()})` : "";
  return ` (Recharge ${it.rch})`;
}
function rchFieldHtml(it) {
  return `<label class="itrchwrap"><span class="sr">Recharge</span><select class="itrch" aria-label="Recharge">${RCH_OPTS.map(([v, l]) => `<option value="${v}"${(it.rch || "") === v ? " selected" : ""}>${l}</option>`).join("")}</select>
    <input class="itrchc" type="text" value="${esc(it.rchc || "")}" placeholder="Recharge 5–6 while bloodied"${it.rch === "custom" ? "" : " hidden"} aria-label="Custom recharge"></label>`;
}
document.addEventListener("change", ev => { if (ev.target.matches && ev.target.matches(".itrch")) { const c = ev.target.parentElement.querySelector(".itrchc"); c.hidden = ev.target.value !== "custom"; if (!c.hidden) c.focus(); } });

// Multiattack: rows of { type: "action", name, n } or { type: "custom", n, text }.
const NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numWord = n => NUM_WORDS[n] || String(n);
const andJoin = a => a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
function multiCreature() { const t = ((document.getElementById("ed-title") || {}).value || "").trim(); return t ? t.toLowerCase() : "creature"; }
function buildMulti(m, who) {
  const rows = ((m && m.rows) || []).filter(r => r.type === "custom" ? String(r.text || "").trim() : r.name);
  if (!rows.length) return "";
  const n = r => Math.max(1, Number(r.n) || 1), total = rows.reduce((t, r) => t + n(r), 0);
  const part = r => r.type === "custom" ? `${numWord(n(r))} ${String(r.text).trim()}` : `${numWord(n(r))} with its ${r.name}`;
  const t = multiCreature(); who = who || (m.who && (m.who.toLowerCase() === t || t === "creature") ? m.who : t);
  const lead = `The ${who} makes ${numWord(total)} attack${total === 1 ? "" : "s"}`;
  if (rows.length === 1) { const r = rows[0]; return `${lead} ${r.type === "custom" ? String(r.text).trim() : `with its ${r.name}`}.`; }
  return `${lead}: ${andJoin(rows.map(part))}.`;
}
// Read a Multiattack line back into rows, but only if building it again gives exactly the same text.
function parseMulti(desc, names, who) {
  const t = String(desc || "").trim(), m = t.match(/^The (.+?) makes (\w+) attacks?(?::\s*(.+)|\s+(.+))\.$/); if (!m) return null;
  const wordN = w => { const i = NUM_WORDS.indexOf(String(w).toLowerCase()); return i > 0 ? i : parseInt(w, 10) || 0; };
  let rows;
  if (m[3]) rows = m[3].split(/,\s*|\s+and\s+(?=(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s)/).map(p => { const q = p.match(/^(\w+)\s+(.+)$/); if (!q) return null; const wn = wordN(q[1]), w = q[2].match(/^with its (.+)$/); return w && names.includes(w[1]) ? { type: "action", name: w[1], n: wn } : { type: "custom", n: wn, text: q[2] }; });
  else { const w = m[4].match(/^with its (.+)$/); rows = [w && names.includes(w[1]) ? { type: "action", name: w[1], n: wordN(m[2]) } : { type: "custom", n: wordN(m[2]), text: m[4] }]; }
  if (rows.some(r => !r || !r.n)) return null;
  const out = { rows, who: m[1] };
  return buildMulti(out, m[1]) === t ? out : null;
}
function multiRowHtml(r, names) {
  r = r || { type: "action", name: names[0] || "", n: 1 };
  const custom = r.type === "custom";
  return `<div class="mrow sbsprow"><input class="mrow-n" type="number" min="1" max="20" value="${esc(r.n || 1)}" aria-label="How many">
    <span class="muted small">×</span><select class="mrow-pick" aria-label="Which action">${names.map(nm => `<option value="${esc(nm)}"${!custom && r.name === nm ? " selected" : ""}>${esc(nm)}</option>`).join("")}<option value="__custom"${custom ? " selected" : ""}>Custom…</option></select>
    <input class="mrow-text" type="text" value="${esc(r.text || "")}" placeholder="with any attack that has a recharge of 3–6 or lower"${custom ? "" : " hidden"} aria-label="Custom wording">
    <button type="button" class="iconbtn" data-act="mrowdel" aria-label="Remove">✕</button></div>`;
}
function multiFieldsHtml(it, names, si, ii) {
  const m = it.multi || { rows: [] };
  return `<div class="multif" data-si="${si}" data-ii="${ii}" data-who="${esc(m.who || "")}"><div class="mrows">${m.rows.map(r => multiRowHtml(r, names)).join("")}</div>
    <button type="button" class="btn ghost small" data-act="mrowadd" data-si="${si}" data-ii="${ii}">+ Add an attack</button>
    <p class="mprev small"><b>Gives:</b> <span>${esc(buildMulti(m) || "Add the attacks it makes.")}</span></p></div>`;
}
function readMulti(box) {
  return { who: box.dataset.who || undefined, rows: [...box.querySelectorAll(".mrow")].map(row => { const pick = row.querySelector(".mrow-pick").value, n = Math.max(1, Number(row.querySelector(".mrow-n").value) || 1);
    return pick === "__custom" ? { type: "custom", n, text: row.querySelector(".mrow-text").value } : { type: "action", name: pick, n }; }) };
}
["input", "change"].forEach(t => document.addEventListener(t, ev => {
  const box = ev.target.closest && ev.target.closest(".multif"); if (!box) return;
  box.querySelectorAll(".mrow").forEach(row => { row.querySelector(".mrow-text").hidden = row.querySelector(".mrow-pick").value !== "__custom"; });
  box.querySelector(".mprev span").textContent = buildMulti(readMulti(box)) || "Add the attacks it makes.";
}));
