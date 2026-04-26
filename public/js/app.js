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
    adminLink: document.getElementById("admin-link"),
    backdrop: document.getElementById("drawer-backdrop"),
  };

  const state = {
    me: null, categories: [], products: [], cat: "all", query: "",
    cart: new Map(),
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

  async function bootstrap() {
    try {
      const [me, cats, prods] = await Promise.all([
        api("/api/me"), api("/api/categories"), api("/api/products"),
      ]);
      state.me = me; state.categories = cats; state.products = prods;
      renderUser(); renderCategories(); renderProducts();
    } catch (e) { console.error(e); }
  }

  function renderUser() {
    const u = state.me; if (!u) return;
    els.userInfo.textContent = (u.fullName || u.username) + " - " + u.levelName;
    if (els.ordersBtn) {
      els.ordersBtn.textContent = u.level === 99 ? "Todos los pedidos" : "Mis pedidos";
    }
    if (els.adminLink) {
      els.adminLink.hidden = u.level !== 99;
    }
  }

  function renderCategories() {
    const items = [
      '<li><button class="cat-btn ' + (state.cat === "all" ? "active" : "") + '" data-cat="all">Todas (' + state.products.length + ')</button></li>',
    ];
    state.categories.forEach((c) => {
      const count = state.products.filter((p) => p.category_id === c.id).length;
      if (!count) return;
      items.push(
        '<li><button class="cat-btn ' + (state.cat === c.id ? "active" : "") + '" data-cat="' + c.id + '">' + escapeHtml(c.name) + ' (' + count + ')</button></li>'
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
    drawer.hidden = false;
    els.backdrop.hidden = false;
    if (!drawerHistoryPushed) {
      try { history.pushState({ drawerOpen: true }, ""); } catch (_) {}
      drawerHistoryPushed = true;
    }
  }

  function closeDrawers(fromPopState) {
    const wasOpen = !els.cartDrawer.hidden || !els.ordersDrawer.hidden;
    els.cartDrawer.hidden = true;
    els.ordersDrawer.hidden = true;
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

  // Click en el fondo oscuro = cerrar
  els.backdrop.addEventListener("click", () => { closeDrawers(); });

  // Boton "atras" del navegador / celular
  window.addEventListener("popstate", () => {
    if (!els.cartDrawer.hidden || !els.ordersDrawer.hidden) {
      closeDrawers(true);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (!els.cartDrawer.hidden || !els.ordersDrawer.hidden)) {
      closeDrawers();
    }
  });

  bootstrap();
})();
