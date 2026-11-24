// ---------- Virtual tabletop ----------
// Collections:
//   vttcamps/<id>  { name, created, playerPage }                      a campaign; playerPage is the page players see
//   vttpages/<id>  { camp, name, order, w, h, bg, grid, light, fogMem, objs: [image], walls: [[x1,y1,x2,y2]] }
//                  image: { id, layer: "map"|"gm"|"token", img, x, y, w, h }      all sizes in grid squares
//   vtttokens/<id> { page, layer: "token"|"gm", x, y, size, img, name, ref, owner }  ref "e:<entry>" / "c:<character>"
//   vttfog/<page>  { w, h, res, bits }                                 squares players' tokens have seen (base64)
// Players only receive what's on the map and token layers; they can drag tokens owned by a character and add to the fog.
const VCELL = 70, VFOG_RES = 4;
const VTT = { multi: new Set(), lvl: 0, mshape: "line", mbeam: 5, meas: null, camp: null, page: null, layer: "token", tool: "select", zoom: 1, panX: 40, panY: 40, sel: null, draft: null, hover: null, preview: false, fogBits: null, fogKey: "", fogTimer: 0, mountedKey: "", fitDone: "" };
const vid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const vPages = camp => [...(S.vttPages || new Map())].filter(([, p]) => p.camp === camp).sort((a, b) => (a[1].order || 0) - (b[1].order || 0) || String(a[1].name).localeCompare(b[1].name));
const vTokens = page => [...(S.vttTokens || new Map())].filter(([, t]) => t.page === page);
const vCanEdit = () => !READONLY;
const vPlayerTok = t => !!(t && t.owner && t.layer !== "gm" && S.chars.get(t.owner) && !S.chars.get(t.owner).hidden);
const vTokenImg = ref => {
  if (!ref) return "";
  if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)); if (e) return e.token || e.image || ""; const t = [...S.vttTokens.values()].find(x => x.ref === ref && x.npc); return t ? t.npc.img || "" : ""; }
  if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)); if (c) return c.token || c.image || ""; const t = [...S.vttTokens.values()].find(x => x.ref === ref && x.npc); return t ? t.npc.img || "" : ""; }
  if (ref.startsWith("s:")) {
    // A summon: the creature it has shapeshifted into, else its own token picture, else its creature's.
    const sm = vSummonOf(ref); if (!sm) return "";
    const f = sm.form && S.entries.get(sm.form); if (f) return f.token || f.image || "";
    if (sm.token) return sm.token;
    const e = sm.ref && S.entries.get(sm.ref); return e ? (e.token || e.image || "") : "";
  }
  return "";
};
const vSummonOf = ref => { const [, cid, sid] = String(ref).split(":"), c = S.chars.get(cid); return c ? smList(c).find(x => x.id === sid) || null : null; };
// What a token looks like right now: a creature token in another form shows that form.
function vTokSrc(t) {
  if ((t.ref || "").startsWith("s:") && !t.img) { const sm = vSummonOf(t.ref), f = sm && sm.form && typeof ssSummonForm === "function" && S.entries.get(sm.form); if (f && (f.token || f.image)) return f.token || f.image; }
  const f = t.form && S.entries.get(t.form); return f ? (f.token || f.image || t.img || vTokenImg(t.ref)) : (t.img || vTokenImg(t.ref)); }
const vSizeOf = e => ({ Large: 2, Huge: 3, Gargantuan: 4 })[typeof creatureSize === "function" ? creatureSize(e) : ""] || 1;
// Shapeshifting changes a token's size: a shifted token takes its form's size (Large 2, Huge 3...) unless the GM set
// a size for that form (t.fsz[form]). Its true form uses t.size as always. Players may not have the form's entry,
// so the server sends its size as t.formSz.
function vSizeNoteHtml(t, own) {
  const k = vShiftKey(t); if (!k) return "";
  const f = S.entries.get(k), nm = f ? f.title : "its form", set = own != null ? own : !!(t.fsz && Number(t.fsz[k]) > 0), auto = vFormSz(t, k);
  return `<p class="muted small vsznote">◈ Shapeshifted into ${esc(nm)}: ${set ? `you set this size for that form.` : `the size follows the form (${auto}×${auto}).`} Back in its true form it goes back to ${t.size || 1}×${t.size || 1}.${set ? ` <button type="button" class="btn ghost small" data-act="vttsizeauto">↺ Use ${esc(nm)}'s size</button>` : ""}</p>`;
}
function vSizeNote(box, own) { const old = box.querySelector(".vsznote"), t = S.vttTokens.get(box.dataset.tok); if (!old || !t) return; old.outerHTML = vSizeNoteHtml(t, own); }
function vShiftKey(t) { if ((t.ref || "").startsWith("s:")) { const sm = vSummonOf(t.ref); return (sm && sm.form) || ""; } return t.form || ""; }
function vFormSz(t, k) { const f = S.entries.get(k); return f ? vSizeOf(f) : (Number(t.formSz) || t.size || 1); }
function vTokSz(t) { const k = vShiftKey(t); if (!k) return t.size || 1; const o = t.fsz && Number(t.fsz[k]); return o > 0 ? o : vFormSz(t, k); }
function vSizePatch(id, v) { const t = S.vttTokens.get(id); if (!t) return; const k = vShiftKey(t); if (!k) return vPatch("vtttokens/" + id, { size: v }); return vPatch("vtttokens/" + id, { fsz: Object.assign({}, t.fsz || {}, { [k]: v }) }); }

// ===== Vehicles: a token for a vehicle item. Riders board it like a mount; one of them (t.pilot) drives it. =====
// On the token: hp / hpMax are its hull points, fuel what's left in its tank (a refuelled vehicle), pilot the rider driving.
// The GM's screen keeps the books: it uses fuel as the vehicle moves (efficient) or on the pilot's turn (inefficient),
// and keeps a pilot in the seat while anyone is aboard.
function vVehOf(t) {
  if (!t || !(t.ref || "").startsWith("e:") || typeof vehOf !== "function") return null;
  const e = S.entries.get(t.ref.slice(2)); if (e) return vehOf(e);
  const n = t.npc && t.npc.veh; return n ? vehSpec(n.v, n.cat) : null; // players who can't see the item get its details from the server
}
function vPilotOf(id, t) { if (vIsShip(t)) return vShipHelm(id, t); const p = t && t.pilot && S.vttTokens.get(t.pilot); return p && p.mount === id ? [t.pilot, p] : null; }
// A player may drive a vehicle whose pilot is one of their tokens.
function vDriveTok(id, t) { if (!PLAYER || vCanEdit() || !vVehOf(t)) return false; const pl = vPilotOf(id, t); return !!(pl && vPlayerTok(pl[1])); }
const vFuelLeft = (t, v) => t.fuel == null || t.fuel === "" ? v.fuel.cap : Math.max(0, Math.min(v.fuel.cap, Number(t.fuel) || 0));
// What a powered vehicle's pilot pays with: their spell points, or a resource of that name on their sheet.
function vPowerSrc(pilot, v) {
  if (!pilot || !(pilot.ref || "").startsWith("c:")) return null;
  const cid = pilot.ref.slice(2), c = S.chars.get(cid); if (!c) return null;
  if (/spell\s*points?/i.test(v.fuel.res)) { const k = typeof casterOf === "function" && casterOf(c); return k ? { cid, have: k.left, sp: true } : null; }
  const ri = (c.resources || []).findIndex(r => r && String(r.name || "").trim().toLowerCase() === v.fuel.res.toLowerCase());
  return ri < 0 ? null : { cid, ri, have: charResHave(c, c.resources[ri]) };
}
// Why a vehicle can't move right now ("" if it can).
function vVehStall(id, t) {
  const v = vVehOf(t); if (!v) return "";
  if (vDead(t)) return `${vTokName(t)} is wrecked.`;
  const f = v.fuel; if (f.type === "manual" || !f.amt) return "";
  if (f.type === "refuel") return vFuelLeft(t, v) <= 0 ? `${vTokName(t)} is out of fuel.` : "";
  const pl = vPilotOf(id, t); if (!pl) return `${vTokName(t)} has no pilot to power it.`;
  const src = vPowerSrc(pl[1], v); if (!src) return `${vTokName(pl[1])} has no ${f.res.toLowerCase()} to power ${vTokName(t)}.`;
  return src.have < f.amt ? `${vTokName(pl[1])} hasn't the ${f.res.toLowerCase()} left to power ${vTokName(t)}.` : "";
}
// Spend n of a vehicle's fuel (or its pilot's resource). Only the GM's screen calls this.
function vVehUse(id, t, n) {
  const v = vVehOf(t); if (!v || !(n > 0)) return; const f = v.fuel;
  if (f.type === "refuel") { const had = vFuelLeft(t, v), left = Math.max(0, had - n); S.vttTokens.set(id, Object.assign({}, t, { fuel: left })); vPatch("vtttokens/" + id, { fuel: left }); if (had > 0 && !left) toast(`${vTokName(t)} is out of fuel.`); return; }
  if (f.type === "power") {
    const pl = vPilotOf(id, t), src = pl && vPowerSrc(pl[1], v); if (!src) return;
    const pay = Math.min(src.have, n); if (pay < n) toast(`${vTokName(pl[1])} couldn't pay all the ${f.res.toLowerCase()} ${vTokName(t)} needed.`);
    if (!pay) return;
    if (src.sp) charChange(src.cid, x => { const k = casterOf(x); if (!k) return; x.caster = Object.assign({}, x.caster, { used: Math.min(k.max, k.max - k.left + pay) }); });
    else charChange(src.cid, x => { x.resources = (x.resources || []).map((r, i) => { if (i !== src.ri) return r; const r2 = Object.assign({}, r); charResSet(x, r2, charResHave(x, r) - pay); return r2; }); });
  }
}
// How many squares (or hexes) apart two spots are, for a token of size s.
function vGridSteps(p, a, b, s) {
  if (typeof vHexOf === "function" && vHexOf(p)) { const h = vHexNear(p, a[0] + s / 2, a[1] + s / 2), k = vHexNear(p, b[0] + s / 2, b[1] + s / 2); return vHexDist(h, k); }
  return Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
}
VTT.vehLast = VTT.vehLast || {}; VTT.vehTurn = VTT.vehTurn || {}; VTT.vehMv = VTT.vehMv || {};
function vVehTick() {
  const camp = vCampId(), I = camp ? vInitOf(camp) : null;
  for (const [id, t] of [...S.vttTokens]) {
    const v = vVehOf(t); if (!v) continue;
    // Someone aboard always has the controls: the first to board, until the GM or a player picks another.
    if (vIsShip(t)) { const f = v.fuel, mv = t.mv; if (mv && mv.at && VTT.vehMv[id] !== mv.at) { const seen = VTT.vehMv[id] != null; VTT.vehMv[id] = mv.at; if (seen && f.type !== "manual" && f.amt && f.use === "efficient") vVehUse(id, t, Math.ceil(mv.len) * f.amt); } else if (VTT.vehMv[id] == null) VTT.vehMv[id] = mv ? mv.at : 0;
      if (f.type !== "manual" && f.amt && f.use === "inefficient" && I && I.round) { const pl = vPilotOf(id, t); if (pl && vIsTurn(pl[0], pl[1])) { const key = camp + ":" + I.round + ":" + I.cur; if (VTT.vehTurn[id] !== key && t.fuelTurn !== key) { VTT.vehTurn[id] = key; vPatch("vtttokens/" + id, { fuelTurn: key }); vVehUse(id, S.vttTokens.get(id), f.amt); } } }
      continue; }
    const riders = vRidersOf(id).filter(([, r]) => r.page === t.page);
    if ((t.pilot && !riders.some(([rid]) => rid === t.pilot)) || (!t.pilot && riders.length)) { const np = riders.length ? riders[0][0] : null; if ((t.pilot || null) !== np) { S.vttTokens.set(id, Object.assign({}, t, { pilot: np })); vPatch("vtttokens/" + id, { pilot: np }); } }
    const f = v.fuel, pos = [t.x, t.y, t.page], last = VTT.vehLast[id]; VTT.vehLast[id] = pos;
    if (f.type === "manual" || !f.amt) continue;
    if (f.use === "efficient" && last && last[2] === t.page && (last[0] !== t.x || last[1] !== t.y)) { const cur = S.vttPages.get(t.page), n = vGridSteps(cur || {}, last, pos, vTokSz(t)); if (n > 0) vVehUse(id, S.vttTokens.get(id), n * f.amt); }
    if (f.use === "inefficient" && I && I.round) { const pl = vPilotOf(id, S.vttTokens.get(id)); if (pl && vIsTurn(pl[0], pl[1])) { const key = camp + ":" + I.round + ":" + I.cur; if (VTT.vehTurn[id] !== key && t.fuelTurn !== key) { VTT.vehTurn[id] = key; vPatch("vtttokens/" + id, { fuelTurn: key }); vVehUse(id, S.vttTokens.get(id), f.amt); } } }
  }
}

// A player looking at a vehicle they don't own: what it is, who's aboard, and the controls if they're on it.
function vVehPlayerSide(id, t) {
  const v = vVehOf(t); if (!v) return "";
  const riders = vRidersOf(id), e = S.entries.get((t.ref || "").slice(2)), cat = e ? e.item.category : (t.npc && t.npc.veh && t.npc.veh.cat) || "Vehicle";
  const bars = vBarsFor(t).filter(b => b.vis === "full").map(b => `<p class="small"><span class="muted">${esc(b.label)}</span> ${b.cur} / ${b.max}</p>`).join("");
  return `<div class="vshead"><div><h2>${esc(t.name || "Vehicle")}</h2><p class="muted small">${esc(cat)}</p></div></div>${bars}${vVehSideHtml(id, t, v, riders, false)}
    ${riders.length ? `<div class="vflyrow vmountrow"><span>Aboard <small class="muted">${riders.length}/${v.seats}</small></span><span class="vriders">${riders.map(([rid, r]) => `<span>${t.pilot === rid ? "★ " : ""}${esc(vTokName(r))}${vPlayerTok(r) ? ` <button class="btn small ghost" data-act="vttdismount" data-id="${esc(rid)}" title="${esc(vTokName(r))} gets out">⤵</button>` : ""}</span>`).join("")}</span></div>` : ""}`;
}
// The vehicle's own lines in the side panel: speeds, fuel, who's piloting.
function vVehSideHtml(id, t, v, riders, gm) {
  const f = v.fuel, F = VEH_FUELS[f.type], stall = vVehStall(id, t), pl = vPilotOf(id, t);
  const canPick = riders.length > 1 && (gm || riders.some(([, r]) => PLAYER && vPlayerTok(r)));
  const fuelLine = F.uses ? `${F.name}: ${f.amt} ${F.res ? esc(f.res.toLowerCase()) : "fuel"} ${f.use === "inefficient" ? "a round, on the pilot's turn" : "a square or hex"}` : `${F.name}: no fuel`;
  return `<div class="vvehinfo"><p class="small"><span class="muted">Speed</span> ${esc(vehSpeedText(v))}</p><p class="small"><span class="muted">Fuel</span> ${fuelLine}</p>
    ${vIsShip(t) ? `<div class="vflyrow"><span>At the helm</span><strong>${pl ? esc(vTokName(pl[1])) : "nobody"}</strong></div>${vShipPickHtml(id)}` : riders.length ? `<div class="vflyrow"><span>Pilot</span>${canPick ? `<select class="vpilotsel" data-id="${esc(id)}" aria-label="Pilot">${riders.map(([rid, r]) => `<option value="${esc(rid)}"${pl && pl[0] === rid ? " selected" : ""}${gm || vPlayerTok(r) ? "" : " disabled"}>${esc(vTokName(r))}</option>`).join("")}</select>` : `<strong>${pl ? esc(vTokName(pl[1])) : "—"}</strong>`}</div>` : `<p class="muted small">Nobody aboard. Drop a token on it and press 🛞 Board.</p>`}
    ${stall ? `<p class="small vstall">⚠ ${esc(stall)}</p>` : ""}${vVehResHtml(id, t)}${vVehAbilHtml(t)}</div>`;
}
// A vehicle's resources: the item's resource lines (charges, pools), tracked on its token in t.vres[i] = how many it has.
// A line sized by proficiency bonus uses its pilot's.
function vVehRes(t) {
  const e = S.entries.get((t.ref || "").slice(2)), lines = e && e.item && Array.isArray(e.item.res) ? e.item.res : [];
  const pl = vPilotOf(t._id || "", t) || null, c = pl && (pl[1].ref || "").startsWith("c:") ? S.chars.get(pl[1].ref.slice(2)) : null;
  return lines.map((r, i) => { if (!resValid(r)) return null; const ctr = resIsCounter(r), max = ctr ? 0 : resMax(r, c), v = Array.isArray(t.vres) ? t.vres[i] : null;
    return { i, r, ctr, max, have: v == null || v === "" ? (ctr ? 0 : max) : Math.max(0, ctr ? Number(v) || 0 : Math.min(max, Number(v) || 0)) }; }).filter(Boolean);
}
// The GM, or a player with someone aboard, can change them.
const vVehResCan = (id, t) => vCanEdit() || (PLAYER && vRidersOf(id).some(([, r]) => vPlayerTok(r)));
function vVehResSet(id, i, v) {
  const t = S.vttTokens.get(id); if (!t || !vVehResCan(id, t)) return;
  const line = vVehRes(Object.assign({ _id: id }, t)).find(x => x.i === i); if (!line) return;
  const arr = Array.isArray(t.vres) ? t.vres.slice() : []; arr[i] = Math.max(0, line.ctr ? Math.round(v) : Math.min(line.max, Math.round(v)));
  S.vttTokens.set(id, Object.assign({}, t, { vres: arr })); vPatch("vtttokens/" + id, { vres: arr }); vRefresh();
}
function vVehRest(id, kind) {
  const t = S.vttTokens.get(id); if (!t || !vVehResCan(id, t)) return;
  const arr = Array.isArray(t.vres) ? t.vres.slice() : [];
  vVehRes(Object.assign({ _id: id }, t)).forEach(x => { const rs = x.r.reset || "long", hit = kind === "long" ? rs !== "none" : /^short/.test(rs); if (!hit) return; arr[x.i] = x.ctr || /empty$/.test(rs) ? 0 : x.max; });
  S.vttTokens.set(id, Object.assign({}, t, { vres: arr })); vPatch("vtttokens/" + id, { vres: arr }); toast(`${vTokName(t)}: ${kind} rest.`); vRefresh();
}
function vVehResHtml(id, t) {
  const lines = vVehRes(Object.assign({ _id: id }, t)); if (!lines.length) return "";
  const can = vVehResCan(id, t), btn = (i, d, l, dis) => `<button class="iconbtn" data-act="vttvres" data-id="${esc(id)}" data-i="${i}" data-d="${d}" aria-label="${l}"${dis ? " disabled" : ""}>${d > 0 ? "+" : "−"}</button>`;
  return `<div class="vvres"><span class="muted small">Resources</span>${lines.map(x => `<div class="vvr"><b style="color:${esc(resColor(x.r.color))}">${esc(x.r.name)}</b><span class="n">${x.have}${x.ctr ? "" : ` / ${x.max}`}</span>${can ? btn(x.i, -1, "Use one", !x.have) + btn(x.i, 1, "Get one back", !x.ctr && x.have >= x.max) : ""}</div>`).join("")}
    ${can ? `<div class="vvrrest"><button class="btn ghost small" data-act="vttvrest" data-id="${esc(id)}" data-v="short">Short rest</button><button class="btn ghost small" data-act="vttvrest" data-id="${esc(id)}" data-v="long">Long rest</button></div>` : ""}</div>`;
}
// The vehicle's abilities, from its item entry (players see them only if they can see the item).
function vVehAbilHtml(t) {
  const e = S.entries.get((t.ref || "").slice(2)); if (!e || e.type !== "item") return "";
  const body = String(e.body || "").split(/\n\s*\n/).filter(p => !/^\*[^*][\s\S]*\*$/.test(p.trim()) || /^\*[^*]+?\.\*\s/.test(p.trim())).join("\n\n").trim();
  if (!body) return "";
  const n = (body.match(/\*\*\*[^*]+\.\*\*\*/g) || []).length;
  return `<details class="vvehabil"><summary>Abilities${n ? ` (${n})` : ""}</summary><div class="vabil">${md(body, { entryId: t.ref.slice(2) })}</div></details>`;
}
document.addEventListener("change", ev => {
  const s = ev.target.matches && ev.target.matches(".vpilotsel") && ev.target; if (!s) return;
  const id = s.dataset.id, r = S.vttTokens.get(s.value); if (!r || !(vCanEdit() || (PLAYER && vPlayerTok(r)))) return;
  const t = S.vttTokens.get(id); if (t) S.vttTokens.set(id, Object.assign({}, t, { pilot: s.value }));
  vPatch("vtttokens/" + id, { pilot: s.value }); vRefresh();
});

// ===== Mounts: a rider token (t.mount = the mount's token id) sits on its mount and moves with it =====
// The rider's own x/y/fly/lvl are worked out from the mount whenever tokens change (vRidersFix), so every screen
// draws it in the right place, and the GM's screen writes the worked-out spot back so the library stays in step.
const VSZ = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
function vSizeCat(t) {
  const ref = t.ref || "", k = vShiftKey(t), f = k && S.entries.get(k), cs = e => typeof creatureSize === "function" ? creatureSize(e) : "", sub = x => typeof sizeFromSubtitle === "function" ? sizeFromSubtitle(x) : "";
  let name = "";
  if (f) name = cs(f);
  else if (ref.startsWith("s:")) { const sm = vSummonOf(ref), e = sm && sm.ref && S.entries.get(sm.ref); name = (sm && sub((sm.sb || {}).subtitle)) || (e ? cs(e) : ""); }
  else if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)); name = e ? cs(e) : sub(t.npc && t.npc.sb && t.npc.sb.subtitle); }
  else if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)), r = String((c && c.race) || "").trim().toLowerCase();
    const re = r && [...S.entries.values()].find(e => e.type === "race" && String(e.title || "").toLowerCase() === r), srd = r && typeof SRD_RACE_DOCS !== "undefined" && SRD_RACE_DOCS.find(d => r.includes(String(d.title).toLowerCase()));
    name = (re && re.race && re.race.size) || (srd && srd.race && srd.race.size) || (/halfling|gnome|goblin|kobold/.test(r) ? "Small" : ""); }
  let i = VSZ.indexOf(String(name).split(/\s/)[0]); if (i < 0) i = 2;
  const sq = vTokSz(t); if (sq >= 2) i = Math.max(i, Math.min(5, Math.floor(sq) + 1));
  return i;
}
const vCanCarry = (rider, mount) => vVehOf(mount) ? !vVehOf(rider) : vSizeCat(mount) > vSizeCat(rider);
// How many riders a mount carries: one less than the squares it takes up (Large 1, Huge 2, Gargantuan 3), at least one;
// or, for a summon with a saddle equipped, the saddle's seats if that's more.
function vSaddleSeats(t) {
  if (!(t.ref || "").startsWith("s:") || typeof invOf !== "function") return 0;
  const sm = vSummonOf(t.ref); if (!sm) return 0;
  const inv = invOf(sm); let n = 0;
  for (const k of smEqKeys(sm)) { const sl = inv.slots[k]; if (!sl) continue; const r = invResolve(sl.ref, sl.name), it = (r.e && r.e.item) || {}; if (isSaddleCat(it.category)) n = Math.max(n, Number(it.seats) || 1); }
  return n;
}
const vMountCap = m => { const v = vVehOf(m); return v ? v.seats : Math.max(1, Math.floor(vTokSz(m)) - 1, vSaddleSeats(m)); };
// In the order they got on (the last on is the first off when there's no room).
const vRidersOf = (mid, toks) => (toks || [...S.vttTokens]).filter(([, q]) => q.mount === mid).sort((a, b) => (Number(a[1].mountAt) || 0) - (Number(b[1].mountAt) || 0) || (a[0] < b[0] ? -1 : 1));
const vTokName = t => t.name || "token";
// Where each rider sits: one in the middle; more share the mount's back in a little grid.
function vRiderSpots(m, riders) {
  const ms = vTokSz(m), n = riders.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), cw = ms / cols, ch = ms / rows;
  return riders.map(([id, r], i) => { const rs = vTokSz(r), cx = n === 1 ? ms / 2 : (i % cols + 0.5) * cw, cy = n === 1 ? ms / 2 : (Math.floor(i / cols) + 0.5) * ch; return [id, m.x + cx - rs / 2, m.y + cy - rs / 2]; });
}
VTT.riderSync = VTT.riderSync || {}; VTT.unmounting = VTT.unmounting || new Set();
function vRidersFix() {
  if (!S.vttTokens) return;
  const all = [...S.vttTokens], gm = vCanEdit();
  for (const [mid, m] of all) {
    if (m.mount) continue;
    const riders = vRidersOf(mid, all).filter(([, r]) => r.page === m.page); if (!riders.length) continue;
    for (const [id, x, y] of vRiderSpots(m, riders)) {
      const r = S.vttTokens.get(id), fly = Number(m.fly) || 0, lvl = m.lvl;
      if (r.x === x && r.y === y && (Number(r.fly) || 0) === fly && (r.lvl || 0) === (lvl || 0)) continue;
      S.vttTokens.set(id, Object.assign({}, r, { x, y, fly, lvl }));
      if (gm) { clearTimeout(VTT.riderSync[id]); VTT.riderSync[id] = setTimeout(() => { const q = S.vttTokens.get(id); if (q && q.mount === mid) vPatch("vtttokens/" + id, { x: q.x, y: q.y, fly: Number(q.fly) || 0, lvl: q.lvl || 0 }); }, 400); }
    }
  }
  if (gm) for (const [id, r] of all) if (r.mount) vRiderCheck(id, S.vttTokens.get(id));
  if (gm) vVehTick();
}
// The GM's screen throws riders off: the mount gone or turned too small, the mount down or prone, the rider prone.
function vRiderCheck(id, r) {
  if (VTT.unmounting.has(id)) return;
  const m = S.vttTokens.get(r.mount), prone = t => vTokConds(t).some(c => c.c === "prone" || c.c === "unconscious");
  const hp = m && vBars(m).find(b => /^hp$/i.test(b.label)), down = m && (vDead(m) || (hp && Number(hp.max) > 0 && Number(hp.cur) <= 0));
  let why = "";
  if (!m || m.page !== r.page || m.mount) why = " ";
  else if (down && vVehOf(m)) why = `${vTokName(m)} is wrecked: ${vTokName(r)} is thrown clear. They can use their reaction to land on their feet; otherwise they land prone.`;
  else if (down) why = `${vTokName(m)} dropped to 0 hit points: ${vTokName(r)} falls off. They can use their reaction to land on their feet; otherwise they land prone.`;
  else if (prone(m)) why = `${vTokName(m)} was knocked prone: ${vTokName(r)} is thrown off. They can use their reaction to land on their feet; otherwise they land prone.`;
  else if (prone(r)) why = `${vTokName(r)} was knocked prone and falls off ${vTokName(m)}.`;
  else if (!r.mountForce && !vCanCarry(r, m)) why = `${vTokName(m)} is now too small to carry ${vTokName(r)}: they're thrown off.`;
  else if (!r.mountForce) { const rs = vRidersOf(r.mount), cap = vMountCap(m), keep = rs.filter(([, q]) => q.mountForce).length; const mine = rs.filter(([, q]) => !q.mountForce).map(([q]) => q); if (mine.indexOf(id) >= Math.max(0, cap - keep)) why = `${vTokName(m)} has no room for ${vTokName(r)} any more: they get off.`; }
  if (!why) return;
  VTT.unmounting.add(id); setTimeout(() => VTT.unmounting.delete(id), 3000);
  if (why.trim()) toast(why);
  vDismount(id);
}
// A free square beside the mount for someone getting off it.
function vSpotBeside(m, r, skip) {
  const cur = vPageNow(), W = cur ? cur.p.w : 999, H = cur ? cur.p.h : 999, s = vTokSz(r), ms = m ? vTokSz(m) : 1;
  if (!m) return [Math.max(0, Math.min(W - s, Math.round(r.x))), Math.max(0, Math.min(H - s, Math.round(r.y)))];
  const mx = Math.round(m.x), my = Math.round(m.y), toks = vTokens(r.page).filter(([id, o]) => !skip.has(id) && o.mount !== m.id);
  const free = (x, y) => x >= 0 && y >= 0 && x + s <= W && y + s <= H && !toks.some(([, o]) => x < o.x + vTokSz(o) && x + s > o.x && y < o.y + vTokSz(o) && y + s > o.y);
  for (let ring = 0; ring < 4; ring++) {
    const spots = [];
    for (let x = mx - s - ring; x <= mx + ms + ring; x++) for (let y = my - s - ring; y <= my + ms + ring; y++) {
      const out = x + s <= mx || x >= mx + ms || y + s <= my || y >= my + ms; if (!out) continue;
      spots.push([x, y, Math.hypot(x + s / 2 - (m.x + ms / 2), y + s / 2 - (m.y + ms / 2))]);
    }
    spots.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    const f = spots.find(([x, y]) => free(x, y)); if (f) return [f[0], f[1]];
  }
  return [Math.max(0, Math.min(W - s, mx + ms)), Math.max(0, Math.min(H - s, my))];
}
function vDismount(id, at) {
  const r = S.vttTokens.get(id); if (!r) return;
  const m = r.mount && S.vttTokens.get(r.mount);
  const [x, y] = at || vSpotBeside(m && m.page === r.page ? Object.assign({ id: r.mount }, m) : null, r, new Set([id]));
  S.vttTokens.set(id, Object.assign({}, r, { mount: null, mountForce: null, x, y }));
  vPatch("vtttokens/" + id, Object.assign({ mount: null, x, y }, vCanEdit() ? { mountForce: null } : {}));
  vDraw(); vRefresh();
}
function vRideOn(id, mid) {
  const r = S.vttTokens.get(id), m = S.vttTokens.get(mid); if (!r || !m || r.mount || m.mount || id === mid) return;
  const gm = vCanEdit(); if (!(gm || (PLAYER && vPlayerTok(r)))) return;
  const room = vRidersOf(mid).length < vMountCap(m), ok = vCanCarry(r, m) && room;
  if (!ok && !gm) { toast(room ? `${vTokName(m)} is too small to carry ${vTokName(r)}.` : `${vTokName(m)} has no room for another rider.`); return; }
  vRidersOf(id).forEach(([q]) => vDismount(q)); // nobody rides a rider
  const f = { mount: mid, mountAt: Date.now() }; if (gm) f.mountForce = ok ? null : true;
  S.vttTokens.set(id, Object.assign({}, r, f)); vPatch("vtttokens/" + id, f);
  vRidersFix(); vDraw(); vRefresh();
}
// Which tokens this token could climb onto: overlapping it, on the same floor, and not riding anything themselves.
function vMountCands(id, t, toks) {
  const s = vTokSz(t), cx = t.x + s / 2, cy = t.y + s / 2, lv = vTokFloor(t), gm = vCanEdit();
  // Only onto something bigger, or the same size if this is the token just dropped there (so two tokens sharing a square don't both ask).
  return toks.filter(([mid, m]) => mid !== id && !m.mount && !vIsShip(m) && !t.ship && m.page === t.page && !vDead(m) && (gm || m.layer !== "gm") && vTokFloor(m) === lv && !vRidersOf(id, toks).length &&
    (vTokSz(m) > s || (vTokSz(m) === s && VTT.lastDrop === id)) &&
    cx >= m.x && cx <= m.x + vTokSz(m) && cy >= m.y && cy <= m.y + vTokSz(m)).sort((a, b) => vTokSz(b[1]) - vTokSz(a[1])).slice(0, 2);
}
function vSave(path, doc) { if (!VTT.undoing && path.startsWith("vtttokens/") && !S.vttTokens.has(path.slice(10)) && typeof vCanEdit === "function" && vCanEdit()) vUndoPush({ path, doc: vClone(doc), add: true }); return safeWrite(() => S.db.doc(path).set(doc)); }
function vPatch(path, fields) { vUndoNote(path, fields); return safeWrite(() => S.db.doc(path).update(fields)); }
function vDel(path) { vUndoDelNote(path); return safeWrite(() => S.db.doc(path).delete()); }

// ===== Undo and redo for the GM's map building (Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y, or the buttons in the tools) =====
// Every change the GM makes to a map (walls, pictures, raised squares, stairs, lights, levels, size, scale...) and every
// token the GM deletes is kept, newest last. Each entry is a list of ops: { path, before, after } or { path, doc, del }.
// "before" is read from a copy of each map taken when it last arrived from the library (VTT.pageSnap), because some
// edits change the page in place before they're saved.
VTT.undo = []; VTT.redo = []; VTT.pageSnap = {}; VTT.undoing = false; VTT.undoGroup = null;
const VUNDO_MAX = 80;
function vPagesSnap() { if (!S.vttPages) return; const next = {}; for (const [id, p] of S.vttPages) next[id] = JSON.stringify(p); VTT.pageSnap = next; }
const vClone = x => x === undefined ? null : JSON.parse(JSON.stringify(x));
function vUndoPush(op) {
  if (VTT.undoGroup) { VTT.undoGroup.push(op); return; }
  const last = VTT.undo[VTT.undo.length - 1], keys = o => Object.keys(o.after || {}).sort().join();
  // Typing into a field (the map's name or size) is one step, not one per key.
  const typed = o => Object.keys(o.after || {}).every(k => ["name", "w", "h", "bg"].includes(k));
  if (last && last.ops.length === 1 && !op.del && !op.add && !last.ops[0].del && !last.ops[0].add && typed(op) && last.ops[0].path === op.path && keys(last.ops[0]) === keys(op) && Date.now() - last.at < 1500) { last.ops[0].after = op.after; last.at = Date.now(); }
  else { VTT.undo.push({ ops: [op], at: Date.now() }); if (VTT.undo.length > VUNDO_MAX) VTT.undo.shift(); }
  VTT.redo = []; vUndoBtns();
}
function vUndoNote(path, fields) {
  if (VTT.undoing || !fields || typeof vCanEdit !== "function" || !vCanEdit()) return;
  if (path.startsWith("vttpages/")) {
    const id = path.slice(9), snap = VTT.pageSnap[id], base = snap ? JSON.parse(snap) : vClone(S.vttPages.get(id)) || {};
    const before = {}, after = vClone(fields); Object.keys(fields).forEach(k => { before[k] = vClone(base[k]); });
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    VTT.pageSnap[id] = JSON.stringify(Object.assign(base, after));
    vUndoPush({ path, before, after });
  } else if (VTT.undoGroup && path.startsWith("vtttokens/")) {
    const t = S.vttTokens.get(path.slice(10)); if (!t) return; const before = {}; Object.keys(fields).forEach(k => { before[k] = vClone(t[k]); });
    VTT.undoGroup.push({ path, before, after: vClone(fields) });
  }
}
function vUndoDelNote(path) {
  if (VTT.undoing || typeof vCanEdit !== "function" || !vCanEdit() || !path.startsWith("vtttokens/")) return;
  const t = S.vttTokens.get(path.slice(10)); if (!t) return;
  vUndoPush({ path, doc: vClone(t), del: true });
}
// Several writes that belong together (swapping two levels moves its tokens too) are one step.
async function vUndoStep(fn, label) { const g = []; VTT.undoGroup = g; try { await fn(); } finally { VTT.undoGroup = null; } if (g.length) { VTT.undo.push({ ops: g, at: 0, label }); VTT.redo = []; vUndoBtns(); } }
const VUNDO_WHAT = { walls: "walls", objs: "pictures", areas: "raised squares", links: "stairs", lights: "lights", levelNames: "levels", minLevel: "levels", maxLevel: "levels", w: "map size", h: "map size", scale: "travel scale", name: "map name" };
function vUndoLabel(e) {
  if (e.label) return e.label;
  const what = new Set(); e.ops.forEach(o => { if (o.del) what.add("deleted token"); else if (o.add) what.add("new token"); else Object.keys(o.after || {}).forEach(k => what.add(VUNDO_WHAT[k] || (o.path.startsWith("vtttokens/") ? "tokens" : "map settings"))); });
  const pid = (e.ops.find(o => o.path.startsWith("vttpages/")) || {}).path, pg = pid && S.vttPages.get(pid.slice(9)), other = pg && pid.slice(9) !== VTT.page;
  return [...what].join(", ") + (other ? ` on ${pg.name || "another map"}` : "");
}
async function vUndoRun(redo) {
  const from = redo ? VTT.redo : VTT.undo, to = redo ? VTT.undo : VTT.redo, e = from.pop();
  if (!e) { toast(redo ? "Nothing to redo." : "Nothing to undo."); return; }
  VTT.undoing = true;
  try {
    const ops = redo ? e.ops : e.ops.slice().reverse();
    for (const o of ops) {
      if (o.del || o.add) { if (!!redo === !!o.del) await safeWrite(() => S.db.doc(o.path).delete()); else await safeWrite(() => S.db.doc(o.path).set(o.doc)); continue; }
      const f = redo ? o.after : o.before;
      if (o.path.startsWith("vttpages/")) { const id = o.path.slice(9), snap = VTT.pageSnap[id]; if (snap) VTT.pageSnap[id] = JSON.stringify(Object.assign(JSON.parse(snap), vClone(f))); }
      if (S.db) await safeWrite(() => S.db.doc(o.path).update(f));
    }
  } finally { VTT.undoing = false; }
  to.push(e); VTT.sel = null; VTT.draft = null;
  toast(`${redo ? "Redone" : "Undone"}: ${vUndoLabel(e)}.`); vUndoBtns();
}
function vUndoBtns() { document.querySelectorAll("[data-act=vttundo]").forEach(b => { b.disabled = !VTT.undo.length; b.title = VTT.undo.length ? `Undo ${vUndoLabel(VTT.undo[VTT.undo.length - 1])} (Ctrl+Z)` : "Nothing to undo"; }); document.querySelectorAll("[data-act=vttredo]").forEach(b => { b.disabled = !VTT.redo.length; b.title = VTT.redo.length ? `Redo ${vUndoLabel(VTT.redo[VTT.redo.length - 1])} (Ctrl+Shift+Z)` : "Nothing to redo"; }); }

// ----- The campaign list -----
function viewVtt() {
  const camps = [...(S.vttCamps || new Map())].filter(([, c]) => !c.workshop).sort((a, b) => String(a[1].name).localeCompare(b[1].name));
  return `<section class="page"><div class="phead"><h1>Tabletop</h1>${vCanEdit() ? `<button class="btn" data-act="vttnewcamp">+ New campaign</button>` : ""}</div>
    <p class="muted">${vCanEdit() ? "Each campaign holds its maps (pages). Open one to build boards, place tokens from the bestiary and draw walls for line of sight." : "Pick your campaign to join the table. You'll see the page the GM has sent the players to."}</p>
    ${camps.length ? `<div class="vcamps">${camps.map(([id, c]) => { const pages = vPages(id); return `<article class="vcamp"><a href="#vtt-${esc(id)}"><h2>${esc(c.name || "Campaign")}</h2>
      <p class="muted small">${pages.length} page${pages.length === 1 ? "" : "s"}${c.playerPage && S.vttPages && S.vttPages.get(c.playerPage) ? ` · players on <strong>${esc(S.vttPages.get(c.playerPage).name)}</strong>` : ""}</p></a>
      ${vCanEdit() ? `<div class="vcampacts"><button class="btn ghost small" data-act="vttrencamp" data-id="${esc(id)}">Rename</button><button class="btn ghost small danger" data-act="vttdelcamp" data-id="${esc(id)}">Delete</button></div>` : ""}</article>`; }).join("")}</div>`
      : `<div class="empty">${vCanEdit() ? "No campaigns yet. Make one to start building maps." : "The GM hasn't set up a campaign yet."}</div>`}</section>`;
}
async function vNewPage(camp, name, order, folder) {
  const id = vid("p");
  await vSave("vttpages/" + id, { camp, name: name || "Page 1", order: order || 0, folder: folder || "", open: false, w: 15, h: 15, bg: "#1b1f27", grid: true, light: false, fogMem: true, objs: [], walls: [], created: new Date().toISOString() });
  return id;
}
async function vttCampAction(a, el) {
  if (a === "vttnewcamp") {
    const name = await vAsk("New campaign", "Name", "", "Create"); if (!name) return;
    const id = vid("c");
    await vSave("vttcamps/" + id, { name, created: new Date().toISOString() });
    const pid = await vNewPage(id, "Page 1", 0);
    await vPatch("vttcamps/" + id, { playerPage: pid });
    location.hash = "vtt-" + id;
  } else if (a === "vttrencamp") {
    const c = S.vttCamps.get(el.dataset.id); if (!c) return;
    const name = await vAsk("Rename campaign", "Name", c.name, "Save"); if (name) vPatch("vttcamps/" + el.dataset.id, { name });
  } else if (a === "vttdelcamp") {
    const id = el.dataset.id, c = S.vttCamps.get(id); if (!c) return;
    if (!(await confirmBox(`Delete “${c.name}” with all its pages and tokens?`, "Delete campaign"))) return;
    for (const [pid] of vPages(id)) { for (const [tid] of vTokens(pid)) await vDel("vtttokens/" + tid); await vDel("vttpages/" + pid); await vDel("vttfog/" + pid).catch(() => {}); }
    await vDel("vttcamps/" + id);
  }
}
function vAsk(title, label, value, yes) {
  return new Promise(res => {
    openModal(`<h2>${esc(title)}</h2><form class="vask"><label><span>${esc(label)}</span><input id="vaskv" type="text" value="${esc(value || "")}"></label>
      <div class="acts"><button class="btn" type="submit">${esc(yes)}</button><button class="btn ghost" type="button" id="vaskno">Cancel</button></div></form>`, m => {
      m.querySelector("form").onsubmit = ev => { ev.preventDefault(); const v = m.querySelector("#vaskv").value.trim(); closeModal(); res(v); };
      m.querySelector("#vaskno").onclick = () => { closeModal(); res(null); };
      setTimeout(() => { const i = m.querySelector("#vaskv"); if (i) { i.focus(); i.select(); } }, 0);
    });
  });
}

// ----- A campaign's board -----
function vCurrentPage(camp) {
  const c = S.vttCamps.get(camp); if (!c || !S.vttPages) return null; // the maps arrive a moment after the campaigns
  if (PLAYER || READONLY) {
    // Players are on the GM's page unless they've switched to a map the GM has opened to them. Sending them somewhere new brings them back.
    const ok = id => id && S.vttPages.has(id) && S.vttPages.get(id).camp === camp && (S.vttPages.get(id).open || c.playerPage === id);
    if (VTT.lastPP !== c.playerPage) { VTT.lastPP = c.playerPage; VTT.ppage = null; }
    VTT.camp = camp;
    return ok(VTT.ppage) ? VTT.ppage : ok(c.playerPage) ? c.playerPage : null;
  }
  if (VTT.camp !== camp || !VTT.page || !S.vttPages.has(VTT.page)) { const pages = vPages(camp); VTT.page = (c.playerPage && S.vttPages.has(c.playerPage)) ? c.playerPage : pages[0] ? pages[0][0] : null; }
  VTT.camp = camp;
  return VTT.page;
}
function viewVttCamp(camp) {
  const c = S.vttCamps && S.vttCamps.get(camp);
  if (!c) return `<section class="page"><p class="muted">${S.vttCamps ? "That campaign isn't here any more." : "Opening the table…"}</p><p><a href="#vtt">All campaigns</a></p></section>`;
  if (!S.vttPages) return `<section class="page"><p class="muted">Opening the table…</p></section>`;
  const pid = vCurrentPage(camp), p = pid && S.vttPages.get(pid);
  const gm = vCanEdit();
  const avail = gm ? [] : vPages(camp).filter(([id, pg]) => pg.open || c.playerPage === id);
  const tabs = gm ? `<button class="btn ghost small${VTT.mapsOpen ? " on" : ""}" data-act="vttmaps" aria-expanded="${!!VTT.mapsOpen}">🗺 Maps</button>${p ? `<span class="vcurpage">${esc(vFolderPath(c, p.folder))}<strong>${esc(p.name || "Map")}</strong></span>` : ""}`
    : avail.length > 1 ? `<label class="vpsel"><span class="sr">Map</span><select id="vpsel">${avail.map(([id, pg]) => `<option value="${esc(id)}"${id === pid ? " selected" : ""}>${c.playerPage === id ? "★ " : ""}${esc(vFolderPath(c, pg.folder) + (pg.name || "Map"))}</option>`).join("")}</select></label>${pid !== c.playerPage && c.playerPage ? `<button class="btn ghost small" data-act="vttgoparty">★ Back to the party</button>` : ""}`
    : p ? `<span class="vcurpage"><strong>${esc(p.name || "Map")}</strong></span>` : "";
  return `<section class="vtt" data-camp="${esc(camp)}">
    <div class="vttbar"><a href="#vtt" class="vback">← Campaigns</a><h1>${esc(c.name)}</h1>${p && gm ? `<button class="btn small vtoolsbtn${VTT.toolsOpen ? " on" : ""}" data-act="vtttoolsopen" aria-expanded="${!!VTT.toolsOpen}">🛠 Tools</button>` : ""}${tabs}
      ${p && gm && !c.workshop ? `<button class="btn ghost small${VTT.initOpen ? " on" : ""}" data-act="vttinitopen" aria-expanded="${!!VTT.initOpen}">⚔ Turn order</button>` : ""}${gm && p && !c.workshop ? `<button class="btn ghost small" data-act="vttcondlib">✦ Conditions</button><button class="btn ghost small${VTT.questOpen ? " on" : ""}" data-act="vttqopen" aria-expanded="${!!VTT.questOpen}">📜 Quests</button>` : ""}
      ${gm && p ? `<div class="vbaracts">${c.workshop ? `<span class="vpill">⛵ Vehicle workshop</span>` : c.playerPage === pid ? `<span class="vpill">★ Players are here</span>` : `<button class="btn small" data-act="vttsend">Send players here</button>`}<button class="btn ghost small" data-act="vttsettings">Page settings</button></div>` : ""}</div>
    ${gm && VTT.mapsOpen ? `<div class="vmaps" id="vmaps">${vMapsHtml(camp)}</div>` : ""}
    ${p ? `<div class="vttwrap${VTT.toolsOpen ? " toolsopen" : ""}">${gm ? `<div class="vtools" id="vtools">${vToolsHtml()}</div>` : ""}
      <div class="vview" id="vview" tabindex="0" aria-label="Board"><div class="vstage" id="vstage"></div>
        ${gm ? "" : `<div class="vptools" id="vptools">${vMeasToolsHtml(false)}</div>`}
        <div class="vzoom"><button class="iconbtn" data-act="vttzoom" data-v="-1" aria-label="Zoom out">−</button><button class="iconbtn" data-act="vttzoom" data-v="0" aria-label="Fit board">⤢</button><button class="iconbtn" data-act="vttzoom" data-v="1" aria-label="Zoom in">+</button></div>
        <canvas class="vfxp" id="vfxp" aria-hidden="true"></canvas>
        <div class="vturns" id="vturns"></div>
        <div class="vquests" id="vquests"></div>
        <div class="vhint" id="vhint"></div><div class="vfloors" id="vfloors" role="group" aria-label="Which floor to show"></div></div>
      <aside class="vside" id="vside"></aside></div>`
      : `<div class="empty">${gm ? "This campaign has no pages yet." : "The GM hasn't opened a page for the players yet."}</div>`}
  </section>`;
}
function vToolsHtml() {
  const L = [["map", "Map", "Battle maps and backgrounds, under the grid"], ["token", "Tokens", "Creatures and things players can see"], ["gm", "GM", "Only you can see these"], ["walls", "Walls", "Lines that block sight"], ["lights", "Lights", "Torches, lanterns and glows: click to place one, drag to move it"]];
  const T = [["select", "↖", "Select and move (V)"], ["pan", "✋", "Pan (H, or drag empty space)"], ["measure", "📏", "Measure (M)"], ["wall", "╱", "Draw walls (W): click points, double-click or Enter to finish"], ["area", "▦", "Raised squares (A): drag over the squares that are up on the level you're editing (a rooftop or upper floor). Alt-drag to remove squares."], ["link", "⇅", "Stairs or lift (S): drag over the squares; tokens standing there get a button to change level"], ["draw", "✏️", "Draw (D): doodle on the map for everyone to see"], ["scale", "📐", "Travel scale: drag a line and say how much travel it is (e.g. one day)"], ["gridfit", "#", "Move the grid: drag the grid onto the squares drawn in the picture, size it with the corner handle, then Apply. Every level moves together."], ["align", "⊞", "Line up with the grid: drag across something on the map (a corridor, a door) and say how many squares it is. Every level moves together."], ["travel", "🧭", "Travel (T): click out a route to see how long it takes; double-click or Enter to finish"], ["ping", "📍", "Ping (P): click to flash a spot for everyone; Shift-click to move everyone's view there. Or hold the mouse still on the map anywhere."]];
  return `<div class="vgroup"><span class="vlab">Layer</span>${L.map(([v, l, t]) => `<button class="vbtn${VTT.layer === v ? " on" : ""}" data-act="vttlayer" data-v="${v}" title="${t}" aria-pressed="${VTT.layer === v}">${l}</button>`).join("")}</div>
    <div class="vgroup"><span class="vlab">Tool</span>${T.map(([v, l, t]) => `<button class="vbtn icon${VTT.tool === v ? " on" : ""}" data-act="vtttool" data-v="${v}" title="${t}" aria-label="${t}" aria-pressed="${VTT.tool === v}">${l}</button>`).join("")}</div>
    <div class="vgroup vundo"><button class="vbtn" data-act="vttundo"${VTT.undo.length ? "" : " disabled"} title="Undo (Ctrl+Z)">↶ Undo</button><button class="vbtn" data-act="vttredo"${VTT.redo.length ? "" : " disabled"} title="Redo (Ctrl+Shift+Z)">↷ Redo</button></div>
    ${vWorkshopToolsHtml((vPageNow() || {}).p)}
    ${vLevelToolsHtml()}
    ${vMeasToolsHtml(true)}
    ${VTT.tool === "draw" ? `<div class="vgroup"><span class="vlab">Pen</span>${vPenHtml(true)}</div>` : ""}
    ${VTT.tool === "gridfit" ? vGridEdToolsHtml() : ""}
    ${VTT.tool === "travel" || VTT.tool === "scale" || VTT.tool === "align" ? `<div class="vgroup"><span class="vlab">${VTT.tool === "scale" ? "Scale" : VTT.tool === "align" ? "Line up" : "Travel"}</span>${vTravelToolsHtml(true)}</div>` : ""}
    ${VTT.tool === "wall" ? `<div class="vgroup"><span class="vlab">Draw as</span><div class="seg vwk">${[["wall", "Wall"], ["door", "🚪 Door"], ["window", "🪟 Window"]].map(([v, l]) => `<button class="${(VTT.wallKind || "wall") === v ? "on" : ""}" data-act="vttwk" data-v="${v}" aria-pressed="${(VTT.wallKind || "wall") === v}">${l}</button>`).join("")}</div>
      <label class="check small"><input type="checkbox" data-act="vttwsnap"${VTT.wallSnap !== false ? " checked" : ""}> Snap to grid <small class="muted">(Alt flips it)</small></label></div>` : ""}
    ${VTT.layer === "lights" ? vLightToolsHtml() : ""}
    ${vFxToolsHtml()}
    <div class="vgroup"><span class="vlab">Add</span><button class="vbtn" data-act="vttaddimg" title="Upload an image onto the ${VTT.layer === "gm" ? "GM" : VTT.layer === "token" ? "token" : "map"} layer">🖼 Image</button><button class="vbtn" data-act="vtttokpick" title="Add a token from the library or a new picture">● Token</button></div>
    <div class="vgroup"><label class="check small"><input type="checkbox" data-act="vttpreview"${VTT.preview ? " checked" : ""}> Show what players see</label></div>`;
}

// ----- Drawing the board -----
function vMount() {
  const root = document.querySelector(".vtt"); if (!root) { VTT.mountedKey = ""; return; }
  const top = root.getBoundingClientRect().top + window.scrollY; document.documentElement.style.setProperty("--vtop", Math.round(top) + "px");
  const pid = VTT.camp === root.dataset.camp ? vCurrentPage(root.dataset.camp) : vCurrentPage(root.dataset.camp);
  const view = document.getElementById("vview"); if (!view || !pid) return;
  VTT.mountedKey = root.dataset.camp + "|" + pid;
  if (!view.dataset.wired) vWire(view);
  vDraw();
  if (VTT.fitDone !== pid) { VTT.fitDone = pid; vFit(); }
}
// The stage is redrawn often (every frame while a ship glides). Phones (Safari especially) free canvases slowly and reload the
// page once canvas memory runs out, so the fog and light canvases are kept and reused instead of made afresh each time.
function vCvTake(stage) { const m = new Map(), n = {}; stage.querySelectorAll("canvas").forEach(c => { const k = c.id || c.className; n[k] = (n[k] || 0) + 1; m.set(c.id || c.className + "#" + n[k], c); }); return m; }
function vCvKeep(stage, old) {
  const n = {};
  stage.querySelectorAll("canvas").forEach(c => { const k = c.id || c.className; n[k] = (n[k] || 0) + 1; const key = c.id || c.className + "#" + n[k], o = old.get(key); if (!o) return; old.delete(key);
    for (const a of [...o.attributes]) if (a.name !== "width" && a.name !== "height" && !c.hasAttribute(a.name)) o.removeAttribute(a.name);
    for (const a of [...c.attributes]) if (a.name !== "width" && a.name !== "height" && o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value);
    c.replaceWith(o); });
  old.forEach(c => { c.width = 0; c.height = 0; });
}
// Pixels per square for a canvas covering the whole map, kept small enough on big maps for a phone's canvas limits.
const vCvRes = (p, R) => Math.max(4, Math.min(R, Math.floor(Math.sqrt(4e6 / Math.max(1, p.w * p.h)))));
function vRefresh() { const s = document.getElementById("vside"); if (s && !(document.activeElement && s.contains(document.activeElement) && document.activeElement.matches("input,select"))) s.innerHTML = vSideHtml(); vDraw(); }
function vPageNow() { const root = document.querySelector(".vtt"); if (!root) return null; const pid = vCurrentPage(root.dataset.camp); return pid ? { id: pid, p: S.vttPages.get(pid) } : null; }
function vDraw() {
  const cur = vPageNow(), stage = document.getElementById("vstage"); if (!cur || !stage || !cur.p) return;
  vRidersFix(); vShipFix();
  const p = cur.p, W = p.w * VCELL, H = p.h * VCELL, gm = vCanEdit(), toks = vTokens(cur.id);
  stage.style.width = W + "px"; stage.style.height = H + "px";
  vApplyView();
  const objs = (p.objs || []);
  if (VTT.lvlShowPid !== cur.id) { VTT.lvlShowPid = cur.id; VTT.lvlShow = null; }
  { const sig = cur.id + "|" + vMinLevel(p) + "|" + vMaxLevel(p) + "|" + JSON.stringify(p.levelNames || {}); if (VTT.lvlSig !== sig || !document.querySelector("#vtools .vlvgroup")) { VTT.lvlSig = sig; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); } }
  const lvlCls = l => vLvlHid(l) ? " lvlhid" : gm && !VTT.preview && (l || 0) > VTT.lvl ? " above" : gm && !VTT.preview && (l || 0) < 0 && (l || 0) < VTT.lvl ? " lvlhid" : "";
  const img = o => `<img class="vobj${lvlCls(o.level)}${VTT.sel && VTT.sel.kind === "obj" && VTT.sel.id === o.id ? " sel" : ""}${o.layer === "gm" ? " gmonly" : ""}" data-oid="${esc(o.id)}" data-layer="${o.layer}" data-level="${o.level || 0}" src="${esc(o.img)}" alt="" draggable="false" style="left:${o.x * VCELL}px;top:${o.y * VCELL}px;width:${o.w * VCELL}px;height:${o.h * VCELL}px${o.rot ? `;transform:rotate(${Number(o.rot) || 0}deg)` : ""}">`;
  const tok = ([id, t]) => { const src = vTokSrc(t), s = vTokSz(t) * VCELL, fly = Math.max(0, Number(t.fly) || 0);
    return `<div class="vtok${vDead(t) ? " vdead" : ""}${vIsTurn(id, t) ? " vturn" : ""}${(VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id === id) || VTT.multi.has(id) ? " sel" : ""}${t.layer === "gm" ? " gmonly" : ""}${t.owner && (S.chars.get(t.owner) ? !S.chars.get(t.owner).hidden : false) ? " owned" : ""}${fly ? " flying" : ""}${lvlCls(t.lvl)}" data-tid="${esc(id)}" data-layer="${t.layer}" style="left:${t.x * VCELL}px;top:${t.y * VCELL}px;width:${s}px;height:${s}px;--fly:${Math.min(fly, 6)}">${fly ? `<span class="vfly" title="Flight band ${fly}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 14c3-1 6-4 8-8 1 3 1 6-1 9 3-1 6-3 8-7 1 4-1 9-6 11-4 1-7 0-9-5z"/></svg>${fly}</span>` : ""}${t.lvl ? `<span class="vlvl" title="Standing on ${esc(vLevelName(p, t.lvl))}">⌂${vLevelBadge(Number(t.lvl) || 0)}</span>` : ""}${vCondBadges(t)}${gm && !VTT.preview ? vAcBadge(t) : ""}
      ${vDead(t) ? `<span class="vdeadx" aria-label="Down"></span>` : vBarsHtml(t)}${src ? `<img src="${esc(src)}" alt="" draggable="false">` : `<span class="vinit">${esc((t.name || "?")[0])}</span>`}<span class="vname">${esc(t.name || "")}</span></div>`; };
  const grid = p.grid !== false && vHexOf(p) ? vHexGridSvg(p, W, H) : p.grid !== false ? `<svg class="vgrid" width="${W}" height="${H}" aria-hidden="true"><defs><pattern id="vgp" width="${VCELL}" height="${VCELL}" patternUnits="userSpaceOnUse"><path d="M ${VCELL} 0 L 0 0 0 ${VCELL}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#vgp)"/><rect width="100%" height="100%" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/></svg>` : "";
  const showWalls = gm && !VTT.preview;
  const wallSel = VTT.sel && VTT.sel.kind === "wall" ? VTT.sel.i : -1;
  const areaSel = VTT.sel && VTT.sel.kind === "area" ? VTT.sel.id : "";
  const walls = showWalls ? `<svg class="vwalls${VTT.layer === "walls" ? " active" : ""}" width="${W}" height="${H}" aria-hidden="true">${(p.areas || []).map(a => vAreaSvg(p, a, a.id === areaSel)).join("")}
    ${(p.walls || []).map((w, i) => `<line x1="${w[0] * VCELL}" y1="${w[1] * VCELL}" x2="${w[2] * VCELL}" y2="${w[3] * VCELL}" class="${i === wallSel ? "sel" : ""}${(w[4] || 0) !== VTT.lvl ? " otherlvl" : ""}${vLvlHid(w[4]) ? " lvlhid" : ""}${w[5] ? " " + w[5].k + (w[5].open ? " open" : "") + (w[5].secret ? " secret" : "") : ""}"/>`).join("")}
    ${VTT.draft && VTT.draft.length ? `<polyline class="draft${VTT.tool === "area" ? " areadraft" : ""}" points="${VTT.draft.map(q => q[0] * VCELL + "," + q[1] * VCELL).join(" ")}${VTT.hover ? " " + VTT.hover[0] * VCELL + "," + VTT.hover[1] * VCELL : ""}${VTT.tool === "area" && VTT.draft.length > 1 ? " " + VTT.draft[0][0] * VCELL + "," + VTT.draft[0][1] * VCELL : ""}"/>${VTT.draft.map(q => `<circle cx="${q[0] * VCELL}" cy="${q[1] * VCELL}" r="4"/>`).join("")}` : ""}</svg>` : "";
  const visToks = toks.filter(([, t]) => (t.layer !== "gm" || gm) && !vIsShip(t)).sort((a, b) => (a[1].mount ? 1 : 0) - (b[1].mount ? 1 : 0) || (Number(a[1].z) || 0) - (Number(b[1].z) || 0));
  // Remember where each token was drawn, so ones moved by someone else can slide to their new spot.
  const prevPos = new Map(); stage.querySelectorAll(".vtok").forEach(e => { if (!e.classList.contains("dragging")) { const cs = getComputedStyle(e); prevPos.set(e.dataset.tid, [parseFloat(cs.left), parseFloat(cs.top), parseFloat(e.style.left), parseFloat(e.style.top), e.dataset.slideT]); } });
  const oldCv = vCvTake(stage);
  stage.innerHTML = `<div class="vbg" style="background:${esc(p.bg || "#1b1f27")}"></div>
    <div class="vlayer vmap">${objs.filter(o => o.layer === "map" && !o.level).map(img).join("")}</div>${grid}${vShipsHtml(cur.id, p, toks, gm)}
    <div class="vlayer vgm">${gm ? objs.filter(o => o.layer === "gm" && !o.level).map(img).join("") + visToks.filter(([, t]) => t.layer === "gm").map(tok).join("") : ""}</div>
    <div class="vlayer vtokl">${objs.filter(o => o.layer === "token" && !o.level).map(img).join("")}${visToks.filter(([, t]) => t.layer !== "gm" && !vHeight(t) && !vTokFloor(t)).map(tok).join("")}</div>
    <canvas class="vfog" id="vfog" aria-hidden="true"></canvas>
    <div class="vlayer vroofl">${(() => { const up = objs.filter(o => o.level && (gm || o.layer !== "gm")), lv = [...new Set(up.map(o => o.level))].sort((a, b) => a - b); return lv.map(L => `<div class="vrlv" data-lvl="${L}">${up.filter(o => o.level === L).map(img).join("")}</div>`).join(""); })()}</div>
    <div class="vlayer vhigh">${visToks.filter(([, t]) => t.layer !== "gm" && (vHeight(t) || vTokFloor(t))).map(tok).join("")}</div><div class="vlayer vshipover">${vShipOverHtml(toks, gm)}</div>${vWorkshopHtml(p)}${vFxStageHtml(p)}<svg class="vdrawl" id="vdrawl" width="${W}" height="${H}" aria-hidden="true">${vDrawingsSvg(cur.id)}</svg>${walls}${gm && !VTT.preview && VTT.layer === "lights" ? vLightMarks(p) : ""}${vLinksHtml(p, gm && !VTT.preview)}${vDoorMarks(p, gm && !VTT.preview)}${vGoHtml(p, toks)}<svg class="vmeas" id="vmeas" width="${W}" height="${H}" aria-hidden="true"></svg><div class="vpings" id="vpings"></div>
    ${gm && VTT.sel && VTT.sel.kind === "obj" ? (o => o ? (o.rot ? "" : `<div class="vhandle" data-handle="obj" style="left:${(o.x + o.w) * VCELL - 9}px;top:${(o.y + o.h) * VCELL - 9}px" title="Drag to resize (Shift: free)"></div>`) + `<div class="vrothandle" data-handle="rot" style="left:${(o.x + o.w / 2) * VCELL - 11}px;top:${o.y * VCELL - 40}px;transform-origin:11px ${o.h * VCELL / 2 + 40}px;transform:rotate(${Number(o.rot) || 0}deg)" title="Drag to rotate (Shift: free; otherwise 15° steps)">⟳</div>` : "")(objs.find(o => o.id === VTT.sel.id)) : ""}
    ${gm && VTT.sel && VTT.sel.kind === "wall" && (p.walls || [])[VTT.sel.i] ? (w => `<div class="vwh" data-wh="0" style="left:${w[0] * VCELL}px;top:${w[1] * VCELL}px" title="Drag to move this end"></div><div class="vwh" data-wh="1" style="left:${w[2] * VCELL}px;top:${w[3] * VCELL}px" title="Drag to move this end"></div>`)(p.walls[VTT.sel.i]) : ""}`;
  vCvKeep(stage, oldCv);
  stage.dataset.layer = VTT.layer; stage.classList.toggle("vbelow", !!VTT.shipBelow); VTT.stageW = W; VTT.stageH = H;
  vFog(cur.id, p, toks); vSteerDraw(); vGridEdDraw(); vTrDraw();
  if (gm && !VTT.preview) document.querySelectorAll(".vtok").forEach(el => { const t = S.vttTokens.get(el.dataset.tid); if (t && t.ship && vIsShip(S.vttTokens.get(t.ship))) el.classList.toggle("vflooroff", !vShipVis(t.ship).toks.has(Number(t.deck) || 0)); });
  vSlideTokens(stage, prevPos);
  vMeasDraw(); vPingDraw(); vFxRun(p); vQuestDraw(); vLightsPaint(cur.id, p, toks);
  const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false);
  vInitDraw(); vTurnFollow(cur, p, toks);
  const hint = document.getElementById("vhint");
  if (hint) hint.textContent = VTT.tool === "measure" ? "Drag to measure · Esc to clear" : gm ? (VTT.tool === "wall" ? (VTT.draft ? "Click to add points · double-click or Enter to finish · Esc to cancel" : "Click to start a wall") : VTT.tool === "area" ? `Drag over squares that are up on ${vLevelName(p, VTT.lvl || 1)} · hold Alt to remove squares` : VTT.tool === "link" ? "Drag over the squares for stairs or a lift" : VTT.layer === "walls" ? "Select a wall to delete it, or pick the wall tool to draw" : "") : (p.light ? "" : "");
}
function vApplyView() { const st = document.getElementById("vstage"); if (st) { st.style.transform = `translate(${VTT.panX}px,${VTT.panY}px) scale(${VTT.zoom})`; st.style.setProperty("--vinv", Math.max(1, 1 / VTT.zoom).toFixed(3)); } }
function vFit() {
  const cur = vPageNow(), view = document.getElementById("vview"); if (!cur || !view) return;
  const W = cur.p.w * VCELL, H = cur.p.h * VCELL, r = view.getBoundingClientRect();
  VTT.zoom = Math.max(0.1, Math.min(2, Math.min((r.width - 40) / W, (r.height - 40) / H)));
  VTT.panX = (r.width - W * VTT.zoom) / 2; VTT.panY = (r.height - H * VTT.zoom) / 2; vApplyView();
}
function vZoomAt(f, cx, cy) {
  const nz = Math.max(0.1, Math.min(4, VTT.zoom * f));
  VTT.panX = cx - (cx - VTT.panX) * (nz / VTT.zoom); VTT.panY = cy - (cy - VTT.panY) * (nz / VTT.zoom); VTT.zoom = nz; vApplyView();
}

// ----- Line of sight and remembered areas -----
function vSegs(p, h) {
  const W = p.w, H = p.h, lvl = Math.round(h || 0);
  const cur = vPageNow(), sw = cur && cur.p === p ? vShipWallsOn(cur.id) : [];
  return (p.walls || []).concat(sw).filter(w => (w[4] || 0) === lvl && !vWallOpen(w)).map(w => w.slice(0, 4)).concat([[0, 0, W, 0], [W, 0, W, H], [W, H, 0, H], [0, H, 0, 0]]);
}
// The area visible from (x, y) with walls as blockers: a polygon of points in squares.
function vVisPoly(x, y, segs) {
  const angles = [];
  for (const s of segs) for (const [px, py] of [[s[0], s[1]], [s[2], s[3]]]) { const a = Math.atan2(py - y, px - x); angles.push(a - 1e-5, a, a + 1e-5); }
  const pts = [];
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity;
    for (const s of segs) {
      const sx = s[2] - s[0], sy = s[3] - s[1], den = dx * sy - dy * sx; if (Math.abs(den) < 1e-12) continue;
      const t = ((s[0] - x) * sy - (s[1] - y) * sx) / den, u = ((s[0] - x) * dy - (s[1] - y) * dx) / den;
      if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
    }
    if (best < Infinity) pts.push([x + dx * best, y + dy * best, a]);
  }
  pts.sort((p1, p2) => p1[2] - p2[2]);
  return pts.map(q => [q[0], q[1]]);
}
function vInPoly(x, y, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
const vB64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const vUnB64 = (s, n) => { const out = new Uint8Array(n); try { const b = atob(s || ""); for (let i = 0; i < Math.min(n, b.length); i++) out[i] = b.charCodeAt(i); } catch (e) {} return out; };
function vFogLoad(pid, p) {
  const gw = p.w * VFOG_RES, gh = p.h * VFOG_RES, n = Math.ceil(gw * gh / 8), key = pid + "|" + gw + "x" + gh;
  const f = (S.vttFog || new Map()).get(pid);
  const stored = f && f.w === p.w && f.h === p.h ? vUnB64(f.bits, n) : new Uint8Array(n);
  if (VTT.fogKey !== key || !VTT.fogBits) { VTT.fogKey = key; VTT.fogBits = stored; }
  else for (let i = 0; i < n; i++) VTT.fogBits[i] |= stored[i];
  return { gw, gh };
}
// Players' tokens can be on different floors of one building. On a shared screen, the players pick
// which floor to look at (VTT.pfloor); "All" keeps everyone's view together.
function vViewers(p, toks) {
  // The tabletop's floor picker is for the map (buildings): it counts only the party on the map. Each ship has its own
  // deck picker (VTT.shipView), which decides whose eyes count aboard it.
  const all = toks.filter(([, t]) => vPlayerTok(t)), fl = vTokFloor;
  const aboard = ([, t]) => t.ship && vIsShip(S.vttTokens.get(t.ship)), base = all.filter(x => !aboard(x));
  const floors = [...new Set(base.map(([, t]) => fl(t)))].sort((a, b) => a - b);
  const bar = document.getElementById("vfloors");
  if (bar) {
    const show = floors.length > 1 && (!vCanEdit() || VTT.preview);
    if (VTT.pfloor != null && !floors.includes(VTT.pfloor)) VTT.pfloor = null;
    const html = show ? `<span class="vflab">Floor</span><button class="${VTT.pfloor == null ? "on" : ""}" data-act="vttpfloor" data-v="" aria-pressed="${VTT.pfloor == null}">All</button>${floors.slice().reverse().map(n => { const who = base.filter(([, t]) => fl(t) === n).map(([, t]) => t.name || "?"); return `<button class="${VTT.pfloor === n ? "on" : ""}" data-act="vttpfloor" data-v="${n}" aria-pressed="${VTT.pfloor === n}" title="${esc(who.join(", "))}"><b>${esc(n ? (((p.levelNames || {})[n]) || "Level " + n) : "Ground")}</b><small>${esc(who.length > 2 ? who.slice(0, 2).join(", ") + " +" + (who.length - 2) : who.join(", "))}</small></button>`; }).join("")}` : "";
    if (bar.dataset.h !== html) { bar.innerHTML = html; bar.dataset.h = html; }
    bar.hidden = !show;
  }
  const onMap = VTT.pfloor == null ? base : base.filter(([, t]) => fl(t) === VTT.pfloor);
  return onMap.concat(all.filter(aboard).filter(([, t]) => vShipVis(t.ship).toks.has(Number(t.deck) || 0)));
}
function vFog(pid, p, toks) {
  const cv = document.getElementById("vfog"); if (!cv) return;
  const gm = vCanEdit(), dark = vDarkOn(p), on = (p.light || dark) && (!gm || VTT.preview);
  document.querySelectorAll(".vstage .gmonly").forEach(el => el.classList.toggle("vhide", gm && VTT.preview));
  if (!on) { cv.style.display = "none"; document.querySelectorAll(".vtok.vhide:not(.gmonly),.vdoor.vhide").forEach(el => el.classList.remove("vhide")); const vv = vViewers(p, toks); if (!gm || VTT.preview) { vRoofs(p, vv); vFloorHide(vv); } else document.querySelectorAll(".vtok.vflooroff").forEach(el => el.classList.remove("vflooroff")); return; }
  const viewers = vViewers(p, toks);
  // Each viewer is blocked only by the walls on its own height: standing level plus flight band.
  // Without dynamic lighting, walls don't block sight and only darkness limits it.
  const rect = [[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]];
  const vw = viewers.map(([, t]) => { const s = vTokSz(t) / 2, x = t.x + s, y = t.y + s; return { x, y, s, dv: dark ? vDarkvision(t) / 5 : 0, poly: p.light ? vVisPoly(x, y, vSegs(p, vHeight(t))) : rect }; });
  const polys = vw.map(v => v.poly);
  // In the dark, only lit places (and what darkvision reaches) can be seen.
  const em = dark ? vEmitters(p, toks).map(e => Object.assign({ r: (e.bright + e.dim) / 5, poly: vVisPoly(e.x, e.y, vSegs(p, e.h)) }, e)).filter(e => e.r > 0) : [];
  const path = (c, poly, k) => { c.beginPath(); poly.forEach(([x, y], i) => i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k)); c.closePath(); };
  const drawSeen = (c, k) => vw.forEach(v => {
    if (v.poly.length < 3) return;
    if (!dark) { path(c, v.poly, k); c.fill(); return; }
    c.save(); path(c, v.poly, k); c.clip();
    em.forEach(e => { if (e.poly.length < 3) return; c.save(); path(c, e.poly, k); c.clip(); c.beginPath(); c.arc(e.x * k, e.y * k, e.r * k, 0, 6.2832); c.fill(); c.restore(); });
    c.beginPath(); c.arc(v.x * k, v.y * k, (v.s + 0.5 + v.dv) * k, 0, 6.2832); c.fill();
    c.restore();
  });
  vRoofs(p, viewers);
  const R = vCvRes(p, 20), W = p.w * R, H = p.h * R;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } else cv.getContext("2d").clearRect(0, 0, W, H); cv.style.display = "block"; cv.style.width = p.w * VCELL + "px"; cv.style.height = p.h * VCELL + "px";
  const ctx = cv.getContext("2d");
  ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "destination-out";
  if (p.fogMem !== false) {
    const { gw, gh } = vFogLoad(pid, p);
    // Add what's visible now to the remembered squares.
    const off = VTT.fogOff || (VTT.fogOff = document.createElement("canvas")); if (off.width !== gw || off.height !== gh) { off.width = gw; off.height = gh; } const oc = off.getContext("2d"); oc.clearRect(0, 0, gw, gh);
    oc.fillStyle = "#000"; drawSeen(oc, VFOG_RES);
    const px = oc.getImageData(0, 0, gw, gh).data; let changed = false;
    for (let i = 0; i < gw * gh; i++) if (px[i * 4 + 3] > 100) { const b = i >> 3, m = 1 << (i & 7); if (!(VTT.fogBits[b] & m)) { VTT.fogBits[b] |= m; changed = true; } }
    if (changed) vFogSaveSoon(pid, p);
    // Draw remembered squares dimmed.
    const mem = oc.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) if (VTT.fogBits[i >> 3] & (1 << (i & 7))) mem.data[i * 4 + 3] = 255;
    oc.clearRect(0, 0, gw, gh); oc.putImageData(mem, 0, 0);
    ctx.globalAlpha = 0.45; ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#000"; drawSeen(ctx, R);
  ctx.globalCompositeOperation = "source-over";
  // Tokens nobody in the party can see right now are hidden; in the dark, so are ones standing where there's no light
  // (unless they give off light themselves, or a viewer's darkvision reaches them).
  // Doors and windows show where the party can see, or has seen.
  const gw = p.w * VFOG_RES, seenBit = (x, y) => { if (p.fogMem === false || !VTT.fogBits) return false; const i = Math.floor(y * VFOG_RES) * gw + Math.floor(x * VFOG_RES); return !!(VTT.fogBits[i >> 3] & (1 << (i & 7))); };
  const lit = (x, y) => em.some(e => Math.hypot(x - e.x, y - e.y) <= e.r && vInPoly(x, y, e.poly));
  // Door and window markers show only while one of the party's tokens can see them right now.
  document.querySelectorAll(".vdoor").forEach(el => { const x = Number(el.dataset.x), y = Number(el.dataset.y); el.classList.toggle("vhide", ![[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([a, b]) => vw.some(v => vInPoly(x + a, y + b, v.poly) && (!dark || lit(x + a, y + b) || Math.hypot(x + a - v.x, y + b - v.y) <= v.s + 0.5 + v.dv)))); });
  document.querySelectorAll(".vtok").forEach(el => {
    const t = S.vttTokens.get(el.dataset.tid); if (!t || t.layer === "gm") return;
    const cx = t.x + vTokSz(t) / 2, cy = t.y + vTokSz(t) / 2, glows = dark && vTokLights(t).length > 0;
    const seen = vPlayerTok(t) || vw.some(v => vInPoly(cx, cy, v.poly) && (!dark || glows || lit(cx, cy) || Math.hypot(cx - v.x, cy - v.y) <= v.s + 0.5 + v.dv + vTokSz(t) / 2));
    el.classList.toggle("vhide", !seen);
  });
  vFloorHide(viewers);
}
// Players only see tokens on a floor one of their tokens is on (or the floor they've picked).
// Tokens on the map show on the floors the party is looking at; tokens aboard a ship, on the deck its picker shows.
function vFloorHide(viewers) {
  const floors = new Set(viewers.filter(([, t]) => !t.ship).map(([, t]) => vTokFloor(t)));
  document.querySelectorAll(".vtok").forEach(el => { const t = S.vttTokens.get(el.dataset.tid); if (!t || t.layer === "gm") return;
    if (t.ship && vIsShip(S.vttTokens.get(t.ship))) { el.classList.toggle("vflooroff", !vShipVis(t.ship).toks.has(Number(t.deck) || 0)); return; }
    el.classList.toggle("vflooroff", floors.size > 0 && !floors.has(vTokFloor(t))); });
}
function vFogSaveSoon(pid, p) {
  clearTimeout(VTT.fogTimer);
  VTT.fogTimer = setTimeout(() => { if (VTT.fogKey.startsWith(pid + "|")) S.db.doc("vttfog/" + pid).set({ w: p.w, h: p.h, res: VFOG_RES, bits: vB64(VTT.fogBits), at: new Date().toISOString() }).catch(() => {}); }, 1500);
}

// ----- Side panel -----
function vSideHtml() {
  const cur = vPageNow(); if (!cur) return "";
  const p = cur.p, sel = VTT.sel;
  if (VTT.tool === "travel" && vHexOf(p)) return `<div class="vtrpanel">${vTrPanelHtml(cur)}</div>`;
  if (VTT.multi.size > 1) return vMultiSideHtml();
  if (sel && sel.kind === "tok") { const t = S.vttTokens.get(sel.id); return t ? vTokSideHtml(sel.id, t) : vSideHelp(p); }
  if (sel && sel.kind === "obj") {
    const o = (p.objs || []).find(x => x.id === sel.id); if (!o) return vSideHelp(p);
    return `<h2>Image</h2><div class="vform" data-obj="${esc(sel.id)}">
      <label><span>Layer</span><select data-vf="layer"><option value="map"${o.layer === "map" ? " selected" : ""}>Map (under the grid)</option><option value="token"${o.layer === "token" ? " selected" : ""}>Tokens</option><option value="gm"${o.layer === "gm" ? " selected" : ""}>GM only</option></select></label>
      <label><span>Level</span><select data-vf="level">${vLevelList(p).map(n => `<option value="${n}"${(o.level || 0) === n ? " selected" : ""}>${esc(vLevelName(p, n))}</option>`).join("")}</select></label>
      <div class="frow tight"><label><span>Width</span><input type="number" min="0.25" step="0.25" data-vf="w" value="${+o.w.toFixed(2)}"></label><label><span>Height</span><input type="number" min="0.25" step="0.25" data-vf="h" value="${+o.h.toFixed(2)}"></label></div>
      <div class="frow tight vrotrow"><label><span>Rotation (°)</span><input type="number" step="15" data-vf="rot" value="${Number(o.rot) || 0}"></label><button class="btn ghost small" data-act="vttobjrot" data-v="-90" aria-label="Rotate 90° left">↺ 90°</button><button class="btn ghost small" data-act="vttobjrot" data-v="90" aria-label="Rotate 90° right">↻ 90°</button></div>
      <p class="muted small">In grid squares. Drag the corner handle to resize (hold Shift to stretch freely) and the ⟳ handle to rotate.</p>
      <div class="acts wrap"><button class="btn ghost small" data-act="vttobjfit">Fit to board</button><button class="btn ghost small" data-act="vttobjz" data-v="back">Send to back</button><button class="btn ghost small" data-act="vttobjz" data-v="front">Bring to front</button><button class="btn ghost small danger" data-act="vttdel">Delete image</button></div></div>`;
  }
  if (sel && sel.kind === "light") { const l = (p.lights || []).find(x => x.id === sel.id); return l ? vLightSideHtml(p, l) : vSideHelp(p); }
  if (sel && sel.kind === "area") { const a = (p.areas || []).find(x => x.id === sel.id); return a ? `<h2>Raised ${a.cells ? "squares" : "area"}</h2><p class="muted small">Part of <strong>${esc(vLevelName(p, a.level))}</strong>${a.cells ? ` · ${a.cells.length} square${a.cells.length === 1 ? "" : "s"}` : ""}: a rooftop or upper floor. Pictures on that level over these squares are hidden from players whose tokens are underneath, so they can see inside.</p><p class="muted small">With the ▦ tool, drag to add squares; hold Alt while dragging to remove them.</p><div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete ${a.cells ? "all these squares" : "area"}</button></div>` : vSideHelp(p); }
  if (sel && sel.kind === "wall" && p.walls[sel.i]) return vWallSideHtml(p, sel.i);
  if (sel && sel.kind === "link") { const l = (p.links || []).find(x => x.id === sel.id); return l ? vLinkSideHtml(p, l) : vSideHelp(p); }
  if (sel && sel.kind === "wall") return `<h2>Wall</h2><p class="muted small">On <strong>${esc(vLevelName(p, (p.walls[sel.i] || [])[4] || 0))}</strong>. Blocks sight for tokens at that height when dynamic lighting is on.</p><div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete wall</button></div>`;
  return vSideHelp(p);
}
function vSideHelp(p) {
  if (!vCanEdit()) return "";
  return vPageSideHtml(p);
}
function vSideTips(p) {
  const n = vTokens(VTT.page).length;
  return `<h2>${esc(p.name || "Page")}</h2><p class="muted small">${p.w} × ${p.h} squares · ${n} token${n === 1 ? "" : "s"} · ${(p.walls || []).length} wall${(p.walls || []).length === 1 ? "" : "s"}${p.light ? " · dynamic lighting on" : ""}</p>
    <ul class="vtips small muted"><li>Pick a <strong>layer</strong>, then click things on it to select and drag them.</li><li>Drag empty space to pan; scroll or pinch to zoom.</li><li><strong>Delete</strong> removes what's selected.</li><li>Tokens snap to the grid; hold <strong>Alt</strong> while dropping to place freely.</li><li>Give a token a <strong>controller</strong> so its player can move it and see through it.</li></ul>`;
}

// ----- Pointer handling -----
function vPt(ev) { const st = document.getElementById("vstage").getBoundingClientRect(); return [(ev.clientX - st.left) / VTT.zoom / VCELL, (ev.clientY - st.top) / VTT.zoom / VCELL]; }
function vSegDist(px, py, w) { const dx = w[2] - w[0], dy = w[3] - w[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - w[0]) * dx + (py - w[1]) * dy) / l2)) : 0; return Math.hypot(px - (w[0] + t * dx), py - (w[1] + t * dy)); }
function vWire(view) {
  view.dataset.wired = "1";
  const ptrs = new Map(); let drag = null, pinch = null;
  view.addEventListener("wheel", ev => { ev.preventDefault(); const r = view.getBoundingClientRect(); vZoomAt(ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
  view.addEventListener("pointerdown", ev => {
    if (ev.target.closest(".vzoom,.vptools,.vturns,.vquests,.vfloors,.vdecktabs")) return;
    const dm = ev.target.closest("button.vdoor"); if (dm) { ev.preventDefault(); ev.stopPropagation(); vDoorClick(dm.dataset.door); return; }
    const go = ev.target.closest(".vgo button"); if (go) { ev.preventDefault(); ev.stopPropagation(); if (go.dataset.deck != null) vShipGoDeck(go.dataset.tok, Number(go.dataset.deck)); else if (go.dataset.mount) vRideOn(go.dataset.tok, go.dataset.mount); else if (go.dataset.dismount) vDismount(go.dataset.tok); else vGoLevel(go.dataset.tok, Number(go.dataset.lvl)); return; }
    view.focus({ preventScroll: true });
    ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: VTT.zoom }; drag = null; return; }
    const cur = vPageNow(); if (!cur) return;
    const gm = vCanEdit(), [x, y] = vPt(ev);
    if (vShipPointerDown(ev, cur, gm, x, y)) return;
    const rh = gm && ev.target.closest(".vrothandle"); if (rh && VTT.sel && VTT.sel.kind === "obj") { const o = (cur.p.objs || []).find(q => q.id === VTT.sel.id); if (o) { ev.preventDefault(); drag = { kind: "rot", o, el: document.querySelector(`.vobj[data-oid="${CSS.escape(o.id)}"]`), cx: o.x + o.w / 2, cy: o.y + o.h / 2 }; view.setPointerCapture(ev.pointerId); return; } }
    const wh = gm && ev.target.closest(".vwh"); if (wh && VTT.sel && VTT.sel.kind === "wall") { const w = cur.p.walls[VTT.sel.i]; if (w) { ev.preventDefault(); const e = Number(wh.dataset.wh), pt = e ? [w[2], w[3]] : [w[0], w[1]]; drag = { kind: "wend", pt, lvl: w[4] || 0, el: wh }; view.setPointerCapture(ev.pointerId); return; } }
    const pan = () => { drag = { kind: "pan", sx: ev.clientX, sy: ev.clientY, px: VTT.panX, py: VTT.panY }; view.setPointerCapture(ev.pointerId); };
    if (ev.button === 1 || ev.button === 2 || (gm && VTT.tool === "pan")) return pan();
    if (gm && VTT.tool === "area") { ev.preventDefault(); if (!VTT.lvl) vAreaPickLevel(); const sx = Math.floor(x), sy = Math.floor(y); drag = { kind: "area", sx, sy, ex: sx, ey: sy, rm: ev.altKey }; view.setPointerCapture(ev.pointerId); vLinkDraft(drag); return; }
    if (gm && VTT.tool === "wall") { ev.preventDefault(); return vWallClick(x, y, ev); }
    if (VTT.tool === "measure") { const sp = ev.altKey ? [x, y] : vHexOf(cur.p) ? vHexSnapPt(cur.p, x, y) : [Math.round(x * 2) / 2, Math.round(y * 2) / 2]; VTT.meas = { s: sp, e: sp, shape: VTT.mshape, bw: VTT.mbeam }; drag = { kind: "meas" }; view.setPointerCapture(ev.pointerId); vMeasDraw(); vLiveMeas(); vMeasToolsRefresh(); return; }
    if (VTT.tool === "ping") { ev.preventDefault(); vPing(x, y, gm && ev.shiftKey); return; }
    if (VTT.tool === "travel") { ev.preventDefault(); if (vTrOn(cur.p)) vTrPointer(ev, cur, x, y); else vTravelClick(x, y, ev); return; }
    if (gm && VTT.tool === "gridfit") { ev.preventDefault(); const G = vGridEd(cur.id), hd = ev.target.closest(".vgehandle"); drag = hd ? { kind: "gridsize", g0: G.g, ox: G.ox, oy: G.oy } : { kind: "gridmove", sx: x, sy: y, ox: G.ox, oy: G.oy }; view.setPointerCapture(ev.pointerId); return; }
    if (gm && VTT.tool === "align") { ev.preventDefault(); drag = { kind: "align" }; VTT.meas = { shape: "align", s: [x, y], e: [x, y] }; view.setPointerCapture(ev.pointerId); vMeasDraw(); return; }
    if (gm && VTT.tool === "scale") { ev.preventDefault(); drag = { kind: "scale" }; VTT.meas = { shape: "scale", s: [x, y], e: [x, y] }; view.setPointerCapture(ev.pointerId); vMeasDraw(); return; }
    if (VTT.tool === "draw") { ev.preventDefault(); if (VTT.erase) { vEraseAt(x, y); drag = { kind: "erase" }; view.setPointerCapture(ev.pointerId); return; } drag = { kind: "draw", pts: [[x, y]] }; view.setPointerCapture(ev.pointerId); vDrawLive(drag.pts); return; }
    if (gm && VTT.tool === "link") { ev.preventDefault(); const sx = Math.floor(x), sy = Math.floor(y); drag = { kind: "link", sx, sy, ex: sx, ey: sy }; view.setPointerCapture(ev.pointerId); vLinkDraft(drag); return; }
    const handle = ev.target.closest("[data-handle]");
    if (handle && gm) { const o = (cur.p.objs || []).find(q => q.id === VTT.sel.id); if (o) { drag = { kind: "resize", o, ratio: o.w / o.h, el: document.querySelector(`.vobj[data-oid="${CSS.escape(o.id)}"]`) }; view.setPointerCapture(ev.pointerId); } return; }
    const layerOk = l => gm ? (VTT.layer === l || (VTT.layer === "token" && l === "token")) : false;
    const tokEl = ev.target.closest(".vtok"), objEl = ev.target.closest(".vobj");
    if (tokEl) {
      const t = S.vttTokens.get(tokEl.dataset.tid);
      const mine = t && !gm && PLAYER && (vPlayerTok(t) || vDriveTok(tokEl.dataset.tid, t));
      if (t && gm && layerOk(t.layer) && ev.shiftKey) { const id = tokEl.dataset.tid; if (VTT.sel && VTT.sel.kind === "tok") VTT.multi.add(VTT.sel.id); if (VTT.multi.has(id)) VTT.multi.delete(id); else VTT.multi.add(id); VTT.sel = VTT.multi.size === 1 ? { kind: "tok", id: [...VTT.multi][0] } : null; if (VTT.multi.size <= 1) VTT.multi.clear(); vRefresh(); return; }
      if (t && gm && VTT.multi.size > 1 && VTT.multi.has(tokEl.dataset.tid)) { const g = [...VTT.multi].map(id => [id, S.vttTokens.get(id)]).filter(([, q]) => q); document.querySelectorAll(".vtok.sel").forEach(e => e.classList.add("dragging")); drag = { kind: "group", g, sx: x, sy: y, moved: false }; view.setPointerCapture(ev.pointerId); return; }
      if (t && (layerOk(t.layer) || mine)) {
        VTT.multi.clear();
        VTT.sel = { kind: "tok", id: tokEl.dataset.tid }; document.querySelectorAll(".vtok.sel,.vobj.sel").forEach(e => e.classList.remove("sel")); tokEl.classList.add("sel"); vGoRefresh();
        // Grabbing a rider moves its mount (and so both) when you may move the mount; otherwise it pulls the rider off.
        const mt = t.mount && S.vttTokens.get(t.mount), mEl = mt && document.querySelector(`.vtok[data-tid="${CSS.escape(t.mount)}"]`);
        const stalled = (vid2, q) => { const why = vVehStall(vid2, q); if (!why) return false; toast(why + (gm ? " (You can still move it.)" : "")); return !gm; };
        if (mt && mEl && ((gm && layerOk(mt.layer)) || (!gm && PLAYER && (vPlayerTok(mt) || vDriveTok(t.mount, mt))))) { if (stalled(t.mount, mt)) return; drag = { kind: "tok", id: t.mount, el: mEl, ox: x - mt.x, oy: y - mt.y, t: mt, moved: false, wps: [] }; VTT.tdrag = drag; mEl.classList.add("dragging"); tokEl.classList.add("dragging"); view.setPointerCapture(ev.pointerId); return; }
        if (vVehOf(t) && stalled(tokEl.dataset.tid, t)) return;
        drag = { kind: "tok", id: tokEl.dataset.tid, el: tokEl, ox: x - t.x, oy: y - t.y, t, moved: false, wps: [] }; VTT.tdrag = drag; tokEl.classList.add("dragging"); view.setPointerCapture(ev.pointerId);
        const s = document.getElementById("vside"); if (s) s.innerHTML = vSideHtml();
        return;
      }
    }
    if (objEl && gm && layerOk(objEl.dataset.layer)) {
      const o = (cur.p.objs || []).find(q => q.id === objEl.dataset.oid);
      if (o) { VTT.sel = { kind: "obj", id: o.id }; drag = { kind: "obj", o, el: objEl, ox: x - o.x, oy: y - o.y, moved: false }; view.setPointerCapture(ev.pointerId); vRefresh(); drag.el = document.querySelector(`.vobj[data-oid="${CSS.escape(o.id)}"]`); return; }
    }
    if (gm && VTT.layer === "lights") {
      const lt = [...(cur.p.lights || [])].reverse().find(l => !vLvlHid(l.level) && Math.hypot(l.x - x, l.y - y) < 0.45);
      if (lt) { VTT.sel = { kind: "light", id: lt.id }; drag = { kind: "light", l: lt, ox: x - lt.x, oy: y - lt.y, moved: false }; view.setPointerCapture(ev.pointerId); vRefresh(); return; }
      if (VTT.sel) { VTT.sel = null; vRefresh(); }
      pan(); drag.place = [ev.altKey ? x : Math.round(x * 2) / 2, ev.altKey ? y : Math.round(y * 2) / 2]; return;
    }
    if (gm && VTT.layer === "walls") {
      const i = (cur.p.walls || []).findIndex(w => !vLvlHid(w[4]) && vSegDist(x, y, w) < 0.2 / Math.max(0.5, VTT.zoom));
      if (i >= 0) { VTT.sel = { kind: "wall", i }; vRefresh(); return; }
      const lk = [...(cur.p.links || [])].reverse().find(l => !(l.levels || [0]).every(vLvlHid) && x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h);
      if (lk) { VTT.sel = { kind: "link", id: lk.id }; vRefresh(); return; }
      const ar = [...(cur.p.areas || [])].reverse().find(a => !vLvlHid(a.level) && vInArea(a, x, y));
      if (ar) { VTT.sel = { kind: "area", id: ar.id }; vRefresh(); return; }
    }
    if (gm && ev.shiftKey && (VTT.layer === "token" || VTT.layer === "gm")) { drag = { kind: "box", sx: x, sy: y, ex: x, ey: y }; view.setPointerCapture(ev.pointerId); return; }
    if (VTT.sel || VTT.multi.size) { VTT.sel = null; VTT.multi.clear(); vRefresh(); vGoRefresh(); }
    pan();
  });
  view.addEventListener("pointermove", ev => {
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (!drag && VTT.tool === "travel" && VTT.meas && VTT.meas.shape === "travel" && VTT.meas.open) { VTT.meas.hover = vPt(ev); vMeasDraw(); vLiveMeas(); }
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = view.getBoundingClientRect(); vZoomAt((pinch.z * d / pinch.d) / VTT.zoom, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); return; }
    if (vCanEdit() && VTT.tool === "wall" && VTT.draft) { VTT.hover = vSnapWall(vPt(ev), ev); vDraw(); return; }
    if (!drag) return;
    if (drag.kind === "pan" && drag.place && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 6) drag.place = null;
    if (drag.kind === "light") { const [lx, ly] = vPt(ev); drag.moved = true; drag.nx = ev.altKey ? lx - drag.ox : Math.round((lx - drag.ox) * 2) / 2; drag.ny = ev.altKey ? ly - drag.oy : Math.round((ly - drag.oy) * 2) / 2; const cur = vPageNow(); if (cur) { const L = (cur.p.lights || []).find(q => q.id === drag.l.id); if (L) { L.x = drag.nx; L.y = drag.ny; vDraw(); } } return; }
    if (drag.kind === "pan") { VTT.panX = drag.px + ev.clientX - drag.sx; VTT.panY = drag.py + ev.clientY - drag.sy; vApplyView(); return; }
    const [x, y] = vPt(ev);
    if (drag.kind === "meas") { VTT.meas.e = [x, y]; vMeasDraw(); vLiveMeas(); return; }
    if (drag.kind === "link" || drag.kind === "area") { drag.ex = Math.floor(x); drag.ey = Math.floor(y); if (drag.kind === "area") drag.rm = drag.rm || ev.altKey; vLinkDraft(drag); return; }
    if (drag.kind === "rot") { let a = Math.atan2(y - drag.cy, x - drag.cx) * 180 / Math.PI + 90; if (!ev.shiftKey) a = Math.round(a / 15) * 15; a = ((a % 360) + 360) % 360; drag.a = a; if (drag.el) drag.el.style.transform = `rotate(${a}deg)`; const hd = document.querySelector(".vrothandle"); if (hd) hd.style.transform = `rotate(${a}deg)`; return; }
    if (drag.kind === "wend") { const np = vSnapWall([x, y], ev, drag.pt); drag.np = np; drag.el.style.left = np[0] * VCELL + "px"; drag.el.style.top = np[1] * VCELL + "px"; const svg = document.getElementById("vmeas"); if (svg) svg.innerHTML = vWallEndPreview(drag); return; }
    if (drag.kind === "scale" || drag.kind === "align") { VTT.meas.e = [x, y]; vMeasDraw(); return; }
    if (drag.kind === "gridmove") { const G = VTT.gridEd; G.ox = drag.ox + x - drag.sx; G.oy = drag.oy + y - drag.sy; vGridEdDraw(); return; }
    if (drag.kind === "gridsize") { const G = VTT.gridEd, n = 3, g = Math.max(0.2, Math.min(10, ((x - drag.ox) + (y - drag.oy)) / 2 / n)); G.g = Math.round(g * 1000) / 1000; vGridEdDraw(); return; }
    if (drag.kind === "draw") { const l = drag.pts[drag.pts.length - 1]; if (Math.hypot(x - l[0], y - l[1]) > 0.04) { drag.pts.push([x, y]); vDrawLive(drag.pts); } return; }
    if (drag.kind === "erase") { vEraseAt(x, y); return; }
    if (drag.kind === "box") { drag.ex = x; drag.ey = y; const svg = document.getElementById("vmeas"); if (svg) svg.innerHTML = `<rect class="vboxsel" x="${Math.min(drag.sx, x) * VCELL}" y="${Math.min(drag.sy, y) * VCELL}" width="${Math.abs(x - drag.sx) * VCELL}" height="${Math.abs(y - drag.sy) * VCELL}"/>`; return; }
    if (drag.kind === "group") { drag.moved = true; drag.dx = x - drag.sx; drag.dy = y - drag.sy; drag.g.forEach(([id, q]) => { const el = document.querySelector(`.vtok[data-tid="${CSS.escape(id)}"]`); if (el) { el.style.left = (q.x + drag.dx) * VCELL + "px"; el.style.top = (q.y + drag.dy) * VCELL + "px"; } }); return; }
    if (drag.kind === "tok") { drag.moved = true; drag.nx = x - drag.ox; drag.ny = y - drag.oy; drag.el.style.left = drag.nx * VCELL + "px"; drag.el.style.top = drag.ny * VCELL + "px";
      vRiderSpots(Object.assign({}, drag.t, { x: drag.nx, y: drag.ny }), vRidersOf(drag.id)).forEach(([rid, rx, ry]) => { const re = document.querySelector(`.vtok[data-tid="${CSS.escape(rid)}"]`); if (re) { re.style.left = rx * VCELL + "px"; re.style.top = ry * VCELL + "px"; } });
      const free = ev.altKey !== vNoSnap(), sz = vTokSz(drag.t), cp = (vPageNow() || {}).p, [hx, hy] = free ? [0, 0] : vSnapAny(cp, drag.nx, drag.ny, sz, drag.t), snapX = free ? Math.round(drag.nx * 100) / 100 : hx, snapY = free ? Math.round(drag.ny * 100) / 100 : hy;
      drag.end = [snapX + sz / 2, snapY + sz / 2];
      // Right-click while dragging (pressed alongside the left button) drops a corner in the path.
      if (ev.button === 2 && (ev.buttons & 2)) vAddWaypoint(drag);
      VTT.mmove = { shape: "path", pts: [[drag.t.x + sz / 2, drag.t.y + sz / 2], ...drag.wps, drag.end], h: vHeight(drag.t) }; vMeasDraw(); return; }
    if (drag.kind === "obj") { drag.moved = true; drag.nx = x - drag.ox; drag.ny = y - drag.oy; if (drag.el) { drag.el.style.left = drag.nx * VCELL + "px"; drag.el.style.top = drag.ny * VCELL + "px"; } const h = document.querySelector(".vhandle"); if (h) h.style.display = "none"; return; }
    if (drag.kind === "resize") { let w = Math.max(0.25, x - drag.o.x), h = Math.max(0.25, y - drag.o.y); if (!ev.shiftKey) h = w / drag.ratio; drag.nw = w; drag.nh = h; if (drag.el) { drag.el.style.width = w * VCELL + "px"; drag.el.style.height = h * VCELL + "px"; } const hd = document.querySelector(".vhandle"); if (hd) { hd.style.left = (drag.o.x + w) * VCELL - 9 + "px"; hd.style.top = (drag.o.y + h) * VCELL - 9 + "px"; } }
  });
  const end = ev => {
    // Letting go of the right button while still dragging with the left keeps the drag going.
    if (ev.button === 2 && drag && drag.kind === "tok") return;
    ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch = null;
    const d = drag; drag = null; if (!d) return;
    if (d.kind === "meas") { vLiveMeas(true); return; }
    if (d.kind === "link") { vLinkAdd(d); return; }
    if (d.kind === "area") { vAreaPaint(d); return; }
    if (d.kind === "draw") { vDrawSave(d.pts); return; }
    if (d.kind === "scale") { vScaleSet(); return; }
    if (d.kind === "align") { vAlignAsk(); return; }
    if (d.kind === "rot") { if (d.a != null) vObjSet(d.o.id, { rot: d.a }); return; }
    if (d.kind === "wend") { vMeasDraw(); if (d.np) vWallMoveEnd(d.pt, d.np, d.lvl); return; }
    if (d.kind === "erase") return;
    if (d.kind === "box") { vMeasDraw(); const x1 = Math.min(d.sx, d.ex), x2 = Math.max(d.sx, d.ex), y1 = Math.min(d.sy, d.ey), y2 = Math.max(d.sy, d.ey), cur = vPageNow(); VTT.multi.clear(); if (cur) vTokens(cur.id).forEach(([id, t]) => { const s = vTokSz(t) / 2, cx = t.x + s, cy = t.y + s; if (t.layer === (VTT.layer === "gm" ? "gm" : "token") && !vLvlHid(t.lvl) && cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) VTT.multi.add(id); }); VTT.sel = VTT.multi.size === 1 ? { kind: "tok", id: [...VTT.multi][0] } : null; if (VTT.multi.size === 1) VTT.multi.clear(); vRefresh(); return; }
    if (d.kind === "group") { document.querySelectorAll(".vtok.dragging").forEach(e => e.classList.remove("dragging")); if (!d.moved) return; const snap = ev.altKey === vNoSnap(), dx = snap ? Math.round(d.dx) : d.dx, dy = snap ? Math.round(d.dy) : d.dy, cur = vPageNow(); d.g.filter(([, q]) => !(q.mount && d.g.some(([gid]) => gid === q.mount))).forEach(([id, q]) => { const s = vTokSz(q), nx = Math.max(0, Math.min((cur ? cur.p.w : 999) - s, q.x + dx)), ny = Math.max(0, Math.min((cur ? cur.p.h : 999) - s, q.y + dy)); S.vttTokens.set(id, Object.assign({}, q, { x: nx, y: ny, mount: null })); vPatch("vtttokens/" + id, q.mount ? { x: nx, y: ny, mount: null } : { x: nx, y: ny }); }); vDraw(); return; }
    if (d.kind === "pan" && d.place) { vLightPlace(d.place[0], d.place[1]); return; }
    if (d.kind === "light") { if (d.moved) vLightSet(d.l.id, { x: d.nx, y: d.ny }); return; }
    VTT.tdrag = null; document.querySelectorAll(".vtok.dragging").forEach(e => e.classList.remove("dragging"));
    if (d.kind === "tok" && VTT.mmove) { VTT.mmove = null; vMeasDraw(); }
    const cur = vPageNow(); if (!cur) return;
    if (d.kind === "tok" && d.moved) {
      const s = vTokSz(d.t), snap = ev.altKey === vNoSnap();
      let [nx, ny] = snap ? vSnapAny(cur.p, d.nx, d.ny, s, d.t) : [d.nx, d.ny];
      if (!d.t.mount && !vIsShip(d.t) && vShipDrop(d.id, d.t, nx, ny, s)) { VTT.lastDrop = d.id; vFog(cur.id, cur.p, vTokens(cur.id)); return; }
      nx = Math.max(0, Math.min(cur.p.w - s, nx)); ny = Math.max(0, Math.min(cur.p.h - s, ny));
      d.el.style.left = nx * VCELL + "px"; d.el.style.top = ny * VCELL + "px";
      if (d.t.mount) { // a rider dragged off its mount gets off there; dropped back on it, it stays on
        const m = S.vttTokens.get(d.t.mount), ms = m ? vTokSz(m) : 0, cx = nx + s / 2, cy = ny + s / 2;
        if (m && cx >= m.x && cx <= m.x + ms && cy >= m.y && cy <= m.y + ms) { vDraw(); return; }
        vDismount(d.id, [nx, ny]); vFog(cur.id, cur.p, vTokens(cur.id)); return;
      }
      VTT.lastDrop = d.id;
      S.vttTokens.set(d.id, Object.assign({}, d.t, { x: nx, y: ny }));
      vPatch("vtttokens/" + d.id, { x: nx, y: ny });
      if (vRidersOf(d.id).length) { vRidersFix(); vDraw(); }
      vFog(cur.id, cur.p, vTokens(cur.id));
    }
    if (d.kind === "obj" && d.moved) vObjSet(d.o.id, { x: Math.round(d.nx * 100) / 100, y: Math.round(d.ny * 100) / 100 });
    if (d.kind === "resize" && d.nw) vObjSet(d.o.id, { w: d.nw, h: d.nh });
  };
  view.addEventListener("pointerup", end); view.addEventListener("pointercancel", end);
  view.addEventListener("contextmenu", ev => { ev.preventDefault(); if (drag && drag.kind === "tok") vAddWaypoint(drag); });
  view.addEventListener("dblclick", ev => { if (vCanEdit() && VTT.tool === "wall") { ev.preventDefault(); vWallFinish(); } });
}
function vSnapWall([x, y], ev, skip) {
  // First the ends of walls already drawn (so lines join up), then the grid's corners, unless snapping is off.
  // Hold Alt to do the opposite of the Snap setting for one click.
  const cur = vPageNow(), r = 0.3 / Math.max(0.5, VTT.zoom);
  let best = null, bd = r;
  if (cur) (cur.p.walls || []).forEach(w => { if ((w[4] || 0) !== VTT.lvl) return; [[w[0], w[1]], [w[2], w[3]]].forEach(q => { if (skip && Math.abs(q[0] - skip[0]) < 1e-6 && Math.abs(q[1] - skip[1]) < 1e-6) return; const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = q; } }); });
  (VTT.draft || []).forEach(q => { const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = q; } });
  if (best) return best.slice();
  const snap = VTT.wallSnap !== false, alt = ev && ev.altKey;
  if (snap !== !!alt) return [Math.round(x), Math.round(y)];
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}
function vWallClick(x, y, ev) {
  const pt = vSnapWall([x, y], ev), now = Date.now(), lc = VTT.lastWallClick;
  // A second click in the same spot straight away finishes the line (the board redraws between clicks, so the browser's own double-click never fires).
  VTT.lastWallClick = { t: now, x: ev.clientX, y: ev.clientY };
  if (VTT.draft && lc && now - lc.t < 400 && Math.hypot(ev.clientX - lc.x, ev.clientY - lc.y) < 8) { VTT.lastWallClick = null; vWallFinish(); return; }
  if (!VTT.draft) VTT.draft = [pt];
  else { const last = VTT.draft[VTT.draft.length - 1]; if (Math.hypot(last[0] - pt[0], last[1] - pt[1]) > 0.02) VTT.draft.push(pt); }
  vDraw();
}
function vWallFinish() {
  const cur = vPageNow(), d = VTT.draft; VTT.draft = null; VTT.hover = null;
  if (cur && d && d.length > 1) {
    if (VTT.tool === "area") { if (d.length < 3) { toast("An area needs at least three points.", "bad"); vDraw(); return; } vPatch("vttpages/" + cur.id, { areas: (cur.p.areas || []).concat([{ id: vid("a"), level: VTT.lvl, pts: d }]), maxLevel: Math.max(cur.p.maxLevel || 0, VTT.lvl) }); return; }
    const segs = []; for (let i = 1; i < d.length; i++) { const k = VTT.wallKind || "wall"; segs.push([d[i - 1][0], d[i - 1][1], d[i][0], d[i][1]].concat(k !== "wall" ? [VTT.lvl || 0, { k, id: vid("d") }] : VTT.lvl ? [VTT.lvl] : [])); }
    vPatch("vttpages/" + cur.id, { walls: (cur.p.walls || []).concat(segs) });
  } else { if (VTT.tool === "area" && d && d.length) toast("An area needs at least three points.", "bad"); vDraw(); }
}
function vObjSet(id, fields) {
  const cur = vPageNow(); if (!cur) return;
  const objs = (cur.p.objs || []).map(o => o.id === id ? Object.assign({}, o, fields) : o);
  cur.p.objs = objs; vPatch("vttpages/" + cur.id, { objs });
}
document.addEventListener("keydown", ev => {
  if (!document.querySelector(".vtt")) return;
  if (ev.target.matches && ev.target.matches("input,textarea,select,[contenteditable]")) return;
  if (document.querySelector("#modal:not([hidden])")) return;
  const k = ev.key;
  if (k === "Escape" && VTT.meas) { vMeasClear(); return; }
  if (k === "m" || k === "M") { vSetTool(VTT.tool === "measure" ? "select" : "measure"); return; }
  if (k === "p" || k === "P") { vSetTool(VTT.tool === "ping" ? "select" : "ping"); return; }
  if ((k === "[" || k === "]") && vCanEdit() && VTT.sel && VTT.sel.kind === "tok") { vTokZ(k === "]" ? "up" : "down"); return; }
  if ((k === "t" || k === "T") && (vCanEdit() || vTravelOk(((vPageNow() || {}).p)))) { vSetTool(VTT.tool === "travel" ? "select" : "travel"); return; }
  if (k === "Enter" && VTT.meas && VTT.meas.shape === "travel" && VTT.meas.open) { vTravelFinish(); return; }
  if ((k === "d" || k === "D") && !ev.ctrlKey && !ev.metaKey) { vSetTool(VTT.tool === "draw" ? "select" : "draw"); return; }
  if (!vCanEdit()) return;
  if (k === "Escape") { if (VTT.draft) { VTT.draft = null; VTT.hover = null; vDraw(); } else if (VTT.sel) { VTT.sel = null; vRefresh(); } }
  else if (k === "Enter" && VTT.draft) vWallFinish();
  else if ((k === "Delete" || k === "Backspace") && (VTT.sel || VTT.multi.size)) { ev.preventDefault(); vDeleteSel(); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === "z" || k === "Z")) { ev.preventDefault(); vUndoRun(ev.shiftKey); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === "y" || k === "Y")) { ev.preventDefault(); vUndoRun(true); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === "c" || k === "C")) { if (vCopy()) ev.preventDefault(); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === "v" || k === "V")) { ev.preventDefault(); vPaste(); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === "d" || k === "D")) { ev.preventDefault(); if (vCopy()) vPaste(1); }
  else if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  else if (k === "v" || k === "V") vSetTool("select");
  else if (k === "h" || k === "H") vSetTool("pan");
  else if (k === "w" || k === "W") vSetTool("wall");
  else if (k === "a" || k === "A") vSetTool("area");
  else if (k === "s" || k === "S") vSetTool("link");
});
// Phones: the tool panel is a sheet over the map, opened with the Tools button.
function vToolsShow(on) {
  VTT.toolsOpen = on; const w = document.querySelector(".vttwrap"), btn = document.querySelector(".vtoolsbtn");
  if (w) w.classList.toggle("toolsopen", on); if (btn) { btn.classList.toggle("on", on); btn.setAttribute("aria-expanded", on); }
}
function vToolsAutoClose() { if (VTT.toolsOpen && matchMedia("(max-width: 860px)").matches) vToolsShow(false); }
function vSetTool(t) { VTT.tool = t; if (t === "area" && !VTT.lvl) vAreaPickLevel(); if (t === "wall" || t === "area" || t === "link") VTT.layer = "walls"; VTT.draft = null; VTT.hover = null; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); if (t !== "travel") VTT.trPaint = ""; vRefresh(); }
async function vDeleteSel() {
  const cur = vPageNow(), s = VTT.sel; if (!cur) return;
  if (VTT.multi.size) { const ids = [...VTT.multi]; VTT.multi.clear(); VTT.sel = null; await vUndoStep(async () => { for (const id of ids) await vDel("vtttokens/" + id); }, `deleting ${ids.length} tokens`); vRefresh(); return; }
  if (!s) return;
  VTT.sel = null;
  if (s.kind === "tok") await vDel("vtttokens/" + s.id);
  else if (s.kind === "obj") await vPatch("vttpages/" + cur.id, { objs: (cur.p.objs || []).filter(o => o.id !== s.id) });
  else if (s.kind === "wall") await vPatch("vttpages/" + cur.id, { walls: (cur.p.walls || []).filter((w, i) => i !== s.i) });
  else if (s.kind === "link") await vPatch("vttpages/" + cur.id, { links: (cur.p.links || []).filter(l => l.id !== s.id) });
  else if (s.kind === "light") await vPatch("vttpages/" + cur.id, { lights: (cur.p.lights || []).filter(l => l.id !== s.id) });
  else if (s.kind === "area") await vPatch("vttpages/" + cur.id, { areas: (cur.p.areas || []).filter(a => a.id !== s.id) });
  vRefresh();
}

// ----- Adding images and tokens -----
function vAddImage(force) {
  const cur = vPageNow(); if (!cur) return;
  const layer = force || (VTT.layer === "gm" ? "gm" : VTT.layer === "token" ? "token" : "map");
  pickImage(async (res, file) => {
    const url = assetPath(res);
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = url; });
    let w = im ? im.naturalWidth / VCELL : cur.p.w, h = im ? im.naturalHeight / VCELL : cur.p.h;
    let grow = null;
    // Grid size in the file name: "tavern 30x40.jpg" (squares) or "tavern 140dpi.jpg" / "140px" (pixels a square).
    const g = im && file && vGridFromName(file.name, im.naturalWidth, im.naturalHeight);
    if (g) { w = g.w; h = g.h; if (layer === "map" && (w > cur.p.w + 0.01 || h > cur.p.h + 0.01)) grow = "grow"; toast(`Read the grid from the file name: ${+w.toFixed(1)} × ${+h.toFixed(1)} squares.`); }
    else if (w > cur.p.w + 0.01 || h > cur.p.h + 0.01) {
      grow = await new Promise(r => openModal(`<h2>The image is bigger than the board</h2>
        <p>At ${VCELL} pixels a square it covers about <strong>${Math.ceil(w)} × ${Math.ceil(h)}</strong> squares; the board is <strong>${cur.p.w} × ${cur.p.h}</strong>.</p>
        <div class="acts wrap"><button class="btn" id="vfit">Shrink the image to fit</button><button class="btn" id="vgrow">Grow the board to ${Math.ceil(Math.max(w, cur.p.w))} × ${Math.ceil(Math.max(h, cur.p.h))}</button><button class="btn ghost" id="vkeep">Leave it as it is</button></div>`, m => {
          m.querySelector("#vfit").onclick = () => { closeModal(); r("fit"); }; m.querySelector("#vgrow").onclick = () => { closeModal(); r("grow"); }; m.querySelector("#vkeep").onclick = () => { closeModal(); r("keep"); };
        }));
      if (grow === "fit") { const f = Math.min(cur.p.w / w, cur.p.h / h); w *= f; h *= f; }
    }
    const o = { id: vid("o"), layer, img: url, x: 0, y: 0, w, h, level: VTT.lvl || 0 };
    const fields = { objs: (layer === "map" ? [o] : []).concat(cur.p.objs || [], layer === "map" ? [] : [o]) };
    if (grow === "grow") { fields.w = Math.max(cur.p.w, Math.ceil(w - 0.01)); fields.h = Math.max(cur.p.h, Math.ceil(h - 0.01)); }
    VTT.sel = { kind: "obj", id: o.id };
    await vPatch("vttpages/" + cur.id, fields);
    if (grow === "grow") { VTT.fitDone = ""; }
  });
}
function vTokenPick() {
  const cur = vPageNow(); if (!cur) return;
  const creatures = [...S.entries].filter(([, e]) => e.type === "creature").sort((a, b) => String(a[1].title).localeCompare(b[1].title));
  const chars = [...S.chars].sort((a, b) => String(a[1].name).localeCompare(b[1].name));
  const vehs = typeof isVehicle === "function" ? [...S.entries].filter(([, e]) => isVehicle(e)).sort((a, b) => String(a[1].title).localeCompare(b[1].title)) : [];
  const tile = (ref, name, img, sub) => `<button class="vtpick" data-ref="${esc(ref)}" data-name="${esc(name)}">${img ? `<img src="${esc(img)}" alt="">` : `<span class="vinit">${esc((name || "?")[0])}</span>`}<span>${esc(name)}${sub ? `<small class="muted">${esc(sub)}</small>` : ""}</span></button>`;
  openModal(`<h2>Add a token</h2><input id="vtq" type="search" placeholder="Search creatures, characters and vehicles" aria-label="Search">
    <div class="vtpicks"><h3>Characters</h3><div class="vtgrid">${chars.map(([id, c]) => tile("c:" + id, c.name, c.token || c.image, charSub ? charSub(c) : "")).join("") || `<p class="muted small">No characters.</p>`}</div>
    ${vehs.length ? `<h3>Vehicles</h3><div class="vtgrid">${vehs.map(([id, e]) => tile("e:" + id, e.title, e.token || e.image, e.item.category)).join("")}</div>` : ""}
    <h3>Bestiary</h3><div class="vtgrid">${creatures.map(([id, e]) => tile("e:" + id, e.title, e.token || e.image, (e.statblock && e.statblock.subtitle) ? e.statblock.subtitle.split(",")[0] : "")).join("") || `<p class="muted small">No creatures yet.</p>`}</div></div>
    <div class="acts"><button class="btn ghost" id="vtnew">Upload a new token picture…</button><button class="btn ghost" data-act="closemodal">Close</button></div>`, m => {
    const q = m.querySelector("#vtq");
    q.oninput = () => { const s = q.value.trim().toLowerCase(); m.querySelectorAll(".vtpick").forEach(b => b.hidden = s && !b.dataset.name.toLowerCase().includes(s)); };
    m.querySelectorAll(".vtpick").forEach(b => b.onclick = () => { closeModal(); vPlaceToken(b.dataset.ref, b.dataset.name); });
    m.querySelector("#vtnew").onclick = () => { closeModal(); pickImage(async res => { const name = await vAsk("Name this token", "Name", "", "Add token"); if (name == null) return; vPlaceToken("", name || "Token", assetPath(res)); }); };
  });
}
const vPickOne = l => l[Math.floor(Math.random() * l.length)];
// Humanoids from the bestiary can become NPCs: tagged humanoid, or "humanoid" in the stat block's subtitle.
function vNpcable(t) {
  if (!(t && (t.ref || "").startsWith("e:"))) return false;
  const e = S.entries.get(t.ref.slice(2)); if (!e || e.type !== "creature") return false;
  return (e.tags || []).some(g => /^humanoids?$/i.test(g) || /^humanoids?$/i.test(typeof tagName === "function" ? tagName(g) : g)) || /humanoid/i.test((e.statblock || {}).subtitle || "");
}
// Any other creature from the bestiary can become a unique creature: its own bestiary entry.
function vUniqueable(t) { if (!(t && (t.ref || "").startsWith("e:"))) return false; const e = S.entries.get(t.ref.slice(2)); return !!e && e.type === "creature"; }
function vUniqueDialog(id) {
  const t = S.vttTokens.get(id), e = t && S.entries.get((t.ref || "").slice(2)); if (!e) return;
  const pic = t.img || entryTokens(e)[0] || e.image || "";
  openModal(`<h2>Make a unique creature</h2>
    <p class="muted small">A bestiary entry of its own, copied from <strong>${esc(e.title)}</strong>: its stat block${pic ? " and this token's picture" : ""}. This token becomes it.</p>
    <form class="vform" id="vuqform">
      <label><span>Name</span><input id="vuq-name" type="text" required value="${esc(t.name || e.title)}"></label>
      <label><span>Lore <small class="muted">optional: what happened, what makes it different</small></span><textarea id="vuq-lore" rows="6" placeholder="Fled the party at the river crossing with an arrow in its flank…"></textarea></label>
      <label class="vcheck"><input id="vuq-keep" type="checkbox" checked> <span>Keep ${esc(e.title)}'s lore underneath</span></label>
      <label class="vcheck"><input id="vuq-hidden" type="checkbox" checked> <span>Hidden from players</span></label>
      <div class="acts"><button class="btn" type="submit">Make unique creature</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div>
    </form>`);
  const f = document.getElementById("vuq-name"); if (f) { f.focus(); f.select(); }
  document.getElementById("vuqform").onsubmit = async ev => {
    ev.preventDefault();
    const name = document.getElementById("vuq-name").value.trim() || e.title, lore = document.getElementById("vuq-lore").value.trim();
    const keep = document.getElementById("vuq-keep").checked, hidden = document.getElementById("vuq-hidden").checked, now = new Date().toISOString();
    const nid = newId(), doc = JSON.parse(JSON.stringify(e));
    Object.assign(doc, { unique: true, title: name, body: [lore, keep && e.body ? (lore ? `### ${e.title}\n\n` : "") + e.body : ""].filter(Boolean).join("\n\n"), npcOf: t.ref.slice(2), created: now, updated: now });
    if (hidden) doc.hidden = true; else delete doc.hidden;
    delete doc.tokNames; delete doc.tokens; delete doc.fromBook; if (pic) doc.token = pic; else delete doc.token; if (!doc.image && pic) doc.image = pic;
    if (!(await safeWrite(() => S.db.doc("entries/" + nid).set(doc)))) return;
    S.entries.set(nid, doc); vPatch("vtttokens/" + id, { ref: "e:" + nid, img: "", name });
    closeModal(); vRefresh(); toast(`${name} is in the bestiary${hidden ? " (hidden from players)" : ""}.`);
  };
}
async function vMakeNpc(id, how) {
  const t = S.vttTokens.get(id), e = t && S.entries.get((t.ref || "").slice(2)); if (!e) return;
  const name = (t.name || e.title || "NPC").trim(), pic = t.img || entryTokens(e)[0] || e.image || "", now = new Date().toISOString();
  if (!(await confirmBox(how === "sheet" ? `Make ${name} a character sheet? It's filled in from ${e.title}'s stat block, hidden from players, and this token becomes it.` : `Make ${name} a bestiary entry of its own? It copies ${e.title}'s stat block and lore, is hidden from players, and this token becomes it.`, how === "sheet" ? "Make character sheet" : "Make bestiary entry"))) return;
  if (how === "entry") {
    const nid = newId(), doc = JSON.parse(JSON.stringify(e));
    Object.assign(doc, { title: name, hidden: true, npcOf: t.ref.slice(2), created: now, updated: now }); delete doc.tokNames; delete doc.tokens;
    if (pic) doc.token = pic; else delete doc.token;
    if (!(await safeWrite(() => S.db.doc("entries/" + nid).set(doc)))) return;
    S.entries.set(nid, doc); vPatch("vtttokens/" + id, { ref: "e:" + nid, img: "" });
    toast(`${name} has a bestiary entry of their own (hidden from players).`);
  } else {
    const sb = e.statblock || {}, c = blankCharacter(name), num = v => parseInt(String(v || ""), 10);
    const hp = num(sb.hp) || num(t.hpMax) || 10, cur = t.hp != null && t.hp !== "" ? Math.min(hp, Number(t.hp) || 0) : hp;
    Object.assign(c, { hidden: true, race: sb.subtitle || "", ac: String(num(sb.ac) || 10), speed: sb.speed || c.speed, hp: { max: hp, cur, temp: Number(t.temp) || 0 },
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, num(sb[k]) || 10])), pbOverride: num(sb.prof) ? String(num(sb.prof)) : "",
      combatNotes: [sb.details, sb.features].filter(Boolean).join("\n\n"), npcOf: e.title });
    if (e.body) c.notes = Object.assign({}, c.notes, { backstory: e.body });
    if (pic) { c.token = pic; c.image = pic; }
    const nid = "c" + Date.now().toString(36);
    if (!(await safeWrite(() => S.db.doc("characters/" + nid).set(c)))) return;
    S.chars.set(nid, c); vPatch("vtttokens/" + id, { ref: "c:" + nid, owner: nid, img: "" });
    toast(`${name} has a character sheet (hidden from players).`);
  }
  closeModal(); vRefresh();
}
function vPlaceToken(ref, name, img) {
  const cur = vPageNow(), view = document.getElementById("vview"); if (!cur) return;
  let size = 1, hpMax = null, extra = {}; if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)), v = e && typeof vehOf === "function" && vehOf(e); if (v) { size = v.size; hpMax = v.hull; if (v.fuel.type === "refuel") extra.fuel = v.fuel.cap; } else if (e) { size = vSizeOf(e); hpMax = parseInt(String((e.statblock || {}).hp || ""), 10) || null;
    const pics = entryTokens(e); if (!img && pics.length > 1) img = vPickOne(pics);
    if (Array.isArray(e.tokNames) && e.tokNames.length) name = vPickOne(e.tokNames); }
    if (v) { const pics = entryTokens(e); if (!img && pics.length > 1) img = vPickOne(pics); } }
  const r = view.getBoundingClientRect(), cx = ((r.width / 2 - VTT.panX) / VTT.zoom) / VCELL, cy = ((r.height / 2 - VTT.panY) / VTT.zoom) / VCELL;
  if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)), v = e && typeof vehOf === "function" && vehOf(e); if (v && v.cx === "complex") { const sid = vShipPlace(cur, ref, e, cx, cy); if (sid) { VTT.sel = { kind: "tok", id: sid }; vRefresh(); } return; } }
  let x = Math.max(0, Math.min(cur.p.w - size, Math.round(cx - size / 2))), y = Math.max(0, Math.min(cur.p.h - size, Math.round(cy - size / 2)));
  if (vHexOf(cur.p)) [x, y] = vSnapTok(cur.p, x, y, size);
  const id = vid("t");
  const owner = ref.startsWith("c:") ? ref.slice(2) : "";
  VTT.sel = { kind: "tok", id };
  if (VTT.layer !== "gm" && VTT.layer !== "token") VTT.layer = "token";
  vSave("vtttokens/" + id, { page: cur.id, layer: VTT.layer === "gm" ? "gm" : "token", x, y, size, img: img || "", name, ref, owner, hp: hpMax, hpMax, created: new Date().toISOString(), ...extra });
}

// Scale a whole page by k: everything on it, plus tokens standing on it (and, for a vehicle's map, tokens aboard that vehicle).
async function vScalePage(pid, k) { const p = S.vttPages.get(pid); if (!p) return; return vTransformPage(pid, k, 0, 0, Math.max(1, Math.ceil(p.w * k - 1e-6)), Math.max(1, Math.ceil(p.h * k - 1e-6))); }
// Each point (x, y) goes to (x * k + dx, y * k + dy), and the page becomes W × H.
async function vTransformPage(pid, k, dx, dy, W, H) {
  const p = S.vttPages.get(pid); if (!p) return;
  const rx = v => Math.round((v * k + dx) * 1000) / 1000, ry = v => Math.round((v * k + dy) * 1000) / 1000, r = v => Math.round(v * k * 1000) / 1000;
  const cx = v => Math.floor(v * k + dx + 1e-6), cy = v => Math.floor(v * k + dy + 1e-6);
  const cells = list => { const out = new Map(); (list || []).forEach(([x, y]) => { const x0 = cx(x), y0 = cy(y), x1 = Math.max(x0, Math.ceil((x + 1) * k + dx - 1e-6) - 1), y1 = Math.max(y0, Math.ceil((y + 1) * k + dy - 1e-6) - 1); for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) out.set(a + "," + b, [a, b]); }); return [...out.values()]; };
  const f = { w: W, h: H,
    objs: (p.objs || []).map(o => Object.assign({}, o, { x: rx(o.x), y: ry(o.y), w: r(o.w), h: r(o.h) })),
    walls: (p.walls || []).map(w => [rx(w[0]), ry(w[1]), rx(w[2]), ry(w[3])].concat(w.slice(4))),
    areas: (p.areas || []).map(a => Object.assign({}, a, a.cells ? { cells: cells(a.cells) } : {}, a.pts ? { pts: a.pts.map(q => [rx(q[0]), ry(q[1])]) } : {})),
    links: (p.links || []).map(l => { const x = cx(l.x), y = cy(l.y); return Object.assign({}, l, { x, y, w: Math.max(1, Math.round((l.x + l.w) * k + dx) - x), h: Math.max(1, Math.round((l.y + l.h) * k + dy) - y) }); }),
    lights: (p.lights || []).map(l => Object.assign({}, l, { x: rx(l.x), y: ry(l.y) })) };
  if (p.off) { f.off = {}; for (const [d, list] of Object.entries(p.off)) { const c = cells((list || []).map(k => k.split(",").map(Number))).filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H).map(([a, b]) => a + "," + b); if (c.length) f.off[d] = c; } }
  if (p.vehicle) { const hm = new Map(); (p.helm || []).forEach(h => { const x = cx(h[0]), y = cy(h[1]), d = h[2] || 0; hm.set(x + "," + y + "," + d, [x, y, d]); }); f.helm = [...hm.values()];
    f.com = Array.isArray(p.com) ? [rx(p.com[0]), ry(p.com[1])] : [f.w / 2, f.h / 2]; }
  await vPatch("vttpages/" + pid, f);
  const sz = t => vTokSz(t), hex = !!vHexOf(p), snap = (v, h) => h ? v : Math.round(v); // tokens land back on a square
  for (const [id, t] of [...S.vttTokens]) {
    if (t.page === pid && !t.ship && !vIsShip(t)) { const s = sz(t) / 2; await vPatch("vtttokens/" + id, { x: snap(rx(t.x + s) - s, hex), y: snap(ry(t.y + s) - s, hex) }); }
    if (p.vehicle && t.ship) { const sh = S.vttTokens.get(t.ship); if (vIsShip(sh) && sh.ref === "e:" + p.vehicle && t.sx != null) { const s = sz(t) / 2; await vPatch("vtttokens/" + id, { sx: snap(rx(t.sx + s) - s), sy: snap(ry(t.sy + s) - s) }); } }
  }
  for (const [id, d] of [...(S.vttDraw || new Map())]) if (d.page === pid && Array.isArray(d.pts)) await vPatch("vttdraw/" + id, { pts: d.pts.map(q => [rx(q[0]), ry(q[1])]) }).catch(() => {});
  if (p.fogMem !== false && !p.vehicle) { VTT.fogBits = null; VTT.fogKey = ""; await vDel("vttfog/" + pid).catch(() => {}); }
}
// The # tool: move and size a grid over the pictures to match the squares drawn in them. Applying it rescales and shifts the
// whole page (every level and layer) so that grid becomes the map's own grid. VTT.gridEd = { pid, ox, oy, g } in squares.
function vGridEd(pid) { if (!VTT.gridEd || VTT.gridEd.pid !== pid) VTT.gridEd = { pid, ox: 0, oy: 0, g: 1 }; return VTT.gridEd; }
function vGridEdDraw() {
  const st = document.getElementById("vstage"), cur = vPageNow(); if (!st) return;
  let el = document.getElementById("vgridedl"); const on = VTT.tool === "gridfit" && cur && vCanEdit() && !VTT.preview;
  st.classList.toggle("vgridediting", !!on);
  if (!on) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "vgridedl"; el.className = "vlayer vgridedl"; st.appendChild(el); }
  const G = vGridEd(cur.id), C = VCELL, gp = G.g * C, W = cur.p.w * C, H = cur.p.h * C, n = 3;
  const ox = ((G.ox % G.g) + G.g) % G.g, oy = ((G.oy % G.g) + G.g) % G.g;
  el.innerHTML = `<svg width="${W}" height="${H}" aria-hidden="true"><defs><pattern id="vgep" x="${ox * C}" y="${oy * C}" width="${gp}" height="${gp}" patternUnits="userSpaceOnUse"><path d="M ${gp} 0 L 0 0 0 ${gp}" fill="none" stroke="rgba(0,0,0,.75)" stroke-width="4"/><path d="M ${gp} 0 L 0 0 0 ${gp}" fill="none" stroke="#3ee6ff" stroke-width="2"/></pattern></defs><rect width="100%" height="100%" fill="url(#vgep)"/>
    <rect class="vgecell" x="${G.ox * C}" y="${G.oy * C}" width="${gp * n}" height="${gp * n}"/></svg>
    <div class="vgehandle" style="left:${(G.ox + G.g * n) * C}px;top:${(G.oy + G.g * n) * C}px" title="Drag to make the squares bigger or smaller"></div>`;
  const o = document.getElementById("vgeout"); if (o) o.textContent = vGridEdText(cur.p, G);
  const si = document.getElementById("vgesize"); if (si && document.activeElement !== si) si.value = Math.round(G.g * 1000) / 10;
}
const vGridEdText = (p, G) => `Squares ${Math.round(G.g * 1000) / 10}% of now · the map would be about ${Math.ceil(p.w / G.g)} × ${Math.ceil(p.h / G.g)}`;
function vGridEdToolsHtml() {
  const cur = vPageNow(); if (!cur) return ""; const G = vGridEd(cur.id), nb = (dx, dy, l, t) => `<button class="vbtn icon" data-act="vttgenudge" data-dx="${dx}" data-dy="${dy}" title="${t}" aria-label="${t}">${l}</button>`;
  return `<div class="vgroup vgridedtools"><span class="vlab">Move the grid</span>
    <p class="muted small vlhint">Drag the blue grid so its lines sit on the squares drawn in the picture. Drag the round handle to size the squares (the box is 3 × 3 squares).</p>
    <div class="vgenudge">${nb(-0.05, 0, "←", "Nudge left")}${nb(0, -0.05, "↑", "Nudge up")}${nb(0, 0.05, "↓", "Nudge down")}${nb(0.05, 0, "→", "Nudge right")}</div>
    <label class="small"><span class="muted">Square size, % of now</span><input type="number" min="20" max="1000" step="0.5" id="vgesize" value="${Math.round(G.g * 1000) / 10}"></label>
    <p class="muted small" id="vgeout">${esc(vGridEdText(cur.p, G))}</p>
    <label class="check small"><input type="checkbox" id="vgefit"${cur.p.vehicle ? " checked" : ""}> Fit the page to the pictures</label>
    <div class="acts"><button class="btn small" data-act="vttgeapply">Apply</button><button class="btn ghost small" data-act="vttgereset">Reset</button></div></div>`;
}
document.addEventListener("input", ev => { if (!ev.target || ev.target.id !== "vgesize" || !VTT.gridEd) return; const v = Number(ev.target.value); if (v >= 20 && v <= 1000) { VTT.gridEd.g = v / 100; vGridEdDraw(); } });
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act=vttgenudge],[data-act=vttgeapply],[data-act=vttgereset]"); if (!b || !vCanEdit()) return;
  const cur = vPageNow(); if (!cur) return; const G = vGridEd(cur.id), a = b.dataset.act;
  if (a === "vttgenudge") { G.ox += Number(b.dataset.dx) * G.g; G.oy += Number(b.dataset.dy) * G.g; vGridEdDraw(); return; }
  if (a === "vttgereset") { VTT.gridEd = null; vGridEd(cur.id); vGridEdDraw(); const i = document.getElementById("vgesize"); if (i) i.value = 100; return; }
  if (Math.abs(G.g - 1) < 1e-4 && Math.abs(G.ox % 1) < 1e-4 && Math.abs(G.oy % 1) < 1e-4) { toast("The grid hasn't moved."); return; }
  const fit = !!(document.getElementById("vgefit") || {}).checked, k = 1 / G.g;
  const ox = ((G.ox % G.g) + G.g) % G.g, oy = ((G.oy % G.g) + G.g) % G.g;
  // The blue line at ox becomes a grid line of the map.
  const dx = -ox * k, dy = -oy * k;
  await vUndoStep(() => vRegridPage(cur.id, k, dx, dy, fit), "moving the grid");
  VTT.gridEd = null; VTT.fitDone = ""; vMount(); const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml();
});
// Scale by k and shift by (dx, dy) whole page; then fit it to the pictures, or keep everything that was on it.
async function vRegridPage(pid, k, dx, dy, fit) {
  const p = S.vttPages.get(pid); if (!p) return;
  const objs = (p.objs || []).filter(o => o.layer === "map" || o.level);
  let W, H;
  if (fit && objs.length) {
    const x0 = Math.min(...objs.map(o => o.x * k + dx)), y0 = Math.min(...objs.map(o => o.y * k + dy)), x1 = Math.max(...objs.map(o => (o.x + o.w) * k + dx)), y1 = Math.max(...objs.map(o => (o.y + o.h) * k + dy));
    const sx = Math.floor(x0 + 0.02), sy = Math.floor(y0 + 0.02); dx -= sx; dy -= sy; W = Math.ceil(x1 - sx - 0.02); H = Math.ceil(y1 - sy - 0.02);
  } else { // keep the old page's corner on the page: whole squares only, so the lines stay put
    const sx = Math.floor(dx + 1e-6), sy = Math.floor(dy + 1e-6); if (sx < 0) dx -= sx; if (sy < 0) dy -= sy; W = Math.ceil(p.w * k + dx - 1e-6); H = Math.ceil(p.h * k + dy - 1e-6);
  }
  W = Math.max(1, Math.min(200, W)); H = Math.max(1, Math.min(200, H));
  await vTransformPage(pid, k, dx, dy, W, H);
  toast(`Grid moved: squares are ${Math.round(k * 1000) / 10}% of what they were in the picture. The page is ${W} × ${H}. Undo puts it back.`);
}
// The ⊞ tool: a line dragged across something on the map, and how many squares it should be. Everything on the page (every
// level and layer) is scaled about the line's start, then nudged so the start sits on a grid line along the way the line runs.
function vAlignAsk() {
  const m = VTT.meas, cur = vPageNow(); if (!m || m.shape !== "align" || !cur) return;
  const p = cur.p, L = Math.hypot(m.e[0] - m.s[0], m.e[1] - m.s[1]); if (L < 0.1) { VTT.meas = null; vMeasDraw(); return; }
  const done = () => { VTT.meas = null; vMeasDraw(); };
  openModal(`<h2>Line up with the grid</h2><form class="vask">
      <p class="muted small">That line is <strong>${L.toFixed(2)}</strong> squares now.</p>
      <label><span>How many squares should it be?</span><input id="al-n" type="number" min="0.25" step="0.25" value="${Math.max(1, Math.round(L))}"></label>
      <label class="check"><input id="al-snap" type="checkbox" checked> Put where the line starts on a grid line</label>
      <label class="check"><input id="al-fit" type="checkbox"${p.vehicle ? " checked" : ""}> Fit the page to the pictures <small class="muted">${p.vehicle ? "the vehicle's footprint is the page, so trim it to the deck pictures" : "trim or grow the page around the pictures"}</small></label>
      <p class="muted small">Every level's pictures move together, and so do walls, doors, raised squares, stairs, lights${p.vehicle ? ", the helm and centre of mass" : ""} and tokens. Undo puts it back.</p>
      <div class="acts"><button class="btn" type="submit">Line up</button><button class="btn ghost" type="button" id="al-no">Cancel</button></div></form>`, md => {
    md.querySelector("#al-no").onclick = () => { closeModal(); done(); };
    md.querySelector("form").onsubmit = async ev => {
      ev.preventDefault(); const n = Number(md.querySelector("#al-n").value); if (!(n > 0)) return;
      const snap = md.querySelector("#al-snap").checked, fit = md.querySelector("#al-fit").checked; closeModal(); done();
      await vUndoStep(() => vAlignPage(cur.id, m.s, m.e, n, snap, fit), "lining up with the grid"); VTT.fitDone = ""; vMount();
    };
    setTimeout(() => { const i = md.querySelector("#al-n"); if (i) { i.focus(); i.select(); } }, 0);
  });
}
async function vAlignPage(pid, A, B, n, snap, fit) {
  const p = S.vttPages.get(pid); if (!p) return;
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), k = n / L, ax = Math.abs(B[0] - A[0]), ay = Math.abs(B[1] - A[1]);
  // Scale about A (A stays put), then nudge A onto a grid line along the way the line runs (both ways if it runs diagonally).
  let dx = A[0] * (1 - k), dy = A[1] * (1 - k);
  if (snap && !vHexOf(p)) { if (ax >= ay * 0.5) dx += Math.round(A[0]) - A[0]; if (ay >= ax * 0.5) dy += Math.round(A[1]) - A[1]; }
  let W = Math.max(1, Math.ceil(p.w * k + dx - 1e-6)), H = Math.max(1, Math.ceil(p.h * k + dy - 1e-6));
  const objs = (p.objs || []).filter(o => o.layer === "map" || o.level);
  if (fit && objs.length) { // whole squares only, so what's lined up stays lined up
    const x0 = Math.min(...objs.map(o => o.x * k + dx)), y0 = Math.min(...objs.map(o => o.y * k + dy)), x1 = Math.max(...objs.map(o => (o.x + o.w) * k + dx)), y1 = Math.max(...objs.map(o => (o.y + o.h) * k + dy));
    const sx = Math.floor(x0 + 0.02), sy = Math.floor(y0 + 0.02); dx -= sx; dy -= sy; W = Math.max(1, Math.ceil(x1 - sx - 0.02)); H = Math.max(1, Math.ceil(y1 - sy - 0.02));
  } else if (!fit) { W = Math.max(p.w, W); H = Math.max(p.h, H); }
  await vTransformPage(pid, k, dx, dy, Math.min(200, W), Math.min(200, H));
  toast(`Lined up: ${n} square${n === 1 ? "" : "s"} across (${Math.round(k * 100)}%). The page is ${Math.min(200, W)} × ${Math.min(200, H)}. Undo puts it back.`);
}
// ----- Page settings -----
function vSettings() {
  const cur = vPageNow(); if (!cur) return;
  const p = cur.p;
  openModal(`<h2>Page settings</h2><form class="vset">
    <label><span>Name</span><input id="vs-name" type="text" value="${esc(p.name || "")}"></label>
    <div class="frow tight"><label><span>Width (squares)</span><input id="vs-w" type="number" min="1" max="200" value="${p.w}"></label><label><span>Height (squares)</span><input id="vs-h" type="number" min="1" max="200" value="${p.h}"></label><label><span>Background</span><input id="vs-bg" type="color" value="${esc(p.bg || "#1b1f27")}"></label></div>
    <label><span>Folder</span><select id="vs-folder"><option value="">(top level)</option>${vFolders(S.vttCamps.get(p.camp)).map(f => `<option value="${esc(f.id)}"${p.folder === f.id ? " selected" : ""}>${esc(vFolderPath(S.vttCamps.get(p.camp), f.parent) + f.name)}</option>`).join("")}</select></label>
    <label class="check"><input id="vs-open" type="checkbox"${p.open ? " checked" : ""}> Players can switch to this map themselves <small class="muted">it appears in their map list, like a base they can teleport to</small></label>
    <label class="check"><input id="vs-grid" type="checkbox"${p.grid !== false ? " checked" : ""}> Show the grid</label>
    <label class="check"><input id="vs-light" type="checkbox"${p.light ? " checked" : ""}> Dynamic lighting <small class="muted">players only see what their tokens can see past walls</small></label>
    <label class="check"><input id="vs-mem" type="checkbox"${p.fogMem !== false ? " checked" : ""}> Remember explored areas <small class="muted">places a token has seen stay dimly visible</small></label>
    <div class="acts wrap"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" id="vs-fog">Reset explored areas</button><button class="btn ghost" type="button" id="vs-walls">Remove all walls</button><button class="btn ghost danger" type="button" id="vs-del">Delete page</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div></form>`, m => {
    m.querySelector("form").onsubmit = ev => {
      ev.preventDefault();
      const n = (id, lo, hi, d) => Math.max(lo, Math.min(hi, Math.round(Number(m.querySelector(id).value) || d)));
      vPatch("vttpages/" + cur.id, { name: m.querySelector("#vs-name").value.trim() || "Page", w: n("#vs-w", 1, 200, 15), h: n("#vs-h", 1, 200, 15), bg: m.querySelector("#vs-bg").value, grid: m.querySelector("#vs-grid").checked, light: m.querySelector("#vs-light").checked, fogMem: m.querySelector("#vs-mem").checked, folder: m.querySelector("#vs-folder").value, open: m.querySelector("#vs-open").checked });
      VTT.fitDone = ""; closeModal();
    };
    m.querySelector("#vs-fog").onclick = async () => { closeModal(); if (await confirmBox("Forget everything the players' tokens have explored on this page?", "Reset")) { VTT.fogBits = null; VTT.fogKey = ""; await vDel("vttfog/" + cur.id).catch(() => {}); vDraw(); } };
    m.querySelector("#vs-walls").onclick = async () => { closeModal(); if (await confirmBox(`Remove all ${(p.walls || []).length} walls from this page?`, "Remove walls")) vPatch("vttpages/" + cur.id, { walls: [] }); };
    m.querySelector("#vs-del").onclick = async () => {
      closeModal(); if (!(await confirmBox(`Delete the page “${p.name}” and its tokens?`, "Delete page"))) return;
      for (const [tid] of vTokens(cur.id)) await vDel("vtttokens/" + tid);
      await vDel("vttfog/" + cur.id).catch(() => {}); await vDel("vttpages/" + cur.id); VTT.page = null; render();
    };
  });
}

// ----- Actions -----
async function vttAction(a, el, ev) {
  if (a === "vttexfill") { const t = S.vttTokens.get(el.dataset.id), ex = vExOf(t); if (!ex) return;
    if (!vCanEdit() && !((t.ref || "").startsWith("s:") && PLAYER && vPlayerTok(t))) return;
    const max = ex.cur ? ex.max : ex.max + ex.rise; vExSave(el.dataset.id, t, { ex: max, exMax: max }); return; }
  if (a === "vttvres") { const t = S.vttTokens.get(el.dataset.id), i = Number(el.dataset.i); if (!t) return; const x = vVehRes(Object.assign({ _id: el.dataset.id }, t)).find(q => q.i === i); if (x) vVehResSet(el.dataset.id, i, x.have + Number(el.dataset.d)); return; }
  if (a === "vttvrest") { vVehRest(el.dataset.id, el.dataset.v === "short" ? "short" : "long"); return; }
  if (a === "vttshipview") { const id = el.dataset.id; VTT.shipView = VTT.shipView || {}; if (el.dataset.v === "") delete VTT.shipView[id]; else VTT.shipView[id] = Number(el.dataset.v); vDraw(); vRefresh(); return; }
  if (a === "vttdecktabs") { VTT.deckTabs = !vDeckTabsOn(); try { localStorage.setItem("vttDeckTabs", VTT.deckTabs ? "1" : "0"); } catch (e) {} vDraw(); vRefresh(); return; }
  if (a === "vttdismount") { const r = S.vttTokens.get(el.dataset.id); if (r && (vCanEdit() || (PLAYER && vPlayerTok(r)))) vDismount(el.dataset.id); return; }
  if (a === "vttpfloor") { VTT.pfloor = el.dataset.v === "" ? null : Number(el.dataset.v); vDraw(); return; }
  if (/^vtt(newcamp|rencamp|delcamp)$/.test(a)) return vttCampAction(a, el);
  if (a === "vttvehmap") { if (vCanEdit()) vOpenWorkshop(el.dataset.id); return; }
  const root = document.querySelector(".vtt"), camp = root && root.dataset.camp;
  if (a === "vttzoom") { const v = Number(el.dataset.v), view = document.getElementById("vview"), r = view.getBoundingClientRect(); if (!v) vFit(); else vZoomAt(v > 0 ? 1.25 : 0.8, r.width / 2, r.height / 2); return; }
  if (a === "vtttool" && !vCanEdit()) { vSetTool(["measure", "ping", "draw", "travel"].includes(el.dataset.v) ? el.dataset.v : "select"); return; }
  if (a === "vtttool" && el.dataset.v === "measure") { vSetTool(VTT.tool === "measure" && !vCanEdit() ? "select" : "measure"); vToolsAutoClose(); return; }
  if (a === "vttmshape") { VTT.mshape = el.dataset.v; if (VTT.tool !== "measure") vSetTool("measure"); else { const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false); } return; }
  if (a === "vttmbeam") { VTT.mbeam = Number(el.value) || 5; if (VTT.meas && VTT.meas.shape === "beam") { VTT.meas.bw = VTT.mbeam; vLiveMeas(true); } vMeasDraw(); return; }
  if (a === "vttmclear") { vMeasClear(); return; }
  if (a === "vttmbcast") { VTT.mbcast = el.checked; try { localStorage.setItem("vttBcast", el.checked ? "1" : "0"); } catch (e) {} vLiveMeas(true); return; }
  if (a === "vttmyname") { const n = await vAsk("Your name", "Shown with your pings and measurements", vLiveName(), "Save"); if (!n) return; try { localStorage.setItem("vttName", n); } catch (e) {} vMeasToolsRefresh(); return; }
  if (a === "vttdmg") { vDamage(el); return; }
  if (a === "vttdmgmode") { VTT.dmgMode = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(b => { const on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); const n = document.querySelector(".vhpn"); if (n) n.focus(); return; }
  if (a === "vttfly") { vFly(Number(el.dataset.v)); return; }
  if (a === "vttlvlup") { vTokLevel(Number(el.dataset.v)); return; }
  if (a === "vttsummon" || a === "vttunsummon") { const ref = el.dataset.ref, cid = ref.split(":")[1]; if (!vCanEdit() && !(PLAYER && S.chars.has(cid))) return; if (a === "vttsummon") vSummonPlace(ref, el.dataset.near); else vSummonRemove(ref); return; }
  if (a === "vttgoparty") { VTT.ppage = null; VTT.fitDone = ""; render(); return; }
  if (/^vttcond(add|n|del|info)$/.test(a)) return vCondAction(a, el);
  if (a === "vtttoklight") return; // handled on change
  if (a === "vttfxlocal") { VTT.fxOff = !VTT.fxOff; try { localStorage.setItem("vttFxOff", VTT.fxOff ? "1" : "0"); } catch (e) {} vDraw(); const tl = document.getElementById("vtools"); if (tl && vCanEdit()) tl.innerHTML = vToolsHtml(); return; }
  if (/^vttpen/.test(a)) return vPenAction(a, el);
  if (/^vttq/.test(a) && !/^vttq(new|edit|del|show|step)$/.test(a)) return vQuestAction(a, el);
  if (a === "vttinitmin") { VTT.initMin = !VTT.initMin; vInitDraw(true); return; }
  if (a === "vttbarstep" || a === "vttbared" || a === "vttbarop") {
    const id = el.dataset.id, key = el.dataset.k, t = S.vttTokens.get(id), b = t && vBars(t).find(x => vBarEdKey(x) === key);
    if (!b || !vBarCanEdit(t, b)) return;
    if (a === "vttbared") { VTT.barEd = VTT.barEd === id + "|" + key ? "" : id + "|" + key; vRefresh(); const n = document.querySelector(".vbared input"); if (n) n.focus(); return; }
    if (a === "vttbarstep") { vBarSetValue(id, key, b.cur + Number(el.dataset.v)); return; }
    const box = el.closest(".vbared"), inp = box && box.querySelector("input"), n = Math.abs(Number(inp && inp.value));
    if (!inp || inp.value === "" || !isFinite(n)) { if (inp) inp.focus(); return; }
    vBarSetValue(id, key, el.dataset.op === "set" ? n : el.dataset.op === "add" ? b.cur + n : b.cur - n);
    inp.value = ""; return;
  }
  if (a === "vttinitsel") { const id = el.dataset.tok, t = S.vttTokens.get(id); if (!t || !(vCanEdit() || (PLAYER && vPlayerTok(t)))) return;
    const here = vPageNow(); if (!here || t.page !== here.id) { toast(`${t.name || "That token"} is on another map.`); return; }
    VTT.multi.clear(); VTT.sel = { kind: "tok", id }; const s = vTokSz(t) / 2; vCenterOn(t.x + s, t.y + s); vDraw(); vRefresh(); vInitDraw(true); return; }
  // Players plan routes too: pace and clearing work for everyone.
  if (a === "vtttpace") { VTT.pace = el.dataset.v; VTT.travelBy = ""; if (VTT.meas && VTT.meas.shape === "travel") { VTT.meas.pace = VTT.pace; VTT.meas.by = ""; vMeasDraw(); vLiveMeas(true); } vMeasToolsRefresh(); return; }
  if (a === "vtttclear") { vMeasClear(); return; }
  if (!vCanEdit()) return;
  if (a === "vtttoolsopen") { vToolsShow(!VTT.toolsOpen); return; }
  if (a === "vttundo" || a === "vttredo") { vUndoRun(a === "vttredo"); return; }
  if (a === "vttlvldlg") { vLevelsDialog(); return; }
  if (/^vttinit/.test(a)) return vInitAction(a, el);
  if (/^vttq/.test(a)) return vQuestAction(a, el);
  if (/^vttmulti/.test(a)) return vMultiAction(a, el);
  if (a === "vttscaleclr") { const cur = vPageNow(); if (cur) vPatch("vttpages/" + cur.id, { scale: null }); return; }
  if (a === "vttwsnap") { VTT.wallSnap = el.checked; try { localStorage.setItem("vttWallSnap", el.checked ? "1" : "0"); } catch (e) {} return; }
  if (a === "vttobjrot") { const cur = vPageNow(), o = cur && VTT.sel && (cur.p.objs || []).find(q => q.id === VTT.sel.id); if (o) vObjSet(o.id, { rot: (((Number(o.rot) || 0) + Number(el.dataset.v)) % 360 + 360) % 360 }); return; }
  if (a === "vtttokz") return vTokZ(el.dataset.v);
  if (a === "vttmapimg") { vAddImage("map"); return; }
  if (a === "vttwk") { VTT.wallKind = el.dataset.v; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); return; }
  if (a === "vttfxhide") { const cur = vPageNow(); if (!cur) return; vPatch("vttpages/" + cur.id, { fx: Object.assign({}, cur.p.fx, { hide: el.checked }) }); return; }
  if (a === "vttfx") { const cur = vPageNow(); if (!cur) return; const fx = Object.assign({ a: 60 }, cur.p.fx || {}, { k: el.value }); if ((cur.p.fx || {}).k === fx.k) return; cur.p.fx = fx; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vDraw(); vPatch("vttpages/" + cur.id, { fx }); return; }
  if (/^vttcl/.test(a) || a === "vttcondlib") return vCondLibAction(a, el);
  if (/^vttll/.test(a) || a === "vttlightlib") return vLightLibAction(a, el);
  if (/^vtt(maps|fold|newfolder|renfolder|delfolder|newmap|newmapimg|renpage|openmap|sendto)$/.test(a)) return vMapsAction(a, el);
  if (a === "vttlvlall") { VTT.lvlShow = null; VTT.sel = null; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vRefresh(); return; }
  if (a === "vttlvlshow") { const n = Number(el.dataset.v) || 0;
    if (!VTT.lvlShow) { VTT.lvlShow = new Set([n]); VTT.lvl = n; }
    else if (VTT.lvlShow.has(n)) { VTT.lvlShow.delete(n); if (!VTT.lvlShow.size) VTT.lvlShow = null; else if (VTT.lvl === n) VTT.lvl = Math.max(...VTT.lvlShow); }
    else { VTT.lvlShow.add(n); VTT.lvl = n; }
    VTT.sel = null; VTT.multi.clear(); VTT.draft = null; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vRefresh(); return; }
  if (a === "vttlvl") { const n = Number(el.dataset.v) || 0; VTT.lvlShow = VTT.lvlShow && VTT.lvlShow.size === 1 && VTT.lvlShow.has(n) ? null : new Set([n]); VTT.lvl = n; VTT.sel = null; VTT.multi.clear(); VTT.draft = null; const tl0 = document.getElementById("vtools"); if (tl0) tl0.innerHTML = vToolsHtml(); const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vRefresh(); return; }
  if (a === "vttaddlvl") { const cur = vPageNow(); if (!cur) return; const below = el.dataset.v === "below";
    const n = below ? vMinLevel(cur.p) - 1 : vMaxLevel(cur.p) + 1;
    const name = await vAsk(below ? "New level below" : "New level", "Name (optional)", below ? (n === -1 ? "Cellar" : "Deeper level") : n === 1 ? "Rooftops / upper floor" : "Level " + n, "Add level"); if (name == null) return;
    const names = Object.assign({}, cur.p.levelNames || {}); if (name) names[n] = name; VTT.lvl = n; if (VTT.lvlShow) VTT.lvlShow = new Set([n]);
    await vPatch("vttpages/" + cur.id, Object.assign({ levelNames: names }, below ? { minLevel: n } : { maxLevel: n })); return; }
  if (a === "vttlvlmove") { const cur = vPageNow(); if (!cur) return; const n = Number(el.dataset.v) || 0, m = n + Number(el.dataset.d);
    if (m < vMinLevel(cur.p) || m > vMaxLevel(cur.p)) return; vUndoStep(() => vLevelSwap(cur, n, m), "moving a level"); VTT.lvl = m; if (VTT.lvlShow) VTT.lvlShow = new Set([m]); return; }
  if (a === "vttrenlvl") { const cur = vPageNow(); if (el.dataset.v) VTT.lvl = Number(el.dataset.v) || 0; if (!cur) return; const name = await vAsk("Rename level", "Name (blank for the plain name)", (cur.p.levelNames || {})[VTT.lvl] || "", "Save"); if (name == null) return; const names = Object.assign({}, cur.p.levelNames || {}); if (name.trim()) names[VTT.lvl] = name.trim(); else delete names[VTT.lvl]; vPatch("vttpages/" + cur.id, { levelNames: names }); return; }
  if (a === "vttbarvis") { const id = el.dataset.id, t = S.vttTokens.get(id); if (!t) return;
    const vis = Object.assign({}, t.barVis || {}), v = el.dataset.v;
    if (el.dataset.k === "*") vBars(t).forEach(b => { vis[vBarKey(b)] = v; }); else vis[el.dataset.k] = v;
    S.vttTokens.set(id, Object.assign({}, t, { barVis: vis })); vPatch("vtttokens/" + id, { barVis: vis }); vTokOptions(id); return; }
  if (a === "vttcbar") { const t = S.vttTokens.get(el.dataset.id); if (!t) return; vPatch("vtttokens/" + el.dataset.id, { cbars: (t.cbars || []).map(b => b.id === el.dataset.b ? Object.assign({}, b, { cur: Math.max(0, Math.min(Number(b.max) || 0, (Number(b.cur) || 0) + Number(el.dataset.v))) }) : b) }); return; }
  if (a === "vttcbaradd" || a === "vttcbarrm") { const id = el.dataset.id, t = S.vttTokens.get(id); if (!t) return;
    const list = (t.cbars || []).slice();
    if (a === "vttcbaradd") list.push({ id: vid("b"), name: "", cur: 10, max: 10, color: ["#6f8cff", "#b46ee0", "#4cc3c9", "#e05a8a"][list.length % 4] }); else list.splice(list.findIndex(b => b.id === el.dataset.b), 1);
    S.vttTokens.set(id, Object.assign({}, t, { cbars: list })); vPatch("vtttokens/" + id, { cbars: list }); vTokOptions(id); return; }
  if (a === "vttopts") { if (VTT.sel && VTT.sel.kind === "tok") vTokOptions(VTT.sel.id); return; }
  if (a === "vttsizeauto") { const box = el.closest(".vform"), t = box && S.vttTokens.get(box.dataset.tok), k = t && vShiftKey(t); if (!k) return; const fsz = Object.assign({}, t.fsz || {}); delete fsz[k]; vPatch("vtttokens/" + box.dataset.tok, { fsz }); const v = vFormSz(t, k); box.querySelectorAll("[data-act=vttsize]").forEach(b => { b.classList.toggle("on", Number(b.dataset.v) === v); b.setAttribute("aria-pressed", Number(b.dataset.v) === v); }); const cs = box.querySelector(".vsizec input"); if (cs) cs.value = v > 5 || v % 1 ? v : ""; vSizeNote(box, false); return; }
  if (a === "vttsize") { const box = el.closest(".vform"); if (box) { vSizePatch(box.dataset.tok, Number(el.dataset.v)); vSizeNote(box, true); box.querySelectorAll("[data-act=vttsize]").forEach(b => { b.classList.toggle("on", b === el); b.setAttribute("aria-pressed", b === el); }); const cs = box.querySelector(".vsizec input"); if (cs) cs.value = ""; } return; }
  if (a === "vttrandname") { const t = S.vttTokens.get(el.dataset.id), e = t && S.entries.get((t.ref || "").slice(2)); if (!e || !(e.tokNames || []).length) return;
    const others = e.tokNames.length > 1 ? e.tokNames.filter(n => n !== t.name) : e.tokNames, n = vPickOne(others); vPatch("vtttokens/" + el.dataset.id, { name: n }); const f = document.querySelector('.vopts [data-vf="name"]'); if (f) f.value = n; return; }
  if (a === "vttsetpic") { const id = el.dataset.id, t = S.vttTokens.get(id), e = t && S.entries.get((t.ref || "").slice(2)); if (!e) return;
    const pics = entryTokens(e); let v = el.dataset.v; if (v === "*") { const cur = t.img || pics[0]; v = vPickOne(pics.length > 1 ? pics.filter(p => p !== cur) : pics); }
    S.vttTokens.set(id, Object.assign({}, t, { img: v })); vPatch("vtttokens/" + id, { img: v }); vTokOptions(id); return; }
  if (a === "vttnpc") { vMakeNpc(el.dataset.id, el.dataset.v); return; }
  if (a === "vttunique") { vUniqueDialog(el.dataset.id); return; }
  if (a === "vttdeltok") { closeModal(); VTT.sel = { kind: "tok", id: el.dataset.id }; vDeleteSel(); return; }
  if (a === "vttpage") { VTT.page = el.dataset.id; VTT.sel = null; VTT.draft = null; render(); }
  else if (a === "vttaddpage") { const name = await vAsk("New page", "Name", "Page " + (vPages(camp).length + 1), "Add page"); if (!name) return; VTT.page = await vNewPage(camp, name, vPages(camp).length); render(); }
  else if (a === "vttsend") { await vPatch("vttcamps/" + camp, { playerPage: VTT.page }); toast("Players are now on this page"); }
  else if (a === "vttsettings") { VTT.sel = null; VTT.multi.clear(); vRefresh(); const sd = document.getElementById("vside"); if (sd) { sd.scrollTop = 0; const f = sd.querySelector("#ps-name"); if (f) f.focus(); } }
  else if (a === "vttlayer") { vToolsAutoClose(); VTT.layer = el.dataset.v; VTT.sel = null; if (VTT.tool === "wall" && VTT.layer !== "walls") VTT.tool = "select"; document.getElementById("vtools").innerHTML = vToolsHtml(); vRefresh(); }
  else if (a === "vtttool") { vSetTool(el.dataset.v); vToolsAutoClose(); }
  else if (a === "vttpreview") { VTT.preview = el.checked; vDraw(); }
  else if (a === "vttaddimg") vAddImage();
  else if (a === "vtttokpick") vTokenPick();
  else if (a === "vttdel") vDeleteSel();
  else if (a === "vttobjfit") { const cur = vPageNow(), o = cur && (cur.p.objs || []).find(x => x.id === VTT.sel.id); if (o) vObjSet(o.id, { x: 0, y: 0, w: cur.p.w, h: cur.p.h }); }
  else if (a === "vttobjz") { const cur = vPageNow(); if (!cur) return; const objs = (cur.p.objs || []).slice(), i = objs.findIndex(x => x.id === VTT.sel.id); if (i < 0) return; const [o] = objs.splice(i, 1); if (el.dataset.v === "back") objs.unshift(o); else objs.push(o); vPatch("vttpages/" + cur.id, { objs }); }
}
// Fields in the side panel.
document.addEventListener("change", ev => {
  const cb = ev.target.closest && ev.target.closest(".vform .vcbrow [data-cb]");
  if (cb && vCanEdit()) { const form = cb.closest(".vform"), row = cb.closest(".vcbrow"), id = form.dataset.tok, t = S.vttTokens.get(id); if (!t) return;
    const k = cb.dataset.cb, v = k === "cur" || k === "max" ? Math.max(0, Number(cb.value) || 0) : cb.value;
    vPatch("vtttokens/" + id, { cbars: (t.cbars || []).map(b => b.id === row.dataset.b ? Object.assign({}, b, { [k]: v }) : b) }); return; }
  const f = ev.target.closest && ev.target.closest(".vform [data-vf]"); if (!f || !vCanEdit()) return;
  const form = f.closest(".vform"), k = f.dataset.vf;
  if (form.dataset.tok) { let v = ["size", "hp", "hpMax", "temp", "dv", "ex", "exMax", "exRise"].includes(k) ? (f.value === "" ? null : Number(f.value)) : f.value; if (/^ex/.test(k)) { const t0 = S.vttTokens.get(form.dataset.tok); if (t0) vPatch("vtttokens/" + form.dataset.tok, vExFields(t0, { [k]: v })); return; }
    if (k === "size") { if (!(v > 0)) return; v = Math.max(0.5, Math.min(40, Math.round(v * 2) / 2)); form.querySelectorAll("[data-act=vttsize]").forEach(b => b.classList.toggle("on", Number(b.dataset.v) === v)); vSizePatch(form.dataset.tok, v); vSizeNote(form, true); return; } vPatch("vtttokens/" + form.dataset.tok, { [k]: v }); }
  else if (form.dataset.obj) { const v = k === "w" || k === "h" ? Math.max(0.25, Number(f.value) || 1) : k === "level" ? Number(f.value) || 0 : f.value; if (k === "layer") VTT.layer = v; vObjSet(form.dataset.obj, { [k]: v }); const tl = document.getElementById("vtools"); if (tl && k === "layer") tl.innerHTML = vToolsHtml(); }
});

// ----- Measuring -----
const VSHAPES = [["line", "📏", "Ruler"], ["beam", "▬", "Line / beam"], ["cone", "◣", "Cone"], ["square", "■", "Cube / square"], ["circle", "●", "Sphere / circle"]];
function vMeasToolsHtml(gm) {
  const on = VTT.tool === "measure";
  const bc = window.__CODEX_SERVER ? `<label class="check small vbcast" title="Everyone at the table sees your measurements"><input type="checkbox" data-act="vttmbcast"${VTT.mbcast ? " checked" : ""}> Broadcast</label>` : "";
  const clr = VTT.meas ? `<button class="vbtn" data-act="vttmclear" title="Clear your measurement (Esc)">✕ Clear</button>` : "";
  const shapes = VSHAPES.map(([v, i, l]) => `<button class="vbtn icon${VTT.mshape === v ? " on" : ""}" data-act="vttmshape" data-v="${v}" title="${l}" aria-label="${l}" aria-pressed="${VTT.mshape === v}">${i}</button>`).join("");
  const beam = VTT.mshape === "beam" ? `<select data-act="vttmbeam" class="vbeamw" aria-label="Beam width">${[5, 10, 15, 20, 30].map(n => `<option value="${n}"${VTT.mbeam === n ? " selected" : ""}>${n} ft</option>`).join("")}</select>` : "";
  if (gm) return on || VTT.meas ? `<div class="vgroup"><span class="vlab">Measure</span>${on ? `<div class="vshapes">${shapes}</div>${beam ? `<label class="small">Width ${beam}</label>` : ""}` : ""}<div class="vmrow">${bc}${clr}</div></div>` : "";
  return `<button class="vbtn icon${!on && VTT.tool !== "ping" ? " on" : ""}" data-act="vtttool" data-v="select" title="Move tokens" aria-label="Move tokens">↖</button><button class="vbtn icon${on ? " on" : ""}" data-act="vtttool" data-v="measure" title="Measure (M)" aria-label="Measure">📏</button>${vTravelOk((vPageNow() || {}).p) ? `<button class="vbtn icon${VTT.tool === "travel" ? " on" : ""}" data-act="vtttool" data-v="travel" title="Travel (T): click out a route to see how long it takes" aria-label="Travel">🧭</button>` : ""}<button class="vbtn icon${VTT.tool === "draw" ? " on" : ""}" data-act="vtttool" data-v="draw" title="Draw (D): doodle on the map" aria-label="Draw">✏️</button><button class="vbtn icon${VTT.tool === "ping" ? " on" : ""}" data-act="vtttool" data-v="ping" title="Ping (P): tap the map to point something out. You can also hold your finger or mouse still on the map." aria-label="Ping">📍</button>
    ${on ? `<span class="vsep"></span>${shapes}${beam}` : ""}${VTT.tool === "travel" ? `<span class="vsep"></span>${vTravelToolsHtml(false)}` : ""}${VTT.tool === "draw" ? `<span class="vsep"></span>${vPenHtml(false)}` : ""}${vQuestBtn()}${on || VTT.meas ? `<span class="vsep"></span>${bc}${clr}` : ""}${(((vPageNow() || {}).p || {}).fx || {}).k ? `<span class="vsep"></span><button class="vbtn icon${VTT.fxOff ? "" : " on"}" data-act="vttfxlocal" title="Weather and lighting effects on this device" aria-label="Weather effects" aria-pressed="${!VTT.fxOff}">🌦</button>` : ""}${window.__CODEX_SERVER ? `<span class="vsep"></span><button class="vbtn" data-act="vttmyname" title="Your name on pings and measurements">👤 ${esc(vLiveName())}</button>` : ""}`;
}
function vMeasToolsRefresh() { const tl = document.getElementById("vtools"); if (tl && vCanEdit()) tl.innerHTML = vToolsHtml(); const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false); }
function vMeasClear() { VTT.meas = null; vMeasDraw(); vLiveMeas(true); vMeasToolsRefresh(); }
// D&D 5e distance: every square, straight or diagonal, is 5 ft.
const vFt5 = (dx, dy) => Math.round(Math.max(Math.abs(dx), Math.abs(dy))) * 5;
const vFtE = (dx, dy) => Math.round(Math.hypot(dx, dy)) * 5;
function vMeasShape(m) {
  if (m.shape === "travel") { const pts = m.pts.concat(m.open && m.hover ? [m.hover] : []); return { path: pts, label: vTravelLabel(pts, m.pace, m.by), at: pts[pts.length - 1], nohits: true, travel: true }; }
  if (m.shape === "align") { const L = Math.hypot(m.e[0] - m.s[0], m.e[1] - m.s[1]); return { line: [m.s[0], m.s[1], m.e[0], m.e[1]], label: `${L.toFixed(2)} squares now`, at: m.e }; }
  if (m.shape === "scale") return { line: [m.s[0], m.s[1], m.e[0], m.e[1]], label: "This much travel is…", at: m.e };
  const hp = (vPageNow() || {}).p, hx = vHexOf(hp);
  if (m.shape === "path" && hx) { let n = 0; for (let i = 1; i < m.pts.length; i++) n += vHexDist(vHexNear(hp, m.pts[i - 1][0], m.pts[i - 1][1]), vHexNear(hp, m.pts[i][0], m.pts[i][1])); return { path: m.pts, label: vHexText(hp, n), at: m.pts[m.pts.length - 1] }; }
  if (m.shape === "path") { let ft = 0; for (let i = 1; i < m.pts.length; i++) ft += vFt5(m.pts[i][0] - m.pts[i - 1][0], m.pts[i][1] - m.pts[i - 1][1]); return { path: m.pts, label: `${ft} ft${m.pts.length > 2 ? ` · ${m.pts.length - 2} turn${m.pts.length > 3 ? "s" : ""}` : ""}`, at: m.pts[m.pts.length - 1] }; }
  const [sx, sy] = m.s, [ex, ey] = m.e, dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy), ux = L ? dx / L : 1, uy = L ? dy / L : 0;
  if (m.shape === "beam") { const bw = m.bw || VTT.mbeam, hw = (bw / 5) / 2, nx = -uy * hw, ny = ux * hw; return { poly: [[sx + nx, sy + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [sx - nx, sy - ny]], label: `${vFtE(dx, dy)} ft line, ${bw} ft wide`, at: [ex, ey] }; }
  if (m.shape === "cone") { const hw = L / 2, nx = -uy * hw, ny = ux * hw; return { poly: [[sx, sy], [ex + nx, ey + ny], [ex - nx, ey - ny]], label: `${vFtE(dx, dy)} ft cone`, at: [ex, ey] }; }
  if (m.shape === "square") { const side = Math.max(Math.abs(dx), Math.abs(dy)), side5 = Math.max(1, Math.round(side)), x2 = sx + Math.sign(dx || 1) * side5, y2 = sy + Math.sign(dy || 1) * side5; return { poly: [[sx, sy], [x2, sy], [x2, y2], [sx, y2]], label: `${side5 * 5} ft cube`, at: [x2, y2] }; }
  if (m.shape === "circle") { const r = Math.max(0.5, Math.round(L * 2) / 2); return { circle: [sx, sy, r], label: `${Math.round(r) * 5} ft radius`, at: [ex, ey] }; }
  if (hx) return { line: [sx, sy, ex, ey], label: vHexText(hp, vHexDist(vHexNear(hp, sx, sy), vHexNear(hp, ex, ey))), at: [ex, ey] };
  return { line: [sx, sy, ex, ey], label: `${vFt5(dx, dy)} ft`, at: [ex, ey] };
}
const vHexText = (p, n) => `${n} hex${n === 1 ? "" : "es"}${Number(p.hexMi) > 0 ? ` · ${Math.round(n * p.hexMi * 10) / 10} mi` : ""}`;
function vMeasSvg(m, col, who) {
  const g = vMeasShape(m), C = VCELL, P = q => q[0] * C + "," + q[1] * C;
  let shape = "", cells = "";
  // Squares whose centres fall inside an area template get shaded.
  const inside = (cx, cy) => g.circle ? Math.hypot(cx - g.circle[0], cy - g.circle[1]) <= g.circle[2] + 1e-6 : g.poly ? vInPoly(cx, cy, g.poly) : false;
  if (g.path) {
    const cur = vPageNow(), hits = [];
    const segs = g.path.slice(1).map((b, i) => { const a = g.path[i], x = cur && !g.nohits ? vWallHits(cur.p, m.h || 0, a, b) : []; hits.push(...x); return `<line class="${x.length ? "blocked" : ""}" x1="${a[0] * C}" y1="${a[1] * C}" x2="${b[0] * C}" y2="${b[1] * C}"/>`; }).join("");
    shape = segs + g.path.slice(1, -1).map(q => `<circle class="wp" cx="${q[0] * C}" cy="${q[1] * C}" r="6"/>`).join("") + `<circle class="dot" cx="${g.path[0][0] * C}" cy="${g.path[0][1] * C}" r="5"/>` + hits.map(([hx, hy]) => `<g class="hit" transform="translate(${hx * C},${hy * C})"><circle r="11"/><path d="M-5 -5L5 5M5 -5L-5 5"/></g>`).join("");
  } else if (g.poly || g.circle) {
    const cur = vPageNow(), W = cur ? cur.p.w : 50, H = cur ? cur.p.h : 50;
    const xs = g.circle ? [g.circle[0] - g.circle[2], g.circle[0] + g.circle[2]] : g.poly.map(q => q[0]), ys = g.circle ? [g.circle[1] - g.circle[2], g.circle[1] + g.circle[2]] : g.poly.map(q => q[1]);
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(W, Math.ceil(Math.max(...xs))); x++) for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(H, Math.ceil(Math.max(...ys))); y++) if (inside(x + 0.5, y + 0.5)) cells += `<rect x="${x * C}" y="${y * C}" width="${C}" height="${C}"/>`;
    shape = g.circle ? `<circle cx="${g.circle[0] * C}" cy="${g.circle[1] * C}" r="${g.circle[2] * C}"/>` : `<polygon points="${g.poly.map(P).join(" ")}"/>`;
  } else shape = `<line x1="${g.line[0] * C}" y1="${g.line[1] * C}" x2="${g.line[2] * C}" y2="${g.line[3] * C}"/><circle class="dot" cx="${g.line[0] * C}" cy="${g.line[1] * C}" r="5"/>`;
  const label = (who ? who + " · " : "") + g.label, lx = g.at[0] * C + 14, ly = g.at[1] * C - 14, w = label.length * 8.4 + 18;
  return `<g class="mset${who ? " remote" : ""}"${col ? ` style="--mc:${esc(col)}"` : ""}><g class="cells">${cells}</g><g class="shape${m.shape === "move" || m.shape === "path" ? " move" : ""}${m.shape === "travel" ? " travel" : ""}">${shape}</g><g class="lbl" transform="translate(${lx},${ly})"><rect x="0" y="-16" rx="6" width="${w}" height="26"/><text x="9" y="2">${esc(label)}</text></g></g>`;
}
function vMeasDraw() {
  const svg = document.getElementById("vmeas"); if (!svg) return;
  const cur = vPageNow(), out = [];
  vLiveOthers(cur && cur.id).forEach(([, d]) => { if (d.meas) { try { out.push(vMeasSvg(d.meas, d.col, d.who || "Player")); } catch (e) {} } });
  if (VTT.meas) out.push(vMeasSvg(VTT.meas, VTT.mbcast && window.__CODEX_SERVER ? vLiveCol() : "", ""));
  if (VTT.mmove) out.push(vMeasSvg(VTT.mmove, "", ""));
  svg.innerHTML = out.join("");
}

// ----- Bars over tokens -----
// A character's slider resources (spell points, slider-style resources, slider lines on equipped items) sit above its HP.
// ----- Monster extras: the Exhaust Meter (soaks damage before HP) and the GM's own bars -----
// Exhaust comes from the stat block ("26 (→ +13)", or worked out for Large and bigger): 26 to start, and
// each refill after it breaks adds 13. On the token: ex (left), exMax, exRise; exMax 0 turns it off.
function vExParse(str) { const m = String(str || "").match(/(\d+)/), r = String(str || "").match(/\+\s*(\d+)/); return m ? { max: Number(m[1]), rise: r ? Number(r[1]) : 0 } : null; }
// Where a token's meter lives and which stat block it comes from. Summons keep theirs on the character
// (with their HP, so the player can track it); everything else on the token. A shapeshift (a monster's
// form, or a summon's) uses the form's stat block, and each form keeps its own meter (exm).
function vExSource(t) {
  if (!t || (t.ref || "").startsWith("c:")) return null;
  if ((t.ref || "").startsWith("s:")) { const sm = vSummonOf(t.ref); if (!sm) return null; const [, cid, sid] = t.ref.split(":"); return { sb: smView(sm).sb || {}, key: sm.form || "", st: sm, cid, sid }; }
  const own = (t.ref || "").startsWith("e:") ? S.entries.get(t.ref.slice(2)) : null, f = t.form && S.entries.get(t.form);
  return { sb: (f && f.statblock) || (own && own.statblock) || (t.npc && t.npc.sb) || null, key: t.form || "", st: t };
}
// Each form keeps its own meter in exm[formKey] ("" is the true form). Older tokens kept ex/exMax/exRise
// directly; those count as the true form's.
function vExRec(st, key) {
  const m = st && st.exm && typeof st.exm === "object" ? st.exm[key] : null;
  if (m) return m;
  return !key && st && (st.ex != null || st.exMax != null) ? { ex: st.ex, exMax: st.exMax, exRise: st.exRise } : null;
}
function vExOf(t) {
  const src = vExSource(t); if (!src) return null;
  const rec = vExRec(src.st, src.key) || {}, p = src.sb ? vExParse(src.sb.exhaust || (typeof sbAutoExhaust === "function" ? sbAutoExhaust(src.sb) : "")) : null;
  let max = rec.exMax != null && rec.exMax !== "" ? rec.exMax : p ? p.max : 0, rise = rec.exRise != null && rec.exRise !== "" ? rec.exRise : p ? p.rise : 0;
  max = Number(max) || 0; if (!max) return null;
  const cur = rec.ex != null && rec.ex !== "" ? Math.max(0, Math.min(max, Number(rec.ex) || 0)) : max;
  return { cur, max, rise: Number(rise) || 0, key: src.key };
}
// The fields to save for a token's meter (merged into its summon or token), for the form it's in now.
function vExFields(t, fields) {
  const src = vExSource(t), ex = vExOf(t) || { cur: 0, max: 0, rise: 0, key: src ? src.key : "" };
  const cur = Object.assign({ ex: ex.cur, exMax: ex.max, exRise: ex.rise }, fields);
  return { exm: Object.assign({}, (src && src.st.exm) || {}, { [ex.key]: cur }) };
}
function vExSave(id, t, fields) {
  const src = vExSource(t); if (!src) return;
  const all = vExFields(t, fields);
  if (src.cid) charChange(src.cid, x => { x.summons = smList(x).map(sm => sm.id === src.sid ? Object.assign({}, sm, all) : sm); });
  else vPatch("vtttokens/" + id, all);
}
const vCBars = t => Array.isArray(t && t.cbars) ? t.cbars.filter(b => b && Number(b.max) > 0) : [];
function vBars(t) {
  const out = [];
  if (t.ref && t.ref.startsWith("c:")) {
    const c = S.chars.get(t.ref.slice(2));
    vCBars(t).forEach(b => out.push({ cur: Math.max(0, Math.min(Number(b.max), Number(b.cur) || 0)), max: Number(b.max), color: b.color || "#6f8cff", label: b.name || "Bar", cbar: b.id }));
    if (!c) { const h = t.npc && t.npc.hp; if (h && h.max) out.push({ cur: h.cur, max: h.max, temp: h.temp || 0, hp: true, label: "HP" }); return out; }
    const k = typeof casterOf === "function" ? casterOf(c) : null; if (k && k.max) out.push({ cur: k.left, max: k.max, color: "#6f8cff", label: "Spell points", ed: "sp" });
    (c.resources || []).forEach((r, ri) => { if (r && r.style === "slider" && resMax(r, c)) out.push({ cur: charResHave(c, r), max: resMax(r, c), color: resColor(r.color), label: r.name, ed: "r:" + ri }); });
    if (typeof equippedResItems === "function") equippedResItems(c).forEach(it => it.lines.forEach((r, i) => { if (resValid(r) && r.style === "slider" && resMax(r, c)) out.push({ ed: "i:" + i + ":" + it.ref, cur: itemResHave(c, it.ref, i, r), max: resMax(r, c), color: resColor(r.color), label: r.name }); }));
    const hp = c.hp || {}; if (Number(hp.max)) out.push({ cur: Number(hp.cur) || 0, max: Number(hp.max), temp: Number(hp.temp) || 0, hp: true, label: "HP" });
  } else if (t.ref && t.ref.startsWith("s:")) {
    const sm = vSummonOf(t.ref);
    vCBars(t).forEach(b => out.push({ cur: Math.max(0, Math.min(Number(b.max), Number(b.cur) || 0)), max: Number(b.max), color: b.color || "#6f8cff", label: b.name || "Bar", cbar: b.id }));
    const ex = vExOf(t); if (ex) out.push({ cur: ex.cur, max: ex.max, color: "#e39a32", label: "Exhaust", ex: true });
    if (sm && smNowMax(sm)) out.push({ cur: smNowCur(sm), max: smNowMax(sm), temp: Number(sm.temp) || 0, hp: true, label: "HP" });
  } else {
    vCBars(t).forEach(b => out.push({ cur: Math.max(0, Math.min(Number(b.max), Number(b.cur) || 0)), max: Number(b.max), color: b.color || "#6f8cff", label: b.name || "Bar", cbar: b.id }));
    const ex = vExOf(t); if (ex) out.push({ cur: ex.cur, max: ex.max, color: "#e39a32", label: "Exhaust", ex: true });
    const v = vVehOf(t);
    if (v && v.fuel.type === "refuel") out.push({ cur: vFuelLeft(t, v), max: v.fuel.cap, color: "#c98b3a", label: "Fuel", ed: "fuel", fuel: true });
    if (Number(t.hpMax)) out.push({ cur: Number(t.hp != null ? t.hp : t.hpMax) || 0, max: Number(t.hpMax), temp: Number(t.temp) || 0, hp: true, label: v ? "Hull" : "HP" });
  }
  return out;
}
const vBarsPublic = t => t.bars ? t.bars === "all" : !!t.owner;
// ----- Changing a bar from the side panel: ±1, or add / subtract / set an amount -----
// b.ed says what a character bar changes: "sp" spell points, "r:<n>" a resource, "i:<n>:<item ref>" an item's line.
const vBarEdKey = b => b.cbar ? "c:" + b.cbar : b.ex ? "ex" : b.ed || "";
function vBarCanEdit(t, b) {
  if (!vBarEdKey(b)) return false;
  if (vCanEdit()) return true;
  return !!(PLAYER && vPlayerTok(t) && (b.ed || b.ex) && !b.fuel);
}
function vBarSetValue(id, key, v) {
  const t = S.vttTokens.get(id); if (!t) return;
  const b = vBars(t).find(x => vBarEdKey(x) === key); if (!b) return;
  v = Math.max(0, Math.min(Number(b.max) || 0, Math.round(Number(v) || 0)));
  if (b.cbar) { vPatch("vtttokens/" + id, { cbars: (t.cbars || []).map(x => x.id === b.cbar ? Object.assign({}, x, { cur: v }) : x) }); return; }
  if (b.ex) { vExSave(id, t, { ex: v }); if (!v && b.cur) toast(`${t.name || "It"}'s Exhaust Meter is broken.`); return; }
  if (key === "fuel") { S.vttTokens.set(id, Object.assign({}, t, { fuel: v })); vPatch("vtttokens/" + id, { fuel: v }); return; }
  const cid = (t.ref || "").slice(2);
  if (key === "sp") charChange(cid, x => { const k = casterOf(x); if (!k) return; x.caster = Object.assign({}, x.caster, { used: k.max - Math.min(k.max, v) }); });
  else if (key.startsWith("r:")) { const ri = Number(key.slice(2)); charChange(cid, x => { x.resources = (x.resources || []).map((r, i) => { if (i !== ri) return r; const r2 = Object.assign({}, r); charResSet(x, r2, v); return r2; }); }); }
  else if (key.startsWith("i:")) { const m = key.match(/^i:(\d+):(.*)$/); if (!m) return; const k = Number(m[1]), ref = m[2];
    charChange(cid, x => { const it = equippedResItems(x).find(q => q.ref === ref); const r = it && it.lines[k]; if (r) itemResSet(x, ref, k, r, v); }); }
}
// What players see of each bar: "hide", "bar" (the bar but not the numbers) or "full". Set per bar in
// Options (t.barVis, keyed hp / ex / c:<bar id>); bars without a setting follow "Bars shown to".
const vBarKey = b => b.hp ? "hp" : b.ex ? "ex" : b.fuel ? "fuel" : "c:" + b.cbar;
function vBarVis(t, b) { const v = t && t.barVis && t.barVis[vBarKey(b)]; return v === "hide" || v === "bar" || v === "full" ? v : vBarsPublic(t) ? "full" : "hide"; }
// The bars this viewer gets, each with how much of it they see. The GM, and players on their own tokens, see everything.
function vBarsFor(t) {
  const all = vBars(t), mine = !vCanEdit() && PLAYER && vPlayerTok(t);
  if (vCanEdit() || mine) return all.map(b => Object.assign({}, b, { vis: "full", pvis: vCanEdit() ? vBarVis(t, b) : "full" }));
  return all.map(b => Object.assign({}, b, { vis: vBarVis(t, b) })).filter(b => b.vis !== "hide");
}
function vBarsHtml(t) {
  const bars = vBarsFor(t); if (!bars.length) return "";
  return `<div class="vbars">${bars.map(b => { const pct = Math.max(0, Math.min(100, (b.cur / b.max) * 100)), hpc = pct > 50 ? "#4caf62" : pct > 25 ? "#d9a52b" : "#d0453a", num = b.vis === "full";
    return `<div class="vbar${b.pvis === "hide" ? " gmonly" : b.pvis === "bar" ? " gmnum" : ""}" title="${esc(b.label)}${num ? ` ${b.cur}/${b.max}${b.temp ? " +" + b.temp + " temp" : ""}` : ""}${b.pvis === "hide" ? " · players can't see this" : b.pvis === "bar" ? " · players see the bar, not the numbers" : ""}"><i style="width:${pct}%;background:${b.hp ? hpc : b.color}"></i>${b.temp ? `<b style="width:${Math.min(100, (b.temp / b.max) * 100)}%"></b>` : ""}${num ? `<span>${b.cur}/${b.max}</span>` : ""}</div>`; }).join("")}</div>`;
}
function vDamageSummon(cid, sid, n, heal, box, extra) {
    charChange(cid, x => { x.summons = smList(x).map(sm => { if (sm.id !== sid) return sm; sm = Object.assign({}, sm, extra || {}); if (!n) return sm; let temp = Number(sm.temp) || 0; const shifted = !!smView(sm)._form;
      if (heal) { if (shifted) sm.fhp = Math.min(smFormMax(sm), smNowCur(sm) + n); else sm.hp = Math.min(smMax(sm), smCur(sm) + n); return sm; }
      const tt = Math.min(temp, n); temp -= tt; let left = n - tt; sm.temp = temp;
      if (shifted) { const fc = smNowCur(sm); if (left < fc) { sm.fhp = fc - left; return sm; } left -= fc; sm.form = ""; sm.fhp = null; toast("The form dropped to 0 hit points: back to its true form."); }
      sm.hp = Math.max(0, smCur(sm) - left); return sm; }); });
    box.querySelector(".vhpn").value = "";
}
// Damage or heal from the side panel: a character's sheet, or the token's own HP.
function vDamage(el) {
  const box = el.closest(".vhpbox"), id = box && box.dataset.tok, t = id && S.vttTokens.get(id); if (!t) return;
  const n = Math.abs(parseInt(box.querySelector(".vhpn").value, 10) || 0); if (!n) return;
  const heal = el.dataset.v === "heal";
  const apply = (cur, max, temp) => { if (heal) return [Math.min(max, cur + n), temp]; let d = n; const tt = Math.min(temp, d); temp -= tt; d -= tt; return [Math.max(0, cur - d), temp]; };
  const exT = vExOf(t), mode = VTT.dmgMode || "bps";
  if (!heal && exT && mode === "ex") { const left = Math.max(0, exT.cur - n); vExSave(id, t, { ex: left }); if (!left && exT.cur) toast(`${t.name || "It"}'s Exhaust Meter is broken.`); box.querySelector(".vhpn").value = ""; return; }
  if (t.ref && t.ref.startsWith("s:")) {
    const [, cid, sid] = t.ref.split(":");
    if (!heal && exT && exT.cur && mode === "bps") {
      // Temp HP, then the meter, then whatever's left goes on as normal damage below.
      const sm0 = vSummonOf(t.ref) || {}; let d = n; const tt = Math.min(Number(sm0.temp) || 0, d); d -= tt;
      const ed = Math.min(exT.cur, d), left = exT.cur - ed; d -= ed;
      if (!left) toast(`${t.name || "It"}'s Exhaust Meter is broken${d ? ` (${d} went on to its HP)` : ""}.`);
      return vDamageSummon(cid, sid, d, false, box, Object.assign({ temp: (Number(sm0.temp) || 0) - tt }, vExFields(t, { ex: left })));
    }
    return vDamageSummon(cid, sid, n, heal, box);
  }

  if (t.ref && t.ref.startsWith("c:")) { charChange(t.ref.slice(2), x => { x.hp = Object.assign({ cur: 0, max: 0, temp: 0 }, x.hp); const [c2, t2] = apply(Number(x.hp.cur) || 0, Number(x.hp.max) || 0, Number(x.hp.temp) || 0); x.hp.cur = c2; x.hp.temp = t2; }); }
  else {
    const ex = exT;
    if (heal || !ex || !ex.cur || mode === "hp") { const [c2, t2] = apply(Number(t.hp != null ? t.hp : t.hpMax) || 0, Number(t.hpMax) || 0, Number(t.temp) || 0); vPatch("vtttokens/" + id, { hp: c2, temp: t2 }); }
    else {
      let d = n, temp = Number(t.temp) || 0; const tt = Math.min(temp, d); temp -= tt; d -= tt;
      const ed = Math.min(ex.cur, d), exLeft = ex.cur - ed; d -= ed;
      const hp = Math.max(0, (Number(t.hp != null ? t.hp : t.hpMax) || 0) - d);
      vPatch("vtttokens/" + id, Object.assign({ temp, hp }, vExFields(t, { ex: exLeft })));
      if (!exLeft) toast(`${t.name || "It"}'s Exhaust Meter is broken${d ? ` (${d} went on to its HP)` : ""}.`);
    }
  }
  box.querySelector(".vhpn").value = "";
}
document.addEventListener("change", ev => { if (ev.target.matches && ev.target.matches(".vbeamw")) { VTT.mbeam = Number(ev.target.value) || 5; if (VTT.meas && VTT.meas.shape === "beam") { VTT.meas.bw = VTT.mbeam; vLiveMeas(true); } vMeasDraw(); } });

// ----- The side panel for a token: its bars, damage and healing, then its stat block or character sheet -----
function vTokSideHtml(id, t) {
  const gm = vCanEdit(), mine = !gm && PLAYER && vPlayerTok(t);
  if (!gm && !mine) return PLAYER ? vVehPlayerSide(id, t) : "";
  const isChar = t.ref && t.ref.startsWith("c:"), c = isChar ? S.chars.get(t.ref.slice(2)) : null;
  const e = t.ref && t.ref.startsWith("e:") ? S.entries.get(t.ref.slice(2)) : null;
  const bars = vBarsFor(t), canHp = gm || (mine && (isChar || (t.ref || "").startsWith("s:")));
  const barHtml = bars.length ? `<div class="vsbars">${bars.map(b => { const pct = Math.max(0, Math.min(100, (b.cur / b.max) * 100)), hpc = pct > 50 ? "#4caf62" : pct > 25 ? "#d9a52b" : "#d0453a";
    const ek = vBarEdKey(b), canEd = vBarCanEdit(t, b), open = canEd && VTT.barEd === id + "|" + ek;
    const steps = canEd ? `<button class="iconbtn" data-act="vttbarstep" data-id="${esc(id)}" data-k="${esc(ek)}" data-v="-1" aria-label="One less">−</button><button class="iconbtn" data-act="vttbarstep" data-id="${esc(id)}" data-k="${esc(ek)}" data-v="1" aria-label="One more">+</button><button class="iconbtn vbaredbtn${open ? " on" : ""}" data-act="vttbared" data-id="${esc(id)}" data-k="${esc(ek)}" aria-expanded="${open}" title="Add, subtract or set an amount" aria-label="Change ${esc(b.label)} by an amount">±</button>` : "";
    const editor = open ? `<div class="vbared"><input type="number" min="0" inputmode="numeric" placeholder="Amount" aria-label="Amount for ${esc(b.label)}"><button class="btn ghost small" data-act="vttbarop" data-op="sub" data-id="${esc(id)}" data-k="${esc(ek)}">− Subtract</button><button class="btn ghost small" data-act="vttbarop" data-op="add" data-id="${esc(id)}" data-k="${esc(ek)}">+ Add</button><button class="btn small" data-act="vttbarop" data-op="set" data-id="${esc(id)}" data-k="${esc(ek)}" title="Set it to this number">Set</button></div>` : "";
    const ctl = !canEd ? (canHp && b.ex ? "" : "") : `<span class="vsbctl">${steps}</span>`;
    const ctl2 = canHp && b.ex ? `<span class="vsbctl"><button class="btn ghost small" data-act="vttexfill" data-id="${esc(id)}" title="${b.cur ? "Fill the meter back up" : "It broke: refill it" + (vExOf(t).rise ? `, ${vExOf(t).rise} bigger` : "")}">${b.cur ? "Refill" : `Refill${vExOf(t).rise ? " +" + vExOf(t).rise : ""}`}</button></span>` : "";
    return `<div class="vsbar${b.ex && !b.cur ? " broken" : ""}"><div class="vsbl"><span>${esc(b.label)}${b.ex && !b.cur ? " · broken" : ""}${gm && b.pvis === "hide" ? ` <small class="vbvn" title="Players can't see this bar">🙈</small>` : gm && b.pvis === "bar" ? ` <small class="vbvn" title="Players see the bar but not the numbers">◐</small>` : ""}</span>${b.vis === "full" ? `<strong>${b.cur}<small> / ${b.max}${b.temp ? ` · +${b.temp} temp` : ""}</small></strong>` : `<strong class="muted">${b.cur <= 0 ? "Down" : (b.cur / b.max) > .5 ? "Healthy" : (b.cur / b.max) > .25 ? "Hurt" : "Badly hurt"}</strong>`}${ctl}${ctl2}</div><div class="vsbt"><i style="width:${pct}%;background:${b.hp ? hpc : b.color}"></i>${b.temp ? `<b style="width:${Math.min(100, (b.temp / b.max) * 100)}%"></b>` : ""}</div>${editor}</div>`; }).join("")}</div>` : "";
  const sm = t.ref && t.ref.startsWith("s:") ? vSummonOf(t.ref) : null;
  const canFly = gm || mine, fly = Math.max(0, Number(t.fly) || 0);
  const dmgMode = VTT.dmgMode || "bps", exT = !isChar && vExOf(t);
  const dmgType = canHp && exT ? `<div class="vdmgtype" role="group" aria-label="What the damage hits">${[["bps", "Bludgeoning, piercing, slashing", "B / P / S", "Exhaust first, the rest to HP"], ["ex", "Exhaust only", "Exhaust", "Only the Exhaust Meter"], ["hp", "Other damage types", "HP only", "Skips the Exhaust Meter"]].map(([v, aria, lab, tip]) => `<button type="button" class="${dmgMode === v ? "on" : ""}" data-act="vttdmgmode" data-v="${v}" aria-pressed="${dmgMode === v}" aria-label="${aria}" title="${tip}">${lab}</button>`).join("")}</div>` : "";
  const dmg = canHp && (isChar || sm || t.hpMax || vExOf(t)) ? dmgType + `<div class="vhpbox" data-tok="${esc(id)}"><input class="vhpn" type="number" min="0" placeholder="0" aria-label="Amount"><button class="btn small danger" data-act="vttdmg" data-v="dmg">Damage</button><button class="btn small" data-act="vttdmg" data-v="heal">Heal</button></div>` : "";
  const pg = (vPageNow() || {}).p || {}, lv = vTokFloor(t);
  const lvlRow = vMaxLevel(pg) > 0 || vMinLevel(pg) < 0 || lv ? `<div class="vflyrow"><span>Standing on</span>${canFly ? `<button class="iconbtn" data-act="vttlvlup" data-v="-1" aria-label="Down a level"${lv > vMinLevel(pg) ? "" : " disabled"}>−</button>` : ""}<strong class="vlvlname">${esc(vLevelName(pg, lv))}</strong>${canFly ? `<button class="iconbtn" data-act="vttlvlup" data-v="1" aria-label="Up a level"${lv < vMaxLevel(pg) ? "" : " disabled"}>+</button>` : ""}</div>` : "";
  const flyRow = canFly || fly ? `<div class="vflyrow"><span>Flight band</span>${canFly ? `<button class="iconbtn" data-act="vttfly" data-v="-1" aria-label="Fly lower"${fly ? "" : " disabled"}>−</button>` : ""}<strong>${fly || "Ground"}</strong>${canFly ? `<button class="iconbtn" data-act="vttfly" data-v="1" aria-label="Fly higher">+</button>` : ""}</div>` : "";
  const mt = t.mount && S.vttTokens.get(t.mount), riders = vRidersOf(id), canOff = r => gm || (PLAYER && vPlayerTok(r));
  const veh = vVehOf(t), mtVeh = mt && vVehOf(mt), pil = veh && vPilotOf(id, t), onShip = t.ship && S.vttTokens.get(t.ship), atHelm = vIsShip(onShip) && vShipHelm(t.ship, onShip);
  const shipRow = vIsShip(onShip) ? `<div class="vflyrow vmountrow"><span>Aboard</span><strong>⛵ ${esc(vTokName(onShip))} <small class="muted">${esc(vShipDeckName(onShip, Number(t.deck) || 0))}${atHelm && atHelm[0] === id ? " · at the helm" : ""}</small></strong></div>` : "";
  const mountRow = (mt ? `<div class="vflyrow vmountrow"><span>${mtVeh ? "Aboard" : "Riding"}</span><strong>${mtVeh ? "🛞" : "🐎"} ${esc(vTokName(mt))}${mt.pilot === id ? ` <small class="muted">(pilot)</small>` : ""}</strong>${canFly ? `<button class="btn small ghost" data-act="vttdismount" data-id="${esc(id)}">⤵ ${mtVeh ? "Get out" : "Dismount"}</button>` : ""}</div>` : "")
    + (veh ? vVehSideHtml(id, t, veh, riders, gm) : "")
    + (riders.length ? `<div class="vflyrow vmountrow"><span>${veh ? "Aboard" : "Carrying"} <small class="muted">${riders.length}/${vMountCap(t)}</small></span><span class="vriders">${riders.map(([rid, r]) => `<span>${pil && pil[0] === rid ? "★ " : ""}${esc(vTokName(r))}${canOff(r) ? ` <button class="btn small ghost" data-act="vttdismount" data-id="${esc(rid)}" title="${esc(vTokName(r))} gets off">⤵</button>` : ""}</span>`).join("")}</span></div>` : "");
  const head = `<div class="vshead"><div><h2>${esc(t.name || "Token")}</h2>${c ? `<p class="muted small">${esc(charSub(c))}</p>` : sm ? `<p class="muted small">${esc(sm.kind || "Summon")} · summoned by ${esc((S.chars.get(t.owner) || {}).name || "")}</p>` : e && e.statblock && e.statblock.subtitle ? `<p class="muted small">${esc(e.statblock.subtitle)}</p>` : ""}</div>
    ${gm ? `<button class="btn ghost small" data-act="vttopts" title="Name, size, layer, who controls it, who sees its bars">⚙ Options</button>` : ""}</div>`;
  let body = "";
  if (c) {
    const cid = t.ref.slice(2), P = canPlay(), eq = equippedParts(c, cid), xa = attacksPerAction(c);
    body = `<div class="vschips"><span><b>AC</b>${esc(cAC(c))}</span><span><b>Speed</b>${esc(c.speed || "—")}</span><span><b>Init</b>${esc(cInit(c))}</span><span><b>Prof</b>${signed(cPB(c))}</span></div>
      <div class="vsabil">${ABILS.map(([a, l]) => `<div><span>${esc(l.slice(0, 3))}</span><strong>${signed(cMod(c, a))}</strong><small>${cScore(c, a)}</small></div>`).join("")}</div>
      ${eq.rows.length || (c.attacks || []).length ? `<h3 class="fgh">Attacks${xa.n > 1 ? ` <small class="muted">×${xa.n} per Attack action</small>` : ""}</h3><table class="atktab vsatk"><tbody>${eq.rows.join("")}${(c.attacks || []).map(a => `<tr><td>${esc(a.name)}</td><td class="num">${esc(a.bonus || "")}</td><td>${esc(a.damage || "")} ${esc(a.type || "")}</td><td></td></tr>`).join("")}</tbody></table>` : ""}
      <h3 class="fgh">Resources</h3>${resourcesSectionHtml(c, cid, false, P)}
      ${smList(c).length ? `<h3 class="fgh">Summons</h3><div class="vsums">${smList(c).map(x => { const ref = "s:" + cid + ":" + x.id, onBoard = vTokens(VTT.page || vCurrentPage(document.querySelector(".vtt").dataset.camp)).some(([, tt]) => tt.ref === ref), img = vTokenImg(ref);
        return `<div class="vsum">${img ? `<img src="${esc(img)}" alt="">` : `<span class="vinit">${esc((x.name || "?")[0])}</span>`}<div><strong>${esc(x.name || x.kind)}</strong><small class="muted">${esc(x.kind || "")} · ${smNowCur(x)}/${smNowMax(x)} HP</small></div>
          ${gm || mine ? (onBoard ? `<button class="btn ghost small" data-act="vttunsummon" data-ref="${esc(ref)}">Unsummon</button>` : `<button class="btn small" data-act="vttsummon" data-ref="${esc(ref)}" data-near="${esc(id)}">Summon</button>`) : ""}</div>`; }).join("")}</div>` : ""}
      <p><a href="#char-${esc(cid)}" target="_blank" rel="noopener">Open the full character sheet ↗</a></p>`;
  } else if (sm) {
    const [, cid, sid] = t.ref.split(":"), v = smView(sm);
    body = `${vSmFormCtl(id, t, sm, cid, gm || mine)}${v._form ? `<p class="ssnote">In the form of <strong>${esc(v._form.title)}</strong>.</p>` : ""}<div class="vssb">${statBlockHtml(Object.assign({}, (typeof smEffectiveSb === "function" ? smEffectiveSb(v) : v.sb) || {}, { hp: `${smNowCur(sm)} / ${smNowMax(sm)}${sm.temp ? ` (+${sm.temp} temp)` : ""}` }), sm.name || sm.kind, "core")}${(v.sb || {}).features ? featuresHtml(v.sb, sm.ref || "", "sm:" + cid + ":" + sid) : ""}</div>
      <p><a href="#char-${esc(cid)}" target="_blank" rel="noopener">Open the character's summons ↗</a></p>`;
  } else if (e && e.statblock && t.form && S.entries.get(t.form)) {
    const f = S.entries.get(t.form);
    body = `${vFormCtl(id, t, e, gm)}<p class="ssnote">In the form of <a href="#entry-${esc(t.form)}" target="_blank" rel="noopener">${esc(f.title)}</a>.</p><div class="vssb">${f.statblock ? statBlockHtml(f.statblock, f.title, "core") + (f.statblock.features ? featuresHtml(f.statblock, t.form, "e:tok-" + id) : "") : ""}</div>
      <details class="smfull"><summary>True form: ${esc(e.title)}</summary><div class="vssb">${statBlockHtml(e.statblock, e.title, "core")}</div></details>`;
  } else if (e && e.statblock) {
    body = vFormCtl(id, t, e, gm);
    body += `<div class="vssb${typeof isUniqueCreature === "function" && isUniqueCreature(e) ? " sbunique" : ""}">${statBlockHtml(Object.assign({}, e.statblock, t.hpMax ? { hp: `${t.hp != null ? t.hp : t.hpMax} / ${t.hpMax}${t.temp ? ` (+${t.temp} temp)` : ""} · stat block: ${e.statblock.hp || "—"}` } : {}), e.title, "core")}${featuresHtml(e.statblock, t.ref.slice(2), "e:tok-" + id)}</div>
      <p><a href="#entry-${esc(t.ref.slice(2))}" target="_blank" rel="noopener">Open the bestiary entry ↗</a></p>`;
  } else if (e) body = `<p><a href="#entry-${esc(t.ref.slice(2))}" target="_blank" rel="noopener">Open the entry ↗</a></p>`;
  else body = gm ? `<p class="muted small">A token with no library link. Use Options to set its name, size and HP.</p>` : "";
  const order = gm ? `<div class="vflyrow vorder"><span>Order</span><div class="seg"><button type="button" data-act="vtttokz" data-v="back" title="Send to the back ([ key twice)">⇊ Back</button><button type="button" data-act="vtttokz" data-v="down" title="Send backward ([)">↓</button><button type="button" data-act="vtttokz" data-v="up" title="Bring forward (])">↑</button><button type="button" data-act="vtttokz" data-v="front" title="Bring to the front">⇈ Front</button></div></div>` : "";
  return head + barHtml + dmg + shipRow + mountRow + (mt || onShip ? "" : lvlRow + flyRow) + order + vTokLightHtml(id, t, canFly) + vCondSideHtml(id, t, canFly) + (gm ? vInitTokBtn(id, t) : "") + body;
}
// Token options: everything about the token itself, in a pop-up so the side stays for the sheet.
function vTokOptions(id) {
  const t = S.vttTokens.get(id); if (!t) return;
  const chars = [...S.chars].filter(([, c]) => !c.hidden).sort((a, b) => String(a[1].name).localeCompare(b[1].name));
  const isChar = t.ref && t.ref.startsWith("c:");
  openModal(`<h2>Token options</h2><div class="vform vopts" data-tok="${esc(id)}">
    ${(() => { const e = (t.ref || "").startsWith("e:") ? S.entries.get(t.ref.slice(2)) : null, names = e && Array.isArray(e.tokNames) ? e.tokNames : [], pics = e ? entryTokens(e) : [], cur = t.img || pics[0] || "";
      return `<div class="vnamerow"><label class="grow"><span>Name</span><input type="text" data-vf="name" value="${esc(t.name || "")}"></label>${names.length ? `<button type="button" class="btn ghost" data-act="vttrandname" data-id="${esc(id)}" title="Pick another name from ${esc(e.title)}'s list">🎲 Name</button>` : ""}</div>
      ${pics.length > 1 ? `<div><span class="flabel">Token picture <small class="muted">from ${esc(e.title)}</small></span><div class="vpicrow">${pics.map(src => `<button type="button" class="vpic${src === cur ? " on" : ""}" data-act="vttsetpic" data-id="${esc(id)}" data-v="${esc(src)}" aria-pressed="${src === cur}" aria-label="Use this picture"><img src="${esc(src)}" alt=""></button>`).join("")}<button type="button" class="btn ghost" data-act="vttsetpic" data-id="${esc(id)}" data-v="*" title="Pick one at random">🎲 Random</button></div></div>` : ""}`; })()}
    <div><span class="flabel">Size</span><div class="vsizerow"><div class="seg vsize" role="group" aria-label="Size">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${vTokSz(t) === n ? "on" : ""}" data-act="vttsize" data-v="${n}" aria-pressed="${vTokSz(t) === n}">${n}×${n}</button>`).join("")}</div>
      <label class="vsizec"><span>Custom</span><input type="number" min="0.5" max="40" step="0.5" data-vf="size" value="${vTokSz(t) > 5 || vTokSz(t) % 1 ? vTokSz(t) : ""}" placeholder="e.g. 8" aria-label="Custom size in squares"><small class="muted">squares</small></label></div>${vSizeNoteHtml(t)}</div>
    <label><span>Layer</span><select data-vf="layer"><option value="token"${t.layer !== "gm" ? " selected" : ""}>Tokens (players see it)</option><option value="gm"${t.layer === "gm" ? " selected" : ""}>GM only</option></select></label>
    <label><span>Controlled by <small class="muted">its player can move it and sees through its eyes</small></span><select data-vf="owner"><option value="">Nobody (GM only)</option>${chars.map(([cid, c]) => `<option value="${esc(cid)}"${t.owner === cid ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
    <label><span>Darkvision (ft) <small class="muted">blank: from the sheet or stat block${(d => d ? ` (${d} ft)` : "")(vDarkvisionAuto(t))}</small></span><input type="number" min="0" step="5" data-vf="dv" value="${t.dv != null ? t.dv : ""}" placeholder="auto"></label>
    ${(() => { const bl = vBars(t); if (!bl.length) return `<label><span>Bars shown to</span><select data-vf="bars"><option value="all"${vBarsPublic(t) ? " selected" : ""}>Everyone</option><option value="gm"${!vBarsPublic(t) ? " selected" : ""}>GM only</option></select></label>`;
      const seg = (k, v) => `<div class="seg vbvseg">${[["hide", "Hidden"], ["bar", "Bar only"], ["full", "Bar + numbers"]].map(([x, l]) => `<button type="button" class="${v === x ? "on" : ""}" data-act="vttbarvis" data-id="${esc(id)}" data-k="${esc(k)}" data-v="${x}">${l}</button>`).join("")}</div>`;
      const vals = bl.map(b => vBarVis(t, b)), same = vals.every(v => v === vals[0]);
      return `<div class="vbvis"><span class="flabel">What players see</span>
        ${bl.length > 1 ? `<div class="vbvrow"><span>All bars</span>${seg("*", same ? vals[0] : "")}</div>` : ""}
        ${bl.map((b, i) => `<div class="vbvrow"><span><i style="background:${b.hp ? "#4caf62" : b.color}"></i>${esc(b.label)}</span>${seg(vBarKey(b), vals[i])}</div>`).join("")}
        ${vPlayerTok(t) ? `<p class="muted small">The player who controls this token always sees all of its bars.</p>` : (t.ref || "").startsWith("c:") ? `<p class="muted small">This character sheet is hidden from players, so they see this token like a monster: these settings decide what they see.</p>` : ""}</div>`; })()}
    ${isChar || (t.ref || "").startsWith("s:") ? `<p class="muted small">HP and the bars come from the ${isChar ? "character sheet" : "summon on its character's sheet"}.</p>` : `<div class="frow tight"><label><span>HP</span><input type="number" data-vf="hp" value="${t.hp != null ? t.hp : (t.hpMax || "")}"></label><label><span>Max HP</span><input type="number" data-vf="hpMax" value="${t.hpMax || ""}"></label><label><span>Temp HP</span><input type="number" data-vf="temp" value="${t.temp || ""}"></label></div>`}
    ${isChar ? "" : (() => { const ex = vExOf(t) || { cur: "", max: "", rise: "" }, smT = (t.ref || "").startsWith("s:"); return `${smT ? "" : `<h3 class="vopth">Exhaust Meter <small class="muted">soaks damage before HP${t.form && S.entries.get(t.form) ? " · for its current form" : t.exMax == null && vExOf(t) ? " · from the stat block" : ""}</small></h3>
      <div class="frow tight"><label><span>Left</span><input type="number" min="0" data-vf="ex" value="${ex.cur}"></label><label><span>Meter</span><input type="number" min="0" data-vf="exMax" value="${ex.max}" placeholder="none"></label><label><span>Grows by</span><input type="number" min="0" data-vf="exRise" value="${ex.rise}"></label></div>`}
      <h3 class="vopth">Custom bars <small class="muted">rage, stagger, a ward, anything you track</small></h3>
      <div class="vcbars">${(t.cbars || []).map(b => `<div class="vcbrow" data-b="${esc(b.id)}"><input type="text" data-cb="name" value="${esc(b.name || "")}" placeholder="Name" aria-label="Bar name"><input type="number" min="0" data-cb="cur" value="${Number(b.cur) || 0}" aria-label="Current"><span>/</span><input type="number" min="1" data-cb="max" value="${Number(b.max) || 0}" aria-label="Maximum"><input type="color" data-cb="color" value="${esc(b.color || "#6f8cff")}" aria-label="Colour"><button type="button" class="iconbtn" data-act="vttcbarrm" data-id="${esc(id)}" data-b="${esc(b.id)}" aria-label="Remove bar">✕</button></div>`).join("")}</div>
      <button type="button" class="btn ghost small" data-act="vttcbaradd" data-id="${esc(id)}">+ Add a bar</button>`; })()}
    ${vNpcable(t) ? `<div class="vnpcbox"><span class="flabel">Make it an NPC <small class="muted">a character sheet of its own, named “${esc(t.name || "")}”, hidden from players</small></span>
      <div class="vnpcbtns"><button type="button" class="btn ghost" data-act="vttnpc" data-v="sheet" data-id="${esc(id)}" title="A character sheet filled in from the stat block">📜 Make an NPC sheet</button></div></div>`
    : vUniqueable(t) ? `<div class="vnpcbox"><span class="flabel">Make it a unique creature <small class="muted">its own bestiary entry, with a new name and lore</small></span>
      <div class="vnpcbtns"><button type="button" class="btn ghost" data-act="vttunique" data-id="${esc(id)}" title="Copy this creature into a bestiary entry of its own">✨ Make a unique creature</button></div></div>` : ""}
    <div class="acts"><button class="btn" type="button" data-act="closemodal">Done</button><button class="btn ghost danger" type="button" data-act="vttdeltok" data-id="${esc(id)}">Delete token</button></div></div>`);
}

// ----- Organising maps: folders (acts, towns, trails…) holding maps -----
// camp.folders = [{ id, name, parent }]; page.folder = folder id; page.open = players may switch to it themselves.
const vFolders = c => Array.isArray(c && c.folders) ? c.folders : [];
function vFolderPath(c, fid) { const out = [], seen = new Set(); let f = vFolders(c).find(x => x.id === fid); while (f && !seen.has(f.id)) { seen.add(f.id); out.unshift(f.name); f = vFolders(c).find(x => x.id === f.parent); } return out.length ? out.join(" / ") + " / " : ""; }
const VCLOSED = (() => { try { return new Set(JSON.parse(localStorage.getItem("vttClosed") || "[]")); } catch (e) { return new Set(); } })();
const vSaveClosed = () => { try { localStorage.setItem("vttClosed", JSON.stringify([...VCLOSED])); } catch (e) {} };
function vMapsHtml(camp) {
  const c = S.vttCamps.get(camp); if (!c) return "";
  const pid = VTT.page, folders = vFolders(c), pages = vPages(camp);
  const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true });
  const tree = (parent, d) => {
    const fs = folders.filter(f => (f.parent || "") === parent).sort(byName);
    const ps = pages.filter(([, p]) => (p.folder || "") === parent && (parent === "" || folders.some(f => f.id === parent)) || (parent === "" && p.folder && !folders.some(f => f.id === p.folder)));
    return fs.map(f => { const open = !VCLOSED.has(f.id); return `<div class="vmrow vmfolder" draggable="true" data-fid="${esc(f.id)}" style="--d:${d}">
        <button class="vmtw" data-act="vttfold" data-id="${esc(f.id)}" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} ${esc(f.name)}">${open ? "▾" : "▸"}</button><span class="vmname">📁 ${esc(f.name)}</span>
        <span class="vmacts"><button data-act="vttnewmap" data-folder="${esc(f.id)}" title="New map in ${esc(f.name)}">+🗺</button><button data-act="vttnewmapimg" data-folder="${esc(f.id)}" title="New map from an image in ${esc(f.name)}">+🖼</button><button data-act="vttnewfolder" data-folder="${esc(f.id)}" title="New folder in ${esc(f.name)}">+📁</button><button data-act="vttrenfolder" data-id="${esc(f.id)}" title="Rename">✎</button><button data-act="vttdelfolder" data-id="${esc(f.id)}" title="Delete folder">🗑</button></span></div>
        ${open ? tree(f.id, d + 1) : ""}`; }).join("")
      + ps.sort((a, b) => (a[1].order || 0) - (b[1].order || 0) || byName(a[1], b[1])).map(([id, p]) => `<div class="vmrow vmpage${id === pid ? " on" : ""}" draggable="true" data-pid="${esc(id)}" style="--d:${d}">
        <button class="vmopen" data-act="vttpage" data-id="${esc(id)}">${c.playerPage === id ? `<span class="vstar" title="The party is here">★</span>` : "🗺"} ${esc(p.name || "Map")}</button>
        <span class="vmacts"><button class="vmeye${p.open ? " on" : ""}" data-act="vttopenmap" data-id="${esc(id)}" title="${p.open ? "Players can switch to this map themselves (click to stop)" : "Let players switch to this map themselves"}" aria-pressed="${!!p.open}">👁</button><button data-act="vttsendto" data-id="${esc(id)}" title="Send the party here">★</button><button data-act="vttrenpage" data-id="${esc(id)}" title="Rename">✎</button></span></div>`).join("");
  };
  return `<div class="vmhead"><strong>Maps</strong><span class="vmacts always"><button data-act="vttnewmap" data-folder="" title="New map">+ Map</button><button data-act="vttnewmapimg" data-folder="" title="New map from an image: the board is sized to fit it">+ From image</button><button data-act="vttnewfolder" data-folder="" title="New folder">+ Folder</button><button data-act="vttmaps" title="Close">✕</button></span></div>
    <div class="vmtree" data-fid="">${tree("", 0) || `<p class="muted small">No maps yet.</p>`}</div>
    <div class="vmroot" data-fid="">Drop here to move to the top level</div>
    <p class="muted small vmhelp">Drag maps and folders to reorganise. <span class="vmeye on">👁</span> lets players switch to a map themselves; <span class="vstar">★</span> is where the party is.</p>`;
}
function vMapsRefresh() { const m = document.getElementById("vmaps"); if (m) m.innerHTML = vMapsHtml(document.querySelector(".vtt").dataset.camp); }
async function vMapsAction(a, el) {
  const root = document.querySelector(".vtt"), camp = root && root.dataset.camp, c = camp && S.vttCamps.get(camp); if (!c) return;
  const folders = vFolders(c).map(f => Object.assign({}, f));
  if (a === "vttmaps") { VTT.mapsOpen = !VTT.mapsOpen; render(); return; }
  if (a === "vttfold") { const id = el.dataset.id; if (VCLOSED.has(id)) VCLOSED.delete(id); else VCLOSED.add(id); vSaveClosed(); vMapsRefresh(); return; }
  if (a === "vttnewfolder") { const name = await vAsk("New folder", "Name", "", "Create"); if (!name) return; folders.push({ id: vid("f"), name, parent: el.dataset.folder || "" }); if (el.dataset.folder) VCLOSED.delete(el.dataset.folder); await vPatch("vttcamps/" + camp, { folders }); return; }
  if (a === "vttrenfolder") { const f = folders.find(x => x.id === el.dataset.id); if (!f) return; const name = await vAsk("Rename folder", "Name", f.name, "Save"); if (!name) return; f.name = name; await vPatch("vttcamps/" + camp, { folders }); return; }
  if (a === "vttdelfolder") {
    const f = folders.find(x => x.id === el.dataset.id); if (!f) return;
    if (!(await confirmBox(`Delete the folder “${f.name}”? Its maps and folders move up a level; nothing else is deleted.`, "Delete folder"))) return;
    for (const [pid, p] of vPages(camp)) if (p.folder === f.id) await vPatch("vttpages/" + pid, { folder: f.parent || "" });
    await vPatch("vttcamps/" + camp, { folders: folders.filter(x => x.id !== f.id).map(x => x.parent === f.id ? Object.assign(x, { parent: f.parent || "" }) : x) });
    return;
  }
  if (a === "vttnewmapimg") { vNewMapFromImage(camp, el.dataset.folder || ""); return; }
  if (a === "vttnewmap") { const name = await vAsk("New map", "Name", "", "Create"); if (!name) return; if (el.dataset.folder) VCLOSED.delete(el.dataset.folder); const nid = await vNewPage(camp, name, vPages(camp).length, el.dataset.folder || ""); for (let i = 0; i < 40 && !S.vttPages.has(nid); i++) await new Promise(r => setTimeout(r, 50)); VTT.page = nid; VTT.sel = null; render(); return; }
  if (a === "vttrenpage") { const p = S.vttPages.get(el.dataset.id); if (!p) return; const name = await vAsk("Rename map", "Name", p.name, "Save"); if (name) vPatch("vttpages/" + el.dataset.id, { name }); return; }
  if (a === "vttopenmap") { const p = S.vttPages.get(el.dataset.id); if (p) { await vPatch("vttpages/" + el.dataset.id, { open: !p.open }); toast(p.open ? "Players can no longer switch to that map" : "Players can now switch to that map themselves"); } return; }
  if (a === "vttsendto") { await vPatch("vttcamps/" + camp, { playerPage: el.dataset.id }); toast("The party is now on “" + ((S.vttPages.get(el.dataset.id) || {}).name || "that map") + "”"); return; }
}
// Dragging maps and folders between folders.
document.addEventListener("dragstart", ev => { const r = ev.target.closest && ev.target.closest(".vmrow"); if (!r) return; ev.dataTransfer.setData("text/plain", r.dataset.pid ? "p:" + r.dataset.pid : "f:" + r.dataset.fid); ev.dataTransfer.effectAllowed = "move"; });
document.addEventListener("dragover", ev => { const t = ev.target.closest && ev.target.closest(".vmfolder, .vmroot"); if (!t) return; ev.preventDefault(); document.querySelectorAll(".vmdrop").forEach(x => x.classList.remove("vmdrop")); t.classList.add("vmdrop"); });
document.addEventListener("dragleave", ev => { const t = ev.target.closest && ev.target.closest(".vmdrop"); if (t && !t.contains(ev.relatedTarget)) t.classList.remove("vmdrop"); });
document.addEventListener("drop", async ev => {
  const t = ev.target.closest && ev.target.closest(".vmfolder, .vmroot"); if (!t) return; ev.preventDefault(); t.classList.remove("vmdrop");
  const what = ev.dataTransfer.getData("text/plain"), to = t.dataset.fid || "", camp = document.querySelector(".vtt").dataset.camp, c = S.vttCamps.get(camp);
  if (what.startsWith("p:")) { await vPatch("vttpages/" + what.slice(2), { folder: to }); if (to) VCLOSED.delete(to); }
  else if (what.startsWith("f:")) {
    const id = what.slice(2); if (id === to) return;
    // No dropping a folder inside itself.
    let x = to, seen = new Set(); while (x && !seen.has(x)) { if (x === id) { toast("A folder can't go inside itself.", "bad"); return; } seen.add(x); x = (vFolders(c).find(f => f.id === x) || {}).parent; }
    await vPatch("vttcamps/" + camp, { folders: vFolders(c).map(f => f.id === id ? Object.assign({}, f, { parent: to }) : f) });
  }
});
document.addEventListener("change", ev => { if (ev.target.id === "vpsel") { VTT.ppage = ev.target.value; VTT.sel = null; VTT.fitDone = ""; render(); } });

// ----- Forms, flight, summons -----
function vFormCtl(id, t, e, gm) {
  if (!gm || typeof isShifter !== "function" || !isShifter(e)) return "";
  const forms = ssForms(t.ref.slice(2), e);
  return `<div class="vform vformctl" data-tok="${esc(id)}"><label><span>◈ Shapeshift form <small class="muted">the token takes on that creature's picture</small></span><select data-vf="form"><option value="">True form</option>${forms.map(([fid, x]) => `<option value="${esc(fid)}"${t.form === fid ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label></div>`;
}
function vFly(delta) {
  const id = VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id, t = id && S.vttTokens.get(id); if (!t) return;
  if (!vCanEdit() && !(PLAYER && vPlayerTok(t))) return;
  const fly = Math.max(0, Math.min(99, (Number(t.fly) || 0) + delta));
  S.vttTokens.set(id, Object.assign({}, t, { fly })); vPatch("vtttokens/" + id, { fly }); vRefresh();
}
function vSummonPlace(ref, nearId) {
  const cur = vPageNow(); if (!cur) return;
  const [, cid, sid] = ref.split(":"), sm = vSummonOf(ref); if (!sm) return;
  const near = S.vttTokens.get(nearId), size = ({ Large: 2, Huge: 3, Gargantuan: 4 })[smSize(sm)] || 1;
  // Next to whoever summoned it, in the first free spot going round.
  const taken = (x, y) => vTokens(cur.id).some(([, o]) => x < o.x + vTokSz(o) && x + size > o.x && y < o.y + vTokSz(o) && y + size > o.y);
  let x = near ? near.x + vTokSz(near) : 0, y = near ? near.y : 0;
  if (near) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const nx = near.x + dx * ((dx > 0 ? vTokSz(near) : size)), ny = near.y + dy * ((dy > 0 ? vTokSz(near) : size)); if (nx >= 0 && ny >= 0 && nx + size <= cur.p.w && ny + size <= cur.p.h && !taken(nx, ny)) { x = nx; y = ny; break; } }
  x = Math.max(0, Math.min(cur.p.w - size, x)); y = Math.max(0, Math.min(cur.p.h - size, y));
  const id = vid("t");
  vSave("vtttokens/" + id, { page: cur.id, layer: "token", x, y, size, img: "", name: sm.name || sm.kind || "Summon", ref, owner: cid, bars: "all", created: new Date().toISOString() });
  if (sm.active === false) charChange(cid, c => { c.summons = smList(c).map(s => s.id === sid ? Object.assign({}, s, { active: true }) : s); });
}
async function vSummonRemove(ref) {
  const cur = vPageNow(); if (!cur) return;
  const [, cid, sid] = ref.split(":");
  for (const [tid, t] of vTokens(cur.id)) if (t.ref === ref) { if (VTT.sel && VTT.sel.id === tid) VTT.sel = null; await vDel("vtttokens/" + tid); }
  charChange(cid, c => { c.summons = smList(c).map(s => s.id === sid ? Object.assign({}, s, { active: false }) : s); });
}
document.addEventListener("keydown", ev => {
  if (!document.querySelector(".vtt") || (ev.target.matches && ev.target.matches("input,textarea,select"))) return;
  if (ev.key === "PageUp" || ev.key === "]") { ev.preventDefault(); vFly(1); } else if (ev.key === "PageDown" || ev.key === "[") { ev.preventDefault(); vFly(-1); }
});

// ----- Levels: ground, then rooftops and upper floors -----
// Walls carry a level as a fifth number; raised areas (page.areas) outline what's up on a level; pictures and tokens have a level.
// A token's height is its level plus its flight band. It's blocked only by walls on that height, so anything higher sees over
// ground walls. Pictures on a level are hidden from players whose tokens are underneath that level's areas, so they see inside.
// Levels: 0 is the ground; 1, 2… are upper floors; -1, -2… are basements below the ground.
const vHeight = t => (Number(t.lvl) || 0) + Math.max(0, Number(t.fly) || 0);
const vTokFloor = t => Number(t && t.lvl) || 0;
function vMinLevel(p) { let m = Math.min(0, Number(p && p.minLevel) || 0); (p && p.walls || []).forEach(w => { m = Math.min(m, w[4] || 0); }); (p && p.areas || []).forEach(a => { m = Math.min(m, a.level || 0); }); (p && p.objs || []).forEach(o => { m = Math.min(m, o.level || 0); }); (p && p.lights || []).forEach(l => { m = Math.min(m, l.level || 0); }); (p && p.links || []).forEach(l => (l.levels || []).forEach(n => { m = Math.min(m, n); })); return m; }
function vMaxLevel(p) { let m = Number(p && p.maxLevel) || 0; (p && p.walls || []).forEach(w => { m = Math.max(m, w[4] || 0); }); (p && p.areas || []).forEach(a => { m = Math.max(m, a.level || 0); }); (p && p.objs || []).forEach(o => { m = Math.max(m, o.level || 0); }); return m; }
const vLevelList = p => { const lo = vMinLevel(p), hi = vMaxLevel(p); return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i); };
function vLevelName(p, n) { n = Number(n) || 0; const nm = ((p && p.levelNames) || {})[n]; if (!n) return nm ? `Ground · ${nm}` : "Ground"; const base = n > 0 ? `Level ${n}` : n === -1 ? "Basement" : `Basement ${-n}`; return nm ? `${base} · ${nm}` : base; }
const vLevelBadge = n => n > 0 ? String(n) : n < 0 ? "B" + (-n) : "G";
// Swap everything on two levels: walls, pictures, raised squares, lights, stairs and lifts, tokens and names.
function vLevelSwap(cur, a, b) {
  const sw = n => n === a ? b : n === b ? a : n, p = cur.p;
  const walls = (p.walls || []).map(w => { const l = w[4] || 0; if (l !== a && l !== b) return w; const c = w.slice(); c[4] = sw(l); return c; });
  const objs = (p.objs || []).map(o => (o.level || 0) === a || (o.level || 0) === b ? Object.assign({}, o, { level: sw(o.level || 0) }) : o);
  const areas = (p.areas || []).map(x => x.level === a || x.level === b ? Object.assign({}, x, { level: sw(x.level) }) : x);
  const lights = (p.lights || []).map(x => (x.level || 0) === a || (x.level || 0) === b ? Object.assign({}, x, { level: sw(x.level || 0) }) : x);
  const links = (p.links || []).map(x => Object.assign({}, x, { levels: (x.levels || [0]).map(sw) }));
  const names = Object.assign({}, p.levelNames || {}), na = names[a], nb = names[b]; delete names[a]; delete names[b]; if (nb) names[a] = nb; if (na) names[b] = na;
  vPatch("vttpages/" + cur.id, { walls, objs, areas, lights, links, levelNames: names, minLevel: vMinLevel(p), maxLevel: vMaxLevel(p) });
  for (const [id, t] of S.vttTokens) if (t.page === cur.id) { const l = vTokFloor(t); if (l === a || l === b) vPatch("vtttokens/" + id, { lvl: sw(l) }); }
  toast(`Swapped ${vLevelName(p, a)} and ${vLevelName(p, b)}.`);
}
// GM level filter: VTT.lvlShow is null (show every level) or a Set of the levels to show and edit.
function vLvlHid(l) { return !!(VTT.lvlShow && vCanEdit() && !VTT.preview && !VTT.lvlShow.has(Number(l) || 0)); }
function vLevelToolsHtml() {
  const cur = vPageNow(), p = cur ? cur.p : {}, all = !VTT.lvlShow, lo = vMinLevel(p), hi = vMaxLevel(p);
  const rows = vLevelList(p).reverse().map(n => { const shown = all || VTT.lvlShow.has(n), nm = (p.levelNames || {})[n] || "";
    return `<div class="vlvrow${VTT.lvl === n ? " on" : ""}${shown ? "" : " off"}">
      <label class="vlvtick" title="${all ? "Show only this level" : shown ? "Hide this level" : "Show this level too"}"><input type="checkbox" data-act="vttlvlshow" data-v="${n}"${!all && shown ? " checked" : ""}></label>
      <button class="vlvname" data-act="vttlvl" data-v="${n}" aria-pressed="${VTT.lvl === n}" title="Show and edit ${esc(vLevelName(p, n))}: new walls, squares, pictures and lights go here"><b>${vLevelBadge(n)}</b><span>${esc(nm || (!n ? "Ground" : n > 0 ? "Level " + n : n === -1 ? "Basement" : "Basement " + (-n)))}</span></button>
      <span class="vlvtools"><span class="vlvarrows">${n < hi ? `<button class="vlvmv" data-act="vttlvlmove" data-v="${n}" data-d="1" title="Move this level up (swaps with ${esc(vLevelName(p, n + 1))})" aria-label="Move up">▲</button>` : ""}${n > lo ? `<button class="vlvmv" data-act="vttlvlmove" data-v="${n}" data-d="-1" title="Move this level down (swaps with ${esc(vLevelName(p, n - 1))})" aria-label="Move down">▼</button>` : ""}</span>${true ? `<button class="vlvren" data-act="vttrenlvl" data-v="${n}" title="Rename this level">✎</button>` : ""}</span></div>`; }).join("");
  return `<div class="vgroup vlvgroup"><span class="vlab">Levels</span>
    <button class="vlvall${all ? " on" : ""}" data-act="vttlvlall" aria-pressed="${all}">${all ? "✓ " : ""}Show all</button>
    <div class="vlvrows">${rows}</div>
    <button class="vbtn small vlvedit" data-act="vttlvldlg" title="The map's levels, and where each vehicle's decks sit among them">Levels &amp; vehicles…</button>
    <div class="vlvadds"><button class="vbtn small vlvadd" data-act="vttaddlvl" data-v="above" title="Add a floor above the top level">+ Above</button><button class="vbtn small vlvadd" data-act="vttaddlvl" data-v="below" title="Add a basement below the lowest level">+ Below</button></div></div>`;
}
function vTokLevel(delta) {
  const id = VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id, t = id && S.vttTokens.get(id), cur = vPageNow(); if (!t || !cur) return;
  if (!vCanEdit() && !(PLAYER && vPlayerTok(t))) return;
  const lvl = Math.max(vMinLevel(cur.p), Math.min(vMaxLevel(cur.p), (Number(t.lvl) || 0) + delta));
  S.vttTokens.set(id, Object.assign({}, t, { lvl })); vPatch("vtttokens/" + id, { lvl }); vRefresh();
}
// Players standing (or flying) under a level's raised squares see through that level's pictures:
// the pictures are cut away over the connected patch of squares they're under, so they see the room below.
function vRoofHoles(p, viewers, L) {
  let d = "";
  const seen = new Set();
  (p.areas || []).filter(a => a.level === L).forEach(a => {
    const under = viewers.filter(([, t]) => vHeight(t) < L).map(([, t]) => { const s = vTokSz(t) / 2; return [t.x + s, t.y + s]; }).filter(([x, y]) => vInArea(a, x, y));
    if (!under.length) return;
    if (!Array.isArray(a.cells)) { d += "M" + a.pts.map(q => q[0] * VCELL + " " + q[1] * VCELL).join("L") + "Z"; return; }
    const has = new Set(a.cells.map(c => c[0] + "," + c[1]));
    under.forEach(([x, y]) => {
      const start = Math.floor(x) + "," + Math.floor(y); if (seen.has(start)) return;
      const todo = [start]; seen.add(start);
      while (todo.length) {
        const k = todo.pop(), [cx, cy] = k.split(",").map(Number);
        d += `M${cx * VCELL} ${cy * VCELL}h${VCELL}v${VCELL}h${-VCELL}z`;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = (cx + dx) + "," + (cy + dy); if (has.has(n) && !seen.has(n)) { seen.add(n); todo.push(n); } }
      }
    });
  });
  return d;
}
function vRoofs(p, viewers) {
  const W = p.w * VCELL, H = p.h * VCELL;
  document.querySelectorAll(".vroofl .vobj.vroofoff").forEach(el => el.classList.remove("vroofoff"));
  const floors = new Set(viewers.map(([, t]) => vTokFloor(t))), top = floors.size ? Math.max(...floors) : 0;
  document.querySelectorAll(".vrlv").forEach(el => {
    const L = Number(el.dataset.lvl) || 0;
    el.style.display = (L < 0 && !floors.has(L)) || (L > 0 && floors.size && top < 0) ? "none" : "";
    if (L < 0) { el.style.clipPath = ""; return; }
    const holes = vRoofHoles(p, viewers, L);
    el.style.clipPath = holes ? `path(evenodd, "M0 0H${W}V${H}H0Z${holes}")` : "";
  });
}


// ===== Conditions and effects =====
// The library lives in settings/vttconds { list: [{ id, name, emoji, color, stacks, desc }] }; until it's edited the built-in list is used.
// A token carries t.conds = [{ c: <condition id>, n: <stacks> }]: no limit on how many, or on the stacks.
const VCOND_DEFAULTS = [
  ["blinded", "Blinded", "🙈", "#8a8f99", 0, "Can't see. Attacks against it have advantage; its attacks have disadvantage."],
  ["charmed", "Charmed", "💘", "#e46aa8", 0, "Can't attack the charmer; the charmer has advantage on social checks against it."],
  ["deafened", "Deafened", "🔇", "#8a8f99", 0, "Can't hear."],
  ["frightened", "Frightened", "😱", "#9b6ad6", 0, "Disadvantage on checks and attacks while the source is in sight; can't move closer to it."],
  ["grappled", "Grappled", "🤼", "#c98b4a", 0, "Speed 0."],
  ["incapacitated", "Incapacitated", "💫", "#c9b24a", 0, "Can't take actions or reactions."],
  ["invisible", "Invisible", "👻", "#b8c7d9", 0, "Can't be seen without magic. Its attacks have advantage; attacks against it have disadvantage."],
  ["paralyzed", "Paralyzed", "⚡", "#e8d24a", 0, "Incapacitated, can't move or speak. Auto-fails Str and Dex saves; hits within 5 ft are crits."],
  ["petrified", "Petrified", "🗿", "#8d8476", 0, "Turned to stone: incapacitated, resistant to all damage."],
  ["poisoned", "Poisoned", "🤢", "#6bbf4a", 0, "Disadvantage on attack rolls and ability checks."],
  ["prone", "Prone", "🛌", "#a07a52", 0, "Crawls. Disadvantage on attacks; melee attacks against it have advantage, ranged have disadvantage."],
  ["restrained", "Restrained", "⛓️", "#7d8a99", 0, "Speed 0. Disadvantage on attacks and Dex saves; attacks against it have advantage."],
  ["stunned", "Stunned", "😵", "#e8a14a", 0, "Incapacitated, can't move. Auto-fails Str and Dex saves; attacks against it have advantage."],
  ["unconscious", "Unconscious", "💤", "#5a6b9b", 0, "Incapacitated and prone, drops what it holds. Hits within 5 ft are crits."],
  ["exhaustion", "Exhaustion", "😩", "#b0704a", 1, "Exhaustion levels."],
  ["concentrating", "Concentrating", "🧠", "#6f8cff", 0, "Holding concentration on a spell."],
  ["onfire", "On fire", "🔥", "#ff7a2f", 1, "Burning."],
  ["frozen", "Frozen", "🧊", "#7fd0ff", 1, "Chilled or frozen."],
  ["rend", "Rend", "🩸", "#d0453a", 1, "Stacks of rend."],
  ["bleeding", "Bleeding", "🩸", "#a3242c", 1, "Bleeding."],
  ["blessed", "Blessed", "✨", "#f2d36b", 0, "Adds a d4 to attacks and saves."],
  ["marked", "Marked", "🎯", "#e0533a", 0, "Marked by something (Hunter's Mark, Hex…)."],
].map(([id, name, emoji, color, stacks, desc]) => ({ id, name, emoji, color, stacks: !!stacks, desc }));
const VCOND_EMOJI = ["🔥", "🧊", "⚡", "🩸", "☠️", "🤢", "💤", "😵", "😱", "💘", "🙈", "👻", "🛡️", "✨", "🎯", "🌀", "🕸️", "🪨", "💧", "🌿", "🐾", "🗡️", "🧠", "💀", "🌑", "☀️", "❄️", "🌪️", "⛓️", "🍄"];
function vConds() { const l = S.vttCondDoc && Array.isArray(S.vttCondDoc.list) ? S.vttCondDoc.list : VCOND_DEFAULTS; return l; }
const vCond = id => vConds().find(c => c.id === id);
const vTokConds = t => (Array.isArray(t.conds) ? t.conds : []).filter(x => x && vCond(x.c));
function vCondBadges(t) {
  const list = vTokConds(t); if (!list.length) return "";
  return `<div class="vconds">${list.map(x => { const c = vCond(x.c), n = Math.max(1, Number(x.n) || 1);
    return `<span class="vcond" style="--cc:${esc(c.color || "#aaa")}" title="${esc(c.name + (c.stacks ? " ×" + n : ""))}">${esc(c.emoji || "•")}${c.stacks && n ? `<b>${n}</b>` : ""}</span>`; }).join("")}</div>`;
}
function vCondSideHtml(id, t, canEdit) {
  const list = vTokConds(t);
  if (!canEdit && !list.length) return "";
  const lib = vConds().slice().sort((a, b) => String(a.name).localeCompare(b.name));
  return `<div class="vcondbox" data-tok="${esc(id)}"><div class="vcondhead"><span>Conditions</span>${vCanEdit() ? `<button class="linkbtn small" data-act="vttcondlib">Edit library</button>` : ""}</div>
    ${list.length ? `<div class="vcondlist">${list.map(x => { const c = vCond(x.c), n = Math.max(1, Number(x.n) || 1);
      return `<div class="vcondrow" style="--cc:${esc(c.color || "#aaa")}"><span class="vce">${esc(c.emoji || "•")}</span><span class="vcn" title="${esc(c.desc || "")}">${esc(c.name)}${c.desc ? ` <button class="linkbtn small" data-act="vttcondinfo" data-c="${esc(c.id)}" aria-label="What ${esc(c.name)} does">?</button>` : ""}</span>
        ${c.stacks ? `${canEdit ? `<button class="iconbtn" data-act="vttcondn" data-c="${esc(c.id)}" data-v="-1" aria-label="One fewer ${esc(c.name)}">−</button>` : ""}<strong class="vcs">${n}</strong>${canEdit ? `<button class="iconbtn" data-act="vttcondn" data-c="${esc(c.id)}" data-v="1" aria-label="One more ${esc(c.name)}">+</button>` : ""}` : ""}
        ${canEdit ? `<button class="iconbtn" data-act="vttconddel" data-c="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">×</button>` : ""}</div>`; }).join("")}</div>` : ""}
    ${canEdit ? `<div class="vcondadd"><select class="vcondsel" aria-label="Condition">${lib.map(c => `<option value="${esc(c.id)}">${esc((c.emoji ? c.emoji + " " : "") + c.name)}</option>`).join("")}</select><input class="vcondamt" type="number" min="1" value="1" aria-label="Stacks"><button class="btn small" data-act="vttcondadd">Add</button></div>` : ""}</div>`;
}
function vCondSet(id, fn) {
  const t = S.vttTokens.get(id); if (!t) return;
  const conds = fn((Array.isArray(t.conds) ? t.conds : []).map(x => Object.assign({}, x))).filter(x => x && vCond(x.c) && x.n > 0);
  vPatch("vtttokens/" + id, { conds });
}
function vCondAction(a, el) {
  const box = el.closest(".vcondbox"), id = box && box.dataset.tok, t = id && S.vttTokens.get(id);
  if (a === "vttcondinfo") { const c = vCond(el.dataset.c); if (c) toast(`${c.emoji || ""} ${c.name}: ${c.desc || ""}`); return; }
  if (!t || !(vCanEdit() || (PLAYER && vPlayerTok(t)))) return;
  if (a === "vttcondadd") {
    const cid = box.querySelector(".vcondsel").value, c = vCond(cid), amt = Math.max(1, parseInt(box.querySelector(".vcondamt").value, 10) || 1); if (!c) return;
    vCondSet(id, list => { const x = list.find(y => y.c === cid); if (x) { if (c.stacks) x.n = (Number(x.n) || 1) + amt; } else list.push({ c: cid, n: c.stacks ? amt : 1 }); return list; });
    box.querySelector(".vcondamt").value = 1;
  } else if (a === "vttcondn") vCondSet(id, list => list.map(x => x.c === el.dataset.c ? Object.assign(x, { n: (Number(x.n) || 1) + Number(el.dataset.v) }) : x));
  else if (a === "vttconddel") vCondSet(id, list => list.filter(x => x.c !== el.dataset.c));
}
// The library editor.
function vCondLibHtml() {
  const list = vConds();
  return `<h2>Conditions library</h2><p class="muted small">Used for the badges on tokens. Tick <strong>Stacks</strong> for things that build up (rend, on fire); there's no limit on the number.</p>
    <div class="vcondlib">${list.map((c, i) => `<div class="vclrow" data-i="${i}">
      <button type="button" class="vclemo" data-act="vttclemo" data-i="${i}" style="--cc:${esc(c.color || "#aaa")}" aria-label="Pick an emoji for ${esc(c.name)}">${esc(c.emoji || "•")}</button>
      <input type="text" data-cl="name" value="${esc(c.name)}" aria-label="Name">
      <input type="color" data-cl="color" value="${esc(/^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : "#aaaaaa")}" aria-label="Colour">
      <label class="check small"><input type="checkbox" data-cl="stacks"${c.stacks ? " checked" : ""}> Stacks</label>
      <button type="button" class="iconbtn" data-act="vttcldel" data-i="${i}" aria-label="Delete ${esc(c.name)}">×</button>
      <input type="text" class="vcldesc" data-cl="desc" value="${esc(c.desc || "")}" placeholder="What it does (optional)" aria-label="Description"></div>`).join("")}</div>
    <div class="acts wrap"><button class="btn" type="button" data-act="vttcladd">+ New condition</button><button class="btn ghost" type="button" data-act="closemodal">Done</button>${S.vttCondDoc ? `<button class="btn ghost small" type="button" data-act="vttclreset">Add back missing built-ins</button>` : ""}</div>`;
}
function vCondLibSave(list) { S.vttCondDoc = { list }; return safeWrite(() => S.db.doc("settings/vttconds").set({ list })); }
async function vCondLibAction(a, el) {
  const list = vConds().map(c => Object.assign({}, c));
  if (a === "vttcondlib") { openModal(vCondLibHtml()); return; }
  if (a === "vttcladd") { list.push({ id: vid("k"), name: "New condition", emoji: "✦", color: "#c9a96e", stacks: true, desc: "" }); await vCondLibSave(list); openModal(vCondLibHtml()); const ins = document.querySelectorAll("#modal [data-cl=name]"); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } return; }
  if (a === "vttcldel") { const i = Number(el.dataset.i), c = list[i]; if (!c) return; list.splice(i, 1); await vCondLibSave(list); openModal(vCondLibHtml()); toast(`Deleted “${c.name}”. Tokens that had it lose the badge.`); return; }
  if (a === "vttclreset") { VCOND_DEFAULTS.forEach(d => { if (!list.some(c => c.id === d.id)) list.push(Object.assign({}, d)); }); await vCondLibSave(list); openModal(vCondLibHtml()); return; }
  if (a === "vttclemo") {
    const i = Number(el.dataset.i), c = list[i]; if (!c) return;
    const pop = document.createElement("div"); pop.className = "vemopop";
    pop.innerHTML = `${VCOND_EMOJI.map(e => `<button type="button" data-e="${e}">${e}</button>`).join("")}<input type="text" placeholder="or type/paste one" aria-label="Emoji" value="">`;
    document.querySelectorAll(".vemopop").forEach(x => x.remove());
    el.parentElement.appendChild(pop);
    const pick = async e => { if (!e) return; list[i].emoji = e; await vCondLibSave(list); openModal(vCondLibHtml()); };
    pop.addEventListener("click", ev => { const b = ev.target.closest("[data-e]"); if (b) pick(b.dataset.e); });
    pop.querySelector("input").addEventListener("change", ev => pick(ev.target.value.trim()));
    return;
  }
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest(".vclrow [data-cl]"); if (!f || !vCanEdit()) return;
  const i = Number(f.closest(".vclrow").dataset.i), list = vConds().map(c => Object.assign({}, c)); if (!list[i]) return;
  const k = f.dataset.cl; list[i][k] = k === "stacks" ? f.checked : f.value; if (k === "name" && !list[i].name.trim()) list[i].name = "Condition";
  if (k === "color") { const b = f.closest(".vclrow").querySelector(".vclemo"); if (b) b.style.setProperty("--cc", f.value); }
  vCondLibSave(list);
});

// ===== Turn order =====
// camp.init = { list: [{ id, tok, name, img, val, gm }], cur: <entry id>, round }
// An entry with gm: true is the GM's turn for every monster that isn't listed on its own.
const vInitOf = camp => { const c = S.vttCamps.get(camp) || {}; const i = c.init || {}; return { list: Array.isArray(i.list) ? i.list : [], cur: i.cur || "", round: Number(i.round) || 0 }; };
function vInitSorted(list) { return list.map((e, i) => [e, i]).sort((a, b) => { const va = a[0].val == null || a[0].val === "" ? -1e9 : Number(a[0].val), vb = b[0].val == null || b[0].val === "" ? -1e9 : Number(b[0].val); return vb - va || a[1] - b[1]; }).map(x => x[0]); }
const vCampId = () => { const r = document.querySelector(".vtt"); return r && r.dataset.camp; };
function vIsTurn(id, t) {
  const camp = vCampId(); if (!camp || !S.vttCamps.get(camp)) return false;
  const I = vInitOf(camp), e = I.list.find(x => x.id === I.cur); if (!e || !I.round) return false;
  if (e.tok) return e.tok === id;
  return !!e.gm && !t.owner && !(t.ref || "").startsWith("s:") && !I.list.some(x => x.tok === id);
}
function vInitBonus(t) {
  const ref = t.ref || "", n = v => { const m = String(v || "").match(/[+-]?\d+/); return m ? parseInt(m[0], 10) : 0; }, dex = sc => { const v = parseInt(sc, 10); return isFinite(v) ? Math.floor((v - 10) / 2) : 0; };
  if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)); return c ? n(cInit(c)) : 0; }
  if (ref.startsWith("s:")) { const sm = vSummonOf(ref); return sm ? dex(((smView(sm).sb) || {}).dex) : 0; }
  if (ref.startsWith("e:")) { const e = S.entries.get(t.form || ref.slice(2)) || S.entries.get(ref.slice(2)); return e && e.statblock ? dex(e.statblock.dex) : 0; }
  return 0;
}
function vInitTokBtn(id, t) {
  const camp = vCampId(); if (!camp) return "";
  const e = vInitOf(camp).list.find(x => x.tok === id);
  return `<div class="vinitrow">${e ? `<span>⚔ In the turn order${e.val != null && e.val !== "" ? ` at <strong>${esc(e.val)}</strong>` : ""}</span><button class="btn ghost small" data-act="vttinitrm" data-id="${esc(e.id)}">Take out</button>` : `<button class="btn small" data-act="vttinitadd" data-tok="${esc(id)}">⚔ Add to turn order</button><button class="btn ghost small" data-act="vttinitadd" data-tok="${esc(id)}" data-noroll="1" title="Add without rolling, and type the number yourself">Add, no roll</button>`}</div>`;
}
function vInitEntry(id, t, roll) {
  const b = vInitBonus(t), d = Math.floor(Math.random() * 20) + 1;
  return { id: vid("i"), tok: id, name: t.name || "Token", img: vTokSrc(t) || "", val: roll ? d + b : null, _roll: roll ? `${t.name}: d20 ${d} ${b >= 0 ? "+" : "−"} ${Math.abs(b)} = ${d + b}` : "" };
}
async function vInitSave(camp, I) { I.list = I.list.map(e => { const o = Object.assign({}, e); delete o._roll; return o; }); return vPatch("vttcamps/" + camp, { init: I }); }
async function vInitAction(a, el) {
  const camp = vCampId(); if (!camp) return;
  const I = vInitOf(camp); I.list = I.list.map(e => Object.assign({}, e));
  if (a === "vttinitopen") { VTT.initOpen = !VTT.initOpen; VTT.initMin = false; el.classList.toggle("on", VTT.initOpen); el.setAttribute("aria-expanded", VTT.initOpen); vInitDraw(true); return; }
  if (a === "vttinitadd") { const t = S.vttTokens.get(el.dataset.tok); if (!t) return; const e = vInitEntry(el.dataset.tok, t, !el.dataset.noroll); if (e._roll) toast(e._roll); I.list.push(e); VTT.initOpen = true; await vInitSave(camp, I); return; }
  if (a === "vttinitparty") {
    const cur = vPageNow(); if (!cur) return; const rolls = [];
    vTokens(cur.id).forEach(([id, t]) => { if (t.owner && t.layer !== "gm" && !I.list.some(x => x.tok === id)) { const e = vInitEntry(id, t, true); rolls.push(e._roll); I.list.push(e); } });
    if (!rolls.length) { toast("Every player token on this map is already in the turn order."); return; }
    toast(rolls.join(" · ")); await vInitSave(camp, I); return;
  }
  if (a === "vttinitgm") { I.list.push({ id: vid("i"), gm: true, name: "Monsters (GM)", img: "", val: null }); await vInitSave(camp, I); return; }
  if (a === "vttinitrm") { I.list = I.list.filter(x => x.id !== el.dataset.id); if (I.cur === el.dataset.id) { I.cur = ""; } await vInitSave(camp, I); return; }
  if (a === "vttinitclear") { if (!confirm("Clear the turn order?")) return; await vInitSave(camp, { list: [], cur: "", round: 0 }); return; }
  if (a === "vttinitnext" || a === "vttinitprev") {
    const sorted = vInitSorted(I.list); if (!sorted.length) return;
    let i = sorted.findIndex(x => x.id === I.cur);
    if (!I.round || i < 0) { I.round = Math.max(1, I.round); I.cur = sorted[0].id; }
    else if (a === "vttinitnext") { i++; if (i >= sorted.length) { i = 0; I.round++; } I.cur = sorted[i].id; }
    else { i--; if (i < 0) { if (I.round > 1) { I.round--; i = sorted.length - 1; } else i = 0; } I.cur = sorted[i].id; }
    await vInitSave(camp, I); return;
  }
  if (a === "vttinitend") { I.cur = ""; I.round = 0; await vInitSave(camp, I); return; }
  if (a === "vttinitgo") { I.cur = el.dataset.id; I.round = Math.max(1, I.round); await vInitSave(camp, I); return; }
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest(".vturns [data-iv]"); if (!f || !vCanEdit()) return;
  const camp = vCampId(), I = vInitOf(camp);
  if (f.dataset.iv === "__round") { I.round = Math.max(1, Math.floor(Number(f.value)) || 1); f.value = I.round; vInitSave(camp, I); return; }
  I.list = I.list.map(e => e.id === f.dataset.iv ? Object.assign({}, e, f.dataset.k === "name" ? { name: f.value || "Turn" } : { val: f.value === "" ? null : Number(f.value) }) : e);
  vInitSave(camp, I);
});
function vInitDraw(force) {
  const box = document.getElementById("vturns"), camp = vCampId(); if (!box || !camp || !S.vttCamps.get(camp)) return;
  if (!force && document.activeElement && box.contains(document.activeElement) && document.activeElement.matches("input")) return;
  const gm = vCanEdit(), I = vInitOf(camp), sorted = vInitSorted(I.list);
  const show = gm ? VTT.initOpen : sorted.length > 0;
  box.hidden = !show; if (!show) { box.innerHTML = ""; return; }
  const curTok = id => id && S.vttTokens.get(id);
  box.innerHTML = `<div class="vthead"><strong>${I.round ? (gm ? `<label class="vtround">Round <input type="number" min="1" step="1" data-iv="__round" value="${I.round}" aria-label="Round" title="Type a round number: the count carries on from it"></label>` : `Round ${I.round}`) : "Turn order"}</strong>
      ${gm ? `<button class="iconbtn" data-act="vttinitprev" aria-label="Previous turn"${sorted.length ? "" : " disabled"}>◀</button><button class="btn small" data-act="vttinitnext"${sorted.length ? "" : " disabled"}>${I.round ? "Next ▶" : "Start ▶"}</button>` : ""}
      <button class="iconbtn" data-act="vttinitmin" aria-label="${VTT.initMin ? "Show" : "Hide"} the list">${VTT.initMin ? "▸" : "▾"}</button></div>
    ${VTT.initMin ? "" : `<ol class="vtlist">${sorted.map(e => { const t = curTok(e.tok), img = e.gm ? "" : (t ? vTokSrc(t) : e.img), on = I.round && e.id === I.cur;
      const pick = t && (gm || vPlayerTok(t)), face = img ? `<img src="${esc(img)}" alt="">` : `<span class="vtini">${e.gm ? "👹" : esc((e.name || "?")[0])}</span>`;
      return `<li class="${on ? "on" : ""}${e.gm ? " gmturn" : ""}${e.tok && !t ? " gone" : ""}${pick && VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id === e.tok ? " picked" : ""}">${pick ? `<button type="button" class="vtsel" data-act="vttinitsel" data-tok="${esc(e.tok)}" title="Select ${esc(t.name || e.name || "this token")} on the map" aria-label="Select ${esc(t.name || e.name || "this token")}">${face}</button>` : face}
        ${gm ? `<input class="vtname" type="text" data-iv="${esc(e.id)}" data-k="name" value="${esc(t && !e.gm ? t.name || e.name : e.name)}" aria-label="Name"${e.gm ? "" : " readonly tabindex=\"-1\""}><input class="vtval" type="number" data-iv="${esc(e.id)}" value="${e.val == null ? "" : esc(e.val)}" placeholder="–" aria-label="Initiative for ${esc(e.name)}">
          <button class="iconbtn" data-act="vttinitgo" data-id="${esc(e.id)}" aria-label="Make it ${esc(e.name)}'s turn" title="Jump to this turn">▸</button><button class="iconbtn" data-act="vttinitrm" data-id="${esc(e.id)}" aria-label="Take ${esc(e.name)} out">×</button>`
        : `${pick ? `<button type="button" class="vtname vtsel" data-act="vttinitsel" data-tok="${esc(e.tok)}">${esc(t.name || e.name)}</button>` : `<span class="vtname">${esc(t ? t.name || e.name : e.name)}</span>`}<span class="vtval">${e.val == null ? "" : esc(e.val)}</span>`}</li>`; }).join("") || `<li class="muted small vtempty">Select a token and press “Add to turn order”, or add the party below.</li>`}</ol>
    ${gm ? `<div class="vtacts"><button class="btn ghost small" data-act="vttinitparty" title="Roll for every player-controlled token on this map">+ Party</button><button class="btn ghost small" data-act="vttinitgm" title="One turn for all the monsters you run together">+ GM turn</button>${I.round ? `<button class="btn ghost small" data-act="vttinitend">End combat</button>` : ""}<button class="btn ghost small danger" data-act="vttinitclear">Clear</button></div>` : ""}`}`;
}


// When the turn passes to a token, this screen flips to where it stands: its deck if it's aboard a ship (only that ship's
// picker changes), otherwise its floor of the building. Only players' tokens' turns flip it.
function vTurnFollow(cur, p, toks) {
  const camp = vCampId(); if (!camp || !S.vttCamps.get(camp)) return;
  const I = vInitOf(camp), key = camp + "|" + I.round + "|" + I.cur; if (VTT.turnKey === key) return; VTT.turnKey = key;
  const e = I.round && I.list.find(x => x.id === I.cur), id = e && e.tok, t = id && S.vttTokens.get(id); if (!t || t.page !== cur.id || !vPlayerTok(t)) return; // the GM's own turns don't flip anything: their monsters can be anywhere
  const gm = vCanEdit() && !VTT.preview;
  if (t.ship && vIsShip(S.vttTokens.get(t.ship))) {
    const d = Number(t.deck) || 0; if (!gm && !vShipPlayerDecks(t.ship).has(d)) return;
    VTT.shipView = VTT.shipView || {}; if (VTT.shipView[t.ship] === d) return; VTT.shipView[t.ship] = d;
  } else {
    const n = vTokFloor(t);
    if (gm) { if (vMinLevel(p) === vMaxLevel(p) || (VTT.lvl === n && (!VTT.lvlShow || (VTT.lvlShow.size === 1 && VTT.lvlShow.has(n))))) return; VTT.lvl = n; if (VTT.lvlShow) VTT.lvlShow = new Set([n]); const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); }
    else { if (VTT.pfloor === n || !toks.some(([, q]) => vPlayerTok(q) && !q.ship && vTokFloor(q) === n)) return; VTT.pfloor = n; }
  }
  setTimeout(() => { vDraw(); const s = document.getElementById("vside"); if (s) s.innerHTML = vSideHtml(); }, 0);
}

// ===== Shared measurements and pings =====
// Each device keeps one doc, vttlive/<device id>: { page, who, col, gm, meas, ping: { x, y, t, pull } }.
// Only used when running from the PC (the server passes these on and forgets them; they aren't saved to the library).
VTT.mbcast = (() => { try { return localStorage.getItem("vttBcast") !== "0"; } catch (e) { return true; } })();
VTT.pings = []; VTT.pingSeen = null;
const VLIVE_ID = (() => { try { let v = sessionStorage.getItem("vttLiveId"); if (!v) { v = "d" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("vttLiveId", v); } return v; } catch (e) { return "d" + Math.random().toString(36).slice(2, 10); } })();
function vLiveName() { if (vCanEdit()) return "GM"; try { return localStorage.getItem("vttName") || "Player"; } catch (e) { return "Player"; } }
function vLiveCol() { if (vCanEdit()) return "#ffd23c"; let h = 0; for (const ch of VLIVE_ID) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h},85%,62%)`; }
const vLiveOn = () => !!window.__CODEX_SERVER;
function vLiveOthers(pid) { return [...(S.vttLive || new Map())].filter(([id, d]) => id !== VLIVE_ID && d && d.page === pid); }
let vLiveTimer = 0, vLiveLast = 0, vLiveSentMeas = false;
function vLiveWrite(extra) {
  const cur = vPageNow(); if (!cur || !vLiveOn()) return;
  const meas = VTT.mbcast && VTT.meas ? Object.assign({}, VTT.meas) : null;
  if (!meas && !vLiveSentMeas && !extra) return;
  vLiveSentMeas = !!meas;
  const doc = Object.assign({ page: cur.id, who: vLiveName(), col: vLiveCol(), meas }, vCanEdit() ? { gm: true } : {}, extra || (VTT.lastPing ? { ping: VTT.lastPing } : {}));
  safeWrite(() => S.db.doc("vttlive/" + VLIVE_ID).set(doc));
}
function vLiveMeas(now) {
  if (!vLiveOn()) return;
  clearTimeout(vLiveTimer);
  const go = () => { vLiveLast = Date.now(); vLiveWrite(); };
  if (now || Date.now() - vLiveLast > 120) go(); else vLiveTimer = setTimeout(go, 120);
}
function vPing(x, y, pull) {
  const cur = vPageNow(); if (!cur) return;
  vPingShow(x, y, vLiveCol(), vLiveName(), true);
  VTT.lastPing = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, t: Date.now(), pull: !!(pull && vCanEdit()) };
  vLiveWrite({ ping: VTT.lastPing });
  if (pull) toast("Everyone's view moved here");
}
function vPingShow(x, y, col, who, mine) {
  VTT.pings.push({ x, y, col, who, mine, until: Date.now() + 3200, k: Math.random().toString(36).slice(2) });
  vPingDraw();
  setTimeout(vPingDraw, 3300);
}
function vPingDraw() {
  const box = document.getElementById("vpings"); if (!box) return;
  const now = Date.now(); VTT.pings = VTT.pings.filter(p => p.until > now);
  const have = new Set([...box.children].map(e => e.dataset.k));
  VTT.pings.forEach(p => { if (have.has(p.k)) return; const d = document.createElement("div"); d.className = "vping"; d.dataset.k = p.k; d.style.cssText = `left:${p.x * VCELL}px;top:${p.y * VCELL}px;--pc:${p.col}`; d.innerHTML = `<i></i><i></i><i></i><b></b><span>${esc(p.who || "")}</span>`; box.appendChild(d); });
  [...box.children].forEach(e => { if (!VTT.pings.some(p => p.k === e.dataset.k)) e.remove(); });
}
function vCenterOn(x, y) { const view = document.getElementById("vview"); if (!view) return; const r = view.getBoundingClientRect(); VTT.panX = r.width / 2 - x * VCELL * VTT.zoom; VTT.panY = r.height / 2 - y * VCELL * VTT.zoom; vApplyView(); }
// New docs from other devices: show fresh pings, redraw measurements.
function vLiveSnap() {
  const first = !VTT.pingSeen; if (first) VTT.pingSeen = new Map();
  const cur = vPageNow();
  for (const [id, d] of S.vttLive || new Map()) {
    if (id === VLIVE_ID || !d || !d.ping) continue;
    const seen = VTT.pingSeen.get(id); VTT.pingSeen.set(id, d.ping.t);
    if (first || seen === d.ping.t || !cur || d.page !== cur.id) continue;
    vPingShow(d.ping.x, d.ping.y, d.col, d.who, false);
    if (d.ping.pull && d.gm && !vCanEdit()) vCenterOn(d.ping.x, d.ping.y);
  }
  vMeasDraw();
}
// Hold the pointer still on the map to ping, wherever you are and whatever tool you have.
(function () {
  let timer = 0, start = null;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  document.addEventListener("pointerdown", ev => {
    cancel();
    const view = ev.target.closest && ev.target.closest("#vview"); if (!view || ev.button !== 0 || ev.target.closest(".vzoom,.vptools,.vturns,.vfloors")) return;
    if (["wall", "area", "measure", "ping", "travel", "scale", "align", "gridfit", "decksq", "draw", "link"].includes(VTT.tool)) return;
    start = [ev.clientX, ev.clientY];
    const pt = vPt(ev), shift = ev.shiftKey;
    timer = setTimeout(() => { timer = 0; VTT.pingHeld = true; vPing(pt[0], pt[1], shift && vCanEdit()); }, 550);
  }, true);
  document.addEventListener("pointermove", ev => { if (timer && start && Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) > 8) cancel(); }, true);
  document.addEventListener("pointerup", cancel, true); document.addEventListener("pointercancel", cancel, true);
})();


// ===== Atmosphere: lighting and weather laid over the whole map =====
// page.fx = { k: kind, a: strength 0–100 }. The tint sits over the map and tokens; rain, snow and lightning
// are drawn on a canvas over the view (so a huge map costs no more than a small one).
const VFX = {
  dark:     { name: "🌑 Darkness (indoors)", tint: ["#20232c", "multiply", 0.95], dark: true },
  day:      { name: "☀️ Daylight", tint: ["#ffe2a0", "soft-light", 0.55] },
  dusk:     { name: "🌇 Dusk", tint: ["#ff8a4c", "multiply", 0.45], tint2: ["#5b3a8a", "soft-light", 0.35], dark: true },
  night:    { name: "🌙 Night", tint: ["#5a6cb4", "multiply", 0.85], tint2: ["#2c4cc8", "soft-light", 0.3], dark: true },
  overcast: { name: "☁️ Cloudy", tint: ["#8c96a6", "multiply", 0.4], clouds: 0.35 },
  rain:     { name: "🌧 Rain", tint: ["#6f7d92", "multiply", 0.5], clouds: 0.45, rain: 1 },
  storm:    { name: "⛈ Thunderstorm", tint: ["#323c58", "multiply", 0.68], clouds: 0.6, rain: 2.2, lightning: true, dark: true },
  fog:      { name: "🌫 Mist", tint: ["#c9d2dc", "screen", 0.28], mist: true },
  snow:     { name: "❄️ Snow", tint: ["#c8d8ee", "multiply", 0.3], tint2: ["#ffffff", "soft-light", 0.25], clouds: 0.25, snow: true },
};
VTT.fxOff = (() => { try { return localStorage.getItem("vttFxOff") === "1"; } catch (e) { return false; } })();
const vFxReduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
function vFxOf(p) { const fx = p && p.fx; const d = fx && VFX[fx.k]; return d && !VTT.fxOff ? { d, k: fx.k, s: Math.max(0, Math.min(100, fx.a == null ? 60 : Number(fx.a))) / 100 } : null; }
function vFxToolsHtml() {
  const cur = vPageNow(), fx = (cur && cur.p.fx) || {};
  return `<div class="vgroup"><span class="vlab">Atmosphere</span>
    <select class="vfxsel" data-act="vttfx" aria-label="Atmosphere"><option value="">None</option>${Object.entries(VFX).map(([k, d]) => `<option value="${k}"${fx.k === k ? " selected" : ""}>${d.name}</option>`).join("")}</select>
    ${fx.k ? `<label class="vfxamt small"><span>Strength</span><input type="range" min="10" max="100" step="5" value="${fx.a == null ? 60 : fx.a}" class="vfxa" aria-label="Strength"></label>
    <label class="check small"><input type="checkbox" data-act="vttfxlocal"${VTT.fxOff ? "" : " checked"}> Show on my screen</label>
    ${VFX[fx.k] && VFX[fx.k].dark ? `<label class="check small" title="Players only see places that are lit, or within their darkvision. Unlit tokens there are hidden."><input type="checkbox" data-act="vttfxhide"${vDarkOn(cur.p) ? " checked" : ""}> Darkness hides what isn't lit</label>` : ""}` : ""}</div>`;
}
document.addEventListener("input", ev => { if (!ev.target.matches || !ev.target.matches(".vfxa")) return; const cur = vPageNow(); if (!cur) return; cur.p.fx = Object.assign({}, cur.p.fx, { a: Number(ev.target.value) }); vDraw(); });
document.addEventListener("change", ev => {
  if (ev.target.matches && ev.target.matches(".vfxsel")) { vttAction("vttfx", ev.target); return; }
  if (!ev.target.matches || !ev.target.matches(".vfxa") || !vCanEdit()) return; const cur = vPageNow(); if (!cur) return; vPatch("vttpages/" + cur.id, { fx: Object.assign({}, cur.p.fx, { a: Number(ev.target.value) }) });
});
function vFxStageHtml(p) {
  const f = vFxOf(p); if (!f) return "";
  const { d, s } = f, lay = (t, cls) => !t ? "" : d.dark ? `<canvas class="vfxtint vfxcut" data-col="${t[0]}" style="mix-blend-mode:${t[1]};opacity:${(t[2] * (0.35 + 0.65 * s)).toFixed(3)}"></canvas>` : `<div class="vfxtint ${cls || ""}" style="background:${t[0]};mix-blend-mode:${t[1]};opacity:${(t[2] * (0.35 + 0.65 * s)).toFixed(3)}"></div>`;
  return `<div class="vfx">${lay(d.tint)}${lay(d.tint2)}${d.dark ? `<canvas class="vfxtint vlglow" id="vlglow"></canvas>` : ""}${d.clouds ? `<div class="vfxclouds${vFxReduced() ? " still" : ""}" style="opacity:${(d.clouds * (0.4 + 0.9 * s)).toFixed(3)}"></div>` : ""}${d.mist ? `<div class="vfxmist${vFxReduced() ? " still" : ""}" style="opacity:${(0.15 + 0.45 * s).toFixed(3)}"></div><div class="vfxmist b${vFxReduced() ? " still" : ""}" style="opacity:${(0.1 + 0.35 * s).toFixed(3)}"></div>` : ""}</div>`;
}
// The moving parts: rain, snow and lightning on a canvas the size of the view.
const VFXR = { raf: 0, parts: [], kind: "", flash: 0, nextBolt: 0, last: 0 };
function vFxRun(p) {
  const cv = document.getElementById("vfxp"), f = vFxOf(p);
  const need = f && (f.d.rain || f.d.snow || f.d.lightning);
  if (!cv || !need) { if (cv) { cv.width = cv.width; cv.style.display = "none"; } cancelAnimationFrame(VFXR.raf); VFXR.raf = 0; VFXR.kind = ""; return; }
  cv.style.display = "block"; VFXR.f = f;
  if (VFXR.kind !== f.k + f.s) { VFXR.kind = f.k + f.s; VFXR.parts = []; VFXR.nextBolt = performance.now() + 2500 + Math.random() * 5000; }
  if (!VFXR.raf) VFXR.raf = requestAnimationFrame(vFxFrame);
}
function vFxFrame(now) {
  const cv = document.getElementById("vfxp"), f = VFXR.f;
  if (!cv || !document.body.contains(cv) || !f || cv.style.display === "none") { VFXR.raf = 0; VFXR.kind = ""; return; }
  VFXR.raf = requestAnimationFrame(vFxFrame);
  const dt = Math.min(0.05, (now - (VFXR.last || now)) / 1000); VFXR.last = now;
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, W, H);
  const still = vFxReduced(), area = (W * H) / (1000 * 700 * dpr * dpr), z = Math.max(0.5, Math.min(2, VTT.zoom));
  if ((f.d.rain || f.d.snow) && !still) {
    const want = Math.round((f.d.snow ? 220 : 380 * f.d.rain) * f.s * area);
    while (VFXR.parts.length < want) VFXR.parts.push({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random() * 0.8, w: Math.random() });
    if (VFXR.parts.length > want) VFXR.parts.length = want;
    if (f.d.rain) {
      const len = 18 * dpr * z, sp = 1400 * dpr, ang = 0.22;
      ctx.strokeStyle = "rgba(200,215,240,.45)"; ctx.lineWidth = 1.2 * dpr; ctx.beginPath();
      for (const q of VFXR.parts) { q.y += sp * q.v * dt; q.x += sp * q.v * ang * dt; if (q.y > H) { q.y = -len; q.x = Math.random() * (W + H * ang) - H * ang; } if (q.x > W) q.x -= W; ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - len * ang * q.v, q.y - len * q.v); }
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const q of VFXR.parts) { q.y += 45 * dpr * q.v * dt; q.x += Math.sin(now / 1000 * q.v + q.w * 6) * 20 * dpr * dt; if (q.y > H) { q.y = -4; q.x = Math.random() * W; } ctx.beginPath(); ctx.arc(q.x, q.y, (1 + q.w * 2.2) * dpr * Math.sqrt(z), 0, 6.283); ctx.fill(); }
    }
  }
  if (f.d.lightning && !still) {
    if (now > VFXR.nextBolt) { VFXR.flash = 0.55 + 0.35 * f.s; VFXR.second = now + 140 + Math.random() * 120; VFXR.nextBolt = now + (9000 - 5000 * f.s) + Math.random() * 9000; }
    if (VFXR.second && now > VFXR.second) { VFXR.flash = Math.max(VFXR.flash, 0.4 + 0.3 * f.s); VFXR.second = 0; }
    if (VFXR.flash > 0.01) { ctx.fillStyle = `rgba(225,235,255,${VFXR.flash.toFixed(3)})`; ctx.fillRect(0, 0, W, H); VFXR.flash *= Math.pow(0.0015, dt); }
  }
}


// ===== Light sources =====
// Library: settings/vttlights { list: [{ id, name, color, bright, dim }] } (feet). Map lights: page.lights = [{ id, x, y, level, name, color, bright, dim }].
// Tokens: t.light = { name, color, bright, dim }. Characters also shine with any equipped item that has item.light.
// Lights cut through the darkness of Night, Dusk, Thunderstorm and Darkness, and are stopped by walls on their level.
const VLIGHT_DEFAULTS = [
  ["torch", "Torch", "#ff9a3c", 30, 30], ["lantern", "Lantern", "#ffc46b", 30, 30], ["candle", "Candle", "#ffb35c", 5, 5], ["campfire", "Campfire", "#ff7a2a", 20, 20],
  ["lightc", "Light (cantrip)", "#fff4d6", 20, 20], ["magic", "Magic light", "#bcd4ff", 60, 60], ["daylight", "Daylight (spell)", "#fffbe8", 60, 60], ["fungus", "Glowing fungus", "#7dffb0", 5, 10],
].map(([id, name, color, bright, dim]) => ({ id, name, color, bright, dim }));
function vLights() { return S.vttLightDoc && Array.isArray(S.vttLightDoc.list) ? S.vttLightDoc.list : VLIGHT_DEFAULTS; }
const vLight = id => vLights().find(l => l.id === id);
const vLightOk = l => l && (Number(l.bright) > 0 || Number(l.dim) > 0);
VTT.lightPreset = "torch";
// Everything shining on a page: [{ x, y, h, bright, dim, color }] in squares.
function vEmitters(p, toks) {
  const out = [];
  (p.lights || []).forEach(l => { if (vLightOk(l)) out.push({ x: l.x, y: l.y, h: l.level || 0, bright: +l.bright || 0, dim: +l.dim || 0, color: l.color || "#ffd9a0" }); });
  toks.forEach(([id, t]) => { if (t.layer === "gm" && !vCanEdit()) return; vTokLights(t).forEach(l => out.push({ x: t.x + vTokSz(t) / 2, y: t.y + vTokSz(t) / 2, h: vHeight(t), bright: +l.bright || 0, dim: +l.dim || 0, color: l.color || "#ffd9a0" })); });
  return out;
}
// SRD gear that gives light without any setup.
const VLIGHT_SRD = { "Torch": { name: "Torch", color: "#ff9a3c", bright: 20, dim: 20 }, "Candle": { name: "Candle", color: "#ffb35c", bright: 5, dim: 5 }, "Lantern, hooded": { name: "Hooded lantern", color: "#ffc46b", bright: 30, dim: 30 }, "Lantern, bullseye": { name: "Bullseye lantern", color: "#ffc46b", bright: 60, dim: 60 }, "Lamp": { name: "Lamp", color: "#ffc46b", bright: 15, dim: 30 } };
function vItemLights(t) {
  if (!t.ref || !t.ref.startsWith("c:") || typeof invOf !== "function") return [];
  const c = S.chars.get(t.ref.slice(2)); if (!c) return [];
  const inv = invOf(c), out = [], seen = new Set();
  ["ar", ...EQ_KEYS].forEach(k => { const sl = inv.slots[k]; if (!sl || seen.has(sl.ref)) return; seen.add(sl.ref); const r = invResolve(sl.ref, sl.name); let L = r && r.e && r.e.item && r.e.item.light;
    if (!vLightOk(L) && r && r.src === "srd") { const k = Object.keys(VLIGHT_SRD).find(n => new RegExp("^" + n, "i").test(r.name)); if (k) L = VLIGHT_SRD[k]; }
    if (vLightOk(L)) out.push(Object.assign({ from: r.name }, L)); });
  return out;
}
const vTokLights = t => (vLightOk(t.light) ? [t.light] : []).concat(vItemLights(t));
function vLightsPaint(pid, p, toks) {
  const cuts = [...document.querySelectorAll("#vstage .vfxcut")], glow = document.getElementById("vlglow");
  if (!cuts.length && !glow) return;
  const R = vCvRes(p, 24), W = p.w * R, H = p.h * R, em = vEmitters(p, toks), polyCache = new Map();
  const polyOf = e => { const k = e.x + "," + e.y + "," + e.h; if (!polyCache.has(k)) polyCache.set(k, vVisPoly(e.x, e.y, vSegs(p, e.h))); return polyCache.get(k); };
  const clip = (ctx, e) => { const poly = polyOf(e); ctx.beginPath(); if (poly.length < 3) { ctx.rect(0, 0, W, H); return; } poly.forEach(([x, y], i) => i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)); ctx.closePath(); };
  cuts.forEach(cv => {
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } cv.style.width = p.w * VCELL + "px"; cv.style.height = p.h * VCELL + "px";
    const ctx = cv.getContext("2d"); ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, W, H); ctx.fillStyle = cv.dataset.col; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    em.forEach(e => {
      const rr = (e.bright + e.dim) / 5 * R; if (rr <= 0) return; const bf = e.bright / (e.bright + e.dim);
      const g = ctx.createRadialGradient(e.x * R, e.y * R, 0, e.x * R, e.y * R, rr);
      g.addColorStop(0, "rgba(0,0,0,1)"); if (bf > 0) { g.addColorStop(Math.max(0, bf - 0.03), "rgba(0,0,0,1)"); g.addColorStop(Math.min(1, bf + 0.03), "rgba(0,0,0,.55)"); }
      g.addColorStop(0.85, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); clip(ctx, e); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    });
  });
  if (glow) {
    if (glow.width !== W || glow.height !== H) { glow.width = W; glow.height = H; } glow.getContext("2d").clearRect(0, 0, W, H); glow.style.width = p.w * VCELL + "px"; glow.style.height = p.h * VCELL + "px";
    const ctx = glow.getContext("2d"); ctx.globalCompositeOperation = "lighter";
    const rgba = (hex, a) => { const m = String(hex).match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); const [r, g, b] = m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [255, 217, 160]; return `rgba(${r},${g},${b},${a})`; };
    em.forEach(e => {
      const rr = (e.bright + e.dim) / 5 * R; if (rr <= 0) return; const bf = e.bright / (e.bright + e.dim);
      const g = ctx.createRadialGradient(e.x * R, e.y * R, 0, e.x * R, e.y * R, rr);
      g.addColorStop(0, rgba(e.color, 0.32)); g.addColorStop(Math.max(0.05, bf), rgba(e.color, 0.14)); g.addColorStop(1, rgba(e.color, 0));
      ctx.save(); clip(ctx, e); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    });
  }
}
// GM: what's on the Lights layer.
function vLightMarks(p) {
  const C = VCELL, sel = VTT.sel && VTT.sel.kind === "light" ? VTT.sel.id : "";
  return `<svg class="vlmarks" width="${p.w * C}" height="${p.h * C}" aria-hidden="true">${(p.lights || []).map(l => { const b = (+l.bright || 0) / 5 * C, d = ((+l.bright || 0) + (+l.dim || 0)) / 5 * C;
    return `<g class="${l.id === sel ? "sel" : ""}${(l.level || 0) !== VTT.lvl ? " otherlvl" : ""}${vLvlHid(l.level) ? " lvlhid" : ""}" style="--lc:${esc(l.color || "#ffd9a0")}"><circle class="dimr" cx="${l.x * C}" cy="${l.y * C}" r="${d}"/>${b ? `<circle class="brr" cx="${l.x * C}" cy="${l.y * C}" r="${b}"/>` : ""}<circle class="lc" cx="${l.x * C}" cy="${l.y * C}" r="14"/><text x="${l.x * C}" y="${l.y * C + 6}">💡</text></g>`; }).join("")}</svg>`;
}
function vLightToolsHtml() {
  const lib = vLights();
  if (!lib.some(l => l.id === VTT.lightPreset) && lib[0]) VTT.lightPreset = lib[0].id;
  return `<div class="vgroup"><span class="vlab">Light to place</span><select class="vlpre" aria-label="Light to place">${lib.map(l => `<option value="${esc(l.id)}"${l.id === VTT.lightPreset ? " selected" : ""}>${esc(l.name)} · ${l.bright}/${l.dim} ft</option>`).join("")}</select>
    <p class="muted small vlhint">Click the map to place it on ${esc(vLevelName((vPageNow() || {}).p, VTT.lvl))}. Lights show when the Atmosphere is dark (Night, Dusk, Storm, Darkness).</p><button class="vbtn" data-act="vttlightlib">Edit light library</button></div>`;
}
document.addEventListener("change", ev => { if (ev.target.matches && ev.target.matches(".vlpre")) VTT.lightPreset = ev.target.value; });
function vLightPlace(x, y) {
  const cur = vPageNow(), pre = vLight(VTT.lightPreset); if (!cur || !pre) return;
  const l = { id: vid("l"), x, y, level: VTT.lvl, name: pre.name, color: pre.color, bright: pre.bright, dim: pre.dim };
  VTT.sel = { kind: "light", id: l.id };
  vPatch("vttpages/" + cur.id, { lights: (cur.p.lights || []).concat([l]) });
}
function vLightSet(id, fields) { const cur = vPageNow(); if (!cur) return; vPatch("vttpages/" + cur.id, { lights: (cur.p.lights || []).map(l => l.id === id ? Object.assign({}, l, fields) : l) }); }
function vLightSideHtml(p, l) {
  return `<h2>💡 ${esc(l.name || "Light")}</h2><div class="vform" data-light="${esc(l.id)}">
    <label><span>Use a preset</span><select data-lf="preset"><option value="">(keep as it is)</option>${vLights().map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${x.bright}/${x.dim} ft</option>`).join("")}</select></label>
    <label><span>Name</span><input type="text" data-lf="name" value="${esc(l.name || "")}"></label>
    <div class="frow tight"><label><span>Bright (ft)</span><input type="number" min="0" step="5" data-lf="bright" value="${+l.bright || 0}"></label><label><span>Dim (ft)</span><input type="number" min="0" step="5" data-lf="dim" value="${+l.dim || 0}"></label><label><span>Colour</span><input type="color" data-lf="color" value="${esc(/^#[0-9a-f]{6}$/i.test(l.color || "") ? l.color : "#ffd9a0")}"></label></div>
    <label><span>Level</span><select data-lf="level">${vLevelList(p).map(n => `<option value="${n}"${(l.level || 0) === n ? " selected" : ""}>${esc(vLevelName(p, n))}</option>`).join("")}</select></label>
    <p class="muted small">Dim light reaches that far beyond the bright light. Walls on the same level cast shadows. Drag the 💡 to move it; hold Alt to place it off the grid.</p>
    <div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete light</button></div></div>`;
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest("[data-light] [data-lf]"); if (!f || !vCanEdit()) return;
  const id = f.closest("[data-light]").dataset.light, k = f.dataset.lf;
  if (k === "preset") { const pre = vLight(f.value); if (pre) vLightSet(id, { name: pre.name, color: pre.color, bright: pre.bright, dim: pre.dim }); return; }
  vLightSet(id, { [k]: ["bright", "dim", "level"].includes(k) ? Math.max(0, Number(f.value) || 0) : f.value });
});
// A token's own light (players can set their own tokens').
function vTokLightHtml(id, t, canEdit) {
  const items = vItemLights(t), own = vLightOk(t.light) ? t.light : null;
  if (!canEdit && !own && !items.length && !vDarkvision(t)) return "";
  const cur = own ? (vLights().find(l => l.name === own.name && +l.bright === +own.bright && +l.dim === +own.dim) || {}).id || "custom" : "";
  return `<div class="vflyrow vlightrow"><span>Light</span>${canEdit ? `<select class="vtoklight" data-tok="${esc(id)}" aria-label="Light this token gives off"><option value="">None</option>${vLights().map(l => `<option value="${esc(l.id)}"${cur === l.id ? " selected" : ""}>${esc(l.name)} · ${l.bright}/${l.dim} ft</option>`).join("")}${cur === "custom" ? `<option value="custom" selected>${esc(own.name || "Custom")}</option>` : ""}</select>` : `<strong>${own ? esc(own.name) : "—"}</strong>`}</div>
    ${vDarkvision(t) ? `<p class="muted small vlitems">👁 Darkvision ${vDarkvision(t)} ft</p>` : ""}
    ${items.length ? `<p class="muted small vlitems">💡 Shining from equipped ${items.map(l => `<strong>${esc(l.from)}</strong> (${l.bright}/${l.dim} ft)`).join(", ")}</p>` : ""}`;
}
document.addEventListener("change", ev => {
  if (!ev.target.matches || !ev.target.matches(".vtoklight")) return;
  const id = ev.target.dataset.tok, t = S.vttTokens.get(id); if (!t || !(vCanEdit() || (PLAYER && vPlayerTok(t)))) return;
  if (ev.target.value === "custom") return;
  const pre = vLight(ev.target.value);
  vPatch("vtttokens/" + id, { light: pre ? { name: pre.name, color: pre.color, bright: pre.bright, dim: pre.dim } : null });
});
// The light library editor.
function vLightLibHtml() {
  return `<h2>Light library</h2><p class="muted small">Presets for lights on the map, on tokens and on items. Bright light first, then how much dim light reaches beyond it.</p>
    <div class="vcondlib">${vLights().map((l, i) => `<div class="vllrow" data-i="${i}"><span class="vllsw" style="background:${esc(l.color)}"></span>
      <input type="text" data-ll="name" value="${esc(l.name)}" aria-label="Name">
      <label><span class="small muted">Bright</span><input type="number" min="0" step="5" data-ll="bright" value="${+l.bright || 0}"></label>
      <label><span class="small muted">Dim</span><input type="number" min="0" step="5" data-ll="dim" value="${+l.dim || 0}"></label>
      <input type="color" data-ll="color" value="${esc(/^#[0-9a-f]{6}$/i.test(l.color || "") ? l.color : "#ffd9a0")}" aria-label="Colour">
      <button type="button" class="iconbtn" data-act="vttlldel" data-i="${i}" aria-label="Delete ${esc(l.name)}">×</button></div>`).join("")}</div>
    <div class="acts wrap"><button class="btn" type="button" data-act="vttlladd">+ New light</button><button class="btn ghost" type="button" data-act="closemodal">Done</button>${S.vttLightDoc ? `<button class="btn ghost small" type="button" data-act="vttllreset">Add back missing built-ins</button>` : ""}</div>`;
}
function vLightLibSave(list) { S.vttLightDoc = { list }; return safeWrite(() => S.db.doc("settings/vttlights").set({ list })); }
async function vLightLibAction(a, el) {
  const list = vLights().map(l => Object.assign({}, l));
  if (a === "vttlightlib") { openModal(vLightLibHtml()); return; }
  if (a === "vttlladd") { list.push({ id: vid("g"), name: "New light", color: "#ffd9a0", bright: 20, dim: 20 }); await vLightLibSave(list); openModal(vLightLibHtml()); const ins = document.querySelectorAll("#modal [data-ll=name]"); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } return; }
  if (a === "vttlldel") { list.splice(Number(el.dataset.i), 1); await vLightLibSave(list); openModal(vLightLibHtml()); return; }
  if (a === "vttllreset") { VLIGHT_DEFAULTS.forEach(d => { if (!list.some(l => l.id === d.id)) list.push(Object.assign({}, d)); }); await vLightLibSave(list); openModal(vLightLibHtml()); }
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest(".vllrow [data-ll]"); if (!f || !vCanEdit()) return;
  const i = Number(f.closest(".vllrow").dataset.i), list = vLights().map(l => Object.assign({}, l)); if (!list[i]) return;
  const k = f.dataset.ll; list[i][k] = k === "bright" || k === "dim" ? Math.max(0, Number(f.value) || 0) : f.value;
  if (k === "color") f.closest(".vllrow").querySelector(".vllsw").style.background = f.value;
  vLightLibSave(list); const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml();
});


// ===== Darkness and darkvision =====
// Applies on Night and Darkness by default (and any dark atmosphere where the GM ticks it): see vFog.
function vDarkOn(p) { const fx = p && p.fx, d = fx && VFX[fx.k]; if (!d || !d.dark) return false; return fx.hide != null ? !!fx.hide : (fx.k === "night" || fx.k === "dark"); }
const VDV_RACES = [[/\b(drow|dark elf|duergar|deep gnome|svirfneblin)\b/i, 120], [/\b(dwarf|elf|gnome|half-orc|half orc|orc|tiefling|half-elf|half elf|goblin|hobgoblin|bugbear|kobold|yuan-ti|tabaxi|firbolg|genasi|aasimar|githyanki|githzerai|shifter|changeling|kenku|lizardfolk|minotaur|satyr|fairy|harengon|owlin|dhampir|hexblood|reborn)\b/i, 60]];
function vDvText(text) { const m = String(text || "").match(/darkvision[\s\S]{0,160}?(\d+)\s*-?\s*(?:ft|feet|foot)/i); return m ? Number(m[1]) : 0; }
function vDarkvisionAuto(t) {
  const ref = t.ref || "";
  try {
    if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)); if (!c) return 0; const n = vDvText(JSON.stringify([c.features, c.senses, c.race, c.notes, c.traits])); if (n) return n; const r = VDV_RACES.find(([re]) => re.test(c.race || "")); return r ? r[1] : 0; }
    if (ref.startsWith("s:")) { const sm = vSummonOf(ref); return sm ? vDvText(JSON.stringify(smView(sm).sb || {})) : 0; }
    if (ref.startsWith("e:")) { const e = S.entries.get(t.form || ref.slice(2)) || S.entries.get(ref.slice(2)); return e ? vDvText(JSON.stringify(e.statblock || {}) + " " + (e.body || "").slice(0, 3000)) : 0; }
  } catch (e) {}
  return 0;
}
function vDarkvision(t) { return t.dv != null && t.dv !== "" ? Math.max(0, Number(t.dv) || 0) : vDarkvisionAuto(t); }


// ===== Doors and windows =====
// A wall can be [x1, y1, x2, y2, level, { k: "door" | "window", id, open, locked, secret }].
// Open doors and windows don't block sight or light. Players can open and close doors that aren't locked;
// secret doors look like plain walls to them until the GM opens or reveals them.
const vWallOpen = w => !!(w[5] && (w[5].k === "window" || (w[5].k === "door" && (w[5].open || w[5].clear))));
// For movement: a see-through door still blocks until it's opened.
const vWallPassable = w => !!(w[5] && (w[5].k === "window" || (w[5].k === "door" && w[5].open)));
function vDoorMarks(p, gm) {
  const C = VCELL;
  return `<div class="vdoors">${(p.walls || []).map((w, i) => { const m = w[5]; if (!m || (m.secret && !gm)) return "";
    const x = (w[0] + w[2]) / 2, y = (w[1] + w[3]) / 2, lvl = w[4] || 0, other = gm && lvl !== VTT.lvl; if (gm && vLvlHid(lvl)) return "";
    const label = m.k === "window" ? "Window · climb through" : m.locked && !gm ? "Locked" : m.open ? "Close door" : "Open door";
    const icon = m.k === "window" ? "🪟" : m.locked ? "🔒" : m.open ? "🚪" : "🚪";
    if (m.k === "window") return `<div class="vdoor window${other ? " otherlvl" : ""}" data-x="${x}" data-y="${y}" style="left:${x * C}px;top:${y * C}px" title="Window: you can see through it, and climb through"><span class="vdi">🪟</span><span class="vdl">Window · climb through</span></div>`;
    return `<button class="vdoor ${m.k}${m.open ? " open" : ""}${m.clear ? " clear" : ""}${m.locked ? " locked" : ""}${m.secret ? " secret" : ""}${other ? " otherlvl" : ""}" data-door="${esc(m.id)}" data-x="${x}" data-y="${y}" style="left:${x * C}px;top:${y * C}px" title="${esc(label + (gm && m.secret ? " (secret: players see a wall)" : "") + (gm && m.locked ? " (locked for players)" : ""))}"><span class="vdi">${icon}</span><span class="vdl">${esc(gm && m.secret ? "Secret door" : label)}</span></button>`; }).join("")}</div>`;
}
async function vDoorClick(id) {
  const cur = vPageNow(); if (!cur) return;
  const i = (cur.p.walls || []).findIndex(w => w[5] && w[5].id === id), w = i >= 0 && cur.p.walls[i]; if (!w) return;
  const m = w[5], gm = vCanEdit();
  if (m.k === "window") { toast("🪟 A window: you can see through it, and climb through if you want."); return; }
  if (m.locked && !gm) { toast("🔒 This door is locked."); return; }
  const walls = cur.p.walls.map(x => x[5] && x[5].id === id ? x.slice(0, 5).concat([Object.assign({}, x[5], { open: !x[5].open }, gm && x[5].secret ? { secret: false } : {})]) : x);
  cur.p.walls = walls; vDraw();
  await vPatch("vttpages/" + cur.id, { walls });
}
function vWallSideHtml(p, i) {
  const w = p.walls[i], m = w[5] || {}, k = m.k || "wall";
  return `<h2>${k === "door" ? "🚪 Door" : k === "window" ? "🪟 Window" : "Wall"}</h2><p class="muted small">On <strong>${esc(vLevelName(p, w[4] || 0))}</strong>.</p>
    <div class="vform" data-wall="${i}"><div><span class="flabel">Type</span><div class="seg vwk">${[["wall", "Wall"], ["door", "🚪 Door"], ["window", "🪟 Window"]].map(([v, l]) => `<button type="button" class="${k === v ? "on" : ""}" data-act="vttwtype" data-v="${v}">${l}</button>`).join("")}</div></div>
    ${k === "door" ? `<label class="check"><input type="checkbox" data-wf="open"${m.open ? " checked" : ""}> Open</label>
      <label class="check"><input type="checkbox" data-wf="locked"${m.locked ? " checked" : ""}> Locked <small class="muted">players can't open it</small></label>
      <label class="check"><input type="checkbox" data-wf="clear"${m.clear ? " checked" : ""}> See-through <small class="muted">bars, a portcullis, a glass door: sight and light pass even when it's shut</small></label>
      <label class="check"><input type="checkbox" data-wf="secret"${m.secret ? " checked" : ""}> Secret <small class="muted">players see a plain wall until you open it</small></label>` : ""}
    <p class="muted small">${k === "window" ? "Sight and light pass through; players see a window marker so they know they can climb through." : k === "door" ? "Closed doors block sight and light. Players click the door marker to open or close it." : "Blocks sight for tokens at this height when dynamic lighting is on."}</p>
    <div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete</button></div></div>`;
}
function vWallMeta(i, fn) {
  const cur = vPageNow(); if (!cur) return; const walls = cur.p.walls.slice(), w = walls[i]; if (!w) return;
  const m = fn(Object.assign({}, w[5] || {}));
  walls[i] = m && m.k && m.k !== "wall" ? [w[0], w[1], w[2], w[3], w[4] || 0, Object.assign({ id: vid("d") }, m)] : (w[4] ? w.slice(0, 5) : w.slice(0, 4));
  vPatch("vttpages/" + cur.id, { walls });
}
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-act=vttwtype]"); if (!b || !vCanEdit()) return; const i = Number(b.closest("[data-wall]").dataset.wall); vWallMeta(i, m => Object.assign(m, { k: b.dataset.v })); });
document.addEventListener("change", ev => { const f = ev.target.closest && ev.target.closest("[data-wall] [data-wf]"); if (!f || !vCanEdit()) return; const i = Number(f.closest("[data-wall]").dataset.wall); vWallMeta(i, m => Object.assign(m, { [f.dataset.wf]: f.checked }, f.dataset.wf === "open" && f.checked ? { secret: false } : {})); });

// ===== Stairs and lifts =====
// page.links = [{ id, kind: "stairs" | "lift", x, y, w, h, levels: [..] }] in squares. A token standing on one, on one of its levels,
// gets a button for each other level. Stairs join two levels; a lift can stop at several.

// ----- Raised squares: each level keeps one set of grid squares that are "up there" -----
// page.areas = [{ id, level, cells: [[x, y], ...] }]; older areas drawn as outlines keep { pts } and still work.
function vInArea(a, x, y) {
  if (Array.isArray(a.cells)) { const cx = Math.floor(x), cy = Math.floor(y); return a.cells.some(c => c[0] === cx && c[1] === cy); }
  return Array.isArray(a.pts) && vInPoly(x, y, a.pts);
}
function vAreaPickLevel() {
  const cur = vPageNow(); VTT.lvl = 1;
  if (cur && vMaxLevel(cur.p) < 1) toast("Raised squares go on Level 1. Drag over the squares that are up there.");
  const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml();
}
function vAreaPaint(d) {
  const cur = vPageNow(); if (!cur) return; vMeasDraw();
  const L = VTT.lvl || 1, x0 = Math.min(d.sx, d.ex), y0 = Math.min(d.sy, d.ey), x1 = Math.max(d.sx, d.ex), y1 = Math.max(d.sy, d.ey);
  const areas = (cur.p.areas || []).slice(), i = areas.findIndex(a => a.level === L && Array.isArray(a.cells));
  const set = new Set(i >= 0 ? areas[i].cells.map(c => c[0] + "," + c[1]) : []);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (d.rm) set.delete(x + "," + y); else set.add(x + "," + y); }
  let next = areas;
  if (d.rm) next = next.filter(a => !(a.level === L && Array.isArray(a.pts) && a.pts.every(q => q[0] >= x0 && q[0] <= x1 + 1 && q[1] >= y0 && q[1] <= y1 + 1)));
  const cells = [...set].map(k => k.split(",").map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (i >= 0) { next = next.map(a => a === areas[i] ? Object.assign({}, a, { cells }) : a).filter(a => !Array.isArray(a.cells) || a.cells.length); }
  else if (cells.length) { const a = { id: vid("a"), level: L, cells }; next = next.concat([a]); VTT.sel = { kind: "area", id: a.id }; }
  const fields = { areas: next }; if (L > (cur.p.maxLevel || 0)) fields.maxLevel = L;
  vPatch("vttpages/" + cur.id, fields);
}
function vAreaSvg(p, a, sel) {
  const C = VCELL, cls = `varea${sel ? " sel" : ""}${a.level === VTT.lvl ? " cur" : ""}${vLvlHid(a.level) ? " lvlhid" : ""}`;
  if (!Array.isArray(a.cells)) return a.pts ? `<g class="${cls}"><polygon points="${a.pts.map(q => q[0] * C + "," + q[1] * C).join(" ")}"/><text x="${a.pts[0][0] * C + 6}" y="${a.pts[0][1] * C + 18}">${esc(vLevelName(p, a.level))}</text></g>` : "";
  if (!a.cells.length) return "";
  const has = new Set(a.cells.map(c => c[0] + "," + c[1])), on = (x, y) => has.has(x + "," + y);
  let fill = "", edge = "";
  a.cells.forEach(([x, y]) => {
    fill += `M${x * C} ${y * C}h${C}v${C}h${-C}z`;
    if (!on(x, y - 1)) edge += `M${x * C} ${y * C}h${C}`;
    if (!on(x, y + 1)) edge += `M${x * C} ${(y + 1) * C}h${C}`;
    if (!on(x - 1, y)) edge += `M${x * C} ${y * C}v${C}`;
    if (!on(x + 1, y)) edge += `M${(x + 1) * C} ${y * C}v${C}`;
  });
  const f = a.cells[0];
  return `<g class="${cls} cells"><path class="afill" d="${fill}"/><path class="aedge" d="${edge}"/><text x="${f[0] * C + 6}" y="${f[1] * C + 18}">${esc(vLevelName(p, a.level))}</text></g>`;
}
function vLinkDraft(d) {
  const svg = document.getElementById("vmeas"); if (!svg) return;
  const x = Math.min(d.sx, d.ex), y = Math.min(d.sy, d.ey), w = Math.abs(d.ex - d.sx) + 1, h = Math.abs(d.ey - d.sy) + 1;
  svg.innerHTML = `<rect class="vlinkdraft${d.kind === "area" ? (d.rm ? " arearm" : " areaadd") : ""}" x="${x * VCELL}" y="${y * VCELL}" width="${w * VCELL}" height="${h * VCELL}"/>`;
}
function vLinkAdd(d) {
  const cur = vPageNow(); if (!cur) return; vMeasDraw();
  const x = Math.min(d.sx, d.ex), y = Math.min(d.sy, d.ey), w = Math.abs(d.ex - d.sx) + 1, h = Math.abs(d.ey - d.sy) + 1;
  // Stairs join the level being edited to the one it's reached from: up from the ground, down from an upper floor, up from a basement.
  const L = VTT.lvl || 0, levels = L > 0 ? [L - 1, L] : L < 0 ? [L, L + 1] : [0, 1];
  const top = Math.max(vMaxLevel(cur.p), levels[1]), l = { id: vid("k"), kind: "stairs", x, y, w, h, levels };
  VTT.sel = { kind: "link", id: l.id };
  const fields = { links: (cur.p.links || []).concat([l]) }; if (top > vMaxLevel(cur.p)) fields.maxLevel = top;
  vPatch("vttpages/" + cur.id, fields);
}
function vLinksHtml(p, gm) {
  if (!gm || !(p.links || []).length) return "";
  const C = VCELL, sel = VTT.sel && VTT.sel.kind === "link" ? VTT.sel.id : "";
  return `<svg class="vlinks${VTT.layer === "walls" ? " active" : ""}" width="${p.w * C}" height="${p.h * C}" aria-hidden="true">${(p.links || []).map(l => `<g class="${l.id === sel ? "sel" : ""}${(l.levels || [0]).every(vLvlHid) ? " lvlhid" : ""}"><rect x="${l.x * C}" y="${l.y * C}" width="${l.w * C}" height="${l.h * C}"/><text x="${l.x * C + 6}" y="${l.y * C + 20}">${l.kind === "lift" ? "🛗 Lift" : "🪜 Stairs"} · ${(l.levels || []).map(n => n ? n : "G").join(" ↔ ")}</text></g>`).join("")}</svg>`;
}
function vLinkSideHtml(p, l) {
  const lv = vLevelList(p).concat([vMaxLevel(p) + 1]);
  return `<h2>${l.kind === "lift" ? "🛗 Lift" : "🪜 Stairs"}</h2><div class="vform" data-link="${esc(l.id)}">
    <div><span class="flabel">Kind</span><div class="seg vwk">${[["stairs", "🪜 Stairs"], ["lift", "🛗 Lift / pulley"]].map(([v, t]) => `<button type="button" class="${l.kind === v ? "on" : ""}" data-act="vttlinkkind" data-v="${v}">${t}</button>`).join("")}</div></div>
    ${l.kind === "lift" ? `<div><span class="flabel">Stops at</span><div class="vlinklv">${lv.map(n => `<label class="check small"><input type="checkbox" data-lk="${n}"${(l.levels || []).includes(n) ? " checked" : ""}> ${esc(vLevelName(p, n))}</label>`).join("")}</div></div>`
      : `<div class="frow tight"><label><span>From</span><select data-lks="0">${lv.map(n => `<option value="${n}"${(l.levels || [])[0] === n ? " selected" : ""}>${esc(vLevelName(p, n))}</option>`).join("")}</select></label><label><span>To</span><select data-lks="1">${lv.map(n => `<option value="${n}"${(l.levels || [])[1] === n ? " selected" : ""}>${esc(vLevelName(p, n))}</option>`).join("")}</select></label></div>`}
    <div class="frow tight"><label><span>Width</span><input type="number" min="1" data-lkn="w" value="${l.w}"></label><label><span>Height</span><input type="number" min="1" data-lkn="h" value="${l.h}"></label></div>
    <p class="muted small">Put a picture of the stairs or lift on the map yourself; this marks the squares. A token standing here on one of these levels gets a button to move to the others. Players don't see the outline.</p>
    <div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete</button></div></div>`;
}
function vLinkSet(id, fn) { const cur = vPageNow(); if (!cur) return; let top = vMaxLevel(cur.p); const links = (cur.p.links || []).map(l => { if (l.id !== id) return l; const n = fn(Object.assign({}, l, { levels: (l.levels || []).slice() })); n.levels = [...new Set(n.levels.map(Number))]; if (n.kind === "lift") n.levels.sort((a, b) => a - b); n.levels.forEach(v => { top = Math.max(top, v); }); return n; }); const f = { links }; if (top > vMaxLevel(cur.p)) f.maxLevel = top; vPatch("vttpages/" + cur.id, f); }
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-act=vttlinkkind]"); if (!b || !vCanEdit()) return; vLinkSet(b.closest("[data-link]").dataset.link, l => Object.assign(l, { kind: b.dataset.v, levels: b.dataset.v === "stairs" ? l.levels.slice(0, 2).concat(l.levels.length < 2 ? [l.levels[0] + 1] : []) : l.levels })); });
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest("[data-link] input, [data-link] select"); if (!f || !vCanEdit()) return;
  const id = f.closest("[data-link]").dataset.link;
  if (f.dataset.lk != null) vLinkSet(id, l => { const n = Number(f.dataset.lk); l.levels = f.checked ? l.levels.concat([n]) : l.levels.filter(v => v !== n); return l; });
  else if (f.dataset.lks != null) vLinkSet(id, l => { l.levels[Number(f.dataset.lks)] = Number(f.value); return l; });
  else if (f.dataset.lkn) vLinkSet(id, l => Object.assign(l, { [f.dataset.lkn]: Math.max(1, Math.round(Number(f.value) || 1)) }));
});
// The buttons that appear next to a token standing on stairs or a lift.
// Selecting a token changes which buttons float by it (a rider's Dismount): redraw just those.
function vGoRefresh() { const cur = vPageNow(), el = document.querySelector("#vstage .vgos"); if (cur && el) el.outerHTML = vGoHtml(cur.p, vTokens(cur.id)); }
function vGoHtml(p, toks) {
  const links = p.links || [];
  const gm = vCanEdit(), C = VCELL;
  return `<div class="vgos">${toks.map(([id, t]) => {
    if (!(gm || (PLAYER && vPlayerTok(t))) || (t.layer === "gm" && !gm)) return "";
    const s = vTokSz(t), cx = t.x + s / 2, cy = t.y + s / 2, lv = vTokFloor(t);
    let btns = "";
    if (t.ship) btns = vShipGoHtml(id, t);
    else if (vIsShip(t)) btns = "";
    else if (!t.mount) { const l = links.find(k => cx >= k.x && cx <= k.x + k.w && cy >= k.y && cy <= k.y + k.h && (k.levels || []).includes(lv)), to = l ? (l.levels || []).filter(n => n !== lv) : [];
      btns += to.map(n => `<button data-tok="${esc(id)}" data-lvl="${n}" title="Move ${esc(t.name || "token")} to ${esc(vLevelName(p, n))}">${l.kind === "lift" ? "🛗" : n > lv ? "⬆" : "⬇"} ${esc(vLevelName(p, n))}</button>`).join("");
      btns += vMountCands(id, t, toks).map(([mid, m]) => { const full = vRidersOf(mid, toks).length >= vMountCap(m), fits = vCanCarry(t, m), veh = !!vVehOf(m), ico = veh ? "🛞 Board" : "🐎 Mount";
        if (full && fits) return gm ? `<button class="vgowarn" data-tok="${esc(id)}" data-mount="${esc(mid)}" title="${esc(vTokName(m))} already carries ${vMountCap(m)}; a saddle with more seats lets it carry more. You can still put ${esc(vTokName(t))} on it">${ico} ${esc(vTokName(m))} ⚠</button>` : `<span class="vgonote">${esc(vTokName(m))} has no room (${vMountCap(m)} ${veh ? "seat" : "rider"}${vMountCap(m) === 1 ? "" : "s"})</span>`;
        return fits ? `<button data-tok="${esc(id)}" data-mount="${esc(mid)}" title="${esc(vTokName(t))} climbs onto ${esc(vTokName(m))}">${ico} ${esc(vTokName(m))}</button>`
        : gm ? `<button class="vgowarn" data-tok="${esc(id)}" data-mount="${esc(mid)}" title="By the rules a mount is at least one size larger than its rider; you can still put ${esc(vTokName(t))} on it">${ico} ${esc(vTokName(m))} ⚠</button>`
        : `<span class="vgonote">${esc(vTokName(m))} is too small to carry you</span>`; }).join("");
    } else if (t.mount && VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id === id) btns = `<button data-tok="${esc(id)}" data-dismount="1" title="${esc(vTokName(t))} gets off">⤵ Dismount</button>`;
    if (!btns) return "";
    return `<div class="vgo" style="left:${(t.x + s) * C + 6}px;top:${t.y * C}px">${btns}</div>`; }).join("")}</div>`;
}
function vGoLevel(id, n) {
  const t = S.vttTokens.get(id); if (!t || !(vCanEdit() || (PLAYER && vPlayerTok(t)))) return;
  S.vttTokens.set(id, Object.assign({}, t, { lvl: n })); vDraw();
  vPatch("vtttokens/" + id, { lvl: n });
}


// ===== GM: armour class on tokens =====
function vTokAC(t) {
  const ref = t.ref || "", num = v => { const m = String(v == null ? "" : v).match(/\d+/); return m ? m[0] : ""; };
  try {
    if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)); return c && typeof cAC === "function" ? num(cAC(c)) : ""; }
    if (ref.startsWith("s:")) { const sm = vSummonOf(ref); return sm ? num((smEffectiveSb(smView(sm)) || {}).ac) : ""; }
    if (ref.startsWith("e:")) { const e = S.entries.get(t.form || ref.slice(2)) || S.entries.get(ref.slice(2)); return e && e.statblock ? num(e.statblock.ac) : ""; }
  } catch (e) {}
  return t.ac ? num(t.ac) : "";
}
function vAcBadge(t) { const ac = vTokAC(t); return ac ? `<span class="vac" title="Armour Class ${esc(ac)} (only you see this)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z"/></svg><b>${esc(ac)}</b></span>` : ""; }

// ===== Grid size from the image's file name =====
function vGridFromName(name, pw, ph) {
  const n = String(name || "").replace(/\.[a-z0-9]+$/i, "");
  let m = n.match(/(?:^|[^\d])(\d{1,3})\s*[x×]\s*(\d{1,3})(?:[^\d]|$)/i);
  if (m) { const w = +m[1], h = +m[2]; if (w >= 1 && h >= 1 && w <= 200 && h <= 200) return { w, h }; }
  m = n.match(/(\d{2,3})\s*(?:dpi|ppi|px|pps)\b/i);
  if (m) { const pp = +m[1]; if (pp >= 20 && pp <= 600) return { w: pw / pp, h: ph / pp }; }
  return null;
}

// ===== Several tokens at once: Shift-click or Shift-drag a box; copy, paste, duplicate =====
function vMultiSideHtml() {
  return `<h2>${VTT.multi.size} tokens selected</h2><p class="muted small">Drag any of them to move them together. Shift-click adds or removes one.</p>
    <div class="acts wrap"><button class="btn small" data-act="vttmulticopy">Copy (Ctrl+C)</button><button class="btn small" data-act="vttmultidup">Duplicate (Ctrl+D)</button><button class="btn ghost small" data-act="vttmultiinit">⚔ Add all to turn order</button><button class="btn ghost small danger" data-act="vttmultidel">Delete all</button></div>
    ${VTT.clip ? `<p class="muted small">${VTT.clip.length} token${VTT.clip.length === 1 ? "" : "s"} copied. Ctrl+V pastes them where your mouse is, on any map.</p>` : ""}`;
}
function vCopy() {
  // A picture (a table, a tree, a cart) can be copied too, to build a map from pieces.
  if (VTT.sel && VTT.sel.kind === "obj") { const cur = vPageNow(), o = cur && (cur.p.objs || []).find(q => q.id === VTT.sel.id); if (!o) return false; VTT.clipObj = JSON.parse(JSON.stringify(o)); VTT.clipKind = "obj"; toast("Copied the picture. Ctrl+V to paste."); return true; }
  const ids = VTT.multi.size ? [...VTT.multi] : VTT.sel && VTT.sel.kind === "tok" ? [VTT.sel.id] : [];
  const list = ids.map(id => S.vttTokens.get(id)).filter(Boolean); if (!list.length) return false;
  VTT.clip = list.map(t => { const o = JSON.parse(JSON.stringify(t)); delete o.page; delete o.mount; delete o.mountAt; delete o.mountForce; return o; }); VTT.clipKind = "tok";
  try { localStorage.setItem("vttClip", JSON.stringify(VTT.clip)); } catch (e) {}
  toast(`Copied ${list.length} token${list.length === 1 ? "" : "s"}. Ctrl+V to paste.`); return true;
}
async function vPaste(offset) {
  if (VTT.clipKind === "obj" && VTT.clipObj) {
    const cur = vPageNow(), c = VTT.clipObj; if (!cur) return;
    const at = offset ? [c.x + offset, c.y + offset] : VTT.lastPt ? [Math.round(VTT.lastPt[0] - c.w / 2), Math.round(VTT.lastPt[1] - c.h / 2)] : [c.x + 1, c.y + 1];
    const o = Object.assign({}, c, { id: vid("o"), x: Math.max(0, Math.min(cur.p.w - 0.5, at[0])), y: Math.max(0, Math.min(cur.p.h - 0.5, at[1])), level: c.layer === "map" || c.layer === "gm" ? (VTT.lvl || 0) : c.level });
    VTT.sel = { kind: "obj", id: o.id }; await vPatch("vttpages/" + cur.id, { objs: (cur.p.objs || []).concat([o]) }); vRefresh(); return;
  }
  if (!VTT.clip) { try { VTT.clip = JSON.parse(localStorage.getItem("vttClip") || "null"); } catch (e) {} }
  const cur = vPageNow(), clip = VTT.clip; if (!cur || !clip || !clip.length) return;
  const minX = Math.min(...clip.map(t => t.x)), minY = Math.min(...clip.map(t => t.y));
  let ox, oy;
  if (offset) { ox = minX + offset; oy = minY + offset; }
  else { const at = VTT.lastPt || [cur.p.w / 2, cur.p.h / 2]; ox = Math.round(at[0]); oy = Math.round(at[1]); }
  VTT.multi.clear(); VTT.sel = null;
  for (const t of clip) {
    const id = vid("t"), s = vTokSz(t), nx = Math.max(0, Math.min(cur.p.w - s, t.x - minX + ox)), ny = Math.max(0, Math.min(cur.p.h - s, t.y - minY + oy));
    const doc = Object.assign({}, t, { page: cur.id, x: nx, y: ny }); if ((doc.ref || "").startsWith("s:")) doc.ref = "";
    VTT.multi.add(id); await vSave("vtttokens/" + id, doc);
  }
  if (VTT.multi.size === 1) { VTT.sel = { kind: "tok", id: [...VTT.multi][0] }; VTT.multi.clear(); }
  vRefresh();
}
async function vMultiAction(a) {
  if (a === "vttmulticopy") vCopy();
  else if (a === "vttmultidup") { if (vCopy()) vPaste(1); }
  else if (a === "vttmultidel") vDeleteSel();
  else if (a === "vttmultiinit") { const camp = vCampId(), I = vInitOf(camp); I.list = I.list.slice(); const rolls = []; [...VTT.multi].forEach(id => { const t = S.vttTokens.get(id); if (t && !I.list.some(x => x.tok === id)) { const e = vInitEntry(id, t, true); rolls.push(e._roll); I.list.push(e); } }); VTT.initOpen = true; if (rolls.length) toast(rolls.join(" · ")); await vInitSave(camp, I); }
}
document.addEventListener("pointermove", ev => { if (!ev.target.closest || !ev.target.closest("#vview")) return; try { VTT.lastPt = vPt(ev); } catch (e) {} }, { passive: true });

// ===== Drawing: doodles anyone can add, kept until rubbed out =====
// vttdraw/<id> = { page, dev, who, col, w, pts: [[x, y], ...] } in squares.
const VPEN_COLS = ["#ff4d4d", "#ffd23c", "#4cd964", "#4da6ff", "#c77dff", "#ffffff", "#111111"];
VTT.pen = (() => { try { return Object.assign({ col: "#ff4d4d", w: 4 }, JSON.parse(localStorage.getItem("vttPen") || "{}")); } catch (e) { return { col: "#ff4d4d", w: 4 }; } })();
VTT.erase = false;
const VDEV = (() => { try { let v = localStorage.getItem("vttDev"); if (!v) { v = "v" + Math.random().toString(36).slice(2, 10); localStorage.setItem("vttDev", v); } return v; } catch (e) { return "v0"; } })();
const vSavePen = () => { try { localStorage.setItem("vttPen", JSON.stringify(VTT.pen)); } catch (e) {} };
function vPenHtml(gm) {
  return `<div class="vpen">${VPEN_COLS.map(c => `<button class="vsw${!VTT.erase && VTT.pen.col === c ? " on" : ""}" data-act="vttpencol" data-v="${c}" style="--sw:${c}" aria-label="Pen colour ${c}" aria-pressed="${!VTT.erase && VTT.pen.col === c}"></button>`).join("")}
    <span class="vpenw">${[[2, "Thin"], [4, "Medium"], [8, "Thick"]].map(([n, l]) => `<button class="vbtn${VTT.pen.w === n ? " on" : ""}" data-act="vttpenw" data-v="${n}" title="${l}" aria-label="${l}"><i style="height:${n}px"></i></button>`).join("")}</span>
    <button class="vbtn${VTT.erase ? " on" : ""}" data-act="vttpenerase" title="Rub out: click or drag over a drawing" aria-pressed="${VTT.erase}">🧽 Rub out</button>
    <button class="vbtn" data-act="vttpenmine" title="Remove all your drawings on this map">Clear mine</button>${gm ? `<button class="vbtn" data-act="vttpenall" title="Remove every drawing on this map">Clear all</button>` : ""}</div>`;
}
function vPenRefresh() { const tl = document.getElementById("vtools"); if (tl && vCanEdit()) tl.innerHTML = vToolsHtml(); const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false); }
async function vPenAction(a, el) {
  const cur = vPageNow();
  if (a === "vttpencol") { VTT.pen.col = el.dataset.v; VTT.erase = false; vSavePen(); }
  else if (a === "vttpenw") { VTT.pen.w = Number(el.dataset.v); VTT.erase = false; vSavePen(); }
  else if (a === "vttpenerase") VTT.erase = !VTT.erase;
  else if (a === "vttpenmine" || a === "vttpenall") {
    if (!cur) return; const all = a === "vttpenall" && vCanEdit();
    const ids = [...(S.vttDraw || new Map())].filter(([, d]) => d.page === cur.id && (all || d.dev === VDEV)).map(([id]) => id);
    if (!ids.length) { toast(all ? "No drawings on this map." : "You haven't drawn anything on this map."); return; }
    if (all && !confirm(`Remove all ${ids.length} drawings on this map?`)) return;
    for (const id of ids) await vDel("vttdraw/" + id);
    toast(`Removed ${ids.length} drawing${ids.length === 1 ? "" : "s"}.`);
  }
  vPenRefresh();
}
const vPathD = pts => pts.map(([x, y], i) => (i ? "L" : "M") + (x * VCELL).toFixed(1) + " " + (y * VCELL).toFixed(1)).join(" ") + (pts.length === 1 ? " l0.1 0" : "");
function vDrawingsSvg(pid) {
  return [...(S.vttDraw || new Map())].filter(([, d]) => d && d.page === pid && Array.isArray(d.pts) && d.pts.length).map(([id, d]) => `<path data-did="${esc(id)}" d="${vPathD(d.pts)}" stroke="${esc(d.col || "#ff4d4d")}" stroke-width="${Math.max(1, Math.min(20, Number(d.w) || 4))}"/>`).join("") + `<path class="vdlive" id="vdlive" d=""/>`;
}
function vDrawingsRefresh() { const svg = document.getElementById("vdrawl"), cur = vPageNow(); if (svg && cur) svg.innerHTML = vDrawingsSvg(cur.id); }
function vDrawLive(pts) { const p = document.getElementById("vdlive"); if (!p) return; p.setAttribute("d", vPathD(pts)); p.setAttribute("stroke", VTT.pen.col); p.setAttribute("stroke-width", VTT.pen.w); }
function vDrawSave(pts) {
  const cur = vPageNow(); if (!cur || !pts.length) return;
  // Thin out points that sit on a straight line, to keep drawings small.
  const out = [pts[0]]; for (let i = 1; i < pts.length - 1; i++) { const a = out[out.length - 1], b = pts[i], c = pts[i + 1], cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); if (cross > 0.0015 || Math.hypot(b[0] - a[0], b[1] - a[1]) > 1.5) out.push(b); } if (pts.length > 1) out.push(pts[pts.length - 1]);
  const id = vid("w"), doc = { page: cur.id, dev: VDEV, who: vLiveName(), col: VTT.pen.col, w: VTT.pen.w, pts: out.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]) };
  if (!S.vttDraw) S.vttDraw = new Map(); S.vttDraw.set(id, doc); vDrawingsRefresh();
  vSave("vttdraw/" + id, doc);
}
function vEraseAt(x, y) {
  const cur = vPageNow(); if (!cur) return; const r = 0.25 / Math.max(0.4, VTT.zoom);
  for (const [id, d] of S.vttDraw || new Map()) {
    if (d.page !== cur.id || !Array.isArray(d.pts)) continue;
    const hit = d.pts.some((pt, i) => i ? vSegDist(x, y, [d.pts[i - 1][0], d.pts[i - 1][1], pt[0], pt[1]]) < r : Math.hypot(x - pt[0], y - pt[1]) < r);
    if (hit) { S.vttDraw.delete(id); vDrawingsRefresh(); vDel("vttdraw/" + id); }
  }
}

// ===== Quest log =====
// camp.quests = [{ id, title, giver, status: "active" | "done" | "failed", desc, steps: [{ t, done }], hidden }]
// camp.questShow = the GM has the log open for players; camp.questShowAt changes each time it's turned on, so a player
// who closed it sees it again next time the GM turns it on.
VTT.questOpen = false; VTT.qOpenIds = new Set();
const vQuests = camp => { const c = S.vttCamps.get(camp) || {}; return Array.isArray(c.quests) ? c.quests : []; };
function vQuestPlayerHidden(c) { try { return localStorage.getItem("vttQHide:" + vCampId()) === String(c.questShowAt || ""); } catch (e) { return false; } }
function vQuestBtn() { const camp = vCampId(), c = camp && S.vttCamps.get(camp); if (!c || !c.questShow || vCanEdit()) return ""; return `<span class="vsep"></span><button class="vbtn${vQuestPlayerHidden(c) ? "" : " on"}" data-act="vttqtoggle" title="Show or hide the quest log">📜 Quests</button>`; }
function vQuestDraw() {
  const box = document.getElementById("vquests"), camp = vCampId(); if (!box || !camp) return;
  if (document.activeElement && box.contains(document.activeElement) && document.activeElement.matches("input,textarea")) return;
  const c = S.vttCamps.get(camp) || {}, gm = vCanEdit(), list = vQuests(camp);
  const show = gm ? VTT.questOpen : !!c.questShow && !vQuestPlayerHidden(c);
  box.hidden = !show; if (!show) { box.innerHTML = ""; return; }
  const act = list.filter(q => (q.status || "active") === "active"), past = list.filter(q => (q.status || "active") !== "active");
  const row = q => { const open = VTT.qOpenIds.has(q.id), steps = q.steps || [], done = steps.filter(s => s.done).length;
    return `<li class="vq ${q.status || "active"}${q.hidden ? " hid" : ""}"><button class="vqh" data-act="vttqexp" data-id="${esc(q.id)}" aria-expanded="${open}"><span class="vqi">${q.status === "done" ? "✔" : q.status === "failed" ? "✖" : "◆"}</span><span class="vqt">${esc(q.title || "Quest")}</span>${steps.length ? `<small>${done}/${steps.length}</small>` : ""}${q.hidden ? `<small title="Only you see this">🔒</small>` : ""}</button>
      ${open ? `<div class="vqb">${q.giver ? `<p class="muted small">From ${esc(q.giver)}</p>` : ""}${q.desc ? `<p class="small">${esc(q.desc).replace(/\n/g, "<br>")}</p>` : ""}
        ${steps.length ? `<ul class="vqs">${steps.map((s, i) => `<li><label class="check small"><input type="checkbox" data-act="vttqstep" data-id="${esc(q.id)}" data-i="${i}"${s.done ? " checked" : ""}${gm ? "" : " disabled"}> <span${s.done ? ' class="done"' : ""}>${esc(s.t)}</span></label></li>`).join("")}</ul>` : ""}
        ${gm ? `<div class="vqa"><button class="btn ghost small" data-act="vttqedit" data-id="${esc(q.id)}">✎ Edit</button>${(q.status || "active") === "active" ? `<button class="btn ghost small" data-act="vttqstat" data-id="${esc(q.id)}" data-v="done">✔ Done</button>` : `<button class="btn ghost small" data-act="vttqstat" data-id="${esc(q.id)}" data-v="active">↺ Reopen</button>`}</div>` : ""}</div>` : ""}</li>`; };
  box.innerHTML = `<div class="vthead"><strong>📜 Quests</strong>${gm ? `<label class="check small vqshow" title="Open the quest log on your players' screens"><input type="checkbox" data-act="vttqshow"${c.questShow ? " checked" : ""}> Players</label>` : ""}<button class="iconbtn" data-act="${gm ? "vttqopen" : "vttqtoggle"}" aria-label="Close the quest log">×</button></div>
    <ol class="vqlist">${act.map(row).join("") || `<li class="muted small vtempty">${gm ? "No quests yet." : "No quests right now."}</li>`}</ol>
    ${past.length ? `<details class="vqpast"><summary>Finished (${past.length})</summary><ol class="vqlist">${past.map(row).join("")}</ol></details>` : ""}
    ${gm ? `<div class="vtacts"><button class="btn ghost small" data-act="vttqnew">+ New quest</button></div>` : ""}`;
}
function vQuestSave(camp, quests) { return vPatch("vttcamps/" + camp, { quests }); }
function vQuestEdit(q) {
  const camp = vCampId(), isNew = !q; q = q || { id: vid("q"), title: "", giver: "", status: "active", desc: "", steps: [], hidden: false };
  openModal(`<h2>${isNew ? "New quest" : "Edit quest"}</h2><form class="vqform">
    <label><span>Title</span><input id="vq-t" type="text" value="${esc(q.title)}" placeholder="e.g. Find the missing caravan"></label>
    <label><span>Given by</span><input id="vq-g" type="text" value="${esc(q.giver || "")}" placeholder="optional"></label>
    <label><span>Details</span><textarea id="vq-d" rows="4" placeholder="What the party knows">${esc(q.desc || "")}</textarea></label>
    <label><span>Objectives <small class="muted">one a line; start a line with [x] if it's done</small></span><textarea id="vq-s" rows="4" placeholder="Speak to the innkeeper&#10;Follow the tracks north">${esc((q.steps || []).map(s => (s.done ? "[x] " : "") + s.t).join("\n"))}</textarea></label>
    <div class="frow tight"><label><span>Status</span><select id="vq-st">${[["active", "Active"], ["done", "Completed"], ["failed", "Failed"]].map(([v, l]) => `<option value="${v}"${(q.status || "active") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label class="check"><input id="vq-h" type="checkbox"${q.hidden ? " checked" : ""}> Hidden from players <small class="muted">only you see it, until you untick this</small></label>
    <div class="acts wrap"><button class="btn" type="submit">Save</button>${isNew ? "" : `<button class="btn ghost danger" type="button" id="vq-del">Delete quest</button>`}<button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div></form>`, m => {
    m.querySelector("#vq-t").focus();
    m.querySelector("form").onsubmit = ev => { ev.preventDefault();
      const nq = Object.assign({}, q, { title: m.querySelector("#vq-t").value.trim() || "Quest", giver: m.querySelector("#vq-g").value.trim(), desc: m.querySelector("#vq-d").value.trim(), status: m.querySelector("#vq-st").value, hidden: m.querySelector("#vq-h").checked,
        steps: m.querySelector("#vq-s").value.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const d = /^\[x\]\s*/i.test(l); return { t: l.replace(/^\[[ x]?\]\s*/i, ""), done: d }; }) });
      const list = vQuests(camp).slice(), i = list.findIndex(x => x.id === q.id); if (i >= 0) list[i] = nq; else list.push(nq);
      VTT.qOpenIds.add(nq.id); closeModal(); vQuestSave(camp, list); };
    const del = m.querySelector("#vq-del"); if (del) del.onclick = () => { if (!confirm("Delete this quest?")) return; closeModal(); vQuestSave(camp, vQuests(camp).filter(x => x.id !== q.id)); };
  });
}
async function vQuestAction(a, el) {
  const camp = vCampId(); if (!camp) return; const c = S.vttCamps.get(camp) || {};
  if (a === "vttqexp") { const id = el.dataset.id; if (VTT.qOpenIds.has(id)) VTT.qOpenIds.delete(id); else VTT.qOpenIds.add(id); vQuestDraw(); return; }
  if (a === "vttqtoggle") { try { const k = "vttQHide:" + camp; if (vQuestPlayerHidden(c)) localStorage.removeItem(k); else localStorage.setItem(k, String(c.questShowAt || "")); } catch (e) {} vQuestDraw(); const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false); return; }
  if (!vCanEdit()) return;
  if (a === "vttqopen") { VTT.questOpen = !VTT.questOpen; document.querySelectorAll("[data-act=vttqopen].btn").forEach(b => b.classList.toggle("on", VTT.questOpen)); vQuestDraw(); return; }
  if (a === "vttqshow") { await vPatch("vttcamps/" + camp, el.checked ? { questShow: true, questShowAt: Date.now() } : { questShow: false }); return; }
  if (a === "vttqnew") { vQuestEdit(null); return; }
  if (a === "vttqedit") { const q = vQuests(camp).find(x => x.id === el.dataset.id); if (q) vQuestEdit(q); return; }
  if (a === "vttqstat") { vQuestSave(camp, vQuests(camp).map(q => q.id === el.dataset.id ? Object.assign({}, q, { status: el.dataset.v }) : q)); return; }
  if (a === "vttqstep") { const i = Number(el.dataset.i); vQuestSave(camp, vQuests(camp).map(q => q.id === el.dataset.id ? Object.assign({}, q, { steps: (q.steps || []).map((s, k) => k === i ? Object.assign({}, s, { done: el.checked }) : s) }) : q)); return; }
}


// ===== Movement paths: corners and walls in the way =====
function vAddWaypoint(d) {
  if (!d || !d.end) return; const last = d.wps[d.wps.length - 1] || [d.t.x + vTokSz(d.t) / 2, d.t.y + vTokSz(d.t) / 2];
  const now = Date.now(); if (d.lastWp && now - d.lastWp < 250) return; d.lastWp = now;
  if (Math.hypot(d.end[0] - last[0], d.end[1] - last[1]) < 0.01) return;
  d.wps.push(d.end.slice());
}
// Where a move from a to b crosses walls that would block it at that height: closed doors count, open doors and windows don't.
function vWallHits(p, h, a, b) {
  const lvl = Math.max(0, Math.round(h || 0)), out = [], cur = vPageNow(), sw = cur && cur.p === p ? vShipWallsOn(cur.id) : [];
  (p.walls || []).concat(sw).forEach(w => {
    if ((w[4] || 0) !== lvl || vWallPassable(w)) return;
    const rx = b[0] - a[0], ry = b[1] - a[1], sx = w[2] - w[0], sy = w[3] - w[1], den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) return;
    const t = ((w[0] - a[0]) * sy - (w[1] - a[1]) * sx) / den, u = ((w[0] - a[0]) * ry - (w[1] - a[1]) * rx) / den;
    if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) out.push([a[0] + rx * t, a[1] + ry * t]);
  });
  return out;
}


// ===== Page settings, in the side panel when nothing is selected =====
function vPageSideHtml(p) {
  const cur = vPageNow(), camp = S.vttCamps.get(p.camp), n = vTokens(VTT.page).length;
  const hasMap = (p.objs || []).some(o => o.layer === "map" && !o.level);
  return `<h2>${esc(p.name || "Page")}</h2><p class="muted small">${p.w} × ${p.h} squares · ${n} token${n === 1 ? "" : "s"} · ${(p.walls || []).length} wall${(p.walls || []).length === 1 ? "" : "s"}</p>
    <div class="vform vpset" data-page="${esc(cur ? cur.id : "")}">
      <label><span>Name</span><input id="ps-name" type="text" data-ps="name" value="${esc(p.name || "")}"></label>
      <div><span class="flabel">Map image</span><div class="acts wrap"><button class="btn small" data-act="vttmapimg">🖼 ${hasMap ? "Add another map image" : "Add a map image"}</button></div>
        <p class="muted small">Goes on the Map layer, under the grid. Name the file like <em>tavern 30x40.jpg</em> or <em>cave 140dpi.png</em> and the grid is read from it.</p></div>
      <div class="frow tight"><label><span>Width</span><input type="number" min="1" max="200" data-ps="w" value="${p.w}"></label><label><span>Height</span><input type="number" min="1" max="200" data-ps="h" value="${p.h}"></label><label><span>Background</span><input type="color" data-ps="bg" value="${esc(p.bg || "#1b1f27")}"></label></div>
      <div class="vscale"><label><span>Scale everything</span><span class="vscalein"><input type="number" min="10" max="400" step="5" value="100" id="ps-k" aria-label="Scale, percent"> %</span></label><button class="btn ghost small" type="button" data-act="vttpsscale">Scale</button><span class="muted small" id="ps-kout">${p.w} × ${p.h} squares</span>
        <small class="muted">Shrinks or grows the whole map: pictures, walls, doors, raised squares, stairs, lights${p.vehicle ? ", the helm and centre of mass" : ""} and where tokens stand. Tokens keep their own size. Undo puts it back.</small></div>
      <label><span>Folder</span><select data-ps="folder"><option value="">(top level)</option>${vFolders(camp).map(f => `<option value="${esc(f.id)}"${p.folder === f.id ? " selected" : ""}>${esc(vFolderPath(camp, f.parent) + f.name)}</option>`).join("")}</select></label>
      <label class="check"><input type="checkbox" data-ps="open"${p.open ? " checked" : ""}> Players can switch to this map themselves</label>
      <label><span>Grid</span><select data-ps="gridType"><option value=""${vHexOf(p) ? "" : " selected"}>Squares</option><option value="hexflat"${p.gridType === "hexflat" ? " selected" : ""}>Hexes, flat-topped</option><option value="hexpointy"${p.gridType === "hexpointy" ? " selected" : ""}>Hexes, pointy-topped</option></select></label>
      ${vHexOf(p) ? `<label><span>Each hex is <small class="muted">miles across, for the 🧭 travel tool</small></span><input type="number" min="0.1" step="0.5" data-ps="hexMi" value="${esc(p.hexMi || "")}" placeholder="6" style="width:110px"></label>` : ""}
      <label class="check"><input type="checkbox" data-ps="grid"${p.grid !== false ? " checked" : ""}> Show the grid</label>
      <label class="check"><input type="checkbox" data-ps="snap"${p.snap !== false ? " checked" : ""}> Snap tokens to the grid <small class="muted">untick for world and region maps (Alt flips it)</small></label>
      ${vHexOf(p) ? "" : `<div><span class="flabel">Travel scale</span>${p.scale && p.scale.len ? `<p class="small">${vScaleText(p.scale)} <button class="linkbtn small" data-act="vttscaleclr">Clear</button></p>` : `<p class="muted small">None yet. Use the <strong>📐 Scale</strong> tool to drag a line and say how far a day's travel is; then anyone can plan routes with <strong>🧭 Travel</strong>.</p>`}</div>`}
      <label class="check"><input type="checkbox" data-ps="light"${p.light ? " checked" : ""}> Dynamic lighting <small class="muted">walls block what players' tokens can see</small></label>
      <label class="check"><input type="checkbox" data-ps="fogMem"${p.fogMem !== false ? " checked" : ""}> Remember explored areas</label>
      <div class="acts wrap"><button class="btn ghost small" data-act="vttpsfog">Reset explored areas</button><button class="btn ghost small" data-act="vttpswalls">Remove all walls</button><button class="btn ghost small danger" data-act="vttpsdel">Delete page</button></div>
    </div>
    <details class="vtipsd"><summary>Tips</summary>${vSideTips(p)}</details>`;
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest(".vpset [data-ps]"); if (!f || !vCanEdit()) return;
  const pid = f.closest(".vpset").dataset.page; if (!pid) return;
  const k = f.dataset.ps; let v = f.type === "checkbox" ? f.checked : f.value;
  if (k === "w" || k === "h") v = Math.max(1, Math.min(200, Math.round(Number(v) || 15)));
  if (k === "name") v = String(v).trim() || "Page";
  if (k === "hexMi") v = Math.max(0.1, Math.min(1000, Number(v) || 6));
  if (k === "gridType") { const pg = S.vttPages.get(pid) || {}, f2 = { gridType: v };
    // A hex map is a map of a region: players can open it themselves, and travel needs its miles a hex.
    if (v && !pg.gridType) { if (!pg.open) f2.open = true; if (!(Number(pg.hexMi) > 0)) f2.hexMi = 6; toast(`Now a hex map${f2.open ? ", and players can switch to it themselves" : ""}. Each hex is ${f2.hexMi || pg.hexMi} miles: change it below.`); }
    vPatch("vttpages/" + pid, f2); return; }
  vPatch("vttpages/" + pid, { [k]: v }); if (k === "w" || k === "h") VTT.fitDone = "";
});
const vScaleK = () => { const i = document.getElementById("ps-k"); return Math.max(0.1, Math.min(4, (Number(i && i.value) || 100) / 100)); };
document.addEventListener("input", ev => {
  if (!ev.target || ev.target.id !== "ps-k") return; const cur = vPageNow(), o = document.getElementById("ps-kout"); if (!cur || !o) return;
  const k = vScaleK(), p = cur.p; o.textContent = `${p.w} × ${p.h} → ${Math.max(1, Math.ceil(p.w * k - 1e-6))} × ${Math.max(1, Math.ceil(p.h * k - 1e-6))} squares`;
});
document.addEventListener("click", async ev => {
  const sb = ev.target.closest && ev.target.closest("[data-act=vttpsscale]"); if (!sb || !vCanEdit()) return;
  const cur = vPageNow(), k = vScaleK(); if (!cur || Math.abs(k - 1) < 1e-6) return;
  await vUndoStep(() => vScalePage(cur.id, k), "scaling the map"); VTT.fitDone = ""; toast(`Scaled to ${Math.round(k * 100)}%. Undo puts it back.`);
});
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act=vttpsfog],[data-act=vttpswalls],[data-act=vttpsdel]"); if (!b || !vCanEdit()) return;
  const cur = vPageNow(); if (!cur) return; const p = cur.p, a = b.dataset.act;
  if (a === "vttpsfog") { if (await confirmBox("Forget everything the players' tokens have explored on this page?", "Reset")) { VTT.fogBits = null; VTT.fogKey = ""; await vDel("vttfog/" + cur.id).catch(() => {}); vDraw(); } }
  else if (a === "vttpswalls") { if (await confirmBox(`Remove all ${(p.walls || []).length} walls from this page?`, "Remove walls")) vPatch("vttpages/" + cur.id, { walls: [] }); }
  else if (a === "vttpsdel") { if (!(await confirmBox(`Delete the page “${p.name}” and its tokens?`, "Delete page"))) return; for (const [tid] of vTokens(cur.id)) await vDel("vtttokens/" + tid); await vDel("vttfog/" + cur.id).catch(() => {}); await vDel("vttpages/" + cur.id); VTT.page = null; render(); }
});

// ===== A new map straight from an image =====
function vNewMapFromImage(camp, folder) {
  pickImage(async (res, file) => {
    const url = assetPath(res);
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = url; });
    if (!im) { toast("Couldn't read that image."); return; }
    const base = String((file && file.name) || "Map").replace(/\.[a-z0-9]+$/i, "");
    let g = vGridFromName(base, im.naturalWidth, im.naturalHeight);
    if (!g) {
      const guess = Math.max(1, Math.round(im.naturalWidth / VCELL));
      const ans = await vAsk("How big is this map?", `Squares across (it's ${im.naturalWidth} × ${im.naturalHeight} pixels)`, String(guess), "Create map"); if (!ans) return;
      const across = Math.max(1, Math.min(200, Number(ans) || guess)); g = { w: across, h: across * im.naturalHeight / im.naturalWidth };
    }
    const name = base.replace(/[_-]+/g, " ").replace(/\s*\(?\d{1,3}\s*[x×]\s*\d{1,3}\)?\s*/i, " ").replace(/\s*\d{2,3}\s*(dpi|ppi|px|pps)\b/i, " ").replace(/\s+/g, " ").trim() || "Map";
    const id = await vNewPage(camp, name, vPages(camp).length, folder);
    const W = Math.max(1, Math.ceil(g.w - 0.01)), H = Math.max(1, Math.ceil(g.h - 0.01));
    await vPatch("vttpages/" + id, { w: W, h: H, objs: [{ id: vid("o"), layer: "map", img: url, x: 0, y: 0, w: g.w, h: g.h, level: 0 }] });
    if (folder) VCLOSED.delete(folder);
    for (let i = 0; i < 40 && !S.vttPages.has(id); i++) await new Promise(r => setTimeout(r, 50));
    VTT.page = id; VTT.sel = null; VTT.fitDone = ""; render();
    toast(`New map “${name}”: ${+g.w.toFixed(1)} × ${+g.h.toFixed(1)} squares.`);
  });
}

// ===== Walls: moving an end drags every wall joined there =====
function vWallEndPreview(d) { return `<circle cx="${d.np[0] * VCELL}" cy="${d.np[1] * VCELL}" r="8" class="vwhprev"/>`; }
function vWallMoveEnd(pt, np, lvl) {
  const cur = vPageNow(); if (!cur) return; const same = (a, b) => Math.abs(a - pt[0]) < 1e-6 && Math.abs(b - pt[1]) < 1e-6;
  const walls = (cur.p.walls || []).map(w => { if ((w[4] || 0) !== lvl) return w; const n = w.slice(); if (same(w[0], w[1])) { n[0] = np[0]; n[1] = np[1]; } if (same(w[2], w[3])) { n[2] = np[0]; n[3] = np[1]; } return n; })
    .filter(w => Math.hypot(w[2] - w[0], w[3] - w[1]) > 1e-6);
  cur.p.walls = walls; vDraw(); vPatch("vttpages/" + cur.id, { walls });
}
VTT.wallSnap = (() => { try { return localStorage.getItem("vttWallSnap") !== "0"; } catch (e) { return true; } })();

// ===== Token order (which one draws on top) =====
function vTokZ(how) {
  const id = VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id, t = id && S.vttTokens.get(id), cur = vPageNow(); if (!t || !cur || !vCanEdit()) return;
  const zs = vTokens(cur.id).map(([, q]) => Number(q.z) || 0), z0 = Number(t.z) || 0;
  const z = how === "front" ? Math.max(...zs) + 1 : how === "back" ? Math.min(...zs) - 1 : how === "up" ? z0 + 1 : z0 - 1;
  S.vttTokens.set(id, Object.assign({}, t, { z })); vDraw(); vPatch("vtttokens/" + id, { z });
}

// ===== Monsters at 0 hit points: no bars, a faint red cross =====
function vDead(t) {
  if (t.owner || (t.ref || "").startsWith("c:") || (t.ref || "").startsWith("s:")) return false;
  return t.hpMax != null && t.hpMax !== "" && Number(t.hpMax) > 0 && t.hp != null && t.hp !== "" && Number(t.hp) <= 0;
}

// ===== Summons that can shapeshift: pick the form on the tabletop too =====
function vSmFormCtl(id, t, sm, cid, canEdit) {
  const e = sm.ref && S.entries.get(sm.ref);
  if (typeof isShifter !== "function" || !isShifter(e)) return "";
  const forms = ssForms(sm.ref, e), cur = sm.form || "";
  if (!canEdit) { const f = cur && S.entries.get(cur); return f ? "" : ""; }
  return `<div class="vform vformctl" data-smtok="${esc(id)}"><label><span>◈ Shapeshift form <small class="muted">the token takes on that creature's picture</small></span><select class="vsmform" data-cid="${esc(cid)}" data-sid="${esc(sm.id)}"><option value="">True form</option>${forms.map(([fid, x]) => `<option value="${esc(fid)}"${cur === fid ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label></div>`;
}
document.addEventListener("change", ev => {
  const f = ev.target.matches && ev.target.matches(".vsmform") && ev.target; if (!f) return;
  const cid = f.dataset.cid, sid = f.dataset.sid, v = f.value;
  charChange(cid, x => { x.summons = smList(x).map(q => q.id === sid ? Object.assign({}, q, { form: v || "", fhp: null }) : q); });
  setTimeout(() => { if (document.getElementById("vstage")) vRefresh(); }, 150);
});


// ===== Hex maps =====
// page.gridType: "" (squares), "hexflat" (flat sides top and bottom) or "hexpointy" (a point at the top).
// Neighbouring hexes' centres are one square apart, so everything else (walls, sizes, pictures) still counts in squares.
// page.hexMi: miles across a hex, for the travel tool. A hex map is a map of a region, so players can switch to it themselves.
const vHexOf = p => p && (p.gridType === "hexflat" || p.gridType === "hexpointy") ? { flat: p.gridType === "hexflat" } : null;
const VH = Math.sqrt(3) / 2;
function vHexCenter(p, h) { return vHexOf(p).flat ? [VH * h.q + 0.5, h.r + h.q / 2 + 0.5] : [h.q + h.r / 2 + 0.5, VH * h.r + 0.5]; }
function vHexNear(p, x, y) {
  const fl = vHexOf(p).flat, q = fl ? (x - 0.5) / VH : (x - 0.5) - ((y - 0.5) / VH) / 2, r = fl ? (y - 0.5) - ((x - 0.5) / VH) / 2 : (y - 0.5) / VH;
  let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
  const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { q: rx, r: rz };
}
const vHexDist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
const vHexSnapPt = (p, x, y) => vHexCenter(p, vHexNear(p, x, y));
// A token's top-left for its centre on the nearest hex (or square).
function vSnapTok(p, nx, ny, s) {
  if (vHexOf(p)) { const [cx, cy] = vHexSnapPt(p, nx + s / 2, ny + s / 2); return [Math.round((cx - s / 2) * 1000) / 1000, Math.round((cy - s / 2) * 1000) / 1000]; }
  return [Math.round(nx), Math.round(ny)];
}
function vHexGridSvg(p, W, H) {
  const fl = vHexOf(p).flat, C = VCELL, R = 1 / Math.sqrt(3);
  const corners = fl ? [[R, 0], [R / 2, 0.5], [-R / 2, 0.5], [-R, 0], [-R / 2, -0.5], [R / 2, -0.5]] : [[0, -R], [0.5, -R / 2], [0.5, R / 2], [0, R], [-0.5, R / 2], [-0.5, -R / 2]];
  const hex = (cx, cy) => "M" + corners.map(([a, b]) => ((cx + a) * C).toFixed(1) + " " + ((cy + b) * C).toFixed(1)).join("L") + "Z";
  const pw = fl ? 2 * VH : 1, ph = fl ? 1 : 2 * VH, centres = fl ? [[0, 0.5], [VH, 0], [VH, 1], [2 * VH, 0.5]] : [[0.5, 0], [0, VH], [1, VH], [0.5, 2 * VH]];
  return `<svg class="vgrid" width="${W}" height="${H}" aria-hidden="true"><defs><pattern id="vgh" width="${pw * C}" height="${ph * C}" patternUnits="userSpaceOnUse" patternTransform="translate(${fl ? 0.5 * C : 0},${fl ? 0 : 0.5 * C})"><path d="${centres.map(([a, b]) => hex(a, b)).join("")}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#vgh)"/><rect width="100%" height="100%" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/></svg>`;
}

// ===== Grid snapping per page =====
const vNoSnap = () => { const cur = vPageNow(); return !!(cur && cur.p && cur.p.snap === false); };

// ===== Travel: a scale for the map, and routes measured in days =====
// page.scale = { len: squares, amt, unit: "day" | "hour", mi } : a line of len squares is amt days (or hours) of travel, mi miles (optional).
// A travel day is 8 hours on the road, as in the 5e rules; slow pace is 25% slower, fast 25% quicker.
VTT.pace = "normal";
const VPACE = { slow: [0.75, "Slow"], normal: [1, "Normal"], fast: [1.25, "Fast"] };
function vScaleText(sc) { return `${+sc.len.toFixed(2)} squares = ${sc.amt} ${sc.unit === "hour" ? "hour" : "day"}${sc.amt === 1 ? "" : "s"} of travel${sc.mi ? ` (${sc.mi} miles)` : ""}`; }
function vRouteLen(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return d; }
function vFmtDays(h) {
  // h = hours on the road; show days of 8 hours, plus leftover hours.
  if (h < 8) return `${Math.max(0.1, Math.round(h * 10) / 10)} hour${Math.round(h * 10) / 10 === 1 ? "" : "s"}`;
  const d = Math.floor(h / 8), r = Math.round(h - d * 8);
  return r === 8 ? `${d + 1} days` : `${d} day${d === 1 ? "" : "s"}${r ? ` ${r} h` : ""}`;
}
document.addEventListener("change", ev => {
  const sel = ev.target.matches && ev.target.matches(".vtravelby") && ev.target; if (!sel) return;
  VTT.travelBy = sel.value; if (VTT.meas && VTT.meas.shape === "travel") { VTT.meas.by = sel.value; vMeasDraw(); vLiveMeas(true); }
  vMeasToolsRefresh();
});
// Travel works on a map with a scale, or a hex map with its miles a hex set.
const vTravelOk = p => !!(p && ((p.scale && p.scale.len) || (vHexOf(p) && Number(p.hexMi) > 0)));
// On foot: 18 / 24 / 30 miles in an 8-hour travel day at slow / normal / fast pace.
const VFOOT_MPH = { slow: 2.25, normal: 3, fast: 3.75 };
// What a route is travelled by: "" on foot, "t:<token>:<mode>" a vehicle on this map, "e:<item>:<mode>" one from the library.
function vTravelVeh(by) {
  const m = String(by || "").match(/^([te]):(.+):(ground|flight|naval)$/); if (!m) return null;
  let v = null, name = "", left = null;
  if (m[1] === "t") { const t = S.vttTokens.get(m[2]); v = t && vVehOf(t); if (!v) return null; name = t.name || "the vehicle";
    if (v.fuel.type === "refuel") { const fb = vCanEdit() ? true : vBarsFor(t).find(b => b.fuel); left = fb ? vFuelLeft(t, v) : null; } else if (v.fuel.type === "power") { const pl = vPilotOf(m[2], t), src = pl && vPowerSrc(pl[1], v); left = src ? src.have : null; } }
  else { const e = S.entries.get(m[2]); v = e && vehOf(e); if (!v) return null; name = e.title; }
  const sp = v.speeds.find(x => x.mode === m[3]); if (!sp || !(sp.travel > 0)) return null;
  return { v, name, mph: sp.travel, mode: m[3], left };
}
function vTravelVehOpts() {
  const cur = vPageNow(), out = [], seen = new Set();
  const add = (val, label, v) => v.speeds.filter(x => x.travel > 0).forEach(x => out.push([`${val}:${x.mode}`, `${label}${v.speeds.filter(y => y.travel > 0).length > 1 ? ` (${VEH_MODES[x.mode].toLowerCase()})` : ""}, ${x.travel} mph`]));
  if (cur) vTokens(cur.id).forEach(([id, t]) => { const v = vVehOf(t); if (!v || (t.layer === "gm" && !vCanEdit())) return; seen.add((t.ref || "").slice(2)); add("t:" + id, `${t.name || "Vehicle"} (on the map)`, v); });
  if (typeof isVehicle === "function") [...S.entries].filter(([id, e]) => isVehicle(e) && !seen.has(id)).sort((a, b) => byName(a[1].title, b[1].title)).forEach(([id, e]) => add("e:" + id, e.title, vehOf(e)));
  return out;
}
function vTravelLabel(pts, pace, by) {
  const cur = vPageNow(), p = cur && cur.p, hex = vHexOf(p), veh = vTravelVeh(by), foot = VFOOT_MPH[pace || "normal"] || 3;
  let steps = 0, hours = 0, miles = 0;
  if (hex) {
    const mi = Number(p.hexMi) || 0; for (let i = 1; i < pts.length; i++) steps += vHexDist(vHexNear(p, pts[i - 1][0], pts[i - 1][1]), vHexNear(p, pts[i][0], pts[i][1]));
    if (!mi) return `${steps} hex${steps === 1 ? "" : "es"} · set the miles a hex in the page settings`;
    miles = steps * mi; hours = miles / (veh ? veh.mph : foot);
  } else {
    const sc = p && p.scale; if (!sc || !sc.len) return "No travel scale on this map yet";
    const len = vRouteLen(pts), footH = len * (sc.unit === "hour" ? sc.amt : sc.amt * 8) / sc.len; // hours at normal pace
    for (let i = 1; i < pts.length; i++) steps += Math.round(Math.max(Math.abs(pts[i][0] - pts[i - 1][0]), Math.abs(pts[i][1] - pts[i - 1][1])));
    miles = sc.mi ? len * sc.mi / sc.len : 0;
    hours = veh ? (miles ? miles / veh.mph : footH * 3 / veh.mph) : footH * 3 / foot;
  }
  const mi = miles >= 10 ? Math.round(miles) : Math.round(miles * 10) / 10;
  let fuel = "";
  if (veh && veh.v.fuel.type !== "manual" && veh.v.fuel.use === "efficient" && veh.v.fuel.amt) {
    const need = Math.ceil(steps * veh.v.fuel.amt), word = veh.v.fuel.type === "power" ? veh.v.fuel.res.toLowerCase() : "fuel";
    fuel = ` · ${need} ${word}${veh.left != null ? (veh.left < need ? ` (has only ${veh.left})` : ` (has ${veh.left})`) : ""}`;
  }
  return `${vFmtDays(hours)}${veh ? ` by ${veh.name}` : pace && pace !== "normal" ? ` (${VPACE[pace][1].toLowerCase()} pace)` : ""}${hex ? ` · ${steps} hex${steps === 1 ? "" : "es"}` : ""}${mi ? ` · ${mi} mi` : ""}${fuel}`;
}
function vTravelToolsHtml(gm) {
  const cur = vPageNow(), sc = cur && cur.p.scale;
  if (VTT.tool === "align") return `<p class="muted small vlhint">Drag from one edge of something on the map to the other (a corridor, a door, a room), then say how many squares it is. Do it once across and once down to line up both ways.</p>`;
  if (VTT.tool === "travel" && vTrOn(cur && cur.p)) return `<p class="muted small vlhint">Click hexes on the map to add stops. The route planner panel shows the time.</p>`;
  if (VTT.tool === "scale") return `<p class="muted small vlhint">Drag a line over a stretch of the map, then say how much travel it is.${sc && sc.len ? `<br>Now: ${esc(vScaleText(sc))}.` : ""}</p>`;
  const paces = Object.entries(VPACE).map(([k, [, l]]) => `<button class="${(VTT.pace || "normal") === k ? "on" : ""}" data-act="vtttpace" data-v="${k}" aria-pressed="${(VTT.pace || "normal") === k}">${l}</button>`).join("");
  const opts = vTravelVehOpts(), by = VTT.travelBy || "";
  const bySel = opts.length ? `<label class="vtravelbyw"><span class="small muted">Travelling by</span><select class="vtravelby" aria-label="Travelling by"><option value="">On foot</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${v === by ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>` : "";
  return `${bySel}<div class="seg vpace${by ? " off" : ""}" role="group" aria-label="Travel pace">${paces}</div>${VTT.meas && VTT.meas.shape === "travel" ? `<button class="vbtn" data-act="vtttclear">✕ Clear route</button>` : ""}${gm ? `<p class="muted small vlhint">Click to add stops; double-click or Enter to finish. ${vHexOf(cur && cur.p) ? (Number(cur.p.hexMi) > 0 ? `Each hex is ${cur.p.hexMi} miles.` : "Set the miles a hex in the page settings.") : sc && sc.len ? esc(vScaleText(sc)) + "." : "Set a scale first with 📐."}</p>` : ""}`;
}
function vTravelClick(x, y, ev) {
  const now = Date.now(), m = VTT.meas, lc = VTT.lastTravelClick;
  VTT.lastTravelClick = { t: now, cx: ev.clientX, cy: ev.clientY };
  if (m && m.shape === "travel" && m.open && lc && now - lc.t < 400 && Math.hypot(ev.clientX - lc.cx, ev.clientY - lc.cy) < 8) { vTravelFinish(); return; }
  const cp = (vPageNow() || {}).p; if (vHexOf(cp) && !ev.altKey) [x, y] = vHexSnapPt(cp, x, y);
  if (!m || m.shape !== "travel" || !m.open) VTT.meas = { shape: "travel", pts: [[x, y]], open: true, pace: VTT.pace || "normal", by: VTT.travelBy || "" };
  else m.pts.push([x, y]);
  vMeasDraw(); vLiveMeas(true); vMeasToolsRefresh();
}
function vTravelFinish() { const m = VTT.meas; if (!m || m.shape !== "travel") return; m.open = false; m.hover = null; if (m.pts.length < 2) VTT.meas = null; vMeasDraw(); vLiveMeas(true); vMeasToolsRefresh(); }
function vScaleSet() {
  const m = VTT.meas, cur = vPageNow(); if (!m || m.shape !== "scale" || !cur) return;
  const len = Math.hypot(m.e[0] - m.s[0], m.e[1] - m.s[1]);
  if (len < 0.3) { VTT.meas = null; vMeasDraw(); toast("Drag a longer line along the map."); return; }
  const sc = cur.p.scale || {};
  openModal(`<h2>Travel scale</h2><p class="muted small">The line you drew is ${+len.toFixed(2)} squares long. How much travel is it?</p><form class="vscaleform">
    <div class="frow tight"><label><span>Amount</span><input id="vsc-a" type="number" min="0.1" step="0.1" value="${sc.amt || 1}"></label><label><span>Of</span><select id="vsc-u"><option value="day"${sc.unit !== "hour" ? " selected" : ""}>days of travel</option><option value="hour"${sc.unit === "hour" ? " selected" : ""}>hours of travel</option></select></label><label><span>Miles <small class="muted">optional</small></span><input id="vsc-m" type="number" min="0" step="1" value="${sc.mi || ""}" placeholder="e.g. 24"></label></div>
    <p class="muted small">A day is 8 hours on the road at normal pace. Slow pace takes longer, fast pace less.</p>
    <div class="acts"><button class="btn" type="submit">Save scale</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div></form>`, md => {
    md.querySelector("#vsc-a").focus(); md.querySelector("#vsc-a").select();
    md.querySelector("form").onsubmit = ev => { ev.preventDefault();
      const amt = Math.max(0.1, Number(md.querySelector("#vsc-a").value) || 1), unit = md.querySelector("#vsc-u").value, mi = Math.max(0, Number(md.querySelector("#vsc-m").value) || 0);
      closeModal(); VTT.meas = null; vMeasDraw();
      vPatch("vttpages/" + cur.id, { scale: Object.assign({ len: Math.round(len * 1000) / 1000, amt, unit }, mi ? { mi } : {}) });
      toast("Scale saved. Use 🧭 Travel to plan a route."); vSetTool("travel"); };
  });
}


// Tokens moved by someone else glide from where they were, rather than jumping.
function vSlideTokens(stage, prev) {
  if (!prev.size || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const moving = [];
  stage.querySelectorAll(".vtok").forEach(el => {
    const was = prev.get(el.dataset.tid); if (!was || !isFinite(was[0])) return;
    const nx = parseFloat(el.style.left), ny = parseFloat(el.style.top), d = Math.hypot(nx - was[0], ny - was[1]);
    if (d < 1) return;
    // Mid-slide and redrawn with the same target: carry on from where it is, without restarting the timing.
    el.style.transition = "none"; el.style.left = was[0] + "px"; el.style.top = was[1] + "px";
    moving.push([el, nx, ny, Math.min(0.7, 0.2 + d / 1500)]);
  });
  if (!moving.length) return;
  void stage.offsetWidth;
  moving.forEach(([el, nx, ny, t]) => { el.style.transition = `left ${t}s ease-out, top ${t}s ease-out`; el.style.left = nx + "px"; el.style.top = ny + "px"; });
}
