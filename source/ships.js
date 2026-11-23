// ===== Complex vehicles ("ships"): a vehicle with its own map of decks that travels across the battle map =====
// Its map is a page in the hidden Vehicle workshop campaign (vttcamps/workshop), one page per vehicle (page.vehicle = the
// item's id), built with the usual map tools plus the helm (page.helm = [[x, y, deck]]), its centre of mass (page.com = [x, y],
// what it turns around) and which way its front faces on that map (page.front, degrees: 0 right, 90 down, 180 left, 270 up).
// On a battle map the vehicle is a token: x, y = where its centre of mass is, rot = how far it's turned (degrees clockwise),
// int = a copy of its map, decks = { deck: map level } where each deck sits among the map's levels (by default the same).
// Someone aboard has ship = the vehicle's token, sx / sy = their spot on its grid, deck = the deck they're on. Their x / y / lvl
// on the battle map are worked out from the ship on every draw, so they stay put on deck however the ship moves or turns.
const VWS = "workshop";
const vIsShip = t => !!(t && t.int && typeof t.int === "object" && t.int.w > 0);
// The ship's map, copied from its workshop page (players get this copy with the token; GM-only pictures are left out for them).
function vShipIntOf(p) {
  if (!p) return null;
  const pick = (k, d) => p[k] == null ? d : JSON.parse(JSON.stringify(p[k]));
  return { w: p.w, h: p.h, objs: pick("objs", []), walls: pick("walls", []), links: pick("links", []), lights: pick("lights", []), helm: pick("helm", []),
    com: Array.isArray(p.com) ? p.com.slice(0, 2) : [p.w / 2, p.h / 2], front: Number(p.front) || 0, levelNames: pick("levelNames", {}),
    minLevel: Number(p.minLevel) || 0, maxLevel: Number(p.maxLevel) || 0, bg: p.bg || "" };
}
const vShipDecks = t => { const I = t.int, s = new Set([0]); for (let l = Math.min(0, I.minLevel || 0); l <= Math.max(0, I.maxLevel || 0); l++) s.add(l); (I.objs || []).forEach(o => s.add(Number(o.level) || 0)); (I.walls || []).forEach(w => s.add(Number(w[4]) || 0)); return [...s].sort((a, b) => a - b); };
const vShipDeckLvl = (t, d) => t.decks && t.decks[d] != null && t.decks[d] !== "" ? Number(t.decks[d]) : Number(d) || 0;
const vShipDeckName = (t, d) => { const n = (t.int.levelNames || {})[d]; return n || (d === 0 ? "Ground deck" : d > 0 ? `Deck +${d}` : `Deck ${d}`); };
// Ship grid (squares on its own map) to the battle map and back.
function vShipToMap(t, lx, ly) { const a = (Number(t.rot) || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = lx - t.int.com[0], dy = ly - t.int.com[1]; return [t.x + dx * c - dy * s, t.y + dx * s + dy * c]; }
function vShipToLocal(t, mx, my) { const a = (Number(t.rot) || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = mx - t.x, dy = my - t.y; return [t.int.com[0] + dx * c + dy * s, t.int.com[1] - dx * s + dy * c]; }
const vShipCorners = t => [[0, 0], [t.int.w, 0], [t.int.w, t.int.h], [0, t.int.h]].map(([a, b]) => vShipToMap(t, a, b));
const vShipHeading = t => (Number(t.rot) || 0) + (Number(t.int.front) || 0); // degrees, the way its front points on the battle map
// Is (lx, ly) on deck d? Where the deck has pictures, their outlines are the deck; with none, the whole ship is.
function vShipOnDeck(t, d, lx, ly) {
  if (lx < 0 || ly < 0 || lx > t.int.w || ly > t.int.h) return false;
  const pics = (t.int.objs || []).filter(o => (Number(o.level) || 0) === d && o.layer !== "gm");
  return !pics.length || pics.some(o => lx >= o.x && ly >= o.y && lx <= o.x + o.w && ly <= o.y + o.h);
}
const vShips = pid => [...S.vttTokens].filter(([, t]) => t.page === pid && vIsShip(t));
// The ship (and deck) a token dropped at (cx, cy), standing on map level lvl, would be on: the deck at that level if there's
// floor there, otherwise the top deck with floor there.
function vShipUnder(pid, cx, cy, lvl, skip) {
  for (const [id, t] of vShips(pid)) {
    if (id === skip || (t.layer === "gm" && !vCanEdit())) continue;
    const [lx, ly] = vShipToLocal(t, cx, cy); if (lx < 0 || ly < 0 || lx > t.int.w || ly > t.int.h) continue;
    const decks = vShipDecks(t).filter(d => vShipOnDeck(t, d, lx, ly)); if (!decks.length) continue;
    const same = decks.find(d => vShipDeckLvl(t, d) === lvl), deck = same != null ? same : decks[decks.length - 1];
    return { id, t, deck, lx, ly };
  }
  return null;
}
// The spot on the ship's grid for a token of size s centred near (lx, ly): whole squares on the ship.
const vShipSnapLocal = (lx, ly, s) => [Math.round(lx - s / 2), Math.round(ly - s / 2)];
// While dragging: where a token would land, snapped to a ship's grid if it's over one, else the map's.
function vSnapAny(p, nx, ny, s, t) {
  const cur = vPageNow(), cx = nx + s / 2, cy = ny + s / 2, on = cur && vShipUnder(cur.id, cx, cy, t && t.ship ? vTokFloor(t) : vTokFloor(t || {}), "");
  if (on) { const [sx, sy] = vShipSnapLocal(on.lx, on.ly, s), [mx, my] = vShipToMap(on.t, sx + s / 2, sy + s / 2); return [mx - s / 2, my - s / 2]; }
  return vSnapTok(p, nx, ny, s);
}
// A token dropped: onto a ship (boarding, or moving about on deck) or off one. Returns true if it dealt with it.
function vShipDrop(id, t, nx, ny, s) {
  const cur = vPageNow(); if (!cur) return false;
  const cx = nx + s / 2, cy = ny + s / 2, on = vShipUnder(cur.id, cx, cy, vTokFloor(t), id);
  if (on) {
    const [sx, sy] = vShipSnapLocal(on.lx, on.ly, s), deck = t.ship === on.id && vShipOnDeck(on.t, t.deck, on.lx, on.ly) ? t.deck : on.deck;
    const [mx, my] = vShipToMap(on.t, sx + s / 2, sy + s / 2), f = { ship: on.id, sx, sy, deck, x: mx - s / 2, y: my - s / 2, lvl: vShipDeckLvl(on.t, deck), mount: null };
    if (t.ship !== on.id) toast(`${vTokName(t)} is aboard ${vTokName(on.t)} (${vShipDeckName(on.t, deck)}).`);
    S.vttTokens.set(id, Object.assign({}, t, f)); vPatch("vtttokens/" + id, f); vDraw(); return true;
  }
  if (t.ship) { // stepped off
    const [x, y] = vSnapTok(cur.p, nx, ny, s), f = { ship: null, sx: null, sy: null, deck: null, x: Math.max(0, Math.min(cur.p.w - s, x)), y: Math.max(0, Math.min(cur.p.h - s, y)) };
    S.vttTokens.set(id, Object.assign({}, t, f)); vPatch("vtttokens/" + id, f); vDraw(); return true;
  }
  return false;
}
// Everyone aboard: where they are on the battle map now. The GM's screen writes it back so the library stays in step.
VTT.shipSync = VTT.shipSync || {};
function vShipFix() {
  if (!S.vttTokens) return; const gm = vCanEdit();
  for (const [id, t] of [...S.vttTokens]) {
    if (!t.ship) continue;
    const sh = S.vttTokens.get(t.ship);
    if (!vIsShip(sh) || sh.page !== t.page) { if (gm && sh === undefined && !VTT.shipSync["gone" + id]) { VTT.shipSync["gone" + id] = 1; vPatch("vtttokens/" + id, { ship: null, sx: null, sy: null, deck: null }); } continue; }
    const s = vTokSz(t), [mx, my] = vShipToMap(sh, (Number(t.sx) || 0) + s / 2, (Number(t.sy) || 0) + s / 2), x = mx - s / 2, y = my - s / 2, lvl = vShipDeckLvl(sh, Number(t.deck) || 0);
    if (Math.abs((t.x || 0) - x) < 1e-6 && Math.abs((t.y || 0) - y) < 1e-6 && (Number(t.lvl) || 0) === lvl && !t.fly) continue;
    S.vttTokens.set(id, Object.assign({}, t, { x, y, lvl, fly: 0 }));
    if (gm) { clearTimeout(VTT.shipSync[id]); VTT.shipSync[id] = setTimeout(() => { const q = S.vttTokens.get(id); if (q && q.ship) vPatch("vtttokens/" + id, { x: Math.round(q.x * 1000) / 1000, y: Math.round(q.y * 1000) / 1000, lvl: q.lvl || 0, fly: 0 }); }, 600); }
  }
}
// The ships' walls where they are on the battle map now, at the map level of their deck (for sight and for movement).
function vShipWallsOn(pid, skip) {
  const out = [];
  if (!S.vttTokens) return out;
  for (const [id, t] of vShips(pid)) {
    if (id === skip) continue;
    (t.int.walls || []).forEach(w => { const a = vShipToMap(t, w[0], w[1]), b = vShipToMap(t, w[2], w[3]); out.push([a[0], a[1], b[0], b[1], vShipDeckLvl(t, Number(w[4]) || 0), w[5]]); });
  }
  return out;
}
// The token standing at the helm, if anyone is: on a helm square of the deck it's on.
function vShipHelm(id, t) {
  t = t || S.vttTokens.get(id); if (!vIsShip(t)) return null;
  const helm = t.int.helm || []; if (!helm.length) return null;
  for (const [tid, q] of S.vttTokens) {
    if (q.ship !== id) continue; const s = vTokSz(q), cx = Math.floor((Number(q.sx) || 0) + s / 2), cy = Math.floor((Number(q.sy) || 0) + s / 2);
    if (helm.some(h => h[0] === cx && h[1] === cy && (Number(h[2]) || 0) === (Number(q.deck) || 0))) return [tid, q];
  }
  return null;
}
// Which decks to draw. The GM sees the levels picked on the side (all by default). Players see the open decks (those at
// the map's ground level or above) unless everyone looking is below deck on this ship, when they see their deck and below.
function vShipDeckShown(id, t, gm, viewers) {
  const decks = vShipDecks(t);
  if (gm && !VTT.preview) return { decks: decks.filter(d => !vLvlHid(vShipDeckLvl(t, d))), below: false };
  const aboard = viewers.filter(([, q]) => q.ship === id).map(([, q]) => vTokFloor(q)), outside = viewers.some(([, q]) => q.ship !== id);
  const topside = decks.filter(d => vShipDeckLvl(t, d) >= 0), top = topside.length ? topside : [decks[decks.length - 1]];
  if (aboard.length && !outside && aboard.every(f => f < 0)) { const m = Math.max(...aboard); return { decks: decks.filter(d => vShipDeckLvl(t, d) <= m), below: true }; }
  return { decks: decks.filter(d => top.includes(d) || aboard.includes(vShipDeckLvl(t, d))), below: false };
}
function vShipsHtml(pid, p, toks, gm) {
  const ships = toks.filter(([, t]) => vIsShip(t) && (gm || t.layer !== "gm")); if (!ships.length) { VTT.shipBelow = false; return ""; }
  const C = VCELL, viewers = gm && !VTT.preview ? [] : vViewers(p, toks); let below = ships.length > 0;
  const html = ships.map(([id, t]) => {
    const I = t.int, vis = vShipDeckShown(id, t, gm, viewers); if (!vis.below) below = false;
    const sel = VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id === id;
    const deckHtml = vis.decks.map(d => {
      const objs = (I.objs || []).filter(o => (Number(o.level) || 0) === d && (gm || o.layer !== "gm"));
      const doors = (I.walls || []).map((w, i) => { const m = w[5]; if ((Number(w[4]) || 0) !== d || !m || (m.k !== "door" && m.k !== "window") || (m.secret && !gm)) return "";
        const x = (w[0] + w[2]) / 2, y = (w[1] + w[3]) / 2;
        return m.k === "window" ? `<div class="vdoor window" style="left:${x * C}px;top:${y * C}px" title="Window"></div>` : `<button class="vdoor door vsdoor${m.open ? " open" : ""}${m.locked ? " locked" : ""}" data-ship="${esc(id)}" data-wi="${i}" style="left:${x * C}px;top:${y * C}px" title="${m.locked ? "Locked door" : m.open ? "Close the door" : "Open the door"}" aria-label="Door"></button>`; }).join("");
      const helm = (I.helm || []).filter(h => (Number(h[2]) || 0) === d).map(h => `<div class="vshelm" style="left:${h[0] * C}px;top:${h[1] * C}px;width:${C}px;height:${C}px" title="Helm">⎈</div>`).join("");
      return `<div class="vsdeck" data-deck="${d}" data-lvl="${vShipDeckLvl(t, d)}">${objs.map(o => `<img class="vsobj" src="${esc(o.img || "")}" alt="" draggable="false" style="left:${o.x * C}px;top:${o.y * C}px;width:${o.w * C}px;height:${o.h * C}px${o.rot ? `;transform:rotate(${o.rot}deg)` : ""}">`).join("")}${helm}${doors}</div>`;
    }).join("");
    const grid = p.grid !== false ? `<svg class="vsgrid" width="${I.w * C}" height="${I.h * C}" aria-hidden="true"><defs><pattern id="vsg-${esc(id)}" width="${C}" height="${C}" patternUnits="userSpaceOnUse"><path d="M ${C} 0 L 0 0 0 ${C}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#vsg-${esc(id)})"/></svg>` : "";
    const walls = gm && !VTT.preview && VTT.layer === "walls" ? `<svg class="vswalls" width="${I.w * C}" height="${I.h * C}" aria-hidden="true">${(I.walls || []).filter(w => vis.decks.includes(Number(w[4]) || 0)).map(w => `<line x1="${w[0] * C}" y1="${w[1] * C}" x2="${w[2] * C}" y2="${w[3] * C}"/>`).join("")}</svg>` : "";
    return `<div class="vship${sel ? " sel" : ""}${t.layer === "gm" ? " gmonly" : ""}${vDead(t) ? " wreck" : ""}" data-ship="${esc(id)}" style="left:${(t.x - I.com[0]) * C}px;top:${(t.y - I.com[1]) * C}px;width:${I.w * C}px;height:${I.h * C}px;transform-origin:${I.com[0] * C}px ${I.com[1] * C}px;transform:rotate(${Number(t.rot) || 0}deg)" title="${esc(t.name || "Vehicle")}">${deckHtml}${grid}${walls}
      ${sel && gm ? `<div class="vscom" style="left:${I.com[0] * C}px;top:${I.com[1] * C}px" title="Centre of mass"></div>` : ""}</div>`;
  }).join("");
  VTT.shipBelow = below && !(gm && !VTT.preview);
  return `<div class="vlayer vships">${html}</div>`;
}
// Bars and the GM's turn handle sit outside the turning ship, upright.
function vShipOverHtml(toks, gm) {
  const C = VCELL;
  return toks.filter(([, t]) => vIsShip(t) && (gm || t.layer !== "gm")).map(([id, t]) => {
    const cs = vShipCorners(t), minX = Math.min(...cs.map(c => c[0])), maxX = Math.max(...cs.map(c => c[0])), minY = Math.min(...cs.map(c => c[1]));
    const sel = VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id === id;
    const name = `<div class="vshipname" style="left:${(minX + maxX) / 2 * C}px;top:${minY * C}px">${vBarsHtml(t)}<span>${esc(t.name || "")}</span></div>`;
    const rot = sel && gm ? (() => { const h = (vShipHeading(t) + 25) * Math.PI / 180, r = Math.max(t.int.w, t.int.h) / 2 + 1.5; return `<div class="vshiprot" data-ship="${esc(id)}" style="left:${(t.x + Math.cos(h) * r) * C}px;top:${(t.y + Math.sin(h) * r) * C}px" title="Drag to turn the vehicle (Shift: any angle)">⟳</div>`; })() : "";
    return name + rot;
  }).join("") + vHelmHtml(toks, gm);
}
// The ring around whoever is at the helm, with the arrow they drag to steer.
function vHelmHtml(toks, gm) {
  const C = VCELL;
  return toks.filter(([, t]) => vIsShip(t)).map(([id, t]) => {
    const h = vShipHelm(id, t); if (!h) return "";
    const [hid, ht] = h, mine = gm ? (VTT.sel && VTT.sel.kind === "tok" && (VTT.sel.id === hid || VTT.sel.id === id)) : PLAYER && vPlayerTok(ht); if (!mine) return "";
    const s = vTokSz(ht), r = (s / 2 + 0.55) * C, cx = (ht.x + s / 2) * C, cy = (ht.y + s / 2) * C;
    return `<div class="vhelmring" style="left:${cx}px;top:${cy}px;width:${r * 2}px;height:${r * 2}px;transform:translate(-50%,-50%) rotate(${vShipHeading(t)}deg)"><button class="vhelmarrow" data-ship="${esc(id)}" title="Drag to steer ${esc(t.name || "the vehicle")}. Hold Shift to finish squared to the nearest 45°, Ctrl to go straight there, Alt to stop it snapping." aria-label="Steer">➤</button></div>`;
  }).join("");
}

// ----- Steering -----
// The way a ship would go to put its centre of mass at P: forwards along its turning circle until it faces P, then straight.
// Too tight a turn, and it goes as close as it can (or, held Ctrl / Shift, straight there anyway with the reason shown).
function vShipSpeed(t) { const v = vVehOf(t); return v ? v.speeds[0] : { move: 30, omni: false, rev: false }; }
// Where its centre of mass may come to rest: the same kind of spot it sits on within the ship (the middle of a square,
// a corner, or the middle of an edge), so its squares line up with the map's whenever it faces straight along the grid.
// Turned on its side (nearer 90° or 270°), the ship's across and along swap.
function vShipComOff(t, rot) {
  const f = v => { const r = ((Number(v) || 0) % 1 + 1) % 1; return Math.abs(r - 0.5) < 0.25 ? 0.5 : 0; };
  const fx = f(t.int.com[0]), fy = f(t.int.com[1]), q = ((Math.round((Number(rot) || 0) / 90) % 2) + 2) % 2;
  return q ? [fy, fx] : [fx, fy];
}
function vShipSnapCom(t, x, y, rot) { const [ox, oy] = vShipComOff(t, rot); return [Math.round(x - ox) + ox, Math.round(y - oy) + oy]; }
// Steering: opt.direct (Ctrl) goes straight there; opt.angle (Shift) finishes squared to the nearest 45°; opt.free (Alt) doesn't snap.
function vShipPath(t, P, opt) {
  opt = opt || {};
  const first = vShipPathRaw(t, P, opt.direct); if (opt.free) return first;
  if (opt.angle && !first.omni && !opt.direct) return vShipPathSquared(t, P, first);
  const [sx, sy] = vShipSnapCom(t, P[0], P[1], first.omni ? (Number(t.rot) || 0) : first.rot);
  return vShipPathRaw(t, [sx, sy], opt.direct);
}
// Turn along its circle until it faces the nearest 45°, then straight on as far as it comes level with where it was pointed.
function vShipPathSquared(t, P, first) {
  const v = vVehOf(t), R = Math.max(0, (v ? v.turn : 0) / 2 / 5), front = Number(t.int.front) || 0;
  const H = Math.round((first.rot + front) / 45) * 45, rev = !!first.rev, h0 = vShipHeading(t) * Math.PI / 180 + (rev ? Math.PI : 0), Hp = H * Math.PI / 180 + (rev ? Math.PI : 0);
  const diff = ((Hp - h0) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI, side = Math.sign(diff) || 1;
  const pos = [t.x, t.y], pts = [pos.slice()]; let end = pos.slice();
  if (R > 0.01 && Math.abs(diff) > 1e-6) {
    const hv = [Math.cos(h0), Math.sin(h0)], n = [-hv[1] * side, hv[0] * side], C0 = [pos[0] + n[0] * R, pos[1] + n[1] * R], steps = Math.max(2, Math.ceil(Math.abs(diff) / 0.05));
    for (let i = 1; i <= steps; i++) { const th = side * Math.abs(diff) * i / steps; end = [C0[0] + R * (-n[0] * Math.cos(th) + n[1] * Math.sin(th)), C0[1] + R * (-n[0] * Math.sin(th) - n[1] * Math.cos(th))]; pts.push(end); }
  }
  const dir = [Math.cos(Hp), Math.sin(Hp)], along = Math.max(0, (P[0] - end[0]) * dir[0] + (P[1] - end[1]) * dir[1]);
  const Q = vShipSnapCom(t, end[0] + dir[0] * along, end[1] + dir[1] * along, H - front); pts.push(Q);
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { pts, len, end: Q, rot: H - front, ok: true, why: "squared to " + (((H % 360) + 360) % 360) + "°", rev, squared: true };
}
function vShipPathRaw(t, P, direct) {
  const v = vVehOf(t), sp = vShipSpeed(t), R = Math.max(0, (v ? v.turn : 0) / 2 / 5);
  const pos = [t.x, t.y], h0 = vShipHeading(t) * Math.PI / 180, d = [P[0] - pos[0], P[1] - pos[1]], dist = Math.hypot(d[0], d[1]);
  const out = (pts, endH, extra) => { let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); const e = pts[pts.length - 1]; return Object.assign({ pts, len, end: [e[0], e[1]], rot: endH * 180 / Math.PI - (Number(t.int.front) || 0), ok: true, why: "" }, extra || {}); };
  if (dist < 0.05) return out([pos, pos], h0);
  if (sp.omni) return out([pos, P], h0, { omni: true });
  const want = Math.atan2(d[1], d[0]), behind = Math.cos(want - h0) < 0, rev = sp.rev && behind;
  const hs = rev ? h0 + Math.PI : h0; // reversing: plan it as going forwards with the back as the front
  // Its centre runs round a circle of radius R on the side it's turning to (screen y points down, so +1 turns clockwise).
  const arc = () => {
    if (R <= 0.01) return { pts: [pos, P], h: Math.atan2(d[1], d[0]), ok: true };
    const hv = [Math.cos(hs), Math.sin(hs)], side = Math.sign(hv[0] * d[1] - hv[1] * d[0]) || 1, n = [-hv[1] * side, hv[0] * side], C0 = [pos[0] + n[0] * R, pos[1] + n[1] * R];
    const at = a => { const th = side * a, vx = -n[0], vy = -n[1]; return [C0[0] + R * (vx * Math.cos(th) - vy * Math.sin(th)), C0[1] + R * (vx * Math.sin(th) + vy * Math.cos(th))]; };
    const inside = Math.hypot(P[0] - C0[0], P[1] - C0[1]) < R - 1e-6, step = Math.min(0.15 / R, 0.05), pts = [pos.slice()];
    let best = { dd: Infinity, i: 1, h: hs }, a = 0, p = pos.slice(), h = hs;
    while (a < 2 * Math.PI) {
      const tx = P[0] - p[0], ty = P[1] - p[1], cr = Math.cos(h) * ty - Math.sin(h) * tx, dot = Math.cos(h) * tx + Math.sin(h) * ty, dd = Math.hypot(tx, ty);
      if (inside) { if (dd < best.dd) best = { dd, i: pts.length, h }; }
      else if (a > 0 && dot > 0 && Math.sign(cr) !== side) break; // facing P now
      a += step; p = at(a); h = hs + side * a; pts.push(p);
    }
    if (inside) return { pts: pts.slice(0, Math.max(2, best.i)), h: best.h, ok: false };
    pts.push(P.slice()); return { pts, h: Math.atan2(P[1] - p[1], P[0] - p[0]), ok: true };
  };
  const a = arc(), turnFt = v ? v.turn : 0, why = `Turns tighter than its ${turnFt} ft turning circle`;
  if (direct) { // straight there: fine if its turning circle allows the turn over that distance
    const hEnd = Math.atan2(d[1], d[0]); let turn = Math.abs(((hEnd - hs) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    const can = R <= 0.01 || turn <= dist / R + 1e-6;
    return out([pos, P], rev ? hEnd - Math.PI : hEnd, { ok: can, direct: true, why: can ? "" : why, rev });
  }
  return out(a.pts, rev ? a.h - Math.PI : a.h, { ok: a.ok, why: a.ok ? "" : why + ": it goes as close as it can", rev });
}
// Walls of the map (and other vehicles) it would hit: along its path, and where it would end up.
function vShipHits(pid, id, t, plan) {
  const cur = vPageNow(); if (!cur) return [];
  const lv = new Set([0, ...vShipDecks(t).map(d => vShipDeckLvl(t, d)).filter(l => l >= 0)]);
  const walls = (cur.p.walls || []).concat(vShipWallsOn(pid, id)).filter(w => lv.has(Number(w[4]) || 0) && !vWallPassable(w));
  const hits = [], seg = (a, b) => walls.forEach(w => { const rx = b[0] - a[0], ry = b[1] - a[1], sx = w[2] - w[0], sy = w[3] - w[1], den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) return; const u = ((w[0] - a[0]) * sy - (w[1] - a[1]) * sx) / den, v = ((w[0] - a[0]) * ry - (w[1] - a[1]) * rx) / den; if (u > 1e-6 && u < 1 - 1e-6 && v >= -1e-6 && v <= 1 + 1e-6) hits.push([a[0] + rx * u, a[1] + ry * u]); });
  for (let i = 1; i < plan.pts.length; i++) seg(plan.pts[i - 1], plan.pts[i]);
  const ghost = Object.assign({}, t, { x: plan.end[0], y: plan.end[1], rot: plan.rot }), cs = vShipCorners(ghost);
  for (let i = 0; i < 4; i++) seg(cs[i], cs[(i + 1) % 4]);
  return hits;
}
function vSteerSvg() {
  const S1 = VTT.steer; if (!S1 || !S1.plan) return "";
  const t = S.vttTokens.get(S1.id); if (!t) return "";
  const C = VCELL, plan = S1.plan, sp = vShipSpeed(t), lim = (sp.move || 0) / 5;
  // Green up to its movement speed, amber past it.
  let acc = 0; const inPts = [plan.pts[0]], outPts = [];
  for (let i = 1; i < plan.pts.length; i++) { const a = plan.pts[i - 1], b = plan.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + L <= lim || !lim) { inPts.push(b); } else if (acc < lim) { const f = (lim - acc) / L, m = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; inPts.push(m); outPts.push(m, b); } else outPts.push(b);
    acc += L; }
  const line = (pts, cls) => pts.length > 1 ? `<polyline class="${cls}" points="${pts.map(q => q[0] * C + "," + q[1] * C).join(" ")}"/>` : "";
  const ghost = Object.assign({}, t, { x: plan.end[0], y: plan.end[1], rot: plan.rot }), cs = vShipCorners(ghost);
  const ft = Math.round(plan.len * 5), over = lim && plan.len > lim + 1e-6;
  const label = `${ft} ft${lim ? ` of ${sp.move} ft` : ""}${plan.rev ? " · reversing" : ""}${plan.why ? " · " + plan.why : ""}${S1.hits.length ? " · hits a wall" : ""}`;
  const warn = over || !plan.ok || S1.hits.length;
  const e = plan.end;
  return `<svg class="vsteer" width="${VTT.stageW}" height="${VTT.stageH}" aria-hidden="true">
    <polygon class="vghost${plan.ok ? "" : " bad"}${over ? " over" : ""}" points="${cs.map(c => c[0] * C + "," + c[1] * C).join(" ")}"/>
    ${line(inPts, "vsp ok")}${line(outPts, "vsp over")}
    ${S1.hits.map(h => `<g class="hitx" transform="translate(${h[0] * C},${h[1] * C}) scale(${Math.max(1, 1 / (VTT.zoom || 1))})"><line x1="-9" y1="-9" x2="9" y2="9"/><line x1="-9" y1="9" x2="9" y2="-9"/></g>`).join("")}
    <text x="${e[0] * C + 14}" y="${e[1] * C - 12}" style="font-size:calc(15px * var(--vinv, 1))" class="vsteerlbl${warn ? " warn" : ""}">${esc(label)}</text></svg>`;
}
function vSteerDraw() {
  let el = document.getElementById("vsteerl"); const st = document.getElementById("vstage"); if (!st) return;
  if (!el) { el = document.createElement("div"); el.id = "vsteerl"; el.className = "vlayer vsteerl"; st.appendChild(el); }
  const S1 = VTT.steer;
  el.innerHTML = vSteerSvg() + (S1 && S1.plan && S1.done ? `<div class="vsteerpop" style="left:${S1.plan.end[0] * VCELL}px;top:${S1.plan.end[1] * VCELL}px"><button data-steer="move">⛵ Move</button><button data-steer="abandon">✕ Abandon</button></div>` : "");
}
function vSteerStart(ev, id) {
  const t = S.vttTokens.get(id); if (!t) return;
  const why = vVehStall(id, t); if (why && !vCanEdit()) { toast(why); return; } if (why) toast(why + " (You can still move it.)");
  ev.preventDefault(); ev.stopPropagation();
  VTT.steer = { id, plan: null, hits: [], done: false };
  const move = e => { const [x, y] = vPt(e), q = S.vttTokens.get(id); if (!q) return; const plan = vShipPath(q, [x, y], { direct: e.ctrlKey || e.metaKey, angle: e.shiftKey, free: e.altKey }); VTT.steer.plan = plan; VTT.steer.hits = vShipHits(q.page, id, q, plan); vSteerDraw(); };
  const up = e => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); if (!VTT.steer || !VTT.steer.plan) { VTT.steer = null; vSteerDraw(); return; } VTT.steer.done = true; vSteerDraw(); };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true);
}
// Glide along the path, then save where it ended up (with how far it went, for its fuel).
async function vSteerGo() {
  const S1 = VTT.steer; if (!S1 || !S1.plan) return; VTT.steer = null; vSteerDraw();
  const id = S1.id, t0 = S.vttTokens.get(id); if (!t0) return;
  const plan = S1.plan, pts = plan.pts, total = plan.len || 0.0001, r0 = Number(t0.rot) || 0, front = Number(t0.int.front) || 0;
  const at = f => { let want = f * total, acc = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + L >= want || i === pts.length - 1) { const g = L ? Math.min(1, (want - acc) / L) : 1, hd = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; return [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g, plan.omni ? r0 : (plan.rev ? hd + 180 : hd) - front]; } acc += L; } return [plan.end[0], plan.end[1], plan.rot]; };
  const frames = Math.max(6, Math.min(24, Math.round(total * 2)));
  for (let k = 1; k < frames; k++) { const [x, y, rot] = at(k / frames), q = S.vttTokens.get(id); if (!q) return; S.vttTokens.set(id, Object.assign({}, q, { x, y, rot })); vDraw(); await new Promise(r => setTimeout(r, 40)); }
  const rot = Math.round(((plan.rot % 360) + 360) % 360 * 100) / 100, f = { x: Math.round(plan.end[0] * 1000) / 1000, y: Math.round(plan.end[1] * 1000) / 1000, rot, mv: { len: Math.round(plan.len * 100) / 100, at: Date.now() } };
  const q = S.vttTokens.get(id); if (q) S.vttTokens.set(id, Object.assign({}, q, f));
  vPatch("vtttokens/" + id, f); vDraw(); vRefresh();
}

