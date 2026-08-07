/**
 * Maxaria — Ventas / Presupuestos
 *
 * Pagina independiente del catalogo (/ventas). Extraida del overlay que vivia
 * en index.html para que tenga su propia URL y su propio scroll.
 */
(function () {
  "use strict";

  // ── Estado global mínimo ──
  const me = { app_name: "Maxaria", level: 0, fullName: "", id: 0, vendedorClientId: null };

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

  // ── Carga inicial de info del usuario ──
  async function loadMe() {
    try {
      const r = await fetch("/api/me");
      if (r.ok) {
        const data = await r.json();
        me.app_name = data.app_name || "Maxaria";
        me.level    = Number(data.level) || 0;
        me.fullName = data.fullName || data.username || "";
        me.id       = Number(data.id) || 0;
        // Cliente que el vendedor está atendiendo (elegido en el catálogo,
        // guardado en sesión y devuelto por /api/me como vendedorClient).
        me.vendedorClientId = data.vendedorClient && data.vendedorClient.id
          ? Number(data.vendedorClient.id) : null;
        // Actualizar topbar
        const brand = document.getElementById("topbar-brand-name");
        if (brand) brand.textContent = (me.app_name || "Maxaria");
        document.title = (me.app_name || "Maxaria") + " — Ventas";
        const info = document.getElementById("user-info");
        if (info) {
          const lvl = data.levelName || "";
          info.textContent = me.fullName ? (me.fullName + (lvl ? " · " + lvl : "")) : lvl;
        }
      }
    } catch (_) {}
  }

  // ── Logout ──
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try { await fetch("/logout", { method: "POST" }); } catch (_) {}
      window.location.href = "/login";
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRESUPUESTOS
  // ─────────────────────────────────────────────────────────────────────────

  const vEls = {
    listView:      document.getElementById("budget-list-view"),
    formView:      document.getElementById("budget-form-view"),
    formTitle:     document.getElementById("budget-form-title"),
    formNumber:    document.getElementById("budget-form-number"),
    statusBadge:   document.getElementById("budget-status-badge"),
    backBtn:       document.getElementById("budget-back-btn"),
    search:        document.getElementById("budget-search"),
    filterStatus:  document.getElementById("budget-filter-status"),
    pendingBanner: document.getElementById("budget-pending-banner"),
    newBtn:        document.getElementById("new-budget-btn"),
    tbody:         document.getElementById("budgets-tbody"),
    form:          document.getElementById("budget-form"),
    client:        document.getElementById("budget-client"),
    priceList:     document.getElementById("budget-price-list"),
    priceListHint: document.getElementById("budget-price-list-hint"),
    payment:       document.getElementById("budget-payment"),
    itemsTbody:    document.getElementById("budget-items-tbody"),
    notes:         document.getElementById("budget-notes"),
    subtotalDisp:  document.getElementById("budget-subtotal-disp"),
    discount:      document.getElementById("budget-discount"),
    discountDisp:  document.getElementById("budget-discount-disp"),
    surcharge:     document.getElementById("budget-surcharge"),
    surchargeDisp: document.getElementById("budget-surcharge-disp"),
    totalDisp:     document.getElementById("budget-total-disp"),
    printBtn:      document.getElementById("budget-print-btn"),
    cancelBtn:     document.getElementById("budget-cancel-btn"),
    acceptBtn:     document.getElementById("budget-accept-btn"),
    invoiceBtn:    document.getElementById("budget-invoice-btn"),
    saveDraftBtn:  document.getElementById("budget-save-draft-btn"),
    sendBtn:       document.getElementById("budget-send-btn"),
    addProductBtn: document.getElementById("budget-add-product-btn"),
    picker:        document.getElementById("product-picker-modal"),
    pickerClose:   document.getElementById("picker-close-btn"),
    pickerCancel:  document.getElementById("picker-cancel-btn"),
    pickerSearch:  document.getElementById("picker-search"),
    pickerNoStockWrap: document.getElementById("picker-nostock-wrap"),
    pickerShowNoStock: document.getElementById("picker-show-nostock"),
    pickerCheckAll:document.getElementById("picker-check-all"),
    pickerTbody:   document.getElementById("picker-tbody"),
    pickerCount:   document.getElementById("picker-selected-count"),
    pickerConfirm: document.getElementById("picker-confirm-btn"),
    shareBtn:         document.getElementById("budget-share-btn"),
    quickClientBtn:   document.getElementById("quick-client-btn"),
    quickClientModal: document.getElementById("quick-client-modal"),
    qcName:           document.getElementById("qc-name"),
    qcPhone:          document.getElementById("qc-phone"),
    qcPriceList:      document.getElementById("qc-price-list"),
    qcCancelBtn:      document.getElementById("qc-cancel-btn"),
    qcSaveBtn:        document.getElementById("qc-save-btn"),
  };

  const vState = {
    list: [],
    loaded: false,
    editingId: null,
    editingStatus: "borrador",
    items: [],
    allProducts: [],
    productsLoaded: false,
    // Clientes crudos de /api/clients (con price_list_id) para defaultear la lista.
    clientsRaw: [],
    // Opciones del selector de lista de precios (/api/price-options).
    priceOptions: null,
    priceOptionsLoaded: false,
    // Base de precios elegida: "base:<nivel>" o "list:<id>". Define qué precio
    // muestra el picker y con qué se recalculan los ítems.
    pricing: "base:minorista",
    // Base con la que se cargó allProducts (para refrescar el picker al cambiar).
    pricedFor: null,
    // Si el picker muestra también los productos sin stock (solo admin).
    pickerShowNoStock: false,
    // Map<pid, qty>: productos seleccionados en el picker con su cantidad.
    // El usuario puede tildar el checkbox (qty=1 por default) o tipear una
    // cantidad directamente en la columna "Cant." (eso marca el checkbox).
    pickerSelected: new Map(),
    pickerReplaceIdx: null,   // si != null, el picker reemplaza ese item en vez de agregar
  };

  const V_STATUS_LABELS = { borrador:"Borrador", enviado:"Enviado", aceptado:"Aceptado", facturado:"Facturado", cancelado:"Cancelado" };
  const V_STATUS_BADGE  = { borrador:"budget-badge--borrador", enviado:"budget-badge--enviado", aceptado:"budget-badge--aceptado", facturado:"budget-badge--facturado", cancelado:"budget-badge--cancelado" };

  function vFmt(n) { return "$" + (Number(n)||0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // Precios con 2 decimales (centavos). round2 redondea importes.
  function vRound2(v) { const n = Number(v); return isFinite(n) ? Math.round(n*100)/100 : 0; }
  function vFmtN(n) { return (Number(n)||0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function vEsc(s) { return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function vFmtDate(s) {
    if (!s) return "";
    const d = new Date(s.replace(" ","T")+"Z");
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
  }

  function vBadgeHtml(status) {
    return '<span class="budget-badge ' + (V_STATUS_BADGE[status]||"") + '">' + vEsc(V_STATUS_LABELS[status]||status) + '</span>';
  }

  // ── Lista de precios (base de precios del presupuesto) ──
  const V_LEVEL_BASE = { 1: "minorista", 2: "revendedor", 3: "mayorista", 4: "vip" };

  function vClientById(id) {
    return (vState.clientsRaw || []).find((c) => Number(c.id) === Number(id)) || null;
  }

  // Base de precios que le corresponde por default a un cliente: su lista
  // personalizada si tiene una activa, sino el nivel del cliente. Sin cliente
  // (consumidor final) cae a minorista.
  function vDefaultPricingForClient(clientId) {
    if (!clientId) return "base:minorista";
    const c = vClientById(clientId);
    if (!c) return "base:minorista";
    if (c.price_list_id) return "list:" + c.price_list_id;
    return "base:" + (V_LEVEL_BASE[Number(c.level)] || "minorista");
  }

  // Querystring para /api/products según la base elegida.
  function vPricingQuery() {
    const p = vState.pricing || "";
    if (p.indexOf("list:") === 0) return "?as_list_id=" + encodeURIComponent(p.slice(5));
    if (p.indexOf("base:") === 0) return "?as_base=" + encodeURIComponent(p.slice(5));
    return "";
  }

  async function vLoadPriceOptions() {
    if (vState.priceOptionsLoaded) return;
    try {
      const r = await fetch("/api/price-options");
      if (!r.ok) throw new Error("Error " + r.status);
      const data = await r.json();
      if (data) {
        vState.priceOptions = data;
        vState.priceOptionsLoaded = true;
        vBuildPriceListSelect();
      }
    } catch (err) {
      vToast("No se pudieron cargar las listas de precios: " + (err.message || "error"), true);
    }
  }

  function vBuildPriceListSelect() {
    if (!vEls.priceList || !vState.priceOptions) return;
    const { levels, lists } = vState.priceOptions;
    let html = '<optgroup label="Niveles">' +
      (levels || []).map((o) => '<option value="' + o.value + '">' + vEsc(o.label) + '</option>').join("") +
      '</optgroup>';
    if (lists && lists.length) {
      html += '<optgroup label="Listas personalizadas">' +
        lists.map((o) => '<option value="' + o.value + '">' + vEsc(o.label) + '</option>').join("") +
        '</optgroup>';
    }
    vEls.priceList.innerHTML = html;
  }

  // Setea el selector + estado sin recalcular ítems (usado al abrir el form).
  function vSetPricing(value) {
    vState.pricing = value || "base:minorista";
    if (vEls.priceList) {
      vEls.priceList.value = vState.pricing;
      // Si el value no existe (lista borrada/inactiva), caer a minorista.
      if (vEls.priceList.value !== vState.pricing) {
        vEls.priceList.value = "base:minorista";
        vState.pricing = vEls.priceList.value || "base:minorista";
      }
    }
    vUpdatePricingHint();
  }

  function vUpdatePricingHint() {
    if (!vEls.priceListHint) return;
    const clientId = vEls.client && vEls.client.value ? Number(vEls.client.value) : null;
    let txt;
    if (!clientId) {
      txt = "Consumidor final — elegí la base de precios.";
    } else {
      const c = vClientById(clientId);
      if (c && c.price_list_id) txt = "El cliente tiene asignada la lista: " + (c.price_list_name || ("#" + c.price_list_id)) + ".";
      else if (c) txt = "El cliente usa precios de nivel: " + (c.levelName || "") + ".";
      else txt = "";
    }
    if (clientId && vState.pricing !== vDefaultPricingForClient(clientId)) {
      txt += " (Modificado para este presupuesto)";
    }
    vEls.priceListHint.textContent = txt;
  }

  // Recalcula unit_price de todos los ítems con producto según la base actual.
  async function vRepriceItems() {
    if (!vState.items.length) return;
    await vLoadProducts(); // garantiza allProducts con la base actual
    const byId = new Map(vState.allProducts.map((p) => [p.id, p]));
    vState.items.forEach((it) => {
      if (!it.product_id) return;
      const p = byId.get(it.product_id);
      if (p && p.price != null) {
        it.unit_price = Number(p.price) || 0;
        it.subtotal = vRound2((Number(it.quantity) || 1) * it.unit_price * (1 - (Number(it.discount_percent) || 0) / 100));
      }
    });
    vRenderItems();
  }

  // Aplica el cambio de base: actualiza estado/hint, invalida el cache del
  // picker y (si se pide y hay ítems) recalcula precios previa confirmación.
  async function vApplyPricing(opts) {
    opts = opts || {};
    vState.pricing = (vEls.priceList && vEls.priceList.value) || "base:minorista";
    vUpdatePricingHint();
    if (opts.reprice && vState.items.length) {
      const ok = await vConfirm(
        "Los precios que hayas editado a mano se van a reemplazar por los de esta lista.",
        { title: "¿Recalcular precios?", okText: "Recalcular", cancelText: "No, dejar como está" }
      );
      if (ok) await vRepriceItems();
    }
  }

  // Toast efímero para confirmar acciones (guardado, error). Autocontenido:
  // crea el nodo una vez y lo reutiliza, sin depender de CSS externo.
  function vToast(msg, isError) {
    let t = document.getElementById("ventas-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "ventas-toast";
      t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
        "color:#fff;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;" +
        "box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:2000;opacity:0;" +
        "transition:opacity .2s ease;pointer-events:none";
      document.body.appendChild(t);
    }
    t.style.background = isError ? "#dc2626" : "#16a34a";
    t.textContent = msg;
    requestAnimationFrame(() => { t.style.opacity = "1"; });
    clearTimeout(t._hideT);
    t._hideT = setTimeout(() => { t.style.opacity = "0"; }, 1800);
  }

  // Confirmación propia (modal in-app) que reemplaza al confirm() nativo del
  // navegador (que muestra el dominio y no se puede estilar). Devuelve una
  // Promise<boolean>. opts: { title, okText, cancelText, danger }.
  // Regla del proyecto: los modales NO se cierran al clickear afuera.
  const vConfEls = {
    modal:  document.getElementById("ventas-confirm-modal"),
    title:  document.getElementById("ventas-confirm-title"),
    msg:    document.getElementById("ventas-confirm-msg"),
    ok:     document.getElementById("ventas-confirm-ok"),
    cancel: document.getElementById("ventas-confirm-cancel"),
  };
  let vConfResolve = null;
  function vCloseConfirm(result) {
    if (vConfEls.modal) vConfEls.modal.hidden = true;
    const r = vConfResolve; vConfResolve = null;
    if (r) r(result);
  }
  function vConfirm(message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      // Fallback al confirm nativo si el modal no está en el DOM.
      if (!vConfEls.modal) { resolve(window.confirm(message)); return; }
      // Si había una confirmación abierta, resolvela como cancelada.
      if (vConfResolve) { const prev = vConfResolve; vConfResolve = null; prev(false); }
      vConfEls.title.textContent  = opts.title || "Confirmar";
      vConfEls.msg.textContent    = message || "";
      vConfEls.ok.textContent     = opts.okText || "Aceptar";
      vConfEls.cancel.textContent = opts.cancelText || "Cancelar";
      vConfEls.ok.className = "btn btn-primary";
      vConfEls.ok.style.cssText = opts.danger
        ? "background:#dc2626;border-color:#dc2626;color:#fff"
        : "";
      vConfResolve = resolve;
      vConfEls.modal.hidden = false;
      try { vConfEls.ok.focus(); } catch (_) {}
    });
  }
  // Aviso propio (un solo botón) reusando el mismo modal: oculta Cancelar.
  // Reemplaza al alert() nativo (que muestra el dominio).
  function vAlert(message, opts) {
    opts = opts || {};
    if (!vConfEls.modal) { window.alert(message); return Promise.resolve(); }
    const p = vConfirm(message, { title: opts.title || "Aviso", okText: opts.okText || "Aceptar" });
    if (vConfEls.cancel) vConfEls.cancel.hidden = true;
    return p.then((r) => { if (vConfEls.cancel) vConfEls.cancel.hidden = false; return r; });
  }
  if (vConfEls.ok)     vConfEls.ok.addEventListener("click", () => vCloseConfirm(true));
  if (vConfEls.cancel) vConfEls.cancel.addEventListener("click", () => vCloseConfirm(false));
  // Teclado: Enter confirma, Esc cancela (mientras el modal está abierto).
  document.addEventListener("keydown", (e) => {
    if (!vConfEls.modal || vConfEls.modal.hidden || !vConfResolve) return;
    if (e.key === "Escape") { e.preventDefault(); vCloseConfirm(false); }
    else if (e.key === "Enter") { e.preventDefault(); vCloseConfirm(true); }
  });

  function vUpdateStatusUI() {
    const st = vState.editingStatus;
    if (vEls.statusBadge) {
      vEls.statusBadge.className = "budget-badge " + (V_STATUS_BADGE[st]||"budget-badge--borrador");
      vEls.statusBadge.textContent = V_STATUS_LABELS[st]||st;
    }
    // Solo 'facturado' y 'cancelado' bloquean la edición. Un presupuesto
    // 'aceptado' se puede seguir corrigiendo (cantidades, precios, etc.) antes
    // de facturar; sino se puede tipear pero no guardar.
    const isFinal = st === "cancelado" || st === "facturado";
    [vEls.saveDraftBtn, vEls.sendBtn, vEls.addProductBtn, vEls.discount, vEls.surcharge].forEach((el) => { if (el) el.disabled = isFinal; });
    if (vEls.cancelBtn)  vEls.cancelBtn.hidden  = isFinal;
    if (vEls.acceptBtn)  vEls.acceptBtn.hidden  = st === "aceptado" || st === "cancelado" || st === "facturado";
    if (vEls.invoiceBtn) vEls.invoiceBtn.hidden = st !== "aceptado";
  }

  function vRecalc() {
    let subtotal = 0;
    vState.items.forEach((it) => {
      it.subtotal = vRound2((Number(it.quantity)||1) * (Number(it.unit_price)||0) * (1 - (Number(it.discount_percent)||0)/100));
      subtotal += it.subtotal;
    });
    subtotal = vRound2(subtotal);
    const discPct = Number(vEls.discount ? vEls.discount.value : 0)||0;
    const surPct  = Number(vEls.surcharge ? vEls.surcharge.value : 0)||0;
    const afterDisc = vRound2(subtotal * (1 - discPct/100));
    const total = vRound2(afterDisc * (1 + surPct/100));
    if (vEls.subtotalDisp)  vEls.subtotalDisp.textContent  = vFmt(subtotal);
    if (vEls.discountDisp)  vEls.discountDisp.textContent  = discPct  > 0 ? "— " + vFmt(subtotal - afterDisc) : "— $0";
    if (vEls.surchargeDisp) vEls.surchargeDisp.textContent = surPct   > 0 ? "+ " + vFmt(total - afterDisc)    : "+ $0";
    if (vEls.totalDisp)     vEls.totalDisp.textContent     = vFmt(total);
  }

  function vRenderItems() {
    if (!vEls.itemsTbody) return;
    if (!vState.items.length) {
      vEls.itemsTbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:18px;font-style:italic">Sin artículos. Usá "+ Agregar productos" para empezar.</td></tr>';
      vRecalc();
      return;
    }
    vEls.itemsTbody.innerHTML = vState.items.map((it, idx) => {
      // Código y nombre van como texto (vienen del picker, no se editan acá).
      // En mobile la fila se reorganiza vía CSS para que el nombre ocupe
      // toda la línea y los inputs vayan debajo (ver .ventas-items-table
      // en mobile en styles.css).
      return '<tr data-idx="' + idx + '" class="ventas-item-row">' +
        '<td class="vit-code" title="' + vEsc(it.product_code) + '">' + vEsc(it.product_code) + '</td>' +
        '<td class="vit-name" title="' + vEsc(it.product_name) + '">' + vEsc(it.product_name) + '</td>' +
        '<td class="vit-qty" style="text-align:right"><input type="number" value="' + Math.round(it.quantity) + '" min="1" step="1" inputmode="numeric" data-field="quantity" style="width:60px;text-align:right" /></td>' +
        '<td class="vit-price" style="text-align:right"><input type="number" value="' + vEsc(it.unit_price) + '" min="0" step="0.01" inputmode="decimal" data-field="unit_price" style="width:90px;text-align:right" /></td>' +
        '<td class="vit-disc" style="text-align:right"><input type="number" value="' + vEsc(it.discount_percent) + '" min="0" max="100" step="0.5" inputmode="decimal" data-field="discount_percent" style="width:58px;text-align:right" /></td>' +
        '<td class="vit-sub" style="text-align:right;font-weight:500">' + vEsc(vFmt(it.subtotal||0)) + '</td>' +
        '<td class="vit-del" style="text-align:center"><button type="button" data-del-idx="' + idx + '" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px" title="Eliminar">✕</button></td>' +
      '</tr>';
    }).join("");
    // En estados finales (facturado/cancelado) no se debe poder editar items.
    if (vState.editingStatus === "facturado" || vState.editingStatus === "cancelado") {
      vEls.itemsTbody.querySelectorAll("input, button").forEach((el) => { el.disabled = true; });
    }
    vRecalc();
  }

  if (vEls.itemsTbody) {
    // input: actualiza state pero NO reescribe el valor del input. Esto
    // permite que el usuario borre el contenido sin que el "1" vuelva
    // automáticamente y bloquee la edición.
    vEls.itemsTbody.addEventListener("input", (e) => {
      const tr = e.target.closest("tr[data-idx]");
      if (!tr) return;
      const idx = Number(tr.dataset.idx);
      const field = e.target.dataset.field;
      if (!field || idx >= vState.items.length) return;
      const raw = e.target.value;
      if (field === "quantity") {
        // Mientras el input está vacío, no actualizamos quantity (queda el
        // valor previo en state). Al hacer blur o change normalizamos.
        if (raw === "") return;
        const n = Math.max(1, Math.round(Number(raw) || 0));
        vState.items[idx][field] = n;
      } else {
        // unit_price / discount_percent: permitir vacío (cuenta como 0)
        vState.items[idx][field] = Number(raw) || 0;
      }
      const it = vState.items[idx];
      it.subtotal = vRound2((Number(it.quantity)||1)*(Number(it.unit_price)||0)*(1-(Number(it.discount_percent)||0)/100));
      // Actualizar el subtotal en la celda .vit-sub (puede no ser el 5to td
      // si el CSS responsive reordena con order, pero la búsqueda por clase
      // sigue funcionando).
      const subCell = tr.querySelector(".vit-sub");
      if (subCell) subCell.textContent = vFmt(it.subtotal);
      vRecalc();
    });

    // change/blur: normaliza el valor para que no quede vacío al salir.
    vEls.itemsTbody.addEventListener("change", (e) => {
      const tr = e.target.closest("tr[data-idx]");
      if (!tr) return;
      const idx = Number(tr.dataset.idx);
      const field = e.target.dataset.field;
      if (!field || idx >= vState.items.length) return;
      if (field === "quantity") {
        const n = Math.max(1, Math.round(Number(e.target.value) || 1));
        vState.items[idx][field] = n;
        e.target.value = String(n);
      } else if (field === "unit_price" || field === "discount_percent") {
        const n = Math.max(0, Number(e.target.value) || 0);
        vState.items[idx][field] = n;
        if (e.target.value === "") e.target.value = "0";
      }
      const it = vState.items[idx];
      it.subtotal = vRound2((Number(it.quantity)||1)*(Number(it.unit_price)||0)*(1-(Number(it.discount_percent)||0)/100));
      const subCell = tr.querySelector(".vit-sub");
      if (subCell) subCell.textContent = vFmt(it.subtotal);
      vRecalc();
    });

    // focusin: seleccionar todo el contenido del input para sobrescribir
    // sin tener que borrar manualmente.
    vEls.itemsTbody.addEventListener("focusin", (e) => {
      if (e.target.tagName === "INPUT" && e.target.dataset.field) {
        try { e.target.select(); } catch (_) {}
      }
    });

    vEls.itemsTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-idx]");
      if (!btn) return;
      vState.items.splice(Number(btn.dataset.delIdx), 1);
      vRenderItems();
    });
  }
  if (vEls.discount)  vEls.discount.addEventListener("input",  vRecalc);
  if (vEls.surcharge) vEls.surcharge.addEventListener("input", vRecalc);

  // Al cambiar el cliente: defaultear la base de precios a la del cliente y
  // ofrecer recalcular los ítems ya cargados.
  if (vEls.client) {
    vEls.client.addEventListener("change", async () => {
      vSetPricing(vDefaultPricingForClient(vEls.client.value ? Number(vEls.client.value) : null));
      await vApplyPricing({ reprice: true });
    });
  }
  // Al cambiar la lista manualmente: aplicar y ofrecer recalcular.
  if (vEls.priceList) {
    vEls.priceList.addEventListener("change", async () => {
      await vApplyPricing({ reprice: true });
    });
  }

  function vShowListView() {
    if (vEls.listView)  vEls.listView.hidden = false;
    if (vEls.formView)  vEls.formView.hidden = true;
    if (vEls.formTitle) vEls.formTitle.textContent = "Presupuestos";
    if (vEls.statusBadge) vEls.statusBadge.hidden = true;
  }

  function vShowFormView() {
    if (vEls.listView)  vEls.listView.hidden = true;
    if (vEls.formView)  vEls.formView.hidden = false;
    if (vEls.statusBadge) vEls.statusBadge.hidden = false;
  }

  // ── Lista ──
  async function vLoadBudgets() {
    if (vEls.tbody) vEls.tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Cargando…</td></tr>';
    try {
      const data = await fetch("/api/budgets").then((r) => r.ok ? r.json() : Promise.reject(r.status));
      vState.list = data || [];
      vState.loaded = true;
      vRenderList();
    } catch (e) {
      if (vEls.tbody) vEls.tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Error cargando</td></tr>';
    }
  }

  function vRenderList() {
    if (!vEls.tbody) return;
    // Banner-resumen: presupuestos aceptados sin facturar (sobre la lista
    // completa, no la filtrada). Un 'aceptado' siempre está pendiente de
    // facturar — al facturar pasa a 'facturado'.
    vRenderPendingBanner();
    const q = (vEls.search ? vEls.search.value.trim().toLowerCase() : "");
    const stf = vEls.filterStatus ? vEls.filterStatus.value : "all";
    let list = vState.list;
    if (q) list = list.filter((b) => matchWords((b.number||"") + " " + (b.client_name||""), q));
    if (stf !== "all") list = list.filter((b) => b.status === stf);
    if (!list.length) {
      vEls.tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Sin presupuestos.</td></tr>';
      return;
    }
    vEls.tbody.innerHTML = list.map((b) => {
      const pend = b.status === "aceptado";
      return '<tr data-bid="' + b.id + '" class="ventas-row' + (pend ? ' ventas-row--por-facturar' : '') + '">' +
      '<td style="font-weight:600">' + vEsc(b.number) + '</td>' +
      '<td>' + vFmtDate(b.created_at) + '</td>' +
      '<td>' + vEsc(b.client_name) + '</td>' +
      '<td style="text-align:right;font-weight:600">' + vFmt(b.total) + '</td>' +
      '<td>' + vBadgeHtml(b.status) +
        (pend ? ' <span class="budget-pend-note">⚠ falta facturar</span>' : '') + '</td>' +
      '<td style="text-align:right">' +
        (pend
          ? '<button type="button" class="btn btn-primary" style="font-size:12px;padding:3px 10px" data-open="' + b.id + '">Facturar →</button>'
          : '<button type="button" class="btn" style="font-size:12px;padding:3px 10px" data-open="' + b.id + '">Abrir</button>') +
      '</td>' +
      '</tr>';
    }).join("");
  }

  function vRenderPendingBanner() {
    if (!vEls.pendingBanner) return;
    const n = (vState.list || []).filter((b) => b.status === "aceptado").length;
    if (!n) { vEls.pendingBanner.hidden = true; vEls.pendingBanner.innerHTML = ""; return; }
    const plural = n === 1 ? "presupuesto aceptado" : "presupuestos aceptados";
    vEls.pendingBanner.hidden = false;
    vEls.pendingBanner.innerHTML =
      '<span class="budget-pending-banner__txt">🧾 Tenés <strong>' + n + '</strong> ' + plural +
      ' sin facturar. Facturalos para que se generen los pedidos.</span>' +
      '<button type="button" class="btn" id="budget-pending-filter">Ver pendientes</button>';
    const fb = document.getElementById("budget-pending-filter");
    if (fb) fb.addEventListener("click", () => {
      if (vEls.filterStatus) vEls.filterStatus.value = "aceptado";
      vRenderList();
    });
  }

  if (vEls.tbody) {
    vEls.tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open]") || e.target.closest("tr[data-bid]");
      if (btn) vOpenForm(Number(btn.dataset.open || btn.dataset.bid));
    });
  }
  if (vEls.search)       vEls.search.addEventListener("input", () => vRenderList());
  if (vEls.filterStatus) vEls.filterStatus.addEventListener("change", () => vRenderList());
  if (vEls.newBtn)       vEls.newBtn.addEventListener("click", () => vOpenForm(null));
  if (vEls.backBtn)      vEls.backBtn.addEventListener("click", vShowListView);

  // ── Formulario ──
  async function vOpenForm(id) {
    vState.editingId = id || null;
    vState.items = [];
    vState.editingStatus = "borrador";
    // Cargar clientes y opciones de precio antes de defaultear la base.
    await vPopulateClients();
    await vLoadPriceOptions();
    // Invalidar el cache de productos del picker: la base puede cambiar.
    vState.pricedFor = null;
    vState.productsLoaded = false;
    vState.allProducts = [];

    if (id) {
      try {
        const data = await fetch("/api/budgets/" + id).then((r) => r.ok ? r.json() : Promise.reject(r.status));
        vState.editingStatus = data.status;
        if (vEls.formTitle)  vEls.formTitle.textContent = "Presupuesto N° " + data.number;
        if (vEls.formNumber) vEls.formNumber.textContent = data.number;
        if (vEls.client)     vEls.client.value = data.client_id || "";
        if (vEls.payment)    vEls.payment.value = data.payment_method || "Efectivo";
        if (vEls.discount)   vEls.discount.value = data.discount_percent || 0;
        if (vEls.surcharge)  vEls.surcharge.value = data.surcharge_percent || 0;
        if (vEls.notes)      vEls.notes.value = data.notes || "";
        vState.items = (data.items || []).map((it) => ({ ...it }));
        // Base de precios usada: la guardada en el presupuesto, o la del cliente.
        // No recalculamos al abrir: los ítems conservan sus precios guardados.
        vSetPricing(data.price_basis || vDefaultPricingForClient(data.client_id || null));
      } catch (e) { return; }
    } else {
      if (vEls.formTitle)  vEls.formTitle.textContent = "Nuevo presupuesto";
      if (vEls.formNumber) vEls.formNumber.textContent = "";
      // Pre-seleccionar el cliente que el vendedor venía atendiendo en el catálogo.
      if (vEls.client)     vEls.client.value = me.vendedorClientId ? String(me.vendedorClientId) : "";
      if (vEls.payment)    vEls.payment.value = "Efectivo";
      if (vEls.discount)   vEls.discount.value = 0;
      if (vEls.surcharge)  vEls.surcharge.value = 0;
      if (vEls.notes)      vEls.notes.value = "";
      vSetPricing(vDefaultPricingForClient(me.vendedorClientId || null));
    }
    vUpdateStatusUI();
    vRenderItems();
    vShowFormView();
  }

  async function vPopulateClients() {
    if (!vEls.client) return;
    try {
      // /api/clients ya devuelve solo level 1-4 activos, y respeta el filtro
      // para vendedor tercerizado (solo sus clientes asignados). Tanto admin
      // como vendedores pueden consultarlo desde el rework de mayo 2026.
      const r = await fetch("/api/clients");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || ("Error " + r.status));
      }
      const clients = await r.json();
      vState.clientsRaw = clients || [];
      vEls.client.innerHTML = '<option value="">Consumidor final</option>' +
        (clients || []).map((u) => '<option value="' + u.id + '">' + vEsc(u.full_name || u.username) + '</option>').join("");
    } catch (err) {
      // Antes quedaba solo "Consumidor final" sin ninguna explicación.
      vEls.client.innerHTML = '<option value="">Consumidor final</option>' +
        '<option value="" disabled>⚠ No se pudo cargar la lista de clientes</option>';
      vToast("No se pudieron cargar los clientes: " + (err.message || "error"), true);
    }
  }

  // ── Modal "Crear cliente rápido" ──────────────────────────────────────────

  async function vOpenQuickClient() {
    if (!vEls.quickClientModal) return;
    // Asegurar que las opciones de precio estén cargadas.
    await vLoadPriceOptions();
    // Poblar el select con las mismas opciones que el selector de lista del presupuesto.
    if (vState.priceOptions) {
      const { levels, lists } = vState.priceOptions;
      let html = '<option value="">— Sin asignar</option>' +
        '<optgroup label="Niveles base">' +
        (levels || []).map(o => '<option value="' + o.value + '">' + vEsc(o.label) + '</option>').join("") +
        '</optgroup>';
      if (lists && lists.length) {
        html += '<optgroup label="Listas personalizadas">' +
          lists.map(o => '<option value="' + o.value + '">' + vEsc(o.label) + '</option>').join("") +
          '</optgroup>';
      }
      vEls.qcPriceList.innerHTML = html;
    }
    vEls.qcName.value = "";
    vEls.qcPhone.value = "";
    vEls.qcPriceList.value = "";
    vEls.quickClientModal.hidden = false;
    vEls.qcName.focus();
  }

  function vCloseQuickClient() {
    if (vEls.quickClientModal) vEls.quickClientModal.hidden = true;
  }

  async function vSaveQuickClient() {
    const name = (vEls.qcName.value || "").trim();
    if (!name) { vEls.qcName.focus(); return; }
    vEls.qcSaveBtn.disabled = true;
    vEls.qcSaveBtn.textContent = "Creando…";
    try {
      const pricingVal = vEls.qcPriceList.value || "";
      const body = {
        full_name: name,
        phone: (vEls.qcPhone.value || "").trim() || null,
        price_list_id: pricingVal.startsWith("list:") ? Number(pricingVal.slice(5)) : null,
        level_base: pricingVal.startsWith("base:") ? pricingVal.slice(5) : null,
      };
      const r = await fetch("/api/admin/quick-client", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        vAlert(err.error || "Error al crear el cliente");
        return;
      }
      const newClient = await r.json();
      // Agregar al estado y al select, y seleccionarlo.
      vState.clientsRaw.push(newClient);
      const opt = document.createElement("option");
      opt.value = newClient.id;
      opt.textContent = newClient.full_name || newClient.username;
      vEls.client.appendChild(opt);
      vEls.client.value = newClient.id;
      vEls.client.dispatchEvent(new Event("change"));
      vCloseQuickClient();
    } catch (e) {
      vAlert("Error de red: " + e.message);
    } finally {
      vEls.qcSaveBtn.disabled = false;
      vEls.qcSaveBtn.textContent = "Crear cliente";
    }
  }

  if (vEls.quickClientBtn) vEls.quickClientBtn.addEventListener("click", vOpenQuickClient);
  if (vEls.qcCancelBtn) vEls.qcCancelBtn.addEventListener("click", vCloseQuickClient);
  if (vEls.qcSaveBtn) vEls.qcSaveBtn.addEventListener("click", vSaveQuickClient);
  if (vEls.qcName) vEls.qcName.addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); vSaveQuickClient(); }
  });

  async function vSave(targetStatus) {
    const clientId = vEls.client && vEls.client.value ? Number(vEls.client.value) : null;
    const clientName = clientId
      ? ((vEls.client.options[vEls.client.selectedIndex]||{}).text || "Consumidor final")
      : "Consumidor final";
    // Al guardar cambios sobre un presupuesto ya aceptado, mantener el estado
    // 'aceptado' (no degradarlo a enviado/borrador) para poder corregirlo antes
    // de facturar sin perder el botón Facturar.
    let finalStatus = targetStatus || "borrador";
    if (vState.editingId && vState.editingStatus === "aceptado") finalStatus = "aceptado";
    const body = {
      client_id:        clientId,
      client_name:      clientName,
      payment_method:   vEls.payment ? vEls.payment.value : "Efectivo",
      currency:         "ARS",
      discount_percent: Number(vEls.discount  ? vEls.discount.value  : 0) || 0,
      surcharge_percent:Number(vEls.surcharge ? vEls.surcharge.value : 0) || 0,
      notes:            vEls.notes ? vEls.notes.value.trim() : "",
      price_basis:      vState.pricing || null,
      status:           finalStatus,
      items:            vState.items,
    };
    try {
      let result;
      if (vState.editingId) {
        const r = await fetch("/api/budgets/" + vState.editingId, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
        if (!r.ok) throw new Error("PUT " + r.status);
        if (finalStatus !== vState.editingStatus) {
          await fetch("/api/budgets/" + vState.editingId + "/status", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:finalStatus}) });
        }
      } else {
        result = await fetch("/api/budgets", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }).then((r) => r.json());
        vState.editingId = result.id;
        if (vEls.formTitle)  vEls.formTitle.textContent = "Presupuesto N° " + result.number;
        if (vEls.formNumber) vEls.formNumber.textContent = result.number;
      }
      vState.editingStatus = finalStatus;
      vUpdateStatusUI();
      vLoadBudgets();
      vToast("Cambios guardados");
    } catch (e) { vToast("No se pudieron guardar los cambios", true); }
  }

  if (vEls.saveDraftBtn) vEls.saveDraftBtn.addEventListener("click", () => vSave("borrador"));
  if (vEls.form) vEls.form.addEventListener("submit", (e) => { e.preventDefault(); vSave("enviado"); });

  if (vEls.cancelBtn) vEls.cancelBtn.addEventListener("click", async () => {
    if (!vState.editingId) return;
    const ok = await vConfirm("Los productos del presupuesto van a volver al stock.", {
      title: "¿Cancelar este presupuesto?", okText: "Sí, cancelar", cancelText: "Volver", danger: true,
    });
    if (!ok) return;
    await fetch("/api/budgets/" + vState.editingId + "/status", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:"cancelado"}) });
    vState.editingStatus = "cancelado"; vUpdateStatusUI(); vLoadBudgets();
  });
  if (vEls.acceptBtn) vEls.acceptBtn.addEventListener("click", async () => {
    if (!vState.editingId) { await vSave("aceptado"); return; }
    await fetch("/api/budgets/" + vState.editingId + "/status", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:"aceptado"}) });
    vState.editingStatus = "aceptado"; vUpdateStatusUI(); vLoadBudgets();
  });

  if (vEls.invoiceBtn) vEls.invoiceBtn.addEventListener("click", async () => {
    if (!vState.editingId) return;
    const ok = await vConfirm(
      "Se va a descontar el stock de los artículos y, si hay un cliente con cuenta corriente, se le va a debitar el total.",
      { title: "¿Facturar este presupuesto?", okText: "Facturar" }
    );
    if (!ok) return;
    vEls.invoiceBtn.disabled = true;
    try {
      const r = await fetch("/api/budgets/" + vState.editingId + "/invoice", { method:"POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { vToast(data.error || "No se pudo facturar", true); vEls.invoiceBtn.disabled = false; return; }
      vState.editingStatus = "facturado";
      vUpdateStatusUI();
      vLoadBudgets();
      vToast(data.debited ? "Facturado · se debitó en cuenta corriente" : "Facturado · venta a consumidor final");
    } catch (_) {
      vToast("Error de conexión al facturar", true);
      vEls.invoiceBtn.disabled = false;
    }
  });

  if (vEls.shareBtn) vEls.shareBtn.addEventListener("click", async () => {
    if (!vState.editingId) { vToast("Guardá el presupuesto primero", true); return; }
    const client = vEls.client ? (vEls.client.options[vEls.client.selectedIndex]||{}).text||"Presupuesto" : "Presupuesto";
    const dateSlug = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "-");
    const fileName = client + " " + dateSlug + ".pdf";
    vEls.shareBtn.disabled = true;
    vEls.shareBtn.textContent = "…";
    try {
      const resp = await fetch("/api/budgets/" + vState.editingId + "/pdf");
      if (!resp.ok) throw new Error("Error " + resp.status);
      const blob = await resp.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
      }
    } catch (e) {
      if (e.name !== "AbortError") vToast("No se pudo compartir: " + e.message, true);
    } finally {
      vEls.shareBtn.disabled = false;
      vEls.shareBtn.textContent = "📤 Compartir";
    }
  });

  if (vEls.printBtn) vEls.printBtn.addEventListener("click", () => {
    const num     = vEls.formNumber ? vEls.formNumber.textContent : "Nuevo";
    const client  = vEls.client ? (vEls.client.options[vEls.client.selectedIndex]||{}).text||"Consumidor final" : "Consumidor final";
    const pay     = vEls.payment ? vEls.payment.value : "";
    const discPct = vEls.discount  ? Number(vEls.discount.value)  : 0;
    const surPct  = vEls.surcharge ? Number(vEls.surcharge.value) : 0;
    const notes   = vEls.notes ? vEls.notes.value : "";
    const date    = new Date().toLocaleDateString("es-AR");
    const appName = me.app_name || "Maxaria";
    const status  = vState.editingStatus || "borrador";
    const STATUS_LABELS = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", cancelado: "Cancelado", facturado: "Facturado" };

    let subtotal = 0;
    vState.items.forEach((it) => { subtotal += Number(it.subtotal) || 0; });
    subtotal = vRound2(subtotal);
    const afterDisc = vRound2(subtotal * (1 - discPct / 100));
    const total = vRound2(afterDisc * (1 + surPct / 100));
    const totalUnidades = vState.items.reduce((s, it) => s + (Math.round(Number(it.quantity)) || 0), 0);

    const anyDisc = vState.items.some((it) => (Number(it.discount_percent) || 0) > 0);
    const rows = vState.items.map((it) => {
      const disc = Number(it.discount_percent) || 0;
      const unitPrice = Number(it.unit_price) || 0;
      const precioConDesc = vRound2(unitPrice * (1 - disc / 100));
      return "<tr>" +
        "<td class='col-cod'>" + vEsc(it.product_code || "") + "</td>" +
        "<td class='col-prod'>" + vEsc(it.product_name || "") + "</td>" +
        "<td class='col-cant'>" + Math.round(it.quantity) + "</td>" +
        "<td class='col-price'>$" + vFmtN(it.unit_price) + "</td>" +
        (anyDisc ? (disc ? "<td class='col-disc'>−" + disc + "%</td>" : "<td class='col-disc' style='color:#9ca3af'>—</td>") : "") +
        (anyDisc ? (disc ? "<td class='col-precio'>$" + vFmtN(precioConDesc) + "</td>" : "<td class='col-precio' style='color:#9ca3af'>—</td>") : "") +
        "<td class='col-sub'>$" + vFmtN(it.subtotal) + "</td>" +
        "</tr>";
    }).join("");

    const html = "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
      "<title>Presupuesto " + vEsc(num) + "</title>" +
      "<style>" +
      "*{box-sizing:border-box}" +
      "body{font-family:Arial,sans-serif;font-size:13px;margin:28px 32px;color:#111}" +
      ".header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}" +
      ".header-left h1{font-size:20px;font-weight:800;margin:0 0 2px;color:#1e3a5f}" +
      ".header-left .status{font-size:11px;color:#6b7280;margin:0}" +
      ".header-right{text-align:right}" +
      ".header-right .doc-label{font-size:11px;color:#6b7280;margin:0 0 1px;text-transform:uppercase;letter-spacing:.05em}" +
      ".header-right .doc-num{font-size:18px;font-weight:800;color:#1e3a5f;margin:0}" +
      ".meta-row{display:flex;gap:0;border-top:2px solid #1e3a5f;border-bottom:1px solid #d1d5db;padding:8px 0;margin-bottom:0;font-size:12.5px}" +
      ".meta-cell{flex:1;padding:0 12px;border-right:1px solid #d1d5db}" +
      ".meta-cell:first-child{padding-left:0}" +
      ".meta-cell:last-child{border-right:none}" +
      ".meta-cell span{display:block;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px}" +
      ".meta-cell strong{font-size:13px;color:#111}" +
      "table{width:100%;border-collapse:collapse}" +
      "thead tr{background:#1e3a5f}" +
      "thead th{color:#fff;font-size:11px;font-weight:700;padding:7px 8px;text-align:left;letter-spacing:.03em;border-right:1px solid rgba(255,255,255,0.25)}" +
      "thead th:last-child{border-right:none}" +
      "tbody tr{border-bottom:1px solid #1e3a5f}" +
      "tbody tr:nth-child(even){background:#f8fafc}" +
      "tbody td{padding:6px 8px;font-size:12.5px;vertical-align:middle;border-right:1px solid #1e3a5f}" +
      "tbody td:last-child{border-right:none}" +
      ".col-cod{color:#6b7280;width:60px}" +
      ".col-prod{font-weight:600}" +
      ".col-cant{text-align:center;font-weight:700;width:52px}" +
      ".col-price{text-align:right;width:90px;color:#374151}" +
      ".col-disc{text-align:right;width:56px;color:#b45309;font-weight:600}" +
      ".col-precio{text-align:right;width:80px;color:#111}" +
      ".col-sub{text-align:right;width:90px;font-weight:700}" +
      ".summary-row{display:flex;justify-content:flex-end;align-items:baseline;gap:24px;border-top:2px solid #1e3a5f;padding:10px 8px 0}" +
      ".summary-meta{font-size:12px;color:#6b7280}" +
      ".adjustments{font-size:12px;color:#6b7280;margin-top:4px;text-align:right}" +
      ".grand-total{font-size:20px;font-weight:800;color:#1e3a5f}" +
      ".notes{margin-top:12px;font-size:12px;color:#6b7280;font-style:italic}" +
      "@media print{body{margin:14px 18px}}" +
      "</style></head><body>" +
      "<div class='header'>" +
        "<div class='header-left'>" +
          "<h1>" + vEsc(appName) + "</h1>" +
          "<p class='status'>Estado: " + vEsc(STATUS_LABELS[status] || status) + "</p>" +
        "</div>" +
        "<div class='header-right'>" +
          "<p class='doc-label'>Presupuesto</p>" +
          "<p class='doc-num'>N° " + vEsc(num) + "</p>" +
        "</div>" +
      "</div>" +
      "<div class='meta-row'>" +
        "<div class='meta-cell'><span>Fecha</span><strong>" + date + "</strong></div>" +
        "<div class='meta-cell'><span>Cliente</span><strong>" + vEsc(client) + "</strong></div>" +
        "<div class='meta-cell'><span>Forma de pago</span><strong>" + vEsc(pay) + "</strong></div>" +
      "</div>" +
      "<table><thead><tr>" +
        "<th>Cód.</th><th>Artículo</th>" +
        "<th style='text-align:center'>Cant.</th>" +
        "<th style='text-align:right'>Precio unit.</th>" +
        (anyDisc ? "<th style='text-align:right'>Desc.</th>" : "") +
        (anyDisc ? "<th style='text-align:right'>Precio</th>" : "") +
        "<th style='text-align:right'>Subtotal</th>" +
      "</tr></thead>" +
      "<tbody>" + (rows || "<tr><td colspan='" + (anyDisc ? 7 : 5) + "' style='padding:10px;color:#6b7280'>Sin artículos</td></tr>") + "</tbody>" +
      "</table>" +
      "<div class='summary-row'>" +
        "<span class='summary-meta'>" + vState.items.length + " artículos &nbsp;·&nbsp; " + totalUnidades + " unidades</span>" +
        "<span class='grand-total'>TOTAL: $" + vFmtN(total) + "</span>" +
      "</div>" +
      (discPct || surPct ? "<div class='adjustments'>" +
        (discPct ? "Descuento " + discPct + "%: — $" + vFmtN(vRound2(subtotal - afterDisc)) + "&nbsp;&nbsp;" : "") +
        (surPct  ? "Recargo "  + surPct  + "%: + $" + vFmtN(vRound2(total - afterDisc)) : "") +
      "</div>" : "") +
      (notes ? "<p class='notes'>" + vEsc(notes) + "</p>" : "") +
      "</body></html>";
    vPrintHtml(html);
  });

  function vPrintHtml(html) {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px;top:-9999px";
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  }

  // ── Picker de productos ──
  async function vLoadProducts() {
    // Refrescar si nunca se cargó o si cambió la base de precios.
    if (vState.productsLoaded && vState.pricedFor === vState.pricing) return;
    try {
      const pq = vPricingQuery(); // "?as_..." o ""
      let url = "/api/products" + pq;
      // El admin ve también productos sin stock (para facturar a reponer).
      if (me.level === 99) url += (pq ? "&" : "?") + "include_no_stock=1";
      // Antes: si la respuesta no venia ok se guardaba [] y ADEMAS se marcaba
      // productsLoaded = true, asi que el picker quedaba vacio y no reintentaba
      // nunca mas. Ahora se avisa y se deja el flag en false para reintentar.
      const r = await fetch(url);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || ("Error " + r.status));
      }
      const data = await r.json();
      vState.allProducts = data || [];
      vState.productsLoaded = true;
      vState.pricedFor = vState.pricing;
    } catch (err) {
      vToast("No se pudieron cargar los productos: " + (err.message || "error"), true);
    }
  }

  function vRenderPicker(filter) {
    if (!vEls.pickerTbody) return;
    let list = vState.allProducts;
    // Por defecto se ocultan los productos sin stock; el checkbox los muestra.
    if (!vState.pickerShowNoStock) {
      list = list.filter((p) => (p.stock || 0) > 0);
    }
    if (filter) {
      const q = filter.trim().toLowerCase();
      list = list.filter((p) => matchWords((p.name||"") + " " + (p.code||""), q));
    }
    if (!list.length) {
      vEls.pickerTbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:20px;text-align:center">Sin resultados</td></tr>';
      return;
    }
    vEls.pickerTbody.innerHTML = list.map((p) => {
      const img = p.image_url
        ? '<img src="' + vEsc(p.image_url) + '" style="width:36px;height:36px;object-fit:cover;border-radius:4px" loading="lazy" />'
        : '<span style="display:inline-block;width:36px;height:36px;background:#f3f4f6;border-radius:4px;line-height:36px;text-align:center;color:#9ca3af;font-size:18px">📦</span>';
      const isSel = vState.pickerSelected.has(p.id);
      const chk = isSel ? " checked" : "";
      const qty = isSel ? vState.pickerSelected.get(p.id) : "";
      const noStock = (p.stock || 0) <= 0;
      return '<tr data-pid="' + p.id + '"' + (noStock ? ' class="vpicker-nostock"' : '') + '><td><input type="checkbox" class="vpicker-cb" data-pid="' + p.id + '"' + chk + ' /></td>' +
        '<td>' + img + '</td>' +
        '<td><div style="font-weight:500">' + vEsc(p.name) + '</div>' +
          '<div class="muted" style="font-size:11px">' + vEsc(p.code||"") + '</div></td>' +
        '<td style="text-align:center"><input type="number" class="vpicker-qty" data-pid="' + p.id + '" min="1" step="1" inputmode="numeric" value="' + qty + '" placeholder="1" style="width:54px;text-align:center;padding:6px 4px;border:1px solid #d1d5db;border-radius:6px;font-size:14px" /></td>' +
        '<td style="text-align:right">' + vFmt(p.price) + '</td>' +
        '<td style="text-align:right;color:' + (p.stock > 0 ? "#059669" : "#dc2626") + '">' + (p.stock||0) + '</td></tr>';
    }).join("");
  }

  function vPickerCount() {
    const n = vState.pickerSelected.size;
    if (vEls.pickerCount) {
      // Monto que va sumando el pedido con lo tildado (qty × precio efectivo).
      let sum = 0;
      vState.pickerSelected.forEach((qty, pid) => {
        const p = vState.allProducts.find((x) => x.id === pid);
        if (p) sum += (Number(p.price) || 0) * qty;
      });
      vEls.pickerCount.textContent = n + (n===1?" seleccionado":" seleccionados") + (n ? " · " + vFmt(vRound2(sum)) : "");
    }
    if (vEls.pickerConfirm) {
      vEls.pickerConfirm.disabled = n === 0;
      if (vState.pickerReplaceIdx !== null) {
        vEls.pickerConfirm.textContent = "Reemplazar producto";
      } else {
        vEls.pickerConfirm.textContent = n > 0 ? "Agregar seleccionados (" + n + ")" : "Agregar seleccionados";
      }
    }
  }

  function vClosePicker() { if (vEls.picker) vEls.picker.hidden = true; vState.pickerReplaceIdx = null; }

  if (vEls.picker) {
    vEls.picker.addEventListener("change", (e) => {
      if (e.target.classList.contains("vpicker-cb")) {
        const pid = Number(e.target.dataset.pid);
        if (e.target.checked) {
          // Si ya hay qty escrita en la fila, respetarla; sino default 1
          const tr = e.target.closest("tr[data-pid]");
          const qInp = tr ? tr.querySelector(".vpicker-qty") : null;
          const q = qInp ? Math.max(1, Math.round(Number(qInp.value) || 0)) : 1;
          vState.pickerSelected.set(pid, q || 1);
          if (qInp && !qInp.value) qInp.value = "1";
        } else {
          vState.pickerSelected.delete(pid);
          const tr = e.target.closest("tr[data-pid]");
          const qInp = tr ? tr.querySelector(".vpicker-qty") : null;
          if (qInp) qInp.value = "";
        }
        vPickerCount();
      } else if (e.target.id === "picker-check-all") {
        const all = e.target.checked;
        vEls.pickerTbody.querySelectorAll(".vpicker-cb").forEach((cb) => {
          cb.checked = all;
          const pid = Number(cb.dataset.pid);
          const tr = cb.closest("tr[data-pid]");
          const qInp = tr ? tr.querySelector(".vpicker-qty") : null;
          if (all) {
            const q = qInp ? Math.max(1, Math.round(Number(qInp.value) || 0)) : 1;
            vState.pickerSelected.set(pid, q || 1);
            if (qInp && !qInp.value) qInp.value = "1";
          } else {
            vState.pickerSelected.delete(pid);
            if (qInp) qInp.value = "";
          }
        });
        vPickerCount();
      }
    });

    // Tipear una cantidad en la columna "Cant." marca el checkbox y guarda
    // la qty en el Map. El "1" placeholder no aparece como valor: si el
    // usuario borra, el input queda vacío hasta que escriba algo o se haga
    // blur (y ahí se restaura "1" si seguía marcado).
    vEls.picker.addEventListener("input", (e) => {
      if (!e.target.classList.contains("vpicker-qty")) return;
      const pid = Number(e.target.dataset.pid);
      const raw = e.target.value;
      if (raw === "") return; // mientras está vacío no tocamos state
      const q = Math.max(1, Math.round(Number(raw) || 0));
      vState.pickerSelected.set(pid, q);
      const tr = e.target.closest("tr[data-pid]");
      const cb = tr ? tr.querySelector(".vpicker-cb") : null;
      if (cb && !cb.checked) cb.checked = true;
      vPickerCount();
    });

    // Al perder foco, normalizamos. blur no burbujea, por eso usamos capture.
    vEls.picker.addEventListener("blur", (e) => {
      if (!e.target.classList || !e.target.classList.contains("vpicker-qty")) return;
      const pid = Number(e.target.dataset.pid);
      const raw = e.target.value;
      if (raw === "" && vState.pickerSelected.has(pid)) {
        e.target.value = "1";
        vState.pickerSelected.set(pid, 1);
        vPickerCount();
      } else if (raw !== "") {
        const q = Math.max(1, Math.round(Number(raw) || 0));
        e.target.value = String(q);
        vState.pickerSelected.set(pid, q);
        vPickerCount();
      }
    }, true);

    // Foco en el input de qty: seleccionar todo para sobrescribir fácil.
    vEls.picker.addEventListener("focusin", (e) => {
      if (e.target.classList.contains("vpicker-qty")) {
        try { e.target.select(); } catch (_) {}
      }
    });
  }
  if (vEls.pickerClose)  vEls.pickerClose.addEventListener("click",  vClosePicker);
  if (vEls.pickerCancel) vEls.pickerCancel.addEventListener("click", vClosePicker);

  if (vEls.pickerSearch) {
    vEls.pickerSearch.addEventListener("input", (e) => {
      clearTimeout(vEls.pickerSearch._t);
      vEls.pickerSearch._t = setTimeout(() => vRenderPicker(e.target.value), 180);
    });
    // Al volver a clickear/enfocar el buscador (típicamente para buscar otro
    // producto), se limpia solo y vuelve a mostrar el listado completo.
    const vClearSearch = () => {
      if (vEls.pickerSearch.value) { vEls.pickerSearch.value = ""; vRenderPicker(""); }
    };
    vEls.pickerSearch.addEventListener("focus", vClearSearch);
    vEls.pickerSearch.addEventListener("click", vClearSearch);
  }

  // Toggle "ver productos sin stock" (admin): re-renderiza respetando la búsqueda.
  if (vEls.pickerShowNoStock) {
    vEls.pickerShowNoStock.addEventListener("change", () => {
      vState.pickerShowNoStock = vEls.pickerShowNoStock.checked;
      vRenderPicker(vEls.pickerSearch ? vEls.pickerSearch.value : "");
    });
  }

  if (vEls.pickerConfirm) {
    vEls.pickerConfirm.addEventListener("click", () => {
      const replaceIdx = vState.pickerReplaceIdx;
      if (replaceIdx !== null && vState.pickerSelected.size > 0) {
        // Modo reemplazo: sustituir el item en replaceIdx con el primer producto
        // elegido, conservando la cantidad original.
        const entry = vState.pickerSelected.entries().next().value;
        const p = vState.allProducts.find((x) => x.id === entry[0]);
        if (p && vState.items[replaceIdx]) {
          const origQty = vState.items[replaceIdx].quantity;
          vState.items[replaceIdx] = {
            product_id: p.id, product_code: p.code||"", product_name: p.name||"",
            quantity: origQty, unit_price: p.price||0, discount_percent: 0,
            subtotal: vRound2(origQty * (p.price||0)),
          };
        }
      } else {
        // pickerSelected es Map<pid, qty>. Usamos la qty que el usuario tipeó
        // en la columna "Cant." (default 1 si solo marcó el checkbox).
        vState.pickerSelected.forEach((qty, pid) => {
          const p = vState.allProducts.find((x) => x.id === pid);
          if (!p) return;
          const addQty = Math.max(1, Math.round(Number(qty) || 1));
          const ex = vState.items.find((it) => it.product_id === pid);
          if (ex) {
            ex.quantity += addQty;
            ex.subtotal = vRound2(ex.quantity * ex.unit_price * (1 - ex.discount_percent/100));
          } else {
            vState.items.push({ product_id:p.id, product_code:p.code||"", product_name:p.name||"", quantity:addQty, unit_price:p.price||0, discount_percent:0, subtotal:vRound2(addQty * (p.price||0)) });
          }
        });
      }
      vState.pickerSelected.clear();
      vState.pickerReplaceIdx = null;
      vClosePicker();
      if (vEls.pickerSearch)   vEls.pickerSearch.value = "";
      if (vEls.pickerCheckAll) vEls.pickerCheckAll.checked = false;
      vRenderItems();
    });
  }

  // Menú contextual flotante para la tabla de items del presupuesto.
  let vCtxMenu = null;
  function hideVCtxMenu() { if (vCtxMenu) vCtxMenu.style.display = "none"; }
  function ensureVCtxMenu() {
    if (vCtxMenu) return vCtxMenu;
    vCtxMenu = document.createElement("div");
    vCtxMenu.style.cssText = "position:fixed;z-index:9000;background:#fff;border:1px solid #e5e7eb;" +
      "border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:4px;min-width:200px;display:none";
    document.body.appendChild(vCtxMenu);
    document.addEventListener("click", hideVCtxMenu);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideVCtxMenu(); });
    return vCtxMenu;
  }

  async function vOpenPickerForReplace(idx) {
    if (!vEls.picker) return;
    if (!vState.productsLoaded || vState.pricedFor !== vState.pricing) {
      if (vEls.pickerTbody) vEls.pickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:20px;text-align:center">Cargando…</td></tr>';
      await vLoadProducts();
    }
    vState.pickerSelected.clear();
    vState.pickerReplaceIdx = idx;
    if (vEls.pickerSearch)   vEls.pickerSearch.value = "";
    if (vEls.pickerCheckAll) vEls.pickerCheckAll.checked = false;
    const isAdmin = me.level === 99;
    if (vEls.pickerNoStockWrap) vEls.pickerNoStockWrap.hidden = !isAdmin;
    vState.pickerShowNoStock = false;
    if (vEls.pickerShowNoStock) vEls.pickerShowNoStock.checked = false;
    vRenderPicker("");
    vPickerCount();
    vEls.picker.hidden = false;
  }

  if (vEls.itemsTbody) {
    vEls.itemsTbody.addEventListener("contextmenu", (e) => {
      const tr = e.target.closest("tr[data-idx]");
      if (!tr) return;
      // No habilitar si los items están en modo solo lectura (facturado/cancelado).
      if (vState.editingStatus === "facturado" || vState.editingStatus === "cancelado") return;
      e.preventDefault();
      const idx = Number(tr.dataset.idx);
      if (!vState.items[idx]) return;
      const it = vState.items[idx];
      const menu = ensureVCtxMenu();
      menu.innerHTML = "";
      const head = document.createElement("div");
      head.style.cssText = "padding:6px 10px;color:#6b7280;border-bottom:1px solid #eee;" +
        "margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;font-size:12px";
      head.textContent = (it.product_name || "") + " · " + (it.product_code || "");
      menu.appendChild(head);
      const b = document.createElement("button");
      b.type = "button";
      b.style.cssText = "display:block;width:100%;text-align:left;background:none;border:none;" +
        "padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:#111827";
      b.textContent = "🔄 Cambiar producto";
      b.addEventListener("mouseenter", () => { b.style.background = "#f3f4f6"; });
      b.addEventListener("mouseleave", () => { b.style.background = "none"; });
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        hideVCtxMenu();
        vOpenPickerForReplace(idx);
      });
      menu.appendChild(b);
      menu.style.display = "block";
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      let x = e.clientX, y = e.clientY;
      if (x + mw > window.innerWidth)  x = Math.max(8, window.innerWidth  - mw - 8);
      if (y + mh > window.innerHeight) y = Math.max(8, window.innerHeight - mh - 8);
      menu.style.left = x + "px";
      menu.style.top  = y + "px";
    });
  }

  if (vEls.addProductBtn) {
    vEls.addProductBtn.addEventListener("click", async () => {
      if (!vEls.picker) return;
      if (!vState.productsLoaded || vState.pricedFor !== vState.pricing) {
        if (vEls.pickerTbody) vEls.pickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:20px;text-align:center">Cargando…</td></tr>';
        await vLoadProducts();
      }
      vState.pickerSelected.clear();
      vState.pickerReplaceIdx = null;
      if (vEls.pickerSearch)   vEls.pickerSearch.value = "";
      if (vEls.pickerCheckAll) vEls.pickerCheckAll.checked = false;
      // El toggle "ver sin stock" es solo para admin (los demás no reciben
      // productos sin stock del server). Arranca destildado en cada apertura.
      const isAdmin = me.level === 99;
      if (vEls.pickerNoStockWrap) vEls.pickerNoStockWrap.hidden = !isAdmin;
      vState.pickerShowNoStock = false;
      if (vEls.pickerShowNoStock) vEls.pickerShowNoStock.checked = false;
      vRenderPicker("");
      vPickerCount();
      vEls.picker.hidden = false;
    });
  }

  // ── Bootstrap ──
  loadMe();
  vShowListView();
  vLoadBudgets();

})();
