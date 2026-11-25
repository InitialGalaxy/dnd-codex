// ---------- Vehicles ----------
// A vehicle is an item whose category says how it mainly travels: "Land vehicle", "Sea vehicle" or "Air vehicle".
// e.item.vehicle = {
//   cx: "simple" (one token) or "complex" (its own map of decks, built in the vehicle workshop: page = that map's id),
//   turn: a complex vehicle's turning circle, in feet across (0: it turns on the spot),
//   size: squares across, hull: hull points, seats: riders it carries,
//   speeds: [{ mode: "ground" | "flight" | "naval", move: feet a round, travel: miles an hour, omni: moves any way without turning, rev: can reverse }],
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
const VEH_CX_HELP = {
  simple: "A simple vehicle is one token: riders board it, one of them pilots it. Its category above says how it mainly travels.",
  complex: "A complex vehicle has its own map of decks that travels across the battle map, with everyone aboard. Save it, then use “Build the vehicle's map” on its page.",
};
const vehNum = (v, d, lo, hi) => { const n = Number(v); return isFinite(n) && v !== "" && v != null ? Math.max(lo, Math.min(hi, n)) : d; };
// The vehicle as it should be read, with sensible defaults for anything missing.
function vehSpec(v, cat) {
  v = v || {}; const f = v.fuel || {}, type = VEH_FUELS[f.type] ? f.type : "manual";
  const def = /sea/i.test(cat || "") ? "naval" : /air/i.test(cat || "") ? "flight" : "ground";
  let speeds = (Array.isArray(v.speeds) ? v.speeds : []).filter(s => s && VEH_MODES[s.mode]).map(s => ({ mode: s.mode, move: vehNum(s.move, 0, 0, 9999), travel: vehNum(s.travel, 0, 0, 999), omni: !!s.omni, rev: !!s.rev }));
  if (!speeds.length) speeds = [{ mode: def, move: 30, travel: 3 }];
  return {
    cx: v.cx === "complex" ? "complex" : "simple", page: v.cx === "complex" && typeof v.page === "string" ? v.page : "", turn: vehNum(v.turn, 30, 0, 9999), tw: Math.round(vehNum(v.tw, 3, 1, 20)), tl: Math.round(vehNum(v.tl, 3, 1, 20)), size: vehNum(v.size, 2, 0.5, 40), hull: vehNum(v.hull, 20, 1, 99999), seats: Math.round(vehNum(v.seats, 2, 1, 200)), speeds,
    fuel: { type, use: f.use === "inefficient" ? "inefficient" : "efficient", amt: vehNum(f.amt, 1, 0, 9999), cap: vehNum(f.cap, 20, 1, 99999), res: String(f.res || "").trim() || "Spell points" },
  };
}
const vehOf = e => isVehicle(e) ? vehSpec(e.item.vehicle, e.item.category) : null;
const vehModeOf = cat => /sea/i.test(cat || "") ? "Sea" : /air/i.test(cat || "") ? "Air" : "Land";
function vehSpeedText(v) { return v.speeds.map(s => `${VEH_MODES[s.mode]} ${s.move} ft${s.travel ? ` (${s.travel} mph)` : ""}${s.omni ? ", any direction" : ""}${s.rev ? ", reverses" : ""}`).join(" · "); }
function vehFuelText(v) {
  const f = v.fuel, F = VEH_FUELS[f.type];
  if (!F.uses) return F.name + " (no fuel)";
  const what = F.res ? f.res.toLowerCase() : "fuel", per = f.use === "inefficient" ? "a round" : "a square or hex";
  return `${F.name}: ${f.amt} ${what} ${per}${F.tank ? `, ${f.cap} in the tank` : ""}`;
}
// On the vehicle's own page: the stats people look for, then the vehicle itself (each deck, with its size), its fuel in
// words, and how it turns.
const vehFt = n => `${n} square${n === 1 ? "" : "s"} (${n * 5} ft)`;
// The vehicle's shape: W squares wide and L long (front to back), its deck pictures and which way its front faces in them.
function vehShape(e, id) {
  const v = vehOf(e); if (!v) return null;
  if (v.cx !== "complex") { const n = v.size; return { w: n, l: n, img: e.token || e.image || "", decks: [] }; }
  let I = v.page && S.vttPages && S.vttPages.get(v.page);
  if (!I && S.vttTokens) for (const [, t] of S.vttTokens) if (t.ref === "e:" + id && t.int) { I = t.int; break; } // players see it through a vehicle on a map
  if (!I || !(I.w > 0)) return { w: v.tw, l: v.tl, decks: [], box: true };
  const front = ((Number(I.front) || 0) % 360 + 360) % 360, side = front === 90 || front === 270;
  const lv = [...new Set((I.objs || []).filter(o => o.img && o.layer !== "gm").map(o => Number(o.level) || 0))].sort((a, b) => b - a);
  const name = d => ((I.levelNames || {})[d]) || (d === 0 ? "Ground deck" : d > 0 ? `Deck +${d}` : `Deck ${d}`);
  const decks = lv.map(d => vehDeckMeasure(I, front, d, name(d)));
  // Overall: the biggest of any deck (or the whole map, if no deck has pictures).
  const L = decks.length ? Math.max(...decks.map(x => x.L)) : (side ? I.h : I.w), W = decks.length ? Math.max(...decks.map(x => x.W)) : (side ? I.w : I.h);
  return { w: W, l: L, pw: I.w, ph: I.h, front, decks };
}
// One deck's squares that are really the vehicle: under its pictures and not marked "not the vehicle" in the workshop. Turned
// so the front points right (length across, width down). Its length is its longest row, its width its longest column.
function vehDeckMeasure(I, front, d, name) {
  const pics = (I.objs || []).filter(o => o.img && o.layer !== "gm" && (Number(o.level) || 0) === d), off = new Set(((I.off || {})[d]) || []);
  const pw = I.w, ph = I.h, side = front === 90 || front === 270, DL = side ? ph : pw, DW = side ? pw : ph;
  const toD = (x, y) => front === 90 ? [y, pw - 1 - x] : front === 180 ? [pw - 1 - x, ph - 1 - y] : front === 270 ? [ph - 1 - y, x] : [x, y];
  const cells = new Set();
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { if (off.has(x + "," + y)) continue; const cx = x + 0.5, cy = y + 0.5; if (!pics.some(o => cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h)) continue; const [a, b] = toD(x, y); cells.add(a + "," + b); }
  let row = null, col = null, bx0 = DL, bx1 = -1, by0 = DW, by1 = -1;
  for (let b = 0; b < DW; b++) { let a0 = -1, a1 = -1; for (let a = 0; a < DL; a++) if (cells.has(a + "," + b)) { if (a0 < 0) a0 = a; a1 = a; } if (a0 >= 0) { if (!row || a1 - a0 > row.a1 - row.a0) row = { b, a0, a1 }; bx0 = Math.min(bx0, a0); bx1 = Math.max(bx1, a1); by0 = Math.min(by0, b); by1 = Math.max(by1, b); } }
  for (let a = 0; a < DL; a++) { let b0 = -1, b1 = -1; for (let b = 0; b < DW; b++) if (cells.has(a + "," + b)) { if (b0 < 0) b0 = b; b1 = b; } if (b0 >= 0 && (!col || b1 - b0 > col.b1 - col.b0)) col = { a, b0, b1 }; }
  if (!row) return { d, name, pics, cells, L: 0, W: 0, row: null, col: null, box: [0, 0, DL - 1, DW - 1], DL, DW };
  return { d, name, pics, cells, L: row.a1 - row.a0 + 1, W: col.b1 - col.b0 + 1, row, col, box: [bx0, by0, bx1, by1], DL, DW };
}
// The pictures of one deck, drawn in a frame where the vehicle's front points the way of angle `face` (degrees, 0 right, -90 up),
// scaled k pixels a square, centred on (0, 0).
function vehArt(sh, pics, face) {
  const rot = face - sh.front;
  return `<g transform="rotate(${rot}) translate(${-sh.pw / 2} ${-sh.ph / 2})">${pics.map(o => `<image href="${esc(o.img)}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" preserveAspectRatio="none"${o.rot ? ` transform="rotate(${o.rot} ${o.x + o.w / 2} ${o.y + o.h / 2})"` : ""}/>`).join("")}</g>`;
}
// One deck (or the box, or a simple vehicle's token) lying long side across the top, with arrows for its length and width.
function vehDeckSvg(sh, deck) {
  const arrowDefs = `<defs><marker id="vehah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z"/></marker></defs>`;
  const arrow = (xa, ya, xb, yb, lab, vert) => `<g class="vehdim"><line x1="${xa}" y1="${ya}" x2="${xb}" y2="${yb}" marker-start="url(#vehah)" marker-end="url(#vehah)"/><text ${vert ? `transform="translate(${xa - 6} ${(ya + yb) / 2}) rotate(-90)" x="0" y="0"` : `x="${(xa + xb) / 2}" y="${ya - 6}"`}>${lab}</text></g>`;
  const pad = 34;
  if (deck && deck.row) { // a deck: just its own squares, measured along its longest row and column
    const [bx0, by0, bx1, by1] = deck.box, BL = bx1 - bx0 + 1, BW = by1 - by0 + 1, k = Math.max(8, Math.min(34, 280 / Math.max(BL, BW * 1.4)));
    const VW = BL * k + pad + 12, VH = BW * k + pad + 12, X = a => pad + (a - bx0) * k, Y = b => pad + (b - by0) * k;
    let grid = ""; deck.cells.forEach(c => { const [a, b] = c.split(",").map(Number); grid += `M${X(a)} ${Y(b)}h${k}v${k}h${-k}z`; });
    const cx = pad + (deck.DL / 2 - bx0) * k, cy = pad + (deck.DW / 2 - by0) * k, cid = "vehclip" + Math.random().toString(36).slice(2, 8);
    return `<svg class="vehdeck" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}" role="img" aria-label="${esc(deck.name)}, ${deck.L} by ${deck.W} squares">${arrowDefs}
      <clipPath id="${cid}"><rect x="${pad}" y="${pad}" width="${BL * k}" height="${BW * k}"/></clipPath>
      <g clip-path="url(#${cid})"><g transform="translate(${cx} ${cy}) scale(${k})">${vehArt(sh, deck.pics, 0)}</g></g>
      <path class="vehcells" d="${grid}"/>
      ${arrow(X(deck.row.a0), 18, X(deck.row.a1 + 1), 18, `${deck.L} long`, false)}${arrow(18, Y(deck.col.b0), 18, Y(deck.col.b1 + 1), `${deck.W} wide`, true)}</svg>`;
  }
  const L = sh.l, Wd = sh.w, k = Math.max(8, Math.min(34, 280 / Math.max(L, Wd * 1.4))), VW = L * k + pad + 12, VH = Wd * k + pad + 12, x0 = pad, y0 = pad;
  let grid = ""; for (let i = 1; i < L; i++) grid += `<line x1="${x0 + i * k}" y1="${y0}" x2="${x0 + i * k}" y2="${y0 + Wd * k}"/>`; for (let j = 1; j < Wd; j++) grid += `<line x1="${x0}" y1="${y0 + j * k}" x2="${x0 + L * k}" y2="${y0 + j * k}"/>`;
  const body = sh.img ? `<image href="${esc(sh.img)}" x="${x0}" y="${y0}" width="${L * k}" height="${Wd * k}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect class="vehbox" x="${x0}" y="${y0}" width="${L * k}" height="${Wd * k}"/><polygon class="vehbox" points="${x0 + L * k + Math.min(14, k * 0.7)},${y0 + Wd * k / 2} ${x0 + L * k},${y0 + Wd * k / 2 - Math.min(10, k * 0.5)} ${x0 + L * k},${y0 + Wd * k / 2 + Math.min(10, k * 0.5)}"/>`;
  return `<svg class="vehdeck" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}" role="img" aria-label="The vehicle, ${L} by ${Wd} squares">${arrowDefs}
    ${body}<g class="vehgrid">${grid}<rect x="${x0}" y="${y0}" width="${L * k}" height="${Wd * k}" fill="none"/></g>
    ${arrow(x0, 18, x0 + L * k, 18, `${L} long`, false)}${arrow(18, y0, 18, y0 + Wd * k, `${Wd} wide`, true)}</svg>`;
}
function vehFuelHtml(v) {
  const f = v.fuel, F = VEH_FUELS[f.type], what = F.res ? f.res : "fuel", amt = `${f.amt} ${F.res ? what.toLowerCase() : "fuel"}`;
  let say = F.help;
  if (f.type === "refuel") say = `It burns fuel from a tank that holds ${f.cap}. ${f.use === "inefficient" ? `It uses ${amt} every round, on its pilot's turn, whether it moves or not` : `It uses ${amt} for every square or hex it moves`}, so a full tank lasts ${f.amt ? `about ${Math.floor(f.cap / f.amt)} ${f.use === "inefficient" ? "rounds" : "squares or hexes"}` : "for ever"}. Refill it by hand on the tabletop.`;
  if (f.type === "power") say = `It runs on whoever pilots it: ${f.use === "inefficient" ? `it draws ${amt} from them every round, on their turn, whether it moves or not` : `it draws ${amt} from them for every square or hex it moves`}. When the pilot has none left, it stops.`;
  return `<h3>Fuel</h3><p><strong>${esc(F.name)}${F.uses ? ` · ${esc(VEH_USES[f.use][0])}` : ""}.</strong> ${esc(say)}</p>`;
}
function vehStatHtml(e) {
  const v = vehOf(e); if (!v) return "";
  const cx = v.cx === "complex", idp = [...S.entries].find(([, x]) => x === e), id = idp && idp[0], sh = vehShape(e, id), cost = typeof costText === "function" ? costText((e.item || {}).stats) : "";
  const stats = [["Hull points", esc(String(v.hull))], ["Cost", cost ? esc(cost) : "—"], ...(cx ? [] : [["Seats", esc(String(v.seats))]]), ["Speed", v.speeds.map(s => `${esc(VEH_MODES[s.mode])} ${s.move} ft${s.travel ? ` · ${s.travel} mph` : ""}${s.omni ? " · any direction" : ""}${s.rev ? " · reverses" : ""}`).join("<br>")]];
  const decks = sh.decks && sh.decks.length ? sh.decks.filter(d => d.row).map(d => `<figure>${vehDeckSvg(sh, d)}<figcaption>${esc(d.name)} · ${d.L} × ${d.W}</figcaption></figure>`).join("") : `<figure>${vehDeckSvg(sh, null)}${sh.box ? `<figcaption>No map yet: the shape set for the turning circle</figcaption>` : ""}</figure>`;
  // Seen from above: every deck stacked, the lowest first.
  const top = sh.decks && sh.decks.length ? { pics: sh.decks.slice().reverse().flatMap(d => d.pics) } : null;
  return `<div class="istats vehstats">${stats.map(([l, x]) => `<div><span>${l}</span><strong>${x}</strong></div>`).join("")}</div>
    <div class="vehsect"><h3>The vehicle</h3><p class="vehsize">${esc(vehFt(sh.l))} long, ${esc(vehFt(sh.w))} wide${sh.decks && sh.decks.length > 1 ? ` · ${sh.decks.length} decks` : ""}</p>
      <div class="vehdecks">${decks}</div>
    <div class="vehsect">${vehFuelHtml(v)}</div>
    ${cx ? `<div class="vehsect"><h3>Turning circle</h3><p>${v.turn ? `${v.turn} ft across.` : "It turns on the spot."}</p><div class="vehturnviz">${vehTurnSvg(v.turn, sh.w, sh.l, top ? { sh, pics: top.pics } : null)}</div></div>` : ""}`;
}
// ----- In the item editor -----
function vehSpeedRow(s) {
  return `<div class="vehspd"><select data-vs="mode" aria-label="Kind of movement">${Object.entries(VEH_MODES).map(([k, l]) => `<option value="${k}"${s.mode === k ? " selected" : ""}>${l}</option>`).join("")}</select>
    <label><input type="number" data-vs="move" min="0" step="5" value="${esc(s.move)}" aria-label="Movement in feet a round"><span>ft a round</span></label>
    <label><input type="number" data-vs="travel" min="0" step="0.5" value="${esc(s.travel)}" aria-label="Travel speed in miles an hour"><span>mph travelling</span></label>
    <label class="check inline"><input type="checkbox" data-vs="omni"${s.omni ? " checked" : ""}> Any direction <small class="muted">moves without turning</small></label>
    <label class="check inline"><input type="checkbox" data-vs="rev"${s.rev ? " checked" : ""}> Reverses</label>
    <button type="button" class="iconbtn" data-vehact="rmspeed" aria-label="Remove this speed" title="Remove">✕</button></div>`;
}
function vehFieldsHtml(e, cat) {
  const v = vehSpec(e && e.item && e.item.vehicle, cat), f = v.fuel, on = isVehicleCat(cat);
  return `<div class="vehfields" id="it-vehicle"${on ? "" : " hidden"}>
    <div><span class="flabel">Kind of vehicle</span><input type="hidden" id="veh-cx" value="${v.cx}"><input type="hidden" id="veh-page" value="${esc(v.page)}">
      <div class="seg" role="group" aria-label="Simple or complex"><button type="button" class="${v.cx === "simple" ? "on" : ""}" data-vehact="cx" data-v="simple" aria-pressed="${v.cx === "simple"}">Simple</button><button type="button" class="${v.cx === "complex" ? "on" : ""}" data-vehact="cx" data-v="complex" aria-pressed="${v.cx === "complex"}">Complex</button></div>
      <p class="muted small" id="veh-cxhelp">${v.cx === "complex" ? VEH_CX_HELP.complex : VEH_CX_HELP.simple}</p></div>
    <div class="frow">
      <label class="vehsimple"${v.cx === "complex" ? ` style="display:none"` : ""}><span>Size <small class="muted">squares across</small></span><input id="veh-size" type="number" min="0.5" max="40" step="0.5" value="${v.size}" style="width:110px"></label>
      <label><span>Hull points</span><input id="veh-hull" type="number" min="1" step="1" value="${v.hull}" style="width:110px"></label>
      <label class="vehsimple"${v.cx === "complex" ? ` style="display:none"` : ""}><span>Seats <small class="muted">riders, pilot included</small></span><input id="veh-seats" type="number" min="1" max="200" step="1" value="${v.seats}" style="width:110px"></label>
      <label class="vehcomplex"${v.cx === "complex" ? "" : ` style="display:none"`}><span>Turning circle <small class="muted">feet across; 0 turns on the spot</small></span><span class="vehturnrow"><input id="veh-turn" type="number" min="0" step="5" value="${v.turn}" style="width:110px"><button class="btn ghost small" type="button" data-vehact="autoturn" title="Pick a turning circle that suits the shape below: about as wide as the vehicle is long, ending squarely on the grid">Auto</button></span></label>
    </div>
    <div class="vehcomplex vehmapbtn"${v.cx === "complex" ? "" : ` style="display:none"`}><button type="button" class="btn" data-vehact="map">⛵ ${v.page ? "Save, then edit the vehicle's map" : "Save, then build the vehicle's map"}</button>
      <span class="muted small">Its decks, pictures, walls, stairs, helm and centre of mass, in the vehicle workshop.</span></div>
    <div class="vehcomplex vehturnbox"${v.cx === "complex" ? "" : ` style="display:none"`}>
      <div class="vehturnsize"><span class="small muted">Shape in the diagram</span><label><span class="small">Width</span><input id="veh-tw" type="number" min="1" max="20" step="1" value="${v.tw}"></label><span class="muted">×</span><label><span class="small">Length</span><input id="veh-tl" type="number" min="1" max="20" step="1" value="${v.tl}"></label><span class="small muted">squares, front to back</span></div>
      <div class="vehturnviz" id="veh-turnviz">${vehTurnSvg(v.turn, v.tw, v.tl)}</div></div>
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
// A picture of a 3 × 3 square vehicle making a quarter turn to the right with this turning circle (feet across), on a 5 ft grid.
// Its centre of mass is the middle of its middle square; like a ship on the tabletop, it comes to rest with that centre on the
// middle of a square (so here the squares' middles are at whole numbers, and grid lines at the halves).
// A turning circle that suits a W × L vehicle: a radius of at least its length, and one that brings it to rest exactly on the
// grid (no nudge at the end of the turn). Feet across: radius in squares × 10.
function vehAutoTurn(tw, tl) {
  const Wd = Math.max(1, Math.round(Number(tw) || 3)), Ln = Math.max(1, Math.round(Number(tl) || 3)), off = n => n % 2 ? 0 : 0.5;
  const frac = ((off(Ln) - off(Wd)) % 1 + 1) % 1; let R = Math.floor(Ln) + frac; if (R < Ln) R += 1;
  return Math.round(R * 10);
}
// The turning circle drawn for a W × L vehicle (W squares wide, L long, front to back), its centre of mass in its middle.
// It starts facing up, turns right through a quarter circle and comes to rest lined up with the grid.
function vehTurnSvg(ft, tw, tl, art) {
  ft = Math.max(0, Number(ft) || 0); const Wd = Math.max(1, Math.min(20, Math.round(Number(tw) || 3))), Ln = Math.max(1, Math.min(20, Math.round(Number(tl) || 3)));
  const R = ft / 10, W = 300, H = 230; // radius in squares
  // Squares have their middles on whole numbers. An even side puts the centre on a grid line, an odd one on a square's middle.
  const off = n => n % 2 ? 0 : 0.5, snap = (v, n) => Math.round(v - off(n)) + off(n);
  const sx = off(Wd), sy = off(Ln), ex = snap(sx + R, Ln), ey = snap(sy - R, Wd), big = Math.max(Wd, Ln) / 2 + 1.2;
  const x0 = sx - big, x1 = Math.max(sx + R, ex) + big, y0 = Math.min(sy - R, ey) - big, y1 = sy + big, k = Math.min(W / (x1 - x0), H / (y1 - y0)), ox = (W - (x1 - x0) * k) / 2 - x0 * k, oy = (H - (y1 - y0) * k) / 2 - y0 * k;
  const X = x => (ox + x * k).toFixed(1), Y = y => (oy + y * k).toFixed(1);
  let grid = ""; for (let gx = Math.ceil(x0 - 0.5) + 0.5; gx <= x1; gx++) grid += `<line x1="${X(gx)}" y1="${Y(y0)}" x2="${X(gx)}" y2="${Y(y1)}"/>`; for (let gy = Math.ceil(y0 - 0.5) + 0.5; gy <= y1; gy++) grid += `<line x1="${X(x0)}" y1="${Y(gy)}" x2="${X(x1)}" y2="${Y(gy)}"/>`;
  // The vehicle with its centre at (cx, cy), turned a (radians) from facing up towards facing right; the dot is its centre of mass.
  const box = (cx, cy, a, cls) => { const c = Math.cos(a), s2 = Math.sin(a), pt = (u, v) => `${X(cx + u * c - v * s2)},${Y(cy + u * s2 + v * c)}`, hw = Wd / 2, hl = Ln / 2, nose = Math.min(0.8, Ln * 0.3), nw = Math.min(0.7, hw * 0.6);
    const pic = art ? `<g class="${cls.replace("veh", "vehpic")}" transform="translate(${X(cx)} ${Y(cy)}) rotate(${a * 180 / Math.PI}) scale(${k})">${vehArt(art.sh, art.pics, -90)}</g>` : "";
    return `${pic}<polygon class="${cls}${art ? " art" : ""}" points="${[[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([u, v]) => pt(u, v)).join(" ")}"/><polygon class="${cls} nose" points="${pt(0, -hl - nose)} ${pt(-nw, -hl)} ${pt(nw, -hl)}"/><circle class="com" cx="${X(cx)}" cy="${Y(cy)}" r="${Math.max(2.5, 0.18 * k).toFixed(1)}"/>`; };
  const onArc = a => R ? [sx + R - R * Math.cos(a), sy - R * Math.sin(a)] : [sx, sy];
  const arc = R ? `<circle class="ring" cx="${X(sx + R)}" cy="${Y(sy)}" r="${(R * k).toFixed(1)}"/><path class="path" d="M${X(sx)},${Y(sy)} A${(R * k).toFixed(1)},${(R * k).toFixed(1)} 0 0 1 ${X(sx + R)},${Y(sy - R)}${ex !== sx + R || ey !== sy - R ? ` L${X(ex)},${Y(ey)}` : ""}"/><circle class="hub" cx="${X(sx + R)}" cy="${Y(sy)}" r="2.5"/>` : "";
  const mid = onArc(Math.PI / 4), dist = Math.round(Math.PI * R / 2 * 5);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="A ${Wd} by ${Ln} square vehicle turning right with a ${ft} foot turning circle"><g class="grid">${grid}</g>${arc}${box(sx, sy, 0, "veh")}${R ? box(mid[0], mid[1], Math.PI / 4, "veh mid") : box(sx, sy, Math.PI / 4, "veh mid")}${box(ex, ey, Math.PI / 2, "veh end")}</svg>
    <p class="muted small">${R ? `A ${Wd} × ${Ln} vehicle turns a quarter circle in about ${dist} ft (grid squares are 5 ft), coming to rest lined up with the grid. The dot is its centre of mass, always in its middle.` : "It turns on the spot."}</p>`;
}
document.addEventListener("input", ev => { if (ev.target && ["veh-turn", "veh-tw", "veh-tl"].includes(ev.target.id)) { const box = document.getElementById("veh-turnviz"), v = id => (document.getElementById(id) || {}).value; if (box) box.innerHTML = vehTurnSvg(v("veh-turn"), v("veh-tw"), v("veh-tl")); } });
function vehRead() {
  const val = id => (document.getElementById(id) || {}).value;
  const speeds = [...document.querySelectorAll("#veh-speeds .vehspd")].map(r => ({ mode: r.querySelector("[data-vs=mode]").value, move: Number(r.querySelector("[data-vs=move]").value) || 0, travel: Number(r.querySelector("[data-vs=travel]").value) || 0, omni: r.querySelector("[data-vs=omni]").checked, rev: r.querySelector("[data-vs=rev]").checked }));
  const type = val("veh-fuel") || "manual", F = VEH_FUELS[type] || VEH_FUELS.manual;
  const fuel = { type };
  if (F.uses) { fuel.use = val("veh-use") === "inefficient" ? "inefficient" : "efficient"; fuel.amt = Math.max(0, Number(val("veh-amt")) || 0); }
  if (F.tank) fuel.cap = Math.max(1, Number(val("veh-cap")) || 1);
  if (F.res) fuel.res = String(val("veh-res") || "").trim() || "Spell points";
  const cx = val("veh-cx") === "complex" ? "complex" : "simple";
  return { cx, page: cx === "complex" ? (val("veh-page") || "") : "", turn: Math.max(0, Number(val("veh-turn")) || 0), tw: Math.max(1, Math.min(20, Math.round(Number(val("veh-tw")) || 3))), tl: Math.max(1, Math.min(20, Math.round(Number(val("veh-tl")) || 3))), size: Math.max(0.5, Math.min(40, Number(val("veh-size")) || 2)), hull: Math.max(1, Math.round(Number(val("veh-hull")) || 1)), seats: Math.max(1, Math.round(Number(val("veh-seats")) || 1)), speeds, fuel };
}
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-vehact]"); if (!b) return;
  const a = b.dataset.vehact;
  if (a === "addspeed") { const box = document.getElementById("veh-speeds"), used = [...box.querySelectorAll("[data-vs=mode]")].map(s => s.value), mode = Object.keys(VEH_MODES).find(m => !used.includes(m)) || "ground"; box.insertAdjacentHTML("beforeend", vehSpeedRow({ mode, move: 30, travel: 3 })); }
  else if (a === "map") { // save the entry, then open its map in the vehicle workshop
    const form = b.closest("form[data-form=entry]"); if (!form || typeof saveEntry !== "function") return;
    if (!form.dataset.id) form.dataset.id = newId(); const id = form.dataset.id;
    b.disabled = true; Promise.resolve(saveEntry(form)).then(() => { b.disabled = false; if (S.entries.get(id) && !document.querySelector("form[data-form=entry]")) vOpenWorkshop(id); }).catch(() => { b.disabled = false; });
  }
  else if (a === "autoturn") { const v = id => (document.getElementById(id) || {}).value, t = document.getElementById("veh-turn"); if (t) { t.value = vehAutoTurn(v("veh-tw"), v("veh-tl")); t.dispatchEvent(new Event("input", { bubbles: true })); } }
  else if (a === "rmspeed") { const box = document.getElementById("veh-speeds"); if (box.querySelectorAll(".vehspd").length > 1) b.closest(".vehspd").remove(); else toast("A vehicle needs at least one way to move."); }
  else if (a === "cx") {
    const k = b.dataset.v === "complex" ? "complex" : "simple"; document.getElementById("veh-cx").value = k;
    b.parentNode.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    document.getElementById("veh-cxhelp").textContent = VEH_CX_HELP[k];
    document.querySelectorAll(".vehsimple").forEach(x => { x.style.display = k === "simple" ? "" : "none"; });
    document.querySelectorAll(".vehcomplex").forEach(x => { x.style.display = k === "complex" ? "" : "none"; });
  }
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
