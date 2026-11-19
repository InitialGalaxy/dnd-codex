// ---------- Virtual tabletop ----------
// Collections:
//   vttcamps/<id>  { name, created, playerPage }                      a campaign; playerPage is the page players see
//   vttpages/<id>  { camp, name, order, w, h, bg, grid, light, fogMem, objs: [image], walls: [[x1,y1,x2,y2]] }
//                  image: { id, layer: "map"|"gm"|"token", img, x, y, w, h }      all sizes in grid squares
//   vtttokens/<id> { page, layer: "token"|"gm", x, y, size, img, name, ref, owner }  ref "e:<entry>" / "c:<character>"
//   vttfog/<page>  { w, h, res, bits }                                 squares players' tokens have seen (base64)
// Players only receive what's on the map and token layers; they can drag tokens owned by a character and add to the fog.
const VCELL = 70, VFOG_RES = 4;
const VTT = { multi: new Set(), lvl: 0, mshape: "line", mbeam: 5, meas: null, camp: null, page: null, layer: "token", tool: "select", zoom: 1, panX: 40, panY: 40, sel: null, draft: null, hover: null, preview: false, fogBits: null, fogKey: "", fogTimer: 0, mountedKey: "", fitDone: "" };
const vid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const vPages = camp => [...(S.vttPages || new Map())].filter(([, p]) => p.camp === camp).sort((a, b) => (a[1].order || 0) - (b[1].order || 0) || String(a[1].name).localeCompare(b[1].name));
const vTokens = page => [...(S.vttTokens || new Map())].filter(([, t]) => t.page === page);
const vCanEdit = () => !READONLY;
const vTokenImg = ref => {
  if (!ref) return "";
  if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)); return e ? (e.token || e.image || "") : ""; }
  if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)); return c ? (c.token || c.image || "") : ""; }
  if (ref.startsWith("s:")) {
    // A summon: the creature it has shapeshifted into, else its own token picture, else its creature's.
    const sm = vSummonOf(ref); if (!sm) return "";
    const f = sm.form && S.entries.get(sm.form); if (f) return f.token || f.image || "";
    if (sm.token) return sm.token;
    const e = sm.ref && S.entries.get(sm.ref); return e ? (e.token || e.image || "") : "";
  }
  return "";
};
const vSummonOf = ref => { const [, cid, sid] = String(ref).split(":"), c = S.chars.get(cid); return c ? smList(c).find(x => x.id === sid) || null : null; };
// What a token looks like right now: a creature token in another form shows that form.
function vTokSrc(t) {
  if ((t.ref || "").startsWith("s:") && !t.img) { const sm = vSummonOf(t.ref), f = sm && sm.form && typeof ssSummonForm === "function" && S.entries.get(sm.form); if (f && (f.token || f.image)) return f.token || f.image; }
  const f = t.form && S.entries.get(t.form); return f ? (f.token || f.image || t.img || vTokenImg(t.ref)) : (t.img || vTokenImg(t.ref)); }
const vSizeOf = e => ({ Large: 2, Huge: 3, Gargantuan: 4 })[typeof creatureSize === "function" ? creatureSize(e) : ""] || 1;
function vSave(path, doc) { return safeWrite(() => S.db.doc(path).set(doc)); }
function vPatch(path, fields) { return safeWrite(() => S.db.doc(path).update(fields)); }
function vDel(path) { return safeWrite(() => S.db.doc(path).delete()); }

// ----- The campaign list -----
function viewVtt() {
  const camps = [...(S.vttCamps || new Map())].sort((a, b) => String(a[1].name).localeCompare(b[1].name));
  return `<section class="page"><div class="phead"><h1>Tabletop</h1>${vCanEdit() ? `<button class="btn" data-act="vttnewcamp">+ New campaign</button>` : ""}</div>
    <p class="muted">${vCanEdit() ? "Each campaign holds its maps (pages). Open one to build boards, place tokens from the bestiary and draw walls for line of sight." : "Pick your campaign to join the table. You'll see the page the GM has sent the players to."}</p>
    ${camps.length ? `<div class="vcamps">${camps.map(([id, c]) => { const pages = vPages(id); return `<article class="vcamp"><a href="#vtt-${esc(id)}"><h2>${esc(c.name || "Campaign")}</h2>
      <p class="muted small">${pages.length} page${pages.length === 1 ? "" : "s"}${c.playerPage && S.vttPages && S.vttPages.get(c.playerPage) ? ` · players on <strong>${esc(S.vttPages.get(c.playerPage).name)}</strong>` : ""}</p></a>
      ${vCanEdit() ? `<div class="vcampacts"><button class="btn ghost small" data-act="vttrencamp" data-id="${esc(id)}">Rename</button><button class="btn ghost small danger" data-act="vttdelcamp" data-id="${esc(id)}">Delete</button></div>` : ""}</article>`; }).join("")}</div>`
      : `<div class="empty">${vCanEdit() ? "No campaigns yet. Make one to start building maps." : "The GM hasn't set up a campaign yet."}</div>`}</section>`;
}
async function vNewPage(camp, name, order, folder) {
  const id = vid("p");
  await vSave("vttpages/" + id, { camp, name: name || "Page 1", order: order || 0, folder: folder || "", open: false, w: 15, h: 15, bg: "#1b1f27", grid: true, light: false, fogMem: true, objs: [], walls: [], created: new Date().toISOString() });
  return id;
}
async function vttCampAction(a, el) {
  if (a === "vttnewcamp") {
    const name = await vAsk("New campaign", "Name", "", "Create"); if (!name) return;
    const id = vid("c");
    await vSave("vttcamps/" + id, { name, created: new Date().toISOString() });
    const pid = await vNewPage(id, "Page 1", 0);
    await vPatch("vttcamps/" + id, { playerPage: pid });
    location.hash = "vtt-" + id;
  } else if (a === "vttrencamp") {
    const c = S.vttCamps.get(el.dataset.id); if (!c) return;
    const name = await vAsk("Rename campaign", "Name", c.name, "Save"); if (name) vPatch("vttcamps/" + el.dataset.id, { name });
  } else if (a === "vttdelcamp") {
    const id = el.dataset.id, c = S.vttCamps.get(id); if (!c) return;
    if (!(await confirmBox(`Delete “${c.name}” with all its pages and tokens?`, "Delete campaign"))) return;
    for (const [pid] of vPages(id)) { for (const [tid] of vTokens(pid)) await vDel("vtttokens/" + tid); await vDel("vttpages/" + pid); await vDel("vttfog/" + pid).catch(() => {}); }
    await vDel("vttcamps/" + id);
  }
}
function vAsk(title, label, value, yes) {
  return new Promise(res => {
    openModal(`<h2>${esc(title)}</h2><form class="vask"><label><span>${esc(label)}</span><input id="vaskv" type="text" value="${esc(value || "")}"></label>
      <div class="acts"><button class="btn" type="submit">${esc(yes)}</button><button class="btn ghost" type="button" id="vaskno">Cancel</button></div></form>`, m => {
      m.querySelector("form").onsubmit = ev => { ev.preventDefault(); const v = m.querySelector("#vaskv").value.trim(); closeModal(); res(v); };
      m.querySelector("#vaskno").onclick = () => { closeModal(); res(""); };
      setTimeout(() => { const i = m.querySelector("#vaskv"); if (i) { i.focus(); i.select(); } }, 0);
    });
  });
}

// ----- A campaign's board -----
function vCurrentPage(camp) {
  const c = S.vttCamps.get(camp); if (!c) return null;
  if (PLAYER || READONLY) {
    // Players are on the GM's page unless they've switched to a map the GM has opened to them. Sending them somewhere new brings them back.
    const ok = id => id && S.vttPages.has(id) && S.vttPages.get(id).camp === camp && (S.vttPages.get(id).open || c.playerPage === id);
    if (VTT.lastPP !== c.playerPage) { VTT.lastPP = c.playerPage; VTT.ppage = null; }
    VTT.camp = camp;
    return ok(VTT.ppage) ? VTT.ppage : ok(c.playerPage) ? c.playerPage : null;
  }
  if (VTT.camp !== camp || !VTT.page || !S.vttPages.has(VTT.page)) { const pages = vPages(camp); VTT.page = (c.playerPage && S.vttPages.has(c.playerPage)) ? c.playerPage : pages[0] ? pages[0][0] : null; }
  VTT.camp = camp;
  return VTT.page;
}
function viewVttCamp(camp) {
  const c = S.vttCamps && S.vttCamps.get(camp);
  if (!c) return `<section class="page"><p class="muted">${S.vttCamps ? "That campaign isn't here any more." : "Opening the table…"}</p><p><a href="#vtt">All campaigns</a></p></section>`;
  const pid = vCurrentPage(camp), p = pid && S.vttPages.get(pid);
  const gm = vCanEdit();
  const avail = gm ? [] : vPages(camp).filter(([id, pg]) => pg.open || c.playerPage === id);
  const tabs = gm ? `<button class="btn ghost small${VTT.mapsOpen ? " on" : ""}" data-act="vttmaps" aria-expanded="${!!VTT.mapsOpen}">🗺 Maps</button>${p ? `<span class="vcurpage">${esc(vFolderPath(c, p.folder))}<strong>${esc(p.name || "Map")}</strong></span>` : ""}`
    : avail.length > 1 ? `<label class="vpsel"><span class="sr">Map</span><select id="vpsel">${avail.map(([id, pg]) => `<option value="${esc(id)}"${id === pid ? " selected" : ""}>${c.playerPage === id ? "★ " : ""}${esc(vFolderPath(c, pg.folder) + (pg.name || "Map"))}</option>`).join("")}</select></label>${pid !== c.playerPage && c.playerPage ? `<button class="btn ghost small" data-act="vttgoparty">★ Back to the party</button>` : ""}`
    : p ? `<span class="vcurpage"><strong>${esc(p.name || "Map")}</strong></span>` : "";
  return `<section class="vtt" data-camp="${esc(camp)}">
    <div class="vttbar"><a href="#vtt" class="vback">← Campaigns</a><h1>${esc(c.name)}</h1>${tabs}
      ${p && gm ? `<button class="btn ghost small${VTT.initOpen ? " on" : ""}" data-act="vttinitopen" aria-expanded="${!!VTT.initOpen}">⚔ Turn order</button>` : ""}${gm && p ? `<button class="btn ghost small" data-act="vttcondlib">✦ Conditions</button><button class="btn ghost small${VTT.questOpen ? " on" : ""}" data-act="vttqopen" aria-expanded="${!!VTT.questOpen}">📜 Quests</button>` : ""}
      ${gm && p ? `<div class="vbaracts">${c.playerPage === pid ? `<span class="vpill">★ Players are here</span>` : `<button class="btn small" data-act="vttsend">Send players here</button>`}<button class="btn ghost small" data-act="vttsettings">Page settings</button></div>` : ""}</div>
    ${gm && VTT.mapsOpen ? `<div class="vmaps" id="vmaps">${vMapsHtml(camp)}</div>` : ""}
    ${p ? `<div class="vttwrap">${gm ? `<div class="vtools" id="vtools">${vToolsHtml()}</div>` : ""}
      <div class="vview" id="vview" tabindex="0" aria-label="Board"><div class="vstage" id="vstage"></div>
        ${gm ? "" : `<div class="vptools" id="vptools">${vMeasToolsHtml(false)}</div>`}
        <div class="vzoom"><button class="iconbtn" data-act="vttzoom" data-v="-1" aria-label="Zoom out">−</button><button class="iconbtn" data-act="vttzoom" data-v="0" aria-label="Fit board">⤢</button><button class="iconbtn" data-act="vttzoom" data-v="1" aria-label="Zoom in">+</button></div>
        <canvas class="vfxp" id="vfxp" aria-hidden="true"></canvas>
        <div class="vturns" id="vturns"></div>
        <div class="vquests" id="vquests"></div>
        <div class="vhint" id="vhint"></div><div class="vfloors" id="vfloors" role="group" aria-label="Which floor to show"></div></div>
      <aside class="vside" id="vside"></aside></div>`
      : `<div class="empty">${gm ? "This campaign has no pages yet." : "The GM hasn't opened a page for the players yet."}</div>`}
  </section>`;
}
function vToolsHtml() {
  const L = [["map", "Map", "Battle maps and backgrounds, under the grid"], ["token", "Tokens", "Creatures and things players can see"], ["gm", "GM", "Only you can see these"], ["walls", "Walls", "Lines that block sight"], ["lights", "Lights", "Torches, lanterns and glows: click to place one, drag to move it"]];
  const T = [["select", "↖", "Select and move (V)"], ["pan", "✋", "Pan (H, or drag empty space)"], ["measure", "📏", "Measure (M)"], ["wall", "╱", "Draw walls (W): click points, double-click or Enter to finish"], ["area", "▦", "Raised squares (A): drag over the squares that are up on the level you're editing (a rooftop or upper floor). Alt-drag to remove squares."], ["link", "⇅", "Stairs or lift (S): drag over the squares; tokens standing there get a button to change level"], ["draw", "✏️", "Draw (D): doodle on the map for everyone to see"], ["scale", "📐", "Travel scale: drag a line and say how much travel it is (e.g. one day)"], ["travel", "🧭", "Travel (T): click out a route to see how long it takes; double-click or Enter to finish"], ["ping", "📍", "Ping (P): click to flash a spot for everyone; Shift-click to move everyone's view there. Or hold the mouse still on the map anywhere."]];
  return `<div class="vgroup"><span class="vlab">Layer</span>${L.map(([v, l, t]) => `<button class="vbtn${VTT.layer === v ? " on" : ""}" data-act="vttlayer" data-v="${v}" title="${t}" aria-pressed="${VTT.layer === v}">${l}</button>`).join("")}</div>
    <div class="vgroup"><span class="vlab">Tool</span>${T.map(([v, l, t]) => `<button class="vbtn icon${VTT.tool === v ? " on" : ""}" data-act="vtttool" data-v="${v}" title="${t}" aria-label="${t}" aria-pressed="${VTT.tool === v}">${l}</button>`).join("")}</div>
    ${vLevelToolsHtml()}
    ${vMeasToolsHtml(true)}
    ${VTT.tool === "draw" ? `<div class="vgroup"><span class="vlab">Pen</span>${vPenHtml(true)}</div>` : ""}
    ${VTT.tool === "travel" || VTT.tool === "scale" ? `<div class="vgroup"><span class="vlab">${VTT.tool === "scale" ? "Scale" : "Travel"}</span>${vTravelToolsHtml(true)}</div>` : ""}
    ${VTT.tool === "wall" ? `<div class="vgroup"><span class="vlab">Draw as</span><div class="seg vwk">${[["wall", "Wall"], ["door", "🚪 Door"], ["window", "🪟 Window"]].map(([v, l]) => `<button class="${(VTT.wallKind || "wall") === v ? "on" : ""}" data-act="vttwk" data-v="${v}" aria-pressed="${(VTT.wallKind || "wall") === v}">${l}</button>`).join("")}</div>
      <label class="check small"><input type="checkbox" data-act="vttwsnap"${VTT.wallSnap !== false ? " checked" : ""}> Snap to grid <small class="muted">(Alt flips it)</small></label></div>` : ""}
    ${VTT.layer === "lights" ? vLightToolsHtml() : ""}
    ${vFxToolsHtml()}
    <div class="vgroup"><span class="vlab">Add</span><button class="vbtn" data-act="vttaddimg" title="Upload an image onto the ${VTT.layer === "gm" ? "GM" : VTT.layer === "token" ? "token" : "map"} layer">🖼 Image</button><button class="vbtn" data-act="vtttokpick" title="Add a token from the library or a new picture">● Token</button></div>
    <div class="vgroup"><label class="check small"><input type="checkbox" data-act="vttpreview"${VTT.preview ? " checked" : ""}> Show what players see</label></div>`;
}

// ----- Drawing the board -----
function vMount() {
  const root = document.querySelector(".vtt"); if (!root) { VTT.mountedKey = ""; return; }
  const top = root.getBoundingClientRect().top + window.scrollY; document.documentElement.style.setProperty("--vtop", Math.round(top) + "px");
  const pid = VTT.camp === root.dataset.camp ? vCurrentPage(root.dataset.camp) : vCurrentPage(root.dataset.camp);
  const view = document.getElementById("vview"); if (!view || !pid) return;
  VTT.mountedKey = root.dataset.camp + "|" + pid;
  if (!view.dataset.wired) vWire(view);
  vDraw();
  if (VTT.fitDone !== pid) { VTT.fitDone = pid; vFit(); }
}
function vRefresh() { const s = document.getElementById("vside"); if (s && !(document.activeElement && s.contains(document.activeElement) && document.activeElement.matches("input,select"))) s.innerHTML = vSideHtml(); vDraw(); }
function vPageNow() { const root = document.querySelector(".vtt"); if (!root) return null; const pid = vCurrentPage(root.dataset.camp); return pid ? { id: pid, p: S.vttPages.get(pid) } : null; }
function vDraw() {
  const cur = vPageNow(), stage = document.getElementById("vstage"); if (!cur || !stage || !cur.p) return;
  const p = cur.p, W = p.w * VCELL, H = p.h * VCELL, gm = vCanEdit(), toks = vTokens(cur.id);
  stage.style.width = W + "px"; stage.style.height = H + "px";
  vApplyView();
  const objs = (p.objs || []);
  if (VTT.lvlShowPid !== cur.id) { VTT.lvlShowPid = cur.id; VTT.lvlShow = null; }
  { const sig = cur.id + "|" + vMaxLevel(p) + "|" + JSON.stringify(p.levelNames || {}); if (VTT.lvlSig !== sig || !document.querySelector("#vtools .vlvgroup")) { VTT.lvlSig = sig; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); } }
  const lvlCls = l => vLvlHid(l) ? " lvlhid" : gm && !VTT.preview && (l || 0) > VTT.lvl ? " above" : "";
  const img = o => `<img class="vobj${lvlCls(o.level)}${VTT.sel && VTT.sel.kind === "obj" && VTT.sel.id === o.id ? " sel" : ""}${o.layer === "gm" ? " gmonly" : ""}" data-oid="${esc(o.id)}" data-layer="${o.layer}" data-level="${o.level || 0}" src="${esc(o.img)}" alt="" draggable="false" style="left:${o.x * VCELL}px;top:${o.y * VCELL}px;width:${o.w * VCELL}px;height:${o.h * VCELL}px${o.rot ? `;transform:rotate(${Number(o.rot) || 0}deg)` : ""}">`;
  const tok = ([id, t]) => { const src = vTokSrc(t), s = (t.size || 1) * VCELL, fly = Math.max(0, Number(t.fly) || 0);
    return `<div class="vtok${vDead(t) ? " vdead" : ""}${vIsTurn(id, t) ? " vturn" : ""}${(VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id === id) || VTT.multi.has(id) ? " sel" : ""}${t.layer === "gm" ? " gmonly" : ""}${t.owner ? " owned" : ""}${fly ? " flying" : ""}${lvlCls(t.lvl)}" data-tid="${esc(id)}" data-layer="${t.layer}" style="left:${t.x * VCELL}px;top:${t.y * VCELL}px;width:${s}px;height:${s}px;--fly:${Math.min(fly, 6)}">${fly ? `<span class="vfly" title="Flight band ${fly}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 14c3-1 6-4 8-8 1 3 1 6-1 9 3-1 6-3 8-7 1 4-1 9-6 11-4 1-7 0-9-5z"/></svg>${fly}</span>` : ""}${t.lvl ? `<span class="vlvl" title="Standing on ${esc(vLevelName(p, t.lvl))}">⌂${t.lvl}</span>` : ""}${vCondBadges(t)}${gm && !VTT.preview ? vAcBadge(t) : ""}
      ${vDead(t) ? `<span class="vdeadx" aria-label="Down"></span>` : vBarsHtml(t)}${src ? `<img src="${esc(src)}" alt="" draggable="false">` : `<span class="vinit">${esc((t.name || "?")[0])}</span>`}<span class="vname">${esc(t.name || "")}</span></div>`; };
  const grid = p.grid !== false ? `<svg class="vgrid" width="${W}" height="${H}" aria-hidden="true"><defs><pattern id="vgp" width="${VCELL}" height="${VCELL}" patternUnits="userSpaceOnUse"><path d="M ${VCELL} 0 L 0 0 0 ${VCELL}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#vgp)"/><rect width="100%" height="100%" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/></svg>` : "";
  const showWalls = gm && !VTT.preview;
  const wallSel = VTT.sel && VTT.sel.kind === "wall" ? VTT.sel.i : -1;
  const areaSel = VTT.sel && VTT.sel.kind === "area" ? VTT.sel.id : "";
  const walls = showWalls ? `<svg class="vwalls${VTT.layer === "walls" ? " active" : ""}" width="${W}" height="${H}" aria-hidden="true">${(p.areas || []).map(a => vAreaSvg(p, a, a.id === areaSel)).join("")}
    ${(p.walls || []).map((w, i) => `<line x1="${w[0] * VCELL}" y1="${w[1] * VCELL}" x2="${w[2] * VCELL}" y2="${w[3] * VCELL}" class="${i === wallSel ? "sel" : ""}${(w[4] || 0) !== VTT.lvl ? " otherlvl" : ""}${vLvlHid(w[4]) ? " lvlhid" : ""}${w[5] ? " " + w[5].k + (w[5].open ? " open" : "") + (w[5].secret ? " secret" : "") : ""}"/>`).join("")}
    ${VTT.draft && VTT.draft.length ? `<polyline class="draft${VTT.tool === "area" ? " areadraft" : ""}" points="${VTT.draft.map(q => q[0] * VCELL + "," + q[1] * VCELL).join(" ")}${VTT.hover ? " " + VTT.hover[0] * VCELL + "," + VTT.hover[1] * VCELL : ""}${VTT.tool === "area" && VTT.draft.length > 1 ? " " + VTT.draft[0][0] * VCELL + "," + VTT.draft[0][1] * VCELL : ""}"/>${VTT.draft.map(q => `<circle cx="${q[0] * VCELL}" cy="${q[1] * VCELL}" r="4"/>`).join("")}` : ""}</svg>` : "";
  const visToks = toks.filter(([, t]) => t.layer !== "gm" || gm).sort((a, b) => (Number(a[1].z) || 0) - (Number(b[1].z) || 0));
  // Remember where each token was drawn, so ones moved by someone else can slide to their new spot.
  const prevPos = new Map(); stage.querySelectorAll(".vtok").forEach(e => { if (!e.classList.contains("dragging")) { const cs = getComputedStyle(e); prevPos.set(e.dataset.tid, [parseFloat(cs.left), parseFloat(cs.top), parseFloat(e.style.left), parseFloat(e.style.top), e.dataset.slideT]); } });
  stage.innerHTML = `<div class="vbg" style="background:${esc(p.bg || "#1b1f27")}"></div>
    <div class="vlayer vmap">${objs.filter(o => o.layer === "map" && !o.level).map(img).join("")}</div>${grid}
    <div class="vlayer vgm">${gm ? objs.filter(o => o.layer === "gm" && !o.level).map(img).join("") + visToks.filter(([, t]) => t.layer === "gm").map(tok).join("") : ""}</div>
    <div class="vlayer vtokl">${objs.filter(o => o.layer === "token" && !o.level).map(img).join("")}${visToks.filter(([, t]) => t.layer !== "gm" && !vHeight(t)).map(tok).join("")}</div>
    <canvas class="vfog" id="vfog" aria-hidden="true"></canvas>
    <div class="vlayer vroofl">${(() => { const up = objs.filter(o => o.level && (gm || o.layer !== "gm")), lv = [...new Set(up.map(o => o.level))].sort((a, b) => a - b); return lv.map(L => `<div class="vrlv" data-lvl="${L}">${up.filter(o => o.level === L).map(img).join("")}</div>`).join(""); })()}</div>
    <div class="vlayer vhigh">${visToks.filter(([, t]) => t.layer !== "gm" && vHeight(t)).map(tok).join("")}</div>${vFxStageHtml(p)}<svg class="vdrawl" id="vdrawl" width="${W}" height="${H}" aria-hidden="true">${vDrawingsSvg(cur.id)}</svg>${walls}${gm && !VTT.preview && VTT.layer === "lights" ? vLightMarks(p) : ""}${vLinksHtml(p, gm && !VTT.preview)}${vDoorMarks(p, gm && !VTT.preview)}${vGoHtml(p, toks)}<svg class="vmeas" id="vmeas" width="${W}" height="${H}" aria-hidden="true"></svg><div class="vpings" id="vpings"></div>
    ${gm && VTT.sel && VTT.sel.kind === "obj" ? (o => o ? (o.rot ? "" : `<div class="vhandle" data-handle="obj" style="left:${(o.x + o.w) * VCELL - 9}px;top:${(o.y + o.h) * VCELL - 9}px" title="Drag to resize (Shift: free)"></div>`) + `<div class="vrothandle" data-handle="rot" style="left:${(o.x + o.w / 2) * VCELL - 11}px;top:${o.y * VCELL - 40}px;transform-origin:11px ${o.h * VCELL / 2 + 40}px;transform:rotate(${Number(o.rot) || 0}deg)" title="Drag to rotate (Shift: free; otherwise 15° steps)">⟳</div>` : "")(objs.find(o => o.id === VTT.sel.id)) : ""}
    ${gm && VTT.sel && VTT.sel.kind === "wall" && (p.walls || [])[VTT.sel.i] ? (w => `<div class="vwh" data-wh="0" style="left:${w[0] * VCELL}px;top:${w[1] * VCELL}px" title="Drag to move this end"></div><div class="vwh" data-wh="1" style="left:${w[2] * VCELL}px;top:${w[3] * VCELL}px" title="Drag to move this end"></div>`)(p.walls[VTT.sel.i]) : ""}`;
  stage.dataset.layer = VTT.layer;
  vFog(cur.id, p, toks);
  vSlideTokens(stage, prevPos);
  vMeasDraw(); vPingDraw(); vFxRun(p); vQuestDraw(); vLightsPaint(cur.id, p, toks);
  const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false);
  vInitDraw();
  const hint = document.getElementById("vhint");
  if (hint) hint.textContent = VTT.tool === "measure" ? "Drag to measure · Esc to clear" : gm ? (VTT.tool === "wall" ? (VTT.draft ? "Click to add points · double-click or Enter to finish · Esc to cancel" : "Click to start a wall") : VTT.tool === "area" ? `Drag over squares that are up on ${vLevelName(p, VTT.lvl || 1)} · hold Alt to remove squares` : VTT.tool === "link" ? "Drag over the squares for stairs or a lift" : VTT.layer === "walls" ? "Select a wall to delete it, or pick the wall tool to draw" : "") : (p.light ? "" : "");
}
function vApplyView() { const st = document.getElementById("vstage"); if (st) { st.style.transform = `translate(${VTT.panX}px,${VTT.panY}px) scale(${VTT.zoom})`; st.style.setProperty("--vinv", Math.max(1, 1 / VTT.zoom).toFixed(3)); } }
function vFit() {
  const cur = vPageNow(), view = document.getElementById("vview"); if (!cur || !view) return;
  const W = cur.p.w * VCELL, H = cur.p.h * VCELL, r = view.getBoundingClientRect();
  VTT.zoom = Math.max(0.1, Math.min(2, Math.min((r.width - 40) / W, (r.height - 40) / H)));
  VTT.panX = (r.width - W * VTT.zoom) / 2; VTT.panY = (r.height - H * VTT.zoom) / 2; vApplyView();
}
function vZoomAt(f, cx, cy) {
  const nz = Math.max(0.1, Math.min(4, VTT.zoom * f));
  VTT.panX = cx - (cx - VTT.panX) * (nz / VTT.zoom); VTT.panY = cy - (cy - VTT.panY) * (nz / VTT.zoom); VTT.zoom = nz; vApplyView();
}

