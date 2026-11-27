// ===== Furniture for generated buildings =====
// Every piece sits on the grid: a footprint of whole squares, turned in quarter turns. A piece is drawn facing "south": its
// back along the top of its box (against a wall, for most), its front (where you use it) along the bottom.
// Where things go follows medieval inventories and house plans (a hall of trestle tables, benches and chests; a chamber of
// bed, chest and a stool; a smithy of hearth, bellows, anvil and quench tub...) and is laid out like a rule-based layout
// solver (Tutenel et al. 2009): each piece has rules (against a wall, in a corner, in the middle, by the hearth, facing the
// door...), keeps squares clear for using it, and pieces are placed one at a time, most important first, scored by attractors
// (near the fire, away from the door, with its own kind) and with every door, stair and piece still reachable on foot.

const GENF_INK = "#2b2520";
const genfWood = ["#5e4027", "#7d5533", "#9c6d42", "#b0844f"];
// Little drawing helpers, all in the piece's own box (P pixels a square).
const gfR = (x, y, w, h, fill, ex) => `<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${fill}" stroke="${GENF_INK}" stroke-width="2"${ex || ""}/>`;
const gfC = (x, y, r, fill, ex) => `<circle cx="${(+x).toFixed(1)}" cy="${(+y).toFixed(1)}" r="${(+r).toFixed(1)}" fill="${fill}" stroke="${GENF_INK}" stroke-width="2"${ex || ""}/>`;
const gfE = (x, y, rx, ry, fill, ex) => `<ellipse cx="${(+x).toFixed(1)}" cy="${(+y).toFixed(1)}" rx="${(+rx).toFixed(1)}" ry="${(+ry).toFixed(1)}" fill="${fill}" stroke="${GENF_INK}" stroke-width="2"${ex || ""}/>`;
const gfL = (x1, y1, x2, y2, c, w) => `<line x1="${(+x1).toFixed(1)}" y1="${(+y1).toFixed(1)}" x2="${(+x2).toFixed(1)}" y2="${(+y2).toFixed(1)}" stroke="${c || GENF_INK}" stroke-width="${w || 1.5}" stroke-linecap="round"/>`;
const gfPlanks = (x, y, w, h, n, along) => Array.from({ length: n - 1 }, (_, i) => along ? gfL(x + 2, y + h * (i + 1) / n, x + w - 2, y + h * (i + 1) / n, "rgba(43,37,32,.35)", 1) : gfL(x + w * (i + 1) / n, y + 2, x + w * (i + 1) / n, y + h - 2, "rgba(43,37,32,.35)", 1)).join("");
// A market stall: trestle boards under a striped awning edge, laid with goods (rounds of colour) or bolts of cloth.
const gfStall = (P, goods, awn, cloth) => gfTable(3, P * 0.1, 2 * P - 6, P * 0.8, genfWood[3], 2) + (cloth ? cloth.map((c, i) => gfR(P * (0.18 + i * 0.34), P * 0.3, P * 0.28, P * 0.5, c, ` rx="3"`)).join("") : [0.3, 0.65, 1.0, 1.35, 1.7].map((x, i) => gfE(x * P, P * (0.42 + (i % 2) * 0.2), P * 0.15, P * 0.12, goods[i % goods.length][0]) + `<ellipse cx="${x * P}" cy="${P * (0.42 + (i % 2) * 0.2)}" rx="${P * 0.07}" ry="${P * 0.05}" fill="${goods[i % goods.length][1]}"/>`).join("")) + gfR(2, 2, 2 * P - 4, P * 0.16, awn) + [0, 0.5, 1, 1.5].map(x => gfR(2 + x * P, 2, P * 0.25, P * 0.16, "#e8d9b0")).join("");
const gfShadow = (x, y, w, h, rx) => `<rect x="${x + 3}" y="${y + 4}" width="${w}" height="${h}" rx="${rx || 2}" fill="rgba(0,0,0,.28)"/>`;
const gfCShadow = (x, y, r) => `<circle cx="${x + 3}" cy="${y + 4}" r="${r}" fill="rgba(0,0,0,.28)"/>`;
const gfTable = (x, y, w, h, wood, n) => gfShadow(x, y, w, h) + gfR(x, y, w, h, wood || genfWood[3], ` rx="2"`) + gfPlanks(x, y, w, h, n || Math.max(2, Math.round(h / 9)), true);
const gfCandle = (x, y) => gfC(x, y, 3.2, "#efe6cf") + `<circle cx="${x}" cy="${y}" r="5.5" fill="rgba(255,190,80,.35)"/><circle cx="${x}" cy="${y}" r="1.6" fill="#ffb347"/>`;
const gfMug = (x, y) => gfC(x, y, 3.4, "#8a6a44") + `<circle cx="${x}" cy="${y}" r="2" fill="#e8c27a"/>`;
const gfBook = (x, y, w, h, c) => gfR(x, y, w, h, c || "#7a2e2e") + gfL(x + w / 2, y + 1, x + w / 2, y + h - 1, "#e9dfc6", 1.2);
const gfBarrel = (cx, cy, r) => gfCShadow(cx, cy, r) + gfC(cx, cy, r, "#8a5a33") + `<circle cx="${cx}" cy="${cy}" r="${r * 0.78}" fill="none" stroke="#3a3530" stroke-width="2.4"/>` + gfL(cx - r * 0.75, cy, cx + r * 0.75, cy, "rgba(43,37,32,.45)", 1) + gfL(cx - r * 0.7, cy - r * 0.35, cx + r * 0.7, cy - r * 0.35, "rgba(43,37,32,.3)", 1) + gfL(cx - r * 0.7, cy + r * 0.35, cx + r * 0.7, cy + r * 0.35, "rgba(43,37,32,.3)", 1) + `<circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="#3a2a1a"/>`;
const gfCask = (x, y, w, h) => gfShadow(x, y, w, h, h / 2) + gfR(x, y, w, h, "#8a5a33", ` rx="${h / 2}"`) + [0.18, 0.5, 0.82].map(f => gfL(x + w * f, y + 1, x + w * f, y + h - 1, "#3a3530", 2.2)).join("");
const gfSack = (cx, cy, r, c) => gfE(cx, cy, r, r * 0.86, c || "#b89b6a") + gfL(cx - r * 0.3, cy - r * 0.6, cx + r * 0.3, cy - r * 0.6, "#6f5a3a", 2) + gfC(cx, cy - r * 0.72, 2, "#6f5a3a");
const gfSeatChair = (P, wood, cushion) => { const m = P * 0.17; return gfShadow(m, m * 1.4, P - 2 * m, P - m * 2.2) + gfR(m, m * 1.4, P - 2 * m, P - m * 2.2, wood || genfWood[2], ` rx="3"`) + (cushion ? gfR(m + 4, m * 1.4 + 4, P - 2 * m - 8, P - m * 2.2 - 8, cushion, ` rx="3"`) : "") + gfR(m - 2, m * 0.6, P - 2 * m + 4, P * 0.16, genfWood[0], ` rx="2"`); };

