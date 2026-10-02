"use strict";
// Herramientas para escribir migraciones.

function columnExists(db, table, column) {
  return db.prepare("PRAGMA table_info(" + table + ")").all().some((c) => c.name === column);
}

function tableExists(db, table) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
}

// Agrega una columna si no existe. Devuelve true si la agrego (sirve para
// correr un UPDATE de una sola vez junto con la columna nueva).
// A diferencia del viejo try/catch, si la tabla no existe o la definicion es
// invalida tira el error: la migracion falla y el server no arranca.
function addColumn(db, table, column, definition) {
  if (!tableExists(db, table)) throw new Error("addColumn: no existe la tabla " + table);
  if (columnExists(db, table, column)) return false;
  db.exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
  return true;
}

// Para las pocas sentencias que en bases viejas pueden fallar por datos (un
// indice unico sobre datos repetidos): deja el error en el log y sigue, como
// hacia el codigo anterior, pero ya no en silencio.
function tolerant(db, fn) {
  try { fn(); } catch (e) { console.error("[migracion] sentencia omitida: " + e.message); }
}

module.exports = { addColumn, columnExists, tableExists, tolerant };
