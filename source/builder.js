// ===== Custom buildings: draw your own =====
// A custom building is a plan you draw: each floor's rooms (rectangles on the grid), its doors, windows, gates and front
// door, and the stairs between floors. It's built the same way as a generated one (genCustomTry), so the floors are drawn,
// the fireplaces placed and the rooms furnished by the same code, and it saves, places and rerolls its furniture the same.
// o.custom = { W, H, doorTier, levels: [{ level, name, rooms: [{ x, y, w, h, n, k, fl, …flags }], doors, wins, front, gates,
// secret }], stairs: [{ x, y, w, h, lo, toward }] } — a stair joins floors lo and lo + 1; toward is the end you walk to on lo.

// The kinds of room you can draw: [name, floor kind, flags]. The name is also its furniture list.
const GEN_ROOM_TYPES = [
  ["Home", [["Hall", "hall"], ["Living room", "living"], ["Parlour", "living"], ["Kitchen", "kitchen"], ["Pantry", "store"], ["Buttery", "store"], ["Bedroom", "bed"], ["Chamber", "bed"], ["Great chamber", "bed"], ["Solar", "bed"], ["Nursery", "bed"], ["Study", "library"], ["Library", "library"], ["Privy", "privy"], ["Storeroom", "store"], ["Entry passage", "passage"], ["Landing", "landing", { circ: 1 }], ["Porch", "porch", { porch: 1 }], ["Empty room", "living", { fl: "-" }]]],
  ["Shops & trades", [["Shop", "shop"], ["Workshop", "work"], ["Forge", "forge"], ["Counting house", "office"], ["Office", "office"], ["Warehouse", "store"], ["Bread shop", "shop"], ["Oven room", "bake"], ["Apothecary's shop", "shop"], ["Still room", "lab"], ["Butcher's shop", "shop"], ["Slaughterhouse", "slaughter"], ["Salting room", "store"], ["Timber store", "store"], ["Kiln room", "work"], ["Loom room", "work"], ["Market arcade", "market", { arcade: 1 }]]],
  ["Inn & hall", [["Tap room", "tavern"], ["Common room", "tavern"], ["Guest chamber", "bed"], ["Best chamber", "bed"], ["Great hall", "hall"], ["Meeting room", "meet"], ["Court room", "hall"], ["Council chamber", "office"], ["Gambling den", "tavern"], ["Bathhouse", "bath"], ["Training room", "work"], ["Fighting pit", "pit"]]],
  ["Farm & stable", [["Stables", "stall"], ["Hay store", "hay"], ["Byre", "byre"], ["Tack room", "store"], ["Dairy", "store"], ["Grain store", "store"], ["Threshing floor", "threshing"], ["Brewhouse", "work"]]],
  ["Temple", [["Nave", "temple"], ["Chancel", "temple"], ["Sanctum", "sanctum"], ["Shrine", "temple"], ["Vestry", "store"], ["Priest's room", "bed"], ["Crypt", "vault"]]],
  ["Guard & gate", [["Guard room", "work"], ["Armoury", "store"], ["Guard chamber", "bed"], ["Captain's room", "office"], ["Gate passage", "passage", { gate: 1, dark: 1 }], ["Lock-up", "cellar"]]],
  ["Below ground", [["Cellar", "cellar"], ["Wine cellar", "cellar"], ["Beer cellar", "cellar"], ["Undercroft", "vault"], ["Vault", "vault"], ["Strongroom", "vault"], ["Smuggler's hole", "cellar"]]],
];
const gedTypes = () => GEN_ROOM_TYPES.flatMap(([, l]) => l);
const gedType = name => gedTypes().find(t => t[0] === name);
const gedLevelName = lv => lv < 0 ? "Cellar" : ["Ground floor", "First floor", "Second floor", "Third floor"][lv] || `Floor ${lv + 1}`;
const gedRoomFrom = (name, rect) => { const t = gedType(name) || ["Room", "living"], f = t[2] || {}; return Object.assign({ n: t[0], k: t[1], fl: t[0] }, f, rect); };
const gedBlank = () => ({ W: 14, H: 10, doorTier: "framed", levels: [{ level: 0, rooms: [], doors: [], wins: [], front: [], gates: [], secret: [] }], stairs: [] });
const gedKeyCells = k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); return d === "h" ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]; };

// Build a building from a drawn plan.
function genCustomTry(o) {
  const C = o.custom, W = C.W, H = C.H, stairs = (C.stairs || []).map(t => Object.assign({}, t));
  const levels = C.levels.slice().sort((a, b) => a.level - b.level).map(l => ({ level: l.level, name: l.name || gedLevelName(l.level), rooms: l.rooms.map(rm => Object.assign({}, rm)) }));
  levels.forEach(L => {
    const l = C.levels.find(q => q.level === L.level);
    L.own = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return -1; return L.rooms.findIndex(rm => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h); };
    L.stairs = stairs.filter(t => t.lo === L.level || t.lo + 1 === L.level).map(t => Object.assign({}, t, { dir: L.level === t.lo ? "up" : "down", toward: L.level === t.lo ? t.toward : (t.toward === "a" ? "b" : "a") }));
    // Openings only where there's a wall now (a room moved or deleted takes its doors with it).
    const edges = new Set(genEdges(L, W, H).map(e => e.k)), on = k => edges.has(k);
    L.doors = new Set((l.doors || []).filter(on)); L.wins = new Set((l.wins || []).filter(k => on(k) && !L.doors.has(k)));
    L.front = new Set((l.front || []).filter(k => L.doors.has(k))); L.gates = new Set((l.gates || []).filter(k => L.doors.has(k))); L.secret = new Set((l.secret || []).filter(k => L.doors.has(k)));
  });
  // The footprint: every square with a floor (the roof covers it), the ground floor's porch under its own lean-to.
  const body = new Set(), G = levels.find(L => L.level === 0) || { rooms: [] }, porchRm = G.rooms.find(rm => rm.porch);
  levels.filter(L => L.level >= 0).forEach(L => L.rooms.forEach(rm => { if (rm.porch) return; for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) body.add(x + "," + y); }));
  const wings = [], used = new Set(); // the roof: the footprint cut into rectangles, each with its own hipped roof
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = x + "," + y; if (!body.has(k) || used.has(k)) continue;
    let w = 1; while (x + w < W && body.has((x + w) + "," + y) && !used.has((x + w) + "," + y)) w++;
    let h = 1; while (y + h < H && Array.from({ length: w }, (_, i) => (x + i) + "," + (y + h)).every(c => body.has(c) && !used.has(c))) h++;
    for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) used.add((x + a) + "," + (y + b)); wings.push({ x, y, w, h }); }
  const gr = G.rooms.filter(rm => !rm.porch), main = gr.length ? (() => { const x0 = Math.min(...gr.map(r => r.x)), y0 = Math.min(...gr.map(r => r.y)); return { x: x0, y: y0, w: Math.max(...gr.map(r => r.x + r.w)) - x0, h: Math.max(...gr.map(r => r.y + r.h)) - y0 }; })() : { x: 0, y: 0, w: W, h: H };
  const F = { W, H, main, wings, body, porch: porchRm ? { x: porchRm.x, y: porchRm.y, w: porchRm.w, h: porchRm.h } : null, shape: "custom", shapeName: "Custom building" };
  return { type: "custom", W, H, F, floors: levels.filter(L => L.level >= 0).length || 1, cellar: levels.some(L => L.level < 0), stairs, levels, rare: [], doorTier: C.doorTier || "framed", ok: true, attempt: 0, custom: 1 };
}

