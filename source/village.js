// ===== Villages =====
// After the research on medieval villages: most people lived in nucleated villages — houses along a street (a "row" or street
// village), round a green, or at a crossroads — each on a toft (the house and its yard) with a croft (a long garden plot)
// behind, running back from the road, sometimes to a back lane. The church and the manor house stand together, often a little
// apart; the lord's mill sits on the stream; the smithy, the bakehouse and the alehouse near the middle. Around it all: two
// or three great open fields in furlongs of long strips (one lying fallow), meadow by the water, common pasture, and woods at
// the edges. Mining villages grow along the track up to the mine, with spoil heaps by the adit.
// The generation follows the village generators in the research (Emilien et al. 2012; Watabou): the land first (river,
// mountains, woods), then roads grown between the points that matter (routed over the land by least cost, crossing water at a
// bridge), then houses set along the roads facing them, then the farmland and trees filling the rest.
// Squares are 5 ft. Buildings are the building generator's own, each turned to face its road.

const VG = { o: null };
const VGT = { GRASS: 0, ROAD: 1, LANE: 2, WATER: 3, ROCK: 4, WOOD: 5, FIELD: 6, MEADOW: 7, GREEN: 8, PLOT: 9, BUILD: 10, BRIDGE: 11, YARD: 12, POND: 13, SPOIL: 14, PASTURE: 15 };
const VG_SIZES = { hamlet: { W: 96, H: 76, n: [5, 8], R: 16 }, village: { W: 136, H: 104, n: [12, 18], R: 24 }, large: { W: 176, H: 136, n: [22, 30], R: 32 } };
const vgDefaults = () => ({ seed: genSeed(), size: "village", layout: "auto", river: "auto", land: "auto", woods: "some", mine: "auto", furn: true, name: "" });

// Smooth value noise (seeded): fbm(x, y) in about 0..1.
function vgNoise(seed) {
  const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  return (x, y, oct = 4) => { let s = 0, amp = 1, f = 1, tot = 0; for (let i = 0; i < oct; i++) { s += v(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; } return s / tot; };
}
// Least-cost path over the grid (8 ways), for roads: cost(x, y) per square (Infinity = impassable).
function vgPath(W, H, cost, from, to) {
  const N = W * H, g = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
  const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const s = from[1] * W + from[0], t = to[1] * W + to[0]; g[s] = 0; push(s, 0);
  const hz = i => Math.hypot(i % W - to[0], Math.floor(i / W) - to[1]);
  while (heap.length) { const [, i] = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break; const x = i % W, y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (done[j]) continue; const c = cost(nx, ny); if (!isFinite(c)) continue; const ng = g[i] + c * (dx && dy ? 1.414 : 1); if (ng < g[j]) { g[j] = ng; prev[j] = i; push(j, ng + hz(j)); } } }
  if (prev[t] < 0 && s !== t) return null; const out = []; for (let i = t; i >= 0; i = prev[i]) { out.push([i % W, Math.floor(i / W)]); if (i === s) break; } return out.reverse();
}
// A smooth line through points (Catmull-Rom as cubic Béziers), for drawing roads and the river.
function vgSmooth(pts, s) {
  if (pts.length < 2) return ""; const P = pts.map(([x, y]) => [x * s, y * s]); let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
  return d;
}
const vgThin = (path, step) => path.filter((_, i) => i % step === 0 || i === path.length - 1);

