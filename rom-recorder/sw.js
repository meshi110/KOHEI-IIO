/*
 * ROMレコーダー service worker
 * アプリ本体: ネット優先(更新反映)・オフライン時キャッシュ
 * vendor/CDNの大きな不変アセット(モデル・WASM): キャッシュ優先
 */
const VERSION = "romrec-v1.0.0";
const CORE = [
  "./", "./index.html", "./css/style.css",
  "./js/angle-core.js", "./js/refs.js", "./js/store.js", "./js/chart.js",
  "./js/photo.js", "./js/ai.js", "./js/app.js",
  "./manifest.webmanifest", "./icons/icon.svg",
];
const CDN_HOSTS = ["cdn.jsdelivr.net", "storage.googleapis.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("romrec-") && k !== VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(req) {
  return caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) {
      const clone = res.clone();
      caches.open(VERSION).then((c) => c.put(req, clone));
    }
    return res;
  }));
}

function networkFirst(req) {
  return fetch(req).then((res) => {
    if (res.ok) {
      const clone = res.clone();
      caches.open(VERSION).then((c) => c.put(req, clone));
    }
    return res;
  }).catch(() =>
    caches.match(req).then((hit) => {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("./index.html");
      return new Response("offline", { status: 504, statusText: "offline" });
    })
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if ((sameOrigin && url.pathname.includes("/vendor/")) || CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req));
  } else if (sameOrigin) {
    e.respondWith(networkFirst(req));
  }
});
