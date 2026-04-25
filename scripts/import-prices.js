/**
 * Importa precios y stock desde un Excel hacia la base existente.
 *
 * - NO borra nada. Sincroniza por "code" (Codigo Interno).
 * - Si el codigo existe -> actualiza precios, stock, nombre, costo, categoria.
 * - Si el codigo NO existe -> lo da de alta.
 * - Productos en la base que NO esten en el Excel -> stock = 0 (se ocultan).
 *
 * Uso:
 *   npm run import-prices
 *   npm run import-prices -- "ruta\al\archivo.xlsx"
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { readExcel, resolveExcelPath } = require("./excel_helper");

const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "maxaria.db");

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("ERROR: no existe la base. Corre primero `npm run seed`.");
    process.exit(1);
  }
  const excelPath = resolveExcelPath(process.argv[2]);
  if (!excelPath) {
    console.error("ERROR: no encuentro el Excel. Pasalo como argumento o setea EXCEL_PATH.");
    process.exit(1);
  }
  console.log("Leyendo Excel:", excelPath);
  const items = readExcel(excelPath);
  console.log(`Filas leidas: ${items.length}`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const insertCat = db.prepare("INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)");
  const cats = Array.from(new Set(items.map((x) => x.category))).sort();
  cats.forEach((c, i) => insertCat.run(c, i));
  const catIdByName = new Map(
    db.prepare("SELECT id, name FROM categories").all().map((c) => [c.name, c.id])
  );

  const findByCode = db.prepare("SELECT id FROM products WHERE code = ?");
  const updateExisting = db.prepare(`
    UPDATE products SET
      name = ?, category_id = ?, cost = ?,
      price_minorista = ?, price_revendedor = ?, price_mayorista = ?, price_vip = ?, price_publico = ?,
      stock = ?, updated_at = datetime('now')
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
  db.transaction(() => {
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
          p.stock, existing.id
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
    const codes = Array.from(seen);
    if (codes.length) {
      const ph = codes.map(() => "?").join(",");
      const r = db.prepare(`UPDATE products SET stock = 0 WHERE code NOT IN (${ph}) AND stock > 0`).run(...codes);
      stats.sinStock = r.changes;
    }
  })();

  const visibles = db.prepare(
    "SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock > 0"
  ).get().n;

  console.log("\nResumen:");
  console.log(`  Actualizados:        ${stats.actualizados}`);
  console.log(`  Nuevos:              ${stats.nuevos}`);
  console.log(`  Marcados sin stock:  ${stats.sinStock}`);
  console.log(`  Visibles ahora:      ${visibles}`);
  db.close();
}

main();
