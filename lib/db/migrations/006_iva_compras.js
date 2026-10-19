"use strict";
// Migracion 006: IVA discriminado en las compras.
//
// Algunos proveedores facturan el NETO por renglon y suman el IVA recien al
// pie. Como el costo del producto (products.cost) tiene que quedar CON IVA,
// al cargar la compra el neto se convierte: unit_cost = neto * (1 + iva/100).
//
// Canonico: purchase_items.unit_cost y subtotal siguen siendo CON IVA. Es lo
// que alimenta products.cost, el total de la compra, la deuda del proveedor,
// la recepcion y el historial de costos: nada de eso cambia, solo recibe el
// numero correcto. El neto y la alicuota se guardan al lado para mostrar la
// compra igual que la factura al reabrirla y para discriminar el IVA.
const { addColumn } = require("../helpers");

module.exports = {
  id: 6,
  name: "iva_compras",
  up(db) {
    // 'incluido' = los costos cargados ya traen el IVA (lo de siempre, default
    // para todas las compras existentes). 'neto' = vienen sin IVA.
    addColumn(db, "purchase_orders", "vat_mode", "TEXT NOT NULL DEFAULT 'incluido'");
    // IVA total de la compra, en pesos. 0 en las compras con IVA incluido
    // (no se puede saber cuanto IVA traian).
    addColumn(db, "purchase_orders", "vat_amount", "REAL NOT NULL DEFAULT 0");
    // Costo neto por unidad. NULL = la compra no discrimina IVA.
    addColumn(db, "purchase_items", "unit_cost_net", "REAL");
    // Alicuota de la linea (21, 10.5, 27...). 0 = sin IVA discriminado.
    addColumn(db, "purchase_items", "vat_percent", "REAL NOT NULL DEFAULT 0");
    // IVA habitual del proveedor: precarga modo y alicuota al elegirlo en una
    // compra nueva. NULL = preguntar/usar el default (con IVA incluido).
    addColumn(db, "suppliers", "default_vat_mode", "TEXT");
    addColumn(db, "suppliers", "default_vat_percent", "REAL");
  },
};
