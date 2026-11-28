// ---------- Summons & companions on the character sheet ----------
// c.summons = [{ id, ref, kind, name, sb, hp, temp, active, inv: { slots } }]
// The stat block is copied in. Each summon has a small inventory sized by its size:
// row 1 = equipped, row 2 = consumables, the rest = pack.
// A summon's picture: the form it's in, else its own (s.token, set with the picture button), else its creature's.
function smPic(s) { const f = s.form && S.entries.get(s.form); if (f && (f.token || f.image)) return f.token || f.image; if (s.token) return s.token; const e = s.ref && S.entries.get(s.ref); return e ? e.token || e.image || "" : ""; }
const smList = c => Array.isArray(c.summons) ? c.summons : [];
const smMax = s => parseInt(String((s.sb || {}).hp || "").match(/\d+/) || [0], 10) || 0;
const smCur = s => s.hp == null ? smMax(s) : Number(s.hp) || 0;
const SM = { open: null, pick: null, amt: {}, custom: null, abil: null };
// While shapeshifted into a "replace" form, the summon uses that form's stat block (with its own HP pool);
// its equipped gear still works on top. smView gives the summon as it currently stands.
function smView(s) { const f = typeof ssSummonForm === "function" && ssSummonForm(s); return f ? Object.assign({}, s, { sb: f.statblock, _form: f, _base: s.sb }) : s; }
const smFormMax = s => { const v = smView(s); return v._form ? smMax(v) : 0; };
const smNowMax = s => smView(s)._form ? smFormMax(s) : smMax(s);
const smNowCur = s => smView(s)._form ? (s.fhp == null ? smFormMax(s) : Number(s.fhp) || 0) : smCur(s);
const SM_SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
// Custom abilities: { name, kind: "attack" | "ability", hit, dmg, reach, text }
const smCustom = s => Array.isArray(s.abil) ? s.abil : [];
function smSize(s) { return sizeFromSubtitle((s._base || s.sb || {}).subtitle) || "Medium"; }
function smGrid(s) { const z = smSize(s); return z === "Tiny" ? { cols: 3, rows: 2 } : z === "Huge" ? { cols: 4, rows: 3 } : z === "Gargantuan" ? { cols: 5, rows: 3 } : { cols: 3, rows: 3 }; }
const smRowName = r => r === 0 ? "Equipped" : r === 1 ? "Consumables" : "Pack";
function smScore(s, a) { return parseInt(String((s.sb || {})[a] || "10"), 10) || 10; }
const smMod = (s, a) => Math.floor((smScore(s, a) - 10) / 2);
const smPB = s => parseInt(String((s.sb || {}).prof || sbAutoProf(s.sb || {}) || "+2").replace("−", "-"), 10) || 2;

// Actions from the stat block's markdown. "Basic" actions have no recharge or use limit.
function smActions(s) {
  const md = String((s.sb || {}).features || ""), out = [], traits = [];
  let sec = "";
  for (const block of md.split(/\n\s*\n/)) {
    const h = block.match(/^#{1,4}\s+(.+)/); if (h) { sec = h[1].trim(); continue; }
    const m = block.match(/^\*\*\*(.+?)\.?\*\*\*\s*([\s\S]*)$/); if (!m) continue;
    const full = m[1].trim(), text = m[2].replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim(), plain = text.replace(/[*_]/g, "");
    const tag = (full.match(/\(([^)]*)\)\s*$/) || [])[1] || "", name = full.replace(/\s*\([^)]*\)\s*$/, "");
    if (/trait/i.test(sec) || !sec) { traits.push({ name: full, text }); continue; }
    const atk = plain.match(/(Melee|Ranged|Melee or Ranged)\s+(Weapon|Spell)\s+Attack:\s*([+\-−]\s*\d+)\s*to hit/i);
    const save = plain.match(/DC\s*(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i);
    const dmgs = [...plain.matchAll(/\d+\s*\(([^)]+)\)\s+(\w+)\s+damage/gi)].map(d => d[1].replace(/\s+/g, "") + " " + d[2].toLowerCase());
    const reach = (plain.match(/(reach|range)\s+([\d/]+\s*ft\.?)/i) || [])[0] || "";
    out.push({ sec, name, tag, text, basic: !tag, attack: atk ? atk[3].replace(/\s+/g, "").replace("−", "-") : "", save: save ? `DC ${save[1]} ${save[2].slice(0, 3)}` : "", dmg: dmgs.join(" + "), reach, kind: atk ? atk[1] : "" });
  }
  return { actions: out, traits };
}
function smWeapon(s, e) {
  const it = e.item || {}, st = it.stats || {}, props = (it.props || []).map(p => p.id);
  const ranged = /ranged/i.test(it.category || "") || props.includes("ammunition");
  const ab = props.includes("finesse") ? (smMod(s, "dex") > smMod(s, "str") ? "dex" : "str") : ranged ? "dex" : "str";
  const mod = smMod(s, ab) + magicBonus(e), hit = mod + smPB(s);
  return { hit: signed(hit), dmg: st.damage ? `${st.damage}${mod ? (mod > 0 ? "+" : "−") + Math.abs(mod) : ""}` : "", type: st.dtype || "" };
}
// The summon's stat block with its equipped gear worked in: armour sets AC, weapons become actions.
function smEffectiveSb(s) {
  const sb = JSON.parse(JSON.stringify(s.sb || {})), slots = smSlots(s), g = smGrid(s);
  const eq = Array.from({ length: g.cols }, (_, k) => slots["r0c" + k]).filter(Boolean).map(x => invResolve(x.ref, x.name));
  if (!eq.length) return sb;
  const dex = smMod(s, "dex"), body = eq.find(r => isBodyArmour(r.e)), shields = eq.filter(r => invKind(r.e) === "armour" && !isBodyArmour(r.e));
  const natural = parseInt(String(sb.ac || ""), 10) || 10;
  if (body || shields.length) {
    let ac = natural, note = String(sb.ac || "").replace(/^\d+\s*/, "").replace(/^\(|\)$/g, "");
    if (body) { const st = (body.e.item || {}).stats || {}, base = parseInt(st.ac, 10) || 10, dx = st.dex ? Math.min(dex, String(st.dexMax || "").trim() ? Number(st.dexMax) : 99) : 0, worn = base + dx + magicBonus(body.e); if (worn >= ac) { ac = worn; note = body.name.toLowerCase(); } }
    shields.forEach(r => { ac += (parseInt(((r.e.item || {}).stats || {}).ac, 10) || 2) + magicBonus(r.e); note += (note ? ", " : "") + r.name.toLowerCase(); });
    sb.ac = ac + (note ? ` (${note})` : "");
  }
  const avg = (dice, mod) => { const m = String(dice || "").match(/(\d+)d(\d+)/); return m ? Math.max(1, Math.floor(Number(m[1]) * (Number(m[2]) + 1) / 2 + mod)) : ""; };
  const lines = eq.filter(r => invKind(r.e) === "weapon").map(r => {
    const it = r.e.item || {}, st = it.stats || {}, w = smWeapon(s, r.e), props = (it.props || []).map(p => p.id), ranged = /ranged/i.test(it.category || "") || props.includes("ammunition");
    const mod = parseInt(String(w.dmg).replace(/^[^+−-]*/, "").replace("−", "-"), 10) || 0, rng = st.range || ((it.props || []).find(p => p.id === "range" || p.id === "thrown") || {}).param || "";
    return `***${r.name}.*** *${ranged ? "Ranged" : "Melee"} Weapon Attack:* ${w.hit} to hit, ${ranged || rng ? `range ${rng || "80/320"} ft.` : `reach ${props.includes("reach") ? 10 : 5} ft.`}, one target. *Hit:* ${avg(st.damage, mod)} (${String(st.damage || "1").replace(/d/, "d")}${mod ? (mod > 0 ? " + " : " − ") + Math.abs(mod) : ""}) ${w.type || "bludgeoning"} damage.`;
  });
  if (lines.length) {
    const f = String(sb.features || "");
    sb.features = /##\s*Actions/i.test(f) ? f.replace(/(##\s*Actions[^\n]*\n)/i, "$1\n" + lines.join("\n\n") + "\n\n") : (f ? f + "\n\n" : "") + "## Actions\n\n" + lines.join("\n\n");
  }
  sb.details = [String(sb.details || "").trim(), "Equipment: " + eq.map(r => r.name).join(", ")].filter(Boolean).join("\n");
  return sb;
}
function smSlots(s) { return ((s.inv || {}).slots) || {}; }
function smAccepts(row, e) { return row === 1 ? isConsumable(e) : row === 0 ? !isConsumable(e) || invKind(e) !== "item" : true; }

