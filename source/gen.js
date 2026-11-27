// ===== Generators. Buildings for now: a type, a size and a seed make a whole playable building =====
// A generated building is a tabletop page: a floor plan picture per floor, walls with doors and windows on every floor,
// stairs between floors, raised squares for the floors above the ground, a roof on top and room names (GM only).
// The same type, options and seed always make the same building. Saved buildings are pages in the hidden campaign
// vttcamps/genlib, each with page.gen = { type, seed, size, floors, cellar, name, tags }.
const VGEN = "genlib", GEN_PX = 40;
const genRng = seed => { let a = (Number(seed) >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const genInt = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const genOne = (r, list) => list[Math.floor(r() * list.length)];
const genShuf = (r, list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const genSeed = () => Math.floor(Math.random() * 1e9) + 1;

// Floors: how each kind of room looks.
const GEN_FLOOR = {
  wood: { base: [36, 42, 63], line: "#8f6d45" }, stone: { base: [38, 8, 70], line: "#8a8377" }, earth: { base: [33, 22, 49], line: "#6f5d43" },
  tile: { base: [40, 30, 78], line: "#a99a7a" }, rug: { base: [36, 42, 63], line: "#8f6d45" }, porch: { base: [33, 36, 58], line: "#80633f" }
};
const GEN_KIND = { living: "wood", bed: "wood", kitchen: "stone", store: "earth", cellar: "earth", shop: "wood", work: "wood", forge: "stone", tavern: "wood",
  hall: "stone", privy: "wood", office: "wood", meet: "rug", library: "wood", temple: "tile", sanctum: "rug", landing: "wood", porch: "porch", bath: "tile", pit: "earth", vault: "stone" };
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
    upper: [{ n: "Privy", k: "privy", w: 0.35, opt: 0.4 }, { n: "Bedroom", k: "bed", w: 2 }, { n: "Bedroom", k: "bed", w: 1.4 }, { n: "Bedroom", k: "bed", w: 1.2, opt: 0.5 }, { n: "Storage", k: "store", w: 0.6, opt: 0.35 }],
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
    upper: [{ n: "Privy", k: "privy", w: 0.35, opt: 0.4 }, { n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1 }, { n: "Guest room", k: "bed", w: 1, opt: 0.7 }, { n: "Guest room", k: "bed", w: 1, opt: 0.5 }, { n: "Keeper's room", k: "bed", w: 1.4 }],
    under: [{ n: "Beer cellar", k: "cellar", w: 1.6 }, { n: "Store", k: "cellar", w: 0.8, opt: 0.6 }],
    rare: [{ n: "Gambling den", k: "meet", w: 1.2, at: "ground", p: 0.15 }, { n: "Bathhouse", k: "bath", w: 1.2, at: "ground", p: 0.1 }, { n: "Bridal suite", k: "bed", w: 1.4, at: "upper", p: 0.12 },
      { n: "Fighting pit", k: "pit", w: 1.4, at: "under", p: 0.1 }, { n: "Smuggler's tunnel", k: "cellar", w: 0.6, at: "under", p: 0.08, secret: 1 }] },
  { id: "guild", name: "Guild hall", icon: "🏛", blurb: "A great hall for the members, offices, a meeting room and the guildmaster's study.",
    size: { small: [[9, 11], [8, 10], [2, 2]], medium: [[11, 14], [10, 12], [2, 3]], large: [[14, 17], [11, 14], [3, 3]] }, cellar: 0.4, hall: 2,
    shapes: { rect: 2, U: 1.5, L: 1 }, porch: 0.2,
    ground: [{ n: "Great hall", k: "hall", w: 4, front: 1, entry: 1 }, { n: "Reception", k: "office", w: 1 }, { n: "Office", k: "office", w: 1 }, { n: "Archive", k: "store", w: 1, back: 1 }],
    single: [{ n: "Guildmaster's study", k: "office", w: 1.4 }],
    upper: [{ n: "Privy", k: "privy", w: 0.35, opt: 0.4 }, { n: "Meeting room", k: "meet", w: 2 }, { n: "Guildmaster's study", k: "office", w: 1.5 }, { n: "Office", k: "office", w: 1 }, { n: "Office", k: "office", w: 1 }, { n: "Library", k: "library", w: 1.5, opt: 0.6 }],
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
const GEN_CUSTOM_T = { id: "custom", name: "Custom building", icon: "✏️", blurb: "Draw your own: rooms, doors, windows, stairs and floors. The furniture fills itself in.", cellar: 0 };
const genType = id => id === "custom" ? GEN_CUSTOM_T : GEN_BUILDINGS.find(b => b.id === id) || GEN_BUILDINGS[0];
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
// A building whose stairs or rooms can't all be reached is thrown away and drawn again from the next variation of the seed
// (the same seed still always gives the same building).
function genBuilding(o) {
  let B = null;
  for (let attempt = 0; attempt < 12; attempt++) { B = genBuildingTry(o, attempt); if (B.ok) break; }
  genHearths(o, B); if (typeof genFurnish === "function") genFurnish(o, B); return B;
}
function genBuildingTry(o, attempt) {
  if (o.custom) return genCustomTry(o); // drawn by hand (builder.js)
  if (genType(o.type).plan) return genPlanTry(o, attempt);
  const T = genType(o.type), r = genRng(attempt ? (Number(o.seed) || 1) + attempt * 100003 : o.seed), S = T.size[o.size] || T.size.medium;
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
      if (c) { const lx = arr.w >= arr.h; const t = lx ? { x: (arr.x - c.x < c.x + c.w - arr.x - arr.w) ? c.x + c.w - arr.w - 1 : c.x + 1, y: arr.y, w: arr.w, h: arr.h } : { x: arr.x, y: (arr.y - c.y < c.y + c.h - arr.y - arr.h) ? c.y + c.h - arr.h - 1 : c.y + 1, w: arr.w, h: arr.h };
        const gap = lx ? (t.x > arr.x ? t.x - (arr.x + arr.w) : arr.x - (t.x + t.w)) : (t.y > arr.y ? t.y - (arr.y + arr.h) : arr.y - (t.y + t.h));
        if (gap >= 2) nx = Object.assign(t, { toward: lx ? (t.x > arr.x ? "b" : "a") : (t.y > arr.y ? "b" : "a") }); }
      // Otherwise somewhere else along the landing, then in the biggest rooms; only as a last resort right above the last ones.
      const avoid2 = new Set([...cellsOf(arr), ...near(arr)].flatMap(k => { const [x, y] = k.split(",").map(Number); return [k, (x - 1) + "," + y, (x + 1) + "," + y, x + "," + (y - 1), x + "," + (y + 1)]; }));
      if (!nx && c) nx = genStairSpot(r, c, { longX: c.w >= c.h, within: M, avoid: avoid2, near: new Set() });
      for (const rm of list.filter(x => !x.circ).sort((a, b) => b.w * b.h - a.w * a.h)) { if (nx) break; nx = genStairSpot(r, rm, { longX: rm.w >= rm.h, within: M, avoid: new Set(cellsOf(arr)), near: near(arr) }); }
      if (!nx) nx = Object.assign({}, arr); // nowhere else: right above the last ones
      nx.lo = f; stairs.push(nx); upFrom = nx;
    }
  }
  if (cellar) { const rooms = genPick(r, T.under).concat(at("under")); levels.unshift({ level: -1, rooms: rooms.length > 1 ? genUpper(r, M, down, rooms, minD, 1, "Cellar stairs") : [Object.assign({}, rooms[0] || { n: "Cellar", k: "cellar" }, M)], name: "Cellar" }); }
  // Each floor's stairs: going up the ones from this floor, going down the ones arriving from below... and which way you walk.
  levels.forEach(L => { L.stairs = stairs.filter(t => t.lo === L.level || t.lo + 1 === L.level).map(t => { const onPlaced = t.placedUpper ? L.level === t.lo + 1 : L.level === t.lo;
    return Object.assign({}, t, { dir: L.level === t.lo ? "up" : "down", toward: onPlaced ? t.toward : (t.toward === "a" ? "b" : "a") }); }); });
  // Each run of stairs needs a free square to step on at its foot and one to step off at its head, in the same room as that
  // end, not on other stairs. If it hasn't, try it running the other way.
  const setLevelStairs = () => levels.forEach(L => { L.stairs = stairs.filter(t => t.lo === L.level || t.lo + 1 === L.level).map(t => { const onPlaced = t.placedUpper ? L.level === t.lo + 1 : L.level === t.lo;
    return Object.assign({}, t, { dir: L.level === t.lo ? "up" : "down", toward: onPlaced ? t.toward : (t.toward === "a" ? "b" : "a") }); }); });
  const stairsClear = () => levels.every(L => (L.stairs || []).every(t => genStairEntry(L, t).ok));
  stairs.forEach(t => { if (stairsClear()) return; const was = t.toward; t.toward = was === "a" ? "b" : "a"; setLevelStairs();
    const fine = levels.every(L => (L.stairs || []).filter(q => q.x === t.x && q.y === t.y && q.lo === t.lo).every(q => genStairEntry(L, q).ok));
    if (!fine) { t.toward = was; setLevelStairs(); } });
  // Doors (a tree from the room with the stairs or the front door, so every room can be reached) and windows.
  const stairCols = new Set(levels.find(L => L.level === 0).stairs.filter(t => t.y + t.h >= frontY).flatMap(t => Array.from({ length: t.w }, (_, i) => t.x + i)));
  let fx0 = F.porch ? Math.max(entry.x, F.porch.x) + Math.floor((Math.min(entry.x + entry.w, F.porch.x + F.porch.w) - Math.max(entry.x, F.porch.x) - fw) / 2) : entry.x + Math.floor((entry.w - fw) / 2);
  fx0 = Math.max(entry.x, Math.min(entry.x + entry.w - fw, fx0)); for (let k = 0; k < entry.w && [...Array(fw).keys()].some(i => stairCols.has(fx0 + i)); k++) fx0 = entry.x + ((fx0 - entry.x + 1) % Math.max(1, entry.w - fw + 1));
  const front = { x: fx0, w: fw, y: frontY };
  levels.forEach(L => genOpenings(r, L, F, L.stairs, L.level === 0 ? front : null));
  const overlap = levels.some(L => { const seen = new Set(); return (L.stairs || []).some(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) { const k = x + "," + y; if (seen.has(k)) return true; seen.add(k); } return false; }); });
  const ok = !overlap && stairs.length === Math.max(0, floors - 1) + (cellar ? 1 : 0) && levels.every(L => genReachable(L, F, L.level === 0 ? front : null));
  // The unusual rooms that made it in (one upstairs needs an upstairs, one below a cellar).
  const placed = [...new Set(levels.flatMap(L => L.rooms.filter(x => x.rare).map(x => x.n)))];
  // How fine the front door is: a plain door for a small cottage or shop, a framed one for a solid house, a grand entrance
  // with pillars for a big house, a large tavern, a guild hall or a temple.
  const doorScore = ({ small: 0, medium: 1, large: 2 })[o.size] ?? 1, doorBonus = ({ guild: 1, temple: 1, tavern: 0.5, blacksmith: -0.5, tailor: -0.5, general: -0.5 })[T.id] || 0;
  const doorTier = doorScore + doorBonus >= 2 ? "grand" : doorScore + doorBonus >= 1 ? "framed" : "plain";
  return { type: T.id, W: F.W, H: F.H, F, floors, cellar, stairs, levels, rare: placed, doorTier, ok, attempt };
}
// The squares you step onto and off a run of stairs on floor L: beyond its foot (the end opposite the one you walk toward).
// ok when each is a floor square in the same room as the stairs' end, and not on any stairs.
function genStairEntry(L, t) {
  const roomAt = (x, y) => L.rooms.findIndex(rm => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h);
  const onStairs = (x, y) => (L.stairs || []).some(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
  const along = t.w >= t.h, toB = t.toward === "b", sq = [];
  if (along) for (let y = t.y; y < t.y + t.h; y++) sq.push(toB ? [t.x - 1, y, t.x, y] : [t.x + t.w, y, t.x + t.w - 1, y]);
  else for (let x = t.x; x < t.x + t.w; x++) sq.push(toB ? [x, t.y - 1, x, t.y] : [x, t.y + t.h, x, t.y + t.h - 1]);
  const ok = sq.every(([x, y, ex, ey]) => { const i = roomAt(x, y); return i >= 0 && !L.rooms[i].porch && i === roomAt(ex, ey) && !onStairs(x, y); });
  return { ok, cells: sq.map(([x, y]) => x + "," + y) };
}
// Can everything on floor L be reached on foot without crossing any stairs? From the front door (ground floor) or the foot of
// the stairs arriving from below: every room, both sides of every door, and the squares at the foot and head of every stair.
function genReachable(L, F, front) {
  const W = F.W, H = F.H, own = L.own, stair = new Set(); (L.stairs || []).forEach(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) stair.add(x + "," + y); });
  const porch = i => i >= 0 && L.rooms[i].porch, pass = (x, y) => own(x, y) >= 0 && !stair.has(x + "," + y);
  const canStep = (x, y, nx, ny, key) => { if (!pass(nx, ny)) return false; const a = own(x, y), b = own(nx, ny); return a === b || L.doors.has(key) || (porch(a) && porch(b)) || genOpen(L.rooms[a], L.rooms[b]); };
  let start = null, more = [];
  if (front && front.w) start = [front.x, front.y - 1];
  else if (L.level > 0 && (L.stairs || []).filter(t => t.dir === "down").length > 1) { // separate upper parts, each with its own stairs (a manor's solar and service chambers)
    const cs = (L.stairs || []).filter(t => t.dir === "down").map(t => genStairEntry(L, t)); if (cs.some(e => !e.ok)) return false;
    [start, ...more] = cs.map(e => e.cells[0].split(",").map(Number)); }
  else { const arr = (L.stairs || []).find(t => t.dir === "down") || (L.stairs || [])[0]; if (arr) { const e = genStairEntry(L, arr); if (!e.ok) { if (typeof window !== "undefined" && window.GEN_WHY) window.GEN_WHY.push(L.level + ":arrive"); return false; } start = e.cells[0].split(",").map(Number); } }
  if (!start) return true;
  if (!pass(start[0], start[1])) { if (typeof window !== "undefined" && window.GEN_WHY) window.GEN_WHY.push(L.level + ":start"); return false; }
  const seen = new Set([start.join(","), ...more.map(m => m.join(","))]), q = [start, ...more];
  while (q.length) { const [x, y] = q.shift();
    for (const [nx, ny, key] of [[x, y - 1, `h,${x},${y}`], [x, y + 1, `h,${x},${y + 1}`], [x - 1, y, `v,${x},${y}`], [x + 1, y, `v,${x + 1},${y}`]]) {
      const k = nx + "," + ny; if (seen.has(k) || !canStep(x, y, nx, ny, key)) continue; seen.add(k); q.push([nx, ny]); } }
  const roomOk = L.rooms.every((rm, i) => { for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) if (seen.has(x + "," + y)) return true; return false; });
  const stairsOk = (L.stairs || []).every(t => { const e = genStairEntry(L, t); return e.ok && e.cells.every(c => seen.has(c)); });
  const doorsOk = [...L.doors].every(k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); const [a, b] = d === "h" ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]];
    return [a, b].every(([cx, cy]) => own(cx, cy) < 0 || seen.has(cx + "," + cy)); });
  if (typeof window !== "undefined" && window.GEN_WHY) window.GEN_WHY.push(L.level + ":" + (roomOk ? "" : "room ") + (stairsOk ? "" : "stairs ") + (doorsOk ? "" : "door"));
  return roomOk && stairsOk && doorsOk;
}
// Fireplaces: the rooms that would have a fire get a hearth against a wall, an outside wall if they can (that's where the
// chimney goes), or back to back with a neighbour's fire so the two share a stack. A stack rises through every floor above
// (a flue on floors that don't use it, a fireplace on ones that do) and comes out of the roof as a chimney.
const GEN_FIRE = { kitchen: 1, forge: 1, tavern: 1, living: 0.9, hall: 0.8, library: 0.5, meet: 0.5, work: 0.4, office: 0.3, bed: 0.35, sanctum: 0.2 };

