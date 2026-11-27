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

const TNT = { GRASS: 0, STREET: 1, LANE: 2, MARKET: 3, YARD: 4, BUILD: 5, WALL: 6, TOWER: 7, ROAD: 8, FIELD: 9, CHURCH: 10, GATEB: 11, RING: 12, PLAZA: 13, CROSS: 14, WATER: 15, QUAY: 16, BRIDGE: 17, PEN: 18, CWALL: 19, HILL: 20, BAILEY: 21 };
const TN_SIZES = {
  small: { Wi: 120, Hi: 90, band: 24, gates: 2, mk: [22, 14], D: [13, 17], name: "Small town" },
  medium: { Wi: 180, Hi: 140, band: 28, gates: 3, mk: [30, 18], D: [15, 20], name: "Town" },
  large: { Wi: 250, Hi: 200, band: 32, gates: 4, mk: [38, 24], D: [16, 22], name: "Large town" },
  city: { Wi: 340, Hi: 280, band: 44, gates: 4, mk: [46, 28], D: [16, 22], name: "City", city: true } };
const tnDefaults = () => ({ seed: genSeed(), size: "medium", walls: "auto", streets: "mixed", gates: "auto", roads: "edges", magic: "yes", names: true, furn: true });
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

// An entrance [side, along] as a point on the map's edge.
const tnEntPt = (e, W, H) => { const t = Math.max(0.03, Math.min(0.97, Number(e[1]) || 0.5)); return e[0] === "N" ? [t * W, 0.5] : e[0] === "S" ? [t * W, H - 0.5] : e[0] === "W" ? [0.5, t * H] : [W - 0.5, t * H]; };
// What goes where: [type, size weights small/medium/large].
const TN_ZONES = {
  market: [["merchant", 5], ["inn", 2], ["townhouse", 3], ["apothecary", 1]],
  main: [["townhouse", 6], ["merchant", 2], ["workshop", 3], ["apothecary", 1], ["tailor", 1], ["general", 1], ["house", 2], ["tavern", 1]],
  shambles: [["butcher", 6], ["townhouse", 1]],
  gate: [["inn", 4], ["tavern", 2], ["townhouse", 2], ["stable", 1]],
  lane: [["workshop", 4], ["house", 3], ["cottage", 3], ["carpenter", 2], ["blacksmith", 2], ["bakehouse", 1], ["stable", 1]],
  ring: [["cottage", 4], ["workshop", 3], ["blacksmith", 2], ["carpenter", 2], ["barn", 1]],
  suburb: [["cottage", 5], ["house", 2], ["barn", 2], ["blacksmith", 1], ["bakehouse", 1], ["inn", 1]],
  // The city's quarters (after the research: the old core dense with tall houses, merchants on the quays, trades by street,
  // the stinking trades outside the walls downstream).
  core: [["tenement", 6], ["townhouse", 4], ["merchant", 3], ["apothecary", 1], ["tailor", 1], ["tavern", 1], ["inn", 1]],
  corelane: [["tenement", 5], ["house", 2], ["workshop", 3], ["bakehouse", 1], ["tailor", 1], ["tavern", 1]],
  quay: [["warehouse", 4], ["merchant", 3], ["inn", 1], ["tavern", 2], ["workshop", 1]],
  smiths: [["blacksmith", 6], ["workshop", 2], ["townhouse", 1]],
  wrights: [["carpenter", 6], ["workshop", 2], ["townhouse", 1]],
  tailors: [["tailor", 5], ["townhouse", 2], ["merchant", 1]],
  spicers: [["apothecary", 4], ["merchant", 2], ["townhouse", 2]],
  tannery: [["workshop", 6], ["barn", 1], ["cottage", 2]],
  citylane: [["workshop", 4], ["house", 3], ["tenement", 2], ["carpenter", 1], ["blacksmith", 1], ["bakehouse", 1], ["stable", 1], ["tavern", 1]],
  cityring: [["workshop", 3], ["house", 3], ["cottage", 1], ["blacksmith", 2], ["stable", 1], ["carpenter", 1]] };
const TN_TRADES = { shambles: "the Shambles", smiths: "Smithy Row", wrights: "Wrights' Street", tailors: "Taylors' Row", spicers: "Spicer Street" };
// A shuffle from a seeded rng (sort with a random comparator isn't the same from one run to the next).
const tnShuf = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// "St Anne's church", "All Saints' church", "the church of the Holy Cross".
const tnSaintOf = (n, what) => /^the /.test(n) ? `${what[0].toUpperCase() + what.slice(1)} of ${n}` : /s$/.test(n) ? `${n}' ${what}` : `${n}'s ${what}`;
const tnPickW = (r, list) => { const t = list.reduce((a, [, w]) => a + w, 0); let x = r() * t; for (const [v, w] of list) { if ((x -= w) < 0) return v; } return list[0][0]; };

