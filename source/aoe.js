// ---------- Area-of-effect diagrams ----------
// Saved in markdown as {{aoe:<encoded JSON>}} on its own line:
// { w, h, cx, cy, cells: { "x,y": "#color" }, mv: [[x, y]], en: [[x, y]] }
// cx/cy is the creature (white dot), mv are black "moves to" tokens, en are red "enemy target" tokens.
const AOE_RE = /^\s*\{\{aoe:([^}\s]+)\}\}\s*$/;
const AOE_COLORS = ["#d9534f", "#f0883e", "#e3c04a", "#5cb85c", "#4aa3df", "#9b6fd6"];
const aoeDefault = () => ({ w: 9, h: 9, cx: 4, cy: 4, cs: 1, cells: {}, mv: [], en: [] });
// Tokens can cover more than one square: the creature uses cs (2 = 2×2), red tokens carry their own size as [x, y, size].
// Positions are the token's top-left square. "Moves to" tokens match the creature's size.
const AOE_SIZES = [1, 2, 3, 4, 5];
const aoeOn = (x0, y0, sz, x, y) => x >= x0 && y >= y0 && x < x0 + sz && y < y0 + sz;
function aoeDecode(s) { try { const d = JSON.parse(decodeURIComponent(s)); return Object.assign(aoeDefault(), d); } catch (e) { return aoeDefault(); } }
const aoeToken = d => "{{aoe:" + encodeURIComponent(JSON.stringify({ w: d.w, h: d.h, cx: d.cx, cy: d.cy, cs: d.cs || 1, cells: d.cells, mv: d.mv, en: d.en })) + "}}";
const aoeHas = (list, x, y, sz) => (list || []).some(p => aoeOn(p[0], p[1], sz || p[2] || 1, x, y));
// Shapes with rounded outer corners and filleted inner corners. colAt(x, y) gives a cell's colour (or undefined).
function aoeGeom(w, h, colAt, C) {
  const r = C * .3, H = C / 2, fill = {}, line = [];
  const add = (c, dd) => { fill[c] = (fill[c] || "") + dd; };
  const n = v => Math.round(v * 100) / 100;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = colAt(x, y);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = x * C + (sx > 0 ? C : 0), py = y * C + (sy > 0 ? C : 0), ux = -sx, uy = -sy;
      const hc = colAt(x + sx, y), vc = colAt(x, y + sy), gc = colAt(x + sx, y + sy);
      const A = `${n(px + ux * r)} ${n(py)}`, B = `${n(px)} ${n(py + uy * r)}`, P = `${n(px)} ${n(py)}`;
      if (c) {
        if (hc !== c && vc !== c) { // outer corner: round it off
          add(c, `M${A}L${n(px + ux * H)} ${n(py)}L${n(px + ux * H)} ${n(py + uy * H)}L${n(px)} ${n(py + uy * H)}L${B}Q${P} ${A}Z`);
          line.push(`M${A}Q${P} ${B}`);
        } else add(c, `M${P}L${n(px + ux * H)} ${n(py)}L${n(px + ux * H)} ${n(py + uy * H)}L${n(px)} ${n(py + uy * H)}Z`);
      }
      if (hc && !c && hc === vc && hc === gc) { // inner corner of a neighbouring shape: fill the notch
        add(hc, `M${P}L${A}Q${P} ${B}Z`);
        line.push(`M${A}Q${P} ${B}`);
      }
    }
    if (!c) continue;
    // Straight outline along each side that meets something else, trimmed where a corner curves.
    for (const [nx, ny] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (colAt(x + nx, y + ny) === c) continue;
      const tx = ny ? 1 : 0, ty = nx ? 1 : 0;
      const ox = x * C + (nx > 0 ? C : 0), oy = y * C + (ny > 0 ? C : 0);
      const trim = e => { const ax = x + e * tx, ay = y + e * ty; return colAt(ax, ay) !== c || (colAt(ax + nx, ay + ny) === c && !colAt(x + nx, y + ny)) ? r : 0; };
      const t0 = trim(-1), t1 = trim(1);
      line.push(`M${n(ox + tx * t0)} ${n(oy + ty * t0)}L${n(ox + tx * (C - t1))} ${n(oy + ty * (C - t1))}`);
    }
  }
  return { fill, line: line.join("") };
}

