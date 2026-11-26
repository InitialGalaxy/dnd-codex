// ===== Towns =====
// After the research on medieval town plans and on procedural city generation:
// - A town is a few main streets meeting at a market place, each street lined both sides with burgage plots: a narrow
//   frontage (half a perch to three perches: about 3 to 10 squares) running back a long way, the house at the street end,
//   its yard and garden behind, and a back lane along the rear of the plots. Cross lanes run from the street to the back
//   lane every so often. Planned towns are near-regular; their streets keep to straight runs with a jog here and there.
// - Inside the wall a lane follows it (the intramural road); a gatehouse stands where each main road comes through.
// - Plots are cut along each frontage in turn (parcels from the street edge, like the OBB/skeleton subdivision of
//   Vanegas et al., but on the grid), each building generated to fit its plot.
// - Everything is deterministic: the town from its seed; each building from a seed hashed from the town's seed and its
//   plot, and stored with the town. So a building's inside can be dropped from the map when no one is near it and built
//   again, square for square, when someone comes back (town.js loads and unloads them on the GM's screen).
// Streets: "mixed" cobbles the main streets and the market place, the lanes stay earth; "stone" cobbles the lanes too;
// "dirt" leaves every street earth.

const TNT = { GRASS: 0, STREET: 1, LANE: 2, MARKET: 3, YARD: 4, BUILD: 5, WALL: 6, TOWER: 7, ROAD: 8, FIELD: 9, CHURCH: 10, GATEB: 11, RING: 12, PLAZA: 13, CROSS: 14 };
const TN_SIZES = {
  small: { Wi: 120, Hi: 90, band: 24, gates: 2, mk: [22, 14], D: [13, 17], name: "Small town" },
  medium: { Wi: 180, Hi: 140, band: 28, gates: 3, mk: [30, 18], D: [15, 20], name: "Town" },
  large: { Wi: 250, Hi: 200, band: 32, gates: 4, mk: [38, 24], D: [16, 22], name: "Large town" } };
const tnDefaults = () => ({ seed: genSeed(), size: "medium", walls: "auto", streets: "mixed", gates: "auto", names: true, furn: true });
const tnH = (...a) => { let h = 2166136261 >>> 0; a.forEach(v => { const s = String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= 0x9e; h = Math.imul(h, 16777619) >>> 0; }); return (h % 999999937) + 1; };
const TN_DIR = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }, TN_K = { S: 0, W: 1, N: 2, E: 3 }; // k turns a building so its front faces that way
const TN_BC = new Map();
// A building, with no furniture (the outside is all a town needs until someone goes in). Cached: the same plot, the same building.
function tnB(o) { const k = [o.type, o.seed, o.size].join("|"); let B = TN_BC.get(k);
  if (!B) { B = genBuilding(Object.assign({ floors: "auto", cellar: "auto", shape: "auto", porch: "no" }, o, { furn: false })); if (TN_BC.size > 3000) TN_BC.clear(); TN_BC.set(k, B); } return B; }
const tnBo = (type, seed, size, furn) => ({ type, seed, size, floors: "auto", cellar: "auto", shape: "auto", porch: "no", furn: furn !== false, furnRe: {} });
// A building's footprint turned to face f: its size on the map and the turn.
function tnTurn(B, f) { const k = TN_K[f]; return { k, w: k % 2 ? B.H : B.W, h: k % 2 ? B.W : B.H, tf: vgTurn(k, B.W, B.H) }; }
// The squares a building really stands on (its footprint turned), not the whole rectangle round it.
function tnCells(B, k, bx, by) { const tf = vgTurn(k, B.W, B.H), out = []; (B.F.body || new Set()).forEach(c => { const [x, y] = c.split(",").map(Number), [a, b] = tf(x, y), [d, e] = tf(x + 1, y + 1); out.push([bx + Math.min(a, d), by + Math.min(b, e)]); }); return out; }
function tnRectTurn(tf, r) { const [a, b] = tf(r.x, r.y), [c, d] = tf(r.x + r.w, r.y + r.h); return { x: Math.min(a, c), y: Math.min(b, d), w: Math.abs(c - a), h: Math.abs(d - b) }; }

// What goes where: [type, size weights small/medium/large].
const TN_ZONES = {
  market: [["merchant", 5], ["inn", 2], ["townhouse", 3], ["apothecary", 1], ["guild", 1]],
  main: [["townhouse", 6], ["merchant", 2], ["workshop", 3], ["apothecary", 1], ["tailor", 1], ["general", 1], ["house", 2], ["tavern", 1]],
  shambles: [["butcher", 6], ["townhouse", 1]],
  gate: [["inn", 4], ["tavern", 2], ["townhouse", 2], ["stable", 1]],
  lane: [["workshop", 4], ["house", 3], ["cottage", 3], ["carpenter", 2], ["blacksmith", 2], ["bakehouse", 1], ["stable", 1]],
  ring: [["cottage", 4], ["workshop", 3], ["blacksmith", 2], ["carpenter", 2], ["barn", 1]],
  suburb: [["cottage", 5], ["house", 2], ["barn", 2], ["blacksmith", 1], ["bakehouse", 1], ["inn", 1]] };
const tnPickW = (r, list) => { const t = list.reduce((a, [, w]) => a + w, 0); let x = r() * t; for (const [v, w] of list) { if ((x -= w) < 0) return v; } return list[0][0]; };

