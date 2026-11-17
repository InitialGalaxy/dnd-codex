// ---------- Library entries written in a book ----------
// A marker line under a heading, {{lib:<id>|<type>|<tag>,<tag>}}, makes everything under that heading (down to the next
// heading of the same or a higher level) a library entry. The book is where it's written: each save updates the entry.
const LIB_RE = /^\s*\{\{lib:([A-Za-z0-9_-]+)\|([a-z]+)\|([^}]*)\}\}\s*$/;
const libToken = (id, type, tags) => `{{lib:${id}|${type}|${(tags || []).join(",")}}}`;
const HEAD_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const plainHead = t => String(t || "").replace(/[*_`]/g, "").replace(/\s*\{\{[^}]*\}\}\s*/g, " ").trim();

// The sections a book marks as library entries: [{ id, type, tags, title, body }]
function libSections(body) {
  const lines = String(body || "").split(/\r?\n/), out = [];
  lines.forEach((l, i) => {
    const m = l.match(LIB_RE); if (!m) return;
    let h = i - 1; while (h >= 0 && !HEAD_RE.test(lines[h])) h--;
    if (h < 0) return;
    const hm = lines[h].match(HEAD_RE), lv = hm[1].length;
    let end = i + 1; while (end < lines.length && !((x => x && x[1].length <= lv)(lines[end].match(HEAD_RE)))) end++;
    // Creatures, spells and the like inserted in the section are library entries already: the entry links to them instead.
    // A sub-heading that is its own library entry is left out too (linked, not copied).
    const inner = [], seen = new Set(), part = [];
    for (let k = h + 1; k < end; k++) {
      const x = lines[k], sh = x.match(HEAD_RE);
      if (sh && LIB_RE.test(lines[k + 1] || "")) {
        inner.push(plainHead(sh[2])); let q = k + 1;
        while (q < end && !((y => y && y[1].length <= sh[1].length)(lines[q].match(HEAD_RE)))) q++;
        k = q - 1; continue;
      }
      if (LIB_RE.test(x)) continue;
      const em = x.match(EMBED_RE);
      if (em) { const ee = S.entries.get(em[1]); if (ee && !seen.has(em[1])) { seen.add(em[1]); inner.push(ee.title); } continue; }
      // Sub-headings move up a level, so the entry reads the same as the book.
      part.push(sh ? "#".repeat(Math.max(1, sh[1].length - (lv - 1))) + " " + sh[2] : x);
    }
    let txt = part.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
    if (inner.length) txt += (txt ? "\n\n" : "") + "**In this section:** " + inner.map(t => "[[" + t + "]]").join(", ");
    out.push({ id: m[1], type: m[2], tags: m[3].split(",").map(t => t.trim()).filter(Boolean), title: plainHead(hm[2]), body: txt });
  });
  return out;
}
// Bring the library in line with a book: create or update its entries, and let go of ones whose marker was removed.
async function syncBookLib(bookId, body, quiet) {
  if (!S.db || READONLY) return 0;
  const secs = libSections(body), seen = new Set(), now = new Date().toISOString(); let n = 0;
  for (const s of secs) {
    if (seen.has(s.id)) continue; seen.add(s.id);
    const cur = S.entries.get(s.id) || {};
    if (cur.fromBook === bookId && cur.title === s.title && cur.body === s.body && cur.type === s.type && JSON.stringify(cur.tags || []) === JSON.stringify(s.tags)) continue;
    const doc = Object.assign({}, cur, { type: s.type, title: s.title, body: s.body, tags: s.tags, source: bookId, fromBook: bookId, updated: now });
    if (!cur.created) doc.created = now;
    S.entries.set(s.id, doc);
    await S.db.doc("entries/" + s.id).set(doc); n++;
  }
  const gone = [...S.entries].filter(([id, e]) => e.fromBook === bookId && !seen.has(id));
  for (const [id, e] of gone) {
    const doc = Object.assign({}, e); delete doc.fromBook; S.entries.set(id, doc);
    await S.db.doc("entries/" + id).set(doc);
    if (!quiet) toast(`“${e.title}” isn't linked to the book any more. It stays in the library as its own entry.`);
  }
  return n;
}

