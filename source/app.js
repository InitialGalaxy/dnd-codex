// ---------- DnD Codex ----------
const TYPES = [
  { id: "creature", label: "Creature", plural: "Creatures", subject: true },
  { id: "biology", hideNew: true, label: "Biology", plural: "Biology" },
  { id: "location", hideNew: true, label: "Location", plural: "Locations", subject: true },
  { id: "faction", hideNew: true, label: "Faction", plural: "Factions", subject: true },
  { id: "magic", hideNew: true, label: "Magic", plural: "Magic" },
  { id: "history", hideNew: true, label: "History", plural: "History" },
  { id: "general", hideNew: true, label: "General", plural: "General lore" },
  { id: "item", label: "Item", plural: "Items", subject: true },
  { id: "handout", label: "Handout", plural: "Handouts", subject: true },
  { id: "spell", label: "Spell", plural: "Spells", subject: true },
  { id: "subclass", label: "Subclass", plural: "Subclasses", subject: true },
  { id: "race", label: "Race", plural: "Races", subject: true },
  { id: "class", label: "Class", plural: "Classes", subject: true },
  { id: "feat", label: "Feat", plural: "Feats", subject: true },
  { id: "partset", label: "Part set", plural: "Part sets", subject: true }
];
const BOOK_STATUS = ["Complete", "In progress", "Planned"];
const ITEM_CATEGORIES = ["Simple weapon", "Martial weapon", "Ranged weapon", "Armour", "Shield", "Ring", "Amulet", "Cloak", "Wand", "Staff", "Rod", "Potion", "Scroll", "Trinket", "Harvested part", "Adventuring gear", "Ammunition", "Equipment pack", "Kit", "Spellcasting focus", "Tool", "Saddle"];
const isSaddleCat = c => /^saddle$/i.test(String(c || "").trim());
// Standard weapon properties (no 5.5e masteries). "param" asks for a value, shown in brackets.
const WEAPON_PROPS = [
  { id: "ammunition", name: "Ammunition", param: "range", ph: "80/320; arrow", desc: "You can make a ranged attack with this weapon only if you have ammunition to fire from it. Each attack uses one piece of ammunition. After a fight, you can spend 1 minute to recover half the ammunition (round down) you used." },
  { id: "finesse", name: "Finesse", desc: "When you attack with this weapon, use your choice of your Strength or Dexterity modifier for the attack and damage rolls. You must use the same modifier for both rolls." },
  { id: "heavy", name: "Heavy", desc: "You have disadvantage on attack rolls with a Heavy weapon if it's a Melee weapon and your Strength score isn't at least 13, or if it's a Ranged weapon and your Dexterity score isn't at least 13." },
  { id: "light", name: "Light", desc: "When you take the Attack action and attack with a Light weapon, you can make one extra attack as a bonus action later on the same turn. That extra attack must be made with a different Light weapon, and you don't add your ability modifier to its damage unless the modifier is negative." },
  { id: "loading", name: "Loading", desc: "You can fire only one piece of ammunition from this weapon when you use an action, bonus action or reaction to fire it, regardless of the number of attacks you can normally make." },
  { id: "range", name: "Range", param: "range", ph: "80/320", desc: "This weapon has a normal range and a long range, in feet. Attacks beyond the normal range are made with disadvantage, and you can't attack a target beyond the long range." },
  { id: "reach", name: "Reach", desc: "This weapon adds 5 feet to your reach when you attack with it, and when working out your reach for opportunity attacks with it." },
  { id: "thrown", name: "Thrown", param: "range", ph: "20/60", desc: "You can throw this weapon to make a ranged attack, and you can draw it as part of the attack. Use the same ability modifier for the attack and damage rolls that you would for a melee attack with it." },
  { id: "two-handed", name: "Two-Handed", desc: "This weapon requires two hands when you attack with it." },
  { id: "versatile", name: "Versatile", param: "damage", ph: "1d10", desc: "This weapon can be used with one or two hands. The damage in brackets is used when you attack with two hands." }
];
const PROP = Object.fromEntries(WEAPON_PROPS.map(p => [p.id, p]));
// Weapons, armour, or everything else ("items").
const ITEM_KINDS = [["weapon", "Weapons"], ["armour", "Armour"], ["item", "Items"]];
const isMagical = e => !(e.item && e.item.magical === false);
const DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "force", "psychic"];
function kindOfCategory(cat) { const c = String(cat || "").toLowerCase(); return /\bweapon\b/.test(c) ? "weapon" : /\barmou?r\b|\bshield\b/.test(c) ? "armour" : "item"; }
function acText(st, isShield) {
  if (!st || !String(st.ac || "").trim()) return "";
  const base = String(st.ac).trim();
  if (isShield) return (/^[+-]/.test(base) ? base : "+" + base);
  return base + (st.dex ? (String(st.dexMax || "").trim() ? ` + Dex (max ${String(st.dexMax).trim()})` : " + Dex") : "");
}
function costText(st) { const c = String((st && st.cost) || "").trim(); return c ? (/[a-z]/i.test(c) ? c : c + " gp") : ""; }
// All damage parts of an item: the main one plus any extra types ("1d8 force + 1d8 lightning").
function damageParts(st) { if (!st) return []; return [{ damage: st.damage, dtype: st.dtype }, ...(Array.isArray(st.more) ? st.more : [])].filter(p => String(p.damage || "").trim()).map(p => ({ damage: String(p.damage).trim(), dtype: String(p.dtype || "").trim() })); }
// Consumable/limited use: item.use = { type: "single" | "reusable", uses, recharge: "none" | "short" | "long" | "dawn" }.
// Potions and scrolls with nothing set count as single use.
const RECHARGE = { none: "Doesn't recharge (destroyed when used up)", short: "Short rest", long: "Long rest", dawn: "Dawn" };
function useInfo(it) {
  it = it || {};
  const u = it.use;
  if (u && u.type === "reusable") return { type: "reusable", uses: Math.max(1, Number(u.uses) || 1), recharge: u.recharge || "none" };
  if (u && u.type === "single") return { type: "single", uses: 1, recharge: "none" };
  if (u && u.type === "none") return null;
  return /potion|scroll/i.test(it.category || "") ? { type: "single", uses: 1, recharge: "none" } : null;
}
function useText(u) {
  if (!u) return "";
  if (u.type === "single") return "Single use";
  return `${u.uses} use${u.uses === 1 ? "" : "s"} · ${u.recharge === "none" ? "destroyed when used up" : u.recharge === "dawn" ? "recharges at dawn" : `recharges on a ${u.recharge} rest`}`;
}
function damageText(st) { return damageParts(st).map(p => p.damage + (p.dtype ? " " + p.dtype : "")).join(" + "); }
// Short stat summary for cards: "1d8 slashing" or "AC 15 + Dex (max 2)".
function itemStatShort(e) {
  const it = e.item || {}, st = it.stats; if (!st) return "";
  const k = kindOfCategory(it.category);
  if (k === "armour") { const a = acText(st, /shield/i.test(it.category || "")); return a ? "AC " + a : ""; }
  return damageText(st);
}
function itemKind(e) {
  const it = e.item || {};
  const cat = String(it.category != null ? it.category : (it.meta || "")).toLowerCase();
  if (/\bweapon\b/.test(cat)) return "weapon";
  if (/\barmou?r\b|\bshield\b/.test(cat)) return "armour";
  if (it.category == null && (e.tags || []).includes("weapon")) return "weapon";
  if (it.category == null && (e.tags || []).includes("armour")) return "armour";
  return "item";
}
function propLabel(p) {
  const d = PROP[p.id]; if (!d) return p.id;
  const v = String(p.param || "").trim().replace(/^range\s*/i, "");
  if (!v) return d.name.toLowerCase();
  // "thrown (range 20/60)", but the Range property itself is just "range (80/320)".
  return d.param === "range" && d.id !== "range" ? `${d.name.toLowerCase()} (range ${v})` : `${d.name.toLowerCase()} (${v})`;
}
function buildItemLine(it) {
  const inner = [String(it.base || "").trim(), ...(it.props || []).map(propLabel)].filter(Boolean).join(", ");
  const cat = String(it.category || "").trim();
  let line = cat + (inner ? ` (${inner})` : "");
  if (String(it.extra || "").trim()) line += (line ? ", " : "") + it.extra.trim();
  if (it.attune) line += " (requires attunement)";
  return line.trim();
}
// Read an old free-text item line ("Martial weapon (spear, heavy, reach, two-handed), [rarity]") into the new fields.
function parseItemLine(meta) {
  let rest = String(meta || "").trim();
  const attune = /requires attunement/i.test(rest);
  rest = rest.replace(/\(?\s*requires attunement\s*\)?/i, "").replace(/\[rarity\]/ig, "").replace(/,?\s*\b(very rare|uncommon|common|rare|legendary|artifact|unique|divine)\b(?=\s*(,|$))/ig, "");
  let category = rest, inner = "", extra = "";
  const open = rest.indexOf("(");
  if (open >= 0) {
    let depth = 0, close = -1;
    for (let k = open; k < rest.length; k++) { if (rest[k] === "(") depth++; if (rest[k] === ")") { depth--; if (!depth) { close = k; break; } } }
    category = rest.slice(0, open); inner = rest.slice(open + 1, close < 0 ? undefined : close); extra = close < 0 ? "" : rest.slice(close + 1);
  }
  category = category.replace(/[,\s]+$/, "").trim(); extra = extra.replace(/^[,\s]+|[,\s]+$/g, "").trim();
  const parts = []; let depth = 0, cur = "";
  for (const ch of inner) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { parts.push(cur); cur = ""; } else cur += ch; }
  if (cur.trim()) parts.push(cur);
  const props = [], base = [];
  parts.map(x => x.trim()).filter(Boolean).forEach(x => {
    const name = x.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase().replace(/\s+/g, "-");
    const param = (x.match(/\((.*)\)\s*$/) || [])[1] || "";
    if (PROP[name]) props.push({ id: name, param: param.replace(/^range\s+/i, "") }); else base.push(x);
  });
  return { category, base: base.join(", "), props, attune, extra };
}

const RARITIES = ["", "common", "uncommon", "rare", "very rare", "legendary", "artifact", "unique", "divine"];
const TYPE = Object.fromEntries(TYPES.map(t => [t.id, t]));
const GROUP_ORDER = ["capital", "city", "town", "fort", "monastery", "caravanserai", "trading_post", "village", "hamlet"];

const S = {
  db: null, entries: new Map(), tags: new Map(), meta: null, chunks: new Map(), towns: [], townById: new Map(),
  loaded: { entries: false, tags: false, meta: false, books: false, chars: false }, offline: false, slow: false,
  filter: { types: new Set(), tags: new Set(), q: "", mode: "and" }, assets: null, downloads: null,
  books: new Map(), chars: new Map(), encs: new Map(), imports: null, seed: null, importing: false,
  world: { q: "", state: "", prov: "", culture: "", good: "", group: "", sort: "pop", dir: -1, limit: 120, showMarkers: true },
  items: { holder: "", rarity: "", kind: "", magic: "", q: "" },
  beast: { sel: null, sort: "name", sbOnly: 0, mat: 0, lore: 0, book: "", tagsOpen: false, openGroups: new Set(), tagQ: "" },
  landImg: null, landKey: null
};

// ---------- helpers ----------
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const unesc = s => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const slugify = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const pretty = slug => slug.split("-").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
const newId = () => "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = n => Number(n || 0).toLocaleString();
const byName = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" });

function toast(msg, kind) {
  const t = document.createElement("div");
  t.className = "toast" + (kind ? " " + kind : "");
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), kind === "bad" ? 7000 : 3500);
}

// ---------- tags ----------
function tagName(slug) { const t = S.tags.get(slug); return (t && t.name) || pretty(slug); }
function tagParent(slug) { const t = S.tags.get(slug); return t && t.parent && t.parent !== slug ? t.parent : null; }
function ancestors(slug) {
  const out = [], seen = new Set([slug]);
  let p = tagParent(slug);
  while (p && !seen.has(p)) { out.push(p); seen.add(p); p = tagParent(p); }
  return out;
}
function allTagSlugs() {
  const set = new Set(S.tags.keys());
  S.entries.forEach(e => (e.tags || []).forEach(t => set.add(t)));
  return [...set].sort((a, b) => byName(tagName(a), tagName(b)));
}
function children(slug) { return allTagSlugs().filter(s => tagParent(s) === slug); }
function descendants(slug) { return allTagSlugs().filter(s => ancestors(s).includes(slug)); }
function entryHasTagDeep(e, slug) { return (e.tags || []).some(t => t === slug || ancestors(t).includes(slug)); }
function tagCount(slug) { let n = 0; S.entries.forEach(e => { if (entryHasTagDeep(e, slug)) n++; }); return n; }
function tagChip(slug, extra) {
  const known = S.tags.has(slug);
  return `<a class="tag${known ? "" : " loose"}" href="#tag-${esc(slug)}"${extra || ""}>${esc(tagName(slug))}</a>`;
}

// ---------- map lookups ----------
const stateOf = i => S.meta && S.meta.states.find(s => s.i === i);
const provOf = i => S.meta && S.meta.provinces.find(p => p.i === i);
const cultureOf = i => S.meta && S.meta.cultures.find(c => c.i === i);
const religionOf = i => S.meta && S.meta.religions.find(r => r.i === i);
const goodName = i => { const g = S.meta && S.meta.goods.find(x => x.i === i); return g ? g.n : "Good " + i; };
function townBySlug(slug) { return S.towns.find(t => slugify(t.n) === slug); }

// ---------- markdown-ish renderer ----------
function inline(s) {
  return s
    .replace(/\\([\\`*_{}\[\]()#+\-.!|~=])/g, (m, c) => "&#" + c.charCodeAt(0) + ";")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, target, label) => wikiLink(unesc(target.trim()), label ? label.trim() : target.trim()))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
}
function wikiLink(target, labelEsc) {
  const lc = target.toLowerCase();
  for (const [id, e] of S.entries) if ((e.title || "").toLowerCase() === lc) return `<a class="wiki" href="#entry-${id}">${labelEsc}</a>`;
  const town = S.towns.find(t => t.n.toLowerCase() === lc);
  if (town) return `<a class="wiki town" href="#town-${town.i}">${labelEsc}</a>`;
  const slug = slugify(target);
  if (slug && allTagSlugs().includes(slug)) return `<a class="wiki tagl" href="#tag-${slug}">${labelEsc}</a>`;
  return `<span class="wiki missing" title="No entry called “${esc(target)}” yet">${labelEsc}</span>`;
}
// opts.base: heading offset (entries 2 => "# x" renders as h3; books 1). opts.toc: array to collect headings.
function md(src, opts) {
  opts = opts || {};
  const base = opts.base == null ? 2 : opts.base;
  const rawLines = String(src || "").split(/\r?\n/);
  const out = []; let para = [], list = null, hcount = 0;
  const flushP = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.tag}>` + list.items.map(i => "<li>" + inline(i) + "</li>").join("") + `</${list.tag}>`); list = null; } };
  for (let li = 0; li < rawLines.length; li++) {
    const rawL = rawLines[li];
    const aoe = rawL.match(AOE_RE);
    if (aoe) { flushP(); flushL(); out.push(aoeFigure(aoe[1])); continue; }
    const fr = rawL.match(FRES_RE);
    if (fr) { flushP(); flushL(); out.push(fresStaticHtml(fr[1])); continue; }
    const lib = rawL.match(LIB_RE);
    if (lib) { flushP(); flushL(); out.push(libNoteHtml(lib[1], lib[2])); continue; }
    const emb = !opts.noEmbed && rawL.match(EMBED_RE);
    if (emb) {
      flushP(); flushL();
      const ee = S.entries.get(emb[1]);
      if (isHarvest(ee) && !(READONLY && ee.hidden)) { out.push("\u0001" + harvestCardHtml(emb[1], ee)); continue; }
      const html = embedHtml(emb[1]);
      if (!html) continue;
      const id = "h-" + (hcount++);
      if (opts.toc && ee && (ee.type === "subclass" || ee.type === "race" || ee.type === "class")) opts.toc.push({ id, level: 2, text: ee.title + (ee.type === "subclass" ? " (subclass)" : ee.type === "race" ? " (race)" : ee.type === "class" ? " (class)" : "") });
      out.push(`<div class="embedwrap" id="${id}">${html}</div>`);
      continue;
    }
    // Tables (raw text, before escaping): stat blocks get the 5e treatment, others a plain table.
    if (rawL.trim().startsWith("|")) {
      const block = [];
      while (li < rawLines.length && rawLines[li].trim().startsWith("|")) block.push(rawLines[li++]);
      li--;
      flushP(); flushL();
      out.push(isLootTable(block) ? lootHtml(parseLootTable(block)) : isStatTable(block) ? statBlockHtml(parseStatTable(block), "") : tableHtml(block));
      continue;
    }
    const l = esc(rawL).trimEnd();
    let m;
    if (!l.trim()) { flushP(); flushL(); continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { flushP(); flushL(); out.push("<hr>"); continue; }
    if ((m = l.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)(?:\s*\{[^}]*\})?$/))) {
      flushP(); flushL();
      const fig = imageHtml(unesc(m[2]), unesc(m[1]), opts.entryId);
      // An image right after a paragraph sits beside it (homebrewery-style action diagrams).
      if (out.length && out[out.length - 1].startsWith("<p>")) out.push(`<div class="withimg">${out.pop()}${fig}</div>`);
      else out.push(fig);
      continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) {
      flushP(); flushL();
      const n = Math.min(6, m[1].length + base), text = m[2].trim();
      if (!text) continue;
      const id = "h-" + (hcount++);
      if (opts.toc && m[1].length <= 2) opts.toc.push({ id, level: m[1].length, text: unesc(text.replace(/\\(.)/g, "$1").replace(/\*/g, "")) });
      let extra = "";
      if (opts.linkEntries) { const hit = entryByLooseTitle(unesc(text)); if (hit) extra = ` <a class="hlink" href="#entry-${hit}">Open entry →</a>`; }
      out.push(`<h${n} id="${id}">${inline(text)}${extra}</h${n}>`);
      continue;
    }
    if ((m = l.match(/^\s*[-*]\s+(.*)$/))) { flushP(); if (!list || list.tag !== "ul") { flushL(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.tag !== "ol") { flushL(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = l.match(/^&gt;\s?(.*)$/))) { flushP(); flushL(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); continue; }
    flushL(); para.push(l.trim());
  }
  flushP(); flushL();
  // Harvested parts sit side by side as cards.
  const grouped = [];
  for (const o of out) {
    if (o.startsWith("\u0001")) { const last = grouped[grouped.length - 1]; if (Array.isArray(last)) last.push(o.slice(1)); else grouped.push([o.slice(1)]); }
    else grouped.push(o);
  }
  return diceify(grouped.map(g => Array.isArray(g) ? `<div class="loot"><div class="lootgrid">${g.join("")}</div></div>` : g).join("\n"));
}
// House rule average: each die counts as half its sides (d6 → 3, d8 → 4), then add the modifiers.
function diceAvg(expr) {
  const terms = [...String(expr).replace(/−/g, "-").matchAll(/([+-]?)\s*(\d+)\s*(?:d\s*(\d+))?/gi)];
  if (!terms.length || !terms.some(t => t[3])) return null;
  let total = 0; const parts = [];
  terms.forEach((t, k) => {
    const sign = t[1] === "-" ? -1 : 1, n = Number(t[2]);
    if (t[3]) {
      const half = Math.floor(Number(t[3]) / 2), sub = n * half;
      total += sign * sub;
      const shown = n <= 4 ? Array(n).fill(half).join(" + ") : `${n} × ${half}`;
      parts.push((k && sign < 0 ? "− " : k ? "+ " : "") + (n > 1 && n <= 4 ? shown : shown) + ` (${n}d${t[3]})`);
    } else { total += sign * n; parts.push((sign < 0 ? "− " : "+ ") + n); }
  });
  return { total, tip: parts.join(" ").replace(/^\+ /, "") + " = " + total };
}
function diceify(html) {
  let inDice = 0;
  return html.split(/(<[^>]+>)/).map(seg => {
    if (seg.startsWith("<")) {
      if (/^<span class="dice"/.test(seg)) inDice = 1; else if (inDice && seg === "</span>") inDice = 0;
      if (/^<(a|code|textarea)\b/i.test(seg)) inDice = 2; else if (inDice === 2 && /^<\/(a|code|textarea)>/i.test(seg)) inDice = 0;
      return seg;
    }
    if (inDice) return seg;
    return seg.replace(/\b\d+d\d+(?:\s*[+\-−]\s*\d+(?:d\d+)?)*/g, m => {
      const a = diceAvg(m); if (!a) return m;
      return `<span class="dice" tabindex="0" data-tip="Average ${a.total}&#10;${esc(a.tip)}">${m}</span>`;
    });
  }).join("");
}
function isExternal(url) { return /^https?:\/\//i.test(url) && !url.startsWith(location.origin); }
// A creature's token pictures: e.tokens (several, picked at random) or just e.token.
function entryTokens(e) { if (!e) return []; const l = Array.isArray(e.tokens) && e.tokens.length ? e.tokens : e.token ? [e.token] : []; return l.filter(Boolean); }
function edTokThumb(src) { return `<span class="edtok" data-src="${esc(src)}"><img src="${esc(src)}" alt=""><button type="button" class="iconbtn" data-act="edtokrm" aria-label="Remove this picture">✕</button></span>`; }
function edTokAdd(src) { const box = document.getElementById("ed-toks"); if (!box || [...box.querySelectorAll(".edtok")].some(x => x.dataset.src === src)) return; box.insertAdjacentHTML("beforeend", edTokThumb(src)); }
function imageHtml(url, alt, entryId) {
  if (!/^(https?:\/\/|\/_blob\/|images\/|blob:|data:image\/)/i.test(url)) return "";
  if (!isExternal(url) || READONLY || LOCAL) return `<figure class="img"><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy"></figure>`;
  let host = ""; try { host = new URL(url).host; } catch (e) {}
  const up = S.assets && entryId ? `<button class="btn ghost small" data-act="imgup" data-id="${esc(entryId)}" data-url="${esc(url)}">Upload a copy</button>` : "";
  return `<figure class="img ext"><a href="${esc(url)}" target="_blank" rel="noopener"><span class="ico" aria-hidden="true">🖼</span><b>${esc(alt || "Image")}</b><small>Image link on ${esc(host)}. Opens in a new tab.</small></a>${up}</figure>`;
}
function tableHtml(block) {
  const rows = block.filter(l => !/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l.trim())).map(splitRow).map(r => r.map(unescapeCell));
  const width = Math.max(...rows.map(r => { let k = r.length; while (k > 1 && !r[k - 1]) k--; return k; }));
  const body = rows.filter(r => r.some(c => c)).map(r => "<tr>" + r.slice(0, width).map(c => `<td>${inline(esc(c).replace(/•/g, "<br>•"))}</td>`).join("") + "</tr>").join("");
  return `<div class="tablewrap doc"><table>${body}</table></div>`;
}
function entryByLooseTitle(t) {
  const norm = s => String(s).toLowerCase().replace(/\s+-\s+.*$/, "").replace(/[^a-z0-9]/g, "");
  const k = norm(t); if (!k) return null;
  for (const [id, e] of S.entries) if ((e.type === "creature" || e.type === "item") && norm(e.title) === k) return id;
  return null;
}
const mod = v => { const n = parseInt(v, 10); if (isNaN(n)) return ""; const m = Math.floor((n - 10) / 2); return (m >= 0 ? "+" : "−") + Math.abs(m); };
function statBlockHtml(sb, name, parts) {
  if (!sb) return "";
  parts = parts || "all";
  const row = (label, v) => v ? `<p><b>${label}</b> ${esc(v)}</p>` : "";
  const ab = ["str", "dex", "con", "int", "wis", "cha"];
  const hasAb = ab.some(k => sb[k]);
  const details = String(sb.details || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf(":"); return i > 0 ? `<p><b>${esc(l.slice(0, i))}</b> ${esc(l.slice(i + 1).trim())}</p>` : `<p>${esc(l)}</p>`; }).join("");
  const nm = name || sb.name;
  return `<div class="statblock">
    ${nm ? `<h2 class="sbname">${esc(nm)}</h2>` : ""}${sb.subtitle ? `<p class="sbsub">${esc(sb.subtitle)}</p>` : ""}
    <div class="taper"></div>
    <div class="sbred">${row("Armour Class", sb.ac)}${row("Hit Points", sb.hp)}${row("Speed", sb.speed)}${row("Exhaust Meter", sb.exhaust || sbAutoExhaust(sb))}</div>
    ${hasAb ? `<div class="taper"></div><div class="abil">${ab.map(k => `<div><b>${k.toUpperCase()}</b><span>${esc(sb[k] || "—")} ${sb[k] ? "(" + mod(sb[k]) + ")" : ""}</span></div>`).join("")}</div>` : ""}
    <div class="taper"></div>
    <div class="sbred">${details}${row("Challenge", sb.cr)}${row("Proficiency Bonus", sb.prof || sbAutoProf(sb))}</div>
    ${sb.features && parts === "all" ? `<div class="taper"></div><div class="sbfeat">${md(sb.features, { base: 1 })}</div>` : ""}
  </div>`;
}
function featuresHtml(sb, entryId, ctx) {
  if (!sb || !sb.features) return "";
  const cx = ctx || "e:" + (entryId || ""); fresRemember(cx, sb);
  return `<section class="statblock feats"><div class="sbfeat">${fresLive(rchWrap(md(sb.features, { base: 1, entryId }), cx), cx, sb)}</div></section>`;
}
// ----- Recharge locks: mark a used recharge action so it's easy to see until it comes back -----
// ctx says where the lock is kept: "cb:<encounter>:<combatant>" and "sm:<character>:<summon>" are saved;
// "e:<entry>" (any other stat block) lasts until the page is reloaded.
const RCH = new Set();
const RCH_RE = /recharge/i;
const rchKey = name => String(name || "").replace(/<[^>]+>/g, "").replace(/\s*\([^)]*\)\s*\.?\s*$/, "").replace(/\.\s*$/, "").trim().toLowerCase();
function rchLocked(ctx, key) {
  const [kind, a, b] = String(ctx).split(":");
  if (kind === "cb") { const en = S.encs && S.encs.get(a), c = en && encItems(en).find(x => x.uid === b); return !!(c && (c.locked || []).includes(key)); }
  if (kind === "sm") { const ch = S.chars.get(a), s = ch && smList(ch).find(x => x.id === b); return !!(s && (s.locked || []).includes(key)); }
  return RCH.has(ctx + "|" + key);
}
function rchWrap(html, ctx) {
  const starts = []; const re = /<p><strong><em>([\s\S]*?)<\/em><\/strong>|<h[1-6][\s>]/g; let m;
  while ((m = re.exec(html))) starts.push({ at: m.index, name: m[1] });
  if (!starts.some(x => x.name && RCH_RE.test(x.name))) return html;
  let out = "", pos = 0;
  starts.forEach((x, i) => {
    if (!x.name || !RCH_RE.test(x.name)) return;
    const end = i + 1 < starts.length ? starts[i + 1].at : html.length, key = rchKey(x.name), on = rchLocked(ctx, key), label = esc(unesc(x.name.replace(/<[^>]+>/g, "").replace(/\.\s*$/, "")));
    out += html.slice(pos, x.at) + `<div class="rch${on ? " locked" : ""}" data-rchctx="${esc(ctx)}" data-rchkey="${esc(key)}">${html.slice(x.at, end)}`
      + (on ? `<div class="rchveil"><button type="button" class="btn small rchbtn" data-rch="off" aria-label="Unlock ${label}">🔓 Recharged: unlock</button></div>` : `<button type="button" class="rchuse" data-rch="on" aria-label="Lock ${label} until it recharges" title="Used: lock until it recharges">🔒 Used</button>`) + `</div>`;
    pos = end;
  });
  return out + html.slice(pos);
}
function rchToggle(ctx, key) {
  const [kind, a, b] = String(ctx).split(":"), flip = list => { const s = new Set(list || []); s.has(key) ? s.delete(key) : s.add(key); return [...s]; };
  if (kind === "cb") { if (READONLY) return; encSave(a, en => { en.list = en.list.map(c => c.uid === b ? Object.assign(c, { locked: flip(c.locked) }) : c); }); }
  else if (kind === "sm") { if (READONLY && !PLAYER) return; charChange(a, x => { x.summons = smList(x).map(s => s.id === b ? Object.assign({}, s, { locked: flip(s.locked) }) : s); }); }
  else { const k = ctx + "|" + key; RCH.has(k) ? RCH.delete(k) : RCH.add(k); render(); }
}
document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-rch]"); if (!b) return;
  const w = b.closest("[data-rchkey]"); if (!w) return;
  ev.preventDefault(); ev.stopPropagation(); rchToggle(w.dataset.rchctx, w.dataset.rchkey);
}, true);
function excerpt(body, n) {
  const t = String(body || "").replace(/^\|.*$/gm, " ").replace(/\\(.)/g, "$1").replace(/~~/g, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => b || a).replace(/[#*>]/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).replace(/\s\S*$/, "") + "…" : t;
}

// ---------- data layer ----------
// A read-only copy exported for friends carries its data inside the page.
// PLAYER: a player's device connected to the codex server. Read-only except for characters.
const PLAYER = !window.__CODEX_DATA && !!window.__CODEX_SERVER && window.__CODEX_ROLE === "player";
const READONLY = !!window.__CODEX_DATA || PLAYER;
function loadEmbedded() {
  const d = window.__CODEX_DATA;
  S.entries = new Map(Object.entries(d.entries || {}));
  S.tags = new Map(Object.entries(d.tags || {}));
  S.books = new Map(Object.entries(d.books || {}));
  S.chars = new Map(Object.entries(d.characters || {}));
  if (d.map && d.map.meta) { S.meta = d.map.meta; S.towns = (d.map.towns || []).slice().sort((a, b) => byName(a.n, b.n)); S.townById = new Map(S.towns.map(t => [t.i, t])); }
  S.imports = {};
  S.loaded = { entries: true, tags: true, meta: true, books: true, chars: true };
  document.body.classList.add("readonly");
  render();
}
async function initDb() {
  if (READONLY && !PLAYER) { loadEmbedded(); return; }
  if (LOCAL) { document.body.classList.add("local"); localBoot(); return; }
  let db = null;
  try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch (e) { db = null; }
  if (!db) { S.offline = true; render(); return; }
  claude.use("assets").then(a => { S.assets = a; render(); }).catch(() => {});
  claude.use("downloads").then(d => { S.downloads = d; render(); }).catch(() => {});
  connectDb(db);
}
function connectDb(db) {
  S.db = db;
  const loadTimer = setTimeout(() => { S.slow = true; render(); }, 10000);
  const done = key => { S.loaded[key] = true; if (S.loaded.entries && S.loaded.tags && S.loaded.meta) { clearTimeout(loadTimer); S.slow = false; } };
  const onErr = e => { clearTimeout(loadTimer); S.slow = false; toast("Lost the connection to your saved lore (" + (e && e.code) + "). Reload the page to reconnect.", "bad"); render(); };

  db.collection("entries").onSnapshot(snap => {
    S.entries = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    if (!snap.metadata.fromCache) { done("entries"); maybeMigrate(); }
    render();
  }, onErr);
  db.collection("tags").onSnapshot(snap => {
    S.tags = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    if (!snap.metadata.fromCache) done("tags");
    render();
  }, onErr);
  db.doc("map/meta").onSnapshot(snap => {
    S.meta = snap.exists ? snap.data() : null;
    S.landKey = null;
    rebuildTowns();
    if (!snap.metadata.fromCache) done("meta");
    render();
  }, onErr);
  db.collection("books").onSnapshot(snap => {
    S.books = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    if (!snap.metadata.fromCache) S.loaded.books = true;
    render();
  }, onErr);
  db.collection("encounters").onSnapshot(snap => {
    S.encs = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest(".enced") && document.activeElement.matches("input,textarea");
    if (!typing && route().v === "encounters") render();
  }, () => {});
  const vttSub = (col, key, after) => db.collection(col).onSnapshot(snap => {
    S[key] = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    if (after) after(); else { const v = route().v; if (v === "vtt" || v === "vttc") render(); }
  }, () => {});
  vttSub("vttcamps", "vttCamps", () => { const v = route().v; if (v === "vtt" || v === "vttc" || v === "home") render(); }); vttSub("vttpages", "vttPages", () => { if (typeof vPagesSnap === "function") vPagesSnap(); const v = route().v; if (v === "vtt" || v === "vttc") render(); }); vttSub("vtttokens", "vttTokens");
  vttSub("vttfog", "vttFog", () => { if (route().v === "vttc") vDraw(); });
  vttSub("vttdraw", "vttDraw", () => { if (route().v === "vttc" && typeof vDrawingsRefresh === "function") vDrawingsRefresh(); });
  if (window.__CODEX_SERVER) vttSub("vttlive", "vttLive", () => { if (route().v === "vttc" && typeof vLiveSnap === "function") vLiveSnap(); });
  db.collection("characters").onSnapshot(snap => {
    const next = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    // Keep the local copy of any sheet that has a save still waiting, so typing never jumps back.
    for (const id of Object.keys(CS.timers)) if (S.chars.has(id)) next.set(id, S.chars.get(id));
    S.chars = next;
    if (!snap.metadata.fromCache) S.loaded.chars = true;
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest(".sheet") && document.activeElement.matches("input,textarea,select,[contenteditable]");
    if (!typing) render();
  }, onErr);
  db.doc("settings/harvest").onSnapshot(snap => { S.harvestCfg = snap.exists ? snap.data() : {}; }, () => {});
  db.doc("settings/vttlights").onSnapshot(snap => { S.vttLightDoc = snap.exists ? snap.data() : null; if (typeof vRefresh === "function" && document.getElementById("vstage")) vRefresh(); }, () => {});
  db.doc("settings/vttconds").onSnapshot(snap => { S.vttCondDoc = snap.exists ? snap.data() : null; if (typeof vRefresh === "function" && document.getElementById("vstage")) vRefresh(); }, () => {});
  db.doc("settings/dictionary").onSnapshot(snap => { S.dict = snap.exists ? (snap.data().words || []) : []; }, () => {});
  db.doc("settings/imports").onSnapshot(snap => {
    S.imports = snap.exists ? snap.data() : {};
    maybeMigrate();
    render();
  }, onErr);
  db.collection("maptowns").onSnapshot(snap => {
    S.chunks = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    rebuildTowns();
    render();
  }, onErr);
}
function rebuildTowns() {
  const towns = [];
  if (S.meta) {
    for (let k = 0; k < (S.meta.chunks || 0); k++) {
      const c = S.chunks.get("c" + k);
      if (c && c.importId === S.meta.importId) towns.push(...c.towns);
    }
  }
  S.towns = towns.sort((a, b) => byName(a.n, b.n));
  S.townById = new Map(S.towns.map(t => [t.i, t]));
}
async function safeWrite(fn, okMsg) {
  if (!S.db) { toast("Saving isn't available here. Open the codex from claude.ai while signed in.", "bad"); return false; }
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) {
    const code = e && e.code;
    if (code === "unavailable") { try { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); await fn(); if (okMsg) toast(okMsg); return true; } catch (e2) { /* fall through */ } }
    const msg = code === "invalid_argument" ? "Couldn't save. You may only have view access to this codex, or the text is too long."
      : code === "quota_exceeded" ? "Couldn't save: the codex storage is full. Delete some entries and try again."
      : code === "resource_exhausted" ? "Saving too quickly. Wait a moment and try again."
      : "Couldn't save right now (" + (code || "error") + "). Try again in a moment.";
    toast(msg, "bad"); return false;
  }
}

