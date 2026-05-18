/* Maxaria PWA — registro del service worker.
 * Se incluye en login.html, index.html y admin.html.
 */
(function () {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    // Los service workers solo funcionan en HTTPS o localhost.
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Cuando hay una nueva versión esperando, le decimos que tome el control.
        if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              nw.postMessage("SKIP_WAITING");
            }
          });
        });
      })
      .catch(() => {
        /* si falla, la app sigue funcionando como sitio normal */
      });

    // Reload al cambiar de SW activo, para que la próxima nav use código nuevo.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      // pequeño delay para evitar loop si el ciclo de install es muy rápido
      setTimeout(() => location.reload(), 50);
    });
  });
})();
