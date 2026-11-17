// ---------- Small shared widgets: tag picker, rich field setter, spell import ----------
// Tag picker: search box + chips. tagPickHtml(id, options [[value, label]], selected [values], { free, ph })
// Read with tagPickRead(id) → values. Free entries (not in the options) are kept as their text.
function tagPickHtml(id, options, selected, o) {
  o = o || {};
  const lab = v => (options.find(x => x[0] === v) || [v, v])[1];
  return `<div class="tpk" data-tpk="${esc(id)}" data-free="${o.free ? 1 : ""}" data-opts="${esc(JSON.stringify(options))}">
    <span class="tpkchips">${(selected || []).filter(Boolean).map(v => `<span class="tpkchip" data-v="${esc(v)}">${esc(lab(v))}<button type="button" class="tpkx" aria-label="Remove ${esc(lab(v))}">✕</button></span>`).join("")}</span>
    <input type="text" class="tpkin" placeholder="${esc(o.ph || "Search…")}" autocomplete="off" aria-label="${esc(o.ph || "Add")}">
    <div class="tpkmenu" hidden></div></div>`;
}
function tagPickRead(id) { const w = document.querySelector(`.tpk[data-tpk="${id}"]`); return w ? [...w.querySelectorAll(".tpkchip")].map(c => c.dataset.v) : []; }
function tpkOpts(w) { try { return JSON.parse(w.dataset.opts || "[]"); } catch (e) { return []; } }
function tpkAdd(w, v) {
  v = String(v || "").trim(); if (!v) return;
  const opts = tpkOpts(w), hit = opts.find(o => o[0].toLowerCase() === v.toLowerCase() || o[1].toLowerCase() === v.toLowerCase());
  if (!hit && !w.dataset.free) return;
  const val = hit ? hit[0] : v, lab = hit ? hit[1] : v;
  if ([...w.querySelectorAll(".tpkchip")].some(c => c.dataset.v === val)) return;
  w.querySelector(".tpkchips").insertAdjacentHTML("beforeend", `<span class="tpkchip" data-v="${esc(val)}">${esc(lab)}<button type="button" class="tpkx" aria-label="Remove ${esc(lab)}">✕</button></span>`);
  const inp = w.querySelector(".tpkin"); inp.value = ""; tpkMenu(w); inp.focus();
  w.dispatchEvent(new Event("tpkchange", { bubbles: true }));
}
function tpkMenu(w) {
  const inp = w.querySelector(".tpkin"), menu = w.querySelector(".tpkmenu"), q = inp.value.trim().toLowerCase();
  if (document.activeElement !== inp) { menu.hidden = true; return; }
  const have = new Set([...w.querySelectorAll(".tpkchip")].map(c => c.dataset.v));
  const list = tpkOpts(w).filter(o => !have.has(o[0]) && (!q || o[1].toLowerCase().includes(q))).slice(0, 40);
  const extra = q && w.dataset.free && !list.some(o => o[1].toLowerCase() === q) ? `<button type="button" class="tpkopt" data-add="${esc(inp.value.trim())}">Add “${esc(inp.value.trim())}”</button>` : "";
  menu.innerHTML = list.map(o => `<button type="button" class="tpkopt" data-add="${esc(o[0])}">${esc(o[1])}</button>`).join("") + extra;
  menu.hidden = !menu.innerHTML;
}
document.addEventListener("input", ev => { const w = ev.target.closest && ev.target.closest(".tpk"); if (w && ev.target.matches(".tpkin")) { ev.stopPropagation(); tpkMenu(w); } }, true);
document.addEventListener("focusin", ev => { const w = ev.target.closest && ev.target.closest(".tpk"); if (w && ev.target.matches(".tpkin")) tpkMenu(w); });
document.addEventListener("focusout", ev => { const w = ev.target.closest && ev.target.closest(".tpk"); if (w) setTimeout(() => { if (!w.contains(document.activeElement)) w.querySelector(".tpkmenu").hidden = true; }, 150); });
document.addEventListener("keydown", ev => {
  const w = ev.target.closest && ev.target.closest(".tpk"); if (!w || !ev.target.matches(".tpkin")) return;
  const inp = ev.target;
  if (ev.key === "Enter" || ev.key === ",") {
    ev.preventDefault(); ev.stopPropagation();
    const exact = tpkOpts(w).find(o => o[1].toLowerCase() === inp.value.trim().toLowerCase());
    const opt = [...w.querySelectorAll(".tpkopt")].find(b => !b.textContent.startsWith("Add “"));
    if (exact) tpkAdd(w, exact[0]); else if (opt && inp.value.trim()) tpkAdd(w, opt.dataset.add); else if (w.dataset.free && inp.value.trim()) tpkAdd(w, inp.value);
  } else if (ev.key === "Backspace" && !inp.value) { const last = w.querySelector(".tpkchip:last-child"); if (last) { last.remove(); w.dispatchEvent(new Event("tpkchange", { bubbles: true })); } }
  else if (ev.key === "ArrowDown") { const f = w.querySelector(".tpkopt"); if (f) { ev.preventDefault(); f.focus(); } }
  else if (ev.key === "Escape") { w.querySelector(".tpkmenu").hidden = true; ev.stopPropagation(); }
}, true);
document.addEventListener("mousedown", ev => { if (ev.target.closest && ev.target.closest(".tpkopt")) ev.preventDefault(); });
document.addEventListener("click", ev => {
  const x = ev.target.closest && ev.target.closest(".tpkx"); if (x) { ev.preventDefault(); ev.stopPropagation(); const w = x.closest(".tpk"); x.closest(".tpkchip").remove(); if (w) w.dispatchEvent(new Event("tpkchange", { bubbles: true })); return; }
  const o = ev.target.closest && ev.target.closest(".tpkopt"); if (o) { ev.preventDefault(); ev.stopPropagation(); tpkAdd(o.closest(".tpk"), o.dataset.add); return; }
  const w = ev.target.closest && ev.target.closest(".tpk"); if (w && !ev.target.closest("button")) w.querySelector(".tpkin").focus();
}, true);

