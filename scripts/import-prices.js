/**
 * Importa precios y stock desde un Excel hacia la base existente.
 *
 * - NO borra nada. Sincroniza por "code" (Codigo Interno).
 * - Si el codigo existe -> actualiza precios, stock, nombre, costo, categoria.
 * - Si el codigo NO existe -> lo da de alta.
 * - Productos en la base que NO esten en el Excel -> stock = 0 (se ocultan).
 *
 * Uso CLI:
 *   npm run import-prices
 *   npm run import-prices -- "ruta\al\archivo.xlsx"
 *
 * Uso desde otro modulo:
 *   const { importPrices } = require('./import-prices');
 *   const stats = importPrices(items, db);    // items = readExcel(...) o readExcelBuffer(...)
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { readExcel, resolveExcelPath } = require("./excel_helper");

const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "maxaria.db");

/**
 * Aplica una lista de items (parseados del Excel) sobre la DB.
 *
 * Antes de actualizar, snapshot de los precios actuales por producto.
 * Despues, registra un row en price_updates y un row por producto cambiado
 * en price_changes (con old/new por nivel + flag is_new). Eso permite
 * que el catalogo muestre los aumentos/bajas de la ultima actualizacion.
 *
 * @param {Array} items   Lista de productos parseados del Excel
 * @param {Database} db   Instancia de better-sqlite3
 * @param {Object} [opts] { source }: 'excel-upload' | 'cli-import' | 'seed'
 * @returns {Object} { actualizados, nuevos, sinStock, visibles, updateId, cambiosPrecio }
 */
function importPrices(items, db, opts) {
  const source = (opts && opts.source) || "cli-import";

  const insertCat = db.prepare("INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)");
  const cats = Array.from(new Set(items.map((x) => x.category))).sort();
  cats.forEach((c, i) => insertCat.run(c, i));
  const catIdByName = new Map(
    db.prepare("SELECT id, name FROM categories").all().map((c) => [c.name, c.id])
  );

  // Trae los precios actuales y stock de un producto por code, para snapshot.
  const findFullByCode = db.prepare(
    "SELECT id, price_minorista, price_revendedor, price_mayorista, price_vip, stock" +
    "  FROM products WHERE code = ?"
  );
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

  // Insert para registrar la cabecera del update y cada cambio.
  const insertUpdate = db.prepare(
    "INSERT INTO price_updates (source, rows_total, products_changed, products_new, products_reingreso)" +
    " VALUES (?, ?, 0, 0, 0)"
  );
  const insertChange = db.prepare(
    "INSERT INTO price_changes" +
    " (update_id, product_id, code, name, is_new, is_reingreso," +
    "  old_minorista, new_minorista, old_revendedor, new_revendedor," +
    "  old_mayorista, new_mayorista, old_vip, new_vip)" +
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const updateUpdateCounters = db.prepare(
    "UPDATE price_updates SET products_changed = ?, products_new = ?, products_reingreso = ? WHERE id = ?"
  );

  const stats = {
    actualizados: 0, nuevos: 0, sinStock: 0, visibles: 0,
    updateId: null, cambiosPrecio: 0, reingresos: 0,
  };

  // Buffer de cambios. Lo llenamos durante la transaccion y al final
  // los persistimos. Lo dejamos asi para que sea facil filtrar (si no
  // hubo ningun cambio de precio NI producto nuevo, no creamos update).
  const pendingChanges = [];

  db.transaction(() => {
    const seen = new Set();
    for (const p of items) {
      if (seen.has(p.code)) continue;
      seen.add(p.code);
      const catId = catIdByName.get(p.category) || null;
      const existing = findFullByCode.get(p.code);
      if (existing) {
        // Diff de precios por nivel
        const priceChanged =
          Number(existing.price_minorista)  !== Number(p.price_minorista) ||
          Number(existing.price_revendedor) !== Number(p.price_revendedor) ||
          Number(existing.price_mayorista)  !== Number(p.price_mayorista) ||
          Number(existing.price_vip)        !== Number(p.price_vip);
        // Reingreso: estaba sin stock y vuelve con stock
        const isReingreso = Number(existing.stock) <= 0 && Number(p.stock) > 0;
        if (priceChanged || isReingreso) {
          pendingChanges.push({
            product_id: existing.id,
            code: p.code,
            name: p.name,
            is_new: 0,
            is_reingreso: isReingreso ? 1 : 0,
            old_minorista:  existing.price_minorista,
            new_minorista:  p.price_minorista,
            old_revendedor: existing.price_revendedor,
            new_revendedor: p.price_revendedor,
            old_mayorista:  existing.price_mayorista,
            new_mayorista:  p.price_mayorista,
            old_vip:        existing.price_vip,
            new_vip:        p.price_vip,
          });
        }
        updateExisting.run(
          p.name, catId, p.cost,
          p.price_minorista, p.price_revendedor, p.price_mayorista, p.price_vip, p.price_publico,
          p.stock, existing.id
        );
        stats.actualizados++;
      } else {
        const r = insertNew.run(
          p.code, catId, p.name, p.cost,
          p.price_minorista, p.price_revendedor, p.price_mayorista, p.price_vip, p.price_publico,
          p.stock
        );
        pendingChanges.push({
          product_id: r.lastInsertRowid,
          code: p.code,
          name: p.name,
          is_new: 1,
          is_reingreso: 0,
          old_minorista: null, new_minorista: p.price_minorista,
          old_revendedor: null, new_revendedor: p.price_revendedor,
          old_mayorista: null, new_mayorista: p.price_mayorista,
          old_vip: null, new_vip: p.price_vip,
        });
        stats.nuevos++;
      }
    }
    const codes = Array.from(seen);
    if (codes.length) {
      const ph = codes.map(() => "?").join(",");
      const r = db.prepare(`UPDATE products SET stock = 0 WHERE code NOT IN (${ph}) AND stock > 0`).run(...codes);
      stats.sinStock = r.changes;
    }

    // Si hubo cambios de precio o productos nuevos, dejamos registro.
    // No registramos updates "vacios" para no ensuciar el historial cuando
    // se reimporta el mismo Excel sin cambios.
    if (pendingChanges.length) {
      const u = insertUpdate.run(source, items.length);
      const updateId = u.lastInsertRowid;
      let changedCount = 0;
      let newCount = 0;
      let reingresoCount = 0;
      for (const c of pendingChanges) {
        insertChange.run(
          updateId, c.product_id, c.code, c.name, c.is_new, c.is_reingreso,
          c.old_minorista,  c.new_minorista,
          c.old_revendedor, c.new_revendedor,
          c.old_mayorista,  c.new_mayorista,
          c.old_vip,        c.new_vip
        );
        if (c.is_new) newCount++;
        else if (c.is_reingreso) reingresoCount++;
        else changedCount++;
      }
      updateUpdateCounters.run(changedCount, newCount, reingresoCount, updateId);
      stats.updateId = updateId;
      stats.cambiosPrecio = changedCount;
      stats.reingresos = reingresoCount;
    }
  })();

  stats.visibles = db.prepare(
    "SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock > 0"
  ).get().n;

  return stats;
}

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

  const stats = importPrices(items, db);

  console.log("\nResumen:");
  console.log(`  Actualizados:        ${stats.actualizados}`);
  console.log(`  Nuevos:              ${stats.nuevos}`);
  console.log(`  Marcados sin stock:  ${stats.sinStock}`);
  console.log(`  Visibles ahora:      ${stats.visibles}`);
  db.close();
}

if (require.main === module) main();

module.exports = { importPrices };
