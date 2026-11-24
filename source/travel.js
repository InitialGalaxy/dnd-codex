// ===== Travel maps: hex maps with miles a hex. Roads, impassable hexes, a route planner and a journey day by day =====
// page.terrain = { "q,r": "road" | "block" }   (GM paints it)
// page.journey = { stops: [[q, r], …], pace, veh, party: { tokenId: "foot" | "m:<ref>" | "v:<ref>" }, mph: { <ref>: n },
//                  started, day, path: [[q, r], …], hrs: [hours per step] }   (path and hrs are frozen when travel starts)
// Refs: "t:<token>" a token on the map, "e:<entry>" a library vehicle, "s:<character>:<summon>" a character's summon.
// A route steps hex centre to hex centre. Moving from a road hex to the next road hex is 20% faster.
const VTR_ROAD = 1.2, VTR_DAY = 8;
const VTR_PACE = { slow: [0.75, "Slow"], normal: [1, "Normal"], fast: [1.25, "Fast"] };
const VTR_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const vTrOn = p => !!(p && vHexOf(p) && Number(p.hexMi) > 0);
const vTrKey = h => h[0] + "," + h[1];
const vTrJ = p => p.journey || {};

// Every hex whose centre is on the page.
function vTrHexes(p) {
  if (p._trHex && p._trHex.k === p.w + "x" + p.h + p.gridType) return p._trHex.set;
  const set = new Set(), fl = vHexOf(p).flat, n = Math.ceil(Math.max(p.w, p.h) / VH) + 4;
  for (let q = -n; q <= n * 2; q++) for (let r = -n * 2; r <= n * 2; r++) { const [x, y] = vHexCenter(p, { q, r }); if (x >= 0 && y >= 0 && x <= p.w && y <= p.h) set.add(q + "," + r); }
  Object.defineProperty(p, "_trHex", { value: { k: p.w + "x" + p.h + p.gridType, set }, enumerable: false, configurable: true });
  return set;
}
const vTrTer = (p, k) => (p.terrain || {})[k] || "";