// ----- Line of sight and remembered areas -----
function vSegs(p, h) {
  const W = p.w, H = p.h, lvl = Math.max(0, Math.round(h || 0));
  return (p.walls || []).filter(w => (w[4] || 0) === lvl && !vWallOpen(w)).map(w => w.slice(0, 4)).concat([[0, 0, W, 0], [W, 0, W, H], [W, H, 0, H], [0, H, 0, 0]]);
}
// The area visible from (x, y) with walls as blockers: a polygon of points in squares.
function vVisPoly(x, y, segs) {
  const angles = [];
  for (const s of segs) for (const [px, py] of [[s[0], s[1]], [s[2], s[3]]]) { const a = Math.atan2(py - y, px - x); angles.push(a - 1e-5, a, a + 1e-5); }
  const pts = [];
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity;
    for (const s of segs) {
      const sx = s[2] - s[0], sy = s[3] - s[1], den = dx * sy - dy * sx; if (Math.abs(den) < 1e-12) continue;
      const t = ((s[0] - x) * sy - (s[1] - y) * sx) / den, u = ((s[0] - x) * dy - (s[1] - y) * dx) / den;
      if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
    }
    if (best < Infinity) pts.push([x + dx * best, y + dy * best, a]);
  }
  pts.sort((p1, p2) => p1[2] - p2[2]);
  return pts.map(q => [q[0], q[1]]);
}
function vInPoly(x, y, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
const vB64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const vUnB64 = (s, n) => { const out = new Uint8Array(n); try { const b = atob(s || ""); for (let i = 0; i < Math.min(n, b.length); i++) out[i] = b.charCodeAt(i); } catch (e) {} return out; };
function vFogLoad(pid, p) {
  const gw = p.w * VFOG_RES, gh = p.h * VFOG_RES, n = Math.ceil(gw * gh / 8), key = pid + "|" + gw + "x" + gh;
  const f = (S.vttFog || new Map()).get(pid);
  const stored = f && f.w === p.w && f.h === p.h ? vUnB64(f.bits, n) : new Uint8Array(n);
  if (VTT.fogKey !== key || !VTT.fogBits) { VTT.fogKey = key; VTT.fogBits = stored; }
  else for (let i = 0; i < n; i++) VTT.fogBits[i] |= stored[i];
  return { gw, gh };
}
// Players' tokens can be on different floors of one building. On a shared screen, the players pick
// which floor to look at (VTT.pfloor); "All" keeps everyone's view together.
function vViewers(p, toks) {
  const base = toks.filter(([, t]) => t.owner && t.layer !== "gm"), fl = t => Math.max(0, Number(t.lvl) || 0);
  const floors = [...new Set(base.map(([, t]) => fl(t)))].sort((a, b) => a - b);
  const bar = document.getElementById("vfloors");
  if (bar) {
    const show = floors.length > 1 && (!vCanEdit() || VTT.preview);
    if (VTT.pfloor != null && !floors.includes(VTT.pfloor)) VTT.pfloor = null;
    const html = show ? `<span class="vflab">Floor</span><button class="${VTT.pfloor == null ? "on" : ""}" data-act="vttpfloor" data-v="" aria-pressed="${VTT.pfloor == null}">All</button>${floors.slice().reverse().map(n => { const who = base.filter(([, t]) => fl(t) === n).map(([, t]) => t.name || "?"); return `<button class="${VTT.pfloor === n ? "on" : ""}" data-act="vttpfloor" data-v="${n}" aria-pressed="${VTT.pfloor === n}" title="${esc(who.join(", "))}"><b>${esc(n ? (((p.levelNames || {})[n]) || "Level " + n) : "Ground")}</b><small>${esc(who.length > 2 ? who.slice(0, 2).join(", ") + " +" + (who.length - 2) : who.join(", "))}</small></button>`; }).join("")}` : "";
    if (bar.dataset.h !== html) { bar.innerHTML = html; bar.dataset.h = html; }
    bar.hidden = !show;
  }
  return VTT.pfloor == null ? base : base.filter(([, t]) => fl(t) === VTT.pfloor);
}
function vFog(pid, p, toks) {
  const cv = document.getElementById("vfog"); if (!cv) return;
  const gm = vCanEdit(), dark = vDarkOn(p), on = (p.light || dark) && (!gm || VTT.preview);
  document.querySelectorAll(".vstage .gmonly").forEach(el => el.classList.toggle("vhide", gm && VTT.preview));
  if (!on) { cv.style.display = "none"; document.querySelectorAll(".vtok.vhide:not(.gmonly),.vdoor.vhide").forEach(el => el.classList.remove("vhide")); const vv = vViewers(p, toks); if (!gm || VTT.preview) { vRoofs(p, vv); vFloorHide(vv); } else document.querySelectorAll(".vtok.vflooroff").forEach(el => el.classList.remove("vflooroff")); return; }
  const viewers = vViewers(p, toks);
  // Each viewer is blocked only by the walls on its own height: standing level plus flight band.
  // Without dynamic lighting, walls don't block sight and only darkness limits it.
  const rect = [[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]];
  const vw = viewers.map(([, t]) => { const s = (t.size || 1) / 2, x = t.x + s, y = t.y + s; return { x, y, s, dv: dark ? vDarkvision(t) / 5 : 0, poly: p.light ? vVisPoly(x, y, vSegs(p, vHeight(t))) : rect }; });
  const polys = vw.map(v => v.poly);
  // In the dark, only lit places (and what darkvision reaches) can be seen.
  const em = dark ? vEmitters(p, toks).map(e => Object.assign({ r: (e.bright + e.dim) / 5, poly: vVisPoly(e.x, e.y, vSegs(p, e.h)) }, e)).filter(e => e.r > 0) : [];
  const path = (c, poly, k) => { c.beginPath(); poly.forEach(([x, y], i) => i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k)); c.closePath(); };
  const drawSeen = (c, k) => vw.forEach(v => {
    if (v.poly.length < 3) return;
    if (!dark) { path(c, v.poly, k); c.fill(); return; }
    c.save(); path(c, v.poly, k); c.clip();
    em.forEach(e => { if (e.poly.length < 3) return; c.save(); path(c, e.poly, k); c.clip(); c.beginPath(); c.arc(e.x * k, e.y * k, e.r * k, 0, 6.2832); c.fill(); c.restore(); });
    c.beginPath(); c.arc(v.x * k, v.y * k, (v.s + 0.5 + v.dv) * k, 0, 6.2832); c.fill();
    c.restore();
  });
  vRoofs(p, viewers);
  const R = 20, W = p.w * R, H = p.h * R;
  cv.width = W; cv.height = H; cv.style.display = "block"; cv.style.width = p.w * VCELL + "px"; cv.style.height = p.h * VCELL + "px";
  const ctx = cv.getContext("2d");
  ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#05060a"; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "destination-out";
  if (p.fogMem !== false) {
    const { gw, gh } = vFogLoad(pid, p);
    // Add what's visible now to the remembered squares.
    const off = document.createElement("canvas"); off.width = gw; off.height = gh; const oc = off.getContext("2d");
    oc.fillStyle = "#000"; drawSeen(oc, VFOG_RES);
    const px = oc.getImageData(0, 0, gw, gh).data; let changed = false;
    for (let i = 0; i < gw * gh; i++) if (px[i * 4 + 3] > 100) { const b = i >> 3, m = 1 << (i & 7); if (!(VTT.fogBits[b] & m)) { VTT.fogBits[b] |= m; changed = true; } }
    if (changed) vFogSaveSoon(pid, p);
    // Draw remembered squares dimmed.
    const mem = oc.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) if (VTT.fogBits[i >> 3] & (1 << (i & 7))) mem.data[i * 4 + 3] = 255;
    oc.clearRect(0, 0, gw, gh); oc.putImageData(mem, 0, 0);
    ctx.globalAlpha = 0.45; ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#000"; drawSeen(ctx, R);
  ctx.globalCompositeOperation = "source-over";
  // Tokens nobody in the party can see right now are hidden; in the dark, so are ones standing where there's no light
  // (unless they give off light themselves, or a viewer's darkvision reaches them).
  // Doors and windows show where the party can see, or has seen.
  const gw = p.w * VFOG_RES, seenBit = (x, y) => { if (p.fogMem === false || !VTT.fogBits) return false; const i = Math.floor(y * VFOG_RES) * gw + Math.floor(x * VFOG_RES); return !!(VTT.fogBits[i >> 3] & (1 << (i & 7))); };
  const lit = (x, y) => em.some(e => Math.hypot(x - e.x, y - e.y) <= e.r && vInPoly(x, y, e.poly));
  // Door and window markers show only while one of the party's tokens can see them right now.
  document.querySelectorAll(".vdoor").forEach(el => { const x = Number(el.dataset.x), y = Number(el.dataset.y); el.classList.toggle("vhide", ![[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([a, b]) => vw.some(v => vInPoly(x + a, y + b, v.poly) && (!dark || lit(x + a, y + b) || Math.hypot(x + a - v.x, y + b - v.y) <= v.s + 0.5 + v.dv)))); });
  document.querySelectorAll(".vtok").forEach(el => {
    const t = S.vttTokens.get(el.dataset.tid); if (!t || t.layer === "gm") return;
    const cx = t.x + (t.size || 1) / 2, cy = t.y + (t.size || 1) / 2, glows = dark && vTokLights(t).length > 0;
    const seen = !!t.owner || vw.some(v => vInPoly(cx, cy, v.poly) && (!dark || glows || lit(cx, cy) || Math.hypot(cx - v.x, cy - v.y) <= v.s + 0.5 + v.dv + (t.size || 1) / 2));
    el.classList.toggle("vhide", !seen);
  });
  vFloorHide(viewers);
}
// Players only see tokens on a floor one of their tokens is on (or the floor they've picked).
function vFloorHide(viewers) {
  const floors = new Set(viewers.map(([, t]) => Math.max(0, Number(t.lvl) || 0)));
  document.querySelectorAll(".vtok").forEach(el => { const t = S.vttTokens.get(el.dataset.tid); if (!t || t.layer === "gm") return;
    el.classList.toggle("vflooroff", floors.size > 0 && !floors.has(Math.max(0, Number(t.lvl) || 0))); });
}
function vFogSaveSoon(pid, p) {
  clearTimeout(VTT.fogTimer);
  VTT.fogTimer = setTimeout(() => { if (VTT.fogKey.startsWith(pid + "|")) S.db.doc("vttfog/" + pid).set({ w: p.w, h: p.h, res: VFOG_RES, bits: vB64(VTT.fogBits), at: new Date().toISOString() }).catch(() => {}); }, 1500);
}

// ----- Side panel -----
function vSideHtml() {
  const cur = vPageNow(); if (!cur) return "";
  const p = cur.p, sel = VTT.sel;
  if (VTT.multi.size > 1) return vMultiSideHtml();
  if (sel && sel.kind === "tok") { const t = S.vttTokens.get(sel.id); return t ? vTokSideHtml(sel.id, t) : vSideHelp(p); }
  if (sel && sel.kind === "obj") {
    const o = (p.objs || []).find(x => x.id === sel.id); if (!o) return vSideHelp(p);
    return `<h2>Image</h2><div class="vform" data-obj="${esc(sel.id)}">
      <label><span>Layer</span><select data-vf="layer"><option value="map"${o.layer === "map" ? " selected" : ""}>Map (under the grid)</option><option value="token"${o.layer === "token" ? " selected" : ""}>Tokens</option><option value="gm"${o.layer === "gm" ? " selected" : ""}>GM only</option></select></label>
      <label><span>Level</span><select data-vf="level">${vLevelList(p).map(n => `<option value="${n}"${(o.level || 0) === n ? " selected" : ""}>${esc(vLevelName(p, n))}</option>`).join("")}</select></label>
      <div class="frow tight"><label><span>Width</span><input type="number" min="0.25" step="0.25" data-vf="w" value="${+o.w.toFixed(2)}"></label><label><span>Height</span><input type="number" min="0.25" step="0.25" data-vf="h" value="${+o.h.toFixed(2)}"></label></div>
      <div class="frow tight vrotrow"><label><span>Rotation (°)</span><input type="number" step="15" data-vf="rot" value="${Number(o.rot) || 0}"></label><button class="btn ghost small" data-act="vttobjrot" data-v="-90" aria-label="Rotate 90° left">↺ 90°</button><button class="btn ghost small" data-act="vttobjrot" data-v="90" aria-label="Rotate 90° right">↻ 90°</button></div>
      <p class="muted small">In grid squares. Drag the corner handle to resize (hold Shift to stretch freely) and the ⟳ handle to rotate.</p>
      <div class="acts wrap"><button class="btn ghost small" data-act="vttobjfit">Fit to board</button><button class="btn ghost small" data-act="vttobjz" data-v="back">Send to back</button><button class="btn ghost small" data-act="vttobjz" data-v="front">Bring to front</button><button class="btn ghost small danger" data-act="vttdel">Delete image</button></div></div>`;
  }
  if (sel && sel.kind === "light") { const l = (p.lights || []).find(x => x.id === sel.id); return l ? vLightSideHtml(p, l) : vSideHelp(p); }
  if (sel && sel.kind === "area") { const a = (p.areas || []).find(x => x.id === sel.id); return a ? `<h2>Raised ${a.cells ? "squares" : "area"}</h2><p class="muted small">Part of <strong>${esc(vLevelName(p, a.level))}</strong>${a.cells ? ` · ${a.cells.length} square${a.cells.length === 1 ? "" : "s"}` : ""}: a rooftop or upper floor. Pictures on that level over these squares are hidden from players whose tokens are underneath, so they can see inside.</p><p class="muted small">With the ▦ tool, drag to add squares; hold Alt while dragging to remove them.</p><div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete ${a.cells ? "all these squares" : "area"}</button></div>` : vSideHelp(p); }
  if (sel && sel.kind === "wall" && p.walls[sel.i]) return vWallSideHtml(p, sel.i);
  if (sel && sel.kind === "link") { const l = (p.links || []).find(x => x.id === sel.id); return l ? vLinkSideHtml(p, l) : vSideHelp(p); }
  if (sel && sel.kind === "wall") return `<h2>Wall</h2><p class="muted small">On <strong>${esc(vLevelName(p, (p.walls[sel.i] || [])[4] || 0))}</strong>. Blocks sight for tokens at that height when dynamic lighting is on.</p><div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete wall</button></div>`;
  return vSideHelp(p);
}
function vSideHelp(p) {
  if (!vCanEdit()) return "";
  return vPageSideHtml(p);
}
function vSideTips(p) {
  const n = vTokens(VTT.page).length;
  return `<h2>${esc(p.name || "Page")}</h2><p class="muted small">${p.w} × ${p.h} squares · ${n} token${n === 1 ? "" : "s"} · ${(p.walls || []).length} wall${(p.walls || []).length === 1 ? "" : "s"}${p.light ? " · dynamic lighting on" : ""}</p>
    <ul class="vtips small muted"><li>Pick a <strong>layer</strong>, then click things on it to select and drag them.</li><li>Drag empty space to pan; scroll or pinch to zoom.</li><li><strong>Delete</strong> removes what's selected.</li><li>Tokens snap to the grid; hold <strong>Alt</strong> while dropping to place freely.</li><li>Give a token a <strong>controller</strong> so its player can move it and see through it.</li></ul>`;
}

// ----- Pointer handling -----
function vPt(ev) { const st = document.getElementById("vstage").getBoundingClientRect(); return [(ev.clientX - st.left) / VTT.zoom / VCELL, (ev.clientY - st.top) / VTT.zoom / VCELL]; }
function vSegDist(px, py, w) { const dx = w[2] - w[0], dy = w[3] - w[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - w[0]) * dx + (py - w[1]) * dy) / l2)) : 0; return Math.hypot(px - (w[0] + t * dx), py - (w[1] + t * dy)); }
function vWire(view) {
  view.dataset.wired = "1";
  const ptrs = new Map(); let drag = null, pinch = null;
  view.addEventListener("wheel", ev => { ev.preventDefault(); const r = view.getBoundingClientRect(); vZoomAt(ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
  view.addEventListener("pointerdown", ev => {
    if (ev.target.closest(".vzoom,.vptools,.vturns,.vquests,.vfloors")) return;
    const dm = ev.target.closest("button.vdoor"); if (dm) { ev.preventDefault(); ev.stopPropagation(); vDoorClick(dm.dataset.door); return; }
    const go = ev.target.closest(".vgo button"); if (go) { ev.preventDefault(); ev.stopPropagation(); vGoLevel(go.dataset.tok, Number(go.dataset.lvl)); return; }
    view.focus({ preventScroll: true });
    ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: VTT.zoom }; drag = null; return; }
    const cur = vPageNow(); if (!cur) return;
    const gm = vCanEdit(), [x, y] = vPt(ev);
    const rh = gm && ev.target.closest(".vrothandle"); if (rh && VTT.sel && VTT.sel.kind === "obj") { const o = (cur.p.objs || []).find(q => q.id === VTT.sel.id); if (o) { ev.preventDefault(); drag = { kind: "rot", o, el: document.querySelector(`.vobj[data-oid="${CSS.escape(o.id)}"]`), cx: o.x + o.w / 2, cy: o.y + o.h / 2 }; view.setPointerCapture(ev.pointerId); return; } }
    const wh = gm && ev.target.closest(".vwh"); if (wh && VTT.sel && VTT.sel.kind === "wall") { const w = cur.p.walls[VTT.sel.i]; if (w) { ev.preventDefault(); const e = Number(wh.dataset.wh), pt = e ? [w[2], w[3]] : [w[0], w[1]]; drag = { kind: "wend", pt, lvl: w[4] || 0, el: wh }; view.setPointerCapture(ev.pointerId); return; } }
    const pan = () => { drag = { kind: "pan", sx: ev.clientX, sy: ev.clientY, px: VTT.panX, py: VTT.panY }; view.setPointerCapture(ev.pointerId); };
    if (ev.button === 1 || ev.button === 2 || (gm && VTT.tool === "pan")) return pan();
    if (gm && VTT.tool === "area") { ev.preventDefault(); if (!VTT.lvl) vAreaPickLevel(); const sx = Math.floor(x), sy = Math.floor(y); drag = { kind: "area", sx, sy, ex: sx, ey: sy, rm: ev.altKey }; view.setPointerCapture(ev.pointerId); vLinkDraft(drag); return; }
    if (gm && VTT.tool === "wall") { ev.preventDefault(); return vWallClick(x, y, ev); }
    if (VTT.tool === "measure") { const sp = ev.altKey ? [x, y] : [Math.round(x * 2) / 2, Math.round(y * 2) / 2]; VTT.meas = { s: sp, e: sp, shape: VTT.mshape, bw: VTT.mbeam }; drag = { kind: "meas" }; view.setPointerCapture(ev.pointerId); vMeasDraw(); vLiveMeas(); vMeasToolsRefresh(); return; }
    if (VTT.tool === "ping") { ev.preventDefault(); vPing(x, y, gm && ev.shiftKey); return; }
    if (VTT.tool === "travel") { ev.preventDefault(); vTravelClick(x, y, ev); return; }
    if (gm && VTT.tool === "scale") { ev.preventDefault(); drag = { kind: "scale" }; VTT.meas = { shape: "scale", s: [x, y], e: [x, y] }; view.setPointerCapture(ev.pointerId); vMeasDraw(); return; }
    if (VTT.tool === "draw") { ev.preventDefault(); if (VTT.erase) { vEraseAt(x, y); drag = { kind: "erase" }; view.setPointerCapture(ev.pointerId); return; } drag = { kind: "draw", pts: [[x, y]] }; view.setPointerCapture(ev.pointerId); vDrawLive(drag.pts); return; }
    if (gm && VTT.tool === "link") { ev.preventDefault(); const sx = Math.floor(x), sy = Math.floor(y); drag = { kind: "link", sx, sy, ex: sx, ey: sy }; view.setPointerCapture(ev.pointerId); vLinkDraft(drag); return; }
    const handle = ev.target.closest("[data-handle]");
    if (handle && gm) { const o = (cur.p.objs || []).find(q => q.id === VTT.sel.id); if (o) { drag = { kind: "resize", o, ratio: o.w / o.h, el: document.querySelector(`.vobj[data-oid="${CSS.escape(o.id)}"]`) }; view.setPointerCapture(ev.pointerId); } return; }
    const layerOk = l => gm ? (VTT.layer === l || (VTT.layer === "token" && l === "token")) : false;
    const tokEl = ev.target.closest(".vtok"), objEl = ev.target.closest(".vobj");
    if (tokEl) {
      const t = S.vttTokens.get(tokEl.dataset.tid);
      const mine = t && !gm && PLAYER && t.owner && t.layer !== "gm";
      if (t && gm && layerOk(t.layer) && ev.shiftKey) { const id = tokEl.dataset.tid; if (VTT.sel && VTT.sel.kind === "tok") VTT.multi.add(VTT.sel.id); if (VTT.multi.has(id)) VTT.multi.delete(id); else VTT.multi.add(id); VTT.sel = VTT.multi.size === 1 ? { kind: "tok", id: [...VTT.multi][0] } : null; if (VTT.multi.size <= 1) VTT.multi.clear(); vRefresh(); return; }
      if (t && gm && VTT.multi.size > 1 && VTT.multi.has(tokEl.dataset.tid)) { const g = [...VTT.multi].map(id => [id, S.vttTokens.get(id)]).filter(([, q]) => q); document.querySelectorAll(".vtok.sel").forEach(e => e.classList.add("dragging")); drag = { kind: "group", g, sx: x, sy: y, moved: false }; view.setPointerCapture(ev.pointerId); return; }
      if (t && (layerOk(t.layer) || mine)) {
        VTT.multi.clear();
        VTT.sel = { kind: "tok", id: tokEl.dataset.tid }; document.querySelectorAll(".vtok.sel,.vobj.sel").forEach(e => e.classList.remove("sel")); tokEl.classList.add("sel");
        drag = { kind: "tok", id: tokEl.dataset.tid, el: tokEl, ox: x - t.x, oy: y - t.y, t, moved: false, wps: [] }; VTT.tdrag = drag; tokEl.classList.add("dragging"); view.setPointerCapture(ev.pointerId);
        const s = document.getElementById("vside"); if (s) s.innerHTML = vSideHtml();
        return;
      }
    }
    if (objEl && gm && layerOk(objEl.dataset.layer)) {
      const o = (cur.p.objs || []).find(q => q.id === objEl.dataset.oid);
      if (o) { VTT.sel = { kind: "obj", id: o.id }; drag = { kind: "obj", o, el: objEl, ox: x - o.x, oy: y - o.y, moved: false }; view.setPointerCapture(ev.pointerId); vRefresh(); drag.el = document.querySelector(`.vobj[data-oid="${CSS.escape(o.id)}"]`); return; }
    }
    if (gm && VTT.layer === "lights") {
      const lt = [...(cur.p.lights || [])].reverse().find(l => !vLvlHid(l.level) && Math.hypot(l.x - x, l.y - y) < 0.45);
      if (lt) { VTT.sel = { kind: "light", id: lt.id }; drag = { kind: "light", l: lt, ox: x - lt.x, oy: y - lt.y, moved: false }; view.setPointerCapture(ev.pointerId); vRefresh(); return; }
      if (VTT.sel) { VTT.sel = null; vRefresh(); }
      pan(); drag.place = [ev.altKey ? x : Math.round(x * 2) / 2, ev.altKey ? y : Math.round(y * 2) / 2]; return;
    }
    if (gm && VTT.layer === "walls") {
      const i = (cur.p.walls || []).findIndex(w => !vLvlHid(w[4]) && vSegDist(x, y, w) < 0.2 / Math.max(0.5, VTT.zoom));
      if (i >= 0) { VTT.sel = { kind: "wall", i }; vRefresh(); return; }
      const lk = [...(cur.p.links || [])].reverse().find(l => !(l.levels || [0]).every(vLvlHid) && x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h);
      if (lk) { VTT.sel = { kind: "link", id: lk.id }; vRefresh(); return; }
      const ar = [...(cur.p.areas || [])].reverse().find(a => !vLvlHid(a.level) && vInArea(a, x, y));
      if (ar) { VTT.sel = { kind: "area", id: ar.id }; vRefresh(); return; }
    }
    if (gm && ev.shiftKey && (VTT.layer === "token" || VTT.layer === "gm")) { drag = { kind: "box", sx: x, sy: y, ex: x, ey: y }; view.setPointerCapture(ev.pointerId); return; }
    if (VTT.sel || VTT.multi.size) { VTT.sel = null; VTT.multi.clear(); vRefresh(); }
    pan();
  });
  view.addEventListener("pointermove", ev => {
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (!drag && VTT.tool === "travel" && VTT.meas && VTT.meas.shape === "travel" && VTT.meas.open) { VTT.meas.hover = vPt(ev); vMeasDraw(); vLiveMeas(); }
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = view.getBoundingClientRect(); vZoomAt((pinch.z * d / pinch.d) / VTT.zoom, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); return; }
    if (vCanEdit() && VTT.tool === "wall" && VTT.draft) { VTT.hover = vSnapWall(vPt(ev), ev); vDraw(); return; }
    if (!drag) return;
    if (drag.kind === "pan" && drag.place && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 6) drag.place = null;
    if (drag.kind === "light") { const [lx, ly] = vPt(ev); drag.moved = true; drag.nx = ev.altKey ? lx - drag.ox : Math.round((lx - drag.ox) * 2) / 2; drag.ny = ev.altKey ? ly - drag.oy : Math.round((ly - drag.oy) * 2) / 2; const cur = vPageNow(); if (cur) { const L = (cur.p.lights || []).find(q => q.id === drag.l.id); if (L) { L.x = drag.nx; L.y = drag.ny; vDraw(); } } return; }
    if (drag.kind === "pan") { VTT.panX = drag.px + ev.clientX - drag.sx; VTT.panY = drag.py + ev.clientY - drag.sy; vApplyView(); return; }
    const [x, y] = vPt(ev);
    if (drag.kind === "meas") { VTT.meas.e = [x, y]; vMeasDraw(); vLiveMeas(); return; }
    if (drag.kind === "link" || drag.kind === "area") { drag.ex = Math.floor(x); drag.ey = Math.floor(y); if (drag.kind === "area") drag.rm = drag.rm || ev.altKey; vLinkDraft(drag); return; }
    if (drag.kind === "rot") { let a = Math.atan2(y - drag.cy, x - drag.cx) * 180 / Math.PI + 90; if (!ev.shiftKey) a = Math.round(a / 15) * 15; a = ((a % 360) + 360) % 360; drag.a = a; if (drag.el) drag.el.style.transform = `rotate(${a}deg)`; const hd = document.querySelector(".vrothandle"); if (hd) hd.style.transform = `rotate(${a}deg)`; return; }
    if (drag.kind === "wend") { const np = vSnapWall([x, y], ev, drag.pt); drag.np = np; drag.el.style.left = np[0] * VCELL + "px"; drag.el.style.top = np[1] * VCELL + "px"; const svg = document.getElementById("vmeas"); if (svg) svg.innerHTML = vWallEndPreview(drag); return; }
    if (drag.kind === "scale") { VTT.meas.e = [x, y]; vMeasDraw(); return; }
    if (drag.kind === "draw") { const l = drag.pts[drag.pts.length - 1]; if (Math.hypot(x - l[0], y - l[1]) > 0.04) { drag.pts.push([x, y]); vDrawLive(drag.pts); } return; }
    if (drag.kind === "erase") { vEraseAt(x, y); return; }
    if (drag.kind === "box") { drag.ex = x; drag.ey = y; const svg = document.getElementById("vmeas"); if (svg) svg.innerHTML = `<rect class="vboxsel" x="${Math.min(drag.sx, x) * VCELL}" y="${Math.min(drag.sy, y) * VCELL}" width="${Math.abs(x - drag.sx) * VCELL}" height="${Math.abs(y - drag.sy) * VCELL}"/>`; return; }
    if (drag.kind === "group") { drag.moved = true; drag.dx = x - drag.sx; drag.dy = y - drag.sy; drag.g.forEach(([id, q]) => { const el = document.querySelector(`.vtok[data-tid="${CSS.escape(id)}"]`); if (el) { el.style.left = (q.x + drag.dx) * VCELL + "px"; el.style.top = (q.y + drag.dy) * VCELL + "px"; } }); return; }
    if (drag.kind === "tok") { drag.moved = true; drag.nx = x - drag.ox; drag.ny = y - drag.oy; drag.el.style.left = drag.nx * VCELL + "px"; drag.el.style.top = drag.ny * VCELL + "px";
      const free = ev.altKey !== vNoSnap(), sz = drag.t.size || 1, snapX = free ? Math.round(drag.nx * 100) / 100 : Math.round(drag.nx), snapY = free ? Math.round(drag.ny * 100) / 100 : Math.round(drag.ny);
      drag.end = [snapX + sz / 2, snapY + sz / 2];
      // Right-click while dragging (pressed alongside the left button) drops a corner in the path.
      if (ev.button === 2 && (ev.buttons & 2)) vAddWaypoint(drag);
      VTT.mmove = { shape: "path", pts: [[drag.t.x + sz / 2, drag.t.y + sz / 2], ...drag.wps, drag.end], h: vHeight(drag.t) }; vMeasDraw(); return; }
    if (drag.kind === "obj") { drag.moved = true; drag.nx = x - drag.ox; drag.ny = y - drag.oy; if (drag.el) { drag.el.style.left = drag.nx * VCELL + "px"; drag.el.style.top = drag.ny * VCELL + "px"; } const h = document.querySelector(".vhandle"); if (h) h.style.display = "none"; return; }
    if (drag.kind === "resize") { let w = Math.max(0.25, x - drag.o.x), h = Math.max(0.25, y - drag.o.y); if (!ev.shiftKey) h = w / drag.ratio; drag.nw = w; drag.nh = h; if (drag.el) { drag.el.style.width = w * VCELL + "px"; drag.el.style.height = h * VCELL + "px"; } const hd = document.querySelector(".vhandle"); if (hd) { hd.style.left = (drag.o.x + w) * VCELL - 9 + "px"; hd.style.top = (drag.o.y + h) * VCELL - 9 + "px"; } }
  });
  const end = ev => {
    // Letting go of the right button while still dragging with the left keeps the drag going.
    if (ev.button === 2 && drag && drag.kind === "tok") return;
    ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch = null;
    const d = drag; drag = null; if (!d) return;
    if (d.kind === "meas") { vLiveMeas(true); return; }
    if (d.kind === "link") { vLinkAdd(d); return; }
    if (d.kind === "area") { vAreaPaint(d); return; }
    if (d.kind === "draw") { vDrawSave(d.pts); return; }
    if (d.kind === "scale") { vScaleSet(); return; }
    if (d.kind === "rot") { if (d.a != null) vObjSet(d.o.id, { rot: d.a }); return; }
    if (d.kind === "wend") { vMeasDraw(); if (d.np) vWallMoveEnd(d.pt, d.np, d.lvl); return; }
    if (d.kind === "erase") return;
    if (d.kind === "box") { vMeasDraw(); const x1 = Math.min(d.sx, d.ex), x2 = Math.max(d.sx, d.ex), y1 = Math.min(d.sy, d.ey), y2 = Math.max(d.sy, d.ey), cur = vPageNow(); VTT.multi.clear(); if (cur) vTokens(cur.id).forEach(([id, t]) => { const s = (t.size || 1) / 2, cx = t.x + s, cy = t.y + s; if (t.layer === (VTT.layer === "gm" ? "gm" : "token") && !vLvlHid(t.lvl) && cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) VTT.multi.add(id); }); VTT.sel = VTT.multi.size === 1 ? { kind: "tok", id: [...VTT.multi][0] } : null; if (VTT.multi.size === 1) VTT.multi.clear(); vRefresh(); return; }
    if (d.kind === "group") { document.querySelectorAll(".vtok.dragging").forEach(e => e.classList.remove("dragging")); if (!d.moved) return; const snap = ev.altKey === vNoSnap(), dx = snap ? Math.round(d.dx) : d.dx, dy = snap ? Math.round(d.dy) : d.dy, cur = vPageNow(); d.g.forEach(([id, q]) => { const s = q.size || 1, nx = Math.max(0, Math.min((cur ? cur.p.w : 999) - s, q.x + dx)), ny = Math.max(0, Math.min((cur ? cur.p.h : 999) - s, q.y + dy)); S.vttTokens.set(id, Object.assign({}, q, { x: nx, y: ny })); vPatch("vtttokens/" + id, { x: nx, y: ny }); }); vDraw(); return; }
    if (d.kind === "pan" && d.place) { vLightPlace(d.place[0], d.place[1]); return; }
    if (d.kind === "light") { if (d.moved) vLightSet(d.l.id, { x: d.nx, y: d.ny }); return; }
    VTT.tdrag = null; document.querySelectorAll(".vtok.dragging").forEach(e => e.classList.remove("dragging"));
    if (d.kind === "tok" && VTT.mmove) { VTT.mmove = null; vMeasDraw(); }
    const cur = vPageNow(); if (!cur) return;
    if (d.kind === "tok" && d.moved) {
      const s = d.t.size || 1, snap = ev.altKey === vNoSnap();
      let nx = snap ? Math.round(d.nx) : d.nx, ny = snap ? Math.round(d.ny) : d.ny;
      nx = Math.max(0, Math.min(cur.p.w - s, nx)); ny = Math.max(0, Math.min(cur.p.h - s, ny));
      d.el.style.left = nx * VCELL + "px"; d.el.style.top = ny * VCELL + "px";
      S.vttTokens.set(d.id, Object.assign({}, d.t, { x: nx, y: ny }));
      vPatch("vtttokens/" + d.id, { x: nx, y: ny });
      vFog(cur.id, cur.p, vTokens(cur.id));
    }
    if (d.kind === "obj" && d.moved) vObjSet(d.o.id, { x: d.nx, y: d.ny });
    if (d.kind === "resize" && d.nw) vObjSet(d.o.id, { w: d.nw, h: d.nh });
  };
  view.addEventListener("pointerup", end); view.addEventListener("pointercancel", end);
  view.addEventListener("contextmenu", ev => { ev.preventDefault(); if (drag && drag.kind === "tok") vAddWaypoint(drag); });
  view.addEventListener("dblclick", ev => { if (vCanEdit() && VTT.tool === "wall") { ev.preventDefault(); vWallFinish(); } });
}
function vSnapWall([x, y], ev, skip) {
  // First the ends of walls already drawn (so lines join up), then the grid's corners, unless snapping is off.
  // Hold Alt to do the opposite of the Snap setting for one click.
  const cur = vPageNow(), r = 0.3 / Math.max(0.5, VTT.zoom);
  let best = null, bd = r;
  if (cur) (cur.p.walls || []).forEach(w => { if ((w[4] || 0) !== VTT.lvl) return; [[w[0], w[1]], [w[2], w[3]]].forEach(q => { if (skip && Math.abs(q[0] - skip[0]) < 1e-6 && Math.abs(q[1] - skip[1]) < 1e-6) return; const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = q; } }); });
  (VTT.draft || []).forEach(q => { const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = q; } });
  if (best) return best.slice();
  const snap = VTT.wallSnap !== false, alt = ev && ev.altKey;
  if (snap !== !!alt) return [Math.round(x), Math.round(y)];
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}
function vWallClick(x, y, ev) {
  const pt = vSnapWall([x, y], ev), now = Date.now(), lc = VTT.lastWallClick;
  // A second click in the same spot straight away finishes the line (the board redraws between clicks, so the browser's own double-click never fires).
  VTT.lastWallClick = { t: now, x: ev.clientX, y: ev.clientY };
  if (VTT.draft && lc && now - lc.t < 400 && Math.hypot(ev.clientX - lc.x, ev.clientY - lc.y) < 8) { VTT.lastWallClick = null; vWallFinish(); return; }
  if (!VTT.draft) VTT.draft = [pt];
  else { const last = VTT.draft[VTT.draft.length - 1]; if (Math.hypot(last[0] - pt[0], last[1] - pt[1]) > 0.02) VTT.draft.push(pt); }
  vDraw();
}
function vWallFinish() {
  const cur = vPageNow(), d = VTT.draft; VTT.draft = null; VTT.hover = null;
  if (cur && d && d.length > 1) {
    if (VTT.tool === "area") { if (d.length < 3) { toast("An area needs at least three points.", "bad"); vDraw(); return; } vPatch("vttpages/" + cur.id, { areas: (cur.p.areas || []).concat([{ id: vid("a"), level: VTT.lvl, pts: d }]), maxLevel: Math.max(cur.p.maxLevel || 0, VTT.lvl) }); return; }
    const segs = []; for (let i = 1; i < d.length; i++) { const k = VTT.wallKind || "wall"; segs.push([d[i - 1][0], d[i - 1][1], d[i][0], d[i][1]].concat(k !== "wall" ? [VTT.lvl || 0, { k, id: vid("d") }] : VTT.lvl ? [VTT.lvl] : [])); }
    vPatch("vttpages/" + cur.id, { walls: (cur.p.walls || []).concat(segs) });
  } else { if (VTT.tool === "area" && d && d.length) toast("An area needs at least three points.", "bad"); vDraw(); }
}
function vObjSet(id, fields) {
  const cur = vPageNow(); if (!cur) return;
  const objs = (cur.p.objs || []).map(o => o.id === id ? Object.assign({}, o, fields) : o);
  cur.p.objs = objs; vPatch("vttpages/" + cur.id, { objs });
}
document.addEventListener("keydown", ev => {
  if (!document.querySelector(".vtt")) return;
  if (ev.target.matches && ev.target.matches("input,textarea,select,[contenteditable]")) return;
  if (document.querySelector("#modal:not([hidden])")) return;
  const k = ev.key;
  if (k === "Escape" && VTT.meas) { vMeasClear(); return; }
  if (k === "m" || k === "M") { vSetTool(VTT.tool === "measure" ? "select" : "measure"); return; }
  if (k === "p" || k === "P") { vSetTool(VTT.tool === "ping" ? "select" : "ping"); return; }
  if ((k === "[" || k === "]") && vCanEdit() && VTT.sel && VTT.sel.kind === "tok") { vTokZ(k === "]" ? "up" : "down"); return; }
  if ((k === "t" || k === "T") && (vCanEdit() || ((vPageNow() || {}).p || {}).scale)) { vSetTool(VTT.tool === "travel" ? "select" : "travel"); return; }
  if (k === "Enter" && VTT.meas && VTT.meas.shape === "travel" && VTT.meas.open) { vTravelFinish(); return; }
  if ((k === "d" || k === "D") && !ev.ctrlKey && !ev.metaKey) { vSetTool(VTT.tool === "draw" ? "select" : "draw"); return; }
  if (!vCanEdit()) return;
  if (k === "Escape") { if (VTT.draft) { VTT.draft = null; VTT.hover = null; vDraw(); } else if (VTT.sel) { VTT.sel = null; vRefresh(); } }
  else if (k === "Enter" && VTT.draft) vWallFinish();
  else if ((k === "Delete" || k === "Backspace") && (VTT.sel || VTT.multi.size)) { ev.preventDefault(); vDeleteSel(); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === "c" || k === "C")) { if (vCopy()) ev.preventDefault(); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === "v" || k === "V")) { ev.preventDefault(); vPaste(); }
  else if ((ev.ctrlKey || ev.metaKey) && (k === "d" || k === "D")) { ev.preventDefault(); if (vCopy()) vPaste(1); }
  else if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  else if (k === "v" || k === "V") vSetTool("select");
  else if (k === "h" || k === "H") vSetTool("pan");
  else if (k === "w" || k === "W") vSetTool("wall");
  else if (k === "a" || k === "A") vSetTool("area");
  else if (k === "s" || k === "S") vSetTool("link");
});
function vSetTool(t) { VTT.tool = t; if (t === "area" && !VTT.lvl) vAreaPickLevel(); if (t === "wall" || t === "area" || t === "link") VTT.layer = "walls"; VTT.draft = null; VTT.hover = null; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vDraw(); }
async function vDeleteSel() {
  const cur = vPageNow(), s = VTT.sel; if (!cur) return;
  if (VTT.multi.size) { const ids = [...VTT.multi]; VTT.multi.clear(); VTT.sel = null; for (const id of ids) await vDel("vtttokens/" + id); vRefresh(); return; }
  if (!s) return;
  VTT.sel = null;
  if (s.kind === "tok") await vDel("vtttokens/" + s.id);
  else if (s.kind === "obj") await vPatch("vttpages/" + cur.id, { objs: (cur.p.objs || []).filter(o => o.id !== s.id) });
  else if (s.kind === "wall") await vPatch("vttpages/" + cur.id, { walls: (cur.p.walls || []).filter((w, i) => i !== s.i) });
  else if (s.kind === "link") await vPatch("vttpages/" + cur.id, { links: (cur.p.links || []).filter(l => l.id !== s.id) });
  else if (s.kind === "light") await vPatch("vttpages/" + cur.id, { lights: (cur.p.lights || []).filter(l => l.id !== s.id) });
  else if (s.kind === "area") await vPatch("vttpages/" + cur.id, { areas: (cur.p.areas || []).filter(a => a.id !== s.id) });
  vRefresh();
}

