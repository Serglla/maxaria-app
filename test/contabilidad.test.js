/**
 * Foto contable: recorre los caminos que mueven plata de un pedido (entrega,
 * cobro, borrado de cobro, edicion de entrega, comision del vendedor propio y
 * del tercerizado, descuentos) y compara TODAS las filas resultantes de
 * account_movements, cash_movements y del pedido contra test/golden/contabilidad.json.
 *
 * Si un cambio altera aunque sea una descripcion o un centavo, falla.
 * Para regenerar la foto (solo cuando el cambio de comportamiento es buscado):
 *   UPDATE_GOLDEN=1 node --test test/contabilidad.test.js
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./_harness");

const GOLDEN = path.join(__dirname, "golden", "contabilidad.json");
let srv, admin;
const ids = {};

before(async () => {
  srv = await startServer((db) => {
    db.prepare("INSERT INTO categories (name) VALUES ('General')").run();
    const ins = db.prepare("INSERT INTO products (code, category_id, name, cost, price_minorista, price_revendedor, price_mayorista, price_vip, price_publico, stock, active) VALUES (?,1,?,?,?,?,?,?,?,500,1)");
    ids.p1 = ins.run("2001", "Alfa", 600, 1000, 950, 900, 850, 1100).lastInsertRowid;
    ids.p2 = ins.run("2002", "Beta", 333, 777.5, 700, 650, 600, 800).lastInsertRowid;
  });
  admin = srv.client();
  const r = await admin.login("admin", "Admin123!");
  assert.equal(r.status, 200, r.text);
});
after(() => srv && srv.stop());

async function ok(p) { const r = await p; assert.ok(r.status < 300, r.status + " " + r.text); return r.json; }

async function setup() {
  const cajas = srv.db().prepare("SELECT id, name FROM cash_accounts ORDER BY id").all();
  ids.caja1 = cajas[0].id; ids.caja2 = cajas[1].id;
  const lista = await ok(admin.post("/api/admin/price-lists", { name: "L10", base_level: "minorista", markup_percent: 10 }));
  ids.lista = (lista.list || lista.price_list || lista).id;
  for (const [k, terc] of [["vProp", 0], ["vTerc", 1]]) {
    const u = await ok(admin.post("/api/admin/users", { username: k.toLowerCase(), password: "Clave123", full_name: k, level: 5 }));
    ids[k] = u.user.id;
    if (terc) await ok(admin.patch("/api/admin/vendedores/" + ids[k], { is_tercerizado: 1 }));
  }
  for (const [k, vend] of [["cProp", "vProp"], ["cTerc", "vTerc"], ["cSolo", null]]) {
    const u = await ok(admin.post("/api/admin/users", { username: k.toLowerCase(), password: "Clave123", full_name: k, level: 1 }));
    ids[k] = u.user.id;
    await ok(admin.patch("/api/admin/users/" + ids[k], { assigned_vendedor_id: vend ? ids[vend] : null, price_list_id: ids.lista }));
  }
}

async function order(clientKey) {
  const r = await ok(admin.post("/api/admin/orders", {
    client_id: ids[clientKey],
    items: [
      { product_id: ids.p1, product_code: "2001", product_name: "Alfa", quantity: 3, unit_price: 1111.11 },
      { product_id: ids.p2, product_code: "2002", product_name: "Beta", quantity: 2, unit_price: 863.89 },
    ],
  }));
  return r.order ? r.order.id : r.id;
}

function snapshot() {
  const db = srv.db();
  const out = {
    account_movements: db.prepare("SELECT user_id, type, amount, description, order_id, payment_id IS NOT NULL AS has_payment FROM account_movements ORDER BY id").all(),
    cash_movements: db.prepare("SELECT account_id, type, amount, description, source, related_id FROM cash_movements ORDER BY id").all(),
    orders: db.prepare("SELECT id, user_id, status, total, discount_type, discount_value, discount_amount, assigned_vendedor_id, stock_discounted FROM orders ORDER BY id").all(),
    payments: db.prepare("SELECT id, user_id, amount, method, caja_id, order_id FROM payments ORDER BY id").all(),
    deliveries: db.prepare("SELECT order_id, efectivo_amount, transferencia_amount, caja_id, caja_transfer_id FROM deliveries ORDER BY id").all(),
  };
  db.close();
  return out;
}

test("foto contable de entregas, cobros y comisiones", async () => {
  await setup();
  const steps = [];
  const mark = (name, resp) => steps.push({ name, commission_warning: resp && resp.commission_warning || null, discount_amount: resp && resp.discount_amount });

  // 1) Vendedor propio: entrega del total en efectivo + transferencia en dos cajas, con 5% de descuento
  //    (cobrado > tu parte: sale el egreso de comision). Despues se edita a un cobro menor (el egreso se borra).
  const o1 = await order("cProp");
  mark("entrega propio dos cajas", await ok(admin.post("/api/orders/" + o1 + "/deliver", {
    delivered_to: "C", efectivo_amount: 3000, transferencia_amount: 2061.11,
    caja_id: ids.caja1, caja_transfer_id: ids.caja2, discount_type: "percent", discount_value: 5,
  })));
  // 1b) Editar esa entrega: otros montos, otra caja, descuento fijo.
  mark("edita entrega propio", await ok(admin.post("/api/orders/" + o1 + "/deliver", {
    delivered_to: "C", efectivo_amount: 3000, transferencia_amount: 0,
    caja_id: ids.caja2, discount_type: "fixed", discount_value: 500,
  })));

  // 2) Tercerizado: entrega del neto (rinde neto).
  const o2 = await order("cTerc");
  mark("entrega tercerizado neto", await ok(admin.post("/api/orders/" + o2 + "/deliver", {
    delivered_to: "C", efectivo_amount: 3400, transferencia_amount: 0, caja_id: ids.caja1,
  })));

  // 3) Propio: entrega parcial, cobro del resto con descuento, borrado del cobro.
  const o3 = await order("cProp");
  mark("entrega parcial", await ok(admin.post("/api/orders/" + o3 + "/deliver", {
    delivered_to: "C", efectivo_amount: 1000, transferencia_amount: 0, caja_id: ids.caja1,
  })));
  const pay3 = await ok(admin.post("/api/admin/payments", {
    user_id: ids.cProp, amount: 2500, method: "transferencia", caja_id: ids.caja2, order_id: o3,
    discount_type: "fixed", discount_value: 254.55,
  }));
  mark("cobro resto con descuento", pay3);
  mark("borra cobro", await ok(admin.del("/api/admin/payments/" + pay3.payment.id)));

  // 4) Tercerizado: entrega parcial y cobro posterior.
  const o4 = await order("cTerc");
  mark("tercerizado parcial", await ok(admin.post("/api/orders/" + o4 + "/deliver", {
    delivered_to: "C", efectivo_amount: 1500, transferencia_amount: 0, caja_id: ids.caja1,
  })));
  mark("tercerizado cobro resto", await ok(admin.post("/api/admin/payments", {
    user_id: ids.cTerc, amount: 1900, caja_id: ids.caja1, order_id: o4,
  })));

  // 5) Propio sin caja: la comision no se puede imputar (aviso).
  const o5 = await order("cProp");
  mark("propio sin caja", await ok(admin.post("/api/orders/" + o5 + "/deliver", {
    delivered_to: "C", efectivo_amount: 5061.11, transferencia_amount: 0,
  })));

  // 5b) Propio: entrega parcial y el resto con un cobro -> el egreso sale por el camino del cobro.
  const o7 = await order("cProp");
  mark("propio parcial", await ok(admin.post("/api/orders/" + o7 + "/deliver", {
    delivered_to: "C", efectivo_amount: 3000, transferencia_amount: 0, caja_id: ids.caja1,
  })));
  mark("propio cobro resto", await ok(admin.post("/api/admin/payments", {
    user_id: ids.cProp, amount: 2061.11, caja_id: ids.caja2, order_id: o7,
  })));

  // 6) Cobro a cuenta (sin pedido) y su borrado; cliente sin vendedor.
  const pay6 = await ok(admin.post("/api/admin/payments", { user_id: ids.cSolo, amount: 800, caja_id: ids.caja1 }));
  mark("a cuenta", pay6);
  const o6 = await order("cSolo");
  mark("entrega sin vendedor", await ok(admin.post("/api/orders/" + o6 + "/deliver", {
    delivered_to: "C", efectivo_amount: 2954.54, transferencia_amount: 0, caja_id: ids.caja1,
  })));
  mark("borra a cuenta", await ok(admin.del("/api/admin/payments/" + pay6.payment.id)));

  // Pasar por JSON: igual que la foto guardada (sin campos undefined).
  const got = JSON.parse(JSON.stringify({ steps, ...snapshot() }));
  if (process.env.UPDATE_GOLDEN === "1") {
    fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + "\n");
    return;
  }
  const want = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
  assert.deepEqual(got, want);
});