// The pieces. w × h squares as drawn (back along the top); place: wall / corner / free / centre / hearth (beside a fire) /
// gap (a square in front of a wall: a bar); access: where you stand to use it (front, side, any, frontback, none);
// tall: not in front of a window; group: likes its own kind nearby; near/door: attractors; face: what its front turns to.
// seats: a table's chairs or benches round it; foot / front: a second piece placed with it.
const GEN_FURN = [
  // Seats and tables
  { id: "bench", name: "Bench", cat: "Seats & tables", w: 2, h: 1, place: "free", access: "any", draw: P => gfTable(5, P * 0.3, 2 * P - 10, P * 0.4, genfWood[2], 2) + gfR(7, P * 0.28, 5, P * 0.44, genfWood[0]) + gfR(2 * P - 12, P * 0.28, 5, P * 0.44, genfWood[0]) },
  { id: "bench3", name: "Long bench", cat: "Seats & tables", w: 3, h: 1, place: "free", access: "any", draw: P => gfTable(5, P * 0.3, 3 * P - 10, P * 0.4, genfWood[2], 2) + [7, 1.5 * P - 2.5, 3 * P - 12].map(x => gfR(x, P * 0.28, 5, P * 0.44, genfWood[0])).join("") },
  { id: "pew", name: "Pew", cat: "Seats & tables", w: 3, h: 1, place: "free", access: "side", face: "altar", draw: P => gfShadow(4, P * 0.12, 3 * P - 8, P * 0.7) + gfR(4, P * 0.1, 3 * P - 8, P * 0.2, genfWood[0]) + gfR(4, P * 0.3, 3 * P - 8, P * 0.36, genfWood[1]) + gfR(4, P * 0.72, 3 * P - 8, P * 0.12, "#7a2e2e") + gfR(2, P * 0.08, 6, P * 0.8, genfWood[0]) + gfR(3 * P - 8, P * 0.08, 6, P * 0.8, genfWood[0]) },
  { id: "stool", name: "Stool", cat: "Seats & tables", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.24) + gfC(P / 2, P / 2, P * 0.24, genfWood[2]) + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.14}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1"/>` },
  { id: "chair", name: "Chair", cat: "Seats & tables", w: 1, h: 1, place: "free", access: "any", draw: P => gfSeatChair(P) },
  { id: "carvedchair", name: "Carved chair", cat: "Seats & tables", w: 1, h: 1, place: "wall", access: "front", door: "far", draw: P => gfSeatChair(P, genfWood[1], "#8f2f2f") + gfC(P * 0.17, P * 0.14, 4, "#c9a45e") + gfC(P * 0.83, P * 0.14, 4, "#c9a45e") },
  { id: "settle", name: "Settle", cat: "Seats & tables", w: 2, h: 1, place: "wall", access: "front", near: "hearth", tall: 1, draw: P => gfShadow(4, 4, 2 * P - 8, P * 0.78) + gfR(4, 4, 2 * P - 8, P * 0.22, genfWood[0]) + gfR(6, P * 0.26, 2 * P - 12, P * 0.5, genfWood[2]) + gfPlanks(6, P * 0.26, 2 * P - 12, P * 0.5, 3, true) + gfR(3, 3, 7, P * 0.8, genfWood[0]) + gfR(2 * P - 10, 3, 7, P * 0.8, genfWood[0]) },
  { id: "trestle", name: "Trestle table", cat: "Seats & tables", w: 3, h: 1, place: "free", access: "any", perpTo: "hightable", seats: { a: ["bench3", "bench", "stool"], sides: "long", min: 1 }, draw: P => gfTable(4, P * 0.12, 3 * P - 8, P * 0.76, genfWood[3], 3) + gfR(P * 0.3, P * 0.08, 6, P * 0.84, "rgba(94,64,39,.5)") + gfR(3 * P - P * 0.3 - 6, P * 0.08, 6, P * 0.84, "rgba(94,64,39,.5)") + gfMug(P * 0.8, P * 0.4) + `<circle cx="${P * 1.6}" cy="${P * 0.5}" r="${P * 0.16}" fill="#d9c7a0" stroke="${GENF_INK}" stroke-width="1.5"/>` + gfCandle(P * 2.3, P * 0.45) },
  { id: "longtable", name: "Long table", cat: "Seats & tables", w: 4, h: 2, place: "centre", access: "any", seats: { a: ["chair"], sides: "all", min: 3 }, draw: P => gfTable(4, 6, 4 * P - 8, 2 * P - 12, genfWood[2], 6) + `<rect x="${P * 0.4}" y="${P * 0.75}" width="${P * 3.2}" height="${P * 0.5}" fill="#8f2f2f" opacity=".75"/>` + [0.8, 1.6, 2.4, 3.2].map(x => gfC(x * P, P * 0.45, P * 0.13, "#d9c7a0")).join("") + [0.8, 1.6, 2.4, 3.2].map(x => gfC(x * P, P * 1.55, P * 0.13, "#d9c7a0")).join("") + gfCandle(P * 1.2, P) + gfCandle(P * 2.8, P) },
  { id: "table2", name: "Square table", cat: "Seats & tables", w: 2, h: 2, place: "free", access: "any", seats: { a: ["chair", "stool"], sides: "all", min: 2 }, draw: P => gfTable(6, 6, 2 * P - 12, 2 * P - 12, genfWood[3], 4) + gfMug(P * 0.6, P * 0.6) + gfMug(P * 1.4, P * 1.35) + gfCandle(P, P) },
  { id: "roundtable", name: "Round table", cat: "Seats & tables", w: 1, h: 1, place: "free", access: "any", seats: { a: ["stool"], sides: "all", min: 2 }, draw: P => gfCShadow(P / 2, P / 2, P * 0.42) + gfC(P / 2, P / 2, P * 0.42, genfWood[3]) + gfMug(P * 0.36, P * 0.42) + gfMug(P * 0.62, P * 0.6) },
  { id: "smalltable", name: "Small table", cat: "Seats & tables", w: 1, h: 1, place: "free", access: "any", seats: { a: ["stool", "chair"], sides: "all", min: 1 }, draw: P => gfTable(5, 5, P - 10, P - 10, genfWood[3], 3) + gfCandle(P / 2, P / 2) },
  { id: "desk", name: "Writing desk", cat: "Seats & tables", w: 2, h: 1, place: "wall", access: "front", front: "chair", draw: P => gfTable(4, 4, 2 * P - 8, P * 0.66, genfWood[1], 2) + gfR(P * 0.5, P * 0.14, P * 0.6, P * 0.42, "#efe6cf") + gfL(P * 0.58, P * 0.26, P * 1.0, P * 0.26, "#9a8f7a", 1) + gfL(P * 0.58, P * 0.36, P * 0.95, P * 0.36, "#9a8f7a", 1) + gfC(P * 1.4, P * 0.3, 4, "#1e1a16") + gfL(P * 1.4, P * 0.3, P * 1.55, P * 0.12, "#efe6cf", 1.5) + gfCandle(P * 1.72, P * 0.32) },
  { id: "maptable", name: "Map table", cat: "Seats & tables", w: 2, h: 2, place: "centre", access: "any", seats: { a: ["chair"], sides: "all", min: 1 }, draw: P => gfTable(5, 5, 2 * P - 10, 2 * P - 10, genfWood[1], 4) + gfR(P * 0.3, P * 0.3, P * 1.4, P * 1.4, "#e6d6ae") + `<path d="M${P * 0.45} ${P * 0.9}C${P * 0.8} ${P * 0.5} ${P * 1.1} ${P * 1.3} ${P * 1.55} ${P * 0.8}" stroke="#4f7fa8" stroke-width="3" fill="none"/>` + gfC(P * 0.7, P * 1.3, 3.5, "#a8322d") + gfC(P * 1.3, P * 0.55, 3.5, "#2d5fa8") + gfL(P * 0.5, P * 1.5, P * 1.5, P * 1.5, "#8a7a5a", 1) },
  // Beds
  { id: "bed", name: "Bed", cat: "Beds", w: 1, h: 2, place: "wall", access: "side", door: "far", foot: "chest", draw: P => gfShadow(4, 3, P - 8, 2 * P - 7) + gfR(4, 3, P - 8, 2 * P - 7, genfWood[1], ` rx="3"`) + gfR(7, 6, P - 14, P * 0.36, "#f1ead8", ` rx="5"`) + gfR(6, P * 0.55, P - 12, P * 1.35, "#6f7f9a", ` rx="3"`) + gfL(8, P * 0.75, P - 8, P * 0.75, "rgba(255,255,255,.4)", 2) },
  { id: "bigbed", name: "Curtained bed", cat: "Beds", w: 2, h: 2, place: "wall", access: "side", door: "far", foot: "chest", draw: P => gfShadow(3, 3, 2 * P - 6, 2 * P - 6) + gfR(3, 3, 2 * P - 6, 2 * P - 6, genfWood[0], ` rx="3"`) + gfR(8, 8, P * 0.85, P * 0.38, "#f1ead8", ` rx="6"`) + gfR(P * 1.06, 8, P * 0.85, P * 0.38, "#f1ead8", ` rx="6"`) + gfR(7, P * 0.62, 2 * P - 14, P * 1.28, "#8f2f2f", ` rx="3"`) + gfL(9, P * 0.84, 2 * P - 9, P * 0.84, "rgba(255,255,255,.35)", 2) + [[6, 6], [2 * P - 6, 6], [6, 2 * P - 6], [2 * P - 6, 2 * P - 6]].map(([x, y]) => gfC(x, y, 5, genfWood[0])).join("") + `<path d="M6 6H${2 * P - 6}" stroke="#5a2020" stroke-width="3" stroke-dasharray="4 3"/>` },
  { id: "pallet", name: "Straw pallet", cat: "Beds", w: 1, h: 2, place: "wall", access: "side", draw: P => gfShadow(5, 6, P - 10, 2 * P - 12) + gfR(5, 6, P - 10, 2 * P - 12, "#d9c27a", ` rx="6"`) + Array.from({ length: 7 }, (_, i) => gfL(9, 12 + i * 9, P - 9, 14 + i * 9, "rgba(140,110,40,.5)", 1)).join("") + gfR(7, P * 0.7, P - 14, P * 1.1, "#8c7a60", ` rx="4"`) },
  { id: "cradle", name: "Cradle", cat: "Beds", w: 1, h: 1, place: "free", access: "any", near: "bed", draw: P => gfCShadow(P / 2, P / 2, P * 0.32) + gfE(P / 2, P / 2, P * 0.26, P * 0.36, genfWood[2]) + gfE(P / 2, P * 0.58, P * 0.17, P * 0.2, "#c9d6e8") + gfC(P / 2, P * 0.3, P * 0.1, "#f1ead8") },
  // Storage
  { id: "chest", name: "Chest", cat: "Storage", w: 1, h: 1, place: "wall", access: "front", group: "store", draw: P => gfShadow(P * 0.1, P * 0.18, P * 0.8, P * 0.62) + gfR(P * 0.1, P * 0.18, P * 0.8, P * 0.62, genfWood[1], ` rx="2"`) + gfL(P * 0.1, P * 0.4, P * 0.9, P * 0.4, GENF_INK, 1.5) + gfR(P * 0.27, P * 0.18, 4, P * 0.62, "#4a4d52") + gfR(P * 0.73 - 4, P * 0.18, 4, P * 0.62, "#4a4d52") + gfR(P * 0.45, P * 0.68, P * 0.1, P * 0.1, "#c9a45e") },
  { id: "cupboard", name: "Aumbry (cupboard)", cat: "Storage", w: 1, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfShadow(4, 3, P - 8, P * 0.55) + gfR(4, 3, P - 8, P * 0.55, genfWood[1]) + gfL(P / 2, 5, P / 2, P * 0.55, GENF_INK, 1.5) + gfC(P / 2 - 4, P * 0.36, 1.8, "#c9a45e") + gfC(P / 2 + 4, P * 0.36, 1.8, "#c9a45e") },
  { id: "press", name: "Clothes press", cat: "Storage", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfShadow(4, 3, 2 * P - 8, P * 0.6) + gfR(4, 3, 2 * P - 8, P * 0.6, genfWood[0]) + gfR(8, 7, P - 10, P * 0.6 - 8, genfWood[1]) + gfR(P + 2, 7, P - 10, P * 0.6 - 8, genfWood[1]) + gfC(P - 6, P * 0.36, 2, "#c9a45e") + gfC(P + 6, P * 0.36, 2, "#c9a45e") },
  { id: "shelves", name: "Shelves", cat: "Storage", w: 2, h: 1, place: "wall", access: "front", tall: 1, group: "store", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.42) + gfR(3, 3, 2 * P - 6, P * 0.42, genfWood[2]) + [["#a8322d", 0.25], ["#e0c26a", 0.55], ["#6b8f4e", 0.9], ["#d8cfc0", 1.2], ["#7d5533", 1.5], ["#4f7fa8", 1.75]].map(([c, x]) => gfC(x * P, P * 0.24, P * 0.1, c)).join("") },
  { id: "bookshelf", name: "Bookshelf", cat: "Storage", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.42) + gfR(3, 3, 2 * P - 6, P * 0.42, genfWood[0]) + Array.from({ length: 14 }, (_, i) => `<rect x="${6 + i * (2 * P - 12) / 14}" y="6" width="${(2 * P - 12) / 14 - 1}" height="${P * 0.42 - 6}" fill="${["#7a2e2e", "#2e4a7a", "#5a6b2e", "#8a6a2a", "#4a2e5a", "#6b4a2e"][i % 6]}"/>`).join("") },
  { id: "barrel", name: "Barrel", cat: "Storage", w: 1, h: 1, place: "free", access: "any", group: "store", corner: 1, draw: P => gfBarrel(P / 2, P / 2, P * 0.36) },
  { id: "caskrack", name: "Cask rack", cat: "Storage", w: 2, h: 1, place: "wall", access: "front", group: "store", draw: P => gfR(4, P * 0.08, 2 * P - 8, P * 0.8, genfWood[0]) + gfCask(8, P * 0.14, P - 12, P * 0.68) + gfCask(P + 4, P * 0.14, P - 12, P * 0.68) },
  { id: "winerack", name: "Wine rack", cat: "Storage", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.5) + gfR(3, 3, 2 * P - 6, P * 0.5, genfWood[0]) + Array.from({ length: 12 }, (_, i) => `<circle cx="${10 + (i % 6) * (2 * P - 20) / 5}" cy="${P * (i < 6 ? 0.16 : 0.38)}" r="${P * 0.08}" fill="${i % 3 ? "#3d5a2a" : "#6a1f2a"}" stroke="${GENF_INK}" stroke-width="1"/>`).join("") },
  { id: "crate", name: "Crate", cat: "Storage", w: 1, h: 1, place: "free", access: "any", group: "store", corner: 1, draw: P => gfShadow(P * 0.12, P * 0.12, P * 0.76, P * 0.76) + gfR(P * 0.12, P * 0.12, P * 0.76, P * 0.76, genfWood[3]) + gfPlanks(P * 0.12, P * 0.12, P * 0.76, P * 0.76, 4, true) + gfL(P * 0.16, P * 0.16, P * 0.84, P * 0.84, genfWood[0], 3) + gfL(P * 0.84, P * 0.16, P * 0.16, P * 0.84, genfWood[0], 3) },
  { id: "sacks", name: "Sacks", cat: "Storage", w: 1, h: 1, place: "free", access: "any", group: "store", corner: 1, draw: P => gfSack(P * 0.33, P * 0.4, P * 0.22) + gfSack(P * 0.66, P * 0.45, P * 0.22, "#c4a878") + gfSack(P * 0.48, P * 0.7, P * 0.2, "#a88d5e") },
  { id: "strongbox", name: "Strongbox", cat: "Storage", w: 1, h: 1, place: "wall", access: "front", group: "treasure", draw: P => gfShadow(P * 0.2, P * 0.25, P * 0.6, P * 0.5) + gfR(P * 0.2, P * 0.25, P * 0.6, P * 0.5, "#5d6168") + [0.26, 0.74].flatMap(x => [0.32, 0.68].map(y => `<circle cx="${P * x}" cy="${P * y}" r="1.8" fill="#c9c9c9"/>`)).join("") + gfR(P * 0.44, P * 0.58, P * 0.12, P * 0.1, "#c9a45e") },
  { id: "coins", name: "Coin pile", cat: "Storage", w: 1, h: 1, place: "free", access: "any", group: "treasure", corner: 1, draw: P => [[0.4, 0.45, 0.2], [0.6, 0.55, 0.17], [0.45, 0.65, 0.14], [0.62, 0.36, 0.12]].map(([x, y, r]) => `<circle cx="${P * x}" cy="${P * y}" r="${P * r}" fill="#e0b23c" stroke="#8a6a1a" stroke-width="1.5"/><circle cx="${P * x - 2}" cy="${P * y - 2}" r="${P * r * 0.35}" fill="#f6dc8a"/>`).join("") },
  // Kitchen and trades
  { id: "worktable", name: "Kitchen table", cat: "Kitchen", w: 2, h: 1, place: "free", access: "any", near: "hearth", draw: P => gfTable(4, P * 0.12, 2 * P - 8, P * 0.76, genfWood[3], 3) + gfE(P * 0.45, P * 0.45, P * 0.2, P * 0.14, "#c98f4a") + gfC(P * 1.15, P * 0.48, P * 0.16, "#d8cfc0") + gfC(P * 1.15, P * 0.48, P * 0.09, "#b8a888") + gfL(P * 1.5, P * 0.3, P * 1.8, P * 0.62, "#9aa0a8", 2.5) },
  { id: "block", name: "Chopping block", cat: "Kitchen", w: 1, h: 1, place: "free", access: "any", near: "hearth", draw: P => gfCShadow(P / 2, P / 2, P * 0.3) + gfC(P / 2, P / 2, P * 0.3, "#a77a4a") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.2}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1"/><circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.1}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1"/>` + gfL(P * 0.4, P * 0.55, P * 0.75, P * 0.3, "#9aa0a8", 3) },
  { id: "oven", name: "Bread oven", cat: "Kitchen", w: 1, h: 1, place: "corner", access: "front", draw: P => gfCShadow(P / 2, P * 0.45, P * 0.4) + gfC(P / 2, P * 0.45, P * 0.4, "#9a948a") + `<circle cx="${P / 2}" cy="${P * 0.45}" r="${P * 0.28}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1.5"/>` + gfR(P * 0.34, P * 0.66, P * 0.32, P * 0.2, "#1e1a16", ` rx="4"`) },
  { id: "anvil", name: "Anvil", cat: "Smithy", w: 1, h: 1, place: "free", access: "any", near: "hearth", draw: P => gfCShadow(P / 2, P / 2, P * 0.34) + gfC(P / 2, P / 2, P * 0.34, "#7d5533") + `<path d="M${P * 0.22} ${P * 0.38}H${P * 0.7}L${P * 0.9} ${P * 0.5}L${P * 0.7} ${P * 0.62}H${P * 0.22}Z" fill="#4a4d52" stroke="${GENF_INK}" stroke-width="2"/>` + gfL(P * 0.28, P * 0.42, P * 0.62, P * 0.42, "#8a8f96", 1.5) },
  { id: "quench", name: "Quench tub", cat: "Smithy", w: 1, h: 1, place: "free", access: "any", near: "anvil", draw: P => gfCShadow(P / 2, P / 2, P * 0.36) + gfC(P / 2, P / 2, P * 0.36, "#7d5533") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.27}" fill="#3f6f8a" stroke="#3a3530" stroke-width="2"/><path d="M${P * 0.36} ${P * 0.5}q${P * 0.07} -${P * 0.06} ${P * 0.14} 0t${P * 0.14} 0" stroke="rgba(255,255,255,.5)" fill="none" stroke-width="1.5"/>` },
  { id: "bellows", name: "Bellows", cat: "Smithy", w: 1, h: 1, place: "hearth", access: "any", draw: P => `<path d="M${P * 0.5} ${P * 0.1}L${P * 0.82} ${P * 0.6}Q${P * 0.5} ${P * 0.95} ${P * 0.18} ${P * 0.6}Z" fill="#6a4a2e" stroke="${GENF_INK}" stroke-width="2"/>` + `<path d="M${P * 0.5} ${P * 0.22}L${P * 0.72} ${P * 0.58}Q${P * 0.5} ${P * 0.82} ${P * 0.28} ${P * 0.58}Z" fill="#9c6d42" stroke="${GENF_INK}" stroke-width="1.5"/>` + gfR(P * 0.46, 2, P * 0.08, P * 0.14, "#4a4d52") },
  { id: "grindstone", name: "Grindstone", cat: "Smithy", w: 1, h: 1, place: "free", access: "any", draw: P => gfShadow(P * 0.2, P * 0.25, P * 0.6, P * 0.5) + gfR(P * 0.2, P * 0.25, P * 0.6, P * 0.5, genfWood[1]) + gfR(P * 0.42, P * 0.12, P * 0.16, P * 0.76, "#a8a29a", ` rx="3"`) + gfL(P * 0.58, P * 0.5, P * 0.86, P * 0.5, "#4a4d52", 3) },
  { id: "toolrack", name: "Tool rack", cat: "Smithy", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfR(4, 3, 2 * P - 8, P * 0.18, genfWood[0]) + [0.3, 0.7, 1.1, 1.5].map((x, i) => gfL(x * P, P * 0.12, x * P + (i % 2 ? 4 : -4), P * 0.55, "#4a4d52", 3) + gfR(x * P + (i % 2 ? 0 : -8), P * 0.5, 8, 6, "#5d6168")).join("") + gfL(1.8 * P, P * 0.12, 1.8 * P, P * 0.6, genfWood[1], 3) },
  { id: "coalbin", name: "Coal bin", cat: "Smithy", w: 1, h: 1, place: "wall", access: "front", near: "hearth", draw: P => gfShadow(4, 4, P - 8, P * 0.7) + gfR(4, 4, P - 8, P * 0.7, genfWood[1]) + Array.from({ length: 9 }, (_, i) => `<circle cx="${P * (0.24 + (i % 3) * 0.26)}" cy="${P * (0.22 + Math.floor(i / 3) * 0.17)}" r="${P * 0.09}" fill="#1e1a16"/>`).join("") },
  { id: "ironstock", name: "Iron stock", cat: "Smithy", w: 2, h: 1, place: "wall", access: "front", group: "store", draw: P => gfR(4, P * 0.12, 6, P * 0.6, genfWood[0]) + gfR(2 * P - 10, P * 0.12, 6, P * 0.6, genfWood[0]) + Array.from({ length: 6 }, (_, i) => gfL(10, P * (0.18 + i * 0.09), 2 * P - 10, P * (0.18 + i * 0.09), "#6a6f78", 3)).join("") },
  { id: "workbench", name: "Workbench", cat: "Workshop", w: 2, h: 1, place: "wall", access: "front", draw: P => gfTable(4, 4, 2 * P - 8, P * 0.62, genfWood[1], 2) + gfR(P * 1.5, 2, P * 0.3, P * 0.22, "#4a4d52") + gfL(P * 0.4, P * 0.3, P * 0.75, P * 0.3, "#4a4d52", 3) + gfR(P * 0.3, P * 0.24, 7, 12, genfWood[0]) + `<circle cx="${P * 1.05}" cy="${P * 0.38}" r="3" fill="#c9c9c9"/><circle cx="${P * 1.15}" cy="${P * 0.3}" r="2.5" fill="#c9c9c9"/>` },
  { id: "cuttingtable", name: "Cutting table", cat: "Workshop", w: 2, h: 1, place: "free", access: "any", draw: P => gfTable(4, P * 0.12, 2 * P - 8, P * 0.76, genfWood[3], 3) + `<path d="M${P * 0.3} ${P * 0.18}H${P * 1.3}L${P * 1.4} ${P * 0.82}H${P * 0.25}Z" fill="#4f6fa8" stroke="${GENF_INK}" stroke-width="1.5" opacity=".9"/>` + gfL(P * 1.55, P * 0.3, P * 1.8, P * 0.65, "#9aa0a8", 2.5) + gfL(P * 1.8, P * 0.3, P * 1.55, P * 0.65, "#9aa0a8", 2.5) },
  { id: "loom", name: "Loom", cat: "Workshop", w: 2, h: 2, place: "wall", access: "front", draw: P => gfShadow(4, 4, 2 * P - 8, 2 * P - 14) + gfR(4, 4, 2 * P - 8, 2 * P - 14, "none") + gfR(4, 4, 2 * P - 8, 8, genfWood[0]) + gfR(4, 2 * P - 18, 2 * P - 8, 8, genfWood[0]) + Array.from({ length: 13 }, (_, i) => gfL(10 + i * (2 * P - 20) / 12, 12, 10 + i * (2 * P - 20) / 12, 2 * P - 18, "#e9dfc6", 1)).join("") + `<rect x="10" y="${P * 1.1}" width="${2 * P - 20}" height="${P * 0.6}" fill="#8f2f2f" opacity=".85"/>` + gfR(P * 0.6, 2 * P - 10, P * 0.8, 7, genfWood[2]) },
  { id: "spinning", name: "Spinning wheel", cat: "Workshop", w: 1, h: 1, place: "free", access: "any", draw: P => gfR(P * 0.15, P * 0.55, P * 0.7, P * 0.2, genfWood[1]) + gfE(P * 0.36, P * 0.4, P * 0.07, P * 0.3, "none") + gfL(P * 0.36, P * 0.12, P * 0.36, P * 0.68, genfWood[0], 2) + gfC(P * 0.72, P * 0.42, 4, "#e9dfc6") },
  { id: "dressform", name: "Dress form", cat: "Workshop", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.25) + gfC(P / 2, P / 2, P * 0.12, genfWood[0]) + gfE(P / 2, P / 2, P * 0.28, P * 0.18, "#a8322d") + gfE(P / 2, P * 0.46, P * 0.18, P * 0.1, "#c24a42") },
  { id: "clothbolts", name: "Cloth bolts", cat: "Workshop", w: 1, h: 1, place: "wall", access: "front", group: "cloth", draw: P => gfR(3, 3, P - 6, P * 0.6, genfWood[0]) + ["#4f6fa8", "#a8322d", "#6b8f4e", "#d8c07a"].map((c, i) => gfR(6, 6 + i * P * 0.13, P - 12, P * 0.12, c, ` rx="4"`)).join("") },
  { id: "display", name: "Display table", cat: "Shop", w: 2, h: 1, place: "free", access: "any", door: "near", draw: P => gfTable(4, P * 0.12, 2 * P - 8, P * 0.76, genfWood[2], 2) + [["#a8322d", 0.35], ["#e0c26a", 0.7], ["#6b8f4e", 1.05], ["#4f7fa8", 1.4], ["#d8cfc0", 1.7]].map(([c, x], i) => gfR(x * P - 6, P * (i % 2 ? 0.25 : 0.45), 12, 12, c, ` rx="2"`)).join("") },
  { id: "counter", name: "Shop counter", cat: "Shop", w: 3, h: 1, place: "free", access: "frontback", face: "door", door: "near", draw: P => gfShadow(4, P * 0.18, 3 * P - 8, P * 0.64) + gfR(4, P * 0.18, 3 * P - 8, P * 0.64, genfWood[0]) + gfR(9, P * 0.26, 3 * P - 18, P * 0.48, genfWood[2]) + gfL(P * 0.6, P * 0.36, P * 0.6, P * 0.64, "#4a4d52", 2) + gfL(P * 0.4, P * 0.38, P * 0.8, P * 0.38, "#4a4d52", 2) + gfC(P * 0.4, P * 0.5, 4, "#c9a45e") + gfC(P * 0.8, P * 0.5, 4, "#c9a45e") + [1.6, 1.75, 1.68].map((x, i) => gfC(x * P, P * (0.4 + i * 0.08), 3, "#e0b23c")).join("") + gfBook(P * 2.2, P * 0.32, P * 0.4, P * 0.32, "#6b4a2e") },
  { id: "counter2", name: "Stall-board counter", cat: "Shop", w: 2, h: 1, place: "free", access: "frontback", face: "door", door: "near", draw: P => gfShadow(4, P * 0.18, 2 * P - 8, P * 0.64) + gfR(4, P * 0.18, 2 * P - 8, P * 0.64, genfWood[0]) + gfR(9, P * 0.26, 2 * P - 18, P * 0.48, genfWood[2]) + gfL(P * 0.5, P * 0.36, P * 0.5, P * 0.64, "#4a4d52", 2) + gfL(P * 0.3, P * 0.38, P * 0.7, P * 0.38, "#4a4d52", 2) + gfC(P * 0.3, P * 0.5, 4, "#c9a45e") + gfC(P * 0.7, P * 0.5, 4, "#c9a45e") + [1.2, 1.35, 1.28].map((x, i) => gfC(x * P, P * (0.4 + i * 0.08), 3, "#e0b23c")).join("") },
  { id: "stallboard", name: "Stall board (shop window counter)", cat: "Shop", w: 2, h: 1, place: "wall", access: "front", door: "near", draw: P => gfShadow(3, 4, 2 * P - 6, P * 0.55) + gfR(3, 4, 2 * P - 6, P * 0.55, genfWood[2]) + gfPlanks(3, 4, 2 * P - 6, P * 0.55, 3, false) + gfL(3, 6, 2 * P - 3, 6, genfWood[0], 3) + [0.45, 1.0, 1.5].map((x, i) => gfE(x * P, P * 0.32, P * 0.13, P * 0.1, ["#c8665a", "#e0b23c", "#d8cfc0"][i])).join("") },
  { id: "reception", name: "Reception desk", cat: "Shop", w: 2, h: 1, place: "free", access: "frontback", face: "door", door: "near", behind: "stool", draw: P => gfShadow(4, P * 0.14, 2 * P - 8, P * 0.7) + gfR(4, P * 0.14, 2 * P - 8, P * 0.7, genfWood[0]) + gfR(9, P * 0.22, 2 * P - 18, P * 0.54, genfWood[2]) + gfR(P * 0.3, P * 0.28, P * 0.66, P * 0.42, "#efe6cf") + gfL(P * 0.63, P * 0.3, P * 0.63, P * 0.68, "#9a8f7a", 1.2) + [0.38, 0.46, 0.54].map(y => gfL(P * 0.36, P * y, P * 0.58, P * y, "#9a8f7a", 1) + gfL(P * 0.68, P * y, P * 0.9, P * y, "#9a8f7a", 1)).join("") + gfC(P * 1.18, P * 0.4, 3.5, "#1e1a16") + gfL(P * 1.18, P * 0.4, P * 1.4, P * 0.26, "#f1ead8", 2) + gfC(P * 1.6, P * 0.5, P * 0.12, "#c9a45e") + gfC(P * 1.6, P * 0.5, P * 0.05, "#8a6a1a") },
  { id: "questboard", name: "Quest board", cat: "Hall & church", w: 2, h: 1, place: "wall", access: "front", tall: 1, door: "near", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.5) + gfR(3, 3, 2 * P - 6, P * 0.5, genfWood[0]) + gfR(7, 6, 2 * P - 14, P * 0.5 - 6, "#b08a5a") + [[0.18, 0.1, -6], [0.55, 0.14, 4], [0.95, 0.08, -3], [1.32, 0.13, 7], [1.62, 0.09, -5]].map(([x, y, a], i) => `<g transform="rotate(${a} ${x * P + 8} ${y * P + 8})"><rect x="${x * P}" y="${y * P}" width="${P * 0.32}" height="${P * 0.34}" fill="${i % 2 ? "#efe6cf" : "#e6d6ae"}" stroke="#7a6a4a" stroke-width="1"/>${gfL(x * P + 3, y * P + 7, x * P + P * 0.28, y * P + 7, "#8a7a5a", 1)}${gfL(x * P + 3, y * P + 11, x * P + P * 0.24, y * P + 11, "#8a7a5a", 1)}<circle cx="${x * P + P * 0.16}" cy="${y * P + 3}" r="2.2" fill="${["#a8322d", "#2d5fa8", "#c9a42a"][i % 3]}"/></g>`).join("") },
  { id: "bar", name: "Bar", cat: "Tavern", w: 3, h: 1, place: "gap", access: "frontback", draw: P => gfShadow(3, P * 0.12, 3 * P - 6, P * 0.76) + gfR(3, P * 0.12, 3 * P - 6, P * 0.76, genfWood[0]) + gfR(8, P * 0.2, 3 * P - 16, P * 0.6, "#8a5a33") + gfPlanks(8, P * 0.2, 3 * P - 16, P * 0.6, 2, true) + [0.5, 1.1, 1.9, 2.5].map(x => gfMug(x * P, P * 0.5)).join("") + gfCask(P * 1.3, P * 0.28, P * 0.4, P * 0.3) },
  // Halls, churches, special rooms
  { id: "lectern", name: "Lectern", cat: "Hall & church", w: 1, h: 1, place: "free", access: "front", draw: P => gfCShadow(P / 2, P * 0.5, P * 0.12) + gfC(P / 2, P * 0.5, P * 0.12, genfWood[0]) + `<path d="M${P * 0.2} ${P * 0.3}H${P * 0.8}L${P * 0.74} ${P * 0.62}H${P * 0.26}Z" fill="${genfWood[1]}" stroke="${GENF_INK}" stroke-width="2"/>` + gfBook(P * 0.3, P * 0.34, P * 0.4, P * 0.24, "#7a2e2e") },
  { id: "altar", name: "Altar", cat: "Hall & church", w: 2, h: 1, place: "wall", access: "front", door: "far", face: "door", draw: P => gfShadow(4, 4, 2 * P - 8, P * 0.7) + gfR(4, 4, 2 * P - 8, P * 0.7, "#cfc8ba") + gfR(4, P * 0.14, 2 * P - 8, P * 0.4, "#f1ead8") + gfR(P * 0.85, P * 0.14, P * 0.3, P * 0.62, "#8f2f2f") + gfCandle(P * 0.3, P * 0.32) + gfCandle(P * 1.7, P * 0.32) + gfC(P, P * 0.34, 5, "#e0b23c") },
  { id: "candles", name: "Candle stand", cat: "Hall & church", w: 1, h: 1, place: "free", access: "any", near: "altar", draw: P => gfCShadow(P / 2, P / 2, P * 0.18) + gfC(P / 2, P / 2, P * 0.18, "#3a3530") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.32}" fill="rgba(255,190,80,.18)"/>` + gfCandle(P / 2, P / 2) },
  { id: "font", name: "Font", cat: "Hall & church", w: 1, h: 1, place: "free", access: "any", door: "near", draw: P => `<polygon points="${Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${(P / 2 + Math.cos(a) * P * 0.36).toFixed(1)},${(P / 2 + Math.sin(a) * P * 0.36).toFixed(1)}`; }).join(" ")}" fill="#bdb6a8" stroke="${GENF_INK}" stroke-width="2"/>` + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.22}" fill="#4f7fa8" stroke="#6a655c" stroke-width="2"/>` },
  { id: "statue", name: "Statue", cat: "Hall & church", w: 1, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfShadow(P * 0.12, P * 0.12, P * 0.76, P * 0.76) + gfR(P * 0.12, P * 0.12, P * 0.76, P * 0.76, "#a8a29a") + gfE(P / 2, P * 0.52, P * 0.26, P * 0.15, "#d8d2c6") + gfC(P / 2, P * 0.46, P * 0.12, "#e6e1d6") },
  { id: "weaponrack", name: "Weapon rack", cat: "Hall & church", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfR(4, 3, 2 * P - 8, P * 0.2, genfWood[0]) + gfR(4, P * 0.55, 2 * P - 8, P * 0.12, genfWood[0]) + [0.35, 0.7, 1.05, 1.4, 1.7].map((x, i) => gfL(x * P, 4, x * P, P * 0.75, i % 2 ? "#9aa0a8" : "#7d5533", i % 2 ? 3 : 2.5) + (i % 2 ? gfL(x * P - 6, P * 0.6, x * P + 6, P * 0.6, "#4a4d52", 3) : `<path d="M${x * P - 4} 6L${x * P} -1L${x * P + 4} 6Z" fill="#9aa0a8"/>`)).join("") },
  { id: "dummy", name: "Training dummy", cat: "Hall & church", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.22) + gfL(P * 0.15, P / 2, P * 0.85, P / 2, genfWood[0], 4) + gfC(P / 2, P / 2, P * 0.2, "#d9c27a") + gfC(P / 2, P / 2, P * 0.08, "#a8322d") },
  { id: "coffin", name: "Coffin", cat: "Hall & church", w: 1, h: 2, place: "free", access: "side", group: "tomb", draw: P => gfShadow(P * 0.2, 6, P * 0.6, 2 * P - 12) + `<polygon points="${P * 0.32},6 ${P * 0.68},6 ${P * 0.8},${P * 0.5} ${P * 0.68},${2 * P - 6} ${P * 0.32},${2 * P - 6} ${P * 0.2},${P * 0.5}" fill="#9a948a" stroke="${GENF_INK}" stroke-width="2"/>` + gfL(P / 2, P * 0.35, P / 2, P * 0.85, "#6a655c", 2) + gfL(P * 0.38, P * 0.5, P * 0.62, P * 0.5, "#6a655c", 2) },
  { id: "bones", name: "Bone pile", cat: "Hall & church", w: 1, h: 1, place: "free", access: "any", group: "tomb", corner: 1, draw: P => gfL(P * 0.2, P * 0.3, P * 0.75, P * 0.55, "#e6dfcc", 4) + gfL(P * 0.3, P * 0.75, P * 0.7, P * 0.25, "#e6dfcc", 4) + gfC(P * 0.5, P * 0.55, P * 0.13, "#efe9d8") + `<circle cx="${P * 0.46}" cy="${P * 0.53}" r="2" fill="${GENF_INK}"/><circle cx="${P * 0.55}" cy="${P * 0.53}" r="2" fill="${GENF_INK}"/>` },
  { id: "tub", name: "Bathtub", cat: "Bath", w: 2, h: 1, place: "free", access: "any", draw: P => gfShadow(5, 5, 2 * P - 10, P - 10, P * 0.4) + gfR(5, 5, 2 * P - 10, P - 10, genfWood[2], ` rx="${P * 0.4}"`) + `<rect x="11" y="11" width="${2 * P - 22}" height="${P - 22}" rx="${P * 0.3}" fill="#6f9fb8" stroke="#3a3530" stroke-width="2"/>` },
  { id: "dyevat", name: "Dye vat", cat: "Bath", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.38) + gfC(P / 2, P / 2, P * 0.38, "#7d5533") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.29}" fill="${["#4a3a8a", "#8a2a2a", "#c9a42a", "#2a6a4a"][Math.floor(P) % 4]}" stroke="#3a3530" stroke-width="2"/>` },
  { id: "washstand", name: "Washstand", cat: "Bath", w: 1, h: 1, place: "wall", access: "front", draw: P => gfShadow(5, 4, P - 10, P * 0.6) + gfR(5, 4, P - 10, P * 0.6, genfWood[2]) + gfC(P * 0.42, P * 0.34, P * 0.16, "#d8cfc0") + `<circle cx="${P * 0.42}" cy="${P * 0.34}" r="${P * 0.1}" fill="#9fc3d6"/>` + gfC(P * 0.74, P * 0.26, P * 0.08, "#b8a888") },
  { id: "privy", name: "Privy seat", cat: "Bath", w: 1, h: 1, place: "wall", access: "front", draw: P => gfR(3, 3, P - 6, P * 0.66, genfWood[2]) + gfE(P / 2, P * 0.36, P * 0.16, P * 0.12, "#1e1a16") },
  // Village buildings
  { id: "hightable", name: "High table", cat: "Hall & church", w: 4, h: 1, place: "gap", access: "front", door: "far", face: "door", seats: { a: ["carvedchair", "chair"], sides: "back", min: 1 }, draw: P => gfShadow(3, 4, 4 * P - 6, P * 0.8) + gfR(3, 4, 4 * P - 6, P * 0.8, genfWood[1]) + `<rect x="${P * 0.2}" y="${P * 0.14}" width="${P * 3.6}" height="${P * 0.6}" fill="#f1ead8" opacity=".9"/>` + gfL(P * 0.2, P * 0.6, P * 3.8, P * 0.6, "#8f2f2f", 3) + [0.6, 1.4, 2.6, 3.4].map(x => gfC(x * P, P * 0.38, P * 0.13, "#d0d4da")).join("") + gfC(P * 2, P * 0.36, P * 0.16, "#e0b23c") + gfCandle(P, P * 0.36) + gfCandle(P * 3, P * 0.36) },
  { id: "buffet", name: "Buffet (cupboard of plate)", cat: "Hall & church", w: 2, h: 1, place: "wall", access: "front", tall: 1, near: "hightable", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.55) + gfR(3, 3, 2 * P - 6, P * 0.55, genfWood[0]) + gfR(6, 6, 2 * P - 12, P * 0.18, genfWood[1]) + [0.3, 0.65, 1.0, 1.35, 1.7].map((x, i) => gfC(x * P, P * 0.38, P * (i % 2 ? 0.09 : 0.12), i % 2 ? "#e0b23c" : "#d0d4da")).join("") },
  { id: "quern", name: "Quern", cat: "Kitchen", w: 1, h: 1, place: "free", access: "any", near: "hearth", draw: P => gfCShadow(P / 2, P / 2, P * 0.3) + gfC(P / 2, P / 2, P * 0.3, "#a8a29a") + gfC(P / 2, P / 2, P * 0.07, "#4a4540") + gfL(P * 0.66, P * 0.4, P * 0.78, P * 0.22, genfWood[0], 3.5) },
  { id: "cauldron", name: "Cauldron", cat: "Kitchen", w: 1, h: 1, place: "free", access: "any", near: "hearth", draw: P => gfCShadow(P / 2, P / 2, P * 0.32) + [0, 2.1, 4.2].map(a => gfL(P / 2, P / 2, P / 2 + Math.cos(a) * P * 0.42, P / 2 + Math.sin(a) * P * 0.42, "#3a3530", 3)).join("") + gfC(P / 2, P / 2, P * 0.3, "#3a3a3e") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.21}" fill="#7a5a3a"/>` + gfL(P * 0.22, P / 2, P * 0.78, P / 2, "#6a6f78", 1.5) },
  { id: "churn", name: "Butter churn", cat: "Kitchen", w: 1, h: 1, place: "free", access: "any", corner: 1, draw: P => gfCShadow(P / 2, P / 2, P * 0.24) + gfC(P / 2, P / 2, P * 0.24, "#9c6d42") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.17}" fill="none" stroke="#3a3530" stroke-width="2"/>` + gfC(P / 2, P / 2, P * 0.06, genfWood[0]) },
  { id: "cheesepress", name: "Cheese press", cat: "Kitchen", w: 1, h: 1, place: "wall", access: "front", draw: P => gfShadow(5, 5, P - 10, P * 0.7) + gfR(5, 5, P - 10, P * 0.7, genfWood[1]) + gfC(P / 2, P * 0.4, P * 0.2, "#e8d9a0") + gfL(P * 0.15, P * 0.4, P * 0.85, P * 0.4, genfWood[0], 4) },
  { id: "manger", name: "Manger & hay rack", cat: "Farm", w: 2, h: 1, place: "wall", access: "front", group: "farm", draw: P => gfR(3, 3, 2 * P - 6, P * 0.5, genfWood[1]) + gfR(7, 7, 2 * P - 14, P * 0.3, "#d9c27a") + Array.from({ length: 9 }, (_, i) => gfL(8 + i * (2 * P - 16) / 8, 4, 8 + i * (2 * P - 16) / 8, P * 0.5, genfWood[0], 1.5)).join("") + gfL(3, P * 0.62, 2 * P - 3, P * 0.62, genfWood[0], 5) },
  { id: "cowstall", name: "Cow stall", cat: "Farm", w: 2, h: 2, place: "wall", access: "front", group: "farm", draw: P => gfR(3, 3, 2 * P - 6, P * 0.42, genfWood[1]) + gfR(7, 6, 2 * P - 14, P * 0.26, "#d9c27a") + gfL(4, 2, 4, P * 1.7, genfWood[0], 5) + gfL(2 * P - 4, 2, 2 * P - 4, P * 1.7, genfWood[0], 5) + gfC(P, P * 0.55, 3, "#4a4d52") + gfL(P, P * 0.55, P, P * 0.9, "#6a6f78", 1.5) + Array.from({ length: 12 }, (_, i) => `<line x1="${8 + (i * 37) % (2 * P - 16)}" y1="${P * 0.8 + (i * 23) % (P * 0.9)}" x2="${14 + (i * 37) % (2 * P - 16)}" y2="${P * 0.84 + (i * 23) % (P * 0.9)}" stroke="#c8ae62" stroke-width="1.4"/>`).join("") },
  { id: "sheaves", name: "Sheaves", cat: "Farm", w: 2, h: 2, place: "free", access: "any", group: "crop", corner: 1, draw: P => Array.from({ length: 9 }, (_, i) => { const x = P * (0.45 + (i % 3) * 0.55), y = P * (0.45 + Math.floor(i / 3) * 0.55); return gfE(x, y, P * 0.26, P * 0.24, "#d9b85a") + `<circle cx="${x}" cy="${y}" r="${P * 0.12}" fill="#e8cf7a" stroke="#9c7a32" stroke-width="1"/>` + gfL(x - P * 0.22, y, x + P * 0.22, y, "#9c7a32", 1.5); }).join("") },
  { id: "haystack", name: "Hay", cat: "Farm", w: 2, h: 2, place: "free", access: "any", group: "crop", corner: 1, draw: P => gfShadow(5, 6, 2 * P - 10, 2 * P - 10, P * 0.7) + `<rect x="5" y="5" width="${2 * P - 10}" height="${2 * P - 10}" rx="${P * 0.7}" fill="#c9b062" stroke="${GENF_INK}" stroke-width="2"/>` + Array.from({ length: 22 }, (_, i) => { const a = i * 2.4, rr = P * (0.15 + (i % 5) * 0.14); return `<line x1="${(P + Math.cos(a) * rr).toFixed(1)}" y1="${(P + Math.sin(a) * rr).toFixed(1)}" x2="${(P + Math.cos(a + 0.5) * rr + 6).toFixed(1)}" y2="${(P + Math.sin(a + 0.5) * rr).toFixed(1)}" stroke="${i % 2 ? "#e3cf8a" : "#9c8a42"}" stroke-width="1.6"/>`; }).join("") },
  { id: "strawpile", name: "Straw pile", cat: "Farm", w: 2, h: 2, place: "free", access: "any", group: "crop", corner: 1, draw: P => `<rect x="5" y="5" width="${2 * P - 10}" height="${2 * P - 10}" rx="${P * 0.5}" fill="#e3d08e" stroke="${GENF_INK}" stroke-width="2"/>` + Array.from({ length: 26 }, (_, i) => { const x = 10 + (i * 29) % (2 * P - 20), y = 10 + (i * 17) % (2 * P - 20); return `<line x1="${x}" y1="${y}" x2="${x + 8}" y2="${y + (i % 3) * 3 - 3}" stroke="#b89a52" stroke-width="1.5"/>`; }).join("") },
  { id: "flail", name: "Flail", cat: "Farm", w: 1, h: 1, place: "wall", access: "front", draw: P => gfL(P * 0.15, P * 0.3, P * 0.62, P * 0.3, genfWood[2], 3.5) + gfL(P * 0.62, P * 0.3, P * 0.88, P * 0.62, genfWood[0], 4) + gfC(P * 0.62, P * 0.3, 2.2, "#4a3a28") },
  { id: "winnow", name: "Winnowing basket", cat: "Farm", w: 1, h: 1, place: "wall", access: "front", draw: P => `<path d="M${P * 0.15} ${P * 0.25}Q${P / 2} ${P * 0.05} ${P * 0.85} ${P * 0.25}L${P * 0.75} ${P * 0.8}Q${P / 2} ${P * 0.92} ${P * 0.25} ${P * 0.8}Z" fill="#c9a35e" stroke="${GENF_INK}" stroke-width="2"/>` + [0.35, 0.5, 0.65].map(y => gfL(P * 0.22, P * y, P * 0.78, P * y, "#8a6a2a", 1)).join("") + `<ellipse cx="${P / 2}" cy="${P * 0.62}" rx="${P * 0.16}" ry="${P * 0.08}" fill="#e8cf7a"/>` },
  { id: "cart", name: "Hay cart", cat: "Farm", w: 2, h: 3, place: "free", access: "any", draw: P => gfShadow(P * 0.25, P * 0.3, P * 1.5, P * 2.2) + [[0.1, 0.8], [1.75, 0.8], [0.1, 1.9], [1.75, 1.9]].map(([x, y]) => gfR(x * P, y * P, P * 0.15, P * 0.45, "#3a2c1c")).join("") + gfR(P * 0.25, P * 0.3, P * 1.5, P * 2.2, genfWood[2]) + gfPlanks(P * 0.25, P * 0.3, P * 1.5, P * 2.2, 5, false) + `<rect x="${P * 0.4}" y="${P * 0.5}" width="${P * 1.2}" height="${P * 1.6}" rx="${P * 0.4}" fill="#c9b062" opacity=".9"/>` + gfL(P * 0.75, P * 2.5, P * 0.75, P * 2.95, genfWood[0], 3.5) + gfL(P * 1.25, P * 2.5, P * 1.25, P * 2.95, genfWood[0], 3.5) },
  { id: "saddlerack", name: "Saddle rack", cat: "Farm", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfR(3, 3, 2 * P - 6, P * 0.16, genfWood[0]) + [0.5, 1.5].map(x => `<path d="M${x * P - P * 0.3} ${P * 0.14}Q${x * P} ${P * 0.9} ${x * P + P * 0.3} ${P * 0.14}Z" fill="#6a3f22" stroke="${GENF_INK}" stroke-width="2"/>` + gfE(x * P, P * 0.38, P * 0.14, P * 0.1, "#8a5a33")).join("") },
  { id: "harness", name: "Harness pegs", cat: "Farm", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfR(3, 3, 2 * P - 6, P * 0.14, genfWood[0]) + [0.35, 0.8, 1.25, 1.65].map((x, i) => `<circle cx="${x * P}" cy="${P * 0.1}" r="2.5" fill="#c9c9c9"/>` + (i % 2 ? `<path d="M${x * P - 7} ${P * 0.15}Q${x * P} ${P * 0.6} ${x * P + 7} ${P * 0.15}" fill="none" stroke="#5a3a22" stroke-width="3"/>` : `<ellipse cx="${x * P}" cy="${P * 0.32}" rx="${P * 0.12}" ry="${P * 0.17}" fill="none" stroke="#5a3a22" stroke-width="3.5"/>`)).join("") },
  { id: "oatbin", name: "Feed bin", cat: "Farm", w: 2, h: 1, place: "wall", access: "front", group: "store", draw: P => gfShadow(4, 4, 2 * P - 8, P * 0.66) + gfR(4, 4, 2 * P - 8, P * 0.66, genfWood[1]) + gfL(P, 5, P, P * 0.68, GENF_INK, 1.5) + gfR(8, 8, P - 12, P * 0.56, "#d8c07a") + gfR(P + 4, 8, P - 12, P * 0.56, "#c8a868") },
  { id: "millstones", name: "Millstones", cat: "Mill & bakery", w: 2, h: 2, place: "centre", access: "any", draw: P => `<polygon points="${Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${(P + Math.cos(a) * P * 0.92).toFixed(1)},${(P + Math.sin(a) * P * 0.92).toFixed(1)}`; }).join(" ")}" fill="${genfWood[1]}" stroke="${GENF_INK}" stroke-width="2"/>` + gfC(P, P, P * 0.7, "#a8a29a") + `<circle cx="${P}" cy="${P}" r="${P * 0.5}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1.5"/>` + Array.from({ length: 8 }, (_, i) => gfL(P, P, P + Math.cos(i * 0.785) * P * 0.68, P + Math.sin(i * 0.785) * P * 0.68, "rgba(43,37,32,.3)", 1)).join("") + gfR(P * 0.7, P * 0.7, P * 0.6, P * 0.6, genfWood[2]) + gfR(P * 0.85, P * 0.85, P * 0.3, P * 0.3, "#d9b85a") },
  { id: "mealbin", name: "Meal bin", cat: "Mill & bakery", w: 2, h: 1, place: "wall", access: "front", group: "store", draw: P => gfShadow(4, 4, 2 * P - 8, P * 0.66) + gfR(4, 4, 2 * P - 8, P * 0.66, genfWood[2]) + gfR(8, 8, 2 * P - 16, P * 0.56, "#efe6cf") + gfR(P * 0.8, 2, P * 0.4, P * 0.2, genfWood[0]) },
  { id: "sackhoist", name: "Sack hoist trap", cat: "Mill & bakery", w: 1, h: 1, place: "free", access: "any", draw: P => gfR(P * 0.12, P * 0.12, P * 0.76, P * 0.76, genfWood[0]) + gfL(P * 0.5, P * 0.12, P * 0.5, P * 0.88, GENF_INK, 1.5) + Array.from({ length: 6 }, (_, i) => `<circle cx="${P / 2}" cy="${P * (0.25 + i * 0.1)}" r="3" fill="none" stroke="#8a8f96" stroke-width="2"/>`).join("") },
  { id: "spare", name: "Spare millstone", cat: "Mill & bakery", w: 1, h: 1, place: "free", access: "any", corner: 1, draw: P => gfCShadow(P / 2, P / 2, P * 0.42) + gfC(P / 2, P / 2, P * 0.42, "#a8a29a") + gfC(P / 2, P / 2, P * 0.08, "#4a4540") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.28}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1.2"/>` },
  { id: "waterwheel", name: "Water wheel", cat: "Mill & bakery", w: 1, h: 3, place: "free", access: "none", draw: P => gfR(P * 0.35, 4, P * 0.3, 3 * P - 8, genfWood[0]) + Array.from({ length: 9 }, (_, i) => gfR(P * 0.08, 6 + i * (3 * P - 16) / 8, P * 0.84, 5, genfWood[2])).join("") + gfR(P * 0.42, P * 1.35, P * 0.16, P * 0.3, "#4a4d52") },
  { id: "kneading", name: "Kneading trough", cat: "Mill & bakery", w: 2, h: 1, place: "free", access: "any", near: "hearth", draw: P => gfShadow(4, P * 0.12, 2 * P - 8, P * 0.76) + gfR(4, P * 0.12, 2 * P - 8, P * 0.76, genfWood[1], ` rx="5"`) + `<rect x="10" y="${P * 0.22}" width="${2 * P - 20}" height="${P * 0.56}" rx="${P * 0.2}" fill="#e8dcc0" stroke="#6a4a2a" stroke-width="1.5"/>` + gfE(P * 0.8, P * 0.5, P * 0.25, P * 0.16, "#f4ecd8") },
  { id: "moulding", name: "Moulding board", cat: "Mill & bakery", w: 2, h: 1, place: "free", access: "any", near: "hearth", draw: P => gfTable(4, P * 0.12, 2 * P - 8, P * 0.76, genfWood[3], 2) + `<rect x="${P * 0.2}" y="${P * 0.2}" width="${P * 1.6}" height="${P * 0.6}" fill="rgba(255,255,255,.35)"/>` + [0.45, 0.9, 1.35].map(x => gfE(x * P, P * 0.48, P * 0.17, P * 0.13, "#e8c98a")).join("") + gfL(P * 1.6, P * 0.3, P * 1.85, P * 0.7, "#9aa0a8", 2) },
  { id: "breadrack", name: "Bread shelves", cat: "Mill & bakery", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.48) + gfR(3, 3, 2 * P - 6, P * 0.48, genfWood[2]) + Array.from({ length: 6 }, (_, i) => gfE(P * (0.28 + i * 0.29), P * 0.27, P * 0.13, P * 0.11, i % 2 ? "#c98f4a" : "#b8762e")).join("") },
  { id: "woodpile", name: "Woodpile", cat: "Mill & bakery", w: 2, h: 1, place: "wall", access: "front", near: "hearth", draw: P => Array.from({ length: 14 }, (_, i) => `<circle cx="${P * (0.18 + (i % 7) * 0.27)}" cy="${P * (i < 7 ? 0.25 : 0.55)}" r="${P * 0.13}" fill="#8a6038" stroke="${GENF_INK}" stroke-width="1.5"/><circle cx="${P * (0.18 + (i % 7) * 0.27)}" cy="${P * (i < 7 ? 0.25 : 0.55)}" r="${P * 0.05}" fill="#c9a06a"/>`).join("") },
  { id: "sedilia", name: "Sedilia", cat: "Hall & church", w: 3, h: 1, place: "wall", access: "front", draw: P => gfShadow(3, 3, 3 * P - 6, P * 0.55) + gfR(3, 3, 3 * P - 6, P * 0.55, "#bdb6a8") + [1, 2].map(i => gfL(i * P, 3, i * P, P * 0.58, "#6a655c", 2.5)).join("") + [0.5, 1.5, 2.5].map(x => `<path d="M${x * P - P * 0.3} ${P * 0.2}Q${x * P} ${P * 0.02} ${x * P + P * 0.3} ${P * 0.2}" fill="none" stroke="#6a655c" stroke-width="1.5"/>`).join("") },
  { id: "piscina", name: "Piscina", cat: "Hall & church", w: 1, h: 1, place: "wall", access: "front", draw: P => gfR(P * 0.18, 3, P * 0.64, P * 0.45, "#bdb6a8") + gfC(P / 2, P * 0.26, P * 0.14, "#8a8377") + gfC(P / 2, P * 0.26, P * 0.04, "#2b2520") },
  { id: "choirstall", name: "Choir stall", cat: "Hall & church", w: 2, h: 1, place: "wall", access: "front", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.62) + gfR(3, 3, 2 * P - 6, P * 0.25, genfWood[0]) + gfR(3, P * 0.28, 2 * P - 6, P * 0.34, genfWood[1]) + gfL(P, 3, P, P * 0.62, GENF_INK, 2) + gfBook(P * 0.35, P * 0.36, P * 0.3, P * 0.2, "#7a2e2e") },
  { id: "almsbox", name: "Alms box", cat: "Hall & church", w: 1, h: 1, place: "free", access: "any", door: "near", draw: P => gfCShadow(P / 2, P / 2, P * 0.2) + gfR(P * 0.3, P * 0.3, P * 0.4, P * 0.4, genfWood[0]) + gfL(P * 0.3, P / 2, P * 0.7, P / 2, "#4a4d52", 3) + gfR(P * 0.43, P * 0.36, P * 0.14, 3, "#1e1a16") },
  { id: "priedieu", name: "Prie-dieu", cat: "Hall & church", w: 1, h: 1, place: "free", access: "front", face: "altar", draw: P => gfR(P * 0.15, P * 0.12, P * 0.7, P * 0.28, genfWood[0]) + gfR(P * 0.2, P * 0.5, P * 0.6, P * 0.28, "#8f2f2f") },
  // Town buildings
  { id: "stall", name: "Produce stall", cat: "Town", w: 2, h: 1, place: "wall", access: "front", group: "stall", draw: P => gfStall(P, [["#c9a35e", "#e0b23c"], ["#b8322d", "#e05a3a"], ["#6b8f4e", "#9ab86a"]], "#8f2f2f") },
  { id: "stall2", name: "Cloth stall", cat: "Town", w: 2, h: 1, place: "wall", access: "front", group: "stall", draw: P => gfStall(P, null, "#2f4f8f", ["#3f6fa0", "#a8322d", "#e0c26a", "#6b8f4e", "#d8cfc0"]) },
  { id: "stall3", name: "Pottery stall", cat: "Town", w: 2, h: 1, place: "wall", access: "front", group: "stall", draw: P => gfStall(P, [["#b8643a", "#5a3020"], ["#a8a29a", "#6a655c"], ["#c98f4a", "#7a4a26"]], "#3f6a2c") },
  { id: "basket", name: "Baskets of goods", cat: "Town", w: 1, h: 1, place: "wall", access: "front", group: "stall", corner: 1, draw: P => [[0.32, 0.34, "#e0b23c"], [0.66, 0.4, "#b8322d"], [0.45, 0.7, "#6b8f4e"]].map(([x, y, c]) => gfCShadow(x * P, y * P, P * 0.17) + gfC(x * P, y * P, P * 0.17, "#a8834a") + `<circle cx="${x * P}" cy="${y * P}" r="${P * 0.11}" fill="${c}"/>`).join("") },
  { id: "scales", name: "Scales & weights", cat: "Town", w: 1, h: 1, place: "wall", access: "front", draw: P => gfTable(5, 5, P - 10, P * 0.6, genfWood[1], 2) + gfL(P * 0.2, P * 0.3, P * 0.8, P * 0.3, "#c9a45e", 2.5) + gfC(P * 0.22, P * 0.36, P * 0.1, "#d8b45a") + gfC(P * 0.78, P * 0.36, P * 0.1, "#d8b45a") + gfC(P / 2, P * 0.3, 3, "#8a6a2a") + [0.35, 0.5, 0.62].map((x, i) => gfR(x * P, P * 0.48, 4 + i, 4 + i, "#6a6560")).join("") },
  { id: "countboard", name: "Counting board", cat: "Town", w: 2, h: 1, place: "free", access: "any", seats: { a: ["chair", "stool"], sides: "back", min: 1 }, draw: P => gfTable(4, P * 0.12, 2 * P - 8, P * 0.76, genfWood[1], 2) + `<rect x="${P * 0.2}" y="${P * 0.2}" width="${P * 1.6}" height="${P * 0.6}" fill="#2f5a3a" stroke="${GENF_INK}" stroke-width="1.5"/>` + [0.4, 0.6, 0.8].map(y => gfL(P * 0.2, y * P, P * 1.8, y * P, "rgba(255,255,255,.35)", 1)).join("") + [[0.4, 0.3], [0.55, 0.3], [0.9, 0.5], [1.3, 0.7], [1.45, 0.7], [1.6, 0.5]].map(([x, y]) => gfC(x * P, y * P, 3, "#e0b23c")).join("") },
  { id: "bale", name: "Wool bale", cat: "Town", w: 1, h: 1, place: "free", access: "any", group: "store", corner: 1, draw: P => gfShadow(P * 0.12, P * 0.14, P * 0.76, P * 0.72, 8) + `<rect x="${P * 0.12}" y="${P * 0.14}" width="${P * 0.76}" height="${P * 0.72}" rx="${P * 0.2}" fill="#e3dccb" stroke="${GENF_INK}" stroke-width="2"/>` + gfL(P * 0.12, P / 2, P * 0.88, P / 2, "#8a6a44", 2) + gfL(P / 2, P * 0.14, P / 2, P * 0.86, "#8a6a44", 2) },
  { id: "horsestall", name: "Horse stall", cat: "Farm", w: 2, h: 2, place: "wall", access: "front", group: "farm", draw: P => gfR(3, 3, 2 * P - 6, P * 0.42, genfWood[1]) + gfR(7, 6, 2 * P - 14, P * 0.26, "#d9c27a") + gfL(4, 2, 4, P * 1.75, genfWood[0], 5) + gfL(2 * P - 4, 2, 2 * P - 4, P * 1.75, genfWood[0], 5) + gfL(4, P * 0.9, 2 * P - 4, P * 0.9, "rgba(94,64,39,.5)", 2) + Array.from({ length: 12 }, (_, i) => gfL(P * (0.3 + (i % 6) * 0.25), P * (1.05 + Math.floor(i / 6) * 0.4), P * (0.42 + (i % 6) * 0.25), P * (1.15 + Math.floor(i / 6) * 0.4), "rgba(170,140,60,.6)", 1.2)).join("") },
  { id: "windlass", name: "Portcullis windlass", cat: "Town", w: 2, h: 1, place: "free", access: "any", draw: P => gfShadow(4, P * 0.2, 2 * P - 8, P * 0.6) + gfR(4, P * 0.28, P * 0.2, P * 0.44, genfWood[0]) + gfR(2 * P - P * 0.2 - 4, P * 0.28, P * 0.2, P * 0.44, genfWood[0]) + gfR(P * 0.24, P * 0.38, 2 * P - P * 0.48 - 8, P * 0.24, genfWood[2]) + Array.from({ length: 8 }, (_, i) => gfL(P * (0.4 + i * 0.16), P * 0.38, P * (0.4 + i * 0.16), P * 0.62, "#4a4d52", 1.5)).join("") + gfL(P * 0.15, P * 0.5, P * 0.02, P * 0.95, "#3a3530", 3) + gfL(2 * P - P * 0.15, P * 0.5, 2 * P - P * 0.02, P * 0.95, "#3a3530", 3) },
  { id: "shackles", name: "Shackles", cat: "Town", w: 1, h: 1, place: "wall", access: "front", draw: P => gfR(P * 0.2, 3, P * 0.6, P * 0.12, "#4a4d52") + [0.32, 0.68].map(x => gfL(x * P, P * 0.12, x * P, P * 0.45, "#6a6d72", 2) + `<circle cx="${x * P}" cy="${P * 0.52}" r="${P * 0.08}" fill="none" stroke="#4a4d52" stroke-width="3"/>`).join("") + gfE(P / 2, P * 0.78, P * 0.28, P * 0.12, "#c9b062") },
  { id: "meathooks", name: "Meat hooks", cat: "Town", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfR(3, 3, 2 * P - 6, P * 0.12, genfWood[0]) + [0.35, 0.8, 1.25, 1.65].map((x, i) => gfL(x * P, P * 0.1, x * P, P * 0.22, "#9aa0a8", 2) + gfE(x * P, P * 0.42, P * 0.14, P * 0.2, i % 2 ? "#b04a3e" : "#c8665a") + `<ellipse cx="${x * P}" cy="${P * 0.42}" rx="${P * 0.06}" ry="${P * 0.12}" fill="#f0d8c8" opacity=".7"/>`).join("") },
  { id: "saltingtrough", name: "Salting trough", cat: "Town", w: 2, h: 1, place: "wall", access: "front", draw: P => gfShadow(4, 5, 2 * P - 8, P * 0.72) + gfR(4, 5, 2 * P - 8, P * 0.72, genfWood[1], ` rx="4"`) + `<rect x="9" y="10" width="${2 * P - 18}" height="${P * 0.62}" rx="3" fill="#efeae0"/>` + [0.5, 1.0, 1.5].map(x => gfE(x * P, P * 0.42, P * 0.16, P * 0.1, "#c8665a")).join("") },
  { id: "gambrel", name: "Slaughter beam", cat: "Town", w: 2, h: 1, place: "wall", access: "front", draw: P => gfR(3, 3, 2 * P - 6, P * 0.14, genfWood[0]) + gfL(P * 0.15, P * 0.1, P * 0.15, P * 0.4, genfWood[0], 4) + gfL(2 * P - P * 0.15, P * 0.1, 2 * P - P * 0.15, P * 0.4, genfWood[0], 4) + gfL(P, P * 0.15, P, P * 0.3, "#3a3530", 2) + gfL(P * 0.7, P * 0.3, P * 1.3, P * 0.3, genfWood[2], 3) + `<ellipse cx="${P}" cy="${P * 0.75}" rx="${P * 0.4}" ry="${P * 0.16}" fill="#7a1f1a" opacity=".55"/>` },
  { id: "jars", name: "Jar shelves", cat: "Town", w: 2, h: 1, place: "wall", access: "front", tall: 1, group: "store", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.45) + gfR(3, 3, 2 * P - 6, P * 0.45, genfWood[0]) + Array.from({ length: 7 }, (_, i) => gfC(P * (0.2 + i * 0.27), P * 0.25, P * 0.1, ["#e8e0cf", "#3f6fa0", "#e8e0cf", "#c9a45e", "#e8e0cf", "#3f6fa0", "#6b8f4e"][i]) + `<circle cx="${P * (0.2 + i * 0.27)}" cy="${P * 0.25}" r="${P * 0.045}" fill="#7a5a3a"/>`).join("") },
  { id: "still", name: "Still (alembic)", cat: "Town", w: 1, h: 1, place: "free", access: "any", near: "hearth", draw: P => gfCShadow(P / 2, P / 2, P * 0.32) + gfR(P * 0.2, P * 0.3, P * 0.6, P * 0.5, "#6a5a4a", ` rx="4"`) + `<circle cx="${P * 0.5}" cy="${P * 0.6}" r="${P * 0.08}" fill="#ff9a3a"/>` + gfC(P * 0.45, P * 0.42, P * 0.2, "#c87a3a") + gfL(P * 0.6, P * 0.32, P * 0.9, P * 0.15, "#c87a3a", 3) + gfC(P * 0.88, P * 0.18, P * 0.08, "#9fc3d6") },
  { id: "mortar", name: "Mortar & pestle", cat: "Town", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.26) + gfC(P / 2, P / 2, P * 0.26, "#a8a29a") + gfC(P / 2, P / 2, P * 0.16, "#6b8f4e") + gfL(P * 0.45, P * 0.5, P * 0.85, P * 0.18, "#8a8377", 5) },
  { id: "herbrack", name: "Drying racks", cat: "Town", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfR(3, 3, 2 * P - 6, P * 0.1, genfWood[0]) + Array.from({ length: 8 }, (_, i) => { const x = P * (0.18 + i * 0.235); return gfL(x, P * 0.1, x, P * 0.22, "#8a6a44", 1) + `<path d="M${x - P * 0.07} ${P * 0.22}L${x} ${P * 0.62}L${x + P * 0.07} ${P * 0.22}Z" fill="${["#6b8f4e", "#8aa05a", "#a0905a", "#5a7a4a"][i % 4]}" stroke="${GENF_INK}" stroke-width="1"/>`; }).join("") },
  { id: "sawhorse", name: "Saw trestles", cat: "Town", w: 3, h: 1, place: "free", access: "any", draw: P => [0.4, 2.6].map(x => gfR(x * P - 4, P * 0.15, 8, P * 0.7, genfWood[0])).join("") + gfShadow(4, P * 0.32, 3 * P - 8, P * 0.36) + gfR(4, P * 0.32, 3 * P - 8, P * 0.36, "#b0844f") + gfL(P * 0.3, P / 2, 3 * P - P * 0.3, P / 2, "rgba(43,37,32,.3)", 1) + gfL(P * 1.7, P * 0.2, P * 1.7, P * 0.8, "#9aa0a8", 2.5) + `<rect x="${P * 1.6}" y="${P * 0.05}" width="${P * 0.2}" height="${P * 0.15}" fill="${genfWood[1]}" stroke="${GENF_INK}" stroke-width="1.5"/>` },
  { id: "planks", name: "Stacked timber", cat: "Town", w: 2, h: 1, place: "wall", access: "front", group: "timber", draw: P => gfShadow(3, 4, 2 * P - 6, P * 0.8) + Array.from({ length: 4 }, (_, i) => gfR(3, 4 + i * P * 0.2, 2 * P - 6, P * 0.18, ["#b0844f", "#9c6d42", "#b88c55", "#a87a48"][i])).join("") + gfL(P * 0.6, 4, P * 0.6, P * 0.84, "rgba(43,37,32,.3)", 1) + gfL(P * 1.4, 4, P * 1.4, P * 0.84, "rgba(43,37,32,.3)", 1) },
  { id: "logs", name: "Logs", cat: "Town", w: 2, h: 1, place: "wall", access: "front", group: "timber", draw: P => gfShadow(3, 4, 2 * P - 6, P * 0.8) + [0.24, 0.52, 0.76].map((y, i) => gfR(3 + (i % 2) * 4, y * P - P * 0.13, 2 * P - 10, P * 0.26, "#7d5533", ` rx="${P * 0.12}"`) + gfC(2 * P - 8 - (i % 2) * 2, y * P, P * 0.12, "#c9a06a")).join("") },
  { id: "potwheel", name: "Potter's wheel", cat: "Town", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.38) + gfC(P / 2, P / 2, P * 0.38, genfWood[1]) + gfC(P / 2, P / 2, P * 0.2, "#a8603a") + gfC(P / 2, P / 2, P * 0.1, "#8a4a2a") },
  { id: "kiln", name: "Kiln", cat: "Town", w: 2, h: 2, place: "corner", access: "front", draw: P => gfCShadow(P, P, P * 0.86) + gfC(P, P, P * 0.86, "#9a6a4a") + gfC(P, P, P * 0.6, "#7a4a32") + `<circle cx="${P}" cy="${P}" r="${P * 0.35}" fill="#3a2418"/>` + gfR(P * 0.75, P * 1.6, P * 0.5, P * 0.3, "#2a1a12") + `<circle cx="${P}" cy="${P * 1.72}" r="${P * 0.1}" fill="#ff8a3a"/>` },
  { id: "pots", name: "Pots", cat: "Town", w: 1, h: 1, place: "free", access: "any", group: "store", corner: 1, draw: P => [[0.3, 0.32, 0.15], [0.68, 0.36, 0.13], [0.48, 0.7, 0.17]].map(([x, y, r]) => gfCShadow(x * P, y * P, r * P) + gfC(x * P, y * P, r * P, "#b8643a") + `<circle cx="${x * P}" cy="${y * P}" r="${r * P * 0.55}" fill="#5a3020"/>`).join("") },
  { id: "candlerack", name: "Candle rack", cat: "Town", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfR(3, 3, 2 * P - 6, P * 0.12, genfWood[0]) + Array.from({ length: 10 }, (_, i) => gfR(P * (0.14 + i * 0.18), P * 0.12, 3, P * (0.35 + (i % 3) * 0.08), "#efe6cf")).join("") },
  { id: "wheel", name: "Cart wheel", cat: "Town", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.4) + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.4}" fill="none" stroke="${genfWood[0]}" stroke-width="5"/>` + Array.from({ length: 6 }, (_, i) => gfL(P / 2, P / 2, P / 2 + Math.cos(i * Math.PI / 3) * P * 0.38, P / 2 + Math.sin(i * Math.PI / 3) * P * 0.38, genfWood[1], 3)).join("") + gfC(P / 2, P / 2, P * 0.09, "#4a4d52") },
  { id: "hides", name: "Hides", cat: "Town", w: 2, h: 1, place: "free", access: "any", group: "store", draw: P => gfShadow(5, 5, 2 * P - 10, P * 0.75, 10) + `<path d="M${P * 0.15} ${P * 0.2}Q${P * 0.5} ${P * 0.05} ${P} ${P * 0.18}Q${P * 1.5} ${P * 0.05} ${P * 1.85} ${P * 0.2}L${P * 1.75} ${P * 0.8}Q${P} ${P * 0.95} ${P * 0.25} ${P * 0.8}Z" fill="#a8774a" stroke="${GENF_INK}" stroke-width="2"/>` + gfL(P * 0.3, P * 0.45, P * 1.7, P * 0.45, "rgba(43,37,32,.3)", 1) },
  { id: "plant", name: "Potted plant", cat: "Outside", w: 1, h: 1, place: "free", access: "any", corner: 1, draw: P => gfCShadow(P / 2, P / 2, P * 0.26) + gfC(P / 2, P / 2, P * 0.26, "#b8643a") + [[0.4, 0.4], [0.6, 0.42], [0.5, 0.58], [0.38, 0.58], [0.62, 0.6], [0.5, 0.36]].map(([x, y]) => `<circle cx="${P * x}" cy="${P * y}" r="${P * 0.12}" fill="#5a8a3a" stroke="#2f4f1f" stroke-width="1"/>`).join("") },
];

