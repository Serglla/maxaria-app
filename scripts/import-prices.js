/**
 * Importa precios y stock desde un Excel hacia la base existente.
 *
 * - NO borra nada. Sincroniza por "code" (Codigo Interno).
 * - Si el codigo ya existe -> actualiza precios, stock, nombre, costo, categoria.
 * - Si el codigo NO existe -> lo da de alta (producto nuevo).
 * - Productos en la base que NO esten en el Excel -> los marca con stock = 0
 *   (asi dejan de aparecer en la app, pero si tienen pedidos viejos se preservan).
 *
 * Uso:
 *   npm run import-prices                              -> usa D:\Maxaria\WEB\precios_maxaria.xlsx
 *   npm run import-prices -- "ruta\al\archivo.xlsx"
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { readExcel } = require("./excel_helper");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "maxaria.db");
const DEFAULT_EXCEL = path.join(ROOT, "..", "precios_maxaria.xlsx");

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("ERROR: no existe la base. Corré primero `npm run seed`.");
    process.exit(1);
  }
  const excelPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_EXCEL;
  if (!fs.existsSync(excelPath)) {
    console.error("ERROR: no encuentro el Excel en", excelPath);
    process.exit(1);
  }
  console.log("Leyendo Excel:", excelPath);

  const items = readExcel(excelPath);
  console.log(`Filas leidas: ${items.length}`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Asegurar que las categorias existan (insert ignore)
  const insertCat = db.prepare(
    "INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)"
  );
  const cats = Array.from(new Set(items.map((x) => x.category))).sort();
  cats.forEach((c, i) => insertCat.run(c, i));
  const catIdByName = new Map(
    db.prepare("SELECT id, name FROM categories").all().map((c) => [c.name, c.id])
  );

  const findByCode = db.prepare("SELECT id FROM products WHERE code = ?");

  const updateExisting = db.prepare(`
    UPDATE products SET
      name = ?,
      category_id = ?,
      cost = ?,
      price_minorista = ?,
      price_revendedor = ?,
      price_mayorista = ?,
      price_vip = ?,
      price_publico = ?,
      stock = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const insertNew = db.prepare(`
    INSERT INTO products
      (code, category_id, name, cost,
       price_minorista, price_revendedor, price_mayorista, price_vip, price_publico,
       stock, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const stats = { actualizados: 0, nuevos: 0, sinStock: 0 };

  const tx = db.transaction(() => {
    const seen = new Set();
    for (const p of items) {
      if (seen.has(p.code)) continue;
      seen.add(p.code);
      const catId = catIdByName.get(p.category) || null;
      const existing = findByCode.get(p.code);
      if (existing) {
        updateExisting.run(
          p.name, catId, p.cost,
          p.price_minorista, p.price_revendedor, p.price_mayorista, p.price_vip, p.price_publico,
          p.stock,
          existing.id
        );
        stats.actualizados++;
      } else {
        insertNew.run(
          p.code, catId, p.name, p.cost,
          p.price_minorista, p.price_revendedor, p.price_mayorista, p.price_vip, p.price_publico,
          p.stock
        );
        stats.nuevos++;
      }
    }

    // Productos que estaban en la base y NO aparecen en este Excel: los pasamos a stock 0.
    const codesInExcel = Array.from(seen);
    const placeholders = codesInExcel.map(() => "?").join(",");
    if (codesInExcel.length) {
      const result = db
        .prepare(`UPDATE products SET stock = 0 WHERE code NOT IN (${placeholders}) AND stock > 0`)
        .run(...codesInExcel);
      stats.sinStock = result.changes;
    }
  });

  tx();

  const visibles = db
    .prepare("SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock > 0")
    .get().n;

  console.log("\nResumen:");
  console.log(`  Actualizados:           ${stats.actualizados}`);
  console.log(`  Nuevos:                 ${stats.nuevos}`);
  console.log(`  Marcados sin stock:     ${stats.sinStock}  (estaban en la base, ya no en el Excel)`);
  console.log(`  Visibles ahora:         ${visibles}`);
  db.close();
}

main();