// ===== Village buildings, laid out in bays =====
// After the research: a medieval building is a row of bays (frame to frame, about 15 ft: 3 squares here) a set depth deep,
// and its rooms are whole bays (or a bay split front and back). Plans are linear: a cottage is chamber | hall | service; a
// farm longhouse is inner room | hall | cross-passage (a door at each end) | byre for the cattle; a manor is solar wing | open
// hall | screens passage | buttery and pantry, with the kitchen behind; a barn is bays either side of a threshing floor
// between big opposed doors; a stable is stalls open to an aisle; a chapel a nave with a narrower chancel beyond.
// Upper floors are only over some bays (a loft over the chamber, the solar over the parlour) — the hall stays open to the
// roof — each reached by its own stairs.
// A unit (bay or run of bays): { len, rooms: [front … back], split: "depth" | "length", entry (the front door), pass (a
// door straight through to the back too), doorW, doorAt: "start", endDoor: "left" | "right", back (extra depth behind: a
// cross-wing), inset: [top, bottom] (a narrower unit: a chancel), up: [rooms over it], upJoin (one loft with the last unit),
// porch: [w, h] }. A room's zone + hub: rooms of one zone have no wall between a hub and the rest (stalls open to the aisle,
// the bays of a barn). dark: no windows.
const genU = (len, rooms, extra) => Object.assign({ len, rooms: Array.isArray(rooms) ? rooms : [rooms] }, extra || {});
const genR = (n, k, extra) => Object.assign({ n, k, w: 1 }, extra || {});
const GEN_VILLAGE = [
  { id: "cottage", name: "Cottage", icon: "🛖", group: "village", blurb: "A peasant's home: one open room round the hearth, or a hall with a chamber and a service end, sometimes a loft.",
    cellar: 0.03, porch: 0.15, floorsMax: 2, doorBonus: -1, under: [{ n: "Root cellar", k: "cellar", w: 1 }],
    plan(r, size, up) { const D = size === "small" ? genInt(r, 3, 4) : genInt(r, 4, 5);
      if (size === "small") { const u = [genU(genInt(r, 4, 5), genR("Cottage", "living", { openHearth: 1 }), { entry: 1 })]; if (r() < 0.5) u.push(genU(genInt(r, 2, 3), genR("Inner room", "store"), up ? { up: [genR("Sleeping loft", "bed")] } : {})); return { D, units: u, name: u.length > 1 ? "Two-room cottage" : "One-room cottage" }; }
      const loft = up ? { up: [genR("Sleeping loft", "bed")] } : {};
      if (size === "medium") return { D, name: "Three-bay cottage", units: [genU(genInt(r, 3, 4), genR("Chamber", "bed"), loft), genU(genInt(r, 4, 5), genR("Hall", "living", { openHearth: 1 }), { entry: 1 }), genU(3, genR("Service room", "store"))] };
      return { D, name: "Cross-passage cottage", units: [genU(genInt(r, 3, 4), genR("Chamber", "bed"), loft), genU(genInt(r, 4, 6), genR("Hall", "living", { openHearth: 1 })), genU(2, genR("Cross-passage", "passage"), { entry: 1, pass: 1 }), genU(3, [genR("Buttery", "store"), genR("Pantry", "store")])] }; } },
  { id: "farmhouse", name: "Farmhouse", icon: "🐄", group: "village", blurb: "A longhouse: family at one end, cattle at the other, a cross-passage between with a door each side.",
    cellar: 0.05, porch: 0.3, floorsMax: 2, doorBonus: -0.5, under: [{ n: "Cellar", k: "cellar", w: 1 }],
    plan(r, size, up) { const D = genInt(r, 4, 5), bays = { small: 2, medium: 3, large: 4 }[size] || 3;
      const inner = size === "large" ? [genR("Inner room", "bed"), genR("Dairy", "store")] : [genR("Inner room", "bed")];
      return { D, name: "Longhouse", units: [genU(genInt(r, 3, 4), inner, up ? { up: [genR("Chamber", "bed")] } : {}), genU(genInt(r, 4, 6), genR("Hall", "living", { openHearth: 1 })),
        genU(2, genR("Cross-passage", "passage"), { entry: 1, pass: 1, porch: r() < 0.3 ? [2, 2] : null }), genU(bays * 2 + genInt(r, 0, 2), genR("Byre", "byre", { dark: 1 }), Object.assign({ endDoor: "right" }, up && size !== "small" ? { up: [genR("Hayloft", "hay")] } : {}))] }; } },
  { id: "barn", name: "Barn", icon: "🌾", group: "village", blurb: "Bays for corn and hay either side of a threshing floor, with big double doors on both sides for the wagons and the draught.",
    cellar: 0, porch: 0, floorsMax: 1, doorBonus: -2,
    plan(r, size) { const D = { small: 5, medium: 6, large: 7 }[size] || 6, bays = { small: 2, medium: 4, large: 6 }[size] || 4, two = size === "large" && r() < 0.6;
      const bay = i => genR(["Corn bay", "Hay bay", "Straw bay", "Corn bay"][i % 4], "hay", { zone: "barn", hub: 1, dark: 1 }), thresh = () => genR("Threshing floor", "threshing", { zone: "barn", hub: 1, dark: 1 });
      const units = [], half = two ? [2, 2, 2] : [Math.ceil(bays / 2), Math.floor(bays / 2)]; let n = 0;
      half.forEach((k, i) => { for (let j = 0; j < k; j++) units.push(genU(3, bay(n++))); if (i < half.length - 1) units.push(genU(3, thresh(), { entry: units.every(u => !u.entry) ? 1 : 0, pass: 1, doorW: 2, threshing: 1, porch: r() < 0.5 ? [3, 2] : null })); });
      if (r() < 0.5) units[units.length - 1].rooms = [genR("Cattle bay", "byre", { zone: "barn", hub: 1, dark: 1 })];
      return { D, name: two ? "Two-threshing-floor barn" : "Threshing barn", units }; } },
  { id: "stable", name: "Stable", icon: "🐎", group: "village", blurb: "Stalls open onto an aisle, a tack room and a feed store at the ends, a hayloft above.",
    cellar: 0, porch: 0, floorsMax: 2, doorBonus: -1,
    plan(r, size, up) { const n = { small: 3, medium: 3, large: 5 }[size] || 3, double = size !== "small";
      const stall = () => genR("Stall", "stall", { zone: "st", dark: 1, openY: 1 }), aisle = () => genR("Aisle", "aisle", { zone: "st", hub: 1 });
      const D = double ? 6 : 4, units = [genU(3, double ? [genR("Tack room", "store"), genR("Groom's room", "bed")] : genR("Tack room", "store"))];
      const mid = Math.floor(n / 2);
      for (let i = 0; i < n; i++) { units.push(genU(2, double ? [stall(), aisle(), stall()] : [aisle(), stall()], { sizes: double ? [2, 2, 2] : [2, 2] }));
        if (double && i === mid - 1) units.push(genU(2, [aisle()], { entry: 1, doorW: 2 })); }
      if (!double) units[1 + mid].entry = 1, units[1 + mid].doorW = 2;
      units.push(genU(3, genR("Feed store", "store")));
      if (up) { units.forEach(u => { u.upJoin = 1; }); units[0].up = double ? [genR("Groom's loft", "bed"), genR("Feed loft", "hay")] : [genR("Hayloft", "hay")]; units[0].landName = "Hayloft"; }
      return { D, name: double ? "Double-row stable" : "Single-row stable", units }; } },
  { id: "mill", name: "Mill", icon: "⚙", group: "village", blurb: "A watermill: the wheel pit at the end, the millstones and grain store, the miller's house alongside.",
    cellar: 0, porch: 0.2, floorsMax: 2, doorBonus: -0.5,
    plan(r, size, up) { const D = genInt(r, 5, 6), big = size !== "small";
      const units = [genU(2, genR("Wheel pit", "water", { dark: 1 })), genU(genInt(r, 4, 5), genR("Mill room", "mill"), Object.assign({ entry: 1, doorW: big ? 2 : 1 }, up ? { up: [genR("Stone floor", "mill"), genR("Bin loft", "hay")] } : {})),
        genU(3, big ? [genR("Grain store", "store"), genR("Sack store", "store")] : genR("Grain store", "store"), up ? { upJoin: 1 } : {})];
      units.push(genU(genInt(r, 4, 5), big ? [genR("Miller's hall", "living", { openHearth: 1, w: 1.8 }), genR("Kitchen", "kitchen")] : genR("Miller's room", "living"), up && big ? { up: [genR("Miller's chamber", "bed"), genR("Bedroom", "bed")] } : {}));
      return { D, name: "Watermill", units }; } },
  { id: "bakehouse", name: "Bakehouse", icon: "🍞", group: "village", blurb: "A great oven, a kneading room and a flour store, the baker living above.",
    cellar: 0.2, porch: 0.3, floorsMax: 2, doorBonus: -0.5, under: [{ n: "Cellar", k: "cellar", w: 1 }],
    plan(r, size, up) { const D = genInt(r, 4, 5), units = [];
      units.push(genU(genInt(r, 4, 5), size === "large" ? [genR("Bread shop", "shop"), genR("Oven room", "bake")] : genR("Oven room", "bake"), { entry: 1 }));
      units.push(genU(3, genR("Kneading room", "work"), up && size !== "small" ? { up: [genR("Baker's room", "bed"), genR("Living room", "living")] } : {}));
      units.push(genU(size === "small" ? 2 : 3, size === "small" ? genR("Flour store", "store") : [genR("Flour store", "store"), genR("Woodstore", "store")], up && size !== "small" ? { upJoin: 1 } : {}));
      if (r() < 0.2) units.push(genU(3, genR("Brewhouse", "kitchen")));
      return { D, name: "Bakehouse", units }; } },
  { id: "chapel", name: "Chapel / shrine", icon: "🕯", group: "village", blurb: "A wayside shrine, or a two-cell chapel: a nave for the village and a narrower chancel for the altar.",
    cellar: 0.1, porch: 0.6, floorsMax: 1, doorBonus: 0, under: [{ n: "Crypt", k: "vault", w: 1 }],
    plan(r, size) { if (size === "small") { const u = [genU(genInt(r, 3, 4), genR("Shrine", "sanctum"), { entry: 1 })]; if (r() < 0.4) u.push(genU(2, genR("Hermit's cell", "bed"))); return { D: 3, name: "Wayside shrine", units: u }; }
      const D = size === "large" ? genInt(r, 5, 6) : genInt(r, 4, 5), nave = size === "large" ? genInt(r, 8, 10) : genInt(r, 6, 8), cl = genInt(r, 3, 4);
      const units = [genU(nave, genR("Nave", "temple"), { entry: 1, doorAt: "start", porch: r() < 0.7 ? [2, 2] : null })];
      units.push(size === "large" && r() < 0.7 ? genU(cl, [genR("Chancel", "sanctum"), genR("Vestry", "store")], { inset: [0, 1], sizes: [D - 3, 2] }) : genU(cl, genR("Chancel", "sanctum"), { inset: [1, 1] }));
      return { D, name: "Two-cell chapel", units }; } },
  { id: "manor", name: "Manor house", icon: "🏰", group: "village", blurb: "The lord's house: an open great hall, the solar wing at the high end, buttery, pantry and kitchen beyond the screens passage.",
    cellar: 0.3, porch: 0.5, floorsMax: 2, doorBonus: 1, under: [{ n: "Undercroft", k: "cellar", w: 1.4 }, { n: "Wine cellar", k: "cellar", w: 1, opt: 0.5 }],
    plan(r, size, up) { const D = size === "small" ? 5 : genInt(r, 5, 6), wing = size === "small" ? 0 : genInt(r, 3, 4);
      const solar = up ? { up: size === "large" ? [genR("Solar", "bed"), genR("Great chamber", "living"), genR("Garderobe", "privy")] : [genR("Solar", "bed"), genR("Garderobe", "privy")] } : {};
      const units = [genU(genInt(r, 4, 5), wing ? [genR("Parlour", "living"), r() < 0.35 ? genR("Chapel", "sanctum") : genR("Study", "library")] : genR("Parlour", "living"), Object.assign({ back: wing }, solar)),
        genU(size === "large" ? genInt(r, 7, 9) : genInt(r, 5, 7), genR("Hall", "hall", r() < 0.5 ? { openHearth: 1 } : {})),
        genU(2, genR("Screens passage", "passage"), { entry: 1, pass: 1, porch: r() < 0.6 ? [2, 2] : null })];
      const svc = size === "small" ? [genR("Buttery", "store"), genR("Pantry", "store")] : [genR("Buttery", "store"), genR("Pantry", "store"), genR("Kitchen", "kitchen")];
      units.push(genU(genInt(r, 3, 4), svc, Object.assign({ back: size === "small" ? 0 : wing + 1 }, up ? { up: [genR("Chamber", "bed"), genR("Steward's room", "office")] } : {})));
      if (size === "small") units.push(genU(3, genR("Kitchen", "kitchen")));
      return { D, name: wing ? "Hall house with cross-wings" : "Hall house", units }; } },
];
GEN_BUILDINGS.push(...GEN_VILLAGE);
// ===== Town buildings, laid out in bays like the village ones =====
// From the research on medieval towns: most of a town was burgage houses, narrow to the street and deep, shop in front, hall
// and kitchen behind, chambers over, a side passage to the yard; the market house was an open arcade on posts with the court
// or council room above; a courtyard inn was entered through a carriage way into a yard with the lodgings round it; a
// merchant's house had its shop and counting house to the street, an open hall with chamber blocks each end and a vaulted
// undercroft for the goods; a town gate a vaulted passage between guard towers with the portcullis chamber over the arch.
const GEN_TOWN = [
  { id: "townhouse", name: "Townhouse", icon: "🏘", blurb: "A burgage house: narrow to the street and deep, the shop at the front, the hall and kitchen behind, chambers above, often a side passage through to the yard.",
    cellar: 0.35, porch: 0, floorsMax: 2, doorBonus: -0.5, under: [{ n: "Undercroft", k: "cellar", w: 1 }],
    plan(r, size, up) { const w0 = size === "small" ? genInt(r, 3, 4) : size === "large" ? genInt(r, 5, 6) : genInt(r, 4, 5);
      if (size === "small") return { D: genInt(r, 6, 7), name: "Shop and chamber", units: [genU(w0, [genR("Shop", "shop"), genR("Living room", "living", { w: 1.2 })], Object.assign({ entry: 1 }, up ? { up: [genR("Chamber", "bed")] } : {}))] };
      const D = size === "large" ? genInt(r, 10, 12) : genInt(r, 8, 10), side = r() < 0.6;
      const rooms = size === "large" ? [genR("Shop", "shop"), genR("Hall", "living", { w: 1.4 }), genR("Kitchen", "kitchen")] : [genR("Shop", "shop"), genR("Hall", "living", { w: 1.3 }), genR("Kitchen", "kitchen", { w: 0.8 })];
      const units = [genU(w0, rooms, Object.assign({ entry: 1 }, up ? { up: size === "large" ? [genR("Great chamber", "bed"), genR("Chamber", "bed"), genR("Chamber", "bed")] : [genR("Chamber", "bed"), genR("Chamber", "bed")] } : {}))];
      if (side) units.push(genU(2, genR("Side passage", "passage"), Object.assign({ pass: 1 }, up ? { upJoin: 1 } : {})));
      return { D, name: side ? "Burgage house with side passage" : "Burgage house", units }; } },
  { id: "merchant", name: "Merchant's house", icon: "💰", blurb: "The shop and counting house to the street, an entry passage, an open hall, chamber blocks above either end, and a vaulted undercroft for the goods.",
    cellar: 0.85, porch: 0.2, floorsMax: 2, doorBonus: 1, under: [{ n: "Undercroft", k: "vault", w: 1.6 }, { n: "Wine cellar", k: "cellar", w: 1, opt: 0.6 }],
    plan(r, size, up) { const D = size === "small" ? genInt(r, 6, 7) : genInt(r, 7, 8);
      const units = [genU(genInt(r, 4, 5), [genR("Shop", "shop"), genR("Counting house", "office")], up ? { up: [genR("Solar", "bed"), genR("Chamber", "bed")] } : {}),
        genU(2, genR("Entry passage", "passage"), { entry: 1, pass: 1, porch: r() < 0.3 ? [2, 2] : null }),
        genU(size === "large" ? genInt(r, 6, 7) : genInt(r, 4, 6), genR("Hall", "hall")),
        genU(genInt(r, 3, 4), size === "small" ? genR("Parlour", "living") : [genR("Parlour", "living"), genR("Buttery", "store")], up ? { up: size === "small" ? [genR("Chamber", "bed")] : [genR("Chamber", "bed"), genR("Clerk's room", "office")] } : {})];
      if (size !== "small") units.push(genU(genInt(r, 3, 4), [genR("Kitchen", "kitchen"), genR("Warehouse", "store", { w: 1.3 })], { back: size === "large" ? genInt(r, 3, 4) : 0 }));
      return { D, name: "Merchant's hall house", units }; } },
  { id: "inn", name: "Inn", icon: "🛏", blurb: "A courtyard inn: a carriage way from the street into the yard, the tap room on the front, kitchen and stables in the wings round the yard, guest chambers above.",
    cellar: 0.5, porch: 0, floorsMax: 2, doorBonus: 0.5, under: [{ n: "Beer cellar", k: "cellar", w: 1.4 }, { n: "Wine cellar", k: "cellar", w: 1, opt: 0.5 }],
    plan(r, size, up) { const D = genInt(r, 5, 6), wb = size === "small" ? 0 : genInt(r, 5, 7);
      const ch = (n, best) => Array.from({ length: n }, (_, i) => genR(i === 0 && best ? "Best chamber" : "Guest chamber", "bed"));
      const units = [genU(genInt(r, 4, 5), wb ? [genR("Parlour", "living"), genR("Kitchen", "kitchen", { w: 1.3 }), genR("Buttery", "store")] : [genR("Parlour", "living"), genR("Kitchen", "kitchen")], Object.assign({ back: wb }, up ? { up: ch(wb ? 3 : 2, 0), landName: "Gallery" } : {})),
        genU(size === "large" ? genInt(r, 7, 9) : genInt(r, 5, 7), genR("Tap room", "tavern"), Object.assign({ entry: 1 }, up ? { up: ch(size === "large" ? 4 : 3, 1), landName: "Gallery" } : {})),
        genU(3, genR("Carriage way", "passage", { gate: 1 }), Object.assign({ pass: 1, doorW: 3 }, up ? { upJoin: 1 } : {})),
        genU(genInt(r, 4, 5), wb ? [genR("Ostler's room", "bed"), genR("Stables", "stall", { w: 1.6 }), genR("Hay store", "hay")] : genR("Stables", "stall"), Object.assign({ back: wb }, up ? { up: [genR("Groom's room", "bed"), genR("Feed loft", "hay")], landName: "Hayloft" } : {}))];
      return { D, name: wb ? "Courtyard inn" : "Wayside inn", units }; } },
  { id: "markethall", name: "Market hall", icon: "⚖", blurb: "An open arcade on posts for the market stalls, the toll booth and its stair at one end, the court or council room above.",
    cellar: 0, porch: 0, floorsMax: 2, doorBonus: 0,
    plan(r, size, up) { const D = size === "small" ? genInt(r, 4, 5) : genInt(r, 5, 6), n = { small: 2, medium: 3, large: 4 }[size] || 3;
      const units = [genU(3, genR("Toll booth", "office"), Object.assign({ entry: 1 }, up ? { upSlice: 1, up: size === "small" ? [genR("Court room", "hall")] : size === "medium" ? [genR("Council chamber", "office"), genR("Court room", "hall", { w: 3 })] : [genR("Council chamber", "office"), genR("Court room", "hall", { w: 3 }), genR("Muniment room", "loft", { w: 0.8 })] } : {}))];
      for (let i = 0; i < n; i++) units.push(genU(genInt(r, 3, 4), genR("Market arcade", "market", { zone: "mk", hub: 1, arcade: 1 }), up ? { upJoin: 1 } : {}));
      return { D, name: up ? "Market house" : "Market shed", units }; } },
  { id: "gatehouse", name: "Gatehouse", icon: "🏯", blurb: "The town gate: a vaulted gate passage between two guard towers, the porter's lodge, and the portcullis chamber over the arch.",
    cellar: 0.2, porch: 0, floorsMax: 2, doorBonus: 2, under: [{ n: "Lock-up", k: "cellar", w: 1 }],
    plan(r, size, up) { const D = size === "small" ? genInt(r, 4, 5) : genInt(r, 5, 6), tw = size === "large" ? genInt(r, 4, 5) : genInt(r, 3, 4), gw = size === "large" ? 5 : 4, back = size === "small" ? 0 : genInt(r, 1, 2);
      const units = [genU(tw, size === "small" ? genR("Guard room", "work") : [genR("Guard room", "work"), genR("Armoury", "store")], Object.assign({ back }, up ? { up: [genR("Portcullis chamber", "work", { w: 1.4 }), genR("Guard chamber", "bed"), genR("Captain's room", "office")] } : {})),
        genU(gw, genR("Gate passage", "passage", { dark: 1, gate: 1 }), Object.assign({ entry: 1, pass: 1, doorW: gw }, up ? { upJoin: 1 } : {})),
        genU(tw, genR("Porter's lodge", "living"), Object.assign({ back }, up ? { upJoin: 1 } : {}))];
      return { D, name: "Gate between towers", units }; } },
  { id: "butcher", name: "Butcher", icon: "🥩", blurb: "A shambles shop: the open-fronted shop with its stall board, the cutting room, the salting room and the slaughterhouse at the back, a passage through to the yard.",
    cellar: 0.25, porch: 0, floorsMax: 2, doorBonus: -1, under: [{ n: "Cold cellar", k: "cellar", w: 1 }],
    plan(r, size, up) { const D = size === "small" ? genInt(r, 7, 8) : genInt(r, 8, 10), w0 = size === "large" ? genInt(r, 5, 6) : genInt(r, 4, 5);
      const rooms = size === "small" ? [genR("Butcher's shop", "shop", { w: 1.2 }), genR("Slaughterhouse", "slaughter", { w: 1.2 })] : [genR("Butcher's shop", "shop", { w: 1.6 }), genR("Cutting room", "work"), genR("Salting room", "store", { w: 0.7 }), genR("Slaughterhouse", "slaughter", { w: 1.3 })];
      const units = [genU(w0, rooms, Object.assign({ entry: 1, doorW: 2 }, up ? { up: [genR("Living room", "living"), genR("Chamber", "bed")] } : {})), genU(2, genR("Yard passage", "passage"), Object.assign({ pass: 1 }, up ? { upJoin: 1 } : {}))];
      return { D, name: "Shambles shop", units }; } },
  { id: "apothecary", name: "Apothecary", icon: "⚗", blurb: "The shop with its jars and counter at the front, the still room behind where the medicines are made, a store and grinding room, herbs drying in the loft.",
    cellar: 0.3, porch: 0.1, floorsMax: 2, doorBonus: 0, under: [{ n: "Cool store", k: "cellar", w: 1 }],
    plan(r, size, up) { const D = size === "small" ? genInt(r, 6, 7) : genInt(r, 7, 9), w0 = genInt(r, 4, 5);
      const units = [genU(w0, size === "small" ? [genR("Apothecary's shop", "shop", { w: 1.2 }), genR("Still room", "lab")] : [genR("Apothecary's shop", "shop", { w: 1.2 }), genR("Still room", "lab", { w: 1.1 }), genR("Store", "store", { w: 0.7 })], Object.assign({ entry: 1 }, up ? { up: [genR("Drying loft", "loft"), genR("Apothecary's chamber", "bed")] } : {}))];
      if (size !== "small") units.push(genU(genInt(r, 3, 4), [genR("Grinding room", "work"), size === "large" ? genR("Study", "library") : genR("Kitchen", "kitchen")], up ? { upJoin: 1 } : {}));
      return { D, name: "Apothecary's shop", units }; } },
  { id: "carpenter", name: "Carpenter", icon: "🪚", blurb: "A carpenter's shop: the big workshop with wide doors for the timber, an open saw shed for sawing on trestles, the timber store, the family's rooms at the end.",
    cellar: 0.05, porch: 0, floorsMax: 2, doorBonus: -1,
    plan(r, size, up) { const D = genInt(r, 5, 6);
      const units = [genU(genInt(r, 3, 4), size === "small" ? genR("Living room", "living") : [genR("Hall", "living"), genR("Kitchen", "kitchen")], up ? { up: [genR("Chamber", "bed"), genR("Chamber", "bed")] } : {}),
        genU(size === "large" ? genInt(r, 6, 8) : genInt(r, 5, 6), genR("Workshop", "work"), Object.assign({ entry: 1, doorW: 2 }, up && size !== "small" ? { up: [genR("Timber loft", "loft")] } : {})),
        genU(3, genR("Timber store", "store"), { endDoor: size === "small" ? "right" : null })];
      if (size !== "small") units.push(genU(genInt(r, 3, 4), genR("Saw shed", "work", { arcade: 1 })));
      return { D, name: "Carpenter's shop", units }; } },
  { id: "workshop", name: "Workshop", icon: "🔨", blurb: "A craftsman's shop-house (cooper, cobbler, weaver, potter, chandler, goldsmith and more): the shop at the front, the workroom behind, the family above.",
    cellar: 0.15, porch: 0, floorsMax: 2, doorBonus: -0.5, under: [{ n: "Cellar", k: "cellar", w: 1 }],
    plan(r, size, up) { const T = [["Cooper", "Cooperage", "Stave store"], ["Cobbler", "Cobbling room", "Leather store"], ["Weaver", "Loom room", "Yarn store"], ["Potter", "Kiln room", "Clay store"], ["Chandler", "Dipping room", "Tallow store"], ["Goldsmith", "Goldsmith's workroom", "Strong room"], ["Glover", "Glove room", "Skin store"], ["Bowyer", "Bow room", "Stave store"], ["Wheelwright", "Wheel shop", "Timber store"], ["Cutler", "Grinding room", "Store"]];
      const [who, work, store] = T[Math.floor(r() * T.length)], D = size === "small" ? genInt(r, 6, 7) : genInt(r, 7, 9), w0 = size === "large" ? genInt(r, 5, 6) : genInt(r, 4, 5);
      const units = [genU(w0, size === "small" ? [genR(`${who}'s shop`, "shop"), genR(work, "work", { w: 1.3 })] : [genR(`${who}'s shop`, "shop"), genR(work, "work", { w: 1.4 }), genR(store, "store", { w: 0.7 })], Object.assign({ entry: 1 }, up ? { up: [genR("Living room", "living"), genR("Chamber", "bed")] } : {}))];
      if (size === "large") units.push(genU(genInt(r, 3, 4), [genR("Hall", "living"), genR("Kitchen", "kitchen")], up ? { upJoin: 1 } : {}));
      else if (r() < 0.5) units.push(genU(2, genR("Side passage", "passage"), Object.assign({ pass: 1 }, up ? { upJoin: 1 } : {})));
      return { D, name: `${who}'s workshop`, units, trade: who }; } },
];
GEN_BUILDINGS.push(...GEN_TOWN);
// ===== City buildings, the same way =====
// From the research on medieval city buildings: a cathedral was a Latin cross, the west door into the nave between its aisles
// (open to it through the arcades), the crossing and the transepts, the choir behind its screen with aisles of its own, the
// presbytery and high altar, the Lady chapel at the east end, a vestry and a chapter house off the south side, a crypt below; a
// guildhall either a great hall on the ground with the council chamber at the high end and buttery and pantry beyond the
// screens (York Guildhall), or the hall upstairs over an undercroft used as the guild's hospital with its chapel at the end
// (the Merchant Adventurers'); a city house was a narrow tall tenement, shop and back shop on the street, hall and kitchen on
// the first floor, chambers over and garrets in the roof; a hospital one long hall of beds along the walls with the chapel open
// at its east end so the sick could see the altar (St Mary's, Chichester), men and women in twin wards on the big ones; an
// almshouse a row of rooms off a covered walk with a common hall and chapel; a gaol the keeper's house at the gate, the
// turnkey's lodge, wards for debtors, felons and women, cells and a dungeon below; a merchant's warehouse floor over floor with
// the counting house and the weighbeam by the door, and the Hanse's kontors a walled yard of warehouses, weigh house, counting
// houses and the merchants' lodgings; a mint its gate, melting house, coining house, assay office and treasury, the warden's
// lodging; a bathhouse (the stews) a changing room, the bath hall with its tubs, the sweating room next the furnace; a college
// a court entered through its gate tower, hall and kitchen down one side, the chapel down the other, chambers and the library
// over the front range.
const GEN_CITY = [
  { id: "cathedral", name: "Cathedral", icon: "⛪", group: "city", mirror: 1, blurb: "A cross plan: the west door into the nave and its lower aisles, west towers or not, the crossing (maybe under a tower) and the transepts with their chapels, the choir behind its screen, the presbytery and high altar, a Lady chapel or a row of chapels at the east end, a vestry and chapter house off one side, a crypt below.",
    cellar: 0.6, porch: 0.5, floorsMax: 1, doorBonus: 2, under: [{ n: "Crypt", k: "vault", w: 2 }, { n: "Ossuary", k: "vault", w: 0.6, opt: 0.5 }],
    plan(r, size) { const sm = size === "small", big = size === "large";
      const nw = sm ? 4 : genInt(r, 4, 5), aw = 3, tw = genInt(r, sm ? 3 : 4, sm ? 4 : 5), tb = sm ? 4 : genInt(r, 4, 5);
      const nave = sm ? genInt(r, 9, 13) : big ? genInt(r, 17, 22) : genInt(r, 13, 17), choir = sm ? genInt(r, 5, 7) : big ? genInt(r, 8, 11) : genInt(r, 6, 9), presb = genInt(r, 3, 4);
      const flat = !sm && r() < 0.35, lady = flat ? genInt(r, 3, 4) : sm ? (r() < 0.4 ? 3 : 0) : genInt(r, 3, 6), towers = r() < (sm ? 0.3 : 0.6), central = r() < 0.5;
      const D = nave + tb + choir + presb + lady, saint = () => genOne(r, GEN_SAINTS);
      const ch = h => Object.assign({ zone: "ch" }, h ? { hub: 1 } : { zdoor: 1 }), qu = h => Object.assign({ zone: "qu" }, h ? { hub: 1 } : { zdoor: 1 });
      // The aisles run from the west front (perhaps under a tower each) to the choir, or on to the east end past a row of chapels.
      const aisle = side => { const rooms = [], sz = [];
        if (towers) { rooms.push(genR(`${side}-west tower`, "tower", { tall: 2, fl: "Tower base" })); sz.push(aw); }
        rooms.push(genR(`${side} aisle`, "temple", Object.assign(ch(), { low: 1, fl: "Aisle" })), genR(`${side} transept`, "temple", Object.assign(ch(1), { fl: "Transept" })), genR(`${side} choir aisle`, "temple", Object.assign(qu(), { low: 1, fl: "Aisle" }))); sz.push(nave - (towers ? aw : 0), tb, choir + (flat ? presb : 0));
        if (flat) { rooms.push(genR(`Chapel of ${saint()}`, "sanctum", { low: 1, fl: "Chantry chapel" })); sz.push(lady); }
        return genU(aw, rooms, { inset: [flat ? 0 : presb + lady, 0], sizes: sz }); };
      const chapA = !sm && r() < 0.7 ? genInt(r, 3, 4) : 0, chapB = !sm && r() < 0.4 ? genInt(r, 3, 4) : 0, vs = 3;
      const armA = genU(tw, chapA ? [genR("North transept", "temple", Object.assign(ch(), { fl: "Transept" })), genR(`Chapel of ${saint()}`, "sanctum", { low: 1, fl: "Chantry chapel" })] : genR("North transept", "temple", Object.assign(ch(), { fl: "Transept" })), { inset: [D - nave - tb - chapA, nave], sizes: chapA ? [tb, chapA] : null });
      const sRooms = [genR("South transept", "temple", Object.assign(ch(), { fl: "Transept" }))], sSz = [tb]; if (chapB) { sRooms.push(genR(`Chapel of ${saint()}`, "sanctum", { low: 1, fl: "Chantry chapel" })); sSz.push(chapB); } sRooms.push(genR(genOne(r, ["Vestry", "Sacristy", "Treasury"]), "store", { low: 1 })); sSz.push(vs);
      const armB = genU(tw, sRooms, { inset: [D - nave - tb - sSz.slice(1).reduce((a, b) => a + b, 0), nave], sizes: sSz });
      const east = [genR("Nave", "temple", ch(1)), genR("Crossing", "temple", Object.assign(ch(1), central ? { tall: 2 } : {})), genR("Choir", "temple", qu(1)), genR("Presbytery", "sanctum", qu())].concat(lady ? [genR("Lady chapel", "sanctum")] : []);
      const units = [armA, aisle("North"), genU(nw, east, { entry: 1, doorW: nw >= 5 ? 3 : 2, porch: r() < 0.5 ? [3, 2] : null, sizes: [nave, tb, choir, presb].concat(lady ? [lady] : []) }), aisle("South"), armB];
      if (!sm && r() < 0.8) { const cw = genInt(r, 4, 6), extra = genInt(r, 1, 3), top = D - nave - tb - sSz.slice(1).reduce((a, b) => a + b, 0);
        units.push(genU(cw, r() < 0.5 ? [genR("Chapter house", "meet", { tall: 1 })] : [genR("Chapter vestibule", "passage", { low: 1 }), genR("Chapter house", "meet", { tall: 1 })], { inset: [Math.max(0, top - extra), nave + tb], sizes: null })); }
      return { D, name: sm ? "Minster church" : big ? "Great cathedral" : "Cathedral", units }; } },
  { id: "guildhall", name: "Guildhall", icon: "🏛", group: "city", mirror: 1, blurb: "The city's hall, three ways: a great hall on the ground with the council chamber at the high end and buttery and pantry past the screens; the hall upstairs over an undercroft, with the guild's chapel at the end; or the hall raised on posts over an open market. Maybe a lock-up, an armoury, the muniment room for the charters.",
    cellar: 0.5, porch: 0.4, floorsMax: 2, doorBonus: 2, under: [{ n: "Undercroft", k: "vault", w: 1.6 }, { n: "Strong room", k: "vault", w: 0.6, opt: 0.6 }],
    plan(r, size, up) { const sm = size === "small", big = size === "large", D = sm ? genInt(r, 5, 6) : genInt(r, 6, 8), council = genOne(r, ["Council chamber", "Aldermen's chamber", "Mayor's court"]);
      const v = up ? genInt(r, 0, sm ? 1 : 2) : 0;
      if (v === 1) { // the hall on posts over the market (the guildhall at Thaxted)
        const bays = sm ? 2 : big ? 4 : 3, units = [genU(4, [genR("Clerk's room", "office"), genR(genOne(r, ["Lock-up", "Weigh room", "Toll office"]), r() < 0.5 ? "cell" : "office", { dark: r() < 0.5 ? 1 : 0 })], { entry: 1,
          up: [genR("Great hall", "hall", { w: 3 }), genR(council, "office"), genR("Muniment room", "library", { w: 0.7 })], landName: "Stair head" })];
        for (let i = 0; i < bays; i++) units.push(genU(genInt(r, 3, 4), genR("Market arcade", "market", { arcade: 1, zone: "mk", hub: 1 }), { upJoin: 1 }));
        return { D, name: "Guildhall over a market", units }; }
      if (v === 2) { // the hall over an undercroft (the Merchant Adventurers' of York)
        const bays = big ? 4 : 3, units = [genU(4, [genR("Entrance hall", "living"), genR("Governor's parlour", "living")], { entry: 1, porch: r() < 0.5 ? [2, 2] : null, upSlice: 1,
          up: big ? [genR("Great hall", "hall", { w: 4 }), genR("Court room", "office", { w: 1.2 }), genR("Governor's chamber", "office")] : [genR("Great hall", "hall", { w: 3.5 }), genR("Court room", "office")] })];
        for (let i = 0; i < bays; i++) units.push(genU(genInt(r, 3, 5), genR(i === bays - 1 ? "Hospital" : "Undercroft", i === bays - 1 ? "ward" : "store", { zone: "uc", hub: 1 }), { upJoin: 1 }));
        if (r() < 0.8) units.push(genU(genInt(r, 4, 5), [genR("Chapel", "temple")], { inset: [1, r() < 0.5 ? 1 : 0] }));
        return { D, name: "Hall over an undercroft", units }; }
      const high = up ? { up: genShuf(r, [genR(council === "Mayor's court" ? "Mayor's parlour" : "Mayor's parlour", "living"), genR("Muniment room", "library"), genR("Chamberlain's office", "office"), genR("Exchequer", "office")]).slice(0, sm ? 2 : 3) } : {};
      const units = [genU(genInt(r, 4, 5), sm ? genR(council, "office") : genShuf(r, [genR(council, "office", { w: 1.4 }), genR(genOne(r, ["Inner chamber", "Robing room", "Recorder's room"]), "office")]), Object.assign({ back: !sm && r() < 0.6 ? genInt(r, 2, 4) : 0 }, high)),
        genU(sm ? genInt(r, 6, 7) : big ? genInt(r, 10, 13) : genInt(r, 8, 10), genR(sm ? "Common hall" : "Great hall", "hall")),
        genU(2, genR("Screens passage", "passage"), { entry: 1, pass: 1, porch: r() < 0.6 ? [2, 2] : null }),
        genU(4, sm ? genShuf(r, [genR("Buttery", "store"), genR("Pantry", "store")]) : [genR("Buttery", "store"), genR("Pantry", "store"), genR("Kitchen", "kitchen")], up ? { up: big ? [genR("Court room", "office"), genR("Jury room", "office")] : [genR(genOne(r, ["Clerk's room", "Court room", "Serjeants' room"]), "office"), genR("Store", "store", { w: 0.6 })] } : {})];
      if (r() < 0.45) units.push(genU(3, [genR(genOne(r, ["Lock-up", "Cage"]), "cell", { dark: 1 }), genR("Beadle's room", "office")]));
      if (big || r() < 0.3) units.push(genU(genInt(r, 4, 5), genR(genOne(r, ["Guild chapel", "Chapel"]), "temple"), { inset: [r() < 0.5 ? 1 : 0, 1] }));
      if (!sm && r() < 0.35) units.splice(1, 0, genU(3, [genR("Armoury", "store"), genR("Muniment room", "library")]));
      return { D, name: "Guildhall", units }; } },
  { id: "liveryhall", name: "Livery hall", icon: "🎖", group: "city", mirror: 1, blurb: "A craft guild's hall: the feast hall, the parlour where the master and wardens sit, the court room and the clerk's office, kitchen and buttery, round a yard or in a row, maybe an armoury and the plate room, and on some rooms for the guild's almsfolk.",
    cellar: 0.4, porch: 0.3, floorsMax: 2, doorBonus: 1.5, under: [{ n: "Wine cellar", k: "cellar", w: 1 }, { n: "Plate room", k: "vault", w: 0.5, opt: 0.6 }],
    plan(r, size, up) { const sm = size === "small", big = size === "large", D = sm ? genInt(r, 5, 6) : genInt(r, 6, 7);
      const wa = !sm && r() < 0.75 ? genInt(r, 3, 6) : 0, wb = !sm && r() < 0.6 ? genInt(r, 3, 6) : 0, parl = r() < 0.4 && up; // a back wing at either end, both, or none; the parlour downstairs or up
      const hi = [genR("Clerk's office", "office")].concat(parl ? [] : [genR("Parlour", "living", { w: 1.3 })]).concat(wa ? [genR(genOne(r, ["Court room", "Court parlour"]), "office", { w: 1.2 })] : []).concat(wa > 4 ? [genR("Plate room", "vault", { w: 0.6 })] : []);
      const units = [genU(genInt(r, 4, 5), hi.length > 1 ? hi : [hi[0], genR("Parlour", "living")], Object.assign({ back: wa }, up ? { up: (parl ? [genR("Great parlour", "living", { w: 1.5 })] : []).concat(genShuf(r, [genR("Master's chamber", "bed"), genR("Treasury", "office"), genR("Beadle's room", "bed"), genR("Armoury", "store")]).slice(0, parl ? 2 : 3)) } : {})),
        genU(sm ? genInt(r, 5, 6) : genInt(r, 7, 10), genR(genOne(r, ["Livery hall", "Common hall", "Feast hall"]), "hall")),
        genU(2, genR("Screens passage", "passage"), { entry: 1, pass: 1, porch: r() < 0.4 ? [2, 2] : null }),
        genU(genInt(r, 3, 4) + (wb ? 0 : 1), wb ? [genR("Buttery", "store"), genR("Pantry", "store"), genR("Kitchen", "kitchen", { w: 1.4 })].concat(wb > 4 ? [genR("Scullery", "kitchen", { w: 0.7 })] : []) : [genR("Buttery", "store"), genR("Kitchen", "kitchen")], Object.assign({ back: wb }, up ? { up: genShuf(r, [genR("Butler's room", "bed"), genR("Cook's room", "bed"), genR("Linen room", "store")]).slice(0, 2) } : {}))];
      if (big ? r() < 0.7 : !sm && r() < 0.25) { const n = genInt(r, 2, 4); for (let i = 0; i < n; i++) units.push(genU(3, [genR("Almsfolk's walk", "passage", { zone: "al", hub: 1, arcade: 1 }), genR("Almsfolk's room", "bed", { cub: 1 })], { sizes: [2, D - 2] })); }
      return { D, name: units.length > 4 ? "Livery hall with almshouses" : "Livery hall", units }; } },
  { id: "tenement", name: "Tall house", icon: "🏢", group: "city", mirror: 1, blurb: "A city tenement on a narrow plot, two to four storeys: a shop (whose depends on the street) and back shop on the street, hall and kitchen on the first floor, chambers over them, garrets in the roof; some with a side passage to the yard, some double-fronted round a stair hall, some let out as rooms floor by floor.",
    cellar: 0.5, porch: 0, floorsMax: 4, doorBonus: -0.5, under: [{ n: "Cellar", k: "cellar", w: 1 }, { n: "Coal hole", k: "cellar", w: 0.4, opt: 0.4 }],
    plan(r, size, up, fl) { const sm = size === "small", big = size === "large", nf = up ? (fl || genInt(r, sm ? 2 : 3, 4)) : 1, shop = () => genR(genOne(r, GEN_SHOPS), "shop");
      const floors = (list, u) => { if (nf < 2) return u; u.up = list[0]; if (nf > 2) u.up2 = list[1]; if (nf > 3) u.up3 = list[2]; return u; };
      const first = () => genOne(r, [[genR("Hall", "living", { w: 1.3 }), genR("Kitchen", "kitchen")], [genR("Kitchen", "kitchen"), genR("Hall", "living", { w: 1.3 })], [genR("Hall", "living", { w: 1.3 }), genR("Parlour", "living")], [genR("Solar", "living"), genR("Hall", "living", { w: 1.3 }), genR("Buttery", "store", { w: 0.6 })]]);
      const second = () => genOne(r, [[genR("Chamber", "bed"), genR("Chamber", "bed")], [genR("Great chamber", "bed", { w: 1.4 }), genR("Closet", "office", { w: 0.6 })], [genR("Chamber", "bed"), genR("Chamber", "bed"), genR("Wardrobe", "store", { w: 0.6 })], [genR("Best chamber", "bed", { w: 1.3 }), genR("Nursery", "bed")]]);
      const garret = () => genOne(r, [[genR("Garret", "bed")], [genR("Garret", "bed"), genR("Garret", "bed")], [genR("Servants' garret", "bed"), genR("Apprentices' garret", "bed")], [genR("Garret", "bed"), genR("Loft store", "loft", { w: 0.7 })]]);
      const ground = () => [shop()].concat(genOne(r, [[genR("Back shop", "work")], [genR("Workshop", "work"), genR("Store", "store", { w: 0.7 })], [genR("Counting room", "office"), genR("Warehouse", "store")], [genR("Back shop", "store"), genR("Kitchen", "kitchen")]]));
      const v = sm ? genInt(r, 0, 1) : big ? genInt(r, 2, 4) : genInt(r, 0, 3);
      if (v === 0) return { D: genInt(r, 6, 9), name: "Narrow tenement", units: [genU(genInt(r, 3, 5), ground(), floors([first(), second(), garret()], { entry: 1 }))] };
      if (v === 1 || v === 2) { const D = genInt(r, 7, 10); // with a side passage through to the yard
        const units = [genU(genInt(r, 4, 6), ground(), floors(v === 2 ? [first(), second(), garret()] : [first(), second(), garret()], { entry: 1 })), genU(2, genR(genOne(r, ["Side passage", "Entry", "Yard passage"]), "passage"), Object.assign({ pass: 1 }, nf > 1 ? { upJoin: 1 } : {}))];
        return { D, name: v === 2 ? "Merchant's tall house" : "Tall house", units }; }
      if (v === 3) { const D = genInt(r, 8, 10); // double-fronted round a stair hall
        const units = [genU(genInt(r, 4, 5), ground()), genU(3, [genR("Stair hall", "living"), genR("Counting house", "office")], floors([first().concat([genR("Parlour", "living")]), second().concat([genR("Chamber", "bed")]), garret().concat([genR("Garret", "bed")])], { entry: 1 })), genU(genInt(r, 4, 5), genOne(r, [[genR("Parlour", "living"), genR("Kitchen", "kitchen")], [shop(), genR("Back shop", "store")], [genR("Counting house", "office"), genR("Warehouse", "store")]]))];
        if (nf > 1) { const m = units[1]; units[0].up = m.up; units[0].up2 = m.up2; units[0].up3 = m.up3; ["up", "up2", "up3"].forEach(k => delete m[k]); m.upJoin = 1; units[2].upJoin = 1; }
        return { D, name: "Double-fronted house", units }; }
      const D = genInt(r, 8, 10), lodge = n => Array.from({ length: n }, (_, i) => genR(`Lodger's room ${i + 1}`, "bed", { fl: "Lodger's room" })); // let out as rooms
      const u = [genU(genInt(r, 4, 5), [shop(), genR("Back shop", "store")]), genU(2, genR("Entry", "passage"), { entry: 1 }), genU(genInt(r, 4, 5), [shop(), genR("Back shop", "store")])];
      if (nf > 1) { u[0].up = lodge(genInt(r, 2, 3)); if (nf > 2) u[0].up2 = lodge(genInt(r, 2, 3)); if (nf > 3) u[0].up3 = [genR("Garret", "bed"), genR("Garret", "bed")]; u[1].upJoin = 1; u[2].upJoin = 1; }
      return { D, name: "Tenement of lodgings", units: u }; } },
  { id: "hospital", name: "Hospital", icon: "⚕", group: "city", mirror: 1, blurb: "An infirmary hall with the beds along its walls and the chapel open at its east end so the sick can see the altar, in line or crossing the end as a T; an aisled hall on some, twin wards for men and women on others; the master's lodging, kitchen, and maybe an infirmarer's room and a mortuary.",
    cellar: 0.2, porch: 0.5, floorsMax: 2, doorBonus: 0.5, under: [{ n: "Cellar", k: "cellar", w: 1 }],
    plan(r, size, up) { const sm = size === "small", big = size === "large", D = sm ? genInt(r, 5, 6) : big ? genInt(r, 8, 10) : genInt(r, 6, 8), hl = sm ? genInt(r, 6, 8) : big ? genInt(r, 11, 15) : genInt(r, 8, 11);
      const inf = h => Object.assign({ zone: "inf" }, h ? { hub: 1 } : { zdoor: 1 });
      const ward = genInt(r, 0, D >= 8 ? 2 : 1), wards = ward === 1 ? [genR("Women's ward", "ward", inf()), genR("Men's ward", "ward", inf())]
        : ward === 2 ? [genR("South aisle", "ward", Object.assign(inf(), { low: 1, fl: "Infirmary aisle" })), genR("Infirmary hall", "ward", Object.assign(inf(1), { tall: 1 })), genR("North aisle", "ward", Object.assign(inf(), { low: 1, fl: "Infirmary aisle" }))] : genR("Infirmary hall", "ward", Object.assign(inf(), { tall: 1 }));
      const master = genU(genInt(r, 4, 5), sm ? [genR("Master's room", "living"), genR("Kitchen", "kitchen")] : genShuf(r, [genR("Master's hall", "living"), genR("Kitchen", "kitchen"), genR(genOne(r, ["Larder", "Infirmarer's room", "Apothecary"]), r() < 0.5 ? "store" : "office", { w: 0.7 })]), up ? { up: sm ? [genR("Master's chamber", "bed")] : genShuf(r, [genR("Master's chamber", "bed"), genR("Chaplain's chamber", "bed"), genR("Sisters' dormitory", "bed")]).slice(0, 2) } : {});
      const T = r() < 0.4, chap = T ? genU(genInt(r, 4, 5), genR("Chapel", "temple", inf(1)), { back: genInt(r, 2, 4) }) : genU(genInt(r, 4, 5), genR("Chapel", "temple", inf(1)), { inset: [1, 1] });
      const units = [master, genU(2, genR("Entry", "passage"), Object.assign({ entry: 1, pass: 1, porch: r() < 0.5 ? [2, 2] : null }, up ? { upJoin: 1 } : {})), genU(hl, wards), chap];
      if (!sm && r() < 0.7) units.splice(2, 0, genU(3, genShuf(r, [genR("Linen room", "store"), genR("Washhouse", "kitchen")]), up ? { upJoin: 1 } : {}));
      if (!T && (big || r() < 0.3)) units.push(genU(3, genR(genOne(r, ["Sacristy", "Mortuary", "Vestry"]), "store"), { inset: [2, 2] }));
      return { D, name: ward === 1 ? "Hospital with twin wards" : ward === 2 ? "Aisled hospital" : sm ? "Spital house" : "Hospital", units }; } },
  { id: "almshouse", name: "Almshouse", icon: "🏚", group: "city", mirror: 1, blurb: "Rooms for the old and poor, each off a covered walk: in a row with the common hall at one end and a chapel at the other, or the hall and chapel in the middle with rooms either side, or round three sides of a little court; on some the rooms go up two floors.",
    cellar: 0.05, porch: 0, floorsMax: 2, doorBonus: -0.5,
    plan(r, size, up) { const n = { small: 3, medium: 5, large: 7 }[size] || 5, D = genInt(r, 5, 6), v = genInt(r, 0, 2), two = up && r() < 0.5;
      const cell = (i, e) => genU(3, [genR("Covered walk", "passage", { zone: "al", hub: 1, arcade: 1 }), genR(r() < 0.5 ? "Almsman's room" : "Almswoman's room", "bed", { cub: 1 })], Object.assign({ sizes: [2, D - 2] }, e ? { entry: 1 } : {}));
      const hall = genU(genInt(r, 4, 5), genShuf(r, [genR("Common hall", "hall"), genR("Kitchen", "kitchen")]), up ? { up: [genR("Warden's chamber", "bed"), genR("Warden's room", "office")] } : {}), chapel = () => genU(genInt(r, 3, 4), genR("Chapel", "temple"), { inset: [1, 0] });
      let units;
      if (v === 1) { const a = Math.floor(n / 2); units = []; for (let i = 0; i < a; i++) units.push(cell(i)); units.push(Object.assign(hall, { entry: 1 })); if (r() < 0.6) units.push(genU(genInt(r, 3, 4), genR("Chapel", "temple"))); for (let i = a; i < n; i++) units.push(cell(i)); }
      else if (v === 2) { const back = genInt(r, 4, 7), k = Math.max(2, Math.floor((D + back) / 3)), wing = () => genU(3, Array.from({ length: k }, () => genR(r() < 0.5 ? "Almsman's room" : "Almswoman's room", "bed")), { back });
        units = [wing(), hall]; const mid = Math.max(1, n - 2); for (let i = 0; i < mid; i++) units.push(cell(i, i === Math.floor(mid / 2))); units.push(genU(genInt(r, 3, 4), genR("Chapel", "temple")), wing()); }
      else { const mid = Math.floor(n / 2); units = [hall]; for (let i = 0; i < n; i++) units.push(cell(i, i === mid)); units.push(chapel()); }
      if (two) { const first = units.findIndex(u => u.rooms.length === 2 && u.rooms[0].arcade); if (first >= 0 && !units[first].up) { units[first].up = Array.from({ length: Math.max(2, n - 1) }, () => genR("Upper room", "bed")); units[first].landName = "Upper gallery"; for (let i = first + 1; i < units.length && units[i].rooms[0].arcade; i++) units[i].upJoin = 1; } }
      return { D, name: v === 1 ? "Almshouse with hall in the middle" : v === 2 ? "Almshouse round a court" : "Almshouse row", units }; } },
  { id: "gaol", name: "Gaol", icon: "⛓", group: "city", mirror: 1, blurb: "The keeper's house, the turnkey's lodge, wards for debtors, felons and women, a passage of cells, a dungeon below; some built into a city gate with the wards over the arch; some a bridewell with a work room; the big ones with a chapel and the condemned hold.",
    cellar: 0.75, porch: 0, floorsMax: 2, doorBonus: 2, under: [{ n: "Dungeon", k: "cell", w: 1.6 }, { n: "Condemned hold", k: "cell", w: 0.7, opt: 0.6 }],
    plan(r, size, up) { const sm = size === "small", big = size === "large", D = sm ? genInt(r, 5, 6) : genInt(r, 6, 7), nc = { small: 2, medium: 3, large: 5 }[size] + genInt(r, 0, 1);
      if (up && !sm && r() < 0.35) { // the gaol in the gate (Newgate): lodges either side of the arch, the wards over it
        const units = [genU(genInt(r, 3, 4), [genR("Keeper's lodge", "office"), genR("Kitchen", "kitchen")], { up: genShuf(r, [genR("Felons' ward", "ward"), genR("Debtors' ward", "ward"), genR("Women's ward", "ward"), genR("Keeper's chamber", "bed")]).concat(big ? [genR("Chapel", "temple")] : []) }),
          genU(3, genR("Gate passage", "passage", { gate: 1, dark: 1 }), { pass: 1, doorW: 3, upJoin: 1 }), genU(genInt(r, 3, 4), [genR("Turnkey's lodge", "office"), genR("Press room", "cell", { dark: 1 })], { upJoin: 1, entry: 1 })];
        return { D, name: "Gate gaol", units }; }
      const bride = r() < 0.3, units = [genU(genInt(r, 4, 5), genShuf(r, [genR("Keeper's hall", "living"), genR("Kitchen", "kitchen")]), up ? { up: [genR("Keeper's chamber", "bed")].concat(genShuf(r, [genR("Master's-side room", "bed"), genR("Master's-side room", "bed"), genR("Turnkey's room", "bed")]).slice(0, 2)) } : {}),
        genU(3, [genR("Turnkey's lodge", "office"), genR("Strong room", "vault", { dark: 1, w: 0.6 })], { entry: 1 }),
        genU(sm ? 4 : genInt(r, 4, 6), sm ? genR(bride ? "Work room" : "Common ward", bride ? "work" : "ward") : genShuf(r, [genR("Debtors' ward", "ward"), genR(bride ? "Work room" : "Felons' day room", bride ? "work" : "ward")]), up && !sm ? { up: big ? [genR("Chapel", "temple"), genR("Women's ward", "ward")] : [genR(r() < 0.5 ? "Women's ward" : "Infirmary", "ward")] } : {})];
      const cells = []; for (let i = 0; i < nc; i++) cells.push(genU(2, [genR("Ward passage", "passage", { zone: "gl", hub: 1, dark: 1 }), genR(i === nc - 1 && big ? "Condemned cell" : "Cell", "cell", { dark: 1, cub: 1 })], { sizes: [2, D - 2] }));
      if (r() < 0.4) { const back = genInt(r, 3, 6), n = Math.max(2, Math.floor((D + back) / 3)); // a cell block running back from the street, its passage beside the cells
        units.push(genU(2, genR("Cell passage", "passage", { dark: 1 }), { back }), genU(3, Array.from({ length: n }, (_, i) => genR(i === 0 && big ? "Condemned cell" : "Cell", "cell", { dark: 1, cub: 1 })), { back })); }
      else units.push(...cells);
      return { D, name: bride ? "Bridewell" : sm ? "Lock-up gaol" : "City gaol", units }; } },
  { id: "warehouse", name: "Warehouse", icon: "📦", group: "city", mirror: 1, blurb: "A merchant's storehouse floor over floor, wide doors to the street and a hoist to the loft, the counting house and weighbeam by the door; or a long cloth or wool hall of open bays; the biggest a kontor, a walled trading yard of warehouses, weigh house, counting houses and the merchants' lodgings.",
    cellar: 0.4, porch: 0, floorsMax: 4, doorBonus: -1, under: [{ n: "Wine vault", k: "vault", w: 1 }],
    plan(r, size, up, fl) { const sm = size === "small", big = size === "large", nf = up ? (fl || genInt(r, 2, 4)) : 1, D = sm ? genInt(r, 6, 7) : genInt(r, 7, 9), goods = genOne(r, ["Wool", "Cloth", "Wine", "Grain", "Salt", "Timber", "Spice"]);
      const stack = u => { const lv = [[genR("Storage floor", "store")], [genR("Storage floor", "store")], [genR(genOne(r, ["Hoist loft", "Crane loft", "Drying loft"]), "loft")]]; if (nf > 1) u.up = nf === 2 ? lv[2] : lv[0]; if (nf > 2) u.up2 = nf === 3 ? lv[2] : lv[1]; if (nf > 3) u.up3 = lv[2]; return u; };
      const office = () => genU(genInt(r, 3, 4), genShuf(r, [genR("Counting house", "office"), genR(genOne(r, ["Weigh room", "Tally room", "Clerks' room"]), "office")]), nf > 1 ? { up: [genR("Clerk's chamber", "bed")].concat(r() < 0.5 ? [genR("Factor's room", "office")] : []) } : {});
      const v = big ? (r() < 0.6 ? 3 : genInt(r, 1, 2)) : genInt(r, 0, sm ? 1 : 2);
      if (v === 0) return { D, name: `${goods} warehouse`, units: [office(), stack(genU(sm ? genInt(r, 5, 6) : genInt(r, 7, 9), genR(`${goods} store`, "store"), { entry: 1, doorW: 2 }))] };
      if (v === 1) { const units = [office(), stack(genU(genInt(r, 4, 6), genR(`${goods} store`, "store"))), genU(3, genR("Cart bay", "passage", { gate: 1 }), { entry: 1, pass: 1, doorW: 3, upJoin: nf > 1 ? 1 : 0 }), genU(genInt(r, 4, 6), genR(`${goods} store`, "store"), nf > 1 ? { upJoin: 1 } : {})];
        units[1].endDoor = null; return { D, name: "Warehouse with a cart bay", units }; }
      if (v === 2) { const bays = sm ? 3 : big ? 6 : 4, units = [office()]; for (let i = 0; i < bays; i++) units.push(genU(genInt(r, 3, 4), genR(`${goods} hall`, "market", { zone: "cl", hub: 1, fl: "Trade hall" }), i === Math.floor(bays / 2) ? { entry: 1, doorW: 2 } : {}));
        return { D, name: `${goods} hall`, units }; }
      const units = [genU(4, genShuf(r, [genR("Counting house", "office"), genR("Merchants' hall", "hall", { w: 1.3 })]), nf > 1 ? { up: [genR("Merchants' dormitory", "bed", { w: 1.5 }), genR("Clerks' chamber", "bed")] } : {}),
        genU(3, genR("Yard gate", "passage", { gate: 1, dark: 1 }), { entry: 1, pass: 1, doorW: 3 }),
        genU(4, [genR("Weigh house", "office", { w: 1.3 }), genR("Toll office", "office")]),
        stack(genU(genInt(r, 5, 7), genR("Warehouse", "store", { zone: "wh", hub: 1 }))), genU(genInt(r, 4, 6), genR("Warehouse", "store", { zone: "wh", hub: 1 }), nf > 1 ? { upJoin: 1 } : {})];
      if (r() < 0.5) units.push(genU(3, genR("Chapel", "temple"), { inset: [1, 1] }));
      return { D, name: "Kontor", units }; } },
  { id: "mint", name: "Mint", icon: "🪙", group: "city", mirror: 1, blurb: "The guarded gate, the melting house with its furnaces, the coining house where the moneyers strike the blanks, the assay office, the pyx chamber and treasury, the warden's lodging; the small one a money-changers' exchange.",
    cellar: 0.6, porch: 0, floorsMax: 2, doorBonus: 2, under: [{ n: "Treasure vault", k: "vault", w: 1.2 }],
    plan(r, size, up) { const sm = size === "small", big = size === "large", D = sm ? genInt(r, 5, 6) : genInt(r, 6, 7);
      if (sm) { const units = [genU(genInt(r, 5, 7), genR(genOne(r, ["Exchange hall", "Changing hall", "Money-changers' hall"]), "hall"), { entry: 1 }), genU(4, genShuf(r, [genR("Assay room", "lab"), genR("Strong room", "vault", { dark: 1 })]), up ? { up: [genR("Changer's chamber", "bed")].concat(r() < 0.5 ? [genR("Ledger room", "office")] : []) } : {})];
        if (r() < 0.5) units.push(genU(3, genR("Counting room", "office"))); return { D, name: "Exchange", units }; }
      const work = genShuf(r, [genU(genInt(r, 4, 5), genShuf(r, [genR("Melting house", "forge", { w: 1.4 }), genR("Fuel store", "store")])),
        genU(genInt(r, 5, 6), [genR("Coining house", "work", { w: 1.5 }), genR("Blanching room", "furnace")], up ? { up: [genR("Moneyers' chamber", "bed"), genR("Moneyers' chamber", "bed")] } : {})].concat(big || r() < 0.5 ? [genU(4, genShuf(r, [genR("Assay office", "lab"), genR(genOne(r, ["Engraver's room", "Sorting room", "Weighing room"]), "work")]))] : []));
      const units = [genU(4, genShuf(r, [genR("Warden's office", "office"), genR("Comptroller's office", "office")]), up ? { up: [genR("Warden's hall", "living"), genR("Warden's chamber", "bed"), genR("Master's room", "office")] } : {}),
        genU(3, genR("Mint gate", "passage", { gate: 1, dark: 1 }), { entry: 1, pass: 1, doorW: 2 }), ...work,
        genU(3, genShuf(r, [genR(big ? "Treasury" : "Strong room", "vault", { dark: 1 }), genR(r() < 0.5 ? "Pyx chamber" : "Guard room", r() < 0.5 ? "vault" : "work")]))];
      return { D, name: "Mint", units }; } },
  { id: "bathhouse", name: "Bathhouse", icon: "♨", group: "city", mirror: 1, blurb: "The stews: a changing room by the door, the bath hall with its wooden tubs or a row of private bath chambers, a sweating room next the furnace and boiler, a barber's room; the big ones with separate baths for men and women, rest chambers above.",
    cellar: 0.1, porch: 0, floorsMax: 2, doorBonus: 0, under: [{ n: "Cistern", k: "cellar", w: 1 }],
    plan(r, size, up) { const sm = size === "small", big = size === "large", D = sm ? genInt(r, 5, 6) : genInt(r, 6, 7), v = genInt(r, 0, 1);
      const units = [genU(genInt(r, 3, 4), sm ? genR("Changing room", "living") : genShuf(r, [genR("Entrance", "office", { w: 0.7 }), genR("Changing room", "living")]), Object.assign({ entry: 1 }, up ? { up: genShuf(r, [genR("Rest chamber", "bed"), genR("Rest chamber", "bed"), genR("Bath-keeper's room", "bed"), genR("Linen room", "store")]).slice(0, 3) } : {}))];
      if (v === 1) { const n = sm ? 2 : big ? 4 : 3; for (let i = 0; i < n; i++) units.push(genU(2, [genR("Bath passage", "passage", { zone: "bp", hub: 1 }), genR("Bath chamber", "bath", { cub: 1 })], { sizes: [2, D - 2] })); }
      else if (big) units.push(genU(genInt(r, 5, 6), [genR("Men's bath", "bath"), genR("Women's bath", "bath")]));
      else units.push(genU(sm ? genInt(r, 4, 5) : genInt(r, 5, 6), genR(genOne(r, ["Bath hall", "Tub room"]), "bath"), up ? { upJoin: 1 } : {}));
      const hot = [genU(3, genR(genOne(r, ["Sweating room", "Hot room", "Steam room"]), "bath", { dark: 1 })), genU(3, genShuf(r, [genR("Furnace room", "furnace"), genR("Wood store", "store")]))];
      if (r() < 0.4) hot.unshift(genU(3, genR("Plunge pool", "bath"))); units.push(...hot);
      if (!sm && r() < 0.7) units.splice(1, 0, genU(3, genShuf(r, [genR("Barber's room", "work"), genR("Linen store", "store")])));
      return { D, name: v === 1 ? "Bath chambers" : big ? "Double bathhouse" : "Bathhouse", units }; } },
  { id: "college", name: "College", icon: "🎓", group: "city", mirror: 1, blurb: "A court entered under the gate tower: the hall with its buttery and kitchen down one side, the chapel and antechapel down the other (or along the front), the fellows' chambers along the front with the library over, the master's lodging in a corner.",
    cellar: 0.3, porch: 0, floorsMax: 2, doorBonus: 1.5, under: [{ n: "Beer cellar", k: "cellar", w: 1 }],
    plan(r, size, up) { const sm = size === "small", big = size === "large", D = genInt(r, 5, 6), wb = sm ? genInt(r, 5, 7) : big ? genInt(r, 9, 12) : genInt(r, 7, 9), L = r() < 0.35;
      const hallWing = genU(genInt(r, 5, 6), r() < 0.5 ? [genR("Kitchen", "kitchen", { w: 1.2 }), genR("Buttery", "store", { w: 0.7 }), genR("Hall", "hall", { w: 2.2 })] : [genR("Hall", "hall", { w: 2.2 }), genR("Buttery", "store", { w: 0.7 }), genR("Kitchen", "kitchen", { w: 1.2 })], { back: wb });
      const ch = () => genU(genInt(r, 3, 4), genR("Chamber", "bed"), up ? { up: genShuf(r, [genR("Chamber", "bed"), genR("Study", "library")]) } : {});
      const gate = genU(3, genR("Gate passage", "passage", { gate: 1, dark: 1 }), Object.assign({ entry: 1, pass: 1, doorW: 2 }, up ? { up: [genR(genOne(r, ["Gate chamber", "Muniment room", "Treasury"]), "office"), genR("Library", "library", { w: 2 })], landName: "Library stair" } : {}));
      const front = [big || r() < 0.4 ? genU(4, [genR("Master's hall", "living")], up ? { up: [genR("Master's chamber", "bed"), genR("Master's study", "library")] } : {}) : ch(), gate, genU(genInt(r, 4, 7), genR("Chambers", "bed"), up ? { upJoin: 1 } : {})];
      if (!sm) front.push(ch());
      const chapel = L ? genU(genInt(r, 5, 7), [genR("Antechapel", "temple"), genR("Chapel", "temple", { w: 2 })], { split: "length" }) : genU(genInt(r, 5, 6), genShuf(r, [genR("Antechapel", "temple")]).concat([genR("Chapel", "temple", { w: 2.2 })]), { back: wb });
      const units = [hallWing, ...front, chapel];
      return { D, name: sm ? "Hall of scholars" : L ? "College (two ranges)" : "College", units }; } },
];
const GEN_SAINTS = ["St Michael", "St Anne", "St Catherine", "St Nicholas", "All Saints", "the Holy Cross", "St Thomas", "St John", "St Mary", "St Andrew", "St Margaret", "St George"];
const GEN_SHOPS = ["Mercer's shop", "Draper's shop", "Goldsmith's shop", "Cook-shop", "Chandler's shop", "Haberdasher's shop", "Spicer's shop", "Cordwainer's shop", "Bookseller's shop", "Glover's shop", "Shop"];
GEN_BUILDINGS.push(...GEN_CITY);
// ===== Magic in the towns (Dryrones) =====
// Mana comes from thought, and what a body can't hold seeps out as natural mana; a crowded place builds it up, and too much
// brings a mana disaster. So the larger towns keep a bleed tower: it draws the excess off, stores it, and feeds the wards on
// the walls and the lamps along the main streets. Transponders (thought-speaking crystals) reach across a town; a relay post
// links the town to the next city's relay tower. The Guild (defence, transport, most magical matters) keeps a branch in the
// large towns, its familiar post in a wing (licensed familiars carrying parcels and magical items, roosting upstairs). Shops
// sell and attune transponders, and adaptors (for those with little mana of their own) and the small cores that run them.
const GEN_MAGIC = [
  { id: "relaypost", name: "Relay post", icon: "📡", group: "magic", mirror: 1, blurb: "Links the town's transponders to the nearest city's relay tower: a public counter, the receiving room where letters arrive and rebuild themselves, the sorting room and the address registry, and a stair tower with the relay crystal at the top, an operator always on watch below it.",
    cellar: 0.3, porch: 0.3, floorsMax: 3, doorBonus: 0.5, under: [{ n: "Core store", k: "vault", w: 1 }],
    plan(r, size, up, fl) { const sm = size === "small", big = size === "large", D = sm ? 5 : genInt(r, 6, 7), tower = fl === 1 ? 1 : fl === 2 ? 2 : 3;
      const units = [genU(genInt(r, 4, 5), [genR("Public counter", "office", { w: 1.2 }), genR("Receiving room", "relay")], Object.assign({ entry: 1 }, tower > 1 && !sm ? { up: [genR("Operator's chamber", "bed"), genR("Registry", "library")] } : {})),
        genU(genInt(r, 3, 4), sm ? genR("Sorting room", "work") : genShuf(r, [genR("Sorting room", "work"), genR(big ? "Registry hall" : "Operators' room", big ? "library" : "living")]), tower > 1 && !sm ? { upJoin: 1 } : {})];
      const tw = genU(4, genR("Tower room", "store"), Object.assign({ back: 2, inset: [0, 2] }, tower > 1 ? { up: [genR(tower > 2 ? "Watch room" : "Relay crystal chamber", tower > 2 ? "office" : "relay")] } : {}, tower > 2 ? { up2: [genR("Relay crystal chamber", "relay")] } : {}));
      if (r() < 0.5) units.push(tw); else units.unshift(tw);
      return { D, name: sm ? "Relay office" : "Relay post", units }; } },
  { id: "bleedtower", name: "Bleed tower", icon: "🗼", group: "magic", mirror: 1, blurb: "Draws the excess natural mana off the town before it can build into a disaster: the collector chamber at the top, the venting room for surges, the store of charged cores, and at the foot the control room with its gauges and the ward-feed room that powers the wards on the walls and the lamps in the streets.",
    cellar: 0.5, porch: 0, floorsMax: 4, doorBonus: 1.5, under: [{ n: "Deep core store", k: "vault", w: 1 }],
    plan(r, size, up, fl) { const sm = size === "small", nf = fl || (sm ? 3 : 4), T = 6, D = 6;
      const lv = [[genR("Core store", "vault")], [genR("Venting room", "mana")], [genR("Collector chamber", "mana")]].slice(0, nf - 1); lv[lv.length - 1] = [genR("Collector chamber", "mana")];
      const tower = genU(T, genR("Control room", "office"), Object.assign({ entry: 1, doorW: 2 }, nf > 1 ? { up: lv[0] } : {}, nf > 2 ? { up2: lv[1] } : {}, nf > 3 ? { up3: lv[2] } : {}));
      const annex = genU(genInt(r, 4, 5), genShuf(r, [genR("Ward-feed room", "mana"), genR("Keepers' workshop", "work")]), nf > 1 && !sm ? { up: [genR("Keepers' room", "bed"), genR("Linesman's store", "store")] } : {});
      const units = [tower, annex]; if (!sm && r() < 0.5) units.push(genU(3, genR("Keepers' lodge", "living"), { inset: [1, 0] }));
      return { D, name: sm ? "Bleed post" : "Bleed tower", units }; } },
  { id: "guildbranch", name: "Guild branch", icon: "🛡", group: "magic", mirror: 1, blurb: "The Guild's house in town: the guild hall with its quest boards and counters, the clerks and the records, the licensing and wardens' offices, the branch master and the masters' meeting room upstairs; and the familiar post in its own wing, the parcel counter, store and sealed vault below, the familiars roosting above.",
    cellar: 0.5, porch: 0.5, floorsMax: 2, doorBonus: 2, under: [{ n: "Guild vault", k: "vault", w: 1.2 }, { n: "Archive", k: "library", w: 0.8, opt: 0.5 }],
    plan(r, size, up) { const sm = size === "small", big = size === "large", D = sm ? 6 : genInt(r, 7, 8), wb = sm ? 0 : genInt(r, 4, 6);
      const offices = genU(genInt(r, 4, 5), genShuf(r, [genR("Records room", "library"), genR("Clerks' office", "office")]), up ? { up: [genR("Branch master's office", "office", { w: 1.2 }), genR("Masters' meeting room", "meet", { w: 1.2 })].concat(big ? [genR("Guild strong room", "vault", { w: 0.6 })] : []) } : {});
      const hall = genU(sm ? genInt(r, 6, 7) : big ? genInt(r, 10, 12) : genInt(r, 8, 9), genR("Guild hall", "hall"), { entry: 1, doorW: 2, porch: r() < 0.5 ? [3, 2] : null });
      const post = genU(genInt(r, 5, 6), (wb ? [genR("Parcel counter", "office"), genR("Parcel store", "store"), genR("Sealed vault", "vault", { dark: 1, w: 0.6 }), genR("Handlers' room", "work")] : [genR("Parcel counter", "office"), genR("Parcel store", "store")]), Object.assign({ back: wb, endDoor: "right" }, up ? { up: wb ? [genR("Familiar roost", "roost", { w: 2 }), genR("Familiar infirmary", "roost")] : [genR("Familiar roost", "roost")], landName: "Roost stair" } : {}));
      const units = [offices, hall]; if (!sm) units.push(genU(genInt(r, 3, 4), genShuf(r, [genR("Licensing office", "office"), genR("Wardens' office", "office")]))); units.push(post);
      return { D, name: sm ? "Guild office" : "Guild branch", units }; } },
  { id: "transponder", name: "Transponder shop", icon: "🔮", group: "magic", mirror: 1, blurb: "Sells, attunes and mends transponders: the shop with its crystals on show, a little attunement booth where a new transponder learns its owner's mind, the crystal workshop behind, the family above.",
    cellar: 0.3, porch: 0, floorsMax: 3, doorBonus: 0,
    plan(r, size, up, fl) { const sm = size === "small", nf = up ? (fl || genInt(r, 2, 3)) : 1, D = genInt(r, 6, sm ? 7 : 9);
      const u = genU(sm ? 5 : genInt(r, 5, 6), [genR("Transponder shop", "shop", { w: 1.2 }), genR("Attunement booth", "office", { w: 0.6 }), genR("Crystal workshop", "work")], { entry: 1 });
      if (nf > 1) u.up = genOne(r, [[genR("Hall", "living"), genR("Kitchen", "kitchen")], [genR("Kitchen", "kitchen"), genR("Hall", "living")]]); if (nf > 2) u.up2 = [genR("Chamber", "bed"), genR("Chamber", "bed")];
      const units = [u]; if (!sm && r() < 0.5) units.push(genU(2, genR("Side passage", "passage"), Object.assign({ pass: 1 }, nf > 1 ? { upJoin: 1 } : {})));
      return { D, name: "Transponder shop", units }; } },
  { id: "coreshop", name: "Adaptor & core shop", icon: "🔋", group: "magic", mirror: 1, blurb: "Adaptors for those with little mana of their own, and the small battery cores that run household things: the shop, a fitting room for adaptors, the charging room where spent cores are topped up, a locked core store.",
    cellar: 0.4, porch: 0, floorsMax: 3, doorBonus: 0, under: [{ n: "Core cellar", k: "vault", w: 1 }],
    plan(r, size, up, fl) { const sm = size === "small", big = size === "large", nf = up ? (fl || genInt(r, 2, 3)) : 1, D = genInt(r, 6, sm ? 7 : 9);
      const rooms = [genR("Core & adaptor shop", "shop", { w: 1.2 }), genR("Fitting room", "office", { w: 0.7 }), genR("Charging room", "mana")].concat(big ? [genR("Core store", "vault", { w: 0.6, dark: 1 })] : []);
      const u = genU(sm ? 5 : genInt(r, 5, 6), rooms, { entry: 1 });
      if (nf > 1) u.up = [genR("Hall", "living"), genR("Kitchen", "kitchen")]; if (nf > 2) u.up2 = [genR("Chamber", "bed"), genR("Chamber", "bed")];
      return { D, name: sm ? "Core seller's" : "Adaptor & core shop", units: [u] }; } },
];
GEN_BUILDINGS.push(...GEN_MAGIC);
Object.assign(GEN_KIND, { relay: "tile", mana: "stone", roost: "straw" });
Object.assign(GEN_KIND, { ward: "wood", cell: "stone", furnace: "stone", tower: "stone" });
Object.assign(GEN_FIRE, { furnace: 1, ward: 0.4 });
Object.assign(GEN_KIND, { market: "stone", slaughter: "stone", lab: "stone", loft: "wood" });
Object.assign(GEN_FIRE, { lab: 0.7, slaughter: 0.5 });
Object.assign(GEN_KIND, { byre: "straw", stall: "straw", hay: "straw", threshing: "stone", aisle: "earth", passage: "stone", water: "water", mill: "stone", bake: "stone" });
Object.assign(GEN_FIRE, { bake: 1 });
GEN_FLOOR.straw = { base: [44, 38, 58], line: "#a8904f" }; GEN_FLOOR.water = { base: [205, 38, 34], line: "#2e5670" };
// Open between rooms? (a hub of a zone and any other room of it: stalls and the aisle, the bays of a barn.)
// (A stall opens only at its front, onto the aisle in front of it: never sideways.)
const genOpen = (a, b) => !!(a && b && a.zone && a.zone === b.zone && (a.hub || b.hub) && (!(a.openY || b.openY) || a.y + a.h === b.y || b.y + b.h === a.y));

