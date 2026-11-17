// ---------- Full-page book editor: sticky toolbar, autosave, library entries embedded in the text ----------
// A book body holds "{{embed:<entryId>}}" on its own line wherever a library entry is inserted.
// The book shows the live entry, so a stat block, subclass or item is only ever edited in one place.
const EMBED_RE = /^\s*\{\{embed:([\w-]+)\}\}\s*$/;
const embedToken = id => `{{embed:${id}}}`;
const embedIds = body => [...String(body || "").matchAll(/\{\{embed:([\w-]+)\}\}/g)].map(m => m[1]);
const BE = { id: null, ed: null, timer: null, dirty: false, saving: false, range: null, savedAt: null };
const bookWords = body => String(body || "").replace(/\{\{embed:[\w-]+\}\}/g, " ").replace(/\|[^\n]*\|/g, " ").split(/\s+/).filter(Boolean).length;

// The rendered entry as it appears inside a book.
function embedHtml(id) {
  const e = S.entries.get(id);
  if (!e) return READONLY ? "" : `<div class="embed missing"><p class="muted">An entry inserted here is no longer in the library.</p></div>`;
  if (READONLY && e.hidden) return "";
  let inner;
  if (isHarvest(e)) return `<div class="loot"><div class="lootgrid">${harvestCardHtml(id, e)}</div></div>`;
  if (e.type === "subclass") inner = subclassHtml(id, e);
  else if (e.type === "race") inner = raceHtml(id, e);
  else if (e.type === "class") inner = classHtml(id, e);
  else if (e.type === "feat") inner = featHtml(id, e);
  else if (e.type === "handout") inner = handoutHtml(e, id);
  else if (e.type === "partset") inner = `<h3 class="embtitle">${esc(e.title)}</h3>` + partsetHtml(id, e);
  else if (e.type === "item") inner = itemPageHtml(id, e);
  else if (e.type === "spell") inner = `<h3 class="embtitle">${esc(e.title)}</h3>` + spellCardHtml(spellFromEntry(id, e), "", true);
  else if (e.statblock) inner = statBlockHtml(e.statblock, e.title, "core") + (e.statblock.features ? featuresHtml(e.statblock, id) : "") + lootHtml(e.loot, "Harvest table", creatureSizeNum(e)) + (e.body && e.body.trim() ? `<div class="prose">${md(e.body, { entryId: id, noEmbed: true })}</div>` : "");
  else inner = `<h3 class="embtitle">${esc(e.title)}</h3><div class="prose">${md(e.body, { entryId: id, noEmbed: true })}</div>${lootHtml(e.loot, "Harvest table", creatureSizeNum(e))}`;
  return `<div class="embed t-${esc(e.type)}" data-embed="${esc(id)}">${inner}${READONLY ? "" : `<a class="emblink" href="#entry-${esc(id)}">Open “${esc(e.title)}” in the library →</a>`}</div>`;
}
// The locked block shown in the editor.
function embedAtom(id) {
  const e = S.entries.get(id), t = e ? (TYPE[e.type] || TYPE.general) : null;
  const small = isHarvest(e);
  return `<div class="mdblock embedblock${small ? " small" : ""}" contenteditable="false" data-md="${esc(embedToken(id))}" data-embed="${esc(id)}" data-upd="${esc(e ? e.updated || "" : "missing")}">
    <div class="embbar"><span class="pill t-${e ? esc(e.type) : "general"}">${t ? t.label : "Missing"}</span><b>${esc(e ? e.title : "Missing entry")}</b><span class="muted small embnote">from the library · edits show everywhere it's used</span><span class="spacer"></span>
      ${e ? `<button type="button" class="btn small" data-embact="edit">Edit</button>` : ""}${small ? "" : `<button type="button" class="btn ghost small" data-embact="more">Expand</button>`}<button type="button" class="btn ghost small" data-embact="up" title="Move up" aria-label="Move up">↑</button><button type="button" class="btn ghost small" data-embact="down" title="Move down" aria-label="Move down">↓</button><button type="button" class="btn ghost small" data-embact="remove">Remove</button></div>
    <div class="embprev" inert>${e ? embedHtml(id) : ""}</div></div>`;
}