// City furniture, after the real things: a church's short pews, pulpit, tomb chests with their effigies, the bishop's throne
// (cathedra), bell ropes in the tower, the stone bench round a chapter house; an infirmary's curtained beds; the gaol's stocks;
// a mint's coining blocks (the pile die set in a log, the trussel struck on it), melting furnace, ingot moulds, the assay
// balance and furnace; the bathhouse's canopied tubs (curtains drawn round them), sweating benches by the heated stones, the
// plunge, the copper boiler, the barber's chair; a warehouse's great weighbeam (the tron); a college library's chained book
// desks (the lectern system); a brazier; pegs for clothes. "rows": set out in rows across the room (pews facing the altar,
// desks either side of an aisle); "line": one after another along the walls (beds in a ward).
const gfPewDraw = n => P => gfShadow(4, P * 0.12, n * P - 8, P * 0.7) + gfR(4, P * 0.1, n * P - 8, P * 0.2, genfWood[0]) + gfR(4, P * 0.3, n * P - 8, P * 0.36, genfWood[1]) + gfR(4, P * 0.72, n * P - 8, P * 0.12, "#7a2e2e") + gfR(2, P * 0.08, 6, P * 0.8, genfWood[0]) + gfR(n * P - 8, P * 0.08, 6, P * 0.8, genfWood[0]);
GEN_FURN.forEach(a => { if (a.id === "pew") a.rows = 1; if (a.id === "choirstall") a.stalls = 1; });
GEN_FURN.push(
  { id: "pew2", name: "Short pew", cat: "Hall & church", w: 2, h: 1, place: "free", access: "side", face: "altar", rows: 1, draw: gfPewDraw(2) },
  { id: "pulpit", name: "Pulpit", cat: "Hall & church", w: 1, h: 1, place: "free", access: "front", draw: P => gfCShadow(P / 2, P * 0.45, P * 0.36) + `<polygon points="${Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${(P / 2 + Math.cos(a) * P * 0.36).toFixed(1)},${(P * 0.45 + Math.sin(a) * P * 0.36).toFixed(1)}`; }).join(" ")}" fill="${genfWood[1]}" stroke="${GENF_INK}" stroke-width="2"/>` + `<polygon points="${Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${(P / 2 + Math.cos(a) * P * 0.25).toFixed(1)},${(P * 0.45 + Math.sin(a) * P * 0.25).toFixed(1)}`; }).join(" ")}" fill="${genfWood[2]}" stroke="rgba(43,37,32,.5)" stroke-width="1"/>` + gfR(P * 0.36, P * 0.78, P * 0.28, P * 0.18, genfWood[0]) + gfBook(P * 0.38, P * 0.24, P * 0.24, P * 0.16, "#7a2e2e") },
  { id: "tomb", name: "Tomb chest with effigy", cat: "Hall & church", w: 2, h: 1, place: "free", access: "any", corner: 1, draw: P => gfShadow(3, 4, 2 * P - 6, P - 8) + gfR(3, 4, 2 * P - 6, P - 8, "#bdb6a8", ` rx="2"`) + gfR(7, 8, 2 * P - 14, P - 16, "#d3ccbe") + gfE(P * 0.3, P / 2, P * 0.13, P * 0.14, "#e8e2d4") + `<path d="M${P * 0.45} ${P * 0.3}H${P * 1.7}L${P * 1.8} ${P / 2}L${P * 1.7} ${P * 0.7}H${P * 0.45}Z" fill="#e3dccb" stroke="rgba(43,37,32,.5)" stroke-width="1.2"/>` + gfL(P * 0.8, P * 0.4, P * 0.95, P / 2, "rgba(43,37,32,.45)", 1.5) + gfL(P * 0.8, P * 0.6, P * 0.95, P / 2, "rgba(43,37,32,.45)", 1.5) + gfC(P * 1.84, P / 2, P * 0.08, "#c9b062") },
  { id: "cathedra", name: "Bishop's throne", cat: "Hall & church", w: 1, h: 1, place: "wall", access: "front", door: "far", draw: P => gfShadow(P * 0.12, 3, P * 0.76, P * 0.8) + gfR(P * 0.12, 3, P * 0.76, P * 0.32, genfWood[0]) + `<path d="M${P * 0.12} ${P * 0.35}L${P / 2} 1L${P * 0.88} ${P * 0.35}" fill="none" stroke="#c9a45e" stroke-width="2.5"/>` + gfR(P * 0.18, P * 0.35, P * 0.64, P * 0.45, "#8f2f2f") + gfR(P * 0.12, P * 0.3, P * 0.1, P * 0.52, genfWood[0]) + gfR(P * 0.78, P * 0.3, P * 0.1, P * 0.52, genfWood[0]) + gfC(P / 2, P * 0.2, 3.5, "#e0b23c") },
  { id: "bellrope", name: "Bell ropes", cat: "Hall & church", w: 1, h: 1, place: "free", access: "any", draw: P => [[0.3, 0.32], [0.7, 0.4], [0.45, 0.72]].map(([x, y]) => gfC(x * P, y * P, P * 0.11, "#b23a3a") + `<circle cx="${x * P}" cy="${y * P}" r="${P * 0.06}" fill="#f1ead8"/>` + gfL(x * P, y * P - P * 0.11, x * P, y * P - P * 0.22, "#c9a86a", 2)).join("") },
  { id: "chapterbench", name: "Stone wall bench", cat: "Hall & church", w: 3, h: 1, place: "wall", access: "front", draw: P => gfShadow(2, 2, 3 * P - 4, P * 0.5) + gfR(2, 2, 3 * P - 4, P * 0.5, "#bdb6a8") + gfL(2, P * 0.36, 3 * P - 2, P * 0.36, "rgba(43,37,32,.35)", 1.2) + [1, 2].map(i => gfL(i * P, 2, i * P, P * 0.52, "rgba(43,37,32,.35)", 1.2)).join("") },
  { id: "sickbed", name: "Infirmary bed", cat: "Beds", w: 1, h: 2, place: "wall", access: "side", line: 1, draw: P => gfShadow(4, 3, P - 8, 2 * P - 7) + gfR(4, 3, P - 8, 2 * P - 7, genfWood[2], ` rx="2"`) + gfR(7, 6, P - 14, P * 0.34, "#f1ead8", ` rx="5"`) + gfR(6, P * 0.5, P - 12, P * 1.4, "#c9c0a8", ` rx="3"`) + gfL(8, P * 0.7, P - 8, P * 0.7, "rgba(255,255,255,.45)", 2) + `<path d="M3 ${P * 0.2}V3H${P - 3}V${P * 0.2}" fill="none" stroke="#8a3a3a" stroke-width="2.5"/>` },
  { id: "stocks", name: "Stocks", cat: "Town", w: 2, h: 1, place: "free", access: "front", draw: P => gfShadow(4, P * 0.3, 2 * P - 8, P * 0.36) + gfR(4, P * 0.3, 2 * P - 8, P * 0.36, genfWood[1]) + gfL(4, P * 0.48, 2 * P - 4, P * 0.48, GENF_INK, 1.5) + [0.4, 0.8, 1.2, 1.6].map(x => gfC(x * P, P * 0.48, P * 0.08, "#2b2520")).join("") + gfR(P * 0.15, P * 0.22, 6, P * 0.52, genfWood[0]) + gfR(2 * P - P * 0.15 - 6, P * 0.22, 6, P * 0.52, genfWood[0]) },
  { id: "bucket", name: "Slop bucket", cat: "Town", w: 1, h: 1, place: "free", access: "any", corner: 1, draw: P => gfCShadow(P / 2, P / 2, P * 0.2) + gfC(P / 2, P / 2, P * 0.2, genfWood[1]) + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.14}" fill="#5a4a30"/>` + `<path d="M${P * 0.3} ${P / 2}Q${P / 2} ${P * 0.15} ${P * 0.7} ${P / 2}" fill="none" stroke="#4a4d52" stroke-width="1.5"/>` },
  { id: "keyrack", name: "Key board", cat: "Town", w: 1, h: 1, place: "wall", access: "front", draw: P => gfR(P * 0.15, 3, P * 0.7, P * 0.2, genfWood[1]) + [0.28, 0.5, 0.72].map(x => gfC(x * P, P * 0.36, P * 0.07, "none") + gfL(x * P, P * 0.43, x * P, P * 0.58, "#4a4d52", 2.5)).join("").replace(/fill="none"/g, 'fill="#4a4d52"') },
  { id: "weighbeam", name: "Weighbeam (tron)", cat: "Town", w: 2, h: 1, place: "free", access: "any", draw: P => gfShadow(P * 0.9, P * 0.35, P * 0.2, P * 0.3) + gfR(P * 0.9, P * 0.35, P * 0.2, P * 0.3, genfWood[0]) + gfL(P * 0.15, P / 2, P * 1.85, P / 2, "#6a6560", 4) + gfC(P * 0.22, P / 2, P * 0.18, "#8a7a5a") + gfC(P * 1.78, P / 2, P * 0.18, "#8a7a5a") + gfR(P * 1.65, P * 0.38, P * 0.26, P * 0.24, "#6a6560") + gfSack(P * 0.22, P / 2, P * 0.12) },
  { id: "pile", name: "Coining block (pile and trussel)", cat: "Town", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.34) + gfC(P / 2, P / 2, P * 0.34, "#8a6a44") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.26}" fill="none" stroke="rgba(43,37,32,.35)" stroke-width="1"/>` + gfC(P / 2, P / 2, P * 0.1, "#9a9a9e") + gfC(P / 2, P / 2, P * 0.05, "#d8b45a") + gfR(P * 0.62, P * 0.62, P * 0.3, P * 0.08, genfWood[0]) + gfR(P * 0.78, P * 0.56, P * 0.12, P * 0.2, "#4a4d52") },
  { id: "meltfurnace", name: "Melting furnace", cat: "Town", w: 2, h: 2, place: "corner", access: "front", tall: 1, draw: P => gfShadow(4, 4, 2 * P - 8, 2 * P - 8, 6) + gfR(4, 4, 2 * P - 8, 2 * P - 8, "#8a5a44", ` rx="6"`) + [0.5, 1, 1.5].map(y => gfL(4, y * P, 2 * P - 4, y * P, "rgba(43,37,32,.35)", 1.2)).join("") + gfC(P, P, P * 0.5, "#3a2a20") + `<circle cx="${P}" cy="${P}" r="${P * 0.42}" fill="#e8742c" opacity=".85"/>` + gfC(P, P, P * 0.24, "#6a6560") + `<circle cx="${P}" cy="${P}" r="${P * 0.15}" fill="#f5d36a"/>` + gfR(P * 0.75, 2 * P - 14, P * 0.5, 10, "#2b2520") },
  { id: "ingotmould", name: "Ingot moulds", cat: "Town", w: 2, h: 1, place: "free", access: "any", group: "store", draw: P => gfShadow(5, P * 0.2, 2 * P - 10, P * 0.6) + gfR(5, P * 0.2, 2 * P - 10, P * 0.6, "#4a4d52") + [0.3, 0.7, 1.1, 1.5].map((x, i) => gfR(x * P, P * 0.3, P * 0.26, P * 0.4, i === 2 ? "#d8d8dc" : "#2b2a2a")).join("") },
  { id: "blankbin", name: "Tub of blanks", cat: "Town", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.32) + gfC(P / 2, P / 2, P * 0.32, genfWood[1]) + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.24}" fill="#5a4a30"/>` + [[0.4, 0.42], [0.55, 0.4], [0.47, 0.55], [0.62, 0.55], [0.38, 0.6], [0.55, 0.66]].map(([x, y]) => gfC(x * P, y * P, P * 0.055, "#d8d8dc")).join("") },
  { id: "assaybalance", name: "Assay balance", cat: "Town", w: 1, h: 1, place: "wall", access: "front", draw: P => gfShadow(4, 4, P - 8, P * 0.62) + gfR(4, 4, P - 8, P * 0.62, genfWood[0]) + gfR(7, 7, P - 14, P * 0.56, "rgba(200,225,235,.55)") + gfL(P * 0.25, P * 0.25, P * 0.75, P * 0.25, "#c9a45e", 2) + gfC(P * 0.27, P * 0.4, P * 0.08, "#d8b45a") + gfC(P * 0.73, P * 0.4, P * 0.08, "#d8b45a") + gfL(P / 2, P * 0.18, P / 2, P * 0.5, "#8a6a2a", 1.5) },
  { id: "assayfurnace", name: "Assay furnace", cat: "Town", w: 1, h: 1, place: "corner", access: "front", draw: P => gfShadow(4, 4, P - 8, P - 8, 4) + gfR(4, 4, P - 8, P - 8, "#8a5a44", ` rx="4"`) + gfR(P * 0.28, P * 0.3, P * 0.44, P * 0.4, "#3a2a20") + `<rect x="${P * 0.32}" y="${P * 0.36}" width="${P * 0.36}" height="${P * 0.28}" fill="#e8742c" opacity=".8"/>` + gfC(P * 0.42, P * 0.5, P * 0.06, "#f5d36a") + gfC(P * 0.58, P * 0.5, P * 0.06, "#f5d36a") },
  { id: "canopytub", name: "Canopied bath tub", cat: "Bath", w: 2, h: 2, place: "free", access: "any", draw: P => gfShadow(6, 6, 2 * P - 12, 2 * P - 12, P * 0.5) + gfR(6, 6, 2 * P - 12, 2 * P - 12, genfWood[2], ` rx="${P * 0.5}"`) + `<rect x="12" y="12" width="${2 * P - 24}" height="${2 * P - 24}" rx="${P * 0.4}" fill="#6f9fb8"/>` + gfL(18, P, 2 * P - 18, P, "rgba(255,255,255,.35)", 2) + `<path d="M4 ${P * 0.7}V4H${2 * P - 4}V${P * 0.7}" fill="none" stroke="#e9dfc6" stroke-width="5" stroke-dasharray="7 3"/>` + gfR(P * 0.75, P * 0.85, P * 0.5, P * 0.3, genfWood[3]) + gfMug(P * 0.88, P) + gfMug(P * 1.12, P) },
  { id: "sweatbench", name: "Sweating bench", cat: "Bath", w: 3, h: 1, place: "wall", access: "front", draw: P => gfShadow(2, 2, 3 * P - 4, P * 0.7) + gfR(2, 2, 3 * P - 4, P * 0.34, genfWood[1]) + gfR(2, P * 0.38, 3 * P - 4, P * 0.34, genfWood[2]) + gfPlanks(2, 2, 3 * P - 4, P * 0.34, 3, false) + gfPlanks(2, P * 0.38, 3 * P - 4, P * 0.34, 3, false) },
  { id: "heatstones", name: "Heated stones", cat: "Bath", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.38) + gfC(P / 2, P / 2, P * 0.38, "#5a4a40") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.3}" fill="#c8562c" opacity=".55"/>` + [[0.38, 0.4], [0.6, 0.38], [0.5, 0.58], [0.34, 0.62], [0.66, 0.6]].map(([x, y]) => gfC(x * P, y * P, P * 0.1, "#7a7068")).join("") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.48}" fill="rgba(255,240,220,.12)"/>` },
  { id: "plunge", name: "Plunge tub", cat: "Bath", w: 2, h: 2, place: "free", access: "any", draw: P => gfCShadow(P, P, P * 0.86) + gfC(P, P, P * 0.86, genfWood[1]) + `<circle cx="${P}" cy="${P}" r="${P * 0.72}" fill="#5f8fa8"/>` + [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + 0.4; return gfL(P + Math.cos(a) * P * 0.72, P + Math.sin(a) * P * 0.72, P + Math.cos(a) * P * 0.86, P + Math.sin(a) * P * 0.86, "#4a4d52", 3); }).join("") + gfR(P * 0.15, P * 0.92, P * 0.3, P * 0.16, genfWood[3]) },
  { id: "boiler", name: "Copper boiler", cat: "Bath", w: 2, h: 2, place: "corner", access: "front", tall: 1, draw: P => gfShadow(4, 4, 2 * P - 8, 2 * P - 8, 6) + gfR(4, 4, 2 * P - 8, 2 * P - 8, "#8a5a44", ` rx="6"`) + gfC(P, P * 0.9, P * 0.62, "#b8703a") + `<circle cx="${P}" cy="${P * 0.9}" r="${P * 0.48}" fill="#6f9fb8"/>` + gfR(P * 0.7, 2 * P - 16, P * 0.6, 12, "#2b2520") + `<rect x="${P * 0.76}" y="${2 * P - 14}" width="${P * 0.48}" height="8" fill="#e8742c"/>` },
  { id: "barberchair", name: "Barber's chair", cat: "Bath", w: 1, h: 1, place: "free", access: "any", near: "washstand", draw: P => gfSeatChair(P, genfWood[0], "#6f4a2f") + gfC(P * 0.82, P * 0.82, P * 0.13, "#c9d6e8") },
  { id: "pegs", name: "Clothes pegs", cat: "Storage", w: 2, h: 1, place: "wall", access: "front", draw: P => gfR(4, 3, 2 * P - 8, P * 0.12, genfWood[0]) + [["#7a2e2e", 0.35], ["#4f6f8f", 0.9], ["#6b8f4e", 1.5]].map(([c, x]) => `<path d="M${x * P - P * 0.2} ${P * 0.14}H${x * P + P * 0.2}L${x * P + P * 0.26} ${P * 0.58}H${x * P - P * 0.26}Z" fill="${c}" stroke="${GENF_INK}" stroke-width="1.5"/>`).join("") },
  { id: "bookdesk", name: "Chained book desk", cat: "Storage", w: 3, h: 1, place: "free", access: "frontback", rows: 1, draw: P => gfShadow(4, 4, 3 * P - 8, P - 8) + gfR(4, 4, 3 * P - 8, P - 8, genfWood[1]) + gfL(4, P / 2, 3 * P - 4, P / 2, GENF_INK, 2) + [0.4, 1.2, 1.9, 2.5].map((x, i) => gfBook(x * P, P * 0.12, P * 0.34, P * 0.3, ["#7a2e2e", "#3f5f3a", "#5a3f6a", "#7a5a2e"][i]) + gfL(x * P + P * 0.17, P * 0.42, x * P + P * 0.17, P / 2, "#9a9a9e", 1.2)).join("") + [0.7, 1.6, 2.3].map((x, i) => gfBook(x * P, P * 0.58, P * 0.34, P * 0.3, ["#3f5f3a", "#7a2e2e", "#4f6f8f"][i])).join("") },
  { id: "brazier", name: "Brazier", cat: "Hall & church", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.28) + gfC(P / 2, P / 2, P * 0.28, "#3a3530") + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.2}" fill="#e8742c"/>` + `<circle cx="${P / 2}" cy="${P / 2}" r="${P * 0.4}" fill="rgba(255,170,60,.18)"/>` + gfC(P * 0.45, P * 0.46, P * 0.06, "#f5d36a") },
);

