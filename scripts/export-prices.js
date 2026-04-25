/**
 * Exporta los productos de la base a un Excel con el mismo formato del original.
 *
 * Uso:
 *   npm run export-prices                              -> escribe D:\Maxaria\WEB\precios_maxaria_export.xlsx
 *   npm run export-prices -- "ruta\al\salida.xlsx"
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { writeExcel } = require("./excel_helper");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "maxaria.db");
const DEFAULT_OUT = path.join(ROOT, "..", "precios_maxaria_export.xlsx");

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("ERROR: no existe la base. Corré primero `npm run seed`.");
    process.exit(1);
  }
  const outPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_OUT;

  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare(`
    SELECT
      p.code,
      p.name,
      p.stock,
      COALESCE(c.name, 'Sin categoría') AS category,
      p.cost,
      p.price_publico,
      p.price_vip,
      p.price_mayorista,
      p.price_minorista,
      p.price_revendedor
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY c.sort_order, c.name, p.name
  `).all();
  db.close();

  writeExcel(outPath, rows);
  console.log(`OK: ${rows.length} productos exportados a:`);
  console.log(`  ${outPath}`);
}

main();