// ----- Pointer: steering arrow, the GM moving or turning a ship, selecting one, and the workshop's helm and centre tools -----
function vShipPointerDown(ev, cur, gm, x, y) {
  if (ev.button !== 0) return false;
  const pop = ev.target.closest(".vsteerpop button"); if (pop) { ev.preventDefault(); ev.stopPropagation(); if (pop.dataset.steer === "move") vSteerGo(); else { VTT.steer = null; vSteerDraw(); } return true; }
  if (VTT.steer && VTT.steer.done) { VTT.steer = null; vSteerDraw(); }
  const arrow = ev.target.closest(".vhelmarrow"); if (arrow) { vSteerStart(ev, arrow.dataset.ship); return true; }
  const door = ev.target.closest(".vsdoor"); if (door) { ev.preventDefault(); ev.stopPropagation(); vShipDoor(door.dataset.ship, Number(door.dataset.wi)); return true; }
  if (gm && cur.p.vehicle && (VTT.tool === "helm" || VTT.tool === "com")) { ev.preventDefault(); vWorkshopClick(cur, x, y, ev); return true; }
  const rh = gm && ev.target.closest(".vshiprot"); if (rh) {
    ev.preventDefault(); ev.stopPropagation(); const id = rh.dataset.ship;
    const move = e => { const [px, py] = vPt(e), q = S.vttTokens.get(id); if (!q) return; let hd = Math.atan2(py - q.y, px - q.x) * 180 / Math.PI; if (!e.shiftKey) hd = Math.round(hd / 15) * 15; S.vttTokens.set(id, Object.assign({}, q, { rot: ((hd - (Number(q.int.front) || 0)) % 360 + 360) % 360 })); vDraw(); };
    const up = e => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); const q = S.vttTokens.get(id); if (!q) return; const [x, y] = e.altKey ? [q.x, q.y] : vShipSnapCom(q, q.x, q.y, q.rot); S.vttTokens.set(id, Object.assign({}, q, { x, y })); vPatch("vtttokens/" + id, { rot: q.rot, x, y }); vDraw(); };
    window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); return true;
  }
  const hull = ev.target.closest(".vship"); if (!hull || VTT.tool !== "select") return false;
  const id = hull.dataset.ship, t = S.vttTokens.get(id); if (!t) return false;
  if (!gm) { // players: a click (not a drag) on a ship shows it in the side panel; a drag still pans
    const sx = ev.clientX, sy = ev.clientY, up = e => { window.removeEventListener("pointerup", up, true); if (Math.hypot(e.clientX - sx, e.clientY - sy) < 5) { VTT.sel = { kind: "tok", id }; vRefresh(); vDraw(); } };
    window.addEventListener("pointerup", up, true); return false;
  }
  if (VTT.layer !== "token" && VTT.layer !== "gm") return false;
  ev.preventDefault(); VTT.sel = { kind: "tok", id }; VTT.multi.clear();
  const ox = x - t.x, oy = y - t.y; let moved = false;
  const move = e => { const [px, py] = vPt(e), q = S.vttTokens.get(id); if (!q) return; moved = true; let nx = px - ox, ny = py - oy; if (!e.altKey) [nx, ny] = vShipSnapCom(q, nx, ny, q.rot); S.vttTokens.set(id, Object.assign({}, q, { x: nx, y: ny })); vDraw(); };
  const up = () => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); const q = S.vttTokens.get(id); if (moved && q) vPatch("vtttokens/" + id, { x: q.x, y: q.y }); vRefresh(); vDraw(); };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true);
  vRefresh(); vDraw(); return true;
}
// A door on a ship: the GM, or a player whose token can see it, opens and closes it (locked ones stay shut for players).
function vShipDoor(id, i) {
  const t = S.vttTokens.get(id); if (!vIsShip(t)) return; const w = (t.int.walls || [])[i]; if (!w || !w[5]) return;
  if (!vCanEdit() && w[5].locked) { toast("It's locked."); return; }
  const walls = t.int.walls.map((q, k) => k === i ? q.slice(0, 5).concat([Object.assign({}, q[5], { open: !q[5].open })], q.slice(6)) : q), int = Object.assign({}, t.int, { walls });
  S.vttTokens.set(id, Object.assign({}, t, { int })); vPatch("vtttokens/" + id, { int }); vDraw();
}
// Stairs and pulleys aboard: buttons by a token standing on them, to go to the other decks they reach.
function vShipGoHtml(id, t) {
  const sh = S.vttTokens.get(t.ship); if (!vIsShip(sh)) return "";
  const s = vTokSz(t), cx = (Number(t.sx) || 0) + s / 2, cy = (Number(t.sy) || 0) + s / 2, d = Number(t.deck) || 0;
  const l = (sh.int.links || []).find(k => cx >= k.x && cx <= k.x + k.w && cy >= k.y && cy <= k.y + k.h && (k.levels || []).includes(d)); if (!l) return "";
  return (l.levels || []).filter(n => n !== d).map(n => `<button data-tok="${esc(id)}" data-deck="${n}" title="Move ${esc(vTokName(t))} to ${esc(vShipDeckName(sh, n))}">${l.kind === "lift" ? "🛗" : n > d ? "⬆" : "⬇"} ${esc(vShipDeckName(sh, n))}</button>`).join("");
}
function vShipGoDeck(id, n) {
  const t = S.vttTokens.get(id), sh = t && S.vttTokens.get(t.ship); if (!vIsShip(sh)) return;
  const f = { deck: n, lvl: vShipDeckLvl(sh, n) }; S.vttTokens.set(id, Object.assign({}, t, f)); vPatch("vtttokens/" + id, f); vDraw();
}