// Lay out a plan: the footprint, the ground floor's rooms, and the parts with a floor above (each gets its own stairs).
function genPlanLayout(r, T, o) {
  const up = o.floors === "auto" ? r() < 0.65 : Number(o.floors) > 1, plan = T.plan(r, o.size, up && (T.floorsMax || 1) > 1, o.floors === "auto" ? 0 : Math.min(T.floorsMax || 1, Number(o.floors) || 0));
  if (T.mirror && genRng((Number(o.seed) || 1) * 977 + 13)() < 0.5) genMirrorUnits(plan.units); // the same building the other way round
  const D = plan.D, units = plan.units, maxBack = Math.max(0, ...units.map(u => u.back || 0));
  let x = 0; const rects = units.map(u => { const ins = u.inset || [0, 0], rc = { x, y: maxBack - (u.back || 0) + ins[0], w: u.len, h: (u.back || 0) + D - ins[0] - ins[1] }; x += u.len; return rc; });
  const W = x, bodyH = maxBack + D, full = units.map((u, i) => !(u.inset && (u.inset[0] || u.inset[1])));
  const fi = full.indexOf(true), li = full.lastIndexOf(true);
  const main = { x: rects[fi].x, y: maxBack, w: rects[li].x + rects[li].w - rects[fi].x, h: D };
  const wings = [main]; units.forEach((u, i) => { if (!full[i]) wings.push(rects[i]); else if (u.back) wings.push({ x: rects[i].x, y: rects[i].y, w: u.len, h: u.back }); });
  // A porch in front of the unit that has one (the entry's, if its plan wants it and the option allows).
  const pu = units.findIndex(u => u.porch), wantP = o.porch === "yes" ? true : o.porch === "no" ? false : pu >= 0;
  let porch = null; const pi = pu >= 0 ? pu : units.findIndex(u => u.entry);
  if (wantP && pi >= 0 && full[pi]) { const [pw, ph] = units[pi].porch || [Math.min(3, units[pi].len), 2]; const rc = rects[pi], at = units[pi].doorAt === "start" ? rc.x : rc.x + Math.floor((rc.w - pw) / 2);
    porch = { x: Math.max(rc.x, Math.min(rc.x + rc.w - pw, at)), y: maxBack + D, w: Math.min(pw, rc.w), h: ph }; }
  const body = new Set(); wings.forEach(g => { for (let a = g.x; a < g.x + g.w; a++) for (let b = g.y; b < g.y + g.h; b++) body.add(a + "," + b); });
  const F = { shape: "plan", shapeName: plan.name, W, H: bodyH + (porch ? porch.h : 0), bodyH, main, wings, porch, body };
  // The rooms of each unit: split front to back (or along), sizes by weight, at least 2 squares each.
  const split = (rc, list, along, sizes) => { if (list.length === 1) return [Object.assign({}, list[0], rc)];
    const len = along ? rc.w : rc.h; let n = Math.min(list.length, Math.max(1, Math.floor(len / 2))); list = list.slice(0, n);
    let sz = sizes && sizes.length === n && sizes.reduce((a, b) => a + b, 0) === len ? sizes.slice() : null;
    if (!sz) { const tot = list.reduce((a, b) => a + (b.w || 1), 0); sz = list.map(b => Math.max(2, Math.round(len * (b.w || 1) / tot))); let d = len - sz.reduce((a, b) => a + b, 0); for (let i = 0; d !== 0 && i < 50; i++) { const j = i % n; if (d > 0) { sz[j]++; d--; } else if (sz[j] > 2) { sz[j]--; d++; } } }
    let pos = 0; return list.map((rm, i) => { const s = sz[i]; let out;
      if (along) out = Object.assign({}, rm, { x: rc.x + pos, y: rc.y, w: s, h: rc.h }); else out = Object.assign({}, rm, { x: rc.x, y: rc.y + rc.h - pos - s, w: rc.w, h: s }); // front (bottom) first
      pos += s; return out; }); };
  const gRooms = [], unitRooms = [];
  units.forEach((u, i) => { const rs = split(rects[i], u.rooms, u.split === "length", u.sizes); rs.forEach(rm => { rm.unit = i; if (u.entry && rm === rs[0]) rm.entry = 1; if (u.pass) rm.pass = 1; }); unitRooms.push(rs); gRooms.push(...rs); });
  if (porch) gRooms.push(Object.assign({ n: "Porch", k: "porch", porch: 1 }, porch));
  // The parts with a floor above: a unit with up rooms, joined by the units after it marked upJoin.
  const regions = []; units.forEach((u, i) => { if (u.up) regions.push({ units: [i], rooms: u.up.map(x => Object.assign({}, x)), landName: u.landName, slice: u.upSlice, higher: [u.up2, u.up3, u.up4].filter(Boolean) }); else if (u.upJoin && regions.length && regions[regions.length - 1].units.includes(i - 1)) regions[regions.length - 1].units.push(i); });
  regions.forEach(g => { const rs = g.units.map(i => rects[i]); const y0 = Math.max(...rs.map(q => q.y)), y1 = Math.min(...rs.map(q => q.y + q.h)); g.rect = { x: rs[0].x, y: y0, w: rs.reduce((a, q) => a + q.w, 0), h: y1 - y0 }; g.below = g.units.flatMap(i => unitRooms[i]); });
  const entry = gRooms.find(x => x.entry) || gRooms[0];
  return { F, gRooms, entry, regions, units, rects, plan };
}
function genPlanTry(o, attempt) {
  const T = genType(o.type), r = genRng(attempt ? (Number(o.seed) || 1) + attempt * 100003 : o.seed);
  const Lay = genPlanLayout(r, T, o), F = Lay.F, M = F.main, minD = 2, levels = [], stairs = [], gRooms = Lay.gRooms, entry = Lay.entry;
  const cellar = o.cellar === "yes" ? !!T.under : o.cellar === "no" ? false : r() < (T.cellar || 0);
  const frontY = M.y + M.h;
  const cellsOf = t => { const out = []; for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) out.push(x + "," + y); return out; };
  const near = t => { const out = new Set(); cellsOf(t).forEach(k => { const [x, y] = k.split(",").map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.add((x + dx) + "," + (y + dy)); }); return out; };
  levels.push({ level: 0, rooms: gRooms, name: "Ground floor" });
  // Stairs (or a ladder) up to each part with a floor above, from a room under it, not a passage or the aisle.
  const upRooms = [];
  Lay.regions.forEach(g => { const busy = new Set(stairs.flatMap(cellsOf)), nb = new Set(stairs.flatMap(t => [...near(t)]));
    const shopLast = rm => rm.k === "shop" ? 1 : 0; // the stairs out of the shop, if anywhere else will do: it needs its floor for the counter
    const cands = g.below.filter(rm => !rm.pass && !rm.hub && rm.k !== "water").sort((a, b) => shopLast(a) - shopLast(b)).concat(g.below.filter(rm => rm.hub && !rm.pass)); let s = null;
    for (const rm of cands) { for (const lx of [g.rect.w >= g.rect.h, g.rect.w < g.rect.h]) { s = genStairSpot(r, rm, { longX: lx, within: g.rect, frontY, avoid: busy, near: nb }); if (s) break; } if (s) break; }
    if (!s) return; s.lo = 0; stairs.push(s);
    g.made = g.rooms.length > 1 ? (g.slice ? genSlice(r, g.rect, g.rooms, minD) : genUpper(r, g.rect, s, g.rooms, minD, 1, g.landName || "Landing")) : [Object.assign({}, g.rooms[0], g.rect)]; upRooms.push(...g.made); }); // slice: rooms opening one into the next, no landing
  if (upRooms.length) levels.push({ level: 1, rooms: upRooms, name: Lay.regions.some(g => g.higher.length) ? "First floor" : "Upper floor" });
  // Higher storeys (a tall city house, a warehouse): each over the one below, its stairs going on up from that floor's landing.
  let higher = 0;
  for (let k = 2; k <= 4; k++) { const lv = [];
    Lay.regions.forEach(g => { const want = g.higher[k - 2]; if (!want || !g.made) { g.made = null; return; } higher++;
      const busy = new Set(stairs.flatMap(cellsOf)), nb = new Set(stairs.flatMap(t => [...near(t)])), below = g.made;
      const cands = below.filter(x => x.circ).concat(below.filter(x => !x.circ && !x.pass)); let s = null;
      for (const rm of cands) { for (const lx of [rm.w >= rm.h, rm.w < rm.h]) { s = genStairSpot(r, rm, { longX: lx, within: g.rect, avoid: busy, near: nb }); if (s) break; } if (s) break; }
      if (!s) { g.made = null; return; } s.lo = k - 1; stairs.push(s); const rooms = want.map(x => Object.assign({}, x));
      g.made = rooms.length > 1 ? genUpper(r, g.rect, s, rooms, minD, 1, g.landName || "Landing") : [Object.assign({}, rooms[0], g.rect)]; lv.push(...g.made); });
    if (!lv.length) break; levels.push({ level: k, rooms: lv, name: ["", "", "Second floor", "Third floor", "Fourth floor"][k] }); }
  const floors = levels.filter(L => L.level >= 0).length;
  let down = null;
  if (cellar) { const busy = new Set(stairs.flatMap(cellsOf)), nb = new Set(stairs.flatMap(t => [...near(t)])), inM = rm => rm.x >= M.x && rm.y >= M.y && rm.x + rm.w <= M.x + M.w && rm.y + rm.h <= M.y + M.h;
    const order = gRooms.filter(x => inM(x) && !x.porch && !x.pass && !x.hub && x.k !== "water").sort((a, b) => (["kitchen", "store"].includes(a.k) ? 0 : a.k === "shop" ? 2 : 1) - (["kitchen", "store"].includes(b.k) ? 0 : b.k === "shop" ? 2 : 1));
    for (const rm of order) { down = genStairSpot(r, rm, { longX: rm.w >= rm.h, within: M, frontY, avoid: busy, near: nb }) || genStairSpot(r, rm, { longX: rm.w < rm.h, within: M, frontY, avoid: busy, near: nb }); if (down) break; }
    if (down) { down.lo = -1; down.placedUpper = 1; stairs.push(down); const rooms = genPick(r, T.under || [{ n: "Cellar", k: "cellar", w: 1 }]);
      levels.unshift({ level: -1, rooms: rooms.length > 1 ? genUpper(r, M, down, rooms, minD, 1, "Cellar stairs") : [Object.assign({}, rooms[0], M)], name: "Cellar" }); } }
  const setLevelStairs = () => levels.forEach(L => { L.stairs = stairs.filter(t => t.lo === L.level || t.lo + 1 === L.level).map(t => { const onPlaced = t.placedUpper ? L.level === t.lo + 1 : L.level === t.lo;
    return Object.assign({}, t, { dir: L.level === t.lo ? "up" : "down", toward: onPlaced ? t.toward : (t.toward === "a" ? "b" : "a") }); }); });
  setLevelStairs();
  const stairsClear = () => levels.every(L => (L.stairs || []).every(t => genStairEntry(L, t).ok));
  stairs.forEach(t => { if (stairsClear()) return; const was = t.toward; t.toward = was === "a" ? "b" : "a"; setLevelStairs();
    const fine = levels.every(L => (L.stairs || []).filter(q => q.x === t.x && q.y === t.y && q.lo === t.lo).every(q => genStairEntry(L, q).ok));
    if (!fine) { t.toward = was; setLevelStairs(); } });
  // The front door: in the entry room's front wall (near the start of it for a chapel, so the porch sits at the west end).
  const eu = Lay.units[entry.unit] || {}, fw = Math.min(entry.w, eu.doorW || 1), stairX = new Set(levels.find(L => L.level === 0).stairs.filter(t => t.y + t.h >= frontY).flatMap(t => Array.from({ length: t.w }, (_, i) => t.x + i)));
  let fx0 = F.porch && F.porch.x >= entry.x && F.porch.x < entry.x + entry.w ? F.porch.x + Math.floor((F.porch.w - fw) / 2) : eu.doorAt === "start" ? entry.x + 1 : entry.x + Math.floor((entry.w - fw) / 2);
  fx0 = Math.max(entry.x, Math.min(entry.x + entry.w - fw, fx0)); for (let k = 0; k < entry.w && [...Array(fw).keys()].some(i => stairX.has(fx0 + i)); k++) fx0 = entry.x + ((fx0 - entry.x + 1) % Math.max(1, entry.w - fw + 1));
  const front = { x: fx0, w: fw, y: frontY };
  levels.forEach(L => genOpenings(r, L, F, L.stairs, L.level === 0 ? front : null));
  // Through doors: a cross-passage or threshing floor has its back door straight opposite; a byre its muck door at the end.
  const G = levels.find(L => L.level === 0);
  G.rooms.forEach(rm => { if (!rm.pass) return; const u = Lay.units[rm.unit], w = Math.min(rm.w, u.doorW || 1), at = rm.x <= front.x && front.x + front.w <= rm.x + rm.w ? front.x : rm.x + Math.floor((rm.w - w) / 2);
    if (G.own(at, rm.y - 1) < 0) for (let i = 0; i < w; i++) G.doors.add(`h,${at + i},${rm.y}`);
    if (rm !== entry && G.own(at, rm.y + rm.h) < 0) for (let i = 0; i < w; i++) G.doors.add(`h,${at + i},${rm.y + rm.h}`); });
  G.rooms.forEach(rm => { const u = Lay.units[rm.unit]; if (!u || !u.endDoor) return; const ex = u.endDoor === "right" ? rm.x + rm.w : rm.x, y = rm.y + Math.floor(rm.h / 2); if (G.own(u.endDoor === "right" ? ex : ex - 1, y) < 0) G.doors.add(`v,${ex},${y}`); });
  // A gate passage's doors are gates: each end one pair of gates the whole width of the passage.
  G.gates = new Set(); G.rooms.forEach(rm => { if (!rm.gate) return; [...G.doors].forEach(k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); if (d === "h" && x >= rm.x && x < rm.x + rm.w && (y === rm.y || y === rm.y + rm.h)) G.gates.add(k); }); });
  G.rooms.forEach(rm => { if (rm.dark) [...G.wins].forEach(k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); const inside = d === "h" ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]; if (inside.some(([a, b]) => a >= rm.x && a < rm.x + rm.w && b >= rm.y && b < rm.y + rm.h)) G.wins.delete(k); }); });
  const overlap = levels.some(L => { const seen = new Set(); return (L.stairs || []).some(t => cellsOf(t).some(k => { if (seen.has(k)) return true; seen.add(k); return false; })); });
  const ok = !overlap && stairs.length === Lay.regions.length + higher + (cellar ? 1 : 0) && levels.every(L => genReachable(L, F, L.level === 0 ? front : null));
  const doorScore = ({ small: 0, medium: 1, large: 2 })[o.size] ?? 1, ds = doorScore + (T.doorBonus || 0);
  return { type: T.id, W: F.W, H: F.H, F, floors, cellar: !!down, stairs, levels, rare: [], doorTier: ds >= 2 ? "grand" : ds >= 1 ? "framed" : "plain", ok, attempt, plan: 1 };
}
function genHearths(o, B) {
  const r = genRng((Number(o.seed) || 1) * 13 + 9), stacks = [];
  const ext = (L, nx, ny) => { const i = L.own(nx, ny); return i < 0; };
  B.levels.slice().sort((a, b) => a.level - b.level).forEach(L => {
    L.hearths = []; if (L.level < 0 || !L.own) return;
    const stairSq = new Set(); (L.stairs || []).forEach(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) stairSq.add(x + "," + y); });
    const used = new Set(), sides = [["t", 0, -1, (x, y) => `h,${x},${y}`], ["b", 0, 1, (x, y) => `h,${x},${y + 1}`], ["l", -1, 0, (x, y) => `v,${x},${y}`], ["r", 1, 0, (x, y) => `v,${x + 1},${y}`]];
    const cellEdges = (x, y) => sides.map(s => s[3](x, y));
    const stepSq = new Set((L.stairs || []).flatMap(t => genStairEntry(L, t).cells)); // keep the stairs' landings clear
    const blocked = (x, y) => stairSq.has(x + "," + y) || stepSq.has(x + "," + y) || cellEdges(x, y).some(k => L.doors.has(k)) || used.has(x + "," + y);
    const fronts = new Set(); // the squares in front of fires, kept clear
    const FD = { t: [0, 1], b: [0, -1], l: [1, 0], r: [-1, 0] };
    // Would a hearth (or flue) on (x, y) still leave its room's doors, stair ends and fires all reachable from each other?
    const roomOk = (i, x, y, side, fire) => { const rm = L.rooms[i], inR = (a, b) => a >= rm.x && b >= rm.y && a < rm.x + rm.w && b < rm.y + rm.h, K = (a, b) => a + "," + b;
      const block = new Set([...stairSq, ...used, K(x, y)]), need = new Set();
      [...L.doors].forEach(k => { const [d, a, b] = k.split(",").map((v, j) => j ? Number(v) : v); (d === "h" ? [[a, b - 1], [a, b]] : [[a - 1, b], [a, b]]).forEach(([cx, cy]) => { if (inR(cx, cy)) need.add(K(cx, cy)); }); });
      stepSq.forEach(c => { const [a, b] = c.split(",").map(Number); if (inR(a, b)) need.add(c); }); fronts.forEach(c => { const [a, b] = c.split(",").map(Number); if (inR(a, b)) need.add(c); });
      if (fire) { const fx = x + FD[side][0], fy = y + FD[side][1]; if (!inR(fx, fy) || block.has(K(fx, fy))) return false; need.add(K(fx, fy)); }
      if ([...need].some(c => block.has(c))) return false; const list = [...need]; if (!list.length) return true;
      const seen = new Set([list[0]]), q = [list[0]];
      while (q.length) { const [a, b] = q.pop().split(",").map(Number); for (const [da, db] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const k = K(a + da, b + db); if (!inR(a + da, b + db) || seen.has(k) || block.has(k)) continue; seen.add(k); q.push(k); } }
      return list.every(c => seen.has(c)); };
    // Stacks from the floors below come up through this one.
    stacks.forEach(st => { const i = L.own(st.x, st.y); if (i < 0 || L.rooms[i].porch) return; st.top = L.level;
      if (blocked(st.x, st.y) || !roomOk(i, st.x, st.y, st.side, false)) return; // in a doorway or at the stairs it stays inside the wall
      const rm = L.rooms[i]; let fire = !rm._fire && r() < (GEN_FIRE[rm.k] || 0); if (fire && !roomOk(i, st.x, st.y, st.side, true)) fire = false;
      used.add(st.x + "," + st.y); if (fire) { rm._fire = 1; fronts.add((st.x + FD[st.side][0]) + "," + (st.y + FD[st.side][1])); }
      L.hearths.push({ x: st.x, y: st.y, side: st.side, fire, k: rm.k }); });
    // An open hearth in the middle of the floor (a peasant's hall, a cottage): no chimney, the smoke goes out through a louvre
    // in the roof. The square nearest the middle that leaves the room's ways through clear.
    L.rooms.forEach((rm, i) => { if (!rm.openHearth || rm._fire) return; const cx = rm.x + (rm.w - 1) / 2, cy = rm.y + (rm.h - 1) / 2, cand = [];
      for (let x = rm.x + 1; x < rm.x + rm.w - 1; x++) for (let y = rm.y + 1; y < rm.y + rm.h - 1; y++) cand.push([Math.abs(x - cx) + Math.abs(y - cy), x, y]);
      const best = cand.sort((a, b) => a[0] - b[0]).find(([, x, y]) => !blocked(x, y) && roomOk(i, x, y, null, false)); if (!best) return;
      used.add(best[1] + "," + best[2]); rm._fire = 1; L.hearths.push({ x: best[1], y: best[2], central: 1, fire: true, k: rm.k }); });
    L.rooms.forEach((rm, i) => { if (rm._fire || rm.porch || rm.arcade || rm.circ || !(r() < (GEN_FIRE[rm.k] || 0))) return;
      if (rm.w * rm.h < 6 && rm.k !== "kitchen" && rm.k !== "forge") return; // no room for a fire and anything else
      const cands = [];
      for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) sides.forEach(([sd, dx, dy, key]) => {
        const nx = x + dx, ny = y + dy; if (L.own(nx, ny) === i || blocked(x, y)) return; const k = key(x, y); if (L.wins.has(k) || L.doors.has(k)) return;
        const nb = L.own(nx, ny); if (nb >= 0 && L.rooms[nb].porch) return;
        if (L.front && L.front.size && sd === "b" && [...L.front].some(fk => { const [, fx, fy] = fk.split(",").map(Number); return fy === y + 1 && Math.abs(fx - x) <= 2; })) return; // clear of the front door's frame
        const along = dx ? rm.h : rm.w, pos = dx ? y - rm.y : x - rm.x, mid = 1 - Math.abs(pos - (along - 1) / 2) / Math.max(1, along / 2);
        let sc = (ext(L, nx, ny) ? 3 : 0) + mid * 1.5 + r() * 0.6;
        if (L.hearths.some(h => h.fire && h.x === nx && h.y === ny)) sc += 5; // back to back with the fire next door
        if (rm.k === "kitchen" || rm.k === "forge") sc += ext(L, nx, ny) ? 1 : 0;
        cands.push({ sc, x, y, side: sd }); });
      const best = cands.sort((a, b) => b.sc - a.sc).find(c => roomOk(i, c.x, c.y, c.side, true));
      if (!best) return; rm._fire = 1; used.add(best.x + "," + best.y); fronts.add((best.x + FD[best.side][0]) + "," + (best.y + FD[best.side][1]));
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
    // A free square beyond each end, in this room: one to step on at the foot, and (on the next floor) one to step off at the head.
    if (o.longX ? (x - 1 < room.x || x + sw > room.x + room.w - 1) : (y - 1 < room.y || y + sh > room.y + room.h - 1)) continue;
    if (o.within && (o.longX ? (x - 1 < o.within.x || x + sw >= o.within.x + o.within.w) : (y - 1 < o.within.y || y + sh >= o.within.y + o.within.h))) continue;
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
  // The landing runs the length of the wing through the stairs, a square wider than them so you can walk past. On a narrow wing
  // try it the other way; if there's still no room for rooms beside it, the rooms open one into the next with the stairs in one.
  const lay = longX => { const c = longX ? { x: R.x, y: st.y, w: R.w, h: Math.max(st.h + 1, cw) } : { x: st.x, y: R.y, w: Math.max(st.w + 1, cw), h: R.h };
    if (longX && c.y + c.h > R.y + R.h) c.y = R.y + R.h - c.h; if (!longX && c.x + c.w > R.x + R.w) c.x = R.x + R.w - c.w;
    let bandA = longX ? { x: R.x, y: R.y, w: R.w, h: c.y - R.y } : { x: R.x, y: R.y, w: c.x - R.x, h: R.h };
    let bandB = longX ? { x: R.x, y: c.y + c.h, w: R.w, h: R.y + R.h - c.y - c.h } : { x: c.x + c.w, y: R.y, w: R.x + R.w - c.x - c.w, h: R.h };
    // A band too thin for rooms joins the corridor.
    if ((longX ? bandA.h : bandA.w) < minD) { if (longX) { c.h += c.y - R.y; c.y = R.y; } else { c.w += c.x - R.x; c.x = R.x; } bandA = null; }
    if (bandB && (longX ? bandB.h : bandB.w) < minD) { if (longX) c.h = R.y + R.h - c.y; else c.w = R.x + R.w - c.x; bandB = null; }
    return { c, bands: [bandA, bandB].filter(Boolean) }; };
  let L = lay(R.w >= R.h); if (!L.bands.length) L = lay(!(R.w >= R.h));
  if (!L.bands.length) return genSlice(r, R, rooms, minD);
  const { c, bands } = L;
  const area = b => b.w * b.h, tot = bands.reduce((a, b) => a + area(b), 0); let split = bands.length > 1 ? Math.round(rooms.length * area(bands[0]) / tot) : rooms.length;
  split = Math.max(bands.length > 1 ? 1 : 0, Math.min(rooms.length - (bands.length > 1 ? 1 : 0), split));
  const parts = bands.length > 1 ? [rooms.slice(0, split), rooms.slice(split)] : [rooms];
  return [Object.assign({ n: landName || (cw > 1 ? "Corridor" : "Landing"), k: landName === "Hayloft" ? "hay" : "landing", circ: 1 }, c)].concat(...bands.map((b, i) => genStrip(r, b, parts[i], minD)));
}
// Turn a row of units the other way round: an upper floor that started at its first unit and ran on over the next ones now
// starts at the last of them.
function genMirrorUnits(units) { const UP = ["up", "up2", "up3", "up4", "upSlice", "landName"];
  for (let i = 0; i < units.length; i++) { if (!units[i].up || units[i].upJoin) continue; let j = i; while (j + 1 < units.length && units[j + 1].upJoin) j++;
    if (j > i) { const a = units[i], b = units[j]; UP.forEach(k => { if (a[k] !== undefined) { b[k] = a[k]; delete a[k]; } }); delete b.upJoin; a.upJoin = 1; } i = j; }
  units.reverse(); const sw = n => n.replace(/North|South/g, w => w === "North" ? "South" : "North"); // compass names follow the building round
  units.forEach(u => { u.rooms.forEach(rm => { rm.n = sw(rm.n); }); [u.up, u.up2, u.up3].forEach(l => (l || []).forEach(rm => { rm.n = sw(rm.n); })); if (u.endDoor) u.endDoor = u.endDoor === "right" ? "left" : "right"; if (u.doorAt === "start") delete u.doorAt; }); }
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
      if (genOpen(L.rooms[a], L.rooms[b])) { seen.add(b); q.push(b); continue; } // open to each other: no door needed
      if (L.rooms[a].cub && L.rooms[b].cub) continue; // a bath chamber, cell or almsman's room opens onto its passage, never through the next one
      if ((L.rooms[a].zone && !L.rooms[a].hub && !L.rooms[a].zdoor) || (L.rooms[b].zone && !L.rooms[b].hub && !L.rooms[b].zdoor)) continue; // a stall opens only onto its aisle (zdoor: a ward or an aisle can still have a door)
      const clear = e.filter(k => !onStairs(k)); if (clear.length) e = clear; else if (!byStairs) continue; // doors don't open onto the stairs, unless there's no other way
      const mid = e.filter((_, i) => e.length < 3 || (i > 0 && i < e.length - 1)), list = mid.length ? mid : e, pick = list[Math.floor(r() * list.length)];
      L.doors.add(pick); if (secretPass) L.secret.add(pick); seen.add(b); if (!secretPass) q.push(b); } } };
  const all = () => { connect(false, false); connect(false, true); connect(true, false); connect(true, true); connect(false, false); connect(false, true); };
  all(); for (;;) { const nx = L.rooms.findIndex((x, i) => !seen.has(i) && !isPorch(i) && (x.circ || (stairs || []).some(t => t.x >= x.x && t.x < x.x + x.w && t.y >= x.y && t.y < x.y + x.h))); if (nx < 0) break; seen.add(nx); all(); } // a second part upstairs with its own stairs
  if (front) for (let i = 0; i < front.w; i++) { const k = `h,${front.x + i},${front.y}`; L.doors.add(k); L.front.add(k); }
  if (L.level === 0) { const back = L.rooms.find(x => x.back && own(x.x + Math.floor(x.w / 2), x.y - 1) < 0); if (back && r() < 0.55) L.doors.add(`h,${back.x + Math.floor(back.w / 2)},${back.y}`); }
  if (L.level < 0) return; // cellars have no windows
  // Windows: on each run of outside wall at least 3 squares long, one (two on long runs) away from the corners.
  L.rooms.forEach((rm, i) => { if (rm.porch || (rm.circ && L.level > 0 && r() < 0.5) || rm.secret || rm.dark) return;
    const runs = [], add = (list) => { let run = []; list.forEach(k => { if (k) run.push(k); else { if (run.length) runs.push(run); run = []; } }); if (run.length) runs.push(run); };
    // (Upstairs, only a wall over the outside gets a window: not a loft's side over the open hall.)
    const outside = (x, y) => own(x, y) < 0 && !(L.level > 0 && F.body && F.body.has(x + "," + y));
    add(Array.from({ length: rm.w }, (_, d) => outside(rm.x + d, rm.y - 1) ? `h,${rm.x + d},${rm.y}` : null));
    add(Array.from({ length: rm.w }, (_, d) => { const o2 = own(rm.x + d, rm.y + rm.h); return outside(rm.x + d, rm.y + rm.h) || isPorch(o2) ? `h,${rm.x + d},${rm.y + rm.h}` : null; }));
    add(Array.from({ length: rm.h }, (_, d) => outside(rm.x - 1, rm.y + d) ? `v,${rm.x},${rm.y + d}` : null));
    add(Array.from({ length: rm.h }, (_, d) => outside(rm.x + rm.w, rm.y + d) ? `v,${rm.x + rm.w},${rm.y + d}` : null));
    runs.forEach(run => { const len = run.length; if (len < 3) return; const many = len >= 7 ? [Math.floor(len / 4), len - 1 - Math.floor(len / 4)] : [Math.floor((len - 1) / 2)];
      many.forEach(j => { const k = run[j]; if (!L.doors.has(k)) L.wins.add(k); }); });
  });
}
// Every wall edge of a floor: between two rooms, or a room and the outside. A porch has no walls to the outside, only posts.
function genEdges(L, W, H) {
  const out = [], own = L.own, porch = i => i >= 0 && L.rooms[i].porch, arc = i => i >= 0 && L.rooms[i].arcade;
  const wall = (a, b) => a !== b && !((porch(a) || arc(a)) && b < 0) && !((porch(b) || arc(b)) && a < 0) && !(a >= 0 && b >= 0 && genOpen(L.rooms[a], L.rooms[b]));
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
  } else if (kind === "water") { // the wheel pit: dark water with ripples
    d = `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="hsl(${h} ${s}% ${l}%)"/>`;
    for (let i = 0; i < rm.w * rm.h * 2; i++) { const cx = X + r() * W, cy = Y + r() * H, w2 = P * (0.2 + r() * 0.4); d += `<path d="M${(cx - w2).toFixed(1)} ${cy.toFixed(1)}q${(w2 / 2).toFixed(1)} -4 ${w2.toFixed(1)} 0t${w2.toFixed(1)} 0" stroke="rgba(255,255,255,.28)" stroke-width="1.5" fill="none"/>`; }
  } else if (kind === "straw") { // straw over earth: short pale strokes every which way
    d = `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="hsl(${h} ${s}% ${l}%)"/>`;
    for (let i = 0; i < rm.w * rm.h * 14; i++) { const cx = X + r() * W, cy = Y + r() * H, a = r() * Math.PI, len = P * (0.12 + r() * 0.22); d += `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + Math.cos(a) * len).toFixed(1)}" y2="${(cy + Math.sin(a) * len).toFixed(1)}" stroke="${r() < 0.5 ? "#e3cf8a" : "#b89a52"}" stroke-width="1.4" opacity=".8"/>`; }
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
// part: "base" (the floor without names or the overlay), "top" (only those, to lay over furniture), or everything.
// Gates: each straight run of gate edges ({ d: "h" | "v", a..b along the line, c the line itself }) is one gate.
function genGateRuns(gates) { const runs = [];
  [...gates].map(k => k.split(",").map((v, i) => i ? Number(v) : v)).map(([d, x, y]) => d === "h" ? { d, p: x, c: y } : { d, p: y, c: x }).sort((a, b) => (a.d > b.d ? 1 : a.d < b.d ? -1 : 0) || a.c - b.c || a.p - b.p)
    .forEach(g => { const last = runs[runs.length - 1]; if (last && last.d === g.d && last.c === g.c && last.b === g.p) last.b = g.p + 1; else runs.push({ d: g.d, a: g.p, b: g.p + 1, c: g.c }); });
  return runs; }
function genFloorSvg(B, L, labels, seed, overlay, part) {
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
    if (h.central) { const cx = X + P / 2, cy = Y + P / 2; return `<circle cx="${cx}" cy="${cy}" r="${P * 0.62}" fill="rgba(30,26,22,.25)"/>` + Array.from({ length: 10 }, (_, j) => { const a = j / 10 * Math.PI * 2; return `<circle cx="${(cx + Math.cos(a) * P * 0.36).toFixed(1)}" cy="${(cy + Math.sin(a) * P * 0.36).toFixed(1)}" r="${(P * 0.1).toFixed(1)}" fill="#8d8478" stroke="#2b2520" stroke-width="1.5"/>`; }).join("") +
      `<circle cx="${cx}" cy="${cy}" r="${P * 0.27}" fill="#2a221c"/><circle cx="${cx}" cy="${cy}" r="${P * 0.17}" fill="#e0762a" opacity=".9"/><circle cx="${cx}" cy="${cy}" r="${P * 0.09}" fill="#ffd36b"/>` +
      [[-0.12, -0.1, 0.14, 0.1], [0.1, -0.12, -0.08, 0.14]].map(([a, b, c, e]) => `<line x1="${cx + a * P}" y1="${cy + b * P}" x2="${cx + c * P}" y2="${cy + e * P}" stroke="#4a3220" stroke-width="3" stroke-linecap="round"/>`).join(""); }
    const box = h.side === "t" ? [X + s, Y, P - 2 * s, d] : h.side === "b" ? [X + s, Y + P - d, P - 2 * s, d] : h.side === "l" ? [X, Y + s, d, P - 2 * s] : [X + P - d, Y + s, d, P - 2 * s];
    if (!h.fire) return `<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="#8d8478" stroke="#2b2520" stroke-width="2"/>`;
    const apron = h.side === "t" ? [X + s / 2, Y + d - 2, P - s, P * 0.22] : h.side === "b" ? [X + s / 2, Y + P - d - P * 0.22 + 2, P - s, P * 0.22] : h.side === "l" ? [X + d - 2, Y + s / 2, P * 0.22, P - s] : [X + P - d - P * 0.22 + 2, Y + s / 2, P * 0.22, P - s];
    const fb = [box[0] + (horiz ? P * 0.14 : 4), box[1] + (horiz ? 4 : P * 0.14), box[2] - (horiz ? P * 0.28 : 8), box[3] - (horiz ? 8 : P * 0.28)], fx = fb[0] + fb[2] / 2, fy = fb[1] + fb[3] / 2, big = h.k === "forge" ? 1.4 : 1;
    return `<rect x="${apron[0]}" y="${apron[1]}" width="${apron[2]}" height="${apron[3]}" fill="#9d968a" stroke="#2b2520" stroke-width="1.5"/>
      <rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="#7d7266" stroke="#2b2520" stroke-width="2"/><rect x="${fb[0]}" y="${fb[1]}" width="${fb[2]}" height="${fb[3]}" fill="#1e1a16"/>
      <circle cx="${fx}" cy="${fy}" r="${P * 0.13 * big}" fill="#e0762a" opacity=".9"/><circle cx="${fx}" cy="${fy}" r="${P * 0.07 * big}" fill="#ffd36b"/>`; }).join("");
  const edges = genEdges(L, B.W, B.H), porchI = L.rooms.findIndex(x => x.porch);
  // Outside walls are twice as thick as inside ones. Doors to the outside get stone jambs; the front door a grand entrance.
  const WI = 5, WE = 10, front = L.front || new Set(), gates = L.gates || new Set();
  const walls = edges.map(e => { const ln = (sw, c, cap, extra) => `<line x1="${e.x1 * P}" y1="${e.y1 * P}" x2="${e.x2 * P}" y2="${e.y2 * P}" stroke="${c}" stroke-width="${sw}" stroke-linecap="${cap}"${extra || ""}/>`;
    if (front.has(e.k) || gates.has(e.k)) return "";
    if (L.doors.has(e.k) && !L.secret.has(e.k)) { if (!e.ext) return ln(4, "#8a6a44", "butt", ` opacity=".9"`);
      const h = e.y1 === e.y2, j = (x, y) => `<rect x="${x * P - 6}" y="${y * P - 6}" width="12" height="12" fill="#a39b8c" stroke="#2b2520" stroke-width="2"/>`;
      return ln(WE, "#3b2a1a", "butt") + ln(6, "#7a4a26", "butt") + j(e.x1, e.y1) + j(e.x2, e.y2); }
    if (L.wins.has(e.k)) return ln(WE, "#2b2520", "square") + ln(3, "#bfe3f2", "butt");
    return ln(e.ext ? WE : WI, "#2b2520", "square"); }).join("");
  // The front door: double doors under a stone lintel, a pillar each side and a broad step outside.
  // Gates: one pair of heavy plank gates the width of the passage, iron-strapped, between stone jambs.
  const gateSvg = genGateRuns(gates).map(({ d, a, b, c }) => { const X0 = 0, X1 = (b - a) * P, Y = 0, mx = (X0 + X1) / 2, tf = d === "h" ? `translate(${a * P} ${c * P})` : `translate(${c * P} ${a * P}) rotate(90)`, leaf = (a, b) => { let pl = ""; for (let q = a + 8; q < b - 2; q += 8) pl += `<line x1="${q}" y1="${Y - 6}" x2="${q}" y2="${Y + 6}" stroke="rgba(43,37,32,.45)" stroke-width="1"/>`;
      return `<rect x="${a + 1}" y="${Y - 6}" width="${b - a - 2}" height="12" fill="#6e4524" stroke="#2b2520" stroke-width="1.5"/>${pl}<line x1="${a + 2}" y1="${Y - 3}" x2="${b - 2}" y2="${Y - 3}" stroke="#2b2520" stroke-width="1.6"/><line x1="${a + 2}" y1="${Y + 3}" x2="${b - 2}" y2="${Y + 3}" stroke="#2b2520" stroke-width="1.6"/>`; };
    const jamb = cx => `<rect x="${cx - 8}" y="${Y - 8}" width="16" height="16" fill="#a39b8c" stroke="#2b2520" stroke-width="2"/>`;
    return `<g transform="${tf}"><rect x="${X0}" y="${Y - 2}" width="${X1 - X0}" height="4" fill="#5e5548"/>${leaf(X0, mx)}${leaf(mx, X1)}<circle cx="${mx - 5}" cy="${Y}" r="2.2" fill="#3a3530"/><circle cx="${mx + 5}" cy="${Y}" r="2.2" fill="#3a3530"/>${jamb(X0)}${jamb(X1)}</g>`; }).join("");
  let grand = gateSvg;
  if (front.size && ![...front].every(k => gates.has(k))) { const tier = B.doorTier || "grand"; const xs = [...front].map(k => Number(k.split(",")[1])), x0 = Math.min(...xs) * P, x1 = (Math.max(...xs) + 1) * P, y = Number([...front][0].split(",")[2]) * P, mx = (x0 + x1) / 2;
    const leaves = tier === "grand" || x1 - x0 > P * 1.5
      ? `<rect x="${x0 + 1}" y="${y - 5}" width="${(x1 - x0) / 2 - 2}" height="10" fill="#7a4a26" stroke="#2b2520" stroke-width="1.5"/><rect x="${mx + 1}" y="${y - 5}" width="${(x1 - x0) / 2 - 2}" height="10" fill="#7a4a26" stroke="#2b2520" stroke-width="1.5"/><circle cx="${mx - 5}" cy="${y}" r="2" fill="#e8c27a"/><circle cx="${mx + 5}" cy="${y}" r="2" fill="#e8c27a"/>`
      : `<rect x="${x0 + 2}" y="${y - 4}" width="${x1 - x0 - 4}" height="8" fill="#7a4a26" stroke="#2b2520" stroke-width="1.5"/><circle cx="${x1 - 8}" cy="${y}" r="1.8" fill="${tier === "plain" ? "#3a3530" : "#c9a45e"}"/>`;
    if (tier === "plain") // a plain door: a timber frame in the wall and one rough doorstep
      grand = gateSvg + `<rect x="${x0 - P * 0.12}" y="${y}" width="${x1 - x0 + P * 0.24}" height="${P * 0.3}" rx="4" fill="#9a9283" stroke="#2b2520" stroke-width="1.5"/>
        <rect x="${x0 - 4}" y="${y - WE / 2}" width="${x1 - x0 + 8}" height="${WE}" fill="#5a4330" stroke="#2b2520" stroke-width="1.5"/>${leaves}`;
    else if (tier === "framed") { // a framed door: a heavy lintel, a squared post each side and a stone step
      const post = cx => `<rect x="${cx - P * 0.13}" y="${y - P * 0.13}" width="${P * 0.26}" height="${P * 0.26}" fill="#6e5236" stroke="#2b2520" stroke-width="2"/><rect x="${cx - P * 0.13}" y="${y - P * 0.13}" width="${P * 0.26}" height="3" fill="rgba(255,255,255,.18)"/>`;
      grand = gateSvg + `<rect x="${x0 - P * 0.4}" y="${y}" width="${x1 - x0 + P * 0.8}" height="${P * 0.42}" rx="3" fill="#a8a092" stroke="#2b2520" stroke-width="2"/>
        <rect x="${x0 - P * 0.3}" y="${y - WE / 2 - 2}" width="${x1 - x0 + P * 0.6}" height="${WE + 4}" fill="#5f4630" stroke="#2b2520" stroke-width="2"/>${leaves}${post(x0 - P * 0.17)}${post(x1 + P * 0.17)}`; }
    else {    const pr = P * 0.25, pillar = cx => `<circle cx="${cx + 2}" cy="${y + P * 0.3 + 3}" r="${pr + 1}" fill="rgba(0,0,0,.35)"/><circle cx="${cx}" cy="${y + P * 0.3}" r="${pr}" fill="#d8d0c0" stroke="#2b2520" stroke-width="2.5"/><circle cx="${cx}" cy="${y + P * 0.3}" r="${pr * 0.7}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1.5"/><circle cx="${cx - pr * 0.3}" cy="${y + P * 0.3 - pr * 0.3}" r="${pr * 0.35}" fill="#f4efe4"/>`;
    grand = gateSvg + `<rect x="${x0 - P * 0.6}" y="${y + P * 0.45}" width="${x1 - x0 + P * 1.2}" height="${P * 0.45}" rx="3" fill="#958d80" stroke="#2b2520" stroke-width="2"/>
      <rect x="${x0 - P * 0.85}" y="${y}" width="${x1 - x0 + P * 1.7}" height="${P * 0.55}" rx="3" fill="#aea697" stroke="#2b2520" stroke-width="2"/>
      <rect x="${x0 - P * 0.75}" y="${y - WE / 2 - 4}" width="${x1 - x0 + P * 1.5}" height="${WE + 8}" fill="#6e5c48" stroke="#2b2520" stroke-width="2.5"/>
      <rect x="${x0 - P * 0.75}" y="${y - WE / 2 - 4}" width="${x1 - x0 + P * 1.5}" height="3" fill="rgba(255,255,255,.18)"/>
      ${leaves}
      ${pillar(x0 - P * 0.45)}${pillar(x1 + P * 0.45)}`; } }
  // What the tabletop will treat as walls, doors and windows, in its own colours.
  let over = "";
  if (overlay) {
    // The tabletop's grid: one line per square.
    let grid = ""; for (let x = 0; x <= W; x++) grid += `M${x * P} 0V${H * P}`; for (let y = 0; y <= H; y++) grid += `M0 ${y * P}H${W * P}`;
    over = `<path d="${grid}" stroke="rgba(0,0,0,.45)" stroke-width="1"/><path d="${grid}" stroke="rgba(255,255,255,.35)" stroke-width="1" transform="translate(1 1)"/>`;
    over += edges.map(e => { const isD = L.doors.has(e.k), isW = L.wins.has(e.k), sec = L.secret.has(e.k);
      const c = sec ? "#b06ad6" : isD ? "#c98b4a" : isW ? "#7fd0ff" : "#ff9a3c", dash = isW ? ` stroke-dasharray="10 4"` : "";
      return `<line x1="${e.x1 * P}" y1="${e.y1 * P}" x2="${e.x2 * P}" y2="${e.y2 * P}" stroke="${c}" stroke-width="${isD || isW ? 5 : 3}"${dash}/>`; }).join("");
    over += edges.filter(e => L.doors.has(e.k) || L.wins.has(e.k)).map(e => { const sec = L.secret.has(e.k), isW = L.wins.has(e.k), cx = (e.x1 + e.x2) / 2 * P, cy = (e.y1 + e.y2) / 2 * P;
      return `<circle cx="${cx}" cy="${cy}" r="${isW ? 6 : 8}" fill="rgba(12,14,19,.85)" stroke="${sec ? "#b06ad6" : isW ? "#7fd0ff" : "#e8c27a"}" stroke-width="2"${sec ? ` stroke-dasharray="3 2"` : ""}/>`; }).join("");
    over += (L.stairs || []).map(t => `<rect x="${t.x * P + 2}" y="${t.y * P + 2}" width="${t.w * P - 4}" height="${t.h * P - 4}" fill="none" stroke="#ffd23c" stroke-width="2.5" stroke-dasharray="6 4"/>`).join("");
  }
  const posts = porchI >= 0 ? (rm => { const pts = [[rm.x, rm.y + rm.h], [rm.x + rm.w, rm.y + rm.h]]; for (let x = rm.x + 2; x < rm.x + rm.w - 1; x += 2) pts.push([x, rm.y + rm.h]); return pts.map(([x, y]) => `<rect x="${x * P - 5}" y="${y * P - 5}" width="10" height="10" fill="#5a4330" stroke="#2b2520" stroke-width="2"/>`).join(""); })(L.rooms[porchI]) : "";
  // An arcade (a market house's open ground floor, a saw shed) stands on posts all round its open sides, about every 2 squares.
  const arcPosts = (() => { const own = L.own || (() => -1), pts = new Set();
    L.rooms.forEach((rm, i) => { if (!rm.arcade) return; const add = (x, y) => pts.add(x + "," + y);
      const side = (x0, y0, dx, dy, n, out) => { let run = []; for (let k = 0; k <= n; k++) { const x = x0 + dx * k, y = y0 + dy * k; run.push([x, y, k < n && own(x + out[0] + (dx ? 0 : 0), y + out[1]) < 0]); }
        for (let k = 0; k < n; k++) { const [x, y, o] = run[k]; if (!o) continue; if (k === 0 || !run[k - 1][2] || k % 2 === 0) add(x, y); if (k === n - 1 || !run[k + 1][2]) add(run[k + 1][0], run[k + 1][1]); } };
      side(rm.x, rm.y + rm.h, 1, 0, rm.w, [0, 0]); side(rm.x, rm.y, 1, 0, rm.w, [0, -1]); side(rm.x, rm.y, 0, 1, rm.h, [-1, 0]); side(rm.x + rm.w, rm.y, 0, 1, rm.h, [0, 0]); });
    return [...pts].map(k => { const [x, y] = k.split(",").map(Number); return `<rect x="${x * P - 6}" y="${y * P - 6}" width="12" height="12" fill="#8d8478" stroke="#2b2520" stroke-width="2"/>`; }).join(""); })();
  // A room's name goes in its middle, or beside the stairs if they're in the way.
  const labAt = rm => { let x = rm.x + rm.w / 2, y = rm.y + rm.h / 2; const t = (L.stairs || []).find(q => x > q.x - 1 && x < q.x + q.w + 1 && y > q.y - 0.6 && y < q.y + q.h + 0.6 && q.x >= rm.x && q.x < rm.x + rm.w && q.y >= rm.y && q.y < rm.y + rm.h);
    if (t && x > t.x - 1 && x < t.x + t.w + 1 && y > t.y - 0.6 && y < t.y + t.h + 0.6) {
      const leftRoom = t.x - rm.x, rightRoom = rm.x + rm.w - (t.x + t.w), upRoom = t.y - rm.y, downRoom = rm.y + rm.h - (t.y + t.h), best = Math.max(leftRoom, rightRoom, upRoom, downRoom);
      if (best === leftRoom) x = rm.x + leftRoom / 2; else if (best === rightRoom) x = t.x + t.w + rightRoom / 2; else if (best === upRoom) y = rm.y + upRoom / 2; else y = t.y + t.h + downRoom / 2; }
    return [x, y]; };
  const lab = labels ? L.rooms.map(rm => `<text x="${labAt(rm)[0] * P}" y="${labAt(rm)[1] * P}" font-family="system-ui, sans-serif" font-size="${Math.min(13, rm.w * P / Math.max(4, rm.n.length) * 1.7).toFixed(1)}" font-weight="700" fill="#2a2016" stroke="#f3e9d2" stroke-width="2.5" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(rm.n)}${rm.secret ? " 🔒" : ""}</text>`).join("") : "";
  const pd = GEN_PAD * P;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pd} ${-pd} ${W * P + pd * 2} ${H * P + pd * 2}" width="${W * P + pd * 2}" height="${H * P + pd * 2}">${part === "top" ? `${lab}${over}` : `<defs>${clips}</defs>${rooms}${stairs}${hearth}${walls}${posts}${arcPosts}${grand}${part === "base" ? "" : lab + over}`}</svg>`;
}
// The roof follows the whole outline of the building: a hipped roof whose slopes meet in ridges, hips and valleys wherever the
// wings join (its height anywhere is how far in from the nearest eave, taken square-wise, which is just what a hipped roof
// on an outline of straight walls does). Where part of the building stands taller (more floors, or a hall or church open to
// its rafters) that part gets its own roof, higher, over the lower one, with its shadow falling on it; aisles stay low.
const GEN_ROOF_CACHE = new WeakMap(), GEN_TALL_KINDS = { hall: 1, temple: 1, sanctum: 1 };
function genRoofTops(B) { const top = new Map();
  B.F.body.forEach(c => top.set(c, 0));
  B.levels.forEach(L => { if (L.level < 0) return; L.rooms.forEach(rm => { const t = L.level === 0 ? (rm.low ? 0 : (rm.tall || GEN_TALL_KINDS[rm.k]) ? 1 : 0) : L.level;
    for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) { const c = x + "," + y; if (top.has(c)) top.set(c, Math.max(top.get(c), t)); } }); });
  return top; }
