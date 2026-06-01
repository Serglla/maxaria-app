/**
 * Crear o resetear un usuario.
 *
 * Uso:
 *   node scripts/create-admin.js <username> <password> [nivel] [nombre]
 *
 * nivel: 1=minorista, 2=revendedor, 3=mayorista, 4=vip, 99=admin, super=superadmin (default 99)
 *   "super" crea/promueve un superadmin (level 99 + is_superadmin=1).
 *
 * Si el usuario ya existe, le actualiza la contraseña y el nivel.
 */
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "maxaria.db");

const [, , username, password, levelStr, fullName] = process.argv;

if (!username || !password) {
  console.error("Uso: node scripts/create-admin.js <username> <password> [nivel] [nombre]");
  process.exit(1);
}

const isSuper = String(levelStr || "").toLowerCase() === "super";
const level = isSuper ? 99 : (Number(levelStr) || 99);
const superFlag = isSuper ? 1 : 0;

const db = new Database(DB_PATH);
// Asegurar que la columna exista (por si se corre el CLI antes de levantar el server).
try { db.exec("ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
const hash = bcrypt.hashSync(password, 10);

const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);

if (existing) {
  db.prepare(
    "UPDATE users SET password_hash = ?, level = ?, full_name = COALESCE(?, full_name), active = 1" +
    (isSuper ? ", is_superadmin = 1" : "") + " WHERE id = ?"
  ).run(hash, level, fullName || null, existing.id);
  console.log(`Usuario '${username}' actualizado (nivel ${level}${isSuper ? ", superadmin" : ""}).`);
} else {
  db.prepare(
    "INSERT INTO users (username, password_hash, full_name, level, active, is_superadmin) VALUES (?, ?, ?, ?, 1, ?)"
  ).run(username, hash, fullName || null, level, superFlag);
  console.log(`Usuario '${username}' creado (nivel ${level}${isSuper ? ", superadmin" : ""}).`);
}

db.close();
