/**
 * Arranque para hosting (Render / Railway / Fly.io).
 *
 * Que hace:
 *  1. Muestra el DB_PATH efectivo y advierte si NO esta en un disco persistente.
 *  2. Si la base existe -> hace un backup con rotacion antes de arrancar.
 *  3. Si la base NO existe -> corre el seed inicial (con un mensaje BIEN visible
 *     porque eso significa que vamos a empezar con los usuarios demo y nada mas).
 *  4. Levanta el server.
 *
 * Variables de entorno utiles:
 *   DB_PATH=/data/maxaria.db          (Railway: montar volume en /data)
 *   EXCEL_PATH=/app/data/precios_maxaria.xlsx
 *   BACKUP_KEEP=7                     (cuantos backups mantener)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// Resolucion del DB_PATH con tres niveles:
//  1. Variable de entorno DB_PATH (si esta seteada).
//  2. Si existe /data como directorio (convencion de volumenes en
//     Railway / Render / Fly), usar /data/maxaria.db. Esto nos cubre
//     cuando el hosting tiene un volume montado pero la env var no
//     llega al container por algun bug del provider.
//  3. Fallback local: <proyecto>/data/maxaria.db (uso de desarrollo).
function resolveDbPath() {
  if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
    return { path: process.env.DB_PATH.trim(), source: "env DB_PATH" };
  }
  try {
    if (fs.existsSync("/data") && fs.statSync("/data").isDirectory()) {
      return { path: "/data/maxaria.db", source: "fallback /data/ (volumen detectado)" };
    }
  } catch (_) { /* en Windows /data no existe, seguimos */ }
  return { path: path.join(ROOT, "data", "maxaria.db"), source: "fallback dentro del proyecto" };
}
const _resolved = resolveDbPath();
const DB_PATH = _resolved.path;
const DB_PATH_SOURCE = _resolved.source;
// Lo propagamos a process.env para que server.js lo herede sin tener
// que repetir el calculo (server.js usa process.env.DB_PATH).
process.env.DB_PATH = DB_PATH;

// Heuristica simple: si DB_PATH cae adentro del checkout del proyecto,
// en hosting tipo Railway el filesystem es efimero y la base se va a borrar
// con cada deploy. La unica forma confiable es montar un volume y apuntar
// DB_PATH ahi (tipico: /data/maxaria.db).
function isInsideProject(p) {
  const abs = path.resolve(p);
  const root = path.resolve(ROOT);
  return abs.startsWith(root + path.sep) || abs === root;
}

console.log("=".repeat(60));
console.log("[boot] Maxaria - arranque");
console.log("[boot] DB_PATH        =", DB_PATH);
console.log("[boot] DB_PATH source =", DB_PATH_SOURCE);
console.log("[boot] NODE_ENV       =", process.env.NODE_ENV || "development");
console.log("[boot] BACKUP_KEEP    =", process.env.BACKUP_KEEP || "7 (default)");

if (process.env.NODE_ENV === "production" && isInsideProject(DB_PATH)) {
  console.warn("");
  console.warn("!!  ADVERTENCIA  !!");
  console.warn("!!  DB_PATH apunta DENTRO del proyecto:", DB_PATH);
  console.warn("!!  En Railway/Render/Fly el filesystem es EFIMERO:");
  console.warn("!!  cada deploy va a BORRAR la base y todos los usuarios.");
  console.warn("!!  Configura un volume persistente y seteá DB_PATH a esa ruta.");
  console.warn("!!  Ej Railway: volume montado en /data -> DB_PATH=/data/maxaria.db");
  console.warn("");
}

const dbExists = fs.existsSync(DB_PATH);

if (!dbExists) {
  console.warn("");
  console.warn("[boot] *** No existe la base en", DB_PATH);
  console.warn("[boot] *** Voy a correr el SEED inicial.");
  console.warn("[boot] *** Esto crea SOLO los 5 usuarios demo y los productos del Excel.");
  console.warn("[boot] *** Si esperabas encontrar usuarios creados antes, ALGO ANDA MAL");
  console.warn("[boot] *** con el volumen persistente. Verificá DB_PATH en el hosting.");
  console.warn("");
  try {
    const { runSeed } = require("./seed");
    runSeed();
  } catch (e) {
    console.error("[boot] FALLO el seed inicial:", e.message);
    console.error("[boot] Verifica que el Excel exista (EXCEL_PATH o data/precios_maxaria.xlsx)");
    process.exit(1);
  }
} else {
  const sizeKb = (fs.statSync(DB_PATH).size / 1024).toFixed(1);
  console.log("[boot] Base encontrada en", DB_PATH, "(" + sizeKb + " KB)");

  // Backup antes de levantar el server. Si algo sale mal mas tarde
  // (codigo nuevo que corrompe la base, error humano, etc.) tenemos
  // copias en {dirname(DB_PATH)}/backups/.
  try {
    const { backupDb } = require("./backup-db");
    backupDb(DB_PATH);
  } catch (e) {
    console.warn("[boot] Backup fallo (no es fatal, sigo arrancando):", e.message);
  }
}

console.log("[boot] Levantando server...");
console.log("=".repeat(60));
require("../server.js");
