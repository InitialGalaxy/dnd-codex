// ---------- Level-up choices: subclass and Ability Score Improvements ----------
// c.subclass = "Berserker" | homebrew name
// c.asi = { "<level>": { type: "one"|"two"|"feat", a, b, feat, legacy } }
//   legacy: the pick is already counted in the base scores (sheets imported from PDFs).
const ABIL_SHORT = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
function asiDeltas(c) {
  const d = {};
  for (const [, p] of Object.entries(c.asi || {})) {
    if (!p || p.legacy) continue;
    if (p.type === "one" && p.a) d[p.a] = (d[p.a] || 0) + 2;
    if (p.type === "two") { if (p.a) d[p.a] = (d[p.a] || 0) + 1; if (p.b) d[p.b] = (d[p.b] || 0) + 1; }
  }
  return d;
}
function cScore(c, a) {
  const base = Number((c.abilities || {})[a]) || 10, add = asiDeltas(c)[a] || 0;
  return add ? Math.max(base, Math.min(20, base + add)) : base;
}
function asiText(p) {
  if (!p || !p.type) return "Not chosen";
  if (p.type === "one") return p.a ? `+2 ${ABIL_SHORT[p.a]}` : "+2 to one ability";
  if (p.type === "two") return [p.a, p.b].filter(Boolean).map(x => `+1 ${ABIL_SHORT[x]}`).join(", ") || "+1 to two abilities";
  return p.feat ? `Feat: ${p.feat}` : "Feat";
}
// The homebrew subclass a character has: linked by id, or matched by name for sheets made before the link existed.
function charSubclassEntry(c) {
  if (c.subclassRef && S.entries.has(c.subclassRef)) return [c.subclassRef, S.entries.get(c.subclassRef)];
  const n = String(c.subclass || "").trim().toLowerCase(); if (!n) return null;
  const cls = detectSrdClass(c), is = e => String(e.title).trim().toLowerCase() === n || String((e.subclass || {}).alias || "").toLowerCase() === n;
  return homebrewSubclasses(cls).find(([, e]) => is(e)) || homebrewSubclasses("").find(([, e]) => is(e)) || null;
}
// One block per class: a multiclassed character makes each class's choices at that class's own levels. The first class
// keeps its subclass in c.subclass and its improvements under plain levels in c.asi; the others keep theirs on their
// row of c.classList and under "<class>:<level>".
function levelupHtml(c, id, E, P) {
  const L = typeof charClasses === "function" ? charClasses(c) : [];
  const blocks = (L.length > 1 ? L.map((x, i) => i) : [0]).map(i => levelupBlock(c, id, E, P, i)).join("");
  return blocks ? blocks + `<datalist id="srdfeats">${featEntries().map(([, fe]) => `<option value="${esc(fe.title)}">${esc([fe.feat && fe.feat.kind, fe.feat && fe.feat.prereq].filter(Boolean).join(" · "))}</option>`).join("") || `<option value="Grappler"></option>`}</datalist>` : "";
}
function levelupBlock(c, id, E, P, i) {
  const L = typeof charClasses === "function" ? charClasses(c) : [], x = L[i] || {}, multi = L.length > 1;
  const cls = i === 0 ? detectSrdClass(c) : x.name, d = classFeats(cls), lvl = multi ? Number(x.level) || 1 : Number(c.level) || 1;
  if (!d) return E && i === 0 ? `<p class="muted small">Level-up choices appear once the class is one from the source books or your library.</p>` : "";
  const abilOpts = (sel, none) => `${none ? `<option value="">${none}</option>` : ""}${ABILS.map(([k, l]) => `<option value="${k}"${sel === k ? " selected" : ""}>${l}</option>`).join("")}`;
  const srdSub = d.subs[0], sub = String((i === 0 ? c.subclass : x.subclass) || ""), hb = i === 0 ? charSubclassEntry(c) : subEntryOf(cls, x.subclass, x.subclassRef), hbs = homebrewSubclasses(cls);
  const isOther = i === 0 && sub && sub !== srdSub && !hb, key = L2 => i === 0 ? String(L2) : cls + ":" + L2;
  const hbFeats = hb ? subclassFeatures(hb[1]) : [];
  const hbLine = hb && hbFeats.length ? `<p class="muted small lvhb">${esc(hb[1].title)}: ${hbFeats.map(f => `<span class="${(Number(f.lv) || 1) <= lvl ? "" : "later"}">${lvOrd(f.lv)} ${esc(f.n)}</span>`).join(" · ")} <a href="#entry-${esc(hb[0])}">Read it →</a></p>` : "";
  const subRow = lvl >= d.subLv ? `<div class="lvrow"><span class="lvlv">Level ${d.subLv}</span><span class="lvname">${esc(d.flavor)}</span>
      ${P ? `<select ${i === 0 ? `data-lvsub="1"` : `data-lvsubi="${i}"`} aria-label="${esc(d.flavor)}"><option value="">Not chosen</option>${srdSub && !hbs.some(([, he]) => (he.subclass || {}).alias === srdSub || he.title === srdSub) ? `<option value="${esc(srdSub)}"${sub === srdSub && !hb ? " selected" : ""}>${esc(srdSub)} (SRD)</option>` : ""}${hbs.length ? `<optgroup label="From your library">${hbs.map(([hid, he]) => `<option value="hb:${esc(hid)}"${hb && hb[0] === hid ? " selected" : ""}>${esc(he.title)}</option>`).join("")}</optgroup>` : ""}<option value="__other"${isOther ? " selected" : ""}>Something else…</option></select>
        ${isOther || (CS.subOther && i === 0) ? cField("subclass", isOther ? sub : "", { ph: "Subclass name", cls: "mid" }) : ""}` : `<strong>${hb ? `<a href="#entry-${esc(hb[0])}">${esc(hb[1].title)}</a>` : esc(sub || "Not chosen")}</strong>`}</div>${hbLine}` : "";
  const slots = d.asi.filter(L => L <= lvl).map(L => {
    const p = (c.asi || {})[key(L)] || {};
    return `<div class="lvrow"><span class="lvlv">Level ${L}</span><span class="lvname">Ability Score Improvement</span>
      ${P ? `<select data-asi="${key(L)}" data-part="type" aria-label="Level ${L} improvement"><option value="">Not chosen</option><option value="one"${p.type === "one" ? " selected" : ""}>+2 to one ability</option><option value="two"${p.type === "two" ? " selected" : ""}>+1 to two abilities</option><option value="feat"${p.type === "feat" ? " selected" : ""}>A feat</option></select>
        ${p.type === "one" ? `<select data-asi="${key(L)}" data-part="a">${abilOpts(p.a, "Ability…")}</select>` : ""}
        ${p.type === "two" ? `<select data-asi="${key(L)}" data-part="a">${abilOpts(p.a, "First…")}</select><select data-asi="${key(L)}" data-part="b">${abilOpts(p.b, "Second…")}</select>` : ""}
        ${p.type === "feat" ? `<input type="text" data-asi="${key(L)}" data-part="feat" value="${esc(p.feat || "")}" placeholder="Feat name" list="srdfeats">` : ""}
        ${p.type && p.type !== "feat" && E ? `<label class="check inline small"><input type="checkbox" data-asi="${key(L)}" data-part="legacy"${p.legacy ? " checked" : ""}> already in the scores</label>` : ""}
        ${p.legacy && !E ? `<span class="muted small">already in the scores</span>` : ""}`
      : `<strong>${esc(asiText(p))}</strong>`}</div>`;
  }).join("");
  const next = d.asi.find(L => L > lvl);
  return `<div class="levelup"><h3 class="fgh">Level-up choices <span class="muted">${esc(cls)}${multi ? " " + lvl : ""}</span></h3>${subRow}${slots || `<p class="muted small">No Ability Score Improvements yet.</p>`}
    ${next ? `<p class="muted small">Next Ability Score Improvement at ${multi ? esc(cls) + " " : ""}level ${next}.</p>` : ""}</div>`;
}
// Change handler for the level-up selects.
function levelupInput(t) {
  const sh = t.closest(".sheet"); if (!sh) return false;
  const id = sh.dataset.id;
  if (t.dataset.lvsubi) { const i = Number(t.dataset.lvsubi), v = t.value;
    charChange(id, x => { const L = charClasses(x).map(q => Object.assign({}, q)); if (!L[i]) return; delete L[i].subclassRef;
      if (v.startsWith("hb:")) { const he = S.entries.get(v.slice(3)); L[i].subclassRef = v.slice(3); L[i].subclass = he ? he.title : ""; } else L[i].subclass = v === "__other" ? "" : v; x.classList = L; }); return true; }
  if (t.dataset.lvsub) {
    if (t.value === "__other") { CS.subOther = true; charChange(id, x => { delete x.subclassRef; if (x.subclass && charSubclassEntry(x)) x.subclass = ""; }, false); render(); setTimeout(() => { const i = document.getElementById("cf-subclass"); if (i) i.focus(); }, 30); return true; }
    CS.subOther = false;
    if (t.value.startsWith("hb:")) { const hid = t.value.slice(3), he = S.entries.get(hid); charChange(id, x => { x.subclassRef = hid; x.subclass = he ? he.title : x.subclass; }); return true; }
    charChange(id, x => { x.subclass = t.value; delete x.subclassRef; }); return true;
  }
  if (t.dataset.asi) {
    const L = t.dataset.asi, part = t.dataset.part, v = t.type === "checkbox" ? t.checked : t.value;
    charChange(id, x => {
      x.asi = Object.assign({}, x.asi); const p = Object.assign({}, x.asi[L]);
      if (part === "type") { const was = p.type; p.type = v; if (was !== v) { delete p.a; delete p.b; } if (v !== "feat") delete p.feat; }
      else p[part] = v;
      if (!p.type) delete x.asi[L]; else x.asi[L] = p;
      // A feat pick also shows up in Features, so its description can be written there.
      x.features = (x.features || []).filter(f => f.asi !== L);
      if (p.type === "feat" && String(p.feat || "").trim()) { const fe = featByName(p.feat), nf = { name: fe ? fe[1].title : p.feat.trim(), source: "Feat", note: `${String(L).includes(":") ? String(L).replace(":", " level ") : "level " + L} improvement`, desc: fe ? fe[1].body || "" : "", asi: L }; if (fe) nf.ref = fe[0]; x.features.push(nf); }
    }, part !== "feat");
    return true;
  }
  return false;
}