// What each room holds: [piece, least, most, chance (of having any at all)], most important first. "a|b" means one of these
// (in a random order: if the first won't fit, the next); "a>b" means a, or b if a won't fit. Rooms not listed borrow from another room of the same kind.
const GEN_FURN_ROOMS = (() => {
  const living = [["trestle|trestle|table2", 1, 1, 1], ["settle", 0, 1, 0.5], ["chest", 1, 2], ["cupboard", 0, 1, 0.6], ["stool", 0, 2], ["shelves", 0, 1, 0.4], ["barrel", 0, 1, 0.3]];
  const bedroom = [["bed|bed|bigbed", 1, 1], ["chest", 0, 1, 0.5], ["washstand", 0, 1, 0.5], ["stool", 0, 1, 0.4], ["press", 0, 1, 0.3], ["cupboard", 0, 1, 0.3]];
  const store = [["shelves", 0, 2], ["crate", 1, 3], ["barrel", 1, 2], ["sacks", 0, 2], ["chest", 0, 1, 0.4]];
  const cellar = [["caskrack", 0, 2], ["barrel", 2, 4], ["crate", 1, 3], ["sacks", 0, 2], ["shelves", 0, 1, 0.4]];
  const study = [["bookshelf", 2, 4], ["desk", 1, 1], ["lectern", 0, 1, 0.5], ["chest", 0, 1, 0.3]];
  const vault = [["chest", 2, 4], ["strongbox", 1, 2], ["coins", 0, 2], ["weaponrack", 0, 1, 0.5]];
  const shrine = [["altar", 1, 1], ["candles", 1, 3], ["statue", 0, 1, 0.6], ["chest", 0, 1, 0.4]];
  const pit = [["bench", 2, 4], ["weaponrack", 1, 1], ["dummy", 1, 2], ["barrel", 0, 1, 0.5]];
  const smuggle = [["crate", 2, 4], ["sacks", 1, 2], ["barrel", 0, 2], ["chest", 0, 1, 0.5]];
  return {
    "Main room": living, "Living room": living, "Upstairs room": living, "Back room": living,
    "Private room": [["table2|smalltable", 1, 1], ["settle", 0, 1, 0.5], ["chest", 0, 1, 0.5], ["cupboard", 0, 1, 0.4]],
    "Kitchen": [["worktable|smalltable", 1, 1], ["shelves", 1, 2], ["oven", 0, 1, 0.5], ["barrel", 1, 2], ["block", 0, 1, 0.7], ["sacks", 0, 2], ["crate", 0, 1, 0.4], ["cupboard", 0, 1, 0.4]],
    "Pantry": [["shelves", 1, 2], ["barrel", 1, 2], ["sacks", 1, 2], ["crate", 0, 2], ["cupboard", 0, 1, 0.5]],
    "Storage": store, "Storeroom": store, "Stock room": store,
    "Bar store": [["caskrack", 1, 2], ["barrel", 2, 4], ["crate", 0, 2], ["shelves", 0, 1]],
    "Cloth store": [["clothbolts", 2, 3], ["shelves", 1, 2], ["chest", 0, 1]],
    "Coal store": [["coalbin", 1, 3], ["sacks", 0, 2], ["crate", 0, 1]],
    "Iron store": [["ironstock", 1, 2], ["crate", 1, 2], ["barrel", 0, 1]],
    "Archive": [["bookshelf", 2, 4], ["chest", 1, 2], ["desk", 0, 1, 0.5]],
    "Vestry": [["press", 1, 1], ["chest", 1, 2], ["shelves", 0, 1], ["washstand", 0, 1, 0.5]],
    "Bedroom": bedroom, "Keeper's room": bedroom, "Smith's room": bedroom,
    "Owner's room": bedroom.concat([["desk", 0, 1, 0.4]]),
    "Guest room": [["bed", 1, 2], ["chest", 0, 1, 0.5], ["washstand", 0, 1, 0.4], ["stool", 0, 1, 0.4]],
    "Bridal suite": [["bigbed|bed", 1, 1], ["washstand", 1, 1], ["chest", 1, 1], ["carvedchair", 0, 1, 0.6], ["press", 0, 1, 0.5]],
    "Nursery": [["cradle", 1, 2], ["pallet", 0, 1, 0.6], ["chest", 1, 1], ["stool", 0, 1]],
    "Priest's room": [["bed", 1, 1], ["desk", 0, 1, 0.6], ["chest", 1, 1], ["bookshelf", 0, 1, 0.5]],
    "Priest's quarters": [["bed", 1, 1], ["desk", 0, 1, 0.6], ["chest", 1, 1], ["bookshelf", 0, 1, 0.5]],
    "Shop floor": [["counter>counter2>stallboard", 1, 1], ["shelves", 2, 3], ["barrel", 1, 2], ["crate", 0, 2], ["sacks", 0, 2], ["display", 0, 1, 0.6]],
    "Shop": [["counter", 1, 1], ["clothbolts", 1, 3], ["dressform", 1, 2], ["shelves", 0, 1, 0.6], ["display", 0, 1, 0.4]],
    "Pawn counter": [["counter", 1, 1], ["shelves", 1, 2], ["strongbox", 1, 1], ["chest", 0, 2]],
    "Workroom": [["cuttingtable", 1, 1], ["loom", 0, 1, 0.5], ["spinning", 0, 1, 0.6], ["dressform", 0, 1, 0.5], ["clothbolts", 1, 2], ["stool", 1, 2], ["shelves", 0, 1, 0.4]],
    "Workshop": [["workbench", 1, 2], ["toolrack", 0, 1, 0.7], ["stool", 0, 1], ["crate", 0, 2], ["barrel", 0, 1, 0.4]],
    "Disguise room": [["dressform", 1, 2], ["press", 1, 1], ["washstand", 0, 1, 0.5], ["stool", 1, 1], ["chest", 0, 1]],
    "Fitting room": [["dressform", 1, 2], ["press", 0, 1], ["stool", 1, 1], ["washstand", 0, 1, 0.4]],
    "Forge": [["anvil", 1, 1], ["quench", 1, 1], ["bellows", 1, 1], ["toolrack", 1, 1], ["coalbin", 1, 1], ["grindstone", 0, 1, 0.7], ["workbench", 0, 1, 0.6], ["ironstock", 0, 1, 0.5], ["barrel", 0, 1, 0.3]],
    "Common room": [["bar", 1, 1], ["trestle|table2", 1, 3], ["roundtable", 1, 4], ["settle", 0, 1, 0.5], ["caskrack", 0, 1, 0.5], ["barrel", 0, 2]],
    "Great hall": [["questboard", 1, 1], ["longtable|trestle", 1, 1], ["carvedchair", 0, 1, 0.5], ["bench", 0, 2], ["lectern", 0, 1, 0.3], ["chest", 0, 1, 0.4], ["weaponrack", 0, 1, 0.3]],
    "Trophy hall": [["statue", 1, 3], ["weaponrack", 1, 2], ["longtable", 0, 1, 0.5], ["chest", 0, 1]],
    "Office": [["desk", 1, 1], ["chest", 1, 1], ["bookshelf", 0, 1, 0.5], ["shelves", 0, 1, 0.4], ["strongbox", 0, 1, 0.3]],
    "Reception": [["reception>desk", 1, 1], ["bench", 0, 2], ["chest", 0, 1, 0.5], ["shelves", 0, 1, 0.4]],
    "Guildmaster's study": [["desk", 1, 1], ["bookshelf", 1, 2], ["carvedchair", 0, 1], ["chest", 1, 1], ["strongbox", 0, 1, 0.5]],
    "Confessional": [["chair", 1, 1], ["stool", 1, 1], ["candles", 0, 1]],
    "Meeting room": [["longtable|table2", 1, 1], ["trestle|smalltable", 0, 1], ["bookshelf", 0, 1, 0.4], ["chest", 0, 1, 0.6]],
    "Noble's fitting salon": [["dressform", 1, 3], ["press", 1, 1], ["carvedchair", 1, 1], ["washstand", 0, 1], ["clothbolts", 0, 1]],
    "Gambling den": [["roundtable|smalltable", 2, 4], ["table2", 0, 1], ["barrel", 0, 2], ["chest", 0, 1]],
    "Library": study, "Study": study, "Hidden study": study,
    "Map room": [["maptable|table2", 1, 1], ["bookshelf", 1, 2], ["chest", 0, 1]],
    "Nave": [["altar", 1, 1], ["pew", 4, 14], ["candles", 2, 4], ["font", 0, 1, 0.6], ["lectern", 0, 1, 0.6], ["statue", 0, 1, 0.4]],
    "Sanctum": shrine, "Inner sanctum": shrine, "Shrine nook": shrine, "Forbidden shrine": [["altar", 1, 1], ["candles", 2, 4], ["statue", 0, 1], ["bones", 0, 2]],
    "Reliquary": [["altar", 1, 1], ["chest", 1, 3], ["candles", 1, 2]],
    "Bathhouse": [["tub", 1, 3], ["washstand", 0, 1, 0.6], ["bench", 0, 2], ["barrel", 0, 1]],
    "Dye vats": [["dyevat", 2, 4], ["barrel", 0, 2], ["clothbolts", 0, 1]],
    "Quenching pool": [["quench", 2, 3], ["toolrack", 0, 1]],
    "Fighting pit": pit, "Training room": pit,
    "Vault": vault, "Secret vault": vault, "Masterwork vault": vault, "Strongroom": vault, "Black-market cache": vault,
    "Armoury": [["weaponrack", 2, 4], ["chest", 1, 2], ["dummy", 0, 1]],
    "Crypt": [["coffin", 2, 4], ["candles", 1, 2], ["bones", 0, 1]], "Ossuary": [["bones", 3, 6], ["coffin", 0, 2], ["candles", 1, 1]],
    "Cellar": cellar, "Stock cellar": cellar, "Cold store": cellar, "Store": cellar,
    "Wine cellar": [["winerack", 2, 3], ["caskrack", 1, 2], ["barrel", 0, 2]],
    "Beer cellar": [["caskrack", 1, 3], ["barrel", 2, 5]],
    "Smuggler's hole": smuggle, "Smuggler's tunnel": smuggle,
    "Porch": [["bench", 0, 1, 0.7], ["barrel", 0, 1, 0.5], ["plant", 0, 2]],
    "Cellar stairs": [["barrel", 0, 2], ["crate", 0, 1]],
    "Privy": [["privy", 1, 1]],
    // Village buildings. "type:Room" lists are for that building type only (a manor's hall isn't a cottage's).
    "Cottage": [["pallet", 1, 1], ["trestle|smalltable", 1, 1], ["chest", 1, 1], ["cauldron", 0, 1, 0.7], ["quern", 0, 1, 0.6], ["stool", 0, 2], ["cupboard", 0, 1, 0.4], ["barrel", 0, 1, 0.4]],
    "Hall": [["trestle|trestle|table2", 1, 1], ["chest", 1, 1], ["cupboard", 0, 1, 0.6], ["cauldron", 0, 1, 0.6], ["settle", 0, 1, 0.4], ["quern", 0, 1, 0.5], ["stool", 0, 2], ["barrel", 0, 1, 0.3]],
    "manor:Hall": [["hightable", 1, 1], ["trestle", 1, 3], ["buffet", 0, 1, 0.85], ["chest", 0, 1, 0.5], ["bench", 0, 2]],
    "Miller's hall": [["trestle|table2", 1, 1], ["chest", 1, 1], ["cupboard", 0, 1, 0.6], ["cauldron", 0, 1, 0.6], ["stool", 0, 2]],
    "Miller's room": [["bed|pallet", 1, 1], ["trestle|smalltable", 1, 1], ["chest", 1, 1], ["stool", 0, 2]],
    "Chamber": [["bed|bed|pallet", 1, 1], ["chest", 1, 1], ["stool", 0, 1, 0.4], ["cupboard", 0, 1, 0.3], ["pallet", 0, 1, 0.3]],
    "Miller's chamber": [["bed", 1, 1], ["chest", 1, 1], ["washstand", 0, 1, 0.4]],
    "cottage:Inner room": [["oven", 0, 1, 0.6], ["sacks", 1, 2], ["barrel", 0, 2], ["shelves", 0, 1, 0.5]],
    "farmhouse:Inner room": [["bed|pallet", 1, 1], ["chest", 1, 1], ["stool", 0, 1, 0.5]],
    "Service room": [["barrel", 1, 3], ["sacks", 1, 2], ["shelves", 0, 1, 0.5], ["quern", 0, 1, 0.4], ["crate", 0, 1]],
    "Sleeping loft": [["pallet", 1, 3], ["chest", 0, 1, 0.6], ["stool", 0, 1, 0.3]],
    "Buttery": [["caskrack", 1, 2], ["barrel", 1, 3], ["shelves", 0, 1, 0.6]],
    "Dairy": [["churn", 1, 1], ["cheesepress", 0, 1, 0.7], ["shelves", 1, 2], ["worktable|smalltable", 0, 1, 0.6], ["barrel", 0, 1, 0.4]],
    "Byre": [["cowstall", 3, 8], ["sacks", 0, 1, 0.3]],
    "Hayloft": [["haystack", 1, 4], ["sacks", 0, 2]],
    "Corn bay": [["sheaves", 1, 3]], "Hay bay": [["haystack", 1, 3]], "Straw bay": [["strawpile", 1, 3]], "Cattle bay": [["cowstall", 1, 3]],
    "Threshing floor": [["flail", 1, 2], ["winnow", 1, 1], ["sacks", 0, 2], ["cart", 0, 1, 0.3]],
    "Stall": [["manger", 1, 1]],
    "Tack room": [["saddlerack", 1, 2], ["harness", 1, 1], ["chest", 0, 1, 0.6], ["stool", 0, 1, 0.5]],
    "Feed store": [["oatbin", 1, 2], ["sacks", 1, 3], ["barrel", 0, 1]],
    "Groom's room": [["pallet|bed", 1, 1], ["chest", 1, 1], ["stool", 0, 1]], "Groom's loft": [["pallet", 1, 2], ["chest", 0, 1], ["stool", 0, 1]],
    "Feed loft": [["sacks", 2, 4], ["haystack", 0, 2]],
    "Wheel pit": [["waterwheel", 1, 1]],
    "Mill room": [["millstones", 1, 1], ["mealbin", 1, 2], ["sacks", 1, 3], ["sackhoist", 0, 1, 0.6], ["spare", 0, 1, 0.5]],
    "Stone floor": [["millstones", 1, 2], ["sacks", 1, 3], ["sackhoist", 0, 1, 0.7]],
    "Bin loft": [["mealbin", 1, 3], ["sacks", 1, 2]],
    "Grain store": [["sacks", 2, 4], ["oatbin", 0, 1], ["crate", 0, 1]], "Sack store": [["sacks", 2, 5]],
    "Oven room": [["woodpile", 1, 1], ["moulding", 0, 1, 0.6], ["breadrack", 0, 1, 0.6], ["sacks", 0, 1]],
    "Kneading room": [["kneading", 1, 2], ["moulding", 1, 1], ["sacks", 1, 2], ["barrel", 0, 1], ["shelves", 0, 1]],
    "Flour store": [["sacks", 2, 4], ["mealbin", 0, 1], ["barrel", 0, 1]], "Woodstore": [["woodpile", 1, 3]],
    "Bread shop": [["counter>counter2>stallboard", 1, 1], ["breadrack", 1, 2], ["display", 0, 1, 0.5]],
    "Brewhouse": [["cauldron", 1, 2], ["barrel", 2, 4], ["caskrack", 0, 1], ["worktable", 0, 1]],
    "Baker's room": [["bed", 1, 1], ["chest", 1, 1], ["stool", 0, 1], ["washstand", 0, 1, 0.4]],
    "Shrine": [["altar", 1, 1], ["candles", 1, 2], ["priedieu", 0, 1, 0.6]],
    "Hermit's cell": [["pallet", 1, 1], ["stool", 0, 1], ["chest", 0, 1]],
    "chapel:Nave": [["font", 1, 1], ["pew", 0, 6, 0.5], ["almsbox", 0, 1, 0.6], ["lectern", 0, 1, 0.5], ["chest", 0, 1, 0.4]],
    "Chancel": [["altar", 1, 1], ["sedilia", 0, 1, 0.7], ["piscina", 0, 1, 0.7], ["choirstall", 0, 2, 0.5], ["candles", 1, 2], ["chest", 0, 1, 0.3]],
    "Parlour": [["table2|smalltable", 1, 1], ["settle", 0, 1, 0.5], ["chest", 1, 1], ["cupboard", 0, 1, 0.5], ["carvedchair", 0, 1, 0.4]],
    "manor:Chapel": [["altar", 1, 1], ["priedieu", 0, 2], ["candles", 1, 2]],
    "Solar": [["bigbed|bed", 1, 1], ["chest", 1, 2], ["press", 0, 1, 0.6], ["carvedchair", 0, 1, 0.5], ["washstand", 0, 1, 0.5]],
    "Great chamber": [["table2|smalltable", 1, 1], ["settle", 0, 1, 0.6], ["cupboard", 0, 1, 0.6], ["chest", 0, 1]],
    "Garderobe": [["privy", 1, 1]],
    "Steward's room": [["desk", 1, 1], ["chest", 1, 1], ["strongbox", 0, 1, 0.5], ["shelves", 0, 1, 0.5]],
    "Undercroft": [["caskrack", 1, 2], ["barrel", 2, 4], ["crate", 0, 2], ["sacks", 0, 2]],
    "Root cellar": [["sacks", 1, 3], ["barrel", 1, 2], ["crate", 0, 2]],
    // Town buildings. Shops after the inventories: shelves and counters, weights and measures, and the stock.
    "townhouse:Shop": [["counter>counter2>stallboard", 1, 1], ["shelves", 1, 2], ["scales", 0, 1, 0.6], ["display", 0, 1, 0.5], ["barrel", 0, 2], ["crate", 0, 2], ["sacks", 0, 1, 0.5]],
    "townhouse:Hall": [["trestle|table2", 1, 1], ["chest", 1, 1], ["cupboard", 0, 1, 0.7], ["settle", 0, 1, 0.5], ["stool", 0, 2], ["carvedchair", 0, 1, 0.3]],
    "townhouse:Great chamber": [["bigbed|bed", 1, 1], ["chest", 1, 2], ["press", 0, 1, 0.6], ["washstand", 0, 1, 0.5], ["carvedchair", 0, 1, 0.4]],
    "Side passage": [["barrel", 0, 1, 0.4]], "Entry passage": [["chest", 0, 1, 0.3]], "Yard passage": [], "Carriage way": [], "Gate passage": [], "Gallery": [],
    "merchant:Shop": [["counter>counter2>stallboard", 1, 1], ["scales", 1, 1], ["shelves", 1, 2], ["bale", 0, 2], ["chest", 0, 1, 0.6], ["display", 0, 1, 0.4]],
    "Counting house": [["countboard>desk", 1, 1], ["strongbox", 1, 1], ["chest", 1, 2], ["bookshelf", 0, 1, 0.6], ["scales", 0, 1, 0.5]],
    "merchant:Hall": [["hightable", 1, 1], ["trestle", 0, 2], ["buffet", 0, 1, 0.8], ["chest", 0, 1, 0.6], ["bench", 0, 2]],
    "Warehouse": [["bale", 2, 4], ["crate", 1, 3], ["barrel", 1, 3], ["sacks", 0, 2]],
    "Clerk's room": [["desk", 1, 1], ["bed|pallet", 1, 1], ["chest", 1, 1], ["bookshelf", 0, 1, 0.5]],
    "merchant:Undercroft": [["bale", 1, 3], ["caskrack", 1, 2], ["barrel", 1, 4], ["crate", 1, 3], ["sacks", 0, 2]],
    "Tap room": [["bar", 1, 1], ["trestle|table2", 1, 3], ["roundtable", 1, 3], ["settle", 0, 2, 0.6], ["caskrack", 0, 1, 0.6], ["barrel", 0, 2]],
    "inn:Parlour": [["table2|longtable", 1, 1], ["settle", 0, 1, 0.6], ["cupboard", 0, 1, 0.5], ["chest", 0, 1, 0.5], ["carvedchair", 0, 1, 0.4]],
    "inn:Kitchen": [["worktable", 1, 2], ["cauldron", 1, 1], ["shelves", 1, 2], ["oven", 0, 1, 0.7], ["block", 0, 1, 0.7], ["barrel", 1, 2], ["sacks", 0, 2]],
    "Best chamber": [["bigbed>bed", 1, 1], ["chest", 1, 1], ["washstand", 1, 1], ["carvedchair", 0, 1, 0.6], ["smalltable", 0, 1, 0.5]],
    "Guest chamber": [["bed", 1, 3], ["pallet", 0, 1, 0.4], ["chest", 0, 1, 0.6], ["washstand", 0, 1, 0.5], ["stool", 0, 1, 0.5]],
    "Ostler's room": [["bed|pallet", 1, 1], ["chest", 1, 1], ["saddlerack", 0, 1, 0.7], ["harness", 0, 1, 0.6], ["stool", 0, 1]],
    "Stables": [["horsestall", 1, 4], ["oatbin", 0, 1, 0.6], ["saddlerack", 0, 1, 0.5]],
    "Hay store": [["haystack", 1, 3], ["sacks", 0, 2]],
    "Toll booth": [["desk", 1, 1], ["strongbox", 1, 1], ["scales", 0, 1, 0.7], ["chest", 0, 1, 0.6], ["bench", 0, 1, 0.5]],
    "Market arcade": [["stall|stall2|stall3", 2, 4], ["basket", 0, 2], ["crate", 0, 1, 0.5], ["sacks", 0, 1, 0.5]],
    "Court room": [["hightable", 1, 1], ["bench3|bench", 2, 5], ["lectern", 0, 1, 0.5], ["chest", 0, 1, 0.5]],
    "markethall:Court room": [["hightable", 1, 1], ["bench3|bench", 2, 5], ["lectern", 0, 1, 0.5], ["chest", 0, 1, 0.5]],
    "Council chamber": [["longtable|table2", 1, 1], ["carvedchair", 0, 1, 0.6], ["chest", 1, 1], ["bookshelf", 0, 1, 0.5]],
    "Muniment room": [["chest", 2, 3], ["strongbox", 1, 1], ["bookshelf", 0, 1, 0.6]],
    "Guard room": [["table2|smalltable", 1, 1], ["weaponrack", 1, 1], ["bench", 0, 1, 0.6], ["chest", 0, 1, 0.6], ["barrel", 0, 1, 0.4]],
    "Porter's lodge": [["bed", 1, 1], ["smalltable|table2", 1, 1], ["chest", 1, 1], ["stool", 0, 1], ["shelves", 0, 1, 0.4]],
    "Portcullis chamber": [["windlass", 1, 1], ["weaponrack", 0, 1, 0.7], ["barrel", 0, 1, 0.5], ["chest", 0, 1, 0.4]],
    "Guard chamber": [["pallet|bed", 2, 3], ["chest", 1, 2], ["weaponrack", 0, 1, 0.5], ["stool", 0, 1, 0.5]],
    "Captain's room": [["bed", 1, 1], ["desk", 1, 1], ["chest", 1, 1], ["weaponrack", 0, 1, 0.5]],
    "Lock-up": [["shackles", 1, 3], ["pallet", 0, 2], ["bench", 0, 1, 0.4]],
    "Butcher's shop": [["counter>counter2>stallboard", 1, 1], ["meathooks", 1, 2], ["block", 1, 1], ["scales", 0, 1, 0.6], ["barrel", 0, 1, 0.4]],
    "butcher:Cutting room": [["block", 1, 2], ["worktable", 1, 1], ["meathooks", 1, 2], ["barrel", 0, 1, 0.5]],
    "Salting room": [["saltingtrough", 1, 2], ["barrel", 1, 3], ["sacks", 0, 2]],
    "Slaughterhouse": [["gambrel", 1, 1], ["block", 1, 1], ["barrel", 1, 2], ["meathooks", 0, 1, 0.6]],
    "Cold cellar": [["meathooks", 1, 2], ["barrel", 1, 3], ["saltingtrough", 0, 1, 0.5]],
    "Apothecary's shop": [["counter>counter2>stallboard", 1, 1], ["jars", 1, 3], ["scales", 1, 1], ["mortar", 0, 1, 0.6], ["display", 0, 1, 0.4]],
    "Still room": [["still", 1, 2], ["worktable", 1, 1], ["jars", 1, 2], ["mortar", 0, 1, 0.6], ["barrel", 0, 1, 0.4]],
    "apothecary:Store": [["jars", 1, 2], ["sacks", 1, 2], ["crate", 0, 2], ["barrel", 0, 1]],
    "apothecary:Grinding room": [["mortar", 1, 2], ["quern", 0, 1, 0.6], ["worktable", 1, 1], ["sacks", 0, 2]],
    "Drying loft": [["herbrack", 1, 3], ["sacks", 0, 2], ["crate", 0, 1]],
    "Apothecary's chamber": [["bed", 1, 1], ["chest", 1, 1], ["desk", 0, 1, 0.5], ["bookshelf", 0, 1, 0.5]],
    "Cool store": [["jars", 1, 2], ["barrel", 1, 2], ["crate", 0, 2]],
    "carpenter:Workshop": [["workbench", 1, 2], ["toolrack", 1, 1], ["sawhorse", 0, 1, 0.7], ["planks", 0, 1, 0.6], ["stool", 0, 1], ["barrel", 0, 1, 0.3]],
    "carpenter:Hall": [["trestle|table2", 1, 1], ["chest", 1, 1], ["cupboard", 0, 1, 0.5], ["stool", 0, 2]],
    "Timber store": [["planks", 1, 3], ["logs", 1, 2]],
    "Saw shed": [["sawhorse", 1, 1], ["logs", 0, 2], ["planks", 0, 1]],
    "Timber loft": [["planks", 1, 3], ["crate", 0, 1]],
    // The workshop's trades: each its own workroom and store.
    "Cooperage": [["workbench", 1, 1], ["barrel", 2, 4], ["toolrack", 0, 1, 0.6], ["planks", 0, 1, 0.5]],
    "Cobbling room": [["workbench", 1, 2], ["stool", 1, 2], ["shelves", 0, 1, 0.6], ["hides", 0, 1, 0.5]],
    "Loom room": [["loom", 1, 2], ["spinning", 0, 1, 0.7], ["clothbolts", 0, 1, 0.5], ["stool", 0, 1]],
    "Kiln room": [["kiln", 1, 1], ["potwheel", 1, 1], ["pots", 1, 3], ["shelves", 0, 1, 0.5]],
    "Dipping room": [["cauldron", 1, 2], ["candlerack", 1, 2], ["worktable", 0, 1, 0.6], ["barrel", 0, 1]],
    "Goldsmith's workroom": [["workbench", 1, 1], ["anvil", 0, 1, 0.7], ["strongbox", 1, 1], ["scales", 0, 1, 0.6], ["stool", 0, 1]],
    "Glove room": [["cuttingtable", 1, 1], ["hides", 0, 1, 0.7], ["stool", 1, 2], ["shelves", 0, 1, 0.5]],
    "Bow room": [["workbench", 1, 2], ["weaponrack", 0, 1, 0.7], ["planks", 0, 1, 0.5], ["stool", 0, 1]],
    "Wheel shop": [["workbench", 1, 1], ["wheel", 1, 3], ["toolrack", 0, 1, 0.6], ["planks", 0, 1, 0.5]],
    "workshop:Grinding room": [["grindstone", 1, 2], ["workbench", 1, 1], ["toolrack", 0, 1, 0.6], ["quench", 0, 1, 0.5]],
    "Stave store": [["planks", 1, 3], ["barrel", 0, 2]], "Leather store": [["hides", 1, 2], ["shelves", 0, 1]], "Yarn store": [["sacks", 1, 3], ["clothbolts", 0, 2]],
    "Clay store": [["sacks", 1, 3], ["pots", 0, 2], ["barrel", 0, 1]], "Tallow store": [["barrel", 2, 4], ["candlerack", 0, 1]], "Strong room": [["strongbox", 1, 2], ["chest", 1, 2], ["coins", 0, 1, 0.5]],
    "Skin store": [["hides", 1, 2], ["sacks", 0, 1]], "workshop:Store": [["crate", 1, 2], ["shelves", 0, 1], ["barrel", 0, 1]],
    "workshop:Hall": [["trestle|table2", 1, 1], ["chest", 1, 1], ["cupboard", 0, 1, 0.5], ["stool", 0, 2]],
    ...Object.fromEntries([["Cooper", ["barrel", 1, 3]], ["Cobbler", ["shelves", 1, 2]], ["Weaver", ["clothbolts", 1, 3]], ["Potter", ["pots", 1, 3]], ["Chandler", ["candlerack", 1, 2]], ["Goldsmith", ["strongbox", 1, 1]], ["Glover", ["hides", 0, 1]], ["Bowyer", ["weaponrack", 1, 1]], ["Wheelwright", ["wheel", 1, 2]], ["Cutler", ["weaponrack", 0, 1]]]
      .map(([who, ware]) => [`${who}'s shop`, [["counter>counter2>stallboard", 1, 1], ware, ["shelves", 0, 1, 0.6], ["display", 0, 1, 0.5], ["crate", 0, 1, 0.4]]])),
  };
})();
// City buildings' rooms ("city:Room", or "type:Room" where a name means different things), from what such rooms held: a
// cathedral nave with its font by the door, rows of benches facing east and the pulpit; the choir's stalls facing each other
// across it, the lectern, the bishop's throne; the presbytery's high altar with sedilia and piscina; chantry chapels with an
// altar and a founder's tomb; a chapter house ringed by its stone bench; an infirmary's beds in lines along the walls; a
// gaol's pallets, shackles and stocks; a mint's furnaces, coining blocks and balances; a bathhouse's curtained tubs, the
// sweating room's benches round the heated stones; a college library's chained desks in rows.
(() => { const chapel = [["altar", 1, 1], ["pew|pew2", 2, 12], ["candles", 1, 2], ["lectern", 0, 1, 0.5], ["statue", 0, 1, 0.4]];
  const bedroom = [["bed", 1, 1], ["chest", 1, 1], ["stool", 0, 1, 0.5], ["washstand", 0, 1, 0.4], ["cupboard", 0, 1, 0.3]];
  const servant = [["bed|pallet", 1, 1], ["chest", 1, 1], ["stool", 0, 1, 0.4]];
  const best = [["bigbed|bed", 1, 1], ["chest", 1, 2], ["press", 0, 1, 0.6], ["carvedchair", 0, 1, 0.5], ["washstand", 0, 1, 0.5]];
  const office = [["desk", 1, 1], ["chest", 1, 1], ["bookshelf", 0, 1, 0.5], ["strongbox", 0, 1, 0.4]];
  const council = [["longtable|table2", 1, 1], ["carvedchair", 0, 1, 0.7], ["chest", 1, 1], ["bookshelf", 0, 1, 0.4]];
  const feast = [["hightable", 1, 1], ["trestle", 1, 4], ["buffet", 0, 1, 0.7], ["chest", 0, 1, 0.4], ["lectern", 0, 1, 0.3]];
  const parlour = [["table2|smalltable", 1, 1], ["settle", 0, 1, 0.6], ["chest", 1, 1], ["cupboard", 0, 1, 0.5], ["carvedchair", 0, 1, 0.5]];
  const ward = [["sickbed", 3, 18], ["chest", 0, 2], ["brazier", 0, 1, 0.6], ["washstand", 0, 1, 0.6], ["smalltable", 0, 1, 0.4]];
  const store = [["crate", 1, 4], ["sacks", 1, 3], ["barrel", 0, 2], ["shelves", 0, 1, 0.5]];
  const linen = [["press", 1, 2], ["chest", 1, 2], ["shelves", 0, 1, 0.6]];
  const cell = [["pallet", 1, 1], ["bucket", 0, 1, 0.7], ["shackles", 0, 1, 0.5]];
  const cells = [["shackles", 2, 4], ["pallet", 0, 2, 0.6], ["bucket", 0, 1, 0.5], ["bones", 0, 1, 0.3]];
  const gaolward = [["pallet|bed", 2, 6], ["trestle", 0, 1, 0.6], ["chest", 0, 2], ["stool", 0, 2], ["bucket", 0, 1, 0.5]];
  const lodge = [["desk|smalltable", 1, 1], ["keyrack", 1, 1], ["chest", 1, 1], ["stool", 0, 1], ["weaponrack", 0, 1, 0.4]];
  const shop = (...ware) => [["counter>counter2>stallboard", 1, 1], ...ware, ["shelves", 0, 1, 0.6], ["display", 0, 1, 0.4], ["crate", 0, 1, 0.4]];
  const bath = [["canopytub", 1, 6], ["tub", 0, 2, 0.5], ["bench", 0, 2], ["smalltable", 0, 1, 0.4]];
  const sweat = [["heatstones", 1, 1], ["sweatbench", 1, 4], ["barrel", 0, 1, 0.5]];
  const exchange = [["countboard", 1, 4], ["scales", 1, 2], ["strongbox", 1, 1], ["bench", 0, 2, 0.5]];
  const count = [["countboard>desk", 1, 1], ["strongbox", 0, 1, 0.6], ["chest", 1, 1], ["bookshelf", 0, 1, 0.5], ["scales", 0, 1, 0.5]];
  const C = {
    // The cathedral (and every church and chapel in the city)
    "cathedral:Nave": [["font", 0, 1, 0.8], ["pew|pew2", 6, 60], ["pulpit", 0, 1, 0.8], ["almsbox", 0, 1, 0.5], ["candles", 0, 2]],
    "Crossing": [["candles", 0, 2, 0.6]], "Transept": [["tomb", 0, 2, 0.6], ["statue", 0, 1, 0.5], ["candles", 0, 1, 0.5]], "Aisle": [["tomb", 0, 2, 0.4], ["statue", 0, 1, 0.3]],
    "Choir": [["choirstall", 4, 16], ["lectern", 1, 1], ["cathedra", 0, 1, 0.8], ["candles", 0, 2]],
    "Presbytery": [["altar", 1, 1], ["sedilia", 0, 1, 0.8], ["piscina", 0, 1, 0.7], ["candles", 2, 3]],
    "Lady chapel": [["altar", 1, 1], ["candles", 1, 2], ["statue", 0, 1, 0.7], ["pew2", 0, 6]],
    "Chantry chapel": [["altar", 1, 1], ["tomb", 0, 1, 0.7], ["candles", 1, 2], ["priedieu", 0, 2]],
    "Tower base": [["bellrope", 1, 1], ["chest", 0, 1, 0.4]], "Chapter vestibule": [],
    "Chapter house": [["chapterbench", 3, 10], ["lectern", 1, 1], ["carvedchair", 1, 1]],
    "Sacristy": [["press", 1, 1], ["cupboard", 1, 1], ["chest", 1, 2], ["washstand", 0, 1, 0.5]], "cathedral:Treasury": [["strongbox", 1, 2], ["chest", 1, 3], ["press", 0, 1, 0.5]],
    "Chapel": chapel, "Guild chapel": chapel, "Antechapel": [["tomb", 0, 1, 0.5], ["statue", 0, 1, 0.5], ["bench", 0, 2, 0.4]],
    "college:Chapel": [["altar", 1, 1], ["choirstall", 2, 12], ["lectern", 1, 1], ["candles", 1, 2]],
    // The guildhall and livery hall
    "Great hall": feast, "Common hall": feast, "Livery hall": feast, "Feast hall": feast, "Merchants' hall": feast,
    "Council chamber": council, "Aldermen's chamber": council, "Governor's chamber": council, "Court parlour": council, "Jury room": council,
    "Mayor's court": [["hightable", 1, 1], ["bench3|bench", 2, 5], ["lectern", 0, 1, 0.5], ["chest", 0, 1, 0.5]],
    "Court room": [["hightable", 1, 1], ["bench3|bench", 2, 5], ["lectern", 0, 1, 0.5], ["chest", 0, 1, 0.5]],
    "Inner chamber": [["desk", 1, 1], ["press", 0, 1, 0.6], ["chest", 1, 1]], "Robing room": [["press", 1, 2], ["chest", 1, 1], ["pegs", 0, 1, 0.6]], "Recorder's room": office,
    "Exchequer": [["countboard", 1, 1], ["strongbox", 1, 2], ["chest", 1, 1], ["scales", 0, 1, 0.6]], "Chamberlain's office": office, "Clerk's office": office, "Treasury": [["strongbox", 1, 2], ["chest", 1, 2], ["desk", 0, 1, 0.5]],
    "Muniment room": [["chest", 2, 3], ["strongbox", 1, 1], ["bookshelf", 0, 1, 0.6]], "Armoury": [["weaponrack", 2, 4], ["chest", 1, 2], ["dummy", 0, 1, 0.3]],
    "Serjeants' room": [["weaponrack", 0, 1, 0.7], ["bench", 1, 1], ["chest", 1, 1], ["table2|smalltable", 0, 1, 0.5]], "Beadle's room": [["bed|pallet", 0, 1, 0.6], ["desk|smalltable", 1, 1], ["chest", 1, 1]],
    "Entrance hall": [["bench", 0, 2], ["chest", 0, 1, 0.5]], "Mayor's parlour": parlour, "Governor's parlour": parlour, "Parlour": parlour, "Great parlour": [["longtable|table2", 1, 1], ["buffet", 0, 1, 0.6], ["settle", 0, 1, 0.5], ["carvedchair", 0, 1, 0.6]],
    "Plate room": [["buffet|shelves", 1, 2], ["strongbox", 1, 1], ["chest", 1, 2]], "Cage": [["shackles", 1, 2], ["bench", 0, 1, 0.5]], "Lock-up": [["shackles", 1, 3], ["pallet", 0, 2], ["stocks", 0, 1, 0.5]],
    "Weigh room": [["weighbeam", 1, 1], ["scales", 0, 1, 0.6], ["desk", 0, 1, 0.5], ["sacks", 0, 2]], "Toll office": [["desk", 1, 1], ["strongbox", 1, 1], ["scales", 0, 1, 0.6], ["bench", 0, 1, 0.5]],
    "Undercroft": [["bale", 1, 4], ["barrel", 1, 4], ["crate", 1, 3], ["sacks", 0, 2]], "Hospital": ward,
    "Master's chamber": best, "Butler's room": servant, "Cook's room": servant, "Linen room": linen, "Linen store": linen,
    "Scullery": [["cauldron", 1, 1], ["tub", 0, 1, 0.6], ["barrel", 1, 2], ["shelves", 0, 1, 0.5]],
    "Almsfolk's room": [["bed", 1, 1], ["chest", 1, 1], ["stool", 0, 1, 0.6], ["smalltable", 0, 1, 0.4]],
    // The tall house
    "Back shop": [["workbench|worktable", 1, 1], ["shelves", 1, 2], ["crate", 0, 2], ["barrel", 0, 1, 0.5]], "Workshop": [["workbench", 1, 2], ["toolrack", 0, 1, 0.7], ["stool", 0, 1], ["crate", 0, 2]],
    "Mercer's shop": shop(["clothbolts", 1, 2], ["scales", 0, 1, 0.6]), "Draper's shop": shop(["clothbolts", 2, 3], ["cuttingtable", 0, 1, 0.5]), "Haberdasher's shop": shop(["clothbolts", 0, 1], ["display", 0, 1]),
    "Cook-shop": [["counter>counter2>stallboard", 1, 1], ["cauldron", 1, 1], ["worktable", 1, 1], ["breadrack", 0, 1, 0.6], ["barrel", 0, 1, 0.5]], "Spicer's shop": shop(["jars", 1, 2], ["scales", 1, 1], ["sacks", 0, 2]),
    "Cordwainer's shop": shop(["workbench", 0, 1, 0.6], ["hides", 0, 1, 0.5]), "Bookseller's shop": shop(["bookshelf", 1, 2], ["lectern", 0, 1, 0.5]), "Glover's shop": shop(["hides", 0, 1]), "Goldsmith's shop": shop(["strongbox", 1, 1], ["scales", 1, 1]), "Chandler's shop": shop(["candlerack", 1, 2]),
    "Shop": [["counter>counter2>stallboard", 1, 1], ["shelves", 1, 2], ["scales", 0, 1, 0.6], ["display", 0, 1, 0.5], ["barrel", 0, 2], ["crate", 0, 2]],
    "Garret": [["pallet|bed", 1, 2], ["chest", 0, 1, 0.7], ["stool", 0, 1, 0.3]], "Servants' garret": [["pallet", 2, 3], ["chest", 1, 1]], "Apprentices' garret": [["pallet", 2, 3], ["chest", 1, 1]],
    "Loft store": store, "Closet": [["desk", 0, 1, 0.6], ["chest", 1, 1], ["shelves", 0, 1, 0.5]], "Wardrobe": [["press", 1, 2], ["chest", 1, 2], ["pegs", 0, 1, 0.5]],
    "Stair hall": [["chest", 0, 1, 0.5], ["bench", 0, 1, 0.5]], "Counting room": count, "Lodger's room": [["bed|pallet", 1, 2], ["chest", 0, 1, 0.7], ["stool", 0, 1, 0.5], ["smalltable", 0, 1, 0.4]],
    "Coal hole": [["coalbin", 1, 2], ["sacks", 0, 1]], "Hall": [["trestle|table2", 1, 1], ["chest", 1, 1], ["cupboard", 0, 1, 0.7], ["settle", 0, 1, 0.5], ["stool", 0, 2], ["carvedchair", 0, 1, 0.3]],
    "Great chamber": best, "Best chamber": best, "Solar": best, "Chamber": [["bed", 1, 1], ["chest", 1, 1], ["stool", 0, 1, 0.4], ["cupboard", 0, 1, 0.3], ["press", 0, 1, 0.3]],
    // The hospital and almshouse
    "Infirmary hall": ward, "Men's ward": ward, "Women's ward": ward, "Infirmary aisle": ward, "Infirmary": ward,
    "Mortuary": [["coffin", 1, 3], ["candles", 1, 1], ["shelves", 0, 1, 0.4]], "Washhouse": [["cauldron", 1, 1], ["tub", 1, 2], ["barrel", 1, 2], ["pegs", 0, 1, 0.5]],
    "Apothecary": [["jars", 1, 2], ["mortar", 1, 1], ["worktable", 0, 1, 0.6], ["still", 0, 1, 0.5]], "Infirmarer's room": [["desk", 1, 1], ["bed", 0, 1, 0.6], ["jars", 0, 1, 0.6], ["chest", 1, 1]],
    "Larder": [["shelves", 1, 2], ["barrel", 1, 2], ["sacks", 1, 2], ["meathooks", 0, 1, 0.5]],
    "Master's hall": [["trestle|table2", 1, 1], ["carvedchair", 0, 1, 0.6], ["chest", 1, 1], ["cupboard", 0, 1, 0.6], ["settle", 0, 1, 0.5]], "Master's room": parlour,
    "Chaplain's chamber": [["bed", 1, 1], ["desk", 0, 1, 0.6], ["priedieu", 0, 1, 0.6], ["chest", 1, 1]], "Sisters' dormitory": [["bed", 2, 6], ["chest", 1, 3], ["priedieu", 0, 1, 0.5]],
    "Almsman's room": [["bed", 1, 1], ["chest", 1, 1], ["stool", 0, 1, 0.6], ["smalltable", 0, 1, 0.5]], "Almswoman's room": [["bed", 1, 1], ["chest", 1, 1], ["spinning", 0, 1, 0.4], ["stool", 0, 1, 0.6]],
    "Upper room": [["bed", 1, 1], ["chest", 1, 1], ["stool", 0, 1, 0.5]], "almshouse:Common hall": [["trestle", 1, 2], ["settle", 0, 1, 0.6], ["chest", 0, 1, 0.5], ["stool", 0, 2]],
    "Warden's chamber": bedroom, "Warden's room": office,
    // The gaol
    "Cell": cell, "Condemned cell": [["pallet", 1, 1], ["shackles", 1, 1], ["stool", 0, 1, 0.5], ["bucket", 0, 1]], "Dungeon": cells, "Condemned hold": cells, "Press room": [["stocks", 1, 1], ["shackles", 1, 2], ["bucket", 0, 1]],
    "Debtors' ward": gaolward, "Felons' ward": [["pallet", 3, 6], ["shackles", 1, 3], ["bucket", 0, 1]], "gaol:Women's ward": gaolward, "Common ward": gaolward,
    "Felons' day room": [["bench3|bench", 1, 3], ["trestle", 0, 1, 0.6], ["shackles", 0, 2], ["stocks", 0, 1, 0.4]],
    "Work room": [["spinning", 1, 3], ["loom", 0, 1, 0.5], ["workbench", 0, 1, 0.5], ["stool", 1, 3]],
    "Keeper's hall": [["trestle|table2", 1, 1], ["chest", 1, 1], ["cupboard", 0, 1, 0.6], ["settle", 0, 1, 0.5], ["stool", 0, 2]],
    "Keeper's lodge": lodge, "Turnkey's lodge": lodge, "Keeper's chamber": bedroom, "Turnkey's room": servant, "Master's-side room": [["bed", 1, 1], ["chest", 0, 1, 0.6], ["smalltable", 0, 1, 0.6], ["stool", 0, 1, 0.5]],
    // The warehouse and kontor
    "Storage floor": [["crate", 2, 5], ["sacks", 1, 4], ["bale", 0, 4], ["barrel", 0, 3]], "Wool store": [["bale", 3, 8], ["sacks", 0, 2]], "Wine store": [["caskrack", 1, 3], ["barrel", 2, 5]],
    "Salt store": [["sacks", 2, 5], ["barrel", 1, 3]], "Spice store": [["sacks", 1, 3], ["crate", 1, 3], ["jars", 0, 1, 0.6], ["scales", 0, 1, 0.5]], "Grain store": [["sacks", 2, 5], ["oatbin", 0, 1, 0.5]],
    "Cloth store": [["clothbolts", 2, 4], ["bale", 0, 2], ["shelves", 0, 1]], "Timber store": [["planks", 1, 3], ["logs", 1, 2]],
    "Trade hall": [["stall2|stall", 1, 2], ["bale|sacks", 0, 2], ["scales", 0, 1, 0.5]],
    "Hoist loft": [["sackhoist", 1, 1], ["crate", 1, 3], ["sacks", 1, 3]], "Crane loft": [["sackhoist", 1, 1], ["crate", 1, 3], ["bale", 0, 2]], "Drying loft": [["herbrack", 1, 3], ["sacks", 0, 2]],
    "Weigh house": [["weighbeam", 1, 2], ["scales", 1, 1], ["desk", 0, 1, 0.6], ["sacks", 0, 3]],
    "Tally room": count, "Clerks' room": count, "Factor's room": count, "Counting house": count, "Warehouse": [["bale", 2, 4], ["crate", 1, 3], ["barrel", 1, 3], ["sacks", 0, 2]],
    "Merchants' dormitory": [["bed", 2, 6], ["chest", 1, 4], ["washstand", 0, 1, 0.5]], "Clerk's chamber": [["bed", 1, 1], ["desk", 0, 1, 0.6], ["chest", 1, 1]], "Clerks' chamber": [["bed", 1, 3], ["chest", 1, 2], ["desk", 0, 1, 0.5]],
    "Wine vault": [["caskrack", 1, 3], ["winerack", 0, 2], ["barrel", 1, 3]],
    // The mint and exchange
    "Melting house": [["meltfurnace", 1, 2], ["ingotmould", 1, 2], ["coalbin", 1, 1], ["toolrack", 0, 1, 0.6], ["quench", 0, 1, 0.5]],
    "Coining house": [["pile", 2, 5], ["blankbin", 1, 2], ["stool", 1, 3], ["workbench", 0, 1, 0.5], ["coins", 0, 1, 0.5]],
    "Blanching room": [["cauldron", 1, 2], ["assayfurnace", 0, 1, 0.6], ["barrel", 1, 2], ["worktable", 0, 1, 0.5]],
    "Assay office": [["assaybalance", 1, 1], ["assayfurnace", 1, 1], ["worktable", 1, 1], ["jars", 0, 1, 0.5]], "Assay room": [["assaybalance", 1, 1], ["assayfurnace", 0, 1, 0.7], ["worktable", 1, 1]],
    "Engraver's room": [["workbench", 1, 2], ["toolrack", 0, 1, 0.7], ["stool", 1, 1], ["chest", 0, 1, 0.5]],
    "Sorting room": [["countboard", 1, 2], ["scales", 1, 1], ["coins", 0, 2], ["stool", 0, 2]], "Weighing room": [["scales", 1, 2], ["weighbeam", 0, 1, 0.6], ["countboard", 1, 1], ["coins", 0, 1]],
    "Pyx chamber": [["strongbox", 1, 2], ["chest", 1, 1], ["candles", 0, 1, 0.4]], "Treasure vault": [["chest", 2, 4], ["strongbox", 1, 3], ["coins", 1, 3]], "mint:Treasury": [["chest", 2, 4], ["strongbox", 1, 3], ["coins", 1, 3]],
    "Warden's office": office, "Comptroller's office": count, "Exchange hall": exchange, "Changing hall": exchange, "Money-changers' hall": exchange, "Ledger room": [["desk", 1, 1], ["bookshelf", 1, 1], ["chest", 1, 1]],
    "Moneyers' chamber": [["bed|pallet", 1, 3], ["chest", 1, 2], ["stool", 0, 1]], "Changer's chamber": bedroom, "Warden's hall": [["trestle|table2", 1, 1], ["carvedchair", 0, 1, 0.6], ["chest", 1, 1], ["cupboard", 0, 1, 0.5]], "Warden's chamber": bedroom,
    "Fuel store": [["coalbin", 1, 3], ["woodpile", 0, 1, 0.6], ["sacks", 0, 2]],
    // The bathhouse
    "Changing room": [["bench", 1, 3], ["pegs", 1, 2], ["chest", 0, 2], ["press", 0, 1, 0.4]], "Entrance": [["desk|smalltable", 1, 1], ["strongbox", 0, 1, 0.6], ["bench", 0, 1, 0.5]],
    "Bath hall": bath, "Tub room": bath, "Men's bath": bath, "Women's bath": bath, "Bath chamber": [["canopytub|tub", 1, 1], ["stool", 0, 1, 0.6], ["smalltable", 0, 1, 0.5]],
    "Sweating room": sweat, "Hot room": sweat, "Steam room": sweat, "Plunge pool": [["plunge", 1, 1], ["bench", 0, 2]],
    "Furnace room": [["boiler", 1, 1], ["woodpile", 1, 2], ["coalbin", 0, 1, 0.5]], "Wood store": [["woodpile", 1, 3]], "Cistern": [["barrel", 1, 3]],
    "Barber's room": [["barberchair", 1, 2], ["washstand", 1, 1], ["shelves", 0, 1, 0.6], ["chest", 0, 1, 0.5]], "Rest chamber": [["bed", 1, 2], ["washstand", 0, 1, 0.6], ["stool", 0, 1, 0.5]], "Bath-keeper's room": bedroom,
    // The college
    "Chambers": [["bed", 1, 3], ["desk", 1, 2], ["chest", 1, 2], ["bookshelf", 0, 1, 0.5]], "college:Hall": feast,
    "college:Library": [["bookdesk", 2, 12], ["bookshelf", 0, 2, 0.5], ["chest", 0, 1, 0.5]], "Library": [["bookdesk", 1, 8], ["bookshelf", 1, 2], ["lectern", 0, 1, 0.4]], "Study": [["desk", 1, 1], ["bookshelf", 1, 2], ["lectern", 0, 1, 0.5], ["chest", 0, 1, 0.3]], "Master's study": [["desk", 1, 1], ["bookshelf", 1, 2], ["carvedchair", 0, 1, 0.5], ["chest", 0, 1, 0.5]],
    "Gate chamber": office, "Kitchen": [["worktable", 1, 2], ["cauldron", 1, 1], ["shelves", 1, 2], ["oven", 0, 1, 0.6], ["block", 0, 1, 0.7], ["barrel", 1, 2], ["sacks", 0, 2]],
    "Buttery": [["caskrack", 1, 2], ["barrel", 1, 3], ["shelves", 0, 1, 0.6]], "Pantry": [["shelves", 1, 2], ["breadrack", 0, 1, 0.5], ["sacks", 1, 2], ["cupboard", 0, 1, 0.5]],
    "Storage": store, "Store": store, "Guard room": [["table2|smalltable", 1, 1], ["weaponrack", 1, 1], ["bench", 0, 1, 0.6], ["chest", 0, 1, 0.6], ["brazier", 0, 1, 0.4]],
  };
  Object.entries(C).forEach(([k, v]) => { GEN_FURN_ROOMS[k.includes(":") ? k : "city:" + k] = v; }); })();