function genTown(o) {
  const SZ = TN_SIZES[o.size] || TN_SIZES.medium, r = genRng(o.seed), band = SZ.band, Wi = SZ.Wi, Hi = SZ.Hi, W = Wi + band * 2, H = Hi + band * 2;
  const G = new Uint8Array(W * H), ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H, at = (x, y) => ok(x, y) ? G[y * W + x] : 255, put = (x, y, v) => { if (ok(x, y)) G[y * W + x] = v; };
  const cx = Math.floor(W / 2) + genInt(r, -3, 3), cy = Math.floor(H / 2) + genInt(r, -3, 3);
  const walled = o.walls === "yes" ? true : o.walls === "no" ? false : (o.size !== "small" || r() < 0.4);
  // The town's edge: a rounded, slightly irregular oval (a superellipse wobbled by a few slow waves round it).
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3], radAt = a => 1 + 0.05 * Math.sin(2 * a + ph[0]) + 0.035 * Math.sin(3 * a + ph[1]) + 0.02 * Math.sin(5 * a + ph[2]);
  const IN = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x + 0.5 - cx) / (Wi / 2), dy = (y + 0.5 - cy) / (Hi / 2), R = radAt(Math.atan2(dy, dx)), p = 2.6;
    IN[y * W + x] = Math.pow(Math.abs(dx), p) + Math.pow(Math.abs(dy), p) <= Math.pow(R, p) ? 1 : 0; }
  const isIn = (x, y) => ok(x, y) && IN[y * W + x] === 1;
  // How far each square inside is from the edge (the wall is the outer 2, the lane inside it the next 3).
  const dist = new Int16Array(W * H).fill(-1), q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!IN[y * W + x]) continue; let edge = false; for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (!isIn(x + dx, y + dy)) { edge = true; break; } if (edge) { dist[y * W + x] = 0; q.push(y * W + x); } }
  for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (!isIn(nx, ny) || dist[ny * W + nx] >= 0) continue; dist[ny * W + nx] = dist[c] + 1; q.push(ny * W + nx); } }
  const dIn = (x, y) => ok(x, y) ? dist[y * W + x] : -1;
  if (walled) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = dIn(x, y); if (d >= 0 && d <= 1) put(x, y, TNT.WALL); else if (d >= 2 && d <= 4) put(x, y, TNT.RING); }
  // The market place, where the main streets meet.
  const mw = SZ.mk[0] + genInt(r, -2, 3), mh = SZ.mk[1] + genInt(r, -2, 2), M = { x: cx - Math.floor(mw / 2), y: cy - Math.floor(mh / 2), w: mw, h: mh };
  for (let y = M.y; y < M.y + M.h; y++) for (let x = M.x; x < M.x + M.w; x++) put(x, y, TNT.MARKET);
  // The main streets: out from the market to the gates and on as roads to the edge of the map; a jog or two along the way.
  const nG = o.gates && o.gates !== "auto" ? Math.max(2, Math.min(4, Number(o.gates))) : SZ.gates;
  const order = r() < 0.5 ? ["E", "W", "N", "S"] : ["N", "S", "E", "W"], gateDirs = order.slice(0, nG), dirs = order.filter(d => gateDirs.includes(d) || r() < 0.85);
  const streets = [], buildings = [], towers = [], gates = [], towerWall = [];
  dirs.forEach((d, si) => { const [ux, uy] = TN_DIR[d], horiz = !uy;
    const x0 = d === "E" ? M.x + M.w : d === "W" ? M.x - 1 : 0, y0 = d === "S" ? M.y + M.h : d === "N" ? M.y - 1 : 0;
    const c0 = horiz ? genInt(r, M.y + 3, M.y + M.h - 4) : genInt(r, M.x + 3, M.x + M.w - 4);
    const cellAt = (t, c) => horiz ? [x0 + ux * t, c] : [c, y0 + uy * t];
    let tEnd = 0; while (ok(...cellAt(tEnd, c0))) tEnd++; tEnd = Math.max(0, tEnd);
    let tW = -1; for (let t = 0; t < tEnd; t++) { const [x, y] = cellAt(t, c0); if (!isIn(x, y)) { tW = t; break; } } if (tW < 0) tW = tEnd;
    const tWall = walled ? (() => { for (let t = 0; t < tEnd; t++) if (dIn(...cellAt(t, c0)) === 1) return t; return tW - 2; })() : tW;
    // Jogs: inside (clear of the market and the gate) and outside (the road bends a little on its way out).
    const jogs = []; const addJogs = (a, b, n) => { for (let i = 0; i < n; i++) if (b - a > 16) jogs.push([genInt(r, a + 6, b - 6), (r() < 0.5 ? -1 : 1) * genInt(r, 1, 2)]); };
    addJogs(6, tWall - 10, genInt(r, 0, 2)); addJogs(tWall + 12, tEnd - 4, genInt(r, 0, 2)); jogs.sort((a, b) => a[0] - b[0]);
    const cAt = t => { let c = c0; jogs.forEach(([jt, dc]) => { if (t >= jt) c += dc; }); return Math.max(horiz ? 4 : 4, Math.min(horiz ? H - 5 : W - 5, c)); };
    const gated = gateDirs.includes(d); if (!gated) { let t = 0; while (t < tEnd) { const [x, y] = cellAt(t, c0); if (!isIn(x, y) || dIn(x, y) <= (walled ? 4 : 1)) break; t++; } tEnd = t; jogs.length = 0; jogs.push(...[]); }
    for (let t = 0; t < tEnd; t++) { const c = cAt(t); for (let j = -2; j <= 2; j++) { const [x, y] = cellAt(t, c + j), v = at(x, y);
      if (v === TNT.MARKET) continue; if (!gated && (v === TNT.RING || v === TNT.WALL)) continue; put(x, y, isIn(x, y) && dIn(x, y) > 1 ? TNT.STREET : isIn(x, y) && walled ? TNT.WALL : TNT.ROAD); } }
    streets.push({ d, horiz, ux, uy, x0, y0, c0, cAt, cellAt, tEnd, tW, tWall: gated ? tWall : tEnd + 3, jogs, shambles: false, gated });
    // The gatehouse where it goes through the wall: its gate passage on the street, its front to the outside.
    if (walled && gated) { const B = tnB({ type: "gatehouse", seed: tnH(o.seed, "gate", d), size: "large" }), T = tnTurn(B, d);
      const G0 = B.levels.find(L => L.level === 0), pr = G0.rooms.find(rm => rm.gate) || G0.rooms[0], pp = tnRectTurn(T.tf, pr), L = horiz ? T.w : T.h;
      const tb = Math.max(1, tWall - Math.floor((L - 2) / 2)), c = cAt(tWall), pw = horiz ? pp.h : pp.w, off = c - 2 + Math.floor((5 - pw) / 2);
      let bx, by; if (horiz) { bx = d === "E" ? x0 + tb : x0 - (tb + L - 1); by = off - pp.y; } else { by = d === "S" ? y0 + tb : y0 - (tb + L - 1); bx = off - pp.x; }
      const b = { id: "g" + si, type: "gatehouse", o: tnBo("gatehouse", tnH(o.seed, "gate", d), "large", o.furn), x: bx, y: by, k: T.k, w: T.w, h: T.h, front: d, zone: "gate", gate: { x: bx + pp.x, y: by + pp.y, w: pp.w, h: pp.h } };
      tnCells(B, T.k, bx, by).forEach(([x, y]) => put(x, y, TNT.GATEB));
      buildings.push(b); gates.push(b); }
  });
  // One street is the shambles: the butchers together.
  if (streets.length > 1) streets[Math.floor(r() * streets.length)].shambles = true;
  // The market hall in the market place, along its long side; and the market cross (a well in a small town).
  { const size = o.size === "small" ? "small" : o.size === "large" ? "large" : "medium", seed = tnH(o.seed, "hall"), B = tnB({ type: "markethall", seed, size });
    const f = M.w >= M.h ? (B.W >= B.H ? "S" : "E") : (B.W >= B.H ? "E" : "S"), T = tnTurn(B, f), side = r() < 0.5;
    const bx = side ? M.x + 4 : M.x + M.w - 4 - T.w, by = M.y + Math.floor((M.h - T.h) / 2);
    if (T.w <= M.w - 12 && T.h <= M.h - 7) { buildings.push({ id: "mh", type: "markethall", o: tnBo("markethall", seed, size, o.furn), x: bx, y: by, k: T.k, w: T.w, h: T.h, front: f, zone: "market" });
      tnCells(B, T.k, bx, by).forEach(([x, y]) => put(x, y, TNT.BUILD)); }
    const px = side ? M.x + M.w - 10 : M.x + 6, py = M.y + Math.floor(M.h / 2) - 2;
    for (let y = py; y < py + 4; y++) for (let x = px; x < px + 4; x++) if (at(x, y) === TNT.MARKET) put(x, y, TNT.PLAZA);
    var cross = { x: px + 1, y: py + 1, well: o.size === "small" }; }
  // Back lanes along the rear of the plots, and cross lanes from the street to them.
  const free = (x, y) => at(x, y) === TNT.GRASS && isIn(x, y), way = v => v === TNT.STREET || v === TNT.LANE || v === TNT.MARKET || v === TNT.RING || v === TNT.PLAZA;
  const carve = (x, y) => { if (free(x, y)) { put(x, y, TNT.LANE); return true; } return false; };
  const depthOf = new Map();
  streets.forEach(st => { [-1, 1].forEach(sd => { const D = genInt(r, SZ.D[0], SZ.D[1]); depthOf.set(st.d + sd, D);
    const tTo = (walled ? st.tWall - 3 : st.tW - 1); let any = false;
    for (let t = 0; t < tTo; t++) { const c = st.cAt(t), base = sd < 0 ? c - 2 - D - 3 : c + 3 + D; for (let j = 0; j < 3; j++) { const [x, y] = st.cellAt(t, base + j); if (carve(x, y)) any = true; } }
    // At a jog the lane jogs too.
    st.jogs.forEach(([jt, dc]) => { if (jt >= tTo) return; const c1 = st.cAt(jt - 1), c2 = st.cAt(jt), b1 = sd < 0 ? c1 - 2 - D - 3 : c1 + 3 + D, b2 = sd < 0 ? c2 - 2 - D - 3 : c2 + 3 + D;
      for (let cc = Math.min(b1, b2); cc <= Math.max(b1, b2) + 2; cc++) for (let k = -2; k <= 0; k++) { const [x, y] = st.cellAt(jt + k, cc); carve(x, y); } });
    // Inward past the market until it meets a street, the market or another lane.
    if (any) { const c = st.cAt(0), base = sd < 0 ? c - 2 - D - 3 : c + 3 + D;
      for (let t = -1; t > -90; t--) { let hit = false; for (let j = 0; j < 3; j++) { const [x, y] = st.cellAt(t, base + j); if (way(at(x, y))) hit = true; } if (hit) break;
        let stop = false; for (let j = 0; j < 3; j++) { const [x, y] = st.cellAt(t, base + j); if (!free(x, y) && !way(at(x, y))) stop = true; } if (stop) break;
        for (let j = 0; j < 3; j++) carve(...st.cellAt(t, base + j)); } }
    // Cross lanes (two squares wide) from the street to the back lane.
    for (let t = genInt(r, 10, 18); t < tTo - 6; t += genInt(r, 24, 38)) { const c = st.cAt(t); if (st.cAt(t + 1) !== c) continue;
      for (let j = 1; j <= D; j++) for (let k = 0; k < 2; k++) { const [x, y] = st.cellAt(t + k, sd < 0 ? c - 2 - j : c + 2 + j); carve(x, y); } } }); });
  // Side streets: every so often a street (3 wide) off a main street, out to the lane inside the wall, through the plots.
  streets.forEach(st => { const tTo = (walled ? st.tWall - 3 : st.tW - 1);
    for (let t = genInt(r, 16, 26); t < tTo - 12; t += genInt(r, 34, 50)) { const c = st.cAt(t); if (st.cAt(t + 3) !== c || st.cAt(t - 1) !== c) continue; const sd = r() < 0.5 ? -1 : 1;
      for (let j = 3; j < 400; j++) { let stop = false; for (let k = 0; k < 3; k++) { const [x, y] = st.cellAt(t + k, sd < 0 ? c - j : c + j), v = at(x, y);
          if (!isIn(x, y) || v === TNT.RING || v === TNT.WALL || v === TNT.STREET || v === TNT.MARKET || v === TNT.GATEB || v === 255) stop = true; }
        if (stop) break; for (let k = 0; k < 3; k++) { const [x, y] = st.cellAt(t + k, sd < 0 ? c - j : c + j); if (at(x, y) === TNT.GRASS || at(x, y) === TNT.LANE) put(x, y, TNT.LANE); } } } });
  // The parish church in its churchyard, off the market, its door toward it, a path out to the nearest street.
  let church = null;
  { const seed = tnH(o.seed, "church"); let best = null, size = null, B = null;
    // The biggest church that has room, nearest the market (a smaller one, a narrower churchyard, if a big one won't fit).
    for (const [sz, mg] of o.size === "small" ? [["medium", 3], ["small", 2]] : [["large", 3], ["medium", 3], ["medium", 2], ["small", 2]]) { if (best) break; size = sz; B = tnB({ type: "temple", seed, size });
    for (let y = band; y < H - band; y += 2) for (let x = band; x < W - band; x += 2) { const ccx = x, ccy = y, dx = cx - ccx, dy = cy - ccy, f = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N"), T = tnTurn(B, f);
      const R = { x: x - mg, y: y - mg, w: T.w + mg * 2, h: T.h + mg * 2 }; let fits = true;
      for (let yy = R.y; yy < R.y + R.h && fits; yy++) for (let xx = R.x; xx < R.x + R.w; xx++) if (!free(xx, yy) || dIn(xx, yy) < (walled ? 7 : 3)) { fits = false; break; }
      if (!fits) continue; const sc = Math.hypot(x + T.w / 2 - cx, y + T.h / 2 - cy); if (!best || sc < best.sc) best = { sc, x, y, f, T, R }; } }
    if (best) { const { x, y, f, T, R } = best; for (let yy = R.y; yy < R.y + R.h; yy++) for (let xx = R.x; xx < R.x + R.w; xx++) put(xx, yy, TNT.CHURCH);
      tnCells(B, T.k, x, y).forEach(([xx, yy]) => put(xx, yy, TNT.BUILD));
      const b = { id: "ch", type: "temple", o: tnBo("temple", seed, size, o.furn), x, y, k: T.k, w: T.w, h: T.h, front: f, zone: "church" }; buildings.push(b); church = { R, b };
      // The path: from the middle of the front of the churchyard, out until it meets a way.
      const [ux, uy] = TN_DIR[f], mx = x + Math.floor(T.w / 2) - (uy ? 1 : 0), my = y + Math.floor(T.h / 2) - (ux ? 1 : 0);
      let px = ux > 0 ? R.x + R.w : ux < 0 ? R.x - 1 : mx, py = uy > 0 ? R.y + R.h : uy < 0 ? R.y - 1 : my;
      for (let i = 0; i < 80; i++) { const cells = ux ? [[px, py], [px, py + 1]] : [[px, py], [px + 1, py]]; if (cells.some(([a, b2]) => way(at(a, b2)))) break; if (cells.some(([a, b2]) => !free(a, b2))) break; cells.forEach(([a, b2]) => put(a, b2, TNT.LANE)); px += ux; py += uy; } } }
  // ----- The plots: along each frontage in turn (the market's sides first, then the main streets, the lanes, the lane inside
  // the wall, then out along the roads), each building made for the plot and turned to face its way; terraces mostly on the
  // streets (a gap of 2 now and then, a ginnel through to the yards), houses standing apart on the lanes and outside.
  const gateNear = (x, y) => gates.some(g => Math.hypot(g.x + g.w / 2 - x, g.y + g.h / 2 - y) < 28);
  const streetOf = (x, y) => streets.find(st => { for (let t = 0; t < st.tEnd; t += 1) { const [sx, sy] = st.cellAt(t, st.cAt(t)); if (Math.abs(sx - x) + Math.abs(sy - y) < 5) return true; } return false; });
  let slot = 0;
  const place = (wayTypes, zoneOf, opts) => {
    for (const f of ["S", "N", "E", "W"]) { const [fx, fy] = TN_DIR[f]; // the building's front faces f: the way is on that side
      const lines = fx ? W : H, len = fx ? H : W;
      for (let ln = 0; ln < lines; ln++) { let i = 0;
        const cellOf = j => fx ? [ln, j] : [j, ln]; // the square of the building's front row at position j along the line
        const wayOK = j => { const [x, y] = cellOf(j); return wayTypes.includes(at(x + fx, y + fy)); };
        let run = 0;
        while (i < len) { const [x, y] = cellOf(i); if (!(opts.outside ? (at(x, y) === TNT.GRASS && !isIn(x, y)) : free(x, y)) || !wayOK(i)) { i++; run = 0; continue; }
          // The way runs on from here: how far?
          let end = i; while (end < len && wayOK(end)) { const [a, b2] = cellOf(end); if (!(opts.outside ? (at(a, b2) === TNT.GRASS && !isIn(a, b2)) : free(a, b2))) break; end++; }
          const zone = zoneOf(x, y, f); let placed = null;
          for (let tries = 0; tries < 4 && !placed; tries++) { slot++; const rr = genRng(tnH(o.seed, "plot", f, ln, i, tries)), type = tnPickW(rr, TN_ZONES[zone] || TN_ZONES.main);
            if (!genType(type) || genType(type).id !== type) continue;
            const size = tnPickW(rr, zone === "market" ? [["medium", 3], ["large", 2]] : zone === "suburb" || zone === "ring" ? [["small", 3], ["medium", 1]] : [["small", 2], ["medium", 3], ["large", 1]]);
            const seed = tnH(o.seed, "b", f, ln, i, tries), B = tnB({ type, seed, size }), T = tnTurn(B, f), fw = fx ? T.h : T.w, fd = fx ? T.w : T.h;
            if (fd > opts.maxD || i + fw > end) continue;
            // The rectangle behind the front row, all free.
            const bx = fx > 0 ? ln - fd + 1 : fx < 0 ? ln : i, by = fy > 0 ? ln - fd + 1 : fy < 0 ? ln : i;
            let fits = true; for (let yy = by; yy < by + T.h && fits; yy++) for (let xx = bx; xx < bx + T.w; xx++) if (!(opts.outside ? (at(xx, yy) === TNT.GRASS && !isIn(xx, yy)) : free(xx, yy))) { fits = false; break; }
            if (!fits) continue;
            placed = { id: "b" + buildings.length, type, o: tnBo(type, seed, size, o.furn), x: bx, y: by, k: T.k, w: T.w, h: T.h, front: f, zone };
            for (let yy = by; yy < by + T.h; yy++) for (let xx = bx; xx < bx + T.w; xx++) put(xx, yy, TNT.YARD); tnCells(B, T.k, bx, by).forEach(([xx, yy]) => put(xx, yy, TNT.BUILD));
            buildings.push(placed); i += fw; run++;
            // The gap to the next: none (a terrace) mostly on the streets, 2 squares (a ginnel) every few houses; houses apart elsewhere.
            const gap = opts.terrace ? (run >= genInt(rr, 3, 6) || rr() < 0.15 ? 2 : 0) : genInt(rr, 2, 4); if (gap) run = 0; i += gap; }
          if (!placed) i++; } } } };
  const mainZone = (x, y) => { const st = streetOf(x, y); return gateNear(x, y) ? "gate" : st && st.shambles && Math.hypot(x - cx, y - cy) < 60 ? "shambles" : "main"; };
  place([TNT.MARKET, TNT.PLAZA], () => "market", { maxD: 22, terrace: true });
  place([TNT.STREET], mainZone, { maxD: 22, terrace: true });
  place([TNT.LANE], (x, y) => gateNear(x, y) ? "gate" : "lane", { maxD: 16, terrace: true });
  if (walled) place([TNT.RING], () => "ring", { maxD: 12, terrace: false });
  // Outside the walls: a few houses along the roads by the gates, then the town fields.
  { const nearGateRoad = (x, y) => gates.length ? gateNear(x, y) : Math.hypot(x - cx, y - cy) < Math.max(Wi, Hi) / 2 + 26;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === TNT.GRASS && !isIn(x, y) && !nearGateRoad(x, y)) put(x, y, 200); // not here
    place([TNT.ROAD], () => "suburb", { maxD: 12, terrace: false, outside: true });
    for (let i = 0; i < W * H; i++) if (G[i] === 200) G[i] = TNT.GRASS; }
  // Fields: furlongs in the land round the town, as in the villages: four corners set inside a patch of clear ground (moved in
  // until nothing's in the way), the edges rounded off, strips across it at its own angle, a hedge round it.
  const fields = []; { const FS = 20, clearC = (x, y) => { if (!(at(x, y) === TNT.GRASS && !isIn(x, y))) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = at(x + dx, y + dy); if (v === TNT.ROAD || v === TNT.BUILD || v === TNT.WALL || v === TNT.GATEB || v === TNT.TOWER || (v !== 255 && isIn(x + dx, y + dy) && dIn(x + dx, y + dy) < 1)) return false; } return true; };
    const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    // Corners rounded off only a little (a plough turns at the headland), the sides kept straight.
    const round = P => { let Q = P; for (let k = 0; k < 2; k++) { const R = [], f = k ? 0.25 : 0.1; Q.forEach((a, i) => { const b = Q[(i + 1) % Q.length]; R.push([a[0] * (1 - f) + b[0] * f, a[1] * (1 - f) + b[1] * f], [a[0] * f + b[0] * (1 - f), a[1] * f + b[1] * (1 - f)]); }); Q = R; } return Q; };
    for (let by = 0; by < H; by += FS) for (let bx = 0; bx < W; bx += FS) { if (r() < 0.15) continue;
      const bw = Math.min(FS, W - bx), bh = Math.min(FS, H - by); if (bw < 10 || bh < 10) continue;
      // The four corners, each pulled in toward the middle until the furlong is all on clear ground.
      const mx = bx + bw / 2, my = by + bh / 2, C = [[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]].map(([x, y]) => [x + (mx - x) * (0.04 + r() * 0.06) + (r() - 0.5) * 2, y + (my - y) * (0.04 + r() * 0.06) + (r() - 0.5) * 2]);
      let poly = null, cells = null;
      for (let k = 0; k < 8 && !poly; k++) { const P = round(C.map(([x, y]) => [x + (mx - x) * k * 0.08, y + (my - y) * k * 0.08])), cs = [];
        let bad = false; for (let y = by - 2; y < by + bh + 2 && !bad; y++) for (let x = bx - 2; x < bx + bw + 2; x++) { if (!inPoly(P, x + 0.5, y + 0.5)) continue; if (!clearC(x, y)) { bad = true; break; } cs.push([x, y]); }
        if (!bad && cs.length >= 40) { poly = P; cells = cs; } }
      if (!poly) continue; cells.forEach(([x, y]) => put(x, y, TNT.FIELD));
      const e = [C[1][0] - C[0][0], C[1][1] - C[0][1]], ang = Math.atan2(e[1], e[0]) * 180 / Math.PI + (r() < 0.5 ? 0 : 90);
      fields.push({ x: bx, y: by, w: bw, h: bh, cells, poly, ang, c: [mx, my], crop: ["wheat", "barley", "fallow", "wheat"][Math.floor(r() * 4)] }); } }
  // Towers along the wall, about every 22 squares round it, clear of the gates.
  if (walled) { const rim = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === TNT.WALL && dIn(x, y) === 0) rim.push([x, y]);
    rim.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    let last = null; rim.forEach(([x, y]) => { if (last && Math.hypot(x - last[0], y - last[1]) < 22) return; if (gates.some(g => x > g.x - 6 && x < g.x + g.w + 6 && y > g.y - 6 && y < g.y + g.h + 6)) return;
      if (towers.length && Math.hypot(x - towers[0].x, y - towers[0].y) < 16) return;
      // A round tower, 4 across, standing out from the wall.
      // Centred on the wall: halfway between its outer and inner squares here.
      let ix = 0, iy = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (dIn(x + dx, y + dy) === 1) { ix += dx; iy += dy; }
      const tcx = x + 0.5 + Math.sign(ix) * 0.5, tcy = y + 0.5 + Math.sign(iy) * 0.5, tx = Math.round(tcx - 2), ty = Math.round(tcy - 2);
      let fits = true; for (let yy = ty; yy < ty + 4; yy++) for (let xx = tx; xx < tx + 4; xx++) { const v = at(xx, yy); if (!(v === TNT.WALL || v === TNT.GRASS || v === TNT.FIELD || v === TNT.RING)) fits = false; }
      if (!fits) return; for (let yy = ty; yy < ty + 4; yy++) for (let xx = tx; xx < tx + 4; xx++) if (!(at(xx, yy) === TNT.RING && dIn(xx, yy) >= 2)) { if (at(xx, yy) === TNT.WALL) towerWall.push(yy * W + xx); put(xx, yy, TNT.TOWER); }
      towers.push({ x: tx, y: ty, cx: tcx, cy: tcy }); last = [x, y]; }); }
  // The rest of the town's ground is yards and gardens.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === TNT.GRASS && isIn(x, y)) put(x, y, TNT.YARD);
  const T = { o, W, H, G, IN, dist, cx, cy, M, walled, streets: streets.map(st => ({ d: st.d, horiz: st.horiz, ux: st.ux, uy: st.uy, x0: st.x0, y0: st.y0, tEnd: st.tEnd, tW: st.tW, cs: Array.from({ length: st.tEnd }, (_, t) => st.cAt(t)) })), buildings, towers, towerWall: new Set(towerWall), gates, church, cross, fields, size: o.size, seed: o.seed };
  tnAccess(T); return T;
}
// Can a 2×2 creature get to every door and every yard, and a 3×6 wagon from every road in to the market? Where a yard is
// shut in, the smallest building between it and the street makes way (the plot becomes a gap through).
function tnAccess(T) {
  const { W, H, G } = T, at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 255 : G[y * W + x];
  const passage = new Set(); T.gates.forEach(g => { for (let y = g.gate.y; y < g.gate.y + g.gate.h; y++) for (let x = g.gate.x; x < g.gate.x + g.gate.w; x++) passage.add(x + "," + y); });
  const pass = (x, y) => { const v = at(x, y); return v !== 255 && v !== TNT.BUILD && v !== TNT.WALL && v !== TNT.TOWER && (v !== TNT.GATEB || passage.has(x + "," + y)) && v !== TNT.CROSS; };
  const reach = n => { const seen = new Uint8Array(W * H), q = [], fit = (x, y) => { for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) if (!pass(x + a, y + b)) return false; return true; };
    const sx = T.M.x + 1, sy = T.M.y + 1; for (let y = T.M.y; y < T.M.y + T.M.h; y++) for (let x = T.M.x; x < T.M.x + T.M.w; x++) if (fit(x, y)) { seen[y * W + x] = 1; q.push(y * W + x); break; }
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !fit(nx, ny)) continue; seen[ny * W + nx] = 1; q.push(ny * W + nx); } }
    const cover = new Uint8Array(W * H); for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) cover[(y + b) * W + x + a] = 1; } return cover; };
  let cover = reach(2);
  for (let round = 0; round < 40; round++) {
    // Squares of yard that no 2×2 can stand on are left out (slivers by a wall); a patch of yard 2×2 wide that's shut in counts.
    const shut = []; for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { if (cover[y * W + x]) continue; const v = at(x, y); if (v !== TNT.YARD && v !== TNT.CHURCH && v !== TNT.GRASS) continue; if (pass(x + 1, y) && pass(x, y + 1) && pass(x + 1, y + 1) && !cover[y * W + x + 1] && !cover[(y + 1) * W + x]) shut.push([x, y]); }
    if (!shut.length) break;
    // The building beside the first shut-in patch that also stands by somewhere reached: the smallest one goes.
    const [sx, sy] = shut[0]; let best = null;
    T.buildings.forEach((b, i) => { if (b.gate || b.zone === "church" || b.type === "markethall") return; const near = (x, y, m) => x >= b.x - m && x < b.x + b.w + m && y >= b.y - m && y < b.y + b.h + m;
      if (!near(sx, sy, 30)) return; let touchShut = false, touchReach = false;
      for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) { if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) continue; if (y < 0 || x < 0 || x >= W || y >= H) continue; if (cover[y * W + x]) touchReach = true; else if (pass(x, y)) touchShut = true; }
      if (touchShut && touchReach) { const d = Math.hypot(b.x + b.w / 2 - sx, b.y + b.h / 2 - sy) + b.w * b.h * 0.05; if (!best || d < best.d) best = { d, i }; } });
    if (!best) { for (const [x, y] of shut.slice(0, 1)) G[y * W + x] = TNT.GRASS; T.shutIn = (T.shutIn || 0) + 1; break; }
    const b = T.buildings[best.i]; for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) G[y * W + x] = TNT.YARD; T.buildings.splice(best.i, 1); T.cleared = (T.cleared || 0) + 1;
    cover = reach(2); }
  // Last: every building's way in must open where a 2×2 can stand; any that doesn't (where a lane pinches) is left out.
  for (let k = 0; k < 3; k++) { const bad = T.buildings.filter(b => !b.gate && b.type !== "markethall" && b.zone !== "church" && !tnDoorCells(b).some(([x, y]) => cover[y * W + x]));
    if (!bad.length) break; bad.forEach(b => { tnCells(tnB(b.o), b.k, b.x, b.y).forEach(([x, y]) => { G[y * W + x] = T.IN[y * W + x] ? TNT.YARD : TNT.GRASS; }); T.buildings.splice(T.buildings.indexOf(b), 1); T.cleared = (T.cleared || 0) + 1; }); cover = reach(2); }
  T.reach2 = cover; T.wagon = reach(3); T.passage = passage;
}
// The squares just outside a building's outside doors (on the map).
function tnDoorCells(b) { const B = tnB(b.o), L = B.levels.find(q => q.level === 0), tf = vgTurn(b.k, B.W, B.H), out = [];
  L.doors.forEach(k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v), [p, q] = d === "h" ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]], ip = L.own(...p), iq = L.own(...q);
    if ((ip < 0) === (iq < 0)) return; const [cx, cy] = ip < 0 ? p : q, [a, c] = tf(cx, cy), [e, f] = tf(cx + 1, cy + 1); out.push([b.x + Math.min(a, e), b.y + Math.min(c, f)]); });
  return out; }