// A generated building as a plan you can change ("Edit a copy").
function gedFromB(B) {
  const lib = genFurnLib(), has = n => !!GEN_FURN_ROOMS[n] || lib.some(a => a.rooms && a.rooms[n]);
  const keep = ["x", "y", "w", "h", "n", "k", "porch", "arcade", "zone", "hub", "openY", "dark", "gate", "pass", "circ", "openHearth", "secret"];
  return { W: B.W, H: B.H, doorTier: B.doorTier || "framed",
    levels: B.levels.map(L => ({ level: L.level, name: L.name, rooms: L.rooms.map(rm => { const c = {}; keep.forEach((k, j) => { if (rm[k] != null && (j < 6 || (rm[k] !== 0 && rm[k] !== false))) c[k] = rm[k]; });
        const tk = B.type + ":" + rm.n; c.fl = has(tk) ? tk : has(rm.n) ? rm.n : B.plan ? "-" : (GEN_FURN_KIND[rm.k] || "-"); return c; }),
      doors: [...L.doors], wins: [...L.wins], front: [...(L.front || [])], gates: [...(L.gates || [])], secret: [...(L.secret || [])] })),
    stairs: (B.stairs || []).map(t => { const Llo = B.levels.find(L => L.level === t.lo), s = Llo && (Llo.stairs || []).find(q => q.x === t.x && q.y === t.y && q.w === t.w && q.h === t.h);
      return { x: t.x, y: t.y, w: t.w, h: t.h, lo: t.lo, toward: s ? s.toward : t.toward }; }) };
}

// What's wrong with a plan, in words: rooms you can't get into, floors no stairs reach, stairs with nowhere to step.
function gedCheck(B) {
  const out = [], G = B.levels.find(L => L.level === 0);
  if (!G || !G.rooms.length) return [{ lv: 0, msg: "Draw a room on the ground floor to start." }];
  B.levels.forEach(L => {
    const nm = L.name, own = L.own; if (!L.rooms.length) { out.push({ lv: L.level, msg: `${nm} has no rooms yet.` }); return; }
    const stairSq = new Set(); (L.stairs || []).forEach(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) stairSq.add(x + "," + y); });
    const starts = [];
    if (L.level === 0) {
      [...L.doors].forEach(k => { const [a, b] = gedKeyCells(k), ia = own(...a), ib = own(...b); if ((ia < 0) !== (ib < 0)) starts.push(ia < 0 ? b : a); });
      L.rooms.forEach((rm, i) => { if (!rm.porch && !rm.arcade) return; for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => own(x + dx, y + dy) < 0)) starts.push([x, y]); });
      if (!starts.length) out.push({ lv: 0, msg: "No way in: put a door (or the front door) on an outside wall of the ground floor." });
    } else {
      const arr = (L.stairs || []).filter(t => L.level > 0 ? t.dir === "down" : t.dir === "up");
      if (!arr.length) out.push({ lv: L.level, msg: `${nm}: no stairs reach it. Draw stairs on the floor ${L.level > 0 ? "below" : "above"}.` });
      arr.forEach(t => { const e = genStairEntry(L, t); if (e.ok) e.cells.forEach(c => starts.push(c.split(",").map(Number))); });
    }
    const pass = (x, y) => own(x, y) >= 0 && !stairSq.has(x + "," + y), seen = new Set(), q = [];
    starts.forEach(([x, y]) => { if (pass(x, y) && !seen.has(x + "," + y)) { seen.add(x + "," + y); q.push([x, y]); } });
    while (q.length) { const [x, y] = q.shift();
      for (const [nx, ny, key] of [[x, y - 1, `h,${x},${y}`], [x, y + 1, `h,${x},${y + 1}`], [x - 1, y, `v,${x},${y}`], [x + 1, y, `v,${x + 1},${y}`]]) {
        const k = nx + "," + ny; if (seen.has(k) || !pass(nx, ny)) continue; const a = own(x, y), b = own(nx, ny);
        if (!(a === b || L.doors.has(key) || (L.rooms[a].porch && L.rooms[b].porch) || genOpen(L.rooms[a], L.rooms[b]))) continue; seen.add(k); q.push([nx, ny]); } }
    if (starts.length) L.rooms.forEach(rm => { let ok = false; for (let x = rm.x; x < rm.x + rm.w && !ok; x++) for (let y = rm.y; y < rm.y + rm.h; y++) if (seen.has(x + "," + y)) { ok = true; break; }
      if (!ok) out.push({ lv: L.level, msg: `${nm}: the ${rm.n.toLowerCase()} can't be reached. Add a door to it.` }); });
    (L.stairs || []).forEach(t => { const where = `${nm}: the stairs ${t.dir === "up" ? "up" : "down"}`;
      let inside = true; for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) if (own(x, y) < 0) inside = false;
      if (!inside) { out.push({ lv: L.level, msg: `${where} stick out of the rooms on this floor.` }); return; }
      const e = genStairEntry(L, t); if (!e.ok) { out.push({ lv: L.level, msg: `${where} need a clear square to step on at the end, in the same room. Turn them round or move them.` }); return; }
      if (starts.length && !e.cells.every(c => seen.has(c))) out.push({ lv: L.level, msg: `${where} can't be reached.` }); });
  });
  return out;
}

// ----- The editor -----
const GED = { lv: 0, tool: "room", rt: "Hall", sel: null, hist: [], fut: [], sdir: "up", drag: null, hover: null };
const GED_TOOLS = [["room", "▭ Rooms", "Drag on the grid to draw a room. Pick its kind first."], ["select", "↖ Select", "Click a room to rename it, change its kind or delete it. Drag it to move it, drag its edge to resize it. Click stairs to turn them round."],
  ["door", "🚪 Door", "Click a wall for a door, or drag along it for a wide one."], ["window", "🪟 Window", "Click an outside wall for a window."], ["front", "⛩ Front door", "The main entrance, on a ground-floor wall with the street below it. Drag for double doors."],
  ["gate", "▥ Gate", "Drag along a wall: the whole run becomes one gate that opens at once, wide enough for a cart."], ["stairs", "▤ Stairs", "Drag out the stairs (2 or more squares long). They go up or down to the next floor, which must already have a room there."],
  ["clear", "▬ Wall", "Click or drag a door, window or gate to make it plain wall again."], ["erase", "✕ Erase", "Click a room or stairs to delete it."]];
const gedLevel = lv => GEN.o.custom.levels.find(l => l.level === lv);
const gedB = () => genBuilding(GEN.o);
function gedPush() { GED.hist.push(JSON.stringify(GEN.o.custom)); if (GED.hist.length > 80) GED.hist.shift(); GED.fut = []; }
function gedUndo(redo) { const from = redo ? GED.fut : GED.hist, to = redo ? GED.hist : GED.fut; if (!from.length) return; to.push(JSON.stringify(GEN.o.custom)); GEN.o.custom = JSON.parse(from.pop());
  if (!gedLevel(GED.lv)) GED.lv = 0; GED.sel = null; GEN.o.furnRe = {}; gedPaint(true); }