// ----- Who's travelling, and how fast -----
const vTrNum = v => { const m = String(v || "").match(/(\d+(?:\.\d+)?)\s*ft/i) || String(v || "").match(/^\s*(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : 0; };
function vTrRefName(ref) {
  if (ref.startsWith("t:")) { const t = S.vttTokens.get(ref.slice(2)); return t ? t.name || "Token" : "?"; }
  if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)); return e ? e.title : "?"; }
  if (ref.startsWith("s:")) { const sm = typeof vSummonOf === "function" && vSummonOf(ref); return sm ? sm.name || "Summon" : "?"; }
  return "?";
}
// A mount's walking speed in mph: walking feet ÷ 10, as in 5e (30 ft is 3 mph).
function vTrWalkMph(ref) {
  let sb = null;
  if (ref.startsWith("s:")) { const sm = typeof vSummonOf === "function" && vSummonOf(ref); sb = sm && (typeof smView === "function" ? smView(sm).sb : sm.sb); }
  else if (ref.startsWith("t:")) { const t = S.vttTokens.get(ref.slice(2)), ex = t && vExSource(t); sb = ex && ex.sb; }
  else if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)); sb = e && e.statblock; }
  const ft = vTrNum(sb && sb.speed); return ft ? ft / 10 : 0;
}
function vTrVeh(ref) {
  let v = null;
  if (ref.startsWith("t:")) { const t = S.vttTokens.get(ref.slice(2)); v = t && vVehOf(t); }
  else if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)); v = e && typeof vehOf === "function" && isVehicle(e) ? vehOf(e) : null; }
  if (!v) return null; const sp = (v.speeds || []).find(x => x.mode === "ground" && x.travel > 0); return sp ? { v, mph: sp.travel, seats: Number(v.seats) || 0, complex: v.cx === "complex" } : null;
}
// The party: players' tokens on this map that aren't aboard a vehicle's deck.
const vTrMembers = cur => vTokens(cur.id).filter(([, t]) => vPlayerTok(t) && !t.ship && !vIsShip(t));
function vTrOptions(cur) {
  const mounts = [], simple = [], complex = [], seenE = new Set();
  for (const [id, t] of vTokens(cur.id)) {
    if (t.layer === "gm" && !vCanEdit()) continue;
    const ve = vVehOf(t); if (ve) { const v = vTrVeh("t:" + id); seenE.add((t.ref || "").slice(2)); if (v) (v.complex ? complex : simple).push("t:" + id); continue; }
    if (!vPlayerTok(t) && !vIsShip(t)) mounts.push("t:" + id);
  }
  for (const [, t] of vTrMembers(cur)) { const c = S.chars.get(t.owner); if (c && typeof smList === "function") smList(c).forEach(sm => { const r = `s:${t.owner}:${sm.id}`; if (!mounts.includes(r) && !mounts.some(m => m.startsWith("t:") && (S.vttTokens.get(m.slice(2)) || {}).ref === r)) mounts.push(r); }); }
  if (typeof isVehicle === "function") for (const [id, e] of S.entries) { if (!isVehicle(e) || seenE.has(id)) continue; const v = vTrVeh("e:" + id); if (v) (v.complex ? complex : simple).push("e:" + id); }
  const nm = (a, b) => byName(vTrRefName(a), vTrRefName(b));
  return { mounts: mounts.sort(nm), simple: simple.sort(nm), complex: complex.sort(nm) };
}
// The party's speed in mph (on the open road it's this; road to road, 20% more), and who sets it.
function vTrSpeed(cur) {
  const p = cur.p, j = vTrJ(p), pf = (VTR_PACE[j.pace || "normal"] || VTR_PACE.normal)[0], mph = j.mph || {}, notes = [];
  if (j.veh) { const v = vTrVeh(j.veh); if (v) return { mph: v.mph, by: `${vTrRefName(j.veh)} carries everyone`, notes, members: [] }; }
  const mem = vTrMembers(cur), seats = {}; let slow = null;
  const rows = mem.map(([id, t]) => {
    const how = (j.party || {})[id] || "foot"; let s = 3 * pf, label = "on foot", need = false;
    if (how.startsWith("m:")) { const ref = how.slice(2), m = Number(mph[ref]) || vTrWalkMph(ref); if (m > 0) s = m * pf; else need = true; label = "riding " + vTrRefName(ref); }
    else if (how.startsWith("v:")) { const ref = how.slice(2), v = vTrVeh(ref); if (v) { s = v.mph; label = "in " + vTrRefName(ref); seats[ref] = (seats[ref] || 0) + 1; } }
    const r = { id, name: t.name || "?", how, mph: s, label, need }; if (!slow || s < slow.mph) slow = r; return r;
  });
  for (const [ref, n] of Object.entries(seats)) { const v = vTrVeh(ref); if (v && v.seats && n > v.seats) notes.push(`${vTrRefName(ref)} has ${v.seats} seat${v.seats === 1 ? "" : "s"} but ${n} are riding in it.`); }
  if (mem.some(([id]) => ((j.party || {})[id] || "").startsWith("m:")) && rows.some(r => r.need)) notes.push("Give each mount without a speed its mph.");
  const sameMount = {}; rows.forEach(r => { if (r.how.startsWith("m:")) (sameMount[r.how] = sameMount[r.how] || []).push(r.name); }); Object.entries(sameMount).forEach(([k, n]) => { if (n.length > 1) notes.push(`${n.join(" and ")} are both riding ${vTrRefName(k.slice(2))}.`); });
  if (!rows.length) return { mph: 3 * pf, by: "on foot (no party tokens on this map)", notes, members: rows };
  return { mph: slow.mph, by: rows.length > 1 ? `the slowest is ${slow.name}, ${slow.label}` : `${slow.name}, ${slow.label}`, notes, members: rows };
}