// A city room with no list of its own furnishes as its kind does.
const GEN_FURN_CITY_KIND = { living: "city:Parlour", bed: "city:Chamber", kitchen: "city:Kitchen", store: "city:Storage", cellar: "Cellar", office: "Office", hall: "city:Feast hall", library: "city:Study",
  temple: "city:Chapel", sanctum: "city:Chantry chapel", ward: "city:Infirmary hall", cell: "city:Cell", work: "city:Workshop", vault: "Vault", bath: "city:Bath hall", furnace: "city:Furnace room",
  forge: "city:Melting house", lab: "city:Assay room", loft: "city:Hoist loft", market: "city:Trade hall", meet: "city:Chapter house", shop: "city:Shop", tower: "city:Tower base" };
// Magical fittings (Dryrones): crystals glow cyan (relay and transponder), violet (stored mana) or gold (wards).
const gfGlow = (x, y, r, c) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" opacity=".22"/>`;
const gfGem = (x, y, s, c) => `<path d="M${x} ${y - s}L${x + s * 0.62} ${y}L${x} ${y + s}L${x - s * 0.62} ${y}Z" fill="${c}" stroke="${GENF_INK}" stroke-width="1.5"/><path d="M${x} ${y - s}L${x + s * 0.22} ${y}L${x} ${y + s}" fill="rgba(255,255,255,.35)"/>`;
const GFC = { cyan: "#7fd8e8", violet: "#a58be0", gold: "#e8c66a", core: "#c0503a" };
const gfCore = (x, y, s, c) => gfC(x, y, s, c || GFC.core) + `<circle cx="${(x - s * 0.3).toFixed(1)}" cy="${(y - s * 0.3).toFixed(1)}" r="${(s * 0.3).toFixed(1)}" fill="rgba(255,255,255,.4)"/>`;
GEN_FURN.push(
  { id: "relaycrystal", name: "Relay crystal", cat: "Magic", w: 2, h: 2, place: "centre", access: "any", draw: P => gfGlow(P, P, P * 0.95, GFC.cyan) + `<polygon points="${Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${(P + Math.cos(a) * P * 0.7).toFixed(1)},${(P + Math.sin(a) * P * 0.7).toFixed(1)}`; }).join(" ")}" fill="#8a8478" stroke="${GENF_INK}" stroke-width="2"/>` + `<circle cx="${P}" cy="${P}" r="${P * 0.55}" fill="none" stroke="${GFC.cyan}" stroke-width="2" stroke-dasharray="4 3"/>` + gfGem(P, P, P * 0.42, GFC.cyan) },
  { id: "receivingtable", name: "Receiving slate", cat: "Magic", w: 2, h: 1, place: "free", access: "any", draw: P => gfTable(4, P * 0.12, 2 * P - 8, P * 0.76, genfWood[0], 2) + gfR(P * 0.3, P * 0.2, P * 1.4, P * 0.6, "#3a3f44") + `<circle cx="${P}" cy="${P / 2}" r="${P * 0.24}" fill="none" stroke="${GFC.cyan}" stroke-width="2"/>` + gfGlow(P, P / 2, P * 0.3, GFC.cyan) + gfR(P * 0.88, P * 0.38, P * 0.24, P * 0.24, "#efe6cf") },
  { id: "sortingrack", name: "Sorting pigeonholes", cat: "Magic", w: 2, h: 1, place: "wall", access: "front", tall: 1, draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.5) + gfR(3, 3, 2 * P - 6, P * 0.5, genfWood[1]) + Array.from({ length: 8 }, (_, i) => gfR(6 + i * (2 * P - 12) / 8, 6, (2 * P - 12) / 8 - 2, P * 0.42, "#3a2e22") + (i % 3 ? gfR(8 + i * (2 * P - 12) / 8, P * 0.16, (2 * P - 12) / 8 - 6, P * 0.2, "#efe6cf") : "")).join("") },
  { id: "registry", name: "Address registry", cat: "Magic", w: 2, h: 1, place: "wall", access: "front", tall: 1, group: "store", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.55) + gfR(3, 3, 2 * P - 6, P * 0.55, genfWood[0]) + [0, 1, 2, 3].map(c => [0, 1].map(rw => gfR(6 + c * (2 * P - 12) / 4, 6 + rw * P * 0.25, (2 * P - 12) / 4 - 3, P * 0.22, genfWood[2]) + gfC(6 + c * (2 * P - 12) / 4 + ((2 * P - 12) / 4 - 3) / 2, 6 + rw * P * 0.25 + P * 0.11, 1.8, "#c9a45e")).join("")).join("") },
  { id: "gaugepanel", name: "Mana gauges", cat: "Magic", w: 2, h: 1, place: "wall", access: "front", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.45) + gfR(3, 3, 2 * P - 6, P * 0.45, "#4a4d52") + [0.4, 1, 1.6].map((x, i) => gfC(x * P, P * 0.25, P * 0.15, "#e9e2cf") + gfL(x * P, P * 0.25, x * P + Math.cos(-0.6 - i * 0.8) * P * 0.12, P * 0.25 + Math.sin(-0.6 - i * 0.8) * P * 0.12, "#a32", 1.6)).join("") + gfGlow(P, P * 0.25, P * 0.5, GFC.violet) },
  { id: "transponderdisplay", name: "Transponder case", cat: "Magic", w: 2, h: 1, place: "free", access: "any", draw: P => gfTable(4, P * 0.15, 2 * P - 8, P * 0.7, genfWood[1], 2) + gfR(P * 0.15, P * 0.24, P * 1.7, P * 0.52, "rgba(200,230,240,.45)") + [0.4, 0.75, 1.1, 1.45].map((x, i) => gfGem(x * P, P / 2, P * 0.14, i % 2 ? GFC.cyan : GFC.violet)).join("") },
  { id: "attunechair", name: "Attunement chair", cat: "Magic", w: 1, h: 1, place: "free", access: "any", draw: P => gfGlow(P / 2, P / 2, P * 0.48, GFC.cyan) + gfSeatChair(P, genfWood[0], "#3f5f7a") + gfGem(P * 0.17, P * 0.2, P * 0.1, GFC.cyan) + gfGem(P * 0.83, P * 0.2, P * 0.1, GFC.cyan) },
  { id: "crystalbench", name: "Crystal workbench", cat: "Magic", w: 2, h: 1, place: "wall", access: "front", front: "stool", draw: P => gfTable(4, 4, 2 * P - 8, P * 0.66, genfWood[2], 2) + gfGem(P * 0.45, P * 0.33, P * 0.13, GFC.cyan) + gfGem(P * 0.8, P * 0.36, P * 0.1, GFC.violet) + gfC(P * 1.3, P * 0.34, P * 0.12, "#d8d8dc") + gfL(P * 1.5, P * 0.18, P * 1.75, P * 0.5, "#4a4d52", 2.5) + gfR(P * 1.1, P * 0.5, P * 0.35, P * 0.08, "#4a4d52") },
  { id: "manacollector", name: "Mana collector", cat: "Magic", w: 2, h: 2, place: "centre", access: "any", draw: P => gfGlow(P, P, P, GFC.violet) + gfC(P, P, P * 0.78, "#5a5560") + [0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3; return gfGem(P + Math.cos(a) * P * 0.55, P + Math.sin(a) * P * 0.55, P * 0.16, GFC.violet); }).join("") + gfGem(P, P, P * 0.32, GFC.violet) + `<circle cx="${P}" cy="${P}" r="${P * 0.78}" fill="none" stroke="${GFC.violet}" stroke-width="1.5" stroke-dasharray="3 4"/>` },
  { id: "storagecore", name: "Storage core", cat: "Magic", w: 1, h: 1, place: "free", access: "any", group: "store", draw: P => gfShadow(P * 0.15, P * 0.15, P * 0.7, P * 0.7, 4) + gfR(P * 0.15, P * 0.15, P * 0.7, P * 0.7, "#4a4d52", ` rx="4"`) + gfGlow(P / 2, P / 2, P * 0.34, GFC.violet) + gfGem(P / 2, P / 2, P * 0.28, GFC.violet) },
  { id: "vent", name: "Venting grate", cat: "Magic", w: 2, h: 2, place: "centre", access: "any", draw: P => gfC(P, P, P * 0.8, "#3a3530") + Array.from({ length: 7 }, (_, i) => gfL(P * 0.35, P * (0.4 + i * 0.2), P * 1.65, P * (0.4 + i * 0.2), "#6a6560", 3)).join("") + `<path d="M${P * 0.6} ${P * 0.6}q${P * 0.4} ${P * 0.3} ${P * 0.8} 0" fill="none" stroke="${GFC.violet}" stroke-width="2" opacity=".7"/><path d="M${P * 0.6} ${P * 1.2}q${P * 0.4} ${P * 0.3} ${P * 0.8} 0" fill="none" stroke="${GFC.violet}" stroke-width="2" opacity=".7"/>` + gfGlow(P, P, P * 0.7, GFC.violet) },
  { id: "regulator", name: "Regulator crystal", cat: "Magic", w: 1, h: 1, place: "wall", access: "front", draw: P => gfR(P * 0.2, 3, P * 0.6, P * 0.5, "#4a4d52") + gfGem(P / 2, P * 0.3, P * 0.16, GFC.violet) + gfL(P * 0.3, P * 0.62, P * 0.7, P * 0.62, GFC.violet, 2) + gfGlow(P / 2, P * 0.3, P * 0.3, GFC.violet) },
  { id: "wardcrystal", name: "Ward crystal", cat: "Magic", w: 2, h: 2, place: "centre", access: "any", draw: P => gfGlow(P, P, P * 0.95, GFC.gold) + `<rect x="${P * 0.35}" y="${P * 0.35}" width="${P * 1.3}" height="${P * 1.3}" fill="#8a8478" stroke="${GENF_INK}" stroke-width="2" transform="rotate(45 ${P} ${P})"/>` + `<circle cx="${P}" cy="${P}" r="${P * 0.62}" fill="none" stroke="${GFC.gold}" stroke-width="2"/>` + gfGem(P, P, P * 0.4, GFC.gold) },
  { id: "corelamp", name: "Core lamp", cat: "Magic", w: 1, h: 1, place: "free", access: "any", corner: 1, draw: P => gfGlow(P / 2, P / 2, P * 0.48, GFC.gold) + gfC(P / 2, P / 2, P * 0.16, "#3a3530") + gfCore(P / 2, P / 2, P * 0.1, GFC.gold) },
  { id: "corerack", name: "Core rack", cat: "Magic", w: 2, h: 1, place: "wall", access: "front", tall: 1, group: "store", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.45) + gfR(3, 3, 2 * P - 6, P * 0.45, genfWood[1]) + [0.3, 0.55, 0.8, 1.05, 1.3, 1.55, 1.75].map((x, i) => gfCore(x * P, P * 0.24, P * 0.08, [GFC.core, GFC.violet, "#6fa05a", GFC.gold][i % 4])).join("") },
  { id: "adaptordisplay", name: "Adaptor display", cat: "Magic", w: 2, h: 1, place: "free", access: "any", draw: P => gfTable(4, P * 0.15, 2 * P - 8, P * 0.7, genfWood[1], 2) + [0.5, 1, 1.5].map(x => `<ellipse cx="${x * P}" cy="${P / 2}" rx="${P * 0.16}" ry="${P * 0.22}" fill="none" stroke="#b89a5a" stroke-width="4"/>` + gfGem(x * P, P * 0.3, P * 0.07, GFC.cyan)).join("") },
  { id: "chargingbench", name: "Charging bench", cat: "Magic", w: 2, h: 1, place: "wall", access: "front", draw: P => gfTable(4, 4, 2 * P - 8, P * 0.62, "#5a5560", 2) + gfGlow(P, P * 0.32, P * 0.6, GFC.violet) + [0.4, 0.8, 1.2, 1.6].map(x => gfC(x * P, P * 0.32, P * 0.13, "#3a3530") + gfCore(x * P, P * 0.32, P * 0.08, GFC.violet)).join("") },
  { id: "perches", name: "Familiar perches", cat: "Magic", w: 2, h: 1, place: "wall", access: "front", draw: P => gfR(3, 3, 2 * P - 6, P * 0.12, genfWood[0]) + gfR(3, P * 0.38, 2 * P - 6, P * 0.12, genfWood[0]) + [[0.4, 0.14, "#8a6a44"], [1.1, 0.14, "#d8cfc0"], [1.6, 0.14, "#5a4a3a"], [0.75, 0.48, "#a8875a"], [1.4, 0.48, "#6f6a62"]].map(([x, y, c]) => gfE(x * P, y * P + P * 0.08, P * 0.11, P * 0.13, c) + gfC(x * P, y * P - P * 0.02, P * 0.07, c)).join("") },
  { id: "perchpole", name: "Perch post", cat: "Magic", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.1) + gfL(P * 0.15, P / 2, P * 0.85, P / 2, genfWood[0], 4) + gfC(P / 2, P / 2, P * 0.08, genfWood[0]) + gfE(P * 0.3, P * 0.45, P * 0.1, P * 0.12, "#8a6a44") + gfC(P * 0.3, P * 0.35, P * 0.06, "#8a6a44") },
  { id: "nestbox", name: "Nest box", cat: "Magic", w: 1, h: 1, place: "wall", access: "front", draw: P => gfShadow(P * 0.15, 3, P * 0.7, P * 0.55) + gfR(P * 0.15, 3, P * 0.7, P * 0.55, genfWood[2]) + gfE(P / 2, P * 0.32, P * 0.24, P * 0.16, "#c9b062") + gfE(P / 2, P * 0.3, P * 0.1, P * 0.08, "#d8cfc0") },
  { id: "parcelscale", name: "Parcel scale", cat: "Magic", w: 1, h: 1, place: "free", access: "any", draw: P => gfCShadow(P / 2, P / 2, P * 0.3) + gfR(P * 0.2, P * 0.2, P * 0.6, P * 0.6, "#6a6560", ` rx="3"`) + gfR(P * 0.28, P * 0.28, P * 0.44, P * 0.3, "#b8925a") + gfL(P * 0.28, P * 0.43, P * 0.72, P * 0.43, "#7a5a33", 1.5) + gfC(P / 2, P * 0.7, P * 0.06, "#e9e2cf") },
  { id: "parcelshelves", name: "Parcel shelves", cat: "Magic", w: 2, h: 1, place: "wall", access: "front", tall: 1, group: "store", draw: P => gfShadow(3, 3, 2 * P - 6, P * 0.5) + gfR(3, 3, 2 * P - 6, P * 0.5, genfWood[2]) + [[0.15, 0.4], [0.62, 0.3], [1.0, 0.36], [1.42, 0.42]].map(([x, w]) => gfR(x * P, P * 0.1, w * P, P * 0.36, "#b8925a") + gfL(x * P, P * 0.28, (x + w) * P, P * 0.28, "#7a5a33", 1.2)).join("") },
);
(() => { const R = {
    // The relay post
    "relaypost:Public counter": [["counter", 1, 1], ["bench", 0, 2], ["corelamp", 0, 1, 0.6], ["parcelscale", 0, 1, 0.5]],
    "relaypost:Receiving room": [["receivingtable", 1, 2], ["sortingrack", 1, 1], ["stool", 0, 2]], "relaypost:Sorting room": [["sortingrack", 1, 3], ["worktable", 0, 1, 0.6], ["parcelshelves", 0, 1, 0.6]],
    "relaypost:Registry": [["registry", 1, 3], ["desk", 0, 1, 0.6]], "relaypost:Registry hall": [["registry", 2, 4], ["desk", 1, 1], ["lectern", 0, 1, 0.4]],
    "relaypost:Operators' room": [["trestle|table2", 1, 1], ["chest", 0, 1], ["corelamp", 0, 1, 0.6]], "relaypost:Operator's chamber": [["bed", 1, 1], ["chest", 1, 1], ["washstand", 0, 1, 0.5]],
    "relaypost:Tower room": [["storagecore", 1, 2], ["chest", 0, 1, 0.6]], "relaypost:Watch room": [["desk", 1, 1], ["gaugepanel", 1, 1], ["pallet", 0, 1, 0.6], ["corelamp", 0, 1]],
    "relaypost:Relay crystal chamber": [["relaycrystal", 1, 1], ["gaugepanel", 0, 1, 0.7], ["stool", 0, 1, 0.5]], "relaypost:Core store": [["storagecore", 2, 4], ["chest", 0, 1]],
    // The bleed tower
    "bleedtower:Control room": [["gaugepanel", 1, 3], ["desk", 1, 1], ["regulator", 0, 1, 0.6], ["corelamp", 0, 1, 0.6]],
    "bleedtower:Core store": [["storagecore", 3, 10]], "bleedtower:Deep core store": [["storagecore", 3, 8]], "bleedtower:Venting room": [["vent", 1, 1], ["regulator", 1, 2]],
    "bleedtower:Collector chamber": [["manacollector", 1, 1], ["regulator", 0, 2]], "bleedtower:Ward-feed room": [["wardcrystal", 1, 1], ["regulator", 1, 2], ["gaugepanel", 0, 1, 0.6]],
    "bleedtower:Keepers' workshop": [["crystalbench", 1, 1], ["toolrack", 0, 1, 0.7], ["storagecore", 0, 2], ["stool", 0, 1]], "bleedtower:Keepers' room": [["bed", 1, 2], ["chest", 1, 2], ["stool", 0, 1]],
    "bleedtower:Linesman's store": [["storagecore", 1, 2], ["toolrack", 0, 1], ["crate", 1, 2]], "bleedtower:Keepers' lodge": [["trestle|table2", 1, 1], ["chest", 1, 1], ["cupboard", 0, 1, 0.5], ["stool", 0, 2]],
    // The Guild branch and its familiar post
    "guildbranch:Guild hall": [["counter", 1, 2], ["questboard", 1, 2], ["bench", 1, 4], ["corelamp", 0, 2, 0.6], ["chest", 0, 1, 0.4]],
    "guildbranch:Records room": [["registry", 1, 2], ["bookshelf", 1, 2], ["desk", 0, 1, 0.6]], "guildbranch:Clerks' office": [["desk", 1, 2], ["chest", 1, 1], ["shelves", 0, 1, 0.5]],
    "guildbranch:Licensing office": [["desk", 1, 1], ["registry", 1, 1], ["bench", 0, 1, 0.5]], "guildbranch:Wardens' office": [["maptable|table2", 1, 1], ["weaponrack", 1, 1], ["gaugepanel", 0, 1, 0.6], ["chest", 0, 1]],
    "guildbranch:Branch master's office": [["desk", 1, 1], ["carvedchair", 0, 1, 0.7], ["bookshelf", 1, 1], ["strongbox", 0, 1, 0.6]], "guildbranch:Masters' meeting room": [["longtable|table2", 1, 1], ["chest", 0, 1, 0.5], ["corelamp", 0, 1, 0.5]],
    "guildbranch:Guild strong room": [["strongbox", 1, 2], ["chest", 1, 2]], "guildbranch:Guild vault": [["strongbox", 1, 2], ["chest", 2, 3], ["coins", 0, 1, 0.5]], "guildbranch:Archive": [["bookshelf", 2, 4], ["registry", 0, 2], ["chest", 0, 1]],
    "guildbranch:Parcel counter": [["counter", 1, 1], ["parcelscale", 1, 1], ["parcelshelves", 0, 1, 0.7]], "guildbranch:Parcel store": [["parcelshelves", 1, 3], ["crate", 0, 2]],
    "guildbranch:Sealed vault": [["strongbox", 1, 2], ["chest", 0, 1]], "guildbranch:Handlers' room": [["perchpole", 1, 2], ["worktable", 0, 1, 0.6], ["sacks", 0, 1], ["chest", 0, 1]],
    "guildbranch:Familiar roost": [["perches", 2, 6], ["perchpole", 0, 3], ["sacks", 0, 1, 0.5]], "guildbranch:Familiar infirmary": [["nestbox", 1, 4], ["worktable", 0, 1, 0.6], ["jars", 0, 1, 0.5]],
    // The shops
    "transponder:Transponder shop": [["counter", 1, 1], ["transponderdisplay", 1, 2], ["shelves", 0, 1, 0.5], ["corelamp", 0, 1, 0.5]], "transponder:Attunement booth": [["attunechair", 1, 1], ["regulator", 0, 1, 0.5]],
    "transponder:Crystal workshop": [["crystalbench", 1, 2], ["toolrack", 0, 1, 0.6], ["chest", 0, 1, 0.5]],
    "coreshop:Core & adaptor shop": [["counter", 1, 1], ["corerack", 1, 2], ["adaptordisplay", 1, 1], ["corelamp", 0, 1, 0.5]], "coreshop:Fitting room": [["chair", 1, 1], ["adaptordisplay", 0, 1, 0.6], ["washstand", 0, 1, 0.3]],
    "coreshop:Charging room": [["chargingbench", 1, 2], ["corerack", 0, 1, 0.6], ["storagecore", 0, 1, 0.5]], "coreshop:Core store": [["storagecore", 1, 3], ["strongbox", 1, 1]], "coreshop:Core cellar": [["storagecore", 1, 4], ["crate", 0, 2]],
  }; Object.assign(GEN_FURN_ROOMS, R); })();