// ----- The whole village -----
function genVillage(o) {
  const r = genRng(Number(o.seed) || 1), pick = (opts, v) => v && v !== "auto" ? v : opts[Math.floor(r() * opts.length)];
  const size = VG_SIZES[o.size] ? o.size : "village", Z = VG_SIZES[size], W = Z.W, H = Z.H, R = Z.R;
  const layout = pick(["street", "street", "green", "crossroads"], o.layout), river = pick(["none", "stream", "stream", "river"], o.river), land = pick(["open", "open", "hills", "mountains"], o.land);
  const mine = land === "mountains" && (o.mine === "yes" || (o.mine !== "no" && r() < 0.5));
  const nz = vgNoise((Number(o.seed) || 1) * 7 + 3), nz2 = vgNoise((Number(o.seed) || 1) * 11 + 5);
  const T = new Uint8Array(W * H), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 255 : T[y * W + x], set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) T[y * W + x] = v; };
  const V = { W, H, R, size, layout, river, land, mine, T, roads: [], lanes: [], trees: [], furlongs: [], buildings: [], plots: [], features: [], bridges: [], riverPath: null, riverW: 0, spoil: [], mineAt: null };
  // Mountains along one edge (the river, if any, comes down out of them).
  const edges = ["n", "e", "s", "w"], mEdge = land === "mountains" ? edges[Math.floor(r() * 4)] : null;
  if (mEdge) { const depth = Math.round((mEdge === "n" || mEdge === "s" ? H : W) * (0.18 + r() * 0.08));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const along = mEdge === "n" || mEdge === "s" ? x : y, dist = mEdge === "n" ? y : mEdge === "s" ? H - 1 - y : mEdge === "w" ? x : W - 1 - x;
      const d = depth * (0.65 + nz(along / 18, 3.3, 3) * 0.7); if (dist < d) set(x, y, VGT.ROCK); } }
  if (land === "hills") for (let i = 0; i < 4 + Math.floor(r() * 4); i++) { const cx = Math.floor(r() * W), cy = Math.floor(r() * H), rr = 1.2 + r() * 1.8;
    for (let y = Math.floor(cy - rr - 2); y <= cy + rr + 2; y++) for (let x = Math.floor(cx - rr - 2); x <= cx + rr + 2; x++) if (Math.hypot(x - cx, y - cy) < rr * (0.7 + nz(x / 4, y / 4, 2) * 0.6)) set(x, y, VGT.ROCK); }
  // The heart of the village: near the middle, on open ground.
  let C = [Math.round(W / 2 + (r() - 0.5) * W * 0.12), Math.round(H / 2 + (r() - 0.5) * H * 0.12)];
  if (mEdge) { const push = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[mEdge]; C = [C[0] + push[0] * Math.round(W * 0.06), C[1] + push[1] * Math.round(H * 0.06)]; }
  // The river: from one edge to the opposite one (out of the mountains if there are any), meandering, passing beside the
  // village rather than through its middle.
  if (river !== "none") {
    const vert = mEdge ? (mEdge === "n" || mEdge === "s") : r() < 0.5, len = vert ? H : W, span = vert ? W : H, side = r() < 0.5 ? -1 : 1;
    const base = (vert ? C[0] : C[1]) + side * (R * 0.55 + 6), pts = []; let off = 0, vel = 0;
    for (let t = -4; t <= len + 4; t += 3) { vel = vel * 0.8 + (r() - 0.5) * 2.2; off = Math.max(-span * 0.22, Math.min(span * 0.22, off + vel)); const near = Math.abs(t - (vert ? C[1] : C[0])) < R ? 0.35 : 1; const p = base + off * near; pts.push(vert ? [p, t] : [t, p]); }
    const wd = river === "river" ? 4 + Math.round(r() * 2) : 2; V.riverW = wd; V.riverPath = pts; V.riverVert = vert;
    // Rasterize: every square within half the width of the line.
    for (let i = 0; i < pts.length - 1; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2);
      for (let j = 0; j <= n; j++) { const px = x1 + (x2 - x1) * j / n, py = y1 + (y2 - y1) * j / n, hw = wd / 2;
        for (let y = Math.floor(py - hw); y <= py + hw; y++) for (let x = Math.floor(px - hw); x <= px + hw; x++) if (Math.hypot(x + 0.5 - px, y + 0.5 - py) <= hw + 0.2) set(x, y, VGT.WATER); } }
  }
  // Keep the heart on dry, open ground.
  for (let k = 0; k < 60 && (at(C[0], C[1]) !== VGT.GRASS || [[-3, 0], [3, 0], [0, 3], [0, -3]].some(([a, b]) => at(C[0] + a, C[1] + b) !== VGT.GRASS)); k++) C = [Math.round(W / 2 + (r() - 0.5) * W * 0.4), Math.round(H / 2 + (r() - 0.5) * H * 0.4)];
  V.C = C;
  // Woods: patches toward the edges, away from the village.
  const wAmt = { few: 0.56, some: 0.5, many: 0.44 }[o.woods] || 0.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== VGT.GRASS) continue; const dc = Math.hypot((x - C[0]) / W, (y - C[1]) / H);
    const v = nz2(x / 22, y / 22, 4) + Math.max(0, dc - 0.34) * 1.1 - Math.max(0, 1 - Math.hypot(x - C[0], y - C[1]) / (R * 2.3)) * 0.7; if (v > wAmt + 0.1) set(x, y, VGT.WOOD); }
  // ----- Roads -----
  const roadCost = (x, y) => { const t = at(x, y); if (t === VGT.ROCK) return Infinity; if (t === VGT.WATER) return 9; if (t === VGT.ROAD) return 0.35; if (t === VGT.LANE) return 0.5; if (t === VGT.WOOD) return 2.2; if (t === VGT.BUILD || t === VGT.PLOT) return Infinity; return 1 + nz(x / 6, y / 6, 2) * 1.6; };
  const edgePoint = e => { for (let k = 0; k < 40; k++) { const p = e === "n" ? [Math.floor(W * (0.2 + r() * 0.6)), 0] : e === "s" ? [Math.floor(W * (0.2 + r() * 0.6)), H - 1] : e === "w" ? [0, Math.floor(H * (0.2 + r() * 0.6))] : [W - 1, Math.floor(H * (0.2 + r() * 0.6))]; if (at(p[0], p[1]) !== VGT.ROCK && at(p[0], p[1]) !== VGT.WATER) return p; } return null; };
  const paint = (path, wide, kind) => { path.forEach(([x, y]) => { for (let dy = -wide; dy <= wide; dy++) for (let dx = -wide; dx <= wide; dx++) { if (Math.hypot(dx, dy) > wide + 0.3) continue; const t = at(x + dx, y + dy);
    if (t === VGT.WATER || t === VGT.BRIDGE) { set(x + dx, y + dy, VGT.BRIDGE); } else if (t !== VGT.ROCK && t !== 255 && t !== VGT.ROAD && t !== VGT.BUILD && t !== VGT.PLOT) set(x + dx, y + dy, kind); } }); };
  const freeEdges = edges.filter(e => e !== mEdge), opp = { n: "s", s: "n", e: "w", w: "e" };
  const through = (e1, e2) => { const a = edgePoint(e1), b = edgePoint(e2); if (!a || !b) return null; const p1 = vgPath(W, H, roadCost, a, C), p2 = vgPath(W, H, roadCost, C, b); if (!p1 || !p2) return null; return p1.concat(p2.slice(1)); };
  let e1 = freeEdges[Math.floor(r() * freeEdges.length)], e2 = opp[e1] !== mEdge ? opp[e1] : freeEdges.find(e => e !== e1);
  const main = through(e1, e2); if (main) { V.roads.push(main); paint(main, 1, VGT.ROAD); }
  if (layout === "crossroads") { const rest = freeEdges.filter(e => e !== e1 && e !== e2); const e3 = rest[0] || e1, e4 = opp[e3] !== mEdge && opp[e3] !== e3 ? opp[e3] : null;
    const a = edgePoint(e3), p = a && vgPath(W, H, roadCost, a, C); if (p) { V.roads.push(p); paint(p, 1, VGT.ROAD); }
    if (e4) { const b = edgePoint(e4), q = b && vgPath(W, H, roadCost, C, b); if (q) { V.roads.push(q); paint(q, 1, VGT.ROAD); } } }
  // A green: an irregular open space at the heart, with a pond or a well; houses look onto it.
  if (layout === "green") { const gr = R * 0.32 + r() * 3, gx = C[0] + (r() - 0.5) * 6, gy = C[1] + (r() - 0.5) * 6;
    for (let y = Math.floor(gy - gr * 1.6); y <= gy + gr * 1.6; y++) for (let x = Math.floor(gx - gr * 1.6); x <= gx + gr * 1.6; x++) { const t = at(x, y); if (t === VGT.ROCK || t === VGT.WATER || t === VGT.BRIDGE || t === 255) continue;
      if (Math.hypot((x - gx) / 1.25, y - gy) < gr * (0.75 + nz(x / 5, y / 5, 2) * 0.5)) set(x, y, t === VGT.ROAD ? VGT.ROAD : VGT.GREEN); }
    V.green = [gx, gy, gr]; }
  // ----- Plots: buildings along the roads, facing them -----
  const occupied = t => t !== VGT.GRASS && t !== VGT.WOOD && t !== VGT.GREEN;
  const rectFree = (x, y, w, h, allowGreen) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const t = at(xx, yy); if (t === 255 || (occupied(t) && !(allowGreen && t === VGT.GREEN)) || (!allowGreen && t === VGT.GREEN)) return false; } return true; };
  const fill = (x, y, w, h, v) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, v); };
  // Every spot along a road (or round the green) a building could face: the road square, which side, and which way it faces.
  const fronts = []; const addFronts = (path, hw, weight) => { for (let i = 3; i < path.length - 3; i += 1) { const [x, y] = path[i], dx = path[i + 3][0] - path[i - 3][0], dy = path[i + 3][1] - path[i - 3][1]; if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 2) continue;
      const horiz = Math.abs(dx) > Math.abs(dy); (horiz ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]).forEach(n => fronts.push({ x, y, n, hw, w: weight })); } };
  V.roads.forEach(p => addFronts(p, 1.5, 1));
  if (V.green) { const [gx, gy] = V.green; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== VGT.GREEN) continue;
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => { const t = at(x + dx, y + dy); if (t !== VGT.GREEN && t !== VGT.ROAD && (dx * (x - gx) + dy * (y - gy)) > 0) fronts.push({ x, y, n: [dx, dy], hw: 0.5, w: 0.7, green: 1 }); }); } }
  const kFor = n => n[1] === -1 ? 0 : n[1] === 1 ? 2 : n[0] === -1 ? 3 : 1; // the building's front faces back along n (toward the road)
  // Place a building of this kind at a front: its rect (turned to face the road), set back from the road, and its croft behind.
  const place = (o2, f, extra, B) => {
    const k = extra && extra.k != null ? extra.k : kFor(f.n), bw = k % 2 ? B.H : B.W, bh = k % 2 ? B.W : B.H, sb = extra && extra.setback != null ? extra.setback : 1 + Math.floor(r() * 2), hw = Math.ceil(f.hw);
    let x, y; const [nx, ny] = f.n;
    if (ny === -1) { y = f.y - hw - sb - bh + 1; x = f.x - Math.floor(bw / 2); } else if (ny === 1) { y = f.y + hw + sb; x = f.x - Math.floor(bw / 2); }
    else if (nx === -1) { x = f.x - hw - sb - bw + 1; y = f.y - Math.floor(bh / 2); } else { x = f.x + hw + sb; y = f.y - Math.floor(bh / 2); }
    const m = 1; if (!rectFree(x - m, y - m, bw + m * 2, bh + m * 2)) return null;
    // The croft runs back from the house, as wide as the toft; shortened where it meets something.
    const cd = extra && extra.croft != null ? extra.croft : 5 + Math.floor(r() * 8), wide = extra && extra.wide != null ? extra.wide : Math.floor(r() * 2); let plot = null;
    for (let d = cd; d >= 1; d--) { let px, py, pw, ph; if (ny) { px = x - wide; pw = bw + wide * 2; ph = bh + d + sb; py = ny === -1 ? y - d : y - sb; } else { py = y - wide; ph = bh + wide * 2; pw = bw + d + sb; px = nx === -1 ? x - d : x - sb; }
      if (rectFree(px, py, pw, ph, f.green)) { plot = { x: px, y: py, w: pw, h: ph }; break; } }
    if (!plot) plot = { x: x - 1, y: y - 1, w: bw + 2, h: bh + 2 };
    fill(plot.x, plot.y, plot.w, plot.h, VGT.PLOT); fill(x, y, bw, bh, VGT.BUILD);
    const b = { o: o2, B, k, x, y, w: bw, h: bh, plot, front: f.n, kind: o2.type }; V.buildings.push(b); V.plots.push(Object.assign({ b }, plot)); return b; };
  // Who lives here: the church and manor, the mill, smithy, bakehouse and alehouse, farms with barns, and cottages.
  const nB = Z.n[0] + Math.floor(r() * (Z.n[1] - Z.n[0] + 1)), want = [];
  const sizeOf = (kind, big) => big ? (r() < 0.5 ? "large" : "medium") : kind === "cottage" ? (r() < 0.4 ? "small" : "medium") : ["small", "medium", "medium"][Math.floor(r() * 3)];
  if (size !== "hamlet" || r() < 0.5) want.push({ type: "chapel", size: size === "large" ? "large" : size === "village" ? "medium" : "small", pri: 10, near: 0.25, k0: 1 });
  if (size !== "hamlet" && r() < 0.8) want.push({ type: "manor", size: size === "large" ? "large" : "medium", pri: 9, near: 0.75, croft: 14 });
  if (river !== "none" && (size !== "hamlet" || r() < 0.5)) want.push({ type: "mill", size: size === "large" ? "large" : "medium", pri: 8, mill: 1 });
  if (size !== "hamlet") want.push({ type: "blacksmith", size: "small", pri: 7, near: 0.2 });
  if (size === "large" || (size === "village" && r() < 0.6)) want.push({ type: "bakehouse", size: sizeOf("bakehouse"), pri: 6, near: 0.3 });
  if (size === "large" || (size === "village" && r() < 0.7)) want.push({ type: "tavern", size: size === "large" ? "medium" : "small", pri: 6, near: 0.25 });
  if (size === "large" && r() < 0.6) want.push({ type: "stable", size: "medium", pri: 4, near: 0.35 });
  const nFarm = Math.max(1, Math.round(nB * (size === "hamlet" ? 0.45 : 0.3)));
  for (let i = 0; i < nFarm; i++) want.push({ type: "farmhouse", size: sizeOf("farmhouse"), pri: 3, near: 0.7, barn: r() < 0.7, croft: 10 });
  while (want.length < nB) want.push({ type: r() < (size === "large" ? 0.25 : 0.12) ? "house" : "cottage", size: sizeOf("cottage"), pri: 1, near: 0.55 });
  if (mine) for (let i = 0; i < 2 + Math.floor(r() * 3); i++) want.push({ type: "cottage", size: "small", pri: 2, miner: 1 });
  // The mine: an adit in the mountainside nearest the village, a track up to it, spoil heaps beside it.
  if (mine && mEdge) { let best = null; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== VGT.ROCK) continue; if (![[0, 1], [0, -1], [1, 0], [-1, 0]].some(([a, b]) => at(x + a, y + b) === VGT.GRASS || at(x + a, y + b) === VGT.WOOD)) continue;
      const d = Math.hypot(x - C[0], y - C[1]) + r() * 6; if (!best || d < best.d) best = { x, y, d }; }
    if (best) { V.mineAt = [best.x, best.y]; const out = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[mEdge], gate = [best.x + out[0] * 4, best.y + out[1] * 4];
      for (let i = 1; i <= 6; i++) for (let a = -2; a <= 2; a++) { const xx = best.x + out[0] * i + (out[1] ? a : 0), yy = best.y + out[1] * i + (out[0] ? a : 0); if (at(xx, yy) === VGT.WOOD) set(xx, yy, VGT.GRASS); }
      const p = vgPath(W, H, roadCost, C, gate); if (p) { V.lanes.push(p); paint(p, 0, VGT.LANE); addFronts(p, 1, 0.8); fronts.forEach(f => { if (p.some(([x, y]) => x === f.x && y === f.y)) f.mine = 1; }); }
      for (let i = 0; i < 3 + Math.floor(r() * 3); i++) { const sx = gate[0] + Math.round((r() - 0.5) * 10), sy = gate[1] + Math.round((r() - 0.5) * 10), sr = 1.5 + r() * 1.8;
        for (let y = Math.floor(sy - sr); y <= sy + sr; y++) for (let x = Math.floor(sx - sr); x <= sx + sr; x++) if (Math.hypot(x - sx, y - sy) <= sr && (at(x, y) === VGT.GRASS || at(x, y) === VGT.WOOD)) set(x, y, VGT.SPOIL);
        V.spoil.push([sx, sy, sr]); } } }
  want.sort((a, b) => b.pri - a.pri);
  const dC = f => Math.hypot(f.x - C[0], f.y - C[1]) / R;
  const tryPlace = (wb, relax) => { const o2 = wb.o2 || (wb.o2 = { type: wb.type, seed: Math.floor(r() * 1e9) + 1, size: wb.size, floors: "auto", cellar: "auto", shape: "auto", porch: "auto", furn: o.furn !== false });
    let done = null; const B0 = wb.B0 || (wb.B0 = genBuilding(o2));
    if (wb.mill && V.riverPath) { // the mill on the bank: its wheel pit (its left end) on the water
      const cands = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== VGT.WATER) continue; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(n => { const t = at(x + n[0], y + n[1]); if (t === VGT.GRASS || t === VGT.WOOD) cands.push({ x, y, n, d: Math.hypot(x - C[0], y - C[1]) }); }); }
      cands.sort((a, b) => a.d - b.d);
      for (const c of cands.slice(0, 80)) { if (c.d < R * 0.35) continue; const k = c.n[0] === 1 ? 0 : c.n[0] === -1 ? 2 : c.n[1] === 1 ? 1 : 3; // left end (local -x) toward the water
        const B = B0, bw = k % 2 ? B.H : B.W, bh = k % 2 ? B.W : B.H; let x, y;
        if (k === 0) { x = c.x + 1; y = c.y - Math.floor(bh / 2); } else if (k === 2) { x = c.x - bw; y = c.y - Math.floor(bh / 2); } else if (k === 1) { y = c.y + 1; x = c.x - Math.floor(bw / 2); } else { y = c.y - bh; x = c.x - Math.floor(bw / 2); }
        if (!rectFree(x, y, bw, bh)) continue; fill(x - 1, y - 1, bw + 2, bh + 2, VGT.PLOT); fill(x, y, bw, bh, VGT.BUILD);
        done = { o: o2, B, k, x, y, w: bw, h: bh, plot: { x: x - 1, y: y - 1, w: bw + 2, h: bh + 2 }, kind: "mill" }; V.buildings.push(done); V.plots.push(Object.assign({ b: done }, done.plot));
        const door = [k === 0 ? x + Math.floor(bw / 2) : k === 2 ? x + Math.floor(bw / 2) : k === 1 ? x - 1 : x + bw, k === 0 ? y + bh : k === 2 ? y - 1 : y + Math.floor(bh / 2)];
        const lp = vgPath(W, H, roadCost, door, C); if (lp) { const cut = lp.findIndex(([px, py]) => at(px, py) === VGT.ROAD); const lane = cut > 0 ? lp.slice(0, cut + 1) : lp; V.lanes.push(lane); paint(lane, 0, VGT.LANE); }
        break; }
      return true; }
    const cand = fronts.filter(f => (!wb.miner || f.mine || relax) && (wb.near == null || relax || Math.abs(dC(f) - wb.near) < 0.9)).map(f => ({ f, s: (wb.near != null ? -Math.abs(dC(f) - wb.near) * 3 : 0) + (wb.miner ? 2 : 0) + (f.green ? 0.6 : 0) + r() * 1.4 - (dC(f) > 1.6 ? 3 : 0) }));
    cand.sort((a, b) => b.s - a.s);
    for (const { f } of cand) { if (wb.k0 && f.n[1] !== 1 && f.n[1] !== -1) continue; // a church stands east-west: nave to the west, chancel to the east
      done = place(o2, f, Object.assign({ croft: wb.croft }, wb.k0 ? { k: 0, setback: 2, wide: 3, croft: 4 } : {}), B0); if (done) break; }
    if (!done) return false;
    if (wb.type === "chapel") done.churchyard = 1;
    // Farm buildings: a barn (and for the manor a stable too) in the croft behind.
    const behind = (type, sz) => { const o3 = { type, seed: Math.floor(r() * 1e9) + 1, size: sz, floors: "auto", cellar: "no", shape: "auto", porch: "no", furn: o.furn !== false }, B = genBuilding(o3), k = done.k, bw = k % 2 ? B.H : B.W, bh = k % 2 ? B.W : B.H, P = done.plot;
      const spots = []; for (let y = P.y; y + bh <= P.y + P.h; y++) for (let x = P.x; x + bw <= P.x + P.w; x++) spots.push([x, y]);
      const back = [-done.front[0], -done.front[1]]; spots.sort((a, b) => (b[0] * back[0] + b[1] * back[1]) - (a[0] * back[0] + a[1] * back[1]) || r() - 0.5);
      for (const [x, y] of spots) { let ok = true; for (let yy = y - 1; yy < y + bh + 1 && ok; yy++) for (let xx = x - 1; xx < x + bw + 1; xx++) { const t = at(xx, yy); if (t === VGT.BUILD || (yy >= y && yy < y + bh && xx >= x && xx < x + bw && t !== VGT.PLOT)) { ok = false; break; } }
        if (!ok) continue; fill(x, y, bw, bh, VGT.BUILD); const nb = { o: o3, B, k, x, y, w: bw, h: bh, plot: null, kind: type, outbuilding: 1 }; V.buildings.push(nb); return nb; } return null; };
    if (wb.barn) behind("barn", "small");
    if (wb.type === "manor") { behind("barn", "medium"); behind("stable", "small"); }
    return true;
  };
  let left = want.filter(wb => !tryPlace(wb));
  // Not everyone fitted: as in a growing village, a new lane branches off the road and draws houses along it.
  for (let g = 0; g < 16 && left.length; g++) {
    const all = V.roads.concat(V.lanes).flat().filter(([x, y]) => { const d = Math.hypot(x - C[0], y - C[1]); return d > R * 0.2 && d < R * (1 + g * 0.05); });
    if (!all.length) break; const [sx, sy] = all[Math.floor(r() * all.length)], ang = Math.round((Math.atan2(sy - C[1], sx - C[0]) + (r() - 0.5) * 1.6) / (Math.PI / 2)) * (Math.PI / 2), L = R * (0.5 + r() * 0.5);
    const ex = Math.round(Math.max(2, Math.min(W - 3, sx + Math.cos(ang) * L))), ey = Math.round(Math.max(2, Math.min(H - 3, sy + Math.sin(ang) * L)));
    if (!isFinite(roadCost(ex, ey))) continue; const p = vgPath(W, H, roadCost, [sx, sy], [ex, ey]); if (!p || p.length < 8) continue;
    V.lanes.push(p); paint(p, 0, VGT.LANE); addFronts(p, 1, 0.9);
    left = left.filter(wb => !tryPlace(wb, g >= 1)); }
  V.wanted = want.length; V.unplaced = left.length;
  // ----- Around the village -----
  // A churchyard round the church, the green's well or pond, a wayside cross where roads meet.
  if (V.green) { const [gx, gy] = V.green; if (r() < 0.5) { const pr = 2 + r() * 1.5; for (let y = Math.floor(gy - pr - 1); y <= gy + pr + 1; y++) for (let x = Math.floor(gx - pr * 1.4 - 1); x <= gx + pr * 1.4 + 1; x++) if (at(x, y) === VGT.GREEN && Math.hypot((x - gx) / 1.4, y - gy) < pr * (0.8 + nz(x / 3, y / 3, 2) * 0.4)) set(x, y, VGT.POND); V.features.push({ k: "pond", x: gx, y: gy }); }
    else V.features.push({ k: "well", x: Math.round(gx), y: Math.round(gy) }); }
  else V.features.push({ k: "well", x: C[0] + 2, y: C[1] + 2 });
  if (layout === "crossroads") V.features.push({ k: "cross", x: C[0] + 2, y: C[1] - 2 });
  // Meadow by the water, then the open fields in furlongs of strips (three great fields round the village: one fallow),
  // common pasture where they run out, and the rest left to grass and trees.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== VGT.GRASS) continue; let near = false; for (let dy = -5; dy <= 5 && !near; dy++) for (let dx = -5; dx <= 5; dx++) if (at(x + dx, y + dy) === VGT.WATER) { near = true; break; }
    if (near && Math.hypot(x - C[0], y - C[1]) > R * 0.6) set(x, y, VGT.MEADOW); }
  const fieldOf = (x, y) => Math.floor(((Math.atan2(y - C[1], x - C[0]) + Math.PI) / (Math.PI * 2) * 3 + 0.17)) % 3, crops = ["wheat", "barley", "fallow"].sort(() => r() - 0.5);
  for (let by = 0; by < H; by += 12 + Math.floor(r() * 6)) for (let bx = 0; bx < W; bx += 16 + Math.floor(r() * 8)) {
    const fw = 14 + Math.floor(r() * 8), fh = 10 + Math.floor(r() * 6), x0 = bx + Math.floor(r() * 3), y0 = by + Math.floor(r() * 3);
    if (Math.hypot(x0 + fw / 2 - C[0], y0 + fh / 2 - C[1]) < R * 0.95) continue;
    let free = 0; for (let y = y0; y < y0 + fh; y++) for (let x = x0; x < x0 + fw; x++) if (at(x, y) === VGT.GRASS) free++;
    if (free < fw * fh * 0.55) continue;
    const fl = { x: x0, y: y0, w: fw, h: fh, horiz: r() < 0.5, crop: crops[fieldOf(x0 + fw / 2, y0 + fh / 2)], cells: [] };
    for (let y = y0; y < y0 + fh; y++) for (let x = x0; x < x0 + fw; x++) if (at(x, y) === VGT.GRASS) { set(x, y, VGT.FIELD); fl.cells.push([x, y]); }
    V.furlongs.push(fl); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === VGT.GRASS && Math.hypot(x - C[0], y - C[1]) > R * 1.3 && nz(x / 14 + 9, y / 14, 2) > 0.55) set(x, y, VGT.PASTURE);
  // Trees: woods thick with them; a few along the hedges and lanes, in the crofts and on the green.
  const tr = (x, y, s, kind) => V.trees.push([x, y, s, kind || 0]);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const t = at(x, y);
    if (t === VGT.WOOD && r() < 0.42) tr(x + r(), y + r(), 0.9 + r() * 0.9, r() < 0.3 ? 1 : 0);
    else if ((t === VGT.GRASS || t === VGT.PASTURE) && r() < 0.012) tr(x + r(), y + r(), 0.8 + r() * 0.6, 0);
    else if (t === VGT.GREEN && r() < 0.006) tr(x + 0.5, y + 0.5, 1.2 + r() * 0.5, 0);
    else if (t === VGT.ROCK && r() < 0.01) tr(x + r(), y + r(), 0.7 + r() * 0.4, 1); }
  V.plots.forEach(p => { if (!p.b || p.b.kind === "mill") return; if (r() < 0.35) for (let i = 0; i < 2 + Math.floor(r() * 4); i++) { const x = p.x + 1 + r() * (p.w - 2), y = p.y + 1 + r() * (p.h - 2); if (at(Math.floor(x), Math.floor(y)) === VGT.PLOT) tr(x, y, 0.7 + r() * 0.3, 2); } });
  V.counts = V.buildings.reduce((m, b) => (m[b.kind] = (m[b.kind] || 0) + 1, m), {});
  return V;
}

