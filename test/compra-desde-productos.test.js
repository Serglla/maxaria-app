/**
 * "🛒 Armar pedido" desde la selección de Productos: el plan devuelve el
 * proveedor deducido del historial, la venta por día y lo que ya viene en
 * camino; el pedido se crea con /api/admin/pedidos-prov.
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./_harness");

let srv, admin;
const ids = {};

before(async () => {
  srv = await startServer((db) => {
    db.prepare("INSERT INTO categories (name) VALUES ('General')").run();
    const ins = db.prepare("INSERT INTO products (code, category_id, name, cost, price_minorista, price_revendedor, price_mayorista, price_vip, price_publico, stock, active) VALUES (?,1,?,?,?,?,?,?,?,?,1)");
    ids.a = ins.run("5001", "Alfa", 100, 200, 190, 180, 170, 220, 10).lastInsertRowid;
    ids.b = ins.run("5002", "Beta", 50, 90, 85, 80, 75, 100, 0).lastInsertRowid;
  });
  admin = srv.client();
  assert.equal((await admin.login("admin", "Admin123!")).status, 200);
});
after(() => srv && srv.stop());

test("armar pedido desde Productos: proveedor deducido, venta por día y en camino", async () => {
  const db = srv.db();
  const sid = db.prepare("INSERT INTO suppliers (name, active) VALUES ('Prov Uno', 1)").run().lastInsertRowid;
  // Compra ya recibida de Alfa a ese proveedor (sirve para deducirlo) y otra sin recibir (en camino).
  const po1 = db.prepare("INSERT INTO purchase_orders (supplier_id, total_cost, received) VALUES (?, 0, 1)").run(sid).lastInsertRowid;
  db.prepare("INSERT INTO purchase_items (purchase_order_id, product_id, product_code, product_name, quantity, unit_cost, subtotal) VALUES (?,?,?,?,5,100,500)").run(po1, ids.a, "5001", "Alfa");
  const po2 = db.prepare("INSERT INTO purchase_orders (supplier_id, total_cost, received) VALUES (?, 0, 0)").run(sid).lastInsertRowid;
  db.prepare("INSERT INTO purchase_items (purchase_order_id, product_id, product_code, product_name, quantity, unit_cost, subtotal) VALUES (?,?,?,?,7,100,700)").run(po2, ids.a, "5001", "Alfa");
  // Ventas recientes de Alfa.
  const uid = db.prepare("SELECT id FROM users WHERE username = 'admin'").get().id;
  for (let d = 0; d < 10; d++) {
    const oid = db.prepare("INSERT INTO orders (user_id, status, total, created_at) VALUES (?, 'entregado', 0, datetime('now', ?))").run(uid, "-" + d + " days").lastInsertRowid;
    db.prepare("INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, subtotal) VALUES (?,?,?,?,4,0,0)").run(oid, ids.a, "5001", "Alfa");
  }
  db.close();

  const r = await admin.post("/api/admin/products-purchase-plan", { product_ids: [ids.a, ids.b] });
  assert.equal(r.status, 200, r.text);
  const a = r.json.items.find((x) => x.product_id === ids.a);
  const b = r.json.items.find((x) => x.product_id === ids.b);
  assert.equal(a.supplier_id, sid);
  assert.equal(a.supplier_source, "historico");
  assert.ok(a.daily > 0, "Alfa vende");
  assert.equal(a.en_camino, 7);
  assert.equal(b.supplier_id, null);
  assert.equal(b.daily, 0);
  assert.ok(r.json.suppliers.some((s) => s.id === sid));

  assert.equal((await admin.post("/api/admin/products-purchase-plan", { product_ids: [] })).status, 400);

  // Crear el pedido (lo que manda el modal) y que cuente como en camino.
  const p = await admin.post("/api/admin/pedidos-prov", {
    supplier_id: sid, notes: "Armado desde Productos",
    items: [{ product_id: ids.a, product_code: "5001", product_name: "Alfa", quantity: 30, pack_mode: "unidad" }],
  });
  assert.equal(p.status, 201, p.text);
  const again = await admin.post("/api/admin/products-purchase-plan", { product_ids: [ids.a] });
  assert.equal(again.json.items[0].en_camino, 37);
});
