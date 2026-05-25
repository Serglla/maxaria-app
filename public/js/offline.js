/**
 * Maxaria — Módulo offline
 *
 * Responsabilidades:
 *  - Banner de "Sin conexión" cuando no hay internet
 *  - Guardar pedidos en IndexedDB cuando el servidor no está disponible
 *  - Sincronizar automáticamente al recuperar la conexión
 *  - Mostrar toast con link a WhatsApp cuando el pedido se envía
 *
 * Expone window.OfflineMode para que app.js pueda interactuar.
 */
(function () {
  "use strict";

  // ─── IndexedDB ────────────────────────────────────────────────────────────

  var DB_NAME    = "maxaria-offline";
  var DB_VERSION = 1;
  var STORE      = "pending_orders";
  var _db        = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "localId", autoIncrement: true });
        }
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror   = function (e) { reject(e.target.error); };
    });
  }

  function dbAdd(record) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE, "readwrite");
        var req = tx.objectStore(STORE).add(record);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror   = function () { reject(req.error); };
      });
    });
  }

  function dbGetAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror   = function () { reject(req.error); };
      });
    });
  }

  function dbDelete(localId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE, "readwrite");
        var req = tx.objectStore(STORE).delete(localId);
        req.onsuccess = function () { resolve(); };
        req.onerror   = function () { reject(req.error); };
      });
    });
  }

  // ─── Banner de sin conexión ───────────────────────────────────────────────

  var _bannerEl = null;

  function getOrCreateBanner() {
    if (_bannerEl) return _bannerEl;
    _bannerEl = document.createElement("div");
    _bannerEl.id = "offline-banner";
    _bannerEl.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:2000;" +
      "background:#b45309;color:#fff;text-align:center;" +
      "font-size:13px;font-weight:600;padding:8px 16px;" +
      "box-shadow:0 2px 8px rgba(0,0,0,.25);display:none;";
    document.body.appendChild(_bannerEl);
    return _bannerEl;
  }

  function showOfflineBanner() {
    var el = getOrCreateBanner();
    el.textContent = "📵  Sin conexión — podés armar tu pedido y se enviará cuando vuelva internet";
    el.style.display = "block";
  }

  function hideOfflineBanner() {
    if (_bannerEl) _bannerEl.style.display = "none";
  }

  // ─── Toasts ───────────────────────────────────────────────────────────────

  function showToast(html, bg, durationMs) {
    var el = document.createElement("div");
    el.innerHTML = html;
    el.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
      "background:" + (bg || "#0f172a") + ";color:#fff;" +
      "padding:11px 18px;border-radius:9px;font-weight:600;font-size:14px;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.22);z-index:2100;" +
      "max-width:92vw;text-align:center;line-height:1.45;";
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, durationMs || 4500);
    return el;
  }

  // ─── Guardar pedido offline ───────────────────────────────────────────────

  /**
   * Guarda un pedido en IndexedDB.
   * @param {object} opts
   *   apiItems     [{id, qty}]                   — para POST /api/orders
   *   cartSnapshot [{id, name, price, qty}]       — para mostrar en la UI
   *   notes        string|null
   *   me           {id, username, fullName, ...}  — snapshot del usuario
   *   vendedorClient {id, name, levelName}|null
   *   phone        string                         — destino WhatsApp
   *   total        number
   *   message      string                         — texto del WA ya armado
   */
  function saveCart(opts) {
    var record = {
      items:          opts.apiItems,
      cartSnapshot:   opts.cartSnapshot,
      notes:          opts.notes         || null,
      me:             opts.me            || {},
      vendedorClient: opts.vendedorClient || null,
      phone:          opts.phone         || "",
      total:          opts.total         || 0,
      message:        opts.message       || "",
      timestamp:      Date.now(),
    };
    return dbAdd(record).then(function (localId) {
      showToast(
        "📦 Pedido guardado sin conexión<br>" +
        "<span style='font-weight:400;font-size:13px'>" +
        "Se enviará automáticamente cuando vuelva internet</span>",
        "#b45309",
        5500
      );
      _notifyBadge();
      return localId;
    });
  }

  // ─── Sincronización al volver la conexión ─────────────────────────────────

  var _syncRunning = false;

  function syncAll() {
    if (_syncRunning) return;
    _syncRunning = true;
    dbGetAll().then(function (orders) {
      if (!orders.length) { _syncRunning = false; return; }
      var chain = Promise.resolve();
      orders.forEach(function (order) {
        chain = chain.then(function () { return _sendOne(order); });
      });
      return chain;
    }).then(function () {
      _syncRunning = false;
    }, function () {
      _syncRunning = false;
    });
  }

  function _sendOne(order) {
    return fetch("/api/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ items: order.items, notes: order.notes }),
    })
    .then(function (resp) {
      // 401 = sesión expirada: dejar en cola, el user debe re-loguearse
      if (resp.status === 401) return null;
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    })
    .then(function (out) {
      if (!out) return; // session expirada, ignorar
      return dbDelete(order.localId).then(function () {
        // Notificar cambio de badge
        _notifyBadge();
        // Mostrar toast con link a WhatsApp (requiere click del usuario)
        var waText = encodeURIComponent(order.message + "\n\n#Pedido" + out.order.id);
        var waUrl  = "https://wa.me/" + order.phone + "?text=" + waText;
        var totalFmt = "$" + Number(order.total).toLocaleString("es-AR");
        showToast(
          "✅ Pedido #" + out.order.id + " enviado · " + totalFmt +
          "<br><a href='" + waUrl + "' target='_blank' rel='noopener' " +
          "style='color:#86efac;text-decoration:underline;font-weight:700'>" +
          "Abrir WhatsApp →</a>",
          "#065f46",
          10000
        );
      });
    })
    .catch(function () {
      // Sin conexión o error: dejar en cola
    });
  }

  // ─── Badge / listeners para app.js ────────────────────────────────────────

  var _badgeListeners = [];

  function _notifyBadge() {
    dbGetAll().then(function (orders) {
      var count = orders.length;
      _badgeListeners.forEach(function (fn) {
        try { fn(count, orders); } catch (_) {}
      });
    }).catch(function () {});
  }

  function onBadgeUpdate(fn) {
    _badgeListeners.push(fn);
    // Disparar inmediatamente con el estado actual
    dbGetAll().then(function (orders) {
      try { fn(orders.length, orders); } catch (_) {}
    }).catch(function () {});
  }

  // ─── Inicialización ────────────────────────────────────────────────────────

  // Mostrar banner si arrancamos sin red
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    // Esperar a que el DOM esté listo
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showOfflineBanner);
    } else {
      showOfflineBanner();
    }
  }

  window.addEventListener("offline", showOfflineBanner);
  window.addEventListener("online",  function () {
    hideOfflineBanner();
    // Pequeño delay para asegurar que la conexión esté estable
    setTimeout(syncAll, 1000);
  });

  // ─── API pública ──────────────────────────────────────────────────────────

  window.OfflineMode = {
    /** Guarda el carrito como pedido pendiente en IndexedDB. Devuelve Promise<localId>. */
    saveCart:      saveCart,
    /** Devuelve Promise<Array> con todos los pedidos pendientes. */
    getAll:        dbGetAll,
    /** Intenta enviar todos los pedidos pendientes al server ahora. */
    syncAll:       syncAll,
    /** Registra un callback que se llama con (count, orders) cada vez que cambia la cola. */
    onBadgeUpdate: onBadgeUpdate,
    /** Fuerza un disparo del badge sin cambiar datos (útil al abrir el drawer). */
    refreshBadge:  _notifyBadge,
    /** true si el navegador reporta que no hay conexión. */
    isOffline: function () { return !navigator.onLine; },
  };

})();
