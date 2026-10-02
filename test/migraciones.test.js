/**
 * Migraciones versionadas (lib/db/migrate.js): corren una vez y en orden, y si
 * una falla se deshace entera y el error sale (el server no arranca).
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");
const { runMigrations, loadMigrations } = require("../lib/db/migrate");

const SCHEMA = fs.readFileSync(path.join(__dirname, "..", "scripts", "schema.sql"), "utf8");
const quiet = { log: () => {} };

test("base nueva: aplica todas las migraciones y un segundo arranque no hace nada", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA);
  const total = loadMigrations().length;
  assert.equal(runMigrations(db, quiet).length, total);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM schema_version").get().n, total);
  assert.deepEqual(runMigrations(db, quiet), []);
  // Algunas tablas y columnas que agregan las migraciones
  for (const t of ["price_lists", "cash_movements", "stock_movements", "purchase_request_moves", "activity_log"]) {
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t), t);
  }
  const cols = db.prepare("PRAGMA table_info(purchase_request_items)").all().map((c) => c.name);
  for (const c of ["unit_price", "pack_mode", "comprimidos_per_unit"]) assert.ok(cols.includes(c), c);
});

test("una migracion que falla se deshace y frena el arranque", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maxaria-mig-"));
  fs.writeFileSync(path.join(dir, "001_ok.js"),
    "module.exports = { id: 1, name: 'ok', up(db) { db.exec('CREATE TABLE a (x INTEGER)'); } };");
  fs.writeFileSync(path.join(dir, "002_rota.js"),
    "module.exports = { id: 2, name: 'rota', up(db) { db.exec('CREATE TABLE b (x INTEGER)'); db.exec('ALTER TABLE noexiste ADD COLUMN y TEXT'); } };");
  const db = new Database(":memory:");
  assert.throws(() => runMigrations(db, { ...quiet, dir }), /Migracion 2 \(rota\) fallo/);
  assert.deepEqual(db.prepare("SELECT version FROM schema_version").all().map((r) => r.version), [1]);
  assert.ok(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='b'").get(), "la tabla b se deshizo");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("los numeros de migracion no pueden tener huecos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maxaria-mig-"));
  fs.writeFileSync(path.join(dir, "001_a.js"), "module.exports = { id: 1, name: 'a', up() {} };");
  fs.writeFileSync(path.join(dir, "003_c.js"), "module.exports = { id: 3, name: 'c', up() {} };");
  assert.throws(() => loadMigrations(dir), /falta la numero 2/);
  fs.rmSync(dir, { recursive: true, force: true });
});