// ----- Reading: a small note under the heading pointing at the entry -----
function libNoteHtml(id, type) {
  const e = S.entries.get(id); if (!e || (READONLY && e.hidden)) return "";
  return `<p class="libnote"><span aria-hidden="true">📚</span> Also in the library as a <a href="#entry-${esc(id)}">${esc((TYPE[type] || TYPE.general).label.toLowerCase())} entry</a></p>`;
}
// ----- Editing: a chip under the heading -----
function libAtom(raw) {
  const m = raw.match(LIB_RE); if (!m) return "";
  const tags = m[3].split(",").map(t => t.trim()).filter(Boolean);
  return `<div class="mdblock libblock" contenteditable="false" data-md="${esc(raw.trim())}"><span class="libicon" aria-hidden="true">📚</span><span class="grow"><b>Library entry</b> <span class="pill t-${esc(m[2])}">${esc((TYPE[m[2]] || TYPE.general).label)}</span>${tags.map(t => `<span class="tag">${esc(tagName(t))}</span>`).join("")}<br><span class="muted small">Everything under this heading, down to the next heading at this level, is kept in the library. Edit it here.</span></span><button type="button" class="btn small" data-libed="edit">Change</button><button type="button" class="btn ghost small" data-libed="rm">Remove</button></div>`;
}
// The dialog for the type and tags (used to add a marker and to change one).
function libDialog(cur, title, onSave) {
  const types = TYPES.filter(t => !["creature", "spell", "subclass", "race", "class", "item", "handout", "partset", "feat"].includes(t.id));
  openModal(`<h2>${cur ? "Change the library entry" : "Make this heading a library entry"}</h2>
    <p class="muted">“${esc(title)}” and everything under it will be kept in the library, with the book as the place you write it. Saving the book updates the entry.</p>
    <div class="frow"><label><span>Type</span><select id="lb-type">${types.map(t => `<option value="${t.id}"${(cur ? cur.type : "biology") === t.id ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select></label></div>
    <div class="field"><span class="flabel">Tags</span>${tagPickHtml("lb-tags", allTagSlugs().map(s => [s, tagName(s)]), cur ? cur.tags : [], { free: true, ph: "Add a tag, e.g. dragon" })}</div>
    <div class="acts"><button class="btn ghost" type="button" data-act="closemodal">Cancel</button><button class="btn" type="button" id="lb-ok">${cur ? "Save" : "Make it an entry"}</button></div>`, m => {
    m.querySelector("#lb-ok").addEventListener("click", () => { const type = m.querySelector("#lb-type").value, tags = tagPickRead("lb-tags").map(t => allTagSlugs().includes(t) ? t : slugify(t)); closeModal(); onSave(type, tags); });
  });
}
// From the toolbar: find the heading the cursor is under and add the marker straight after it.
function beLibInsert() {
  const ed = BE.ed; if (!ed || !ed.isConnected) return;
  if (ed.hidden) { toast("Switch back from Markdown to add a library entry.", "bad"); return; }
  let n = null; const r = BE.range;
  if (r && ed.contains(r.startContainer)) { n = r.startContainer === ed ? ed.childNodes[Math.max(0, r.startOffset - 1)] : r.startContainer; while (n && n.parentNode !== ed) n = n.parentNode; }
  while (n && !/^H[1-6]$/.test(n.nodeName)) n = n.previousElementSibling;
  if (!n) { toast("Click into a heading (or the text under it) first.", "bad"); return; }
  const next = n.nextElementSibling;
  if (next && next.classList.contains("libblock")) { toast("That heading is already a library entry. Use Change on its 📚 note.", "bad"); return; }
  const title = n.textContent.trim();
  libDialog(null, title, (type, tags) => {
    const same = [...S.entries].find(([, e]) => e.type === type && e.title.trim().toLowerCase() === title.toLowerCase() && e.source === BE.id && !e.fromBook);
    const id = same ? same[0] : newId();
    const tmp = document.createElement("div"); tmp.innerHTML = libAtom(libToken(id, type, tags));
    n.after(tmp.firstElementChild);
    ed.dispatchEvent(new Event("input", { bubbles: true }));
    toast(same ? `Linked “${title}” to the library entry with the same name. The book's text is used from now on.` : `“${title}” will be in the library once the book saves.`);
  });
}
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-libed]"); if (!b) return;
  const blk = b.closest(".libblock"), m = String(blk.dataset.md || "").match(LIB_RE); if (!m) return;
  const ed = blk.closest("[contenteditable=true]") || blk.parentElement;
  if (b.dataset.libed === "rm") { blk.remove(); ed.dispatchEvent(new Event("input", { bubbles: true })); toast("Removed. The entry stays in the library, no longer linked to the book."); return; }
  let h = blk.previousElementSibling; while (h && !/^H[1-6]$/.test(h.nodeName)) h = h.previousElementSibling;
  libDialog({ type: m[2], tags: m[3].split(",").filter(Boolean) }, h ? h.textContent.trim() : "This section", (type, tags) => {
    const tmp = document.createElement("div"); tmp.innerHTML = libAtom(libToken(m[1], type, tags)); blk.replaceWith(tmp.firstElementChild);
    ed.dispatchEvent(new Event("input", { bubbles: true }));
  });
});
// "Edit" on a book-written entry opens the book at its heading.
function editInBook(id) {
  const e = S.entries.get(id); if (!e || !e.fromBook) return;
  BE.jumpTo = e.title; location.hash = "#bookedit-" + e.fromBook;
}
function beJump() {
  if (!BE.jumpTo) return;
  const t = BE.jumpTo.toLowerCase(); BE.jumpTo = null;
  setTimeout(() => {
    const h = [...document.querySelectorAll(".bookeditor .rtedit h1, .bookeditor .rtedit h2, .bookeditor .rtedit h3, .bookeditor .rtedit h4, .bookeditor .rtedit h5, .bookeditor .rtedit h6")].find(x => x.textContent.trim().toLowerCase() === t);
    if (h) { h.scrollIntoView({ block: "start", behavior: "smooth" }); h.classList.add("flash"); setTimeout(() => h.classList.remove("flash"), 2000); }
  }, 150);
}