const GEN_FURN_KIND = { living: "Main room", bed: "Bedroom", kitchen: "Kitchen", store: "Storage", cellar: "Cellar", shop: "Shop floor", work: "Workshop", forge: "Forge", tavern: "Common room",
  hall: "Great hall", office: "Office", meet: "Meeting room", library: "Library", temple: "Nave", sanctum: "Sanctum", bath: "Bathhouse", pit: "Fighting pit", vault: "Vault", porch: "Porch", privy: "Privy" };
const GEN_FURN_PLACES = { wall: "Against a wall", corner: "In a corner", free: "Anywhere", centre: "Middle of the room", hearth: "Beside a fireplace", gap: "A square out from a wall" };

// The pieces in use: the built-in ones (less any you've removed, with your changes to which rooms they go in) and your own.
// Kept on the hidden "Generated buildings" campaign as furniture: { hidden: [id], rooms: { id: { room: [min, max, chance] } }, custom: [piece] }.
// (A town keeps the furniture library as it was when the town was made, so its buildings always furnish the same: GEN_FURN_FROZEN.)
let GEN_FURN_FROZEN = null;
const genFurnStore = () => GEN_FURN_FROZEN || ((S.vttCamps && S.vttCamps.get(VGEN)) || {}).furniture || {};
const genFurnImg = a => a.img || genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a.w * GEN_PX} ${a.h * GEN_PX}" width="${a.w * GEN_PX}" height="${a.h * GEN_PX}">${a.draw(GEN_PX)}</svg>`);
const GEN_FURN_IMG = new Map();
function genFurnLib() {
  const st = genFurnStore(), hidden = new Set(st.hidden || []), rooms = st.rooms || {};
  // Each piece's rooms: { room name: [least, most, chance, order] }, from the room lists above.
  const base = new Map(GEN_FURN.map(a => [a.id, {}]));
  Object.entries(GEN_FURN_ROOMS).forEach(([room, list]) => list.forEach(([ids, lo, hi, p], i) => ids.split(/[|>]/).forEach(id => { const m = base.get(id); if (m && !m[room]) m[room] = [lo, hi, p == null ? 1 : p, i, ids]; })));
  const out = GEN_FURN.filter(a => !hidden.has(a.id)).map(a => Object.assign({}, a, { rooms: rooms[a.id] ? Object.fromEntries(Object.entries(rooms[a.id]).map(([k, v]) => [k, [v[0], v[1], v[2] == null ? 1 : v[2], (base.get(a.id)[k] || [])[3] ?? 50, (base.get(a.id)[k] || [])[4] || a.id]])) : base.get(a.id), builtin: true }));
  (st.custom || []).forEach(c => out.push(Object.assign({ cat: "Your own", access: "any", place: "free" }, c, { rooms: Object.fromEntries(Object.entries(c.rooms || {}).map(([k, v]) => [k, [v[0], v[1], v[2] == null ? 1 : v[2], 60 - c.w * c.h, c.id]])) })));
  out.forEach(a => { if (!GEN_FURN_IMG.has(a.id + (a.img || ""))) GEN_FURN_IMG.set(a.id + (a.img || ""), genFurnImg(a)); a.src = GEN_FURN_IMG.get(a.id + (a.img || "")); });
  return out;
}