// Set a textarea that may have been turned into a rich editor.
function setRichValue(ta, mdText, base) {
  if (!ta) return;
  ta.value = mdText;
  const wrap = ta.closest(".rt"), ed = wrap && wrap.querySelector(".rtedit");
  if (ed) { ed.innerHTML = mdToEditable(mdText, base == null ? 2 : base); ed.classList.toggle("is-empty", !mdText.trim()); }
}

// ----- Spell import: paste a spell from anywhere and work out its parts -----
const SPELL_LABELS = ["Casting Time", "Range", "Components", "Duration", "Classes", "At Higher Levels", "Using a Higher-Level Spell Slot", "Cantrip Upgrade", "Target", "Area"];
function parseSpellText(raw) {
  let t = String(raw || "").replace(/\r/g, "").replace(/\\(.)/g, "$1").replace(/ /g, " ");
  // Put each known label on its own line, wherever it was: bold labels ("**Range** Touch") and "Label:" ones.
  const lre = L => L.replace(/-/g, "[- ]").replace(/ /g, "\\s+");
  for (const L of SPELL_LABELS) t = t.replace(new RegExp("\\*{2,3}\\s*" + lre(L) + "\\s*[:.]?\\s*\\*{2,3}\\s*:?", "gi"), "\n" + L + ": ");
  t = t.replace(/\*\*|__|\*/g, "").replace(/^#+\s*/gm, "");
  for (const L of SPELL_LABELS) t = t.replace(new RegExp("(^|[\\s.])" + lre(L) + "\\s*:", "gim"), "$1\n" + L + ": ");
  for (const L of ["At Higher Levels", "Cantrip Upgrade", "Using a Higher-Level Spell Slot"]) t = t.replace(new RegExp("(^|\\s)" + lre(L) + "\\.\\s*", "g"), "$1\n" + L + ": ");
  const lines = t.split("\n").map(l => l.trim()).filter(Boolean);
  const out = { name: "", level: 0, school: "", ritual: false, classes: "", time: "", range: "", comp: "", dur: "", conc: false, desc: "", higher: "" };
  const nk = x => x.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const labelOf = l => { const m = l.match(/^([A-Za-z -]+):\s*(.*)$/); if (!m) return null; const L = SPELL_LABELS.find(x => nk(x) === nk(m[1])); return L ? [L, m[2].trim()] : null; };
  const desc = [], higher = []; let mode = "head";
  for (let k = 0; k < lines.length; k++) {
    let l = lines[k];
    const lab = labelOf(l);
    if (lab) {
      const [L, v] = lab;
      if (L === "Casting Time") out.time = v; else if (L === "Range") out.range = v; else if (L === "Components") out.comp = v;
      else if (L === "Classes") out.classes = v;
      else if (L === "Target" || L === "Area") desc.push(L + ": " + v);
      else if (L === "Duration") {
        // The description often runs straight on after the duration ("1 minuteA bright streak…").
        const m = v.match(/^(Instantaneous|Permanent|Special|Until dispelled(?: or triggered)?|(?:Concentration,\s*)?up to \d+ \w+|\d+ \w+|-|—)\s*(.*)$/i);
        out.dur = m ? m[1] : v; if (m && m[2]) desc.push(m[2]);
        mode = "desc";
      } else { mode = "higher"; if (v) higher.push(v); }
      continue;
    }
    if (mode === "head") {
      const lv = l.match(/(\d)(?:st|nd|rd|th)[- ]level[,\s]+([A-Za-z]+)/i) || l.match(/level\s+(\d)\s+([A-Za-z]+)/i), ct = l.match(/([A-Za-z]+)\s+cantrip/i);
      if (lv || ct) {
        if (lv) { out.level = Number(lv[1]); out.school = lv[2]; } else { out.level = 0; out.school = ct[1]; }
        out.ritual = /ritual/i.test(l);
        const cls = l.match(/\(([^)]+)\)/); if (cls && !/^ritual$/i.test(cls[1].trim())) out.classes = cls[1].replace(/ritual,?\s*/i, "").trim();
        if (!out.name && k > 0) out.name = lines[k - 1];
        const before = l.slice(0, (lv || ct).index).trim(); if (!out.name && before) out.name = before.replace(/[#:,-]+$/, "").trim();
      } else if (!out.name) out.name = l;
      continue;
    }
    (mode === "higher" ? higher : desc).push(l);
  }
  out.school = out.school ? out.school[0].toUpperCase() + out.school.slice(1).toLowerCase() : "";
  if (!SPELL_SCHOOLS.includes(out.school)) out.school = SPELL_SCHOOLS.find(s => s.toLowerCase().startsWith(out.school.toLowerCase().slice(0, 4))) || "";
  if (out.name === out.name.toUpperCase()) out.name = out.name.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
  if (/concentration/i.test(out.dur)) { out.conc = true; out.dur = out.dur.replace(/^Concentration,\s*/i, "").replace(/^up/, "Up"); }
  out.desc = desc.join("\n\n"); out.higher = higher.join(" ");
  // Combat details from the description.
  const d = out.desc;
  const dm = d.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+(\w+)\s+damage/i);
  out.dmg = dm ? dm[1].replace(/\s+/g, " ") : ""; out.dtype = dm && DAMAGE_TYPES.includes(dm[2].toLowerCase()) ? dm[2].toLowerCase() : "";
  const sv = d.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i);
  out.attack = /ranged spell attack/i.test(d) ? "ranged" : /melee spell attack/i.test(d) ? "melee" : sv ? "save" : "";
  out.save = sv ? sv[1].slice(0, 3).toLowerCase() : "";
  out.half = !!sv && /half as much damage/i.test(d);
  const heal = d.match(/regains? (?:a number of )?hit points equal to (\d+d\d+)(?:\s*\+\s*your spellcasting ability modifier)?/i);
  out.heal = heal ? heal[1] + (/spellcasting ability modifier/i.test(heal[0]) ? " + MOD" : "") : "";
  const ao = d.match(/(\d+)-foot(?:-(?:radius|long|wide))?\s*(sphere|cone|cube|line|cylinder|radius)/i) || d.match(/(\d+)-foot[- ]radius/i);
  out.aoe = ao ? { shape: /cone|cube|line|cylinder/i.test(ao[2] || "") ? ao[2].toLowerCase() : "sphere", size: Number(ao[1]) } : null;
  out.scale = out.level === 0 && !!out.dmg && /(5th|11th|17th) level|levels? 5\b/i.test(out.higher + " " + d);
  if (/^[-—]$/.test(out.dur)) out.dur = "Permanent";
  return out;
}
function spellImportApply(text) {
  const p = parseSpellText(text != null ? text : ($("#sp-paste") || {}).value); if (!p.name && !p.time && !p.desc) { toast("Couldn't find a spell in that text.", "bad"); return; }
  const set = (id, v) => { const el = $("#" + id); if (el && v != null) { if (el.type === "checkbox") el.checked = !!v; else el.value = v; } };
  if (p.name) set("ed-title", p.name);
  set("sp-level", String(p.level)); set("sp-school", p.school); set("sp-time", p.time); set("sp-range", p.range); set("sp-comp", p.comp); set("sp-dur", p.dur);
  set("sp-conc", p.conc); set("sp-ritual", p.ritual); set("sp-classes", p.classes); set("sp-attack", p.attack); set("sp-save", p.save); set("sp-half", p.half);
  set("sp-dmg", p.dmg); set("sp-dtype", p.dtype); set("sp-scale", p.scale); set("sp-heal", p.heal); set("sp-shape", p.aoe ? p.aoe.shape : ""); set("sp-size", p.aoe ? p.aoe.size : ""); set("sp-higher", p.higher);
  setRichValue($("#ed-body"), p.desc, 2);
  const det = $("#sp-import"); if (det) det.open = false;
  const found = [p.time && "casting time", p.range && "range", p.comp && "components", p.dur && "duration", p.desc && "description", p.dmg && "damage", p.aoe && "area"].filter(Boolean);
  toast(`Filled in ${found.join(", ") || "what it could"}. Check it over before saving.`);
}
