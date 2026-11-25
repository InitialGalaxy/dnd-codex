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
  wood: { base: [36, 42, 63], line: "#8f6d45" }, stone: { base: [38, 8, 70], line: "#8a8377" }, earth: { base: [33, 22, 49], line: "#6f5d43" },
  tile: { base: [40, 30, 78], line: "#a99a7a" }, rug: { base: [36, 42, 63], line: "#8f6d45" }, porch: { base: [33, 36, 58], line: "#80633f" }
};
const GEN_KIND = { living: "wood", bed: "wood", kitchen: "stone", store: "earth", cellar: "earth", shop: "wood", work: "wood", forge: "stone", tavern: "wood",
  hall: "stone", office: "wood", meet: "rug", library: "wood", temple: "tile", sanctum: "rug", landing: "wood", porch: "porch", bath: "tile", pit: "earth", vault: "stone" };
// Each type: its footprint (frontage × depth, squares) and floors by size, the shapes it comes in (with weights) and how often
// it has a porch or a cellar, and the rooms on each floor. A room: n name, k kind, w how much space it wants, opt the chance
// it's there at all, front it faces the street, entry the front door's in it, back it likes the back wall.
// rare: unusual rooms that turn up now and then, on the ground floor, upstairs or below; secret ones hide behind a secret door.
const GEN_BUILDINGS = [
  { id: "house", name: "House", icon: "🏠", blurb: "A family home: a main room and kitchen downstairs, bedrooms up.",
    size: { small: [[5, 7], [5, 6], [1, 1]], medium: [[6, 8], [6, 8], [1, 2]], large: [[8, 10], [7, 9], [2, 2]] }, cellar: 0.3,
    shapes: { rect: 3, L: 2, long: 1, U: 0.4 }, porch: 0.4,
    ground: [{ n: "Main room", k: "living", w: 3, front: 1, entry: 1 }, { n: "Kitchen", k: "kitchen", w: 1.6, back: 1 }, { n: "Pantry", k: "store", w: 0.7, opt: 0.5 }],
    single: [{ n: "Bedroom", k: "bed", w: 1.5 }],
    upper: [{ n: "Bedroom", k: "bed", w: 2 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Bedroom", k: "bed", w: 1.2, opt: 0.5 }, { n: "Storage", k: "store", w: 0.6, opt: 0.35 }],
    under: [{ n: "Cellar", k: "cellar", w: 1 }],
    rare: [{ n: "Nursery", k: "bed", w: 1, at: "upper", p: 0.15 }, { n: "Hidden study", k: "library", w: 0.8, at: "upper", p: 0.06, secret: 1 }, { n: "Shrine nook", k: "sanctum", w: 0.6, at: "ground", p: 0.08 },
      { n: "Workshop", k: "work", w: 1.2, at: "ground", p: 0.12 }, { n: "Wine cellar", k: "cellar", w: 1, at: "under", p: 0.2 }, { n: "Smuggler's hole", k: "cellar", w: 0.6, at: "under", p: 0.07, secret: 1 }] },
  { id: "blacksmith", name: "Blacksmith", icon: "⚒", blurb: "A forge open to the street, a store for iron and coal, the smith's rooms.",
    size: { small: [[6, 8], [6, 7], [1, 1]], medium: [[7, 9], [7, 8], [1, 2]], large: [[9, 11], [8, 10], [2, 2]] }, cellar: 0.15, wide: 1,
    shapes: { rect: 3, L: 2, long: 0.5 }, porch: 0.15,
    ground: [{ n: "Forge", k: "forge", w: 3.2, front: 1, entry: 1 }, { n: "Iron store", k: "store", w: 1.1, back: 1 }, { n: "Coal store", k: "store", w: 0.6, opt: 0.6 }],
    single: [{ n: "Smith's room", k: "bed", w: 1.4 }],
    upper: [{ n: "Living room", k: "living", w: 1.6 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Bedroom", k: "bed", w: 1, opt: 0.5 }],
    under: [{ n: "Cellar", k: "cellar", w: 1 }],
    rare: [{ n: "Quenching pool", k: "bath", w: 0.8, at: "ground", p: 0.15 }, { n: "Armoury", k: "vault", w: 1, at: "ground", p: 0.12 }, { n: "Masterwork vault", k: "vault", w: 0.6, at: "under", p: 0.08, secret: 1 }] },
  { id: "tailor", name: "Tailor", icon: "🧵", blurb: "A shop at the front, a workroom for cutting and sewing, cloth stored behind.",
    size: { small: [[5, 7], [6, 7], [1, 2]], medium: [[6, 8], [7, 8], [2, 2]], large: [[8, 10], [8, 9], [2, 2]] }, cellar: 0.2,
    shapes: { rect: 3, L: 1.5, long: 0.6 }, porch: 0.2,
    ground: [{ n: "Shop", k: "shop", w: 2.2, front: 1, entry: 1 }, { n: "Workroom", k: "work", w: 1.8 }, { n: "Cloth store", k: "store", w: 0.8, back: 1 }],
    single: [{ n: "Bedroom", k: "bed", w: 1.3 }],
    upper: [{ n: "Living room", k: "living", w: 1.6 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Fitting room", k: "work", w: 0.9, opt: 0.5 }],
    under: [{ n: "Cellar", k: "cellar", w: 1 }],
    rare: [{ n: "Dye vats", k: "bath", w: 1, at: "ground", p: 0.15 }, { n: "Noble's fitting salon", k: "meet", w: 1, at: "upper", p: 0.1 }, { n: "Disguise room", k: "work", w: 0.6, at: "upper", p: 0.05, secret: 1 }] },
  { id: "general", name: "General store", icon: "🧺", blurb: "A shop floor of everything, a storeroom, a cellar for stock, the owner's rooms.",
    size: { small: [[6, 8], [6, 7], [1, 1]], medium: [[7, 9], [7, 8], [1, 2]], large: [[9, 11], [8, 10], [2, 2]] }, cellar: 0.6,
    shapes: { rect: 3, L: 2, long: 0.5 }, porch: 0.5,
    ground: [{ n: "Shop floor", k: "shop", w: 3, front: 1, entry: 1 }, { n: "Storeroom", k: "store", w: 1.6, back: 1 }, { n: "Office", k: "office", w: 0.8, opt: 0.6 }],
    single: [{ n: "Owner's room", k: "bed", w: 1.3 }],
    upper: [{ n: "Living room", k: "living", w: 1.6 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Bedroom", k: "bed", w: 1, opt: 0.5 }, { n: "Stock room", k: "store", w: 0.8, opt: 0.4 }],
    under: [{ n: "Stock cellar", k: "cellar", w: 1.5 }, { n: "Cold store", k: "cellar", w: 0.8, opt: 0.4 }],
    rare: [{ n: "Pawn counter", k: "shop", w: 0.8, at: "ground", p: 0.15 }, { n: "Strongroom", k: "vault", w: 0.6, at: "ground", p: 0.1 }, { n: "Black-market cache", k: "vault", w: 0.6, at: "under", p: 0.08, secret: 1 }] },
  { id: "tavern", name: "Tavern", icon: "🍺", blurb: "A common room with a bar, a kitchen, rooms to let upstairs and a beer cellar.",
    size: { small: [[7, 9], [7, 8], [1, 2]], medium: [[9, 11], [8, 10], [2, 2]], large: [[11, 14], [9, 12], [2, 3]] }, cellar: 0.8,
    shapes: { rect: 2, L: 2, U: 1.2 }, porch: 0.35,
    ground: [{ n: "Common room", k: "tavern", w: 4, front: 1, entry: 1 }, { n: "Kitchen", k: "kitchen", w: 1.4, back: 1 }, { n: "Bar store", k: "store", w: 0.7 }, { n: "Private room", k: "living", w: 1, opt: 0.5 }],
    single: [{ n: "Keeper's room", k: "bed", w: 1.2 }, { n: "Guest room", k: "bed", w: 1 }],
    upper: [{ n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1, opt: 0.7 }, { n: "Guest room", k: "bed", w: 1, opt: 0.5 }, { n: "Keeper's room", k: "bed", w: 1.4 }],
    under: [{ n: "Beer cellar", k: "cellar", w: 1.6 }, { n: "Store", k: "cellar", w: 0.8, opt: 0.6 }],
    rare: [{ n: "Gambling den", k: "meet", w: 1.2, at: "ground", p: 0.15 }, { n: "Bathhouse", k: "bath", w: 1.2, at: "ground", p: 0.1 }, { n: "Bridal suite", k: "bed", w: 1.4, at: "upper", p: 0.12 },
      { n: "Fighting pit", k: "pit", w: 1.4, at: "under", p: 0.1 }, { n: "Smuggler's tunnel", k: "cellar", w: 0.6, at: "under", p: 0.08, secret: 1 }] },
  { id: "guild", name: "Guild hall", icon: "🏛", blurb: "A great hall for the members, offices, a meeting room and the guildmaster's study.",
    size: { small: [[9, 11], [8, 10], [2, 2]], medium: [[11, 14], [10, 12], [2, 3]], large: [[14, 17], [11, 14], [3, 3]] }, cellar: 0.4, hall: 2,
    shapes: { rect: 2, U: 1.5, L: 1 }, porch: 0.2,
    ground: [{ n: "Great hall", k: "hall", w: 4, front: 1, entry: 1 }, { n: "Reception", k: "office", w: 1 }, { n: "Office", k: "office", w: 1 }, { n: "Archive", k: "store", w: 1, back: 1 }],
    single: [{ n: "Guildmaster's study", k: "office", w: 1.4 }],
    upper: [{ n: "Meeting room", k: "meet", w: 2 }, { n: "Guildmaster's study", k: "office", w: 1.5 }, { n: "Office", k: "office", w: 1 }, { n: "Office", k: "office", w: 1 }, { n: "Library", k: "library", w: 1.5, opt: 0.6 }],
    under: [{ n: "Vault", k: "vault", w: 1 }, { n: "Store", k: "cellar", w: 1, opt: 0.6 }],
    rare: [{ n: "Trophy hall", k: "hall", w: 1.4, at: "ground", p: 0.15 }, { n: "Training room", k: "pit", w: 1.4, at: "ground", p: 0.15 }, { n: "Map room", k: "library", w: 1, at: "upper", p: 0.15 },
      { n: "Inner sanctum", k: "sanctum", w: 0.8, at: "upper", p: 0.08, secret: 1 }, { n: "Secret vault", k: "vault", w: 0.6, at: "under", p: 0.1, secret: 1 }] },
  { id: "temple", name: "Temple", icon: "⛪", blurb: "A long nave for worship, a sanctum at the far end, a vestry and the priest's room.",
    size: { small: [[6, 8], [8, 10], [1, 1]], medium: [[8, 10], [10, 13], [1, 1]], large: [[10, 13], [13, 16], [1, 2]] }, cellar: 0.3, longDeep: 1,
    shapes: { rect: 1, long: 2.5, L: 0.4 }, porch: 0.4,
    ground: [{ n: "Nave", k: "temple", w: 5, front: 1, entry: 1 }, { n: "Sanctum", k: "sanctum", w: 1.5, back: 1 }, { n: "Vestry", k: "store", w: 0.8 }, { n: "Priest's room", k: "bed", w: 0.8, opt: 0.6 }],
    single: [],
    upper: [{ n: "Priest's quarters", k: "bed", w: 1.5 }, { n: "Study", k: "library", w: 1 }],
    under: [{ n: "Crypt", k: "vault", w: 1 }],
    rare: [{ n: "Reliquary", k: "sanctum", w: 0.7, at: "ground", p: 0.15 }, { n: "Confessional", k: "office", w: 0.5, at: "ground", p: 0.15 }, { n: "Ossuary", k: "vault", w: 1, at: "under", p: 0.15 },
      { n: "Forbidden shrine", k: "pit", w: 0.6, at: "under", p: 0.06, secret: 1 }] }
];
const genType = id => GEN_BUILDINGS.find(b => b.id === id) || GEN_BUILDINGS[0];
const GEN_SHAPES = { rect: "Rectangle", L: "L-shape", U: "U-shape", long: "Long house" };

// ----- The footprint: a main block at the front, and wings -----
// Squares have their top-left corners at whole numbers. The front (the street) is the bottom edge of the main block; a porch
// sits in front of that. wings are rectangles; body is every square of the building (not the porch).
function genFootprint(r, T, o, W, H) {
  const pickW = obj => { const e = Object.entries(obj); let t = e.reduce((a, [, v]) => a + v, 0) * r(); for (const [k, v] of e) { t -= v; if (t <= 0) return k; } return e[0][0]; };
  let shape = o.shape && o.shape !== "auto" && T.shapes[o.shape] != null ? o.shape : o.shape && o.shape !== "auto" && GEN_SHAPES[o.shape] ? o.shape : pickW(T.shapes);
  if (shape === "L" && (W < 6 || H < 6)) { W = Math.max(W, 6); H = Math.max(H, 6); }
  if (shape === "U" && (W < 8 || H < 6)) { W = Math.max(W, 8); H = Math.max(H, 6); }
  let wings, main;
  if (shape === "long") {
    if (T.longDeep) { W = Math.max(4, Math.round(W * 0.7)); H = Math.round(H * 1.5); } else { H = Math.max(4, Math.min(5, Math.round(H * 0.6))); W = Math.round(W * 1.7); }
    main = { x: 0, y: 0, w: W, h: H }; wings = [main];
  } else if (shape === "L") {
    const a = Math.max(3, Math.round(H * (0.4 + r() * 0.15))), ww = Math.max(3, Math.min(W - 3, Math.round(W * (0.4 + r() * 0.15)))), left = r() < 0.5;
    main = { x: 0, y: a, w: W, h: H - a }; if (main.h < 4) { main.y = H - 4; main.h = 4; }
    wings = [main, { x: left ? 0 : W - ww, y: 0, w: ww, h: main.y }];
  } else if (shape === "U") {
    const a = Math.max(3, Math.round(H * (0.4 + r() * 0.15))), ww = Math.max(3, Math.min(Math.floor((W - 2) / 2), Math.round(W * 0.3)));
    main = { x: 0, y: a, w: W, h: H - a }; if (main.h < 4) { main.y = H - 4; main.h = 4; }
    wings = [main, { x: 0, y: 0, w: ww, h: main.y }, { x: W - ww, y: 0, w: ww, h: main.y }];
  } else { shape = "rect"; main = { x: 0, y: 0, w: W, h: H }; wings = [main]; }
  const want = o.porch === "yes" ? true : o.porch === "no" ? false : r() < (T.porch || 0);
  let porch = null;
  if (want) { const pw = r() < 0.5 ? main.w : Math.max(3, Math.min(main.w, Math.round(main.w * (0.5 + r() * 0.3)))), px = main.x + Math.floor((main.w - pw) / 2 + (r() - 0.5) * (main.w - pw));
    porch = { x: Math.max(main.x, Math.min(main.x + main.w - pw, px)), y: main.y + main.h, w: pw, h: 2 }; }
  const body = new Set(); wings.forEach(g => { for (let x = g.x; x < g.x + g.w; x++) for (let y = g.y; y < g.y + g.h; y++) body.add(x + "," + y); });
  return { shape, W, H: H + (porch ? 2 : 0), bodyH: H, main, wings, porch, body };
}

// ----- Laying out a floor -----
// Rooms are rectangles in squares: { x, y, w, h, n, k }.
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
  const n = Math.min(rooms.length, Math.max(1, Math.floor(len / minD))); rooms = rooms.slice(0, n);
  rooms.forEach((rm, i) => { const left = n - i - 1; let sz = i === n - 1 ? len - pos : Math.round(len * rm.w / tot + (r() - 0.5) * 0.6); sz = Math.max(minD, Math.min(len - pos - left * minD, sz));
    out.push(Object.assign({}, rm, along ? { x: band.x + pos, y: band.y, w: sz, h: band.h } : { x: band.x, y: band.y + pos, w: band.w, h: sz })); pos += sz; });
  return out;
}
const genPick = (r, list) => list.filter(x => !x.opt || r() < x.opt).map(x => Object.assign({}, x));
// Share a floor's rooms between the main block and the wings by their size; a wing left with none gets a plain room.
function genShare(r, F, rooms, filler) {
  if (F.wings.length === 1) return [rooms];
  const area = g => g.w * g.h, tot = F.wings.reduce((a, g) => a + area(g), 0), out = F.wings.map(() => []);
  const fixed = rooms.filter(x => x.entry || x.front), rest = rooms.filter(x => !x.entry && !x.front);
  out[0].push(...fixed);
  rest.forEach(rm => { let best = 0, bestGap = -Infinity; F.wings.forEach((g, i) => { const have = out[i].reduce((a, x) => a + x.w, 0), wantW = rooms.reduce((a, x) => a + x.w, 0) * area(g) / tot, gap = wantW - have; if (gap > bestGap) { bestGap = gap; best = i; } }); out[best].push(rm); });
  out.forEach((list, i) => { if (!list.length) list.push(Object.assign({}, filler, { w: 1 })); });
  return out;
}
// One building: its footprint, floors, cellar; every floor's rooms, the stairs and the doors and windows.
function genBuilding(o) {
  const T = genType(o.type), r = genRng(o.seed), S = T.size[o.size] || T.size.medium;
  const F = genFootprint(r, T, o, genInt(r, S[0][0], S[0][1]), genInt(r, S[1][0], S[1][1]));
  const floors = o.floors && o.floors !== "auto" ? Number(o.floors) : genInt(r, S[2][0], S[2][1]);
  const cellar = o.cellar === "yes" ? true : o.cellar === "no" ? false : r() < T.cellar;
  const rare = (T.rare || []).filter(x => r() < x.p).map(x => Object.assign({}, x, { rare: 1 }));
  const at = where => rare.filter(x => x.at === where || (where === "ground" && x.at === "upper" && floors === 1));
  const minD = 2, levels = [], M = F.main;
  // Ground floor: the front rooms first, so they end up on the street side of the main block.
  let ground = genPick(r, T.ground).concat(floors === 1 ? genPick(r, T.single) : [], at("ground"));
  ground.sort((a, b) => (b.front || 0) - (a.front || 0) || (a.back || 0) - (b.back || 0));
  const share = genShare(r, F, ground, { n: "Back room", k: T.id === "temple" ? "store" : "living" });
  let gRooms = []; F.wings.forEach((g, i) => { gRooms = gRooms.concat(genSlice(r, g, share[i], minD)); });
  if (F.porch) gRooms.push(Object.assign({ n: "Porch", k: "porch", porch: 1 }, F.porch));
  const entry = gRooms.find(x => x.entry) || gRooms[0];
  // Stairs, after the guides on house plans: each run of stairs goes along a wall, starts and ends where people walk (the
  // entry, a landing, the kitchen), keeps clear of doors, and each one joins just two floors. The way up from the ground floor
  // is in the entry room near the middle of the main block (so the landing upstairs runs down the middle); each floor's way
  // up is at the far end of its landing from the stairs that arrived there; the way down to the cellar starts in the kitchen
  // or a store, away from the other stairs. A stair: { lo, x, y, w, h, toward } — it joins floors lo and lo + 1, and on the
  // floor it was placed on you walk toward its "a" (left or top) or "b" end.
  const longX = M.w >= M.h, stairs = [], fw = T.wide ? 2 : 1, frontY = M.y + M.h, mid = longX ? M.y + Math.floor(M.h / 2) - 1 : M.x + Math.floor(M.w / 2) - 1;
  const cellsOf = t => { const out = []; for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) out.push(x + "," + y); return out; };
  const near = t => { const out = new Set(); cellsOf(t).forEach(k => { const [x, y] = k.split(",").map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.add((x + dx) + "," + (y + dy)); }); return out; };
  let upFrom = null; // the stairs arriving on the floor being laid out
  if (floors > 1) { const s0 = genStairSpot(r, entry, { longX, within: M, mid, frontY, avoid: new Set(), near: new Set() }) || genStairSpot(r, M, { longX, within: M, mid, avoid: new Set(), near: new Set() });
    if (s0) { s0.lo = 0; stairs.push(s0); upFrom = s0; } }
  let down = null;
  if (cellar) {
    const busy = new Set(stairs.flatMap(cellsOf)), nearBusy = new Set(stairs.flatMap(t => [...near(t)])), inM = rm => rm.x >= M.x && rm.y >= M.y && rm.x + rm.w <= M.x + M.w && rm.y + rm.h <= M.y + M.h;
    const service = gRooms.filter(x => inM(x) && ["kitchen", "store", "work", "forge"].includes(x.k)).sort((a, b) => (a.k === "kitchen" ? 0 : 1) - (b.k === "kitchen" ? 0 : 1));
    for (const rm of service.concat(gRooms.filter(x => inM(x) && !x.porch && !service.includes(x)))) { down = genStairSpot(r, rm, { longX: rm.w >= rm.h, within: M, frontY, avoid: busy, near: nearBusy }); if (down) break; }
    if (down) { down.lo = -1; down.placedUpper = 1; stairs.push(down); }
  }
  levels.push({ level: 0, rooms: gRooms, name: "Ground floor" });
  for (let f = 1; f < floors; f++) {
    let rooms = genPick(r, T.upper).concat(f === 1 ? at("upper") : []); if (!rooms.length) rooms = [{ n: "Upstairs room", k: "living", w: 1 }];
    const sh = genShare(r, F, rooms, { n: "Storage", k: "store" }); let list = [];
    F.wings.forEach((g, i) => { list = list.concat(i === 0 ? genUpper(r, g, upFrom, sh[i], minD, T.hall || 1) : genSlice(r, g, sh[i], minD)); });
    levels.push({ level: f, rooms: list, name: f === 1 ? "First floor" : f === 2 ? "Second floor" : `Floor ${f + 1}` });
    if (f < floors - 1 && upFrom) { // the next way up: the far end of this floor's landing
      const c = list.find(x => x.circ), arr = upFrom; let nx = null;
      if (c) { const lx = arr.w >= arr.h; const t = lx ? { x: (arr.x - c.x < c.x + c.w - arr.x - arr.w) ? c.x + c.w - arr.w : c.x, y: arr.y, w: arr.w, h: arr.h } : { x: arr.x, y: (arr.y - c.y < c.y + c.h - arr.y - arr.h) ? c.y + c.h - arr.h : c.y, w: arr.w, h: arr.h };
        if (!cellsOf(t).some(k => cellsOf(arr).includes(k))) nx = Object.assign(t, { toward: lx ? (t.x + t.w === c.x + c.w ? "b" : "a") : (t.y + t.h === c.y + c.h ? "b" : "a") }); }
      if (!nx) { const big = list.filter(x => !x.circ).sort((a, b) => b.w * b.h - a.w * a.h)[0]; nx = big && genStairSpot(r, big, { longX, within: M, avoid: new Set(cellsOf(arr)), near: near(arr) }); }
      if (!nx) nx = Object.assign({}, arr); // nowhere else: right above the last ones
      nx.lo = f; stairs.push(nx); upFrom = nx;
    }
  }
  if (cellar) { const rooms = genPick(r, T.under).concat(at("under")); levels.unshift({ level: -1, rooms: rooms.length > 1 ? genUpper(r, M, down, rooms, minD, 1, "Cellar stairs") : [Object.assign({}, rooms[0] || { n: "Cellar", k: "cellar" }, M)], name: "Cellar" }); }
  // Each floor's stairs: going up the ones from this floor, going down the ones arriving from below... and which way you walk.
  levels.forEach(L => { L.stairs = stairs.filter(t => t.lo === L.level || t.lo + 1 === L.level).map(t => { const onPlaced = t.placedUpper ? L.level === t.lo + 1 : L.level === t.lo;
    return Object.assign({}, t, { dir: L.level === t.lo ? "up" : "down", toward: onPlaced ? t.toward : (t.toward === "a" ? "b" : "a") }); }); });
  // Doors (a tree from the room with the stairs or the front door, so every room can be reached) and windows.
  const stairCols = new Set(levels.find(L => L.level === 0).stairs.filter(t => t.y + t.h >= frontY).flatMap(t => Array.from({ length: t.w }, (_, i) => t.x + i)));
  let fx0 = F.porch ? Math.max(entry.x, F.porch.x) + Math.floor((Math.min(entry.x + entry.w, F.porch.x + F.porch.w) - Math.max(entry.x, F.porch.x) - fw) / 2) : entry.x + Math.floor((entry.w - fw) / 2);
  fx0 = Math.max(entry.x, Math.min(entry.x + entry.w - fw, fx0)); for (let k = 0; k < entry.w && [...Array(fw).keys()].some(i => stairCols.has(fx0 + i)); k++) fx0 = entry.x + ((fx0 - entry.x + 1) % Math.max(1, entry.w - fw + 1));
  const front = { x: fx0, w: fw, y: frontY };
  levels.forEach(L => genOpenings(r, L, F, L.stairs, L.level === 0 ? front : null));
  // The unusual rooms that made it in (one upstairs needs an upstairs, one below a cellar).
  const placed = [...new Set(levels.flatMap(L => L.rooms.filter(x => x.rare).map(x => x.n)))];
  // How fine the front door is: a plain door for a small cottage or shop, a framed one for a solid house, a grand entrance
  // with pillars for a big house, a large tavern, a guild hall or a temple.
  const doorScore = ({ small: 0, medium: 1, large: 2 })[o.size] ?? 1, doorBonus = ({ guild: 1, temple: 1, tavern: 0.5, blacksmith: -0.5, tailor: -0.5, general: -0.5 })[T.id] || 0;
  const doorTier = doorScore + doorBonus >= 2 ? "grand" : doorScore + doorBonus >= 1 ? "framed" : "plain";
  const B = { type: T.id, W: F.W, H: F.H, F, floors, cellar, stairs, levels, rare: placed, doorTier };
  genHearths(o, B); return B;
}
// Fireplaces: the rooms that would have a fire get a hearth against a wall, an outside wall if they can (that's where the
// chimney goes), or back to back with a neighbour's fire so the two share a stack. A stack rises through every floor above
// (a flue on floors that don't use it, a fireplace on ones that do) and comes out of the roof as a chimney.
const GEN_FIRE = { kitchen: 1, forge: 1, tavern: 1, living: 0.9, hall: 0.8, library: 0.5, meet: 0.5, work: 0.4, office: 0.3, bed: 0.35, sanctum: 0.2 };
function genHearths(o, B) {
  const r = genRng((Number(o.seed) || 1) * 13 + 9), stacks = [];
  const ext = (L, nx, ny) => { const i = L.own(nx, ny); return i < 0; };
  B.levels.slice().sort((a, b) => a.level - b.level).forEach(L => {
    L.hearths = []; if (L.level < 0 || !L.own) return;
    const stairSq = new Set(); (L.stairs || []).forEach(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) stairSq.add(x + "," + y); });
    const used = new Set(), sides = [["t", 0, -1, (x, y) => `h,${x},${y}`], ["b", 0, 1, (x, y) => `h,${x},${y + 1}`], ["l", -1, 0, (x, y) => `v,${x},${y}`], ["r", 1, 0, (x, y) => `v,${x + 1},${y}`]];
    const cellEdges = (x, y) => sides.map(s => s[3](x, y));
    const blocked = (x, y) => stairSq.has(x + "," + y) || cellEdges(x, y).some(k => L.doors.has(k)) || used.has(x + "," + y);
    // Stacks from the floors below come up through this one.
    stacks.forEach(st => { const i = L.own(st.x, st.y); if (i < 0 || L.rooms[i].porch) return; st.top = L.level;
      if (stairSq.has(st.x + "," + st.y)) return; used.add(st.x + "," + st.y);
      const rm = L.rooms[i], fire = !rm._fire && r() < (GEN_FIRE[rm.k] || 0); if (fire) rm._fire = 1;
      L.hearths.push({ x: st.x, y: st.y, side: st.side, fire, k: rm.k }); });
    L.rooms.forEach((rm, i) => { if (rm._fire || rm.porch || rm.circ || !(r() < (GEN_FIRE[rm.k] || 0))) return;
      let best = null;
      for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) sides.forEach(([sd, dx, dy, key]) => {
        const nx = x + dx, ny = y + dy; if (L.own(nx, ny) === i || blocked(x, y)) return; const k = key(x, y); if (L.wins.has(k) || L.doors.has(k)) return;
        const nb = L.own(nx, ny); if (nb >= 0 && L.rooms[nb].porch) return;
        if (L.front && L.front.size && sd === "b" && [...L.front].some(fk => { const [, fx, fy] = fk.split(",").map(Number); return fy === y + 1 && Math.abs(fx - x) <= 2; })) return; // clear of the front door's frame
        const along = dx ? rm.h : rm.w, pos = dx ? y - rm.y : x - rm.x, mid = 1 - Math.abs(pos - (along - 1) / 2) / Math.max(1, along / 2);
        let sc = (ext(L, nx, ny) ? 3 : 0) + mid * 1.5 + r() * 0.6;
        if (L.hearths.some(h => h.fire && h.x === nx && h.y === ny)) sc += 5; // back to back with the fire next door
        if (rm.k === "kitchen" || rm.k === "forge") sc += ext(L, nx, ny) ? 1 : 0;
        if (!best || sc > best.sc) best = { sc, x, y, side: sd }; });
      if (!best) return; rm._fire = 1; used.add(best.x + "," + best.y);
      L.hearths.push({ x: best.x, y: best.y, side: best.side, fire: true, k: rm.k }); stacks.push({ x: best.x, y: best.y, side: best.side, top: L.level }); });
    L.rooms.forEach(rm => delete rm._fire);
  });
  B.chimneys = stacks;
}
// Where a stair (two squares) goes in a room: along one of its walls, best with its long side to the wall, clear of the
// front door's row, not on or right beside other stairs, near the middle line if asked. Its "toward" end is the one at a wall.
function genStairSpot(r, room, o) {
  const sw = o.longX ? 2 : 1, sh = o.longX ? 1 : 2; let best = null;
  for (let y = room.y; y <= room.y + room.h - sh; y++) for (let x = room.x; x <= room.x + room.w - sw; x++) {
    if (o.within && (x < o.within.x || y < o.within.y || x + sw > o.within.x + o.within.w || y + sh > o.within.y + o.within.h)) continue;
    const cells = []; for (let a = 0; a < sw; a++) for (let b = 0; b < sh; b++) cells.push((x + a) + "," + (y + b));
    if (cells.some(c => o.avoid && o.avoid.has(c))) continue;
    const T = y === room.y, Bo = y + sh === room.y + room.h, Le = x === room.x, Ri = x + sw === room.x + room.w;
    const longSide = o.longX ? (T || Bo) : (Le || Ri), endSide = o.longX ? (Le || Ri) : (T || Bo);
    if (!longSide && !endSide) continue;
    if (room.w <= sw || room.h <= sh) { /* a room only as big as the stairs: fine */ }
    let sc = (longSide ? 3 : 0) + (endSide ? 2 : 0) + r() * 0.8;
    if (o.mid != null) sc -= Math.abs((o.longX ? y : x) - o.mid) * 2.2; // a landing down the middle upstairs, not along an outside wall
    if (o.frontY != null && y + sh >= o.frontY - 1) sc -= 4;
    if (cells.some(c => o.near && o.near.has(c))) sc -= 3;
    if (!best || sc > best.sc) { const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
      const toward = o.longX ? (Le && !Ri ? "a" : Ri && !Le ? "b" : (Math.abs(x - cx) > Math.abs(x + sw - cx) ? "a" : "b")) : (T && !Bo ? "a" : Bo && !T ? "b" : (Math.abs(y - cy) > Math.abs(y + sh - cy) ? "a" : "b"));
      best = { sc, x, y, w: sw, h: sh, toward }; }
  }
  if (!best) return null; delete best.sc; return best;
}
// The main block upstairs (or a busy cellar): a landing or corridor through the stairs, with rooms either side of it.
function genUpper(r, R, st, rooms, minD, cw, landName) {
  if (!st || rooms.length < 2) return genSlice(r, R, rooms, minD);
  const longX = R.w >= R.h, c = longX ? { x: R.x, y: st.y, w: R.w, h: Math.max(st.h, cw) } : { x: st.x, y: R.y, w: Math.max(st.w, cw), h: R.h };
  if (longX && c.y + c.h > R.y + R.h) c.y = R.y + R.h - c.h; if (!longX && c.x + c.w > R.x + R.w) c.x = R.x + R.w - c.w;
  let bandA = longX ? { x: R.x, y: R.y, w: R.w, h: c.y - R.y } : { x: R.x, y: R.y, w: c.x - R.x, h: R.h };
  let bandB = longX ? { x: R.x, y: c.y + c.h, w: R.w, h: R.y + R.h - c.y - c.h } : { x: c.x + c.w, y: R.y, w: R.x + R.w - c.x - c.w, h: R.h };
  // A band too thin for rooms joins the corridor.
  if ((longX ? bandA.h : bandA.w) < minD) { if (longX) { c.h += c.y - R.y; c.y = R.y; } else { c.w += c.x - R.x; c.x = R.x; } bandA = null; }
  if (bandB && (longX ? bandB.h : bandB.w) < minD) { if (longX) c.h = R.y + R.h - c.y; else c.w = R.x + R.w - c.x; bandB = null; }
  const bands = [bandA, bandB].filter(Boolean); if (!bands.length) return [Object.assign({}, rooms[0], c)];
  const area = b => b.w * b.h, tot = bands.reduce((a, b) => a + area(b), 0); let split = bands.length > 1 ? Math.round(rooms.length * area(bands[0]) / tot) : rooms.length;
  split = Math.max(bands.length > 1 ? 1 : 0, Math.min(rooms.length - (bands.length > 1 ? 1 : 0), split));
  const parts = bands.length > 1 ? [rooms.slice(0, split), rooms.slice(split)] : [rooms];
  return [Object.assign({ n: landName || (cw > 1 ? "Corridor" : "Landing"), k: "landing", circ: 1 }, c)].concat(...bands.map((b, i) => genStrip(r, b, parts[i], minD)));
}
// Unit wall edges: "h,x,y" is the edge along the top of square (x, y); "v,x,y" along its left side.
function genOpenings(r, L, F, stairs, front) {
  const W = F.W, H = F.H, own = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return -1; return L.rooms.findIndex(rm => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h); };
  L.own = own; L.doors = new Set(); L.wins = new Set(); L.front = new Set(); L.secret = new Set();
  const isPorch = i => i >= 0 && L.rooms[i].porch;
  const shared = (a, b) => { const out = []; L.rooms.forEach((rm, i) => { if (i !== a) return;
      for (let x = rm.x; x < rm.x + rm.w; x++) { if (own(x, rm.y - 1) === b) out.push(`h,${x},${rm.y}`); if (own(x, rm.y + rm.h) === b) out.push(`h,${x},${rm.y + rm.h}`); }
      for (let y = rm.y; y < rm.y + rm.h; y++) { if (own(rm.x - 1, y) === b) out.push(`v,${rm.x},${y}`); if (own(rm.x + rm.w, y) === b) out.push(`v,${rm.x + rm.w},${y}`); } }); return out; };
  const st = (stairs || [])[0], n = L.rooms.length, inStairs = rm => st && st.x >= rm.x && st.x < rm.x + rm.w && st.y >= rm.y && st.y < rm.y + rm.h;
  const stairSq = new Set(); (stairs || []).forEach(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) stairSq.add(x + "," + y); });
  const onStairs = k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); return d === "h" ? stairSq.has(x + "," + (y - 1)) || stairSq.has(x + "," + y) : stairSq.has((x - 1) + "," + y) || stairSq.has(x + "," + y); };
  let root = L.rooms.findIndex(x => x.circ); if (root < 0) root = L.level === 0 ? L.rooms.findIndex(x => x.entry) : L.rooms.findIndex(inStairs); if (root < 0) root = 0;
  if (L.rooms[root] && L.rooms[root].secret) L.rooms[root].secret = 0; // the stairs are never in a secret room
  // A tree of doors from the root through the ordinary rooms; then each secret room gets one secret door from a room already
  // reached; then anything left (only reachable through a secret room) carries on from there.
  const seen = new Set([root]);
  const connect = (secretPass, byStairs) => { const q = [...seen]; while (q.length) { const a = q.shift(); for (let b = 0; b < n; b++) {
      if (seen.has(b) || isPorch(b) || !!L.rooms[b].secret !== secretPass) continue; let e = shared(a, b); if (!e.length) continue;
      const clear = e.filter(k => !onStairs(k)); if (clear.length) e = clear; else if (!byStairs) continue; // doors don't open onto the stairs, unless there's no other way
      const mid = e.filter((_, i) => e.length < 3 || (i > 0 && i < e.length - 1)), list = mid.length ? mid : e, pick = list[Math.floor(r() * list.length)];
      L.doors.add(pick); if (secretPass) L.secret.add(pick); seen.add(b); if (!secretPass) q.push(b); } } };
  connect(false, false); connect(false, true); connect(true, false); connect(true, true); connect(false, false); connect(false, true);
  if (front) for (let i = 0; i < front.w; i++) { const k = `h,${front.x + i},${front.y}`; L.doors.add(k); L.front.add(k); }
  if (L.level === 0) { const back = L.rooms.find(x => x.back && own(x.x + Math.floor(x.w / 2), x.y - 1) < 0); if (back && r() < 0.55) L.doors.add(`h,${back.x + Math.floor(back.w / 2)},${back.y}`); }
  if (L.level < 0) return; // cellars have no windows
  // Windows: on each run of outside wall at least 3 squares long, one (two on long runs) away from the corners.
  L.rooms.forEach((rm, i) => { if (rm.porch || (rm.circ && L.level > 0 && r() < 0.5) || rm.secret) return;
    const runs = [], add = (list) => { let run = []; list.forEach(k => { if (k) run.push(k); else { if (run.length) runs.push(run); run = []; } }); if (run.length) runs.push(run); };
    add(Array.from({ length: rm.w }, (_, d) => own(rm.x + d, rm.y - 1) < 0 ? `h,${rm.x + d},${rm.y}` : null));
    add(Array.from({ length: rm.w }, (_, d) => { const o2 = own(rm.x + d, rm.y + rm.h); return o2 < 0 || isPorch(o2) ? `h,${rm.x + d},${rm.y + rm.h}` : null; }));
    add(Array.from({ length: rm.h }, (_, d) => own(rm.x - 1, rm.y + d) < 0 ? `v,${rm.x},${rm.y + d}` : null));
    add(Array.from({ length: rm.h }, (_, d) => own(rm.x + rm.w, rm.y + d) < 0 ? `v,${rm.x + rm.w},${rm.y + d}` : null));
    runs.forEach(run => { const len = run.length; if (len < 3) return; const many = len >= 7 ? [Math.floor(len / 4), len - 1 - Math.floor(len / 4)] : [Math.floor((len - 1) / 2)];
      many.forEach(j => { const k = run[j]; if (!L.doors.has(k)) L.wins.add(k); }); });
  });
}
// Every wall edge of a floor: between two rooms, or a room and the outside. A porch has no walls to the outside, only posts.
function genEdges(L, W, H) {
  const out = [], own = L.own, porch = i => i >= 0 && L.rooms[i].porch;
  const wall = (a, b) => a !== b && !(porch(a) && b < 0) && !(porch(b) && a < 0);
  for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) { const a = own(x, y - 1), b = own(x, y); if (wall(a, b)) out.push({ k: `h,${x},${y}`, x1: x, y1: y, x2: x + 1, y2: y, ext: a < 0 || b < 0 || porch(a) || porch(b) }); }
  for (let x = 0; x <= W; x++) for (let y = 0; y < H; y++) { const a = own(x - 1, y), b = own(x, y); if (wall(a, b)) out.push({ k: `v,${x},${y}`, x1: x, y1: y, x2: x, y2: y + 1, ext: a < 0 || b < 0 || porch(a) || porch(b) }); }
  return out;
}