// ----- Adding images and tokens -----
function vAddImage() {
  const cur = vPageNow(); if (!cur) return;
  const layer = VTT.layer === "gm" ? "gm" : VTT.layer === "token" ? "token" : "map";
  pickImage(async (res, file) => {
    const url = assetPath(res);
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = url; });
    let w = im ? im.naturalWidth / VCELL : cur.p.w, h = im ? im.naturalHeight / VCELL : cur.p.h;
    let grow = null;
    // Grid size in the file name: "tavern 30x40.jpg" (squares) or "tavern 140dpi.jpg" / "140px" (pixels a square).
    const g = im && file && vGridFromName(file.name, im.naturalWidth, im.naturalHeight);
    if (g) { w = g.w; h = g.h; if (layer === "map" && (w > cur.p.w + 0.01 || h > cur.p.h + 0.01)) grow = "grow"; toast(`Read the grid from the file name: ${+w.toFixed(1)} × ${+h.toFixed(1)} squares.`); }
    else if (w > cur.p.w + 0.01 || h > cur.p.h + 0.01) {
      grow = await new Promise(r => openModal(`<h2>The image is bigger than the board</h2>
        <p>At ${VCELL} pixels a square it covers about <strong>${Math.ceil(w)} × ${Math.ceil(h)}</strong> squares; the board is <strong>${cur.p.w} × ${cur.p.h}</strong>.</p>
        <div class="acts wrap"><button class="btn" id="vfit">Shrink the image to fit</button><button class="btn" id="vgrow">Grow the board to ${Math.ceil(Math.max(w, cur.p.w))} × ${Math.ceil(Math.max(h, cur.p.h))}</button><button class="btn ghost" id="vkeep">Leave it as it is</button></div>`, m => {
          m.querySelector("#vfit").onclick = () => { closeModal(); r("fit"); }; m.querySelector("#vgrow").onclick = () => { closeModal(); r("grow"); }; m.querySelector("#vkeep").onclick = () => { closeModal(); r("keep"); };
        }));
      if (grow === "fit") { const f = Math.min(cur.p.w / w, cur.p.h / h); w *= f; h *= f; }
    }
    const o = { id: vid("o"), layer, img: url, x: 0, y: 0, w, h, level: VTT.lvl || 0 };
    const fields = { objs: (layer === "map" ? [o] : []).concat(cur.p.objs || [], layer === "map" ? [] : [o]) };
    if (grow === "grow") { fields.w = Math.max(cur.p.w, Math.ceil(w - 0.01)); fields.h = Math.max(cur.p.h, Math.ceil(h - 0.01)); }
    VTT.sel = { kind: "obj", id: o.id };
    await vPatch("vttpages/" + cur.id, fields);
    if (grow === "grow") { VTT.fitDone = ""; }
  });
}
function vTokenPick() {
  const cur = vPageNow(); if (!cur) return;
  const creatures = [...S.entries].filter(([, e]) => e.type === "creature").sort((a, b) => String(a[1].title).localeCompare(b[1].title));
  const chars = [...S.chars].sort((a, b) => String(a[1].name).localeCompare(b[1].name));
  const tile = (ref, name, img, sub) => `<button class="vtpick" data-ref="${esc(ref)}" data-name="${esc(name)}">${img ? `<img src="${esc(img)}" alt="">` : `<span class="vinit">${esc((name || "?")[0])}</span>`}<span>${esc(name)}${sub ? `<small class="muted">${esc(sub)}</small>` : ""}</span></button>`;
  openModal(`<h2>Add a token</h2><input id="vtq" type="search" placeholder="Search creatures and characters" aria-label="Search">
    <div class="vtpicks"><h3>Characters</h3><div class="vtgrid">${chars.map(([id, c]) => tile("c:" + id, c.name, c.token || c.image, charSub ? charSub(c) : "")).join("") || `<p class="muted small">No characters.</p>`}</div>
    <h3>Bestiary</h3><div class="vtgrid">${creatures.map(([id, e]) => tile("e:" + id, e.title, e.token || e.image, (e.statblock && e.statblock.subtitle) ? e.statblock.subtitle.split(",")[0] : "")).join("") || `<p class="muted small">No creatures yet.</p>`}</div></div>
    <div class="acts"><button class="btn ghost" id="vtnew">Upload a new token picture…</button><button class="btn ghost" data-act="closemodal">Close</button></div>`, m => {
    const q = m.querySelector("#vtq");
    q.oninput = () => { const s = q.value.trim().toLowerCase(); m.querySelectorAll(".vtpick").forEach(b => b.hidden = s && !b.dataset.name.toLowerCase().includes(s)); };
    m.querySelectorAll(".vtpick").forEach(b => b.onclick = () => { closeModal(); vPlaceToken(b.dataset.ref, b.dataset.name); });
    m.querySelector("#vtnew").onclick = () => { closeModal(); pickImage(async res => { const name = await vAsk("Name this token", "Name", "", "Add token"); vPlaceToken("", name || "Token", assetPath(res)); }); };
  });
}
function vPlaceToken(ref, name, img) {
  const cur = vPageNow(), view = document.getElementById("vview"); if (!cur) return;
  let size = 1, hpMax = null; if (ref.startsWith("e:")) { const e = S.entries.get(ref.slice(2)); if (e) { size = vSizeOf(e); hpMax = parseInt(String((e.statblock || {}).hp || ""), 10) || null; } }
  const r = view.getBoundingClientRect(), cx = ((r.width / 2 - VTT.panX) / VTT.zoom) / VCELL, cy = ((r.height / 2 - VTT.panY) / VTT.zoom) / VCELL;
  const x = Math.max(0, Math.min(cur.p.w - size, Math.round(cx - size / 2))), y = Math.max(0, Math.min(cur.p.h - size, Math.round(cy - size / 2)));
  const id = vid("t");
  const owner = ref.startsWith("c:") ? ref.slice(2) : "";
  VTT.sel = { kind: "tok", id };
  if (VTT.layer !== "gm" && VTT.layer !== "token") VTT.layer = "token";
  vSave("vtttokens/" + id, { page: cur.id, layer: VTT.layer === "gm" ? "gm" : "token", x, y, size, img: img || "", name, ref, owner, hp: hpMax, hpMax, created: new Date().toISOString() });
}

// ----- Page settings -----
function vSettings() {
  const cur = vPageNow(); if (!cur) return;
  const p = cur.p;
  openModal(`<h2>Page settings</h2><form class="vset">
    <label><span>Name</span><input id="vs-name" type="text" value="${esc(p.name || "")}"></label>
    <div class="frow tight"><label><span>Width (squares)</span><input id="vs-w" type="number" min="1" max="200" value="${p.w}"></label><label><span>Height (squares)</span><input id="vs-h" type="number" min="1" max="200" value="${p.h}"></label><label><span>Background</span><input id="vs-bg" type="color" value="${esc(p.bg || "#1b1f27")}"></label></div>
    <label><span>Folder</span><select id="vs-folder"><option value="">(top level)</option>${vFolders(S.vttCamps.get(p.camp)).map(f => `<option value="${esc(f.id)}"${p.folder === f.id ? " selected" : ""}>${esc(vFolderPath(S.vttCamps.get(p.camp), f.parent) + f.name)}</option>`).join("")}</select></label>
    <label class="check"><input id="vs-open" type="checkbox"${p.open ? " checked" : ""}> Players can switch to this map themselves <small class="muted">it appears in their map list, like a base they can teleport to</small></label>
    <label class="check"><input id="vs-grid" type="checkbox"${p.grid !== false ? " checked" : ""}> Show the grid</label>
    <label class="check"><input id="vs-light" type="checkbox"${p.light ? " checked" : ""}> Dynamic lighting <small class="muted">players only see what their tokens can see past walls</small></label>
    <label class="check"><input id="vs-mem" type="checkbox"${p.fogMem !== false ? " checked" : ""}> Remember explored areas <small class="muted">places a token has seen stay dimly visible</small></label>
    <div class="acts wrap"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" id="vs-fog">Reset explored areas</button><button class="btn ghost" type="button" id="vs-walls">Remove all walls</button><button class="btn ghost danger" type="button" id="vs-del">Delete page</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div></form>`, m => {
    m.querySelector("form").onsubmit = ev => {
      ev.preventDefault();
      const n = (id, lo, hi, d) => Math.max(lo, Math.min(hi, Math.round(Number(m.querySelector(id).value) || d)));
      vPatch("vttpages/" + cur.id, { name: m.querySelector("#vs-name").value.trim() || "Page", w: n("#vs-w", 1, 200, 15), h: n("#vs-h", 1, 200, 15), bg: m.querySelector("#vs-bg").value, grid: m.querySelector("#vs-grid").checked, light: m.querySelector("#vs-light").checked, fogMem: m.querySelector("#vs-mem").checked, folder: m.querySelector("#vs-folder").value, open: m.querySelector("#vs-open").checked });
      VTT.fitDone = ""; closeModal();
    };
    m.querySelector("#vs-fog").onclick = async () => { closeModal(); if (await confirmBox("Forget everything the players' tokens have explored on this page?", "Reset")) { VTT.fogBits = null; VTT.fogKey = ""; await vDel("vttfog/" + cur.id).catch(() => {}); vDraw(); } };
    m.querySelector("#vs-walls").onclick = async () => { closeModal(); if (await confirmBox(`Remove all ${(p.walls || []).length} walls from this page?`, "Remove walls")) vPatch("vttpages/" + cur.id, { walls: [] }); };
    m.querySelector("#vs-del").onclick = async () => {
      closeModal(); if (!(await confirmBox(`Delete the page “${p.name}” and its tokens?`, "Delete page"))) return;
      for (const [tid] of vTokens(cur.id)) await vDel("vtttokens/" + tid);
      await vDel("vttfog/" + cur.id).catch(() => {}); await vDel("vttpages/" + cur.id); VTT.page = null; render();
    };
  });
}

// ----- Actions -----
async function vttAction(a, el, ev) {
  if (a === "vttpfloor") { VTT.pfloor = el.dataset.v === "" ? null : Number(el.dataset.v); vDraw(); return; }
  if (/^vtt(newcamp|rencamp|delcamp)$/.test(a)) return vttCampAction(a, el);
  const root = document.querySelector(".vtt"), camp = root && root.dataset.camp;
  if (a === "vttzoom") { const v = Number(el.dataset.v), view = document.getElementById("vview"), r = view.getBoundingClientRect(); if (!v) vFit(); else vZoomAt(v > 0 ? 1.25 : 0.8, r.width / 2, r.height / 2); return; }
  if (a === "vtttool" && !vCanEdit()) { vSetTool(["measure", "ping", "draw", "travel"].includes(el.dataset.v) ? el.dataset.v : "select"); return; }
  if (a === "vtttool" && el.dataset.v === "measure") { vSetTool(VTT.tool === "measure" && !vCanEdit() ? "select" : "measure"); return; }
  if (a === "vttmshape") { VTT.mshape = el.dataset.v; if (VTT.tool !== "measure") vSetTool("measure"); else { const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false); } return; }
  if (a === "vttmbeam") { VTT.mbeam = Number(el.value) || 5; if (VTT.meas && VTT.meas.shape === "beam") { VTT.meas.bw = VTT.mbeam; vLiveMeas(true); } vMeasDraw(); return; }
  if (a === "vttmclear") { vMeasClear(); return; }
  if (a === "vttmbcast") { VTT.mbcast = el.checked; try { localStorage.setItem("vttBcast", el.checked ? "1" : "0"); } catch (e) {} vLiveMeas(true); return; }
  if (a === "vttmyname") { const n = await vAsk("Your name", "Shown with your pings and measurements", vLiveName(), "Save"); if (!n) return; try { localStorage.setItem("vttName", n); } catch (e) {} vMeasToolsRefresh(); return; }
  if (a === "vttdmg") { vDamage(el); return; }
  if (a === "vttdmgmode") { VTT.dmgMode = el.dataset.v; vRefresh(); return; }
  if (a === "vttfly") { vFly(Number(el.dataset.v)); return; }
  if (a === "vttlvlup") { vTokLevel(Number(el.dataset.v)); return; }
  if (a === "vttsummon" || a === "vttunsummon") { const ref = el.dataset.ref, cid = ref.split(":")[1]; if (!vCanEdit() && !(PLAYER && S.chars.has(cid))) return; if (a === "vttsummon") vSummonPlace(ref, el.dataset.near); else vSummonRemove(ref); return; }
  if (a === "vttgoparty") { VTT.ppage = null; VTT.fitDone = ""; render(); return; }
  if (/^vttcond(add|n|del|info)$/.test(a)) return vCondAction(a, el);
  if (a === "vtttoklight") return; // handled on change
  if (a === "vttfxlocal") { VTT.fxOff = !VTT.fxOff; try { localStorage.setItem("vttFxOff", VTT.fxOff ? "1" : "0"); } catch (e) {} vDraw(); const tl = document.getElementById("vtools"); if (tl && vCanEdit()) tl.innerHTML = vToolsHtml(); return; }
  if (/^vttpen/.test(a)) return vPenAction(a, el);
  if (/^vttq/.test(a) && !/^vttq(new|edit|del|show|step)$/.test(a)) return vQuestAction(a, el);
  if (a === "vttinitmin") { VTT.initMin = !VTT.initMin; vInitDraw(true); return; }
  if (!vCanEdit()) return;
  if (/^vttinit/.test(a)) return vInitAction(a, el);
  if (/^vttq/.test(a)) return vQuestAction(a, el);
  if (/^vttmulti/.test(a)) return vMultiAction(a, el);
  if (a === "vttscaleclr") { const cur = vPageNow(); if (cur) vPatch("vttpages/" + cur.id, { scale: null }); return; }
  if (a === "vtttpace") { VTT.pace = el.dataset.v; if (VTT.meas && VTT.meas.shape === "travel") { VTT.meas.pace = VTT.pace; vMeasDraw(); vLiveMeas(true); } vMeasToolsRefresh(); return; }
  if (a === "vtttclear") { vMeasClear(); return; }
  if (a === "vttwsnap") { VTT.wallSnap = el.checked; try { localStorage.setItem("vttWallSnap", el.checked ? "1" : "0"); } catch (e) {} return; }
  if (a === "vttobjrot") { const cur = vPageNow(), o = cur && VTT.sel && (cur.p.objs || []).find(q => q.id === VTT.sel.id); if (o) vObjSet(o.id, { rot: (((Number(o.rot) || 0) + Number(el.dataset.v)) % 360 + 360) % 360 }); return; }
  if (a === "vtttokz") return vTokZ(el.dataset.v);
  if (a === "vttmapimg") { vAddImage("map"); return; }
  if (a === "vttwk") { VTT.wallKind = el.dataset.v; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); return; }
  if (a === "vttfxhide") { const cur = vPageNow(); if (!cur) return; vPatch("vttpages/" + cur.id, { fx: Object.assign({}, cur.p.fx, { hide: el.checked }) }); return; }
  if (a === "vttfx") { const cur = vPageNow(); if (!cur) return; const fx = Object.assign({ a: 60 }, cur.p.fx || {}, { k: el.value }); if ((cur.p.fx || {}).k === fx.k) return; cur.p.fx = fx; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vDraw(); vPatch("vttpages/" + cur.id, { fx }); return; }
  if (/^vttcl/.test(a) || a === "vttcondlib") return vCondLibAction(a, el);
  if (/^vttll/.test(a) || a === "vttlightlib") return vLightLibAction(a, el);
  if (/^vtt(maps|fold|newfolder|renfolder|delfolder|newmap|newmapimg|renpage|openmap|sendto)$/.test(a)) return vMapsAction(a, el);
  if (a === "vttlvlall") { VTT.lvlShow = null; VTT.sel = null; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vRefresh(); return; }
  if (a === "vttlvlshow") { const n = Number(el.dataset.v) || 0;
    if (!VTT.lvlShow) { VTT.lvlShow = new Set([n]); VTT.lvl = n; }
    else if (VTT.lvlShow.has(n)) { VTT.lvlShow.delete(n); if (!VTT.lvlShow.size) VTT.lvlShow = null; else if (VTT.lvl === n) VTT.lvl = Math.max(...VTT.lvlShow); }
    else { VTT.lvlShow.add(n); VTT.lvl = n; }
    VTT.sel = null; VTT.multi.clear(); VTT.draft = null; const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vRefresh(); return; }
  if (a === "vttlvl") { const n = Number(el.dataset.v) || 0; VTT.lvlShow = VTT.lvlShow && VTT.lvlShow.size === 1 && VTT.lvlShow.has(n) ? null : new Set([n]); VTT.lvl = n; VTT.sel = null; VTT.multi.clear(); VTT.draft = null; const tl0 = document.getElementById("vtools"); if (tl0) tl0.innerHTML = vToolsHtml(); const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml(); vRefresh(); return; }
  if (a === "vttaddlvl") { const cur = vPageNow(); if (!cur) return; const n = vMaxLevel(cur.p) + 1, name = await vAsk("New level", "Name (optional)", n === 1 ? "Rooftops / upper floor" : "Level " + n, "Add level"); if (name === "") return; const names = Object.assign({}, cur.p.levelNames || {}); names[n] = name; VTT.lvl = n; await vPatch("vttpages/" + cur.id, { maxLevel: n, levelNames: names }); return; }
  if (a === "vttrenlvl") { const cur = vPageNow(); if (el.dataset.v) VTT.lvl = Number(el.dataset.v) || 0; if (!cur || !VTT.lvl) return; const name = await vAsk("Rename level", "Name", vLevelName(cur.p, VTT.lvl), "Save"); if (!name) return; const names = Object.assign({}, cur.p.levelNames || {}); names[VTT.lvl] = name; vPatch("vttpages/" + cur.id, { levelNames: names }); return; }
  if (a === "vttcbar") { const t = S.vttTokens.get(el.dataset.id); if (!t) return; vPatch("vtttokens/" + el.dataset.id, { cbars: (t.cbars || []).map(b => b.id === el.dataset.b ? Object.assign({}, b, { cur: Math.max(0, Math.min(Number(b.max) || 0, (Number(b.cur) || 0) + Number(el.dataset.v))) }) : b) }); return; }
  if (a === "vttexfill") { const t = S.vttTokens.get(el.dataset.id), ex = vExOf(t); if (!ex) return; const max = ex.cur ? ex.max : ex.max + ex.rise; vPatch("vtttokens/" + el.dataset.id, { ex: max, exMax: max, exRise: ex.rise }); return; }
  if (a === "vttcbaradd" || a === "vttcbarrm") { const id = el.dataset.id, t = S.vttTokens.get(id); if (!t) return;
    const list = (t.cbars || []).slice();
    if (a === "vttcbaradd") list.push({ id: vid("b"), name: "", cur: 10, max: 10, color: ["#6f8cff", "#b46ee0", "#4cc3c9", "#e05a8a"][list.length % 4] }); else list.splice(list.findIndex(b => b.id === el.dataset.b), 1);
    S.vttTokens.set(id, Object.assign({}, t, { cbars: list })); vPatch("vtttokens/" + id, { cbars: list }); vTokOptions(id); return; }
  if (a === "vttopts") { if (VTT.sel && VTT.sel.kind === "tok") vTokOptions(VTT.sel.id); return; }
  if (a === "vttsize") { const box = el.closest(".vform"); if (box) { vPatch("vtttokens/" + box.dataset.tok, { size: Number(el.dataset.v) }); box.querySelectorAll("[data-act=vttsize]").forEach(b => { b.classList.toggle("on", b === el); b.setAttribute("aria-pressed", b === el); }); const cs = box.querySelector(".vsizec input"); if (cs) cs.value = ""; } return; }
  if (a === "vttdeltok") { closeModal(); VTT.sel = { kind: "tok", id: el.dataset.id }; vDeleteSel(); return; }
  if (a === "vttpage") { VTT.page = el.dataset.id; VTT.sel = null; VTT.draft = null; render(); }
  else if (a === "vttaddpage") { const name = await vAsk("New page", "Name", "Page " + (vPages(camp).length + 1), "Add page"); if (!name) return; VTT.page = await vNewPage(camp, name, vPages(camp).length); render(); }
  else if (a === "vttsend") { await vPatch("vttcamps/" + camp, { playerPage: VTT.page }); toast("Players are now on this page"); }
  else if (a === "vttsettings") { VTT.sel = null; VTT.multi.clear(); vRefresh(); const sd = document.getElementById("vside"); if (sd) { sd.scrollTop = 0; const f = sd.querySelector("#ps-name"); if (f) f.focus(); } }
  else if (a === "vttlayer") { VTT.layer = el.dataset.v; VTT.sel = null; if (VTT.tool === "wall" && VTT.layer !== "walls") VTT.tool = "select"; document.getElementById("vtools").innerHTML = vToolsHtml(); vRefresh(); }
  else if (a === "vtttool") vSetTool(el.dataset.v);
  else if (a === "vttpreview") { VTT.preview = el.checked; vDraw(); }
  else if (a === "vttaddimg") vAddImage();
  else if (a === "vtttokpick") vTokenPick();
  else if (a === "vttdel") vDeleteSel();
  else if (a === "vttobjfit") { const cur = vPageNow(), o = cur && (cur.p.objs || []).find(x => x.id === VTT.sel.id); if (o) vObjSet(o.id, { x: 0, y: 0, w: cur.p.w, h: cur.p.h }); }
  else if (a === "vttobjz") { const cur = vPageNow(); if (!cur) return; const objs = (cur.p.objs || []).slice(), i = objs.findIndex(x => x.id === VTT.sel.id); if (i < 0) return; const [o] = objs.splice(i, 1); if (el.dataset.v === "back") objs.unshift(o); else objs.push(o); vPatch("vttpages/" + cur.id, { objs }); }
}
// Fields in the side panel.
document.addEventListener("change", ev => {
  const cb = ev.target.closest && ev.target.closest(".vform .vcbrow [data-cb]");
  if (cb && vCanEdit()) { const form = cb.closest(".vform"), row = cb.closest(".vcbrow"), id = form.dataset.tok, t = S.vttTokens.get(id); if (!t) return;
    const k = cb.dataset.cb, v = k === "cur" || k === "max" ? Math.max(0, Number(cb.value) || 0) : cb.value;
    vPatch("vtttokens/" + id, { cbars: (t.cbars || []).map(b => b.id === row.dataset.b ? Object.assign({}, b, { [k]: v }) : b) }); return; }
  const f = ev.target.closest && ev.target.closest(".vform [data-vf]"); if (!f || !vCanEdit()) return;
  const form = f.closest(".vform"), k = f.dataset.vf;
  if (form.dataset.tok) { let v = ["size", "hp", "hpMax", "temp", "dv", "ex", "exMax", "exRise"].includes(k) ? (f.value === "" ? null : Number(f.value)) : f.value; if (k === "size") { if (!(v > 0)) return; v = Math.max(0.5, Math.min(40, Math.round(v * 2) / 2)); form.querySelectorAll("[data-act=vttsize]").forEach(b => b.classList.toggle("on", Number(b.dataset.v) === v)); } vPatch("vtttokens/" + form.dataset.tok, { [k]: v }); }
  else if (form.dataset.obj) { const v = k === "w" || k === "h" ? Math.max(0.25, Number(f.value) || 1) : k === "level" ? Number(f.value) || 0 : f.value; if (k === "layer") VTT.layer = v; vObjSet(form.dataset.obj, { [k]: v }); const tl = document.getElementById("vtools"); if (tl && k === "layer") tl.innerHTML = vToolsHtml(); }
});

