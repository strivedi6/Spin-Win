/* Keeps the lobby screen working if the internet drops: the page and its files are cached.
   Always tries the network first, so updates you push to GitHub arrive automatically. */
const CACHE = "tco-spin-v1";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest",
  "assets/common.js", "assets/common.css", "assets/logo.png", "assets/icon-192.png", "assets/icon-512.png",
  "assets/fonts/jost-latin-400-normal.woff2", "assets/fonts/jost-latin-500-normal.woff2", "assets/fonts/jost-latin-600-normal.woff2",
  "assets/fonts/playfair-display-latin-500-normal.woff2", "assets/fonts/playfair-display-latin-500-italic.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;   // Google Sheet calls go straight to the network
  e.respondWith((async () => {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch(req, { signal: ctl.signal, cache: "no-cache" }); clearTimeout(t);
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      return hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error());
    }
  })());
});
