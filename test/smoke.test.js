/**
 * Pruebas de humo de Maxaria: levantan el server real sobre una base temporal
 * y recorren los circuitos que manejan plata y stock.
 *
 *   npm test
 *
 * No toca data/maxaria.db: crea la base en un directorio temporal a partir de
 * scripts/schema.sql, arranca server.js en un puerto libre y lo apaga al final.
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const ROOT = path.join(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "maxaria-test-"));
const DB_PATH = path.join(TMP, "test.db");
let PORT, BASE, proc;

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

// Cliente HTTP mínimo con cookie de sesión.
function client() {
  let cookie = "";
  async function call(method, url, body) {
    const res = await fetch(BASE + url, {
      method,
      headers: Object.assign({ "Content-Type": "application/json" }, cookie ? { Cookie: cookie } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* no JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  return {
    get: (u) => call("GET", u),
    post: (u, b) => call("POST", u, b || {}),
    patch: (u, b) => call("PATCH", u, b || {}),
    put: (u, b) => call("PUT", u, b || {}),
    del: (u) => call("DELETE", u),
    cookie: () => cookie,
    login: (username, password) => call("POST", "/login", { username, password }),
  };
}

let ids = {};
before(async () => {
  const db = new Database(DB_PATH);
  db.exec(fs.readFileSync(path.join(ROOT, "scripts", "schema.sql"), "utf8"));
  const hash = bcrypt.hashSync("Admin123!", 4);
  db.prepare("INSERT INTO users (username, password_hash, full_name, level, active) VALUES ('admin', ?, 'Admin', 99, 1)").run(hash);
  db.prepare("INSERT INTO categories (name) VALUES ('General')").run();
  const cat = db.prepare("SELECT id FROM categories").get().id;
  const insP = db.prepare("INSERT INTO products (code, category_id, name, cost, price_minorista, price_revendedor, price_mayorista, price_vip, price_publico, stock, active) VALUES (?,?,?,?,?,?,?,?,?,?,1)");
  ids.p1 = insP.run("1001", cat, "Producto uno", 100, 200, 180, 160, 150, 220, 50).lastInsertRowid;
  ids.p2 = insP.run("1002", cat, "Producto dos", 50, 100, 90, 80, 75, 110, 20).lastInsertRowid;
  db.close();

  PORT = await freePort();
  BASE = "http://127.0.0.1:" + PORT;
  proc = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      DB_PATH, PORT: String(PORT), NODE_ENV: "development",
      SESSION_SECRET: "smoke-test-secret-0123456789abcdef",
      CRON_SECRET: "cron-test",
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + "/healthz"); if (r.ok) return; } catch (_) { /* todavia no */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("El server no arrancó:\n" + log);
});

after(() => {
  if (proc) proc.kill();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* windows */ }
});

const admin = client();

function rawDb() { return new Database(DB_PATH); }
function stockOf(pid) { const d = rawDb(); const s = d.prepare("SELECT stock FROM products WHERE id = ?").get(pid).stock; d.close(); return s; }
async function balanceOf(userId) {
  const r = await admin.get("/api/admin/accounts");
  const a = (r.json || []).find((x) => x.user_id === userId || x.id === userId);
  return a ? Math.round(Number(a.balance)) : 0;
}

test("login: clave incorrecta rechazada; el login emite una sesión nueva", async () => {
  const bad = await client().login("admin", "mala");
  assert.equal(bad.status, 401);
  const inexistente = await client().login("nadie", "mala");
  assert.equal(inexistente.status, 401);
  const ok = await admin.login("admin", "Admin123!");
  assert.equal(ok.status, 200, ok.text);
  // Loguearse de nuevo con una cookie de sesión ya existente debe cambiar el id.
  const c = client();
  await c.login("admin", "Admin123!");
  const first = c.cookie();
  await c.login("admin", "Admin123!");
  assert.ok(first && c.cookie() && c.cookie() !== first, "la sesion debe regenerarse al hacer login");
});