// One-time: the biology entries copied out of books become book-written entries under their headings.
// Where the library copy had been changed, the old text is kept in settings/backup-booklib.
async function migrateBookLib() {
  if (MIG_DONE.bookLib) return;
  migrating = true;
  try {
    const backup = {}; let linked = 0;
    for (const [bid, b] of S.books) {
      let lines = String(b.body || "").split(/\r?\n/), changed = false;
      const cands = [...S.entries].filter(([, e]) => e.type === "biology" && e.source === bid && !e.fromBook);
      for (const [id, e] of cands) {
        const k = lines.findIndex(l => { const m = l.match(HEAD_RE); return m && plainHead(m[2]).toLowerCase() === e.title.trim().toLowerCase(); });
        if (k < 0 || LIB_RE.test(lines[k + 1] || "")) continue;
        lines.splice(k + 1, 0, libToken(id, e.type, e.tags || [])); changed = true; linked++;
      }
      // Compare once every marker is in, so a parent section isn't compared with its children's text in it.
      const norm = t => String(t || "").replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
      for (const sec of libSections(lines.join("\n"))) {
        const e = S.entries.get(sec.id); if (!e || !cands.some(([cid]) => cid === sec.id)) continue;
        if (norm(sec.body.replace(/\*\*In this section:\*\*.*$/, "")) !== norm(e.body)) backup[sec.id] = { title: e.title, body: e.body };
      }
      if (changed) { const doc = Object.assign({}, b, { body: lines.join("\n") }); S.books.set(bid, doc); await S.db.doc("books/" + bid).set(doc); }
    }
    for (const [bid, b] of S.books) await syncBookLib(bid, b.body, true);
    if (Object.keys(backup).length) await S.db.doc("settings/backup-booklib").set({ entries: backup, at: new Date().toISOString() });
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { bookLib: true }));
    MIG_DONE.bookLib = true;
    if (linked) toast(`${linked} biology entries are now written in their books.${Object.keys(backup).length ? ` ${Object.keys(backup).length} had library-only changes; those are backed up.` : ""}`);
  } catch (e) { console.warn("Linking book sections to the library failed", e); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}
