"use strict";
// Migracion 007: la cuenta corriente de los clientes de un vendedor TERCERIZADO
// pasa a ir en NETO.
//
// Antes: el pedido se debitaba por el total (precio de la lista del cliente) y,
// al cobrar lo que rendia el vendedor, se acreditaba la "Comision rendida" para
// saldarlo. La cuenta del cliente mezclaba lo que te debe a vos con lo que le
// paga al vendedor.
//
// Ahora: el debito es total - comision (lo que el vendedor te rinde) y no hay
// creditos de comision. Para cada pedido de un tercerizado:
//   - el debito pasa a total - comision
//   - se borran los creditos "Comision rendida..."
// Un pedido saldado queda saldado (debito - comision = lo que se cobro). Uno con
// deuda pasa a mostrarla en neto. La comision se calcula igual que
// lib/contabilidad.js (vendorCommissionForOrder).

module.exports = {
  id: 7,
  name: "tercerizado_cuenta_neta",
  up(db) {
    const orders = db.prepare(
      "SELECT o.id, o.total," +
      "       (SELECT COALESCE(SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
      "                                 THEN (oi.unit_price - oi.vendedor_cost_unit) * oi.quantity ELSE 0 END),0)" +
      "          FROM order_items oi WHERE oi.order_id = o.id) AS commission" +
      "  FROM orders o JOIN users v ON v.id = o.assigned_vendedor_id" +
      " WHERE v.is_tercerizado = 1 AND COALESCE(o.is_unified,0) = 0"
    ).all();
    const updDebit = db.prepare(
      "UPDATE account_movements SET amount = ? WHERE order_id = ? AND type = 'debit'"
    );
    const delCredit = db.prepare(
      "DELETE FROM account_movements WHERE order_id = ? AND type = 'credit' AND description LIKE 'Comisión rendida%'"
    );
    for (const o of orders) {
      const c = Math.max(0, Math.round(Number(o.commission) || 0));
      delCredit.run(o.id);
      if (c <= 0) continue;
      const net = Math.max(0, Math.round(((Number(o.total) || 0) - c) * 100) / 100);
      updDebit.run(net, o.id);
    }
  },
};
