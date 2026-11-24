// Tiene una copia dei file dell'app, così si apre anche senza internet.
var VERSIONE = "spese-v3";
var FILE = ["./", "index.html", "app.js", "riconosci.js", "manifest.json", "icona-180.png", "icona-192.png", "icona-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSIONE).then(function (c) { return c.addAll(FILE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (chiavi) {
    return Promise.all(chiavi.filter(function (k) { return k !== VERSIONE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Prima la rete (così gli aggiornamenti arrivano), se manca internet la copia.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function (r) {
    var copia = r.clone();
    caches.open(VERSIONE).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