// ----- The layout solver -----
const GENF_FRONT = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // turn k: which way the front faces (k = quarter turns clockwise)
function genFurnish(o, B) {
  B.levels.forEach(L => { L.furn = []; });
  if (o.furn === false) return;
  // Each room is furnished from its own seed (the building's, the floor, the room, and how many times you've rerolled it), so
  // rerolling one room changes only that room.
  const lib = genFurnLib(), re = o.furnRe || {}, seed = Number(o.seed) || 1;
  const rngFor = (lv, i) => genRng((((seed * 31 + 11) ^ ((lv + 3) * 7919) ^ (i * 104729) ^ ((re[lv + ":" + i] || 0) * 15485863)) >>> 0) || 1);
  B.levels.forEach(L => { const edges = new Set(genEdges(L, B.W, B.H).map(e => e.k));
    L.rooms.forEach((rm, i) => { if (rm.circ && rm.n !== "Cellar stairs") return; genFurnRoom(rngFor(L.level, i), B, L, rm, i, lib, edges); }); });
}
function genFurnRoom(r, B, L, rm, ri, lib, edges) {
  // (Village buildings are only furnished where a room's own name has a list, for now: their furniture comes later.)
  const tk = B.type + ":" + rm.n, has = n => GEN_FURN_ROOMS[n] || lib.some(a => a.rooms && a.rooms[n]);
  if (rm.fl === "-") return; // drawn as an empty room
  const city = B.plan && genType(B.type).group === "city", cf = rm.fl && "city:" + rm.fl, cn = "city:" + rm.n; // a city room: its own type's list, the city's, then its kind's
  const name = rm.fl && has(rm.fl) ? rm.fl : has(tk) ? tk : city && cf && has(cf) ? cf : city && has(cn) ? cn : has(rm.n) ? rm.n : city ? GEN_FURN_CITY_KIND[rm.k] || null : B.plan ? null : GEN_FURN_KIND[rm.k] || rm.n; if (!name) return;
  // This room's list: every piece that goes in it, in order; "a|b" choices kept together.
  const entries = new Map(); lib.forEach(a => { const v = a.rooms && a.rooms[name]; if (!v || !(v[1] > 0)) return; const key = v[4] || a.id; if (!entries.has(key)) entries.set(key, { key, ids: [], lo: v[0], hi: v[1], p: v[2], ord: v[3] }); entries.get(key).ids.push(a.id); });
  const list = [...entries.values()].sort((a, b) => a.ord - b.ord); if (!list.length) return;
  const byId = new Map(lib.map(a => [a.id, a]));
  const inRoom = (x, y) => x >= rm.x && y >= rm.y && x < rm.x + rm.w && y < rm.y + rm.h, K = (x, y) => x + "," + y;
  const solid = new Set(), clear = new Set(), keys = [], access = [], placed = [];
  const sideKey = (x, y, s) => s === "t" ? `h,${x},${y}` : s === "b" ? `h,${x},${y + 1}` : s === "l" ? `v,${x},${y}` : `v,${x + 1},${y}`;
  const outAt = (x, y, s) => { const [dx, dy] = { t: [0, -1], b: [0, 1], l: [-1, 0], r: [1, 0] }[s]; return L.own(x + dx, y + dy) < 0; };
  const wallAt = (x, y, s) => { const k = sideKey(x, y, s); return (edges.has(k) && !L.doors.has(k)) || (rm.arcade && outAt(x, y, s)); }, winAt = (x, y, s) => L.wins.has(sideKey(x, y, s));
  // Squares to keep clear: inside every door, the ends of the stairs, in front of a fire.
  const doorCells = [];
  [...L.doors].forEach(k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); (d === "h" ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]).forEach(([cx, cy]) => { if (inRoom(cx, cy)) { clear.add(K(cx, cy)); keys.push(K(cx, cy)); doorCells.push([cx, cy]); } }); });
  const outDoors = [...L.doors].filter(k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); return (d === "h" ? L.own(x, y - 1) < 0 || L.own(x, y) < 0 : L.own(x - 1, y) < 0 || L.own(x, y) < 0); })
    .map(k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); return (d === "h" ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]).find(([cx, cy]) => inRoom(cx, cy)); }).filter(Boolean); // the ways in from outside
  (L.stairs || []).forEach(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) if (inRoom(x, y)) solid.add(K(x, y));
    genStairEntry(L, t).cells.forEach(c => { const [x, y] = c.split(",").map(Number); if (inRoom(x, y)) { clear.add(c); keys.push(c); } }); });
  const fires = [];
  (L.hearths || []).forEach(h => { if (!inRoom(h.x, h.y)) return; solid.add(K(h.x, h.y));
    if (h.central) { const ring = GENF_FRONT.map(([dx, dy]) => [h.x + dx, h.y + dy]).filter(([x, y]) => inRoom(x, y)); ring.forEach(([x, y]) => clear.add(K(x, y))); if (ring.length) { keys.push(K(ring[0][0], ring[0][1])); fires.push([ring[0][0], ring[0][1], h]); } return; }
    const d = { t: [0, 1], b: [0, -1], l: [1, 0], r: [-1, 0] }[h.side], fx = h.x + d[0], fy = h.y + d[1];
    if (h.fire && inRoom(fx, fy)) { clear.add(K(fx, fy)); keys.push(K(fx, fy)); fires.push([fx, fy, h]); } });
  if (!keys.length) { const c = (() => { for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) if (!solid.has(K(x, y))) return K(x, y); })(); if (!c) return; keys.push(c); }
  const area = rm.w * rm.h;
  // A room open to its neighbours (barn bays, an aisle) is also the way through to them: keep a square free on each open side.
  // (The free square must meet a free square of the neighbour, as furnished so far.)
  const taken = new Set(); (L.furn || []).forEach(f => { for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.h; y++) taken.add(K(x, y)); });
  (L.stairs || []).forEach(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) taken.add(K(x, y)); });
  const throughs = [];
  L.rooms.forEach((ob, j) => { if (j === ri || !genOpen(rm, ob)) return; const side = [];
    for (let x = rm.x; x < rm.x + rm.w; x++) for (let y = rm.y; y < rm.y + rm.h; y++) if (GENF_FRONT.some(([dx, dy]) => L.own(x + dx, y + dy) === j && !taken.has(K(x + dx, y + dy)))) side.push(K(x, y));
    if (side.length) throughs.push(side); });
  // Can you still get everywhere? From the first door: every door, stair end and fire, and somewhere to stand at every piece.
  // (A room the stairs cut in two keeps its two parts, each reached by its own door: each part must stay whole.)
  const flood = from => { const seen = new Set([from]), q = [from]; if (solid.has(from)) return seen;
    while (q.length) { const [x, y] = q.pop().split(",").map(Number); for (const [dx, dy] of GENF_FRONT) { const nx = x + dx, ny = y + dy, k = K(nx, ny); if (!inRoom(nx, ny) || seen.has(k) || solid.has(k)) continue; seen.add(k); q.push(k); } }
    return seen; };
  const parts = []; keys.forEach(k => { if (solid.has(k)) return; const p = parts.find(g => g.seen.has(k)); if (p) p.keys.push(k); else parts.push({ keys: [k], seen: flood(k) }); });
  const reach = () => { const all = new Set();
    for (const g of parts) { const seen = flood(g.keys[0]); if (!g.keys.every(k => seen.has(k) && !solid.has(k))) return false; seen.forEach(k => all.add(k)); }
    return access.every(set => set.some(k => all.has(k))) && throughs.every(set => set.some(k => all.has(k) && !solid.has(k))); };
  const fp = (a, k) => k % 2 ? [a.h, a.w] : [a.w, a.h];
  // The squares round a footprint at (x, y), turned k: behind it, in front, at its two ends; and the wall sides of its back.
  const around = (x, y, W, H, k) => { const row = (y0, x0, n, horiz) => Array.from({ length: n }, (_, i) => horiz ? [x0 + i, y0] : [x0, y0 + i]);
    const top = row(y - 1, x, W, 1), bot = row(y + H, x, W, 1), left = row(y, x - 1, H, 0), right = row(y, x + W, H, 0);
    const back = [top, right, bot, left][k], front = [bot, left, top, right][k], ends = k % 2 ? [top, bot] : [left, right];
    const backSide = ["t", "r", "b", "l"][k], backCells = k === 0 ? row(y, x, W, 1) : k === 1 ? row(y, x + W - 1, H, 0) : k === 2 ? row(y + H - 1, x, W, 1) : row(y, x, H, 0);
    const endSides = k % 2 ? [["t", row(y, x, W, 1)], ["b", row(y + H - 1, x, W, 1)]] : [["l", row(y, x, H, 0)], ["r", row(y, x + W - 1, H, 0)]];
    return { back, front, ends, backSide, backCells, endSides, ring: top.concat(bot, left, right) }; };
  const ok = ([x, y]) => inRoom(x, y) && !solid.has(K(x, y));
  const dist = (x, y, W, H, px, py) => Math.abs(x + W / 2 - (px + 0.5)) + Math.abs(y + H / 2 - (py + 0.5));
  const center = { x: rm.x + rm.w / 2, y: rm.y + rm.h / 2 };
  let faceAltar = null;
  // Every spot a piece could go, best first.
  const spots = (a, fixedK) => { const out = [];
    for (let k = 0; k < 4; k++) { if (fixedK != null && k !== fixedK) continue; if (a.w === a.h && k && a.place !== "wall" && a.place !== "corner" && a.place !== "hearth" && !a.face && a.access !== "front") continue;
      const [W, H] = fp(a, k);
      for (let y = rm.y; y + H <= rm.y + rm.h; y++) for (let x = rm.x; x + W <= rm.x + rm.w; x++) {
        let bad = false; const cells = []; for (let dy = 0; dy < H && !bad; dy++) for (let dx = 0; dx < W; dx++) { const c = K(x + dx, y + dy); if (solid.has(c) || clear.has(c)) { bad = true; break; } cells.push(c); } if (bad) continue;
        const A = around(x, y, W, H, k);
        if (a.place === "wall" || a.place === "corner" || a.place === "hearth") { if (!A.backCells.every(([cx, cy]) => wallAt(cx, cy, A.backSide))) continue; if (a.tall && A.backCells.some(([cx, cy]) => winAt(cx, cy, A.backSide))) continue; }
        if (a.place === "corner" && !A.endSides.some(([s, cs]) => cs.every(([cx, cy]) => wallAt(cx, cy, s)))) continue;
        if (a.place === "centre" && (x === rm.x || y === rm.y || x + W === rm.x + rm.w || y + H === rm.y + rm.h)) continue;
        if (a.place === "hearth" && !fires.some(([fx, fy, h]) => A.ring.some(([cx, cy]) => cx === h.x && cy === h.y))) continue;
        if (a.place === "gap" && !(A.back.every(([cx, cy]) => inRoom(cx, cy) && !solid.has(K(cx, cy)) && wallAt(cx, cy, A.backSide)))) continue;
        // Where you stand to use it.
        const acc = a.access === "front" ? [A.front] : a.access === "side" ? [A.ends.flat()] : a.access === "frontback" ? [A.front, A.back] : a.access === "none" ? [] : [A.ring];
        const accSets = acc.map(s => s.filter(ok).map(c => K(c[0], c[1])));
        if (accSets.some(s => !s.length)) continue;
        // Turned to face something?
        const fv = GENF_FRONT[k], fc = { x: x + W / 2, y: y + H / 2 };
        const facing = (px, py) => fv[0] * (px + 0.5 - fc.x) + fv[1] * (py + 0.5 - fc.y);
        if (a.face === "door" && a.id !== "altar" && doorCells.length && facing(...doorCells.reduce((b, d) => (dist(x, y, W, H, d[0], d[1]) < dist(x, y, W, H, b[0], b[1]) ? d : b))) <= 0) continue;
        if (a.id === "altar" && doorCells.length) { const d = (outDoors.length ? outDoors : doorCells)[0], ex = d[0] + 0.5 - center.x, ey = d[1] + 0.5 - center.y; // facing back down the room to the way in // an altar stands against the far wall, square to the way in
          if (Math.abs(ex) >= Math.abs(ey) ? fv[0] !== Math.sign(ex) : fv[1] !== Math.sign(ey)) { if (rm.w > 2 && rm.h > 2) continue; } }
        const altarMid = a.id === "altar" ? -(fv[0] ? Math.abs(fc.y - center.y) : Math.abs(fc.x - center.x)) * 2.5 : 0; // and in the middle of it
        if (a.face === "altar" && faceAltar != null && k !== faceAltar.k) continue;
        if (a.perpTo) { const tg = placed.find(p => p.a === a.perpTo); if (tg && k % 2 === tg.k % 2) continue; } // down the hall from the high table
        // How good a spot: attractors and a little chance.
        let sc = r() * 1.2 + altarMid;
        const dDoor = doorCells.length ? Math.min(...doorCells.map(d => dist(x, y, W, H, d[0], d[1]))) : 0;
        if (a.door === "near") sc -= dDoor * 0.9; else if (a.door === "far") sc += dDoor * 0.7; else if (a.place !== "free" && a.place !== "centre") sc += Math.min(dDoor, 3) * 0.3;
        if (a.near === "hearth" && fires.length) sc -= Math.min(...fires.map(([fx, fy]) => dist(x, y, W, H, fx, fy))) * 1.3;
        else if (a.near && a.near !== "hearth") { const tg = placed.filter(p => p.a === a.near); if (tg.length) sc -= Math.min(...tg.map(p => dist(x, y, W, H, p.x + p.w / 2 - 0.5, p.y + p.h / 2 - 0.5))) * 1.2; }
        if (a.group) sc += placed.filter(p => p.group === a.group && A.ring.some(([cx, cy]) => cx >= p.x && cx < p.x + p.w && cy >= p.y && cy < p.y + p.h)).length * 2.5;
        if (a.corner && A.endSides.some(([s, cs]) => cs.every(([cx, cy]) => wallAt(cx, cy, s))) && A.backCells.every(([cx, cy]) => wallAt(cx, cy, A.backSide))) sc += 2;
        else if (a.corner && A.backCells.some(([cx, cy]) => wallAt(cx, cy, A.backSide))) sc += 1;
        if (a.seats || a.place === "centre" || a.id === "cuttingtable" || a.id === "worktable" || a.id === "tub") sc -= (Math.abs(fc.x - center.x) + Math.abs(fc.y - center.y)) * 0.5;
        if (a.face === "altar" && faceAltar) { const alt = placed.find(p => p.a === "altar"); if (alt) sc -= dist(x, y, W, H, alt.x + alt.w / 2 - 0.5, alt.y + alt.h / 2 - 0.5) * 0.8; sc += placed.filter(p => p.a === a.id && (p.x === x || p.y === y)).length * 1.5; }
        if (a.tall && A.backCells.some(([cx, cy]) => winAt(cx, cy, A.backSide))) sc -= 3;
        out.push({ x, y, W, H, k, cells, acc: accSets, sc });
      } }
    return out.sort((p, q) => q.sc - p.sc); };
  const put = (a, s) => { s.cells.forEach(c => solid.add(c)); s.acc.forEach(set => access.push(set)); const p = { a: a.id, x: s.x, y: s.y, w: s.W, h: s.H, k: s.k, group: a.group, nAcc: s.acc.length }; placed.push(p); return p; };
  const unput = (s, p) => { s.cells.forEach(c => solid.delete(c)); access.splice(access.length - s.acc.length, s.acc.length); placed.splice(placed.indexOf(p), 1); };
  const tryAt = (a, s) => { const p = put(a, s); if (reach()) return p; unput(s, p); return null; };
  // A single square next to a placed piece, turned to face it (chairs round a table) or the same way (a chest at a bed's foot).
  const besides = (a, x, y, k) => { const [W, H] = fp(a, k); for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) { const c = K(x + dx, y + dy); if (!inRoom(x + dx, y + dy) || solid.has(c) || clear.has(c)) return null; }
    const A = around(x, y, W, H, k), acc = (a.access === "front" ? [A.front] : a.access === "side" ? [A.ends.flat()] : [A.ring]).map(s => s.filter(ok).map(c => K(c[0], c[1])));
    if (acc.some(s => !s.length)) return null; const cells = []; for (let dy = 0; dy < H; dy++) for (let dx = 0; dx < W; dx++) cells.push(K(x + dx, y + dy)); return { x, y, W, H, k, cells, acc, sc: 0 }; };
  const seatRound = (t, a) => { const spec = a.seats, made = [], sides = [];
    const longX = t.w >= t.h; // seats along the long sides (both), or all round
    const N = [...Array(t.w)].map((_, i) => [t.x + i, t.y - 1, 0]), S2 = [...Array(t.w)].map((_, i) => [t.x + i, t.y + t.h, 2]), Wd = [...Array(t.h)].map((_, i) => [t.x - 1, t.y + i, 3]), E = [...Array(t.h)].map((_, i) => [t.x + t.w, t.y + i, 1]);
    if (spec.sides === "long") sides.push(...(longX ? [N, S2] : [Wd, E])); else if (spec.sides === "back") sides.push([N, E, S2, Wd][t.k || 0]); else sides.push(N, S2, Wd, E);
    for (const side of sides) { // benches first along a side, if there's a bench as long as it; else one seat a square
      const k = side[0][2], horiz = k === 0 || k === 2; let i = 0;
      while (i < side.length) { let done = false;
        for (const sid of spec.a) { const s = byId.get(sid); if (!s) continue; const len = Math.max(s.w, s.h); if (len > side.length - i) continue;
          const [sx, sy] = side[i], spot = besides(s, sx, sy, k);
          if (spot && (len === 1 || (horiz ? spot.W === len : spot.H === len))) { if (r() < 0.12 && len === 1 && made.length >= spec.min) { done = true; i++; break; } const p = tryAt(s, spot); if (p) { made.push([s, spot, p]); i += len; done = true; break; } } }
        if (!done) i++; } }
    return made; };
  // Rows across the room: pews in blocks either side of a middle aisle, every row facing the altar (or the high table, or
  // the way into the sanctuary); choir stalls down both sides facing each other across; book desks in rows with room to read.
  const layRows = (pcs, max) => {
    const stalls = pcs.some(a => a.stalls), desks = pcs.some(a => a.access === "frontback");
    const anchor = placed.find(p => p.a === "altar" || p.a === "hightable"); let tx, ty;
    if (anchor) { tx = anchor.x + anchor.w / 2; ty = anchor.y + anchor.h / 2; }
    else { const holy = L.rooms.filter((o, j) => j !== ri && o.k === "sanctum").map(o => ({ o, pri: /Presbytery|Chancel|Sanctuary|Sanctum/.test(o.n) ? 0 : 1, d: Math.abs(o.x + o.w / 2 - center.x) + Math.abs(o.y + o.h / 2 - center.y) })).sort((p, q) => p.pri - q.pri || p.d - q.d);
      if (holy.length && !desks) { tx = holy[0].o.x + holy[0].o.w / 2; ty = holy[0].o.y + holy[0].o.h / 2; }
      else if (doorCells.length && !desks) { tx = 2 * center.x - doorCells[0][0] - 0.5; ty = 2 * center.y - doorCells[0][1] - 0.5; }
      else { tx = rm.w >= rm.h ? rm.x : center.x; ty = rm.w >= rm.h ? center.y : rm.y; } } // desks: rows down the length of the room
    const dx = tx - center.x, dy = ty - center.y, kF = anchor ? (anchor.k + 2) % 4 : GENF_FRONT.map(([fx, fy], i) => [fx * dx + fy * dy, i]).sort((p, q) => q[0] - p[0])[0][1]; // facing the altar square on
    const f = GENF_FRONT[kF], vd = [-f[0], -f[1]], ud = [-f[1], f[0]], A = ud[0] ? rm.w : rm.h, D = vd[0] ? rm.w : rm.h;
    const O = [(ud[0] < 0 || vd[0] < 0) ? rm.x + rm.w - 1 : rm.x, (ud[1] < 0 || vd[1] < 0) ? rm.y + rm.h - 1 : rm.y];
    const at = (u, v) => [O[0] + u * ud[0] + v * vd[0], O[1] + u * ud[1] + v * vd[1]];
    const box = (u0, u1, v0, v1) => { const c = [at(u0, v0), at(u1, v1)]; return [Math.min(c[0][0], c[1][0]), Math.min(c[0][1], c[1][1])]; };
    let made = 0; const put1 = (a, u0, u1, v0, v1, k) => { if (made >= max) return false; const [x, y] = box(u0, u1, v0, v1), sp = besides(a, x, y, k); if (!sp) return false; const p = tryAt(a, sp); if (p) { made++; return true; } return false; };
    // The first row clear of the altar end (and of the altar itself), the last a square short of the far wall.
    let g0 = stalls ? 1 : D >= 10 ? 2 : 1; if (anchor) for (let u = 0; u < A; u++) for (let v = 0; v < D; v++) { const [x, y] = at(u, v); if (x >= anchor.x && x < anchor.x + anchor.w && y >= anchor.y && y < anchor.y + anchor.h) g0 = Math.max(g0, v + 2); }
    const g1 = D >= 14 ? 2 : 1, byLen = pcs.slice().sort((p, q) => q.w - p.w);
    if (stalls) { const a = byLen[0], L2 = a.w; if (A < 3) return;
      const kIn = GENF_FRONT.findIndex(([x, y]) => x === ud[0] && y === ud[1]), kOut = GENF_FRONT.findIndex(([x, y]) => x === -ud[0] && y === -ud[1]);
      for (let v = g0; v + L2 <= D - g1; v += L2) { put1(a, 0, 0, v, v + L2 - 1, kIn); put1(a, A - 1, A - 1, v, v + L2 - 1, kOut); }
      return; }
    // Fill a block of n squares with the longest pieces that go (3s, then 2s), from the aisle outwards.
    const fill = n => { const lens = byLen.map(a => a.w), out = []; let r = n;
      while (r > 0) { if (r === 4 && lens.includes(2)) { out.push(2, 2); break; } const l = lens.find(l => l <= r && !(l === 3 && r === 4 && lens.includes(2))); if (!l) break; out.push(l); r -= l; } return out; };
    const pieceOf = l => byLen.find(a => a.w === l);
    let blocks; // [start, length, from the aisle: +1 outward to higher u, -1 to lower]
    if (A >= 7) { const side = A >= 9 ? 1 : 0, B = Math.floor((A - 2 * side - 1) / 2), ca = A - 2 * side - 2 * B; blocks = [[side + B - 1, B, -1], [side + B + ca, B, 1]]; }
    else if (A >= 3) blocks = [[1, A - 1, 1]]; else return;
    const step = desks ? 2 : 1;
    for (let v = g0; v <= D - 1 - g1; v += step) for (const [s0, B, dir] of blocks) { let u = s0;
      for (const l of fill(B)) { const a = pieceOf(l); const u0 = dir > 0 ? u : u - l + 1, u1 = u0 + l - 1; put1(a, u0, u1, v, v, kF); u += dir * l; } }
  };
  for (const e of list) {
    const rowPcs = e.ids.map(id => byId.get(id)).filter(a => a && (a.rows || a.stalls));
    if (rowPcs.length) { layRows(rowPcs, e.hi); continue; }
    // Bigger rooms get a little more of the small things.
    const small = e.ids.every(id => { const a = byId.get(id); return a && a.w * a.h <= 2 && !a.seats; }), hi = e.hi + (small && e.hi > e.lo ? Math.floor(Math.max(0, area - 20) / 22) : 0);
    let n = e.lo + Math.floor(r() * (hi - e.lo + 1)); if (e.p < 1 && r() > e.p) n = Math.min(n, e.lo);
    for (let c = 0; c < n; c++) {
      if (c >= e.lo && [...solid].length > area * (e.ids.includes("pew") ? 0.75 : 0.48)) break;
      // "a|b": one of these, in a random order; "a>b": a if it fits, else b.
      const ids = String(e.key).includes(">") ? String(e.key).split(">").filter(id => e.ids.includes(id)) : e.ids.slice().sort(() => r() - 0.5); let got = null;
      for (const id of ids) { const a = byId.get(id); if (!a) continue;
        if (a.face === "altar" && !faceAltar) { const alt = placed.find(p => p.a === "altar"); let k = alt ? (alt.k + 2) % 4 : 0;
          if (!alt) { // no altar here: face the door to the chancel (or sanctum), if there is one
            const to = [...L.doors].map(dk => { const [d, x, y] = dk.split(",").map((v, j) => j ? Number(v) : v); const [c1, c2] = d === "h" ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]; const mine = inRoom(...c1) ? c1 : inRoom(...c2) ? c2 : null, other = mine === c1 ? c2 : c1; return mine && L.own(...other) >= 0 && L.rooms[L.own(...other)].k === "sanctum" ? mine : null; }).find(Boolean);
            if (to) { const dx = to[0] + 0.5 - center.x, dy = to[1] + 0.5 - center.y; k = GENF_FRONT.map(([fx, fy], i) => [fx * dx + fy * dy, i]).sort((p, q) => q[0] - p[0])[0][1]; } }
          faceAltar = { k }; }
        const cands = a.line ? spots(a).sort((p, q) => ((q.k % 2 ? rm.h : rm.w) - (p.k % 2 ? rm.h : rm.w)) || p.k - q.k || (p.k % 2 ? p.y - q.y : p.x - q.x)) : spots(a).slice(0, 60); // in a line: along the long walls, side by side
        for (const s of cands) { const p = tryAt(a, s); if (!p) continue;
          if (a.seats) { const seats = seatRound(p, a); if (seats.length < (a.seats.min || 0)) { seats.reverse().forEach(([, sp, pp]) => unput(sp, pp)); unput(s, p); continue; } }
          if (a.foot && r() < 0.6) { const f = byId.get(a.foot), fv = GENF_FRONT[s.k]; if (f) { const fx = s.k === 1 ? s.x - 1 : s.k === 3 ? s.x + s.W : s.x + (s.W > 1 ? Math.floor(r() * s.W) : 0), fy = s.k === 0 ? s.y + s.H : s.k === 2 ? s.y - 1 : s.y + (s.H > 1 ? Math.floor(r() * s.H) : 0); void fv; const sp = besides(f, fx, fy, s.k); if (sp) tryAt(f, sp); } }
          if (a.behind) { const f = byId.get(a.behind); if (f) { const A = around(s.x, s.y, s.W, s.H, s.k), opts = A.back.slice().sort(() => r() - 0.5); for (const [fx, fy] of opts) { const sp = besides(f, fx, fy, s.k); if (sp && tryAt(f, sp)) break; } } }
          if (a.front) { const f = byId.get(a.front); if (f) { const A = around(s.x, s.y, s.W, s.H, s.k), opts = A.front.slice().sort(() => r() - 0.5); for (const [fx, fy] of opts) { const sp = besides(f, fx, fy, (s.k + 2) % 4); if (sp && tryAt(f, sp)) break; } } }
          got = p; break; }
        if (got) break; }
      if (!got) break;
    }
  }
  // Nothing fitted at all (a cramped room the stairs and doors take most of): at least the smallest thing on its list that will.
  if (!placed.length) { const ids = [...new Set(list.flatMap(e => e.ids))].map(id => byId.get(id)).filter(a => a && !a.seats).sort((a, b) => a.w * a.h - b.w * b.h);
    for (const a of ids) { let ok2 = false; for (const s of spots(a).slice(0, 60)) if (tryAt(a, s)) { ok2 = true; break; } if (ok2) break; } }
  placed.forEach(p => L.furn.push({ a: p.a, x: p.x, y: p.y, w: p.w, h: p.h, k: p.k, room: ri }));
}
// The pieces as pictures: where each one's box goes when turned (its own w × h, centred on its footprint), for the map.
function genFurnBoxes(L, lib) { const byId = new Map((lib || genFurnLib()).map(a => [a.id, a]));
  return (L.furn || []).map(f => { const a = byId.get(f.a); if (!a) return null; const cx = f.x + f.w / 2, cy = f.y + f.h / 2; return { a, x: cx - a.w / 2, y: cy - a.h / 2, w: a.w, h: a.h, rot: f.k * 90, src: a.src }; }).filter(Boolean); }