// ----- Measuring -----
const VSHAPES = [["line", "📏", "Ruler"], ["beam", "▬", "Line / beam"], ["cone", "◣", "Cone"], ["square", "■", "Cube / square"], ["circle", "●", "Sphere / circle"]];
function vMeasToolsHtml(gm) {
  const on = VTT.tool === "measure";
  const bc = window.__CODEX_SERVER ? `<label class="check small vbcast" title="Everyone at the table sees your measurements"><input type="checkbox" data-act="vttmbcast"${VTT.mbcast ? " checked" : ""}> Broadcast</label>` : "";
  const clr = VTT.meas ? `<button class="vbtn" data-act="vttmclear" title="Clear your measurement (Esc)">✕ Clear</button>` : "";
  const shapes = VSHAPES.map(([v, i, l]) => `<button class="vbtn icon${VTT.mshape === v ? " on" : ""}" data-act="vttmshape" data-v="${v}" title="${l}" aria-label="${l}" aria-pressed="${VTT.mshape === v}">${i}</button>`).join("");
  const beam = VTT.mshape === "beam" ? `<select data-act="vttmbeam" class="vbeamw" aria-label="Beam width">${[5, 10, 15, 20, 30].map(n => `<option value="${n}"${VTT.mbeam === n ? " selected" : ""}>${n} ft</option>`).join("")}</select>` : "";
  if (gm) return on || VTT.meas ? `<div class="vgroup"><span class="vlab">Measure</span>${on ? `<div class="vshapes">${shapes}</div>${beam ? `<label class="small">Width ${beam}</label>` : ""}` : ""}<div class="vmrow">${bc}${clr}</div></div>` : "";
  return `<button class="vbtn icon${!on && VTT.tool !== "ping" ? " on" : ""}" data-act="vtttool" data-v="select" title="Move tokens" aria-label="Move tokens">↖</button><button class="vbtn icon${on ? " on" : ""}" data-act="vtttool" data-v="measure" title="Measure (M)" aria-label="Measure">📏</button>${(((vPageNow() || {}).p || {}).scale || {}).len ? `<button class="vbtn icon${VTT.tool === "travel" ? " on" : ""}" data-act="vtttool" data-v="travel" title="Travel (T): click out a route to see how long it takes" aria-label="Travel">🧭</button>` : ""}<button class="vbtn icon${VTT.tool === "draw" ? " on" : ""}" data-act="vtttool" data-v="draw" title="Draw (D): doodle on the map" aria-label="Draw">✏️</button><button class="vbtn icon${VTT.tool === "ping" ? " on" : ""}" data-act="vtttool" data-v="ping" title="Ping (P): tap the map to point something out. You can also hold your finger or mouse still on the map." aria-label="Ping">📍</button>
    ${on ? `<span class="vsep"></span>${shapes}${beam}` : ""}${VTT.tool === "travel" ? `<span class="vsep"></span>${vTravelToolsHtml(false)}` : ""}${VTT.tool === "draw" ? `<span class="vsep"></span>${vPenHtml(false)}` : ""}${vQuestBtn()}${on || VTT.meas ? `<span class="vsep"></span>${bc}${clr}` : ""}${(((vPageNow() || {}).p || {}).fx || {}).k ? `<span class="vsep"></span><button class="vbtn icon${VTT.fxOff ? "" : " on"}" data-act="vttfxlocal" title="Weather and lighting effects on this device" aria-label="Weather effects" aria-pressed="${!VTT.fxOff}">🌦</button>` : ""}${window.__CODEX_SERVER ? `<span class="vsep"></span><button class="vbtn" data-act="vttmyname" title="Your name on pings and measurements">👤 ${esc(vLiveName())}</button>` : ""}`;
}
function vMeasToolsRefresh() { const tl = document.getElementById("vtools"); if (tl && vCanEdit()) tl.innerHTML = vToolsHtml(); const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false); }
function vMeasClear() { VTT.meas = null; vMeasDraw(); vLiveMeas(true); vMeasToolsRefresh(); }
// D&D 5e distance: every square, straight or diagonal, is 5 ft.
const vFt5 = (dx, dy) => Math.round(Math.max(Math.abs(dx), Math.abs(dy))) * 5;
const vFtE = (dx, dy) => Math.round(Math.hypot(dx, dy)) * 5;
function vMeasShape(m) {
  if (m.shape === "travel") { const pts = m.pts.concat(m.open && m.hover ? [m.hover] : []); return { path: pts, label: vTravelLabel(pts, m.pace), at: pts[pts.length - 1], nohits: true, travel: true }; }
  if (m.shape === "scale") return { line: [m.s[0], m.s[1], m.e[0], m.e[1]], label: "This much travel is…", at: m.e };
  if (m.shape === "path") { let ft = 0; for (let i = 1; i < m.pts.length; i++) ft += vFt5(m.pts[i][0] - m.pts[i - 1][0], m.pts[i][1] - m.pts[i - 1][1]); return { path: m.pts, label: `${ft} ft${m.pts.length > 2 ? ` · ${m.pts.length - 2} turn${m.pts.length > 3 ? "s" : ""}` : ""}`, at: m.pts[m.pts.length - 1] }; }
  const [sx, sy] = m.s, [ex, ey] = m.e, dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy), ux = L ? dx / L : 1, uy = L ? dy / L : 0;
  if (m.shape === "beam") { const bw = m.bw || VTT.mbeam, hw = (bw / 5) / 2, nx = -uy * hw, ny = ux * hw; return { poly: [[sx + nx, sy + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [sx - nx, sy - ny]], label: `${vFtE(dx, dy)} ft line, ${bw} ft wide`, at: [ex, ey] }; }
  if (m.shape === "cone") { const hw = L / 2, nx = -uy * hw, ny = ux * hw; return { poly: [[sx, sy], [ex + nx, ey + ny], [ex - nx, ey - ny]], label: `${vFtE(dx, dy)} ft cone`, at: [ex, ey] }; }
  if (m.shape === "square") { const side = Math.max(Math.abs(dx), Math.abs(dy)), side5 = Math.max(1, Math.round(side)), x2 = sx + Math.sign(dx || 1) * side5, y2 = sy + Math.sign(dy || 1) * side5; return { poly: [[sx, sy], [x2, sy], [x2, y2], [sx, y2]], label: `${side5 * 5} ft cube`, at: [x2, y2] }; }
  if (m.shape === "circle") { const r = Math.max(0.5, Math.round(L * 2) / 2); return { circle: [sx, sy, r], label: `${Math.round(r) * 5} ft radius`, at: [ex, ey] }; }
  return { line: [sx, sy, ex, ey], label: `${vFt5(dx, dy)} ft`, at: [ex, ey] };
}
function vMeasSvg(m, col, who) {
  const g = vMeasShape(m), C = VCELL, P = q => q[0] * C + "," + q[1] * C;
  let shape = "", cells = "";
  // Squares whose centres fall inside an area template get shaded.
  const inside = (cx, cy) => g.circle ? Math.hypot(cx - g.circle[0], cy - g.circle[1]) <= g.circle[2] + 1e-6 : g.poly ? vInPoly(cx, cy, g.poly) : false;
  if (g.path) {
    const cur = vPageNow(), hits = [];
    const segs = g.path.slice(1).map((b, i) => { const a = g.path[i], x = cur && !g.nohits ? vWallHits(cur.p, m.h || 0, a, b) : []; hits.push(...x); return `<line class="${x.length ? "blocked" : ""}" x1="${a[0] * C}" y1="${a[1] * C}" x2="${b[0] * C}" y2="${b[1] * C}"/>`; }).join("");
    shape = segs + g.path.slice(1, -1).map(q => `<circle class="wp" cx="${q[0] * C}" cy="${q[1] * C}" r="6"/>`).join("") + `<circle class="dot" cx="${g.path[0][0] * C}" cy="${g.path[0][1] * C}" r="5"/>` + hits.map(([hx, hy]) => `<g class="hit" transform="translate(${hx * C},${hy * C})"><circle r="11"/><path d="M-5 -5L5 5M5 -5L-5 5"/></g>`).join("");
  } else if (g.poly || g.circle) {
    const cur = vPageNow(), W = cur ? cur.p.w : 50, H = cur ? cur.p.h : 50;
    const xs = g.circle ? [g.circle[0] - g.circle[2], g.circle[0] + g.circle[2]] : g.poly.map(q => q[0]), ys = g.circle ? [g.circle[1] - g.circle[2], g.circle[1] + g.circle[2]] : g.poly.map(q => q[1]);
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(W, Math.ceil(Math.max(...xs))); x++) for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(H, Math.ceil(Math.max(...ys))); y++) if (inside(x + 0.5, y + 0.5)) cells += `<rect x="${x * C}" y="${y * C}" width="${C}" height="${C}"/>`;
    shape = g.circle ? `<circle cx="${g.circle[0] * C}" cy="${g.circle[1] * C}" r="${g.circle[2] * C}"/>` : `<polygon points="${g.poly.map(P).join(" ")}"/>`;
  } else shape = `<line x1="${g.line[0] * C}" y1="${g.line[1] * C}" x2="${g.line[2] * C}" y2="${g.line[3] * C}"/><circle class="dot" cx="${g.line[0] * C}" cy="${g.line[1] * C}" r="5"/>`;
  const label = (who ? who + " · " : "") + g.label, lx = g.at[0] * C + 14, ly = g.at[1] * C - 14, w = label.length * 8.4 + 18;
  return `<g class="mset${who ? " remote" : ""}"${col ? ` style="--mc:${esc(col)}"` : ""}><g class="cells">${cells}</g><g class="shape${m.shape === "move" || m.shape === "path" ? " move" : ""}${m.shape === "travel" ? " travel" : ""}">${shape}</g><g class="lbl" transform="translate(${lx},${ly})"><rect x="0" y="-16" rx="6" width="${w}" height="26"/><text x="9" y="2">${esc(label)}</text></g></g>`;
}
function vMeasDraw() {
  const svg = document.getElementById("vmeas"); if (!svg) return;
  const cur = vPageNow(), out = [];
  vLiveOthers(cur && cur.id).forEach(([, d]) => { if (d.meas) { try { out.push(vMeasSvg(d.meas, d.col, d.who || "Player")); } catch (e) {} } });
  if (VTT.meas) out.push(vMeasSvg(VTT.meas, VTT.mbcast && window.__CODEX_SERVER ? vLiveCol() : "", ""));
  if (VTT.mmove) out.push(vMeasSvg(VTT.mmove, "", ""));
  svg.innerHTML = out.join("");
}

// ----- Bars over tokens -----
// A character's slider resources (spell points, slider-style resources, slider lines on equipped items) sit above its HP.
// ----- Monster extras: the Exhaust Meter (soaks damage before HP) and the GM's own bars -----
// Exhaust comes from the stat block ("26 (→ +13)", or worked out for Large and bigger): 26 to start, and
// each refill after it breaks adds 13. On the token: ex (left), exMax, exRise; exMax 0 turns it off.
function vExParse(str) { const m = String(str || "").match(/(\d+)/), r = String(str || "").match(/\+\s*(\d+)/); return m ? { max: Number(m[1]), rise: r ? Number(r[1]) : 0 } : null; }
function vExOf(t) {
  if (!t || (t.ref || "").startsWith("c:") || (t.ref || "").startsWith("s:")) return null;
  let max = t.exMax, rise = t.exRise;
  if (max == null) { const e = (t.ref || "").startsWith("e:") ? S.entries.get(t.ref.slice(2)) : null, sb = e && e.statblock;
    const p = sb ? vExParse(sb.exhaust || (typeof sbAutoExhaust === "function" ? sbAutoExhaust(sb) : "")) : null; if (!p) return null; max = p.max; if (rise == null) rise = p.rise; }
  max = Number(max) || 0; if (!max) return null;
  const cur = t.ex != null && t.ex !== "" ? Math.max(0, Math.min(max, Number(t.ex) || 0)) : max;
  return { cur, max, rise: Number(rise) || 0 };
}
const vCBars = t => Array.isArray(t && t.cbars) ? t.cbars.filter(b => b && Number(b.max) > 0) : [];
function vBars(t) {
  const out = [];
  if (t.ref && t.ref.startsWith("c:")) {
    const c = S.chars.get(t.ref.slice(2)); if (!c) return out;
    const k = typeof casterOf === "function" ? casterOf(c) : null; if (k && k.max) out.push({ cur: k.left, max: k.max, color: "#6f8cff", label: "Spell points" });
    (c.resources || []).forEach(r => { if (r && r.style === "slider" && resMax(r, c)) out.push({ cur: charResHave(c, r), max: resMax(r, c), color: resColor(r.color), label: r.name }); });
    if (typeof equippedResItems === "function") equippedResItems(c).forEach(it => it.lines.forEach((r, i) => { if (resValid(r) && r.style === "slider" && resMax(r, c)) out.push({ cur: itemResHave(c, it.ref, i, r), max: resMax(r, c), color: resColor(r.color), label: r.name }); }));
    const hp = c.hp || {}; if (Number(hp.max)) out.push({ cur: Number(hp.cur) || 0, max: Number(hp.max), temp: Number(hp.temp) || 0, hp: true, label: "HP" });
  } else if (t.ref && t.ref.startsWith("s:")) {
    const sm = vSummonOf(t.ref); if (sm && smNowMax(sm)) out.push({ cur: smNowCur(sm), max: smNowMax(sm), temp: Number(sm.temp) || 0, hp: true, label: "HP" });
  } else {
    vCBars(t).forEach(b => out.push({ cur: Math.max(0, Math.min(Number(b.max), Number(b.cur) || 0)), max: Number(b.max), color: b.color || "#6f8cff", label: b.name || "Bar", cbar: b.id }));
    const ex = vExOf(t); if (ex) out.push({ cur: ex.cur, max: ex.max, color: "#e39a32", label: "Exhaust", ex: true });
    if (Number(t.hpMax)) out.push({ cur: Number(t.hp != null ? t.hp : t.hpMax) || 0, max: Number(t.hpMax), temp: Number(t.temp) || 0, hp: true, label: "HP" });
  }
  return out;
}
const vBarsPublic = t => t.bars ? t.bars === "all" : !!t.owner;
function vBarsHtml(t) {
  if (!vCanEdit() && !vBarsPublic(t)) return "";
  const bars = vBars(t); if (!bars.length) return "";
  return `<div class="vbars${vCanEdit() && !vBarsPublic(t) ? " gmbars" : ""}">${bars.map(b => { const pct = Math.max(0, Math.min(100, (b.cur / b.max) * 100)), hpc = pct > 50 ? "#4caf62" : pct > 25 ? "#d9a52b" : "#d0453a";
    return `<div class="vbar" title="${esc(b.label)} ${b.cur}/${b.max}${b.temp ? " +" + b.temp + " temp" : ""}"><i style="width:${pct}%;background:${b.hp ? hpc : b.color}"></i>${b.temp ? `<b style="width:${Math.min(100, (b.temp / b.max) * 100)}%"></b>` : ""}<span>${b.cur}/${b.max}</span></div>`; }).join("")}</div>`;
}
// Damage or heal from the side panel: a character's sheet, or the token's own HP.
function vDamage(el) {
  const box = el.closest(".vhpbox"), id = box && box.dataset.tok, t = id && S.vttTokens.get(id); if (!t) return;
  const n = Math.abs(parseInt(box.querySelector(".vhpn").value, 10) || 0); if (!n) return;
  const heal = el.dataset.v === "heal";
  const apply = (cur, max, temp) => { if (heal) return [Math.min(max, cur + n), temp]; let d = n; const tt = Math.min(temp, d); temp -= tt; d -= tt; return [Math.max(0, cur - d), temp]; };
  if (t.ref && t.ref.startsWith("s:")) {
    const [, cid, sid] = t.ref.split(":");
    charChange(cid, x => { x.summons = smList(x).map(sm => { if (sm.id !== sid) return sm; sm = Object.assign({}, sm); let temp = Number(sm.temp) || 0; const shifted = !!smView(sm)._form;
      if (heal) { if (shifted) sm.fhp = Math.min(smFormMax(sm), smNowCur(sm) + n); else sm.hp = Math.min(smMax(sm), smCur(sm) + n); return sm; }
      const tt = Math.min(temp, n); temp -= tt; let left = n - tt; sm.temp = temp;
      if (shifted) { const fc = smNowCur(sm); if (left < fc) { sm.fhp = fc - left; return sm; } left -= fc; sm.form = ""; sm.fhp = null; toast("The form dropped to 0 hit points: back to its true form."); }
      sm.hp = Math.max(0, smCur(sm) - left); return sm; }); });
    box.querySelector(".vhpn").value = ""; return;
  }
  if (t.ref && t.ref.startsWith("c:")) { charChange(t.ref.slice(2), x => { x.hp = Object.assign({ cur: 0, max: 0, temp: 0 }, x.hp); const [c2, t2] = apply(Number(x.hp.cur) || 0, Number(x.hp.max) || 0, Number(x.hp.temp) || 0); x.hp.cur = c2; x.hp.temp = t2; }); }
  else {
    const ex = vExOf(t), mode = VTT.dmgMode || "bps";
    if (!heal && ex && mode === "ex") { const left = Math.max(0, ex.cur - n); vPatch("vtttokens/" + id, Object.assign({ ex: left }, t.exMax == null ? { exMax: ex.max, exRise: ex.rise } : {})); if (!left && ex.cur) toast(`${t.name || "It"}'s Exhaust Meter is broken.`); box.querySelector(".vhpn").value = ""; return; }
    if (heal || !ex || !ex.cur || mode === "hp") { const [c2, t2] = apply(Number(t.hp != null ? t.hp : t.hpMax) || 0, Number(t.hpMax) || 0, Number(t.temp) || 0); vPatch("vtttokens/" + id, { hp: c2, temp: t2 }); }
    else {
      let d = n, temp = Number(t.temp) || 0; const tt = Math.min(temp, d); temp -= tt; d -= tt;
      const ed = Math.min(ex.cur, d), exLeft = ex.cur - ed; d -= ed;
      const hp = Math.max(0, (Number(t.hp != null ? t.hp : t.hpMax) || 0) - d);
      vPatch("vtttokens/" + id, Object.assign({ temp, ex: exLeft, hp }, t.exMax == null ? { exMax: ex.max, exRise: ex.rise } : {}));
      if (!exLeft) toast(`${t.name || "It"}'s Exhaust Meter is broken${d ? ` (${d} went on to its HP)` : ""}.`);
    }
  }
  box.querySelector(".vhpn").value = "";
}
document.addEventListener("change", ev => { if (ev.target.matches && ev.target.matches(".vbeamw")) { VTT.mbeam = Number(ev.target.value) || 5; if (VTT.meas && VTT.meas.shape === "beam") { VTT.meas.bw = VTT.mbeam; vLiveMeas(true); } vMeasDraw(); } });

// ----- The side panel for a token: its bars, damage and healing, then its stat block or character sheet -----
function vTokSideHtml(id, t) {
  const gm = vCanEdit(), mine = !gm && PLAYER && !!t.owner;
  if (!gm && !mine) return "";
  const isChar = t.ref && t.ref.startsWith("c:"), c = isChar ? S.chars.get(t.ref.slice(2)) : null;
  const e = t.ref && t.ref.startsWith("e:") ? S.entries.get(t.ref.slice(2)) : null;
  const bars = vBars(t), canHp = gm || (mine && (isChar || (t.ref || "").startsWith("s:")));
  const barHtml = bars.length ? `<div class="vsbars">${bars.map(b => { const pct = Math.max(0, Math.min(100, (b.cur / b.max) * 100)), hpc = pct > 50 ? "#4caf62" : pct > 25 ? "#d9a52b" : "#d0453a";
    const ctl = gm && b.cbar ? `<span class="vsbctl"><button class="iconbtn" data-act="vttcbar" data-id="${esc(id)}" data-b="${esc(b.cbar)}" data-v="-1" aria-label="One less">−</button><button class="iconbtn" data-act="vttcbar" data-id="${esc(id)}" data-b="${esc(b.cbar)}" data-v="1" aria-label="One more">+</button></span>`
      : gm && b.ex ? `<span class="vsbctl"><button class="btn ghost small" data-act="vttexfill" data-id="${esc(id)}" title="${b.cur ? "Fill the meter back up" : "It broke: refill it" + (vExOf(t).rise ? `, ${vExOf(t).rise} bigger` : "")}">${b.cur ? "Refill" : `Refill${vExOf(t).rise ? " +" + vExOf(t).rise : ""}`}</button></span>` : "";
    return `<div class="vsbar${b.ex && !b.cur ? " broken" : ""}"><div class="vsbl"><span>${esc(b.label)}${b.ex && !b.cur ? " · broken" : ""}</span><strong>${b.cur}<small> / ${b.max}${b.temp ? ` · +${b.temp} temp` : ""}</small></strong>${ctl}</div><div class="vsbt"><i style="width:${pct}%;background:${b.hp ? hpc : b.color}"></i>${b.temp ? `<b style="width:${Math.min(100, (b.temp / b.max) * 100)}%"></b>` : ""}</div></div>`; }).join("")}</div>` : "";
  const sm = t.ref && t.ref.startsWith("s:") ? vSummonOf(t.ref) : null;
  const canFly = gm || mine, fly = Math.max(0, Number(t.fly) || 0);
  const dmgMode = VTT.dmgMode || "bps", exT = !isChar && !sm && vExOf(t);
  const dmgType = gm && exT ? `<div class="vdmgtype" role="group" aria-label="What the damage hits">${[["bps", "Bludgeoning, piercing, slashing", "B / P / S", "Exhaust first, the rest to HP"], ["ex", "Exhaust only", "Exhaust", "Only the Exhaust Meter"], ["hp", "Other damage types", "HP only", "Skips the Exhaust Meter"]].map(([v, aria, lab, tip]) => `<button type="button" class="${dmgMode === v ? "on" : ""}" data-act="vttdmgmode" data-v="${v}" aria-pressed="${dmgMode === v}" aria-label="${aria}" title="${tip}">${lab}</button>`).join("")}</div>` : "";
  const dmg = canHp && (isChar || sm || t.hpMax || vExOf(t)) ? dmgType + `<div class="vhpbox" data-tok="${esc(id)}"><input class="vhpn" type="number" min="0" placeholder="0" aria-label="Amount"><button class="btn small danger" data-act="vttdmg" data-v="dmg">Damage</button><button class="btn small" data-act="vttdmg" data-v="heal">Heal</button></div>` : "";
  const pg = (vPageNow() || {}).p || {}, lv = Math.max(0, Number(t.lvl) || 0);
  const lvlRow = vMaxLevel(pg) > 0 || lv ? `<div class="vflyrow"><span>Standing on</span>${canFly ? `<button class="iconbtn" data-act="vttlvlup" data-v="-1" aria-label="Down a level"${lv ? "" : " disabled"}>−</button>` : ""}<strong class="vlvlname">${esc(vLevelName(pg, lv))}</strong>${canFly ? `<button class="iconbtn" data-act="vttlvlup" data-v="1" aria-label="Up a level"${lv < vMaxLevel(pg) ? "" : " disabled"}>+</button>` : ""}</div>` : "";
  const flyRow = canFly || fly ? `<div class="vflyrow"><span>Flight band</span>${canFly ? `<button class="iconbtn" data-act="vttfly" data-v="-1" aria-label="Fly lower"${fly ? "" : " disabled"}>−</button>` : ""}<strong>${fly || "Ground"}</strong>${canFly ? `<button class="iconbtn" data-act="vttfly" data-v="1" aria-label="Fly higher">+</button>` : ""}</div>` : "";
  const head = `<div class="vshead"><div><h2>${esc(t.name || "Token")}</h2>${c ? `<p class="muted small">${esc(charSub(c))}</p>` : sm ? `<p class="muted small">${esc(sm.kind || "Summon")} · summoned by ${esc((S.chars.get(t.owner) || {}).name || "")}</p>` : e && e.statblock && e.statblock.subtitle ? `<p class="muted small">${esc(e.statblock.subtitle)}</p>` : ""}</div>
    ${gm ? `<button class="btn ghost small" data-act="vttopts" title="Name, size, layer, who controls it, who sees its bars">⚙ Options</button>` : ""}</div>`;
  let body = "";
  if (c) {
    const cid = t.ref.slice(2), P = canPlay(), eq = equippedParts(c, cid), xa = attacksPerAction(c);
    body = `<div class="vschips"><span><b>AC</b>${esc(cAC(c))}</span><span><b>Speed</b>${esc(c.speed || "—")}</span><span><b>Init</b>${esc(cInit(c))}</span><span><b>Prof</b>${signed(cPB(c))}</span></div>
      <div class="vsabil">${ABILS.map(([a, l]) => `<div><span>${esc(l.slice(0, 3))}</span><strong>${signed(cMod(c, a))}</strong><small>${cScore(c, a)}</small></div>`).join("")}</div>
      ${eq.rows.length || (c.attacks || []).length ? `<h3 class="fgh">Attacks${xa.n > 1 ? ` <small class="muted">×${xa.n} per Attack action</small>` : ""}</h3><table class="atktab vsatk"><tbody>${eq.rows.join("")}${(c.attacks || []).map(a => `<tr><td>${esc(a.name)}</td><td class="num">${esc(a.bonus || "")}</td><td>${esc(a.damage || "")} ${esc(a.type || "")}</td><td></td></tr>`).join("")}</tbody></table>` : ""}
      <h3 class="fgh">Resources</h3>${resourcesSectionHtml(c, cid, false, P)}
      ${smList(c).length ? `<h3 class="fgh">Summons</h3><div class="vsums">${smList(c).map(x => { const ref = "s:" + cid + ":" + x.id, onBoard = vTokens(VTT.page || vCurrentPage(document.querySelector(".vtt").dataset.camp)).some(([, tt]) => tt.ref === ref), img = vTokenImg(ref);
        return `<div class="vsum">${img ? `<img src="${esc(img)}" alt="">` : `<span class="vinit">${esc((x.name || "?")[0])}</span>`}<div><strong>${esc(x.name || x.kind)}</strong><small class="muted">${esc(x.kind || "")} · ${smNowCur(x)}/${smNowMax(x)} HP</small></div>
          ${gm || mine ? (onBoard ? `<button class="btn ghost small" data-act="vttunsummon" data-ref="${esc(ref)}">Unsummon</button>` : `<button class="btn small" data-act="vttsummon" data-ref="${esc(ref)}" data-near="${esc(id)}">Summon</button>`) : ""}</div>`; }).join("")}</div>` : ""}
      <p><a href="#char-${esc(cid)}" target="_blank" rel="noopener">Open the full character sheet ↗</a></p>`;
  } else if (sm) {
    const [, cid, sid] = t.ref.split(":"), v = smView(sm);
    body = `${vSmFormCtl(id, t, sm, cid, gm || mine)}${v._form ? `<p class="ssnote">In the form of <strong>${esc(v._form.title)}</strong>.</p>` : ""}<div class="vssb">${statBlockHtml(Object.assign({}, v.sb || {}, { hp: `${smNowCur(sm)} / ${smNowMax(sm)}${sm.temp ? ` (+${sm.temp} temp)` : ""}` }), sm.name || sm.kind, "core")}${(v.sb || {}).features ? featuresHtml(v.sb, sm.ref || "", "sm:" + cid + ":" + sid) : ""}</div>
      <p><a href="#char-${esc(cid)}" target="_blank" rel="noopener">Open the character's summons ↗</a></p>`;
  } else if (e && e.statblock && t.form && S.entries.get(t.form)) {
    const f = S.entries.get(t.form);
    body = `${vFormCtl(id, t, e, gm)}<p class="ssnote">In the form of <a href="#entry-${esc(t.form)}" target="_blank" rel="noopener">${esc(f.title)}</a>.</p><div class="vssb">${f.statblock ? statBlockHtml(f.statblock, f.title, "core") + (f.statblock.features ? featuresHtml(f.statblock, t.form, "e:tok-" + id) : "") : ""}</div>
      <details class="smfull"><summary>True form: ${esc(e.title)}</summary><div class="vssb">${statBlockHtml(e.statblock, e.title, "core")}</div></details>`;
  } else if (e && e.statblock) {
    body = vFormCtl(id, t, e, gm);
    body += `<div class="vssb">${statBlockHtml(Object.assign({}, e.statblock, t.hpMax ? { hp: `${t.hp != null ? t.hp : t.hpMax} / ${t.hpMax}${t.temp ? ` (+${t.temp} temp)` : ""} · stat block: ${e.statblock.hp || "—"}` } : {}), e.title, "core")}${featuresHtml(e.statblock, t.ref.slice(2), "e:tok-" + id)}</div>
      <p><a href="#entry-${esc(t.ref.slice(2))}" target="_blank" rel="noopener">Open the bestiary entry ↗</a></p>`;
  } else if (e) body = `<p><a href="#entry-${esc(t.ref.slice(2))}" target="_blank" rel="noopener">Open the entry ↗</a></p>`;
  else body = gm ? `<p class="muted small">A token with no library link. Use Options to set its name, size and HP.</p>` : "";
  const order = gm ? `<div class="vflyrow vorder"><span>Order</span><div class="seg"><button type="button" data-act="vtttokz" data-v="back" title="Send to the back ([ key twice)">⇊ Back</button><button type="button" data-act="vtttokz" data-v="down" title="Send backward ([)">↓</button><button type="button" data-act="vtttokz" data-v="up" title="Bring forward (])">↑</button><button type="button" data-act="vtttokz" data-v="front" title="Bring to the front">⇈ Front</button></div></div>` : "";
  return head + barHtml + dmg + lvlRow + flyRow + order + vTokLightHtml(id, t, canFly) + vCondSideHtml(id, t, canFly) + (gm ? vInitTokBtn(id, t) : "") + body;
}
// Token options: everything about the token itself, in a pop-up so the side stays for the sheet.
function vTokOptions(id) {
  const t = S.vttTokens.get(id); if (!t) return;
  const chars = [...S.chars].filter(([, c]) => !c.hidden).sort((a, b) => String(a[1].name).localeCompare(b[1].name));
  const isChar = t.ref && t.ref.startsWith("c:");
  openModal(`<h2>Token options</h2><div class="vform vopts" data-tok="${esc(id)}">
    <label><span>Name</span><input type="text" data-vf="name" value="${esc(t.name || "")}"></label>
    <div><span class="flabel">Size</span><div class="vsizerow"><div class="seg vsize" role="group" aria-label="Size">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${(t.size || 1) === n ? "on" : ""}" data-act="vttsize" data-v="${n}" aria-pressed="${(t.size || 1) === n}">${n}×${n}</button>`).join("")}</div>
      <label class="vsizec"><span>Custom</span><input type="number" min="0.5" max="40" step="0.5" data-vf="size" value="${(t.size || 1) > 5 || (t.size || 1) % 1 ? t.size : ""}" placeholder="e.g. 8" aria-label="Custom size in squares"><small class="muted">squares</small></label></div></div>
    <label><span>Layer</span><select data-vf="layer"><option value="token"${t.layer !== "gm" ? " selected" : ""}>Tokens (players see it)</option><option value="gm"${t.layer === "gm" ? " selected" : ""}>GM only</option></select></label>
    <label><span>Controlled by <small class="muted">its player can move it and sees through its eyes</small></span><select data-vf="owner"><option value="">Nobody (GM only)</option>${chars.map(([cid, c]) => `<option value="${esc(cid)}"${t.owner === cid ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
    <label><span>Darkvision (ft) <small class="muted">blank: from the sheet or stat block${(d => d ? ` (${d} ft)` : "")(vDarkvisionAuto(t))}</small></span><input type="number" min="0" step="5" data-vf="dv" value="${t.dv != null ? t.dv : ""}" placeholder="auto"></label>
    <label><span>Bars shown to</span><select data-vf="bars"><option value="all"${vBarsPublic(t) ? " selected" : ""}>Everyone</option><option value="gm"${!vBarsPublic(t) ? " selected" : ""}>GM only</option></select></label>
    ${isChar || (t.ref || "").startsWith("s:") ? `<p class="muted small">HP and the bars come from the ${isChar ? "character sheet" : "summon on its character's sheet"}.</p>` : `<div class="frow tight"><label><span>HP</span><input type="number" data-vf="hp" value="${t.hp != null ? t.hp : (t.hpMax || "")}"></label><label><span>Max HP</span><input type="number" data-vf="hpMax" value="${t.hpMax || ""}"></label><label><span>Temp HP</span><input type="number" data-vf="temp" value="${t.temp || ""}"></label></div>`}
    ${isChar || (t.ref || "").startsWith("s:") ? "" : (() => { const ex = vExOf(t) || { cur: "", max: "", rise: "" }; return `<h3 class="vopth">Exhaust Meter <small class="muted">soaks damage before HP${t.exMax == null && vExOf(t) ? " · from the stat block" : ""}</small></h3>
      <div class="frow tight"><label><span>Left</span><input type="number" min="0" data-vf="ex" value="${ex.cur}"></label><label><span>Meter</span><input type="number" min="0" data-vf="exMax" value="${ex.max}" placeholder="none"></label><label><span>Grows by</span><input type="number" min="0" data-vf="exRise" value="${ex.rise}"></label></div>
      <h3 class="vopth">Custom bars <small class="muted">rage, stagger, a ward, anything you track</small></h3>
      <div class="vcbars">${(t.cbars || []).map(b => `<div class="vcbrow" data-b="${esc(b.id)}"><input type="text" data-cb="name" value="${esc(b.name || "")}" placeholder="Name" aria-label="Bar name"><input type="number" min="0" data-cb="cur" value="${Number(b.cur) || 0}" aria-label="Current"><span>/</span><input type="number" min="1" data-cb="max" value="${Number(b.max) || 0}" aria-label="Maximum"><input type="color" data-cb="color" value="${esc(b.color || "#6f8cff")}" aria-label="Colour"><button type="button" class="iconbtn" data-act="vttcbarrm" data-id="${esc(id)}" data-b="${esc(b.id)}" aria-label="Remove bar">✕</button></div>`).join("")}</div>
      <button type="button" class="btn ghost small" data-act="vttcbaradd" data-id="${esc(id)}">+ Add a bar</button>`; })()}
    <div class="acts"><button class="btn" type="button" data-act="closemodal">Done</button><button class="btn ghost danger" type="button" data-act="vttdeltok" data-id="${esc(id)}">Delete token</button></div></div>`);
}

