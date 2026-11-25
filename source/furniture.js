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
  { id: "trestle", name: "Trestle table", cat: "Seats & tables", w: 3, h: 1, place: "free", access: "any", seats: { a: ["bench3", "bench", "stool"], sides: "long", min: 1 }, draw: P => gfTable(4, P * 0.12, 3 * P - 8, P * 0.76, genfWood[3], 3) + gfR(P * 0.3, P * 0.08, 6, P * 0.84, "rgba(94,64,39,.5)") + gfR(3 * P - P * 0.3 - 6, P * 0.08, 6, P * 0.84, "rgba(94,64,39,.5)") + gfMug(P * 0.8, P * 0.4) + `<circle cx="${P * 1.6}" cy="${P * 0.5}" r="${P * 0.16}" fill="#d9c7a0" stroke="${GENF_INK}" stroke-width="1.5"/>` + gfCandle(P * 2.3, P * 0.45) },
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
  { id: "plant", name: "Potted plant", cat: "Outside", w: 1, h: 1, place: "free", access: "any", corner: 1, draw: P => gfCShadow(P / 2, P / 2, P * 0.26) + gfC(P / 2, P / 2, P * 0.26, "#b8643a") + [[0.4, 0.4], [0.6, 0.42], [0.5, 0.58], [0.38, 0.58], [0.62, 0.6], [0.5, 0.36]].map(([x, y]) => `<circle cx="${P * x}" cy="${P * y}" r="${P * 0.12}" fill="#5a8a3a" stroke="#2f4f1f" stroke-width="1"/>`).join("") },
];

// What each room holds: [piece, least, most, chance (of having any at all)], most important first. "a|b" means one of these
// (in a random order: if the first won't fit, the next). Rooms not listed borrow from another room of the same kind.
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
    "Shop floor": [["counter", 1, 1], ["shelves", 2, 3], ["barrel", 1, 2], ["crate", 0, 2], ["sacks", 0, 2], ["display", 0, 1, 0.6]],
    "Shop": [["counter", 1, 1], ["clothbolts", 1, 3], ["dressform", 1, 2], ["shelves", 0, 1, 0.6], ["display", 0, 1, 0.4]],
    "Pawn counter": [["counter", 1, 1], ["shelves", 1, 2], ["strongbox", 1, 1], ["chest", 0, 2]],
    "Workroom": [["cuttingtable", 1, 1], ["loom", 0, 1, 0.5], ["spinning", 0, 1, 0.6], ["dressform", 0, 1, 0.5], ["clothbolts", 1, 2], ["stool", 1, 2], ["shelves", 0, 1, 0.4]],
    "Workshop": [["workbench", 1, 2], ["toolrack", 0, 1, 0.7], ["stool", 0, 1], ["crate", 0, 2], ["barrel", 0, 1, 0.4]],
    "Disguise room": [["dressform", 1, 2], ["press", 1, 1], ["washstand", 0, 1, 0.5], ["stool", 1, 1], ["chest", 0, 1]],
    "Fitting room": [["dressform", 1, 2], ["press", 0, 1], ["stool", 1, 1], ["washstand", 0, 1, 0.4]],
    "Forge": [["anvil", 1, 1], ["quench", 1, 1], ["bellows", 1, 1], ["toolrack", 1, 1], ["coalbin", 1, 1], ["grindstone", 0, 1, 0.7], ["workbench", 0, 1, 0.6], ["ironstock", 0, 1, 0.5], ["barrel", 0, 1, 0.3]],
    "Common room": [["bar", 1, 1], ["trestle|table2", 1, 3], ["roundtable", 1, 4], ["settle", 0, 1, 0.5], ["caskrack", 0, 1, 0.5], ["barrel", 0, 2]],
    "Great hall": [["longtable|trestle", 1, 1], ["carvedchair", 0, 1, 0.5], ["bench", 0, 2], ["lectern", 0, 1, 0.3], ["chest", 0, 1, 0.4], ["weaponrack", 0, 1, 0.3]],
    "Trophy hall": [["statue", 1, 3], ["weaponrack", 1, 2], ["longtable", 0, 1, 0.5], ["chest", 0, 1]],
    "Office": [["desk", 1, 1], ["chest", 1, 1], ["bookshelf", 0, 1, 0.5], ["shelves", 0, 1, 0.4], ["strongbox", 0, 1, 0.3]],
    "Reception": [["desk", 1, 1], ["bench", 0, 2], ["chest", 0, 1, 0.5], ["shelves", 0, 1, 0.4]],
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
  };
})();
const GEN_FURN_KIND = { living: "Main room", bed: "Bedroom", kitchen: "Kitchen", store: "Storage", cellar: "Cellar", shop: "Shop floor", work: "Workshop", forge: "Forge", tavern: "Common room",
  hall: "Great hall", office: "Office", meet: "Meeting room", library: "Library", temple: "Nave", sanctum: "Sanctum", bath: "Bathhouse", pit: "Fighting pit", vault: "Vault", porch: "Porch", privy: "Privy" };
