"use strict";
// Contabilidad del cobro de un pedido: credito al cliente, ingreso a caja,
// descuento y comision del vendedor.
//
// Es la UNICA implementacion de estas reglas. La usan la entrega
// (POST /api/orders/:id/deliver), el cobro (POST /api/admin/payments) y el
// borrado de un cobro (DELETE /api/admin/payments/:id). Todas las funciones que
// escriben deben llamarse DENTRO de la transaccion de la ruta.
//
// test/contabilidad.test.js guarda una foto de todas las filas que generan
// estos caminos: cualquier cambio de comportamiento lo hace fallar.

module.exports = function createContabilidad(db) {
  // ----- Comisión del vendedor: egreso automático de caja -----
  // Cuando se cobra un pedido con vendedor asignado, la parte del vendedor (su
  // comisión = Σ (unit_price − vendedor_cost_unit)·qty) sale de la caja como un
  // EGRESO, así la caja neta refleja solo lo del dueño. Regla "primero lo tuyo":
  // la comisión recién se paga sobre el efectivo cobrado por encima de tu parte
  // (total − comisión). El egreso es ÚNICO por pedido (source='comision',
  // related_id=order_id) y se recalcula (DELETE + INSERT) en cada cobro/edición
  // para que el acumulado sea siempre correcto e idempotente.
  function vendorCommissionForOrder(orderId) {
    const r = db.prepare(
      "SELECT COALESCE(SUM(CASE WHEN vendedor_cost_unit IS NOT NULL" +
      "                        THEN (unit_price - vendedor_cost_unit) * quantity ELSE 0 END),0) AS c" +
      "  FROM order_items WHERE order_id = ?"
    ).get(orderId);
    return Math.max(0, Math.round(Number(r && r.c) || 0));
  }
  function cashCollectedForOrder(orderId) {
    const d = db.prepare(
      "SELECT COALESCE(SUM(COALESCE(efectivo_amount,0) + COALESCE(transferencia_amount,0)),0) AS c" +
      "  FROM deliveries WHERE order_id = ?"
    ).get(orderId);
    const p = db.prepare(
      "SELECT COALESCE(SUM(amount),0) AS c FROM payments WHERE order_id = ?"
    ).get(orderId);
    return (Number(d && d.c) || 0) + (Number(p && p.c) || 0);
  }
  // Recalcula el egreso de comisión del vendedor para un pedido. cajaHint es la
  // caja preferida (la del cobro que disparó el recálculo); si no se pasa, se
  // busca la caja de la entrega o del último pago con caja. Debe llamarse DENTRO
  // de la transacción del cobro, DESPUÉS de insertar la entrega/pago.
  function syncVendorCommissionEgreso(orderId, cajaHint, registeredBy) {
    // Borrar siempre el egreso previo: se recrea abajo si corresponde.
    db.prepare("DELETE FROM cash_movements WHERE source = 'comision' AND related_id = ?").run(orderId);
    const order = db.prepare(
      "SELECT id, total, assigned_vendedor_id, is_unified FROM orders WHERE id = ?"
    ).get(orderId);
    if (!order || order.is_unified || !order.assigned_vendedor_id) return;
    const C = vendorCommissionForOrder(orderId);
    if (C <= 0) return;
    const total = Number(order.total) || 0;
    const loTuyo = Math.max(0, total - C);           // tu parte (primero lo tuyo)
    const cash = cashCollectedForOrder(orderId);     // efectivo real cobrado
    const payable = Math.max(0, Math.min(Math.round(cash - loTuyo), C));
    if (payable <= 0) return;                         // todavía no se cubrió tu parte
    // Caja del egreso: la del cobro, o la de la entrega, o la del último pago con caja.
    let cajaId = cajaHint ? Number(cajaHint) : null;
    if (!cajaId) {
      const dc = db.prepare("SELECT caja_id FROM deliveries WHERE order_id = ? AND caja_id IS NOT NULL LIMIT 1").get(orderId);
      if (dc && dc.caja_id) cajaId = dc.caja_id;
    }
    if (!cajaId) {
      const pc = db.prepare("SELECT caja_id FROM payments WHERE order_id = ? AND caja_id IS NOT NULL ORDER BY id DESC LIMIT 1").get(orderId);
      if (pc && pc.caja_id) cajaId = pc.caja_id;
    }
    if (!cajaId) {
      // Sin caja no se puede representar el egreso. Antes se salia mudo y la
      // comision quedaba dentro de la caja sin descontar; ahora queda el aviso en
      // el log y el endpoint lo devuelve para que el panel lo muestre.
      console.warn("[comision] pedido", orderId, ": $" + payable + " de comision sin imputar (ningun cobro tiene caja)");
      return { warning: "sin_caja", amount: payable };
    }
    const caja = db.prepare("SELECT id FROM cash_accounts WHERE id = ?").get(cajaId);
    if (!caja) {
      console.warn("[comision] pedido", orderId, ": caja", cajaId, "inexistente, comision $" + payable + " sin imputar");
      return { warning: "caja_invalida", amount: payable };
    }
    const v = db.prepare("SELECT full_name, username FROM users WHERE id = ?").get(order.assigned_vendedor_id);
    const vname = (v && (v.full_name || v.username)) || ("Vendedor #" + order.assigned_vendedor_id);
    db.prepare(
      "INSERT INTO cash_movements (account_id, type, amount, description, source, related_id, registered_by)" +
      " VALUES (?, 'egreso', ?, ?, 'comision', ?, ?)"
    ).run(cajaId, payable, "Comisión vendedor pedido #" + orderId + " (" + vname + ")", orderId, registeredBy || null);
  }

  // ----- Vendedor TERCERIZADO: la cuenta del cliente va en NETO -----
  // El tercerizado le cobra al cliente el precio de su lista, se queda su
  // comision y te rinde el resto. Lo que el cliente TE debe a vos es ese resto
  // (total - comision): el debito del pedido se anota por ese neto y la
  // comision nunca entra a la cuenta del cliente. Asi un cobro por lo que rinde
  // el vendedor salda el pedido sin creditos extra. La comision se ve aparte
  // (Cuentas a pagar > Comisiones).
  //
  // Hasta octubre 2026 el debito iba por el total y la comision se acreditaba
  // como "Comision rendida" al cobrar; la migracion 007 paso los pedidos viejos
  // a este modelo.

  // Comision del vendedor si el pedido es de un tercerizado (0 si no aplica).
  function tercerizadoCommissionForOrder(orderId) {
    const o = db.prepare(
      "SELECT o.is_unified, v.is_tercerizado FROM orders o" +
      "  LEFT JOIN users v ON v.id = o.assigned_vendedor_id WHERE o.id = ?"
    ).get(orderId);
    if (!o || o.is_unified || !Number(o.is_tercerizado)) return 0;
    return vendorCommissionForOrder(orderId);
  }

  // Lo que el cliente te debe por el pedido: el total, menos la comision si el
  // vendedor es tercerizado. (El descuento va aparte, como credito.)
  function orderDebitAmount(orderId) {
    const o = db.prepare("SELECT total FROM orders WHERE id = ?").get(orderId);
    if (!o) return 0;
    const net = (Number(o.total) || 0) - tercerizadoCommissionForOrder(orderId);
    return Math.max(0, Math.round(net * 100) / 100);
  }

  // Ajusta el debito existente del pedido (si lo tiene) a orderDebitAmount.
  // Llamar despues de cambiar items, vendedor asignado o el tipo del vendedor.
  function syncOrderDebit(orderId) {
    db.prepare(
      "UPDATE account_movements SET amount = ? WHERE order_id = ? AND type = 'debit'"
    ).run(orderDebitAmount(orderId), orderId);
  }

  // Re-sincroniza los debitos de todos los pedidos de un vendedor (cuando se le
  // marca o desmarca "tercerizado").
  function syncVendorDebits(vendorId) {
    const ids = db.prepare(
      "SELECT DISTINCT o.id FROM orders o JOIN account_movements am ON am.order_id = o.id AND am.type = 'debit'" +
      " WHERE o.assigned_vendedor_id = ? AND COALESCE(o.is_unified,0) = 0"
    ).all(vendorId);
    for (const r of ids) syncOrderDebit(r.id);
    return ids.length;
  }

  // Comision del vendedor despues de un cobro. Tercerizado: el debito ya esta
  // en neto, no hay credito ni egreso de caja (esa plata nunca entro). Propio:
  // egreso automatico de la caja.
  // Devuelve {warning, amount} si la comision no se pudo imputar a una caja.
  function syncCommission(orderId, cajaHint, registeredBy) {
    // Restos del modelo viejo: nunca mas se generan.
    db.prepare(
      "DELETE FROM account_movements WHERE order_id = ? AND type = 'credit' AND description LIKE 'Comisión rendida%'"
    ).run(orderId);
    if (tercerizadoCommissionForOrder(orderId) > 0) {
      db.prepare("DELETE FROM cash_movements WHERE source = 'comision' AND related_id = ?").run(orderId);
      syncOrderDebit(orderId);
      return null;
    }
    return syncVendorCommissionEgreso(orderId, cajaHint, registeredBy) || null;
  }

  // Descuento de un pedido: "percent" (10 = 10%) o "fixed" (pesos), siempre
  // sobre el total y acotado entre 0 y el total. Sin descuento valido devuelve
  // { type: null, value: 0, amount: 0 }.
  function discountFor(total, type, value) {
    const t = Number(total) || 0;
    const dt = type ? String(type) : "";
    const dv = Math.max(0, Number(value) || 0);
    if ((dt !== "percent" && dt !== "fixed") || dv <= 0) return { type: null, value: 0, amount: 0 };
    let amount = dt === "percent" ? Math.round(t * Math.min(dv, 100) / 100) : Math.round(dv);
    amount = Math.max(0, Math.min(amount, t));
    return { type: dt, value: dv, amount };
  }

  // Reemplaza el credito "Descuento pedido #N" del pedido (no se acumula: el
  // ultimo valor manda). paymentId vincula el credito a un cobro, para que se
  // borre con el.
  function replaceDiscountCredit(orderId, userId, type, value, amount, paymentId) {
    db.prepare(
      "DELETE FROM account_movements WHERE order_id = ? AND type = 'credit' AND description LIKE 'Descuento pedido%'"
    ).run(orderId);
    if (amount > 0) {
      const label = type === "percent" ? (value + "%") : ("$" + Math.round(value).toLocaleString("es-AR"));
      db.prepare(
        "INSERT INTO account_movements (user_id, type, amount, description, order_id, payment_id, created_at)" +
        " VALUES (?, 'credit', ?, ?, ?, ?, datetime('now'))"
      ).run(userId, amount, "Descuento pedido #" + orderId + " (" + label + ")", orderId, paymentId || null);
    }
  }

  // Debito del pedido en la cuenta corriente del cliente: el total, o el neto
  // (total - comision) si el vendedor es tercerizado. "total" se ignora, queda
  // por compatibilidad: el monto sale siempre del pedido.
  function addOrderDebit(userId, total, orderId) {
    db.prepare(
      "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
      " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
    ).run(userId, orderDebitAmount(orderId), "Pedido #" + orderId, orderId);
  }

  // Ingreso de plata en una caja.
  function cashIngreso(accountId, amount, description, source, relatedId, registeredBy) {
    db.prepare(
      "INSERT INTO cash_movements (account_id, type, amount, description, source, related_id, registered_by)" +
      " VALUES (?, 'ingreso', ?, ?, ?, ?, ?)"
    ).run(accountId, amount, description, source, relatedId, registeredBy);
  }

  return {
    vendorCommissionForOrder,
    cashCollectedForOrder,
    syncVendorCommissionEgreso,
    tercerizadoCommissionForOrder,
    orderDebitAmount,
    syncOrderDebit,
    syncVendorDebits,
    syncCommission,
    discountFor,
    replaceDiscountCredit,
    addOrderDebit,
    cashIngreso,
  };
};
