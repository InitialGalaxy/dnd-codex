// ---------- Rich text editing ----------
// Text is still saved as markdown, so pages, exports and library files keep working. The editor shows it
// formatted, with toolbar buttons, and turns it back into markdown as you type. Anything the toolbar can't
// make (tables, images) shows as a locked block that keeps its original text.
const RT_TOOLS = {
  full: [["b", "<b>B</b>", "Bold (Ctrl+B)"], ["i", "<i>I</i>", "Italic (Ctrl+I)"], ["s", "<s>S</s>", "Strikethrough"], ["h", "H", "Heading"], ["ul", "• List", "Bulleted list"], ["ol", "1. List", "Numbered list"], ["q", "❝", "Quote"], ["table", "▦ Table", "Insert a table"], ["link", "🔗 Entry", "Link to another entry or town"], ["aoe", "◎ AoE", "Insert an area-of-effect diagram"], ["md", "Markdown", "Edit the raw text"]],
  small: [["b", "<b>B</b>", "Bold (Ctrl+B)"], ["i", "<i>I</i>", "Italic (Ctrl+I)"], ["s", "<s>S</s>", "Strikethrough"], ["ul", "• List", "Bulleted list"], ["link", "🔗 Entry", "Link to another entry or town"], ["aoe", "◎ AoE", "Insert an area-of-effect diagram"], ["md", "Markdown", "Edit the raw text"]]
};