function viewGenCustom(camp) {
  if (!GEN.o || GEN.o.type !== "custom" || GEN.o.camp !== camp || !GEN.o.custom) GEN.o = Object.assign(genDefaults("custom"), { camp, size: "custom", custom: gedBlank() });
  if (GED.o !== GEN.o) { GED.o = GEN.o; GED.lv = 0; GED.sel = null; GED.hist = []; GED.fut = []; GED.joining = false; } // a different building: start its history afresh
  if (!GEN.o._own) { GEN.o.custom = JSON.parse(JSON.stringify(GEN.o.custom)); GEN.o._own = 1; } // a copy to change, not the saved one
  if (!gedLevel(GED.lv)) GED.lv = 0;
  const o = GEN.o;
  return `<section class="page genpage"><a href="#gen-${esc(camp)}/building" class="vback">← Buildings</a>
    <h1>✏️ Custom building</h1><p class="muted">Draw the rooms on the grid, then the doors, windows and stairs. The furniture fills itself in, and every piece stays reachable.</p>
    <div class="genlayout gedlayout"><div class="genopts" id="ged-side">${gedSideHtml()}</div>
    <div class="gedmain"><div id="ged-floors" class="gedfloors">${gedFloorsHtml()}</div><div id="ged-canvas"></div><div id="ged-checks"></div></div></div>
    <h2 class="sect">Every floor</h2><div class="genpreview" id="genpreview">${genPreviewHtml(o)}</div></section>`;
}
function gedSideHtml() {
  const o = GEN.o, C = o.custom, tool = GED_TOOLS.find(t => t[0] === GED.tool) || GED_TOOLS[0], L = gedLevel(GED.lv), sel = GED.sel;
  const typeSel = (id, cur) => { const known = !!gedType(cur); return `<select id="${id}">${known ? "" : `<option value="" selected>${esc(String(cur).split(":").pop())} (as it was)</option>`}${GEN_ROOM_TYPES.map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(([n]) => `<option${n === cur ? " selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>`).join("")}</select>`; };
  let selHtml = "";
  if (sel && sel.kind === "room" && L && L.rooms[sel.i]) { const rm = L.rooms[sel.i], joined = rm.zone && L.rooms.some((q, j) => j !== sel.i && q.zone === rm.zone);
    selHtml = `<div class="gedsel"><strong>${esc(rm.n)}</strong> <span class="muted small">${rm.w} × ${rm.h} squares</span>
      <label><span>Name</span><input id="ged-rn" type="text" value="${esc(rm.n)}"></label>
      <label><span>Kind <small class="muted">sets its floor and furniture</small></span>${typeSel("ged-rk", rm.fl && rm.fl !== "-" ? rm.fl : rm.n)}</label>
      <div class="acts"><button class="btn small ghost" data-act="gedreroll">🎲 New furniture</button><button class="btn small ghost" data-act="gedjoin">${joined ? "Wall it off again" : "Open into the next room"}</button><button class="btn small ghost danger" data-act="geddelroom">Delete room</button></div>
      ${GED.joining ? `<p class="small gedhint">Now click the room next door to open this one into it.</p>` : ""}</div>`; }
  if (sel && sel.kind === "stairs" && C.stairs[sel.i]) selHtml = `<div class="gedsel"><strong>Stairs</strong> <span class="muted small">${esc(gedLevelName(C.stairs[sel.i].lo))} to ${esc(gedLevelName(C.stairs[sel.i].lo + 1)).toLowerCase()}</span>
      <div class="acts"><button class="btn small ghost" data-act="gedflip">⇄ Turn round</button><button class="btn small ghost danger" data-act="geddelstairs">Delete stairs</button></div></div>`;
  return `<div class="gedtools" role="group" aria-label="Tools">${GED_TOOLS.map(([k, l]) => `<button class="${GED.tool === k ? "on" : ""}" data-act="gedtool" data-v="${k}" aria-pressed="${GED.tool === k}">${l}</button>`).join("")}</div>
    <p class="small muted gedhint">${tool[2]}</p>
    ${GED.tool === "room" ? `<label><span>New rooms are</span>${typeSel("ged-rt", GED.rt)}</label>` : ""}
    ${GED.tool === "stairs" ? `<label><span>The stairs go</span><div class="seg">${[["up", "Up a floor"], ["down", "Down a floor"]].map(([v, l]) => `<button class="${GED.sdir === v ? "on" : ""}" data-act="gedsdir" data-v="${v}">${l}</button>`).join("")}</div></label>` : ""}
    ${selHtml}
    <div class="acts"><button class="btn small ghost" data-act="gedundo" ${GED.hist.length ? "" : "disabled"}>↶ Undo</button><button class="btn small ghost" data-act="gedredo" ${GED.fut.length ? "" : "disabled"}>↷ Redo</button></div>
    <button class="btn small ghost" data-act="gedauto" title="Replaces the inside doors and the windows on this floor">✨ Fill in doors &amp; windows on this floor</button>
    <label><span>Grid <small class="muted">squares across × down</small></span><span class="gedsize"><input id="ged-w" type="number" min="3" max="48" value="${C.W}"> × <input id="ged-h" type="number" min="3" max="48" value="${C.H}"></span></label>
    <div class="gedshift"><span class="small muted">Shift the plan</span>${[["←", -1, 0], ["→", 1, 0], ["↑", 0, -1], ["↓", 0, 1]].map(([a, dx, dy]) => `<button class="btn small ghost" data-act="gedshift" data-dx="${dx}" data-dy="${dy}" aria-label="Shift ${a}">${a}</button>`).join("")}</div>
    <label><span>Front door</span><div class="seg">${[["plain", "Plain"], ["framed", "Framed"], ["grand", "Grand"]].map(([v, l]) => `<button class="${(C.doorTier || "framed") === v ? "on" : ""}" data-act="gedtier" data-v="${v}">${l}</button>`).join("")}</div></label>
    <label class="genchk"><input type="checkbox" data-act="genchk" data-k="furn"${o.furn !== false ? " checked" : ""}> <span>Furniture <small class="muted">fills itself in; 🎲 on a room for new</small></span></label>
    <label class="genchk"><input type="checkbox" data-act="genchk" data-k="overlay"${o.overlay ? " checked" : ""}> <span>Show walls, doors &amp; windows <small class="muted">as the tabletop will use them</small></span></label>
    <hr>
    <label><span>Name</span><input id="gen-name" type="text" value="${esc(o.name || "")}" placeholder="Custom building"></label>
    <label><span>Tags <small class="muted">comma between</small></span><input id="gen-tags" type="text" value="${esc((o.tags || []).join(", "))}"></label>
    <div class="acts"><button class="btn" data-act="gensave">${o.pid ? "Save changes" : "Save to your buildings"}</button><button class="btn ghost" data-act="genplace" data-camp="${esc(o.camp)}">Place in the campaign</button></div>`;
}
function gedFloorsHtml() {
  const C = GEN.o.custom, lvs = C.levels.map(l => l.level).sort((a, b) => b - a), top = Math.max(...lvs), hasCellar = lvs.includes(-1);
  return `<div class="seg">${lvs.map(lv => `<button class="${GED.lv === lv ? "on" : ""}" data-act="gedlv" data-v="${lv}">${esc(gedLevelName(lv))}</button>`).join("")}</div>
    ${top < 3 ? `<button class="btn small ghost" data-act="gedaddlv" data-v="${top + 1}">+ Floor above</button>` : ""}${hasCellar ? "" : `<button class="btn small ghost" data-act="gedaddlv" data-v="-1">+ Cellar</button>`}
    ${GED.lv !== 0 && (GED.lv === top || GED.lv === -1) ? `<button class="btn small ghost danger" data-act="geddellv">Remove the ${esc(gedLevelName(GED.lv).toLowerCase())}</button>` : ""}`;
}
// The floor you're drawing on: the real floor (and furniture) underneath, the grid and what you're doing on top.
function gedCanvasHtml(B) {
  const o = GEN.o, C = o.custom, L = B.levels.find(q => q.level === GED.lv), TW = C.W + GEN_PAD * 2, TH = C.H + GEN_PAD * 2, lib = genFurnLib();
  const furn = o.furn !== false ? genFurnBoxes(L, lib).map(f => `<img class="genfp" src="${esc(f.src)}" alt="" style="left:${((f.x + GEN_PAD) / TW * 100).toFixed(3)}%;top:${((f.y + GEN_PAD) / TH * 100).toFixed(3)}%;width:${(f.w / TW * 100).toFixed(3)}%;height:${(f.h / TH * 100).toFixed(3)}%${f.rot ? `;transform:rotate(${f.rot}deg)` : ""}">`).join("") : "";
  const v = GED.view || (GED.view = { z: 1, x: 0, y: 0 });
  return `<div class="gedvp" id="ged-vp"><div class="gedpan" id="ged-pan" style="transform:translate(${v.x}px,${v.y}px) scale(${v.z})"><div class="gedfl genfl" style="aspect-ratio:${TW} / ${TH};max-width:${Math.max(560, TW * 46)}px"><img src="${genUrl(genFloorSvg(B, L, false, o.seed, false, "base"))}" alt="">${furn}<img class="genfp gentop" src="${genUrl(genFloorSvg(B, L, true, o.seed, o.overlay, "top"))}" alt="">
    <svg class="gedsvg" viewBox="${-GEN_PAD} ${-GEN_PAD} ${TW} ${TH}" preserveAspectRatio="none">${gedGridSvg()}<g id="ged-ov">${gedOverlay()}</g></svg></div></div>
    <div class="gedzoom"><button type="button" data-act="gedzoom" data-v="-1" title="Zoom out">−</button><span id="ged-zl">${Math.round(v.z * 100)}%</span><button type="button" data-act="gedzoom" data-v="1" title="Zoom in">＋</button><button type="button" data-act="gedzoom" data-v="0" title="Fit the whole building">⤢</button></div>
    <div class="gedzhint small muted">Scroll to zoom · drag with the middle or right button, or hold Space, to pan · pinch on a touch screen</div></div>`;
}
function gedGridSvg() {
  const C = GEN.o.custom; let d = ""; for (let x = 0; x <= C.W; x++) d += `M${x} 0V${C.H}`; for (let y = 0; y <= C.H; y++) d += `M0 ${y}H${C.W}`;
  const other = gedLevel(GED.lv > 0 ? GED.lv - 1 : GED.lv < 0 ? 0 : 1), ghost = GED.lv !== 0 || other ? (other ? other.rooms.map(rm => `<rect x="${rm.x}" y="${rm.y}" width="${rm.w}" height="${rm.h}" fill="none" stroke="#e8c27a" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" opacity=".55"/>`).join("") : "") : "";
  return `<path d="${d}" stroke="rgba(255,255,255,.22)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/><rect x="0" y="0" width="${C.W}" height="${C.H}" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${GED.lv !== 0 ? ghost : ""}`;
}
function gedOverlay() {
  const C = GEN.o.custom, L = gedLevel(GED.lv), ns = `vector-effect="non-scaling-stroke"`; let s = "";
  const sel = GED.sel;
  if (sel && sel.kind === "room" && L && L.rooms[sel.i]) { const rm = L.rooms[sel.i]; s += `<rect x="${rm.x}" y="${rm.y}" width="${rm.w}" height="${rm.h}" fill="rgba(232,194,122,.12)" stroke="#ffd23c" stroke-width="3" ${ns}/>`; }
  if (sel && sel.kind === "stairs" && C.stairs[sel.i]) { const t = C.stairs[sel.i]; s += `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="none" stroke="#ffd23c" stroke-width="3" ${ns}/>`; }
  const d = GED.drag;
  if (d && d.rect) { const r = d.rect, bad = d.bad; s += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${bad ? "rgba(220,70,60,.3)" : "rgba(232,194,122,.3)"}" stroke="${bad ? "#e05a4a" : "#ffd23c"}" stroke-width="2.5" stroke-dasharray="6 4" ${ns}/>`; }
  const col = { door: "#c98b4a", window: "#7fd0ff", front: "#ffd23c", gate: "#d8a04a", clear: "#e05a4a" }[GED.tool] || "#fff";
  const edgeLine = k => { const [dd, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); return dd === "h" ? `<line x1="${x}" y1="${y}" x2="${x + 1}" y2="${y}" stroke="${col}" stroke-width="7" stroke-linecap="round" ${ns}/>` : `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 1}" stroke="${col}" stroke-width="7" stroke-linecap="round" ${ns}/>`; };
  if (d && d.edges) s += d.edges.map(edgeLine).join(""); else if (GED.hover) s += `<g opacity=".7">${edgeLine(GED.hover)}</g>`;
  return s;
}
function gedPaint(all) {
  if (!GEN.o || !GEN.o.custom) return; const cv = document.getElementById("ged-canvas"); if (!cv) return;
  const B = gedB(); cv.innerHTML = gedCanvasHtml(B);
  const probs = gedCheck(B), ch = document.getElementById("ged-checks");
  if (ch) ch.innerHTML = probs.length ? `<div class="gedprobs"><strong>To fix before it plays right</strong><ul>${probs.map(p => `<li><button class="linkbtn" data-act="gedlv" data-v="${p.lv}">${esc(p.msg)}</button></li>`).join("")}</ul></div>` : `<p class="gedok small">✓ Every room, door and stair can be reached.</p>`;
  if (all) { const sd = document.getElementById("ged-side"); if (sd) sd.innerHTML = gedSideHtml(); const fl = document.getElementById("ged-floors"); if (fl) fl.innerHTML = gedFloorsHtml(); const pv = document.getElementById("genpreview"); if (pv) pv.innerHTML = genPreviewHtml(GEN.o); }
}
const gedOv = () => { const g = document.getElementById("ged-ov"); if (g) g.innerHTML = gedOverlay(); };
function gedChanged() { GEN.o.furnRe = {}; gedPaint(true); }

// Where on the grid the pointer is, in squares.
function gedPt(ev, svg) { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: p.y }; }
function gedEdgeAt(p) { const C = GEN.o.custom, dy = Math.abs(p.y - Math.round(p.y)), dx = Math.abs(p.x - Math.round(p.x));
  if (dy <= dx) { const x = Math.floor(p.x), y = Math.round(p.y); if (x < 0 || x >= C.W || y < 0 || y > C.H) return null; return `h,${x},${y}`; }
  const x = Math.round(p.x), y = Math.floor(p.y); if (y < 0 || y >= C.H || x < 0 || x > C.W) return null; return `v,${x},${y}`; }
function gedRun(a, b) { // the edges along one line from a to b
  const [d, x0, y0] = a.split(",").map((v, i) => i ? Number(v) : v); if (!b) return [a]; const [, x1, y1] = b.split(",").map((v, i) => i ? Number(v) : v);
  const out = []; if (d === "h") { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push(`h,${x},${y0}`); } else { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) out.push(`v,${x0},${y}`); } return out; }
function gedEdgeAlong(start, p) { const [d, x0, y0] = start.split(",").map((v, i) => i ? Number(v) : v), C = GEN.o.custom;
  return d === "h" ? `h,${Math.max(0, Math.min(C.W - 1, Math.floor(p.x)))},${y0}` : `v,${x0},${Math.max(0, Math.min(C.H - 1, Math.floor(p.y)))}`; }
const gedCellRect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 });
const gedCell = p => { const C = GEN.o.custom; return { x: Math.max(0, Math.min(C.W - 1, Math.floor(p.x))), y: Math.max(0, Math.min(C.H - 1, Math.floor(p.y))) }; };
const gedHit = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const gedOverlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const gedInside = r => { const C = GEN.o.custom; return r.x >= 0 && r.y >= 0 && r.x + r.w <= C.W && r.y + r.h <= C.H; };
const gedLvStairs = lv => GEN.o.custom.stairs.map((t, i) => [t, i]).filter(([t]) => t.lo === lv || t.lo + 1 === lv);
function gedRoomFits(L, r, skip) { return gedInside(r) && r.w >= 1 && r.h >= 1 && !L.rooms.some((q, j) => j !== skip && gedOverlaps(q, r)); }
function gedStairFits(t, skip) { const C = GEN.o.custom; if (!(Math.max(t.w, t.h) >= 2 && Math.min(t.w, t.h) <= 2 && t.w !== t.h)) return "Stairs are a run 2 or more squares long and 1 or 2 wide.";
  for (const lv of [t.lo, t.lo + 1]) { const l = gedLevel(lv); if (!l) return `There's no ${gedLevelName(lv).toLowerCase()} for them to reach. Add it first.`;
    for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) if (!l.rooms.some(rm => gedHit(rm, x, y))) return `The stairs need a room under them on the ${gedLevelName(lv).toLowerCase()} too.`; }
  if (C.stairs.some((q, j) => j !== skip && (q.lo === t.lo || q.lo + 1 === t.lo || q.lo === t.lo + 1) && gedOverlaps(q, t))) return "Those overlap other stairs."; return null; }
