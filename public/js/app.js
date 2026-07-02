/**
 * Maxaria - frontend del catalogo
 */
(function () {
  "use strict";

  const els = {
    userInfo: document.getElementById("user-info"),
    catList: document.getElementById("cat-list"),
    grid: document.getElementById("grid"),
    empty: document.getElementById("empty"),
    search: document.getElementById("search"),
    resultCount: document.getElementById("result-count"),
    logoutBtn: document.getElementById("logout-btn"),
    cartBtn: document.getElementById("cart-btn"),
    cartCount: document.getElementById("cart-count"),
    cartTotalTop: document.getElementById("cart-total-top"),
    cartDrawer: document.getElementById("cart-drawer"),
    cartClose: document.getElementById("cart-close"),
    cartBack: document.getElementById("cart-back"),
    cartBody: document.getElementById("cart-body"),
    cartTotal: document.getElementById("cart-total"),
    cartSend: document.getElementById("cart-send"),
    cartNotes: document.getElementById("cart-notes"),
    ordersBtn: document.getElementById("orders-btn"),
    ordersDrawer: document.getElementById("orders-drawer"),
    ordersClose: document.getElementById("orders-close"),
    ordersBack: document.getElementById("orders-back"),
    ordersBody: document.getElementById("orders-body"),
    ordersTitle: document.getElementById("orders-title"),
    earningsBtn: document.getElementById("earnings-btn"),
    earningsDrawer: document.getElementById("earnings-drawer"),
    earningsClose: document.getElementById("earnings-close"),
    earningsBack: document.getElementById("earnings-back"),
    earningsBody: document.getElementById("earnings-body"),
    priceChangesBtn: document.getElementById("price-changes-btn"),
    priceChangesDrawer: document.getElementById("price-changes-drawer"),
    pcClose: document.getElementById("pc-close"),
    pcBack: document.getElementById("pc-back"),
    pcBody: document.getElementById("pc-body"),
    pcTitle: document.getElementById("pc-title"),
    adminLink: document.getElementById("admin-link"),
    ventaBtn: document.getElementById("venta-btn"),
    levelSwitcher: document.getElementById("level-switcher"),
    levelSelect: document.getElementById("level-select"),
    backdrop: document.getElementById("drawer-backdrop"),
    catToggleBtn: document.getElementById("cat-toggle-btn"),
    catToggleCurrent: document.getElementById("cat-toggle-current"),
    sidebarEl: document.getElementById("sidebar"),
    sidebarClose: document.getElementById("sidebar-close"),
    vendedorBar: document.getElementById("vendedor-bar"),
    clientDrawer: document.getElementById("client-drawer"),
    clientClose: document.getElementById("client-close"),
    clientBack: document.getElementById("client-back"),
    clientBody: document.getElementById("client-body"),
    topbarMenuBtn:  document.getElementById("topbar-menu-btn"),
    topbarMenu:     document.getElementById("topbar-menu"),
    topbarUser:     document.getElementById("topbar-user"),
    topbarMenuUserName: document.getElementById("topbar-menu-user-name"),
    // Modal de detalle de producto (doble click / doble tap)
    productModal:   document.getElementById("product-modal"),
    pmClose:        document.getElementById("pm-close"),
    pmImg:          document.getElementById("pm-img"),
    pmCat:          document.getElementById("pm-cat"),
    pmName:         document.getElementById("pm-name"),
    pmCode:         document.getElementById("pm-code"),
    pmDesc:         document.getElementById("pm-desc"),
    pmStock:        document.getElementById("pm-stock"),
    pmPrice:        document.getElementById("pm-price"),
    pmActions:      document.getElementById("pm-actions"),
  };

  const LEVEL_NAMES = { 1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP" };
  const LS_VIEW_AS_LEVEL    = "maxaria.viewAsLevel";    // solo admin (nivel 1-4)
  const LS_VIEW_AS_LIST     = "maxaria.viewAsListId";   // solo admin (lista personalizada)
  const LS_VENDEDOR_CLIENT  = "maxaria.vendedorClient"; // solo vendedor (level 5)

  const state = {
    me: null, categories: [], products: [], cat: "all", query: "",
    cart: new Map(),
    // Solo aplica si me.level === 99: el admin esta viendo el catalogo
    // con la lista de precios de OTRO nivel (1..4). null = ver con su
    // propio mapeo (admin usa minorista por defecto en server).
    viewAsLevel: null,
    // Solo aplica si me.level === 99: id de la lista personalizada (L1, L2, ...)
    // que el admin está mirando. Tiene prioridad sobre viewAsLevel cuando != null.
    viewAsListId: null,
    // Solo aplica si me.level === 5: cliente que está atendiendo el vendedor.
    // null = aún no eligió cliente (catálogo sin precios).
    vendedorClient: null,
    clients: [], // lista de usuarios (level 1-4) cargada para vendedores
  };

  function fmtPrice(n) { return "$" + (Number(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  // Búsqueda por inicio de palabra: cada término del query tiene que ser
  // prefijo de alguna palabra del texto (ignora mayúsculas y acentos).
  function normSearch(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function matchWords(text, q) {
    const words = normSearch(text).split(/[^a-z0-9]+/).filter(Boolean);
    const terms = normSearch(q).split(/[^a-z0-9]+/).filter(Boolean);
    return terms.every((t) => words.some((w) => w.startsWith(t)));
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Modal de confirmación/aviso propio (reemplaza confirm()/alert() nativos, que
  // muestran el dominio "...railway.app dice" y botones no editables). Acepta
  // string (= mensaje) u objeto { title, message, confirmText, cancelText,
  // danger, alert }. Devuelve Promise<boolean>. Con alert:true oculta Cancelar.
  // Maneja su cierre en captura (Escape/Enter/overlay). Fallback a nativo si
  // falta el HTML.
  function confirmModal(opts) {
    if (typeof opts === "string") opts = { message: opts };
    opts = opts || {};
    return new Promise((resolve) => {
      const modal = document.getElementById("confirm-modal");
      const titleEl = document.getElementById("confirm-modal-title");
      const bodyEl = document.getElementById("confirm-modal-body");
      const okBtn = document.getElementById("confirm-modal-ok");
      const cancelBtn = document.getElementById("confirm-modal-cancel");
      if (!modal || !okBtn || !cancelBtn) {
        if (opts.alert) { window.alert(opts.message || ""); resolve(true); }
        else resolve(window.confirm(opts.message || ""));
        return;
      }
      const appName = (state.me && (state.me.app_name || state.me.appName)) || "Maxaria";
      titleEl.textContent = opts.title || appName;
      bodyEl.textContent = opts.message || "";
      okBtn.textContent = opts.confirmText || (opts.alert ? "Aceptar" : "Confirmar");
      cancelBtn.textContent = opts.cancelText || "Cancelar";
      cancelBtn.hidden = !!opts.alert;
      okBtn.className = "btn " + (opts.danger ? "btn-danger" : "btn-primary");
      modal.hidden = false;
      function cleanup(val) {
        modal.hidden = true;
        cancelBtn.hidden = false;
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onOverlay);
        document.removeEventListener("keydown", onKey, true);
        resolve(val);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlay(e) { if (e.target === modal) cleanup(!!opts.alert); }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cleanup(!!opts.alert); }
        else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); cleanup(true); }
      }
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      modal.addEventListener("click", onOverlay);
      document.addEventListener("keydown", onKey, true);
      okBtn.focus();
    });
  }
  function alertModal(opts) {
    if (typeof opts === "string") opts = { message: opts };
    return confirmModal(Object.assign({}, opts, { alert: true }));
  }

  async function api(url, opts) {
    const res = await fetch(url, opts);
    if (res.status === 401) { location.href = "/login"; throw new Error("no auth"); }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Error " + res.status);
    }
    return res.json();
  }

  function loadViewAsLevel() {
    try {
      const v = Number(localStorage.getItem(LS_VIEW_AS_LEVEL));
      return [1, 2, 3, 4].includes(v) ? v : null;
    } catch (_) { return null; }
  }
  function loadViewAsListId() {
    try {
      const v = Number(localStorage.getItem(LS_VIEW_AS_LIST));
      return v > 0 ? v : null;
    } catch (_) { return null; }
  }

  function productsUrl() {
    if (state.me && state.me.level === 99) {
      // Admin viendo como otra lista personalizada (L1, L2, etc). preview=1
      // hace que el server tambien oculte las categorias desactivadas
      // (visibilidad global), igual que lo veria un cliente real.
      if (state.viewAsListId) return "/api/products?as_list_id=" + state.viewAsListId + "&preview=1";
      // Admin viendo como otro nivel base (Minorista/Revendedor/Mayorista/VIP)
      if (state.viewAsLevel)  return "/api/products?as_level=" + state.viewAsLevel + "&preview=1";
    }
    return "/api/products";
  }

  function categoriesUrl() {
    // Admin "viendo como" un nivel/lista: pedir la vista filtrada (preview),
    // que oculta las categorias desactivadas en Configuracion, igual que la
    // ve un cliente. Sin "ver como" activo, el admin ve todas.
    if (state.me && state.me.level === 99 && (state.viewAsListId || state.viewAsLevel)) {
      return "/api/categories?preview=1";
    }
    return "/api/categories";
  }

  async function bootstrap() {
    try {
      const me = await api("/api/me");
      state.me = me;
      if (me.level === 99) {
        // Restaurar la lista personalizada tiene prioridad sobre el nivel base.
        state.viewAsListId = loadViewAsListId();
        state.viewAsLevel  = state.viewAsListId ? null : loadViewAsLevel();
      }
      if (me.level === 5) {
        state.vendedorClient = me.vendedorClient || null;
        // Si el servidor no tiene el cliente en sesión (reload, reinicio del server, etc.),
        // intentar recuperarlo del localStorage.
        if (!state.vendedorClient) {
          try {
            const saved = JSON.parse(localStorage.getItem(LS_VENDEDOR_CLIENT));
            if (saved && saved.id) {
              state.vendedorClient = saved;
              // Resinc con el servidor si hay conexión, para que POST /api/orders
              // sepa a qué cliente pertenece el pedido.
              if (navigator.onLine) {
                fetch("/api/vendedor/select-client", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ client_id: saved.id }),
                }).catch(() => {});
              }
            }
          } catch (_) {}
        } else {
          // Servidor tiene el cliente: mantener localStorage sincronizado.
          try { localStorage.setItem(LS_VENDEDOR_CLIENT, JSON.stringify(state.vendedorClient)); } catch (_) {}
        }
        state.clients = await api("/api/clients");
      }
      const [cats, prods] = await Promise.all([
        api(categoriesUrl()), api(productsUrl()),
      ]);
      state.categories = cats; state.products = prods;
      if (me.app_name) {
        const brandEl = document.getElementById("topbar-brand-name");
        if (brandEl) brandEl.textContent = me.app_name;
        const titleEl = document.getElementById("page-title");
        if (titleEl) titleEl.textContent = me.app_name + " · Catálogo";
      }
      renderVendedorBar();
      renderUser(); renderCategories(); renderProducts();
      // Avisar al cliente si alguno de sus pedidos avanzó de etapa (en
      // preparación / listo para entregar / entregado) desde la última visita.
      if (me.level >= 1 && me.level <= 4) {
        api("/api/my-notifications").then(notifyOrderUpdates).catch(() => {});
      }
      _lastCatalogRefresh = Date.now();
    } catch (e) { console.error(e); }
  }

  // Re-consulta categorías y productos y re-renderiza, conservando el filtro de
  // categoría, la búsqueda y el cliente seleccionado. Sirve para que los productos
  // que el admin agrega aparezcan sin tener que cerrar la app ni hacer hard refresh.
  let _lastCatalogRefresh = 0;
  let _refreshingCatalog = false;
  async function refreshCatalog(force) {
    if (!state.me) return;                 // todavía no terminó el bootstrap inicial
    if (_refreshingCatalog) return;        // evitar solapamiento
    const now = Date.now();
    // Throttle: no refrescar más de una vez cada 10s salvo que se fuerce.
    if (!force && now - _lastCatalogRefresh < 10000) return;
    _refreshingCatalog = true;
    try {
      const [cats, prods] = await Promise.all([
        api(categoriesUrl()), api(productsUrl()),
      ]);
      state.categories = cats;
      state.products = prods;
      _lastCatalogRefresh = Date.now();
      renderCategories();
      renderProducts();
    } catch (_) {
      // Sin conexión o error: dejamos el catálogo actual como está.
    } finally {
      _refreshingCatalog = false;
    }
  }

  // Disparadores del auto-refresh: cuando el usuario vuelve a la app (cambia de
  // pestaña/app y vuelve, o reabre la PWA desde segundo plano) re-consultamos el
  // catálogo. Cubre el caso de dispositivos que mantienen la app abierta.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshCatalog();
  });
  window.addEventListener("focus", () => refreshCatalog());
  // pageshow con persisted=true = restaurada desde el back-forward cache.
  window.addEventListener("pageshow", (e) => { if (e.persisted) refreshCatalog(true); });

  function renderUser() {
    const u = state.me; if (!u) return;
    // El sub "Administrador - Administrador (viendo como VIP)" se ocultó del
    // topbar (decisión 27 may 2026): ya se ve el contexto en otros lugares.
    if (els.userInfo) els.userInfo.textContent = "";
    // Chip con el nombre del usuario al lado del buscador (solo nombre,
    // sin rol, para que entre cómodo). El rol se ve en el menú/contexto.
    // En mobile el chip está hidden por CSS; el nombre se ve en el dropdown.
    const fullName = u.fullName || u.username || "";
    const nameWithRole = fullName + (u.levelName ? " · " + u.levelName : "");
    if (els.topbarUser) {
      els.topbarUser.textContent = fullName;
      els.topbarUser.title = nameWithRole;
    }
    // Header del menú dropdown: muestra nombre + rol siempre visible al abrir.
    if (els.topbarMenuUserName) {
      els.topbarMenuUserName.textContent = nameWithRole;
    }
    if (els.ordersBtn) {
      els.ordersBtn.textContent = u.level === 99 ? "Todos los pedidos" : "Mis pedidos";
    }
    if (els.earningsBtn) {
      // Solo vendedores (level 5) ven el panel de ganancias
      els.earningsBtn.hidden = u.level !== 5;
    }
    if (els.adminLink) {
      els.adminLink.hidden = u.level !== 99;
    }
    if (els.ventaBtn) {
      // Vendedores (5) y admin (99) ven el botón de Venta en el catálogo
      els.ventaBtn.hidden = u.level !== 5 && u.level !== 99;
    }
    if (els.priceChangesBtn) {
      // El vendedor ve los cambios segun el nivel del cliente seleccionado
      // (o segun su vendedor_price_level si no hay cliente).
      els.priceChangesBtn.hidden = !u.canSeePriceChanges;
    }
    // Selector "Ver como ...": SOLO admin. Carga niveles base + listas personalizadas
    // que el admin haya creado (L1, L2, etc) y permite cambiar la vista del catálogo.
    if (els.levelSwitcher) {
      const isAdmin = u.level === 99;
      els.levelSwitcher.hidden = !isAdmin;
      if (isAdmin) populateLevelSelect();
    }
  }

  // Pobla el <select id="level-select"> con los 4 niveles base + listas personalizadas
  // activas. Se llama al cargar (renderUser) y la primera vez que se ejecuta hace fetch.
  let _priceListsCache = null;
  async function populateLevelSelect() {
    if (!els.levelSelect) return;
    // Cargar listas si todavía no se cargaron
    if (_priceListsCache === null) {
      try {
        const lists = await api("/api/admin/price-lists");
        _priceListsCache = (lists || []).filter((l) => l.active);
      } catch (_) {
        _priceListsCache = [];
      }
    }
    // Reconstruir las opciones: 4 niveles base + listas personalizadas
    const baseOpts =
      '<option value="1">Minorista</option>' +
      '<option value="2">Revendedor</option>' +
      '<option value="3">Mayorista</option>' +
      '<option value="4">VIP</option>';
    const listsHtml = _priceListsCache.length
      ? '<optgroup label="Listas personalizadas">' +
        _priceListsCache.map((l) =>
          '<option value="list:' + l.id + '">' + escapeHtml(l.name) + '</option>'
        ).join("") + '</optgroup>'
      : '';
    els.levelSelect.innerHTML = baseOpts + listsHtml;
    // Restaurar selección actual
    if (state.viewAsListId) els.levelSelect.value = "list:" + state.viewAsListId;
    else                    els.levelSelect.value = String(state.viewAsLevel || 1);
  }

  function renderCategories() {
    const isAdmin = state.me && state.me.level === 99;
    // El contador "(N)" se muestra SOLO al admin. A los clientes les
    // mostramos solo el nombre de la categoria, asi no se ven los
    // numeros de stock (eso es info interna).
    const totalLabel = isAdmin
      ? "Todas (" + state.products.length + ")"
      : "Todas";
    const items = [
      '<li><button class="cat-btn ' + (state.cat === "all" ? "active" : "") + '" data-cat="all">' + escapeHtml(totalLabel) + '</button></li>',
    ];
    state.categories.forEach((c) => {
      const count = state.products.filter((p) => p.category_id === c.id).length;
      if (!count) return; // categorias vacias se siguen ocultando para todos
      const label = isAdmin
        ? c.name + " (" + count + ")"
        : c.name;
      items.push(
        '<li><button class="cat-btn ' + (state.cat === c.id ? "active" : "") + '" data-cat="' + c.id + '">' + escapeHtml(label) + '</button></li>'
      );
    });
    els.catList.innerHTML = items.join("");
    els.catList.querySelectorAll(".cat-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.cat;
        state.cat = v === "all" ? "all" : Number(v);
        renderCategories(); renderProducts();
        // En mobile, cerrar el drawer del sidebar al elegir categoria
        if (els.sidebarEl && els.sidebarEl.classList.contains("sidebar-open")) {
          closeDrawers();
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    updateCatToggleLabel();
  }

  function updateCatToggleLabel() {
    if (!els.catToggleCurrent) return;
    if (state.cat === "all") {
      els.catToggleCurrent.textContent = "Todas";
    } else {
      const cat = state.categories.find((c) => c.id === state.cat);
      els.catToggleCurrent.textContent = cat ? cat.name : "Todas";
    }
  }

  function filterProducts() {
    let list = state.products;
    if (state.cat !== "all") list = list.filter((p) => p.category_id === state.cat);
    if (state.query) {
      const q = state.query;
      list = list.filter((p) => matchWords((p.code || "") + " " + (p.name || "") + " " + (p.category_name || ""), q));
    }
    return list;
  }

  function renderProducts() {
    const list = filterProducts();
    els.resultCount.textContent = list.length + (list.length === 1 ? " producto" : " productos");
    if (!list.length) { els.grid.innerHTML = ""; els.empty.hidden = false; return; }
    els.empty.hidden = true;
    // Cuando se muestran todas las categorias (o hay busqueda con varias),
    // insertar un encabezado de categoria de ancho completo antes de cada
    // grupo para que la nueva categoria siempre arranque en una fila nueva.
    const showHeaders = state.cat === "all" || (state.query && new Set(list.map(p => p.category_id)).size > 1);
    if (showHeaders) {
      const parts = [];
      let lastCat = null;
      list.forEach((p) => {
        if (p.category_id !== lastCat) {
          lastCat = p.category_id;
          parts.push('<div class="grid-cat-header">' + escapeHtml(p.category_name || "") + '</div>');
        }
        parts.push(cardHtml(p));
      });
      els.grid.innerHTML = parts.join("");
    } else {
      els.grid.innerHTML = list.map((p) => cardHtml(p)).join("");
    }
    // Event delegation: un solo handler en la grilla maneja add/inc/dec
    // de TODOS los cards. Asi no hay que re-bindear handlers cada
    // vez que se vuelve a renderizar la accion de un card.
  }

  // ----- Flujo vendedor: selección de cliente -----

  function renderVendedorBar() {
    if (!els.vendedorBar) return;
    if (!state.me || state.me.level !== 5) {
      els.vendedorBar.hidden = true;
      document.documentElement.style.setProperty("--vbar-h", "0px");
      return;
    }
    els.vendedorBar.hidden = false;
    if (state.vendedorClient) {
      els.vendedorBar.className = "vendedor-bar vendedor-bar-has-client";
      els.vendedorBar.innerHTML =
        '<div class="vendedor-bar-inner">' +
          '<span>Atendiendo a: <strong>' + escapeHtml(state.vendedorClient.name) + '</strong>' +
            ' <span class="vb-level">(' + escapeHtml(state.vendedorClient.levelName) + ')</span>' +
          '</span>' +
          '<button class="vb-change-btn" id="vb-change-btn" type="button">Cambiar cliente</button>' +
        '</div>';
      document.getElementById("vb-change-btn").addEventListener("click", openClientPicker);
    } else {
      els.vendedorBar.className = "vendedor-bar vendedor-bar-no-client";
      // Tercerizado: ya ve su lista de costos. El cartel cambia para indicarlo.
      const esTercerizado = !!(state.me && state.me.restrictedToAssigned);
      const msg = esTercerizado
        ? 'Viendo tu lista de costos. Seleccioná un cliente para tomar un pedido.'
        : 'Seleccioná un cliente para ver los precios del catálogo';
      els.vendedorBar.innerHTML =
        '<div class="vendedor-bar-inner">' +
          '<span>' + msg + '</span>' +
          '<button class="vb-select-btn" id="vb-select-btn" type="button">Seleccionar cliente</button>' +
        '</div>';
      document.getElementById("vb-select-btn").addEventListener("click", openClientPicker);
    }
    // Actualizar variable CSS para que el sidebar sticky quede debajo de la barra
    requestAnimationFrame(() => {
      const h = els.vendedorBar.offsetHeight;
      document.documentElement.style.setProperty("--vbar-h", h + "px");
    });
  }

  function openClientPicker() {
    renderClientPickerUI("");
    openDrawer(els.clientDrawer);
    // Foco en el campo de búsqueda al abrir
    setTimeout(() => {
      const inp = document.getElementById("client-search-input");
      if (inp) inp.focus();
    }, 80);
  }

  function renderClientPickerUI(filter) {
    filter = (filter || "").toLowerCase().trim();
    const list = filter
      ? state.clients.filter((c) => matchWords((c.full_name || "") + " " + (c.username || ""), filter))
      : state.clients;

    let html =
      '<div class="client-search-wrap">' +
        '<input class="client-search-input" type="search" id="client-search-input"' +
        '  placeholder="Buscar por nombre o usuario..." autocomplete="off"' +
        '  value="' + escapeHtml(filter) + '" />' +
      '</div>';

    if (!state.clients.length) {
      html += '<p class="muted">No hay clientes registrados.</p>';
    } else if (!list.length) {
      html += '<p class="muted">No se encontraron clientes con ese nombre.</p>';
    } else {
      html += '<ul class="client-list">';
      list.forEach((c) => {
        const selected = state.vendedorClient && state.vendedorClient.id === c.id;
        html +=
          '<li class="client-item' + (selected ? ' client-item--selected' : '') + '" data-id="' + c.id + '">' +
            '<div class="client-item-name">' + escapeHtml(c.full_name || c.username) + '</div>' +
            '<div class="client-item-meta">' + escapeHtml(c.username) + ' &middot; ' + escapeHtml(c.levelName) + '</div>' +
          '</li>';
      });
      html += '</ul>';
    }

    els.clientBody.innerHTML = html;

    const inp = document.getElementById("client-search-input");
    if (inp) {
      inp.addEventListener("input", debounce(() => renderClientPickerUI(inp.value), 180));
    }
    els.clientBody.querySelectorAll(".client-item").forEach((item) => {
      item.addEventListener("click", () => {
        const id = Number(item.dataset.id);
        const client = state.clients.find((c) => c.id === id);
        if (client) selectClient(client);
      });
    });
  }

  async function selectClient(client) {
    if (state.cart.size > 0) {
      const ok = await confirmModal(
        "Tenés " + state.cart.size + " producto(s) en el carrito.\n\n" +
        "¿Cambiar al cliente " + (client.full_name || client.username) + " y vaciar el carrito?"
      );
      if (!ok) return;
      const ids = Array.from(state.cart.keys());
      state.cart.clear();
      if (els.cartNotes) els.cartNotes.value = "";
      renderCart();
      ids.forEach(refreshCardForProduct);
    }
    // Aplica el cliente elegido en el estado local y recarga catálogo desde cache/red.
    // Se usa tanto en el flujo normal como en el fallback offline.
    async function applyClientLocally() {
      state.vendedorClient = { id: client.id, name: client.full_name || client.username,
                               level: client.level, levelName: client.levelName };
      try { localStorage.setItem(LS_VENDEDOR_CLIENT, JSON.stringify(state.vendedorClient)); } catch (_) {}
      state.cat = "all";
      state.query = "";
      if (els.search) els.search.value = "";
      const [cats, prods] = await Promise.all([api("/api/categories"), api("/api/products")]);
      state.categories = cats;
      state.products = prods;
      closeDrawers();
      renderVendedorBar();
      renderCategories();
      renderProducts();
    }
    try {
      // navigator.onLine es poco confiable (true con WiFi sin internet),
      // así que intentamos el POST y si falla por red usamos el fallback offline.
      if (!navigator.onLine) {
        await applyClientLocally();
        return;
      }
      await api("/api/vendedor/select-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id }),
      });
      await applyClientLocally();
    } catch (e) {
      // TypeError = error de red (Failed to fetch, sin conexión real).
      // En ese caso cargamos el catálogo desde el cache del Service Worker.
      if (e instanceof TypeError) {
        try {
          await applyClientLocally();
        } catch (e2) {
          alertModal("Sin conexión y no hay catálogo guardado. Abrí la app con internet al menos una vez.");
        }
      } else {
        alertModal("Error al seleccionar cliente: " + (e.message || "Error desconocido"));
      }
    }
  }

  function cardHtml(p) {
    const img = p.image_url
      ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" />'
      : '<div class="muted" style="font-size:12px;padding:8px;text-align:center">Sin foto</div>';
    const inCart = state.cart.has(p.id);
    const noClient = state.me && state.me.level === 5 && !state.vendedorClient;
    // Si el vendedor no tiene cliente seleccionado, no puede agregar al carrito.
    // El precio: si viene del server (p.ej. tercerizado viendo su costo), se muestra;
    // si el server devolvio null/0, mostramos guion.
    const hasPrice = p.price != null && Number(p.price) > 0;
    const priceHtml = hasPrice
      ? '<div class="card-price">' + fmtPrice(p.price) + '</div>'
      : '<div class="card-price card-price-none">—</div>';
    const actionsHtml = noClient
      ? '<div class="card-actions-none"></div>'
      : '<div class="card-actions" data-id="' + p.id + '">' + cardActionHtml(p.id) + '</div>';
    return '<article class="card' + (inCart ? ' in-cart' : '') + '" data-id="' + p.id + '">' +
      '<div class="card-img">' + img + '</div>' +
      '<div class="card-body">' +
        '<div class="card-cat">' + escapeHtml(p.category_name || "") + '</div>' +
        '<div class="card-name" title="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</div>' +
        (p.code ? '<div class="card-code">' + escapeHtml(p.code) + '</div>' : '') +
        '<div class="card-foot">' +
          priceHtml +
          actionsHtml +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function cardActionHtml(productId) {
    const item = state.cart.get(productId);
    if (!item || item.qty <= 0) {
      return '<button class="card-add" data-act="add" data-id="' + productId +
             '" type="button" title="Agregar al carrito">+</button>';
    }
    return '<div class="card-qty">' +
      '<button class="card-qty-btn" data-act="dec" data-id="' + productId + '" type="button" aria-label="Restar">−</button>' +
      '<input class="card-qty-num" data-act="set" data-id="' + productId + '" type="text" inputmode="numeric" pattern="[0-9]*" value="' + item.qty + '" aria-label="Cantidad" />' +
      '<button class="card-qty-btn" data-act="inc" data-id="' + productId + '" type="button" aria-label="Sumar">+</button>' +
    '</div>';
  }

  // Re-renderiza solo la accion (+ o − N +) y la clase in-cart de un card
  // puntual, sin tocar el resto de la grilla. Mantiene scroll y foco.
  // Si el modal de detalle está abierto sobre el mismo producto, también
  // actualiza el botón / contador del modal.
  function refreshCardForProduct(productId) {
    const card = els.grid.querySelector('.card[data-id="' + productId + '"]');
    if (card) {
      const slot = card.querySelector('.card-actions[data-id="' + productId + '"]');
      if (slot) slot.innerHTML = cardActionHtml(productId);
      if (state.cart.has(productId)) card.classList.add("in-cart");
      else card.classList.remove("in-cart");
    }
    if (els.productModal && !els.productModal.hidden && Number(els.productModal.dataset.id) === productId) {
      const slot = els.pmActions.querySelector('.card-actions[data-id="' + productId + '"]');
      if (slot) slot.innerHTML = cardActionHtml(productId);
    }
  }

  // Tope de cantidad segun el stock disponible del producto. No se puede
  // agregar al carrito mas de lo que hay en stock. Si el stock no es un numero
  // finito (desconocido), no se aplica tope.
  function stockCapFor(id) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return Infinity;
    const s = Number(p.stock);
    if (!Number.isFinite(s)) return Infinity;
    return Math.max(0, s);
  }

  // Aviso flotante breve (ej: cuando se topea la cantidad por stock).
  // Se crea una sola vez y reaparece en cada llamada; auto-desaparece.
  let stockNoticeTimer = null;
  function flashStockNotice(msg) {
    let el = document.getElementById("stock-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "stock-toast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
        "background:#1e293b;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;" +
        "box-shadow:0 6px 20px rgba(0,0,0,.3);z-index:100000;max-width:90vw;text-align:center;" +
        "opacity:0;transition:opacity .15s ease;pointer-events:none";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    if (stockNoticeTimer) clearTimeout(stockNoticeTimer);
    stockNoticeTimer = setTimeout(() => { el.style.opacity = "0"; }, 2200);
  }

  function changeQty(id, delta) {
    if (state.me && state.me.level === 5 && !state.vendedorClient) return;
    const cap = stockCapFor(id);
    const item = state.cart.get(id);
    if (item) {
      let next = item.qty + delta;
      if (next > cap) { next = cap; flashStockNotice("Solo hay " + cap + " en stock"); }
      item.qty = next;
      if (item.qty <= 0) state.cart.delete(id);
    } else if (delta > 0) {
      const p = state.products.find((x) => x.id === id);
      if (!p) return;
      let q = delta;
      if (q > cap) { q = cap; flashStockNotice("Solo hay " + cap + " en stock"); }
      if (q <= 0) return;
      state.cart.set(id, { id: p.id, name: p.name, price: p.price, qty: q, image: p.image_url });
    } else {
      return;
    }
    renderCart();
    refreshCardForProduct(id);
  }

  // Setea la cantidad directamente (cuando el usuario escribe en el input)
  function setQty(id, rawValue) {
    if (state.me && state.me.level === 5 && !state.vendedorClient) return;
    let n = parseInt(String(rawValue).replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
    const cap = stockCapFor(id);
    if (n > cap) { n = cap; flashStockNotice("Solo hay " + cap + " en stock"); }
    const item = state.cart.get(id);
    if (n <= 0) {
      if (item) state.cart.delete(id);
    } else if (item) {
      item.qty = n;
    } else {
      const p = state.products.find((x) => x.id === id);
      if (!p) return;
      state.cart.set(id, { id: p.id, name: p.name, price: p.price, qty: n, image: p.image_url });
    }
    renderCart();
    refreshCardForProduct(id);
  }

  function removeFromCart(id) {
    state.cart.delete(id);
    renderCart();
    refreshCardForProduct(id);
  }
  function cartTotal() { let t = 0; state.cart.forEach((it) => (t += it.price * it.qty)); return t; }
  function cartCount() { let n = 0; state.cart.forEach((it) => (n += it.qty)); return n; }

  // True si el usuario es cliente (1-4) y NO tiene vendedor asignado activo
  // con WhatsApp configurado. En ese caso el pedido se envia al WhatsApp
  // global de la empresa en lugar del numero del vendedor (no bloquea).
  function isClientWithoutVendedor() {
    if (!state.me) return false;
    if (![1, 2, 3, 4].includes(Number(state.me.level))) return false;
    // assignedVendedor solo viene si tiene vendedor activo; hasWhatsapp dice si tiene numero
    if (!state.me.assignedVendedor) return true;
    if (!state.me.assignedVendedor.hasWhatsapp) return true;
    return false;
  }

  function renderCart() {
    const items = Array.from(state.cart.values());
    const total = cartTotal();
    els.cartCount.textContent = cartCount();
    // Total visible en el topbar mientras se arma el pedido
    if (els.cartTotalTop) {
      if (items.length) {
        els.cartTotalTop.textContent = fmtPrice(total);
        els.cartTotalTop.hidden = false;
      } else {
        els.cartTotalTop.hidden = true;
      }
    }
    if (!items.length) {
      els.cartBody.innerHTML = '<p class="muted">Tu carrito esta vacio.</p>';
      els.cartTotal.textContent = "$0";
      els.cartSend.disabled = true;
      return;
    }
    // Aviso si el cliente no tiene vendedor: el pedido se envia al WhatsApp
    // principal de la empresa (no bloquea el envio).
    const sinVendedor = isClientWithoutVendedor();
    const tienePhone = !!(state.me && state.me.whatsapp);
    const aviso = sinVendedor && tienePhone
      ? '<div style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;' +
        'padding:10px 12px;border-radius:8px;margin-bottom:10px;font-size:14px">' +
        'Tu pedido se enviará al WhatsApp principal de la empresa.' +
        '</div>'
      : (sinVendedor && !tienePhone
        ? '<div style="background:#fee2e2;border:1px solid #fecaca;color:#991b1b;' +
          'padding:10px 12px;border-radius:8px;margin-bottom:10px;font-size:14px">' +
          '<strong>No hay número de WhatsApp configurado.</strong><br/>' +
          'Pedile al administrador que cargue el WhatsApp principal de la empresa.' +
          '</div>'
        : '');
    els.cartBody.innerHTML = aviso + items.map(cartItemHtml).join("");
    els.cartTotal.textContent = fmtPrice(total);
    els.cartSend.disabled = sinVendedor && !tienePhone;
    els.cartSend.title = (sinVendedor && !tienePhone) ? "No hay número de WhatsApp configurado" : "";
    els.cartBody.querySelectorAll("button[data-act]").forEach((btn) => {
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      btn.addEventListener("click", () => {
        if (act === "inc") changeQty(id, +1);
        else if (act === "dec") changeQty(id, -1);
        else if (act === "del") removeFromCart(id);
      });
    });
    // Inputs editables de cantidad dentro del carrito
    els.cartBody.querySelectorAll('input[data-act="set"]').forEach((inp) => {
      const id = Number(inp.dataset.id);
      inp.addEventListener("focus", () => inp.select());
      inp.addEventListener("change", () => setQty(id, inp.value));
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); inp.blur(); }
      });
    });
  }

  function cartItemHtml(it) {
    return '<div class="cart-item">' +
      '<div>' +
        '<h4>' + escapeHtml(it.name) + '</h4>' +
        '<div class="meta">' + fmtPrice(it.price) + ' c/u</div>' +
        '<div class="qty">' +
          '<button data-act="dec" data-id="' + it.id + '" type="button">-</button>' +
          '<input data-act="set" data-id="' + it.id + '" type="text" inputmode="numeric" pattern="[0-9]*" value="' + it.qty + '" aria-label="Cantidad" />' +
          '<button data-act="inc" data-id="' + it.id + '" type="button">+</button>' +
        '</div>' +
        '<button class="remove" data-act="del" data-id="' + it.id + '" type="button">Quitar</button>' +
      '</div>' +
      '<div class="line-total">' + fmtPrice(it.price * it.qty) + '</div>' +
    '</div>';
  }

  function buildWhatsappMessage() {
    const u = state.me;
    const notes = (els.cartNotes && els.cartNotes.value.trim()) || null;
    // Si es vendedor con cliente, el pedido va a nombre del cliente
    const isVendedorConCliente = u.level === 5 && state.vendedorClient;
    const clientName = isVendedorConCliente ? state.vendedorClient.name : (u.fullName || u.username);
    const clientLevelName = isVendedorConCliente ? state.vendedorClient.levelName : u.levelName;
    const lines = [];
    lines.push("Hola " + (u.app_name || "!") + " Soy " + clientName + " (" + clientLevelName + ").");
    lines.push("Quiero hacer este pedido:");
    lines.push("");
    state.cart.forEach((it) => {
      lines.push("- " + it.qty + " x " + it.name + " - " + fmtPrice(it.price) + " = " + fmtPrice(it.price * it.qty));
    });
    lines.push("");
    lines.push("*Total: " + fmtPrice(cartTotal()) + "*");
    if (notes) { lines.push(""); lines.push("Nota: " + notes); }
    if (isVendedorConCliente) {
      lines.push("");
      lines.push("(Pedido tomado por el vendedor " + (u.fullName || u.username) + ")");
    }
    return lines.join("\n");
  }

  function buildWhatsappMessageFromOrder(order) {
    const u = state.me;
    const lines = [];
    lines.push("Hola " + (u.app_name || "!") + " Soy " + (u.fullName || u.username) + " (" + u.levelName + ").");
    lines.push("Quiero reenviar el pedido #" + order.id + ":");
    lines.push("");
    (order.items || []).forEach((it) => {
      lines.push("- " + it.quantity + " x " + it.product_name + " - " + fmtPrice(it.unit_price) + " = " + fmtPrice(it.subtotal));
    });
    lines.push("");
    lines.push("*Total: " + fmtPrice(order.total) + "*");
    if (order.notes) { lines.push(""); lines.push("Nota: " + order.notes); }
    return lines.join("\n");
  }

  // Guarda el carrito actual como pedido offline (sin conexión)
  function saveCartOffline(phone) {
    if (!window.OfflineMode) { alertModal("Sin conexión para enviar el pedido."); return; }
    const apiItems  = Array.from(state.cart.values()).map((it) => ({ id: it.id, qty: it.qty }));
    const snapshot  = Array.from(state.cart.values());
    const notes     = (els.cartNotes && els.cartNotes.value.trim()) || null;
    window.OfflineMode.saveCart({
      apiItems:       apiItems,
      cartSnapshot:   snapshot,
      notes:          notes,
      me: {
        id: state.me.id, username: state.me.username, fullName: state.me.fullName,
        levelName: state.me.levelName, app_name: state.me.app_name,
      },
      vendedorClient: state.vendedorClient,
      phone:          phone,
      total:          cartTotal(),
      message:        buildWhatsappMessage(),
    }).then(function () {
      const clearedIds = Array.from(state.cart.keys());
      state.cart.clear();
      if (els.cartNotes) els.cartNotes.value = "";
      renderCart();
      clearedIds.forEach(refreshCardForProduct);
      closeDrawers();
    }).catch(function () {
      alertModal("No se pudo guardar el pedido sin conexión. Intentá de nuevo.");
    });
  }

  // Detecta celular/tablet. En estos casos NO sirve abrir una pestaña nueva
  // por JS para WhatsApp: el navegador pierde el "user-gesture" y wa.me queda
  // trabado en el interstitial ("Abrir aplicación") sin lanzar la app.
  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
        || window.matchMedia("(max-width: 820px)").matches;
  }

  // Abre WhatsApp de forma confiable en todas las plataformas.
  //  - Celular/tablet: navega la MISMA pestaña a wa.me (único modo que dispara
  //    la app de WhatsApp). Si había una pestaña pre-abierta, la cierra.
  //  - Desktop: usa la pestaña nueva ya abierta dentro del gesture, o abre una.
  // Devuelve true si pudo iniciar la apertura.
  function openWhatsapp(waUrl, popup) {
    if (isMobileDevice()) {
      if (popup && !popup.closed) { try { popup.close(); } catch (_) {} }
      window.location.href = waUrl;
      return true;
    }
    if (popup && !popup.closed) { popup.location.href = waUrl; return true; }
    const w = window.open(waUrl, "_blank");
    return !!w;
  }

  async function sendCart() {
    if (!state.cart.size) return;
    const phone = (state.me && state.me.whatsapp) || "";
    if (!phone) {
      // Para clientes (1-4): el phone viene del vendedor asignado o, si no hay,
      // del WhatsApp global de la empresa. Si tampoco hay global, no hay destino.
      if ([1, 2, 3, 4].includes(Number(state.me && state.me.level))) {
        alertModal("No hay número de WhatsApp configurado.\n" +
              "Pedile al administrador que cargue el WhatsApp principal de la empresa.");
      } else {
        alertModal("No hay numero de WhatsApp configurado.");
      }
      return;
    }
    // Sin conexión: guardar el pedido offline en lugar de intentar la red
    if (!navigator.onLine) {
      saveCartOffline(phone);
      return;
    }

    const message = buildWhatsappMessage();

    // En desktop abrimos la pestaña YA, dentro del user-gesture del click,
    // para que el bloqueador de popups no la mate; después le cambiamos la URL
    // cuando el server confirma el pedido. En celular NO abrimos pestaña nueva:
    // se navega la misma a wa.me (ver openWhatsapp), que es lo único confiable.
    const popup = isMobileDevice() ? null : window.open("about:blank", "_blank");

    els.cartSend.disabled = true;
    const original = els.cartSend.textContent;
    els.cartSend.textContent = "Guardando pedido...";
    try {
      const items = Array.from(state.cart.values()).map((it) => ({ id: it.id, qty: it.qty }));
      const notes = (els.cartNotes && els.cartNotes.value.trim()) || null;
      const resp = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items, notes: notes }),
      });
      if (!resp.ok) {
        if (popup && !popup.closed) popup.close();
        const body = await resp.json().catch(() => ({}));
        alertModal("No se pudo guardar el pedido: " + (body.error || resp.status));
        return;
      }
      const out = await resp.json();
      const text = encodeURIComponent(message + "\n\n#Pedido" + out.order.id);
      const waUrl = "https://wa.me/" + phone.replace(/[^\d]/g, "") + "?text=" + text;

      // Limpiamos el carrito ANTES de abrir WhatsApp: en celular la pestaña se
      // navega a wa.me y el código que sigue no llega a ejecutarse.
      const clearedIds = Array.from(state.cart.keys());
      state.cart.clear();
      if (els.cartNotes) els.cartNotes.value = "";
      renderCart();
      clearedIds.forEach(refreshCardForProduct);
      closeDrawers();
      flashOrderSaved(out.order.id);

      // Handoff a WhatsApp (mobile: misma pestaña; desktop: pestaña nueva).
      const opened = openWhatsapp(waUrl, popup);
      if (isMobileDevice()) return;   // la pestaña ya está navegando a WhatsApp
      if (!opened) {
        // Popup bloqueado en desktop: fallback con botón de apertura manual.
        showWhatsappFallback(out.order.id, waUrl);
      }

      // El server ya descontó el stock al enviar el pedido. Refrescamos el
      // catálogo para que los productos que quedaron en 0 desaparezcan de la
      // grilla sin tener que recargar la página.
      try {
        state.products = await api(productsUrl());
        renderProducts();
      } catch (_) {}
    } catch (e) {
      if (popup && !popup.closed) popup.close();
      // TypeError = error de red (Failed to fetch), con o sin navigator.onLine.
      if (e instanceof TypeError) {
        saveCartOffline(phone);
        return;
      }
      console.error(e);
      alertModal("Error de conexion al enviar el pedido");
    } finally {
      els.cartSend.disabled = false;
      els.cartSend.textContent = original;
    }
  }

  function showWhatsappFallback(orderId, waUrl) {
    // Modal minimo: el navegador bloqueo el popup. Le damos un boton
    // que el cliente puede apretar (eso re-engaña al gesture handler).
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", inset: "0",
      background: "rgba(0,0,0,.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1100,
    });
    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "#fff", padding: "20px 22px", borderRadius: "10px",
      maxWidth: "360px", textAlign: "center",
      boxShadow: "0 10px 30px rgba(0,0,0,.25)",
    });
    box.innerHTML =
      '<h3 style="margin:0 0 8px;font-size:16px;color:#111827">Pedido #' + orderId + ' guardado</h3>' +
      '<p style="margin:0 0 14px;color:#374151;font-size:14px">Tu navegador bloqueo el WhatsApp. Tocá el boton para abrirlo:</p>' +
      '<a href="' + waUrl + '" target="_blank" rel="noopener" ' +
        'style="display:inline-block;background:#25d366;color:#fff;padding:10px 18px;' +
        'border-radius:8px;font-weight:700;text-decoration:none">Abrir WhatsApp</a>' +
      '<div style="margin-top:10px"><button type="button" ' +
        'style="background:transparent;border:0;color:#6b7280;font-size:13px;cursor:pointer">Cerrar</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    box.querySelector("button").addEventListener("click", close);
    box.querySelector("a").addEventListener("click", () => setTimeout(close, 200));
  }

  function flashOrderSaved(id) {
    const tip = document.createElement("div");
    tip.textContent = "Pedido #" + id + " guardado. Abri WhatsApp para enviarlo.";
    Object.assign(tip.style, {
      position: "fixed", bottom: "24px", left: "50%",
      transform: "translateX(-50%)", background: "#10b981", color: "#fff",
      padding: "10px 18px", borderRadius: "8px", fontWeight: "600",
      boxShadow: "0 6px 20px rgba(0,0,0,.18)", zIndex: 1000,
    });
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 3500);
  }

  // ----- Historial de cambios (ultimas 10 actualizaciones) -----
  async function openPriceChanges() {
    els.pcBody.innerHTML = '<p class="muted">Cargando…</p>';
    openDrawer(els.priceChangesDrawer);
    try {
      let url = "/api/price-changes";
      if (state.me && state.me.level === 99) {
        if (state.viewAsListId)      url += "?as_list_id=" + state.viewAsListId;
        else if (state.viewAsLevel)  url += "?as_level=" + state.viewAsLevel;
      }
      const data = await api(url);
      els.pcBody.innerHTML = renderPriceChangesHtml(data);
      state.priceChangesLevelName = (data && data.levelName) || "";
    } catch (e) {
      const msg = e && e.message ? e.message : "Error";
      els.pcBody.innerHTML = '<p class="muted">' + escapeHtml(msg) + '</p>';
    }
  }

  // Delegacion: toggle del bloque + exportar como imagen
  if (els.pcBody) {
    els.pcBody.addEventListener("click", function (ev) {
      const tgl = ev.target.closest('[data-action="toggle"]');
      if (tgl) {
        const block = tgl.closest(".pc-update-block");
        if (block) block.classList.toggle("pc-open");
        return;
      }
      const shr = ev.target.closest('[data-action="share"]');
      if (shr) {
        ev.preventDefault();
        const block = shr.closest(".pc-update-block");
        if (block) sharePriceUpdateAsImage(block);
      }
    });
  }

  // Genera una imagen PNG del bloque de cambios y la comparte (mobile) o
  // la descarga (desktop). El bloque se fuerza a estado "abierto" durante
  // la captura para que se rendericen todas las secciones.
  async function sharePriceUpdateAsImage(blockEl) {
    if (typeof window.html2canvas !== "function") {
      alertModal("No se pudo cargar la herramienta de exportacion. Revisa tu conexion.");
      return;
    }

    const shareBtn = blockEl.querySelector('[data-action="share"]');
    const prevBtnHtml = shareBtn ? shareBtn.innerHTML : null;
    if (shareBtn) {
      shareBtn.disabled = true;
      shareBtn.innerHTML = "…";
    }

    const wasOpen = blockEl.classList.contains("pc-open");
    if (!wasOpen) blockEl.classList.add("pc-open");
    blockEl.classList.add("pc-capturing");

    // Agregamos un encabezado temporal con el nombre de la app y el nivel,
    // asi la imagen exportada es autoexplicativa para WhatsApp.
    const appName = (state.me && state.me.app_name) || document.title || "Maxaria";
    const lvlName = state.priceChangesLevelName || "";
    const headerEl = document.createElement("div");
    headerEl.className = "pc-capture-header";
    headerEl.innerHTML =
      '<div class="pc-capture-app">' + escapeHtml(appName) + '</div>' +
      (lvlName ? '<div class="pc-capture-lvl">Lista <strong>' + escapeHtml(lvlName) + '</strong></div>' : '');
    blockEl.insertBefore(headerEl, blockEl.firstChild);

    try {
      const canvas = await window.html2canvas(blockEl, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const dateStr = blockEl.getAttribute("data-date") || "";
      const safeDate = dateStr.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-+|-+$/g, "");
      const fileName = "cambios-precios-" + (safeDate || "maxaria") + ".png";

      const blob = await new Promise(function (res) { canvas.toBlob(res, "image/png"); });
      if (!blob) throw new Error("No se pudo generar la imagen");

      const file = new File([blob], fileName, { type: "image/png" });

      // Mobile: usar el share sheet nativo (WhatsApp aparece como opcion)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Cambios de precio",
            text: "Cambios de precio" + (dateStr ? " - " + dateStr : ""),
          });
          return;
        } catch (e) {
          if (e && e.name === "AbortError") return;
          // Si el share fallo por otro motivo, caemos al download
        }
      }

      // Desktop / fallback: descarga directa
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {
      console.error(e);
      alertModal("Error al generar la imagen: " + (e && e.message ? e.message : e));
    } finally {
      if (headerEl && headerEl.parentNode) headerEl.parentNode.removeChild(headerEl);
      blockEl.classList.remove("pc-capturing");
      if (!wasOpen) blockEl.classList.remove("pc-open");
      if (shareBtn) {
        shareBtn.disabled = false;
        if (prevBtnHtml != null) shareBtn.innerHTML = prevBtnHtml;
      }
    }
  }

  function renderPriceChangesHtml(data) {
    if (!data || !data.updates || !data.updates.length) {
      return '<p class="muted">Todavía no hay actualizaciones registradas.</p>';
    }
    const lvl = data.levelName
      ? '<span class="muted"> · Lista <strong>' + escapeHtml(data.levelName) + '</strong></span>'
      : '';
    let html = '<div class="pc-history-header">Historial de cambios' + lvl + '</div>';

    data.updates.forEach(function(entry, idx) {
      const u = entry.update;
      const cambios = entry.cambios || [];
      const nuevos = entry.nuevos || [];
      const reingresos = entry.reingresos || [];
      const date = formatDate(u.created_at);

      // Resumen de contadores para el encabezado del update
      const parts = [];
      if (cambios.length) parts.push(cambios.length + ' cambio(s) de precio');
      if (reingresos.length) parts.push(reingresos.length + ' reingreso(s)');
      if (nuevos.length) parts.push(nuevos.length + ' nuevo(s)');
      const summary = parts.join(' · ');

      // El mas reciente (idx 0) se muestra expandido, el resto colapsado
      const blockId = 'pc-block-' + u.id;
      const isOpen = idx === 0;

      html +=
        '<div class="pc-update-block' + (isOpen ? ' pc-open' : '') + '" id="' + blockId + '" data-date="' + escapeHtml(date) + '">' +
          '<div class="pc-update-head">' +
            '<button class="pc-update-toggle" type="button" data-action="toggle">' +
              '<span class="pc-update-date">' + escapeHtml(date) + '</span>' +
              '<span class="pc-update-summary muted">' + escapeHtml(summary) + '</span>' +
              '<span class="pc-chevron">▾</span>' +
            '</button>' +
            '<button class="pc-update-share" type="button" data-action="share" title="Compartir como imagen" aria-label="Compartir como imagen">📤</button>' +
          '</div>' +
          '<div class="pc-update-body">';

      // — Reingresos —
      if (reingresos.length) {
        html +=
          '<h4 class="pc-section-title pc-reingreso-title">Reingresos <span class="muted">(' + reingresos.length + ')</span></h4>' +
          '<table class="pc-table">' +
            '<thead><tr><th>Código</th><th>Producto</th><th class="num">Precio</th></tr></thead>' +
            '<tbody>' + pcRowsWithCategoryHeaders(reingresos, pcReingresoRowHtml, 3, ['Precio']) + '</tbody>' +
          '</table>';
      }

      // — Cambios de precio —
      if (cambios.length) {
        const subas = cambios.filter(function(c){ return c.delta > 0; }).length;
        const bajas = cambios.filter(function(c){ return c.delta < 0; }).length;
        html +=
          '<h4 class="pc-section-title">Cambios de precio <span class="muted">(' + subas + ' ↑, ' + bajas + ' ↓)</span></h4>' +
          '<table class="pc-table">' +
            '<thead><tr>' +
              '<th>Código</th><th>Producto</th>' +
              '<th class="num">Anterior</th><th class="num">Nuevo</th>' +
              '<th class="num">Var.</th>' +
            '</tr></thead>' +
            '<tbody>' + pcRowsWithCategoryHeaders(cambios, pcRowHtml, 5, ['Anterior', 'Nuevo', 'Var.']) + '</tbody>' +
          '</table>';
      }

      // — Productos nuevos —
      if (nuevos.length) {
        html +=
          '<h4 class="pc-section-title">Productos nuevos <span class="muted">(' + nuevos.length + ')</span></h4>' +
          '<table class="pc-table">' +
            '<thead><tr><th>Código</th><th>Producto</th><th class="num">Precio</th></tr></thead>' +
            '<tbody>' + pcRowsWithCategoryHeaders(nuevos, pcNewRowHtml, 3, ['Precio']) + '</tbody>' +
          '</table>';
      }

      html += '</div></div>'; // pc-update-body / pc-update-block
    });

    return html;
  }

  // Inserta filas de encabezado de categoría cada vez que cambia la categoría.
  // subHeaders: array opcional de strings con etiquetas de columna que se muestran
  // alineadas a la derecha del separador (ej: ['Anterior', 'Nuevo', 'Var.']).
  function pcRowsWithCategoryHeaders(items, rowFn, colSpan, subHeaders) {
    colSpan = colSpan || 3;
    var html = "";
    var lastCat = null;
    items.forEach(function(item) {
      var cat = item.category_name || "Sin categoría";
      if (cat !== lastCat) {
        if (subHeaders && subHeaders.length) {
          var catColSpan = colSpan - subHeaders.length;
          var extraHtml = subHeaders.map(function(h) {
            return '<td class="pc-cat-sub">' + escapeHtml(h) + '</td>';
          }).join('');
          html += '<tr class="pc-cat-header"><td colspan="' + catColSpan + '">' + escapeHtml(cat) + '</td>' + extraHtml + '</tr>';
        } else {
          html += '<tr class="pc-cat-header"><td colspan="' + colSpan + '">' + escapeHtml(cat) + '</td></tr>';
        }
        lastCat = cat;
      }
      html += rowFn(item);
    });
    return html;
  }

  function pcRowHtml(c) {
    const pct = c.delta_pct;
    const cls = c.delta > 0 ? "pc-up" : (c.delta < 0 ? "pc-down" : "pc-eq");
    const sign = c.delta > 0 ? "+" : "";
    const pctTxt = (pct == null)
      ? "—"
      : sign + pct.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    return '<tr class="' + cls + '">' +
      '<td class="pc-code">' + escapeHtml(c.code || "") + '</td>' +
      '<td>' + escapeHtml(c.name || "") + '</td>' +
      '<td class="num">' + fmtPrice(c.old_price) + '</td>' +
      '<td class="num"><strong>' + fmtPrice(c.new_price) + '</strong></td>' +
      '<td class="num pc-pct">' + escapeHtml(pctTxt) + '</td>' +
    '</tr>';
  }

  function pcNewRowHtml(n) {
    return '<tr class="pc-new">' +
      '<td class="pc-code">' + escapeHtml(n.code || "") + '</td>' +
      '<td>' + escapeHtml(n.name || "") + ' <span class="pc-tag">NUEVO</span></td>' +
      '<td class="num"><strong>' + fmtPrice(n.new_price) + '</strong></td>' +
    '</tr>';
  }

  function pcReingresoRowHtml(n) {
    return '<tr class="pc-reingreso">' +
      '<td class="pc-code">' + escapeHtml(n.code || "") + '</td>' +
      '<td>' + escapeHtml(n.name || "") + ' <span class="pc-tag pc-tag-reingreso">REINGRESO</span></td>' +
      '<td class="num"><strong>' + fmtPrice(n.new_price) + '</strong></td>' +
    '</tr>';
  }

  async function openOrders() {
    const isAdmin = state.me && state.me.level === 99;
    // Vendedor tercerizado: puede agrupar pedidos pendientes de sus clientes
    // y mandarlos al admin como un unico pedido unificado.
    const isTerc = !!(state.me && state.me.level === 5 && state.me.restrictedToAssigned);
    els.ordersTitle.textContent = isAdmin ? "Todos los pedidos" : "Mis pedidos";
    els.ordersBody.innerHTML = '<p class="muted">Cargando...</p>';
    openDrawer(els.ordersDrawer);
    try {
      // Si /api/orders falla por red (offline), usar array vacío y mostrar
      // igual los pedidos guardados en IndexedDB.
      const [orders, pendingOrders] = await Promise.all([
        api("/api/orders").catch((e) => (e instanceof TypeError ? [] : Promise.reject(e))),
        window.OfflineMode ? window.OfflineMode.getAll() : Promise.resolve([]),
      ]);
      if (!orders.length && !pendingOrders.length) {
        els.ordersBody.innerHTML = '<p class="muted">Todavia no hay pedidos.</p>';
        return;
      }
      // Pedidos guardados offline (sin conexión previa)
      let pendingHtml = "";
      if (pendingOrders.length) {
        pendingHtml =
          '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;' +
          'padding:10px 14px;margin-bottom:12px;">' +
          '<div style="font-weight:700;color:#92400e;margin-bottom:6px">⏳ ' +
          pendingOrders.length + ' pedido' + (pendingOrders.length > 1 ? 's' : '') +
          ' sin enviar — ' +
          (navigator.onLine ? 'enviando…' : 'se enviarán cuando vuelva internet') +
          '</div>' +
          pendingOrders.map(pendingOrderCardHtml).join("") +
          '</div>';
      }
      const header = isTerc ? renderDispatchBar(orders) : "";
      els.ordersBody.innerHTML =
        header +
        pendingHtml +
        (orders.length
          ? '<div class="orders-cards">' +
              orders.map((o) => orderCardHtml(o, isAdmin, isTerc)).join("") +
            '</div>'
          : "");
      els.ordersBody.querySelectorAll(".order-card").forEach((card) => {
        card.querySelector(".order-head").addEventListener("click", (ev) => {
          // No abrir detalle si el click vino del checkbox
          if (ev.target && ev.target.closest && ev.target.closest(".dispatch-cb")) return;
          toggleOrderDetail(card, Number(card.dataset.id));
        });
      });
      if (isTerc) wireDispatchControls();
    } catch (e) {
      els.ordersBody.innerHTML = '<p class="muted">Error cargando pedidos.</p>';
    }
  }

  // Pedidos elegibles para agrupar: ni cancelados, ni entregados, ni ya unificados,
  // ni ya absorbidos por otro unificado.
  function isDispatchable(o) {
    if (!o) return false;
    if (Number(o.is_unified) === 1) return false;
    if (o.unified_parent_id) return false;
    if (o.status === "cancelado") return false;
    if (o.status === "entregado") return false;
    return true;
  }

  function renderDispatchBar(orders) {
    const elegibles = orders.filter(isDispatchable).length;
    return (
      '<div class="dispatch-bar">' +
        '<div class="dispatch-hint">' +
          'Marca los pedidos de tus clientes que quieras enviarle al admin como un solo pedido unificado. ' +
          'El mensaje se manda al numero principal de la empresa y suma las cantidades por articulo.' +
        '</div>' +
        '<div class="dispatch-actions">' +
          '<span class="dispatch-count" id="dispatch-count">0 seleccionados</span>' +
          '<button class="btn btn-primary" id="dispatch-send" type="button" disabled>' +
            'Enviar unificado al admin' +
          '</button>' +
        '</div>' +
        (elegibles === 0
          ? '<div class="dispatch-empty muted">No hay pedidos pendientes para agrupar.</div>'
          : "") +
      '</div>'
    );
  }

  function wireDispatchControls() {
    const countEl = document.getElementById("dispatch-count");
    const sendBtn = document.getElementById("dispatch-send");
    if (!countEl || !sendBtn) return;

    function refreshCount() {
      const ids = selectedDispatchIds();
      countEl.textContent = ids.length + " seleccionado" + (ids.length === 1 ? "" : "s");
      sendBtn.disabled = ids.length === 0;
    }
    els.ordersBody.querySelectorAll(".dispatch-cb").forEach((cb) => {
      cb.addEventListener("change", refreshCount);
      cb.addEventListener("click", (e) => e.stopPropagation());
    });
    sendBtn.addEventListener("click", () => doDispatch(sendBtn));
    refreshCount();
  }

  function selectedDispatchIds() {
    return Array.from(els.ordersBody.querySelectorAll(".dispatch-cb:checked"))
      .map((cb) => Number(cb.dataset.id))
      .filter((n) => n > 0);
  }

  async function doDispatch(btn) {
    const ids = selectedDispatchIds();
    if (!ids.length) return;
    if (!await confirmModal("Vas a unificar " + ids.length + " pedido(s) y mandarlo al admin. Despues los originales quedan marcados como 'enviado'. Seguir?")) return;
    btn.disabled = true;
    const prevText = btn.textContent;
    btn.textContent = "Enviando...";
    try {
      const res = await api("/api/vendedor/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: ids }),
      });
      if (res && res.whatsapp_link) {
        openWhatsapp(res.whatsapp_link);
      } else {
        alertModal("Pedido unificado creado (#" + res.unified_order_id + ") pero falta configurar el numero principal de WhatsApp en /admin > Configuracion.");
      }
      // Refrescar la lista
      await openOrders();
    } catch (e) {
      alertModal((e && e.message) || "Error al enviar el pedido unificado");
      btn.disabled = false;
      btn.textContent = prevText;
    }
  }

  function pendingOrderCardHtml(p) {
    const d = new Date(p.timestamp);
    const date = isNaN(d.getTime()) ? "" : d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const who = p.vendedorClient ? " &middot; " + escapeHtml(p.vendedorClient.name) : "";
    const items = p.cartSnapshot || [];
    const rows = items.map(function(it) {
      return '<div style="font-size:13px;color:#374151">' +
        it.qty + " × " + escapeHtml(it.name || "") +
        ' <span style="color:#6b7280">(' + fmtPrice(it.price) + ' c/u)</span>' +
      '</div>';
    }).join("");
    return '<article style="background:#fff;border:1px solid #fde68a;border-radius:8px;' +
      'padding:10px 12px;margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div>' +
          '<strong style="font-size:14px">Pedido pendiente</strong>' +
          ' <span style="background:#f59e0b;color:#fff;font-size:11px;font-weight:700;' +
          'padding:2px 6px;border-radius:4px">SIN ENVIAR</span>' +
          '<div style="color:#6b7280;font-size:12px;margin-top:2px">' + date + who + '</div>' +
        '</div>' +
        '<div style="font-weight:700;color:#0f172a">' + fmtPrice(p.total) + '</div>' +
      '</div>' +
      (rows ? '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #fde68a">' + rows + '</div>' : '') +
    '</article>';
  }

  // Etiqueta legible del estado del pedido. STATUS_LABELS es la vista interna
  // (admin) con los 6 estados distintos del circuito.
  const STATUS_LABELS = {
    pendiente: "Pendiente", enviado: "Enviado", preparando: "En armado",
    listo: "Listo para entregar", entregado: "Entregado", cancelado: "Cancelado",
  };
  function statusLabel(s) {
    return STATUS_LABELS[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  }
  // Etiqueta simplificada que ve el cliente: 4 etapas claras del recorrido.
  // "pendiente" y "enviado" se muestran ambos como "Recibido".
  const CLIENT_STATUS_LABELS = {
    pendiente: "Recibido", enviado: "Recibido", preparando: "Armando",
    listo: "Para entregar", entregado: "Entregado", cancelado: "Cancelado",
  };
  function clientStatusLabel(s) {
    return CLIENT_STATUS_LABELS[s] || statusLabel(s);
  }
  // Chip de estado de pago para pedidos entregados (vista cliente/vendedor).
  // Usa balance_due (total − cobrado/pagado) que viene del backend.
  function paymentChipHtml(o) {
    if (o.status !== "entregado") return "";
    const due = Number(o.balance_due);
    if (!isFinite(due)) return "";
    if (due <= 0) {
      return '<span class="pay-chip pay-ok">✓ Pagado</span>';
    }
    return '<span class="pay-chip pay-due">Falta pagar ' + fmtPrice(due) + '</span>';
  }
  // Desglose de pago para el detalle de un pedido entregado (vista cliente/vendedor).
  function paymentDetailHtml(o) {
    if (o.status !== "entregado") return "";
    const due = Number(o.balance_due);
    const paid = Number(o.amount_paid) || 0;
    if (!isFinite(due)) return "";
    let rows =
      '<div class="pay-row"><span>Total del pedido</span><span>' + fmtPrice(o.total) + '</span></div>' +
      '<div class="pay-row"><span>Pagado</span><span>' + fmtPrice(paid) + '</span></div>';
    rows += due <= 0
      ? '<div class="pay-row pay-ok"><span>Estado</span><strong>✓ Pagado</strong></div>'
      : '<div class="pay-row pay-due"><span>Falta pagar</span><strong>' + fmtPrice(due) + '</strong></div>';
    return '<div class="order-pay-detail">' + rows + '</div>';
  }

  // Banner superior con avisos del estado de los pedidos del cliente. Se llena
  // al ingresar al catálogo desde /api/my-notifications y se puede cerrar.
  function notifyOrderUpdates(items) {
    if (!items || !items.length) return;
    let bar = document.getElementById("order-notif-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "order-notif-bar";
      bar.setAttribute("role", "status");
      bar.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99999;" +
        "background:#1e3a5f;color:#fff;padding:12px 16px;font-size:14px;line-height:1.4;" +
        "box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:4px;" +
        "max-height:60vh;overflow-y:auto";
      document.body.appendChild(bar);
    }
    const lines = items.map((n) =>
      '<div>📦 ' + escapeHtml(n.message) + '</div>'
    ).join("");
    bar.innerHTML = lines +
      '<button id="order-notif-close" type="button" style="align-self:flex-end;margin-top:4px;' +
      'background:#fbbf24;color:#1e293b;border:none;border-radius:8px;padding:6px 14px;' +
      'font-weight:700;cursor:pointer">Entendido</button>';
    const close = document.getElementById("order-notif-close");
    if (close) close.addEventListener("click", () => { bar.remove(); });
  }

  function orderCardHtml(o, isAdmin, isTerc) {
    const date = formatDate(o.created_at);
    const who = (isAdmin || isTerc) && o.username
      ? ' <span class="meta"> - ' + escapeHtml(o.full_name || o.username) + '</span>'
      : "";
    const tags = [];
    if (Number(o.is_unified) === 1) tags.push('<span class="order-tag tag-unified">unificado</span>');
    if (o.unified_parent_id) tags.push('<span class="order-tag tag-grouped">agrupado en #' + Number(o.unified_parent_id) + '</span>');
    const tagsHtml = tags.length ? ' ' + tags.join(" ") : "";

    const dispatchCb = isTerc && isDispatchable(o)
      ? '<label class="dispatch-cb-wrap" title="Incluir en pedido unificado">' +
          '<input type="checkbox" class="dispatch-cb" data-id="' + o.id + '">' +
        '</label>'
      : (isTerc ? '<span class="dispatch-cb-placeholder"></span>' : "");

    // El admin ve los estados internos; el cliente/vendedor ve las etapas simples.
    const label = isAdmin ? statusLabel(o.status) : clientStatusLabel(o.status);
    const payChip = isAdmin ? "" : paymentChipHtml(o);
    return '<article class="order-card' + (isTerc ? ' with-dispatch' : '') + '" data-id="' + o.id + '">' +
      '<header class="order-head" title="Click para ver el detalle">' +
        dispatchCb +
        '<div>' +
          '<h4>Pedido #' + o.id + ' <span class="order-status ' + escapeHtml(o.status) + '">' + escapeHtml(label) + '</span>' + tagsHtml + '</h4>' +
          '<div class="meta">' + date + who + '</div>' +
          (payChip ? '<div class="order-pay">' + payChip + '</div>' : '') +
        '</div>' +
        '<div class="order-total">' + fmtPrice(o.total) + '</div>' +
      '</header>' +
      '<div class="order-detail" hidden></div>' +
    '</article>';
  }

  async function toggleOrderDetail(card, id) {
    const det = card.querySelector(".order-detail");
    if (!det.hidden) { det.hidden = true; return; }
    det.hidden = false;
    if (det.dataset.loaded) return;
    det.innerHTML = '<p class="muted">Cargando detalle...</p>';
    try {
      const o = await api("/api/orders/" + id);
      const isAdmin = state.me && state.me.level === 99;

      const anyDisc = o.items.some((it) => Number(it.discount_percent) > 0);
      const discTotal = Number(o.items_discount_total) || 0;
      const rows = o.items.map((it) => {
        const dp = Number(it.discount_percent) || 0;
        const discCell = anyDisc
          ? '<td class="num">' + (dp > 0 ? '−' + (Math.round(dp * 100) / 100) + '%' : '—') + '</td>'
          : "";
        return '<tr>' +
          '<td>' + escapeHtml(it.product_code || "") + '</td>' +
          '<td>' + escapeHtml(it.product_name) + '</td>' +
          '<td class="num">' + it.quantity + '</td>' +
          '<td class="num">' + fmtPrice(it.unit_price) + '</td>' +
          discCell +
          '<td class="num">' + fmtPrice(it.subtotal) + '</td>' +
        '</tr>';
      }).join("");

      // Espejo de la whitelist del server: entregado solo puede cancelarse,
      // cancelado solo puede reactivarse a pendiente.
      let statusOptions;
      if (o.status === "entregado") statusOptions = ["entregado", "cancelado"];
      else if (o.status === "cancelado") statusOptions = ["cancelado", "pendiente"];
      else statusOptions = ["pendiente", "enviado", "preparando", "listo", "entregado", "cancelado"];
      const statusOptHtml = statusOptions.map((s) =>
        '<option value="' + s + '"' + (s === o.status ? " selected" : "") + '>' +
          statusLabel(s) +
        '</option>'
      ).join("");

      const statusSelect = isAdmin
        ? '<div class="order-actions">' +
            '<label class="order-status-label">Estado: ' +
              '<select class="order-status-select">' + statusOptHtml + '</select>' +
            '</label>' +
            '<span class="order-status-msg"></span>' +
          '</div>'
        : "";

      const phone = (state.me && state.me.whatsapp) || "";
      // Vendedor tercerizado: no muestra el boton de reenviar individual.
      // Sus pedidos se mandan al admin agrupados via "Enviar unificado al admin".
      const esTercerizado = !!(state.me && state.me.restrictedToAssigned);
      const reenviarBtn = (phone && !esTercerizado)
        ? '<button class="btn-reenviar" type="button">Reenviar por WhatsApp</button>'
        : "";

      // Cambios confirmados en el armado del pedido (faltantes / redondeo):
      // el cliente los ve para no sorprenderse con cantidades distintas.
      const pickChgHtml = (o.pick_changes && o.pick_changes.length)
        ? '<div class="order-pick-changes"><strong>📋 Cambios en el armado:</strong><ul>' +
            o.pick_changes.map((c) => {
              const nq = Number(c.new_qty);
              return "<li>" + escapeHtml(c.product_name || c.product_code || "") + ": " +
                Number(c.old_qty) + " → " + (nq > 0 ? nq : "0 (sin stock, quitado)") + "</li>";
            }).join("") +
          "</ul></div>"
        : "";

      det.innerHTML =
        '<table>' +
          '<thead><tr>' +
            '<th>Cod.</th><th>Producto</th>' +
            '<th class="num">Cant.</th><th class="num">Unit.</th>' +
            (anyDisc ? '<th class="num">Desc.</th>' : "") +
            '<th class="num">Subtotal</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
        (discTotal > 0 ? '<div class="order-disc-total" style="text-align:right;margin-top:4px;font-size:12px;color:#b45309;font-weight:700">Descuento aplicado: ' + fmtPrice(discTotal) + '</div>' : "") +
        pickChgHtml +
        (o.notes ? '<div class="order-notes">Nota: ' + escapeHtml(o.notes) + '</div>' : "") +
        (!isAdmin ? paymentDetailHtml(o) : "") +
        '<div class="order-det-foot">' + statusSelect + reenviarBtn + '</div>';

      det.dataset.loaded = "1";
      det._orderData = o;

      // Selector de estado (solo admin)
      const sel = det.querySelector(".order-status-select");
      if (sel) {
        sel.addEventListener("change", async () => {
          const msg = det.querySelector(".order-status-msg");
          sel.disabled = true;
          try {
            await api("/api/orders/" + o.id, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: sel.value }),
            });
            const badge = card.querySelector(".order-status");
            if (badge) {
              badge.className = "order-status " + sel.value;
              badge.textContent = statusLabel(sel.value); // label legible, no el estado crudo
            }
            msg.textContent = "Estado actualizado";
            msg.style.color = "var(--ok)";
          } catch (err) {
            msg.textContent = "Error al actualizar";
            msg.style.color = "var(--danger)";
          } finally {
            sel.disabled = false;
            setTimeout(() => { msg.textContent = ""; }, 3000);
          }
        });
      }

      // Boton reenviar por WhatsApp
      const btnReenviar = det.querySelector(".btn-reenviar");
      if (btnReenviar) {
        btnReenviar.addEventListener("click", () => {
          const order = det._orderData;
          const phone = (state.me && state.me.whatsapp) || "";
          if (!phone) return;
          const text = encodeURIComponent(
            buildWhatsappMessageFromOrder(order) + "\n\n#Pedido" + order.id
          );
          openWhatsapp("https://wa.me/" + phone.replace(/[^\d]/g, "") + "?text=" + text);
        });
      }
    } catch (e) {
      det.innerHTML = '<p class="muted">No se pudo cargar el detalle.</p>';
    }
  }

  function formatDate(s) {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  els.search.addEventListener("input", debounce(() => {
    state.query = els.search.value.trim();
    renderProducts();
  }, 150));

  // Selector "Ver como ..." (solo admin). Acepta:
  //   - "1".."4": niveles base (Minorista, Revendedor, Mayorista, VIP)
  //   - "list:N": listas personalizadas que el admin creó (L1, L2, ...)
  // Al cambiar, re-pedimos los productos al server con el query string que
  // corresponda y re-renderizamos. El carrito conserva los precios capturados;
  // si tenia items, avisamos.
  if (els.levelSelect) {
    els.levelSelect.addEventListener("change", async () => {
      if (!state.me || state.me.level !== 99) return;
      const raw = els.levelSelect.value;
      let asList = null, asLevel = null, label = "";
      if (raw.indexOf("list:") === 0) {
        asList = Number(raw.split(":")[1]);
        if (!asList) return;
        const lst = (_priceListsCache || []).find((l) => l.id === asList);
        label = lst ? lst.name : ("Lista #" + asList);
      } else {
        asLevel = Number(raw);
        if (![1, 2, 3, 4].includes(asLevel)) return;
        label = LEVEL_NAMES[asLevel];
      }

      if (state.cart.size > 0) {
        const ok = await confirmModal(
          "Tenés " + state.cart.size + " producto(s) en el carrito con precios " +
          "anteriores.\n\n¿Vaciar el carrito y cambiar a " + label + "?"
        );
        if (!ok) {
          // Revertir el select al valor previo
          if (state.viewAsListId) els.levelSelect.value = "list:" + state.viewAsListId;
          else                    els.levelSelect.value = String(state.viewAsLevel || 1);
          return;
        }
        const ids = Array.from(state.cart.keys());
        state.cart.clear();
        if (els.cartNotes) els.cartNotes.value = "";
        renderCart();
        ids.forEach(refreshCardForProduct);
      }

      state.viewAsLevel  = asLevel;
      state.viewAsListId = asList;
      try {
        if (asList) {
          localStorage.setItem(LS_VIEW_AS_LIST, String(asList));
          localStorage.removeItem(LS_VIEW_AS_LEVEL);
        } else {
          localStorage.setItem(LS_VIEW_AS_LEVEL, String(asLevel));
          localStorage.removeItem(LS_VIEW_AS_LIST);
        }
      } catch (_) {}
      try {
        // Tambien re-pedimos categorias: con "ver como" activo el server
        // oculta las desactivadas (preview), y el sidebar debe reflejarlo.
        const [cats, prods] = await Promise.all([
          api(categoriesUrl()), api(productsUrl()),
        ]);
        state.categories = cats;
        state.products = prods;
        renderUser();
        renderCategories();
        renderProducts();
      } catch (e) {
        console.error(e);
        alertModal("No se pudieron cargar los precios para " + label);
      }
    });
  }

  els.logoutBtn.addEventListener("click", async () => {
    try { localStorage.removeItem(LS_VENDEDOR_CLIENT); } catch (_) {}
    try { await fetch("/logout", { method: "POST" }); }
    finally { location.href = "/login"; }
  });

  // Event delegation para los botones add / inc / dec en cada card
  els.grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act][data-id]");
    if (!btn || !els.grid.contains(btn)) return;
    const id = Number(btn.dataset.id);
    const act = btn.dataset.act;
    if (act === "add" || act === "inc") changeQty(id, +1);
    else if (act === "dec") changeQty(id, -1);
  });

  // Input editable de cantidad en cada card: confirma con blur o Enter
  els.grid.addEventListener("change", (e) => {
    const inp = e.target.closest('input.card-qty-num[data-act="set"][data-id]');
    if (!inp) return;
    setQty(Number(inp.dataset.id), inp.value);
  });
  els.grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const inp = e.target.closest('input.card-qty-num[data-act="set"][data-id]');
    if (!inp) return;
    e.preventDefault();
    inp.blur(); // dispara el change
  });
  // Al hacer foco, seleccionar todo el contenido para que sea facil reescribir
  els.grid.addEventListener("focusin", (e) => {
    const inp = e.target.closest('input.card-qty-num[data-act="set"][data-id]');
    if (inp) inp.select();
  });

  // ── Modal de detalle de producto ──
  // Se abre con doble click (desktop) o doble tap (mobile) sobre una card.
  // Muestra imagen grande, datos completos y el precio de la lista actual
  // del cliente. Las acciones (+ / qty) viven dentro del modal y se sincronizan
  // con la card del grid via refreshCardForProduct().

  function openProductModal(p) {
    if (!els.productModal) return;
    els.productModal.dataset.id = String(p.id);

    els.pmImg.innerHTML = p.image_url
      ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" />'
      : '<div class="muted" style="padding:24px;text-align:center">Sin foto</div>';

    els.pmCat.textContent = p.category_name || "";
    els.pmCat.hidden = !p.category_name;

    els.pmName.textContent = p.name || "";

    if (p.code) {
      els.pmCode.textContent = "Código: " + p.code;
      els.pmCode.hidden = false;
    } else {
      els.pmCode.hidden = true;
    }

    if (p.description) {
      els.pmDesc.textContent = p.description;
      els.pmDesc.hidden = false;
    } else {
      els.pmDesc.hidden = true;
    }

    if (p.stock != null && Number(p.stock) > 0) {
      els.pmStock.textContent = "Stock disponible: " + p.stock;
      els.pmStock.hidden = false;
    } else {
      els.pmStock.hidden = true;
    }

    const hasPrice = p.price != null && Number(p.price) > 0;
    if (hasPrice) {
      els.pmPrice.textContent = fmtPrice(p.price);
      els.pmPrice.classList.remove("product-modal-price-none");
    } else {
      els.pmPrice.textContent = "—";
      els.pmPrice.classList.add("product-modal-price-none");
    }

    // Acciones (+ o qty). Si es vendedor sin cliente, no se muestran.
    const noClient = state.me && state.me.level === 5 && !state.vendedorClient;
    els.pmActions.innerHTML = noClient
      ? ""
      : '<div class="card-actions" data-id="' + p.id + '">' + cardActionHtml(p.id) + '</div>';

    els.productModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeProductModal() {
    if (!els.productModal || els.productModal.hidden) return;
    els.productModal.hidden = true;
    els.productModal.removeAttribute("data-id");
    document.body.style.overflow = "";
  }

  function isModalOpen() {
    return els.productModal && !els.productModal.hidden;
  }

  // Handler común: si el click NO fue sobre un botón/input de acción, abre el modal
  function tryOpenModalForCardEvent(e) {
    if (e.target.closest("button[data-act], input.card-qty-num")) return false;
    const card = e.target.closest('article.card[data-id]');
    if (!card) return false;
    const id = Number(card.dataset.id);
    const p = state.products.find((x) => x.id === id);
    if (!p) return false;
    openProductModal(p);
    return true;
  }

  // Desktop: dblclick nativo
  els.grid.addEventListener("dblclick", (e) => {
    if (tryOpenModalForCardEvent(e)) e.preventDefault();
  });

  // Mobile: detección manual de doble tap (algunos navegadores táctiles no
  // disparan dblclick de forma confiable). Dos taps sobre la misma card en
  // menos de 350ms abren el modal.
  let lastTap = { id: 0, time: 0 };
  els.grid.addEventListener("touchend", (e) => {
    if (e.target.closest("button[data-act], input.card-qty-num")) return;
    const card = e.target.closest('article.card[data-id]');
    if (!card) return;
    const id = Number(card.dataset.id);
    const now = Date.now();
    if (lastTap.id === id && (now - lastTap.time) < 350) {
      e.preventDefault();
      const p = state.products.find((x) => x.id === id);
      if (p) openProductModal(p);
      lastTap = { id: 0, time: 0 };
    } else {
      lastTap = { id, time: now };
    }
  }, { passive: false });

  // Acciones (+ o qty) dentro del modal: misma lógica que en la grilla.
  if (els.pmActions) {
    els.pmActions.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act][data-id]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      if (act === "add" || act === "inc") changeQty(id, +1);
      else if (act === "dec") changeQty(id, -1);
    });
    els.pmActions.addEventListener("change", (e) => {
      const inp = e.target.closest('input.card-qty-num[data-act="set"][data-id]');
      if (!inp) return;
      setQty(Number(inp.dataset.id), inp.value);
    });
    els.pmActions.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const inp = e.target.closest('input.card-qty-num[data-act="set"][data-id]');
      if (!inp) return;
      e.preventDefault();
      inp.blur();
    });
    els.pmActions.addEventListener("focusin", (e) => {
      const inp = e.target.closest('input.card-qty-num[data-act="set"][data-id]');
      if (inp) inp.select();
    });
  }

  // Cerrar modal: botón X o tecla ESC. NO se cierra al tocar el fondo
  // (decisión de UX para Maxaria).
  if (els.pmClose) els.pmClose.addEventListener("click", closeProductModal);

  // ----- Mis ganancias (solo vendedor level 5) -----
  async function openEarnings() {
    if (!els.earningsDrawer) return;
    els.earningsBody.innerHTML = '<p class="muted">Cargando...</p>';
    openDrawer(els.earningsDrawer);
    try {
      const data = await api("/api/vendedor/earnings");
      renderEarnings(data);
    } catch (e) {
      els.earningsBody.innerHTML = '<p class="muted">Error cargando ganancias.</p>';
    }
  }

  function renderEarnings(data) {
    const s = data.summary || {};
    const orders = data.orders || [];
    const fmt = (n) => "$" + (Number(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let html = '<section class="earn-summary">' +
      '<div class="earn-card"><div class="earn-label">Pedidos</div><div class="earn-value">' + (s.total_orders || 0) + '</div></div>' +
      '<div class="earn-card"><div class="earn-label">Entregados</div><div class="earn-value">' + (s.total_delivered || 0) + '</div></div>' +
      '<div class="earn-card"><div class="earn-label">Vendido</div><div class="earn-value">' + fmt(s.total_sold) + '</div></div>' +
      '<div class="earn-card"><div class="earn-label">Costo</div><div class="earn-value muted">' + fmt(s.total_cost) + '</div></div>' +
      '<div class="earn-card earn-card-strong"><div class="earn-label">Ganancia</div><div class="earn-value"><strong>' + fmt(s.total_earning) + '</strong></div></div>' +
    '</section>';
    if (!orders.length) {
      html += '<p class="muted">Todavia no hay pedidos.</p>';
      els.earningsBody.innerHTML = html;
      return;
    }
    html += '<h4 style="margin:18px 0 8px 0">Detalle por pedido</h4>';
    html += orders.map((o) => {
      const cliente = o.client_full_name || o.client_username || ("#" + o.user_id);
      const date = formatDate(o.created_at);
      return '<article class="order-card">' +
        '<header class="order-head">' +
          '<div>' +
            '<h4>Pedido #' + o.id + ' <span class="order-status ' + escapeHtml(o.status) + '">' + escapeHtml(statusLabel(o.status)) + '</span></h4>' +
            '<div class="meta">' + date + ' &middot; ' + escapeHtml(cliente) + '</div>' +
          '</div>' +
          '<div class="order-total">' +
            '<div class="muted small">Costo: ' + fmt(o.cost_total) + '</div>' +
            '<div><strong>Gana: ' + fmt(o.earning_total) + '</strong></div>' +
          '</div>' +
        '</header>' +
      '</article>';
    }).join("");
    els.earningsBody.innerHTML = html;
  }

  // ----- Apertura / cierre de los drawers -----
  // El estado "hay un drawer abierto" tambien se refleja como
  // una entrada en el history del navegador, asi el boton "atras"
  // del navegador (o del celular) cierra el drawer en vez de
  // sacar al usuario del catalogo.
  let drawerHistoryPushed = false;

  function openDrawer(drawer) {
    els.cartDrawer.hidden = true;
    els.ordersDrawer.hidden = true;
    if (els.priceChangesDrawer) els.priceChangesDrawer.hidden = true;
    if (els.clientDrawer) els.clientDrawer.hidden = true;
    if (els.earningsDrawer) els.earningsDrawer.hidden = true;
    if (els.sidebarEl) els.sidebarEl.classList.remove("sidebar-open");
    drawer.hidden = false;
    els.backdrop.hidden = false;
    if (!drawerHistoryPushed) {
      try { history.pushState({ drawerOpen: true }, ""); } catch (_) {}
      drawerHistoryPushed = true;
    }
  }

  function openSidebarDrawer() {
    els.cartDrawer.hidden = true;
    els.ordersDrawer.hidden = true;
    if (els.priceChangesDrawer) els.priceChangesDrawer.hidden = true;
    if (els.clientDrawer) els.clientDrawer.hidden = true;
    if (els.earningsDrawer) els.earningsDrawer.hidden = true;
    if (els.sidebarEl) els.sidebarEl.classList.add("sidebar-open");
    els.backdrop.hidden = false;
    if (!drawerHistoryPushed) {
      try { history.pushState({ drawerOpen: true }, ""); } catch (_) {}
      drawerHistoryPushed = true;
    }
  }

  function anyDrawerOpen() {
    return !els.cartDrawer.hidden || !els.ordersDrawer.hidden ||
           (els.priceChangesDrawer && !els.priceChangesDrawer.hidden) ||
           (els.clientDrawer && !els.clientDrawer.hidden) ||
           (els.earningsDrawer && !els.earningsDrawer.hidden) ||
           (els.sidebarEl && els.sidebarEl.classList.contains("sidebar-open"));
  }

  function closeDrawers(fromPopState) {
    const wasOpen = anyDrawerOpen();
    els.cartDrawer.hidden = true;
    els.ordersDrawer.hidden = true;
    if (els.priceChangesDrawer) els.priceChangesDrawer.hidden = true;
    if (els.clientDrawer) els.clientDrawer.hidden = true;
    if (els.earningsDrawer) els.earningsDrawer.hidden = true;
    if (els.sidebarEl) els.sidebarEl.classList.remove("sidebar-open");
    els.backdrop.hidden = true;
    if (wasOpen && drawerHistoryPushed && !fromPopState) {
      drawerHistoryPushed = false;
      try { history.back(); } catch (_) {}
    } else if (fromPopState) {
      drawerHistoryPushed = false;
    }
  }

  els.cartBtn.addEventListener("click", () => { openDrawer(els.cartDrawer); });
  els.cartClose.addEventListener("click", () => { closeDrawers(); });
  els.cartBack.addEventListener("click", () => { closeDrawers(); });
  els.cartSend.addEventListener("click", sendCart);

  els.ordersBtn.addEventListener("click", openOrders);
  els.ordersClose.addEventListener("click", () => { closeDrawers(); });
  els.ordersBack.addEventListener("click", () => { closeDrawers(); });

  if (els.earningsBtn) els.earningsBtn.addEventListener("click", openEarnings);
  if (els.earningsClose) els.earningsClose.addEventListener("click", () => { closeDrawers(); });
  if (els.earningsBack)  els.earningsBack.addEventListener("click",  () => { closeDrawers(); });

  if (els.priceChangesBtn) {
    els.priceChangesBtn.addEventListener("click", openPriceChanges);
  }
  if (els.pcClose) els.pcClose.addEventListener("click", () => { closeDrawers(); });
  if (els.pcBack)  els.pcBack.addEventListener("click",  () => { closeDrawers(); });

  if (els.clientClose) els.clientClose.addEventListener("click", () => { closeDrawers(); });
  if (els.clientBack)  els.clientBack.addEventListener("click",  () => { closeDrawers(); });

  // Boton "Categorias" (solo visible en mobile) abre el sidebar como drawer
  if (els.catToggleBtn) els.catToggleBtn.addEventListener("click", openSidebarDrawer);
  if (els.sidebarClose) els.sidebarClose.addEventListener("click", () => { closeDrawers(); });

  // Click en el fondo oscuro = cerrar
  els.backdrop.addEventListener("click", () => { closeDrawers(); });

  // Boton "atras" del navegador / celular
  window.addEventListener("popstate", () => {
    if (anyDrawerOpen()) closeDrawers(true);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isModalOpen()) { closeProductModal(); return; }
    if (anyDrawerOpen()) closeDrawers();
  });

  // VENTA / PRESUPUESTOS: vive en su propia pagina /ventas (public/ventas.html
  // + public/js/ventas.js). El boton "🧾 Venta" la abre como modal flotante
  // embebido (iframe) sobre el catalogo, en vez de navegar. El iframe carga
  // /ventas?modal=1, que oculta su topbar para verse como un modal limpio.
  const ventasModal      = document.getElementById("ventas-modal");
  const ventasModalFrame = document.getElementById("ventas-modal-frame");
  const ventasModalClose = document.getElementById("ventas-modal-close");

  function openVentasModal() {
    if (!ventasModal || !ventasModalFrame) { window.location.href = "/ventas"; return; }
    // Cargar recien al abrir (y recargar siempre para datos frescos).
    ventasModalFrame.src = "/ventas?modal=1";
    ventasModal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeVentasModal() {
    if (!ventasModal) return;
    ventasModal.hidden = true;
    document.body.style.overflow = "";
    // Liberar el iframe para no dejar la pagina corriendo en segundo plano.
    if (ventasModalFrame) ventasModalFrame.src = "about:blank";
  }

  if (els.ventaBtn) {
    els.ventaBtn.addEventListener("click", openVentasModal);
  }
  if (ventasModalClose) ventasModalClose.addEventListener("click", closeVentasModal);
  // Cerrar con Escape (NO al clickear el backdrop, por consistencia con el
  // resto de los modales del proyecto, que no se cierran al clickear afuera).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ventasModal && !ventasModal.hidden) closeVentasModal();
  });

  // ── Menú hamburguesa del topbar ──
  // Click en ☰ → toggle. Click adentro de un item (no en el select) → cierra.
  // Click afuera o ESC → cierra.
  function closeTopbarMenu() {
    if (!els.topbarMenu || els.topbarMenu.hidden) return;
    els.topbarMenu.hidden = true;
    if (els.topbarMenuBtn) els.topbarMenuBtn.setAttribute("aria-expanded", "false");
  }
  function openTopbarMenu() {
    if (!els.topbarMenu) return;
    els.topbarMenu.hidden = false;
    if (els.topbarMenuBtn) els.topbarMenuBtn.setAttribute("aria-expanded", "true");
  }
  if (els.topbarMenuBtn) {
    els.topbarMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (els.topbarMenu.hidden) openTopbarMenu();
      else closeTopbarMenu();
    });
  }
  if (els.topbarMenu) {
    // Click en un item del menú: cierra (excepto si fue dentro del level-switcher,
    // donde el usuario está interactuando con el <select>).
    els.topbarMenu.addEventListener("click", (e) => {
      if (e.target.closest("#level-switcher")) return;
      // Si fue un click sobre un item con role menuitem o cualquier botón/link
      const item = e.target.closest(".topbar-menu-item");
      if (item) closeTopbarMenu();
    });
  }
  // Click afuera cierra
  document.addEventListener("click", (e) => {
    if (!els.topbarMenu || els.topbarMenu.hidden) return;
    if (e.target.closest("#topbar-menu") || e.target.closest("#topbar-menu-btn")) return;
    closeTopbarMenu();
  });
  // ESC cierra
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.topbarMenu && !els.topbarMenu.hidden) closeTopbarMenu();
  });

  // ── Altura dinamica del topbar para sidebar sticky ──
  // Desde el rework a grid (2 filas desktop / 3 filas mobile) la altura del
  // topbar varia segun resolucion y botones visibles. Exponemos --topbar-h
  // para que .sidebar (top + height) y otros sticky se acomoden solos.
  function updateTopbarHeight() {
    const tb = document.querySelector(".topbar");
    if (!tb) return;
    const h = tb.offsetHeight;
    if (h > 0) document.documentElement.style.setProperty("--topbar-h", h + "px");
  }
  // Actualizar al cargar, al cambiar tamano, y cuando el browser termina de
  // calcular layout despues de mostrar/ocultar botones (admin-link, level-switcher, etc).
  window.addEventListener("resize", updateTopbarHeight);
  window.addEventListener("orientationchange", updateTopbarHeight);
  requestAnimationFrame(updateTopbarHeight);
  // Re-medir despues del bootstrap (los botones cambian de hidden a visible)
  setTimeout(updateTopbarHeight, 300);

  bootstrap();
})();