// ---------- routing ----------
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (h.startsWith("entry-")) return { v: "entry", id: h.slice(6) };
  if (h.startsWith("tag-")) return { v: "tag", slug: h.slice(4) };
  if (h.startsWith("town-")) return { v: "town", i: Number(h.slice(5)) };
  if (h.startsWith("bookedit-")) return { v: "bookedit", id: h.slice(9) };
  if (h.startsWith("book-")) return { v: "book", id: h.slice(5) };
  if (h.startsWith("char-")) return { v: "char", id: h.slice(5) };
  if (h.startsWith("spell-")) return { v: "spellpage", id: h.slice(6) };
  if (h.startsWith("vtt-")) return { v: "vttc", id: h.slice(4) };
  if (["world", "tags", "backup", "bestiary", "library", "items", "books", "home", "characters", "srd", "spells", "encounters", "vtt"].includes(h)) return { v: h };
  return { v: "home" };
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
document.addEventListener("click", ev => { if (ev.target.closest && ev.target.closest(".nmpop button")) { const nm = document.getElementById("navmore"); if (nm) nm.open = false; } });
document.addEventListener("pointerdown", ev => {
  const nm = document.getElementById("navmore"); if (nm && nm.open && !nm.contains(ev.target)) nm.open = false;
  document.querySelectorAll("details.filterpop[open]").forEach(d => { if (!d.contains(ev.target) && !(ev.target.closest && ev.target.closest("#modal"))) d.open = false; });
});

// ---------- render ----------
function render() {
  if (LOCAL && !S.db) return;
  const r = route();
  document.querySelectorAll(".top [data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === r.v || (r.v === "entry" && a.dataset.nav === ({ creature: "bestiary", item: "items", spell: "spells" }[(S.entries.get(r.id) || {}).type] || "library")) || (r.v === "town" && a.dataset.nav === "world") || (r.v === "tag" && a.dataset.nav === "tags") || ((r.v === "book" || r.v === "bookedit") && a.dataset.nav === "books") || (r.v === "char" && a.dataset.nav === "characters") || (r.v === "spellpage" && a.dataset.nav === "spells") || (r.v === "vttc" && a.dataset.nav === "vtt")));
  { const nm = document.getElementById("navmore"); if (nm) { const on = nm.querySelector("a.on"); nm.classList.toggle("on", !!on); nm.querySelector(".nmlab").textContent = on ? on.textContent.replace(/ rules$/, "") : "More"; nm.open = false; } }
  { const nav = document.querySelector(".nav"), on = nav && nav.querySelector("a.on"); if (on && nav.scrollWidth > nav.clientWidth) { const l = on.offsetLeft - nav.offsetLeft, r = l + on.offsetWidth; if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth - 28) nav.scrollLeft = Math.max(0, l - 24); } }
  { const q = document.getElementById("q"); if (q && document.activeElement !== q && !q.value) document.body.classList.remove("showsearch"); }
  document.body.classList.toggle("vttmode", r.v === "vttc");
  if (r.v === "vttc" && r.id) { try { localStorage.setItem("codexLastCamp", r.id); } catch (e) {} }
  document.body.classList.toggle("at-home", r.v === "home");
  beLeave(r);
  // The book editor stays put while snapshots arrive; only its embedded previews refresh.
  if (r.v === "bookedit" && BE.id === r.id && document.querySelector(".bookeditor")) { beRefresh(); return; }
  // The tabletop board stays mounted while updates arrive; only its layers redraw.
  if (r.v === "vttc" && S.vttCamps && S.vttCamps.has(r.id)) { const root = document.querySelector(".vtt"); if (root && root.dataset.camp === r.id && VTT.mountedKey === r.id + "|" + vCurrentPage(r.id) && document.getElementById("vstage") && !!document.getElementById("vmaps") === !!(VTT.mapsOpen && !READONLY)) { vMapsRefresh(); const bar = root.querySelector(".vttbar"), fresh = document.createElement("div"); fresh.innerHTML = viewVttCamp(r.id); const nb = fresh.querySelector(".vttbar"); if (bar && nb && bar.innerHTML !== nb.innerHTML) bar.innerHTML = nb.innerHTML; vRefresh(); return; } }
  const main = $("#main");
  let banner = "";
  if (S.offline) banner = `<div class="banner bad">Your saved lore can't load in this view. Open the codex on claude.ai while signed in to read and save entries.</div>`;
  else if (S.slow) banner = `<div class="banner">Still reaching your saved lore. What you see may be out of date.</div>`;
  let html;
  if (r.v === "entry") html = viewEntry(r.id);
  else if (r.v === "tag") html = viewTag(r.slug);
  else if (r.v === "town") html = viewTown(r.i);
  else if (r.v === "world") html = viewWorld();
  else if (r.v === "tags") html = viewTags();
  else if (r.v === "home") html = viewHome();
  else if (r.v === "backup") html = READONLY ? viewLibrary(false) : viewBackup();
  else if (r.v === "items") html = viewItems();
  else if (r.v === "books") html = viewBooks();
  else if (r.v === "book") html = viewBook(r.id);
  else if (r.v === "bookedit") html = viewBookEdit(r.id);
  else if (r.v === "bestiary") html = viewBestiary();
  else if (r.v === "characters") html = viewCharacters();
  else if (r.v === "encounters") html = viewEncounters();
  else if (r.v === "vtt") html = viewVtt();
  else if (r.v === "vttc") html = viewVttCamp(r.id);
  else if (r.v === "srd") html = viewSrd();
  else if (r.v === "spells") html = viewSpells();
  else if (r.v === "spellpage") html = viewSpellPage(r.id);
  else if (r.v === "char") html = viewCharacter(r.id);
  else html = viewLibrary(false);
  const popEl = document.querySelector("#beasttags .pop"), popScroll = popEl ? popEl.scrollTop : 0;
  const focusId = document.activeElement && document.activeElement.id;
  const selStart = document.activeElement && document.activeElement.selectionStart;
  main.innerHTML = banner + dupBanner(r.v) + html;
  if (focusId && focusId !== "q") { const el = document.getElementById(focusId); if (el && el.matches("input[type=search],input[type=text]")) { el.focus(); try { el.setSelectionRange(selStart, selStart); } catch (e) {} } }
  if (r.v === "bookedit") beMount();
  if (r.v === "vttc") vMount(); else VTT.mountedKey = "";
  const wm = $("#worldmap"); if (wm) drawLand();
  const sheet = document.querySelector(".sheet.editing"); if (sheet) richifyAll(sheet, "textarea.cf.rich", { tools: "small", base: 3 });
  if (S.beast.tagQ && document.querySelector(".tpick")) filterTagPicker(S.beast.tagQ);
  const popNew = document.querySelector("#beasttags .pop"); if (popNew) popNew.scrollTop = popScroll;
}

function loadingOr(cond, html) {
  if (cond) return html;
  return `<div class="empty">Opening the codex…</div>`;
}

// ----- Duplicates -----
function dupGroups() {
  const by = new Map();
  for (const [id, e] of S.entries) { const k = (e.type || "") + "|" + String(e.title || "").trim().toLowerCase(); if (!k.endsWith("|")) { if (!by.has(k)) by.set(k, []); by.get(k).push(id); } }
  return [...by.values()].filter(g => g.length > 1);
}
function dupBanner(v) {
  if (READONLY) return "";
  if (!["library", "bestiary", "items"].includes(v)) return "";
  const groups = dupGroups(); if (!groups.length) return "";
  const names = groups.map(g => `<strong>${esc(S.entries.get(g[0]).title)}</strong> (${g.length})`).join(", ");
  return `<div class="banner import"><div>Some entries share a title: ${names}. Merging combines their text and tags into one entry.</div><button class="btn" data-act="mergedupes">Merge duplicates</button></div>`;
}
function mergedEntry(ids) {
  const items = ids.map(id => [id, S.entries.get(id)]);
  const norm = t => String(t || "").replace(/\s+/g, " ").replace(/[^a-z0-9 ]/gi, "").toLowerCase().trim();
  // Keep the richest entry as the base: stat block first, then longest text.
  items.sort((a, b) => (b[1].statblock ? 1 : 0) - (a[1].statblock ? 1 : 0) || (b[1].body || "").length - (a[1].body || "").length);
  const [keepId, base] = items[0];
  const out = JSON.parse(JSON.stringify(base));
  const bodies = [base.body || ""];
  for (const [, e] of items.slice(1)) {
    const b = e.body || "";
    if (b.trim() && !bodies.some(x => norm(x).includes(norm(b)) || similar(norm(x), norm(b)))) {
      const src = e.source && S.books.get(e.source) ? S.books.get(e.source).title : "another version";
      bodies.push(`### From ${src}\n\n${b}`);
    }
    out.tags = [...new Set([...(out.tags || []), ...(e.tags || [])])];
    if (!out.statblock && e.statblock) out.statblock = e.statblock;
    if (!out.item && e.item) out.item = e.item;
    if (out.townId == null && e.townId != null) out.townId = e.townId;
    if (!out.image && e.image) out.image = e.image;
  }
  out.body = bodies.filter(x => x.trim()).join("\n\n");
  out.updated = new Date().toISOString();
  return { keepId, out, drop: items.slice(1).map(x => x[0]) };
}
function similar(a, b) {
  // Near-identical text (e.g. only spelling differs): compare word sets.
  const A = new Set(a.split(" ")), B = new Set(b.split(" "));
  let common = 0; A.forEach(w => { if (B.has(w)) common++; });
  return common / Math.max(A.size, B.size, 1) > 0.9;
}
async function mergeDuplicates() {
  const groups = dupGroups(); if (!groups.length) return;
  if (!(await confirmBox(`Merge ${groups.length} set${groups.length === 1 ? "" : "s"} of duplicates into single entries? Text that's the same in both is kept once; different text is kept under a “From …” heading.`, "Merge"))) return;
  await safeWrite(async () => {
    for (const g of groups) {
      const { keepId, out, drop } = mergedEntry(g);
      await S.db.doc("entries/" + keepId).set(out);
      for (const id of drop) await S.db.doc("entries/" + id).delete();
    }
  }, "Duplicates merged");
}