test("crear cliente: la clave no queda guardada en texto plano", async () => {
  const r = await admin.post("/api/admin/users", { username: "cliente1", password: "Clave123", full_name: "Cliente Uno", level: 1 });
  assert.equal(r.status, 200, r.text);
  ids.client = r.json.user.id;
  const d = rawDb();
  const row = d.prepare("SELECT plain_password FROM users WHERE id = ?").get(ids.client);
  d.close();
  assert.equal(row.plain_password, null);
  const list = await admin.get("/api/admin/users");
  const u = list.json.find((x) => x.id === ids.client);
  assert.ok(u && !u.plain_password, "el listado no debe exponer claves");
});

test("pedido desde admin: descuenta stock y debita la cuenta", async () => {
  const s1 = stockOf(ids.p1);
  const r = await admin.post("/api/admin/orders", {
    client_id: ids.client,
    items: [{ product_id: ids.p1, product_code: "1001", product_name: "Producto uno", quantity: 3, unit_price: 250 }],
  });
  assert.equal(r.status, 200, r.text);
  ids.order1 = r.json.order ? r.json.order.id : r.json.id;
  assert.ok(ids.order1);
  assert.equal(stockOf(ids.p1), s1 - 3);
  assert.equal(await balanceOf(ids.client), -750, "el precio editado a mano se respeta");
});

test("circuito: pendiente → preparando → listo → entrega con cobro total salda la cuenta", async () => {
  for (const st of ["preparando", "listo"]) {
    const r = await admin.patch("/api/orders/" + ids.order1, { status: st });
    assert.equal(r.status, 200, r.text);
  }
  const s = stockOf(ids.p1);
  const d = await admin.post("/api/orders/" + ids.order1 + "/deliver", { delivered_to: "Cliente", efectivo_amount: 750, transferencia_amount: 0 });
  assert.equal(d.status, 200, d.text);
  assert.equal(stockOf(ids.p1), s, "no debe descontar stock dos veces");
  assert.equal(await balanceOf(ids.client), 0);
});

test("cancelar un pedido devuelve el stock", async () => {
  const s = stockOf(ids.p2);
  const r = await admin.post("/api/admin/orders", {
    client_id: ids.client,
    items: [{ product_id: ids.p2, product_code: "1002", product_name: "Producto dos", quantity: 4, unit_price: 100 }],
  });
  assert.equal(r.status, 200, r.text);
  const oid = r.json.order ? r.json.order.id : r.json.id;
  assert.equal(stockOf(ids.p2), s - 4);
  const c = await admin.patch("/api/orders/" + oid, { status: "cancelado" });
  assert.equal(c.status, 200, c.text);
  assert.equal(stockOf(ids.p2), s);
});

test("cobro posterior: registrar un pago baja la deuda", async () => {
  const r = await admin.post("/api/admin/orders", {
    client_id: ids.client,
    items: [{ product_id: ids.p2, product_code: "1002", product_name: "Producto dos", quantity: 2, unit_price: 100 }],
  });
  const oid = r.json.order ? r.json.order.id : r.json.id;
  assert.equal(await balanceOf(ids.client), -200);
  const p = await admin.post("/api/admin/payments", { user_id: ids.client, amount: 200, order_id: oid });
  assert.equal(p.status, 200, p.text);
  assert.equal(await balanceOf(ids.client), 0);
});

test("pedidos en curso no desaparecen aunque haya más de 200 cerrados", async () => {
  const d = rawDb();
  const old = d.prepare("INSERT INTO orders (user_id, status, total, created_at) VALUES (?, 'pendiente', 10, '2020-01-01 10:00:00')").run(ids.client).lastInsertRowid;
  const ins = d.prepare("INSERT INTO orders (user_id, status, total) VALUES (?, 'entregado', 1)");
  d.transaction(() => { for (let i = 0; i < 230; i++) ins.run(ids.client); })();
  d.close();
  const r = await admin.get("/api/orders");
  assert.equal(r.status, 200);
  assert.ok(r.json.some((o) => o.id === old), "el pedido pendiente viejo debe seguir en la lista");
  const closed = r.json.filter((o) => o.status === "entregado" || o.status === "cancelado").length;
  assert.ok(closed <= 200, "el historial de cerrados se limita a 200");
});