// ----- Drawing the town's ground -----
function tnTerrainSvg(T, s, vb) {
  const { W, H, G } = T, at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 255 : G[y * W + x], box = vb || [0, 0, W, H], fine = s >= 14, o = T.o || {};
  const x0 = Math.max(0, Math.floor(box[0]) - 2), x1 = Math.min(W, Math.ceil(box[0] + box[2]) + 2), y0 = Math.max(0, Math.floor(box[1]) - 2), y1 = Math.min(H, Math.ceil(box[1] + box[3]) + 2);
  const inBox = (x, y, w, h, m) => x + w >= box[0] - (m || 0) && y + h >= box[1] - (m || 0) && x <= box[0] + box[2] + (m || 0) && y <= box[1] + box[3] + (m || 0);
  const out = [], sq = (x, y, k) => genRng(((x * 73856093) ^ (y * 19349663) ^ ((k || 1) * 83492791) ^ (T.seed || 1)) >>> 0), nz = vgNoise(31 + (T.seed % 97));
  const paved = v => o.streets === "dirt" ? false : v === TNT.STREET || v === TNT.MARKET || (o.streets === "stone" && (v === TNT.LANE || v === TNT.RING));
  const dirtV = v => (v === TNT.STREET || v === TNT.MARKET || v === TNT.LANE || v === TNT.RING || v === TNT.ROAD) && !paved(v), solid = v => v === TNT.BUILD || v === TNT.GATEB || v === TNT.WALL || v === TNT.TOWER;
  // A strip of grass one square wide between a way and a building is trodden earth (no grass shows between them).
  const apron = new Set(); for (let y = y0 - 1; y < y1 + 1; y++) for (let x = x0 - 1; x < x1 + 1; x++) { const v = at(x, y); if (!(v === TNT.GRASS || v === TNT.YARD || v === TNT.CHURCH)) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const a = at(x - dx, y - dy), b = at(x + dx, y + dy); if ((dirtV(a) && solid(b)) || (dirtV(b) && solid(a))) apron.add(y * W + x); } }
  const APRON = 254, atD = (x, y) => apron.has(y * W + x) ? APRON : at(x, y), dirt = v => v === APRON || dirtV(v);
  // Run-length paths of the squares of a kind, in this window.
  const runs = test => { let d = ""; for (let y = y0; y < y1; y++) { let x = x0; while (x < x1) { if (!test(atD(x, y), x, y)) { x++; continue; } let e = x; while (e < x1 && test(atD(e, y), e, y)) e++; d += `M${x * s} ${y * s}h${(e - x) * s}v${s}h${-(e - x) * s}z`; x = e; } } return d; };
  // The ground: grass, yards and churchyard a little different, blended.
  out.push(`<rect x="${(box[0] - 2) * s}" y="${(box[1] - 2) * s}" width="${(box[2] + 4) * s}" height="${(box[3] + 4) * s}" fill="hsl(95 32% 42%)"/>`);
  { let d = ""; const COL = { [TNT.YARD]: [92, 30, 40], [TNT.CHURCH]: [100, 30, 38], [TNT.GRASS]: [95, 32, 42], [TNT.FIELD]: [70, 30, 44] };
    out.push(`<filter id="tnbl" filterUnits="userSpaceOnUse" x="${(box[0] - 8) * s}" y="${(box[1] - 8) * s}" width="${(box[2] + 16) * s}" height="${(box[3] + 16) * s}"><feGaussianBlur stdDeviation="${(s * 1.6).toFixed(2)}"/></filter><g filter="url(#tnbl)">`);
    for (let y = Math.max(0, y0 - 5); y < Math.min(H, y1 + 5); y++) for (let x = Math.max(0, x0 - 5); x < Math.min(W, x1 + 5); x++) { const c = COL[at(x, y)] || COL[TNT.GRASS], v = nz(x / 7, y / 7, 3); d += `<rect x="${x * s}" y="${y * s}" width="${s + 0.5}" height="${s + 0.5}" fill="hsl(${c[0]} ${c[1]}% ${(c[2] + (v - 0.5) * 8).toFixed(1)}%)"/>`; }
    out.push(d + `</g>`); }
  // Grass close up: patches, tufts, a flower or two; each square its own scatter, so tiles meet without seams.
  { let patches = "", tufts = ""; const GR = new Set([TNT.GRASS, TNT.YARD, TNT.CHURCH]);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (!GR.has(at(x, y))) continue; const rr = sq(x, y);
      if (rr() < 0.4) patches += `<ellipse cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" rx="${(s * (0.5 + rr() * 1.6)).toFixed(1)}" ry="${(s * (0.4 + rr() * 1.1)).toFixed(1)}" fill="hsl(${(88 + rr() * 20).toFixed(0)} ${(20 + rr() * 15).toFixed(0)}% ${(34 + rr() * 16).toFixed(0)}%)" opacity="${(0.25 + rr() * 0.3).toFixed(2)}"/>`;
      if (!fine) continue; const k = s / 40; for (let i = 0, n = 1 + (rr() < 0.5 ? 1 : 0); i < n; i++) { const px = (x + rr()) * s, py = (y + rr()) * s, z = (3 + rr() * 4) * k; for (let j = 0; j < 3; j++) { const a = -0.6 + j * 0.6 + (rr() - 0.5) * 0.4; tufts += `M${px.toFixed(1)} ${py.toFixed(1)}l${(Math.sin(a) * z).toFixed(1)} ${(-Math.cos(a) * z).toFixed(1)}`; } }
      if (rr() < 0.03) patches += `<circle cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" r="${((1.5 + rr() * 1.5) * k).toFixed(1)}" fill="${["#e8d25a", "#e9e4f0", "#c86a8a"][Math.floor(rr() * 3)]}" opacity=".85"/>`; }
    out.push(patches); if (tufts) out.push(`<path d="${tufts}" stroke="hsl(92 32% 30%)" stroke-width="${Math.max(0.8, s * 0.03)}" stroke-linecap="round" fill="none" opacity=".8"/>`); }
  // Fields: strips across each block.
  const crop = { wheat: ["#c9a94a", "#b8963c"], barley: ["#a9b45a", "#98a24c"], fallow: ["#8a7048", "#7a6240"] };
  T.fields.forEach((f, i) => { if (!inBox(f.x, f.y, f.w, f.h, 2)) return; const c = crop[f.crop] || crop.wheat, id = `tnf${i}`, sw = 1.5 * s;
    out.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${sw * 2}" height="${sw * 2}" patternTransform="rotate(${f.ang.toFixed(2)})"><rect width="${sw * 2}" height="${sw}" fill="${c[0]}"/><rect y="${sw}" width="${sw * 2}" height="${sw}" fill="${c[1]}"/><path d="M0 ${sw}h${sw * 2}" stroke="rgba(60,45,20,.3)" stroke-width="${Math.max(1, s * 0.06)}"/></pattern>`);
    out.push(`<path d="M${f.poly.map(([x, y]) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`).join("L")}Z" fill="url(#${id})" stroke="#5d4a2c" stroke-opacity=".5" stroke-width="${Math.max(1, s * 0.14)}" stroke-linejoin="round"/>`); });
  // Gardens behind the houses: rows of beds; fences down the sides of each plot; a fruit tree here and there.
  { let beds = "", fence = "", trees = ""; const yard = (x, y) => at(x, y) === TNT.YARD;
    T.buildings.forEach(b => { if (b.gate || b.zone === "church" || b.zone === "market" && b.type === "markethall" || !inBox(b.x, b.y, b.w, b.h, 26)) return; const [fx, fy] = TN_DIR[b.front], bx = -fx, by = -fy, rr = genRng(tnH(T.seed, "garden", b.id));
      // How deep the yard runs behind the house (until a lane or another plot).
      let depth = 0; const across = fx ? b.h : b.w; for (let d2 = 1; d2 <= 20; d2++) { let all = true; for (let j = 0; j < across; j++) { const x = fx ? (bx > 0 ? b.x + b.w - 1 + d2 : b.x - d2) : b.x + j, y = fy ? (by > 0 ? b.y + b.h - 1 + d2 : b.y - d2) : b.y + j; if (!yard(x, y)) { all = false; break; } } if (!all) break; depth = d2; }
      if (depth >= 1) { // fences on the plot's sides, posts every square
        const sides = fx ? [[b.y, 0], [b.y + b.h, 0]] : [[b.x, 0], [b.x + b.w, 0]];
        sides.forEach(([c]) => { const a = fx ? (bx > 0 ? b.x + b.w : b.x) : (by > 0 ? b.y + b.h : b.y), e = a + (fx ? bx : by) * depth;
          fence += fx ? `M${a * s} ${c * s}H${e * s}` : `M${c * s} ${a * s}V${e * s}`; }); }
      if (depth >= 3 && b.zone !== "suburb") { const n = Math.min(5, Math.floor((across - 1) / 2)), len = Math.min(depth - 1, 6), st = fx ? b.y : b.x;
        for (let k2 = 0; k2 < n; k2++) { const c = st + 1 + k2 * 2, a = fx ? (bx > 0 ? b.x + b.w + 1 : b.x - 1 - len) : (by > 0 ? b.y + b.h + 1 : b.y - 1 - len);
          if (rr() < 0.25) continue; beds += fx ? `<rect x="${a * s}" y="${(c + 0.2) * s}" width="${len * s}" height="${0.6 * s}" rx="${0.3 * s}"/>` : `<rect x="${(c + 0.2) * s}" y="${a * s}" width="${0.6 * s}" height="${len * s}" rx="${0.3 * s}"/>`; } }
      if (depth >= 6 && rr() < 0.55) { const t = 4 + rr() * (depth - 5), j = 1 + rr() * (across - 2), x = fx ? (bx > 0 ? b.x + b.w + t : b.x - t) : b.x + j, y = fy ? (by > 0 ? b.y + b.h + t : b.y - t) : b.y + j, rad = 1 + rr() * 0.6;
        trees += `<circle cx="${(x + 0.3) * s}" cy="${(y + 0.4) * s}" r="${rad * s}" fill="rgba(20,30,10,.35)"/><circle cx="${x * s}" cy="${y * s}" r="${rad * s}" fill="hsl(${100 + rr() * 20} 35% ${26 + rr() * 8}%)"/><circle cx="${(x - rad * 0.3) * s}" cy="${(y - rad * 0.3) * s}" r="${rad * 0.55 * s}" fill="hsl(${95 + rr() * 20} 40% ${34 + rr() * 8}%)" opacity=".8"/>`; } });
    if (beds) out.push(`<g fill="#6b5536" opacity=".42">${beds}</g>`);
    if (fence && s >= 4) out.push(`<path d="${fence}" stroke="#6a4f32" stroke-width="${Math.max(1, s * 0.08)}" fill="none" opacity=".85"/>${s >= 14 ? `<path d="${fence}" stroke="#4a3522" stroke-width="${s * 0.16}" stroke-dasharray="${s * 0.16} ${s * 0.84}" fill="none"/>` : ""}`);
    out.push(trees); }
  // The churchyard: a low wall round it, the graves.
  if (T.church && inBox(T.church.R.x, T.church.R.y, T.church.R.w, T.church.R.h, 2)) { const R = T.church.R, rr = genRng(tnH(T.seed, "graves")); let g = "";
    for (let i = 0; i < R.w * R.h * 0.12; i++) { const x = R.x + 0.6 + rr() * (R.w - 1.6), y = R.y + 0.6 + rr() * (R.h - 1.6); if (at(Math.floor(x), Math.floor(y)) !== TNT.CHURCH || at(Math.floor(x + 0.4), Math.floor(y + 0.5)) !== TNT.CHURCH) continue;
      g += `<rect x="${(x * s).toFixed(1)}" y="${(y * s).toFixed(1)}" width="${(s * 0.32).toFixed(1)}" height="${(s * 0.46).toFixed(1)}" rx="${(s * 0.12).toFixed(1)}" fill="#a8a29a" stroke="#3a3530" stroke-width="${Math.max(0.6, s * 0.04)}"/>`; }
    out.push(g + `<rect x="${R.x * s + s * 0.1}" y="${R.y * s + s * 0.1}" width="${R.w * s - s * 0.2}" height="${R.h * s - s * 0.2}" fill="none" stroke="#8d8478" stroke-width="${s * 0.2}"/>`); }
  // Earth: the roads, lanes and any unpaved street as one patch of packed earth, the edges wandering a little.
  // (Under the edges of the cobbles, the houses and the wall too, so the earth meets them with no gap.)
  const nearDirt = (x, y) => { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (dirt(atD(x + a, y + b))) return true; return false; };
  const under = v => paved(v) || v === TNT.PLAZA || v === TNT.BUILD || v === TNT.GATEB || v === TNT.WALL || v === TNT.TOWER;
  { const d = runs((v, x, y) => dirt(v) || (under(v) && nearDirt(x, y))); if (d) {
    const fx = (box[0] - 12) * s, fy = (box[1] - 12) * s, fw = (box[2] + 24) * s, fh = (box[3] + 24) * s;
    out.push(`<filter id="tnrd" filterUnits="userSpaceOnUse" x="${fx}" y="${fy}" width="${fw}" height="${fh}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${(0.55 / s).toFixed(5)}" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${(s * 0.45).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="${(s * 0.4).toFixed(2)}"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 14 -6.5"/></filter>`);
    out.push(`<g filter="url(#tnrd)"><path d="${d}" fill="hsl(34 30% 56%)"/></g>`);
    let pb = "", ruts = ""; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (!dirt(atD(x, y))) continue; const rr = sq(x, y, 3);
      if (rr() < 0.5) pb += `<ellipse cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" rx="${(s * (0.3 + rr() * 0.7)).toFixed(1)}" ry="${(s * (0.2 + rr() * 0.5)).toFixed(1)}" fill="hsl(${30 + rr() * 8} ${22 + rr() * 12}% ${44 + rr() * 16}%)" opacity=".45"/>`;
      if (fine) for (let i = 0; i < 3; i++) pb += `<circle cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" r="${(0.8 + rr() * 1.8).toFixed(1)}" fill="hsl(30 ${10 + rr() * 15}% ${40 + rr() * 25}%)" opacity=".8"/>`; }
    out.push(pb); } }
  // Cobbles: rounded stones of many shades, set close; a gutter down the middle of each street, ruts worn smoother.
  { const d = runs(v => paved(v) || v === TNT.PLAZA); if (d) { const P = 4 * s, rr = genRng(77); let st = "";
    // Rows of stones that exactly fill the tile (and wrap round its edge), so the pattern has no seams.
    const nr = 12, rh = P / nr; for (let row = 0; row < nr; row++) { const ws = []; let tot = 0; while (tot < P) { const w = s * (0.26 + rr() * 0.16); ws.push(w); tot += w; } const k = P / tot; let xx = rr() * s * 0.3;
      ws.forEach(w0 => { const w = w0 * k, h = rh * (0.86 + rr() * 0.1), l = 36 + rr() * 24, col = `hsl(${(26 + rr() * 16).toFixed(0)} ${(5 + rr() * 10).toFixed(0)}% ${l.toFixed(0)}%)`, yy = row * rh + (rh - h) / 2 + (rr() - 0.5) * rh * 0.08;
        for (const off of [0, -P]) { const x = xx + off; if (x + w < 0 || x > P) continue; st += `<rect x="${(x + 0.8).toFixed(1)}" y="${(yy + 0.5).toFixed(1)}" width="${(w - 1.6).toFixed(1)}" height="${(h - 1).toFixed(1)}" rx="${(h * 0.42).toFixed(1)}" fill="${col}"/><rect x="${(x + w * 0.22).toFixed(1)}" y="${(yy + h * 0.18).toFixed(1)}" width="${(w * 0.4).toFixed(1)}" height="${(h * 0.22).toFixed(1)}" rx="${(h * 0.1).toFixed(1)}" fill="#fff" opacity=".08"/>`; }
        xx += w; }); }
    out.push(`<pattern id="tncb" patternUnits="userSpaceOnUse" width="${P}" height="${P}"><rect width="${P}" height="${P}" fill="#4f463c"/>${st}</pattern><clipPath id="tncp"><path d="${d}"/></clipPath>`);
    out.push(`<path d="${d}" fill="url(#tncb)"/>`);
    // Mud and straw in the cracks, the odd darker patch: by square, so tiles agree.
    let mud = ""; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = at(x, y); if (!paved(v)) continue; const rr2 = sq(x, y, 9); if (rr2() < 0.35) mud += `<ellipse cx="${((x + rr2()) * s).toFixed(1)}" cy="${((y + rr2()) * s).toFixed(1)}" rx="${(s * (0.4 + rr2() * 0.9)).toFixed(1)}" ry="${(s * (0.3 + rr2() * 0.6)).toFixed(1)}" fill="hsl(${28 + rr2() * 10} 25% ${30 + rr2() * 14}%)" opacity="${(0.18 + rr2() * 0.2).toFixed(2)}"/>`; }
    // Along each street: the kennel (the gutter) in the middle, and two smoother wheel tracks.
    let gut = "", rut = ""; T.streets.forEach(st2 => { for (let t = 0; t < st2.tEnd; t++) { const c = st2.cs[t], [x, y] = st2.horiz ? [st2.x0 + st2.ux * t, c] : [c, st2.y0 + st2.uy * t]; if (x < x0 - 1 || x > x1 || y < y0 - 1 || y > y1 || !paved(at(x, y))) continue;
      if (st2.horiz) { gut += `M${x * s} ${(y + 0.5) * s}h${s}`; rut += `M${x * s} ${(y - 0.6) * s}h${s}M${x * s} ${(y + 1.6) * s}h${s}`; } else { gut += `M${(x + 0.5) * s} ${y * s}v${s}`; rut += `M${(x - 0.6) * s} ${y * s}v${s}M${(x + 1.6) * s} ${y * s}v${s}`; } } });
    out.push(`<g clip-path="url(#tncp)">${mud}<path d="${rut}" stroke="hsl(30 10% 62%)" stroke-width="${s * 0.55}" opacity=".18" fill="none"/><path d="${gut}" stroke="#2e2822" stroke-width="${Math.max(1, s * 0.14)}" opacity=".55" fill="none"/></g>`);
    // Flagstones round the market cross.
    const fd = runs(v => v === TNT.PLAZA); if (fd) { let fl = ""; const r3 = genRng(5); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (at(x, y) === TNT.PLAZA) { for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) fl += `<rect x="${(x + i * 0.5) * s + 1}" y="${(y + j * 0.5) * s + 1}" width="${s * 0.5 - 2}" height="${s * 0.5 - 2}" fill="hsl(35 8% ${55 + r3() * 12}%)" stroke="#3a3530" stroke-width="${Math.max(0.5, s * 0.02)}"/>`; }
      out.push(fl); } } }
  // Where the cobbles give out onto earth: stones missing along the edge, then loose cobbles lying on the earth, fewer
  // the further from the paving (three squares out). And where a road or street runs by grass rather than a house, the
  // grass leans out over its edge in clumps of blades, each with its shadow (as in the villages).
  if (s >= 10) { const k = s / 40, pv = v => paved(v) || v === TNT.PLAZA, gr = v => v === TNT.GRASS || v === TNT.YARD || v === TNT.CHURCH, wayV = v => pv(v) || dirt(v);
    const stone = (rr, x, y, z) => { const w = (0.24 + rr() * 0.16) * z, h = (0.19 + rr() * 0.1) * z, l = 36 + rr() * 24, a = (rr() - 0.5) * 50, X = x * s, Y = y * s;
      return `<g transform="rotate(${a.toFixed(0)} ${X.toFixed(1)} ${Y.toFixed(1)})"><rect x="${(X - w * s / 2 + s * 0.04).toFixed(1)}" y="${(Y - h * s / 2 + s * 0.06).toFixed(1)}" width="${(w * s).toFixed(1)}" height="${(h * s).toFixed(1)}" rx="${(h * s * 0.45).toFixed(1)}" fill="rgba(30,22,12,.4)"/><rect x="${(X - w * s / 2).toFixed(1)}" y="${(Y - h * s / 2).toFixed(1)}" width="${(w * s).toFixed(1)}" height="${(h * s).toFixed(1)}" rx="${(h * s * 0.45).toFixed(1)}" fill="hsl(${(26 + rr() * 16).toFixed(0)} ${(5 + rr() * 10).toFixed(0)}% ${l.toFixed(0)}%)" stroke="rgba(40,30,20,.5)" stroke-width="${Math.max(0.5, s * 0.015).toFixed(2)}"/></g>`; };
    let gaps = "", loose = ""; const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = atD(x, y);
      if (pv(v)) { // a paving square at the edge: some stones gone, earth showing, on the side toward the earth
        N4.forEach(([dx, dy]) => { if (!dirt(atD(x + dx, y + dy))) return; const rr = sq(x * 3 + dx, y * 3 + dy, 21);
          for (let i = 0; i < 4; i++) { if (rr() < 0.35) continue; const t = rr(), dd = rr() * 0.45, cx = dx ? x + (dx > 0 ? 1 - dd : dd) : x + t, cy = dy ? y + (dy > 0 ? 1 - dd : dd) : y + t;
            gaps += `<ellipse cx="${(cx * s).toFixed(1)}" cy="${(cy * s).toFixed(1)}" rx="${(s * (0.14 + rr() * 0.16)).toFixed(1)}" ry="${(s * (0.11 + rr() * 0.12)).toFixed(1)}"/>`; } }); continue; }
      if (!dirt(v)) continue; let dist = 9; for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) if (pv(atD(x + a, y + b))) dist = Math.min(dist, Math.max(Math.abs(a), Math.abs(b)));
      if (dist > 3) continue; const rr = sq(x, y, 33), n = Math.round([0, 7, 3, 1][dist] * (0.5 + rr()));
      for (let i = 0; i < n; i++) loose += stone(rr, x + 0.1 + rr() * 0.8, y + 0.1 + rr() * 0.8, 1); }
    if (gaps) out.push(`<g fill="hsl(34 30% 54%)">${gaps}</g>`); out.push(loose);
    const blades = {}, shade = [], BC = ["hsl(95 32% 38%)", "hsl(92 34% 43%)", "hsl(98 30% 34%)", "hsl(88 36% 47%)"];
    const clump = (rr, x, y, nx, ny, len) => { shade.push(`<ellipse cx="${((x + nx * len * 0.55) * s).toFixed(1)}" cy="${((y + ny * len * 0.55 + 0.08) * s).toFixed(1)}" rx="${(len * 0.5 * s).toFixed(1)}" ry="${(len * 0.32 * s).toFixed(1)}"/>`);
      for (let j = 0, n = 4 + Math.floor(rr() * 4); j < n; j++) { const a = Math.atan2(ny, nx) + (rr() - 0.5) * 1.3, L = len * (0.55 + rr() * 0.55), w = 0.05 + rr() * 0.05, bx = x + (rr() - 0.5) * 0.3, by = y + (rr() - 0.5) * 0.3;
        const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L, px = -Math.sin(a) * w, py = Math.cos(a) * w, c = BC[Math.floor(rr() * BC.length)];
        blades[c] = (blades[c] || "") + `M${((bx + px) * s).toFixed(1)} ${((by + py) * s).toFixed(1)}Q${((bx + tx) / 2 * s + px * s * 0.6).toFixed(1)} ${((by + ty) / 2 * s + py * s * 0.6).toFixed(1)} ${(tx * s).toFixed(1)} ${(ty * s).toFixed(1)}Q${((bx + tx) / 2 * s - px * s * 0.6).toFixed(1)} ${((by + ty) / 2 * s - py * s * 0.6).toFixed(1)} ${((bx - px) * s).toFixed(1)} ${((by - py) * s).toFixed(1)}Z`; } };
    // Along each edge between a way and grass, every quarter square, rooted just on the grass, leaning over the way.
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = atD(x, y); if (!wayV(v)) continue; const len = v === TNT.ROAD || v === TNT.STREET || v === TNT.MARKET ? 0.55 : 0.45;
      N4.forEach(([dx, dy]) => { if (!gr(atD(x + dx, y + dy))) return;
        for (let i = 0; i < 4; i++) { const rr = sq(x * 8 + dx * 4 + i, y * 8 + dy * 4, 57); if (rr() < 0.35) continue; const t = (i + 0.5) / 4 + (rr() - 0.5) * 0.15, off = 0.05 + rr() * 0.12;
          const rx = dx ? (dx > 0 ? x + 1 + off : x - off) : x + t, ry = dy ? (dy > 0 ? y + 1 + off : y - off) : y + t; clump(rr, rx, ry, -dx, -dy, len * (0.7 + rr() * 0.6)); } }); }
    if (shade.length) out.push(`<filter id="tnbs" filterUnits="userSpaceOnUse" x="${(box[0] - 4) * s}" y="${(box[1] - 4) * s}" width="${(box[2] + 8) * s}" height="${(box[3] + 8) * s}"><feGaussianBlur stdDeviation="${(s * 0.12).toFixed(2)}"/></filter><g filter="url(#tnbs)" fill="#2e2414" opacity=".35">${shade.join("")}</g>`);
    out.push(Object.entries(blades).map(([c, d]) => `<path d="${d}" fill="${c}"/>`).join("")); }
  // The market cross on its steps (or a well in a small town).
  if (T.cross && inBox(T.cross.x, T.cross.y, 2, 2, 2)) { const X = (T.cross.x + 1) * s, Y = (T.cross.y + 1) * s;
    out.push(T.cross.well ? `<circle cx="${X}" cy="${Y}" r="${s * 0.95}" fill="#8d8478" stroke="#2b2520" stroke-width="${s * 0.08}"/><circle cx="${X}" cy="${Y}" r="${s * 0.62}" fill="#1e2a33"/><rect x="${X - s}" y="${Y - s * 0.08}" width="${s * 2}" height="${s * 0.16}" fill="#5a4330"/>`
      : `<rect x="${X - s}" y="${Y - s}" width="${s * 2}" height="${s * 2}" fill="#9a9284" stroke="#2b2520" stroke-width="${s * 0.06}"/><rect x="${X - s * 0.7}" y="${Y - s * 0.7}" width="${s * 1.4}" height="${s * 1.4}" fill="#aaa294" stroke="#2b2520" stroke-width="${s * 0.05}"/><rect x="${X - s * 0.4}" y="${Y - s * 0.4}" width="${s * 0.8}" height="${s * 0.8}" fill="#b8b0a2" stroke="#2b2520" stroke-width="${s * 0.05}"/><path d="M${X - s * 0.3} ${Y}H${X + s * 0.3}M${X} ${Y - s * 0.3}V${Y + s * 0.3}" stroke="#4a443c" stroke-width="${s * 0.12}"/>`); }
  // The town wall: the parapet with its merlons on the outside, the wall walk inside; round towers.
  if (T.walled) { const tw = T.towerWall || new Set(), isW = (x, y) => at(x, y) === TNT.WALL || (x >= 0 && y >= 0 && x < W && y < H && tw.has(y * W + x)), wd = runs((v, x, y) => isW(x, y)), dIn = (x, y) => T.dist[y * W + x];
    if (wd) { out.push(`<path d="${wd}" fill="#8f877a"/>`); out.push(`<path d="${runs((v, x, y) => isW(x, y) && dIn(x, y) === 1)}" fill="#a39b8c"/>`);
      let mer = "", line = ""; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (!isW(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = at(x + dx, y + dy); if (isW(x + dx, y + dy) || v === TNT.TOWER || v === TNT.GATEB) continue;
          const outside = dIn(x, y) === 0 && !(x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && T.IN[(y + dy) * W + x + dx]);
          line += dx ? `M${(x + (dx > 0 ? 1 : 0)) * s} ${y * s}v${s}` : `M${x * s} ${(y + (dy > 0 ? 1 : 0)) * s}h${s}`;
          if (outside && s >= 4) for (let k2 = 0; k2 < 2; k2++) mer += dx ? `<rect x="${(x + (dx > 0 ? 0.68 : 0.04)) * s}" y="${(y + 0.08 + k2 * 0.5) * s}" width="${s * 0.28}" height="${s * 0.3}"/>` : `<rect x="${(x + 0.08 + k2 * 0.5) * s}" y="${(y + (dy > 0 ? 0.68 : 0.04)) * s}" width="${s * 0.3}" height="${s * 0.28}"/>`; } }
      out.push(`<g fill="#6e675c" stroke="#2b2520" stroke-width="${Math.max(0.5, s * 0.03)}">${mer}</g><path d="${line}" stroke="#2b2520" stroke-width="${Math.max(1, s * 0.1)}" fill="none"/>`); }
    T.towers.forEach(t => { if (!inBox(t.x, t.y, 4, 4, 2)) return; const X = (t.cx != null ? t.cx : t.x + 2) * s, Y = (t.cy != null ? t.cy : t.y + 2) * s; let m = "";
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; m += `<rect x="${(X + Math.cos(a) * s * 1.7 - s * 0.16).toFixed(1)}" y="${(Y + Math.sin(a) * s * 1.7 - s * 0.16).toFixed(1)}" width="${s * 0.32}" height="${s * 0.32}" transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${(X + Math.cos(a) * s * 1.7).toFixed(1)} ${(Y + Math.sin(a) * s * 1.7).toFixed(1)})"/>`; }
      out.push(`<circle cx="${X + s * 0.15}" cy="${Y + s * 0.2}" r="${s * 2}" fill="rgba(0,0,0,.3)"/><circle cx="${X}" cy="${Y}" r="${s * 2}" fill="#8f877a" stroke="#2b2520" stroke-width="${Math.max(1, s * 0.1)}"/><circle cx="${X}" cy="${Y}" r="${s * 1.45}" fill="#a39b8c" stroke="#2b2520" stroke-width="${Math.max(0.5, s * 0.05)}"/><g fill="#6e675c" stroke="#2b2520" stroke-width="${Math.max(0.5, s * 0.03)}">${m}</g>`); }); }
  // Buildings sit in the ground: a soft shadow under each.
  { let sh = ""; T.buildings.forEach(b => { if (!inBox(b.x, b.y, b.w, b.h, 2)) return; const B = tnB(b.o), tf = vgTurn(b.k, B.W, B.H);
      (B.F.wings && B.F.wings.length ? B.F.wings : [{ x: 0, y: 0, w: B.W, h: B.H }]).forEach(g => { const R = tnRectTurn(tf, g); sh += `<rect x="${(b.x + R.x + 0.15) * s}" y="${(b.y + R.y + 0.25) * s}" width="${R.w * s}" height="${R.h * s}"/>`; }); });
    if (sh) out.push(`<filter id="tnsh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(s * 0.4).toFixed(1)}"/></filter><g filter="url(#tnsh)" fill="rgba(20,25,10,.5)">${sh}</g>`); }
  const vbx = box[0] * s, vby = box[1] * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbx} ${vby} ${box[2] * s} ${box[3] * s}" width="${box[2] * s}" height="${box[3] * s}">${out.join("")}</svg>`;
}
// Roofs for the preview: each wing a hipped roof in the building's colour (the real roofs are drawn for the tabletop).
function tnRoofsSvg(T, s) {
  let out = ""; T.buildings.forEach(b => { const B = tnB(b.o), tf = vgTurn(b.k, B.W, B.H), rr = genRng((Number(b.o.seed) || 1) * 7 + 3), hue = [[12, 38, 36], [25, 18, 32], [215, 10, 38], [30, 30, 30]][Math.floor(rr() * 4)];
    (B.F.wings || [{ x: 0, y: 0, w: B.W, h: B.H }]).forEach(g => { const R = tnRectTurn(tf, g), X = (b.x + R.x) * s, Y = (b.y + R.y) * s, Wd = R.w * s, Hd = R.h * s, hw = Math.min(Wd, Hd) / 2;
      const ridge = Wd >= Hd ? `M${X + hw} ${Y + Hd / 2}H${X + Wd - hw}` : `M${X + Wd / 2} ${Y + hw}V${Y + Hd - hw}`, hips = Wd >= Hd ? `M${X} ${Y}L${X + hw} ${Y + Hd / 2}L${X} ${Y + Hd}M${X + Wd} ${Y}L${X + Wd - hw} ${Y + Hd / 2}L${X + Wd} ${Y + Hd}` : `M${X} ${Y}L${X + Wd / 2} ${Y + hw}L${X + Wd} ${Y}M${X} ${Y + Hd}L${X + Wd / 2} ${Y + Hd - hw}L${X + Wd} ${Y + Hd}`;
      out += `<rect x="${X}" y="${Y}" width="${Wd}" height="${Hd}" fill="hsl(${hue[0]} ${hue[1]}% ${hue[2] + 6}%)" stroke="#2b2520" stroke-width="${Math.max(0.6, s * 0.12)}"/><path d="${hips}${ridge}" stroke="rgba(0,0,0,.35)" stroke-width="${Math.max(0.5, s * 0.1)}" fill="none"/>`; }); });
  return out; }

