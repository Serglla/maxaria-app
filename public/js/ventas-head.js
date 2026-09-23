// Si /ventas se abre embebido como modal flotante desde el catálogo
// (?modal=1), ocultamos el topbar para que se vea como un modal limpio.
// Va en <head> (sin defer) para evitar el parpadeo del topbar. Archivo aparte
// (antes era un <script> inline) para poder activar la CSP.
if (new URLSearchParams(location.search).get("modal") === "1") {
  document.documentElement.classList.add("in-modal");
}