test("permisos: admin limitado no ve usuarios ni exporta; superadmin exporta", async () => {
  const cr = await admin.post("/api/admin/admins", { username: "limitado", password: "Limit123!", full_name: "Limitado", sections: ["pedidos", "usuarios"] });
  assert.equal(cr.status, 200, cr.text);
  const lim = client();
  const l = await lim.login("limitado", "Limit123!");
  assert.equal(l.status, 200);
  const exp = await lim.get("/api/admin/users/export");
  assert.equal(exp.status, 403, "la exportacion con hashes es solo del superadmin");
  const cfg = await lim.get("/api/admin/settings");
  assert.equal(cfg.status, 403);
  const own = await admin.get("/api/admin/users/export");
  assert.equal(own.status, 200);
  const bk = await lim.get("/api/admin/backup/download");
  assert.equal(bk.status, 403, "la descarga de la base es solo del superadmin");
  const bk2 = await fetch(BASE + "/api/admin/backup/download", { headers: { Cookie: admin.cookie() } });
  assert.equal(bk2.status, 200);
  const buf = Buffer.from(await bk2.arrayBuffer());
  assert.equal(buf.slice(0, 15).toString(), "SQLite format 3");
});

test("link de acceso: entra, y vencido ya no entra", async () => {
  const g = await admin.post("/api/admin/users/" + ids.client + "/access-link");
  assert.equal(g.status, 200, g.text);
  const d = rawDb();
  const tok = d.prepare("SELECT access_token FROM users WHERE id = ?").get(ids.client).access_token;
  d.close();
  const c = client();
  const ok = await c.get("/c/" + tok);
  assert.equal(ok.status, 302);
  assert.match(ok.headers.get("location") || "", /catalogo/);
  const d2 = rawDb();
  d2.prepare("UPDATE users SET access_token_created_at = '2000-01-01 00:00:00', access_token_last_used_at = '2000-01-01 00:00:00' WHERE id = ?").run(ids.client);
  d2.close();
  const c2 = client();
  const ko = await c2.get("/c/" + tok);
  assert.equal(ko.status, 410, "un link vencido no debe abrir sesion");
});

test("CSP activa y sin scripts inline en las páginas", async () => {
  const r = await fetch(BASE + "/login");
  const csp = r.headers.get("content-security-policy") || "";
  assert.match(csp, /script-src 'self'/);
  for (const f of ["login.html", "index.html", "admin.html", "ventas.html"]) {
    const html = fs.readFileSync(path.join(ROOT, "public", f), "utf8");
    assert.doesNotMatch(html, /<script>(?!\s*<\/script>)/, f + " tiene un <script> inline");
    assert.doesNotMatch(html, /\son[a-z]+="/i, f + " tiene un handler inline (onclick=...)");
  }
});

test("reporte de deudores (lógica compartida con el aviso diario)", async () => {
  const d = rawDb();
  d.prepare("INSERT INTO account_movements (user_id, type, amount, description, created_at) VALUES (?, 'debit', 5000, 'viejo', datetime('now','-45 days'))").run(ids.client);
  d.close();
  const r = await fetch(BASE + "/api/cron/debt-report", { headers: { "x-cron-token": "cron-test" } });
  const j = await r.json();
  assert.equal(r.status, 200);
  const me = j.deudores.find((x) => x.id === ids.client);
  assert.ok(me && me.days_overdue >= 45 && me.balance === -5000, JSON.stringify(j));
  const bad = await fetch(BASE + "/api/cron/debt-report?token=mal");
  assert.equal(bad.status, 401);
});

test("catálogo PDF de un cliente respeta sus categorías permitidas", async () => {
  const d = rawDb();
  const cat2 = d.prepare("INSERT INTO categories (name) VALUES ('Restringida')").run().lastInsertRowid;
  d.prepare("INSERT INTO products (code, category_id, name, cost, price_minorista, stock, active) VALUES ('2001', ?, 'Otro', 1, 2, 5, 1)").run(cat2);
  const general = d.prepare("SELECT id FROM categories WHERE name = 'General'").get().id;
  d.prepare("INSERT INTO user_category_access (user_id, category_id) VALUES (?, ?)").run(ids.client, general);
  d.close();
  const r = await admin.post("/api/admin/catalog/pdf", { priceConfig: { type: "client", userId: ids.client }, categoryIds: [Number(cat2)], withImages: false });
  assert.equal(r.status, 400, "no debe generar un catálogo con categorías no habilitadas");
  const ok = await fetch(BASE + "/api/admin/catalog/pdf", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: admin.cookie() },
    body: JSON.stringify({ priceConfig: { type: "client", userId: ids.client }, categoryIds: [], withImages: false }),
  });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("content-type") || "", /pdf/);
});

