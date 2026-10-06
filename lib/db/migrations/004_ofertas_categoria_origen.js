"use strict";
// Migracion 004: categoria real de los productos en oferta.
//
// Las ofertas se cargan como productos aparte en la categoria OFERTAS, y al
// hacerlo pierden su rubro (el Dove queda en OFERTAS, no en Perfumeria). Con
// origin_category_id un cliente con categorias restringidas ve una oferta solo
// si tiene habilitada OFERTAS y tambien la categoria real del producto.
// NULL = sin categoria real cargada (se comporta como antes).
const { addColumn } = require("../helpers");

module.exports = {
  id: 4,
  name: "ofertas_categoria_origen",
  up(db) {
    addColumn(db, "products", "origin_category_id", "INTEGER REFERENCES categories(id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_products_origin_cat ON products(origin_category_id)");
  },
};