// ----- The tabletop: the town as a map whose buildings' insides come and go -----
// A town map always has the ground (in tiles), the roofs, the outside walls of every building on the ground floor with its
// doors and windows, and the town wall. A building's inside (its floors, furniture, inside walls and doors, stairs, the
// outside walls upstairs and below) is added when someone comes near it, from its stored seed, and taken away again when no
// one has been near it for a while, if nothing in it has changed: the same seed builds it again square for square.
function tnShell(b, P) {
  const B = tnB(b.o), tf = vgTurn(b.k, B.W, B.H), to = (x, y) => { const [a, c] = tf(x, y); return [a + b.x, c + b.y]; }, objs = [], walls = [], areas = [];
  const roofLvl = B.floors, cells = set => [...set].map(k => { const [x, y] = k.split(",").map(Number), [p1, p2] = to(x, y), [q1, q2] = to(x + 1, y + 1); return [Math.min(p1, q1), Math.min(p2, q2)]; });
  // The roof: drawn upright for the building, turned as it stands.
  const [cx, cy] = to(B.W / 2, B.H / 2); objs.push({ id: vid("o"), layer: "map", level: roofLvl, x: cx - B.W / 2, y: cy - B.H / 2, w: B.W, h: B.H, rot: (b.k * 90) || undefined, img: genUrl(genRoofSvg(B, b.o.seed)), bld: b.id, roof: 1 });
  areas.push({ id: vid("a"), level: roofLvl, cells: cells(B.F.body), bld: b.id });
  if (B.F.porch) { const pc = new Set(); for (let x = B.F.porch.x; x < B.F.porch.x + B.F.porch.w; x++) for (let y = B.F.porch.y; y < B.F.porch.y + B.F.porch.h; y++) pc.add(x + "," + y); areas.push({ id: vid("a"), level: roofLvl, cells: cells(pc), bld: b.id }); }
  // The ground floor's outside walls, doors, windows and gates.
  const L = B.levels.find(q => q.level === 0), gt = L.gates || new Set(), seg = (x1, y1, x2, y2) => { const [a, c] = to(x1, y1), [d, e] = to(x2, y2); return [a, c, d, e]; };
  genEdges(L, B.W, B.H).forEach(e => { if (!e.ext || gt.has(e.k)) return; const meta = L.doors.has(e.k) ? Object.assign({ k: "door", id: vid("d"), open: false }, L.secret.has(e.k) ? { secret: true } : {}) : L.wins.has(e.k) ? { k: "window", id: vid("d") } : null;
    walls.push(seg(e.x1, e.y1, e.x2, e.y2).concat([0], meta ? [meta] : [])); });
  genGateRuns(gt).forEach(g => walls.push((g.d === "h" ? seg(g.a, g.c, g.b, g.c) : seg(g.c, g.a, g.c, g.b)).concat([0, { k: "door", id: vid("d"), open: false, gate: true }])));
  return { objs, walls, areas, top: roofLvl, cellar: !!B.cellar };
}
function tnName(b) { return b.type === "markethall" ? "Market hall" : b.type === "temple" ? "Parish church" : b.type === "gatehouse" ? `${({ E: "East", W: "West", N: "North", S: "South" })[b.front]} gate` : genType(b.type).name; }
function tnTownPage(o) {
  const T = genTown(o), objs = [], walls = [], areas = [], id = () => vid("o"), P = GEN_PX; let maxL = 1, minL = 0;
  const TS = 32; for (let ty = 0; ty < T.H; ty += TS) for (let tx = 0; tx < T.W; tx += TS) { const w = Math.min(TS, T.W - tx), h = Math.min(TS, T.H - ty); objs.push({ id: id(), layer: "map", level: 0, x: tx, y: ty, w, h, px: 40, land: 1, img: "", vb: [tx, ty, w, h] }); }
  const bld = [];
  T.buildings.forEach(b => { const sh = tnShell(b); objs.push(...sh.objs); walls.push(...sh.walls); areas.push(...sh.areas); maxL = Math.max(maxL, sh.top); if (sh.cellar) minL = -1;
    const name = tnName(b); bld.push({ id: b.id, o: b.o, x: b.x, y: b.y, k: b.k, w: b.w, h: b.h, top: sh.top, name, type: b.type });
    if (o.names !== false) { const lw = b.w + 8, lh = Math.max(3, b.h); objs.push({ id: id(), layer: "gm", level: sh.top, x: b.x - 4, y: b.y + (b.h - lh) / 2, w: lw, h: lh, bld: b.id, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lw * P} ${lh * P}" width="${lw * P}" height="${lh * P}"><text x="${lw * P / 2}" y="${lh * P / 2}" font-family="Georgia,serif" font-size="28" font-weight="bold" fill="#f1e6cf" stroke="#1e1a16" stroke-width="6" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(name)}</text></svg>`) }); } });
  // The town wall and its towers: walls along both faces (nothing gets through but by the gates).
  if (T.walled) { const blk = (x, y) => { if (x < 0 || y < 0 || x >= T.W || y >= T.H) return false; const v = T.G[y * T.W + x]; return v === TNT.WALL || v === TNT.TOWER; }, gb = (x, y) => x >= 0 && y >= 0 && x < T.W && y < T.H && T.G[y * T.W + x] === TNT.GATEB;
    for (let y = 0; y <= T.H; y++) for (let x = 0; x < T.W; x++) { const a = blk(x, y - 1), c = blk(x, y); if (a !== c && !gb(x, a ? y : y - 1)) walls.push([x, y, x + 1, y, 0]); }
    for (let x = 0; x <= T.W; x++) for (let y = 0; y < T.H; y++) { const a = blk(x - 1, y), c = blk(x, y); if (a !== c && !gb(a ? x : x - 1, y)) walls.push([x, y, x, y + 1, 0]); } }
  const names = { "-1": "Cellars", 0: "Ground" }; for (let l = 1; l <= maxL; l++) names[l] = l === maxL ? "Roofs" : `Floor ${l + 1} & roofs`;
  return { T, page: { w: T.W, h: T.H, bg: "#5d7a3a", grid: true, light: false, fogMem: true, objs, walls: genMergeWalls(walls), areas, links: [], levelNames: names, minLevel: minL, maxLevel: maxL,
    town: { o: Object.assign({}, o), bld, live: {}, fp: {}, pin: {}, img: {}, flib: JSON.parse(JSON.stringify(genFurnStore())) } } };
}
// A picture, drawn once onto a canvas and uploaded; the same picture again (a chair, the same floor rebuilt) reuses the file.
async function tnUpload(svgUrl, w, h, cache) {
  const key = tnH(svgUrl) + ":" + svgUrl.length; if (cache[key]) return cache[key]; if (!S.assets || !S.assets.upload) return svgUrl;
  try { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = svgUrl; });
    const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w * GEN_PX)); cv.height = Math.max(1, Math.round(h * GEN_PX)); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    const blob = await new Promise(res => cv.toBlob(res, "image/webp", 0.88)); cv.width = cv.height = 0; if (!blob) return svgUrl;
    const type = blob.type || "image/png", res = await S.assets.upload(new File([blob], "town." + (type.includes("webp") ? "webp" : "png"), { type })); cache[key] = assetPath(res); return cache[key];
  } catch (e) { return svgUrl; } }
