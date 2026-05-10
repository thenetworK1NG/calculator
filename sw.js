/* ============================================================
   sw.js — Calculator / Menu — Service Worker
   Caches the app shell + icons for offline use.
   ============================================================ */

const CACHE_NAME  = 'bud-menu-v1';
const ICONS_CACHE = 'bud-menu-icons-v1';

/* App shell — everything needed to run the menu offline */
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase.js',
  './manifest.json',
  './icon.png',
  './icons/icons.json'
];

/* ─── Helper: pre-cache all icons listed in icons.json ─────── */
async function cacheAllIcons() {
  const cache = await caches.open(ICONS_CACHE);
  try {
    const res   = await fetch('./icons/icons.json');
    const icons = await res.clone().json();
    await cache.put('./icons/icons.json', res);
    await Promise.all(
      icons.map(icon =>
        fetch(`./icons/${icon.file}`)
          .then(r => { if (r && r.ok) return cache.put(`./icons/${icon.file}`, r); })
          .catch(() => { /* ignore missing icons */ })
      )
    );
  } catch {
    /* offline during install — icons cached on first use */
  }
}

/* ─── Install ───────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(cacheAllIcons)
      .then(() => self.skipWaiting())
  );
});

/* ─── Activate: clean up old caches ─────────────────────────── */
self.addEventListener('activate', event => {
  const KEEP = [CACHE_NAME, ICONS_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch ──────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Firebase & CDN — always network */
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  const path = url.pathname;

  /* icons.json — network-first so new icons are discovered */
  if (path.endsWith('/icons/icons.json') || path.includes('/icons/icons.json')) {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          if (response && response.ok) {
            const cache = await caches.open(ICONS_CACHE);
            cache.put(event.request, response.clone());
            /* Auto-cache any new icon PNGs */
            response.clone().json().then(icons => {
              icons.forEach(icon => {
                const iconUrl = new URL(`./${icon.file}`, event.request.url).href;
                caches.match(iconUrl).then(hit => {
                  if (!hit) {
                    fetch(iconUrl)
                      .then(r => { if (r && r.ok) cache.put(iconUrl, r); })
                      .catch(() => {});
                  }
                });
              });
            }).catch(() => {});
          }
          return response;
        })
        .catch(async () =>
          (await caches.match(event.request, { cacheName: ICONS_CACHE })) ||
          (await caches.match(event.request, { cacheName: CACHE_NAME }))
        )
    );
    return;
  }

  /* Icon PNGs — cache-first + background refresh */
  if (path.includes('/icons/') && path.endsWith('.png')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response && response.ok) {
              caches.open(ICONS_CACHE).then(c => c.put(event.request, response.clone()));
            }
            return response;
          })
          .catch(() => null);
        return cached || networkFetch;
      })
    );
    return;
  }

  /* Everything else — cache-first */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        return response;
      });
    })
  );
});