// Which way new stairs run: the way that leaves a clear square at both ends on both floors.
function gedStairToward(t) { for (const tw of ["b", "a"]) { const C = GEN.o.custom, save = C.stairs; C.stairs = save.concat([Object.assign({}, t, { toward: tw })]);
    const B = gedB(); C.stairs = save; if ([t.lo, t.lo + 1].every(lv => { const L = B.levels.find(q => q.level === lv), s = L && L.stairs.find(q => q.x === t.x && q.y === t.y && q.w === t.w && q.h === t.h); return s && genStairEntry(L, s).ok; })) return tw; }
  return "b"; }
// A new room gets a door into the neighbour it shares the most wall with, so it isn't sealed off.
function gedAutoDoor(l, i) { const rm = l.rooms[i]; const best = new Map();
  l.rooms.forEach((q, j) => { if (j === i) return; const ks = [];
    for (let x = rm.x; x < rm.x + rm.w; x++) { if (gedHit(q, x, rm.y - 1)) ks.push(`h,${x},${rm.y}`); if (gedHit(q, x, rm.y + rm.h)) ks.push(`h,${x},${rm.y + rm.h}`); }
    for (let y = rm.y; y < rm.y + rm.h; y++) { if (gedHit(q, rm.x - 1, y)) ks.push(`v,${rm.x},${y}`); if (gedHit(q, rm.x + rm.w, y)) ks.push(`v,${rm.x + rm.w},${y}`); }
    if (ks.length) best.set(j, ks); });
  if (!best.size) return; const [, ks] = [...best.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const stairSq = new Set(); gedLvStairs(l.level).forEach(([t]) => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) stairSq.add(x + "," + y); });
  const ok = ks.filter(k => gedKeyCells(k).every(([x, y]) => !stairSq.has(x + "," + y))), list = ok.length ? ok : ks; l.doors.push(list[Math.floor(list.length / 2)]); }

