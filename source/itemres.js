// ---------- Resource lines: on items, and the Resources section of a sheet ----------
// An item can carry resource lines: item.res = [{ name, max, style: "box"|"slider", color, reset }].
// reset: "long" / "short" refill on that rest, "long-empty" / "short-empty" empty on that rest, "none" never changes.
// A character tracks how much of each line it has in c.itemRes["<item ref>"] = [current, …] while the item is equipped.
// The sheet's own resources can be boxes or a slider too (r.style, r.color).
const RES_RESETS = [["long", "Refills on a long rest"], ["short", "Refills on a short rest"], ["long-empty", "Empties on a long rest"], ["short-empty", "Empties on a short rest"], ["none", "Never resets"]];
const RES_STYLES = [["box", "Boxes"], ["slider", "Slider"], ["counter", "Counter (no cap)"]];
const RES_DEFAULT_COLOR = "#c9a24a";
const resIsCounter = r => !!r && r.style === "counter";
// Counters have no top, so "refills" and "empties" both mean back to 0.
const resResetText = r => { const rs = (r && r.reset) || "long"; if (resIsCounter(r)) return rs === "none" ? "doesn't reset" : `back to 0 on a ${/short/.test(rs) ? "short" : "long"} rest`; return ({ long: "refills on a long rest", short: "refills on a short rest", "long-empty": "empties on a long rest", "short-empty": "empties on a short rest", none: "doesn't reset" })[rs] || ""; };
const resColor = c => /^#[0-9a-f]{3,8}$/i.test(String(c || "")) ? c : RES_DEFAULT_COLOR;
// The top of a line: a number, or the character's proficiency bonus (amt: "pb").
const resMax = (r, c) => r && r.amt === "pb" ? (c ? cPB(c) : 0) : Math.max(0, Math.min(999, Number(r && r.max) || 0));
const resValid = r => !!(r && r.name && (resIsCounter(r) || r.amt === "pb" || Number(r.max) > 0));
const resAmtText = (r, c) => resIsCounter(r) ? "no cap" : r.amt === "pb" ? (c ? `${resMax(r, c)} (proficiency bonus)` : "= proficiency bonus") : String(resMax(r));
// A sheet resource: how many are left, and setting it.
function charResHave(c, r) { return resIsCounter(r) ? Math.max(0, Number(r.count) || 0) : Math.max(0, resMax(r, c) - (Number(r.used) || 0)); }
function charResSet(x, r, v) { if (resIsCounter(r)) r.count = Math.max(0, Math.round(v)); else { const m = resMax(r, x); r.used = m - Math.max(0, Math.min(m, v)); } }