async function tnPlace(camp, o) {
  toast("Laying out the town…"); await new Promise(res => setTimeout(res, 30));
  const { T, page } = tnTownPage(o), cache = page.town.img, todo = page.objs.filter(ob => ob.land || String(ob.img).startsWith("data:image/svg"));
  let n = 0; for (const ob of todo) { n++; if (n % 8 === 1) toast(`Drawing the town… ${Math.round(n / todo.length * 100)}%`);
    if (ob.land) { const svg = genUrl(tnTerrainSvg(T, ob.px, ob.vb)); delete ob.vb; delete ob.land; ob.img = svg; }
    ob.img = await tnUpload(ob.img, ob.w, ob.h, cache); }
  const pid = vid("p"), order = vPages(camp).length, nm = o.name || (TN_SIZES[o.size] || TN_SIZES.medium).name;
  await vSave("vttpages/" + pid, Object.assign(page, { camp, name: nm, order, folder: "Towns", open: false, created: new Date().toISOString() }));
  for (let i = 0; i < 60 && !S.vttPages.has(pid); i++) await new Promise(res => setTimeout(res, 50));
  VTT.camp = camp; VTT.page = pid; if (location.hash === "#vtt-" + camp) render(); else location.hash = "vtt-" + camp;
  toast(`${nm} is a new map in ${(S.vttCamps.get(camp) || {}).name || "the campaign"}: ${T.buildings.length} buildings. Each opens up as someone comes near it.`);
}

