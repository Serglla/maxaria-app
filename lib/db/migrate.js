"use strict";
// Migraciones versionadas de la base.
//
// Cada archivo de lib/db/migrations/ exporta { id, name, up(db) }. Al arrancar,
// se corren en orden las que todavia no figuran en schema_version, cada una en
// su propia transaccion. Si una falla, se deshace y el server NO arranca: es
// preferible a seguir con la base a medias.
//
// Para cambiar la estructura de la base: agregar un archivo nuevo con el
// siguiente numero (002_..., 003_...). Nunca editar una migracion ya subida.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "migrations");

function loadMigrations(dir) {
  dir = dir || DIR;
  const list = fs.readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.js$/.test(f))
    .sort()
    .map((f) => {
      const m = require(path.join(dir, f));
      if (Number(f.slice(0, 3)) !== m.id) throw new Error("Migracion " + f + ": el id no coincide con el nombre");
      return m;
    });
  list.forEach((m, i) => {
    if (m.id !== i + 1) throw new Error("Migraciones: falta la numero " + (i + 1));
  });
  return list;
}

function runMigrations(db, opts) {
  const log = (opts && opts.log) || console.log;
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_version (" +
    "  version INTEGER PRIMARY KEY," +
    "  name TEXT NOT NULL," +
    "  applied_at TEXT NOT NULL DEFAULT (datetime('now'))" +
    ")"
  );
  const done = new Set(db.prepare("SELECT version FROM schema_version").all().map((r) => r.version));
  const applied = [];
  for (const m of loadMigrations(opts && opts.dir)) {
    if (done.has(m.id)) continue;
    try {
      db.transaction(() => {
        m.up(db);
        db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(m.id, m.name);
      })();
    } catch (e) {
      e.message = "Migracion " + m.id + " (" + m.name + ") fallo: " + e.message;
      throw e;
    }
    applied.push(m.id + "_" + m.name);
  }
  if (applied.length) log("[migraciones] aplicadas: " + applied.join(", "));
  return applied;
}

function currentVersion(db) {
  try { return db.prepare("SELECT MAX(version) AS v FROM schema_version").get().v || 0; } catch (_) { return 0; }
}

module.exports = { runMigrations, currentVersion, loadMigrations };
