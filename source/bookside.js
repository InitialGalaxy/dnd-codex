// ---------- Book editor side panel: contents to jump around, and a spelling pass over the whole book ----------
const BS = { tab: "toc", dict: null, rank: null, loading: null, issues: [], ignore: new Set(), skipCaps: true, findAt: {} };

function besideHtml() {
  return `<aside class="beside" id="beside" aria-label="Book tools">
    <div class="bstabs" role="tablist"><button type="button" role="tab" data-bs="toc" aria-selected="${BS.tab === "toc"}">Contents</button><button type="button" role="tab" data-bs="spell" aria-selected="${BS.tab === "spell"}">Spelling</button><button type="button" class="bsclose" data-bs="close" aria-label="Close">✕</button></div>
    <div class="bspane" id="bstoc"${BS.tab === "toc" ? "" : " hidden"}></div>
    <div class="bspane" id="bsspell"${BS.tab === "spell" ? "" : " hidden"}>
      <p class="muted small">Checks every word in the book against an Australian English dictionary. Names from your library are skipped.</p>
      <label class="check inline small"><input type="checkbox" id="bsskipcaps"${BS.skipCaps ? " checked" : ""}> Skip words starting with a capital</label>
      <button type="button" class="btn small" data-bs="run">Check the whole book</button>
      <div id="bsresults"></div>
    </div>
  </aside>`;
}
function bsMount() {
  const side = $("#beside"); if (!side) return;
  side.addEventListener("click", bsClick);
  side.addEventListener("change", ev => { if (ev.target.id === "bsskipcaps") { BS.skipCaps = ev.target.checked; if (BS.issues.length) bsRun(); } });
  bsToc();
  window.addEventListener("scroll", bsActive, { passive: true });
}
let bsTocTimer = null;
function bsTocSoon() { clearTimeout(bsTocTimer); bsTocTimer = setTimeout(bsToc, 500); }
function bsToc() {
  const box = $("#bstoc"), ed = BE.ed; if (!box || !ed) return;
  const items = [...ed.children].filter(n => /^H[1-4]$/.test(n.tagName) || n.classList.contains("embedblock")).map((n, k) => {
    n.dataset.toc = k;
    if (n.classList.contains("embedblock")) { const e = S.entries.get(n.dataset.embed); return { k, lv: 3, t: e ? e.title : "Missing entry", type: e ? e.type : "" }; }
    return { k, lv: Number(n.tagName[1]), t: n.textContent.trim() };
  }).filter(i => i.t);
  box.innerHTML = items.length ? `<ol class="bstoc">${items.map(i => `<li class="l${i.lv}${i.type ? " emb" : ""}"><button type="button" data-bsgo="${i.k}">${i.type ? `<span class="pill t-${esc(i.type)}">${esc((TYPE[i.type] || TYPE.general).label)}</span> ` : ""}${esc(i.t)}</button></li>`).join("")}</ol>`
    : `<p class="muted small">Headings and inserted entries show here.</p>`;
  bsActive();
}
function bsActive() {
  const ed = BE.ed, box = $("#bstoc"); if (!ed || !box || !ed.isConnected) return;
  const top = (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tophd")) || 64) + 80;
  let cur = null; ed.querySelectorAll("[data-toc]").forEach(n => { if (n.getBoundingClientRect().top < top) cur = n.dataset.toc; });
  box.querySelectorAll("[data-bsgo]").forEach(b => b.classList.toggle("on", b.dataset.bsgo === cur));
}
function bsOpen(tab) {
  BS.tab = tab || BS.tab;
  const side = $("#beside"); if (!side) return;
  side.classList.add("open");
  side.querySelectorAll("[data-bs]").forEach(b => b.getAttribute("role") === "tab" && b.setAttribute("aria-selected", b.dataset.bs === BS.tab));
  $("#bstoc").hidden = BS.tab !== "toc"; $("#bsspell").hidden = BS.tab !== "spell";
}
function bsClick(ev) {
  const go = ev.target.closest("[data-bsgo]");
  if (go) { const n = BE.ed && BE.ed.querySelector(`[data-toc="${go.dataset.bsgo}"]`); if (n) { n.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); n.classList.add("flash"); setTimeout(() => n.classList.remove("flash"), 1200); } $("#beside").classList.remove("open"); return; }
  const b = ev.target.closest("[data-bs]"); if (b) {
    const k = b.dataset.bs;
    if (k === "close") { $("#beside").classList.remove("open"); return; }
    if (k === "run") { bsRun(); return; }
    bsOpen(k); if (k === "toc") bsToc(); return;
  }
  const a = ev.target.closest("[data-sw]"); if (!a) return;
  const w = a.dataset.w, act = a.dataset.sw;
  if (act === "fix") { const n = bsReplace(w, a.dataset.to); toast(`Changed ${n} “${w}” to “${a.dataset.to}”`); BS.issues = BS.issues.filter(i => i.key !== w.toLowerCase()); bsDraw(); }
  else if (act === "find") bsFind(w);
  else if (act === "ignore") { BS.ignore.add(w.toLowerCase()); BS.issues = BS.issues.filter(i => i.key !== w.toLowerCase()); bsDraw(); }
  else if (act === "add") bsAddWord(w);
}
async function bsLoadDict() {
  if (BS.dict) return true;
  if (!BS.loading) BS.loading = fetch("./dict-en.txt").then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(t => {
    const words = t.split("\n"); BS.dict = new Set(words); BS.rank = new Map(words.map((w, k) => [w, k]));
  });
  try { await BS.loading; return true; } catch (e) { BS.loading = null; return false; }
}
function bsKnown() {
  const s = new Set((S.dict || []).map(w => w.toLowerCase()));
  const addWords = t => String(t || "").toLowerCase().split(/[^a-z']+/).forEach(w => w && s.add(w));
  for (const [, e] of S.entries) addWords(e.title);
  for (const [, t] of S.tags) addWords(t.name);
  for (const [, c] of S.chars) addWords(c.name);
  (S.towns || []).forEach(t => addWords(t.n));
  for (const [, b] of S.books) addWords(b.title);
  return s;
}
// Text nodes of the editor that hold the author's writing (not inserted entries or links).
function bsTextNodes() {
  const out = [], walker = document.createTreeWalker(BE.ed, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode.closest(".mdblock,a.wiki") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n; while ((n = walker.nextNode())) out.push(n);
  return out;
}
const BS_WORD = /[A-Za-z][A-Za-z']*[A-Za-z]|[A-Za-z]/g;
function bsOk(w, known) {
  const lw = w.toLowerCase().replace(/'s$/, "").replace(/^'+|'+$/g, "");
  if (lw.length < 2 || BS.dict.has(lw) || known.has(lw) || BS.ignore.has(lw)) return true;
  if (/^[A-Z]{2,}$/.test(w)) return true; // acronyms
  if (BS.skipCaps && /^[A-Z]/.test(w)) return true;
  // Simple endings on known words: dragons, burned, quickly.
  for (const [suf, rep] of [["s", ""], ["es", ""], ["ed", ""], ["ed", "e"], ["ing", ""], ["ing", "e"], ["ly", ""], ["er", ""], ["est", ""], ["ness", ""], ["'", ""]]) if (lw.endsWith(suf) && BS.dict.has(lw.slice(0, -suf.length) + rep)) return true;
  return false;
}
async function bsRun() {
  const res = $("#bsresults"); if (!res || !BE.ed) return;
  res.innerHTML = `<p class="muted small">Loading the dictionary…</p>`;
  if (!(await bsLoadDict())) { res.innerHTML = `<p class="muted small">The dictionary couldn't load here. Open the codex on claude.ai to use the spelling pass.</p>`; return; }
  const known = bsKnown(), counts = new Map();
  for (const n of bsTextNodes()) for (const m of n.nodeValue.matchAll(BS_WORD)) {
    const w = m[0]; if (bsOk(w, known)) continue;
    const key = w.toLowerCase(), cur = counts.get(key) || { key, word: w, n: 0 }; cur.n++; counts.set(key, cur);
  }
  BS.issues = [...counts.values()].sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
  bsDraw();
}
function bsSuggest(word) {
  const w = word.toLowerCase(), L = "abcdefghijklmnopqrstuvwxyz'";
  const e1 = new Set();
  for (let i = 0; i <= w.length; i++) {
    const a = w.slice(0, i), b = w.slice(i);
    if (b) e1.add(a + b.slice(1));
    if (b.length > 1) e1.add(a + b[1] + b[0] + b.slice(2));
    for (const c of L) { if (b) e1.add(a + c + b.slice(1)); e1.add(a + c + b); }
  }
  let hits = [...e1].filter(x => BS.dict.has(x));
  if (hits.length < 3 && w.length > 3 && w.length < 13) {
    const more = new Set();
    for (const x of e1) for (let i = 0; i <= x.length; i++) { const a = x.slice(0, i), b = x.slice(i); if (b) { more.add(a + b.slice(1)); if (b.length > 1) more.add(a + b[1] + b[0] + b.slice(2)); } for (const c of L) { if (b) more.add(a + c + b.slice(1)); more.add(a + c + b); } }
    hits = [...new Set([...hits, ...[...more].filter(x => BS.dict.has(x))])];
  }
  hits.sort((a, b) => BS.rank.get(a) - BS.rank.get(b));
  const cap = /^[A-Z]/.test(word);
  return hits.slice(0, 3).map(x => cap ? x[0].toUpperCase() + x.slice(1) : x);
}
function bsDraw() {
  const res = $("#bsresults"); if (!res) return;
  if (!BS.issues.length) { res.innerHTML = `<p class="bsok">✓ No spelling problems found.</p>`; return; }
  const shown = BS.issues.slice(0, 60);
  res.innerHTML = `<p class="small"><b>${BS.issues.length}</b> word${BS.issues.length === 1 ? "" : "s"} to check${BS.issues.length > 60 ? " (first 60 shown)" : ""}</p>
    <ul class="bslist">${shown.map(i => { const sug = bsSuggest(i.word); return `<li><div class="bsw"><button type="button" class="bsword" data-sw="find" data-w="${esc(i.word)}" title="Find it in the book">${esc(i.word)}</button>${i.n > 1 ? `<span class="muted small">×${i.n}</span>` : ""}</div>
      <div class="bsacts">${sug.map(s => `<button type="button" class="bssug" data-sw="fix" data-w="${esc(i.word)}" data-to="${esc(s)}" title="Change every “${esc(i.word)}” to “${esc(s)}”">${esc(s)}</button>`).join("") || `<span class="muted small">No suggestions</span>`}
      <button type="button" class="bsmini" data-sw="ignore" data-w="${esc(i.word)}" title="Skip it for now">Ignore</button><button type="button" class="bsmini" data-sw="add" data-w="${esc(i.word)}" title="Never flag this word again">Add to dictionary</button></div></li>`; }).join("")}</ul>`;
}
function bsReplace(word, to) {
  const re = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi"); let n = 0;
  for (const t of bsTextNodes()) {
    const v = t.nodeValue, nv = v.replace(re, m => { n++; return /^[A-Z]/.test(m) ? to[0].toUpperCase() + to.slice(1) : to; });
    if (nv !== v) t.nodeValue = nv;
  }
  if (n) BE.ed.dispatchEvent(new Event("input"));
  return n;
}
function bsFind(word) {
  const re = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), nodes = bsTextNodes(), hits = [];
  nodes.forEach(t => { const m = t.nodeValue.match(re); if (m) hits.push([t, m.index]); });
  if (!hits.length) return;
  const k = ((BS.findAt[word] || 0)) % hits.length; BS.findAt[word] = k + 1;
  const [t, i] = hits[k], r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + word.length);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  (t.parentElement || BE.ed).scrollIntoView({ block: "center", behavior: "smooth" });
  if (matchMedia("(max-width: 1279px)").matches) $("#beside").classList.remove("open");
}
async function bsAddWord(w) {
  const words = [...new Set([...(S.dict || []), w.toLowerCase()])];
  if (await safeWrite(() => S.db.doc("settings/dictionary").set({ words }), `Added “${w}” to your dictionary`)) { S.dict = words; BS.issues = BS.issues.filter(i => i.key !== w.toLowerCase()); bsDraw(); }
}
