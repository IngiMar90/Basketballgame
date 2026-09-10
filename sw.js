const CACHE = "korfubolti-v1";
const FILES = [
  "./", "./index.html", "./styles.css", "./game.js", "./manifest.webmanifest",
  "./assets/gym.webp", "./assets/hoop-game.webp", "./assets/ball-game.webp",
  ...Array.from({length: 8}, (_, i) => `./assets/player/frame-0${i}.webp`),
  "./assets/ui/icon-192.png", "./assets/ui/icon-512.png"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match("./index.html"))));
});
