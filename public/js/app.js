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
  };

  const LEVEL_NAMES = { 1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP" };
  const LS_VIEW_AS_LEVEL = "maxaria.viewAsLevel"; // solo admin

  const state = {
    me: null, categories: [], products: [], cat: "all", query: "",
    cart: new Map(),
    // Solo aplica si me.level === 99: el admin esta viendo el catalogo
    // con la lista de precios de OTRO nivel (1..4). null = ver con su
    // propio mapeo (admin usa minorista por defecto en server).
    viewAsLevel: null,
    // Solo aplica si me.level === 5: cliente que está atendiendo el vendedor.
    // null = aún no eligió cliente (catálogo sin precios).
    vendedorClient: null,
    clients: [], // lista de usuarios (level 1-4) cargada para vendedores
  };

  function fmtPrice(n) { return "$" + (Number(n) || 0).toLocaleString("es-AR"); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

  function productsUrl() {
    if (state.me && state.me.level === 99 && state.viewAsLevel) {
      return "/api/products?as_level=" + state.viewAsLevel;
    }
    return "/api/products";
  }

  async function bootstrap() {
    try {
      const me = await api("/api/me");
      state.me = me;
      if (me.level === 99) {
        state.viewAsLevel = loadViewAsLevel();
      }
      if (me.level === 5) {
        // Recuperar cliente seleccionado en sesión previa y cargar lista de clientes
        state.vendedorClient = me.vendedorClient || null;
        state.clients = await api("/api/clients");
      }
      const [cats, prods] = await Promise.all([
        api("/api/categories"), api(productsUrl()),
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
    } catch (e) { console.error(e); }
  }

  function renderUser() {
    const u = state.me; if (!u) return;
    const viewing = u.level === 99 && state.viewAsLevel
      ? " (viendo como " + LEVEL_NAMES[state.viewAsLevel] + ")"
      : "";
    els.userInfo.textContent = (u.fullName || u.username) + " - " + u.levelName + viewing;
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
    if (els.priceChangesBtn) {
      // El vendedor ve los cambios segun el nivel del cliente seleccionado
      // (o segun su vendedor_price_level si no hay cliente).
      els.priceChangesBtn.hidden = !u.canSeePriceChanges;
    }
    // Selector "Ver como ...": SOLO admin
    if (els.levelSwitcher) {
      const isAdmin = u.level === 99;
      els.levelSwitcher.hidden = !isAdmin;
      if (isAdmin) {
        els.levelSelect.value = String(state.viewAsLevel || 1);
      }
    }
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
      const q = state.query.toLowerCase();
      list = list.filter((p) =>
        (p.code || "").toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.category_name || "").toLowerCase().includes(q));
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
      els.grid.innerHTML = list.map(cardHtml).join("");
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
      els.vendedorBar.innerHTML =
        '<div class="vendedor-bar-inner">' +
          '<span>Seleccioná un cliente para ver los precios del catálogo</span>' +
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
      ? state.clients.filter((c) =>
          (c.full_name || "").toLowerCase().includes(filter) ||
          (c.username || "").toLowerCase().includes(filter))
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
      const ok = confirm(
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
    try {
      await api("/api/vendedor/select-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id }),
      });
      state.vendedorClient = { id: client.id, name: client.full_name || client.username,
                               level: client.level, levelName: client.levelName };
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
    } catch (e) {
      alert("Error al seleccionar cliente: " + (e.message || "Error desconocido"));
    }
  }

  function cardHtml(p) {
    const img = p.image_url
      ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" />'
      : '<div class="muted" style="font-size:12px;padding:8px;text-align:center">Sin foto</div>';
    const inCart = state.cart.has(p.id);
    const noClient = state.me && state.me.level === 5 && !state.vendedorClient;
    const priceHtml = noClient
      ? '<div class="card-price card-price-none">—</div>'
      : '<div class="card-price">' + fmtPrice(p.price) + '</div>';
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
  function refreshCardForProduct(productId) {
    const card = els.grid.querySelector('.card[data-id="' + productId + '"]');
    if (!card) return;
    const slot = card.querySelector('.card-actions[data-id="' + productId + '"]');
    if (slot) slot.innerHTML = cardActionHtml(productId);
    if (state.cart.has(productId)) card.classList.add("in-cart");
    else card.classList.remove("in-cart");
  }

  function changeQty(id, delta) {
    if (state.me && state.me.level === 5 && !state.vendedorClient) return;
    const item = state.cart.get(id);
    if (item) {
      item.qty += delta;
      if (item.qty <= 0) state.cart.delete(id);
    } else if (delta > 0) {
      const p = state.products.find((x) => x.id === id);
      if (!p) return;
      state.cart.set(id, { id: p.id, name: p.name, price: p.price, qty: delta, image: p.image_url });
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

  async function sendCart() {
    if (!state.cart.size) return;
    const phone = (state.me && state.me.whatsapp) || "";
    if (!phone) {
      // Para clientes (1-4): el phone viene del vendedor asignado o, si no hay,
      // del WhatsApp global de la empresa. Si tampoco hay global, no hay destino.
      if ([1, 2, 3, 4].includes(Number(state.me && state.me.level))) {
        alert("No hay número de WhatsApp configurado.\n" +
              "Pedile al administrador que cargue el WhatsApp principal de la empresa.");
      } else {
        alert("No hay numero de WhatsApp configurado.");
      }
      return;
    }
    const message = buildWhatsappMessage();

    // Abrimos la ventana YA, dentro del user-gesture del click,
    // para que el bloqueador de popups no la mate. Despues le
    // cambiamos la URL cuando el server confirma el pedido.
    const popup = window.open("about:blank", "_blank");

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
        alert("No se pudo guardar el pedido: " + (body.error || resp.status));
        return;
      }
      const out = await resp.json();
      const text = encodeURIComponent(message + "\n\n#Pedido" + out.order.id);
      const waUrl = "https://wa.me/" + phone + "?text=" + text;

      if (popup && !popup.closed) {
        popup.location.href = waUrl;
      } else {
        // Popup bloqueado: mostramos un fallback para que el cliente
        // abra WhatsApp con un click manual y no pierda el pedido.
        showWhatsappFallback(out.order.id, waUrl);
      }

      const clearedIds = Array.from(state.cart.keys());
      state.cart.clear();
      if (els.cartNotes) els.cartNotes.value = "";
      renderCart();
      clearedIds.forEach(refreshCardForProduct);
      closeDrawers();
      flashOrderSaved(out.order.id);
    } catch (e) {
      if (popup && !popup.closed) popup.close();
      console.error(e);
      alert("Error de conexion al enviar el pedido");
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
      const url = state.me && state.me.level === 99 && state.viewAsLevel
        ? "/api/price-changes?as_level=" + state.viewAsLevel
        : "/api/price-changes";
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
      alert("No se pudo cargar la herramienta de exportacion. Revisa tu conexion.");
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
      alert("Error al generar la imagen: " + (e && e.message ? e.message : e));
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
            '<tbody>' + pcRowsWithCategoryHeaders(reingresos, pcReingresoRowHtml) + '</tbody>' +
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
            '<tbody>' + pcRowsWithCategoryHeaders(cambios, pcRowHtml, 5) + '</tbody>' +
          '</table>';
      }

      // — Productos nuevos —
      if (nuevos.length) {
        html +=
          '<h4 class="pc-section-title">Productos nuevos <span class="muted">(' + nuevos.length + ')</span></h4>' +
          '<table class="pc-table">' +
            '<thead><tr><th>Código</th><th>Producto</th><th class="num">Precio</th></tr></thead>' +
            '<tbody>' + pcRowsWithCategoryHeaders(nuevos, pcNewRowHtml) + '</tbody>' +
          '</table>';
      }

      html += '</div></div>'; // pc-update-body / pc-update-block
    });

    return html;
  }

  // Inserta filas de encabezado de categoría cada vez que cambia la categoría
  function pcRowsWithCategoryHeaders(items, rowFn, colSpan) {
    colSpan = colSpan || 3;
    var html = "";
    var lastCat = null;
    items.forEach(function(item) {
      var cat = item.category_name || "Sin categoría";
      if (cat !== lastCat) {
        html += '<tr class="pc-cat-header"><td colspan="' + colSpan + '">' + escapeHtml(cat) + '</td></tr>';
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
      const orders = await api("/api/orders");
      if (!orders.length) {
        els.ordersBody.innerHTML = '<p class="muted">Todavia no hay pedidos.</p>';
        return;
      }
      const header = isTerc ? renderDispatchBar(orders) : "";
      els.ordersBody.innerHTML =
        header +
        '<div class="orders-cards">' +
          orders.map((o) => orderCardHtml(o, isAdmin, isTerc)).join("") +
        '</div>';
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
    if (!confirm("Vas a unificar " + ids.length + " pedido(s) y mandarlo al admin. Despues los originales quedan marcados como 'enviado'. Seguir?")) return;
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
        window.open(res.whatsapp_link, "_blank");
      } else {
        alert("Pedido unificado creado (#" + res.unified_order_id + ") pero falta configurar el numero principal de WhatsApp en /admin > Configuracion.");
      }
      // Refrescar la lista
      await openOrders();
    } catch (e) {
      alert((e && e.message) || "Error al enviar el pedido unificado");
      btn.disabled = false;
      btn.textContent = prevText;
    }
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

    return '<article class="order-card' + (isTerc ? ' with-dispatch' : '') + '" data-id="' + o.id + '">' +
      '<header class="order-head" title="Click para ver el detalle">' +
        dispatchCb +
        '<div>' +
          '<h4>Pedido #' + o.id + ' <span class="order-status ' + escapeHtml(o.status) + '">' + escapeHtml(o.status) + '</span>' + tagsHtml + '</h4>' +
          '<div class="meta">' + date + who + '</div>' +
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

      const rows = o.items.map((it) =>
        '<tr>' +
          '<td>' + escapeHtml(it.product_code || "") + '</td>' +
          '<td>' + escapeHtml(it.product_name) + '</td>' +
          '<td class="num">' + it.quantity + '</td>' +
          '<td class="num">' + fmtPrice(it.unit_price) + '</td>' +
          '<td class="num">' + fmtPrice(it.subtotal) + '</td>' +
        '</tr>'
      ).join("");

      const statusOptions = ["pendiente", "enviado", "preparando", "entregado", "cancelado"];
      const statusOptHtml = statusOptions.map((s) =>
        '<option value="' + s + '"' + (s === o.status ? " selected" : "") + '>' +
          s.charAt(0).toUpperCase() + s.slice(1) +
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
      const reenviarBtn = phone
        ? '<button class="btn-reenviar" type="button">Reenviar por WhatsApp</button>'
        : "";

      det.innerHTML =
        '<table>' +
          '<thead><tr>' +
            '<th>Cod.</th><th>Producto</th>' +
            '<th class="num">Cant.</th><th class="num">Unit.</th><th class="num">Subtotal</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
        (o.notes ? '<div class="order-notes">Nota: ' + escapeHtml(o.notes) + '</div>' : "") +
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
              badge.textContent = sel.value;
            }
            msg.textContent = "Estado actualizado";
            msg.style.color = "#10b981";
          } catch (err) {
            msg.textContent = "Error al actualizar";
            msg.style.color = "#dc2626";
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
          window.open("https://wa.me/" + phone + "?text=" + text, "_blank");
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

  // Selector "Ver como ..." (solo admin). Al cambiar de nivel, re-pedimos
  // los productos al server con el nuevo as_level y re-renderizamos.
  // Nota: el carrito conserva los precios capturados al agregar; si el
  // admin tenia items, los avisamos para que no se confunda.
  if (els.levelSelect) {
    els.levelSelect.addEventListener("change", async () => {
      if (!state.me || state.me.level !== 99) return;
      const lvl = Number(els.levelSelect.value);
      if (![1, 2, 3, 4].includes(lvl)) return;

      if (state.cart.size > 0) {
        const ok = confirm(
          "Tenés " + state.cart.size + " producto(s) en el carrito con precios " +
          "del nivel anterior.\n\n¿Vaciar el carrito y cambiar a " + LEVEL_NAMES[lvl] + "?"
        );
        if (!ok) {
          // Revertir el select al valor previo
          els.levelSelect.value = String(state.viewAsLevel || 1);
          return;
        }
        const ids = Array.from(state.cart.keys());
        state.cart.clear();
        if (els.cartNotes) els.cartNotes.value = "";
        renderCart();
        ids.forEach(refreshCardForProduct);
      }

      state.viewAsLevel = lvl;
      try { localStorage.setItem(LS_VIEW_AS_LEVEL, String(lvl)); } catch (_) {}
      try {
        state.products = await api(productsUrl());
        renderUser();
        renderCategories();
        renderProducts();
      } catch (e) {
        console.error(e);
        alert("No se pudieron cargar los precios para " + LEVEL_NAMES[lvl]);
      }
    });
  }

  els.logoutBtn.addEventListener("click", async () => {
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
    const fmt = (n) => "$" + (Number(n) || 0).toLocaleString("es-AR");
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
            '<h4>Pedido #' + o.id + ' <span class="order-status ' + escapeHtml(o.status) + '">' + escapeHtml(o.status) + '</span></h4>' +
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
    if (e.key === "Escape" && anyDrawerOpen()) closeDrawers();
  });

  bootstrap();
})();
