/**
 * Arranque para hosting: si no existe la base, corre el seed automaticamente
 * y despues levanta el server. Pensado para Render / Railway / Fly.io.
 *
 * Variables de entorno utiles:
 *   DB_PATH=/data/maxaria.db          (donde guardar la base, conviene un disco persistente)
 *   EXCEL_PATH=/app/data/precios_maxaria.xlsx  (donde esta el Excel)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "maxaria.db");

if (!fs.existsSync(DB_PATH)) {
  console.log("[boot] No existe la base en", DB_PATH, "- corriendo seed inicial...");
  try {
    const { runSeed } = require("./seed");
    runSeed();
  } catch (e) {
    console.error("[boot] FALLO el seed inicial:", e.message);
    console.error("[boot] Verifica que el Excel exista (EXCEL_PATH o data/precios_maxaria.xlsx)");
    process.exit(1);
  }
} else {
  console.log("[boot] Base encontrada en", DB_PATH);
}

console.log("[boot] Levantando server...");
require("../server.js");