// ----- Organising maps: folders (acts, towns, trails…) holding maps -----
// camp.folders = [{ id, name, parent }]; page.folder = folder id; page.open = players may switch to it themselves.
const vFolders = c => Array.isArray(c && c.folders) ? c.folders : [];
function vFolderPath(c, fid) { const out = [], seen = new Set(); let f = vFolders(c).find(x => x.id === fid); while (f && !seen.has(f.id)) { seen.add(f.id); out.unshift(f.name); f = vFolders(c).find(x => x.id === f.parent); } return out.length ? out.join(" / ") + " / " : ""; }
const VCLOSED = (() => { try { return new Set(JSON.parse(localStorage.getItem("vttClosed") || "[]")); } catch (e) { return new Set(); } })();
const vSaveClosed = () => { try { localStorage.setItem("vttClosed", JSON.stringify([...VCLOSED])); } catch (e) {} };
function vMapsHtml(camp) {
  const c = S.vttCamps.get(camp); if (!c) return "";
  const pid = VTT.page, folders = vFolders(c), pages = vPages(camp);
  const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true });
  const tree = (parent, d) => {
    const fs = folders.filter(f => (f.parent || "") === parent).sort(byName);
    const ps = pages.filter(([, p]) => (p.folder || "") === parent && (parent === "" || folders.some(f => f.id === parent)) || (parent === "" && p.folder && !folders.some(f => f.id === p.folder)));
    return fs.map(f => { const open = !VCLOSED.has(f.id); return `<div class="vmrow vmfolder" draggable="true" data-fid="${esc(f.id)}" style="--d:${d}">
        <button class="vmtw" data-act="vttfold" data-id="${esc(f.id)}" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} ${esc(f.name)}">${open ? "▾" : "▸"}</button><span class="vmname">📁 ${esc(f.name)}</span>
        <span class="vmacts"><button data-act="vttnewmap" data-folder="${esc(f.id)}" title="New map in ${esc(f.name)}">+🗺</button><button data-act="vttnewmapimg" data-folder="${esc(f.id)}" title="New map from an image in ${esc(f.name)}">+🖼</button><button data-act="vttnewfolder" data-folder="${esc(f.id)}" title="New folder in ${esc(f.name)}">+📁</button><button data-act="vttrenfolder" data-id="${esc(f.id)}" title="Rename">✎</button><button data-act="vttdelfolder" data-id="${esc(f.id)}" title="Delete folder">🗑</button></span></div>
        ${open ? tree(f.id, d + 1) : ""}`; }).join("")
      + ps.sort((a, b) => (a[1].order || 0) - (b[1].order || 0) || byName(a[1], b[1])).map(([id, p]) => `<div class="vmrow vmpage${id === pid ? " on" : ""}" draggable="true" data-pid="${esc(id)}" style="--d:${d}">
        <button class="vmopen" data-act="vttpage" data-id="${esc(id)}">${c.playerPage === id ? `<span class="vstar" title="The party is here">★</span>` : "🗺"} ${esc(p.name || "Map")}</button>
        <span class="vmacts"><button class="vmeye${p.open ? " on" : ""}" data-act="vttopenmap" data-id="${esc(id)}" title="${p.open ? "Players can switch to this map themselves (click to stop)" : "Let players switch to this map themselves"}" aria-pressed="${!!p.open}">👁</button><button data-act="vttsendto" data-id="${esc(id)}" title="Send the party here">★</button><button data-act="vttrenpage" data-id="${esc(id)}" title="Rename">✎</button></span></div>`).join("");
  };
  return `<div class="vmhead"><strong>Maps</strong><span class="vmacts always"><button data-act="vttnewmap" data-folder="" title="New map">+ Map</button><button data-act="vttnewmapimg" data-folder="" title="New map from an image: the board is sized to fit it">+ From image</button><button data-act="vttnewfolder" data-folder="" title="New folder">+ Folder</button><button data-act="vttmaps" title="Close">✕</button></span></div>
    <div class="vmtree" data-fid="">${tree("", 0) || `<p class="muted small">No maps yet.</p>`}</div>
    <div class="vmroot" data-fid="">Drop here to move to the top level</div>
    <p class="muted small vmhelp">Drag maps and folders to reorganise. <span class="vmeye on">👁</span> lets players switch to a map themselves; <span class="vstar">★</span> is where the party is.</p>`;
}
function vMapsRefresh() { const m = document.getElementById("vmaps"); if (m) m.innerHTML = vMapsHtml(document.querySelector(".vtt").dataset.camp); }
async function vMapsAction(a, el) {
  const root = document.querySelector(".vtt"), camp = root && root.dataset.camp, c = camp && S.vttCamps.get(camp); if (!c) return;
  const folders = vFolders(c).map(f => Object.assign({}, f));
  if (a === "vttmaps") { VTT.mapsOpen = !VTT.mapsOpen; render(); return; }
  if (a === "vttfold") { const id = el.dataset.id; if (VCLOSED.has(id)) VCLOSED.delete(id); else VCLOSED.add(id); vSaveClosed(); vMapsRefresh(); return; }
  if (a === "vttnewfolder") { const name = await vAsk("New folder", "Name", "", "Create"); if (!name) return; folders.push({ id: vid("f"), name, parent: el.dataset.folder || "" }); if (el.dataset.folder) VCLOSED.delete(el.dataset.folder); await vPatch("vttcamps/" + camp, { folders }); return; }
  if (a === "vttrenfolder") { const f = folders.find(x => x.id === el.dataset.id); if (!f) return; const name = await vAsk("Rename folder", "Name", f.name, "Save"); if (!name) return; f.name = name; await vPatch("vttcamps/" + camp, { folders }); return; }
  if (a === "vttdelfolder") {
    const f = folders.find(x => x.id === el.dataset.id); if (!f) return;
    if (!(await confirmBox(`Delete the folder “${f.name}”? Its maps and folders move up a level; nothing else is deleted.`, "Delete folder"))) return;
    for (const [pid, p] of vPages(camp)) if (p.folder === f.id) await vPatch("vttpages/" + pid, { folder: f.parent || "" });
    await vPatch("vttcamps/" + camp, { folders: folders.filter(x => x.id !== f.id).map(x => x.parent === f.id ? Object.assign(x, { parent: f.parent || "" }) : x) });
    return;
  }
  if (a === "vttnewmapimg") { vNewMapFromImage(camp, el.dataset.folder || ""); return; }
  if (a === "vttnewmap") { const name = await vAsk("New map", "Name", "", "Create"); if (!name) return; if (el.dataset.folder) VCLOSED.delete(el.dataset.folder); const nid = await vNewPage(camp, name, vPages(camp).length, el.dataset.folder || ""); for (let i = 0; i < 40 && !S.vttPages.has(nid); i++) await new Promise(r => setTimeout(r, 50)); VTT.page = nid; VTT.sel = null; render(); return; }
  if (a === "vttrenpage") { const p = S.vttPages.get(el.dataset.id); if (!p) return; const name = await vAsk("Rename map", "Name", p.name, "Save"); if (name) vPatch("vttpages/" + el.dataset.id, { name }); return; }
  if (a === "vttopenmap") { const p = S.vttPages.get(el.dataset.id); if (p) { await vPatch("vttpages/" + el.dataset.id, { open: !p.open }); toast(p.open ? "Players can no longer switch to that map" : "Players can now switch to that map themselves"); } return; }
  if (a === "vttsendto") { await vPatch("vttcamps/" + camp, { playerPage: el.dataset.id }); toast("The party is now on “" + ((S.vttPages.get(el.dataset.id) || {}).name || "that map") + "”"); return; }
}
// Dragging maps and folders between folders.
document.addEventListener("dragstart", ev => { const r = ev.target.closest && ev.target.closest(".vmrow"); if (!r) return; ev.dataTransfer.setData("text/plain", r.dataset.pid ? "p:" + r.dataset.pid : "f:" + r.dataset.fid); ev.dataTransfer.effectAllowed = "move"; });
document.addEventListener("dragover", ev => { const t = ev.target.closest && ev.target.closest(".vmfolder, .vmroot"); if (!t) return; ev.preventDefault(); document.querySelectorAll(".vmdrop").forEach(x => x.classList.remove("vmdrop")); t.classList.add("vmdrop"); });
document.addEventListener("dragleave", ev => { const t = ev.target.closest && ev.target.closest(".vmdrop"); if (t && !t.contains(ev.relatedTarget)) t.classList.remove("vmdrop"); });
document.addEventListener("drop", async ev => {
  const t = ev.target.closest && ev.target.closest(".vmfolder, .vmroot"); if (!t) return; ev.preventDefault(); t.classList.remove("vmdrop");
  const what = ev.dataTransfer.getData("text/plain"), to = t.dataset.fid || "", camp = document.querySelector(".vtt").dataset.camp, c = S.vttCamps.get(camp);
  if (what.startsWith("p:")) { await vPatch("vttpages/" + what.slice(2), { folder: to }); if (to) VCLOSED.delete(to); }
  else if (what.startsWith("f:")) {
    const id = what.slice(2); if (id === to) return;
    // No dropping a folder inside itself.
    let x = to, seen = new Set(); while (x && !seen.has(x)) { if (x === id) { toast("A folder can't go inside itself.", "bad"); return; } seen.add(x); x = (vFolders(c).find(f => f.id === x) || {}).parent; }
    await vPatch("vttcamps/" + camp, { folders: vFolders(c).map(f => f.id === id ? Object.assign({}, f, { parent: to }) : f) });
  }
});
document.addEventListener("change", ev => { if (ev.target.id === "vpsel") { VTT.ppage = ev.target.value; VTT.sel = null; VTT.fitDone = ""; render(); } });

// ----- Forms, flight, summons -----
function vFormCtl(id, t, e, gm) {
  if (!gm || typeof isShifter !== "function" || !isShifter(e)) return "";
  const forms = ssForms(t.ref.slice(2), e);
  return `<div class="vform vformctl" data-tok="${esc(id)}"><label><span>◈ Shapeshift form <small class="muted">the token takes on that creature's picture</small></span><select data-vf="form"><option value="">True form</option>${forms.map(([fid, x]) => `<option value="${esc(fid)}"${t.form === fid ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label></div>`;
}
function vFly(delta) {
  const id = VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id, t = id && S.vttTokens.get(id); if (!t) return;
  if (!vCanEdit() && !(PLAYER && t.owner)) return;
  const fly = Math.max(0, Math.min(99, (Number(t.fly) || 0) + delta));
  S.vttTokens.set(id, Object.assign({}, t, { fly })); vPatch("vtttokens/" + id, { fly }); vRefresh();
}
function vSummonPlace(ref, nearId) {
  const cur = vPageNow(); if (!cur) return;
  const [, cid, sid] = ref.split(":"), sm = vSummonOf(ref); if (!sm) return;
  const near = S.vttTokens.get(nearId), size = ({ Large: 2, Huge: 3, Gargantuan: 4 })[smSize(sm)] || 1;
  // Next to whoever summoned it, in the first free spot going round.
  const taken = (x, y) => vTokens(cur.id).some(([, o]) => x < o.x + (o.size || 1) && x + size > o.x && y < o.y + (o.size || 1) && y + size > o.y);
  let x = near ? near.x + (near.size || 1) : 0, y = near ? near.y : 0;
  if (near) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const nx = near.x + dx * ((dx > 0 ? near.size || 1 : size)), ny = near.y + dy * ((dy > 0 ? near.size || 1 : size)); if (nx >= 0 && ny >= 0 && nx + size <= cur.p.w && ny + size <= cur.p.h && !taken(nx, ny)) { x = nx; y = ny; break; } }
  x = Math.max(0, Math.min(cur.p.w - size, x)); y = Math.max(0, Math.min(cur.p.h - size, y));
  const id = vid("t");
  vSave("vtttokens/" + id, { page: cur.id, layer: "token", x, y, size, img: "", name: sm.name || sm.kind || "Summon", ref, owner: cid, bars: "all", created: new Date().toISOString() });
  if (sm.active === false) charChange(cid, c => { c.summons = smList(c).map(s => s.id === sid ? Object.assign({}, s, { active: true }) : s); });
}
async function vSummonRemove(ref) {
  const cur = vPageNow(); if (!cur) return;
  const [, cid, sid] = ref.split(":");
  for (const [tid, t] of vTokens(cur.id)) if (t.ref === ref) { if (VTT.sel && VTT.sel.id === tid) VTT.sel = null; await vDel("vtttokens/" + tid); }
  charChange(cid, c => { c.summons = smList(c).map(s => s.id === sid ? Object.assign({}, s, { active: false }) : s); });
}
document.addEventListener("keydown", ev => {
  if (!document.querySelector(".vtt") || (ev.target.matches && ev.target.matches("input,textarea,select"))) return;
  if (ev.key === "PageUp" || ev.key === "]") { ev.preventDefault(); vFly(1); } else if (ev.key === "PageDown" || ev.key === "[") { ev.preventDefault(); vFly(-1); }
});

// ----- Levels: ground, then rooftops and upper floors -----
// Walls carry a level as a fifth number; raised areas (page.areas) outline what's up on a level; pictures and tokens have a level.
// A token's height is its level plus its flight band. It's blocked only by walls on that height, so anything higher sees over
// ground walls. Pictures on a level are hidden from players whose tokens are underneath that level's areas, so they see inside.
const vHeight = t => Math.max(0, Number(t.lvl) || 0) + Math.max(0, Number(t.fly) || 0);
function vMaxLevel(p) { let m = Number(p && p.maxLevel) || 0; (p && p.walls || []).forEach(w => { m = Math.max(m, w[4] || 0); }); (p && p.areas || []).forEach(a => { m = Math.max(m, a.level || 0); }); (p && p.objs || []).forEach(o => { m = Math.max(m, o.level || 0); }); return m; }
const vLevelList = p => Array.from({ length: vMaxLevel(p) + 1 }, (_, i) => i);
function vLevelName(p, n) { n = Number(n) || 0; if (!n) return "Ground"; const nm = ((p && p.levelNames) || {})[n]; return nm ? `Level ${n} · ${nm}` : `Level ${n}`; }
// GM level filter: VTT.lvlShow is null (show every level) or a Set of the levels to show and edit.
function vLvlHid(l) { return !!(VTT.lvlShow && vCanEdit() && !VTT.preview && !VTT.lvlShow.has(Number(l) || 0)); }
function vLevelToolsHtml() {
  const cur = vPageNow(), p = cur ? cur.p : {}, all = !VTT.lvlShow;
  const rows = vLevelList(p).reverse().map(n => { const shown = all || VTT.lvlShow.has(n), nm = n ? ((p.levelNames || {})[n] || "") : "";
    return `<div class="vlvrow${VTT.lvl === n ? " on" : ""}${shown ? "" : " off"}">
      <label class="vlvtick" title="${all ? "Show only this level" : shown ? "Hide this level" : "Show this level too"}"><input type="checkbox" data-act="vttlvlshow" data-v="${n}"${!all && shown ? " checked" : ""}></label>
      <button class="vlvname" data-act="vttlvl" data-v="${n}" aria-pressed="${VTT.lvl === n}" title="Edit ${esc(vLevelName(p, n))}: new walls, squares, pictures and lights go here"><b>${n ? n : "G"}</b><span>${n ? esc(nm || "Level " + n) : "Ground"}</span></button>
      ${n ? `<button class="vlvren" data-act="vttrenlvl" data-v="${n}" title="Rename this level">✎</button>` : ""}</div>`; }).join("");
  return `<div class="vgroup vlvgroup"><span class="vlab">Levels</span>
    <button class="vlvall${all ? " on" : ""}" data-act="vttlvlall" aria-pressed="${all}">${all ? "✓ " : ""}Show all</button>
    <div class="vlvrows">${rows}</div>
    <button class="vbtn small vlvadd" data-act="vttaddlvl" title="Add a level above">+ Add level</button></div>`;
}
function vTokLevel(delta) {
  const id = VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id, t = id && S.vttTokens.get(id), cur = vPageNow(); if (!t || !cur) return;
  if (!vCanEdit() && !(PLAYER && t.owner)) return;
  const lvl = Math.max(0, Math.min(vMaxLevel(cur.p), (Number(t.lvl) || 0) + delta));
  S.vttTokens.set(id, Object.assign({}, t, { lvl })); vPatch("vtttokens/" + id, { lvl }); vRefresh();
}
// Players standing (or flying) under a level's raised squares see through that level's pictures:
// the pictures are cut away over the connected patch of squares they're under, so they see the room below.
function vRoofHoles(p, viewers, L) {
  let d = "";
  const seen = new Set();
  (p.areas || []).filter(a => a.level === L).forEach(a => {
    const under = viewers.filter(([, t]) => vHeight(t) < L).map(([, t]) => { const s = (t.size || 1) / 2; return [t.x + s, t.y + s]; }).filter(([x, y]) => vInArea(a, x, y));
    if (!under.length) return;
    if (!Array.isArray(a.cells)) { d += "M" + a.pts.map(q => q[0] * VCELL + " " + q[1] * VCELL).join("L") + "Z"; return; }
    const has = new Set(a.cells.map(c => c[0] + "," + c[1]));
    under.forEach(([x, y]) => {
      const start = Math.floor(x) + "," + Math.floor(y); if (seen.has(start)) return;
      const todo = [start]; seen.add(start);
      while (todo.length) {
        const k = todo.pop(), [cx, cy] = k.split(",").map(Number);
        d += `M${cx * VCELL} ${cy * VCELL}h${VCELL}v${VCELL}h${-VCELL}z`;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = (cx + dx) + "," + (cy + dy); if (has.has(n) && !seen.has(n)) { seen.add(n); todo.push(n); } }
      }
    });
  });
  return d;
}
function vRoofs(p, viewers) {
  const W = p.w * VCELL, H = p.h * VCELL;
  document.querySelectorAll(".vroofl .vobj.vroofoff").forEach(el => el.classList.remove("vroofoff"));
  document.querySelectorAll(".vrlv").forEach(el => {
    const holes = vRoofHoles(p, viewers, Number(el.dataset.lvl) || 0);
    el.style.clipPath = holes ? `path(evenodd, "M0 0H${W}V${H}H0Z${holes}")` : "";
  });
}


// ===== Conditions and effects =====
// The library lives in settings/vttconds { list: [{ id, name, emoji, color, stacks, desc }] }; until it's edited the built-in list is used.
// A token carries t.conds = [{ c: <condition id>, n: <stacks> }]: no limit on how many, or on the stacks.
const VCOND_DEFAULTS = [
  ["blinded", "Blinded", "🙈", "#8a8f99", 0, "Can't see. Attacks against it have advantage; its attacks have disadvantage."],
  ["charmed", "Charmed", "💘", "#e46aa8", 0, "Can't attack the charmer; the charmer has advantage on social checks against it."],
  ["deafened", "Deafened", "🔇", "#8a8f99", 0, "Can't hear."],
  ["frightened", "Frightened", "😱", "#9b6ad6", 0, "Disadvantage on checks and attacks while the source is in sight; can't move closer to it."],
  ["grappled", "Grappled", "🤼", "#c98b4a", 0, "Speed 0."],
  ["incapacitated", "Incapacitated", "💫", "#c9b24a", 0, "Can't take actions or reactions."],
  ["invisible", "Invisible", "👻", "#b8c7d9", 0, "Can't be seen without magic. Its attacks have advantage; attacks against it have disadvantage."],
  ["paralyzed", "Paralyzed", "⚡", "#e8d24a", 0, "Incapacitated, can't move or speak. Auto-fails Str and Dex saves; hits within 5 ft are crits."],
  ["petrified", "Petrified", "🗿", "#8d8476", 0, "Turned to stone: incapacitated, resistant to all damage."],
  ["poisoned", "Poisoned", "🤢", "#6bbf4a", 0, "Disadvantage on attack rolls and ability checks."],
  ["prone", "Prone", "🛌", "#a07a52", 0, "Crawls. Disadvantage on attacks; melee attacks against it have advantage, ranged have disadvantage."],
  ["restrained", "Restrained", "⛓️", "#7d8a99", 0, "Speed 0. Disadvantage on attacks and Dex saves; attacks against it have advantage."],
  ["stunned", "Stunned", "😵", "#e8a14a", 0, "Incapacitated, can't move. Auto-fails Str and Dex saves; attacks against it have advantage."],
  ["unconscious", "Unconscious", "💤", "#5a6b9b", 0, "Incapacitated and prone, drops what it holds. Hits within 5 ft are crits."],
  ["exhaustion", "Exhaustion", "😩", "#b0704a", 1, "Exhaustion levels."],
  ["concentrating", "Concentrating", "🧠", "#6f8cff", 0, "Holding concentration on a spell."],
  ["onfire", "On fire", "🔥", "#ff7a2f", 1, "Burning."],
  ["frozen", "Frozen", "🧊", "#7fd0ff", 1, "Chilled or frozen."],
  ["rend", "Rend", "🩸", "#d0453a", 1, "Stacks of rend."],
  ["bleeding", "Bleeding", "🩸", "#a3242c", 1, "Bleeding."],
  ["blessed", "Blessed", "✨", "#f2d36b", 0, "Adds a d4 to attacks and saves."],
  ["marked", "Marked", "🎯", "#e0533a", 0, "Marked by something (Hunter's Mark, Hex…)."],
].map(([id, name, emoji, color, stacks, desc]) => ({ id, name, emoji, color, stacks: !!stacks, desc }));
const VCOND_EMOJI = ["🔥", "🧊", "⚡", "🩸", "☠️", "🤢", "💤", "😵", "😱", "💘", "🙈", "👻", "🛡️", "✨", "🎯", "🌀", "🕸️", "🪨", "💧", "🌿", "🐾", "🗡️", "🧠", "💀", "🌑", "☀️", "❄️", "🌪️", "⛓️", "🍄"];
function vConds() { const l = S.vttCondDoc && Array.isArray(S.vttCondDoc.list) ? S.vttCondDoc.list : VCOND_DEFAULTS; return l; }
const vCond = id => vConds().find(c => c.id === id);
const vTokConds = t => (Array.isArray(t.conds) ? t.conds : []).filter(x => x && vCond(x.c));
function vCondBadges(t) {
  const list = vTokConds(t); if (!list.length) return "";
  return `<div class="vconds">${list.map(x => { const c = vCond(x.c), n = Math.max(1, Number(x.n) || 1);
    return `<span class="vcond" style="--cc:${esc(c.color || "#aaa")}" title="${esc(c.name + (c.stacks ? " ×" + n : ""))}">${esc(c.emoji || "•")}${c.stacks && n ? `<b>${n}</b>` : ""}</span>`; }).join("")}</div>`;
}
function vCondSideHtml(id, t, canEdit) {
  const list = vTokConds(t);
  if (!canEdit && !list.length) return "";
  const lib = vConds().slice().sort((a, b) => String(a.name).localeCompare(b.name));
  return `<div class="vcondbox" data-tok="${esc(id)}"><div class="vcondhead"><span>Conditions</span>${vCanEdit() ? `<button class="linkbtn small" data-act="vttcondlib">Edit library</button>` : ""}</div>
    ${list.length ? `<div class="vcondlist">${list.map(x => { const c = vCond(x.c), n = Math.max(1, Number(x.n) || 1);
      return `<div class="vcondrow" style="--cc:${esc(c.color || "#aaa")}"><span class="vce">${esc(c.emoji || "•")}</span><span class="vcn" title="${esc(c.desc || "")}">${esc(c.name)}${c.desc ? ` <button class="linkbtn small" data-act="vttcondinfo" data-c="${esc(c.id)}" aria-label="What ${esc(c.name)} does">?</button>` : ""}</span>
        ${c.stacks ? `${canEdit ? `<button class="iconbtn" data-act="vttcondn" data-c="${esc(c.id)}" data-v="-1" aria-label="One fewer ${esc(c.name)}">−</button>` : ""}<strong class="vcs">${n}</strong>${canEdit ? `<button class="iconbtn" data-act="vttcondn" data-c="${esc(c.id)}" data-v="1" aria-label="One more ${esc(c.name)}">+</button>` : ""}` : ""}
        ${canEdit ? `<button class="iconbtn" data-act="vttconddel" data-c="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">×</button>` : ""}</div>`; }).join("")}</div>` : ""}
    ${canEdit ? `<div class="vcondadd"><select class="vcondsel" aria-label="Condition">${lib.map(c => `<option value="${esc(c.id)}">${esc((c.emoji ? c.emoji + " " : "") + c.name)}</option>`).join("")}</select><input class="vcondamt" type="number" min="1" value="1" aria-label="Stacks"><button class="btn small" data-act="vttcondadd">Add</button></div>` : ""}</div>`;
}
function vCondSet(id, fn) {
  const t = S.vttTokens.get(id); if (!t) return;
  const conds = fn((Array.isArray(t.conds) ? t.conds : []).map(x => Object.assign({}, x))).filter(x => x && vCond(x.c) && x.n > 0);
  vPatch("vtttokens/" + id, { conds });
}
function vCondAction(a, el) {
  const box = el.closest(".vcondbox"), id = box && box.dataset.tok, t = id && S.vttTokens.get(id);
  if (a === "vttcondinfo") { const c = vCond(el.dataset.c); if (c) toast(`${c.emoji || ""} ${c.name}: ${c.desc || ""}`); return; }
  if (!t || !(vCanEdit() || (PLAYER && t.owner))) return;
  if (a === "vttcondadd") {
    const cid = box.querySelector(".vcondsel").value, c = vCond(cid), amt = Math.max(1, parseInt(box.querySelector(".vcondamt").value, 10) || 1); if (!c) return;
    vCondSet(id, list => { const x = list.find(y => y.c === cid); if (x) { if (c.stacks) x.n = (Number(x.n) || 1) + amt; } else list.push({ c: cid, n: c.stacks ? amt : 1 }); return list; });
    box.querySelector(".vcondamt").value = 1;
  } else if (a === "vttcondn") vCondSet(id, list => list.map(x => x.c === el.dataset.c ? Object.assign(x, { n: (Number(x.n) || 1) + Number(el.dataset.v) }) : x));
  else if (a === "vttconddel") vCondSet(id, list => list.filter(x => x.c !== el.dataset.c));
}
// The library editor.
function vCondLibHtml() {
  const list = vConds();
  return `<h2>Conditions library</h2><p class="muted small">Used for the badges on tokens. Tick <strong>Stacks</strong> for things that build up (rend, on fire); there's no limit on the number.</p>
    <div class="vcondlib">${list.map((c, i) => `<div class="vclrow" data-i="${i}">
      <button type="button" class="vclemo" data-act="vttclemo" data-i="${i}" style="--cc:${esc(c.color || "#aaa")}" aria-label="Pick an emoji for ${esc(c.name)}">${esc(c.emoji || "•")}</button>
      <input type="text" data-cl="name" value="${esc(c.name)}" aria-label="Name">
      <input type="color" data-cl="color" value="${esc(/^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : "#aaaaaa")}" aria-label="Colour">
      <label class="check small"><input type="checkbox" data-cl="stacks"${c.stacks ? " checked" : ""}> Stacks</label>
      <button type="button" class="iconbtn" data-act="vttcldel" data-i="${i}" aria-label="Delete ${esc(c.name)}">×</button>
      <input type="text" class="vcldesc" data-cl="desc" value="${esc(c.desc || "")}" placeholder="What it does (optional)" aria-label="Description"></div>`).join("")}</div>
    <div class="acts wrap"><button class="btn" type="button" data-act="vttcladd">+ New condition</button><button class="btn ghost" type="button" data-act="closemodal">Done</button>${S.vttCondDoc ? `<button class="btn ghost small" type="button" data-act="vttclreset">Add back missing built-ins</button>` : ""}</div>`;
}
function vCondLibSave(list) { S.vttCondDoc = { list }; return safeWrite(() => S.db.doc("settings/vttconds").set({ list })); }
async function vCondLibAction(a, el) {
  const list = vConds().map(c => Object.assign({}, c));
  if (a === "vttcondlib") { openModal(vCondLibHtml()); return; }
  if (a === "vttcladd") { list.push({ id: vid("k"), name: "New condition", emoji: "✦", color: "#c9a96e", stacks: true, desc: "" }); await vCondLibSave(list); openModal(vCondLibHtml()); const ins = document.querySelectorAll("#modal [data-cl=name]"); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } return; }
  if (a === "vttcldel") { const i = Number(el.dataset.i), c = list[i]; if (!c) return; list.splice(i, 1); await vCondLibSave(list); openModal(vCondLibHtml()); toast(`Deleted “${c.name}”. Tokens that had it lose the badge.`); return; }
  if (a === "vttclreset") { VCOND_DEFAULTS.forEach(d => { if (!list.some(c => c.id === d.id)) list.push(Object.assign({}, d)); }); await vCondLibSave(list); openModal(vCondLibHtml()); return; }
  if (a === "vttclemo") {
    const i = Number(el.dataset.i), c = list[i]; if (!c) return;
    const pop = document.createElement("div"); pop.className = "vemopop";
    pop.innerHTML = `${VCOND_EMOJI.map(e => `<button type="button" data-e="${e}">${e}</button>`).join("")}<input type="text" placeholder="or type/paste one" aria-label="Emoji" value="">`;
    document.querySelectorAll(".vemopop").forEach(x => x.remove());
    el.parentElement.appendChild(pop);
    const pick = async e => { if (!e) return; list[i].emoji = e; await vCondLibSave(list); openModal(vCondLibHtml()); };
    pop.addEventListener("click", ev => { const b = ev.target.closest("[data-e]"); if (b) pick(b.dataset.e); });
    pop.querySelector("input").addEventListener("change", ev => pick(ev.target.value.trim()));
    return;
  }
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest(".vclrow [data-cl]"); if (!f || !vCanEdit()) return;
  const i = Number(f.closest(".vclrow").dataset.i), list = vConds().map(c => Object.assign({}, c)); if (!list[i]) return;
  const k = f.dataset.cl; list[i][k] = k === "stacks" ? f.checked : f.value; if (k === "name" && !list[i].name.trim()) list[i].name = "Condition";
  if (k === "color") { const b = f.closest(".vclrow").querySelector(".vclemo"); if (b) b.style.setProperty("--cc", f.value); }
  vCondLibSave(list);
});

// ===== Turn order =====
// camp.init = { list: [{ id, tok, name, img, val, gm }], cur: <entry id>, round }
// An entry with gm: true is the GM's turn for every monster that isn't listed on its own.
const vInitOf = camp => { const c = S.vttCamps.get(camp) || {}; const i = c.init || {}; return { list: Array.isArray(i.list) ? i.list : [], cur: i.cur || "", round: Number(i.round) || 0 }; };
function vInitSorted(list) { return list.map((e, i) => [e, i]).sort((a, b) => { const va = a[0].val == null || a[0].val === "" ? -1e9 : Number(a[0].val), vb = b[0].val == null || b[0].val === "" ? -1e9 : Number(b[0].val); return vb - va || a[1] - b[1]; }).map(x => x[0]); }
const vCampId = () => { const r = document.querySelector(".vtt"); return r && r.dataset.camp; };
function vIsTurn(id, t) {
  const camp = vCampId(); if (!camp || !S.vttCamps.get(camp)) return false;
  const I = vInitOf(camp), e = I.list.find(x => x.id === I.cur); if (!e || !I.round) return false;
  if (e.tok) return e.tok === id;
  return !!e.gm && !t.owner && !(t.ref || "").startsWith("s:") && !I.list.some(x => x.tok === id);
}
function vInitBonus(t) {
  const ref = t.ref || "", n = v => { const m = String(v || "").match(/[+-]?\d+/); return m ? parseInt(m[0], 10) : 0; }, dex = sc => { const v = parseInt(sc, 10); return isFinite(v) ? Math.floor((v - 10) / 2) : 0; };
  if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)); return c ? n(cInit(c)) : 0; }
  if (ref.startsWith("s:")) { const sm = vSummonOf(ref); return sm ? dex(((smView(sm).sb) || {}).dex) : 0; }
  if (ref.startsWith("e:")) { const e = S.entries.get(t.form || ref.slice(2)) || S.entries.get(ref.slice(2)); return e && e.statblock ? dex(e.statblock.dex) : 0; }
  return 0;
}
function vInitTokBtn(id, t) {
  const camp = vCampId(); if (!camp) return "";
  const e = vInitOf(camp).list.find(x => x.tok === id);
  return `<div class="vinitrow">${e ? `<span>⚔ In the turn order${e.val != null && e.val !== "" ? ` at <strong>${esc(e.val)}</strong>` : ""}</span><button class="btn ghost small" data-act="vttinitrm" data-id="${esc(e.id)}">Take out</button>` : `<button class="btn small" data-act="vttinitadd" data-tok="${esc(id)}">⚔ Add to turn order</button><button class="btn ghost small" data-act="vttinitadd" data-tok="${esc(id)}" data-noroll="1" title="Add without rolling, and type the number yourself">Add, no roll</button>`}</div>`;
}
function vInitEntry(id, t, roll) {
  const b = vInitBonus(t), d = Math.floor(Math.random() * 20) + 1;
  return { id: vid("i"), tok: id, name: t.name || "Token", img: vTokSrc(t) || "", val: roll ? d + b : null, _roll: roll ? `${t.name}: d20 ${d} ${b >= 0 ? "+" : "−"} ${Math.abs(b)} = ${d + b}` : "" };
}
async function vInitSave(camp, I) { I.list = I.list.map(e => { const o = Object.assign({}, e); delete o._roll; return o; }); return vPatch("vttcamps/" + camp, { init: I }); }
async function vInitAction(a, el) {
  const camp = vCampId(); if (!camp) return;
  const I = vInitOf(camp); I.list = I.list.map(e => Object.assign({}, e));
  if (a === "vttinitopen") { VTT.initOpen = !VTT.initOpen; VTT.initMin = false; el.classList.toggle("on", VTT.initOpen); el.setAttribute("aria-expanded", VTT.initOpen); vInitDraw(true); return; }
  if (a === "vttinitadd") { const t = S.vttTokens.get(el.dataset.tok); if (!t) return; const e = vInitEntry(el.dataset.tok, t, !el.dataset.noroll); if (e._roll) toast(e._roll); I.list.push(e); VTT.initOpen = true; await vInitSave(camp, I); return; }
  if (a === "vttinitparty") {
    const cur = vPageNow(); if (!cur) return; const rolls = [];
    vTokens(cur.id).forEach(([id, t]) => { if (t.owner && t.layer !== "gm" && !I.list.some(x => x.tok === id)) { const e = vInitEntry(id, t, true); rolls.push(e._roll); I.list.push(e); } });
    if (!rolls.length) { toast("Every player token on this map is already in the turn order."); return; }
    toast(rolls.join(" · ")); await vInitSave(camp, I); return;
  }
  if (a === "vttinitgm") { I.list.push({ id: vid("i"), gm: true, name: "Monsters (GM)", img: "", val: null }); await vInitSave(camp, I); return; }
  if (a === "vttinitrm") { I.list = I.list.filter(x => x.id !== el.dataset.id); if (I.cur === el.dataset.id) { I.cur = ""; } await vInitSave(camp, I); return; }
  if (a === "vttinitclear") { if (!confirm("Clear the turn order?")) return; await vInitSave(camp, { list: [], cur: "", round: 0 }); return; }
  if (a === "vttinitnext" || a === "vttinitprev") {
    const sorted = vInitSorted(I.list); if (!sorted.length) return;
    let i = sorted.findIndex(x => x.id === I.cur);
    if (!I.round || i < 0) { I.round = Math.max(1, I.round); I.cur = sorted[0].id; }
    else if (a === "vttinitnext") { i++; if (i >= sorted.length) { i = 0; I.round++; } I.cur = sorted[i].id; }
    else { i--; if (i < 0) { if (I.round > 1) { I.round--; i = sorted.length - 1; } else i = 0; } I.cur = sorted[i].id; }
    await vInitSave(camp, I); return;
  }
  if (a === "vttinitend") { I.cur = ""; I.round = 0; await vInitSave(camp, I); return; }
  if (a === "vttinitgo") { I.cur = el.dataset.id; I.round = Math.max(1, I.round); await vInitSave(camp, I); return; }
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest(".vturns [data-iv]"); if (!f || !vCanEdit()) return;
  const camp = vCampId(), I = vInitOf(camp); I.list = I.list.map(e => e.id === f.dataset.iv ? Object.assign({}, e, f.dataset.k === "name" ? { name: f.value || "Turn" } : { val: f.value === "" ? null : Number(f.value) }) : e);
  vInitSave(camp, I);
});
function vInitDraw(force) {
  const box = document.getElementById("vturns"), camp = vCampId(); if (!box || !camp || !S.vttCamps.get(camp)) return;
  if (!force && document.activeElement && box.contains(document.activeElement) && document.activeElement.matches("input")) return;
  const gm = vCanEdit(), I = vInitOf(camp), sorted = vInitSorted(I.list);
  const show = gm ? VTT.initOpen : sorted.length > 0;
  box.hidden = !show; if (!show) { box.innerHTML = ""; return; }
  const curTok = id => id && S.vttTokens.get(id);
  box.innerHTML = `<div class="vthead"><strong>${I.round ? `Round ${I.round}` : "Turn order"}</strong>
      ${gm ? `<button class="iconbtn" data-act="vttinitprev" aria-label="Previous turn"${sorted.length ? "" : " disabled"}>◀</button><button class="btn small" data-act="vttinitnext"${sorted.length ? "" : " disabled"}>${I.round ? "Next ▶" : "Start ▶"}</button>` : ""}
      <button class="iconbtn" data-act="vttinitmin" aria-label="${VTT.initMin ? "Show" : "Hide"} the list">${VTT.initMin ? "▸" : "▾"}</button></div>
    ${VTT.initMin ? "" : `<ol class="vtlist">${sorted.map(e => { const t = curTok(e.tok), img = e.gm ? "" : (t ? vTokSrc(t) : e.img), on = I.round && e.id === I.cur;
      return `<li class="${on ? "on" : ""}${e.gm ? " gmturn" : ""}${e.tok && !t ? " gone" : ""}">${img ? `<img src="${esc(img)}" alt="">` : `<span class="vtini">${e.gm ? "👹" : esc((e.name || "?")[0])}</span>`}
        ${gm ? `<input class="vtname" type="text" data-iv="${esc(e.id)}" data-k="name" value="${esc(t && !e.gm ? t.name || e.name : e.name)}" aria-label="Name"${e.gm ? "" : " readonly tabindex=\"-1\""}><input class="vtval" type="number" data-iv="${esc(e.id)}" value="${e.val == null ? "" : esc(e.val)}" placeholder="–" aria-label="Initiative for ${esc(e.name)}">
          <button class="iconbtn" data-act="vttinitgo" data-id="${esc(e.id)}" aria-label="Make it ${esc(e.name)}'s turn" title="Jump to this turn">▸</button><button class="iconbtn" data-act="vttinitrm" data-id="${esc(e.id)}" aria-label="Take ${esc(e.name)} out">×</button>`
        : `<span class="vtname">${esc(t ? t.name || e.name : e.name)}</span><span class="vtval">${e.val == null ? "" : esc(e.val)}</span>`}</li>`; }).join("") || `<li class="muted small vtempty">Select a token and press “Add to turn order”, or add the party below.</li>`}</ol>
    ${gm ? `<div class="vtacts"><button class="btn ghost small" data-act="vttinitparty" title="Roll for every player-controlled token on this map">+ Party</button><button class="btn ghost small" data-act="vttinitgm" title="One turn for all the monsters you run together">+ GM turn</button>${I.round ? `<button class="btn ghost small" data-act="vttinitend">End combat</button>` : ""}<button class="btn ghost small danger" data-act="vttinitclear">Clear</button></div>` : ""}`}`;
}


// ===== Shared measurements and pings =====
// Each device keeps one doc, vttlive/<device id>: { page, who, col, gm, meas, ping: { x, y, t, pull } }.
// Only used when running from the PC (the server passes these on and forgets them; they aren't saved to the library).
VTT.mbcast = (() => { try { return localStorage.getItem("vttBcast") !== "0"; } catch (e) { return true; } })();
VTT.pings = []; VTT.pingSeen = null;
const VLIVE_ID = (() => { try { let v = sessionStorage.getItem("vttLiveId"); if (!v) { v = "d" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("vttLiveId", v); } return v; } catch (e) { return "d" + Math.random().toString(36).slice(2, 10); } })();
function vLiveName() { if (vCanEdit()) return "GM"; try { return localStorage.getItem("vttName") || "Player"; } catch (e) { return "Player"; } }
function vLiveCol() { if (vCanEdit()) return "#ffd23c"; let h = 0; for (const ch of VLIVE_ID) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h},85%,62%)`; }
const vLiveOn = () => !!window.__CODEX_SERVER;
function vLiveOthers(pid) { return [...(S.vttLive || new Map())].filter(([id, d]) => id !== VLIVE_ID && d && d.page === pid); }
let vLiveTimer = 0, vLiveLast = 0, vLiveSentMeas = false;
function vLiveWrite(extra) {
  const cur = vPageNow(); if (!cur || !vLiveOn()) return;
  const meas = VTT.mbcast && VTT.meas ? Object.assign({}, VTT.meas) : null;
  if (!meas && !vLiveSentMeas && !extra) return;
  vLiveSentMeas = !!meas;
  const doc = Object.assign({ page: cur.id, who: vLiveName(), col: vLiveCol(), meas }, vCanEdit() ? { gm: true } : {}, extra || (VTT.lastPing ? { ping: VTT.lastPing } : {}));
  safeWrite(() => S.db.doc("vttlive/" + VLIVE_ID).set(doc));
}
function vLiveMeas(now) {
  if (!vLiveOn()) return;
  clearTimeout(vLiveTimer);
  const go = () => { vLiveLast = Date.now(); vLiveWrite(); };
  if (now || Date.now() - vLiveLast > 120) go(); else vLiveTimer = setTimeout(go, 120);
}
function vPing(x, y, pull) {
  const cur = vPageNow(); if (!cur) return;
  vPingShow(x, y, vLiveCol(), vLiveName(), true);
  VTT.lastPing = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, t: Date.now(), pull: !!(pull && vCanEdit()) };
  vLiveWrite({ ping: VTT.lastPing });
  if (pull) toast("Everyone's view moved here");
}
function vPingShow(x, y, col, who, mine) {
  VTT.pings.push({ x, y, col, who, mine, until: Date.now() + 3200, k: Math.random().toString(36).slice(2) });
  vPingDraw();
  setTimeout(vPingDraw, 3300);
}
function vPingDraw() {
  const box = document.getElementById("vpings"); if (!box) return;
  const now = Date.now(); VTT.pings = VTT.pings.filter(p => p.until > now);
  const have = new Set([...box.children].map(e => e.dataset.k));
  VTT.pings.forEach(p => { if (have.has(p.k)) return; const d = document.createElement("div"); d.className = "vping"; d.dataset.k = p.k; d.style.cssText = `left:${p.x * VCELL}px;top:${p.y * VCELL}px;--pc:${p.col}`; d.innerHTML = `<i></i><i></i><i></i><b></b><span>${esc(p.who || "")}</span>`; box.appendChild(d); });
  [...box.children].forEach(e => { if (!VTT.pings.some(p => p.k === e.dataset.k)) e.remove(); });
}
function vCenterOn(x, y) { const view = document.getElementById("vview"); if (!view) return; const r = view.getBoundingClientRect(); VTT.panX = r.width / 2 - x * VCELL * VTT.zoom; VTT.panY = r.height / 2 - y * VCELL * VTT.zoom; vApplyView(); }
// New docs from other devices: show fresh pings, redraw measurements.
function vLiveSnap() {
  const first = !VTT.pingSeen; if (first) VTT.pingSeen = new Map();
  const cur = vPageNow();
  for (const [id, d] of S.vttLive || new Map()) {
    if (id === VLIVE_ID || !d || !d.ping) continue;
    const seen = VTT.pingSeen.get(id); VTT.pingSeen.set(id, d.ping.t);
    if (first || seen === d.ping.t || !cur || d.page !== cur.id) continue;
    vPingShow(d.ping.x, d.ping.y, d.col, d.who, false);
    if (d.ping.pull && d.gm && !vCanEdit()) vCenterOn(d.ping.x, d.ping.y);
  }
  vMeasDraw();
}
// Hold the pointer still on the map to ping, wherever you are and whatever tool you have.
(function () {
  let timer = 0, start = null;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  document.addEventListener("pointerdown", ev => {
    cancel();
    const view = ev.target.closest && ev.target.closest("#vview"); if (!view || ev.button !== 0 || ev.target.closest(".vzoom,.vptools,.vturns,.vfloors")) return;
    if (["wall", "area", "measure", "ping", "travel", "scale", "draw", "link"].includes(VTT.tool)) return;
    start = [ev.clientX, ev.clientY];
    const pt = vPt(ev), shift = ev.shiftKey;
    timer = setTimeout(() => { timer = 0; VTT.pingHeld = true; vPing(pt[0], pt[1], shift && vCanEdit()); }, 550);
  }, true);
  document.addEventListener("pointermove", ev => { if (timer && start && Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) > 8) cancel(); }, true);
  document.addEventListener("pointerup", cancel, true); document.addEventListener("pointercancel", cancel, true);
})();


