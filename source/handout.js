// ---------- Handouts: a torn page, written and edited as it looks ----------
// e.handout = { found, entry, scrawl, after, edges: { top, right, bottom, left } }, e.body = the writing on the page.
// Older handouts kept everything in the body (▲ row = top edge, ▼ row = bottom edge, first line = entry line,
// a lowercase or ">>" last line = margin scrawl, text after ▼ = torn-away note); handoutParts reads both.
function handoutParts(e) {
  if (e.handout) return Object.assign({ found: "", entry: "", scrawl: "", after: "", edges: { top: true, bottom: true } }, e.handout, { body: String(e.body || "") });
  const paras = String(e.body || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const top = paras.findIndex(p => /^▲{5,}$/.test(p)), bot = paras.findIndex(p => /^▼{5,}$/.test(p));
  const before = top > 0 ? paras.slice(0, top) : [], inner = paras.slice(top >= 0 ? top + 1 : 0, bot >= 0 ? bot : paras.length), after = bot >= 0 ? paras.slice(bot + 1) : [];
  let entry = "", scrawl = "";
  if (inner.length > 1) entry = inner.shift();
  const last = inner.length - 1;
  if (last > 0 && (/^>>/.test(inner[last]) || /^[a-z]/.test(inner[last]))) scrawl = inner.pop().replace(/^>>\s*/, "");
  return { found: before.map(p => p.replace(/^\*|\*$/g, "")).join(" "), entry, scrawl, after: after.map(p => p.replace(/^\*|\*$/g, "")).join(" "), body: inner.join("\n\n"),
    edges: { top: top >= 0 || bot < 0, bottom: bot >= 0 || top < 0, left: false, right: false } };
}
// A ragged clip-path for the chosen edges. Seeded so the same handout always tears the same way.
function tornClip(edges, seed) {
  let h = 2166136261; for (const ch of String(seed || "page")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const D = 14, pts = [], N = 48, M = 36;
  for (let i = 0; i <= N; i++) pts.push(`${(i / N * 100).toFixed(2)}% ${edges.top ? (rnd() * D).toFixed(1) : 0}px`);
  for (let i = 1; i <= M; i++) pts.push(`calc(100% - ${edges.right ? (rnd() * D).toFixed(1) : 0}px) ${(i / M * 100).toFixed(2)}%`);
  for (let i = N - 1; i >= 0; i--) pts.push(`${(i / N * 100).toFixed(2)}% calc(100% - ${edges.bottom ? (rnd() * D).toFixed(1) : 0}px)`);
  for (let i = M - 1; i >= 1; i--) pts.push(`${edges.left ? (rnd() * D).toFixed(1) : 0}px ${(i / M * 100).toFixed(2)}%`);
  return `polygon(${pts.join(", ")})`;
}
const edgeClass = ed => ["top", "right", "bottom", "left"].filter(k => ed[k]).map(k => "t-" + k).join(" ");
const inkBlots = html => html.replace(/▇+/g, m => `<span class="blot" aria-label="ink blot">${m}</span>`);
function handoutHtml(e, id) {
  const p = handoutParts(e), edges = p.edges || {};
  return `<div class="handout">
    ${p.found ? `<p class="found">${inline(esc(p.found))}</p>` : ""}
    <div class="tnote"><div class="paper ${edgeClass(edges)}" style="clip-path:${tornClip(edges, id || e.title)}">
      ${p.entry ? `<p class="entryline">${inkBlots(inline(esc(p.entry)))}</p>` : ""}
      <div class="pbody">${inkBlots(md(p.body, { entryId: id, noEmbed: true })) || `<p>Blank page.</p>`}</div>
      ${p.scrawl ? `<p class="scrawl">${inkBlots(inline(esc(p.scrawl)))}</p>` : ""}
    </div></div>
    ${p.after ? `<p class="tornaway">${inline(esc(p.after))}</p>` : ""}
  </div>`;
}
function handoutFields(e, id) {
  const p = handoutParts(e), edges = p.edges || {};
  return `<div class="hoedit">
    <div class="hoedges"><span class="flabel">Torn edges</span>${["top", "right", "bottom", "left"].map(k => `<label class="check inline"><input type="checkbox" class="ho-edge" value="${k}"${edges[k] ? " checked" : ""}> ${k[0].toUpperCase() + k.slice(1)}</label>`).join("")}
      <button type="button" class="btn ghost small" data-act="hoblot" title="Insert an ink blot where the cursor is">▇ Ink blot</button></div>
    <input id="ho-found" class="ho-found" type="text" value="${esc(p.found)}" placeholder="Where it was found (optional, shown above the page)">
    <div class="handout ho-live"><div class="tnote"><div class="paper ${edgeClass(edges)}" id="ho-paper" data-seed="${esc(id || e.title || "page")}" style="clip-path:${tornClip(edges, id || e.title || "page")}">
      <input id="ho-entry" class="entryline" type="text" value="${esc(p.entry)}" placeholder="Heading line, e.g. Entry the Ninth">
      <textarea id="ho-body" rows="8" placeholder="Write on the page…">${esc(p.body)}</textarea>
      <input id="ho-scrawl" class="scrawl" type="text" value="${esc(p.scrawl)}" placeholder="Scrawl in the margin (optional)">
    </div></div>
    <input id="ho-after" class="tornaway" type="text" value="${esc(p.after)}" placeholder="Note about a torn-away part (optional, shown below the page)"></div>
  </div>`;
}
function handoutEdgesRedraw() {
  const paper = $("#ho-paper"); if (!paper) return;
  const edges = {}; document.querySelectorAll(".ho-edge").forEach(c => { edges[c.value] = c.checked; });
  paper.className = "paper " + edgeClass(edges);
  paper.style.clipPath = tornClip(edges, paper.dataset.seed);
}
function readHandoutFields() {
  const edges = {}; document.querySelectorAll(".ho-edge").forEach(c => { edges[c.value] = c.checked; });
  return { found: $("#ho-found").value.trim(), entry: $("#ho-entry").value.trim(), scrawl: $("#ho-scrawl").value.trim(), after: $("#ho-after").value.trim(), edges };
}
function handoutBlot() {
  const ed = document.querySelector("#ho-paper .rtedit"); if (!ed) return;
  ed.focus(); document.execCommand("insertText", false, "▇▇▇▇▇");
}
document.addEventListener("change", ev => { if (ev.target.matches && ev.target.matches(".ho-edge")) handoutEdgesRedraw(); });
