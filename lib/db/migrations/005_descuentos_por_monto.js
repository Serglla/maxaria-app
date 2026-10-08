"use strict";
// Migracion 005: descuentos por monto de compra.
//
// Escalas tipo "comprando mas de $150.000, 2%; mas de $200.000, 5%". Cada
// escala es para un nivel base (1-4) o para una lista de precios: un cliente
// con lista personalizada usa las escalas de su lista; sin lista, las de su
// nivel. El descuento se guarda como discount_percent en cada linea del
// pedido (asi el total, la cuenta corriente y la comision del vendedor
// funcionan sin cambios) y el pedido anota el % y el monto aplicados.
const { addColumn } = require("../helpers");

module.exports = {
  id: 5,
  name: "descuentos_por_monto",
  up(db) {
    db.exec(
      "CREATE TABLE IF NOT EXISTS volume_discounts (" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "  level INTEGER," +
      "  price_list_id INTEGER REFERENCES price_lists(id) ON DELETE CASCADE," +
      "  min_amount INTEGER NOT NULL," +
      "  percent REAL NOT NULL," +
      "  active INTEGER NOT NULL DEFAULT 1," +
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
      ")"
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_volume_discounts_target ON volume_discounts(level, price_list_id)");
    addColumn(db, "orders", "volume_discount_percent", "REAL");
    addColumn(db, "orders", "volume_discount_amount", "REAL");
  },
};