// One roof over a set of cells: the facets (which way each slope faces) and the lines between them, as SVG.
function genRoofFacets(U, W, H, P) {
  const inU = (x, y) => U.has(x + "," + y), edge = [];
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) if (!inU(x, y) && (inU(x + 1, y) || inU(x - 1, y) || inU(x, y + 1) || inU(x, y - 1) || inU(x + 1, y + 1) || inU(x - 1, y - 1) || inU(x + 1, y - 1) || inU(x - 1, y + 1))) edge.push([x, y]);
  const grid = new Map(); edge.forEach(q => { const k = q[0] + "," + q[1]; grid.set(k, q); });
  const face = (px, py) => { let best = 1e9, d = 0; const cx = Math.floor(px), cy = Math.floor(py);
    for (let R = 0; R <= W + H; R++) { if (R - 1 > best + 1e-9) break; // a ring of cells R away can't be nearer than R - 1
      const ring = R ? 8 * R : 1; for (let n = 0; n < ring; n++) { let x, y; if (!R) { x = cx; y = cy; } else { const side = Math.floor(n / (2 * R)), o = n % (2 * R) - R;
          if (side === 0) { x = cx + o; y = cy - R; } else if (side === 1) { x = cx + R; y = cy + o; } else if (side === 2) { x = cx - o; y = cy + R; } else { x = cx - R; y = cy - o; } }
        if (!grid.has(x + "," + y)) continue;
        const dx = Math.max(x - px, 0, px - x - 1), dy = Math.max(y - py, 0, py - y - 1), m = Math.max(dx, dy);
        if (m < best - 1e-9 || (Math.abs(m - best) < 1e-9 && (dx > dy ? (x > px ? 1 : 3) : (y > py ? 2 : 0)) < d)) { best = m; d = dx > dy ? (x > px ? 1 : 3) : (y > py ? 2 : 0); } } }
    return d; }; // 0 faces up the map (north), 1 east, 2 south, 3 west
  const paths = ["", "", "", ""], segs = [], S = 0.5, F = (v) => (v * P).toFixed(1);
  const cellsU = [...U].map(c => c.split(",").map(Number));
  const sq = new Map(); // half-square → its four triangles' facings [top, right, bottom, left]
  cellsU.forEach(([cx, cy]) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const x0 = cx + i * S, y0 = cy + j * S, mx = x0 + S / 2, my = y0 + S / 2, e = S / 3;
    sq.set(`${x0},${y0}`, [face(mx, my - e), face(mx + e, my), face(mx, my + e), face(mx - e, my)]); } });
  // Whole half-squares facing one way join into runs along the row; the rest are drawn triangle by triangle.
  const rows = new Map(); sq.forEach((t, k) => { const [x0, y0] = k.split(",").map(Number);
    if (t[0] === t[1] && t[1] === t[2] && t[2] === t[3]) { const key = y0 + "|" + t[0]; if (!rows.has(key)) rows.set(key, []); rows.get(key).push(x0); }
    else { const mx = x0 + S / 2, my = y0 + S / 2, c = [[x0, y0], [x0 + S, y0], [x0 + S, y0 + S], [x0, y0 + S]];
      for (let q = 0; q < 4; q++) { const a = c[q], b = c[(q + 1) % 4]; paths[t[q]] += `M${F(a[0])} ${F(a[1])}L${F(b[0])} ${F(b[1])}L${F(mx)} ${F(my)}Z`; } }
    // the lines between facings: inside the half-square along its diagonals, and along its sides to the next one
    const mx = x0 + S / 2, my = y0 + S / 2, cor = [[x0, y0], [x0 + S, y0], [x0 + S, y0 + S], [x0, y0 + S]];
    for (let q = 0; q < 4; q++) if (t[q] !== t[(q + 1) % 4]) segs.push({ a: cor[(q + 1) % 4], b: [mx, my], ridge: (t[q] + 2) % 4 === t[(q + 1) % 4] });
    const rt = sq.get(`${x0 + S},${y0}`), dn = sq.get(`${x0},${y0 + S}`);
    if (rt && rt[3] !== t[1]) segs.push({ a: [x0 + S, y0], b: [x0 + S, y0 + S], ridge: (rt[3] + 2) % 4 === t[1] });
    if (dn && dn[0] !== t[2]) segs.push({ a: [x0, y0 + S], b: [x0 + S, y0 + S], ridge: (dn[0] + 2) % 4 === t[2] }); });
  rows.forEach((xs, key) => { const [y0, d] = key.split("|").map(Number); xs.sort((a, b) => a - b); let s = xs[0], p = xs[0];
    const out = () => { paths[d] += `M${F(s)} ${F(y0)}H${F(p + S)}V${F(y0 + S)}H${F(s)}Z`; };
    for (let i = 1; i < xs.length; i++) { if (Math.abs(xs[i] - p - S) < 1e-6) p = xs[i]; else { out(); s = p = xs[i]; } } out(); });
  // Join the little line pieces into long ones (each ridge, hip and valley one stroke).
  const lines = new Map(); segs.forEach(g => { let [a, b] = [g.a, g.b]; if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) [a, b] = [b, a];
    const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]), key = `${dx},${dy},${dx === 0 ? a[0] : dy === 0 ? a[1] : (a[1] - dy * a[0]).toFixed(2)},${g.ridge ? 1 : 0}`;
    if (!lines.has(key)) lines.set(key, []); lines.get(key).push([a, b]); });
  let ridge = "", hip = ""; lines.forEach((list, key) => { const isR = key.endsWith(",1"); list.sort((p, q) => p[0][0] - q[0][0] || p[0][1] - q[0][1]); let [a, b] = list[0];
    const put = () => { const d = `M${F(a[0])} ${F(a[1])}L${F(b[0])} ${F(b[1])}`; if (isR) ridge += d; else hip += d; };
    for (let i = 1; i < list.length; i++) { const [c, e] = list[i]; if (Math.abs(c[0] - b[0]) < 1e-6 && Math.abs(c[1] - b[1]) < 1e-6) b = e; else { put(); [a, b] = [c, e]; } } put(); });
  // The eaves: the outline of the cells.
  let eave = ""; cellsU.forEach(([x, y]) => { if (!inU(x, y - 1)) eave += `M${F(x)} ${F(y)}H${F(x + 1)}`; if (!inU(x, y + 1)) eave += `M${F(x)} ${F(y + 1)}H${F(x + 1)}`; if (!inU(x - 1, y)) eave += `M${F(x)} ${F(y)}V${F(y + 1)}`; if (!inU(x + 1, y)) eave += `M${F(x + 1)} ${F(y)}V${F(y + 1)}`; });
  return { paths, ridge, hip, eave, cells: cellsU }; }
