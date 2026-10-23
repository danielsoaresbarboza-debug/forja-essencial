/* Forja.Treino — service worker for local hydration reminders.
   This is a static, backend-less PWA, so there is no push server: real
   "push while the phone is asleep" notifications aren't possible here.
   What IS possible without a server is Periodic Background Sync, which
   some browsers (mainly Chrome/Edge on Android, and some desktop Chrome
   installs) grant to an *installed* PWA that the person opens regularly.
   When granted, this worker wakes up roughly on the interval below and
   checks today's water total (mirrored into IndexedDB by the main app —
   service workers can't read localStorage/window.storage directly) and
   fires a local notification if the goal is behind pace. When the
   browser doesn't support/grant periodic sync (iOS Safari, most desktop
   browsers, a PWA that's rarely opened), the app's own in-tab interval
   (see app.js `startReminderLoop`) is the fallback — it only works while
   the tab is open, which is the normal, honest limit of a backend-less PWA. */

const DB_NAME = 'forja-essencial-reminders-db';
const DB_VERSION = 1;
const STORE = 'kv';
const NOTIFY_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h, mirrors the in-app loop's cadence

/* ================= OFFLINE APP SHELL CACHE =================
   This is a static, backend-less PWA, so "offline" just means: once the
   person has opened it with signal at least once, every HTML/CSS/JS file
   that makes up the app gets cached, and future loads (including with no
   signal at all — common at the gym) are served from that cache instead
   of failing.
   CACHE_VERSION is tied to the app's own changelog version (not a
   hand-maintained number) specifically because a hand-maintained number
   gets forgotten: it did, right after this cache shipped, and that stale
   cache then silently kept serving an old, already-fixed bug (the "Total:
   ~295 kcal" parsing fix) back to the person for several releases, because
   nothing ever told the browser the old cache was stale. Tying it to
   CURRENT_VERSION means every release that bumps the changelog (which is
   supposed to happen on every shipped change) automatically gets a fresh
   cache, and activate() below deletes the old one — no manual step to
   forget. */
let CACHE_VERSION = 'v1';
try{
  importScripts('changelog.js');
  if(self.ForjaChangelog && self.ForjaChangelog.CURRENT_VERSION) CACHE_VERSION = self.ForjaChangelog.CURRENT_VERSION;
}catch(e){ /* fall back to 'v1' — still correct, just won't auto-bump */ }
const CACHE_PREFIX = 'forja-essencial-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const SHELL_FILES = [
  './',
  'index.html',
  'app.css',
  'forja3.css',
  'tesseract.min.js',
  'local-db.js',
  'nutrition.js',
  'data-foundation.js',
  'sync-center.js',
  'privacy-lock.js',
  'nutrition-memory.js',
  'dashboard-layout.js',
  'feature-toggle.js',
  'weekly-report.js',
  'crossfit-results.js',
  'gym-catalog.js',
  'wger-library.js',
  'free-exercise-library.js',
  'free-exercise-pt.js',
  'gym-pt-synonyms.js',
  'exercise-names-pt.js',
  'exercise-names.js',
  'ready-workouts.js',
  'exercise-library.js',
  'muscle-anatomy-data.js',
  'muscle-anatomy-render.js',
  'muscle-day-map.js',
  'gym-training.js',
  'gym-ui.js',
  'gym-suggest.js',
  'exercise-library-tab.js',
  'exercise-longpress.js',
  'changelog.js',
  'gemini-vision.js',
  'quick-diet.js',
  'ui-sections.js',
  'ui-collapsible.js',
  'sheet-sync.js',
  'google-config.js',
  'google-direct.js',
  'home-hero.js',
  'sheet-sync-script.js',
  'install-app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'backup-status.js',
  'progress-calendar.js',
  'update-check.js',
  'creatine-tracker.js',
  'custom-week-cards.js',
  'onboarding.js',
  'app.js',
  'personalization.js',
  'crossfit-reading.js',
  'standalone-ui.js',
  'food-data.js',
  'activity-data.js',
  'reference-db.js',
  'estimates.js',
  'estimates-ui.js',
  'strava-core.js',
  'strava-ui.js',
  'health-connect.js',
  'diet-core.js',
  'diet-flow.js',
  'routine-diet.js',
  'barcode-food.js',
  'wod-library.js',
  'app-enhancements.js',
  'forja3.js',
  'forja-tour.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try{
      const cache = await caches.open(CACHE_NAME);
      // addAll fails the whole install if any single file 404s — use
      // individual puts so one missing/renamed file doesn't block the
      // rest of the shell from being cached.
      await Promise.all(SHELL_FILES.map(async (path) => {
        try{
          const req = new Request(path, { cache: 'reload' });
          const res = await fetch(req);
          if(res && res.ok) await cache.put(path, res);
        }catch(e){ /* that one file stays uncached — not fatal */ }
      }));
    }catch(e){ /* best-effort: app still works online without a cache */ }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return; // never intercept writes/uploads (e.g. Google Drive)
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // let cross-origin APIs (wger images, Google, etc.) go straight to network

  // Navigations (opening/reloading the app) always resolve to the cached shell when offline.
  if(req.mode === 'navigate'){
    event.respondWith((async () => {
      try{
        const fresh = await fetch(req);
        if(fresh && fresh.ok){
          const cache = await caches.open(CACHE_NAME);
          cache.put('index.html', fresh.clone());
        }
        return fresh;
      }catch(e){
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Everything else same-origin (css/js): stale-while-revalidate — serve
  // the cached copy instantly if there is one (fast, and works offline),
  // and refresh the cache in the background when signal is available.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const networkFetch = fetch(req).then((res) => {
      if(res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if(cached) { networkFetch; return cached; } // refresh in background, don't block on it
    const fromNetwork = await networkFetch;
    return fromNetwork || Response.error();
  })());
});

function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if(!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, value){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function todayKeyLocal(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function checkWaterAndNotify(){
  try{
    const date = await idbGet('water-date');
    const totalMl = await idbGet('water-total-ml');
    const goalMl = await idbGet('water-goal-ml');
    if(date !== todayKeyLocal()) return; // mirror is stale (app not opened today yet)
    if(typeof totalMl !== 'number' || typeof goalMl !== 'number') return;
    const missing = Math.round(goalMl - totalMl);
    if(missing <= 0) return;

    const lastNotify = (await idbGet('last-notify-ts')) || 0;
    if(Date.now() - lastNotify < NOTIFY_COOLDOWN_MS) return;
    await idbSet('last-notify-ts', Date.now());

    await self.registration.showNotification('💧 Hora de beber água', {
      body: `Faltam ${missing}ml pra bater a meta de hoje.`,
      icon: undefined,
      tag: 'forja-water-reminder',
      renotify: true,
    });
  }catch(e){
    // best-effort only — never throw out of a periodicsync handler
  }
}

self.addEventListener('periodicsync', (event) => {
  if(event.tag === 'water-check'){
    event.waitUntil(checkWaterAndNotify());
  }
});

// Fallback for the (rarer) one-off Background Sync API, triggered right
// after connectivity returns — not time-based, but a free extra check.
self.addEventListener('sync', (event) => {
  if(event.tag === 'water-check-sync'){
    event.waitUntil(checkWaterAndNotify());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for(const client of allClients){
      if('focus' in client) return client.focus();
    }
    if(self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
