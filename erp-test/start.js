/**
 * ERP Test — arranque de la instancia de DEMO (solo rama erp-test).
 *
 * - Usa el mismo boot de Maxaria (backup, seed, server), pero con defaults de demo:
 *     SEED_ON_EMPTY=true y EXCEL_PATH = erp-test/erp_test_bazar.xlsx
 *   => en el primer arranque crea la base con los artículos de bazar ficticios
 *      y los usuarios demo del seed (admin/admin1234, mayorista/mayorista1234, etc.).
 * - Después de levantar el server completa la demo: nombre "ERP Test",
 *   usuario vendedor y clientes asignados a ese vendedor.
 * - DEMO_RESET=true borra la base antes de arrancar (volver la demo a cero).
 *   Acordate de sacar la variable después, sino se resetea en cada deploy.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

if (!process.env.SEED_ON_EMPTY) process.env.SEED_ON_EMPTY = "true";
if (!process.env.EXCEL_PATH) process.env.EXCEL_PATH = path.join(__dirname, "erp_test_bazar.xlsx");

if (process.env.DEMO_RESET === "true" && process.env.DB_PATH) {
  for (const suf of ["", "-wal", "-shm"]) {
    const f = process.env.DB_PATH + suf;
    try { if (fs.existsSync(f)) { fs.unlinkSync(f); console.log("[erp-test] DEMO_RESET: borrado", f); } } catch (e) {
      console.warn("[erp-test] No pude borrar", f, e.message);
    }
  }
}

// Boot normal de la app (crea/seedea la base, corre migraciones y levanta el server)
require(path.join(ROOT, "scripts", "boot.js"));

// ---- Completar datos de demo (idempotente) ----
try {
  const Database = require("better-sqlite3");
  const bcrypt = require("bcryptjs");
  const db = new Database(process.env.DB_PATH);
  const APP_NAME = process.env.APP_NAME || "ERP Test";

  const setSetting = (k, v) => db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).run(k, v);

  const cur = db.prepare("SELECT value FROM settings WHERE key = 'app_name'").get();
  if (!cur || !cur.value || cur.value === "Maxaria") setSetting("app_name", APP_NAME);

  const wa = process.env.DEMO_WHATSAPP || process.env.WHATSAPP_NUMBER || null;
  let vend = db.prepare("SELECT id FROM users WHERE username = 'vendedor'").get();
  if (!vend) {
    const r = db.prepare(
      "INSERT INTO users (username, password_hash, full_name, level, active, whatsapp_number, vendedor_price_level) " +
      "VALUES ('vendedor', ?, 'Vendedor Demo', 5, 1, ?, 3)"
    ).run(bcrypt.hashSync("vendedor1234", 10), wa);
    vend = { id: r.lastInsertRowid };
    console.log("[erp-test] Usuario demo creado: vendedor / vendedor1234");
  } else if (wa) {
    db.prepare("UPDATE users SET whatsapp_number = COALESCE(whatsapp_number, ?) WHERE id = ?").run(wa, vend.id);
  }
  const n = db.prepare(
    "UPDATE users SET assigned_vendedor_id = ? WHERE level BETWEEN 1 AND 4 AND assigned_vendedor_id IS NULL"
  ).run(vend.id).changes;
  if (n) console.log("[erp-test] Clientes asignados al vendedor demo:", n);

  db.close();
  console.log("[erp-test] Demo lista:", APP_NAME);
} catch (e) {
  console.warn("[erp-test] No se pudo completar la demo (no es fatal):", e.message);
}