function viewBookEdit(id) {
  if (READONLY) return `<div class="empty">Books can't be edited in the read-only page.</div>`;
  const b = S.books.get(id);
  if (!b) return S.loaded.books ? `<div class="empty">That book no longer exists. <a href="#books">Back to the shelf</a></div>` : loadingOr(false);
  return `<div class="bookeditor" data-id="${esc(id)}">
    <div class="behead">
      <a class="btn ghost small" href="#book-${esc(id)}">← Done</a>
      <input id="bk-title" class="betitle" type="text" value="${esc(b.title)}" placeholder="Book title" aria-label="Book title">
      <label class="bestat"><span class="sr">Status</span><select id="bk-status">${BOOK_STATUS.map(st => `<option${st === (b.status || "Planned") ? " selected" : ""}>${st}</option>`).join("")}</select></label>
      <label class="check inline"><input id="bk-hidden" type="checkbox"${b.hidden ? " checked" : ""}> Hide from players</label>
    </div>
    <div class="bebody">${besideHtml()}<div class="bemain">
    <div id="bedraft"></div>
    <div class="field"><textarea id="bk-body" rows="24" placeholder="Start writing. Use Insert to drop in a subclass, race, creature or item.">${esc(b.body || "")}</textarea></div>
    <div class="befoot"><p class="muted small">Saves as you type and when you leave this page. Headings, subclasses and races build the contents list. Tables show as locked blocks; use the Markdown button to edit those.</p><span class="spacer"></span><button class="btn danger small" type="button" data-act="delbook" data-v="${esc(id)}">Delete book</button></div>
  </div></div></div>`;
}
function beSetTop() { const t = document.querySelector(".top"); document.documentElement.style.setProperty("--tophd", (t ? t.offsetHeight : 64) + "px"); }
function beStatus(text, kind) { const s = $("#besave"); if (s) { s.textContent = text; s.className = "besave" + (kind ? " " + kind : ""); } }
function beMount() {
  const root = document.querySelector(".bookeditor"); if (!root) return;
  const id = root.dataset.id;
  BE.id = id; BE.dirty = false; BE.range = null;
  beSetTop();
  const ta = $("#bk-body");
  const ed = richify(ta, { base: 1 }); BE.ed = ed;
  const bar = root.querySelector(".rtbar");
  bar.insertAdjacentHTML("beforeend", `<span class="rtsep" aria-hidden="true"></span><span class="rtins">Insert</span>
    <button type="button" class="insbtn" data-ins="lib" title="Insert something already in the library">From library…</button>
    <button type="button" class="insbtn" data-ins="subclass">+ Subclass</button>
    <button type="button" class="insbtn" data-ins="race">+ Race</button>
    <button type="button" class="insbtn" data-ins="class">+ Class</button>
    <button type="button" class="insbtn" data-ins="creature">+ Creature</button>
    <button type="button" class="insbtn" data-ins="item">+ Item</button>
    <button type="button" class="insbtn" data-ins="spell">+ Spell</button>
    <button type="button" class="insbtn" data-ins="libentry" title="Keep the section under this heading in the library">📚 Library entry</button>
    <span class="rtsep" aria-hidden="true"></span><button type="button" class="insbtn" data-ins="spellcheck" title="Check the spelling of the whole book">✓ Spelling</button><button type="button" class="insbtn bsnarrow" data-ins="toc">☰ Contents</button>
    <span class="besave" id="besave" aria-live="polite">Saved</span>`);
  bar.addEventListener("mousedown", ev => { if (ev.target.closest("[data-ins]")) ev.preventDefault(); });
  bar.addEventListener("click", ev => { const b = ev.target.closest("[data-ins]"); if (b) beInsertAction(b.dataset.ins); });
  ed.addEventListener("click", beEmbedClick);
  root.addEventListener("input", beDirty);
  root.addEventListener("input", bsTocSoon);
  bsMount();
  root.addEventListener("change", beDirty);
  // Text that never reached the codex (a closed tab, lost connection) is kept on this device.
  const draft = beDraftGet(id), b = S.books.get(id) || {};
  if (draft && draft.body !== b.body && (!b.updated || draft.at > b.updated)) {
    $("#bedraft").innerHTML = `<div class="banner"><div>This device has unsaved text for this book from ${esc(new Date(draft.at).toLocaleString())}.</div><button class="btn small" data-bedraft="restore">Restore it</button><button class="btn ghost small" data-bedraft="drop">Discard</button></div>`;
    $("#bedraft").onclick = ev => {
      const k = ev.target.dataset.bedraft; if (!k) return;
      if (k === "restore") { ed.innerHTML = mdToEditable(draft.body, 1); if (draft.title) $("#bk-title").value = draft.title; ed.dispatchEvent(new Event("input")); }
      else beDraftDrop(id);
      $("#bedraft").innerHTML = "";
    };
  }
  if (b.title === "Untitled book") { const t = $("#bk-title"); t.focus(); t.select(); }
  else if (!String(b.body || "").trim()) ed.focus();
  beJump();
}
function beDraftGet(id) { try { return JSON.parse(localStorage.getItem("codex-bookdraft-" + id) || "null"); } catch (e) { return null; } }
function beDraftPut(id, doc) { try { localStorage.setItem("codex-bookdraft-" + id, JSON.stringify({ body: doc.body, title: doc.title, at: new Date().toISOString() })); } catch (e) {} }
function beDraftDrop(id) { try { localStorage.removeItem("codex-bookdraft-" + id); } catch (e) {} }
function beDoc() {
  const id = BE.id, ta = $("#bk-body"); if (!id || !ta) return null;
  const prev = S.books.get(id) || {}, body = ta.value, now = new Date().toISOString();
  const doc = Object.assign({}, prev, { title: $("#bk-title").value.trim() || "Untitled book", status: $("#bk-status").value, body, words: bookWords(body), order: prev.order != null ? prev.order : S.books.size, created: prev.created || now, updated: now });
  if ($("#bk-hidden").checked) doc.hidden = true; else delete doc.hidden;
  return doc;
}
function beDirty() {
  if (!BE.id) return;
  BE.dirty = true; beStatus("Saving soon…");
  const d = beDoc(); if (d) beDraftPut(BE.id, d);
  clearTimeout(BE.timer); BE.timer = setTimeout(() => beSave(), 1200);
}
async function beSave(doc, id) {
  clearTimeout(BE.timer); BE.timer = null;
  id = id || BE.id; doc = doc || (BE.dirty ? beDoc() : null);
  if (!id || !doc || !S.db) return;
  if (id === BE.id) BE.dirty = false;
  BE.saving = true; beStatus("Saving…");
  try {
    S.books.set(id, doc);
    await S.db.doc("books/" + id).set(doc);
    if (!(id === BE.id && BE.dirty)) beDraftDrop(id);
    try { await syncBookLib(id, doc.body); } catch (e) { console.warn("Library sync failed", e); }
    BE.savedAt = new Date();
    beStatus("Saved " + BE.savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), "ok");
  } catch (err) {
    if (id === BE.id) { BE.dirty = true; beStatus("Couldn't save. Trying again…", "bad"); BE.timer = setTimeout(() => beSave(), 5000); }
    else toast("A book change couldn't be saved (" + (err && err.code || "error") + "). Its text is kept on this device; open the book again to restore it.", "bad");
  }
  BE.saving = false;
}
// Called by render() before the page is replaced: save whatever is pending.
function beLeave(r) {
  if (!BE.id || (r.v === "bookedit" && r.id === BE.id)) return;
  if (BE.dirty && document.querySelector(".bookeditor")) beSave(beDoc(), BE.id);
  clearTimeout(BE.timer); BE.id = null; BE.ed = null; BE.dirty = false;
  window.removeEventListener("scroll", bsActive); BS.issues = []; BS.findAt = {};
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && BE.dirty) beSave(); });
window.addEventListener("beforeunload", ev => { if (BE.dirty) { const d = beDoc(); if (d) beDraftPut(BE.id, d); beSave(d); ev.preventDefault(); ev.returnValue = ""; } });
window.addEventListener("resize", () => { if (BE.id) beSetTop(); });
document.addEventListener("selectionchange", () => {
  if (!BE.ed || !BE.ed.isConnected) return;
  const s = getSelection(); if (s.rangeCount && BE.ed.contains(s.anchorNode)) BE.range = s.getRangeAt(0).cloneRange();
});