// ----- Home -----
function dayPick(list) {
  if (!list.length) return null;
  const d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return list[(seed * 2654435761 >>> 0) % list.length];
}
function homeAgo(t) {
  const ms = Date.now() - Date.parse(t || ""); if (!(ms >= 0)) return "";
  const m = Math.round(ms / 60000);
  return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : m < 2880 ? "yesterday" : m < 10080 ? Math.round(m / 1440) + " days ago" : new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function homeLastCamp() {
  const camps = S.vttCamps || new Map(); if (!camps.size) return null;
  let id = ""; try { id = localStorage.getItem("codexLastCamp") || ""; } catch (e) {}
  if (!camps.has(id)) id = [...camps.entries()].sort((a, b) => String(b[1].updated || b[1].created || "").localeCompare(String(a[1].updated || a[1].created || "")))[0][0];
  return id;
}
function viewHome() {
  if (!S.loaded.entries && !S.offline) return loadingOr(false);
  const GM = !READONLY && !(typeof PLAYER !== "undefined" && PLAYER);
  const all = [...S.entries.entries()];
  const count = t => all.filter(([, e]) => e.type === t).length;
  const creatures = all.filter(([, e]) => e.type === "creature"), withSb = creatures.filter(([, e]) => e.statblock);
  const items = all.filter(([, e]) => e.type === "item");
  const books = [...S.books.entries()].filter(([, b]) => GM || !b.hidden).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  const chars = [...S.chars.entries()].sort((a, b) => byName(a[1].name, b[1].name));
  const loreN = all.length - creatures.length - items.length;
  const card = (cls, title, link, body, extra = "") => `<section class="hcard ${cls}"><header><h2>${title}</h2>${link ? `<a class="hmore" href="#${link[0]}">${link[1]} →</a>` : ""}</header>${body}${extra}</section>`;

  // 1. Pick up where you left off: the tabletop campaign you last had open.
  const campId = homeLastCamp(), camp = campId ? S.vttCamps.get(campId) : null;
  let cont;
  if (camp) {
    const pages = S.vttPages || new Map();
    const pid = camp.playerPage && pages.has(camp.playerPage) ? camp.playerPage : ([...pages.entries()].filter(([, p]) => p.camp === campId).sort((a, b) => (a[1].order || 0) - (b[1].order || 0))[0] || [""])[0];
    const pg = pid ? pages.get(pid) : null;
    const I = camp.init || {}, list = Array.isArray(I.list) ? I.list.filter(x => GM || !x.gm) : [], cur = list.find(x => x.id === I.cur);
    const toks = pid && S.vttTokens ? [...S.vttTokens.values()].filter(t => t.page === pid && t.layer !== "gm").length : 0;
    const quests = (Array.isArray(camp.quests) ? camp.quests : []).filter(q => (q.status || "active") === "active" && (GM || (!q.hidden && camp.questShow)));
    cont = `<a class="hcont" href="#vtt-${esc(campId)}">
      <span class="eyebrow">${GM ? "Continue your session" : "Your table"}</span>
      <strong>${esc(camp.name || "Campaign")}</strong>
      <span class="hcmeta">${pg ? `<span>🗺 ${esc(pg.name || "Map")}</span>` : ""}${toks ? `<span>${toks} token${toks === 1 ? "" : "s"}</span>` : ""}${quests.length ? `<span>${quests.length} active quest${quests.length === 1 ? "" : "s"}</span>` : ""}</span>
      ${I.round && cur ? `<span class="hcfight">⚔ In combat · round ${Number(I.round)} · ${esc(cur.name || "someone")}'s turn</span>` : ""}
      <span class="btn">Open tabletop →</span></a>`;
  } else {
    cont = `<a class="hcont empty" href="#vtt"><span class="eyebrow">Tabletop</span><strong>${GM ? "Set up your first campaign" : "No table yet"}</strong><span class="hcmeta"><span>${GM ? "Maps, tokens, fog and lighting for your sessions." : "Your GM hasn't opened a table yet."}</span></span>${GM ? `<span class="btn">Go to Tabletop →</span>` : ""}</a>`;
  }

  // 2. The party at a glance.
  const party = chars.length ? `<ul class="hparty">${chars.slice(0, 8).map(([id, c]) => {
    const hp = Number(c.hp && c.hp.cur) || 0, mx = Number(c.hp && c.hp.max) || 0, pct = mx ? Math.max(0, Math.min(100, Math.round(hp / mx * 100))) : 0;
    const ac = typeof cAC === "function" ? cAC(c) : (c.ac || "");
    return `<li><a href="#char-${esc(id)}">${(c.image || c.token) ? `<img class="hpimg" src="${esc(c.image || c.token)}" alt="">` : `<span class="hpimg hpinit">${esc((c.name || "?")[0])}</span>`}<span class="hpname"><b>${esc(c.name || "Unnamed")}</b><span class="muted small">${esc(typeof charSub === "function" ? charSub(c) : "")}</span></span>
      <span class="hpac" title="Armour Class">${esc(String(ac))}<small>AC</small></span>
      <span class="hphp" title="Hit points"><span class="hpbar"><i class="${pct <= 25 ? "low" : pct <= 50 ? "mid" : ""}" style="width:${pct}%"></i></span><span class="small">${hp}/${mx}</span></span></a></li>`;
  }).join("")}</ul>` : `<p class="muted">${GM ? "No character sheets yet." : "No characters yet."}</p>${GM ? `<a class="btn ghost small" href="#characters">Add a character</a>` : ""}`;

  // 3. Recently changed across entries, books and characters.
  const recent = [
    ...all.map(([id, e]) => ({ t: e.updated, href: "#entry-" + id, name: e.title || "Untitled", kind: (TYPE[e.type] || TYPE.general).label, cls: "t-" + ((TYPE[e.type] || TYPE.general).id) })),
    ...books.map(([id, b]) => ({ t: b.updated, href: "#book-" + id, name: b.title || "Untitled book", kind: "Book", cls: "t-history" })),
    ...chars.map(([id, c]) => ({ t: c.updated, href: "#char-" + id, name: c.name || "Character", kind: "Character", cls: "t-faction" }))
  ].filter(x => x.t).sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 7);
  const recentHtml = recent.length ? `<ul class="hrecent">${recent.map(x => `<li><a href="${esc(x.href)}">${esc(x.name)}</a><span class="pill ${x.cls}">${esc(x.kind)}</span><span class="muted small">${esc(homeAgo(x.t))}</span></li>`).join("")}</ul>` : `<p class="muted">Nothing edited yet.</p>`;

  // 4. Things the GM might want to tidy up.
  const stubs = all.filter(([, e]) => !String(e.body || "").trim() && !e.statblock && !(e.item && (e.item.lore || e.item.meta)) && !e.features);
  const noSb = creatures.filter(([, e]) => !e.statblock);
  const dups = typeof dupGroups === "function" ? dupGroups().length : 0, hid = hiddenCount();
  const todo = [
    stubs.length ? `<li><span class="hnum">${stubs.length}</span><span>entr${stubs.length === 1 ? "y" : "ies"} not written yet <span class="hlinks">${stubs.slice(0, 3).map(([id, e]) => `<a href="#entry-${esc(id)}">${esc(e.title)}</a>`).join("")}</span></span></li>` : "",
    noSb.length ? `<li><span class="hnum">${noSb.length}</span><span>creature${noSb.length === 1 ? "" : "s"} without a stat block <span class="hlinks"><a href="#bestiary" data-act="homenosb">Show them</a></span></span></li>` : "",
    dups ? `<li><span class="hnum">${dups}</span><span>title${dups === 1 ? "" : "s"} used twice <span class="hlinks"><button type="button" class="linkbtn" data-act="mergedupes">Merge</button></span></span></li>` : "",
    hid ? `<li><span class="hnum quiet">${hid}</span><span>hidden from players</span></li>` : ""
  ].join("");

  // 5. Creature of the day, kept small.
  const spot = dayPick(withSb.length ? withSb : creatures), sp = spot ? spot[1] : null, sb = sp && sp.statblock;
  const spotHtml = sp ? `<a class="hspot" href="#entry-${esc(spot[0])}"><strong>${esc(sp.title)}</strong>
    <span class="muted small">${esc((sb && sb.subtitle) || (sp.tags || []).map(tagName).join(", "))}</span>
    ${sb ? `<span class="spotstats">${sb.ac ? `<span><b>AC</b> ${esc(String(sb.ac).split(" ")[0])}</span>` : ""}${sb.hp ? `<span><b>HP</b> ${esc(String(sb.hp).split(" ")[0])}</span>` : ""}${sb.cr ? `<span><b>CR</b> ${esc(String(sb.cr).split(" ")[0])}</span>` : ""}</span>` : ""}
    ${sp.body ? `<span class="spotlore">${esc(excerpt(sp.body, 110))}</span>` : ""}</a>` : "";

  const stat = (href, n, label, cls, sub) => `<a class="hstat ${cls}" href="#${href}"><b>${fmt(n)}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</a>`;
  return `<div class="home2">
    <div class="hhead">
      <div class="hhtitle"><h1>DnD <span>Codex</span></h1>
        ${GM ? `<div class="hactions"><button class="btn" data-act="new">+ New entry</button><a class="btn ghost" href="#characters">Characters</a><a class="btn ghost" href="#encounters">Encounters</a></div>` : ""}</div>
      <label class="search big"><span class="sr">Search all lore</span><input id="homeq" type="search" placeholder="Search creatures, items, books and towns" data-input="homeq"></label>
    </div>
    <nav class="hstats" aria-label="What's in your codex">
      ${stat("bestiary", creatures.length, "Creatures", "t-creature", withSb.length + " stat blocks")}
      ${stat("items", items.length, "Items", "t-item", items.filter(([, e]) => isMagical(e)).length + " magical")}
      ${stat("library", loreN, "Lore entries", "t-biology", "")}
      ${stat("spells", count("spell"), "Spells", "t-magic", "")}
      ${stat("books", books.length, "Books", "t-history", "")}
      ${stat("characters", chars.length, "Characters", "t-faction", "")}
      ${S.meta ? stat("world", S.towns.length, "Settlements", "t-location", S.meta.states.filter(x => x.i).length + " realms") : ""}
    </nav>
    <div class="hgrid">
      <div class="hmain">
        ${cont}
        ${card("hpartycard", "Party", ["characters", "All characters"], party)}
        ${card("", "Recently changed", ["library", "Library"], recentHtml)}
      </div>
      <aside class="hside">
        ${GM && todo ? card("htodocard", "Needs attention", null, `<ul class="htodo">${todo}</ul>`) : ""}
        ${sp ? card("t-creature hspotcard", "Creature of the day", ["bestiary", "Bestiary"], spotHtml) : ""}
        ${books.length ? card("hbookscard", "Books", ["books", "All books"], `<div class="hstack">${books.slice(0, 14).map(([id, b], i) => `<a href="#book-${esc(id)}" class="hbook st-${slugify(b.status || "")} hb${i % 5}" title="${esc(b.title || "Untitled")}${b.status ? " (" + esc(b.status) + ")" : ""}"><span>${esc(b.title || "Untitled")}</span></a>`).join("")}</div>${books.length > 14 ? `<p class="muted small">and ${books.length - 14} more</p>` : ""}`) : ""}
        ${S.meta && S.towns.length ? `<a class="hcard hworld" href="#world"><header><h2>${esc(S.meta.name || "World")}</h2><span class="hmore">Map →</span></header><div class="thumb">${worldSvg({ thumb: true })}</div></a>` : ""}
      </aside>
    </div>
  </div>`;
}

// ----- Library -----
function entryMatches(e, f, forcedType) {
  if (forcedType && e.type !== forcedType) return false;
  if (!forcedType && f.types.size && !f.types.has(e.type)) return false;
  if (f.tags.size) {
    const hits = [...f.tags].map(t => entryHasTagDeep(e, t));
    if (f.mode === "or" ? !hits.some(Boolean) : !hits.every(Boolean)) return false;
  }
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = [e.title, e.body, ...(e.tags || []).map(tagName)].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
function tagFilterHtml(f) {
  const tagTree = slugs => slugs.map(s => {
    const kids = children(s);
    return `<li><button class="ttag${f.tags.has(s) ? " on" : ""}" data-act="ftag" data-v="${esc(s)}" aria-pressed="${f.tags.has(s)}">${esc(tagName(s))}<span>${tagCount(s)}</span></button>${kids.length ? `<ul>${tagTree(kids)}</ul>` : ""}</li>`;
  }).join("");
  const roots = allTagSlugs().filter(s => !tagParent(s) || !allTagSlugs().includes(tagParent(s)));
  return `<div class="seg" role="group" aria-label="How tag filters combine"><button class="${f.mode !== "or" ? "on" : ""}" data-act="fmode" data-v="and" aria-pressed="${f.mode !== "or"}">Match all tags</button><button class="${f.mode === "or" ? "on" : ""}" data-act="fmode" data-v="or" aria-pressed="${f.mode === "or"}">Match any tag</button></div>
      <p class="muted small seghint">${f.mode === "or" ? "Shows entries with at least one of the tags you pick." : "Shows only entries that have every tag you pick."}</p>${roots.length ? `<ul class="tree">${tagTree(roots)}</ul>` : `<p class="muted small">Tags you add to entries appear here.</p>`}`;
}

// Compact tag picker: search, selected tags pinned on top, tags grouped by family as chips.
function tagPickerHtml(f, scopeType) {
  const B = S.beast;
  const scope = [...S.entries.values()].filter(e => !scopeType || e.type === scopeType);
  const cnt = slug => scope.filter(e => entryHasTagDeep(e, slug)).length;
  const used = allTagSlugs().map(s => [s, cnt(s)]).filter(([, n]) => n);
  const usedSet = new Set(used.map(x => x[0])), nOf = Object.fromEntries(used);
  const rootOf = s => { const a = ancestors(s).filter(x => usedSet.has(x)); return a.length ? a[a.length - 1] : s; };
  const groups = new Map();
  used.forEach(([s]) => { const r = rootOf(s); if (!groups.has(r)) groups.set(r, []); if (r !== s) groups.get(r).push(s); });
  const fams = [...groups.entries()].filter(([, kids]) => kids.length).sort((a, b) => nOf[b[0]] - nOf[a[0]] || byName(tagName(a[0]), tagName(b[0])));
  const loose = [...groups.entries()].filter(([, kids]) => !kids.length).map(([r]) => r).sort((a, b) => nOf[b] - nOf[a] || byName(tagName(a), tagName(b)));
  const chip = s => `<button type="button" class="pchip${f.tags.has(s) ? " on" : ""}" data-act="ftag" data-v="${esc(s)}" data-name="${esc(tagName(s).toLowerCase())}" aria-pressed="${f.tags.has(s)}">${esc(tagName(s))}<span>${nOf[s]}</span></button>`;
  const depthSort = (r, kids) => kids.sort((a, b) => ancestors(a).length - ancestors(b).length || nOf[b] - nOf[a] || byName(tagName(a), tagName(b)));
  const searching = !!B.tagQ;
  return `<div class="tpick">
    <input type="search" id="tagq" class="tagq" placeholder="Find a tag" value="${esc(B.tagQ)}" aria-label="Find a tag" autocomplete="off">
    <div class="seg" role="group" aria-label="How tag filters combine"><button type="button" class="${f.mode !== "or" ? "on" : ""}" data-act="fmode" data-v="and" aria-pressed="${f.mode !== "or"}">Match all</button><button type="button" class="${f.mode === "or" ? "on" : ""}" data-act="fmode" data-v="or" aria-pressed="${f.mode === "or"}">Match any</button></div>
    ${f.tags.size ? `<div class="tpsel"><span class="tplabel">Selected</span>${[...f.tags].map(s => `<button type="button" class="pchip on" data-act="ftag" data-v="${esc(s)}">${esc(tagName(s))} ✕</button>`).join("")}<button type="button" class="linkbtn" data-act="ftagsclear">Clear</button></div>` : ""}
    <div class="tpgroups">
      ${fams.map(([r, kids]) => `<details class="tpgroup" data-root="${esc(r)}"${searching || B.openGroups.has(r) || kids.some(k => f.tags.has(k)) ? " open" : ""}>
        <summary><span>${esc(tagName(r))}</span><span class="muted">${nOf[r]}</span></summary>
        <div class="tpchips">${chip(r).replace('class="pchip', 'class="pchip all')}${depthSort(r, kids).map(chip).join("")}</div>
      </details>`).join("")}
      ${loose.length ? `<div class="tpgroup flat"><div class="tplabel">Other tags</div><div class="tpchips">${loose.map(chip).join("")}</div></div>` : ""}
    </div>
    <p class="muted small tpempty" hidden>No tags match.</p>
    <div class="tpfoot"><button type="button" class="btn small" data-act="tpdone">Done</button></div>
  </div>`;
}
function filterTagPicker(q) {
  const box = document.querySelector(".tpick"); if (!box) return;
  const t = q.trim().toLowerCase(); let any = false;
  box.querySelectorAll(".tpgroup").forEach(g => {
    let hits = 0;
    g.querySelectorAll(".tpchips .pchip").forEach(c => { const ok = !t || c.dataset.name.includes(t); c.hidden = !ok; if (ok) hits++; });
    g.hidden = !hits; if (hits) any = true;
    if (g.tagName === "DETAILS") g.open = !!t || S.beast.openGroups.has(g.dataset.root) || !!g.querySelector(".pchip.on:not(.all)");
  });
  box.querySelector(".tpempty").hidden = any;
}

// ----- Bestiary: list + stat block side panel on big screens, compact rows on phones -----
const firstWord = v => String(v || "").trim().split(/\s+/)[0] || "";
function crNum(cr) { const w = firstWord(cr); if (!w) return -1; if (w.includes("/")) { const [a, b] = w.split("/").map(Number); return b ? a / b : -1; } const n = parseFloat(w); return isNaN(n) ? -1 : n; }
function hpNum(hp) { const n = parseInt(firstWord(hp), 10); return isNaN(n) ? -1 : n; }
// A tick box with three states: empty (either), ✓ with, ✕ without.
function triBtn(id, v, what) {
  v = Number(v) || 0;
  const label = v === 2 ? `Without ${what}` : `With ${what}`;
  return `<button type="button" class="tri s${v}" data-act="tri" data-v="${id}" title="Click to switch: either, with ${what}, without ${what}" aria-label="${v === 0 ? `Filter by ${what}: showing either` : label}"><span class="tribox" aria-hidden="true">${v === 1 ? "✓" : v === 2 ? "✕" : ""}</span>${label}</button>`;
}
function viewBestiary() {
  if (!S.loaded.entries && !S.offline) return loadingOr(false);
  const f = S.filter, B = S.beast;
  const allC = [...S.entries.entries()].filter(([, e]) => e.type === "creature");
  // Three-way filters: 0 = either, 1 = with, 2 = without. Clicking the box steps through them.
  const hasMat = e => Array.isArray(e.loot) && e.loot.some(x => x && (x.n || x.name || x.ref));
  const tri = (v, yes) => !v || (v === 1 ? yes : !yes);
  // Which books each creature is in: imported from (e.source) or inserted into a book's text.
  const books = [...S.books.entries()].filter(([, b]) => !READONLY || !b.hidden).map(([bid, b]) => ({ bid, title: b.title || "Untitled book", ids: new Set(embedIds(b.body)) }));
  const inBook = (id, e, bk) => e.source === bk.bid || bk.ids.has(id);
  const bookCount = bk => allC.filter(([id, e]) => inBook(id, e, bk)).length;
  const bookOpts = books.map(bk => Object.assign(bk, { n: bookCount(bk) })).filter(bk => bk.n).sort((a, b) => byName(a.title, b.title));
  if (B.book && B.book !== "__none" && !bookOpts.some(bk => bk.bid === B.book)) B.book = "";
  const bookOk = (id, e) => !B.book || (B.book === "__none" ? !books.some(bk => inBook(id, e, bk)) : inBook(id, e, books.find(bk => bk.bid === B.book)));
  let list = allC.filter(([id, e]) => entryMatches(e, f, "creature") && tri(B.sbOnly, !!e.statblock) && tri(B.mat, hasMat(e)) && tri(B.lore, !!String(e.body || "").trim()) && bookOk(id, e));
  const sorters = {
    name: (a, b) => byName(a[1].title, b[1].title),
    cr: (a, b) => crNum((b[1].statblock || {}).cr) - crNum((a[1].statblock || {}).cr) || byName(a[1].title, b[1].title),
    hp: (a, b) => hpNum((b[1].statblock || {}).hp) - hpNum((a[1].statblock || {}).hp) || byName(a[1].title, b[1].title)
  };
  list.sort(sorters[B.sort] || sorters.name);
  const sel = list.some(([id]) => id === B.sel) ? B.sel : (list[0] || [])[0];
  const active = [...f.tags].map(s => `<button class="tag on" data-act="ftag" data-v="${esc(s)}" title="Remove filter">${esc(tagName(s))} ✕</button>`).join("");
  const rows = list.map(([id, e]) => {
    const sb = e.statblock;
    const sub = sb && sb.subtitle ? sb.subtitle.replace(/,\s*[^,]*$/, "") : (e.tags || []).map(tagName).join(", ");
    return `<a class="brow${id === sel ? " on" : ""}${sb ? "" : " nosb"}${isUniqueCreature(e) ? " uniq" : ""}" href="#entry-${esc(id)}" data-act="beastsel" data-id="${esc(id)}">
      <span class="bmain"><span class="bname">${esc(e.title)}${e.hidden && !READONLY ? ` <span class="dmonly">DM only</span>` : ""}</span><span class="bsub">${esc(sub) || (e.body ? "Lore only" : "Not written yet")}</span></span>
      <span class="bstats">${sb ? `<span><b>AC</b>${esc(firstWord(sb.ac) || "—")}</span><span><b>HP</b>${esc(firstWord(sb.hp) || "—")}</span><span><b>CR</b>${esc(firstWord(sb.cr) || "—")}</span>` : `<span class="nostats">No stat block</span>`}</span>
    </a>`;
  }).join("");
  return `<section class="bestiary">
    <div class="libhead">
      <h1>Bestiary</h1>
      <div class="btools">
        <label class="search"><span class="sr">Search creatures</span><input id="libq" type="search" placeholder="Search creatures" value="${esc(f.q)}" data-input="libq"></label>
        <label class="bsort"><span class="sr">Sort by</span><select id="bsort" data-input="bsort"><option value="name"${B.sort === "name" ? " selected" : ""}>Sort: A to Z</option><option value="cr"${B.sort === "cr" ? " selected" : ""}>Sort: Challenge, highest first</option><option value="hp"${B.sort === "hp" ? " selected" : ""}>Sort: Hit points, highest first</option></select></label>
        <details class="filterpop" id="beasttags"${B.tagsOpen ? " open" : ""}><summary class="btn ghost">Tags${f.tags.size ? ` (${f.tags.size})` : ""}</summary><div class="pop">${tagPickerHtml(f, "creature")}</div></details>
        ${bookOpts.length ? `<label class="bbook"><span class="sr">Book</span><select data-input="bbook"><option value="">All books</option>${bookOpts.map(bk => `<option value="${esc(bk.bid)}"${B.book === bk.bid ? " selected" : ""}>${esc(bk.title)} (${bk.n})</option>`).join("")}<option value="__none"${B.book === "__none" ? " selected" : ""}>Not in any book</option></select></label>` : ""}
        ${triBtn("bsbonly", B.sbOnly, "stat blocks")}${triBtn("bmat", B.mat, "materials")}${triBtn("blore", B.lore, "lore")}
      </div>
      <p class="muted">${list.length} of ${allC.length} creatures ${active}${(f.tags.size || f.q || B.sbOnly || B.mat || B.lore || B.book) ? ` <button class="btn ghost small" data-act="fclear">Clear</button>` : ""}</p>
    </div>
    ${list.length ? `<div class="bview">
      <div class="blist" role="list">${rows}</div>
      <aside class="bdetail" id="bdetail" aria-live="polite">${sel ? beastDetail(sel) : ""}</aside>
    </div>` : `<div class="empty">${allC.length ? "No creatures match." : "No creatures yet."}</div>`}
  </section>`;
}
function beastDetail(id) {
  const e = S.entries.get(id); if (!e) return "";
  const sb = e.statblock;
  return `<div class="bdhead"><h2><a href="#entry-${esc(id)}">${esc(e.title)}</a></h2><a class="btn ghost small" href="#entry-${esc(id)}">Open full page →</a></div>
    <div class="tags">${(e.tags || []).map(s => tagChip(s)).join("")}</div>
    ${e.image ? `<div class="bdimg">${imageHtml(e.image, e.title, id)}</div>` : ""}
    ${sb ? `<div class="${isUniqueCreature(e) ? "sbunique" : ""}">${statBlockHtml(sb, e.title, "core")}</div>` + featuresHtml(sb, id) : `<p class="muted">No stat block yet.</p>`}
    ${ssEntryHtml(id, e)}
    ${lootHtml(e.loot, "Harvest table", creatureSizeNum(e))}
    ${e.body && e.body.trim() ? `<h3 class="sub">Lore</h3><div class="prose">${md(e.body, { entryId: id })}</div>` : ""}`;
}

function viewLibrary(bestiary) {
  if (!S.loaded.entries && !S.offline) return loadingOr(false);
  const f = S.filter, forced = bestiary ? "creature" : null;
  const all = [...S.entries.entries()];
  const list = all.filter(([, e]) => entryMatches(e, f, forced)).sort((a, b) => byName(a[1].title, b[1].title));
  const typeCounts = {}; all.forEach(([, e]) => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });

  const typeBar = bestiary ? "" : `<div class="typebar" role="group" aria-label="Filter by type">${TYPES.filter(t => typeCounts[t.id] || f.types.has(t.id)).map(t => `<button type="button" class="tchip t-${t.id}${f.types.has(t.id) ? " on" : ""}" data-act="ftype" data-v="${t.id}" aria-pressed="${f.types.has(t.id)}"><i aria-hidden="true"></i>${t.plural}<span>${typeCounts[t.id] || 0}</span></button>`).join("")}</div>`;
  const filtering = f.types.size || f.tags.size || f.q;
  const active = [...f.tags].map(s => `<button class="tag on" data-act="ftag" data-v="${esc(s)}" title="Remove filter">${esc(tagName(s))} ✕</button>`).join("");
  const cards = list.length ? list.map(([id, e]) => entryCard(id, e)).join("") :
    (S.entries.size ? `<div class="empty">Nothing matches these filters.</div>` :
      `<div class="empty"><p>Your codex is empty.</p><button class="btn" data-act="new">Write the first entry</button></div>`);
  return `
  <section class="libv">
    <div class="libhead">
      <div class="lhrow"><h1>${bestiary ? "Bestiary" : "Library"}</h1><span class="muted lhcount">${list.length} of ${bestiary ? (typeCounts.creature || 0) + " creatures" : all.length + " entries"}</span></div>
      <div class="btools libtools">
        <label class="search"><span class="sr">Search entries</span><input id="libq" type="search" placeholder="Search titles, text and tags" value="${esc(f.q)}" data-input="libq"></label>
        <details class="filterpop" id="libtags"${S.libTagsOpen ? " open" : ""}><summary class="btn ghost${f.tags.size ? " has" : ""}"><span aria-hidden="true">🏷</span> Tags${f.tags.size ? ` <b class="cnt">${f.tags.size}</b>` : ""} <span aria-hidden="true" class="caret">▾</span></summary><div class="pop">${allTagSlugs().length ? tagPickerHtml(f, forced) : `<p class="muted small">Tags you add to entries appear here.</p>`}</div></details>
        ${filtering ? `<button class="btn ghost small" data-act="fclear" title="Clear filters">Clear<span class="fclab"> filters</span></button>` : ""}
      </div>
      ${typeBar}
      ${f.tags.size ? `<p class="activetags"><span class="muted small">${f.mode === "or" ? "Any of" : "All of"}</span> ${active}</p>` : ""}
    </div>
    <div class="cards">${cards}</div>
  </section>`;
}
// Unique creatures (made from a token, or ticked Unique in the editor) glow like unique items.
const isUniqueCreature = e => !!e && e.type === "creature" && (e.unique != null ? !!e.unique : !!e.npcOf);
function entryCard(id, e) {
  const t = TYPE[e.type] || TYPE.general;
  const town = e.townId != null ? S.townById.get(e.townId) : null;
  const rar = e.item && e.item.rarity ? " rar-" + slugify(e.item.rarity) : isUniqueCreature(e) ? " rar-unique" : "";
  return `<a class="card t-${t.id}${rar}" href="#entry-${id}">
    <div class="cardtop"><span class="pill t-${t.id}">${t.id === "item" ? { weapon: "Weapon", armour: "Armour", item: "Item" }[itemKind(e)] : t.label}</span>${town ? `<span class="muted small">📍 ${esc(town.n)}</span>` : ""}${e.statblock && e.statblock.cr ? `<span class="cr">CR ${esc(e.statblock.cr)}</span>` : ""}${e.item && e.item.magical === false ? `<span class="rar mundane">Mundane</span>` : e.item && e.item.rarity ? `<span class="rar r-${slugify(e.item.rarity)}">${esc(e.item.rarity)}</span>` : ""}</div>
    <h2>${esc(e.title || "Untitled")}${e.hidden && !READONLY ? ` <span class="dmonly" title="Hidden from players">DM only</span>` : ""}</h2>
    ${itemStatShort(e) ? `<p class="istatshort">${esc(itemStatShort(e))}</p>` : ""}
    ${e.item && (e.item.meta || e.item.category) ? `<p class="imeta">${esc(e.item.category != null ? buildItemLine(e.item) : String(e.item.meta).replace(/,?\s*\[rarity\]/ig, ""))}${e.item.holder ? ` · ${esc(e.item.holder)}` : ""}</p>` : e.statblock && e.statblock.subtitle ? `<p class="imeta">${esc(e.statblock.subtitle)}</p>` : e.subclass ? `<p class="imeta">${esc(e.subclass.cls || "")} subclass · ${(e.subclass.features || []).length} features</p>` : e.partset ? `<p class="imeta">${((e.partset || {}).parts || []).length} harvested parts</p>` : e.cls ? `<p class="imeta">d${esc(e.cls.hd || 8)} hit die · ${(e.cls.features || []).length} features</p>` : e.race ? `<p class="imeta">${esc([e.race.size, e.race.speed].filter(Boolean).join(" · "))}</p>` : ""}
    <p>${esc(excerpt(String((e.item && e.item.lore) || e.body || "").replace(/\*?\\?\[flavour text\\?\]\*?/ig, ""), 150)) || `<span class="stub">${e.statblock ? "Stat block only" : "Not written yet"}</span>`}</p>
    <div class="tags">${(e.tags || []).map(s => `<span class="tag mini">${esc(tagName(s))}</span>`).join("")}</div>
  </a>`;
}

// ----- Entry -----
function viewEntry(id) {
  const e = S.entries.get(id);
  if (!e) return S.loaded.entries ? `<div class="empty">That entry no longer exists. <a href="#library">Back to the library</a></div>` : loadingOr(false);
  const t = TYPE[e.type] || TYPE.general;
  const town = e.townId != null ? S.townById.get(e.townId) : null;
  const own = e.tags || [];

  // Connected lore: for each own tag, then each ancestor (once), knowledge entries + fellow subjects.
  const order = [], via = {};
  own.forEach(s => { if (!order.includes(s)) { order.push(s); } });
  own.forEach(s => ancestors(s).forEach(a => { if (!order.includes(a)) { order.push(a); via[a] = s; } }));
  const shown = new Set([id]);
  const totalKnowledge = new Set([...S.entries.entries()].filter(([oid, o]) => oid !== id && !(TYPE[o.type] || {}).subject && (o.tags || []).some(t => order.includes(t))).map(([oid]) => oid)).size;
  const openAttr = totalKnowledge <= 3 ? " open" : "";
  const sections = order.map(slug => {
    const matches = [...S.entries.entries()].filter(([oid, o]) => oid !== id && (o.tags || []).includes(slug));
    const knowledge = matches.filter(([oid, o]) => !(TYPE[o.type] || {}).subject && !shown.has(oid));
    const fellows = matches.filter(([oid, o]) => (TYPE[o.type] || {}).subject);
    knowledge.forEach(([oid]) => shown.add(oid));
    if (!knowledge.length && !fellows.length) return "";
    return `<section class="rel">
      <h3>${tagChip(slug)} ${via[slug] ? `<span class="muted small">because ${esc(tagName(via[slug]))} is a kind of ${esc(tagName(slug))}</span>` : ""}</h3>
      ${knowledge.map(([oid, o]) => `<details class="relitem"${openAttr}><summary><a href="#entry-${oid}">${esc(o.title)}</a> <span class="pill t-${o.type}">${(TYPE[o.type] || TYPE.general).label}</span></summary><div class="prose">${md(o.body)}</div></details>`).join("")}
      ${fellows.length ? `<p class="fellows"><span class="muted small">Also ${esc(tagName(slug))}:</span> ${fellows.map(([oid, o]) => `<a href="#entry-${oid}" class="flink">${esc(o.title)}</a>`).join("")}</p>` : ""}
    </section>`;
  }).join("");

  const title = (e.title || "").toLowerCase();
  const backlinks = title ? [...S.entries.entries()].filter(([oid, o]) => oid !== id && (o.body || "").toLowerCase().includes("[[" + title)) : [];

  const back = e.type === "creature" ? ["bestiary", "Bestiary"] : e.type === "item" ? ["items", "Items"] : e.type === "spell" ? ["spells", "Spells"] : ["library", "Library"];
  return `<article class="entry${e.statblock && e.type === "creature" ? " wide" : ""}">
    <div class="crumbs"><a href="#${back[0]}">← ${back[1]}</a></div>
    <header class="ehead t-${t.id}">
      <span class="pill t-${t.id}">${t.label}</span>
      <h1${isUniqueCreature(e) ? ` class="uqtitle" title="A unique creature"` : ""}>${esc(e.title || "Untitled")}${isUniqueCreature(e) ? ` <span class="uqpill">Unique</span>` : ""}</h1>
      <div class="tags">${own.map(s => tagChip(s)).join("")}${own.length ? "" : `<span class="muted small">No tags yet. Tags connect this entry to the rest of your lore.</span>`}</div>
      ${e.fromBook && S.books.get(e.fromBook) ? `<p class="frombook"><span aria-hidden="true">📚</span> Written in <a href="#book-${esc(e.fromBook)}">${esc(S.books.get(e.fromBook).title)}</a>. Its title, tags and text come from the book, so edit it there.</p>` : ""}
      <div class="acts">${e.fromBook && S.books.get(e.fromBook) && !READONLY ? `<button class="btn" data-act="editinbook" data-id="${id}">Edit in the book</button><button class="btn ghost" data-act="edit" data-id="${id}" title="Picture and other details">Details</button>` : `<button class="btn" data-act="edit" data-id="${id}">Edit</button>`}${hideBtn(!!e.hidden, "togglehide", id)}<button class="btn ghost" data-act="del" data-id="${id}">Delete</button>${encToHtml(id, e)}</div>
    </header>
    ${e.example ? `<p class="note">Example entry. Edit it into your own lore or delete it.</p>` : ""}
    ${sourceLine(e)}
    ${inBooksLine(id)}
    ${town ? townCard(town) : ""}
    ${isHarvest(e) ? harvestPageHtml(id, e)
      : e.type === "item" ? itemPageHtml(id, e)
      : e.type === "spell" ? spellCardHtml(spellFromEntry(id, e), "", true)
      : e.type === "subclass" ? subclassHtml(id, e, true)
      : e.type === "race" ? raceHtml(id, e, true)
      : e.type === "class" ? classHtml(id, e, true)
      : e.type === "feat" ? featHtml(id, e, true)
      : e.type === "partset" ? partsetHtml(id, e)
      : e.type === "handout" ? handoutHtml(e, id)
      : e.statblock ? creatureHtml(id, e)
      : `${e.image ? portraitHtml(id, e) : ""}<div class="prose main">${md(e.body, { entryId: id }) || `<p class="muted">${e.type === "creature" ? "Not written yet. Edit this entry to add lore or a stat block." : "No text yet."}</p>`}</div>${e.type === "creature" ? lootHtml(e.loot, "Harvest table", creatureSizeNum(e)) : ""}`}
    ${sections ? `<h2 class="sect">Connected lore</h2>${openAttr ? "" : `<p class="muted small">Click a title to read it here, or open it as its own page.</p>`}${sections}` : ""}
    ${backlinks.length ? `<h2 class="sect">Mentioned in</h2><p>${backlinks.map(([oid, o]) => `<a href="#entry-${oid}" class="flink">${esc(o.title)}</a>`).join("")}</p>` : ""}
  </article>`;
}
function inBooksLine(id) {
  const books = [...S.books.entries()].filter(([bid, b]) => bid !== (S.entries.get(id) || {}).source && (!READONLY || !b.hidden) && embedIds(b.body).includes(id));
  return books.length ? `<p class="muted small inbooks">Appears in ${books.map(([bid, b]) => `<a href="#book-${esc(bid)}">${esc(b.title)}</a>`).join(", ")}</p>` : "";
}
// Two-tap delete for small controls inside the editor (the editor is itself a dialog).
function confirmInline(el) {
  if (el.dataset.armed === "1") return true;
  el.dataset.armed = "1"; el.textContent = "Sure?"; el.classList.add("armed");
  setTimeout(() => { if (el.isConnected) { el.dataset.armed = ""; el.textContent = "✕"; el.classList.remove("armed"); } }, 2500);
  return false;
}
function hideBtn(hidden, act, id) {
  return `<button class="btn ghost hidebtn${hidden ? " on" : ""}" data-act="${act}" data-id="${esc(id)}" aria-pressed="${hidden}" title="${hidden ? "Players won't see this in the read-only page you share" : "Players will see this in the read-only page you share"}">${hidden ? "🔒 Hidden from players" : "👁 Visible to players"}</button>`;
}
function portraitHtml(id, e) {
  const img = e.image ? imageHtml(e.image, e.title, id) : "";
  return `<div class="portrait${img ? "" : " empty"}">${img || `<span>No image yet</span>`}
    ${S.assets ? `<button class="btn ghost small" data-act="portrait" data-id="${esc(id)}">${e.image ? "Replace image" : "Add image"}</button>` : ""}</div>`;
}
function creatureHtml(id, e) {
  const sb = e.statblock;
  return `<div class="beast">
      ${portraitHtml(id, e)}
      <div class="${isUniqueCreature(e) ? "sbunique" : ""}">${statBlockHtml(sb, e.title, "core")}</div>
    </div>
    ${lootHtml(e.loot, "Harvest table", creatureSizeNum(e))}
    ${e.body && e.body.trim() ? `<h2 class="sect">Lore</h2><div class="prose main">${md(e.body, { entryId: id })}</div>` : ""}
    ${sb.features ? `<h2 class="sect">Traits and actions</h2>${featuresHtml(sb, id)}` : ""}
    ${ssEntryHtml(id, e)}`;
}
// Magic items, styled after the Google Docs style guide: Cinzel title in deep red, grey italic subtitle over a gold line,
// flavour text with a gold bar, property names in bold red italics.
function itemPageHtml(id, e) {
  const it = e.item || {}, r = slugify(it.rarity || "");
  const paras = String(e.body || "").split(/\n\s*\n/);
  let flavour = it.lore != null ? it.lore : "";
  if (it.lore == null && paras.length && /^\*[^*].*\*$/s.test(paras[0].trim()) && !/^\*[^*]+?\.\*\s/.test(paras[0].trim())) flavour = paras.shift().trim().replace(/^\*|\*$/g, "");
  if (/^\\?\[flavour text\\?\]$/i.test(flavour.trim())) flavour = "";
  const meta = it.category != null ? buildItemLine(it) : String(it.meta || "").replace(/,?\s*\[rarity\]/ig, "");
  const canEdit = !READONLY && S.db;
  return `<div class="itempage rar-${r}">
    <h2 class="ititle">${esc(e.title)}</h2>
    <p class="isub">${esc(meta)}${it.holder ? ` · Held by <a href="#items" data-act="holder" data-v="${esc(it.holder)}">${esc(it.holder)}</a>` : ""}</p>
    ${it.magical === false ? `<p class="irar"><span class="rar mundane">Mundane</span></p>` : it.rarity ? `<p class="irar"><span class="rar r-${r}">${esc(it.rarity)}</span></p>` : ""}
    ${e.image || (S.assets && canEdit) ? `<div class="iimg">${e.image ? imageHtml(e.image, e.title, id) : ""}${S.assets && canEdit ? `<button class="btn ghost small" data-act="portrait" data-id="${esc(id)}">${e.image ? "Replace image" : "Add image"}</button>` : ""}</div>` : ""}
    ${flavour.trim() ? `<div class="flavour">${md(flavour, { entryId: id })}</div>` : canEdit ? `<div class="iimg"><button class="btn ghost small" data-act="addlore" data-id="${esc(id)}">Add lore</button></div>` : ""}
    ${itemStatsHtml(it)}${itemResPreviewHtml(it)}
    <div class="iprops">${md(paras.join("\n\n"), { entryId: id })}</div>
    ${(it.props || []).length ? `<div class="wprops"><h3>Properties</h3>${it.props.map(p => { const d = PROP[p.id]; return d ? `<p><strong><em>${esc(d.name)}${p.param ? ` (${esc(propLabel(p).replace(/^[^(]*\(|\)$/g, ""))})` : ""}.</em></strong> ${esc(d.desc)}</p>` : ""; }).join("")}</div>` : ""}
  </div>`;
}
function townCard(town) {
  const st = stateOf(town.s), pv = town.p ? provOf(town.p) : null;
  return `<a class="towncard" href="#town-${town.i}"><strong>📍 ${esc(town.n)}</strong> <span class="muted">${esc(groupLabel(town.g))} · ${esc(pv ? pv.n + ", " : "")}${esc(st ? st.n : "")} · pop. ${fmt(town.pop)}</span><span class="go">Map details →</span></a>`;
}
function sourceLine(e) {
  if (!e.source) return "";
  const b = S.books.get(e.source);
  return `<p class="source muted small">From ${b ? `<a href="#book-${esc(e.source)}">${esc(b.title)}</a>` : esc(String(e.source).replace(/^Google Doc: /, "your Google Doc “") + (String(e.source).startsWith("Google Doc: ") ? "”" : ""))}</p>`;
}
const groupLabel = g => g ? g.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()) : "Settlement";

// ----- Tag page -----
function viewTag(slug) {
  if (!S.loaded.entries && !S.offline) return loadingOr(false);
  const anc = ancestors(slug).reverse();
  const kids = children(slug);
  const info = S.tags.get(slug) || {};
  const list = [...S.entries.entries()].filter(([, e]) => entryHasTagDeep(e, slug)).sort((a, b) => byName(a[1].title, b[1].title));
  const groups = TYPES.map(t => ({ t, items: list.filter(([, e]) => (e.type || "general") === t.id) })).filter(g => g.items.length);
  const town = townBySlug(slug);
  const st = S.meta && S.meta.states.find(s => slugify(s.n) === slug);
  return `<article class="entry">
    <div class="crumbs"><a href="#tags">← Tags</a>${anc.map(a => ` / ${tagChip(a)}`).join("")}</div>
    <header class="ehead">
      <span class="pill">Tag</span>
      <h1>${esc(tagName(slug))}</h1>
      ${kids.length ? `<div class="tags"><span class="muted small">Narrower tags:</span> ${kids.map(k => tagChip(k)).join("")}</div>` : ""}
      <div class="acts"><button class="btn" data-act="edittag" data-v="${esc(slug)}">Edit tag</button><button class="btn ghost" data-act="filtertag" data-v="${esc(slug)}">Filter library by this tag</button></div>
    </header>
    ${info.description ? `<div class="prose main">${md(info.description)}</div>` : ""}
    ${town ? townCard(town) : ""}
    ${st ? `<p><a class="flink" href="#world" data-act="worldstate" data-v="${st.i}">See all towns in ${esc(st.n)} on the map</a></p>` : ""}
    ${groups.length ? groups.map(g => `<h2 class="sect">${g.t.plural} <span class="muted small">${g.items.length}</span></h2><div class="cards">${g.items.map(([id, e]) => entryCard(id, e)).join("")}</div>`).join("")
      : `<div class="empty">No entries carry this tag yet.</div>`}
  </article>`;
}

// ----- Tags manager -----
function viewTags() {
  const slugs = allTagSlugs();
  const roots = slugs.filter(s => !tagParent(s) || !slugs.includes(tagParent(s)));
  const row = (s, depth) => `<li><div class="trow" style="--d:${depth}">
      ${tagChip(s)} <span class="muted small">${tagCount(s)} entr${tagCount(s) === 1 ? "y" : "ies"}</span>
      ${S.tags.has(s) ? "" : `<span class="muted small">(used on entries, not set up)</span>`}
      <span class="spacer"></span>
      <button class="btn ghost small" data-act="edittag" data-v="${esc(s)}">Edit</button>
    </div>${children(s).length ? `<ul>${children(s).map(k => row(k, depth + 1)).join("")}</ul>` : ""}</li>`;
  return `<section class="narrow">
    <h1>Tags</h1>
    <p class="muted">Give a tag a parent to build a family tree. If <em>Fire breather</em> sits under <em>Dragon</em>, every fire-breathing creature also picks up everything you've written about dragons.</p>
    <form class="newtag" data-form="newtag">
      <label for="nt-name">New tag</label><input id="nt-name" type="text" placeholder="e.g. Frost breather" required>
      <label for="nt-parent">Kind of</label><select id="nt-parent"><option value="">(top level)</option>${slugs.map(s => `<option value="${esc(s)}">${esc(tagName(s))}</option>`).join("")}</select>
      <button class="btn" type="submit">Add tag</button>
    </form>
    ${roots.length ? `<ul class="tagtree">${roots.map(s => row(s, 0)).join("")}</ul>` : `<div class="empty">No tags yet.</div>`}
  </section>`;
}

// ----- Town -----
function regionTags(town) {
  const st = stateOf(town.s), pv = town.p ? provOf(town.p) : null, cu = cultureOf(town.c), re = town.r ? religionOf(town.r) : null;
  return [[town.n, "this town"], [pv && pv.n, "province"], [st && st.i ? st.n : null, "realm"], [cu && cu.i ? cu.n : null, "culture"], [re && re.i ? re.n : null, "faith"]]
    .filter(x => x[0]).map(([n, k]) => ({ slug: slugify(n), name: n, kind: k }));
}
function viewTown(i) {
  if (!S.meta) return S.loaded.meta ? `<div class="empty">No map imported yet. <a href="#world">Import your .map file</a></div>` : loadingOr(false);
  const town = S.townById.get(i);
  if (!town) return `<div class="empty">That settlement isn't in the imported map. <a href="#world">Back to the world</a></div>`;
  const st = stateOf(town.s), pv = town.p ? provOf(town.p) : null, cu = cultureOf(town.c), re = town.r ? religionOf(town.r) : null;
  const linked = [...S.entries.entries()].filter(([, e]) => e.townId === i);
  const rt = regionTags(town);
  const regional = rt.map(t => ({ ...t, items: [...S.entries.entries()].filter(([id, e]) => e.townId !== i && entryHasTagDeep(e, t.slug)) })).filter(t => t.items.length);
  const maxU = town.pr ? Math.max(...town.pr.map(p => p[1])) : 1;
  const facts = [
    ["Realm", st ? (st.i ? `<a href="#world" data-act="worldstate" data-v="${st.i}">${esc(st.full)}</a>` : esc(st.n)) : "—"],
    ["Province", pv ? esc(pv.full) : "—"],
    ["Culture", cu ? esc(cu.n) : "—"],
    ["Faith", re ? esc(re.n) : "—"],
    ["Population", fmt(town.pop)],
    ["Settlement", esc(groupLabel(town.g)) + (town.t && town.t !== "Generic" ? ` · ${esc(town.t)}` : "")]
  ];
  const dist = S.meta.distScale ? ` · ${fmt(Math.round(town.x * S.meta.distScale))} ${esc(S.meta.distUnit || "")} east, ${fmt(Math.round(town.y * S.meta.distScale))} ${esc(S.meta.distUnit || "")} south of the map's corner` : "";
  return `<article class="entry">
    <div class="crumbs"><a href="#world">← World of ${esc(S.meta.name)}</a></div>
    <header class="ehead t-location">
      <span class="pill t-location">${esc(groupLabel(town.g))}</span>
      <h1>${esc(town.n)}</h1>
      <div class="tags">${(town.f || []).map(f => `<span class="tag mini feat">${esc(f)}</span>`).join("")}</div>
      <div class="acts"><button class="btn" data-act="newtown" data-v="${i}">Write lore for ${esc(town.n)}</button></div>
    </header>
    <div class="towngrid">
      <div>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        ${town.pr ? `<h3 class="sub">Produces</h3><ul class="prod">${town.pr.map(([g, u]) => `<li><span>${esc(goodName(g))}</span><span class="bar"><i style="width:${Math.max(6, (u / maxU) * 100)}%"></i></span><span class="num">${u}</span></li>`).join("")}</ul><p class="muted small">Units of output per turn in your map's trade simulation.</p>` : ""}
        ${town.note ? `<h3 class="sub">Your map note</h3><div class="prose"><p>${esc(town.note)}</p></div>` : ""}
      </div>
      <div>${worldSvg({ focus: i, small: true })}<p class="muted small">Map position${dist}</p></div>
    </div>
    <h2 class="sect">Lore about ${esc(town.n)}</h2>
    ${linked.length ? `<div class="cards">${linked.map(([id, e]) => entryCard(id, e)).join("")}</div>` : `<p class="muted">Nothing written yet. Lore you link to ${esc(town.n)} shows here and on its map entry.</p>`}
    ${regional.map(t => `<h2 class="sect">${tagChip(t.slug)} <span class="muted small">${t.kind}</span></h2><div class="cards">${t.items.map(([id, e]) => entryCard(id, e)).join("")}</div>`).join("")}
    <p class="muted small hint">Tag an entry with ${rt.slice(1).map(t => `<em>${esc(t.name)}</em>`).join(", ")} and it will show on every town there.</p>
  </article>`;
}

// ----- World -----
function filteredTowns() {
  const w = S.world, q = w.q.toLowerCase();
  return S.towns.filter(t =>
    (!q || t.n.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q)) &&
    (!w.state || t.s === Number(w.state)) && (!w.prov || t.p === Number(w.prov)) &&
    (!w.culture || t.c === Number(w.culture)) && (!w.group || t.g === w.group) &&
    (!w.good || (t.pr || []).some(p => p[0] === Number(w.good))));
}
function worldSvg({ focus, small, matchSet, thumb }) {
  const m = S.meta, W = m.w, H = m.h;
  const stateColor = {}; m.states.forEach(s => { stateColor[s.i] = s.i ? s.color : "#8a8578"; });
  const rad = g => ({ capital: 6, city: 4, fort: 3.2, town: 2.6, village: 1.8, hamlet: 1.5 }[g] || 2.4);
  const towns = S.towns.slice().sort((a, b) => rad(a.g) - rad(b.g));
  const dots = towns.map(t => {
    const on = matchSet ? matchSet.has(t.i) : true;
    const isF = focus === t.i;
    const r = rad(t.g) * (small ? 1.4 : 1);
    return `<circle cx="${t.x}" cy="${t.y}" r="${isF ? r + 4 : r}" fill="${esc(stateColor[t.s] || "#888")}" class="dot${on ? "" : " dim"}${isF ? " focus" : ""}${t.g === "capital" ? " cap" : ""}" data-town="${t.i}"><title>${esc(t.n)} (${esc(groupLabel(t.g))}, pop. ${fmt(t.pop)})</title></circle>`;
  }).join("");
  const marks = (!small && !thumb && S.world.showMarkers) ? (m.markers || []).map(k => `<rect x="${k.x - 3}" y="${k.y - 3}" width="6" height="6" transform="rotate(45 ${k.x} ${k.y})" class="mark" data-marker="${k.i}"><title>${esc(k.n)}: ${esc(k.note || k.t)}</title></rect>`).join("") : "";
  const f = focus != null ? S.townById.get(focus) : null;
  const vb = small && f ? `${Math.max(0, f.x - 260)} ${Math.max(0, f.y - 150)} 520 300` : `0 0 ${W} ${H}`;
  return `<div class="mapwrap${small ? " small" : ""}"><svg id="worldmap" viewBox="${vb}" role="img" aria-label="Map of ${esc(m.name)} with settlements coloured by realm">
    <rect width="${W}" height="${H}" class="sea"></rect>
    <image id="land" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" href="${S.landImg && S.landKey === m.importId ? S.landImg : ""}"></image>
    ${marks}${dots}
  </svg></div>`;
}
function drawLand() {
  const m = S.meta; if (!m || !m.grid) return;
  if (S.landKey !== m.importId) {
    const { cx, cy, h } = m.grid, c = document.createElement("canvas");
    c.width = cx; c.height = cy;
    const ctx = c.getContext("2d"), img = ctx.createImageData(cx, cy);
    const cs = getComputedStyle(document.documentElement);
    const hex = v => { const s = cs.getPropertyValue(v).trim().replace("#", ""); return [0, 2, 4].map(k => parseInt(s.slice(k, k + 2), 16)); };
    const lo = hex("--land"), hi = hex("--land-hi");
    for (let k = 0; k < cx * cy; k++) {
      const v = Number(h[k] || 0), o = k * 4;
      if (!v) { img.data[o + 3] = 0; continue; }
      const a = Math.min(1, (v - 1) / 7);
      img.data[o] = lo[0] + (hi[0] - lo[0]) * a; img.data[o + 1] = lo[1] + (hi[1] - lo[1]) * a; img.data[o + 2] = lo[2] + (hi[2] - lo[2]) * a; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    S.landImg = c.toDataURL(); S.landKey = m.importId;
  }
  const im = document.getElementById("land"); if (im) im.setAttribute("href", S.landImg);
}
function viewWorld() {
  const importBox = `<div class="importbox">
      <label class="btn${S.meta ? " ghost" : ""}" for="mapfile">${S.meta ? "Re-import .map file" : "Import your Azgaar .map file"}</label>
      <input id="mapfile" type="file" accept=".map" data-input="mapfile" class="sr">
      <span id="importstatus" class="muted small">${S.meta ? `${fmt(S.meta.townCount)} settlements from “${esc(S.meta.fileName || S.meta.name)}”, imported ${esc(new Date(S.meta.importedAt).toLocaleDateString())}. Re-importing keeps all your lore.` : "Your map stays in your codex. Lore you write is kept separately, so you can re-import an updated map at any time."}</span>
    </div>`;
  if (!S.meta) return S.loaded.meta || S.offline ? `<section class="narrow"><h1>World</h1><p class="muted">Bring in the towns, realms and trade goods from your Azgaar Fantasy Map Generator save.</p>${importBox}</section>` : loadingOr(false);
  if (S.towns.length < S.meta.townCount * 0.9) return `<section class="narrow"><h1>${esc(S.meta.name)}</h1><div class="empty">Loading settlements…</div>${importBox}</section>`;
  const w = S.world, m = S.meta;
  const list = filteredTowns();
  const matchSet = new Set(list.map(t => t.i));
  const sortKey = {
    name: t => t.n, size: t => GROUP_ORDER.indexOf(t.g) < 0 ? 99 : GROUP_ORDER.indexOf(t.g),
    prov: t => (t.p && provOf(t.p) || {}).n || "", realm: t => (stateOf(t.s) || {}).n || "", pop: t => t.pop
  }[w.sort] || (t => t.pop);
  const sorted = list.slice().sort((a, b) => {
    const x = sortKey(a), y = sortKey(b);
    let c = typeof x === "number" ? x - y : (x === "" ? 1 : 0) - (y === "" ? 1 : 0) || byName(x, y);
    if (!c) c = b.pop - a.pop;
    return c * w.dir;
  });
  const th = (key, label, cls) => {
    const on = w.sort === key, arrow = on ? (w.dir === 1 ? "▲" : "▼") : "";
    return `<th class="${cls || ""}" aria-sort="${on ? (w.dir === 1 ? "ascending" : "descending") : "none"}"><button class="sorth${on ? " on" : ""}" data-act="wsort" data-v="${key}">${label}<span class="arr">${arrow}</span></button></th>`;
  };
  const opts = (arr, val, all) => `<option value="">${all}</option>` + arr.map(o => `<option value="${o.v}"${String(o.v) === String(val) ? " selected" : ""}>${esc(o.l)}</option>`).join("");
  const states = m.states.filter(s => s.i).map(s => ({ v: s.i, l: s.n })).sort((a, b) => byName(a.l, b.l));
  const provs = m.provinces.filter(p => !w.state || p.s === Number(w.state)).map(p => ({ v: p.i, l: p.n })).sort((a, b) => byName(a.l, b.l));
  const cultures = m.cultures.filter(c => c.i).map(c => ({ v: c.i, l: c.n }));
  const goods = (m.goods || []).map(g => ({ v: g.i, l: g.n })).sort((a, b) => byName(a.l, b.l));
  const groups = GROUP_ORDER.filter(g => S.towns.some(t => t.g === g)).map(g => ({ v: g, l: groupLabel(g) }));
  const legend = m.states.filter(s => s.i).map(s => `<button class="lg${String(w.state) === String(s.i) ? " on" : ""}" data-act="worldstate" data-v="${s.i}"><i style="background:${esc(s.color)}"></i>${esc(s.n)} <span>${S.towns.filter(t => t.s === s.i).length}</span></button>`).join("");
  const loreCount = id => [...S.entries.values()].filter(e => e.townId === id).length;
  const rows = sorted.slice(0, w.limit).map(t => {
    const st = stateOf(t.s), pv = t.p ? provOf(t.p) : null, lc = loreCount(t.i);
    return `<tr data-town="${t.i}" tabindex="0"><td><a href="#town-${t.i}">${esc(t.n)}</a>${lc ? ` <span class="pill t-location small">${lc} lore</span>` : ""}${t.note ? ` <span class="muted small" title="Has a map note">✎</span>` : ""}</td><td>${esc(groupLabel(t.g))}</td><td>${esc(pv ? pv.n : "")}</td><td>${esc(st ? st.n : "")}</td><td class="num">${fmt(t.pop)}</td><td class="muted">${t.pr ? esc(t.pr.slice(0, 3).map(p => goodName(p[0])).join(", ")) : ""}</td></tr>`;
  }).join("");
  const markerTypes = {}; (m.markers || []).forEach(k => { (markerTypes[k.t] = markerTypes[k.t] || []).push(k); });
  return `<section>
    <div class="libhead"><h1>${esc(m.name)}</h1><p class="muted">${fmt(S.towns.length)} settlements across ${m.states.filter(s => s.i).length} realms${m.year ? ` · Year ${esc(m.year)} ${esc(m.era || "")}` : ""}</p></div>
    ${worldSvg({ matchSet: list.length === S.towns.length ? null : matchSet })}
    <div class="legend">${legend}<label class="lg"><input type="checkbox" id="showmarkers" data-input="showmarkers"${w.showMarkers ? " checked" : ""}> Points of interest</label></div>
    <div class="wfilters">
      <label><span>Search</span><input id="wq" type="search" placeholder="Town name or note" value="${esc(w.q)}" data-input="wq"></label>
      <label><span>Realm</span><select id="wstate" data-input="wstate">${opts(states, w.state, "All realms")}</select></label>
      <label><span>Province</span><select id="wprov" data-input="wprov">${opts(provs, w.prov, "All provinces")}</select></label>
      <label><span>Culture</span><select id="wculture" data-input="wculture">${opts(cultures, w.culture, "All cultures")}</select></label>
      <label><span>Produces</span><select id="wgood" data-input="wgood">${opts(goods, w.good, "Any goods")}</select></label>
      <label><span>Size</span><select id="wgroup" data-input="wgroup">${opts(groups, w.group, "Any size")}</select></label>
    </div>
    <p class="muted small">${fmt(list.length)} settlements match. Click a column heading to sort; click again to reverse.</p>
    <div class="tablewrap"><table class="towns"><thead><tr>${th("name", "Settlement")}${th("size", "Size")}${th("prov", "Province")}${th("realm", "Realm")}${th("pop", "Population", "num")}<th>Main goods</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${sorted.length > w.limit ? `<button class="btn ghost" data-act="more">Show ${Math.min(200, sorted.length - w.limit)} more</button>` : ""}
    ${Object.keys(markerTypes).length ? `<h2 class="sect">Points of interest</h2><div class="markers">${Object.entries(markerTypes).sort((a, b) => byName(a[0], b[0])).map(([t, ks]) => `<details><summary>${esc(pretty(t))} <span class="muted small">${ks.length}</span></summary><ul>${ks.map(k => `<li><strong>${esc(k.n)}</strong> <span class="muted">${esc(k.note || "")}</span></li>`).join("")}</ul></details>`).join("")}</div>` : ""}
    <h2 class="sect">Map file</h2>${importBox}
  </section>`;
}

// ----- Library file -----
function viewBackup() {
  return `<section class="narrow">
    <h1>Library file</h1>
    ${SERVER ? `<p class="muted">This codex runs from your <strong>DnDCodex</strong> folder. Everything saves into <code>library.json</code> there, with pictures in its <code>images</code> folder and a dated copy in <code>backups</code> each day.</p>${srvLinksHtml()}${srvPinHtml()}`
      : GH ? `<p class="muted">This is the web version. Your library is kept on this device (so it works offline) and synced with your private GitHub repository, which your PC also syncs with.</p><div id="ghmbox">${ghmPanelInner()}</div>`
      : LOCAL ? `<p class="muted">This copy saves everything into <code>library.json</code> in your <strong>${esc(LF.dir ? LF.dir.name : "DnDCodex")}</strong> folder as you work, with pictures in its <code>images</code> folder. A copy of the previous version is kept as <code>library.backup.json</code> each time you open it.</p>`
      : `<p class="muted">Everything lives in the codex itself now: entries, tags, books, items and your map. Edits save straight into it and show on every device you open it on. Nothing is read from Google Docs any more.</p>`}
    <p class="muted">For a copy you hold yourself, download a library file whenever you like. It's one JSON file with everything in it, and loading it back restores the codex.</p>
    <div class="row">
      ${S.downloads ? `<button class="btn" data-act="dllibrary">Download library file</button>` : ""}
      <button class="btn ghost" data-act="copybackup">Copy to clipboard</button>
      <span class="muted small">${S.entries.size} entries · ${S.tags.size} tags · ${S.books.size} books${S.meta ? ` · ${fmt(S.towns.length)} settlements` : ""}</span>
    </div>
    <h2 class="sect">Load a library file</h2>
    <p class="muted small">Adds or overwrites entries, tags and books with the same id. Nothing else is deleted.</p>
    <div class="row"><label class="btn ghost" for="libfile">Choose library file…</label><input id="libfile" type="file" accept=".json,application/json" data-input="libfile" class="sr"></div>
    <details><summary class="muted small">Or paste a backup</summary>
      <textarea id="restore" rows="6" placeholder="Paste a backup here"></textarea>
      <button class="btn ghost" data-act="restore">Restore from pasted text</button>
    </details>
  </section>`;
}

// ----- Magic items -----
// Every word typed has to appear somewhere: name, category, rarity, holder, item line, lore or description.
function itemMatchesQ(e, q) {
  if (!q) return true;
  const it = e.item || {}, hay = [e.title, e.body, it.meta, it.category, it.base, it.rarity, it.holder, it.lore, (e.tags || []).join(" ")].join(" ").toLowerCase();
  return q.split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
let ITEMQ_T = null;
document.addEventListener("input", ev => {
  if (ev.target.id !== "itemq") return;
  S.items.q = ev.target.value; clearTimeout(ITEMQ_T);
  ITEMQ_T = setTimeout(() => { const pos = ev.target.selectionStart; render(); const n = $("#itemq"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 160);
});
function viewItems() {
  if (!S.loaded.entries && !S.offline) return loadingOr(false);
  const allItems = [...S.entries.entries()].filter(([, e]) => e.type === "item");
  const parts = allItems.filter(([, e]) => isHarvest(e)), all = allItems.filter(([, e]) => !isHarvest(e));
  const holders = [...new Set(all.map(([, e]) => (e.item && e.item.holder) || "").filter(Boolean))].sort(byName);
  const h = S.items.holder, rr = S.items.rarity, q = String(S.items.q || "").trim().toLowerCase();
  const rarOf = e => ((e.item && e.item.rarity) || "").toLowerCase();
  const kk = S.items.kind, mg = S.items.magic;
  const magOk = e => !mg || (mg === "magical" ? isMagical(e) : !isMagical(e));
  const list = all.filter(([, e]) => magOk(e) && (!kk || itemKind(e) === kk) && (!h || (e.item && e.item.holder) === h) && (!rr || (rr === "none" ? !rarOf(e) : rarOf(e) === rr)) && itemMatchesQ(e, q))
    .sort((a, b) => (q ? (a[1].title.toLowerCase().includes(q) ? 0 : 1) - (b[1].title.toLowerCase().includes(q) ? 0 : 1) : 0) || byName(a[1].title, b[1].title));
  const kcount = k => all.filter(([, e]) => itemKind(e) === k && magOk(e)).length;
  const mcount = m => all.filter(([, e]) => (m === "magical" ? isMagical(e) : !isMagical(e))).length;
  const rcount = r => all.filter(([, e]) => (r === "none" ? !rarOf(e) : rarOf(e) === r)).length;
  const rarOpts = [...RARITIES.filter(Boolean), "none"].filter(r => rcount(r) || r === rr);
  return `<section>
    <div class="libhead">
      <h1>Items</h1>
      <p class="muted">${mg === "harvest" ? `${parts.length} harvested part${parts.length === 1 ? "" : "s"}` : `${list.length} of ${all.length} items`}${READONLY ? "" : ` · <a href="#srd">Add standard equipment from the SRD →</a>`}</p>
      <div class="segrow">
      <div class="seg kindseg" role="group" aria-label="Magical or mundane"><button class="${!mg ? "on" : ""}" data-act="imagic" data-v="" aria-pressed="${!mg}">All <span>${all.length}</span></button><button class="${mg === "magical" ? "on" : ""}" data-act="imagic" data-v="magical" aria-pressed="${mg === "magical"}">✦ Magical <span>${mcount("magical")}</span></button><button class="${mg === "mundane" ? "on" : ""}" data-act="imagic" data-v="mundane" aria-pressed="${mg === "mundane"}">Mundane <span>${mcount("mundane")}</span></button><button class="${mg === "harvest" ? "on" : ""}" data-act="imagic" data-v="harvest" aria-pressed="${mg === "harvest"}">Harvested parts <span>${parts.length}</span></button></div>
      ${mg === "harvest" ? "" : `
      <div class="seg kindseg" role="group" aria-label="Kind of item"><button class="${!kk ? "on" : ""}" data-act="ikind" data-v="" aria-pressed="${!kk}">All kinds <span>${all.filter(([, e]) => magOk(e)).length}</span></button>${ITEM_KINDS.map(([k, l]) => `<button class="${kk === k ? "on" : ""}" data-act="ikind" data-v="${k}" aria-pressed="${kk === k}">${l} <span>${kcount(k)}</span></button>`).join("")}</div>
      </div>
      </div>`}
      <label class="search big itemsearch"><span class="sr">Search items</span><input id="itemq" type="search" placeholder="Search items, e.g. ring, +1, rare, Vakryn" value="${esc(S.items.q || "")}" autocomplete="off"></label>
      ${mg === "harvest" ? "" : `<div class="itemfilters">
        <label class="rarsel"><span>Rarity</span><select id="irar" data-input="irar"><option value="">All rarities</option>${rarOpts.map(r => `<option value="${esc(r)}"${rr === r ? " selected" : ""}>${r === "none" ? "No rarity set" : esc(r[0].toUpperCase() + r.slice(1))} (${rcount(r)})</option>`).join("")}</select></label>
      <div class="chiprow"><button class="lg${!h ? " on" : ""}" data-act="holder" data-v="">Everyone</button>${holders.map(x => `<button class="lg${h === x ? " on" : ""}" data-act="holder" data-v="${esc(x)}">${esc(x)} <span>${all.filter(([, e]) => e.item && e.item.holder === x).length}</span></button>`).join("")}</div>
      </div>`}
    </div>
    ${mg === "harvest" ? harvestListHtml(parts, q) : `
    ${!list.length ? `<div class="cards"><div class="empty"><p>${all.length ? "No items match." : "No items yet."}</p>${all.length ? "" : `<button class="btn" data-act="new" data-type="item">Add an item</button>`}</div></div>`
      : kk ? `<div class="cards">${list.map(([id, e]) => entryCard(id, e)).join("")}</div>`
      : ITEM_KINDS.map(([k, l]) => { const g = list.filter(([, e]) => itemKind(e) === k); return g.length ? `<h2 class="sect">${l} <span class="muted small">${g.length}</span></h2><div class="cards">${g.map(([id, e]) => entryCard(id, e)).join("")}</div>` : ""; }).join("")}
      ${(!mg || mg === "mundane") && !kk && !h && !rr ? harvestListHtml(parts, q, true) : ""}`}
  </section>`;
}

// ----- Books -----
function viewBooks() {
  if (!S.loaded.books && !S.offline) return loadingOr(false);
  const all = [...S.books.entries()].sort((a, b) => (a[1].order || 0) - (b[1].order || 0) || byName(a[1].title, b[1].title));
  const groups = BOOK_STATUS.map(st => ({ st, items: all.filter(([, b]) => (b.status || "Planned") === st) })).filter(g => g.items.length);
  const firstPara = b => excerpt(String(b.body || "").split(/\n\n/).find(p => p.trim() && !p.startsWith("#") && !p.startsWith("|") && !p.startsWith("[")) || "", 170);
  return `<section>
    <div class="libhead"><h1>Supplement books</h1><p class="muted">${all.length} books · ${fmt(all.reduce((n, [, b]) => n + (b.words || 0), 0))} words</p>
      <div><button class="btn ghost" data-act="newbook">+ New book</button></div></div>
    ${groups.length ? groups.map(g => `<h2 class="sect">${g.st} <span class="muted small">${g.items.length}</span></h2>
      <div class="shelf">${g.items.map(([id, b]) => `<a class="bookcard st-${slugify(b.status)}" href="#book-${esc(id)}"><span class="spine"></span><div><h3>${esc(b.title)}${b.hidden && !READONLY ? ` <span class="dmonly">DM only</span>` : ""}</h3><p>${esc(firstPara(b)) || `<span class="stub">Nothing written yet</span>`}</p><span class="muted small">${fmt(b.words || 0)} words</span></div></a>`).join("")}</div>`).join("")
      : `<div class="empty">No books yet.</div>`}
    ${sourceShelfHtml()}
  </section>`;
}
const BOOK_HTML = {};
function viewBook(id) {
  const b = S.books.get(id) || srdBook(id);
  if (!b) return S.loaded.books ? `<div class="empty">That book no longer exists. <a href="#books">Back to the shelf</a></div>` : loadingOr(false);
  let toc = [], html;
  if (b.base && BOOK_HTML[id]) ({ toc, html } = BOOK_HTML[id]);
  else { html = md(b.body, { base: 1, toc, linkEntries: !b.base }); if (b.base) BOOK_HTML[id] = { toc, html }; }
  const inBody = new Set(embedIds(b.body));
  const related = [...S.entries.entries()].filter(([eid, e]) => e.source === id && !inBody.has(eid)).sort((x, y) => byName(x[1].title, y[1].title));
  return `<div class="bookview">
    <aside class="toc"><a href="#books">← All books</a>
      ${toc.length ? `<h3>Contents</h3><ol>${toc.map(t => `<li class="l${t.level}"><button data-act="toc" data-v="${t.id}">${esc(t.text)}</button></li>`).join("")}</ol>` : ""}
    </aside>
    <article class="book">
      <header class="ehead">${b.base ? `<span class="srcpill">Source · SRD 5.1</span>` : `<span class="pill">${esc(b.status || "Planned")}</span>`}<h1>${esc(b.title)}</h1>
        <div class="acts">${b.base ? "" : `<a class="btn" href="#bookedit-${esc(id)}">Edit book</a>${hideBtn(!!b.hidden, "togglebookhide", id)}`}<span class="muted small">${fmt(b.words || 0)} words</span></div></header>
      ${b.base ? SRD_CREDIT : ""}
      <div class="prose bookprose">${html || `<p class="muted">Nothing written yet.</p>`}</div>
      ${related.length ? `<h2 class="sect">Entries from this book <span class="muted small">${related.length}</span></h2><div class="cards">${related.map(([eid, e]) => entryCard(eid, e)).join("")}</div>` : ""}
    </article>
  </div>`;
}
function openBookEditor(id) {
  const b = id ? S.books.get(id) : { title: "", status: "Planned", body: "" };
  openModal(`<h2>${id ? "Edit book" : "New book"}</h2>
    <form data-form="book" data-id="${esc(id || "")}">
      <div class="frow"><label class="grow"><span>Title</span><input id="bk-title" type="text" required value="${esc(b.title)}"></label>
      <label><span>Status</span><select id="bk-status">${BOOK_STATUS.map(st => `<option${st === b.status ? " selected" : ""}>${st}</option>`).join("")}</select></label></div>
      <div class="field"><span class="flabel">Text</span><textarea id="bk-body" rows="20">${esc(b.body)}</textarea></div>
      <label class="check"><input id="bk-hidden" type="checkbox"${b.hidden ? " checked" : ""}> Hide this book from players</label>
      <p class="muted small">Headings build the contents list. Tables and stat blocks show as locked blocks; use the Markdown button to edit those.</p>
      <div class="acts"><button class="btn" type="submit">Save book</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button>${id ? `<span class="spacer"></span><button class="btn danger small" type="button" data-act="delbook" data-v="${esc(id)}">Delete book</button>` : ""}</div>
    </form>`, () => richify($("#bk-body"), { base: 1 }));
}

// ----- Images -----
const assetPath = res => (LOCAL ? res.url : "/_blob/" + res.id);
function pickImage(onDone) {
  // onDone(res, file): the file is passed too, so callers can read its name.
  if (!S.assets) { toast("Image uploads aren't available in this view.", "bad"); return; }
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp,image/gif";
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    toast("Uploading " + f.name + "…");
    try { const res = await S.assets.upload(f); await onDone(res, f); }
    catch (err) {
      const c = err && err.code;
      toast(c === "too_large" ? "That image is over 20 MB. Try a smaller one." : c === "unsupported_type" ? "Use a PNG, JPEG, WebP or GIF image." : c === "quota_or_state" ? "The codex's image storage is full." : "Upload failed (" + (c || "error") + "). Try again.", "bad");
    }
  };
  inp.click();
}

// ----- One-time fixes shipped with the page -----
// The Dragon Warden section of "The Art of Not Dying to a Dragon" becomes a subclass entry embedded in the book,
// so Draeden's sheet can use it and it's only written in one place. The old section text is kept in settings/backups.
async function migrateDragonWarden() {
  if (migrating || MIG_DONE.dragonWarden) return;
  migrating = true; MIG_DONE.dragonWarden = true;
  try {
    const bid = "bthe-art-of-not-dying-to-a-dragon", b = S.books.get(bid), eid = "subclass-dragon-warden";
    const lines = String((b && b.body) || "").split("\n");
    const start = lines.findIndex(l => /^##\s+Ranger subclass:\s*Dragon Warden/i.test(l.trim()));
    if (!b || start < 0 || S.entries.has(eid)) { await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { dragonWarden: true })); return; }
    let end = start + 1; while (end < lines.length && !/^#(\s|$)/.test(lines[end])) end++;
    const sec = lines.slice(start + 1, end);
    const desc = [], feats = []; let cur = null;
    for (const l of sec) {
      const h = l.match(/^###\s+(.+)$/);
      if (h) { cur = { n: h[1].trim(), lv: 0, d: [] }; feats.push(cur); continue; }
      (cur ? cur.d : desc).push(l);
    }
    let lastLv = 3;
    const features = feats.map(f => {
      const d = f.d.join("\n").trim(), m = d.match(/(\d+)(?:st|nd|rd|th)\s+level|level\s+(\d+)/i);
      const lv = m ? Number(m[1] || m[2]) : lastLv; lastLv = lv;
      return { n: f.n, lv, d };
    });
    const now = new Date().toISOString();
    await S.db.doc("entries/" + eid).set({ title: "Dragon Warden", type: "subclass", tags: [], body: desc.join("\n").trim(), subclass: { cls: "Ranger", features }, source: bid, created: now, updated: now });
    await S.db.doc("settings/backups").set({ dragonWardenSection: lines.slice(start, end).join("\n"), at: now });
    const body = [...lines.slice(0, start), embedToken(eid), "", ...lines.slice(end)].join("\n");
    await S.db.doc("books/" + bid).set(Object.assign({}, b, { body, words: bookWords(body), updated: now }));
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { dragonWarden: true }));
  } catch (e) { console.warn("Dragon Warden move failed", e); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}
// The hand-made AoE pictures beside stat-block actions are replaced by AoE diagrams: take them out (kept in a backup).
async function migrateRemoveActionImages() {
  if (MIG_DONE.noActionImages) return;
  migrating = true;
  try {
    const IMG = /^\s*!\[[^\]]*\]\([^)\s]+\)(?:\s*\{[^}]*\})?\s*$/;
    const removed = {}; let n = 0;
    for (const [id, e] of S.entries) {
      const f = e.statblock && e.statblock.features; if (!f || !/!\[/.test(f)) continue;
      const lines = String(f).split("\n"), gone = lines.filter(l => IMG.test(l)); if (!gone.length) continue;
      const nf = lines.filter(l => !IMG.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
      removed[id] = gone.map(l => l.trim()); n += gone.length;
      await S.db.doc("entries/" + id).set(Object.assign({}, e, { statblock: Object.assign({}, e.statblock, { features: nf }), updated: new Date().toISOString() }));
    }
    if (n) await S.db.doc("settings/backup-actionimages").set({ removed, at: new Date().toISOString() });
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { noActionImages: true, imageLinks: true }));
    MIG_DONE.noActionImages = true;
    if (n) toast(`Removed ${n} action image${n === 1 ? "" : "s"} from stat blocks`);
  } catch (e) { console.warn("Removing action images failed", e); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}
async function migrateClassLevel() {
  if (MIG_DONE.classLevelSplit) return;
  migrating = true;
  try {
    for (const [id, c] of S.chars) { const r = splitClassLevel(c); if (r && (r.classes !== c.classes || Number(c.level) !== r.level)) await S.db.doc("characters/" + id).set(Object.assign({}, c, r)); }
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { classLevelSplit: true }));
    MIG_DONE.classLevelSplit = true;
  } catch (e) { console.warn("Splitting class and level failed", e); }
  finally { migrating = false; setTimeout(maybeMigrate, 800); }
}
let migrating = false;
async function maybeMigrate() {
  if (migrating || !S.db || !S.loaded.entries || !S.imports) return;
  // On a shared server, only the computer running it does one-time upgrades, so two devices never do them at once.
  if (SERVER && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  if (!S.imports.avgRule) { await migrateAverages(); return; }
  if (!S.imports.dragonWarden && S.loaded.books) { await migrateDragonWarden(); return; }
  if (!S.imports.bookEmbeds && (S.imports.dragonWarden || MIG_DONE.dragonWarden) && S.loaded.books) { await migrateBookEmbeds(); return; }
  if (!S.imports.classEntries && (S.imports.bookEmbeds || MIG_DONE.bookEmbeds)) { await migrateClassEntries(); return; }
  if (!S.imports.phbSubs && (S.imports.classEntries || MIG_DONE.classEntries)) { await migratePhbSubclasses(); return; }
  if (!S.imports.harvestItems && (S.imports.phbSubs || MIG_DONE.phbSubs) && S.loaded.books) { await migrateHarvestItems(); return; }
  if (!S.imports.harvestParts && (S.imports.harvestItems || MIG_DONE.harvest)) { await migrateHarvestParts(); return; }
  if (!S.imports.templateParts && (S.imports.harvestParts || MIG_DONE.harvestParts) && S.loaded.books) { await migrateTemplateParts(); return; }
  if (!S.imports.noActionImages && (S.imports.templateParts || MIG_DONE.templateParts)) { await migrateRemoveActionImages(); return; }
  if (!S.imports.srdFeatsRaces && (S.imports.classLevelSplit || MIG_DONE.classLevelSplit)) { await migrateSrdFeatsRaces(); return; }
  if (!S.imports.bookLib && S.loaded.books && (S.imports.srdFeatsRaces || MIG_DONE.srdFeatsRaces)) { await migrateBookLib(); return; }
  if (!S.imports.classLevelSplit && S.loaded.chars && (S.imports.noActionImages || MIG_DONE.noActionImages)) { await migrateClassLevel(); return; }
  if (S.imports.imageLinks) return;
  migrating = true;
  try {
    const r = await fetch("./image-links.json"); if (!r.ok) return;
    const map = await r.json();
    const norm = t => String(t).toLowerCase().replace(/\(.*$/, "").replace(/[^a-z]/g, "");
    const changed = new Map(); let added = 0;
    for (const [creature, action, url] of map) {
      const found = [...S.entries.entries()].find(([, e]) => e.type === "creature" && e.title === creature && e.statblock);
      if (!found) continue;
      const [id, e] = found;
      const doc = changed.get(id) || JSON.parse(JSON.stringify(e));
      const f = String(doc.statblock.features || "");
      if (f.includes(url)) continue;
      const ps = f.split("\n\n");
      const nm = p => { const m = p.match(/^\*\*\*([^*]+?)\*\*\*/); return m ? norm(m[1]) : null; };
      let k = ps.findIndex(p => nm(p) === norm(action));
      if (k < 0) k = ps.findIndex(p => nm(p) && nm(p).startsWith(norm(action).slice(0, 10)));
      if (k < 0) continue;
      ps.splice(k + 1, 0, `![${action}](${url})`);
      doc.statblock.features = ps.join("\n\n"); changed.set(id, doc); added++;
    }
    for (const [id, doc] of changed) await S.db.doc("entries/" + id).set(doc);
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { imageLinks: true }));
    if (added) toast(`Added ${added} action image links from your homebrewery page`);
  } catch (e) { /* try again next visit */ }
  finally { migrating = false; }
}

