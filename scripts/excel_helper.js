/**
 * Helper para leer y escribir el Excel de precios de Maxaria.
 *
 * Mapeo de columnas:
 *   1  Codigo Interno     -> code
 *   2  Nombre del Articulo-> name
 *   3  Stock              -> stock (si <=0, no se muestra)
 *   4  Categoria          -> category (texto)
 *   5  Precio de costo    -> cost
 *   6  Principal          -> price_publico (informativo)
 *   7  L0                 -> price_vip
 *   8  L1                 -> price_mayorista
 *   9  L2                 -> DESCARTAR
 *   10 L3                 -> price_minorista
 *   11 LESP               -> price_revendedor
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const COL = {
  code: "Código Interno",
  name: "Nombre del Artículo",
  stock: "Stock",
  category: "Categoría",
  cost: "Precio de costo",
  price_publico: "Principal",
  price_vip: "L0",
  price_mayorista: "L1",
  price_minorista: "L3",
  price_revendedor: "LESP",
};

function toInt(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.round(n);
}

// Precios (costo + niveles): admiten 2 decimales (centavos). El stock usa toInt.
function toPrice(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function trimStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Resuelve la ruta del Excel buscando en varios lugares, en este orden:
 *   1. argumento explicito
 *   2. variable de entorno EXCEL_PATH
 *   3. <proyecto>/data/precios_maxaria.xlsx   (lo que se despliega)
 *   4. ../precios_maxaria.xlsx                (modo dev en Windows local)
 * Retorna null si no encuentra nada.
 */
function resolveExcelPath(explicit) {
  const ROOT = path.join(__dirname, "..");

  // Argumento explícito (uso programático desde seed.js, import-prices.js, etc.):
  // validar estrictamente — si no existe es un error del llamador.
  if (explicit) {
    const p = path.resolve(explicit);
    if (!fs.existsSync(p)) throw new Error("Excel no encontrado en ruta explícita: " + p);
    return p;
  }

  // EXCEL_PATH seteada: usar esa y solo esa, sin caer a fallbacks.
  // Retorna null si el archivo no existe — boot.js lo maneja con la rama schema-only.
  if (process.env.EXCEL_PATH && process.env.EXCEL_PATH.trim()) {
    const p = path.resolve(process.env.EXCEL_PATH.trim());
    if (fs.existsSync(p)) return p;
    console.warn(
      '[excel_helper] WARNING: EXCEL_PATH="' + p +
      '" está seteado pero el archivo no existe. ' +
      'Continuando sin Excel (puede caer a la rama schema-only en boot.js).'
    );
    return null;
  }

  // Sin env var ni argumento: buscar en ubicaciones de desarrollo/convenio.
  const fallbacks = [
    path.join(ROOT, "data", "precios_maxaria.xlsx"),
    path.join(ROOT, "..", "precios_maxaria.xlsx"),
  ];
  for (const p of fallbacks) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readExcel(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  return parseWorkbook(wb);
}

function readExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  return parseWorkbook(wb);
}

function parseWorkbook(wb) {
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!rows.length) throw new Error("Excel vacio");

  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i] && rows[i][0] && String(rows[i][0]).toLowerCase().includes("código")) {
      headerIdx = i;
      break;
    }
  }
  const headers = rows[headerIdx].map(trimStr);
  const idxOf = {};
  for (const [key, label] of Object.entries(COL)) {
    const i = headers.indexOf(label);
    if (i === -1) throw new Error(`No encuentro columna "${label}" en el Excel`);
    idxOf[key] = i;
  }

  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const code = trimStr(r[idxOf.code]);
    const name = trimStr(r[idxOf.name]);
    if (!code || !name) continue;
    out.push({
      code, name,
      stock: toInt(r[idxOf.stock]),
      category: trimStr(r[idxOf.category]) || "Sin categoria",
      cost: toPrice(r[idxOf.cost]),
      price_publico: toPrice(r[idxOf.price_publico]),
      price_vip: toPrice(r[idxOf.price_vip]),
      price_mayorista: toPrice(r[idxOf.price_mayorista]),
      price_minorista: toPrice(r[idxOf.price_minorista]),
      price_revendedor: toPrice(r[idxOf.price_revendedor]),
    });
  }
  return out;
}

function writeExcel(filePath, products) {
  const headers = [
    "Código Interno","Nombre del Artículo","Stock","Categoría",
    "Precio de costo","Principal","L0","L1","L2","L3","LESP",
  ];
  const rows = [headers];
  for (const p of products) {
    rows.push([
      p.code || "", p.name || "",
      Number(p.stock) || 0, p.category || "",
      Number(p.cost) || 0, Number(p.price_publico) || 0,
      Number(p.price_vip) || 0, Number(p.price_mayorista) || 0,
      0, Number(p.price_minorista) || 0,
      Number(p.price_revendedor) || 0,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 }, { wch: 38 }, { wch: 8 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Articulos");
  XLSX.writeFile(wb, filePath);
}

module.exports = { readExcel, readExcelBuffer, writeExcel, resolveExcelPath, COL };
