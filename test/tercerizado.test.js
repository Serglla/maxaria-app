/**
 * Vendedor tercerizado: la cuenta del cliente va en NETO (total - comision) y
 * la comision se ve aparte (Cuentas a pagar > Comisiones).
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
    const ins = db.prepare("INSERT INTO products (code, category_id, name, cost, price_minorista, price_revendedor, price_mayorista, price_vip, price_publico, stock, active) VALUES (?,1,?,?,?,?,?,?,?,500,1)");
    ids.p1 = ins.run("3001", "Alfa", 600, 1000, 950, 900, 850, 1100).lastInsertRowid;
  });
  admin = srv.client();
  const r = await admin.login("admin", "Admin123!");
  assert.equal(r.status, 200, r.text);
});
after(() => srv && srv.stop());

async function ok(p) { const r = await p; assert.ok(r.status < 300, r.status + " " + r.text); return r.json; }

test("tercerizado: debito neto, cobro del neto salda y la comision va aparte", async () => {
  const db = srv.db();
  ids.caja = db.prepare("SELECT id FROM cash_accounts ORDER BY id").get().id;
  const lista = await ok(admin.post("/api/admin/price-lists", { name: "L10", base_level: "minorista", markup_percent: 10 }));
  const listaId = (lista.list || lista.price_list || lista).id;
  const v = await ok(admin.post("/api/admin/users", { username: "juan", password: "Clave123", full_name: "Juan", level: 5 }));
  await ok(admin.patch("/api/admin/vendedores/" + v.user.id, { is_tercerizado: 1 }));
  const c = await ok(admin.post("/api/admin/users", { username: "walter", password: "Clave123", full_name: "Walter", level: 1 }));
  await ok(admin.patch("/api/admin/users/" + c.user.id, { assigned_vendedor_id: v.user.id, price_list_id: listaId }));

  // 10 x $1111 (precio de la lista). Costo del vendedor 1000 -> comision 1110.
  const o = await ok(admin.post("/api/admin/orders", {
    client_id: c.user.id,
    items: [{ product_id: ids.p1, product_code: "3001", product_name: "Alfa", quantity: 10, unit_price: 1111 }],
  }));
  const oid = o.order ? o.order.id : o.id;
  const debit = () => db.prepare("SELECT amount FROM account_movements WHERE order_id = ? AND type = 'debit'").get(oid).amount;
  assert.equal(debit(), 11110 - 1110, "el debito es lo que te rinde el vendedor");

  // Detalle: rentabilidad sin la comision.
  const det = await ok(admin.get("/api/orders/" + oid));
  assert.equal(det.balance_due, 10000);
  assert.equal(det.profitability.vendor_commission, 1110);
  assert.equal(det.profitability.revenue, 10000);
  assert.equal(det.profitability.profit, 10000 - 6000);

  // Entrega cobrando lo que rinde: queda saldado, sin creditos de comision.
  await ok(admin.post("/api/orders/" + oid + "/deliver", {
    delivered_to: "W", efectivo_amount: 10000, transferencia_amount: 0, caja_id: ids.caja,
  }));
  const bal = db.prepare(
    "SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END),0) AS b FROM account_movements WHERE order_id = ?"
  ).get(oid).b;
  assert.equal(bal, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_movements WHERE description LIKE 'Comisión rendida%'").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cash_movements WHERE source = 'comision'").get().n, 0);

  // Comisiones del mes: retenida (pedido saldado).
  const com = await ok(admin.get("/api/admin/vendor-commissions"));
  const row = com.orders.find((x) => x.id === oid);
  assert.equal(row.commission, 1110);
  assert.equal(row.net_total, 10000);
  assert.equal(row.settled, 1110);
  assert.equal(row.pending, 0);
  assert.equal(com.vendors[0].commission, 1110);

  // El cliente no ve el saldo neto (dejaria ver la comision del vendedor).
  const cli = srv.client();
  assert.equal((await cli.login("walter", "Clave123")).status, 200);
  assert.equal((await ok(cli.get("/api/my-account"))).applies, false);
  const mine = (await ok(cli.get("/api/orders"))).find((x) => x.id === oid);
  assert.equal(mine.balance_due, undefined);

  // Si deja de ser tercerizado, el pedido vuelve a debitarse por el total.
  await ok(admin.patch("/api/admin/vendedores/" + v.user.id, { is_tercerizado: 0 }));
  assert.equal(debit(), 11110);
});