// Rewrite "10 (2d6 + 3)" style averages in creatures to the house rule (each die = half its sides).
function rewriteAverages(text) {
  let n = 0;
  const out = String(text || "").replace(/\b(\d+)(\s*)\((\s*\d+d\d+(?:\s*[+\-−]\s*\d+(?:d\d+)?)*\s*)\)/g, (m, num, sp, dice) => {
    const a = diceAvg(dice); if (!a || String(a.total) === num) return m;
    n++; return a.total + sp + "(" + dice + ")";
  });
  return { out, n };
}
async function migrateAverages() {
  migrating = true;
  try {
    let changed = 0, creatures = 0;
    for (const [id, e] of S.entries) {
      if (e.type !== "creature") continue;
      const doc = JSON.parse(JSON.stringify(e)); let n = 0;
      const b = rewriteAverages(doc.body); doc.body = b.out; n += b.n;
      if (doc.statblock) for (const k of ["hp", "features"]) { const r = rewriteAverages(doc.statblock[k]); doc.statblock[k] = r.out; n += r.n; }
      if (n) { await S.db.doc("entries/" + id).set(doc); changed += n; creatures++; }
    }
    await S.db.doc("settings/imports").set(Object.assign({}, S.imports, { avgRule: true }));
    if (changed) toast(`Updated ${changed} written averages across ${creatures} creatures to your half-dice rule`);
  } catch (e) { /* try again next visit */ }
  finally { migrating = false; }
}