// ----- The route: fewest hours, hex centre to hex centre, around impassable hexes, taking roads when they're quicker -----
function vTrStepHrs(p, a, b, mph) { const road = vTrTer(p, a) === "road" && vTrTer(p, b) === "road"; return p.hexMi / (mph * (road ? VTR_ROAD : 1)); }
function vTrPath(p, from, to, mph) {
  const all = vTrHexes(p), s = vTrKey(from), g = vTrKey(to); if (!all.has(s) || !all.has(g) || vTrTer(p, g) === "block") return null;
  const dist = new Map([[s, 0]]), prev = new Map(), heap = [[0, s]], done = new Set();
  // Among equally quick routes, keep close to the straight line from start to end (a tiny extra cost for straying from it).
  const A = vHexCenter(p, { q: from[0], r: from[1] }), B = vHexCenter(p, { q: to[0], r: to[1] }), L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
  const stray = k => { const [q, r] = k.split(",").map(Number), [x, y] = vHexCenter(p, { q, r }); return Math.abs((B[0] - A[0]) * (A[1] - y) - (A[0] - x) * (B[1] - A[1])) / L; };
  const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, k] = pop(); if (done.has(k)) continue; done.add(k); if (k === g) break;
    const [q, r] = k.split(",").map(Number);
    for (const [dq, dr] of VTR_DIRS) { const n = (q + dq) + "," + (r + dr); if (!all.has(n) || done.has(n) || vTrTer(p, n) === "block") continue;
      const nd = d + vTrStepHrs(p, k, n, mph) + 1e-6 * stray(n); if (nd < (dist.has(n) ? dist.get(n) : Infinity)) { dist.set(n, nd); prev.set(n, k); push([nd, n]); } }
  }
  if (!done.has(g)) return null;
  const out = [g]; let k = g; while (k !== s) { k = prev.get(k); out.push(k); } return out.reverse().map(x => x.split(",").map(Number));
}
// The whole plan (stops in order) at the party's speed, or the frozen one once travel has started.
function vTrPlan(cur) {
  const p = cur.p, j = vTrJ(p);
  if (j.started && Array.isArray(j.path) && Array.isArray(j.hrs)) return { path: j.path, hrs: j.hrs, ok: true };
  const stops = j.stops || []; if (stops.length < 2) return { path: stops.slice(), hrs: [], ok: stops.length > 0 };
  const sp = vTrSpeed(cur); let path = [stops[0]], broken = -1;
  for (let i = 1; i < stops.length; i++) { const seg = vTrPath(p, stops[i - 1], stops[i], sp.mph); if (!seg) { broken = i; break; } path = path.concat(seg.slice(1)); }
  const hrs = []; for (let i = 1; i < path.length; i++) hrs.push(vTrStepHrs(p, vTrKey(path[i - 1]), vTrKey(path[i]), sp.mph));
  return { path, hrs, ok: broken < 0, broken, sp };
}
// Where the party is after h hours on the road: a point partway along the route.
function vTrAt(p, plan, h) {
  const C = plan.path.map(x => vHexCenter(p, { q: x[0], r: x[1] })); if (!C.length) return null; let t = 0;
  for (let i = 0; i < plan.hrs.length; i++) { const d = plan.hrs[i]; if (t + d >= h - 1e-9) { const f = d ? (h - t) / d : 1; return { x: C[i][0] + (C[i + 1][0] - C[i][0]) * f, y: C[i][1] + (C[i + 1][1] - C[i][1]) * f, i, f }; } t += d; }
  const e = C[C.length - 1]; return { x: e[0], y: e[1], i: C.length - 1, f: 1 };
}
const vTrTotal = plan => plan.hrs.reduce((a, b) => a + b, 0);
const vTrDays = h => Math.max(1, Math.ceil(h / VTR_DAY - 1e-9));
function vTrSum(p, plan) {
  const H = vTrTotal(plan), n = plan.hrs.length; let road = 0; for (let i = 1; i < plan.path.length; i++) if (vTrTer(p, vTrKey(plan.path[i - 1])) === "road" && vTrTer(p, vTrKey(plan.path[i])) === "road") road++;
  const mi = Math.round(n * p.hexMi * 10) / 10; return { H, n, mi, road, text: `${vFmtDays(H)} · ${n} hex${n === 1 ? "" : "es"} · ${mi} mi${road ? ` · ${road} on road` : ""}` };
}

