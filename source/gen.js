// ===== Generators. Buildings for now: a type, a size and a seed make a whole playable building =====
// A generated building is a tabletop page: a floor plan picture per floor, walls with doors and windows on every floor,
// stairs between floors, raised squares for the floors above the ground, a roof on top and room names (GM only).
// The same type, options and seed always make the same building. Saved buildings are pages in the hidden campaign
// vttcamps/genlib, each with page.gen = { type, seed, size, floors, cellar, name, tags }.
const VGEN = "genlib", GEN_PX = 40;
const genRng = seed => { let a = (Number(seed) >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const genInt = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const genSeed = () => Math.floor(Math.random() * 1e9) + 1;

// Floors: how each kind of room looks.
const GEN_FLOOR = {
  wood: { base: "#c8a678", line: "#a98657" }, stone: { base: "#b9b3a8", line: "#958e82" }, earth: { base: "#9a8565", line: "#7d6a4e" },
  tile: { base: "#d6c9ae", line: "#b9a988" }, rug: { base: "#b08a6a", line: "#8e6a4c" }
};
const GEN_KIND = { living: "wood", bed: "wood", kitchen: "stone", store: "earth", cellar: "earth", shop: "wood", work: "wood", forge: "stone", tavern: "wood",
  hall: "stone", office: "wood", meet: "rug", library: "wood", temple: "tile", sanctum: "rug", landing: "wood" };
// Each type: its footprint (frontage × depth, squares) and floors by size, a chance of a cellar, and the rooms on each floor.
// A room: n name, k kind, w how much space it wants, opt the chance it's there at all, front it faces the street, entry the front door's in it.
const GEN_BUILDINGS = [
  { id: "house", name: "House", icon: "🏠", blurb: "A family home: a main room and kitchen downstairs, bedrooms up.",
    size: { small: [[5, 7], [5, 6], [1, 1]], medium: [[6, 8], [6, 8], [1, 2]], large: [[8, 10], [7, 9], [2, 2]] }, cellar: 0.3,
    ground: [{ n: "Main room", k: "living", w: 3, front: 1, entry: 1 }, { n: "Kitchen", k: "kitchen", w: 1.6, back: 1 }, { n: "Pantry", k: "store", w: 0.7, opt: 0.5 }],
    single: [{ n: "Bedroom", k: "bed", w: 1.5 }],
    upper: [{ n: "Bedroom", k: "bed", w: 2 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Bedroom", k: "bed", w: 1.2, opt: 0.5 }, { n: "Storage", k: "store", w: 0.6, opt: 0.35 }],
    under: [{ n: "Cellar", k: "cellar", w: 1 }] },
  { id: "blacksmith", name: "Blacksmith", icon: "⚒", blurb: "A forge open to the street, a store for iron and coal, the smith's rooms.",
    size: { small: [[6, 8], [6, 7], [1, 1]], medium: [[7, 9], [7, 8], [1, 2]], large: [[9, 11], [8, 10], [2, 2]] }, cellar: 0.15, wide: 1,
    ground: [{ n: "Forge", k: "forge", w: 3.2, front: 1, entry: 1 }, { n: "Iron store", k: "store", w: 1.1, back: 1 }, { n: "Coal store", k: "store", w: 0.6, opt: 0.6 }],
    single: [{ n: "Smith's room", k: "bed", w: 1.4 }],
    upper: [{ n: "Living room", k: "living", w: 1.6 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Bedroom", k: "bed", w: 1, opt: 0.5 }],
    under: [{ n: "Cellar", k: "cellar", w: 1 }] },
  { id: "tailor", name: "Tailor", icon: "🧵", blurb: "A shop at the front, a workroom for cutting and sewing, cloth stored behind.",
    size: { small: [[5, 7], [6, 7], [1, 2]], medium: [[6, 8], [7, 8], [2, 2]], large: [[8, 10], [8, 9], [2, 2]] }, cellar: 0.2,
    ground: [{ n: "Shop", k: "shop", w: 2.2, front: 1, entry: 1 }, { n: "Workroom", k: "work", w: 1.8 }, { n: "Cloth store", k: "store", w: 0.8, back: 1 }],
    single: [{ n: "Bedroom", k: "bed", w: 1.3 }],
    upper: [{ n: "Living room", k: "living", w: 1.6 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Fitting room", k: "work", w: 0.9, opt: 0.5 }],
    under: [{ n: "Cellar", k: "cellar", w: 1 }] },
  { id: "general", name: "General store", icon: "🧺", blurb: "A shop floor of everything, a storeroom, a cellar for stock, the owner's rooms.",
    size: { small: [[6, 8], [6, 7], [1, 1]], medium: [[7, 9], [7, 8], [1, 2]], large: [[9, 11], [8, 10], [2, 2]] }, cellar: 0.6,
    ground: [{ n: "Shop floor", k: "shop", w: 3, front: 1, entry: 1 }, { n: "Storeroom", k: "store", w: 1.6, back: 1 }, { n: "Office", k: "office", w: 0.8, opt: 0.6 }],
    single: [{ n: "Owner's room", k: "bed", w: 1.3 }],
    upper: [{ n: "Living room", k: "living", w: 1.6 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Bedroom", k: "bed", w: 1, opt: 0.5 }, { n: "Stock room", k: "store", w: 0.8, opt: 0.4 }],
    under: [{ n: "Stock cellar", k: "cellar", w: 1.5 }, { n: "Cold store", k: "cellar", w: 0.8, opt: 0.4 }] },
  { id: "tavern", name: "Tavern", icon: "🍺", blurb: "A common room with a bar, a kitchen, rooms to let upstairs and a beer cellar.",
    size: { small: [[7, 9], [7, 8], [1, 2]], medium: [[9, 11], [8, 10], [2, 2]], large: [[11, 14], [9, 12], [2, 3]] }, cellar: 0.8,
    ground: [{ n: "Common room", k: "tavern", w: 4, front: 1, entry: 1 }, { n: "Kitchen", k: "kitchen", w: 1.4, back: 1 }, { n: "Bar store", k: "store", w: 0.7 }, { n: "Private room", k: "living", w: 1, opt: 0.5 }],
    single: [{ n: "Keeper's room", k: "bed", w: 1.2 }, { n: "Guest room", k: "bed", w: 1 }],
    upper: [{ n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1, opt: 0.7 }, { n: "Guest room", k: "bed", w: 1, opt: 0.5 }, { n: "Keeper's room", k: "bed", w: 1.4 }],
    under: [{ n: "Beer cellar", k: "cellar", w: 1.6 }, { n: "Store", k: "cellar", w: 0.8, opt: 0.6 }] },
  { id: "guild", name: "Guild hall", icon: "🏛", blurb: "A great hall for the members, offices, a meeting room and the guildmaster's study.",
    size: { small: [[9, 11], [8, 10], [2, 2]], medium: [[11, 14], [10, 12], [2, 3]], large: [[14, 17], [11, 14], [3, 3]] }, cellar: 0.4, hall: 2,
    ground: [{ n: "Great hall", k: "hall", w: 4, front: 1, entry: 1 }, { n: "Reception", k: "office", w: 1 }, { n: "Office", k: "office", w: 1 }, { n: "Archive", k: "store", w: 1, back: 1 }],
    single: [{ n: "Guildmaster's study", k: "office", w: 1.4 }],
    upper: [{ n: "Meeting room", k: "meet", w: 2 }, { n: "Guildmaster's study", k: "office", w: 1.5 }, { n: "Office", k: "office", w: 1 }, { n: "Office", k: "office", w: 1 }, { n: "Library", k: "library", w: 1.5, opt: 0.6 }],
    under: [{ n: "Vault", k: "cellar", w: 1 }, { n: "Store", k: "cellar", w: 1, opt: 0.6 }] },
  { id: "temple", name: "Temple", icon: "⛪", blurb: "A long nave for worship, a sanctum at the far end, a vestry and the priest's room.",
    size: { small: [[6, 8], [8, 10], [1, 1]], medium: [[8, 10], [10, 13], [1, 1]], large: [[10, 13], [13, 16], [1, 2]] }, cellar: 0.3,
    ground: [{ n: "Nave", k: "temple", w: 5, front: 1, entry: 1 }, { n: "Sanctum", k: "sanctum", w: 1.5, back: 1 }, { n: "Vestry", k: "store", w: 0.8 }, { n: "Priest's room", k: "bed", w: 0.8, opt: 0.6 }],
    single: [],
    upper: [{ n: "Priest's quarters", k: "bed", w: 1.5 }, { n: "Study", k: "library", w: 1 }],
    under: [{ n: "Crypt", k: "cellar", w: 1 }] }
];
const genType = id => GEN_BUILDINGS.find(b => b.id === id) || GEN_BUILDINGS[0];

// ----- Laying out a floor -----
// Rooms are rectangles in squares: { x, y, w, h, n, k }. The front of the building (the street) is the bottom edge.
function genSlice(r, rect, rooms, minD) {
  if (rooms.length <= 1) return rooms.length ? [Object.assign({}, rooms[0], rect)] : [];
  const tot = rooms.reduce((a, x) => a + x.w, 0); let acc = 0, k = 1, best = Infinity;
  for (let i = 1; i < rooms.length; i++) { acc += rooms[i - 1].w; const d = Math.abs(acc - tot / 2); if (d < best) { best = d; k = i; } }
  const A = rooms.slice(0, k), B = rooms.slice(k), fa = A.reduce((a, x) => a + x.w, 0) / tot;
  let horiz = rect.h > rect.w ? true : rect.w > rect.h ? false : r() < 0.5; // cut across the longer side
  if ((horiz ? rect.h : rect.w) < minD * 2) horiz = !horiz; // too short that way: try the other
  const len = horiz ? rect.h : rect.w;
  if (len < minD * 2) return [Object.assign({}, rooms[0], rect)]; // too small for more rooms: the first one takes it all
  let cut = Math.round(len * fa + (r() - 0.5) * 0.8); cut = Math.max(minD, Math.min(len - minD, cut));
  let ra, rb;
  if (horiz) { // A (with the front rooms) takes the bottom part
    ra = { x: rect.x, y: rect.y + rect.h - cut, w: rect.w, h: cut }; rb = { x: rect.x, y: rect.y, w: rect.w, h: rect.h - cut };
  } else { const left = r() < 0.5; ra = { x: left ? rect.x : rect.x + rect.w - cut, y: rect.y, w: cut, h: rect.h }; rb = { x: left ? rect.x + cut : rect.x, y: rect.y, w: rect.w - cut, h: rect.h }; }
  return genSlice(r, ra, A, minD).concat(genSlice(r, rb, B, minD));
}
// A strip of rooms side by side along a band's long side.
function genStrip(r, band, rooms, minD) {
  const along = band.w >= band.h, len = along ? band.w : band.h, tot = rooms.reduce((a, x) => a + x.w, 0); let pos = 0; const out = [];
  let n = Math.min(rooms.length, Math.max(1, Math.floor(len / minD))); rooms = rooms.slice(0, n);
  rooms.forEach((rm, i) => { const left = n - i - 1; let sz = i === n - 1 ? len - pos : Math.round(len * rm.w / tot + (r() - 0.5) * 0.6); sz = Math.max(minD, Math.min(len - pos - left * minD, sz));
    out.push(Object.assign({}, rm, along ? { x: band.x + pos, y: band.y, w: sz, h: band.h } : { x: band.x, y: band.y + pos, w: band.w, h: sz })); pos += sz; });
  return out;
}
const genPick = (r, list) => list.filter(x => !x.opt || r() < x.opt).map(x => Object.assign({}, x));
// One building: footprint W × H (squares), floors, cellar; every floor's rooms, the stairs and the doors and windows.
function genBuilding(o) {
  const T = genType(o.type), r = genRng(o.seed), S = T.size[o.size] || T.size.medium;
  const W = genInt(r, S[0][0], S[0][1]), H = genInt(r, S[1][0], S[1][1]);
  const floors = o.floors && o.floors !== "auto" ? Number(o.floors) : genInt(r, S[2][0], S[2][1]);
  const cellar = o.cellar === "yes" ? true : o.cellar === "no" ? false : r() < T.cellar;
  const minD = 2, levels = [];
  // Ground floor: the front rooms first, so they end up on the street side.
  let ground = genPick(r, T.ground).concat(floors === 1 ? genPick(r, T.single) : []);
  ground.sort((a, b) => (b.front || 0) - (a.front || 0) || (a.back || 0) - (b.back || 0));
  const gRooms = genSlice(r, { x: 0, y: 0, w: W, h: H }, ground, minD);
  const entry = gRooms.find(x => x.entry) || gRooms[0];
  // Stairs: two squares at the back of the entry room, along the building's long side.
  const longX = W >= H; let st = null;
  if (floors > 1 || cellar) {
    // As near the middle as the entry room allows, so the corridor upstairs runs down the middle with rooms either side.
    const sw = longX ? 2 : 1, sh = longX ? 1 : 2, left = r() < 0.5, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    if (entry.w >= sw + 1 && entry.h >= sh + 1) st = longX ? { x: left ? entry.x : entry.x + entry.w - sw, y: clamp(Math.floor(H / 2) - (r() < 0.5 ? 1 : 0), entry.y, entry.y + entry.h - 2), w: sw, h: sh }
      : { x: clamp(Math.floor(W / 2) - (r() < 0.5 ? 1 : 0), entry.x, entry.x + entry.w - 1), y: entry.y, w: sw, h: sh };
    else st = { x: left ? 0 : W - sw, y: 0, w: sw, h: sh };
  }
  levels.push({ level: 0, rooms: gRooms, name: "Ground floor" });
  for (let f = 1; f < floors; f++) {
    let rooms = genPick(r, T.upper); if (!rooms.length) rooms = [{ n: "Upstairs room", k: "living", w: 1 }];
    levels.push({ level: f, rooms: genUpper(r, W, H, st, rooms, minD, T.hall || 1), name: f === 1 ? "First floor" : f === 2 ? "Second floor" : `Floor ${f + 1}` });
  }
  if (cellar) { const rooms = genPick(r, T.under); levels.unshift({ level: -1, rooms: rooms.length > 1 ? genUpper(r, W, H, st, rooms, minD, 1, "Cellar stairs") : [Object.assign({}, rooms[0] || { n: "Cellar", k: "cellar" }, { x: 0, y: 0, w: W, h: H })], name: "Cellar" }); }
  // Doors (a tree from the room with the stairs or the front door, so every room can be reached) and windows.
  const front = { x: entry.x + Math.floor((entry.w - (T.wide ? 2 : 1)) / 2), w: T.wide ? 2 : 1 };
  levels.forEach(L => genOpenings(r, L, W, H, st, L.level === 0 ? front : null, T));
  return { type: T.id, W, H, floors, cellar, stairs: st, levels };
}
// An upper floor (or a busy cellar): a landing or corridor through the stairs, with rooms either side of it.
function genUpper(r, W, H, st, rooms, minD, cw, landName) {
  if (!st || rooms.length < 2) { const out = genSlice(r, { x: 0, y: 0, w: W, h: H }, rooms, minD); return out; }
  const longX = W >= H, c = longX ? { x: 0, y: st.y, w: W, h: Math.max(st.h, cw) } : { x: st.x, y: 0, w: Math.max(st.w, cw), h: H };
  if (longX && c.y + c.h > H) c.y = H - c.h; if (!longX && c.x + c.w > W) c.x = W - c.w;
  let bandA = longX ? { x: 0, y: 0, w: W, h: c.y } : { x: 0, y: 0, w: c.x, h: H }, bandB = longX ? { x: 0, y: c.y + c.h, w: W, h: H - c.y - c.h } : { x: c.x + c.w, y: 0, w: W - c.x - c.w, h: H };
  // A band too thin for rooms joins the corridor.
  if ((longX ? bandA.h : bandA.w) < minD) { if (longX) { c.h += c.y; c.y = 0; } else { c.w += c.x; c.x = 0; } bandA = null; }
  if ((longX ? bandB.h : bandB.w) < minD) { if (longX) c.h = H - c.y; else c.w = W - c.x; bandB = null; }
  const bands = [bandA, bandB].filter(Boolean); if (!bands.length) return [Object.assign({}, rooms[0], c)];
  const area = b => b.w * b.h, tot = bands.reduce((a, b) => a + area(b), 0); let split = bands.length > 1 ? Math.round(rooms.length * area(bands[0]) / tot) : rooms.length;
  split = Math.max(bands.length > 1 ? 1 : 0, Math.min(rooms.length - (bands.length > 1 ? 1 : 0), split));
  const parts = bands.length > 1 ? [rooms.slice(0, split), rooms.slice(split)] : [rooms];
  return [Object.assign({}, c, { n: landName || (cw > 1 ? "Corridor" : "Landing"), k: "landing", circ: 1 })].concat(...bands.map((b, i) => genStrip(r, b, parts[i], minD)));
}
// Unit wall edges: "h,x,y" is the edge along the top of square (x, y); "v,x,y" along its left side.
function genOpenings(r, L, W, H, st, front, T) {
  const own = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return -1; return L.rooms.findIndex(rm => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h); };
  L.own = own; L.doors = new Set(); L.wins = new Set(); L.front = new Set();
  const shared = (a, b) => { const out = []; for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) { const u = own(x, y - 1), d = own(x, y); if ((u === a && d === b) || (u === b && d === a)) out.push(`h,${x},${y}`); }
    for (let x = 0; x <= W; x++) for (let y = 0; y < H; y++) { const l = own(x - 1, y), rr = own(x, y); if ((l === a && rr === b) || (l === b && rr === a)) out.push(`v,${x},${y}`); } return out; };
  const n = L.rooms.length, inStairs = rm => st && st.x >= rm.x && st.x < rm.x + rm.w && st.y >= rm.y && st.y < rm.y + rm.h;
  let root = L.rooms.findIndex(x => x.circ); if (root < 0) root = L.level === 0 ? L.rooms.findIndex(x => x.entry) : L.rooms.findIndex(inStairs); if (root < 0) root = 0;
  const seen = new Set([root]), q = [root];
  while (q.length) { const a = q.shift(); for (let b = 0; b < n; b++) { if (seen.has(b)) continue; const e = shared(a, b); if (!e.length) continue;
      const mid = e.filter((_, i) => e.length < 3 || (i > 0 && i < e.length - 1)), pick = (mid.length ? mid : e)[Math.floor(r() * (mid.length ? mid.length : e.length))]; L.doors.add(pick); seen.add(b); q.push(b); } }
  if (front) for (let i = 0; i < front.w; i++) { L.doors.add(`h,${front.x + i},${H}`); L.front.add(`h,${front.x + i},${H}`); }
  if (L.level === 0) { const back = L.rooms.find(x => x.back && x.y === 0 && x.w >= 2); if (back && r() < 0.55) L.doors.add(`h,${back.x + Math.floor(back.w / 2)},0`); }
  if (L.level < 0) return; // cellars have no windows
  L.rooms.forEach(rm => { if (rm.circ && L.level > 0 && r() < 0.5) return;
    const sides = [];
    if (rm.y === 0) sides.push(i => `h,${rm.x + i},0`, rm.w); if (rm.y + rm.h === H) sides.push(i => `h,${rm.x + i},${H}`, rm.w);
    if (rm.x === 0) sides.push(i => `v,0,${rm.y + i}`, rm.h); if (rm.x + rm.w === W) sides.push(i => `v,${W},${rm.y + i}`, rm.h);
    for (let s = 0; s < sides.length; s += 2) { const f = sides[s], len = sides[s + 1]; if (len < 2) continue;
      if (len < 3) continue; const many = len >= 7 ? [Math.floor(len / 4), len - 1 - Math.floor(len / 4)] : [Math.floor((len - 1) / 2)];
      many.forEach(i => { const k = f(i); if (!L.doors.has(k)) L.wins.add(k); }); }
  });
}
function genEdges(L, W, H) {
  const out = [], own = L.own;
  for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) { const a = own(x, y - 1), b = own(x, y); if (a !== b) out.push({ k: `h,${x},${y}`, x1: x, y1: y, x2: x + 1, y2: y, ext: a < 0 || b < 0 }); }
  for (let x = 0; x <= W; x++) for (let y = 0; y < H; y++) { const a = own(x - 1, y), b = own(x, y); if (a !== b) out.push({ k: `v,${x},${y}`, x1: x, y1: y, x2: x, y2: y + 1, ext: a < 0 || b < 0 }); }
  return out;
}

// ----- Drawing a floor plan (clean, flat colours), the roof and the room names -----
function genFloorSvg(B, L, labels) {
  const P = GEN_PX, W = B.W, H = B.H, pad = labels ? 0 : 0, pat = Object.keys(GEN_FLOOR).map(f => { const c = GEN_FLOOR[f];
    if (f === "wood") return `<pattern id="gw" width="${P}" height="${P / 3}" patternUnits="userSpaceOnUse"><rect width="${P}" height="${P / 3}" fill="${c.base}"/><path d="M0 ${P / 3 - 0.5}H${P}M${P * 0.6} 0V${P / 3}" stroke="${c.line}" stroke-width="1"/></pattern>`;
    if (f === "stone") return `<pattern id="gs" width="${P}" height="${P}" patternUnits="userSpaceOnUse"><rect width="${P}" height="${P}" fill="${c.base}"/><path d="M0 ${P / 2}H${P}M${P / 2} 0V${P / 2}M0 ${P}H${P}M${P * 0.25} ${P / 2}V${P}M${P * 0.75} ${P / 2}V${P}" stroke="${c.line}" stroke-width="1.2" fill="none"/></pattern>`;
    if (f === "earth") return `<pattern id="ge" width="${P}" height="${P}" patternUnits="userSpaceOnUse"><rect width="${P}" height="${P}" fill="${c.base}"/><circle cx="${P * .2}" cy="${P * .3}" r="1.5" fill="${c.line}"/><circle cx="${P * .7}" cy="${P * .6}" r="1.2" fill="${c.line}"/><circle cx="${P * .45}" cy="${P * .85}" r="1" fill="${c.line}"/></pattern>`;
    if (f === "tile") return `<pattern id="gt" width="${P / 2}" height="${P / 2}" patternUnits="userSpaceOnUse"><rect width="${P / 2}" height="${P / 2}" fill="${c.base}"/><path d="M0 0H${P / 2}V${P / 2}" stroke="${c.line}" stroke-width="1" fill="none"/></pattern>`;
    return `<pattern id="gr" width="${P}" height="${P}" patternUnits="userSpaceOnUse"><rect width="${P}" height="${P}" fill="${c.base}"/><rect x="3" y="3" width="${P - 6}" height="${P - 6}" fill="none" stroke="${c.line}" stroke-width="1"/></pattern>`;
  }).join("");
  const fid = k => ({ wood: "gw", stone: "gs", earth: "ge", tile: "gt", rug: "gr" })[GEN_KIND[k] || "wood"];
  const rooms = L.rooms.map(rm => `<rect x="${rm.x * P}" y="${rm.y * P}" width="${rm.w * P}" height="${rm.h * P}" fill="url(#${fid(rm.k)})"/>`).join("");
  let stairs = ""; const st = B.stairs;
  if (st && (L.level < B.floors - 1 || L.level < 0 || (L.level === 0 && B.cellar))) { const along = st.w >= st.h, n = 6;
    stairs = `<g class="gstairs"><rect x="${st.x * P}" y="${st.y * P}" width="${st.w * P}" height="${st.h * P}" fill="#e9dfc8" stroke="#5a4a36" stroke-width="2"/>${Array.from({ length: n - 1 }, (_, i) => along ? `<line x1="${(st.x + st.w * (i + 1) / n) * P}" y1="${st.y * P}" x2="${(st.x + st.w * (i + 1) / n) * P}" y2="${(st.y + st.h) * P}" stroke="#5a4a36" stroke-width="1.5"/>` : `<line x1="${st.x * P}" y1="${(st.y + st.h * (i + 1) / n) * P}" x2="${(st.x + st.w) * P}" y2="${(st.y + st.h * (i + 1) / n) * P}" stroke="#5a4a36" stroke-width="1.5"/>`).join("")}</g>`; }
  else if (st && L.level > 0) stairs = `<rect x="${st.x * P}" y="${st.y * P}" width="${st.w * P}" height="${st.h * P}" fill="#e9dfc8" stroke="#5a4a36" stroke-width="2" stroke-dasharray="5 4"/>`;
  const edges = genEdges(L, B.W, B.H);
  const walls = edges.map(e => { const ln = (sw, c, cap, extra) => `<line x1="${e.x1 * P}" y1="${e.y1 * P}" x2="${e.x2 * P}" y2="${e.y2 * P}" stroke="${c}" stroke-width="${sw}" stroke-linecap="${cap}"${extra || ""}/>`;
    if (L.doors.has(e.k)) return ln(e.ext ? 6 : 4, "#8a6a44", "butt", ` opacity=".9"`);
    if (L.wins.has(e.k)) return ln(9, "#2b2520", "square") + ln(3, "#bfe3f2", "butt");
    return ln(e.ext ? 9 : 5, "#2b2520", "square"); }).join("");
  const lab = labels ? L.rooms.map(rm => `<text x="${(rm.x + rm.w / 2) * P}" y="${(rm.y + rm.h / 2) * P}" font-family="system-ui, sans-serif" font-size="${Math.min(13, rm.w * P / Math.max(4, rm.n.length) * 1.7)}" font-weight="700" fill="#3a2e20" text-anchor="middle" dominant-baseline="central" opacity=".85">${esc(rm.n)}</text>`).join("") : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${W * P + pad * 2} ${H * P + pad * 2}" width="${W * P}" height="${H * P}"><defs>${pat}</defs>${rooms}${stairs}${walls}${lab}</svg>`;
}
function genRoofSvg(B, seed) {
  const r = genRng(seed * 7 + 3), P = GEN_PX, W = B.W * P, H = B.H * P, col = ["#8a4b3b", "#6b5a4b", "#5d6673", "#7a5a3a"][Math.floor(r() * 4)], dark = "rgba(0,0,0,.28)";
  const hw = Math.min(W, H) / 2, ridge = W >= H ? `M${hw} ${H / 2}H${W - hw}` : `M${W / 2} ${hw}V${H - hw}`, hips = W >= H ? `M0 0L${hw} ${H / 2}L0 ${H}M${W} 0L${W - hw} ${H / 2}L${W} ${H}` : `M0 0L${W / 2} ${hw}L${W} 0M0 ${H}L${W / 2} ${H - hw}L${W} ${H}`;
  const ch = r() < 0.7 ? (() => { const cx = (0.2 + r() * 0.6) * W, cy = (0.2 + r() * 0.6) * H; return `<rect x="${cx - P * .35}" y="${cy - P * .35}" width="${P * .7}" height="${P * .7}" fill="#7d7266" stroke="#2b2520" stroke-width="3"/>`; })() : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><pattern id="sh" width="${P / 2}" height="${P / 3}" patternUnits="userSpaceOnUse"><rect width="${P / 2}" height="${P / 3}" fill="${col}"/><path d="M0 ${P / 3 - 1}H${P / 2}M${P / 4} 0V${P / 3}" stroke="${dark}" stroke-width="1"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#sh)" stroke="#2b2520" stroke-width="6"/><path d="${hips}" stroke="${dark}" stroke-width="4" fill="none"/><path d="${ridge}" stroke="#2b2520" stroke-width="5"/>${ch}</svg>`;
}
const genUrl = svg => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

// ----- Turning a building into a tabletop page -----
function genPage(o) {
  const B = genBuilding(o), m = 3, ox = m, oy = m, W = B.W + m * 2, H = B.H + m * 2 + 1, T = genType(o.type), id = () => vid("o");
  const objs = [], walls = [], areas = [], links = [], names = {};
  const P = GEN_PX, front = [...B.levels.find(L => L.level === 0).front].map(k => Number(k.split(",")[1]));
  const fx = front.length ? (Math.min(...front) + Math.max(...front) + 1) / 2 : B.W / 2;
  // The yard: grass with a path from the front door to the bottom of the map.
  objs.push({ id: id(), layer: "map", level: 0, x: 0, y: 0, w: W, h: H, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * P} ${H * P}" width="${W * P}" height="${H * P}"><rect width="100%" height="100%" fill="#7d9a5c"/><rect x="${(ox + fx - (T.wide ? 1.2 : 0.7)) * P}" y="${(oy + B.H) * P}" width="${(T.wide ? 2.4 : 1.4) * P}" height="${(H - oy - B.H) * P}" fill="#b8a07a"/></svg>`) });
  B.levels.forEach(L => {
    objs.push({ id: id(), layer: "map", level: L.level, x: ox, y: oy, w: B.W, h: B.H, img: genUrl(genFloorSvg(B, L, false)) });
    objs.push({ id: id(), layer: "gm", level: L.level, x: ox, y: oy, w: B.W, h: B.H, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B.W * P} ${B.H * P}" width="${B.W * P}" height="${B.H * P}">${L.rooms.map(rm => `<text x="${(rm.x + rm.w / 2) * P}" y="${(rm.y + rm.h / 2) * P}" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(rm.n)}</text>`).join("")}</svg>`) });
    genEdges(L, B.W, B.H).forEach(e => { const meta = L.doors.has(e.k) ? { k: "door", id: vid("d"), open: false } : L.wins.has(e.k) ? { k: "window", id: vid("d") } : null;
      walls.push([ox + e.x1, oy + e.y1, ox + e.x2, oy + e.y2, L.level].concat(meta ? [meta] : [])); });
    if (L.level !== 0) areas.push({ id: vid("a"), level: L.level, cells: Array.from({ length: B.W * B.H }, (_, i) => [ox + i % B.W, oy + Math.floor(i / B.W)]) });
    names[L.level] = L.name;
  });
  // Plain wall runs joined end to end, so the map has fewer, longer walls.
  const merged = genMergeWalls(walls);
  const roofLvl = B.floors; names[roofLvl] = "Roof";
  objs.push({ id: id(), layer: "map", level: roofLvl, x: ox, y: oy, w: B.W, h: B.H, img: genUrl(genRoofSvg(B, o.seed)) });
  areas.push({ id: vid("a"), level: roofLvl, cells: Array.from({ length: B.W * B.H }, (_, i) => [ox + i % B.W, oy + Math.floor(i / B.W)]) });
  if (B.stairs) { const lo = B.cellar ? -1 : 0, lv = []; for (let l = lo; l <= B.floors - 1; l++) lv.push(l); if (lv.length > 1) links.push({ id: vid("l"), kind: "stairs", x: ox + B.stairs.x, y: oy + B.stairs.y, w: B.stairs.w, h: B.stairs.h, levels: lv }); }
  return { B, page: { w: W, h: H, bg: "#7d9a5c", grid: true, light: false, fogMem: true, objs, walls: merged, areas, links, levelNames: names, minLevel: B.cellar ? -1 : 0, maxLevel: roofLvl } };
}
function genMergeWalls(walls) {
  const plain = walls.filter(w => w.length === 5), special = walls.filter(w => w.length > 5), out = [];
  const key = (x, y, l) => `${x},${y},${l}`, used = new Set();
  const byStart = new Map(); plain.forEach((w, i) => { const k = key(w[0], w[1], w[4]) + (w[1] === w[3] ? "h" : "v"); byStart.set(k, i); });
  plain.forEach((w, i) => { if (used.has(i)) return; used.add(i); const h = w[1] === w[3]; let end = [w[2], w[3]];
    for (;;) { const k = key(end[0], end[1], w[4]) + (h ? "h" : "v"), j = byStart.get(k); if (j == null || used.has(j)) break; used.add(j); end = [plain[j][2], plain[j][3]]; }
    out.push([w[0], w[1], end[0], end[1], w[4]]); });
  return out.concat(special);
}

// ----- The generator pages -----
// #gen-<camp>                 what to generate
// #gen-<camp>/building        building types, and the buildings you've saved
// #gen-<camp>/building/<type> the building generator
const GEN = { o: null };
function genDefaults(type) { return { type, seed: genSeed(), size: "medium", floors: "auto", cellar: "auto", name: "", tags: [] }; }
function viewGen(camp, kind, type) {
  const c = S.vttCamps && S.vttCamps.get(camp); if (!vCanEdit()) return `<section class="page"><p class="muted">Only the GM can use the generators.</p></section>`;
  if (!c) return `<section class="page"><p class="muted">${S.vttCamps ? "That campaign isn't here any more." : "Opening…"}</p></section>`;
  const back = `<a href="#camp-${esc(camp)}" class="vback">← ${esc(c.name || "Campaign")}</a>`;
  if (!kind) {
    const card = (k, icon, t, d, ready) => ready ? `<a class="gencard" href="#gen-${esc(camp)}/${k}"><span class="genicon">${icon}</span><strong>${t}</strong><span class="muted small">${d}</span></a>` : `<div class="gencard soon" aria-disabled="true"><span class="genicon">${icon}</span><strong>${t}</strong><span class="muted small">${d}</span><span class="gensoon">Coming later</span></div>`;
    return `<section class="page">${back}<h1>Generator</h1><p class="muted">Make maps for ${esc(c.name || "this campaign")}, ready to play on the tabletop.</p>
      <div class="gencards">${card("building", "🏠", "Buildings", "Houses, shops, taverns, temples: every floor, room, door and stair.", true)}${card("village", "🏡", "Villages", "A road and a few dozen buildings.")}${card("town", "🏘", "Towns", "Streets, districts and walls.")}${card("city", "🏰", "Cities", "Whole cities, opened a street or building at a time.")}${card("dungeon", "🕳", "Dungeons", "Rooms, corridors and caves.")}</div></section>`;
  }
  if (kind === "building" && !type) {
    const saved = vPages(VGEN).filter(([, p]) => p.gen), tagSet = new Set(saved.flatMap(([, p]) => p.gen.tags || [])), tf = GEN.tag || "";
    const shown = saved.filter(([, p]) => !tf || (p.gen.tags || []).includes(tf));
    return `<section class="page">${back}<h1>Buildings</h1><p class="muted">Pick a kind of building.</p>
      <div class="gencards">${GEN_BUILDINGS.map(b => `<a class="gencard" href="#gen-${esc(camp)}/building/${b.id}"><span class="genicon">${b.icon}</span><strong>${esc(b.name)}</strong><span class="muted small">${esc(b.blurb)}</span></a>`).join("")}</div>
      <h2 class="sect">Your buildings <span>${saved.length}</span></h2>
      ${tagSet.size ? `<div class="gentags">${["", ...[...tagSet].sort()].map(t => `<button class="chip${tf === t ? " on" : ""}" data-act="gentagf" data-v="${esc(t)}">${t ? esc(t) : "All"}</button>`).join("")}</div>` : ""}
      ${shown.length ? `<div class="gensaved">${shown.map(([pid, p]) => { const g = p.gen, T = genType(g.type), plan = (p.objs || []).find(x => x.layer === "map" && (x.level || 0) === 0 && x.x > 0);
        return `<article class="gensave"><div class="genthumb">${plan ? `<img src="${esc(plan.img)}" alt="">` : ""}</div><div class="gensavebody"><strong>${esc(p.name)}</strong><span class="muted small">${T.icon} ${esc(T.name)} · ${esc(g.size)}</span>${(g.tags || []).length ? `<span class="gentaglist">${g.tags.map(t => `<span class="chip small">${esc(t)}</span>`).join("")}</span>` : ""}
          <div class="acts"><button class="btn small" data-act="genplace" data-id="${esc(pid)}" data-camp="${esc(camp)}">Place in the campaign</button><a class="btn ghost small" href="#gen-${esc(camp)}/building/${esc(g.type)}" data-act="genedit" data-id="${esc(pid)}">Edit</a><button class="btn ghost small danger" data-act="gendel" data-id="${esc(pid)}">Delete</button></div></div></article>`; }).join("")}</div>`
        : `<p class="muted small">${saved.length ? "None with that tag." : "None yet. Generate one and press Save."}</p>`}</section>`;
  }
  if (kind === "building") {
    const T = genType(type); if (!GEN.o || GEN.o.type !== T.id || GEN.o.camp !== camp) GEN.o = Object.assign(genDefaults(T.id), { camp });
    const o = GEN.o, seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? "on" : ""}" data-act="genopt" data-k="${k}" data-v="${v}" aria-pressed="${String(o[k]) === String(v)}">${l}</button>`).join("")}</div>`;
    return `<section class="page genpage"><a href="#gen-${esc(camp)}/building" class="vback">← Buildings</a>
      <h1>${T.icon} ${esc(T.name)}</h1><p class="muted">${esc(T.blurb)}</p>
      <div class="genlayout"><div class="genopts">
        <label><span>Size</span>${seg("size", [["small", "Small"], ["medium", "Medium"], ["large", "Large"]])}</label>
        <label><span>Floors</span>${seg("floors", [["auto", "Any"], [1, "1"], [2, "2"], [3, "3"]])}</label>
        <label><span>Cellar</span>${seg("cellar", [["auto", "Maybe"], ["yes", "Yes"], ["no", "No"]])}</label>
        <button class="btn" data-act="genroll">🎲 New layout</button>
        <label><span>Seed <small class="muted">the same seed makes the same building</small></span><input id="gen-seed" type="number" value="${o.seed}"></label>
        <hr>
        <label><span>Name</span><input id="gen-name" type="text" value="${esc(o.name)}" placeholder="${esc(T.name)}"></label>
        <label><span>Tags <small class="muted">comma between, e.g. poor, docks, stone</small></span><input id="gen-tags" type="text" value="${esc((o.tags || []).join(", "))}"></label>
        <div class="acts"><button class="btn" data-act="gensave">${o.pid ? "Save changes" : "Save to your buildings"}</button><button class="btn ghost" data-act="genplace" data-camp="${esc(camp)}">Place in the campaign</button></div>
      </div><div class="genpreview" id="genpreview">${genPreviewHtml(o)}</div></div></section>`;
  }
  return `<section class="page">${back}<p class="muted">Nothing here yet.</p></section>`;
}
function genPreviewHtml(o) {
  const B = genBuilding(o), levels = B.levels.slice().sort((a, b) => b.level - a.level);
  return `<p class="small"><strong>${B.W} × ${B.H} squares</strong> <span class="muted">(${B.W * 5} × ${B.H * 5} ft) · ${B.floors} floor${B.floors === 1 ? "" : "s"}${B.cellar ? " and a cellar" : ""} · ${B.levels.reduce((a, L) => a + L.rooms.filter(x => !x.circ).length, 0)} rooms</span></p>
    <div class="genfloors"><figure><img src="${genUrl(genRoofSvg(B, o.seed))}" alt="The roof"><figcaption>Roof</figcaption></figure>${levels.map(L => `<figure><img src="${genUrl(genFloorSvg(B, L, true))}" alt="${esc(L.name)}"><figcaption>${esc(L.name)}</figcaption></figure>`).join("")}</div>`;
}
const genRefresh = () => { const el = document.getElementById("genpreview"); if (el && GEN.o) el.innerHTML = genPreviewHtml(GEN.o); };
const genReadForm = () => { const o = GEN.o; if (!o) return; const n = document.getElementById("gen-name"), t = document.getElementById("gen-tags"); if (n) o.name = n.value.trim(); if (t) o.tags = t.value.split(",").map(x => x.trim()).filter(Boolean); };
async function genSaveLib(o) {
  if (!S.vttCamps.has(VGEN)) await vSave("vttcamps/" + VGEN, { name: "Generated buildings", workshop: true, genlib: true, created: new Date().toISOString() });
  const { page } = genPage(o), T = genType(o.type), pid = o.pid && S.vttPages.has(o.pid) ? o.pid : vid("p");
  await vSave("vttpages/" + pid, Object.assign(page, { camp: VGEN, name: o.name || T.name, order: 0, folder: "", open: false, gen: { type: o.type, seed: o.seed, size: o.size, floors: o.floors, cellar: o.cellar, name: o.name, tags: o.tags || [] }, created: new Date().toISOString() }));
  return pid;
}
async function genPlace(camp, o) {
  const { page } = genPage(o), T = genType(o.type), pid = vid("p"), order = vPages(camp).length;
  await vSave("vttpages/" + pid, Object.assign(page, { camp, name: o.name || T.name, order, folder: "Buildings", open: false, gen: { type: o.type, seed: o.seed, size: o.size, floors: o.floors, cellar: o.cellar, name: o.name, tags: o.tags || [] }, created: new Date().toISOString() }));
  for (let i = 0; i < 40 && !S.vttPages.has(pid); i++) await new Promise(res => setTimeout(res, 50)); // wait for the new map to arrive
  VTT.camp = camp; VTT.page = pid; if (location.hash === "#vtt-" + camp) render(); else location.hash = "vtt-" + camp; toast(`${o.name || T.name} is a new map in ${(S.vttCamps.get(camp) || {}).name || "the campaign"}. The players stay where they are.`);
}
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act^=gen]"); if (!b || !vCanEdit()) return; const a = b.dataset.act;
  if (a === "genopt" && GEN.o) { GEN.o[b.dataset.k] = b.dataset.v; b.parentElement.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); genRefresh(); return; }
  if (a === "genroll" && GEN.o) { GEN.o.seed = genSeed(); const s = document.getElementById("gen-seed"); if (s) s.value = GEN.o.seed; genRefresh(); return; }
  if (a === "gentagf") { GEN.tag = b.dataset.v; render(); return; }
  if (a === "gensave" && GEN.o) { genReadForm(); b.disabled = true; GEN.o.pid = await genSaveLib(GEN.o); b.disabled = false; b.textContent = "Save changes"; toast("Saved to your buildings."); return; }
  if (a === "genplace") { ev.preventDefault(); let o = GEN.o; if (b.dataset.id) { const p = S.vttPages.get(b.dataset.id); if (!p || !p.gen) return; o = Object.assign({}, p.gen, { name: p.name }); } else genReadForm(); if (o) genPlace(b.dataset.camp, o); return; }
  if (a === "genedit") { const p = S.vttPages.get(b.dataset.id); if (p && p.gen) GEN.o = Object.assign({}, p.gen, { name: p.name, pid: b.dataset.id, camp: (route() || {}).camp }); return; }
  if (a === "gendel") { const p = S.vttPages.get(b.dataset.id); if (!p) return; if (await confirmBox(`Delete “${p.name}” from your buildings?`, "Delete")) await vDel("vttpages/" + b.dataset.id); return; }
});
document.addEventListener("change", ev => { if (ev.target && ev.target.id === "gen-seed" && GEN.o) { GEN.o.seed = Math.max(1, Math.round(Number(ev.target.value)) || 1); genRefresh(); } });