// ----- Library file -----
function libraryData() {
  return { kind: "lore-codex-backup", version: 2, at: new Date().toISOString(), entries: Object.fromEntries(S.entries), tags: Object.fromEntries(S.tags), books: Object.fromEntries(S.books), characters: Object.fromEntries(S.chars), encounters: Object.fromEntries(S.encs || new Map()), vttcamps: Object.fromEntries(S.vttCamps || new Map()), vttpages: Object.fromEntries(S.vttPages || new Map()), vtttokens: Object.fromEntries(S.vttTokens || new Map()), vttfog: Object.fromEntries(S.vttFog || new Map()), vttdraw: Object.fromEntries(S.vttDraw || new Map()), map: S.meta ? { meta: S.meta, towns: S.towns } : null };
}
function itemStatsHtml(it) {
  const st = it.stats || {}, u = useInfo(it);
  const k = kindOfCategory(it.category), rows = [];
  if (u) rows.push(["Uses", esc(useText(u))]);
  if (k !== "armour") { const d = damageText(st); if (d) rows.push(["Damage", diceify(esc(d))]); }
  if (k === "armour") { const a = acText(st, /shield/i.test(it.category || "")); if (a) rows.push(["Armour Class", esc(a)]); }
  const c = costText(st); if (c) rows.push(["Cost", esc(c)]);
  if (!rows.length) return "";
  return `<div class="istats">${rows.map(([l, v]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join("")}</div>`;
}
function openLoreEditor(id) {
  const e = S.entries.get(id); if (!e) return;
  openModal(`<h2>Lore for ${esc(e.title)}</h2>
    <form data-form="lore" data-id="${esc(id)}">
      <div class="field"><textarea id="lore-text" rows="6" placeholder="What it looks like, where it came from, how it feels to hold."></textarea></div>
      <div class="acts"><button class="btn" type="submit">Save lore</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div>
    </form>`, () => { const ed = richify($("#lore-text"), { tools: "small" }); if (ed) ed.focus(); });
}
function hiddenCount() { let n = 0; S.entries.forEach(e => { if (e.hidden) n++; }); S.books.forEach(b => { if (b.hidden) n++; }); return n; }
function openExport() {
  openModal(`<h2>Export</h2>
    <div class="exports">
      <div class="exp"><h3>Read-only page for friends</h3>
        <p class="muted">One HTML file with your whole codex inside. It opens in any web browser with no account, nothing can be edited, and your imgur images show as pictures.</p>
        <button class="btn" data-act="exportro">Export read-only page</button></div>
      <div class="exp"><h3>Library file</h3>
        <p class="muted">All your entries, tags, books and map in one file, for loading into the codex on another computer (Library file tab → Choose library file).</p>
        <button class="btn ghost" data-act="dllibrary">Export library file</button></div>
    </div>
    ${hiddenCount() ? `<p class="muted small">${hiddenCount()} entr${hiddenCount() === 1 ? "y is" : "ies are"} hidden from players and won't be in the read-only page. The library file always includes everything.</p>` : ""}
    <p class="muted small">Both are snapshots of the codex as it is right now. Export again after you make changes.</p>
    <div class="acts"><button class="btn ghost" data-act="closemodal">Close</button></div>`);
}
async function blobToDataUrl(b) { return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }
async function exportReadOnly() {
  if (!S.downloads) { toast("Downloads aren't available in this view.", "bad"); return; }
  const btn = document.querySelector('[data-act="exportro"]'); if (btn) { btn.disabled = true; btn.textContent = "Packing…"; }
  try {
    const data = libraryData();
    delete data.kind; delete data.settings;
    // Anything marked hidden from players stays out of the friends' copy.
    for (const [id, e] of Object.entries(data.entries)) if (e.hidden) delete data.entries[id];
    for (const [id, b] of Object.entries(data.books)) if (b.hidden) delete data.books[id];
    for (const [id, c] of Object.entries(data.characters || {})) if (c.hidden) delete data.characters[id];
    let json = JSON.stringify(data);
    // Pack uploaded images into the file so they work on their own.
    const paths = [...new Set(json.match(/\/_blob\/[A-Za-z0-9_-]+|images\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif)/g) || [])];
    for (const path of paths) {
      try {
        const blob = LOCAL ? await lfReadImage(path) : await (await fetch(path)).blob();
        json = json.split(path).join(await blobToDataUrl(blob));
      } catch (e) { /* leave the link */ }
    }
    // Build the page from this one: keep the app's own styles and script, drop anything the host added.
    const root = document.documentElement.cloneNode(true);
    root.querySelectorAll("script:not(#codex-app), meta[http-equiv], iframe, link[rel=modulepreload]").forEach(n => n.remove());
    const sv = root.querySelector("#savestate"); if (sv) sv.remove();
    ["#main", "#modal", "#toasts"].forEach(sel => { const n = root.querySelector(sel); if (n) n.innerHTML = ""; });
    const modal = root.querySelector("#modal"); if (modal) modal.setAttribute("hidden", "");
    const body = root.querySelector("body"); body.removeAttribute("class"); body.removeAttribute("style");
    root.querySelector("title").textContent = "DnD Codex (read-only)";
    const dataScript = document.createElement("script");
    dataScript.textContent = "window.__CODEX_DATA = " + json.replace(/</g, "\\u003c") + ";";
    root.querySelector("head").appendChild(dataScript);
    const html = "<!DOCTYPE html>\n" + root.outerHTML;
    await S.downloads.save({ filename: "dnd-codex-readonly-" + new Date().toISOString().slice(0, 10) + ".html", data: html });
    toast("Read-only page saved. Send the file to your friends; they open it in any browser.");
    closeModal();
  } catch (e) {
    if (!(e && e.code === "declined")) toast("Couldn't export the page (" + ((e && e.code) || (e && e.message) || "error") + ").", "bad");
  }
  if (btn) { btn.disabled = false; btn.textContent = "Export read-only page"; }
}
async function downloadLibrary() {
  const name = "dnd-codex-" + new Date().toISOString().slice(0, 10) + ".json";
  if (!S.downloads) { toast("Downloads aren't available in this view. Use “Copy to clipboard” instead.", "bad"); return; }
  try {
    let json = JSON.stringify(libraryData(), null, 1);
    // Pictures uploaded to the online codex travel inside the file, so they work wherever it's loaded.
    if (!LOCAL) {
      const paths = [...new Set(json.match(/\/_blob\/[A-Za-z0-9_-]+/g) || [])];
      if (paths.length) toast(`Packing ${paths.length} picture${paths.length === 1 ? "" : "s"} into the file…`);
      for (const path of paths) { try { json = json.split(path).join(await blobToDataUrl(await (await fetch(path)).blob())); } catch (e) {} }
    }
    await S.downloads.save({ filename: name, data: json }); toast("Library file saved");
  }
  catch (e) { if (!(e && e.code === "declined")) toast("Couldn't save the file (" + ((e && e.code) || "error") + ").", "bad"); }
}

// ---------- modals ----------
function openModal(html, onReady) {
  const m = $("#modal");
  m.innerHTML = `<div class="mback" data-act="closemodal"></div><div class="mbox" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  document.body.classList.add("modal-open");
  if (onReady) onReady(m);
  const first = m.querySelector("input,textarea,select,button.btn"); if (first) first.focus();
}
function closeModal() { const m = $("#modal"); m.hidden = true; m.innerHTML = ""; document.body.classList.remove("modal-open"); }
function confirmBox(text, yesLabel) {
  return new Promise(res => {
    openModal(`<h2>${esc(text)}</h2><div class="acts"><button class="btn danger" id="cyes">${esc(yesLabel)}</button><button class="btn ghost" id="cno">Cancel</button></div>`, m => {
      m.querySelector("#cyes").onclick = () => { closeModal(); res(true); };
      m.querySelector("#cno").onclick = () => { closeModal(); res(false); };
    });
  });
}

let draftTags = [];
function openEditor(id, preset, embedMode) {
  const e = id ? S.entries.get(id) : Object.assign({ title: "", type: "creature", tags: [], body: "", townId: null }, preset || {});
  draftTags = [...(e.tags || [])];
  const town = e.townId != null ? S.townById.get(e.townId) : null;
  openModal(`
    <h2>${id ? "Edit entry" : "New entry"}</h2>
    <form data-form="entry" data-id="${id || ""}" data-embed="${embedMode || ""}" data-source="${esc((!id && preset && preset.source) || "")}">
      ${importBarHtml(e.type)}
      <div class="frow">
        <label class="grow"><span>Title</span><input id="ed-title" type="text" required value="${esc(e.title)}" placeholder="e.g. The Flame Cutter"></label>
        <label><span>Type</span><select id="ed-type">${TYPES.filter(t => !t.hideNew || t.id === e.type).map(t => `<option value="${t.id}"${t.id === e.type ? " selected" : ""}>${t.label}</option>`).join("")}</select></label>
      </div>
      <label><span>Tags</span>
        <div class="tagin" id="tagin"><span id="ed-tagchips"></span><input id="ed-tag" type="text" list="taglist" placeholder="Type a tag, press Enter" autocomplete="off"></div>
        <datalist id="taglist">${allTagSlugs().map(s => `<option value="${esc(tagName(s))}"></option>`).join("")}</datalist>
      </label>
      <label><span>Linked settlement <small class="muted">optional</small></span>
        <input id="ed-town" type="text" list="townlist" value="${esc(town ? town.n : "")}" placeholder="${S.towns.length ? "Pick a town from your map" : "Import your map to link towns"}"${S.towns.length ? "" : " disabled"}>
        <datalist id="townlist">${S.towns.map(t => `<option value="${esc(t.n)}">${esc(groupLabel(t.g))}, ${esc((stateOf(t.s) || {}).n || "")}</option>`).join("")}</datalist>
      </label>
      <fieldset class="typefields" data-for="item"${e.type === "item" ? "" : " hidden"}><legend>Item</legend>
        ${itemFields(e)}
      </fieldset>
      <fieldset class="typefields" data-for="spell"${e.type === "spell" ? "" : " hidden"}><legend>Spell</legend>
        ${spellFields(e)}
      </fieldset>
      <fieldset class="typefields" data-for="subclass"${e.type === "subclass" ? "" : " hidden"}><legend>Subclass features</legend>
        ${subclassFields(e)}
      </fieldset>
      <fieldset class="typefields" data-for="partset"${e.type === "partset" ? "" : " hidden"}><legend>Parts in this set</legend>
        ${partsetFields(e)}
      </fieldset>
      <fieldset class="typefields" data-for="handout"${e.type === "handout" ? "" : " hidden"}><legend>Handout <small class="muted">write straight onto the page</small></legend>
        ${handoutFields(e, id)}
      </fieldset>
      <fieldset class="typefields" data-for="class"${e.type === "class" ? "" : " hidden"}><legend>Class</legend>
        ${classFields(e)}
      </fieldset>
      <fieldset class="typefields" data-for="race"${e.type === "race" ? "" : " hidden"}><legend>Racial traits</legend>
        ${raceFields(e)}
      </fieldset>
      <fieldset class="typefields" data-for="feat"${e.type === "feat" ? "" : " hidden"}><legend>Feat</legend>
        ${featFields(e)}
      </fieldset>
      <fieldset class="typefields" data-for="creature"${e.type === "creature" ? "" : " hidden"}><legend>Harvest table</legend>
        ${lootFields(e)}
      </fieldset>
      ${ssFieldsHtml(e)}
      <fieldset class="typefields" data-for="creature"${e.type === "creature" ? "" : " hidden"}><legend>Stat block <small class="muted">leave empty for lore only</small></legend>
        ${sbFields(e.statblock || {})}
      </fieldset>
      <div class="field typefields" data-for="creature"${e.type === "creature" ? "" : " hidden"}><span class="flabel">Token pictures <small class="muted">each new token gets one at random; leave empty to use the picture below</small></span>
        <div class="edtoks" id="ed-toks">${entryTokens(e).map(edTokThumb).join("")}</div>
        <div class="frow edtokadd"><label class="grow"><span class="sr">Picture link</span><input id="ed-token" type="text" value="" placeholder="https://… link, then Add"></label><button class="btn ghost" type="button" data-act="edtokadd">Add</button>${S.assets ? `<button class="btn ghost" type="button" data-act="edtokup">Upload…</button>` : ""}</div></div>
      <label class="check typefields uqcheck" data-for="creature"${e.type === "creature" ? "" : " hidden"}><input id="ed-unique" type="checkbox"${isUniqueCreature(e) ? " checked" : ""}> <span>Unique creature <small class="muted">a one-of-a-kind creature: it glows like a unique item</small></span></label>
      <div class="field typefields" data-for="creature"${e.type === "creature" ? "" : " hidden"}><span class="flabel">Token names <small class="muted">optional, one per line: each new token gets one at random</small></span><textarea id="ed-toknames" rows="3" placeholder="Bram&#10;Oda&#10;Willa">${esc((e.tokNames || []).join("\n"))}</textarea></div>
      <div class="frow"><label class="grow"><span>Picture <small class="muted">an uploaded image, or a link</small></span><input id="ed-image" type="text" value="${esc(e.image || "")}" placeholder="https://… or use Upload"></label>${S.assets ? `<label><span>&nbsp;</span><button class="btn ghost" type="button" data-act="edupload">Upload…</button></label>` : ""}</div>
      <div class="field typefields" data-for-not="item handout partset feat"${e.type === "item" || e.type === "handout" || e.type === "partset" || e.type === "feat" ? " hidden" : ""}><span class="flabel">${e.type === "creature" ? "Lore" : e.type === "spell" || e.type === "subclass" || e.type === "race" || e.type === "class" || e.type === "feat" ? "Description" : "Text"}</span><textarea id="ed-body" rows="10" placeholder="Write freely.">${esc(e.type === "item" ? "" : e.body)}</textarea></div>
      <label class="check"><input id="ed-hidden" type="checkbox"${e.hidden ? " checked" : ""}> Hide from players <small class="muted">(left out of the read-only page you share)</small></label>
      <div class="acts"><button class="btn" type="submit">Save entry</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button></div>
    </form>`, m => {
      drawDraftTags();
      richify($("#ed-body"), { base: 2 });
      richify($("#it-lore"), { tools: "small", base: 2 });
      richifyAll(m, "textarea.itdesc, textarea.atk-extra", { tools: "small", base: 1 });
      richifyAll(m, "textarea.hb-d", { tools: "small", base: 3 });
      richify($("#ho-body"), { tools: "small", base: 2 });
      psInit(e); lootSuggestDraw(); lootCalcAll(); harvestMode();
    });
}
// ----- Stat block editor: one box per stat line, traits and actions as lists -----
const DETAIL_FIELDS = [
  ["Saving Throws", "Dex +5, Con +5"], ["Skills", "Perception +3, Stealth +5"],
  ["Damage Vulnerabilities", "Cold"], ["Damage Resistances", "Fire; bludgeoning from nonmagical attacks"],
  ["Damage Immunities", "Poison"], ["Condition Immunities", "Charmed, Poisoned"],
  ["Senses", "Darkvision 60 ft., Passive Perception 13"], ["Languages", "Draconic, Common"]
];
function parseDetails(text) {
  const known = {}, other = [];
  String(text || "").split("\n").map(l => l.trim()).filter(Boolean).forEach(l => {
    const i = l.indexOf(":"); const label = i > 0 ? l.slice(0, i).trim() : "", val = i > 0 ? l.slice(i + 1).trim() : l;
    const hit = DETAIL_FIELDS.find(([k]) => k.toLowerCase() === label.toLowerCase());
    if (hit) known[hit[0]] = val; else other.push(l);
  });
  return { known, other: other.join("\n") };
}
// Features text <-> sections of named entries. "## Actions" starts a section; "***Bite.*** text" starts an entry;
// any other paragraph (an image, a bullet list, a note) belongs to the entry above it.
function parseFeatures(text) {
  const sections = [];
  let cur = null;
  const paras = String(text || "").split(/\n\s*\n/).map(p => p.replace(/\s+$/, "")).filter(p => p.trim());
  for (const p of paras) {
    const h = p.match(/^#{1,6}\s+(.+)$/);
    if (h && !p.includes("\n")) { cur = { name: h[1].trim(), items: [] }; sections.push(cur); continue; }
    if (!cur) { cur = { name: "", items: [] }; sections.push(cur); }
    const m = p.match(/^\*\*\*([^*]+?)\*\*\*\s*([\s\S]*)$/) || p.match(/^\*([^*]+?\.)\*\s+([\s\S]*)$/);
    if (m) cur.items.push({ name: m[1].trim().replace(/\.$/, ""), desc: m[2].trim() });
    else if (cur.items.length && cur.items[cur.items.length - 1].name) cur.items[cur.items.length - 1].desc += "\n\n" + p;
    else cur.items.push({ name: "", desc: p });
  }
  return sections;
}
function serializeFeatures(sections) {
  const out = [];
  for (const sec of sections) {
    const items = sec.items.filter(it => it.name.trim() || it.desc.trim());
    if (!items.length) continue;
    if (sec.name.trim()) out.push("## " + sec.name.trim());
    for (const it of items) {
      const nm = (it.name.trim().replace(/\.$/, "") + rchLabel(it)).trim();
      const desc = it.desc.trim() + (it.res && it.res.length ? "\n\n" + fresToken(it.res) : "") + (it.aoe ? "\n\n{{aoe:" + it.aoe + "}}" : "");
      out.push(nm ? `${it.b2 ? `**${nm}.**` : `***${nm}.***`} ${desc}`.trim() : desc.trim());
    }
  }
  return out.join("\n\n");
}
let draftSections = [];
const DRAFT = { sb: [], it: [], ft: [] }, BOX = { sb: "sbsections", it: "itsections", ft: "ftsections" };
const SECTION_PRESETS = ["Traits", "Actions", "Bonus Actions", "Reactions", "Legendary Actions", "Lair Actions", "Fly Mode Actions", "Grounded Actions", "Hunter's Notes"];
const singular = name => /trait/i.test(name) ? "trait" : /reaction/i.test(name) ? "reaction" : /action/i.test(name) ? "action" : /note/i.test(name) ? "note" : "entry";
let draftProps = [];
function itemFields(e) {
  const it = e.item || {};
  const parsed = it.category != null ? { category: it.category, base: it.base || "", props: it.props || [], attune: !!it.attune, extra: it.extra || "" } : parseItemLine(it.meta);
  draftProps = (parsed.props || []).map(p => Object.assign({}, p));
  const known = ITEM_CATEGORIES.some(c => c.toLowerCase() === String(parsed.category).toLowerCase());
  // Old items kept their flavour text as the first italic paragraph; it moves into the Lore box.
  let lore = it.lore, body = e.type === "item" ? String(e.body || "") : "";
  if (lore == null) {
    const paras = body.split(/\n\s*\n/);
    lore = "";
    if (paras.length && /^\*[^*][\s\S]*\*$/.test(paras[0].trim()) && !/^\*[^*]+?\.\*\s/.test(paras[0].trim())) { lore = paras.shift().trim().replace(/^\*|\*$/g, ""); body = paras.join("\n\n"); }
    if (/^\\?\[flavour text\\?\]$/i.test(lore.trim())) lore = "";
  }
  DRAFT.it = [{ name: "", items: parseFeatures(body).flatMap(sec => sec.items) }];
  const st = Object.assign({ cost: "", damage: "", dtype: "", ac: "", dex: false, dexMax: "" }, it.stats || {});
  if (!it.stats) {
    const items = DRAFT.it[0].items;
    const dmg = items.findIndex(x => /^damage$/i.test(x.name) && /^\s*\d+d\d+(\s*[+-]\s*\d+)?\s+[a-z]+\.?(\s*\([^)]*two-handed\)\.?)?\s*$/i.test(x.desc));
    if (dmg >= 0) { const m = items[dmg].desc.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)/i); st.damage = m[1]; st.dtype = m[2].toLowerCase(); items.splice(dmg, 1); }
    const ac = items.findIndex(x => /^armou?r class$/i.test(x.name) && /^\s*\d+\b/.test(x.desc));
    if (ac >= 0 && kindOfCategory(parsed.category) === "armour") { st.ac = items[ac].desc.match(/\d+/)[0]; items.splice(ac, 1); }
  }
  if (!DRAFT.it[0].items.length) DRAFT.it[0].items.push({ name: "", desc: "" });
  const kind = kindOfCategory(parsed.category);
  const hasStats = !!(it.stats && (it.stats.damage || it.stats.ac || it.stats.cost || (it.stats.dmg || []).length)) || (!e.title && (kind === "weapon" || kind === "armour")) || ((kind === "weapon" || kind === "armour") && !!(st.damage || st.ac));
  const hasUse = !!(it.use && it.use.type && it.use.type !== "none");
  return `<label class="check magicbox hvhide"><input id="it-magical" type="checkbox"${it.magical === false ? "" : " checked"}> ✦ Magical <small class="muted">untick for ordinary, non-magical gear</small></label>
    <div class="frow">
      <label><span>Category</span><select id="it-cat">${ITEM_CATEGORIES.map(c => `<option${known && c.toLowerCase() === String(parsed.category).toLowerCase() ? " selected" : ""}>${c}</option>`).join("")}<option value="__other"${known ? "" : " selected"}>Other…</option></select></label>
      <label class="grow" id="it-catother-wrap"${known ? " hidden" : ""}><span>Category name</span><input id="it-catother" type="text" value="${esc(known ? "" : parsed.category)}" placeholder="e.g. Sentient melee weapon"></label>
      <label class="grow hvhide"><span>Base item</span><input id="it-base" type="text" value="${esc(parsed.base)}" placeholder="e.g. spear, longsword, plate"></label>
    </div>
    ${harvestFieldsHtml(Object.assign({}, it, { category: parsed.category, harvest: it.harvest || (e.type === "item" && e.title ? harvestOf(e) : {}) }))}
    <div class="frow" id="it-saddle"${isSaddleCat(parsed.category) ? "" : " hidden"}><label><span>Seats <small class="muted">how many riders it carries in all</small></span><input id="it-seats" type="number" min="1" max="20" step="1" style="width:110px" value="${esc(it.seats || 2)}"></label><p class="muted small grow">Equipped on a summon, the mount can carry this many riders. Without a saddle a mount carries one less than the squares it takes up (Large 1, Huge 2, Gargantuan 3), and always at least one.</p></div>
    <div class="field hvhide"><span class="flabel">Properties</span>
      <div class="propchips" id="it-props">${propChipsHtml()}</div>
      <div class="propadd"><select id="it-propsel" aria-label="Property to add">${WEAPON_PROPS.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}</select><button class="btn ghost small" type="button" data-act="itaddprop" aria-label="Add property">+ Add</button></div>
    </div>
    <div class="frow hvhide">
      <label class="grow"><span>Extra note <small class="muted">optional, after the brackets</small></span><input id="it-extra" type="text" value="${esc(parsed.extra)}" placeholder="e.g. also known as the Bloodstone Blade"></label>
      <label class="check inline magiconly"${it.magical === false ? " hidden" : ""}><input id="it-attune" type="checkbox"${parsed.attune ? " checked" : ""}> Requires attunement</label>
    </div>
    <p class="itline hvhide"><span class="muted small">Item line:</span> <em id="it-linepreview">${esc(buildItemLine(parsed)) || "—"}</em></p>
    <div class="frow hvhide">
      <label class="magiconly"${it.magical === false ? " hidden" : ""}><span>Rarity</span><select id="ed-rarity">${RARITIES.map(r => `<option value="${r}"${r === (it.rarity || "") ? " selected" : ""}>${r || "(none)"}</option>`).join("")}</select></label>
      <label class="grow"><span>Held by</span><input id="ed-holder" type="text" list="holderlist" value="${esc(it.holder || "")}" placeholder="Character name"></label>
      <datalist id="holderlist">${[...new Set([...S.entries.values()].map(x => x.item && x.item.holder).filter(Boolean))].map(h => `<option value="${esc(h)}"></option>`).join("")}</datalist>
    </div>
    <div class="itchecks hvhide" role="group" aria-label="Optional item parts">
      <label class="check inline"><input id="it-stats-on" type="checkbox"${hasStats ? " checked" : ""}> Stats <small class="muted">damage, AC, cost</small></label>
      <label class="check inline"><input id="it-use-on" type="checkbox"${hasUse ? " checked" : ""}> Uses <small class="muted">charges, consumable</small></label>
      <label class="check inline"><input id="it-holds-on" type="checkbox"${(it.holds || {}).n ? " checked" : ""}> Holds other items</label>
      <label class="check inline"><input id="it-res-on" type="checkbox"${(it.res || []).length ? " checked" : ""}> Resources <small class="muted">charges, pools</small></label>
      <label class="check inline"><input id="it-light-on" type="checkbox"${it.light && (it.light.bright || it.light.dim) ? " checked" : ""}> Light <small class="muted">shines on the tabletop when equipped</small></label>
    </div>
    <div id="it-stats-wrap" class="hvhide itopt"${hasStats ? "" : " hidden"}>
    <div class="statpanel hvhide" data-kind="weapon"${kind === "weapon" ? "" : " hidden"}>
      <span class="flabel">Weapon stats</span>
      ${dmgRowsHtml("weapon", st, true)}
      <div class="frow"><label><span>Cost <small class="muted">optional</small></span><input class="st-cost" data-kind="weapon" type="text" value="${esc(st.cost)}" placeholder="15 gp"></label></div>
    </div>
    <datalist id="dtypes">${DAMAGE_TYPES.map(d => `<option value="${d}"></option>`).join("")}</datalist>
    <div class="statpanel hvhide" data-kind="item"${kind === "item" ? "" : " hidden"}>
      <span class="flabel">Item stats</span>
      ${dmgRowsHtml("item", st, false)}
      <div class="frow"><label><span>Cost <small class="muted">optional</small></span><input class="st-cost" data-kind="item" type="text" value="${esc(st.cost)}" placeholder="25 gp"></label></div>
    </div>
    <div class="statpanel hvhide" data-kind="armour"${kind === "armour" ? "" : " hidden"}>
      <span class="flabel">Armour stats</span>
      <div class="frow">
        <label><span>Base AC</span><input id="st-ac" type="text" inputmode="numeric" value="${esc(st.ac)}" placeholder="15"></label>
        <label class="check inline"><input id="st-dex" type="checkbox"${st.dex ? " checked" : ""}> Add Dex modifier</label>
        <label id="st-dexmax-wrap"${st.dex ? "" : " hidden"}><span>Max Dex <small class="muted">blank = no limit</small></span><input id="st-dexmax" type="text" inputmode="numeric" value="${esc(st.dexMax)}" placeholder="2"></label>
        <label><span>Cost <small class="muted">optional</small></span><input class="st-cost" data-kind="armour" type="text" value="${esc(st.cost)}" placeholder="750 gp"></label>
      </div>
      <p class="muted small">Shows as: <strong id="st-acprev">${esc(acText(st, /shield/i.test(parsed.category)) || "—")}</strong></p>
    </div>
    </div>
    <div id="it-use-wrap" class="hvhide itopt"${hasUse ? "" : " hidden"}>${useFieldsHtml(it)}</div>
    <div class="hvhide itopt holdsrow"><span class="holdsopts"${(it.holds || {}).n ? "" : " hidden"}><label><span class="sr">How many</span><input id="it-holds-n" type="number" min="1" max="40" class="mini" value="${esc((it.holds || {}).n || 10)}"></label>
        <span class="muted small">extra slots in</span>
        <label><span class="sr">Which row</span><select id="it-holds-row"><option value="equip"${(it.holds || {}).row !== "cons" ? " selected" : ""}>Equipped</option><option value="cons"${(it.holds || {}).row === "cons" ? " selected" : ""}>Consumables</option></select></label>
        <span class="muted small">while it's equipped</span>
        <div class="holdsonly"><span class="flabel">Only holds <small class="muted">leave empty for anything</small></span>${tagPickHtml("it-holds-only", holdOptions(), (it.holds || {}).only || [], { ph: "e.g. Any weapon, Ring, Potion" })}</div></span></div>
    <div id="it-res-wrap" class="hvhide itopt"${(it.res || []).length ? "" : " hidden"}>${itemResFieldsHtml(it)}</div>
    <div id="it-light-wrap" class="hvhide itopt"${it.light && (it.light.bright || it.light.dim) ? "" : " hidden"}>${itemLightFieldsHtml(it)}</div>
    <div class="field"><span class="flabel">Lore</span><textarea id="it-lore" rows="4" placeholder="What it looks like, where it came from, how it feels to hold.">${esc(lore)}</textarea></div>
    <div class="field hvhide"><span class="flabel">Abilities</span><div id="itsections" class="sbsections">${sectionsHtml("it")}</div></div>`;
}
// Damage rows in the item editor: the first is the main damage; more rows add extra damage types.
function dmgRowHtml(p, k, main) {
  return `<div class="dmgrow frow tight"><label><span>${k ? "Extra damage" : main ? "Damage" : "Damage <small class=\"muted\">optional</small>"}</span><input class="dmg-dice" type="text" value="${esc(p.damage || "")}" placeholder="1d8"></label>
    <label><span>Damage type</span><input class="dmg-type" type="text" list="dtypes" value="${esc(p.dtype || "")}" placeholder="${k ? "lightning" : "slashing"}"></label>
    ${k ? `<button type="button" class="iconbtn" data-act="dmgdel" aria-label="Remove this damage">✕</button>` : ""}</div>`;
}
function dmgRowsHtml(kind, st, main) {
  const parts = [{ damage: st.damage, dtype: st.dtype }, ...(Array.isArray(st.more) ? st.more : [])];
  return `<div class="dmgrows" data-kind="${kind}">${parts.map((p, k) => dmgRowHtml(p, k, main)).join("")}</div>
    <button type="button" class="btn ghost small dmgadd" data-act="dmgadd" data-kind="${kind}">+ Add another damage type</button>`;
}
function readDmgRows(kind) {
  const rows = [...document.querySelectorAll(`.dmgrows[data-kind="${kind}"] .dmgrow`)].map(r => ({ damage: r.querySelector(".dmg-dice").value.trim(), dtype: r.querySelector(".dmg-type").value.trim().toLowerCase() }));
  const first = rows[0] || { damage: "", dtype: "" }, more = rows.slice(1).filter(r => r.damage);
  return Object.assign({ damage: first.damage, dtype: first.dtype }, more.length ? { more } : {});
}
// A harvested part only needs its DC, available, weight and lore: hide the rest of the item form.
function harvestMode() {
  const sel = $("#it-cat"); if (!sel) return;
  const on = isHarvestCat(sel.value === "__other" ? ($("#it-catother") || {}).value : sel.value);
  const hv = $("#it-harvest"); if (hv) hv.hidden = !on;
  const sd = $("#it-saddle"); if (sd) sd.hidden = !isSaddleCat(sel.value === "__other" ? ($("#it-catother") || {}).value : sel.value);
  const fs = sel.closest("fieldset"); if (fs) fs.classList.toggle("hvmode", on);
}
// Light: an equipped item that shines on the tabletop (a torch, a glowing sword).
function itemLightFieldsHtml(it) {
  const l = it.light || {}, lib = typeof vLights === "function" ? vLights() : [];
  return `<div class="usepanel"><span class="flabel">Light</span>
    <div class="frow"><label><span>Fill from a preset</span><select id="it-light-pre"><option value="">Choose…</option>${lib.map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${x.bright}/${x.dim} ft</option>`).join("")}</select></label>
      <label class="grow"><span>Name</span><input id="it-light-name" type="text" value="${esc(l.name || it.name || "")}" placeholder="e.g. Torch"></label></div>
    <div class="frow tight"><label><span>Bright (ft)</span><input id="it-light-b" type="number" min="0" step="5" value="${l.bright != null ? l.bright : 20}"></label><label><span>Dim (ft)</span><input id="it-light-d" type="number" min="0" step="5" value="${l.dim != null ? l.dim : 20}"></label><label><span>Colour</span><input id="it-light-c" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(l.color || "") ? l.color : "#ff9a3c")}"></label></div>
    <p class="muted small">When a character has this equipped, their token gives off this light on the tabletop.</p></div>`;
}
function readItemLight() {
  if (!($("#it-light-on") || {}).checked) return null;
  const b = Math.max(0, Number($("#it-light-b").value) || 0), d = Math.max(0, Number($("#it-light-d").value) || 0); if (!b && !d) return null;
  return { name: $("#it-light-name").value.trim() || "Light", bright: b, dim: d, color: $("#it-light-c").value };
}
function useFieldsHtml(it) {
  const u = it.use || {}, t = u.type || (useInfo(it) ? "single" : "none");
  return `<div class="usepanel"><span class="flabel">Uses</span>
    <div class="frow">
      <label><span>How it's used</span><select id="it-usetype"><option value="none"${t === "none" ? " selected" : ""}>Not consumable</option><option value="single"${t === "single" ? " selected" : ""}>One-time use</option><option value="reusable"${t === "reusable" ? " selected" : ""}>Reusable (charges)</option></select></label>
      <label class="reuse"${t === "reusable" ? "" : " hidden"}><span>Uses</span><input id="it-uses" type="text" inputmode="numeric" value="${esc(u.uses || 3)}"></label>
      <label class="reuse"${t === "reusable" ? "" : " hidden"}><span>Recharges</span><select id="it-recharge">${Object.entries(RECHARGE).map(([k, l]) => `<option value="${k}"${(u.recharge || "none") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>
    <p class="muted small">Consumables can go in a character's consumable slots. One-time items are used up; reusable ones lose a charge each use${t === "reusable" && (u.recharge || "none") === "none" ? " and are destroyed when the last charge is gone" : ""}.</p></div>`;
}
function readUse() {
  if ($("#it-use-on") && !$("#it-use-on").checked) return { type: "none" };
  const t = ($("#it-usetype") || {}).value || "none";
  if (t === "reusable") return { type: "reusable", uses: Math.max(1, parseInt($("#it-uses").value, 10) || 1), recharge: $("#it-recharge").value };
  return { type: t };
}
function propChipsHtml() {
  if (!draftProps.length) return `<span class="muted small">None yet. Pick one below and press + Add.</span>`;
  return draftProps.map((p, k) => { const d = PROP[p.id] || { name: p.id }; return `<span class="propchip">${esc(d.name)}${d.param ? `<input class="propparam" data-k="${k}" type="text" value="${esc(p.param || "")}" placeholder="${esc(d.ph || "")}" aria-label="${esc(d.name)} ${d.param}">` : ""}<button type="button" class="iconbtn" data-act="itdelprop" data-k="${k}" aria-label="Remove ${esc(d.name)}">✕</button></span>`; }).join("");
}
function readItemFields() {
  document.querySelectorAll(".propparam").forEach(inp => { const p = draftProps[Number(inp.dataset.k)]; if (p) p.param = inp.value.trim(); });
  const catSel = $("#it-cat").value;
  const magical = $("#it-magical").checked;
  return { category: catSel === "__other" ? $("#it-catother").value.trim() : catSel, base: $("#it-base").value.trim(), props: draftProps.map(p => ({ id: p.id, param: p.param || "" })), attune: magical && $("#it-attune").checked, extra: $("#it-extra").value.trim() };
}
function readHolds() { if (!($("#it-holds-on") || {}).checked) return null; const n = Math.max(1, Math.min(40, Number(($("#it-holds-n") || {}).value) || 0)); if (!n) return null; const out = { n, row: ($("#it-holds-row") || {}).value === "cons" ? "cons" : "equip" }, only = tagPickRead("it-holds-only"); if (only.length) out.only = only; return out; }
document.addEventListener("change", ev => {
  const t = ev.target;
  if (t.id === "it-holds-on") { const o = document.querySelector(".holdsopts"); if (o) o.hidden = !t.checked; }
  if (t.id === "it-stats-on") { $("#it-stats-wrap").hidden = !t.checked; if (t.checked) updateStatPanels(); }
  if (t.id === "it-use-on") $("#it-use-wrap").hidden = !t.checked;
  if (t.id === "it-res-on") $("#it-res-wrap").hidden = !t.checked;
  if (t.id === "it-light-on") $("#it-light-wrap").hidden = !t.checked;
  if (t.id === "it-light-pre") { const pre = typeof vLight === "function" && vLight(t.value); if (pre) { $("#it-light-name").value = pre.name; $("#it-light-b").value = pre.bright; $("#it-light-d").value = pre.dim; $("#it-light-c").value = pre.color; } t.value = ""; }
  // Picking a weapon or armour category turns stats on, since they need damage or AC to work on the sheet.
  if ((t.id === "it-cat" || t.id === "it-catother") && $("#it-stats-on") && !$("#it-stats-on").checked) {
    const cat = $("#it-cat").value === "__other" ? $("#it-catother").value : $("#it-cat").value, kd = kindOfCategory(cat);
    if (kd === "weapon" || kd === "armour") { $("#it-stats-on").checked = true; $("#it-stats-wrap").hidden = false; updateStatPanels(); }
  }
});
function readItemStats() {
  if ($("#it-stats-on") && !$("#it-stats-on").checked) return null;
  const cat = $("#it-cat").value === "__other" ? $("#it-catother").value : $("#it-cat").value, kind = kindOfCategory(cat);
  const cost = (document.querySelector(`.st-cost[data-kind="${kind}"]`) || {}).value || "";
  if (kind === "armour") return { cost: cost.trim(), ac: $("#st-ac").value.trim(), dex: $("#st-dex").checked, dexMax: $("#st-dex").checked ? $("#st-dexmax").value.trim() : "" };
  const d = readDmgRows(kind);
  if (kind === "item" && !cost.trim() && !d.damage) return null;
  return Object.assign({ cost: cost.trim() }, d);
}
function updateStatPanels() {
  const cat = $("#it-cat").value === "__other" ? $("#it-catother").value : $("#it-cat").value, kind = kindOfCategory(cat);
  document.querySelectorAll(".statpanel").forEach(p => { p.hidden = p.dataset.kind !== kind; });
  const st = readItemStats(), prev = $("#st-acprev");
  if (prev) prev.textContent = (st && kind === "armour" && acText(st, /shield/i.test(cat))) || "—";
}
function updateItemLine() { const el = $("#it-linepreview"); if (el && $("#it-cat")) el.textContent = buildItemLine(readItemFields()) || "—"; }
function sbFields(sb) {
  const f = (id, label, ph, cls) => `<label class="${cls || ""}"><span>${label}</span><input id="sb-${id}" type="text" value="${esc(sb[id] || "")}" placeholder="${esc(ph)}"></label>`;
  const det = parseDetails(sb.details);
  draftSections = parseFeatures(sb.features);
  draftSections.forEach(sec => sec.items.forEach(it => { let tm; while ((tm = String(it.desc || "").match(/\n*\s*\{\{(aoe|res):([^}\s]+)\}\}\s*$/)) && (tm[1] === "res" || isActionSection(sec.name))) { if (tm[1] === "aoe") it.aoe = tm[2]; else it.res = fresDecode(tm[2]); it.desc = it.desc.slice(0, tm.index).trim(); } const rs = rchSplit(it.name); it.name = rs.name; it.rch = rs.rch; it.rchc = rs.rchc; const a = isActionSection(sec.name) ? parseAttack(it.desc) : null; if (a && buildAttack(a) === it.desc) { it.mode = "attack"; it.atk = a; } }));
  draftSections.forEach(sec => { if (!isActionSection(sec.name)) return; const names = sec.items.filter(x => !/^multiattack$/i.test(x.name.trim())).map(x => x.name.trim()).filter(Boolean); sec.items.forEach(it => { if (/^multiattack$/i.test(it.name.trim()) && it.mode !== "attack") { const m = parseMulti(it.desc, names); if (m) { it.mode = "multi"; it.multi = m; } } }); });
  for (const need of ["Traits", "Actions"]) if (!draftSections.some(x => x.name.toLowerCase() === need.toLowerCase())) draftSections.push({ name: need, items: [] });
  // Traits first, then Actions, then everything else in its existing order.
  const rank = n => n.toLowerCase() === "traits" ? 0 : n.toLowerCase() === "actions" ? 1 : 2;
  draftSections = draftSections.map((x, i) => [x, i]).sort((a, b) => rank(a[0].name) - rank(b[0].name) || a[1] - b[1]).map(x => x[0]);
  DRAFT.sb = draftSections;
  setTimeout(() => sbFormSync(true), 0);
  return `${sbMetaHtml(sb)}
    <div class="sbformleft">
    <div class="sbgridform">${f("ac", "Armour Class", "15 (natural armour)")}${f("cr", "Challenge", "5")}${f("exhaust", "Exhaust Meter", "Only Large and bigger")}${f("prof", "Proficiency", "From CR")}</div>
    <div class="sbhpspeed">${sbHpHtml(sb)}${sbSpeedHtml(sb)}</div></div>
    <details class="sbprevwrap" open><summary class="muted small">Preview</summary>${sbPreviewHtml()}</details>
    <p class="muted small">Leave Exhaust Meter or Proficiency empty and they're worked out: Exhaust is double Con (rising by Con) for Large and bigger, Proficiency follows CR like a character's level.</p>
    <div class="abilform">${["str", "dex", "con", "int", "wis", "cha"].map(k => `<label><span>${k.toUpperCase()}</span><input id="sb-${k}" type="text" inputmode="numeric" value="${esc(sb[k] || "")}" placeholder="10"></label>`).join("")}</div>
    ${sbDetailsHtml(sb, det)}
    <p class="muted small">Leave a line with no entries and it won't appear on the stat block.</p>
    ${det.other ? `<label><span>Other lines <small class="muted">“Label: value”, one per line</small></span><textarea id="sb-otherdet" rows="2">${esc(det.other)}</textarea></label>` : `<input type="hidden" id="sb-otherdet" value="">`}
    <div id="sbsections" class="sbsections">${sectionsHtml("sb")}</div>
    <div class="addsec"><label for="sb-newsec" class="muted small">Add a section</label>
      <select id="sb-newsec">${SECTION_PRESETS.map(n => `<option>${esc(n)}</option>`).join("")}<option value="__custom">Custom name…</option></select>
      <button class="btn ghost small" type="button" data-act="sbaddsec">Add section</button></div>`;
}
const ATTACK_KINDS = ["Melee Weapon Attack", "Ranged Weapon Attack", "Melee or Ranged Weapon Attack", "Melee Spell Attack", "Ranged Spell Attack"];
const isActionSection = name => !/trait|note/i.test(name);
function buildAttack(a) {
  const hit = String(a.hit || "").trim().replace(/^(\d)/, "+$1");
  const bits = [hit ? `${hit} to hit` : "", String(a.reach || "").trim(), String(a.target || "").trim()].filter(Boolean).join(", ");
  let t = `*${a.kind || "Melee Weapon Attack"}:* ${bits}${bits ? "." : ""}`;
  const dice = String(a.dice || "").trim(), avg = dice ? diceAvg(dice) : null, type = String(a.dtype || "").trim();
  const extra = String(a.extra || "").trim();
  if (dice) {
    t += ` *Hit:* ${avg ? avg.total + " " : ""}(${dice})${type ? " " + type + " damage" : ""}`;
    t += extra ? (/^(plus|and)\b/i.test(extra) ? " " + extra : ". " + extra) : ".";
  } else if (extra) t += ` *Hit:* ${extra}`;
  return t.replace(/\s+/g, " ").trim();
}
function parseAttack(desc) {
  const d = String(desc || "").trim();
  const k = d.match(/^\*?((?:Melee or Ranged|Melee|Ranged) (?:Weapon|Spell) Attack):\*?\s*/i);
  if (!k) return null;
  const kind = ATTACK_KINDS.find(x => x.toLowerCase() === k[1].toLowerCase()) || k[1];
  const head = d.slice(k[0].length).split(/\*?Hit:\*?/)[0];
  const hit = (head.match(/([+−-]\s*\d+)\s*to hit/) || [])[1] || "";
  const reach = (head.match(/\b((?:reach|range) [^,.]*?ft\.?)(?=[,.]|\s*$)/i) || [])[1] || "";
  const target = (head.match(/\b(one target|one creature|up to [^,.]+ (?:targets?|creatures?))/i) || [])[1] || "";
  const dm = d.match(/\*?Hit:\*?\s*(?:\d+\s*)?\(([^)]+)\)\s*(?:([a-z]+)\s+damage\b|damage\b)?\.?\s*([\s\S]*)$/i);
  if (!dm) return null;
  return { kind, hit: hit.replace(/\s+/g, ""), reach: reach.replace(/ft$/, "ft."), target, dice: dm[1].trim(), dtype: (dm[2] || "").trim(), extra: dm[3].trim() };
}
const ATTACK_DEFAULT = { kind: "Melee Weapon Attack", hit: "", reach: "reach 5 ft.", target: "one target", dice: "", dtype: "", extra: "" };
function attackFieldsHtml(a, si, ii) {
  const f = (k, label, ph, cls) => `<label class="${cls || ""}"><span>${label}</span><input class="atk-${k}" type="text" value="${esc(a[k] || "")}" placeholder="${esc(ph)}"></label>`;
  const avg = a.dice ? diceAvg(a.dice) : null;
  return `<div class="atk">
    <label><span>Attack type</span><select class="atk-kind">${ATTACK_KINDS.map(x => `<option${x === a.kind ? " selected" : ""}>${x}</option>`).join("")}</select></label>
    ${f("hit", "To hit", "+5")}${f("reach", "Reach or range", "reach 5 ft.")}${f("target", "Targets", "one target")}
    <label><span>Damage dice</span><input class="atk-dice" type="text" value="${esc(a.dice || "")}" placeholder="2d6 + 3"><small class="avgnote">${avg ? `Average ${avg.total} · ${esc(avg.tip)}` : "&nbsp;"}</small></label>
    ${f("dtype", "Damage type", "piercing")}
    <div class="wide field"><span class="flabel">Extra effect <small class="muted">optional</small></span><textarea class="atk-extra" rows="2" placeholder="plus 3 (1d6) poison damage. The target must succeed on a DC 13 Strength saving throw or be knocked prone.">${esc(a.extra || "")}</textarea></div>
    <p class="atkprev wide"><span class="muted small">Shows as:</span> <span class="atkprevtext">${inline(esc(buildAttack(a)))}</span></p>
  </div>`;
}
function readAttack(itEl) {
  const g = k => { const el = itEl.querySelector(".atk-" + k); return el ? el.value : ""; };
  return { kind: g("kind"), hit: g("hit"), reach: g("reach"), target: g("target"), dice: g("dice"), dtype: g("dtype"), extra: g("extra") };
}
function sectionsHtml(ctx) {
  ctx = ctx || "sb";
  const isItem = ctx !== "sb", isFeat = ctx === "ft";
  return DRAFT[ctx].map((sec, si) => `<div class="sbsec${isItem ? " plain" : ""}" data-si="${si}" data-ctx="${ctx}">
      ${isItem ? "" : `<div class="sbsechead"><input class="secname" type="text" value="${esc(sec.name)}" placeholder="Section name" aria-label="Section name">
        <button class="iconbtn" type="button" data-act="sbdelsec" data-ctx="${ctx}" data-si="${si}" title="Remove this section" aria-label="Remove section ${esc(sec.name)}">✕</button></div>`}
      ${sec.items.map((it, ii) => `<div class="sbitem" data-ii="${ii}">
        <div class="sbitemhead"><input class="itname" type="text" value="${esc(it.name)}" placeholder="${isFeat ? "Feature name, e.g. Ability Score Increase" : isItem ? "Ability name, e.g. Returning Throw" : singular(sec.name) === "trait" ? "Trait name, e.g. Pack Tactics" : "Name, e.g. Bite (Recharge 5–6)"}" aria-label="Name">
          <button class="iconbtn" type="button" data-act="sbup" data-ctx="${ctx}" data-si="${si}" data-ii="${ii}" title="Move up" aria-label="Move up"${ii ? "" : " disabled"}>↑</button>
          <button class="iconbtn" type="button" data-act="sbdel" data-ctx="${ctx}" data-si="${si}" data-ii="${ii}" title="Remove" aria-label="Remove">✕</button></div>
        ${!isItem ? `<div class="sbitemopts">${isActionSection(sec.name) ? `<div class="seg small" role="group" aria-label="Action style">${[["attack", "Attack"], ["custom", "Custom"], ["multi", "Multiattack"]].map(([v, l]) => { const on = v === "custom" ? !["attack", "multi"].includes(it.mode) : it.mode === v; return `<button type="button" class="${on ? "on" : ""}" data-act="sbmode" data-si="${si}" data-ii="${ii}" data-v="${v}" aria-pressed="${on}">${l}</button>`; }).join("")}</div>` : ""}${it.mode === "multi" ? "" : rchFieldHtml(it)}</div>` : ""}
        ${it.mode === "multi" && !isItem ? multiFieldsHtml(it, sec.items.filter(x => x !== it && x.mode !== "multi" && x.name.trim()).map(x => x.name.trim()), si, ii)
          : it.mode === "attack" ? attackFieldsHtml(it.atk || ATTACK_DEFAULT, si, ii)
          : `<textarea class="itdesc" rows="${Math.min(8, Math.max(2, Math.ceil((it.desc || "").length / 70)))}" placeholder="${isItem ? "What it does" : "What it does, e.g. Advantage on attacks when an ally is within 5 ft."}">${esc(it.desc)}</textarea>`}
        ${ctx === "sb" ? fresEditorHtml(it) : ""}
        ${!isItem && isActionSection(sec.name) ? `<div class="sbaoe">${it.aoe ? `<figure class="aoefig small">${aoeSvg(aoeDecode(it.aoe), { noLegend: true })}</figure><div class="sbaoeacts"><span class="muted small">Area of effect</span><button class="btn ghost small" type="button" data-act="sbaoe" data-si="${si}" data-ii="${ii}">Edit diagram</button><button class="btn ghost small" type="button" data-act="sbaoerm" data-si="${si}" data-ii="${ii}">Remove</button></div>` : `<button class="btn ghost small" type="button" data-act="sbaoe" data-si="${si}" data-ii="${ii}">◎ Add an area-of-effect diagram</button>`}</div>` : ""}
      </div>`).join("")}
      <button class="btn ghost small addit" type="button" data-act="sbadd" data-ctx="${ctx}" data-si="${si}">+ Add ${isFeat ? "feature" : isItem ? "ability" : singular(sec.name)}</button>
    </div>`).join("");
}
function syncSections(ctx) {
  ctx = ctx || "sb";
  const box = document.getElementById(BOX[ctx]); if (!box) return;
  box.querySelectorAll(".sbsec").forEach(secEl => {
    const sec = DRAFT[ctx][Number(secEl.dataset.si)]; if (!sec) return;
    const nm = secEl.querySelector(".secname"); if (nm) sec.name = nm.value;
    secEl.querySelectorAll(".sbitem").forEach(itEl => {
      const it = sec.items[Number(itEl.dataset.ii)]; if (!it) return;
      it.name = itEl.querySelector(".itname").value;
      const rc = itEl.querySelector(".itrch"); if (rc) { it.rch = rc.value; it.rchc = itEl.querySelector(".itrchc").value; }
      if (it.mode === "multi") { const mb = itEl.querySelector(".multif"); if (mb) { it.multi = Object.assign({ who: (it.multi || {}).who }, readMulti(mb)); it.desc = buildMulti(it.multi); } it.rch = ""; }
      else if (it.mode === "attack") { it.atk = readAttack(itEl); it.desc = buildAttack(it.atk); }
      else { const d = itEl.querySelector(".itdesc"); if (d) it.desc = d.value; }
      const fl = itEl.querySelector(".fresl"); if (fl) it.res = [...fl.querySelectorAll(".itresrow")].map(readResRow).filter(r => r.name);
    });
  });
}
function redrawSections(focusSel, ctx) {
  ctx = ctx || "sb";
  const box = document.getElementById(BOX[ctx]); if (!box) return;
  box.innerHTML = sectionsHtml(ctx);
  richifyAll(box, "textarea.itdesc, textarea.atk-extra", { tools: "small", base: 1 });
  if (focusSel) { const el = box.querySelector(focusSel); if (el) el.focus(); }
}
function readSbFields() {
  syncSections();
  const keys = ["subtitle", "ac", "hp", "speed", "exhaust", "cr", "prof", "str", "dex", "con", "int", "wis", "cha"];
  const sb = {}; keys.forEach(k => { const el = document.getElementById("sb-" + k); sb[k] = el ? el.value.trim() : ""; });
  const lines = DETAIL_FIELDS.map(([k], i) => { const el = document.getElementById("sbd-" + i); const v = el ? el.value.trim() : ""; return v ? `${k}: ${v}` : ""; }).filter(Boolean);
  const other = ($("#sb-otherdet") || {}).value || "";
  sb.details = [...lines, ...other.split("\n").map(l => l.trim()).filter(Boolean)].join("\n");
  sb.features = serializeFeatures(DRAFT.sb);
  return [...keys, "details", "features"].some(k => sb[k]) ? sb : null;
}
function drawDraftTags() {
  const el = $("#ed-tagchips"); if (!el) return;
  setTimeout(lootSuggestDraw, 0);
  ssToggle();
  el.innerHTML = draftTags.map((s, k) => `<button type="button" class="tag on${S.tags.has(s) || allTagSlugs().includes(s) ? "" : " loose"}" data-act="rmdraft" data-k="${k}" title="Remove ${esc(tagName(s))}">${esc(tagName(s))} ✕</button>`).join("");
}
function addDraftTag(raw) {
  const v = String(raw || "").trim(); if (!v) return;
  const known = allTagSlugs().find(s => tagName(s).toLowerCase() === v.toLowerCase());
  const slug = known || slugify(v);
  if (slug && !draftTags.includes(slug)) draftTags.push(slug);
  drawDraftTags();
}
async function saveEntry(form) {
  const id = form.dataset.id || newId();
  addDraftTag($("#ed-tag").value);
  const title = $("#ed-title").value.trim();
  if (!title) { toast("Give the entry a title.", "bad"); return; }
  const townName = ($("#ed-town").value || "").trim().toLowerCase();
  const town = townName ? S.towns.find(t => t.n.toLowerCase() === townName) : null;
  if (townName && !town) { toast("No settlement called “" + $("#ed-town").value + "” on your map. Pick one from the list or clear the field.", "bad"); return; }
  const prev = S.entries.get(id) || {};
  const now = new Date().toISOString();
  const type = $("#ed-type").value;
  const doc = Object.assign({}, prev, { title, type, tags: draftTags.slice(), body: $("#ed-body").value, townId: town ? town.i : null, created: prev.created || now, updated: now });
  delete doc.example;
  const img = ($("#ed-image").value || "").trim(); if (img) doc.image = img; else delete doc.image;
  const toks = [...document.querySelectorAll("#ed-toks .edtok")].map(x => x.dataset.src), extra = (($("#ed-token") || {}).value || "").trim(); if (extra && !toks.includes(extra)) toks.push(extra);
  if (toks.length && type === "creature") { doc.token = toks[0]; if (toks.length > 1) doc.tokens = toks; else delete doc.tokens; } else { delete doc.token; delete doc.tokens; }
  { const u = $("#ed-unique"); if (u && type === "creature") doc.unique = u.checked; else delete doc.unique; }
  const tn = (($("#ed-toknames") || {}).value || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 200); if (tn.length && type === "creature") doc.tokNames = tn; else delete doc.tokNames;
  if ($("#ed-hidden").checked) doc.hidden = true; else delete doc.hidden;
  if (type === "creature") { const sb = readSbFields(); if (sb) doc.statblock = sb; else delete doc.statblock; }
  if (type === "spell") doc.spell = readSpellFields(); else delete doc.spell;
  if (type === "subclass") doc.subclass = readSubclassFields(); else delete doc.subclass;
  if (type === "race") doc.race = readRaceFields(); else delete doc.race;
  if (type === "feat") { doc.feat = readFeatFields(); syncSections("ft"); doc.body = serializeFeatures(DRAFT.ft); } else delete doc.feat;
  if (type === "class") doc.cls = readClassFields(); else delete doc.cls;
  if (type === "creature") { const loot = readLootFields(); if (loot.length) doc.loot = loot; else delete doc.loot; const ls = ($("#loot-size") || {}).value; if (ls) doc.lootSize = ls; else delete doc.lootSize; const ssr = readSsFields(id ? S.entries.get(id) : null); if (ssr) doc.shapeshift = ssr; else delete doc.shapeshift; if (creatureSize(doc) === "Gargantuan" && $("#loot-garg")) doc.lootGarg = Number($("#loot-garg").value); else delete doc.lootGarg; }
  if (type === "partset") doc.partset = readPartsetFields(); else delete doc.partset;
  if (type === "handout") { doc.handout = readHandoutFields(); doc.body = $("#ho-body").value; } else delete doc.handout;
  if (form.dataset.source && !doc.source) doc.source = form.dataset.source;
  if (type === "item") {
    const f = readItemFields(); syncSections("it");
    const magical = $("#it-magical").checked;
    const stats = readItemStats();
    doc.item = Object.assign(f, { magical, stats: stats || null, meta: buildItemLine(f), rarity: magical ? $("#ed-rarity").value : "", holder: $("#ed-holder").value.trim(), lore: $("#it-lore").value.trim(), use: readUse() });
    const hl = readHolds(); if (hl) doc.item.holds = hl; else delete doc.item.holds;
    const rl = readItemRes(); if (rl) doc.item.res = rl; else delete doc.item.res;
    const lt = readItemLight(); if (lt) doc.item.light = lt; else delete doc.item.light;
    if (isSaddleCat(doc.item.category)) doc.item.seats = Math.max(1, Math.min(20, Math.round(Number(($("#it-seats") || {}).value) || 2))); else delete doc.item.seats;
    doc.body = serializeFeatures(DRAFT.it);
    if (isHarvestCat(doc.item.category)) { doc.item.harvest = { dc: $("#hv-dc").value.trim(), qty: $("#hv-qty").value.trim(), wt: $("#hv-wt").value.trim() }; doc.body = harvestBody(doc); } else delete doc.item.harvest;
  }
  // New tags typed in the editor get a tag record so they can be given a parent later.
  const newTags = draftTags.filter(s => !S.tags.has(s));
  const ok = await safeWrite(async () => {
    await S.db.doc("entries/" + id).set(doc);
    for (const s of newTags) await S.db.doc("tags/" + s).set({ name: tagNameFromInput(s), parent: null });
  }, "Saved");
  if (ok) {
    const mode = form.dataset.embed;
    closeModal();
    if (mode === "insert") { S.entries.set(id, doc); beInsertEmbed(id); }
    else if (mode === "stay") { S.entries.set(id, doc); beRefresh(true); }
    else location.hash = "entry-" + id;
  }
}
const tagNameFromInput = s => tagName(s);

