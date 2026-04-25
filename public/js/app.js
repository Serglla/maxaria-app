/**
 * Maxaria - frontend del catalogo
 *
 * Carga categorias y productos desde la API (con el precio segun el nivel del usuario logueado).
 * Permite filtrar por categoria, buscar, agregar al carrito y enviar el pedido por WhatsApp.
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
    cartDrawer: document.getElementById("cart-drawer"),
    cartClose: document.getElementById("cart-close"),
    cartBody: document.getElementById("cart-body"),
    cartTotal: document.getElementById("cart-total"),
    cartSend: document.getElementById("cart-send"),
  };

  const state = {
    me: null,
    categories: [],
    products: [],
    cat: "all",
    query: "",
    cart: new Map(), // id -> { id, name, price, qty, image }
  };

  // ------------ Util ------------
  function fmtPrice(n) {
    const x = Number(n) || 0;
    return "$" + x.toLocaleString("es-AR");
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ------------ Fetch ------------
  async function api(url, opts) {
    const res = await fetch(url, opts);
    if (res.status === 401) {
      location.href = "/login";
      throw new Error("no auth");
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Error " + res.status);
    }
    return res.json();
  }

  async function bootstrap() {
    try {
      const [me, cats, prods] = await Promise.all([
        api("/api/me"),
        api("/api/categories"),
        api("/api/products"),
      ]);
      state.me = me;
      state.categories = cats;
      state.products = prods;
      renderUser();
      renderCategories();
      renderProducts();
    } catch (e) {
      console.error(e);
    }
  }

  // ------------ Render ------------
  function renderUser() {
    const u = state.me;
    if (!u) return;
    els.userInfo.textContent =
      (u.fullName || u.username) + " · " + u.levelName;
  }

  function renderCategories() {
    const items = [
      `<li><button class="cat-btn ${state.cat === "all" ? "active" : ""}" data-cat="all">Todas (${state.products.length})</button></li>`,
    ];
    state.categories.forEach((c) => {
      const count = state.products.filter((p) => p.category_id === c.id).length;
      if (!count) return;
      items.push(
        `<li><button class="cat-btn ${state.cat === c.id ? "active" : ""}" data-cat="${c.id}">
           ${escapeHtml(c.name)} (${count})
         </button></li>`
      );
    });
    els.catList.innerHTML = items.join("");
    els.catList.querySelectorAll(".cat-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.cat;
        state.cat = v === "all" ? "all" : Number(v);
        renderCategories();
        renderProducts();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function filterProducts() {
    let list = state.products;
    if (state.cat !== "all") {
      list = list.filter((p) => p.category_id === state.cat);
    }
    if (state.query) {
      const q = state.query.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.category_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }

  function renderProducts() {
    const list = filterProducts();
    els.resultCount.textContent =
      list.length + (list.length === 1 ? " producto" : " productos");
    if (!list.length) {
      els.grid.innerHTML = "";
      els.empty.hidden = false;
      return;
    }
    els.empty.hidden = true;
    els.grid.innerHTML = list.map(cardHtml).join("");
    els.grid.querySelectorAll(".card-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        addToCart(id);
      });
    });
  }

  function cardHtml(p) {
    const img = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
      : `<div class="muted" style="font-size:12px;padding:8px;text-align:center">Sin foto</div>`;
    return `
      <article class="card" data-id="${p.id}">
        <div class="card-img">${img}</div>
        <div class="card-body">
          <div class="card-cat">${escapeHtml(p.category_name || "")}</div>
          <div class="card-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
          <div class="card-foot">
            <div class="card-price">${fmtPrice(p.price)}</div>
            <button class="card-add" data-id="${p.id}" type="button" title="Agregar al carrito">+</button>
          </div>
        </div>
      </article>
    `;
  }

  // ------------ Carrito ------------
  function addToCart(id) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    const cur = state.cart.get(id);
    if (cur) {
      cur.qty += 1;
    } else {
      state.cart.set(id, {
        id: p.id,
        name: p.name,
        price: p.price,
        qty: 1,
        image: p.image_url,
      });
    }
    flashAddedFeedback(id);
    renderCart();
  }

  function flashAddedFeedback(id) {
    const card = els.grid.querySelector(`.card[data-id="${id}"] .card-add`);
    if (!card) return;
    const original = card.textContent;
    card.textContent = "✓";
    card.style.background = "#10b981";
    card.style.color = "#fff";
    setTimeout(() => {
      card.textContent = original;
      card.style.background = "";
      card.style.color = "";
    }, 600);
  }

  function changeQty(id, delta) {
    const item = state.cart.get(id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) state.cart.delete(id);
    renderCart();
  }

  function removeFromCart(id) {
    state.cart.delete(id);
    renderCart();
  }

  function cartTotal() {
    let t = 0;
    state.cart.forEach((it) => (t += it.price * it.qty));
    return t;
  }

  function cartCount() {
    let n = 0;
    state.cart.forEach((it) => (n += it.qty));
    return n;
  }

  function renderCart() {
    const items = Array.from(state.cart.values());
    els.cartCount.textContent = cartCount();
    if (!items.length) {
      els.cartBody.innerHTML = `<p class="muted">Tu carrito está vacío.</p>`;
      els.cartTotal.textContent = "$0";
      els.cartSend.disabled = true;
      return;
    }
    els.cartBody.innerHTML = items.map(cartItemHtml).join("");
    els.cartTotal.textContent = fmtPrice(cartTotal());
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
    return `
      <div class="cart-item">
        <div>
          <h4>${escapeHtml(it.name)}</h4>
          <div class="meta">${fmtPrice(it.price)} c/u</div>
          <div class="qty">
            <button data-act="dec" data-id="${it.id}" type="button">−</button>
            <span>${it.qty}</span>
            <button data-act="inc" data-id="${it.id}" type="button">+</button>
          </div>
          <button class="remove" data-act="del" data-id="${it.id}" type="button">Quitar</button>
        </div>
        <div class="line-total">${fmtPrice(it.price * it.qty)}</div>
      </div>
    `;
  }

  function buildWhatsappMessage() {
    const u = state.me;
    const lines = [];
    lines.push(`Hola Maxaria! Soy ${u.fullName || u.username} (${u.levelName}).`);
    lines.push(`Quiero hacer este pedido:`);
    lines.push("");
    state.cart.forEach((it) => {
      lines.push(
        `• ${it.qty} x ${it.name} — ${fmtPrice(it.price)} = ${fmtPrice(it.price * it.qty)}`
      );
    });
    lines.push("");
    lines.push(`*Total: ${fmtPrice(cartTotal())}*`);
    return lines.join("\n");
  }

  function sendCart() {
    if (!state.cart.size) return;
    const phone = (state.me && state.me.whatsapp) || "";
    if (!phone) {
      alert(
        "No hay número de WhatsApp configurado.\n" +
        "Pedile al admin que complete WHATSAPP_NUMBER en el archivo .env"
      );
      return;
    }
    const text = encodeURIComponent(buildWhatsappMessage());
    const url = `https://wa.me/${phone}?text=${text}`;
    window.open(url, "_blank");
  }

  // ------------ Eventos ------------
  els.search.addEventListener(
    "input",
    debounce(() => {
      state.query = els.search.value.trim();
      renderProducts();
    }, 150)
  );

  els.logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/logout", { method: "POST" });
    } finally {
      location.href = "/login";
    }
  });

  els.cartBtn.addEventListener("click", () => {
    els.cartDrawer.hidden = false;
  });
  els.cartClose.addEventListener("click", () => {
    els.cartDrawer.hidden = true;
  });
  els.cartSend.addEventListener("click", sendCart);

  // ESC cierra el drawer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") els.cartDrawer.hidden = true;
  });

  bootstrap();
})();