test("PDFs de documentos (módulo lib/pdf-docs): remito con y sin precios", async () => {
  for (const q of ["", "?precios=0"]) {
    const r = await fetch(BASE + "/api/admin/orders/" + ids.order1 + "/pdf" + q, { headers: { Cookie: admin.cookie() } });
    assert.equal(r.status, 200, "remito " + q);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.slice(0, 4).toString(), "%PDF");
  }
});

test("detalle de pedido informa la deuda del cliente por otros pedidos", async () => {
  const r = await admin.post("/api/admin/orders", {
    client_id: ids.client,
    items: [{ product_id: ids.p2, product_code: "1002", product_name: "Producto dos", quantity: 1, unit_price: 300 }],
  });
  const oid = r.json.order ? r.json.order.id : r.json.id;
  const d = await admin.get("/api/orders/" + oid);
  assert.equal(d.status, 200);
  // Todo lo que debe el cliente menos este pedido (-300).
  assert.equal(Math.round(d.json.client_other_balance), (await balanceOf(ids.client)) + 300);
});

test("pago a cuenta (sin pedido) se reparte entre los pedidos del más viejo al más nuevo", async () => {
  const cr = await admin.post("/api/admin/users", { username: "cliente2", password: "Clave123", full_name: "Cliente Dos", level: 1 });
  const cid = cr.json.user.id;
  const mk = async (qty) => {
    const r = await admin.post("/api/admin/orders", {
      client_id: cid,
      items: [{ product_id: ids.p1, product_code: "1001", product_name: "Producto uno", quantity: qty, unit_price: 100 }],
    });
    return r.json.order ? r.json.order.id : r.json.id;
  };
  const o1 = await mk(1); // $100
  await new Promise((r) => setTimeout(r, 1100)); // created_at distinto
  const o2 = await mk(2); // $200
  const p = await admin.post("/api/admin/payments", { user_id: cid, amount: 150 });
  assert.equal(p.status, 200, p.text);
  const d1 = (await admin.get("/api/orders/" + o1)).json;
  const d2 = (await admin.get("/api/orders/" + o2)).json;
  assert.equal(Math.round(d1.balance_due), 0, "el más viejo queda saldado");
  assert.equal(Math.round(d2.balance_due), 150, "al nuevo le toca el resto (50)");
  assert.equal(Math.round(d2.prepaid_for_delivery), 50);
  const list = (await admin.get("/api/orders")).json;
  const l2 = list.find((o) => o.id === o2);
  assert.equal(Math.round(l2.debit_total - l2.amount_paid), 150);
  await admin.post("/api/admin/payments", { user_id: cid, amount: 150 });
  const d2b = (await admin.get("/api/orders/" + o2)).json;
  assert.equal(Math.round(d2b.balance_due), 0);
  assert.equal(await balanceOf(cid), 0);
});