function openTagEditor(slug) {
  const t = S.tags.get(slug) || { name: tagName(slug), parent: null, description: "" };
  const banned = new Set([slug, ...descendants(slug)]);
  const opts = allTagSlugs().filter(s => !banned.has(s));
  openModal(`<h2>Edit tag</h2>
    <form data-form="tag" data-slug="${esc(slug)}">
      <label><span>Name</span><input id="tg-name" type="text" required value="${esc(t.name || tagName(slug))}"></label>
      <label><span>Kind of <small class="muted">entries tagged ${esc(tagName(slug))} also show lore from this tag</small></span>
        <select id="tg-parent"><option value="">(top level)</option>${opts.map(s => `<option value="${esc(s)}"${t.parent === s ? " selected" : ""}>${esc(tagName(s))}</option>`).join("")}</select></label>
      <div class="field"><span class="flabel">Description <small class="muted">optional, shown on the tag page</small></span><textarea id="tg-desc" rows="5">${esc(t.description || "")}</textarea></div>
      <div class="acts"><button class="btn" type="submit">Save tag</button><button class="btn ghost" type="button" data-act="closemodal">Cancel</button><span class="spacer"></span><button class="btn danger small" type="button" data-act="deltag" data-v="${esc(slug)}">Delete tag</button></div>
    </form>`, () => richify($("#tg-desc"), { tools: "small" }));
}

