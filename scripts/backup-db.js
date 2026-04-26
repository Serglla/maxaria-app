/**
 * Backup automatico de la base SQLite.
 *
 * - Copia data/maxaria.db a {dirname}/backups/maxaria-YYYYMMDD-HHmmss.db
 * - Mantiene solo los ultimos KEEP backups (default 7).
 * - Pensado para correr al arranque del server desde scripts/boot.js.
 *
 * Razon de existir: en Railway/Render/Fly cualquier error humano (push de
 * codigo que rompe el seed, cambio de DB_PATH, perdida del volume, etc.)
 * puede dejarnos sin la base. Tener backups locales en el mismo volume
 * es la primera linea de defensa.
 *
 * Uso programatico:
 *   const { backupDb } = require("./backup-db");
 *   backupDb("/data/maxaria.db");          // hace el backup ahora
 *
 * Uso CLI:
 *   node scripts/backup-db.js              // usa DB_PATH o data/maxaria.db
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_KEEP = Number(process.env.BACKUP_KEEP) || 7;

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function backupDb(dbPath, opts) {
  opts = opts || {};
  const keep = Number(opts.keep) || DEFAULT_KEEP;

  if (!dbPath) throw new Error("backupDb: falta dbPath");
  if (!fs.existsSync(dbPath)) {
    console.warn("[backup] La base no existe todavia, no hay nada para respaldar:", dbPath);
    return null;
  }

  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath, path.extname(dbPath));
  const backupsDir = path.join(dir, "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  const target = path.join(backupsDir, base + "-" + ts() + ".db");

  try {
    // copyFileSync hace una copia atomica del archivo principal.
    // No copiamos el WAL/SHM: SQLite lee la base correctamente
    // sin ellos siempre que no esten escribiendo en ese momento.
    // En el arranque, antes de abrir la DB, esto es seguro.
    fs.copyFileSync(dbPath, target);
    const sizeMb = (fs.statSync(target).size / (1024 * 1024)).toFixed(2);
    console.log("[backup] Copia creada:", target, "(" + sizeMb + " MB)");
  } catch (e) {
    console.error("[backup] FALLO al crear backup:", e.message);
    return null;
  }

  // Rotacion: borrar los mas viejos manteniendo los ultimos `keep`.
  try {
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith(base + "-") && f.endsWith(".db"))
      .map((f) => ({
        name: f,
        full: path.join(backupsDir, f),
        mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime); // mas nuevo primero

    const toDelete = files.slice(keep);
    for (const f of toDelete) {
      try {
        fs.unlinkSync(f.full);
        console.log("[backup] Rotado (borrado):", f.name);
      } catch (e) {
        console.warn("[backup] No pude borrar", f.name, ":", e.message);
      }
    }
    console.log("[backup] Backups en disco:", Math.min(files.length, keep), "/", keep);
  } catch (e) {
    console.warn("[backup] No pude rotar backups:", e.message);
  }

  return target;
}

if (require.main === module) {
  const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "maxaria.db");
  backupDb(dbPath);
}

module.exports = { backupDb };