// ----- The Furniture tab: #gen-<camp>/furniture -----
const GENF = { cat: "" };
const gfRoomLabel = n => { const i = n.indexOf(":"); if (i < 0) return n; const t = n.slice(0, i); return `${n.slice(i + 1)} (${t === "city" ? "city" : genType(t).name})`; };
// On a catalogue card only the first few rooms, then "+N more" (which opens the piece, with them all).
const genfRoomsText = (a, max) => { const all = Object.entries(a.rooms || {}).filter(([, v]) => v[1] > 0).sort((x, y) => x[0].localeCompare(y[0])), e = max && all.length > max ? all.slice(0, max) : all;
  const seat = GEN_FURN.some(t => t.seats && t.seats.a.includes(a.id)) ? `<span class="gfroom">Round tables</span>` : "";
  return e.length || seat ? e.map(([k, v]) => `<span class="gfroom">${esc(gfRoomLabel(k))} <b>${v[0] === v[1] ? v[1] : `${v[0]}–${v[1]}`}${v[2] < 1 ? "?" : ""}</b></span>`).join("") + seat + (e.length < all.length ? `<button type="button" class="gfroom gfmore" data-act="gfxedit" data-id="${esc(a.id)}" title="See every room">+${all.length - e.length} more</button>` : "") : `<span class="muted small">Not in any room yet</span>`; };
const genfPreview = a => { const W = a.w + 1, H = a.h + 1;
  return `<div class="gfprev" style="aspect-ratio:${W} / ${H}"><img src="${esc(a.src)}" alt="" style="left:${(0.5 / W * 100).toFixed(2)}%;top:${(0.5 / H * 100).toFixed(2)}%;width:${(a.w / W * 100).toFixed(2)}%;height:${(a.h / H * 100).toFixed(2)}%"></div>`; };
function genFurnView(camp, back) {
  const lib = genFurnLib(), st = genFurnStore(), cats = [...new Set(lib.map(a => a.cat))], shown = lib.filter(a => !GENF.cat || a.cat === GENF.cat), hidden = GEN_FURN.filter(a => (st.hidden || []).includes(a.id));
  return `<section class="page"><a href="#gen-${esc(camp)}" class="vback">← Generator</a>
    <h1>Furniture</h1><p class="muted">The pieces the building generator furnishes rooms with. Each sits on the grid: its back to the top of its picture, its front (where you use it) to the bottom. Change which rooms a piece goes in and how many, remove ones you don't like, or add your own picture.</p>
    <div class="gftools"><button class="btn" data-act="gfxadd">＋ Add your own piece</button>
      <div class="gentags">${["", ...cats].map(c => `<button class="chip${GENF.cat === c ? " on" : ""}" data-act="gfxcat" data-v="${esc(c)}">${c ? esc(c) : "All"}</button>`).join("")}</div></div>
    <div class="gfgrid">${shown.map(a => `<article class="gfcard">${genfPreview(a)}<div class="gfbody"><strong>${esc(a.name)}</strong>
      <span class="muted small">${a.w} × ${a.h} square${a.w * a.h > 1 ? "s" : ""} · ${esc(GEN_FURN_PLACES[a.place] || a.place)}${a.builtin ? "" : " · yours"}</span>
      <div class="gfrooms">${genfRoomsText(a, 6)}</div>
      <div class="acts"><button class="btn ghost small" data-act="gfxedit" data-id="${esc(a.id)}">Edit</button><button class="btn ghost small danger" data-act="gfxdel" data-id="${esc(a.id)}">${a.builtin ? "Remove" : "Delete"}</button></div></div></article>`).join("")}</div>
    ${hidden.length ? `<h2 class="sect">Removed <span>${hidden.length}</span></h2><div class="gfgrid">${hidden.map(a => { const x = Object.assign({}, a, { src: genFurnImg(a) }); return `<article class="gfcard off">${genfPreview(x)}<div class="gfbody"><strong>${esc(a.name)}</strong><div class="acts"><button class="btn ghost small" data-act="gfxrestore" data-id="${esc(a.id)}">Put back</button></div></div></article>`; }).join("")}</div>` : ""}
  </section>`;
}
async function genfSave(fn) {
  const cur = S.vttCamps.get(VGEN), base = cur || { name: "Generated buildings", workshop: true, genlib: true, created: new Date().toISOString() };
  const st = JSON.parse(JSON.stringify(base.furniture || {})); fn(st);
  const was = JSON.stringify((cur || {}).furniture || {}); await vSave("vttcamps/" + VGEN, Object.assign({}, base, { furniture: st }));
  for (let i = 0; i < 30 && JSON.stringify(((S.vttCamps.get(VGEN) || {}).furniture) || {}) === was; i++) await new Promise(res => setTimeout(res, 50));
  GEN_FURN_IMG.clear(); render();
}
const GENF_ROOMNAMES = () => [...new Set(Object.keys(GEN_FURN_ROOMS).concat(GEN_BUILDINGS.flatMap(b => ["ground", "single", "upper", "under", "rare"].flatMap(k => (b[k] || []).map(x => x.n)))))].sort((a, b) => a.localeCompare(b));
function genfEdit(id) {
  const lib = genFurnLib(), a = id ? lib.find(x => x.id === id) : null, own = !a || !a.builtin, rooms = (a && a.rooms) || {};
  openModal(`<h2>${a ? `Edit: ${esc(a.name)}` : "Add your own piece"}</h2><form class="gfform">
    ${own ? `<label><span>Name</span><input id="gf-name" type="text" value="${esc(a ? a.name : "")}" placeholder="A harp, say"></label>
      <label><span>Picture <small class="muted">seen from above, its back along the top; a PNG or WebP with a see-through background looks best</small></span>
        <div class="frow"><input id="gf-img" type="text" value="${esc(a && a.img || "")}" placeholder="Upload one, or paste a link" class="grow">${S.assets ? `<label class="btn ghost small">Upload<input type="file" accept="image/*" id="gf-file" hidden></label>` : ""}</div></label>
      <div class="frow"><label><span>Width <small class="muted">squares</small></span><input id="gf-w" type="number" min="1" max="6" value="${a ? a.w : 1}"></label><label><span>Depth <small class="muted">squares</small></span><input id="gf-h" type="number" min="1" max="6" value="${a ? a.h : 1}"></label>
      <label><span>Where it goes</span><select id="gf-place">${Object.entries(GEN_FURN_PLACES).filter(([k]) => k !== "gap" && k !== "hearth").map(([k, v]) => `<option value="${k}"${(a ? a.place : "wall") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>` : `<p class="muted small">${a.w} × ${a.h} squares · ${esc(GEN_FURN_PLACES[a.place] || a.place)}</p>`}
    ${a ? `<div class="gfrooms gfall">${genfRoomsText(a)}</div>` : ""}
    <fieldset><legend>Rooms it goes in <small class="muted">how many: least – most (0 – 1 means sometimes)</small></legend>
      <div class="gfroomlist">${GENF_ROOMNAMES().sort((x, y) => (rooms[y] && rooms[y][1] > 0 ? 1 : 0) - (rooms[x] && rooms[x][1] > 0 ? 1 : 0)).map(n => { const v = rooms[n], on = v && v[1] > 0; return `<label class="gfrrow${on ? " on" : ""}"><input type="checkbox" data-room="${esc(n)}"${on ? " checked" : ""}><span>${esc(gfRoomLabel(n))}</span><input type="number" min="0" max="20" data-min="${esc(n)}" value="${on ? v[0] : 0}" aria-label="Least in ${esc(n)}"><span>–</span><input type="number" min="1" max="20" data-max="${esc(n)}" value="${on ? v[1] : 1}" aria-label="Most in ${esc(n)}"></label>`; }).join("")}</div></fieldset>
    <div class="acts"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div></form>`, m => {
    const f = m.querySelector("#gf-file"); if (f) f.addEventListener("change", async () => { const file = f.files[0]; if (!file) return; toast("Uploading…"); try { const res = await S.assets.upload(file); m.querySelector("#gf-img").value = assetPath(res); toast("Uploaded."); } catch (e) { toast("That didn't upload."); } });
    m.querySelectorAll("[data-room]").forEach(c => c.addEventListener("change", () => c.closest(".gfrrow").classList.toggle("on", c.checked)));
    m.querySelector("form").addEventListener("submit", async ev => { ev.preventDefault();
      const picked = {}; m.querySelectorAll("[data-room]").forEach(c => { if (!c.checked) return; const n = c.dataset.room, lo = Math.max(0, Number(m.querySelector(`[data-min="${CSS.escape(n)}"]`).value) || 0), hi = Math.max(lo, 1, Number(m.querySelector(`[data-max="${CSS.escape(n)}"]`).value) || 1); picked[n] = [lo, hi]; });
      if (own) { const name = m.querySelector("#gf-name").value.trim(), img = m.querySelector("#gf-img").value.trim(); if (!name || !img) { toast("Give it a name and a picture."); return; }
        const piece = { id: a ? a.id : "c" + Math.random().toString(36).slice(2, 9), name, img, w: Math.max(1, Math.min(6, Number(m.querySelector("#gf-w").value) || 1)), h: Math.max(1, Math.min(6, Number(m.querySelector("#gf-h").value) || 1)), place: m.querySelector("#gf-place").value, access: m.querySelector("#gf-place").value === "wall" || m.querySelector("#gf-place").value === "corner" ? "front" : "any", rooms: picked };
        closeModal(); await genfSave(st => { st.custom = (st.custom || []).filter(x => x.id !== piece.id).concat([piece]); }); toast("Saved."); }
      else { closeModal(); await genfSave(st => { st.rooms = st.rooms || {}; st.rooms[a.id] = picked; }); toast("Saved. New buildings use it."); } });
  });
}
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act^=gfx]"); if (!b || !vCanEdit()) return; const a = b.dataset.act;
  if (a === "gfxcat") { GENF.cat = b.dataset.v; render(); return; }
  if (a === "gfxadd") { genfEdit(null); return; }
  if (a === "gfxedit") { genfEdit(b.dataset.id); return; }
  if (a === "gfxdel") { const id = b.dataset.id, builtin = GEN_FURN.some(x => x.id === id); if (!builtin && !confirm("Delete this piece?")) return;
    await genfSave(st => { if (builtin) st.hidden = [...new Set((st.hidden || []).concat(id))]; else st.custom = (st.custom || []).filter(x => x.id !== id); }); toast(builtin ? "Removed. It's under Removed if you want it back." : "Deleted."); return; }
  if (a === "gfxrestore") { await genfSave(st => { st.hidden = (st.hidden || []).filter(x => x !== b.dataset.id); }); return; }
});
