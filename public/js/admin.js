/**
 * Maxaria - Panel admin
 * Tabs: Productos (editable), Pedidos (lista de todos).
 * Usuarios y Graficos vienen en commits siguientes.
 */
(function () {
  "use strict";

  const PAGE_SIZE = 50;
  const LS_KEY = "maxaria.admin.products.prefs";

  // ── Estados del circuito de pedidos: ÚNICA fuente de labels y clases ──
  // Antes había 5 mapas locales duplicados con nombres divergentes
  // ("Listo" vs "Listo para entregar", "Preparando" vs "En armado").
  // Canónico: mismo texto que el remito del server y la pestaña Armado.
  const ORDER_STATUS_LABELS = {
    pendiente: "Pendiente", enviado: "Enviado", preparando: "En armado",
    listo: "Listo para entregar", entregado: "Entregado", cancelado: "Cancelado",
  };
  const ORDER_STATUS_TAGCLS = {
    pendiente: "tag-pendiente", enviado: "tag-enviado", preparando: "tag-preparando",
    listo: "tag-listo", entregado: "tag-entregado", cancelado: "tag-cancelado",
  };
  function orderStatusLabel(s) { return ORDER_STATUS_LABELS[s] || s || ""; }

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
    filterState: document.getElementById("filter-state"),
    filterClear: document.getElementById("filter-clear"),
    prodCount: document.getElementById("prod-count"),
    prodTbody: document.getElementById("prod-tbody"),
    pagePrev: document.getElementById("page-prev"),
    pageNext: document.getElementById("page-next"),
    pageInfo: document.getElementById("page-info"),
    excelFile: document.getElementById("excel-file"),
    prodTable: document.getElementById("prod-table"),
    prodHeaders: document.querySelectorAll('#prod-table thead th.sortable'),
    selectBtn:  document.getElementById("prod-select-btn"),
    selBar:     document.getElementById("prod-sel-bar"),
    selCount:   document.getElementById("prod-sel-count"),
    selOnly:    document.getElementById("prod-sel-only"),
    selClear:   document.getElementById("prod-sel-clear"),
    selEdit:    document.getElementById("prod-sel-edit"),
    selCosts:   document.getElementById("prod-sel-costs"),
    selCancel:  document.getElementById("prod-sel-cancel"),
    pbmModal:   document.getElementById("prod-bulk-modal"),
    pbmCount:   document.getElementById("pbm-count"),
    pbmMsg:     document.getElementById("pbm-msg"),
    pbmApply:   document.getElementById("pbm-apply"),
    pbmCancel:  document.getElementById("pbm-cancel"),
    pbmCat:     document.getElementById("pbm-cat"),

    // Pedidos
    ordersSearch: document.getElementById("orders-search"),
    ordersClientFilter: document.getElementById("orders-client-filter"),
    ordersStatusFilter: document.getElementById("orders-status-filter"),
    ordersCount: document.getElementById("orders-count"),
    ordersList: document.getElementById("orders-list"),
    ventasTbody: document.getElementById("ventas-tbody"),
    ventasSummary: document.getElementById("ventas-summary"),
    ventasCount: document.getElementById("ventas-count"),
    ventasReload: document.getElementById("ventas-reload"),
    ventasSearch: document.getElementById("ventas-search"),
    ventasClient: document.getElementById("ventas-client"),
    ventasPaid: document.getElementById("ventas-paid"),
    ventasRange: document.getElementById("ventas-range"),
    ventasFrom: document.getElementById("ventas-from"),
    ventasTo: document.getElementById("ventas-to"),
    ventasClearDates: document.getElementById("ventas-clear-dates"),
    orderDetailModal: document.getElementById("order-detail-modal"),
    orderDetailBody: document.getElementById("order-detail-body"),
    orderDetailTitle: document.getElementById("order-detail-title"),
    armadoList: document.getElementById("armado-list"),
    armadoCount: document.getElementById("armado-count"),
    armadoReload: document.getElementById("armado-reload"),
    entQueue: document.getElementById("ent-queue"),
    entQueueCount: document.getElementById("ent-queue-count"),
    entQueueReload: document.getElementById("ent-queue-reload"),

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
    userThead: document.getElementById("user-thead"),
    userSortReset: document.getElementById("user-sort-reset"),
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
    // Modal editar cliente (doble click en la fila)
    userEditModal: document.getElementById("user-edit-modal"),
    userEditForm: document.getElementById("user-edit-form"),
    userEditMsg: document.getElementById("user-edit-msg"),
    ueUsername: document.getElementById("ue-username"),
    ueUsernameText: document.getElementById("ue-username-text"),
    ueUsernameEdit: document.getElementById("ue-username-edit"),
    uePasswordText: document.getElementById("ue-password-text"),
    ueFullName: document.getElementById("ue-full-name"),
    uePricecfg: document.getElementById("ue-pricecfg"),
    ueVendedor: document.getElementById("ue-vendedor"),
    uePhone: document.getElementById("ue-phone"),
    ueWhatsapp: document.getElementById("ue-whatsapp"),
    ueEmail: document.getElementById("ue-email"),
    ueActive: document.getElementById("ue-active"),
    ueResetBtn: document.getElementById("ue-reset-btn"),
    ueCatsBtn: document.getElementById("ue-cats-btn"),
    ueShareBtn: document.getElementById("ue-share-btn"),
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
    actRkPeriodInfo: document.getElementById("act-rk-periodinfo"),
    actRkPeriods: document.querySelector(".act-rk-periods"),
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
    deliveryAdminBox: document.getElementById("delivery-admin-box"),
    deliveryDiscountType: document.getElementById("delivery-discount-type"),
    deliveryDiscountValue: document.getElementById("delivery-discount-value"),
    deliverySummary: document.getElementById("delivery-summary"),

    // Proveedores
    supSearch: document.getElementById("sup-search"),
    supCount: document.getElementById("sup-count"),
    supTbody: document.getElementById("sup-tbody"),
    supCreateBtn: document.getElementById("sup-create-btn"),
    supplierCreateModal: document.getElementById("supplier-create-modal"),
    supplierCreateForm: document.getElementById("supplier-create-form"),
    supplierCreateMsg: document.getElementById("supplier-create-msg"),

    purAddSupBtn: document.getElementById("pur-add-sup-btn"),

    // Cotizaciones (pedidos de cotización)
    pcotCreateBtn: document.getElementById("pcot-create-btn"),
    pcotCreateModal: document.getElementById("pcot-create-modal"),
    pcotModalTitle: document.getElementById("pcot-modal-title"),
    pcotTbody: document.getElementById("pcot-tbody"),
    pcotCount: document.getElementById("pcot-count"),
    pcotSupFilter: document.getElementById("pcot-sup-filter"),
    pcotStatusFilter: document.getElementById("pcot-status-filter"),
    pcotFormSupplier: document.getElementById("pcot-form-supplier"),
    pcotFormStatus: document.getElementById("pcot-form-status"),
    pcotFormNotes: document.getElementById("pcot-form-notes"),
    pcotItemsTbody: document.getElementById("pcot-items-tbody"),
    pcotAddBtn: document.getElementById("pcot-add-btn"),
    pcotSaveBtn: document.getElementById("pcot-save-btn"),
    pcotCancelBtn: document.getElementById("pcot-cancel-btn"),
    pcotConvertBtn: document.getElementById("pcot-convert-btn"),
    pcotExportBtn: document.getElementById("pcot-export-btn"),
    pcotExportModal: document.getElementById("pcot-export-modal"),
    pcotExportUnitsBtn: document.getElementById("pcot-export-units-btn"),
    pcotExportBultosBtn: document.getElementById("pcot-export-bultos-btn"),
    pcotExportCancelBtn: document.getElementById("pcot-export-cancel-btn"),
    pcotItemsTfoot: document.getElementById("pcot-items-tfoot"),
    pcotTotalDisp: document.getElementById("pcot-total-disp"),
    pcotCreateMsg: document.getElementById("pcot-create-msg"),
    pcotPickerModal: document.getElementById("pcot-picker-modal"),
    pcotPickerSearch: document.getElementById("pcot-picker-search"),
    pcotPickerAll: document.getElementById("pcot-picker-all"),
    pcotPickerTbody: document.getElementById("pcot-picker-tbody"),
    pcotPickerCount: document.getElementById("pcot-picker-count"),
    pcotPickerConfirm: document.getElementById("pcot-picker-confirm"),
    pcotPickerCancel: document.getElementById("pcot-picker-cancel"),
    pcotPickerNew: document.getElementById("pcot-picker-new"),
    pcotPickerCat: document.getElementById("pcot-picker-cat"),
    pcotAddSupBtn: document.getElementById("pcot-add-sup-btn"),
    // Compras
    purSupFilter: document.getElementById("pur-sup-filter"),
    purMonthFilter: document.getElementById("pur-month-filter"),
    purCount: document.getElementById("pur-count"),
    purTfoot: document.getElementById("pur-tfoot"),
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
    purPickerNew: document.getElementById("pur-picker-new"),
    // Picker de productos para editar un pedido (mismo sistema que presupuestos)
    oiePickerModal: document.getElementById("oie-picker-modal"),
    oiePickerSearch: document.getElementById("oie-picker-search"),
    oiePickerAll: document.getElementById("oie-picker-all"),
    oiePickerTbody: document.getElementById("oie-picker-tbody"),
    oiePickerCount: document.getElementById("oie-picker-count"),
    oiePickerConfirm: document.getElementById("oie-picker-confirm"),
    oiePickerCancel: document.getElementById("oie-picker-cancel"),
    oiePickerShowNoStock: document.getElementById("oie-picker-show-nostock"),

    // Modal crear pedido desde admin
    newOrderBtn:    document.getElementById("new-order-btn"),
    newOrderModal:  document.getElementById("new-order-modal"),
    noClient:       document.getElementById("no-client"),
    noNewClientBtn: document.getElementById("no-new-client-btn"),
    noClientCreateModal: document.getElementById("no-client-create-modal"),
    noClientCreateForm:  document.getElementById("no-client-create-form"),
    noClientCreateMsg:   document.getElementById("no-client-create-msg"),
    noPriceList:    document.getElementById("no-price-list"),
    noStatus:       document.getElementById("no-status"),
    noAddBtn:       document.getElementById("no-add-btn"),
    noItemsTbody:   document.getElementById("no-items-tbody"),
    noDiscBar:      document.getElementById("no-disc-bar"),
    noTotalDisp:    document.getElementById("no-total-disp"),
    noNotes:        document.getElementById("no-notes"),
    noSaveBtn:      document.getElementById("no-save-btn"),

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
    payFormDiscount: document.getElementById("pay-form-discount"),
    payFormDiscountType: document.getElementById("pay-form-discount-type"),
    payFormDiscountValue: document.getElementById("pay-form-discount-value"),
    payFormDiscountHint: document.getElementById("pay-form-discount-hint"),
    payFormSplit: document.getElementById("pay-form-split"),

    // Cuentas corrientes
    accSearch: document.getElementById("acc-search"),
    accCount: document.getElementById("acc-count"),
    accTbody: document.getElementById("acc-tbody"),
    accReloadBtn: document.getElementById("acc-reload-btn"),
    accKpis: document.getElementById("acc-kpis"),
    accOnlyDebtors: document.getElementById("acc-only-debtors"),
    accExportBtn: document.getElementById("acc-export-btn"),
    accTable: document.getElementById("acc-table"),

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
    catalogMsg: document.getElementById("catalog-msg"),
    catalogGenerateBtn: document.getElementById("catalog-generate-btn"),
    catalogShareBtn: document.getElementById("catalog-share-btn"),

    toast: document.getElementById("toast"),
  };

  const state = {
    me: null,
    products: [],         // lista completa (todos los productos, sin filtrar)
    productsFiltered: [], // lista despues de aplicar busqueda + filtros
    page: 0,
    selectMode: false,    // modo selección múltiple (checks por fila)
    selectedIds: new Set(), // ids de productos tildados (sobrevive paginación/filtro)
    showOnlySelected: false, // ver solo los seleccionados en la tabla
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
    orderClients: [],            // Cache de clientes activos para el selector "Cliente" del detalle de pedido
    orderClientsLoaded: false,
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
    supplierCreatedFromCotizacion: false,
    cotizaciones: [],
    cotizacionesLoaded: false,
    cotizacionItems: [],       // items del modal de creación
    cotPickerSelected: new Map(), // product_id -> {qty, product}
    editingCotizacionId: null, // null = nueva, número = editar existente
    purchases: [],
    purchasesLoaded: false,
    payments: [],
    paymentsLoaded: false,
    accounts: [],
    accountsLoaded: false,
    accSortKey: "balance",
    accSortDir: "asc",
    accOnlyDebtors: false,
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
    // Orden tipo Excel de la tabla de Usuarios. El primero es la clave principal;
    // los siguientes son desempates (se mantiene el orden previo). Default: nombre asc.
    userSort: [{ key: "name", dir: "asc" }],
  };

  const LEVEL_NAMES = {
    1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP", 5: "Vendedor", 99: "Administrador",
  };

  const PRICE_LEVEL_NAMES = {
    1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP",
  };

  // ---------- helpers ----------
  // OJO: fmtPrice vive UNA sola vez, en los helpers de formato de los modales
  // de producto (buscar "HELPERS DE FORMATO DE PRECIO"). Acá había una segunda
  // declaración que el hoisting dejaba muerta y confundía los formatos.
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
  function formatDate(s) {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }
  // Solo el día (dd/mm/aaaa), en horario LOCAL. Para tablas compactas.
  // No usar slice(0,10) sobre el timestamp: es el día UTC, no el local.
  function formatDateDay(s) {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
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
        estado: els.filterState.value,
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
    if (p.estado && els.filterState.querySelector('[value="' + p.estado + '"]')) {
      els.filterState.value = p.estado;
    } else if (typeof p.inactive === "boolean" && p.inactive) {
      els.filterState.value = "inactive"; // compat con prefs viejas
    }
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

  // Modal de confirmación propio (reemplaza al confirm()/alert() nativos, que
  // muestran el dominio "...railway.app dice" y botones que no se pueden editar).
  // Acepta un string (= mensaje) o un objeto { title, message, confirmText,
  // cancelText, danger, alert }. Devuelve Promise<boolean>. Con alert:true se
  // oculta el botón Cancelar (sirve de aviso). Maneja su propio cierre
  // (Escape/Enter/overlay) en fase de captura, así no dispara el handler global
  // de Escape que cerraría el modal de abajo. Fallback a confirm()/alert()
  // nativos si el HTML del modal no está presente.
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
        cancelBtn.hidden = false; // restaurar para el próximo uso
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

  // Aviso propio (un solo botón Aceptar). Reemplaza a alert(). No bloquea el
  // hilo como el alert() nativo; devuelve Promise<void> por si se quiere await.
  function alertModal(opts) {
    if (typeof opts === "string") opts = { message: opts };
    return confirmModal(Object.assign({}, opts, { alert: true }));
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
          if (tab === "administradores" || tab === "inflacion") {
            // Pestañas exclusivas del superadmin (Administradores e Inflación).
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
      els.prodTbody.innerHTML = '<tr><td colspan="14" class="muted">Error cargando productos</td></tr>';
    }
    // En paralelo, chequear dbinfo (no bloqueamos el render principal por esto).
    // Solo si el usuario puede ver Configuración (sino el endpoint da 403).
    // Usar state.me (no `me`): `me` es const dentro del try y acá estamos
    // fuera del try → referenciarlo tiraba ReferenceError y abortaba el resto
    // del bootstrap (checkDbInfo y el aviso de pedidos no llegaban a correr).
    const canConfig = !state.isAdmin ? false
      : !!(state.me && (state.me.isSuperadmin || (Array.isArray(state.me.adminSections) && state.me.adminSections.includes("config"))));
    if (canConfig) checkDbInfo();
    // Al entrar al sistema, avisar al admin cuántos pedidos hay pendientes de
    // entregar (recibidos por el catálogo/vendedores y todavía sin entregar).
    if (state.isAdmin) notifyPendingOrders();
    if (state.isAdmin) notifInit();
  }

  // ---------- Centro de notificaciones (campana del header) ----------
  // Agrega alertas de varias áreas (vencimientos, stock bajo, pedidos
  // pendientes). El contador de "no leídas" se lleva en localStorage por id
  // estable de cada alerta: al abrir el panel se marcan todas como vistas.
  const notifEls = {
    bell:    document.getElementById("notif-bell"),
    badge:   document.getElementById("notif-badge"),
    panel:   document.getElementById("notif-panel"),
    body:    document.getElementById("notif-body"),
    refresh: document.getElementById("notif-refresh"),
  };
  const notifState = { data: null, timer: null };
  const NOTIF_SEEN_KEY = "maxaria_notif_seen";

  function notifSeenSet() {
    try { return new Set(JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY) || "[]")); }
    catch (_) { return new Set(); }
  }
  function notifSaveSeen(ids) {
    try { localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify(ids.slice(-800))); } catch (_) {}
  }
  function notifAllIds(d) {
    if (!d) return [];
    return []
      .concat((d.vencimientos || []).map((x) => x.id))
      .concat((d.stock_bajo || []).map((x) => x.id))
      .concat((d.pedidos || []).map((x) => x.id));
  }
  function notifUnreadCount(d) {
    const seen = notifSeenSet();
    return notifAllIds(d).filter((id) => !seen.has(id)).length;
  }
  function notifRenderBadge() {
    if (!notifEls.badge) return;
    const n = notifUnreadCount(notifState.data);
    if (n > 0) {
      notifEls.badge.textContent = n > 99 ? "99+" : String(n);
      notifEls.badge.hidden = false;
    } else {
      notifEls.badge.hidden = true;
    }
  }

  async function notifLoad() {
    try {
      notifState.data = await api("/api/admin/notifications");
      notifRenderBadge();
      if (notifEls.panel && !notifEls.panel.hidden) notifRenderPanel();
    } catch (_) { /* silencioso */ }
  }

  const NOTIF_STATUS_PED = {
    pendiente: "Por armar", enviado: "Por armar", preparando: "En armado", listo: "Para entregar",
  };
  function notifRenderPanel() {
    if (!notifEls.body) return;
    const d = notifState.data;
    if (!d || !d.counts || d.counts.total === 0) {
      notifEls.body.innerHTML = '<p class="muted" style="padding:16px;text-align:center">Sin alertas 🎉</p>';
      return;
    }
    const seen = notifSeenSet();
    let html = "";

    if ((d.vencimientos || []).length) {
      html += '<div class="notif-group-title">⏳ Vencimientos (' + d.vencimientos.length + ")</div>";
      d.vencimientos.slice(0, 40).forEach((v) => {
        const isNew = !seen.has(v.id);
        const venc = v.status === "vencido";
        const ml = v.months_left;
        const sub = venc
          ? "Vencido (" + Math.abs(ml) + " mes" + (Math.abs(ml) === 1 ? "" : "es") + ")"
          : (ml <= 0 ? "Vence este mes" : "Vence en " + ml + " mes" + (ml === 1 ? "" : "es"));
        html += '<button type="button" class="notif-item' + (isNew ? " notif-unread" : "") +
          '" data-go="recepcion" data-purchase="' + v.purchase_id + '">' +
          '<span class="notif-dot ' + (venc ? "nd-red" : "nd-amber") + '"></span>' +
          '<span class="notif-item-main"><span class="notif-item-name">' + escapeHtml(v.product_name || "") + "</span>" +
          '<span class="notif-item-sub">' + escapeHtml(sub + " · vence " + v.expiry_label + " · stock " + v.stock) + "</span></span>" +
          '<span class="notif-pill ' + (venc ? "np-red" : "np-amber") + '">' + v.expiry_label + "</span>" +
          "</button>";
      });
    }

    if ((d.stock_bajo || []).length) {
      html += '<div class="notif-group-title">📉 Stock bajo (' + d.stock_bajo.length + ")</div>";
      d.stock_bajo.slice(0, 40).forEach((s) => {
        const isNew = !seen.has(s.id);
        const out = s.status === "sin_stock";
        html += '<button type="button" class="notif-item' + (isNew ? " notif-unread" : "") +
          '" data-go="productos" data-search="' + escapeHtml(s.product_code || "") + '">' +
          '<span class="notif-dot ' + (out ? "nd-red" : "nd-amber") + '"></span>' +
          '<span class="notif-item-main"><span class="notif-item-name">' + escapeHtml(s.product_name || "") + "</span>" +
          '<span class="notif-item-sub">' + escapeHtml((out ? "Sin stock" : "Stock " + s.stock) + " · mínimo " + s.stock_min) + "</span></span>" +
          '<span class="notif-pill ' + (out ? "np-red" : "np-amber") + '">' + s.stock + "/" + s.stock_min + "</span>" +
          "</button>";
      });
    }

    if ((d.pedidos || []).length) {
      html += '<div class="notif-group-title">📦 Pedidos pendientes (' + d.pedidos.length + ")</div>";
      d.pedidos.slice(0, 40).forEach((o) => {
        const isNew = !seen.has(o.id);
        const goTab = o.status === "listo" ? "entregas" : (o.status === "preparando" ? "armado" : "pedidos");
        html += '<button type="button" class="notif-item' + (isNew ? " notif-unread" : "") +
          '" data-go="' + goTab + '">' +
          '<span class="notif-dot nd-blue"></span>' +
          '<span class="notif-item-main"><span class="notif-item-name">Pedido #' + o.order_id + " · " + escapeHtml(o.client_name || "") + "</span>" +
          '<span class="notif-item-sub">' + escapeHtml(NOTIF_STATUS_PED[o.status] || o.status) + "</span></span>" +
          '<span class="notif-pill np-blue">' + escapeHtml(NOTIF_STATUS_PED[o.status] || o.status) + "</span>" +
          "</button>";
      });
    }

    notifEls.body.innerHTML = html;
  }

  function notifOpen() {
    if (!notifEls.panel) return;
    notifRenderPanel();
    notifEls.panel.hidden = false;
    // Marcar todo lo actual como visto → el badge baja a 0.
    notifSaveSeen(notifAllIds(notifState.data));
    notifRenderBadge();
  }
  function notifClose() { if (notifEls.panel) notifEls.panel.hidden = true; }

  function notifInit() {
    if (!notifEls.bell) return;
    notifLoad();
    notifEls.bell.addEventListener("click", (e) => {
      e.stopPropagation();
      if (notifEls.panel.hidden) notifOpen(); else notifClose();
    });
    if (notifEls.refresh) notifEls.refresh.addEventListener("click", (e) => { e.stopPropagation(); notifLoad(); });
    // Navegar a la sección al clickear una alerta.
    if (notifEls.body) notifEls.body.addEventListener("click", (e) => {
      const item = e.target.closest(".notif-item");
      if (!item) return;
      const tab = item.dataset.go;
      const btn = Array.from(els.tabBtns).find((b) => b.dataset.tab === tab);
      notifClose();
      if (btn && btn.style.display !== "none" && !btn.hidden) btn.click();
      // Filtrar productos por código (stock bajo) cuando se navega a Productos.
      if (tab === "productos" && item.dataset.search && els.prodSearch) {
        els.prodSearch.value = item.dataset.search;
        if (typeof applyFilters === "function") applyFilters();
      }
      // Abrir directo el modal de recepción de esa compra (vencimientos).
      if (tab === "recepcion" && item.dataset.purchase && typeof openRecvModal === "function") {
        setTimeout(() => { try { openRecvModal(Number(item.dataset.purchase)); } catch (_) {} }, 150);
      }
    });
    // Cerrar al clickear afuera.
    document.addEventListener("click", (e) => {
      if (notifEls.panel.hidden) return;
      if (e.target.closest(".notif-wrap")) return;
      notifClose();
    });
    // Refrescar el badge cada 90s.
    if (notifState.timer) clearInterval(notifState.timer);
    notifState.timer = setInterval(notifLoad, 90000);
  }

  // ---------- Notificación de pedidos pendientes (al ingresar) ----------
  async function notifyPendingOrders() {
    // Mostrar una sola vez por sesión del navegador (no en cada cambio de tab).
    try { if (sessionStorage.getItem("maxaria_orders_notified") === "1") return; } catch (_) {}
    try {
      const d = await api("/api/admin/dashboard");
      try { sessionStorage.setItem("maxaria_orders_notified", "1"); } catch (_) {}
      const active = Array.isArray(d.activeOrders) ? d.activeOrders : [];
      const total = active.reduce((s, r) => s + (Number(r.cnt) || 0), 0);
      if (total > 0) showOrdersNotice(total);
    } catch (_) { /* silencioso: es solo un aviso */ }
  }

  function showOrdersNotice(total) {
    let el = document.getElementById("orders-notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "orders-notice";
      el.className = "orders-notice";
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("orders-notice-x")) { el.remove(); return; }
        const pedBtn = Array.from(els.tabBtns).find((b) => b.dataset.tab === "pedidos");
        if (pedBtn) pedBtn.click();
        el.remove();
      });
      document.body.appendChild(el);
    }
    const plural = total === 1 ? "pedido pendiente" : "pedidos pendientes";
    el.innerHTML =
      '<span class="orders-notice-bell">🔔</span>' +
      '<span class="orders-notice-txt">Tenés <strong>' + total + "</strong> " + plural +
        " de entrega.<br><span class=\"orders-notice-cta\">Ver pedidos →</span></span>" +
      '<button class="orders-notice-x" type="button" aria-label="Cerrar">✕</button>';
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { if (el && el.parentNode) el.remove(); }, 12000);
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

      // Últimos pedidos (labels/clases: fuente única ORDER_STATUS_*)
      const tbody = document.getElementById("dash-recent-tbody");
      if (tbody) {
        if (!d.recentOrders || !d.recentOrders.length) {
          tbody.innerHTML = '<tr><td colspan="5" class="muted">Sin pedidos</td></tr>';
        } else {
          tbody.innerHTML = d.recentOrders.map((o) => {
            const name = escapeHtml(o.full_name || o.username);
            const lbl  = orderStatusLabel(o.status);
            const cls  = ORDER_STATUS_TAGCLS[o.status] || "";
            // Día local, no slice UTC: un pedido de las 22:00 figuraba con el
            // día siguiente en el dashboard vs la pestaña Pedidos.
            const date = formatDateDay(o.created_at);
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

      // Clientes inactivos (no ingresan hace +N días o nunca ingresaron)
      const days = d.inactiveDays || 30;
      const itTitle = document.getElementById("dash-inactive-title");
      if (itTitle) itTitle.textContent = "Clientes inactivos (+" + days + " días sin entrar)";
      const itbody = document.getElementById("dash-inactive-tbody");
      if (itbody) {
        const list = d.inactiveClients || [];
        if (!list.length) {
          itbody.innerHTML = '<tr><td colspan="2" class="muted">Todos los clientes ingresaron en los últimos ' + days + ' días 👍</td></tr>';
        } else {
          itbody.innerHTML = list.map((c) => {
            const name = escapeHtml(c.full_name || c.username);
            const info = (c.days_inactive == null)
              ? '<span style="color:#b91c1c;font-weight:600">Nunca ingresó</span>'
              : ('hace ' + c.days_inactive + ' días');
            return "<tr><td>" + name + "</td>" +
              "<td class=\"muted small\" style=\"text-align:right\">" + info + "</td></tr>";
          }).join("");
        }
      }
    } catch (e) {
      console.error("Dashboard error:", e);
    }
  }

  // ── Gráfico de deuda total mes a mes ──────────────────────────────────────
  let debtChartInstance = null;

  async function loadDebtHistory() {
    const canvas = document.getElementById("dash-debt-chart");
    const emptyMsg = document.getElementById("dash-debt-chart-empty");
    if (!canvas) return;
    try {
      const data = await api("/api/admin/dashboard/debt-history");
      const history = (data.history || []);
      if (!history.length || history.every((h) => h.deuda === 0)) {
        if (emptyMsg) emptyMsg.hidden = false;
        canvas.hidden = true;
        return;
      }
      if (emptyMsg) emptyMsg.hidden = true;
      canvas.hidden = false;

      const labels = history.map((h) => {
        const [y, m] = h.month.split("-");
        const nombres = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        return nombres[Number(m) - 1] + " " + y.slice(2);
      });
      const values = history.map((h) => h.deuda);

      // Si Chart.js no está listo todavía (defer), reintentar en 200ms
      if (typeof Chart === "undefined") {
        setTimeout(loadDebtHistory, 300);
        return;
      }

      if (debtChartInstance) { debtChartInstance.destroy(); debtChartInstance = null; }

      debtChartInstance = new Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            label: "Deuda total clientes",
            data: values,
            borderColor: "#dc2626",
            backgroundColor: "rgba(220,38,38,0.08)",
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: "#dc2626",
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => "$ " + Number(ctx.raw).toLocaleString("es-AR"),
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (v) => "$ " + Number(v).toLocaleString("es-AR"),
                font: { size: 10 },
              },
              grid: { color: "#f1f5f9" },
            },
            x: {
              ticks: { font: { size: 10 } },
              grid: { display: false },
            },
          },
        },
      });
    } catch (e) {
      console.error("Debt history chart error:", e);
    }
  }

  // Botón reload del dashboard
  const dashReloadBtn = document.getElementById("dash-reload");
  if (dashReloadBtn) dashReloadBtn.addEventListener("click", () => { loadDashboard(); loadDebtHistory(); });

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
      if (tab === "dashboard") { loadDashboard(); loadDebtHistory(); }
      if (tab === "reportes") loadReportes();
      if (tab === "pedidos") { state.ordersLoaded = false; loadOrders(); } // siempre recargar: pueden entrar pedidos nuevos del catálogo
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
      if (tab === "armado") { state.ordersLoaded = false; loadArmado(); } // recargar: refleja pedidos nuevos y avances
      if (tab === "entregas") {
        state.entregasLoaded = false; loadEntregas();
        state.ordersLoaded = false; loadEntregasQueue(); // recargar la cola "para entregar"
      }
      if (tab === "proveedores" && !state.suppliersLoaded) loadSuppliers();
      if (tab === "cotizaciones") loadCotizaciones();
      if (tab === "compras" && !state.purchasesLoaded) loadPurchases();
      if (tab === "recepcion") loadRecepcion(); // siempre recargar (cambia con compras nuevas)
      if (tab === "pagos" && !state.paymentsLoaded) loadPayments();
      if (tab === "gastos") loadExpenses(); // siempre recargar (datos cambian)
      if (tab === "cuentas") { state.accountsLoaded = false; loadAccounts(); } // siempre recargar (refleja entregas/cobros nuevos)
      if (tab === "ctacte-prov") loadSupplierAccounts(); // siempre recargar (cambia con compras/pagos)
      if (tab === "caja") loadCaja();
      if (tab === "administradores") loadAdmins();
      if (tab === "inflacion") loadInflacion(); // siempre recargar (cambia con compras/ediciones)
      if (tab === "ventas") loadVentasOrders(); // siempre recargar (refleja entregas nuevas)
    });
  });

  // ---------- Usuarios ----------
  async function loadUsers() {
    try {
      els.userTbody.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
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
      els.userTbody.innerHTML = '<tr><td colspan="6" class="muted">Error cargando usuarios</td></tr>';
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
      list = list.filter((u) => matchWords((u.username || "") + " " + (u.full_name || "") + " " + (u.email || ""), q));
    }
    sortUserList(list);
    updateUserSortHeaders();
    els.userCount.textContent = list.length + (list.length === 1 ? " usuario" : " usuarios");
    if (!list.length) {
      els.userTbody.innerHTML = '<tr><td colspan="6" class="muted">Sin resultados</td></tr>';
      return;
    }
    els.userTbody.innerHTML = list.map(userRowHtml).join("");
  }

  // Valor comparable de un cliente para una clave de orden.
  // Devuelve { v, isNull } para poder mandar los vacíos siempre al final.
  function userSortVal(u, key) {
    if (key === "name") return { v: (u.full_name || u.username || "").toLowerCase(), isNull: false };
    if (key === "lista") return { v: priceLabelFor(u).toLowerCase(), isNull: false };
    if (key === "vendedor") {
      const lbl = vendLabelFor(u);
      return { v: lbl === "—" ? "" : lbl.toLowerCase(), isNull: lbl === "—" };
    }
    if (key === "activo") return { v: u.active ? 1 : 0, isNull: false };
    if (key === "login") {
      const t = u.last_login_at ? Date.parse(u.last_login_at.replace(" ", "T")) : NaN;
      return { v: isNaN(t) ? 0 : t, isNull: isNaN(t) };
    }
    return { v: "", isNull: true };
  }

  // Orden estable multi-clave: state.userSort[0] es la clave principal y las
  // siguientes son desempates (mantienen el orden previo, como en Excel).
  function sortUserList(list) {
    const keys = state.userSort;
    if (!keys || !keys.length) return;
    list.sort((a, b) => {
      for (const s of keys) {
        const av = userSortVal(a, s.key), bv = userSortVal(b, s.key);
        // Vacíos siempre al final, sin importar la dirección.
        if (av.isNull && !bv.isNull) return 1;
        if (!av.isNull && bv.isNull) return -1;
        let c = 0;
        if (typeof av.v === "number") c = av.v - bv.v;
        else c = String(av.v).localeCompare(String(bv.v), "es");
        if (s.dir === "desc") c = -c;
        if (c) return c;
      }
      return 0;
    });
  }

  // Dibuja flechas + número de prioridad en los encabezados y toggle del reset.
  function updateUserSortHeaders() {
    if (!els.userThead) return;
    const keys = state.userSort || [];
    els.userThead.querySelectorAll("th.us-sort").forEach((th) => {
      const k = th.dataset.sort;
      const idx = keys.findIndex((s) => s.key === k);
      const span = th.querySelector(".us-arrow");
      if (!span) return;
      if (idx === -1) { span.innerHTML = ""; return; }
      const arrow = keys[idx].dir === "asc" ? "▲" : "▼";
      // Mostrar el número de prioridad solo si hay más de una clave activa.
      const prio = keys.length > 1 ? '<sup>' + (idx + 1) + '</sup>' : "";
      span.innerHTML = arrow + prio;
    });
    const isDefault = keys.length === 1 && keys[0].key === "name" && keys[0].dir === "asc";
    if (els.userSortReset) els.userSortReset.hidden = isDefault;
  }

  // Click en un encabezado: lo vuelve clave principal (los previos quedan como
  // desempate). Si ya era la principal, alterna asc/desc.
  function onUserSortClick(key) {
    const arr = state.userSort || [];
    if (arr.length && arr[0].key === key) {
      arr[0].dir = arr[0].dir === "asc" ? "desc" : "asc";
    } else {
      const existing = arr.find((s) => s.key === key);
      const dir = existing ? existing.dir : "asc";
      state.userSort = [{ key: key, dir: dir }].concat(arr.filter((s) => s.key !== key));
    }
    renderUsers();
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

  // Etiqueta legible de la lista de precios efectiva de un cliente:
  // lista personalizada si tiene una, sino el nivel base (Minorista/etc).
  function priceLabelFor(u) {
    if (u.price_list_id) {
      const pl = state.priceLists.find((x) => Number(x.id) === Number(u.price_list_id));
      return pl ? pl.name : ("Lista #" + u.price_list_id);
    }
    return PRICE_LEVEL_NAMES[Number(u.level)] || LEVEL_NAMES[Number(u.level)] || ("Nivel " + u.level);
  }

  // Nombre del vendedor asignado, o "—".
  function vendLabelFor(u) {
    if (!u.assigned_vendedor_id) return "—";
    const v = state.vendedoresActiveCache.find((x) => Number(x.id) === Number(u.assigned_vendedor_id));
    return v ? (v.full_name || v.username) : ("#" + u.assigned_vendedor_id);
  }

  // Selector unificado Nivel + Lista de precios. Niveles base (1-4) y listas
  // personalizadas en un solo <select>. value = "level:N" o "list:ID".
  function unifiedPriceOptsHtml(u) {
    const curIsList = !!u.price_list_id;
    let html = '<optgroup label="Nivel base">';
    [1, 2, 3, 4].forEach((n) => {
      const sel = (!curIsList && Number(u.level) === n) ? " selected" : "";
      html += '<option value="level:' + n + '"' + sel + '>' + PRICE_LEVEL_NAMES[n] + '</option>';
    });
    html += '</optgroup>';
    const lists = state.priceLists.filter((pl) => pl.active);
    // Incluir la lista asignada aunque esté inactiva, para no perder la selección.
    if (curIsList && !lists.some((pl) => Number(pl.id) === Number(u.price_list_id))) {
      const cur = state.priceLists.find((pl) => Number(pl.id) === Number(u.price_list_id));
      if (cur) lists.push(cur);
    }
    if (lists.length) {
      html += '<optgroup label="Listas personalizadas">';
      lists.forEach((pl) => {
        const sel = (curIsList && Number(u.price_list_id) === Number(pl.id)) ? " selected" : "";
        const tag = pl.active ? "" : " (inactiva)";
        html += '<option value="list:' + pl.id + '"' + sel + '>' + escapeHtml(pl.name + tag) + '</option>';
      });
      html += '</optgroup>';
    }
    return html;
  }

  // Decodifica el value del selector unificado a un body de PATCH.
  function decodePriceCfg(val) {
    if (val && val.indexOf("list:") === 0) return { price_list_id: Number(val.slice(5)) };
    const n = Number((val || "level:1").slice(6)) || 1;
    return { level: n, price_list_id: null };
  }

  function userRowHtml(u) {
    const lastLogin = u.last_login_at ? formatDate(u.last_login_at) : "—";
    const name = escapeHtml(u.full_name || u.username || "—");
    const activeBadge = u.active
      ? '<span class="acc-balance-badge" style="background:#dcfce7;color:#166534">Activo</span>'
      : '<span class="acc-balance-badge" style="background:#fee2e2;color:#991b1b">Inactivo</span>';
    return '<tr data-id="' + u.id + '"' + (u.active ? '' : ' class="row-inactive"') + ' title="Doble click para editar">' +
      '<td class="cell-code" style="font-weight:600">' + name + '</td>' +
      '<td>' + escapeHtml(priceLabelFor(u)) + '</td>' +
      '<td>' + escapeHtml(vendLabelFor(u)) + '</td>' +
      '<td>' + activeBadge + '</td>' +
      '<td class="muted small-cell">' + lastLogin + '</td>' +
      '<td><button class="btn btn-small btn-activity" data-act="activity" data-id="' + u.id + '" data-username="' + escapeHtml(u.username) + '" type="button" title="Ver actividad y logueos">📊</button></td>' +
    '</tr>';
  }

  // ---- Modal de actividad del usuario (logueos + eventos clave) ----
  const ACT_LABELS = {
    login: "🔓 Ingreso",
    logout: "🚪 Salida",
    catalogo: "🛒 Abrió catálogo",
    pedido: "📦 Envió pedido",
    cambios: "💲 Vio cambios de precio",
  };

  async function openActivityModal(userId, username) {
    const modal = document.getElementById("activity-modal");
    const titleEl = document.getElementById("activity-title");
    const summaryEl = document.getElementById("activity-summary");
    const bodyEl = document.getElementById("activity-tbody");
    if (!modal) return;
    titleEl.textContent = "Actividad de " + (username || "usuario");
    summaryEl.innerHTML = '<span class="muted">Cargando…</span>';
    bodyEl.innerHTML = '<tr><td colspan="4" class="muted">Cargando…</td></tr>';
    modal.hidden = false;
    try {
      const data = await api("/api/admin/users/" + userId + "/activity");
      const s = data.summary || {};
      summaryEl.innerHTML =
        actKpi("Ingresos", s.logins || 0) +
        actKpi("Pedidos", s.pedidos || 0) +
        actKpi("Vio catálogo", s.catalogos || 0) +
        actKpi("Vio cambios", s.cambios || 0) +
        actKpi("Último ingreso", s.last_login ? formatDate(s.last_login) : "—") +
        actKpi("Última actividad", s.last_activity ? formatDate(s.last_activity) : "—");
      const evs = data.events || [];
      if (!evs.length) {
        bodyEl.innerHTML = '<tr><td colspan="4" class="muted">Sin registros todavía.</td></tr>';
        return;
      }
      bodyEl.innerHTML = evs.map((ev) => {
        const label = ACT_LABELS[ev.event] || escapeHtml(ev.event);
        const det = ev.detail ? escapeHtml(ev.detail) : "";
        const ip = ev.ip ? escapeHtml(ev.ip) : "—";
        return '<tr>' +
          '<td class="muted small-cell">' + escapeHtml(formatDate(ev.created_at)) + '</td>' +
          '<td>' + label + (det ? ' <span class="muted">' + det + '</span>' : '') + '</td>' +
          '<td class="muted small-cell">' + ip + '</td>' +
          '<td class="muted small-cell" title="' + escapeHtml(ev.user_agent || "") + '">' + escapeHtml(shortUa(ev.user_agent)) + '</td>' +
        '</tr>';
      }).join("");
    } catch (err) {
      summaryEl.innerHTML = '<span class="muted">Error</span>';
      bodyEl.innerHTML = '<tr><td colspan="4" class="muted">Error: ' + escapeHtml(err.message) + '</td></tr>';
    }
  }

  function actKpi(label, value) {
    return '<div class="act-kpi"><div class="act-kpi-value">' + escapeHtml(String(value)) +
      '</div><div class="act-kpi-label">' + escapeHtml(label) + '</div></div>';
  }

  // Resume el user-agent a algo legible (navegador + sistema).
  function shortUa(ua) {
    if (!ua) return "—";
    let os = "";
    if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
    else if (/Windows/i.test(ua)) os = "Windows";
    else if (/Mac OS X|Macintosh/i.test(ua)) os = "Mac";
    else if (/Linux/i.test(ua)) os = "Linux";
    let br = "";
    if (/Edg\//i.test(ua)) br = "Edge";
    else if (/Chrome\//i.test(ua)) br = "Chrome";
    else if (/Firefox\//i.test(ua)) br = "Firefox";
    else if (/Safari\//i.test(ua)) br = "Safari";
    const out = [br, os].filter(Boolean).join(" · ");
    return out || ua.slice(0, 30);
  }

  // ---- Acciones de usuario (reutilizadas por la tabla y el modal de edición) ----
  function openResetModal(userId, username) {
    state.resetTargetId = Number(userId);
    els.userResetTarget.textContent = "Para el usuario: " + username;
    els.userResetMsg.textContent = "";
    els.userResetForm.reset();
    els.userResetModal.hidden = false;
    setTimeout(() => els.userResetForm.querySelector('[name="password"]').focus(), 50);
  }

  // Compartir acceso por WhatsApp (mensaje con link + credenciales).
  function shareUserAccess(u) {
    if (!u) return;
    const appName = (state.me && state.me.app_name) ? state.me.app_name : "Maxaria";
    const origin = location.origin;
    const hasPass = u.plain_password && u.plain_password !== "—";
    let msg = "¡Hola" + (u.full_name ? " " + u.full_name : "") + "! 👋\n\n";
    msg += "Te damos acceso al catálogo de " + appName + ".\n";
    msg += "Ingresá desde: " + origin + "\n\n";
    msg += "👤 Usuario: " + u.username + "\n";
    if (hasPass) msg += "🔑 Contraseña: " + u.plain_password + "\n";
    msg += "\nDesde ahí podés ver los productos y armar tu pedido. ¡Cualquier duda, escribinos!";
    if (navigator.clipboard) { try { navigator.clipboard.writeText(msg); } catch (_) {} }
    const waNum = (u.whatsapp_number || "").replace(/\D/g, "");
    window.open("https://wa.me/" + waNum + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    showToast(hasPass
      ? (waNum ? "Abriendo WhatsApp con el acceso · mensaje copiado" : "Sin WhatsApp del cliente: elegí el contacto · mensaje copiado")
      : "⚠️ Sin contraseña guardada: usá 'Reset pass' y volvé a compartir", hasPass ? "ok" : "err");
  }

  async function openCatsModal(userId, username) {
    state.catsTargetId = Number(userId);
    els.userCatsTarget.textContent = "Usuario: " + username;
    els.userCatsMsg.textContent = "";
    els.userCatsList.innerHTML = '<span class="muted">Cargando…</span>';
    els.userCatsModal.hidden = false;
    try {
      const catData = await api("/api/admin/users/" + userId + "/categories");
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
  }

  // ---- Modal de edición de cliente (doble click en la fila) ----
  function openUserEditModal(id) {
    const u = state.users.find((x) => x.id === Number(id));
    if (!u) return;
    state.editUserId = u.id;
    state.editUserOrigUsername = u.username || "";
    document.getElementById("user-edit-title").textContent = "Editar cliente · " + (u.full_name || u.username);
    // El usuario se muestra como TEXTO (no input) para que los gestores de
    // contraseña no lo autocompleten con "admin". Recién al tocar "Editar"
    // aparece el campo editable.
    els.ueUsernameText.textContent = u.username || "—";
    els.ueUsernameText.hidden = false;
    els.ueUsernameEdit.hidden = false;
    els.ueUsername.hidden = true;
    els.ueUsername.value = u.username || "";
    els.uePasswordText.textContent = u.plain_password || "—";
    els.ueFullName.value = u.full_name || "";
    els.uePricecfg.innerHTML = unifiedPriceOptsHtml(u);
    els.ueVendedor.innerHTML = vendedorOptsHtml(u.assigned_vendedor_id);
    els.uePhone.value = u.phone || "";
    els.ueWhatsapp.value = u.whatsapp_number || "";
    els.ueEmail.value = u.email || "";
    els.ueActive.checked = !!u.active;
    els.userEditMsg.textContent = "";
    els.userEditMsg.className = "config-msg";
    els.userEditModal.hidden = false;
  }

  // Doble click en una fila → abrir modal de edición (salvo si tocaron el 📊).
  els.userTbody.addEventListener("dblclick", (e) => {
    if (e.target.closest("button")) return;
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    openUserEditModal(Number(tr.dataset.id));
  });

  // Click en la tabla: solo el botón de actividad (📊).
  els.userTbody.addEventListener("click", (e) => {
    const actBtn = e.target.closest('[data-act="activity"]');
    if (actBtn) openActivityModal(Number(actBtn.dataset.id), actBtn.dataset.username);
  });

  // Guardar cambios del modal de edición (un solo PATCH con todos los campos).
  els.userEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = state.editUserId;
    if (!id) return;
    const body = {
      full_name: els.ueFullName.value.trim(),
      phone: els.uePhone.value.trim(),
      whatsapp_number: els.ueWhatsapp.value.trim(),
      email: els.ueEmail.value.trim(),
      active: els.ueActive.checked ? 1 : 0,
      assigned_vendedor_id: els.ueVendedor.value || null,
    };
    // Solo mandamos el usuario si realmente cambió (evita pisarlo por accidente).
    const newUsername = els.ueUsername.value.trim().toLowerCase();
    if (newUsername && newUsername !== state.editUserOrigUsername) {
      body.username = newUsername;
    }
    Object.assign(body, decodePriceCfg(els.uePricecfg.value));
    els.userEditMsg.textContent = "Guardando…";
    els.userEditMsg.className = "config-msg";
    try {
      const out = await api("/api/admin/users/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const idx = state.users.findIndex((x) => x.id === id);
      if (idx >= 0) state.users[idx] = Object.assign({}, state.users[idx], out.user);
      els.userEditModal.hidden = true;
      renderUsers();
      showToast("Cliente actualizado", "ok");
    } catch (err) {
      els.userEditMsg.textContent = "Error: " + err.message;
      els.userEditMsg.className = "config-msg err";
    }
  });

  // Botones de acción dentro del modal de edición.
  els.ueResetBtn.addEventListener("click", () => {
    const u = state.users.find((x) => x.id === state.editUserId);
    if (u) openResetModal(u.id, u.username);
  });
  els.ueCatsBtn.addEventListener("click", () => {
    const u = state.users.find((x) => x.id === state.editUserId);
    if (u) openCatsModal(u.id, u.username);
  });
  els.ueShareBtn.addEventListener("click", () => {
    const u = state.users.find((x) => x.id === state.editUserId);
    if (u) shareUserAccess(u);
  });
  // "Editar" usuario: reemplaza el texto por el campo editable. Recién acá
  // aparece el input, así el gestor de contraseñas no lo autocompleta al abrir.
  els.ueUsernameEdit.addEventListener("click", () => {
    els.ueUsernameText.hidden = true;
    els.ueUsernameEdit.hidden = true;
    els.ueUsername.hidden = false;
    els.ueUsername.focus();
    els.ueUsername.select();
  });

  els.userSearch.addEventListener("input", debounce(renderUsers, 150));

  // Orden tipo Excel: click en los encabezados de la tabla de Usuarios.
  if (els.userThead) {
    els.userThead.addEventListener("click", (e) => {
      const th = e.target.closest("th.us-sort");
      if (!th) return;
      onUserSortClick(th.dataset.sort);
    });
  }
  if (els.userSortReset) {
    els.userSortReset.addEventListener("click", () => {
      state.userSort = [{ key: "name", dir: "asc" }];
      renderUsers();
    });
  }

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
      list = list.filter((v) => matchWords((v.username || "") + " " + (v.full_name || ""), q));
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
  function fmtMoney(n) { return "$" + (Number(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  async function loadActividad() {
    if (!els.actTbody) return;
    els.actTbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
    try {
      const rows = await api("/api/admin/earnings");
      actState.vendRows = rows || [];
      renderActividad();
    } catch (e) {
      els.actTbody.innerHTML = '<tr><td colspan="8" class="muted">Error cargando actividad</td></tr>';
    }
  }

  function vendSortVal(r, k) {
    if (k === "name") return (r.full_name || r.username || "").toLowerCase();
    if (k === "tipo") return Number(r.is_tercerizado) || 0;
    if (k === "orders") return Number(r.total_orders) || 0;
    if (k === "delivered") return Number(r.total_delivered) || 0;
    if (k === "sold") return Number(r.total_sold) || 0;
    if (k === "cost") return Number(r.total_cost) || 0;
    if (k === "earning") return Number(r.total_earning) || 0;
    return 0;
  }
  function renderActividad() {
    let rows = actState.vendRows || [];
    if (!rows.length) {
      els.actTbody.innerHTML = '<tr><td colspan="8" class="muted">Sin vendedores</td></tr>';
      els.actTfoot.innerHTML = "";
      if (els.actCount) els.actCount.textContent = "0 vendedores";
      return;
    }
    rows = reportSortRows(rows, actState.sort.vend, vendSortVal);
    updateReportSortHeaders("act-table", actState.sort.vend);
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
    vendRows: [],
    moRows: [],
    clientsRows: [],
    rankingRows: [],
    rkPeriod: "month",
    catRows: [],
    deadRows: [],
    // Estado de orden por tabla (key = data-sort del th; dir asc|desc)
    sort: {
      vend:  { key: null, dir: "desc" },
      mo:    { key: null, dir: "desc" },
      cli:   { key: null, dir: "desc" },
      rk:    { key: "earning", dir: "desc" },
      cat:   { key: null, dir: "desc" },
      dead:  { key: null, dir: "desc" },
      stLow: { key: null, dir: "desc" },
      stOut: { key: null, dir: "desc" },
    },
  };

  // ---- Helpers genéricos de orden para las tablas de reportes ----
  // Ordena una copia de rows según el estado st y un extractor de valor valFn.
  function reportSortRows(rows, st, valFn) {
    if (!st || !st.key) return rows;
    const dir = st.dir === "asc" ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      const va = valFn(a, st.key), vb = valFn(b, st.key);
      if (typeof va === "number" && typeof vb === "number") return ((va || 0) - (vb || 0)) * dir;
      return String(va == null ? "" : va).localeCompare(String(vb == null ? "" : vb), "es", { numeric: true }) * dir;
    });
  }
  // Pinta la flecha ▲/▼ en el header activo.
  function updateReportSortHeaders(tableId, st) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll("thead th.sortable").forEach(function (th) {
      th.classList.remove("sort-asc", "sort-desc");
      if (st.key && th.dataset.sort === st.key) th.classList.add(st.dir === "asc" ? "sort-asc" : "sort-desc");
    });
  }
  // Conecta el click en los headers .sortable de una tabla. Mismo header invierte
  // la dirección; otro header arranca en su dirección por defecto (data-defdir o desc).
  function wireReportSort(tableId, st, rerender) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll("thead th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        const k = th.dataset.sort;
        if (!k) return;
        if (st.key === k) st.dir = st.dir === "asc" ? "desc" : "asc";
        else { st.key = k; st.dir = th.dataset.defdir || "desc"; }
        rerender();
      });
    });
  }

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
  function cliSortVal(r, k) {
    if (k === "name") return (r.full_name || r.username || "").toLowerCase();
    if (k === "orders") return Number(r.orders_count) || 0;
    if (k === "delivered") return Number(r.delivered_count) || 0;
    if (k === "sold") return Number(r.total_sold) || 0;
    if (k === "avg") return Number(r.orders_count) > 0 ? (Number(r.total_sold) || 0) / Number(r.orders_count) : 0;
    if (k === "cost") return Number(r.total_cost) || 0;
    if (k === "earning") return Number(r.total_earning) || 0;
    if (k === "last") return r.last_order_at || "";
    return 0;
  }
  function renderActClients() {
    if (!els.actCliTbody) return;
    const q = (els.actCliSearch && els.actCliSearch.value || "").trim().toLowerCase();
    let rows = actState.clientsRows.filter((r) => {
      if (!q) return true;
      const hay = (r.full_name || "") + " " + (r.username || "");
      return hay.toLowerCase().indexOf(q) !== -1;
    });
    rows = reportSortRows(rows, actState.sort.cli, cliSortVal);
    updateReportSortHeaders("act-cli-table", actState.sort.cli);
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
    rkUpdatePeriodButtons();
    els.actRkTbody.innerHTML = '<tr><td colspan="12" class="muted">Cargando…</td></tr>';
    try {
      const data = await api("/api/admin/activity/products-ranking" + rangeQs(els.actRkFrom, els.actRkTo));
      actState.rankingRows = data.rows || [];
      if (els.actRkPeriodInfo) {
        const pf = fmtDateShort((data.prev_from || "").slice(0, 10));
        const pt = fmtDateShort((data.prev_to || "").slice(0, 10));
        els.actRkPeriodInfo.textContent =
          "Δ = variación de ventas vs el período anterior (" + pf + " a " + pt + ").";
      }
      renderActRanking();
    } catch (e) {
      els.actRkTbody.innerHTML = '<tr><td colspan="12" class="muted">Error cargando datos</td></tr>';
    }
  }
  // Presets de período (ventanas móviles): Semana=7d, Mes=30d, Trimestre=90d,
  // terminando hoy. Así la comparación con el "período anterior" del backend
  // (misma cantidad de días justo antes) es limpia.
  function rkSetPeriod(period) {
    const days = period === "week" ? 7 : period === "quarter" ? 90 : 30;
    if (els.actRkFrom) els.actRkFrom.value = isoDaysAgo(days - 1);
    if (els.actRkTo) els.actRkTo.value = todayIso();
    actState.rkPeriod = period;
    rkUpdatePeriodButtons();
    loadActRanking();
  }
  function rkUpdatePeriodButtons() {
    if (!els.actRkPeriods) return;
    els.actRkPeriods.querySelectorAll(".btn-period").forEach((b) => {
      b.classList.toggle("active", b.dataset.period === actState.rkPeriod);
    });
  }
  // Variación % de un valor actual vs el del período anterior.
  // Devuelve { pct, kind }: kind = "new" (no había antes y ahora sí),
  // "gone" (había antes y ahora 0), "flat" (sin cambio o sin datos), "num".
  function rkVar(cur, prev) {
    cur = Number(cur) || 0;
    prev = Number(prev) || 0;
    if (prev === 0 && cur === 0) return { pct: 0, kind: "flat" };
    if (prev === 0 && cur > 0) return { pct: null, kind: "new" };
    if (prev > 0 && cur === 0) return { pct: -100, kind: "gone" };
    return { pct: (cur - prev) / prev * 100, kind: "num" };
  }
  // Valor numérico para ordenar por variación (nuevos arriba de todo).
  function rkVarSortVal(cur, prev) {
    const v = rkVar(cur, prev);
    if (v.kind === "new") return 1e9;
    return v.pct == null ? 0 : v.pct;
  }
  // Celda HTML de variación con flecha y color. 'label' se usa como data-label
  // para el modo tarjeta en mobile.
  function rkVarCell(cur, prev, label) {
    const dl = label ? ' data-label="' + label + '"' : '';
    const v = rkVar(cur, prev);
    if (v.kind === "new") return '<td class="num rk-var rk-up"' + dl + ' title="Sin ventas en el período anterior">▲ nuevo</td>';
    if (v.kind === "flat") return '<td class="num rk-var muted"' + dl + '>—</td>';
    var pct = v.pct;
    var cls = pct > 0 ? "rk-up" : pct < 0 ? "rk-down" : "muted";
    var arrow = pct > 0 ? "▲ " : pct < 0 ? "▼ " : "";
    var txt = (pct > 0 ? "+" : "") + pct.toFixed(0) + "%";
    return '<td class="num rk-var ' + cls + '"' + dl + '>' + arrow + txt + '</td>';
  }
  function rkSortVal(r, k) {
    if (k === "name") return (r.name || "").toLowerCase();
    if (k === "category") return (r.category_name || "").toLowerCase();
    if (k === "units") return Number(r.units_sold) || 0;
    if (k === "sold") return Number(r.total_sold) || 0;
    if (k === "cost") return Number(r.total_cost) || 0;
    if (k === "earning") return Number(r.total_earning) || 0;
    if (k === "margin") { const t = Number(r.total_sold) || 0; return t > 0 ? (Number(r.total_earning) || 0) / t : 0; }
    if (k === "stock") return Number(r.stock) || 0;
    if (k === "last") return r.last_sold_at || "";
    if (k === "var_units") return rkVarSortVal(r.units_sold, r.prev_units_sold);
    if (k === "var_sold") return rkVarSortVal(r.total_sold, r.prev_total_sold);
    return 0;
  }
  function renderActRanking() {
    if (!els.actRkTbody) return;
    const q = (els.actRkSearch && els.actRkSearch.value || "").trim().toLowerCase();
    let rows = actState.rankingRows.filter((r) => {
      if (!q) return true;
      const hay = (r.name || "") + " " + (r.code || "") + " " + (r.category_name || "");
      return hay.toLowerCase().indexOf(q) !== -1;
    });
    rows = reportSortRows(rows, actState.sort.rk, rkSortVal);
    updateReportSortHeaders("act-rk-table", actState.sort.rk);
    if (els.actRkCount) {
      els.actRkCount.textContent = rows.length + (rows.length === 1 ? " producto" : " productos");
    }
    if (!rows.length) {
      els.actRkTbody.innerHTML = '<tr><td colspan="12" class="muted">Sin ventas en el período</td></tr>';
      if (els.actRkTfoot) els.actRkTfoot.innerHTML = "";
      return;
    }
    let tUnits = 0, tSold = 0, tCost = 0, tEarn = 0, tPrevUnits = 0, tPrevSold = 0;
    els.actRkTbody.innerHTML = rows.map((r, idx) => {
      tUnits += Number(r.units_sold) || 0;
      tSold += Number(r.total_sold) || 0;
      tCost += Number(r.total_cost) || 0;
      tEarn += Number(r.total_earning) || 0;
      tPrevUnits += Number(r.prev_units_sold) || 0;
      tPrevSold += Number(r.prev_total_sold) || 0;
      const margin = (Number(r.total_sold) || 0) > 0
        ? ((Number(r.total_earning) || 0) / Number(r.total_sold) * 100)
        : 0;
      const marginCls = margin >= 0 ? "" : ' style="color:#c00"';
      const prod = '<strong>' + escapeHtml(r.name || "") + '</strong>' +
        ' <span class="muted small">' + escapeHtml(r.code || "") + '</span>';
      return '<tr>' +
        '<td class="num muted rk-c-rank" data-label="#">' + (idx + 1) + '</td>' +
        '<td class="rk-c-name">' + prod + '</td>' +
        '<td class="muted small rk-c-cat" data-label="Categoría">' + escapeHtml(r.category_name || "—") + '</td>' +
        '<td class="num" data-label="Unidades">' + (Number(r.units_sold) || 0) + '</td>' +
        rkVarCell(r.units_sold, r.prev_units_sold, "Δ Unid.") +
        '<td class="num" data-label="Vendido">' + fmtMoney(r.total_sold) + '</td>' +
        rkVarCell(r.total_sold, r.prev_total_sold, "Δ $") +
        '<td class="num muted" data-label="Costo">' + fmtMoney(r.total_cost) + '</td>' +
        '<td class="num" data-label="Ganancia"><strong>' + fmtMoney(r.total_earning) + '</strong></td>' +
        '<td class="num" data-label="Margen"' + marginCls + '>' + margin.toFixed(1) + '%</td>' +
        '<td class="num muted" data-label="Stock">' + (Number(r.stock) || 0) + '</td>' +
        '<td class="muted small" data-label="Última venta">' + escapeHtml(fmtDateShort(r.last_sold_at)) + '</td>' +
      '</tr>';
    }).join("");
    if (els.actRkTfoot) {
      const totMargin = tSold > 0 ? (tEarn / tSold * 100) : 0;
      els.actRkTfoot.innerHTML =
        '<tr><th colspan="3">Totales</th>' +
        '<th class="num">' + tUnits + '</th>' +
        rkVarCell(tUnits, tPrevUnits).replace("<td", "<th").replace("</td>", "</th>") +
        '<th class="num">' + fmtMoney(tSold) + '</th>' +
        rkVarCell(tSold, tPrevSold).replace("<td", "<th").replace("</td>", "</th>") +
        '<th class="num muted">' + fmtMoney(tCost) + '</th>' +
        '<th class="num"><strong>' + fmtMoney(tEarn) + '</strong></th>' +
        '<th class="num">' + totMargin.toFixed(1) + '%</th>' +
        '<th></th><th></th></tr>';
    }
  }
  if (els.actRkApply) els.actRkApply.addEventListener("click", () => {
    actState.rkPeriod = null; // rango manual → ningún preset activo
    rkUpdatePeriodButtons();
    loadActRanking();
  });
  if (els.actRkPeriods) {
    els.actRkPeriods.addEventListener("click", (e) => {
      const b = e.target.closest(".btn-period");
      if (b) rkSetPeriod(b.dataset.period);
    });
  }
  if (els.actRkSort) els.actRkSort.addEventListener("change", () => {
    actState.sort.rk.key = els.actRkSort.value || "earning";
    actState.sort.rk.dir = "desc";
    renderActRanking();
  });
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
    loadActStockHistory();
  }

  // Evolución mensual del valor del stock a costo (reconstrucción aproximada).
  let actStHistChart = null;
  async function loadActStockHistory() {
    const sel = document.getElementById("act-st-hist-months");
    const tbody = document.getElementById("act-st-hist-tbody");
    const months = sel ? sel.value : 12;
    try {
      const data = await api("/api/admin/activity/stock-history?months=" + months);
      renderActStockHistory(data);
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="muted">Error cargando la evolución</td></tr>';
    }
  }
  function renderActStockHistory(data) {
    const rows = (data && data.months) || [];
    const tbody = document.getElementById("act-st-hist-tbody");
    if (tbody) {
      tbody.innerHTML = rows.length ? rows.map((r) => {
        const dv = r.delta_value;
        const dcell = dv == null
          ? '<span class="muted">—</span>'
          : '<span style="color:' + (dv > 0 ? "#16a34a" : dv < 0 ? "#ef4444" : "#6b7280") + '">' +
              (dv > 0 ? "+" : "") + fmtMoney(dv) +
              (r.delta_pct != null ? ' <span style="font-size:11px">(' + (r.delta_pct > 0 ? "+" : "") + r.delta_pct + '%)</span>' : "") +
            '</span>';
        return '<tr>' +
          '<td>' + escapeHtml(r.label) + '</td>' +
          '<td class="num">' + fmtMoney(r.value_cost) + '</td>' +
          '<td class="num">' + dcell + '</td>' +
          '<td class="num muted">' + (Number(r.units) || 0).toLocaleString("es-AR") + '</td>' +
        '</tr>';
      }).join("") : '<tr><td colspan="4" class="muted">Sin datos suficientes para reconstruir</td></tr>';
    }
    const canvas = document.getElementById("act-st-hist-chart");
    if (canvas && window.Chart) {
      if (actStHistChart) { actStHistChart.destroy(); actStHistChart = null; }
      actStHistChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels: rows.map((r) => r.label),
          datasets: [{
            label: "Valor a costo",
            data: rows.map((r) => r.value_cost),
            borderColor: "#1e3a5f",
            backgroundColor: "rgba(30,58,95,0.08)",
            fill: true, tension: 0.25, pointRadius: 3, borderWidth: 2,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => " " + fmtMoney(c.parsed.y) } },
          },
          scales: { y: { ticks: { callback: (v) => fmtMoney(v) } } },
        },
      });
    }
  }
  function stLowSortVal(p, k) {
    if (k === "code") return (p.code || "").toLowerCase();
    if (k === "name") return (p.name || "").toLowerCase();
    if (k === "stock") return Number(p.stock) || 0;
    if (k === "cost") return Number(p.cost) || 0;
    if (k === "value") return (Number(p.cost) || 0) * (Number(p.stock) || 0);
    return 0;
  }
  function stOutSortVal(p, k) {
    if (k === "code") return (p.code || "").toLowerCase();
    if (k === "name") return (p.name || "").toLowerCase();
    if (k === "cost") return Number(p.cost) || 0;
    if (k === "minorista") return Number(p.price_minorista) || 0;
    return 0;
  }
  function renderActStock(data) {
    actState.stockData = data;
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
      const list = reportSortRows(data.low_stock || [], actState.sort.stLow, stLowSortVal);
      updateReportSortHeaders("act-st-low-table", actState.sort.stLow);
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
      const list = reportSortRows(data.out_of_stock || [], actState.sort.stOut, stOutSortVal);
      updateReportSortHeaders("act-st-out-table", actState.sort.stOut);
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
  (function () {
    const hm = document.getElementById("act-st-hist-months");
    if (hm) hm.addEventListener("change", loadActStockHistory);
  })();

  // ---- Por categoria ----
  async function loadActCategories() {
    if (!els.actCatTbody) return;
    els.actCatTbody.innerHTML = '<tr><td colspan="9" class="muted">Cargando…</td></tr>';
    try {
      const data = await api("/api/admin/activity/stock-by-category");
      actState.catRows = data.rows || [];
      renderActCategories();
    } catch (e) {
      els.actCatTbody.innerHTML = '<tr><td colspan="9" class="muted">Error cargando datos</td></tr>';
    }
  }
  function catSortVal(c, k) {
    if (k === "category") return (c.category_name || "").toLowerCase();
    if (k === "products") return Number(c.total_products) || 0;
    if (k === "instock") return Number(c.in_stock_products) || 0;
    if (k === "outstock") return Number(c.out_of_stock_products) || 0;
    if (k === "units") return Number(c.units_in_stock) || 0;
    if (k === "cost") return Number(c.value_cost) || 0;
    if (k === "minorista") return Number(c.value_minorista) || 0;
    if (k === "mayorista") return Number(c.value_mayorista) || 0;
    if (k === "pot") return (Number(c.value_minorista) || 0) - (Number(c.value_cost) || 0);
    return 0;
  }
  function renderActCategories() {
    if (!els.actCatTbody) return;
    let rows = actState.catRows || [];
    rows = reportSortRows(rows, actState.sort.cat, catSortVal);
    updateReportSortHeaders("act-cat-table", actState.sort.cat);
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
  function deadSortVal(p, k) {
    if (k === "code") return (p.code || "").toLowerCase();
    if (k === "name") return (p.name || "").toLowerCase();
    if (k === "category") return (p.category_name || "").toLowerCase();
    if (k === "stock") return Number(p.stock) || 0;
    if (k === "cost") return Number(p.cost) || 0;
    if (k === "cap") return (Number(p.cost) || 0) * (Number(p.stock) || 0);
    if (k === "last") return p.last_sold_at || "";
    return 0;
  }
  function renderActDead() {
    if (!els.actDeadTbody) return;
    let rows = reportSortRows(actState.deadRows || [], actState.sort.dead, deadSortVal);
    updateReportSortHeaders("act-dead-table", actState.sort.dead);
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

  function moSortVal(r, k) {
    if (k === "month") return r.month || "";
    if (k === "orders") return Number(r.orders_count) || 0;
    if (k === "delivered") return Number(r.delivered_count) || 0;
    if (k === "gross") return Number(r.gross_sales) || 0;
    if (k === "cost") return Number(r.cost_total) || 0;
    if (k === "earning") return Number(r.net_earning) || 0;
    if (k === "margin") { const g = Number(r.gross_sales) || 0; return g > 0 ? (Number(r.net_earning) || 0) / g : 0; }
    if (k === "avg") return Number(r.avg_ticket) || 0;
    if (k === "purch") return Number(r.purchases_total) || 0;
    if (k === "exp") return Number(r.expenses_total) || 0;
    if (k === "pays") return Number(r.payments_total) || 0;
    return 0;
  }
  function renderActMonthly(rows) {
    if (!els.actMoTbody) return;
    actState.moRows = rows || [];
    updateReportSortHeaders("act-mo-table", actState.sort.mo);
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
    // El gráfico va del mes más reciente al más viejo (cronológico inverso).
    const ordered = rows.slice().reverse();
    // La tabla respeta el orden elegido por click en los headers; si no hay
    // orden activo, usa el mismo orden que el gráfico (más reciente arriba).
    const tableRows = actState.sort.mo.key ? reportSortRows(rows, actState.sort.mo, moSortVal) : ordered;
    els.actMoTbody.innerHTML = tableRows.map((r) => {
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

  // Orden por click en los headers de cada tabla de reportes.
  wireReportSort("act-table",        actState.sort.vend,  renderActividad);
  wireReportSort("act-mo-table",     actState.sort.mo,    () => renderActMonthly(actState.moRows));
  wireReportSort("act-cli-table",    actState.sort.cli,   renderActClients);
  wireReportSort("act-rk-table",     actState.sort.rk,    renderActRanking);
  wireReportSort("act-cat-table",    actState.sort.cat,   renderActCategories);
  wireReportSort("act-dead-table",   actState.sort.dead,  renderActDead);
  wireReportSort("act-st-low-table", actState.sort.stLow, () => renderActStock(actState.stockData || {}));
  wireReportSort("act-st-out-table", actState.sort.stOut, () => renderActStock(actState.stockData || {}));

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
      list = list.filter((pl) => matchWords((pl.name || "") + " " + (pl.base_level || "") + " " + (pl.notes || ""), q));
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
        if (!await confirmModal({ message: "¿Borrar esta lista de precios? Esta acción no se puede deshacer.", confirmText: "Borrar", danger: true })) return;
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
      list = list.filter((d) => matchWords(
        String(d.order_id) + " " +
        (d.vendedor_username || "") + " " +
        (d.vendedor_full_name || "") + " " +
        (d.client_username || "") + " " +
        (d.client_full_name || "") + " " +
        (d.delivered_to || ""), q));
    }
    if (els.entCount) els.entCount.textContent = list.length + (list.length === 1 ? " entrega" : " entregas");
    if (!list.length) {
      els.entTbody.innerHTML = '<tr><td colspan="10" class="muted">Sin entregas registradas.</td></tr>';
      return;
    }
    els.entTbody.innerHTML = list.map((d) => {
      const totalCobrado = (d.efectivo_amount || 0) + (d.transferencia_amount || 0);
      const notesTxt = d.notes ? escapeHtml(d.notes) : "";
      const cajaParts = [];
      if (d.caja_name) cajaParts.push("💵 " + escapeHtml(d.caja_name));
      if (d.caja_transfer_name) cajaParts.push("📲 " + escapeHtml(d.caja_transfer_name));
      const cajaTxt = cajaParts.length ? ' ' + cajaParts.join(" · ") : "";
      const lastCell = (notesTxt + cajaTxt).trim() || "—";
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
        '<td class="muted small">' + lastCell + '</td>' +
      '</tr>';
    }).join("");
  }

  if (els.entSearch) els.entSearch.addEventListener("input", debounce(renderEntregas, 150));
  if (els.entVendFilter) els.entVendFilter.addEventListener("change", renderEntregas);

  // -------- Modal de entrega --------
  // Cache + helper para poblar selects de caja (cobro de entrega o pago).
  state.cajasList = state.cajasList || null;
  async function ensureCajas() {
    if (state.cajasList) return state.cajasList;
    try { state.cajasList = await api("/api/cajas"); } catch (_) { state.cajasList = []; }
    return state.cajasList;
  }
  function cajaTypeLabel(t) {
    return t === "banco" ? "🏦" : (t === "digital" ? "📱" : "💵");
  }
  async function fillCajaSelect(selectEl, selectedId, firstLabel) {
    if (!selectEl) return;
    const cajas = await ensureCajas();
    const opts = ['<option value="">' + (firstLabel || "— Sin imputar a caja —") + '</option>'];
    for (const c of cajas) {
      const resp = c.responsable_full_name ? " · " + c.responsable_full_name : "";
      opts.push('<option value="' + c.id + '">' + cajaTypeLabel(c.type) + " " + escapeHtml(c.name) + escapeHtml(resp) + '</option>');
    }
    selectEl.innerHTML = opts.join("");
    selectEl.value = selectedId ? String(selectedId) : "";
  }

  // Info del pedido para el bloque admin (descuento + rentabilidad). Se llena
  // al abrir el modal como admin con GET /api/orders/:id.
  var deliveryOrderInfo = null;
  // Para decidir qué fecha/hora mandar al guardar la entrega (ver el submit):
  // si es una entrega ya existente y cuál era su fecha original.
  var deliveryWasExisting = false;
  var deliveryExistingDate = null;

  function openDeliveryModal(orderId, orderLabel, existingDelivery) {
    state.deliveryTargetOrderId = orderId;
    deliveryWasExisting = !!(existingDelivery && existingDelivery.delivered_at);
    deliveryExistingDate = deliveryWasExisting
      ? String(existingDelivery.delivered_at).slice(0, 10)
      : null;
    deliveryOrderInfo = null;
    if (els.deliveryModalOrder) els.deliveryModalOrder.textContent = orderLabel;
    if (els.deliveryFormMsg) els.deliveryFormMsg.textContent = "";
    if (els.deliveryForm) {
      els.deliveryForm.reset();
      fillCajaSelect(document.getElementById("delivery-caja-efectivo"), existingDelivery && existingDelivery.caja_id);
      fillCajaSelect(document.getElementById("delivery-caja-transfer"), existingDelivery && existingDelivery.caja_transfer_id);
      // Fecha de la entrega: si ya existe, su fecha (parte YYYY-MM-DD); si es
      // nueva, hoy por default. El input date espera YYYY-MM-DD.
      const dateInput = els.deliveryForm.querySelector('[name="delivered_at"]');
      if (dateInput) {
        let dval = "";
        if (existingDelivery && existingDelivery.delivered_at) {
          dval = String(existingDelivery.delivered_at).slice(0, 10);
        } else {
          dval = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
        }
        dateInput.value = dval;
        // Sin fechas futuras: contaminan reportes/Ventas (el server también valida).
        dateInput.max = new Date().toLocaleDateString("en-CA");
      }
      if (existingDelivery) {
        const f = els.deliveryForm;
        f.querySelector('[name="delivered_to"]').value = existingDelivery.delivered_to || "";
        setMoney(f.querySelector('[name="efectivo_amount"]'), existingDelivery.efectivo_amount || 0);
        setMoney(f.querySelector('[name="transferencia_amount"]'), existingDelivery.transferencia_amount || 0);
        f.querySelector('[name="notes"]').value = existingDelivery.notes || "";
      }
      updateDeliveryTotalPreview();
      deliverySyncTransferLock();
    }
    // Bloque admin: descuento + rentabilidad. Solo para administradores.
    if (els.deliveryAdminBox) {
      els.deliveryAdminBox.hidden = !state.isAdmin;
      if (els.deliveryDiscountType) els.deliveryDiscountType.value = "";
      if (els.deliveryDiscountValue) { els.deliveryDiscountValue.value = ""; els.deliveryDiscountValue.disabled = true; }
      if (els.deliverySummary) els.deliverySummary.innerHTML = "";
    }
    // Traer el pedido SIEMPRE (admin y vendedor): el total alimenta el tilde
    // "Pagó el total", el saldo adeudado en vivo y el bloqueo de transferencia.
    api("/api/orders/" + orderId).then(function(order) {
      var pf = order.profitability || {};
      // Comisión del vendedor (si hay) y efectivo ya cobrado por OTRAS vías
      // (otros cobros del pedido), para repartir con "primero lo tuyo".
      var commission = Number(pf.vendor && pf.vendor.earning) || 0;
      var existAmt = existingDelivery
        ? (Number(existingDelivery.efectivo_amount) || 0) + (Number(existingDelivery.transferencia_amount) || 0)
        : 0;
      deliveryOrderInfo = {
        total: Number(order.total) || 0,
        revenue_gross: Number(pf.revenue_gross != null ? pf.revenue_gross : order.total) || 0,
        cost_total: Number(pf.cost_total) || 0,
        commission: commission,
        vendor_name: (pf.vendor && pf.vendor.name) || "",
        cash_other: Math.max(0, (Number(order.cash_collected) || 0) - existAmt),
      };
      if (state.isAdmin) {
        // Pre-cargar descuento ya guardado en el pedido (si lo había).
        if (order.discount_type && els.deliveryDiscountType) {
          els.deliveryDiscountType.value = order.discount_type;
          if (els.deliveryDiscountValue) {
            els.deliveryDiscountValue.disabled = false;
            els.deliveryDiscountValue.value = order.discount_value != null ? order.discount_value : "";
          }
        }
        renderDeliverySummary();
      }
      deliverySyncPaidFull();
      deliverySyncTransferLock();
      updateDeliveryTotalPreview();
    }).catch(function() {
      if (state.isAdmin && els.deliverySummary) els.deliverySummary.innerHTML =
        '<span class="muted small">No se pudo cargar la rentabilidad.</span>';
    });
    if (els.deliveryModal) els.deliveryModal.hidden = false;
    setTimeout(() => {
      if (els.deliveryForm) els.deliveryForm.querySelector('[name="delivered_to"]').focus();
    }, 50);
  }

  // Calcula el descuento en pesos según el tipo/valor elegidos, acotado al total.
  function deliveryDiscountAmount() {
    if (!deliveryOrderInfo || !els.deliveryDiscountType) return 0;
    var type = els.deliveryDiscountType.value;
    var val = Math.max(0, Number(els.deliveryDiscountValue && els.deliveryDiscountValue.value) || 0);
    if (!type || val <= 0) return 0;
    var total = deliveryOrderInfo.total;
    var amt = type === "percent" ? Math.round(total * Math.min(val, 100) / 100) : Math.round(val);
    return Math.max(0, Math.min(amt, total));
  }

  // Reparto del cobro actual entre vos y el vendedor ("primero lo tuyo"): la
  // comisión recién se cubre con lo cobrado por encima de tu parte (total −
  // comisión). Devuelve null si el pedido no tiene comisión de vendedor.
  function deliverySplit() {
    if (!deliveryOrderInfo || !(deliveryOrderInfo.commission > 0)) return null;
    var C = deliveryOrderInfo.commission;
    var total = deliveryOrderInfo.total;
    var loTuyo = Math.max(0, total - C);
    var other = deliveryOrderInfo.cash_other || 0;
    var a = deliveryAmounts();
    var thisCobro = a.ef + a.tr;
    var clamp = function(x) { return Math.max(0, Math.min(x, C)); };
    var commBefore = clamp(Math.round(other - loTuyo));
    var commAfter = clamp(Math.round(other + thisCobro - loTuyo));
    var vendorPart = commAfter - commBefore;
    var yourPart = Math.max(0, thisCobro - vendorPart);
    return { commission: C, vendor_name: deliveryOrderInfo.vendor_name, vendorPart: vendorPart, yourPart: yourPart, cobrado: thisCobro };
  }

  // Resumen admin: total bruto, descuento, neto a cobrar, costo y rentabilidad.
  function renderDeliverySummary() {
    if (!els.deliverySummary || !deliveryOrderInfo) return;
    var total = deliveryOrderInfo.total;
    var disc = deliveryDiscountAmount();
    var neto = Math.max(0, total - disc);
    var cost = deliveryOrderInfo.cost_total;
    var rent = neto - cost;
    var margin = neto > 0 ? (rent / neto) * 100 : 0;
    var rentColor = rent > 0 ? "#047857" : (rent < 0 ? "#b91c1c" : "#6b7280");
    var line1 = disc > 0
      ? "Total " + fmtPrice(total) + " − Descuento " + fmtPrice(disc) + " = <strong>" + fmtPrice(neto) + "</strong> neto a cobrar"
      : "Total a cobrar: <strong>" + fmtPrice(total) + "</strong>";
    var html =
      '<div class="ds-line">' + line1 + "</div>" +
      '<div class="ds-line">💰 Rentabilidad: <strong style="color:' + rentColor + '">' + fmtPrice(rent) +
        '</strong> <span class="muted">(' + margin.toLocaleString("es-AR", { maximumFractionDigits: 1 }) +
        '% margen · costo ' + fmtPrice(cost) + ')</span></div>';
    // Reparto del cobro: lo tuyo (entra a la caja) vs la comisión del vendedor
    // (sale como egreso). Solo si el pedido genera comisión.
    var sp = deliverySplit();
    if (sp) {
      var vname = sp.vendor_name ? " (" + escapeHtml(sp.vendor_name) + ")" : "";
      html +=
        '<div class="ds-line ds-split">De este cobro → ' +
          '🧑‍💼 Vendedor' + vname + ': <strong>' + fmtPrice(sp.vendorPart) + '</strong> · ' +
          '🏦 A tu caja: <strong>' + fmtPrice(sp.yourPart) + '</strong>' +
          ' <span class="muted">(comisión total ' + fmtPrice(sp.commission) + ')</span></div>';
    }
    els.deliverySummary.innerHTML = html;
  }

  // Total NETO a cobrar (total del pedido − descuento elegido). null si el
  // pedido todavía no se cargó (fetch en vuelo o falló).
  function deliveryNetTotal() {
    if (!deliveryOrderInfo) return null;
    return Math.max(0, deliveryOrderInfo.total - deliveryDiscountAmount());
  }

  function deliveryAmounts() {
    const f = els.deliveryForm;
    if (!f) return { ef: 0, tr: 0 };
    return {
      ef: Math.max(0, parseMoney(f.querySelector('[name="efectivo_amount"]').value)),
      tr: Math.max(0, parseMoney(f.querySelector('[name="transferencia_amount"]').value)),
    };
  }

  // Tilde "Pagó el total en efectivo": etiqueta con el monto neto + estado
  // según lo que haya en los campos (se destilda solo si tocan los montos).
  function deliverySyncPaidFull() {
    const chk = document.getElementById("delivery-paid-full");
    const amtEl = document.getElementById("delivery-paid-full-amt");
    const neto = deliveryNetTotal();
    if (amtEl) amtEl.textContent = neto != null ? "(= " + fmtPrice(neto) + ")" : "";
    if (chk) {
      const a = deliveryAmounts();
      chk.checked = neto != null && neto > 0 && a.ef === neto && a.tr === 0;
    }
  }

  // Si el efectivo ya cubre el total, la transferencia no aplica: se bloquean
  // y limpian su monto y su caja.
  function deliverySyncTransferLock() {
    const f = els.deliveryForm;
    if (!f) return;
    const neto = deliveryNetTotal();
    const ef = Math.max(0, parseMoney(f.querySelector('[name="efectivo_amount"]').value));
    const lock = neto != null && neto > 0 && ef >= neto;
    const trInput = f.querySelector('[name="transferencia_amount"]');
    const trSel = document.getElementById("delivery-caja-transfer");
    if (trInput) {
      trInput.disabled = lock;
      if (lock) setMoney(trInput, 0);
    }
    if (trSel) {
      trSel.disabled = lock;
      if (lock) trSel.value = "";
    }
  }

  // Estado del cobro, bien visible: pagado completo / queda adeudado / de más.
  function updateDeliveryTotalPreview() {
    if (!els.deliveryForm || !els.deliveryTotalPreview) return;
    const a = deliveryAmounts();
    const cobrado = a.ef + a.tr;
    const el = els.deliveryTotalPreview;
    el.classList.remove("dcs-debt", "dcs-ok", "dcs-over");
    const neto = deliveryNetTotal();
    const breakdown = a.ef > 0 && a.tr > 0
      ? " (" + fmtPrice(a.ef) + " efectivo + " + fmtPrice(a.tr) + " transf.)" : "";
    if (neto == null) {
      // Sin datos del pedido: comportamiento viejo (solo lo cobrado).
      el.textContent = cobrado > 0 ? "Cobrado: " + fmtPrice(cobrado) + breakdown : "";
      return;
    }
    const deuda = neto - cobrado;
    if (deuda > 0) {
      el.classList.add("dcs-debt");
      el.innerHTML = "⚠ Queda adeudado: <strong>" + fmtPrice(deuda) + "</strong>" +
        ' <span class="dcs-sub">cobrado ' + fmtPrice(cobrado) + breakdown + " de " + fmtPrice(neto) + "</span>";
    } else if (deuda === 0) {
      el.classList.add("dcs-ok");
      el.innerHTML = "✔ Pagado completo: <strong>" + fmtPrice(neto) + "</strong>" +
        (breakdown ? ' <span class="dcs-sub">' + breakdown.trim() + "</span>" : "");
    } else {
      el.classList.add("dcs-over");
      el.innerHTML = "Cobrado de más: <strong>" + fmtPrice(-deuda) + "</strong>" +
        ' <span class="dcs-sub">cobrado ' + fmtPrice(cobrado) + " sobre " + fmtPrice(neto) + "</span>";
    }
  }

  if (els.deliveryForm) {
    attachMoneyInput(els.deliveryForm.querySelector('[name="efectivo_amount"]'));
    attachMoneyInput(els.deliveryForm.querySelector('[name="transferencia_amount"]'));
    els.deliveryForm.addEventListener("input", (e) => {
      if (e.target.name === "efectivo_amount" || e.target.name === "transferencia_amount") {
        deliverySyncTransferLock();
        deliverySyncPaidFull();
        updateDeliveryTotalPreview();
        if (state.isAdmin) renderDeliverySummary();
      }
      if (e.target.name === "discount_value") {
        renderDeliverySummary();
        // El descuento cambia el neto → re-evaluar tilde, bloqueo y adeudado.
        deliverySyncPaidFull();
        deliverySyncTransferLock();
        updateDeliveryTotalPreview();
      }
    });
    // Tilde "Pagó el total en efectivo": carga el neto en efectivo y limpia
    // la transferencia (que queda bloqueada por deliverySyncTransferLock).
    const deliveryPaidChk = document.getElementById("delivery-paid-full");
    if (deliveryPaidChk) {
      deliveryPaidChk.addEventListener("change", () => {
        const f = els.deliveryForm;
        const neto = deliveryNetTotal();
        if (deliveryPaidChk.checked) {
          if (neto == null || neto <= 0) { deliveryPaidChk.checked = false; return; }
          setMoney(f.querySelector('[name="efectivo_amount"]'), neto);
          setMoney(f.querySelector('[name="transferencia_amount"]'), 0);
        } else {
          setMoney(f.querySelector('[name="efectivo_amount"]'), 0);
        }
        deliverySyncTransferLock();
        updateDeliveryTotalPreview();
        if (state.isAdmin) renderDeliverySummary();
      });
    }
    // Cambio de tipo de descuento: habilita/limpia el valor y recalcula el resumen.
    if (els.deliveryDiscountType) {
      els.deliveryDiscountType.addEventListener("change", function() {
        var on = !!els.deliveryDiscountType.value;
        if (els.deliveryDiscountValue) {
          els.deliveryDiscountValue.disabled = !on;
          if (!on) els.deliveryDiscountValue.value = "";
          else els.deliveryDiscountValue.focus();
        }
        renderDeliverySummary();
        deliverySyncPaidFull();
        deliverySyncTransferLock();
        updateDeliveryTotalPreview();
      });
    }

    els.deliveryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.deliveryTargetOrderId) return;
      const fd = new FormData(els.deliveryForm);
      const body = {
        delivered_to: fd.get("delivered_to"),
        efectivo_amount: parseMoney(fd.get("efectivo_amount")),
        transferencia_amount: parseMoney(fd.get("transferencia_amount")),
        caja_id: fd.get("caja_id") || null,
        caja_transfer_id: fd.get("caja_transfer_id") || null,
        notes: fd.get("notes"),
      };
      // Fecha/hora de la entrega:
      // - Entrega NUEVA de hoy: mandamos el timestamp real (UTC) para que quede la
      //   hora exacta en que se entregó (antes se forzaba mediodía → se veía 09:00).
      // - Entrega NUEVA con fecha pasada elegida a mano: solo la fecha (el server le
      //   pone el mediodía, así las comparaciones por día de los reportes caen bien).
      // - EDICIÓN sin cambiar la fecha: se omite, para conservar la hora real original
      //   (no pisarla al editar, por ejemplo, solo la nota).
      // - EDICIÓN cambiando la fecha: se manda la fecha nueva (mediodía de ese día).
      const todayLocal = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
      const chosenDate = fd.get("delivered_at") || "";
      if (deliveryWasExisting) {
        body.delivered_at = (chosenDate && chosenDate !== deliveryExistingDate) ? chosenDate : null;
      } else if (chosenDate === todayLocal) {
        body.delivered_at = new Date().toISOString().slice(0, 19).replace("T", " "); // "YYYY-MM-DD HH:MM:SS" UTC
      } else {
        body.delivered_at = chosenDate || null;
      }
      // Descuento (solo admin; el server lo ignora para vendedores). Si no hay
      // tipo elegido, se manda vacío → el server lo interpreta como sin descuento.
      if (state.isAdmin && els.deliveryDiscountType) {
        body.discount_type = els.deliveryDiscountType.value || "";
        body.discount_value = Number(els.deliveryDiscountValue && els.deliveryDiscountValue.value) || 0;
      }
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
        // Recargar pedidos y entregas para reflejar el nuevo estado (el pedido
        // pasa a "entregado" y sale de la cola "para entregar").
        state.ordersLoaded = false;
        state.entregasLoaded = false;
        await loadOrders();      // refresca state.orders + Pedidos
        refreshOrderViews();     // actualiza Armado y la cola de Entregas
        loadEntregas();          // recarga el historial de entregas
        refreshProductsCache();  // la entrega descuenta stock → refrescar tabla de Productos
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
      state.orderClientsLoaded = false; // que el selector "Cliente" del detalle de pedido traiga el nuevo
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
        if (m.id === "supplier-create-modal") { state.supplierCreatedFromPurchase = false; state.supplierCreatedFromCotizacion = false; m.style.zIndex = ""; }
        if (m.id === "purchase-create-modal") resetPurchaseModal();
        if (m.id === "new-product-modal") { m.style.zIndex = ""; npForPurchase = false; npForCotizacion = false; npForReception = false; }
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".admin-modal:not([hidden])").forEach((m) => { m.hidden = true; });
    state.supplierCreatedFromPurchase = false;
    state.supplierCreatedFromCotizacion = false;
    if (els.supplierCreateModal) els.supplierCreateModal.style.zIndex = "";
    resetPurchaseModal();
    if (newProdModal) newProdModal.style.zIndex = "";
    npForPurchase = false;
    npForCotizacion = false;
    npForReception = false;
  });

  // Al enfocar un campo numérico (cantidad/precio/costo en editores y pickers),
  // seleccionar todo el contenido para poder tipear directo sin borrar el valor
  // previo. Ej: en "Agregar productos al pedido", click en la cantidad y escribir
  // "6" reemplaza el "1" sin tener que borrarlo primero.
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (t && t.tagName === "INPUT" && t.type === "number" &&
        (t.classList.contains("cell-num") || t.classList.contains("pick-qty-input"))) {
      setTimeout(() => { try { t.select(); } catch (_) {} }, 0);
    }
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
    // Categorias visibles del catalogo (visibilidad global)
    loadCfgCategories();
  }

  // ---------- Config: categorias visibles del catalogo ----------
  const cfgCatsList = document.getElementById("cfg-cats-list");

  async function loadCfgCategories() {
    if (!cfgCatsList) return;
    try {
      const cats = await api("/api/admin/categories");
      if (!cats.length) {
        cfgCatsList.innerHTML = '<span class="muted">No hay categorías.</span>';
        return;
      }
      cfgCatsList.innerHTML = cats.map((c) =>
        '<label class="cats-check">' +
          '<input type="checkbox" data-cfgcat-id="' + c.id + '"' + (Number(c.active) === 1 ? " checked" : "") + ' />' +
          '<span class="cats-check-lbl" title="' + escapeHtml(c.name) + ' (' + c.products_count + ' productos activos)">' + escapeHtml(c.name) + '</span>' +
        '</label>'
      ).join("");
    } catch (e) {
      cfgCatsList.innerHTML = '<span class="muted">Error cargando categorías</span>';
    }
  }

  if (cfgCatsList) {
    cfgCatsList.addEventListener("change", async (e) => {
      const cb = e.target.closest("[data-cfgcat-id]");
      if (!cb) return;
      const id = Number(cb.dataset.cfgcatId);
      const active = cb.checked;
      cb.disabled = true;
      try {
        await api("/api/admin/categories/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: active ? 1 : 0 }),
        });
        const lbl = cb.nextElementSibling ? cb.nextElementSibling.textContent : "Categoría";
        showToast('"' + lbl + '" ' + (active ? "visible en el catálogo" : "oculta del catálogo"));
      } catch (err) {
        cb.checked = !active; // revertir el tilde si falló
        alertModal(err.message || "Error al guardar");
      } finally {
        cb.disabled = false;
      }
    });
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
        const ok = await confirmModal(
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
        state.orderClientsLoaded = false; // los importados también deben aparecer en el selector de pedidos
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
    const stateMode = els.filterState.value; // "all" | "active" | "inactive"
    const categoryFilter = els.filterCategory.value; // "all" | "<id>"

    let list = state.products;
    if (q) {
      list = list.filter((p) => matchWords((p.code || "") + " " + (p.name || "") + " " + (p.category_name || ""), q));
    }
    if (categoryFilter !== "all") list = list.filter((p) => String(p.category_id) === categoryFilter);
    if (stockMode === "in") list = list.filter((p) => (p.stock || 0) > 0);
    else if (stockMode === "out") list = list.filter((p) => (p.stock || 0) <= 0);
    if (stateMode === "active") list = list.filter((p) => !!p.active);
    else if (stateMode === "inactive") list = list.filter((p) => !p.active);

    // Mostrar "Limpiar filtros" solo si hay algún filtro activo
    if (els.filterClear) {
      const anyActive = !!q || categoryFilter !== "all" || stockMode !== "all" || stateMode !== "all";
      els.filterClear.hidden = !anyActive;
    }

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
    const list = (state.selectMode && state.showOnlySelected)
      ? state.productsFiltered.filter((p) => state.selectedIds.has(p.id))
      : state.productsFiltered;
    els.prodCount.textContent = list.length + (list.length === 1 ? " producto" : " productos");
    if (!list.length) {
      els.prodTbody.innerHTML = '<tr><td colspan="' + (state.selectMode ? 15 : 14) + '" class="muted">Sin resultados</td></tr>';
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
    if (state.selectMode) syncSelectHeader();
  }

  function fmtNum(n) { return (n || 0).toLocaleString("es-AR"); }
  // Redondeo a centavos para precios (cliente). El server vuelve a redondear.
  function round2(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  // Precios: SIEMPRE 2 decimales (centavos). El stock usa fmtNum (entero).
  function fmtPriceNum(n) { return (Number(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // Celda de dinero (solo lectura)
  function moneyCell(p, field, cls) {
    return '<td class="num ' + (cls || "") + '">' + fmtPriceNum(p[field]) + '</td>';
  }

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
    const selected = state.selectMode && state.selectedIds.has(p.id);
    const checkCell = state.selectMode
      ? '<td class="col-check"><input type="checkbox" class="prod-check" data-id="' + p.id + '"' + (selected ? " checked" : "") + '></td>'
      : "";
    return '<tr data-id="' + p.id + '" class="prod-row ' + rowCls + (selected ? " prod-selected" : "") + '" title="Doble click para editar">' +
      checkCell +
      '<td class="col-img"><button class="prod-img-btn" type="button" data-act="edit-img" data-id="' + p.id + '" data-name="' + escapeHtml(p.name) + '" title="Cambiar imagen">' + imgThumb + '</button></td>' +
      '<td class="cell-code">' + escapeHtml(p.code || "") + '</td>' +
      '<td>' + escapeHtml(p.name) + '</td>' +
      '<td class="muted">' + escapeHtml(p.category_name || "—") + '</td>' +
      '<td class="num' + stockCls + '"' + stockTitle + '>' + fmtNum(p.stock) + (stockLow ? " ⚠" : "") + '</td>' +
      moneyCell(p, "cost", "muted") +
      moneyCell(p, "price_vip") +
      moneyCell(p, "price_revendedor") +
      moneyCell(p, "price_mayorista") +
      moneyCell(p, "price_minorista") +
      moneyCell(p, "price_publico") +
      '<td><span class="cell-active-badge' + (p.active ? " active" : "") + '">' + (p.active ? "Sí" : "No") + '</span></td>' +
      '<td class="num muted" title="Unidades por empaque de compra (caja/bulto)">' + (p.units_per_bulto > 1 && p.pack_unit !== "unidad" ? p.units_per_bulto + " u/" + (p.pack_unit === "caja" ? "caja" : "bulto") : "—") + '</td>' +
      '<td><button class="btn btn-small" type="button" data-act="adj-stock" data-id="' + p.id + '" title="Ajustar stock">±</button></td>' +
    '</tr>';
  }

  // Doble click en fila → abrir modal de edición
  els.prodTbody.addEventListener("dblclick", (e) => {
    if (state.selectMode) return; // en modo selección no se abre el modal
    const btn = e.target.closest("button");
    if (btn) return; // no abrir si hicieron doble click en un botón
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const p = state.products.find((x) => x.id === Number(tr.dataset.id));
    if (p) openEditProdModal(p);
  });

  // ---------- Selección múltiple + cambios en lote ----------
  function updateSelCount() {
    const n = state.selectedIds.size;
    let txt = n + (n === 1 ? " seleccionado" : " seleccionados");
    if (n) {
      const cats = new Set();
      state.products.forEach((p) => { if (state.selectedIds.has(p.id)) cats.add(p.category_id); });
      txt += " · " + cats.size + (cats.size === 1 ? " categoría" : " categorías");
    }
    if (els.selCount) els.selCount.textContent = txt;
    if (els.selEdit) els.selEdit.disabled = n === 0;
    if (els.selCosts) els.selCosts.disabled = n === 0;
  }
  // Inserta/quita la columna de checkbox en el header y refleja el master-check
  function syncSelectHeader() {
    const headRow = els.prodTable ? els.prodTable.querySelector("thead tr") : null;
    if (!headRow) return;
    let th = headRow.querySelector("th.col-check");
    if (state.selectMode && !th) {
      th = document.createElement("th");
      th.className = "col-check";
      th.innerHTML = '<input type="checkbox" id="prod-check-all" title="Seleccionar / deseleccionar todos los filtrados">';
      headRow.insertBefore(th, headRow.firstChild);
      th.querySelector("#prod-check-all").addEventListener("change", (e) => {
        const on = e.target.checked;
        state.productsFiltered.forEach((p) => { if (on) state.selectedIds.add(p.id); else state.selectedIds.delete(p.id); });
        updateSelCount(); renderProducts();
      });
    } else if (!state.selectMode && th) {
      th.remove();
    }
    const all = headRow.querySelector("#prod-check-all");
    if (all) {
      const total = state.productsFiltered.length;
      const sel = state.productsFiltered.filter((p) => state.selectedIds.has(p.id)).length;
      all.checked = total > 0 && sel === total;
      all.indeterminate = sel > 0 && sel < total;
    }
  }
  function setSelectMode(on) {
    state.selectMode = on;
    if (!on) { state.selectedIds.clear(); state.showOnlySelected = false; if (els.selOnly) els.selOnly.checked = false; }
    if (els.selectBtn) els.selectBtn.hidden = on;
    if (els.selBar) els.selBar.hidden = !on;
    syncSelectHeader();
    updateSelCount();
    renderProducts();
  }
  if (els.selectBtn) els.selectBtn.addEventListener("click", () => setSelectMode(true));
  if (els.selCancel) els.selCancel.addEventListener("click", () => setSelectMode(false));
  if (els.selClear) els.selClear.addEventListener("click", () => {
    state.selectedIds.clear(); updateSelCount(); renderProducts();
  });
  if (els.selOnly) els.selOnly.addEventListener("change", () => {
    state.showOnlySelected = els.selOnly.checked;
    state.page = 0;
    renderProducts();
  });
  // Toggle de un checkbox de fila
  els.prodTbody.addEventListener("change", (e) => {
    const chk = e.target.closest(".prod-check");
    if (!chk) return;
    const id = Number(chk.dataset.id);
    if (chk.checked) state.selectedIds.add(id); else state.selectedIds.delete(id);
    const tr = chk.closest("tr");
    if (tr) tr.classList.toggle("prod-selected", chk.checked);
    updateSelCount();
    syncSelectHeader();
  });

  // --- Modal de cambios en lote ---
  // Cada sección tiene un checkbox de activación que apaga/prende su cuerpo.
  ["pbm-en-price", "pbm-en-cat", "pbm-en-stock", "pbm-en-active"].forEach((cbId) => {
    const cb = document.getElementById(cbId);
    if (!cb) return;
    const sync = () => { const sec = cb.closest(".pbm-section"); if (sec) sec.classList.toggle("pbm-off", !cb.checked); };
    cb.addEventListener("change", sync); sync();
  });
  // % vs fijar valor en precios
  document.querySelectorAll('input[name="pbm-price-mode"]').forEach((r) => {
    r.addEventListener("change", () => {
      const set = (document.querySelector('input[name="pbm-price-mode"]:checked') || {}).value === "set";
      const setRow = document.getElementById("pbm-price-set-row");
      const pctRow = document.getElementById("pbm-price-pct-row");
      if (setRow) setRow.style.display = set ? "flex" : "none";
      if (pctRow) pctRow.style.display = set ? "none" : "flex";
    });
  });
  // La opción "mantener margen" solo aplica cuando se fija el COSTO.
  const pbmPriceField = document.getElementById("pbm-price-field");
  const pbmMarginLbl = document.getElementById("pbm-margin-lbl");
  function syncPbmMargin() {
    if (pbmMarginLbl) pbmMarginLbl.style.display = (pbmPriceField && pbmPriceField.value === "cost") ? "" : "none";
  }
  if (pbmPriceField) pbmPriceField.addEventListener("change", syncPbmMargin);
  syncPbmMargin();

  // --- Modo "por producto": cada producto con su propio costo / % ---
  const pbmUniform = document.getElementById("pbm-uniform");
  const pbmPerProduct = document.getElementById("pbm-perproduct");
  const pbmPpList = document.getElementById("pbm-pp-list");
  function pbmScope() {
    return (document.querySelector('input[name="pbm-price-scope"]:checked') || {}).value || "uniform";
  }
  function syncPbmScope() {
    const per = pbmScope() === "perproduct";
    if (pbmUniform) pbmUniform.style.display = per ? "none" : "";
    if (pbmPerProduct) pbmPerProduct.style.display = per ? "" : "none";
  }
  document.querySelectorAll('input[name="pbm-price-scope"]').forEach((r) => r.addEventListener("change", syncPbmScope));

  function renderPbmPpList() {
    if (!pbmPpList) return;
    pbmPpList.innerHTML = [...state.selectedIds].map((id) => {
      const p = state.products.find((x) => x.id === id) || { id: id, name: "#" + id, cost: 0 };
      return '<div class="pbm-pp-row" data-id="' + id + '">' +
        '<span class="pbm-pp-name" title="' + escapeHtml(p.name || "") + '">' + escapeHtml(p.name || "") + '</span>' +
        '<span class="pbm-pp-old num">' + fmtPrice(p.cost || 0) + '</span>' +
        '<input class="admin-input pbm-pp-pct" type="number" step="0.5" placeholder="%" data-old="' + (Number(p.cost) || 0) + '">' +
        '<input class="admin-input pbm-pp-cost" type="number" min="0" step="0.01" placeholder="—">' +
        '</div>';
    }).join("");
  }
  function pbmPpMark(row) {
    const old = Number(row.querySelector(".pbm-pp-pct").dataset.old) || 0;
    const v = row.querySelector(".pbm-pp-cost").value.trim();
    row.classList.toggle("pbm-pp-changed", v !== "" && Number(v) >= 0 && Number(v) !== old);
  }
  function pbmPpFromPct(row) {
    const old = Number(row.querySelector(".pbm-pp-pct").dataset.old) || 0;
    const pct = row.querySelector(".pbm-pp-pct").value.trim();
    if (pct !== "") row.querySelector(".pbm-pp-cost").value = Math.max(0, round2(old * (1 + Number(pct) / 100)));
    pbmPpMark(row);
  }
  function pbmPpFromCost(row) {
    const old = Number(row.querySelector(".pbm-pp-pct").dataset.old) || 0;
    const val = row.querySelector(".pbm-pp-cost").value.trim();
    const pctEl = row.querySelector(".pbm-pp-pct");
    if (val === "") pctEl.value = "";
    else if (old > 0) pctEl.value = Math.round(((Number(val) / old) - 1) * 1000) / 10;
    pbmPpMark(row);
  }
  if (pbmPpList) {
    pbmPpList.addEventListener("input", (e) => {
      const row = e.target.closest(".pbm-pp-row");
      if (!row) return;
      if (e.target.classList.contains("pbm-pp-pct")) pbmPpFromPct(row);
      else if (e.target.classList.contains("pbm-pp-cost")) pbmPpFromCost(row);
    });
  }
  const pbmPpAllBtn = document.getElementById("pbm-pp-allbtn");
  if (pbmPpAllBtn) pbmPpAllBtn.addEventListener("click", () => {
    const pct = document.getElementById("pbm-pp-allpct").value.trim();
    if (pct === "") return;
    pbmPpList.querySelectorAll(".pbm-pp-row").forEach((row) => {
      row.querySelector(".pbm-pp-pct").value = pct;
      pbmPpFromPct(row);
    });
  });
  const pbmPpClearBtn = document.getElementById("pbm-pp-clearbtn");
  if (pbmPpClearBtn) pbmPpClearBtn.addEventListener("click", () => {
    const allEl = document.getElementById("pbm-pp-allpct"); if (allEl) allEl.value = "";
    pbmPpList.querySelectorAll(".pbm-pp-row").forEach((row) => {
      row.querySelector(".pbm-pp-pct").value = "";
      row.querySelector(".pbm-pp-cost").value = "";
      pbmPpMark(row);
    });
  });

  async function openBulkModal() {
    if (!state.selectedIds.size) return;
    if (!state.allCategories || !state.allCategories.length) {
      try { state.allCategories = await api("/api/categories"); } catch (_) {}
    }
    if (els.pbmCat) {
      els.pbmCat.innerHTML = (state.allCategories || [])
        .map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join("");
    }
    els.pbmCount.textContent = state.selectedIds.size;
    els.pbmMsg.textContent = ""; els.pbmMsg.className = "config-msg";
    const allEl = document.getElementById("pbm-pp-allpct"); if (allEl) allEl.value = "";
    renderPbmPpList();
    syncPbmScope();
    els.pbmModal.hidden = false;
  }
  if (els.selEdit) els.selEdit.addEventListener("click", openBulkModal);

  // Botón directo "Cambiar costos": abre el modal en lote ya configurado en modo
  // "por producto (costo)" — con la sección Precios activada y el scope perproduct.
  async function openBulkModalCosts() {
    if (!state.selectedIds.size) return;
    await openBulkModal();
    const enPrice = document.getElementById("pbm-en-price");
    if (enPrice && !enPrice.checked) { enPrice.checked = true; enPrice.dispatchEvent(new Event("change")); }
    const ppRadio = document.querySelector('input[name="pbm-price-scope"][value="perproduct"]');
    if (ppRadio) ppRadio.checked = true;
    syncPbmScope();
  }
  if (els.selCosts) els.selCosts.addEventListener("click", openBulkModalCosts);
  if (els.pbmCancel) els.pbmCancel.addEventListener("click", () => { els.pbmModal.hidden = true; });
  if (els.pbmApply) els.pbmApply.addEventListener("click", async () => {
    const ids = [...state.selectedIds];
    if (!ids.length) return;
    const enPrice  = document.getElementById("pbm-en-price").checked;
    const enCat    = document.getElementById("pbm-en-cat").checked;
    const enStock  = document.getElementById("pbm-en-stock").checked;
    const enActive = document.getElementById("pbm-en-active").checked;
    const fail = (m) => { els.pbmMsg.textContent = m; els.pbmMsg.className = "config-msg err"; };
    if (!enPrice && !enCat && !enStock && !enActive) return fail("Tildá al menos una sección.");

    const scope = pbmScope();
    let priceMode, pricePct, priceTargets = [], priceSetField, priceSetVal, priceSetMargin = false;
    let ppCosts = null, ppMargin = false;
    if (enPrice) {
      if (scope === "perproduct") {
        ppMargin = document.getElementById("pbm-pp-margin").checked;
        ppCosts = {};
        pbmPpList.querySelectorAll(".pbm-pp-row").forEach((row) => {
          const id = Number(row.dataset.id);
          const v = row.querySelector(".pbm-pp-cost").value.trim();
          const old = Number(row.querySelector(".pbm-pp-pct").dataset.old) || 0;
          if (v === "") return;
          const nc = Math.max(0, round2(Number(v)));
          if (nc !== old) ppCosts[id] = nc;
        });
        if (!Object.keys(ppCosts).length) return fail("Ingresá al menos un costo nuevo distinto del actual.");
      } else {
        priceMode = (document.querySelector('input[name="pbm-price-mode"]:checked') || {}).value;
        if (priceMode === "pct") {
          pricePct = Number(document.getElementById("pbm-price-pct").value);
          if (!pricePct) return fail("Ingresá un % distinto de 0.");
          priceTargets = [...document.querySelectorAll('#pbm-price-pct-row input[type=checkbox]:checked')].map((c) => c.dataset.field);
          if (!priceTargets.length) return fail("Elegí a qué columnas aplicar el %.");
        } else {
          priceSetField = document.getElementById("pbm-price-field").value;
          priceSetVal = Math.max(0, round2(Number(document.getElementById("pbm-price-value").value) || 0));
          priceSetMargin = priceSetField === "cost" && document.getElementById("pbm-price-margin").checked;
        }
      }
    }
    const catId = enCat ? (Number(els.pbmCat.value) || null) : null;
    const stockOp = enStock ? document.getElementById("pbm-stock-op").value : null;
    const stockVal = enStock ? Math.round(Number(document.getElementById("pbm-stock-value").value) || 0) : 0;
    const activeVal = enActive ? Number((document.querySelector('input[name="pbm-active"]:checked') || {}).value) : null;

    if (ids.length > 20 && !(await confirmModal("Vas a modificar " + ids.length + " productos. ¿Confirmás?"))) return;

    const factor = (enPrice && scope === "uniform" && priceMode === "pct") ? 1 + pricePct / 100 : 1;
    const patches = ids.map((id) => {
      const p = state.products.find((x) => x.id === id) || {};
      const patch = { id };
      if (enPrice) {
        if (scope === "perproduct") {
          const nc = ppCosts[id];
          if (nc != null) {
            patch.cost = nc;
            // Subir precios de venta manteniendo el margen: escalar por costoNuevo/costoViejo.
            if (ppMargin && (p.cost || 0) > 0 && nc > 0) {
              const ratio = nc / p.cost;
              ["price_minorista", "price_revendedor", "price_mayorista", "price_vip", "price_publico"]
                .forEach((f) => { patch[f] = Math.max(0, round2((p[f] || 0) * ratio)); });
            }
          }
        } else if (priceMode === "pct") {
          priceTargets.forEach((f) => { patch[f] = Math.max(0, round2((p[f] || 0) * factor)); });
        } else {
          patch[priceSetField] = priceSetVal;
          // Fijar costo + mantener margen: escalar los 5 precios por costoNuevo/costoViejo.
          if (priceSetMargin && (p.cost || 0) > 0 && priceSetVal > 0) {
            const ratio = priceSetVal / p.cost;
            ["price_minorista", "price_revendedor", "price_mayorista", "price_vip", "price_publico"]
              .forEach((f) => { patch[f] = Math.max(0, round2((p[f] || 0) * ratio)); });
          }
        }
      }
      if (enCat) patch.category_id = catId;
      if (enStock) {
        const cur = Number(p.stock) || 0;
        patch.stock = stockOp === "set" ? Math.max(0, stockVal) : stockOp === "add" ? cur + stockVal : Math.max(0, cur - stockVal);
      }
      if (enActive) patch.active = activeVal;
      return patch;
    });

    els.pbmApply.disabled = true; els.pbmApply.textContent = "Aplicando…";
    try {
      const res = await api("/api/admin/products/bulk-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patches }),
      });
      const catName = enCat ? ((state.allCategories || []).find((c) => c.id === catId) || {}).name : null;
      patches.forEach((pt) => {
        const p = state.products.find((x) => x.id === pt.id);
        if (!p) return;
        const cp = Object.assign({}, pt); delete cp.id;
        Object.assign(p, cp);
        if (enCat) p.category_name = catName || "—";
      });
      els.pbmModal.hidden = true;
      setSelectMode(false);
      applyFilters();
      showToast("✅ " + (res.updated != null ? res.updated : patches.length) + " producto(s) actualizado(s)" + (res.failed ? " · " + res.failed + " con error" : ""), res.failed ? "err" : "ok");
    } catch (err) {
      fail("Error: " + err.message);
    } finally {
      els.pbmApply.disabled = false; els.pbmApply.textContent = "Aplicar cambios";
    }
  });

  els.prodSearch.addEventListener("input", debounce(applyFilters, 200));
  els.filterCategory.addEventListener("change", applyFilters);
  els.filterStock.addEventListener("change", applyFilters);
  els.filterState.addEventListener("change", applyFilters);
  if (els.filterClear) els.filterClear.addEventListener("click", () => {
    els.prodSearch.value = "";
    els.filterCategory.value = "all";
    els.filterStock.value = "all";
    els.filterState.value = "all";
    applyFilters();
  });
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
          '<li>Fuera del Excel (stock preservado): <strong>' + (s.preservados || 0) + '</strong></li>' +
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

  // ---------- Listas de precios para pedidos (crear y editar) ----------
  // Mapea el nivel base de una lista a su columna en products (mirror server:
  // priceColumnForBaseLevel). "costo" usa products.cost; el resto price_<nivel>.
  var PL_BASE_COL = {
    costo: "cost", minorista: "price_minorista", revendedor: "price_revendedor",
    mayorista: "price_mayorista", vip: "price_vip", publico: "price_publico",
  };
  var ORDER_LEVEL_NAME = { 1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP" };
  var ORDER_LEVEL_COL  = { 1: "price_minorista", 2: "price_revendedor", 3: "price_mayorista", 4: "price_vip" };

  // Precio efectivo de un producto según la config { column, markup }.
  // Aplica la fórmula de ganancia sobre venta (mirror server computeEffectivePrice):
  //   precio = round(base / (1 - markup/100))
  function orderEffPrice(prod, cfg) {
    if (!prod || !cfg) return 0;
    var base = Math.max(0, Number(prod[cfg.column]) || 0);
    var m = Number(cfg.markup) || 0;
    if (!m) return base;
    var denom = 1 - m / 100;
    if (denom <= 0) return base;
    return Math.round(base / denom);
  }

  // Construye la config de precio a partir de un valor de <select>:
  //   "level:N" -> nivel base ; "list:ID" -> lista personalizada
  function orderCfgFromSel(sel) {
    sel = String(sel || "");
    if (sel.indexOf("list:") === 0) {
      var id = Number(sel.slice(5));
      var pl = (state.priceLists || []).find(function(l) { return l.id === id; });
      if (pl) {
        return { sel: "list:" + pl.id, column: PL_BASE_COL[pl.base_level] || "price_minorista",
                 markup: Number(pl.markup_percent) || 0, label: pl.name };
      }
    }
    var lvl = sel.indexOf("level:") === 0 ? Number(sel.slice(6)) : 1;
    if (!ORDER_LEVEL_COL[lvl]) lvl = 1;
    return { sel: "level:" + lvl, column: ORDER_LEVEL_COL[lvl], markup: 0,
             label: ORDER_LEVEL_NAME[lvl] || "Minorista" };
  }

  // Valor de <select> que corresponde al precio "por defecto" de un cliente:
  // su lista personalizada activa si tiene, sino su nivel.
  function orderDefaultSel(level, priceListId) {
    if (priceListId) {
      var pl = (state.priceLists || []).find(function(l) { return l.id === priceListId && l.active; });
      if (pl) return "list:" + pl.id;
    }
    var lvl = Number(level) || 1;
    if (!ORDER_LEVEL_COL[lvl]) lvl = 1;
    return "level:" + lvl;
  }

  // Llena un <select> de listas de precios: opciones de nivel base + listas
  // personalizadas activas. Deja seleccionado selectedSel.
  function fillOrderPriceListSelect(selectEl, selectedSel) {
    if (!selectEl) return;
    var html = '<optgroup label="Nivel base">';
    [1, 2, 3, 4].forEach(function(lvl) {
      html += '<option value="level:' + lvl + '">' + ORDER_LEVEL_NAME[lvl] + "</option>";
    });
    html += "</optgroup>";
    var lists = (state.priceLists || []).filter(function(l) { return l.active; });
    if (lists.length) {
      html += '<optgroup label="Listas personalizadas">';
      lists.forEach(function(pl) {
        html += '<option value="list:' + pl.id + '">' + escapeHtml(pl.name) +
          " (" + escapeHtml(pl.base_level) + ", gana " + (Number(pl.markup_percent) || 0) + "%)</option>";
      });
      html += "</optgroup>";
    }
    selectEl.innerHTML = html;
    selectEl.value = selectedSel || "level:1";
    if (!selectEl.value) selectEl.value = "level:1";
  }

  // Asegura que state.priceLists esté cargado (las pestañas Pedidos no lo cargan).
  async function ensurePriceListsLoaded() {
    if (state.priceListsLoaded) return;
    try {
      state.priceLists = await api("/api/admin/price-lists");
      state.priceListsLoaded = true;
    } catch (_) { state.priceLists = state.priceLists || []; }
  }

  // ---------- Descuentos por línea (compartido por Nuevo pedido y Editar items) ----------
  // Modelo: cada item lleva discount_percent (0..100). unit_price = precio de
  // lista (bruto); el subtotal neto = unit_price·qty·(1−d/100). El descuento
  // "general" se reparte como un % uniforme. El toggle %/$ solo cambia cómo se
  // ingresa/muestra el descuento; internamente siempre es un %.
  function clampDiscPct(p) { p = Number(p); if (!isFinite(p)) p = 0; return Math.max(0, Math.min(100, p)); }
  function lineGross(it) { return (Number(it.unit_price) || 0) * Math.max(1, Number(it.quantity) || 1); }
  function lineNetSub(it) { return round2(lineGross(it) * (1 - clampDiscPct(it.discount_percent) / 100)); }
  function lineDiscAmount(it) { return round2(lineGross(it) * clampDiscPct(it.discount_percent) / 100); }
  function discAmountToPct(it, amount) { var g = lineGross(it); if (g <= 0) return 0; return clampDiscPct((Number(amount) || 0) / g * 100); }
  function itemsGross(list) { return (list || []).reduce(function(s, it) { return s + lineGross(it); }, 0); }
  function itemsDiscTotal(list) { return round2((list || []).reduce(function(s, it) { return s + lineDiscAmount(it); }, 0)); }
  function itemsNetTotal(list) { return round2((list || []).reduce(function(s, it) { return s + lineNetSub(it); }, 0)); }

  // Celda de descuento de una línea (input en la unidad activa). idxAttr opcional.
  function discCellHtml(it, idx, unit) {
    var val = unit === "amount" ? lineDiscAmount(it) : round2(clampDiscPct(it.discount_percent));
    return '<input type="number" class="cell-input cell-num line-disc" min="0" step="0.01" value="' +
      (val || 0) + '" data-idx="' + idx + '" style="width:74px" ' +
      'title="Descuento de esta línea (en ' + (unit === "amount" ? "$" : "%") + ')">';
  }
  // Aplica el valor escrito en una celda de descuento al item (según la unidad).
  function applyDiscCell(it, rawValue, unit) {
    if (unit === "amount") it.discount_percent = discAmountToPct(it, rawValue);
    else it.discount_percent = clampDiscPct(rawValue);
  }
  // Barra de descuento general (toggle %/$ + campo general + aplicar/quitar + total).
  function discountBarHtml(unit) {
    return '<div class="oie-disc-bar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;' +
      'margin-top:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px">' +
      '<strong style="font-size:12px;color:#374151">Descuento</strong>' +
      '<span class="oie-disc-unit" style="display:inline-flex;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden">' +
        '<button type="button" class="oie-unit-btn" data-unit="percent" style="border:none;padding:4px 10px;cursor:pointer;font-weight:700;' +
          (unit !== "amount" ? "background:#1e3a5f;color:#fff" : "background:#fff;color:#374151") + '">%</button>' +
        '<button type="button" class="oie-unit-btn" data-unit="amount" style="border:none;padding:4px 10px;cursor:pointer;font-weight:700;' +
          (unit === "amount" ? "background:#1e3a5f;color:#fff" : "background:#fff;color:#374151") + '">$</button>' +
      '</span>' +
      '<input type="number" class="oie-disc-gen cell-input cell-num" min="0" step="0.01" placeholder="General" ' +
        'style="width:90px" title="Descuento general para todo el pedido">' +
      '<button type="button" class="btn btn-small oie-disc-apply">Aplicar a todos</button>' +
      '<button type="button" class="btn btn-small oie-disc-clear">Quitar</button>' +
      '<span style="flex:1"></span>' +
      '<span class="oie-disc-total" style="font-size:13px;color:#b45309;font-weight:700"></span>' +
    '</div>';
  }
  // Cablea la barra de descuento. ctx = { getItems, getUnit, setUnit, rerender }.
  function wireDiscountBar(barEl, ctx) {
    if (!barEl) return;
    function refreshTotal() {
      var t = barEl.querySelector(".oie-disc-total");
      var d = itemsDiscTotal(ctx.getItems());
      if (t) t.textContent = d > 0 ? "Descuento total: " + fmtPrice(d) : "";
    }
    barEl.querySelectorAll(".oie-unit-btn").forEach(function(b) {
      b.addEventListener("click", function() {
        var u = b.dataset.unit === "amount" ? "amount" : "percent";
        ctx.setUnit(u);
        barEl.querySelectorAll(".oie-unit-btn").forEach(function(x) {
          var on = x.dataset.unit === u;
          x.style.background = on ? "#1e3a5f" : "#fff";
          x.style.color = on ? "#fff" : "#374151";
        });
        ctx.rerender();
        refreshTotal();
      });
    });
    var apply = barEl.querySelector(".oie-disc-apply");
    if (apply) apply.addEventListener("click", function() {
      var inp = barEl.querySelector(".oie-disc-gen");
      var raw = Number(inp && inp.value) || 0;
      var items = ctx.getItems();
      if (ctx.getUnit() === "amount") {
        // Repartir el monto general proporcional al bruto → % uniforme.
        var g = itemsGross(items);
        var pct = g > 0 ? clampDiscPct(raw / g * 100) : 0;
        items.forEach(function(it) { it.discount_percent = pct; });
      } else {
        var p = clampDiscPct(raw);
        items.forEach(function(it) { it.discount_percent = p; });
      }
      ctx.rerender();
      refreshTotal();
    });
    var clear = barEl.querySelector(".oie-disc-clear");
    if (clear) clear.addEventListener("click", function() {
      ctx.getItems().forEach(function(it) { it.discount_percent = 0; });
      var inp = barEl.querySelector(".oie-disc-gen");
      if (inp) inp.value = "";
      ctx.rerender();
      refreshTotal();
    });
    barEl._refreshDiscTotal = refreshTotal;
    refreshTotal();
  }

  // ---------- Crear pedido desde admin ----------
  var noItems = [];   // items del nuevo pedido en construcción
  var noDiscUnit = "percent";   // unidad activa del descuento (percent|amount)
  var noPriceCfg = orderCfgFromSel("level:1");   // config de precio activa del nuevo pedido

  function noRecalc() {
    return itemsNetTotal(noItems);
  }

  function noRenderItems() {
    if (!els.noItemsTbody) return;
    if (!noItems.length) {
      els.noItemsTbody.innerHTML = '<tr><td colspan="7" class="muted" style="padding:12px;text-align:center">Sin artículos. Usá "+ Agregar productos".</td></tr>';
    } else {
      els.noItemsTbody.innerHTML = noItems.map(function(it, idx) {
        return '<tr>' +
          '<td data-label="Código"><code>' + escapeHtml(it.product_code) + '</code></td>' +
          '<td class="no-cell-name" data-label="Producto">' + escapeHtml(it.product_name) + '</td>' +
          '<td data-label="Cant." style="text-align:right"><input type="number" class="cell-input cell-num no-qty" min="1" step="1" value="' + it.quantity + '" data-idx="' + idx + '" style="width:60px"></td>' +
          '<td data-label="P. Unit." style="text-align:right">' + fmtPrice(it.unit_price) + '</td>' +
          '<td data-label="Desc." style="text-align:right">' + discCellHtml(it, idx, noDiscUnit) + '</td>' +
          '<td data-label="Subtotal" style="text-align:right;font-weight:600" class="no-sub">' + fmtPrice(lineNetSub(it)) + '</td>' +
          '<td class="no-cell-rm"><button type="button" class="btn btn-small no-rm" data-idx="' + idx + '">✕</button></td>' +
          '</tr>';
      }).join("");
      // qty change: actualizar en el lugar mientras se tipea. NO re-renderizar
      // acá, porque eso destruye el <input> y en mobile se cierra el teclado
      // (solo se puede ingresar un dígito). Se normaliza recién al salir (change).
      els.noItemsTbody.querySelectorAll(".no-qty").forEach(function(inp) {
        inp.addEventListener("input", function() {
          var idx = Number(this.dataset.idx);
          noItems[idx].quantity = Math.max(1, Math.floor(Number(this.value) || 1));
          var tr = this.closest("tr");
          var sub = tr ? tr.querySelector(".no-sub") : null;
          if (sub) sub.textContent = fmtPrice(lineNetSub(noItems[idx]));
          noUpdateTotal();
        });
        inp.addEventListener("change", function() { noRenderItems(); });
      });
      // descuento por línea
      els.noItemsTbody.querySelectorAll(".line-disc").forEach(function(inp) {
        inp.addEventListener("input", function() {
          var idx = Number(this.dataset.idx);
          applyDiscCell(noItems[idx], this.value, noDiscUnit);
          var tr = this.closest("tr");
          var sub = tr ? tr.querySelector(".no-sub") : null;
          if (sub) sub.textContent = fmtPrice(lineNetSub(noItems[idx]));
          noUpdateTotal();
        });
      });
      // remove
      els.noItemsTbody.querySelectorAll(".no-rm").forEach(function(btn) {
        btn.addEventListener("click", function() {
          noItems.splice(Number(this.dataset.idx), 1);
          noRenderItems();
        });
      });
    }
    noUpdateTotal();
  }

  function noUpdateTotal() {
    if (els.noTotalDisp) {
      var d = itemsDiscTotal(noItems);
      els.noTotalDisp.textContent = (d > 0 ? "Descuento: " + fmtPrice(d) + "  ·  " : "") + "Total: " + fmtPrice(noRecalc());
    }
    var bar = els.newOrderModal ? els.newOrderModal.querySelector(".oie-disc-bar .oie-disc-total") : null;
    if (bar) { var dt = itemsDiscTotal(noItems); bar.textContent = dt > 0 ? "Descuento total: " + fmtPrice(dt) : ""; }
  }

  async function noOpenModal() {
    noItems = [];
    noDiscUnit = "percent";
    if (els.noNotes) els.noNotes.value = "";
    if (els.noStatus) els.noStatus.value = "pendiente";
    // Barra de descuento general (toggle %/$ + aplicar a todos).
    if (els.noDiscBar) {
      els.noDiscBar.innerHTML = discountBarHtml(noDiscUnit);
      wireDiscountBar(els.noDiscBar.querySelector(".oie-disc-bar"), {
        getItems: function() { return noItems; },
        getUnit: function() { return noDiscUnit; },
        setUnit: function(u) { noDiscUnit = u; },
        rerender: noRenderItems,
      });
    }
    noRenderItems();
    // Necesitamos las listas de precios para el selector y para calcular precios.
    await ensurePriceListsLoaded();
    // Poblar select de clientes (level 1-4 activos).
    // Usa state.users si ya están cargados; si no, los carga ahora.
    if (els.noClient) {
      els.noClient.innerHTML = '<option value="">Consumidor final</option>';
      try {
        if (!(state.users && state.users.length)) {
          state.users = await api("/api/admin/users");
        }
        var clients = (state.users || []).filter(function(u) { return Number(u.level) >= 1 && Number(u.level) <= 4 && u.active; });
        clients.sort(function(a, b) { return (a.full_name || a.username).localeCompare(b.full_name || b.username); });
        clients.forEach(function(c) {
          var opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.full_name || c.username;
          els.noClient.appendChild(opt);
        });
      } catch (_) {}
    }
    // Config de precio inicial = la del cliente seleccionado (o Consumidor final → minorista).
    noSyncPriceListToClient();
    if (els.newOrderModal) els.newOrderModal.hidden = false;
  }

  // Ajusta el selector de lista a la lista por defecto del cliente elegido y
  // actualiza noPriceCfg (sin recalcular items: se usa al abrir o al cambiar cliente).
  function noSyncPriceListToClient() {
    var sel = "level:1";
    if (els.noClient && els.noClient.value) {
      var client = (state.users || []).find(function(u) { return u.id === Number(els.noClient.value); });
      if (client) sel = orderDefaultSel(client.level, client.price_list_id);
    }
    fillOrderPriceListSelect(els.noPriceList, sel);
    noPriceCfg = orderCfgFromSel(els.noPriceList ? els.noPriceList.value : sel);
  }

  // Recalcula el precio unitario de los items ya cargados con la config activa.
  function noRepriceItems() {
    noItems.forEach(function(it) {
      var prod = (state.allProducts || []).find(function(p) { return p.id === it.product_id; });
      if (prod) it.unit_price = orderEffPrice(prod, noPriceCfg);
    });
    noRenderItems();
  }

  function noCloseModal() {
    if (els.newOrderModal) els.newOrderModal.hidden = true;
  }

  async function noSave() {
    if (!noItems.length) { showToast("Agregá al menos un artículo", "error"); return; }
    els.noSaveBtn.disabled = true;
    try {
      var order = await api("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: els.noClient && els.noClient.value ? Number(els.noClient.value) : null,
          status: els.noStatus ? els.noStatus.value : "pendiente",
          notes: els.noNotes ? els.noNotes.value.trim() : "",
          items: noItems.map(function(it) {
            return { product_id: it.product_id, product_code: it.product_code,
                     product_name: it.product_name, quantity: it.quantity, unit_price: it.unit_price,
                     discount_percent: clampDiscPct(it.discount_percent) };
          }),
        }),
      });
      // Insertar en state y re-renderizar
      if (!state.orders) state.orders = [];
      state.orders.unshift(order);
      populateClientFilter(state.orders);
      renderOrders();
      noCloseModal();
      showToast("Pedido #" + order.id + " creado");
      // El pedido descontó stock al crearse → refrescar la tabla de Productos.
      refreshProductsCache();
    } catch (e) {
      showToast("Error: " + e.message, "error");
    } finally {
      els.noSaveBtn.disabled = false;
    }
  }

  // Usa el mismo picker de productos que la edición de pedidos (oie-picker-modal)
  // pero al confirmar agrega a noItems en vez de a editItems. El precio sale de
  // la config activa (lista del cliente o la que el admin haya elegido).
  function noOpenPicker() {
    openOrderItemPicker(noItems, noPriceCfg, noRenderItems);
  }

  if (els.newOrderBtn) els.newOrderBtn.addEventListener("click", noOpenModal);
  if (els.noAddBtn) els.noAddBtn.addEventListener("click", noOpenPicker);
  if (els.noSaveBtn) els.noSaveBtn.addEventListener("click", noSave);
  // Al cambiar de cliente: ajustar la lista por defecto y reprecios los items.
  if (els.noClient) els.noClient.addEventListener("change", function() {
    noSyncPriceListToClient();
    noRepriceItems();
  });
  // Al cambiar la lista manualmente: recalcular precios de los items cargados.
  if (els.noPriceList) els.noPriceList.addEventListener("change", function() {
    noPriceCfg = orderCfgFromSel(els.noPriceList.value);
    noRepriceItems();
  });

  // ----- Crear cliente rápido desde el modal de Nuevo pedido -----
  // Convierte un nombre en un usuario sugerido (minúsculas, sin acentos ni espacios).
  function slugifyUsername(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")  // saca acentos
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 32);
  }

  function noOpenClientCreate() {
    if (!els.noClientCreateForm) return;
    els.noClientCreateForm.reset();
    if (els.noClientCreateMsg) { els.noClientCreateMsg.textContent = ""; els.noClientCreateMsg.className = "config-msg"; }
    if (els.noClientCreateModal) els.noClientCreateModal.hidden = false;
    setTimeout(function() {
      var f = els.noClientCreateForm.querySelector('[name="full_name"]');
      if (f) f.focus();
    }, 50);
  }
  function noCloseClientCreate() {
    if (els.noClientCreateModal) els.noClientCreateModal.hidden = true;
  }

  if (els.noNewClientBtn) els.noNewClientBtn.addEventListener("click", noOpenClientCreate);
  if (els.noClientCreateModal) {
    els.noClientCreateModal.addEventListener("click", function(e) {
      if (e.target.matches("[data-close='no-client-create-modal']")) noCloseClientCreate();
    });
  }
  // Autocompletar usuario a partir del nombre mientras el campo usuario esté vacío
  // o no haya sido tocado a mano.
  if (els.noClientCreateForm) {
    var unameInput = els.noClientCreateForm.querySelector('[name="username"]');
    var fnameInput = els.noClientCreateForm.querySelector('[name="full_name"]');
    var unameTouched = false;
    if (unameInput) unameInput.addEventListener("input", function() { unameTouched = true; });
    if (fnameInput && unameInput) {
      fnameInput.addEventListener("input", function() {
        if (!unameTouched) unameInput.value = slugifyUsername(fnameInput.value);
      });
    }
    // Reset del flag al abrir el modal de creación.
    if (els.noNewClientBtn) els.noNewClientBtn.addEventListener("click", function() { unameTouched = false; });

    els.noClientCreateForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      var fd = new FormData(els.noClientCreateForm);
      var level = Number(fd.get("level")) || 1;
      var body = {
        username: String(fd.get("username") || "").trim(),
        password: String(fd.get("password") || ""),
        full_name: String(fd.get("full_name") || "").trim(),
        level: level,
        whatsapp_number: String(fd.get("whatsapp_number") || "").trim() || null,
      };
      if (!body.full_name) { showClientCreateMsg("Poné el nombre del cliente.", true); return; }
      if (!body.username)  { showClientCreateMsg("Poné un usuario.", true); return; }
      if (body.password.length < 6) { showClientCreateMsg("La contraseña debe tener al menos 6 caracteres.", true); return; }
      showClientCreateMsg("Creando…", false);
      try {
        var out = await api("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        // Agregar al cache de usuarios y al selector, y dejarlo seleccionado.
        if (!state.users) state.users = [];
        state.users.unshift(out.user);
        state.orderClientsLoaded = false; // refrescar el selector "Cliente" del detalle de pedido
        if (els.noClient) {
          var opt = document.createElement("option");
          opt.value = out.user.id;
          opt.textContent = out.user.full_name || out.user.username;
          els.noClient.appendChild(opt);
          els.noClient.value = String(out.user.id);
        }
        // Sincronizar la lista de precios al cliente nuevo y reprecios.
        noSyncPriceListToClient();
        noRepriceItems();
        noCloseClientCreate();
        showToast("Cliente " + (out.user.full_name || out.user.username) + " creado");
      } catch (err) {
        showClientCreateMsg(err.message, true);
      }
    });
  }
  function showClientCreateMsg(txt, isErr) {
    if (!els.noClientCreateMsg) return;
    els.noClientCreateMsg.textContent = txt;
    els.noClientCreateMsg.className = "config-msg" + (isErr ? " err" : "");
  }
  if (els.newOrderModal) {
    els.newOrderModal.addEventListener("click", function(e) {
      if (e.target.matches("[data-close='new-order-modal']")) noCloseModal();
    });
  }

  // ---------- Eliminar pedido ----------
  async function deleteOrder(id) {
    var order = (state.orders || []).find(function(o) { return o.id === id; });
    if (order && order.status === "entregado") {
      showToast("No se puede eliminar un pedido entregado", "error"); return;
    }
    var confirmed = await vConfirm("¿Eliminar pedido #" + id + "?\nEsta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      await api("/api/admin/orders/" + id, { method: "DELETE" });
      state.orders = (state.orders || []).filter(function(o) { return o.id !== id; });
      populateClientFilter(state.orders);
      renderOrders();
      refreshOrderViews();
      refreshProductsCache(); // al eliminar se devuelve el stock
      showToast("Pedido #" + id + " eliminado");
    } catch (e) {
      showToast("Error: " + e.message, "error");
    }
  }

  // vConfirm: confirmación con el modal propio (string o {opts}).
  function vConfirm(msg) {
    return confirmModal(msg);
  }

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
    var statusLabel = orderStatusLabel(o.status);
    var clientLabel = escapeHtml(o.full_name || o.username || "—");
    // En pedidos entregados mostramos la fecha de ENTREGA (es la que define la
    // venta y por la que filtra la pestaña Ventas), no la de creación, para que
    // no confunda ("se creó el 01/06 pero se entregó/vendió esta semana").
    var dateLabel = (o.status === "entregado" && o.delivered_at)
      ? "Entregado " + formatDate(o.delivered_at)
      : formatDate(o.created_at);
    var totalLabel = fmtPrice(o.total || 0);

    var vendBadge = "";
    if (o.assigned_vendedor_id) {
      var vendName = escapeHtml(o.vendedor_full_name || o.vendedor_username || "#" + o.assigned_vendedor_id);
      vendBadge = ' <span class="vend-badge">' + vendName + "</span>";
    }

    var delivBadge = "";
    if (o.delivery_id) {
      var cb = ventaCobro(o);
      delivBadge = ' <span class="delivery-badge">Cobrado: ' + fmtPrice(cb.cobrado) + "</span>";
      // Estado del cobro del pedido (refleja pagos posteriores a la entrega).
      delivBadge += cb.saldado
        ? ' <span class="vt-pill vt-paid">✔ Saldado</span>'
        : ' <span class="vt-pill vt-unpaid" title="Cobrado ' + fmtPrice(cb.cobrado) + " de " + fmtPrice(cb.neto) + '">Debe ' + fmtPrice(cb.falta) + "</span>";
    }

    // "Registrar entrega" solo en la etapa de Entregas (estado `listo`) o para
    // VER una entrega ya hecha (`entregado` o si ya hay delivery). En Pedidos
    // (pendiente/enviado) y Armado (preparando) no se entrega: primero se arma y
    // se avanza por el circuito (botón → Armado / → Entregas).
    // Cancelado NUNCA muestra el botón: re-guardar la entrega de un pedido
    // cancelado lo resucitaba a entregado (el server ahora también lo rechaza).
    var delivBtn = "";
    if (o.status !== "cancelado" && (o.status === "listo" || o.status === "entregado" || o.delivery_id)) {
      var hasDelivery = o.delivery_id ? "1" : "0";
      var delivLabel = o.delivery_id ? "Ver entrega" : "Registrar entrega";
      delivBtn = '<button class="btn btn-small btn-deliver" data-id="' + o.id +
        '" data-has-delivery="' + hasDelivery + '" type="button">' + delivLabel + "</button>";
    }

    // Botón para avanzar el pedido a la siguiente etapa del circuito.
    // Solo el admin maneja Armado/Entregas; el vendedor solo puede marcar
    // "entregado" (el PATCH le rechaza otros estados).
    var advBtn = "";
    if (state.isAdmin && (o.status === "pendiente" || o.status === "enviado")) {
      advBtn = '<button class="btn btn-small btn-primary btn-advance" data-id="' + o.id +
        '" data-to="preparando" type="button">→ Armado</button>';
    } else if (state.isAdmin && o.status === "preparando") {
      advBtn = '<button class="btn btn-small btn-primary btn-advance" data-id="' + o.id +
        '" data-to="listo" type="button">→ Entregas</button>';
    }

    var delBtn = "";
    if (state.isAdmin && o.status !== "entregado") {
      delBtn = '<button class="btn btn-small btn-x btn-delete-order" data-id="' + o.id +
        '" type="button" title="Eliminar pedido">✕</button>';
    }

    // Chequeo de armado: checklist de picking (solo admin, pedidos en armado).
    // El botón muestra el avance (hecho/total); badge verde cuando está completo.
    var pickBtn = "";
    var pickBadge = "";
    if (state.isAdmin && o.status === "preparando") {
      var ptot = Number(o.pick_total) || 0;
      var pdone = Number(o.pick_done) || 0;
      var pickInfo = ptot > 0 && pdone > 0 ? " " + pdone + "/" + ptot : "";
      pickBtn = '<button class="btn btn-small btn-pick" data-id="' + o.id +
        '" type="button" title="Checklist de armado (sincroniza entre dispositivos)">📋 Chequeo' + pickInfo + "</button>";
      if (ptot > 0 && pdone >= ptot) {
        pickBadge = ' <span class="pick-badge-ok">✔ Armado completo</span>';
      }
    }

    return '<article class="order-card" data-id="' + o.id + '">' +
      '<div class="order-head">' +
        '<div>' +
          '<h4 class="order-client">' + clientLabel +
            ' <span class="order-status ' + (o.status || "") + '">' + escapeHtml(statusLabel) + "</span>" +
            vendBadge + delivBadge + pickBadge +
          "</h4>" +
          '<span class="meta">Pedido #' + o.id + " · " + dateLabel + "</span>" +
        "</div>" +
        '<div class="order-card-right">' +
          '<span class="order-total">' + totalLabel + "</span>" +
          pickBtn +
          advBtn +
          delivBtn +
          delBtn +
        "</div>" +
      "</div>" +
      '<div class="order-detail" hidden></div>' +
    "</article>";
  }

  // Clientes activos (level 1-4) para el selector "Cliente" del detalle.
  async function ensureOrderClients() {
    if (state.orderClientsLoaded) return;
    try {
      state.orderClients = await api("/api/clients");
      state.orderClientsLoaded = true;
    } catch (_) {}
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
      var fetches = [api("/api/orders/" + orderId)];
      if (state.isAdmin) fetches.push(ensureOrderClients());
      var order = (await Promise.all(fetches))[0];
      detailEl.dataset.loaded = "1";
      renderOrderDetail(detailEl, order);
      wireOrderDetail(detailEl, order);
    } catch (err) {
      detailEl.innerHTML = '<p class="muted err">Error: ' + escapeHtml(err.message) + "</p>";
    }
  }

  // Estados en los que el admin puede editar los items del pedido.
  // Entregado también: puede haberse olvidado cargar un item y hay que corregirlo.
  var ORDER_EDITABLE_STATUSES = ["pendiente", "enviado", "preparando", "listo", "entregado"];
  function orderItemsEditable(order) {
    return state.isAdmin && ORDER_EDITABLE_STATUSES.indexOf(order.status) !== -1;
  }

  function renderOrderDetail(detailEl, order) {
    var items = order.items || [];
    // ¿Algún item tiene descuento por línea? Si no, se omite la columna Desc.
    var anyDisc = items.some(function(it) { return Number(it.discount_percent) > 0; });
    var discTotal = Number(order.items_discount_total) || 0;
    var itemsTable = items.length
      ? "<table><thead><tr>" +
          "<th>Código</th><th>Producto</th><th>Cant.</th>" +
          '<th class="num">P. Unit.</th>' +
          (anyDisc ? '<th class="num">Desc.</th>' : "") +
          '<th class="num">Subtotal</th>' +
        "</tr></thead><tbody>" +
        items.map(function(it) {
          var dp = Number(it.discount_percent) || 0;
          var discCell = anyDisc
            ? '<td class="num">' + (dp > 0
                ? '<span style="color:#b45309;font-weight:600" title="−' + fmtPrice((Number(it.unit_price)||0)*(Number(it.quantity)||0)*dp/100) + '">−' + round2(dp) + "%</span>"
                : "—") + "</td>"
            : "";
          return "<tr>" +
            "<td><code>" + escapeHtml(it.product_code || "") + "</code></td>" +
            "<td>" + escapeHtml(it.product_name || "") + "</td>" +
            "<td>" + it.quantity + "</td>" +
            '<td class="num">' + fmtPrice(it.unit_price) + "</td>" +
            discCell +
            '<td class="num">' + fmtPrice(it.subtotal) + "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table>" +
        (discTotal > 0 ? '<div class="order-disc-total" style="text-align:right;margin-top:4px;font-size:12.5px;color:#b45309;font-weight:700">Descuento aplicado: ' + fmtPrice(discTotal) + "</div>" : "")
      : '<p class="muted">Sin items.</p>';
    // Saldo del pedido (cuenta corriente del pedido): adeudado / saldado.
    // balance_due = débitos − créditos del pedido; > 0 = todavía se debe.
    var balanceHtml = "";
    // Saldo del pedido con la MISMA lógica que la lista de Ventas (ventaCobro):
    // usa la cuenta corriente si el pedido tiene débito, sino cae al neto − cobrado
    // en la entrega. Así el detalle y la lista nunca se contradicen (un pedido que
    // figura "Debe" en Ventas muestra el saldo y el botón de cobro acá también).
    var cobro = ventaCobro(Object.assign({}, order, {
      debit_total: (Number(order.balance_due) || 0) + (Number(order.amount_paid) || 0)
    }));
    var balanceDue = cobro.falta;
    var amountPaid = cobro.cobrado;
    // "Registrar cobro" solo para pedidos ENTREGADOS. En la cola "Para entregar"
    // (listo) el cobro va dentro de "Registrar entrega", así que acá no se muestra
    // para no duplicar. En Pedidos/Armado tampoco (todavía no se cobra).
    var chargeableStatus = order.status === "entregado";
    var canCharge = state.isAdmin && balanceDue > 0.5 && chargeableStatus;
    if (state.isAdmin && chargeableStatus && (balanceDue > 0.5 || amountPaid > 0)) {
      balanceHtml = balanceDue > 0.5
        ? '<div class="order-balance order-balance-debt">💳 Saldo del pedido: <strong>Debe ' + fmtPrice(balanceDue) +
            '</strong> · cobrado ' + fmtPrice(amountPaid) + "</div>"
        : '<div class="order-balance order-balance-ok">💳 Pedido saldado · cobrado ' + fmtPrice(amountPaid) + "</div>";
    }
    // Acciones: editar items (solo estados pre-entrega), registrar cobro (si debe),
    // imprimir remito y compartir.
    var actionsRow = '<div class="order-items-actions">' +
      (orderItemsEditable(order) ? '<button type="button" class="btn btn-small order-edit-items">✏️ Editar items</button>' : "") +
      (canCharge ? '<button type="button" class="btn btn-small btn-primary order-charge">💵 Registrar cobro</button>' : "") +
      '<button type="button" class="btn btn-small order-print">🖨 Imprimir remito</button>' +
      '<button type="button" class="btn btn-small order-share">📤 Compartir</button>' +
      "</div>";
    var itemsHtml = '<div class="order-items-box">' + itemsTable + balanceHtml + actionsRow + "</div>";

    // Rentabilidad del pedido — SOLO admin. Viene calculada del server
    // (order.profitability) usando el costo actual de cada producto.
    var profitHtml = "";
    if (state.isAdmin && order.profitability) {
      var pf = order.profitability;
      var profit = Number(pf.profit) || 0;
      var margin = Number(pf.margin_pct) || 0;
      var color = profit > 0 ? "#047857" : (profit < 0 ? "#b91c1c" : "#6b7280");
      var discount = Number(pf.discount) || 0;
      var detailTxt = discount > 0
        ? "Ventas " + fmtPrice(pf.revenue_gross || 0) + " − Desc. " + fmtPrice(discount) +
          " = " + fmtPrice(pf.revenue || 0) + " · Costo " + fmtPrice(pf.cost_total || 0)
        : "Ventas " + fmtPrice(pf.revenue || 0) + " · Costo " + fmtPrice(pf.cost_total || 0);
      // Comisión del vendedor asignado: solo figura si hay vendedor Y ganancia > 0
      // (cliente con lista de precios). Sin vendedor o sin comisión, no se muestra nada.
      var vendHtml = "";
      if (pf.vendor && Number(pf.vendor.earning) > 0) {
        var vEarn = Number(pf.vendor.earning);
        var vTipo = pf.vendor.is_tercerizado ? " (tercerizado)" : "";
        vendHtml =
          '<span class="op-vendor" title="Comisión del vendedor = Σ (precio − costo del vendedor) por unidad">' +
            '👤 ' + escapeHtml(pf.vendor.name) + vTipo + ': ' +
            '<strong>' + fmtPrice(vEarn) + '</strong></span>';
        // Vendedor tercerizado: él le cobra al cliente y te rinde el total menos
        // su comisión. Mostramos cuánto te debe entregar a la distribuidora.
        if (pf.vendor.is_tercerizado) {
          var aRendir = Math.max(0, (Number(pf.revenue) || 0) - vEarn);
          vendHtml +=
            '<span class="op-rendir" title="Lo que el vendedor tercerizado debe entregarte: total cobrado al cliente − su comisión">' +
              '🤝 ' + escapeHtml(pf.vendor.name) + ' debe rendir: <strong>' + fmtPrice(aRendir) + '</strong></span>';
        }
      }
      profitHtml =
        '<div class="order-profit" title="Rentabilidad = ventas netas (con descuento) − costo actual de los productos">' +
          '<span class="op-lbl">💰 Rentabilidad</span>' +
          '<span class="op-main" style="color:' + color + '">' + fmtPrice(profit) +
            ' <span class="op-margin">(' + margin.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + '% margen)</span></span>' +
          vendHtml +
          '<span class="op-detail">' + detailTxt + '</span>' +
        "</div>";
    }

    // Opciones del select según rol y estado (espejo de la whitelist del server):
    // - Vendedor: solo puede marcar "entregado" (antes veía las 6 y recibía 403).
    // - Entregado: solo se puede cancelar (volverlo a pendiente rompía contabilidad).
    // - Cancelado: solo se puede reactivar a Pendiente.
    var statuses;
    if (!state.isAdmin) {
      statuses = order.status === "entregado" ? ["entregado"] : [order.status, "entregado"];
    } else if (order.status === "entregado") {
      statuses = ["entregado", "cancelado"];
    } else if (order.status === "cancelado") {
      statuses = ["cancelado", "pendiente"];
    } else {
      statuses = ["pendiente", "enviado", "preparando", "listo", "entregado", "cancelado"];
    }
    var statusOpts = statuses.map(function(s) {
      return '<option value="' + s + '"' + (order.status === s ? " selected" : "") + ">" + orderStatusLabel(s) + "</option>";
    }).join("");
    var statusRow = '<label>Estado<br>' +
      '<select class="order-status-select cell-select" data-order-id="' + order.id + '">' + statusOpts + "</select></label>";

    // Cliente del pedido (solo admin): permite corregir a quién pertenece,
    // p. ej. una venta que se cargó sin cliente y quedó a nombre del admin.
    var clientRow = "";
    if (state.isAdmin) {
      var clients = state.orderClients || [];
      var hasCurrent = clients.some(function(c) { return c.id === order.user_id; });
      var clientOpts =
        (hasCurrent ? "" : '<option value="' + order.user_id + '" selected>' +
          escapeHtml(order.full_name || order.username || "—") + "</option>") +
        clients.map(function(c) {
          return '<option value="' + c.id + '"' + (c.id === order.user_id ? " selected" : "") + ">" +
            escapeHtml(c.full_name || c.username) + "</option>";
        }).join("");
      clientRow = '<label>Cliente<br>' +
        '<select class="order-client-select cell-select" data-order-id="' + order.id + '">' + clientOpts + "</select></label>";
    }

    var vendRow = "";
    if (state.isAdmin) {
      var vendOpts = '<option value="">Sin asignar</option>' +
        (state.vendedores || []).map(function(v) {
          return '<option value="' + v.id + '"' + (order.assigned_vendedor_id === v.id ? " selected" : "") + ">" +
            escapeHtml(v.full_name || v.username) + "</option>";
        }).join("");
      vendRow = '<label>Vendedor<br>' +
        '<select class="order-vend-select cell-select" data-order-id="' + order.id + '">' + vendOpts + "</select></label>";
    }

    var delivInfo = "";
    if (order.delivery_id) {
      var delivDate = order.delivered_at ? formatDate(order.delivered_at) : "";
      var delivNote = order.delivery_notes
        ? '<div class="odi-note">📝 ' + escapeHtml(order.delivery_notes) + "</div>"
        : "";
      delivInfo = '<div class="order-delivery-info">' +
        '<span class="odi-label">Entrega</span>' +
        '<span><strong>' + escapeHtml(order.delivered_to || "—") + "</strong></span>" +
        (delivDate ? '<span class="odi-sep">·</span><span>' + delivDate + "</span>" : "") +
        '<span class="odi-sep">·</span>' +
        '<span>Efectivo: <strong>' + fmtPrice(order.efectivo_amount || 0) + "</strong></span>" +
        '<span class="odi-sep">·</span>' +
        '<span>Transfer.: <strong>' + fmtPrice(order.transferencia_amount || 0) + "</strong></span>" +
        delivNote +
      "</div>";
    }

    var notesHtml = order.notes
      ? '<p class="order-notes">📝 ' + escapeHtml(order.notes) + "</p>"
      : "";

    var budgetRef = order.budget_number
      ? '<p class="order-budget-ref">Facturado desde presupuesto ' + escapeHtml(order.budget_number) + "</p>"
      : "";

    // Cambios confirmados en el chequeo de armado (registro persistente).
    var pickChgHtml = "";
    if (order.pick_changes && order.pick_changes.length) {
      pickChgHtml = '<div class="order-pick-changes">' +
        '<span class="opc-lbl">📋 Cambios del armado</span><ul>' +
        order.pick_changes.map(function(c) {
          var nq = Number(c.new_qty);
          return "<li>" + escapeHtml(c.product_name || c.product_code || "") + ": " +
            Number(c.old_qty) + " → " +
            (nq > 0 ? nq : "0 (sin stock, quitado)") +
            (c.created_at ? ' <span class="opc-date">' + formatDate(c.created_at) + "</span>" : "") +
          "</li>";
        }).join("") +
      "</ul></div>";
    }

    detailEl.innerHTML =
      '<div class="order-detail-meta">' + statusRow + clientRow + vendRow + "</div>" +
      itemsHtml + pickChgHtml + profitHtml + notesHtml + delivInfo + budgetRef;
  }

  function wireOrderDetail(detailEl, order) {
    var statusSel = detailEl.querySelector(".order-status-select");
    if (statusSel) {
      statusSel.addEventListener("change", async function() {
        var newStatus = statusSel.value;
        var orderId = Number(statusSel.dataset.orderId);
        // Al cancelar se devuelve el stock de los productos del pedido: avisar.
        if (newStatus === "cancelado") {
          if (!await confirmModal({ message: "Al cancelar el pedido, los productos vuelven al stock.\n\n¿Confirmás la cancelación?", confirmText: "Cancelar pedido", cancelText: "Volver", danger: true })) {
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
          refreshOrderViews();
          // Cancelar devuelve stock; entregar puede descontarlo → refrescar Productos.
          if (newStatus === "cancelado" || newStatus === "entregado") refreshProductsCache();
          var card = detailEl.closest(".order-card");
          if (card) {
            var badge = card.querySelector(".order-status");
            if (badge) {
              badge.textContent = orderStatusLabel(newStatus);
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

    var clientSel = detailEl.querySelector(".order-client-select");
    if (clientSel) {
      clientSel.addEventListener("change", async function() {
        var newUserId = Number(clientSel.value);
        var orderId = Number(clientSel.dataset.orderId);
        try {
          await api("/api/admin/orders/" + orderId + "/assign", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: newUserId }),
          });
          var c = (state.orderClients || []).find(function(x) { return x.id === newUserId; });
          order.user_id = newUserId;
          if (c) { order.username = c.username; order.full_name = c.full_name; }
          var o = state.orders.find(function(x) { return x.id === orderId; });
          if (o) {
            o.user_id = newUserId;
            if (c) { o.username = c.username; o.full_name = c.full_name; }
          }
          refreshOrderViews();
          showToast("Cliente actualizado");
        } catch (err) {
          showToast("Error: " + err.message, "error");
          clientSel.value = String(order.user_id);
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

    var editItemsBtn = detailEl.querySelector(".order-edit-items");
    if (editItemsBtn) {
      editItemsBtn.addEventListener("click", function() {
        enterOrderItemsEdit(detailEl, order);
      });
    }

    var chargeBtn = detailEl.querySelector(".order-charge");
    if (chargeBtn) {
      chargeBtn.addEventListener("click", function() {
        openPaymentForOrder(order, detailEl);
      });
    }

    var printBtn = detailEl.querySelector(".order-print");
    if (printBtn) {
      printBtn.addEventListener("click", function() { printOrderRemito(order); });
    }

    var shareBtn = detailEl.querySelector(".order-share");
    if (shareBtn) {
      shareBtn.addEventListener("click", async function() {
        var clientName = order.full_name || order.username || "Pedido";
        var dateSlug = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "-");
        var fileName = clientName + " " + dateSlug + ".pdf";
        shareBtn.disabled = true;
        shareBtn.textContent = "…";
        try {
          await shareDocPdf("/api/admin/orders/" + order.id + "/pdf", fileName);
        } finally {
          shareBtn.disabled = false;
          shareBtn.textContent = "📤 Compartir";
        }
      });
    }
  }

  // Imprime un remito del pedido (lo que se preparó para entregar): productos,
  // cantidades, precios y total + espacio para firma. Abre ventana e imprime.
  function printOrderRemito(order) {
    var statusNames = ORDER_STATUS_LABELS; // fuente única
    var appName = (state.me && state.me.app_name) ? state.me.app_name : "Maxaria";
    var clientText = order.full_name || order.username || "—";
    var vendText = order.vendedor_full_name || order.vendedor_username || "";
    var date = new Date().toLocaleDateString("es-AR");
    var items = order.items || [];
    var anyDisc = items.some(function(it) { return Number(it.discount_percent) > 0; });
    var total = 0;
    var discTotalRem = 0;
    var rows = items.map(function(it) {
      var sub = Number(it.subtotal != null ? it.subtotal : (it.unit_price * it.quantity)) || 0;
      var dp = Number(it.discount_percent) || 0;
      var unitPrice = Number(it.unit_price) || 0;
      var gross = unitPrice * (Number(it.quantity) || 0);
      discTotalRem += Math.max(0, gross - sub);
      total += sub;
      var precioConDesc = Math.round(unitPrice * (1 - dp / 100) * 100) / 100;
      return "<tr>" +
        "<td class='col-cod'>" + escapeHtml(it.product_code || "") + "</td>" +
        "<td class='col-prod'>" + escapeHtml(it.product_name || "") + "</td>" +
        "<td class='col-cant'>" + escapeHtml(String(it.quantity)) + "</td>" +
        "<td class='col-price'>$" + unitPrice.toLocaleString("es-AR") + "</td>" +
        (anyDisc ? "<td class='col-disc'>" + (dp > 0 ? "−" + (Math.round(dp * 100) / 100) + "%" : "—") + "</td>" : "") +
        (anyDisc ? "<td class='col-precio'>" + (dp > 0 ? "$" + precioConDesc.toLocaleString("es-AR") : "—") + "</td>" : "") +
        "<td class='col-sub'>$" + sub.toLocaleString("es-AR") + "</td>" +
        "</tr>";
    }).join("");
    var totalUnidades = items.reduce(function(s, it) { return s + (Number(it.quantity) || 0); }, 0);
    var colCount = anyDisc ? 7 : 5;
    var budgetRef = order.budget_number ? "<p class='ref'>Facturado desde presupuesto " + escapeHtml(order.budget_number) + "</p>" : "";
    var html = "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
      "<title>Remito pedido #" + order.id + "</title>" +
      "<style>" +
      "*{box-sizing:border-box}" +
      "body{font-family:Arial,sans-serif;font-size:13px;margin:28px 32px;color:#111}" +
      ".header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}" +
      ".header-left h1{font-size:20px;font-weight:800;margin:0 0 2px;color:#1e3a5f}" +
      ".header-left .status{font-size:11px;color:#6b7280;margin:0}" +
      ".header-right{text-align:right}" +
      ".header-right .remito-label{font-size:11px;color:#6b7280;margin:0 0 1px;text-transform:uppercase;letter-spacing:.05em}" +
      ".header-right .remito-num{font-size:22px;font-weight:800;color:#1e3a5f;margin:0}" +
      ".meta-row{display:flex;gap:0;border-top:2px solid #1e3a5f;border-bottom:1px solid #d1d5db;padding:8px 0;margin-bottom:0;font-size:12.5px}" +
      ".meta-cell{flex:1;padding:0 12px;border-right:1px solid #d1d5db}" +
      ".meta-cell:first-child{padding-left:0}" +
      ".meta-cell:last-child{border-right:none}" +
      ".meta-cell span{display:block;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px}" +
      ".meta-cell strong{font-size:13px;color:#111}" +
      "table{width:100%;border-collapse:collapse;margin-top:0}" +
      "thead tr{background:#1e3a5f}" +
      "thead th{color:#fff;font-size:11px;font-weight:700;padding:7px 8px;text-align:left;letter-spacing:.03em;border-right:1px solid rgba(255,255,255,0.25)}" +
      "thead th:last-child{border-right:none}" +
      "tbody tr{border-bottom:1px solid #1e3a5f}" +
      "tbody tr:nth-child(even){background:#f8fafc}" +
      "tbody td{padding:6px 8px;font-size:12.5px;vertical-align:middle;border-right:1px solid #1e3a5f}" +
      "tbody td:last-child{border-right:none}" +
      ".col-cod{color:#6b7280;width:60px}" +
      ".col-prod{font-weight:600}" +
      ".col-cant{text-align:center;font-weight:700;width:56px}" +
      ".col-price{text-align:right;width:90px;color:#374151}" +
      ".col-disc{text-align:right;width:64px;color:#b45309;font-weight:600}" +
      ".col-precio{text-align:right;width:80px;color:#111}" +
      ".col-sub{text-align:right;width:90px;font-weight:700}" +
      ".summary-row{display:flex;justify-content:flex-end;align-items:baseline;gap:32px;border-top:2px solid #1e3a5f;padding:10px 8px 0}" +
      ".summary-meta{font-size:12px;color:#6b7280}" +
      ".grand-total{font-size:20px;font-weight:800;color:#1e3a5f}" +
      ".notes{margin-top:12px;font-size:12px;color:#6b7280;font-style:italic}" +
      ".ref{margin-top:10px;font-size:11px;color:#9ca3af;font-style:italic}" +
      "@media print{body{margin:14px 18px}}" +
      "</style>" +
      "</head><body>" +
      "<div class='header'>" +
        "<div class='header-left'>" +
          "<h1>" + escapeHtml(appName) + "</h1>" +
          "<p class='status'>Estado: " + escapeHtml(statusNames[order.status] || order.status || "") + "</p>" +
        "</div>" +
        "<div class='header-right'>" +
          "<p class='remito-label'>Remito de pedido</p>" +
          "<p class='remito-num'>N° " + order.id + "</p>" +
        "</div>" +
      "</div>" +
      "<div class='meta-row'>" +
        "<div class='meta-cell'><span>Fecha</span><strong>" + date + "</strong></div>" +
        "<div class='meta-cell'><span>Cliente</span><strong>" + escapeHtml(clientText) + "</strong></div>" +
        (vendText ? "<div class='meta-cell'><span>Vendedor</span><strong>" + escapeHtml(vendText) + "</strong></div>" : "") +
      "</div>" +
      "<table><thead><tr>" +
        "<th>Cód.</th><th>Producto</th>" +
        "<th style='text-align:center'>Cant.</th>" +
        "<th style='text-align:right'>P. Unit.</th>" +
        (anyDisc ? "<th style='text-align:right'>Desc.</th>" : "") +
        (anyDisc ? "<th style='text-align:right'>Precio</th>" : "") +
        "<th style='text-align:right'>Subtotal</th>" +
      "</tr></thead>" +
      "<tbody>" + (rows || "<tr><td colspan='" + colCount + "' style='padding:10px;color:#6b7280'>Sin items</td></tr>") + "</tbody>" +
      "</table>" +
      "<div class='summary-row'>" +
        "<span class='summary-meta'>" + items.length + " ítems &nbsp;·&nbsp; " + totalUnidades + " unidades" +
          (discTotalRem > 0 ? " &nbsp;·&nbsp; Descuento: $" + Math.round(discTotalRem).toLocaleString("es-AR") : "") + "</span>" +
        "<span class='grand-total'>TOTAL: $" + total.toLocaleString("es-AR") + "</span>" +
      "</div>" +
      (order.notes ? "<p class='notes'>" + escapeHtml(order.notes) + "</p>" : "") +
      budgetRef +
      "</body></html>";
    printHtml(html);
  }

  // Descarga el PDF de la URL dada y lo comparte vía Web Share API si está disponible,
  // o lo descarga directamente si el navegador no soporta sharing de archivos.
  async function shareDocPdf(url, fileName) {
    try {
      var resp = await fetch(url);
      if (!resp.ok) throw new Error("Error " + resp.status);
      var blob = await resp.blob();
      await sharePdfBlob(blob, fileName);
    } catch (e) {
      if (e.name !== "AbortError") showToast("No se pudo compartir: " + e.message, "error");
    }
  }

  // Comparte un blob PDF ya descargado vía Web Share API; si el navegador no
  // soporta compartir archivos, lo descarga directamente.
  async function sharePdfBlob(blob, fileName) {
    var file = new File([blob], fileName, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName });
    } else {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
    }
  }

  function printHtml(html) {
    var iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px;top:-9999px";
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(function() { document.body.removeChild(iframe); }, 1000);
  }

  // ---- Edición inline de los items de un pedido (estados pre-entrega) ----
  // Permite cambiar cantidades/precios, quitar y agregar productos. Al guardar
  // hace PUT /api/admin/orders/:id/items (el server recalcula total y ajusta
  // stock si el pedido ya lo tenía descontado).
  async function enterOrderItemsEdit(detailEl, order) {
    var box = detailEl.querySelector(".order-items-box");
    if (!box) return;
    await ensureAllProducts();
    await ensurePriceListsLoaded();
    // Config de precio activa: arranca en la lista por defecto del cliente.
    var editCfg = orderCfgFromSel(orderDefaultSel(order.client_level, order.client_price_list_id));
    var editDiscUnit = "percent";   // unidad activa del descuento (percent|amount)
    // Copia editable de los items actuales (incluye el descuento por línea).
    var editItems = (order.items || []).map(function(it) {
      return {
        product_id: it.product_id,
        product_code: it.product_code || "",
        product_name: it.product_name || "",
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_price: Math.max(0, Number(it.unit_price) || 0),
        discount_percent: clampDiscPct(it.discount_percent),
      };
    });

    // Recalcula el precio unitario de todos los items con la config activa.
    function repriceEdit() {
      editItems.forEach(function(it) {
        var prod = (state.allProducts || []).find(function(p) { return p.id === it.product_id; });
        if (prod) it.unit_price = orderEffPrice(prod, editCfg);
      });
      render();
    }

    function recalc() {
      return itemsNetTotal(editItems);
    }
    // Stock actual por producto (para resaltar items sin stock). state.allProducts
    // ya está cargado por el await ensureAllProducts() de arriba.
    function stockFor(pid) {
      var p = (state.allProducts || []).find(function(x) { return x.id === pid; });
      return p ? (Number(p.stock) || 0) : null;
    }
    function rowsHtml() {
      if (!editItems.length) return '<tr><td colspan="7" class="muted" style="padding:10px">Agregá al menos un producto.</td></tr>';
      return editItems.map(function(it, idx) {
        var st = stockFor(it.product_id);
        var noStock = st !== null && st <= 0;
        var rowStyle = noStock ? ' style="background:#fef2f2"' : "";
        var titleAttr = noStock ? ' title="Producto sin stock"' : "";
        return '<tr data-idx="' + idx + '"' + rowStyle + titleAttr + '>' +
          "<td><code>" + escapeHtml(it.product_code) + "</code></td>" +
          "<td>" + escapeHtml(it.product_name) + "</td>" +
          '<td><input type="number" class="cell-input cell-num oie-qty" min="1" step="1" value="' + it.quantity + '" data-idx="' + idx + '" style="width:64px"></td>' +
          '<td class="num"><input type="number" class="cell-input cell-num oie-price" min="0" step="0.01" value="' + it.unit_price + '" data-idx="' + idx + '" style="width:90px"></td>' +
          '<td class="num">' + discCellHtml(it, idx, editDiscUnit) + "</td>" +
          '<td class="num oie-sub">' + fmtPrice(lineNetSub(it)) + "</td>" +
          '<td><button type="button" class="btn btn-small oie-rm" data-idx="' + idx + '">✕</button></td>' +
        "</tr>";
      }).join("");
    }
    function render() {
      box.innerHTML =
        '<div class="order-items-edit">' +
          '<div class="oie-head"><strong>Artículos</strong>' +
            '<span style="flex:1"></span>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280">Lista de precios' +
              '<select class="cell-input oie-pricelist" style="min-width:170px"></select></label>' +
            '<button type="button" class="btn btn-small btn-primary oie-add-btn">+ Agregar productos</button></div>' +
          "<table><thead><tr><th>Código</th><th>Producto</th><th>Cant.</th>" +
          '<th class="num">P. Unit.</th><th class="num">Desc.</th><th class="num">Subtotal</th><th></th></tr></thead>' +
          "<tbody class=\"oie-tbody\">" + rowsHtml() + "</tbody></table>" +
          '<div class="oie-disc-wrap">' + discountBarHtml(editDiscUnit) + "</div>" +
          '<div class="oie-foot">' +
            '<span class="oie-total-lbl">Total: <strong class="oie-total">' + fmtPrice(recalc()) + "</strong></span>" +
            '<span style="flex:1"></span>' +
            '<button type="button" class="btn btn-small oie-cancel">Cancelar</button>' +
            '<button type="button" class="btn btn-small btn-primary oie-save">Guardar cambios</button>' +
          "</div>" +
        "</div>";
      wire();
    }
    function updateTotal() {
      var t = box.querySelector(".oie-total");
      if (t) t.textContent = fmtPrice(recalc());
      var dt = box.querySelector(".oie-disc-total");
      if (dt) { var d = itemsDiscTotal(editItems); dt.textContent = d > 0 ? "Descuento total: " + fmtPrice(d) : ""; }
    }
    function wire() {
      var tbody = box.querySelector(".oie-tbody");
      if (tbody) {
        tbody.addEventListener("input", function(e) {
          var idx = e.target.dataset.idx != null ? Number(e.target.dataset.idx) : -1;
          if (idx < 0 || !editItems[idx]) return;
          var it = editItems[idx];
          if (e.target.classList.contains("oie-qty")) {
            it.quantity = Math.max(1, Math.floor(Number(e.target.value) || 1));
          } else if (e.target.classList.contains("oie-price")) {
            it.unit_price = Math.max(0, round2(Number(e.target.value) || 0));
          } else if (e.target.classList.contains("line-disc")) {
            applyDiscCell(it, e.target.value, editDiscUnit);
          }
          var tr = e.target.closest("tr");
          var sub = tr ? tr.querySelector(".oie-sub") : null;
          if (sub) sub.textContent = fmtPrice(lineNetSub(it));
          // En modo $ el descuento mostrado depende de qty/precio: refrescar la celda.
          if (editDiscUnit === "amount" && tr && !e.target.classList.contains("line-disc")) {
            var dInp = tr.querySelector(".line-disc");
            if (dInp) dInp.value = lineDiscAmount(it);
          }
          updateTotal();
        });
        tbody.addEventListener("click", function(e) {
          var rm = e.target.closest(".oie-rm");
          if (!rm) return;
          editItems.splice(Number(rm.dataset.idx), 1);
          render();
        });
        tbody.addEventListener("contextmenu", function(e) {
          var tr = e.target.closest("tr[data-idx]");
          if (!tr) return;
          e.preventDefault();
          var idx = Number(tr.dataset.idx);
          if (!editItems[idx]) return;
          var it = editItems[idx];
          var menu = ensureOieCtxMenu();
          menu.innerHTML = "";
          var head = document.createElement("div");
          head.style.cssText = "padding:6px 10px;color:#6b7280;border-bottom:1px solid #eee;" +
            "margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;font-size:12px";
          head.textContent = (it.product_name || "") + " · " + (it.product_code || "");
          menu.appendChild(head);
          var b = document.createElement("button");
          b.type = "button";
          b.style.cssText = "display:block;width:100%;text-align:left;background:none;border:none;" +
            "padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:#111827";
          b.textContent = "🔄 Cambiar producto";
          b.addEventListener("mouseenter", function() { b.style.background = "#f3f4f6"; });
          b.addEventListener("mouseleave", function() { b.style.background = "none"; });
          b.addEventListener("click", function(ev) {
            ev.stopPropagation();
            hideOieCtxMenu();
            openOrderItemPicker(editItems, editCfg, render, idx);
          });
          menu.appendChild(b);
          menu.style.display = "block";
          var mw = menu.offsetWidth, mh = menu.offsetHeight;
          var x = e.clientX, y = e.clientY;
          if (x + mw > window.innerWidth)  x = Math.max(8, window.innerWidth  - mw - 8);
          if (y + mh > window.innerHeight) y = Math.max(8, window.innerHeight - mh - 8);
          menu.style.left = x + "px";
          menu.style.top  = y + "px";
        });
      }
      var plSel = box.querySelector(".oie-pricelist");
      if (plSel) {
        fillOrderPriceListSelect(plSel, editCfg.sel);
        plSel.addEventListener("change", function() {
          editCfg = orderCfgFromSel(plSel.value);
          repriceEdit();
        });
      }
      var discBar = box.querySelector(".oie-disc-bar");
      if (discBar) wireDiscountBar(discBar, {
        getItems: function() { return editItems; },
        getUnit: function() { return editDiscUnit; },
        setUnit: function(u) { editDiscUnit = u; },
        rerender: render,
      });
      var addBtn = box.querySelector(".oie-add-btn");
      if (addBtn) addBtn.addEventListener("click", function() {
        openOrderItemPicker(editItems, editCfg, render);
      });
      var cancelBtn = box.querySelector(".oie-cancel");
      if (cancelBtn) cancelBtn.addEventListener("click", function() { renderOrderDetail(detailEl, order); wireOrderDetail(detailEl, order); });
      var saveBtn = box.querySelector(".oie-save");
      if (saveBtn) saveBtn.addEventListener("click", function() { saveOrderItems(detailEl, order, editItems, saveBtn); });
    }
    render();
  }

  // ¿La edición cambia cantidades / agrega / quita items? (cambios solo de
  // precio no cuentan). Se usa para avisar antes de mandar un pedido de Entregas
  // de vuelta a Armado.
  function orderItemsChangedQty(original, edited) {
    var oldMap = {};
    (original || []).forEach(function(it) { if (it.product_id) oldMap[it.product_id] = Number(it.quantity); });
    var seen = {};
    for (var i = 0; i < edited.length; i++) {
      var it = edited[i];
      seen[it.product_id] = true;
      if (!(it.product_id in oldMap)) return true;            // item nuevo
      if (Number(it.quantity) !== oldMap[it.product_id]) return true; // cantidad cambió
    }
    for (var j = 0; j < (original || []).length; j++) {
      var o = original[j];
      if (o.product_id && !seen[o.product_id]) return true;   // item quitado
    }
    return false;
  }

  async function saveOrderItems(detailEl, order, editItems, saveBtn) {
    if (!editItems.length) { showToast("El pedido debe tener al menos un item", "error"); return; }
    // Si el pedido está en Entregas (listo) y cambian cantidades/items, avisar
    // que vuelve a Armado para preparar los cambios.
    if (order.status === "listo" && orderItemsChangedQty(order.items, editItems)) {
      var ok = await confirmModal({
        title: "Volver a Armado",
        message: "Este pedido está en Entregas. Al cambiar cantidades o productos vuelve a Armado para preparar los cambios, que quedan registrados.\n\n¿Seguir?",
        confirmText: "Volver a Armado",
      });
      if (!ok) return;
    }
    saveBtn.disabled = true;
    try {
      var resp = await api("/api/admin/orders/" + order.id + "/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: editItems.map(function(it) {
          return { product_id: it.product_id, product_code: it.product_code, product_name: it.product_name,
                   quantity: it.quantity, unit_price: it.unit_price, discount_percent: clampDiscPct(it.discount_percent) };
        }) }),
      });
      // Stock pudo cambiar: invalidar cache de productos del picker de Compras.
      state.allProductsLoaded = false;
      refreshProductsCache(); // y refrescar la tabla de Productos
      // Re-fetchear el pedido completo: el PUT solo devuelve items/total, NO la
      // rentabilidad (Ventas/Costo/margen) ni el saldo, que el server recalcula
      // en GET /api/orders/:id. Sin esto, la caja de Rentabilidad quedaba con los
      // valores viejos de antes de editar (bug reportado).
      var fresh = await api("/api/orders/" + order.id);
      var o = (state.orders || []).find(function(x) { return x.id === order.id; });
      if (o) { o.total = fresh.total; o.status = fresh.status; }
      if (resp.back_to_armado) {
        // El pedido salió de Entregas y volvió a Armado: re-render de las vistas
        // para que la tarjeta aparezca en su nueva sección.
        showToast("Pedido #" + order.id + " volvió a Armado para preparar los cambios");
        refreshOrderViews();
      } else {
        showToast("Pedido #" + order.id + " actualizado");
        // Volver a la vista de detalle (solo lectura) ya con los datos nuevos.
        renderOrderDetail(detailEl, fresh);
        wireOrderDetail(detailEl, fresh);
        var card = detailEl.closest(".order-card");
        if (card) { var tot = card.querySelector(".order-total"); if (tot) tot.textContent = fmtPrice(fresh.total); }
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
      saveBtn.disabled = false;
    }
  }

  // ---- Picker de productos del editor de pedidos (mismo sistema que el
  // armador de presupuestos: buscar, tildar, cantidad, "Agregar seleccionados").
  // Comparte la mecánica del picker de Compras. Al confirmar, agrega los
  // productos elegidos a los items del pedido en edición. ----
  var oieAddCtx = null;                 // { editItems, priceCfg, rerender, replaceIdx? }
  var oiePickerSelected = new Map();    // pid -> cantidad
  var oieShowNoStock = false;           // mostrar productos sin stock en el picker

  // Menú contextual flotante para las filas de items en edición de pedido.
  var oieCtxMenu = null;
  function hideOieCtxMenu() { if (oieCtxMenu) oieCtxMenu.style.display = "none"; }
  function ensureOieCtxMenu() {
    if (oieCtxMenu) return oieCtxMenu;
    oieCtxMenu = document.createElement("div");
    oieCtxMenu.style.cssText = "position:fixed;z-index:9000;background:#fff;border:1px solid #e5e7eb;" +
      "border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:4px;min-width:200px;display:none";
    document.body.appendChild(oieCtxMenu);
    document.addEventListener("click", hideOieCtxMenu);
    document.addEventListener("keydown", function(e) { if (e.key === "Escape") hideOieCtxMenu(); });
    return oieCtxMenu;
  }

  // replaceIdx: si se pasa, el picker reemplaza ese item en vez de agregar.
  // priceCfg: config { column, markup } para calcular el precio efectivo. Por
  // retrocompat acepta también un string de columna (lo envuelve en config nivel).
  async function openOrderItemPicker(editItems, priceCfg, rerender, replaceIdx) {
    if (typeof priceCfg === "string") priceCfg = { column: priceCfg, markup: 0 };
    oieAddCtx = { editItems: editItems, priceCfg: priceCfg, rerender: rerender, replaceIdx: replaceIdx };
    oiePickerSelected.clear();
    await ensureAllProducts();
    if (els.oiePickerSearch) els.oiePickerSearch.value = "";
    if (els.oiePickerAll) els.oiePickerAll.checked = false;
    oieShowNoStock = false;
    if (els.oiePickerShowNoStock) els.oiePickerShowNoStock.checked = false;
    renderOiePicker("");
    updateOiePickerCount();
    if (els.oiePickerModal) els.oiePickerModal.hidden = false;
    setTimeout(function() { if (els.oiePickerSearch) els.oiePickerSearch.focus(); }, 60);
  }

  function closeOiePicker() { if (els.oiePickerModal) els.oiePickerModal.hidden = true; oieAddCtx = null; }

  function renderOiePicker(filter) {
    if (!els.oiePickerTbody) return;
    var cfg = oieAddCtx ? oieAddCtx.priceCfg : { column: "price_minorista", markup: 0 };
    var list = state.allProducts || [];
    if (!oieShowNoStock) {
      // Ocultar sin stock, salvo que ya estén seleccionados (no perder la elección).
      list = list.filter(function(p) { return (p.stock || 0) > 0 || oiePickerSelected.has(p.id); });
    }
    if (filter) {
      var q = filter.trim().toLowerCase();
      list = list.filter(function(p) {
        return (p.name || "").toLowerCase().indexOf(q) !== -1 || (p.code || "").toLowerCase().indexOf(q) !== -1;
      });
    }
    if (!list.length) {
      els.oiePickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:16px;text-align:center">Sin resultados</td></tr>';
      return;
    }
    els.oiePickerTbody.innerHTML = list.map(function(p) {
      var sel = oiePickerSelected.has(p.id);
      var qty = sel ? oiePickerSelected.get(p.id) : "";
      var price = orderEffPrice(p, cfg);
      return '<tr data-pid="' + p.id + '">' +
        '<td><input type="checkbox" class="oie-pick-cb" data-pid="' + p.id + '"' + (sel ? " checked" : "") + ' /></td>' +
        '<td><div>' + escapeHtml(p.name || "") + '</div><code class="muted">' + escapeHtml(p.code || "") + '</code></td>' +
        '<td class="num"><input type="number" class="cell-input cell-num oie-pick-qty" data-pid="' + p.id + '" min="1" step="1" value="' + qty + '" placeholder="1" style="width:60px" /></td>' +
        '<td class="num">' + fmtPrice(price) + '</td>' +
        '<td class="num" style="color:' + ((p.stock || 0) > 0 ? "#059669" : "#9ca3af") + '">' + (p.stock || 0) + '</td>' +
      '</tr>';
    }).join("");
  }

  function updateOiePickerCount() {
    var n = oiePickerSelected.size;
    if (els.oiePickerCount) {
      // Monto que va sumando el pedido con lo tildado (qty × precio efectivo).
      var cfg = oieAddCtx ? oieAddCtx.priceCfg : { column: "price_minorista", markup: 0 };
      var sum = 0;
      oiePickerSelected.forEach(function(qty, pid) {
        var p = (state.allProducts || []).find(function(x) { return x.id === pid; });
        if (p) sum += orderEffPrice(p, cfg) * qty;
      });
      els.oiePickerCount.textContent = n + (n === 1 ? " seleccionado" : " seleccionados") + (n ? " · " + fmtPrice(sum) : "");
    }
    if (els.oiePickerConfirm) {
      els.oiePickerConfirm.disabled = n === 0;
      els.oiePickerConfirm.textContent = (oieAddCtx && oieAddCtx.replaceIdx !== undefined)
        ? "Reemplazar producto" : "Agregar seleccionados";
    }
  }

  if (els.oiePickerSearch) {
    els.oiePickerSearch.addEventListener("input", debounce(function() { renderOiePicker(els.oiePickerSearch.value); }, 160));
    var oieClearSearch = function() {
      if (els.oiePickerSearch.value) { els.oiePickerSearch.value = ""; renderOiePicker(""); }
    };
    els.oiePickerSearch.addEventListener("focus", oieClearSearch);
    els.oiePickerSearch.addEventListener("click", oieClearSearch);
  }
  if (els.oiePickerShowNoStock) {
    els.oiePickerShowNoStock.addEventListener("change", function() {
      oieShowNoStock = els.oiePickerShowNoStock.checked;
      renderOiePicker(els.oiePickerSearch ? els.oiePickerSearch.value : "");
    });
  }
  if (els.oiePickerCancel) els.oiePickerCancel.addEventListener("click", closeOiePicker);
  if (els.oiePickerModal) {
    els.oiePickerModal.addEventListener("click", function(e) {
      if (e.target.matches("[data-close]")) closeOiePicker();
    });
    // Tildar fila / seleccionar todos
    els.oiePickerModal.addEventListener("change", function(e) {
      if (e.target.classList.contains("oie-pick-cb")) {
        var pid = Number(e.target.dataset.pid);
        var tr = e.target.closest("tr[data-pid]");
        var qInp = tr ? tr.querySelector(".oie-pick-qty") : null;
        if (e.target.checked) {
          var q = qInp ? Math.max(1, Math.floor(Number(qInp.value) || 0)) : 1;
          oiePickerSelected.set(pid, q || 1);
          if (qInp && !qInp.value) qInp.value = "1";
        } else {
          oiePickerSelected.delete(pid);
          if (qInp) qInp.value = "";
        }
        updateOiePickerCount();
      } else if (e.target.id === "oie-picker-all") {
        var all = e.target.checked;
        els.oiePickerTbody.querySelectorAll(".oie-pick-cb").forEach(function(cb) {
          cb.checked = all;
          var pid = Number(cb.dataset.pid);
          var tr = cb.closest("tr[data-pid]");
          var qInp = tr ? tr.querySelector(".oie-pick-qty") : null;
          if (all) {
            var q = qInp ? Math.max(1, Math.floor(Number(qInp.value) || 0)) : 1;
            oiePickerSelected.set(pid, q || 1);
            if (qInp && !qInp.value) qInp.value = "1";
          } else {
            oiePickerSelected.delete(pid);
            if (qInp) qInp.value = "";
          }
        });
        updateOiePickerCount();
      }
    });
    // Tipear cantidad marca el checkbox y guarda la cantidad
    els.oiePickerModal.addEventListener("input", function(e) {
      if (!e.target.classList.contains("oie-pick-qty")) return;
      var pid = Number(e.target.dataset.pid);
      if (e.target.value === "") return;
      var q = Math.max(1, Math.floor(Number(e.target.value) || 0));
      oiePickerSelected.set(pid, q);
      var tr = e.target.closest("tr[data-pid]");
      var cb = tr ? tr.querySelector(".oie-pick-cb") : null;
      if (cb && !cb.checked) cb.checked = true;
      updateOiePickerCount();
    });
  }
  if (els.oiePickerConfirm) {
    els.oiePickerConfirm.addEventListener("click", function() {
      if (!oieAddCtx) { closeOiePicker(); return; }
      var editItems = oieAddCtx.editItems;
      var cfg = oieAddCtx.priceCfg;
      var rerender = oieAddCtx.rerender;
      var replaceIdx = oieAddCtx.replaceIdx;
      if (replaceIdx !== undefined && oiePickerSelected.size > 0) {
        // Modo reemplazo: sustituir el item en replaceIdx con el primer producto
        // elegido, conservando la cantidad original del item que se reemplaza.
        var entry = oiePickerSelected.entries().next().value;
        var prod = (state.allProducts || []).find(function(p) { return p.id === entry[0]; });
        if (prod && editItems[replaceIdx]) {
          var origQty = editItems[replaceIdx].quantity;
          editItems[replaceIdx] = {
            product_id: prod.id,
            product_code: prod.code || "",
            product_name: prod.name || "",
            quantity: origQty,
            unit_price: orderEffPrice(prod, cfg),
          };
        }
      } else {
        oiePickerSelected.forEach(function(qty, pid) {
          var prod = (state.allProducts || []).find(function(p) { return p.id === pid; });
          if (!prod) return;
          var addQty = Math.max(1, Math.floor(Number(qty) || 1));
          var existing = editItems.find(function(it) { return it.product_id === pid; });
          if (existing) {
            existing.quantity += addQty;
          } else {
            editItems.push({
              product_id: prod.id,
              product_code: prod.code || "",
              product_name: prod.name || "",
              quantity: addQty,
              unit_price: orderEffPrice(prod, cfg),
            });
          }
        });
      }
      closeOiePicker();
      if (typeof rerender === "function") rerender();
    });
  }

  // Filtro de la pestaña Pedidos: por estado (default "inbox" = por armar),
  // por cliente y por texto de búsqueda.
  function filterPedidos() {
    const q = els.ordersSearch.value.trim().toLowerCase();
    const clientFilter = els.ordersClientFilter.value; // "all" | username
    const statusFilter = els.ordersStatusFilter ? els.ordersStatusFilter.value : "inbox";
    let list = state.orders || [];
    if (statusFilter === "inbox") {
      list = list.filter((o) => o.status === "pendiente" || o.status === "enviado");
    } else if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }
    if (clientFilter !== "all") {
      list = list.filter((o) => (o.username || "") === clientFilter);
    }
    if (q) {
      list = list.filter((o) => matchWords(String(o.id) + " " + (o.username || "") + " " + (o.full_name || ""), q));
    }
    return list;
  }

  function renderOrders() {
    const list = filterPedidos();
    els.ordersCount.textContent = list.length + (list.length === 1 ? " pedido" : " pedidos");
    if (!list.length) {
      els.ordersList.innerHTML = '<p class="muted">Sin pedidos.</p>';
      return;
    }
    els.ordersList.innerHTML = list.map(orderCardHtml).join("");
    wireOrderCards(els.ordersList, list, renderOrders);
  }

  // Cablea los handlers de cada tarjeta de pedido: abrir detalle, registrar
  // entrega y avanzar de etapa. Se reusa en Pedidos, Armado y cola de Entregas.
  function wireOrderCards(container, list, reload) {
    container.querySelectorAll(".order-card").forEach((card) => {
      const head = card.querySelector(".order-head");
      if (head) head.addEventListener("click", (e) => {
        if (e.target.closest(".btn-deliver") || e.target.closest(".btn-advance") || e.target.closest(".btn-delete-order") || e.target.closest(".btn-pick")) return;
        toggleOrderDetail(card, Number(card.dataset.id));
      });

      const pickBtn = card.querySelector(".btn-pick");
      if (pickBtn) {
        pickBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openPickModal(Number(pickBtn.dataset.id));
        });
      }

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
              caja_id: orderObj.caja_id || null,
              caja_transfer_id: orderObj.caja_transfer_id || null,
              notes: orderObj.delivery_notes || "",
              delivered_at: orderObj.delivered_at || "",
            };
          }
          const totalLabel = orderObj ? fmtPrice(orderObj.total) : "";
          openDeliveryModal(orderId, "Pedido #" + orderId + (totalLabel ? " · " + totalLabel : ""), existingDelivery);
        });
      }

      const delOrderBtn = card.querySelector(".btn-delete-order");
      if (delOrderBtn) {
        delOrderBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteOrder(Number(delOrderBtn.dataset.id));
        });
      }

      const advBtn = card.querySelector(".btn-advance");
      if (advBtn) {
        advBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const orderId = Number(advBtn.dataset.id);
          const to = advBtn.dataset.to;
          // Aviso del chequeo de armado: si se usó el checklist pero quedaron
          // items sin armar (cantidad 0), confirmar antes de pasar a Entregas.
          if (to === "listo") {
            const ord = list.find((x) => x.id === orderId) || {};
            const started = Number(ord.pick_started) || 0;
            const ptot = Number(ord.pick_total) || 0;
            if (started > 0 && started < ptot) {
              const faltan = ptot - started;
              if (!await confirmModal("Pedido #" + orderId + ": hay " + faltan +
                (faltan === 1 ? " item sin armar" : " items sin armar") +
                " en el chequeo. ¿Pasar a Entregas igual?")) return;
            }
          }
          advBtn.disabled = true;
          try {
            await api("/api/orders/" + orderId, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: to }),
            });
            const o = (state.orders || []).find((x) => x.id === orderId);
            if (o) o.status = to;
            showToast(to === "preparando"
              ? "Pedido #" + orderId + " pasó a Armado"
              : "Pedido #" + orderId + " listo para entregar");
            if (typeof reload === "function") reload();
            refreshOrderViews();
          } catch (err) {
            advBtn.disabled = false;
            showToast("Error: " + err.message, "error");
          }
        });
      }
    });
  }

  // Re-renderiza las vistas del circuito que dependen de state.orders, para que
  // al avanzar un pedido desaparezca de una vista y aparezca en la otra.
  // Refresca la tabla de Productos (cacheada en state.products desde el arranque)
  // tras una acción que cambia stock en otra pestaña, así no hace falta un
  // refresh manual para ver el stock actualizado.
  async function refreshProductsCache() {
    try {
      state.products = await api("/api/admin/products");
      populateCategoryFilter(state.products);
      applyFilters();
    } catch (_) {}
  }

  function refreshOrderViews() {
    if (state.ordersLoaded) renderOrders();
    renderArmado();
    renderEntregasQueue();
    // Ventas tiene su propia fuente (endpoint dedicado); re-traerla para que un
    // pedido recién entregado aparezca sin recargar la página.
    if (els.ventasTbody) loadVentasOrders();
  }

  // Pestaña Ventas: registro de ventas concretadas = pedidos ENTREGADOS.
  // Un pedido que recorrió Pedidos → Armado → Entregas y se marcó entregado
  // "pasa a Ventas". Reusa la tarjeta del circuito (detalle, cobro, remito).
  // Cobro de una venta. Si el pedido tiene cuenta corriente (debit_total > 0,
  // que es el caso de todo pedido de un cliente real), la fuente de verdad es la
  // cuenta corriente del pedido: amount_paid (cobro de la entrega + descuentos +
  // pagos imputados al pedido) contra el débito. Así un pago registrado después
  // de la entrega baja la deuda y el badge pasa a "Saldado".
  // Si no hay cuenta corriente (venta a consumidor final / sin cliente), se cae
  // al cálculo viejo: lo cobrado en la entrega vs el total neto.
  function ventaCobro(o) {
    var debit = Number(o.debit_total) || 0;
    if (debit > 0) {
      var paid = Number(o.amount_paid) || 0;
      var falta = Math.max(0, debit - paid);
      return { neto: debit, cobrado: paid, saldado: falta <= 0.5, falta: falta };
    }
    var neto = Math.max(0, (Number(o.total) || 0) - (Number(o.discount_amount) || 0));
    var cobrado = (Number(o.efectivo_amount) || 0) + (Number(o.transferencia_amount) || 0);
    var saldado = neto <= 0 ? true : cobrado + 0.5 >= neto;
    return { neto: neto, cobrado: cobrado, saldado: saldado, falta: Math.max(0, neto - cobrado) };
  }

  // Llena el select "Cliente" con los clientes que tienen ventas en el período.
  function ventasPopulateClientFilter() {
    if (!els.ventasClient) return;
    var prev = els.ventasClient.value;
    var seen = {};
    var names = [];
    (state.ventasOrders || []).forEach(function(o) {
      var k = o.full_name || o.username || "—";
      if (!seen[k]) { seen[k] = 1; names.push(k); }
    });
    names.sort(function(a, b) { return a.localeCompare(b, "es"); });
    els.ventasClient.innerHTML = '<option value="">Todos</option>' +
      names.map(function(n) { return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + "</option>"; }).join("");
    if (prev && seen[prev]) els.ventasClient.value = prev;
  }

  function ventaRowHtml(o) {
    var client = escapeHtml(o.full_name || o.username || "—");
    var dateLabel = o.delivered_at ? formatDate(o.delivered_at) : formatDate(o.created_at);
    var vend = o.assigned_vendedor_id
      ? '<span class="vt-vend-badge">' + escapeHtml(o.vendedor_full_name || o.vendedor_username || ("#" + o.assigned_vendedor_id)) + "</span>"
      : '<span class="muted">—</span>';
    var c = ventaCobro(o);
    var cobroPill = c.saldado
      ? '<span class="vt-pill vt-paid" title="Cobrado ' + fmtPrice(c.cobrado) + '">✔ Saldado</span>'
      : '<span class="vt-pill vt-unpaid" title="Cobrado ' + fmtPrice(c.cobrado) + " de " + fmtPrice(c.neto) + '">Debe ' + fmtPrice(c.falta) + "</span>";
    var r = ventaRent(o);
    var rentCell;
    if (r.hasCost) {
      var cls = r.profit >= 0 ? "vt-rent-pos" : "vt-rent-neg";
      rentCell = '<span class="' + cls + '" title="Ventas netas ' + fmtPrice(r.neto) + ' · Costo ' + fmtPrice(r.cost) + '">' +
        fmtPrice(r.profit) + ' <small>(' + r.margin + '%)</small></span>';
    } else {
      rentCell = '<span class="muted" title="Falta cargar el costo de los productos">—</span>';
    }
    return '<tr class="ventas-row" data-id="' + o.id + '" title="Doble click para ver el detalle">' +
      '<td class="vt-client">' + client + "</td>" +
      '<td class="vt-num">#' + o.id + "</td>" +
      '<td class="vt-date">' + escapeHtml(dateLabel) + "</td>" +
      '<td class="vt-vend">' + vend + "</td>" +
      '<td class="vt-cobro">' + cobroPill + "</td>" +
      '<td class="vt-total num">' + fmtPrice(o.total || 0) + "</td>" +
      '<td class="vt-rent num">' + rentCell + "</td>" +
    "</tr>";
  }

  // Rentabilidad de una venta: neto (total - descuento) - costo actual de los
  // productos. cost_total viene del endpoint /api/admin/ventas. hasCost=false
  // cuando todos los productos tienen costo 0 (falta cargarlo) -> mostramos "—".
  function ventaRent(o) {
    var neto = Math.max(0, (Number(o.total) || 0) - (Number(o.discount_amount) || 0));
    var cost = Number(o.cost_total) || 0;
    var profit = neto - cost;
    var margin = neto > 0 ? Math.round((profit / neto) * 1000) / 10 : 0;
    return { neto: neto, cost: cost, profit: profit, margin: margin, hasCost: cost > 0 };
  }

  function renderVentasOrders() {
    if (!els.ventasTbody) return;
    ventasPopulateClientFilter();
    var q = (els.ventasSearch ? els.ventasSearch.value.trim().toLowerCase() : "");
    var clientF = els.ventasClient ? els.ventasClient.value : "";
    var paidF = els.ventasPaid ? els.ventasPaid.value : "all";
    var list = (state.ventasOrders || []).slice();
    if (q) {
      list = list.filter(function(o) { return matchWords(
        String(o.id) + " " + (o.username || "") + " " + (o.full_name || "") + " " +
        (o.vendedor_full_name || o.vendedor_username || ""), q); });
    }
    if (clientF) list = list.filter(function(o) { return (o.full_name || o.username || "—") === clientF; });
    if (paidF !== "all") list = list.filter(function(o) { var s = ventaCobro(o).saldado; return paidF === "saldado" ? s : !s; });
    if (els.ventasSummary) {
      var totalVendido = list.reduce(function(s, o) { return s + (Number(o.total) || 0); }, 0);
      var totalRent = list.reduce(function(s, o) { return s + ventaRent(o).profit; }, 0);
      els.ventasSummary.textContent = list.length + (list.length === 1 ? " venta · " : " ventas · ") +
        fmtPrice(totalVendido) + " · Rentabilidad " + fmtPrice(totalRent);
    }
    if (els.ventasCount) els.ventasCount.textContent = "(" + list.length + ")";
    if (!list.length) {
      els.ventasTbody.innerHTML = '<tr><td colspan="7" class="muted">No hay ventas para este filtro.</td></tr>';
      return;
    }
    els.ventasTbody.innerHTML = list.map(ventaRowHtml).join("");
    els.ventasTbody.querySelectorAll(".ventas-row").forEach(function(tr) {
      tr.addEventListener("dblclick", function() { openOrderDetailModal(Number(tr.dataset.id)); });
    });
  }

  // Modal con el detalle de un pedido (reusa el render del circuito). Lo usa la
  // pestaña Ventas al hacer doble click en una fila, en vez de desplegar inline.
  async function openOrderDetailModal(orderId) {
    if (!els.orderDetailModal || !els.orderDetailBody) return;
    if (els.orderDetailTitle) els.orderDetailTitle.textContent = "Pedido #" + orderId;
    els.orderDetailBody.innerHTML = '<p class="muted">Cargando…</p>';
    els.orderDetailModal.hidden = false;
    try {
      var fetches = [api("/api/orders/" + orderId)];
      if (state.isAdmin) fetches.push(ensureOrderClients());
      var order = (await Promise.all(fetches))[0];
      renderOrderDetail(els.orderDetailBody, order);
      wireOrderDetail(els.orderDetailBody, order);
    } catch (err) {
      els.orderDetailBody.innerHTML = '<p class="muted err">Error: ' + escapeHtml(err.message) + "</p>";
    }
  }

  // Trae TODOS los pedidos entregados (endpoint dedicado, sin el tope de 200 de
  // /api/orders) y renderiza la pestaña Ventas.
  // Setea los inputs Desde/Hasta según el período elegido en el selector.
  // "week" = lunes de la semana actual hasta hoy; "month" = día 1 del mes a hoy;
  // "all" = sin fechas; "custom" = no toca los inputs (los maneja el usuario).
  function setVentasRangeDates(range) {
    if (!els.ventasFrom || !els.ventasTo) return;
    if (range === "custom") return;
    if (range === "all") { els.ventasFrom.value = ""; els.ventasTo.value = ""; return; }
    const ymd = (d) => d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
    const now = new Date();
    let from;
    if (range === "today") {
      from = now;
    } else if (range === "week") {
      const dow = (now.getDay() + 6) % 7; // lunes = 0
      from = new Date(now); from.setDate(now.getDate() - dow);
    } else { // month
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    els.ventasFrom.value = ymd(from);
    els.ventasTo.value = ymd(now);
  }

  async function loadVentasOrders() {
    if (!els.ventasTbody) return;
    // Default al abrir por primera vez: solo la semana actual.
    if (!state.ventasRangeInit) {
      state.ventasRangeInit = true;
      if (els.ventasRange) { els.ventasRange.value = "week"; setVentasRangeDates("week"); }
    }
    const qs = [];
    if (els.ventasFrom && els.ventasFrom.value) qs.push("from=" + encodeURIComponent(els.ventasFrom.value));
    if (els.ventasTo && els.ventasTo.value) qs.push("to=" + encodeURIComponent(els.ventasTo.value));
    try {
      state.ventasOrders = await api("/api/admin/ventas" + (qs.length ? "?" + qs.join("&") : ""));
    } catch (e) {
      state.ventasOrders = [];
    }
    renderVentasOrders();
  }

  function renderArmado() {
    if (!els.armadoList) return;
    const list = (state.orders || []).filter((o) => o.status === "preparando");
    if (els.armadoCount) els.armadoCount.textContent = "(" + list.length + ")";
    if (!list.length) {
      els.armadoList.innerHTML = '<p class="muted">No hay pedidos en armado.</p>';
      return;
    }
    els.armadoList.innerHTML = list.map(orderCardHtml).join("");
    wireOrderCards(els.armadoList, list, renderArmado);
  }

  function renderEntregasQueue() {
    if (!els.entQueue) return;
    const list = (state.orders || []).filter((o) => o.status === "listo");
    if (els.entQueueCount) els.entQueueCount.textContent = "(" + list.length + ")";
    if (!list.length) {
      els.entQueue.innerHTML = '<p class="muted">No hay pedidos listos para entregar.</p>';
      return;
    }
    els.entQueue.innerHTML = list.map(orderCardHtml).join("");
    wireOrderCards(els.entQueue, list, renderEntregasQueue);
  }

  // Asegura state.orders cargado y renderiza la pestaña Armado.
  async function loadArmado() {
    if (!state.ordersLoaded) await loadOrders();
    renderArmado();
  }

  // Asegura state.orders cargado y renderiza la cola "para entregar".
  async function loadEntregasQueue() {
    if (!state.ordersLoaded) await loadOrders();
    renderEntregasQueue();
  }

  els.ordersSearch.addEventListener("input", debounce(renderOrders, 150));
  els.ordersClientFilter.addEventListener("change", renderOrders);
  if (els.ordersStatusFilter) els.ordersStatusFilter.addEventListener("change", renderOrders);
  if (els.armadoReload) els.armadoReload.addEventListener("click", loadArmado);
  if (els.entQueueReload) els.entQueueReload.addEventListener("click", loadEntregasQueue);

  // ---------- Chequeo de armado (checklist de picking) ----------
  // El armador tilda cada producto a medida que lo junta; la cantidad armada
  // puede ser parcial (el stock físico puede no coincidir). Sincronización
  // multi-dispositivo por polling cada 4s mientras el modal está abierto:
  // dos armadores con dos dispositivos ven los avances del otro solos.
  const pickEls = {
    modal: document.getElementById("pick-modal"),
    orderInfo: document.getElementById("pick-modal-order"),
    catFilter: document.getElementById("pick-cat-filter"),
    list: document.getElementById("pick-list"),
    progressFill: document.getElementById("pick-progress-fill"),
    progressText: document.getElementById("pick-progress-text"),
    syncInfo: document.getElementById("pick-sync-info"),
    applyBtn: document.getElementById("pick-apply-btn"),
  };
  const pickState = { orderId: null, items: [], cat: "all", timer: null, posting: 0 };

  async function openPickModal(orderId) {
    if (!pickEls.modal) return;
    pickState.orderId = orderId;
    pickState.items = [];
    pickState.cat = "all";
    pickEls.list.innerHTML = '<p class="muted">Cargando…</p>';
    pickEls.orderInfo.textContent = "Pedido #" + orderId;
    if (pickEls.syncInfo) pickEls.syncInfo.textContent = "";
    pickEls.modal.hidden = false;
    try {
      await pickFetch(true);
    } catch (err) {
      pickEls.list.innerHTML = '<p class="muted">Error: ' + escapeHtml(err.message) + "</p>";
    }
    if (pickState.timer) clearInterval(pickState.timer);
    pickState.timer = setInterval(pickPollTick, 4000);
  }

  // Tick del polling: si el modal se cerró (data-close / Escape) corta solo.
  // No re-renderiza si hay un POST en vuelo o el armador está tipeando una
  // cantidad parcial (no pisarle el input).
  async function pickPollTick() {
    if (!pickEls.modal || pickEls.modal.hidden) {
      clearInterval(pickState.timer);
      pickState.timer = null;
      return;
    }
    if (pickState.posting > 0) return;
    const ae = document.activeElement;
    if (ae && pickEls.list.contains(ae)) return;
    try { await pickFetch(false); } catch (_) {}
  }

  async function pickFetch(initial) {
    const data = await api("/api/admin/picks/" + pickState.orderId);
    pickState.items = data.items || [];
    pickEls.orderInfo.textContent = "Pedido #" + data.order.id +
      (data.order.client_name ? " · " + data.order.client_name : "");
    if (initial) pickBuildCatFilter();
    pickRenderList();
    pickApplyAgg(data.done_items || 0, data.total_items || 0);
    pickUpdateApplyBtn();
    if (pickEls.syncInfo) {
      pickEls.syncInfo.textContent = "Sincronizado " + new Date().toLocaleTimeString("es-AR") + " · se actualiza solo";
    }
  }

  // Items CONTROLADOS con cantidad distinta a la pedida (incluye 0 = "no hay"
  // y de más = redondeo de caja) = diferencias que la confirmación del chequeo
  // impacta en el pedido de origen y deja registradas.
  function pickPendingChanges() {
    return pickState.items.filter(
      (i) => Number(i.pick_checked) === 1 && Number(i.picked_qty) !== Number(i.quantity)
    );
  }

  function pickAllChecked() {
    return pickState.items.length > 0 &&
      pickState.items.every((i) => Number(i.pick_checked) === 1);
  }

  // El botón de confirmación aparece cuando hay diferencias para aplicar o
  // cuando el chequeo está completo (todos controlados, aunque sin cambios).
  function pickUpdateApplyBtn() {
    if (!pickEls.applyBtn) return;
    const n = pickPendingChanges().length;
    const complete = pickAllChecked();
    pickEls.applyBtn.hidden = n === 0 && !complete;
    pickEls.applyBtn.textContent = n > 0
      ? "✅ Confirmar chequeo (" + n + " cambio" + (n === 1 ? "" : "s") + ")"
      : "✅ Confirmar chequeo";
  }

  function pickBuildCatFilter() {
    if (!pickEls.catFilter) return;
    const cats = [];
    pickState.items.forEach((i) => {
      const c = i.category_name || "Sin categoría";
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    pickEls.catFilter.innerHTML =
      '<option value="all">Todas las categorías (' + pickState.items.length + " items)</option>" +
      cats.map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>").join("");
    pickEls.catFilter.value = "all";
  }

  function pickRowHtml(it) {
    // Controlado = pick_checked. Coincide → verde ✔. Controlado con cantidad
    // distinta (0 = "no hay", menos, o MAS para redondear caja) → rojo ≠.
    // Sin controlar → vacío (el input se muestra vacío, no en 0).
    const checked = Number(it.pick_checked) === 1;
    const match = checked && Number(it.picked_qty) === Number(it.quantity);
    const diff = checked && !match;
    const who = it.picked_by_name
      ? ' <span class="pick-who" title="Último que tildó">👤 ' + escapeHtml(it.picked_by_name) + "</span>"
      : "";
    return '<div class="pick-item' + (match ? " pick-done" : diff ? " pick-diff" : "") +
      '" data-item="' + it.id + '">' +
      '<span class="pick-check">' + (match ? "✔" : diff ? "≠" : "") + "</span>" +
      '<div class="pick-info">' +
        '<span class="pick-name">' + escapeHtml(it.product_name || "") + "</span>" +
        '<span class="pick-code">' + escapeHtml(it.product_code || "") + who + "</span>" +
      "</div>" +
      '<div class="pick-qtybox" title="Cantidad armada — 0 = no hay; se puede poner de más (redondeo de caja); vacío = sin controlar">' +
        '<input type="number" class="pick-qty-input" min="0" step="1"' +
          ' value="' + (checked ? Number(it.picked_qty) : "") + '" placeholder="—" />' +
        '<span class="pick-qty-req">/ ' + Number(it.quantity) + "</span>" +
      "</div>" +
    "</div>";
  }

  function pickRenderList() {
    if (!pickEls.list) return;
    let items = pickState.items;
    if (pickState.cat !== "all") {
      items = items.filter((i) => (i.category_name || "Sin categoría") === pickState.cat);
    }
    if (!items.length) {
      pickEls.list.innerHTML = '<p class="muted">Sin items.</p>';
      return;
    }
    let html = "";
    let lastCat = null;
    items.forEach((it) => {
      const cat = it.category_name || "Sin categoría";
      if (cat !== lastCat) {
        html += '<div class="pick-cat-head">' + escapeHtml(cat) + "</div>";
        lastCat = cat;
      }
      html += pickRowHtml(it);
    });
    pickEls.list.innerHTML = html;
  }

  // Actualiza barra de progreso del modal + contador del botón "📋 Chequeo"
  // y el badge "✔ Armado completo" de la tarjeta en la pestaña Armado.
  function pickApplyAgg(done, total) {
    if (pickEls.progressText) pickEls.progressText.textContent = done + "/" + total;
    if (pickEls.progressFill) {
      pickEls.progressFill.style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
      pickEls.progressFill.classList.toggle("full", total > 0 && done >= total);
    }
    const o = (state.orders || []).find((x) => x.id === pickState.orderId);
    if (o && (Number(o.pick_done) !== done || Number(o.pick_total) !== total ||
              Number(o.pick_started) !== done)) {
      o.pick_total = total;
      o.pick_done = done;
      // En el server pick_started === pick_done (ambos = items pick_checked=1).
      // El aviso "items sin armar" al pasar a Entregas lee pick_started, así que
      // hay que mantenerlo en sync; sin esto, tras agregar un producto y volver a
      // chequear, el aviso seguía saliendo (pick_started quedaba con el valor viejo).
      o.pick_started = done;
      renderArmado();
    }
  }

  // qty numérico (0 permitido, sin tope) = controlar; null = destildar.
  async function pickPost(itemId, qty) {
    pickState.posting++;
    try {
      const out = await api("/api/admin/picks/" + pickState.orderId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, picked_qty: qty }),
      });
      const it = pickState.items.find((i) => i.id === itemId);
      if (it) {
        it.picked_qty = out.picked_qty;
        it.pick_checked = out.pick_checked;
        if (out.pick_checked && state.me) {
          it.picked_by_name = state.me.fullName || state.me.full_name || state.me.username || it.picked_by_name;
        } else if (!out.pick_checked) {
          it.picked_by_name = null;
        }
      }
      pickRenderList();
      pickApplyAgg(out.done_items || 0, out.total_items || 0);
      pickUpdateApplyBtn();
      if (pickEls.syncInfo) {
        pickEls.syncInfo.textContent = "Guardado " + new Date().toLocaleTimeString("es-AR") + " · se actualiza solo";
      }
    } catch (err) {
      showToast("Error al guardar: " + err.message, "error");
      try { await pickFetch(false); } catch (_) {}
    } finally {
      pickState.posting--;
    }
  }

  if (pickEls.list) {
    // Click en la fila (fuera del input de cantidad) = controlar con lo pedido
    // / destildar (vuelve a "sin controlar").
    pickEls.list.addEventListener("click", (e) => {
      if (e.target.closest(".pick-qtybox")) return;
      const row = e.target.closest(".pick-item");
      if (!row) return;
      const id = Number(row.dataset.item);
      const it = pickState.items.find((i) => i.id === id);
      if (!it) return;
      const checked = Number(it.pick_checked) === 1;
      pickPost(id, checked ? null : Number(it.quantity));
    });
    // Cambio en el input de cantidad = controlar con esa cantidad (0 = "no
    // hay"; puede ser mayor a lo pedido). Vaciar el input = destildar.
    pickEls.list.addEventListener("change", (e) => {
      const inp = e.target.closest(".pick-qty-input");
      if (!inp) return;
      const row = inp.closest(".pick-item");
      if (!row) return;
      const raw = String(inp.value).trim();
      let qty = null;
      if (raw !== "") {
        qty = Number(raw);
        if (!isFinite(qty) || qty < 0) qty = 0;
      }
      inp.blur();
      pickPost(Number(row.dataset.item), qty);
    });
  }
  if (pickEls.catFilter) {
    pickEls.catFilter.addEventListener("change", () => {
      pickState.cat = pickEls.catFilter.value;
      pickRenderList();
    });
  }

  // Confirmar el chequeo: anuncia las diferencias (faltantes, quitados por 0,
  // de más por redondeo), las aplica al pedido (server stock-aware) y quedan
  // registradas en pick_changes (visibles en el detalle del pedido y en la
  // notificación al cliente).
  if (pickEls.applyBtn) {
    pickEls.applyBtn.addEventListener("click", async () => {
      const changes = pickPendingChanges();
      let confirmMsg;
      if (changes.length) {
        const detail = changes.slice(0, 8).map((i) => {
          const nq = Number(i.picked_qty);
          const extra = nq === 0 ? " (sin stock — se quita del pedido)"
            : nq > Number(i.quantity) ? " (se agrega de más)" : "";
          return "· " + (i.product_name || "") + ": " + Number(i.quantity) + " → " + nq + extra;
        }).join("\n") + (changes.length > 8 ? "\n· …y " + (changes.length - 8) + " más" : "");
        confirmMsg = "Se aplican estos cambios al pedido #" + pickState.orderId +
          ", se recalcula el total y quedan registrados:\n\n" + detail;
      } else {
        confirmMsg = "El chequeo del pedido #" + pickState.orderId +
          " no tiene diferencias: todo coincide con lo pedido.";
      }
      const ok = await confirmModal({
        title: "✅ Confirmar chequeo de armado",
        message: confirmMsg,
        confirmText: "Confirmar chequeo",
        cancelText: "Cancelar",
      });
      if (!ok) return;
      pickEls.applyBtn.disabled = true;
      try {
        const out = await api("/api/admin/picks/" + pickState.orderId + "/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        showToast(out.changed > 0
          ? "Chequeo confirmado: " + out.changed + " cambio" + (out.changed === 1 ? "" : "s") +
            " registrados · nuevo total " + fmtPrice(out.total)
          : "Chequeo confirmado sin diferencias");
        const o = (state.orders || []).find((x) => x.id === pickState.orderId);
        if (o) o.total = out.total;
        await pickFetch(false); // re-trae: los aplicados quedan coincidiendo
        refreshOrderViews();
        state.allProductsLoaded = false;
        refreshProductsCache(); // el stock pudo ajustarse (presupuesto facturado)
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        pickEls.applyBtn.disabled = false;
      }
    });
  }

  // ---------- Recepción: control de mercadería recibida ----------
  // Lista de compras con estado del control + checklist por compra (modal),
  // calcado del chequeo de armado: sync multi-dispositivo por polling, carga
  // en bultos o unidades (products.units_per_bulto, el proveedor factura por
  // bulto) y botón explícito para aplicar las diferencias a la compra.
  const recvEls = {
    tbody: document.getElementById("recv-tbody"),
    filter: document.getElementById("recv-filter"),
    count: document.getElementById("recv-count"),
    reload: document.getElementById("recv-reload"),
    modal: document.getElementById("recv-modal"),
    info: document.getElementById("recv-modal-info"),
    catFilter: document.getElementById("recv-cat-filter"),
    list: document.getElementById("recv-list"),
    progressFill: document.getElementById("recv-progress-fill"),
    progressText: document.getElementById("recv-progress-text"),
    syncInfo: document.getElementById("recv-sync-info"),
    applyBtn: document.getElementById("recv-apply-btn"),
    // Picker de producto para cambiar la línea (clic derecho)
    prodModal: document.getElementById("recv-prod-modal"),
    prodInfo: document.getElementById("recv-prod-info"),
    prodSearch: document.getElementById("recv-prod-search"),
    prodTbody: document.getElementById("recv-prod-tbody"),
    prodNew: document.getElementById("recv-prod-new"),
  };
  const recvState = { rows: [], purchaseId: null, items: [], cat: "all", timer: null, posting: 0, received: false };
  let recvProdTargetItem = null; // item de la recepción que se está repuntando

  async function loadRecepcion() {
    if (!recvEls.tbody) return;
    recvEls.tbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
    try {
      recvState.rows = await api("/api/admin/reception");
      renderRecepcion();
    } catch (e) {
      recvEls.tbody.innerHTML = '<tr><td colspan="8" class="muted">Error: ' + escapeHtml(e.message) + "</td></tr>";
    }
  }

  function recvStatusOf(r) {
    const total = Number(r.items_count) || 0;
    const done = Number(r.checked_count) || 0;
    if (!total || done === 0) return "pending";
    return done >= total ? "done" : "partial";
  }

  // Estado de recepción (received) es lo principal; el control (checked/diffs)
  // es el sub-paso que se ve en el chip secundario.
  function recvChipHtml(r) {
    if (Number(r.received) === 1) {
      const diffs = Number(r.diff_count) || 0;
      return '<span class="recv-chip recv-chip-ok">✔ Recibida</span>' +
        (diffs > 0 ? ' <span class="recv-chip recv-chip-diff" title="Recibida con diferencias contra lo cargado">≠ ' + diffs + "</span>" : "");
    }
    const st = recvStatusOf(r);
    const done = Number(r.checked_count) || 0;
    const total = Number(r.items_count) || 0;
    let ctl = '<span class="recv-chip recv-chip-none">Sin controlar</span>';
    if (st === "done") ctl = '<span class="recv-chip recv-chip-mid">✔ Controlado</span>';
    else if (st === "partial") ctl = '<span class="recv-chip recv-chip-mid">' + done + "/" + total + "</span>";
    return '<span class="recv-chip recv-chip-pend">⏳ Pendiente</span> ' + ctl;
  }

  function renderRecepcion() {
    if (!recvEls.tbody) return;
    const f = recvEls.filter ? recvEls.filter.value : "all";
    let list = recvState.rows;
    if (f === "pendiente") list = list.filter((r) => Number(r.received) !== 1);
    else if (f === "recibida") list = list.filter((r) => Number(r.received) === 1);
    if (recvEls.count) recvEls.count.textContent = list.length + (list.length === 1 ? " compra" : " compras");
    if (!list.length) {
      recvEls.tbody.innerHTML = '<tr><td colspan="8" class="muted">Sin compras para este filtro.</td></tr>';
      return;
    }
    recvEls.tbody.innerHTML = list.map((r) =>
      '<tr data-id="' + r.id + '">' +
        '<td class="cell-code">#' + r.id + "</td>" +
        "<td>" + escapeHtml(r.supplier_name || "—") + "</td>" +
        "<td>" + escapeHtml(r.reference || "—") + "</td>" +
        '<td class="muted small-cell">' + formatDate(r.received_at) + "</td>" +
        '<td class="num">' + (r.items_count || 0) + "</td>" +
        '<td class="num"><strong>' + fmtPrice(r.total_cost) + "</strong></td>" +
        "<td>" + recvChipHtml(r) + "</td>" +
        '<td><button class="btn btn-mini recv-open-btn" data-id="' + r.id + '" type="button">' +
          (Number(r.received) === 1 ? "👁 Ver" : "📋 Controlar") + "</button></td>" +
      "</tr>"
    ).join("");
  }

  if (recvEls.tbody) {
    recvEls.tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".recv-open-btn");
      if (btn) openRecvModal(Number(btn.dataset.id));
    });
  }
  if (recvEls.filter) recvEls.filter.addEventListener("change", renderRecepcion);
  if (recvEls.reload) recvEls.reload.addEventListener("click", loadRecepcion);

  // ----- Modal checklist de recepción -----
  async function openRecvModal(purchaseId) {
    if (!recvEls.modal) return;
    recvState.purchaseId = purchaseId;
    recvState.items = [];
    recvState.cat = "all";
    recvState.received = false;
    recvEls.list.innerHTML = '<p class="muted">Cargando…</p>';
    recvEls.info.textContent = "Compra #" + purchaseId;
    if (recvEls.syncInfo) recvEls.syncInfo.textContent = "";
    recvEls.modal.hidden = false;
    try {
      await recvFetch(true);
    } catch (err) {
      recvEls.list.innerHTML = '<p class="muted">Error: ' + escapeHtml(err.message) + "</p>";
    }
    if (recvState.timer) clearInterval(recvState.timer);
    recvState.timer = setInterval(recvPollTick, 4000);
  }

  // Tick del polling: si el modal se cerró (data-close / Escape) corta solo.
  // No re-renderiza si hay un POST en vuelo o si el que cuenta está tipeando.
  async function recvPollTick() {
    if (!recvEls.modal || recvEls.modal.hidden) {
      clearInterval(recvState.timer);
      recvState.timer = null;
      return;
    }
    if (recvState.posting > 0) return;
    const ae = document.activeElement;
    if (ae && recvEls.list.contains(ae)) return;
    try { await recvFetch(false); } catch (_) {}
  }

  async function recvFetch(initial) {
    const data = await api("/api/admin/reception/" + recvState.purchaseId);
    recvState.items = data.items || [];
    recvState.received = Number(data.purchase.received) === 1;
    recvEls.info.innerHTML = "Compra #" + data.purchase.id +
      (data.purchase.supplier_name ? " · " + escapeHtml(data.purchase.supplier_name) : "") +
      (data.purchase.reference ? " · " + escapeHtml(data.purchase.reference) : "") +
      (recvState.received
        ? ' <span class="recv-chip recv-chip-ok">✔ Recibida — stock impactado</span>'
        : ' <span class="recv-chip recv-chip-pend">⏳ Pendiente de recibir</span>');
    if (initial) recvBuildCatFilter();
    recvRenderList();
    recvApplyAgg(data.done_items || 0, data.total_items || 0, data.diff_items || 0);
    recvUpdateApplyBtn();
    if (recvEls.syncInfo) {
      recvEls.syncInfo.textContent = "Sincronizado " + new Date().toLocaleTimeString("es-AR") + " · se actualiza solo";
    }
  }

  // Items contados con cantidad distinta a la cargada = diferencias que el
  // botón "Aplicar diferencias a la compra" puede impactar.
  function recvPendingChanges() {
    return recvState.items.filter(
      (i) => i.checked_qty != null && Number(i.checked_qty) !== Number(i.quantity)
    );
  }

  function recvUpdateApplyBtn() {
    if (!recvEls.applyBtn) return;
    if (recvState.received) { recvEls.applyBtn.hidden = true; return; }
    recvEls.applyBtn.hidden = false;
    const n = recvPendingChanges().length;
    recvEls.applyBtn.textContent = n > 0
      ? "✅ Confirmar recepción (" + n + (n === 1 ? " diferencia)" : " diferencias)")
      : "✅ Confirmar recepción";
  }

  function recvBuildCatFilter() {
    if (!recvEls.catFilter) return;
    const cats = [];
    recvState.items.forEach((i) => {
      const c = i.category_name || "Sin categoría";
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    recvEls.catFilter.innerHTML =
      '<option value="all">Todas las categorías (' + recvState.items.length + " items)</option>" +
      cats.map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>").join("");
    recvEls.catFilter.value = "all";
  }

  // Redondeo corto para mostrar bultos (puede dar fraccionado: 2,5 bultos).
  function recvFmtB(n) {
    return String(Math.round(Number(n) * 100) / 100).replace(".", ",");
  }

  // Parsea cantidades tipeadas estilo es-AR: "1.200" (punto de miles) = 1200,
  // "2,5" (coma decimal) = 2.5, "1.200,5" = 1200.5, "59.75" = 59.75.
  // Devuelve null si está vacío, NaN si no es un número.
  function recvParseNum(v) {
    let s = String(v == null ? "" : v).trim().replace(/\s+/g, "");
    if (!s) return null;
    if (s.indexOf(",") !== -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  // 'YYYY-MM' (como lo guarda el server) -> 'MM/AA' para el input.
  function recvExpLabel(ym) {
    const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
    return m ? m[2] + "/" + m[1].slice(2) : "";
  }
  // Da formato MM/AA mientras se tipea: solo dígitos, la barra la pone el sistema.
  function recvExpFormat(v) {
    let d = String(v || "").replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d;
  }
  // Guarda el vencimiento de un item (MM/AA o "" para limpiar).
  async function recvPostExpiry(itemId, label) {
    recvState.posting++;
    try {
      const out = await api("/api/admin/reception/" + recvState.purchaseId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, expiry_date: label }),
      });
      const it = recvState.items.find((i) => i.id === itemId);
      if (it) it.expiry_date = out.expiry_date || null;
    } catch (err) {
      showToast("Error al guardar vencimiento: " + err.message, "error");
      try { await recvFetch(false); } catch (_) {}
    } finally {
      recvState.posting--;
    }
  }

  function recvRowHtml(it) {
    const upb = Math.max(1, Number(it.units_per_bulto) || 1);
    const cpt = Math.max(1, parseComprimidos(it.product_name) || 1);
    const qty = Number(it.quantity);
    const checked = it.checked_qty != null;
    const ok = checked && Number(it.checked_qty) === qty;
    const diff = checked && !ok;
    const who = it.checked_by_name
      ? ' <span class="pick-who" title="Último que contó">👤 ' + escapeHtml(it.checked_by_name) + "</span>"
      : "";
    const bultosEsp = upb > 1 ? " = " + recvFmtB(qty / upb) + " bultos ×" + upb : "";
    const unitsVal = checked ? String(Number(it.checked_qty)) : "";
    const bultosVal = checked ? recvFmtB(Number(it.checked_qty) / upb) : "";
    const expVal = recvExpLabel(it.expiry_date);
    return '<div class="pick-item' + (ok ? " pick-done" : diff ? " pick-diff" : "") +
      '" data-item="' + it.id + '">' +
      '<span class="pick-check">' + (ok ? "✔" : diff ? "≠" : "") + "</span>" +
      '<div class="pick-info">' +
        '<span class="pick-name">' + escapeHtml(it.product_name || "") + "</span>" +
        '<span class="pick-code">' + escapeHtml(it.product_code || "") +
          " · cargado: " + qty + " un." + escapeHtml(bultosEsp) + who + "</span>" +
      "</div>" +
      '<div class="recv-exp-box" title="Vencimiento (mes/año). La barra la agrega el sistema.">' +
        '<span class="recv-exp-lbl">Vence</span>' +
        '<input type="text" class="recv-exp-input" inputmode="numeric" maxlength="5" placeholder="MM/AA" value="' + expVal + '" />' +
      "</div>" +
      '<div class="pick-qtybox recv-qtybox" title="Cantidad recibida — cargá bultos, comprimidos o unidades; click en la fila = tildar lo cargado">' +
        (upb > 1
          ? '<input type="text" inputmode="decimal" autocomplete="off" class="pick-qty-input recv-bulto-input" placeholder="0" value="' + bultosVal + '" /><span class="recv-qty-sep">bultos</span>'
          : "") +
        (cpt > 1
          ? '<input type="text" inputmode="decimal" autocomplete="off" class="pick-qty-input recv-comp-input" placeholder="0" data-cpt="' + cpt + '" title="Comprimidos recibidos (' + cpt + ' comp = 1 tableta)" /><span class="recv-qty-sep">comp</span>'
          : "") +
        '<input type="text" inputmode="decimal" autocomplete="off" class="pick-qty-input recv-unit-input" placeholder="0" value="' + unitsVal + '" />' +
        '<span class="pick-qty-req">/ ' + qty + " un.</span>" +
      "</div>" +
    "</div>";
  }

  function recvRenderList() {
    if (!recvEls.list) return;
    let items = recvState.items;
    if (recvState.cat !== "all") {
      items = items.filter((i) => (i.category_name || "Sin categoría") === recvState.cat);
    }
    if (!items.length) {
      recvEls.list.innerHTML = '<p class="muted">Sin items.</p>';
      return;
    }
    let html = "";
    let lastCat = null;
    items.forEach((it) => {
      const cat = it.category_name || "Sin categoría";
      if (cat !== lastCat) {
        html += '<div class="pick-cat-head">' + escapeHtml(cat) + "</div>";
        lastCat = cat;
      }
      html += recvRowHtml(it);
    });
    recvEls.list.innerHTML = html;
  }

  // Actualiza barra de progreso del modal + el chip de la fila en la tabla
  // de Recepción (queda al día sin recargar la lista).
  function recvApplyAgg(done, total, diffs) {
    if (recvEls.progressText) recvEls.progressText.textContent = done + "/" + total;
    if (recvEls.progressFill) {
      recvEls.progressFill.style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
      recvEls.progressFill.classList.toggle("full", total > 0 && done >= total);
    }
    const r = (recvState.rows || []).find((x) => x.id === recvState.purchaseId);
    if (r && (Number(r.checked_count) !== done || Number(r.diff_count) !== diffs)) {
      r.checked_count = done;
      r.diff_count = diffs;
      r.items_count = total;
      renderRecepcion();
    }
  }

  // qty numérica = guardar lo contado; null = destildar (vuelve a sin controlar).
  async function recvPost(itemId, qty) {
    recvState.posting++;
    try {
      const out = await api("/api/admin/reception/" + recvState.purchaseId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, checked_qty: qty }),
      });
      const it = recvState.items.find((i) => i.id === itemId);
      if (it) {
        it.checked_qty = out.checked_qty;
        if (out.checked_qty != null && state.me) {
          it.checked_by_name = state.me.fullName || state.me.full_name || state.me.username || it.checked_by_name;
        } else if (out.checked_qty == null) {
          it.checked_by_name = null;
        }
      }
      recvRenderList();
      recvApplyAgg(out.done_items || 0, out.total_items || 0, out.diff_items || 0);
      recvUpdateApplyBtn();
      if (recvEls.syncInfo) {
        recvEls.syncInfo.textContent = "Guardado " + new Date().toLocaleTimeString("es-AR") + " · se actualiza solo";
      }
    } catch (err) {
      showToast("Error al guardar: " + err.message, "error");
      try { await recvFetch(false); } catch (_) {}
    } finally {
      recvState.posting--;
    }
  }

  if (recvEls.list) {
    // Click en la fila (fuera de los inputs) = tildar con lo cargado / destildar.
    recvEls.list.addEventListener("click", (e) => {
      if (e.target.closest(".recv-qtybox") || e.target.closest(".recv-exp-box")) return;
      const row = e.target.closest(".pick-item");
      if (!row) return;
      const id = Number(row.dataset.item);
      const it = recvState.items.find((i) => i.id === id);
      if (!it) return;
      recvPost(id, it.checked_qty != null ? null : Number(it.quantity));
    });
    // Vencimiento: la barra se agrega sola mientras se tipea (MM/AA).
    recvEls.list.addEventListener("input", (e) => {
      const inp = e.target.closest(".recv-exp-input");
      if (!inp) return;
      const start = inp.selectionStart;
      const before = inp.value;
      inp.value = recvExpFormat(inp.value);
      // mantener el cursor al final si el sistema insertó la barra
      if (inp.value.length > before.length && start === before.length) {
        try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {}
      }
    });
    // Cambio en los inputs: unidades guarda directo; bultos convierte con
    // units_per_bulto. Vaciar el input destilda el item.
    recvEls.list.addEventListener("change", (e) => {
      // Vencimiento: guarda MM/AA (o limpia si quedó vacío).
      const expInp = e.target.closest(".recv-exp-input");
      if (expInp) {
        const row = expInp.closest(".pick-item");
        if (!row) return;
        const id = Number(row.dataset.item);
        const val = expInp.value.trim();
        if (val && !/^\d{2}\/\d{2}$/.test(val)) {
          showToast("Vencimiento inválido. Usá MM/AA, ej: 08/28.", "error");
          return;
        }
        expInp.blur();
        recvPostExpiry(id, val);
        return;
      }
      const inp = e.target.closest(".pick-qty-input");
      if (!inp) return;
      const row = inp.closest(".pick-item");
      if (!row) return;
      const id = Number(row.dataset.item);
      const it = recvState.items.find((i) => i.id === id);
      if (!it) return;
      const upb = Math.max(1, Number(it.units_per_bulto) || 1);
      const cpt = Math.max(1, Number(inp.dataset.cpt) || parseComprimidos(it.product_name) || 1);
      const n = recvParseNum(inp.value);
      let qty = null;
      if (n !== null) {
        // Número inválido: avisar y NO guardar (antes se guardaba 0 en silencio).
        if (isNaN(n) || n < 0) {
          showToast('Cantidad inválida: "' + inp.value + '"', "error");
          recvRenderList();
          return;
        }
        qty = inp.classList.contains("recv-bulto-input") ? Math.round(n * upb * 100) / 100
            : inp.classList.contains("recv-comp-input") ? Math.round((n / cpt) * 100) / 100
            : n;
      }
      inp.blur();
      recvPost(id, qty);
    });
  }
  if (recvEls.catFilter) {
    recvEls.catFilter.addEventListener("change", () => {
      recvState.cat = recvEls.catFilter.value;
      recvRenderList();
    });
  }

  // Aplicar lo contado a la compra: cantidades, total, stock y deuda del
  // proveedor pasan a reflejar lo realmente recibido (server hace todo).
  if (recvEls.applyBtn) {
    recvEls.applyBtn.addEventListener("click", async () => {
      if (recvState.received) return;
      const changes = recvPendingChanges();
      const detail = changes.length
        ? "\n\nDiferencias contra lo cargado:\n" + changes.slice(0, 8).map(
            (i) => "· " + (i.product_name || "") + ": cargado " + Number(i.quantity) + " → recibido " + Number(i.checked_qty)
          ).join("\n") + (changes.length > 8 ? "\n· …y " + (changes.length - 8) + " más" : "")
        : "";
      if (!await confirmModal({
        title: "✅ Confirmar recepción",
        message: "Vas a confirmar la recepción de la compra #" + recvState.purchaseId +
          ". Esto SUMA al stock lo recibido (lo contado, o lo cargado si no controlaste el item), " +
          "recalcula el total y deja la compra como recibida. No se puede deshacer desde acá." + detail,
        confirmText: "Confirmar recepción",
      })) return;
      recvEls.applyBtn.disabled = true;
      try {
        const out = await api("/api/admin/reception/" + recvState.purchaseId + "/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        showToast("Recepción confirmada · compra #" + recvState.purchaseId +
          " · stock impactado · total " + fmtPrice(out.total) +
          (out.changed ? " · " + out.changed + " con diferencia" : ""));
        recvState.received = true;
        await recvFetch(false); // re-trae con received=1 (oculta el botón)
        await loadRecepcion();  // estado de la fila al día
        state.purchasesLoaded = false; // la pestaña Compras recarga al entrar
        state.allProductsLoaded = false;
        refreshProductsCache(); // el stock entró
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        recvEls.applyBtn.disabled = false;
      }
    });
  }

  // ----- Clic derecho sobre un item de la recepción: cambiar / clonar /
  // editar / crear producto y asignarlo a la línea. Solo si la compra todavía
  // NO fue recibida (después el stock ya entró y repuntar descuadraría). -----
  let recvCtxMenu = null;
  function hideRecvCtxMenu() { if (recvCtxMenu) recvCtxMenu.style.display = "none"; }
  function ensureRecvCtxMenu() {
    if (recvCtxMenu) return recvCtxMenu;
    recvCtxMenu = document.createElement("div");
    recvCtxMenu.style.cssText = "position:fixed;z-index:1600;background:#fff;border:1px solid #d1d5db;" +
      "border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px;display:none;min-width:230px";
    document.body.appendChild(recvCtxMenu);
    document.addEventListener("click", hideRecvCtxMenu);
    document.addEventListener("scroll", hideRecvCtxMenu, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideRecvCtxMenu(); });
    return recvCtxMenu;
  }

  if (recvEls.list) {
    recvEls.list.addEventListener("contextmenu", (e) => {
      const row = e.target.closest(".pick-item");
      if (!row) return;
      e.preventDefault();
      if (recvState.received) { showToast("La compra ya fue recibida; no se puede cambiar el producto.", "error"); return; }
      const id = Number(row.dataset.item);
      const it = recvState.items.find((i) => i.id === id);
      if (!it) return;
      const menu = ensureRecvCtxMenu();
      menu.innerHTML = "";
      const head = document.createElement("div");
      head.style.cssText = "padding:6px 10px;color:#6b7280;border-bottom:1px solid #eee;" +
        "margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;font-size:12px";
      head.textContent = (it.product_name || "") + " · " + (it.product_code || "");
      menu.appendChild(head);
      const mkItem = (label, onClick) => {
        const b = document.createElement("button");
        b.type = "button";
        b.style.cssText = "display:block;width:100%;text-align:left;background:none;border:none;" +
          "padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:#111827";
        b.textContent = label;
        b.addEventListener("mouseenter", () => { b.style.background = "#f3f4f6"; });
        b.addEventListener("mouseleave", () => { b.style.background = "none"; });
        b.addEventListener("click", (ev) => { ev.stopPropagation(); hideRecvCtxMenu(); onClick(); });
        menu.appendChild(b);
      };
      mkItem("🔄 Cambiar por otro producto", () => openRecvProdPicker(it));
      if (it.product_id) {
        mkItem("📋 Clonar este producto y asignarlo", () => recvCloneAssign(it));
        mkItem("✏️ Editar este producto", () => recvEditProduct(it));
      }
      mkItem("➕ Crear producto nuevo y asignarlo", () => {
        recvProdTargetItem = it;
        npOpenModal();
        npForReception = true;
        if (newProdModal) newProdModal.style.zIndex = "1500";
      });
      menu.style.display = "block";
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      let x = e.clientX, y = e.clientY;
      if (x + mw > window.innerWidth)  x = Math.max(8, window.innerWidth  - mw - 8);
      if (y + mh > window.innerHeight) y = Math.max(8, window.innerHeight - mh - 8);
      menu.style.left = x + "px";
      menu.style.top  = y + "px";
    });
  }

  // Picker de producto existente para repuntar la línea.
  async function openRecvProdPicker(item) {
    if (!recvEls.prodModal) return;
    recvProdTargetItem = item;
    if (recvEls.prodInfo) recvEls.prodInfo.textContent =
      "Línea: " + (item.product_name || "") + " · " + (item.product_code || "");
    if (recvEls.prodSearch) recvEls.prodSearch.value = "";
    recvEls.prodModal.hidden = false;
    await ensureAllProducts();
    renderRecvProdList("");
    setTimeout(() => { if (recvEls.prodSearch) recvEls.prodSearch.focus(); }, 60);
  }

  function renderRecvProdList(q) {
    if (!recvEls.prodTbody) return;
    q = (q || "").trim().toLowerCase();
    let list = state.allProducts || [];
    if (q) list = list.filter((p) =>
      (p.name || "").toLowerCase().indexOf(q) !== -1 ||
      String(p.code || "").toLowerCase().indexOf(q) !== -1);
    list = list.slice(0, 100);
    recvEls.prodTbody.innerHTML = list.length
      ? list.map((p) =>
          '<tr class="recv-prod-row" data-pid="' + p.id + '" style="cursor:pointer">' +
            "<td><code>" + escapeHtml(p.code || "") + "</code></td>" +
            "<td>" + escapeHtml(p.name || "") + "</td>" +
            '<td class="num">' + (p.stock != null ? p.stock : "") + "</td>" +
          "</tr>").join("")
      : '<tr><td colspan="3" class="muted">Sin resultados.</td></tr>';
  }

  async function recvAssignProduct(productId) {
    if (!recvProdTargetItem || !recvState.purchaseId) return;
    try {
      await api("/api/admin/reception/" + recvState.purchaseId + "/item/" + recvProdTargetItem.id + "/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      if (recvEls.prodModal) recvEls.prodModal.hidden = true;
      showToast("Producto de la línea actualizado.");
      await recvFetch(false);
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
  }

  async function recvCloneAssign(it) {
    if (!it.product_id) { showToast("Esta línea no tiene un producto asociado.", "error"); return; }
    try {
      const res = await api("/api/admin/products/" + it.product_id + "/duplicate", { method: "POST" });
      const np = res && res.product;
      if (!np) throw new Error("No se pudo clonar");
      state.allProducts = state.allProducts || [];
      state.allProducts.push(np);
      if (Array.isArray(state.products)) state.products.unshift(np);
      await api("/api/admin/reception/" + recvState.purchaseId + "/item/" + it.id + "/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: np.id }),
      });
      showToast("Gemelo creado (código " + np.code + ") y asignado a la línea. Editá lo que necesites.");
      await recvFetch(false);
      openEditProdModal(np);
      if (editProdModal) editProdModal.style.zIndex = "1500";
    } catch (err) {
      showToast(err.message || "Error al clonar", "error");
    }
  }

  async function recvEditProduct(it) {
    if (!it.product_id) { showToast("Esta línea no tiene un producto asociado.", "error"); return; }
    await ensureAllProducts();
    const p = (state.allProducts || []).find((x) => x.id === it.product_id);
    if (!p) { showToast("Producto no encontrado en el cache.", "error"); return; }
    openEditProdModal(p);
    if (editProdModal) editProdModal.style.zIndex = "1500";
  }

  if (recvEls.prodSearch) {
    recvEls.prodSearch.addEventListener("input", () => renderRecvProdList(recvEls.prodSearch.value));
  }
  if (recvEls.prodTbody) {
    recvEls.prodTbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-pid]");
      if (tr) recvAssignProduct(Number(tr.dataset.pid));
    });
  }
  if (recvEls.prodNew) {
    recvEls.prodNew.addEventListener("click", () => {
      // el item objetivo ya quedó en recvProdTargetItem al abrir el picker
      npOpenModal();
      npForReception = true;
      if (newProdModal) newProdModal.style.zIndex = "1500";
    });
  }

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
      list = list.filter((s) => matchWords((s.name || "") + " " + (s.contact || "") + " " + (s.phone || "") + " " + (s.email || ""), q));
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
        // Si se creó desde el modal de cotización, actualizar su select y auto-seleccionarlo
        if (state.supplierCreatedFromCotizacion) {
          state.supplierCreatedFromCotizacion = false;
          if (els.supplierCreateModal) els.supplierCreateModal.style.zIndex = "";
          populatePcotFormSupplier();
          if (els.pcotFormSupplier) els.pcotFormSupplier.value = String(out.supplier.id);
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
      if (els.purTfoot) els.purTfoot.innerHTML = "";
      return;
    }
    els.purTbody.innerHTML = list.map(purchaseRowHtml).join("");
    // Total que respeta los filtros activos (mes y/o proveedor).
    if (els.purTfoot) {
      const totalItems = list.reduce((s, p) => s + (Number(p.items_count) || 0), 0);
      const totalCost  = list.reduce((s, p) => s + (Number(p.total_cost) || 0), 0);
      const parts = [];
      if (monthFilter !== "all" && els.purMonthFilter && els.purMonthFilter.selectedOptions[0])
        parts.push(els.purMonthFilter.selectedOptions[0].textContent);
      if (supFilter !== "all" && els.purSupFilter && els.purSupFilter.selectedOptions[0])
        parts.push(els.purSupFilter.selectedOptions[0].textContent);
      const label = "Total" + (parts.length ? " · " + parts.join(" · ") : "");
      els.purTfoot.innerHTML =
        '<tr class="pur-total-row">' +
          '<td colspan="4" style="text-align:right"><strong>' + escapeHtml(label) + '</strong></td>' +
          '<td class="num"><strong>' + totalItems + '</strong></td>' +
          '<td class="num"><strong>' + fmtPrice(totalCost) + '</strong></td>' +
        '</tr>';
    }
    // Wiring de click para expandir detalle
    els.purTbody.querySelectorAll("tr.pur-row").forEach((tr) => {
      tr.addEventListener("click", () => togglePurchaseDetail(tr));
    });
  }

  function purchaseRowHtml(p) {
    const recvBadge = Number(p.received) === 1
      ? ' <span class="recv-chip recv-chip-ok">recibida</span>'
      : ' <span class="recv-chip recv-chip-pend">pendiente</span>';
    return '<tr class="pur-row" data-id="' + p.id + '" style="cursor:pointer">' +
      '<td class="cell-code">#' + p.id + '</td>' +
      '<td>' + escapeHtml(p.supplier_name || "—") + '</td>' +
      '<td>' + escapeHtml(p.reference || "—") + recvBadge + '</td>' +
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
      const editBtn = '<div class="pur-detail-actions">' +
        '<button type="button" class="btn btn-small pur-edit-btn" data-id="' + id + '">Editar compra</button> ' +
        '<button type="button" class="btn btn-small btn-danger pur-del-btn" data-id="' + id + '">🗑 Eliminar compra</button>' +
        '</div>';
      cell.innerHTML = notesHtml + tableHtml + editBtn;
      cell.querySelector(".pur-edit-btn").addEventListener("click", () => openPurchaseEdit(id));
      cell.querySelector(".pur-del-btn").addEventListener("click", async () => {
        const isRecv = Number(data.received) === 1;
        const units = (data.items || []).reduce((s, it) => s + (it.product_id ? Number(it.quantity) || 0 : 0), 0);
        const ok = await confirmModal({
          title: "🗑 Eliminar compra #" + id,
          message: "Vas a eliminar la compra #" + id + (data.supplier_name ? " de " + data.supplier_name : "") + "." +
            (isRecv
              ? "\n\n⚠ Esta compra YA fue recibida: se va a revertir el stock que sumó (" + units + " unidades en total)."
              : "\n\nEsta compra está pendiente de recibir: nunca sumó stock, el inventario no se toca.") +
            "\n\nTambién se elimina la deuda que generó en la cuenta corriente del proveedor (los pagos al proveedor quedan). " +
            "Los cambios de costo/precios que se aplicaron al cargarla NO se revierten.\n\nNo se puede deshacer.",
          confirmText: "Eliminar compra",
          danger: true,
        });
        if (!ok) return;
        try {
          const out = await api("/api/admin/purchases/" + id, { method: "DELETE" });
          showToast("Compra #" + id + " eliminada" +
            (out.was_received ? " · stock revertido (" + out.stock_reverted + " un.)" : " · sin impacto en stock"));
          state.purchasesLoaded = false;
          await loadPurchases();
          if (out.was_received) { state.allProductsLoaded = false; refreshProductsCache(); }
        } catch (err) {
          showToast("Error: " + err.message, "error");
        }
      });
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
    els.purItemsTbody.innerHTML = state.purchaseItems.map((it, idx) => {
      const mode    = it.pack_mode === "comprimido" ? "comprimido"
                    : it.pack_mode === "caja"       ? "caja"
                    : it.pack_mode === "unidad"     ? "unidad" : "tableta";
      const isComp  = mode === "comprimido";
      const isCaja  = mode === "caja";
      const cpt     = isComp ? Math.max(1, Number(it.cpt) || 1) : 1;
      const upb     = isCaja ? Math.max(1, Number(it.upb) || 1) : 1;
      const qtyVal  = isComp ? (Number(it.comp_qty) || 0) : isCaja ? (Number(it.caja_qty) || 0) : it.quantity;
      const costVal = isComp ? (Number(it.comp_cost) || 0) : isCaja ? (Number(it.caja_cost) || 0) : it.unit_cost;
      const tabIsInt = !isComp || (Number(it.comp_qty) || 0) % cpt === 0;
      const cajaIsInt = !isCaja || Number.isInteger(Number(it.quantity));
      const qtyTitle = isComp ? "Cantidad en comprimidos"
                     : isCaja ? "Cantidad en cajas/bultos (acepta 2.5)"
                     : "Cantidad en " + (mode === "unidad" ? "unidades" : "tabletas (unidades)");
      const modeSel =
        '<select class="admin-input pur-mode" data-idx="' + idx + '" style="font-size:10px;padding:1px 2px;width:100px;margin-bottom:3px">' +
          '<option value="tableta"' + (mode === "tableta" ? " selected" : "") + '>por tableta</option>' +
          '<option value="unidad"' + (mode === "unidad" ? " selected" : "") + '>por unidad</option>' +
          '<option value="caja"' + (isCaja ? " selected" : "") + '>por caja</option>' +
          '<option value="comprimido"' + (isComp ? " selected" : "") + '>por comprimido</option>' +
        '</select>';
      const compExtra = isComp
        ? '<div style="display:flex;align-items:center;gap:3px;justify-content:flex-end;margin-top:2px">' +
            '<input type="number" class="cell-input cell-num pur-cpt" min="1" step="1" value="' + cpt + '" data-idx="' + idx + '" style="width:46px" title="Comprimidos por tableta (detectado del nombre, editable)" />' +
            '<span style="font-size:10px;color:#9ca3af">c/tab</span>' +
          '</div>' +
          '<div style="font-size:10px;' + (tabIsInt ? "color:#9ca3af" : "color:#dc2626;font-weight:700") + '">= ' + fmtTabletas(it.quantity) + ' tabl' + (tabIsInt ? "" : " ⚠") + '</div>'
        : "";
      const cajaExtra = isCaja
        ? '<div style="display:flex;align-items:center;gap:3px;justify-content:flex-end;margin-top:2px">' +
            '<input type="number" class="cell-input cell-num pur-upb" min="1" step="1" value="' + upb + '" data-idx="' + idx + '" style="width:46px" title="Unidades por caja (und/bulto del producto, editable)" />' +
            '<span style="font-size:10px;color:#9ca3af">u/caja</span>' +
          '</div>' +
          '<div style="font-size:10px;' + (cajaIsInt ? "color:#9ca3af" : "color:#dc2626;font-weight:700") + '">= ' + fmtTabletas(it.quantity) + ' un' + (cajaIsInt ? "" : " ⚠") + '</div>'
        : "";
      return '<tr data-idx="' + idx + '">' +
        '<td><code>' + escapeHtml(it.product_code || "") + '</code></td>' +
        '<td>' + escapeHtml(it.product_name || "") + '</td>' +
        '<td class="num">' + modeSel +
          '<input type="number" class="cell-input cell-num pur-qty" ' + (isCaja ? 'min="0" step="any"' : 'min="1" step="1"') + ' value="' + qtyVal + '" data-idx="' + idx + '" style="width:70px" title="' + qtyTitle + '" />' +
          compExtra + cajaExtra +
        '</td>' +
        '<td class="num"><input type="number" class="cell-input cell-num pur-cost" min="0" step="0.01" value="' + costVal + '" data-idx="' + idx + '" style="width:90px" />' +
          (isComp ? '<div style="font-size:10px;color:#9ca3af">$/comp</div>' : isCaja ? '<div style="font-size:10px;color:#9ca3af">$/caja</div>' : "") +
        '</td>' +
        '<td class="num pur-subtotal">' + fmtPrice(it.subtotal) + '</td>' +
        '<td><button type="button" class="btn btn-small pur-remove" data-idx="' + idx + '">✕</button></td>' +
      '</tr>';
    }).join("");
    recalcPurchaseTotal();
  }

  // Recalcula quantity/unit_cost canónicos (en tabletas) de un item en modo comprimido.
  function purSyncComp(it) {
    const cpt = Math.max(1, Number(it.cpt) || 1);
    it.quantity = (Number(it.comp_qty) || 0) / cpt;
    it.unit_cost = Math.round((Number(it.comp_cost) || 0) * cpt);
    it.subtotal = it.unit_cost * it.quantity;
  }

  // Recalcula quantity/unit_cost canónicos de un item en modo caja (cantidad en
  // cajas × u/caja; costo por caja ÷ u/caja).
  function purSyncCaja(it) {
    const upb = Math.max(1, Number(it.upb) || 1);
    it.quantity = Math.round((Number(it.caja_qty) || 0) * upb * 100) / 100;
    it.unit_cost = Math.round((Number(it.caja_cost) || 0) / upb);
    it.subtotal = it.unit_cost * it.quantity;
  }

  function addPurchaseItem(product, qty) {
    const addQty = Math.max(1, Math.floor(Number(qty) || 1));
    const existing = state.purchaseItems.find((it) => it.product_id === product.id);
    if (existing) {
      // Respetar el modo del item si ya estaba en comprimido/caja.
      if (existing.pack_mode === "comprimido") {
        const cpt = Math.max(1, Number(existing.cpt) || 1);
        existing.comp_qty = (Number(existing.comp_qty) || 0) + addQty * cpt;
        purSyncComp(existing);
      } else if (existing.pack_mode === "caja") {
        const upb = Math.max(1, Number(existing.upb) || 1);
        existing.caja_qty = Math.round(((Number(existing.caja_qty) || 0) + addQty / upb) * 100) / 100;
        purSyncCaja(existing);
      } else {
        existing.quantity += addQty;
        existing.subtotal = existing.quantity * existing.unit_cost;
      }
    } else {
      state.purchaseItems.push({
        product_id: product.id,
        product_code: product.code || "",
        product_name: product.name || "",
        quantity: addQty,
        unit_cost: product.cost || 0,
        subtotal: (product.cost || 0) * addQty,
        // Analgésicos → "tableta"; resto → "por unidad" (default por rubro).
        pack_mode: isPillCategory(product) ? "tableta" : "unidad",
      });
    }
    renderPurchaseItems();
  }

  if (els.purItemsTbody) {
    els.purItemsTbody.addEventListener("input", (e) => {
      const idx = e.target.dataset.idx != null ? Number(e.target.dataset.idx) : -1;
      if (idx < 0 || !state.purchaseItems[idx]) return;
      const it = state.purchaseItems[idx];
      const isComp = it.pack_mode === "comprimido";
      const isCaja = it.pack_mode === "caja";
      if (e.target.classList.contains("pur-qty")) {
        if (isComp) { it.comp_qty = Math.max(1, Math.floor(Number(e.target.value) || 1)); purSyncComp(it); }
        else if (isCaja) { it.caja_qty = Math.max(0, Number(e.target.value) || 0); purSyncCaja(it); }
        else { it.quantity = Math.max(1, Math.floor(Number(e.target.value) || 1)); it.subtotal = it.quantity * it.unit_cost; }
      } else if (e.target.classList.contains("pur-cost")) {
        if (isComp) { it.comp_cost = Math.max(0, Number(e.target.value) || 0); purSyncComp(it); }
        else if (isCaja) { it.caja_cost = Math.max(0, Number(e.target.value) || 0); purSyncCaja(it); }
        else { it.unit_cost = Math.max(0, Number(e.target.value) || 0); it.subtotal = it.quantity * it.unit_cost; }
      } else if (e.target.classList.contains("pur-cpt")) {
        it.cpt = Math.max(1, Math.floor(Number(e.target.value) || 1)); purSyncComp(it);
      } else if (e.target.classList.contains("pur-upb")) {
        it.upb = Math.max(1, Math.floor(Number(e.target.value) || 1)); purSyncCaja(it);
      } else return;
      const tr = e.target.closest("tr");
      if (tr) {
        const subtotalCell = tr.querySelector(".pur-subtotal");
        if (subtotalCell) subtotalCell.textContent = fmtPrice(it.subtotal);
      }
      recalcPurchaseTotal();
    });

    // Cambio de modo/cpt (select y blur de inputs) → re-render para refrescar el
    // aviso "= N tabl ⚠" y los campos por comprimido.
    els.purItemsTbody.addEventListener("change", (e) => {
      const idx = e.target.dataset.idx != null ? Number(e.target.dataset.idx) : -1;
      if (idx < 0 || !state.purchaseItems[idx]) return;
      const it = state.purchaseItems[idx];
      if (e.target.classList.contains("pur-mode")) {
        if (e.target.value === "comprimido") {
          it.pack_mode = "comprimido";
          it.cpt = Math.max(1, parseComprimidos(it.product_name) || 1);
          it.comp_qty = Math.max(1, Math.round((it.quantity || 1) * it.cpt));
          it.comp_cost = Math.round((it.unit_cost || 0) / it.cpt);
          delete it.caja_qty; delete it.caja_cost; delete it.upb;
          purSyncComp(it);
        } else if (e.target.value === "caja") {
          it.pack_mode = "caja";
          // u/caja default = und/bulto del producto (editable en la fila)
          const prod = (state.allProducts || []).find((p) => p.id === it.product_id);
          it.upb = Math.max(1, Number(it.upb) || Number(prod && prod.units_per_bulto) || 1);
          it.caja_qty = Math.max(0, Math.round(((it.quantity || 1) / it.upb) * 100) / 100);
          it.caja_cost = Math.round((it.unit_cost || 0) * it.upb);
          delete it.comp_qty; delete it.comp_cost; delete it.cpt;
          purSyncCaja(it);
        } else {
          it.pack_mode = e.target.value === "unidad" ? "unidad" : "tableta";
          it.quantity = Math.max(1, Math.round(it.quantity || 1));
          it.subtotal = it.quantity * it.unit_cost;
          delete it.comp_qty; delete it.comp_cost; delete it.cpt;
          delete it.caja_qty; delete it.caja_cost; delete it.upb;
        }
        renderPurchaseItems();
      } else if ((it.pack_mode === "comprimido" || it.pack_mode === "caja") &&
                 (e.target.classList.contains("pur-qty") || e.target.classList.contains("pur-cost") ||
                  e.target.classList.contains("pur-cpt") || e.target.classList.contains("pur-upb"))) {
        renderPurchaseItems();
      }
    });

    els.purItemsTbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".pur-remove");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      state.purchaseItems.splice(idx, 1);
      renderPurchaseItems();
    });

    // La rueda del mouse sobre un input numérico enfocado le cambia el valor
    // sin querer (así se "bugean" cantidades al scrollear). Blur antes de que
    // el navegador aplique el cambio.
    els.purItemsTbody.addEventListener("wheel", (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('input[type="number"]') && document.activeElement === t) t.blur();
    }, { passive: true });
  }

  // ---- Picker de selección múltiple de productos (compra) ----
  // Inspirado en el picker de /ventas: checkbox + cantidad por fila, "agregar
  // seleccionados" al confirmar. Usa el cache state.allProducts.
  function renderPurPicker(filter) {
    if (!els.purPickerTbody) return;
    let list = state.allProducts || [];
    if (filter) {
      const q = filter.trim().toLowerCase();
      list = list.filter((p) => matchWords((p.name || "") + " " + (p.code || ""), q));
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
      // Monto que va sumando la compra con lo tildado (qty × costo).
      let sum = 0;
      state.purPickerSelected.forEach((qty, pid) => {
        const p = (state.allProducts || []).find((x) => x.id === pid);
        if (p) sum += (Number(p.cost) || 0) * qty;
      });
      els.purPickerCount.textContent = n + (n === 1 ? " seleccionado" : " seleccionados") + (n ? " · " + fmtPrice(sum) : "");
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
    // Al volver a clickear/enfocar el buscador, se limpia para arrancar una
    // búsqueda nueva (flujo de depósito: buscar, cargar cantidad, repetir).
    // La selección hecha hasta ahora se conserva (sigue tildada al re-renderizar).
    const purClearSearchOnReuse = () => {
      if (els.purPickerSearch.value) {
        els.purPickerSearch.value = "";
        renderPurPicker("");
      }
    };
    els.purPickerSearch.addEventListener("focus", purClearSearchOnReuse);
    els.purPickerSearch.addEventListener("click", purClearSearchOnReuse);
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

  // ---- Menú contextual del selector de Compras (clic derecho) ----
  // Sobre una fila ofrece dos acciones:
  //  • "Clonar este producto": crea un gemelo (copia con código nuevo
  //    correlativo) y abre su edición; al guardar queda seleccionado y listo
  //    para cargarlo a la compra.
  //  • "Editar este producto": abre la edición del producto seleccionado.
  // Ambas abren el modal de edición por encima del selector (z-index 1400).
  let purCtxMenu = null;
  function hidePurCtxMenu() { if (purCtxMenu) purCtxMenu.style.display = "none"; }
  function ensurePurCtxMenu() {
    if (purCtxMenu) return purCtxMenu;
    purCtxMenu = document.createElement("div");
    purCtxMenu.id = "pur-ctx-menu";
    purCtxMenu.style.cssText = "position:fixed;z-index:1450;display:none;background:#fff;" +
      "border:1px solid #d1d5db;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);" +
      "padding:4px;min-width:240px";
    document.body.appendChild(purCtxMenu);
    document.addEventListener("click", hidePurCtxMenu);
    document.addEventListener("scroll", hidePurCtxMenu, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hidePurCtxMenu(); });
    return purCtxMenu;
  }

  if (els.purPickerTbody) {
    els.purPickerTbody.addEventListener("contextmenu", (e) => {
      const tr = e.target.closest("tr[data-pid]");
      if (!tr) return;
      e.preventDefault();
      const pid = Number(tr.dataset.pid);
      const src = (state.allProducts || []).find((p) => p.id === pid);
      if (!src) return;
      const menu = ensurePurCtxMenu();
      menu.innerHTML = "";
      const head = document.createElement("div");
      head.style.cssText = "padding:6px 10px;color:#6b7280;border-bottom:1px solid #eee;" +
        "margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;font-size:12px";
      head.textContent = (src.name || "") + " · " + (src.code || "");
      menu.appendChild(head);
      const mkItem = (label, onClick) => {
        const b = document.createElement("button");
        b.type = "button";
        b.style.cssText = "display:block;width:100%;text-align:left;background:none;border:none;" +
          "padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:#111827";
        b.textContent = label;
        b.addEventListener("mouseenter", () => { b.style.background = "#f3f4f6"; });
        b.addEventListener("mouseleave", () => { b.style.background = "none"; });
        b.addEventListener("click", (ev) => { ev.stopPropagation(); hidePurCtxMenu(); onClick(); });
        menu.appendChild(b);
      };
      mkItem("📋 Clonar este producto", () => purDuplicateProduct(src));
      mkItem("✏️ Editar este producto", () => purEditProduct(src));
      menu.style.display = "block";
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      let x = e.clientX, y = e.clientY;
      if (x + mw > window.innerWidth)  x = Math.max(8, window.innerWidth  - mw - 8);
      if (y + mh > window.innerHeight) y = Math.max(8, window.innerHeight - mh - 8);
      menu.style.left = x + "px";
      menu.style.top  = y + "px";
    });
  }

  async function purDuplicateProduct(src) {
    try {
      const res = await api("/api/admin/products/" + src.id + "/duplicate", { method: "POST" });
      const np = res && res.product;
      if (!np) throw new Error("No se pudo crear el gemelo");
      // Sumar a los caches (selector de Compras + tabla de Productos)
      state.allProducts = state.allProducts || [];
      state.allProducts.push(np);
      if (Array.isArray(state.products)) state.products.unshift(np);
      // Dejarlo seleccionado y visible en el selector para cargarlo a la compra
      if (state.purPickerSelected) state.purPickerSelected.set(np.id, 1);
      if (els.purPickerSearch) els.purPickerSearch.value = String(np.code || "");
      renderPurPicker(els.purPickerSearch ? els.purPickerSearch.value : "");
      updatePurPickerCount();
      showToast("Gemelo creado (código " + np.code + "). Editá lo que necesites.");
      // Abrir edición por encima del selector (z-index 1300)
      openEditProdModal(np);
      if (editProdModal) editProdModal.style.zIndex = "1400";
    } catch (err) {
      showToast(err.message || "Error al crear el gemelo", "error");
    }
  }

  // Editar el producto seleccionado, con el modal por encima del selector. El
  // handler de guardado del modal ya sincroniza el cache del picker y lo
  // re-renderiza si está abierto.
  function purEditProduct(src) {
    openEditProdModal(src);
    if (editProdModal) editProdModal.style.zIndex = "1400";
  }

  // Crear un producto NUEVO desde cero (en blanco) sin salir del selector de
  // Compras. Abre el modal "Nuevo producto" por encima del picker (z-index
  // 1400); al guardar, el handler de npSaveBtn detecta npForPurchase y deja el
  // producto cargado en el cache + preseleccionado en el picker.
  let npForPurchase = false;
  let npForCotizacion = false;
  let npForReception = false;
  function purNewProduct() {
    npOpenModal();
    npForPurchase = true;
    if (newProdModal) newProdModal.style.zIndex = "1400";
  }
  if (els.purPickerNew) els.purPickerNew.addEventListener("click", purNewProduct);

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
      // Validación: en modo comprimido, los comprimidos deben dar tabletas enteras.
      const badComp = state.purchaseItems.find((it) => it.pack_mode === "comprimido" &&
        ((Number(it.comp_qty) || 0) % Math.max(1, Number(it.cpt) || 1) !== 0));
      if (badComp) {
        const cpt = Math.max(1, Number(badComp.cpt) || 1);
        await alertModal({ title: "Cantidad incompleta", message: '"' + (badComp.product_name || "Producto") +
          '": ' + (badComp.comp_qty || 0) + " comprimidos no es múltiplo de " + cpt +
          " (no da tabletas enteras). Ajustá la cantidad de comprimidos." });
        return;
      }
      // Validación: en modo caja, cajas × u/caja deben dar unidades enteras (≥ 1).
      const badCaja = state.purchaseItems.find((it) => it.pack_mode === "caja" &&
        (!(Number(it.quantity) >= 1) || !Number.isInteger(Number(it.quantity))));
      if (badCaja) {
        await alertModal({ title: "Cantidad incompleta", message: '"' + (badCaja.product_name || "Producto") +
          '": ' + (badCaja.caja_qty || 0) + " cajas × " + Math.max(1, Number(badCaja.upb) || 1) +
          " u/caja = " + fmtTabletas(badCaja.quantity) +
          " unidades — no da unidades enteras. Ajustá la cantidad de cajas o el u/caja." });
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
        // Refrescar productos por cambio de stock (refetch + re-render de la tabla)
        state.allProductsLoaded = false;
        refreshProductsCache();
      } catch (err) {
        if (els.purchaseCreateMsg) { els.purchaseCreateMsg.textContent = err.message; els.purchaseCreateMsg.className = "config-msg err"; }
      } finally {
        if (els.purSubmitBtn) els.purSubmitBtn.disabled = false;
      }
    });
  }

  // ========== COTIZACIONES ==========

  async function loadCotizaciones() {
    try {
      if (els.pcotTbody) els.pcotTbody.innerHTML = '<tr><td colspan="7" class="muted">Cargando…</td></tr>';
      state.cotizaciones = await api("/api/admin/purchase-requests");
      state.cotizacionesLoaded = true;
      if (!state.suppliersLoaded) {
        try { state.suppliers = await api("/api/admin/suppliers"); state.suppliersLoaded = true; } catch (_) {}
      }
      populatePcotSupFilter();
      renderCotizaciones();
    } catch (e) {
      if (els.pcotTbody) els.pcotTbody.innerHTML = '<tr><td colspan="7" class="muted">Error cargando cotizaciones</td></tr>';
    }
  }

  function populatePcotSupFilter() {
    if (!els.pcotSupFilter) return;
    const current = els.pcotSupFilter.value;
    const seen = new Map();
    state.cotizaciones.forEach((c) => {
      if (c.supplier_id && !seen.has(c.supplier_id))
        seen.set(c.supplier_id, c.supplier_name || ("Proveedor #" + c.supplier_id));
    });
    els.pcotSupFilter.innerHTML = '<option value="all">Todos los proveedores</option>';
    Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1], "es")).forEach(([id, name]) => {
      const o = document.createElement("option"); o.value = String(id); o.textContent = name;
      els.pcotSupFilter.appendChild(o);
    });
    if (current && els.pcotSupFilter.querySelector('[value="' + current + '"]')) els.pcotSupFilter.value = current;
  }

  function renderCotizaciones() {
    if (!els.pcotTbody) return;
    const supF    = els.pcotSupFilter    ? els.pcotSupFilter.value    : "all";
    const statusF = els.pcotStatusFilter ? els.pcotStatusFilter.value : "all";
    let list = state.cotizaciones;
    if (supF    !== "all") list = list.filter((c) => String(c.supplier_id) === supF);
    if (statusF !== "all") list = list.filter((c) => c.status === statusF);
    if (els.pcotCount) els.pcotCount.textContent = list.length + (list.length === 1 ? " cotización" : " cotizaciones");
    if (!list.length) {
      els.pcotTbody.innerHTML = '<tr><td colspan="7" class="muted">Sin cotizaciones.</td></tr>';
      return;
    }
    els.pcotTbody.innerHTML = list.map(cotizacionRowHtml).join("");
    els.pcotTbody.querySelectorAll("tr.pcot-row").forEach((tr) => {
      tr.addEventListener("click", () => toggleCotizacionDetail(tr));
    });
    els.pcotTbody.querySelectorAll(".pcot-edit-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await openEditCotizacion(Number(btn.dataset.id));
      });
    });
    els.pcotTbody.querySelectorAll(".pcot-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        if (!await confirmModal({ message: "¿Eliminar cotización #" + id + "?", confirmText: "Eliminar", danger: true })) return;
        try {
          await api("/api/admin/purchase-requests/" + id, { method: "DELETE" });
          state.cotizaciones = state.cotizaciones.filter((c) => c.id !== id);
          state.cotizacionesLoaded = false;
          renderCotizaciones();
          showToast("Cotización eliminada");
        } catch (err) { showToast("Error: " + err.message, "err"); }
      });
    });
  }

  function cotizacionRowHtml(c) {
    // Clases propias con tokens: antes se reusaba .tag-unified (que es el chip
    // violeta de "pedido unificado") pisándola con un verde inline.
    const statusChip = c.status === "enviado"
      ? '<span class="tag tag-sent">Enviado</span>'
      : '<span class="tag tag-draft">Borrador</span>';
    return '<tr class="pcot-row pur-row" data-id="' + c.id + '" style="cursor:pointer">' +
      '<td class="cell-code">#' + c.id + '</td>' +
      '<td>' + escapeHtml(c.supplier_name || "—") + '</td>' +
      '<td class="muted small-cell">' + escapeHtml((c.notes || "").slice(0, 60) || "—") + '</td>' +
      '<td>' + statusChip + '</td>' +
      '<td class="num">' + (c.items_count || 0) + '</td>' +
      '<td class="muted small-cell">' + formatDate(c.created_at) + '</td>' +
      '<td style="text-align:center;white-space:nowrap">' +
        '<button class="btn pcot-edit-btn" data-id="' + c.id + '" style="padding:2px 7px;font-size:12px;margin-right:3px" title="Editar">✏️</button>' +
        '<button class="btn pcot-delete-btn" data-id="' + c.id + '" style="padding:2px 7px;font-size:12px" title="Eliminar">🗑</button>' +
      '</td>' +
    '</tr>' +
    '<tr class="pcot-detail-row" data-for="' + c.id + '" hidden>' +
      '<td colspan="7" class="pur-detail-cell"><span class="muted">Cargando…</span></td>' +
    '</tr>';
  }

  async function toggleCotizacionDetail(tr) {
    const id = Number(tr.dataset.id);
    const detailRow = els.pcotTbody.querySelector('tr.pcot-detail-row[data-for="' + id + '"]');
    if (!detailRow) return;
    if (!detailRow.hidden) { detailRow.hidden = true; return; }
    detailRow.hidden = false;
    if (detailRow.dataset.loaded) return;
    try {
      const data = await api("/api/admin/purchase-requests/" + id);
      detailRow.dataset.loaded = "1";
      if (!data.items || !data.items.length) {
        detailRow.querySelector("td").innerHTML = '<span class="muted">Sin productos.</span>'; return;
      }
      const rows = data.items.map((it) =>
        '<tr><td class="cell-code">' + escapeHtml(it.product_code || "—") + '</td>' +
        '<td>' + escapeHtml(it.product_name) + '</td>' +
        '<td class="num">' + it.quantity + '</td></tr>'
      ).join("");
      detailRow.querySelector("td").innerHTML =
        '<table class="admin-table" style="margin:4px 0"><thead><tr>' +
        '<th>Código</th><th>Producto</th><th class="num">Cant.</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>';
    } catch (_) {
      detailRow.querySelector("td").innerHTML = '<span class="muted">Error cargando detalle.</span>';
    }
  }

  function populatePcotFormSupplier() {
    if (!els.pcotFormSupplier) return;
    els.pcotFormSupplier.innerHTML = '<option value="">Sin proveedor</option>';
    state.suppliers.filter((s) => s.active).forEach((s) => {
      const o = document.createElement("option"); o.value = String(s.id); o.textContent = s.name;
      els.pcotFormSupplier.appendChild(o);
    });
  }

  // Re-render de la tabla de items preservando el campo enfocado y la posición
  // del cursor. Sin esto, editar precio/cantidad y tocar otra celda destruía
  // todos los inputs (renderCotizacionItems reconstruye el tbody entero) y el
  // foco saltaba al body, así que había que volver a clickear el campo.
  function rerenderCotizacionPreservingFocus() {
    const active = document.activeElement;
    let key = null, selStart = null, selEnd = null;
    if (active && els.pcotItemsTbody && els.pcotItemsTbody.contains(active) && active.dataset && active.dataset.cotIdx != null) {
      const cls = ["pcot-price-input", "pcot-qty-input", "pcot-upb-input", "pcot-pack-input"]
        .find((c) => active.classList.contains(c));
      if (cls) {
        key = { idx: active.dataset.cotIdx, cls };
        try { selStart = active.selectionStart; selEnd = active.selectionEnd; } catch (_) {}
      }
    }
    renderCotizacionItems();
    if (key) {
      const el = els.pcotItemsTbody.querySelector("." + key.cls + '[data-cot-idx="' + key.idx + '"]');
      if (el) {
        el.focus();
        if (selStart != null) { try { el.setSelectionRange(selStart, selEnd); } catch (_) {} }
      }
    }
  }

  // Comprimidos por tableta (la tableta es la unidad del sistema). Se detecta del
  // nombre del producto: toma el último "x N" (ej. "Amoxicilina 500 x 8" → 8,
  // "Ibuprofeno 400 Savant x10 comp" → 10). Devuelve null si no encuentra.
  function parseComprimidos(name) {
    if (!name) return null;
    const s = String(name).toLowerCase();
    let last = null, m;
    // "x 20", "x20 Comp" cuentan; medidas NO: "x 100ml", "x 500 gr", "x 1u."
    const re = /x\s*(\d{1,4})\s*([a-záéíóúü]*)/g;
    const measure = /^(ml|mls|cc|cm|mm|cm3|l|lt|lts|litros?|g|gr|grs|kg|kgs|mg|mgs|u|un|unid|unidades?|vol|v|w)$/;
    while ((m = re.exec(s))) {
      if (m[2] && measure.test(m[2])) continue;
      const n = Number(m[1]);
      if (n > 1) last = n;
    }
    return last;
  }
  // Solo las categorías de comprimidos (ANALGESICOS, ANALGESICOS G.) arrancan en
  // modo pastilla por defecto (tableta en compras, comprimido en cotizaciones); el
  // resto de los rubros arranca "por unidad". El usuario igual puede cambiarlo por fila.
  function isPillCategory(product) {
    const cat = String((product && product.category_name) || "").trim().toUpperCase();
    return cat.indexOf("ANALGESICO") === 0;
  }
  // Comprimidos/tableta efectivos del item: override manual del item, o detectado.
  function cotComprimidos(it) {
    if (it.comprimidos_per_unit && it.comprimidos_per_unit > 1) return it.comprimidos_per_unit;
    const c = parseComprimidos(it.product_name);
    return c && c > 1 ? c : 1;
  }
  // Formatea una cantidad de tabletas (puede dar fraccionada al cotizar por comprimido).
  function fmtTabletas(n) {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
  }

  function renderCotizacionItems() {
    if (!els.pcotItemsTbody) return;
    if (!state.cotizacionItems.length) {
      els.pcotItemsTbody.innerHTML = '<tr><td colspan="9" class="muted" style="padding:12px;text-align:center">Sin productos. Usá "+ Agregar productos".</td></tr>';
      if (els.pcotItemsTfoot) els.pcotItemsTfoot.innerHTML = "";
      if (els.pcotTotalDisp) els.pcotTotalDisp.textContent = "";
      return;
    }
    let totalSubtotal = 0, totalDiff = 0;
    els.pcotItemsTbody.innerHTML = state.cotizacionItems.map((it, idx) => {
      const upb      = it.units_per_bulto || 1;
      const cpt      = cotComprimidos(it);
      const pack     = it.pack_unit || "bulto";
      const isComp   = pack === "comprimido";
      const elemSing = pack === "caja" ? "caja" : isComp ? "comprimido" : "bulto";
      const elemPlur = pack === "caja" ? "cajas" : isComp ? "comprimidos" : "bultos";
      const elemAbbr = pack === "caja" ? "caja" : isComp ? "comp" : "bulto";
      const hasPack  = pack !== "unidad";
      // priceMult: precio_empaque = unit_price × priceMult (unit_price = canónico por tableta).
      //   bulto/caja: ×upb (empaque más grande). comprimido: ×(1/cpt) (comprimido más chico).
      // qtyFactor: quantity(tabletas) = inputQty × qtyFactor. En comprimido el input es en
      //   comprimidos → quantity = comprimidos / cpt. En bulto la cantidad sigue en tabletas.
      const priceMult = pack === "unidad" ? 1 : isComp ? (1 / cpt) : upb;
      const qtyFactor = isComp ? (1 / cpt) : 1;
      const costoAct = it.current_cost || 0;
      const precio   = it.unit_price || 0;                 // canónico: por tableta (unidad del sistema)
      const packPriceVal = precio ? Math.round(precio * priceMult) : "";
      const qtyDisp  = qtyFactor !== 1 ? Math.round(it.quantity / qtyFactor) : it.quantity;
      const packs    = (pack === "bulto" || pack === "caja") && upb > 1 ? Math.ceil(it.quantity / upb) : "";
      const subtotal = precio * it.quantity;
      const diffUnit = precio - costoAct;
      const diffTotal = diffUnit * it.quantity;
      const diffPct  = costoAct > 0 ? ((diffUnit / costoAct) * 100).toFixed(1) : null;
      totalSubtotal += subtotal;
      totalDiff     += diffTotal;
      const diffColor = diffUnit > 0 ? "#ef4444" : diffUnit < 0 ? "#16a34a" : "#9ca3af";
      const diffLabel = (diffUnit >= 0 ? "+" : "") + fmtPrice(diffTotal) +
        (diffPct !== null ? ' <span style="font-size:10px">(' + (diffUnit >= 0 ? "+" : "") + diffPct + '%)</span>' : "");
      const packSelect =
        '<select data-cot-idx="' + idx + '" class="admin-input pcot-pack-input" ' +
        'style="font-size:11px;padding:2px 4px;width:104px" title="Cómo lo cotiza el proveedor">' +
          '<option value="unidad"'     + (pack === "unidad" ? " selected" : "") + '>por unidad</option>' +
          '<option value="caja"'       + (pack === "caja"   ? " selected" : "") + '>por caja</option>' +
          '<option value="bulto"'      + (pack === "bulto"  ? " selected" : "") + '>por bulto</option>' +
          '<option value="comprimido"' + (isComp            ? " selected" : "") + '>por comprimido</option>' +
        '</select>';
      let packBody;
      if (pack === "unidad") {
        packBody = '<div style="font-size:11px;color:#d1d5db">por unidad</div>';
      } else if (isComp) {
        packBody =
          '<div style="display:flex;align-items:center;gap:4px">' +
            '<input type="number" min="1" step="1" value="' + cpt + '" ' +
            'style="width:52px;text-align:center;font-size:13px;padding:3px 4px" ' +
            'data-cot-idx="' + idx + '" class="admin-input pcot-cpt-input" title="Comprimidos por tableta (detectado del nombre; editable si no coincide)">' +
            '<span style="font-size:11px;color:#9ca3af;font-weight:500">comp/tabl</span>' +
          '</div>' +
          '<div style="font-size:12px;color:#f59e0b;font-weight:700">= ' + fmtTabletas(it.quantity) + ' tabl.</div>';
      } else {
        packBody =
          '<div style="display:flex;align-items:center;gap:4px">' +
            '<input type="number" min="1" step="1" value="' + upb + '" ' +
            'style="width:52px;text-align:center;font-size:13px;padding:3px 4px" ' +
            'data-cot-idx="' + idx + '" class="admin-input pcot-upb-input" title="Unidades por ' + elemSing + '">' +
            '<span style="font-size:11px;color:#9ca3af;font-weight:500">u/' + elemSing + '</span>' +
          '</div>' +
          (upb > 1
            ? '<div style="font-size:12px;color:#f59e0b;font-weight:700">= ' + packs + ' ' + (packs === 1 ? elemSing : elemPlur) + '</div>'
            : '<div style="font-size:11px;color:#d1d5db">—</div>');
      }
      const bultoCell =
        '<td style="text-align:center;white-space:nowrap;min-width:120px">' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:3px">' +
            packSelect + packBody +
          '</div>' +
        '</td>';
      const stockVal = it.stock != null ? Number(it.stock) || 0 : null;
      return '<tr>' +
        '<td class="cell-code" style="font-size:11px">' + escapeHtml(it.product_code || "—") + '</td>' +
        '<td>' + escapeHtml(it.product_name) + '</td>' +
        '<td style="text-align:right;color:#6b7280">' + (costoAct ? fmtPrice(costoAct) : '—') + '</td>' +
        '<td style="text-align:right">' + (stockVal != null ? '<span style="font-weight:600;color:' + (stockVal > 0 ? "#059669" : "#9ca3af") + '">' + stockVal + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td style="text-align:right">' +
          '<div style="display:inline-flex;flex-direction:column;align-items:flex-end;gap:1px">' +
            '<input type="text" inputmode="decimal" value="' + packPriceVal + '" placeholder="0" ' +
            'title="Precio por ' + (hasPack ? elemSing : "unidad") + ' que te cotiza el proveedor (podés usar coma: 96,5)" ' +
            'data-cot-idx="' + idx + '" data-price-mult="' + priceMult + '" ' +
            'style="width:84px;text-align:right" class="admin-input pcot-price-input">' +
            (hasPack
              ? '<div style="font-size:10px;color:#9ca3af;line-height:1.1">$/' + elemAbbr + (precio ? ' · ' + fmtPrice(precio) + '/u' : '') + '</div>'
              : '') +
          '</div>' +
        '</td>' +
        '<td style="text-align:right">' +
          '<input type="number" min="1" value="' + qtyDisp + '" style="width:78px;text-align:right;font-size:15px;padding:5px 6px" ' +
          'data-cot-idx="' + idx + '" data-qty-factor="' + qtyFactor + '" class="admin-input pcot-qty-input" ' +
          'title="' + (isComp ? "Cantidad en comprimidos" : "Cantidad en unidades (tabletas)") + '">' +
          (isComp ? '<div style="font-size:10px;color:#9ca3af;line-height:1.1">comp · = ' + fmtTabletas(it.quantity) + ' tabl</div>' : '') +
        '</td>' +
        '<td style="text-align:right;font-weight:600">' + (precio ? fmtPrice(subtotal) : '—') + '</td>' +
        '<td style="text-align:right;font-weight:600;color:' + diffColor + '">' + (precio && costoAct ? diffLabel : '—') + '</td>' +
        bultoCell +
        '<td><button type="button" class="btn pcot-remove-item" data-cot-idx="' + idx + '" ' +
          'style="padding:2px 6px;font-size:12px">✕</button></td>' +
        '</tr>';
    }).join("");

    // Tfoot con totales
    if (els.pcotItemsTfoot) {
      const totalDiffColor = totalDiff > 0 ? "#ef4444" : totalDiff < 0 ? "#16a34a" : "#9ca3af";
      els.pcotItemsTfoot.innerHTML =
        '<tr style="background:#f8fafc;font-weight:700">' +
        '<td colspan="6" style="text-align:right;padding:6px 8px">Total</td>' +
        '<td style="text-align:right;padding:6px 8px">' + fmtPrice(totalSubtotal) + '</td>' +
        '<td style="text-align:right;padding:6px 8px;color:' + totalDiffColor + '">' +
          (totalDiff !== 0 ? (totalDiff > 0 ? "+" : "") + fmtPrice(totalDiff) : "—") +
        '</td>' +
        '<td colspan="2"></td>' +
        '</tr>';
    }

    // Total siempre visible en el pie sticky del modal (el tfoot queda lejos con muchos items).
    if (els.pcotTotalDisp) {
      const nItems = state.cotizacionItems.length;
      els.pcotTotalDisp.textContent = nItems + (nItems === 1 ? " producto" : " productos") + " · Total: " + fmtPrice(totalSubtotal);
    }

    // precio change
    els.pcotItemsTbody.querySelectorAll(".pcot-price-input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const i = Number(inp.dataset.cotIdx);
        const mult = Number(inp.dataset.priceMult) || 1;
        // Parser es-AR: acepta coma decimal ("96,5") y punto de miles ("8.000").
        const parsed = recvParseNum(inp.value);
        if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
          showToast("Precio inválido");
          return;
        }
        const packPrice = parsed || 0;
        // Convertir el precio del empaque a precio por unidad (canónico).
        state.cotizacionItems[i].unit_price = packPrice ? Math.round(packPrice / mult) : null;
        rerenderCotizacionPreservingFocus();
      });
    });
    // qty change → re-render para actualizar el badge de bultos/tabletas.
    // En modo comprimido el input es en comprimidos: quantity(tabletas) = comp × (1/cpt).
    els.pcotItemsTbody.querySelectorAll(".pcot-qty-input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const i = Number(inp.dataset.cotIdx);
        const f = Number(inp.dataset.qtyFactor) || 1;
        const raw = Math.max(1, Number(inp.value) || 1);
        state.cotizacionItems[i].quantity = f !== 1 ? raw * f : raw;
        rerenderCotizacionPreservingFocus();
      });
    });
    // comprimidos/tableta change (modo por comprimido) → solo en el item (no toca el producto)
    els.pcotItemsTbody.querySelectorAll(".pcot-cpt-input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const i = Number(inp.dataset.cotIdx);
        state.cotizacionItems[i].comprimidos_per_unit = Math.max(1, Number(inp.value) || 1);
        rerenderCotizacionPreservingFocus();
      });
    });
    // und/bulto change → guarda en item + en producto + re-render
    els.pcotItemsTbody.querySelectorAll(".pcot-upb-input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const i = Number(inp.dataset.cotIdx);
        const upb = Math.max(1, Number(inp.value) || 1);
        state.cotizacionItems[i].units_per_bulto = upb;
        // Persistir en el producto del cache
        const pid = state.cotizacionItems[i].product_id;
        if (pid) {
          const ap = (state.allProducts || []).find((p) => p.id === pid);
          if (ap) ap.units_per_bulto = upb;
          const sp = (state.products || []).find((p) => p.id === pid);
          if (sp) sp.units_per_bulto = upb;
          // Guardar en el servidor
          api("/api/admin/products/" + pid, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ units_per_bulto: upb }),
          }).catch(() => {});
        }
        rerenderCotizacionPreservingFocus();
      });
    });
    // empaque change → guarda en el item. "comprimido" es un modo de cotización a
    // nivel del item (no se persiste como pack del producto: un producto puede ser
    // por bulto Y cotizarse por comprimido). unidad/caja/bulto sí se persisten.
    els.pcotItemsTbody.querySelectorAll(".pcot-pack-input").forEach((sel) => {
      sel.addEventListener("change", () => {
        const i = Number(sel.dataset.cotIdx);
        const pack = ["unidad", "caja", "bulto", "comprimido"].includes(sel.value) ? sel.value : "bulto";
        state.cotizacionItems[i].pack_unit = pack;
        const pid = state.cotizacionItems[i].product_id;
        if (pid && pack !== "comprimido") {
          const ap = (state.allProducts || []).find((p) => p.id === pid);
          if (ap) ap.pack_unit = pack;
          const sp = (state.products || []).find((p) => p.id === pid);
          if (sp) sp.pack_unit = pack;
          api("/api/admin/products/" + pid, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pack_unit: pack }),
          }).catch(() => {});
        }
        rerenderCotizacionPreservingFocus();
      });
    });
    // remove
    els.pcotItemsTbody.querySelectorAll(".pcot-remove-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.cotIdx);
        state.cotizacionItems.splice(i, 1);
        renderCotizacionItems();
      });
    });
  }

  // Picker de productos para cotizaciones
  function renderCotPickerRows(filter) {
    if (!els.pcotPickerTbody) return;
    const q   = (filter || "").toLowerCase().trim();
    const cat = els.pcotPickerCat ? els.pcotPickerCat.value : "";
    let prods = state.allProducts || [];
    if (q)   prods = prods.filter((p) => matchWords((p.name || "") + " " + (p.code || ""), q));
    if (cat) prods = prods.filter((p) => String(p.category_id) === cat);
    if (!prods.length) {
      els.pcotPickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:16px;text-align:center">Sin resultados.</td></tr>';
      return;
    }
    els.pcotPickerTbody.innerHTML = prods.map((p) => {
      const sel   = state.cotPickerSelected.has(p.id);
      const qty   = sel ? state.cotPickerSelected.get(p.id).qty : "";
      const price = Math.max(0, Number(p.cost) || 0);
      return '<tr data-pid="' + p.id + '">' +
        '<td><input type="checkbox" class="pcot-pick-cb" data-id="' + p.id + '"' + (sel ? " checked" : "") + ' /></td>' +
        '<td><div>' + escapeHtml(p.name || "") + '</div><code class="muted">' + escapeHtml(p.code || "") + '</code></td>' +
        '<td class="num"><input type="number" class="cell-input cell-num pcot-pick-qty" data-id="' + p.id + '" min="1" step="1" value="' + qty + '" placeholder="1" style="width:60px" /></td>' +
        '<td class="num">' + fmtPrice(price) + '</td>' +
        '<td class="num" style="color:' + ((p.stock || 0) > 0 ? "#059669" : "#9ca3af") + '">' + (p.stock || 0) + '</td>' +
      '</tr>';
    }).join("");
    // checkbox wiring
    els.pcotPickerTbody.querySelectorAll(".pcot-pick-cb").forEach((cb) => {
      cb.addEventListener("change", () => {
        const pid = Number(cb.dataset.id);
        const qtyInp = els.pcotPickerTbody.querySelector('.pcot-pick-qty[data-id="' + pid + '"]');
        const qty = Math.max(1, Number(qtyInp ? qtyInp.value : 1) || 1);
        const prod = state.allProducts.find((p) => p.id === pid);
        if (cb.checked) { state.cotPickerSelected.set(pid, { qty, product: prod }); }
        else { state.cotPickerSelected.delete(pid); }
        updateCotPickerCount();
      });
    });
    // Tipear cantidad marca el checkbox y actualiza el monto en vivo
    // (misma mecánica que los pickers de ventas/pedidos/compras).
    els.pcotPickerTbody.querySelectorAll(".pcot-pick-qty").forEach((inp) => {
      inp.addEventListener("input", () => {
        const pid = Number(inp.dataset.id);
        if (inp.value === "") return;
        const qty = Math.max(1, Number(inp.value) || 1);
        const entry = state.cotPickerSelected.get(pid);
        if (entry) {
          entry.qty = qty;
        } else {
          const prod = state.allProducts.find((p) => p.id === pid);
          state.cotPickerSelected.set(pid, { qty, product: prod });
        }
        const cb = els.pcotPickerTbody.querySelector('.pcot-pick-cb[data-id="' + pid + '"]');
        if (cb && !cb.checked) cb.checked = true;
        updateCotPickerCount();
      });
    });
    // select-all checkbox sync
    if (els.pcotPickerAll) {
      const cbs = Array.from(els.pcotPickerTbody.querySelectorAll(".pcot-pick-cb"));
      els.pcotPickerAll.checked = cbs.length > 0 && cbs.every((c) => c.checked);
      els.pcotPickerAll.indeterminate = !els.pcotPickerAll.checked && cbs.some((c) => c.checked);
    }
  }

  function updateCotPickerCount() {
    const n = state.cotPickerSelected.size;
    if (els.pcotPickerCount) {
      // Monto que va sumando la cotización con lo tildado (qty × costo o precio guardado).
      let sum = 0;
      state.cotPickerSelected.forEach(({ qty, product, existingPrice }) => {
        const price = existingPrice != null ? Number(existingPrice) : Math.max(0, Number(product && product.cost) || 0);
        sum += price * qty;
      });
      els.pcotPickerCount.textContent = n + " seleccionado" + (n !== 1 ? "s" : "") + (n ? " · " + fmtPrice(sum) : "");
    }
    if (els.pcotPickerConfirm) els.pcotPickerConfirm.disabled = n === 0;
  }

  async function openEditCotizacion(id) {
    try {
      const [data] = await Promise.all([
        api("/api/admin/purchase-requests/" + id),
        ensureAllProducts(),
        (!state.suppliersLoaded ? api("/api/admin/suppliers").then((s) => { state.suppliers = s; state.suppliersLoaded = true; }).catch(() => {}) : Promise.resolve()),
      ]);
      state.editingCotizacionId = id;
      state.cotizacionItems = (data.items || []).map((it) => {
        const prod = (state.allProducts || []).find((p) => p.id === it.product_id);
        // El modo de empaque guardado en la cotización (pack_mode) tiene prioridad
        // sobre el del producto, para recordar lo que el usuario eligió (ej: comprimido).
        const savedMode = ["unidad", "caja", "bulto", "comprimido"].includes(it.pack_mode) ? it.pack_mode : null;
        const obj = {
          product_id: it.product_id, product_code: it.product_code,
          product_name: it.product_name, quantity: it.quantity,
          unit_price: it.unit_price || (prod ? prod.cost : null) || null,
          current_cost: prod ? (prod.cost || 0) : 0,
          units_per_bulto: prod ? (prod.units_per_bulto || 1) : 1,
          pack_unit: savedMode || (isPillCategory(prod) ? "comprimido" : "unidad"),
          stock: prod && prod.stock != null ? prod.stock : null,
        };
        if (it.comprimidos_per_unit && it.comprimidos_per_unit > 1) obj.comprimidos_per_unit = Number(it.comprimidos_per_unit);
        return obj;
      });
      state.cotPickerSelected = new Map();
      if (els.pcotModalTitle) els.pcotModalTitle.textContent = "Editar cotización #" + id;
      if (els.pcotFormStatus)   els.pcotFormStatus.value = data.status || "borrador";
      if (els.pcotFormNotes)    els.pcotFormNotes.value  = data.notes  || "";
      if (els.pcotCreateMsg)    { els.pcotCreateMsg.textContent = ""; els.pcotCreateMsg.className = "config-msg"; }
      if (els.pcotConvertBtn)   els.pcotConvertBtn.hidden = false;
      populatePcotFormSupplier();
      if (els.pcotFormSupplier) els.pcotFormSupplier.value = String(data.supplier_id || "");
      renderCotizacionItems();
      if (els.pcotCreateModal) els.pcotCreateModal.hidden = false;
    } catch (err) { showToast("Error: " + err.message, "err"); }
  }

  function initCotizacionesListeners() {
    if (!els.pcotCreateBtn) return;

    // Abrir modal de creación
    els.pcotCreateBtn.addEventListener("click", async () => {
      state.editingCotizacionId = null;
      state.cotizacionItems = [];
      state.cotPickerSelected = new Map();
      if (els.pcotModalTitle)   els.pcotModalTitle.textContent = "Nueva cotización";
      if (els.pcotFormSupplier) els.pcotFormSupplier.value = "";
      if (els.pcotFormStatus)   els.pcotFormStatus.value = "borrador";
      if (els.pcotFormNotes)    els.pcotFormNotes.value = "";
      if (els.pcotCreateMsg)    { els.pcotCreateMsg.textContent = ""; els.pcotCreateMsg.className = "config-msg"; }
      if (els.pcotConvertBtn)   els.pcotConvertBtn.hidden = true;
      renderCotizacionItems();
      if (!state.suppliersLoaded) {
        try { state.suppliers = await api("/api/admin/suppliers"); state.suppliersLoaded = true; } catch (_) {}
      }
      populatePcotFormSupplier();
      await ensureAllProducts();
      if (els.pcotCreateModal) els.pcotCreateModal.hidden = false;
    });

    // Cancelar modal de creación
    if (els.pcotCancelBtn) els.pcotCancelBtn.addEventListener("click", () => {
      if (els.pcotCreateModal) els.pcotCreateModal.hidden = true;
    });

    // Botón ＋ para crear nuevo proveedor desde cotización
    if (els.pcotAddSupBtn) {
      els.pcotAddSupBtn.addEventListener("click", () => {
        state.supplierCreatedFromCotizacion = true;
        if (els.supplierCreateForm) els.supplierCreateForm.reset();
        if (els.supplierCreateMsg) els.supplierCreateMsg.textContent = "";
        if (els.supplierCreateModal) {
          els.supplierCreateModal.style.zIndex = "1400";
          els.supplierCreateModal.hidden = false;
        }
        setTimeout(() => {
          if (els.supplierCreateForm) els.supplierCreateForm.querySelector('[name="name"]').focus();
        }, 50);
      });
    }

    // Abrir picker
    if (els.pcotAddBtn) els.pcotAddBtn.addEventListener("click", async () => {
      state.cotPickerSelected = new Map();
      // Pre-marcar los que ya están en la lista
      state.cotizacionItems.forEach((it) => {
        if (it.product_id) {
          const prod = state.allProducts.find((p) => p.id === it.product_id);
          state.cotPickerSelected.set(it.product_id, { qty: it.quantity, product: prod, existingPrice: it.unit_price });
        }
      });
      if (els.pcotPickerSearch) els.pcotPickerSearch.value = "";
      if (els.pcotPickerCat) els.pcotPickerCat.value = "";
      // Poblar categorías
      if (!state.allCategories.length) {
        try { state.allCategories = await api("/api/categories"); } catch (_) {}
      }
      if (els.pcotPickerCat) {
        const prev = els.pcotPickerCat.value;
        els.pcotPickerCat.innerHTML = '<option value="">Todas las categorías</option>';
        state.allCategories.forEach((c) => {
          const o = document.createElement("option"); o.value = String(c.id); o.textContent = c.name;
          els.pcotPickerCat.appendChild(o);
        });
        if (prev && els.pcotPickerCat.querySelector('[value="' + prev + '"]')) els.pcotPickerCat.value = prev;
      }
      renderCotPickerRows("");
      updateCotPickerCount();
      if (els.pcotPickerModal) els.pcotPickerModal.hidden = false;
      setTimeout(() => { if (els.pcotPickerSearch) els.pcotPickerSearch.focus(); }, 60);
    });

    // Filtro de categoría en picker
    if (els.pcotPickerCat) {
      els.pcotPickerCat.addEventListener("change", () => {
        renderCotPickerRows(els.pcotPickerSearch ? els.pcotPickerSearch.value : "");
        updateCotPickerCount();
      });
    }

    // Botón crear producto desde picker
    if (els.pcotPickerNew) {
      els.pcotPickerNew.addEventListener("click", () => {
        npForCotizacion = true;
        npOpenModal();
        if (newProdModal) newProdModal.style.zIndex = "1500";
      });
    }

    // Buscar en picker
    if (els.pcotPickerSearch) {
      els.pcotPickerSearch.addEventListener("input", () => {
        renderCotPickerRows(els.pcotPickerSearch ? els.pcotPickerSearch.value : "");
        updateCotPickerCount();
      });
      // Al volver a clickear/enfocar el buscador, se limpia para arrancar una
      // búsqueda nueva (igual que el picker de compras y el de editar pedido).
      // La selección hecha hasta ahora se conserva (sigue tildada al re-renderizar).
      const pcotClearSearchOnReuse = () => {
        if (els.pcotPickerSearch.value) {
          els.pcotPickerSearch.value = "";
          renderCotPickerRows("");
          updateCotPickerCount();
        }
      };
      els.pcotPickerSearch.addEventListener("focus", pcotClearSearchOnReuse);
      els.pcotPickerSearch.addEventListener("click", pcotClearSearchOnReuse);
    }

    // Tipear cantidad marca el checkbox y guarda la cantidad (igual que pur-picker)
    if (els.pcotPickerModal) {
      els.pcotPickerModal.addEventListener("input", (e) => {
        if (!e.target.classList.contains("pcot-pick-qty")) return;
        const pid = Number(e.target.dataset.id);
        const raw = e.target.value;
        if (raw === "") return;
        const q = Math.max(1, Math.floor(Number(raw) || 0));
        const prod = state.allProducts.find((p) => p.id === pid);
        state.cotPickerSelected.set(pid, { qty: q, product: prod });
        const tr = e.target.closest("tr[data-pid]");
        const cb = tr ? tr.querySelector(".pcot-pick-cb") : null;
        if (cb && !cb.checked) cb.checked = true;
        updateCotPickerCount();
      });
    }

    // Select-all en picker
    if (els.pcotPickerAll) {
      els.pcotPickerAll.addEventListener("change", () => {
        const checked = els.pcotPickerAll.checked;
        els.pcotPickerTbody.querySelectorAll(".pcot-pick-cb").forEach((cb) => {
          const pid = Number(cb.dataset.id);
          const qtyInp = els.pcotPickerTbody.querySelector('.pcot-pick-qty[data-id="' + pid + '"]');
          const qty = Math.max(1, Number(qtyInp ? qtyInp.value : 1) || 1);
          const prod = state.allProducts.find((p) => p.id === pid);
          if (checked) { state.cotPickerSelected.set(pid, { qty, product: prod }); cb.checked = true; }
          else { state.cotPickerSelected.delete(pid); cb.checked = false; }
        });
        updateCotPickerCount();
      });
    }

    // Cancelar picker
    if (els.pcotPickerCancel) els.pcotPickerCancel.addEventListener("click", () => {
      if (els.pcotPickerModal) els.pcotPickerModal.hidden = true;
    });

    // Confirmar picker
    if (els.pcotPickerConfirm) els.pcotPickerConfirm.addEventListener("click", () => {
      // Mezcla seleccionados con los que ya estaban (por product_id)
      const existing = new Map(state.cotizacionItems.map((it) => [it.product_id, it]));
      state.cotPickerSelected.forEach(({ qty, product, existingPrice }, pid) => {
        if (existing.has(pid)) { existing.get(pid).quantity = qty; }
        else if (product) {
          state.cotizacionItems.push({
            product_id: product.id, product_code: product.code || "",
            product_name: product.name, quantity: qty,
            units_per_bulto: product.units_per_bulto || 1,
            pack_unit: isPillCategory(product) ? "comprimido" : "unidad",
            unit_price: existingPrice != null ? existingPrice : (product.cost || null),
            current_cost: product.cost || 0,
            stock: product.stock != null ? product.stock : null,
          });
        }
      });
      // Eliminar los que no están en la selección
      state.cotizacionItems = state.cotizacionItems.filter(
        (it) => !it.product_id || state.cotPickerSelected.has(it.product_id)
      );
      renderCotizacionItems();
      if (els.pcotPickerModal) els.pcotPickerModal.hidden = true;
    });

    // Guardar cotización
    if (els.pcotSaveBtn) els.pcotSaveBtn.addEventListener("click", async () => {
      if (!state.cotizacionItems.length) {
        if (els.pcotCreateMsg) { els.pcotCreateMsg.textContent = "Agregá al menos 1 producto."; els.pcotCreateMsg.className = "config-msg err"; }
        return; // eslint-disable-line no-useless-return
      }
      if (els.pcotCreateMsg) { els.pcotCreateMsg.textContent = ""; els.pcotCreateMsg.className = "config-msg"; }
      const supplier_id = Number(els.pcotFormSupplier ? els.pcotFormSupplier.value : 0) || null;
      const status      = els.pcotFormStatus  ? els.pcotFormStatus.value  : "borrador";
      const notes       = els.pcotFormNotes   ? els.pcotFormNotes.value.trim() : "";
      const items = state.cotizacionItems.map((it) => ({
        product_id: it.product_id, product_code: it.product_code,
        product_name: it.product_name, quantity: it.quantity,
        unit_price: it.unit_price || null,
        pack_mode: it.pack_unit || null,
        comprimidos_per_unit: it.pack_unit === "comprimido" ? cotComprimidos(it) : null,
      }));
      const isEdit   = !!state.editingCotizacionId;
      const url      = isEdit ? "/api/admin/purchase-requests/" + state.editingCotizacionId : "/api/admin/purchase-requests";
      const method   = isEdit ? "PUT" : "POST";
      els.pcotSaveBtn.disabled = true;
      els.pcotSaveBtn.textContent = "Guardando…";
      try {
        const res = await api(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier_id, notes: notes || null, status, items }) });
        const updated = Object.assign({}, res.request, { items_count: items.length });
        if (isEdit) {
          const idx = state.cotizaciones.findIndex((c) => c.id === state.editingCotizacionId);
          if (idx >= 0) state.cotizaciones[idx] = updated; else state.cotizaciones.unshift(updated);
        } else {
          state.cotizaciones.unshift(updated);
        }
        state.cotizacionesLoaded = false;
        populatePcotSupFilter();
        renderCotizaciones();
        if (els.pcotCreateModal) els.pcotCreateModal.hidden = true;
        showToast("✅ Cotización " + (isEdit ? "actualizada" : "creada"));
      } catch (err) {
        if (els.pcotCreateMsg) { els.pcotCreateMsg.textContent = "Error: " + err.message; els.pcotCreateMsg.className = "config-msg err"; }
      } finally {
        els.pcotSaveBtn.disabled = false;
        els.pcotSaveBtn.textContent = "Guardar cotización";
      }
    });

    // Convertir en Compra
    if (els.pcotConvertBtn) {
      els.pcotConvertBtn.addEventListener("click", async () => {
        if (!state.cotizacionItems.length) return;
        // Guardar primero si hay cambios
        if (els.pcotCreateMsg) { els.pcotCreateMsg.textContent = ""; els.pcotCreateMsg.className = "config-msg"; }
        // Cerrar modal cotización y abrir modal de compra pre-rellenado
        if (els.pcotCreateModal) els.pcotCreateModal.hidden = true;
        // Esperar a que el modal de compra esté listo
        state.purchaseItems = state.cotizacionItems.map((it) => {
          const base = {
            product_id:   it.product_id,
            product_code: it.product_code,
            product_name: it.product_name,
            quantity:     it.quantity,
            unit_cost:    it.unit_price || 0,
            subtotal:     (it.unit_price || 0) * it.quantity,
          };
          // Si la cotización estaba en "por comprimido", arrancar la compra igual.
          if (it.pack_unit === "comprimido") {
            const cpt = cotComprimidos(it);
            base.pack_mode = "comprimido";
            base.cpt = cpt;
            base.comp_qty = Math.max(1, Math.round(it.quantity * cpt));
            base.comp_cost = Math.round((it.unit_price || 0) / cpt);
          } else if ((it.pack_unit === "caja" || it.pack_unit === "bulto")) {
            // Cotizada por caja/bulto: arrancar la compra en modo caja (solo si
            // la cantidad da cajas exactas, para no ensuciar los números).
            const upb = Math.max(1, Number(it.units_per_bulto) || 1);
            if (upb > 1 && it.quantity > 0 && it.quantity % upb === 0) {
              base.pack_mode = "caja";
              base.upb = upb;
              base.caja_qty = it.quantity / upb;
              base.caja_cost = Math.round((it.unit_price || 0) * upb);
            }
          }
          return base;
        });
        if (!state.suppliersLoaded) {
          try { state.suppliers = await api("/api/admin/suppliers"); state.suppliersLoaded = true; } catch (_) {}
        }
        populatePurchaseSupplierSelect();
        if (els.purchaseCreateForm) els.purchaseCreateForm.reset();
        if (els.purchaseCreateMsg) els.purchaseCreateMsg.textContent = "";
        // Pre-seleccionar proveedor
        const supId = els.pcotFormSupplier ? els.pcotFormSupplier.value : "";
        if (supId && els.purFormSupplier) els.purFormSupplier.value = supId;
        // Fecha default = ahora
        if (els.purchaseCreateForm) {
          const dtInput = els.purchaseCreateForm.querySelector('[name="received_at"]');
          if (dtInput) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            dtInput.value = now.toISOString().slice(0, 16);
          }
        }
        if (els.purchaseModalTitle) els.purchaseModalTitle.textContent = "Nueva compra (desde cotización)";
        renderPurchaseItems();
        if (els.purchaseCreateModal) els.purchaseCreateModal.hidden = false;
        showToast("Cotización convertida — revisá y guardá la compra");
      });
    }

    // Exportar cotización: genera el PDF en el server y lo comparte (o descarga).
    async function doExportCotizacion(porBultos) {
      if (els.pcotExportModal) els.pcotExportModal.hidden = true;
      const items = state.cotizacionItems;
      if (!items.length) { showToast("Sin productos para exportar", "err"); return; }
      const supRaw = els.pcotFormSupplier
        ? (els.pcotFormSupplier.options[els.pcotFormSupplier.selectedIndex] || {}).text || ""
        : "";
      const supName = (supRaw && supRaw !== "Sin proveedor") ? supRaw : "";
      const notas = els.pcotFormNotes ? els.pcotFormNotes.value.trim() : "";
      const payloadItems = items.map((it) => ({
        product_code: it.product_code || "",
        product_name: it.product_name || "",
        quantity: it.quantity,
        units_per_bulto: it.units_per_bulto || 1,
        pack_unit: it.pack_unit || "bulto",
        comprimidos_per_unit: it.pack_unit === "comprimido" ? cotComprimidos(it) : null,
      }));
      showToast("Generando PDF…");
      try {
        const resp = await fetch("/api/admin/cotizacion/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplier_name: supName, notes: notas, porBultos, items: payloadItems }),
        });
        if (resp.status === 401) { location.href = "/login"; return; }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || "Error " + resp.status);
        }
        const blob = await resp.blob();
        const dateSlug = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "-");
        const fileName = "Cotizacion " + (supName || "") + " " + dateSlug + ".pdf";
        await sharePdfBlob(blob, fileName.replace(/\s+/g, " ").trim());
      } catch (err) {
        if (err.name !== "AbortError") showToast("No se pudo exportar: " + err.message, "err");
      }
    }

    if (els.pcotExportBtn) els.pcotExportBtn.addEventListener("click", () => {
      if (!state.cotizacionItems.length) { showToast("Sin productos para exportar", "err"); return; }
      if (els.pcotExportModal) els.pcotExportModal.hidden = false;
    });
    if (els.pcotExportUnitsBtn)  els.pcotExportUnitsBtn.addEventListener("click",  () => doExportCotizacion(false));
    if (els.pcotExportBultosBtn) els.pcotExportBultosBtn.addEventListener("click", () => doExportCotizacion(true));
    if (els.pcotExportCancelBtn) els.pcotExportCancelBtn.addEventListener("click", () => {
      if (els.pcotExportModal) els.pcotExportModal.hidden = true;
    });

    // Filtros
    if (els.pcotSupFilter)    els.pcotSupFilter.addEventListener("change",    renderCotizaciones);
    if (els.pcotStatusFilter) els.pcotStatusFilter.addEventListener("change", renderCotizaciones);
  }

  initCotizacionesListeners();

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
      list = list.filter((p) => matchWords((p.client_username || "") + " " + (p.client_full_name || "") + " " + (p.reference || ""), q));
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
        if (!await confirmModal({ message: "Eliminar el pago de " + fmtPrice(amount) + " de " + client + "?\nEsto también eliminará el movimiento de cuenta corriente.", confirmText: "Eliminar", danger: true })) return;
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
      '<td>' + escapeHtml(p.method || "") + (p.caja_name ? ' <span class="muted small">→ ' + escapeHtml(p.caja_name) + '</span>' : '') + (p.order_id ? ' <span class="muted small">· pedido #' + p.order_id + '</span>' : '') + '</td>' +
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
      state.payForOrder = null; // pago general (no imputado a un pedido)
      if (els.paymentCreateForm) els.paymentCreateForm.reset();
      if (els.paymentCreateMsg) els.paymentCreateMsg.textContent = "";
      if (els.payFormClient) els.payFormClient.disabled = false;
      await populatePayFormClients();
      fillCajaSelect(document.getElementById("pay-form-caja"), null);
      setupPayDiscountUI(null); // pago general: sin descuento de pedido
      if (els.paymentCreateModal) els.paymentCreateModal.hidden = false;
      setTimeout(() => { if (els.payFormClient) els.payFormClient.focus(); }, 50);
    });
  }

  if (els.paymentCreateForm) {
    attachMoneyInput(els.paymentCreateForm.querySelector('[name="amount"]'));
    // Descuento: habilitar/deshabilitar el valor y refrescar el hint en vivo.
    if (els.payFormDiscountType) els.payFormDiscountType.addEventListener("change", syncPayDiscountUI);
    if (els.payFormDiscountValue) els.payFormDiscountValue.addEventListener("input", syncPayDiscountUI);
    // Reparto tuyo/vendedor en vivo al tipear el monto.
    var payAmtInput = els.paymentCreateForm.querySelector('[name="amount"]');
    if (payAmtInput) payAmtInput.addEventListener("input", renderPaySplit);
    els.paymentCreateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Guard anti doble-clic: si ya hay un guardado en curso, ignorar.
      const submitBtn = els.paymentCreateForm.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.disabled) return;
      const fd = new FormData(els.paymentCreateForm);
      // Si el select de cliente está deshabilitado (cobro de un pedido), no viaja
      // en el FormData: tomamos el cliente del pedido / del valor del select.
      const payOrder = state.payForOrder;
      const clientId = Number(fd.get("user_id")) || (els.payFormClient ? Number(els.payFormClient.value) : 0);
      const body = {
        user_id: clientId,
        amount: parseMoney(fd.get("amount")),
        method: fd.get("method"),
        caja_id: fd.get("caja_id") || null,
        reference: fd.get("reference"),
        notes: fd.get("notes"),
        order_id: payOrder ? payOrder.id : null,
      };
      // Descuento / comisión: solo cuando el cobro es de un pedido.
      if (payOrder) {
        const dType = fd.get("discount_type") || "";
        const dValue = Number(fd.get("discount_value")) || 0;
        if ((dType === "percent" || dType === "fixed") && dValue > 0) {
          body.discount_type = dType;
          body.discount_value = dValue;
        }
      }
      if (!body.user_id || !body.amount) {
        if (els.paymentCreateMsg) { els.paymentCreateMsg.textContent = "Completá cliente y monto."; els.paymentCreateMsg.className = "config-msg err"; }
        return;
      }
      if (els.paymentCreateMsg) { els.paymentCreateMsg.textContent = "Guardando…"; els.paymentCreateMsg.className = "config-msg"; }
      if (submitBtn) submitBtn.disabled = true;
      try {
        const out = await api("/api/admin/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        state.payments.unshift(out.payment);
        renderPayments();
        if (els.paymentCreateModal) els.paymentCreateModal.hidden = true;
        if (els.payFormClient) els.payFormClient.disabled = false;
        // Refrescar cuentas si estaban cargadas
        if (state.accountsLoaded) { state.accountsLoaded = false; loadAccounts(); }
        // Si fue un cobro imputado a un pedido, refrescar el detalle del pedido y
        // las vistas de pedidos/ventas para que el badge "Debe/Saldado" se actualice.
        if (payOrder) {
          state.ordersLoaded = false;
          // Refetch /api/orders (trae amount_paid actualizado) y re-render de todas
          // las vistas de pedidos + Ventas, para que el badge "Debe/Saldado" cambie.
          try { await loadOrders(); } catch (_) {}
          if (typeof refreshOrderViews === "function") refreshOrderViews();
          const dEl = payOrder.detailEl;
          if (dEl && !dEl.hidden) {
            try {
              const fresh = await api("/api/orders/" + payOrder.id);
              dEl.dataset.loaded = "1";
              renderOrderDetail(dEl, fresh);
              wireOrderDetail(dEl, fresh);
            } catch (_) {}
          }
          state.payForOrder = null;
        }
        showToast("Pago registrado: " + fmtPrice(out.payment.amount));
      } catch (err) {
        if (els.paymentCreateMsg) { els.paymentCreateMsg.textContent = err.message; els.paymentCreateMsg.className = "config-msg err"; }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
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
    if (els.expTbody) els.expTbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
    try {
      const data = await api(url);
      expState.rows = data.rows || [];
      expState.byCategory = data.by_category || [];
      expState.total = data.total || 0;
      renderExpenses();
    } catch (e) {
      if (els.expTbody) els.expTbody.innerHTML = '<tr><td colspan="8" class="muted">Error cargando gastos</td></tr>';
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
      els.expTbody.innerHTML = '<tr><td colspan="8" class="muted">No hay gastos en el período. Registrá uno con el botón "+ Registrar gasto".</td></tr>';
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
        '<td class="muted small">' + (e.caja_name ? "💰 " + escapeHtml(e.caja_name) : '<span class="muted">—</span>') + '</td>' +
        '<td class="muted small">' + escapeHtml(e.reference || "") + '</td>' +
        '<td class="num"><strong>' + fmtMoney(e.amount) + '</strong></td>' +
        '<td>' +
          '<button class="btn btn-small" data-act="exp-edit" data-id="' + e.id + '" type="button">Editar</button> ' +
          '<button class="btn btn-small btn-danger" data-act="exp-del" data-id="' + e.id + '" type="button">Borrar</button>' +
        '</td>' +
      '</tr>';
    }).join("");
    if (els.expTfoot) {
      els.expTfoot.innerHTML = '<tr><th colspan="6">Total</th>' +
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
        setMoney(form.amount, existing.amount);
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
      // El gasto sale siempre de una caja (obligatorio). En edición se
      // preselecciona la caja actual del gasto.
      fillCajaSelect(form.caja_id, existing && existing.caja_id, "— Elegí una caja —");
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
        if (!await confirmModal({ message: "¿Borrar este gasto? Esta acción no se puede deshacer.", confirmText: "Borrar", danger: true })) return;
        try {
          await api("/api/admin/expenses/" + id, { method: "DELETE" });
          await loadExpenses();
        } catch (err) {
          alertModal("Error al borrar: " + err.message);
        }
      }
    });
  }

  if (els.expCreateForm) {
    attachMoneyInput(els.expCreateForm.querySelector('[name="amount"]'));
    els.expCreateForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const form = els.expCreateForm;
      const id = form.id.value ? Number(form.id.value) : null;
      const body = {
        expense_date: form.expense_date.value,
        amount: parseMoney(form.amount.value),
        expense_category_id: form.expense_category_id.value ? Number(form.expense_category_id.value) : null,
        description: form.description.value.trim(),
        payment_method: form.payment_method.value,
        reference: form.reference.value.trim(),
        notes: form.notes.value.trim(),
        caja_id: form.caja_id.value ? Number(form.caja_id.value) : null,
      };
      if (!body.amount || body.amount <= 0) {
        if (els.expCreateMsg) { els.expCreateMsg.textContent = "Monto invalido"; els.expCreateMsg.className = "config-msg err"; }
        return;
      }
      if (!body.caja_id) {
        if (els.expCreateMsg) { els.expCreateMsg.textContent = "Elegí la caja de la que sale el gasto"; els.expCreateMsg.className = "config-msg err"; }
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
        alertModal("Error: " + err.message);
        await loadExpenseCategories();
        renderExpenseCategoriesAdmin();
      }
    });
    // Borrar
    els.expCatsTbody.addEventListener("click", async (ev) => {
      const btn = ev.target.closest('[data-cat-act="del"]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!await confirmModal({ message: "¿Borrar esta categoría?", confirmText: "Borrar", danger: true })) return;
      try {
        await api("/api/admin/expense-categories/" + id, { method: "DELETE" });
        await loadExpenseCategories();
        renderExpenseCategoriesAdmin();
      } catch (err) {
        alertModal("Error: " + err.message);
      }
    });
  }

  // ========== CUENTAS CORRIENTES ==========

  async function loadAccounts() {
    try {
      if (els.accTbody) els.accTbody.innerHTML = '<tr><td colspan="7" class="muted">Cargando…</td></tr>';
      state.accounts = await api("/api/admin/accounts");
      state.accountsLoaded = true;
      renderAccounts();
    } catch (e) {
      if (els.accTbody) els.accTbody.innerHTML = '<tr><td colspan="7" class="muted">Error cargando cuentas</td></tr>';
    }
  }

  function accAgingBucket(days) {
    if (days == null) return { label: "—", cls: "" };
    if (days <= 7) return { label: days + " d", cls: "acc-age-ok" };
    if (days <= 30) return { label: days + " d", cls: "acc-age-warn" };
    return { label: days + " d", cls: "acc-age-bad" };
  }

  function renderAccountsKpis() {
    if (!els.accKpis) return;
    const all = state.accounts;
    let totalDebt = 0, totalFavor = 0, debtors = 0, oldestDays = 0;
    all.forEach((a) => {
      const b = Number(a.balance) || 0;
      if (b < 0) { totalDebt += -b; debtors++; if (a.days_overdue != null && a.days_overdue > oldestDays) oldestDays = a.days_overdue; }
      else if (b > 0) { totalFavor += b; }
    });
    const avgDebt = debtors ? Math.round(totalDebt / debtors) : 0;
    const card = (cls, label, value, sub) =>
      '<div class="dash-kpi ' + cls + '"><div class="dash-kpi-label">' + label + '</div>' +
      '<div class="dash-kpi-value">' + value + '</div>' +
      (sub ? '<div class="dash-kpi-sub">' + sub + '</div>' : '') + '</div>';
    els.accKpis.innerHTML =
      card("dash-kpi-danger", "Total adeudado", fmtPrice(totalDebt), debtors + (debtors === 1 ? " deudor" : " deudores")) +
      card("dash-kpi-good", "Total a favor", fmtPrice(totalFavor), "saldos a favor de clientes") +
      card("dash-kpi-warn", "Deuda promedio", fmtPrice(avgDebt), "por cliente deudor") +
      card("dash-kpi-accent", "Deuda más antigua", (oldestDays ? oldestDays + " días" : "—"), "sin saldar");
  }

  function accSortedFiltered() {
    const q = (els.accSearch ? els.accSearch.value : "").trim().toLowerCase();
    let list = state.accounts.slice();
    if (q) {
      list = list.filter((a) => matchWords((a.username || "") + " " + (a.full_name || ""), q));
    }
    if (state.accOnlyDebtors) list = list.filter((a) => (Number(a.balance) || 0) < 0);
    const key = state.accSortKey, dir = state.accSortDir === "desc" ? -1 : 1;
    list.sort((a, b) => {
      let av, bv;
      if (key === "name") { av = (a.full_name || a.username || "").toLowerCase(); bv = (b.full_name || b.username || "").toLowerCase(); return av < bv ? -dir : av > bv ? dir : 0; }
      if (key === "debit") { av = a.total_debit; bv = b.total_debit; }
      else if (key === "credit") { av = a.total_credit; bv = b.total_credit; }
      else if (key === "aging") { av = a.days_overdue == null ? -1 : a.days_overdue; bv = b.days_overdue == null ? -1 : b.days_overdue; }
      else { av = a.balance; bv = b.balance; } // balance: asc = más deuda primero (más negativo)
      return (av - bv) * dir;
    });
    return list;
  }

  function updateAccSortHeaders() {
    if (!els.accTable) return;
    els.accTable.querySelectorAll("th.acc-sort").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sort === state.accSortKey) th.classList.add(state.accSortDir === "desc" ? "sort-desc" : "sort-asc");
    });
  }

  function renderAccounts() {
    if (!els.accTbody) return;
    renderAccountsKpis();
    updateAccSortHeaders();
    const list = accSortedFiltered();
    if (els.accCount) els.accCount.textContent = list.length + (list.length === 1 ? " cliente" : " clientes");
    if (!list.length) {
      els.accTbody.innerHTML = '<tr><td colspan="7" class="muted">Sin clientes.</td></tr>';
      return;
    }
    els.accTbody.innerHTML = list.map(accountRowHtml).join("");
    els.accTbody.querySelectorAll("tr.acc-row").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".acc-pay-btn") || e.target.closest(".acc-limit-cell")) return;
        toggleAccountDetail(tr);
      });
    });
    els.accTbody.querySelectorAll(".acc-pay-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openPaymentForAccount(Number(btn.dataset.id));
      });
    });
    // Auto-save del limite de credito al perder foco o pulsar Enter/Tab
    els.accTbody.querySelectorAll(".acc-limit-input").forEach((inp) => {
      async function saveCreditLimit() {
        const userId = Number(inp.dataset.userId);
        const val = Math.max(0, Math.round(Number(inp.value) || 0));
        inp.value = val;
        try {
          await api("/api/admin/users/" + userId, { method: "PATCH", body: JSON.stringify({ credit_limit: val }) });
          // Actualizar el dato en state.accounts para que el re-render sea correcto
          const acc = state.accounts.find((x) => x.id === userId);
          if (acc) acc.credit_limit = val;
          // Reflejar la alerta de límite en la fila sin re-renderizar toda la tabla
          const row = inp.closest("tr.acc-row");
          const acc2 = state.accounts.find((x) => x.id === userId);
          const over = acc2 && Number(acc2.balance) < 0 && val > 0 && Math.abs(Number(acc2.balance)) > val;
          if (row) row.classList.toggle("acc-row-over-limit", !!over);
          showToast("Límite actualizado");
        } catch (err) { showToast("Error: " + err.message, true); }
      }
      inp.addEventListener("change", saveCreditLimit);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
    });
  }

  function accountRowHtml(a) {
    const balance = Number(a.balance) || 0;
    const debt = balance < 0;
    const limit = Number(a.credit_limit) || 0;
    const overLimit = debt && limit > 0 && Math.abs(balance) > limit;
    const balanceClass = balance >= 0 ? "acc-balance-pos" : (overLimit ? "acc-balance-over" : "acc-balance-neg");
    const balanceLabel = balance >= 0 ? "A favor: " + fmtPrice(balance) : "Debe: " + fmtPrice(Math.abs(balance));
    const overIcon = overLimit ? ' <span class="acc-limit-over-icon" title="Deuda supera el límite de crédito ($ ' + limit.toLocaleString("es-AR") + ')">⚠️</span>' : "";
    const aging = debt ? accAgingBucket(a.days_overdue) : { label: "—", cls: "" };
    const agingTitle = debt && a.oldest_unpaid_at ? ' title="Deuda más vieja sin saldar: ' + escapeHtml(formatDate(a.oldest_unpaid_at)) + '"' : "";
    return '<tr class="acc-row' + (debt ? ' acc-row-debt' : '') + (overLimit ? ' acc-row-over-limit' : '') + '" data-id="' + a.id + '" style="cursor:pointer">' +
      '<td>' + escapeHtml(a.full_name || a.username || "") + ' <span class="muted small">@' + escapeHtml(a.username || "") + '</span></td>' +
      '<td class="muted">' + escapeHtml(LEVEL_NAMES[a.level] || String(a.level)) + '</td>' +
      '<td class="num muted">' + fmtPrice(a.total_debit) + '</td>' +
      '<td class="num muted">' + fmtPrice(a.total_credit) + '</td>' +
      '<td class="num"><span class="acc-balance-badge ' + balanceClass + '">' + balanceLabel + '</span>' + overIcon + '</td>' +
      '<td class="num"' + agingTitle + '><span class="acc-age ' + aging.cls + '">' + aging.label + '</span></td>' +
      '<td class="num acc-limit-cell" style="min-width:100px">' +
        '<input type="number" class="acc-limit-input" data-user-id="' + a.id + '" value="' + limit + '" min="0" step="1000" title="Límite de crédito (0 = sin límite). Tab para guardar." />' +
      '</td>' +
      '<td class="acc-actions">' + (debt
        ? '<button type="button" class="btn-mini acc-pay-btn" data-id="' + a.id + '">💵 Cobrar</button>'
        : '<button type="button" class="btn-mini acc-pay-btn" data-id="' + a.id + '">Registrar pago</button>') + '</td>' +
    '</tr>' +
    '<tr class="acc-detail-row" data-for="' + a.id + '" hidden>' +
      '<td colspan="8" class="acc-detail-cell"><span class="muted">Cargando historial…</span></td>' +
    '</tr>';
  }

  function openPaymentForAccount(userId) {
    state.payForOrder = null; // pago general a la cuenta, no a un pedido puntual
    const a = state.accounts.find((x) => x.id === userId);
    if (els.paymentCreateForm) els.paymentCreateForm.reset();
    if (els.payFormClient) els.payFormClient.disabled = false;
    if (els.paymentCreateMsg) els.paymentCreateMsg.textContent = "";
    populatePayFormClients().then(() => {
      if (els.payFormClient) els.payFormClient.value = String(userId);
      // Pre-cargar el monto adeudado si lo hay
      const amtInput = els.paymentCreateForm ? els.paymentCreateForm.querySelector('[name="amount"]') : null;
      attachMoneyInput(amtInput);
      if (amtInput && a && Number(a.balance) < 0) setMoney(amtInput, Math.abs(Number(a.balance)));
    });
    fillCajaSelect(document.getElementById("pay-form-caja"), null);
    setupPayDiscountUI(null); // cobro general a la cuenta: sin descuento de pedido
    if (els.paymentCreateModal) els.paymentCreateModal.hidden = false;
  }

  // Cobro imputado a un pedido puntual. Reusa el modal de pago, precargando
  // cliente y monto adeudado, y marca state.payForOrder para que el submit lo
  // vincule (order_id) y refresque el detalle/las vistas de pedidos al guardar.
  // Muestra/oculta y resetea el bloque de descuento del modal de cobro.
  // orderTotal: total del pedido (para calcular el hint del %); null = ocultar.
  function setupPayDiscountUI(orderTotal) {
    if (!els.payFormDiscount) return;
    var show = orderTotal != null;
    els.payFormDiscount.hidden = !show;
    if (els.payFormDiscountType) els.payFormDiscountType.value = "";
    if (els.payFormDiscountValue) { els.payFormDiscountValue.value = ""; els.payFormDiscountValue.disabled = true; }
    els.payFormDiscount.dataset.orderTotal = show ? String(orderTotal) : "";
    // Ocultar el split por defecto; openPaymentForOrder lo vuelve a mostrar si hay comisión.
    if (els.payFormSplit) { els.payFormSplit.hidden = true; els.payFormSplit.innerHTML = ""; }
    syncPayDiscountUI();
  }

  // Habilita el input de valor según el tipo elegido y actualiza el hint con el
  // monto en pesos que se va a descontar (siempre sobre el total del pedido).
  function syncPayDiscountUI() {
    if (!els.payFormDiscountType || !els.payFormDiscountValue) return;
    var type = els.payFormDiscountType.value;
    els.payFormDiscountValue.disabled = !type;
    if (!type && els.payFormDiscountHint) { els.payFormDiscountHint.textContent = ""; return; }
    var total = Number(els.payFormDiscount && els.payFormDiscount.dataset.orderTotal) || 0;
    var val = Math.max(0, Number(els.payFormDiscountValue.value) || 0);
    var amount = type === "percent"
      ? Math.round(total * Math.min(val, 100) / 100)
      : Math.round(val);
    amount = Math.max(0, Math.min(amount, total));
    if (els.payFormDiscountHint) {
      els.payFormDiscountHint.textContent = val > 0
        ? "Se descontarán " + fmtPrice(amount) + " del saldo del pedido."
        : "";
    }
  }

  // Reparto del cobro actual entre vos y el vendedor ("primero lo tuyo").
  // Devuelve null si el pedido no tiene comisión de vendedor.
  function paySplit() {
    var po = state.payForOrder;
    if (!po || !(po.commission > 0)) return null;
    var C = po.commission;
    var loTuyo = Math.max(0, (po.total || 0) - C);
    var other = po.cash_other || 0;
    var amtEl = els.paymentCreateForm ? els.paymentCreateForm.querySelector('[name="amount"]') : null;
    var thisCobro = amtEl ? Math.max(0, parseMoney(amtEl.value)) : 0;
    var clamp = function(x) { return Math.max(0, Math.min(x, C)); };
    var commBefore = clamp(Math.round(other - loTuyo));
    var commAfter = clamp(Math.round(other + thisCobro - loTuyo));
    var vendorPart = commAfter - commBefore;
    var yourPart = Math.max(0, thisCobro - vendorPart);
    return { commission: C, vendor_name: po.vendor_name, vendorPart: vendorPart, yourPart: yourPart, cobrado: thisCobro };
  }
  function renderPaySplit() {
    if (!els.payFormSplit) return;
    var sp = paySplit();
    if (!sp || sp.cobrado <= 0) { els.payFormSplit.hidden = true; els.payFormSplit.innerHTML = ""; return; }
    var vname = sp.vendor_name ? " (" + escapeHtml(sp.vendor_name) + ")" : "";
    els.payFormSplit.hidden = false;
    els.payFormSplit.innerHTML =
      'De este cobro → 🧑‍💼 Vendedor' + vname + ': <strong>' + fmtPrice(sp.vendorPart) + '</strong> · ' +
      '🏦 A tu caja: <strong>' + fmtPrice(sp.yourPart) + '</strong>' +
      ' <span class="muted">(comisión total ' + fmtPrice(sp.commission) + ')</span>';
  }

  function openPaymentForOrder(order, detailEl) {
    var pf = order.profitability || {};
    state.payForOrder = {
      id: order.id, detailEl: detailEl || null, total: Number(order.total) || 0,
      commission: Number(pf.vendor && pf.vendor.earning) || 0,
      vendor_name: (pf.vendor && pf.vendor.name) || "",
      cash_other: Number(order.cash_collected) || 0,
    };
    if (els.paymentCreateForm) els.paymentCreateForm.reset();
    if (els.paymentCreateMsg) {
      els.paymentCreateMsg.textContent = "Cobro del pedido #" + order.id +
        " — " + (order.full_name || order.username || "");
      els.paymentCreateMsg.className = "config-msg";
    }
    populatePayFormClients().then(function() {
      if (els.payFormClient) {
        els.payFormClient.value = String(order.user_id);
        els.payFormClient.disabled = true; // el cobro es de este cliente
      }
      var amtInput = els.paymentCreateForm ? els.paymentCreateForm.querySelector('[name="amount"]') : null;
      attachMoneyInput(amtInput);
      // Mismo saldo que muestra el detalle / la lista de Ventas (ventaCobro).
      var due = ventaCobro(Object.assign({}, order, {
        debit_total: (Number(order.balance_due) || 0) + (Number(order.amount_paid) || 0)
      })).falta;
      if (amtInput && due > 0) setMoney(amtInput, due);
    });
    fillCajaSelect(document.getElementById("pay-form-caja"), null);
    setupPayDiscountUI(Number(order.total) || 0);
    renderPaySplit();
    if (els.paymentCreateModal) els.paymentCreateModal.hidden = false;
  }

  function exportAccountsCsv() {
    const list = accSortedFiltered();
    const rows = [["Cliente", "Usuario", "Nivel", "Debitos", "Creditos", "Saldo", "Estado", "Limite credito", "Sobre limite", "Dias antiguedad", "Ultimo movimiento"]];
    list.forEach((a) => {
      const b = Number(a.balance) || 0;
      const lim = Number(a.credit_limit) || 0;
      rows.push([
        a.full_name || "", "@" + (a.username || ""), LEVEL_NAMES[a.level] || String(a.level),
        a.total_debit, a.total_credit, b,
        b < 0 ? "Debe" : (b > 0 ? "A favor" : "Saldado"),
        lim || "",
        (b < 0 && lim > 0 && Math.abs(b) > lim) ? "SI" : "",
        b < 0 && a.days_overdue != null ? a.days_overdue : "",
        a.last_movement_at ? formatDate(a.last_movement_at) : "",
      ]);
    });
    const csv = "﻿" + rows.map((r) => r.map((c) => {
      const s = String(c == null ? "" : c);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cuentas_corrientes_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

      cell.innerHTML =
        '<div class="acc-detail-actions">' +
          '<a class="btn btn-small btn-ghost acc-pdf-btn" href="/api/admin/accounts/' + id + '/pdf" target="_blank" download>📄 Estado de cuenta PDF</a>' +
        '</div>' +
        '<table class="acc-mov-table"><thead><tr>' +
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
  if (els.accOnlyDebtors) {
    els.accOnlyDebtors.addEventListener("change", () => {
      state.accOnlyDebtors = els.accOnlyDebtors.checked;
      renderAccounts();
    });
  }
  if (els.accExportBtn) els.accExportBtn.addEventListener("click", exportAccountsCsv);
  if (els.accTable) {
    els.accTable.querySelectorAll("th.acc-sort").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.accSortKey === key) {
          state.accSortDir = state.accSortDir === "asc" ? "desc" : "asc";
        } else {
          state.accSortKey = key;
          // Default util: nombre asc, montos/antigüedad desc (mayor primero), saldo asc (más deuda primero)
          state.accSortDir = (key === "name" || key === "balance") ? "asc" : "desc";
        }
        renderAccounts();
      });
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

    // Poblar categorías (checkboxes). Se refresca SIEMPRE el cache: el flag
    // "active" (visibilidad global, Configuración) pudo cambiar en esta sesión.
    try { state.allCategories = await api("/api/categories"); } catch (_) {}
    if (els.catalogCatsLoading) els.catalogCatsLoading.remove();
    els.catalogCatsWrap.innerHTML = "";
    state.allCategories.forEach((c) => {
      // Categorías ocultas del catálogo (active=0): destildadas por default.
      // El admin puede tildarlas a mano (o con "Todas") si las quiere incluir.
      const isActive = Number(c.active) !== 0;
      const lbl = document.createElement("label");
      lbl.className = "cats-check";
      lbl.title = isActive ? c.name : c.name + " — oculta del catálogo (Configuración)";
      lbl.innerHTML =
        '<input type="checkbox" data-cat-id="' + c.id + '"' + (isActive ? " checked" : "") + '>' +
        '<span class="cats-check-lbl">' + escapeHtml(c.name) + (isActive ? "" : ' <span class="np-note">(oculta)</span>') + '</span>';
      els.catalogCatsWrap.appendChild(lbl);
    });

    // Poblar select de cliente (clientes activos level 1-4). Si se elige uno,
    // el catálogo usa su lista de precios efectiva automáticamente.
    if (els.catalogClientSelect) {
      const allUsers = state.usersLoaded && state.users.length
        ? state.users
        : await api("/api/admin/users").catch(() => []);
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
  // tiene permitidas (user_category_access), intersectadas con la visibilidad
  // global (las ocultas en Configuración quedan destildadas igual, como en el
  // catálogo real del cliente). Sin cliente = el default global (activas).
  async function applyCatalogClientCategories(clientId) {
    const boxes = els.catalogCatsWrap.querySelectorAll("input[type=checkbox]");
    const activeIds = new Set(
      (state.allCategories || []).filter((c) => Number(c.active) !== 0).map((c) => c.id)
    );
    if (!clientId) { boxes.forEach((b) => { b.checked = activeIds.has(Number(b.dataset.catId)); }); return; }
    try {
      const data = await api("/api/admin/users/" + clientId + "/categories");
      const allowed = new Set((data.categories || []).filter((c) => c.allowed).map((c) => c.id));
      boxes.forEach((b) => {
        const id = Number(b.dataset.catId);
        b.checked = allowed.has(id) && activeIds.has(id);
      });
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
    // Arma el body desde el form y pide el PDF al server. Devuelve el blob
    // (lanza en error). No toca la UI — la usan tanto descargar como compartir.
    async function fetchCatalogPdfBlob() {
      // priceConfig: si hay cliente elegido, el server resuelve su lista
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
      const includePriceChanges = els.catalogIncludeChanges ? els.catalogIncludeChanges.checked : false;
      const withImages = els.catalogWithImages ? els.catalogWithImages.checked : true;
      const response = await fetch("/api/admin/catalog/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceConfig, categoryIds, includePriceChanges, withImages }),
      });
      if (response.status === 401) { location.href = "/login"; throw new Error("Sesión expirada"); }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Error " + response.status);
      }
      return await response.blob();
    }

    const catalogFileName = () => "catalogo-" + new Date().toISOString().slice(0, 10) + ".pdf";

    // Corre la generación con feedback en el botón y pasa el blob a onBlob.
    async function runCatalogPdf(btn, busyLabel, idleLabel, onBlob) {
      els.catalogMsg.textContent = "";
      els.catalogMsg.className = "config-msg";
      btn.disabled = true;
      btn.textContent = busyLabel;
      try {
        const blob = await fetchCatalogPdfBlob();
        await onBlob(blob);
        els.catalogModal.hidden = true;
      } catch (err) {
        if (err.name !== "AbortError") {
          els.catalogMsg.textContent = "Error: " + err.message;
          els.catalogMsg.className = "config-msg err";
        }
      } finally {
        btn.disabled = false;
        btn.textContent = idleLabel;
      }
    }

    els.catalogForm.addEventListener("submit", (e) => {
      e.preventDefault();
      runCatalogPdf(els.catalogGenerateBtn, "Generando…", "📄 Exportar PDF", (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = catalogFileName();
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
        showToast("✅ PDF exportado y descargado");
      });
    });

    if (els.catalogShareBtn) {
      els.catalogShareBtn.addEventListener("click", () => {
        runCatalogPdf(els.catalogShareBtn, "…", "📤 Compartir", (blob) => sharePdfBlob(blob, catalogFileName()));
      });
    }
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
          '<input type="number" value="' + escapeHtml(it.unit_price) + '" min="0" step="0.01"' +
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
    if (q) list = list.filter((b) => matchWords((b.number || "") + " " + (b.client_name || "") + " " + (b.vendedor_name || ""), q));
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

  // (La pestaña Ventas ya no lista presupuestos facturados; ahora lista pedidos
  //  ENTREGADOS vía renderVentasOrders, junto al resto del circuito de pedidos.)

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
      if (!await confirmModal({ message: "Al cancelar el presupuesto, los productos vuelven al stock.\n\n¿Confirmás la cancelación?", confirmText: "Cancelar presupuesto", cancelText: "Volver", danger: true })) return;
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
      if (!await confirmModal({
        message: "¿Facturar este presupuesto?\n\nSe va a descontar el stock de los artículos" +
          (bState.items.some(() => true) ? " y, si hay un cliente con cuenta corriente, se le debitará el total." : "."),
        confirmText: "Facturar",
      })) return;
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

  // (El buscador de la pestaña Ventas se cablea junto a renderVentasOrders;
  //  la pestaña ahora lista pedidos ENTREGADOS, no presupuestos facturados.)

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
        "th,td{padding:6px 8px;border-bottom:1px solid #1e3a5f;text-align:left}" +
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
      list = list.filter((p) => matchWords((p.name || "") + " " + (p.code || "") + " " + (p.category_name || ""), q));
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
    // Monto que va sumando el presupuesto con lo tildado (1 unidad × precio minorista).
    let sum = 0;
    bState.pickerSelected.forEach((pid) => {
      const p = bState.allProducts.find((x) => x.id === pid);
      if (p) sum += Number(p.price_minorista) || 0;
    });
    bEls.pickerCount.textContent = n + (n === 1 ? " seleccionado" : " seleccionados") + (n ? " · " + fmtPrice(sum) : "");
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
  // Formatea un precio: entero → "$ 1.000"; con centavos → "$ 1.000,50".
  // ÚNICA definición del archivo (había una segunda en los helpers de arriba
  // que el hoisting dejaba muerta). Antes redondeaba SIEMPRE a entero: abrir
  // el modal de un producto con precio 3.649,50 mostraba "$ 3.650" y guardar
  // persistía 3650 (pérdida silenciosa de centavos).
  function fmtPrice(n) {
    n = Number(n) || 0;
    if (Math.abs(n - Math.round(n)) >= 0.005) {
      return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    n = Math.round(n) || 0;
    return "$ " + n.toLocaleString("es-AR");
  }
  // Parsea "$1.000,00" o "1000" → entero
  // Parsea un precio que puede venir en DOS formatos:
  //  - argentino formateado: "$3.649,50" (punto = miles, coma = decimal)
  //  - número crudo de un input type=number: "3649.5" (punto = decimal)
  // Soporta 2 decimales (centavos).
  function parsePrice(s) {
    if (!s && s !== 0) return 0;
    let str = String(s).replace(/\$\s*/g, "").trim();
    if (str === "") return 0;
    if (str.indexOf(",") >= 0) {
      // Formato argentino: la coma es el decimal, los puntos son miles.
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Sin coma: punto ambiguo. Varios puntos => miles. Un punto seguido de
      // exactamente 3 dígitos => miles ("3.649"); 1-2 dígitos => decimal ("3649.5").
      const dots = (str.match(/\./g) || []).length;
      if (dots > 1) str = str.replace(/\./g, "");
      else if (dots === 1 && (str.split(".")[1] || "").length === 3) str = str.replace(/\./g, "");
    }
    return round2(parseFloat(str)) || 0;
  }
  // ── Montos en pesos (enteros) con separador de miles es-AR ──
  // Para inputs de dinero: pagos, gastos, cobros, movimientos de caja.
  // Formatea EN VIVO mientras se tipea ("1000" → "1.000", "1000000" → "1.000.000").
  function fmtMiles(n) { return (Math.round(Number(n) || 0)).toLocaleString("es-AR"); }
  // Lee un input/valor formateado y devuelve el entero (descarta todo lo que no sea dígito).
  // Los precios son enteros: si el valor trae decimales ("1.500,50" pegado, o
  // "1500.50"), se descartan. Antes se limpiaba TODO junto y "1.500,50" se
  // convertía en 150050 (×100 silencioso). Regla: un grupo final de 1-2 dígitos
  // tras coma o punto es decimal (el punto de miles es-AR siempre agrupa de a 3).
  function parseMoney(s) {
    var str = String(s == null ? "" : s).trim();
    var m = str.match(/^(.*?)[.,](\d{1,2})$/);
    if (m) str = m[1];
    return Math.round(Number(str.replace(/[^\d]/g, "")) || 0);
  }
  // Setea un input de dinero con el valor ya formateado (0 → "0").
  function setMoney(el, n) { if (el) el.value = fmtMiles(n); }
  // Convierte un <input type="number"> en uno de texto que se formatea solo al tipear.
  function attachMoneyInput(el) {
    if (!el || el._moneyFmt) return;
    el._moneyFmt = true;
    el.type = "text";
    el.setAttribute("inputmode", "numeric");
    el.autocomplete = "off";
    const reformat = () => {
      const digits = el.value.replace(/[^\d]/g, "");
      el.value = digits ? Number(digits).toLocaleString("es-AR") : "";
    };
    el.addEventListener("input", reformat);
    reformat(); // formato inicial (por si trae value)
  }

  // Attacha focus/blur a un input de precio para formatear/deformatear
  function attachPriceFmt(el) {
    if (!el) return;
    el.addEventListener("focus", () => {
      const raw = parsePrice(el.value);
      el.value = raw || "";
      el.type = "number";
      el.step = "0.01"; // permitir centavos al editar
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
  const epDeleteBtn     = document.getElementById("ep-delete-btn");
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

  // round2 (no Math.round): el costo admite centavos, igual que en el server.
  function epGetCost() { return round2(Number(epCostInp ? epCostInp.value : 0)) || 0; }
  function epPctToPrice(cost, pct)   { return cost > 0 ? round2(cost * (1 + pct / 100)) : 0; }
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
    // z-index normal; el flujo "crear gemelo" lo sube luego para apilarse
    // por encima del selector de Compras (z-index 1300).
    if (editProdModal) editProdModal.style.zIndex = "";
    epFillCategories();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set("ep-code",      p.code      || "");
    set("ep-name",      p.name      || "");
    set("ep-stock",          p.stock          || 0);
    set("ep-stock-min",      p.stock_min      || 0);
    set("ep-units-per-bulto", p.units_per_bulto > 1 ? p.units_per_bulto : 1);
    set("ep-pack-unit",      p.pack_unit || "bulto");
    set("ep-expiry-alert",   p.expiry_alert_months != null ? p.expiry_alert_months : 3);
    set("ep-cost",           p.cost           || 0);
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
    // Botón de borrar: solo para el superadmin.
    if (epDeleteBtn) epDeleteBtn.hidden = !(state.me && state.me.isSuperadmin);
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
      if (!name) { alertModal("El nombre es obligatorio."); return; }
      const code = get("ep-code").trim();
      if (!code) { alertModal("El código es obligatorio."); return; }
      const activeChk = document.getElementById("ep-active");
      const body = {
        code,
        name,
        category_id:      epCatSelect && epCatSelect.value ? Number(epCatSelect.value) : null,
        stock:            Math.max(0, Math.round(Number(get("ep-stock"))     || 0)),
        stock_min:        Math.max(0, Math.round(Number(get("ep-stock-min")) || 0)),
        units_per_bulto:  Math.max(1, Number(get("ep-units-per-bulto")) || 1),
        pack_unit:        get("ep-pack-unit") || "bulto",
        expiry_alert_months: (function(){ const n = Math.round(Number(get("ep-expiry-alert"))); return isFinite(n) && n >= 0 ? n : 3; })(),
        cost:             round2(Number(get("ep-cost")))       || 0,
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
        // category_name según la categoría elegida
        let catName = "";
        if (epCatSelect && epCatSelect.value) {
          const opt = epCatSelect.options[epCatSelect.selectedIndex];
          if (opt) catName = opt.text;
        }
        // Actualizar state local (tabla de Productos)
        const p = state.products.find((x) => x.id === editProdId);
        if (p) { Object.assign(p, body); p.category_name = catName; }
        // Mantener sincronizado el cache del selector de Compras y, si está
        // abierto, re-renderizarlo para reflejar los cambios del gemelo.
        const ap = (state.allProducts || []).find((x) => x.id === editProdId);
        if (ap) { Object.assign(ap, body); ap.category_name = catName; }
        if (els.purPickerModal && !els.purPickerModal.hidden) {
          renderPurPicker(els.purPickerSearch ? els.purPickerSearch.value : "");
          updatePurPickerCount();
        }
        applyFilters();
        showToast("Producto guardado");
        if (editProdModal) { editProdModal.hidden = true; editProdModal.style.zIndex = ""; }
      } catch (e) {
        alertModal(e.message || "Error al guardar");
      } finally {
        epSaveBtn.disabled = false;
      }
    });
  }

  // Borrar producto (solo superadmin). El server bloquea si tiene movimientos.
  if (epDeleteBtn) {
    epDeleteBtn.addEventListener("click", async () => {
      if (!editProdId) return;
      const p = state.products.find((x) => x.id === editProdId) ||
                (state.allProducts || []).find((x) => x.id === editProdId);
      const nombre = p ? (p.name + " (" + (p.code || "—") + ")") : ("#" + editProdId);
      const ok = await confirmModal({
        title: "Borrar producto",
        message: "¿Borrar definitivamente " + nombre + "?\n\n" +
          "Si el producto tiene pedidos o compras, el sistema NO lo va a borrar (en ese caso desactivalo). " +
          "Esta acción no se puede deshacer.",
        confirmText: "Borrar",
        danger: true,
      });
      if (!ok) return;
      const delId = editProdId;
      epDeleteBtn.disabled = true;
      try {
        await api("/api/admin/products/" + delId, { method: "DELETE" });
        state.products = (state.products || []).filter((x) => x.id !== delId);
        state.allProducts = (state.allProducts || []).filter((x) => x.id !== delId);
        applyFilters();
        if (els.purPickerModal && !els.purPickerModal.hidden) {
          renderPurPicker(els.purPickerSearch ? els.purPickerSearch.value : "");
          updatePurPickerCount();
        }
        showToast("Producto borrado");
        if (editProdModal) { editProdModal.hidden = true; editProdModal.style.zIndex = ""; }
      } catch (e) {
        alertModal(e.message || "No se pudo borrar el producto");
      } finally {
        epDeleteBtn.disabled = false;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // REPLICAR % / CATEGORÍA A OTROS PRODUCTOS (desde Editar producto)
  // ─────────────────────────────────────────────────────────────────
  const epRepModal     = document.getElementById("ep-rep-modal");
  const epRepBtn       = document.getElementById("ep-replicate-btn");
  const epRepTbody     = document.getElementById("ep-rep-tbody");
  const epRepSearch    = document.getElementById("ep-rep-search");
  const epRepCount     = document.getElementById("ep-rep-count");
  const epRepApplyBtn  = document.getElementById("ep-rep-apply-btn");
  const epRepCheckAll  = document.getElementById("ep-rep-check-all");
  const epRepApplyPcts = document.getElementById("ep-rep-apply-pcts");
  const epRepApplyCat  = document.getElementById("ep-rep-apply-cat");
  const epRepSelected  = new Set();
  let epRepVisible = []; // ids que matchean el filtro actual (para "todos")

  const EP_REP_PRICE_KEY = {
    "ep-vip": "price_vip", "ep-revendedor": "price_revendedor",
    "ep-mayorista": "price_mayorista", "ep-minorista": "price_minorista",
    "ep-publico": "price_publico",
  };

  function epRepUpdateCount() {
    if (epRepCount) epRepCount.textContent = epRepSelected.size + " seleccionado" + (epRepSelected.size === 1 ? "" : "s");
    if (epRepApplyBtn) {
      epRepApplyBtn.disabled = epRepSelected.size === 0 ||
        (!(epRepApplyPcts && epRepApplyPcts.checked) && !(epRepApplyCat && epRepApplyCat.checked));
    }
  }

  function epRepRender(q) {
    if (!epRepTbody) return;
    q = (q || "").trim().toLowerCase();
    const list = (state.allProducts || []).filter((p) => {
      if (p.id === editProdId) return false; // el producto que estoy editando no
      if (!q) return true;
      return (
        String(p.code || "").toLowerCase().includes(q) ||
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.category_name || "").toLowerCase().includes(q)
      );
    });
    epRepVisible = list.map((p) => p.id);
    if (!list.length) {
      epRepTbody.innerHTML = '<tr><td colspan="4" class="muted" style="padding:14px;text-align:center">Sin resultados</td></tr>';
    } else {
      epRepTbody.innerHTML = list.slice(0, 400).map((p) =>
        '<tr data-prod-id="' + p.id + '" style="cursor:pointer">' +
          '<td><input type="checkbox" class="ep-rep-cb"' + (epRepSelected.has(p.id) ? " checked" : "") + ' /></td>' +
          '<td>' + escapeHtml(p.code || "") + '</td>' +
          '<td>' + escapeHtml(p.name || "") + (Number(p.cost) > 0 ? "" : ' <span class="np-note">(sin costo)</span>') + '</td>' +
          '<td>' + escapeHtml(p.category_name || "—") + '</td>' +
        '</tr>'
      ).join("") + (list.length > 400
        ? '<tr><td colspan="4" class="muted" style="padding:8px;text-align:center">Mostrando 400 de ' + list.length + ' — afiná la búsqueda (la selección y "todos" igual abarcan todos los que matchean)</td></tr>'
        : "");
    }
    if (epRepCheckAll) epRepCheckAll.checked = epRepVisible.length > 0 && epRepVisible.every((id) => epRepSelected.has(id));
    epRepUpdateCount();
  }

  if (epRepBtn) {
    epRepBtn.addEventListener("click", async () => {
      if (!epRepModal || !editProdId) return;
      epRepSelected.clear();
      if (epRepSearch) epRepSearch.value = "";
      if (epRepCheckAll) epRepCheckAll.checked = false;
      // Resumen de los % que se van a replicar (los del modal, al momento de abrir)
      const sumEl = document.getElementById("ep-rep-pcts-summary");
      if (sumEl) {
        const labels = { "ep-vip-pct": "VIP", "ep-revendedor-pct": "Rev", "ep-mayorista-pct": "May", "ep-minorista-pct": "Min", "ep-publico-pct": "Púb" };
        sumEl.textContent = "(" + EP_PAIRS.map(({ pctId }) => {
          const el = document.getElementById(pctId);
          return labels[pctId] + " " + (Number(el && el.value) || 0) + "%";
        }).join(" · ") + ")";
      }
      // Categoría elegida en el modal de edición (la que se replicaría)
      const catNameEl = document.getElementById("ep-rep-cat-name");
      if (catNameEl) {
        let catName = "Sin categoría";
        if (epCatSelect && epCatSelect.value) {
          const opt = epCatSelect.options[epCatSelect.selectedIndex];
          if (opt) catName = opt.text;
        }
        catNameEl.textContent = catName;
      }
      epRepTbody.innerHTML = '<tr><td colspan="4" class="muted" style="padding:14px;text-align:center">Cargando…</td></tr>';
      epRepModal.hidden = false;
      await ensureAllProducts();
      epRepRender("");
      if (epRepSearch) epRepSearch.focus();
    });
  }

  if (epRepTbody) {
    epRepTbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-prod-id]");
      if (!tr) return;
      const cb = tr.querySelector(".ep-rep-cb");
      if (!cb) return;
      if (e.target !== cb) cb.checked = !cb.checked; // click en la fila = toggle
      const pid = Number(tr.dataset.prodId);
      if (cb.checked) epRepSelected.add(pid);
      else epRepSelected.delete(pid);
      if (epRepCheckAll) epRepCheckAll.checked = epRepVisible.length > 0 && epRepVisible.every((id) => epRepSelected.has(id));
      epRepUpdateCount();
    });
  }

  if (epRepCheckAll) {
    epRepCheckAll.addEventListener("change", () => {
      if (epRepCheckAll.checked) epRepVisible.forEach((id) => epRepSelected.add(id));
      else epRepVisible.forEach((id) => epRepSelected.delete(id));
      epRepRender(epRepSearch ? epRepSearch.value : "");
    });
  }

  if (epRepSearch) {
    epRepSearch.addEventListener("input", debounce((e) => epRepRender(e.target.value), 200));
  }

  [epRepApplyPcts, epRepApplyCat].forEach((el) => {
    if (el) el.addEventListener("change", epRepUpdateCount);
  });

  if (epRepApplyBtn) {
    epRepApplyBtn.addEventListener("click", async () => {
      if (!epRepSelected.size) return;
      const doPcts = epRepApplyPcts && epRepApplyPcts.checked;
      const doCat  = epRepApplyCat && epRepApplyCat.checked;
      if (!doPcts && !doCat) { alertModal("Elegí qué replicar: porcentajes y/o categoría."); return; }

      // % actuales del modal de edición (pueden estar editados sin guardar — se
      // replican tal como se ven en pantalla)
      const pcts = {};
      EP_PAIRS.forEach(({ pctId, priceId }) => {
        const el = document.getElementById(pctId);
        pcts[priceId] = Number(el && el.value) || 0;
      });
      const catId = epCatSelect && epCatSelect.value ? Number(epCatSelect.value) : null;
      let catName = "";
      if (catId && epCatSelect) {
        const opt = epCatSelect.options[epCatSelect.selectedIndex];
        if (opt) catName = opt.text;
      }

      // Cada producto recalcula sus precios desde SU PROPIO costo con los % replicados
      const patches = [];
      let skippedNoCost = 0;
      epRepSelected.forEach((pid) => {
        const prod = (state.allProducts || []).find((p) => p.id === pid);
        if (!prod) return;
        const patch = { id: pid };
        if (doPcts) {
          const cost = Number(prod.cost) || 0;
          if (cost > 0) {
            Object.entries(EP_REP_PRICE_KEY).forEach(([priceId, field]) => {
              patch[field] = round2(cost * (1 + pcts[priceId] / 100));
            });
          } else skippedNoCost++;
        }
        if (doCat) patch.category_id = catId;
        if (Object.keys(patch).length > 1) patches.push(patch);
      });
      if (!patches.length) {
        alertModal("Ninguno de los seleccionados se puede actualizar" + (skippedNoCost ? " (no tienen costo cargado)" : "") + ".");
        return;
      }

      const parts = [];
      if (doPcts) parts.push("los porcentajes de ganancia");
      if (doCat) parts.push('la categoría "' + (catName || "Sin categoría") + '"');
      let msg = "Se va a aplicar " + parts.join(" y ") + " a " + patches.length + " producto" + (patches.length === 1 ? "" : "s") + ".";
      if (skippedNoCost) {
        msg += "\n\n" + skippedNoCost + " sin costo cargado: no se les recalculan precios" + (doCat ? " (solo se les cambia la categoría)" : " y quedan afuera") + ".";
      }
      if (!await confirmModal(msg)) return;

      try {
        epRepApplyBtn.disabled = true;
        const out = await api("/api/admin/products/bulk-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patches }),
        });
        // Sync de los caches locales (tabla de Productos + picker de Compras)
        patches.forEach((patch) => {
          [state.products, state.allProducts].forEach((arr) => {
            const p = (arr || []).find((x) => x.id === patch.id);
            if (!p) return;
            Object.keys(patch).forEach((k) => { if (k !== "id") p[k] = patch[k]; });
            if ("category_id" in patch) p.category_name = catId ? catName : "";
          });
        });
        applyFilters();
        showToast("Replicado a " + (out && out.updated != null ? out.updated : patches.length) + " producto(s)");
        epRepSelected.clear();
        epRepModal.hidden = true;
      } catch (e) {
        alertModal(e.message || "Error al replicar");
      } finally {
        epRepApplyBtn.disabled = false;
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

  // round2 (no Math.round): el costo admite centavos, igual que en el server.
  function npGetCost() { return round2(Number(npCostInp ? npCostInp.value : 0)) || 0; }

  // costo + % → precio
  function npPctToPrice(cost, pct) { return cost > 0 ? round2(cost * (1 + pct / 100)) : 0; }
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
    npForPurchase = false;
    npForCotizacion = false;
    npForReception = false;
    if (newProdModal) newProdModal.style.zIndex = "";
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
      if (!code) { alertModal("El código es obligatorio."); return; }
      if (!name) { alertModal("El nombre es obligatorio."); return; }
      const cost = npGetCost();
      if (!cost) { alertModal("Ingresá un costo mayor a 0."); return; }
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
        // Si se creó desde el selector de Compras, dejarlo cargado en el cache
        // del picker y preseleccionado con cantidad 1, listo para agregar a la
        // compra (el stock arranca en 0; la compra le suma stock al guardar).
        if (npForPurchase && result.product) {
          state.allProducts = state.allProducts || [];
          state.allProducts.push(result.product);
          if (state.purPickerSelected) state.purPickerSelected.set(result.product.id, 1);
          if (els.purPickerSearch) els.purPickerSearch.value = String(result.product.code || "");
          if (els.purPickerModal && !els.purPickerModal.hidden) {
            renderPurPicker(els.purPickerSearch ? els.purPickerSearch.value : "");
            updatePurPickerCount();
          }
          showToast("Producto creado (código " + result.product.code + ") y seleccionado para la compra.");
        } else if (npForCotizacion && result.product) {
          state.allProducts = state.allProducts || [];
          state.allProducts.push(result.product);
          state.cotPickerSelected = state.cotPickerSelected || new Map();
          state.cotPickerSelected.set(result.product.id, { qty: 1, product: result.product });
          if (els.pcotPickerSearch) els.pcotPickerSearch.value = String(result.product.code || "");
          if (els.pcotPickerModal && !els.pcotPickerModal.hidden) {
            renderCotPickerRows(els.pcotPickerSearch ? els.pcotPickerSearch.value : "");
            updateCotPickerCount();
          }
          showToast("Producto creado (código " + result.product.code + ") y seleccionado para la cotización.");
        } else if (npForReception && result.product) {
          // Creado desde el clic derecho de la recepción: sumarlo al cache y
          // repuntar la línea objetivo al producto nuevo.
          state.allProducts = state.allProducts || [];
          state.allProducts.push(result.product);
          if (Array.isArray(state.products)) state.products.unshift(result.product);
          if (recvProdTargetItem && recvState.purchaseId) {
            try {
              await api("/api/admin/reception/" + recvState.purchaseId + "/item/" + recvProdTargetItem.id + "/product", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_id: result.product.id }),
              });
              if (recvEls.prodModal) recvEls.prodModal.hidden = true;
              await recvFetch(false);
              showToast("Producto creado (código " + result.product.code + ") y asignado a la línea.");
            } catch (e2) {
              showToast("Producto creado pero no se pudo asignar: " + e2.message, "error");
            }
          }
        } else {
          // Alta simple (desde la pestaña Productos): mantener también el
          // cache del picker de Compras/Cotizaciones, que solo se sumaba en
          // los flujos npFor* y dejaba el producto nuevo invisible al picker.
          if (state.allProductsLoaded && Array.isArray(state.allProducts)) {
            state.allProducts.push(result.product);
          }
          showToast("Producto creado: " + name);
        }
        if (newProdModal) { newProdModal.hidden = true; newProdModal.style.zIndex = ""; }
        npForPurchase = false;
        npForCotizacion = false;
        npForReception = false;
      } catch (e) {
        alertModal(e.message || "Error al crear producto");
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
      const rawQty  = qtyInp ? String(qtyInp.value).trim() : "";
      const qty     = Number(rawQty);
      const type    = typeEl  ? typeEl.value  : "ajuste";
      const reason  = reasonEl? reasonEl.value.trim() : "";
      // Campo vacío NO es 0: Number("") da 0 y en modo "fijar" aniquilaba el
      // stock si se borraba el input y se guardaba sin querer.
      if (rawQty === "" || isNaN(qty)) { alertModal("Ingresá una cantidad válida."); return; }
      try {
        adjSaveBtn.disabled = true;
        const result = await api("/api/admin/stock-adjustments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: adjState.productId, mode, qty, type, reason }),
        });
        // Actualizar estado local del producto (tabla + cache del picker de
        // Compras/Cotizaciones, que antes quedaba con el stock viejo).
        const p = state.products.find((x) => x.id === adjState.productId);
        if (p) {
          p.stock = result.qty_after;
          applyFilters(); // re-render para reflejar cambio de color OOS
        }
        const ap = (state.allProducts || []).find((x) => x.id === adjState.productId);
        if (ap) ap.stock = result.qty_after;
        showToast("Stock ajustado: " + result.qty_before + " → " + result.qty_after);
        if (adjModal) adjModal.hidden = true;
      } catch (e) {
        alertModal(e.message || "Error al guardar ajuste");
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
      if (q) rows = rows.filter((r) => matchWords(r.product_name + " " + r.product_code, q));
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
    month:      document.getElementById("rpt-month"),
    year:       document.getElementById("rpt-year"),
    yearWrap:   document.getElementById("rpt-year-wrap"),
    fromWrap:   document.getElementById("rpt-from-wrap"),
    toWrap:     document.getElementById("rpt-to-wrap"),
    from:       document.getElementById("rpt-from"),
    to:         document.getElementById("rpt-to"),
    status:     document.getElementById("rpt-status"),
    client:     document.getElementById("rpt-client"),
    vendedor:   document.getElementById("rpt-vendedor"),
    applyBtn:   document.getElementById("rpt-apply-btn"),
    exportBtn:  document.getElementById("rpt-export-btn"),
    catTbody:   document.getElementById("rpt-cat-tbody"),
    catTfoot:   document.getElementById("rpt-cat-tfoot"),
  };
  const rptState = { cats: [], lastQs: "", data: null, sort: { key: "ventas", dir: "desc" } };
  function rptSortVal(c, k) {
    if (k === "name") return (c.category_name || "").toLowerCase();
    if (k === "unidades") return Number(c.unidades) || 0;
    if (k === "pedidos") return Number(c.pedidos) || 0;
    if (k === "ventas") return Number(c.ventas) || 0;
    if (k === "ganancia") return Number(c.ganancia) || 0;
    if (k === "margen") return Number(c.ventas) > 0 ? (Number(c.ganancia) || 0) / Number(c.ventas) : 0;
    return 0;
  }

  function rptFmt(n) { return "$ " + Number(n).toLocaleString("es-AR"); }
  function rptPct(num, den) { return den > 0 ? Math.round(num / den * 100) + "%" : "—"; }
  function rptDate(s) { return (s || "").slice(0, 10).split("-").reverse().join("/"); }

  // Labels/clases de estado: fuente única ORDER_STATUS_* (arriba del archivo).

  // ── Selector de período Mes/Año (default: mes corriente) + opción Personalizado
  const RPT_MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // Llena los selects de Mes (12 + Personalizado) y Año (una sola vez). Default: mes/año corriente.
  function rptFillPeriodSelect() {
    if (!rptEls.month || rptEls.month.options.length) return;
    const now = new Date();
    let mHtml = "";
    for (let i = 0; i < 12; i++) mHtml += '<option value="' + (i + 1) + '">' + RPT_MESES[i] + '</option>';
    mHtml += '<option value="custom">Personalizado…</option>';
    rptEls.month.innerHTML = mHtml;
    rptEls.month.value = String(now.getMonth() + 1);
    if (rptEls.year) {
      let yHtml = "";
      for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) yHtml += '<option value="' + y + '">' + y + '</option>';
      rptEls.year.innerHTML = yHtml;
      rptEls.year.value = String(now.getFullYear());
    }
  }

  // YYYY-MM del período elegido (null si es Personalizado) — lo usa el resalte del gráfico
  function rptSelYm() {
    if (!rptEls.month || rptEls.month.value === "custom") return null;
    const y = Number(rptEls.year && rptEls.year.value) || new Date().getFullYear();
    return y + "-" + String(rptEls.month.value).padStart(2, "0");
  }

  // Aplica Mes/Año a los inputs desde/hasta y muestra/oculta el rango manual.
  // Ojo: toggle con style.display (no [hidden]) porque .rpt-filter-label es display:flex.
  function rptApplyPeriod() {
    const custom = !rptEls.month || rptEls.month.value === "custom";
    if (rptEls.yearWrap) rptEls.yearWrap.style.display = custom ? "none" : "";
    if (rptEls.fromWrap) rptEls.fromWrap.style.display = custom ? "" : "none";
    if (rptEls.toWrap)   rptEls.toWrap.style.display   = custom ? "" : "none";
    if (!custom && rptEls.from && rptEls.to) {
      const ym = rptSelYm();
      const parts = ym.split("-");
      const lastDay = new Date(Number(parts[0]), Number(parts[1]), 0).getDate(); // día 0 del mes siguiente = último del mes
      rptEls.from.value = ym + "-01";
      rptEls.to.value   = ym + "-" + String(lastDay).padStart(2, "0");
    } else if (custom && rptEls.from && !rptEls.from.value) {
      // Primera vez en personalizado: precarga este mes (fecha LOCAL, no toISOString/UTC)
      const now = new Date();
      rptEls.from.value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01";
      rptEls.to.value   = now.toLocaleDateString("en-CA");
    }
  }

  // ── Gráfico comparativo mensual (Chart.js, barras ventas/compras + línea ganancia)
  let rptChartInstance = null;
  async function loadRptHistory() {
    const card = document.getElementById("rpt-chart-card");
    if (!card) return;
    if (typeof Chart === "undefined") { card.style.display = "none"; return; }
    try {
      const data = await api("/api/admin/reports/monthly-history?months=13");
      card.style.display = "";
      renderRptChart(data.months || []);
    } catch (_) { card.style.display = "none"; }
  }

  function renderRptChart(months) {
    const canvas = document.getElementById("rpt-chart");
    if (!canvas) return;
    const labels = months.map((m) => {
      const p = m.ym.split("-");
      return RPT_MESES[Number(p[1]) - 1].slice(0, 3) + " '" + p[0].slice(2);
    });
    // Resalta el mes seleccionado en los selectores de período
    const selYm = rptSelYm();
    const ventasBg = months.map((m) => (m.ym === selYm ? "#1e3a5f" : "#2563eb"));
    if (rptChartInstance) { rptChartInstance.destroy(); rptChartInstance = null; }
    rptChartInstance = new Chart(canvas, {
      data: {
        labels: labels,
        datasets: [
          { type: "bar",  label: "Ventas",   data: months.map((m) => m.ventas),   backgroundColor: ventasBg, borderRadius: 3, order: 2 },
          { type: "bar",  label: "Compras",  data: months.map((m) => m.compras),  backgroundColor: "#f59e0b", borderRadius: 3, order: 3 },
          { type: "line", label: "Ganancia", data: months.map((m) => m.ganancia), borderColor: "#15803d", backgroundColor: "#15803d", tension: 0.3, pointRadius: 3, order: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (c) => c.dataset.label + ": " + rptFmt(c.parsed.y),
              afterBody: (items) => {
                const m = months[items[0].dataIndex];
                return m ? [m.orders + " pedido(s) · Cobros: " + rptFmt(m.cobros)] : [];
              },
            },
          },
        },
        scales: {
          y: { ticks: { callback: (v) => "$ " + Number(v).toLocaleString("es-AR") } },
          x: { grid: { display: false } },
        },
      },
    });
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
    rptFillPeriodSelect();
    rptApplyPeriod();
    loadRptHistory(); // gráfico en paralelo, no bloquea la tabla
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
    if (!rptEls.catTbody) return;
    rptEls.catTbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Cargando…</td></tr>';
    if (rptEls.catTfoot) rptEls.catTfoot.innerHTML = "";

    const qs = [
      rptEls.from    && rptEls.from.value    ? "from="      + rptEls.from.value    : "",
      rptEls.to      && rptEls.to.value      ? "to="        + rptEls.to.value      : "",
      rptEls.status  && rptEls.status.value !== "todos" ? "status=" + rptEls.status.value : "",
      rptEls.client  && rptEls.client.value  ? "client_id=" + rptEls.client.value  : "",
      rptEls.vendedor&& rptEls.vendedor.value? "vendedor_id="+ rptEls.vendedor.value: "",
    ].filter(Boolean).join("&");
    rptState.lastQs = qs;

    try {
      const [data, catsData] = await Promise.all([
        api("/api/admin/reports/sales" + (qs ? "?" + qs : "")),
        api("/api/admin/reports/by-category" + (qs ? "?" + qs : "")),
      ]);
      rptState.cats = (catsData && catsData.categories) || [];
      renderReportes(data);
    } catch (e) {
      rptEls.catTbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Error cargando reporte.</td></tr>';
    }
  }

  function renderReportes(data) {
    rptState.data = data;
    const { kpis, cobros } = data;
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
    if (data.compras) {
      setKpi("rpt-kpi-compras",     rptFmt(data.compras.total));
      setKpi("rpt-kpi-compras-cnt", data.compras.cnt + " compra(s)");
    }

    renderRptCats();
  }

  // Tabla de ventas por categoría (con fila de detalle desplegable por categoría)
  function renderRptCats() {
    if (!rptEls.catTbody) return;
    const cats = rptState.cats || [];
    if (!cats.length) {
      rptEls.catTbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Sin ventas en el período seleccionado.</td></tr>';
      if (rptEls.catTfoot) rptEls.catTfoot.innerHTML = "";
      return;
    }
    const sorted = reportSortRows(cats, rptState.sort, rptSortVal);
    updateReportSortHeaders("rpt-cat-table", rptState.sort);
    let tU = 0, tV = 0, tG = 0;
    rptEls.catTbody.innerHTML = sorted.map((c) => {
      tU += Number(c.unidades) || 0;
      tV += Number(c.ventas)   || 0;
      tG += Number(c.ganancia) || 0;
      const margen  = c.ventas > 0 ? Math.round(c.ganancia / c.ventas * 100) : 0;
      const ganHtml = c.ganancia > 0
        ? '<span style="color:#15803d">' + rptFmt(Math.round(c.ganancia)) + '</span>'
        : '<span class="muted">—</span>';
      return '<tr class="rpt-cat-row" data-cat-id="' + c.category_id + '">' +
        '<td><strong>' + escapeHtml(c.category_name) + '</strong></td>' +
        '<td class="num muted">' + (c.unidades || 0) + '</td>' +
        '<td class="num muted">' + (c.pedidos || 0) + '</td>' +
        '<td class="num"><strong>' + rptFmt(c.ventas) + '</strong></td>' +
        '<td class="num">' + ganHtml + '</td>' +
        '<td class="num muted">' + (margen > 0 ? margen + "%" : "—") + '</td>' +
        '<td><button class="btn btn-small rpt-cat-btn" type="button" data-id="' + c.category_id + '" title="Ver productos más vendidos">▼</button></td>' +
        '</tr>' +
        '<tr class="rpt-cat-detail-row" id="rpt-cat-detail-' + c.category_id + '" hidden>' +
        '<td colspan="7" style="padding:0;background:#f8fafc"></td>' +
        '</tr>';
    }).join("");

    // Totales (pedidos: total del período, no la suma por categoría — un pedido puede tocar varias)
    const tMargen = tV > 0 ? Math.round(tG / tV * 100) : 0;
    const tOrders = rptState.data && rptState.data.kpis ? rptState.data.kpis.total_orders : "—";
    if (rptEls.catTfoot) rptEls.catTfoot.innerHTML =
      '<tr style="font-weight:700;background:#f1f5f9">' +
      '<td style="padding:8px 12px">Totales</td>' +
      '<td class="num">' + tU + '</td>' +
      '<td class="num">' + tOrders + '</td>' +
      '<td class="num">' + rptFmt(tV) + '</td>' +
      '<td class="num" style="color:#15803d">' + rptFmt(Math.round(tG)) + '</td>' +
      '<td class="num">' + (tMargen > 0 ? tMargen + "%" : "—") + '</td>' +
      '<td></td></tr>';
  }

  // Expandir detalle de una categoría (top productos vendidos)
  if (rptEls.catTbody) {
    rptEls.catTbody.addEventListener("click", async (e) => {
      const btn = e.target.closest(".rpt-cat-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      const detailRow = document.getElementById("rpt-cat-detail-" + id);
      if (!detailRow) return;
      if (!detailRow.hidden) {
        detailRow.hidden = true;
        btn.textContent = "▼";
        return;
      }
      btn.disabled = true;
      try {
        const qs = rptState.lastQs;
        const out = await api("/api/admin/reports/by-category/" + id + "/products" + (qs ? "?" + qs : ""));
        const prods = (out && out.products) || [];
        const td = detailRow.querySelector("td");
        if (td) {
          td.innerHTML = '<div style="padding:8px 16px 12px">' +
            '<table style="width:100%;font-size:12px;border-collapse:collapse">' +
            '<thead><tr style="color:#6b7280">' +
            '<th style="text-align:left;padding:4px 8px">Producto</th>' +
            '<th style="text-align:right;padding:4px 8px">Unidades</th>' +
            '<th style="text-align:right;padding:4px 8px">Ventas</th>' +
            '<th style="text-align:right;padding:4px 8px">Ganancia</th>' +
            '</tr></thead><tbody>' +
            (prods.map((it) =>
              '<tr><td style="padding:3px 8px">' + escapeHtml(it.name || "") + ' <span style="color:#9ca3af">' + escapeHtml(it.code || "") + '</span></td>' +
              '<td style="text-align:right;padding:3px 8px">' + (it.unidades || 0) + '</td>' +
              '<td style="text-align:right;padding:3px 8px"><strong>' + rptFmt(it.ventas) + '</strong></td>' +
              '<td style="text-align:right;padding:3px 8px;color:#15803d">' + rptFmt(Math.round(it.ganancia)) + '</td></tr>'
            ).join("") || '<tr><td colspan="4" style="padding:8px;color:#9ca3af">Sin productos</td></tr>') +
            '</tbody></table></div>';
        }
        detailRow.hidden = false;
        btn.textContent = "▲";
      } catch (_) { showToast("Error cargando productos", "err"); }
      finally { btn.disabled = false; }
    });
  }

  // Botón Aplicar
  if (rptEls.applyBtn) rptEls.applyBtn.addEventListener("click", applyReportes);

  // Cambio de Mes/Año: setea fechas y aplica solo (el gráfico se re-renderiza para resaltar el mes)
  function onRptPeriodChange() {
    rptApplyPeriod();
    if (rptEls.month && rptEls.month.value !== "custom") applyReportes();
    loadRptHistory();
  }
  if (rptEls.month) rptEls.month.addEventListener("change", onRptPeriodChange);
  if (rptEls.year)  rptEls.year.addEventListener("change", onRptPeriodChange);

  // Orden por click en los headers
  wireReportSort("rpt-cat-table", rptState.sort, renderRptCats);

  // Export CSV
  if (rptEls.exportBtn) {
    rptEls.exportBtn.addEventListener("click", () => {
      if (!rptState.cats.length) { alertModal("No hay datos para exportar."); return; }
      const header = ["Categoría","Unidades","Pedidos","Ventas","Ganancia","Margen %"];
      const rows = rptState.cats.map((c) => [
        '"' + (c.category_name || "").replace(/"/g,'""') + '"',
        c.unidades || 0,
        c.pedidos || 0,
        c.ventas || 0,
        Math.round(c.ganancia) || 0,
        c.ventas > 0 ? Math.round(c.ganancia / c.ventas * 100) : 0,
      ]);
      const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "reporte-categorias-" + (rptEls.from && rptEls.from.value ? rptEls.from.value : "hoy") + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // INFLACIÓN (solo superadmin): impacto de los cambios de costo
  // ─────────────────────────────────────────────────────────────────
  const infEls = {
    from:      document.getElementById("inf-from"),
    to:        document.getElementById("inf-to"),
    applyBtn:  document.getElementById("inf-apply-btn"),
    exportBtn: document.getElementById("inf-export-btn"),
    tbody:     document.getElementById("inf-tbody"),
    tfoot:     document.getElementById("inf-tfoot"),
    kpiReval:   document.getElementById("inf-kpi-reval"),
    kpiPerdida: document.getElementById("inf-kpi-perdida"),
    kpiNeto:    document.getElementById("inf-kpi-neto"),
    kpiCambios: document.getElementById("inf-kpi-cambios"),
    kpiStock:   document.getElementById("inf-kpi-stock"),
  };
  const infState = { changes: [], sort: { key: null, dir: "desc" } };
  const INF_SOURCE_LABEL = { compra: "🛒 Compra", manual: "✏️ Manual", excel: "📊 Excel" };
  function infSortVal(c, k) {
    if (k === "date") return c.created_at || "";
    if (k === "product") return (c.name || "").toLowerCase();
    if (k === "source") return c.source || "";
    if (k === "old") return Number(c.old_cost) || 0;
    if (k === "new") return Number(c.new_cost) || 0;
    if (k === "delta") return c.delta_pct == null ? -Infinity : Number(c.delta_pct);
    if (k === "stock") return Number(c.stock_at_change) || 0;
    if (k === "reval") return Number(c.revalorizacion) || 0;
    if (k === "sold") return c.sold_qty == null ? -Infinity : Number(c.sold_qty);
    if (k === "perdida") return c.perdida == null ? 0 : -Number(c.perdida);
    if (k === "neto") return Number(c.neto) || 0;
    return 0;
  }

  function infFmt(n) {
    const v = Math.round(Number(n)) || 0;
    return "$ " + v.toLocaleString("es-AR");
  }
  function infSigned(n) {
    const v = Math.round(Number(n)) || 0;
    const s = "$ " + Math.abs(v).toLocaleString("es-AR");
    if (v > 0) return '<span class="text-good" style="color:#15803d;font-weight:700">+' + s + "</span>";
    if (v < 0) return '<span style="color:#b91c1c;font-weight:700">−' + s + "</span>";
    return s;
  }
  // Variante texto plano para las KPI cards de color (texto blanco sobre gradiente).
  function infSignedText(n) {
    const v = Math.round(Number(n)) || 0;
    return (v > 0 ? "+" : v < 0 ? "−" : "") + "$ " + Math.abs(v).toLocaleString("es-AR");
  }
  function infSetDefaultRange() {
    if (!infEls.from || infEls.from.value) return;
    const now = new Date();
    infEls.from.value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01";
    infEls.to.value = now.toISOString().slice(0, 10);
  }

  async function loadInflacion() {
    if (!infEls.tbody) return;
    infSetDefaultRange();
    infEls.tbody.innerHTML = '<tr><td colspan="12" class="muted" style="text-align:center;padding:24px">Cargando…</td></tr>';
    if (infEls.tfoot) infEls.tfoot.innerHTML = "";
    try {
      const qs = [
        infEls.from && infEls.from.value ? "from=" + infEls.from.value : "",
        infEls.to && infEls.to.value ? "to=" + infEls.to.value : "",
      ].filter(Boolean).join("&");
      const data = await api("/api/admin/reports/inflation" + (qs ? "?" + qs : ""));
      infState.changes = data.changes || [];
      renderInflacion(data);
    } catch (e) {
      infEls.tbody.innerHTML = '<tr><td colspan="12" class="muted" style="text-align:center;padding:24px">' +
        escapeHtml(e.message || "Error cargando el reporte") + "</td></tr>";
    }
  }

  function renderInflacion(data) {
    infState.data = data;
    const t = data.totals || {};
    if (infEls.kpiReval)   infEls.kpiReval.textContent = infSignedText(t.revalorizacion);
    if (infEls.kpiPerdida) infEls.kpiPerdida.textContent = infSignedText(-(t.perdida || 0));
    if (infEls.kpiNeto)    infEls.kpiNeto.textContent = infSignedText(t.neto);
    if (infEls.kpiCambios) {
      infEls.kpiCambios.textContent = (t.changes_count || 0) + " cambios · " + (t.products_count || 0) + " productos" +
        (t.sin_ventana ? " · " + t.sin_ventana + " sin referencia previa" : "");
    }
    if (infEls.kpiStock) infEls.kpiStock.textContent = infFmt(data.stock_value_now);

    const rows = reportSortRows(infState.changes, infState.sort, infSortVal);
    updateReportSortHeaders("inf-table", infState.sort);
    if (!rows.length) {
      infEls.tbody.innerHTML = '<tr><td colspan="12" class="muted" style="text-align:center;padding:24px">' +
        "Sin cambios de costo en el período. Los cambios se registran desde que esta función está activa.</td></tr>";
      return;
    }
    infEls.tbody.innerHTML = rows.map((c) => {
      const fecha = (c.created_at || "").slice(0, 10).split("-").reverse().join("/");
      const pct = c.delta_pct == null ? "—"
        : (c.delta_pct > 0 ? "+" : "") + c.delta_pct.toFixed(1) + "%";
      const pctColor = c.delta > 0 ? "#b91c1c" : (c.delta < 0 ? "#15803d" : "inherit");
      return "<tr>" +
        "<td>" + fecha + "</td>" +
        "<td><strong>" + escapeHtml(c.name) + "</strong> <span class='muted'>(" + escapeHtml(c.code || "—") + ")</span></td>" +
        "<td>" + (INF_SOURCE_LABEL[c.source] || escapeHtml(c.source)) + "</td>" +
        '<td class="num">' + infFmt(c.old_cost) + "</td>" +
        '<td class="num">' + infFmt(c.new_cost) + "</td>" +
        '<td class="num" style="font-weight:700;color:' + pctColor + '">' + pct + "</td>" +
        '<td class="num">' + c.stock_at_change + "</td>" +
        '<td class="num">' + infSigned(c.revalorizacion) + "</td>" +
        '<td class="num">' + (c.sold_qty == null ? '<span class="muted" title="Primer cambio registrado del producto: no hay referencia previa para medir ventas">—</span>' : c.sold_qty) + "</td>" +
        '<td class="num">' + (c.perdida == null ? '<span class="muted">—</span>' : infSigned(-c.perdida)) + "</td>" +
        '<td class="num">' + infSigned(c.neto) + "</td>" +
        '<td><button type="button" class="btn-mini inf-del-btn" data-id="' + c.id +
          '" title="Borrar este registro de cambio de costo (carga errónea). No toca el costo actual del producto.">🗑</button></td>' +
        "</tr>";
    }).join("");
    infEls.tbody.querySelectorAll(".inf-del-btn").forEach((btn) => {
      btn.addEventListener("click", () => infDeleteChange(Number(btn.dataset.id)));
    });
    if (infEls.tfoot) {
      const tr = infState.changes;
      const sumReval = tr.reduce((a, c) => a + (c.revalorizacion || 0), 0);
      const sumPerd = tr.reduce((a, c) => a + (c.perdida || 0), 0);
      infEls.tfoot.innerHTML = "<tr style='font-weight:700;background:#f9f5ef'>" +
        '<td colspan="7" style="text-align:right">Totales:</td>' +
        '<td class="num">' + infSigned(sumReval) + "</td>" +
        "<td></td>" +
        '<td class="num">' + infSigned(-sumPerd) + "</td>" +
        '<td class="num">' + infSigned(sumReval - sumPerd) + "</td>" +
        "<td></td>" +
        "</tr>";
    }
  }

  // Borra un registro de cambio de costo (carga errónea que distorsiona el
  // reporte). Solo afecta al historial de inflación, no al costo del producto.
  async function infDeleteChange(id) {
    const c = (infState.changes || []).find((x) => x.id === id);
    const nombre = c ? (c.name + " (" + (c.code || "—") + ")") : ("#" + id);
    const ok = await confirmModal({
      title: "Borrar registro de inflación",
      message: "¿Borrar el cambio de costo de " + nombre + "?\n\n" +
        "Esto solo limpia el historial del reporte de inflación. NO cambia el costo actual del producto ni el stock.",
      confirmText: "Borrar",
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/admin/reports/inflation/" + id, { method: "DELETE" });
      showToast("Registro borrado");
      loadInflacion();
    } catch (err) {
      alertModal("No se pudo borrar: " + err.message);
    }
  }

  if (infEls.applyBtn) infEls.applyBtn.addEventListener("click", loadInflacion);
  wireReportSort("inf-table", infState.sort, () => { if (infState.data) renderInflacion(infState.data); });
  if (infEls.exportBtn) {
    infEls.exportBtn.addEventListener("click", () => {
      if (!infState.changes.length) { alertModal("No hay datos para exportar."); return; }
      const header = ["Fecha", "Codigo", "Producto", "Origen", "Costo viejo", "Costo nuevo", "Delta %", "Stock al cambio", "Ganado stock", "Vendido", "Perdido ventas", "Neto"];
      const rows = infState.changes.map((c) => [
        (c.created_at || "").slice(0, 10),
        '"' + String(c.code || "").replace(/"/g, '""') + '"',
        '"' + String(c.name || "").replace(/"/g, '""') + '"',
        c.source,
        c.old_cost,
        c.new_cost,
        c.delta_pct == null ? "" : c.delta_pct.toFixed(1),
        c.stock_at_change,
        c.revalorizacion,
        c.sold_qty == null ? "" : c.sold_qty,
        c.perdida == null ? "" : c.perdida,
        c.neto,
      ]);
      const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inflacion-" + (infEls.from && infEls.from.value ? infEls.from.value : "hoy") + ".csv";
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
    accModal:        document.getElementById("caja-account-modal"),
    accModalTitle:   document.getElementById("caja-account-modal-title"),
    accName:         document.getElementById("caja-acc-name"),
    accType:         document.getElementById("caja-acc-type"),
    accResp:         document.getElementById("caja-acc-resp"),
    accRespWrap:     document.getElementById("caja-acc-resp-wrap"),
    accActive:       document.getElementById("caja-acc-active"),
    accActiveWrap:   document.getElementById("caja-acc-active-wrap"),
    accSaveBtn:      document.getElementById("caja-acc-save-btn"),
    movModal:        document.getElementById("caja-mov-modal"),
    movOpenBtn:      document.getElementById("caja-mov-open-btn"),
    movAccountLabel: document.getElementById("caja-mov-account-label"),
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
    tabs:            document.getElementById("caja-tabs"),
    orderBtn:        document.getElementById("caja-order-btn"),
    orderModal:      document.getElementById("caja-order-modal"),
    orderList:       document.getElementById("caja-order-list"),
    orderSaveBtn:    document.getElementById("caja-order-save-btn"),
  };
  // activeTab: "general" | userId (number) del responsable
  const cajaState = { accounts: [], movType: "ingreso", editAccountId: null, activeTab: "general", tabOrder: [] };
  function cajaIsSuper() { return !!(state.me && state.me.isSuperadmin); }

  function cajaFmt(n) { return "$ " + Number(n).toLocaleString("es-AR"); }
  function cajaTodayIso() { return new Date().toISOString().slice(0, 10); }

  const CAJA_ICON = { efectivo:"💵", banco:"🏦", digital:"📱" };

  function cajaAccCardHtml(a) {
    const saldo = Number(a.saldo) || 0;
    const cls   = saldo < 0 ? "caja-acc-neg" : "caja-acc-pos";
    const inactive = Number(a.active) === 0 ? ' caja-acc-inactive' : '';
    return '<div class="caja-acc-card' + inactive + '" data-caja-edit="' + a.id + '" title="Tocá para editar esta caja">' +
      '<span class="caja-acc-icon">' + (CAJA_ICON[a.type] || "💰") + '</span>' +
      '<div class="caja-acc-info">' +
        '<span class="caja-acc-name">' + escapeHtml(a.name) +
          (inactive ? ' <span class="caja-acc-off">inactiva</span>' : '') + '</span>' +
        '<span class="caja-acc-type muted small">' + escapeHtml(a.type) + '</span>' +
      '</div>' +
      '<span class="caja-acc-saldo ' + cls + '">' + cajaFmt(saldo) + '</span>' +
    '</div>';
  }

  // Pestañas de responsables: [{ key: userId, label }] ordenadas según
  // cajaState.tabOrder (los no listados van al final, por nombre).
  function cajaPersonTabs() {
    const byId = {};
    for (const a of cajaState.accounts) {
      const rid = Number(a.responsable_user_id) || 0;
      if (!rid) continue;
      if (!byId[rid]) byId[rid] = { key: rid, label: a.responsable_full_name || a.responsable_username || ("#" + rid) };
    }
    const tabs = Object.values(byId);
    const pos = (id) => { const i = cajaState.tabOrder.indexOf(id); return i < 0 ? 9999 : i; };
    tabs.sort((t1, t2) => pos(t1.key) - pos(t2.key) || t1.label.localeCompare(t2.label, "es"));
    return tabs;
  }

  // Cuentas de la pestaña activa (general = todas).
  function cajaTabAccounts() {
    if (cajaState.activeTab === "general") return cajaState.accounts;
    return cajaState.accounts.filter((a) => Number(a.responsable_user_id) === Number(cajaState.activeTab));
  }

  function renderCajaTabs() {
    if (!cajaEls.tabs) return;
    const persons = cajaPersonTabs();
    const tabHtml = (key, icon, label) =>
      '<button type="button" class="caja-tab' + (String(cajaState.activeTab) === String(key) ? " active" : "") + '" data-caja-tab="' + key + '">' +
        icon + ' ' + escapeHtml(label) + '</button>';
    cajaEls.tabs.innerHTML =
      tabHtml("general", "🏠", "General") +
      persons.map((t) => tabHtml(t.key, "👤", t.label)).join("");
    if (cajaEls.orderBtn) cajaEls.orderBtn.hidden = persons.length < 2;
  }

  function cajaSwitchTab(key) {
    cajaState.activeTab = key === "general" ? "general" : Number(key);
    // Al cambiar de pestaña, el filtro de cuenta vuelve a "todas" (de esa pestaña).
    if (cajaEls.filterAccount) cajaEls.filterAccount.value = "all";
    renderCajaTabs();
    cajaRenderAccounts();
    cajaFillSelects();
    loadCajaMovements();
  }

  if (cajaEls.tabs) {
    cajaEls.tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-caja-tab]");
      if (btn) cajaSwitchTab(btn.dataset.cajaTab);
    });
  }

  // Tarjeta-resumen por especie (pestaña General).
  function cajaEspecieCardHtml(icon, label, amount, accent) {
    return '<div class="caja-sum-card' + (accent ? " " + accent : "") + '">' +
      '<span class="caja-sum-icon">' + icon + '</span>' +
      '<span class="caja-sum-label">' + label + '</span>' +
      '<span class="caja-sum-amount">' + cajaFmt(amount) + '</span>' +
    '</div>';
  }

  function cajaRenderAccounts() {
    if (!cajaEls.accountsWrap) return;
    const accs = cajaState.accounts;
    if (!accs.length) { cajaEls.accountsWrap.innerHTML = '<p class="muted">Sin cuentas.</p>'; return; }

    if (cajaState.activeTab === "general") {
      // Sumas por especie sobre TODAS las cuentas + total general.
      const sumBy = (t) => accs.filter((a) => a.type === t).reduce((s, a) => s + (Number(a.saldo) || 0), 0);
      const efectivo = sumBy("efectivo"), banco = sumBy("banco"), digital = sumBy("digital");
      const total = efectivo + banco + digital;
      let html = '<div class="caja-sum-row">' +
        cajaEspecieCardHtml("💵", "Efectivo", efectivo, "") +
        cajaEspecieCardHtml("🏦", "Banco", banco, "") +
        cajaEspecieCardHtml("📱", "Billeteras", digital, "") +
        cajaEspecieCardHtml("Σ", "Total", total, "caja-sum-total") +
      '</div>';
      // Las cajas sin responsable solo se ven acá (no tienen pestaña propia).
      const generales = accs.filter((a) => !Number(a.responsable_user_id));
      if (generales.length) {
        html += '<div class="caja-acc-group">' +
          '<div class="caja-acc-group-head">' +
            '<span class="caja-acc-group-name">🏢 Cajas generales</span>' +
            '<span class="caja-acc-group-total">' + cajaFmt(generales.reduce((s, a) => s + (Number(a.saldo) || 0), 0)) + '</span>' +
          '</div>' +
          generales.map(cajaAccCardHtml).join("") +
        '</div>';
      }
      cajaEls.accountsWrap.innerHTML = html;
      return;
    }

    // Pestaña de un responsable: sus cuentas + total propio.
    const mine = cajaTabAccounts();
    if (!mine.length) { cajaEls.accountsWrap.innerHTML = '<p class="muted">Este responsable no tiene cajas.</p>'; return; }
    const label = mine[0].responsable_full_name || mine[0].responsable_username || "";
    const total = mine.reduce((s, a) => s + (Number(a.saldo) || 0), 0);
    cajaEls.accountsWrap.innerHTML = '<div class="caja-acc-group">' +
      '<div class="caja-acc-group-head">' +
        '<span class="caja-acc-group-name">👤 ' + escapeHtml(label) + '</span>' +
        '<span class="caja-acc-group-total">' + cajaFmt(total) + '</span>' +
      '</div>' +
      mine.map(cajaAccCardHtml).join("") +
    '</div>';
  }

  function cajaFillSelects() {
    const accs = cajaState.accounts;
    // Selects del modal de movimiento: siempre todas las cuentas.
    [cajaEls.movAccount, cajaEls.movCounterpart].forEach((sel) => {
      if (!sel) return;
      sel.innerHTML = accs.map((a) => '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>').join("");
    });
    // Select del filtro de movimientos: solo las cuentas de la pestaña activa.
    if (cajaEls.filterAccount) {
      const cur = cajaEls.filterAccount.value;
      const tabAccs = cajaTabAccounts();
      cajaEls.filterAccount.innerHTML = '<option value="all">Todas las cuentas</option>' +
        tabAccs.map((a) => '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>').join("");
      if (cur && tabAccs.some((a) => String(a.id) === cur)) cajaEls.filterAccount.value = cur;
    }
  }

  async function loadCaja() {
    // Crear cuentas es exclusivo del superadmin.
    if (cajaEls.addAccountBtn) cajaEls.addAccountBtn.hidden = !cajaIsSuper();
    // Ingresos/egresos manuales son del superadmin; el admin común solo
    // transfiere desde su caja (ve únicamente el botón de transferencia).
    if (cajaEls.movOpenBtn) cajaEls.movOpenBtn.hidden = !cajaIsSuper();
    try {
      const data = await api("/api/admin/caja");
      cajaState.accounts = data.accounts || data; // tolera la forma vieja (array)
      cajaState.tabOrder = data.tab_order || [];
      // Si la pestaña activa quedó sin cuentas (cambio de responsable), volver a General.
      if (cajaState.activeTab !== "general" && !cajaTabAccounts().length) cajaState.activeTab = "general";
      renderCajaTabs();
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
      // Pestaña de responsable activa + "todas las cuentas" → filtrar por
      // responsable (si hay una cuenta puntual elegida, esa manda).
      const resp = cajaState.activeTab !== "general" && acc === "all"
        ? Number(cajaState.activeTab) : 0;
      const qs   = [
        acc !== "all" ? "account_id=" + acc : "",
        resp ? "responsable_id=" + resp : "",
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

  // Info de saldo de la caja origen en el modal de movimiento: cuánto tiene
  // y cuánto quedaría después de transferir/egresar (se actualiza en vivo).
  function cajaUpdateMovSaldoInfo() {
    const el = document.getElementById("caja-mov-saldo-info");
    if (!el) return;
    if (cajaState.movType !== "transferencia" && cajaState.movType !== "egreso") { el.hidden = true; return; }
    const accId = cajaEls.movAccount ? Number(cajaEls.movAccount.value) : 0;
    const acc = cajaState.accounts.find((a) => Number(a.id) === accId);
    if (!acc) { el.hidden = true; return; }
    const saldo = Number(acc.saldo) || 0;
    const amt = parseMoney(cajaEls.movAmount && cajaEls.movAmount.value);
    const rest = saldo - amt;
    const verb = cajaState.movType === "transferencia" ? "transferir" : "egresar";
    el.innerHTML = '💰 Disponible en <strong>' + escapeHtml(acc.name) + '</strong>: ' + cajaFmt(saldo) +
      (amt > 0
        ? ' &nbsp;·&nbsp; Después de ' + verb + ': <strong class="' + (rest < 0 ? "caja-saldo-neg" : "caja-saldo-ok") + '">' + cajaFmt(rest) + '</strong>'
        : "");
    el.hidden = false;
  }
  if (cajaEls.movAccount) cajaEls.movAccount.addEventListener("change", cajaUpdateMovSaldoInfo);
  if (cajaEls.movAmount) { attachMoneyInput(cajaEls.movAmount); cajaEls.movAmount.addEventListener("input", cajaUpdateMovSaldoInfo); }

  // Toggle ingreso/egreso/transferencia
  if (cajaEls.typeBtns) {
    cajaEls.typeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        cajaEls.typeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        cajaState.movType = btn.dataset.type;
        if (cajaEls.movDestWrap) cajaEls.movDestWrap.hidden = (cajaState.movType !== "transferencia");
        cajaUpdateMovSaldoInfo();
      });
    });
  }

  // Fecha default hoy
  if (cajaEls.movDate) cajaEls.movDate.value = cajaTodayIso();

  // Guardar movimiento
  if (cajaEls.movSaveBtn) {
    cajaEls.movSaveBtn.addEventListener("click", async () => {
      const amount = parseMoney(cajaEls.movAmount ? cajaEls.movAmount.value : 0);
      if (!amount || amount <= 0) { alertModal("Ingresá un monto mayor a 0."); return; }
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
        if (cajaEls.movModal)   cajaEls.movModal.hidden = true;
        showToast("Movimiento registrado");
        await loadCaja(); // refresca saldos + tabla
      } catch (e) {
        alertModal(e.message || "Error al guardar");
      } finally {
        cajaEls.movSaveBtn.disabled = false;
      }
    });
  }

  // Abrir el modal de registrar movimiento, preseleccionando la caja del
  // usuario logueado (donde es responsable); si no tiene, la primera.
  function cajaOpenMovModal(presetType) {
    if (!cajaEls.movModal) return;
    const isSuper = cajaIsSuper();
    const myId = state.me && state.me.id;
    // Admin común: SOLO transferencias y SOLO desde una caja de la que es
    // responsable (regla espejada en el server). El superadmin opera todo.
    const ownAccounts = cajaState.accounts.filter((a) => Number(a.responsable_user_id) === Number(myId));
    if (!isSuper && !ownAccounts.length) {
      alertModal("No tenés ninguna caja a tu cargo. Pedile al superadmin que te asigne una.");
      return;
    }
    // Tipo inicial: "ingreso" por default, o el preseteado (ej: el botón
    // "Transferir entre cajas" abre directo en modo transferencia).
    let t = (presetType === "egreso" || presetType === "transferencia") ? presetType : "ingreso";
    if (!isSuper) t = "transferencia";
    cajaState.movType = t;
    // El toggle de tipo solo lo ve el superadmin (display, no [hidden]: la
    // clase .caja-mov-type-toggle puede pisar el atributo).
    const toggleWrap = cajaEls.movModal.querySelector(".caja-mov-type-toggle");
    if (toggleWrap) toggleWrap.style.display = isSuper ? "" : "none";
    if (cajaEls.typeBtns) cajaEls.typeBtns.forEach((b) => b.classList.toggle("active", b.dataset.type === t));
    if (cajaEls.movDestWrap) cajaEls.movDestWrap.hidden = (t !== "transferencia");
    if (cajaEls.movAmount) cajaEls.movAmount.value = "";
    if (cajaEls.movDesc)   cajaEls.movDesc.value   = "";
    if (cajaEls.movDate)   cajaEls.movDate.value   = cajaTodayIso();
    // Cuentas de ORIGEN: superadmin → todas; admin común → solo las suyas.
    const originAccs = isSuper ? cajaState.accounts : ownAccounts;
    if (cajaEls.movAccount) {
      cajaEls.movAccount.innerHTML = originAccs.map((a) =>
        '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>').join("");
    }
    // Preselección de caja: si hay una pestaña de responsable activa, su
    // primera cuenta; si no, la caja del usuario logueado (donde es responsable).
    const tabAccs = cajaState.activeTab !== "general" ? cajaTabAccounts() : [];
    const pre = [tabAccs[0], ownAccounts[0]].find((a) => a && originAccs.some((o) => o.id === a.id));
    if (cajaEls.movAccount && pre) cajaEls.movAccount.value = String(pre.id);
    cajaUpdateMovSaldoInfo();
    cajaEls.movModal.hidden = false;
    if (cajaEls.movAmount) cajaEls.movAmount.focus();
  }
  if (cajaEls.movOpenBtn) cajaEls.movOpenBtn.addEventListener("click", () => cajaOpenMovModal());
  const cajaTransferBtn = document.getElementById("caja-transfer-open-btn");
  if (cajaTransferBtn) cajaTransferBtn.addEventListener("click", () => cajaOpenMovModal("transferencia"));

  // ── Ordenar pestañas de responsables ──
  let cajaOrderDraft = []; // [{ key, label }] en el orden que se está editando

  function cajaRenderOrderList() {
    if (!cajaEls.orderList) return;
    cajaEls.orderList.innerHTML = cajaOrderDraft.map((t, i) =>
      '<div class="caja-order-row">' +
        '<span class="caja-order-pos">' + (i + 2) + '°</span>' +
        '<span class="caja-order-name">👤 ' + escapeHtml(t.label) + '</span>' +
        '<button type="button" class="btn btn-small" data-ord-up="' + i + '"' + (i === 0 ? " disabled" : "") + '>▲</button>' +
        '<button type="button" class="btn btn-small" data-ord-down="' + i + '"' + (i === cajaOrderDraft.length - 1 ? " disabled" : "") + '>▼</button>' +
      '</div>'
    ).join("");
  }

  if (cajaEls.orderBtn) {
    cajaEls.orderBtn.addEventListener("click", () => {
      cajaOrderDraft = cajaPersonTabs().slice();
      cajaRenderOrderList();
      if (cajaEls.orderModal) cajaEls.orderModal.hidden = false;
    });
  }

  if (cajaEls.orderList) {
    cajaEls.orderList.addEventListener("click", (e) => {
      const up = e.target.closest("[data-ord-up]");
      const down = e.target.closest("[data-ord-down]");
      const i = up ? Number(up.dataset.ordUp) : down ? Number(down.dataset.ordDown) : -1;
      if (i < 0) return;
      const j = up ? i - 1 : i + 1;
      if (j < 0 || j >= cajaOrderDraft.length) return;
      const tmp = cajaOrderDraft[i]; cajaOrderDraft[i] = cajaOrderDraft[j]; cajaOrderDraft[j] = tmp;
      cajaRenderOrderList();
    });
  }

  if (cajaEls.orderSaveBtn) {
    cajaEls.orderSaveBtn.addEventListener("click", async () => {
      try {
        cajaEls.orderSaveBtn.disabled = true;
        const order = cajaOrderDraft.map((t) => t.key);
        await api("/api/admin/caja/tab-order", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ order }) });
        cajaState.tabOrder = order;
        if (cajaEls.orderModal) cajaEls.orderModal.hidden = true;
        renderCajaTabs();
        showToast("Orden guardado");
      } catch (e) {
        alertModal(e.message || "Error al guardar el orden");
      } finally {
        cajaEls.orderSaveBtn.disabled = false;
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
      if (!await confirmModal({ message: "¿Eliminar este movimiento?", confirmText: "Eliminar", danger: true })) return;
      try {
        await api("/api/admin/caja/movements/" + btn.dataset.cajaDel, { method:"DELETE" });
        showToast("Movimiento eliminado");
        await loadCaja();
      } catch (err) { alertModal(err.message || "Error"); }
    });
  }

  // Pobla el select de responsable (cajeros = vendedores level 5 + admins level 99).
  async function cajaPopulateRespSelect(selectedId) {
    if (!cajaEls.accResp) return;
    if (!cajaState.cajeros) {
      try {
        const all = await api("/api/admin/users");
        cajaState.cajeros = (all || []).filter((u) => (u.level === 5 || u.level === 99) && u.active);
      } catch (_) { cajaState.cajeros = []; }
    }
    // Al crear, el responsable es OBLIGATORIO (toda caja nueva tiene dueño);
    // al editar, las cajas generales viejas pueden seguir sin responsable.
    const firstLabel = cajaState.editAccountId
      ? "— Sin responsable (caja general) —"
      : "— Elegí un responsable —";
    const opts = ['<option value="">' + firstLabel + '</option>'];
    for (const u of cajaState.cajeros) {
      const rol = u.level === 99 ? "admin" : "vendedor";
      opts.push('<option value="' + u.id + '">' + escapeHtml(u.full_name || u.username) + ' (' + rol + ')</option>');
    }
    cajaEls.accResp.innerHTML = opts.join("");
    cajaEls.accResp.value = selectedId ? String(selectedId) : "";
  }

  // Abre el modal de cuenta. acc = null → crear (solo superadmin); acc = objeto → editar.
  async function cajaOpenAccountModal(acc) {
    if (!cajaEls.accModal) return;
    const isSuper = cajaIsSuper();
    cajaState.editAccountId = acc ? acc.id : null;
    if (cajaEls.accModalTitle) cajaEls.accModalTitle.textContent = acc ? "Editar cuenta" : "Nueva cuenta";
    if (cajaEls.accName)   cajaEls.accName.value   = acc ? (acc.name || "") : "";
    if (cajaEls.accType)   cajaEls.accType.value   = acc ? (acc.type || "efectivo") : "efectivo";
    if (cajaEls.accActive) cajaEls.accActive.checked = acc ? Number(acc.active) !== 0 : true;
    // El campo activa solo tiene sentido al editar.
    if (cajaEls.accActiveWrap) cajaEls.accActiveWrap.style.display = acc ? "flex" : "none";
    // El responsable solo lo ve/edita el superadmin.
    if (cajaEls.accRespWrap) cajaEls.accRespWrap.style.display = isSuper ? "flex" : "none";
    if (isSuper) await cajaPopulateRespSelect(acc ? acc.responsable_user_id : null);
    // Borrar caja: solo superadmin y solo al editar. El server igual bloquea
    // si la caja tiene movimientos o cobros/pagos/gastos vinculados.
    const delBtn = document.getElementById("caja-acc-delete-btn");
    if (delBtn) delBtn.hidden = !(isSuper && acc);
    cajaEls.accModal.hidden = false;
    if (cajaEls.accName) cajaEls.accName.focus();
  }

  // Borrar caja (solo superadmin, desde el modal de edición)
  const cajaAccDeleteBtn = document.getElementById("caja-acc-delete-btn");
  if (cajaAccDeleteBtn) {
    cajaAccDeleteBtn.addEventListener("click", async () => {
      const editId = cajaState.editAccountId;
      if (!editId) return;
      const acc = cajaState.accounts.find((a) => Number(a.id) === Number(editId));
      const ok = await confirmModal({
        message: "¿Borrar la caja \"" + ((acc && acc.name) || "#" + editId) + "\"?\nSolo se puede borrar si no tiene movimientos ni cobros/pagos/gastos vinculados.",
        confirmText: "Borrar caja",
        danger: true,
      });
      if (!ok) return;
      try {
        cajaAccDeleteBtn.disabled = true;
        await api("/api/admin/caja/accounts/" + editId, { method: "DELETE" });
        if (cajaEls.accModal) cajaEls.accModal.hidden = true;
        state.cajasList = null;
        showToast("Caja borrada");
        await loadCaja();
      } catch (e) {
        alertModal(e.message || "No se pudo borrar la caja");
      } finally {
        cajaAccDeleteBtn.disabled = false;
      }
    });
  }

  // Botón "+ Nueva cuenta" (solo superadmin)
  if (cajaEls.addAccountBtn) {
    cajaEls.addAccountBtn.addEventListener("click", () => cajaOpenAccountModal(null));
  }

  // Click en una tarjeta de caja → editar
  if (cajaEls.accountsWrap) {
    cajaEls.accountsWrap.addEventListener("click", (e) => {
      const card = e.target.closest("[data-caja-edit]");
      if (!card) return;
      const acc = cajaState.accounts.find((a) => String(a.id) === card.dataset.cajaEdit);
      if (acc) cajaOpenAccountModal(acc);
    });
  }

  // Guardar cuenta (crear o editar)
  if (cajaEls.accSaveBtn) {
    cajaEls.accSaveBtn.addEventListener("click", async () => {
      const name = cajaEls.accName ? cajaEls.accName.value.trim() : "";
      const type = cajaEls.accType ? cajaEls.accType.value : "efectivo";
      if (!name) { alertModal("Ingresá un nombre para la cuenta."); return; }
      const editId = cajaState.editAccountId;
      const body = { name, type };
      // El responsable solo se manda si el superadmin lo editó.
      if (cajaIsSuper() && cajaEls.accResp) {
        body.responsable_user_id = cajaEls.accResp.value ? Number(cajaEls.accResp.value) : null;
      }
      // Toda caja NUEVA debe tener responsable (el server también lo exige).
      if (!editId && !body.responsable_user_id) {
        alertModal("Toda caja debe tener un responsable. Elegí uno en el selector.");
        return;
      }
      if (editId && cajaEls.accActive) body.active = cajaEls.accActive.checked;
      try {
        cajaEls.accSaveBtn.disabled = true;
        if (editId) {
          await api("/api/admin/caja/accounts/" + editId, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
        } else {
          await api("/api/admin/caja/accounts", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
        }
        if (cajaEls.accModal) cajaEls.accModal.hidden = true;
        state.cajasList = null; // invalidar cache de selectores de cobro
        showToast(editId ? "Cuenta actualizada" : "Cuenta creada");
        await loadCaja();
      } catch (e) {
        alertModal(e.message || "Error");
      } finally {
        cajaEls.accSaveBtn.disabled = false;
      }
    });
  }

  // ─────── Buscador de la pestaña Ventas (pedidos entregados) ───────
  if (els.ventasSearch) els.ventasSearch.addEventListener("input", debounce(renderVentasOrders, 150));
  if (els.ventasClient) els.ventasClient.addEventListener("change", renderVentasOrders);
  if (els.ventasPaid) els.ventasPaid.addEventListener("change", renderVentasOrders);
  if (els.ventasReload) els.ventasReload.addEventListener("click", loadVentasOrders);
  if (els.ventasRange) els.ventasRange.addEventListener("change", () => {
    state.ventasRangeInit = true; // ya no pisar con el default
    setVentasRangeDates(els.ventasRange.value);
    loadVentasOrders();
  });
  // Si el usuario toca las fechas a mano, el período pasa a "Personalizado".
  if (els.ventasFrom) els.ventasFrom.addEventListener("change", () => {
    if (els.ventasRange) els.ventasRange.value = "custom";
    state.ventasRangeInit = true;
    loadVentasOrders();
  });
  if (els.ventasTo) els.ventasTo.addEventListener("change", () => {
    if (els.ventasRange) els.ventasRange.value = "custom";
    state.ventasRangeInit = true;
    loadVentasOrders();
  });
  if (els.ventasClearDates) els.ventasClearDates.addEventListener("click", () => {
    if (els.ventasRange) els.ventasRange.value = "all";
    state.ventasRangeInit = true;
    if (els.ventasFrom) els.ventasFrom.value = "";
    if (els.ventasTo) els.ventasTo.value = "";
    loadVentasOrders();
  });

  // ─────── Fin PRESUPUESTOS / VENTAS ───────

  // ============ CUENTA CORRIENTE PROVEEDORES ============
  const supEls = {
    kpis: document.getElementById("supacc-kpis"),
    search: document.getElementById("supacc-search"),
    onlyDebtors: document.getElementById("supacc-only-debtors"),
    count: document.getElementById("supacc-count"),
    tbody: document.getElementById("supacc-tbody"),
    reloadBtn: document.getElementById("supacc-reload-btn"),
    payBtn: document.getElementById("supacc-pay-btn"),
    payModal: document.getElementById("sup-payment-modal"),
    payForm: document.getElementById("sup-payment-form"),
    payMsg: document.getElementById("sup-payment-msg"),
    paySupplier: document.getElementById("sup-pay-supplier"),
  };
  const supState = { list: [], loaded: false };

  async function loadSupplierAccounts() {
    if (!supEls.tbody) return;
    try {
      supEls.tbody.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
      supState.list = await api("/api/admin/supplier-accounts");
      supState.loaded = true;
      renderSupplierAccounts();
    } catch (e) {
      supEls.tbody.innerHTML = '<tr><td colspan="6" class="muted">Error cargando cuentas</td></tr>';
    }
  }

  function renderSupplierAccountsKpis() {
    if (!supEls.kpis) return;
    let totalDebt = 0, debtors = 0, oldestDays = 0;
    supState.list.forEach((a) => {
      const b = Number(a.balance) || 0;
      if (b > 0.0001) { totalDebt += b; debtors++; if (a.days_overdue != null && a.days_overdue > oldestDays) oldestDays = a.days_overdue; }
    });
    const avg = debtors ? Math.round(totalDebt / debtors) : 0;
    const card = (cls, label, value, sub) =>
      '<div class="dash-kpi ' + cls + '"><div class="dash-kpi-label">' + label + '</div>' +
      '<div class="dash-kpi-value">' + value + '</div>' +
      (sub ? '<div class="dash-kpi-sub">' + sub + '</div>' : '') + '</div>';
    supEls.kpis.innerHTML =
      card("dash-kpi-danger", "Total a pagar", fmtPrice(totalDebt), debtors + (debtors === 1 ? " proveedor" : " proveedores")) +
      card("dash-kpi-warn", "Deuda promedio", fmtPrice(avg), "por proveedor con deuda") +
      card("dash-kpi-accent", "Deuda más antigua", (oldestDays ? oldestDays + " días" : "—"), "sin saldar");
  }

  function supAccFiltered() {
    const q = (supEls.search ? supEls.search.value : "").trim().toLowerCase();
    let list = supState.list.slice();
    if (q) list = list.filter((a) => matchWords(a.name, q));
    if (supEls.onlyDebtors && supEls.onlyDebtors.checked) list = list.filter((a) => (Number(a.balance) || 0) > 0.0001);
    list.sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0));
    return list;
  }

  function renderSupplierAccounts() {
    if (!supEls.tbody) return;
    renderSupplierAccountsKpis();
    const list = supAccFiltered();
    if (supEls.count) supEls.count.textContent = list.length + (list.length === 1 ? " proveedor" : " proveedores");
    if (!list.length) { supEls.tbody.innerHTML = '<tr><td colspan="6" class="muted">Sin proveedores.</td></tr>'; return; }
    supEls.tbody.innerHTML = list.map(supAccRowHtml).join("");
    supEls.tbody.querySelectorAll("tr.acc-row").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".acc-pay-btn")) return;
        toggleSupAccDetail(tr);
      });
    });
    supEls.tbody.querySelectorAll(".acc-pay-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); openSupplierPayment(Number(btn.dataset.id)); });
    });
  }

  function supAccRowHtml(a) {
    const debt = Number(a.balance) || 0;
    const owe = debt > 0.0001;
    const balClass = owe ? "acc-balance-neg" : "acc-balance-pos";
    const balLabel = owe ? "Debe: " + fmtPrice(debt) : (debt < -0.0001 ? "A favor: " + fmtPrice(-debt) : "Saldado");
    const aging = owe ? accAgingBucket(a.days_overdue) : { label: "—", cls: "" };
    const agingTitle = owe && a.oldest_unpaid_at ? ' title="Compra más vieja sin saldar: ' + escapeHtml(formatDate(a.oldest_unpaid_at)) + '"' : "";
    return '<tr class="acc-row' + (owe ? ' acc-row-debt' : '') + '" data-id="' + a.id + '" style="cursor:pointer">' +
      '<td>' + escapeHtml(a.name || "") + '</td>' +
      '<td class="num muted">' + fmtPrice(a.total_debit) + '</td>' +
      '<td class="num muted">' + fmtPrice(a.total_credit) + '</td>' +
      '<td class="num"><span class="acc-balance-badge ' + balClass + '">' + balLabel + '</span></td>' +
      '<td class="num"' + agingTitle + '><span class="acc-age ' + aging.cls + '">' + aging.label + '</span></td>' +
      '<td class="acc-actions"><button type="button" class="btn-mini acc-pay-btn" data-id="' + a.id + '">💵 Pagar</button></td>' +
    '</tr>' +
    '<tr class="acc-detail-row" data-for="' + a.id + '" hidden>' +
      '<td colspan="6" class="acc-detail-cell"><span class="muted">Cargando historial…</span></td>' +
    '</tr>';
  }

  async function toggleSupAccDetail(tr) {
    const id = Number(tr.dataset.id);
    const detailRow = supEls.tbody.querySelector('tr.acc-detail-row[data-for="' + id + '"]');
    if (!detailRow) return;
    if (!detailRow.hidden) { detailRow.hidden = true; return; }
    detailRow.hidden = false;
    if (detailRow.dataset.loaded) return;
    const cell = detailRow.querySelector(".acc-detail-cell");
    try {
      const data = await api("/api/admin/supplier-accounts/" + id);
      detailRow.dataset.loaded = "1";
      const movs = data.movements || [];
      if (!movs.length) { cell.innerHTML = '<p class="muted">Sin movimientos.</p>'; return; }
      // running de deuda: de más antiguo a más reciente, luego se invierte
      let running = 0;
      const sorted = movs.slice().reverse();
      const rows = sorted.map((m) => { running += (m.type === "debit" ? m.amount : -m.amount); return { m: m, running: running }; }).reverse();
      cell.innerHTML =
        '<table class="acc-mov-table"><thead><tr>' +
        '<th>Fecha</th><th>Tipo</th><th>Descripción</th><th class="num">Monto</th><th class="num">Deuda</th><th></th>' +
        '</tr></thead><tbody>' +
        rows.map(function (o) {
          const m = o.m, rb = o.running;
          const isDebit = m.type === "debit";
          const typeLabel = isDebit ? "Compra" : "Pago";
          const typeClass = isDebit ? "acc-debit" : "acc-credit";
          const delBtn = (!isDebit && m.supplier_payment_id)
            ? '<button type="button" class="btn-mini sup-mov-del" data-pay="' + m.supplier_payment_id + '" title="Eliminar pago">🗑</button>' : '';
          return '<tr>' +
            '<td class="muted small-cell">' + formatDate(m.created_at) + '</td>' +
            '<td><span class="' + typeClass + '">' + typeLabel + '</span></td>' +
            '<td>' + escapeHtml(m.description || "—") + '</td>' +
            '<td class="num">' + fmtPrice(m.amount) + '</td>' +
            '<td class="num">' + fmtPrice(Math.max(0, rb)) + '</td>' +
            '<td class="num">' + delBtn + '</td>' +
          '</tr>';
        }).join("") +
        '</tbody></table>';
      cell.querySelectorAll(".sup-mov-del").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!await confirmModal({ message: "¿Eliminar este pago? Se revierte la deuda y el egreso de caja.", confirmText: "Eliminar", danger: true })) return;
          try {
            await api("/api/admin/supplier-payments/" + Number(btn.dataset.pay), { method: "DELETE" });
            showToast("Pago eliminado");
            loadSupplierAccounts();
          } catch (err) { showToast("Error: " + err.message, true); }
        });
      });
    } catch (err) {
      cell.innerHTML = '<span class="muted err">Error: ' + escapeHtml(err.message) + '</span>';
    }
  }

  function populateSupPayForm(preselectId) {
    if (!supEls.paySupplier) return;
    const list = (supState.list || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    supEls.paySupplier.innerHTML = '<option value="">Seleccionar proveedor…</option>' +
      list.map((s) => '<option value="' + s.id + '">' + escapeHtml(s.name || "") + '</option>').join("");
    if (preselectId) supEls.paySupplier.value = String(preselectId);
  }

  function openSupplierPayment(supplierId) {
    if (supEls.payForm) supEls.payForm.reset();
    if (supEls.payMsg) supEls.payMsg.textContent = "";
    populateSupPayForm(supplierId);
    fillCajaSelect(document.getElementById("sup-pay-caja"), null);
    const a = supState.list.find((x) => x.id === supplierId);
    const amtInput = supEls.payForm ? supEls.payForm.querySelector('[name="amount"]') : null;
    attachMoneyInput(amtInput);
    if (amtInput && a && Number(a.balance) > 0) setMoney(amtInput, Math.round(Number(a.balance)));
    if (supEls.payModal) supEls.payModal.hidden = false;
  }

  if (supEls.payBtn) supEls.payBtn.addEventListener("click", () => openSupplierPayment(null));
  if (supEls.reloadBtn) supEls.reloadBtn.addEventListener("click", loadSupplierAccounts);
  if (supEls.search) supEls.search.addEventListener("input", debounce(renderSupplierAccounts, 150));
  if (supEls.onlyDebtors) supEls.onlyDebtors.addEventListener("change", renderSupplierAccounts);

  if (supEls.payForm) {
    attachMoneyInput(supEls.payForm.querySelector('[name="amount"]'));
    supEls.payForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(supEls.payForm);
      const body = {
        supplier_id: Number(fd.get("supplier_id")),
        amount: parseMoney(fd.get("amount")),
        method: fd.get("method"),
        caja_id: fd.get("caja_id") || null,
        reference: fd.get("reference"),
        notes: fd.get("notes"),
      };
      if (!body.supplier_id || !body.amount) {
        if (supEls.payMsg) { supEls.payMsg.textContent = "Completá proveedor y monto."; supEls.payMsg.className = "config-msg err"; }
        return;
      }
      if (supEls.payMsg) { supEls.payMsg.textContent = "Guardando…"; supEls.payMsg.className = "config-msg"; }
      try {
        const out = await api("/api/admin/supplier-payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (supEls.payModal) supEls.payModal.hidden = true;
        showToast("Pago registrado: " + fmtPrice(out.payment.amount));
        loadSupplierAccounts();
      } catch (err) {
        if (supEls.payMsg) { supEls.payMsg.textContent = err.message; supEls.payMsg.className = "config-msg err"; }
      }
    });
  }
  // ============ Fin CUENTA CORRIENTE PROVEEDORES ============

  bootstrap();
})();