// ---------- map import ----------
async function importMap(file) {
  const status = $("#importstatus");
  const say = s => { if ($("#importstatus")) $("#importstatus").textContent = s; };
  if (!S.db) { toast("Saving isn't available here. Open the codex from claude.ai while signed in.", "bad"); return; }
  try {
    say("Reading " + file.name + "…");
    const text = await file.text();
    const { meta, towns } = parseAzgaarMap(text, file.name);
    const importId = "i" + Date.now().toString(36);
    const per = 300, chunks = Math.ceil(towns.length / per);
    for (let k = 0; k < chunks; k++) {
      say(`Saving settlements ${k * per + 1}–${Math.min(towns.length, (k + 1) * per)} of ${towns.length}…`);
      await S.db.doc("maptowns/c" + k).set({ importId, idx: k, towns: towns.slice(k * per, (k + 1) * per) });
    }
    say("Saving realms, provinces and goods…");
    await S.db.doc("map/meta").set(Object.assign(meta, { importId, chunks, fileName: file.name, importedAt: new Date().toISOString() }));
    for (const id of S.chunks.keys()) { const n = Number(id.slice(1)); if (n >= chunks) await S.db.doc("maptowns/" + id).delete(); }
    toast(`Imported ${towns.length} settlements from ${meta.name}`);
  } catch (e) {
    say("");
    toast(e && e.message && !e.code ? e.message : "Import failed (" + ((e && e.code) || "error") + "). Check it's an Azgaar .map file and try again.", "bad");
  }
  if (status) render();
}