// ----- Placing a ship, and keeping placed ships up to date with their workshop map -----
function vShipPlace(cur, ref, e, cx, cy) {
  const v = vehOf(e), pg = v && v.page && S.vttPages.get(v.page);
  if (!pg) { toast(`${e.title} has no map yet: build it from its page first.`); return null; }
  const int = vShipIntOf(pg), id = vid("t");
  const [px, py] = vShipSnapCom({ int }, cx, cy, 0);
  const doc = { page: cur.id, layer: VTT.layer === "gm" ? "gm" : "token", x: px, y: py, rot: 0, size: 1, img: "", name: e.title, ref, owner: "", hp: v.hull, hpMax: v.hull, int, created: new Date().toISOString() };
  if (v.fuel.type === "refuel") doc.fuel = v.fuel.cap;
  vSave("vtttokens/" + id, doc); return id;
}
// When the GM edits a vehicle's map in the workshop, the copies on battle maps follow (keeping which doors are open).
VTT.shipPageSig = VTT.shipPageSig || {};
function vShipsSync() {
  if (!vCanEdit() || !S.vttPages || !S.vttTokens) return;
  for (const [pid, p] of S.vttPages) {
    if (!p.vehicle) continue;
    const int = vShipIntOf(p), sig = JSON.stringify(int); if (VTT.shipPageSig[pid] === sig) continue;
    const first = VTT.shipPageSig[pid] == null; VTT.shipPageSig[pid] = sig; if (first) { /* still bring any stale copies up to date */ }
    for (const [tid, t] of S.vttTokens) {
      if (!vIsShip(t) || t.ref !== "e:" + p.vehicle) continue;
      const open = new Map((t.int.walls || []).map(w => [w.slice(0, 5).join(","), !!(w[5] && w[5].open)]));
      const walls = int.walls.map(w => w[5] && open.get(w.slice(0, 5).join(",")) ? w.slice(0, 5).concat([Object.assign({}, w[5], { open: true })], w.slice(6)) : w);
      const next = Object.assign({}, int, { walls }); if (JSON.stringify(next) === JSON.stringify(t.int)) continue;
      vPatch("vtttokens/" + tid, { int: next });
    }
  }
}