// ----- Saving the journey (players may save it too, until travel starts) -----
function vTrSave(cur, f) {
  const j = Object.assign({}, vTrJ(cur.p), f);
  const p = S.vttPages.get(cur.id); if (p) S.vttPages.set(cur.id, Object.assign({}, p, { journey: j }));
  vPatch("vttpages/" + cur.id, { journey: j }); vTrDraw(); vTrPanelRefresh();
}

// ----- Drawing: road and impassable hexes (while planning), the route, days and the party's white dot -----
function vTrHexPath(p, keys) {
  const fl = vHexOf(p).flat, C = VCELL, R = 1 / Math.sqrt(3);
  const corners = fl ? [[R, 0], [R / 2, 0.5], [-R / 2, 0.5], [-R, 0], [-R / 2, -0.5], [R / 2, -0.5]] : [[0, -R], [0.5, -R / 2], [0.5, R / 2], [0, R], [-0.5, R / 2], [-0.5, -R / 2]];
  return keys.map(k => { const [q, r] = k.split(",").map(Number), [cx, cy] = vHexCenter(p, { q, r }); return "M" + corners.map(([a, b]) => ((cx + a) * C).toFixed(1) + " " + ((cy + b) * C).toFixed(1)).join("L") + "Z"; }).join("");
}
function vTrDraw() {
  const st = document.getElementById("vstage"), cur = vPageNow(); if (!st) return;
  let el = document.getElementById("vtrl"); const p = cur && cur.p, j = p && vTrJ(p);
  const painting = p && vHexOf(p) && VTT.tool === "terrain" && vCanEdit();
  const show = painting || (p && vTrOn(p) && (VTT.tool === "travel" || (j.stops && j.stops.length) || j.started));
  if (!show) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "vtrl"; el.className = "vlayer vtrl"; const before = st.querySelector(".vgm"); if (before) st.insertBefore(el, before); else st.appendChild(el); }
  const C = VCELL, W = p.w * C, H = p.h * C, shade = painting || (VTT.tool === "travel" && !p.terrainHide);
  const ter = Object.entries(p.terrain || {}), roads = ter.filter(([, v]) => v === "road").map(([k]) => k), blocks = ter.filter(([, v]) => v === "block").map(([k]) => k);
  const plan = vTrOn(p) ? vTrPlan(cur) : { path: [], hrs: [], ok: true }, pts = plan.path.map(x => vHexCenter(p, { q: x[0], r: x[1] }).map(v => v * C)), line = a => a.map(q => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ");
  let route = "";
  if (pts.length > 1) {
    route += `<polyline class="vtrroute" points="${line(pts)}"/>`;
    const day = j.started ? Number(j.day) || 0 : 0, at = vTrAt(p, plan, day * VTR_DAY);
    if (day > 0) route += `<polyline class="vtrdone" points="${line(pts.slice(0, at.i + 1).concat([[at.x * C, at.y * C]]))}"/>`;
    if (plan.ok) { const days = vTrDays(vTrTotal(plan)); for (let d = 1; d < days; d++) { const q = vTrAt(p, plan, d * VTR_DAY); route += `<g class="vtrday${d <= day ? " past" : ""}"><circle cx="${q.x * C}" cy="${q.y * C}" r="${C * 0.16}"/><text x="${q.x * C}" y="${q.y * C - C * 0.28}">${d}</text></g>`; } }
    if (j.started) {
      route += `<circle class="vtrdot" cx="${at.x * C}" cy="${at.y * C}" r="${C * 0.24}"><title>The party: day ${Number(j.day) || 0}</title></circle>`;
    }
  }
  const stops = (j.stops || []).map((s, i, a) => { const [x, y] = vHexCenter(p, { q: s[0], r: s[1] }), lab = i === 0 ? "A" : i === a.length - 1 ? "B" : String(i); return `<g class="vtrstop${i === 0 ? " start" : i === a.length - 1 ? " end" : " via"}"><circle cx="${x * C}" cy="${y * C}" r="${C * 0.3}"/><text x="${x * C}" y="${y * C}">${lab}</text></g>`; }).join("");
  const broken = !plan.ok && plan.broken > 0 ? (() => { const s = j.stops[plan.broken], [x, y] = vHexCenter(p, { q: s[0], r: s[1] }); return `<circle class="vtrbroken" cx="${x * C}" cy="${y * C}" r="${C * 0.45}"/>`; })() : "";
  el.innerHTML = `<svg width="${W}" height="${H}" aria-hidden="true">${shade ? `<path class="vtrroad" d="${vTrHexPath(p, roads)}"/><path class="vtrblock" d="${vTrHexPath(p, blocks)}"/>` : ""}${route}${broken}${stops}</svg>`;
}