function rtInline(s) {
  return s
    .replace(/\\([\\`*_{}\[\]()#+\-.!|~=])/g, (m, c) => "&#" + c.charCodeAt(0) + ";")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, t, l) => `<a class="wiki" data-wiki="${t.trim()}" contenteditable="false">${(l || t).trim()}</a>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>");
}
function mdToEditable(src, base) {
  const lines = String(src || "").split(/\r?\n/);
  const out = []; let para = [], list = null;
  const flushP = () => { if (para.length) { out.push("<p>" + rtInline(para.join("\n")).replace(/\n/g, "<br>") + "</p>"); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.tag}>` + list.items.map(i => "<li>" + rtInline(i) + "</li>").join("") + `</${list.tag}>`); list = null; } };
  const atom = (raw, preview) => `<div class="mdblock" contenteditable="false" data-md="${esc(raw)}">${preview}</div>`;
  for (let k = 0; k < lines.length; k++) {
    const raw = lines[k];
    if (typeof AOE_RE !== "undefined" && AOE_RE.test(raw)) { flushP(); flushL(); out.push(aoeAtom(raw.match(AOE_RE)[1])); continue; }
    if (typeof LIB_RE !== "undefined" && LIB_RE.test(raw)) { flushP(); flushL(); out.push(libAtom(raw)); continue; }
    if (typeof EMBED_RE !== "undefined" && EMBED_RE.test(raw)) { flushP(); flushL(); out.push(embedAtom(raw.match(EMBED_RE)[1])); continue; }
    if (raw.trim().startsWith("|")) {
      const block = []; while (k < lines.length && lines[k].trim().startsWith("|")) block.push(lines[k++]); k--;
      flushP(); flushL();
      if (isStatTable(block)) out.push(atom(block.join("\n"), `<span class="mdtag">Stat block · edit in Markdown</span>` + statBlockHtml(parseStatTable(block), "")));
      else out.push(rtTableHtml(block));
      continue;
    }
    const l = esc(raw).trimEnd(); let m;
    if (!l.trim()) { flushP(); flushL(); continue; }
    if (/^!\[[^\]]*\]\([^)\s]+\)(?:\s*\{[^}]*\})?$/.test(raw.trim())) { flushP(); flushL(); const mm = raw.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)/); out.push(atom(raw.trim(), `<span class="mdtag">Image · ${esc(mm[1] || "picture")}</span>`)); continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { flushP(); flushL(); out.push("<hr>"); continue; }
    if (/^#{1,6}\s*$/.test(l.trim())) { flushP(); flushL(); continue; }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { flushP(); flushL(); const n = Math.min(6, m[1].length + base); out.push(`<h${n}>${rtInline(m[2])}</h${n}>`); continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { flushP(); if (!list || list.tag !== "ul") { flushL(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.tag !== "ol") { flushL(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = l.match(/^&gt;\s?(.*)$/))) { flushP(); flushL(); out.push("<blockquote>" + rtInline(m[1]) + "</blockquote>"); continue; }
    flushL(); para.push(l.trim());
  }
  flushP(); flushL();
  return out.join("");
}

// Tables are edited in place: a plain <table>, turned back into markdown rows.
function rtTableHtml(block) {
  const rows = block.filter(l => !/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l.trim())).map(splitRow).map(r => r.map(unescapeCell));
  const width = Math.max(1, ...rows.map(r => r.length));
  return `<table class="rttable"><tbody>${rows.map(r => "<tr>" + Array.from({ length: width }, (_, k) => `<td>${rtInline(esc(r[k] || "")) || "<br>"}</td>`).join("") + "</tr>").join("")}</tbody></table>`;
}
// HTML (from the editor, or pasted from Google Docs) back to markdown.
function editableToMd(root, base) {
  const escText = (t, atStart) => {
    let s = t.replace(/ /g, " ").replace(/([\\*~])/g, "\\$1").replace(/\[\[/g, "\\[\\[");
    if (atStart) s = s.replace(/^(\s*)([#>|-]|\d+[.)])(?=\s|$)/, "$1\\$2");
    return s;
  };
  const wrap = (mark, inner) => {
    if (!inner.trim()) return inner;
    const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
    return lead + mark + inner.trim() + mark + trail;
  };
  const inl = (n, first) => {
    if (n.nodeType === 3) return escText(n.nodeValue.replace(/[\r\n]+/g, " "), first);
    if (n.nodeType !== 1) return "";
    const tag = n.tagName, st = n.style || {};
    if (n.classList.contains("mdblock")) return n.dataset.md || "";
    if (tag === "BR") return "\n";
    if (tag === "IMG") return `![${n.alt || ""}](${n.getAttribute("src") || ""})`;
    let inner = ""; let firstChild = first;
    n.childNodes.forEach(c => { inner += inl(c, firstChild); firstChild = false; });
    if (tag === "A" && n.classList.contains("wiki")) { const t = n.dataset.wiki || n.textContent; const lbl = n.textContent.trim(); return lbl && lbl !== t ? `[[${t}|${lbl}]]` : `[[${t}]]`; }
    if (tag === "A" && /^https?:/i.test(n.getAttribute("href") || "")) return `[${inner}](${n.getAttribute("href")})`;
    const bold = tag === "B" || tag === "STRONG" || (parseInt(st.fontWeight, 10) >= 600 && tag === "SPAN") || st.fontWeight === "bold";
    const ital = tag === "I" || tag === "EM" || st.fontStyle === "italic";
    const strike = tag === "S" || tag === "DEL" || tag === "STRIKE" || /line-through/.test(st.textDecoration || st.textDecorationLine || "");
    if (strike) inner = wrap("~~", inner);
    if (ital) inner = wrap("*", inner);
    if (bold) inner = wrap("**", inner);
    return inner;
  };
  const inlineOf = el => { let s = ""; let first = true; el.childNodes.forEach(c => { s += inl(c, first); first = false; }); return s.replace(/[ \t]+\n/g, "\n").trim(); };
  const out = [];
  const BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|HR|TABLE|FIGURE|SECTION|ARTICLE|HEADER|FOOTER|PRE)$/;
  const walk = parent => {
    let pending = [];
    const flush = () => { if (pending.length) { const tmp = document.createElement("p"); pending.forEach(n => tmp.appendChild(n.cloneNode(true))); const t = inlineOf(tmp); if (t) out.push(t); pending = []; } };
    [...parent.childNodes].forEach(n => {
      if (n.nodeType === 1 && n.classList.contains("mdblock")) { flush(); out.push(n.dataset.md || ""); return; }
      if (n.nodeType !== 1 || !BLOCK.test(n.tagName)) { pending.push(n); return; }
      flush();
      const tag = n.tagName;
      if (/^H[1-6]$/.test(tag)) { const t = inlineOf(n); if (t) out.push("#".repeat(Math.max(1, Number(tag[1]) - base)) + " " + t); }
      else if (tag === "UL" || tag === "OL") { let k = 0; const items = []; n.querySelectorAll(":scope > li").forEach(li => { const t = inlineOf(li); if (t) items.push((tag === "OL" ? (++k) + ". " : "- ") + t.replace(/\n/g, " ")); }); if (items.length) out.push(items.join("\n")); }
      else if (tag === "BLOCKQUOTE") { const t = inlineOf(n); if (t) out.push(t.split("\n").map(x => "> " + x).join("\n")); }
      else if (tag === "HR") out.push("---");
      else if (tag === "TABLE") {
        const trs = [...n.querySelectorAll("tr")], width = Math.max(1, ...trs.map(tr => tr.children.length));
        const rows = trs.map(tr => "| " + Array.from({ length: width }, (_, k) => tr.children[k] ? inlineOf(tr.children[k]).replace(/\|/g, "\\|").replace(/\n/g, " ") : "").join(" | ") + " |");
        if (rows.length) out.push([rows[0], "| " + Array(width).fill("---").join(" | ") + " |", ...rows.slice(1)].join("\n"));
      }
      else if ([...n.children].some(c => BLOCK.test(c.tagName))) walk(n);
      else { const t = inlineOf(n); if (t) out.push(t); }
    });
    flush();
  };
  walk(root);
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Turn a textarea into a rich editor. The textarea stays (hidden) and keeps the markdown, so forms read it as before.
function richify(ta, opts) {
  if (!ta || ta.dataset.rich) return;
  opts = opts || {};
  const base = opts.base == null ? 2 : opts.base, tools = RT_TOOLS[opts.tools || "full"];
  ta.dataset.rich = "1";
  const lab = ta.closest("label");
  if (lab) { const d = document.createElement("div"); d.className = (lab.className + " field").trim(); while (lab.firstChild) d.appendChild(lab.firstChild); lab.replaceWith(d); }
  const wrap = document.createElement("div"); wrap.className = "rt" + (opts.tools === "small" ? " small" : "");
  const bar = document.createElement("div"); bar.className = "rtbar"; bar.setAttribute("role", "toolbar");
  bar.innerHTML = tools.map(([k, label, title]) => `<button type="button" class="rtbtn${k === "md" ? " rtmd" : ""}" data-rt="${k}" title="${title}" aria-label="${title}">${label}</button>`).join("");
  const ed = document.createElement("div"); ed.className = "rtedit prose"; ed.contentEditable = "true";
  ed.setAttribute("role", "textbox"); ed.setAttribute("aria-multiline", "true");
  if (ta.id) ed.setAttribute("aria-label", (document.querySelector(`label[for="${ta.id}"]`) || ta.closest("label") || {}).textContent || "Text");
  ed.dataset.placeholder = ta.placeholder || "";
  const minRows = Number(ta.getAttribute("rows")) || 4;
  ed.style.minHeight = (minRows * 1.6) + "em";
  ed.innerHTML = mdToEditable(ta.value, base);
  const linkRow = document.createElement("div"); linkRow.className = "rtlink"; linkRow.hidden = true;
  linkRow.innerHTML = `<input type="text" list="rt-entrylist" placeholder="Entry or town name" aria-label="Link to"><button type="button" class="btn small" data-rtl="ok">Link</button><button type="button" class="btn ghost small" data-rtl="cancel">Cancel</button>`;
  ta.hidden = true; ta.classList.add("rtsource");
  ta.after(wrap); wrap.append(bar, linkRow, ed, ta);
  const empty = () => ed.classList.toggle("is-empty", !ed.textContent.trim() && !ed.querySelector("img,.mdblock,li,table"));
  const sync = () => { ta.value = editableToMd(ed, base); empty(); ta.dispatchEvent(new Event("input", { bubbles: true })); };
  empty();
  ed.addEventListener("input", sync);
  ed.addEventListener("click", ev => {
    const b = ev.target.closest("[data-aoe]"); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const blk = b.closest(".aoeblock"), m = String(blk.dataset.md || "").match(AOE_RE);
    if (b.dataset.aoe === "rm") { blk.remove(); sync(); return; }
    aoeEdit(m ? aoeDecode(m[1]) : null, d => { const tmp = document.createElement("div"); tmp.innerHTML = aoeAtom(aoeToken(d).slice(6, -2)); blk.replaceWith(tmp.firstElementChild); sync(); });
  });
  ed.addEventListener("focus", () => { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {} });
  ed.addEventListener("paste", ev => {
    // Keep basic formatting from Google Docs and the like, drop everything else.
    const html = ev.clipboardData && ev.clipboardData.getData("text/html");
    if (!html) return;
    ev.preventDefault();
    const tmp = document.createElement("div"); tmp.innerHTML = html;
    tmp.querySelectorAll("script,style,meta,link,title").forEach(n => n.remove());
    const md = editableToMd(tmp, base);
    document.execCommand("insertHTML", false, mdToEditable(md, base));
  });
  let saved = null;
  const keepSel = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
  ed.addEventListener("keyup", keepSel); ed.addEventListener("mouseup", keepSel);
  bar.addEventListener("mousedown", ev => { if (ev.target.closest(".rtbtn") && !ev.target.closest(".rtmd")) ev.preventDefault(); });
  const blockIs = tag => { const s = getSelection(); let n = s.anchorNode; while (n && n !== ed) { if (n.nodeType === 1 && n.tagName === tag) return true; n = n.parentNode; } return false; };
  bar.addEventListener("click", ev => {
    const b = ev.target.closest(".rtbtn"); if (!b) return;
    const k = b.dataset.rt;
    if (k === "md") {
      const toRaw = ta.hidden;
      if (toRaw) { ta.hidden = false; ed.hidden = true; ta.rows = Math.max(minRows, 6); ta.focus(); b.classList.add("on"); bar.classList.add("raw"); }
      else { ed.innerHTML = mdToEditable(ta.value, base); empty(); ta.hidden = true; ed.hidden = false; b.classList.remove("on"); bar.classList.remove("raw"); ed.focus(); }
      return;
    }
    if (ed.hidden) return;
    if (k === "aoe") {
      const s = getSelection(), at = s.rangeCount && ed.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : saved;
      aoeEdit(null, d => {
        const tmp = document.createElement("div"); tmp.innerHTML = aoeAtom(aoeToken(d).slice(6, -2)); const node = tmp.firstElementChild;
        let blk = null; if (at && ed.contains(at.startContainer)) { let n = at.startContainer; if (n === ed) blk = ed.childNodes[Math.max(0, at.startOffset - 1)] || null; else { while (n && n.parentNode !== ed) n = n.parentNode; blk = n; } }
        if (blk && blk.nodeType === 1 && blk.matches("p") && !blk.textContent.trim() && !blk.querySelector("img")) blk.replaceWith(node); else if (blk) blk.after(node); else ed.appendChild(node);
        if (!node.nextElementSibling) { const p = document.createElement("p"); p.innerHTML = "<br>"; node.after(p); }
        sync();
      });
      return;
    }
    ed.focus();
    const h = "H" + Math.min(6, base + 1);
    if (k === "b") document.execCommand("bold");
    else if (k === "i") document.execCommand("italic");
    else if (k === "s") document.execCommand("strikeThrough");
    else if (k === "h") document.execCommand("formatBlock", false, blockIs(h) ? "P" : h);
    else if (k === "ul") document.execCommand("insertUnorderedList");
    else if (k === "ol") document.execCommand("insertOrderedList");
    else if (k === "q") document.execCommand("formatBlock", false, blockIs("BLOCKQUOTE") ? "P" : "BLOCKQUOTE");
    else if (k === "table") { document.execCommand("insertHTML", false, `<table class="rttable"><tbody>${"<tr><td><br></td><td><br></td><td><br></td></tr>".repeat(3)}</tbody></table><p><br></p>`); }
    else if (k === "link") {
      keepSel();
      if (!document.getElementById("rt-entrylist")) { const dl = document.createElement("datalist"); dl.id = "rt-entrylist"; document.body.appendChild(dl); }
      document.getElementById("rt-entrylist").innerHTML = [...new Set([...[...S.entries.values()].map(e => e.title), ...S.towns.map(t => t.n)])].filter(Boolean).sort(byName).map(t => `<option value="${esc(t)}"></option>`).join("");
      const inp = linkRow.querySelector("input"); inp.value = saved ? saved.toString().trim() : "";
      linkRow.hidden = false; inp.focus(); return;
    }
    sync();
  });
  const doLink = () => {
    const target = linkRow.querySelector("input").value.trim(); linkRow.hidden = true;
    if (!target) return;
    ed.focus();
    const s = getSelection(); if (saved) { s.removeAllRanges(); s.addRange(saved); }
    const label = s.toString().trim() || target;
    document.execCommand("insertHTML", false, `<a class="wiki" data-wiki="${esc(target)}" contenteditable="false">${esc(label)}</a>&nbsp;`);
    sync();
  };
  linkRow.addEventListener("click", ev => { const b = ev.target.closest("[data-rtl]"); if (!b) return; if (b.dataset.rtl === "ok") doLink(); else { linkRow.hidden = true; ed.focus(); } });
  linkRow.querySelector("input").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); doLink(); } if (ev.key === "Escape") { ev.stopPropagation(); linkRow.hidden = true; ed.focus(); } });
  ta.addEventListener("input", ev => { if (!ta.hidden && ev.isTrusted) empty(); });
  // Floating bar for the table the cursor is in.
  const tbar = document.createElement("div"); tbar.className = "rttbar"; tbar.hidden = true;
  tbar.innerHTML = [["rowup", "+ Row above"], ["rowdown", "+ Row below"], ["colleft", "+ Column left"], ["colright", "+ Column right"], ["delrow", "− Row"], ["delcol", "− Column"], ["deltable", "Delete table"]]
    .map(([k, l]) => `<button type="button" data-tb="${k}">${l}</button>`).join("");
  wrap.insertBefore(tbar, ed);
  let curCell = null;
  const cellOf = () => { const s = getSelection(); let n = s.rangeCount ? s.anchorNode : null; while (n && n !== ed) { if (n.nodeType === 1 && (n.tagName === "TD" || n.tagName === "TH")) return n; n = n.parentNode; } return null; };
  const placeBar = () => {
    const td = cellOf(); curCell = td || (tbar.contains(document.activeElement) ? curCell : null);
    if (!curCell) { tbar.hidden = true; return; }
    tbar.hidden = false;
  };
  ["keyup", "mouseup", "focus"].forEach(t => ed.addEventListener(t, placeBar));
  ed.addEventListener("blur", () => setTimeout(() => { if (!tbar.contains(document.activeElement) && !ed.contains(document.activeElement)) tbar.hidden = true; }, 150));
  tbar.addEventListener("mousedown", ev => ev.preventDefault());
  tbar.addEventListener("click", ev => {
    const b = ev.target.closest("[data-tb]"); if (!b || !curCell) return;
    const td = curCell, tr = td.parentNode, table = td.closest("table"), ci = [...tr.children].indexOf(td), k = b.dataset.tb;
    const newRow = () => { const r = document.createElement("tr"); r.innerHTML = "<td><br></td>".repeat(Math.max(1, tr.children.length)); return r; };
    if (k === "rowup") tr.before(newRow());
    else if (k === "rowdown") tr.after(newRow());
    else if (k === "colleft" || k === "colright") table.querySelectorAll("tr").forEach(row => { const c = document.createElement("td"); c.innerHTML = "<br>"; const ref = row.children[ci]; if (!ref) row.appendChild(c); else if (k === "colleft") ref.before(c); else ref.after(c); });
    else if (k === "delrow") { if (table.querySelectorAll("tr").length > 1) tr.remove(); else table.remove(); }
    else if (k === "delcol") { const rows = table.querySelectorAll("tr"); if (tr.children.length > 1) rows.forEach(row => { if (row.children[ci]) row.children[ci].remove(); }); else table.remove(); }
    else if (k === "deltable") table.remove();
    curCell = null; tbar.hidden = true; sync(); ed.focus();
  });
  return ed;
}
function richifyAll(root, sel, opts) { (root || document).querySelectorAll(sel).forEach(t => richify(t, opts)); }