// ----- Drawing the land -----
// s: pixels a square. vb: [x, y, w, h] in squares (the part to draw), or the whole map.
function vgTerrainSvg(V, s, vb, opts) {
  const { W, H, T } = V, r = genRng(7 + (V.seed || 1)), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 255 : T[y * W + x];
  const box = vb || [0, 0, W, H], inBox = (x, y, m) => x >= box[0] - (m || 1) && y >= box[1] - (m || 1) && x <= box[0] + box[2] + (m || 1) && y <= box[1] + box[3] + (m || 1);
  const out = [], cell = (x, y, c) => out.push(`<rect x="${x * s}" y="${y * s}" width="${s + 0.5}" height="${s + 0.5}" fill="${c}"/>`);
  const nz = vgNoise(31), shade = (x, y, base, amp) => { const v = nz(x / 7, y / 7, 3); const [h, sat, l] = base; return `hsl(${h} ${sat}% ${(l + (v - 0.5) * amp).toFixed(1)}%)`; };
  const COL = { [VGT.GRASS]: [95, 32, 42], [VGT.WOOD]: [100, 30, 30], [VGT.MEADOW]: [90, 36, 45], [VGT.GREEN]: [100, 40, 45], [VGT.PLOT]: [82, 28, 43], [VGT.PASTURE]: [86, 28, 43], [VGT.FIELD]: [70, 30, 45], [VGT.ROCK]: [30, 6, 52], [VGT.SPOIL]: [30, 5, 45], [VGT.BUILD]: [82, 28, 43], [VGT.YARD]: [40, 25, 45], [VGT.ROAD]: [36, 30, 46], [VGT.LANE]: [38, 28, 48], [VGT.BRIDGE]: [205, 38, 34], [VGT.WATER]: [205, 38, 34], [VGT.POND]: [200, 40, 36] };
  for (let y = Math.max(0, Math.floor(box[1]) - 1); y < Math.min(H, box[1] + box[3] + 1); y++) for (let x = Math.max(0, Math.floor(box[0]) - 1); x < Math.min(W, box[0] + box[2] + 1); x++) {
    const t = at(x, y), c = COL[t] || COL[VGT.GRASS]; cell(x, y, t === VGT.ROAD || t === VGT.LANE || t === VGT.WATER || t === VGT.POND || t === VGT.BRIDGE ? shade(x, y, COL[VGT.MEADOW], 6) : shade(x, y, c, t === VGT.ROCK ? 14 : 8)); }
  for (let y = Math.max(0, Math.floor(box[1]) - 1); y < Math.min(H, box[1] + box[3] + 1); y++) for (let x = Math.max(0, Math.floor(box[0]) - 1); x < Math.min(W, box[0] + box[2] + 1); x++) if (at(x, y) === VGT.POND) out.push(`<circle cx="${(x + 0.5) * s}" cy="${(y + 0.5) * s}" r="${s * 0.85}" fill="#3d6f8f"/>`);
  // Fields: strips (selions) across each furlong; wheat, barley or fallow by great field.
  const crop = { wheat: ["#c9a94a", "#b8963c"], barley: ["#a9b45a", "#98a24c"], fallow: ["#8a7048", "#7a6240"] };
  V.furlongs.forEach(f => { if (!inBox(f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h))) return; const c = crop[f.crop] || crop.wheat, set = new Set(f.cells.map(([x, y]) => x + "," + y));
    f.cells.forEach(([x, y]) => { const stripe = f.horiz ? Math.floor((y - f.y) / 1.5) : Math.floor((x - f.x) / 1.5); cell(x, y, c[stripe % 2]); });
    const lines = []; if (f.horiz) for (let y = f.y; y <= f.y + f.h; y += 1.5) lines.push(`M${f.x * s} ${y * s}h${f.w * s}`); else for (let x = f.x; x <= f.x + f.w; x += 1.5) lines.push(`M${x * s} ${f.y * s}v${f.h * s}`);
    out.push(`<path d="${lines.join("")}" stroke="rgba(60,45,20,.35)" stroke-width="${Math.max(1, s * 0.05)}" clip-path="url(#vgf${V.furlongs.indexOf(f)})"/>`);
    out.push(`<clipPath id="vgf${V.furlongs.indexOf(f)}">${f.cells.map(([x, y]) => `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}"/>`).join("")}</clipPath>`); void set; });
  // Plots: a worn yard round each house, hedges round the croft, rows of beds.
  V.plots.forEach(p => { if (!inBox(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h))) return;
    out.push(`<rect x="${p.x * s}" y="${p.y * s}" width="${p.w * s}" height="${p.h * s}" fill="none" stroke="#3f5a2a" stroke-width="${s * 0.35}" stroke-dasharray="${s * 0.5} ${s * 0.25}" stroke-linecap="round" opacity=".85"/>`);
    const b = p.b; if (!b || b.kind === "mill") return; const back = [-b.front[0], -b.front[1]];
    // Garden beds behind the house: rows across the croft.
    const gx = back[0] === 1 ? b.x + b.w + 1 : back[0] === -1 ? p.x + 1 : p.x + 1, gy = back[1] === 1 ? b.y + b.h + 1 : back[1] === -1 ? p.y + 1 : p.y + 1;
    const gw = back[0] ? (back[0] === 1 ? p.x + p.w - 1 - gx : b.x - 1 - gx) : p.w - 2, gh = back[1] ? (back[1] === 1 ? p.y + p.h - 1 - gy : b.y - 1 - gy) : p.h - 2;
    if (gw >= 2 && gh >= 2 && b.kind !== "chapel") for (let i = 0; i < (back[1] ? gw : gh); i += 2) out.push(back[1] ? `<rect x="${(gx + i) * s + s * 0.15}" y="${gy * s}" width="${s * 0.7}" height="${gh * s}" fill="#6b5536" opacity=".55"/>` : `<rect x="${gx * s}" y="${(gy + i) * s + s * 0.15}" width="${gw * s}" height="${s * 0.7}" fill="#6b5536" opacity=".55"/>`);
    if (b.churchyard) for (let i = 0; i < 14; i++) { const x = p.x + 1 + r() * (p.w - 2), y = p.y + 1 + r() * (p.h - 2); if (at(Math.floor(x), Math.floor(y)) !== VGT.PLOT) continue; out.push(`<rect x="${(x * s).toFixed(1)}" y="${(y * s).toFixed(1)}" width="${s * 0.3}" height="${s * 0.45}" rx="${s * 0.12}" fill="#a8a29a" stroke="#3a3530" stroke-width="${Math.max(0.8, s * 0.04)}"/>`); } });
  // Water: the river with its banks, the pond.
  if (V.riverPath) { const d = vgSmooth(V.riverPath, s); out.push(`<path d="${d}" stroke="#5d6b3a" stroke-width="${(V.riverW + 1.2) * s}" fill="none" stroke-linecap="round" opacity=".7"/><path d="${d}" stroke="#3d6f8f" stroke-width="${V.riverW * s}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#5a8fae" stroke-width="${V.riverW * s * 0.45}" fill="none" stroke-linecap="round" opacity=".6"/>`); }
  // Roads and lanes: worn earth with darker edges and ruts.
  const road = (p, w, col) => { const d = vgSmooth(vgThin(p, 3).map(([x, y]) => [x + 0.5, y + 0.5]), s); out.push(`<path d="${d}" stroke="#5a4a30" stroke-width="${(w + 0.5) * s}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/><path d="${d}" stroke="${col}" stroke-width="${w * s}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="rgba(70,55,30,.35)" stroke-width="${Math.max(1, s * 0.12)}" fill="none" stroke-dasharray="${s * 1.2} ${s * 0.8}"/>`); };
  V.lanes.forEach(p => road(p, 1.5, "#9c845a")); V.roads.forEach(p => road(p, 3, "#a68c5e"));
  // Bridges where roads cross water.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === VGT.BRIDGE && inBox(x, y)) out.push(`<rect x="${x * s}" y="${y * s}" width="${s + 0.5}" height="${s + 0.5}" fill="#8a6038"/><path d="M${x * s} ${(y + 0.5) * s}h${s}M${(x + 0.5) * s} ${y * s}v${s}" stroke="#5e4027" stroke-width="${Math.max(1, s * 0.06)}"/>`);
  // Mountains: rock with ridges and boulders; spoil heaps and the mine's adit.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = at(x, y); if (!inBox(x, y)) continue;
    if (t === VGT.ROCK) { if ([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([a, b]) => { const u = at(x + a, y + b); return u !== VGT.ROCK && u !== 255; })) out.push(`<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="rgba(40,36,32,.35)"/>`);
      if ((x * 7 + y * 13) % 9 === 0) out.push(`<circle cx="${(x + 0.5) * s}" cy="${(y + 0.5) * s}" r="${s * 0.35}" fill="#8f8a82" stroke="#4a4540" stroke-width="${Math.max(1, s * 0.05)}"/>`); }
    else if (t === VGT.SPOIL && (x + y) % 2 === 0) out.push(`<circle cx="${(x + 0.5) * s}" cy="${(y + 0.5) * s}" r="${s * 0.6}" fill="#7d7870" opacity=".9"/>`); }
  if (V.mineAt) { const [mx, my] = V.mineAt; out.push(`<rect x="${(mx - 0.6) * s}" y="${(my - 0.6) * s}" width="${s * 2.2}" height="${s * 2.2}" fill="#1e1a16" stroke="#5e4027" stroke-width="${s * 0.25}"/><text x="${(mx + 0.5) * s}" y="${(my - 1) * s}" font-size="${s * 1.1}" text-anchor="middle" fill="#f1e6cf" stroke="#1e1a16" stroke-width="${s * 0.15}" paint-order="stroke" font-family="sans-serif">⛏ Mine</text>`); }
  // Features: well, wayside cross.
  V.features.forEach(f => { if (!inBox(f.x, f.y)) return; if (f.k === "well") out.push(`<circle cx="${(f.x + 0.5) * s}" cy="${(f.y + 0.5) * s}" r="${s * 0.55}" fill="#8d8478" stroke="#2b2520" stroke-width="${s * 0.08}"/><circle cx="${(f.x + 0.5) * s}" cy="${(f.y + 0.5) * s}" r="${s * 0.3}" fill="#1e2a33"/>`);
    else if (f.k === "cross") out.push(`<rect x="${(f.x + 0.2) * s}" y="${(f.y + 0.2) * s}" width="${s * 0.6}" height="${s * 0.6}" fill="#a8a29a" stroke="#2b2520" stroke-width="${s * 0.06}"/><path d="M${(f.x + 0.5) * s} ${(f.y + 0.25) * s}v${s * 0.5}M${(f.x + 0.3) * s} ${(f.y + 0.45) * s}h${s * 0.4}" stroke="#2b2520" stroke-width="${s * 0.08}"/>`); });
  // Trees last, with shadows: woods, hedgerow trees, fruit trees in the crofts.
  const TC = [["#3f6a2c", "#5a8a3a"], ["#2f5a3a", "#3f7048"], ["#5a7a2c", "#7a9a3a"]];
  V.trees.forEach(([x, y, z, k]) => { if (!inBox(x, y, 2)) return; const cx = x * s, cy = y * s, rr = z * s * 0.75, c = TC[k] || TC[0];
    out.push(`<circle cx="${(cx + rr * 0.25).toFixed(1)}" cy="${(cy + rr * 0.3).toFixed(1)}" r="${rr.toFixed(1)}" fill="rgba(0,0,0,.25)"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rr.toFixed(1)}" fill="${c[0]}" stroke="rgba(20,35,15,.6)" stroke-width="${Math.max(0.8, s * 0.04)}"/><circle cx="${(cx - rr * 0.25).toFixed(1)}" cy="${(cy - rr * 0.25).toFixed(1)}" r="${(rr * 0.5).toFixed(1)}" fill="${c[1]}" opacity=".7"/>` + (k === 2 ? `<circle cx="${(cx + rr * 0.3).toFixed(1)}" cy="${cy.toFixed(1)}" r="${(rr * 0.14).toFixed(1)}" fill="#b8322d"/>` : "")); });
  const [bx, by, bw, bh] = box;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bx * s} ${by * s} ${bw * s} ${bh * s}" width="${Math.round(bw * s)}" height="${Math.round(bh * s)}">${(opts && opts.extra) || ""}${out.join("")}${(opts && opts.top) || ""}</svg>`;
}
// The preview: the land with every building's roof, turned as placed.
function vgPreviewSvg(V, s) {
  const roofs = V.buildings.map(b => { const svg = genRoofSvg(b.B, b.o.seed), bw = b.B.W, bh = b.B.H, cx = (b.x + b.w / 2) * s, cy = (b.y + b.h / 2) * s;
    const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    return `<g transform="translate(${cx} ${cy}) rotate(${b.k * 90}) translate(${-bw * s / 2} ${-bh * s / 2}) scale(${s / GEN_PX})">${inner}</g>`; }).join("");
  return vgTerrainSvg(V, s, null, { top: roofs });
}