// Keep the previews current when an entry changes (edited here, or anywhere else).
function beRefresh(force) {
  if (!BE.ed || !BE.ed.isConnected) return;
  BE.ed.querySelectorAll(".embedblock").forEach(blk => {
    const id = blk.dataset.embed, e = S.entries.get(id), key = e ? e.updated || "" : "missing";
    if (!force && blk.dataset.upd === key) return;
    const open = blk.classList.contains("open");
    const tmp = document.createElement("div"); tmp.innerHTML = embedAtom(id);
    const n = tmp.firstElementChild; if (open) { n.classList.add("open"); n.querySelector('[data-embact="more"]').textContent = "Collapse"; }
    blk.replaceWith(n);
  });
  bsTocSoon();
}
function beEmbedClick(ev) {
  const b = ev.target.closest("[data-embact]"); if (!b) return;
  ev.preventDefault(); ev.stopPropagation();
  const blk = b.closest(".embedblock"), id = blk.dataset.embed, a = b.dataset.embact, ed = BE.ed;
  if (a === "edit") { if (BE.dirty) beSave(); openEditor(id, null, "stay"); return; }
  if (a === "more") { const o = blk.classList.toggle("open"); b.textContent = o ? "Collapse" : "Expand"; return; }
  if (a === "remove") { const t = (S.entries.get(id) || {}).title; blk.remove(); toast(`Took ${t ? "“" + t + "”" : "it"} out of the book. It's still in the library.`); }
  else if (a === "up") { const p = blk.previousElementSibling; if (p) p.before(blk); }
  else if (a === "down") { const n = blk.nextElementSibling; if (n) n.after(blk); }
  ed.dispatchEvent(new Event("input"));
  if (a !== "remove") blk.scrollIntoView({ block: "nearest" });
}
function beInsertAction(k) {
  if (k === "lib") { bePicker(); return; }
  if (k === "libentry") { beLibInsert(); return; }
  if (k === "spellcheck") { bsOpen("spell"); bsRun(); return; }
  if (k === "toc") { bsOpen("toc"); bsToc(); return; }
  if (BE.dirty) beSave();
  const preset = { type: k, source: BE.id };
  openEditor(null, preset, "insert");
}
function bePicker() {
  const inBook = new Set(embedIds(($("#bk-body") || {}).value));
  openModal(`<h2>Insert from the library</h2>
    <p class="muted small">The book shows the library entry itself, so you only ever update a stat block or subclass in one place.</p>
    <div class="frow"><label class="grow"><span class="sr">Search</span><input id="bepq" type="text" placeholder="Search creatures, items, spells, subclasses, races…" autocomplete="off"></label>
      <label><span class="sr">Type</span><select id="bept"><option value="">All types</option>${TYPES.map(t => `<option value="${t.id}">${t.plural}</option>`).join("")}</select></label></div>
    <div id="beplist" class="beplist" role="list"></div>
    <div class="acts"><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div>`, m => {
    const q = m.querySelector("#bepq"), ty = m.querySelector("#bept"), list = m.querySelector("#beplist");
    const draw = () => {
      const s = q.value.trim().toLowerCase(), t = ty.value;
      const hits = [...S.entries.entries()].filter(([, e]) => (!t || e.type === t) && (!s || String(e.title || "").toLowerCase().includes(s)))
        .sort((a, b) => { const x = String(a[1].title).toLowerCase().startsWith(s) ? 0 : 1, y = String(b[1].title).toLowerCase().startsWith(s) ? 0 : 1; return x - y || byName(a[1].title, b[1].title); });
      list.innerHTML = hits.slice(0, 80).map(([id, e]) => `<button type="button" class="bepick" data-pick="${esc(id)}" role="listitem"><span class="pill t-${esc(e.type)}">${(TYPE[e.type] || TYPE.general).label}</span><b>${esc(e.title)}</b>${e.type === "subclass" && e.subclass ? `<span class="muted small">${esc(e.subclass.cls || "")}</span>` : ""}${inBook.has(id) ? `<span class="muted small">already in this book</span>` : ""}</button>`).join("")
        + (hits.length > 80 ? `<p class="muted small">${hits.length - 80} more. Keep typing to narrow it down.</p>` : "")
        + (hits.length ? "" : `<p class="muted">Nothing matches.</p>`);
    };
    q.addEventListener("input", ev => { ev.stopPropagation(); draw(); });
    ty.addEventListener("change", ev => { ev.stopPropagation(); draw(); });
    list.addEventListener("click", ev => { const b = ev.target.closest("[data-pick]"); if (b) { closeModal(); beInsertEmbed(b.dataset.pick); } });
    draw();
  });
}
function beInsertEmbed(id) {
  const ed = BE.ed; if (!ed || !ed.isConnected) return;
  const e = S.entries.get(id);
  if (ed.hidden) { // Markdown mode: put the token at the cursor.
    const ta = $("#bk-body"), p = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
    ta.value = ta.value.slice(0, p).replace(/\s*$/, "") + "\n\n" + embedToken(id) + "\n\n" + ta.value.slice(p).replace(/^\s*/, "");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    toast("Inserted " + (e ? "“" + e.title + "”" : "the entry")); return;
  }
  const tmp = document.createElement("div"); tmp.innerHTML = embedAtom(id); const node = tmp.firstElementChild;
  let block = null; const r = BE.range;
  if (r && ed.contains(r.startContainer)) {
    if (r.startContainer === ed) block = ed.childNodes[Math.max(0, r.startOffset - 1)] || null;
    else { let n = r.startContainer; while (n && n.parentNode !== ed) n = n.parentNode; block = n; }
  }
  if (block) {
    if (block.nodeType === 1 && block.matches("p,div:not(.mdblock)") && !block.textContent.trim() && !block.querySelector("img,.mdblock")) block.replaceWith(node);
    else block.after(node);
  } else ed.appendChild(node);
  if (!node.nextElementSibling || node.nextElementSibling.classList.contains("mdblock")) { const p = document.createElement("p"); p.innerHTML = "<br>"; node.after(p); }
  const after = node.nextElementSibling, sel = getSelection(), rr = document.createRange();
  rr.setStart(after, 0); rr.collapse(true); sel.removeAllRanges(); sel.addRange(rr); BE.range = rr.cloneRange();
  ed.classList.remove("is-empty");
  ed.dispatchEvent(new Event("input"));
  node.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  toast("Inserted " + (e ? "“" + e.title + "”" : "the entry"));
}
async function beNewBook() {
  if (!S.db) return;
  const id = "b" + Date.now().toString(36), now = new Date().toISOString();
  const doc = { title: "Untitled book", status: "Planned", body: "", words: 0, order: S.books.size, created: now, updated: now };
  S.books.set(id, doc);
  if (await safeWrite(() => S.db.doc("books/" + id).set(doc), "Book created")) location.hash = "bookedit-" + id;
  else S.books.delete(id);
}