// ----- The GM's 🛣 tool: click or drag over hexes to paint roads or impassable hexes, or erase them -----
VTT.trBrush = "road";
function vTrPaintAt(cur, x, y) {
  const p = cur.p, h = vHexNear(p, x, y), k = h.q + "," + h.r; if (!vTrHexes(p).has(k)) return;
  const mode = VTT.trBrush || "road", set = new Set([k]), before = p.terrain || {};
  const paint = () => { const t = Object.assign({}, before); for (const n of set) { if (mode === "clear") delete t[n]; else t[n] = mode; } return t; };
  const preview = () => { const q = S.vttPages.get(cur.id); if (q) S.vttPages.set(cur.id, Object.assign({}, q, { terrain: paint() })); vTrDraw(); };
  preview();
  const move = e => { const [px, py] = vPt(e), n = vHexNear(p, px, py), nk = n.q + "," + n.r; if (vTrHexes(p).has(nk) && !set.has(nk)) { set.add(nk); preview(); } };
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); const terrain = paint(); const q = S.vttPages.get(cur.id); if (q) S.vttPages.set(cur.id, Object.assign({}, q, { terrain: before })); vUndoStep(() => vPatch("vttpages/" + cur.id, { terrain }), "painting hexes"); };
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
}
const vTrShadeBox = p => `<label class="check small"><input type="checkbox" data-act="vtrshade"${p.terrainHide ? "" : " checked"}> Shade roads and impassable hexes while planning <small class="muted">untick if the map picture already shows them</small></label>`;
function vTrTerrainToolsHtml() {
  const cur = vPageNow(); if (!cur || !vHexOf(cur.p)) return ""; const p = cur.p, ter = Object.values(p.terrain || {});
  return `<div class="vgroup vtrtools"><span class="vlab">Roads</span><div class="seg">${[["road", "Road"], ["block", "Impassable"], ["clear", "Erase"]].map(([v, l]) => `<button class="${VTT.trBrush === v ? "on" : ""}" data-act="vtrbrush" data-v="${v}" aria-pressed="${VTT.trBrush === v}">${l}</button>`).join("")}</div>
    <p class="muted small vlhint">Click or drag over hexes. Moving road to road is 20% faster; nobody can travel through impassable hexes (cliffs, water). ${ter.filter(v => v === "road").length} road, ${ter.filter(v => v === "block").length} impassable.</p>
    ${vTrShadeBox(p)}</div>`;
}
// ----- Clicking the map with the travel tool: add a stop -----
function vTrPointer(ev, cur, x, y) {
  const p = cur.p, h = vHexNear(p, x, y), k = h.q + "," + h.r;
  if (!vTrHexes(p).has(k)) return true;
  const j = vTrJ(p); if (j.started) { toast(vCanEdit() ? "The party is travelling. Stop travelling to change the route." : "The party is already travelling this route."); return true; }
  if (vTrTer(p, k) === "block") { toast("That hex can't be travelled through."); return true; }
  const stops = (j.stops || []).slice(), last = stops[stops.length - 1];
  if (last && last[0] === h.q && last[1] === h.r) return true;
  stops.push([h.q, h.r]); vTrSave(cur, { stops }); return true;
}

