/**
 * Arranque para hosting (Render / Railway / Fly.io).
 *
 * Que hace:
 *  1. Muestra el DB_PATH efectivo y advierte si NO esta en un disco persistente.
 *  2. Si la base existe -> hace un backup con rotacion antes de arrancar.
 *  3. Si la base NO existe:
 *     - SEED_ON_EMPTY=false (default en produccion): aborta con error claro.
 *     - SEED_ON_EMPTY=true + Excel presente: corre el seed inicial completo.
 *     - SEED_ON_EMPTY=true + sin Excel: aplica schema.sql y crea un usuario
 *       admin con password aleatoria (se imprime una sola vez en stdout).
 *  4. Imprime un banner consolidado con estado de la base.
 *  5. Levanta el server.
 *
 * Variables de entorno utiles:
 *   DB_PATH=/data/maxaria.db          (Railway: montar volume en /data)
 *   EXCEL_PATH=/app/data/precios_maxaria.xlsx
 *   BACKUP_KEEP=7                     (cuantos backups mantener)
 *   SEED_ON_EMPTY=true                (crear base vacia si no existe; default
 *                                      true en desarrollo, false en produccion)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { resolveExcelPath } = require("./excel_helper");

const ROOT = path.join(__dirname, "..");

const COMMON_VOLUME_PATHS = [
  "/data",
  "/var/data",
  "/mnt/data",
  "/persistent",
  "/storage",
  "/volume",
  "/volumes",
];

function findExistingDir(candidates) {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
    } catch (_) {}
  }
  return null;
}

function resolveDbPath() {
  if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
    return { path: process.env.DB_PATH.trim(), source: "env DB_PATH" };
  }
  const dir = findExistingDir(COMMON_VOLUME_PATHS);
  if (dir) {
    return { path: path.join(dir, "maxaria.db"), source: "fallback " + dir + "/ (volumen detectado)" };
  }
  return { path: path.join(ROOT, "data", "maxaria.db"), source: "fallback dentro del proyecto (efimero)" };
}

function logFilesystemDiagnostic() {
  console.log("[boot] DIAGNOSTICO filesystem:");
  try {
    const rootEntries = fs.readdirSync("/").sort();
    console.log("[boot]   Contenido de /:", rootEntries.join(" "));
  } catch (e) {
    console.log("[boot]   No pude listar /:", e.message);
  }
  for (const p of COMMON_VOLUME_PATHS) {
    let info = "(no existe)";
    try {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        let entries = "";
        try {
          const ls = fs.readdirSync(p);
          entries = ls.length ? "[" + ls.slice(0, 5).join(",") + (ls.length > 5 ? ",…" : "") + "]" : "[vacio]";
        } catch (_) {}
        info = "DIR " + entries;
      } else {
        info = "(no-dir)";
      }
    } catch (_) {}
    console.log("[boot]   " + p + ":", info);
  }
  for (const dir of ["/mnt", "/app"]) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const ls = fs.readdirSync(dir).sort();
        console.log("[boot]   Contenido de " + dir + ":", ls.length ? ls.join(" ") : "(vacio)");
      }
    } catch (_) {}
  }
  const envHints = Object.keys(process.env)
    .filter((k) => k === "DB_PATH" || k.startsWith("RAILWAY_") || k.includes("VOLUME") || k.includes("MOUNT"))
    .sort();
  if (envHints.length) {
    console.log("[boot]   Env vars relevantes:");
    for (const k of envHints) {
      const v = process.env[k] || "";
      const safe = (k === "SESSION_SECRET" || k.includes("SECRET") || k.includes("TOKEN")) ? "(oculto)" : v;
      console.log("[boot]     " + k + " =", safe);
    }
  } else {
    console.log("[boot]   Env vars relevantes: ninguna (DB_PATH / RAILWAY_* / *VOLUME* / *MOUNT* no estan seteadas)");
  }
}

const _resolved = resolveDbPath();
const DB_PATH = _resolved.path;
const DB_PATH_SOURCE = _resolved.source;
process.env.DB_PATH = DB_PATH;

// SEED_ON_EMPTY: controla si se permite crear una base nueva cuando no existe.
// Default: true en desarrollo, false en produccion (evita re-seedear por volumen mal montado).
const SEED_ON_EMPTY = process.env.SEED_ON_EMPTY !== undefined
  ? (process.env.SEED_ON_EMPTY === "true" || process.env.SEED_ON_EMPTY === "1")
  : (process.env.NODE_ENV !== "production");

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
console.log("[boot] SEED_ON_EMPTY  =", SEED_ON_EMPTY);

if (process.env.NODE_ENV === "production" && DB_PATH_SOURCE.indexOf("env") === -1 && DB_PATH_SOURCE.indexOf("volumen") === -1) {
  logFilesystemDiagnostic();
}

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

// Alfabeto sin caracteres que generen confusion visual (0/O/I/l/1)
// para que la password sea facil de dictar por telefono o WhatsApp.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function generateAdminPassword(len) {
  len = len || 14;
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const dbExists = fs.existsSync(DB_PATH);
let dbWasCreated = false;

if (!dbExists) {
  if (!SEED_ON_EMPTY) {
    console.error("");
    console.error("!".repeat(60));
    console.error("!! ERROR: no se encontró la base de datos en:");
    console.error("!!   " + DB_PATH);
    console.error("!!");
    console.error("!! SEED_ON_EMPTY=false — el arranque automático está");
    console.error("!! desactivado para evitar pérdida de datos accidental.");
    console.error("!!");
    console.error("!! Si es una instancia NUEVA: exportá SEED_ON_EMPTY=true");
    console.error("!! para crear una base vacía en el primer arranque.");
    console.error("!!");
    console.error("!! Si es una instancia EXISTENTE: verificá que el volumen");
    console.error("!! esté montado correctamente y que DB_PATH apunte a él.");
    console.error("!! DB_PATH actual: " + DB_PATH);
    console.error("!! DB_PATH source: " + DB_PATH_SOURCE);
    console.error("!".repeat(60));
    console.error("");
    process.exit(1);
  }

  const excelPath = resolveExcelPath();

  if (excelPath) {
    console.warn("");
    console.warn("[boot] *** No existe la base en", DB_PATH);
    console.warn("[boot] *** Excel encontrado en:", excelPath);
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
      process.exit(1);
    }
  } else {
    console.warn("");
    console.warn("[boot] *** No existe la base en", DB_PATH);
    console.warn("[boot] *** No se encontró Excel de precios (EXCEL_PATH o data/precios_maxaria.xlsx).");
    console.warn("[boot] *** Creando base vacía desde schema.sql...");
    console.warn("");
    try {
      const schemaPath = path.join(__dirname, "schema.sql");
      const schema = fs.readFileSync(schemaPath, "utf8");
      if (!fs.existsSync(path.dirname(DB_PATH))) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      }
      const initDb = new Database(DB_PATH);
      initDb.pragma("journal_mode = WAL");
      initDb.pragma("foreign_keys = ON");
      initDb.exec(schema);
      const freshAdminPassword = generateAdminPassword(14);
      const hash = bcrypt.hashSync(freshAdminPassword, 10);
      initDb.prepare(
        "INSERT INTO users (username, password_hash, full_name, level, active) VALUES (?, ?, ?, 99, 1)"
      ).run("admin", hash, "Administrador");
      initDb.close();
      console.log("");
      console.log("=".repeat(60));
      console.log("=== PRIMERA CONTRASEÑA DE ADMIN (guardala ahora):    ===");
      console.log("===   Usuario:     admin                              ===");
      console.log("===   Contraseña:  " + freshAdminPassword + "        ===");
      console.log("=".repeat(60));
      console.log("");
    } catch (e) {
      console.error("[boot] FALLO al crear la base vacía:", e.message);
      process.exit(1);
    }
  }

  dbWasCreated = true;
} else {
  const sizeKb = (fs.statSync(DB_PATH).size / 1024).toFixed(1);
  console.log("[boot] Base encontrada en", DB_PATH, "(" + sizeKb + " KB)");
  try {
    const { backupDb } = require("./backup-db");
    backupDb(DB_PATH);
  } catch (e) {
    console.warn("[boot] Backup fallo (no es fatal, sigo arrancando):", e.message);
  }
}

// Abrimos la base en modo readonly para consultar stats sin interferir
// con las migraciones que corre server.js al arrancar.
try {
  const statsDb = new Database(DB_PATH, { readonly: true });
  const productCount = statsDb.prepare("SELECT COUNT(*) as n FROM products").get().n;
  const userCount    = statsDb.prepare("SELECT COUNT(*) as n FROM users").get().n;
  const orderCount   = statsDb.prepare("SELECT COUNT(*) as n FROM orders").get().n;
  const dbSizeKb     = (fs.statSync(DB_PATH).size / 1024).toFixed(1);
  statsDb.close();

  const backupsDir = path.join(path.dirname(DB_PATH), "backups");
  let lastBackup = "ninguno";
  if (fs.existsSync(backupsDir)) {
    const backupFiles = fs.readdirSync(backupsDir)
      .filter(function(f) { return f.endsWith(".db"); })
      .sort()
      .reverse();
    if (backupFiles.length) {
      const mtime = fs.statSync(path.join(backupsDir, backupFiles[0])).mtime;
      lastBackup = backupFiles[0] + " (" + mtime.toISOString().slice(0, 19).replace("T", " ") + " UTC)";
    }
  }

  console.log("=".repeat(60));
  console.log("[boot] ESTADO DE LA BASE");
  console.log("[boot]   Ruta:          " + DB_PATH);
  console.log("[boot]   Estado:        " + (dbWasCreated ? "CREADA AHORA" : "existente"));
  console.log("[boot]   Tamaño:        " + dbSizeKb + " KB");
  console.log("[boot]   Productos:     " + productCount);
  console.log("[boot]   Usuarios:      " + userCount);
  console.log("[boot]   Pedidos:       " + orderCount);
  console.log("[boot]   Último backup: " + lastBackup);
  console.log("[boot]   Efímera:       " + (isInsideProject(DB_PATH) ? "SI (datos se pierden en cada deploy)" : "no"));
  console.log("=".repeat(60));
} catch (e) {
  console.warn("[boot] No se pudo leer el estado de la base:", e.message);
}

console.log("[boot] Levantando server...");
require("../server.js");