// ----- On the tabletop: every building, turned and moved into place -----
function vgTurn(k, W, H) { return (x, y) => k === 1 ? [H - y, x] : k === 2 ? [W - x, H - y] : k === 3 ? [y, W - x] : [x, y]; }
function vgVillagePage(o) {
  const V = genVillage(o), objs = [], walls = [], areas = [], links = [], id = () => vid("o"), P = GEN_PX;
  let minL = 0, maxL = 1;
  // The land, in tiles (so no one picture is too big to draw).
  const TS = 32; for (let ty = 0; ty < V.H; ty += TS) for (let tx = 0; tx < V.W; tx += TS) { const w = Math.min(TS, V.W - tx), h = Math.min(TS, V.H - ty);
    objs.push({ id: id(), layer: "map", level: 0, x: tx, y: ty, w, h, px: 32, land: 1, img: "", vb: [tx, ty, w, h] }); }
  V.buildings.forEach((b, bi) => {
    const { page } = genPage(b.o), m = 3, BW = b.B.W, BH = b.B.H, tf = vgTurn(b.k, BW, BH), to = (x, y) => { const [a, c] = tf(x - m, y - m); return [a + b.x, c + b.y]; };
    page.objs.forEach((ob, i) => { if (i === 0 || ob.layer === "gm") return; // the building's own yard and room names (redone below, upright)
      const [cx, cy] = to(ob.x + ob.w / 2, ob.y + ob.h / 2); objs.push(Object.assign({}, ob, { id: id(), x: cx - ob.w / 2, y: cy - ob.h / 2, rot: ((Number(ob.rot) || 0) + b.k * 90) % 360 || undefined, bld: bi })); });
    page.walls.forEach(w => { const [a, c] = to(w[0], w[1]), [d, e] = to(w[2], w[3]); walls.push([a, c, d, e].concat(w.slice(4))); });
    (page.areas || []).forEach(a => areas.push(Object.assign({}, a, { id: vid("a"), cells: a.cells.map(([cx, cy]) => { const [p1, p2] = to(cx, cy), [q1, q2] = to(cx + 1, cy + 1); return [Math.min(p1, q1), Math.min(p2, q2)]; }) })));
    (page.links || []).forEach(l => { const [p1, p2] = to(l.x, l.y), [q1, q2] = to(l.x + l.w, l.y + l.h); links.push(Object.assign({}, l, { id: vid("l"), x: Math.min(p1, q1), y: Math.min(p2, q2), w: Math.abs(q1 - p1), h: Math.abs(q2 - p2) })); });
    minL = Math.min(minL, page.minLevel || 0); maxL = Math.max(maxL, page.maxLevel || 1);
    // Room names for the GM, upright, one picture per floor of the building.
    b.B.levels.forEach(L => { const texts = L.rooms.filter(rm => !rm.porch).map(rm => { const [cx, cy] = tf(rm.x + rm.w / 2, rm.y + rm.h / 2); return `<text x="${(cx * P).toFixed(1)}" y="${(cy * P).toFixed(1)}" font-family="Georgia,serif" font-size="${Math.min(15, 9 + Math.min(rm.w, rm.h) * 1.5)}" fill="#f1e6cf" stroke="#1e1a16" stroke-width="3" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(rm.n)}</text>`; }).join("");
      objs.push({ id: id(), layer: "gm", level: L.level, x: b.x, y: b.y, w: b.w, h: b.h, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b.w * P} ${b.h * P}" width="${b.w * P}" height="${b.h * P}">${texts}</svg>`) }); });
  });
  const names = { "-1": "Cellars", 0: "Ground" }; for (let l = 1; l <= maxL; l++) names[l] = l === maxL ? "Roofs" : `Floor ${l + 1} & roofs`;
  return { V, page: { w: V.W, h: V.H, bg: "#5d7a3a", grid: true, light: false, fogMem: true, objs, walls: genMergeWalls(walls), areas, links, levelNames: names, minLevel: minL, maxLevel: maxL } };
}
// Draw the land tiles (and upload them with the buildings' pictures).
async function vgPlace(camp, o) {
  toast("Laying out the village…"); await new Promise(res => setTimeout(res, 30));
  const { V, page } = vgVillagePage(o), land = page.objs.filter(ob => ob.land);
  if (!(S.assets && S.assets.upload)) { // nowhere to upload: the land as one drawing
    page.objs = page.objs.filter(ob => !ob.land); page.objs.unshift({ id: vid("o"), layer: "map", level: 0, x: 0, y: 0, w: V.W, h: V.H, img: genUrl(vgTerrainSvg(V, 12)) });
  } else land.forEach(ob => { ob.img = genUrl(vgTerrainSvg(V, ob.px, ob.vb)); delete ob.vb; delete ob.land; });
  await genStoreImages(page, "Drawing the village");
  const pid = vid("p"), order = vPages(camp).length, nm = o.name || ({ hamlet: "Hamlet", village: "Village", large: "Large village" })[V.size];
  await vSave("vttpages/" + pid, Object.assign(page, { camp, name: nm, order, folder: "Villages", open: false, village: Object.assign({}, o), created: new Date().toISOString() }));
  for (let i = 0; i < 60 && !S.vttPages.has(pid); i++) await new Promise(res => setTimeout(res, 50));
  VTT.camp = camp; VTT.page = pid; if (location.hash === "#vtt-" + camp) render(); else location.hash = "vtt-" + camp;
  toast(`${nm} is a new map in ${(S.vttCamps.get(camp) || {}).name || "the campaign"}: ${V.buildings.length} buildings, every one you can walk into.`);
}

// ----- The village page: #gen-<camp>/village -----
const VG_LABEL = { chapel: "church", manor: "manor house", mill: "mill", blacksmith: "smithy", bakehouse: "bakehouse", tavern: "alehouse", stable: "stable", farmhouse: "farmhouse", barn: "barn", house: "house", cottage: "cottage" };
function vgPreviewHtml(o) {
  const t0 = performance.now(), V = genVillage(o), s = Math.max(4, Math.min(8, Math.floor(1100 / V.W))), img = genUrl(vgPreviewSvg(V, s)), ms = Math.round(performance.now() - t0);
  const order = ["chapel", "manor", "mill", "blacksmith", "bakehouse", "tavern", "stable", "farmhouse", "barn", "house", "cottage"];
  const list = order.filter(k => V.counts[k]).map(k => `${V.counts[k] > 1 ? V.counts[k] + " " : ""}${VG_LABEL[k]}${V.counts[k] > 1 ? (VG_LABEL[k].endsWith("h") ? "es" : "s") : ""}`).join(", ");
  const what = [({ street: "A street village", green: "A green village", crossroads: "A crossroads village" })[V.layout], V.river === "river" ? "on a river" : V.river === "stream" ? "by a stream" : "", V.land === "mountains" ? "under the mountains" : V.land === "hills" ? "in the hills" : "", V.mine ? "with a mine" : ""].filter(Boolean).join(" ");
  void ms;
  return `<p class="small"><strong>${V.W} × ${V.H} squares</strong> <span class="muted">(${V.W * 5} × ${V.H * 5} ft) · ${esc(what)} · ${V.buildings.length} buildings</span><br><span class="muted">${esc(list)}</span></p>
    <div class="vgprev"><img src="${img}" alt="The village"></div>`;
}
function viewVillageGen(camp) {
  if (!VG.o) VG.o = vgDefaults(); const o = VG.o;
  const seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? "on" : ""}" data-act="gvopt" data-k="${k}" data-v="${v}" aria-pressed="${String(o[k]) === String(v)}">${l}</button>`).join("")}</div>`;
  return `<section class="page genpage"><a href="#gen-${esc(camp)}" class="vback">← Generator</a>
    <h1>🏡 Village</h1><p class="muted">Houses along the roads on their tofts and crofts, the church and manor, the mill on the water, open fields in strips, meadow, woods — and every building one you can walk into, floor by floor.</p>
    <div class="genlayout"><div class="genopts">
      <label><span>Size</span>${seg("size", [["hamlet", "Hamlet"], ["village", "Village"], ["large", "Large"]])}</label>
      <label><span>Layout</span>${seg("layout", [["auto", "Any"], ["street", "Street"], ["green", "Green"], ["crossroads", "Crossroads"]])}</label>
      <label><span>Water</span>${seg("river", [["auto", "Any"], ["none", "None"], ["stream", "Stream"], ["river", "River"]])}</label>
      <label><span>Land</span>${seg("land", [["auto", "Any"], ["open", "Open"], ["hills", "Hills"], ["mountains", "Mountains"]])}</label>
      <label><span>Woods</span>${seg("woods", [["few", "Few"], ["some", "Some"], ["many", "Many"]])}</label>
      <label><span>Mine <small class="muted">in the mountains</small></span>${seg("mine", [["auto", "Maybe"], ["yes", "Yes"], ["no", "No"]])}</label>
      <label class="genchk"><input type="checkbox" data-act="gvchk" data-k="furn"${o.furn !== false ? " checked" : ""}> <span>Furniture in the buildings</span></label>
      <button class="btn" data-act="gvroll">🎲 New village</button>
      <label><span>Seed <small class="muted">the same seed makes the same village</small></span><input id="gv-seed" type="number" value="${o.seed}"></label>
      <hr>
      <label><span>Name</span><input id="gv-name" type="text" value="${esc(o.name)}" placeholder="Village"></label>
      <button class="btn" data-act="gvplace" data-camp="${esc(camp)}">Place in the campaign</button>
      <p class="muted small">A new map in this campaign, with every building in place to walk into. Big villages take a little while to draw.</p>
    </div><div class="genprev" id="gv-prev">${vgPreviewHtml(o)}</div></div></section>`;
}
const vgRefresh = () => { const el = document.getElementById("gv-prev"); if (el && VG.o) el.innerHTML = vgPreviewHtml(VG.o); };
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act^=gv]"); if (!b || !vCanEdit()) return; const a = b.dataset.act; if (!VG.o) return;
  if (a === "gvopt") { VG.o[b.dataset.k] = b.dataset.v; b.parentElement.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); vgRefresh(); return; }
  if (a === "gvchk") { VG.o[b.dataset.k] = b.checked; return; }
  if (a === "gvroll") { VG.o.seed = genSeed(); const s = document.getElementById("gv-seed"); if (s) s.value = VG.o.seed; vgRefresh(); return; }
  if (a === "gvplace") { ev.preventDefault(); const n = document.getElementById("gv-name"); VG.o.name = n ? n.value.trim() : ""; b.disabled = true; try { await vgPlace(b.dataset.camp, VG.o); } finally { b.disabled = false; } return; }
});
document.addEventListener("change", ev => { if (ev.target && ev.target.id === "gv-seed" && VG.o) { VG.o.seed = Math.max(1, Math.round(Number(ev.target.value)) || 1); vgRefresh(); } });