// Pointer: draw, drag, click.
document.addEventListener("pointerdown", ev => {
  const svg = ev.target.closest && ev.target.closest(".gedsvg"); if (!svg || !GEN.o || !GEN.o.custom || ev.button > 0) return;
  ev.preventDefault(); svg.setPointerCapture(ev.pointerId); const p = gedPt(ev, svg), C = GEN.o.custom, L = gedLevel(GED.lv), t = GED.tool, c = gedCell(p);
  if (t === "room" || t === "stairs") { if (p.x < 0 || p.y < 0 || p.x >= C.W || p.y >= C.H) return; GED.drag = { kind: t, a: c, rect: gedCellRect(c, c) }; }
  else if (["door", "window", "front", "gate", "clear"].includes(t)) { const e = gedEdgeAt(p); if (e) GED.drag = { kind: "edge", a: e, edges: [e] }; }
  else if (t === "select" || t === "erase") {
    const st = gedLvStairs(GED.lv).find(([q]) => gedHit(q, p.x, p.y)), ri = L.rooms.findIndex(rm => gedHit(rm, p.x, p.y));
    if (t === "erase") { if (st) { gedPush(); C.stairs.splice(st[1], 1); } else if (ri >= 0) { gedPush(); L.rooms.splice(ri, 1); } else return; GED.sel = null; gedChanged(); return; }
    if (GED.joining && GED.sel && GED.sel.kind === "room" && ri >= 0 && ri !== GED.sel.i) { const a = L.rooms[GED.sel.i], b = L.rooms[ri];
      const touch = (a.x + a.w === b.x || b.x + b.w === a.x) && a.y < b.y + b.h && b.y < a.y + a.h || (a.y + a.h === b.y || b.y + b.h === a.y) && a.x < b.x + b.w && b.x < a.x + a.w;
      GED.joining = false; if (!touch) { toast("Those two rooms don't share a wall."); gedPaint(true); return; }
      gedPush(); const z = a.zone || b.zone || vid("z"); [a, b].forEach(r => { r.zone = z; r.hub = 1; delete r.openY; }); gedChanged(); return; }
    GED.joining = false;
    if (st && !(GED.sel && GED.sel.kind === "room" && ri >= 0 && GED.sel.i === ri && !gedHit(st[0], p.x, p.y))) { GED.sel = { kind: "stairs", i: st[1] }; GED.drag = { kind: "movestairs", i: st[1], p0: p, orig: Object.assign({}, st[0]) }; gedPaint(true); return; }
    if (ri < 0) { GED.sel = null; gedPaint(true); return; }
    const was = GED.sel && GED.sel.kind === "room" && GED.sel.i === ri; GED.sel = { kind: "room", i: ri }; const rm = L.rooms[ri], m = 0.3;
    const side = !was ? null : p.x - rm.x < m ? "l" : rm.x + rm.w - p.x < m ? "r" : p.y - rm.y < m ? "t" : rm.y + rm.h - p.y < m ? "b" : null;
    GED.drag = { kind: side ? "resize" : "move", side, i: ri, p0: p, orig: { x: rm.x, y: rm.y, w: rm.w, h: rm.h }, rect: { x: rm.x, y: rm.y, w: rm.w, h: rm.h } };
    if (!was) gedPaint(true); else gedOv(); }
});
document.addEventListener("pointermove", ev => {
  const svg = document.querySelector(".gedsvg"); if (!svg || !GEN.o || !GEN.o.custom) return; const d = GED.drag;
  if (!d) { if (!ev.target.closest || !ev.target.closest(".gedsvg")) { if (GED.hover) { GED.hover = null; gedOv(); } return; }
    const h = ["door", "window", "front", "gate", "clear"].includes(GED.tool) ? gedEdgeAt(gedPt(ev, svg)) : null; if (h !== GED.hover) { GED.hover = h; gedOv(); } return; }
  const p = gedPt(ev, svg), L = gedLevel(GED.lv);
  if (d.kind === "room" || d.kind === "stairs") { d.rect = gedCellRect(d.a, gedCell(p)); d.bad = d.kind === "room" ? !gedRoomFits(L, d.rect) : false; }
  else if (d.kind === "edge") d.edges = gedRun(d.a, gedEdgeAlong(d.a, p));
  else if (d.kind === "move" || d.kind === "resize") { const dx = Math.round(p.x - d.p0.x), dy = Math.round(p.y - d.p0.y), o = d.orig; let r = Object.assign({}, o);
    if (d.kind === "move") { r.x += dx; r.y += dy; }
    else if (d.side === "l") { r.x = Math.min(o.x + o.w - 1, o.x + dx); r.w = o.x + o.w - r.x; } else if (d.side === "r") r.w = Math.max(1, o.w + dx);
    else if (d.side === "t") { r.y = Math.min(o.y + o.h - 1, o.y + dy); r.h = o.y + o.h - r.y; } else if (d.side === "b") r.h = Math.max(1, o.h + dy);
    d.rect = r; d.bad = !gedRoomFits(L, r, d.i); }
  else if (d.kind === "movestairs") { const dx = Math.round(p.x - d.p0.x), dy = Math.round(p.y - d.p0.y); d.rect = Object.assign({}, d.orig, { x: d.orig.x + dx, y: d.orig.y + dy }); d.bad = !!gedStairFits(Object.assign({}, d.orig, d.rect), d.i); }
  gedOv();
});
document.addEventListener("pointerup", ev => {
  const d = GED.drag; if (!d || !GEN.o || !GEN.o.custom) return; GED.drag = null; const C = GEN.o.custom, L = gedLevel(GED.lv);
  if (d.kind === "room") { if (d.bad) { toast("Rooms can't overlap or go off the grid. Use Select to move or resize one."); gedOv(); return; }
    gedPush(); L.rooms.push(gedRoomFrom(GED.rt, d.rect)); gedAutoDoor(L, L.rooms.length - 1); GED.sel = { kind: "room", i: L.rooms.length - 1 }; gedChanged(); return; }
  if (d.kind === "stairs") { const lo = GED.sdir === "up" ? GED.lv : GED.lv - 1, t = Object.assign({ lo }, d.rect), why = gedStairFits(t); if (why) { toast(why); gedOv(); return; }
    gedPush(); t.toward = gedStairToward(t); C.stairs.push(t); GED.sel = { kind: "stairs", i: C.stairs.length - 1 }; gedChanged(); return; }
  if (d.kind === "move" || d.kind === "resize") { const r = d.rect, o = d.orig; if (d.bad || (r.x === o.x && r.y === o.y && r.w === o.w && r.h === o.h)) { gedOv(); return; }
    gedPush(); const rm = L.rooms[d.i], dx = r.x - o.x, dy = r.y - o.y;
    if (d.kind === "move") { // doors and windows in its walls come with it
      const onRim = k => { const [dd, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); return dd === "h" ? (y === o.y || y === o.y + o.h) && x >= o.x && x < o.x + o.w : (x === o.x || x === o.x + o.w) && y >= o.y && y < o.y + o.h; };
      const mv = k => { const [dd, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); return `${dd},${x + dx},${y + dy}`; };
      ["doors", "wins", "front", "gates", "secret"].forEach(f => { L[f] = (L[f] || []).map(k => onRim(k) ? mv(k) : k); });
      C.stairs.forEach(t => { if ((t.lo === GED.lv || t.lo + 1 === GED.lv) && gedHit(o, t.x, t.y) && gedHit(o, t.x + t.w - 1, t.y + t.h - 1)) { t.x += dx; t.y += dy; } }); }
    Object.assign(rm, r); gedChanged(); return; }
  if (d.kind === "movestairs") { if (d.bad || !d.rect) { if (d.bad) toast(gedStairFits(Object.assign({}, d.orig, d.rect), d.i)); gedOv(); return; } if (d.rect.x === d.orig.x && d.rect.y === d.orig.y) { gedOv(); return; }
    gedPush(); Object.assign(C.stairs[d.i], { x: d.rect.x, y: d.rect.y }); gedChanged(); return; }
  if (d.kind === "edge") {
    const B = gedB(), BL = B.levels.find(q => q.level === GED.lv), walls = new Set(genEdges(BL, C.W, C.H).map(e => e.k)), own = BL.own, t = GED.tool;
    const ext = k => { const [a, b] = gedKeyCells(k); return (own(...a) < 0) !== (own(...b) < 0); };
    let ks = d.edges.filter(k => walls.has(k) || (t === "clear"));
    if (t === "window") ks = ks.filter(ext);
    if (t === "front") { if (GED.lv !== 0) { toast("The front door goes on the ground floor."); gedOv(); return; }
      ks = ks.filter(k => { if (k[0] !== "h") return false; const [a, b] = gedKeyCells(k), ib = own(...b); return own(...a) >= 0 && (ib < 0 || BL.rooms[ib].porch); }); }
    if (!ks.length) { toast(t === "window" ? "Windows go on outside walls." : t === "front" ? "The front door goes in a ground-floor wall with the street (or a porch) below it." : "That's not a wall."); gedOv(); return; }
    gedPush(); const rm = (f, list) => { L[f] = (L[f] || []).filter(k => !list.includes(k)); }, add = (f, list) => { L[f] = [...new Set((L[f] || []).concat(list))]; };
    if (t === "clear") ["doors", "wins", "front", "gates", "secret"].forEach(f => rm(f, ks));
    else if (t === "door") { rm("wins", ks); rm("gates", ks); add("doors", ks); }
    else if (t === "window") { ["doors", "front", "gates", "secret"].forEach(f => rm(f, ks)); add("wins", ks); }
    else if (t === "gate") { rm("wins", ks); rm("front", ks); add("doors", ks); add("gates", ks); }
    else if (t === "front") { rm("wins", ks); rm("gates", ks); L.doors = L.doors.filter(k => !(L.front || []).includes(k)); L.front = ks.slice(); add("doors", ks); }
    gedChanged(); }
});
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act^=ged],[data-act=gencopy],[data-act=genchk],[data-act=genreroom],[data-act=genrereset]"); if (!b || !vCanEdit()) return; const a = b.dataset.act;
  if (a === "gednew") { GEN.o = null; return; } // the card: a fresh plan (the link then opens it)
  if (!GEN.o) return;
  if (a === "gencopy") { genReadForm(); const T = genType(GEN.o.type), o0 = GEN.o, B = genBuilding(o0);
    GEN.o = { type: "custom", camp: o0.camp, seed: o0.seed, size: "custom", custom: gedFromB(B), furn: o0.furn !== false, furnRe: {}, overlay: o0.overlay, name: o0.name || T.name, tags: (o0.tags || []).slice(), _own: 1 };
    GED.lv = 0; GED.sel = null; GED.hist = []; GED.fut = []; GED.tool = "select"; location.hash = `gen-${o0.camp}/building/custom`; return; }
  if (!GEN.o.custom) return;
  if (a === "genchk" || a === "genreroom" || a === "genrereset") { gedPaint(false); return; } // (the generator's own handler has done the rest)
  const C = GEN.o.custom, L = gedLevel(GED.lv);
  if (a === "gedtool") { GED.tool = b.dataset.v; GED.joining = false; GED.hover = null; if (!["select", "erase"].includes(GED.tool)) GED.sel = null; gedPaint(true); return; }
  if (a === "gedsdir") { GED.sdir = b.dataset.v; gedPaint(true); return; }
  if (a === "gedlv") { GED.lv = Number(b.dataset.v); GED.sel = null; GED.joining = false; gedPaint(true); return; }
  if (a === "gedaddlv") { const lv = Number(b.dataset.v); gedPush(); C.levels.push({ level: lv, rooms: [], doors: [], wins: [], front: [], gates: [], secret: [] }); GED.lv = lv; GED.sel = null; gedChanged();
    toast(lv < 0 ? "Draw the cellar's rooms, then stairs down from the ground floor." : `Draw the ${gedLevelName(lv).toLowerCase()}'s rooms, then stairs up to it from the floor below.`); return; }
  if (a === "geddellv") { if (!(await confirmBox(`Remove the ${gedLevelName(GED.lv).toLowerCase()} and everything on it?`, "Remove"))) return; gedPush(); const lv = GED.lv;
    C.levels = C.levels.filter(l => l.level !== lv); C.stairs = C.stairs.filter(t => t.lo !== lv && t.lo + 1 !== lv); GED.lv = 0; GED.sel = null; gedChanged(); return; }
  if (a === "gedundo" || a === "gedredo") { gedUndo(a === "gedredo"); return; }
  if (a === "gedtier") { gedPush(); C.doorTier = b.dataset.v; gedChanged(); return; }
  if (a === "gedshift") { const dx = Number(b.dataset.dx), dy = Number(b.dataset.dy), all = C.levels.flatMap(l => l.rooms).concat(C.stairs);
    if (all.some(r => r.x + dx < 0 || r.y + dy < 0 || r.x + r.w + dx > C.W || r.y + r.h + dy > C.H)) { toast("No room to shift that way: make the grid bigger first."); return; }
    gedPush(); all.forEach(r => { r.x += dx; r.y += dy; }); const mv = k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); return `${d},${x + dx},${y + dy}`; };
    C.levels.forEach(l => ["doors", "wins", "front", "gates", "secret"].forEach(f => { l[f] = (l[f] || []).map(mv); })); gedChanged(); return; }
  if (a === "gedauto") { gedPush(); const B = gedB(), BL = B.levels.find(q => q.level === GED.lv); if (!BL.rooms.length) return;
    const tmp = { level: BL.level, rooms: BL.rooms.map(rm => Object.assign({}, rm)) }, keepExt = new Set([...BL.doors].filter(k => { const [p, q] = gedKeyCells(k); return (BL.own(...p) < 0) !== (BL.own(...q) < 0); }));
    // The tree of doors starts from the room the stairs arrive in (or the front door's room on the ground floor).
    const fk = [...BL.front][0]; if (fk) { const [p] = gedKeyCells(fk), i = BL.own(...p); if (i >= 0) tmp.rooms[i].entry = 1; }
    else if (GED.lv === 0 && keepExt.size) { const [p, q] = gedKeyCells([...keepExt][0]), i = BL.own(...p) >= 0 ? BL.own(...p) : BL.own(...q); if (i >= 0) tmp.rooms[i].entry = 1; }
    const arrive = (BL.stairs || []).find(t => GED.lv > 0 ? t.dir === "down" : GED.lv < 0 ? t.dir === "up" : false); if (arrive) { const i = BL.own(arrive.x, arrive.y); if (i >= 0) tmp.rooms.forEach((rm, j) => { if (j !== i) delete rm.circ; }); }
    genOpenings(genRng((Number(GEN.o.seed) || 1) + GED.lv * 77 + GED.hist.length), tmp, B.F, arrive ? [arrive].concat((BL.stairs || []).filter(t => t !== arrive)) : BL.stairs, null);
    let doors = [...new Set([...tmp.doors, ...keepExt])];
    if (GED.lv === 0 && !keepExt.size) { // no way in yet: a front door in the middle of the longest bottom outside wall
      let best = null; BL.rooms.forEach((rm, i) => { if (rm.porch) return; const run = []; for (let x = rm.x; x < rm.x + rm.w; x++) if (BL.own(x, rm.y + rm.h) < 0 && !(BL.stairs || []).some(t => gedHit(t, x, rm.y + rm.h - 1))) run.push(x); if (run.length && (!best || run.length > best.run.length)) best = { run, y: rm.y + rm.h }; });
      if (best) { const k = `h,${best.run[Math.floor(best.run.length / 2)]},${best.y}`; doors.push(k); L.front = [k]; } }
    L.doors = doors; L.wins = [...tmp.wins].filter(k => !doors.includes(k)); L.gates = (L.gates || []).filter(k => doors.includes(k)); L.secret = (L.secret || []).filter(k => doors.includes(k)); gedChanged(); return; }
  if (!L) return; const sel = GED.sel;
  if (a === "gedreroll" && sel && sel.kind === "room") { const re = Object.assign({}, GEN.o.furnRe), k = GED.lv + ":" + sel.i; re[k] = (re[k] || 0) + 1; GEN.o.furnRe = re; gedPaint(true); return; }
  if (a === "gedjoin" && sel && sel.kind === "room") { const rm = L.rooms[sel.i];
    if (rm.zone && L.rooms.some((q, j) => j !== sel.i && q.zone === rm.zone)) { gedPush(); const z = rm.zone; delete rm.zone; delete rm.hub; const rest = L.rooms.filter(q => q.zone === z); if (rest.length === 1) { delete rest[0].zone; delete rest[0].hub; } gedChanged(); toast("Walled off. Add a door if it needs one."); return; }
    GED.joining = true; GED.tool = "select"; gedPaint(true); return; }
  if (a === "geddelroom" && sel && sel.kind === "room") { gedPush(); L.rooms.splice(sel.i, 1); GED.sel = null; gedChanged(); return; }
  if (a === "gedflip" && sel && sel.kind === "stairs") { gedPush(); const t = C.stairs[sel.i]; t.toward = t.toward === "a" ? "b" : "a"; gedChanged(); return; }
  if (a === "geddelstairs" && sel && sel.kind === "stairs") { gedPush(); C.stairs.splice(sel.i, 1); GED.sel = null; gedChanged(); return; }
});
document.addEventListener("change", ev => {
  const t = ev.target; if (!t || !GEN.o || !GEN.o.custom || !t.id || !t.id.startsWith("ged-")) return; const C = GEN.o.custom, L = gedLevel(GED.lv), sel = GED.sel;
  if (t.id === "ged-rt") { GED.rt = t.value; return; }
  if (t.id === "ged-rk" && sel && sel.kind === "room" && t.value) { gedPush(); const rm = L.rooms[sel.i], was = rm.n, keep = { x: rm.x, y: rm.y, w: rm.w, h: rm.h, zone: rm.zone, hub: rm.hub };
    const base = String(rm.fl || "").split(":").pop(), named = rm.fl !== "-" && was !== base && was !== rm.fl ? was : null; // a name you typed stays
    L.rooms[sel.i] = Object.assign(gedRoomFrom(t.value, {}), JSON.parse(JSON.stringify(keep)), named ? { n: named } : {}); gedChanged(); return; }
  if (t.id === "ged-rn" && sel && sel.kind === "room") { const v = t.value.trim(); if (!v) return; gedPush(); L.rooms[sel.i].n = v; gedPaint(true); return; }
  if (t.id === "ged-w" || t.id === "ged-h") { const W = Math.max(3, Math.min(48, Math.round(Number(document.getElementById("ged-w").value)) || C.W)), H = Math.max(3, Math.min(48, Math.round(Number(document.getElementById("ged-h").value)) || C.H));
    const fits = r => r.x + r.w <= W && r.y + r.h <= H, lost = C.levels.reduce((n, l) => n + l.rooms.filter(r => !fits(r)).length, 0);
    gedPush(); C.W = W; C.H = H; C.levels.forEach(l => { l.rooms = l.rooms.filter(fits); }); C.stairs = C.stairs.filter(fits); GED.sel = null;
    if (lost) toast(`${lost} room${lost === 1 ? "" : "s"} past the edge ${lost === 1 ? "was" : "were"} removed. Undo to bring ${lost === 1 ? "it" : "them"} back.`); gedChanged(); return; }
});
document.addEventListener("keydown", ev => {
  if (!GEN.o || !GEN.o.custom || !document.getElementById("ged-canvas")) return; const tag = (ev.target && ev.target.tagName) || ""; if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); gedUndo(ev.shiftKey); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") { ev.preventDefault(); gedUndo(true); return; }
  if ((ev.key === "Delete" || ev.key === "Backspace") && GED.sel) { ev.preventDefault(); const b = document.querySelector(GED.sel.kind === "room" ? "[data-act=geddelroom]" : "[data-act=geddelstairs]"); if (b) b.click(); return; }
  if (ev.key === "Escape") { GED.drag = null; GED.joining = false; GED.sel = null; gedPaint(true); }
});
// The editor's canvas is drawn after the page is on screen.
new MutationObserver(() => { const cv = document.getElementById("ged-canvas"); if (cv && !cv.firstChild) gedPaint(false); }).observe(document.documentElement, { childList: true, subtree: true });

