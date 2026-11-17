// ---------- Shapeshifting: creatures (and summons) tagged as shapeshifters can take another creature's form ----------
// Rules live on the creature entry: e.shapeshift = { allow: "any" | "tags", tags: [slugs], maxCr: "", mode: "replace" | "form", current: ref }
// "replace" shows the chosen creature's stat block after the creature's own, glowing blue. "form" only notes the shape.
const SS_RE = /shape[\s-]*shift/i;
const isShifterTags = tags => (tags || []).some(s => SS_RE.test(s) || SS_RE.test(tagName(s)));
const isShifter = e => !!(e && e.type === "creature" && isShifterTags(e.tags));
const ssRules = e => Object.assign({ allow: "any", tags: [], maxCr: "", mode: "replace" }, (e && e.shapeshift) || {});
const SS_LOCAL = {}; // forms picked on the read-only page, kept for this visit only

function ssForms(selfId, e) {
  const r = ssRules(e), max = String(r.maxCr || "").trim();
  return [...S.entries].filter(([id, x]) => id !== selfId && x.type === "creature" && x.statblock)
    .filter(([, x]) => r.allow !== "tags" || !r.tags.length || (x.tags || []).some(t => r.tags.includes(t)))
    .filter(([, x]) => !max || crNum((x.statblock || {}).cr) <= crNum(max))
    .sort((a, b) => byName(a[1].title, b[1].title));
}
function ssRulesText(e) {
  const r = ssRules(e);
  const who = r.allow === "tags" && r.tags.length ? `creatures tagged ${r.tags.map(t => tagName(t)).join(" or ")}` : "any creature";
  return `Can turn into ${who}${r.maxCr ? ` up to CR ${r.maxCr}` : ""}. ${r.mode === "form" ? "Takes on the creature's form only; its own statistics stay." : "Uses the new form's stat block."}`;
}
// The control and the shifted block. cur is the chosen form's id; act/data attributes say where to store it.
function ssPanelHtml(e, selfId, cur, attrs, canEdit, compact) {
  const r = ssRules(e), forms = ssForms(selfId, e), f = cur && S.entries.get(cur);
  const ctl = canEdit ? `<div class="ssctl"><label><span class="sr">Form</span><select data-ssel ${attrs}><option value="">Choose a form…</option>${forms.map(([id, x]) => `<option value="${esc(id)}"${id === cur ? " selected" : ""}>${esc(x.title)}${(x.statblock || {}).cr ? ` (CR ${esc(firstWord(x.statblock.cr))})` : ""}</option>`).join("")}</select></label>
      ${f ? `<button type="button" class="btn ghost small" data-ssrevert ${attrs}>Revert to true form</button>` : ""}</div>` : "";
  const head = `<div class="sshead"><span class="ssicon" aria-hidden="true">◈</span><strong>Shapeshifting</strong><span class="muted small">${esc(ssRulesText(e))}</span></div>${ctl}${!forms.length && canEdit ? `<p class="muted small">No creatures in the bestiary fit these rules yet.</p>` : ""}`;
  if (!f) return `<section class="sspanel">${head}</section>`;
  if (r.mode === "form") return `<section class="sspanel on">${head}<p class="ssnote">Currently in the form of <a href="#entry-${esc(cur)}">${esc(f.title)}</a>. Only its shape changes; the stat block above still applies.</p></section>`;
  const block = statBlockHtml(f.statblock, f.title, "core") + (f.statblock.features ? featuresHtml(f.statblock, cur) : "");
  return `<section class="sspanel on">${head}<div class="ssform"><div class="sstitle">Shapeshifted into <a href="#entry-${esc(cur)}">${esc(f.title)}</a></div>${compact ? `<p class="muted small">Its hit points, AC, speed and attacks are in use below, with any equipped weapons, armour and shields still counted. Its hit points are separate: at 0 it returns to its true form.</p><details class="smfull"><summary>${esc(f.title)}'s stat block</summary>${block}</details>` : block}</div></section>`;
}
// On a creature's own page or bestiary panel.
function ssEntryHtml(id, e) {
  if (!isShifter(e)) return "";
  const cur = SS_LOCAL[id] !== undefined ? SS_LOCAL[id] : ssRules(e).current || "";
  return ssPanelHtml(e, id, cur, `data-ssid="${esc(id)}"`, true);
}
// On a summon card: the summon's own pick, stored on the character.
function ssSummonHtml(s, P) {
  const e = s.ref && S.entries.get(s.ref);
  if (!isShifter(e)) return "";
  return ssPanelHtml(e, s.ref, s.form || "", `data-sssm="${esc(s.id)}"`, P, true);
}
// The summon's quick attacks while shifted into a "replace" form.
function ssSummonForm(s) {
  const e = s.ref && S.entries.get(s.ref), f = s.form && S.entries.get(s.form);
  return isShifter(e) && f && f.statblock && ssRules(e).mode !== "form" ? f : null;
}
async function ssSet(el, v) {
  if (el.dataset.ssid) {
    const id = el.dataset.ssid, e = S.entries.get(id); if (!e) return;
    if (READONLY) { SS_LOCAL[id] = v; render(); return; }
    SS_LOCAL[id] = v; render();
    const sh = Object.assign({}, e.shapeshift || {}); if (v) sh.current = v; else delete sh.current;
    await safeWrite(() => S.db.doc("entries/" + id).set(Object.assign({}, e, { shapeshift: sh })));
    delete SS_LOCAL[id];
  } else if (el.dataset.sssm) {
    const sh = document.querySelector(".sheet"), cid = sh && sh.dataset.id, sid = el.dataset.sssm; if (!cid) return;
    charChange(cid, x => { x.summons = smList(x).map(s => s.id === sid ? Object.assign({}, s, { form: v || "", fhp: null }) : s); });
  }
}
document.addEventListener("change", ev => { const t = ev.target; if (t.matches && t.matches("select[data-ssel]")) ssSet(t, t.value); });
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-ssrevert]"); if (b) ssSet(b, ""); });

