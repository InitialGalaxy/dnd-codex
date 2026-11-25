// ===== Campaigns: each campaign's own page, with its map (optional) and the way into its tabletop =====
// camp.desc   a few words about the campaign
// camp.map    "" none, "world" the imported world map (Azgaar), or "img:<path>" a picture (a region map, say)
// camp.party  the characters in it (ids); until it's set, whoever has a token on one of its maps
const vCampList = () => [...(S.vttCamps || new Map())].filter(([, c]) => !c.workshop).sort((a, b) => String(a[1].name).localeCompare(b[1].name));
function campParty(id) {
  const c = S.vttCamps.get(id) || {}, ok = cid => { const ch = S.chars.get(cid); return ch && (!ch.hidden || !READONLY); };
  if (Array.isArray(c.party)) return c.party.filter(ok);
  const pages = new Set(vPages(id).map(([pid]) => pid)), out = new Set();
  for (const [, t] of S.vttTokens || []) if (pages.has(t.page) && t.owner && vPlayerTok(t) && ok(t.owner)) out.add(t.owner);
  return [...out].sort((a, b) => byName(S.chars.get(a).name || "", S.chars.get(b).name || ""));
}
// What's happening at the table right now, in a few short lines.
function campNow(id) {
  const c = S.vttCamps.get(id) || {}, out = [], pg = c.playerPage && S.vttPages && S.vttPages.get(c.playerPage);
  if (pg) out.push(["🗺", `The party is on <strong>${esc(pg.name || "a map")}</strong>`]);
  for (const [pid, p] of vPages(id)) { const j = p.journey || {}; if (!j.started || !Array.isArray(j.hrs)) continue;
    const total = j.hrs.reduce((a, b) => a + b, 0), days = Math.max(1, Math.ceil(total / 8 - 1e-9)), d = Number(j.day) || 0;
    out.push(["🧭", d >= days ? `Arrived at the end of the route on <strong>${esc(p.name)}</strong>` : `Travelling on <strong>${esc(p.name)}</strong>: ${d ? `day ${d} of ${days}` : `setting off, ${days} day${days === 1 ? "" : "s"} to go`}`]); }
  const I = vInitOf(id); if (I.round) { const e = I.list.find(x => x.id === I.cur); out.push(["⚔", `In a fight: round ${I.round}${e ? `, <strong>${esc(e.name || "?")}</strong>'s turn` : ""}`]); }
  const q = vQuests(id).filter(x => x.status === "active" && (!x.hidden || vCanEdit())); if (q.length) out.push(["📜", `${q.length} open quest${q.length === 1 ? "" : "s"}: ${q.slice(0, 3).map(x => esc(x.title || "Quest")).join(", ")}${q.length > 3 ? "…" : ""}`]);
  return out;
}
function viewCampaigns() {
  const camps = vCampList(), gm = vCanEdit();
  return `<section class="page"><div class="phead"><h1>Campaigns</h1>${gm ? `<button class="btn" data-act="vttnewcamp">+ New campaign</button>` : ""}</div>
    <p class="muted">${gm ? "Each campaign has its own page, its map if it has one, and its tabletop." : "Pick your campaign."}</p>
    ${camps.length ? `<div class="campcards">${camps.map(([id, c]) => { const party = campParty(id), now = campNow(id);
      return `<article class="campcard"><a href="#camp-${esc(id)}" class="campcardlink">
        <div class="campthumb">${c.map === "world" && S.meta ? worldSvg({ thumb: true }) : String(c.map || "").startsWith("img:") ? `<img src="${esc(c.map.slice(4))}" alt="">` : `<span class="campinit">${esc((c.name || "?")[0])}</span>`}</div>
        <div class="campcardbody"><h2>${esc(c.name || "Campaign")}</h2>${c.desc ? `<p class="muted small">${esc(String(c.desc).split("\n")[0].replace(/[*_`#>]|\[\[|\]\]/g, "").slice(0, 140))}</p>` : ""}
          ${party.length ? `<div class="campfaces">${party.slice(0, 8).map(cid => { const ch = S.chars.get(cid); return ch.image ? `<img src="${esc(ch.image)}" alt="${esc(ch.name)}" title="${esc(ch.name)}">` : `<span class="pcinit" title="${esc(ch.name)}">${esc((ch.name || "?")[0])}</span>`; }).join("")}</div>` : ""}
          ${now[0] ? `<p class="small campnow1">${now[0][0]} ${now[0][1]}</p>` : ""}</div></a>
        <div class="campcardacts"><a class="btn small" href="#vtt-${esc(id)}">Enter tabletop</a>${gm ? `<button class="btn ghost small" data-act="vttrencamp" data-id="${esc(id)}">Rename</button><button class="btn ghost small danger" data-act="vttdelcamp" data-id="${esc(id)}">Delete</button>` : ""}</div></article>`; }).join("")}</div>`
      : `<div class="empty">${gm ? "No campaigns yet. Make one to get started." : "The GM hasn't set up a campaign yet."}</div>`}</section>`;
}
function viewCampPage(id) {
  const c = S.vttCamps && S.vttCamps.get(id);
  if (!c) return `<section class="page"><p class="muted">${S.vttCamps ? "That campaign isn't here any more." : "Opening the campaign…"}</p><p><a href="#campaigns">All campaigns</a></p></section>`;
  const gm = vCanEdit(), party = campParty(id), now = S.vttPages ? campNow(id) : [], pages = S.vttPages ? vPages(id) : [];
  const shown = gm ? pages.length : pages.filter(([pid, p]) => p.open || c.playerPage === pid).length;
  const faces = party.map(cid => { const ch = S.chars.get(cid); return `<a class="campmember" href="#char-${esc(cid)}">${ch.image ? `<img src="${esc(ch.image)}" alt="">` : `<span class="pcinit">${esc((ch.name || "?")[0])}</span>`}
      <span class="campmname">${esc(ch.name || "?")}</span><span class="muted small">${esc(charSub(ch) || "")}</span>${hpBar(ch)}<span class="small campmhp">HP ${Number(ch.hp && ch.hp.cur) || 0}/${Number(ch.hp && ch.hp.max) || 0}</span></a>`; }).join("");
  let map = "";
  if (c.map === "world") map = S.meta ? `<div class="campmap">${worldSvg({})}<p><a href="#world">Open the world map: ${esc(S.meta.name)} →</a></p></div>` : gm ? `<p class="muted small">This campaign uses the world map, but none is imported yet. Import it from More → World map.</p>` : "";
  else if (String(c.map || "").startsWith("img:")) map = `<div class="campmap"><a href="${esc(c.map.slice(4))}" target="_blank" rel="noopener"><img src="${esc(c.map.slice(4))}" alt="${esc(c.name)} map"></a></div>`;
  return `<section class="page camppage">
    <div class="phead"><div><a href="#campaigns" class="vback">← Campaigns</a><h1>${esc(c.name || "Campaign")}</h1></div>${gm ? `<div class="campacts"><a class="btn" href="#gen-${esc(id)}">🏗 Generator</a><button class="btn ghost" data-act="campedit" data-id="${esc(id)}">Edit campaign</button></div>` : ""}</div>
    ${c.desc ? `<div class="campdesc">${md(c.desc)}</div>` : gm ? `<p class="muted small">Add a few words about this campaign, its map and its party with Edit campaign.</p>` : ""}
    <div class="campenter">
      <div class="campenterhead"><span class="eyebrow">Tabletop</span><a class="campenterlink" href="#vtt-${esc(id)}"><strong>Enter the tabletop →</strong></a><span class="muted small">${shown} map${shown === 1 ? "" : "s"}</span></div>
      ${now.length ? `<ul class="campnow">${now.map(([i, t]) => `<li><span aria-hidden="true">${i}</span> ${t}</li>`).join("")}</ul>` : `<p class="muted small">Nothing under way yet.</p>`}
      ${party.length ? `<div class="campparty">${faces}</div>` : `<p class="muted small">${gm ? "No party yet: put the players' tokens on a map, or pick them with Edit campaign." : "No party yet."}</p>`}
    </div>
    ${map}
  </section>`;
}
function campEdit(id) {
  const c = S.vttCamps.get(id); if (!c) return;
  const kind = c.map === "world" ? "world" : String(c.map || "").startsWith("img:") ? "img" : "", img = kind === "img" ? c.map.slice(4) : "";
  const auto = !Array.isArray(c.party), party = new Set(campParty(id)), chars = [...S.chars].sort((a, b) => byName(a[1].name || "", b[1].name || ""));
  openModal(`<h2>Edit campaign</h2><form class="campform">
    <label><span>Name</span><input id="cp-name" type="text" value="${esc(c.name || "")}"></label>
    <label><span>About it <small class="muted">optional, shown on its page</small></span><textarea id="cp-desc" rows="3">${esc(c.desc || "")}</textarea></label>
    <fieldset><legend>Map <small class="muted">optional</small></legend>
      <label class="check"><input type="radio" name="cp-map" value=""${kind === "" ? " checked" : ""}> No map</label>
      <label class="check"><input type="radio" name="cp-map" value="world"${kind === "world" ? " checked" : ""}${S.meta ? "" : " disabled"}> The world map${S.meta ? `: ${esc(S.meta.name)}` : " <small class=\"muted\">(none imported yet)</small>"}</label>
      <label class="check"><input type="radio" name="cp-map" value="img"${kind === "img" ? " checked" : ""}> A picture <small class="muted">a region map, say</small></label>
      <div class="frow" id="cp-imgrow"${kind === "img" ? "" : " hidden"}><input id="cp-img" type="text" value="${esc(img)}" placeholder="Upload one, or paste a link" class="grow">${S.assets ? `<button class="btn ghost small" type="button" id="cp-up">Upload</button>` : ""}</div></fieldset>
    <fieldset><legend>Party</legend>
      <label class="check"><input type="checkbox" id="cp-auto"${auto ? " checked" : ""}> Whoever has a token on one of its maps</label>
      <div class="cpchars" id="cp-chars"${auto ? " hidden" : ""}>${chars.map(([cid, ch]) => `<label class="check"><input type="checkbox" data-cpchar="${esc(cid)}"${party.has(cid) ? " checked" : ""}> ${esc(ch.name || "?")}${ch.hidden ? ` <small class="muted">hidden</small>` : ""}</label>`).join("") || `<p class="muted small">No characters yet.</p>`}</div></fieldset>
    <div class="acts"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" id="cp-no">Cancel</button></div></form>`, m => {
    const row = m.querySelector("#cp-imgrow"); m.querySelectorAll("[name=cp-map]").forEach(r => r.onchange = () => { row.hidden = m.querySelector("[name=cp-map]:checked").value !== "img"; });
    m.querySelector("#cp-auto").onchange = ev => { m.querySelector("#cp-chars").hidden = ev.target.checked; };
    const up = m.querySelector("#cp-up"); if (up) up.onclick = () => pickImage(res => { m.querySelector("#cp-img").value = assetPath(res); });
    m.querySelector("#cp-no").onclick = closeModal;
    m.querySelector("form").onsubmit = ev => {
      ev.preventDefault(); const kindNow = m.querySelector("[name=cp-map]:checked").value, im = m.querySelector("#cp-img").value.trim();
      const f = { name: m.querySelector("#cp-name").value.trim() || c.name, desc: m.querySelector("#cp-desc").value.trim(), map: kindNow === "world" ? "world" : kindNow === "img" && im ? "img:" + im : "" };
      f.party = m.querySelector("#cp-auto").checked ? null : [...m.querySelectorAll("[data-cpchar]:checked")].map(x => x.dataset.cpchar);
      closeModal(); vPatch("vttcamps/" + id, f);
    };
  });
}
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-act=campedit]"); if (b && vCanEdit()) { ev.preventDefault(); campEdit(b.dataset.id); } });