const GEN_FURN_PLACES = { wall: "Against a wall", corner: "In a corner", free: "Anywhere", centre: "Middle of the room", hearth: "Beside a fireplace", gap: "A square out from a wall" };

// The pieces in use: the built-in ones (less any you've removed, with your changes to which rooms they go in) and your own.
// Kept on the hidden "Generated buildings" campaign as furniture: { hidden: [id], rooms: { id: { room: [min, max, chance] } }, custom: [piece] }.
const genFurnStore = () => ((S.vttCamps && S.vttCamps.get(VGEN)) || {}).furniture || {};
const genFurnImg = a => a.img || genUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a.w * GEN_PX} ${a.h * GEN_PX}" width="${a.w * GEN_PX}" height="${a.h * GEN_PX}">${a.draw(GEN_PX)}</svg>`);
const GEN_FURN_IMG = new Map();
function genFurnLib() {
  const st = genFurnStore(), hidden = new Set(st.hidden || []), rooms = st.rooms || {};
  // Each piece's rooms: { room name: [least, most, chance, order] }, from the room lists above.
  const base = new Map(GEN_FURN.map(a => [a.id, {}]));
  Object.entries(GEN_FURN_ROOMS).forEach(([room, list]) => list.forEach(([ids, lo, hi, p], i) => ids.split("|").forEach(id => { const m = base.get(id); if (m && !m[room]) m[room] = [lo, hi, p == null ? 1 : p, i, ids]; })));
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
  const name = GEN_FURN_ROOMS[rm.n] || lib.some(a => a.rooms && a.rooms[rm.n]) ? rm.n : GEN_FURN_KIND[rm.k] || rm.n;
  // This room's list: every piece that goes in it, in order; "a|b" choices kept together.
  const entries = new Map(); lib.forEach(a => { const v = a.rooms && a.rooms[name]; if (!v || !(v[1] > 0)) return; const key = v[4] || a.id; if (!entries.has(key)) entries.set(key, { ids: [], lo: v[0], hi: v[1], p: v[2], ord: v[3] }); entries.get(key).ids.push(a.id); });
  const list = [...entries.values()].sort((a, b) => a.ord - b.ord); if (!list.length) return;
  const byId = new Map(lib.map(a => [a.id, a]));
  const inRoom = (x, y) => x >= rm.x && y >= rm.y && x < rm.x + rm.w && y < rm.y + rm.h, K = (x, y) => x + "," + y;
  const solid = new Set(), clear = new Set(), keys = [], access = [], placed = [];
  const sideKey = (x, y, s) => s === "t" ? `h,${x},${y}` : s === "b" ? `h,${x},${y + 1}` : s === "l" ? `v,${x},${y}` : `v,${x + 1},${y}`;
  const wallAt = (x, y, s) => { const k = sideKey(x, y, s); return edges.has(k) && !L.doors.has(k); }, winAt = (x, y, s) => L.wins.has(sideKey(x, y, s));
  // Squares to keep clear: inside every door, the ends of the stairs, in front of a fire.
  const doorCells = [];
  [...L.doors].forEach(k => { const [d, x, y] = k.split(",").map((v, i) => i ? Number(v) : v); (d === "h" ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]).forEach(([cx, cy]) => { if (inRoom(cx, cy)) { clear.add(K(cx, cy)); keys.push(K(cx, cy)); doorCells.push([cx, cy]); } }); });
  (L.stairs || []).forEach(t => { for (let x = t.x; x < t.x + t.w; x++) for (let y = t.y; y < t.y + t.h; y++) if (inRoom(x, y)) solid.add(K(x, y));
    genStairEntry(L, t).cells.forEach(c => { const [x, y] = c.split(",").map(Number); if (inRoom(x, y)) { clear.add(c); keys.push(c); } }); });
  const fires = [];
  (L.hearths || []).forEach(h => { if (!inRoom(h.x, h.y)) return; solid.add(K(h.x, h.y)); const d = { t: [0, 1], b: [0, -1], l: [1, 0], r: [-1, 0] }[h.side], fx = h.x + d[0], fy = h.y + d[1];
    if (h.fire && inRoom(fx, fy)) { clear.add(K(fx, fy)); keys.push(K(fx, fy)); fires.push([fx, fy, h]); } });
  if (!keys.length) { const c = (() => { for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) if (!solid.has(K(x, y))) return K(x, y); })(); if (!c) return; keys.push(c); }
  const area = rm.w * rm.h;
  // Can you still get everywhere? From the first door: every door, stair end and fire, and somewhere to stand at every piece.
  // (A room the stairs cut in two keeps its two parts, each reached by its own door: each part must stay whole.)
  const flood = from => { const seen = new Set([from]), q = [from]; if (solid.has(from)) return seen;
    while (q.length) { const [x, y] = q.pop().split(",").map(Number); for (const [dx, dy] of GENF_FRONT) { const nx = x + dx, ny = y + dy, k = K(nx, ny); if (!inRoom(nx, ny) || seen.has(k) || solid.has(k)) continue; seen.add(k); q.push(k); } }
    return seen; };
  const parts = []; keys.forEach(k => { if (solid.has(k)) return; const p = parts.find(g => g.seen.has(k)); if (p) p.keys.push(k); else parts.push({ keys: [k], seen: flood(k) }); });
  const reach = () => { const all = new Set();
    for (const g of parts) { const seen = flood(g.keys[0]); if (!g.keys.every(k => seen.has(k) && !solid.has(k))) return false; seen.forEach(k => all.add(k)); }
    return access.every(set => set.some(k => all.has(k))); };
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
        if (a.face === "door" && doorCells.length && facing(...doorCells.reduce((b, d) => (dist(x, y, W, H, d[0], d[1]) < dist(x, y, W, H, b[0], b[1]) ? d : b))) <= 0) continue;
        if (a.face === "altar" && faceAltar != null && k !== faceAltar.k) continue;
        // How good a spot: attractors and a little chance.
        let sc = r() * 1.2;
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
    if (spec.sides === "long") sides.push(...(longX ? [N, S2] : [Wd, E])); else sides.push(N, S2, Wd, E);
    for (const side of sides) { // benches first along a side, if there's a bench as long as it; else one seat a square
      const k = side[0][2], horiz = k === 0 || k === 2; let i = 0;
      while (i < side.length) { let done = false;
        for (const sid of spec.a) { const s = byId.get(sid); if (!s) continue; const len = Math.max(s.w, s.h); if (len > side.length - i) continue;
          const [sx, sy] = side[i], spot = besides(s, sx, sy, k);
          if (spot && (len === 1 || (horiz ? spot.W === len : spot.H === len))) { if (r() < 0.12 && len === 1 && made.length >= spec.min) { done = true; i++; break; } const p = tryAt(s, spot); if (p) { made.push([s, spot, p]); i += len; done = true; break; } } }
        if (!done) i++; } }
    return made; };
  for (const e of list) {
    // Bigger rooms get a little more of the small things.
    const small = e.ids.every(id => { const a = byId.get(id); return a && a.w * a.h <= 2 && !a.seats; }), hi = e.hi + (small && e.hi >= 1 ? Math.floor(Math.max(0, area - 20) / 22) : 0);
    let n = e.lo + Math.floor(r() * (hi - e.lo + 1)); if (e.p < 1 && r() > e.p) n = Math.min(n, e.lo);
    for (let c = 0; c < n; c++) {
      if (c >= e.lo && [...solid].length > area * (e.ids.includes("pew") ? 0.75 : 0.48)) break;
      const ids = e.ids.slice().sort(() => r() - 0.5); let got = null;
      for (const id of ids) { const a = byId.get(id); if (!a) continue;
        if (a.face === "altar" && !faceAltar) { const alt = placed.find(p => p.a === "altar"); faceAltar = { k: alt ? (alt.k + 2) % 4 : 0 }; }
        for (const s of spots(a).slice(0, 60)) { const p = tryAt(a, s); if (!p) continue;
          if (a.seats) { const seats = seatRound(p, a); if (seats.length < (a.seats.min || 0)) { seats.reverse().forEach(([, sp, pp]) => unput(sp, pp)); unput(s, p); continue; } }
          if (a.foot && r() < 0.6) { const f = byId.get(a.foot), fv = GENF_FRONT[s.k]; if (f) { const fx = s.k === 1 ? s.x - 1 : s.k === 3 ? s.x + s.W : s.x + (s.W > 1 ? Math.floor(r() * s.W) : 0), fy = s.k === 0 ? s.y + s.H : s.k === 2 ? s.y - 1 : s.y + (s.H > 1 ? Math.floor(r() * s.H) : 0); void fv; const sp = besides(f, fx, fy, s.k); if (sp) tryAt(f, sp); } }
          if (a.front) { const f = byId.get(a.front); if (f) { const A = around(s.x, s.y, s.W, s.H, s.k), opts = A.front.slice().sort(() => r() - 0.5); for (const [fx, fy] of opts) { const sp = besides(f, fx, fy, (s.k + 2) % 4); if (sp && tryAt(f, sp)) break; } } }
          got = p; break; }
        if (got) break; }
      if (!got) break;
    }
  }
  placed.forEach(p => L.furn.push({ a: p.a, x: p.x, y: p.y, w: p.w, h: p.h, k: p.k, room: ri }));
}
// The pieces as pictures: where each one's box goes when turned (its own w × h, centred on its footprint), for the map.
function genFurnBoxes(L, lib) { const byId = new Map((lib || genFurnLib()).map(a => [a.id, a]));
  return (L.furn || []).map(f => { const a = byId.get(f.a); if (!a) return null; const cx = f.x + f.w / 2, cy = f.y + f.h / 2; return { a, x: cx - a.w / 2, y: cy - a.h / 2, w: a.w, h: a.h, rot: f.k * 90, src: a.src }; }).filter(Boolean); }

