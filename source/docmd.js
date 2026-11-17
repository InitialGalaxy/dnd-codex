// Shared by the app and the import script: Google-Docs markdown cleanup and 5e stat-block table parsing.
const ESC_PUNCT = /\\([\\`*_{}\[\]()#+\-.!|~>=<])/g;
// Turn Google's backslash-escaped markdown inside table cells back into plain markdown.
function unescapeCell(s) { return String(s || "").replace(ESC_PUNCT, "$1").replace(/ /g, " ").trim(); }
function cleanHeadingText(t) { return String(t || "").replace(/^(?:\\#|#)+\s*/, "").replace(/\*\*/g, "").replace(ESC_PUNCT, "$1").trim(); }

function splitRow(line) {
  const inner = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  const cells = []; let cur = "", k = 0;
  while (k < inner.length) {
    if (inner[k] === "\\" && k + 1 < inner.length) { cur += inner[k] + inner[k + 1]; k += 2; continue; }
    if (inner[k] === "|") { cells.push(cur); cur = ""; k++; continue; }
    cur += inner[k]; k++;
  }
  cells.push(cur);
  return cells.map(c => c.trim());
}
function isStatTable(lines) { return lines.some(l => /ARMOU?R CLASS/i.test(l)); }

// Parse a Google-Docs stat-block table into a structured stat block.
function parseStatTable(lines) {
  const rows = lines.filter(l => l.trim().startsWith("|") && !/^\|\s*:?-+:?\s*\|/.test(l.trim()))
    .map(splitRow).map(cells => cells.map(unescapeCell).filter(c => c.length));
  const sb = { name: "", subtitle: "", ac: "", hp: "", speed: "", exhaust: "", cr: "", prof: "", details: "", features: "" };
  const big = c => { const m = c.match(/^\*\*(.+?)\*\*\*\*(.*?)\*\*(?:\*(.*)\*)?\s*(.*)$/); return m ? { label: m[1].trim(), value: m[2].trim(), note: (m[3] || "").trim(), tail: (m[4] || "").trim() } : null; };
  const featureLines = [];
  for (const cells of rows) {
    if (!cells.length) continue;
    const first = cells[0];
    // Name/subtitle header row (templates): **NAME***subtitle*
    let m;
    if (cells.length === 1 && (m = first.match(/^\*\*([^*]+)\*\*\*([^*]+)\*$/))) { sb.name = m[1].trim(); sb.subtitle = m[2].trim(); continue; }
    const parsed = cells.map(big);
    if (parsed[0]) {
      for (const p of parsed) {
        if (!p) continue;
        const L = p.label.toUpperCase(), withNote = p.value + (p.note ? (/^(fly|swim|climb|burrow)/i.test(p.note) ? ", " + p.note : ` (${p.note})`) : "");
        if (/ARMOU?R CLASS/.test(L)) sb.ac = withNote;
        else if (L === "HIT POINTS") sb.hp = withNote;
        else if (L === "SPEED") sb.speed = withNote;
        else if (L.startsWith("EXHAUST")) sb.exhaust = withNote === "—" ? "" : withNote;
        else if (L === "CHALLENGE") sb.cr = withNote;
        else if (L.startsWith("PROFICIENCY")) sb.prof = p.value;
        else if (["STR", "DEX", "CON", "INT", "WIS", "CHA"].includes(L)) sb[L.toLowerCase()] = p.value;
      }
      continue;
    }
    // Section bar: **TRAITS**, **ACTIONS**...
    if (cells.length === 1 && (m = first.match(/^\*\*([A-Z][A-Z'’ \-]+)\*\*$/))) {
      const t = m[1].trim().toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
      featureLines.push("", "## " + t); continue;
    }
    // Details row: **Skills**  ...**Senses**  ...
    if (/^\*\*[A-Z][^*]*\*\*\s/.test(first) && !first.startsWith("***")) {
      const parts = first.split(/\*\*([^*]+)\*\*/).slice(1);
      const out = [];
      for (let k = 0; k < parts.length; k += 2) out.push(parts[k].trim() + ": " + (parts[k + 1] || "").trim());
      sb.details = out.join("\n"); continue;
    }
    // Feature rows: ***Name.*** text•  bullet***Name2.*** text
    const text = cells.join(" ");
    const pieces = text.split(/\*\*\*([^*]+?)\*\*\*/);
    if (pieces[0].trim()) featureLines.push(bulletize(pieces[0].trim()));
    for (let k = 1; k < pieces.length; k += 2) featureLines.push("***" + pieces[k].trim() + "*** " + bulletize((pieces[k + 1] || "").trim()));
  }
  sb.features = featureLines.filter(l => l !== "").join("\n\n");
  return sb;
}
function bulletize(t) {
  if (!t.includes("•")) return t;
  const [head, ...rest] = t.split("•");
  return head.trim() + "\n" + rest.map(r => "- " + r.trim()).join("\n");
}
if (typeof module !== "undefined") module.exports = { unescapeCell, cleanHeadingText, splitRow, isStatTable, parseStatTable, ESC_PUNCT };