// A building's inside, as it goes on the map (everything the shell hasn't got), tagged with the building.
function tnInner(b, flib) {
  let res; GEN_FURN_FROZEN = flib || null; try { res = genPage(b.o, { split: true }); } finally { GEN_FURN_FROZEN = null; }
  const { B, walls, ext, page } = res, m = 3, tf = vgTurn(b.k, B.W, B.H), to = (x, y) => { const [a, c] = tf(x - m, y - m); return [a + b.x, c + b.y]; };
  const objs = [], ws = [], plain = [], areas = [], links = [];
  page.objs.forEach((ob, i) => { if (i === 0 || (ob.level === page.roofLvl && ob.layer === "map")) return; // the yard and the roof: the town has its own
    const [cx, cy] = to(ob.x + ob.w / 2, ob.y + ob.h / 2); objs.push(Object.assign({}, ob, { id: vid("o"), x: cx - ob.w / 2, y: cy - ob.h / 2, rot: ((Number(ob.rot) || 0) + b.k * 90) % 360 || undefined, bld: b.id, tin: 1 })); });
  walls.forEach((w, i) => { if (ext[i] && (w[4] || 0) === 0) return; // the ground floor's outside walls are always there
    const [a, c] = to(w[0], w[1]), [d, e] = to(w[2], w[3]), nw = [a, c, d, e, w[4] || 0]; if (w[5]) ws.push(nw.concat([Object.assign({}, w[5], { id: vid("d"), bld: b.id })])); else plain.push(nw); });
  genMergeWalls(plain).forEach(w => ws.push(w.slice(0, 5).concat([{ k: "wall", bld: b.id }])));
  (page.areas || []).forEach(a => { if (a.level === page.roofLvl) return; areas.push({ id: vid("a"), level: a.level, bld: b.id, tin: 1, cells: a.cells.map(([cx, cy]) => { const [p1, p2] = to(cx, cy), [q1, q2] = to(cx + 1, cy + 1); return [Math.min(p1, q1), Math.min(p2, q2)]; }) }); });
  (page.links || []).forEach(l => { const [p1, p2] = to(l.x, l.y), [q1, q2] = to(l.x + l.w, l.y + l.h); links.push(Object.assign({}, l, { id: vid("l"), bld: b.id, tin: 1, x: Math.min(p1, q1), y: Math.min(p2, q2), w: Math.abs(q1 - p1), h: Math.abs(q2 - p2) })); });
  return { objs, walls: ws, areas, links };
}
// What a building's inside is now, as a fingerprint: where everything is, which doors are open. (Ids left out: they're new each time.)
function tnFp(p, bid) {
  const o = (p.objs || []).filter(x => x.bld === bid && x.tin).map(x => [x.level || 0, +(+x.x).toFixed(2), +(+x.y).toFixed(2), +x.w, +x.h, x.rot || 0, x.img, x.layer]).sort();
  const w = (p.walls || []).filter(x => x[5] && x[5].bld === bid).map(x => [x[0], x[1], x[2], x[3], x[4], x[5].k, !!x[5].open, !!x[5].locked, !!x[5].secret]).sort();
  return String(tnH(JSON.stringify([o, w]))); }