// ----- The planner, in the side panel while the travel tool is on -----
function vTrPanelRefresh() { if (VTT.tool !== "travel") return; const s = document.getElementById("vside"); if (s) s.innerHTML = vSideHtml(); }
function vTrPanelHtml(cur) {
  const p = cur.p, j = vTrJ(p), gm = vCanEdit() && !VTT.preview;
  if (!vTrOn(p)) return `<h2>Route planner</h2><p class="muted small">${vHexOf(p) ? "Set how many miles a hex is in the page settings to plan routes here." : "Routes are planned on hex maps."}</p>`;
  const plan = vTrPlan(cur), sum = plan.path.length > 1 ? vTrSum(p, plan) : null, sp = j.started ? null : vTrSpeed(cur), o = vTrOptions(cur), lock = j.started ? " disabled" : "";
  const paint = gm ? `<div class="vtrpaint">${vTrShadeBox(p)}<p class="muted small">Paint roads and impassable hexes with the 🛣 tool on the left.</p></div>` : "";
  if (j.started) {
    const days = vTrDays(vTrTotal(plan)), d = Number(j.day) || 0, at = vTrAt(p, plan, d * VTR_DAY), doneMi = Math.round(((at.i + at.f) * p.hexMi) * 10) / 10;
    return `<h2>Travelling</h2><p class="vtrbig">${d >= days ? "Arrived" : d === 0 ? "Setting off" : `Day ${d} of ${days}`}</p>
      <p class="muted small">${doneMi} of ${sum.mi} mi travelled · ${sum.text}</p>
      ${gm ? `<div class="acts"><button class="btn ghost" data-act="vtrday" data-v="-1"${d <= 0 ? " disabled" : ""}>← Previous day</button><button class="btn" data-act="vtrday" data-v="1"${d >= days ? " disabled" : ""}>Next day →</button></div>
      <button class="btn ghost small" data-act="vtrstop">Stop travelling</button>` : `<p class="muted small">The GM moves the party on each day.</p>`}${paint}`;
  }
  const sel = (id, cur) => `<select data-trhow="${esc(id)}"${lock}><option value="foot">On foot</option>${o.mounts.length ? `<optgroup label="Riding">${o.mounts.map(r => `<option value="m:${esc(r)}"${cur === "m:" + r ? " selected" : ""}>${esc(vTrRefName(r))}</option>`).join("")}</optgroup>` : ""}${o.simple.length ? `<optgroup label="In a vehicle">${o.simple.map(r => { const v = vTrVeh(r); return `<option value="v:${esc(r)}"${cur === "v:" + r ? " selected" : ""}>${esc(vTrRefName(r))} (${v.mph} mph${v.seats ? `, ${v.seats} seat${v.seats === 1 ? "" : "s"}` : ""})</option>`; }).join("")}</optgroup>` : ""}</select>`;
  const mph = j.mph || {};
  const members = !j.veh && sp.members.length ? `<div class="vtrparty">${sp.members.map(r => { const ref = r.how.startsWith("m:") ? r.how.slice(2) : "";
      return `<div class="vtrmem"><span class="vtrname">${esc(r.name)}</span>${sel(r.id, r.how)}${ref ? `<label class="vtrmph"><input type="number" min="0.5" max="200" step="0.5" data-trmph="${esc(ref)}" value="${esc(mph[ref] || vTrWalkMph(ref) || "")}" placeholder="?"${lock}> mph</label>` : ""}</div>`; }).join("")}</div>` : "";
  return `<h2>Route planner</h2>
    <p class="muted small">Click hexes on the map: the first is where you start, each next one is a stop on the way, the last is where you're going.</p>
    <div class="seg vpace" role="group" aria-label="Pace">${Object.entries(VTR_PACE).map(([k, [, l]]) => `<button class="${(j.pace || "normal") === k ? "on" : ""}" data-act="vtrpace" data-v="${k}" aria-pressed="${(j.pace || "normal") === k}">${l}</button>`).join("")}</div>
    <p class="muted small">Slow is 25% slower and fast 25% quicker, on foot and riding. Vehicles go at their own speed.</p>
    <label><span>Travelling by</span><select data-trveh><option value="">Each their own way</option>${o.complex.map(r => `<option value="${esc(r)}"${j.veh === r ? " selected" : ""}>${esc(vTrRefName(r))} (${vTrVeh(r).mph} mph, carries everyone)</option>`).join("")}</select></label>
    ${members}
    <p class="small"><strong>${Math.round(sp.mph * 100) / 100} mph</strong> <span class="muted">· ${esc(sp.by)}</span></p>
    ${sp.notes.map(n => `<p class="vtrwarn small">⚠ ${esc(n)}</p>`).join("")}
    ${sum ? `<p class="vtrbig">${esc(vFmtDays(sum.H))}</p><p class="muted small">${sum.n} hexes · ${sum.mi} mi${sum.road ? ` · ${sum.road} on road` : ""} · ${vTrDays(sum.H)} day${vTrDays(sum.H) === 1 ? "" : "s"} of ${VTR_DAY} hours</p>` : (j.stops || []).length ? `<p class="muted small">Now click where you're going.</p>` : ""}
    ${!plan.ok && plan.broken > 0 ? `<p class="vtrwarn small">⚠ There's no way through to stop ${plan.broken === j.stops.length - 1 ? "B" : plan.broken}: impassable hexes are in the way.</p>` : ""}
    <div class="acts">${(j.stops || []).length ? `<button class="btn ghost small" data-act="vtrundo">Remove the last stop</button><button class="btn ghost small" data-act="vtrclear">Clear route</button>` : ""}${gm && sum && plan.ok ? `<button class="btn" data-act="vtrstart">Start travelling</button>` : ""}</div>
    ${paint}`;
}
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-act^=vtr]"); if (!b) return;
  const cur = vPageNow(); if (!cur) return; const a = b.dataset.act, j = vTrJ(cur.p), gm = vCanEdit();
  if (a === "vtrbrush" && gm) { VTT.trBrush = b.dataset.v; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); return; }
  if (a === "vtrpace" && !j.started) return vTrSave(cur, { pace: b.dataset.v });
  if (a === "vtrundo" && !j.started) return vTrSave(cur, { stops: (j.stops || []).slice(0, -1) });
  if (a === "vtrclear" && !j.started) return vTrSave(cur, { stops: [] });
  if (a === "vtrstart" && gm) { const plan = vTrPlan(cur); if (!plan.ok || plan.path.length < 2) return; return vTrSave(cur, { started: true, day: 0, path: plan.path, hrs: plan.hrs.map(h => Math.round(h * 10000) / 10000) }); }
  if (a === "vtrday" && gm && j.started) { const days = vTrDays(vTrTotal(vTrPlan(cur))); return vTrSave(cur, { day: Math.max(0, Math.min(days, (Number(j.day) || 0) + Number(b.dataset.v))) }); }
  if (a === "vtrstop" && gm) return vTrSave(cur, { started: false, day: 0, path: null, hrs: null });
});
document.addEventListener("change", ev => {
  if (ev.target && ev.target.matches && ev.target.matches("[data-act=vtrshade]") && vCanEdit()) { const cur = vPageNow(); if (cur) vPatch("vttpages/" + cur.id, { terrainHide: !ev.target.checked }); return; }
  const el = ev.target; if (!el || !el.closest || !el.closest(".vtrpanel")) return; const cur = vPageNow(); if (!cur) return; const j = vTrJ(cur.p); if (j.started) return;
  if (el.matches("[data-trhow]")) return vTrSave(cur, { party: Object.assign({}, j.party || {}, { [el.dataset.trhow]: el.value }) });
  if (el.matches("[data-trveh]")) return vTrSave(cur, { veh: el.value });
  if (el.matches("[data-trmph]")) { const v = Number(el.value), m = Object.assign({}, j.mph || {}); if (v > 0) m[el.dataset.trmph] = Math.min(200, v); else delete m[el.dataset.trmph]; return vTrSave(cur, { mph: m }); }
});
