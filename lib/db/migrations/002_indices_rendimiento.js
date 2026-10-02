"use strict";
// Migracion 002: indices en columnas que se filtran en casi todas las pantallas
// (saldo por pedido, pedidos por vendedor y estado, ventas por producto). Sin
// ellos, con un año de datos, Ventas tardaba ~0,5 s y Vendedores ~1 s.
module.exports = {
  id: 2,
  name: "indices_rendimiento",
  up(db) {
    db.exec("CREATE INDEX IF NOT EXISTS idx_am_order ON account_movements(order_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_vendedor ON orders(assigned_vendedor_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_users_vendedor ON users(assigned_vendedor_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_cash_mov_source ON cash_movements(source, related_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_pi_product ON purchase_items(product_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_pri_request ON purchase_request_items(request_id)");
  },
};
