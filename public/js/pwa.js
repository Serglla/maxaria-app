/* Maxaria PWA — registro del service worker + banner de instalación.
 *
 * Por qué: el manifest ya declara display:standalone, pero eso solo aplica
 * cuando la app se abre desde el ícono instalado. Si el usuario entra por un
 * link (WhatsApp, historial), el navegador la muestra como pestaña común con
 * su barra de direcciones. Este banner invita a instalarla una vez; desde ahí
 * el ícono de la pantalla de inicio abre la app sin barra del navegador.
 */
(function () {
  "use strict";

  /* ---------- Service worker ---------- */
  if ("serviceWorker" in navigator) {
    var okProto =
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
    if (okProto) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
      });
    }
  }

  /* ---------- Estado ---------- */
  var DISMISS_KEY = "maxaria_pwa_dismissed";
  var DISMISS_DAYS = 7;
  var deferredPrompt = null;
  var banner = null;

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: minimal-ui)").matches) return true;
    } catch (_) {}
    if (navigator.standalone === true) return true; // iOS
    return false;
  }

  function isIos() {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    // iPadOS 13+ se hace pasar por Mac con touch
    return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  }

  function isMobile() {
    return isIos() || /Android|Mobile/i.test(navigator.userAgent || "");
  }

  function dismissedRecently() {
    try {
      var t = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (!t) return false;
      return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch (_) {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (_) {}
  }

  /* ---------- Estilos (inyectados para no tocar styles.css) ---------- */
  function injectStyles() {
    if (document.getElementById("pwa-install-style")) return;
    var css =
      ".pwa-install{position:fixed;left:10px;right:10px;bottom:10px;z-index:3000;" +
      "background:#1e3a5f;color:#fff;border-radius:14px;padding:12px 14px;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;align-items:center;gap:12px;" +
      "font-family:inherit;animation:pwaUp .25s ease-out}" +
      "@keyframes pwaUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}" +
      ".pwa-install[hidden]{display:none}" +
      ".pwa-install-ico{width:40px;height:40px;border-radius:9px;flex:0 0 40px;background:#fff;" +
      "object-fit:contain;padding:3px;box-sizing:border-box}" +
      ".pwa-install-txt{flex:1 1 auto;min-width:0;line-height:1.25}" +
      ".pwa-install-t{display:block;font-weight:800;font-size:14px}" +
      ".pwa-install-s{display:block;font-size:12px;opacity:.85;margin-top:2px}" +
      ".pwa-install-btn{flex:0 0 auto;background:#d97706;color:#fff;border:0;border-radius:9px;" +
      "padding:10px 14px;font-size:14px;font-weight:800;cursor:pointer}" +
      ".pwa-install-btn:active{opacity:.85}" +
      ".pwa-install-x{flex:0 0 auto;background:transparent;border:0;color:#fff;opacity:.7;" +
      "font-size:20px;line-height:1;cursor:pointer;padding:4px 6px}" +
      "@media (min-width:720px){.pwa-install{left:auto;right:16px;bottom:16px;max-width:420px}}";
    var st = document.createElement("style");
    st.id = "pwa-install-style";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- Banner ---------- */
  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function showBanner(mode) {
    if (banner || isStandalone() || dismissedRecently()) return;
    injectStyles();

    var esIos = mode === "ios";
    banner = document.createElement("div");
    banner.className = "pwa-install";
    banner.setAttribute("role", "dialog");
    banner.innerHTML =
      '<img class="pwa-install-ico" src="/icons/icon-192.png" alt="" />' +
      '<div class="pwa-install-txt">' +
      '<span class="pwa-install-t">Instalá la app</span>' +
      '<span class="pwa-install-s">' +
      (esIos
        ? "Tocá <b>Compartir</b> y elegí <b>Agregar a inicio</b>."
        : "Se abre sin la barra del navegador, como una app.") +
      "</span></div>" +
      (esIos ? "" : '<button class="pwa-install-btn" type="button">Instalar</button>') +
      '<button class="pwa-install-x" type="button" aria-label="Cerrar">&times;</button>';

    var btn = banner.querySelector(".pwa-install-btn");
    if (btn) {
      btn.addEventListener("click", async function () {
        if (!deferredPrompt) {
          hideBanner();
          return;
        }
        btn.disabled = true;
        try {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } catch (_) {}
        deferredPrompt = null;
        hideBanner();
      });
    }
    banner.querySelector(".pwa-install-x").addEventListener("click", function () {
      markDismissed();
      hideBanner();
    });

    document.body.appendChild(banner);
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  /* Android / Chrome / Brave / Edge: el navegador avisa que es instalable */
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    ready(function () {
      showBanner("prompt");
    });
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    markDismissed();
    hideBanner();
  });

  /* iOS no dispara beforeinstallprompt: mostramos las instrucciones manuales */
  if (isIos() && !isStandalone()) {
    ready(function () {
      setTimeout(function () {
        showBanner("ios");
      }, 1500);
    });
  }

  /* Marca en <html> por si el CSS quiere ajustar algo cuando corre instalada */
  ready(function () {
    if (isStandalone()) document.documentElement.classList.add("pwa-standalone");
    else if (isMobile()) document.documentElement.classList.add("pwa-browser");
  });
})();
