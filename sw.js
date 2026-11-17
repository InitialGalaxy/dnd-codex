// DnD Codex web version: works offline, and shows pictures from your private GitHub repository.
// Pictures are fetched once with the key you entered (kept in this browser only) and then kept on the device.
const SHELL = "codex-shell-v1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(SHELL).then(c => c.addAll(["./", "./manifest.webmanifest", "./icon-192.png"])).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
function cfg() {
  return new Promise(res => {
    const r = indexedDB.open("dnd-codex-web", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onerror = () => res(null);
    r.onsuccess = () => { const q = r.result.transaction("kv").objectStore("kv").get("cfg"); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); };
  });
}
const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
async function picture(rel) {
  const cache = await caches.open("codex-images"), key = new URL(rel, self.registration.scope).href;
  const hit = await cache.match(key); if (hit) return hit;
  const c = await cfg(); if (!c) return new Response("", { status: 404 });
  try {
    const r = await fetch((c.api || "https://api.github.com") + "/repos/" + c.repo + "/contents/" + rel + "?ref=" + encodeURIComponent(c.branch || "main"),
      { headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github.raw", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store" });
    if (!r.ok) return new Response("", { status: r.status });
    const ext = (rel.split(".").pop() || "").toLowerCase();
    const resp = new Response(await r.blob(), { headers: { "Content-Type": TYPES[ext] || "application/octet-stream" } });
    await cache.put(key, resp.clone());
    return resp;
  } catch (e) { return new Response("", { status: 504 }); }
}
async function page(req) {
  const cache = await caches.open(SHELL);
  try { const r = await fetch(req, { cache: "no-store" }); if (r.ok) cache.put("./", r.clone()); return r; }
  catch (e) { return (await cache.match("./")) || new Response("Offline, and the codex hasn't been saved on this device yet.", { status: 503 }); }
}
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url); if (u.origin !== location.origin || e.request.method !== "GET") return;
  const base = new URL(self.registration.scope).pathname;
  if (!u.pathname.startsWith(base)) return;
  const rel = decodeURIComponent(u.pathname.slice(base.length));
  if (/^images\/[A-Za-z0-9._-]+$/.test(rel)) { e.respondWith(picture(rel)); return; }
  if (e.request.mode === "navigate" || rel === "" || rel === "index.html") { e.respondWith(page(e.request)); return; }
  if (rel === "manifest.webmanifest" || /^icon-\d+\.png$/.test(rel)) e.respondWith(caches.match(e.request).then(h => h || fetch(e.request)));
});
