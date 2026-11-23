// ---------- Characters: player sheets you can play from ----------
const ABILS = [["str", "Strength"], ["dex", "Dexterity"], ["con", "Constitution"], ["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]];
const SKILLS = [["acrobatics", "Acrobatics", "dex"], ["animal-handling", "Animal Handling", "wis"], ["arcana", "Arcana", "int"], ["athletics", "Athletics", "str"], ["deception", "Deception", "cha"], ["history", "History", "int"], ["insight", "Insight", "wis"], ["intimidation", "Intimidation", "cha"], ["investigation", "Investigation", "int"], ["medicine", "Medicine", "wis"], ["nature", "Nature", "int"], ["perception", "Perception", "wis"], ["performance", "Performance", "cha"], ["persuasion", "Persuasion", "cha"], ["religion", "Religion", "int"], ["sleight-of-hand", "Sleight of Hand", "dex"], ["stealth", "Stealth", "dex"], ["survival", "Survival", "wis"]];
const FEATURE_SOURCES = ["Class", "Race", "Feat", "Background", "DM", "Item", "Other"];
const CHAR_TABS = [["play", "Play"], ["stats", "Stats"], ["features", "Features"], ["story", "Story"]];
const CS = { edit: false, tab: "play", view: "sheet", timers: {}, amt: "" };

const signed = n => (n >= 0 ? "+" : "−") + Math.abs(n);
function cMod(c, a) { return Math.floor((cScore(c, a) - 10) / 2); }
function cPB(c) { const o = String(c.pbOverride || "").trim(); if (o) return parseInt(o, 10) || 0; const l = Number(c.level) || 1; return 2 + Math.floor((Math.max(1, l) - 1) / 4); }
function cSave(c, a) { return cMod(c, a) + ((c.saves || {})[a] ? cPB(c) : 0); }
function cSkill(c, k) { const sk = SKILLS.find(s => s[0] === k); return cMod(c, sk[2]) + cPB(c) * (Number((c.skills || {})[k]) || 0); }
function cInit(c) { const o = String(c.initOverride || "").trim(); return o ? o.replace(/^(\d)/, "+$1") : signed(cMod(c, "dex")); }
function blankCharacter(name) {
  const now = new Date().toISOString();
  return { name: name || "New character", player: "", race: "", classes: "", level: 1, background: "", alignment: "", xp: "", ac: "10", speed: "30ft", initOverride: "", pbOverride: "", inspiration: false,
    hp: { max: 10, cur: 10, temp: 0 }, hd: { die: "1d8", total: 1, used: 0 }, death: { s: 0, f: 0 },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, saves: {}, skills: {}, attacks: [], combatNotes: "", resources: [], features: [],
    profs: { armour: [], weapons: [], tools: [], languages: "" }, equipment: "", money: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    notes: { personality: "", ideals: "", bonds: "", flaws: "", backstory: "", allies: "", treasure: "" }, appearance: { age: "", height: "", weight: "", eyes: "", skin: "", hair: "" },
    created: now, updated: now };
}

// ---- saving: change in memory now, write after a short pause ----
function charChange(id, mutate, rerender) {
  const cur = S.chars.get(id); if (!cur) return;
  const c = JSON.parse(JSON.stringify(cur));
  mutate(c); c.updated = new Date().toISOString();
  const moved = typeof invNormalize === "function" ? invNormalize(c) : 0;
  if (typeof invUnstack === "function") invUnstack(c);
  if (moved) setTimeout(() => toast(`${moved} item${moved === 1 ? "" : "s"} from a storage item went back to the pack.`));
  S.chars.set(id, c);
  if (rerender !== false) render();
  clearTimeout(CS.timers[id]);
  CS.timers[id] = setTimeout(async () => { await safeWrite(() => S.db.doc("characters/" + id).set(S.chars.get(id))); delete CS.timers[id]; }, 600);
}
function setPath(obj, path, val) { const ks = path.split("."); let o = obj; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = val; }
function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }

// ---- party list ----
function hpBar(c) {
  const max = Number(c.hp && c.hp.max) || 0, cur = Number(c.hp && c.hp.cur) || 0, temp = Number(c.hp && c.hp.temp) || 0;
  const pct = max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const tone = pct > 50 ? "ok" : pct > 25 ? "warn" : "bad";
  return `<div class="hpbar ${tone}" role="img" aria-label="${cur} of ${max} hit points${temp ? `, ${temp} temporary` : ""}"><i style="width:${pct}%"></i>${temp ? `<b style="width:${Math.min(100, (temp / (max || 1)) * 100)}%"></b>` : ""}</div>`;
}
// On the tabletop this character (or one of its summons) may be riding something: say so on the sheet.
function charRidingHtml(cid) {
  if (!S.vttTokens) return "";
  const out = [];
  for (const [, t] of S.vttTokens) if (t.mount && (t.ref === "c:" + cid || String(t.ref || "").startsWith("s:" + cid + ":"))) { const m = S.vttTokens.get(t.mount); if (m) out.push(String(t.ref).startsWith("s:") ? `${esc(t.name || "Summon")} is riding ${esc(m.name || "a mount")}` : `Riding: ${esc(m.name || "a mount")}`); }
  return out.length ? `<p class="small cride">🐎 ${[...new Set(out)].join(" · ")}</p>` : "";
}
function charSub(c) { const cl = String(c.classes || "").trim(), lv = c.level ? (cl && !/\d/.test(cl) ? cl + " " + c.level : cl || "Level " + c.level) : cl; return [c.race, lv, c.background].filter(Boolean).join(" · "); }
// "Fighter 8" in the class box becomes class "Fighter" and level 8. Multiclass lines ("Fighter 5 / Wizard 3") are left alone.
function splitClassLevel(c) {
  const t = String(c.classes || "").trim(), nums = t.match(/\d+/g) || [];
  if (nums.length !== 1) return null;
  const cls = t.replace(/\s*(?:level|lvl|lv\.?)?\s*\d+(?:st|nd|rd|th)?\s*(?:level)?\s*/i, " ").replace(/\s+/g, " ").trim();
  return { classes: cls, level: Number(c.level) || Number(nums[0]) };
}
function viewCharacters() {
  if (!S.loaded.chars && !S.offline) return loadingOr(false);
  const all = [...S.chars.entries()].sort((a, b) => byName(a[1].name, b[1].name));
  const shown = all.filter(([, c]) => !c.hidden), hiddenOnes = READONLY ? [] : all.filter(([, c]) => c.hidden);
  return `<section>
    <div class="libhead"><h1>Characters</h1><p class="muted">${all.length} character${all.length === 1 ? "" : "s"}</p>
      ${!READONLY || PLAYER ? `<div><button class="btn" data-act="newchar">+ New character</button></div>` : ""}</div>
    ${all.length ? [[shown, hiddenOnes.length ? "Players can see" : ""], [hiddenOnes, "Hidden from players"]].filter(g => g[0].length).map(([list, head]) => `${head ? `<h2 class="sect chsect">${head} <span>${list.length}</span></h2>` : ""}<div class="party">${list.map(([id, c]) => `<a class="pcard${c.hidden ? " hiddenpc" : ""}" href="#char-${esc(id)}">
        <div class="pctop">${c.image ? `<img src="${esc(c.image)}" alt="">` : `<span class="pcinit">${esc((c.name || "?")[0])}</span>`}<div><h2>${esc(c.name)}${c.hidden && !READONLY ? ` <span class="dmonly" title="Hidden from players">DM only</span>` : ""}</h2><p class="muted">${esc(charSub(c))}</p></div></div>
        <div class="pcstats"><span><b>AC</b>${esc(cAC(c))}</span><span><b>HP</b>${Number(c.hp && c.hp.cur) || 0}/${Number(c.hp && c.hp.max) || 0}${c.hp && c.hp.temp ? ` <small>+${c.hp.temp}</small>` : ""}</span><span><b>Init</b>${esc(cInit(c))}</span><span><b>Speed</b>${esc(c.speed || "—")}</span></div>
        ${hpBar(c)}
        ${(c.resources || []).length ? `<div class="pcres">${c.resources.filter(r => r && r.name).map(r => `<span title="${esc(r.name)}">${esc(r.name)} <b>${charResHave(c, r)}${resIsCounter(r) ? "" : "/" + resMax(r, c)}</b></span>`).join("")}</div>` : ""}
      </a>`).join("")}</div>`).join("") : `<div class="empty"><p>No characters yet.</p>${!READONLY || PLAYER ? `<button class="btn" data-act="newchar">Add the first character</button>` : ""}</div>`}
  </section>`;
}

// ---- the sheet ----
function cField(path, val, opts) {
  opts = opts || {};
  const id = "cf-" + path.replace(/\./g, "-");
  if (opts.area) return `<textarea id="${id}" class="cf${opts.rich ? " rich" : ""}" data-cf="${path}" rows="${opts.rows || 3}" placeholder="${esc(opts.ph || "")}">${esc(val == null ? "" : val)}</textarea>`;
  return `<input id="${id}" class="cf${opts.cls ? " " + opts.cls : ""}" data-cf="${path}"${opts.num ? ' data-num="1" inputmode="numeric"' : ""} type="text" value="${esc(val == null ? "" : val)}" placeholder="${esc(opts.ph || "")}"${opts.label ? ` aria-label="${esc(opts.label)}"` : ""}>`;
}
const canPlay = () => (!READONLY || PLAYER) && !!S.db;
function viewCharacter(id) {
  const c = S.chars.get(id);
  if (!c) return S.loaded.chars ? `<div class="empty">That character no longer exists. <a href="#characters">Back to characters</a></div>` : loadingOr(false);
  const E = CS.edit && canPlay(), P = canPlay();
  const pb = cPB(c), hp = c.hp || {}, hd = c.hd || {}, death = c.death || {};
  const sec = (tab, cls, title, body, extra) => `<section class="csec ${cls || ""}" data-tab="${tab}"><h2 class="csh">${title}${extra || ""}</h2>${body}</section>`;
  const val = (path, v, o) => (E ? cField(path, v, o) : `<span class="cv">${esc(v == null || v === "" ? "—" : v)}</span>`);

  const head = `<header class="chead">
      <div class="cportrait">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.name)}">` : `<span class="pcinit big">${esc((c.name || "?")[0])}</span>`}
        ${E && S.assets ? `<button class="btn ghost small" data-act="charimg" data-id="${esc(id)}">${c.image ? "Change" : "Add picture"}</button><button class="btn ghost small" data-act="chartok" data-id="${esc(id)}" title="The picture used on the tabletop">${c.token ? "Change token" : "Add token picture"}</button>${c.token ? `<img class="ctokprev" src="${esc(c.token)}" alt="Token">` : ""}` : ""}</div>
      <div class="cident">
        ${E ? `<div class="frow"><label class="grow"><span>Name</span>${cField("name", c.name)}</label><label><span>Player</span>${cField("player", c.player)}</label></div>
          <div class="frow"><label><span>Race</span>${cField("race", c.race)}</label><label class="grow"><span>Class</span>${cField("classes", c.classes, { ph: "Fighter" })}</label><label><span>Level</span>${cField("level", c.level, { num: 1 })}</label></div>
          <div class="frow"><label><span>Background</span>${cField("background", c.background)}</label><label><span>Alignment</span>${cField("alignment", c.alignment)}</label><label><span>XP</span>${cField("xp", c.xp)}</label></div>
          ${casterEditHtml(c)}`
        : `<h1>${esc(c.name)}</h1><p class="csub">${esc(charSub(c)) || "—"}${c.alignment ? ` · ${esc(c.alignment)}` : ""}</p>${c.player ? `<p class="muted small">Played by ${esc(c.player)}</p>` : ""}${charRidingHtml(id)}`}
      </div>
      <div class="cacts">${P ? `<button class="btn ghost" data-act="crest" data-v="short" data-id="${esc(id)}">Short rest</button><button class="btn ghost" data-act="crest" data-v="long" data-id="${esc(id)}">Long rest</button><button class="btn${E ? "" : " ghost"}" data-act="cedit">${E ? "Done editing" : "Edit sheet"}</button>` : ""}${!READONLY ? `<button class="btn ghost hidebtn${c.hidden ? " on" : ""}" data-act="togglecharhide" data-id="${esc(id)}" aria-pressed="${!!c.hidden}" title="${c.hidden ? "Players can't see this character" : "Players can see this character"}">${c.hidden ? "👁 Hidden from players" : "Hide from players"}</button>` : ""}</div>
    </header>`;

  const vit = (label, inner, sub) => `<div class="vit"><span class="vl">${label}</span><strong>${inner}</strong>${sub ? `<span class="vs">${sub}</span>` : ""}</div>`;
  const vitals = `<div class="vitals">
      ${vit("Armour Class", E ? cField("ac", c.ac, { cls: "mid", ph: String(acCalc(c).total) }) : esc(cAC(c)), E ? "blank = auto" : String(c.ac == null ? "" : c.ac).trim() ? "" : "auto")}
      ${vit("Initiative", E ? cField("initOverride", c.initOverride, { cls: "mid", ph: cInit(Object.assign({}, c, { initOverride: "" })) }) : esc(cInit(c)), E ? "blank = Dex" : "")}
      ${vit("Speed", E ? cField("speed", c.speed, { cls: "mid" }) : esc(c.speed || "—"))}
      ${vit("Proficiency", E ? cField("pbOverride", c.pbOverride, { cls: "mid", ph: signed(2 + Math.floor((Math.max(1, Number(c.level) || 1) - 1) / 4)) }) : signed(pb), E ? "blank = by level" : "")}
      ${vit("Passive Perception", 10 + cSkill(c, "perception"))}
      <button class="vit insp${c.inspiration ? " on" : ""}" data-act="cinsp" data-id="${esc(id)}"${P ? "" : " disabled"} aria-pressed="${!!c.inspiration}"><span class="vl">Inspiration</span><strong>${c.inspiration ? "★" : "☆"}</strong></button>
    </div>`;

  const hpBlock = `<div class="hpbox">
      <div class="hpnums"><div><span class="vl">Hit points</span><strong class="hpcur">${Number(hp.cur) || 0}<small> / ${E ? cField("hp.max", hp.max, { num: 1, cls: "mini", label: "Max HP" }) : Number(hp.max) || 0}</small></strong></div>
        <div><span class="vl">Temporary</span><strong>${Number(hp.temp) || 0}</strong></div></div>
      ${hpBar(c)}
      ${P ? `<div class="hpctl"><input id="hpamt" type="text" inputmode="numeric" placeholder="Amount" aria-label="Amount" value="${esc(CS.amt)}">
        <button class="btn danger" data-act="chp" data-v="dmg" data-id="${esc(id)}">Damage</button><button class="btn" data-act="chp" data-v="heal" data-id="${esc(id)}">Heal</button><button class="btn ghost" data-act="chp" data-v="temp" data-id="${esc(id)}">Temp HP</button></div>` : ""}
      <div class="hdrow"><div><span class="vl">Hit dice <small>${esc(hd.die || "")}</small></span>
          <div class="pips">${Array.from({ length: Number(hd.total) || 0 }, (_, k) => `<button class="pip${k < (Number(hd.total) || 0) - (Number(hd.used) || 0) ? " on" : ""}" data-act="chd" data-k="${k}" data-id="${esc(id)}"${P ? "" : " disabled"} aria-label="Hit die ${k + 1}"></button>`).join("")}</div>
          ${E ? `<div class="frow tight"><label><span>Die</span>${cField("hd.die", hd.die, { cls: "mini" })}</label><label><span>Total</span>${cField("hd.total", hd.total, { num: 1, cls: "mini" })}</label></div>` : ""}</div>
        <div><span class="vl">Death saves</span>
          <div class="ds"><span>Success</span>${[0, 1, 2].map(k => `<button class="dpip ok${k < (Number(death.s) || 0) ? " on" : ""}" data-act="cdeath" data-v="s" data-k="${k}" data-id="${esc(id)}"${P ? "" : " disabled"} aria-label="Success ${k + 1}"></button>`).join("")}</div>
          <div class="ds"><span>Failure</span>${[0, 1, 2].map(k => `<button class="dpip bad${k < (Number(death.f) || 0) ? " on" : ""}" data-act="cdeath" data-v="f" data-k="${k}" data-id="${esc(id)}"${P ? "" : " disabled"} aria-label="Failure ${k + 1}"></button>`).join("")}</div></div>
      </div>
    </div>`;

  const resBlock = sec("play", "cres", "Resources", resourcesSectionHtml(c, id, E, P));

  const atk = c.attacks || [], eq = equippedParts(c, id);
  const manualRows = atk.map(a => { const link = entryByFuzzyTitle(a.name); return `<tr><td>${link ? `<a href="#entry-${esc(link)}">${esc(a.name)}</a>` : esc(a.name)}${a.notes ? `<div class="muted small">${esc(a.notes)}</div>` : ""}</td><td class="num big">${esc(a.bonus || "—")}</td><td>${diceify(esc(a.damage || ""))} <span class="muted">${esc(a.type || "")}</span></td><td></td></tr>`; });
  const xa = attacksPerAction(c);
  const xaBanner = xa.n > 1 ? `<div class="xattack" role="note"><span class="xan" aria-hidden="true">×${xa.n}</span><div><strong>${esc(xa.label)}</strong><span class="muted small">Attack ${xa.n === 2 ? "twice" : xa.n + " times"}, instead of once, whenever you take the Attack action on your turn.</span></div></div>` : "";
  const atkBlock = sec("play", "catk", "Equipped", `${eq.ac}${E ? "" : xaBanner}${E ? "" : eq.rows.length || manualRows.length ? `<table class="atktab"><thead><tr><th>Attack</th><th class="num">To hit</th><th>Damage</th><th></th></tr></thead><tbody>${eq.rows.join("")}${manualRows.join("")}</tbody></table>` : `<p class="muted small">Nothing equipped. Equip weapons from the Inventory to see their attacks here.</p>`}
      ${eq.chips}${E ? "" : eq.picker}
      ${E ? `<h3 class="fgh">Custom attacks</h3><p class="muted small">For attacks that aren't an item, like unarmed strikes or a shield bash. Equipped weapons are worked out for you.</p>` : ""}<div class="atklist">${E ? atk.map((a, k) => `<div class="frow tight atkedit">
        <label class="grow"><span>Name</span>${cField(`attacks.${k}.name`, a.name)}</label><label><span>To hit</span>${cField(`attacks.${k}.bonus`, a.bonus, { cls: "mini" })}</label>
        <label><span>Damage</span>${cField(`attacks.${k}.damage`, a.damage, { cls: "mid" })}</label><label><span>Type</span>${cField(`attacks.${k}.type`, a.type, { cls: "mid" })}</label>
        <label class="grow"><span>Notes</span>${cField(`attacks.${k}.notes`, a.notes)}</label><button class="iconbtn" data-act="clistdel" data-v="attacks" data-k="${k}" aria-label="Remove ${esc(a.name)}">✕</button></div>`).join("")
      : ""}</div>
      ${E ? `<button class="btn ghost small" data-act="clistadd" data-v="attacks">+ Add custom attack</button>` : ""}
      ${E ? `<div class="field"><span class="flabel">Combat notes</span>${cField("combatNotes", c.combatNotes, { area: 1, rich: 1, rows: 4 })}</div>` : c.combatNotes ? `<div class="prose cnotes">${md(c.combatNotes, { base: 3 })}</div>` : ""}${eq.potions}`);

  const abil = sec("stats", "cabil", "Abilities", `<div class="abilgrid">${ABILS.map(([a, label]) => `<div class="abox">
        <span class="al">${label}</span><strong>${signed(cMod(c, a))}</strong>
        ${E ? cField("abilities." + a, (c.abilities || {})[a], { num: 1, cls: "score", label: label + " score" }) : `<span class="score">${cScore(c, a)}</span>`}${asiDeltas(c)[a] ? `<span class="vs">${E ? `base, +${asiDeltas(c)[a]} from level-ups = ${cScore(c, a)}` : `+${asiDeltas(c)[a]} from level-ups`}</span>` : ""}
        <button class="save${(c.saves || {})[a] ? " on" : ""}" data-act="csave" data-v="${a}" data-id="${esc(id)}"${E ? "" : " disabled"} aria-pressed="${!!(c.saves || {})[a]}" title="${E ? "Tap to toggle saving throw proficiency" : ""}"><i></i>Save ${signed(cSave(c, a))}</button>
      </div>`).join("")}</div>`);
  const skills = sec("stats", "cskills", "Skills", `<ul class="skilllist">${SKILLS.map(([k, label, ab]) => { const lv = Number((c.skills || {})[k]) || 0; return `<li class="lv${lv}">
      <button class="prof" data-act="cskill" data-v="${k}" data-id="${esc(id)}"${E ? "" : " disabled"} aria-label="${label}: ${["not proficient", "proficient", "expertise"][lv]}" title="${E ? "Tap: none → proficient → expertise" : ["", "Proficient", "Expertise"][lv]}"></button>
      <span class="sk">${label} <small>${ab.toUpperCase()}</small></span><strong>${signed(cSkill(c, k))}</strong></li>`; }).join("")}</ul>
      ${E ? `<p class="muted small">Tap the circles to cycle: none, proficient, expertise.</p>` : ""}`);

  const groups = FEATURE_SOURCES.map(src => ({ src, items: (c.features || []).map((f, k) => [f, k]).filter(([f]) => (f.source || "Other") === src) })).filter(g => g.items.length);
  groups.forEach(g => { if (g.src === "Class") g.items = classFeatOrder(c, g.items); });
  const feats = sec("features", "cfeat", "Features &amp; traits", levelupHtml(c, id, E, P) + (E ? `${classBasicsHtml(c)}${srdFillHtml(c)}<div class="featedit">${(c.features || []).map((f, k) => `<div class="sbitem">
        <div class="frow tight"><label class="grow"><span>Name</span>${cField(`features.${k}.name`, f.name)}</label>
          <label><span>From</span><select class="cf" data-cf="features.${k}.source">${FEATURE_SOURCES.map(s => `<option${(f.source || "Other") === s ? " selected" : ""}>${s}</option>`).join("")}</select></label>
          <label class="grow"><span>Short note</span>${cField(`features.${k}.note`, f.note, { ph: "e.g. 60 ft, 1 per short rest" })}</label><button class="iconbtn" data-act="clistdel" data-v="features" data-k="${k}" aria-label="Remove ${esc(f.name)}">✕</button></div>
        ${cField(`features.${k}.desc`, f.desc, { area: 1, rich: 1, rows: 2, ph: "What it does (optional)" })}</div>`).join("")}</div>
      <button class="btn ghost small" data-act="clistadd" data-v="features">+ Add feature</button>`
    : groups.length ? groups.map(g => `<h3 class="fgh">${g.src === "DM" ? "From the DM" : g.src === "Item" ? "From items" : g.src}</h3><div class="flist">${g.items.map(([f, , lv]) => f.desc ? `<details class="fitem"><summary>${lv ? `<span class="flv" title="Level ${lv}">${lv}</span>` : ""}<strong>${esc(f.name)}</strong>${f.note ? ` <span class="muted">${esc(f.note)}</span>` : ""}</summary><div class="prose">${md(f.desc, { base: 3 })}</div></details>`
      : `<div class="fitem plain">${lv ? `<span class="flv" title="Level ${lv}">${lv}</span>` : ""}<strong>${esc(f.name)}</strong>${f.note ? ` <span class="muted">${esc(f.note)}</span>` : ""}</div>`).join("")}</div>`).join("") : `<p class="muted small">No features yet.</p>`));

  const pr = c.profs || {};
  const profs = sec("features", "cprof", "Proficiencies &amp; languages", profSectionHtml(c, E));


  const nt = c.notes || {}, ap = c.appearance || {};
  const noteBox = (k, label) => E ? `<div class="field"><span class="flabel">${label}</span>${cField("notes." + k, nt[k], { area: 1, rich: 1, rows: k === "backstory" ? 6 : 2 })}</div>` : nt[k] ? `<div class="nbox"><h3>${label}</h3><div class="prose">${md(nt[k], { base: 3 })}</div></div>` : "";
  const story = sec("story", "cstory", "Character", `<dl class="looks">${[["age", "Age"], ["height", "Height"], ["weight", "Weight"], ["eyes", "Eyes"], ["skin", "Skin"], ["hair", "Hair"]].map(([k, l]) => `<div><dt>${l}</dt><dd>${val("appearance." + k, ap[k])}</dd></div>`).join("")}</dl>
      <div class="notesgrid">${noteBox("personality", "Personality traits")}${noteBox("ideals", "Ideals")}${noteBox("bonds", "Bonds")}${noteBox("flaws", "Flaws")}</div>
      ${noteBox("allies", "Allies &amp; organisations")}${noteBox("backstory", "Backstory")}
      ${!E && !["personality", "ideals", "bonds", "flaws", "allies", "backstory"].some(k => nt[k]) ? `<p class="muted small">No story written yet.</p>` : ""}`);

  return `<article class="sheet${E ? " editing" : ""}" data-tab="${CS.tab}" data-id="${esc(id)}">
    <div class="crumbs"><a href="#characters">← Characters</a></div>
    ${head}
    <div class="cview seg kindseg" role="group" aria-label="Sheet, inventory or summons">${[["sheet", "Sheet"], ["inv", "Inventory"], ["sum", "Summons"]].map(([k, l]) => `<button class="${CS.view === k ? "on" : ""}" data-act="cview" data-v="${k}" aria-pressed="${CS.view === k}">${l}${k === "inv" ? ` <span>${Object.keys(invOf(c).slots).length}</span>` : k === "sum" && smList(c).length ? ` <span>${smList(c).length}</span>` : ""}</button>`).join("")}</div>
    ${CS.view === "inv" ? invViewHtml(c, id) : CS.view === "sum" ? summonsViewHtml(c, id) : `<nav class="ctabs" aria-label="Sheet sections">${[...CHAR_TABS, ...(casterOf(c) ? [["spells", "Spells"]] : [])].map(([k, l]) => `<button class="${CS.tab === k ? "on" : ""}" data-act="ctab" data-v="${k}" aria-pressed="${CS.tab === k}">${l}</button>`).join("")}</nav>
    <div class="cgrid">
      <div class="ccol">
        <section class="csec cvital" data-tab="play">${vitals}${hpBlock}</section>
        ${abil}${skills}${profs}${story}
      </div>
      <div class="ccol">
        ${atkBlock}${combatSpellsHtml(c, id)}${resBlock}${feats}
      </div>
    </div>
    ${spellsSectionHtml(c, id, E, P)}`}
    ${E ? `<p class="dangerzone"><button class="btn danger small" data-act="cdel" data-id="${esc(id)}">Delete character</button></p>` : ""}
  </article>`;
}
// Item names on a sheet link to the codex entry when one matches (close spellings count).
function lev(a, b) { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
function entryByFuzzyTitle(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, ""); if (n.length < 4) return null;
  let best = null, bd = 9;
  for (const [id, e] of S.entries) { if (e.type !== "item") continue; const t = String(e.title || "").toLowerCase().replace(/[^a-z0-9]/g, ""); const d = t === n ? 0 : n.length >= 6 ? lev(t, n) : 9; if (d < bd) { bd = d; best = id; } }
  return bd <= 2 ? best : null;
}
function linkItems(html) {
  return html.split(/(<[^>]+>)/).map(seg => seg.startsWith("<") ? seg : seg.replace(/[A-Za-z][A-Za-z' -]{3,40}/g, m => {
    const id = entryByFuzzyTitle(m.trim()); return id && m.trim().length >= 6 ? m.replace(m.trim(), `<a href="#entry-${esc(id)}">${m.trim()}</a>`) : m;
  })).join("");
}

// ---- actions ----
async function charAction(a, el, ev) {
  const id = el.dataset.id || (document.querySelector(".sheet") || {}).dataset && document.querySelector(".sheet").dataset.id;
  const c = S.chars.get(id);
  if (a === "newchar") { qcDialog(); return true; }
  if (resAction(a, el, ev, id)) return true;
  if (/^sm(add|rm|refresh|hp|toggle|slot|give|giveback|drop|use|new|edit|save|abil|abilsave|abiledit|abildel|ires|iresbar|irespip|tok)$/.test(a)) { summonAction(a, el, id, c); return true; }
  if (a === "cview") { CS.view = el.dataset.v; INV.sel = null; INV.pick = null; render(); return true; }
  if (a === "cedit") { CS.fill = null; CS.edit = !CS.edit; render(); return true; }
  if (a === "ctab") { CS.tab = el.dataset.v; const sh = document.querySelector(".sheet"); if (sh) { sh.dataset.tab = CS.tab; document.querySelectorAll(".ctabs button").forEach(b => { b.classList.toggle("on", b.dataset.v === CS.tab); b.setAttribute("aria-pressed", b.dataset.v === CS.tab); }); } return true; }
  if (!c) return false;
  if (a === "chp") {
    const amt = Math.abs(parseInt(($("#hpamt") || {}).value, 10));
    if (!amt) { toast("Type an amount first.", "bad"); const i = $("#hpamt"); if (i) i.focus(); return true; }
    CS.amt = "";
    charChange(id, x => {
      const h = x.hp = x.hp || { max: 0, cur: 0, temp: 0 };
      if (el.dataset.v === "dmg") { const fromTemp = Math.min(Number(h.temp) || 0, amt); h.temp = (Number(h.temp) || 0) - fromTemp; h.cur = Math.max(0, (Number(h.cur) || 0) - (amt - fromTemp)); }
      else if (el.dataset.v === "heal") { h.cur = Math.min(Number(h.max) || 0, (Number(h.cur) || 0) + amt); if (h.cur > 0) x.death = { s: 0, f: 0 }; }
      else h.temp = Math.max(Number(h.temp) || 0, amt);
    });
    return true;
  }
  if (a === "cuneq") { const k = el.dataset.v; const g = invFreeGrid(c); if (g == null) { toast("The inventory grid is full.", "bad"); return true; } charChange(id, x => invMove(x, k, g)); return true; }
  if (a === "cdrink") { let msg = ""; charChange(id, x => { msg = useConsumable(x, el.dataset.v); }); if (msg) toast(msg); return true; }
  if (/^sp(adj|cast|add)$/.test(a)) return spellAction(a, el, id, c);
  if (a === "srdfill") { srdFillApply(id, c); return true; }
  if (a === "clsapply") { classBasicsApply(id, c, el.dataset.v); return true; }
  if (a === "cuseac") { charChange(id, x => { x.ac = el.dataset.v; }); toast(el.dataset.v ? "AC updated" : "AC now follows what's worn"); return true; }
  if (a === "cinsp") { charChange(id, x => { x.inspiration = !x.inspiration; }); return true; }
  if (a === "cdeath") { const k = Number(el.dataset.k), key = el.dataset.v; charChange(id, x => { x.death = x.death || { s: 0, f: 0 }; x.death[key] = (Number(x.death[key]) || 0) === k + 1 ? k : k + 1; }); return true; }
  if (a === "chd") { const k = Number(el.dataset.k); charChange(id, x => { const t = Number(x.hd.total) || 0, avail = t - (Number(x.hd.used) || 0); x.hd.used = k < avail ? t - k : t - k - 1; }); return true; }
  if (a === "csave") { const ab = el.dataset.v; charChange(id, x => { x.saves = x.saves || {}; x.saves[ab] = !x.saves[ab]; }); return true; }
  if (a === "cskill") { const k = el.dataset.v; charChange(id, x => { x.skills = x.skills || {}; x.skills[k] = ((Number(x.skills[k]) || 0) + 1) % 3; if (!x.skills[k]) delete x.skills[k]; }); return true; }
  if (a === "crest") {
    const long = el.dataset.v === "long";
    if (!(await confirmBox(long ? `Long rest for ${c.name}? Hit points go back to full, every resource and rechargeable item refills (item resource lines follow their own rest rule)${casterOf(c) ? ", spell points refill" : ""}, and half their hit dice come back.` : `Short rest for ${c.name}? Resources and items that recharge on a short rest refill. Spend hit dice by tapping them.`, long ? "Take a long rest" : "Take a short rest"))) return true;
    charChange(id, x => {
      charResRest(x, long);
      rechargeItems(x, long); itemResRest(x, long);
      if (Array.isArray(x.summons)) x.summons = x.summons.map(sm => smRest(JSON.parse(JSON.stringify(sm)), long));
      if (long && x.caster) { x.caster.used = 0; x.caster.high = {}; }
      if (long) { x.hp.cur = Number(x.hp.max) || 0; x.hp.temp = 0; x.death = { s: 0, f: 0 }; const t = Number(x.hd.total) || 0; x.hd.used = Math.max(0, (Number(x.hd.used) || 0) - Math.max(1, Math.floor(t / 2))); }
    });
    toast(long ? "Long rest taken" : "Short rest taken");
    return true;
  }
  if (a === "clistadd") {
    const list = el.dataset.v;
    charChange(id, x => { x[list] = x[list] || []; x[list].push(list === "spells" ? { name: "", level: 0, notes: "", desc: "" } : list === "attacks" ? { name: "", bonus: "", damage: "", type: "", notes: "" } : list === "resources" ? { name: "", max: 1, used: 0, reset: "long", note: "" } : { name: "", source: "Class", note: "", desc: "" }); });
    setTimeout(() => { const all = document.querySelectorAll(`[data-cf^="${list}."][data-cf$=".name"]`); if (all.length) all[all.length - 1].focus(); }, 30);
    return true;
  }
  if (a === "clistdel") { if (!confirmInline(el)) return true; const list = el.dataset.v, k = Number(el.dataset.k); charChange(id, x => { x[list].splice(k, 1); }); return true; }
  if (a === "charimg") { pickImage(async res => { charChange(id, x => { x.image = assetPath(res); }); }); return true; }
  if (a === "chartok") { pickImage(async res => { charChange(id, x => { x.token = assetPath(res); }); }); return true; }
  if (a === "cdel") {
    if (await confirmBox(`Delete ${c.name}'s sheet? This can't be undone.`, "Delete character")) {
      clearTimeout(CS.timers[id]);
      if (await safeWrite(() => S.db.doc("characters/" + id).delete(), "Character deleted")) { S.chars.delete(id); CS.edit = false; location.hash = "characters"; }
    }
    return true;
  }
  return false;
}
// Typing in sheet fields: store as you go without redrawing (keeps the cursor where it is).
function charInput(t) {
  const sh = t.closest(".sheet"); if (!sh || !t.dataset.cf) return false;
  const id = sh.dataset.id, path = t.dataset.cf;
  let v = t.type === "checkbox" ? t.checked : t.value; if (t.dataset.num && typeof v === "string") v = v.trim() === "" ? 0 : (parseInt(v, 10) || 0);
  if (t.type === "checkbox" || (t.tagName === "SELECT" && /^(caster\.|resources\.\d+\.(style|amt|reset))/.test(path))) { charChange(id, x => setPath(x, path, v)); return true; }
  const live = /^(abilities|level|pbOverride|initOverride|hp\.max|hd\.total|resources\.\d+\.max|name|caster\.)/.test(path);
  charChange(id, x => setPath(x, path, v), false);
  if (live && t.tagName !== "TEXTAREA") { clearTimeout(CS.redraw); CS.redraw = setTimeout(() => { const f = document.activeElement && document.activeElement.id; render(); const n = f && document.getElementById(f); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) {} } }, 700); }
  return true;
}

// Class features in the order they're gained. The level comes from the feature itself (asi, lv, "level 3" in its note),
// else from the class and subclass lists by name. Anything still unknown (a maneuver, an invocation) stays right
// after the feature it was listed under. Ability Score Improvements take the class's ASI levels in turn.
function classFeatOrder(c, items) {
  const known = new Map(), asiLv = [];
  try {
    const cls = typeof detectSrdClass === "function" ? detectSrdClass(c) : "", d = cls && classFeats(cls);
    (d && d.f || []).forEach(f => { if (/^Ability Score Improvement/i.test(f.n)) { asiLv.push(Number(f.lv)); return; } const k = featKey(f.n); if (!known.has(k) || f.lv < known.get(k)) known.set(k, Number(f.lv)); });
    if (d && Array.isArray(d.asi)) d.asi.forEach(l => { if (!asiLv.includes(Number(l))) asiLv.push(Number(l)); });
    const hb = charSubclassEntry(c);
    if (hb) subclassFeatures(hb[1], 20).forEach(f => { const k = featKey(f.n); if (!known.has(k)) known.set(k, Number(f.lv) || 1); });
    // Not sure which subclass? Any subclass of this class from the library or the PHB list can name the level.
    const lc = String(cls || "").toLowerCase(), soft = (n, lv) => { const k = featKey(n); if (!known.has(k)) known.set(k, Number(lv) || 1); };
    if (cls) { homebrewSubclasses(cls).forEach(([, e]) => subclassFeatures(e, 20).forEach(f => soft(f.n, f.lv)));
      (typeof PHB_SUBCLASSES !== "undefined" ? PHB_SUBCLASSES : []).filter(r => String(r[0]).toLowerCase() === lc).forEach(r => (r[2] || []).forEach(f => soft(f[1], f[0]))); }
  } catch (e) {}
  asiLv.sort((a, b) => a - b);
  const lookup = name => { const k = featKey(name); if (known.has(k)) return known.get(k);
    const base = featKey(String(name).split(":")[0]); if (known.has(base)) return known.get(base);
    for (const [kk, l] of known) if (kk.length > 4 && (k.startsWith(kk) || kk.startsWith(k))) return l; return 0; };
  let prev = 0, asiN = 0;
  const withLv = items.map(([f, k], i) => {
    let lv = Number(f.asi) || Number(f.lv) || 0;
    if (!lv) { const m = String(f.note || "").match(/\blevel (\d+)/i); if (m) lv = Number(m[1]); }
    if (!lv && /^Ability Score Improvement/i.test(f.name)) lv = asiLv[asiN] || 0;
    if (/^Ability Score Improvement/i.test(f.name)) asiN++;
    if (!lv) lv = lookup(f.name);
    const shown = lv; if (!lv) lv = prev; else prev = lv;
    return [f, k, shown, lv, i];
  });
  return withLv.sort((a, b) => a[3] - b[3] || a[4] - b[4]).map(([f, k, shown]) => [f, k, shown]);
}
// Typed "Wizard 3" into the class box: when you leave the box, the 3 moves to Level.
document.addEventListener("change", ev => {
  const t = ev.target; if (!t.dataset || t.dataset.cf !== "classes") return;
  const sh = t.closest(".sheet"), c = sh && S.chars.get(sh.dataset.id); if (!c) return;
  const r = splitClassLevel(Object.assign({}, c, { classes: t.value, level: 0 })); if (!r) return;
  const id = sh.dataset.id; setTimeout(() => charChange(id, x => { x.classes = r.classes; x.level = r.level; }));
});

// How many attacks the Attack action gives: from an "Extra Attack" style feature, plus the Fighter's 11th and 20th levels.
function attacksPerAction(c) {
  let n = 1, label = "";
  (c.features || []).forEach(f => {
    const t = String(f.name || "");
    let m, k = 0;
    if ((m = t.match(/extra attacks?\s*\((\d)\)/i))) k = 1 + Number(m[1]);
    else if (/three extra attacks/i.test(t)) k = 4; else if (/two extra attacks/i.test(t)) k = 3;
    else if (/\bextra attack\b/i.test(t)) k = 2;
    if (k > n) { n = k; label = t; }
  });
  if (/fighter/i.test(String(c.classes || "")) && n > 1) { const lv = Number(c.level) || 1; const f = lv >= 20 ? 4 : lv >= 11 ? 3 : 2; if (f > n) { n = f; label = "Extra Attack (" + (f - 1) + ")"; } }
  return { n, label: label || "Extra Attack" };
}
