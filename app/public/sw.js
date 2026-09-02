// Service Worker für die Offline-Fähigkeit.
//
// WICHTIG — Fehler vom 02.09.2026: Eine reine Cache-First-Strategie mit festem
// Cache-Namen liefert index.html für immer aus dem Cache aus. Da sich sw.js beim
// Deploy nicht ändert, installiert der Browser auch keine neue Fassung — die App
// aktualisiert sich dann nie wieder. Deshalb:
//   · Dokument-Anfragen laufen NETZWERK-ZUERST, Cache nur als Offline-Rückfall.
//   · Übrige Anfragen (Icons, Manifest) bleiben Cache-First, sie ändern sich selten.
//   · CACHE trägt eine Version. Beim Erhöhen werden alte Caches beim Aktivieren gelöscht.

const CACHE = 'weinbegleiter-shell-v2'
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.svg', './icon-512.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const anfrage = event.request
  if (anfrage.method !== 'GET') return
  if (new URL(anfrage.url).origin !== self.location.origin) return

  const istDokument = anfrage.mode === 'navigate' || anfrage.destination === 'document'

  if (istDokument) {
    // Netzwerk zuerst: online gibt es immer die aktuelle Fassung, offline den Cache.
    event.respondWith(
      fetch(anfrage)
        .then(antwort => {
          const kopie = antwort.clone()
          caches.open(CACHE).then(cache => cache.put(anfrage, kopie))
          return antwort
        })
        .catch(() => caches.match(anfrage).then(treffer => treffer || caches.match('./index.html'))),
    )
    return
  }

  event.respondWith(
    caches.match(anfrage).then(treffer => treffer || fetch(anfrage).then(antwort => {
      const kopie = antwort.clone()
      caches.open(CACHE).then(cache => cache.put(anfrage, kopie))
      return antwort
    }).catch(() => caches.match('./index.html'))),
  )
})