// One board with grid lines; same-coloured neighbours join into a single textured shape with one outline.
function aoeSvg(d, opts) {
  opts = opts || {};
  const C = 24, W = d.w * C, H = d.h * C, cells = d.cells || {}, parts = [];
  const sel = new Set(opts.sel || []);
  parts.push(`<defs><pattern id="aoetex" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="7" fill="rgba(255,255,255,.16)"/></pattern></defs>`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#1c212d"/>`);
  for (let x = 1; x < d.w; x++) parts.push(`<line x1="${x * C}" y1="0" x2="${x * C}" y2="${H}" stroke="#2f3747" stroke-width="1"/>`);
  for (let y = 1; y < d.h; y++) parts.push(`<line x1="0" y1="${y * C}" x2="${W}" y2="${y * C}" stroke="#2f3747" stroke-width="1"/>`);
  const filled = Object.entries(cells).map(([k, c]) => { const [x, y] = k.split(",").map(Number); return { x, y, c }; }).filter(o => o.x >= 0 && o.y >= 0 && o.x < d.w && o.y < d.h);
  const geo = aoeGeom(d.w, d.h, (x, y) => cells[x + "," + y], C);
  Object.entries(geo.fill).forEach(([c, dd]) => parts.push(`<path d="${dd}" fill="${esc(c)}" fill-opacity=".82"/>`));
  const all = Object.values(geo.fill).join("");
  if (all) parts.push(`<path d="${all}" fill="url(#aoetex)"/>`);
  if (geo.line) parts.push(`<path d="${geo.line}" stroke="rgba(255,255,255,.6)" stroke-width="1.6" stroke-linecap="round" fill="none"/>`);
  if (sel.size) { const sg = aoeGeom(d.w, d.h, (x, y) => sel.has(x + "," + y) ? "s" : undefined, C); if (sg.line) parts.push(`<path d="${sg.line}" stroke="#fff" stroke-width="2" stroke-dasharray="4 3" fill="none"/>`); }
  const cs = d.cs || 1;
  const dot = (x, y, sz, fill, stroke, f) => `<circle cx="${(x + sz / 2) * C}" cy="${(y + sz / 2) * C}" r="${(sz === 1 ? f : f + (sz - 1) * .5) * C}" fill="${fill}" stroke="${stroke}" stroke-width="${sz > 1 ? 2.5 : 2}"/>`;
  (d.en || []).forEach(([x, y, sz], i) => { parts.push(dot(x, y, sz || 1, "#c62828", "#2a0a0a", .3)); if (opts.enSel === i) parts.push(`<rect x="${x * C + 1}" y="${y * C + 1}" width="${(sz || 1) * C - 2}" height="${(sz || 1) * C - 2}" rx="4" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>`); });
  (d.mv || []).forEach(([x, y]) => parts.push(dot(x, y, cs, "#111", "#e8e8e8", .3)));
  parts.push(`<circle cx="${(d.cx + cs / 2) * C}" cy="${(d.cy + cs / 2) * C}" r="${(.42 + (cs - 1) * .5) * C}" fill="rgba(255,255,255,.25)"/>` + dot(d.cx, d.cy, cs, "#fff", "#222", .28));
  if (opts.hover) parts.push(`<rect x="${opts.hover[0] * C + 1}" y="${opts.hover[1] * C + 1}" width="${C - 2}" height="${C - 2}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2" rx="2"/>`);
  parts.push(`<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#3b4557" stroke-width="1"/>`);
  const legend = [`<span><i class="lg cr"></i>creature</span>`, (d.mv || []).length ? `<span><i class="lg mv"></i>moves to</span>` : "", (d.en || []).length ? `<span><i class="lg en"></i>enemy target</span>` : ""].filter(Boolean).join("");
  return `<svg class="aoesvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Area of effect diagram, ${d.w} by ${d.h} squares">${parts.join("")}</svg>${opts.noLegend ? "" : `<figcaption class="aoelegend">${legend}</figcaption>`}`;
}
const aoeFigure = s => `<figure class="aoefig">${aoeSvg(aoeDecode(s))}</figure>`;
function aoeAtom(s) {
  return `<div class="mdblock aoeblock" contenteditable="false" data-md="${esc("{{aoe:" + s + "}}")}"><div class="aoebar"><span class="mdtag">Area of effect</span><button type="button" class="btn small" data-aoe="edit">Edit</button><button type="button" class="btn ghost small" data-aoe="rm">Remove</button></div>${aoeFigure(s)}</div>`;
}

// ----- The editor dialog (its own layer, so it works on top of the entry editor) -----
function aoeEdit(start, onSave) {
  let d = JSON.parse(JSON.stringify(start || aoeDefault()));
  let tool = "paint", color = AOE_COLORS[0], down = false, lastKey = "", sel = [], drag = null, hover = null, enSize = 1, enSel = -1;
  d.cs = d.cs || 1;
  const dlg = document.createElement("div"); dlg.className = "aoedlg"; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Area of effect diagram");
  const prevFocus = document.activeElement;
  const TOOLS = [["paint", "🖌 Paint"], ["erase", "Erase"], ["move", "✥ Drag"], ["copy", "⧉ Copy"], ["flip", "⇋ Flip"], ["creature", `<i class="lg cr"></i>Creature`], ["mv", `<i class="lg mv"></i>Moves to`], ["en", `<i class="lg en"></i>Enemy target`]];
  const HINT = { paint: "Click or drag to paint squares.", erase: "Click or drag to clear squares and tokens.", move: "Drag a coloured shape or a token to move it. Click a shape, then a colour, to recolour it.", flip: "Click a shape to select it, then flip it left to right or top to bottom. With nothing selected, the flip buttons mirror the whole diagram.", copy: "Drag a coloured shape to copy it. Click a shape, then a colour, to recolour it.", creature: "Click to move the creature. Pick its size, from 1×1 up to 5×5.", mv: "Click to place or remove a black token where the creature moves to.", en: "Click to place a red token for an attack centred on an enemy. Click a token to select it and change its size; click it again to remove it." };
  const edgeBtns = side => `<div class="aoeedge e-${side}"><button type="button" class="btn ghost small" data-edge="${side}+" aria-label="Add a ${side === "top" || side === "bottom" ? "row" : "column"} on the ${side}">+</button><button type="button" class="btn ghost small" data-edge="${side}-" aria-label="Remove the ${side} ${side === "top" || side === "bottom" ? "row" : "column"}"${(side === "top" || side === "bottom" ? d.h : d.w) <= 3 ? " disabled" : ""}>−</button></div>`;
  const view = () => drag && drag.preview ? drag.preview : d;
  const board = () => { const b = dlg.querySelector(".aoeboard"); if (b) b.innerHTML = aoeSvg(view(), { noLegend: true, sel: drag && drag.preview ? drag.psel : sel, hover, enSel: tool === "en" ? enSel : -1 }); };
  const sizeBtns = (cur, lab) => `<span class="aoesizes" role="group" aria-label="${lab}"><span class="muted small">${lab}</span>${AOE_SIZES.map(n => `<button type="button" class="btn ghost small${cur === n ? " on" : ""}" data-size="${n}" aria-pressed="${cur === n}">${n}×${n}</button>`).join("")}</span>`;
  const fit = (v, sz, max) => Math.max(0, Math.min(max - sz, v));
  const draw = () => {
    dlg.innerHTML = `<div class="aoebox">
      <div class="aoehead"><h2>Area of effect <small class="muted">${d.w} × ${d.h}</small></h2><button type="button" class="iconbtn" data-x="cancel" aria-label="Close">✕</button></div>
      <div class="aoectl">
        <div class="aoetools" role="group" aria-label="Tool">${TOOLS.map(([k, l]) => `<button type="button" class="${tool === k ? "on" : ""}" data-tool="${k}" aria-pressed="${tool === k}">${l}</button>`).join("")}</div>
        <div class="aoecolors" role="group" aria-label="Colour">${AOE_COLORS.map(c => `<button type="button" class="sw${color === c ? " on" : ""}" data-color="${c}" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${color === c}"></button>`).join("")}<label class="swc" title="Pick any colour"><input type="color" value="${color}" data-x="pick" aria-label="Pick any colour"></label>
          ${sel.length ? `<span class="muted small">${sel.length} square${sel.length === 1 ? "" : "s"} selected: pick a colour to recolour them</span><button type="button" class="btn ghost small" data-x="delsel">Delete shape</button>` : ""}
          ${tool === "creature" ? sizeBtns(d.cs, "Creature size") : tool === "en" ? sizeBtns(enSel >= 0 && d.en[enSel] ? d.en[enSel][2] || 1 : enSize, enSel >= 0 ? "This token's size" : "New token size") : ""}
          ${sel.length || tool === "flip" ? `<span class="aoeflip"><button type="button" class="btn ghost small" data-flip="h" title="Flip left to right">⇋ Flip ${sel.length ? "shape" : "diagram"} left–right</button><button type="button" class="btn ghost small" data-flip="v" title="Flip top to bottom">⇅ Flip ${sel.length ? "shape" : "diagram"} top–bottom</button></span>` : ""}</div>
      </div>
      <div class="aoeframe">${edgeBtns("top")}${edgeBtns("left")}<div class="aoeboard" style="aspect-ratio:${d.w}/${d.h}"></div>${edgeBtns("right")}${edgeBtns("bottom")}</div>
      <p class="muted small aoehint">${HINT[tool]} Use + and − on each side to grow or shrink the grid from that edge.</p>
      <div class="acts"><button type="button" class="btn ghost" data-x="clear">Clear</button><span class="spacer"></span><button type="button" class="btn ghost" data-x="cancel">Cancel</button><button type="button" class="btn" data-x="save">Save diagram</button></div>
    </div>`;
    board();
  };
  const cellAt = ev => {
    const svg = dlg.querySelector(".aoeboard svg"); if (!svg) return null;
    const r = svg.getBoundingClientRect(), x = Math.floor((ev.clientX - r.left) / r.width * d.w), y = Math.floor((ev.clientY - r.top) / r.height * d.h);
    return x >= 0 && y >= 0 && x < d.w && y < d.h ? [x, y] : null;
  };
  const region = (x, y) => {
    const c = d.cells[x + "," + y]; if (!c) return [];
    const seen = new Set([x + "," + y]), q = [[x, y]];
    while (q.length) { const [a, b] = q.pop(); for (const [nx, ny] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) { const k = nx + "," + ny; if (!seen.has(k) && d.cells[k] === c) { seen.add(k); q.push([nx, ny]); } } }
    return [...seen];
  };
  const findTok = (list, x, y, sz) => { for (let i = list.length - 1; i >= 0; i--) if (aoeOn(list[i][0], list[i][1], sz || list[i][2] || 1, x, y)) return i; return -1; };
  const tokenAt = (x, y) => { if (aoeOn(d.cx, d.cy, d.cs, x, y)) return ["cr"]; let i = findTok(d.en, x, y); if (i >= 0) return ["en", i]; i = findTok(d.mv, x, y, d.cs); return i >= 0 ? ["mv", i] : null; };
  const inb = (x, y) => x >= 0 && y >= 0 && x < d.w && y < d.h;
  const shifted = (dx, dy, copy) => {
    const n = JSON.parse(JSON.stringify(d));
    if (drag.kind === "token") {
      if (drag.tok === "cr") { n.cx = fit(d.cx + dx, d.cs, d.w); n.cy = fit(d.cy + dy, d.cs, d.h); }
      else { const p = n[drag.tok][drag.i], sz = drag.tok === "mv" ? d.cs : p[2] || 1; p[0] = fit(p[0] + dx, sz, d.w); p[1] = fit(p[1] + dy, sz, d.h); }
      return { n, psel: [] };
    }
    const moved = drag.sel.map(k => { const [x, y] = k.split(",").map(Number); return { from: k, to: (x + dx) + "," + (y + dy), ok: inb(x + dx, y + dy), c: d.cells[k] }; });
    if (!copy) moved.forEach(m => delete n.cells[m.from]);
    moved.forEach(m => { if (m.ok) n.cells[m.to] = m.c; });
    return { n, psel: moved.filter(m => m.ok).map(m => m.to) };
  };
  const apply = (x, y, first) => {
    const key = x + "," + y; if (!first && key === lastKey) return; lastKey = key;
    if (tool === "paint") d.cells[key] = color;
    else if (tool === "erase") { delete d.cells[key]; d.mv = d.mv.filter(p => !aoeOn(p[0], p[1], d.cs, x, y)); d.en = d.en.filter(p => !aoeOn(p[0], p[1], p[2] || 1, x, y)); enSel = -1; }
    else if (tool === "creature") { const o = Math.floor((d.cs - 1) / 2); d.cx = fit(x - o, d.cs, d.w); d.cy = fit(y - o, d.cs, d.h); }
    else if (first && tool === "mv") { const i = findTok(d.mv, x, y, d.cs); if (i >= 0) d.mv.splice(i, 1); else { const o = Math.floor((d.cs - 1) / 2); d.mv.push([fit(x - o, d.cs, d.w), fit(y - o, d.cs, d.h)]); } }
    else if (first && tool === "en") {
      const i = findTok(d.en, x, y);
      if (i >= 0 && i === enSel) { d.en.splice(i, 1); enSel = -1; }
      else if (i >= 0) enSel = i;
      else { const o = Math.floor((enSize - 1) / 2); d.en.push([fit(x - o, enSize, d.w), fit(y - o, enSize, d.h)].concat(enSize > 1 ? [enSize] : [])); enSel = d.en.length - 1; }
      draw(); return;
    }
    board();
  };
  const grow = (side, add) => {
    const v = side === "top" || side === "bottom", size = v ? d.h : d.w; if (!add && size <= 3) return; if (add && size >= 25) return;
    const sx = side === "left" ? (add ? 1 : -1) : 0, sy = side === "top" ? (add ? 1 : -1) : 0;
    const nw = v ? d.w : d.w + (add ? 1 : -1), nh = v ? d.h + (add ? 1 : -1) : d.h, ok = (x, y) => x >= 0 && y >= 0 && x < nw && y < nh;
    const cells = {}; Object.entries(d.cells).forEach(([k, c]) => { const [x, y] = k.split(",").map(Number); if (ok(x + sx, y + sy)) cells[(x + sx) + "," + (y + sy)] = c; });
    d.cells = cells; const okT = (p, sz) => ok(p[0], p[1]) && ok(p[0] + sz - 1, p[1] + sz - 1);
    d.mv = d.mv.map(([x, y]) => [x + sx, y + sy]).filter(p => okT(p, d.cs)); d.en = d.en.map(p => [p[0] + sx, p[1] + sy, ...p.slice(2)]).filter(p => okT(p, p[2] || 1)); enSel = -1;
    d.cs = Math.min(d.cs, nw, nh); d.cx = fit(d.cx + sx, d.cs, nw); d.cy = fit(d.cy + sy, d.cs, nh); d.w = nw; d.h = nh; sel = []; draw();
  };
  // Mirror the selected shape inside its own footprint, or the whole diagram (tokens too) when nothing is selected.
  const flip = horiz => {
    const P = k => k.split(",").map(Number);
    if (sel.length) {
      const pts = sel.map(P), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const lo = horiz ? Math.min(...xs) : Math.min(...ys), hi = horiz ? Math.max(...xs) : Math.max(...ys);
      const cols = sel.map(k => d.cells[k]); sel.forEach(k => delete d.cells[k]);
      sel = pts.map(([x, y], i) => { const nk = horiz ? (lo + hi - x) + "," + y : x + "," + (lo + hi - y); d.cells[nk] = cols[i]; return nk; });
    } else {
      const m = ([x, y, ...rest], sz) => (horiz ? [d.w - x - sz, y] : [x, d.h - y - sz]).concat(rest);
      const cells = {}; Object.entries(d.cells).forEach(([k, c]) => { cells[m(P(k), 1).join(",")] = c; }); d.cells = cells;
      d.mv = d.mv.map(p => m(p, d.cs)); d.en = d.en.map(p => m(p, p[2] || 1)); [d.cx, d.cy] = m([d.cx, d.cy], d.cs);
    }
    draw();
  };
  const close = () => { dlg.remove(); document.removeEventListener("pointerup", up); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {} };
  const up = () => {
    if (drag) { if (drag.preview) { d = drag.preview; sel = drag.psel; } drag = null; draw(); }
    down = false; lastKey = "";
  };
  dlg.addEventListener("pointerdown", ev => {
    if (!ev.target.closest(".aoeboard")) return;
    const c = cellAt(ev); if (!c) return; ev.preventDefault(); down = true;
    const [x, y] = c;
    if (tool === "flip") { sel = region(x, y); down = false; draw(); return; }
    if (tool === "move" || tool === "copy") {
      const tk = tool === "move" && tokenAt(x, y);
      if (tk) { drag = { kind: "token", tok: tk[0], i: tk[1], from: [x, y] }; sel = []; return; }
      const r = region(x, y); sel = r; drag = r.length ? { kind: "region", from: [x, y], sel: r } : null; draw(); return;
    }
    apply(x, y, true);
  });
  dlg.addEventListener("pointermove", ev => {
    const c = ev.target.closest && ev.target.closest(".aoeboard") ? cellAt(ev) : null;
    if (drag && c) { const dx = c[0] - drag.from[0], dy = c[1] - drag.from[1]; if (dx || dy) { const r = shifted(dx, dy, tool === "copy"); drag.preview = r.n; drag.psel = r.psel; } else drag.preview = null; board(); return; }
    if (down && c && (tool === "paint" || tool === "erase")) { apply(c[0], c[1], false); return; }
    const hk = c ? c.join(",") : ""; if (hk !== (hover ? hover.join(",") : "")) { hover = c; board(); }
  });
  dlg.addEventListener("pointerleave", () => { hover = null; board(); });
  document.addEventListener("pointerup", up);
  dlg.addEventListener("click", ev => {
    const e = ev.target.closest("[data-edge]"); if (e) { const m = e.dataset.edge.match(/^(\w+)([+-])$/); grow(m[1], m[2] === "+"); return; }
    const z = ev.target.closest("[data-size]"); if (z) {
      const n = Number(z.dataset.size);
      if (tool === "creature") { if (n > d.w || n > d.h) return; d.cs = n; d.cx = fit(d.cx, n, d.w); d.cy = fit(d.cy, n, d.h); d.mv = d.mv.map(([x, y]) => [fit(x, n, d.w), fit(y, n, d.h)]); }
      else { enSize = n; const p = enSel >= 0 && d.en[enSel]; if (p) { d.en[enSel] = [fit(p[0], n, d.w), fit(p[1], n, d.h)].concat(n > 1 ? [n] : []); } }
      draw(); return;
    }
    const f = ev.target.closest("[data-flip]"); if (f) { flip(f.dataset.flip === "h"); return; }
    const t = ev.target.closest("[data-tool]"); if (t) { tool = t.dataset.tool; enSel = -1; if (tool !== "move" && tool !== "copy" && tool !== "flip") sel = []; draw(); return; }
    const c = ev.target.closest("[data-color]"); if (c) { color = c.dataset.color; if (sel.length) sel.forEach(k => { d.cells[k] = color; }); else if (tool !== "paint") tool = "paint"; draw(); return; }
    const b = ev.target.closest("[data-x]"); if (!b) { if (ev.target === dlg) close(); return; }
    const x = b.dataset.x;
    if (x === "cancel") close();
    else if (x === "save") { close(); onSave(d); }
    else if (x === "clear") { d.cells = {}; d.mv = []; d.en = []; sel = []; enSel = -1; draw(); }
    else if (x === "delsel") { sel.forEach(k => delete d.cells[k]); sel = []; draw(); }
  });
  dlg.addEventListener("input", ev => { if (ev.target.dataset.x === "pick") { color = ev.target.value; if (sel.length) { sel.forEach(k => { d.cells[k] = color; }); board(); } } });
  dlg.addEventListener("change", ev => { if (ev.target.dataset.x === "pick") { if (!sel.length) tool = "paint"; draw(); } });
  dlg.addEventListener("keydown", ev => { if (ev.key === "Escape") { ev.stopPropagation(); close(); } });
  draw(); document.body.appendChild(dlg);
  const first = dlg.querySelector('[data-tool="paint"]'); if (first) first.focus();
}