// ----- Zoom and pan: the scroll wheel zooms where the pointer is; the middle or right button (or Space held, or two fingers)
// drags the plan about. Kept across repaints; the drawing tools still land on the right square (they read the page's own
// transform back).
const gedViewSet = (z, x, y) => { const vp = document.getElementById("ged-vp"), pan = document.getElementById("ged-pan"); if (!vp || !pan) return;
  z = Math.max(0.5, Math.min(6, z)); const W = vp.clientWidth, H = vp.clientHeight, cw = pan.offsetWidth * z, ch = pan.offsetHeight * z, m = 60;
  x = Math.min(W - m, Math.max(m - cw, x)); y = Math.min(H - m, Math.max(m - ch, y)); // always some of the plan on screen
  GED.view = { z, x, y }; pan.style.transform = `translate(${x}px,${y}px) scale(${z})`; const zl = document.getElementById("ged-zl"); if (zl) zl.textContent = Math.round(z * 100) + "%"; };
const gedZoomAt = (f, cx, cy) => { const v = GED.view || { z: 1, x: 0, y: 0 }, z = Math.max(0.5, Math.min(6, v.z * f)), k = z / v.z; gedViewSet(z, cx - (cx - v.x) * k, cy - (cy - v.y) * k); };
const GEDP = { pts: new Map(), pan: null, space: false, pinch: null };
document.addEventListener("wheel", ev => { const vp = ev.target.closest && ev.target.closest("#ged-vp"); if (!vp) return; ev.preventDefault();
  const r = vp.getBoundingClientRect(); gedZoomAt(Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0018)), ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
document.addEventListener("contextmenu", ev => { if (ev.target.closest && ev.target.closest("#ged-vp")) ev.preventDefault(); });
document.addEventListener("pointerdown", ev => { const vp = ev.target.closest && ev.target.closest("#ged-vp"); if (!vp || (ev.target.closest && ev.target.closest(".gedzoom"))) return;
  if (ev.pointerType === "touch") { GEDP.pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (GEDP.pts.size === 2) { GED.drag = null; gedOv(); const [a, b] = [...GEDP.pts.values()], v = GED.view || { z: 1, x: 0, y: 0 };
      GEDP.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, v: Object.assign({}, v) }; ev.stopImmediatePropagation(); ev.preventDefault(); }
    return; }
  if (ev.button === 1 || ev.button === 2 || (ev.button === 0 && GEDP.space)) { ev.preventDefault(); ev.stopImmediatePropagation(); const v = GED.view || { z: 1, x: 0, y: 0 };
    GEDP.pan = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, x: v.x, y: v.y }; vp.classList.add("panning"); try { vp.setPointerCapture(ev.pointerId); } catch (e) { } } }, true);
