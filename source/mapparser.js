// Azgaar Fantasy Map Generator .map parser -> compact world data for the lore codex.
// Works on the raw text of a .map save. Locates data lines by content, then by Azgaar's fixed save order.
function parseAzgaarMap(text, fileName) {
  const L = text.split(/\r?\n/);
  const tryJSON = s => { try { return JSON.parse(s); } catch (e) { return null; } };
  const nums = s => (s ? s.split(",").map(Number) : []);
  const stripHtml = s => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

  // 1. Burgs line: array starting with 0 then burg objects that carry cell/x/y.
  let bi = -1;
  for (let i = 0; i < L.length; i++) {
    const h = L[i].slice(0, 400);
    if (h.startsWith("[0,{") && h.includes('"cell":') && h.includes('"x":') && h.includes('"y":') && !h.includes('"formName"')) {
      if (L[i].includes('"population":')) { bi = i; break; }
    }
  }
  if (bi < 0) throw new Error("No towns found. Is this an Azgaar Fantasy Map Generator .map file?");
  const burgsRaw = tryJSON(L[bi]);
  if (!Array.isArray(burgsRaw)) throw new Error("The towns section of this .map file could not be read.");

  const states = tryJSON(L[bi - 1]) || [];
  const cultures = tryJSON(L[bi - 2]) || [];
  const settings = tryJSON(L[1]) || {};
  const at = (off, pred) => { const s = L[bi + off]; return s !== undefined && pred(s) ? s : null; };
  const religionsLine = at(14, s => s.startsWith('[{"name":'));
  const provincesLine = at(15, s => s.startsWith("[0"));
  const religions = religionsLine ? tryJSON(religionsLine) || [] : [];
  const provinces = provincesLine ? tryJSON(provincesLine) || [] : [];
  const cellState = nums(L[bi + 10]), cellRel = nums(L[bi + 11]), cellProv = nums(L[bi + 12]);

  const active = burgsRaw.filter(b => b && typeof b === "object" && b.i && !b.removed && b.name);
  // Validate the cell arrays against burg states before trusting province/religion lookups.
  const cellsOk = active.length > 0 && active.filter(b => cellState[b.cell] === b.state).length / active.length > 0.95;

  // Goods (newer economy versions) and markers.
  let goods = [], markers = [], gridH = null, gridInfo = null;
  for (let i = bi; i < L.length; i++) {
    const h = L[i].slice(0, 300);
    if (!goods.length && h.startsWith('[{"i":') && h.includes('"distribution":') && h.includes('"tags":')) goods = tryJSON(L[i]) || [];
    if (!markers.length && h.startsWith('[{') && h.includes('"icon":') && h.includes('"cell":') && h.includes('"type":')) markers = tryJSON(L[i]) || [];
  }
  // Grid heights for the land silhouette: gridGeneral is 9 lines above burgs, heights 8 above.
  const gg = bi >= 9 ? tryJSON(L[bi - 9]) : null;
  if (gg && gg.cellsX && gg.cellsY) {
    const h = nums(L[bi - 8]);
    if (h.length >= gg.cellsX * gg.cellsY * 0.9) { gridInfo = { cellsX: gg.cellsX, cellsY: gg.cellsY }; gridH = h.slice(0, gg.cellsX * gg.cellsY).map(v => (v >= 20 ? Math.min(9, 1 + Math.floor((v - 20) / 9)) : 0)).join(""); }
  }
  const goodName = {}; goods.forEach(g => { if (g && g.i != null) goodName[g.i] = g.name; });

  const popScale = (settings.units && settings.units.population && settings.units.population.scale) || 1000;
  const urban = (settings.units && settings.units.population && settings.units.population.urbanization && settings.units.population.urbanization.rate) || 1;
  const graph = settings.graph || {};

  const towns = active.map(b => {
    const t = { i: b.i, n: b.name, s: b.state || 0, c: b.culture || 0, x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10,
      pop: Math.round((b.population || 0) * popScale * urban), g: b.group || "", t: b.type || "" };
    if (cellsOk) { t.p = cellProv[b.cell] || 0; t.r = cellRel[b.cell] || 0; }
    const f = [];
    if (b.capital) f.push("capital"); if (b.port) f.push("port"); if (b.walls) f.push("walls"); if (b.citadel) f.push("citadel");
    if (b.temple) f.push("temple"); if (b.plaza) f.push("market square"); if (b.shanty) f.push("shanty town");
    if (f.length) t.f = f;
    if (Array.isArray(b.production)) {
      const agg = {};
      b.production.forEach(p => { if (p && p.goodId != null && goodName[p.goodId]) agg[p.goodId] = (agg[p.goodId] || 0) + (p.units || 0); });
      const top = Object.entries(agg).sort((a, z) => z[1] - a[1]).slice(0, 8).map(([id, u]) => [Number(id), Math.round(u * 10) / 10]);
      if (top.length) t.pr = top;
    }
    const note = stripHtml(b.note);
    if (note) t.note = note;
    return t;
  });

  const meta = {
    name: (settings.lore && settings.lore.name) || String(fileName || "My world").replace(/\.map$/i, ""),
    year: settings.lore && settings.lore.calendar ? settings.lore.calendar.year : null,
    era: settings.lore && settings.lore.calendar ? settings.lore.calendar.era : null,
    w: graph.width || 1536, h: graph.height || 855,
    distScale: settings.units && settings.units.distance ? settings.units.distance.scale : null,
    distUnit: settings.units && settings.units.distance ? settings.units.distance.unit : null,
    states: states.filter(s => s && !s.removed).map(s => ({ i: s.i, n: s.name, full: s.fullName || s.name, color: s.color || "#888", note: stripHtml(s.note) || undefined })),
    provinces: provinces.filter(p => p && typeof p === "object" && !p.removed).map(p => ({ i: p.i, n: p.name, full: p.fullName || p.name, s: p.state })),
    cultures: cultures.filter(c => c && !c.removed).map(c => ({ i: c.i, n: String(c.name).trim(), t: c.type })),
    religions: religions.filter(r => r && !r.removed).map(r => ({ i: r.i, n: r.name, t: r.type, form: r.form })),
    goods: goods.filter(g => g && g.i != null).map(g => ({ i: g.i, n: g.name })),
    markers: markers.filter(m => m && !m.removed).map(m => ({ i: m.i, n: m.name || m.type, t: m.type, x: Math.round(m.x * 10) / 10, y: Math.round(m.y * 10) / 10, note: stripHtml(m.note) || undefined })),
    grid: gridInfo ? { cx: gridInfo.cellsX, cy: gridInfo.cellsY, h: gridH } : null,
    townCount: towns.length,
    cellsOk
  };
  return { meta, towns };
}
if (typeof module !== "undefined") module.exports = { parseAzgaarMap };