// ---- Stock: bugs corregidos el 23/9/2026 --------------------------------
function newProduct(code, stock) {
  const d = rawDb();
  const cat = d.prepare("SELECT id FROM categories").get().id;
  const id = d.prepare(
    "INSERT INTO products (code, category_id, name, cost, price_minorista, price_revendedor, price_mayorista, price_vip, price_publico, stock, active)" +
    " VALUES (?,?,?,100,200,180,160,150,220,?,1)"
  ).run(code, cat, "Prod " + code, stock).lastInsertRowid;
  d.close();
  return id;
}
async function adminOrder(pid, qty) {
  const r = await admin.post("/api/admin/orders", {
    client_id: ids.client,
    items: [{ product_id: pid, product_code: "x", product_name: "x", quantity: qty, unit_price: 100 }],
  });
  assert.equal(r.status, 200, r.text);
  return r.json.order ? r.json.order.id : r.json.id;
}
async function itemsOf(oid) {
  const r = await admin.get("/api/orders/" + oid);
  assert.equal(r.status, 200, r.text);
  return r.json.items;
}

test("armado sin confirmar: al entregar se aplica lo armado (stock = lo que salió)", async () => {
  const pid = newProduct("S1", 100);
  const oid = await adminOrder(pid, 10);
  assert.equal(stockOf(pid), 90);
  await admin.patch("/api/orders/" + oid, { status: "preparando" });
  const it = (await itemsOf(oid))[0];
  const pk = await admin.post("/api/admin/picks/" + oid, { item_id: it.id, picked_qty: 6 });
  assert.equal(pk.status, 200, pk.text);
  // Pasa directo a entregado (sin confirmar el chequeo)
  const d = await admin.post("/api/orders/" + oid + "/deliver", { delivered_to: "X", efectivo_amount: 600, transferencia_amount: 0 });
  assert.equal(d.status, 200, d.text);
  assert.equal(stockOf(pid), 94, "sale lo armado (6), no lo pedido (10)");
  assert.equal((await itemsOf(oid))[0].quantity, 6);
});

test("armado sin confirmar: pasar a Entregas por PATCH también lo aplica", async () => {
  const pid = newProduct("S2", 100);
  const oid = await adminOrder(pid, 10);
  await admin.patch("/api/orders/" + oid, { status: "preparando" });
  const it = (await itemsOf(oid))[0];
  await admin.post("/api/admin/picks/" + oid, { item_id: it.id, picked_qty: 12 });
  const r = await admin.patch("/api/orders/" + oid, { status: "listo" });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.pick_applied, 1);
  assert.equal(stockOf(pid), 88);
});

test("editar producto con el stock viejo del cache no pisa las ventas del medio", async () => {
  const pid = newProduct("S3", 50);
  await adminOrder(pid, 5); // stock real 45, el modal se abrió viendo 50
  const stale = await admin.patch("/api/admin/products/" + pid, { stock: 50, stock_expected: 50, name: "Prod S3" });
  assert.equal(stale.status, 409, stale.text);
  assert.equal(stockOf(pid), 45);
  const soloPrecio = await admin.patch("/api/admin/products/" + pid, { price_minorista: 250 });
  assert.equal(soloPrecio.status, 200, soloPrecio.text);
  assert.equal(stockOf(pid), 45);
  const bulk = await admin.post("/api/admin/products/bulk-update", { patches: [{ id: pid, stock: 50, stock_expected: 50, name: "S3b" }] });
  assert.equal(bulk.status, 200, bulk.text);
  assert.equal(bulk.json.stock_conflicts.length, 1);
  assert.equal(stockOf(pid), 45);
});

