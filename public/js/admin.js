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
    userCatsMsg: document.getElementById("user-cats-msg"),
    userCatsSave: document.getElementById("user-cats-save"),

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
    // Todos los productos (cache para el buscador de compras)
    allProducts: [],
    allProductsLoaded: false,
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
      alert("Acceso denegado. Solo el admin puede usar esta funcion.");
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
      els.userInfo.textContent = (me.fullName || me.username) + " - " + me.levelName;
      // Nombre dinamico de la app
      if (me.app_name) {
        const brandEl = document.getElementById("topbar-brand-name");
        if (brandEl) brandEl.textContent = me.app_name + " · Admin";
        document.getElementById("page-title").textContent = me.app_name + " · Admin";
      }
      // Ocultar tabs exclusivos del admin si el usuario es vendedor
      if (!state.isAdmin) {
        document.querySelectorAll(".admin-only").forEach((el) => { el.style.display = "none"; });
        // Vendedor: ir directo a Pedidos y ocultar cosas que no necesita
        const pedBtn = Array.from(els.tabBtns).find((b) => b.dataset.tab === "pedidos");
        if (pedBtn) pedBtn.click();
      }
      applyFilters();
    } catch (e) {
      console.error(e);
      els.prodTbody.innerHTML = '<tr><td colspan="12" class="muted">Error cargando productos</td></tr>';
    }
    // En paralelo, chequear dbinfo (no bloqueamos el render principal por esto)
    checkDbInfo();
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

  // ---------- tabs ----------
  els.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const tab = btn.dataset.tab;
      els.tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      els.panels.forEach((p) => { p.hidden = p.id !== "tab-" + tab; });
      if (tab === "pedidos" && !state.ordersLoaded) loadOrders();
      if (tab === "config" && !state.settingsLoaded) loadSettings();
      if (tab === "usuarios" && !state.usersLoaded) loadUsers();
      if (tab === "vendedores" && !state.vendedoresLoaded) loadVendedores();
      if (tab === "entregas" && !state.entregasLoaded) loadEntregas();
      if (tab === "proveedores" && !state.suppliersLoaded) loadSuppliers();
      if (tab === "compras" && !state.purchasesLoaded) loadPurchases();
      if (tab === "pagos" && !state.paymentsLoaded) loadPayments();
      if (tab === "cuentas" && !state.accountsLoaded) loadAccounts();
    });
  });

  // ---------- Usuarios ----------
  async function loadUsers() {
    try {
      els.userTbody.innerHTML = '<tr><td colspan="9" class="muted">Cargando…</td></tr>';
      state.users = await api("/api/admin/users");
      state.usersLoaded = true;
      // Cargar todas las categorias en cache para el modal de permisos
      if (!state.allCategories.length) {
        try { state.allCategories = await api("/api/categories"); } catch (_) {}
      }
      renderUsers();
    } catch (e) {
      els.userTbody.innerHTML = '<tr><td colspan="9" class="muted">Error cargando usuarios</td></tr>';
    }
  }

  function renderUsers() {
    const q = els.userSearch.value.trim().toLowerCase();
    let list = state.users;
    if (q) {
      list = list.filter((u) =>
        (u.username || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    }
    els.userCount.textContent = list.length + (list.length === 1 ? " usuario" : " usuarios");
    if (!list.length) {
      els.userTbody.innerHTML = '<tr><td colspan="9" class="muted">Sin resultados</td></tr>';
      return;
    }
    els.userTbody.innerHTML = list.map(userRowHtml).join("");
  }

  function userRowHtml(u) {
    const isMe = state.me && state.me.id === u.id;
    const levelOpts = Object.entries(LEVEL_NAMES).map(([v, n]) =>
      '<option value="' + v + '"' + (Number(v) === u.level ? " selected" : "") + '>' + n + '</option>'
    ).join("");
    const lastLogin = u.last_login_at ? formatDate(u.last_login_at) : "—";
    return '<tr data-id="' + u.id + '"' + (u.active ? '' : ' class="row-inactive"') + '>' +
      '<td class="cell-code">' + escapeHtml(u.username) + (isMe ? ' <span class="muted">(vos)</span>' : '') + '</td>' +
      '<td><input class="cell-input" data-field="full_name" value="' + escapeHtml(u.full_name || "") + '" /></td>' +
      '<td>' +
        '<select class="cell-input cell-level" data-field="level"' + (isMe ? ' title="No podés bajarte de admin a vos mismo"' : '') + '>' + levelOpts + '</select>' +
      '</td>' +
      '<td><input class="cell-input" data-field="phone" value="' + escapeHtml(u.phone || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="whatsapp_number" type="tel" placeholder="ej: 5491112345678" value="' + escapeHtml(u.whatsapp_number || "") + '" /></td>' +
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
        return '<label class="cfg-check cats-check">' +
          '<input type="checkbox" data-cat-id="' + c.id + '"' + checked + ' /> ' +
          escapeHtml(c.name) +
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
      if (els.vendTbody) els.vendTbody.innerHTML = '<tr><td colspan="9" class="muted">Cargando…</td></tr>';
      state.vendedores = await api("/api/admin/vendedores");
      state.vendedoresLoaded = true;
      renderVendedores();
    } catch (e) {
      if (els.vendTbody) els.vendTbody.innerHTML = '<tr><td colspan="9" class="muted">Error cargando vendedores</td></tr>';
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
      els.vendTbody.innerHTML = '<tr><td colspan="9" class="muted">Sin resultados</td></tr>';
      return;
    }
    els.vendTbody.innerHTML = list.map(vendRowHtml).join("");
  }

  function vendRowHtml(v) {
    const lastLogin = v.last_login_at ? formatDate(v.last_login_at) : "—";
    const plOpts = [1, 2, 3, 4].map((n) =>
      '<option value="' + n + '"' + (Number(v.vendedor_price_level) === n ? " selected" : "") + '>' + PRICE_LEVEL_NAMES[n] + '</option>'
    ).join("");
    return '<tr data-id="' + v.id + '"' + (v.active ? '' : ' class="row-inactive"') + '>' +
      '<td class="cell-code">' + escapeHtml(v.username) + '</td>' +
      '<td><input class="cell-input" data-field="full_name" value="' + escapeHtml(v.full_name || "") + '" /></td>' +
      '<td><input class="cell-input" data-field="phone" value="' + escapeHtml(v.phone || "") + '" /></td>' +
      '<td>' +
        '<select class="cell-input" data-field="vendedor_price_level">' + plOpts + '</select>' +
      '</td>' +
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

  // Mostrar/ocultar campo de lista de precios al seleccionar nivel Vendedor
  const userCreateLevel = document.getElementById("user-create-level");
  const userCreateVendRow = document.getElementById("user-create-vend-row");
  if (userCreateLevel && userCreateVendRow) {
    userCreateLevel.addEventListener("change", () => {
      userCreateVendRow.style.display = userCreateLevel.value === "5" ? "" : "none";
    });
  }

  // Crear usuario
  els.userCreateBtn.addEventListener("click", () => {
    els.userCreateForm.reset();
    els.userCreateMsg.textContent = "";
    if (userCreateVendRow) userCreateVendRow.style.display = "none";
    els.userCreateModal.hidden = false;
    setTimeout(() => els.userCreateForm.querySelector('[name="username"]').focus(), 50);
  });

  els.userCreateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(els.userCreateForm);
    const level = Number(fd.get("level"));
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
      // Si es vendedor, guardar también el nivel de precio
      if (level === 5) {
        const vpl = Number(fd.get("vendedor_price_level")) || 1;
        if (vpl !== 1) {
          try {
            await api("/api/admin/users/" + out.user.id, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vendedor_price_level: vpl }),
            });
          } catch (_) {}
        }
        // Refrescar la lista de vendedores también
        state.vendedoresLoaded = false;
      }
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

  // Cerrar modales con [data-close] o click en overlay o Escape
  document.querySelectorAll(".admin-modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.matches("[data-close]")) {
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
        if (brandEl) brandEl.textContent = out.app_name + " · Admin";
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
      els.prodTbody.innerHTML = '<tr><td colspan="12" class="muted">Sin resultados</td></tr>';
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

  function rowHtml(p) {
    const imgSrc = p.image_url ? escapeHtml(p.image_url) : "";
    const imgThumb = imgSrc
      ? '<img src="' + imgSrc + '" alt="" class="prod-thumb" />'
      : '<span class="prod-thumb-empty" title="Sin imagen">📷</span>';
    return '<tr data-id="' + p.id + '"' + (p.stock <= 0 ? ' class="row-oos"' : '') + (p.active ? '' : ' class="row-inactive"') + '>' +
      '<td class="col-img"><button class="prod-img-btn" type="button" data-act="edit-img" data-id="' + p.id + '" data-name="' + escapeHtml(p.name) + '" title="Ver / cambiar imagen">' + imgThumb + '</button></td>' +
      '<td class="cell-code">' + escapeHtml(p.code || "") + '</td>' +
      '<td><input class="cell-input cell-name" data-field="name" value="' + escapeHtml(p.name) + '" /></td>' +
      '<td class="cell-cat muted">' + escapeHtml(p.category_name || "") + '</td>' +
      '<td class="num"><input type="number" min="0" class="cell-input cell-num" data-field="stock" value="' + (p.stock || 0) + '" /></td>' +
      '<td class="num"><input type="number" min="0" class="cell-input cell-num" data-field="cost" value="' + (p.cost || 0) + '" /></td>' +
      '<td class="num"><input type="number" min="0" class="cell-input cell-num cell-price" data-field="price_minorista" value="' + (p.price_minorista || 0) + '" /></td>' +
      '<td class="num"><input type="number" min="0" class="cell-input cell-num cell-price" data-field="price_revendedor" value="' + (p.price_revendedor || 0) + '" /></td>' +
      '<td class="num"><input type="number" min="0" class="cell-input cell-num cell-price" data-field="price_mayorista" value="' + (p.price_mayorista || 0) + '" /></td>' +
      '<td class="num"><input type="number" min="0" class="cell-input cell-num cell-price" data-field="price_vip" value="' + (p.price_vip || 0) + '" /></td>' +
      '<td class="num"><input type="number" min="0" class="cell-input cell-num cell-price" data-field="price_publico" value="' + (p.price_publico || 0) + '" /></td>' +
      '<td><label class="cell-toggle"><input type="checkbox" data-field="active"' + (p.active ? " checked" : "") + ' /><span></span></label></td>' +
    '</tr>';
  }

  // Auto-save al cambiar un input. Usamos 'change' (dispara al perder foco
  // o al togglear el checkbox) en lugar de 'input' para no llamar al server
  // en cada tecleo.
  els.prodTbody.addEventListener("change", async (e) => {
    const inp = e.target.closest("[data-field]");
    if (!inp) return;
    const tr = inp.closest("tr");
    if (!tr) return;
    const id = Number(tr.dataset.id);
    const field = inp.dataset.field;
    let value;
    if (inp.type === "checkbox") value = inp.checked ? 1 : 0;
    else if (inp.type === "number") value = Number(inp.value) || 0;
    else value = inp.value;

    inp.classList.add("saving");
    try {
      await api("/api/admin/products/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      // Reflejar en el state local sin re-renderizar la tabla entera
      const p = state.products.find((x) => x.id === id);
      if (p) p[field] = inp.type === "checkbox" ? (value ? 1 : 0) : value;
      inp.classList.remove("saving");
      inp.classList.add("saved");
      setTimeout(() => inp.classList.remove("saved"), 1200);
      // Si toggleamos active y el filtro de inactivos esta puesto, refiltrar
      if (field === "active" && els.filterInactive.checked) applyFilters();
    } catch (err) {
      inp.classList.remove("saving");
      inp.classList.add("error");
      showToast("Error al guardar: " + err.message, "err");
      setTimeout(() => inp.classList.remove("error"), 2000);
    }
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
          showToast("Estado actualizado");
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
              transferencia_amount: orderObj.tra