// ----- Editor: shown for creatures once they have a shapeshifting tag -----
function ssFieldsHtml(e) {
  const r = ssRules(e), opts = allTagSlugs().map(s => [s, tagName(s)]);
  return `<fieldset id="ss-fields" class="ssfields"${e.type === "creature" && isShifterTags(e.tags) ? "" : " hidden"}><legend>◈ Shapeshifting</legend>
    <p class="muted small">This creature has a shapeshifting tag, so it gets a form picker under its stat block (and on summon cards).</p>
    <div class="frow">
      <label><span>Can turn into</span><select id="ss-allow"><option value="any"${r.allow !== "tags" ? " selected" : ""}>Any creature</option><option value="tags"${r.allow === "tags" ? " selected" : ""}>Only creatures with these tags</option></select></label>
      <label><span>Highest CR <small class="muted">optional</small></span><input id="ss-maxcr" type="text" class="mini" value="${esc(r.maxCr || "")}" placeholder="e.g. 2"></label>
    </div>
    <div class="field" id="ss-tagwrap"${r.allow === "tags" ? "" : " hidden"}><span class="flabel">Tags</span>${tagPickHtml("ss-tags", opts, r.tags, { ph: "Add a tag, e.g. beast" })}</div>
    <div class="field"><span class="flabel">When it shifts</span>
      <label class="check"><input type="radio" name="ss-mode" value="replace"${r.mode !== "form" ? " checked" : ""}> <strong>Replace stat block</strong> <small class="muted">the new form's stat block shows after its own, in glowing blue</small></label>
      <label class="check"><input type="radio" name="ss-mode" value="form"${r.mode === "form" ? " checked" : ""}> <strong>Take on creature form</strong> <small class="muted">appearance only; the stat block stays as it is</small></label>
    </div></fieldset>`;
}
function ssToggle() {
  const fs = $("#ss-fields"), ty = $("#ed-type"); if (!fs || !ty) return;
  fs.hidden = !(ty.value === "creature" && isShifterTags(draftTags));
}
function readSsFields(e) {
  if (!$("#ss-fields") || !isShifterTags(draftTags)) return null;
  const m = document.querySelector('input[name="ss-mode"]:checked');
  const sh = { allow: $("#ss-allow").value, tags: tagPickRead("ss-tags"), maxCr: $("#ss-maxcr").value.trim(), mode: m ? m.value : "replace" };
  if (e && e.shapeshift && e.shapeshift.current) sh.current = e.shapeshift.current;
  return sh;
}
document.addEventListener("change", ev => {
  if (ev.target.id === "ss-allow") $("#ss-tagwrap").hidden = ev.target.value !== "tags";
  if (ev.target.id === "ed-type") ssToggle();
});