// The same roof plain-coloured and small, for a whole town at once (the town preview): drawn at 10 to a square, cached.
const GEN_ROOF_FLAT = new WeakMap();
function genRoofFlat(B, seed) { const hit = GEN_ROOF_FLAT.get(B); if (hit) return hit;
  const r = genRng((Number(seed) || 1) * 7 + 3), hue = [[12, 38, 36], [25, 18, 32], [215, 10, 38], [30, 30, 30]][Math.floor(r() * 4)], P = 10, shade = ["rgba(255,240,210,.12)", "rgba(0,0,0,.08)", "rgba(0,0,0,.30)", "rgba(0,0,0,.18)"];
  const top = genRoofTops(B), steps = [...new Set(top.values())].sort((a, b) => a - b); let out = "";
  steps.forEach(v => { const U = new Set([...top].filter(([, t]) => t >= v).map(([c]) => c)); if (!U.size) return; const R = genRoofFacets(U, B.W, B.H, P);
    R.paths.forEach((d, k) => { if (d) out += `<path d="${d}" fill="hsl(${hue[0]} ${hue[1]}% ${hue[2] + 6}%)"/><path d="${d}" fill="${shade[k]}"/>`; });
    out += `<path d="${R.hip}${R.ridge}" stroke="rgba(0,0,0,.4)" stroke-width="1.2" fill="none"/><path d="${R.eave}" stroke="#2b2520" stroke-width="1.5" fill="none"/>`; });
  if (B.F.porch) { const g = B.F.porch; out += `<rect x="${g.x * P}" y="${g.y * P}" width="${g.w * P}" height="${g.h * P}" fill="hsl(${hue[0]} ${hue[1]}% ${hue[2] + 10}%)" stroke="#2b2520" stroke-width="1.2"/>`; }
  GEN_ROOF_FLAT.set(B, out); return out; }
