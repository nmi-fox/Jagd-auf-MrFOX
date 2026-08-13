// =====================================================================
// sw.js - Service Worker: macht "Jagd auf MrFOX" offline spielbar.
//
// WICHTIG für zukünftige Änderungen: Es gibt hier kein Build-System, das
// automatisch merkt, wenn sich eine Datei geändert hat. Wenn du eine der
// unten aufgeführten Dateien änderst, musst du CACHE_VERSION per Hand
// hochzählen (z.B. "v1" -> "v2") - sonst bekommen Besucher:innen weiter
// die alte, im Cache gespeicherte Version ausgeliefert.
// =====================================================================

const CACHE_VERSION = 'foxhunt-cache-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/maze.js',
  './js/hunters.js',
  './js/leaderboard.js',
  './js/game.js',
  './js/ui.js',
  './assets/MrFOX_walk.svg',
  './assets/MrFOX_sleep.svg',
  './assets/MrFOX_confetti.svg',
  './assets/Baum.svg',
  './assets/Jaeger.svg',
  './assets/icons/icon-16.png',
  './assets/icons/icon-32.png',
  './assets/icons/icon-48.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Fremde Domains (z.B. die Supabase-Bestenliste) werden NIE
  // abgefangen - sonst könnte die Liste veraltete Daten zeigen, oder ein
  // Speichern-Versuch würde fälschlich als "erfolgreich" durchgehen,
  // obwohl er nie beim echten Server angekommen ist.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
        return response;
      });
    })
  );
});