// ----- Item editor -----
function itemResRowHtml(r) {
  r = r || {};
  const ctr = resIsCounter(r), pb = r.amt === "pb";
  return `<div class="itresrow frow tight">
    <label class="grow"><span>Title</span><input class="ir-name" type="text" value="${esc(r.name || "")}" placeholder="Left hand charges"></label>
    <label class="ir-amtwrap"${ctr ? " hidden" : ""}><span>Amount</span><span class="ir-amt"><select class="ir-amtmode" aria-label="Amount is"><option value="n"${pb ? "" : " selected"}>Number</option><option value="pb"${pb ? " selected" : ""}>Prof. bonus</option></select><input class="ir-max mini" type="number" min="1" max="999" value="${esc(r.max || 3)}"${pb ? " hidden" : ""} aria-label="How many"></span></label>
    <label><span>Shown as</span><select class="ir-style">${RES_STYLES.map(([v, l]) => `<option value="${v}"${(r.style || "box") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <label><span>Colour</span><input class="ir-color" type="color" value="${esc(resColor(r.color))}"></label>
    <label><span>On a rest</span><select class="ir-reset">${RES_RESETS.map(([v, l]) => `<option value="${v}"${(r.reset || "long") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <button type="button" class="iconbtn" data-act="itresdel" aria-label="Remove this resource line">✕</button></div>`;
}
function itemResFieldsHtml(it) {
  const list = Array.isArray(it.res) && it.res.length ? it.res : [{}];
  return `<span class="flabel">Resource lines <small class="muted">tracked on the sheet of whoever has it equipped</small></span>
    <div class="itreslist">${list.map(itemResRowHtml).join("")}</div>
    <button type="button" class="btn ghost small" data-act="itresadd">+ Add resource line</button>`;
}
function readItemRes() {
  if (!($("#it-res-on") || {}).checked) return null;
  const out = [...document.querySelectorAll(".itreslist .itresrow")].map(readResRow).filter(r => r.name);
  return out.length ? out : null;
}
function readResRow(row) {
  const style = ["slider", "counter"].includes(row.querySelector(".ir-style").value) ? row.querySelector(".ir-style").value : "box";
  const o = { name: row.querySelector(".ir-name").value.trim(), max: Math.max(1, Math.min(999, Number(row.querySelector(".ir-max").value) || 1)), style, color: row.querySelector(".ir-color").value, reset: row.querySelector(".ir-reset").value };
  if (style !== "counter" && row.querySelector(".ir-amtmode").value === "pb") o.amt = "pb";
  return o;
}
document.addEventListener("change", ev => {
  const row = ev.target.closest && ev.target.closest(".itresrow"); if (!row) return;
  if (ev.target.matches(".ir-style")) row.querySelector(".ir-amtwrap").hidden = ev.target.value === "counter";
  if (ev.target.matches(".ir-amtmode")) row.querySelector(".ir-max").hidden = ev.target.value === "pb";
});
function itemResAction(a, el) {
  if (a === "itresadd") { const box = document.querySelector(".itreslist"); if (box) { box.insertAdjacentHTML("beforeend", itemResRowHtml({})); box.lastElementChild.querySelector(".ir-name").focus(); } return true; }
  if (a === "itresdel") { const row = el.closest(".itresrow"), box = row && row.parentElement; if (row) row.remove(); if (box && box.classList.contains("itreslist") && !box.children.length) box.insertAdjacentHTML("beforeend", itemResRowHtml({})); return true; }
  if (a === "sbresadd") { const box = el.parentElement.querySelector(".fresl"); box.insertAdjacentHTML("beforeend", itemResRowHtml({ max: 3 })); box.lastElementChild.querySelector(".ir-name").focus(); return true; }
  return false;
}

// ----- Display pieces -----
function resPipsHtml(have, max, color, act) {
  // act(j) → attributes for a clickable pip, or "" for a still picture.
  return `<div class="pips" style="--rc:${resColor(color)}">${Array.from({ length: max }, (_, j) => act ? `<button class="pip res${j < have ? " on" : ""}" ${act(j)}></button>` : `<span class="pip res${j < have ? " on" : ""}"></span>`).join("")}</div>`;
}
function resBarHtml(have, max, color, label, ctl) {
  const pct = max ? Math.max(0, Math.min(100, (have / max) * 100)) : 0;
  return `<div class="rslider" style="--rc:${resColor(color)}"><div class="spnums"><span class="vl">${label}</span><strong>${have}<small> / ${max}</small></strong>${ctl ? ctl.adj : ""}</div>
    <div class="rbar"${ctl ? ` ${ctl.bar} title="Tap to set"` : ""} role="img" aria-label="${have} of ${max}"><i style="width:${pct}%"></i></div></div>`;
}
function resCounterHtml(have, color, label, ctl) {
  return `<div class="rcounter" style="--rc:${resColor(color)}"><span class="vl">${label}</span>
    <span class="rcctl">${ctl ? `<button class="iconbtn" ${ctl}="-1" aria-label="One less">−</button>` : ""}<strong>${have}</strong>${ctl ? `<button class="iconbtn" ${ctl}="1" aria-label="One more">+</button>` : ""}</span></div>`;
}
// On the item's own page, under its damage and stats.
function itemResPreviewHtml(it) {
  const list = (it.res || []).filter(resValid); if (!list.length) return "";
  const empty = r => /empty/.test(r.reset || "");
  return `<div class="ires">${list.map(r => `<div class="iresrow"><span class="iresname">${esc(r.name)}</span>
      ${resIsCounter(r) ? `<span class="rcpill" style="--rc:${resColor(r.color)}">− 0 +</span><span class="muted small">counter, no cap</span>`
        : r.amt === "pb" ? `${r.style === "slider" ? `<div class="rbar mini" style="--rc:${resColor(r.color)}"><i style="width:${empty(r) ? 0 : 100}%"></i></div>` : resPipsHtml(empty(r) ? 0 : 2, 2, r.color)}<span class="muted small">= proficiency bonus</span>`
        : r.style === "slider" ? `<div class="rbar mini" style="--rc:${resColor(r.color)}"><i style="width:${empty(r) ? 0 : 100}%"></i></div><span class="muted small">${resMax(r)}</span>` : resPipsHtml(empty(r) ? 0 : resMax(r), resMax(r), r.color)}
      <span class="muted small">${esc(resResetText(r))}</span></div>`).join("")}</div>`;
}
// ----- On a character -----
function itemResStart(r, c) { return resIsCounter(r) || /empty/.test(r.reset || "") ? 0 : resMax(r, c); }
function itemResHave(c, ref, k, r) { const v = ((c.itemRes || {})[ref] || [])[k]; if (v == null) return itemResStart(r, c); const n = Math.max(0, Number(v) || 0); return resIsCounter(r) ? n : Math.min(resMax(r, c), n); }
function itemResSet(x, ref, k, r, v) { x.itemRes = Object.assign({}, x.itemRes); const a = (x.itemRes[ref] || []).slice(); a[k] = Math.max(0, resIsCounter(r) ? Math.round(v) : Math.min(resMax(r, x), v)); x.itemRes[ref] = a; }
// Equipped items (body armour and the six equipped slots; not things packed inside a storage item) that have resource lines.
function equippedResItems(c, keys) {
  const inv = invOf(c), out = [], seen = new Set();
  (keys || ["ar", ...EQ_KEYS]).forEach(k => {
    const s = inv.slots[k]; if (!s || seen.has(s.ref)) return; seen.add(s.ref);
    const r = invResolve(s.ref, s.name);
    if (((r.e.item || {}).res || []).some(resValid)) out.push({ ref: s.ref, name: r.name, id: r.id, lines: r.e.item.res });
  });
  return out;
}
function itemResRest(x, long, keys) {
  for (const it of equippedResItems(x, keys)) it.lines.forEach((r, k) => {
    if (!resValid(r)) return;
    const rs = r.reset || "long", hit = /^short/.test(rs) || (long && /^long/.test(rs));
    if (!hit) return;
    itemResSet(x, it.ref, k, r, resIsCounter(r) || /empty/.test(rs) ? 0 : resMax(r, x));
  });
}
// The sheet's own resources on a rest. Counters go back to 0.
function charResRest(x, long) {
  (x.resources || []).forEach(r => { const rs = r.reset || "long"; if (rs === "none" || !(long || rs === "short")) return; if (resIsCounter(r)) r.count = 0; else r.used = 0; });
}
// Where on a bar was tapped, as a whole number of max.
function barValue(el, ev, max) { const b = el.getBoundingClientRect(), f = b.width ? (ev.clientX - b.left) / b.width : 0; return Math.max(0, Math.min(max, Math.round(f * max))); }

// The Resources section: sliders first (spell points, slider resources, slider item lines), then a line, then boxes and counters.
function resourcesSectionHtml(c, id, E, P) {
  const res = c.resources || [], items = equippedResItems(c);
  if (E) return `<div class="reslist">${res.map((r, k) => { const ctr = resIsCounter(r), pb = r.amt === "pb"; return `<div class="resrow">
      <div class="frow tight"><label class="grow"><span>Name</span>${cField(`resources.${k}.name`, r.name)}</label>
        ${ctr ? "" : `<label><span>Amount</span><span class="ir-amt"><select class="cf" data-cf="resources.${k}.amt" aria-label="Amount is"><option value=""${pb ? "" : " selected"}>Number</option><option value="pb"${pb ? " selected" : ""}>Prof. bonus</option></select>${pb ? `<span class="muted small pbnow">${cPB(c)}</span>` : cField(`resources.${k}.max`, r.max, { num: 1, cls: "mini", label: "How many" })}</span></label>`}
        <label><span>Shown as</span><select class="cf" data-cf="resources.${k}.style">${RES_STYLES.map(([v, l]) => `<option value="${v}"${(r.style || "box") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label><span>Colour</span><input type="color" class="cf" data-cf="resources.${k}.color" value="${esc(resColor(r.color))}"></label>
        <label><span>${ctr ? "Back to 0 on" : "Resets on"}</span><select class="cf" data-cf="resources.${k}.reset"><option value="short"${r.reset === "short" ? " selected" : ""}>Short rest</option><option value="long"${!r.reset || r.reset === "long" ? " selected" : ""}>Long rest</option><option value="none"${r.reset === "none" ? " selected" : ""}>Never</option></select></label>
        <label class="grow"><span>Note</span>${cField(`resources.${k}.note`, r.note)}</label><button class="iconbtn" data-act="clistdel" data-v="resources" data-k="${k}" aria-label="Remove ${esc(r.name)}">✕</button></div>
      </div>`; }).join("")}</div><button class="btn ghost small" data-act="clistadd" data-v="resources">+ Add resource</button>
      ${items.length ? `<p class="muted small">Resource lines from equipped items (${items.map(i => esc(i.name)).join(", ")}) are set up on the item itself.</p>` : ""}`;
  const sliders = [], boxes = [], dis = P ? "" : " disabled";
  const sp = typeof spBarHtml === "function" ? spBarHtml(c, id) : ""; if (sp) sliders.push(sp);
  const sheetReset = r => r.reset === "none" ? (resIsCounter(r) ? "doesn't reset" : "doesn't reset") : resIsCounter(r) ? `back to 0 on a ${r.reset === "short" ? "short" : "long"} rest` : r.reset === "short" ? "short rest" : "long rest";
  const add = (r, have, label, sub, acts) => {
    const m = resMax(r, c);
    if (resIsCounter(r)) boxes.push(`<div class="resrow"><div class="resname"><strong>${label}</strong><span class="muted small">${sub}</span></div>${resCounterHtml(have, r.color, "", P ? acts.adj : "")}</div>`);
    else if (r.style === "slider") sliders.push(resBarHtml(have, m, r.color, `${label} <small class="muted">${sub}</small>`, P ? { adj: `<span class="spadj"><button class="iconbtn" ${acts.adj}="-1" aria-label="Spend one">−</button><button class="iconbtn" ${acts.adj}="1" aria-label="Gain one">+</button></span>`, bar: acts.bar } : null));
    else boxes.push(`<div class="resrow"><div class="resname"><strong>${label}</strong><span class="muted small">${sub}</span></div>${resPipsHtml(have, m, r.color, j => `${acts.pip} data-j="${j}"${dis} aria-label="${label} ${j + 1}"`)}</div>`);
  };
  res.forEach((r, k) => {
    if (!r || (!r.name && !resValid(r))) return;
    const pbNote = r.amt === "pb" ? " · = proficiency bonus" : "";
    add(r, charResHave(c, r), esc(r.name), `${sheetReset(r)}${pbNote}${r.note ? " · " + esc(r.note) : ""}`, { adj: `data-act="cresadj" data-k="${k}" data-id="${esc(id)}" data-v`, bar: `data-act="cresbar" data-k="${k}" data-id="${esc(id)}"`, pip: `data-act="cres" data-k="${k}" data-id="${esc(id)}"` });
  });
  items.forEach(it => it.lines.forEach((r, k) => {
    if (!resValid(r)) return;
    const from = it.id ? `<a href="#entry-${esc(it.id)}">${esc(it.name)}</a>` : esc(it.name), a = `data-ref="${esc(it.ref)}" data-k="${k}" data-id="${esc(id)}"`;
    add(r, itemResHave(c, it.ref, k, r), esc(r.name), `${from} · ${esc(resResetText(r))}${r.amt === "pb" ? " · = proficiency bonus" : ""}`, { adj: `data-act="ciresadj" ${a} data-v`, bar: `data-act="ciresbar" ${a}`, pip: `data-act="cires" ${a}` });
  }));
  if (!sliders.length && !boxes.length) return `<p class="muted small">No limited-use features. Add them in Edit sheet (Rage, Second Wind, ki…), or give an equipped item resource lines.</p>`;
  return `${sliders.length ? `<div class="resliders">${sliders.join("")}</div>` : ""}${sliders.length && boxes.length ? `<hr class="resdiv">` : ""}${boxes.length ? `<div class="reslist">${boxes.join("")}</div>` : ""}`;
}
// Sheet actions for resources (pips, sliders, counters, item lines). Returns true when handled.
function resAction(a, el, ev, id) {
  const k = Number(el.dataset.k);
  if (a === "cres" || a === "cresadj" || a === "cresbar") {
    charChange(id, x => {
      const r = x.resources[k]; if (!r) return;
      const have = charResHave(x, r), j = Number(el.dataset.j);
      charResSet(x, r, a === "cresbar" ? barValue(el, ev, resMax(r, x)) : a === "cresadj" ? have + Number(el.dataset.v) : (j < have ? j : j + 1));
    });
    return true;
  }
  if (a === "cires" || a === "ciresadj" || a === "ciresbar") {
    const ref = el.dataset.ref, c = S.chars.get(id), it = equippedResItems(c).find(i => i.ref === ref), r = it && it.lines[k]; if (!r) return true;
    charChange(id, x => {
      const have = itemResHave(x, ref, k, r), j = Number(el.dataset.j);
      itemResSet(x, ref, k, r, a === "ciresbar" ? barValue(el, ev, resMax(r, x)) : a === "ciresadj" ? have + Number(el.dataset.v) : (j < have ? j : j + 1));
    });
    return true;
  }
  return false;
}

// ---------- Resources on creature traits and actions ----------
// Saved in the stat block's markdown on its own line under the feature: {{res:<encoded JSON list of lines>}}.
// Where the stat block is shown with a context, the amounts are tracked there: "cb:<encounter>:<combatant>" and
// "sm:<character>:<summon>" are saved; "e:<entry>" (the bestiary page) lasts until the page is reloaded.
const FRES_RE = /^\s*\{\{res:([^}\s]+)\}\}\s*$/;
const fresToken = lines => "{{res:" + encodeURIComponent(JSON.stringify(lines)) + "}}";
const fresDecode = s => { try { const v = JSON.parse(decodeURIComponent(s)); return Array.isArray(v) ? v.filter(resValid) : []; } catch (e) { return []; } };
const FRES = new Map();
// A creature's proficiency bonus, as a stand-in "character" for resMax.
const fresPbOf = sb => ({ pbOverride: String(parseInt(String((sb && sb.prof) || sbAutoProf(sb || {}) || "+2").replace("−", "-"), 10) || 2) });
// md() draws this; featuresHtml swaps it for the live version.
function fresStaticHtml(enc) {
  const lines = fresDecode(enc); if (!lines.length) return "";
  return `<div class="fres" data-fres="${esc(enc)}">${lines.map(r => `<div class="fresline"><span class="fresname">${esc(r.name)}</span>${resIsCounter(r) ? `<span class="rcpill" style="--rc:${resColor(r.color)}">0</span>` : r.style === "slider" ? `<div class="rbar mini" style="--rc:${resColor(r.color)}"><i style="width:${/empty/.test(r.reset || "") ? 0 : 100}%"></i></div>` : resPipsHtml(/empty/.test(r.reset || "") ? 0 : Math.min(resMax(r) || 3, 20), Math.min(resMax(r) || 3, 20), r.color)}<span class="muted small">${r.amt === "pb" ? "= proficiency bonus · " : ""}${esc(resResetText(r))}</span></div>`).join("")}</div><!--/fres-->`;
}
function fresStore(ctx) {
  const [kind, a, b] = String(ctx).split(":");
  if (kind === "cb") { const en = S.encs && S.encs.get(a), c = en && encItems(en).find(x => x.uid === b); return (c && c.fres) || {}; }
  if (kind === "sm") { const ch = S.chars.get(a), sm = ch && smList(ch).find(x => x.id === b); return (sm && sm.fres) || {}; }
  return FRES.get(ctx) || {};
}
function fresSave(ctx, key, v) {
  const [kind, a, b] = String(ctx).split(":"), put = o => Object.assign({}, o, { [key]: v });
  if (kind === "cb") { if (READONLY) return; encSave(a, en => { en.list = en.list.map(c => c.uid === b ? Object.assign(c, { fres: put(c.fres) }) : c); }); }
  else if (kind === "sm") { if (READONLY && !PLAYER) return; charChange(a, x => { x.summons = smList(x).map(s => s.id === b ? Object.assign({}, s, { fres: put(s.fres) }) : s); }); }
  else { FRES.set(ctx, put(FRES.get(ctx))); render(); }
}
const fresHave = (store, key, r, pbc) => { const v = store[key]; if (v == null) return itemResStart(r, pbc); const n = Math.max(0, Number(v) || 0); return resIsCounter(r) ? n : Math.min(resMax(r, pbc), n); };
// Swap each static block for live controls, keyed by its place in the stat block ("f<n>.<line>").
function fresLive(html, ctx, sb) {
  if (!html.includes('class="fres"')) return html;
  const store = fresStore(ctx), pbc = fresPbOf(sb), canEdit = String(ctx).startsWith("sm:") ? (!READONLY || PLAYER) : !READONLY || !String(ctx).startsWith("cb:");
  let n = 0;
  return html.replace(/<div class="fres" data-fres="([^"]*)">[\s\S]*?<\/div><!--\/fres-->/g, (m, enc) => {
    const f = n++, lines = fresDecode(unesc(enc));
    return `<div class="fres live">${lines.map((r, k) => {
      const key = `f${f}.${k}`, have = fresHave(store, key, r, pbc), m2 = resMax(r, pbc), a = `data-fresctx="${esc(ctx)}" data-freskey="${esc(key)}"`;
      const ctl = resIsCounter(r) ? resCounterHtml(have, r.color, "", canEdit ? `${a} data-fres="adj" data-v` : "")
        : r.style === "slider" ? resBarHtml(have, m2, r.color, "", canEdit ? { adj: `<span class="spadj"><button type="button" class="iconbtn" ${a} data-fres="adj" data-v="-1" aria-label="Spend one">−</button><button type="button" class="iconbtn" ${a} data-fres="adj" data-v="1" aria-label="Gain one">+</button></span>`, bar: `${a} data-fres="bar"` } : null)
        : resPipsHtml(have, m2, r.color, canEdit ? j => `type="button" ${a} data-fres="pip" data-j="${j}" aria-label="${esc(r.name)} ${j + 1}"` : null);
      return `<div class="fresline"><span class="fresname">${esc(r.name)}</span>${ctl}<span class="muted small">${r.amt === "pb" ? `${m2} (proficiency bonus) · ` : ""}${esc(resResetText(r))}</span></div>`;
    }).join("")}</div>`;
  });
}
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-fres]"); if (!b || !b.dataset.freskey) return;
  ev.preventDefault(); ev.stopPropagation();
  const ctx = b.dataset.fresctx, key = b.dataset.freskey, [f, k] = key.slice(1).split(".").map(Number);
  // Find the line's definition again from the shown stat block.
  const def = FRES_DEFS.get(ctx + "|" + key); if (!def) return;
  const { r, pbc } = def, store = fresStore(ctx), have = fresHave(store, key, r, pbc), j = Number(b.dataset.j);
  let v = b.dataset.fres === "adj" ? have + Number(b.dataset.v) : b.dataset.fres === "bar" ? barValue(b, ev, resMax(r, pbc)) : (j < have ? j : j + 1);
  v = Math.max(0, resIsCounter(r) ? v : Math.min(resMax(r, pbc), v));
  fresSave(ctx, key, v);
}, true);
// Definitions of the lines last drawn, so a click can find its line.
const FRES_DEFS = new Map();
function fresRemember(ctx, sb) {
  const pbc = fresPbOf(sb); let f = 0;
  String((sb && sb.features) || "").split(/\r?\n/).forEach(l => { const m = l.match(FRES_RE); if (m) { fresDecode(m[1]).forEach((r, k) => FRES_DEFS.set(`${ctx}|f${f}.${k}`, { r, pbc })); f++; } });
}
// Rests for a summon's stat block lines.
function fresRest(store, sb, long) {
  const out = Object.assign({}, store), pbc = fresPbOf(sb); let f = 0;
  String((sb && sb.features) || "").split(/\r?\n/).forEach(l => { const m = l.match(FRES_RE); if (!m) return; fresDecode(m[1]).forEach((r, k) => {
    const rs = r.reset || "long"; if (!(/^short/.test(rs) || (long && /^long/.test(rs)))) return;
    out[`f${f}.${k}`] = resIsCounter(r) || /empty/.test(rs) ? 0 : resMax(r, pbc);
  }); f++; });
  return out;
}
// The editor: resource lines under each trait or action.
function fresEditorHtml(it) {
  return `<div class="sbres"><div class="fresl">${(it.res || []).map(itemResRowHtml).join("")}</div><button class="btn ghost small" type="button" data-act="sbresadd">+ Add a resource</button></div>`;
}