// ===== Atmosphere: lighting and weather laid over the whole map =====
// page.fx = { k: kind, a: strength 0–100 }. The tint sits over the map and tokens; rain, snow and lightning
// are drawn on a canvas over the view (so a huge map costs no more than a small one).
const VFX = {
  dark:     { name: "🌑 Darkness (indoors)", tint: ["#20232c", "multiply", 0.95], dark: true },
  day:      { name: "☀️ Daylight", tint: ["#ffe2a0", "soft-light", 0.55] },
  dusk:     { name: "🌇 Dusk", tint: ["#ff8a4c", "multiply", 0.45], tint2: ["#5b3a8a", "soft-light", 0.35], dark: true },
  night:    { name: "🌙 Night", tint: ["#5a6cb4", "multiply", 0.85], tint2: ["#2c4cc8", "soft-light", 0.3], dark: true },
  overcast: { name: "☁️ Cloudy", tint: ["#8c96a6", "multiply", 0.4], clouds: 0.35 },
  rain:     { name: "🌧 Rain", tint: ["#6f7d92", "multiply", 0.5], clouds: 0.45, rain: 1 },
  storm:    { name: "⛈ Thunderstorm", tint: ["#323c58", "multiply", 0.68], clouds: 0.6, rain: 2.2, lightning: true, dark: true },
  fog:      { name: "🌫 Mist", tint: ["#c9d2dc", "screen", 0.28], mist: true },
  snow:     { name: "❄️ Snow", tint: ["#c8d8ee", "multiply", 0.3], tint2: ["#ffffff", "soft-light", 0.25], clouds: 0.25, snow: true },
};
VTT.fxOff = (() => { try { return localStorage.getItem("vttFxOff") === "1"; } catch (e) { return false; } })();
const vFxReduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
function vFxOf(p) { const fx = p && p.fx; const d = fx && VFX[fx.k]; return d && !VTT.fxOff ? { d, k: fx.k, s: Math.max(0, Math.min(100, fx.a == null ? 60 : Number(fx.a))) / 100 } : null; }
function vFxToolsHtml() {
  const cur = vPageNow(), fx = (cur && cur.p.fx) || {};
  return `<div class="vgroup"><span class="vlab">Atmosphere</span>
    <select class="vfxsel" data-act="vttfx" aria-label="Atmosphere"><option value="">None</option>${Object.entries(VFX).map(([k, d]) => `<option value="${k}"${fx.k === k ? " selected" : ""}>${d.name}</option>`).join("")}</select>
    ${fx.k ? `<label class="vfxamt small"><span>Strength</span><input type="range" min="10" max="100" step="5" value="${fx.a == null ? 60 : fx.a}" class="vfxa" aria-label="Strength"></label>
    <label class="check small"><input type="checkbox" data-act="vttfxlocal"${VTT.fxOff ? "" : " checked"}> Show on my screen</label>
    ${VFX[fx.k] && VFX[fx.k].dark ? `<label class="check small" title="Players only see places that are lit, or within their darkvision. Unlit tokens there are hidden."><input type="checkbox" data-act="vttfxhide"${vDarkOn(cur.p) ? " checked" : ""}> Darkness hides what isn't lit</label>` : ""}` : ""}</div>`;
}
document.addEventListener("input", ev => { if (!ev.target.matches || !ev.target.matches(".vfxa")) return; const cur = vPageNow(); if (!cur) return; cur.p.fx = Object.assign({}, cur.p.fx, { a: Number(ev.target.value) }); vDraw(); });
document.addEventListener("change", ev => {
  if (ev.target.matches && ev.target.matches(".vfxsel")) { vttAction("vttfx", ev.target); return; }
  if (!ev.target.matches || !ev.target.matches(".vfxa") || !vCanEdit()) return; const cur = vPageNow(); if (!cur) return; vPatch("vttpages/" + cur.id, { fx: Object.assign({}, cur.p.fx, { a: Number(ev.target.value) }) });
});
function vFxStageHtml(p) {
  const f = vFxOf(p); if (!f) return "";
  const { d, s } = f, lay = (t, cls) => !t ? "" : d.dark ? `<canvas class="vfxtint vfxcut" data-col="${t[0]}" style="mix-blend-mode:${t[1]};opacity:${(t[2] * (0.35 + 0.65 * s)).toFixed(3)}"></canvas>` : `<div class="vfxtint ${cls || ""}" style="background:${t[0]};mix-blend-mode:${t[1]};opacity:${(t[2] * (0.35 + 0.65 * s)).toFixed(3)}"></div>`;
  return `<div class="vfx">${lay(d.tint)}${lay(d.tint2)}${d.dark ? `<canvas class="vfxtint vlglow" id="vlglow"></canvas>` : ""}${d.clouds ? `<div class="vfxclouds${vFxReduced() ? " still" : ""}" style="opacity:${(d.clouds * (0.4 + 0.9 * s)).toFixed(3)}"></div>` : ""}${d.mist ? `<div class="vfxmist${vFxReduced() ? " still" : ""}" style="opacity:${(0.15 + 0.45 * s).toFixed(3)}"></div><div class="vfxmist b${vFxReduced() ? " still" : ""}" style="opacity:${(0.1 + 0.35 * s).toFixed(3)}"></div>` : ""}</div>`;
}
// The moving parts: rain, snow and lightning on a canvas the size of the view.
const VFXR = { raf: 0, parts: [], kind: "", flash: 0, nextBolt: 0, last: 0 };
function vFxRun(p) {
  const cv = document.getElementById("vfxp"), f = vFxOf(p);
  const need = f && (f.d.rain || f.d.snow || f.d.lightning);
  if (!cv || !need) { if (cv) { cv.width = cv.width; cv.style.display = "none"; } cancelAnimationFrame(VFXR.raf); VFXR.raf = 0; VFXR.kind = ""; return; }
  cv.style.display = "block"; VFXR.f = f;
  if (VFXR.kind !== f.k + f.s) { VFXR.kind = f.k + f.s; VFXR.parts = []; VFXR.nextBolt = performance.now() + 2500 + Math.random() * 5000; }
  if (!VFXR.raf) VFXR.raf = requestAnimationFrame(vFxFrame);
}
function vFxFrame(now) {
  const cv = document.getElementById("vfxp"), f = VFXR.f;
  if (!cv || !document.body.contains(cv) || !f || cv.style.display === "none") { VFXR.raf = 0; VFXR.kind = ""; return; }
  VFXR.raf = requestAnimationFrame(vFxFrame);
  const dt = Math.min(0.05, (now - (VFXR.last || now)) / 1000); VFXR.last = now;
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, W, H);
  const still = vFxReduced(), area = (W * H) / (1000 * 700 * dpr * dpr), z = Math.max(0.5, Math.min(2, VTT.zoom));
  if ((f.d.rain || f.d.snow) && !still) {
    const want = Math.round((f.d.snow ? 220 : 380 * f.d.rain) * f.s * area);
    while (VFXR.parts.length < want) VFXR.parts.push({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random() * 0.8, w: Math.random() });
    if (VFXR.parts.length > want) VFXR.parts.length = want;
    if (f.d.rain) {
      const len = 18 * dpr * z, sp = 1400 * dpr, ang = 0.22;
      ctx.strokeStyle = "rgba(200,215,240,.45)"; ctx.lineWidth = 1.2 * dpr; ctx.beginPath();
      for (const q of VFXR.parts) { q.y += sp * q.v * dt; q.x += sp * q.v * ang * dt; if (q.y > H) { q.y = -len; q.x = Math.random() * (W + H * ang) - H * ang; } if (q.x > W) q.x -= W; ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - len * ang * q.v, q.y - len * q.v); }
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const q of VFXR.parts) { q.y += 45 * dpr * q.v * dt; q.x += Math.sin(now / 1000 * q.v + q.w * 6) * 20 * dpr * dt; if (q.y > H) { q.y = -4; q.x = Math.random() * W; } ctx.beginPath(); ctx.arc(q.x, q.y, (1 + q.w * 2.2) * dpr * Math.sqrt(z), 0, 6.283); ctx.fill(); }
    }
  }
  if (f.d.lightning && !still) {
    if (now > VFXR.nextBolt) { VFXR.flash = 0.55 + 0.35 * f.s; VFXR.second = now + 140 + Math.random() * 120; VFXR.nextBolt = now + (9000 - 5000 * f.s) + Math.random() * 9000; }
    if (VFXR.second && now > VFXR.second) { VFXR.flash = Math.max(VFXR.flash, 0.4 + 0.3 * f.s); VFXR.second = 0; }
    if (VFXR.flash > 0.01) { ctx.fillStyle = `rgba(225,235,255,${VFXR.flash.toFixed(3)})`; ctx.fillRect(0, 0, W, H); VFXR.flash *= Math.pow(0.0015, dt); }
  }
}