function genRoofSvg(B, seed) {
  const hit = GEN_ROOF_CACHE.get(B); if (hit && hit.seed === seed) return hit.svg;
  const r = genRng((Number(seed) || 1) * 7 + 3), P = GEN_PX, F = B.F, hue = [[12, 38, 36], [25, 18, 32], [215, 10, 38], [30, 30, 30]][Math.floor(r() * 4)];
  // Shingles as two tiles, courses running along the eaves: across the map on the north and south slopes, up it on the east and west.
  let sh = ""; const TW = P * 3, TH = P; for (let y = 0; y < TH - 0.1; y += P / 3) { let x = -r() * P / 2; while (x < TW) { const w = Math.min(P * (0.35 + r() * 0.3), TW - x); if (w > 1) sh += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(P / 3).toFixed(1)}" fill="${genHsl(hue[0], hue[1], hue[2], 4, r)}" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>`; x += w; } }
  let out = `<defs><pattern id="rsh" patternUnits="userSpaceOnUse" width="${TW}" height="${TH}">${sh}</pattern><pattern id="rsv" patternUnits="userSpaceOnUse" width="${TH}" height="${TW}"><g transform="matrix(0 1 1 0 0 0)">${sh}</g></pattern></defs>`;
  const shade = ["rgba(255,240,210,.10)", "rgba(0,0,0,.08)", "rgba(0,0,0,.30)", "rgba(0,0,0,.18)"];
  const top = genRoofTops(B), steps = [...new Set(top.values())].sort((a, b) => a - b); let prev = "";
  steps.forEach((v, i) => { const U = new Set([...top].filter(([, t]) => t >= v).map(([c]) => c)); if (!U.size) return;
    const R = genRoofFacets(U, B.W, B.H, P);
    if (i > 0) out += `<clipPath id="rsc${i}"><path d="${prev}"/></clipPath><path clip-path="url(#rsc${i})" d="${R.cells.map(([x, y]) => `M${x * P + 4} ${y * P + 6}h${P}v${P}h${-P}Z`).join("")}" fill="rgba(0,0,0,.35)"/>`; // the taller part's shadow, on the roof below only
    prev = R.cells.map(([x, y]) => `M${x * P} ${y * P}h${P}v${P}h${-P}Z`).join("");
    R.paths.forEach((d, k) => { if (d) out += `<path d="${d}" fill="url(#${k % 2 ? "rsv" : "rsh"})"/><path d="${d}" fill="${shade[k]}"/>`; });
    out += `<path d="${R.hip}" stroke="rgba(0,0,0,.4)" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="${R.ridge}" stroke="#2b2520" stroke-width="5" fill="none" stroke-linecap="round"/><path d="${R.eave}" stroke="#2b2520" stroke-width="5" fill="none" stroke-linecap="square"/>`; });
  if (F.porch) { const g = F.porch, X = g.x * P, Y = g.y * P, W = g.w * P, H = g.h * P; let ln = ""; for (let y = Y + 6; y < Y + H; y += 7) ln += `<line x1="${X}" y1="${y}" x2="${X + W}" y2="${y}" stroke="rgba(0,0,0,.3)" stroke-width="1.2"/>`;
    out += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${genHsl(hue[0], hue[1], hue[2] + 6, 0, r)}" stroke="#2b2520" stroke-width="4"/>${ln}`; }
  // A chimney over each fireplace stack, at the wall the hearth is against; two fires back to back share one wide chimney.
  const off = { t: [0, -0.15], b: [0, 0.15], l: [-0.15, 0], r: [0.15, 0] }, pts = [];
  // A louvre (a little roofed vent) over each open hearth.
  B.levels.forEach(L => (L.hearths || []).filter(h => h.central).forEach(h => { const cx = (h.x + 0.5) * P, cy = (h.y + 0.5) * P, w = P * 0.8;
    out += `<rect x="${cx - w / 2 + 3}" y="${cy - w / 2 + 4}" width="${w}" height="${w}" fill="rgba(0,0,0,.3)"/><rect x="${cx - w / 2}" y="${cy - w / 2}" width="${w}" height="${w}" fill="#6b5a48" stroke="#2b2520" stroke-width="2.5"/>` +
      [0.25, 0.5, 0.75].map(f => `<line x1="${cx - w / 2 + 3}" y1="${cy - w / 2 + w * f}" x2="${cx + w / 2 - 3}" y2="${cy - w / 2 + w * f}" stroke="#2b2520" stroke-width="2"/>`).join("") + `<line x1="${cx}" y1="${cy - w / 2}" x2="${cx}" y2="${cy + w / 2}" stroke="#2b2520" stroke-width="1.5"/>`; }));
  (B.chimneys || []).forEach(st => { const [dx, dy] = off[st.side], px = st.x + 0.5 + dx, py = st.y + 0.5 + dy, near = pts.find(q => Math.hypot(q.x - px, q.y - py) < 0.5);
    if (near) { near.x = (near.x + px) / 2; near.y = (near.y + py) / 2; near.n = 2; near.wide = st.side === "l" || st.side === "r" ? "y" : "x"; } else pts.push({ x: px, y: py, n: 1, side: st.side }); });
  pts.forEach(q => { const w = q.n > 1 && q.wide === "y" ? 0.7 : q.n > 1 ? 1.1 : 0.7, h = q.n > 1 && q.wide === "y" ? 1.1 : 0.7, cx = q.x * P, cy = q.y * P;
    const pots = q.n > 1 ? (q.wide === "y" ? [[0, -0.25], [0, 0.25]] : [[-0.25, 0], [0.25, 0]]) : [[0, 0]];
    out += `<rect x="${cx - w * P / 2 + 3}" y="${cy - h * P / 2 + 4}" width="${w * P}" height="${h * P}" fill="rgba(0,0,0,.35)"/><rect x="${cx - w * P / 2}" y="${cy - h * P / 2}" width="${w * P}" height="${h * P}" fill="#7d7266" stroke="#2b2520" stroke-width="3"/>` +
      pots.map(([a, b]) => `<rect x="${cx + a * P - P * .14}" y="${cy + b * P - P * .14}" width="${P * .28}" height="${P * .28}" fill="#1e1a16"/>`).join(""); });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B.W * P} ${B.H * P}" width="${B.W * P}" height="${B.H * P}">${out}</svg>`;
  GEN_ROOF_CACHE.set(B, { seed, svg }); return svg;
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
function genPage(o, opt) {
  const B = genBuilding(o), ext = [], F = B.F, m = 3, ox = m, oy = m, W = B.W + m * 2, H = B.H + m * 2 + 1, id = () => vid("o");
  const objs = [], walls = [], areas = [], links = [], names = {}, P = GEN_PX;
  const cells = set => [...set].map(k => { const [x, y] = k.split(",").map(Number); return [ox + x, oy + y]; });
  const porchCells = F.porch ? Array.from({ length: F.porch.w * F.porch.h }, (_, i) => (F.porch.x + i % F.porch.w) + "," + (F.porch.y + Math.floor(i / F.porch.w))) : [];
  const fr = [...B.levels.find(L => L.level === 0).front].map(k => Number(k.split(",")[1])), fx = fr.length ? Math.min(...fr) : B.W / 2, fw = fr.length;
  const frY = fr.length ? Number([...B.levels.find(L => L.level === 0).front][0].split(",")[2]) : null, pBelow = B.custom && fr.length && F.porch && F.porch.y === frY && fx >= F.porch.x && fx < F.porch.x + F.porch.w;
  const pathTop = oy + (B.custom ? (pBelow ? F.porch.y + F.porch.h : frY == null ? B.H : frY) : F.porch ? F.porch.y + F.porch.h : F.main.y + F.main.h);
  objs.push({ id: id(), layer: "map", level: 0, x: 0, y: 0, w: W, h: H, img: genUrl(genYardSvg(W, H, fw ? { x: ox + fx - 0.25, y: pathTop, w: fw + 0.5 } : null, o.seed)) });
  B.levels.forEach(L => {
    objs.push({ id: id(), layer: "map", level: L.level, x: ox - GEN_PAD, y: oy - GEN_PAD, w: B.W + GEN_PAD * 2, h: B.H + GEN_PAD * 2, img: genUrl(genFloorSvg(B, L, false, o.seed)) });
    // The furniture: each piece its own object on the map layer, on the grid, so you can move, turn or delete it.
    genFurnBoxes(L).forEach(f => objs.push(Object.assign({ id: id(), layer: "map", level: L.level, x: ox + f.x, y: oy + f.y, w: f.w, h: f.h, img: f.src, name: f.a.name, furn: 1 }, f.rot ? { rot: f.rot } : {})));
    objs.push({ id: id(), layer: "gm", level: L.level, x: ox, y: oy, w: B.W, h: B.H, img: genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B.W * P} ${B.H * P}" width="${B.W * P}" height="${B.H * P}">${L.rooms.map(rm => `<text x="${(rm.x + rm.w / 2) * P}" y="${(rm.y + rm.h / 2) * P}" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${esc(rm.n)}${rm.secret ? " (secret)" : ""}</text>`).join("")}</svg>`) });
    const gt = L.gates || new Set();
    genEdges(L, B.W, B.H).forEach(e => { if (gt.has(e.k)) return; const meta = L.doors.has(e.k) ? Object.assign({ k: "door", id: vid("d"), open: false }, L.secret.has(e.k) ? { secret: true } : {}) : L.wins.has(e.k) ? { k: "window", id: vid("d") } : null;
      walls.push([ox + e.x1, oy + e.y1, ox + e.x2, oy + e.y2, L.level].concat(meta ? [meta] : [])); ext.push(!!e.ext); });
    // A gate is one door the whole width of the passage, opened all at once.
    genGateRuns(gt).forEach(g => ext.push(true) && walls.push(g.d === "h" ? [ox + g.a, oy + g.c, ox + g.b, oy + g.c, L.level, { k: "door", id: vid("d"), open: false, gate: true }] : [ox + g.c, oy + g.a, ox + g.c, oy + g.b, L.level, { k: "door", id: vid("d"), open: false, gate: true }]));
    if (L.level > 0) { const set = new Set(); L.rooms.forEach(rm => { for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) set.add(x + "," + y); }); areas.push({ id: vid("a"), level: L.level, cells: cells(set) }); } // only where there's a floor (a loft, not the open hall)
    if (L.level < 0) { const set = new Set(); L.rooms.forEach(rm => { for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) set.add(x + "," + y); }); areas.push({ id: vid("a"), level: L.level, cells: cells(set) }); }
    names[L.level] = L.name;
  });
  const roofLvl = B.floors; names[roofLvl] = "Roof";
  objs.push({ id: id(), layer: "map", level: roofLvl, x: ox, y: oy, w: B.W, h: B.H, img: genUrl(genRoofSvg(B, o.seed)) });
  areas.push({ id: vid("a"), level: roofLvl, cells: cells(F.body) });
  if (porchCells.length) areas.push({ id: vid("a"), level: roofLvl, cells: cells(new Set(porchCells)) }); // its own roof: stepping onto the porch lifts only that
  // One stairs link per staircase: each joins its two floors only.
  (B.stairs || []).forEach(t => links.push({ id: vid("l"), kind: "stairs", x: ox + t.x, y: oy + t.y, w: t.w, h: t.h, levels: [t.lo, t.lo + 1] }));
  if (opt && opt.split) return { B, walls, ext, page: { objs, areas, links, roofLvl } }; // a town loads a building's inside on its own (town.js)
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
const genKeep = o => ({ type: o.type, seed: o.seed, size: o.size, floors: o.floors, cellar: o.cellar, shape: o.shape || "auto", porch: o.porch || "auto", furn: o.furn !== false, furnRe: o.furnRe || {}, name: o.name, tags: o.tags || [], ...(o.custom ? { custom: o.custom } : {}) });
function viewGen(camp, kind, type) {
  const c = S.vttCamps && S.vttCamps.get(camp); if (!vCanEdit()) return `<section class="page"><p class="muted">Only the GM can use the generators.</p></section>`;
  if (!c) return `<section class="page"><p class="muted">${S.vttCamps ? "That campaign isn't here any more." : "Opening…"}</p></section>`;
  const back = `<a href="#camp-${esc(camp)}" class="vback">← ${esc(c.name || "Campaign")}</a>`;
  if (!kind) {
    const card = (k, icon, t, d, ready) => ready ? `<a class="gencard" href="#gen-${esc(camp)}/${k}"><span class="genicon">${icon}</span><strong>${t}</strong><span class="muted small">${d}</span></a>` : `<div class="gencard soon" aria-disabled="true"><span class="genicon">${icon}</span><strong>${t}</strong><span class="muted small">${d}</span><span class="gensoon">Coming later</span></div>`;
    return `<section class="page">${back}<h1>Generator</h1><p class="muted">Make maps for ${esc(c.name || "this campaign")}, ready to play on the tabletop.</p>
      <div class="gencards">${card("building", "🏠", "Buildings", "Houses, shops, taverns, temples: every floor, room, door and stair.", true)}${card("furniture", "🪑", "Furniture", "The pieces buildings are furnished with: see them, change them, add your own.", true)}${card("village", "🏡", "Villages", "Houses along the roads, the church and mill, fields, woods, rivers and mountains.", true)}${card("town", "🏘", "Towns", "Streets from the gates to the market place, burgage plots, lanes, the church, the wall: every building opens up as you come near.", true)}${card("city", "🏰", "Cities", "Whole cities, opened a street or building at a time.")}${card("dungeon", "🕳", "Dungeons", "Rooms, corridors and caves.")}</div></section>`;
  }
  if (kind === "furniture") return genFurnView(camp, back);
  if (kind === "village") return viewVillageGen(camp);
  if (kind === "town") return viewTownGen(camp);
  if (kind === "building" && !type) {
    const saved = vPages(VGEN).filter(([, p]) => p.gen), tagSet = new Set(saved.flatMap(([, p]) => p.gen.tags || [])), tf = GEN.tag || "";
    const shown = saved.filter(([, p]) => !tf || (p.gen.tags || []).includes(tf));
    return `<section class="page">${back}<h1>Buildings</h1><p class="muted">Pick a kind of building.</p>
      <div class="gencards"><a class="gencard gencustom" href="#gen-${esc(camp)}/building/custom" data-act="gednew"><span class="genicon">✏️</span><strong>Custom building</strong><span class="muted small">Draw your own: rooms, doors, windows, stairs and floors. The furniture fills itself in.</span></a></div>
      ${[["village", "Village buildings"], ["", "Town buildings"], ["city", "City buildings"], ["magic", "Magic buildings"]].map(([g, title]) => `<h2 class="sect">${title}</h2><div class="gencards">${GEN_BUILDINGS.filter(b => (b.group || "") === g).map(b => `<a class="gencard" href="#gen-${esc(camp)}/building/${b.id}"><span class="genicon">${b.icon}</span><strong>${esc(b.name)}</strong><span class="muted small">${esc(b.blurb)}</span></a>`).join("")}</div>`).join("")}
      <h2 class="sect">Your buildings <span>${saved.length}</span></h2>
      ${tagSet.size ? `<div class="gentags">${["", ...[...tagSet].sort()].map(t => `<button class="chip${tf === t ? " on" : ""}" data-act="gentagf" data-v="${esc(t)}">${t ? esc(t) : "All"}</button>`).join("")}</div>` : ""}
      ${shown.length ? `<div class="gensaved">${shown.map(([pid, p]) => { const g = p.gen, T = genType(g.type), plan = (p.objs || []).find(x => x.layer === "map" && (x.level || 0) === 0 && x.x > 0);
        return `<article class="gensave"><div class="genthumb">${plan ? `<img src="${esc(plan.img)}" alt="">` : ""}</div><div class="gensavebody"><strong>${esc(p.name)}</strong><span class="muted small">${T.icon} ${esc(T.name)}${g.custom ? "" : ` · ${esc(g.size)}`}</span>${(g.tags || []).length ? `<span class="gentaglist">${g.tags.map(t => `<span class="chip small">${esc(t)}</span>`).join("")}</span>` : ""}
          <div class="acts"><button class="btn small" data-act="genplace" data-id="${esc(pid)}" data-camp="${esc(camp)}">Place in the campaign</button><a class="btn ghost small" href="#gen-${esc(camp)}/building/${esc(g.type)}" data-act="genedit" data-id="${esc(pid)}">Edit</a><button class="btn ghost small danger" data-act="gendel" data-id="${esc(pid)}">Delete</button></div></div></article>`; }).join("")}</div>`
        : `<p class="muted small">${saved.length ? "None with that tag." : "None yet. Generate one and press Save."}</p>`}</section>`;
  }
  if (kind === "building" && type === "custom") return viewGenCustom(camp);
  if (kind === "building") {
    const T = genType(type); if (!GEN.o || GEN.o.type !== T.id || GEN.o.camp !== camp) GEN.o = Object.assign(genDefaults(T.id), { camp });
    const o = GEN.o, seg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? "on" : ""}" data-act="genopt" data-k="${k}" data-v="${v}" aria-pressed="${String(o[k]) === String(v)}">${l}</button>`).join("")}</div>`;
    return `<section class="page genpage"><a href="#gen-${esc(camp)}/building" class="vback">← Buildings</a>
      <h1>${T.icon} ${esc(T.name)}</h1><p class="muted">${esc(T.blurb)}</p>
      <div class="genlayout"><div class="genopts">
        <label><span>Size</span>${seg("size", [["small", "Small"], ["medium", "Medium"], ["large", "Large"]])}</label>
        <label><span>Floors</span>${seg("floors", [["auto", "Any"], [1, "1"], [2, "2"], [3, "3"], [4, "4"]].slice(0, T.plan ? 1 + (T.floorsMax || 1) : 4))}</label>
        <label><span>Cellar</span>${seg("cellar", [["auto", "Maybe"], ["yes", "Yes"], ["no", "No"]])}</label>
        ${T.plan ? "" : `<label><span>Shape</span>${seg("shape", [["auto", "Any"], ...Object.keys(T.shapes).map(k => [k, ({ rect: "Box", L: "L", U: "U", long: "Long" })[k]])])}</label>`}
        <label><span>Porch</span>${seg("porch", [["auto", "Maybe"], ["yes", "Yes"], ["no", "No"]])}</label>
        <label class="genchk"><input type="checkbox" data-act="genchk" data-k="furn"${o.furn !== false ? " checked" : ""}> <span>Furniture <small class="muted">each piece movable on the tabletop · <a href="#gen-${esc(camp)}/furniture">the pieces</a></small></span></label>
        <label class="genchk"><input type="checkbox" data-act="genchk" data-k="overlay"${o.overlay ? " checked" : ""}> <span>Show grid, walls, doors &amp; windows <small class="muted">as the tabletop will use them</small></span></label>
        ${genDetailSeg()}
        <button class="btn" data-act="genroll">🎲 New layout</button>
        <label><span>Seed <small class="muted">the same seed makes the same building</small></span><input id="gen-seed" type="number" value="${o.seed}"></label>
        <hr>
        <label><span>Name</span><input id="gen-name" type="text" value="${esc(o.name)}" placeholder="${esc(T.name)}"></label>
        <label><span>Tags <small class="muted">comma between, e.g. poor, docks, stone</small></span><input id="gen-tags" type="text" value="${esc((o.tags || []).join(", "))}"></label>
        <div class="acts"><button class="btn" data-act="gensave">${o.pid ? "Save changes" : "Save to your buildings"}</button><button class="btn ghost" data-act="genplace" data-camp="${esc(camp)}">Place in the campaign</button></div>
        <button class="btn ghost" data-act="gencopy" title="Open this layout in the custom building maker, to move rooms, doors and stairs yourself">✏️ Edit a copy by hand</button>
      </div><div class="genpreview" id="genpreview">${genPreviewHtml(o)}</div></div></section>`;
  }
  return `<section class="page">${back}<p class="muted">Nothing here yet.</p></section>`;
}
function genPreviewHtml(o) {
  const B = genBuilding(o), levels = B.levels.slice().sort((a, b) => b.level - a.level), rooms = B.levels.reduce((a, L) => a + L.rooms.filter(x => !x.circ && !x.porch).length, 0);
  const lib = genFurnLib(), nF = B.levels.reduce((a, L) => a + (L.furn || []).length, 0), TW = B.W + GEN_PAD * 2, TH = B.H + GEN_PAD * 2;
  // A floor: its picture, the furniture on it (each piece its own picture, turned, as on the tabletop), then names and the overlay.
  const floor = L => `<div class="genflw" style="width:min(${TW * GEN_PX + 20}px, 100%)"><div class="genfl" style="aspect-ratio:${TW} / ${TH}"><img src="${genUrl(genFloorSvg(B, L, false, o.seed, false, "base"))}" alt="${esc(L.name)}">${genFurnBoxes(L, lib).map(f => `<img class="genfp" src="${esc(f.src)}" alt="" title="${esc(f.a.name)}" style="left:${((f.x + GEN_PAD) / TW * 100).toFixed(3)}%;top:${((f.y + GEN_PAD) / TH * 100).toFixed(3)}%;width:${(f.w / TW * 100).toFixed(3)}%;height:${(f.h / TH * 100).toFixed(3)}%${f.rot ? `;transform:rotate(${f.rot}deg)` : ""}">`).join("")}<img class="genfp gentop" src="${genUrl(genFloorSvg(B, L, true, o.seed, o.overlay, "top"))}" alt="">${o.furn !== false ? L.rooms.map((rm, i) => (rm.circ && rm.n !== "Cellar stairs") ? "" : `<button class="genreroom" data-act="genreroom" data-k="${L.level}:${i}" title="New furniture for the ${esc(rm.n.toLowerCase())}" aria-label="New furniture for the ${esc(rm.n.toLowerCase())}" style="left:${((rm.x + GEN_PAD + 0.12) / TW * 100).toFixed(3)}%;top:${((rm.y + GEN_PAD + 0.12) / TH * 100).toFixed(3)}%">🎲</button>`).join("") : ""}</div></div>`;
  return `<p class="small"><strong>${B.W} × ${B.H} squares</strong> <span class="muted">(${B.W * 5} × ${B.H * 5} ft) · ${esc(B.F.shapeName || GEN_SHAPES[B.F.shape])}${B.F.porch ? " with a porch" : ""} · ${B.floors} floor${B.floors === 1 ? "" : "s"}${B.cellar ? " and a cellar" : ""} · ${rooms} rooms${o.furn !== false ? ` · ${nF} pieces of furniture` : ""}</span>${o.furn !== false ? `<br><span class="muted">🎲 on a room gives it new furniture${Object.keys(o.furnRe || {}).length ? ` · <button class="linkbtn" data-act="genrereset">put every room back as it was</button>` : ""}</span>` : ""}${B.rare.length ? `<br><span class="genrare">✦ Something unusual: ${esc(B.rare.join(", "))}</span>` : ""}</p>
    <div class="genfloors"><figure><img src="${genUrl(genRoofSvg(B, o.seed))}" alt="The roof"><figcaption>Roof</figcaption></figure>${levels.map(L => `<figure>${floor(L)}<figcaption>${esc(L.name)}</figcaption></figure>`).join("")}</div>`;
}
const genRefresh = () => { const el = document.getElementById("genpreview"); if (el && GEN.o) el.innerHTML = genPreviewHtml(GEN.o); if (GEN.o && GEN.o.custom && typeof gedPaint === "function") gedPaint(false); };
const genReadForm = () => { const o = GEN.o; if (!o) return; const n = document.getElementById("gen-name"), t = document.getElementById("gen-tags"); if (n) o.name = n.value.trim(); if (t) o.tags = t.value.split(",").map(x => x.trim()).filter(Boolean); };
// The pictures as files: each drawn once onto a canvas and uploaded (WebP where the browser can, else PNG), so a map is a
// few small links instead of megabytes of drawing that every screen redraws. Without uploads they stay in the map as drawings.
// How sharp generated maps are drawn: pixels per square of the most detailed copy (the board shows smaller copies when
// zoomed out, so more detail costs only upload time and space, not speed). Kept on this device.
const GEN_DETAIL = { standard: 40, high: 80, ultra: 120 };
const genDetail = () => { try { return GEN_DETAIL[localStorage.getItem("codex.mapDetail")] ? localStorage.getItem("codex.mapDetail") : "high"; } catch (e) { return "high"; } };
const genDetailPx = () => GEN_DETAIL[genDetail()];
const genDetailSeg = () => `<label><span>Detail <small class="muted">how sharp it is close up</small></span><div class="seg" role="group">${[["standard", "Standard"], ["high", "High"], ["ultra", "Ultra"]].map(([v, l]) => `<button class="${genDetail() === v ? "on" : ""}" data-act="gendetail" data-v="${v}" aria-pressed="${genDetail() === v}">${l}</button>`).join("")}</div></label>`;
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-act=gendetail]"); if (!b) return; try { localStorage.setItem("codex.mapDetail", b.dataset.v); } catch (e) { }
  b.parentElement.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); });