// ----- The vehicle workshop -----
async function vOpenWorkshop(entryId) {
  const e = S.entries.get(entryId); if (!e || !isVehicle(e)) return;
  if (!S.vttCamps.has(VWS)) await vSave("vttcamps/" + VWS, { name: "Vehicle workshop", workshop: true, created: new Date().toISOString() });
  const v = e.item.vehicle || {}; let pid = v.page && S.vttPages.has(v.page) ? v.page : "";
  if (!pid) {
    pid = vid("p");
    await vSave("vttpages/" + pid, { camp: VWS, vehicle: entryId, name: e.title, order: 0, folder: "", open: false, w: 12, h: 6, bg: "#1b1f27", grid: true, light: false, fogMem: false, objs: [], walls: [], helm: [], com: [6, 3], front: 0, created: new Date().toISOString() });
    await safeWrite(() => S.db.doc("entries/" + entryId).update({ item: Object.assign({}, e.item, { vehicle: Object.assign({}, v, { cx: "complex", page: pid }) }) }));
  }
  VTT.page = pid; VTT.lvl = 0; location.hash = "vtt-" + VWS;
  setTimeout(() => { VTT.page = pid; render(); }, 50);
}
function vWorkshopClick(cur, x, y, ev) {
  const p = cur.p;
  if (VTT.tool === "helm") {
    const hx = Math.floor(x), hy = Math.floor(y), d = VTT.lvl || 0, helm = (p.helm || []).slice(), i = helm.findIndex(h => h[0] === hx && h[1] === hy && (Number(h[2]) || 0) === d);
    if (i >= 0) helm.splice(i, 1); else helm.push([hx, hy, d]);
    vPatch("vttpages/" + cur.id, { helm }); return;
  }
  const com = ev.altKey ? [Math.round(x * 100) / 100, Math.round(y * 100) / 100] : [Math.round(x * 2) / 2, Math.round(y * 2) / 2];
  vPatch("vttpages/" + cur.id, { com });
}
// In the workshop: the helm squares, the centre of mass and an arrow for which way is the front.
function vWorkshopHtml(p) {
  if (!p.vehicle) return "";
  const C = VCELL, com = Array.isArray(p.com) ? p.com : [p.w / 2, p.h / 2], f = (Number(p.front) || 0) * Math.PI / 180, L = Math.max(1.5, Math.min(p.w, p.h) / 3);
  return `<div class="vlayer vworkshop">${(p.helm || []).map(h => `<div class="vshelm ws${(Number(h[2]) || 0) === (VTT.lvl || 0) ? "" : " other"}" style="left:${h[0] * C}px;top:${h[1] * C}px;width:${C}px;height:${C}px" title="Helm (${esc(vLevelName(p, Number(h[2]) || 0))})">⎈</div>`).join("")}
    <svg class="vwsfront" width="${p.w * C}" height="${p.h * C}" aria-hidden="true"><defs><marker id="vwsarrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#f2d36b"/></marker></defs>
      <line x1="${com[0] * C}" y1="${com[1] * C}" x2="${(com[0] + Math.cos(f) * L) * C}" y2="${(com[1] + Math.sin(f) * L) * C}" stroke="#f2d36b" stroke-width="3" marker-end="url(#vwsarrow)"/></svg>
    <div class="vscom ws" style="left:${com[0] * C}px;top:${com[1] * C}px" title="Centre of mass: the vehicle turns around this"></div></div>`;
}
function vWorkshopToolsHtml(p) {
  if (!p || !p.vehicle) return "";
  return `<div class="vgroup"><span class="vlab">Vehicle</span><button class="vbtn${VTT.tool === "helm" ? " on" : ""}" data-act="vtttool" data-v="helm" title="Helm: click squares where a pilot steers from (on the level you're editing); click again to remove">⎈ Helm</button><button class="vbtn${VTT.tool === "com" ? " on" : ""}" data-act="vtttool" data-v="com" title="Centre of mass: click where the vehicle turns around (Alt: anywhere)">✛ Centre</button>
    <label><span class="small muted">Front points</span><select data-act="vttfront">${[[0, "→ Right"], [90, "↓ Down"], [180, "← Left"], [270, "↑ Up"]].map(([v, l]) => `<option value="${v}"${(Number(p.front) || 0) === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <a class="small" href="#entry-${esc(p.vehicle)}">← Back to the vehicle</a></div>`;
}
document.addEventListener("change", ev => {
  const s = ev.target.matches && ev.target.matches("[data-act=vttfront]") && ev.target; if (!s) return;
  const cur = vPageNow(); if (cur && vCanEdit()) vPatch("vttpages/" + cur.id, { front: Number(s.value) || 0 });
});

// ----- Levels: the map's levels, and where each vehicle's decks sit among them -----
function vLevelsDialog() {
  const cur = vPageNow(); if (!cur || !vCanEdit()) return;
  const draw = () => {
    const p = (vPageNow() || cur).p, ships = vShips(cur.id);
    const lvls = vLevelList(p).slice().reverse(), lo = Math.min(-3, ...lvls) - 1, hi = Math.max(3, ...lvls) + 1, range = []; for (let l = hi; l >= lo; l--) range.push(l);
    const tag = n => n === 0 ? "G" : n > 0 ? "L" + n : "B" + (-n);
    return `<div class="mbox vlvdlg"><h2>Levels</h2><p class="muted small">The map's levels, top to bottom, and where each vehicle's decks sit among them.</p>
      <div class="vlvcols"><div><h3>This map</h3><ol class="vlvlist">${lvls.map(n => `<li><span class="vlvtag">${tag(n)}</span> ${esc(vLevelName(p, n))}</li>`).join("")}</ol>
        <div class="acts"><button class="btn ghost small" data-lvd="above">+ Level above</button><button class="btn ghost small" data-lvd="below">+ Level below</button></div></div>
      <div><h3>Vehicles</h3>${ships.length ? ships.map(([id, t]) => `<div class="vlvship"><strong>${esc(t.name || "Vehicle")}</strong>${vShipDecks(t).slice().reverse().map(d => `<label class="vlvdeck"><span>${esc(vShipDeckName(t, d))}</span><select data-lvship="${esc(id)}" data-deck="${d}">${range.map(l => `<option value="${l}"${vShipDeckLvl(t, d) === l ? " selected" : ""}>${tag(l)}${vLevelList(p).includes(l) ? " · " + esc(vLevelName(p, l)) : ""}</option>`).join("")}</select></label>`).join("")}</div>`).join("") : `<p class="muted small">No vehicles with decks on this map.</p>`}</div></div>
      <div class="acts"><button class="btn" data-lvd="close">Done</button></div></div>`;
  };
  openModal(draw(), m => {
    m.addEventListener("change", e => { const s = e.target.closest("[data-lvship]"); if (!s) return; const t = S.vttTokens.get(s.dataset.lvship); if (!t) return;
      const decks = Object.assign({}, t.decks || {}); decks[s.dataset.deck] = Number(s.value); const lv = Number(s.value);
      vPatch("vtttokens/" + s.dataset.lvship, { decks }); S.vttTokens.set(s.dataset.lvship, Object.assign({}, t, { decks }));
      const p = (vPageNow() || cur).p; if (lv > vMaxLevel(p)) vPatch("vttpages/" + cur.id, { maxLevel: lv }); if (lv < vMinLevel(p)) vPatch("vttpages/" + cur.id, { minLevel: lv }); vDraw(); });
    m.addEventListener("click", async e => { const b = e.target.closest("[data-lvd]"); if (!b) return; const k = b.dataset.lvd;
      if (k === "close") { closeModal(); vRefresh(); return; }
      const p = (vPageNow() || cur).p; if (k === "above") await vPatch("vttpages/" + cur.id, { maxLevel: vMaxLevel(p) + 1 }); else await vPatch("vttpages/" + cur.id, { minLevel: vMinLevel(p) - 1 });
      setTimeout(() => { const box = document.querySelector(".vlvdlg"); if (box) box.outerHTML = draw(); }, 150); });
  });
}