function genTown(o) {
  const SZ = TN_SIZES[o.size] || TN_SIZES.medium, r = genRng(o.seed), band = SZ.band, Wi = SZ.Wi, Hi = SZ.Hi, W = Wi + band * 2, H = Hi + band * 2;
  const G = new Uint8Array(W * H), ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H, at = (x, y) => ok(x, y) ? G[y * W + x] : 255, put = (x, y, v) => { if (ok(x, y)) G[y * W + x] = v; };
  const cx = Math.floor(W / 2) + genInt(r, -3, 3), cy = Math.floor(H / 2) + genInt(r, -3, 3);
  const CITY = !!SZ.city, walled = CITY || (o.walls === "yes" ? true : o.walls === "no" ? false : (o.size !== "small" || r() < 0.4));
  // The town's edge: a rounded, slightly irregular oval (a superellipse wobbled by a few slow waves round it).
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3], radAt = a => 1 + 0.05 * Math.sin(2 * a + ph[0]) + 0.035 * Math.sin(3 * a + ph[1]) + 0.02 * Math.sin(5 * a + ph[2]);
  const IN = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x + 0.5 - cx) / (Wi / 2), dy = (y + 0.5 - cy) / (Hi / 2), R = radAt(Math.atan2(dy, dx)), p = 2.6;
    IN[y * W + x] = Math.pow(Math.abs(dx), p) + Math.pow(Math.abs(dy), p) <= Math.pow(R, p) ? 1 : 0; }
  const isIn = (x, y) => ok(x, y) && IN[y * W + x] === 1;
  // The market place, where the main streets meet, and the line of each street out from it, chosen first: the wall is
  // straightened where each gate will be, so the gatehouse stands in a flat run of wall.
  const mw = SZ.mk[0] + genInt(r, -2, 3), mh = SZ.mk[1] + genInt(r, -2, 2), M = { x: cx - Math.floor(mw / 2), y: cy - Math.floor(mh / 2), w: mw, h: mh };
  const nG = o.gates && o.gates !== "auto" ? Math.max(2, Math.min(4, Number(o.gates))) : SZ.gates;
  // Road entrances you've picked on the map's edges ([side, how far along it]): a gate on each side of the town that has one.
  const ent = (o.entries || []).filter(e => TN_DIR[e[0]]);
  const order = r() < 0.5 ? ["E", "W", "N", "S"] : ["N", "S", "E", "W"], gateDirs = ent.length ? order.filter(d => ent.some(e => e[0] === d)) : order.slice(0, nG), dirs = order.filter(d => gateDirs.includes(d) || r() < 0.85);
  const C0 = {}; dirs.forEach(d => { C0[d] = d === "E" || d === "W" ? genInt(r, M.y + 3, M.y + M.h - 4) : genInt(r, M.x + 3, M.x + M.w - 4); });
  gateDirs.forEach(d => { if (!dirs.includes(d)) return; const [ux, uy] = TN_DIR[d], horiz = !uy, c0 = C0[d];
    let px = horiz ? cx : c0, py = horiz ? c0 : cy; while (isIn(px + ux, py + uy)) { px += ux; py += uy; } // the last square inside, on the street's line
    for (let j = -11; j <= 11; j++) for (let k = -9; k <= 9; k++) { const x = horiz ? px + k : px + j, y = horiz ? py + j : py + k; if (!ok(x, y)) continue;
      const inside = horiz ? (ux > 0 ? x <= px : x >= px) : (uy > 0 ? y <= py : y >= py); IN[y * W + x] = inside ? 1 : 0; } });
  // How far each square inside is from the edge (the wall is the outer 2, the lane inside it the next 3).
  const dist = new Int16Array(W * H).fill(-1), q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!IN[y * W + x]) continue; let edge = false; for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (!isIn(x + dx, y + dy)) { edge = true; break; } if (edge) { dist[y * W + x] = 0; q.push(y * W + x); } }
  for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (!isIn(nx, ny) || dist[ny * W + nx] >= 0) continue; dist[ny * W + nx] = dist[c] + 1; q.push(ny * W + nx); } }
  const dIn = (x, y) => ok(x, y) ? dist[y * W + x] : -1;
  // A city's river: across the map, off to one side of the core (between the old town and the wall), wandering a little,
  // 10 to 12 squares wide. The wall stops at each bank (a tower either side and a chain across); the streets bridge it.
  let river = null;
  if (CITY && o.river !== "no") { const hz = W >= H, side = r() < 0.5 ? -1 : 1, off = (hz ? Hi : Wi) * (0.34 + r() * 0.03), A1 = 4 + r() * 4, A2 = 1.5 + r() * 2, f1 = 0.012 + r() * 0.008, f2 = 0.03 + r() * 0.02, p1 = r() * 6.3, p2 = r() * 6.3, hw = 5 + r() * 1.2;
    const rc = t => (hz ? cy : cx) + side * off + A1 * Math.sin(t * f1 + p1) + A2 * Math.sin(t * f2 + p2);
    for (let t = 0; t < (hz ? W : H); t++) { const c = rc(t + 0.5); for (let j = Math.floor(c - hw - 1); j <= Math.ceil(c + hw + 1); j++) { if (Math.abs(j + 0.5 - c) > hw) continue; const [x, y] = hz ? [t, j] : [j, t]; put(x, y, TNT.WATER); } }
    river = { hz, side, down: r() < 0.5 ? 1 : -1, rc, hw }; }
  const isWater = (x, y) => at(x, y) === TNT.WATER;
  if (walled) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (isWater(x, y)) continue; const d = dIn(x, y); if (d >= 0 && d <= 1) put(x, y, TNT.WALL); else if (d >= 2 && d <= 4) put(x, y, TNT.RING); }
  for (let y = M.y; y < M.y + M.h; y++) for (let x = M.x; x < M.x + M.w; x++) put(x, y, TNT.MARKET);
  const streets = [], buildings = [], towers = [], gates = [], towerWall = [];
  dirs.forEach((d, si) => { const [ux, uy] = TN_DIR[d], horiz = !uy;
    const x0 = d === "E" ? M.x + M.w : d === "W" ? M.x - 1 : 0, y0 = d === "S" ? M.y + M.h : d === "N" ? M.y - 1 : 0;
    const c0 = C0[d], edges = o.roads === "edges" || ent.length > 0;
    const cellAt = (t, c) => horiz ? [x0 + ux * t, c] : [c, y0 + uy * t];
    let tEnd = 0; while (ok(...cellAt(tEnd, c0))) tEnd++; tEnd = Math.max(0, tEnd);
    let tW = -1; for (let t = 0; t < tEnd; t++) { const [x, y] = cellAt(t, c0); if (!isIn(x, y)) { tW = t; break; } } if (tW < 0) tW = tEnd;
    const tWall = walled ? (() => { for (let t = 0; t < tEnd; t++) if (dIn(...cellAt(t, c0)) === 1) return t; return tW - 2; })() : tW;
    // Jogs: inside (clear of the market and the gate) and outside (the road bends a little on its way out).
    const jogs = []; const addJogs = (a, b, n) => { for (let i = 0; i < n; i++) if (b - a > 16) jogs.push([genInt(r, a + 6, b - 6), (r() < 0.5 ? -1 : 1) * genInt(r, 1, 2)]); };
    addJogs(6, tWall - 10, genInt(r, 0, 2)); if (!edges) addJogs(tWall + 12, tEnd - 4, genInt(r, 0, 2)); jogs.sort((a, b) => a[0] - b[0]);
    const tOut = edges && gateDirs.includes(d) ? Math.min(tEnd, tW + 7) : tEnd; // from the map edges: straight only a little way out of the gate
    const cAt = t => { let c = c0; jogs.forEach(([jt, dc]) => { if (t >= jt) c += dc; }); return Math.max(horiz ? 4 : 4, Math.min(horiz ? H - 5 : W - 5, c)); };
    const gated = gateDirs.includes(d); if (!gated) { let t = 0; while (t < tEnd) { const [x, y] = cellAt(t, c0); if (!isIn(x, y) || dIn(x, y) <= (walled ? 4 : 1)) break; t++; } tEnd = t; jogs.length = 0; jogs.push(...[]); }
    for (let t = 0; t < (gated ? tOut : tEnd); t++) { const c = cAt(t); for (let j = -2; j <= 2; j++) { const [x, y] = cellAt(t, c + j), v = at(x, y);
      if (v === TNT.MARKET) continue; if (!gated && (v === TNT.RING || v === TNT.WALL)) continue; if (v === TNT.WATER || v === TNT.BRIDGE) { put(x, y, TNT.BRIDGE); continue; } put(x, y, isIn(x, y) && dIn(x, y) > 1 ? TNT.STREET : isIn(x, y) && walled ? TNT.WALL : TNT.ROAD); } }
    // From the map edges: on from there the road bends away to somewhere along the edge of the map (now and then round the
    // corner onto the next side), a smooth curve 5 squares wide.
    let end = null; const ends = [];
    // A curve from S0 (just out of the gate) to E on the map's edge (side: which edge), 5 squares wide.
    const curve = (S0, E, side) => { const [ox, oy] = TN_DIR[side], Ld = Math.hypot(E[0] - S0[0], E[1] - S0[1]), P1 = [S0[0] + ux * Ld * 0.4, S0[1] + uy * Ld * 0.4], P2 = [E[0] - ox * Ld * 0.3, E[1] - oy * Ld * 0.3];
      const n = Math.ceil(Ld * 3); for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, e = t ** 3, X = a * S0[0] + b * P1[0] + c * P2[0] + e * E[0], Y = a * S0[1] + b * P1[1] + c * P2[1] + e * E[1];
        for (let yy = Math.floor(Y - 3); yy <= Math.ceil(Y + 3); yy++) for (let xx = Math.floor(X - 3); xx <= Math.ceil(X + 3); xx++) { if (Math.hypot(xx + 0.5 - X, yy + 0.5 - Y) > 2.6 || !ok(xx, yy) || isIn(xx, yy)) continue; const v = at(xx, yy); if (v === TNT.GRASS || v === TNT.ROAD) put(xx, yy, TNT.ROAD); else if (v === TNT.WATER) put(xx, yy, TNT.BRIDGE); } }
      ends.push([Math.min(W - 1, Math.max(0, Math.floor(E[0]))), Math.min(H - 1, Math.max(0, Math.floor(E[1])))]); };
    if (gated && edges && tOut < tEnd) { const [sx, sy] = cellAt(tOut - 1, cAt(tOut - 1)), S0 = [sx + 0.5, sy + 0.5];
      if (ent.length) ent.filter(e => e[0] === d).forEach(e => curve(S0, tnEntPt(e, W, H), d)); // the entrances you chose on this side
      else { const side = r() < 0.7 ? d : (horiz ? (r() < 0.5 ? "N" : "S") : (r() < 0.5 ? "E" : "W")), [ox, oy] = TN_DIR[side];
        let E; if (side === d) { const span = horiz ? H : W, at0 = Math.max(10, Math.min(span - 10, c0 + (r() - 0.5) * span * 0.6)); E = horiz ? [ux > 0 ? W - 0.5 : 0.5, at0] : [at0, uy > 0 ? H - 0.5 : 0.5]; }
        else { const along = horiz ? (ux > 0 ? W * (0.72 + r() * 0.2) : W * (0.08 + r() * 0.2)) : (uy > 0 ? H * (0.72 + r() * 0.2) : H * (0.08 + r() * 0.2)); E = ox ? [ox > 0 ? W - 0.5 : 0.5, along] : [along, oy > 0 ? H - 0.5 : 0.5]; }
        curve(S0, E, side); }
      end = ends[0] || null; }
    if (gated && !end) { const [ex, ey] = cellAt(tEnd - 1, cAt(tEnd - 1)); end = [ex, ey]; ends.push(end); }
    streets.push({ d, horiz, ux, uy, x0, y0, c0, cAt, cellAt, tEnd: gated ? tOut : tEnd, tW, tWall: gated ? tWall : tEnd + 3, jogs, shambles: false, gated, end, ends });
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
  // A city's old town: inside the line of its first wall, the same shape as the wall it has now at about half the size
  // (rel: how far out a square is, as a share of the way to the wall; the old wall's line runs from K out, RW wide).
  const D0 = Math.round(Math.min(Wi, Hi) * 0.27), OK_K = 0.52, RW = 4.5 / (Math.min(Wi, Hi) / 2);
  const rel = (x, y) => { const dx = (x + 0.5 - cx) / (Wi / 2), dy = (y + 0.5 - cy) / (Hi / 2); return Math.pow(Math.pow(Math.abs(dx), 2.6) + Math.pow(Math.abs(dy), 2.6), 1 / 2.6) / radAt(Math.atan2(dy, dx)); };
  const core = (x, y) => CITY && rel(x, y) < OK_K, oldBand = (x, y) => { const v = rel(x, y); return v >= OK_K && v < OK_K + RW; };
  // Trades by street (most streets in a city named for a trade): the smiths, the wrights, the tailors, the spicers.
  if (CITY) { const tr = tnShuf(r, ["smiths", "wrights", "tailors", "spicers"]); streets.filter(st => !st.shambles).forEach((st, i) => { if (r() < 0.45) st.trade = tr[i % 4]; }); }
  // The castle: at the edge, its curtain part of the city wall and standing out past it, its gate toward the town; on a
  // side with no gate (a corner, mostly) and away from the river. A square before its gate, a street from there into town.
  let castle = null;
  if (CITY && o.castle !== "no") { const seed = tnH(o.seed, "castle"), csz = r() < 0.6 ? "large" : "medium", B = tnB({ type: "castle", seed, size: csz }), deg = a => a * Math.PI / 180;
    const angs = tnShuf(r, [45, 135, 225, 315]).concat(tnShuf(r, [0, 90, 180, 270])).map(deg);
    const okCell = v => v === TNT.GRASS || v === TNT.WALL || v === TNT.RING || v === TNT.STREET || v === TNT.ROAD || v === TNT.FIELD;
    for (const a of angs) { const ux = Math.cos(a), uy = Math.sin(a);
      if (gateDirs.some(d => TN_DIR[d][0] * ux + TN_DIR[d][1] * uy > 0.8)) continue; if (river && (river.hz ? uy : ux) * river.side > 0.3) continue;
      let px = cx, py = cy; while (isIn(Math.round(px + ux), Math.round(py + uy))) { px += ux; py += uy; }
      const f = Math.abs(ux) > Math.abs(uy) ? (ux > 0 ? "W" : "E") : (uy > 0 ? "N" : "S"), T = tnTurn(B, f), dep = f === "N" || f === "S" ? T.h : T.w;
      const bx = Math.round(px - ux * dep * 0.34 - T.w / 2), by = Math.round(py - uy * dep * 0.34 - T.h / 2);
      let fits = true; for (let y = by - 1; y <= by + T.h && fits; y++) for (let x = bx - 1; x <= bx + T.w; x++) if (!ok(x, y) || !okCell(at(x, y))) { fits = false; break; }
      if (!fits) continue;
      // The curtain and its buildings stand on the map; the courtyard inside is cobbled; round it, as it was.
      const body = new Set(tnCells(B, T.k, bx, by).map(([x, y]) => y * W + x)), seen = new Uint8Array(T.w * T.h), q2 = [], ix = (x, y) => (y - by) * T.w + (x - bx);
      for (let y = by; y < by + T.h; y++) for (let x = bx; x < bx + T.w; x++) if ((x === bx || y === by || x === bx + T.w - 1 || y === by + T.h - 1) && !body.has(y * W + x)) { seen[ix(x, y)] = 1; q2.push([x, y]); }
      for (let i = 0; i < q2.length; i++) { const [x, y] = q2[i]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < bx || ny < by || nx >= bx + T.w || ny >= by + T.h || seen[ix(nx, ny)] || body.has(ny * W + nx)) continue; seen[ix(nx, ny)] = 1; q2.push([nx, ny]); } }
      for (let y = by; y < by + T.h; y++) for (let x = bx; x < bx + T.w; x++) { if (body.has(y * W + x)) put(x, y, TNT.BUILD); else if (!seen[ix(x, y)]) put(x, y, TNT.BAILEY); else if (at(x, y) === TNT.STREET || at(x, y) === TNT.RING) put(x, y, TNT.GRASS); }
      castle = { id: "cs", type: "castle", o: tnBo("castle", seed, csz, o.furn), x: bx, y: by, k: T.k, w: T.w, h: T.h, front: f, zone: "castle", castle: 1, label: "Castle" }; buildings.push(castle);
      // The castle green before the gate (cobbled), then a street on toward the middle until it meets a way.
      const gc = tnDoorCells(castle), [fx, fy] = TN_DIR[f]; if (gc.length) { const gx = Math.round(gc.reduce((a, q) => a + q[0], 0) / gc.length), gy = Math.round(gc.reduce((a, q) => a + q[1], 0) / gc.length);
        const cellF = (fw, lat) => fx ? [gx + fx * fw, gy + lat] : [gx + lat, gy + fy * fw], greenOK = v => v === TNT.GRASS || v === TNT.RING || v === TNT.STREET || v === TNT.WALL;
        for (let fw = 0; fw < 9; fw++) for (let lat = -7; lat <= 7; lat++) { const [x, y] = cellF(fw, lat); if (greenOK(at(x, y)) && isIn(x, y) && dIn(x, y) > 1) put(x, y, TNT.MARKET); }
        const wayHit = v => v === TNT.STREET || v === TNT.LANE || v === TNT.RING || v === TNT.BRIDGE || (v === TNT.MARKET);
        let fwEnd = 9; for (let fw = 9; fw < 200; fw++) { fwEnd = fw; const cs = [-2, -1, 0, 1, 2].map(lat => cellF(fw, lat)); if (fw > 9 && cs.some(([x, y]) => wayHit(at(x, y)) && !(Math.abs(x - gx) < 8 && Math.abs(y - gy) < 10))) break; if (cs.some(([x, y]) => !(at(x, y) === TNT.GRASS || wayHit(at(x, y))) || !isIn(x, y))) break; cs.forEach(([x, y]) => { if (at(x, y) === TNT.GRASS) put(x, y, TNT.STREET); }); }
        castle.green = { x: gx, y: gy, f }; if (fwEnd > 20) { const [sx, sy] = cellF(Math.round((9 + fwEnd) / 2), 0); castle.street = { x: sx + 0.5, y: sy + 0.5, vert: !fx }; } }
      break; } }
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
  const free = (x, y) => at(x, y) === TNT.GRASS && isIn(x, y), way = v => v === TNT.STREET || v === TNT.LANE || v === TNT.MARKET || v === TNT.RING || v === TNT.PLAZA || v === TNT.QUAY || v === TNT.BRIDGE;
  const carve = (x, y) => { if (free(x, y)) { put(x, y, TNT.LANE); return true; } return false; };
  // A city's old wall: where the first wall stood before the city outgrew it, now a cobbled street round the old town (4
  // wide); a pair of the old gate towers still stands where each main street went through it.
  if (CITY) { streets.forEach(st => { let t0 = -1; for (let t = 0; t < st.tWall; t++) { if (core(...st.cellAt(t, st.cAt(t)))) t0 = t; else if (t0 >= 0) break; }
      if (t0 < 4 || st.cAt(t0 - 3) !== st.cAt(t0)) return; const c = st.cAt(t0);
      [-1, 1].forEach(sd => { const cells = []; for (let a = 0; a < 4; a++) for (let b2 = 0; b2 < 4; b2++) cells.push(st.cellAt(t0 - 3 + a, sd < 0 ? c - 7 + b2 : c + 4 + b2));
        if (!cells.every(([x, y]) => free(x, y))) return; cells.forEach(([x, y]) => put(x, y, TNT.TOWER)); const tx = Math.min(...cells.map(q => q[0])), ty = Math.min(...cells.map(q => q[1])); towers.push({ x: tx, y: ty, cx: tx + 2, cy: ty + 2, old: 1 }); }); });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (oldBand(x, y) && free(x, y)) put(x, y, TNT.STREET); }
  // The parish church in its churchyard, off the market, its door toward it, a path out to the nearest street.
  // addChurch: a church in its churchyard as near (tx, ty) as there's room for it (the sizes in turn, each with the width of
  // churchyard round it), at least minD in from the edge of the town; its door toward the middle; a path out to a way.
  const addChurch = (type, sizes, seed, tx, ty, minD, maxR, id, label) => { let best = null, size = null, B = null, mg = 0;
    for (const [sz, m] of sizes) { if (best) break; size = sz; mg = m; B = tnB({ type, seed, size });
      for (let y = Math.max(band, Math.round(ty - maxR)); y < Math.min(H - band, ty + maxR); y += 2) for (let x = Math.max(band, Math.round(tx - maxR)); x < Math.min(W - band, tx + maxR); x += 2) { const ccx = x, ccy = y, dx = cx - ccx, dy = cy - ccy, f = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N"), T = tnTurn(B, f);
        const R = { x: x - mg, y: y - mg, w: T.w + mg * 2, h: T.h + mg * 2 }; let fits = true;
        for (let yy = R.y; yy < R.y + R.h && fits; yy++) for (let xx = R.x; xx < R.x + R.w; xx++) if (!free(xx, yy) || (typeof minD === "function" ? !minD(xx, yy) : dIn(xx, yy) < minD)) { fits = false; break; }
        if (!fits) continue; const sc = Math.hypot(x + T.w / 2 - tx, y + T.h / 2 - ty); if (!best || sc < best.sc) best = { sc, x, y, f, T, R }; } }
    if (!best) return null; const { x, y, f, T, R } = best; for (let yy = R.y; yy < R.y + R.h; yy++) for (let xx = R.x; xx < R.x + R.w; xx++) put(xx, yy, TNT.CHURCH);
    tnCells(B, T.k, x, y).forEach(([xx, yy]) => put(xx, yy, TNT.BUILD));
    const b = { id, type, o: tnBo(type, seed, size, o.furn), x, y, k: T.k, w: T.w, h: T.h, front: f, zone: "church" }; if (label) b.label = label; buildings.push(b);
    // The path: from the middle of the front of the churchyard, out until it meets a way.
    const [ux, uy] = TN_DIR[f], mx = x + Math.floor(T.w / 2) - (uy ? 1 : 0), my = y + Math.floor(T.h / 2) - (ux ? 1 : 0), gate = [];
    let px = ux > 0 ? R.x + R.w : ux < 0 ? R.x - 1 : mx, py = uy > 0 ? R.y + R.h : uy < 0 ? R.y - 1 : my;
    for (let i = 0; i < 80; i++) { const cells = ux ? [[px, py], [px, py + 1]] : [[px, py], [px + 1, py]]; if (cells.some(([a, b2]) => way(at(a, b2)))) break; if (cells.some(([a, b2]) => !free(a, b2))) break; cells.forEach(([a, b2]) => put(a, b2, TNT.LANE)); px += ux; py += uy; }
    return { R, b, f, mx, my }; };
  let church = null; const churches = [];
  if (CITY) {
    // The cathedral in its close, by the market: the close walled round, one gate (a flagged path from it to the cathedral's
    // door), the bishop's palace, the deanery and the canons' houses round the inside of the wall, lawns between.
    const cs = [["large", 6], ["medium", 6], ["medium", 5], ["small", 4]];
    church = addChurch("cathedral", cs, tnH(o.seed, "cathedral"), cx, cy, (x, y) => rel(x, y) < OK_K, 9999, "ch", "Cathedral") || addChurch("cathedral", cs, tnH(o.seed, "cathedral"), cx, cy, 8, 9999, "ch", "Cathedral");
    if (church) { const { R, b, f, mx, my } = church, [ux, uy] = TN_DIR[f]; church.close = 1; churches.push(church);
      // The close wall, a gap for the gate where the path goes out.
      for (let yy = R.y; yy < R.y + R.h; yy++) for (let xx = R.x; xx < R.x + R.w; xx++) if (xx === R.x || yy === R.y || xx === R.x + R.w - 1 || yy === R.y + R.h - 1) put(xx, yy, TNT.CWALL);
      const gate = ux ? [[ux > 0 ? R.x + R.w - 1 : R.x, my], [ux > 0 ? R.x + R.w - 1 : R.x, my + 1]] : [[mx, uy > 0 ? R.y + R.h - 1 : R.y], [mx + 1, uy > 0 ? R.y + R.h - 1 : R.y]]; gate.forEach(([a, c]) => put(a, c, TNT.PLAZA)); church.gate = gate;
      // The flagged path from the gate to the door, 4 wide.
      const d0 = ux ? (ux > 0 ? b.x + b.w : b.x - 1) : (uy > 0 ? b.y + b.h : b.y - 1), d1 = ux ? gate[0][0] : gate[0][1];
      for (let t = Math.min(d0, d1); t <= Math.max(d0, d1); t++) for (let l = -1; l <= 2; l++) { const [xx, yy] = ux ? [t, my + l] : [mx + l, t]; if (at(xx, yy) === TNT.CHURCH) put(xx, yy, TNT.PLAZA); }
      const list = [["manor", "medium", "Bishop's palace"], ["manor", "small", "Deanery"]].concat(Array.from({ length: 9 }, () => ["townhouse", "medium", "Canon's house"])), rc = genRng(tnH(o.seed, "closeorder"));
      list.forEach(([type, size, label], n) => { const seed = tnH(o.seed, "close", n), B = tnB({ type, seed, size });
        for (const side of tnShuf(rc, ["N", "S", "E", "W"])) { const ff = { N: "S", S: "N", E: "W", W: "E" }[side], T = tnTurn(B, ff), [fx, fy] = TN_DIR[ff], span = side === "N" || side === "S" ? R.w - 2 - T.w : R.h - 2 - T.h; let done = false;
          for (let i = 0; i <= span && !done; i++) { const bx = side === "W" ? R.x + 1 : side === "E" ? R.x + R.w - 1 - T.w : R.x + 1 + i, by = side === "N" ? R.y + 1 : side === "S" ? R.y + R.h - 1 - T.h : R.y + 1 + i;
            let fits = true; for (let yy = by - 1; yy <= by + T.h && fits; yy++) for (let xx = bx - 1; xx <= bx + T.w; xx++) { const inner = xx >= bx && xx < bx + T.w && yy >= by && yy < by + T.h, v = at(xx, yy); if (inner ? v !== TNT.CHURCH : !(v === TNT.CHURCH || v === TNT.CWALL)) { fits = false; break; } }
            for (let k = 1; k <= 3 && fits; k++) for (let j = 0; j < (fx ? T.h : T.w); j++) { const xx = fx ? (fx > 0 ? bx + T.w - 1 + k : bx - k) : bx + j, yy = fy ? (fy > 0 ? by + T.h - 1 + k : by - k) : by + j; if (!(at(xx, yy) === TNT.CHURCH || at(xx, yy) === TNT.PLAZA)) { fits = false; break; } }
            if (!fits) continue; const nb = { o: { type, seed, size }, k: T.k, x: bx, y: by }, dc = tnDoorCells(nb); // its doors open onto the close, with room before them
            if (!dc.length || !dc.every(([xx, yy]) => [0, 1].every(k => { const [a2, b2] = [xx + fx * k, yy + fy * k], v = at(a2, b2); return v === TNT.CHURCH || v === TNT.PLAZA; }))) continue;
            tnCells(B, T.k, bx, by).forEach(([xx, yy]) => put(xx, yy, TNT.BUILD)); buildings.push({ id: "cl" + n, type, o: tnBo(type, seed, size, o.furn), x: bx, y: by, k: T.k, w: T.w, h: T.h, front: ff, zone: "close", label }); done = true; }
          if (done) break; } }); }
  }
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
          if (!isIn(x, y) || v === TNT.RING || v === TNT.WALL || v === TNT.STREET || v === TNT.MARKET || v === TNT.GATEB || v === 255 || v === TNT.WATER || v === TNT.BRIDGE || v === TNT.TOWER || v === TNT.BUILD || v === TNT.BAILEY) stop = true; }
        if (stop) break; for (let k = 0; k < 3; k++) { const [x, y] = st.cellAt(t + k, sd < 0 ? c - j : c + j); if (at(x, y) === TNT.GRASS || at(x, y) === TNT.LANE) put(x, y, TNT.LANE); } } } });
  if (!CITY) { church = addChurch("temple", o.size === "small" ? [["medium", 3], ["small", 2]] : [["large", 3], ["medium", 3], ["medium", 2], ["small", 2]], tnH(o.seed, "church"), cx, cy, walled ? 7 : 3, 9999, "ch"); if (church) churches.push(church); }
  else {
    // The parish churches, one in each part of the city, each in its churchyard.
    const saints = tnShuf(r, GEN_SAINTS), a0 = r() * 6.3;
    for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2 + (r() - 0.5) * 0.6, rad = i === 3 ? 0.3 : 0.62, tx = cx + Math.cos(a) * Wi / 2 * rad, ty = cy + Math.sin(a) * Hi / 2 * rad;
      const ch = addChurch("temple", [["medium", 3], ["small", 2]], tnH(o.seed, "parish", i), tx, ty, 7, 45, "pc" + i, tnSaintOf(saints[i], "church")); if (ch) churches.push(ch); } }
  // Quays: along the river inside the walls, 3 squares of flagstones on each bank.
  if (river) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!free(x, y) || dIn(x, y) <= 4) continue; let nearW = false; for (let b2 = -3; b2 <= 3 && !nearW; b2++) for (let a = -3; a <= 3; a++) if (isWater(x + a, y + b2)) { nearW = true; break; } if (nearW) put(x, y, TNT.QUAY); }
  // A city's blocks cut up: any stretch of open ground still too big for houses round its edge is cut across the middle by
  // a lane (a street, 4 wide, across the biggest), now and then with a jog in it, again and again until every block is
  // about two plots deep (smaller in the old town). As the cities grew: lanes pushed through the backs of the plots.
  if (CITY) { const lab = new Int32Array(W * H);
    for (let pass = 0; pass < 14; pass++) { lab.fill(0); let nl = 0, cuts = 0; const comps = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (lab[y * W + x] || !free(x, y)) continue; nl++; const c = { id: nl, x0: x, y0: y, x1: x, y1: y, n: 0, core: 0 }, q = [y * W + x]; lab[y * W + x] = nl;
        for (let i = 0; i < q.length; i++) { const k = q[i], qx = k % W, qy = (k - qx) / W; c.n++; if (core(qx, qy)) c.core++; if (qx < c.x0) c.x0 = qx; if (qx > c.x1) c.x1 = qx; if (qy < c.y0) c.y0 = qy; if (qy > c.y1) c.y1 = qy;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + dx, ny = qy + dy; if (!ok(nx, ny) || lab[ny * W + nx] || !free(nx, ny)) continue; lab[ny * W + nx] = nl; q.push(ny * W + nx); } }
        comps.push(c); }
      for (const c of comps) { const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1, lim = c.core > c.n / 2 ? 34 : 44; if (c.n < 300 || (Math.min(bw, bh) <= lim && Math.max(bw, bh) <= lim * 2.4)) continue;
        const rr = genRng(tnH(o.seed, "cut", pass, c.x0, c.y0)), vert = bw >= bh, span = vert ? bw : bh, a0 = Math.round((vert ? c.x0 : c.y0) + span * (0.42 + rr() * 0.16));
        const wide = Math.min(bw, bh) > 70 ? 4 : 3, from = vert ? c.y0 : c.x0, to = vert ? c.y1 : c.x1, jogAt = Math.round(from + (to - from) * (0.3 + rr() * 0.4)), jog = rr() < 0.45 ? 0 : (rr() < 0.5 ? -3 : 3);
        const cell = (a, t) => vert ? [a, t] : [t, a], mine = (x, y) => ok(x, y) && lab[y * W + x] === c.id && at(x, y) === TNT.GRASS;
        for (let t = from; t <= to; t++) { const a = a0 + (t >= jogAt ? jog : 0); for (let k = 0; k < wide; k++) { const [x, y] = cell(a + k, t); if (mine(x, y)) put(x, y, TNT.LANE); } }
        if (jog) for (let a = Math.min(a0, a0 + jog); a < Math.max(a0, a0 + jog) + wide; a++) for (let k = 0; k < wide; k++) { const [x, y] = cell(a, jogAt + k - wide + 1); if (mine(x, y)) put(x, y, TNT.LANE); }
        cuts++; }
      if (!cuts) break; } }
  // ----- The plots: along each frontage in turn (the market's sides first, then the main streets, the lanes, the lane inside
  // the wall, then out along the roads), each building made for the plot and turned to face its way; terraces mostly on the
  // streets (a gap of 2 now and then, a ginnel through to the yards), houses standing apart on the lanes and outside.
  const gateNear = (x, y) => gates.some(g => Math.hypot(g.x + g.w / 2 - x, g.y + g.h / 2 - y) < 28);
  const streetOf = (x, y) => streets.find(st => { for (let t = 0; t < st.tEnd; t += 1) { const [sx, sy] = st.cellAt(t, st.cAt(t)); if (Math.abs(sx - x) + Math.abs(sy - y) < 5) return true; } return false; });
  let slot = 0;
  // Every town has a Guild branch on the market. Magic (Dryrones): every town a relay post and a transponder shop; bigger
  // towns an adaptor and core shop; the large ones a bleed tower by the wall. Each tried first on the first plot of
  // its kind of street it will fit.
  const guild = [["guildbranch", ["market", "main", "gate", "lane"], (o.size === "large" ? ["large", "large", "large", "medium", "medium", "medium"] : o.size === "small" ? [] : ["medium", "medium", "medium"]).concat(["small", "small", "small"])]]; // every town has the Guild (other plans of it if the first won't fit)
  const want = (o.magic === "no" ? guild : [["relaypost", ["main", "market"], ["medium", "small"]], ["transponder", ["main", "market"], ["medium", "small"]]].concat(guild)
    .concat(o.size !== "small" ? [["coreshop", ["main", "lane", "gate", "ring"], ["medium", "small"]]] : [])
    .concat(o.size === "large" ? [["bleedtower", walled ? ["ring", "lane"] : ["lane", "main"], ["medium", "small"]]] : []))
    .map(([type, zones, sizes]) => ({ type, zones, sizes, done: false }));
  // A city's own: the city hall and the Guild hall on the market; the mint, the gaol, the livery halls of the great guilds,
  // a hospital, almshouses, the bathhouse, warehouses on the quays; outside the walls the leper hospital. Magic: the relay
  // tower, two transponder shops, two adaptor and core shops, two bleed towers by the wall (lighting the streets).
  // Each with a chance (p) of being tried at any plot of its kind, so they spread through the city.
  if (CITY) { want.length = 0; const sn = GEN_SAINTS[Math.floor(r() * GEN_SAINTS.length)], wh = river ? [["warehouse", ["quay"], ["large", "medium", "small"], "Warehouse", 0.35]] : [["warehouse", ["citylane", "main"], ["medium", "small"], "Warehouse", 0.08]];
    [["cityhall", ["market"], ["large", "medium", "small"], "City hall", 1], ["guildhall", ["market", "core", "main"], ["large", "medium", "small"], "Guild hall", 1],
      ["mint", ["core", "main"], ["medium", "small"], "Mint", 0.12], ["gaol", ["main", "corelane", "citylane"], ["medium", "small"], "Gaol", 0.08],
      ["liveryhall", ["core", "main", "market"], ["large", "medium"], "Mercers' hall", 0.12], ["liveryhall", ["core", "main", "smiths", "tailors"], ["medium", "small"], "Goldsmiths' hall", 0.1],
      ["hospital", ["citylane", "main", "corelane"], ["medium", "small"], tnSaintOf(sn, "hospital"), 0.08], ["hospital", ["suburb"], ["small", "medium"], "Leper hospital", 0.3],
      ["almshouse", ["citylane", "corelane"], ["medium", "small"], "Almshouses", 0.06], ["almshouse", ["citylane", "cityring"], ["small"], "Almshouses", 0.06], ["bathhouse", ["citylane", "quay", "corelane"], ["medium", "small"], "Bathhouse", 0.08],
      ...wh, ...wh, ...wh, ...wh, ...wh,
      ...(o.magic === "no" ? [] : [["relaypost", ["core", "main"], ["large", "medium"], "Relay tower", 0.3], ["transponder", ["core", "main"], ["medium", "small"], null, 0.12], ["transponder", ["main", "citylane", "gate"], ["medium", "small"], null, 0.1],
        ["coreshop", ["main", "corelane", "core"], ["medium", "small"], null, 0.1], ["coreshop", ["citylane", "gate", "cityring"], ["medium", "small"], null, 0.1], ["bleedtower", ["cityring"], ["medium", "small"], null, 0.25], ["bleedtower", ["cityring", "citylane"], ["medium", "small"], null, 0.12]])]
      .forEach(([type, zones, sizes, label, p], ix) => want.push({ type, zones, sizes, label, p, ix, done: false })); }
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
          // The magic buildings (and the Guild) still to place that go on this street: each tried here in turn, each size, first.
          const cand = want.filter(m => !m.done && m.zones.includes(zone) && (m.p == null || genRng(tnH(o.seed, "wp", m.ix, f, ln, i))() < m.p)).flatMap(m => m.sizes.map((sz, ix) => [m, sz, ix]));
          for (let tries = -cand.length; tries < 4 && !placed; tries++) { if (tries >= 0) slot++; const c = tries < 0 ? cand[tries + cand.length] : null, mt = c ? c[0] : null, rr = genRng(tnH(o.seed, "plot", f, ln, i, tries)), type = mt ? mt.type : tnPickW(rr, TN_ZONES[zone] || TN_ZONES.main);
            if (!genType(type) || genType(type).id !== type) continue;
            const size = mt ? c[1] : tnPickW(rr, zone === "market" ? [["medium", 3], ["large", 2]] : zone === "suburb" || zone === "ring" || zone === "cityring" || zone === "tannery" ? [["small", 3], ["medium", 1]] : [["small", 2], ["medium", 3], ["large", 1]]);
            // (A city's houses come from a few of each kind and size, so the same ones are tried again and again: quicker.)
            const seed = mt ? (CITY ? tnH(o.seed, "m", type, mt.ix, size) : mt.sizes.indexOf(size) < c[2] ? tnH(o.seed, "m", type, c[2]) : tnH(o.seed, "m", type)) : CITY ? tnH(o.seed, "pool", type, size, Math.floor(rr() * 14)) : tnH(o.seed, "b", f, ln, i, tries), B = tnB({ type, seed, size }), T = tnTurn(B, f), fw = fx ? T.h : T.w, fd = fx ? T.w : T.h;
            if (fd > opts.maxD || i + fw > end) continue;
            // The rectangle behind the front row, all free.
            const bx = fx > 0 ? ln - fd + 1 : fx < 0 ? ln : i, by = fy > 0 ? ln - fd + 1 : fy < 0 ? ln : i;
            let fits = true; for (let yy = by; yy < by + T.h && fits; yy++) for (let xx = bx; xx < bx + T.w; xx++) if (!(opts.outside ? (at(xx, yy) === TNT.GRASS && !isIn(xx, yy)) : free(xx, yy))) { fits = false; break; }
            if (!fits) continue;
            placed = { id: "b" + buildings.length, type, o: tnBo(type, seed, size, o.furn), x: bx, y: by, k: T.k, w: T.w, h: T.h, front: f, zone };
            for (let yy = by; yy < by + T.h; yy++) for (let xx = bx; xx < bx + T.w; xx++) put(xx, yy, TNT.YARD); tnCells(B, T.k, bx, by).forEach(([xx, yy]) => put(xx, yy, TNT.BUILD));
            buildings.push(placed); if (mt) { mt.done = true; if (!CITY || (genType(type) || {}).group === "magic") placed.magic = 1; if (mt.label) placed.label = mt.label; }
            if (zone === "tannery" && type === "workshop") placed.label = ["Tannery", "Dyer's works", "Tannery", "Fuller's works", "Tawyer's yard"][Math.floor(rr() * 5)];
            i += fw; run++;
            // The gap to the next: none (a terrace) mostly on the streets, 2 squares (a ginnel) every few houses; houses apart elsewhere.
            const gap = opts.terrace ? (run >= genInt(rr, 3, 6) || rr() < 0.15 ? 2 : 0) : genInt(rr, 2, 4); if (gap) run = 0; i += gap; }
          if (!placed) i++; } } } };
  const mainZone = (x, y) => { const st = streetOf(x, y); if (gateNear(x, y)) return "gate"; if (st && st.shambles && Math.hypot(x - cx, y - cy) < (CITY ? 90 : 60)) return "shambles";
    if (CITY && st && st.trade && dIn(x, y) > 10) return st.trade; return core(x, y) ? "core" : "main"; };
  place([TNT.MARKET, TNT.PLAZA], () => "market", { maxD: 22, terrace: true });
  if (river) place([TNT.QUAY], (x, y) => gateNear(x, y) ? "gate" : "quay", { maxD: 18, terrace: true });
  place([TNT.STREET], mainZone, { maxD: 22, terrace: true });
  place([TNT.LANE], (x, y) => gateNear(x, y) ? "gate" : core(x, y) ? "corelane" : CITY ? "citylane" : "lane", { maxD: 16, terrace: true });
  if (walled) place([TNT.RING], () => CITY ? "cityring" : "ring", { maxD: 12, terrace: false });
  // Outside the walls: a few houses along the roads by the gates, then the town fields.
  // (A city's suburbs run further out along the roads; downstream of a city, the tanners, dyers and fullers.)
  { const nearGateRoad = (x, y) => gates.length ? (CITY ? gates.some(g => Math.hypot(g.x + g.w / 2 - x, g.y + g.h / 2 - y) < 50) : gateNear(x, y)) : Math.hypot(x - cx, y - cy) < Math.max(Wi, Hi) / 2 + 26;
    const downstream = (x, y) => river && (river.hz ? (x - cx) * river.down > Wi * 0.3 : (y - cy) * river.down > Hi * 0.3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === TNT.GRASS && !isIn(x, y) && !nearGateRoad(x, y)) put(x, y, 200); // not here
    place([TNT.ROAD], (x, y) => downstream(x, y) ? "tannery" : "suburb", { maxD: 12, terrace: false, outside: true });
    for (let i = 0; i < W * H; i++) if (G[i] === 200) G[i] = TNT.GRASS; }
  // Outside a city's gate, the beast market: pens of hurdles on trodden ground beside the road. Out by another, Gallows Hill.
  let pen = null, gallows = null;
  if (CITY) { const clearOut = (x, y) => ok(x, y) && at(x, y) === TNT.GRASS && !isIn(x, y), roadBy = (x0, y0, w, h) => { let n = 0; for (let x = x0 - 1; x <= x0 + w; x++) for (let y = y0 - 1; y <= y0 + h; y++) { if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) continue; if (at(x, y) === TNT.ROAD) n++; } return n; };
    const spot = (w, h, g, rmin, rmax, need) => { let best = null; const gx = g.x + g.w / 2, gy = g.y + g.h / 2;
      for (let y = Math.round(gy - rmax); y < gy + rmax; y++) for (let x = Math.round(gx - rmax); x < gx + rmax; x++) { const dd = Math.hypot(x + w / 2 - gx, y + h / 2 - gy); if (dd < rmin || dd > rmax || (best && dd > best.dd)) continue;
        let fits = true; for (let yy = y - 1; yy <= y + h && fits; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (!clearOut(xx, yy) && !(at(xx, yy) === TNT.ROAD && (xx < x || xx >= x + w || yy < y || yy >= y + h))) { fits = false; break; }
        if (fits && roadBy(x, y, w, h) >= need) best = { x, y, w, h, dd }; } return best; };
    const gs = tnShuf(r, gates);
    for (const g of gs) { pen = spot(18, 14, g, 10, 46, 6) || spot(14, 18, g, 10, 46, 6); if (pen) { for (let y = pen.y; y < pen.y + pen.h; y++) for (let x = pen.x; x < pen.x + pen.w; x++) put(x, y, TNT.PEN); pen.gate = g.id; break; } }
    for (const g of gs) { if (pen && g.id === pen.gate && gs.length > 1) continue; gallows = spot(6, 6, g, 18, 50, 2); if (gallows) { for (let y = gallows.y; y < gallows.y + 6; y++) for (let x = gallows.x; x < gallows.x + 6; x++) put(x, y, TNT.HILL); break; } } }
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
    // Where the river goes through the wall, a tower on each bank first (3 squares from the water).
    if (river) { const wd = (x, y) => { let m = 9; for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++) if (isWater(x + a, y + b)) m = Math.min(m, Math.max(Math.abs(a), Math.abs(b))); return m; };
      rim.filter(([x, y]) => wd(x, y) === 3).forEach(([x, y]) => { if (towers.some(t => Math.hypot(x - t.cx, y - t.cy) < 8)) return;
        let ix = 0, iy = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (dIn(x + dx, y + dy) === 1) { ix += dx; iy += dy; }
        const tcx = x + 0.5 + Math.sign(ix) * 0.5, tcy = y + 0.5 + Math.sign(iy) * 0.5, tx = Math.round(tcx - 2), ty = Math.round(tcy - 2); let fits = true;
        for (let yy = ty; yy < ty + 4; yy++) for (let xx = tx; xx < tx + 4; xx++) { const v = at(xx, yy); if (!(v === TNT.WALL || v === TNT.GRASS || v === TNT.FIELD || v === TNT.RING)) fits = false; }
        if (!fits) return; for (let yy = ty; yy < ty + 4; yy++) for (let xx = tx; xx < tx + 4; xx++) if (!(at(xx, yy) === TNT.RING && dIn(xx, yy) >= 2)) { if (at(xx, yy) === TNT.WALL) towerWall.push(yy * W + xx); put(xx, yy, TNT.TOWER); }
        towers.push({ x: tx, y: ty, cx: tcx, cy: tcy, water: 1 }); }); }
    let last = null; rim.forEach(([x, y]) => { if (last && Math.hypot(x - last[0], y - last[1]) < 22) return; if (gates.some(g => x > g.x - 6 && x < g.x + g.w + 6 && y > g.y - 6 && y < g.y + g.h + 6)) return;
      const tw0 = towers.find(t => !t.old && !t.water); if (tw0 && Math.hypot(x - tw0.x, y - tw0.y) < 16) return;
      if (CITY && (towers.some(t => !t.old && Math.hypot(x - t.cx, y - t.cy) < 14) || castle && x > castle.x - 5 && x < castle.x + castle.w + 5 && y > castle.y - 5 && y < castle.y + castle.h + 5)) return;
      // A round tower, 4 across, standing out from the wall.
      // Centred on the wall: halfway between its outer and inner squares here.
      let ix = 0, iy = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (dIn(x + dx, y + dy) === 1) { ix += dx; iy += dy; }
      const tcx = x + 0.5 + Math.sign(ix) * 0.5, tcy = y + 0.5 + Math.sign(iy) * 0.5, tx = Math.round(tcx - 2), ty = Math.round(tcy - 2);
      let fits = true; for (let yy = ty; yy < ty + 4; yy++) for (let xx = tx; xx < tx + 4; xx++) { const v = at(xx, yy); if (!(v === TNT.WALL || v === TNT.GRASS || v === TNT.FIELD || v === TNT.RING)) fits = false; }
      if (!fits) return; for (let yy = ty; yy < ty + 4; yy++) for (let xx = tx; xx < tx + 4; xx++) if (!(at(xx, yy) === TNT.RING && dIn(xx, yy) >= 2)) { if (at(xx, yy) === TNT.WALL) towerWall.push(yy * W + xx); put(xx, yy, TNT.TOWER); }
      towers.push({ x: tx, y: ty, cx: tcx, cy: tcy }); last = [x, y]; }); }
  // The chain across the river between the towers either side of it.
  const booms = []; if (river) { const wt = towers.filter(t => t.water); wt.forEach((a, i) => wt.slice(i + 1).forEach(b => { const d = Math.hypot(a.cx - b.cx, a.cy - b.cy); if (d > river.hw * 2 && d < river.hw * 2 + 12) booms.push([a.cx, a.cy, b.cx, b.cy]); })); }
  // The rest of the town's ground is yards and gardens.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === TNT.GRASS && isIn(x, y)) put(x, y, TNT.YARD);
  // Core lamps along the main streets and round the market, fed from the bleed tower: on the edge of the way, a little apart.
  const lamps = []; if (buildings.some(b => b.type === "bleedtower")) { const cand = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const v = at(x, y); if (!(v === TNT.STREET || v === TNT.MARKET) || !isIn(x, y)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => { const u = at(x + dx, y + dy); return u === TNT.BUILD || u === TNT.YARD; }); if (edge) cand.push([x, y, edge]); }
    const rl = genRng(tnH(o.seed, "lamps")); if (CITY) cand.splice(0, cand.length, ...tnShuf(rl, cand)); else cand.sort(() => rl() - 0.5);
    for (const [x, y, e] of cand) if (!lamps.some(l => Math.max(Math.abs(l.x - x), Math.abs(l.y - y)) < 9)) lamps.push({ x, y, side: e }); }
  // A city's names on the map: each main street (for what it leads to, or the trade along it), the old wall, the quay, the
  // river, the close, the beast market and the gallows.
  const labels = [];
  if (CITY) { const dn = { E: "East", W: "West", N: "North", S: "South" }, opp = { N: "S", S: "N", E: "W", W: "E" }; let high = false;
    const rivName = ["the Sallow", "the Wend", "the Greyrun", "the Merrow", "the Tarne", "the Lisk", "the Avenmere", "the Corrin"][Math.floor(r() * 8)];
    streets.forEach(st => { if (st.tEnd < 8) return; const crosses = river && Array.from({ length: st.tEnd }, (_, t) => at(...st.cellAt(t, st.cAt(t))) === TNT.BRIDGE).some(Boolean);
      const name = st.shambles ? TN_TRADES.shambles : st.trade ? TN_TRADES[st.trade] : crosses ? "Bridge Street" : !st.gated ? `${dn[st.d]} Street` : !high ? (high = true, "High Street") : `${dn[st.d]}gate`;
      const t = Math.max(3, Math.round((st.gated ? st.tWall : st.tEnd) * (D0 ? 0.42 : 0.5))), [x, y] = st.cellAt(t, st.cAt(t)); labels.push({ x: x + 0.5, y: y + 0.5, text: name, vert: !st.horiz, k: "street" }); st.name = name; });
    for (let y = M.y; y > 0; y--) { const x = cx + 30; if (at(x, y) === TNT.STREET && oldBand(x, y)) { labels.push({ x: x + 0.5, y: y + 1, text: "Old Wall", k: "street" }); break; } }
    if (river) { let qb = null; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === TNT.QUAY) { const d = Math.abs(x - cx - 40) + Math.abs(y - cy) * 0.2; if (!qb || d < qb.d) qb = { x, y, d }; } if (qb) labels.push({ x: qb.x + 0.5, y: qb.y + 0.5, text: "The Quay", k: "street" });
      const t = river.down > 0 ? Math.round(band * 0.5) : (river.hz ? W : H) - Math.round(band * 0.5), c = river.rc(t); labels.push({ x: river.hz ? t : c, y: river.hz ? c : t, text: rivName.replace(/^the /, "River "), vert: !river.hz, k: "water" }); river.name = rivName; }
    if (church && church.close) labels.push({ x: church.R.x + church.R.w / 2, y: church.R.y + 2.2, text: "Cathedral Close", k: "place" });
    if (pen) labels.push({ x: pen.x + pen.w / 2, y: pen.y + pen.h / 2, text: "Beast market", k: "place" });
    if (gallows) labels.push({ x: gallows.x + 3, y: gallows.y - 1, text: "Gallows Hill", k: "place" });
    if (castle && castle.street) labels.push({ x: castle.street.x, y: castle.street.y, text: "Castle Street", vert: castle.street.vert, k: "street" });
    if (castle && castle.green) labels.push({ x: castle.green.x + TN_DIR[castle.front][0] * 5 + 0.5, y: castle.green.y + TN_DIR[castle.front][1] * 5 + 0.5, text: "Castle Green", k: "place" }); }
  const T = { o, W, H, G, IN, dist, cx, cy, M, walled, city: CITY, river: river ? { hz: river.hz, down: river.down, hw: river.hw, side: river.side, name: river.name } : null, labels, churches, castle, pen, gallows, booms, D0: CITY ? D0 : 0, streets: streets.map(st => ({ d: st.d, horiz: st.horiz, ux: st.ux, uy: st.uy, x0: st.x0, y0: st.y0, tEnd: st.tEnd, tW: st.tW, cs: Array.from({ length: st.tEnd }, (_, t) => st.cAt(t)) })), buildings, lamps, roadEnds: streets.flatMap(st => st.ends || []), towers, towerWall: new Set(towerWall), gates, church, cross, fields, size: o.size, seed: o.seed };
  tnAccess(T); return T;
}
// Can a 2×2 creature get to every door and every yard, and a 3×6 wagon from every road in to the market? Where a yard is
// shut in, the smallest building between it and the street makes way (the plot becomes a gap through).
function tnAccess(T) {
  const { W, H, G } = T, at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 255 : G[y * W + x];
  const passage = new Set(); T.gates.forEach(g => { for (let y = g.gate.y; y < g.gate.y + g.gate.h; y++) for (let x = g.gate.x; x < g.gate.x + g.gate.w; x++) passage.add(x + "," + y); });
  const pass = (x, y) => { const v = at(x, y); return v !== 255 && v !== TNT.BUILD && v !== TNT.WALL && v !== TNT.TOWER && (v !== TNT.GATEB || passage.has(x + "," + y)) && v !== TNT.CROSS && v !== TNT.WATER && v !== TNT.CWALL; };
  const reach = n => { const seen = new Uint8Array(W * H), q = [], fit = (x, y) => { for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) if (!pass(x + a, y + b)) return false; return true; };
    const sx = T.M.x + 1, sy = T.M.y + 1; for (let y = T.M.y; y < T.M.y + T.M.h; y++) for (let x = T.M.x; x < T.M.x + T.M.w; x++) if (fit(x, y)) { seen[y * W + x] = 1; q.push(y * W + x); break; }
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !fit(nx, ny)) continue; seen[ny * W + nx] = 1; q.push(ny * W + nx); } }
    const cover = new Uint8Array(W * H); for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) cover[(y + b) * W + x + a] = 1; } return cover; };
  let cover = reach(2), skip = T.city ? new Uint8Array(W * H) : null;
  for (let round = 0; round < (T.city ? 80 : 40); round++) {
    // Squares of yard that no 2×2 can stand on are left out (slivers by a wall); a patch of yard 2×2 wide that's shut in counts.
    const shut = []; for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { if (cover[y * W + x]) continue; const v = at(x, y); if (v !== TNT.YARD && v !== TNT.CHURCH && (v !== TNT.GRASS || T.city)) continue; if (T.city && !T.IN[y * W + x]) continue; if (skip && skip[y * W + x]) continue; if (pass(x + 1, y) && pass(x, y + 1) && pass(x + 1, y + 1) && !cover[y * W + x + 1] && !cover[(y + 1) * W + x]) shut.push([x, y]); }
    if (!shut.length) break;
    // The building beside the first shut-in patch that also stands by somewhere reached: the smallest one goes.
    const [sx, sy] = shut[0]; let best = null;
    T.buildings.forEach((b, i) => { if (b.gate || b.zone === "church" || b.type === "markethall" || b.castle) return; const near = (x, y, m) => x >= b.x - m && x < b.x + b.w + m && y >= b.y - m && y < b.y + b.h + m;
      if (!near(sx, sy, 30)) return; let touchShut = false, touchReach = false;
      for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) { if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) continue; if (y < 0 || x < 0 || x >= W || y >= H) continue; if (cover[y * W + x]) touchReach = true; else if (pass(x, y)) touchShut = true; }
      if (touchShut && touchReach) { const d = Math.hypot(b.x + b.w / 2 - sx, b.y + b.h / 2 - sy) + b.w * b.h * 0.05; if (!best || d < best.d) best = { d, i }; } });
    if (!best && skip) { // (a city: that patch stays shut in, a garden walled round; the rest are still looked at)
      const q = [sy * W + sx]; skip[sy * W + sx] = 1; for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nc = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || skip[nc] || cover[nc] || !pass(nx, ny)) continue; skip[nc] = 1; q.push(nc); } }
      T.shutIn = (T.shutIn || 0) + 1; continue; }
    if (!best) { for (const [x, y] of shut.slice(0, 1)) G[y * W + x] = TNT.GRASS; T.shutIn = (T.shutIn || 0) + 1; break; }
    const b = T.buildings[best.i]; for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) G[y * W + x] = b.zone === "close" ? TNT.CHURCH : TNT.YARD; T.buildings.splice(best.i, 1); T.cleared = (T.cleared || 0) + 1;
    cover = reach(2); }
  // Last: every building's way in must open where a 2×2 can stand; any that doesn't (where a lane pinches) is left out.
  for (let k = 0; k < 3; k++) { const bad = T.buildings.filter(b => !b.gate && !b.castle && b.type !== "markethall" && b.zone !== "church" && !tnDoorCells(b).some(([x, y]) => cover[y * W + x]));
    if (!bad.length) break; bad.forEach(b => { tnCells(tnB(b.o), b.k, b.x, b.y).forEach(([x, y]) => { G[y * W + x] = b.zone === "close" ? TNT.CHURCH : T.IN[y * W + x] ? TNT.YARD : TNT.GRASS; }); T.buildings.splice(T.buildings.indexOf(b), 1); T.cleared = (T.cleared || 0) + 1; }); cover = reach(2); }
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
  const paved = v => v === TNT.BRIDGE || v === TNT.BAILEY || (o.streets === "dirt" ? false : v === TNT.STREET || v === TNT.MARKET || (o.streets === "stone" && (v === TNT.LANE || v === TNT.RING)));
  const dirtV = v => ((v === TNT.STREET || v === TNT.MARKET || v === TNT.LANE || v === TNT.RING || v === TNT.ROAD) && !paved(v)) || v === TNT.PEN, solid = v => v === TNT.BUILD || v === TNT.GATEB || v === TNT.WALL || v === TNT.TOWER || v === TNT.CWALL;
  // A strip of grass one square wide between a way and a building is trodden earth (no grass shows between them).
  const apron = new Set(); for (let y = y0 - 1; y < y1 + 1; y++) for (let x = x0 - 1; x < x1 + 1; x++) { const v = at(x, y); if (!(v === TNT.GRASS || v === TNT.YARD || v === TNT.CHURCH)) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const a = at(x - dx, y - dy), b = at(x + dx, y + dy); if ((dirtV(a) && solid(b)) || (dirtV(b) && solid(a))) apron.add(y * W + x); } }
  const APRON = 254, atD = (x, y) => apron.has(y * W + x) ? APRON : at(x, y), dirt = v => v === APRON || dirtV(v);
  // Run-length paths of the squares of a kind, in this window.
  const runs = test => { let d = ""; for (let y = y0; y < y1; y++) { let x = x0; while (x < x1) { if (!test(atD(x, y), x, y)) { x++; continue; } let e = x; while (e < x1 && test(atD(e, y), e, y)) e++; d += `M${x * s} ${y * s}h${(e - x) * s}v${s}h${-(e - x) * s}z`; x = e; } } return d; };
  // The ground: grass, yards and churchyard a little different, blended.
  out.push(`<rect x="${(box[0] - 2) * s}" y="${(box[1] - 2) * s}" width="${(box[2] + 4) * s}" height="${(box[3] + 4) * s}" fill="hsl(95 32% 42%)"/>`);
  { let d = ""; const COL = { [TNT.YARD]: [92, 30, 40], [TNT.CHURCH]: [100, 30, 38], [TNT.GRASS]: [95, 32, 42], [TNT.FIELD]: [70, 30, 44], [TNT.WATER]: [40, 22, 36], [TNT.HILL]: [90, 30, 40] };
    out.push(`<filter id="tnbl" filterUnits="userSpaceOnUse" x="${(box[0] - 8) * s}" y="${(box[1] - 8) * s}" width="${(box[2] + 16) * s}" height="${(box[3] + 16) * s}"><feGaussianBlur stdDeviation="${(s * 1.6).toFixed(2)}"/></filter><g filter="url(#tnbl)">`);
    // (Far out, as on the preview, in blocks of 2 by 2: it's blurred into one anyway, and a city has a lot of squares.)
    const st = s < 6 ? 2 : 1; for (let y = Math.max(0, y0 - 5); y < Math.min(H, y1 + 5); y += st) for (let x = Math.max(0, x0 - 5); x < Math.min(W, x1 + 5); x += st) { const c = COL[at(x, y)] || COL[TNT.GRASS], v = nz(x / 7, y / 7, 3); d += `<rect x="${x * s}" y="${y * s}" width="${s * st + 0.5}" height="${s * st + 0.5}" fill="hsl(${c[0]} ${c[1]}% ${(c[2] + (v - 0.5) * 8).toFixed(1)}%)"/>`; }
    out.push(d + `</g>`); }
  // Grass close up: patches, tufts, a flower or two; each square its own scatter, so tiles meet without seams.
  { let patches = "", tufts = ""; const GR = new Set([TNT.GRASS, TNT.YARD, TNT.CHURCH, TNT.HILL]);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (!GR.has(at(x, y))) continue; const rr = sq(x, y);
      if (rr() < (s < 6 ? 0.14 : 0.4)) patches += `<ellipse cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" rx="${(s * (0.5 + rr() * 1.6)).toFixed(1)}" ry="${(s * (0.4 + rr() * 1.1)).toFixed(1)}" fill="hsl(${(88 + rr() * 20).toFixed(0)} ${(20 + rr() * 15).toFixed(0)}% ${(34 + rr() * 16).toFixed(0)}%)" opacity="${(0.25 + rr() * 0.3).toFixed(2)}"/>`;
      if (!fine) continue; const k = s / 40; for (let i = 0, n = 1 + (rr() < 0.5 ? 1 : 0); i < n; i++) { const px = (x + rr()) * s, py = (y + rr()) * s, z = (3 + rr() * 4) * k; for (let j = 0; j < 3; j++) { const a = -0.6 + j * 0.6 + (rr() - 0.5) * 0.4; tufts += `M${px.toFixed(1)} ${py.toFixed(1)}l${(Math.sin(a) * z).toFixed(1)} ${(-Math.cos(a) * z).toFixed(1)}`; } }
      if (rr() < 0.03) patches += `<circle cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" r="${((1.5 + rr() * 1.5) * k).toFixed(1)}" fill="${["#e8d25a", "#e9e4f0", "#c86a8a"][Math.floor(rr() * 3)]}" opacity=".85"/>`; }
    out.push(patches); if (tufts) out.push(`<path d="${tufts}" stroke="hsl(92 32% 30%)" stroke-width="${Math.max(0.8, s * 0.03)}" stroke-linecap="round" fill="none" opacity=".8"/>`); }
  // Fields: strips across each block.
  const crop = { wheat: ["#c9a94a", "#b8963c"], barley: ["#a9b45a", "#98a24c"], fallow: ["#8a7048", "#7a6240"] };
  T.fields.forEach((f, i) => { if (!inBox(f.x, f.y, f.w, f.h, 2)) return; const c = crop[f.crop] || crop.wheat, id = `tnf${i}`, sw = 1.5 * s;
    out.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${sw * 2}" height="${sw * 2}" patternTransform="rotate(${f.ang.toFixed(2)})"><rect width="${sw * 2}" height="${sw}" fill="${c[0]}"/><rect y="${sw}" width="${sw * 2}" height="${sw}" fill="${c[1]}"/><path d="M0 ${sw}h${sw * 2}" stroke="rgba(60,45,20,.3)" stroke-width="${Math.max(1, s * 0.06)}"/></pattern>`);
    out.push(`<path d="M${f.poly.map(([x, y]) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`).join("L")}Z" fill="url(#${id})" stroke="#5d4a2c" stroke-opacity=".5" stroke-width="${Math.max(1, s * 0.14)}" stroke-linejoin="round"/>`); });
  // The river: a muddy fringe along its banks, the water over it (its edges wandering a little), deeper down the middle,
  // ripples drawn out along the flow.
  const N4w = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (T.river) { const wv = v => v === TNT.WATER || v === TNT.BRIDGE, d = runs(v => wv(v)); if (d) {
    const fx = (box[0] - 12) * s, fy = (box[1] - 12) * s, fw = (box[2] + 24) * s, fh = (box[3] + 24) * s, flt = (id, sd, sc) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="${fx}" y="${fy}" width="${fw}" height="${fh}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${(0.5 / s).toFixed(5)}" numOctaves="2" seed="${sd}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${(s * sc).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="${(s * 0.35).toFixed(2)}"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 14 -6.5"/></filter>`;
    const bank = runs((v, x, y) => wv(v) || (!solid(v) && v !== TNT.QUAY && !paved(v) && N4w.some(([a, b]) => at(x + a, y + b) === TNT.WATER)));
    out.push(flt("tnwb", 11, 0.9) + flt("tnwt", 3, 0.6) + `<g filter="url(#tnwb)"><path d="${bank}" fill="#6a5d3f"/></g><g filter="url(#tnwt)"><path d="${d}" fill="#3d7280"/></g>`);
    const deep = runs((v, x, y) => { if (!wv(v)) return false; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) if (!wv(at(x + a, y + b))) return false; return true; });
    if (deep) out.push(`<filter id="tnwd" filterUnits="userSpaceOnUse" x="${fx}" y="${fy}" width="${fw}" height="${fh}"><feGaussianBlur stdDeviation="${(s * 1.4).toFixed(2)}"/></filter><path d="${deep}" fill="#22505e" filter="url(#tnwd)" opacity=".9"/>`);
    let rip = ""; const hz = T.river.hz; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (at(x, y) !== TNT.WATER) continue; const rr = sq(x, y, 61); if (rr() > 0.32) continue; const px = (x + rr()) * s, py = (y + rr()) * s, L = (0.6 + rr() * 1.2) * s, bw = (0.12 + rr() * 0.12) * s;
      rip += hz ? `M${(px - L).toFixed(1)} ${py.toFixed(1)}q${L.toFixed(1)} ${(-bw).toFixed(1)} ${(2 * L).toFixed(1)} 0` : `M${px.toFixed(1)} ${(py - L).toFixed(1)}q${(-bw).toFixed(1)} ${L.toFixed(1)} 0 ${(2 * L).toFixed(1)}`; }
    if (rip) out.push(`<path d="${rip}" stroke="#c8ecef" stroke-width="${Math.max(0.6, s * 0.05).toFixed(2)}" fill="none" opacity=".28" stroke-linecap="round"/>`); } }
  // Gardens behind the houses: rows of beds; fences down the sides of each plot; a fruit tree here and there.
  { let beds = "", fence = "", trees = ""; const yard = (x, y) => at(x, y) === TNT.YARD;
    T.buildings.forEach(b => { if (b.gate || b.zone === "church" || b.zone === "close" || b.castle || b.zone === "market" && b.type === "markethall" || !inBox(b.x, b.y, b.w, b.h, 26)) return; const [fx, fy] = TN_DIR[b.front], bx = -fx, by = -fy, rr = genRng(tnH(T.seed, "garden", b.id));
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
  (T.churches || (T.church ? [T.church] : [])).forEach((ch, ci) => { if (!inBox(ch.R.x, ch.R.y, ch.R.w, ch.R.h, 2)) return; const R = ch.R, rr = genRng(tnH(T.seed, "graves", ci || "")); let g = "";
    for (let i = 0; i < R.w * R.h * (ch.close ? 0.035 : 0.12); i++) { const x = R.x + 0.6 + rr() * (R.w - 1.6), y = R.y + 0.6 + rr() * (R.h - 1.6); if (at(Math.floor(x), Math.floor(y)) !== TNT.CHURCH || at(Math.floor(x + 0.4), Math.floor(y + 0.5)) !== TNT.CHURCH) continue;
      g += `<rect x="${(x * s).toFixed(1)}" y="${(y * s).toFixed(1)}" width="${(s * 0.32).toFixed(1)}" height="${(s * 0.46).toFixed(1)}" rx="${(s * 0.12).toFixed(1)}" fill="#a8a29a" stroke="#3a3530" stroke-width="${Math.max(0.6, s * 0.04)}"/>`; }
    out.push(g + (ch.close ? "" : `<rect x="${R.x * s + s * 0.1}" y="${R.y * s + s * 0.1}" width="${R.w * s - s * 0.2}" height="${R.h * s - s * 0.2}" fill="none" stroke="#8d8478" stroke-width="${s * 0.2}"/>`)); });
  // Earth: the roads, lanes and any unpaved street as one patch of packed earth, the edges wandering a little.
  // (Under the edges of the cobbles, the houses and the wall too, so the earth meets them with no gap.)
  const nearDirt = (x, y) => { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (dirt(atD(x + a, y + b))) return true; return false; };
  const under = v => paved(v) || v === TNT.PLAZA || v === TNT.BUILD || v === TNT.GATEB || v === TNT.WALL || v === TNT.TOWER || v === TNT.QUAY || v === TNT.CWALL;
  { const d = runs((v, x, y) => dirt(v) || (under(v) && nearDirt(x, y))); if (d) {
    const fx = (box[0] - 12) * s, fy = (box[1] - 12) * s, fw = (box[2] + 24) * s, fh = (box[3] + 24) * s;
    out.push(`<filter id="tnrd" filterUnits="userSpaceOnUse" x="${fx}" y="${fy}" width="${fw}" height="${fh}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${(0.55 / s).toFixed(5)}" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${(s * 0.45).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="${(s * 0.4).toFixed(2)}"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 14 -6.5"/></filter>`);
    out.push(`<g filter="url(#tnrd)"><path d="${d}" fill="hsl(34 30% 56%)"/></g>`);
    let pb = "", ruts = ""; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (!dirt(atD(x, y))) continue; const rr = sq(x, y, 3);
      if (rr() < (s < 6 ? 0.18 : 0.5)) pb += `<ellipse cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" rx="${(s * (0.3 + rr() * 0.7)).toFixed(1)}" ry="${(s * (0.2 + rr() * 0.5)).toFixed(1)}" fill="hsl(${30 + rr() * 8} ${22 + rr() * 12}% ${44 + rr() * 16}%)" opacity=".45"/>`;
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
  // The quays: big flagstones, a stone kerb along the water with mooring posts, boats tied up alongside.
  { const qd = runs(v => v === TNT.QUAY); if (qd) { const P = 2 * s, rq = genRng(91); let fl = "";
      [[0, 0, 1], [1, 0, 1], [-0.5, 1, 1], [0.5, 1, 1], [1.5, 1, 1]].forEach(([i, j, w]) => { fl += `<rect x="${(i * s + 0.7).toFixed(1)}" y="${(j * s + 0.7).toFixed(1)}" width="${(w * s - 1.4).toFixed(1)}" height="${(s - 1.4).toFixed(1)}" rx="${(s * 0.06).toFixed(1)}" fill="hsl(${(30 + rq() * 10).toFixed(0)} ${(5 + rq() * 6).toFixed(0)}% ${(50 + rq() * 12).toFixed(0)}%)"/>`; });
      out.push(`<pattern id="tnqp" patternUnits="userSpaceOnUse" width="${P}" height="${P}"><rect width="${P}" height="${P}" fill="#4a443b"/>${fl}</pattern><path d="${qd}" fill="url(#tnqp)"/>`);
      let kerb = "", post = ""; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (at(x, y) !== TNT.QUAY) continue;
        N4w.forEach(([dx, dy]) => { if (at(x + dx, y + dy) !== TNT.WATER) return; kerb += dx ? `M${(x + (dx > 0 ? 0.86 : 0.14)) * s} ${y * s}v${s}` : `M${x * s} ${(y + (dy > 0 ? 0.86 : 0.14)) * s}h${s}`;
          if (sq(x, y, 43)() < 0.14) { const px = (x + 0.5 + dx * 0.25) * s, py = (y + 0.5 + dy * 0.25) * s; post += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(s * 0.15).toFixed(1)}"/>`; } }); }
      if (kerb) out.push(`<path d="${kerb}" stroke="#2b2520" stroke-width="${(s * 0.34).toFixed(1)}" fill="none"/><path d="${kerb}" stroke="#8a8274" stroke-width="${(s * 0.22).toFixed(1)}" fill="none"/><g fill="#3a2c1e" stroke="#120c08" stroke-width="${Math.max(0.4, s * 0.03).toFixed(2)}">${post}</g>`); } }
  // Boats along the quays (and a few out on the river), worked out once for the whole map so every tile agrees.
  if (T.river) { if (!T._boats) { const bs = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { if (at(x, y) !== TNT.WATER) continue; const rr = sq(x, y, 77), q = N4w.find(([dx, dy]) => at(x + dx, y + dy) === TNT.QUAY);
        const mid = !q && rr() < 0.0016 && N4w.every(([dx, dy]) => at(x + dx * 3, y + dy * 3) === TNT.WATER);
        if (!(q && rr() < 0.09) && !mid) continue; if (bs.some(b => Math.hypot(b.x - x, b.y - y) < (mid ? 14 : 9))) continue;
        const cog = !mid && rr() < 0.55, L = cog ? 6 + rr() * 3 : 2.6 + rr() * 1.2, Bm = cog ? 2 + rr() * 0.7 : 1.1 + rr() * 0.3, hz = q ? !!q[1] : T.river.hz;
        bs.push({ x: x + 0.5 - (q ? q[0] : 0) * (Bm / 2 - 0.2), y: y + 0.5 - (q ? q[1] : 0) * (Bm / 2 - 0.2), L, Bm, ang: (hz ? 0 : 90) + (mid ? (rr() - 0.5) * 30 : 0), cog, tint: rr() }); } T._boats = bs; }
    out.push(T._boats.filter(b => inBox(b.x - 5, b.y - 5, 10, 10, 1)).map(b => { const L = b.L * s, Bm = b.Bm * s, hull = (l, w) => `M${-l / 2} 0C${-l / 2 + l * 0.16} ${-w / 2} ${l / 2 - l * 0.28} ${-w / 2} ${l / 2} 0C${l / 2 - l * 0.28} ${w / 2} ${-l / 2 + l * 0.16} ${w / 2} ${-l / 2} 0Z`;
      return `<g transform="translate(${(b.x * s).toFixed(1)} ${(b.y * s).toFixed(1)}) rotate(${b.ang.toFixed(0)})"><path d="${hull(L * 1.04, Bm * 1.1)}" fill="rgba(10,25,30,.35)" transform="translate(${s * 0.2} ${s * 0.25})"/><path d="${hull(L, Bm)}" fill="hsl(${(24 + b.tint * 10).toFixed(0)} 38% ${(26 + b.tint * 8).toFixed(0)}%)" stroke="#1d130b" stroke-width="${Math.max(0.6, s * 0.06).toFixed(2)}"/><path d="${hull(L * 0.8, Bm * 0.7)}" fill="hsl(32 34% ${(44 + b.tint * 10).toFixed(0)}%)"/><path d="M${-L * 0.32} 0H${L * 0.34}M${-L * 0.3} ${-Bm * 0.16}H${L * 0.3}M${-L * 0.3} ${Bm * 0.16}H${L * 0.3}" stroke="rgba(40,25,12,.45)" stroke-width="${Math.max(0.4, s * 0.03).toFixed(2)}"/>`
        + (b.cog ? `<rect x="${(-s * 0.12).toFixed(1)}" y="${(-Bm * 0.62).toFixed(1)}" width="${(s * 0.24).toFixed(1)}" height="${(Bm * 1.24).toFixed(1)}" rx="${(s * 0.1).toFixed(1)}" fill="#e2d6b8" stroke="#3a2c1e" stroke-width="${Math.max(0.4, s * 0.03).toFixed(2)}"/><circle r="${(s * 0.2).toFixed(1)}" fill="#3a2a1a"/><rect x="${(L * 0.2).toFixed(1)}" y="${(-Bm * 0.3).toFixed(1)}" width="${(L * 0.16).toFixed(1)}" height="${(Bm * 0.6).toFixed(1)}" fill="hsl(28 30% 34%)" stroke="#1d130b" stroke-width="${Math.max(0.4, s * 0.03).toFixed(2)}"/>` : `<path d="M${-L * 0.12} ${-Bm * 0.42}V${Bm * 0.42}M${L * 0.14} ${-Bm * 0.42}V${Bm * 0.42}" stroke="#5a4028" stroke-width="${(s * 0.12).toFixed(1)}"/>`) + `</g>`; }).join("")); }
  // Bridges: a parapet along each side over the water, cutwaters on the piers, a shadow on the water.
  { let par = "", cut = "", sh = ""; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (at(x, y) !== TNT.BRIDGE) continue;
      N4w.forEach(([dx, dy]) => { if (at(x + dx, y + dy) !== TNT.WATER) return; const t = 0.28;
        par += dx ? `<rect x="${((x + (dx > 0 ? 1 - t : 0)) * s).toFixed(1)}" y="${(y * s).toFixed(1)}" width="${(t * s).toFixed(1)}" height="${s}"/>` : `<rect x="${(x * s).toFixed(1)}" y="${((y + (dy > 0 ? 1 - t : 0)) * s).toFixed(1)}" width="${s}" height="${(t * s).toFixed(1)}"/>`;
        sh += dx ? `<rect x="${((x + (dx > 0 ? 1 : -0.45)) * s).toFixed(1)}" y="${(y * s).toFixed(1)}" width="${(0.45 * s).toFixed(1)}" height="${s}"/>` : `<rect x="${(x * s).toFixed(1)}" y="${((y + (dy > 0 ? 1 : -0.45)) * s).toFixed(1)}" width="${s}" height="${(0.45 * s).toFixed(1)}"/>`;
        if (((dx ? y : x) % 4) === 0) { const ex = x + (dx > 0 ? 1 : 0), ey = y + (dy > 0 ? 1 : 0); cut += dx ? `<path d="M${ex * s} ${(y + 0.05) * s}L${(ex + dx * 0.95) * s} ${(y + 0.5) * s}L${ex * s} ${(y + 0.95) * s}Z"/>` : `<path d="M${(x + 0.05) * s} ${ey * s}L${(x + 0.5) * s} ${(ey + dy * 0.95) * s}L${(x + 0.95) * s} ${ey * s}Z"/>`; } }); }
    if (par) out.push(`<g fill="rgba(8,24,30,.4)">${sh}</g><g fill="#6e675c" stroke="#2b2520" stroke-width="${Math.max(0.5, s * 0.05).toFixed(2)}">${cut}</g><g fill="#a39b8c" stroke="#2b2520" stroke-width="${Math.max(0.5, s * 0.05).toFixed(2)}">${par}</g>`); }
  // The beast market: pens of hurdles on the trodden ground, sheep and cattle in some.
  if (T.pen && inBox(T.pen.x, T.pen.y, T.pen.w, T.pen.h, 2)) { const P = T.pen, rr = genRng(tnH(T.seed, "pen")), long = P.w >= P.h; let fn = `M${(P.x + 0.3) * s} ${(P.y + 0.3) * s}H${(P.x + P.w - 0.3) * s}V${(P.y + P.h - 0.3) * s}H${(P.x + 0.3) * s}Z`, an = "";
    const mid = long ? P.y + Math.floor(P.h / 2) - 1 : P.x + Math.floor(P.w / 2) - 1; // an alley of 2 down the middle
    for (let k = 4; k < (long ? P.w : P.h) - 1; k += 4) fn += long ? `M${(P.x + k) * s} ${(P.y + 0.3) * s}V${mid * s}M${(P.x + k) * s} ${(mid + 2) * s}V${(P.y + P.h - 0.3) * s}` : `M${(P.x + 0.3) * s} ${(P.y + k) * s}H${mid * s}M${(mid + 2) * s} ${(P.y + k) * s}H${(P.x + P.w - 0.3) * s}`;
    fn += long ? `M${(P.x + 0.3) * s} ${mid * s}H${(P.x + P.w - 0.3) * s}M${(P.x + 0.3) * s} ${(mid + 2) * s}H${(P.x + P.w - 0.3) * s}` : `M${mid * s} ${(P.y + 0.3) * s}V${(P.y + P.h - 0.3) * s}M${(mid + 2) * s} ${(P.y + 0.3) * s}V${(P.y + P.h - 0.3) * s}`;
    for (let i = 0; i < P.w * P.h * 0.09; i++) { const x = P.x + 0.8 + rr() * (P.w - 1.6), y = P.y + 0.8 + rr() * (P.h - 1.6); if ((long ? Math.abs(y - mid - 1) : Math.abs(x - mid - 1)) < 1.4) continue; const cow = rr() < 0.3, a = rr() * 360;
      an += `<g transform="translate(${(x * s).toFixed(1)} ${(y * s).toFixed(1)}) rotate(${a.toFixed(0)})"><ellipse rx="${(s * (cow ? 0.55 : 0.32)).toFixed(1)}" ry="${(s * (cow ? 0.3 : 0.24)).toFixed(1)}" fill="${cow ? ["#6b4a2e", "#3e3128", "#a08a6a"][Math.floor(rr() * 3)] : "#e6e0d2"}" stroke="#2b2520" stroke-width="${Math.max(0.4, s * 0.03).toFixed(2)}"/><circle cx="${(s * (cow ? 0.6 : 0.34)).toFixed(1)}" r="${(s * (cow ? 0.17 : 0.12)).toFixed(1)}" fill="${cow ? "#2e241c" : "#3a332c"}"/></g>`; }
    out.push(`<path d="${fn}" stroke="#4a3522" stroke-width="${(s * 0.2).toFixed(1)}" fill="none"/><path d="${fn}" stroke="#8a6a40" stroke-width="${(s * 0.1).toFixed(1)}" fill="none" stroke-dasharray="${(s * 0.3).toFixed(1)} ${(s * 0.12).toFixed(1)}"/>${an}`); }
  // Gallows Hill: a grassy mound and the gallows on it.
  if (T.gallows && inBox(T.gallows.x, T.gallows.y, 6, 6, 2)) { const X = (T.gallows.x + 3) * s, Y = (T.gallows.y + 3) * s;
    out.push(`<ellipse cx="${X + s * 0.3}" cy="${Y + s * 0.4}" rx="${s * 3}" ry="${s * 2.6}" fill="rgba(20,25,10,.3)"/><ellipse cx="${X}" cy="${Y}" rx="${s * 3}" ry="${s * 2.6}" fill="hsl(88 28% 36%)"/><ellipse cx="${X - s * 0.4}" cy="${Y - s * 0.4}" rx="${s * 1.9}" ry="${s * 1.5}" fill="hsl(84 30% 42%)"/><path d="M${X - s * 1.2} ${Y}H${X + s * 1.2}" stroke="#3a2a1a" stroke-width="${s * 0.3}"/><rect x="${X - s * 1.35}" y="${Y - s * 0.2}" width="${s * 0.4}" height="${s * 0.4}" fill="#2a1d12"/><rect x="${X + s * 0.95}" y="${Y - s * 0.2}" width="${s * 0.4}" height="${s * 0.4}" fill="#2a1d12"/><circle cx="${X}" cy="${Y + s * 0.35}" r="${s * 0.16}" fill="none" stroke="#7a6a50" stroke-width="${s * 0.06}"/>`); }
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
    // The cathedral close's wall (lower and thinner than the town's), gate piers either side of its gate.
    { const cw = runs(v => v === TNT.CWALL); if (cw) { let ln = ""; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (at(x, y) !== TNT.CWALL) continue; for (const [dx, dy] of N4w) { if (at(x + dx, y + dy) === TNT.CWALL) continue; ln += dx ? `M${(x + (dx > 0 ? 1 : 0)) * s} ${y * s}v${s}` : `M${x * s} ${(y + (dy > 0 ? 1 : 0)) * s}h${s}`; } }
      const cl = (T.churches || []).find(c => c.close), gp = cl && cl.gate ? cl.gate.map(([x, y]) => { const piers = []; for (const [dx, dy] of N4w) if (at(x + dx, y + dy) === TNT.CWALL) piers.push(`<rect x="${(x + dx * 0.75 + 0.1) * s}" y="${(y + dy * 0.75 + 0.1) * s}" width="${s * 0.8}" height="${s * 0.8}"/>`); return piers.join(""); }).join("") : "";
      out.push(`<path d="${cw}" fill="#9d958a"/><path d="${ln}" stroke="#2b2520" stroke-width="${Math.max(1, s * 0.08)}" fill="none"/><g fill="#b3ab9c" stroke="#2b2520" stroke-width="${Math.max(0.5, s * 0.05)}">${gp}</g>`); } }
    (T.booms || []).forEach(([ax, ay, bx2, by2]) => { if (!inBox(Math.min(ax, bx2), Math.min(ay, by2), Math.abs(bx2 - ax), Math.abs(by2 - ay), 2)) return; out.push(`<path d="M${ax * s} ${ay * s}L${bx2 * s} ${by2 * s}" stroke="#1a1612" stroke-width="${s * 0.3}" stroke-dasharray="${s * 0.35} ${s * 0.15}" fill="none"/><path d="M${ax * s} ${ay * s}L${bx2 * s} ${by2 * s}" stroke="#6a6258" stroke-width="${s * 0.12}" stroke-dasharray="${s * 0.35} ${s * 0.15}" fill="none"/>`); });
    T.towers.forEach(t => { if (!inBox(t.x, t.y, 4, 4, 2)) return; const X = (t.cx != null ? t.cx : t.x + 2) * s, Y = (t.cy != null ? t.cy : t.y + 2) * s; let m = "";
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; m += `<rect x="${(X + Math.cos(a) * s * 1.7 - s * 0.16).toFixed(1)}" y="${(Y + Math.sin(a) * s * 1.7 - s * 0.16).toFixed(1)}" width="${s * 0.32}" height="${s * 0.32}" transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${(X + Math.cos(a) * s * 1.7).toFixed(1)} ${(Y + Math.sin(a) * s * 1.7).toFixed(1)})"/>`; }
      if (t.old) m = m.split("/>").filter((q, i) => q && (i * 7) % 5 > 1).map(q => q + "/>").join(""); // the old gate towers: merlons gone here and there, darker with age
      out.push(`<circle cx="${X + s * 0.15}" cy="${Y + s * 0.2}" r="${s * 2}" fill="rgba(0,0,0,.3)"/><circle cx="${X}" cy="${Y}" r="${s * 2}" fill="${t.old ? "#7d766a" : "#8f877a"}" stroke="#2b2520" stroke-width="${Math.max(1, s * 0.1)}"/><circle cx="${X}" cy="${Y}" r="${s * 1.45}" fill="#a39b8c" stroke="#2b2520" stroke-width="${Math.max(0.5, s * 0.05)}"/><g fill="#6e675c" stroke="#2b2520" stroke-width="${Math.max(0.5, s * 0.03)}">${m}</g>`); }); }
  // Buildings sit in the ground: a soft shadow under each.
  { let sh = ""; T.buildings.forEach(b => { if (!inBox(b.x, b.y, b.w, b.h, 2) || b.castle) return; const B = tnB(b.o), tf = vgTurn(b.k, B.W, B.H);
      (B.F.wings && B.F.wings.length ? B.F.wings : [{ x: 0, y: 0, w: B.W, h: B.H }]).forEach(g => { const R = tnRectTurn(tf, g); sh += `<rect x="${(b.x + R.x + 0.15) * s}" y="${(b.y + R.y + 0.25) * s}" width="${R.w * s}" height="${R.h * s}"/>`; }); });
    if (sh) out.push(`<filter id="tnsh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(s * 0.4).toFixed(1)}"/></filter><g filter="url(#tnsh)" fill="rgba(20,25,10,.5)">${sh}</g>`); }
  const vbx = box[0] * s, vby = box[1] * s;
  // A city's mana grid: conduits set in the cobbles down one side of each main street from the market to the wall, glowing
  // faintly, a node plate every so often (fed from the bleed towers, feeding the lamps).
  if (T.city && (T.lamps || []).length) { let cd = "", nd = ""; T.streets.forEach(st2 => { let on = false; for (let t = 1; t < st2.tW - 3; t++) { const c = st2.cs[t], [x, y] = st2.horiz ? [st2.x0 + st2.ux * t, c - 2] : [c - 2, st2.y0 + st2.uy * t], v = at(x, y);
      const good = (v === TNT.STREET || v === TNT.BRIDGE) && x >= x0 - 2 && x <= x1 + 1 && y >= y0 - 2 && y <= y1 + 1 && (t === 1 || st2.cs[t - 1] === c); const px = (x + (st2.horiz ? 0.5 : 0.72)) * s, py = (y + (st2.horiz ? 0.72 : 0.5)) * s;
      if (good) { cd += `${on ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`; on = true; if (t % 14 === 7) nd += `<rect x="${(px - s * 0.3).toFixed(1)}" y="${(py - s * 0.3).toFixed(1)}" width="${(s * 0.6).toFixed(1)}" height="${(s * 0.6).toFixed(1)}" transform="rotate(45 ${px.toFixed(1)} ${py.toFixed(1)})"/>`; } else on = false; } });
    if (cd) out.push(`<path d="${cd}" stroke="#55d6ff" stroke-width="${(s * 0.6).toFixed(1)}" opacity=".12" fill="none" stroke-linecap="round"/><path d="${cd}" stroke="#2a3338" stroke-width="${Math.max(1, s * 0.2).toFixed(1)}" fill="none"/><path d="${cd}" stroke="#a8f2ff" stroke-width="${Math.max(0.6, s * 0.08).toFixed(2)}" opacity=".85" fill="none"/><g fill="#2a3338" stroke="#a8f2ff" stroke-width="${Math.max(0.5, s * 0.05).toFixed(2)}">${nd}</g>`); }
  // Core lamps: a post at the edge of the way with a glowing core on top.
  (T.lamps || []).forEach(l => { if (!inBox(l.x, l.y, 1, 1, 2)) return; const px = (l.x + 0.5 + l.side[0] * 0.3) * s, py = (l.y + 0.5 + l.side[1] * 0.3) * s;
    out.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(s * 1.6).toFixed(1)}" fill="#ffe3a0" opacity=".13"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(s * 0.22).toFixed(1)}" fill="#3a3530"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(s * 0.12).toFixed(1)}" fill="#f5d36a"/>`); });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbx} ${vby} ${box[2] * s} ${box[3] * s}" width="${box[2] * s}" height="${box[3] * s}">${out.join("")}</svg>`;
}
// Roofs for the preview: each wing a hipped roof in the building's colour (the real roofs are drawn for the tabletop).
function tnRoofsSvg(T, s) { // each building's own roof shape, small and plain, turned as it stands
  let out = ""; T.buildings.forEach(b => { const B = tnB(b.o), odd = b.k % 2, Wt = odd ? B.H : B.W, Ht = odd ? B.W : B.H, sc = s / 10;
    out += `<g transform="translate(${((b.x + Wt / 2) * s).toFixed(1)} ${((b.y + Ht / 2) * s).toFixed(1)}) rotate(${(b.k || 0) * 90}) scale(${sc}) translate(${-B.W * 5} ${-B.H * 5})">${b.type === "castle" ? `<image href="${genUrl(genRoofSvg(B, b.o.seed))}" width="${B.W * 10}" height="${B.H * 10}"/>` : genRoofFlat(B, b.o.seed)}</g>`; });
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
function tnName(b) { if (b.label) return b.label; return b.type === "markethall" ? "Market hall" : b.type === "temple" ? "Parish church" : b.type === "gatehouse" ? `${({ E: "East", W: "West", N: "North", S: "South" })[b.front]} gate` : genType(b.type).name; }
function tnTownPage(o) {
  const T = genTown(o), objs = [], walls = [], areas = [], id = () => vid("o"), P = GEN_PX; let maxL = 1, minL = 0;
  const px = genDetailPx(), TS = Math.min(32, Math.floor(2600 / px)); for (let ty = 0; ty < T.H; ty += TS) for (let tx = 0; tx < T.W; tx += TS) { const w = Math.min(TS, T.W - tx), h = Math.min(TS, T.H - ty); objs.push({ id: id(), layer: "map", level: 0, x: tx, y: ty, w, h, px: 40, land: 1, img: "", vb: [tx, ty, w, h] }); }
  const bld = [];
  T.buildings.forEach(b => { const sh = tnShell(b); objs.push(...sh.objs); walls.push(...sh.walls); areas.push(...sh.areas); maxL = Math.max(maxL, sh.top); if (sh.cellar) minL = -1;
    const name = tnName(b); bld.push({ id: b.id, o: b.o, x: b.x, y: b.y, k: b.k, w: b.w, h: b.h, top: sh.top, name, type: b.type });
    if (o.names !== false) { const lw = b.w + 8, lh = Math.max(3, b.h); objs.push({ id: id(), layer: "gm", level: sh.top, x: b.x - 4, y: b.y + (b.h - lh) / 2, w: lw, h: lh, bld: b.id, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lw * P} ${lh * P}" width="${lw * P}" height="${lh * P}"><text x="${lw * P / 2}" y="${lh * P / 2}" font-family="Georgia,serif" font-size="28" font-weight="bold" fill="#f1e6cf" stroke="#1e1a16" stroke-width="6" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(name)}</text></svg>`) }); } });
  // The town wall and its towers: walls along both faces (nothing gets through but by the gates).
  // A city's names (streets, the quay, the river, the close) for the GM, over the roofs.
  if (o.names !== false) (T.labels || []).forEach(l => { const fs = l.k === "water" ? 44 : 34, lw = Math.max(8, Math.ceil(l.text.length * fs * 0.62 / P) + 2), lh = 3, vert = l.vert;
    objs.push({ id: id(), layer: "gm", level: maxL, x: l.x - lw / 2, y: l.y - lh / 2, w: lw, h: lh, rot: vert ? 90 : undefined, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lw * P} ${lh * P}" width="${lw * P}" height="${lh * P}"><text x="${lw * P / 2}" y="${lh * P / 2}" font-family="Georgia,serif" font-size="${fs}" font-style="italic" font-weight="bold" fill="${l.k === "water" ? "#d6f3ff" : "#ffe3a0"}" stroke="#1e1a16" stroke-width="6" paint-order="stroke" text-anchor="middle" dominant-baseline="central" letter-spacing="2">${esc(l.text)}</text></svg>`) }); });
  if (T.walled) { const blk = (x, y) => { if (x < 0 || y < 0 || x >= T.W || y >= T.H) return false; const v = T.G[y * T.W + x]; return v === TNT.WALL || v === TNT.TOWER || v === TNT.CWALL; }, gb = (x, y) => x >= 0 && y >= 0 && x < T.W && y < T.H && T.G[y * T.W + x] === TNT.GATEB;
    for (let y = 0; y <= T.H; y++) for (let x = 0; x < T.W; x++) { const a = blk(x, y - 1), c = blk(x, y); if (a !== c && !gb(x, a ? y : y - 1)) walls.push([x, y, x + 1, y, 0]); }
    for (let x = 0; x <= T.W; x++) for (let y = 0; y < T.H; y++) { const a = blk(x - 1, y), c = blk(x, y); if (a !== c && !gb(a ? x : x - 1, y)) walls.push([x, y, x, y + 1, 0]); } }
  const names = { "-1": "Cellars", 0: "Ground" }; for (let l = 1; l <= maxL; l++) names[l] = l === maxL ? "Roofs" : `Floor ${l + 1} & roofs`;
  return { T, page: { w: T.W, h: T.H, bg: "#5d7a3a", grid: true, light: false, fogMem: true, objs, walls: genMergeWalls(walls), areas, links: [], levelNames: names, minLevel: minL, maxLevel: maxL,
    town: { px, o: Object.assign({}, o), bld, live: {}, fp: {}, pin: {}, img: {}, flib: JSON.parse(JSON.stringify(genFurnStore())) } } };
}
// A picture, uploaded with its smaller copies (genPyramid); the same picture again (a chair, the same floor rebuilt) reuses them.
async function tnUpload(svgUrl, w, h, cache, px) {
  const key = tnH(svgUrl) + ":" + svgUrl.length + ":" + (px || 40); if (cache[key]) return typeof cache[key] === "string" ? { img: cache[key] } : cache[key]; if (!S.assets || !S.assets.upload) return { img: svgUrl };
  try { const r = await genPyramid(svgUrl, w, h, px || genDetailPx()); cache[key] = r.lod ? { img: r.img, lod: r.lod } : { img: r.img }; return cache[key]; } catch (e) { return { img: svgUrl }; } }
async function tnPlace(camp, o) {
  tnProgress("Laying out the town…", 0); await new Promise(res => setTimeout(res, 40));
  try { await tnPlaceRun(camp, o); } finally { tnProgress(null); } }
// The whole town in one picture (ground and roofs) for when the map is zoomed far out: one picture on the board instead
// of hundreds (the board swaps to it below 30% zoom).
async function tnOverview(T, page) {
  if (!S.assets || !S.assets.upload) return null; const k = 8, cv = document.createElement("canvas"); cv.width = T.W * k; cv.height = T.H * k; const g = cv.getContext("2d");
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  g.drawImage(await load(genUrl(tnTerrainSvg(T, k))), 0, 0, cv.width, cv.height);
  for (const ob of page.objs.filter(x => x.roof && String(x.img).startsWith("data:image/svg"))) { try { const im = await load(ob.img); g.save(); g.translate((ob.x + ob.w / 2) * k, (ob.y + ob.h / 2) * k); if (ob.rot) g.rotate(ob.rot * Math.PI / 180); g.drawImage(im, -ob.w / 2 * k, -ob.h / 2 * k, ob.w * k, ob.h * k); g.restore(); } catch (e) { } }
  const blob = await new Promise(res => cv.toBlob(res, "image/webp", 0.85)); cv.width = cv.height = 0; if (!blob) return null;
  return assetPath(await S.assets.upload(new File([blob], "town-overview.webp", { type: blob.type || "image/webp" }))); }
async function tnPlaceRun(camp, o) {
  const { T, page } = tnTownPage(o), cache = page.town.img, todo = page.objs.filter(ob => ob.land || String(ob.img).startsWith("data:image/svg"));
  tnProgress("Drawing the town from afar…", 0); try { const ov = await tnOverview(T, page); if (ov) page.objs.unshift({ id: vid("o"), layer: "map", level: 0, x: 0, y: 0, w: T.W, h: T.H, img: ov, far: 1 }); } catch (e) { }
  // A few at a time: while one picture is drawn the others upload.
  let n = 0; const one = async ob => { if (ob.land) { const svg = genUrl(tnTerrainSvg(T, ob.px, ob.vb)); delete ob.vb; delete ob.land; delete ob.px; ob.img = svg; }
    const r = await tnUpload(ob.img, ob.w, ob.h, cache, page.town.px); ob.img = r.img; if (r.lod) ob.lod = r.lod; if (++n % 2 === 0) tnProgress(`Drawing the town… ${n} of ${todo.length} pictures`, n / todo.length); };
  tnProgress(`Drawing the town… 0 of ${todo.length} pictures`, 0);
  for (let i = 0; i < todo.length; i += 4) await Promise.all(todo.slice(i, i + 4).map(one));
  const pid = vid("p"), order = vPages(camp).length, nm = o.name || (TN_SIZES[o.size] || TN_SIZES.medium).name; tnProgress("Saving the map…", 1);
  await vSave("vttpages/" + pid, Object.assign(page, { camp, name: nm, order, folder: o.size === "city" ? "Cities" : "Towns", open: false, created: new Date().toISOString() }));
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
  for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(async ob => { const k = ob.img; if (!seen.has(k)) seen.set(k, tnUpload(k, ob.w, ob.h, cache, p.town.px)); const r = await seen.get(k); ob.img = r.img; if (r.lod) ob.lod = r.lod; }));
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
function viewTownGen(camp, mode) {
  const c = S.vttCamps && S.vttCamps.get(camp), city = mode === "city";
  if (!TNV.o || TNV.o.camp !== camp || (TNV.o.size === "city") !== city) { TNV.o = Object.assign(tnDefaults(), { camp }, city ? { size: "city", river: "yes", castle: "yes" } : {}); TNV.T = null; TNV.view = null; }
  if (city) return viewCityGen(camp, c);
  const o = TNV.o, seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? "on" : ""}" data-act="tvopt" data-k="${k}" data-v="${v}" aria-pressed="${String(o[k]) === String(v)}">${l}</button>`).join("")}</div>`;
  return `<section class="page genpage"><a href="#gen-${esc(camp)}" class="vback">← Generator</a><h1>🏘 Town</h1>
    <p class="muted">Main streets from the gates to the market place, burgage plots along them with gardens behind, back lanes, the church, the wall and its towers, houses outside the gates and the town fields. On the tabletop each building opens up when someone comes near it.</p>
    <div class="genlayout"><div class="genopts">
      <label><span>Size</span>${seg("size", [["small", "Small"], ["medium", "Medium"], ["large", "Large"]])}</label>
      <label><span>Walls</span>${seg("walls", [["auto", "Maybe"], ["yes", "Yes"], ["no", "No"]])}</label>
      <label><span>Magic <small class="muted">relay post, transponder and core shops; big towns a bleed tower and lit streets (every town has its Guild branch either way)</small></span>${seg("magic", [["yes", "Yes"], ["no", "No"]])}</label>
      <label><span>Gates <small class="muted">main roads in</small></span>${seg("gates", [["auto", "Any"], [2, "2"], [3, "3"], [4, "4"]])}</label>
      <label><span>Roads in <small class="muted">to the gates</small></span>${seg("roads", [["centre", "From the centre"], ["edges", "From the map edges"]])}</label>
      <div class="tvents"><button class="btn small ${TNV.pick ? "" : "ghost"}" data-act="tvpick" aria-pressed="${!!TNV.pick}">📍 ${TNV.pick ? "Done picking" : "Pick road entrances"}</button>${(o.entries || []).length ? `<span class="small muted">${o.entries.length} entrance${o.entries.length === 1 ? "" : "s"} · <button class="linkbtn" data-act="tventclear">let it choose</button></span>` : ""}</div>
      ${TNV.pick ? `<p class="small muted gedhint">Click near the edge of the map to add an entrance, drag one along the edge to move it, click one to take it away. Each side with an entrance gets a gate.</p>` : ""}
      <label><span>Streets</span>${seg("streets", [["dirt", "Dirt"], ["mixed", "Mixed"], ["stone", "Stone"]])}</label>
      <label class="genchk"><input type="checkbox" data-act="tvchk" data-k="furn"${o.furn !== false ? " checked" : ""}> <span>Furniture <small class="muted">in every building</small></span></label>
      <label class="genchk"><input type="checkbox" data-act="tvchk" data-k="names"${o.names !== false ? " checked" : ""}> <span>Names <small class="muted">on the preview, and for the GM over the roofs</small></span></label>
      ${genDetailSeg()}
      <button class="btn" data-act="tvroll">🎲 New town</button>
      <label><span>Seed</span><input id="tv-seed" type="number" value="${o.seed}"></label><hr>
      <label><span>Name</span><input id="tv-name" type="text" value="${esc(o.name || "")}" placeholder="${esc((TN_SIZES[o.size] || TN_SIZES.medium).name)}"></label>
      <button class="btn" data-act="tvplace" data-camp="${esc(camp)}">Place in the campaign</button>
      <p class="muted small">A medium town takes a minute to draw. Insides open up on the GM's screen as tokens come near, so keep it open while you play.</p>
    </div><div class="genpreview"><div id="tv-stats" class="small"></div><div class="tvview" id="tv-view"><div class="tvstage" id="tv-stage"></div></div><p class="muted small">Scroll or pinch to zoom, drag to look round. Click a building to look inside.</p><div id="tv-look"></div></div></div></section>`;
}
const tvKey = () => JSON.stringify([TNV.o.seed, TNV.o.size, TNV.o.walls, TNV.o.gates, TNV.o.streets, TNV.o.roads, TNV.o.magic, TNV.o.entries || [], TNV.o.river, TNV.o.castle]);
// The city page: #gen-<camp>/city (the town generator, a city's size and its own things).
function viewCityGen(camp, c) {
  const o = TNV.o, seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? "on" : ""}" data-act="tvopt" data-k="${k}" data-v="${v}" aria-pressed="${String(o[k]) === String(v)}">${l}</button>`).join("")}</div>`;
  return `<section class="page genpage"><a href="#gen-${esc(camp)}" class="vback">← Generator</a><h1>🏰 City</h1>
    <p class="muted">Laid out as real medieval cities grew: the old town inside the line of its first wall (now a street, two of the old gate towers still standing) with the market, the city hall and the Guild hall, the cathedral in its walled close; the newer wall round the whole with its gates and towers; main streets from the gates to the market, named for where they go or the trade along them; the river with its bridges and quays, warehouses along them; the castle at the edge, part of the wall; a parish church in each quarter; outside the gates the suburbs, the beast market, the leper hospital and Gallows Hill, the tanners and dyers downstream. Every building opens up as someone comes near.</p>
    <div class="genlayout"><div class="genopts">
      <label><span>River <small class="muted">through the city, with bridges and quays</small></span>${seg("river", [["yes", "Yes"], ["no", "No"]])}</label>
      <label><span>Castle <small class="muted">at the edge, part of the wall</small></span>${seg("castle", [["yes", "Yes"], ["no", "No"]])}</label>
      <label><span>Magic <small class="muted">the relay tower, transponder and core shops, bleed towers, the mana grid down the main streets and the lamps</small></span>${seg("magic", [["yes", "Yes"], ["no", "No"]])}</label>
      <label><span>Roads in <small class="muted">to the gates</small></span>${seg("roads", [["centre", "From the centre"], ["edges", "From the map edges"]])}</label>
      <div class="tvents"><button class="btn small ${TNV.pick ? "" : "ghost"}" data-act="tvpick" aria-pressed="${!!TNV.pick}">📍 ${TNV.pick ? "Done picking" : "Pick road entrances"}</button>${(o.entries || []).length ? `<span class="small muted">${o.entries.length} entrance${o.entries.length === 1 ? "" : "s"} · <button class="linkbtn" data-act="tventclear">let it choose</button></span>` : ""}</div>
      ${TNV.pick ? `<p class="small muted gedhint">Click near the edge of the map to add an entrance, drag one along the edge to move it, click one to take it away. Each side with an entrance gets a gate.</p>` : ""}
      <label><span>Streets</span>${seg("streets", [["dirt", "Dirt"], ["mixed", "Mixed"], ["stone", "Stone"]])}</label>
      <label class="genchk"><input type="checkbox" data-act="tvchk" data-k="furn"${o.furn !== false ? " checked" : ""}> <span>Furniture <small class="muted">in every building</small></span></label>
      <label class="genchk"><input type="checkbox" data-act="tvchk" data-k="names"${o.names !== false ? " checked" : ""}> <span>Names <small class="muted">of streets and buildings, on the preview, and for the GM on the map</small></span></label>
      ${genDetailSeg()}
      <button class="btn" data-act="tvroll">🎲 New city</button>
      <label><span>Seed</span><input id="tv-seed" type="number" value="${o.seed}"></label><hr>
      <label><span>Name</span><input id="tv-name" type="text" value="${esc(o.name || "")}" placeholder="City"></label>
      <button class="btn" data-act="tvplace" data-camp="${esc(camp)}">Place in the campaign</button>
      <p class="muted small">A city is about 2,100 × 1,800 ft and takes a few minutes to draw. As in a town, the insides open up on the GM's screen as tokens come near, so keep it open while you play.</p>
    </div><div class="genpreview"><div id="tv-stats" class="small"></div><div class="tvview" id="tv-view"><div class="tvstage" id="tv-stage"></div></div><p class="muted small">Scroll or pinch to zoom, drag to look round. Click a building to look inside.</p><div id="tv-look"></div></div></div></section>`;
}
// The loading screen: a spinner (it keeps turning while the town is worked out) and, when there's a count, a bar.
// A long job (drawing a whole town) shows a progress bar at the foot of the screen instead, and doesn't block anything.
function tnProgress(msg, pct) {
  let el = document.getElementById("tnprog"); if (!msg) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "tnprog"; el.className = "tnprog"; el.setAttribute("role", "status"); el.innerHTML = `<span></span><div class="tnbar"><i></i></div>`; document.body.appendChild(el); }
  el.firstChild.textContent = msg; el.querySelector(".tnbar i").style.width = Math.round((pct || 0) * 100) + "%"; }
function tnBusy(msg, pct, over) {
  let el = document.getElementById("tnbusy"); if (!msg) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "tnbusy"; el.className = "tnbusy" + (over ? " inside" : ""); el.setAttribute("role", "status"); el.innerHTML = `<div class="tnbox"><div class="tnspin" aria-hidden="true"></div><p></p><div class="tnbar" hidden><i></i></div></div>`; (over || document.body).appendChild(el); }
  el.querySelector("p").textContent = msg; const bar = el.querySelector(".tnbar"); bar.hidden = pct == null; if (pct != null) bar.firstChild.style.width = Math.round(pct * 100) + "%"; }
// Redraw the options column (keeping the preview as it is).
function tvSideRefresh() { const box = document.querySelector(".genpage .genopts"), c = TNV.o && TNV.o.camp; if (!box || !c) return; const tmp = document.createElement("div"); tmp.innerHTML = viewTownGen(c, TNV.o.size === "city" ? "city" : "town"); const nb = tmp.querySelector(".genopts"); if (nb) box.innerHTML = nb.innerHTML; }
function tvBuild() { const o = TNV.o, t0 = performance.now(); TNV.T = genTown(o); TNV.ms = Math.round(performance.now() - t0); TNV.sel = null; }
function tvRender() {
  const st = document.getElementById("tv-stage"); if (!st || !TNV.o) return; if (!TNV.T || TNV.T.o !== TNV.o || TNV.T.key !== tvKey()) { if (!TNV.building) { TNV.building = 1; tnBusy("Laying out the town…", null, document.getElementById("tv-view")); setTimeout(() => { try { tvBuild(); TNV.T.key = tvKey(); } finally { TNV.building = 0; tnBusy(null); } tvRender(); }, 40); } return; }
  const T = TNV.T, s = 4; st.style.width = T.W * s + "px"; st.style.height = T.H * s + "px";
  st.innerHTML = `<img src="${genUrl(tnTerrainSvg(T, s))}" alt="" draggable="false"><svg class="tvroofs" viewBox="0 0 ${T.W * s} ${T.H * s}">${tnRoofsSvg(T, s)}${T.buildings.map(b => `<rect class="tvhit${TNV.sel === b.id ? " on" : ""}" data-b="${b.id}" x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s}"><title>${esc(tnName(b))}</title></rect>`).join("")}<g id="tv-names"></g><g id="tv-ents">${tvEntsSvg()}</g></svg>`; TNV.namesZ = null;
  const by = {}; T.buildings.forEach(b => { const n = tnName(b); by[n] = (by[n] || 0) + 1; });
  const ss = document.getElementById("tv-stats"); if (ss) ss.innerHTML = `<strong>${T.W} × ${T.H} squares</strong> <span class="muted">(${T.W * 5} × ${T.H * 5} ft) · ${T.buildings.length} buildings · ${T.walled ? `walled, ${T.gates.length} gates, ${T.towers.length} towers` : "no wall"} · made in ${TNV.ms} ms</span><br><span class="muted">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, k]) => `${k} ${esc(n.toLowerCase())}`).join(", ")}</span>`;
  if (!TNV.view) tvFit(); else tvApply(); }
// The entrances on the preview: a marker on the map's edge, numbered.
function tvEntsSvg() { const T = TNV.T, s = 4; if (!T) return ""; const show = TNV.pick || (TNV.o.entries || []).length; if (!show) return "";
  return (TNV.o.entries || []).map((e, i) => { const [x, y] = tnEntPt(e, T.W, T.H), r = 13 / (TNV.view ? Math.min(1, TNV.view.z) : 1), [nx, ny] = TN_DIR[e[0]], X = x * s - nx * r * 1.2, Y = y * s - ny * r * 1.2;
    return `<g class="tvent" data-i="${i}"><circle cx="${X}" cy="${Y}" r="${r * 1.6}" fill="transparent"/><circle cx="${X}" cy="${Y}" r="${r}" fill="#e8c27a" stroke="#2b2520" stroke-width="2"/><text x="${X}" y="${Y}" font-size="${r * 1.1}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#2b2520">${i + 1}</text></g>`; }).join("")
    + (TNV.pick ? `<rect x="1" y="1" width="${T.W * s - 2}" height="${T.H * s - 2}" fill="none" stroke="#e8c27a" stroke-width="3" stroke-dasharray="10 6" opacity=".8"/>` : ""); }
// Where on the preview a pointer is, in squares, and the nearest point on the map's edge as an entrance.
function tvAt(ev) { const vw = document.getElementById("tv-view").getBoundingClientRect(), v = TNV.view; return [((ev.clientX - vw.left) - v.x) / v.z / 4, ((ev.clientY - vw.top) - v.y) / v.z / 4]; }
function tvEdge(x, y) { const T = TNV.T, d = [["N", y], ["S", T.H - y], ["W", x], ["E", T.W - x]].sort((a, b) => a[1] - b[1])[0][0]; return [d, +(d === "N" || d === "S" ? x / T.W : y / T.H).toFixed(4)]; }
function tvFit() { const vw = document.getElementById("tv-view"); if (!vw || !TNV.T) return; vw.style.height = Math.round(Math.min(innerHeight * 0.72, 820, vw.clientWidth * TNV.T.H / TNV.T.W)) + "px"; const S0 = Math.min(vw.clientWidth / (TNV.T.W * 4), vw.clientHeight / (TNV.T.H * 4)); TNV.view = { z: S0, x: (vw.clientWidth - TNV.T.W * 4 * S0) / 2, y: (vw.clientHeight - TNV.T.H * 4 * S0) / 2 }; tvApply(); }
function tvApply() { const st = document.getElementById("tv-stage"), v = TNV.view; if (st && v) st.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`; tvNames(); }
// The buildings' names over the preview when Names is ticked: each where it fits over its roof at this zoom (more as you zoom
// in); the church, market hall, gates and the magic buildings always.
const TV_KEYNAMES = new Set(["temple", "markethall", "gatehouse", "relaypost", "bleedtower", "guildbranch", "transponder", "coreshop", "cathedral", "castle", "cityhall", "guildhall"]);
function tvNames() { const g = document.getElementById("tv-names"), T = TNV.T, v = TNV.view; if (!g || !T || !v) return;
  if (TNV.o.names === false) { g.innerHTML = ""; TNV.namesZ = null; return; } if (TNV.namesZ === v.z) return; TNV.namesZ = v.z;
  const s = 4, fs = 11 / v.z, placed = [];
  const lab = T.buildings.map(b => ({ b, n: tnName(b), key: TV_KEYNAMES.has(b.type) })).sort((p, q) => (q.key - p.key) || (q.b.w * q.b.h - p.b.w * p.b.h));
  const sl = (T.labels || []).map(l => { const f2 = fs * (l.k === "water" ? 1.5 : 1.25), tw = l.text.length * f2 * 0.6, X = l.x * s, Y = l.y * s, box = l.vert ? [X - f2 * 0.6, Y - tw / 2, X + f2 * 0.6, Y + tw / 2] : [X - tw / 2, Y - f2 * 0.6, X + tw / 2, Y + f2 * 0.6]; placed.push(box);
    return `<text x="${X.toFixed(1)}" y="${Y.toFixed(1)}" font-size="${f2.toFixed(2)}" font-style="italic" font-weight="700" fill="${l.k === "water" ? "#d6f3ff" : l.k === "place" ? "#f1e6cf" : "#ffe3a0"}" stroke="#1a1612" stroke-width="${(f2 * 0.26).toFixed(2)}" paint-order="stroke" text-anchor="middle" dominant-baseline="central" letter-spacing="${(f2 * 0.08).toFixed(2)}"${l.vert ? ` transform="rotate(90 ${X.toFixed(1)} ${Y.toFixed(1)})"` : ""}>${esc(l.text)}</text>`; }).join("");
  g.innerHTML = sl + lab.map(({ b, n, key }) => { const tw = n.length * fs * 0.56, cx = (b.x + b.w / 2) * s, cy = (b.y + b.h / 2) * s;
    if (!key && tw > b.w * s * 1.3 && tw > b.h * s * 1.3) return ""; // too small to name at this zoom
    const box = [cx - tw / 2, cy - fs * 0.6, cx + tw / 2, cy + fs * 0.6]; if (placed.some(q => box[0] < q[2] && q[0] < box[2] && box[1] < q[3] && q[1] < box[3])) return ""; placed.push(box);
    return `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="${fs.toFixed(2)}" font-weight="${key ? 800 : 600}" fill="${key ? "#ffe3a0" : "#fff"}" stroke="#1a1612" stroke-width="${(fs * 0.28).toFixed(2)}" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(n)}</text>`; }).join(""); }
function tvLook(bid) { const el = document.getElementById("tv-look"); if (!el || !TNV.T) return; const b = TNV.T.buildings.find(x => x.id === bid); if (!b) { el.innerHTML = ""; return; } TNV.sel = bid;
  document.querySelectorAll(".tvhit").forEach(r => r.classList.toggle("on", r.dataset.b === bid));
  el.innerHTML = `<h2 class="sect">${esc(tnName(b))}</h2>${genPreviewHtml(Object.assign({}, b.o, { furn: TNV.o.furn !== false }))}`; }
document.addEventListener("click", async ev => {
  const el = ev.target.closest && ev.target.closest("[data-act^=tv]"); if (!el || !TNV.o) return; const a = el.dataset.act, o = TNV.o;
  if (a === "tvopt") { o[el.dataset.k] = el.dataset.v; el.parentElement.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === el); x.setAttribute("aria-pressed", x === el); }); TNV.view = null; tvRender(); return; }
  if (a === "tvchk") { o[el.dataset.k] = el.checked; if (el.dataset.k === "names") { TNV.namesZ = null; tvNames(); } return; }
  if (a === "tvpick") { TNV.pick = !TNV.pick; tvSideRefresh(); const g = document.getElementById("tv-ents"); if (g) g.innerHTML = tvEntsSvg(); return; }
  if (a === "tventclear") { o.entries = []; tvSideRefresh(); tvRender(); return; }
  if (a === "tvroll") { o.seed = genSeed(); const s = document.getElementById("tv-seed"); if (s) s.value = o.seed; tvRender(); document.getElementById("tv-look").innerHTML = ""; return; }
  if (a === "tvplace") { const n = document.getElementById("tv-name"); if (n) o.name = n.value.trim(); el.disabled = true; try { await tnPlace(el.dataset.camp, Object.assign({}, o, { camp: undefined })); } finally { el.disabled = false; } return; }
});
document.addEventListener("change", ev => { if (ev.target && ev.target.id === "tv-seed" && TNV.o) { TNV.o.seed = Math.max(1, Math.round(Number(ev.target.value)) || 1); tvRender(); } });
// Zoom and look round the preview: wheel, drag, pinch; a click on a building opens its plan below.
const TVP = { ptrs: new Map(), drag: null };
document.addEventListener("wheel", ev => { const vw = ev.target.closest && ev.target.closest("#tv-view"); if (!vw || !TNV.view) return; ev.preventDefault(); const r = vw.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top, v = TNV.view, f = Math.exp(-ev.deltaY * 0.0015), nz = Math.max(0.05, Math.min(12, v.z * f));
  v.x = px - (px - v.x) * nz / v.z; v.y = py - (py - v.y) * nz / v.z; v.z = nz; tvApply(); }, { passive: false });
document.addEventListener("pointerdown", ev => { const vw = ev.target.closest && ev.target.closest("#tv-view"); if (!vw || !TNV.view) return;
  if (TNV.pick && TNV.T) { const m = ev.target.closest(".tvent"); if (m) { vw.setPointerCapture(ev.pointerId); TVP.ent = { i: Number(m.dataset.i), moved: false, x: ev.clientX, y: ev.clientY }; ev.preventDefault(); return; } } TVP.ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]); vw.setPointerCapture(ev.pointerId); TVP.drag = { x: ev.clientX, y: ev.clientY, vx: TNV.view.x, vy: TNV.view.y, moved: false, t: ev.target }; });
document.addEventListener("pointermove", ev => { if (TVP.ent && TNV.T) { if (Math.abs(ev.clientX - TVP.ent.x) + Math.abs(ev.clientY - TVP.ent.y) > 4) TVP.ent.moved = true;
    if (TVP.ent.moved) { const [x, y] = tvAt(ev); TNV.o.entries[TVP.ent.i] = tvEdge(x, y); const g = document.getElementById("tv-ents"); if (g) g.innerHTML = tvEntsSvg(); } return; }
  if (!TVP.ptrs.has(ev.pointerId) || !TNV.view) return; const prev = TVP.ptrs.get(ev.pointerId); TVP.ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (TVP.ptrs.size === 2) { const [a, b] = [...TVP.ptrs.values()], d1 = Math.hypot(a[0] - b[0], a[1] - b[1]), pa = [...TVP.ptrs.entries()].find(([k]) => k !== ev.pointerId)[1], d0 = Math.hypot(prev[0] - pa[0], prev[1] - pa[1]) || d1, vw = document.getElementById("tv-view").getBoundingClientRect(), mx = (a[0] + b[0]) / 2 - vw.left, my = (a[1] + b[1]) / 2 - vw.top, v = TNV.view, nz = Math.max(0.05, Math.min(12, v.z * d1 / d0));
    v.x = mx - (mx - v.x) * nz / v.z; v.y = my - (my - v.y) * nz / v.z; v.z = nz; if (TVP.drag) TVP.drag.moved = true; tvApply(); return; }
  const d = TVP.drag; if (!d) return; if (Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) > 4) d.moved = true; TNV.view.x = d.vx + ev.clientX - d.x; TNV.view.y = d.vy + ev.clientY - d.y; tvApply(); });
