/* Maxaria — Service Worker
 *
 * Estrategia:
 *  - Datos de la API (me, categories, products, clients)  → network-first, fallback al cache
 *  - Navegaciones HTML (login, catalogo, admin)            → network-first, fallback al cache
 *  - Assets estáticos en /public (CSS, JS, íconos)        → stale-while-revalidate
 *  - Imágenes de producto en /images/products             → cache-first con TTL implícito
 *  - Resto de /api/* y /logout                            → siempre red, sin cache
 *
 * Versionar CACHE_VERSION fuerza la invalidación de caches viejos al hacer deploy.
 */

const CACHE_VERSION = "maxaria-v2";
const STATIC_CACHE  = CACHE_VERSION + "-static";
const PAGES_CACHE   = CACHE_VERSION + "-pages";
const IMAGES_CACHE  = CACHE_VERSION + "-images";
const DATA_CACHE    = CACHE_VERSION + "-data";

// Archivos que precacheamos al instalar (shell de la app)
const PRECACHE_URLS = [
  "/manifest.json",
  "/css/styles.css",
  "/js/app.js",
  "/js/admin.js",
  "/js/offline.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// Endpoints de API que se cachean para uso offline (GET únicamente)
// Se usan con estrategia network-first: si hay red se actualiza el cache;
// si no hay red, se sirve la última versión cacheada.
const CACHEABLE_API_PREFIXES = [
  "/api/me",
  "/api/categories",
  "/api/products",
  "/api/clients",
  "/api/price-changes",
];

function isCacheableApiUrl(pathname) {
  return CACHEABLE_API_PREFIXES.some(function (prefix) {
    return pathname === prefix || pathname.startsWith(prefix + "?");
  });
}

// ---------- install: precache del shell ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
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

  // 1) Datos de API cacheables → network-first con fallback al cache
  if (isCacheableApiUrl(url.pathname)) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // 2) Resto de APIs, auth y health → siempre red, nunca cache
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/login" ||
    url.pathname === "/logout" ||
    url.pathname === "/healthz"
  ) {
    return; // sin respondWith → comportamiento default del browser
  }

  // 3) Navegaciones HTML → network-first
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(req, PAGES_CACHE));
    return;
  }

  // 4) Imágenes de producto → cache-first
  if (url.pathname.startsWith("/images/products/")) {
    event.respondWith(cacheFirst(req, IMAGES_CACHE));
    return;
  }

  // 5) Resto (CSS, JS, íconos, manifest) → stale-while-revalidate
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
    // Último recurso para navegaciones
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