function summonsViewHtml(c, id) {
  const P = canPlay(), list = smList(c), act = list.filter(s => s.active !== false), off = list.filter(s => s.active === false);
  const creatures = [...S.entries].filter(([, e]) => e.type === "creature" && e.statblock).sort((a, b) => byName(a[1].title, b[1].title));
  return `<section class="summons">
    ${P ? `<div class="smadd"><label><span class="sr">Creature to summon</span><input id="smq" type="text" list="smlist" placeholder="Copy a creature's stat block from the bestiary…" autocomplete="off"></label>
      <datalist id="smlist">${creatures.map(([, e]) => `<option value="${esc(e.title)}"></option>`).join("")}</datalist>
      <button class="btn" data-act="smadd">Add summon</button><button class="btn ghost" data-act="smnew">${SM.custom === "new" ? "Close" : "+ Custom summon"}</button></div>
      ${SM.custom === "new" ? smStatsFormHtml(null) : ""}` : ""}
    ${act.map(s => summonCardHtml(c, s, id, P)).join("")}
    ${!list.length ? `<div class="empty">No summons or companions yet.${P ? " Pick a creature above to copy its stat block here." : ""}</div>` : !act.length ? `<p class="muted">Nothing summoned right now.</p>` : ""}
    ${off.length ? `<h3 class="fgh">Dismissed <span>${off.length}</span></h3><div class="smoff">${off.map(s => `<div class="smoffrow"><b>${esc(s.name)}</b><span class="muted small">${esc(s.kind || "")} · ${smNowCur(s)}/${smNowMax(s)} HP${Object.keys(smSlots(s)).length ? ` · ${Object.keys(smSlots(s)).length} items` : ""}</span><span class="spacer"></span>${P ? `<button class="btn small" data-act="smtoggle" data-sm="${esc(s.id)}">Summon</button><button class="btn ghost small" data-act="smtok" data-sm="${esc(s.id)}" title="The picture used on the tabletop; without one it uses the creature's token">${s.token ? "Change token" : "Token picture"}</button><button class="btn ghost small" data-act="smrm" data-sm="${esc(s.id)}">Release</button>` : ""}</div>`).join("")}</div>` : ""}
  </section>`;
}
function summonCardHtml(c, s, cid, P) {
  const view = smView(s), formE = view._form || null;
  const max = smNowMax(s), cur = smNowCur(s), temp = Number(s.temp) || 0;
  const sbx = smEffectiveSb(view), { actions, traits } = smActions(Object.assign({}, s, { sb: sbx }));
  const cust = smCustom(s);
  const slots = smSlots(s), g = smGrid(s);
  const eq = Array.from({ length: g.cols }, (_, k) => slots["r0c" + k]).filter(Boolean).map(x => invResolve(x.ref, x.name)).filter(r => invKind(r.e) === "weapon");
  const quick = [...actions.filter(a => a.attack || a.save || a.dmg).sort((a, b) => (b.basic - a.basic))];
  const eqNames = new Set(eq.map(r => r.name));
  const atkRows = [
    ...cust.map((a, i) => ({ a, i })).filter(o => o.a.kind === "attack").map(({ a, i }) => `<tr class="smcustrow"><td><details class="smact"><summary>${esc(a.name)} <span class="smcust">custom</span></summary><div class="small">${a.text ? md(a.text, { noEmbed: true }) : `<span class="muted">No description.</span>`}</div></details>${a.reach ? `<div class="muted small">${esc(a.reach)}</div>` : ""}</td>
      <td class="num big">${esc(a.hit || "—")}</td><td>${diceify(esc(a.dmg || "—"))}</td></tr>`),
    ...quick.map(a => { const rk = RCH_RE.test(a.tag) ? rchKey(a.name) : "", lk = rk && (s.locked || []).includes(rk);
      return `<tr class="${a.basic ? "" : "limited"}${lk ? " rchrow" : ""}"${rk ? ` data-rchctx="sm:${esc(cid)}:${esc(s.id)}" data-rchkey="${esc(rk)}"` : ""}><td><details class="smact"><summary>${rk && P ? `<button type="button" class="rchmini" data-rch="${lk ? "off" : "on"}" aria-label="${lk ? "Unlock" : "Lock"} ${esc(a.name)}" title="${lk ? "Recharged: unlock" : "Used: lock until it recharges"}">${lk ? "🔓" : "🔒"}</button>` : ""}${esc(a.name)}${formE && !eqNames.has(a.name) ? ` <span class="ssbadge">${esc(formE.title)}</span>` : ""}${eqNames.has(a.name) ? ` <span class="smbasic">equipped</span>` : a.basic ? ` <span class="smbasic">basic</span>` : ` <span class="smtag">${esc(a.tag)}</span>`}</summary><div class="small">${md(a.text, { noEmbed: true })}</div></details>${a.reach ? `<div class="muted small">${esc(a.reach)}</div>` : ""}</td>
      <td class="num big">${esc(a.attack || a.save || "—")}</td><td>${diceify(esc(a.dmg || "—"))}</td></tr>`; })];
  const other = actions.filter(a => !(a.attack || a.save || a.dmg));
  const slot = (r, k) => {
    const key = `r${r}c${k}`, it = slots[key];
    if (!it) return `<button class="islot empty smslot${SM.pick && SM.pick.sid === s.id && SM.pick.k === key ? " sel" : ""}" data-act="smslot" data-sm="${esc(s.id)}" data-k="${key}" aria-label="Empty ${smRowName(r).toLowerCase()} slot"${P ? "" : " disabled"}></button>`;
    const rr = invResolve(it.ref, it.name), e = rr.e, kind = invKind(e), hv = isHarvest(e);
    return `<button class="islot k-${kind}${hv ? " harvest" : ""} smslot${SM.pick && SM.pick.sid === s.id && SM.pick.k === key ? " sel" : ""}" data-act="smslot" data-sm="${esc(s.id)}" data-k="${key}" title="${esc(rr.name)}" aria-label="${esc(rr.name)}${Number(it.qty) > 1 ? ", " + it.qty : ""}">
      <span class="iico" aria-hidden="true">${hv ? "✦" : isConsumable(e) && kind === "item" ? "⚗" : INV_ICON[kind]}</span><span class="iname">${esc(rr.name)}</span>${Number(it.qty) > 1 ? `<span class="iqty">×${it.qty}</span>` : ""}</button>`;
  };
  const pickOpen = P && SM.pick && SM.pick.sid === s.id;
  return `<article class="summon${formE ? " shifted" : ""}${s.ref ? "" : " custom"}" data-sm="${esc(s.id)}">
    <header class="smhead">
      ${(() => { const src = smPic(s); return P ? `<button type="button" class="smpic" data-act="smtok" data-sm="${esc(s.id)}" title="${src ? "Change its picture (used on the tabletop too)" : "Add a picture (used on the tabletop too)"}">${src ? `<img src="${esc(src)}" alt="">` : `<span>＋<small>Picture</small></span>`}</button>` : src ? `<span class="smpic"><img src="${esc(src)}" alt=""></span>` : ""; })()}
      ${P ? `<input class="smname" type="text" value="${esc(s.name)}" data-smname="${esc(s.id)}" aria-label="Summon's name">` : `<h2 class="smname">${esc(s.name)}</h2>`}
      <span class="muted small">${s.ref ? esc(s.kind || "") : ""}${(s.sb || {}).subtitle ? (s.ref ? " · " : "") + esc(s.sb.subtitle) : ""}${formE ? ` · <span class="ssbadge">in ${esc(formE.title)} form</span>` : ""}${s.ref ? "" : ` <span class="smcust">custom summon</span>`}</span>
      <span class="spacer"></span>
      ${P ? `<button class="smtoggle on" data-act="smtoggle" data-sm="${esc(s.id)}" role="switch" aria-checked="true" title="Dismiss">Summoned</button>
        ${s.ref ? "" : `<button class="btn ghost small" data-act="smedit" data-sm="${esc(s.id)}">${SM.custom === s.id ? "Close stats" : "Edit stats"}</button>`}${s.ref && S.entries.has(s.ref) ? `<button class="btn ghost small" data-act="smrefresh" data-sm="${esc(s.id)}" title="Copy the bestiary's current stat block again">Recopy</button>` : ""}<button class="btn ghost small" data-act="smrm" data-sm="${esc(s.id)}">Release</button>` : ""}
    </header>
    ${SM.custom === s.id && P ? smStatsFormHtml(s) : ""}
    <div class="smglow"><div class="smbody">
      <div class="smleft">
        <div class="hpbox smhpbox"><div class="hpnums"><div><span class="vl">Hit points${formE ? " · form" : ""}</span><strong class="hpcur">${cur}<small> / ${max}</small></strong></div><div><span class="vl">Temporary</span><strong>${temp}</strong></div>
          <div><span class="vl">AC</span><strong title="${esc(sbx.ac || "")}">${esc(String(sbx.ac || "—").split(" ")[0])}</strong></div><div><span class="vl">Speed</span><strong class="smspd">${esc(sbx.speed || "—")}</strong></div></div>
          ${hpBar({ hp: { max, cur, temp } })}
          ${P ? `<div class="hpctl"><input type="text" inputmode="numeric" placeholder="Amount" aria-label="Amount" data-smamt="${esc(s.id)}" value="${esc(SM.amt[s.id] || "")}">
            <button class="btn danger" data-act="smhp" data-sm="${esc(s.id)}" data-v="dmg">Damage</button><button class="btn" data-act="smhp" data-sm="${esc(s.id)}" data-v="heal">Heal</button><button class="btn ghost" data-act="smhp" data-sm="${esc(s.id)}" data-v="temp">Temp HP</button></div>` : ""}</div>
        ${ssSummonHtml(s, P)}
        <h3 class="fgh">Quick attacks</h3>
        ${atkRows.length ? `<table class="atks smatks"><thead><tr><th>Attack</th><th>Hit / DC</th><th>Damage</th></tr></thead><tbody>${atkRows.join("")}</tbody></table>` : `<p class="muted small">No attacks in the stat block.</p>`}
        ${smResHtml(s, P)}${smConsHtml(s, P)}
        ${other.length || traits.length || cust.some(a => a.kind !== "attack") ? `<h3 class="fgh">Abilities</h3><div class="eqitems">${[...cust.filter(a => a.kind !== "attack").map(a => ({ name: a.name, text: a.text || "", cls: "cust" })), ...traits.map(t => ({ name: t.name, text: t.text, cls: "trait" })), ...other.map(a => ({ name: a.name + (a.tag ? ` (${a.tag})` : ""), text: a.text, cls: "act" }))].map(t => `<details class="eqchip smab ${t.cls}"><summary>${esc(t.name)}</summary><div class="eqpop small">${md(t.text, { noEmbed: true })}</div></details>`).join("")}</div>` : ""}
        ${smCustomHtml(s, P)}
        <details class="smfull"><summary>Full stat block${formE ? ` (${esc(formE.title)} form)` : ""}</summary>${statBlockHtml(sbx, formE ? formE.title : s.name, "core")}${sbx.features ? featuresHtml(sbx, s.ref || "", `sm:${cid}:${s.id}`) : ""}</details>
      </div>
      <div class="smright">
        <h3 class="fgh">Inventory <span class="muted small">${esc(smSize(s))}</span></h3>
        <div class="sminv">${Array.from({ length: g.rows }, (_, r) => `<div class="smrow"><span class="smrowlab">${smRowName(r)}</span><div class="smrowslots" style="grid-template-columns:repeat(${g.cols},1fr)">${Array.from({ length: g.cols }, (_, k) => slot(r, k)).join("")}</div></div>`).join("")}</div>
        ${pickOpen ? smPickerHtml(c, s, cid) : `<p class="muted small">${P ? "Click a slot to give this summon an item from " + esc(c.name || "the character") + "'s inventory." : ""}</p>`}
      </div>
    </div></div>
  </article>`;
}
function smPickerHtml(c, s, cid) {
  const key = SM.pick.k, row = Number(key[1]), it = smSlots(s)[key];
  if (it) {
    const rr = invResolve(it.ref, it.name), cons = isConsumable(rr.e);
    return `<div class="smpick"><b>${esc(rr.name)}</b>${Number(it.qty) > 1 ? ` ×${it.qty}` : ""}
      <div class="acts">${cons ? `<button class="btn small" data-act="smuse" data-sm="${esc(s.id)}" data-k="${key}">Use one</button>` : ""}<button class="btn small" data-act="smgiveback" data-sm="${esc(s.id)}" data-k="${key}">Give back to ${esc(c.name || "character")}</button>${rr.id ? `<a class="btn ghost small" href="#entry-${esc(rr.id)}">Open</a>` : ""}<button class="btn ghost small" data-act="smdrop" data-sm="${esc(s.id)}" data-k="${key}">Throw away</button><button class="btn ghost small" data-act="smslot" data-sm="${esc(s.id)}" data-k="${key}">Close</button></div></div>`;
  }
  const inv = invOf(c), bag = Object.keys(inv.slots).filter(isGridKey).map(k => ({ k, s: inv.slots[k], r: invResolve(inv.slots[k].ref, inv.slots[k].name) })).filter(o => smAccepts(row, o.r.e));
  return `<div class="smpick"><b>${smRowName(row)} slot</b> <span class="muted small">${row === 1 ? "consumables only" : row === 0 ? "weapons, armour and gear" : "anything"}</span>
    ${bag.length ? `<ul class="smbag">${bag.map(o => `<li><button class="linkbtn" data-act="smgive" data-sm="${esc(s.id)}" data-k="${key}" data-from="${o.k}">${INV_ICON[invKind(o.r.e)]} ${esc(o.r.name)}${Number(o.s.qty) > 1 ? ` ×${o.s.qty}` : ""}</button></li>`).join("")}</ul>` : `<p class="muted small">Nothing in ${esc(c.name || "the character")}'s inventory fits here.</p>`}
    <div class="acts"><button class="btn ghost small" data-act="smslot" data-sm="${esc(s.id)}" data-k="${key}">Close</button></div></div>`;
}

// Resource lines on the summon's equipped items, and its consumables, shown on its card.
const smEqKeys = s => Array.from({ length: smGrid(s).cols }, (_, k) => "r0c" + k);
const smPbc = s => fresPbOf(smView(s).sb);
function smItemHave(s, ref, k, r) { const v = ((s.itemRes || {})[ref] || [])[k], pbc = smPbc(s); if (v == null) return itemResStart(r, pbc); const n = Math.max(0, Number(v) || 0); return resIsCounter(r) ? n : Math.min(resMax(r, pbc), n); }
function smItemSet(s, ref, k, r, v) { const pbc = smPbc(s); s.itemRes = Object.assign({}, s.itemRes); const a = (s.itemRes[ref] || []).slice(); a[k] = Math.max(0, resIsCounter(r) ? Math.round(v) : Math.min(resMax(r, pbc), v)); s.itemRes[ref] = a; }
function smRest(s, long) {
  rechargeItems(s, long);
  const pbc = smPbc(s);
  equippedResItems(s, smEqKeys(s)).forEach(it => it.lines.forEach((r, k) => { if (!resValid(r)) return; const rs = r.reset || "long"; if (/^short/.test(rs) || (long && /^long/.test(rs))) smItemSet(s, it.ref, k, r, resIsCounter(r) || /empty/.test(rs) ? 0 : resMax(r, pbc)); }));
  s.fres = fresRest(s.fres || {}, smView(s).sb, long);
  (s.res || []).forEach(r => { const rs = r.reset || "long"; if (rs === "none" || !(long || rs === "short")) return; if (resIsCounter(r)) r.count = 0; else r.used = 0; });
  return s;
}
// A summon's own resources (s.res, like a character's: name, max, shown as boxes / a slider / a counter, colour, reset),
// with the summon's proficiency bonus for "= proficiency bonus".
function smOwnRes(s, P) {
  const pbc = smPbc(s), list = s.res || [];
  return list.map((r, k) => { if (!resValid(r)) return ""; const have = charResHave(pbc, r), m = resMax(r, pbc), a = `data-sm="${esc(s.id)}" data-k="${k}"`;
    const ctl = resIsCounter(r) ? resCounterHtml(have, r.color, "", P ? `data-act="smrsadj" ${a} data-v` : "")
      : r.style === "slider" ? resBarHtml(have, m, r.color, "", P ? { adj: `<span class="spadj"><button class="iconbtn" data-act="smrsadj" ${a} data-v="-1" aria-label="Spend one">−</button><button class="iconbtn" data-act="smrsadj" ${a} data-v="1" aria-label="Gain one">+</button></span>`, bar: `data-act="smrsbar" ${a}` } : null)
      : resPipsHtml(have, m, r.color, P ? j => `data-act="smrspip" ${a} data-j="${j}" aria-label="${esc(r.name)} ${j + 1}"` : null);
    return `<div class="fresline"><span class="fresname">${esc(r.name)} <small class="muted">${esc(resResetText(r))}${r.amt === "pb" ? " · = proficiency bonus" : ""}</small></span>${ctl}</div>`; }).join("");
}
function smResInput(t) {
  const sh = t.closest(".sheet"), id = sh && sh.dataset.id; if (!id) return; const sid = t.dataset.smres, k = Number(t.dataset.k), key = t.dataset.f, v = t.value;
  charChange(id, x => { x.summons = smList(x).map(s => { if (s.id !== sid) return s; s = JSON.parse(JSON.stringify(s)); const r = (s.res || [])[k]; if (!r) return s;
    if (key === "max") r.max = Math.max(1, Math.min(999, Number(v) || 1)); else r[key] = v; if (key === "style" && v === "counter") r.count = 0; return s; }); }, false);
  if (t.tagName === "SELECT") setTimeout(render, 0);
}
function smResEditHtml(s) {
  const list = s.res || [], f = (k, key, v, extra) => `data-smres="${esc(s.id)}" data-k="${k}" data-f="${key}"${extra || ""}`;
  return `<div class="smresedit">${list.map((r, k) => `<div class="frow tight smresrow"><label class="grow"><span>Name</span><input type="text" ${f(k, "name")} value="${esc(r.name || "")}" placeholder="e.g. Breath weapon"></label>
      ${resIsCounter(r) ? "" : `<label><span>Amount</span><select ${f(k, "amt")}><option value=""${r.amt === "pb" ? "" : " selected"}>Number</option><option value="pb"${r.amt === "pb" ? " selected" : ""}>Prof. bonus</option></select></label>${r.amt === "pb" ? "" : `<label><span>Max</span><input type="number" min="1" max="999" class="mini" ${f(k, "max")} value="${esc(r.max || "")}"></label>`}`}
      <label><span>Shown as</span><select ${f(k, "style")}>${RES_STYLES.map(([v, l]) => `<option value="${v}"${(r.style || "box") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label><span>Colour</span><input type="color" ${f(k, "color")} value="${esc(resColor(r.color))}"></label>
      <label><span>${resIsCounter(r) ? "Back to 0 on" : "Resets on"}</span><select ${f(k, "reset")}><option value="short"${r.reset === "short" ? " selected" : ""}>Short rest</option><option value="long"${!r.reset || r.reset === "long" ? " selected" : ""}>Long rest</option><option value="none"${r.reset === "none" ? " selected" : ""}>Never</option></select></label>
      <button type="button" class="iconbtn" data-act="smrsdel" data-sm="${esc(s.id)}" data-k="${k}" aria-label="Remove ${esc(r.name || "this resource")}">✕</button></div>`).join("")}
    <div class="acts"><button type="button" class="btn ghost small" data-act="smrsadd" data-sm="${esc(s.id)}">+ Add resource</button><button type="button" class="btn small" data-act="smrsedit" data-sm="${esc(s.id)}">Done</button></div></div>`;
}
function smResHtml(s, P) {
  const items = equippedResItems(s, smEqKeys(s)), own = smOwnRes(s, P), editing = P && SM.resEdit === s.id;
  if (!items.length && !own && !editing) return P ? `<div class="smresadd"><button type="button" class="btn ghost small" data-act="smrsedit" data-sm="${esc(s.id)}">+ Resources</button></div>` : "";
  const pbc = smPbc(s), rows = own ? [own] : [];
  items.forEach(it => it.lines.forEach((r, k) => {
    if (!resValid(r)) return;
    const have = smItemHave(s, it.ref, k, r), m = resMax(r, pbc), a = `data-sm="${esc(s.id)}" data-ref="${esc(it.ref)}" data-k="${k}"`;
    const ctl = resIsCounter(r) ? resCounterHtml(have, r.color, "", P ? `data-act="smires" ${a} data-v` : "")
      : r.style === "slider" ? resBarHtml(have, m, r.color, "", P ? { adj: `<span class="spadj"><button class="iconbtn" data-act="smires" ${a} data-v="-1" aria-label="Spend one">−</button><button class="iconbtn" data-act="smires" ${a} data-v="1" aria-label="Gain one">+</button></span>`, bar: `data-act="smiresbar" ${a}` } : null)
      : resPipsHtml(have, m, r.color, P ? j => `data-act="smirespip" ${a} data-j="${j}" aria-label="${esc(r.name)} ${j + 1}"` : null);
    rows.push(`<div class="fresline"><span class="fresname">${esc(r.name)} <small class="muted">${esc(it.name)} · ${esc(resResetText(r))}</small></span>${ctl}</div>`);
  }));
  return `<h3 class="fgh">Resources${P && !editing ? ` <button type="button" class="linkbtn small" data-act="smrsedit" data-sm="${esc(s.id)}">Edit</button>` : ""}</h3>${rows.length ? `<div class="fres live smres">${rows.join("")}</div>` : ""}${editing ? smResEditHtml(s) : ""}`;
}
function smConsHtml(s, P) {
  const slots = smSlots(s), g = smGrid(s), keys = Array.from({ length: g.cols }, (_, k) => "r1c" + k).filter(k => slots[k]);
  if (!keys.length) return "";
  return `<h3 class="fgh">⚗ Consumables</h3><div class="eqitems">${keys.map(k => {
    const t = slots[k], r = invResolve(t.ref, t.name), u = useInfo((r.e || {}).item) || { type: "single", uses: 1, recharge: "none" }, left = slotLeft(t, u), qty = Number(t.qty) || 1;
    const pips = u.type === "reusable" ? `<span class="cpips" aria-label="${left} of ${u.uses} charges">${Array.from({ length: Math.min(u.uses, 10) }, (_, j) => `<i class="${j < left ? "on" : ""}"></i>`).join("")}</span>` : "";
    const btn = !P ? "" : u.type === "reusable" && !left ? `<button class="btn small" disabled>Out of charges</button>` : `<button class="btn small" data-act="smuse" data-sm="${esc(s.id)}" data-k="${k}">${u.type === "reusable" ? "Use a charge" : "Use one"}</button>`;
    return `<details class="eqchip potion${u.type === "reusable" && !left ? " spent" : ""}"><summary title="${esc(r.name)}">${esc(r.name)}${qty > 1 ? `<b class="pq">×${qty}</b>` : ""}${pips}</summary>
      <div class="eqpop">${r.src === "gone" ? "" : itemPageHtml(r.id || "", r.e).replace(/<div class="iimg"><button[^>]*data-act="(addlore|portrait)"[^>]*>[^<]*<\/button><\/div>/g, "")}<p class="eqpopacts">${btn}</p></div></details>`;
  }).join("")}</div>`;
}
function summonAction(a, el, id, c) {
  const sid = el.dataset.sm, upd = fn => charChange(id, x => { x.summons = smList(x).map(s => s.id === sid ? fn(JSON.parse(JSON.stringify(s)), x) || s : s); });
  if (a === "smadd") {
    const q = ($("#smq") || {}).value || "", hit = [...S.entries].find(([, e]) => e.type === "creature" && e.statblock && e.title.toLowerCase() === q.trim().toLowerCase());
    if (!hit) { toast(q.trim() ? `No creature with a stat block called “${q.trim()}”.` : "Pick a creature first.", "bad"); return; }
    const [ref, e] = hit, s = { id: "s" + Date.now().toString(36), ref, kind: e.title, name: e.title, sb: JSON.parse(JSON.stringify(e.statblock)), active: true, inv: { slots: {} } };
    s.hp = smMax(s);
    charChange(id, x => { x.summons = [...smList(x), s]; });
    toast(`Added ${e.title}. Click its name to rename it.`);
  } else if (a === "smrm") {
    if (!confirmInline(el)) return;
    const s = smList(c).find(x => x.id === sid);
    charChange(id, x => {
      // Anything the summon carried goes back to the character.
      const back = Object.values(smSlots(s || {}));
      const v = invOf(x); back.forEach(it => { const k = Array.from({ length: v.cols * v.rows }, (_, n) => String(n)).find(n => !v.slots[n]); if (k) v.slots[k] = it; });
      x.inv = v; x.summons = smList(x).filter(t => t.id !== sid);
    });
    toast("Released. Its items went back to the inventory.");
  } else if (a === "smrsedit") { SM.resEdit = SM.resEdit === sid ? null : sid; render();
  } else if (a === "smrsadd") { upd(s => { s.res = (s.res || []).concat([{ name: "", max: 2, style: "box", reset: "long", used: 0 }]); return s; });
  } else if (a === "smrsdel") { const k = Number(el.dataset.k); upd(s => { s.res = (s.res || []).filter((_, i) => i !== k); return s; });
  } else if (a === "smrsadj" || a === "smrspip" || a === "smrsbar") { const k = Number(el.dataset.k);
    upd(s => { const r = (s.res || [])[k]; if (!r) return s; const pbc = smPbc(s), have = charResHave(pbc, r), j = Number(el.dataset.j);
      charResSet(pbc, r, a === "smrsbar" ? barValue(el, window.event || {}, resMax(r, pbc)) : a === "smrsadj" ? have + Number(el.dataset.v) : (j < have ? j : j + 1)); return s; });
  } else if (a === "smtok") {
    pickImage(async res => { upd(s => { s.token = assetPath(res); return s; }); });
  } else if (a === "smtoggle") {
    upd(s => { s.active = s.active === false; return s; });
  } else if (a === "smrefresh") {
    upd(s => { const e = S.entries.get(s.ref); if (e && e.statblock) { s.sb = JSON.parse(JSON.stringify(e.statblock)); s.kind = e.title; } return s; });
    toast("Stat block recopied");
  } else if (a === "smhp") {
    const amt = Math.abs(parseInt(SM.amt[sid], 10)); if (!amt) { toast("Type an amount first.", "bad"); return; }
    SM.amt[sid] = "";
    let reverted = "";
    upd(s => { let temp = Number(s.temp) || 0;
      const shifted = !!smView(s)._form;
      if (el.dataset.v === "temp") { s.temp = Math.max(temp, amt); return s; }
      if (el.dataset.v === "dmg") {
        const t = Math.min(temp, amt); temp -= t; let left = amt - t; s.temp = temp;
        if (shifted) {
          const fc = smNowCur(s); if (left < fc) { s.fhp = fc - left; return s; }
          // The form drops to 0: back to true form, and the rest of the damage carries over.
          left -= fc; reverted = smView(s)._form.title; s.form = ""; s.fhp = null;
        }
        s.hp = Math.max(0, smCur(s) - left); return s;
      }
      if (shifted) s.fhp = Math.min(smFormMax(s), smNowCur(s) + amt); else s.hp = Math.min(smMax(s), smCur(s) + amt);
      return s; });
    if (reverted) toast(`The ${reverted} form dropped to 0 hit points, so it's back in its true form. Leftover damage carried over.`);
  } else if (a === "smslot") {
    const k = el.dataset.k; SM.pick = SM.pick && SM.pick.sid === sid && SM.pick.k === k ? null : { sid, k }; render();
  } else if (a === "smgive") {
    const k = el.dataset.k, from = el.dataset.from, v = invOf(c), it = v.slots[from]; if (!it) return;
    charChange(id, x => { const iv = invOf(x), item = iv.slots[from]; if (!item) return; delete iv.slots[from]; x.inv = iv;
      x.summons = smList(x).map(s => s.id === sid ? Object.assign({}, s, { inv: { slots: Object.assign({}, smSlots(s), { [k]: item }) } }) : s); });
    SM.pick = null;
  } else if (a === "smgiveback" || a === "smdrop") {
    const k = el.dataset.k;
    charChange(id, x => {
      const s = smList(x).find(t => t.id === sid), item = s && smSlots(s)[k]; if (!item) return;
      if (a === "smgiveback") { const iv = invOf(x), free = Array.from({ length: iv.cols * iv.rows }, (_, n) => String(n)).find(n => !iv.slots[n]); if (!free) { toast("The inventory is full.", "bad"); return; } iv.slots[free] = item; x.inv = iv; }
      const sl = Object.assign({}, smSlots(s)); delete sl[k];
      x.summons = smList(x).map(t => t.id === sid ? Object.assign({}, t, { inv: { slots: sl } }) : t);
    });
    SM.pick = null;
  } else if (a === "smnew") {
    SM.custom = SM.custom === "new" ? null : "new"; render();
  } else if (a === "smedit") {
    SM.custom = SM.custom === sid ? null : sid; render();
  } else if (a === "smsave") {
    const f = el.closest(".smstats"), v = k => (f.querySelector(`[data-f="${k}"]`) || {}).value || "";
    const name = v("name").trim(); if (!name) { toast("Give the summon a name.", "bad"); return; }
    const sb = { subtitle: [v("size"), v("type").trim()].filter(Boolean).join(" "), ac: v("ac").trim(), hp: v("hp").trim(), speed: v("speed").trim() };
    ["str", "dex", "con", "int", "wis", "cha"].forEach(k => { if (v(k).trim()) sb[k] = v(k).trim(); });
    if (v("prof").trim()) sb.prof = v("prof").trim();
    if (f.dataset.sm) {
      upd(s => { const full = smCur(s) >= smMax(s); s.sb = Object.assign({}, s.sb || {}, sb); s.name = name; s.kind = v("type").trim() || "Custom"; s.hp = full ? smMax(s) : Math.min(smCur(s), smMax(s)); return s; });
    } else {
      const s = { id: "s" + Date.now().toString(36), ref: null, kind: v("type").trim() || "Custom", name, sb, active: true, inv: { slots: {} }, abil: [] };
      s.hp = smMax(s);
      charChange(id, x => { x.summons = [...smList(x), s]; });
      toast(`Added ${name}. Give it abilities under “Custom abilities”.`);
    }
    SM.custom = null;
  } else if (a === "smabil") {
    SM.abil = SM.abil === sid ? null : sid; render();
  } else if (a === "smabilsave") {
    const f = el.closest(".smabilform"), v = k => (f.querySelector(`[data-f="${k}"]`) || {}).value || "";
    const ab = { name: v("name").trim(), kind: v("kind"), hit: v("hit").trim(), dmg: v("dmg").trim(), reach: v("reach").trim(), text: v("text").trim() };
    if (!ab.name) { toast("Give the ability a name.", "bad"); return; }
    if (ab.hit && /^\d+$/.test(ab.hit)) ab.hit = "+" + ab.hit;
    const k = f.dataset.k;
    upd(s => { const list = smCustom(s).slice(); if (k !== "" && k != null && list[k]) list[k] = ab; else list.push(ab); s.abil = list; return s; });
    SM.abil = null;
  } else if (a === "smabiledit") {
    SM.abil = sid + ":" + el.dataset.k; render();
  } else if (a === "smabildel") {
    if (!confirmInline(el)) return;
    const k = Number(el.dataset.k); upd(s => { s.abil = smCustom(s).filter((_, i) => i !== k); return s; });
  } else if (a === "smuse") {
    const k = el.dataset.k; let msg = "";
    upd(s => { msg = useConsumable(s, k); if (!smSlots(s)[k] && SM.pick && SM.pick.k === k) SM.pick = null; return s; });
    if (msg) toast(msg);
  } else if (a === "smires" || a === "smiresbar" || a === "smirespip") {
    const ref = el.dataset.ref, k = Number(el.dataset.k), s0 = smList(c).find(x => x.id === sid), it = s0 && equippedResItems(s0, smEqKeys(s0)).find(i => i.ref === ref), r = it && it.lines[k]; if (!r) return;
    upd(s => { const have = smItemHave(s, ref, k, r), j = Number(el.dataset.j); smItemSet(s, ref, k, r, a === "smiresbar" ? barValue(el, window.event, resMax(r, smPbc(s))) : a === "smires" ? have + Number(el.dataset.v) : (j < have ? j : j + 1)); return s; });
  }
}
document.addEventListener("input", ev => { const t = ev.target; if (t.dataset && t.dataset.smamt) SM.amt[t.dataset.smamt] = t.value; });
document.addEventListener("change", ev => {
  const t = ev.target; if (!t.dataset || !t.dataset.smname) return;
  const sheet = document.querySelector(".sheet"), id = sheet && sheet.dataset.id, v = t.value.trim(); if (!id || !v) return;
  charChange(id, x => { x.summons = smList(x).map(s => s.id === t.dataset.smname ? Object.assign({}, s, { name: v }) : s); }, false);
});

// Stats form for a custom summon (new, or editing one that isn't from the bestiary).
function smStatsFormHtml(s) {
  const sb = (s && s.sb) || {}, size = sizeFromSubtitle(sb.subtitle) || "Medium", type = String(sb.subtitle || "").replace(/^\s*(tiny|small|medium|large|huge|gargantuan)\s*/i, "");
  const f = (k, lab, val, ph, cls) => `<label${cls ? ` class="${cls}"` : ""}><span>${lab}</span><input type="text" data-f="${k}" value="${esc(val || "")}" placeholder="${esc(ph || "")}"></label>`;
  return `<div class="smstats"${s ? ` data-sm="${esc(s.id)}"` : ""}><h3 class="fgh">${s ? "Edit stats" : "New custom summon"}</h3>
    <div class="frow">${f("name", "Name", s ? s.name : "", "e.g. Spirit Wolf", "grow")}
      <label><span>Size</span><select data-f="size">${SM_SIZES.map(z => `<option${z === size ? " selected" : ""}>${z}</option>`).join("")}</select></label>
      ${f("type", "Creature type", type, "e.g. fey, celestial spirit", "grow")}</div>
    <div class="frow">${f("ac", "Armour Class", sb.ac, "13 (natural armour)")}${f("hp", "Hit Points", sb.hp, "30 (4d8 + 12)")}${f("speed", "Speed", sb.speed, "40 ft.", "grow")}${f("prof", "Proficiency", sb.prof, "+2")}</div>
    <div class="frow smabs">${["str", "dex", "con", "int", "wis", "cha"].map(k => f(k, k.toUpperCase(), sb[k], "10", "mini")).join("")}</div>
    <p class="muted small">Add its attacks and abilities under “Custom abilities” on its card.</p>
    <div class="acts"><button class="btn" data-act="smsave"${s ? ` data-sm="${esc(s.id)}"` : ""}>${s ? "Save stats" : "Add custom summon"}</button><button class="btn ghost" data-act="${s ? "smedit" : "smnew"}"${s ? ` data-sm="${esc(s.id)}"` : ""}>Cancel</button></div></div>`;
}
// Custom abilities on any summon: listed, plus an add/edit form.
function smCustomHtml(s, P) {
  const list = smCustom(s), open = SM.abil && String(SM.abil).split(":")[0] === s.id, k = open && String(SM.abil).includes(":") ? Number(String(SM.abil).split(":")[1]) : null;
  const cur = k != null ? list[k] || {} : {};
  const f = (key, lab, ph, cls) => `<label${cls ? ` class="${cls}"` : ""}><span>${lab}</span><input type="text" data-f="${key}" value="${esc(cur[key] || "")}" placeholder="${esc(ph)}"></label>`;
  if (!P && !list.length) return "";
  return `<div class="smcustbox"><h3 class="fgh">Custom abilities${list.length ? ` <span>${list.length}</span>` : ""}</h3>
    ${list.length ? `<ul class="smcustlist">${list.map((a, i) => `<li><span class="smcust">${a.kind === "attack" ? "attack" : "ability"}</span><b>${esc(a.name)}</b>${a.hit ? ` <span class="muted small">${esc(a.hit)}</span>` : ""}${a.dmg ? ` <span class="muted small">${esc(a.dmg)}</span>` : ""}${P ? `<span class="spacer"></span><button class="btn ghost small" data-act="smabiledit" data-sm="${esc(s.id)}" data-k="${i}">Edit</button><button class="btn ghost small" data-act="smabildel" data-sm="${esc(s.id)}" data-k="${i}" aria-label="Remove ${esc(a.name)}">✕</button>` : ""}</li>`).join("")}</ul>` : ""}
    ${P && open ? `<div class="smabilform" data-k="${k != null ? k : ""}">
      <div class="frow">${f("name", "Name", "e.g. Pounce", "grow")}<label><span>Kind</span><select data-f="kind"><option value="attack"${cur.kind !== "ability" ? " selected" : ""}>Attack (quick attacks)</option><option value="ability"${cur.kind === "ability" ? " selected" : ""}>Ability</option></select></label></div>
      <div class="frow">${f("hit", "To hit or save", "+5 or DC 13 Dex")}${f("dmg", "Damage", "2d6+3 piercing", "grow")}${f("reach", "Reach or range", "reach 5 ft.")}</div>
      <label><span>Description</span><textarea data-f="text" rows="3" placeholder="What it does.">${esc(cur.text || "")}</textarea></label>
      <div class="acts"><button class="btn small" data-act="smabilsave" data-sm="${esc(s.id)}">${k != null ? "Save ability" : "Add ability"}</button><button class="btn ghost small" data-act="smabil" data-sm="${esc(s.id)}">Cancel</button></div></div>`
      : P ? `<button class="btn ghost small" data-act="smabil" data-sm="${esc(s.id)}">+ Add a custom ability</button>` : ""}</div>`;
}