// ---------- events ----------
document.addEventListener("click", async ev => {
  const tileEl = ev.target.closest(".tile[data-go]");
  if (tileEl && !ev.target.closest("a,button,input,label,[data-town]")) { location.hash = tileEl.dataset.go; return; }
  const dot = ev.target.closest("[data-town]");
  if (dot && !ev.target.closest("a")) { location.hash = "town-" + dot.dataset.town; return; }
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act, v = el.dataset.v;
  if (READONLY && ["new", "edit", "del", "edittag", "deltag", "newbook", "editbook", "delbook", "newtown", "portrait", "imgup", "edupload", "mergedupes", "export", "exportro", "dllibrary", "copybackup", "restore", "togglehide", "togglebookhide", "togglecharhide"].includes(a)) return;
  if (/^vtt/.test(a)) { await vttAction(a, el, ev); return; }
  if (/^srd(group|open|copy)$/.test(a)) { if (READONLY && a === "srdcopy") return; await srdAction(a, el); return; }
  if (/^(inv(kind|pick|add|new|slot|close|qty|rm|rows|take1|split|dup)|paygo|payundo)$/.test(a)) { if (READONLY && !PLAYER) return; await invAction(a, el); return; }
  if (/^(enc(new|dup|del|add|party|next|prev|end|roll|to)|cb(pick|rm|hp|cond))$/.test(a)) { encAction(a, el); return; }
  if (/^(smadd|smrm|smrefresh|smhp|smtoggle|smslot|smgive|smgiveback|smdrop|smuse|smires|smiresbar|smirespip|smnew|smedit|smsave|smabil|smabilsave|smabiledit|smabildel|smtok|newchar|srdfill|clsapply|spadj|spcast|spadd|cdrink|cuneq|cuseac|cview|cedit|ctab|chp|cinsp|cdeath|chd|cres|cresadj|cresbar|cires|ciresadj|ciresbar|csave|cskill|crest|clistadd|clistdel|charimg|chartok|cdel)$/.test(a)) { if (READONLY && !PLAYER && a !== "ctab" && a !== "cview") return; await charAction(a, el, ev); return; }
  if (a === "sbf") { SBS[el.dataset.k] = el.dataset.v; render(); return; }
  if (a === "spellcopy") { if (!READONLY) await spellCopy(el.dataset.v); return; }
  if (a === "new") { const rv = route().v; const t = el.dataset.type || (rv === "bestiary" ? "creature" : rv === "items" ? "item" : null); openEditor(null, t ? { type: t } : null); }
  else if (a === "beastsel") {
    if (matchMedia("(min-width: 1000px)").matches) {
      ev.preventDefault();
      S.beast.sel = el.dataset.id; render();
      const d = document.getElementById("bdetail"); if (d) d.scrollTop = 0;
    }
  }
  else if (a === "sbadd") {
    const ctx = el.dataset.ctx || "sb"; syncSections(ctx); const si = Number(el.dataset.si), L = DRAFT[ctx];
    L[si].items.push(ctx === "sb" && isActionSection(L[si].name) ? { name: "", desc: "", mode: "attack", atk: Object.assign({}, ATTACK_DEFAULT) } : { name: "", desc: "" });
    redrawSections(`.sbsec[data-si="${si}"] .sbitem:last-of-type .itname`, ctx);
  }
  else if (a === "sbdel") {
    const ctx = el.dataset.ctx || "sb"; syncSections(ctx); const it = DRAFT[ctx][Number(el.dataset.si)].items[Number(el.dataset.ii)];
    if (it && (it.name.trim() || it.desc.trim()) && !confirmInline(el)) return;
    DRAFT[ctx][Number(el.dataset.si)].items.splice(Number(el.dataset.ii), 1); redrawSections(null, ctx);
  }
  else if (a === "sbaoe" || a === "sbaoerm") {
    syncSections(); const it = ((DRAFT.sb[Number(el.dataset.si)] || {}).items || [])[Number(el.dataset.ii)]; if (!it) return;
    if (a === "sbaoerm") { delete it.aoe; redrawSections(); }
    else aoeEdit(it.aoe ? aoeDecode(it.aoe) : null, d => { it.aoe = aoeToken(d).slice(6, -2); redrawSections(); });
  }
  else if (a === "mrowadd" || a === "mrowdel") {
    if (a === "mrowdel") { const box = el.closest(".multif"); el.closest(".mrow").remove(); box.dispatchEvent(new Event("input", { bubbles: true })); }
    else { syncSections(); const sec = DRAFT.sb[Number(el.dataset.si)], it = sec.items[Number(el.dataset.ii)], names = sec.items.filter(x => x !== it && x.mode !== "multi" && x.name.trim()).map(x => x.name.trim());
      const box = el.closest(".multif"); box.querySelector(".mrows").insertAdjacentHTML("beforeend", multiRowHtml(names.length ? { type: "action", name: names[0], n: 1 } : { type: "custom", n: 1, text: "" }, names)); box.dispatchEvent(new Event("input", { bubbles: true })); }
  }
  else if (a === "sbmode") {
    syncSections(); const it = DRAFT.sb[Number(el.dataset.si)].items[Number(el.dataset.ii)];
    if (v === "attack" && it.mode !== "attack") {
      const parsed = it.desc.trim() ? parseAttack(it.desc) : Object.assign({}, ATTACK_DEFAULT);
      if (!parsed) { toast("That text doesn't read as a standard attack line, so it stays as Custom. Clear the text first to start a fresh attack.", "bad"); return; }
      it.atk = parsed; it.mode = "attack";
    } else if (v === "custom" && it.mode === "attack") { it.desc = buildAttack(it.atk); it.mode = "custom"; }
    else if (v === "custom" && it.mode === "multi") { it.mode = "custom"; }
    else if (v === "multi" && it.mode !== "multi") {
      const sec = DRAFT.sb[Number(el.dataset.si)], names = sec.items.filter(x => x !== it && x.mode !== "multi" && x.name.trim()).map(x => x.name.trim());
      if (it.mode === "attack") it.desc = buildAttack(it.atk);
      it.multi = parseMulti(it.desc, names) || { rows: names.length ? [{ type: "action", name: names[0], n: 2 }] : [{ type: "custom", n: 2, text: "" }] };
      it.mode = "multi"; it.rch = ""; if (!it.name.trim()) it.name = "Multiattack";
    }
    redrawSections();
  }
  else if (a === "sbup") {
    const ctx = el.dataset.ctx || "sb"; syncSections(ctx); const sec = DRAFT[ctx][Number(el.dataset.si)], ii = Number(el.dataset.ii);
    if (ii > 0) { [sec.items[ii - 1], sec.items[ii]] = [sec.items[ii], sec.items[ii - 1]]; redrawSections(null, ctx); }
  }
  else if (a === "sbdelsec") {
    syncSections(); const si = Number(el.dataset.si), sec = DRAFT.sb[si];
    if (sec.items.some(it => it.name.trim() || it.desc.trim()) && !confirmInline(el)) return;
    DRAFT.sb.splice(si, 1); redrawSections();
  }
  else if (a === "sbaddsec") {
    syncSections(); let name = $("#sb-newsec").value;
    if (name === "__custom") name = "";
    DRAFT.sb.push({ name, items: [{ name: "", desc: "" }] });
    redrawSections(name ? `.sbsec:last-of-type .itname` : `.sbsec:last-of-type .secname`);
  }
  else if (a === "ikind") { S.items.kind = v || ""; render(); }
  else if (a === "imagic") { S.items.magic = v || ""; if (v === "mundane") S.items.rarity = ""; render(); }
  else if (a === "dmgadd") { const box = document.querySelector(`.dmgrows[data-kind="${el.dataset.kind}"]`); if (box) { box.insertAdjacentHTML("beforeend", dmgRowHtml({}, box.children.length, true)); box.lastElementChild.querySelector(".dmg-dice").focus(); } }
  else if (a === "dmgdel") { el.closest(".dmgrow").remove(); }
  else if (a === "itresadd" || a === "itresdel" || a === "sbresadd") itemResAction(a, el);
  else if (a === "sbspadd" || a === "sbspdel" || a === "sbhpuse") sbSpeedAction(a, el);
  else if (a === "sbdadd" || a === "sbddel" || a === "sbdetuse") sbDetAction(a, el);
  else if (a === "itaddprop") {
    readItemFields(); const id = $("#it-propsel").value;
    if (draftProps.some(p => p.id === id)) { toast(PROP[id].name + " is already on this item."); return; }
    draftProps.push({ id, param: "" }); $("#it-props").innerHTML = propChipsHtml(); updateItemLine();
    const inp = document.querySelector(`.propparam[data-k="${draftProps.length - 1}"]`); if (inp) inp.focus();
  }
  else if (a === "itdelprop") { readItemFields(); draftProps.splice(Number(el.dataset.k), 1); $("#it-props").innerHTML = propChipsHtml(); updateItemLine(); }
  else if (a === "addlore") openLoreEditor(el.dataset.id);
  else if (a === "ftagsclear") { S.filter.tags = new Set(); render(); }
  else if (a === "fmode") { S.filter.mode = v === "or" ? "or" : "and"; render(); }
  else if (a === "mergedupes") mergeDuplicates();
  else if (a === "homenosb") { ev.preventDefault(); S.filter = { types: new Set(), tags: new Set(), q: "", mode: S.filter.mode }; S.beast.sbOnly = 2; location.hash = "bestiary"; }
  else if (a === "tpdone") { const d = el.closest("details"); if (d) d.open = false; }
  else if (a === "topsearch") { const on = document.body.classList.toggle("showsearch"); if (on) { const q = document.getElementById("q"); if (q) q.focus(); } }
  else if (a === "imgup") pickImage(async res => {
    const e = S.entries.get(el.dataset.id); if (!e) return;
    const from = el.dataset.url, to = assetPath(res);
    const doc = JSON.parse(JSON.stringify(e));
    doc.body = String(doc.body || "").split(from).join(to);
    if (doc.statblock) doc.statblock.features = String(doc.statblock.features || "").split(from).join(to);
    if (doc.image === from) doc.image = to;
    doc.updated = new Date().toISOString();
    await safeWrite(() => S.db.doc("entries/" + el.dataset.id).set(doc), "Image saved to the codex");
  });
  else if (a === "portrait") pickImage(async res => {
    const e = S.entries.get(el.dataset.id); if (!e) return;
    await safeWrite(() => S.db.doc("entries/" + el.dataset.id).update({ image: assetPath(res), updated: new Date().toISOString() }), "Image saved");
  });
  else if (a === "edtokup") pickImage(res => { edTokAdd(assetPath(res)); toast("Added. Save the entry to keep it."); });
  else if (a === "edtokadd") { const f = $("#ed-token"), v = f && f.value.trim(); if (v) { edTokAdd(v); f.value = ""; } }
  else if (a === "edtokrm") { const x = el.closest(".edtok"); if (x) x.remove(); }
  else if (a === "edupload") pickImage(res => { const f = $("#ed-image"); if (f) f.value = assetPath(res); toast("Uploaded. Save the entry to keep it."); });
  else if (a === "dllibrary") downloadLibrary();
  else if (a === "export") openExport();
  else if (a === "togglecharhide") { const id = el.dataset.id, c = S.chars.get(id); if (c) { charChange(id, x => { if (x.hidden) delete x.hidden; else x.hidden = true; }); toast(c.hidden ? "Players can see this character again" : "Hidden from players: they won't see this character at all"); } }
  else if (a === "togglehide") { const e = S.entries.get(el.dataset.id); if (e) await safeWrite(() => S.db.doc("entries/" + el.dataset.id).update({ hidden: !e.hidden }), e.hidden ? "Now visible to players" : "Hidden from players"); }
  else if (a === "togglebookhide") { const b = S.books.get(el.dataset.id); if (b) await safeWrite(() => S.db.doc("books/" + el.dataset.id).update({ hidden: !b.hidden }), b.hidden ? "Book now visible to players" : "Book hidden from players"); }
  else if (a === "exportro") exportReadOnly();
  else if (a === "holder") { ev.preventDefault(); S.items.holder = v || ""; if (route().v !== "items") location.hash = "items"; else render(); }
  else if (a === "toc") { const t = document.getElementById(v); if (t) t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
  else if (a === "editbook") location.hash = "bookedit-" + v;
  else if (a === "newbook") beNewBook();
  else if (a === "hbadd") hbAddRow(v);
  else if (a === "spimport") spellImportApply();
  else if (a === "ftimport") featImportApply();
  else if (a === "impopen" || a === "impgo") impAction(a);
  else if (a === "editinbook") editInBook(el.dataset.id);
  else if (a === "qcgo") qcCreate();
  else if (a === "qcmanual") qcManual();
  else if (a === "copyurl") { try { await navigator.clipboard.writeText(el.dataset.v); toast("Link copied"); } catch (e) { toast(el.dataset.v); } }
  else if (a === "hoblot") handoutBlot();
  else if (a === "newharvest") openEditor(null, { type: "item", item: { category: "Harvested part", magical: false } });
  else if (a === "lootpick") lootAddPart(v);
  else if (a === "lootpickall") { const s = S.entries.get(v); ((s && s.partset || {}).parts || []).forEach(pid => { const p = S.entries.get(pid); if (p && ![...document.querySelectorAll("#loot-rows .lootrow")].some(r => r.dataset.ref === pid || r.querySelector(".lt-n").value.trim().toLowerCase() === p.title.toLowerCase())) lootAddPart(pid); }); }
  else if (a === "lootaddname") lootAddByName();
  else if (a === "lootreset") lootReset(el);
  else if (a === "lootadd") { $("#loot-rows").insertAdjacentHTML("beforeend", lootRow({})); $("#loot-rows .lootrow:last-child .lt-n").focus(); }
  else if (a === "lootdel") { const r = el.closest(".lootrow"); if (r && confirmInline(el)) { r.remove(); lootSuggestDraw(); } }
  else if (a === "lootimg") { const inp = el.closest(".lootrow").querySelector(".lt-img"); pickImage(async res => { inp.value = assetPath(res); toast("Image added"); }); }
  else if (a === "hbdel") { const row = el.closest(".hbrow"); if (row && confirmInline(el)) row.remove(); }
  else if (a === "delbook") {
    closeModal();
    const b = S.books.get(v);
    if (b && await confirmBox(`Delete the book “${b.title}”? This can't be undone.`, "Delete book")) { if (BE.id === v) { clearTimeout(BE.timer); BE.dirty = false; BE.id = null; beDraftDrop(v); } if (await safeWrite(() => S.db.doc("books/" + v).delete(), "Book deleted")) location.hash = "books"; }
  }
  else if (a === "edit") openEditor(el.dataset.id);
  else if (a === "closemodal") closeModal();
  else if (a === "rmdraft") { draftTags.splice(Number(el.dataset.k), 1); drawDraftTags(); }
  else if (a === "ftype") { const f = S.filter.types; f.has(v) ? f.delete(v) : f.add(v); render(); }
  else if (a === "ftag") { const f = S.filter.tags; f.has(v) ? f.delete(v) : f.add(v); render(); }
  else if (a === "fclear") { S.filter = { types: new Set(), tags: new Set(), q: "", mode: S.filter.mode }; S.beast.sbOnly = 0; S.beast.mat = 0; S.beast.lore = 0; S.beast.book = ""; render(); }
  else if (a === "tri") { const k = el.dataset.v === "bmat" ? "mat" : el.dataset.v === "blore" ? "lore" : "sbOnly"; S.beast[k] = ((Number(S.beast[k]) || 0) + 1) % 3; render(); const b = document.querySelector(`[data-act="tri"][data-v="${el.dataset.v}"]`); if (b) b.focus(); }
  else if (a === "filtertag") { S.filter.tags = new Set([v]); S.filter.types = new Set(); location.hash = "library"; }
  else if (a === "edittag") openTagEditor(v);
  else if (a === "worldstate") { ev.preventDefault(); S.world.state = String(S.world.state) === String(v) ? "" : String(v); S.world.prov = ""; S.world.limit = 120; if (route().v !== "world") location.hash = "world"; else render(); }
  else if (a === "more") { S.world.limit += 200; render(); }
  else if (a === "wsort") {
    const w = S.world;
    if (w.sort === v) w.dir = -w.dir;
    else { w.sort = v; w.dir = v === "pop" ? -1 : 1; }
    render();
  }
  else if (a === "newtown") {
    const t = S.townById.get(Number(v)); const pv = t.p ? provOf(t.p) : null;
    openEditor(null, { type: "location", title: t.n, townId: t.i, tags: [slugify(t.n), pv ? slugify(pv.n) : null].filter(Boolean) });
  }
  else if (a === "del") {
    const e = S.entries.get(el.dataset.id);
    if (await confirmBox(`Delete “${e.title}”? This can't be undone.`, "Delete entry")) {
      if (await safeWrite(() => S.db.doc("entries/" + el.dataset.id).delete(), "Entry deleted")) location.hash = "library";
    }
  }
  else if (a === "deltag") {
    const users = [...S.entries.entries()].filter(([, e]) => (e.tags || []).includes(v));
    const kids = children(v);
    if (await confirmBox(`Delete the tag “${tagName(v)}”? It will be removed from ${users.length} entr${users.length === 1 ? "y" : "ies"}${kids.length ? ` and its ${kids.length} narrower tag${kids.length === 1 ? "" : "s"} move up a level` : ""}.`, "Delete tag")) {
      const parent = tagParent(v);
      const ok = await safeWrite(async () => {
        for (const [id, e] of users) await S.db.doc("entries/" + id).update({ tags: e.tags.filter(t => t !== v), updated: new Date().toISOString() });
        for (const k of kids) { const t = S.tags.get(k) || { name: tagName(k) }; await S.db.doc("tags/" + k).set(Object.assign({}, t, { parent: parent || null })); }
        await S.db.doc("tags/" + v).delete();
      }, "Tag deleted");
      if (ok && route().v === "tag") location.hash = "tags";
    }
  }
  else if (a === "copybackup") {
    const data = JSON.stringify(libraryData());
    try { await navigator.clipboard.writeText(data); toast("Backup copied. Paste it into a note or file to keep it."); }
    catch (e) { $("#restore").value = data; $("#restore").select(); toast("Couldn't reach the clipboard. The backup is in the box below; copy it from there.", "bad"); }
  }
  else if (a === "restore") restoreFromText();
});
async function restoreFromText() {
  {
    let data; try { data = JSON.parse($("#restore").value); } catch (e) { toast("That isn't a codex backup. Paste the whole text you copied.", "bad"); return; }
    if (!data || data.kind !== "lore-codex-backup") { toast("That isn't a codex backup. Paste the whole text you copied.", "bad"); return; }
    const ents = Object.entries(data.entries || {}), tgs = Object.entries(data.tags || {});
    if (!(await confirmBox(`Load ${ents.length} entries, ${tgs.length} tags and ${Object.keys(data.books || {}).length} books${Object.keys(data.characters || {}).length ? `, ${Object.keys(data.characters).length} characters` : ""}${data.map ? " plus the map" : ""}?`, "Load"))) return;
    await safeWrite(async () => {
      for (const [id, t] of tgs) await S.db.doc("tags/" + slugify(id)).set(t);
      for (const [id, e] of ents) await S.db.doc("entries/" + id.replace(/[^A-Za-z0-9_-]/g, "")).set(e);
      for (const [id, b] of Object.entries(data.books || {})) await S.db.doc("books/" + id.replace(/[^A-Za-z0-9_-]/g, "")).set(b);
      for (const [id, c] of Object.entries(data.characters || {})) await S.db.doc("characters/" + id.replace(/[^A-Za-z0-9_-]/g, "")).set(c);
      for (const [id, c] of Object.entries(data.encounters || {})) await S.db.doc("encounters/" + id.replace(/[^A-Za-z0-9_-]/g, "")).set(c);
      for (const col of ["vttcamps", "vttpages", "vtttokens", "vttfog", "vttdraw"]) for (const [id, c] of Object.entries(data[col] || {})) await S.db.doc(col + "/" + id.replace(/[^A-Za-z0-9_-]/g, "")).set(c);
      if (data.map && data.map.meta && Array.isArray(data.map.towns)) {
        const importId = "i" + Date.now().toString(36), per = 300, chunks = Math.ceil(data.map.towns.length / per);
        for (let k = 0; k < chunks; k++) await S.db.doc("maptowns/c" + k).set({ importId, idx: k, towns: data.map.towns.slice(k * per, (k + 1) * per) });
        await S.db.doc("map/meta").set(Object.assign({}, data.map.meta, { importId, chunks }));
      }
    }, "Library restored");
  }
}
document.addEventListener("toggle", ev => {
  const t = ev.target;
  if (t.id === "libtags") { const was = S.libTagsOpen; S.libTagsOpen = t.open; if (t.open && !was) { const q = t.querySelector("#tagq"); if (q && matchMedia("(min-width: 700px)").matches) q.focus(); } }
  else if (t.id === "beasttags") { const was = S.beast.tagsOpen; S.beast.tagsOpen = t.open; if (t.open && !was) { const q = t.querySelector("#tagq"); if (q && matchMedia("(min-width: 700px)").matches) q.focus(); } }
  else if (t.classList && t.classList.contains("tpgroup") && !S.beast.tagQ) { if (t.open) S.beast.openGroups.add(t.dataset.root); else S.beast.openGroups.delete(t.dataset.root); }
}, true);
document.addEventListener("pointerdown", ev => {
  const pop = document.getElementById("beasttags");
  if (pop && pop.open && !ev.target.closest("#beasttags")) { pop.open = false; S.beast.tagsOpen = false; }
});
document.addEventListener("keydown", ev => {
  if (ev.key === "Escape") { const pop = document.getElementById("beasttags"); if (pop && pop.open) { pop.open = false; S.beast.tagsOpen = false; pop.querySelector("summary").focus(); return; } }
  if (ev.key === "Escape" && !$("#modal").hidden) closeModal();
  if (ev.target.id === "ed-tag" && (ev.key === "Enter" || ev.key === ",")) { ev.preventDefault(); addDraftTag(ev.target.value); ev.target.value = ""; }
  if (ev.target.id === "ed-tag" && ev.key === "Backspace" && !ev.target.value && draftTags.length) { draftTags.pop(); drawDraftTags(); }
  if (ev.key === "Enter" && ev.target.matches("tr[data-town]")) location.hash = "town-" + ev.target.dataset.town;
  if (ev.key === "Enter" && ev.target.matches(".tile[data-go]")) location.hash = ev.target.dataset.go;
  if (ev.key === "Enter" && ev.target.id === "homeq") { S.filter.q = ev.target.value; S.filter.types = new Set(); S.filter.tags = new Set(); location.hash = "library"; }
});
document.addEventListener("change", ev => {
  const t = ev.target;
  if (t.dataset && t.dataset.cf && (t.tagName === "SELECT" || t.type === "checkbox")) { charInput(t); return; }
  if (t.dataset && t.dataset.eqpick && t.value) { const id = t.dataset.id, from = t.value; let ok = false; charChange(id, x => { ok = invEquipFromGrid(x, from); }); if (!ok) toast("No free equipped slot for that.", "bad"); return; }
  if (t.dataset && (t.dataset.lvsub || t.dataset.asi)) { levelupInput(t); return; }
  if (["fill-cls", "fill-race", "fill-subrace", "fill-sub"].includes(t.id)) { CS.fill = Object.assign({}, CS.fill, t.id === "fill-cls" ? { cls: t.value } : t.id === "fill-race" ? { race: t.value, sub: "" } : t.id === "fill-subrace" ? { sub: t.value } : { withSub: t.checked }); render(); return; }
  if (t.id === "spcls") { SBS.cls = t.value; render(); return; }
  if (t.id === "spsrc") { SBS.src = t.value; render(); return; }
  if (t.id === "spcombat") { SBS.combat = t.checked; render(); return; }
  if (t.id === "payunit") { INV.pay.unit = t.value; payRefresh(); return; }
  if (t.classList && t.classList.contains("atk-kind")) {
    const atkEl = t.closest(".atk"), reach = atkEl.querySelector(".atk-reach");
    if (/Ranged/.test(t.value) && /^reach/.test(reach.value)) reach.value = /Melee or/.test(t.value) ? "reach 5 ft. or range 20/60 ft." : "range 80/320 ft.";
    if (!/Ranged/.test(t.value) && /^range/.test(reach.value)) reach.value = "reach 5 ft.";
    atkEl.querySelector(".atkprevtext").innerHTML = inline(esc(buildAttack(readAttack(atkEl))));
  }
  if (t.id === "ed-tag") { addDraftTag(t.value); t.value = ""; return; }
  if (t.id === "ed-type") { document.querySelectorAll(".typefields").forEach(fs => { fs.hidden = fs.dataset.for ? fs.dataset.for !== t.value : fs.dataset.forNot.split(" ").includes(t.value); }); return; }
  if (t.id === "it-cat") { $("#it-catother-wrap").hidden = t.value !== "__other"; harvestMode(); updateItemLine(); updateStatPanels(); return; }
  if (t.id === "st-dex") { $("#st-dexmax-wrap").hidden = !t.checked; updateStatPanels(); return; }
  if (t.id === "it-attune") { updateItemLine(); return; }
  if (t.id === "it-usetype") { document.querySelectorAll(".usepanel .reuse").forEach(x => { x.hidden = t.value !== "reusable"; }); return; }
  if (t.id === "it-magical") { document.querySelectorAll(".magiconly").forEach(x => { x.hidden = !t.checked; }); updateItemLine(); return; }
  const k = t.dataset.input; if (!k) return;
  if (k === "mapfile") { if (t.files[0]) importMap(t.files[0]); return; }
  if (k === "libfile") { if (t.files[0]) t.files[0].text().then(txt => { $("#restore").value = txt; restoreFromText(); }); return; }
  if (k === "showmarkers") { S.world.showMarkers = t.checked; render(); return; }
  if (k === "irar") { S.items.rarity = t.value; render(); return; }
  if (k === "bsort") { S.beast.sort = t.value; render(); return; }
  if (k === "bbook") { S.beast.book = t.value; render(); return; }
  if (k === "bsbonly") { S.beast.sbOnly = t.checked; render(); return; }
  const map = { wstate: "state", wprov: "prov", wculture: "culture", wgood: "good", wgroup: "group", wsort: "sort" };
  if (map[k]) { S.world[map[k]] = t.value; if (k === "wstate") S.world.prov = ""; S.world.limit = 120; render(); }
});
let inputTimer;
document.addEventListener("input", ev => {
  if (ev.target.dataset && ev.target.dataset.cf) { if (ev.target.id === "hpamt") return; charInput(ev.target); return; }
  if (ev.target.id === "hpamt") { CS.amt = ev.target.value; return; }
  if (["payamt", "paynote"].includes(ev.target.id)) { INV.pay[ev.target.id === "payamt" ? "amt" : "note"] = ev.target.value; payRefresh(); return; }
  if (ev.target.id === "spq") { clearTimeout(inputTimer); const val = ev.target.value; inputTimer = setTimeout(() => { SBS.q = val; const f = document.activeElement && document.activeElement.id; render(); const n = f && document.getElementById(f); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 150); return; }
  if (ev.target.id === "invq") { clearTimeout(inputTimer); const val = ev.target.value; inputTimer = setTimeout(() => { INV.q = val; const sh = document.querySelector(".sheet"), c = sh && S.chars.get(sh.dataset.id), l = $("#invlist"); if (c && l) l.innerHTML = invListHtml(c); }, 120); return; }
  if (ev.target.id === "srdq") { clearTimeout(inputTimer); const val = ev.target.value; inputTimer = setTimeout(() => { SRDS.q = val; SRDS.open = null; const r = $("#srdresults"); if (r) r.innerHTML = srdResultsHtml(); }, 120); return; }
  if (ev.target.id === "tagq") { S.beast.tagQ = ev.target.value; filterTagPicker(ev.target.value); return; }
  if (ev.target.matches && ev.target.matches("#it-base, #it-extra, #it-catother, .propparam")) updateItemLine();
  if (ev.target.matches && ev.target.matches("#it-catother, #st-ac, #st-dexmax")) updateStatPanels();
  if (ev.target.id === "it-catother") harvestMode();
  const atkEl = ev.target.closest && ev.target.closest(".atk");
  if (atkEl) {
    const a = readAttack(atkEl), avg = a.dice ? diceAvg(a.dice) : null;
    atkEl.querySelector(".atkprevtext").innerHTML = inline(esc(buildAttack(a)));
    atkEl.querySelector(".avgnote").innerHTML = avg ? `Average ${avg.total} · ${esc(avg.tip)}` : "&nbsp;";
  }
  const k = ev.target.dataset.input;
  if (k === "libq" || k === "wq") {
    clearTimeout(inputTimer);
    const val = ev.target.value;
    inputTimer = setTimeout(() => { if (k === "libq") S.filter.q = val; else { S.world.q = val; S.world.limit = 120; } render(); }, 180);
  }
  if (ev.target.id === "homeq") {
    clearTimeout(inputTimer);
    const val = ev.target.value;
    inputTimer = setTimeout(() => { if (val.trim().length >= 2) { S.filter.q = val; S.filter.types = new Set(); S.filter.tags = new Set(); location.hash = "library"; setTimeout(() => { const lq = $("#libq"); if (lq) { lq.focus(); lq.setSelectionRange(val.length, val.length); } }, 30); } }, 600);
  }
  if (ev.target.id === "q") {
    clearTimeout(inputTimer);
    const val = ev.target.value;
    inputTimer = setTimeout(() => { S.filter.q = val; S.filter.types = new Set(); S.filter.tags = new Set(); if (route().v !== "library") location.hash = "library"; else render(); const lq = $("#libq"); if (lq) lq.value = val; }, 250);
  }
});
document.addEventListener("submit", async ev => {
  ev.preventDefault();
  const f = ev.target, kind = f.dataset.form;
  if (kind === "entry") await saveEntry(f);
  else if (kind === "lore") {
    const id = f.dataset.id, e = S.entries.get(id); if (!e) return;
    const lore = $("#lore-text").value.trim();
    let body = String(e.body || "");
    // Drop an old "[Flavour text]" placeholder paragraph now that real lore exists.
    if (e.item && e.item.lore == null) { const paras = body.split(/\n\s*\n/); if (paras.length && /^\*[^*][\s\S]*\*$/.test(paras[0].trim()) && !/^\*[^*]+?\.\*\s/.test(paras[0].trim())) { paras.shift(); body = paras.join("\n\n"); } }
    const item = Object.assign({}, e.item || {}, { lore });
    if (await safeWrite(() => S.db.doc("entries/" + id).update({ item, body, updated: new Date().toISOString() }), "Lore saved")) closeModal();
  }
  else if (kind === "book") {
    const id = f.dataset.id || "b" + Date.now().toString(36);
    const prev = S.books.get(id) || {};
    const body = $("#bk-body").value, now = new Date().toISOString();
    const doc = Object.assign({}, prev, { title: $("#bk-title").value.trim() || "Untitled book", status: $("#bk-status").value, hidden: $("#bk-hidden").checked || undefined, body, words: body.replace(/\|[^\n]*\|/g, " ").split(/\s+/).filter(Boolean).length, order: prev.order != null ? prev.order : S.books.size, created: prev.created || now, updated: now });
    if (await safeWrite(() => S.db.doc("books/" + id).set(doc), "Book saved")) { closeModal(); location.hash = "book-" + id; }
  }
  else if (kind === "tag") {
    const slug = f.dataset.slug;
    const doc = { name: $("#tg-name").value.trim() || tagName(slug), parent: $("#tg-parent").value || null, description: $("#tg-desc").value };
    if (await safeWrite(() => S.db.doc("tags/" + slug).set(doc), "Tag saved")) closeModal();
  } else if (kind === "newtag") {
    const name = $("#nt-name").value.trim(), slug = slugify(name);
    if (!slug) { toast("Give the tag a name with at least one letter or number.", "bad"); return; }
    if (S.tags.has(slug)) { toast("“" + tagName(slug) + "” already exists.", "bad"); return; }
    await safeWrite(() => S.db.doc("tags/" + slug).set({ name, parent: $("#nt-parent").value || null, description: "" }), "Tag added");
  }
});

render();
initDb();
