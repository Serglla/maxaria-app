/**
 * Maxaria - Panel admin
 * Tabs: Productos (editable), Pedidos (lista de todos).
 * Usuarios y Graficos vienen en commits siguientes.
 */
(function () {
  "use strict";

  const PAGE_SIZE = 50;
  const LS_KEY = "maxaria.admin.products.prefs";

  // Tipos por columna para el comparador.
  // "text"   -> compare con localeCompare
  // "number" -> compare numerico
  const SORT_TYPES = {
    code: "text",
    name: "text",
    category_name: "text",
    stock: "number",
    cost: "number",
    price_minorista: "number",
    price_revendedor: "number",
    price_mayorista: "number",
    price_vip: "number",
    price_publico: "number",
    active: "number",
  };

  const els = {
    userInfo: document.getElementById("user-info"),
    logoutBtn: document.getElementById("logout-btn"),
    tabBtns: document.querySelectorAll(".tab-btn"),
    panels: document.querySelectorAll(".tab-panel"),
    // Sidebar (mobile drawer)
    sidebarEl: document.getElementById("admin-sidebar"),
    sidebarToggle: document.getElementById("admin-sidebar-toggle"),
    sidebarClose: document.getElementById("admin-sidebar-close"),
    sidebarBackdrop: document.getElementById("admin-sidebar-backdrop"),

    // Productos
    prodSearch: document.getElementById("prod-search"),
    filterCategory: document.getElementById("filter-category"),
    filterStock: document.getElementById("filter-stock"),
    filterInactive: document.getElementById("filter-inactive"),
    prodCount: document.getElementById("prod-count"),
    prodTbody: document.getElementById("prod-tbody"),
    pagePrev: document.getElementById("page-prev"),
    pageNext: document.getElementById("page-next"),
    pageInfo: document.getElementById("page-info"),
    excelFile: document.getElementById("excel-file"),
    prodTable: document.getElementById("prod-table"),
    prodHeaders: document.querySelectorAll('#prod-table thead th.sortable'),

    // Pedidos
    ordersSearch: document.getElementById("orders-search"),
    ordersClientFilter: document.getElementById("orders-client-filter"),
    ordersCount: document.getElementById("orders-count"),
    ordersList: document.getElementById("orders-list"),

    // Modal imagen
    imgModal: document.getElementById("img-modal"),
    imgModalTitle: document.getElementById("img-modal-title"),
    imgModalPreview: document.getElementById("img-modal-preview"),
    imgModalNoImg: document.getElementById("img-modal-no-img"),
    imgUploadFile: document.getElementById("img-upload-file"),
    imgUrlInput: document.getElementById("img-url-input"),
    imgUrlSave: document.getElementById("img-url-save"),
    imgModalMsg: document.getElementById("img-modal-msg"),

    // Modal de import
    importModal: document.getElementById("import-modal"),
    importTitle: document.getElementById("import-title"),
    importBody: document.getElementById("import-body"),
    importClose: document.getElementById("import-close"),

    // Config
    cfgAppName: document.getElementById("cfg-app-name"),
    cfgAppNameSave: document.getElementById("cfg-app-name-save"),
    cfgAppNameMsg: document.getElementById("cfg-app-name-msg"),
    cfgWhatsapp: document.getElementById("cfg-whatsapp"),
    cfgWhatsappSave: document.getElementById("cfg-whatsapp-save"),
    cfgWhatsappMsg: document.getElementById("cfg-whatsapp-msg"),
    cfgWhatsappCurrent: document.getElementById("cfg-whatsapp-current"),
    cfgPcChecks: document.querySelectorAll('input[data-pc-level]'),
    cfgPcSave: document.getElementById("cfg-pc-save"),
    cfgPcMsg: document.getElementById("cfg-pc-msg"),

    // Banner DB
    dbWarning: document.getElementById("db-warning"),
    dbWarningText: document.getElementById("db-warning-text"),
    dbWarningDetails: document.getElementById("db-warning-details"),

    // DB info / users export-import
    dbinfoPath: document.getElementById("dbinfo-path"),
    dbinfoStatus: document.getElementById("dbinfo-status"),
    dbinfoSize: document.getElementById("dbinfo-size"),
    dbinfoMtime: document.getElementById("dbinfo-mtime"),
    dbinfoCounts: document.getElementById("dbinfo-counts"),
    dbinfoBackupsDir: document.getElementById("dbinfo-backups-dir"),
    dbinfoBackups: document.getElementById("dbinfo-backups"),
    usersExportBtn: document.getElementById("users-export-btn"),
    usersImportFile: document.getElementById("users-import-file"),
    usersIoMsg: document.getElementById("users-io-msg"),

    // Usuarios
    userSearch: document.getElementById("user-search"),
    userCount: document.getElementById("user-count"),
    userTbody: document.getElementById("user-tbody"),
    userCreateBtn: document.getElementById("user-create-btn"),
    userCreateModal: document.getElementById("user-create-modal"),
    userCreateForm: document.getElementById("user-create-form"),
    userCreateMsg: document.getElementById("user-create-msg"),
    userResetModal: document.getElementById("user-reset-modal"),
    userResetForm: document.getElementById("user-reset-form"),
    userResetTarget: document.getElementById("user-reset-target"),
    userResetMsg: document.getElementById("user-reset-msg"),
    userCatsModal: document.getElementById("user-cats-modal"),
    userCatsTarget: document.getElementById("user-cats-target"),
    userCatsList: document.getElementById("user-cats-list"),
    userCatsAll: document.getElementById("user-cats-all"),
    userCatsNone: document.getElementById("user-cats-none"),
    userCatsMsg: document.getElementById("user-cats-msg"),
    userCatsSave: document.getElementById("user-cats-save"),
    // Administradores (solo superadmin)
    adminsTbody: document.getElementById("admins-tbody"),
    adminCreateBtn: document.getElementById("admin-create-btn"),
    adminCreateModal: document.getElementById("admin-create-modal"),
    adminCreateForm: document.getElementById("admin-create-form"),
    adminCreateSections: document.getElementById("admin-create-sections"),
    adminCreateAll: document.getElementById("admin-create-all"),
    adminCreateNone: document.getElementById("admin-create-none"),
    adminCreateMsg: document.getElementById("admin-create-msg"),
    adminSectionsModal: document.getElementById("admin-sections-modal"),
    adminSectionsTarget: document.getElementById("admin-sections-target"),
    adminSectionsList: document.getElementById("admin-sections-list"),
    adminSectionsAll: document.getElementById("admin-sections-all"),
    adminSectionsNone: document.getElementById("admin-sections-none"),
    adminSectionsMsg: document.getElementById("admin-sections-msg"),
    adminSectionsSave: document.getElementById("admin-sections-save"),
    adminResetModal: document.getElementById("admin-reset-modal"),
    adminResetTarget: document.getElementById("admin-reset-target"),
    adminResetForm: document.getElementById("admin-reset-form"),
    adminResetMsg: document.getElementById("admin-reset-msg"),

    // Vendedores
    vendSearch: document.getElementById("vend-search"),
    vendCount: document.getElementById("vend-count"),
    vendTbody: document.getElementById("vend-tbody"),
    vendCreateBtn: document.getElementById("vend-create-btn"),
    vendCreateModal: document.getElementById("vend-create-modal"),
    vendCreateForm: document.getElementById("vend-create-form"),
    vendCreateMsg: document.getElementById("vend-create-msg"),
    vendResetModal: document.getElementById("vend-reset-modal"),
    vendResetForm: document.getElementById("vend-reset-form"),
    vendResetTarget: document.getElementById("vend-reset-target"),
    vendResetMsg: document.getElementById("vend-reset-msg"),

    // Actividad (Ganancias por vendedor)
    actCount: document.getElementById("act-count"),
    actTbody: document.getElementById("act-tbody"),
    actTfoot: document.getElementById("act-tfoot"),
    actDetailModal: document.getElementById("act-detail-modal"),
    actDetailTitle: document.getElementById("act-detail-title"),
    actDetailTbody: document.getElementById("act-detail-tbody"),
    actDetailTfoot: document.getElementById("act-detail-tfoot"),
    // Actividad - sub-tabs y nuevas vistas
    actSubtabs: document.querySelectorAll(".act-subtab"),
    actSubpanels: document.querySelectorAll(".act-subpanel"),
    // Clientes
    actCliFrom: document.getElementById("act-cli-from"),
    actCliTo: document.getElementById("act-cli-to"),
    actCliApply: document.getElementById("act-cli-apply"),
    actCliSearch: document.getElementById("act-cli-search"),
    actCliCount: document.getElementById("act-cli-count"),
    actCliTbody: document.getElementById("act-cli-tbody"),
    actCliTfoot: document.getElementById("act-cli-tfoot"),
    actCliDetailModal: document.getElementById("act-cli-detail-modal"),
    actCliDetailTitle: document.getElementById("act-cli-detail-title"),
    actCliDetailSub: document.getElementById("act-cli-detail-sub"),
    actCliDetailTbody: document.getElementById("act-cli-detail-tbody"),
    actCliDetailTfoot: document.getElementById("act-cli-detail-tfoot"),
    // Ranking productos
    actRkFrom: document.getElementById("act-rk-from"),
    actRkTo: document.getElementById("act-rk-to"),
    actRkApply: document.getElementById("act-rk-apply"),
    actRkSearch: document.getElementById("act-rk-search"),
    actRkSort: document.getElementById("act-rk-sort"),
    actRkCount: document.getElementById("act-rk-count"),
    actRkTbody: document.getElementById("act-rk-tbody"),
    actRkTfoot: document.getElementById("act-rk-tfoot"),
    // Stock
    actStLow: document.getElementById("act-st-low"),
    actStApply: document.getElementById("act-st-apply"),
    actStKpis: document.getElementById("act-st-kpis"),
    actStPotential: document.getElementById("act-st-potential"),
    actStPotVal: document.getElementById("act-st-pot-val"),
    actStLowTbody: document.getElementById("act-st-low-tbody"),
    actStOutTbody: document.getElementById("act-st-out-tbody"),
    // Por categoria
    actCatCount: document.getElementById("act-cat-count"),
    actCatTbody: document.getElementById("act-cat-tbody"),
    actCatTfoot: document.getElementById("act-cat-tfoot"),
    // Sin movimiento
    actDeadDays: document.getElementById("act-dead-days"),
    actDeadApply: document.getElementById("act-dead-apply"),
    actDeadCount: document.getElementById("act-dead-count"),
    actDeadTbody: document.getElementById("act-dead-tbody"),
    actDeadTfoot: document.getElementById("act-dead-tfoot"),
    // Mensual
    actMoMonths: document.getElementById("act-mo-months"),
    actMoCount: document.getElementById("act-mo-count"),
    actMoTbody: document.getElementById("act-mo-tbody"),
    actMoTfoot: document.getElementById("act-mo-tfoot"),
    actMoChart: document.getElementById("act-mo-chart"),
    actMoKpiOrders: document.getElementById("act-mo-kpi-orders"),
    actMoKpiDelivered: document.getElementById("act-mo-kpi-delivered"),
    actMoKpiGross: document.getElementById("act-mo-kpi-gross"),
    actMoKpiCost: document.getElementById("act-mo-kpi-cost"),
    actMoKpiEarn: document.getElementById("act-mo-kpi-earn"),
    actMoKpiMargin: document.getElementById("act-mo-kpi-margin"),
    actMoKpiPurch: document.getElementById("act-mo-kpi-purch"),
    actMoKpiExp: document.getElementById("act-mo-kpi-exp"),
    actMoKpiOut: document.getElementById("act-mo-kpi-out"),
    actMoKpiPays: document.getElementById("act-mo-kpi-pays"),
    actMoKpiAvg: document.getElementById("act-mo-kpi-avg"),
    actMoKpiFlow: document.getElementById("act-mo-kpi-flow"),

    // Entregas
    entSearch: document.getElementById("ent-search"),
    entVendFilter: document.getElementById("ent-vend-filter"),
    entCount: document.getElementById("ent-count"),
    entTbody: document.getElementById("ent-tbody"),

    // Modal entrega
    deliveryModal: document.getElementById("delivery-modal"),
    deliveryModalOrder: document.getElementById("delivery-modal-order"),
    deliveryForm: document.getElementById("delivery-form"),
    deliveryFormMsg: document.getElementById("delivery-form-msg"),
    deliveryTotalPreview: document.getElementById("delivery-total-preview"),

    // Proveedores
    supSearch: document.getElementById("sup-search"),
    supCount: document.getElementById("sup-count"),
    supTbody: document.getElementById("sup-tbody"),
    supCreateBtn: document.getElementById("sup-create-btn"),
    supplierCreateModal: document.getElementById("supplier-create-modal"),
    supplierCreateForm: document.getElementById("supplier-create-form"),
    supplierCreateMsg: document.getElementById("supplier-create-msg"),

    purAddSupBtn: document.getElementById("pur-add-sup-btn"),

    // Compras
    purSupFilter: document.getElementById("pur-sup-filter"),
    purMonthFilter: document.getElementById("pur-month-filter"),
    purCount: document.getElementById("pur-count"),
    purchaseModalTitle: document.getElementById("purchase-modal-title"),
    purTbody: document.getElementById("pur-tbody"),
    purCreateBtn: document.getElementById("pur-create-btn"),
    purchaseCreateModal: document.getElementById("purchase-create-modal"),
    purchaseCreateForm: document.getElementById("purchase-create-form"),
    purchaseCreateMsg: document.getElementById("purchase-create-msg"),
    purFormSupplier: document.getElementById("pur-form-supplier"),
    purProdSearch: document.getElementById("pur-prod-search"),
    purProdResults: document.getElementById("pur-prod-results"),
    purItemsTbody: document.getElementById("pur-items-tbody"),
    purItemsEmpty: document.getElementById("pur-items-empty"),
    purItemsTotal: document.getElementById("pur-items-total"),
    purSubmitBtn: document.getElementById("pur-submit-btn"),
    // Picker de múltiple selección de productos (compra)
    purAddProductsBtn: document.getElementById("pur-add-products-btn"),
    purPickerModal: document.getElementById("pur-picker-modal"),
    purPickerSearch: document.getElementById("pur-picker-search"),
    purPickerAll: document.getElementById("pur-picker-all"),
    purPickerTbody: document.getElementById("pur-picker-tbody"),
    purPickerCount: document.getElementById("pur-picker-count"),
    purPickerConfirm: document.getElementById("pur-picker-confirm"),
    purPickerCancel: document.getElementById("pur-picker-cancel"),

    // Pagos
    paySearch: document.getElementById("pay-search"),
    payMethodFilter: document.getElementById("pay-method-filter"),
    payCount: document.getElementById("pay-count"),
    payTbody: document.getElementById("pay-tbody"),
    payCreateBtn: document.getElementById("pay-create-btn"),
    paymentCreateModal: document.getElementById("payment-create-modal"),
    paymentCreateForm: document.getElementById("payment-create-form"),
    paymentCreateMsg: document.getElementById("payment-create-msg"),
    payFormClient: document.getElementById("pay-form-client"),

    // Cuentas corrientes
    accSearch: document.getElementById("acc-search"),
    accCount: document.getElementById("acc-count"),
    accTbody: document.getElementById("acc-tbody"),
    accReloadBtn: document.getElementById("acc-reload-btn"),

    // Gastos
    expFrom: document.getElementById("exp-from"),
    expTo: document.getElementById("exp-to"),
    expCatFilter: document.getElementById("exp-cat-filter"),
    expSearch: document.getElementById("exp-search"),
    expCount: document.getElementById("exp-count"),
    expTbody: document.getElementById("exp-tbody"),
    expTfoot: document.getElementById("exp-tfoot"),
    expCreateBtn: document.getElementById("exp-create-btn"),
    expCatsBtn: document.getElementById("exp-cats-btn"),
    expSummaryAmount: document.getElementById("exp-summary-amount"),
    expSummaryBycat: document.getElementById("exp-summary-bycat"),
    expCreateModal: document.getElementById("exp-create-modal"),
    expCreateForm: document.getElementById("exp-create-form"),
    expCreateTitle: document.getElementById("exp-create-title"),
    expCreateMsg: document.getElementById("exp-create-msg"),
    expCreateSubmit: document.getElementById("exp-create-submit"),
    expFormCategory: document.getElementById("exp-form-category"),
    expCatsModal: document.getElementById("exp-cats-modal"),
    expCatsTbody: document.getElementById("exp-cats-tbody"),
    expCatCreateForm: document.getElementById("exp-cat-create-form"),
    expCatCreateMsg: document.getElementById("exp-cat-create-msg"),

    // Listas de precios
    plSearch: document.getElementById("pl-search"),
    plCount: document.getElementById("pl-count"),
    plTbody: document.getElementById("pl-tbody"),
    plCreateBtn: document.getElementById("pl-create-btn"),
    plCreateModal: document.getElementById("pl-create-modal"),
    plCreateForm: document.getElementById("pl-create-form"),
    plCreateMsg: document.getElementById("pl-create-msg"),

    // Catálogo PDF
    catalogBtn: document.getElementById("catalog-btn"),
    catalogModal: document.getElementById("catalog-modal"),
    catalogForm: document.getElementById("catalog-form"),
    catalogClientSelect: document.getElementById("catalog-client-select"),
    catalogClientHint: document.getElementById("catalog-client-hint"),
    catalogPriceWrap: document.getElementById("catalog-price-wrap"),
    catalogPriceSelect: document.getElementById("catalog-price-select"),
    catalogPriceListsGroup: document.getElementById("catalog-price-lists-group"),
    catalogCatsWrap: document.getElementById("catalog-cats-wrap"),
    catalogCatsLoading: document.getElementById("catalog-cats-loading"),
    catalogCatsAll: document.getElementById("catalog-cats-all"),
    catalogCatsNone: document.getElementById("catalog-cats-none"),
    catalogWithImages: document.getElementById("catalog-with-images"),
    catalogIncludeChanges: document.getElementById("catalog-include-changes"),
    catalogWaSelect: document.getElementById("catalog-wa-select"),
    catalogMsg: document.getElementById("catalog-msg"),
    catalogGenerateBtn: document.getElementById("catalog-generate-btn"),

    toast: document.getElementById("toast"),
  };

  const state = {
    me: null,
    products: [],         // lista completa (todos los productos, sin filtrar)
    productsFiltered: [], // lista despues de aplicar busqueda + filtros
    page: 0,
    orders: [],
    ordersLoaded: false,
    settingsLoaded: false,
    users: [],
    usersLoaded: false,
    resetTargetId: null,
    catsTargetId: null,
    allCategories: [],           // Cache de todas las categorias (para el modal)
    vendedores: [],
    vendedoresLoaded: false,
    vendResetTargetId: null,
    entregas: [],
    entregasLoaded: false,
    deliveryTargetOrderId: null, // ID del pedido para el modal de entrega
    // Ordenamiento de la tabla de productos.
    // sortField: null = orden original que vino del server.
    // sortDir: "asc" | "desc"
    sortField: null,
    sortDir: "asc",
    // Info de la DB (path, ephemeral, backups, etc). Se llena en checkDbInfo().
    dbInfo: null,
    isAdmin: false, // true si el usuario logueado es nivel 99
    suppliers: [],
    suppliersLoaded: false,
    supplierCreatedFromPurchase: false,
    purchases: [],
    purchasesLoaded: false,
    payments: [],
    paymentsLoaded: false,
    accounts: [],
    accountsLoaded: false,
    // Items pendientes del formulario de nueva/editar compra
    purchaseItems: [],
    editingPurchaseId: null,
    // Selección del picker de productos de compra: Map<product_id, qty>
    purPickerSelected: new Map(),
    // Todos los productos (cache para el buscador de compras)
    allProducts: [],
    allProductsLoaded: false,
    // Listas de precios personalizadas
    priceLists: [],
    priceListsLoaded: false,
    // Cache de vendedores activos para los selects de "asignar vendedor"
    vendedoresActiveCache: [],
  };

  const LEVEL_NAMES = {
    1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP", 5: "Vendedor", 99: "Administrador",
  };

  const PRICE_LEVEL_NAMES = {
    1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP",
  };

  // ---------- helpers ----------
  function fmtPrice(n) { return "$" + (Number(n) || 0).toLocaleString("es-AR"); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
  // ---------- preferencias persistentes (filtros + orden) ----------
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }
  function savePrefs() {
    try {
      const data = {
        search: els.prodSearch.value,
        category: els.filterCategory.value,
        stock: els.filterStock.value,
        inactive: els.filterInactive.checked,
        sortField: state.sortField,
        sortDir: state.sortDir,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (_) {}
  }
  function applyPrefsToControls() {
    const p = loadPrefs();
    if (!p) return;
    if (typeof p.search === "string") els.prodSearch.value = p.search;
    if (p.category && els.filterCategory.querySelector('[value="' + p.category + '"]')) {
      els.filterCategory.value = p.category;
    }
    if (p.stock && els.filterStock.querySelector('[value="' + p.stock + '"]')) {
      els.filterStock.value = p.stock;
    }
    if (typeof p.inactive === "boolean") els.filterInactive.checked = p.inactive;
    if (p.sortField && SORT_TYPES[p.sortField]) {
      state.sortField = p.sortField;
      state.sortDir = p.sortDir === "desc" ? "desc" : "asc";
    }
  }

  function showToast(msg, type) {
    els.toast.textContent = msg;
    els.toast.className = "admin-toast " + (type || "ok");
    els.toast.hidden = false;
    clearTimeout(els.toast._t);
    els.toast._t = setTimeout(() => { els.toast.hidden = true; }, 2400);
  }

  async function api(url, opts) {
    const res = await fetch(url, opts);
    if (res.status === 401) { location.href = "/login"; throw new Error("no auth"); }
    if (res.status === 403) {
      // No usar alert(): es bloqueante y congela el panel. Avisar con toast.
      let msg = "Acceso denegado a esa sección.";
      try { msg = (await res.clone().json()).error || msg; } catch (_) {}
      try { showToast(msg); } catch (_) {}
      throw new Error("forbidden");
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Error " + res.status);
    }
    return res.json();
  }

  // ---------- bootstrap ----------
  async function bootstrap() {
    // Restaurar busqueda + filtros + orden ANTES de pedir productos
    // para no tener que re-renderizar dos veces.
    applyPrefsToControls();
    try {
      const [me, prods] = await Promise.all([
        api("/api/me"),
        api("/api/admin/products"),
      ]);
      state.me = me;
      state.isAdmin = (me.level === 99);
      state.products = prods;
      populateCategoryFilter(prods);
      // Mostrar solo el nombre; si coincide con el rol (ej. usuario "Administrador"
      // con nivel "Administrador"), no repetir. El rol queda como tooltip.
      {
        const nombre = me.fullName || me.username || "";
        const role = me.levelName || "";
        const showRole = role && nombre.toLowerCase() !== role.toLowerCase();
        els.userInfo.textContent = showRole ? (nombre + " · " + role) : nombre;
        els.userInfo.title = role;
      }
      // Nombre dinamico de la app (el "Admin" es redundante: el usuario ya esta en /admin)
      if (me.app_name) {
        const brandEl = document.getElementById("topbar-brand-name");
        if (brandEl) brandEl.textContent = me.app_name;
        document.getElementById("page-title").textContent = me.app_name + " · Admin";
      }
      // Ocultar tabs exclusivos del admin si el usuario es vendedor
      if (!state.isAdmin) {
        document.querySelectorAll(".admin-only").forEach((el) => { el.style.display = "none"; });
        // Vendedor: ir directo a Pedidos y ocultar cosas que no necesita
        const pedBtn = Array.from(els.tabBtns).find((b) => b.dataset.tab === "pedidos");
        if (pedBtn) pedBtn.click();
      } else {
        // Admin: aplicar permisos por sección. El superadmin ve todo (incluida la
        // pestaña Administradores); un admin común solo ve sus secciones.
        const isSuper = !!me.isSuperadmin;
        const allowed = Array.isArray(me.adminSections) ? me.adminSections : null;
        els.tabBtns.forEach((btn) => {
          const tab = btn.dataset.tab;
          if (tab === "administradores") {
            // Solo el superadmin ve y usa esta pestaña.
            btn.hidden = !isSuper;
            btn.style.display = isSuper ? "" : "none";
            return;
          }
          // Si el server mandó la lista de secciones (admin común), ocultar las no permitidas.
          if (!isSuper && allowed && !allowed.includes(tab)) {
            btn.style.display = "none";
          }
        });
        // Aterrizar en la primera pestaña visible permitida.
        const landing = isSuper
          ? Array.from(els.tabBtns).find((b) => b.dataset.tab === "dashboard")
          : Array.from(els.tabBtns).find((b) => b.style.display !== "none" && !b.hidden);
        if (landing) landing.click();
      }
      applyFilters();
    } catch (e) {
      console.error(e);
      els.prodTbody.innerHTML = '<tr><td colspan="13" class="muted">Error cargando productos</td></tr>';
    }
    // En paralelo, chequear dbinfo (no bloqueamos el render principal por esto).
    // Solo si el usuario puede ver Configuración (sino el endpoint da 403).
    const canConfig = !state.isAdmin ? false
      : (me.isSuperadmin || (Array.isArray(me.adminSections) && me.adminSections.includes("config")));
    if (canConfig) checkDbInfo();
  }

  // ---------- DB info / banner ----------
  async function checkDbInfo() {
    try {
      const info = await api("/api/admin/dbinfo");
      state.dbInfo = info;
      // Banner solo si la DB esta en una ruta efimera
      if (info.ephemeral && els.dbWarning) {
        els.dbWarning.hidden = false;
        els.dbWarningText.textContent =
          "Tu base está en una ruta efímera (" + info.dbPath + "). " +
          "En el próximo deploy se va a borrar y vas a perder los " +
          info.counts.users + " usuario(s) y " + info.counts.orders + " pedido(s).";
      }
      // Si el tab de Config ya estaba abierto, refrescar
      renderDbInfoCard();
    } catch (e) {
      console.warn("No se pudo cargar dbinfo:", e);
    }
  }

  function fmtSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function renderDbInfoCard() {
    const info = state.dbInfo;
    if (!info || !els.dbinfoPath) return;
    els.dbinfoPath.textContent = info.dbPath;
    if (info.ephemeral) {
      els.dbinfoStatus.innerHTML =
        '<span class="ephemeral">EFÍMERA</span> ' +
        '<span class="muted">la base se va a borrar en el próximo deploy</span>';
    } else {
      els.dbinfoStatus.innerHTML =
        '<span class="persistent">PERSISTENTE</span> ' +
        '<span class="muted">en un volumen montado, sobrevive a deploys</span>';
    }
    els.dbinfoSize.textContent = fmtSize(info.size);
    els.dbinfoMtime.textContent = info.mtime ? formatDate(info.mtime) : "—";
    els.dbinfoCounts.textContent =
      info.counts.users + " · " + info.counts.products + " · " + info.counts.orders;
    els.dbinfoBackupsDir.textContent = info.backupsDir;
    if (info.backups && info.backups.length) {
      const list = info.backups.slice(0, 7).map((b) =>
        '<li><code>' + escapeHtml(b.name) + '</code> · ' +
        fmtSize(b.size) + ' · ' + formatDate(b.mtime) + '</li>'
      ).join("");
      els.dbinfoBackups.innerHTML = '<ul class="dbinfo-backup-list">' + list + '</ul>';
    } else {
      els.dbinfoBackups.textContent = "—";
    }
  }

  // Click en "Ver detalles" del banner -> ir a tab Config
  if (els.dbWarningDetails) {
    els.dbWarningDetails.addEventListener("click", () => {
      const cfgBtn = Array.from(els.tabBtns).find((b) => b.dataset.tab === "config");
      if (cfgBtn) cfgBtn.click();
    });
  }

  // ---------- Sidebar drawer (mobile) ----------
  function openAdminSidebar() {
    if (!els.sidebarEl) return;
    els.sidebarEl.classList.add("open");
    if (els.sidebarBackdrop) els.sidebarBackdrop.hidden = false;
  }
  function closeAdminSidebar() {
    if (!els.sidebarEl) return;
    els.sidebarEl.classList.remove("open");
    if (els.sidebarBackdrop) els.sidebarBackdrop.hidden = true;
  }
  if (els.sidebarToggle)   els.sidebarToggle.addEventListener("click", openAdminSidebar);
  if (els.sidebarClose)    els.sidebarClose.addEventListener("click", closeAdminSidebar);
  if (els.sidebarBackdrop) els.sidebarBackdrop.addEventListener("click", closeAdminSidebar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.sidebarEl && els.sidebarEl.classList.contains("open")) {
      closeAdminSidebar();
    }
  });

  // ---------- Dashboard ----------
  async function loadDashboard() {
    try {
      const d = await api("/api/admin/dashboard");

      // Helpers
      const fmt = (n) => "$ " + Number(n).toLocaleString("es-AR");
      const setV = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      const setC = (id, cls) => { const el = document.getElementById(id); if (el) { el.classList.remove("dash-kpi-warn","dash-kpi-danger","dash-kpi-good","dash-kpi-accent"); if (cls) el.classList.add(cls); } };

      // Ventas
      setV("dash-sales-today",      fmt(d.salesToday.total));
      setV("dash-sales-today-cnt",  d.salesToday.cnt + " pedido(s)");
      setV("dash-sales-week",       fmt(d.salesWeek.total));
      setV("dash-sales-week-cnt",   d.salesWeek.cnt + " pedido(s)");
      setV("dash-sales-month",      fmt(d.salesMonth.total));
      // Comparativa mes anterior
      {
        const curr = d.salesMonth.total;
        const prev = d.salesPrevMonth.total;
        let vs = "";
        if (prev > 0) {
          const pct = Math.round(((curr - prev) / prev) * 100);
          vs = (pct >= 0 ? "▲ " : "▼ ") + Math.abs(pct) + "% vs mes anterior";
        } else {
          vs = d.salesMonth.cnt + " pedido(s)";
        }
        setV("dash-sales-month-vs", vs);
      }
      setV("dash-cobros-today",     fmt(d.cobrosToday.total));
      setV("dash-cobros-month",     fmt(d.cobrosMonth.total));
      setV("dash-cobros-month-cnt", d.cobrosMonth.cnt + " pago(s)");

      // Pedidos activos
      const byStatus = {};
      (d.activeOrders || []).forEach((r) => { byStatus[r.status] = r.cnt; });
      setV("dash-orders-pendiente",  byStatus["pendiente"]  || 0);
      setV("dash-orders-enviado",    byStatus["enviado"]    || 0);
      setV("dash-orders-preparando", byStatus["preparando"] || 0);
      setV("dash-entregados-hoy",    d.entregadosHoy || 0);
      setV("dash-deuda-total",       fmt(d.deudaTotal || 0));
      if ((d.deudaTotal || 0) > 0) setC("dash-kpi-deuda", "dash-kpi-danger");

      // Stock
      setV("dash-stock-cero", d.stockCero || 0);
      setV("dash-stock-bajo", d.stockBajo || 0);
      setV("dash-stock-ok",   d.stockOk   || 0);

      // Últimos pedidos
      const STATUS_LABEL = { pendiente:"Pendiente", enviado:"Enviado", preparando:"Preparando", entregado:"Entregado", cancelado:"Cancelado" };
      const STATUS_CLS   = { pendiente:"tag-pendiente", enviado:"tag-enviado", preparando:"tag-preparando", entregado:"tag-entregado", cancelado:"tag-cancelado" };
      const tbody = document.getElementById("dash-recent-tbody");
      if (tbody) {
        if (!d.recentOrders || !d.recentOrders.length) {
          tbody.innerHTML = '<tr><td colspan="5" class="muted">Sin pedidos</td></tr>';
        } else {
          tbody.innerHTML = d.recentOrders.map((o) => {
            const name = escapeHtml(o.full_name || o.username);
            const lbl  = STATUS_LABEL[o.status] || o.status;
            const cls  = STATUS_CLS[o.status]   || "";
            const date = (o.created_at || "").slice(0,10).split("-").reverse().join("/");
            return "<tr>" +
              "<td class=\"muted\">#" + o.id + "</td>" +
              "<td>" + name + "</td>" +
              "<td><span class=\"order-tag " + cls + "\">" + lbl + "</span></td>" +
              "<td class=\"num\">" + fmt(o.total) + "</td>" +
              "<td class=\"muted small\">" + date + "</td>" +
              "</tr>";
          }).join("");
        }
      }

      // Top deudores
      const dtbody = document.getElementById("dash-deudores-tbody");
      if (dtbody) {
        if (!d.topDeudores || !d.topDeudores.length) {
          dtbody.innerHTML = '<tr><td colspan="2" class="muted">Sin deudores</td></tr>';
        } else {
          dtbody.innerHTML = d.topDeudores.map((r) =>
            "<tr>" +
            "<td>" + escapeHtml(r.full_name || r.username) + "</td>" +
            "<td class=\"num\" style=\"color:#dc2626;font-weight:600\">" + fmt(r.saldo) + "</td>" +
            "</tr>"
          ).join("");
        }
      }
    } catch (e) {
      console.error("Dashboard error:", e);
    }
  }

  // Botón reload del dashboard
  const dashReloadBtn = document.getElementById("dash-reload");
  if (dashReloadBtn) dashReloadBtn.addEventListener("click", loadDashboard);

  // ---------- tabs ----------
  els.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const tab = btn.dataset.tab;
      els.tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      // Sacar el focus para que el browser no muestre el outline azul
      // sobre el tab anterior (el "doble seleccionado" visual).
      try { btn.blur(); } catch (_) {}
      // En mobile, cerrar el drawer del sidebar al elegir una sección
      closeAdminSidebar();
      els.panels.forEach((p) => { p.hidden = p.id !== "tab-" + tab; });
      if (tab === "dashboard") loadDashboard();
      if (tab === "reportes") loadReportes();
      if (tab === "pedidos" && !state.ordersLoaded) loadOrders();
      if (tab === "config" && !state.settingsLoaded) loadSettings();
      if (tab === "usuarios") {
        if (!state.usersLoaded) loadUsers();
        else refreshUserSelects();
      }
      if (tab === "vendedores") {
        // loadOrders también carga vendedores y setea vendedoresLoaded=true
        // sin renderizar; por eso si ya hay datos llamamos a renderVendedores
        // explícitamente (sino el tbody queda con "Cargando…" inicial).
        if (!state.vendedoresLoaded) loadVendedores();
        else renderVendedores();
      }
      if (tab === "actividad") setActSubtab(actState.currentSub); // re-carga la sub-vista activa
      if (tab === "price-lists") {
        if (!state.priceListsLoaded) loadPriceLists();
        else renderPriceLists();
      }
      if (tab === "entregas" && !state.entregasLoaded) loadEntregas();
      if (tab === "proveedores" && !state.suppliersLoaded) loadSuppliers();
      if (tab === "compras" && !state.purchasesLoaded) loadPurchases();
      if (tab === "pagos" && !state.paymentsLoaded) loadPayments();
      if (tab === "gastos") loadExpenses(); // siempre recargar (datos cambian)
      if (tab === "cuentas" && !state.accountsLoaded) loadAccounts();
      if (tab === "caja") loadCaja();
      if (tab === "administradores") loadAdmins();
      if (tab === "ventas") {
        if (!bState.loaded) loadBudgets();
        // renderVentas se llama desde el handler de tab específico (async)
      }
    });
  });

  // ---------- Usuarios ----------
  async function loadUsers() {
    try {
      els.userTbody.innerHTML = '<tr><td colspan="13" class="muted">Cargando…</td></tr>';
      // Cargamos usuarios + vendedores + listas de precios en paralelo:
      // los dos ultimos llenan los selects de las columnas nuevas.
      const [users, vendedores, priceLists] = await Promise.all([
        api("/api/admin/users"),
        api("/api/admin/vendedores").catch(() => []),
        api("/api/admin/price-lists").catch(() => []),
      ]);
      state.users = users;
      state.usersLoaded = true;
      state.vendedoresActiveCache = (vendedores || []).filter((v) => v.active);
      state.priceLists = priceLists || [];
      state.priceListsLoaded = true;
      // Cargar todas las categorias en cache para el modal de permisos
      if (!state.allCategories.length) {
        try { state.allCategories = await api("/api/categories"); } catch (_) {}
      }
      renderUsers();
    } catch (e) {
      els.userTbody.innerHTML = '<tr><td colspan="13" class="muted">Error cargando usuarios</td></tr>';
    }
  }

  // Refresca SOLO los caches que llenan los selects de "Vendedor asignado"
  // y "Lista de precios" de la tabla de Usuarios. Se llama cada vez que el
  // tab "Usuarios" vuelve a ser activado, asi se ven los vendedores / listas
  // que pudieron crearse en otras pestanas. No recarga la lista de usuarios.
  async function refreshUserSelects() {
    try {
      const [vendedores, priceLists] = await Promise.all([
        api("/api/admin/vendedores").catch(() => state.vendedoresActiveCache),
        api("/api/admin/price-lists").catch(() => state.priceLists),
      ]);
      state.vendedoresActiveCache = (vendedores || []).filter((v) => v.active);
      state.priceLists = priceLists || [];
      state.priceListsLoaded = true;
      renderUsers();
    } catch (_) { /* silencioso: dejamos la tabla como esta */ }
  }

  function renderUsers() {
    const q = els.userSearch.value.trim().toLowerCase();
    // La tabla de Usuarios solo muestra clientes (niveles 1-4). Los vendedores
    // se ven y editan en su propia pestaña; los admins por CLI.
    let list = state.users.filter((u) => [1, 2, 3, 4].includes(Number(u.level)));
    if (q) {
      list = list.filter((u) =>
        (u.username || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    }
    els.userCount.textContent = list.length + (list.length === 1 ? " usuario" : " usuarios");
    if (!list.length) {
      els.userTbody.innerHTML = '<tr><td colspan="13" class="muted">Sin resultados</td></tr>';
      return;
    }
    els.userTbody.innerHTML = list.map(userRowHtml).join("");
  }

  // Opciones <option> para el select de "Vendedor asignado" de un cliente.
  function vendedorOptsHtml(currentId) {
    let html = '<option value="">— Sin asignar —</option>';
    state.vendedoresActiveCache.forEach((v) => {
      const sel = Number(currentId) === Number(v.id) ? " selected" : "";
      const label = (v.full_name || v.username) + " (" + v.username + ")";
      html += '<option value="' + v.id + '"' + sel + '>' + escapeHtml(label) + '</option>';
    });
    return html;
  }

  // Opciones <option> para el select de "Lista de precios" de un cliente.
  function priceListOptsHtml(currentId) {
    let html = '<option value="">— Por nivel —</option>';
    state.priceLists.forEach((pl) => {
      if (!pl.active) return;
      const sel = Number(currentId) === Number(pl.id) ? " selected" : "";
      const label = pl.name + " (" + pl.base_level + ", gana " + pl.markup_percent + "%)";
      html += '<option value="' + pl.id + '"' + sel + '>' + escapeHtml(label) + '</option>';
    });
    return html;
  }

  function userRowHtml(u) {
    const isMe = state.me && state.me.id === u.id;
    const levelOpts = Object.entries(LEVEL_NAMES).map(([v, n]) =>
      '<option value="' + v + '"' + (Number(v) === u.level ? " selected" : "") + '>' + n + '</option>'
    ).join("");
    const lastLogin = u.last_login_at ? formatDate(u.last_login_at) : "—";
    // Solo clientes (level 1-4) pueden tener vendedor y lista. Para vendedores
    // (5) y admin (99) mostramos celdas inactivas con texto.
    const isClient = [1, 2, 3, 4].includes(Number(u.level));
    const vendCell = isClient
      ? '<td><select class="cell-input" data-field="assigned_vendedor_id">' + vendedorOptsHtml(u.assigned_vendedor_id) + '</select></td>'
      : '<td class="muted small-cell">—</td>';
    const plCell = isClient
      ? '<td><select class="cell-input" data-field="price_list_id">' + priceListOptsHtml(u.price_list_id) + '</select></td>'
      : '<td class="muted small-cell">—</td>';
    return '<tr data-id="' + u.id + '"' + (u.active ? '' : ' class="row-inactive"') + '>' +
      '<td class="cell-code">' + escapeHtml(u.username) + (isMe ? ' <span class="muted">(vos)</span>' : '') + '</td>' +
      '<td><input class="cell-input" data-field="full_name" value="' + escapeHtml(u.full_name || "") + '" /></td>' +
      '<td>' +
        '<select class="cell-input cell-level" data-field="level"' + (isMe ? ' title="No podés bajarte de admin a vos mismo"' : '') + '>' + levelOpts + '</select>' +
      '</td>' +
      vendCell +
      plCell +
      '<td><input class="cell-input" data-field="phone" value="' + escapeHtml(u.phone || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="whatsapp_number" type="tel" placeholder="ej: 5491112345678" value="' + escapeHtml(u.whatsapp_number || "") + '" /></td>' +
      '<td class="muted small-cell">' + escapeHtml(u.plain_password || "—") + '</td>' +
      '<td><input class="cell-input" data-field="email" type="email" value="' + escapeHtml(u.email || "") + '" /></td>' +
      '<td><label class="cell-toggle"' + (isMe ? ' title="No podés desactivarte a vos mismo"' : '') + '>' +
        '<input type="checkbox" data-field="active"' + (u.active ? " checked" : "") + (isMe ? " disabled" : "") + ' /><span></span></label></td>' +
      '<td class="muted small-cell">' + lastLogin + '</td>' +
      '<td><button class="btn btn-small btn-cats" data-act="cats" data-id="' + u.id + '" data-username="' + escapeHtml(u.username) + '" type="button" title="Gestionar categorías visibles">Categorías</button></td>' +
      '<td><button class="btn btn-small btn-reset" data-act="reset" data-id="' + u.id + '" data-username="' + escapeHtml(u.username) + '" type="button">Reset pass</button></td>' +
    '</tr>';
  }

  // Auto-save al cambiar nombre/nivel/teléfono/email/active
  els.userTbody.addEventListener("change", async (e) => {
    const inp = e.target.closest("[data-field]");
    if (!inp) return;
    const tr = inp.closest("tr");
    if (!tr) return;
    const id = Number(tr.dataset.id);
    const field = inp.dataset.field;
    let value;
    if (inp.type === "checkbox") value = inp.checked ? 1 : 0;
    else if (field === "level") value = Number(inp.value);
    else value = inp.value;

    inp.classList.add("saving");
    try {
      const out = await api("/api/admin/users/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const idx = state.users.findIndex((x) => x.id === id);
      if (idx >= 0) state.users[idx] = out.user;
      inp.classList.remove("saving");
      inp.classList.add("saved");
      setTimeout(() => inp.classList.remove("saved"), 1200);
      // Si toggleamos active, refrescar la fila para reflejar la clase row-inactive
      if (field === "active") {
        tr.classList.toggle("row-inactive", !out.user.active);
      }
    } catch (err) {
      inp.classList.remove("saving");
      inp.classList.add("error");
      // Revertir el valor visual al estado original
      const orig = state.users.find((x) => x.id === id);
      if (orig) {
        if (inp.type === "checkbox") inp.checked = !!orig.active;
        else if (field === "level") inp.value = String(orig.level);
        else inp.value = orig[field] || "";
      }
      showToast("Error: " + err.message, "err");
      setTimeout(() => inp.classList.remove("error"), 2000);
    }
  });

  // Click en botones de accion de la tabla de usuarios
  els.userTbody.addEventListener("click", async (e) => {
    // Reset pass
    const resetBtn = e.target.closest('[data-act="reset"]');
    if (resetBtn) {
      state.resetTargetId = Number(resetBtn.dataset.id);
      els.userResetTarget.textContent = "Para el usuario: " + resetBtn.dataset.username;
      els.userResetMsg.textContent = "";
      els.userResetForm.reset();
      els.userResetModal.hidden = false;
      setTimeout(() => els.userResetForm.querySelector('[name="password"]').focus(), 50);
      return;
    }

    // Categorias: abrir modal de permisos
    const catsBtn = e.target.closest('[data-act="cats"]');
    if (!catsBtn) return;
    const userId = Number(catsBtn.dataset.id);
    const username = catsBtn.dataset.username;
    state.catsTargetId = userId;
    els.userCatsTarget.textContent = "Usuario: " + username;
    els.userCatsMsg.textContent = "";
    els.userCatsList.innerHTML = '<span class="muted">Cargando…</span>';
    els.userCatsModal.hidden = false;

    try {
      const catData = await api("/api/admin/users/" + userId + "/categories");
      // catData = { categories: [{id, name, allowed}], restricted: bool }
      const allCats = catData.categories || [];

      if (!allCats.length) {
        els.userCatsList.innerHTML = '<span class="muted">No hay categorías cargadas.</span>';
        return;
      }
      els.userCatsList.innerHTML = allCats.map((c) => {
        const checked = c.allowed ? " checked" : "";
        return '<label class="cats-check" title="' + escapeHtml(c.name) + '">' +
          '<input type="checkbox" data-cat-id="' + c.id + '"' + checked + ' />' +
          '<span class="cats-check-lbl">' + escapeHtml(c.name) + '</span>' +
        '</label>';
      }).join("");
    } catch (err) {
      els.userCatsList.innerHTML = '<span class="muted err">Error cargando categorías: ' + escapeHtml(err.message) + '</span>';
    }
  });

  els.userSearch.addEventListener("input", debounce(renderUsers, 150));

  // -------- Vendedores --------
  async function loadVendedores() {
    try {
      if (els.vendTbody) els.vendTbody.innerHTML = '<tr><td colspan="11" class="muted">Cargando…</td></tr>';
      // Listas de precios necesarias para el select "Lista de precios" en cada fila.
      // Se cargan en paralelo si todavía no están en cache.
      const [vendedores, priceLists] = await Promise.all([
        api("/api/admin/vendedores"),
        state.priceListsLoaded ? Promise.resolve(state.priceLists) :
          api("/api/admin/price-lists").catch(() => []),
      ]);
      state.vendedores = vendedores || [];
      if (!state.priceListsLoaded) {
        state.priceLists = priceLists || [];
        state.priceListsLoaded = true;
      }
      state.vendedoresLoaded = true;
      renderVendedores();
    } catch (e) {
      if (els.vendTbody) els.vendTbody.innerHTML = '<tr><td colspan="11" class="muted">Error cargando vendedores</td></tr>';
    }
  }

  function renderVendedores() {
    if (!els.vendTbody) return;
    const q = (els.vendSearch ? els.vendSearch.value : "").trim().toLowerCase();
    let list = state.vendedores;
    if (q) {
      list = list.filter((v) =>
        (v.username || "").toLowerCase().includes(q) ||
        (v.full_name || "").toLowerCase().includes(q)
      );
    }
    if (els.vendCount) els.vendCount.textContent = list.length + (list.length === 1 ? " vendedor" : " vendedores");
    if (!list.length) {
      els.vendTbody.innerHTML = '<tr><td colspan="11" class="muted">Sin resultados</td></tr>';
      return;
    }
    els.vendTbody.innerHTML = list.map(vendRowHtml).join("");
  }

  function vendRowHtml(v) {
    const lastLogin = v.last_login_at ? formatDate(v.last_login_at) : "—";
    // Nivel de costo del vendedor: cuando el tercerizado está en el catálogo
    // sin cliente seleccionado, ve los productos con el precio de ese nivel
    // (price_minorista/revendedor/mayorista/vip de products). Es el "costo"
    // que él paga al admin.
    const plOpts = [1, 2, 3, 4].map((n) =>
      '<option value="' + n + '"' + (Number(v.vendedor_price_level) === n ? " selected" : "") + '>' + PRICE_LEVEL_NAMES[n] + '</option>'
    ).join("");
    return '<tr data-id="' + v.id + '"' + (v.active ? '' : ' class="row-inactive"') + '>' +
      '<td class="cell-code">' + escapeHtml(v.username) + '</td>' +
      '<td><input class="cell-input" data-field="full_name" value="' + escapeHtml(v.full_name || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="phone" value="' + escapeHtml(v.phone || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="whatsapp_number" type="tel" placeholder="ej: 5493442484286" value="' + escapeHtml(v.whatsapp_number || "") + '" title="Numero al que llegan los pedidos de los clientes asignados a este vendedor (formato internacional, sin + ni espacios)." /></td>' +
      '<td title="Nivel de costo: el catálogo le muestra los productos con este precio cuando no tiene un cliente seleccionado.">' +
        '<select class="cell-input" data-field="vendedor_price_level">' + plOpts + '</select>' +
      '</td>' +
      '<td><label class="cell-toggle" title="Tercerizado: solo ve sus clientes asignados. El vendedor no ve este label.">' +
        '<input type="checkbox" data-field="is_tercerizado"' + (Number(v.is_tercerizado) === 1 ? " checked" : "") + ' /><span></span></label></td>' +
      '<td><label class="cell-toggle">' +
        '<input type="checkbox" data-field="active"' + (v.active ? " checked" : "") + ' /><span></span></label></td>' +
      '<td class="num muted">' + (v.total_orders || 0) + '</td>' +
      '<td class="num muted">' + (v.total_deliveries || 0) + '</td>' +
      '<td class="muted small-cell">' + lastLogin + '</td>' +
      '<td><button class="btn btn-small btn-reset" data-act="vend-reset" data-id="' + v.id + '" data-username="' + escapeHtml(v.username) + '" type="button">Reset pass</button></td>' +
    '</tr>';
  }

  // Auto-save en tabla de vendedores
  if (els.vendTbody) {
    els.vendTbody.addEventListener("change", async (e) => {
      const inp = e.target.closest("[data-field]");
      if (!inp) return;
      const tr = inp.closest("tr");
      if (!tr) return;
      const id = Number(tr.dataset.id);
      const field = inp.dataset.field;
      let value;
      if (inp.type === "checkbox") value = inp.checked ? 1 : 0;
      else if (field === "vendedor_price_level") value = Number(inp.value);
      else value = inp.value;
      // is_tercerizado se manda como flag 0/1 al backend (igual que active)

      inp.classList.add("saving");
      try {
        await api("/api/admin/users/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        const idx = state.vendedores.findIndex((x) => x.id === id);
        if (idx >= 0) state.vendedores[idx][field] = value;
        inp.classList.remove("saving");
        inp.classList.add("saved");
        setTimeout(() => inp.classList.remove("saved"), 1200);
        if (field === "active") tr.classList.toggle("row-inactive", !value);
      } catch (err) {
        inp.classList.remove("saving");
        inp.classList.add("error");
        showToast("Error: " + err.message, "err");
        setTimeout(() => inp.classList.remove("error"), 2000);
      }
    });

    els.vendTbody.addEventListener("click", (e) => {
      const resetBtn = e.target.closest('[data-act="vend-reset"]');
      if (!resetBtn) return;
      state.vendResetTargetId = Number(resetBtn.dataset.id);
      if (els.vendResetTarget) els.vendResetTarget.textContent = "Para el vendedor: " + resetBtn.dataset.username;
      if (els.vendResetMsg) els.vendResetMsg.textContent = "";
      if (els.vendResetForm) els.vendResetForm.reset();
      if (els.vendResetModal) els.vendResetModal.hidden = false;
      setTimeout(() => {
        if (els.vendResetForm) els.vendResetForm.querySelector('[name="password"]').focus();
      }, 50);
    });
  }

  if (els.vendSearch) els.vendSearch.addEventListener("input", debounce(renderVendedores, 150));

  if (els.vendCreateBtn) {
    els.vendCreateBtn.addEventListener("click", () => {
      if (els.vendCreateForm) els.vendCreateForm.reset();
      if (els.vendCreateMsg) els.vendCreateMsg.textContent = "";
      if (els.vendCreateModal) els.vendCreateModal.hidden = false;
      setTimeout(() => { if (els.vendCreateForm) els.vendCreateForm.querySelector('[name="username"]').focus(); }, 50);
    });
  }

  if (els.vendCreateForm) {
    els.vendCreateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(els.vendCreateForm);
      const body = {
        username: fd.get("username"),
        password: fd.get("password"),
        full_name: fd.get("full_name"),
        level: 5,
        vendedor_price_level: Number(fd.get("vendedor_price_level")) || 1,
        phone: fd.get("phone"),
        whatsapp_number: fd.get("whatsapp_number") || null,
        email: fd.get("email"),
      };
      els.vendCreateMsg.textContent = "Creando…";
      els.vendCreateMsg.className = "config-msg";
      try {
        const out = await api("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        // Guardar el vendedor_price_level en el nuevo usuario
        if (body.vendedor_price_level && body.vendedor_price_level !== 1) {
          try {
            await api("/api/admin/users/" + out.user.id, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vendedor_price_level: body.vendedor_price_level }),
            });
          } catch (_) {}
        }
        state.vendedoresLoaded = false; // forzar recarga
        await loadVendedores();
        els.vendCreateModal.hidden = true;
        showToast("Vendedor " + out.user.username + " creado");
      } catch (err) {
        els.vendCreateMsg.textContent = err.message;
        els.vendCreateMsg.className = "config-msg err";
      }
    });
  }

  if (els.vendResetForm) {
    els.vendResetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.vendResetTargetId) return;
      const fd = new FormData(els.vendResetForm);
      const password = fd.get("password");
      els.vendResetMsg.textContent = "Guardando…";
      els.vendResetMsg.className = "config-msg";
      try {
        await api("/api/admin/users/" + state.vendResetTargetId + "/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        els.vendResetModal.hidden = true;
        showToast("Contraseña del vendedor actualizada");
      } catch (err) {
        els.vendResetMsg.textContent = err.message;
        els.vendResetMsg.className = "config-msg err";
      }
    });
  }

  // -------- Actividad (ganancias por vendedor) --------
  function fmtMoney(n) { return "$" + (Number(n) || 0).toLocaleString("es-AR"); }

  async function loadActividad() {
    if (!els.actTbody) return;
    els.actTbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
    try {
      const rows = await api("/api/admin/earnings");
      renderActividad(rows);
    } catch (e) {
      els.actTbody.innerHTML = '<tr><td colspan="8" class="muted">Error cargando actividad</td></tr>';
    }
  }

  function renderActividad(rows) {
    if (!rows || !rows.length) {
      els.actTbody.innerHTML = '<tr><td colspan="8" class="muted">Sin vendedores</td></tr>';
      els.actTfoot.innerHTML = "";
      if (els.actCount) els.actCount.textContent = "0 vendedores";
      return;
    }
    if (els.actCount) els.actCount.textContent = rows.length + (rows.length === 1 ? " vendedor" : " vendedores");
    let tOrders = 0, tDeliv = 0, tSold = 0, tCost = 0, tEarn = 0;
    els.actTbody.innerHTML = rows.map((r) => {
      tOrders += Number(r.total_orders) || 0;
      tDeliv += Number(r.total_delivered) || 0;
      tSold += Number(r.total_sold) || 0;
      tCost += Number(r.total_cost) || 0;
      tEarn += Number(r.total_earning) || 0;
      const tipo = Number(r.is_tercerizado) === 1
        ? '<span class="pill pill-warn" title="Solo lo ve el admin">Tercerizado</span>'
        : '<span class="pill">Propio</span>';
      const inactive = r.active ? "" : ' class="row-inactive"';
      return '<tr' + inactive + '>' +
        '<td>' + escapeHtml(r.full_name || r.username) + ' <span class="muted small">(' + escapeHtml(r.username) + ')</span></td>' +
        '<td>' + tipo + '</td>' +
        '<td class="num">' + (Number(r.total_orders) || 0) + '</td>' +
        '<td class="num muted">' + (Number(r.total_delivered) || 0) + '</td>' +
        '<td class="num">' + fmtMoney(r.total_sold) + '</td>' +
        '<td class="num muted">' + fmtMoney(r.total_cost) + '</td>' +
        '<td class="num"><strong>' + fmtMoney(r.total_earning) + '</strong></td>' +
        '<td><button class="btn btn-small" data-act="act-detail" data-id="' + r.vendedor_id + '" data-name="' + escapeHtml(r.full_name || r.username) + '" type="button">Ver detalle</button></td>' +
      '</tr>';
    }).join("");
    els.actTfoot.innerHTML =
      '<tr><th>Totales</th><th></th>' +
      '<th class="num">' + tOrders + '</th>' +
      '<th class="num muted">' + tDeliv + '</th>' +
      '<th class="num">' + fmtMoney(tSold) + '</th>' +
      '<th class="num muted">' + fmtMoney(tCost) + '</th>' +
      '<th class="num"><strong>' + fmtMoney(tEarn) + '</strong></th>' +
      '<th></th></tr>';
  }

  if (els.actTbody) {
    els.actTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest('[data-act="act-detail"]');
      if (!btn) return;
      const vid = Number(btn.dataset.id);
      const name = btn.dataset.name || "";
      if (els.actDetailTitle) els.actDetailTitle.textContent = "Pedidos de " + name;
      if (els.actDetailTbody) els.actDetailTbody.innerHTML = '<tr><td colspan="7" class="muted">Cargando…</td></tr>';
      if (els.actDetailTfoot) els.actDetailTfoot.innerHTML = "";
      if (els.actDetailModal) els.actDetailModal.hidden = false;
      try {
        const data = await api("/api/admin/earnings/" + vid);
        renderActividadDetail(data.orders || []);
      } catch (err) {
        els.actDetailTbody.innerHTML = '<tr><td colspan="7" class="muted">Error</td></tr>';
      }
    });
  }

  function renderActividadDetail(orders) {
    if (!orders.length) {
      els.actDetailTbody.innerHTML = '<tr><td colspan="7" class="muted">Sin pedidos</td></tr>';
      return;
    }
    let tTotal = 0, tCost = 0, tEarn = 0;
    els.actDetailTbody.innerHTML = orders.map((o) => {
      tTotal += Number(o.total) || 0;
      tCost += Number(o.cost_total) || 0;
      tEarn += Number(o.earning_total) || 0;
      const cliente = o.client_full_name || o.client_username || ("#" + o.user_id);
      return '<tr>' +
        '<td>#' + o.id + '</td>' +
        '<td class="muted small">' + escapeHtml(formatDate(o.created_at)) + '</td>' +
        '<td>' + escapeHtml(cliente) + '</td>' +
        '<td>' + escapeHtml(o.status) + '</td>' +
        '<td class="num">' + fmtMoney(o.total) + '</td>' +
        '<td class="num muted">' + fmtMoney(o.cost_total) + '</td>' +
        '<td class="num"><strong>' + fmtMoney(o.earning_total) + '</strong></td>' +
      '</tr>';
    }).join("");
    els.actDetailTfoot.innerHTML =
      '<tr><th colspan="4">Totales</th>' +
      '<th class="num">' + fmtMoney(tTotal) + '</th>' +
      '<th class="num muted">' + fmtMoney(tCost) + '</th>' +
      '<th class="num"><strong>' + fmtMoney(tEarn) + '</strong></th></tr>';
  }

  if (els.actDetailModal) {
    els.actDetailModal.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) {
        els.actDetailModal.hidden = true;
      }
    });
  }

  // -------- Actividad: sub-tabs (clientes / ranking / stock / categorias / muerto) --------
  // Cache de las fechas elegidas y de los datasets para filtros client-side.
  const actState = {
    currentSub: "vendedores",
    clientsRows: [],
    rankingRows: [],
    deadRows: [],
  };

  function todayIso() { return new Date().toISOString().slice(0, 10); }
  function isoDaysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function fmtDateShort(s) {
    if (!s) return "—";
    // s viene como "YYYY-MM-DD HH:MM:SS" o ISO
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (m[3] + "/" + m[2] + "/" + m[1]) : String(s);
  }
  function setActSubtab(name) {
    actState.currentSub = name;
    if (els.actSubtabs) {
      els.actSubtabs.forEach((b) => b.classList.toggle("active", b.dataset.subtab === name));
    }
    if (els.actSubpanels) {
      els.actSubpanels.forEach((p) => { p.hidden = p.dataset.subpanel !== name; });
    }
    if (name === "vendedores") loadActividad();
    else if (name === "clientes") loadActClients();
    else if (name === "ranking") loadActRanking();
    else if (name === "stock") loadActStock();
    else if (name === "categorias") loadActCategories();
    else if (name === "muerto") loadActDead();
    else if (name === "mensual") loadActMonthly();
  }
  if (els.actSubtabs) {
    els.actSubtabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        try { btn.blur(); } catch (_) {}
        setActSubtab(btn.dataset.subtab);
      });
    });
  }

  // ---- Helpers de rango de fechas ----
  function fillDefaultRange(fromInp, toInp) {
    if (fromInp && !fromInp.value) fromInp.value = isoDaysAgo(30);
    if (toInp && !toInp.value) toInp.value = todayIso();
  }
  function rangeQs(fromInp, toInp) {
    const from = fromInp && fromInp.value ? fromInp.value : "";
    const to = toInp && toInp.value ? toInp.value : "";
    const parts = [];
    if (from) parts.push("from=" + encodeURIComponent(from));
    if (to) parts.push("to=" + encodeURIComponent(to));
    return parts.length ? ("?" + parts.join("&")) : "";
  }

  // ---- Clientes ----
  async function loadActClients() {
    if (!els.actCliTbody) return;
    fillDefaultRange(els.actCliFrom, els.actCliTo);
    els.actCliTbody.innerHTML = '<tr><td colspan="9" class="muted">Cargando…</td></tr>';
    try {
      const data = await api("/api/admin/activity/clients" + rangeQs(els.actCliFrom, els.actCliTo));
      actState.clientsRows = data.rows || [];
      renderActClients();
    } catch (e) {
      els.actCliTbody.innerHTML = '<tr><td colspan="9" class="muted">Error cargando datos</td></tr>';
    }
  }
  function renderActClients() {
    if (!els.actCliTbody) return;
    const q = (els.actCliSearch && els.actCliSearch.value || "").trim().toLowerCase();
    const rows = actState.clientsRows.filter((r) => {
      if (!q) return true;
      const hay = (r.full_name || "") + " " + (r.username || "");
      return hay.toLowerCase().indexOf(q) !== -1;
    });
    if (els.actCliCount) {
      els.actCliCount.textContent = rows.length + (rows.length === 1 ? " cliente" : " clientes");
    }
    if (!rows.length) {
      els.actCliTbody.innerHTML = '<tr><td colspan="9" class="muted">Sin clientes con pedidos en el período</td></tr>';
      if (els.actCliTfoot) els.actCliTfoot.innerHTML = "";
      return;
    }
    let tOrders = 0, tDeliv = 0, tSold = 0, tCost = 0, tEarn = 0;
    els.actCliTbody.innerHTML = rows.map((r) => {
      tOrders += Number(r.orders_count) || 0;
      tDeliv += Number(r.delivered_count) || 0;
      tSold += Number(r.total_sold) || 0;
      tCost += Number(r.total_cost) || 0;
      tEarn += Number(r.total_earning) || 0;
      const avg = r.orders_count > 0 ? Math.round((Number(r.total_sold) || 0) / r.orders_count) : 0;
      const name = escapeHtml(r.full_name || r.username) + ' <span class="muted small">(' + escapeHtml(r.username) + ')</span>';
      return '<tr>' +
        '<td>' + name + '</td>' +
        '<td class="num">' + (Number(r.orders_count) || 0) + '</td>' +
        '<td class="num muted">' + (Number(r.delivered_count) || 0) + '</td>' +
        '<td class="num"><strong>' + fmtMoney(r.total_sold) + '</strong></td>' +
        '<td class="num">' + fmtMoney(avg) + '</td>' +
        '<td class="num muted">' + fmtMoney(r.total_cost) + '</td>' +
        '<td class="num"><strong>' + fmtMoney(r.total_earning) + '</strong></td>' +
        '<td class="muted small">' + escapeHtml(fmtDateShort(r.last_order_at)) + '</td>' +
        '<td><button class="btn btn-small" data-act="act-cli-detail" data-id="' + r.user_id + '" data-name="' + escapeHtml(r.full_name || r.username) + '" type="button">Ver detalle</button></td>' +
      '</tr>';
    }).join("");
    if (els.actCliTfoot) {
      els.actCliTfoot.innerHTML =
        '<tr><th>Totales</th>' +
        '<th class="num">' + tOrders + '</th>' +
        '<th class="num muted">' + tDeliv + '</th>' +
        '<th class="num">' + fmtMoney(tSold) + '</th>' +
        '<th></th>' +
        '<th class="num muted">' + fmtMoney(tCost) + '</th>' +
        '<th class="num"><strong>' + fmtMoney(tEarn) + '</strong></th>' +
        '<th></th><th></th></tr>';
    }
  }
  if (els.actCliApply) els.actCliApply.addEventListener("click", loadActClients);
  if (els.actCliSearch) {
    els.actCliSearch.addEventListener("input", () => {
      // debounce simple
      clearTimeout(els.actCliSearch._t);
      els.actCliSearch._t = setTimeout(renderActClients, 150);
    });
  }
  if (els.actCliTbody) {
    els.actCliTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest('[data-act="act-cli-detail"]');
      if (!btn) return;
      const uid = Number(btn.dataset.id);
      const name = btn.dataset.name || "";
      if (els.actCliDetailTitle) els.actCliDetailTitle.textContent = "Pedidos de " + name;
      if (els.actCliDetailSub) {
        const from = els.actCliFrom && els.actCliFrom.value || "";
        const to = els.actCliTo && els.actCliTo.value || "";
        els.actCliDetailSub.textContent = "Rango: " + (from || "(inicio)") + " → " + (to || "(hoy)");
      }
      if (els.actCliDetailTbody) els.actCliDetailTbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
      if (els.actCliDetailTfoot) els.actCliDetailTfoot.innerHTML = "";
      if (els.actCliDetailModal) els.actCliDetailModal.hidden = false;
      try {
        const data = await api("/api/admin/activity/clients/" + uid + rangeQs(els.actCliFrom, els.actCliTo));
        renderActClientDetail(data.orders || []);
      } catch (err) {
        if (els.actCliDetailTbody) els.actCliDetailTbody.innerHTML = '<tr><td colspan="8" class="muted">Error</td></tr>';
      }
    });
  }
  function renderActClientDetail(orders) {
    if (!els.actCliDetailTbody) return;
    if (!orders.length) {
      els.actCliDetailTbody.innerHTML = '<tr><td colspan="8" class="muted">Sin pedidos en el rango</td></tr>';
      return;
    }
    let tTotal = 0, tCost = 0, tEarn = 0, tItems = 0;
    els.actCliDetailTbody.innerHTML = orders.map((o) => {
      tTotal += Number(o.total) || 0;
      tCost += Number(o.cost_total) || 0;
      tEarn += Number(o.earning_total) || 0;
      tItems += Number(o.items_count) || 0;
      const vend = o.vendedor_full_name || o.vendedor_username || '<span class="muted">—</span>';
      return '<tr>' +
        '<td>#' + o.id + '</td>' +
        '<td class="muted small">' + escapeHtml(fmtDateShort(o.created_at)) + '</td>' +
        '<td>' + escapeHtml(vend) + '</td>' +
        '<td>' + escapeHtml(o.status) + '</td>' +
        '<td class="num">' + (Number(o.items_count) || 0) + '</td>' +
        '<td class="num">' + fmtMoney(o.total) + '</td>' +
        '<td class="num muted">' + fmtMoney(o.cost_total) + '</td>' +
        '<td class="num"><strong>' + fmtMoney(o.earning_total) + '</strong></td>' +
      '</tr>';
    }).join("");
    if (els.actCliDetailTfoot) {
      els.actCliDetailTfoot.innerHTML =
        '<tr><th colspan="4">Totales</th>' +
        '<th class="num">' + tItems + '</th>' +
        '<th class="num">' + fmtMoney(tTotal) + '</th>' +
        '<th class="num muted">' + fmtMoney(tCost) + '</th>' +
        '<th class="num"><strong>' + fmtMoney(tEarn) + '</strong></th></tr>';
    }
  }
  if (els.actCliDetailModal) {
    els.actCliDetailModal.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) {
        els.actCliDetailModal.hidden = true;
      }
    });
  }

  // ---- Ranking de productos ----
  async function loadActRanking() {
    if (!els.actRkTbody) return;
    fillDefaultRange(els.actRkFrom, els.actRkTo);
    els.actRkTbody.innerHTML = '<tr><td colspan="10" class="muted">Cargando…</td></tr>';
    try {
      const data = await api("/api/admin/activity/products-ranking" + rangeQs(els.actRkFrom, els.actRkTo));
      actState.rankingRows = data.rows || [];
      renderActRanking();
    } catch (e) {
      els.actRkTbody.innerHTML = '<tr><td colspan="10" class="muted">Error cargando datos</td></tr>';
    }
  }
  function renderActRanking() {
    if (!els.actRkTbody) return;
    const q = (els.actRkSearch && els.actRkSearch.value || "").trim().toLowerCase();
    const sortKey = (els.actRkSort && els.actRkSort.value) || "earning";
    let rows = actState.rankingRows.filter((r) => {
      if (!q) return true;
      const hay = (r.name || "") + " " + (r.code || "") + " " + (r.category_name || "");
      return hay.toLowerCase().indexOf(q) !== -1;
    }).slice();
    rows.sort((a, b) => {
      function score(r) {
        if (sortKey === "sold") return Number(r.total_sold) || 0;
        if (sortKey === "units") return Number(r.units_sold) || 0;
        if (sortKey === "margin") {
          const t = Number(r.total_sold) || 0;
          return t > 0 ? (Number(r.total_earning) || 0) / t : 0;
        }
        return Number(r.total_earning) || 0;
      }
      return score(b) - score(a);
    });
    if (els.actRkCount) {
      els.actRkCount.textContent = rows.length + (rows.length === 1 ? " producto" : " productos");
    }
    if (!rows.length) {
      els.actRkTbody.innerHTML = '<tr><td colspan="10" class="muted">Sin ventas en el período</td></tr>';
      if (els.actRkTfoot) els.actRkTfoot.innerHTML = "";
      return;
    }
    let tUnits = 0, tSold = 0, tCost = 0, tEarn = 0;
    els.actRkTbody.innerHTML = rows.map((r, idx) => {
      tUnits += Number(r.units_sold) || 0;
      tSold += Number(r.total_sold) || 0;
      tCost += Number(r.total_cost) || 0;
      tEarn += Number(r.total_earning) || 0;
      const margin = (Number(r.total_sold) || 0) > 0
        ? ((Number(r.total_earning) || 0) / Number(r.total_sold) * 100)
        : 0;
      const marginCls = margin >= 0 ? "" : ' style="color:#c00"';
      const prod = '<strong>' + escapeHtml(r.name || "") + '</strong>' +
        ' <span class="muted small">' + escapeHtml(r.code || "") + '</span>';
      return '<tr>' +
        '<td class="num muted">' + (idx + 1) + '</td>' +
        '<td>' + prod + '</td>' +
        '<td class="muted small">' + escapeHtml(r.category_name || "—") + '</td>' +
        '<td class="num">' + (Number(r.units_sold) || 0) + '</td>' +
        '<td class="num">' + fmtMoney(r.total_sold) + '</td>' +
        '<td class="num muted">' + fmtMoney(r.total_cost) + '</td>' +
        '<td class="num"><strong>' + fmtMoney(r.total_earning) + '</strong></td>' +
        '<td class="num"' + marginCls + '>' + margin.toFixed(1) + '%</td>' +
        '<td class="num muted">' + (Number(r.stock) || 0) + '</td>' +
        '<td class="muted small">' + escapeHtml(fmtDateShort(r.last_sold_at)) + '</td>' +
      '</tr>';
    }).join("");
    if (els.actRkTfoot) {
      const totMargin = tSold > 0 ? (tEarn / tSold * 100) : 0;
      els.actRkTfoot.innerHTML =
        '<tr><th colspan="3">Totales</th>' +
        '<th class="num">' + tUnits + '</th>' +
        '<th class="num">' + fmtMoney(tSold) + '</th>' +
        '<th class="num muted">' + fmtMoney(tCost) + '</th>' +
        '<th class="num"><strong>' + fmtMoney(tEarn) + '</strong></th>' +
        '<th class="num">' + totMargin.toFixed(1) + '%</th>' +
        '<th></th><th></th></tr>';
    }
  }
  if (els.actRkApply) els.actRkApply.addEventListener("click", loadActRanking);
  if (els.actRkSort) els.actRkSort.addEventListener("change", renderActRanking);
  if (els.actRkSearch) {
    els.actRkSearch.addEventListener("input", () => {
      clearTimeout(els.actRkSearch._t);
      els.actRkSearch._t = setTimeout(renderActRanking, 150);
    });
  }

  // ---- Stock (valorizacion global) ----
  async function loadActStock() {
    if (!els.actStKpis) return;
    const low = Math.max(0, Number(els.actStLow && els.actStLow.value) || 5);
    try {
      const data = await api("/api/admin/activity/stock-valuation?low=" + low);
      renderActStock(data);
    } catch (e) {
      if (els.actStLowTbody) els.actStLowTbody.innerHTML = '<tr><td colspan="5" class="muted">Error cargando datos</td></tr>';
      if (els.actStOutTbody) els.actStOutTbody.innerHTML = '<tr><td colspan="4" class="muted">Error</td></tr>';
    }
  }
  function renderActStock(data) {
    const t = data.totals || {};
    if (els.actStKpis) {
      els.actStKpis.querySelectorAll("[data-k]").forEach((el) => {
        const k = el.dataset.k;
        const v = Number(t[k]) || 0;
        if (el.classList.contains("money")) el.textContent = fmtMoney(v);
        else el.textContent = v.toLocaleString("es-AR");
      });
    }
    // Ganancia potencial = valor minorista - valor costo
    const pot = (Number(t.value_minorista) || 0) - (Number(t.value_cost) || 0);
    if (els.actStPotential && els.actStPotVal) {
      els.actStPotential.style.display = "block";
      els.actStPotVal.textContent = fmtMoney(pot);
    }
    if (els.actStLowTbody) {
      const list = data.low_stock || [];
      if (!list.length) {
        els.actStLowTbody.innerHTML = '<tr><td colspan="5" class="muted">Nada por debajo del umbral</td></tr>';
      } else {
        els.actStLowTbody.innerHTML = list.map((p) => {
          const val = (Number(p.cost) || 0) * (Number(p.stock) || 0);
          return '<tr>' +
            '<td class="muted small">' + escapeHtml(p.code || "") + '</td>' +
            '<td>' + escapeHtml(p.name || "") + '</td>' +
            '<td class="num"><strong style="color:#c47700">' + (Number(p.stock) || 0) + '</strong></td>' +
            '<td class="num muted">' + fmtMoney(p.cost) + '</td>' +
            '<td class="num">' + fmtMoney(val) + '</td>' +
          '</tr>';
        }).join("");
      }
    }
    if (els.actStOutTbody) {
      const list = data.out_of_stock || [];
      if (!list.length) {
        els.actStOutTbody.innerHTML = '<tr><td colspan="4" class="muted">No hay productos activos sin stock</td></tr>';
      } else {
        els.actStOutTbody.innerHTML = list.map((p) => {
          return '<tr>' +
            '<td class="muted small">' + escapeHtml(p.code || "") + '</td>' +
            '<td>' + escapeHtml(p.name || "") + '</td>' +
            '<td class="num muted">' + fmtMoney(p.cost) + '</td>' +
            '<td class="num">' + fmtMoney(p.price_minorista) + '</td>' +
          '</tr>';
        }).join("");
      }
    }
  }
  if (els.actStApply) els.actStApply.addEventListener("click", loadActStock);

  // ---- Por categoria ----
  async function loadActCategories() {
    if (!els.actCatTbody) return;
    els.actCatTbody.innerHTML = '<tr><td colspan="9" class="muted">Cargando…</td></tr>';
    try {
      const data = await api("/api/admin/activity/stock-by-category");
      renderActCategories(data.rows || []);
    } catch (e) {
      els.actCatTbody.innerHTML = '<tr><td colspan="9" class="muted">Error cargando datos</td></tr>';
    }
  }
  function renderActCategories(rows) {
    if (!els.actCatTbody) return;
    if (els.actCatCount) {
      els.actCatCount.textContent = rows.length + (rows.length === 1 ? " categoría" : " categorías");
    }
    if (!rows.length) {
      els.actCatTbody.innerHTML = '<tr><td colspan="9" class="muted">Sin categorías</td></tr>';
      if (els.actCatTfoot) els.actCatTfoot.innerHTML = "";
      return;
    }
    let tProd = 0, tIn = 0, tOut = 0, tUnits = 0, tCost = 0, tMino = 0, tMayo = 0, tPot = 0;
    els.actCatTbody.innerHTML = rows.map((c) => {
      const pot = (Number(c.value_minorista) || 0) - (Number(c.value_cost) || 0);
      tProd += Number(c.total_products) || 0;
      tIn += Number(c.in_stock_products) || 0;
      tOut += Number(c.out_of_stock_products) || 0;
      tUnits += Number(c.units_in_stock) || 0;
      tCost += Number(c.value_cost) || 0;
      tMino += Number(c.value_minorista) || 0;
      tMayo += Number(c.value_mayorista) || 0;
      tPot += pot;
      return '<tr>' +
        '<td><strong>' + escapeHtml(c.category_name || "—") + '</strong></td>' +
        '<td class="num">' + (Number(c.total_products) || 0) + '</td>' +
        '<td class="num">' + (Number(c.in_stock_products) || 0) + '</td>' +
        '<td class="num muted">' + (Number(c.out_of_stock_products) || 0) + '</td>' +
        '<td class="num">' + (Number(c.units_in_stock) || 0) + '</td>' +
        '<td class="num"><strong>' + fmtMoney(c.value_cost) + '</strong></td>' +
        '<td class="num">' + fmtMoney(c.value_minorista) + '</td>' +
        '<td class="num muted">' + fmtMoney(c.value_mayorista) + '</td>' +
        '<td class="num"><strong style="color:#0a7a0a">' + fmtMoney(pot) + '</strong></td>' +
      '</tr>';
    }).join("");
    if (els.actCatTfoot) {
      els.actCatTfoot.innerHTML =
        '<tr><th>Totales</th>' +
        '<th class="num">' + tProd + '</th>' +
        '<th class="num">' + tIn + '</th>' +
        '<th class="num muted">' + tOut + '</th>' +
        '<th class="num">' + tUnits + '</th>' +
        '<th class="num"><strong>' + fmtMoney(tCost) + '</strong></th>' +
        '<th class="num">' + fmtMoney(tMino) + '</th>' +
        '<th class="num muted">' + fmtMoney(tMayo) + '</th>' +
        '<th class="num"><strong>' + fmtMoney(tPot) + '</strong></th></tr>';
    }
  }

  // ---- Sin movimiento ----
  async function loadActDead() {
    if (!els.actDeadTbody) return;
    const days = Math.max(1, Number(els.actDeadDays && els.actDeadDays.value) || 60);
    els.actDeadTbody.innerHTML = '<tr><td colspan="7" class="muted">Cargando…</td></tr>';
    try {
      const data = await api("/api/admin/activity/dead-stock?days=" + days);
      actState.deadRows = data.rows || [];
      renderActDead();
    } catch (e) {
      els.actDeadTbody.innerHTML = '<tr><td colspan="7" class="muted">Error cargando datos</td></tr>';
    }
  }
  function renderActDead() {
    if (!els.actDeadTbody) return;
    const rows = actState.deadRows;
    if (els.actDeadCount) {
      els.actDeadCount.textContent = rows.length + (rows.length === 1 ? " producto" : " productos");
    }
    if (!rows.length) {
      els.actDeadTbody.innerHTML = '<tr><td colspan="7" class="muted">No hay productos sin movimiento en el período 🎉</td></tr>';
      if (els.actDeadTfoot) els.actDeadTfoot.innerHTML = "";
      return;
    }
    let tStock = 0, tCap = 0;
    els.actDeadTbody.innerHTML = rows.map((p) => {
      const cap = (Number(p.cost) || 0) * (Number(p.stock) || 0);
      tStock += Number(p.stock) || 0;
      tCap += cap;
      return '<tr>' +
        '<td class="muted small">' + escapeHtml(p.code || "") + '</td>' +
        '<td><strong>' + escapeHtml(p.name || "") + '</strong></td>' +
        '<td class="muted small">' + escapeHtml(p.category_name || "—") + '</td>' +
        '<td class="num">' + (Number(p.stock) || 0) + '</td>' +
        '<td class="num muted">' + fmtMoney(p.cost) + '</td>' +
        '<td class="num"><strong style="color:#c47700">' + fmtMoney(cap) + '</strong></td>' +
        '<td class="muted small">' + escapeHtml(fmtDateShort(p.last_sold_at)) + '</td>' +
      '</tr>';
    }).join("");
    if (els.actDeadTfoot) {
      els.actDeadTfoot.innerHTML =
        '<tr><th colspan="3">Totales</th>' +
        '<th class="num">' + tStock + '</th><th></th>' +
        '<th class="num"><strong>' + fmtMoney(tCap) + '</strong></th>' +
        '<th></th></tr>';
    }
  }
  if (els.actDeadApply) els.actDeadApply.addEventListener("click", loadActDead);

  // ---- Ventas mensuales ----
  const MONTH_NAMES_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  function fmtMonthLabel(yyyymm) {
    const m = String(yyyymm || "").match(/^(\d{4})-(\d{2})$/);
    if (!m) return yyyymm || "";
    const idx = Math.max(0, Math.min(11, Number(m[2]) - 1));
    return MONTH_NAMES_ES[idx] + " " + m[1];
  }

  async function loadActMonthly() {
    if (!els.actMoTbody) return;
    const months = Math.max(1, Number(els.actMoMonths && els.actMoMonths.value) || 12);
    els.actMoTbody.innerHTML = '<tr><td colspan="11" class="muted">Cargando…</td></tr>';
    if (els.actMoChart) els.actMoChart.innerHTML = "";
    try {
      const data = await api("/api/admin/activity/monthly?months=" + months);
      renderActMonthly(data.rows || []);
    } catch (e) {
      els.actMoTbody.innerHTML = '<tr><td colspan="11" class="muted">Error cargando datos</td></tr>';
    }
  }

  function renderActMonthly(rows) {
    if (!els.actMoTbody) return;
    if (els.actMoCount) {
      els.actMoCount.textContent = rows.length + (rows.length === 1 ? " mes" : " meses");
    }
    if (!rows.length) {
      els.actMoTbody.innerHTML = '<tr><td colspan="11" class="muted">Sin datos</td></tr>';
      if (els.actMoTfoot) els.actMoTfoot.innerHTML = "";
      if (els.actMoChart) els.actMoChart.innerHTML = "";
      return;
    }
    let tOrders = 0, tDeliv = 0, tGross = 0, tCost = 0, tEarn = 0, tPurch = 0, tPays = 0, tExp = 0;
    // Mostramos del mes mas reciente al mas viejo en la tabla.
    const ordered = rows.slice().reverse();
    els.actMoTbody.innerHTML = ordered.map((r) => {
      tOrders += Number(r.orders_count) || 0;
      tDeliv += Number(r.delivered_count) || 0;
      tGross += Number(r.gross_sales) || 0;
      tCost += Number(r.cost_total) || 0;
      tEarn += Number(r.net_earning) || 0;
      tPurch += Number(r.purchases_total) || 0;
      tPays += Number(r.payments_total) || 0;
      tExp += Number(r.expenses_total) || 0;
      const margin = (Number(r.gross_sales) || 0) > 0
        ? ((Number(r.net_earning) || 0) / Number(r.gross_sales) * 100)
        : 0;
      const marginCls = margin >= 0 ? "" : ' style="color:#c00"';
      const earnCls = (Number(r.net_earning) || 0) >= 0 ? "" : ' style="color:#c00"';
      return '<tr>' +
        '<td><strong>' + escapeHtml(fmtMonthLabel(r.month)) + '</strong></td>' +
        '<td class="num">' + (Number(r.orders_count) || 0) + '</td>' +
        '<td class="num muted">' + (Number(r.delivered_count) || 0) + '</td>' +
        '<td class="num"><strong>' + fmtMoney(r.gross_sales) + '</strong></td>' +
        '<td class="num muted">' + fmtMoney(r.cost_total) + '</td>' +
        '<td class="num"' + earnCls + '><strong>' + fmtMoney(r.net_earning) + '</strong></td>' +
        '<td class="num"' + marginCls + '>' + margin.toFixed(1) + '%</td>' +
        '<td class="num">' + fmtMoney(r.avg_ticket) + '</td>' +
        '<td class="num muted">' + fmtMoney(r.purchases_total) + '</td>' +
        '<td class="num muted">' + fmtMoney(r.expenses_total) + '</td>' +
        '<td class="num">' + fmtMoney(r.payments_total) + '</td>' +
      '</tr>';
    }).join("");
    const totMargin = tGross > 0 ? (tEarn / tGross * 100) : 0;
    const totAvg = tOrders > 0 ? Math.round(tGross / tOrders) : 0;
    if (els.actMoTfoot) {
      els.actMoTfoot.innerHTML =
        '<tr><th>Totales</th>' +
        '<th class="num">' + tOrders + '</th>' +
        '<th class="num muted">' + tDeliv + '</th>' +
        '<th class="num"><strong>' + fmtMoney(tGross) + '</strong></th>' +
        '<th class="num muted">' + fmtMoney(tCost) + '</th>' +
        '<th class="num"><strong>' + fmtMoney(tEarn) + '</strong></th>' +
        '<th class="num">' + totMargin.toFixed(1) + '%</th>' +
        '<th class="num">' + fmtMoney(totAvg) + '</th>' +
        '<th class="num muted">' + fmtMoney(tPurch) + '</th>' +
        '<th class="num muted">' + fmtMoney(tExp) + '</th>' +
        '<th class="num">' + fmtMoney(tPays) + '</th></tr>';
    }
    // KPIs del rango. Resultado neto = ganancia bruta - gastos generales.
    // No se restan las compras de mercaderia porque ya estan reflejadas en
    // el costo de ventas cuando esos items se vendieron.
    if (els.actMoKpiOrders) els.actMoKpiOrders.textContent = tOrders.toLocaleString("es-AR");
    if (els.actMoKpiDelivered) els.actMoKpiDelivered.textContent = tDeliv.toLocaleString("es-AR");
    if (els.actMoKpiGross) els.actMoKpiGross.textContent = fmtMoney(tGross);
    if (els.actMoKpiCost) els.actMoKpiCost.textContent = fmtMoney(tCost);
    if (els.actMoKpiEarn) els.actMoKpiEarn.textContent = fmtMoney(tEarn);
    if (els.actMoKpiMargin) els.actMoKpiMargin.textContent = totMargin.toFixed(1) + "%";
    if (els.actMoKpiPurch) els.actMoKpiPurch.textContent = fmtMoney(tPurch);
    if (els.actMoKpiExp) els.actMoKpiExp.textContent = fmtMoney(tExp);
    if (els.actMoKpiOut) els.actMoKpiOut.textContent = fmtMoney(tPurch + tExp);
    if (els.actMoKpiPays) els.actMoKpiPays.textContent = fmtMoney(tPays);
    if (els.actMoKpiAvg) els.actMoKpiAvg.textContent = fmtMoney(totAvg);
    if (els.actMoKpiFlow) els.actMoKpiFlow.textContent = fmtMoney(tEarn - tExp);

    // Grafico simple de barras horizontales. Orden: mes mas reciente arriba
    // (igual que la tabla) para que el lector vea primero "ahora" y baje al
    // pasado.
    if (els.actMoChart) {
      const maxV = Math.max(
        1,
        ...rows.map((r) => Math.max(
          Number(r.gross_sales) || 0,
          Number(r.net_earning) || 0,
          Number(r.purchases_total) || 0
        ))
      );
      els.actMoChart.innerHTML = ordered.map((r) => {
        const gross = Number(r.gross_sales) || 0;
        const earn = Number(r.net_earning) || 0;
        const purch = Number(r.purchases_total) || 0;
        function pct(v) { return Math.max(0, Math.min(100, (v / maxV) * 100)).toFixed(1); }
        return '<div class="act-mo-chart-row">' +
          '<div class="act-mo-chart-label">' + escapeHtml(fmtMonthLabel(r.month)) + '</div>' +
          '<div class="act-mo-chart-bars">' +
            '<div class="act-mo-chart-bar gross" style="width:' + pct(gross) + '%" title="Ventas brutas: ' + fmtMoney(gross) + '">' +
              '<span>' + fmtMoney(gross) + '</span>' +
            '</div>' +
            '<div class="act-mo-chart-bar earn" style="width:' + pct(Math.max(0, earn)) + '%" title="Ganancia: ' + fmtMoney(earn) + '">' +
              '<span>' + fmtMoney(earn) + '</span>' +
            '</div>' +
            '<div class="act-mo-chart-bar purch" style="width:' + pct(purch) + '%" title="Gastos: ' + fmtMoney(purch) + '">' +
              '<span>' + fmtMoney(purch) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join("");
    }
  }

  if (els.actMoMonths) els.actMoMonths.addEventListener("change", loadActMonthly);

  // -------- Listas de precios --------
  async function loadPriceLists() {
    try {
      if (els.plTbody) els.plTbody.innerHTML = '<tr><td colspan="7" class="muted">Cargando…</td></tr>';
      state.priceLists = await api("/api/admin/price-lists");
      state.priceListsLoaded = true;
      renderPriceLists();
    } catch (e) {
      if (els.plTbody) els.plTbody.innerHTML = '<tr><td colspan="7" class="muted">Error cargando listas</td></tr>';
    }
  }

  function renderPriceLists() {
    if (!els.plTbody) return;
    const q = (els.plSearch ? els.plSearch.value : "").trim().toLowerCase();
    let list = state.priceLists;
    if (q) {
      list = list.filter((pl) =>
        (pl.name || "").toLowerCase().includes(q) ||
        (pl.base_level || "").toLowerCase().includes(q) ||
        (pl.notes || "").toLowerCase().includes(q)
      );
    }
    if (els.plCount) els.plCount.textContent = list.length + (list.length === 1 ? " lista" : " listas");
    if (!list.length) {
      els.plTbody.innerHTML = '<tr><td colspan="7" class="muted">Sin listas. Creá una con el botón "+ Nueva lista".</td></tr>';
      return;
    }
    els.plTbody.innerHTML = list.map(plRowHtml).join("");
  }

  function plRowHtml(pl) {
    const baseOpts = ["costo", "minorista", "revendedor", "mayorista", "vip", "publico"].map((b) =>
      '<option value="' + b + '"' + (pl.base_level === b ? " selected" : "") + '>' +
        b.charAt(0).toUpperCase() + b.slice(1) +
      '</option>'
    ).join("");
    const inUse = (pl.users_count || 0) > 0;
    const delTitle = inUse
      ? "No se puede borrar: hay " + pl.users_count + " cliente(s) usando esta lista"
      : "Borrar lista";
    return '<tr data-id="' + pl.id + '"' + (pl.active ? '' : ' class="row-inactive"') + '>' +
      '<td><input class="cell-input" data-field="name" value="' + escapeHtml(pl.name) + '" /></td>' +
      '<td><select class="cell-input" data-field="base_level">' + baseOpts + '</select></td>' +
      '<td class="num"><input class="cell-input num" data-field="markup_percent" type="number" step="0.01" min="-90" max="95" value="' + (Number(pl.markup_percent) || 0) + '" style="width:80px;text-align:right" title="Ganancia limpia % del vendedor sobre el precio final" /></td>' +
      '<td><label class="cell-toggle">' +
        '<input type="checkbox" data-field="active"' + (pl.active ? " checked" : "") + ' /><span></span></label></td>' +
      '<td class="num muted">' + (pl.users_count || 0) + '</td>' +
      '<td><input class="cell-input" data-field="notes" value="' + escapeHtml(pl.notes || "") + '" /></td>' +
      '<td>' +
        '<button class="btn btn-small" data-act="pl-preview" data-id="' + pl.id + '" type="button" title="Ver precios calculados">Preview</button> ' +
        '<button class="btn btn-small btn-danger" data-act="pl-delete" data-id="' + pl.id + '" type="button"' +
          (inUse ? ' disabled' : '') + ' title="' + escapeHtml(delTitle) + '">Borrar</button>' +
      '</td>' +
    '</tr>';
  }

  // Auto-save al cambiar campos de una lista de precios
  if (els.plTbody) {
    els.plTbody.addEventListener("change", async (e) => {
      const inp = e.target.closest("[data-field]");
      if (!inp) return;
      const tr = inp.closest("tr");
      if (!tr) return;
      const id = Number(tr.dataset.id);
      const field = inp.dataset.field;
      let value;
      if (inp.type === "checkbox") value = inp.checked ? 1 : 0;
      else if (field === "markup_percent") value = Number(inp.value);
      else value = inp.value;

      inp.classList.add("saving");
      try {
        const out = await api("/api/admin/price-lists/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        const idx = state.priceLists.findIndex((x) => x.id === id);
        if (idx >= 0) state.priceLists[idx] = out.price_list;
        inp.classList.remove("saving");
        inp.classList.add("saved");
        setTimeout(() => inp.classList.remove("saved"), 1200);
        if (field === "active") tr.classList.toggle("row-inactive", !out.price_list.active);
        // Invalidar la cache de la tabla de usuarios para que se vea el nombre nuevo
        state.usersLoaded = false;
      } catch (err) {
        inp.classList.remove("saving");
        inp.classList.add("error");
        const orig = state.priceLists.find((x) => x.id === id);
        if (orig) {
          if (inp.type === "checkbox") inp.checked = !!orig.active;
          else inp.value = orig[field] != null ? orig[field] : "";
        }
        showToast("Error: " + err.message, "err");
        setTimeout(() => inp.classList.remove("error"), 2000);
      }
    });

    // Click: preview o borrar
    els.plTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;

      if (act === "pl-delete") {
        if (!confirm("¿Borrar esta lista de precios? Esta acción no se puede deshacer.")) return;
        try {
          await api("/api/admin/price-lists/" + id, { method: "DELETE" });
          state.priceLists = state.priceLists.filter((x) => x.id !== id);
          state.usersLoaded = false; // refrescar selects en la tabla de usuarios
          renderPriceLists();
          showToast("Lista eliminada");
        } catch (err) {
          showToast("Error: " + err.message, "err");
        }
      } else if (act === "pl-preview") {
        try {
          const data = await api("/api/admin/price-lists/" + id + "/preview?limit=30");
          showPriceListPreview(data);
        } catch (err) {
          showToast("Error: " + err.message, "err");
        }
      }
    });
  }

  function showPriceListPreview(data) {
    // Modal simple en JS, sin estilos extra: usamos una ventana con un dialog basico.
    const list = data.list || {};
    const products = data.products || [];
    const rows = products.map((p) =>
      '<tr>' +
        '<td>' + escapeHtml(p.code || "") + '</td>' +
        '<td>' + escapeHtml(p.name || "") + '</td>' +
        '<td class="num muted">' + fmtPrice(p.base_price) + '</td>' +
        '<td class="num"><strong>' + fmtPrice(p.effective_price) + '</strong></td>' +
      '</tr>'
    ).join("");

    const overlay = document.createElement("div");
    overlay.className = "admin-modal";
    overlay.style.display = "block";
    overlay.innerHTML =
      '<div class="admin-modal-box" style="max-width:680px">' +
        '<h3>Preview · ' + escapeHtml(list.name || "") + '</h3>' +
        '<p class="muted small">Base: <strong>' + escapeHtml(list.base_level || "") +
          '</strong> · Ganancia: <strong>' + (Number(list.markup_percent) || 0) + '%</strong>' +
          ' · Mostrando hasta 30 productos.</p>' +
        '<div class="admin-table-wrap" style="max-height:60vh;overflow:auto">' +
          '<table class="admin-table">' +
            '<thead><tr><th>Código</th><th>Producto</th>' +
              '<th class="num">Precio base</th><th class="num">Precio cliente</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="4" class="muted">Sin productos</td></tr>') + '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="admin-modal-foot"><button type="button" class="btn btn-primary" data-close-preview>Cerrar</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay || ev.target.closest("[data-close-preview]")) {
        overlay.remove();
      }
    });
  }

  if (els.plSearch) els.plSearch.addEventListener("input", debounce(renderPriceLists, 150));

  if (els.plCreateBtn) {
    els.plCreateBtn.addEventListener("click", () => {
      if (els.plCreateForm) els.plCreateForm.reset();
      if (els.plCreateMsg) els.plCreateMsg.textContent = "";
      if (els.plCreateModal) els.plCreateModal.hidden = false;
      setTimeout(() => { if (els.plCreateForm) els.plCreateForm.querySelector('[name="name"]').focus(); }, 50);
    });
  }

  if (els.plCreateForm) {
    els.plCreateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(els.plCreateForm);
      const body = {
        name: fd.get("name"),
        base_level: fd.get("base_level"),
        markup_percent: Number(fd.get("markup_percent")) || 0,
        notes: fd.get("notes") || null,
      };
      els.plCreateMsg.textContent = "Creando…";
      els.plCreateMsg.className = "config-msg";
      try {
        const out = await api("/api/admin/price-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        state.priceLists.unshift(out.price_list);
        state.usersLoaded = false; // forzar refresh de selects en Usuarios
        renderPriceLists();
        els.plCreateModal.hidden = true;
        showToast("Lista \"" + out.price_list.name + "\" creada");
      } catch (err) {
        els.plCreateMsg.textContent = err.message;
        els.plCreateMsg.className = "config-msg err";
      }
    });
  }

  // -------- Entregas --------
  async function loadEntregas() {
    try {
      if (els.entTbody) els.entTbody.innerHTML = '<tr><td colspan="10" class="muted">Cargando…</td></tr>';
      state.entregas = await api("/api/admin/deliveries");
      state.entregasLoaded = true;
      populateEntVendFilter();
      renderEntregas();
    } catch (e) {
      if (els.entTbody) els.entTbody.innerHTML = '<tr><td colspan="10" class="muted">Error cargando entregas</td></tr>';
    }
  }

  function populateEntVendFilter() {
    if (!els.entVendFilter) return;
    const current = els.entVendFilter.value;
    const seen = new Map();
    state.entregas.forEach((d) => {
      if (d.vendedor_username && !seen.has(d.vendedor_username)) {
        seen.set(d.vendedor_username, d.vendedor_full_name || d.vendedor_username);
      }
    });
    els.entVendFilter.innerHTML = '<option value="all">Todos los vendedores</option>';
    Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1])).forEach(([user, label]) => {
      const opt = document.createElement("option");
      opt.value = user;
      opt.textContent = label;
      els.entVendFilter.appendChild(opt);
    });
    if (current && els.entVendFilter.querySelector('[value="' + current + '"]')) {
      els.entVendFilter.value = current;
    }
  }

  function renderEntregas() {
    if (!els.entTbody) return;
    const q = (els.entSearch ? els.entSearch.value : "").trim().toLowerCase();
    const vendFilter = els.entVendFilter ? els.entVendFilter.value : "all";
    let list = state.entregas;
    if (vendFilter !== "all") list = list.filter((d) => d.vendedor_username === vendFilter);
    if (q) {
      list = list.filter((d) =>
        String(d.order_id).includes(q) ||
        (d.vendedor_username || "").toLowerCase().includes(q) ||
        (d.vendedor_full_name || "").toLowerCase().includes(q) ||
        (d.client_username || "").toLowerCase().includes(q) ||
        (d.client_full_name || "").toLowerCase().includes(q) ||
        (d.delivered_to || "").toLowerCase().includes(q)
      );
    }
    if (els.entCount) els.entCount.textContent = list.length + (list.length === 1 ? " entrega" : " entregas");
    if (!list.length) {
      els.entTbody.innerHTML = '<tr><td colspan="10" class="muted">Sin entregas registradas.</td></tr>';
      return;
    }
    els.entTbody.innerHTML = list.map((d) => {
      const totalCobrado = (d.efectivo_amount || 0) + (d.transferencia_amount || 0);
      return '<tr>' +
        '<td class="cell-code"><a href="#" class="order-link" data-order-id="' + d.order_id + '">#' + d.order_id + '</a></td>' +
        '<td>' + escapeHtml(d.vendedor_full_name || d.vendedor_username || "") + '</td>' +
        '<td>' + escapeHtml(d.client_full_name || d.client_username || "") + '</td>' +
        '<td>' + escapeHtml(d.delivered_to || "") + '</td>' +
        '<td class="num">' + fmtPrice(d.efectivo_amount || 0) + '</td>' +
        '<td class="num">' + fmtPrice(d.transferencia_amount || 0) + '</td>' +
        '<td class="num"><strong>' + fmtPrice(totalCobrado) + '</strong></td>' +
        '<td class="num muted">' + fmtPrice(d.order_total || 0) + '</td>' +
        '<td class="muted small-cell">' + formatDate(d.delivered_at) + '</td>' +
        '<td class="muted small">' + escapeHtml(d.notes || "—") + '</td>' +
      '</tr>';
    }).join("");
  }

  if (els.entSearch) els.entSearch.addEventListener("input", debounce(renderEntregas, 150));
  if (els.entVendFilter) els.entVendFilter.addEventListener("change", renderEntregas);

  // -------- Modal de entrega --------
  function openDeliveryModal(orderId, orderLabel, existingDelivery) {
    state.deliveryTargetOrderId = orderId;
    if (els.deliveryModalOrder) els.deliveryModalOrder.textContent = orderLabel;
    if (els.deliveryFormMsg) els.deliveryFormMsg.textContent = "";
    if (els.deliveryForm) {
      els.deliveryForm.reset();
      if (existingDelivery) {
        const f = els.deliveryForm;
        f.querySelector('[name="delivered_to"]').value = existingDelivery.delivered_to || "";
        f.querySelector('[name="efectivo_amount"]').value = existingDelivery.efectivo_amount || 0;
        f.querySelector('[name="transferencia_amount"]').value = existingDelivery.transferencia_amount || 0;
        f.querySelector('[name="notes"]').value = existingDelivery.notes || "";
        updateDeliveryTotalPreview();
      }
    }
    if (els.deliveryModal) els.deliveryModal.hidden = false;
    setTimeout(() => {
      if (els.deliveryForm) els.deliveryForm.querySelector('[name="delivered_to"]').focus();
    }, 50);
  }

  function updateDeliveryTotalPreview() {
    if (!els.deliveryForm || !els.deliveryTotalPreview) return;
    const ef = Math.max(0, Number(els.deliveryForm.querySelector('[name="efectivo_amount"]').value) || 0);
    const tr = Math.max(0, Number(els.deliveryForm.querySelector('[name="transferencia_amount"]').value) || 0);
    const total = ef + tr;
    els.deliveryTotalPreview.textContent = total > 0
      ? "Total a cobrar: " + fmtPrice(total) + (ef > 0 && tr > 0 ? " (" + fmtPrice(ef) + " efectivo + " + fmtPrice(tr) + " transferencia)" : "")
      : "";
  }

  if (els.deliveryForm) {
    els.deliveryForm.addEventListener("input", (e) => {
      if (e.target.name === "efectivo_amount" || e.target.name === "transferencia_amount") {
        updateDeliveryTotalPreview();
      }
    });

    els.deliveryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.deliveryTargetOrderId) return;
      const fd = new FormData(els.deliveryForm);
      const body = {
        delivered_to: fd.get("delivered_to"),
        efectivo_amount: Number(fd.get("efectivo_amount")) || 0,
        transferencia_amount: Number(fd.get("transferencia_amount")) || 0,
        notes: fd.get("notes"),
      };
      const btn = document.getElementById("delivery-submit-btn");
      if (btn) btn.disabled = true;
      els.deliveryFormMsg.textContent = "Guardando…";
      els.deliveryFormMsg.className = "config-msg";
      try {
        await api("/api/orders/" + state.deliveryTargetOrderId + "/deliver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        els.deliveryModal.hidden = true;
        showToast("Entrega registrada para pedido #" + state.deliveryTargetOrderId);
        // Recargar pedidos y entregas para reflejar el nuevo estado
        state.ordersLoaded = false;
        state.entregasLoaded = false;
        loadOrders();
      } catch (err) {
        els.deliveryFormMsg.textContent = "Error: " + err.message;
        els.deliveryFormMsg.className = "config-msg err";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  // Crear usuario (solo clientes 1-4 desde aca; los vendedores se crean
  // desde su pestaña dedicada y los admins desde CLI)
  els.userCreateBtn.addEventListener("click", () => {
    els.userCreateForm.reset();
    els.userCreateMsg.textContent = "";
    els.userCreateModal.hidden = false;
    setTimeout(() => els.userCreateForm.querySelector('[name="username"]').focus(), 50);
  });

  els.userCreateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(els.userCreateForm);
    const level = Number(fd.get("level"));
    if (![1, 2, 3, 4].includes(level)) {
      els.userCreateMsg.textContent = "Desde aca solo se pueden crear clientes (niveles 1-4).";
      els.userCreateMsg.className = "config-msg err";
      return;
    }
    const body = {
      username: fd.get("username"),
      password: fd.get("password"),
      full_name: fd.get("full_name"),
      level: level,
      phone: fd.get("phone"),
      whatsapp_number: fd.get("whatsapp_number") || null,
      email: fd.get("email"),
    };
    els.userCreateMsg.textContent = "Creando…";
    els.userCreateMsg.className = "config-msg";
    try {
      const out = await api("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      state.users.unshift(out.user);
      renderUsers();
      els.userCreateModal.hidden = true;
      showToast("Usuario " + out.user.username + " creado");
    } catch (err) {
      els.userCreateMsg.textContent = err.message;
      els.userCreateMsg.className = "config-msg err";
    }
  });

  els.userResetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.resetTargetId) return;
    const fd = new FormData(els.userResetForm);
    const password = fd.get("password");
    els.userResetMsg.textContent = "Guardando…";
    els.userResetMsg.className = "config-msg";
    try {
      await api("/api/admin/users/" + state.resetTargetId + "/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password }),
      });
      els.userResetModal.hidden = true;
      showToast("Contraseña actualizada");
    } catch (err) {
      els.userResetMsg.textContent = err.message;
      els.userResetMsg.className = "config-msg err";
    }
  });

  // Marcar todas / ninguna en el modal de categorías visibles del usuario
  if (els.userCatsAll) {
    els.userCatsAll.addEventListener("click", () => {
      els.userCatsList.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = true; });
    });
  }
  if (els.userCatsNone) {
    els.userCatsNone.addEventListener("click", () => {
      els.userCatsList.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = false; });
    });
  }

  // Guardar permisos de categorias
  if (els.userCatsSave) {
    els.userCatsSave.addEventListener("click", async () => {
      if (!state.catsTargetId) return;
      const checkboxes = els.userCatsList.querySelectorAll('input[data-cat-id]');
      if (!checkboxes.length) return;

      const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
      // Si todas marcadas = sin restriccion (null). Si algunas = lista de IDs.
      const category_ids = allChecked
        ? null
        : Array.from(checkboxes).filter((cb) => cb.checked).map((cb) => Number(cb.dataset.catId));

      els.userCatsSave.disabled = true;
      els.userCatsMsg.textContent = "Guardando…";
      els.userCatsMsg.className = "config-msg";
      try {
        await api("/api/admin/users/" + state.catsTargetId + "/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_ids: category_ids }),
        });
        els.userCatsMsg.textContent = "✓ Guardado";
        els.userCatsMsg.className = "config-msg ok";
        showToast("Permisos de categorías actualizados");
        setTimeout(() => { els.userCatsModal.hidden = true; }, 800);
      } catch (err) {
        els.userCatsMsg.textContent = "Error: " + err.message;
        els.userCatsMsg.className = "config-msg err";
      } finally {
        els.userCatsSave.disabled = false;
      }
    });
  }

  // ---------- Administradores (solo superadmin) ----------
  function renderSectionChecklist(container, checkedKeys) {
    const checked = new Set(checkedKeys || []);
    container.innerHTML = (state.adminSectionsCatalog || []).map((s) =>
      '<label class="cats-check" title="' + escapeHtml(s.label) + '">' +
        '<input type="checkbox" value="' + s.key + '"' + (checked.has(s.key) ? " checked" : "") + '>' +
        '<span class="cats-check-lbl">' + escapeHtml(s.label) + '</span>' +
      '</label>'
    ).join("");
  }
  function checklistValues(container) {
    return Array.from(container.querySelectorAll("input[type=checkbox]:checked")).map((c) => c.value);
  }
  function sectionLabels(keys) {
    const map = {};
    (state.adminSectionsCatalog || []).forEach((s) => { map[s.key] = s.label; });
    return (keys || []).map((k) => map[k] || k);
  }

  async function loadAdmins() {
    els.adminsTbody.innerHTML = '<tr><td colspan="5" class="muted">Cargando…</td></tr>';
    try {
      const data = await api("/api/admin/admins");
      state.adminSectionsCatalog = data.sections || [];
      renderAdmins(data.admins || []);
    } catch (err) {
      els.adminsTbody.innerHTML = '<tr><td colspan="5" class="muted err">Error: ' + escapeHtml(err.message) + '</td></tr>';
    }
  }

  function renderAdmins(admins) {
    state.admins = admins;
    if (!admins.length) {
      els.adminsTbody.innerHTML = '<tr><td colspan="5" class="muted">Sin administradores</td></tr>';
      return;
    }
    els.adminsTbody.innerHTML = admins.map((a) => {
      if (a.is_superadmin) {
        return '<tr data-id="' + a.id + '">' +
          '<td>' + escapeHtml(a.username) + ' <span class="vend-badge">Superadmin</span></td>' +
          '<td>' + escapeHtml(a.full_name || "—") + '</td>' +
          '<td class="muted">Acceso total</td>' +
          '<td>' + (a.active ? "Sí" : "No") + '</td>' +
          '<td class="muted small">—</td>' +
        '</tr>';
      }
      const secs = sectionLabels(a.sections);
      const secTxt = secs.length ? escapeHtml(secs.join(", ")) : '<span class="muted">ninguna</span>';
      return '<tr data-id="' + a.id + '">' +
        '<td>' + escapeHtml(a.username) + '</td>' +
        '<td>' + escapeHtml(a.full_name || "—") + '</td>' +
        '<td class="small">' + secTxt +
          ' <button class="btn btn-small" data-act="sections" data-id="' + a.id + '" type="button">Editar</button></td>' +
        '<td><label class="cell-toggle"><input type="checkbox" data-act="active" data-id="' + a.id + '"' +
          (a.active ? " checked" : "") + ' /><span></span></label></td>' +
        '<td><button class="btn btn-small" data-act="reset" data-id="' + a.id + '" data-username="' +
          escapeHtml(a.username) + '" type="button">🔑 Clave</button></td>' +
      '</tr>';
    }).join("");
  }

  if (els.adminsTbody) {
    els.adminsTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.act === "sections") openAdminSectionsModal(id);
      if (btn.dataset.act === "reset") openAdminResetModal(id, btn.dataset.username);
    });
    els.adminsTbody.addEventListener("change", async (e) => {
      const cb = e.target.closest('input[data-act="active"]');
      if (!cb) return;
      const id = Number(cb.dataset.id);
      try {
        await api("/api/admin/admins/" + id, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: cb.checked }),
        });
        showToast("Administrador actualizado");
      } catch (err) {
        cb.checked = !cb.checked;
        showToast("Error: " + err.message);
      }
    });
  }

  if (els.adminCreateBtn) {
    els.adminCreateBtn.addEventListener("click", () => {
      els.adminCreateForm.reset();
      els.adminCreateMsg.textContent = "";
      els.adminCreateMsg.className = "config-msg";
      renderSectionChecklist(els.adminCreateSections, []);
      els.adminCreateModal.hidden = false;
    });
  }
  if (els.adminCreateAll) {
    els.adminCreateAll.addEventListener("click", () => {
      els.adminCreateSections.querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = true; });
    });
  }
  if (els.adminCreateNone) {
    els.adminCreateNone.addEventListener("click", () => {
      els.adminCreateSections.querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = false; });
    });
  }
  if (els.adminCreateForm) {
    els.adminCreateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(els.adminCreateForm);
      const body = {
        username: String(fd.get("username") || "").trim(),
        full_name: String(fd.get("full_name") || "").trim(),
        password: String(fd.get("password") || ""),
        sections: checklistValues(els.adminCreateSections),
      };
      els.adminCreateMsg.textContent = "Creando…";
      els.adminCreateMsg.className = "config-msg";
      try {
        await api("/api/admin/admins", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        els.adminCreateModal.hidden = true;
        showToast("Administrador creado");
        loadAdmins();
      } catch (err) {
        els.adminCreateMsg.textContent = "Error: " + err.message;
        els.adminCreateMsg.className = "config-msg err";
      }
    });
  }

  function openAdminSectionsModal(id) {
    const a = (state.admins || []).find((x) => x.id === id);
    if (!a) return;
    state.adminsEditId = id;
    els.adminSectionsTarget.textContent = "Usuario: " + a.username;
    els.adminSectionsMsg.textContent = "";
    els.adminSectionsMsg.className = "config-msg";
    renderSectionChecklist(els.adminSectionsList, a.sections);
    els.adminSectionsModal.hidden = false;
  }
  if (els.adminSectionsAll) {
    els.adminSectionsAll.addEventListener("click", () => {
      els.adminSectionsList.querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = true; });
    });
  }
  if (els.adminSectionsNone) {
    els.adminSectionsNone.addEventListener("click", () => {
      els.adminSectionsList.querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = false; });
    });
  }
  if (els.adminSectionsSave) {
    els.adminSectionsSave.addEventListener("click", async () => {
      if (!state.adminsEditId) return;
      const sections = checklistValues(els.adminSectionsList);
      els.adminSectionsMsg.textContent = "Guardando…";
      els.adminSectionsMsg.className = "config-msg";
      try {
        await api("/api/admin/admins/" + state.adminsEditId, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sections: sections }),
        });
        els.adminSectionsModal.hidden = true;
        showToast("Permisos actualizados");
        loadAdmins();
      } catch (err) {
        els.adminSectionsMsg.textContent = "Error: " + err.message;
        els.adminSectionsMsg.className = "config-msg err";
      }
    });
  }

  function openAdminResetModal(id, username) {
    state.adminsResetId = id;
    els.adminResetTarget.textContent = "Usuario: " + (username || "");
    els.adminResetForm.reset();
    els.adminResetMsg.textContent = "";
    els.adminResetMsg.className = "config-msg";
    els.adminResetModal.hidden = false;
  }
  if (els.adminResetForm) {
    els.adminResetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pwd = String(new FormData(els.adminResetForm).get("password") || "");
      els.adminResetMsg.textContent = "Guardando…";
      els.adminResetMsg.className = "config-msg";
      try {
        await api("/api/admin/admins/" + state.adminsResetId + "/reset-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd }),
        });
        els.adminResetModal.hidden = true;
        showToast("Contraseña actualizada");
      } catch (err) {
        els.adminResetMsg.textContent = "Error: " + err.message;
        els.adminResetMsg.className = "config-msg err";
      }
    });
  }

  // Cerrar modales SOLO con [data-close] o Escape.
  // Antes se cerraba tambien con click en el overlay (e.target === m), pero eso
  // hace que un click accidental fuera de la caja descarte todo lo cargado en
  // los formularios (crear usuario, crear vendedor, crear compra, etc). Se quita.
  document.querySelectorAll(".admin-modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) {
        m.hidden = true;
        if (m.id === "supplier-create-modal") state.supplierCreatedFromPurchase = false;
        if (m.id === "purchase-create-modal") resetPurchaseModal();
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".admin-modal:not([hidden])").forEach((m) => { m.hidden = true; });
    state.supplierCreatedFromPurchase = false;
    resetPurchaseModal();
  });

  // ---------- Config ----------
  async function loadSettings() {
    try {
      const s = await api("/api/admin/settings");
      // Nombre de la app
      if (els.cfgAppName) els.cfgAppName.value = s.app_name || "";
      // WhatsApp
      els.cfgWhatsapp.value = s.whatsapp_number || "";
      updateWhatsappPreview(s.whatsapp_number);
      // Niveles que ven "Cambios de precio"
      const visible = new Set((s.price_changes_visible_levels || []).map(Number));
      els.cfgPcChecks.forEach((cb) => {
        cb.checked = visible.has(Number(cb.dataset.pcLevel));
      });
      state.settingsLoaded = true;
    } catch (e) {
      els.cfgWhatsappMsg.textContent = "Error cargando config";
      els.cfgWhatsappMsg.className = "config-msg err";
    }
    // Refrescar dbinfo cada vez que entran a Config (asi siempre se ve
    // el ultimo tamano y la lista de backups actualizada).
    checkDbInfo();
  }

  // Guardar nombre de la app
  if (els.cfgAppNameSave) {
    els.cfgAppNameSave.addEventListener("click", async () => {
      const name = (els.cfgAppName.value || "").trim();
      els.cfgAppNameSave.disabled = true;
      els.cfgAppNameMsg.textContent = "Guardando…";
      els.cfgAppNameMsg.className = "config-msg";
      try {
        const out = await api("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_name: name }),
        });
        els.cfgAppName.value = out.app_name || "";
        // Actualizar el nombre en el topbar en tiempo real
        const brandEl = document.getElementById("topbar-brand-name");
        if (brandEl) brandEl.textContent = out.app_name;
        document.getElementById("page-title").textContent = out.app_name + " · Admin";
        els.cfgAppNameMsg.textContent = "✓ Guardado";
        els.cfgAppNameMsg.className = "config-msg ok";
        showToast("Nombre de la app actualizado");
        setTimeout(() => { els.cfgAppNameMsg.textContent = ""; }, 2500);
      } catch (e) {
        els.cfgAppNameMsg.textContent = "Error: " + e.message;
        els.cfgAppNameMsg.className = "config-msg err";
      } finally {
        els.cfgAppNameSave.disabled = false;
      }
    });
  }

  // Guardar niveles que pueden ver "Cambios de precio"
  if (els.cfgPcSave) {
    els.cfgPcSave.addEventListener("click", async () => {
      const selected = Array.from(els.cfgPcChecks)
        .filter((cb) => cb.checked)
        .map((cb) => Number(cb.dataset.pcLevel));
      els.cfgPcSave.disabled = true;
      els.cfgPcMsg.textContent = "Guardando…";
      els.cfgPcMsg.className = "config-msg";
      try {
        const out = await api("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price_changes_visible_levels: selected }),
        });
        const visible = new Set((out.price_changes_visible_levels || []).map(Number));
        els.cfgPcChecks.forEach((cb) => {
          cb.checked = visible.has(Number(cb.dataset.pcLevel));
        });
        els.cfgPcMsg.textContent = "✓ Guardado";
        els.cfgPcMsg.className = "config-msg ok";
        showToast("Visibilidad de cambios de precio actualizada");
        setTimeout(() => { els.cfgPcMsg.textContent = ""; }, 2500);
      } catch (e) {
        els.cfgPcMsg.textContent = "Error: " + e.message;
        els.cfgPcMsg.className = "config-msg err";
      } finally {
        els.cfgPcSave.disabled = false;
      }
    });
  }

  // ---------- Export / Import de usuarios ----------
  if (els.usersExportBtn) {
    els.usersExportBtn.addEventListener("click", () => {
      // Forzamos navegacion para que el browser maneje el "Save as".
      // El endpoint manda Content-Disposition: attachment.
      const a = document.createElement("a");
      a.href = "/api/admin/users/export";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      els.usersIoMsg.textContent = "Descarga iniciada ✓";
      els.usersIoMsg.className = "config-msg ok";
      setTimeout(() => { els.usersIoMsg.textContent = ""; }, 3000);
    });
  }

  if (els.usersImportFile) {
    els.usersImportFile.addEventListener("change", async () => {
      const file = els.usersImportFile.files && els.usersImportFile.files[0];
      if (!file) return;
      els.usersIoMsg.textContent = "Leyendo archivo…";
      els.usersIoMsg.className = "config-msg";
      try {
        const text = await file.text();
        let body;
        try { body = JSON.parse(text); }
        catch (_) { throw new Error("El archivo no es un JSON válido"); }
        const list = Array.isArray(body) ? body : (body.users || []);
        if (!Array.isArray(list) || !list.length) {
          throw new Error("No encontré usuarios en el archivo");
        }
        const ok = confirm(
          "Vas a importar " + list.length + " usuario(s).\n" +
          "Los que ya existan se ACTUALIZAN (mismo username).\n" +
          "Los nuevos se crean. Ningún usuario se borra.\n\n¿Seguir?"
        );
        if (!ok) {
          els.usersIoMsg.textContent = "";
          els.usersImportFile.value = "";
          return;
        }
        els.usersIoMsg.textContent = "Importando…";
        const out = await api("/api/admin/users/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ users: list }),
        });
        const s = out.stats || {};
        els.usersIoMsg.textContent =
          "Importados: " + (s.inserted || 0) + " nuevos, " + (s.updated || 0) + " actualizados, " +
          (s.skipped || 0) + " omitidos.";
        els.usersIoMsg.className = "config-msg ok";
        showToast("Usuarios importados");
        // Refrescar la tabla de usuarios si ya estaba cargada
        if (state.usersLoaded) {
          state.usersLoaded = false;
          loadUsers();
        }
        checkDbInfo();
      } catch (err) {
        els.usersIoMsg.textContent = "Error: " + err.message;
        els.usersIoMsg.className = "config-msg err";
      } finally {
        els.usersImportFile.value = "";
      }
    });
  }

  function updateWhatsappPreview(num) {
    if (num) {
      els.cfgWhatsappCurrent.innerHTML =
        'Actual: <code>' + escapeHtml(num) + '</code> · ' +
        '<a href="https://wa.me/' + encodeURIComponent(num) + '" target="_blank" rel="noopener">probar wa.me/' + escapeHtml(num) + '</a>';
    } else {
      els.cfgWhatsappCurrent.innerHTML = '<span class="err">Sin número configurado: los pedidos no van a poder abrir WhatsApp.</span>';
    }
  }

  els.cfgWhatsappSave.addEventListener("click", async () => {
    const raw = els.cfgWhatsapp.value.trim().replace(/[^0-9]/g, "");
    if (raw && (raw.length < 8 || raw.length > 15)) {
      els.cfgWhatsappMsg.textContent = "Debe tener entre 8 y 15 dígitos";
      els.cfgWhatsappMsg.className = "config-msg err";
      return;
    }
    els.cfgWhatsappSave.disabled = true;
    els.cfgWhatsappMsg.textContent = "Guardando…";
    els.cfgWhatsappMsg.className = "config-msg";
    try {
      const out = await api("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: raw }),
      });
      els.cfgWhatsapp.value = out.whatsapp_number || "";
      updateWhatsappPreview(out.whatsapp_number);
      els.cfgWhatsappMsg.textContent = "✓ Guardado";
      els.cfgWhatsappMsg.className = "config-msg ok";
      showToast("Número de WhatsApp actualizado");
      setTimeout(() => { els.cfgWhatsappMsg.textContent = ""; }, 2500);
    } catch (e) {
      els.cfgWhatsappMsg.textContent = "Error: " + e.message;
      els.cfgWhatsappMsg.className = "config-msg err";
    } finally {
      els.cfgWhatsappSave.disabled = false;
    }
  });

  // ---------- Productos: filtros + orden + paginacion ----------
  function compareBy(field, dir) {
    const type = SORT_TYPES[field] || "text";
    const mult = dir === "desc" ? -1 : 1;
    return (a, b) => {
      const va = a[field];
      const vb = b[field];
      if (type === "number") {
        // null/undefined cuentan como 0 para que no rompan el orden numerico
        const na = (va === null || va === undefined || va === "") ? 0 : Number(va);
        const nb = (vb === null || vb === undefined || vb === "") ? 0 : Number(vb);
        if (na < nb) return -1 * mult;
        if (na > nb) return 1 * mult;
      } else {
        const sa = (va == null ? "" : String(va)).toLowerCase();
        const sb = (vb == null ? "" : String(vb)).toLowerCase();
        const cmp = sa.localeCompare(sb, "es", { numeric: true, sensitivity: "base" });
        if (cmp !== 0) return cmp * mult;
      }
      // Tie-breaker estable: por id, asi el orden no "salta" entre renders
      return (a.id || 0) - (b.id || 0);
    };
  }

  function populateCategoryFilter(products) {
    const current = els.filterCategory.value;
    // Recolectar categorías únicas ordenadas
    const seen = new Map();
    products.forEach((p) => {
      if (p.category_id != null && !seen.has(p.category_id)) {
        seen.set(p.category_id, p.category_name || ("Categoría " + p.category_id));
      }
    });
    const sorted = Array.from(seen.entries()).sort((a, b) =>
      (a[1] || "").localeCompare(b[1] || "", "es")
    );
    // Reconstruir opciones manteniendo la selección actual si sigue siendo válida
    els.filterCategory.innerHTML = '<option value="all">Todas</option>';
    sorted.forEach(([id, name]) => {
      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      els.filterCategory.appendChild(opt);
    });
    // Restaurar selección si sigue existiendo
    if (current !== "all" && els.filterCategory.querySelector('[value="' + current + '"]')) {
      els.filterCategory.value = current;
    }
  }

  function applyFilters() {
    const q = els.prodSearch.value.trim().toLowerCase();
    const stockMode = els.filterStock.value; // "all" | "in" | "out"
    const onlyInactive = els.filterInactive.checked;
    const categoryFilter = els.filterCategory.value; // "all" | "<id>"

    let list = state.products;
    if (q) {
      list = list.filter((p) =>
        (p.code || "").toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.category_name || "").toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") list = list.filter((p) => String(p.category_id) === categoryFilter);
    if (stockMode === "in") list = list.filter((p) => (p.stock || 0) > 0);
    else if (stockMode === "out") list = list.filter((p) => (p.stock || 0) <= 0);
    if (onlyInactive) list = list.filter((p) => !p.active);

    if (state.sortField && SORT_TYPES[state.sortField]) {
      // copiamos para no mutar el array original que vino del server
      list = list.slice().sort(compareBy(state.sortField, state.sortDir));
    }

    state.productsFiltered = list;
    state.page = 0;
    renderProducts();
    updateSortHeaders();
    savePrefs();
  }

  function updateSortHeaders() {
    els.prodHeaders.forEach((th) => {
      const f = th.dataset.sort;
      th.classList.remove("sort-asc", "sort-desc");
      if (f && f === state.sortField) {
        th.classList.add(state.sortDir === "desc" ? "sort-desc" : "sort-asc");
      }
    });
  }

  // Click en header -> ordenar. Mismo header -> invertir direccion.
  els.prodHeaders.forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (!field) return;
      if (state.sortField === field) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortField = field;
        state.sortDir = "asc";
      }
      applyFilters();
    });
  });

  function renderProducts() {
    const list = state.productsFiltered;
    els.prodCount.textContent = list.length + (list.length === 1 ? " producto" : " productos");
    if (!list.length) {
      els.prodTbody.innerHTML = '<tr><td colspan="13" class="muted">Sin resultados</td></tr>';
      els.pageInfo.textContent = "Página 0 / 0";
      els.pagePrev.disabled = true;
      els.pageNext.disabled = true;
      return;
    }
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page >= totalPages) state.page = totalPages - 1;
    const start = state.page * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);

    els.prodTbody.innerHTML = slice.map(rowHtml).join("");
    els.pageInfo.textContent = "Página " + (state.page + 1) + " / " + totalPages +
                               " · " + (start + 1) + "-" + (start + slice.length);
    els.pagePrev.disabled = state.page === 0;
    els.pageNext.disabled = state.page >= totalPages - 1;
  }

  function fmtNum(n) { return (n || 0).toLocaleString("es-AR"); }

  function rowHtml(p) {
    const imgSrc = p.image_url ? escapeHtml(p.image_url) : "";
    const imgThumb = imgSrc
      ? '<img src="' + imgSrc + '" alt="" class="prod-thumb" />'
      : '<span class="prod-thumb-empty" title="Sin imagen">📷</span>';
    const rowCls = !p.active ? "row-inactive" : (p.stock <= 0 ? "row-oos" : "");
    const stockMin = p.stock_min || 0;
    const stockLow = p.active && stockMin > 0 && p.stock > 0 && p.stock <= stockMin;
    const stockCls = p.stock <= 0 ? " text-danger" : (stockLow ? " text-warn" : "");
    const stockTitle = stockLow ? (' title="Stock bajo (mínimo: ' + stockMin + ')"') : "";
    return '<tr data-id="' + p.id + '" class="prod-row ' + rowCls + '" title="Doble click para editar">' +
      '<td class="col-img"><button class="prod-img-btn" type="button" data-act="edit-img" data-id="' + p.id + '" data-name="' + escapeHtml(p.name) + '" title="Cambiar imagen">' + imgThumb + '</button></td>' +
      '<td class="cell-code">' + escapeHtml(p.code || "") + '</td>' +
      '<td>' + escapeHtml(p.name) + '</td>' +
      '<td class="muted">' + escapeHtml(p.category_name || "—") + '</td>' +
      '<td class="num' + stockCls + '"' + stockTitle + '>' + fmtNum(p.stock) + (stockLow ? " ⚠" : "") + '</td>' +
      '<td class="num muted">' + fmtNum(p.cost) + '</td>' +
      '<td class="num">' + fmtNum(p.price_minorista) + '</td>' +
      '<td class="num">' + fmtNum(p.price_revendedor) + '</td>' +
      '<td class="num">' + fmtNum(p.price_mayorista) + '</td>' +
      '<td class="num">' + fmtNum(p.price_vip) + '</td>' +
      '<td class="num">' + fmtNum(p.price_publico) + '</td>' +
      '<td><span class="cell-active-badge' + (p.active ? " active" : "") + '">' + (p.active ? "Sí" : "No") + '</span></td>' +
      '<td><button class="btn btn-small" type="button" data-act="adj-stock" data-id="' + p.id + '" title="Ajustar stock">±</button></td>' +
    '</tr>';
  }

  // Doble click en fila → abrir modal de edición
  els.prodTbody.addEventListener("dblclick", (e) => {
    const btn = e.target.closest("button");
    if (btn) return; // no abrir si hicieron doble click en un botón
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const p = state.products.find((x) => x.id === Number(tr.dataset.id));
    if (p) openEditProdModal(p);
  });

  els.prodSearch.addEventListener("input", debounce(applyFilters, 200));
  els.filterCategory.addEventListener("change", applyFilters);
  els.filterStock.addEventListener("change", applyFilters);
  els.filterInactive.addEventListener("change", applyFilters);
  els.pagePrev.addEventListener("click", () => { if (state.page > 0) { state.page--; renderProducts(); window.scrollTo({ top: 0 }); } });
  els.pageNext.addEventListener("click", () => {
    const total = Math.ceil(state.productsFiltered.length / PAGE_SIZE);
    if (state.page < total - 1) { state.page++; renderProducts(); window.scrollTo({ top: 0 }); }
  });

  // ---------- Subir Excel ----------
  els.excelFile.addEventListener("change", async () => {
    const file = els.excelFile.files && els.excelFile.files[0];
    if (!file) return;
    showImportModal("Importando " + file.name + "…", "<p class=\"muted\">Subiendo y procesando, esto puede tardar unos segundos…</p>", false);

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/import-excel", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || ("Error " + res.status));
      const s = body.stats || {};
      const html =
        '<p>Filas leídas del Excel: <strong>' + body.filas + '</strong></p>' +
        '<ul class="import-stats">' +
          '<li>Productos actualizados: <strong>' + (s.actualizados || 0) + '</strong></li>' +
          '<li>Productos nuevos: <strong>' + (s.nuevos || 0) + '</strong></li>' +
          '<li>Marcados sin stock (no estaban en el Excel): <strong>' + (s.sinStock || 0) + '</strong></li>' +
          '<li>Visibles ahora en el catálogo: <strong>' + (s.visibles || 0) + '</strong></li>' +
        '</ul>' +
        '<p class="muted">Se preservaron usuarios y pedidos.</p>';
      showImportModal("Excel importado ✓", html, true);
      // Recargar productos para reflejar los cambios en la tabla
      try {
        state.products = await api("/api/admin/products");
        populateCategoryFilter(state.products);
        applyFilters();
      } catch (_) {}
    } catch (err) {
      showImportModal("No se pudo importar", '<p class="err">' + escapeHtml(err.message) + '</p>', true);
    } finally {
      els.excelFile.value = "";
    }
  });

  function showImportModal(title, bodyHtml, allowClose) {
    els.importTitle.textContent = title;
    els.importBody.innerHTML = bodyHtml;
    els.importClose.hidden = !allowClose;
    els.importModal.hidden = false;
  }
  els.importClose.addEventListener("click", () => { els.importModal.hidden = true; });

  // ---------- Pedidos ----------
  async function loadOrders() {
    try {
      els.ordersList.innerHTML = '<p class="muted">Cargando…</p>';
      // Para admin: cargar tambien la lista de vendedores (para el selector en el detalle)
      const promises = [api("/api/orders")];
      if (state.isAdmin && !state.vendedoresLoaded) {
        promises.push(api("/api/admin/vendedores").catch(() => []));
      }
      const [orders, vendedores] = await Promise.all(promises);
      state.orders = orders;
      state.ordersLoaded = true;
      if (vendedores) {
        state.vendedores = vendedores;
        state.vendedoresLoaded = true;
      }
      populateClientFilter(orders);
      renderOrders();
    } catch (e) {
      els.ordersList.innerHTML = '<p class="muted">Error cargando pedidos</p>';
    }
  }

  function populateClientFilter(orders) {
    const currentVal = els.ordersClientFilter.value;
    // Recopilar clientes únicos (clave: username, etiqueta: full_name o username)
    const seen = new Map();
    orders.forEach((o) => {
      const key = o.username || "";
      if (key && !seen.has(key)) {
        seen.set(key, o.full_name || o.username);
      }
    });
    // Reconstruir opciones
    els.ordersClientFilter.innerHTML = '<option value="all">Todos los clientes</option>';
    Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .forEach(([username, label]) => {
        const opt = document.createElement("option");
        opt.value = username;
        opt.textContent = label;
        els.ordersClientFilter.appendChild(opt);
      });
    // Restaurar selección si sigue siendo válida
    if (currentVal && els.ordersClientFilter.querySelector('[value="' + currentVal + '"]')) {
      els.ordersClientFilter.value = currentVal;
    }
  }

  function orderCardHtml(o) {
    var statusLabels = {
      pendiente: "Pendiente", preparando: "Preparando",
      enviado: "Enviado", entregado: "Entregado", cancelado: "Cancelado"
    };
    var statusLabel = statusLabels[o.status] || o.status || "";
    var clientLabel = escapeHtml(o.full_name || o.username || "—");
    var dateLabel = formatDate(o.created_at);
    var totalLabel = fmtPrice(o.total || 0);

    var vendBadge = "";
    if (o.assigned_vendedor_id) {
      var vendName = escapeHtml(o.vendedor_full_name || o.vendedor_username || "#" + o.assigned_vendedor_id);
      vendBadge = ' <span class="vend-badge">' + vendName + "</span>";
    }

    var delivBadge = "";
    if (o.delivery_id) {
      var cobrado = fmtPrice((o.efectivo_amount || 0) + (o.transferencia_amount || 0));
      delivBadge = ' <span class="delivery-badge">Cobrado: ' + cobrado + "</span>";
    }

    var delivBtn = "";
    if (o.status !== "cancelado") {
      var hasDelivery = o.delivery_id ? "1" : "0";
      var delivLabel = o.delivery_id ? "Ver entrega" : "Registrar entrega";
      delivBtn = '<button class="btn btn-small btn-deliver" data-id="' + o.id +
        '" data-has-delivery="' + hasDelivery + '" type="button">' + delivLabel + "</button>";
    }

    return '<article class="order-card" data-id="' + o.id + '">' +
      '<div class="order-head">' +
        '<div>' +
          '<h4>Pedido #' + o.id + ' · ' +
            '<span class="order-status ' + (o.status || "") + '">' + escapeHtml(statusLabel) + "</span>" +
            vendBadge + delivBadge +
          "</h4>" +
          '<span class="meta">' + clientLabel + " · " + dateLabel + "</span>" +
        "</div>" +
        '<div class="order-card-right">' +
          '<span class="order-total">' + totalLabel + "</span>" +
          delivBtn +
        "</div>" +
      "</div>" +
      '<div class="order-detail" hidden></div>' +
    "</article>";
  }

  async function toggleOrderDetail(card, orderId) {
    var detailEl = card.querySelector(".order-detail");
    if (!detailEl) return;
    if (!detailEl.hidden) {
      detailEl.hidden = true;
      return;
    }
    detailEl.hidden = false;
    if (detailEl.dataset.loaded) return;
    detailEl.innerHTML = '<p class="muted">Cargando…</p>';
    try {
      var order = await api("/api/orders/" + orderId);
      detailEl.dataset.loaded = "1";
      renderOrderDetail(detailEl, order);
      wireOrderDetail(detailEl, order);
    } catch (err) {
      detailEl.innerHTML = '<p class="muted err">Error: ' + escapeHtml(err.message) + "</p>";
    }
  }

  function renderOrderDetail(detailEl, order) {
    var items = order.items || [];
    var itemsHtml = items.length
      ? "<table><thead><tr>" +
          "<th>Código</th><th>Producto</th><th>Cant.</th>" +
          '<th class="num">P. Unit.</th><th class="num">Subtotal</th>' +
        "</tr></thead><tbody>" +
        items.map(function(it) {
          return "<tr>" +
            "<td><code>" + escapeHtml(it.product_code || "") + "</code></td>" +
            "<td>" + escapeHtml(it.product_name || "") + "</td>" +
            "<td>" + it.quantity + "</td>" +
            '<td class="num">' + fmtPrice(it.unit_price) + "</td>" +
            '<td class="num">' + fmtPrice(it.subtotal) + "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table>"
      : '<p class="muted">Sin items.</p>';

    var statuses = ["pendiente", "preparando", "enviado", "entregado", "cancelado"];
    var statusNames = { pendiente: "Pendiente", preparando: "Preparando", enviado: "Enviado", entregado: "Entregado", cancelado: "Cancelado" };
    var statusOpts = statuses.map(function(s) {
      return '<option value="' + s + '"' + (order.status === s ? " selected" : "") + ">" + statusNames[s] + "</option>";
    }).join("");
    var statusRow = '<div class="order-vend-row"><label>Estado</label>' +
      '<select class="order-status-select cell-select" data-order-id="' + order.id + '">' + statusOpts + "</select></div>";

    var vendRow = "";
    if (state.isAdmin) {
      var vendOpts = '<option value="">Sin asignar</option>' +
        (state.vendedores || []).map(function(v) {
          return '<option value="' + v.id + '"' + (order.assigned_vendedor_id === v.id ? " selected" : "") + ">" +
            escapeHtml(v.full_name || v.username) + "</option>";
        }).join("");
      vendRow = '<div class="order-vend-row"><label>Vendedor</label>' +
        '<select class="order-vend-select cell-select" data-order-id="' + order.id + '">' + vendOpts + "</select></div>";
    }

    var delivInfo = "";
    if (order.delivery_id) {
      delivInfo = '<div class="order-notes">' +
        "Recibido por: <strong>" + escapeHtml(order.delivered_to || "—") + "</strong> &nbsp;·&nbsp; " +
        "Efectivo: <strong>" + fmtPrice(order.efectivo_amount || 0) + "</strong> &nbsp;·&nbsp; " +
        "Transfer.: <strong>" + fmtPrice(order.transferencia_amount || 0) + "</strong>" +
      "</div>";
    }

    var notesHtml = order.notes
      ? '<p class="order-notes">' + escapeHtml(order.notes) + "</p>"
      : "";

    detailEl.innerHTML = statusRow + vendRow + itemsHtml + notesHtml + delivInfo;
  }

  function wireOrderDetail(detailEl, order) {
    var statusSel = detailEl.querySelector(".order-status-select");
    if (statusSel) {
      statusSel.addEventListener("change", async function() {
        var newStatus = statusSel.value;
        var orderId = Number(statusSel.dataset.orderId);
        // Al cancelar se devuelve el stock de los productos del pedido: avisar.
        if (newStatus === "cancelado") {
          if (!confirm("Al cancelar el pedido, los productos vuelven al stock.\n\n¿Confirmás la cancelación?")) {
            statusSel.value = order.status;
            return;
          }
        }
        try {
          await api("/api/orders/" + orderId, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          });
          var o = state.orders.find(function(x) { return x.id === orderId; });
          if (o) o.status = newStatus;
          var card = detailEl.closest(".order-card");
          if (card) {
            var badge = card.querySelector(".order-status");
            if (badge) {
              var labels = { pendiente: "Pendiente", preparando: "Preparando", enviado: "Enviado", entregado: "Entregado", cancelado: "Cancelado" };
              badge.textContent = labels[newStatus] || newStatus;
              badge.className = "order-status " + newStatus;
            }
          }
          showToast(newStatus === "cancelado" ? "Pedido cancelado · los productos volvieron al stock" : "Estado actualizado");
        } catch (err) {
          showToast("Error: " + err.message, "error");
          statusSel.value = order.status;
        }
      });
    }

    var vendSel = detailEl.querySelector(".order-vend-select");
    if (vendSel) {
      vendSel.addEventListener("change", async function() {
        var vendId = vendSel.value ? Number(vendSel.value) : null;
        var orderId = Number(vendSel.dataset.orderId);
        try {
          await api("/api/admin/orders/" + orderId + "/assign", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendedor_id: vendId }),
          });
          var o = state.orders.find(function(x) { return x.id === orderId; });
          if (o) o.assigned_vendedor_id = vendId;
          showToast("Vendedor asignado");
        } catch (err) {
          showToast("Error: " + err.message, "error");
        }
      });
    }
  }

  function renderOrders() {
    const q = els.ordersSearch.value.trim().toLowerCase();
    const clientFilter = els.ordersClientFilter.value; // "all" | username
    let list = state.orders;
    if (clientFilter !== "all") {
      list = list.filter((o) => (o.username || "") === clientFilter);
    }
    if (q) {
      list = list.filter((o) =>
        String(o.id).includes(q) ||
        (o.username || "").toLowerCase().includes(q) ||
        (o.full_name || "").toLowerCase().includes(q)
      );
    }
    els.ordersCount.textContent = list.length + (list.length === 1 ? " pedido" : " pedidos");
    if (!list.length) {
      els.ordersList.innerHTML = '<p class="muted">Sin pedidos.</p>';
      return;
    }
    els.ordersList.innerHTML = list.map(orderCardHtml).join("");
    els.ordersList.querySelectorAll(".order-card").forEach((card) => {
      // Click en header abre/cierra el detalle (pero no en los botones)
      const head = card.querySelector(".order-head");
      if (head) head.addEventListener("click", (e) => {
        if (e.target.closest(".btn-deliver")) return;
        toggleOrderDetail(card, Number(card.dataset.id));
      });

      // Boton de registrar entrega
      const deliverBtn = card.querySelector(".btn-deliver");
      if (deliverBtn) {
        deliverBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const orderId = Number(deliverBtn.dataset.id);
          const hasDelivery = deliverBtn.dataset.hasDelivery === "1";
          const orderObj = list.find((o) => o.id === orderId);
          let existingDelivery = null;
          if (hasDelivery && orderObj) {
            existingDelivery = {
              delivered_to: orderObj.delivered_to || "",
              efectivo_amount: orderObj.efectivo_amount || 0,
              transferencia_amount: orderObj.transferencia_amount || 0,
              notes: "",
            };
          }
          const totalLabel = orderObj ? fmtPrice(orderObj.total) : "";
          openDeliveryModal(orderId, "Pedido #" + orderId + (totalLabel ? " · " + totalLabel : ""), existingDelivery);
        });
      }
    });
  }

  els.ordersSearch.addEventListener("input", debounce(renderOrders, 150));
  els.ordersClientFilter.addEventListener("change", renderOrders);

  // ---------- Modal de imagen de producto ----------
  const imgState = { productId: null };

  function openImgModal(productId, productName, currentUrl) {
    imgState.productId = productId;
    els.imgModalTitle.textContent = "Imagen: " + productName;
    els.imgModalMsg.textContent = "";
    els.imgModalMsg.className = "config-msg";
    els.imgUrlInput.value = currentUrl || "";
    if (currentUrl) {
      els.imgModalPreview.src = currentUrl;
      els.imgModalPreview.hidden = false;
      els.imgModalNoImg.hidden = true;
    } else {
      els.imgModalPreview.src = "";
      els.imgModalPreview.hidden = true;
      els.imgModalNoImg.hidden = false;
    }
    els.imgUploadFile.value = "";
    els.imgModal.hidden = false;
  }

  function updateProductImageInState(productId, imageUrl) {
    const p = state.products.find((x) => x.id === productId);
    if (p) p.image_url = imageUrl;
    const tr = els.prodTbody.querySelector('tr[data-id="' + productId + '"]');
    if (tr) {
      const btn = tr.querySelector('.prod-img-btn[data-act="edit-img"]');
      if (btn) {
        if (imageUrl) {
          btn.innerHTML = '<img src="' + escapeHtml(imageUrl) + '" alt="" class="prod-thumb" />';
          btn.dataset.currentUrl = imageUrl;
        } else {
          btn.innerHTML = '<span class="prod-thumb-empty" title="Sin imagen">\u{1F4F7}</span>';
          btn.dataset.currentUrl = "";
        }
      }
    }
  }

  // Click en boton de imagen en la tabla -> abrir modal
  els.prodTbody.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-act="edit-img"]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const name = btn.dataset.name || "";
    const prod = state.products.find((x) => x.id === id);
    const currentUrl = prod ? (prod.image_url || "") : "";
    openImgModal(id, name, currentUrl);
  });

  // Subir archivo de imagen
  els.imgUploadFile.addEventListener("change", async () => {
    const file = els.imgUploadFile.files && els.imgUploadFile.files[0];
    if (!file || !imgState.productId) return;
    els.imgModalMsg.textContent = "Subiendo imagen…";
    els.imgModalMsg.className = "config-msg";
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await fetch("/api/admin/products/" + imgState.productId + "/image", {
        method: "POST",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Error " + res.status);
      els.imgModalPreview.src = body.image_url;
      els.imgModalPreview.hidden = false;
      els.imgModalNoImg.hidden = true;
      els.imgUrlInput.value = body.image_url;
      els.imgModalMsg.textContent = "\u2713 Imagen guardada";
      els.imgModalMsg.className = "config-msg ok";
      updateProductImageInState(imgState.productId, body.image_url);
      showToast("Imagen actualizada");
      setTimeout(() => { els.imgModalMsg.textContent = ""; }, 2500);
    } catch (err) {
      els.imgModalMsg.textContent = "Error: " + err.message;
      els.imgModalMsg.className = "config-msg err";
    } finally {
      els.imgUploadFile.value = "";
    }
  });

  // Guardar URL de imagen
  els.imgUrlSave.addEventListener("click", async () => {
    if (!imgState.productId) return;
    const url = els.imgUrlInput.value.trim();
    els.imgUrlSave.disabled = true;
    els.imgModalMsg.textContent = "Guardando URL…";
    els.imgModalMsg.className = "config-msg";
    try {
      await api("/api/admin/products/" + imgState.productId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url }),
      });
      if (url) {
        els.imgModalPreview.src = url;
        els.imgModalPreview.hidden = false;
        els.imgModalNoImg.hidden = true;
      } else {
        els.imgModalPreview.src = "";
        els.imgModalPreview.hidden = true;
        els.imgModalNoImg.hidden = false;
      }
      els.imgModalMsg.textContent = "\u2713 URL guardada";
      els.imgModalMsg.className = "config-msg ok";
      updateProductImageInState(imgState.productId, url || null);
      showToast("Imagen actualizada");
      setTimeout(() => { els.imgModalMsg.textContent = ""; }, 2500);
    } catch (err) {
      els.imgModalMsg.textContent = "Error: " + err.message;
      els.imgModalMsg.className = "config-msg err";
    } finally {
      els.imgUrlSave.disabled = false;
    }
  });

  // ---------- logout ----------
  els.logoutBtn.addEventListener("click", async () => {
    try { await fetch("/logout", { method: "POST" }); }
    finally { location.href = "/login"; }
  });

  // ========== PROVEEDORES ==========

  async function loadSuppliers() {
    try {
      if (els.supTbody) els.supTbody.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
      state.suppliers = await api("/api/admin/suppliers");
      state.suppliersLoaded = true;
      renderSuppliers();
    } catch (e) {
      if (els.supTbody) els.supTbody.innerHTML = '<tr><td colspan="6" class="muted">Error cargando proveedores</td></tr>';
    }
  }

  function renderSuppliers() {
    if (!els.supTbody) return;
    const q = (els.supSearch ? els.supSearch.value : "").trim().toLowerCase();
    let list = state.suppliers;
    if (q) {
      list = list.filter((s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.contact || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q)
      );
    }
    if (els.supCount) els.supCount.textContent = list.length + (list.length === 1 ? " proveedor" : " proveedores");
    if (!list.length) {
      els.supTbody.innerHTML = '<tr><td colspan="6" class="muted">Sin resultados</td></tr>';
      return;
    }
    els.supTbody.innerHTML = list.map(supplierRowHtml).join("");
  }

  function supplierRowHtml(s) {
    return '<tr data-id="' + s.id + '"' + (s.active ? '' : ' class="row-inactive"') + '>' +
      '<td><input class="cell-input" data-field="name" value="' + escapeHtml(s.name || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="contact" value="' + escapeHtml(s.contact || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="phone" value="' + escapeHtml(s.phone || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="email" type="email" value="' + escapeHtml(s.email || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="notes" value="' + escapeHtml(s.notes || "") + '" /></td>' +
      '<td><label class="cell-toggle"><input type="checkbox" data-field="active"' + (s.active ? " checked" : "") + ' /><span></span></label></td>' +
    '</tr>';
  }

  if (els.supTbody) {
    els.supTbody.addEventListener("change", async (e) => {
      const inp = e.target.closest("[data-field]");
      if (!inp) return;
      const tr = inp.closest("tr");
      if (!tr) return;
      const id = Number(tr.dataset.id);
      const field = inp.dataset.field;
      const value = inp.type === "checkbox" ? (inp.checked ? 1 : 0) : inp.value;
      inp.classList.add("saving");
      try {
        const out = await api("/api/admin/suppliers/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        const idx = state.suppliers.findIndex((x) => x.id === id);
        if (idx >= 0) state.suppliers[idx] = out.supplier;
        inp.classList.remove("saving");
        inp.classList.add("saved");
        setTimeout(() => inp.classList.remove("saved"), 1200);
        if (field === "active") tr.classList.toggle("row-inactive", !out.supplier.active);
      } catch (err) {
        inp.classList.remove("saving");
        inp.classList.add("error");
        showToast("Error: " + err.message, "err");
        setTimeout(() => inp.classList.remove("error"), 2000);
        const orig = state.suppliers.find((x) => x.id === id);
        if (orig) {
          if (inp.type === "checkbox") inp.checked = !!orig.active;
          else inp.value = orig[field] || "";
        }
      }
    });
  }

  if (els.supSearch) els.supSearch.addEventListener("input", debounce(renderSuppliers, 150));

  if (els.supCreateBtn) {
    els.supCreateBtn.addEventListener("click", () => {
      if (els.supplierCreateForm) els.supplierCreateForm.reset();
      if (els.supplierCreateMsg) els.supplierCreateMsg.textContent = "";
      if (els.supplierCreateModal) els.supplierCreateModal.hidden = false;
      setTimeout(() => {
        if (els.supplierCreateForm) els.supplierCreateForm.querySelector('[name="name"]').focus();
      }, 50);
    });
  }

  if (els.purAddSupBtn) {
    els.purAddSupBtn.addEventListener("click", () => {
      state.supplierCreatedFromPurchase = true;
      if (els.supplierCreateForm) els.supplierCreateForm.reset();
      if (els.supplierCreateMsg) els.supplierCreateMsg.textContent = "";
      if (els.supplierCreateModal) els.supplierCreateModal.hidden = false;
      setTimeout(() => {
        if (els.supplierCreateForm) els.supplierCreateForm.querySelector('[name="name"]').focus();
      }, 50);
    });
  }

  if (els.supplierCreateForm) {
    els.supplierCreateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(els.supplierCreateForm);
      const body = {
        name: fd.get("name"),
        contact: fd.get("contact"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        notes: fd.get("notes"),
      };
      if (els.supplierCreateMsg) { els.supplierCreateMsg.textContent = "Creando…"; els.supplierCreateMsg.className = "config-msg"; }
      try {
        const out = await api("/api/admin/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        state.suppliers.push(out.supplier);
        state.suppliers.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
        renderSuppliers();
        if (els.supplierCreateModal) els.supplierCreateModal.hidden = true;
        showToast("Proveedor " + escapeHtml(out.supplier.name) + " creado");
        // Actualizar selector en modal de compras
        populatePurchaseSupplierSelect();
        // Si se creó desde el modal de compra, auto-seleccionarlo
        if (state.supplierCreatedFromPurchase) {
          state.supplierCreatedFromPurchase = false;
          if (els.purFormSupplier) els.purFormSupplier.value = String(out.supplier.id);
        }
      } catch (err) {
        if (els.supplierCreateMsg) { els.supplierCreateMsg.textContent = err.message; els.supplierCreateMsg.className = "config-msg err"; }
      }
    });
  }

  // ========== COMPRAS ==========

  async function loadPurchases() {
    try {
      if (els.purTbody) els.purTbody.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
      state.purchases = await api("/api/admin/purchases");
      state.purchasesLoaded = true;
      // Cargar proveedores si no estaban
      if (!state.suppliersLoaded) {
        try { state.suppliers = await api("/api/admin/suppliers"); state.suppliersLoaded = true; } catch (_) {}
      }
      populatePurchaseSupplierSelect();
      populatePurSupFilter();
      populatePurMonthFilter();
      renderPurchases();
    } catch (e) {
      if (els.purTbody) els.purTbody.innerHTML = '<tr><td colspan="6" class="muted">Error cargando compras</td></tr>';
    }
  }

  function populatePurSupFilter() {
    if (!els.purSupFilter) return;
    const current = els.purSupFilter.value;
    const seen = new Map();
    state.purchases.forEach((p) => {
      if (p.supplier_id && !seen.has(p.supplier_id)) {
        seen.set(p.supplier_id, p.supplier_name || ("Proveedor #" + p.supplier_id));
      }
    });
    els.purSupFilter.innerHTML = '<option value="all">Todos los proveedores</option>';
    Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1], "es")).forEach(([id, name]) => {
      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      els.purSupFilter.appendChild(opt);
    });
    if (current && els.purSupFilter.querySelector('[value="' + current + '"]')) {
      els.purSupFilter.value = current;
    }
  }

  function populatePurMonthFilter() {
    if (!els.purMonthFilter) return;
    const current = els.purMonthFilter.value;
    const months = new Map();
    state.purchases.forEach((p) => {
      const d = p.received_at ? p.received_at.slice(0, 7) : null; // "2026-05"
      if (d && !months.has(d)) {
        const [y, m] = d.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString("es-AR", { month: "long", year: "numeric" });
        months.set(d, label.charAt(0).toUpperCase() + label.slice(1));
      }
    });
    els.purMonthFilter.innerHTML = '<option value="all">Todos los meses</option>';
    Array.from(months.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([val, label]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        els.purMonthFilter.appendChild(opt);
      });
    if (current && els.purMonthFilter.querySelector('[value="' + current + '"]')) {
      els.purMonthFilter.value = current;
    }
  }

  function populatePurchaseSupplierSelect() {
    if (!els.purFormSupplier) return;
    const current = els.purFormSupplier.value;
    els.purFormSupplier.innerHTML = '<option value="">Sin proveedor</option>';
    state.suppliers.filter((s) => s.active).forEach((s) => {
      const opt = document.createElement("option");
      opt.value = String(s.id);
      opt.textContent = s.name;
      els.purFormSupplier.appendChild(opt);
    });
    if (current && els.purFormSupplier.querySelector('[value="' + current + '"]')) {
      els.purFormSupplier.value = current;
    }
  }

  function renderPurchases() {
    if (!els.purTbody) return;
    const supFilter   = els.purSupFilter   ? els.purSupFilter.value   : "all";
    const monthFilter = els.purMonthFilter ? els.purMonthFilter.value : "all";
    let list = state.purchases;
    if (supFilter !== "all")   list = list.filter((p) => String(p.supplier_id) === supFilter);
    if (monthFilter !== "all") list = list.filter((p) => p.received_at && p.received_at.slice(0, 7) === monthFilter);
    if (els.purCount) els.purCount.textContent = list.length + (list.length === 1 ? " compra" : " compras");
    if (!list.length) {
      els.purTbody.innerHTML = '<tr><td colspan="6" class="muted">Sin compras registradas.</td></tr>';
      return;
    }
    els.purTbody.innerHTML = list.map(purchaseRowHtml).join("");
    // Wiring de click para expandir detalle
    els.purTbody.querySelectorAll("tr.pur-row").forEach((tr) => {
      tr.addEventListener("click", () => togglePurchaseDetail(tr));
    });
  }

  function purchaseRowHtml(p) {
    return '<tr class="pur-row" data-id="' + p.id + '" style="cursor:pointer">' +
      '<td class="cell-code">#' + p.id + '</td>' +
      '<td>' + escapeHtml(p.supplier_name || "—") + '</td>' +
      '<td>' + escapeHtml(p.reference || "—") + '</td>' +
      '<td class="muted small-cell">' + formatDate(p.received_at) + '</td>' +
      '<td class="num">' + (p.items_count || 0) + '</td>' +
      '<td class="num"><strong>' + fmtPrice(p.total_cost) + '</strong></td>' +
    '</tr>' +
    '<tr class="pur-detail-row" data-for="' + p.id + '" hidden>' +
      '<td colspan="6" class="pur-detail-cell"><span class="muted">Cargando…</span></td>' +
    '</tr>';
  }

  async function togglePurchaseDetail(tr) {
    const id = Number(tr.dataset.id);
    const detailRow = els.purTbody.querySelector('tr.pur-detail-row[data-for="' + id + '"]');
    if (!detailRow) return;
    if (!detailRow.hidden) { detailRow.hidden = true; return; }
    detailRow.hidden = false;
    if (detailRow.dataset.loaded) return;
    const cell = detailRow.querySelector(".pur-detail-cell");
    try {
      const data = await api("/api/admin/purchases/" + id);
      detailRow.dataset.loaded = "1";
      const items = data.items || [];
      const notesHtml = data.notes ? '<p class="muted small">' + escapeHtml(data.notes) + '</p>' : '';
      const tableHtml = items.length
        ? '<table class="pur-detail-table"><thead><tr><th>Código</th><th>Producto</th><th class="num">Cant.</th><th class="num">Costo unit.</th><th class="num">Subtotal</th></tr></thead><tbody>' +
          items.map((it) =>
            '<tr><td><code>' + escapeHtml(it.product_code || "") + '</code></td>' +
            '<td>' + escapeHtml(it.product_name || "") + '</td>' +
            '<td class="num">' + it.quantity + '</td>' +
            '<td class="num">' + fmtPrice(it.unit_cost) + '</td>' +
            '<td class="num">' + fmtPrice(it.subtotal) + '</td></tr>'
          ).join("") +
          '</tbody></table>'
        : '<p class="muted">Sin items.</p>';
      const editBtn = '<div class="pur-detail-actions"><button type="button" class="btn btn-small pur-edit-btn" data-id="' + id + '">Editar compra</button></div>';
      cell.innerHTML = notesHtml + tableHtml + editBtn;
      cell.querySelector(".pur-edit-btn").addEventListener("click", () => openPurchaseEdit(id));
    } catch (err) {
      cell.innerHTML = '<span class="muted err">Error: ' + escapeHtml(err.message) + '</span>';
    }
  }

  async function openPurchaseEdit(id) {
    try {
      const data = await api("/api/admin/purchases/" + id);
      state.editingPurchaseId = id;
      state.purchaseItems = (data.items || []).map((it) => ({
        product_id:   it.product_id,
        product_code: it.product_code || "",
        product_name: it.product_name || "",
        quantity:     it.quantity,
        unit_cost:    it.unit_cost,
        subtotal:     it.subtotal,
      }));
      if (els.purchaseCreateForm) els.purchaseCreateForm.reset();
      if (els.purchaseCreateMsg) els.purchaseCreateMsg.textContent = "";
      // Prellenar campos del header
      if (els.purchaseCreateForm) {
        const form = els.purchaseCreateForm;
        if (!state.suppliersLoaded) {
          try { state.suppliers = await api("/api/admin/suppliers"); state.suppliersLoaded = true; } catch (_) {}
        }
        populatePurchaseSupplierSelect();
        const supSel = form.querySelector('[name="supplier_id"]');
        if (supSel && data.supplier_id) supSel.value = String(data.supplier_id);
        const refInput = form.querySelector('[name="reference"]');
        if (refInput) refInput.value = data.reference || "";
        const notesInput = form.querySelector('[name="notes"]');
        if (notesInput) notesInput.value = data.notes || "";
        const dtInput = form.querySelector('[name="received_at"]');
        if (dtInput && data.received_at) dtInput.value = data.received_at.slice(0, 16).replace(" ", "T");
      }
      renderPurchaseItems();
      await ensureAllProducts();
      if (els.purchaseModalTitle) els.purchaseModalTitle.textContent = "Editar compra #" + id;
      if (els.purSubmitBtn) els.purSubmitBtn.textContent = "Guardar cambios";
      if (els.purchaseCreateModal) els.purchaseCreateModal.hidden = false;
      setTimeout(() => { if (els.purProdSearch) els.purProdSearch.focus(); }, 80);
    } catch (err) {
      showToast("Error cargando compra: " + err.message, "err");
    }
  }

  if (els.purSupFilter)   els.purSupFilter.addEventListener("change", renderPurchases);
  if (els.purMonthFilter) els.purMonthFilter.addEventListener("change", renderPurchases);

  // ---- Modal de nueva compra ----

  // Cache de todos los productos para el buscador de compras
  async function ensureAllProducts() {
    if (state.allProductsLoaded) return;
    try {
      state.allProducts = await api("/api/admin/products");
      state.allProductsLoaded = true;
    } catch (_) {}
  }

  function recalcPurchaseTotal() {
    const total = state.purchaseItems.reduce((s, it) => s + it.subtotal, 0);
    if (els.purItemsTotal) els.purItemsTotal.innerHTML = '<strong>' + fmtPrice(total) + '</strong>';
  }

  function renderPurchaseItems() {
    if (!els.purItemsTbody) return;
    if (!state.purchaseItems.length) {
      els.purItemsTbody.innerHTML = '<tr id="pur-items-empty"><td colspan="6" class="muted">Agregá productos con el botón "+ Agregar productos".</td></tr>';
      recalcPurchaseTotal();
      return;
    }
    els.purItemsTbody.innerHTML = state.purchaseItems.map((it, idx) =>
      '<tr data-idx="' + idx + '">' +
      '<td><code>' + escapeHtml(it.product_code || "") + '</code></td>' +
      '<td>' + escapeHtml(it.product_name || "") + '</td>' +
      '<td class="num"><input type="number" class="cell-input cell-num pur-qty" min="1" step="1" value="' + it.quantity + '" data-idx="' + idx + '" style="width:70px" /></td>' +
      '<td class="num"><input type="number" class="cell-input cell-num pur-cost" min="0" step="1" value="' + it.unit_cost + '" data-idx="' + idx + '" style="width:90px" /></td>' +
      '<td class="num pur-subtotal">' + fmtPrice(it.subtotal) + '</td>' +
      '<td><button type="button" class="btn btn-small pur-remove" data-idx="' + idx + '">✕</button></td>' +
    '</tr>'
    ).join("");
    recalcPurchaseTotal();
  }

  function addPurchaseItem(product, qty) {
    const addQty = Math.max(1, Math.floor(Number(qty) || 1));
    const existing = state.purchaseItems.find((it) => it.product_id === product.id);
    if (existing) {
      existing.quantity += addQty;
      existing.subtotal = existing.quantity * existing.unit_cost;
    } else {
      state.purchaseItems.push({
        product_id: product.id,
        product_code: product.code || "",
        product_name: product.name || "",
        quantity: addQty,
        unit_cost: product.cost || 0,
        subtotal: (product.cost || 0) * addQty,
      });
    }
    renderPurchaseItems();
  }

  if (els.purItemsTbody) {
    els.purItemsTbody.addEventListener("input", (e) => {
      const idx = e.target.dataset.idx != null ? Number(e.target.dataset.idx) : -1;
      if (idx < 0 || !state.purchaseItems[idx]) return;
      const it = state.purchaseItems[idx];
      if (e.target.classList.contains("pur-qty")) {
        it.quantity = Math.max(1, Math.floor(Number(e.target.value) || 1));
        it.subtotal = it.quantity * it.unit_cost;
      } else if (e.target.classList.contains("pur-cost")) {
        it.unit_cost = Math.max(0, Number(e.target.value) || 0);
        it.subtotal = it.quantity * it.unit_cost;
      }
      const tr = e.target.closest("tr");
      if (tr) {
        const subtotalCell = tr.querySelector(".pur-subtotal");
        if (subtotalCell) subtotalCell.textContent = fmtPrice(it.subtotal);
      }
      recalcPurchaseTotal();
    });

    els.purItemsTbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".pur-remove");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      state.purchaseItems.splice(idx, 1);
      renderPurchaseItems();
    });
  }

  // ---- Picker de selección múltiple de productos (compra) ----
  // Inspirado en el picker de /ventas: checkbox + cantidad por fila, "agregar
  // seleccionados" al confirmar. Usa el cache state.allProducts.
  function renderPurPicker(filter) {
    if (!els.purPickerTbody) return;
    let list = state.allProducts || [];
    if (filter) {
      const q = filter.trim().toLowerCase();
      list = list.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q));
    }
    if (!list.length) {
      els.purPickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:16px;text-align:center">Sin resultados</td></tr>';
      return;
    }
    els.purPickerTbody.innerHTML = list.map((p) => {
      const sel = state.purPickerSelected.has(p.id);
      const qty = sel ? state.purPickerSelected.get(p.id) : "";
      return '<tr data-pid="' + p.id + '">' +
        '<td><input type="checkbox" class="pur-pick-cb" data-pid="' + p.id + '"' + (sel ? " checked" : "") + ' /></td>' +
        '<td><div>' + escapeHtml(p.name || "") + '</div><code class="muted">' + escapeHtml(p.code || "") + '</code></td>' +
        '<td class="num"><input type="number" class="cell-input cell-num pur-pick-qty" data-pid="' + p.id + '" min="1" step="1" value="' + qty + '" placeholder="1" style="width:64px" /></td>' +
        '<td class="num">' + fmtPrice(p.cost || 0) + '</td>' +
        '<td class="num" style="color:' + ((p.stock || 0) > 0 ? "#059669" : "#9ca3af") + '">' + (p.stock || 0) + '</td>' +
      '</tr>';
    }).join("");
  }

  function updatePurPickerCount() {
    if (els.purPickerCount) {
      const n = state.purPickerSelected.size;
      els.purPickerCount.textContent = n + (n === 1 ? " seleccionado" : " seleccionados");
    }
    if (els.purPickerConfirm) els.purPickerConfirm.disabled = state.purPickerSelected.size === 0;
  }

  async function openPurPicker() {
    await ensureAllProducts();
    state.purPickerSelected.clear();
    if (els.purPickerSearch) els.purPickerSearch.value = "";
    if (els.purPickerAll) els.purPickerAll.checked = false;
    renderPurPicker("");
    updatePurPickerCount();
    if (els.purPickerModal) els.purPickerModal.hidden = false;
    setTimeout(() => { if (els.purPickerSearch) els.purPickerSearch.focus(); }, 60);
  }

  function closePurPicker() { if (els.purPickerModal) els.purPickerModal.hidden = true; }

  if (els.purAddProductsBtn) els.purAddProductsBtn.addEventListener("click", openPurPicker);
  if (els.purPickerCancel)   els.purPickerCancel.addEventListener("click", closePurPicker);

  if (els.purPickerSearch) {
    els.purPickerSearch.addEventListener("input", debounce(() => renderPurPicker(els.purPickerSearch.value), 180));
  }

  if (els.purPickerModal) {
    // Checkbox de fila / "seleccionar todos"
    els.purPickerModal.addEventListener("change", (e) => {
      if (e.target.classList.contains("pur-pick-cb")) {
        const pid = Number(e.target.dataset.pid);
        const tr = e.target.closest("tr[data-pid]");
        const qInp = tr ? tr.querySelector(".pur-pick-qty") : null;
        if (e.target.checked) {
          const q = qInp ? Math.max(1, Math.floor(Number(qInp.value) || 0)) : 1;
          state.purPickerSelected.set(pid, q || 1);
          if (qInp && !qInp.value) qInp.value = "1";
        } else {
          state.purPickerSelected.delete(pid);
          if (qInp) qInp.value = "";
        }
        updatePurPickerCount();
      } else if (e.target.id === "pur-picker-all") {
        const all = e.target.checked;
        els.purPickerTbody.querySelectorAll(".pur-pick-cb").forEach((cb) => {
          cb.checked = all;
          const pid = Number(cb.dataset.pid);
          const tr = cb.closest("tr[data-pid]");
          const qInp = tr ? tr.querySelector(".pur-pick-qty") : null;
          if (all) {
            const q = qInp ? Math.max(1, Math.floor(Number(qInp.value) || 0)) : 1;
            state.purPickerSelected.set(pid, q || 1);
            if (qInp && !qInp.value) qInp.value = "1";
          } else {
            state.purPickerSelected.delete(pid);
            if (qInp) qInp.value = "";
          }
        });
        updatePurPickerCount();
      }
    });

    // Tipear cantidad marca el checkbox y guarda la cantidad.
    els.purPickerModal.addEventListener("input", (e) => {
      if (!e.target.classList.contains("pur-pick-qty")) return;
      const pid = Number(e.target.dataset.pid);
      const raw = e.target.value;
      if (raw === "") return;
      const q = Math.max(1, Math.floor(Number(raw) || 0));
      state.purPickerSelected.set(pid, q);
      const tr = e.target.closest("tr[data-pid]");
      const cb = tr ? tr.querySelector(".pur-pick-cb") : null;
      if (cb && !cb.checked) cb.checked = true;
      updatePurPickerCount();
    });
  }

  if (els.purPickerConfirm) {
    els.purPickerConfirm.addEventListener("click", () => {
      state.purPickerSelected.forEach((qty, pid) => {
        const prod = (state.allProducts || []).find((p) => p.id === pid);
        if (prod) addPurchaseItem(prod, qty);
      });
      state.purPickerSelected.clear();
      closePurPicker();
    });
  }

  if (els.purCreateBtn) {
    els.purCreateBtn.addEventListener("click", async () => {
      state.purchaseItems = [];
      if (els.purchaseCreateForm) els.purchaseCreateForm.reset();
      if (els.purchaseCreateMsg) els.purchaseCreateMsg.textContent = "";
      renderPurchaseItems();
      // Fecha default = ahora
      if (els.purchaseCreateForm) {
        const dtInput = els.purchaseCreateForm.querySelector('[name="received_at"]');
        if (dtInput) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          dtInput.value = now.toISOString().slice(0, 16);
        }
      }
      // Cargar proveedores si no están
      if (!state.suppliersLoaded) {
        try { state.suppliers = await api("/api/admin/suppliers"); state.suppliersLoaded = true; } catch (_) {}
      }
      populatePurchaseSupplierSelect();
      await ensureAllProducts();
      if (els.purchaseCreateModal) els.purchaseCreateModal.hidden = false;
      setTimeout(() => { if (els.purProdSearch) els.purProdSearch.focus(); }, 80);
    });
  }

  function resetPurchaseModal() {
    state.editingPurchaseId = null;
    if (els.purchaseModalTitle) els.purchaseModalTitle.textContent = "Nueva compra";
    if (els.purSubmitBtn) els.purSubmitBtn.textContent = "Guardar compra";
  }

  if (els.purchaseCreateForm) {
    els.purchaseCreateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.purchaseItems.length) {
        if (els.purchaseCreateMsg) { els.purchaseCreateMsg.textContent = "Agregá al menos 1 producto."; els.purchaseCreateMsg.className = "config-msg err"; }
        return;
      }
      const fd = new FormData(els.purchaseCreateForm);
      const received_at_raw = fd.get("received_at");
      const body = {
        supplier_id: fd.get("supplier_id") ? Number(fd.get("supplier_id")) : null,
        reference: fd.get("reference"),
        notes: fd.get("notes"),
        received_at: received_at_raw ? received_at_raw.replace("T", " ") : null,
        cost_policy: fd.get("cost_policy") || "higher",
        items: state.purchaseItems.map((it) => ({
          product_id: it.product_id,
          product_code: it.product_code,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
        })),
      };
      const isEditing = !!state.editingPurchaseId;
      const url = isEditing ? "/api/admin/purchases/" + state.editingPurchaseId : "/api/admin/purchases";
      const method = isEditing ? "PUT" : "POST";
      if (els.purSubmitBtn) els.purSubmitBtn.disabled = true;
      if (els.purchaseCreateMsg) { els.purchaseCreateMsg.textContent = "Guardando…"; els.purchaseCreateMsg.className = "config-msg"; }
      try {
        await api(url, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        state.purchasesLoaded = false;
        await loadPurchases();
        if (els.purchaseCreateModal) els.purchaseCreateModal.hidden = true;
        showToast(isEditing ? "Compra actualizada" : "Compra registrada");
        resetPurchaseModal();
        // Refrescar productos por cambio de stock
        try { state.products = await api("/api/admin/products"); state.allProductsLoaded = false; } catch (_) {}
      } catch (err) {
        if (els.purchaseCreateMsg) { els.purchaseCreateMsg.textContent = err.message; els.purchaseCreateMsg.className = "config-msg err"; }
      } finally {
        if (els.purSubmitBtn) els.purSubmitBtn.disabled = false;
      }
    });
  }

  // ========== PAGOS ==========

  async function loadPayments() {
    try {
      if (els.payTbody) els.payTbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
      state.payments = await api("/api/admin/payments");
      state.paymentsLoaded = true;
      renderPayments();
    } catch (e) {
      if (els.payTbody) els.payTbody.innerHTML = '<tr><td colspan="8" class="muted">Error cargando pagos</td></tr>';
    }
  }

  function renderPayments() {
    if (!els.payTbody) return;
    const q = (els.paySearch ? els.paySearch.value : "").trim().toLowerCase();
    const methodFilter = els.payMethodFilter ? els.payMethodFilter.value : "all";
    let list = state.payments;
    if (methodFilter !== "all") list = list.filter((p) => p.method === methodFilter);
    if (q) {
      list = list.filter((p) =>
        (p.client_username || "").toLowerCase().includes(q) ||
        (p.client_full_name || "").toLowerCase().includes(q) ||
        (p.reference || "").toLowerCase().includes(q)
      );
    }
    if (els.payCount) els.payCount.textContent = list.length + (list.length === 1 ? " pago" : " pagos");
    if (!list.length) {
      els.payTbody.innerHTML = '<tr><td colspan="8" class="muted">Sin pagos registrados.</td></tr>';
      return;
    }
    els.payTbody.innerHTML = list.map(paymentRowHtml).join("");
    // Wiring de botón eliminar
    els.payTbody.querySelectorAll("[data-act='del-pay']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const client = btn.dataset.client;
        const amount = btn.dataset.amount;
        if (!confirm("Eliminar el pago de " + fmtPrice(amount) + " de " + client + "?\nEsto también eliminará el movimiento de cuenta corriente.")) return;
        try {
          await api("/api/admin/payments/" + id, { method: "DELETE" });
          state.payments = state.payments.filter((p) => p.id !== id);
          renderPayments();
          // Refrescar cuentas si estaban cargadas
          if (state.accountsLoaded) { state.accountsLoaded = false; loadAccounts(); }
          showToast("Pago eliminado");
        } catch (err) {
          showToast("Error: " + err.message, "err");
        }
      });
    });
  }

  function paymentRowHtml(p) {
    const clientLabel = escapeHtml(p.client_full_name || p.client_username || "—");
    const regBy = escapeHtml(p.registered_by_full_name || p.registered_by_username || "—");
    return '<tr>' +
      '<td class="cell-code">#' + p.id + '</td>' +
      '<td>' + clientLabel + '</td>' +
      '<td class="num"><strong>' + fmtPrice(p.amount) + '</strong></td>' +
      '<td>' + escapeHtml(p.method || "") + '</td>' +
      '<td class="muted">' + escapeHtml(p.reference || "—") + '</td>' +
      '<td class="muted">' + regBy + '</td>' +
      '<td class="muted small-cell">' + formatDate(p.created_at) + '</td>' +
      '<td><button type="button" class="btn btn-small" data-act="del-pay" data-id="' + p.id + '" data-client="' + escapeHtml(p.client_full_name || p.client_username || "") + '" data-amount="' + (p.amount || 0) + '">Eliminar</button></td>' +
    '</tr>';
  }

  if (els.paySearch) els.paySearch.addEventListener("input", debounce(renderPayments, 150));
  if (els.payMethodFilter) els.payMethodFilter.addEventListener("change", renderPayments);

  // Modal registrar pago
  async function populatePayFormClients() {
    if (!els.payFormClient) return;
    const current = els.payFormClient.value;
    els.payFormClient.innerHTML = '<option value="">Seleccionar cliente…</option>';
    // Usar la lista de usuarios si está cargada, o cargar los clientes
    let clients = state.users.filter((u) => [1, 2, 3, 4].includes(Number(u.level)) && u.active);
    if (!clients.length) {
      try {
        const all = await api("/api/admin/users");
        clients = all.filter((u) => [1, 2, 3, 4].includes(Number(u.level)) && u.active);
        if (!state.usersLoaded) { state.users = all; }
      } catch (_) {}
    }
    clients.sort((a, b) => (a.full_name || a.username || "").localeCompare(b.full_name || b.username || "", "es"));
    clients.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = String(u.id);
      opt.textContent = (u.full_name || u.username) + " (" + LEVEL_NAMES[u.level] + ")";
      els.payFormClient.appendChild(opt);
    });
    if (current && els.payFormClient.querySelector('[value="' + current + '"]')) {
      els.payFormClient.value = current;
    }
  }

  if (els.payCreateBtn) {
    els.payCreateBtn.addEventListener("click", async () => {
      if (els.paymentCreateForm) els.paymentCreateForm.reset();
      if (els.paymentCreateMsg) els.paymentCreateMsg.textContent = "";
      await populatePayFormClients();
      if (els.paymentCreateModal) els.paymentCreateModal.hidden = false;
      setTimeout(() => { if (els.payFormClient) els.payFormClient.focus(); }, 50);
    });
  }

  if (els.paymentCreateForm) {
    els.paymentCreateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(els.paymentCreateForm);
      const body = {
        user_id: Number(fd.get("user_id")),
        amount: Number(fd.get("amount")),
        method: fd.get("method"),
        reference: fd.get("reference"),
        notes: fd.get("notes"),
      };
      if (!body.user_id || !body.amount) {
        if (els.paymentCreateMsg) { els.paymentCreateMsg.textContent = "Completá cliente y monto."; els.paymentCreateMsg.className = "config-msg err"; }
        return;
      }
      if (els.paymentCreateMsg) { els.paymentCreateMsg.textContent = "Guardando…"; els.paymentCreateMsg.className = "config-msg"; }
      try {
        const out = await api("/api/admin/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        state.payments.unshift(out.payment);
        renderPayments();
        if (els.paymentCreateModal) els.paymentCreateModal.hidden = true;
        // Refrescar cuentas si estaban cargadas
        if (state.accountsLoaded) { state.accountsLoaded = false; loadAccounts(); }
        showToast("Pago registrado: " + fmtPrice(out.payment.amount));
      } catch (err) {
        if (els.paymentCreateMsg) { els.paymentCreateMsg.textContent = err.message; els.paymentCreateMsg.className = "config-msg err"; }
      }
    });
  }

  // ========== GASTOS ==========
  const expState = {
    categories: [],
    rows: [],
    byCategory: [],
    total: 0,
  };

  function expDefaultRange() {
    if (els.expFrom && !els.expFrom.value) {
      const d = new Date();
      d.setDate(1); // primer dia del mes actual
      els.expFrom.value = d.toISOString().slice(0, 10);
    }
    if (els.expTo && !els.expTo.value) {
      els.expTo.value = new Date().toISOString().slice(0, 10);
    }
  }

  async function loadExpenseCategories() {
    try {
      expState.categories = await api("/api/admin/expense-categories");
    } catch (e) {
      expState.categories = [];
    }
    // Llenar filtro de categorias en la toolbar
    if (els.expCatFilter) {
      const cur = els.expCatFilter.value || "all";
      els.expCatFilter.innerHTML = '<option value="all">Todas las categorías</option>' +
        expState.categories.map((c) => {
          const dim = c.active ? "" : " (inactiva)";
          return '<option value="' + c.id + '">' + escapeHtml(c.name) + dim + '</option>';
        }).join("");
      els.expCatFilter.value = cur;
    }
    // Llenar select del formulario (solo activas)
    if (els.expFormCategory) {
      els.expFormCategory.innerHTML = expState.categories
        .filter((c) => c.active)
        .map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>')
        .join("");
    }
  }

  async function loadExpenses() {
    expDefaultRange();
    if (!expState.categories.length) await loadExpenseCategories();
    const qs = [];
    if (els.expFrom && els.expFrom.value) qs.push("from=" + encodeURIComponent(els.expFrom.value));
    if (els.expTo && els.expTo.value) qs.push("to=" + encodeURIComponent(els.expTo.value));
    if (els.expCatFilter && els.expCatFilter.value !== "all") qs.push("category_id=" + encodeURIComponent(els.expCatFilter.value));
    if (els.expSearch && els.expSearch.value.trim()) qs.push("q=" + encodeURIComponent(els.expSearch.value.trim()));
    const url = "/api/admin/expenses" + (qs.length ? ("?" + qs.join("&")) : "");
    if (els.expTbody) els.expTbody.innerHTML = '<tr><td colspan="7" class="muted">Cargando…</td></tr>';
    try {
      const data = await api(url);
      expState.rows = data.rows || [];
      expState.byCategory = data.by_category || [];
      expState.total = data.total || 0;
      renderExpenses();
    } catch (e) {
      if (els.expTbody) els.expTbody.innerHTML = '<tr><td colspan="7" class="muted">Error cargando gastos</td></tr>';
    }
  }

  function renderExpenses() {
    if (!els.expTbody) return;
    const rows = expState.rows;
    if (els.expCount) {
      els.expCount.textContent = rows.length + (rows.length === 1 ? " gasto" : " gastos");
    }
    // Sumario
    if (els.expSummaryAmount) els.expSummaryAmount.textContent = fmtMoney(expState.total);
    if (els.expSummaryBycat) {
      if (!expState.byCategory.length) {
        els.expSummaryBycat.innerHTML = '<span class="muted small">Sin gastos en el período.</span>';
      } else {
        els.expSummaryBycat.innerHTML = expState.byCategory.map((c) => {
          return '<div class="exp-cat-chip">' +
            '<span>' + escapeHtml(c.category_name || "—") + '</span>' +
            '<span class="exp-cat-chip-val">' + fmtMoney(c.total) + '</span>' +
            '<span class="exp-cat-chip-count">×' + (c.count || 0) + '</span>' +
          '</div>';
        }).join("");
      }
    }
    // Tabla
    if (!rows.length) {
      els.expTbody.innerHTML = '<tr><td colspan="7" class="muted">No hay gastos en el período. Registrá uno con el botón "+ Registrar gasto".</td></tr>';
      if (els.expTfoot) els.expTfoot.innerHTML = "";
      return;
    }
    els.expTbody.innerHTML = rows.map((e) => {
      const methodNice = (e.payment_method || "").replace(/_/g, " ");
      return '<tr data-id="' + e.id + '">' +
        '<td class="muted small">' + escapeHtml(fmtDateShort(e.expense_date)) + '</td>' +
        '<td><strong>' + escapeHtml(e.category_name || "—") + '</strong></td>' +
        '<td>' + escapeHtml(e.description || "") + '</td>' +
        '<td class="muted small">' + escapeHtml(methodNice) + '</td>' +
        '<td class="muted small">' + escapeHtml(e.reference || "") + '</td>' +
        '<td class="num"><strong>' + fmtMoney(e.amount) + '</strong></td>' +
        '<td>' +
          '<button class="btn btn-small" data-act="exp-edit" data-id="' + e.id + '" type="button">Editar</button> ' +
          '<button class="btn btn-small btn-danger" data-act="exp-del" data-id="' + e.id + '" type="button">Borrar</button>' +
        '</td>' +
      '</tr>';
    }).join("");
    if (els.expTfoot) {
      els.expTfoot.innerHTML = '<tr><th colspan="5">Total</th>' +
        '<th class="num"><strong>' + fmtMoney(expState.total) + '</strong></th>' +
        '<th></th></tr>';
    }
  }

  // Filtros con debounce
  function bindExpFilters() {
    if (els.expFrom) els.expFrom.addEventListener("change", loadExpenses);
    if (els.expTo) els.expTo.addEventListener("change", loadExpenses);
    if (els.expCatFilter) els.expCatFilter.addEventListener("change", loadExpenses);
    if (els.expSearch) {
      els.expSearch.addEventListener("input", () => {
        clearTimeout(els.expSearch._t);
        els.expSearch._t = setTimeout(loadExpenses, 250);
      });
    }
  }
  bindExpFilters();

  // Abrir modal de creacion
  function openExpenseForm(existing) {
    if (!els.expCreateModal || !els.expCreateForm) return;
    loadExpenseCategories().then(() => {
      const form = els.expCreateForm;
      form.reset();
      if (existing) {
        if (els.expCreateTitle) els.expCreateTitle.textContent = "Editar gasto #" + existing.id;
        form.id.value = existing.id;
        form.expense_date.value = existing.expense_date || "";
        form.amount.value = existing.amount;
        form.expense_category_id.value = existing.expense_category_id || "";
        form.description.value = existing.description || "";
        form.payment_method.value = existing.payment_method || "efectivo";
        form.reference.value = existing.reference || "";
        form.notes.value = existing.notes || "";
      } else {
        if (els.expCreateTitle) els.expCreateTitle.textContent = "Registrar gasto";
        form.id.value = "";
        form.expense_date.value = new Date().toISOString().slice(0, 10);
        form.payment_method.value = "efectivo";
      }
      if (els.expCreateMsg) { els.expCreateMsg.textContent = ""; els.expCreateMsg.className = "muted small"; }
      els.expCreateModal.hidden = false;
      setTimeout(() => { try { form.amount.focus(); } catch (_) {} }, 50);
    });
  }

  if (els.expCreateBtn) {
    els.expCreateBtn.addEventListener("click", () => openExpenseForm(null));
  }

  if (els.expTbody) {
    els.expTbody.addEventListener("click", async (e) => {
      const edit = e.target.closest('[data-act="exp-edit"]');
      const del = e.target.closest('[data-act="exp-del"]');
      if (edit) {
        const id = Number(edit.dataset.id);
        const row = expState.rows.find((r) => r.id === id);
        if (row) openExpenseForm(row);
      } else if (del) {
        const id = Number(del.dataset.id);
        if (!confirm("¿Borrar este gasto? Esta acción no se puede deshacer.")) return;
        try {
          await api("/api/admin/expenses/" + id, { method: "DELETE" });
          await loadExpenses();
        } catch (err) {
          alert("Error al borrar: " + err.message);
        }
      }
    });
  }

  if (els.expCreateForm) {
    els.expCreateForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const form = els.expCreateForm;
      const id = form.id.value ? Number(form.id.value) : null;
      const body = {
        expense_date: form.expense_date.value,
        amount: Number(form.amount.value),
        expense_category_id: form.expense_category_id.value ? Number(form.expense_category_id.value) : null,
        description: form.description.value.trim(),
        payment_method: form.payment_method.value,
        reference: form.reference.value.trim(),
        notes: form.notes.value.trim(),
      };
      if (!body.amount || body.amount <= 0) {
        if (els.expCreateMsg) { els.expCreateMsg.textContent = "Monto invalido"; els.expCreateMsg.className = "config-msg err"; }
        return;
      }
      if (els.expCreateSubmit) els.expCreateSubmit.disabled = true;
      try {
        const url = id ? ("/api/admin/expenses/" + id) : "/api/admin/expenses";
        const method = id ? "PATCH" : "POST";
        await api(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        els.expCreateModal.hidden = true;
        await loadExpenses();
      } catch (err) {
        if (els.expCreateMsg) { els.expCreateMsg.textContent = err.message; els.expCreateMsg.className = "config-msg err"; }
      } finally {
        if (els.expCreateSubmit) els.expCreateSubmit.disabled = false;
      }
    });
  }

  // Modal gestion de categorias
  function renderExpenseCategoriesAdmin() {
    if (!els.expCatsTbody) return;
    if (!expState.categories.length) {
      els.expCatsTbody.innerHTML = '<tr><td colspan="4" class="muted">Sin categorías</td></tr>';
      return;
    }
    els.expCatsTbody.innerHTML = expState.categories.map((c) => {
      const usage = Number(c.usage_count) || 0;
      const canDelete = usage === 0;
      return '<tr data-id="' + c.id + '">' +
        '<td><input type="text" data-cat-field="name" value="' + escapeHtml(c.name) + '" maxlength="60" /></td>' +
        '<td class="num muted">' + usage + '</td>' +
        '<td><input type="checkbox" data-cat-field="active" ' + (c.active ? "checked" : "") + ' /></td>' +
        '<td>' +
          (canDelete
            ? '<button class="btn btn-small btn-danger" data-cat-act="del" data-id="' + c.id + '" type="button">Borrar</button>'
            : '<span class="muted small" title="Tiene gastos asociados">Desactivá en su lugar</span>') +
        '</td>' +
      '</tr>';
    }).join("");
  }

  if (els.expCatsBtn) {
    els.expCatsBtn.addEventListener("click", async () => {
      await loadExpenseCategories();
      renderExpenseCategoriesAdmin();
      if (els.expCatCreateMsg) { els.expCatCreateMsg.textContent = ""; els.expCatCreateMsg.className = "muted small"; }
      if (els.expCatsModal) els.expCatsModal.hidden = false;
    });
  }

  if (els.expCatCreateForm) {
    els.expCatCreateForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(els.expCatCreateForm);
      const name = String(fd.get("name") || "").trim();
      if (!name) return;
      try {
        await api("/api/admin/expense-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        els.expCatCreateForm.reset();
        await loadExpenseCategories();
        renderExpenseCategoriesAdmin();
        if (els.expCatCreateMsg) { els.expCatCreateMsg.textContent = "✓ Categoría agregada"; els.expCatCreateMsg.className = "config-msg ok"; }
      } catch (err) {
        if (els.expCatCreateMsg) { els.expCatCreateMsg.textContent = err.message; els.expCatCreateMsg.className = "config-msg err"; }
      }
    });
  }

  if (els.expCatsTbody) {
    // Auto-save al cambiar nombre o checkbox active
    els.expCatsTbody.addEventListener("change", async (ev) => {
      const inp = ev.target.closest("[data-cat-field]");
      if (!inp) return;
      const tr = inp.closest("tr"); if (!tr) return;
      const id = Number(tr.dataset.id);
      const field = inp.dataset.catField;
      const body = {};
      if (field === "name") body.name = inp.value.trim();
      else if (field === "active") body.active = inp.checked ? 1 : 0;
      try {
        await api("/api/admin/expense-categories/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await loadExpenseCategories();
        renderExpenseCategoriesAdmin();
      } catch (err) {
        alert("Error: " + err.message);
        await loadExpenseCategories();
        renderExpenseCategoriesAdmin();
      }
    });
    // Borrar
    els.expCatsTbody.addEventListener("click", async (ev) => {
      const btn = ev.target.closest('[data-cat-act="del"]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!confirm("¿Borrar esta categoría?")) return;
      try {
        await api("/api/admin/expense-categories/" + id, { method: "DELETE" });
        await loadExpenseCategories();
        renderExpenseCategoriesAdmin();
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  }

  // ========== CUENTAS CORRIENTES ==========

  async function loadAccounts() {
    try {
      if (els.accTbody) els.accTbody.innerHTML = '<tr><td colspan="5" class="muted">Cargando…</td></tr>';
      state.accounts = await api("/api/admin/accounts");
      state.accountsLoaded = true;
      renderAccounts();
    } catch (e) {
      if (els.accTbody) els.accTbody.innerHTML = '<tr><td colspan="5" class="muted">Error cargando cuentas</td></tr>';
    }
  }

  function renderAccounts() {
    if (!els.accTbody) return;
    const q = (els.accSearch ? els.accSearch.value : "").trim().toLowerCase();
    let list = state.accounts;
    if (q) {
      list = list.filter((a) =>
        (a.username || "").toLowerCase().includes(q) ||
        (a.full_name || "").toLowerCase().includes(q)
      );
    }
    if (els.accCount) els.accCount.textContent = list.length + (list.length === 1 ? " cliente" : " clientes");
    if (!list.length) {
      els.accTbody.innerHTML = '<tr><td colspan="5" class="muted">Sin clientes.</td></tr>';
      return;
    }
    els.accTbody.innerHTML = list.map(accountRowHtml).join("");
    // Wiring de click para expandir historial
    els.accTbody.querySelectorAll("tr.acc-row").forEach((tr) => {
      tr.addEventListener("click", () => toggleAccountDetail(tr));
    });
  }

  function accountRowHtml(a) {
    const balance = Number(a.balance) || 0;
    const balanceClass = balance >= 0 ? "acc-balance-pos" : "acc-balance-neg";
    const balanceLabel = balance >= 0 ? "A favor: " + fmtPrice(balance) : "Debe: " + fmtPrice(Math.abs(balance));
    return '<tr class="acc-row" data-id="' + a.id + '" style="cursor:pointer">' +
      '<td>' + escapeHtml(a.full_name || a.username || "") + ' <span class="muted small">@' + escapeHtml(a.username || "") + '</span></td>' +
      '<td class="muted">' + escapeHtml(LEVEL_NAMES[a.level] || String(a.level)) + '</td>' +
      '<td class="num muted">' + fmtPrice(a.total_debit) + '</td>' +
      '<td class="num muted">' + fmtPrice(a.total_credit) + '</td>' +
      '<td class="num"><span class="acc-balance-badge ' + balanceClass + '">' + balanceLabel + '</span></td>' +
    '</tr>' +
    '<tr class="acc-detail-row" data-for="' + a.id + '" hidden>' +
      '<td colspan="5" class="acc-detail-cell"><span class="muted">Cargando historial…</span></td>' +
    '</tr>';
  }

  async function toggleAccountDetail(tr) {
    const id = Number(tr.dataset.id);
    const detailRow = els.accTbody.querySelector('tr.acc-detail-row[data-for="' + id + '"]');
    if (!detailRow) return;
    if (!detailRow.hidden) { detailRow.hidden = true; return; }
    detailRow.hidden = false;
    if (detailRow.dataset.loaded) return;
    const cell = detailRow.querySelector(".acc-detail-cell");
    try {
      const data = await api("/api/admin/accounts/" + id);
      detailRow.dataset.loaded = "1";
      const movs = data.movements || [];
      if (!movs.length) {
        cell.innerHTML = '<p class="muted">Sin movimientos.</p>';
        return;
      }
      let running = 0;
      // calcular running balance de más antiguo a más reciente, luego invertir para mostrar desc
      const sorted = movs.slice().reverse();
      const rows = sorted.map((m) => {
        running += (m.type === "credit" ? m.amount : -m.amount);
        return { m: m, running: running };
      }).reverse();

      cell.innerHTML = '<table class="acc-mov-table"><thead><tr>' +
        '<th>Fecha</th><th>Tipo</th><th>Descripción</th>' +
        '<th class="num">Monto</th><th class="num">Saldo</th>' +
        '</tr></thead><tbody>' +
        rows.map(({ m, running: rb }) => {
          const typeLabel = m.type === "credit" ? "Crédito" : "Débito";
          const typeClass = m.type === "credit" ? "acc-credit" : "acc-debit";
          const runClass = rb >= 0 ? "acc-balance-pos" : "acc-balance-neg";
          return '<tr>' +
            '<td class="muted small-cell">' + formatDate(m.created_at) + '</td>' +
            '<td><span class="' + typeClass + '">' + typeLabel + '</span></td>' +
            '<td>' + escapeHtml(m.description || "—") + '</td>' +
            '<td class="num">' + fmtPrice(m.amount) + '</td>' +
            '<td class="num"><span class="' + runClass + '">' + fmtPrice(Math.abs(rb)) + (rb < 0 ? ' (debe)' : ' (favor)') + '</span></td>' +
          '</tr>';
        }).join("") +
        '</tbody></table>';
    } catch (err) {
      cell.innerHTML = '<span class="muted err">Error: ' + escapeHtml(err.message) + '</span>';
    }
  }

  if (els.accSearch) els.accSearch.addEventListener("input", debounce(renderAccounts, 150));
  if (els.accReloadBtn) {
    els.accReloadBtn.addEventListener("click", () => {
      state.accountsLoaded = false;
      loadAccounts();
    });
  }

  // ---------- logout ----------
  els.logoutBtn.addEventListener("click", async () => {
    try { await fetch("/logout", { method: "POST" }); }
    finally { location.href = "/login"; }
  });

  // ---------- catálogo PDF ----------
  async function openCatalogModal() {
    els.catalogMsg.textContent = "";
    els.catalogMsg.className = "config-msg";
    els.catalogGenerateBtn.disabled = false;
    els.catalogGenerateBtn.textContent = "📄 Generar PDF";

    // Poblar listas personalizadas en el select de precios
    els.catalogPriceListsGroup.innerHTML = "";
    const lists = state.priceListsLoaded ? state.priceLists
      : await api("/api/admin/price-lists").catch(() => []);
    if (!state.priceListsLoaded) { state.priceLists = lists; state.priceListsLoaded = true; }
    const activeLists = lists.filter((l) => l.active);
    if (activeLists.length) {
      activeLists.forEach((l) => {
        const opt = document.createElement("option");
        opt.value = "list:" + l.id;
        opt.textContent = l.name;
        els.catalogPriceListsGroup.appendChild(opt);
      });
    } else {
      els.catalogPriceListsGroup.innerHTML = "<option disabled>No hay listas activas</option>";
    }

    // Poblar categorías (checkboxes)
    if (!state.allCategories.length) {
      try { state.allCategories = await api("/api/categories"); } catch (_) {}
    }
    if (els.catalogCatsLoading) els.catalogCatsLoading.remove();
    els.catalogCatsWrap.innerHTML = "";
    state.allCategories.forEach((c) => {
      const lbl = document.createElement("label");
      lbl.className = "cats-check";
      lbl.title = c.name;
      lbl.innerHTML =
        '<input type="checkbox" data-cat-id="' + c.id + '" checked>' +
        '<span class="cats-check-lbl">' + escapeHtml(c.name) + '</span>';
      els.catalogCatsWrap.appendChild(lbl);
    });

    // Poblar select de WhatsApp destino (usuarios + vendedores con WA)
    els.catalogWaSelect.innerHTML = '<option value="">Solo descargar (sin abrir WhatsApp)</option>';
    const allUsers = state.usersLoaded ? state.users : await api("/api/admin/users").catch(() => []);
    if (!state.usersLoaded) { state.users = allUsers; state.usersLoaded = true; }
    const vends = state.vendedoresLoaded ? state.vendedores : await api("/api/admin/vendedores").catch(() => []);
    if (!state.vendedoresLoaded) { state.vendedores = vends; state.vendedoresLoaded = true; }

    const waUsers = allUsers.filter((u) => u.active && u.whatsapp_number);
    const waVends = vends.filter((v) => v.active && v.whatsapp_number);

    if (waUsers.length) {
      const grpU = document.createElement("optgroup");
      grpU.label = "Clientes con WhatsApp";
      waUsers.forEach((u) => {
        const o = document.createElement("option");
        o.value = u.id;
        o.textContent = (u.full_name || u.username) + " (" + u.whatsapp_number + ")";
        grpU.appendChild(o);
      });
      els.catalogWaSelect.appendChild(grpU);
    }
    if (waVends.length) {
      const grpV = document.createElement("optgroup");
      grpV.label = "Vendedores con WhatsApp";
      waVends.forEach((v) => {
        const o = document.createElement("option");
        o.value = v.id;
        o.textContent = (v.full_name || v.username) + " (" + v.whatsapp_number + ")";
        grpV.appendChild(o);
      });
      els.catalogWaSelect.appendChild(grpV);
    }

    // Poblar select de cliente (clientes activos level 1-4). Si se elige uno,
    // el catálogo usa su lista de precios efectiva automáticamente.
    if (els.catalogClientSelect) {
      els.catalogClientSelect.innerHTML =
        '<option value="">— Sin cliente (elegir lista manualmente) —</option>';
      allUsers
        .filter((u) => u.active && Number(u.level) >= 1 && Number(u.level) <= 4)
        .sort((a, b) => (a.full_name || a.username || "").localeCompare(b.full_name || b.username || ""))
        .forEach((u) => {
          const o = document.createElement("option");
          o.value = u.id;
          o.textContent = (u.full_name || u.username) + " — " + catalogClientPriceLabel(u);
          els.catalogClientSelect.appendChild(o);
        });
      els.catalogClientSelect.value = "";
      syncCatalogClientUI();
    }

    els.catalogModal.hidden = false;
  }

  // Devuelve el nombre de la lista/nivel efectivo de un cliente para mostrar en el hint.
  function catalogClientPriceLabel(u) {
    if (u.price_list_id) {
      const pl = (state.priceLists || []).find((l) => l.id === u.price_list_id && l.active);
      if (pl) return pl.name;
    }
    return { 1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP" }[Number(u.level)] || "Minorista";
  }

  // Muestra/oculta el selector manual de lista según haya o no cliente elegido.
  function syncCatalogClientUI() {
    const sel = els.catalogClientSelect;
    if (!sel) return;
    const hasClient = !!sel.value;
    if (els.catalogPriceWrap) els.catalogPriceWrap.style.display = hasClient ? "none" : "";
    if (els.catalogClientHint) {
      if (hasClient) {
        const txt = sel.options[sel.selectedIndex].textContent;
        const after = txt.indexOf("—") >= 0 ? txt.slice(txt.indexOf("—") + 1).trim() : "";
        els.catalogClientHint.textContent = "Se usará la lista del cliente" + (after ? ": " + after : "") + ".";
      } else {
        els.catalogClientHint.textContent =
          "Si elegís un cliente, el catálogo usa automáticamente su lista de precios.";
      }
    }
  }

  // Al elegir un cliente, las categorías a incluir heredan las que ese cliente
  // tiene permitidas (user_category_access). Sin restricción = todas marcadas.
  async function applyCatalogClientCategories(clientId) {
    const boxes = els.catalogCatsWrap.querySelectorAll("input[type=checkbox]");
    if (!clientId) { boxes.forEach((b) => { b.checked = true; }); return; }
    try {
      const data = await api("/api/admin/users/" + clientId + "/categories");
      const allowed = new Set((data.categories || []).filter((c) => c.allowed).map((c) => c.id));
      boxes.forEach((b) => { b.checked = allowed.has(Number(b.dataset.catId)); });
    } catch (_) { /* si falla, se dejan como están */ }
  }

  if (els.catalogClientSelect) {
    els.catalogClientSelect.addEventListener("change", () => {
      syncCatalogClientUI();
      applyCatalogClientCategories(Number(els.catalogClientSelect.value) || 0);
    });
  }

  if (els.catalogBtn) {
    els.catalogBtn.addEventListener("click", openCatalogModal);
  }

  if (els.catalogCatsAll) {
    els.catalogCatsAll.addEventListener("click", () => {
      els.catalogCatsWrap.querySelectorAll("input[type=checkbox]").forEach((cb) => { cb.checked = true; });
    });
  }
  if (els.catalogCatsNone) {
    els.catalogCatsNone.addEventListener("click", () => {
      els.catalogCatsWrap.querySelectorAll("input[type=checkbox]").forEach((cb) => { cb.checked = false; });
    });
  }

  if (els.catalogForm) {
    els.catalogForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      els.catalogMsg.textContent = "";
      els.catalogMsg.className = "config-msg";
      els.catalogGenerateBtn.disabled = true;
      els.catalogGenerateBtn.textContent = "Generando…";

      // Armar priceConfig: si hay cliente elegido, el server resuelve su lista
      // efectiva; si no, se usa la lista/nivel elegido manualmente.
      const clientId = els.catalogClientSelect ? Number(els.catalogClientSelect.value) || 0 : 0;
      let priceConfig;
      if (clientId) {
        priceConfig = { type: "client", userId: clientId };
      } else {
        const priceVal = els.catalogPriceSelect.value; // "level:minorista" | "list:5"
        if (priceVal.startsWith("list:")) {
          priceConfig = { type: "list", listId: Number(priceVal.split(":")[1]) };
        } else {
          priceConfig = { type: "level", level: priceVal.split(":")[1] || "minorista" };
        }
      }

      // Categorías seleccionadas (vacío = todas)
      const checkedCats = Array.from(
        els.catalogCatsWrap.querySelectorAll("input[type=checkbox]:checked")
      ).map((cb) => Number(cb.dataset.catId));
      const allChecked = checkedCats.length === state.allCategories.length;
      const categoryIds = allChecked ? [] : checkedCats;

      const targetUserId = Number(els.catalogWaSelect.value) || 0;
      const includePriceChanges = els.catalogIncludeChanges ? els.catalogIncludeChanges.checked : false;
      const withImages = els.catalogWithImages ? els.catalogWithImages.checked : true;

      try {
        const response = await fetch("/api/admin/catalog/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceConfig, categoryIds, targetUserId, includePriceChanges, withImages }),
        });

        if (response.status === 401) { location.href = "/login"; return; }
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Error " + response.status);
        }

        // Descargar el PDF
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "catalogo-" + new Date().toISOString().slice(0, 10) + ".pdf";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);

        // Abrir WhatsApp si hay destino
        const wa = response.headers.get("X-Whatsapp");
        const nameB64 = response.headers.get("X-Whatsapp-Name");
        const name = nameB64 ? decodeURIComponent(atob(nameB64).split("").map((c) =>
          "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")) : "";
        if (wa) {
          const msg = "Hola" + (name ? " " + name : "") +
            ", te mando el catálogo de precios. Lo encontrás adjunto 📄";
          window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(msg), "_blank");
        }

        els.catalogModal.hidden = true;
        showToast("✅ PDF generado y descargado" + (wa ? " · WhatsApp abierto" : ""));
      } catch (err) {
        els.catalogMsg.textContent = "Error: " + err.message;
        els.catalogMsg.className = "config-msg err";
      } finally {
        els.catalogGenerateBtn.disabled = false;
        els.catalogGenerateBtn.textContent = "📄 Generar PDF";
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRESUPUESTOS / VENTA
  // ─────────────────────────────────────────────────────────────────────────

  // Referencias a los elementos del DOM de Venta
  const bEls = {
    search:         document.getElementById("budget-search"),
    filterStatus:   document.getElementById("budget-filter-status"),
    newBtn:         document.getElementById("new-budget-btn"),
    tbody:          document.getElementById("budgets-tbody"),
    overlay:        document.getElementById("budget-overlay"),
    formTitle:      document.getElementById("budget-form-title"),
    formNumber:     document.getElementById("budget-form-number"),
    statusBadge:    document.getElementById("budget-status-badge"),
    closeBtn:       document.getElementById("budget-close-btn"),
    form:           document.getElementById("budget-form"),
    client:         document.getElementById("budget-client"),
    vendedorRow:    document.getElementById("budget-vendedor-row"),
    vendedor:       document.getElementById("budget-vendedor"),
    payment:        document.getElementById("budget-payment"),
    itemsTbody:     document.getElementById("budget-items-tbody"),
    emptyRow:       document.getElementById("budget-empty-row"),
    notes:          document.getElementById("budget-notes"),
    subtotalDisp:   document.getElementById("budget-subtotal-disp"),
    discount:       document.getElementById("budget-discount"),
    discountDisp:   document.getElementById("budget-discount-disp"),
    surcharge:      document.getElementById("budget-surcharge"),
    surchargeDisp:  document.getElementById("budget-surcharge-disp"),
    totalDisp:      document.getElementById("budget-total-disp"),
    printBtn:       document.getElementById("budget-print-btn"),
    cancelBtn:      document.getElementById("budget-cancel-btn"),
    acceptBtn:      document.getElementById("budget-accept-btn"),
    invoiceBtn:     document.getElementById("budget-invoice-btn"),
    saveDraftBtn:   document.getElementById("budget-save-draft-btn"),
    sendBtn:        document.getElementById("budget-send-btn"),
    addProductBtn:  document.getElementById("budget-add-product-btn"),
    picker:         document.getElementById("product-picker-modal"),
    pickerSearch:   document.getElementById("picker-search"),
    pickerCheckAll: document.getElementById("picker-check-all"),
    pickerTbody:    document.getElementById("picker-tbody"),
    pickerCount:    document.getElementById("picker-selected-count"),
    pickerConfirm:  document.getElementById("picker-confirm-btn"),
  };

  // Sub-estado de presupuestos
  const bState = {
    list: [],
    loaded: false,
    editingId: null,       // null = nuevo, número = editando
    editingStatus: "borrador",
    items: [],             // items del formulario actual [{product_id, product_code, product_name, quantity, unit_price, discount_percent, subtotal}]
    allProducts: [],       // cache para el picker
    productsLoaded: false,
    pickerSelected: new Set(), // IDs de productos seleccionados en el picker (persiste al filtrar)
  };

  const BUDGET_STATUS_LABELS = {
    borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", cancelado: "Cancelado", facturado: "Facturado",
  };
  const BUDGET_STATUS_BADGE = {
    borrador: "budget-badge--borrador", enviado: "budget-badge--enviado",
    aceptado: "budget-badge--aceptado", cancelado: "budget-badge--cancelado", facturado: "budget-badge--facturado",
  };

  // --- helpers ---
  function budgetBadgeHtml(status) {
    const lbl = BUDGET_STATUS_LABELS[status] || status;
    const cls = BUDGET_STATUS_BADGE[status] || "";
    return '<span class="budget-badge ' + cls + '">' + escapeHtml(lbl) + '</span>';
  }

  function budgetRecalc() {
    let subtotal = 0;
    bState.items.forEach((it) => {
      const qty = Number(it.quantity) || 1;
      const price = Number(it.unit_price) || 0;
      const disc = Number(it.discount_percent) || 0;
      it.subtotal = Math.round(qty * price * (1 - disc / 100));
      subtotal += it.subtotal;
    });
    const discPct = Number(bEls.discount.value) || 0;
    const surPct  = Number(bEls.surcharge.value) || 0;
    const afterDisc = Math.round(subtotal * (1 - discPct / 100));
    const total = Math.round(afterDisc * (1 + surPct / 100));
    const discAmt = subtotal - afterDisc;
    const surAmt  = total - afterDisc;
    bEls.subtotalDisp.textContent = fmtPrice(subtotal);
    bEls.discountDisp.textContent = discPct > 0 ? "— " + fmtPrice(discAmt) : "— $0";
    bEls.surchargeDisp.textContent = surPct > 0 ? "+ " + fmtPrice(surAmt) : "+ $0";
    bEls.totalDisp.textContent = fmtPrice(total);
  }

  function budgetRenderItems() {
    if (!bState.items.length) {
      bEls.itemsTbody.innerHTML =
        '<tr id="budget-empty-row"><td colspan="7" class="muted" style="text-align:center;padding:18px;font-style:italic">' +
        'Sin artículos. Usá "+ Agregar productos" para empezar.</td></tr>';
      budgetRecalc();
      return;
    }
    bEls.itemsTbody.innerHTML = bState.items.map((it, idx) => {
      const sub = fmtPrice(it.subtotal || 0);
      return '<tr data-idx="' + idx + '">' +
        '<td style="padding:5px 8px"><input type="text" value="' + escapeHtml(it.product_code) + '"' +
          ' data-field="product_code" style="width:80px" /></td>' +
        '<td style="padding:5px 8px"><input type="text" value="' + escapeHtml(it.product_name) + '"' +
          ' data-field="product_name" /></td>' +
        '<td style="padding:5px 8px;text-align:right">' +
          '<input type="number" value="' + escapeHtml(Math.round(it.quantity)) + '" min="1" step="1"' +
          ' data-field="quantity" style="width:60px;text-align:right" /></td>' +
        '<td style="padding:5px 8px;text-align:right">' +
          '<input type="number" value="' + escapeHtml(it.unit_price) + '" min="0" step="1"' +
          ' data-field="unit_price" style="width:90px;text-align:right" /></td>' +
        '<td style="padding:5px 8px;text-align:right">' +
          '<input type="number" value="' + escapeHtml(it.discount_percent) + '" min="0" max="100" step="0.5"' +
          ' data-field="discount_percent" style="width:58px;text-align:right" /></td>' +
        '<td style="padding:5px 8px;text-align:right;font-weight:500">' + escapeHtml(sub) + '</td>' +
        '<td style="padding:5px 8px;text-align:center">' +
          '<button type="button" class="btn-row-del" data-del-idx="' + idx + '" title="Eliminar" ' +
          'style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px">✕</button>' +
        '</td>' +
      '</tr>';
    }).join("");
    budgetRecalc();
  }

  // Escuchar cambios en la tabla de items
  if (bEls.itemsTbody) {
    bEls.itemsTbody.addEventListener("input", (e) => {
      const tr = e.target.closest("tr[data-idx]");
      if (!tr) return;
      const idx = Number(tr.dataset.idx);
      const field = e.target.dataset.field;
      if (!field || idx >= bState.items.length) return;
      if (field === "product_code" || field === "product_name") {
        bState.items[idx][field] = e.target.value;
      } else if (field === "quantity") {
        // Cantidad siempre entera, mínimo 1
        bState.items[idx][field] = Math.max(1, Math.round(Number(e.target.value) || 1));
        e.target.value = bState.items[idx][field]; // corregir el input si vino decimal
      } else {
        bState.items[idx][field] = Number(e.target.value) || 0;
      }
      // Recalcular subtotal de esta fila y totales
      const it = bState.items[idx];
      it.subtotal = Math.round((Number(it.quantity)||1) * (Number(it.unit_price)||0) * (1 - (Number(it.discount_percent)||0) / 100));
      // Actualizar celda de subtotal sin re-renderizar toda la tabla
      const cells = tr.querySelectorAll("td");
      if (cells[5]) cells[5].textContent = fmtPrice(it.subtotal);
      budgetRecalc();
    });
    bEls.itemsTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-idx]");
      if (!btn) return;
      const idx = Number(btn.dataset.delIdx);
      bState.items.splice(idx, 1);
      budgetRenderItems();
    });
  }

  if (bEls.discount) bEls.discount.addEventListener("input", budgetRecalc);
  if (bEls.surcharge) bEls.surcharge.addEventListener("input", budgetRecalc);

  // --- Cargar lista de presupuestos ---
  async function loadBudgets() {
    try {
      if (bEls.tbody) bEls.tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">Cargando…</td></tr>';
      const data = await api("/api/budgets");
      bState.list = data || [];
      bState.loaded = true;
      renderBudgets();
    } catch (e) {
      if (bEls.tbody) bEls.tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">Error: ' + escapeHtml(e.message) + '</td></tr>';
    }
  }

  function renderBudgets() {
    if (!bEls.tbody) return;
    const q = (bEls.search ? bEls.search.value.trim().toLowerCase() : "");
    const stFilter = bEls.filterStatus ? bEls.filterStatus.value : "all";
    // Tab Presupuestos: excluir facturado (esos van a Ventas)
    let list = bState.list.filter((b) => b.status !== "facturado");
    if (q) list = list.filter((b) =>
      (b.number || "").toLowerCase().includes(q) ||
      (b.client_name || "").toLowerCase().includes(q) ||
      (b.vendedor_name || "").toLowerCase().includes(q));
    if (stFilter !== "all") list = list.filter((b) => b.status === stFilter);
    if (!list.length) {
      bEls.tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">Sin presupuestos.</td></tr>';
      return;
    }
    bEls.tbody.innerHTML = list.map((b) => {
      // Chip "Del carrito" si el presupuesto fue creado automaticamente desde un pedido
      const fromCart = b.order_id ? ' <span title="Generado desde carrito" style="font-size:11px;background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 5px">🛒</span>' : "";
      return '<tr style="cursor:pointer" data-budget-id="' + b.id + '">' +
        '<td style="padding:7px 10px;font-weight:600">' + escapeHtml(b.number) + fromCart + '</td>' +
        '<td style="padding:7px 10px">' + formatDate(b.created_at) + '</td>' +
        '<td style="padding:7px 10px">' + escapeHtml(b.client_name) + '</td>' +
        '<td style="padding:7px 10px">' + escapeHtml(b.vendedor_name || "—") + '</td>' +
        '<td style="padding:7px 10px">' + escapeHtml(b.payment_method) + '</td>' +
        '<td style="padding:7px 10px;text-align:right;font-weight:600">' + fmtPrice(b.total) + '</td>' +
        '<td style="padding:7px 10px">' + budgetBadgeHtml(b.status) + '</td>' +
        '<td style="padding:7px 10px;text-align:right">' +
          '<button type="button" class="btn" style="font-size:12px;padding:3px 10px" data-open-budget="' + b.id + '">Abrir</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  }

  // Tab Ventas: muestra solo presupuestos facturados (= vendidos)
  function renderVentas() {
    const ventasEl = document.getElementById("ventas-tbody");
    if (!ventasEl) return;
    const q = (document.getElementById("ventas-search") || {}).value
      ? document.getElementById("ventas-search").value.trim().toLowerCase() : "";
    let list = bState.list.filter((b) => b.status === "facturado");
    if (q) list = list.filter((b) =>
      (b.number || "").toLowerCase().includes(q) ||
      (b.client_name || "").toLowerCase().includes(q) ||
      (b.vendedor_name || "").toLowerCase().includes(q));
    if (!list.length) {
      ventasEl.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Sin ventas registradas.</td></tr>';
      return;
    }
    ventasEl.innerHTML = list.map((b) =>
      '<tr style="cursor:pointer" data-budget-id="' + b.id + '">' +
      '<td style="padding:7px 10px;font-weight:600">' + escapeHtml(b.number) + '</td>' +
      '<td style="padding:7px 10px">' + formatDate(b.created_at) + '</td>' +
      '<td style="padding:7px 10px">' + escapeHtml(b.client_name) + '</td>' +
      '<td style="padding:7px 10px">' + escapeHtml(b.vendedor_name || "—") + '</td>' +
      '<td style="padding:7px 10px">' + escapeHtml(b.payment_method) + '</td>' +
      '<td style="padding:7px 10px;text-align:right;font-weight:600">' + fmtPrice(b.total) + '</td>' +
      '<td style="padding:7px 10px;text-align:right">' +
        '<button type="button" class="btn" style="font-size:12px;padding:3px 10px" data-open-budget="' + b.id + '">Ver</button>' +
      '</td>' +
    '</tr>').join("");
  }

  // Click en una fila o en el botón "Abrir"
  if (bEls.tbody) {
    bEls.tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-budget]");
      if (btn) { openBudgetForm(Number(btn.dataset.openBudget)); return; }
      const tr = e.target.closest("tr[data-budget-id]");
      if (tr) openBudgetForm(Number(tr.dataset.budgetId));
    });
  }
  if (bEls.search) bEls.search.addEventListener("input", debounce(renderBudgets, 200));
  if (bEls.filterStatus) bEls.filterStatus.addEventListener("change", renderBudgets);

  // --- Abrir formulario ---
  async function openBudgetForm(id) {
    bState.editingId = id || null;
    bState.items = [];
    bState.editingStatus = "borrador";

    // Poblar clientes
    await populateBudgetClients();

    // Admin ve select de vendedor; vendedor no
    if (bEls.vendedorRow) bEls.vendedorRow.hidden = !state.isAdmin;
    if (state.isAdmin) await populateBudgetVendedores();

    if (id) {
      // Editar existente
      try {
        const data = await api("/api/budgets/" + id);
        bState.editingStatus = data.status;
        if (bEls.formTitle) bEls.formTitle.textContent = "Presupuesto #" + data.number;
        if (bEls.formNumber) bEls.formNumber.textContent = data.number;
        if (bEls.client) bEls.client.value = data.client_id || "";
        if (bEls.vendedor && state.isAdmin) bEls.vendedor.value = data.vendedor_id || "";
        if (bEls.payment) bEls.payment.value = data.payment_method || "Efectivo";
        if (bEls.discount) bEls.discount.value = data.discount_percent || 0;
        if (bEls.surcharge) bEls.surcharge.value = data.surcharge_percent || 0;
        if (bEls.notes) bEls.notes.value = data.notes || "";
        bState.items = (data.items || []).map((it) => ({
          product_id: it.product_id,
          product_code: it.product_code,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_percent: it.discount_percent,
          subtotal: it.subtotal,
        }));
      } catch (e) {
        showToast("Error cargando presupuesto: " + e.message, true);
        return;
      }
    } else {
      // Nuevo
      if (bEls.formTitle) bEls.formTitle.textContent = "Nuevo presupuesto";
      if (bEls.formNumber) bEls.formNumber.textContent = "";
      if (bEls.client) bEls.client.value = "";
      if (bEls.vendedor && state.isAdmin) bEls.vendedor.value = state.me ? state.me.id : "";
      if (bEls.payment) bEls.payment.value = "Efectivo";
      if (bEls.discount) bEls.discount.value = 0;
      if (bEls.surcharge) bEls.surcharge.value = 0;
      if (bEls.notes) bEls.notes.value = "";
    }

    // Estado badge y visibilidad de acciones
    budgetUpdateStatusUI();
    budgetRenderItems();

    if (bEls.overlay) bEls.overlay.hidden = false;
  }

  function budgetUpdateStatusUI() {
    const st = bState.editingStatus;
    if (bEls.statusBadge) {
      bEls.statusBadge.className = "budget-badge " + (BUDGET_STATUS_BADGE[st] || "budget-badge--borrador");
      bEls.statusBadge.textContent = BUDGET_STATUS_LABELS[st] || st;
    }
    // Solo facturado y cancelado bloquean la edición.
    // Un presupuesto aceptado se puede seguir corrigiendo antes de facturar.
    const isFinal = st === "cancelado" || st === "facturado";
    [bEls.saveDraftBtn, bEls.sendBtn, bEls.addProductBtn, bEls.discount, bEls.surcharge].forEach((el) => {
      if (el) el.disabled = isFinal;
    });
    if (bEls.cancelBtn)  bEls.cancelBtn.hidden  = isFinal;
    if (bEls.acceptBtn)  bEls.acceptBtn.hidden  = st === "aceptado" || isFinal;
    // Facturar: solo cuando está aceptado y tiene id (ya guardado)
    if (bEls.invoiceBtn) bEls.invoiceBtn.hidden = st !== "aceptado" || !bState.editingId;
  }

  async function populateBudgetClients() {
    if (!bEls.client) return;
    // Usar cache de users si está disponible, sino fetch rápido
    let clients = state.users.filter((u) => u.level >= 1 && u.level <= 4 && u.active);
    if (!clients.length && !state.usersLoaded) {
      try { const all = await api("/api/admin/users"); clients = (all || []).filter((u) => u.level >= 1 && u.level <= 4 && u.active); } catch (_) {}
    }
    bEls.client.innerHTML = '<option value="">Consumidor final</option>' +
      clients.map((u) => '<option value="' + u.id + '">' + escapeHtml(u.full_name || u.username) + '</option>').join("");
  }

  async function populateBudgetVendedores() {
    if (!bEls.vendedor) return;
    let vends = state.vendedoresActiveCache.length ? state.vendedoresActiveCache :
      (state.vendedores.filter ? state.vendedores.filter((v) => v.active) : []);
    if (!vends.length) {
      try { const all = await api("/api/admin/vendedores"); vends = (all || []).filter((v) => v.active); } catch (_) {}
    }
    bEls.vendedor.innerHTML = vends.map((v) =>
      '<option value="' + v.id + '">' + escapeHtml(v.full_name || v.username) + '</option>'
    ).join("");
  }

  // --- Guardar ---
  async function saveBudget(targetStatus) {
    const clientId = bEls.client ? (bEls.client.value ? Number(bEls.client.value) : null) : null;
    // Nombre del cliente: buscar en el select o usar "Consumidor final"
    const clientName = clientId
      ? (bEls.client.options[bEls.client.selectedIndex] || {}).text || "Consumidor final"
      : "Consumidor final";
    const vendedorId = state.isAdmin && bEls.vendedor ? (Number(bEls.vendedor.value) || null) : null;
    const payMethod = bEls.payment ? bEls.payment.value : "Efectivo";
    const discPct = Number(bEls.discount ? bEls.discount.value : 0) || 0;
    const surPct = Number(bEls.surcharge ? bEls.surcharge.value : 0) || 0;
    const notes = bEls.notes ? bEls.notes.value.trim() : "";
    // Al editar un presupuesto aceptado, conservar el estado 'aceptado' para no
    // perder el botón Facturar ni degradarlo a borrador/enviado accidentalmente.
    let finalStatus = targetStatus || "borrador";
    if (bState.editingId && bState.editingStatus === "aceptado") finalStatus = "aceptado";

    const body = {
      client_id: clientId,
      client_name: clientName,
      vendedor_id: vendedorId,
      payment_method: payMethod,
      currency: "ARS",
      discount_percent: discPct,
      surcharge_percent: surPct,
      notes: notes,
      status: finalStatus,
      items: bState.items,
    };

    try {
      let result;
      if (bState.editingId) {
        result = await api("/api/budgets/" + bState.editingId, { method: "PUT", body: JSON.stringify(body) });
        if (finalStatus !== bState.editingStatus) {
          await api("/api/budgets/" + bState.editingId + "/status", {
            method: "PATCH", body: JSON.stringify({ status: finalStatus }),
          });
        }
      } else {
        result = await api("/api/budgets", { method: "POST", body: JSON.stringify(body) });
        bState.editingId = result.id;
        if (bEls.formTitle) bEls.formTitle.textContent = "Presupuesto #" + result.number;
        if (bEls.formNumber) bEls.formNumber.textContent = result.number;
      }
      bState.editingStatus = finalStatus;
      budgetUpdateStatusUI();
      showToast("✅ Presupuesto guardado");
      loadBudgets();
    } catch (e) {
      showToast("Error: " + e.message, true);
    }
  }

  // Botones de guardar
  if (bEls.saveDraftBtn) {
    bEls.saveDraftBtn.addEventListener("click", () => saveBudget("borrador"));
  }
  if (bEls.form) {
    bEls.form.addEventListener("submit", (e) => {
      e.preventDefault();
      saveBudget("enviado");
    });
  }
  // Botones de cambio de estado
  if (bEls.cancelBtn) {
    bEls.cancelBtn.addEventListener("click", async () => {
      if (!bState.editingId) return;
      if (!confirm("Al cancelar el presupuesto, los productos vuelven al stock.\n\n¿Confirmás la cancelación?")) return;
      try {
        await api("/api/budgets/" + bState.editingId + "/status", { method: "PATCH", body: JSON.stringify({ status: "cancelado" }) });
        bState.editingStatus = "cancelado";
        budgetUpdateStatusUI();
        showToast("Presupuesto cancelado");
        loadBudgets();
      } catch (e) { showToast("Error: " + e.message, true); }
    });
  }
  if (bEls.acceptBtn) {
    bEls.acceptBtn.addEventListener("click", async () => {
      if (!bState.editingId) { await saveBudget("aceptado"); return; }
      try {
        await api("/api/budgets/" + bState.editingId + "/status", { method: "PATCH", body: JSON.stringify({ status: "aceptado" }) });
        bState.editingStatus = "aceptado";
        budgetUpdateStatusUI();
        showToast("✅ Presupuesto aceptado");
        loadBudgets();
      } catch (e) { showToast("Error: " + e.message, true); }
    });
  }

  // Facturar: solo disponible cuando status=aceptado
  if (bEls.invoiceBtn) {
    bEls.invoiceBtn.addEventListener("click", async () => {
      if (!bState.editingId) return;
      if (!confirm("¿Facturar este presupuesto?\n\nSe va a descontar el stock de los artículos" +
          (bState.items.some(() => true) ? " y, si hay un cliente con cuenta corriente, se le debitará el total." : "."))) return;
      bEls.invoiceBtn.disabled = true;
      try {
        const data = await api("/api/budgets/" + bState.editingId + "/invoice", { method: "POST" });
        bState.editingStatus = "facturado";
        budgetUpdateStatusUI();
        showToast("🧾 Facturado correctamente" + (data.debited ? " — cuenta corriente debitada" : ""));
        loadBudgets(); // recarga para mover a Ventas
      } catch (e) {
        showToast("Error al facturar: " + e.message, true);
      } finally {
        bEls.invoiceBtn.disabled = false;
      }
    });
  }

  // Cerrar overlay
  if (bEls.closeBtn) {
    bEls.closeBtn.addEventListener("click", () => {
      if (bEls.overlay) bEls.overlay.hidden = true;
    });
  }

  // Buscador de Ventas
  const ventasSearchEl = document.getElementById("ventas-search");
  if (ventasSearchEl) ventasSearchEl.addEventListener("input", debounce(renderVentas, 200));

  // Click en fila de Ventas (abre el presupuesto facturado para consultarlo)
  const ventasTbodyEl = document.getElementById("ventas-tbody");
  if (ventasTbodyEl) {
    ventasTbodyEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-budget]");
      if (btn) { openBudgetForm(Number(btn.dataset.openBudget)); return; }
      const tr = e.target.closest("tr[data-budget-id]");
      if (tr) openBudgetForm(Number(tr.dataset.budgetId));
    });
  }

  // Nuevo presupuesto
  if (bEls.newBtn) {
    bEls.newBtn.addEventListener("click", () => openBudgetForm(null));
  }

  // Imprimir
  if (bEls.printBtn) {
    bEls.printBtn.addEventListener("click", () => {
      // Armar una ventana de impresión simple
      const num = bEls.formNumber ? bEls.formNumber.textContent : "Nuevo";
      const clientText = bEls.client ? (bEls.client.options[bEls.client.selectedIndex] || {}).text || "Consumidor final" : "Consumidor final";
      const payText = bEls.payment ? bEls.payment.value : "";
      const discPct = bEls.discount ? bEls.discount.value : 0;
      const surPct = bEls.surcharge ? bEls.surcharge.value : 0;
      const notes = bEls.notes ? bEls.notes.value : "";
      const date = new Date().toLocaleDateString("es-AR");
      const appName = (state.me && state.me.app_name) ? state.me.app_name : "Maxaria";

      let subtotal = 0;
      bState.items.forEach((it) => { subtotal += Number(it.subtotal) || 0; });
      const afterDisc = Math.round(subtotal * (1 - Number(discPct) / 100));
      const total = Math.round(afterDisc * (1 + Number(surPct) / 100));

      const rows = bState.items.map((it) => {
        return "<tr>" +
          "<td>" + escapeHtml(it.product_code) + "</td>" +
          "<td>" + escapeHtml(it.product_name) + "</td>" +
          "<td style='text-align:right'>" + escapeHtml(String(it.quantity)) + "</td>" +
          "<td style='text-align:right'>$" + Number(it.unit_price).toLocaleString("es-AR") + "</td>" +
          (Number(it.discount_percent) ? "<td style='text-align:right'>" + it.discount_percent + "%</td>" : "<td>—</td>") +
          "<td style='text-align:right;font-weight:600'>$" + Number(it.subtotal).toLocaleString("es-AR") + "</td>" +
          "</tr>";
      }).join("");

      const html = "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
        "<title>Presupuesto " + num + "</title>" +
        "<style>body{font-family:sans-serif;font-size:13px;margin:24px}" +
        "h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}" +
        "th,td{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left}" +
        "th{background:#f1f5f9;font-size:12px;color:#6b7280}" +
        ".total-box{margin-top:12px;text-align:right;font-size:14px}" +
        ".grand-total{font-size:18px;font-weight:700;color:#d97706}</style>" +
        "</head><body>" +
        "<h1>" + escapeHtml(appName) + " — Presupuesto N° " + escapeHtml(num) + "</h1>" +
        "<p><strong>Fecha:</strong> " + date + " &nbsp; <strong>Cliente:</strong> " + escapeHtml(clientText) +
        " &nbsp; <strong>Pago:</strong> " + escapeHtml(payText) + "</p>" +
        "<table><thead><tr><th>Cód.</th><th>Artículo</th><th>Cant.</th><th>Precio</th><th>Desc%</th><th>Subtotal</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table>" +
        "<div class='total-box'>" +
        (Number(discPct) ? "<div>Descuento " + discPct + "%: — $" + (subtotal - afterDisc).toLocaleString("es-AR") + "</div>" : "") +
        (Number(surPct) ? "<div>Recargo " + surPct + "%: + $" + (total - afterDisc).toLocaleString("es-AR") + "</div>" : "") +
        "<div class='grand-total'>TOTAL: $" + total.toLocaleString("es-AR") + "</div>" +
        "</div>" +
        (notes ? "<p style='margin-top:16px;color:#6b7280'><em>" + escapeHtml(notes) + "</em></p>" : "") +
        "</body></html>";
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); w.print(); }
    });
  }

  // ─────── PRODUCT PICKER ───────

  async function loadPickerProducts() {
    if (bState.productsLoaded && bState.allProducts.length) return;
    try {
      // Usamos el endpoint admin de productos para tener todos con precios
      const data = await api("/api/admin/products");
      bState.allProducts = data || [];
      bState.productsLoaded = true;
    } catch (_) {}
  }

  function renderPickerList(filter) {
    if (!bEls.pickerTbody) return;
    let list = bState.allProducts.filter((p) => p.active);
    if (filter) {
      const q = filter.trim().toLowerCase();
      list = list.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.code || "").toLowerCase().includes(q) ||
        (p.category_name || "").toLowerCase().includes(q));
    }
    if (!list.length) {
      bEls.pickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:20px;text-align:center">Sin resultados</td></tr>';
      return;
    }
    bEls.pickerTbody.innerHTML = list.map((p) => {
      const img = p.image_url
        ? '<img src="' + escapeHtml(p.image_url) + '" style="width:36px;height:36px;object-fit:cover;border-radius:4px" loading="lazy" />'
        : '<span style="display:inline-block;width:36px;height:36px;background:#f3f4f6;border-radius:4px;line-height:36px;text-align:center;color:#9ca3af;font-size:18px">📦</span>';
      // Restaurar el estado de selección del Set persistente
      const checked = bState.pickerSelected.has(p.id) ? ' checked' : '';
      return '<tr data-prod-id="' + p.id + '">' +
        '<td style="padding:6px 8px"><input type="checkbox" class="picker-cb" data-prod-id="' + p.id + '"' + checked + ' /></td>' +
        '<td style="padding:6px 8px">' + img + '</td>' +
        '<td style="padding:6px 8px">' +
          '<div style="font-weight:500">' + escapeHtml(p.name) + '</div>' +
          '<div class="muted" style="font-size:11px">' + escapeHtml(p.code || "") + (p.category_name ? " · " + escapeHtml(p.category_name) : "") + '</div>' +
        '</td>' +
        '<td style="padding:6px 8px;text-align:right">' + fmtPrice(p.price_minorista) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;color:' + (p.stock > 0 ? "#059669" : "#9ca3af") + '">' + (p.stock || 0) + '</td>' +
        '</tr>';
    }).join("");
  }

  function pickerUpdateCount() {
    if (!bEls.pickerCount) return;
    const n = bState.pickerSelected.size;
    bEls.pickerCount.textContent = n + (n === 1 ? " seleccionado" : " seleccionados");
    if (bEls.pickerConfirm) bEls.pickerConfirm.disabled = n === 0;
  }

  if (bEls.picker) {
    bEls.picker.addEventListener("change", (e) => {
      if (e.target.classList.contains("picker-cb")) {
        const prodId = Number(e.target.dataset.prodId);
        if (e.target.checked) bState.pickerSelected.add(prodId);
        else bState.pickerSelected.delete(prodId);
        pickerUpdateCount();
      } else if (e.target.id === "picker-check-all") {
        // "Seleccionar todos" afecta solo los visibles en el filtro actual
        bEls.pickerTbody.querySelectorAll(".picker-cb").forEach((cb) => {
          cb.checked = e.target.checked;
          const pid = Number(cb.dataset.prodId);
          if (e.target.checked) bState.pickerSelected.add(pid);
          else bState.pickerSelected.delete(pid);
        });
        pickerUpdateCount();
      }
    });
    // Cerrar con botón [data-close] dentro del picker
    bEls.picker.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) {
        bEls.picker.hidden = true;
      }
    });
  }

  if (bEls.pickerSearch) {
    bEls.pickerSearch.addEventListener("input", debounce((e) => {
      renderPickerList(e.target.value);
      // No resetear pickerSelected al filtrar — esa es la fix principal
    }, 200));
  }

  if (bEls.pickerConfirm) {
    bEls.pickerConfirm.addEventListener("click", () => {
      // Agregar TODOS los productos del Set (independientemente del filtro activo)
      bState.pickerSelected.forEach((prodId) => {
        const prod = bState.allProducts.find((p) => p.id === prodId);
        if (!prod) return;
        const existing = bState.items.find((it) => it.product_id === prodId);
        if (existing) {
          existing.quantity += 1;
          existing.subtotal = Math.round(existing.quantity * existing.unit_price * (1 - existing.discount_percent / 100));
        } else {
          bState.items.push({
            product_id: prod.id,
            product_code: prod.code || "",
            product_name: prod.name || "",
            quantity: 1,
            unit_price: prod.price_minorista || 0,
            discount_percent: 0,
            subtotal: prod.price_minorista || 0,
          });
        }
      });
      // Limpiar selección y cerrar
      bState.pickerSelected.clear();
      bEls.picker.hidden = true;
      if (bEls.pickerSearch) bEls.pickerSearch.value = "";
      if (bEls.pickerCheckAll) bEls.pickerCheckAll.checked = false;
      budgetRenderItems();
    });
  }

  // Botón "Agregar productos" abre el picker
  if (bEls.addProductBtn) {
    bEls.addProductBtn.addEventListener("click", async () => {
      if (!bEls.picker) return;
      // Cargar productos si no están en caché
      if (!bState.productsLoaded) {
        if (bEls.pickerTbody) bEls.pickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:20px;text-align:center">Cargando…</td></tr>';
        await loadPickerProducts();
      }
      if (bEls.pickerSearch) bEls.pickerSearch.value = "";
      if (bEls.pickerCheckAll) bEls.pickerCheckAll.checked = false;
      bState.pickerSelected.clear(); // empezar con selección vacía cada vez que se abre
      renderPickerList("");
      pickerUpdateCount();
      bEls.picker.hidden = false;
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS DE FORMATO DE PRECIO (compartidos por ambos modales)
  // ─────────────────────────────────────────────────────────────────
  // Formatea un entero como "$1.000" (sin decimales, con separador de miles)
  function fmtPrice(n) {
    n = Math.round(Number(n)) || 0;
    return "$ " + n.toLocaleString("es-AR");
  }
  // Parsea "$1.000,00" o "1000" → entero
  function parsePrice(s) {
    if (!s && s !== 0) return 0;
    const clean = String(s).replace(/\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
    return Math.round(parseFloat(clean)) || 0;
  }
  // Attacha focus/blur a un input de precio para formatear/deformatear
  function attachPriceFmt(el) {
    if (!el) return;
    el.addEventListener("focus", () => {
      const raw = parsePrice(el.value);
      el.value = raw || "";
      el.type = "number";
    });
    el.addEventListener("blur", () => {
      const raw = parsePrice(el.value);
      el.type = "text";
      el.value = raw ? fmtPrice(raw) : "";
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // EDITAR PRODUCTO (modal al doble click)
  // ─────────────────────────────────────────────────────────────────
  const editProdModal   = document.getElementById("edit-product-modal");
  const epSaveBtn       = document.getElementById("ep-save-btn");
  const epCatSelect     = document.getElementById("ep-category");
  const epCostInp       = document.getElementById("ep-cost");
  let   editProdId      = null;

  // Pares pctId → priceId para el modal Editar
  const EP_PAIRS = [
    { pctId: "ep-vip-pct",        priceId: "ep-vip"        },
    { pctId: "ep-revendedor-pct", priceId: "ep-revendedor" },
    { pctId: "ep-mayorista-pct",  priceId: "ep-mayorista"  },
    { pctId: "ep-minorista-pct",  priceId: "ep-minorista"  },
    { pctId: "ep-publico-pct",    priceId: "ep-publico"    },
  ];

  function epGetCost() { return Math.round(Number(epCostInp ? epCostInp.value : 0)) || 0; }
  function epPctToPrice(cost, pct)   { return cost > 0 ? Math.round(cost * (1 + pct / 100)) : 0; }
  function epPriceToPct(cost, price) { return cost > 0 ? Math.round((price / cost - 1) * 100) : 0; }

  // Cuando cambia el costo, recalcula todos los precios manteniendo sus %
  function epRecalcAllPrices() {
    const cost = epGetCost();
    EP_PAIRS.forEach(({ pctId, priceId }) => {
      const pctEl   = document.getElementById(pctId);
      const priceEl = document.getElementById(priceId);
      if (!pctEl || !priceEl) return;
      const newPrice = epPctToPrice(cost, Number(pctEl.value) || 0);
      // Si el campo está en modo texto (formateado), actualizar como texto
      if (priceEl.type === "text") {
        priceEl.value = newPrice ? fmtPrice(newPrice) : "";
      } else {
        priceEl.value = newPrice;
      }
    });
  }

  function epFillCategories() {
    if (!epCatSelect) return;
    const allCats = state.allCategories && state.allCategories.length
      ? state.allCategories
      : [...new Map(state.products.filter((p) => p.category_id).map((p) => [p.category_id, { id: p.category_id, name: p.category_name }])).values()]
          .sort((a, b) => a.name.localeCompare(b.name));
    epCatSelect.innerHTML = '<option value="">— Sin categoría —</option>' +
      allCats.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join("");
  }

  function openEditProdModal(p) {
    editProdId = p.id;
    epFillCategories();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set("ep-code",      p.code      || "");
    set("ep-name",      p.name      || "");
    set("ep-stock",     p.stock     || 0);
    set("ep-stock-min", p.stock_min || 0);
    set("ep-cost",      p.cost      || 0);
    // Precios: mostrar formateados
    const prices = {
      "ep-vip":        p.price_vip        || 0,
      "ep-revendedor": p.price_revendedor || 0,
      "ep-mayorista":  p.price_mayorista  || 0,
      "ep-minorista":  p.price_minorista  || 0,
      "ep-publico":    p.price_publico    || 0,
    };
    Object.entries(prices).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.type = "text";
      el.value = val ? fmtPrice(val) : "";
    });
    // Calcular % iniciales desde costo y precio guardados
    const cost = p.cost || 0;
    EP_PAIRS.forEach(({ pctId, priceId }) => {
      const pctEl = document.getElementById(pctId);
      if (pctEl) pctEl.value = epPriceToPct(cost, prices[priceId] || 0);
    });
    if (epCatSelect) epCatSelect.value = p.category_id || "";
    const activeChk = document.getElementById("ep-active");
    if (activeChk) activeChk.checked = !!p.active;
    if (editProdModal) editProdModal.hidden = false;
    const nameEl = document.getElementById("ep-name");
    if (nameEl) nameEl.focus();
  }

  // Cuando cambia el costo → recalcula precios
  if (epCostInp) epCostInp.addEventListener("input", epRecalcAllPrices);

  // Bidireccional: para cada par (pct ↔ precio)
  if (editProdModal) {
    EP_PAIRS.forEach(({ pctId, priceId }) => {
      const pctEl   = document.getElementById(pctId);
      const priceEl = document.getElementById(priceId);
      // Attachar formato focus/blur a los campos de precio
      attachPriceFmt(priceEl);
      if (pctEl) pctEl.addEventListener("input", () => {
        const newPrice = epPctToPrice(epGetCost(), Number(pctEl.value) || 0);
        if (priceEl.type === "text") {
          priceEl.value = newPrice ? fmtPrice(newPrice) : "";
        } else {
          priceEl.value = newPrice;
        }
      });
      if (priceEl) priceEl.addEventListener("input", () => {
        pctEl.value = epPriceToPct(epGetCost(), parsePrice(priceEl.value));
      });
    });
  }

  if (epSaveBtn) {
    epSaveBtn.addEventListener("click", async () => {
      if (!editProdId) return;
      const get = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
      const name = get("ep-name").trim();
      if (!name) { alert("El nombre es obligatorio."); return; }
      const activeChk = document.getElementById("ep-active");
      const body = {
        name,
        category_id:      epCatSelect && epCatSelect.value ? Number(epCatSelect.value) : null,
        stock:            Number(get("ep-stock"))        || 0,
        stock_min:        Number(get("ep-stock-min"))    || 0,
        cost:             Number(get("ep-cost"))         || 0,
        price_minorista:  parsePrice(get("ep-minorista")),
        price_revendedor: parsePrice(get("ep-revendedor")),
        price_mayorista:  parsePrice(get("ep-mayorista")),
        price_vip:        parsePrice(get("ep-vip")),
        price_publico:    parsePrice(get("ep-publico")),
        active:           activeChk && activeChk.checked ? 1 : 0,
      };
      try {
        epSaveBtn.disabled = true;
        await api("/api/admin/products/" + editProdId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        // Actualizar state local
        const p = state.products.find((x) => x.id === editProdId);
        if (p) {
          Object.assign(p, body);
          // category_name necesita buscarse
          if (epCatSelect && epCatSelect.value) {
            const opt = epCatSelect.options[epCatSelect.selectedIndex];
            if (opt) p.category_name = opt.text;
          } else { p.category_name = ""; }
        }
        applyFilters();
        showToast("Producto guardado");
        if (editProdModal) editProdModal.hidden = true;
      } catch (e) {
        alert(e.message || "Error al guardar");
      } finally {
        epSaveBtn.disabled = false;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // NUEVO PRODUCTO
  // ─────────────────────────────────────────────────────────────────
  const newProdModal     = document.getElementById("new-product-modal");
  const newProdBtn       = document.getElementById("new-product-btn");
  const npSaveBtn        = document.getElementById("np-save-btn");
  const npCategorySelect = document.getElementById("np-category");
  const npCostInp        = document.getElementById("np-cost");

  // Pares pctId → priceId para el modal Nuevo
  const NP_PAIRS = [
    { pctId: "np-vip-pct",  priceId: "np-vip"  },
    { pctId: "np-rev-pct",  priceId: "np-rev"  },
    { pctId: "np-may-pct",  priceId: "np-may"  },
    { pctId: "np-min-pct",  priceId: "np-min"  },
    { pctId: "np-pub-pct",  priceId: "np-pub"  },
  ];
  const NP_LS_KEY = "maxaria_np_pcts2";

  function npGetCost() { return Math.round(Number(npCostInp ? npCostInp.value : 0)) || 0; }

  // costo + % → precio
  function npPctToPrice(cost, pct) { return cost > 0 ? Math.round(cost * (1 + pct / 100)) : 0; }
  // costo + precio → %
  function npPriceToPct(cost, price) { return cost > 0 ? Math.round((price / cost - 1) * 100) : 0; }

  // Recalcula todos los precios desde sus % actuales (cuando cambia el costo)
  function npRecalcAllPrices() {
    const cost = npGetCost();
    NP_PAIRS.forEach(({ pctId, priceId }) => {
      const pctEl   = document.getElementById(pctId);
      const priceEl = document.getElementById(priceId);
      if (!pctEl || !priceEl) return;
      const newPrice = npPctToPrice(cost, Number(pctEl.value) || 0);
      if (priceEl.type === "text") {
        priceEl.value = newPrice ? fmtPrice(newPrice) : "";
      } else {
        priceEl.value = newPrice;
      }
    });
  }

  function npSavePcts() {
    try {
      const obj = {};
      NP_PAIRS.forEach(({ pctId }) => { const el = document.getElementById(pctId); if (el) obj[pctId] = el.value; });
      localStorage.setItem(NP_LS_KEY, JSON.stringify(obj));
    } catch (_) {}
  }

  function npLoadPcts() {
    try {
      const saved = JSON.parse(localStorage.getItem(NP_LS_KEY) || "{}");
      NP_PAIRS.forEach(({ pctId }) => {
        const el = document.getElementById(pctId);
        if (el && saved[pctId] !== undefined) el.value = saved[pctId];
      });
    } catch (_) {}
  }

  function npFillCategories() {
    if (!npCategorySelect) return;
    const allCats = state.allCategories && state.allCategories.length
      ? state.allCategories
      : [...new Map(state.products.filter((p) => p.category_id).map((p) => [p.category_id, { id: p.category_id, name: p.category_name }])).values()]
          .sort((a, b) => a.name.localeCompare(b.name));
    npCategorySelect.innerHTML = '<option value="">— Sin categoría —</option>' +
      allCats.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join("");
  }

  function npOpenModal() {
    npFillCategories();
    const codeEl = document.getElementById("np-code");
    if (codeEl) codeEl.value = npSuggestCode();
    if (document.getElementById("np-name"))  document.getElementById("np-name").value  = "";
    if (document.getElementById("np-stock")) document.getElementById("np-stock").value = "0";
    if (npCostInp) npCostInp.value = "0";
    // Cargar últimos % usados (o defaults si es la primera vez)
    const defaults = { "np-vip-pct": 110, "np-rev-pct": 130, "np-may-pct": 120, "np-min-pct": 150, "np-pub-pct": 150 };
    Object.entries(defaults).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
    npLoadPcts(); // sobreescribe con los guardados si existen
    npRecalcAllPrices(); // precios a 0 (costo=0)
    if (newProdModal) newProdModal.hidden = false;
    if (document.getElementById("np-name")) document.getElementById("np-name").focus();
  }

  // Sugiere el siguiente código: busca el código con valor numérico más alto
  function npSuggestCode() {
    if (!state.products.length) return "";
    let maxNum = -1;
    state.products.forEach((p) => {
      const n = parseInt((p.code || "").trim(), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });
    if (maxNum >= 0) return String(maxNum + 1);
    const last = state.products.reduce((a, b) => (b.id > a.id ? b : a));
    const m = (last.code || "").trim().match(/^(.*?)(\d+)$/);
    if (m) return m[1] + String(parseInt(m[2], 10) + 1).padStart(m[2].length, "0");
    return "";
  }

  if (newProdBtn) newProdBtn.addEventListener("click", npOpenModal);

  // Cuando cambia el costo → recalcula todos los precios
  if (npCostInp) npCostInp.addEventListener("input", npRecalcAllPrices);

  // Bidireccional: para cada par (pct ↔ precio)
  if (newProdModal) {
    NP_PAIRS.forEach(({ pctId, priceId }) => {
      const pctEl   = document.getElementById(pctId);
      const priceEl = document.getElementById(priceId);
      attachPriceFmt(priceEl);
      if (pctEl) pctEl.addEventListener("input", () => {
        const newPrice = npPctToPrice(npGetCost(), Number(pctEl.value) || 0);
        if (priceEl.type === "text") {
          priceEl.value = newPrice ? fmtPrice(newPrice) : "";
        } else {
          priceEl.value = newPrice;
        }
      });
      if (priceEl) priceEl.addEventListener("input", () => {
        pctEl.value = npPriceToPct(npGetCost(), parsePrice(priceEl.value));
      });
    });
  }

  if (npSaveBtn) {
    npSaveBtn.addEventListener("click", async () => {
      const code = (document.getElementById("np-code")?.value || "").trim();
      const name = (document.getElementById("np-name")?.value || "").trim();
      if (!code) { alert("El código es obligatorio."); return; }
      if (!name) { alert("El nombre es obligatorio."); return; }
      const cost = npGetCost();
      if (!cost) { alert("Ingresá un costo mayor a 0."); return; }
      const getPrice = (id) => parsePrice(document.getElementById(id)?.value);
      npSavePcts();
      const body = {
        code,
        name,
        category_id:      npCategorySelect && npCategorySelect.value ? Number(npCategorySelect.value) : null,
        stock:            Number(document.getElementById("np-stock")?.value)     || 0,
        stock_min:        Number(document.getElementById("np-stock-min")?.value) || 0,
        cost,
        price_vip:        getPrice("np-vip"),
        price_revendedor: getPrice("np-rev"),
        price_mayorista:  getPrice("np-may"),
        price_minorista:  getPrice("np-min"),
        price_publico:    getPrice("np-pub"),
      };
      try {
        npSaveBtn.disabled = true;
        const result = await api("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        state.products.unshift(result.product);
        populateCategoryFilter(state.products);
        applyFilters();
        showToast("Producto creado: " + name);
        if (newProdModal) newProdModal.hidden = true;
      } catch (e) {
        alert(e.message || "Error al crear producto");
      } finally {
        npSaveBtn.disabled = false;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // AJUSTES DE STOCK
  // ─────────────────────────────────────────────────────────────────
  const adjModal     = document.getElementById("stock-adj-modal");
  const adjHistModal = document.getElementById("stock-adj-hist-modal");
  const adjState     = { productId: null, productStock: 0 };

  const ADJ_TYPE_LABEL = { ajuste:"Ajuste manual", inventario:"Inventario", merma:"Merma/rotura", devolucion:"Devolución" };

  function openStockAdjModal(product) {
    adjState.productId    = product.id;
    adjState.productStock = product.stock || 0;
    const info = document.getElementById("stock-adj-product-info");
    if (info) info.innerHTML =
      '<strong>' + escapeHtml(product.name) + '</strong>' +
      ' <span class="muted">(' + escapeHtml(product.code || "") + ')</span>' +
      ' — Stock actual: <strong>' + adjState.productStock + '</strong>';
    const qtyInp = document.getElementById("stock-adj-qty");
    if (qtyInp) { qtyInp.value = adjState.productStock; qtyInp.focus(); }
    const modeSet = document.getElementById("stock-adj-mode-set");
    if (modeSet) modeSet.checked = true;
    const lbl = document.getElementById("stock-adj-qty-label");
    if (lbl) lbl.textContent = "Nuevo stock";
    const reason = document.getElementById("stock-adj-reason");
    if (reason) reason.value = "";
    if (adjModal) adjModal.hidden = false;
  }

  // Cambio de modo fijar/delta → actualizar label
  document.querySelectorAll("input[name='stock-adj-mode']").forEach((radio) => {
    radio.addEventListener("change", () => {
      const lbl    = document.getElementById("stock-adj-qty-label");
      const qtyInp = document.getElementById("stock-adj-qty");
      if (radio.value === "set") {
        if (lbl) lbl.textContent = "Nuevo stock";
        if (qtyInp) qtyInp.value = adjState.productStock;
      } else {
        if (lbl) lbl.textContent = "Cantidad a sumar (+) o restar (−)";
        if (qtyInp) qtyInp.value = 0;
      }
    });
  });

  // Guardar ajuste
  const adjSaveBtn = document.getElementById("stock-adj-save-btn");
  if (adjSaveBtn) {
    adjSaveBtn.addEventListener("click", async () => {
      const modeEl  = document.querySelector("input[name='stock-adj-mode']:checked");
      const qtyInp  = document.getElementById("stock-adj-qty");
      const typeEl  = document.getElementById("stock-adj-type");
      const reasonEl= document.getElementById("stock-adj-reason");
      const mode    = modeEl  ? modeEl.value  : "set";
      const qty     = Number(qtyInp  ? qtyInp.value  : 0);
      const type    = typeEl  ? typeEl.value  : "ajuste";
      const reason  = reasonEl? reasonEl.value.trim() : "";
      if (isNaN(qty)) { alert("Ingresá una cantidad válida."); return; }
      try {
        adjSaveBtn.disabled = true;
        const result = await api("/api/admin/stock-adjustments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: adjState.productId, mode, qty, type, reason }),
        });
        // Actualizar estado local del producto
        const p = state.products.find((x) => x.id === adjState.productId);
        if (p) {
          p.stock = result.qty_after;
          // Actualizar también el input en la tabla si está visible
          const tr = els.prodTbody.querySelector('tr[data-id="' + adjState.productId + '"]');
          if (tr) {
            const inp = tr.querySelector('[data-field="stock"]');
            if (inp) inp.value = result.qty_after;
          }
          applyFilters(); // re-render para reflejar cambio de color OOS
        }
        showToast("Stock ajustado: " + result.qty_before + " → " + result.qty_after);
        if (adjModal) adjModal.hidden = true;
      } catch (e) {
        alert(e.message || "Error al guardar ajuste");
      } finally {
        adjSaveBtn.disabled = false;
      }
    });
  }

  // Click en botón ajustar de cada fila de producto
  els.prodTbody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act='adj-stock']");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const product = state.products.find((x) => x.id === id);
    if (product) openStockAdjModal(product);
  });

  // Historial global
  const stockHistBtn = document.getElementById("stock-adj-history-btn");
  if (stockHistBtn) {
    stockHistBtn.addEventListener("click", () => {
      if (adjHistModal) adjHistModal.hidden = false;
      loadStockHistory();
    });
  }

  async function loadStockHistory(productId) {
    const tbody = document.getElementById("stock-hist-tbody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
    try {
      const from   = document.getElementById("stock-hist-from");
      const to     = document.getElementById("stock-hist-to");
      const search = document.getElementById("stock-hist-search");
      const qs = [
        productId ? "product_id=" + productId : "",
        from && from.value ? "from=" + from.value : "",
        to   && to.value   ? "to="   + to.value   : "",
      ].filter(Boolean).join("&");
      let rows = await api("/api/admin/stock-adjustments" + (qs ? "?" + qs : ""));
      const q = search ? search.value.trim().toLowerCase() : "";
      if (q) rows = rows.filter((r) => (r.product_name + " " + r.product_code).toLowerCase().includes(q));
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="muted">Sin ajustes</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map((r) => {
        const chg     = Number(r.qty_change);
        const chgStr  = (chg > 0 ? "+" : "") + chg;
        const chgCls  = chg > 0 ? "stock-adj-plus" : (chg < 0 ? "stock-adj-minus" : "");
        const dateStr = (r.created_at || "").slice(0, 10).split("-").reverse().join("/");
        return "<tr>" +
          "<td class=\"muted small\">" + dateStr + "</td>" +
          "<td><strong>" + escapeHtml(r.product_name) + "</strong> <span class=\"muted small\">" + escapeHtml(r.product_code) + "</span></td>" +
          "<td class=\"muted small\">" + escapeHtml(ADJ_TYPE_LABEL[r.type] || r.type) + "</td>" +
          "<td class=\"num muted\">" + r.qty_before + "</td>" +
          "<td class=\"num " + chgCls + "\">" + chgStr + "</td>" +
          "<td class=\"num\"><strong>" + r.qty_after + "</strong></td>" +
          "<td class=\"muted small\">" + escapeHtml(r.reason || "—") + "</td>" +
          "<td class=\"muted small\">" + escapeHtml(r.registered_by_username || "—") + "</td>" +
          "</tr>";
      }).join("");
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted">Error cargando historial.</td></tr>';
    }
  }

  const stockHistFilterBtn = document.getElementById("stock-hist-filter-btn");
  if (stockHistFilterBtn) stockHistFilterBtn.addEventListener("click", () => loadStockHistory());

  // ─────────────────────────────────────────────────────────────────
  // REPORTES DE VENTAS
  // ─────────────────────────────────────────────────────────────────
  const rptEls = {
    from:       document.getElementById("rpt-from"),
    to:         document.getElementById("rpt-to"),
    status:     document.getElementById("rpt-status"),
    client:     document.getElementById("rpt-client"),
    vendedor:   document.getElementById("rpt-vendedor"),
    applyBtn:   document.getElementById("rpt-apply-btn"),
    exportBtn:  document.getElementById("rpt-export-btn"),
    tbody:      document.getElementById("rpt-tbody"),
    tfoot:      document.getElementById("rpt-tfoot"),
  };
  const rptState = { rows: [], expanded: new Set() };

  function rptFmt(n) { return "$ " + Number(n).toLocaleString("es-AR"); }
  function rptPct(num, den) { return den > 0 ? Math.round(num / den * 100) + "%" : "—"; }
  function rptDate(s) { return (s || "").slice(0, 10).split("-").reverse().join("/"); }

  const STATUS_LABEL = { pendiente:"Pendiente", enviado:"Enviado", preparando:"Preparando", entregado:"Entregado", cancelado:"Cancelado" };
  const STATUS_CLS   = { pendiente:"tag-pendiente", enviado:"tag-enviado", preparando:"tag-preparando", entregado:"tag-entregado", cancelado:"tag-cancelado" };

  // Setea el rango "este mes" por default
  function rptSetDefaultRange() {
    if (!rptEls.from || rptEls.from.value) return;
    const now = new Date();
    rptEls.from.value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2,"0") + "-01";
    rptEls.to.value   = now.toISOString().slice(0, 10);
  }

  // Llena los selects de cliente y vendedor al abrir el tab (usa state existente)
  function rptFillSelects() {
    if (rptEls.client) {
      const cur = rptEls.client.value;
      const clients = (state.users || []).filter((u) => u.level >= 1 && u.level <= 4 && u.active);
      rptEls.client.innerHTML = '<option value="">Todos los clientes</option>' +
        clients.map((u) => '<option value="' + u.id + '">' + escapeHtml(u.full_name || u.username) + '</option>').join("");
      if (cur) rptEls.client.value = cur;
    }
    if (rptEls.vendedor) {
      const cur = rptEls.vendedor.value;
      const vends = (state.vendedoresActiveCache || []);
      rptEls.vendedor.innerHTML = '<option value="">Todos los vendedores</option>' +
        vends.map((v) => '<option value="' + v.id + '">' + escapeHtml(v.full_name || v.username) + '</option>').join("");
      if (cur) rptEls.vendedor.value = cur;
    }
  }

  async function loadReportes() {
    rptSetDefaultRange();
    // Cargar usuarios y vendedores si no están en caché
    if (!state.usersLoaded) {
      try {
        const [users, vends] = await Promise.all([
          api("/api/admin/users").catch(() => []),
          api("/api/admin/vendedores").catch(() => []),
        ]);
        state.users = users;
        state.usersLoaded = true;
        state.vendedoresActiveCache = (vends || []).filter((v) => v.active);
      } catch (_) {}
    }
    rptFillSelects();
    await applyReportes();
  }

  async function applyReportes() {
    if (!rptEls.tbody) return;
    rptEls.tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:24px">Cargando…</td></tr>';
    if (rptEls.tfoot) rptEls.tfoot.innerHTML = "";

    const qs = [
      rptEls.from    && rptEls.from.value    ? "from="      + rptEls.from.value    : "",
      rptEls.to      && rptEls.to.value      ? "to="        + rptEls.to.value      : "",
      rptEls.status  && rptEls.status.value !== "todos" ? "status=" + rptEls.status.value : "",
      rptEls.client  && rptEls.client.value  ? "client_id=" + rptEls.client.value  : "",
      rptEls.vendedor&& rptEls.vendedor.value? "vendedor_id="+ rptEls.vendedor.value: "",
    ].filter(Boolean).join("&");

    try {
      const data = await api("/api/admin/reports/sales" + (qs ? "?" + qs : ""));
      rptState.rows = data.orders || [];
      rptState.expanded.clear();
      renderReportes(data);
    } catch (e) {
      rptEls.tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:24px">Error cargando reporte.</td></tr>';
    }
  }

  function renderReportes(data) {
    const { kpis, cobros, orders } = data;
    // KPIs
    const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setKpi("rpt-kpi-orders",     kpis.total_orders);
    setKpi("rpt-kpi-entregados", kpis.entregados + " entregado(s)");
    setKpi("rpt-kpi-ventas",     rptFmt(kpis.ventas_brutas));
    setKpi("rpt-kpi-entregadas", "Entregadas: " + rptFmt(kpis.ventas_entregadas));
    setKpi("rpt-kpi-ticket",     kpis.total_orders > 0 ? rptFmt(Math.round(kpis.ventas_brutas / kpis.total_orders)) : "—");
    setKpi("rpt-kpi-ganancia",   rptFmt(kpis.ganancia_total));
    setKpi("rpt-kpi-margen",     rptPct(kpis.ganancia_total, kpis.ventas_brutas) + " del total");
    setKpi("rpt-kpi-cobros",     rptFmt(cobros.total));
    setKpi("rpt-kpi-cobros-cnt", cobros.cnt + " pago(s)");

    if (!orders.length) {
      rptEls.tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:24px">Sin pedidos en el período seleccionado.</td></tr>';
      return;
    }

    // Tabla
    let tVentas = 0, tGanancia = 0;
    rptEls.tbody.innerHTML = orders.map((o) => {
      tVentas    += Number(o.total)         || 0;
      tGanancia  += Number(o.earning_total) || 0;
      const margen = o.total > 0 ? Math.round(o.earning_total / o.total * 100) : 0;
      const client   = escapeHtml(o.client_name || o.client_username);
      const vendedor = o.vendedor_name ? escapeHtml(o.vendedor_name) : '<span class="muted">—</span>';
      const ganHtml  = o.earning_total > 0
        ? '<span style="color:#15803d">' + rptFmt(o.earning_total) + '</span>'
        : '<span class="muted">—</span>';
      return '<tr class="rpt-order-row" data-order-id="' + o.id + '">' +
        '<td class="muted">#' + o.id + '</td>' +
        '<td class="muted small">' + rptDate(o.created_at) + '</td>' +
        '<td>' + client + '</td>' +
        '<td class="muted small">' + vendedor + '</td>' +
        '<td><span class="order-tag ' + (STATUS_CLS[o.status] || "") + '">' + (STATUS_LABEL[o.status] || o.status) + '</span></td>' +
        '<td class="num muted">' + (o.items_count || 0) + '</td>' +
        '<td class="num"><strong>' + rptFmt(o.total) + '</strong></td>' +
        '<td class="num">' + ganHtml + '</td>' +
        '<td class="num muted">' + (margen > 0 ? margen + "%" : "—") + '</td>' +
        '<td><button class="btn btn-small rpt-detail-btn" type="button" data-id="' + o.id + '">▼</button></td>' +
        '</tr>' +
        '<tr class="rpt-detail-row" id="rpt-detail-' + o.id + '" hidden>' +
        '<td colspan="10" style="padding:0;background:#f8fafc"></td>' +
        '</tr>';
    }).join("");

    // Totales
    const tMargen = tVentas > 0 ? Math.round(tGanancia / tVentas * 100) : 0;
    rptEls.tfoot.innerHTML =
      '<tr style="font-weight:700;background:#f1f5f9">' +
      '<td colspan="6" style="padding:8px 12px">Totales (' + orders.length + ' pedidos)</td>' +
      '<td class="num">' + rptFmt(tVentas) + '</td>' +
      '<td class="num" style="color:#15803d">' + rptFmt(tGanancia) + '</td>' +
      '<td class="num">' + (tMargen > 0 ? tMargen + "%" : "—") + '</td>' +
      '<td></td></tr>';
  }

  // Expandir detalle de un pedido
  if (rptEls.tbody) {
    rptEls.tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest(".rpt-detail-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      const detailRow = document.getElementById("rpt-detail-" + id);
      if (!detailRow) return;
      if (!detailRow.hidden) {
        detailRow.hidden = true;
        btn.textContent = "▼";
        return;
      }
      // Cargar items si no están en caché
      btn.disabled = true;
      try {
        const items = await api("/api/admin/reports/sales/" + id + "/items");
        const td = detailRow.querySelector("td");
        if (td) {
          td.innerHTML = '<div style="padding:8px 16px 12px">' +
            '<table style="width:100%;font-size:12px;border-collapse:collapse">' +
            '<thead><tr style="color:#6b7280">' +
            '<th style="text-align:left;padding:4px 8px">Producto</th>' +
            '<th style="text-align:right;padding:4px 8px">Cant.</th>' +
            '<th style="text-align:right;padding:4px 8px">Precio unit.</th>' +
            '<th style="text-align:right;padding:4px 8px">Subtotal</th>' +
            '</tr></thead><tbody>' +
            (items.map((it) =>
              '<tr><td style="padding:3px 8px">' + escapeHtml(it.product_name) + ' <span style="color:#9ca3af">' + escapeHtml(it.product_code || "") + '</span></td>' +
              '<td style="text-align:right;padding:3px 8px">' + it.quantity + '</td>' +
              '<td style="text-align:right;padding:3px 8px">' + rptFmt(it.unit_price) + '</td>' +
              '<td style="text-align:right;padding:3px 8px"><strong>' + rptFmt(it.subtotal) + '</strong></td></tr>'
            ).join("") || '<tr><td colspan="4" style="padding:8px;color:#9ca3af">Sin items</td></tr>') +
            '</tbody></table></div>';
        }
        detailRow.hidden = false;
        btn.textContent = "▲";
      } catch (_) { showToast("Error cargando items", "err"); }
      finally { btn.disabled = false; }
    });
  }

  // Botón Aplicar
  if (rptEls.applyBtn) rptEls.applyBtn.addEventListener("click", applyReportes);

  // Export CSV
  if (rptEls.exportBtn) {
    rptEls.exportBtn.addEventListener("click", () => {
      if (!rptState.rows.length) { alert("No hay datos para exportar."); return; }
      const header = ["#","Fecha","Cliente","Vendedor","Estado","Items","Total","Ganancia","Margen %"];
      const rows = rptState.rows.map((o) => [
        o.id,
        rptDate(o.created_at),
        '"' + (o.client_name || o.client_username).replace(/"/g,'""') + '"',
        '"' + (o.vendedor_name || "—").replace(/"/g,'""') + '"',
        o.status,
        o.items_count || 0,
        o.total,
        Math.round(o.earning_total) || 0,
        o.total > 0 ? Math.round(o.earning_total / o.total * 100) : 0,
      ]);
      const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "reporte-ventas-" + (rptEls.from ? rptEls.from.value : "hoy") + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // CAJA
  // ─────────────────────────────────────────────────────────────────
  const cajaEls = {
    accountsWrap:    document.getElementById("caja-accounts-wrap"),
    addAccountBtn:   document.getElementById("caja-add-account-btn"),
    newAccountForm:  document.getElementById("caja-new-account-form"),
    accName:         document.getElementById("caja-acc-name"),
    accType:         document.getElementById("caja-acc-type"),
    accSaveBtn:      document.getElementById("caja-acc-save-btn"),
    accCancelBtn:    document.getElementById("caja-acc-cancel-btn"),
    typeBtns:        document.querySelectorAll(".caja-type-btn"),
    movAccount:      document.getElementById("caja-mov-account"),
    movDestWrap:     document.getElementById("caja-mov-dest-wrap"),
    movCounterpart:  document.getElementById("caja-mov-counterpart"),
    movAmount:       document.getElementById("caja-mov-amount"),
    movDesc:         document.getElementById("caja-mov-desc"),
    movDate:         document.getElementById("caja-mov-date"),
    movSaveBtn:      document.getElementById("caja-mov-save-btn"),
    filterAccount:   document.getElementById("caja-filter-account"),
    filterFrom:      document.getElementById("caja-filter-from"),
    filterTo:        document.getElementById("caja-filter-to"),
    filterBtn:       document.getElementById("caja-filter-btn"),
    movTbody:        document.getElementById("caja-mov-tbody"),
    movSummary:      document.getElementById("caja-mov-summary"),
  };
  const cajaState = { accounts: [], movType: "ingreso" };

  function cajaFmt(n) { return "$ " + Number(n).toLocaleString("es-AR"); }
  function cajaTodayIso() { return new Date().toISOString().slice(0, 10); }

  function cajaRenderAccounts() {
    if (!cajaEls.accountsWrap) return;
    const accs = cajaState.accounts;
    if (!accs.length) { cajaEls.accountsWrap.innerHTML = '<p class="muted">Sin cuentas.</p>'; return; }
    const ICON = { efectivo:"💵", banco:"🏦", digital:"📱" };
    cajaEls.accountsWrap.innerHTML = accs.map((a) => {
      const saldo = Number(a.saldo) || 0;
      const cls   = saldo < 0 ? "caja-acc-neg" : "caja-acc-pos";
      return '<div class="caja-acc-card">' +
        '<span class="caja-acc-icon">' + (ICON[a.type] || "💰") + '</span>' +
        '<div class="caja-acc-info">' +
          '<span class="caja-acc-name">' + escapeHtml(a.name) + '</span>' +
          '<span class="caja-acc-type muted small">' + a.type + '</span>' +
        '</div>' +
        '<span class="caja-acc-saldo ' + cls + '">' + cajaFmt(saldo) + '</span>' +
      '</div>';
    }).join("");
  }

  function cajaFillSelects() {
    const accs = cajaState.accounts;
    // Select movimiento
    [cajaEls.movAccount, cajaEls.movCounterpart].forEach((sel) => {
      if (!sel) return;
      sel.innerHTML = accs.map((a) => '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>').join("");
    });
    // Select filtro
    if (cajaEls.filterAccount) {
      const cur = cajaEls.filterAccount.value;
      cajaEls.filterAccount.innerHTML = '<option value="all">Todas las cuentas</option>' +
        accs.map((a) => '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>').join("");
      if (cur) cajaEls.filterAccount.value = cur;
    }
  }

  async function loadCaja() {
    try {
      cajaState.accounts = await api("/api/admin/caja");
      cajaRenderAccounts();
      cajaFillSelects();
      await loadCajaMovements();
    } catch (e) {
      if (cajaEls.accountsWrap) cajaEls.accountsWrap.innerHTML = '<p class="muted">Error cargando caja.</p>';
    }
  }

  async function loadCajaMovements() {
    if (!cajaEls.movTbody) return;
    cajaEls.movTbody.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
    try {
      const acc  = cajaEls.filterAccount  ? cajaEls.filterAccount.value  : "all";
      const from = cajaEls.filterFrom     ? cajaEls.filterFrom.value     : "";
      const to   = cajaEls.filterTo       ? cajaEls.filterTo.value       : "";
      const qs   = [
        acc !== "all" ? "account_id=" + acc : "",
        from ? "from=" + from : "",
        to   ? "to="   + to   : "",
      ].filter(Boolean).join("&");
      const rows = await api("/api/admin/caja/movements" + (qs ? "?" + qs : ""));

      let totIn = 0, totOut = 0;
      const TYPE_LABEL = { ingreso:"▲ Ingreso", egreso:"▼ Egreso" };
      const TYPE_CLS   = { ingreso:"caja-mov-in", egreso:"caja-mov-out" };

      if (!rows.length) {
        cajaEls.movTbody.innerHTML = '<tr><td colspan="6" class="muted">Sin movimientos</td></tr>';
      } else {
        cajaEls.movTbody.innerHTML = rows.map((r) => {
          if (r.type === "ingreso") totIn  += Number(r.amount) || 0;
          else                      totOut += Number(r.amount) || 0;
          const isTransfer = r.source === "transferencia";
          let descHtml = escapeHtml(r.description || "—");
          if (isTransfer && r.counterpart_name) {
            descHtml += ' <span class="muted small">(⇄ ' + escapeHtml(r.counterpart_name) + ')</span>';
          }
          const dateStr = (r.movement_date || "").slice(0, 10).split("-").reverse().join("/");
          const typeLbl = isTransfer ? (r.type === "ingreso" ? "⇄ Entrada" : "⇄ Salida") : (TYPE_LABEL[r.type] || r.type);
          const typeCls = TYPE_CLS[r.type] || "";
          return "<tr>" +
            "<td class=\"muted small\">" + dateStr + "</td>" +
            "<td>" + escapeHtml(r.account_name) + "</td>" +
            "<td>" + descHtml + "</td>" +
            "<td><span class=\"" + typeCls + "\">" + typeLbl + "</span></td>" +
            "<td class=\"num " + typeCls + "\">" + cajaFmt(r.amount) + "</td>" +
            "<td><button class=\"btn btn-small\" data-caja-del=\"" + r.id + "\" type=\"button\" title=\"Eliminar\">✕</button></td>" +
            "</tr>";
        }).join("");
      }
      if (cajaEls.movSummary) {
        cajaEls.movSummary.textContent = "Ingresos: " + cajaFmt(totIn) + "  |  Egresos: " + cajaFmt(totOut) + "  |  Neto: " + cajaFmt(totIn - totOut);
      }
    } catch (e) {
      cajaEls.movTbody.innerHTML = '<tr><td colspan="6" class="muted">Error cargando movimientos.</td></tr>';
    }
  }

  // Toggle ingreso/egreso/transferencia
  if (cajaEls.typeBtns) {
    cajaEls.typeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        cajaEls.typeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        cajaState.movType = btn.dataset.type;
        if (cajaEls.movDestWrap) cajaEls.movDestWrap.hidden = (cajaState.movType !== "transferencia");
      });
    });
  }

  // Fecha default hoy
  if (cajaEls.movDate) cajaEls.movDate.value = cajaTodayIso();

  // Guardar movimiento
  if (cajaEls.movSaveBtn) {
    cajaEls.movSaveBtn.addEventListener("click", async () => {
      const amount = Number(cajaEls.movAmount ? cajaEls.movAmount.value : 0);
      if (!amount || amount <= 0) { alert("Ingresá un monto mayor a 0."); return; }
      const body = {
        account_id:             cajaEls.movAccount    ? Number(cajaEls.movAccount.value)    : null,
        type:                   cajaState.movType,
        amount,
        description:            cajaEls.movDesc       ? cajaEls.movDesc.value.trim()        : "",
        movement_date:          cajaEls.movDate       ? cajaEls.movDate.value               : cajaTodayIso(),
        counterpart_account_id: cajaState.movType === "transferencia" && cajaEls.movCounterpart
                                  ? Number(cajaEls.movCounterpart.value) : null,
      };
      try {
        cajaEls.movSaveBtn.disabled = true;
        await api("/api/admin/caja/movements", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
        if (cajaEls.movAmount)  cajaEls.movAmount.value = "";
        if (cajaEls.movDesc)    cajaEls.movDesc.value   = "";
        showToast("Movimiento registrado");
        await loadCaja(); // refresca saldos + tabla
      } catch (e) {
        alert(e.message || "Error al guardar");
      } finally {
        cajaEls.movSaveBtn.disabled = false;
      }
    });
  }

  // Filtrar movimientos
  if (cajaEls.filterBtn) cajaEls.filterBtn.addEventListener("click", loadCajaMovements);

  // Delete movimiento
  const cajaTbodyEl = document.getElementById("caja-mov-tbody");
  if (cajaTbodyEl) {
    cajaTbodyEl.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-caja-del]");
      if (!btn) return;
      if (!confirm("¿Eliminar este movimiento?")) return;
      try {
        await api("/api/admin/caja/movements/" + btn.dataset.cajaDel, { method:"DELETE" });
        showToast("Movimiento eliminado");
        await loadCaja();
      } catch (err) { alert(err.message || "Error"); }
    });
  }

  // Nueva cuenta
  if (cajaEls.addAccountBtn) {
    cajaEls.addAccountBtn.addEventListener("click", () => {
      if (cajaEls.newAccountForm) cajaEls.newAccountForm.hidden = false;
      if (cajaEls.accName) cajaEls.accName.focus();
    });
  }
  if (cajaEls.accCancelBtn) {
    cajaEls.accCancelBtn.addEventListener("click", () => {
      if (cajaEls.newAccountForm) cajaEls.newAccountForm.hidden = true;
    });
  }
  if (cajaEls.accSaveBtn) {
    cajaEls.accSaveBtn.addEventListener("click", async () => {
      const name = cajaEls.accName ? cajaEls.accName.value.trim() : "";
      const type = cajaEls.accType ? cajaEls.accType.value : "efectivo";
      if (!name) { alert("Ingresá un nombre para la cuenta."); return; }
      try {
        await api("/api/admin/caja/accounts", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ name, type }) });
        if (cajaEls.accName) cajaEls.accName.value = "";
        if (cajaEls.newAccountForm) cajaEls.newAccountForm.hidden = true;
        showToast("Cuenta creada");
        await loadCaja();
      } catch (e) { alert(e.message || "Error"); }
    });
  }

  // ─────── Handler de tab Ventas (facturados) ───────
  els.tabBtns.forEach((btn) => {
    if (btn.dataset.tab === "ventas") {
      btn.addEventListener("click", async () => {
        if (!bState.loaded) { await loadBudgets(); }
        renderVentas();
      });
    }
  });

  // ─────── Fin PRESUPUESTOS / VENTAS ───────

  bootstrap();
})();
