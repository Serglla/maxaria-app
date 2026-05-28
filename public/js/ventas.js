/**
 * Maxaria — Ventas / Presupuestos
 *
 * Pagina independiente del catalogo (/ventas). Extraida del overlay que vivia
 * en index.html para que tenga su propia URL y su propio scroll.
 */
(function () {
  "use strict";

  // ── Estado global mínimo ──
  const me = { app_name: "Maxaria", level: 0, fullName: "", id: 0 };

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
    newBtn:        document.getElementById("new-budget-btn"),
    tbody:         document.getElementById("budgets-tbody"),
    form:          document.getElementById("budget-form"),
    client:        document.getElementById("budget-client"),
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
    pickerCheckAll:document.getElementById("picker-check-all"),
    pickerTbody:   document.getElementById("picker-tbody"),
    pickerCount:   document.getElementById("picker-selected-count"),
    pickerConfirm: document.getElementById("picker-confirm-btn"),
  };

  const vState = {
    list: [],
    loaded: false,
    editingId: null,
    editingStatus: "borrador",
    items: [],
    allProducts: [],
    productsLoaded: false,
    pickerSelected: new Set(),
  };

  const V_STATUS_LABELS = { borrador:"Borrador", enviado:"Enviado", aceptado:"Aceptado", facturado:"Facturado", cancelado:"Cancelado" };
  const V_STATUS_BADGE  = { borrador:"budget-badge--borrador", enviado:"budget-badge--enviado", aceptado:"budget-badge--aceptado", facturado:"budget-badge--facturado", cancelado:"budget-badge--cancelado" };

  function vFmt(n) { return "$" + (Number(n)||0).toLocaleString("es-AR"); }
  function vEsc(s) { return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function vFmtDate(s) {
    if (!s) return "";
    const d = new Date(s.replace(" ","T")+"Z");
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
  }

  function vBadgeHtml(status) {
    return '<span class="budget-badge ' + (V_STATUS_BADGE[status]||"") + '">' + vEsc(V_STATUS_LABELS[status]||status) + '</span>';
  }

  function vUpdateStatusUI() {
    const st = vState.editingStatus;
    if (vEls.statusBadge) {
      vEls.statusBadge.className = "budget-badge " + (V_STATUS_BADGE[st]||"budget-badge--borrador");
      vEls.statusBadge.textContent = V_STATUS_LABELS[st]||st;
    }
    const isFinal = st === "cancelado" || st === "aceptado" || st === "facturado";
    [vEls.saveDraftBtn, vEls.sendBtn, vEls.addProductBtn, vEls.discount, vEls.surcharge].forEach((el) => { if (el) el.disabled = isFinal; });
    if (vEls.cancelBtn)  vEls.cancelBtn.hidden  = isFinal;
    if (vEls.acceptBtn)  vEls.acceptBtn.hidden  = st === "aceptado" || st === "cancelado" || st === "facturado";
    if (vEls.invoiceBtn) vEls.invoiceBtn.hidden = st !== "aceptado";
  }

  function vRecalc() {
    let subtotal = 0;
    vState.items.forEach((it) => {
      it.subtotal = Math.round((Number(it.quantity)||1) * (Number(it.unit_price)||0) * (1 - (Number(it.discount_percent)||0)/100));
      subtotal += it.subtotal;
    });
    const discPct = Number(vEls.discount ? vEls.discount.value : 0)||0;
    const surPct  = Number(vEls.surcharge ? vEls.surcharge.value : 0)||0;
    const afterDisc = Math.round(subtotal * (1 - discPct/100));
    const total = Math.round(afterDisc * (1 + surPct/100));
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
      return '<tr data-idx="' + idx + '">' +
        '<td><input type="text" value="' + vEsc(it.product_code) + '" data-field="product_code" /></td>' +
        '<td><input type="text" value="' + vEsc(it.product_name) + '" data-field="product_name" style="width:100%" /></td>' +
        '<td style="text-align:right"><input type="number" value="' + Math.round(it.quantity) + '" min="1" step="1" data-field="quantity" style="width:60px;text-align:right" /></td>' +
        '<td style="text-align:right"><input type="number" value="' + vEsc(it.unit_price) + '" min="0" step="1" data-field="unit_price" style="width:90px;text-align:right" /></td>' +
        '<td style="text-align:right"><input type="number" value="' + vEsc(it.discount_percent) + '" min="0" max="100" step="0.5" data-field="discount_percent" style="width:58px;text-align:right" /></td>' +
        '<td style="text-align:right;font-weight:500">' + vEsc(vFmt(it.subtotal||0)) + '</td>' +
        '<td style="text-align:center"><button type="button" data-del-idx="' + idx + '" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px" title="Eliminar">✕</button></td>' +
      '</tr>';
    }).join("");
    vRecalc();
  }

  if (vEls.itemsTbody) {
    vEls.itemsTbody.addEventListener("input", (e) => {
      const tr = e.target.closest("tr[data-idx]");
      if (!tr) return;
      const idx = Number(tr.dataset.idx);
      const field = e.target.dataset.field;
      if (!field || idx >= vState.items.length) return;
      if (field === "product_code" || field === "product_name") {
        vState.items[idx][field] = e.target.value;
      } else if (field === "quantity") {
        vState.items[idx][field] = Math.max(1, Math.round(Number(e.target.value)||1));
        e.target.value = vState.items[idx][field];
      } else {
        vState.items[idx][field] = Number(e.target.value)||0;
      }
      const it = vState.items[idx];
      it.subtotal = Math.round((Number(it.quantity)||1)*(Number(it.unit_price)||0)*(1-(Number(it.discount_percent)||0)/100));
      const cells = tr.querySelectorAll("td");
      if (cells[5]) cells[5].textContent = vFmt(it.subtotal);
      vRecalc();
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
    const q = (vEls.search ? vEls.search.value.trim().toLowerCase() : "");
    const stf = vEls.filterStatus ? vEls.filterStatus.value : "all";
    let list = vState.list;
    if (q) list = list.filter((b) => (b.number||"").toLowerCase().includes(q) || (b.client_name||"").toLowerCase().includes(q));
    if (stf !== "all") list = list.filter((b) => b.status === stf);
    if (!list.length) {
      vEls.tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Sin presupuestos.</td></tr>';
      return;
    }
    vEls.tbody.innerHTML = list.map((b) =>
      '<tr data-bid="' + b.id + '" class="ventas-row">' +
      '<td style="font-weight:600">' + vEsc(b.number) + '</td>' +
      '<td>' + vFmtDate(b.created_at) + '</td>' +
      '<td>' + vEsc(b.client_name) + '</td>' +
      '<td style="text-align:right;font-weight:600">' + vFmt(b.total) + '</td>' +
      '<td>' + vBadgeHtml(b.status) + '</td>' +
      '<td style="text-align:right"><button type="button" class="btn" style="font-size:12px;padding:3px 10px" data-open="' + b.id + '">Abrir</button></td>' +
      '</tr>'
    ).join("");
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
    await vPopulateClients();

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
      } catch (e) { return; }
    } else {
      if (vEls.formTitle)  vEls.formTitle.textContent = "Nuevo presupuesto";
      if (vEls.formNumber) vEls.formNumber.textContent = "";
      if (vEls.client)     vEls.client.value = "";
      if (vEls.payment)    vEls.payment.value = "Efectivo";
      if (vEls.discount)   vEls.discount.value = 0;
      if (vEls.surcharge)  vEls.surcharge.value = 0;
      if (vEls.notes)      vEls.notes.value = "";
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
      if (!r.ok) return;
      const clients = await r.json();
      vEls.client.innerHTML = '<option value="">Consumidor final</option>' +
        (clients || []).map((u) => '<option value="' + u.id + '">' + vEsc(u.full_name || u.username) + '</option>').join("");
    } catch (_) {}
  }

  async function vSave(targetStatus) {
    const clientId = vEls.client && vEls.client.value ? Number(vEls.client.value) : null;
    const clientName = clientId
      ? ((vEls.client.options[vEls.client.selectedIndex]||{}).text || "Consumidor final")
      : "Consumidor final";
    const body = {
      client_id:        clientId,
      client_name:      clientName,
      payment_method:   vEls.payment ? vEls.payment.value : "Efectivo",
      currency:         "ARS",
      discount_percent: Number(vEls.discount  ? vEls.discount.value  : 0) || 0,
      surcharge_percent:Number(vEls.surcharge ? vEls.surcharge.value : 0) || 0,
      notes:            vEls.notes ? vEls.notes.value.trim() : "",
      status:           targetStatus || "borrador",
      items:            vState.items,
    };
    try {
      let result;
      if (vState.editingId) {
        await fetch("/api/budgets/" + vState.editingId, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
        if (targetStatus && targetStatus !== vState.editingStatus) {
          await fetch("/api/budgets/" + vState.editingId + "/status", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:targetStatus}) });
        }
      } else {
        result = await fetch("/api/budgets", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }).then((r) => r.json());
        vState.editingId = result.id;
        if (vEls.formTitle)  vEls.formTitle.textContent = "Presupuesto N° " + result.number;
        if (vEls.formNumber) vEls.formNumber.textContent = result.number;
      }
      vState.editingStatus = targetStatus || "borrador";
      vUpdateStatusUI();
      vLoadBudgets();
    } catch (e) { /* silencioso */ }
  }

  if (vEls.saveDraftBtn) vEls.saveDraftBtn.addEventListener("click", () => vSave("borrador"));
  if (vEls.form) vEls.form.addEventListener("submit", (e) => { e.preventDefault(); vSave("enviado"); });

  if (vEls.cancelBtn) vEls.cancelBtn.addEventListener("click", async () => {
    if (!vState.editingId || !confirm("¿Cancelar este presupuesto?")) return;
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
    if (!confirm("Facturar este presupuesto?\n\nSe va a descontar el stock de los artículos y, si hay un cliente con cuenta corriente, se le va a debitar el total.")) return;
    vEls.invoiceBtn.disabled = true;
    try {
      const r = await fetch("/api/budgets/" + vState.editingId + "/invoice", { method:"POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { alert(data.error || "No se pudo facturar"); vEls.invoiceBtn.disabled = false; return; }
      vState.editingStatus = "facturado";
      vUpdateStatusUI();
      vLoadBudgets();
      alert("Facturado correctamente." + (data.debited ? "\nSe debitó el total en la cuenta corriente del cliente." : "\nVenta a consumidor final: no se tocó cuenta corriente."));
    } catch (_) {
      alert("Error de conexión al facturar");
      vEls.invoiceBtn.disabled = false;
    }
  });

  if (vEls.printBtn) vEls.printBtn.addEventListener("click", () => {
    const num    = vEls.formNumber ? vEls.formNumber.textContent : "Nuevo";
    const client = vEls.client ? (vEls.client.options[vEls.client.selectedIndex]||{}).text||"Consumidor final" : "Consumidor final";
    const pay    = vEls.payment ? vEls.payment.value : "";
    const discPct= vEls.discount  ? Number(vEls.discount.value)  : 0;
    const surPct = vEls.surcharge ? Number(vEls.surcharge.value) : 0;
    const notes  = vEls.notes ? vEls.notes.value : "";
    let subtotal = 0; vState.items.forEach((it) => { subtotal += Number(it.subtotal)||0; });
    const afterDisc = Math.round(subtotal*(1-discPct/100));
    const total = Math.round(afterDisc*(1+surPct/100));
    const rows = vState.items.map((it) =>
      "<tr><td>" + vEsc(it.product_code) + "</td><td>" + vEsc(it.product_name) +
      "</td><td style='text-align:right'>" + Math.round(it.quantity) +
      "</td><td style='text-align:right'>$" + Number(it.unit_price).toLocaleString("es-AR") +
      "</td><td style='text-align:right'>" + (Number(it.discount_percent)||0) + "%" +
      "</td><td style='text-align:right;font-weight:600'>$" + Number(it.subtotal).toLocaleString("es-AR") + "</td></tr>"
    ).join("");
    const appName = me.app_name || "Maxaria";
    const html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Presupuesto " + num + "</title>" +
      "<style>body{font-family:sans-serif;font-size:13px;margin:24px}h1{font-size:18px}" +
      "table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left}" +
      "th{background:#f1f5f9;font-size:12px;color:#6b7280}.total-box{margin-top:12px;text-align:right;font-size:14px}" +
      ".grand-total{font-size:18px;font-weight:700;color:#d97706}</style></head><body>" +
      "<h1>" + vEsc(appName) + " — Presupuesto N° " + vEsc(num) + "</h1>" +
      "<p><strong>Fecha:</strong> " + new Date().toLocaleDateString("es-AR") +
      " &nbsp; <strong>Cliente:</strong> " + vEsc(client) +
      " &nbsp; <strong>Pago:</strong> " + vEsc(pay) + "</p>" +
      "<table><thead><tr><th>Cód.</th><th>Artículo</th><th>Cant.</th><th>Precio</th><th>Desc%</th><th>Subtotal</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>" +
      "<div class='total-box'>" +
      (discPct ? "<div>Descuento " + discPct + "%: — $" + (subtotal-afterDisc).toLocaleString("es-AR") + "</div>" : "") +
      (surPct  ? "<div>Recargo "  + surPct  + "%: + $" + (total-afterDisc).toLocaleString("es-AR")    + "</div>" : "") +
      "<div class='grand-total'>TOTAL: $" + total.toLocaleString("es-AR") + "</div></div>" +
      (notes ? "<p style='margin-top:16px;color:#6b7280'><em>" + vEsc(notes) + "</em></p>" : "") +
      "</body></html>";
    const w = window.open("","_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  });

  // ── Picker de productos ──
  async function vLoadProducts() {
    if (vState.productsLoaded) return;
    try {
      const data = await fetch("/api/products").then((r) => r.ok ? r.json() : []);
      vState.allProducts = data || [];
      vState.productsLoaded = true;
    } catch (_) {}
  }

  function vRenderPicker(filter) {
    if (!vEls.pickerTbody) return;
    let list = vState.allProducts;
    if (filter) {
      const q = filter.trim().toLowerCase();
      list = list.filter((p) => (p.name||"").toLowerCase().includes(q) || (p.code||"").toLowerCase().includes(q));
    }
    if (!list.length) {
      vEls.pickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:20px;text-align:center">Sin resultados</td></tr>';
      return;
    }
    vEls.pickerTbody.innerHTML = list.map((p) => {
      const img = p.image_url
        ? '<img src="' + vEsc(p.image_url) + '" style="width:36px;height:36px;object-fit:cover;border-radius:4px" loading="lazy" />'
        : '<span style="display:inline-block;width:36px;height:36px;background:#f3f4f6;border-radius:4px;line-height:36px;text-align:center;color:#9ca3af;font-size:18px">📦</span>';
      const chk = vState.pickerSelected.has(p.id) ? " checked" : "";
      return '<tr><td><input type="checkbox" class="vpicker-cb" data-pid="' + p.id + '"' + chk + ' /></td>' +
        '<td>' + img + '</td>' +
        '<td><div style="font-weight:500">' + vEsc(p.name) + '</div>' +
          '<div class="muted" style="font-size:11px">' + vEsc(p.code||"") + '</div></td>' +
        '<td style="text-align:right">' + vFmt(p.price) + '</td>' +
        '<td style="text-align:right;color:' + (p.stock > 0 ? "#059669" : "#9ca3af") + '">' + (p.stock||0) + '</td></tr>';
    }).join("");
  }

  function vPickerCount() {
    if (!vEls.pickerCount) return;
    const n = vState.pickerSelected.size;
    vEls.pickerCount.textContent = n + (n===1?" seleccionado":" seleccionados");
    if (vEls.pickerConfirm) vEls.pickerConfirm.disabled = n === 0;
  }

  function vClosePicker() { if (vEls.picker) vEls.picker.hidden = true; }

  if (vEls.picker) {
    vEls.picker.addEventListener("change", (e) => {
      if (e.target.classList.contains("vpicker-cb")) {
        const pid = Number(e.target.dataset.pid);
        e.target.checked ? vState.pickerSelected.add(pid) : vState.pickerSelected.delete(pid);
        vPickerCount();
      } else if (e.target.id === "picker-check-all") {
        vEls.pickerTbody.querySelectorAll(".vpicker-cb").forEach((cb) => {
          cb.checked = e.target.checked;
          const pid = Number(cb.dataset.pid);
          e.target.checked ? vState.pickerSelected.add(pid) : vState.pickerSelected.delete(pid);
        });
        vPickerCount();
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
  }

  if (vEls.pickerConfirm) {
    vEls.pickerConfirm.addEventListener("click", () => {
      vState.pickerSelected.forEach((pid) => {
        const p = vState.allProducts.find((x) => x.id === pid);
        if (!p) return;
        const ex = vState.items.find((it) => it.product_id === pid);
        if (ex) {
          ex.quantity += 1;
          ex.subtotal = Math.round(ex.quantity * ex.unit_price * (1 - ex.discount_percent/100));
        } else {
          vState.items.push({ product_id:p.id, product_code:p.code||"", product_name:p.name||"", quantity:1, unit_price:p.price||0, discount_percent:0, subtotal:p.price||0 });
        }
      });
      vState.pickerSelected.clear();
      vClosePicker();
      if (vEls.pickerSearch)   vEls.pickerSearch.value = "";
      if (vEls.pickerCheckAll) vEls.pickerCheckAll.checked = false;
      vRenderItems();
    });
  }

  if (vEls.addProductBtn) {
    vEls.addProductBtn.addEventListener("click", async () => {
      if (!vEls.picker) return;
      if (!vState.productsLoaded) {
        if (vEls.pickerTbody) vEls.pickerTbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:20px;text-align:center">Cargando…</td></tr>';
        await vLoadProducts();
      }
      vState.pickerSelected.clear();
      if (vEls.pickerSearch)   vEls.pickerSearch.value = "";
      if (vEls.pickerCheckAll) vEls.pickerCheckAll.checked = false;
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