test("pedido del catálogo: lleva su propio stock, sin presupuesto sombra; borrarlo lo devuelve", async () => {
  const pid = newProduct("S4", 30);
  const cli = client();
  const lg = await cli.login("cliente1", "Clave123");
  assert.equal(lg.status, 200, lg.text);
  const r = await cli.post("/api/orders", { items: [{ id: pid, qty: 4 }] });
  assert.equal(r.status, 200, r.text);
  const oid = r.json.order.id;
  assert.equal(stockOf(pid), 26);
  const d = rawDb();
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM budgets WHERE order_id = ?").get(oid).n, 0, "no crea presupuesto sombra");
  assert.equal(d.prepare("SELECT stock_discounted FROM orders WHERE id = ?").get(oid).stock_discounted, 1);
  d.close();
  const del = await admin.del("/api/admin/orders/" + oid);
  assert.equal(del.status, 200, del.text);
  assert.equal(stockOf(pid), 30);
});

test("pedido del catálogo: entregarlo por estado no re-descuenta y debita la cuenta", async () => {
  const pid = newProduct("S5", 30);
  const cli = client();
  await cli.login("cliente1", "Clave123");
  const r = await cli.post("/api/orders", { items: [{ id: pid, qty: 5 }] });
  const oid = r.json.order.id;
  assert.equal(stockOf(pid), 25);
  const e = await admin.patch("/api/orders/" + oid, { status: "entregado" });
  assert.equal(e.status, 200, e.text);
  assert.equal(stockOf(pid), 25);
  const d = rawDb();
  const deb = d.prepare("SELECT COUNT(*) AS n FROM account_movements WHERE order_id = ? AND type = 'debit'").get(oid).n;
  d.close();
  assert.equal(deb, 1);
});

test("Ventas solo lista presupuestos armados en Ventas (los sombra viejos no)", async () => {
  const d = rawDb();
  const oid = d.prepare("SELECT id FROM orders ORDER BY id DESC LIMIT 1").get().id;
  const sombra = d.prepare(
    "INSERT INTO budgets (number, client_name, status, order_id, source, subtotal, total) VALUES ('9999-1','x','enviado',?,'pedido',0,0)"
  ).run(oid).lastInsertRowid;
  d.close();
  const b = await admin.post("/api/budgets", { client_name: "Mostrador", items: [{ product_id: ids.p1, quantity: 1, unit_price: 10 }] });
  assert.equal(b.status, 200, b.text);
  const list = await admin.get("/api/budgets");
  const listIds = list.json.map((x) => x.id);
  assert.ok(listIds.includes(b.json.id));
  assert.ok(!listIds.includes(sombra));
  const mut = await admin.patch("/api/budgets/" + sombra + "/status", { status: "cancelado" });
  assert.equal(mut.status, 409);
});

test("editar items con un producto repetido en dos líneas no infla el pedido ni el stock", async () => {
  const pid = newProduct("S6", 100);
  const oid = await adminOrder(pid, 10);
  const e = await admin.put("/api/admin/orders/" + oid + "/items", {
    items: [{ product_id: pid, quantity: 10, unit_price: 100 }, { product_id: pid, quantity: 5, unit_price: 100 }],
  });
  assert.equal(e.status, 200, e.text);
  const items = await itemsOf(oid);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 15);
  assert.equal(stockOf(pid), 85);
});

test("pedido unificado: al entregarlo no vuelve a descontar el stock de los hijos", async () => {
  const pid = newProduct("S7", 100);
  const child = await adminOrder(pid, 10); // el hijo descuenta al crearse
  assert.equal(stockOf(pid), 90);
  const d = rawDb();
  const parent = d.prepare(
    "INSERT INTO orders (user_id, status, total, is_unified, stock_discounted) VALUES (?, 'pendiente', 1000, 1, 1)"
  ).run(ids.client).lastInsertRowid;
  d.prepare("INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, subtotal) VALUES (?,?,?,?,10,100,1000)")
    .run(parent, pid, "S7", "Prod S7");
  d.prepare("UPDATE orders SET status='enviado', unified_parent_id=? WHERE id=?").run(parent, child);
  d.close();
  const r = await admin.patch("/api/orders/" + parent, { status: "entregado" });
  assert.equal(r.status, 200, r.text);
  assert.equal(stockOf(pid), 90);
});