// ----- Drawing: floors of real boards and flagstones, a bit worn; walls; stairs; the roof; the yard and its path -----
const genHsl = (h, s, l, j, r) => `hsl(${h} ${s}% ${(l + (r() - 0.5) * 2 * j).toFixed(1)}%)`;
function genFloorDetail(r, rm, kind, P) {
  const F = GEN_FLOOR[kind] || GEN_FLOOR.wood, [h, s, l] = F.base, X = rm.x * P, Y = rm.y * P, W = rm.w * P, H = rm.h * P; let d = "";
  if (kind === "wood" || kind === "rug" || kind === "porch") { // boards along the room's long side, each its own shade
    const along = rm.w >= rm.h, bw = P / 3, rows = Math.ceil((along ? H : W) / bw), len = along ? W : H;
    for (let i = 0; i < rows; i++) { let pos = -r() * P * 1.5;
      while (pos < len) { const bl = P * (1 + r() * 2.2), a = Math.max(0, pos), b = Math.min(len, pos + bl); if (b > a) d += along ? `<rect x="${(X + a).toFixed(1)}" y="${(Y + i * bw).toFixed(1)}" width="${(b - a).toFixed(1)}" height="${bw.toFixed(1)}" fill="${genHsl(h, s, l, 4, r)}" stroke="${F.line}" stroke-width=".8"/>` : `<rect x="${(X + i * bw).toFixed(1)}" y="${(Y + a).toFixed(1)}" width="${bw.toFixed(1)}" height="${(b - a).toFixed(1)}" fill="${genHsl(h, s, l, 4, r)}" stroke="${F.line}" stroke-width=".8"/>`; pos += bl; } }
    const knots = Math.floor(rm.w * rm.h * 0.25); for (let i = 0; i < knots; i++) d += `<ellipse cx="${(X + r() * W).toFixed(1)}" cy="${(Y + r() * H).toFixed(1)}" rx="${(1.5 + r() * 2).toFixed(1)}" ry="1.2" fill="${F.line}" opacity=".7"/>`;
  } else if (kind === "stone" || kind === "tile") { // flagstones (or tiles) in rows of different sizes
    const sq = kind === "tile"; let y = 0;
    while (y < H) { const rh = sq ? P / 2 : P * (0.45 + r() * 0.35), hh = Math.min(rh, H - y); let x = -r() * P * 0.5;
      while (x < W) { const sw = sq ? P / 2 : P * (0.5 + r() * 0.7), a = Math.max(0, x), b = Math.min(W, x + sw); if (b > a) d += `<rect x="${(X + a + 1).toFixed(1)}" y="${(Y + y + 1).toFixed(1)}" width="${Math.max(0, b - a - 2).toFixed(1)}" height="${Math.max(0, hh - 2).toFixed(1)}" rx="${sq ? 1 : 3}" fill="${genHsl(h, s, l, sq ? 3 : 6, r)}"/>`; x += sw; }
      y += rh; }
    d = `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${F.line}"/>` + d;
  } else { // packed earth: speckles and darker blotches
    d = `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="hsl(${h} ${s}% ${l}%)"/>`;
    const n = Math.floor(rm.w * rm.h * 1.2); for (let i = 0; i < n; i++) d += `<ellipse cx="${(X + r() * W).toFixed(1)}" cy="${(Y + r() * H).toFixed(1)}" rx="${(P * (0.1 + r() * 0.35)).toFixed(1)}" ry="${(P * (0.08 + r() * 0.25)).toFixed(1)}" fill="${genHsl(h, s, l - 6, 5, r)}" opacity=".35"/>`;
    for (let i = 0; i < n * 3; i++) d += `<circle cx="${(X + r() * W).toFixed(1)}" cy="${(Y + r() * H).toFixed(1)}" r="${(0.6 + r() * 1.4).toFixed(1)}" fill="${F.line}" opacity=".7"/>`;
  }
  if (kind === "rug") { const m = P * 0.6; if (W > m * 2 + P && H > m * 2 + P) d += `<rect x="${X + m}" y="${Y + m}" width="${W - m * 2}" height="${H - m * 2}" fill="hsl(${[350, 210, 35, 140][Math.floor(r() * 4)]} 35% 38%)" stroke="hsl(40 50% 60%)" stroke-width="3" rx="3"/><rect x="${X + m + 7}" y="${Y + m + 7}" width="${W - m * 2 - 14}" height="${H - m * 2 - 14}" fill="none" stroke="hsl(40 50% 60%)" stroke-width="1.2" stroke-dasharray="6 3"/>`; }
  // Wear: a few stains and scuffs, so no two rooms look alike.
  const stains = Math.floor(r() * (1 + rm.w * rm.h / 12)); for (let i = 0; i < stains; i++) d += `<ellipse cx="${(X + r() * W).toFixed(1)}" cy="${(Y + r() * H).toFixed(1)}" rx="${(P * (0.3 + r() * 0.8)).toFixed(1)}" ry="${(P * (0.2 + r() * 0.5)).toFixed(1)}" fill="#3a2a18" opacity="${(0.05 + r() * 0.07).toFixed(2)}"/>`;
  return `<g clip-path="url(#gc${rm._i})">${d}</g>`;
}
// Floors are drawn with a square of margin all round (GEN_PAD) so a grand front door's step and pillars can stand outside.
const GEN_PAD = 1;
function genFloorSvg(B, L, labels, seed, overlay) {
  const P = GEN_PX, W = B.W, H = B.H, r = genRng((Number(seed) || 1) * 31 + L.level * 7 + 5);
  L.rooms.forEach((rm, i) => { rm._i = L.level + "_" + i; });
  const clips = L.rooms.map(rm => `<clipPath id="gc${rm._i}"><rect x="${rm.x * P}" y="${rm.y * P}" width="${rm.w * P}" height="${rm.h * P}"/></clipPath>`).join("");
  const rooms = L.rooms.map(rm => genFloorDetail(r, rm, GEN_KIND[rm.k] || "wood", P)).join("");
  // This floor's stairs. Going up they get lighter towards the end you walk to (▲ there); going down, darker (▼).
  let stairs = "";
  (L.stairs || []).forEach((t, i) => {
    const along = t.w >= t.h, n = 6, X = t.x * P, Y = t.y * P, Wd = t.w * P, Hd = t.h * P, gid = `gst${L.level + 5}_${i}`, toB = t.toward === "b";
    // The room's own floor shows through: going down it fades to black, going up it brightens a little.
    const near = t.dir === "up" ? "rgba(255,248,230,0)" : "rgba(0,0,0,0)", far = t.dir === "up" ? "rgba(255,248,230,.55)" : "rgba(0,0,0,.95)";
    const steps = Array.from({ length: n - 1 }, (_, j) => along ? `<line x1="${X + Wd * (j + 1) / n}" y1="${Y}" x2="${X + Wd * (j + 1) / n}" y2="${Y + Hd}" stroke="rgba(40,28,16,.75)" stroke-width="2"/>` : `<line x1="${X}" y1="${Y + Hd * (j + 1) / n}" x2="${X + Wd}" y2="${Y + Hd * (j + 1) / n}" stroke="rgba(40,28,16,.75)" stroke-width="2"/>`).join("");
    const cx = along ? (toB ? X + Wd - P * 0.28 : X + P * 0.28) : X + Wd / 2, cy = along ? Y + Hd / 2 : (toB ? Y + Hd - P * 0.28 : Y + P * 0.28);
    stairs += `<defs><linearGradient id="${gid}" x1="${along ? (toB ? 0 : 1) : 0}" y1="${along ? 0 : (toB ? 0 : 1)}" x2="${along ? (toB ? 1 : 0) : 0}" y2="${along ? 0 : (toB ? 1 : 0)}"><stop offset="0" stop-color="${near}"/><stop offset="1" stop-color="${far}"/></linearGradient></defs>
      ${steps}<rect x="${X}" y="${Y}" width="${Wd}" height="${Hd}" fill="url(#${gid})" stroke="#3a2c1c" stroke-width="2"/><text x="${cx}" y="${cy}" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${t.dir === "up" ? "#3a2c1c" : "#f1e6cf"}" stroke="${t.dir === "up" ? "#f3ead6" : "#000"}" stroke-width="2" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${t.dir === "up" ? "▲" : "▼"}</text>`;
  });
  // Fireplaces (a stone hearth against the wall, a fire in it) and plain flues where a chimney passes through.
  const hearth = (L.hearths || []).map(h => { const X = h.x * P, Y = h.y * P, d = 0.42 * P, s = 0.1 * P, horiz = h.side === "t" || h.side === "b";
    const box = h.side === "t" ? [X + s, Y, P - 2 * s, d] : h.side === "b" ? [X + s, Y + P - d, P - 2 * s, d] : h.side === "l" ? [X, Y + s, d, P - 2 * s] : [X + P - d, Y + s, d, P - 2 * s];
    if (!h.fire) return `<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="#8d8478" stroke="#2b2520" stroke-width="2"/>`;
    const apron = h.side === "t" ? [X + s / 2, Y + d - 2, P - s, P * 0.22] : h.side === "b" ? [X + s / 2, Y + P - d - P * 0.22 + 2, P - s, P * 0.22] : h.side === "l" ? [X + d - 2, Y + s / 2, P * 0.22, P - s] : [X + P - d - P * 0.22 + 2, Y + s / 2, P * 0.22, P - s];
    const fb = [box[0] + (horiz ? P * 0.14 : 4), box[1] + (horiz ? 4 : P * 0.14), box[2] - (horiz ? P * 0.28 : 8), box[3] - (horiz ? 8 : P * 0.28)], fx = fb[0] + fb[2] / 2, fy = fb[1] + fb[3] / 2, big = h.k === "forge" ? 1.4 : 1;
    return `<rect x="${apron[0]}" y="${apron[1]}" width="${apron[2]}" height="${apron[3]}" fill="#9d968a" stroke="#2b2520" stroke-width="1.5"/>
      <rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="#7d7266" stroke="#2b2520" stroke-width="2"/><rect x="${fb[0]}" y="${fb[1]}" width="${fb[2]}" height="${fb[3]}" fill="#1e1a16"/>
      <circle cx="${fx}" cy="${fy}" r="${P * 0.13 * big}" fill="#e0762a" opacity=".9"/><circle cx="${fx}" cy="${fy}" r="${P * 0.07 * big}" fill="#ffd36b"/>`; }).join("");
  const edges = genEdges(L, B.W, B.H), porchI = L.rooms.findIndex(x => x.porch);
  // Outside walls are twice as thick as inside ones. Doors to the outside get stone jambs; the front door a grand entrance.
  const WI = 5, WE = 10, front = L.front || new Set();
  const walls = edges.map(e => { const ln = (sw, c, cap, extra) => `<line x1="${e.x1 * P}" y1="${e.y1 * P}" x2="${e.x2 * P}" y2="${e.y2 * P}" stroke="${c}" stroke-width="${sw}" stroke-linecap="${cap}"${extra || ""}/>`;
    if (front.has(e.k)) return "";
    if (L.doors.has(e.k) && !L.secret.has(e.k)) { if (!e.ext) return ln(4, "#8a6a44", "butt", ` opacity=".9"`);
      const h = e.y1 === e.y2, j = (x, y) => `<rect x="${x * P - 6}" y="${y * P - 6}" width="12" height="12" fill="#a39b8c" stroke="#2b2520" stroke-width="2"/>`;
      return ln(WE, "#3b2a1a", "butt") + ln(6, "#7a4a26", "butt") + j(e.x1, e.y1) + j(e.x2, e.y2); }
    if (L.wins.has(e.k)) return ln(WE, "#2b2520", "square") + ln(3, "#bfe3f2", "butt");
    return ln(e.ext ? WE : WI, "#2b2520", "square"); }).join("");
  // The front door: double doors under a stone lintel, a pillar each side and a broad step outside.
  let grand = "";
  if (front.size) { const tier = B.doorTier || "grand"; const xs = [...front].map(k => Number(k.split(",")[1])), x0 = Math.min(...xs) * P, x1 = (Math.max(...xs) + 1) * P, y = Number([...front][0].split(",")[2]) * P, mx = (x0 + x1) / 2;
    const leaves = tier === "grand" || x1 - x0 > P * 1.5
      ? `<rect x="${x0 + 1}" y="${y - 5}" width="${(x1 - x0) / 2 - 2}" height="10" fill="#7a4a26" stroke="#2b2520" stroke-width="1.5"/><rect x="${mx + 1}" y="${y - 5}" width="${(x1 - x0) / 2 - 2}" height="10" fill="#7a4a26" stroke="#2b2520" stroke-width="1.5"/><circle cx="${mx - 5}" cy="${y}" r="2" fill="#e8c27a"/><circle cx="${mx + 5}" cy="${y}" r="2" fill="#e8c27a"/>`
      : `<rect x="${x0 + 2}" y="${y - 4}" width="${x1 - x0 - 4}" height="8" fill="#7a4a26" stroke="#2b2520" stroke-width="1.5"/><circle cx="${x1 - 8}" cy="${y}" r="1.8" fill="${tier === "plain" ? "#3a3530" : "#c9a45e"}"/>`;
    if (tier === "plain") // a plain door: a timber frame in the wall and one rough doorstep
      grand = `<rect x="${x0 - P * 0.12}" y="${y}" width="${x1 - x0 + P * 0.24}" height="${P * 0.3}" rx="4" fill="#9a9283" stroke="#2b2520" stroke-width="1.5"/>
        <rect x="${x0 - 4}" y="${y - WE / 2}" width="${x1 - x0 + 8}" height="${WE}" fill="#5a4330" stroke="#2b2520" stroke-width="1.5"/>${leaves}`;
    else if (tier === "framed") { // a framed door: a heavy lintel, a squared post each side and a stone step
      const post = cx => `<rect x="${cx - P * 0.13}" y="${y - P * 0.13}" width="${P * 0.26}" height="${P * 0.26}" fill="#6e5236" stroke="#2b2520" stroke-width="2"/><rect x="${cx - P * 0.13}" y="${y - P * 0.13}" width="${P * 0.26}" height="3" fill="rgba(255,255,255,.18)"/>`;
      grand = `<rect x="${x0 - P * 0.4}" y="${y}" width="${x1 - x0 + P * 0.8}" height="${P * 0.42}" rx="3" fill="#a8a092" stroke="#2b2520" stroke-width="2"/>
        <rect x="${x0 - P * 0.3}" y="${y - WE / 2 - 2}" width="${x1 - x0 + P * 0.6}" height="${WE + 4}" fill="#5f4630" stroke="#2b2520" stroke-width="2"/>${leaves}${post(x0 - P * 0.17)}${post(x1 + P * 0.17)}`; }
    else {    const pr = P * 0.25, pillar = cx => `<circle cx="${cx + 2}" cy="${y + P * 0.3 + 3}" r="${pr + 1}" fill="rgba(0,0,0,.35)"/><circle cx="${cx}" cy="${y + P * 0.3}" r="${pr}" fill="#d8d0c0" stroke="#2b2520" stroke-width="2.5"/><circle cx="${cx}" cy="${y + P * 0.3}" r="${pr * 0.7}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1.5"/><circle cx="${cx - pr * 0.3}" cy="${y + P * 0.3 - pr * 0.3}" r="${pr * 0.35}" fill="#f4efe4"/>`;
    grand = `<rect x="${x0 - P * 0.6}" y="${y + P * 0.45}" width="${x1 - x0 + P * 1.2}" height="${P * 0.45}" rx="3" fill="#958d80" stroke="#2b2520" stroke-width="2"/>
      <rect x="${x0 - P * 0.85}" y="${y}" width="${x1 - x0 + P * 1.7}" height="${P * 0.55}" rx="3" fill="#aea697" stroke="#2b2520" stroke-width="2"/>
      <rect x="${x0 - P * 0.75}" y="${y - WE / 2 - 4}" width="${x1 - x0 + P * 1.5}" height="${WE + 8}" fill="#6e5c48" stroke="#2b2520" stroke-width="2.5"/>
      <rect x="${x0 - P * 0.75}" y="${y - WE / 2 - 4}" width="${x1 - x0 + P * 1.5}" height="3" fill="rgba(255,255,255,.18)"/>
      ${leaves}
      ${pillar(x0 - P * 0.45)}${pillar(x1 + P * 0.45)}`; } }
  // What the tabletop will treat as walls, doors and windows, in its own colours.
  let over = "";
  if (overlay) {
    over = edges.map(e => { const isD = L.doors.has(e.k), isW = L.wins.has(e.k), sec = L.secret.has(e.k);
      const c = sec ? "#b06ad6" : isD ? "#c98b4a" : isW ? "#7fd0ff" : "#ff9a3c", dash = isW ? ` stroke-dasharray="10 4"` : "";
      return `<line x1="${e.x1 * P}" y1="${e.y1 * P}" x2="${e.x2 * P}" y2="${e.y2 * P}" stroke="${c}" stroke-width="${isD || isW ? 5 : 3}"${dash}/>`; }).join("");
    over += edges.filter(e => L.doors.has(e.k) || L.wins.has(e.k)).map(e => { const sec = L.secret.has(e.k), isW = L.wins.has(e.k), cx = (e.x1 + e.x2) / 2 * P, cy = (e.y1 + e.y2) / 2 * P;
      return `<circle cx="${cx}" cy="${cy}" r="${isW ? 6 : 8}" fill="rgba(12,14,19,.85)" stroke="${sec ? "#b06ad6" : isW ? "#7fd0ff" : "#e8c27a"}" stroke-width="2"${sec ? ` stroke-dasharray="3 2"` : ""}/>`; }).join("");
    over += (L.stairs || []).map(t => `<rect x="${t.x * P + 2}" y="${t.y * P + 2}" width="${t.w * P - 4}" height="${t.h * P - 4}" fill="none" stroke="#ffd23c" stroke-width="2.5" stroke-dasharray="6 4"/>`).join("");
  }
  const posts = porchI >= 0 ? (rm => { const pts = [[rm.x, rm.y + rm.h], [rm.x + rm.w, rm.y + rm.h]]; for (let x = rm.x + 2; x < rm.x + rm.w - 1; x += 2) pts.push([x, rm.y + rm.h]); return pts.map(([x, y]) => `<rect x="${x * P - 5}" y="${y * P - 5}" width="10" height="10" fill="#5a4330" stroke="#2b2520" stroke-width="2"/>`).join(""); })(L.rooms[porchI]) : "";
  // A room's name goes in its middle, or beside the stairs if they're in the way.
  const labAt = rm => { let x = rm.x + rm.w / 2, y = rm.y + rm.h / 2; const t = (L.stairs || []).find(q => x > q.x - 1 && x < q.x + q.w + 1 && y > q.y - 0.6 && y < q.y + q.h + 0.6 && q.x >= rm.x && q.x < rm.x + rm.w && q.y >= rm.y && q.y < rm.y + rm.h);
    if (t && x > t.x - 1 && x < t.x + t.w + 1 && y > t.y - 0.6 && y < t.y + t.h + 0.6) {
      const leftRoom = t.x - rm.x, rightRoom = rm.x + rm.w - (t.x + t.w), upRoom = t.y - rm.y, downRoom = rm.y + rm.h - (t.y + t.h), best = Math.max(leftRoom, rightRoom, upRoom, downRoom);
      if (best === leftRoom) x = rm.x + leftRoom / 2; else if (best === rightRoom) x = t.x + t.w + rightRoom / 2; else if (best === upRoom) y = rm.y + upRoom / 2; else y = t.y + t.h + downRoom / 2; }
    return [x, y]; };
  const lab = labels ? L.rooms.map(rm => `<text x="${labAt(rm)[0] * P}" y="${labAt(rm)[1] * P}" font-family="system-ui, sans-serif" font-size="${Math.min(13, rm.w * P / Math.max(4, rm.n.length) * 1.7).toFixed(1)}" font-weight="700" fill="#2a2016" stroke="#f3e9d2" stroke-width="2.5" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(rm.n)}${rm.secret ? " 🔒" : ""}</text>`).join("") : "";
  const pd = GEN_PAD * P;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pd} ${-pd} ${W * P + pd * 2} ${H * P + pd * 2}" width="${W * P + pd * 2}" height="${H * P + pd * 2}"><defs>${clips}</defs>${rooms}${stairs}${hearth}${walls}${posts}${grand}${lab}${over}</svg>`;
}
// A hipped roof on every wing (and a lean-to over a porch), shingles each their own shade, maybe a chimney or two.
function genRoofSvg(B, seed) {
  const r = genRng((Number(seed) || 1) * 7 + 3), P = GEN_PX, F = B.F, hue = [[12, 38, 36], [25, 18, 32], [215, 10, 38], [30, 30, 30]][Math.floor(r() * 4)];
  const roof = g => { const X = g.x * P, Y = g.y * P, W = g.w * P, H = g.h * P, cp = `rc${g.x}_${g.y}`; let sh = "";
    for (let y = 0; y < H; y += P / 3) { let x = -r() * P / 2; while (x < W) { const w = P * (0.35 + r() * 0.3); sh += `<rect x="${(X + x).toFixed(1)}" y="${(Y + y).toFixed(1)}" width="${w.toFixed(1)}" height="${(P / 3).toFixed(1)}" fill="${genHsl(hue[0], hue[1], hue[2], 4, r)}" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>`; x += w; } }
    const hw = Math.min(W, H) / 2, ridge = W >= H ? `M${X + hw} ${Y + H / 2}H${X + W - hw}` : `M${X + W / 2} ${Y + hw}V${Y + H - hw}`;
    const hips = W >= H ? `M${X} ${Y}L${X + hw} ${Y + H / 2}L${X} ${Y + H}M${X + W} ${Y}L${X + W - hw} ${Y + H / 2}L${X + W} ${Y + H}` : `M${X} ${Y}L${X + W / 2} ${Y + hw}L${X + W} ${Y}M${X} ${Y + H}L${X + W / 2} ${Y + H - hw}L${X + W} ${Y + H}`;
    return `<clipPath id="${cp}"><rect x="${X}" y="${Y}" width="${W}" height="${H}"/></clipPath><g clip-path="url(#${cp})">${sh}</g><rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="none" stroke="#2b2520" stroke-width="5"/><path d="${hips}" stroke="rgba(0,0,0,.35)" stroke-width="4" fill="none"/><path d="${ridge}" stroke="#2b2520" stroke-width="5"/>`; };
  let out = F.wings.map(roof).join("");
  if (F.porch) { const g = F.porch, X = g.x * P, Y = g.y * P, W = g.w * P, H = g.h * P; let ln = ""; for (let y = Y + 6; y < Y + H; y += 7) ln += `<line x1="${X}" y1="${y}" x2="${X + W}" y2="${y}" stroke="rgba(0,0,0,.3)" stroke-width="1.2"/>`;
    out += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${genHsl(hue[0], hue[1], hue[2] + 6, 0, r)}" stroke="#2b2520" stroke-width="4"/>${ln}`; }
  // A chimney over each fireplace stack, at the wall the hearth is against; two fires back to back share one wide chimney.
  const off = { t: [0, -0.15], b: [0, 0.15], l: [-0.15, 0], r: [0.15, 0] }, pts = [];
  (B.chimneys || []).forEach(st => { const [dx, dy] = off[st.side], px = st.x + 0.5 + dx, py = st.y + 0.5 + dy, near = pts.find(q => Math.hypot(q.x - px, q.y - py) < 0.5);
    if (near) { near.x = (near.x + px) / 2; near.y = (near.y + py) / 2; near.n = 2; near.wide = st.side === "l" || st.side === "r" ? "y" : "x"; } else pts.push({ x: px, y: py, n: 1, side: st.side }); });
  pts.forEach(q => { const w = q.n > 1 && q.wide === "y" ? 0.7 : q.n > 1 ? 1.1 : 0.7, h = q.n > 1 && q.wide === "y" ? 1.1 : 0.7, cx = q.x * P, cy = q.y * P;
    const pots = q.n > 1 ? (q.wide === "y" ? [[0, -0.25], [0, 0.25]] : [[-0.25, 0], [0.25, 0]]) : [[0, 0]];
    out += `<rect x="${cx - w * P / 2 + 3}" y="${cy - h * P / 2 + 4}" width="${w * P}" height="${h * P}" fill="rgba(0,0,0,.35)"/><rect x="${cx - w * P / 2}" y="${cy - h * P / 2}" width="${w * P}" height="${h * P}" fill="#7d7266" stroke="#2b2520" stroke-width="3"/>` +
      pots.map(([a, b]) => `<rect x="${cx + a * P - P * .14}" y="${cy + b * P - P * .14}" width="${P * .28}" height="${P * .28}" fill="#1e1a16"/>`).join(""); });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B.W * P} ${B.H * P}" width="${B.W * P}" height="${B.H * P}">${out}</svg>`;
}
// The yard: patchy grass with tufts, and a rough path from the door to the edge of the map with grass poking through.
function genYardSvg(W, H, path, seed) {
  const P = GEN_PX, r = genRng((Number(seed) || 1) * 13 + 11); let d = `<rect width="${W * P}" height="${H * P}" fill="hsl(95 26% 45%)"/>`;
  for (let i = 0; i < W * H * 0.35; i++) d += `<ellipse cx="${(r() * W * P).toFixed(1)}" cy="${(r() * H * P).toFixed(1)}" rx="${(P * (0.5 + r() * 1.8)).toFixed(1)}" ry="${(P * (0.4 + r() * 1.2)).toFixed(1)}" fill="hsl(${88 + r() * 20} ${20 + r() * 15}% ${36 + r() * 16}%)" opacity="${(0.25 + r() * 0.3).toFixed(2)}"/>`;
  const tuft = (x, y, s) => { const c = `hsl(${85 + r() * 25} 35% ${28 + r() * 14}%)`; let t = ""; for (let k = 0; k < 3; k++) { const a = (-0.6 + k * 0.6 + (r() - 0.5) * 0.4); t += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.sin(a) * s).toFixed(1)}" y2="${(y - Math.cos(a) * s).toFixed(1)}" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`; } return t; };
  for (let i = 0; i < W * H * 1.2; i++) d += tuft(r() * W * P, r() * H * P, 3 + r() * 4);
  for (let i = 0; i < W * H * 0.04; i++) d += `<circle cx="${(r() * W * P).toFixed(1)}" cy="${(r() * H * P).toFixed(1)}" r="${(1.5 + r() * 1.5).toFixed(1)}" fill="${["#e8d25a", "#e9e4f0", "#c86a8a"][Math.floor(r() * 3)]}" opacity=".85"/>`;
  if (path) { // edges that wander, packed earth, pebbles, grass growing in and along it
    const { x, y, w } = path, x0 = x * P, y0 = y * P, y1 = H * P, step = P / 2, L = [], R = [];
    let drift = 0; for (let yy = y0; yy <= y1 + 0.1; yy += step) { drift += (r() - 0.5) * P * 0.25; drift = Math.max(-P * 0.6, Math.min(P * 0.6, drift)); L.push([x0 + drift - (r() * P * 0.18), yy]); R.push([x0 + w * P + drift + (r() * P * 0.18), yy]); }
    const poly = L.concat(R.reverse()).map(([a, b]) => a.toFixed(1) + "," + b.toFixed(1)).join(" ");
    d += `<polygon points="${poly}" fill="hsl(34 30% 56%)"/>`;
    const span = [Math.min(...L.map(q => q[0])), Math.max(...R.map(q => q[0]))];
    for (let i = 0; i < (y1 - y0) / P * w * 6; i++) d += `<circle cx="${(span[0] + r() * (span[1] - span[0])).toFixed(1)}" cy="${(y0 + r() * (y1 - y0)).toFixed(1)}" r="${(1 + r() * 2.2).toFixed(1)}" fill="hsl(30 ${10 + r() * 15}% ${40 + r() * 25}%)" opacity=".8"/>`;
    for (let i = 0; i < (y1 - y0) / P * w * 0.8; i++) d += `<ellipse cx="${(span[0] + P * 0.2 + r() * (span[1] - span[0] - P * 0.4)).toFixed(1)}" cy="${(y0 + r() * (y1 - y0)).toFixed(1)}" rx="${(3 + r() * 6).toFixed(1)}" ry="${(2 + r() * 4).toFixed(1)}" fill="hsl(92 28% 40%)" opacity=".75"/>`;
    L.concat(R).forEach(([a, b]) => { if (r() < 0.8) d += tuft(a + (r() - 0.5) * 6, b + (r() - 0.5) * P * 0.5, 3 + r() * 4); });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * P} ${H * P}" width="${W * P}" height="${H * P}">${d}</svg>`;
}
const genUrl = svg => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