// ===== Light sources =====
// Library: settings/vttlights { list: [{ id, name, color, bright, dim }] } (feet). Map lights: page.lights = [{ id, x, y, level, name, color, bright, dim }].
// Tokens: t.light = { name, color, bright, dim }. Characters also shine with any equipped item that has item.light.
// Lights cut through the darkness of Night, Dusk, Thunderstorm and Darkness, and are stopped by walls on their level.
const VLIGHT_DEFAULTS = [
  ["torch", "Torch", "#ff9a3c", 30, 30], ["lantern", "Lantern", "#ffc46b", 30, 30], ["candle", "Candle", "#ffb35c", 5, 5], ["campfire", "Campfire", "#ff7a2a", 20, 20],
  ["lightc", "Light (cantrip)", "#fff4d6", 20, 20], ["magic", "Magic light", "#bcd4ff", 60, 60], ["daylight", "Daylight (spell)", "#fffbe8", 60, 60], ["fungus", "Glowing fungus", "#7dffb0", 5, 10],
].map(([id, name, color, bright, dim]) => ({ id, name, color, bright, dim }));
function vLights() { return S.vttLightDoc && Array.isArray(S.vttLightDoc.list) ? S.vttLightDoc.list : VLIGHT_DEFAULTS; }
const vLight = id => vLights().find(l => l.id === id);
const vLightOk = l => l && (Number(l.bright) > 0 || Number(l.dim) > 0);
VTT.lightPreset = "torch";
// Everything shining on a page: [{ x, y, h, bright, dim, color }] in squares.
function vEmitters(p, toks) {
  const out = [];
  (p.lights || []).forEach(l => { if (vLightOk(l)) out.push({ x: l.x, y: l.y, h: l.level || 0, bright: +l.bright || 0, dim: +l.dim || 0, color: l.color || "#ffd9a0" }); });
  toks.forEach(([id, t]) => { if (t.layer === "gm" && !vCanEdit()) return; vTokLights(t).forEach(l => out.push({ x: t.x + (t.size || 1) / 2, y: t.y + (t.size || 1) / 2, h: vHeight(t), bright: +l.bright || 0, dim: +l.dim || 0, color: l.color || "#ffd9a0" })); });
  return out;
}
// SRD gear that gives light without any setup.
const VLIGHT_SRD = { "Torch": { name: "Torch", color: "#ff9a3c", bright: 20, dim: 20 }, "Candle": { name: "Candle", color: "#ffb35c", bright: 5, dim: 5 }, "Lantern, hooded": { name: "Hooded lantern", color: "#ffc46b", bright: 30, dim: 30 }, "Lantern, bullseye": { name: "Bullseye lantern", color: "#ffc46b", bright: 60, dim: 60 }, "Lamp": { name: "Lamp", color: "#ffc46b", bright: 15, dim: 30 } };
function vItemLights(t) {
  if (!t.ref || !t.ref.startsWith("c:") || typeof invOf !== "function") return [];
  const c = S.chars.get(t.ref.slice(2)); if (!c) return [];
  const inv = invOf(c), out = [], seen = new Set();
  ["ar", ...EQ_KEYS].forEach(k => { const sl = inv.slots[k]; if (!sl || seen.has(sl.ref)) return; seen.add(sl.ref); const r = invResolve(sl.ref, sl.name); let L = r && r.e && r.e.item && r.e.item.light;
    if (!vLightOk(L) && r && r.src === "srd") { const k = Object.keys(VLIGHT_SRD).find(n => new RegExp("^" + n, "i").test(r.name)); if (k) L = VLIGHT_SRD[k]; }
    if (vLightOk(L)) out.push(Object.assign({ from: r.name }, L)); });
  return out;
}
const vTokLights = t => (vLightOk(t.light) ? [t.light] : []).concat(vItemLights(t));
function vLightsPaint(pid, p, toks) {
  const cuts = [...document.querySelectorAll("#vstage .vfxcut")], glow = document.getElementById("vlglow");
  if (!cuts.length && !glow) return;
  const R = 24, W = p.w * R, H = p.h * R, em = vEmitters(p, toks), polyCache = new Map();
  const polyOf = e => { const k = e.x + "," + e.y + "," + e.h; if (!polyCache.has(k)) polyCache.set(k, vVisPoly(e.x, e.y, vSegs(p, e.h))); return polyCache.get(k); };
  const clip = (ctx, e) => { const poly = polyOf(e); ctx.beginPath(); if (poly.length < 3) { ctx.rect(0, 0, W, H); return; } poly.forEach(([x, y], i) => i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)); ctx.closePath(); };
  cuts.forEach(cv => {
    cv.width = W; cv.height = H; cv.style.width = p.w * VCELL + "px"; cv.style.height = p.h * VCELL + "px";
    const ctx = cv.getContext("2d"); ctx.fillStyle = cv.dataset.col; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    em.forEach(e => {
      const rr = (e.bright + e.dim) / 5 * R; if (rr <= 0) return; const bf = e.bright / (e.bright + e.dim);
      const g = ctx.createRadialGradient(e.x * R, e.y * R, 0, e.x * R, e.y * R, rr);
      g.addColorStop(0, "rgba(0,0,0,1)"); if (bf > 0) { g.addColorStop(Math.max(0, bf - 0.03), "rgba(0,0,0,1)"); g.addColorStop(Math.min(1, bf + 0.03), "rgba(0,0,0,.55)"); }
      g.addColorStop(0.85, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); clip(ctx, e); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    });
  });
  if (glow) {
    glow.width = W; glow.height = H; glow.style.width = p.w * VCELL + "px"; glow.style.height = p.h * VCELL + "px";
    const ctx = glow.getContext("2d"); ctx.globalCompositeOperation = "lighter";
    const rgba = (hex, a) => { const m = String(hex).match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); const [r, g, b] = m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [255, 217, 160]; return `rgba(${r},${g},${b},${a})`; };
    em.forEach(e => {
      const rr = (e.bright + e.dim) / 5 * R; if (rr <= 0) return; const bf = e.bright / (e.bright + e.dim);
      const g = ctx.createRadialGradient(e.x * R, e.y * R, 0, e.x * R, e.y * R, rr);
      g.addColorStop(0, rgba(e.color, 0.32)); g.addColorStop(Math.max(0.05, bf), rgba(e.color, 0.14)); g.addColorStop(1, rgba(e.color, 0));
      ctx.save(); clip(ctx, e); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    });
  }
}
// GM: what's on the Lights layer.
function vLightMarks(p) {
  const C = VCELL, sel = VTT.sel && VTT.sel.kind === "light" ? VTT.sel.id : "";
  return `<svg class="vlmarks" width="${p.w * C}" height="${p.h * C}" aria-hidden="true">${(p.lights || []).map(l => { const b = (+l.bright || 0) / 5 * C, d = ((+l.bright || 0) + (+l.dim || 0)) / 5 * C;
    return `<g class="${l.id === sel ? "sel" : ""}${(l.level || 0) !== VTT.lvl ? " otherlvl" : ""}${vLvlHid(l.level) ? " lvlhid" : ""}" style="--lc:${esc(l.color || "#ffd9a0")}"><circle class="dimr" cx="${l.x * C}" cy="${l.y * C}" r="${d}"/>${b ? `<circle class="brr" cx="${l.x * C}" cy="${l.y * C}" r="${b}"/>` : ""}<circle class="lc" cx="${l.x * C}" cy="${l.y * C}" r="14"/><text x="${l.x * C}" y="${l.y * C + 6}">💡</text></g>`; }).join("")}</svg>`;
}
function vLightToolsHtml() {
  const lib = vLights();
  if (!lib.some(l => l.id === VTT.lightPreset) && lib[0]) VTT.lightPreset = lib[0].id;
  return `<div class="vgroup"><span class="vlab">Light to place</span><select class="vlpre" aria-label="Light to place">${lib.map(l => `<option value="${esc(l.id)}"${l.id === VTT.lightPreset ? " selected" : ""}>${esc(l.name)} · ${l.bright}/${l.dim} ft</option>`).join("")}</select>
    <p class="muted small vlhint">Click the map to place it on ${esc(vLevelName((vPageNow() || {}).p, VTT.lvl))}. Lights show when the Atmosphere is dark (Night, Dusk, Storm, Darkness).</p><button class="vbtn" data-act="vttlightlib">Edit light library</button></div>`;
}
document.addEventListener("change", ev => { if (ev.target.matches && ev.target.matches(".vlpre")) VTT.lightPreset = ev.target.value; });
function vLightPlace(x, y) {
  const cur = vPageNow(), pre = vLight(VTT.lightPreset); if (!cur || !pre) return;
  const l = { id: vid("l"), x, y, level: VTT.lvl, name: pre.name, color: pre.color, bright: pre.bright, dim: pre.dim };
  VTT.sel = { kind: "light", id: l.id };
  vPatch("vttpages/" + cur.id, { lights: (cur.p.lights || []).concat([l]) });
}
function vLightSet(id, fields) { const cur = vPageNow(); if (!cur) return; vPatch("vttpages/" + cur.id, { lights: (cur.p.lights || []).map(l => l.id === id ? Object.assign({}, l, fields) : l) }); }
function vLightSideHtml(p, l) {
  return `<h2>💡 ${esc(l.name || "Light")}</h2><div class="vform" data-light="${esc(l.id)}">
    <label><span>Use a preset</span><select data-lf="preset"><option value="">(keep as it is)</option>${vLights().map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${x.bright}/${x.dim} ft</option>`).join("")}</select></label>
    <label><span>Name</span><input type="text" data-lf="name" value="${esc(l.name || "")}"></label>
    <div class="frow tight"><label><span>Bright (ft)</span><input type="number" min="0" step="5" data-lf="bright" value="${+l.bright || 0}"></label><label><span>Dim (ft)</span><input type="number" min="0" step="5" data-lf="dim" value="${+l.dim || 0}"></label><label><span>Colour</span><input type="color" data-lf="color" value="${esc(/^#[0-9a-f]{6}$/i.test(l.color || "") ? l.color : "#ffd9a0")}"></label></div>
    <label><span>Level</span><select data-lf="level">${vLevelList(p).map(n => `<option value="${n}"${(l.level || 0) === n ? " selected" : ""}>${esc(vLevelName(p, n))}</option>`).join("")}</select></label>
    <p class="muted small">Dim light reaches that far beyond the bright light. Walls on the same level cast shadows. Drag the 💡 to move it; hold Alt to place it off the grid.</p>
    <div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete light</button></div></div>`;
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest("[data-light] [data-lf]"); if (!f || !vCanEdit()) return;
  const id = f.closest("[data-light]").dataset.light, k = f.dataset.lf;
  if (k === "preset") { const pre = vLight(f.value); if (pre) vLightSet(id, { name: pre.name, color: pre.color, bright: pre.bright, dim: pre.dim }); return; }
  vLightSet(id, { [k]: ["bright", "dim", "level"].includes(k) ? Math.max(0, Number(f.value) || 0) : f.value });
});
// A token's own light (players can set their own tokens').
function vTokLightHtml(id, t, canEdit) {
  const items = vItemLights(t), own = vLightOk(t.light) ? t.light : null;
  if (!canEdit && !own && !items.length && !vDarkvision(t)) return "";
  const cur = own ? (vLights().find(l => l.name === own.name && +l.bright === +own.bright && +l.dim === +own.dim) || {}).id || "custom" : "";
  return `<div class="vflyrow vlightrow"><span>Light</span>${canEdit ? `<select class="vtoklight" data-tok="${esc(id)}" aria-label="Light this token gives off"><option value="">None</option>${vLights().map(l => `<option value="${esc(l.id)}"${cur === l.id ? " selected" : ""}>${esc(l.name)} · ${l.bright}/${l.dim} ft</option>`).join("")}${cur === "custom" ? `<option value="custom" selected>${esc(own.name || "Custom")}</option>` : ""}</select>` : `<strong>${own ? esc(own.name) : "—"}</strong>`}</div>
    ${vDarkvision(t) ? `<p class="muted small vlitems">👁 Darkvision ${vDarkvision(t)} ft</p>` : ""}
    ${items.length ? `<p class="muted small vlitems">💡 Shining from equipped ${items.map(l => `<strong>${esc(l.from)}</strong> (${l.bright}/${l.dim} ft)`).join(", ")}</p>` : ""}`;
}
document.addEventListener("change", ev => {
  if (!ev.target.matches || !ev.target.matches(".vtoklight")) return;
  const id = ev.target.dataset.tok, t = S.vttTokens.get(id); if (!t || !(vCanEdit() || (PLAYER && t.owner))) return;
  if (ev.target.value === "custom") return;
  const pre = vLight(ev.target.value);
  vPatch("vtttokens/" + id, { light: pre ? { name: pre.name, color: pre.color, bright: pre.bright, dim: pre.dim } : null });
});
// The light library editor.
function vLightLibHtml() {
  return `<h2>Light library</h2><p class="muted small">Presets for lights on the map, on tokens and on items. Bright light first, then how much dim light reaches beyond it.</p>
    <div class="vcondlib">${vLights().map((l, i) => `<div class="vllrow" data-i="${i}"><span class="vllsw" style="background:${esc(l.color)}"></span>
      <input type="text" data-ll="name" value="${esc(l.name)}" aria-label="Name">
      <label><span class="small muted">Bright</span><input type="number" min="0" step="5" data-ll="bright" value="${+l.bright || 0}"></label>
      <label><span class="small muted">Dim</span><input type="number" min="0" step="5" data-ll="dim" value="${+l.dim || 0}"></label>
      <input type="color" data-ll="color" value="${esc(/^#[0-9a-f]{6}$/i.test(l.color || "") ? l.color : "#ffd9a0")}" aria-label="Colour">
      <button type="button" class="iconbtn" data-act="vttlldel" data-i="${i}" aria-label="Delete ${esc(l.name)}">×</button></div>`).join("")}</div>
    <div class="acts wrap"><button class="btn" type="button" data-act="vttlladd">+ New light</button><button class="btn ghost" type="button" data-act="closemodal">Done</button>${S.vttLightDoc ? `<button class="btn ghost small" type="button" data-act="vttllreset">Add back missing built-ins</button>` : ""}</div>`;
}
function vLightLibSave(list) { S.vttLightDoc = { list }; return safeWrite(() => S.db.doc("settings/vttlights").set({ list })); }
async function vLightLibAction(a, el) {
  const list = vLights().map(l => Object.assign({}, l));
  if (a === "vttlightlib") { openModal(vLightLibHtml()); return; }
  if (a === "vttlladd") { list.push({ id: vid("g"), name: "New light", color: "#ffd9a0", bright: 20, dim: 20 }); await vLightLibSave(list); openModal(vLightLibHtml()); const ins = document.querySelectorAll("#modal [data-ll=name]"); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } return; }
  if (a === "vttlldel") { list.splice(Number(el.dataset.i), 1); await vLightLibSave(list); openModal(vLightLibHtml()); return; }
  if (a === "vttllreset") { VLIGHT_DEFAULTS.forEach(d => { if (!list.some(l => l.id === d.id)) list.push(Object.assign({}, d)); }); await vLightLibSave(list); openModal(vLightLibHtml()); }
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest(".vllrow [data-ll]"); if (!f || !vCanEdit()) return;
  const i = Number(f.closest(".vllrow").dataset.i), list = vLights().map(l => Object.assign({}, l)); if (!list[i]) return;
  const k = f.dataset.ll; list[i][k] = k === "bright" || k === "dim" ? Math.max(0, Number(f.value) || 0) : f.value;
  if (k === "color") f.closest(".vllrow").querySelector(".vllsw").style.background = f.value;
  vLightLibSave(list); const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml();
});


// ===== Darkness and darkvision =====
// Applies on Night and Darkness by default (and any dark atmosphere where the GM ticks it): see vFog.
function vDarkOn(p) { const fx = p && p.fx, d = fx && VFX[fx.k]; if (!d || !d.dark) return false; return fx.hide != null ? !!fx.hide : (fx.k === "night" || fx.k === "dark"); }
const VDV_RACES = [[/\b(drow|dark elf|duergar|deep gnome|svirfneblin)\b/i, 120], [/\b(dwarf|elf|gnome|half-orc|half orc|orc|tiefling|half-elf|half elf|goblin|hobgoblin|bugbear|kobold|yuan-ti|tabaxi|firbolg|genasi|aasimar|githyanki|githzerai|shifter|changeling|kenku|lizardfolk|minotaur|satyr|fairy|harengon|owlin|dhampir|hexblood|reborn)\b/i, 60]];
function vDvText(text) { const m = String(text || "").match(/darkvision[\s\S]{0,160}?(\d+)\s*-?\s*(?:ft|feet|foot)/i); return m ? Number(m[1]) : 0; }
function vDarkvisionAuto(t) {
  const ref = t.ref || "";
  try {
    if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)); if (!c) return 0; const n = vDvText(JSON.stringify([c.features, c.senses, c.race, c.notes, c.traits])); if (n) return n; const r = VDV_RACES.find(([re]) => re.test(c.race || "")); return r ? r[1] : 0; }
    if (ref.startsWith("s:")) { const sm = vSummonOf(ref); return sm ? vDvText(JSON.stringify(smView(sm).sb || {})) : 0; }
    if (ref.startsWith("e:")) { const e = S.entries.get(t.form || ref.slice(2)) || S.entries.get(ref.slice(2)); return e ? vDvText(JSON.stringify(e.statblock || {}) + " " + (e.body || "").slice(0, 3000)) : 0; }
  } catch (e) {}
  return 0;
}
function vDarkvision(t) { return t.dv != null && t.dv !== "" ? Math.max(0, Number(t.dv) || 0) : vDarkvisionAuto(t); }


// ===== Doors and windows =====
// A wall can be [x1, y1, x2, y2, level, { k: "door" | "window", id, open, locked, secret }].
// Open doors and windows don't block sight or light. Players can open and close doors that aren't locked;
// secret doors look like plain walls to them until the GM opens or reveals them.
const vWallOpen = w => !!(w[5] && (w[5].k === "window" || (w[5].k === "door" && (w[5].open || w[5].clear))));
// For movement: a see-through door still blocks until it's opened.
const vWallPassable = w => !!(w[5] && (w[5].k === "window" || (w[5].k === "door" && w[5].open)));
function vDoorMarks(p, gm) {
  const C = VCELL;
  return `<div class="vdoors">${(p.walls || []).map((w, i) => { const m = w[5]; if (!m || (m.secret && !gm)) return "";
    const x = (w[0] + w[2]) / 2, y = (w[1] + w[3]) / 2, lvl = w[4] || 0, other = gm && lvl !== VTT.lvl; if (gm && vLvlHid(lvl)) return "";
    const label = m.k === "window" ? "Window · climb through" : m.locked && !gm ? "Locked" : m.open ? "Close door" : "Open door";
    const icon = m.k === "window" ? "🪟" : m.locked ? "🔒" : m.open ? "🚪" : "🚪";
    if (m.k === "window") return `<div class="vdoor window${other ? " otherlvl" : ""}" data-x="${x}" data-y="${y}" style="left:${x * C}px;top:${y * C}px" title="Window: you can see through it, and climb through"><span class="vdi">🪟</span><span class="vdl">Window · climb through</span></div>`;
    return `<button class="vdoor ${m.k}${m.open ? " open" : ""}${m.clear ? " clear" : ""}${m.locked ? " locked" : ""}${m.secret ? " secret" : ""}${other ? " otherlvl" : ""}" data-door="${esc(m.id)}" data-x="${x}" data-y="${y}" style="left:${x * C}px;top:${y * C}px" title="${esc(label + (gm && m.secret ? " (secret: players see a wall)" : "") + (gm && m.locked ? " (locked for players)" : ""))}"><span class="vdi">${icon}</span><span class="vdl">${esc(gm && m.secret ? "Secret door" : label)}</span></button>`; }).join("")}</div>`;
}
async function vDoorClick(id) {
  const cur = vPageNow(); if (!cur) return;
  const i = (cur.p.walls || []).findIndex(w => w[5] && w[5].id === id), w = i >= 0 && cur.p.walls[i]; if (!w) return;
  const m = w[5], gm = vCanEdit();
  if (m.k === "window") { toast("🪟 A window: you can see through it, and climb through if you want."); return; }
  if (m.locked && !gm) { toast("🔒 This door is locked."); return; }
  const walls = cur.p.walls.map(x => x[5] && x[5].id === id ? x.slice(0, 5).concat([Object.assign({}, x[5], { open: !x[5].open }, gm && x[5].secret ? { secret: false } : {})]) : x);
  cur.p.walls = walls; vDraw();
  await vPatch("vttpages/" + cur.id, { walls });
}
function vWallSideHtml(p, i) {
  const w = p.walls[i], m = w[5] || {}, k = m.k || "wall";
  return `<h2>${k === "door" ? "🚪 Door" : k === "window" ? "🪟 Window" : "Wall"}</h2><p class="muted small">On <strong>${esc(vLevelName(p, w[4] || 0))}</strong>.</p>
    <div class="vform" data-wall="${i}"><div><span class="flabel">Type</span><div class="seg vwk">${[["wall", "Wall"], ["door", "🚪 Door"], ["window", "🪟 Window"]].map(([v, l]) => `<button type="button" class="${k === v ? "on" : ""}" data-act="vttwtype" data-v="${v}">${l}</button>`).join("")}</div></div>
    ${k === "door" ? `<label class="check"><input type="checkbox" data-wf="open"${m.open ? " checked" : ""}> Open</label>
      <label class="check"><input type="checkbox" data-wf="locked"${m.locked ? " checked" : ""}> Locked <small class="muted">players can't open it</small></label>
      <label class="check"><input type="checkbox" data-wf="clear"${m.clear ? " checked" : ""}> See-through <small class="muted">bars, a portcullis, a glass door: sight and light pass even when it's shut</small></label>
      <label class="check"><input type="checkbox" data-wf="secret"${m.secret ? " checked" : ""}> Secret <small class="muted">players see a plain wall until you open it</small></label>` : ""}
    <p class="muted small">${k === "window" ? "Sight and light pass through; players see a window marker so they know they can climb through." : k === "door" ? "Closed doors block sight and light. Players click the door marker to open or close it." : "Blocks sight for tokens at this height when dynamic lighting is on."}</p>
    <div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete</button></div></div>`;
}
function vWallMeta(i, fn) {
  const cur = vPageNow(); if (!cur) return; const walls = cur.p.walls.slice(), w = walls[i]; if (!w) return;
  const m = fn(Object.assign({}, w[5] || {}));
  walls[i] = m && m.k && m.k !== "wall" ? [w[0], w[1], w[2], w[3], w[4] || 0, Object.assign({ id: vid("d") }, m)] : (w[4] ? w.slice(0, 5) : w.slice(0, 4));
  vPatch("vttpages/" + cur.id, { walls });
}
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-act=vttwtype]"); if (!b || !vCanEdit()) return; const i = Number(b.closest("[data-wall]").dataset.wall); vWallMeta(i, m => Object.assign(m, { k: b.dataset.v })); });
document.addEventListener("change", ev => { const f = ev.target.closest && ev.target.closest("[data-wall] [data-wf]"); if (!f || !vCanEdit()) return; const i = Number(f.closest("[data-wall]").dataset.wall); vWallMeta(i, m => Object.assign(m, { [f.dataset.wf]: f.checked }, f.dataset.wf === "open" && f.checked ? { secret: false } : {})); });

// ===== Stairs and lifts =====
// page.links = [{ id, kind: "stairs" | "lift", x, y, w, h, levels: [..] }] in squares. A token standing on one, on one of its levels,
// gets a button for each other level. Stairs join two levels; a lift can stop at several.

// ----- Raised squares: each level keeps one set of grid squares that are "up there" -----
// page.areas = [{ id, level, cells: [[x, y], ...] }]; older areas drawn as outlines keep { pts } and still work.
function vInArea(a, x, y) {
  if (Array.isArray(a.cells)) { const cx = Math.floor(x), cy = Math.floor(y); return a.cells.some(c => c[0] === cx && c[1] === cy); }
  return Array.isArray(a.pts) && vInPoly(x, y, a.pts);
}
function vAreaPickLevel() {
  const cur = vPageNow(); VTT.lvl = 1;
  if (cur && vMaxLevel(cur.p) < 1) toast("Raised squares go on Level 1. Drag over the squares that are up there.");
  const tl = document.getElementById("vtools"); if (tl) tl.innerHTML = vToolsHtml();
}
function vAreaPaint(d) {
  const cur = vPageNow(); if (!cur) return; vMeasDraw();
  const L = VTT.lvl || 1, x0 = Math.min(d.sx, d.ex), y0 = Math.min(d.sy, d.ey), x1 = Math.max(d.sx, d.ex), y1 = Math.max(d.sy, d.ey);
  const areas = (cur.p.areas || []).slice(), i = areas.findIndex(a => a.level === L && Array.isArray(a.cells));
  const set = new Set(i >= 0 ? areas[i].cells.map(c => c[0] + "," + c[1]) : []);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (d.rm) set.delete(x + "," + y); else set.add(x + "," + y); }
  let next = areas;
  if (d.rm) next = next.filter(a => !(a.level === L && Array.isArray(a.pts) && a.pts.every(q => q[0] >= x0 && q[0] <= x1 + 1 && q[1] >= y0 && q[1] <= y1 + 1)));
  const cells = [...set].map(k => k.split(",").map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (i >= 0) { next = next.map(a => a === areas[i] ? Object.assign({}, a, { cells }) : a).filter(a => !Array.isArray(a.cells) || a.cells.length); }
  else if (cells.length) { const a = { id: vid("a"), level: L, cells }; next = next.concat([a]); VTT.sel = { kind: "area", id: a.id }; }
  const fields = { areas: next }; if (L > (cur.p.maxLevel || 0)) fields.maxLevel = L;
  vPatch("vttpages/" + cur.id, fields);
}
function vAreaSvg(p, a, sel) {
  const C = VCELL, cls = `varea${sel ? " sel" : ""}${a.level === VTT.lvl ? " cur" : ""}${vLvlHid(a.level) ? " lvlhid" : ""}`;
  if (!Array.isArray(a.cells)) return a.pts ? `<g class="${cls}"><polygon points="${a.pts.map(q => q[0] * C + "," + q[1] * C).join(" ")}"/><text x="${a.pts[0][0] * C + 6}" y="${a.pts[0][1] * C + 18}">${esc(vLevelName(p, a.level))}</text></g>` : "";
  if (!a.cells.length) return "";
  const has = new Set(a.cells.map(c => c[0] + "," + c[1])), on = (x, y) => has.has(x + "," + y);
  let fill = "", edge = "";
  a.cells.forEach(([x, y]) => {
    fill += `M${x * C} ${y * C}h${C}v${C}h${-C}z`;
    if (!on(x, y - 1)) edge += `M${x * C} ${y * C}h${C}`;
    if (!on(x, y + 1)) edge += `M${x * C} ${(y + 1) * C}h${C}`;
    if (!on(x - 1, y)) edge += `M${x * C} ${y * C}v${C}`;
    if (!on(x + 1, y)) edge += `M${(x + 1) * C} ${y * C}v${C}`;
  });
  const f = a.cells[0];
  return `<g class="${cls} cells"><path class="afill" d="${fill}"/><path class="aedge" d="${edge}"/><text x="${f[0] * C + 6}" y="${f[1] * C + 18}">${esc(vLevelName(p, a.level))}</text></g>`;
}
function vLinkDraft(d) {
  const svg = document.getElementById("vmeas"); if (!svg) return;
  const x = Math.min(d.sx, d.ex), y = Math.min(d.sy, d.ey), w = Math.abs(d.ex - d.sx) + 1, h = Math.abs(d.ey - d.sy) + 1;
  svg.innerHTML = `<rect class="vlinkdraft${d.kind === "area" ? (d.rm ? " arearm" : " areaadd") : ""}" x="${x * VCELL}" y="${y * VCELL}" width="${w * VCELL}" height="${h * VCELL}"/>`;
}
function vLinkAdd(d) {
  const cur = vPageNow(); if (!cur) return; vMeasDraw();
  const x = Math.min(d.sx, d.ex), y = Math.min(d.sy, d.ey), w = Math.abs(d.ex - d.sx) + 1, h = Math.abs(d.ey - d.sy) + 1;
  const top = Math.max(vMaxLevel(cur.p), VTT.lvl + 1), l = { id: vid("k"), kind: "stairs", x, y, w, h, levels: [VTT.lvl, VTT.lvl + 1] };
  VTT.sel = { kind: "link", id: l.id };
  const fields = { links: (cur.p.links || []).concat([l]) }; if (top > vMaxLevel(cur.p)) fields.maxLevel = top;
  vPatch("vttpages/" + cur.id, fields);
}
function vLinksHtml(p, gm) {
  if (!gm || !(p.links || []).length) return "";
  const C = VCELL, sel = VTT.sel && VTT.sel.kind === "link" ? VTT.sel.id : "";
  return `<svg class="vlinks${VTT.layer === "walls" ? " active" : ""}" width="${p.w * C}" height="${p.h * C}" aria-hidden="true">${(p.links || []).map(l => `<g class="${l.id === sel ? "sel" : ""}${(l.levels || [0]).every(vLvlHid) ? " lvlhid" : ""}"><rect x="${l.x * C}" y="${l.y * C}" width="${l.w * C}" height="${l.h * C}"/><text x="${l.x * C + 6}" y="${l.y * C + 20}">${l.kind === "lift" ? "🛗 Lift" : "🪜 Stairs"} · ${(l.levels || []).map(n => n ? n : "G").join(" ↔ ")}</text></g>`).join("")}</svg>`;
}
function vLinkSideHtml(p, l) {
  const lv = vLevelList(p).concat([vMaxLevel(p) + 1]);
  return `<h2>${l.kind === "lift" ? "🛗 Lift" : "🪜 Stairs"}</h2><div class="vform" data-link="${esc(l.id)}">
    <div><span class="flabel">Kind</span><div class="seg vwk">${[["stairs", "🪜 Stairs"], ["lift", "🛗 Lift / pulley"]].map(([v, t]) => `<button type="button" class="${l.kind === v ? "on" : ""}" data-act="vttlinkkind" data-v="${v}">${t}</button>`).join("")}</div></div>
    ${l.kind === "lift" ? `<div><span class="flabel">Stops at</span><div class="vlinklv">${lv.map(n => `<label class="check small"><input type="checkbox" data-lk="${n}"${(l.levels || []).includes(n) ? " checked" : ""}> ${esc(vLevelName(p, n))}</label>`).join("")}</div></div>`
      : `<div class="frow tight"><label><span>From</span><select data-lks="0">${lv.map(n => `<option value="${n}"${(l.levels || [])[0] === n ? " selected" : ""}>${esc(vLevelName(p, n))}</option>`).join("")}</select></label><label><span>To</span><select data-lks="1">${lv.map(n => `<option value="${n}"${(l.levels || [])[1] === n ? " selected" : ""}>${esc(vLevelName(p, n))}</option>`).join("")}</select></label></div>`}
    <div class="frow tight"><label><span>Width</span><input type="number" min="1" data-lkn="w" value="${l.w}"></label><label><span>Height</span><input type="number" min="1" data-lkn="h" value="${l.h}"></label></div>
    <p class="muted small">Put a picture of the stairs or lift on the map yourself; this marks the squares. A token standing here on one of these levels gets a button to move to the others. Players don't see the outline.</p>
    <div class="acts"><button class="btn ghost small danger" data-act="vttdel">Delete</button></div></div>`;
}
function vLinkSet(id, fn) { const cur = vPageNow(); if (!cur) return; let top = vMaxLevel(cur.p); const links = (cur.p.links || []).map(l => { if (l.id !== id) return l; const n = fn(Object.assign({}, l, { levels: (l.levels || []).slice() })); n.levels = [...new Set(n.levels.map(Number))]; if (n.kind === "lift") n.levels.sort((a, b) => a - b); n.levels.forEach(v => { top = Math.max(top, v); }); return n; }); const f = { links }; if (top > vMaxLevel(cur.p)) f.maxLevel = top; vPatch("vttpages/" + cur.id, f); }
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-act=vttlinkkind]"); if (!b || !vCanEdit()) return; vLinkSet(b.closest("[data-link]").dataset.link, l => Object.assign(l, { kind: b.dataset.v, levels: b.dataset.v === "stairs" ? l.levels.slice(0, 2).concat(l.levels.length < 2 ? [l.levels[0] + 1] : []) : l.levels })); });
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest("[data-link] input, [data-link] select"); if (!f || !vCanEdit()) return;
  const id = f.closest("[data-link]").dataset.link;
  if (f.dataset.lk != null) vLinkSet(id, l => { const n = Number(f.dataset.lk); l.levels = f.checked ? l.levels.concat([n]) : l.levels.filter(v => v !== n); return l; });
  else if (f.dataset.lks != null) vLinkSet(id, l => { l.levels[Number(f.dataset.lks)] = Number(f.value); return l; });
  else if (f.dataset.lkn) vLinkSet(id, l => Object.assign(l, { [f.dataset.lkn]: Math.max(1, Math.round(Number(f.value) || 1)) }));
});
// The buttons that appear next to a token standing on stairs or a lift.
function vGoHtml(p, toks) {
  const links = p.links || []; if (!links.length) return "";
  const gm = vCanEdit(), C = VCELL;
  return `<div class="vgos">${toks.map(([id, t]) => {
    if (!(gm || (PLAYER && t.owner)) || (t.layer === "gm" && !gm)) return "";
    const s = t.size || 1, cx = t.x + s / 2, cy = t.y + s / 2, lv = Math.max(0, Number(t.lvl) || 0);
    const l = links.find(k => cx >= k.x && cx <= k.x + k.w && cy >= k.y && cy <= k.y + k.h && (k.levels || []).includes(lv)); if (!l) return "";
    const to = (l.levels || []).filter(n => n !== lv); if (!to.length) return "";
    return `<div class="vgo" style="left:${(t.x + s) * C + 6}px;top:${t.y * C}px">${to.map(n => `<button data-tok="${esc(id)}" data-lvl="${n}" title="Move ${esc(t.name || "token")} to ${esc(vLevelName(p, n))}">${l.kind === "lift" ? "🛗" : n > lv ? "⬆" : "⬇"} ${esc(vLevelName(p, n))}</button>`).join("")}</div>`; }).join("")}</div>`;
}
function vGoLevel(id, n) {
  const t = S.vttTokens.get(id); if (!t || !(vCanEdit() || (PLAYER && t.owner))) return;
  S.vttTokens.set(id, Object.assign({}, t, { lvl: n })); vDraw();
  vPatch("vtttokens/" + id, { lvl: n });
}


// ===== GM: armour class on tokens =====
function vTokAC(t) {
  const ref = t.ref || "", num = v => { const m = String(v == null ? "" : v).match(/\d+/); return m ? m[0] : ""; };
  try {
    if (ref.startsWith("c:")) { const c = S.chars.get(ref.slice(2)); return c && typeof cAC === "function" ? num(cAC(c)) : ""; }
    if (ref.startsWith("s:")) { const sm = vSummonOf(ref); return sm ? num((smView(sm).sb || {}).ac) : ""; }
    if (ref.startsWith("e:")) { const e = S.entries.get(t.form || ref.slice(2)) || S.entries.get(ref.slice(2)); return e && e.statblock ? num(e.statblock.ac) : ""; }
  } catch (e) {}
  return t.ac ? num(t.ac) : "";
}
function vAcBadge(t) { const ac = vTokAC(t); return ac ? `<span class="vac" title="Armour Class ${esc(ac)} (only you see this)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z"/></svg><b>${esc(ac)}</b></span>` : ""; }

// ===== Grid size from the image's file name =====
function vGridFromName(name, pw, ph) {
  const n = String(name || "").replace(/\.[a-z0-9]+$/i, "");
  let m = n.match(/(?:^|[^\d])(\d{1,3})\s*[x×]\s*(\d{1,3})(?:[^\d]|$)/i);
  if (m) { const w = +m[1], h = +m[2]; if (w >= 1 && h >= 1 && w <= 200 && h <= 200) return { w, h }; }
  m = n.match(/(\d{2,3})\s*(?:dpi|ppi|px|pps)\b/i);
  if (m) { const pp = +m[1]; if (pp >= 20 && pp <= 600) return { w: pw / pp, h: ph / pp }; }
  return null;
}

// ===== Several tokens at once: Shift-click or Shift-drag a box; copy, paste, duplicate =====
function vMultiSideHtml() {
  return `<h2>${VTT.multi.size} tokens selected</h2><p class="muted small">Drag any of them to move them together. Shift-click adds or removes one.</p>
    <div class="acts wrap"><button class="btn small" data-act="vttmulticopy">Copy (Ctrl+C)</button><button class="btn small" data-act="vttmultidup">Duplicate (Ctrl+D)</button><button class="btn ghost small" data-act="vttmultiinit">⚔ Add all to turn order</button><button class="btn ghost small danger" data-act="vttmultidel">Delete all</button></div>
    ${VTT.clip ? `<p class="muted small">${VTT.clip.length} token${VTT.clip.length === 1 ? "" : "s"} copied. Ctrl+V pastes them where your mouse is, on any map.</p>` : ""}`;
}
function vCopy() {
  const ids = VTT.multi.size ? [...VTT.multi] : VTT.sel && VTT.sel.kind === "tok" ? [VTT.sel.id] : [];
  const list = ids.map(id => S.vttTokens.get(id)).filter(Boolean); if (!list.length) return false;
  VTT.clip = list.map(t => { const o = JSON.parse(JSON.stringify(t)); delete o.page; return o; });
  try { localStorage.setItem("vttClip", JSON.stringify(VTT.clip)); } catch (e) {}
  toast(`Copied ${list.length} token${list.length === 1 ? "" : "s"}. Ctrl+V to paste.`); return true;
}
async function vPaste(offset) {
  if (!VTT.clip) { try { VTT.clip = JSON.parse(localStorage.getItem("vttClip") || "null"); } catch (e) {} }
  const cur = vPageNow(), clip = VTT.clip; if (!cur || !clip || !clip.length) return;
  const minX = Math.min(...clip.map(t => t.x)), minY = Math.min(...clip.map(t => t.y));
  let ox, oy;
  if (offset) { ox = minX + offset; oy = minY + offset; }
  else { const at = VTT.lastPt || [cur.p.w / 2, cur.p.h / 2]; ox = Math.round(at[0]); oy = Math.round(at[1]); }
  VTT.multi.clear(); VTT.sel = null;
  for (const t of clip) {
    const id = vid("t"), s = t.size || 1, nx = Math.max(0, Math.min(cur.p.w - s, t.x - minX + ox)), ny = Math.max(0, Math.min(cur.p.h - s, t.y - minY + oy));
    const doc = Object.assign({}, t, { page: cur.id, x: nx, y: ny }); if ((doc.ref || "").startsWith("s:")) doc.ref = "";
    VTT.multi.add(id); await vSave("vtttokens/" + id, doc);
  }
  if (VTT.multi.size === 1) { VTT.sel = { kind: "tok", id: [...VTT.multi][0] }; VTT.multi.clear(); }
  vRefresh();
}
async function vMultiAction(a) {
  if (a === "vttmulticopy") vCopy();
  else if (a === "vttmultidup") { if (vCopy()) vPaste(1); }
  else if (a === "vttmultidel") vDeleteSel();
  else if (a === "vttmultiinit") { const camp = vCampId(), I = vInitOf(camp); I.list = I.list.slice(); const rolls = []; [...VTT.multi].forEach(id => { const t = S.vttTokens.get(id); if (t && !I.list.some(x => x.tok === id)) { const e = vInitEntry(id, t, true); rolls.push(e._roll); I.list.push(e); } }); VTT.initOpen = true; if (rolls.length) toast(rolls.join(" · ")); await vInitSave(camp, I); }
}
document.addEventListener("pointermove", ev => { if (!ev.target.closest || !ev.target.closest("#vview")) return; try { VTT.lastPt = vPt(ev); } catch (e) {} }, { passive: true });

// ===== Drawing: doodles anyone can add, kept until rubbed out =====
// vttdraw/<id> = { page, dev, who, col, w, pts: [[x, y], ...] } in squares.
const VPEN_COLS = ["#ff4d4d", "#ffd23c", "#4cd964", "#4da6ff", "#c77dff", "#ffffff", "#111111"];
VTT.pen = (() => { try { return Object.assign({ col: "#ff4d4d", w: 4 }, JSON.parse(localStorage.getItem("vttPen") || "{}")); } catch (e) { return { col: "#ff4d4d", w: 4 }; } })();
VTT.erase = false;
const VDEV = (() => { try { let v = localStorage.getItem("vttDev"); if (!v) { v = "v" + Math.random().toString(36).slice(2, 10); localStorage.setItem("vttDev", v); } return v; } catch (e) { return "v0"; } })();
const vSavePen = () => { try { localStorage.setItem("vttPen", JSON.stringify(VTT.pen)); } catch (e) {} };
function vPenHtml(gm) {
  return `<div class="vpen">${VPEN_COLS.map(c => `<button class="vsw${!VTT.erase && VTT.pen.col === c ? " on" : ""}" data-act="vttpencol" data-v="${c}" style="--sw:${c}" aria-label="Pen colour ${c}" aria-pressed="${!VTT.erase && VTT.pen.col === c}"></button>`).join("")}
    <span class="vpenw">${[[2, "Thin"], [4, "Medium"], [8, "Thick"]].map(([n, l]) => `<button class="vbtn${VTT.pen.w === n ? " on" : ""}" data-act="vttpenw" data-v="${n}" title="${l}" aria-label="${l}"><i style="height:${n}px"></i></button>`).join("")}</span>
    <button class="vbtn${VTT.erase ? " on" : ""}" data-act="vttpenerase" title="Rub out: click or drag over a drawing" aria-pressed="${VTT.erase}">🧽 Rub out</button>
    <button class="vbtn" data-act="vttpenmine" title="Remove all your drawings on this map">Clear mine</button>${gm ? `<button class="vbtn" data-act="vttpenall" title="Remove every drawing on this map">Clear all</button>` : ""}</div>`;
}
function vPenRefresh() { const tl = document.getElementById("vtools"); if (tl && vCanEdit()) tl.innerHTML = vToolsHtml(); const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false); }
async function vPenAction(a, el) {
  const cur = vPageNow();
  if (a === "vttpencol") { VTT.pen.col = el.dataset.v; VTT.erase = false; vSavePen(); }
  else if (a === "vttpenw") { VTT.pen.w = Number(el.dataset.v); VTT.erase = false; vSavePen(); }
  else if (a === "vttpenerase") VTT.erase = !VTT.erase;
  else if (a === "vttpenmine" || a === "vttpenall") {
    if (!cur) return; const all = a === "vttpenall" && vCanEdit();
    const ids = [...(S.vttDraw || new Map())].filter(([, d]) => d.page === cur.id && (all || d.dev === VDEV)).map(([id]) => id);
    if (!ids.length) { toast(all ? "No drawings on this map." : "You haven't drawn anything on this map."); return; }
    if (all && !confirm(`Remove all ${ids.length} drawings on this map?`)) return;
    for (const id of ids) await vDel("vttdraw/" + id);
    toast(`Removed ${ids.length} drawing${ids.length === 1 ? "" : "s"}.`);
  }
  vPenRefresh();
}
const vPathD = pts => pts.map(([x, y], i) => (i ? "L" : "M") + (x * VCELL).toFixed(1) + " " + (y * VCELL).toFixed(1)).join(" ") + (pts.length === 1 ? " l0.1 0" : "");
function vDrawingsSvg(pid) {
  return [...(S.vttDraw || new Map())].filter(([, d]) => d && d.page === pid && Array.isArray(d.pts) && d.pts.length).map(([id, d]) => `<path data-did="${esc(id)}" d="${vPathD(d.pts)}" stroke="${esc(d.col || "#ff4d4d")}" stroke-width="${Math.max(1, Math.min(20, Number(d.w) || 4))}"/>`).join("") + `<path class="vdlive" id="vdlive" d=""/>`;
}
function vDrawingsRefresh() { const svg = document.getElementById("vdrawl"), cur = vPageNow(); if (svg && cur) svg.innerHTML = vDrawingsSvg(cur.id); }
function vDrawLive(pts) { const p = document.getElementById("vdlive"); if (!p) return; p.setAttribute("d", vPathD(pts)); p.setAttribute("stroke", VTT.pen.col); p.setAttribute("stroke-width", VTT.pen.w); }
function vDrawSave(pts) {
  const cur = vPageNow(); if (!cur || !pts.length) return;
  // Thin out points that sit on a straight line, to keep drawings small.
  const out = [pts[0]]; for (let i = 1; i < pts.length - 1; i++) { const a = out[out.length - 1], b = pts[i], c = pts[i + 1], cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); if (cross > 0.0015 || Math.hypot(b[0] - a[0], b[1] - a[1]) > 1.5) out.push(b); } if (pts.length > 1) out.push(pts[pts.length - 1]);
  const id = vid("w"), doc = { page: cur.id, dev: VDEV, who: vLiveName(), col: VTT.pen.col, w: VTT.pen.w, pts: out.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]) };
  if (!S.vttDraw) S.vttDraw = new Map(); S.vttDraw.set(id, doc); vDrawingsRefresh();
  vSave("vttdraw/" + id, doc);
}
function vEraseAt(x, y) {
  const cur = vPageNow(); if (!cur) return; const r = 0.25 / Math.max(0.4, VTT.zoom);
  for (const [id, d] of S.vttDraw || new Map()) {
    if (d.page !== cur.id || !Array.isArray(d.pts)) continue;
    const hit = d.pts.some((pt, i) => i ? vSegDist(x, y, [d.pts[i - 1][0], d.pts[i - 1][1], pt[0], pt[1]]) < r : Math.hypot(x - pt[0], y - pt[1]) < r);
    if (hit) { S.vttDraw.delete(id); vDrawingsRefresh(); vDel("vttdraw/" + id); }
  }
}