const TN = { busy: false, want: new Set() };
async function tnLoad(pid, bid) {
  let p = S.vttPages.get(pid); if (!p || !p.town) return; const b = p.town.bld.find(x => x.id === bid); if (!b || (p.town.live || {})[bid]) return;
  const t0 = performance.now(), inner = tnInner(b, p.town.flib), cache = Object.assign({}, p.town.img || {});
  // The pictures go up a few at a time; ones the town already has (the same chair, the same floor) aren't sent again.
  const todo = inner.objs.filter(ob => String(ob.img).startsWith("data:image/svg")), seen = new Map();
  for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(async ob => { const k = ob.img; if (!seen.has(k)) seen.set(k, tnUpload(k, ob.w, ob.h, cache)); ob.img = await seen.get(k); }));
  p = S.vttPages.get(pid); if (!p || !p.town || (p.town.live || {})[bid]) return; // (it changed while the pictures went up)
  const objs = (p.objs || []).concat(inner.objs), walls = (p.walls || []).concat(inner.walls), areas = (p.areas || []).concat(inner.areas), links = (p.links || []).concat(inner.links);
  const town = Object.assign({}, p.town, { live: Object.assign({}, p.town.live, { [bid]: 1 }), img: cache }); town.fp = Object.assign({}, p.town.fp, { [bid]: tnFp({ objs, walls }, bid) });
  const fields = { objs, walls, areas, links, town }; if (inner.objs.some(x => (x.level || 0) < 0) && !((p.minLevel || 0) < 0)) fields.minLevel = -1;
  const t1 = performance.now(); S.vttPages.set(pid, Object.assign({}, p, fields)); await vPatch("vttpages/" + pid, fields);
  if (window.TN_DEBUG) console.log(`town: ${b.id} built+uploaded ${Math.round(t1 - t0)} ms, saved ${Math.round(performance.now() - t1)} ms`);
}
async function tnUnload(pid, ids, force) {
  const p = S.vttPages.get(pid); if (!p || !p.town) return; const drop = new Set(ids.filter(bid => force || tnFp(p, bid) === (p.town.fp || {})[bid])); if (!drop.size) return;
  const live = Object.assign({}, p.town.live), fp = Object.assign({}, p.town.fp); drop.forEach(bid => { delete live[bid]; delete fp[bid]; });
  const fields = { objs: (p.objs || []).filter(x => !(x.tin && drop.has(x.bld))), walls: (p.walls || []).filter(w => !(w[5] && drop.has(w[5].bld))), areas: (p.areas || []).filter(a => !(a.tin && drop.has(a.bld))),
    links: (p.links || []).filter(l => !(l.bld && drop.has(l.bld))), town: Object.assign({}, p.town, { live, fp }) };
  S.vttPages.set(pid, Object.assign({}, p, fields)); await vPatch("vttpages/" + pid, fields);
}
// The GM's screen keeps the town's insides in step with where the tokens are: in within 8 squares, out past 14 (after a
// minute, and only if nothing inside changed: a door left open, furniture moved, keeps it).
async function tnTick() {
  if (TN.busy || !S.vttPages || !S.vttTokens || typeof vCanEdit !== "function" || !vCanEdit() || READONLY) return;
  const pids = new Set(); if (typeof VTT !== "undefined" && VTT.page) pids.add(VTT.page); if (S.vttCamps) for (const [, c] of S.vttCamps) if (c.playerPage) pids.add(c.playerPage);
  for (const pid of pids) { const p = S.vttPages.get(pid); if (!p || !p.town) continue; const live = p.town.live || {};
    const toks = [...S.vttTokens.values()].filter(t => t.page === pid), near = (b, m) => toks.some(t => { const s = vTokSz(t); return t.x + s > b.x - m && t.x < b.x + b.w + m && t.y + s > b.y - m && t.y < b.y + b.h + m; });
    const gap = b => Math.min(...toks.map(t => { const sz = vTokSz(t); return Math.max(b.x - t.x - sz, t.x - b.x - b.w, 0) + Math.max(b.y - t.y - sz, t.y - b.y - b.h, 0); }), 999);
    const want = p.town.bld.filter(b => !live[b.id] && (near(b, 8) || TN.want.has(pid + ":" + b.id))).sort((a, b) => (TN.want.has(pid + ":" + b.id) - TN.want.has(pid + ":" + a.id)) || gap(a) - gap(b)); // nearest first
    if (want.length) { TN.busy = true; try { for (const b of want.slice(0, 3)) { await tnLoad(pid, b.id); TN.want.delete(pid + ":" + b.id); } } catch (e) { console.warn(e); } finally { TN.busy = false; } if (typeof vRefresh === "function") vRefresh(); return; }
    const now = Date.now(); TN.away = TN.away || {};
    const drop = p.town.bld.filter(b => { if (!live[b.id] || (p.town.pin || {})[b.id] || near(b, 14)) { delete TN.away[pid + b.id]; return false; } const k = pid + b.id; if (!TN.away[k]) TN.away[k] = now; return now - TN.away[k] > 60000; });
    if (drop.length) { TN.busy = true; try { await tnUnload(pid, drop.map(b => b.id)); } catch (e) { console.warn(e); } finally { TN.busy = false; } } }
}
setInterval(() => { tnTick(); }, 900);
// The GM's panel for a building on a town map (select its roof).
function tnSideHtml(p, o) {
  if (!p || !p.town || !o || !o.bld) return ""; const b = p.town.bld.find(x => x.id === o.bld); if (!b) return ""; const live = (p.town.live || {})[b.id], pin = (p.town.pin || {})[b.id];
  const changed = live && tnFp(p, b.id) !== (p.town.fp || {})[b.id];
  return `<div class="tnside"><h3>${esc(b.name)}</h3><p class="muted small">${live ? `Its inside is on the map${changed ? ", changed since it was built (so it stays)" : ""}.` : "Its inside comes onto the map when a token comes near it, built from its seed."}</p>
    <div class="acts wrap">${live ? `<button class="btn ghost small" data-act="tnunload" data-b="${esc(b.id)}">Take the inside away${changed ? " (lose the changes)" : ""}</button>` : `<button class="btn small" data-act="tnload" data-b="${esc(b.id)}">Open it up now</button>`}
    <label class="check small"><input type="checkbox" data-act="tnpin" data-b="${esc(b.id)}"${pin ? " checked" : ""}> Keep it open</label></div></div>`; }
