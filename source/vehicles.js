// ---------- Vehicles ----------
// A vehicle is an item whose category says how it mainly travels: "Land vehicle", "Sea vehicle" or "Air vehicle".
// e.item.vehicle = {
//   cx: "simple" (complex vehicles come later),
//   size: squares across, hull: hull points, seats: riders it carries,
//   speeds: [{ mode: "ground" | "flight" | "naval", move: feet a round, travel: miles an hour }],
//   fuel: { type: "manual" | "refuel" | "power", use: "efficient" | "inefficient", amt, cap (refuel: the tank), res (power: what the pilot pays) }
// }
// On the tabletop a vehicle is a token: riders board it like a mount, one of them is its pilot.
const VEH_CATS = ["Land vehicle", "Sea vehicle", "Air vehicle"];
const isVehicleCat = c => VEH_CATS.some(x => x.toLowerCase() === String(c || "").trim().toLowerCase());
const isVehicle = e => !!(e && e.type === "item" && e.item && isVehicleCat(e.item.category));
const VEH_MODES = { ground: "Ground", flight: "Flight", naval: "Naval" };
// Fuel types. Add a new one here: name, a line of help, and which settings it has (tank: a fuel gauge; res: paid by the pilot).
const VEH_FUELS = {
  manual: { name: "Manual", help: "Pulled by animals (or people): it needs no fuel." },
  refuel: { name: "Refuelled", help: "Burns fuel from its tank. Refill the tank by hand on the tabletop.", tank: true, uses: true },
  power: { name: "Powered", help: "Draws on its pilot: their spell points, unless you name another of their resources.", res: true, uses: true },
};
const VEH_USES = { efficient: ["Efficient", "uses its fuel for each square or hex it travels"], inefficient: ["Inefficient", "uses its fuel every round, on its pilot's turn"] };
const vehNum = (v, d, lo, hi) => { const n = Number(v); return isFinite(n) && v !== "" && v != null ? Math.max(lo, Math.min(hi, n)) : d; };
// The vehicle as it should be read, with sensible defaults for anything missing.
function vehSpec(v, cat) {
  v = v || {}; const f = v.fuel || {}, type = VEH_FUELS[f.type] ? f.type : "manual";
  const def = /sea/i.test(cat || "") ? "naval" : /air/i.test(cat || "") ? "flight" : "ground";
  let speeds = (Array.isArray(v.speeds) ? v.speeds : []).filter(s => s && VEH_MODES[s.mode]).map(s => ({ mode: s.mode, move: vehNum(s.move, 0, 0, 9999), travel: vehNum(s.travel, 0, 0, 999) }));
  if (!speeds.length) speeds = [{ mode: def, move: 30, travel: 3 }];
  return {
    cx: "simple", size: vehNum(v.size, 2, 0.5, 40), hull: vehNum(v.hull, 20, 1, 99999), seats: Math.round(vehNum(v.seats, 2, 1, 200)), speeds,
    fuel: { type, use: f.use === "inefficient" ? "inefficient" : "efficient", amt: vehNum(f.amt, 1, 0, 9999), cap: vehNum(f.cap, 20, 1, 99999), res: String(f.res || "").trim() || "Spell points" },
  };
}
const vehOf = e => isVehicle(e) ? vehSpec(e.item.vehicle, e.item.category) : null;
const vehModeOf = cat => /sea/i.test(cat || "") ? "Sea" : /air/i.test(cat || "") ? "Air" : "Land";
function vehSpeedText(v) { return v.speeds.map(s => `${VEH_MODES[s.mode]} ${s.move} ft${s.travel ? ` (${s.travel} mph)` : ""}`).join(" · "); }
function vehFuelText(v) {
  const f = v.fuel, F = VEH_FUELS[f.type];
  if (!F.uses) return F.name + " (no fuel)";
  const what = F.res ? f.res.toLowerCase() : "fuel", per = f.use === "inefficient" ? "a round" : "a square or hex";
  return `${F.name}: ${f.amt} ${what} ${per}${F.tank ? `, ${f.cap} in the tank` : ""}`;
}
// On the vehicle's own page.
function vehStatHtml(e) {
  const v = vehOf(e); if (!v) return "";
  const rows = [["Type", `${vehModeOf(e.item.category)} vehicle · simple`], ["Size", `${v.size} × ${v.size} squares`], ["Hull points", v.hull], ["Seats", v.seats], ["Speed", vehSpeedText(v)], ["Fuel", vehFuelText(v)]];
  return `<div class="istats vehstats">${rows.map(([l, x]) => `<div><span>${l}</span><strong>${esc(String(x))}</strong></div>`).join("")}</div>`;
}
// ----- In the item editor -----
function vehSpeedRow(s) {
  return `<div class="vehspd"><select data-vs="mode" aria-label="Kind of movement">${Object.entries(VEH_MODES).map(([k, l]) => `<option value="${k}"${s.mode === k ? " selected" : ""}>${l}</option>`).join("")}</select>
    <label><input type="number" data-vs="move" min="0" step="5" value="${esc(s.move)}" aria-label="Movement in feet a round"><span>ft a round</span></label>
    <label><input type="number" data-vs="travel" min="0" step="0.5" value="${esc(s.travel)}" aria-label="Travel speed in miles an hour"><span>mph travelling</span></label>
    <button type="button" class="iconbtn" data-vehact="rmspeed" aria-label="Remove this speed" title="Remove">✕</button></div>`;
}
function vehFieldsHtml(e, cat) {
  const v = vehSpec(e && e.item && e.item.vehicle, cat), f = v.fuel, on = isVehicleCat(cat);
  return `<div class="vehfields" id="it-vehicle"${on ? "" : " hidden"}>
    <div><span class="flabel">Kind of vehicle</span><div class="seg" role="group" aria-label="Simple or complex"><button type="button" class="on" aria-pressed="true">Simple</button><button type="button" disabled title="Coming later">Complex <small>(later)</small></button></div>
      <p class="muted small">A simple vehicle is one token: riders board it, one of them pilots it. Its category above says how it mainly travels.</p></div>
    <div class="frow">
      <label><span>Size <small class="muted">squares across</small></span><input id="veh-size" type="number" min="0.5" max="40" step="0.5" value="${v.size}" style="width:110px"></label>
      <label><span>Hull points</span><input id="veh-hull" type="number" min="1" step="1" value="${v.hull}" style="width:110px"></label>
      <label><span>Seats <small class="muted">riders, pilot included</small></span><input id="veh-seats" type="number" min="1" max="200" step="1" value="${v.seats}" style="width:110px"></label>
    </div>
    <div class="field"><span class="flabel">Speeds <small class="muted">movement on the battle map, and travel speed for the 🧭 travel tool</small></span>
      <div id="veh-speeds">${v.speeds.map(vehSpeedRow).join("")}</div>
      <button type="button" class="btn ghost small" data-vehact="addspeed">+ Another way it moves</button></div>
    <div class="field"><span class="flabel">Fuel</span>
      <div class="seg vehfuel" role="group" aria-label="Fuel">${Object.entries(VEH_FUELS).map(([k, F]) => `<button type="button" class="${f.type === k ? "on" : ""}" data-vehact="fuel" data-v="${k}" aria-pressed="${f.type === k}">${esc(F.name)}</button>`).join("")}</div>
      <p class="muted small" id="veh-fuelhelp">${esc(VEH_FUELS[f.type].help)}</p>
      <input type="hidden" id="veh-fuel" value="${f.type}">
      <div class="frow" id="veh-uses"${VEH_FUELS[f.type].uses ? "" : ` hidden style="display:none"`}>
        <label><span>Uses it</span><select id="veh-use">${Object.entries(VEH_USES).map(([k, [l, d]]) => `<option value="${k}"${f.use === k ? " selected" : ""}>${l}: ${d}</option>`).join("")}</select></label>
        <label><span>Amount</span><input id="veh-amt" type="number" min="0" step="1" value="${f.amt}" style="width:100px"></label>
        <label id="veh-capw"${VEH_FUELS[f.type].tank ? "" : ` hidden style="display:none"`}><span>Tank holds</span><input id="veh-cap" type="number" min="1" step="1" value="${f.cap}" style="width:100px"></label>
        <label id="veh-resw"${VEH_FUELS[f.type].res ? "" : ` hidden style="display:none"`}><span>Paid in <small class="muted">a resource on the pilot's sheet</small></span><input id="veh-res" type="text" value="${esc(f.res)}" placeholder="Spell points"></label>
      </div></div>
  </div>`;
}
function vehRead() {
  const val = id => (document.getElementById(id) || {}).value;
  const speeds = [...document.querySelectorAll("#veh-speeds .vehspd")].map(r => ({ mode: r.querySelector("[data-vs=mode]").value, move: Number(r.querySelector("[data-vs=move]").value) || 0, travel: Number(r.querySelector("[data-vs=travel]").value) || 0 }));
  const type = val("veh-fuel") || "manual", F = VEH_FUELS[type] || VEH_FUELS.manual;
  const fuel = { type };
  if (F.uses) { fuel.use = val("veh-use") === "inefficient" ? "inefficient" : "efficient"; fuel.amt = Math.max(0, Number(val("veh-amt")) || 0); }
  if (F.tank) fuel.cap = Math.max(1, Number(val("veh-cap")) || 1);
  if (F.res) fuel.res = String(val("veh-res") || "").trim() || "Spell points";
  return { cx: "simple", size: Math.max(0.5, Math.min(40, Number(val("veh-size")) || 2)), hull: Math.max(1, Math.round(Number(val("veh-hull")) || 1)), seats: Math.max(1, Math.round(Number(val("veh-seats")) || 1)), speeds, fuel };
}
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-vehact]"); if (!b) return;
  const a = b.dataset.vehact;
  if (a === "addspeed") { const box = document.getElementById("veh-speeds"), used = [...box.querySelectorAll("[data-vs=mode]")].map(s => s.value), mode = Object.keys(VEH_MODES).find(m => !used.includes(m)) || "ground"; box.insertAdjacentHTML("beforeend", vehSpeedRow({ mode, move: 30, travel: 3 })); }
  else if (a === "rmspeed") { const box = document.getElementById("veh-speeds"); if (box.querySelectorAll(".vehspd").length > 1) b.closest(".vehspd").remove(); else toast("A vehicle needs at least one way to move."); }
  else if (a === "fuel") {
    const k = b.dataset.v, F = VEH_FUELS[k]; if (!F) return;
    document.getElementById("veh-fuel").value = k;
    b.parentNode.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    document.getElementById("veh-fuelhelp").textContent = F.help;
    const show = (id, on) => { const el = document.getElementById(id); el.hidden = !on; el.style.display = on ? "" : "none"; };
    show("veh-uses", F.uses); show("veh-capw", F.tank); show("veh-resw", F.res);
  }
});
// The Vehicles tab on the Items page: land, sea and air.
function vehListHtml(vehs, q) {
  const list = vehs.filter(([, e]) => itemMatchesQ(e, q)).sort((a, b) => byName(a[1].title, b[1].title));
  if (!vehs.length) return `<div class="cards"><div class="empty"><p>No vehicles yet. Make one as an item with the category Land, Sea or Air vehicle.</p>${READONLY ? "" : `<button class="btn" data-act="new" data-type="item">Add a vehicle</button>`}</div></div>`;
  if (!list.length) return `<div class="cards"><div class="empty"><p>No vehicles match.</p></div></div>`;
  return ["Land", "Sea", "Air"].map(k => { const g = list.filter(([, e]) => vehModeOf(e.item.category) === k); return g.length ? `<h2 class="sect">${k} <span class="muted small">${g.length}</span></h2><div class="cards">${g.map(([id, e]) => entryCard(id, e)).join("")}</div>` : ""; }).join("");
}
