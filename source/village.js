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
const VGT = { GRASS: 0, ROAD: 1, LANE: 2, WATER: 3, ROCK: 4, WOOD: 5, FIELD: 6, MEADOW: 7, GREEN: 8, PLOT: 9, BUILD: 10, BRIDGE: 11, YARD: 12, POND: 13, SPOIL: 14, PASTURE: 15, PATH: 16 };
const VG_SIZES = { hamlet: { W: 96, H: 76, n: [5, 8], R: 16 }, village: { W: 136, H: 104, n: [12, 18], R: 24 }, large: { W: 176, H: 136, n: [22, 30], R: 32 } };
const vgDefaults = () => ({ seed: genSeed(), size: "village", layout: "auto", river: "auto", land: "auto", woods: "some", mine: "auto", furn: true, names: true, name: "" });

// Smooth value noise (seeded): fbm(x, y) in about 0..1.
function vgNoise(seed) {
  const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  return (x, y, oct = 4) => { let s = 0, amp = 1, f = 1, tot = 0; for (let i = 0; i < oct; i++) { s += v(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; } return s / tot; };
}
// Least-cost path over the grid (8 ways), for roads: cost(x, y) per square (Infinity = impassable).
function vgPath(W, H, cost, from, to, goal) {
  const N = W * H, g = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
  const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const s = from[1] * W + from[0], t = to[1] * W + to[0]; g[s] = 0; push(s, 0);
  const hz = i => Math.hypot(i % W - to[0], Math.floor(i / W) - to[1]);
  while (heap.length) { const [, i] = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break; if (goal && i !== s && goal(i)) { prev[t] = -1; return vgTrace(prev, s, i, W); } const x = i % W, y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (done[j]) continue; const c = cost(nx, ny); if (!isFinite(c)) continue; const ng = g[i] + c * (dx && dy ? 1.414 : 1); if (ng < g[j]) { g[j] = ng; prev[j] = i; push(j, ng + hz(j)); } } }
  if (prev[t] < 0 && s !== t) return null; return vgTrace(prev, s, t, W);
}
function vgTrace(prev, s, t, W) { const out = []; for (let i = t; i >= 0; i = prev[i]) { out.push([i % W, Math.floor(i / W)]); if (i === s) break; } return out.reverse();
}
// Roads: 5 squares wide, and every bend and junction swept by a wagon 3 squares wide and 6 long, so a vehicle that size
// gets everywhere a road goes.
const VG_RW = 2.5, VG_CAR = [6, 3];
function vgSimplify(P, tol) { // Douglas–Peucker
  if (P.length < 3) return P.slice(); const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st = [[0, P.length - 1]];
  while (st.length) { const [a, b] = st.pop(), [ax, ay] = P[a], [bx, by] = P[b], L = Math.hypot(bx - ax, by - ay) || 1; let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - P[i][1]) - (ax - P[i][0]) * (by - ay)) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return P.filter((_, i) => keep[i]);
}
// Points every `step` squares along a Catmull-Rom curve through the control points (closed: a loop).
function vgCurve(ctl, closed, step = 0.5) {
  const n = ctl.length; if (n < 2) return ctl.map(p => p.slice()); const get = i => closed ? ctl[((i % n) + n) % n] : ctl[Math.max(0, Math.min(n - 1, i))], out = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2), m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < m; j++) { const t = j / m, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))); } }
  out.push(closed ? out[0].slice() : ctl[n - 1].slice()); return out;
}
// Round off any corner too tight for the wagon: a few passes of a moving average (the ends stay put).
function vgEase(d, loop, passes = 3, k = 5) { const n = d.length; if (n < 5) return d; for (let p = 0; p < passes; p++) { const o = d.map(q => q.slice()); for (let i = loop ? 0 : 1; i < (loop ? n : n - 1); i++) { let sx = 0, sy = 0, c = 0; for (let j = -k; j <= k; j++) { const m = loop ? ((i + j) % n + n) % n : i + j; if (m < 0 || m >= n) continue; sx += d[m][0]; sy += d[m][1]; c++; } const w = loop ? 1 : Math.min(1, Math.min(i, n - 1 - i) / k); o[i] = [d[i][0] + (sx / c - d[i][0]) * w, d[i][1] + (sy / c - d[i][1]) * w]; } d = o; } if (loop) d[n - 1] = d[0].slice(); return d; }
function vgResample(P, step = 0.5) { const out = [P[0].slice()]; for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let j = 1; j <= m; j++) out.push([ax + (bx - ax) * j / m, ay + (by - ay) * j / m]); } return out; }
function vgChaikin(P, it) { for (let k = 0; k < it; k++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } Q.push(P[P.length - 1]); P = Q; } return P; }
// The squares a road covers: its width, and everything the wagon sweeps going along it.
function vgFoot(d, W, H, loop) {
  const cells = new Set(), n = d.length, [cl, cw] = VG_CAR;
  for (let i = 0; i < n; i++) { const a = d[loop ? (i - 2 + n) % n : Math.max(0, i - 2)], b = d[loop ? (i + 2) % n : Math.min(n - 1, i + 2)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const [px, py] = d[i];
    for (let y = Math.floor(py - 4); y <= py + 4; y++) for (let x = Math.floor(px - 4); x <= px + 4; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const cx = x + 0.5 - px, cy = y + 0.5 - py, u = cx * tx + cy * ty, v = -cx * ty + cy * tx;
      if ((Math.abs(u) <= cl / 2 + 0.5 && Math.abs(v) <= cw / 2 + 0.5) || Math.hypot(cx, cy) <= VG_RW + 0.3) cells.add(y * W + x); } }
  return cells;
}
// A smooth line through points (Catmull-Rom as cubic Béziers), for drawing the river.
function vgSmooth(pts, s) {
  if (pts.length < 2) return ""; const P = pts.map(([x, y]) => [x * s, y * s]); let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
  return d;
}
const vgThin = (path, step) => path.filter((_, i) => i % step === 0 || i === path.length - 1);

// ----- The whole village -----
function genVillage(o) {
  const r = genRng(Number(o.seed) || 1), rr = genRng((Number(o.seed) || 1) * 31 + 7), pick = (opts, v) => v && v !== "auto" ? v : opts[Math.floor(r() * opts.length)];
  const size = VG_SIZES[o.size] ? o.size : "village", Z = VG_SIZES[size], W = Z.W, H = Z.H, R = Z.R;
  const custom = Array.isArray(o.roads) && o.roads.some(rd => rd && rd.pts && rd.pts.length >= 2);
  const nRoads = o.nroads && o.nroads !== "auto" ? Math.max(1, Math.min(6, Number(o.nroads) || 2)) : ({ hamlet: [1, 2], village: [2, 3], large: [2, 4] })[size].reduce((a, b) => a + Math.floor(r() * (b - a + 1)));
  let centre = pick(["junction", "junction", "green", "ring"], o.centre); if (nRoads === 1 && !custom) centre = "ring";
  const layout = centre, river = pick(["none", "stream", "stream", "river"], o.river), land = pick(["open", "open", "hills", "mountains"], o.land);
  const mine = land === "mountains" && (o.mine === "yes" || (o.mine !== "no" && r() < 0.5));
  const nz = vgNoise((Number(o.seed) || 1) * 7 + 3), nz2 = vgNoise((Number(o.seed) || 1) * 11 + 5);
  const T = new Uint8Array(W * H), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 255 : T[y * W + x], set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) T[y * W + x] = v; };
  const V = { W, H, R, size, layout, centre, nRoads, custom, fillets: [], river, land, mine, T, roads: [], lanes: [], trees: [], furlongs: [], buildings: [], plots: [], features: [], bridges: [], riverPath: null, riverW: 0, spoil: [], mineAt: null };
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
  const clearAt = c => at(c[0], c[1]) === VGT.GRASS && [3, 7, 11, 13].every(d => Array.from({ length: 16 }, (_, i) => i * Math.PI / 8).every(a => { const t = at(Math.round(c[0] + Math.cos(a) * d), Math.round(c[1] + Math.sin(a) * d)); return t !== VGT.ROCK && t !== VGT.WATER && t !== 255; }));
  for (let k = 0; k < 120 && !clearAt(C); k++) C = [Math.round(W / 2 + (r() - 0.5) * W * 0.4), Math.round(H / 2 + (r() - 0.5) * H * 0.4)];
  V.C = C;
  // Woods: patches toward the edges, away from the village.
  const wAmt = { few: 0.56, some: 0.5, many: 0.44 }[o.woods] || 0.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== VGT.GRASS) continue; const dc = Math.hypot((x - C[0]) / W, (y - C[1]) / H);
    const v = nz2(x / 22, y / 22, 4) + Math.max(0, dc - 0.34) * 1.1 - Math.max(0, 1 - Math.hypot(x - C[0], y - C[1]) / (R * 2.3)) * 0.7; if (v > wAmt + 0.1) set(x, y, VGT.WOOD); }
  // ----- Roads -----
  // Roads are kept as control points (what the road editor moves) and drawn as smooth curves through them. Every road joins
  // the others: each new road runs to the nearest road near the heart of the village, and at every junction the corners are
  // rounded off wide enough for a wagon to turn.
  // Roads keep off the river banks (they cross the water, not run along it).
  const wetD = new Uint8Array(W * H).fill(9); { const q = []; for (let i = 0; i < W * H; i++) if (T[i] === VGT.WATER) { wetD[i] = 0; q.push(i); } for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; if (wetD[i] >= 5) continue; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const nx = x + a, ny = y + b; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (wetD[j] > wetD[i] + 1) { wetD[j] = wetD[i] + 1; q.push(j); } } } }
  const roadCost = (x, y, wetOk) => { const t = at(x, y); if (t === VGT.ROCK || t === 255) return Infinity; if (t === VGT.WATER) return 9; if (!wetOk && wetD[y * W + x] < 5) return 6; if (t === VGT.ROAD || t === VGT.BRIDGE) return 1.2; if (t === VGT.WOOD) return 2.2; if (t === VGT.BUILD || t === VGT.PLOT) return Infinity; return 1 + nz(x / 6, y / 6, 2) * 1.6; };
  const carve = cells => cells.forEach(i => { const t = T[i]; T[i] = t === VGT.WATER || t === VGT.BRIDGE ? VGT.BRIDGE : VGT.ROAD; });
  const hits = (cells, plotsOk) => { let n = 0; cells.forEach(i => { if (T[i] === VGT.BUILD || (!plotsOk && T[i] === VGT.PLOT)) n++; }); return n; };
  const allRoads = () => V.roads.concat(V.lanes);
  const mkRoad = (ctl, loop, kind) => ({ ctl, loop: !!loop, kind: kind || "road", d: vgEase(vgCurve(ctl, !!loop), !!loop) });
  const fromPath = (path, ext) => { let ctl = vgSimplify(path.map(([x, y]) => [x + 0.5, y + 0.5]), 1.6); if (ext) { const [x, y] = ctl[0], out = x <= 1 ? [-3, 0] : x >= W - 2 ? [3, 0] : y <= 1 ? [0, -3] : [0, 3]; ctl = [[x + out[0], y + out[1]]].concat(ctl); } return ctl.map(([x, y]) => [Math.round(x * 2) / 2, Math.round(y * 2) / 2]); };
  const dirAt = (rd, j, sg) => { const d = rd.d, n = d.length, k = rd.loop ? ((j + sg * 16) % n + n) % n : Math.max(0, Math.min(n - 1, j + sg * 16)); const x = d[k][0] - d[j][0], y = d[k][1] - d[j][1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const nearestOn = (p, skip) => { let best = null; allRoads().forEach(rd => { if (rd === skip) return; rd.d.forEach((q, j) => { const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (!best || dd < best.dd) best = { rd, j, dd }; }); }); return best; };
  // The rounded corners where this road's ends meet another road.
  const filletsFor = rd => { const out = []; if (rd.loop) return out;
    [[0, 1], [rd.d.length - 1, -1]].forEach(([j, sg]) => { const nb = nearestOn(rd.d[j], rd); if (!nb || nb.dd > 3) return; const J = nb.rd.d[nb.j], dE = dirAt(rd, j, sg), last = nb.rd.d.length - 1, ds = [];
      if (!nb.rd.loop && nb.j < 8) ds.push(dirAt(nb.rd, 0, 1)); else if (!nb.rd.loop && nb.j > last - 8) ds.push(dirAt(nb.rd, last, -1)); else ds.push(dirAt(nb.rd, nb.j, 1), dirAt(nb.rd, nb.j, -1));
      ds.forEach(dO => { const c = dE[0] * dO[0] + dE[1] * dO[1]; if (c > 0.6) return; const th = Math.acos(Math.max(-1, Math.min(1, c))), Lg = 8 + 8 * Math.max(0, (Math.PI / 2 - th) / (Math.PI / 2));
        out.push(vgResample(vgChaikin([[J[0] + dE[0] * Lg, J[1] + dE[1] * Lg], J.slice(), [J[0] + dO[0] * Lg, J[1] + dO[1] * Lg]], 4))); }); });
    return out; };
  // Add a road: its squares, and its junction corners. dry: only see whether it fits (no buildings or plots in the way).
  const addRoad = (rd, opts) => { const fl = filletsFor(rd), cells = vgFoot(rd.d, W, H, rd.loop); fl.forEach(f => vgFoot(f, W, H).forEach(i => cells.add(i)));
    if (opts && opts.strict && hits(cells, opts.plots) > (opts.allow || 0)) return false; carve(cells); (rd.kind === "road" ? V.roads : V.lanes).push(rd); V.fillets.push(...fl); return true; };
  const nearHeart = R * 0.5, goalRoad = i => (T[i] === VGT.ROAD || T[i] === VGT.BRIDGE) && Math.hypot(i % W - C[0], Math.floor(i / W) - C[1]) < nearHeart;
  const freeEdges = edges.filter(e => e !== mEdge);
  if (custom) { // the GM's own roads
    o.roads.forEach(rd => { if (rd && rd.pts && rd.pts.length >= 2) addRoad(Object.assign(mkRoad(rd.pts.map(p => [Number(p[0]), Number(p[1])]), rd.loop, "road"), { user: 1 })); });
    // The heart: the road point nearest the middle of them all.
    const all = V.roads.flatMap(rd => rd.d), mx = all.reduce((a, p) => a + p[0], 0) / all.length, my = all.reduce((a, p) => a + p[1], 0) / all.length;
    let best = all[0]; all.forEach(p => { if (Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(best[0] - mx, best[1] - my)) best = p; }); C = [Math.round(best[0]), Math.round(best[1])]; V.C = C;
  } else {
    // Where the roads leave the map: spread round the village, never into the mountains or the water.
    const a0 = rr() * Math.PI * 2, exits = [];
    const toEdge = a => { const dx = Math.cos(a), dy = Math.sin(a); let t = Infinity; if (dx > 0) t = Math.min(t, (W - 1 - C[0]) / dx); if (dx < 0) t = Math.min(t, -C[0] / dx); if (dy > 0) t = Math.min(t, (H - 1 - C[1]) / dy); if (dy < 0) t = Math.min(t, -C[1] / dy); return [Math.round(C[0] + dx * t), Math.round(C[1] + dy * t)]; };
    for (let i = 0; i < nRoads; i++) { const base = a0 + i * Math.PI * 2 / nRoads + (rr() - 0.5) * 0.5;
      for (let k = 0; k < 24; k++) { const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.12, p = toEdge(a), t = at(p[0], p[1]); if (t !== VGT.ROCK && t !== VGT.WATER && !exits.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 12)) { exits.push(p); break; } } }
    void freeEdges;
    if (centre === "ring") { // a ring road round a small green, the roads running into it
      const ringR = 9, ctl = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, q = ringR + (rr() - 0.5) * 0.6; return [Math.round((C[0] + 0.5 + Math.cos(a) * q) * 2) / 2, Math.round((C[1] + 0.5 + Math.sin(a) * q) * 2) / 2]; });
      addRoad(mkRoad(ctl, true, "road")); V.ring = [C[0] + 0.5, C[1] + 0.5, ringR];
      for (let y = C[1] - ringR; y <= C[1] + ringR; y++) for (let x = C[0] - ringR; x <= C[0] + ringR; x++) if (Math.hypot(x + 0.5 - V.ring[0], y + 0.5 - V.ring[1]) < ringR - VG_RW - 0.8 && at(x, y) !== VGT.ROAD) set(x, y, VGT.GREEN);
    }
    exits.forEach((e, i) => { const first = !V.roads.length, path = vgPath(W, H, roadCost, e, C, first ? null : goalRoad); if (!path || path.length < 3) return;
      addRoad(mkRoad(fromPath(path, true), false, "road")); });
  }
  // A green: an irregular open space at the heart, with a pond or a well; houses look onto it.
  if (centre === "green") { const gr = R * 0.32 + r() * 3, gx = C[0] + (r() - 0.5) * 6, gy = C[1] + (r() - 0.5) * 6;
    for (let y = Math.floor(gy - gr * 1.6); y <= gy + gr * 1.6; y++) for (let x = Math.floor(gx - gr * 1.6); x <= gx + gr * 1.6; x++) { const t = at(x, y); if (t === VGT.ROCK || t === VGT.WATER || t === VGT.BRIDGE || t === VGT.ROAD || t === 255) continue;
      if (Math.hypot((x - gx) / 1.25, y - gy) < gr * (0.75 + nz(x / 5, y / 5, 2) * 0.5)) set(x, y, VGT.GREEN); }
    V.green = [gx, gy, gr]; }
  // Lanes: a back lane loops out from a road and back to it, so houses can stand along it (no dead ends).
  const clearMap = () => { const D = new Uint8Array(W * H).fill(9), q = []; for (let i = 0; i < W * H; i++) if (T[i] === VGT.BUILD || T[i] === VGT.PLOT) { D[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; if (D[i] >= 5) continue; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const nx = x + a, ny = y + b; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (D[j] > D[i] + 1) { D[j] = D[i] + 1; q.push(j); } } } return D; };
  const laneCost = (D, near, wetOk) => (x, y) => { if (D[y * W + x] < 4 && !(near && near.some(p => Math.hypot(x - p[0], y - p[1]) < 5))) return Infinity; const t = at(x, y); if (t === VGT.ROAD || t === VGT.BRIDGE) return near && near.some(p => Math.hypot(x - p[0], y - p[1]) < 3) ? 1 : 6; return wetOk ? roadCost(x, y, 1) : roadCost(x, y); };
  // A back lane: it leaves a road, runs alongside it some way off, and comes back to it — a loop, never a dead end, and kept
  // clear of the other roads so lanes don't tangle.
  const laneCap = ({ hamlet: 1, village: 3, large: 5 })[size];
  const why = k => { (V.why = V.why || {})[k] = (V.why[k] || 0) + 1; return null; };
  const growLane = (maxD) => { if (V.lanes.filter(l => l.kind === "lane").length >= laneCap) return null;
    const pts = []; V.roads.concat(V.lanes).forEach(rd => { if (rd.kind !== "road" && rd.kind !== "lane") return; rd.d.forEach((p, j) => { const d = Math.hypot(p[0] - C[0], p[1] - C[1]); if (d > R * 0.25 && d < maxD && (rd.loop || (j > 16 && j < rd.d.length - 60))) pts.push([rd, j]); }); });
    if (!pts.length) return null; let [rd, j] = pts[Math.floor(rr() * pts.length)]; const n = rd.d.length, L = Math.round(R * (0.35 + rr() * 0.3)), span = Math.round(L * (1.6 + rr() * 1.4) / 0.5);
    let j1 = j; if (!rd.loop && j + span >= n - 8) { j1 = j - span; if (j1 < 12) return why('short'); }
    const idx = k => rd.loop ? (k % n + n) % n : Math.max(0, Math.min(n - 1, k)), j2 = idx(j1 + span); j = j1;
    const S = rd.d[j], Tt = rd.d[j2], side = rr() < 0.5 ? 1 : -1, nrmAt = k => { const t = dirAt(rd, k, 1); return [-t[1] * side, t[0] * side]; };
    const ctl = [S.slice()]; const steps = Math.max(2, Math.round(span / 14));
    for (let q = 0; q <= steps; q++) { const k = idx(j + Math.round(span * q / steps)), nm = nrmAt(k), tg = dirAt(rd, k, 1), end = q === 0 ? 1 : q === steps ? -1 : 0, f = end ? 0.6 : 1; ctl.push([rd.d[k][0] + nm[0] * L * f + tg[0] * L * 0.5 * end, rd.d[k][1] + nm[1] * L * f + tg[1] * L * 0.5 * end]); }
    ctl.push(Tt.slice());
    const lane = mkRoad(ctl.map(([x, y]) => [Math.round(x * 2) / 2, Math.round(y * 2) / 2]), false, "lane");
    if (lane.d.some(([x, y]) => x < 2 || y < 2 || x > W - 3 || y > H - 3)) return why('edge');
    // Nothing in the way: no buildings, rock or water, and no other road except where it joins.
    const foot = vgFoot(lane.d, W, H); let wet = 0; for (const i of foot) { const t = T[i], x = i % W, y = (i / W) | 0, nearEnd = Math.hypot(x - S[0], y - S[1]) < 7 || Math.hypot(x - Tt[0], y - Tt[1]) < 7;
      if (t === VGT.BUILD) return why('plot'); if (t === VGT.ROCK) return why('rockwater'); if (t === VGT.WATER && ++wet > 14) return why('rockwater'); if ((t === VGT.ROAD || t === VGT.BRIDGE) && !nearEnd) return why('road'); }
    for (let k = 10; k < lane.d.length - 10; k += 2) { const [x, y] = lane.d[k]; for (let b = -5; b <= 5; b++) for (let a2 = -5; a2 <= 5; a2++) { const t = at(Math.floor(x) + a2, Math.floor(y) + b); if ((t === VGT.ROAD || t === VGT.BRIDGE) && Math.hypot(x - S[0], y - S[1]) > 9 && Math.hypot(x - Tt[0], y - Tt[1]) > 9) return why('near'); } }
    if (!addRoad(lane, { strict: 1, plots: 1 })) return why('fillet'); return lane; };
  // ----- Plots: buildings along the roads, facing them -----
  const occupied = t => t !== VGT.GRASS && t !== VGT.WOOD && t !== VGT.GREEN;
  const rectFree = (x, y, w, h, allowGreen) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const t = at(xx, yy); if (t === 255 || (occupied(t) && !(allowGreen && t === VGT.GREEN)) || (!allowGreen && t === VGT.GREEN)) return false; } return true; };
  const fill = (x, y, w, h, v) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const t = at(xx, yy); if (v === VGT.PLOT && (t === VGT.ROAD || t === VGT.BRIDGE || t === VGT.BUILD)) continue; set(xx, yy, v); } };
  // Every spot along a road (or round the green) a building could face: the road square, which side, and which way it faces.
  const fronts = []; const addFronts = (rd, weight) => { const d = rd.d; for (let i = 8; i < d.length - 8; i += 2) { const dx = d[i + 8][0] - d[i - 8][0], dy = d[i + 8][1] - d[i - 8][1];
      const x = Math.floor(d[i][0]), y = Math.floor(d[i][1]); [[-dy, dx], [dy, -dx]].forEach(([nx, ny]) => { const n = Math.abs(nx) > Math.abs(ny) ? [Math.sign(nx), 0] : [0, Math.sign(ny)]; fronts.push({ x, y, n, hw: VG_RW + 0.75, w: weight, rd, diag: Math.abs(Math.abs(dx) - Math.abs(dy)) < Math.hypot(dx, dy) * 0.5 }); }); } };
  // Lanes first (in a growing village they come before the houses that line them), then everyone faces a road or lane.
  if (!custom) for (let i = 0, n = ({ hamlet: 0, village: 2, large: 3 })[size] + (rr() < 0.5 ? 1 : 0); i < n * 12 && V.lanes.length < n; i++) growLane(R * 0.9);
  // The well: 2 squares across, at the heart of the village (the middle of the ring or the green, or beside the crossing),
  // with worn ground round it that no house is built on.
  { const ok2 = (x, y, m) => { for (let b = -m; b < 2 + m; b++) for (let a = -m; a < 2 + m; a++) { const t = at(x + a, y + b); if (t !== VGT.GRASS && t !== VGT.GREEN && t !== VGT.WOOD) return false; } return true; };
    const c0 = V.ring ? [Math.floor(V.ring[0]) - 1, Math.floor(V.ring[1]) - 1] : V.green ? [Math.round(V.green[0]) - 1, Math.round(V.green[1]) - 1] : [C[0] - 1, C[1] - 1]; let wc = null;
    for (let d = 0; d < 16 && !wc; d++) for (let b = -d; b <= d && !wc; b++) for (let a = -d; a <= d && !wc; a++) if (Math.max(Math.abs(a), Math.abs(b)) === d && ok2(c0[0] + a, c0[1] + b, V.ring ? 0 : 1)) wc = [c0[0] + a, c0[1] + b];
    if (wc) { for (let b = -1; b < 3; b++) for (let a = -1; a < 3; a++) { const t = at(wc[0] + a, wc[1] + b); if (t === VGT.GRASS || t === VGT.WOOD || (t === VGT.GREEN && !V.ring)) set(wc[0] + a, wc[1] + b, VGT.YARD); } V.well = wc; } }
  allRoads().forEach(rd => addFronts(rd, rd.kind === "lane" ? 0.9 : 1));
  if (V.green) { const [gx, gy] = V.green; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== VGT.GREEN) continue;
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => { const t = at(x + dx, y + dy); if (t !== VGT.GREEN && t !== VGT.ROAD && (dx * (x - gx) + dy * (y - gy)) > 0) fronts.push({ x, y, n: [dx, dy], hw: 0.5, w: 0.7, green: 1 }); }); } }
  // Which way to turn a building so its front door faces the road (the door may be on any side of the plan).
  const kFace = (B, n) => { const L0 = B.levels.find(L => L.level === 0), fk = L0 && L0.front && [...L0.front][0]; if (!fk) return kFor(n);
    const [o0, x, y] = fk.split(","), side = o0 === "h" ? [0, Number(y) >= B.H / 2 ? 1 : -1] : [Number(x) >= B.W / 2 ? 1 : -1, 0], want = [-n[0], -n[1]];
    let d = side; for (let k = 0; k < 4; k++) { if (d[0] === want[0] && d[1] === want[1]) return k; d = [-d[1], d[0]]; } return kFor(n); };
  const kFor = n => n[1] === -1 ? 0 : n[1] === 1 ? 2 : n[0] === -1 ? 3 : 1; // the building's front faces back along n (toward the road)
  // Place a building of this kind at a front: its rect (turned to face the road), set back from the road, and its croft behind.
  const place = (o2, f, extra, B) => {
    const k = extra && extra.k != null ? extra.k : kFace(B, f.n), bw = k % 2 ? B.H : B.W, bh = k % 2 ? B.W : B.H, sb = extra && extra.setback != null ? extra.setback : 1 + Math.floor(r() * 2), hw = Math.ceil(f.hw);
    let x, y, sb2 = sb; const [nx, ny] = f.n, m = 2, at2 = q => { if (ny === -1) { y = f.y - hw - q - bh + 1; x = f.x - Math.floor(bw / 2); } else if (ny === 1) { y = f.y + hw + q; x = f.x - Math.floor(bw / 2); }
      else if (nx === -1) { x = f.x - hw - q - bw + 1; y = f.y - Math.floor(bh / 2); } else { x = f.x + hw + q; y = f.y - Math.floor(bh / 2); } return rectFree(x - m, y - m, bw + m * 2, bh + m * 2); };
    for (;; sb2++) { if (at2(sb2)) break; if (sb2 >= sb + (f.diag ? 6 : 2)) return null; }
    // The croft runs back from the house, as wide as the toft; shortened where it meets something.
    const cd = extra && extra.croft != null ? extra.croft : 5 + Math.floor(r() * 8), wide = extra && extra.wide != null ? extra.wide : Math.floor(r() * 2); let plot = null;
    for (let d = cd; d >= 1; d--) { let px, py, pw, ph; if (ny) { px = x - wide; pw = bw + wide * 2; ph = bh + d + sb2; py = ny === -1 ? y - d : y - sb2; } else { py = y - wide; ph = bh + wide * 2; pw = bw + d + sb2; px = nx === -1 ? x - d : x - sb2; }
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
      const p = vgPath(W, H, roadCost, gate, C, i => T[i] === VGT.ROAD || T[i] === VGT.BRIDGE); if (p && p.length > 4) { const tr = mkRoad(fromPath(p), false, "mine"); if (addRoad(tr)) { const n0 = fronts.length; addFronts(tr, 0.8); for (let i = n0; i < fronts.length; i++) fronts[i].mine = 1; } }
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
        if (!rectFree(x, y, bw, bh)) continue; let near = false; for (let yy = y - 2; yy < y + bh + 2 && !near; yy++) for (let xx = x - 2; xx < x + bw + 2; xx++) { const t = at(xx, yy); if (t === VGT.BUILD || t === VGT.PLOT) { near = true; break; } } if (near) continue;
        fill(x - 1, y - 1, bw + 2, bh + 2, VGT.PLOT); fill(x, y, bw, bh, VGT.BUILD);
        done = { o: o2, B, k, x, y, w: bw, h: bh, plot: { x: x - 1, y: y - 1, w: bw + 2, h: bh + 2 }, kind: "mill" }; V.buildings.push(done); V.plots.push(Object.assign({ b: done }, done.plot));
        const door = [k === 0 ? x + Math.floor(bw / 2) : k === 2 ? x + Math.floor(bw / 2) : k === 1 ? x - 1 : x + bw, k === 0 ? y + bh : k === 2 ? y - 1 : y + Math.floor(bh / 2)];
        // Its lane: from a yard in front of the door to the nearest road, wide enough for the miller's wagon.
        const out = k === 0 ? [0, 1] : k === 2 ? [0, -1] : k === 1 ? [-1, 0] : [1, 0];
        for (const st of [3, 4, 5, 6]) { const s0 = [door[0] + out[0] * st, door[1] + out[1] * st]; if (!isFinite(roadCost(s0[0], s0[1]))) continue;
          const lp = vgPath(W, H, laneCost(clearMap(), [s0, door], 1), s0, C, i => T[i] === VGT.ROAD || T[i] === VGT.BRIDGE); if (!lp || lp.length < 3) continue;
          if (addRoad(mkRoad(fromPath(lp), false, "mill"), { strict: 1, allow: 0 })) break; }
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
      for (const [x, y] of spots) { let ok = true; for (let yy = y - 2; yy < y + bh + 2 && ok; yy++) for (let xx = x - 2; xx < x + bw + 2; xx++) { const t = at(xx, yy); if (t === VGT.BUILD || (yy >= y && yy < y + bh && xx >= x && xx < x + bw && t !== VGT.PLOT)) { ok = false; break; } }
        if (!ok) continue; fill(x, y, bw, bh, VGT.BUILD); const nb = { o: o3, B, k, x, y, w: bw, h: bh, plot: null, kind: type, outbuilding: 1 }; V.buildings.push(nb); return nb; } return null; };
    if (wb.barn) behind("barn", "small");
    if (wb.type === "manor") { behind("barn", "medium"); behind("stable", "small"); }
    return true;
  };
  let left = want.filter(wb => !tryPlace(wb));
  if (!custom) left = left.filter(wb => !tryPlace(wb, true));
  // Not everyone fitted: as in a growing village, a new lane branches off the road and draws houses along it.
  for (let g = 0; g < 30 && left.length; g++) {
    if (custom) break; const lane = growLane(R * (1 + g * 0.06)); if (!lane) continue; addFronts(lane, 0.9);
    left = left.filter(wb => !tryPlace(wb, g >= 1)); }
  left = left.filter(wb => !tryPlace(wb, true)); // and the rest wherever a road has room, out toward the fields
  V.wanted = want.length; V.unplaced = left.length;
  // ----- Around the village -----
  // A churchyard round the church, the green's well or pond, a wayside cross where roads meet.
  if (V.green && r() < 0.5) { const [g0, g1, gr] = V.green, an = r() * Math.PI * 2, gx = g0 + Math.cos(an) * gr * 0.55, gy = g1 + Math.sin(an) * gr * 0.55, pr = 1.8 + r() * 1.2; // a pond on the green, off to one side of the well
    for (let y = Math.floor(gy - pr - 1); y <= gy + pr + 1; y++) for (let x = Math.floor(gx - pr * 1.4 - 1); x <= gx + pr * 1.4 + 1; x++) if (at(x, y) === VGT.GREEN && Math.hypot((x - gx) / 1.4, y - gy) < pr * (0.8 + nz(x / 3, y / 3, 2) * 0.4)) set(x, y, VGT.POND); }
  if (V.ring) {}
  else if (!V.green && V.roads.length >= 3) { const sp = [[3, 3], [-4, 3], [3, -4], [-4, -4]].find(([a, b]) => at(C[0] + a, C[1] + b) === VGT.GRASS); if (sp) V.features.push({ k: "cross", x: C[0] + sp[0], y: C[1] + sp[1] }); }
  // What the road editor shows: the roads and lanes (not the mill's lane or the mine track: those follow the mill and mine).
  V.ctl = allRoads().filter(rd => rd.kind === "road" || rd.kind === "lane").map(rd => ({ pts: rd.ctl.map(p => [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2]), loop: rd.loop || undefined }));
  // ----- Footpaths -----
  // The way people actually walk (desire paths): from whichever door is nearest the road, by the shortest easy way, round
  // buildings and never through water. A path that meets another path joins it rather than running beside it, so they
  // branch like real tracks; a little noise in the cost makes them wander, and the drawn line wobbles and varies in width.
  V.paths = []; { const pn = vgNoise((Number(o.seed) || 1) * 13 + 1), nearB = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (T[i] === VGT.BUILD) { const x = i % W, y = (i / W) | 0; for (let b2 = -1; b2 <= 1; b2++) for (let a2 = -1; a2 <= 1; a2++) { const nx = x + a2, ny = y + b2; if (nx >= 0 && ny >= 0 && nx < W && ny < H) nearB[ny * W + nx] = 1; } }
    const bad = t => t === VGT.BUILD || t === VGT.WATER || t === VGT.ROCK || t === VGT.POND || t === VGT.BRIDGE || t === 255;
    const pcost = (x, y) => { const t = at(x, y); if (bad(t)) return Infinity; if (t === VGT.PATH) return 0.6; return (nearB[y * W + x] ? 3 : 1) + pn(x / 5, y / 5, 2) * 1.4 + (t === VGT.WOOD ? 1.5 : 0); };
    const goal = i => T[i] === VGT.ROAD || T[i] === VGT.PATH;
    // The outside squares of a building's doors (the front door first), in map squares.
    const doorsOf = b => { const L0 = b.B.levels.find(L => L.level === 0); if (!L0) return []; const inB = (x, y) => L0.rooms.some(rm => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h), tf = vgTurn(b.k, b.B.W, b.B.H), out = [];
      const add = (cx, cy, ax, ay, fr) => { const [p1, p2] = tf(cx + 0.5, cy + 0.5), [q1, q2] = tf(ax, ay); out.push({ st: [Math.floor(b.x + p1), Math.floor(b.y + p2)], at: [b.x + q1, b.y + q2], fr }); };
      const fr = [...(L0.front || [])].map(k => k.split(",").map(Number)); if (fr.length) { const xs = fr.map(k => k[1]), y = fr[0][2], mx = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2), ax = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
        const pr = L0.rooms.find(rm => rm.porch && mx >= rm.x && mx < rm.x + rm.w && (rm.y === y || rm.y + rm.h === y)); // through the porch to its open end
        if (pr) { if (pr.y === y) add(mx, pr.y + pr.h, ax, pr.y + pr.h, 1); else add(mx, pr.y - 1, ax, pr.y, 1); }
        else add(mx, inB(mx, y) ? y - 1 : y, ax, y, 1); }
      [...(L0.doors || [])].forEach(k => { if (L0.front && L0.front.has(k)) return; const [, x, y] = k.split(",").map(Number); if (k[0] === "h") { const up = inB(x, y - 1), dn = inB(x, y); if (up !== dn) add(x, up ? y : y - 1, x + 0.5, y); } else { const lf = inB(x - 1, y), rt = inB(x, y); if (lf !== rt) add(lf ? x : x - 1, y, x, y + 0.5); } });
      return out; };
    const cost = path => path.reduce((a, [x, y]) => a + pcost(x, y), 0);
    // Nearest the road first, so later paths can join earlier ones.
    V.buildings.forEach(b => { b.doors = doorsOf(b); });
    const jobs = V.buildings.map(b => ({ b, ds: b.doors.filter(d => isFinite(pcost(d.st[0], d.st[1]))) })).filter(j => j.ds.length);
    jobs.forEach(j => { j.d0 = Math.min(...j.ds.map(d => { let m = Infinity; for (let y = d.st[1] - 12; y <= d.st[1] + 12; y++) for (let x = d.st[0] - 12; x <= d.st[0] + 12; x++) if (at(x, y) === VGT.ROAD) m = Math.min(m, Math.hypot(x - d.st[0], y - d.st[1])); return m; })); });
    jobs.sort((a, b) => a.d0 - b.d0);
    jobs.forEach(({ b, ds }) => { let best = null;
      ds.forEach(d => { const p = vgPath(W, H, pcost, d.st, C, goal); if (!p || p.length > 34) return; const c = cost(p) - (d.fr ? 8 : 0); if (!best || c < best.c) best = { c, p, d }; });
      if (!best) return; b.door = best.d.st; const raw = [best.d.at].concat(best.p.map(([x, y]) => [x + 0.5, y + 0.5]));
      best.p.forEach(([x, y]) => { if (at(x, y) !== VGT.ROAD) set(x, y, VGT.PATH); });
      // Smooth it, then let it wander a little side to side (more in the middle than at the ends).
      let d = vgCurve(vgSimplify(raw, 0.8), false, 0.5); const n = d.length, sd = r() * 50;
      d = d.map(([x, y], i) => { const a2 = d[Math.max(0, i - 2)], c2 = d[Math.min(n - 1, i + 2)], tx = c2[0] - a2[0], ty = c2[1] - a2[1], l = Math.hypot(tx, ty) || 1, w = (pn(sd + i * 0.09, 3.7, 2) - 0.5) * 1.1 * Math.sin(Math.PI * Math.min(1, i / Math.max(1, n - 1)));
        return [x - ty / l * w, y + tx / l * w]; });
      const okP = P => P.every(([x, y], i) => { const t = at(Math.floor(x), Math.floor(y)); return !(t === VGT.WATER || t === VGT.POND || t === VGT.BRIDGE || (t === VGT.BUILD && i > 1)); });
      if (!okP(d)) d = vgCurve(vgSimplify(raw, 0.8), false, 0.5); if (!okP(d)) d = raw;
      V.paths.push(d); }); }
  // Meadow by the water, then the open fields in furlongs of strips (three great fields round the village: one fallow),
  // common pasture where they run out, and the rest left to grass and trees.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== VGT.GRASS) continue; let near = false; for (let dy = -5; dy <= 5 && !near; dy++) for (let dx = -5; dx <= 5; dx++) if (at(x + dx, y + dy) === VGT.WATER) { near = true; break; }
    if (near && Math.hypot(x - C[0], y - C[1]) > R * 0.6) set(x, y, VGT.MEADOW); }
  // Furlongs: each from four corner points on a loose grid the neighbours share, so they fit together like a patchwork with a
  // headland between. A corner with a road, house, wood or water in the way moves in until the furlong is clear; if the middle
  // itself is taken, the furlong splits in four and each part tries again. Edges are rounded; the strips run the long way.
  const fieldOf = (x, y) => Math.floor(((Math.atan2(y - C[1], x - C[0]) + Math.PI) / (Math.PI * 2) * 3 + 0.17)) % 3, crops = ["wheat", "barley", "fallow"].sort(() => r() - 0.5);
  const freeF = (x, y) => { for (const [a, b] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) if (at(Math.floor(x + a), Math.floor(y + b)) !== VGT.GRASS) return false; return true; };
  const polyIn = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const roundQ = Q => { // straight sides with rounded corners (a plough team needs room to turn)
    const P = []; Q.forEach((q, i) => { const a = Q[(i + 3) % 4], b = Q[(i + 1) % 4], la = Math.hypot(a[0] - q[0], a[1] - q[1]) || 1, lb = Math.hypot(b[0] - q[0], b[1] - q[1]) || 1, rr = Math.min(3, la * 0.3, lb * 0.3);
      const p0 = [q[0] + (a[0] - q[0]) / la * rr, q[1] + (a[1] - q[1]) / la * rr], p2 = [q[0] + (b[0] - q[0]) / lb * rr, q[1] + (b[1] - q[1]) / lb * rr];
      for (let t = 0; t <= 1.0001; t += 0.25) P.push([0, 1].map(k => (1 - t) * (1 - t) * p0[k] + 2 * (1 - t) * t * q[k] + t * t * p2[k])); }); return P; };
  const cellsIn = P => { const xs = P.map(q => q[0]), ys = P.map(q => q[1]), out = []; for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) if (polyIn(P, x + 0.5, y + 0.5)) out.push([x, y]); return out; };
  const furlong = (Q0, depth) => {
    const mid = Q => [Q.reduce((a, q) => a + q[0], 0) / 4, Q.reduce((a, q) => a + q[1], 0) / 4];
    let Q = Q0.map(q => q.slice()); const [cx, cy] = mid(Q);
    if (Math.hypot(cx - C[0], cy - C[1]) < R * 0.8) return;
    Q = Q.map(([x, y]) => { const dx = cx - x, dy = cy - y, l = Math.hypot(dx, dy) || 1; return [x + dx / l * 1.0, y + dy / l * 1.0]; }); // the headland
    let P = null;
    if (freeF(cx, cy)) for (let it = 0; it < 70; it++) { const R4 = roundQ(Q), hit = [0, 0, 0, 0]; let bad = 0;
      cellsIn(R4).forEach(([x, y]) => { if (freeF(x + 0.5, y + 0.5)) return; bad++; let k = 0, bd = Infinity; Q.forEach((q, qi) => { const d = Math.hypot(q[0] - x - 0.5, q[1] - y - 0.5); if (d < bd) { bd = d; k = qi; } }); hit[k]++; });
      if (!bad) { P = R4; break; }
      hit.forEach((n, k) => { if (!n) return; const q = Q[k], dx = cx - q[0], dy = cy - q[1], l = Math.hypot(dx, dy); if (l < 2) return; const st = Math.min(0.8, l * 0.15); q[0] += dx / l * st; q[1] += dy / l * st; }); }
    const perim = P ? P.reduce((a, q, i) => a + Math.hypot(q[0] - P[(i + 1) % P.length][0], q[1] - P[(i + 1) % P.length][1]), 0) : 1, area = P && cellsIn(P).length / perim > 1.7 ? cellsIn(P).length : 0; // no slivers
    if (!P || area < (depth ? 24 : 60)) { if (depth < 1) { const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [a, b, c, d] = Q0, ab = m(a, b), bc = m(b, c), cd = m(c, d), da = m(d, a), o = mid(Q0);
        [[a, ab, o, da], [ab, b, bc, o], [o, bc, c, cd], [da, o, cd, d]].forEach(q => furlong(q, depth + 1)); } return; }
    const e1 = Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]) + Math.hypot(Q[2][0] - Q[3][0], Q[2][1] - Q[3][1]), e2 = Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]) + Math.hypot(Q[2][0] - Q[1][0], Q[2][1] - Q[1][1]);
    const [ea, eb] = e1 >= e2 ? [Q[0], Q[1]] : [Q[0], Q[3]], cells = cellsIn(P); cells.forEach(([x, y]) => set(x, y, VGT.FIELD));
    V.furlongs.push({ poly: P, ang: Math.atan2(eb[1] - ea[1], eb[0] - ea[0]), crop: crops[fieldOf(cx, cy)], c: [cx, cy], cells }); };
  { const gw = 20 + Math.floor(r() * 6), gh = 16 + Math.floor(r() * 5), nx = Math.ceil(W / gw) + 1, ny = Math.ceil(H / gh) + 1, G = [];
    for (let j = 0; j <= ny; j++) { G.push([]); for (let i = 0; i <= nx; i++) G[j].push([i * gw - gw / 2 + (r() - 0.5) * gw * 0.5, j * gh - gh / 2 + (r() - 0.5) * gh * 0.5]); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) furlong([G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]], 0); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === VGT.GRASS && Math.hypot(x - C[0], y - C[1]) > R * 1.3 && nz(x / 14 + 9, y / 14, 2) > 0.55) set(x, y, VGT.PASTURE);
  // Trees: woods thick with them; a few along the hedges and lanes, in the crofts and on the green.
  const tr = (x, y, s, kind) => V.trees.push([x, y, s, kind || 0]);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const t = at(x, y);
    if (t === VGT.WOOD && r() < 0.42) tr(x + r(), y + r(), 0.9 + r() * 0.9, r() < 0.3 ? 1 : 0);
    else if ((t === VGT.GRASS || t === VGT.PASTURE) && r() < 0.012) tr(x + r(), y + r(), 0.8 + r() * 0.6, 0);
    else if (t === VGT.GREEN && r() < 0.006) tr(x + 0.5, y + 0.5, 1.2 + r() * 0.5, 0);
    else if (t === VGT.ROCK && r() < 0.01) tr(x + r(), y + r(), 0.7 + r() * 0.4, 1); }
  V.plots.forEach(p => { if (!p.b || p.b.kind === "mill") return; if (r() < 0.35) for (let i = 0; i < 2 + Math.floor(r() * 4); i++) { const x = p.x + 1 + r() * (p.w - 2), y = p.y + 1 + r() * (p.h - 2); if (at(Math.floor(x), Math.floor(y)) === VGT.PLOT) tr(x, y, 0.7 + r() * 0.3, 2); } });
  // ----- Everything within reach of a 2-square beast -----
  // Livestock is mostly 2x2: from the roads, a 2x2 creature must reach every door, every furlong, the well and the mine.
  // Anything cut off (a furlong over the river, say) gets a farm track to it, with a little bridge where it crosses water;
  // a furlong no track can reach is given up.
  V.tracks = []; { const walk = t => t !== VGT.BUILD && t !== VGT.WATER && t !== VGT.ROCK && t !== VGT.POND && t !== 255;
    const pos = (x, y) => walk(at(x, y)) && walk(at(x + 1, y)) && walk(at(x, y + 1)) && walk(at(x + 1, y + 1));
    let R2 = null; const flood = () => { R2 = new Uint8Array(W * H); const q = []; for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if ((T[i] === VGT.ROAD) && pos(x, y)) { R2[i] = 1; q.push(i); } }
      for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [a2, b2] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = x + a2, ny = y + b2; if (nx < 0 || ny < 0 || nx >= W - 1 || ny >= H - 1) continue; const j = ny * W + nx; if (R2[j] || !pos(nx, ny)) continue; if (a2 && b2 && !pos(x + a2, y) && !pos(x, y + b2)) continue; R2[j] = 1; q.push(j); } } }; // 8 ways, but no squeezing round a corner
    const reaches = cells => cells.some(([x, y]) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([a2, b2]) => { const X = x + a2, Y = y + b2; return X >= 0 && Y >= 0 && R2[Y * W + X]; }));
    // A track: 2x2 positions over open ground, or over water (which becomes a bridge); never through buildings or rock.
    const tcost = (x, y) => { if (x >= W - 1 || y >= H - 1) return Infinity; let wet = false; for (const [a2, b2] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const t = at(x + a2, y + b2); if (t === VGT.BUILD || t === VGT.ROCK || t === VGT.POND || t === 255) return Infinity; if (t === VGT.WATER) wet = true; } return wet ? 10 : (at(x, y) === VGT.FIELD ? 2 : 1); };
    const link = cells => { let st = null; for (const [x, y] of cells) { for (const [a2, b2] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) if (isFinite(tcost(x + a2, y + b2))) { st = [x + a2, y + b2]; break; } if (st) break; } if (!st) return false; const p = vgPath(W, H, tcost, st, C, i => R2[i] === 1); if (!p) return false;
      const steps = []; p.forEach(([x, y], i) => { if (i) { const [px, py] = p[i - 1]; if (px !== x && py !== y) steps.push([x, py]); } steps.push([x, y]); }); // diagonal steps widened so the beast never squeezes a corner
      steps.forEach(([x, y]) => { for (const [a2, b2] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const t = at(x + a2, y + b2); if (t === VGT.WATER) set(x + a2, y + b2, VGT.BRIDGE); else if (t !== VGT.ROAD && t !== VGT.BRIDGE && t !== VGT.FIELD && t !== VGT.BUILD && t !== VGT.ROCK && t !== VGT.POND && t !== 255) set(x + a2, y + b2, VGT.PATH); } });
      V.tracks.push(vgEase(vgCurve(vgSimplify(p.map(([x, y]) => [x + 1, y + 1]), 0.8), false, 0.5), false, 2, 3)); flood(); return true; };
    flood();
    V.buildings.forEach(b => { const ds = b.door ? [b.door] : (b.doors || []).map(d => d.st); if (!ds.length) return; if (!reaches(ds)) link(ds); });
    if (V.well && !reaches([V.well])) link([V.well]);
    if (V.mineAt) { const near = []; for (let y = V.mineAt[1] - 6; y <= V.mineAt[1] + 6; y++) for (let x = V.mineAt[0] - 6; x <= V.mineAt[0] + 6; x++) if (walk(at(x, y))) near.push([x, y]); if (near.length && !reaches(near)) link(near); }
    V.furlongs = V.furlongs.filter(f => { if (reaches(f.cells)) return true; const mid = f.cells.slice().sort((a, b) => Math.hypot(a[0] - C[0], a[1] - C[1]) - Math.hypot(b[0] - C[0], b[1] - C[1])); if (link(mid.slice(0, 40))) return true;
      f.cells.forEach(([x, y]) => set(x, y, VGT.GRASS)); return false; });
    V.reach2 = { flood: () => { flood(); return R2; }, reaches: c => reaches(c) }; }
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
  const COL = { [VGT.GRASS]: [95, 32, 42], [VGT.WOOD]: [100, 30, 30], [VGT.MEADOW]: [90, 36, 45], [VGT.GREEN]: [100, 40, 45], [VGT.PLOT]: [95, 32, 42], [VGT.PASTURE]: [86, 28, 43], [VGT.FIELD]: [95, 32, 42], [VGT.ROCK]: [30, 6, 52], [VGT.SPOIL]: [30, 5, 45], [VGT.BUILD]: [95, 32, 42], [VGT.YARD]: [95, 32, 42], [VGT.ROAD]: [36, 30, 46], [VGT.LANE]: [38, 28, 48], [VGT.BRIDGE]: [205, 38, 34], [VGT.WATER]: [205, 38, 34], [VGT.POND]: [200, 40, 36] };
  // The ground: one colour per square, then blurred together so grass, meadow, pasture and woodland floor blend smoothly.
  out.push(`<rect x="${(box[0] - 2) * s}" y="${(box[1] - 2) * s}" width="${(box[2] + 4) * s}" height="${(box[3] + 4) * s}" fill="hsl(95 32% 42%)"/>`);
  out.push(`<filter id="vgbl" filterUnits="userSpaceOnUse" x="${(box[0] - 8) * s}" y="${(box[1] - 8) * s}" width="${(box[2] + 16) * s}" height="${(box[3] + 16) * s}"><feGaussianBlur stdDeviation="${(s * 1.8).toFixed(2)}"/></filter><g filter="url(#vgbl)">`);
  for (let y = Math.max(0, Math.floor(box[1]) - 7); y < Math.min(H, box[1] + box[3] + 7); y++) for (let x = Math.max(0, Math.floor(box[0]) - 7); x < Math.min(W, box[0] + box[2] + 7); x++) {
    const t = at(x, y), c = COL[t] || COL[VGT.GRASS]; cell(x, y, t === VGT.ROAD || t === VGT.LANE || t === VGT.WATER || t === VGT.POND || t === VGT.BRIDGE || t === VGT.PATH ? shade(x, y, COL[VGT.MEADOW], 6) : shade(x, y, c, t === VGT.ROCK ? 14 : 8)); }
  out.push(`</g>`);
  // Close up, the grass of the building yards: lighter and darker patches, tufts, a few flowers; and later pebbles and
  // grass along the roads and paths. Each square gets its own fixed scatter, so tiles meet without seams.
  const fine = s >= 14, sq = (x, y) => genRng(((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995) >>> 0), GR = new Set([VGT.GRASS, VGT.MEADOW, VGT.PASTURE, VGT.GREEN, VGT.PLOT, VGT.BUILD, VGT.YARD, VGT.WOOD]);
  const tuft = (rr, x, y, z) => { const c = `hsl(${85 + rr() * 25} 35% ${28 + rr() * 14}%)`; let t = ""; for (let k = 0; k < 3; k++) { const a = -0.6 + k * 0.6 + (rr() - 0.5) * 0.4; t += `M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.sin(a) * z).toFixed(1)} ${(-Math.cos(a) * z).toFixed(1)}`; } return [c, t]; };
  const tuftPaths = {}, addTuft = (rr, x, y, z) => { const [c, t] = tuft(rr, x, y, z), k = c.slice(4, 6) + c.slice(-4, -2); (tuftPaths[k] = tuftPaths[k] || [c, ""])[1] += t; };
  const ix0 = Math.max(0, Math.floor(box[0]) - 1), ix1 = Math.min(W, Math.ceil(box[0] + box[2]) + 1), iy0 = Math.max(0, Math.floor(box[1]) - 1), iy1 = Math.min(H, Math.ceil(box[1] + box[3]) + 1);
  { let patches = ""; for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) { if (!GR.has(at(x, y))) continue; const rr = sq(x, y);
      if (rr() < 0.45) patches += `<ellipse cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" rx="${(s * (0.5 + rr() * 1.8)).toFixed(1)}" ry="${(s * (0.4 + rr() * 1.2)).toFixed(1)}" fill="hsl(${(88 + rr() * 20).toFixed(0)} ${(20 + rr() * 15).toFixed(0)}% ${(36 + rr() * 16).toFixed(0)}%)" opacity="${(0.25 + rr() * 0.3).toFixed(2)}"/>`;
      if (!fine || at(x, y) === VGT.WOOD) continue; const k = s / 40;
      for (let i = 0, n = 1 + (rr() < 0.5 ? 1 : 0); i < n; i++) addTuft(rr, (x + rr()) * s, (y + rr()) * s, (3 + rr() * 4) * k);
      if (rr() < 0.04) patches += `<circle cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" r="${((1.5 + rr() * 1.5) * k).toFixed(1)}" fill="${["#e8d25a", "#e9e4f0", "#c86a8a"][Math.floor(rr() * 3)]}" opacity=".85"/>`; }
    out.push(patches); }
  for (let y = Math.max(0, Math.floor(box[1]) - 1); y < Math.min(H, box[1] + box[3] + 1); y++) for (let x = Math.max(0, Math.floor(box[0]) - 1); x < Math.min(W, box[0] + box[2] + 1); x++) if (at(x, y) === VGT.POND) out.push(`<circle cx="${(x + 0.5) * s}" cy="${(y + 0.5) * s}" r="${s * 0.85}" fill="#3d6f8f"/>`);
  // Fields: strips (selions) across each furlong; wheat, barley or fallow by great field.
  const crop = { wheat: ["#c9a94a", "#b8963c"], barley: ["#a9b45a", "#98a24c"], fallow: ["#8a7048", "#7a6240"] };
  V.furlongs.forEach((f, i) => { if (!inBox(f.c[0], f.c[1], 30)) return; const c = crop[f.crop] || crop.wheat, id = `vgf${i}`, sw = 1.5 * s;
    out.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${sw * 2}" height="${sw * 2}" patternTransform="rotate(${(f.ang * 180 / Math.PI).toFixed(2)})"><rect width="${sw * 2}" height="${sw}" fill="${c[0]}"/><rect y="${sw}" width="${sw * 2}" height="${sw}" fill="${c[1]}"/><path d="M0 ${sw}h${sw * 2}" stroke="rgba(60,45,20,.3)" stroke-width="${Math.max(1, s * 0.06)}"/></pattern>`);
    out.push(`<path d="M${f.poly.map(([x, y]) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`).join("L")}Z" fill="url(#${id})" stroke="#5d4a2c" stroke-opacity=".5" stroke-width="${Math.max(1, s * 0.14)}" stroke-linejoin="round"/>`); });
  // Plots: a worn yard round each house, hedges round the croft, rows of beds.
  V.plots.forEach(p => { if (!inBox(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h))) return;
    const b = p.b; if (!b || b.kind === "mill") return; const back = [b.front[0], b.front[1]]; // front: the way from the road to the house, so the croft runs on that way
    // Garden beds behind the house: rows across the croft.
    const gx = back[0] === 1 ? b.x + b.w + 1 : back[0] === -1 ? p.x + 1 : p.x + 1, gy = back[1] === 1 ? b.y + b.h + 1 : back[1] === -1 ? p.y + 1 : p.y + 1;
    const gw = back[0] ? (back[0] === 1 ? p.x + p.w - 1 - gx : b.x - 1 - gx) : p.w - 2, gh = back[1] ? (back[1] === 1 ? p.y + p.h - 1 - gy : b.y - 1 - gy) : p.h - 2;
    if (gw >= 2 && gh >= 2 && b.kind !== "chapel") { const n = Math.min(5, Math.floor((back[1] ? gw : gh) / 2)), len = Math.min(6, back[1] ? gh : gw), o0 = Math.floor(((back[1] ? gw : gh) - n * 2) / 2); // a few vegetable beds
      for (let i = 0; i < n; i++) { const k = o0 + i * 2; out.push(back[1] ? `<rect x="${(gx + k) * s + s * 0.2}" y="${(back[1] === 1 ? gy : gy + gh - len) * s}" width="${s * 0.6}" height="${len * s}" rx="${s * 0.3}" fill="#6b5536" opacity=".4"/>` : `<rect x="${(back[0] === 1 ? gx : gx + gw - len) * s}" y="${(gy + k) * s + s * 0.2}" width="${len * s}" height="${s * 0.6}" rx="${s * 0.3}" fill="#6b5536" opacity=".4"/>`); } }
    if (b.churchyard) for (let i = 0; i < 14; i++) { const x = p.x + 1 + r() * (p.w - 2), y = p.y + 1 + r() * (p.h - 2); if (at(Math.floor(x), Math.floor(y)) !== VGT.PLOT) continue; out.push(`<rect x="${(x * s).toFixed(1)}" y="${(y * s).toFixed(1)}" width="${s * 0.3}" height="${s * 0.45}" rx="${s * 0.12}" fill="#a8a29a" stroke="#3a3530" stroke-width="${Math.max(0.8, s * 0.04)}"/>`); } });
  // The buildings sit in the ground: a soft shadow under each, and trodden earth at the door.
  out.push(`<filter id="vgsh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(s * 0.45).toFixed(1)}"/></filter>`);
  V.buildings.forEach(b => { if (!inBox(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) + 2)) return;
    if (b.front) { const nx = -b.front[0], ny = -b.front[1], ex = b.x + b.w / 2 + nx * (b.w / 2 + 1), ey = b.y + b.h / 2 + ny * (b.h / 2 + 1), rx = nx ? 1.6 : b.w * 0.3, ry = ny ? 1.6 : b.h * 0.3;
      out.push(`<ellipse cx="${ex * s}" cy="${ey * s}" rx="${rx * s}" ry="${ry * s}" fill="#8a7550" opacity=".45" filter="url(#vgsh)"/>`); }
    const tf = vgTurn(b.k, b.B.W, b.B.H), parts = (b.B.F && b.B.F.wings && b.B.F.wings.length ? b.B.F.wings : [{ x: 0, y: 0, w: b.B.W, h: b.B.H }]).concat(b.B.F && b.B.F.porch ? [b.B.F.porch] : []);
    out.push(`<g filter="url(#vgsh)" fill="rgba(20,25,10,.55)">${parts.map(g => { const [p1, p2] = tf(g.x, g.y), [q1, q2] = tf(g.x + g.w, g.y + g.h); return `<rect x="${(b.x + Math.min(p1, q1) + 0.15) * s}" y="${(b.y + Math.min(p2, q2) + 0.25) * s}" width="${Math.abs(q1 - p1) * s}" height="${Math.abs(q2 - p2) * s}"/>`; }).join("")}</g>`); });
  // Water: the river with its banks, the pond.
  if (V.riverPath) { const d = vgSmooth(V.riverPath, s); out.push(`<path d="${d}" stroke="#5d6b3a" stroke-width="${(V.riverW + 1.2) * s}" fill="none" stroke-linecap="round" opacity=".7"/><path d="${d}" stroke="#3d6f8f" stroke-width="${V.riverW * s}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#5a8fae" stroke-width="${V.riverW * s * 0.45}" fill="none" stroke-linecap="round" opacity=".6"/>`); }
  // Roads and lanes: worn earth with darker edges and ruts.
  // Roads: all the edges first, then all the surfaces, so where roads meet they run into each other in one piece.
  const pd = P => "M" + vgThin(P, 2).map(([x, y]) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`).join("L"), RS = V.roads.concat(V.lanes), all = RS.map(rd => pd(rd.d) + (rd.loop ? "Z" : "")).concat((V.fillets || []).map(pd));
  const ww = VG_RW * 2 * s, rl = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  // The whole network is smoothed as one shape: blurred, then cut back to a hard edge, so every join and bend runs smooth.
  const fx = (box[0] - 12) * s, fy = (box[1] - 12) * s, fw = (box[2] + 24) * s, fh = (box[3] + 24) * s;
  // Roads, lanes, tracks and footpaths as one patch of packed earth, like a building's yard path: the shapes run together,
  // the edges wander a little (noise), then the blur is cut back to a clean edge. No border, no lines.
  out.push(`<filter id="vgrd" filterUnits="userSpaceOnUse" x="${fx}" y="${fy}" width="${fw}" height="${fh}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${(0.55 / s).toFixed(5)}" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${(s * 0.5).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="${(s * 0.5).toFixed(2)}"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 14 -6.5"/></filter>`);
  { const sp = genRng(99), blobs = [], ln = [];
    const add = (d, wd) => { ln.push(`<path d="${pd(d)}" stroke-width="${(s * wd).toFixed(1)}"/>`); for (let i = 3; i < d.length - 2; i += 3) if (sp() < 0.5) blobs.push(`<circle cx="${((d[i][0] + (sp() - 0.5) * 0.5) * s).toFixed(1)}" cy="${((d[i][1] + (sp() - 0.5) * 0.5) * s).toFixed(1)}" r="${(s * wd * (0.45 + sp() * 0.25)).toFixed(1)}"/>`); };
    (V.paths || []).forEach(d => add(d, 1.1)); (V.tracks || []).forEach(d => add(d, 2.1));
    // Colour variation: lighter, darker, redder and greyer patches of earth, kept well inside the road or path.
    let tint = ""; const tc = rr => `hsl(${(28 + rr() * 12).toFixed(0)} ${(22 + rr() * 16).toFixed(0)}% ${(46 + rr() * 18).toFixed(0)}%)`, ROADY = t => t === VGT.ROAD || t === VGT.BRIDGE;
    for (let y = Math.max(1, Math.floor(box[1]) - 2); y < Math.min(H - 1, box[1] + box[3] + 2); y++) for (let x = Math.max(1, Math.floor(box[0]) - 2); x < Math.min(W - 1, box[0] + box[2] + 2); x++) {
      if (at(x, y) !== VGT.ROAD) continue; let inner = true; for (let b = -1; b <= 1 && inner; b++) for (let a = -1; a <= 1; a++) if (!ROADY(at(x + a, y + b))) { inner = false; break; } if (!inner) continue;
      const rr = genRng(((x * 2654435761) ^ (y * 40503) ^ 77) >>> 0); if (rr() < 0.55) tint += `<ellipse cx="${((x + 0.2 + rr() * 0.6) * s).toFixed(1)}" cy="${((y + 0.2 + rr() * 0.6) * s).toFixed(1)}" rx="${(s * (0.5 + rr() * 0.6)).toFixed(1)}" ry="${(s * (0.4 + rr() * 0.5)).toFixed(1)}" fill="${tc(rr)}" opacity="${(0.5 + rr() * 0.4).toFixed(2)}"/>`; }
    (V.paths || []).concat(V.tracks || []).forEach((d, pi) => { const wd = pi < (V.paths || []).length ? 1.1 : 2.1; d.forEach(([x, y], i) => { if (i % 3) return; const rr = genRng(((Math.round(x * 4) * 2654435761) ^ (Math.round(y * 4) * 40503) ^ pi) >>> 0); if (rr() < 0.6) tint += `<circle cx="${(x * s).toFixed(1)}" cy="${(y * s).toFixed(1)}" r="${(s * wd * (0.2 + rr() * 0.15)).toFixed(1)}" fill="${tc(rr)}" opacity="${(0.5 + rr() * 0.4).toFixed(2)}"/>`; }); });
    const shape = `<path d="${all.join("")}" stroke-width="${ww}"/>${ln.join("")}<g fill="hsl(34 30% 56%)" stroke="none">${blobs.join("")}</g>`;
    out.push(`<g filter="url(#vgrd)" fill="none" stroke="hsl(34 30% 56%)" stroke-linecap="round" stroke-linejoin="round">${shape}<g stroke="none">${tint}</g></g>`);
  }
  // Bridges where roads cross water: a plank deck with its rails, as wide as the road.
  // Pebbles and grass along the roads and paths.
  if (fine) { const k = s / 40; let peb = ""; const pebble = (rr, x, y) => { peb += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${((1 + rr() * 2.2) * k).toFixed(1)}" fill="hsl(30 ${(10 + rr() * 15).toFixed(0)}% ${(40 + rr() * 25).toFixed(0)}%)" opacity=".8"/>`; };
    for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) { const t = at(x, y); if (t !== VGT.ROAD) continue; const rr = sq(x + 7, y + 3);
      for (let i = 0; i < 4; i++) pebble(rr, (x + rr()) * s, (y + rr()) * s);
      if (rr() < 0.18) peb += `<ellipse cx="${((x + rr()) * s).toFixed(1)}" cy="${((y + rr()) * s).toFixed(1)}" rx="${((3 + rr() * 6) * k).toFixed(1)}" ry="${((2 + rr() * 4) * k).toFixed(1)}" fill="hsl(92 28% 40%)" opacity=".75"/>`;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => GR.has(at(x + a, y + b))) && rr() < 0.7) addTuft(rr, (x + rr()) * s, (y + rr()) * s, (3 + rr() * 4) * k); }
    (V.paths || []).concat(V.tracks || []).forEach((d, pi) => d.forEach(([x, y], i) => { if (i % 2 || x < ix0 || y < iy0 || x > ix1 || y > iy1) return; const rr = sq(Math.round(x * 4) + pi, Math.round(y * 4));
      pebble(rr, (x + (rr() - 0.5) * 0.7) * s, (y + (rr() - 0.5) * 0.7) * s); if (rr() < 0.5) addTuft(rr, (x + (rr() - 0.5) * 1.3) * s, (y + (rr() - 0.5) * 1.3) * s, (3 + rr() * 3) * k); }));
    // The grass is taller than the packed earth: along both sides of every road and path it leans out over the edge in clumps
    // of blades, each throwing a little shadow onto the earth under it.
    const blades = {}, shade = [], BC = ["hsl(95 32% 38%)", "hsl(92 34% 43%)", "hsl(98 30% 34%)", "hsl(88 36% 47%)"];
    const clump = (rr, x, y, nx, ny, len) => { // rooted at (x, y) on the grass side, leaning along (nx, ny) over the road
      shade.push(`<ellipse cx="${((x + nx * len * 0.55) * s).toFixed(1)}" cy="${((y + ny * len * 0.55 + 0.08) * s).toFixed(1)}" rx="${(len * 0.5 * s).toFixed(1)}" ry="${(len * 0.32 * s).toFixed(1)}"/>`);
      for (let j = 0, n = 4 + Math.floor(rr() * 4); j < n; j++) { const a = Math.atan2(ny, nx) + (rr() - 0.5) * 1.3, L = len * (0.55 + rr() * 0.55), w = 0.05 + rr() * 0.05, bx = x + (rr() - 0.5) * 0.3, by = y + (rr() - 0.5) * 0.3;
        const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L, px = -Math.sin(a) * w, py = Math.cos(a) * w, c = BC[Math.floor(rr() * BC.length)];
        blades[c] = (blades[c] || "") + `M${((bx + px) * s).toFixed(1)} ${((by + py) * s).toFixed(1)}Q${((bx + tx) / 2 * s + px * s * 0.6).toFixed(1)} ${((by + ty) / 2 * s + py * s * 0.6).toFixed(1)} ${(tx * s).toFixed(1)} ${(ty * s).toFixed(1)}Q${((bx + tx) / 2 * s - px * s * 0.6).toFixed(1)} ${((by + ty) / 2 * s - py * s * 0.6).toFixed(1)} ${((bx - px) * s).toFixed(1)} ${((by - py) * s).toFixed(1)}Z`; } };
    // Where the edge really is: the outline of all the roads and paths together (each a line with a half-width), sampled
    // every quarter square; every sample just outside it, on grass, may root a clump leaning in toward the nearest line.
    const segs = []; const addSeg = (d, half, len) => { for (let i = 0; i < d.length - 1; i += 1) segs.push([d[i][0], d[i][1], d[i + 1][0], d[i + 1][1], half, len]); };
    V.roads.concat(V.lanes).forEach(rd => addSeg(rd.loop ? rd.d.concat([rd.d[0]]) : rd.d, VG_RW, 0.55)); (V.fillets || []).forEach(d => addSeg(d, VG_RW, 0.55));
    (V.paths || []).forEach(d => addSeg(d, 0.55, 0.32)); (V.tracks || []).forEach(d => addSeg(d, 1.05, 0.45));
    const bucket = new Map(), bk = (x, y) => Math.floor(x / 3) + "," + Math.floor(y / 3);
    segs.forEach((g, i) => { const x0 = Math.min(g[0], g[2]) - g[4] - 1, x1 = Math.max(g[0], g[2]) + g[4] + 1, y0 = Math.min(g[1], g[3]) - g[4] - 1, y1 = Math.max(g[1], g[3]) + g[4] + 1;
      if (x1 < ix0 - 3 || y1 < iy0 - 3 || x0 > ix1 + 3 || y0 > iy1 + 3) return; for (let by = Math.floor(y0 / 3); by <= Math.floor(y1 / 3); by++) for (let bx = Math.floor(x0 / 3); bx <= Math.floor(x1 / 3); bx++) { const k2 = bx + "," + by; (bucket.get(k2) || bucket.set(k2, []).get(k2)).push(i); } });
    for (let y = iy0; y < iy1; y += 0.25) for (let x = ix0; x < ix1; x += 0.25) { const near = bucket.get(bk(x, y)); if (!near) continue;
      let best = Infinity, bq = null, bl = 0.5; for (const i of near) { const [ax, ay, bx2, by2, half, len] = segs[i], dx = bx2 - ax, dy = by2 - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))), qx = ax + dx * t, qy = ay + dy * t, dd = Math.hypot(x - qx, y - qy) - half; if (dd < best) { best = dd; bq = [qx, qy]; bl = len; } }
      if (best < 0.0 || best > 0.35) continue; const t0 = at(Math.floor(x), Math.floor(y)); if (t0 === VGT.WOOD || t0 === VGT.WATER || t0 === VGT.BRIDGE || t0 === VGT.POND || t0 === VGT.ROCK || t0 === VGT.FIELD || t0 === 255) continue;
      const rr = sq(Math.round(x * 4) + 4099, Math.round(y * 4) - 77); if (rr() < 0.4) continue; const l = Math.hypot(bq[0] - x, bq[1] - y) || 1;
      clump(rr, x + (rr() - 0.5) * 0.1, y + (rr() - 0.5) * 0.1, (bq[0] - x) / l, (bq[1] - y) / l, bl * (0.7 + rr() * 0.6)); if (rr() < 0.15) addTuft(rr, (x - (bq[0] - x) / l * 0.4) * s, (y - (bq[1] - y) / l * 0.4) * s, (3.5 + rr() * 4) * k); }
    out.push(peb); peb = "";
    if (shade.length) out.push(`<filter id="vgbs" filterUnits="userSpaceOnUse" x="${(box[0] - 4) * s}" y="${(box[1] - 4) * s}" width="${(box[2] + 8) * s}" height="${(box[3] + 8) * s}"><feGaussianBlur stdDeviation="${(s * 0.12).toFixed(2)}"/></filter><g filter="url(#vgbs)" fill="#2e2414" opacity=".35">${shade.join("")}</g>`);
    out.push(Object.entries(blades).map(([c, d]) => `<path d="${d}" fill="${c}"/>`).join(""));
    out.push(peb); }
  out.push(Object.values(tuftPaths).map(([c, d]) => `<path d="${d}" stroke="${c}" stroke-width="${(1.6 * s / 40).toFixed(2)}" stroke-linecap="round" fill="none"/>`).join(""));
  { const deck = (lines, wd) => { const runs = []; lines.forEach(d => { let cur = null; d.forEach(p => { const t = at(Math.floor(p[0]), Math.floor(p[1])); if (t === VGT.BRIDGE) { if (!cur) { cur = []; runs.push(cur); } cur.push(p); } else cur = null; }); });
      const bd = runs.filter(rn => rn.length > 1).map(rn => { const a = rn[0], b = rn[rn.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, e = 1.2; return pd([[a[0] - dx / l * e, a[1] - dy / l * e]].concat(rn, [[b[0] + dx / l * e, b[1] + dy / l * e]])); }).join("");
      if (bd) out.push(`<path d="${bd}" stroke="#3b2a1a" stroke-width="${wd + s * 0.7}" fill="none" stroke-linecap="butt" stroke-linejoin="round"/><path d="${bd}" stroke="#8a6038" stroke-width="${wd}" fill="none" stroke-linecap="butt" stroke-linejoin="round"/><path d="${bd}" stroke="#5e4027" stroke-width="${wd}" fill="none" stroke-linecap="butt" stroke-dasharray="${Math.max(1, s * 0.08)} ${s * 0.5}"/>`); };
    deck(RS.map(rd => rd.d).concat(V.fillets || []), ww); deck(V.tracks || [], s * 2.4); }

  // Mountains: rock with ridges and boulders; spoil heaps and the mine's adit.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = at(x, y); if (!inBox(x, y)) continue;
    if (t === VGT.ROCK) { if ([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([a, b]) => { const u = at(x + a, y + b); return u !== VGT.ROCK && u !== 255; })) out.push(`<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="rgba(40,36,32,.35)"/>`);
      if ((x * 7 + y * 13) % 9 === 0) out.push(`<circle cx="${(x + 0.5) * s}" cy="${(y + 0.5) * s}" r="${s * 0.35}" fill="#8f8a82" stroke="#4a4540" stroke-width="${Math.max(1, s * 0.05)}"/>`); }
    else if (t === VGT.SPOIL && (x + y) % 2 === 0) out.push(`<circle cx="${(x + 0.5) * s}" cy="${(y + 0.5) * s}" r="${s * 0.6}" fill="#7d7870" opacity=".9"/>`); }
  if (V.mineAt) { const [mx, my] = V.mineAt; out.push(`<rect x="${(mx - 0.6) * s}" y="${(my - 0.6) * s}" width="${s * 2.2}" height="${s * 2.2}" fill="#1e1a16" stroke="#5e4027" stroke-width="${s * 0.25}"/><text x="${(mx + 0.5) * s}" y="${(my - 1) * s}" font-size="${s * 1.1}" text-anchor="middle" fill="#f1e6cf" stroke="#1e1a16" stroke-width="${s * 0.15}" paint-order="stroke" font-family="sans-serif">⛏ Mine</text>`); }
  // Features: well, wayside cross.
  if (V.well && inBox(V.well[0] + 1, V.well[1] + 1, 3)) { const x = (V.well[0] + 1) * s, y = (V.well[1] + 1) * s; // a stone well with its winch
    out.push(`<circle cx="${x}" cy="${y}" r="${s * 1.9}" fill="#8a7550" opacity=".5" filter="url(#vgsh)"/><circle cx="${x + s * 0.12}" cy="${y + s * 0.15}" r="${s * 0.98}" fill="rgba(0,0,0,.3)"/><circle cx="${x}" cy="${y}" r="${s * 0.95}" fill="#8d8478" stroke="#2b2520" stroke-width="${s * 0.08}"/><circle cx="${x}" cy="${y}" r="${s * 0.95}" fill="none" stroke="#6f675d" stroke-width="${s * 0.18}" stroke-dasharray="${s * 0.35} ${s * 0.08}"/><circle cx="${x}" cy="${y}" r="${s * 0.58}" fill="#1e2a33" stroke="#2b2520" stroke-width="${s * 0.06}"/><circle cx="${x - s * 0.15}" cy="${y - s * 0.15}" r="${s * 0.2}" fill="#3b5a6e" opacity=".7"/><rect x="${x - s * 0.98}" y="${y - s * 0.09}" width="${s * 1.96}" height="${s * 0.18}" rx="${s * 0.05}" fill="#7a5530" stroke="#3b2a1a" stroke-width="${s * 0.04}"/><rect x="${x - s * 1.02}" y="${y - s * 0.2}" width="${s * 0.16}" height="${s * 0.4}" fill="#5e4027"/><rect x="${x + s * 0.86}" y="${y - s * 0.2}" width="${s * 0.16}" height="${s * 0.4}" fill="#5e4027"/><circle cx="${x + s * 0.3}" cy="${y}" r="${s * 0.14}" fill="#c9b48a" stroke="#3b2a1a" stroke-width="${s * 0.03}"/>`); }
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
  const roofs = V.buildings.map((b, bi) => { const svg = genRoofSvg(b.B, b.o.seed).replace(/(id="|url\(#)/g, `$1b${bi}_`), bw = b.B.W, bh = b.B.H, cx = (b.x + b.w / 2) * s, cy = (b.y + b.h / 2) * s;
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
  const TS = Math.min(32, Math.floor(2600 / genDetailPx())); for (let ty = 0; ty < V.H; ty += TS) for (let tx = 0; tx < V.W; tx += TS) { const w = Math.min(TS, V.W - tx), h = Math.min(TS, V.H - ty);
    objs.push({ id: id(), layer: "map", level: 0, x: tx, y: ty, w, h, px: 40, land: 1, img: "", vb: [tx, ty, w, h] }); }
  V.buildings.forEach((b, bi) => {
    const { page } = genPage(b.o), m = 3, BW = b.B.W, BH = b.B.H, tf = vgTurn(b.k, BW, BH), to = (x, y) => { const [a, c] = tf(x - m, y - m); return [a + b.x, c + b.y]; };
    page.objs.forEach((ob, i) => { if (i === 0 || ob.layer === "gm") return; // the building's own yard and room names (redone below, upright)
      const [cx, cy] = to(ob.x + ob.w / 2, ob.y + ob.h / 2); objs.push(Object.assign({}, ob, { id: id(), x: cx - ob.w / 2, y: cy - ob.h / 2, rot: ((Number(ob.rot) || 0) + b.k * 90) % 360 || undefined, bld: bi })); });
    page.walls.forEach(w => { const [a, c] = to(w[0], w[1]), [d, e] = to(w[2], w[3]); walls.push([a, c, d, e].concat(w.slice(4))); });
    (page.areas || []).forEach(a => areas.push(Object.assign({}, a, { id: vid("a"), cells: a.cells.map(([cx, cy]) => { const [p1, p2] = to(cx, cy), [q1, q2] = to(cx + 1, cy + 1); return [Math.min(p1, q1), Math.min(p2, q2)]; }) })));
    (page.links || []).forEach(l => { const [p1, p2] = to(l.x, l.y), [q1, q2] = to(l.x + l.w, l.y + l.h); links.push(Object.assign({}, l, { id: vid("l"), x: Math.min(p1, q1), y: Math.min(p2, q2), w: Math.abs(q1 - p1), h: Math.abs(q2 - p2) })); });
    minL = Math.min(minL, page.minLevel || 0); maxL = Math.max(maxL, page.maxLevel || 1);
    // Room names for the GM, upright, one picture per floor of the building.
    if (o.names !== false) b.B.levels.forEach(L => { const texts = L.rooms.filter(rm => !rm.porch).map(rm => { const [cx, cy] = tf(rm.x + rm.w / 2, rm.y + rm.h / 2); return `<text x="${(cx * P).toFixed(1)}" y="${(cy * P).toFixed(1)}" font-family="Georgia,serif" font-size="${Math.min(15, 9 + Math.min(rm.w, rm.h) * 1.5)}" fill="#f1e6cf" stroke="#1e1a16" stroke-width="3" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(rm.n)}</text>`; }).join("");
      objs.push({ id: id(), layer: "gm", level: L.level, x: b.x, y: b.y, w: b.w, h: b.h, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b.w * P} ${b.h * P}" width="${b.w * P}" height="${b.h * P}">${texts}</svg>`) }); });
    // The building's name over its roof, for the GM, upright.
    if (o.names !== false) { const lw = b.w + 8, lh = Math.max(3, b.h); objs.push({ id: id(), layer: "gm", level: b.B.floors, x: b.x - 4, y: b.y + (b.h - lh) / 2, w: lw, h: lh, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lw * P} ${lh * P}" width="${lw * P}" height="${lh * P}"><text x="${lw * P / 2}" y="${lh * P / 2}" font-family="Georgia,serif" font-size="30" font-weight="bold" fill="#f1e6cf" stroke="#1e1a16" stroke-width="6" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(vgName(b))}</text></svg>`) }); }
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
// The preview is a map you can zoom (wheel, pinch, + and −) and drag around, look into at any floor, and — with the road
// editor on — reshape: drag road points, tap a road to add a point, draw new roads, join them up; the village regrows round
// whatever roads you leave it.
const vgName = b => { const n = VG_LABEL[b.kind] || b.kind; return n.charAt(0).toUpperCase() + n.slice(1); };
const VG_LABEL = { chapel: "church", manor: "manor house", mill: "mill", blacksmith: "smithy", bakehouse: "bakehouse", tavern: "alehouse", stable: "stable", farmhouse: "farmhouse", barn: "barn", house: "house", cottage: "cottage" };
Object.assign(VG, { V: null, view: null, lvl: "roof", edit: false, sel: null, add: null, cache: new Map() });
const vgClone = rs => rs.map(rd => ({ pts: rd.pts.map(p => p.slice()), loop: rd.loop || undefined }));
const vgPct = (v, of) => (v / of * 100).toFixed(4) + "%";
// One building at the chosen floor: its roof, or the floor with its furniture, turned as it stands.
function vgBuildingHtml(V, b, lvl, o) {
  const B = b.B, levels = B.levels.map(L => L.level), top = Math.max(...levels), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let want = lvl === "roof" ? "roof" : lvl === "cellar" ? -1 : lvl === "upper" ? 1 : 0, dim = false;
  if (want === -1 && !levels.includes(-1)) { want = 0; dim = true; } if (want === 1 && top < 1) want = "roof";
  const key = [b.o.type, b.o.seed, b.o.size, want, o.furn !== false].join("|"); let inner = VG.cache.get(key), w, h;
  if (want === "roof") { w = B.W; h = B.H; if (!inner) inner = `<img src="${genUrl(genRoofSvg(B, b.o.seed))}" alt="">`; }
  else { w = B.W + GEN_PAD * 2; h = B.H + GEN_PAD * 2; if (!inner) { const L = B.levels.find(x => x.level === want);
      inner = `<img src="${genUrl(genFloorSvg(B, L, false, b.o.seed, false, "base"))}" alt="">` + (o.furn !== false ? genFurnBoxes(L).map(f => `<img class="vgfp" src="${esc(f.src)}" alt="" style="left:${vgPct(f.x + GEN_PAD, w)};top:${vgPct(f.y + GEN_PAD, h)};width:${vgPct(f.w, w)};height:${vgPct(f.h, h)}${f.rot ? `;transform:rotate(${f.rot}deg)` : ""}">`).join("") : "") + `<img class="vgfp" src="${genUrl(genFloorSvg(B, L, false, b.o.seed, false, "top"))}" alt="" style="left:0;top:0;width:100%;height:100%">`; } }
  VG.cache.set(key, inner); if (VG.cache.size > 400) VG.cache.delete(VG.cache.keys().next().value);
  return `<div class="vgb${dim ? " dim" : ""}" style="left:${vgPct(cx - w / 2, V.W)};top:${vgPct(cy - h / 2, V.H)};width:${vgPct(w, V.W)};height:${vgPct(h, V.H)}${b.k ? `;transform:rotate(${b.k * 90}deg)` : ""}">${inner}</div>`;
}
// The road editor's layer: every road as a line through its points, with a handle on each point.
function vgEditSvg(V) {
  const o = VG.o, rs = o.roads || [], S = (VG.view && VG.view.S) || 8, hr = 9 / S, out = [];
  rs.forEach((rd, i) => { if (!rd || !rd.pts || rd.pts.length < 2) return; const d = vgEase(vgCurve(rd.pts, !!rd.loop), !!rd.loop), pd = "M" + vgThin(d, 2).map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L"), on = VG.sel && VG.sel.r === i;
    out.push(`<path class="vgehit" d="${pd}" data-r="${i}" stroke-width="${16 / S}"/><path d="${pd}" class="vgeline${on ? " on" : ""}" stroke-width="${(on ? 4 : 2.5) / S}"/>`);
    rd.pts.forEach(([x, y], j) => out.push(`<circle class="vgeh${on && VG.sel.p === j ? " on" : ""}${j === 0 || j === rd.pts.length - 1 ? " end" : ""}" data-r="${i}" data-p="${j}" cx="${x}" cy="${y}" r="${hr}" stroke-width="${2 / S}"/>`)); });
  if (VG.add && VG.add.length) { const d = VG.add; out.push(`<path class="vgeline add" d="M${d.map(p => p.join(" ")).join("L")}" stroke-width="${3 / S}"/>`); d.forEach(([x, y]) => out.push(`<circle class="vgeh add" cx="${x}" cy="${y}" r="${hr}" stroke-width="${2 / S}"/>`)); }
  return `<svg class="vgedit" viewBox="-0.0001 -0.0001 ${V.W} ${V.H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${out.join("")}</svg>`;
}
// Names, upright whatever way a building is turned: building names over the roofs, room names on the floors.
function vgNamesHtml(V, lvl) {
  const out = [], pc = (x, y) => `left:${vgPct(x, V.W)};top:${vgPct(y, V.H)}`;
  V.buildings.forEach(b => { const B = b.B, levels = B.levels.map(L => L.level), top = Math.max(...levels); let want = lvl === "roof" ? "roof" : lvl === "cellar" ? -1 : lvl === "upper" ? 1 : 0;
    if (want === 1 && top < 1) want = "roof"; if (want === -1 && !levels.includes(-1)) return;
    if (want === "roof") { out.push(`<span class="vgname bld" style="${pc(b.x + b.w / 2, b.y + b.h / 2)}">${esc(vgName(b))}</span>`); return; }
    const L = B.levels.find(x => x.level === want), tf = vgTurn(b.k, B.W, B.H); if (!L) return;
    L.rooms.filter(rm => !rm.porch).forEach(rm => { const [cx, cy] = tf(rm.x + rm.w / 2, rm.y + rm.h / 2); out.push(`<span class="vgname" style="${pc(b.x + cx, b.y + cy)}">${esc(rm.n)}</span>`); }); });
  return `<div class="vgnames">${out.join("")}</div>`;
}
function vgStageHtml(V) {
  const o = VG.o, s = Math.max(4, Math.min(8, Math.floor(1100 / V.W)));
  return `<img class="vgland" src="${genUrl(vgTerrainSvg(V, s))}" alt="The village" draggable="false"><div class="vgdetail"></div><div class="vgbs">${V.buildings.map(b => vgBuildingHtml(V, b, VG.lvl, o)).join("")}</div>${o.names !== false ? vgNamesHtml(V, VG.lvl) : ""}${VG.edit ? vgEditSvg(V) : ""}`;
}
function vgSummary(V) {
  const order = ["chapel", "manor", "mill", "blacksmith", "bakehouse", "tavern", "stable", "farmhouse", "barn", "house", "cottage"];
  const list = order.filter(k => V.counts[k]).map(k => `${V.counts[k] > 1 ? V.counts[k] + " " : ""}${VG_LABEL[k]}${V.counts[k] > 1 ? (VG_LABEL[k].endsWith("h") ? "es" : "s") : ""}`).join(", ");
  const exits = V.custom ? "your own roads" : `${V.nRoads} road${V.nRoads > 1 ? "s" : ""} out`;
  const what = [V.custom ? "" : V.centre === "ring" ? "Round a ring road" : V.centre === "green" ? "Round a green" : "Where the roads meet", exits, V.river === "river" ? "on a river" : V.river === "stream" ? "by a stream" : "", V.land === "mountains" ? "under the mountains" : V.land === "hills" ? "in the hills" : "", V.mine ? "with a mine" : ""].filter(Boolean).join(" · ");
  return `<p class="small"><strong>${V.W} × ${V.H} squares</strong> <span class="muted">(${V.W * 5} × ${V.H * 5} ft) · ${esc(what)} · ${V.buildings.length} buildings</span><br><span class="muted">${esc(list)}</span></p>`;
}
function vgToolbarHtml() {
  const L = [["roof", "Roofs"], ["upper", "Upper floors"], ["0", "Ground floor"], ["cellar", "Cellars"]], cur = String(VG.lvl);
  const sel = VG.sel && VG.o.roads && VG.o.roads[VG.sel.r];
  return `<div class="vgbar"><div class="seg" role="group" aria-label="Floor">${L.map(([v, l]) => `<button class="${cur === v ? "on" : ""}" data-act="gvlvl" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join("")}</div>
    <span class="vgzoom"><button class="btn ghost small" data-act="gvzoom" data-v="-1" aria-label="Zoom out">−</button><button class="btn ghost small" data-act="gvzoom" data-v="0" aria-label="Fit the map">⤢</button><button class="btn ghost small" data-act="gvzoom" data-v="1" aria-label="Zoom in">+</button></span>
    <button class="btn small${VG.edit ? "" : " ghost"}" data-act="gvedit" aria-pressed="${VG.edit}">✏️ ${VG.edit ? "Done editing roads" : "Edit roads"}</button></div>
    ${VG.edit ? `<div class="vgbar vgebar">${VG.add ? `<span class="small">Tap the map to lay the new road's points (start or end on a road to join it). </span><button class="btn small" data-act="gvaddok">Finish road</button><button class="btn ghost small" data-act="gvaddno">Cancel</button>`
      : `<button class="btn ghost small" data-act="gvadd">➕ New road</button>${sel ? `${sel.pts.length > 2 && VG.sel.p != null ? `<button class="btn ghost small" data-act="gvdelpt">Delete point</button>` : ""}<button class="btn ghost small" data-act="gvloop">${sel.loop ? "Open the loop" : "Close into a loop"}</button><button class="btn ghost small danger" data-act="gvdelroad">Delete road</button>` : ""}<button class="btn ghost small" data-act="gvreset" title="Throw away your road changes">↺ Generated roads</button>
      <span class="muted small">Drag a point to move it · tap a road to add a point · tap a point to pick it · drag an end onto another road or off the map edge.</span>`}</div>` : ""}`;
}
function vgRender(keepView) {
  const el = document.getElementById("gv-prev"); if (!el || !VG.o) return;
  const V = VG.V = genVillage(VG.o);
  if (!el.querySelector(".vgview")) el.innerHTML = `<div id="gv-sum"></div><div id="gv-bar"></div><div class="vgview" id="gv-view"><div class="vgstage" id="gv-stage"></div></div>`;
  document.getElementById("gv-sum").innerHTML = vgSummary(V); document.getElementById("gv-bar").innerHTML = vgToolbarHtml();
  document.getElementById("gv-stage").innerHTML = vgStageHtml(V);
  if (!keepView || !VG.view || VG.view.W !== V.W) vgFit(); else vgApply();
}
const vgRefresh = () => vgRender(true);
// Zoomed in, the ground is redrawn in tiles at full detail (grass tufts, flowers, pebbles), only where you're looking.
let vgDetT = 0; const vgDetailSoon = () => { clearTimeout(vgDetT); vgDetT = setTimeout(vgDetail, 120); };
function vgDetail() { const st = document.getElementById("gv-stage"), vw = document.getElementById("gv-view"), v = VG.view, V = VG.V; if (!st || !vw || !v || !V) return; const lay = st.querySelector(".vgdetail"); if (!lay) return;
  if (v.S < 12) { lay.innerHTML = ""; return; }
  if (!VG.det || VG.det.V !== V) VG.det = { V, map: new Map() }; const T = 16, r = vw.getBoundingClientRect();
  const x0 = Math.max(0, Math.floor(-v.x / v.S / T)), y0 = Math.max(0, Math.floor(-v.y / v.S / T)), x1 = Math.min(Math.ceil(V.W / T), Math.ceil((r.width - v.x) / v.S / T)), y1 = Math.min(Math.ceil(V.H / T), Math.ceil((r.height - v.y) / v.S / T));
  const want = []; for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) want.push([tx, ty]); if (want.length > 40) { lay.innerHTML = ""; return; }
  const have = new Set([...lay.children].map(e => e.dataset.k)); [...lay.children].forEach(e => { if (!want.some(([a, b]) => a + "," + b === e.dataset.k)) e.remove(); });
  want.forEach(([tx, ty]) => { const k = tx + "," + ty; if (have.has(k)) return; let url = VG.det.map.get(k); if (!url) { const w = Math.min(T, V.W - tx * T), h = Math.min(T, V.H - ty * T); url = genUrl(vgTerrainSvg(V, 24, [tx * T, ty * T, w, h])); VG.det.map.set(k, url); }
    const w = Math.min(T, V.W - tx * T), h = Math.min(T, V.H - ty * T), im = document.createElement("img"); im.dataset.k = k; im.src = url; im.alt = ""; im.draggable = false;
    im.style.cssText = `left:${vgPct(tx * T, V.W)};top:${vgPct(ty * T, V.H)};width:${vgPct(w, V.W)};height:${vgPct(h, V.H)}`; lay.appendChild(im); }); }
function vgFit() { const vw = document.getElementById("gv-view"); if (!vw || !VG.V) return; vw.style.height = Math.round(Math.min(innerHeight * 0.72, 820, vw.clientWidth * VG.V.H / VG.V.W + 12)) + "px"; const r = vw.getBoundingClientRect(), S = Math.max(2, Math.min((r.width - 8) / VG.V.W, (r.height - 8) / VG.V.H));
  VG.view = { S, x: (r.width - VG.V.W * S) / 2, y: (r.height - VG.V.H * S) / 2, W: VG.V.W }; vgApply(); }
function vgApply() { const st = document.getElementById("gv-stage"), v = VG.view; if (!st || !v || !VG.V) return; st.style.width = VG.V.W * v.S + "px"; st.style.height = VG.V.H * v.S + "px"; st.style.setProperty("--vgS", v.S); st.classList.toggle("vgfar", v.S < 9); vgDetailSoon(); st.style.transform = `translate(${v.x}px,${v.y}px)`;
  const ed = st.querySelector(".vgedit"); if (ed && VG.edit) { const tmp = document.createElement("div"); tmp.innerHTML = vgEditSvg(VG.V); ed.replaceWith(tmp.firstChild); } }
function vgZoomAt(f, px, py) { const v = VG.view; if (!v) return; const nS = Math.max(1.5, Math.min(60, v.S * f)); v.x = px - (px - v.x) * nS / v.S; v.y = py - (py - v.y) * nS / v.S; v.S = nS; vgApply(); }
const vgRedrawEdit = () => { const st = document.getElementById("gv-stage"); if (!st || !VG.V) return; const ed = st.querySelector(".vgedit"), tmp = document.createElement("div"); tmp.innerHTML = vgEditSvg(VG.V); if (ed) ed.replaceWith(tmp.firstChild); else st.appendChild(tmp.firstChild); };
// Map squares under a pointer.
const vgAt = ev => { const st = document.getElementById("gv-stage").getBoundingClientRect(), v = VG.view; return [(ev.clientX - st.left) / v.S, (ev.clientY - st.top) / v.S]; };
// A road end dropped near another road joins it; one dragged off the map runs to the edge.
function vgSnap(p, skip) { const o = VG.o, V = VG.V; let best = null;
  (o.roads || []).forEach((rd, i) => { if (i === skip || !rd.pts || rd.pts.length < 2) return; vgCurve(rd.pts, !!rd.loop, 0.5).forEach(q => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < 3 && (!best || d < best.d)) best = { d, q }; }); });
  if (best) return [Math.round(best.q[0] * 2) / 2, Math.round(best.q[1] * 2) / 2];
  let [x, y] = p; if (x < 1) x = -3; if (y < 1) y = -3; if (x > V.W - 1) x = V.W + 3; if (y > V.H - 1) y = V.H + 3; return [Math.round(x * 2) / 2, Math.round(y * 2) / 2]; }
const vgEnsureRoads = () => { if (!VG.o.roads) VG.o.roads = vgClone(VG.V.ctl); };

function viewVillageGen(camp) {
  if (!VG.o) VG.o = vgDefaults(); const o = VG.o;
  const seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? "on" : ""}" data-act="gvopt" data-k="${k}" data-v="${v}" aria-pressed="${String(o[k]) === String(v)}">${l}</button>`).join("")}</div>`;
  setTimeout(() => vgRender(false), 0);
  return `<section class="page genpage"><a href="#gen-${esc(camp)}" class="vback">← Generator</a>
    <h1>🏡 Village</h1><p class="muted">Houses along the roads on their tofts and crofts, the church and manor, the mill on the water, open fields in strips, meadow, woods — and every building one you can walk into, floor by floor.</p>
    <div class="genlayout"><div class="genopts">
      <label><span>Size</span>${seg("size", [["hamlet", "Hamlet"], ["village", "Village"], ["large", "Large"]])}</label>
      <label><span>Roads to the edge <small class="muted">1 makes a ring road</small></span>${seg("nroads", [["auto", "Any"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"]])}</label>
      <label><span>Centre</span>${seg("centre", [["auto", "Any"], ["junction", "Crossing"], ["green", "Green"], ["ring", "Ring road"]])}</label>
      <label><span>Water</span>${seg("river", [["auto", "Any"], ["none", "None"], ["stream", "Stream"], ["river", "River"]])}</label>
      <label><span>Land</span>${seg("land", [["auto", "Any"], ["open", "Open"], ["hills", "Hills"], ["mountains", "Mountains"]])}</label>
      <label><span>Woods</span>${seg("woods", [["few", "Few"], ["some", "Some"], ["many", "Many"]])}</label>
      <label><span>Mine <small class="muted">in the mountains</small></span>${seg("mine", [["auto", "Maybe"], ["yes", "Yes"], ["no", "No"]])}</label>
      <label class="genchk"><input type="checkbox" data-act="gvchk" data-k="furn"${o.furn !== false ? " checked" : ""}> <span>Furniture in the buildings</span></label>
      <label class="genchk"><input type="checkbox" data-act="gvchk" data-k="names"${o.names !== false ? " checked" : ""}> <span>Names <small class="muted">buildings and rooms, for the GM</small></span></label>
      ${genDetailSeg()}
      <button class="btn" data-act="gvroll">🎲 New village</button>
      <label><span>Seed <small class="muted">the same seed makes the same village</small></span><input id="gv-seed" type="number" value="${o.seed}"></label>
      <p class="muted small" id="gv-custom">${o.roads ? "Your own roads: a new seed keeps them and regrows the village round them." : ""}</p>
      <hr>
      <label><span>Name</span><input id="gv-name" type="text" value="${esc(o.name)}" placeholder="Village"></label>
      <button class="btn" data-act="gvplace" data-camp="${esc(camp)}">Place in the campaign</button>
      <p class="muted small">A new map in this campaign, with every building in place to walk into. Big villages take a little while to draw.</p>
    </div><div class="genprev" id="gv-prev"></div></div></section>`;
}
const vgCustomNote = () => { const n = document.getElementById("gv-custom"); if (n) n.textContent = VG.o.roads ? "Your own roads: a new seed keeps them and regrows the village round them." : ""; };
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act^=gv]"); if (!b || !vCanEdit()) return; const a = b.dataset.act; if (!VG.o) return; const o = VG.o;
  if (a === "gvopt") { const k = b.dataset.k, was = o[k]; o[k] = b.dataset.v; b.parentElement.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    if ((k === "nroads" || k === "centre") && o.roads) { o.roads = null; VG.sel = null; vgCustomNote(); } // back to generated roads
    if (k === "size" && o.roads && VG_SIZES[was] && VG_SIZES[o[k]]) { const f = VG_SIZES[o[k]].W / VG_SIZES[was].W, g = VG_SIZES[o[k]].H / VG_SIZES[was].H; o.roads.forEach(rd => rd.pts = rd.pts.map(([x, y]) => [Math.round(x * f * 2) / 2, Math.round(y * g * 2) / 2])); }
    vgRender(k !== "size"); return; }
  if (a === "gvchk") { o[b.dataset.k] = b.checked; if (b.dataset.k === "furn") VG.cache.clear(); vgRefresh(); return; }
  if (a === "gvroll") { o.seed = genSeed(); const s = document.getElementById("gv-seed"); if (s) s.value = o.seed; vgRefresh(); return; }
  if (a === "gvlvl") { VG.lvl = b.dataset.v === "0" ? 0 : b.dataset.v; vgRefresh(); return; }
  if (a === "gvzoom") { const v = Number(b.dataset.v), r = document.getElementById("gv-view").getBoundingClientRect(); if (!v) vgFit(); else vgZoomAt(v > 0 ? 1.5 : 1 / 1.5, r.width / 2, r.height / 2); return; }
  if (a === "gvedit") { VG.edit = !VG.edit; VG.sel = null; VG.add = null; if (VG.edit) { vgEnsureRoads(); vgCustomNote(); } vgRefresh(); return; }
  if (a === "gvadd") { VG.add = []; VG.sel = null; document.getElementById("gv-bar").innerHTML = vgToolbarHtml(); vgRedrawEdit(); return; }
  if (a === "gvaddno") { VG.add = null; document.getElementById("gv-bar").innerHTML = vgToolbarHtml(); vgRedrawEdit(); return; }
  if (a === "gvaddok") { const pts = VG.add || []; VG.add = null; if (pts.length >= 2) { pts[pts.length - 1] = vgSnap(pts[pts.length - 1]); vgEnsureRoads(); o.roads.push({ pts }); VG.sel = { r: o.roads.length - 1, p: null }; } vgRefresh(); return; }
  if (a === "gvdelpt" && VG.sel) { const rd = o.roads[VG.sel.r]; if (rd && rd.pts.length > 2) rd.pts.splice(VG.sel.p, 1); VG.sel.p = null; vgRefresh(); return; }
  if (a === "gvloop" && VG.sel) { const rd = o.roads[VG.sel.r]; if (rd) rd.loop = rd.loop ? undefined : true; vgRefresh(); return; }
  if (a === "gvdelroad" && VG.sel) { o.roads.splice(VG.sel.r, 1); VG.sel = null; if (!o.roads.length) o.roads = []; vgRefresh(); return; }
  if (a === "gvreset") { o.roads = null; VG.sel = null; vgCustomNote(); vgRender(true); if (VG.edit) { vgEnsureRoads(); vgRedrawEdit(); } return; }
  if (a === "gvplace") { ev.preventDefault(); const n = document.getElementById("gv-name"); o.name = n ? n.value.trim() : ""; b.disabled = true; try { await vgPlace(b.dataset.camp, o); } finally { b.disabled = false; } return; }
});
document.addEventListener("change", ev => { if (ev.target && ev.target.id === "gv-seed" && VG.o) { VG.o.seed = Math.max(1, Math.round(Number(ev.target.value)) || 1); vgRefresh(); } });
// Zoom with the wheel; drag to pan (or, editing, to move a road point); pinch with two fingers.
document.addEventListener("wheel", ev => { const vw = ev.target.closest && ev.target.closest("#gv-view"); if (!vw || !VG.view) return; ev.preventDefault(); const r = vw.getBoundingClientRect(); vgZoomAt(Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
const VGP = { ptrs: new Map(), drag: null };
document.addEventListener("pointerdown", ev => {
  const vw = ev.target.closest && ev.target.closest("#gv-view"); if (!vw || !VG.view) return; VGP.ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (VGP.ptrs.size === 2) { const [p, q] = [...VGP.ptrs.values()]; VGP.drag = { pinch: Math.hypot(p[0] - q[0], p[1] - q[1]), S: VG.view.S }; return; }
  const h = VG.edit && !VG.add && ev.target.closest(".vgeh"), line = VG.edit && !VG.add && !h && ev.target.closest(".vgehit");
  if (h) { const r = Number(h.dataset.r), p = Number(h.dataset.p); VG.sel = { r, p }; VGP.drag = { pt: [r, p], moved: false }; }
  else if (line) { const r = Number(line.dataset.r), rd = VG.o.roads[r], at = vgAt(ev); let bi = 0, bd = Infinity; // put a point in the nearest gap
    for (let i = 0; i < rd.pts.length - (rd.loop ? 0 : 1); i++) { const A = rd.pts[i], B = rd.pts[(i + 1) % rd.pts.length], dx = B[0] - A[0], dy = B[1] - A[1], t = Math.max(0, Math.min(1, ((at[0] - A[0]) * dx + (at[1] - A[1]) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(A[0] + dx * t - at[0], A[1] + dy * t - at[1]); if (d < bd) { bd = d; bi = i; } }
    rd.pts.splice(bi + 1, 0, [Math.round(at[0] * 2) / 2, Math.round(at[1] * 2) / 2]); VG.sel = { r, p: bi + 1 }; VGP.drag = { pt: [r, bi + 1], moved: true }; vgRedrawEdit(); }
  else VGP.drag = { pan: [ev.clientX, ev.clientY, VG.view.x, VG.view.y], moved: false };
  vw.setPointerCapture && vw.setPointerCapture(ev.pointerId); ev.preventDefault();
});
document.addEventListener("pointermove", ev => {
  if (!VGP.ptrs.has(ev.pointerId) || !VGP.drag || !VG.view) return; VGP.ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]); const d = VGP.drag;
  if (d.pinch && VGP.ptrs.size === 2) { const [p, q] = [...VGP.ptrs.values()], r = document.getElementById("gv-view").getBoundingClientRect(), dist = Math.hypot(p[0] - q[0], p[1] - q[1]); vgZoomAt(d.S * dist / d.pinch / VG.view.S, (p[0] + q[0]) / 2 - r.left, (p[1] + q[1]) / 2 - r.top); return; }
  if (d.pan) { if (Math.hypot(ev.clientX - d.pan[0], ev.clientY - d.pan[1]) > 4) d.moved = true; VG.view.x = d.pan[2] + ev.clientX - d.pan[0]; VG.view.y = d.pan[3] + ev.clientY - d.pan[1]; const st = document.getElementById("gv-stage"); if (st) st.style.transform = `translate(${VG.view.x}px,${VG.view.y}px)`; return; }
  if (d.pt) { d.moved = true; const at = vgAt(ev), rd = VG.o.roads[d.pt[0]]; rd.pts[d.pt[1]] = [Math.round(at[0] * 2) / 2, Math.round(at[1] * 2) / 2]; vgRedrawEdit(); }
});
const vgUp = ev => {
  if (!VGP.ptrs.has(ev.pointerId)) return; VGP.ptrs.delete(ev.pointerId); const d = VGP.drag; if (VGP.ptrs.size) return; VGP.drag = null; if (!d || d.pinch) return;
  if (d.pt) { const rd = VG.o.roads[d.pt[0]], j = d.pt[1]; if (d.moved) { if (j === 0 || j === rd.pts.length - 1) rd.pts[j] = vgSnap(rd.pts[j], d.pt[0]); vgRefresh(); } else { document.getElementById("gv-bar").innerHTML = vgToolbarHtml(); vgRedrawEdit(); } return; }
  if (d.pan && !d.moved && VG.edit) { if (VG.add) { const at = vgAt(ev), p = VG.add.length ? [Math.round(at[0] * 2) / 2, Math.round(at[1] * 2) / 2] : vgSnap(at); VG.add.push(p); vgRedrawEdit(); }
    else if (VG.sel) { VG.sel = null; document.getElementById("gv-bar").innerHTML = vgToolbarHtml(); vgRedrawEdit(); } }
};
document.addEventListener("pointerup", vgUp); document.addEventListener("pointercancel", vgUp);