document.addEventListener("pointermove", ev => {
  if (GEDP.pan && ev.pointerId === GEDP.pan.id) { const v = GED.view; gedViewSet(v.z, GEDP.pan.x + ev.clientX - GEDP.pan.sx, GEDP.pan.y + ev.clientY - GEDP.pan.sy); ev.stopImmediatePropagation(); return; }
  if (GEDP.pts.has(ev.pointerId)) { GEDP.pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (GEDP.pinch && GEDP.pts.size === 2) { const vp = document.getElementById("ged-vp"); if (!vp) return; const r = vp.getBoundingClientRect(), [a, b] = [...GEDP.pts.values()], P = GEDP.pinch;
      const z = Math.max(0.5, Math.min(6, P.v.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / P.d)), k = z / P.v.z, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      gedViewSet(z, (P.mx - r.left) - ((P.mx - r.left) - P.v.x) * k + (mx - P.mx), (P.my - r.top) - ((P.my - r.top) - P.v.y) * k + (my - P.my)); ev.stopImmediatePropagation(); } } }, true);
const gedPtrEnd = ev => { if (GEDP.pan && ev.pointerId === GEDP.pan.id) { GEDP.pan = null; const vp = document.getElementById("ged-vp"); if (vp) vp.classList.remove("panning"); ev.stopImmediatePropagation(); }
  if (GEDP.pts.delete(ev.pointerId) && GEDP.pinch) { if (GEDP.pts.size < 2) GEDP.pinch = null; ev.stopImmediatePropagation(); } };
document.addEventListener("pointerup", gedPtrEnd, true); document.addEventListener("pointercancel", gedPtrEnd, true);
document.addEventListener("keydown", ev => { if (ev.code !== "Space" || !document.getElementById("ged-vp") || /INPUT|SELECT|TEXTAREA|BUTTON/.test((ev.target && ev.target.tagName) || "")) return; ev.preventDefault(); if (!GEDP.space) { GEDP.space = true; const vp = document.getElementById("ged-vp"); if (vp) vp.classList.add("canpan"); } });
document.addEventListener("keyup", ev => { if (ev.code !== "Space") return; GEDP.space = false; const vp = document.getElementById("ged-vp"); if (vp) vp.classList.remove("canpan"); });
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-act=gedzoom]"); if (!b) return; const vp = document.getElementById("ged-vp"); if (!vp) return;
  const v = Number(b.dataset.v); if (v === 0) gedViewSet(1, 0, 0); else gedZoomAt(v > 0 ? 1.25 : 0.8, vp.clientWidth / 2, vp.clientHeight / 2); });
