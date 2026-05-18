/* Maxaria — Service Worker
 *
 * Estrategia:
 *  - Navegaciones HTML (login, catalogo, admin)     → network-first, fallback al cache
 *  - Assets estáticos en /public (CSS, JS, íconos)  → stale-while-revalidate
 *  - Imágenes de producto en /images/products       → cache-first con TTL implícito
 *  - APIs /api/*, /login, /logout                   → no se cachean nunca (siempre red)
 *
 * Versionar CACHE_VERSION fuerza la invalidación de caches viejos al hacer deploy.
 */

const CACHE_VERSION = "maxaria-v1";
const STATIC_CACHE  = CACHE_VERSION + "-static";
const PAGES_CACHE   = CACHE_VERSION + "-pages";
const IMAGES_CACHE  = CACHE_VERSION + "-images";

// Archivos que precacheamos al instalar (shell de la app)
const PRECACHE_URLS = [
  "/manifest.json",
  "/css/styles.css",
  "/js/app.js",
  "/js/admin.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// ---------- install: precache del shell ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll es atómico: si falla uno, no se cachea ninguno.
      // Usamos add() en loop para tolerar archivos que no existan todavía.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ---------- activate: limpiar caches viejos ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- fetch: routing ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POST/PUT/DELETE siempre van a la red

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // recursos externos: dejarlos pasar

  // 1) APIs y auth: siempre red, nunca cache
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/login" ||
    url.pathname === "/logout" ||
    url.pathname === "/healthz"
  ) {
    return; // sin respondWith → comportamiento default del browser
  }

  // 2) Navegaciones HTML → network-first
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(req, PAGES_CACHE));
    return;
  }

  // 3) Imágenes de producto → cache-first
  if (url.pathname.startsWith("/images/products/")) {
    event.respondWith(cacheFirst(req, IMAGES_CACHE));
    return;
  }

  // 4) Resto (CSS, JS, íconos, manifest) → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
});

// ---------- estrategias ----------
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Último recurso: pantalla de login cacheada (la mayoría de las navs van ahí)
    const fallback = await cache.match("/login");
    if (fallback) return fallback;
    return new Response(
      "<!doctype html><meta charset='utf-8'><title>Sin conexión</title>" +
      "<style>body{font-family:system-ui;padding:40px;color:#0f172a;text-align:center}" +
      "h1{font-size:22px;margin-bottom:8px}p{color:#64748b}</style>" +
      "<h1>Sin conexión</h1><p>No se pudo cargar la página. Probá de nuevo cuando vuelva internet.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

// ---------- mensaje desde la página para forzar update ----------
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