// ----- The Furniture tab: #gen-<camp>/furniture -----
const GENF = { cat: "" };
const genfRoomsText = a => { const e = Object.entries(a.rooms || {}).filter(([, v]) => v[1] > 0).sort((x, y) => x[0].localeCompare(y[0]));
  const seat = GEN_FURN.some(t => t.seats && t.seats.a.includes(a.id)) ? `<span class="gfroom">Round tables</span>` : "";
  return e.length || seat ? e.map(([k, v]) => `<span class="gfroom">${esc(k)} <b>${v[0] === v[1] ? v[1] : `${v[0]}–${v[1]}`}${v[2] < 1 ? "?" : ""}</b></span>`).join("") + seat : `<span class="muted small">Not in any room yet</span>`; };
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
      <div class="gfrooms">${genfRoomsText(a)}</div>
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
    <fieldset><legend>Rooms it goes in <small class="muted">how many: least – most (0 – 1 means sometimes)</small></legend>
      <div class="gfroomlist">${GENF_ROOMNAMES().map(n => { const v = rooms[n], on = v && v[1] > 0; return `<label class="gfrrow${on ? " on" : ""}"><input type="checkbox" data-room="${esc(n)}"${on ? " checked" : ""}><span>${esc(n)}</span><input type="number" min="0" max="20" data-min="${esc(n)}" value="${on ? v[0] : 0}" aria-label="Least in ${esc(n)}"><span>–</span><input type="number" min="1" max="20" data-max="${esc(n)}" value="${on ? v[1] : 1}" aria-label="Most in ${esc(n)}"></label>`; }).join("")}</div></fieldset>
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