const tvUp = ev => { if (TVP.ent) { const e = TVP.ent; TVP.ent = null; if (!e.moved) TNV.o.entries.splice(e.i, 1); tvRender(); tvSideRefresh(); return; }
  if (!TVP.ptrs.has(ev.pointerId)) return; TVP.ptrs.delete(ev.pointerId); const d = TVP.drag; if (!TVP.ptrs.size) { TVP.drag = null; if (d && !d.moved) { if (TNV.pick && TNV.T) { const [x, y] = tvAt(ev); TNV.o.entries = (TNV.o.entries || []).concat([tvEdge(x, y)]).slice(0, 8); tvRender(); tvSideRefresh(); return; }
      const h = d.t.closest && d.t.closest(".tvhit"); if (h) tvLook(h.dataset.b); } } else if (TVP.ptrs.size === 1 && d) { const [p] = [...TVP.ptrs.values()]; d.x = p[0]; d.y = p[1]; d.vx = TNV.view.x; d.vy = TNV.view.y; } };
document.addEventListener("pointerup", tvUp); document.addEventListener("pointercancel", tvUp);
new MutationObserver(() => { const st = document.getElementById("tv-stage"); if (st && !st.firstChild) { TNV.view = null; tvRender(); } }).observe(document.documentElement, { childList: true, subtree: true });