document.addEventListener("click", async ev => {
  const el = ev.target.closest && ev.target.closest("[data-act^=tn]"); if (!el || typeof vCanEdit !== "function" || !vCanEdit()) return; const a = el.dataset.act, cur = vPageNow(); if (!cur || !cur.p || !cur.p.town) return;
  if (a === "tnload") { TN.want.add(cur.id + ":" + el.dataset.b); toast("Opening it up…"); tnTick(); return; }
  if (a === "tnunload") { await tnUnload(cur.id, [el.dataset.b], true); vRefresh(); return; }
  if (a === "tnpin") { const pin = Object.assign({}, cur.p.town.pin); if (el.checked) pin[el.dataset.b] = 1; else delete pin[el.dataset.b]; await vPatch("vttpages/" + cur.id, { town: Object.assign({}, cur.p.town, { pin }) }); if (el.checked) { TN.want.add(cur.id + ":" + el.dataset.b); tnTick(); } return; }
});

// ----- The town page: #gen-<camp>/town -----
const TNV = { o: null, T: null, view: null, sel: null };
function viewTownGen(camp) {
  const c = S.vttCamps && S.vttCamps.get(camp); if (!TNV.o || TNV.o.camp !== camp) TNV.o = Object.assign(tnDefaults(), { camp });
  const o = TNV.o, seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? "on" : ""}" data-act="tvopt" data-k="${k}" data-v="${v}" aria-pressed="${String(o[k]) === String(v)}">${l}</button>`).join("")}</div>`;
  return `<section class="page genpage"><a href="#gen-${esc(camp)}" class="vback">← Generator</a><h1>🏘 Town</h1>
    <p class="muted">Main streets from the gates to the market place, burgage plots along them with gardens behind, back lanes, the church, the wall and its towers, houses outside the gates and the town fields. On the tabletop each building opens up when someone comes near it.</p>
    <div class="genlayout"><div class="genopts">
      <label><span>Size</span>${seg("size", [["small", "Small"], ["medium", "Medium"], ["large", "Large"]])}</label>
      <label><span>Walls</span>${seg("walls", [["auto", "Maybe"], ["yes", "Yes"], ["no", "No"]])}</label>
      <label><span>Gates <small class="muted">main roads in</small></span>${seg("gates", [["auto", "Any"], [2, "2"], [3, "3"], [4, "4"]])}</label>
      <label><span>Streets</span>${seg("streets", [["dirt", "Dirt"], ["mixed", "Mixed"], ["stone", "Stone"]])}</label>
      <label class="genchk"><input type="checkbox" data-act="tvchk" data-k="furn"${o.furn !== false ? " checked" : ""}> <span>Furniture <small class="muted">in every building</small></span></label>
      <label class="genchk"><input type="checkbox" data-act="tvchk" data-k="names"${o.names !== false ? " checked" : ""}> <span>Names <small class="muted">for the GM, over the roofs</small></span></label>
      <button class="btn" data-act="tvroll">🎲 New town</button>
      <label><span>Seed</span><input id="tv-seed" type="number" value="${o.seed}"></label><hr>
      <label><span>Name</span><input id="tv-name" type="text" value="${esc(o.name || "")}" placeholder="${esc((TN_SIZES[o.size] || TN_SIZES.medium).name)}"></label>
      <button class="btn" data-act="tvplace" data-camp="${esc(camp)}">Place in the campaign</button>
      <p class="muted small">A medium town takes a minute to draw. Insides open up on the GM's screen as tokens come near, so keep it open while you play.</p>
    </div><div class="genpreview"><div id="tv-stats" class="small"></div><div class="tvview" id="tv-view"><div class="tvstage" id="tv-stage"></div></div><p class="muted small">Scroll or pinch to zoom, drag to look round. Click a building to look inside.</p><div id="tv-look"></div></div></div></section>`;
}
function tvBuild() { const o = TNV.o, t0 = performance.now(); TNV.T = genTown(o); TNV.ms = Math.round(performance.now() - t0); TNV.sel = null; }
function tvRender() {
  const st = document.getElementById("tv-stage"); if (!st || !TNV.o) return; if (!TNV.T || TNV.T.o !== TNV.o || TNV.T.key !== JSON.stringify([TNV.o.seed, TNV.o.size, TNV.o.walls, TNV.o.gates, TNV.o.streets])) { tvBuild(); TNV.T.key = JSON.stringify([TNV.o.seed, TNV.o.size, TNV.o.walls, TNV.o.gates, TNV.o.streets]); }
  const T = TNV.T, s = 4; st.style.width = T.W * s + "px"; st.style.height = T.H * s + "px";
  st.innerHTML = `<img src="${genUrl(tnTerrainSvg(T, s))}" alt="" draggable="false"><svg class="tvroofs" viewBox="0 0 ${T.W * s} ${T.H * s}">${tnRoofsSvg(T, s)}${T.buildings.map(b => `<rect class="tvhit${TNV.sel === b.id ? " on" : ""}" data-b="${b.id}" x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s}"/>`).join("")}</svg>`;
  const by = {}; T.buildings.forEach(b => { const n = tnName(b); by[n] = (by[n] || 0) + 1; });
  const ss = document.getElementById("tv-stats"); if (ss) ss.innerHTML = `<strong>${T.W} × ${T.H} squares</strong> <span class="muted">(${T.W * 5} × ${T.H * 5} ft) · ${T.buildings.length} buildings · ${T.walled ? `walled, ${T.gates.length} gates, ${T.towers.length} towers` : "no wall"} · made in ${TNV.ms} ms</span><br><span class="muted">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, k]) => `${k} ${esc(n.toLowerCase())}`).join(", ")}</span>`;
  if (!TNV.view) tvFit(); else tvApply(); }
function tvFit() { const vw = document.getElementById("tv-view"); if (!vw || !TNV.T) return; vw.style.height = Math.round(Math.min(innerHeight * 0.72, 820, vw.clientWidth * TNV.T.H / TNV.T.W)) + "px"; const S0 = Math.min(vw.clientWidth / (TNV.T.W * 4), vw.clientHeight / (TNV.T.H * 4)); TNV.view = { z: S0, x: (vw.clientWidth - TNV.T.W * 4 * S0) / 2, y: (vw.clientHeight - TNV.T.H * 4 * S0) / 2 }; tvApply(); }
function tvApply() { const st = document.getElementById("tv-stage"), v = TNV.view; if (st && v) st.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`; }
function tvLook(bid) { const el = document.getElementById("tv-look"); if (!el || !TNV.T) return; const b = TNV.T.buildings.find(x => x.id === bid); if (!b) { el.innerHTML = ""; return; } TNV.sel = bid;
  document.querySelectorAll(".tvhit").forEach(r => r.classList.toggle("on", r.dataset.b === bid));
  el.innerHTML = `<h2 class="sect">${esc(tnName(b))}</h2>${genPreviewHtml(Object.assign({}, b.o, { furn: TNV.o.furn !== false }))}`; }
document.addEventListener("click", async ev => {
  const el = ev.target.closest && ev.target.closest("[data-act^=tv]"); if (!el || !TNV.o) return; const a = el.dataset.act, o = TNV.o;
  if (a === "tvopt") { o[el.dataset.k] = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === el); x.setAttribute("aria-pressed", x === el); }); TNV.view = null; tvRender(); return; }
  if (a === "tvchk") { o[el.dataset.k] = el.checked; return; }
  if (a === "tvroll") { o.seed = genSeed(); const s = document.getElementById("tv-seed"); if (s) s.value = o.seed; tvRender(); document.getElementById("tv-look").innerHTML = ""; return; }
  if (a === "tvplace") { const n = document.getElementById("tv-name"); if (n) o.name = n.value.trim(); el.disabled = true; try { await tnPlace(el.dataset.camp, Object.assign({}, o, { camp: undefined })); } finally { el.disabled = false; } return; }
});
document.addEventListener("change", ev => { if (ev.target && ev.target.id === "tv-seed" && TNV.o) { TNV.o.seed = Math.max(1, Math.round(Number(ev.target.value)) || 1); tvRender(); } });
// Zoom and look round the preview: wheel, drag, pinch; a click on a building opens its plan below.
const TVP = { ptrs: new Map(), drag: null };
document.addEventListener("wheel", ev => { const vw = ev.target.closest && ev.target.closest("#tv-view"); if (!vw || !TNV.view) return; ev.preventDefault(); const r = vw.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top, v = TNV.view, f = Math.exp(-ev.deltaY * 0.0015), nz = Math.max(0.05, Math.min(12, v.z * f));
  v.x = px - (px - v.x) * nz / v.z; v.y = py - (py - v.y) * nz / v.z; v.z = nz; tvApply(); }, { passive: false });
document.addEventListener("pointerdown", ev => { const vw = ev.target.closest && ev.target.closest("#tv-view"); if (!vw || !TNV.view) return; TVP.ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]); vw.setPointerCapture(ev.pointerId); TVP.drag = { x: ev.clientX, y: ev.clientY, vx: TNV.view.x, vy: TNV.view.y, moved: false, t: ev.target }; });
document.addEventListener("pointermove", ev => { if (!TVP.ptrs.has(ev.pointerId) || !TNV.view) return; const prev = TVP.ptrs.get(ev.pointerId); TVP.ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (TVP.ptrs.size === 2) { const [a, b] = [...TVP.ptrs.values()], d1 = Math.hypot(a[0] - b[0], a[1] - b[1]), pa = [...TVP.ptrs.entries()].find(([k]) => k !== ev.pointerId)[1], d0 = Math.hypot(prev[0] - pa[0], prev[1] - pa[1]) || d1, vw = document.getElementById("tv-view").getBoundingClientRect(), mx = (a[0] + b[0]) / 2 - vw.left, my = (a[1] + b[1]) / 2 - vw.top, v = TNV.view, nz = Math.max(0.05, Math.min(12, v.z * d1 / d0));
    v.x = mx - (mx - v.x) * nz / v.z; v.y = my - (my - v.y) * nz / v.z; v.z = nz; if (TVP.drag) TVP.drag.moved = true; tvApply(); return; }
  const d = TVP.drag; if (!d) return; if (Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) > 4) d.moved = true; TNV.view.x = d.vx + ev.clientX - d.x; TNV.view.y = d.vy + ev.clientY - d.y; tvApply(); });
const tvUp = ev => { if (!TVP.ptrs.has(ev.pointerId)) return; TVP.ptrs.delete(ev.pointerId); const d = TVP.drag; if (!TVP.ptrs.size) { TVP.drag = null; if (d && !d.moved) { const h = d.t.closest && d.t.closest(".tvhit"); if (h) tvLook(h.dataset.b); } } else if (TVP.ptrs.size === 1 && d) { const [p] = [...TVP.ptrs.values()]; d.x = p[0]; d.y = p[1]; d.vx = TNV.view.x; d.vy = TNV.view.y; } };
document.addEventListener("pointerup", tvUp); document.addEventListener("pointercancel", tvUp);
new MutationObserver(() => { const st = document.getElementById("tv-stage"); if (st && !st.firstChild) { TNV.view = null; tvRender(); } }).observe(document.documentElement, { childList: true, subtree: true });