// ===== Quest log =====
// camp.quests = [{ id, title, giver, status: "active" | "done" | "failed", desc, steps: [{ t, done }], hidden }]
// camp.questShow = the GM has the log open for players; camp.questShowAt changes each time it's turned on, so a player
// who closed it sees it again next time the GM turns it on.
VTT.questOpen = false; VTT.qOpenIds = new Set();
const vQuests = camp => { const c = S.vttCamps.get(camp) || {}; return Array.isArray(c.quests) ? c.quests : []; };
function vQuestPlayerHidden(c) { try { return localStorage.getItem("vttQHide:" + vCampId()) === String(c.questShowAt || ""); } catch (e) { return false; } }
function vQuestBtn() { const camp = vCampId(), c = camp && S.vttCamps.get(camp); if (!c || !c.questShow || vCanEdit()) return ""; return `<span class="vsep"></span><button class="vbtn${vQuestPlayerHidden(c) ? "" : " on"}" data-act="vttqtoggle" title="Show or hide the quest log">📜 Quests</button>`; }
function vQuestDraw() {
  const box = document.getElementById("vquests"), camp = vCampId(); if (!box || !camp) return;
  if (document.activeElement && box.contains(document.activeElement) && document.activeElement.matches("input,textarea")) return;
  const c = S.vttCamps.get(camp) || {}, gm = vCanEdit(), list = vQuests(camp);
  const show = gm ? VTT.questOpen : !!c.questShow && !vQuestPlayerHidden(c);
  box.hidden = !show; if (!show) { box.innerHTML = ""; return; }
  const act = list.filter(q => (q.status || "active") === "active"), past = list.filter(q => (q.status || "active") !== "active");
  const row = q => { const open = VTT.qOpenIds.has(q.id), steps = q.steps || [], done = steps.filter(s => s.done).length;
    return `<li class="vq ${q.status || "active"}${q.hidden ? " hid" : ""}"><button class="vqh" data-act="vttqexp" data-id="${esc(q.id)}" aria-expanded="${open}"><span class="vqi">${q.status === "done" ? "✔" : q.status === "failed" ? "✖" : "◆"}</span><span class="vqt">${esc(q.title || "Quest")}</span>${steps.length ? `<small>${done}/${steps.length}</small>` : ""}${q.hidden ? `<small title="Only you see this">🔒</small>` : ""}</button>
      ${open ? `<div class="vqb">${q.giver ? `<p class="muted small">From ${esc(q.giver)}</p>` : ""}${q.desc ? `<p class="small">${esc(q.desc).replace(/\n/g, "<br>")}</p>` : ""}
        ${steps.length ? `<ul class="vqs">${steps.map((s, i) => `<li><label class="check small"><input type="checkbox" data-act="vttqstep" data-id="${esc(q.id)}" data-i="${i}"${s.done ? " checked" : ""}${gm ? "" : " disabled"}> <span${s.done ? ' class="done"' : ""}>${esc(s.t)}</span></label></li>`).join("")}</ul>` : ""}
        ${gm ? `<div class="vqa"><button class="btn ghost small" data-act="vttqedit" data-id="${esc(q.id)}">✎ Edit</button>${(q.status || "active") === "active" ? `<button class="btn ghost small" data-act="vttqstat" data-id="${esc(q.id)}" data-v="done">✔ Done</button>` : `<button class="btn ghost small" data-act="vttqstat" data-id="${esc(q.id)}" data-v="active">↺ Reopen</button>`}</div>` : ""}</div>` : ""}</li>`; };
  box.innerHTML = `<div class="vthead"><strong>📜 Quests</strong>${gm ? `<label class="check small vqshow" title="Open the quest log on your players' screens"><input type="checkbox" data-act="vttqshow"${c.questShow ? " checked" : ""}> Players</label>` : ""}<button class="iconbtn" data-act="${gm ? "vttqopen" : "vttqtoggle"}" aria-label="Close the quest log">×</button></div>
    <ol class="vqlist">${act.map(row).join("") || `<li class="muted small vtempty">${gm ? "No quests yet." : "No quests right now."}</li>`}</ol>
    ${past.length ? `<details class="vqpast"><summary>Finished (${past.length})</summary><ol class="vqlist">${past.map(row).join("")}</ol></details>` : ""}
    ${gm ? `<div class="vtacts"><button class="btn ghost small" data-act="vttqnew">+ New quest</button></div>` : ""}`;
}
function vQuestSave(camp, quests) { return vPatch("vttcamps/" + camp, { quests }); }
function vQuestEdit(q) {
  const camp = vCampId(), isNew = !q; q = q || { id: vid("q"), title: "", giver: "", status: "active", desc: "", steps: [], hidden: false };
  openModal(`<h2>${isNew ? "New quest" : "Edit quest"}</h2><form class="vqform">
    <label><span>Title</span><input id="vq-t" type="text" value="${esc(q.title)}" placeholder="e.g. Find the missing caravan"></label>
    <label><span>Given by</span><input id="vq-g" type="text" value="${esc(q.giver || "")}" placeholder="optional"></label>
    <label><span>Details</span><textarea id="vq-d" rows="4" placeholder="What the party knows">${esc(q.desc || "")}</textarea></label>
    <label><span>Objectives <small class="muted">one a line; start a line with [x] if it's done</small></span><textarea id="vq-s" rows="4" placeholder="Speak to the innkeeper&#10;Follow the tracks north">${esc((q.steps || []).map(s => (s.done ? "[x] " : "") + s.t).join("\n"))}</textarea></label>
    <div class="frow tight"><label><span>Status</span><select id="vq-st">${[["active", "Active"], ["done", "Completed"], ["failed", "Failed"]].map(([v, l]) => `<option value="${v}"${(q.status || "active") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label class="check"><input id="vq-h" type="checkbox"${q.hidden ? " checked" : ""}> Hidden from players <small class="muted">only you see it, until you untick this</small></label>
    <div class="acts wrap"><button class="btn" type="submit">Save</button>${isNew ? "" : `<button class="btn ghost danger" type="button" id="vq-del">Delete quest</button>`}<button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div></form>`, m => {
    m.querySelector("#vq-t").focus();
    m.querySelector("form").onsubmit = ev => { ev.preventDefault();
      const nq = Object.assign({}, q, { title: m.querySelector("#vq-t").value.trim() || "Quest", giver: m.querySelector("#vq-g").value.trim(), desc: m.querySelector("#vq-d").value.trim(), status: m.querySelector("#vq-st").value, hidden: m.querySelector("#vq-h").checked,
        steps: m.querySelector("#vq-s").value.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const d = /^\[x\]\s*/i.test(l); return { t: l.replace(/^\[[ x]?\]\s*/i, ""), done: d }; }) });
      const list = vQuests(camp).slice(), i = list.findIndex(x => x.id === q.id); if (i >= 0) list[i] = nq; else list.push(nq);
      VTT.qOpenIds.add(nq.id); closeModal(); vQuestSave(camp, list); };
    const del = m.querySelector("#vq-del"); if (del) del.onclick = () => { if (!confirm("Delete this quest?")) return; closeModal(); vQuestSave(camp, vQuests(camp).filter(x => x.id !== q.id)); };
  });
}
async function vQuestAction(a, el) {
  const camp = vCampId(); if (!camp) return; const c = S.vttCamps.get(camp) || {};
  if (a === "vttqexp") { const id = el.dataset.id; if (VTT.qOpenIds.has(id)) VTT.qOpenIds.delete(id); else VTT.qOpenIds.add(id); vQuestDraw(); return; }
  if (a === "vttqtoggle") { try { const k = "vttQHide:" + camp; if (vQuestPlayerHidden(c)) localStorage.removeItem(k); else localStorage.setItem(k, String(c.questShowAt || "")); } catch (e) {} vQuestDraw(); const pt = document.getElementById("vptools"); if (pt) pt.innerHTML = vMeasToolsHtml(false); return; }
  if (!vCanEdit()) return;
  if (a === "vttqopen") { VTT.questOpen = !VTT.questOpen; document.querySelectorAll("[data-act=vttqopen].btn").forEach(b => b.classList.toggle("on", VTT.questOpen)); vQuestDraw(); return; }
  if (a === "vttqshow") { await vPatch("vttcamps/" + camp, el.checked ? { questShow: true, questShowAt: Date.now() } : { questShow: false }); return; }
  if (a === "vttqnew") { vQuestEdit(null); return; }
  if (a === "vttqedit") { const q = vQuests(camp).find(x => x.id === el.dataset.id); if (q) vQuestEdit(q); return; }
  if (a === "vttqstat") { vQuestSave(camp, vQuests(camp).map(q => q.id === el.dataset.id ? Object.assign({}, q, { status: el.dataset.v }) : q)); return; }
  if (a === "vttqstep") { const i = Number(el.dataset.i); vQuestSave(camp, vQuests(camp).map(q => q.id === el.dataset.id ? Object.assign({}, q, { steps: (q.steps || []).map((s, k) => k === i ? Object.assign({}, s, { done: el.checked }) : s) }) : q)); return; }
}


// ===== Movement paths: corners and walls in the way =====
function vAddWaypoint(d) {
  if (!d || !d.end) return; const last = d.wps[d.wps.length - 1] || [d.t.x + (d.t.size || 1) / 2, d.t.y + (d.t.size || 1) / 2];
  const now = Date.now(); if (d.lastWp && now - d.lastWp < 250) return; d.lastWp = now;
  if (Math.hypot(d.end[0] - last[0], d.end[1] - last[1]) < 0.01) return;
  d.wps.push(d.end.slice());
}
// Where a move from a to b crosses walls that would block it at that height: closed doors count, open doors and windows don't.
function vWallHits(p, h, a, b) {
  const lvl = Math.max(0, Math.round(h || 0)), out = [];
  (p.walls || []).forEach(w => {
    if ((w[4] || 0) !== lvl || vWallPassable(w)) return;
    const rx = b[0] - a[0], ry = b[1] - a[1], sx = w[2] - w[0], sy = w[3] - w[1], den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) return;
    const t = ((w[0] - a[0]) * sy - (w[1] - a[1]) * sx) / den, u = ((w[0] - a[0]) * ry - (w[1] - a[1]) * rx) / den;
    if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) out.push([a[0] + rx * t, a[1] + ry * t]);
  });
  return out;
}


// ===== Page settings, in the side panel when nothing is selected =====
function vPageSideHtml(p) {
  const cur = vPageNow(), camp = S.vttCamps.get(p.camp), n = vTokens(VTT.page).length;
  const hasMap = (p.objs || []).some(o => o.layer === "map" && !o.level);
  return `<h2>${esc(p.name || "Page")}</h2><p class="muted small">${p.w} × ${p.h} squares · ${n} token${n === 1 ? "" : "s"} · ${(p.walls || []).length} wall${(p.walls || []).length === 1 ? "" : "s"}</p>
    <div class="vform vpset" data-page="${esc(cur ? cur.id : "")}">
      <label><span>Name</span><input id="ps-name" type="text" data-ps="name" value="${esc(p.name || "")}"></label>
      <div><span class="flabel">Map image</span><div class="acts wrap"><button class="btn small" data-act="vttmapimg">🖼 ${hasMap ? "Add another map image" : "Add a map image"}</button></div>
        <p class="muted small">Goes on the Map layer, under the grid. Name the file like <em>tavern 30x40.jpg</em> or <em>cave 140dpi.png</em> and the grid is read from it.</p></div>
      <div class="frow tight"><label><span>Width</span><input type="number" min="1" max="200" data-ps="w" value="${p.w}"></label><label><span>Height</span><input type="number" min="1" max="200" data-ps="h" value="${p.h}"></label><label><span>Background</span><input type="color" data-ps="bg" value="${esc(p.bg || "#1b1f27")}"></label></div>
      <label><span>Folder</span><select data-ps="folder"><option value="">(top level)</option>${vFolders(camp).map(f => `<option value="${esc(f.id)}"${p.folder === f.id ? " selected" : ""}>${esc(vFolderPath(camp, f.parent) + f.name)}</option>`).join("")}</select></label>
      <label class="check"><input type="checkbox" data-ps="open"${p.open ? " checked" : ""}> Players can switch to this map themselves</label>
      <label class="check"><input type="checkbox" data-ps="grid"${p.grid !== false ? " checked" : ""}> Show the grid</label>
      <label class="check"><input type="checkbox" data-ps="snap"${p.snap !== false ? " checked" : ""}> Snap tokens to the grid <small class="muted">untick for world and region maps (Alt flips it)</small></label>
      <div><span class="flabel">Travel scale</span>${p.scale && p.scale.len ? `<p class="small">${vScaleText(p.scale)} <button class="linkbtn small" data-act="vttscaleclr">Clear</button></p>` : `<p class="muted small">None yet. Use the <strong>📐 Scale</strong> tool to drag a line and say how far a day's travel is; then anyone can plan routes with <strong>🧭 Travel</strong>.</p>`}</div>
      <label class="check"><input type="checkbox" data-ps="light"${p.light ? " checked" : ""}> Dynamic lighting <small class="muted">walls block what players' tokens can see</small></label>
      <label class="check"><input type="checkbox" data-ps="fogMem"${p.fogMem !== false ? " checked" : ""}> Remember explored areas</label>
      <div class="acts wrap"><button class="btn ghost small" data-act="vttpsfog">Reset explored areas</button><button class="btn ghost small" data-act="vttpswalls">Remove all walls</button><button class="btn ghost small danger" data-act="vttpsdel">Delete page</button></div>
    </div>
    <details class="vtipsd"><summary>Tips</summary>${vSideTips(p)}</details>`;
}
document.addEventListener("change", ev => {
  const f = ev.target.closest && ev.target.closest(".vpset [data-ps]"); if (!f || !vCanEdit()) return;
  const pid = f.closest(".vpset").dataset.page; if (!pid) return;
  const k = f.dataset.ps; let v = f.type === "checkbox" ? f.checked : f.value;
  if (k === "w" || k === "h") v = Math.max(1, Math.min(200, Math.round(Number(v) || 15)));
  if (k === "name") v = String(v).trim() || "Page";
  vPatch("vttpages/" + pid, { [k]: v }); if (k === "w" || k === "h") VTT.fitDone = "";
});
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("[data-act=vttpsfog],[data-act=vttpswalls],[data-act=vttpsdel]"); if (!b || !vCanEdit()) return;
  const cur = vPageNow(); if (!cur) return; const p = cur.p, a = b.dataset.act;
  if (a === "vttpsfog") { if (await confirmBox("Forget everything the players' tokens have explored on this page?", "Reset")) { VTT.fogBits = null; VTT.fogKey = ""; await vDel("vttfog/" + cur.id).catch(() => {}); vDraw(); } }
  else if (a === "vttpswalls") { if (await confirmBox(`Remove all ${(p.walls || []).length} walls from this page?`, "Remove walls")) vPatch("vttpages/" + cur.id, { walls: [] }); }
  else if (a === "vttpsdel") { if (!(await confirmBox(`Delete the page “${p.name}” and its tokens?`, "Delete page"))) return; for (const [tid] of vTokens(cur.id)) await vDel("vtttokens/" + tid); await vDel("vttfog/" + cur.id).catch(() => {}); await vDel("vttpages/" + cur.id); VTT.page = null; render(); }
});

// ===== A new map straight from an image =====
function vNewMapFromImage(camp, folder) {
  pickImage(async (res, file) => {
    const url = assetPath(res);
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = url; });
    if (!im) { toast("Couldn't read that image."); return; }
    const base = String((file && file.name) || "Map").replace(/\.[a-z0-9]+$/i, "");
    let g = vGridFromName(base, im.naturalWidth, im.naturalHeight);
    if (!g) {
      const guess = Math.max(1, Math.round(im.naturalWidth / VCELL));
      const ans = await vAsk("How big is this map?", `Squares across (it's ${im.naturalWidth} × ${im.naturalHeight} pixels)`, String(guess), "Create map"); if (!ans) return;
      const across = Math.max(1, Math.min(200, Number(ans) || guess)); g = { w: across, h: across * im.naturalHeight / im.naturalWidth };
    }
    const name = base.replace(/[_-]+/g, " ").replace(/\s*\(?\d{1,3}\s*[x×]\s*\d{1,3}\)?\s*/i, " ").replace(/\s*\d{2,3}\s*(dpi|ppi|px|pps)\b/i, " ").replace(/\s+/g, " ").trim() || "Map";
    const id = await vNewPage(camp, name, vPages(camp).length, folder);
    const W = Math.max(1, Math.ceil(g.w - 0.01)), H = Math.max(1, Math.ceil(g.h - 0.01));
    await vPatch("vttpages/" + id, { w: W, h: H, objs: [{ id: vid("o"), layer: "map", img: url, x: 0, y: 0, w: g.w, h: g.h, level: 0 }] });
    if (folder) VCLOSED.delete(folder);
    for (let i = 0; i < 40 && !S.vttPages.has(id); i++) await new Promise(r => setTimeout(r, 50));
    VTT.page = id; VTT.sel = null; VTT.fitDone = ""; render();
    toast(`New map “${name}”: ${+g.w.toFixed(1)} × ${+g.h.toFixed(1)} squares.`);
  });
}

// ===== Walls: moving an end drags every wall joined there =====
function vWallEndPreview(d) { return `<circle cx="${d.np[0] * VCELL}" cy="${d.np[1] * VCELL}" r="8" class="vwhprev"/>`; }
function vWallMoveEnd(pt, np, lvl) {
  const cur = vPageNow(); if (!cur) return; const same = (a, b) => Math.abs(a - pt[0]) < 1e-6 && Math.abs(b - pt[1]) < 1e-6;
  const walls = (cur.p.walls || []).map(w => { if ((w[4] || 0) !== lvl) return w; const n = w.slice(); if (same(w[0], w[1])) { n[0] = np[0]; n[1] = np[1]; } if (same(w[2], w[3])) { n[2] = np[0]; n[3] = np[1]; } return n; })
    .filter(w => Math.hypot(w[2] - w[0], w[3] - w[1]) > 1e-6);
  cur.p.walls = walls; vDraw(); vPatch("vttpages/" + cur.id, { walls });
}
VTT.wallSnap = (() => { try { return localStorage.getItem("vttWallSnap") !== "0"; } catch (e) { return true; } })();

// ===== Token order (which one draws on top) =====
function vTokZ(how) {
  const id = VTT.sel && VTT.sel.kind === "tok" && VTT.sel.id, t = id && S.vttTokens.get(id), cur = vPageNow(); if (!t || !cur || !vCanEdit()) return;
  const zs = vTokens(cur.id).map(([, q]) => Number(q.z) || 0), z0 = Number(t.z) || 0;
  const z = how === "front" ? Math.max(...zs) + 1 : how === "back" ? Math.min(...zs) - 1 : how === "up" ? z0 + 1 : z0 - 1;
  S.vttTokens.set(id, Object.assign({}, t, { z })); vDraw(); vPatch("vtttokens/" + id, { z });
}

// ===== Monsters at 0 hit points: no bars, a faint red cross =====
function vDead(t) {
  if (t.owner || (t.ref || "").startsWith("c:") || (t.ref || "").startsWith("s:")) return false;
  return t.hpMax != null && t.hpMax !== "" && Number(t.hpMax) > 0 && t.hp != null && t.hp !== "" && Number(t.hp) <= 0;
}

// ===== Summons that can shapeshift: pick the form on the tabletop too =====
function vSmFormCtl(id, t, sm, cid, canEdit) {
  const e = sm.ref && S.entries.get(sm.ref);
  if (typeof isShifter !== "function" || !isShifter(e)) return "";
  const forms = ssForms(sm.ref, e), cur = sm.form || "";
  if (!canEdit) { const f = cur && S.entries.get(cur); return f ? "" : ""; }
  return `<div class="vform vformctl" data-smtok="${esc(id)}"><label><span>◈ Shapeshift form <small class="muted">the token takes on that creature's picture</small></span><select class="vsmform" data-cid="${esc(cid)}" data-sid="${esc(sm.id)}"><option value="">True form</option>${forms.map(([fid, x]) => `<option value="${esc(fid)}"${cur === fid ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label></div>`;
}
document.addEventListener("change", ev => {
  const f = ev.target.matches && ev.target.matches(".vsmform") && ev.target; if (!f) return;
  const cid = f.dataset.cid, sid = f.dataset.sid, v = f.value;
  charChange(cid, x => { x.summons = smList(x).map(q => q.id === sid ? Object.assign({}, q, { form: v || "", fhp: null }) : q); });
  setTimeout(() => { if (document.getElementById("vstage")) vRefresh(); }, 150);
});


// ===== Grid snapping per page =====
const vNoSnap = () => { const cur = vPageNow(); return !!(cur && cur.p && cur.p.snap === false); };

// ===== Travel: a scale for the map, and routes measured in days =====
// page.scale = { len: squares, amt, unit: "day" | "hour", mi } : a line of len squares is amt days (or hours) of travel, mi miles (optional).
// A travel day is 8 hours on the road, as in the 5e rules; slow pace covers 2/3 the ground, fast 4/3.
VTT.pace = "normal";
const VPACE = { slow: [2 / 3, "Slow"], normal: [1, "Normal"], fast: [4 / 3, "Fast"] };
function vScaleText(sc) { return `${+sc.len.toFixed(2)} squares = ${sc.amt} ${sc.unit === "hour" ? "hour" : "day"}${sc.amt === 1 ? "" : "s"} of travel${sc.mi ? ` (${sc.mi} miles)` : ""}`; }
function vRouteLen(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return d; }
function vFmtDays(h) {
  // h = hours on the road; show days of 8 hours, plus leftover hours.
  if (h < 8) return `${Math.max(0.1, Math.round(h * 10) / 10)} hour${Math.round(h * 10) / 10 === 1 ? "" : "s"}`;
  const d = Math.floor(h / 8), r = Math.round(h - d * 8);
  return r === 8 ? `${d + 1} days` : `${d} day${d === 1 ? "" : "s"}${r ? ` ${r} h` : ""}`;
}
function vTravelLabel(pts, pace) {
  const cur = vPageNow(), sc = cur && cur.p.scale; if (!sc || !sc.len) return "No travel scale on this map yet";
  const len = vRouteLen(pts), hoursPerLen = (sc.unit === "hour" ? sc.amt : sc.amt * 8) / sc.len, f = (VPACE[pace || "normal"] || VPACE.normal)[0];
  const h = len * hoursPerLen / f, mi = sc.mi ? len * sc.mi / sc.len : 0;
  return `${vFmtDays(h)}${pace && pace !== "normal" ? ` (${VPACE[pace][1].toLowerCase()} pace)` : ""}${mi ? ` · ${mi >= 10 ? Math.round(mi) : Math.round(mi * 10) / 10} mi` : ""}`;
}
function vTravelToolsHtml(gm) {
  const cur = vPageNow(), sc = cur && cur.p.scale;
  if (VTT.tool === "scale") return `<p class="muted small vlhint">Drag a line over a stretch of the map, then say how much travel it is.${sc && sc.len ? `<br>Now: ${esc(vScaleText(sc))}.` : ""}</p>`;
  const paces = Object.entries(VPACE).map(([k, [, l]]) => `<button class="${(VTT.pace || "normal") === k ? "on" : ""}" data-act="vtttpace" data-v="${k}" aria-pressed="${(VTT.pace || "normal") === k}">${l}</button>`).join("");
  return `<div class="seg vpace" role="group" aria-label="Travel pace">${paces}</div>${VTT.meas && VTT.meas.shape === "travel" ? `<button class="vbtn" data-act="vtttclear">✕ Clear route</button>` : ""}${gm ? `<p class="muted small vlhint">Click to add stops; double-click or Enter to finish. ${sc && sc.len ? esc(vScaleText(sc)) + "." : "Set a scale first with 📐."}</p>` : ""}`;
}
function vTravelClick(x, y, ev) {
  const now = Date.now(), m = VTT.meas, lc = VTT.lastTravelClick;
  VTT.lastTravelClick = { t: now, cx: ev.clientX, cy: ev.clientY };
  if (m && m.shape === "travel" && m.open && lc && now - lc.t < 400 && Math.hypot(ev.clientX - lc.cx, ev.clientY - lc.cy) < 8) { vTravelFinish(); return; }
  if (!m || m.shape !== "travel" || !m.open) VTT.meas = { shape: "travel", pts: [[x, y]], open: true, pace: VTT.pace || "normal" };
  else m.pts.push([x, y]);
  vMeasDraw(); vLiveMeas(true); vMeasToolsRefresh();
}
function vTravelFinish() { const m = VTT.meas; if (!m || m.shape !== "travel") return; m.open = false; m.hover = null; if (m.pts.length < 2) VTT.meas = null; vMeasDraw(); vLiveMeas(true); vMeasToolsRefresh(); }
function vScaleSet() {
  const m = VTT.meas, cur = vPageNow(); if (!m || m.shape !== "scale" || !cur) return;
  const len = Math.hypot(m.e[0] - m.s[0], m.e[1] - m.s[1]);
  if (len < 0.3) { VTT.meas = null; vMeasDraw(); toast("Drag a longer line along the map."); return; }
  const sc = cur.p.scale || {};
  openModal(`<h2>Travel scale</h2><p class="muted small">The line you drew is ${+len.toFixed(2)} squares long. How much travel is it?</p><form class="vscaleform">
    <div class="frow tight"><label><span>Amount</span><input id="vsc-a" type="number" min="0.1" step="0.1" value="${sc.amt || 1}"></label><label><span>Of</span><select id="vsc-u"><option value="day"${sc.unit !== "hour" ? " selected" : ""}>days of travel</option><option value="hour"${sc.unit === "hour" ? " selected" : ""}>hours of travel</option></select></label><label><span>Miles <small class="muted">optional</small></span><input id="vsc-m" type="number" min="0" step="1" value="${sc.mi || ""}" placeholder="e.g. 24"></label></div>
    <p class="muted small">A day is 8 hours on the road at normal pace. Slow pace takes longer, fast pace less.</p>
    <div class="acts"><button class="btn" type="submit">Save scale</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div></form>`, md => {
    md.querySelector("#vsc-a").focus(); md.querySelector("#vsc-a").select();
    md.querySelector("form").onsubmit = ev => { ev.preventDefault();
      const amt = Math.max(0.1, Number(md.querySelector("#vsc-a").value) || 1), unit = md.querySelector("#vsc-u").value, mi = Math.max(0, Number(md.querySelector("#vsc-m").value) || 0);
      closeModal(); VTT.meas = null; vMeasDraw();
      vPatch("vttpages/" + cur.id, { scale: Object.assign({ len: Math.round(len * 1000) / 1000, amt, unit }, mi ? { mi } : {}) });
      toast("Scale saved. Use 🧭 Travel to plan a route."); vSetTool("travel"); };
  });
}


// Tokens moved by someone else glide from where they were, rather than jumping.
function vSlideTokens(stage, prev) {
  if (!prev.size || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const moving = [];
  stage.querySelectorAll(".vtok").forEach(el => {
    const was = prev.get(el.dataset.tid); if (!was || !isFinite(was[0])) return;
    const nx = parseFloat(el.style.left), ny = parseFloat(el.style.top), d = Math.hypot(nx - was[0], ny - was[1]);
    if (d < 1) return;
    // Mid-slide and redrawn with the same target: carry on from where it is, without restarting the timing.
    el.style.transition = "none"; el.style.left = was[0] + "px"; el.style.top = was[1] + "px";
    moving.push([el, nx, ny, Math.min(0.7, 0.2 + d / 1500)]);
  });
  if (!moving.length) return;
  void stage.offsetWidth;
  moving.forEach(([el, nx, ny, t]) => { el.style.transition = `left ${t}s ease-out, top ${t}s ease-out`; el.style.left = nx + "px"; el.style.top = ny + "px"; });
}
