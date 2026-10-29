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

test("007: los pedidos de un tercerizado pasan a debito neto y sin 'Comision rendida'", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA);
  runMigrations(db, quiet);
  // Estado viejo: debito por el total + credito de comision al cobrar.
  const v = db.prepare("INSERT INTO users (username, password_hash, level, is_tercerizado) VALUES ('juan','x',5,1)").run().lastInsertRowid;
  const p = db.prepare("INSERT INTO users (username, password_hash, level, is_tercerizado) VALUES ('pepe','x',5,0)").run().lastInsertRowid;
  const c = db.prepare("INSERT INTO users (username, password_hash, level) VALUES ('walter','x',1)").run().lastInsertRowid;
  const prod = db.prepare("INSERT INTO products (code, name) VALUES ('1','A')").run().lastInsertRowid;
  const mk = (vend, total, cost) => {
    const o = db.prepare("INSERT INTO orders (user_id, status, total, assigned_vendedor_id) VALUES (?, 'entregado', ?, ?)").run(c, total, vend).lastInsertRowid;
    db.prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal, vendedor_cost_unit) VALUES (?, ?, 'A', 10, ?, ?, ?)")
      .run(o, prod, total / 10, total, cost);
    db.prepare("INSERT INTO account_movements (user_id, type, amount, description, order_id) VALUES (?, 'debit', ?, 'Pedido', ?)").run(c, total, o);
    return o;
  };
  const oSaldado = mk(v, 11110, 1000);
  db.prepare("INSERT INTO account_movements (user_id, type, amount, description, order_id) VALUES (?, 'credit', 10000, 'Cobro', ?)").run(c, oSaldado);
  db.prepare("INSERT INTO account_movements (user_id, type, amount, description, order_id) VALUES (?, 'credit', 1110, 'Comisión rendida vendedor', ?)").run(c, oSaldado);
  const oParcial = mk(v, 11110, 1000);
  db.prepare("INSERT INTO account_movements (user_id, type, amount, description, order_id) VALUES (?, 'credit', 5000, 'Cobro', ?)").run(c, oParcial);
  db.prepare("INSERT INTO account_movements (user_id, type, amount, description, order_id) VALUES (?, 'credit', 555, 'Comisión rendida vendedor', ?)").run(c, oParcial);
  const oPropio = mk(p, 11110, 1000);

  db.prepare("DELETE FROM schema_version WHERE version = 7").run();
  assert.deepEqual(runMigrations(db, quiet), ["7_tercerizado_cuenta_neta"]);
  const bal = (o) => db.prepare("SELECT SUM(CASE WHEN type='debit' THEN amount ELSE -amount END) AS b FROM account_movements WHERE order_id = ?").get(o).b;
  assert.equal(bal(oSaldado), 0, "el saldado sigue saldado");
  assert.equal(bal(oParcial), 5000, "la deuda queda en neto (10000 - 5000)");
  assert.equal(bal(oPropio), 11110, "el vendedor propio no cambia");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_movements WHERE description LIKE 'Comisión rendida%'").get().n, 0);
});