// One picture as an image pyramid: drawn once at full detail, then halved again and again down to about 10 pixels a square
// (small pictures, a chair, just the one copy). Returns { img, lod: [[px, url], …] } (most detailed copy first in lod).
async function genPyramid(svgUrl, w, h, px) {
  if (!S.assets || !S.assets.upload) return { img: svgUrl };
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = svgUrl; });
  const up = async cv => { const blob = await new Promise(res => cv.toBlob(res, "image/webp", 0.88)); if (!blob) throw new Error("no image"); const type = blob.type || "image/png";
    return assetPath(await S.assets.upload(new File([blob], "generated." + (type.includes("webp") ? "webp" : "png"), { type }))); };
  let cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w * px)); cv.height = Math.max(1, Math.round(h * px)); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
  const img = await up(cv); if (w * h <= 6) { cv.width = cv.height = 0; return { img }; }
  const lod = []; let p = px;
  while (p / 2 >= 10) { p /= 2; const c2 = document.createElement("canvas"); c2.width = Math.max(1, Math.round(w * p)); c2.height = Math.max(1, Math.round(h * p)); const g = c2.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(cv, 0, 0, c2.width, c2.height);
    cv.width = cv.height = 0; cv = c2; lod.push([p, await up(cv)]); }
  cv.width = cv.height = 0; return { img, lod };
}
// The pictures as files: each drawn once onto a canvas and uploaded, with its smaller copies, so a map is a few small links
// instead of megabytes of drawing that every screen redraws. Without uploads they stay in the map as drawings.
async function genStoreImages(page, msg) {
  if (!S.assets || !S.assets.upload) return page;
  const done = new Map(), px = genDetailPx(), todo = page.objs.filter(o => String(o.img).startsWith("data:image/svg")); let n = 0; // the same picture (a chair, say) is uploaded once
  const bar = typeof tnProgress === "function" ? tnProgress : () => {}; bar((msg || "Drawing the building") + "…", 0);
  try { for (const o of page.objs) {
    if (!String(o.img).startsWith("data:image/svg")) continue; if (++n % 3 === 0) bar(`${msg || "Drawing the building"}… ${n} of ${todo.length} pictures`, n / todo.length);
    if (done.has(o.img)) { Object.assign(o, done.get(o.img)); continue; } const was = o.img;
    try { const r = await genPyramid(o.img, o.w, o.h, px); o.img = r.img; if (r.lod) o.lod = r.lod; done.set(was, r.lod ? { img: r.img, lod: r.lod } : { img: r.img }); } catch (e) { /* keep the drawing in the map */ }
  } } finally { bar(null); }
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
  if (a === "genopt" && GEN.o) { GEN.o[b.dataset.k] = b.dataset.v; GEN.o.furnRe = {}; b.parentElement.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); genRefresh(); return; }
  if (a === "genchk" && GEN.o) { GEN.o[b.dataset.k] = b.checked; genRefresh(); return; }
  if (a === "genreroom" && GEN.o) { const re = Object.assign({}, GEN.o.furnRe); re[b.dataset.k] = (re[b.dataset.k] || 0) + 1; GEN.o.furnRe = re; genRefresh(); return; }
  if (a === "genrereset" && GEN.o) { GEN.o.furnRe = {}; genRefresh(); return; }
  if (a === "genroll" && GEN.o) { GEN.o.furnRe = {}; GEN.o.seed = genSeed(); const s = document.getElementById("gen-seed"); if (s) s.value = GEN.o.seed; genRefresh(); return; }
  if (a === "gentagf") { GEN.tag = b.dataset.v; render(); return; }
  if (a === "gensave" && GEN.o) { genReadForm(); b.disabled = true; GEN.o.pid = await genSaveLib(GEN.o); b.disabled = false; b.textContent = "Save changes"; toast("Saved to your buildings."); return; }
  if (a === "genplace") { ev.preventDefault(); let o = GEN.o; if (b.dataset.id) { const p = S.vttPages.get(b.dataset.id); if (!p || !p.gen) return; o = Object.assign({}, p.gen, { name: p.name }); } else genReadForm(); if (o) genPlace(b.dataset.camp, o); return; }
  if (a === "genedit") { const p = S.vttPages.get(b.dataset.id); if (p && p.gen) GEN.o = Object.assign({}, p.gen, { name: p.name, pid: b.dataset.id, camp: (route() || {}).camp }); return; }
  if (a === "gendel") { const p = S.vttPages.get(b.dataset.id); if (!p) return; if (await confirmBox(`Delete “${p.name}” from your buildings?`, "Delete")) await vDel("vttpages/" + b.dataset.id); return; }
});
document.addEventListener("change", ev => { if (ev.target && ev.target.id === "gen-seed" && GEN.o) { GEN.o.furnRe = {}; GEN.o.seed = Math.max(1, Math.round(Number(ev.target.value)) || 1); genRefresh(); } });
