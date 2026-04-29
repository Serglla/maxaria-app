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
      // Pedimos /api/me PRIMERO para saber si es admin y, en ese caso,
      // recuperar el nivel "ver como ..." que tenia guardado.
      const me = await api("/api/me");
      state.me = me;
      if (me.level === 99) {
        state.viewAsLevel = loadViewAsLevel();
      }
      const [cats, prods] = await Promise.all([
        api("/api/categories"), api(productsUrl()),
      ]);
      state.categories = cats; state.products = prods;
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
    if (els.adminLink) {
      els.adminLink.hidden = u.level !== 99;
    }
    if (els.priceChangesBtn) {
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
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
    els.grid.innerHTML = list.map(cardHtml).join("");
    // Event delegation: un solo handler en la grilla maneja add/inc/dec
    // de TODOS los cards. Asi no hay que re-bindear handlers cada
    // vez que se vuelve a renderizar la accion de un card.
  }

  function cardHtml(p) {
    const img = p.image_url
      ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" />'
      : '<div class="muted" style="font-size:12px;padding:8px;text-align:center">Sin foto</div>';
    const inCart = state.cart.has(p.id);
    return '<article class="card' + (inCart ? ' in-cart' : '') + '" data-id="' + p.id + '">' +
      '<div class="card-img">' + img + '</div>' +
      '<div class="card-body">' +
        '<div class="card-cat">' + escapeHtml(p.category_name || "") + '</div>' +
        '<div class="card-name" title="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</div>' +
        (p.code ? '<div class="card-code">' + escapeHtml(p.code) + '</div>' : '') +
        '<div class="card-foot">' +
          '<div class="card-price">' + fmtPrice(p.price) + '</div>' +
          '<div class="card-actions" data-id="' + p.id + '">' + cardActionHtml(p.id) + '</div>' +
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
      '<span class="card-qty-num">' + item.qty + '</span>' +
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

  function removeFromCart(id) {
    state.cart.delete(id);
    renderCart();
    refreshCardForProduct(id);
  }
  function cartTotal() { let t = 0; state.cart.forEach((it) => (t += it.price * it.qty)); return t; }
  function cartCount() { let n = 0; state.cart.forEach((it) => (n += it.qty)); return n; }

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
    els.cartBody.innerHTML = items.map(cartItemHtml).join("");
    els.cartTotal.textContent = fmtPrice(total);
    els.cartSend.disabled = false;
    els.cartBody.querySelectorAll("[data-act]").forEach((btn) => {
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      btn.addEventListener("click", () => {
        if (act === "inc") changeQty(id, +1);
        else if (act === "dec") changeQty(id, -1);
        else if (act === "del") removeFromCart(id);
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
          '<span>' + it.qty + '</span>' +
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
    const lines = [];
    lines.push("Hola Maxaria! Soy " + (u.fullName || u.username) + " (" + u.levelName + ").");
    lines.push("Quiero hacer este pedido:");
    lines.push("");
    state.cart.forEach((it) => {
      lines.push("- " + it.qty + " x " + it.name + " - " + fmtPrice(it.price) + " = " + fmtPrice(it.price * it.qty));
    });
    lines.push("");
    lines.push("*Total: " + fmtPrice(cartTotal()) + "*");
    if (notes) { lines.push(""); lines.push("Nota: " + notes); }
    return lines.join("\n");
  }

  function buildWhatsappMessageFromOrder(order) {
    const u = state.me;
    const lines = [];
    lines.push("Hola Maxaria! Soy " + (u.fullName || u.username) + " (" + u.levelName + ").");
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
      alert("No hay numero de WhatsApp configurado.\nPedile al admin que complete WHATSAPP_NUMBER en .env");
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

  // ----- Cambios de precio (ultima actualizacion) -----
  async function openPriceChanges() {
    els.pcBody.innerHTML = '<p class="muted">Cargando…</p>';
    openDrawer(els.priceChangesDrawer);
    try {
      const url = state.me && state.me.level === 99 && state.viewAsLevel
        ? "/api/price-changes?as_level=" + state.viewAsLevel
        : "/api/price-changes";
      const data = await api(url);
      els.pcBody.innerHTML = renderPriceChangesHtml(data);
    } catch (e) {
      const msg = e && e.message ? e.message : "Error";
      els.pcBody.innerHTML = '<p class="muted">' + escapeHtml(msg) + '</p>';
    }
  }

  function renderPriceChangesHtml(data) {
    if (!data || !data.update) {
      return '<p class="muted">Todavía no se subió ninguna actualización de precios.</p>';
    }
    const u = data.update;
    const date = formatDate(u.created_at);
    const lvl = data.levelName ? ' · Lista <strong>' + escapeHtml(data.levelName) + '</strong>' : '';
    const header =
      '<div class="pc-summary">' +
        '<div><strong>Última actualización:</strong> ' + escapeHtml(date) + lvl + '</div>' +
        '<div class="muted">' + (u.products_changed || 0) + ' producto(s) con cambio de precio · ' +
          (u.products_new || 0) + ' producto(s) nuevo(s)' + '</div>' +
      '</div>';

    const cambios = data.cambios || [];
    const nuevos = data.nuevos || [];

    let cambiosBlock = '';
    if (!cambios.length) {
      cambiosBlock = '<p class="muted">Sin cambios de precio en tu lista.</p>';
    } else {
      const subas = cambios.filter((c) => c.delta > 0).length;
      const bajas = cambios.filter((c) => c.delta < 0).length;
      cambiosBlock =
        '<h4 class="pc-section-title">' +
          'Cambios de precio ' +
          '<span class="muted">(' + subas + ' suba(s), ' + bajas + ' baja(s))</span>' +
        '</h4>' +
        '<table class="pc-table">' +
          '<thead><tr>' +
            '<th>Código</th><th>Producto</th>' +
            '<th class="num">Anterior</th><th class="num">Nuevo</th>' +
            '<th class="num">Var.</th>' +
          '</tr></thead>' +
          '<tbody>' + cambios.map(pcRowHtml).join("") + '</tbody>' +
        '</table>';
    }

    let nuevosBlock = '';
    if (nuevos.length) {
      nuevosBlock =
        '<h4 class="pc-section-title">Productos nuevos <span class="muted">(' + nuevos.length + ')</span></h4>' +
        '<table class="pc-table">' +
          '<thead><tr><th>Código</th><th>Producto</th><th class="num">Precio</th></tr></thead>' +
          '<tbody>' + nuevos.map(pcNewRowHtml).join("") + '</tbody>' +
        '</table>';
    }

    return header + cambiosBlock + nuevosBlock;
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

  async function openOrders() {
    const isAdmin = state.me && state.me.level === 99;
    els.ordersTitle.textContent = isAdmin ? "Todos los pedidos" : "Mis pedidos";
    els.ordersBody.innerHTML = '<p class="muted">Cargando...</p>';
    openDrawer(els.ordersDrawer);
    try {
      const orders = await api("/api/orders");
      if (!orders.length) {
        els.ordersBody.innerHTML = '<p class="muted">Todavia no hay pedidos.</p>';
        return;
      }
      els.ordersBody.innerHTML = orders.map((o) => orderCardHtml(o, isAdmin)).join("");
      els.ordersBody.querySelectorAll(".order-card").forEach((card) => {
        card.querySelector(".order-head").addEventListener("click", () => {
          toggleOrderDetail(card, Number(card.dataset.id));
        });
      });
    } catch (e) {
      els.ordersBody.innerHTML = '<p class="muted">Error cargando pedidos.</p>';
    }
  }

  function orderCardHtml(o, isAdmin) {
    const date = formatDate(o.created_at);
    const who = isAdmin && o.username
      ? ' <span class="meta"> - ' + escapeHtml(o.full_name || o.username) + '</span>'
      : "";
    return '<article class="order-card" data-id="' + o.id + '">' +
      '<header class="order-head" title="Click para ver el detalle">' +
        '<div>' +
          '<h4>Pedido #' + o.id + ' <span class="order-status ' + escapeHtml(o.status) + '">' + escapeHtml(o.status) + '</span></h4>' +
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
    const btn = e.target.closest("[data-act][data-id]");
    if (!btn || !els.grid.contains(btn)) return;
    const id = Number(btn.dataset.id);
    const act = btn.dataset.act;
    if (act === "add" || act === "inc") changeQty(id, +1);
    else if (act === "dec") changeQty(id, -1);
  });

  // ----- Apertura / cierre de los drawers -----
  // El estado "hay un drawer abierto" tambien se refleja como
  // una entrada en el history del navegador, asi el boton "atras"
  // del navegador (o del celular) cierra el drawer en vez de
  // sacar al usuario del catalogo.
  let drawerHistoryPushed = false;

  function openDrawer(drawer) {
    // Si ya habia otro drawer abierto, lo ocultamos sin tocar el history
    els.cartDrawer.hidden = true;
    els.ordersDrawer.hidden = true;
    if (els.priceChangesDrawer) els.priceChangesDrawer.hidden = true;
    drawer.hidden = false;
    els.backdrop.hidden = false;
    if (!drawerHistoryPushed) {
      try { history.pushState({ drawerOpen: true }, ""); } catch (_) {}
      drawerHistoryPushed = true;
    }
  }

  function anyDrawerOpen() {
    return !els.cartDrawer.hidden || !els.ordersDrawer.hidden ||
           (els.priceChangesDrawer && !els.priceChangesDrawer.hidden);
  }

  function closeDrawers(fromPopState) {
    const wasOpen = anyDrawerOpen();
    els.cartDrawer.hidden = true;
    els.ordersDrawer.hidden = true;
    if (els.priceChangesDrawer) els.priceChangesDrawer.hidden = true;
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

  if (els.priceChangesBtn) {
    els.priceChangesBtn.addEventListener("click", openPriceChanges);
  }
  if (els.pcClose) els.pcClose.addEventListener("click", () => { closeDrawers(); });
  if (els.pcBack)  els.pcBack.addEventListener("click",  () => { closeDrawers(); });

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