// ----- Turning a building into a tabletop page -----
function genPage(o) {
  const B = genBuilding(o), F = B.F, m = 3, ox = m, oy = m, W = B.W + m * 2, H = B.H + m * 2 + 1, id = () => vid("o");
  const objs = [], walls = [], areas = [], links = [], names = {}, P = GEN_PX;
  const cells = set => [...set].map(k => { const [x, y] = k.split(",").map(Number); return [ox + x, oy + y]; });
  const porchCells = F.porch ? Array.from({ length: F.porch.w * F.porch.h }, (_, i) => (F.porch.x + i % F.porch.w) + "," + (F.porch.y + Math.floor(i / F.porch.w))) : [];
  const fr = [...B.levels.find(L => L.level === 0).front].map(k => Number(k.split(",")[1])), fx = fr.length ? Math.min(...fr) : B.W / 2, fw = fr.length;
  const pathTop = oy + (F.porch ? F.porch.y + F.porch.h : F.main.y + F.main.h);
  objs.push({ id: id(), layer: "map", level: 0, x: 0, y: 0, w: W, h: H, img: genUrl(genYardSvg(W, H, { x: ox + fx - 0.25, y: pathTop, w: fw + 0.5 }, o.seed)) });
  B.levels.forEach(L => {
    objs.push({ id: id(), layer: "map", level: L.level, x: ox - GEN_PAD, y: oy - GEN_PAD, w: B.W + GEN_PAD * 2, h: B.H + GEN_PAD * 2, img: genUrl(genFloorSvg(B, L, false, o.seed)) });
    objs.push({ id: id(), layer: "gm", level: L.level, x: ox, y: oy, w: B.W, h: B.H, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B.W * P} ${B.H * P}" width="${B.W * P}" height="${B.H * P}">${L.rooms.map(rm => `<text x="${(rm.x + rm.w / 2) * P}" y="${(rm.y + rm.h / 2) * P}" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(rm.n)}${rm.secret ? " (secret)" : ""}</text>`).join("")}</svg>`) });
    genEdges(L, B.W, B.H).forEach(e => { const meta = L.doors.has(e.k) ? Object.assign({ k: "door", id: vid("d"), open: false }, L.secret.has(e.k) ? { secret: true } : {}) : L.wins.has(e.k) ? { k: "window", id: vid("d") } : null;
      walls.push([ox + e.x1, oy + e.y1, ox + e.x2, oy + e.y2, L.level].concat(meta ? [meta] : [])); });
    if (L.level > 0) areas.push({ id: vid("a"), level: L.level, cells: cells(F.body) });
    if (L.level < 0) { const set = new Set(); L.rooms.forEach(rm => { for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) set.add(x + "," + y); }); areas.push({ id: vid("a"), level: L.level, cells: cells(set) }); }
    names[L.level] = L.name;
  });
  const roofLvl = B.floors; names[roofLvl] = "Roof";
  objs.push({ id: id(), layer: "map", level: roofLvl, x: ox, y: oy, w: B.W, h: B.H, img: genUrl(genRoofSvg(B, o.seed)) });
  areas.push({ id: vid("a"), level: roofLvl, cells: cells(F.body) });
  if (porchCells.length) areas.push({ id: vid("a"), level: roofLvl, cells: cells(new Set(porchCells)) }); // its own roof: stepping onto the porch lifts only that
  // One stairs link per staircase: each joins its two floors only.
  (B.stairs || []).forEach(t => links.push({ id: vid("l"), kind: "stairs", x: ox + t.x, y: oy + t.y, w: t.w, h: t.h, levels: [t.lo, t.lo + 1] }));
  return { B, page: { w: W, h: H, bg: "#6f8f4f", grid: true, light: false, fogMem: true, objs, walls: genMergeWalls(walls), areas, links, levelNames: names, minLevel: B.cellar ? -1 : 0, maxLevel: roofLvl } };
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
function genDefaults(type) { return { type, seed: genSeed(), size: "medium", floors: "auto", cellar: "auto", shape: "auto", porch: "auto", name: "", tags: [] }; }
const genKeep = o => ({ type: o.type, seed: o.seed, size: o.size, floors: o.floors, cellar: o.cellar, shape: o.shape || "auto", porch: o.porch || "auto", name: o.name, tags: o.tags || [] });
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
        <label><span>Shape</span>${seg("shape", [["auto", "Any"], ...Object.keys(T.shapes).map(k => [k, ({ rect: "Box", L: "L", U: "U", long: "Long" })[k]])])}</label>
        <label><span>Porch</span>${seg("porch", [["auto", "Maybe"], ["yes", "Yes"], ["no", "No"]])}</label>
        <label class="genchk"><input type="checkbox" data-act="genchk" data-k="overlay"${o.overlay ? " checked" : ""}> <span>Show walls, doors &amp; windows <small class="muted">as the tabletop will use them</small></span></label>
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
  const B = genBuilding(o), levels = B.levels.slice().sort((a, b) => b.level - a.level), rooms = B.levels.reduce((a, L) => a + L.rooms.filter(x => !x.circ && !x.porch).length, 0);
  return `<p class="small"><strong>${B.W} × ${B.H} squares</strong> <span class="muted">(${B.W * 5} × ${B.H * 5} ft) · ${esc(GEN_SHAPES[B.F.shape])}${B.F.porch ? " with a porch" : ""} · ${B.floors} floor${B.floors === 1 ? "" : "s"}${B.cellar ? " and a cellar" : ""} · ${rooms} rooms</span>${B.rare.length ? `<br><span class="genrare">✦ Something unusual: ${esc(B.rare.join(", "))}</span>` : ""}</p>
    <div class="genfloors"><figure><img src="${genUrl(genRoofSvg(B, o.seed))}" alt="The roof"><figcaption>Roof</figcaption></figure>${levels.map(L => `<figure><img src="${genUrl(genFloorSvg(B, L, true, o.seed, o.overlay))}" alt="${esc(L.name)}"><figcaption>${esc(L.name)}</figcaption></figure>`).join("")}</div>`;
}
const genRefresh = () => { const el = document.getElementById("genpreview"); if (el && GEN.o) el.innerHTML = genPreviewHtml(GEN.o); };
const genReadForm = () => { const o = GEN.o; if (!o) return; const n = document.getElementById("gen-name"), t = document.getElementById("gen-tags"); if (n) o.name = n.value.trim(); if (t) o.tags = t.value.split(",").map(x => x.trim()).filter(Boolean); };
// The pictures as files: each drawn once onto a canvas and uploaded (WebP where the browser can, else PNG), so a map is a
// few small links instead of megabytes of drawing that every screen redraws. Without uploads they stay in the map as drawings.
async function genStoreImages(page) {
  if (!S.assets || !S.assets.upload) return page;
  toast("Drawing the building…");
  for (const o of page.objs) {
    if (!String(o.img).startsWith("data:image/svg")) continue;
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = o.img; });
      const cv = document.createElement("canvas"); cv.width = Math.round(o.w * GEN_PX); cv.height = Math.round(o.h * GEN_PX); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
      const blob = await new Promise(res => cv.toBlob(res, "image/webp", 0.88)); if (!blob) continue;
      const type = blob.type || "image/png", res = await S.assets.upload(new File([blob], "generated." + (type.includes("webp") ? "webp" : "png"), { type }));
      o.img = assetPath(res); cv.width = cv.height = 0;
    } catch (e) { /* keep the drawing in the map */ }
  }
  return page;
}
async function genSaveLib(o) {
  if (!S.vttCamps.has(VGEN)) await vSave("vttcamps/" + VGEN, { name: "Generated buildings", workshop: true, genlib: true, created: new Date().toISOString() });
  const { page } = genPage(o), T = genType(o.type), pid = o.pid && S.vttPages.has(o.pid) ? o.pid : vid("p"); await genStoreImages(page);
  await vSave("vttpages/" + pid, Object.assign(page, { camp: VGEN, name: o.name || T.name, order: 0, folder: "", open: false, gen: genKeep(o), created: new Date().toISOString() }));
  return pid;
}
async function genPlace(camp, o) {
  const { page } = genPage(o), T = genType(o.type), pid = vid("p"), order = vPages(camp).length; await genStoreImages(page);
  await vSave("vttpages/" + pid, Object.assign(page, { camp, name: o.name || T.name, order, folder: "Buildings", open: false, gen: genKeep(o), created: new Date().toISOString() }));
  for (let i = 0; i < 40 && !S.vttPages.has(pid); i++) await new Promise(res => setTimeout(res, 50)); // wait for the new map to arrive
  VTT.camp = camp; VTT.page = pid; if (location.hash === "#vtt-" + camp) render(); else location.hash = "vtt-" + camp; toast(`${o.name || T.name} is a new map in ${(S.vttCamps.get(camp) || {}).name || "the campaign"}. The players stay where they are.`);
}
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act^=gen]"); if (!b || !vCanEdit()) return; const a = b.dataset.act;
  if (a === "genopt" && GEN.o) { GEN.o[b.dataset.k] = b.dataset.v; b.parentElement.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); genRefresh(); return; }
  if (a === "genchk" && GEN.o) { GEN.o[b.dataset.k] = b.checked; genRefresh(); return; }
  if (a === "genroll" && GEN.o) { GEN.o.seed = genSeed(); const s = document.getElementById("gen-seed"); if (s) s.value = GEN.o.seed; genRefresh(); return; }
  if (a === "gentagf") { GEN.tag = b.dataset.v; render(); return; }
  if (a === "gensave" && GEN.o) { genReadForm(); b.disabled = true; GEN.o.pid = await genSaveLib(GEN.o); b.disabled = false; b.textContent = "Save changes"; toast("Saved to your buildings."); return; }
  if (a === "genplace") { ev.preventDefault(); let o = GEN.o; if (b.dataset.id) { const p = S.vttPages.get(b.dataset.id); if (!p || !p.gen) return; o = Object.assign({}, p.gen, { name: p.name }); } else genReadForm(); if (o) genPlace(b.dataset.camp, o); return; }
  if (a === "genedit") { const p = S.vttPages.get(b.dataset.id); if (p && p.gen) GEN.o = Object.assign({}, p.gen, { name: p.name, pid: b.dataset.id, camp: (route() || {}).camp }); return; }
  if (a === "gendel") { const p = S.vttPages.get(b.dataset.id); if (!p) return; if (await confirmBox(`Delete “${p.name}” from your buildings?`, "Delete")) await vDel("vttpages/" + b.dataset.id); return; }
});
document.addEventListener("change", ev => { if (ev.target && ev.target.id === "gen-seed" && GEN.o) { GEN.o.seed = Math.max(1, Math.round(Number(ev.target.value)) || 1); genRefresh(); } });
