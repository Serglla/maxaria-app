/**
 * Helper para leer y escribir el Excel de precios de Maxaria.
 *
 * Mapeo de columnas (acordado con el usuario):
 *   1  Codigo Interno     -> code
 *   2  Nombre del Articulo-> name
 *   3  Stock              -> stock (si <=0, no se muestra)
 *   4  Categoria          -> category (texto)
 *   5  Precio de costo    -> cost
 *   6  Principal          -> price_publico (informativo)
 *   7  L0                 -> price_vip
 *   8  L1                 -> price_mayorista
 *   9  L2                 -> price_minorista
 *   10 L3                 -> DESCARTAR
 *   11 LESP               -> price_revendedor
 */
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
  price_minorista: "L2",
  // L3 se ignora
  price_revendedor: "LESP",
};

function toInt(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.round(n);
}

function trimStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function readExcel(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  // header:1 -> array de arrays. Tomamos los headers de la primera fila no vacia.
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!rows.length) throw new Error("Excel vacío");

  // Localizar fila de headers
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
    if (!code || !name) continue; // saltea filas vacias / huerfanas
    out.push({
      code,
      name,
      stock: toInt(r[idxOf.stock]),
      category: trimStr(r[idxOf.category]) || "Sin categoría",
      cost: toInt(r[idxOf.cost]),
      price_publico: toInt(r[idxOf.price_publico]),
      price_vip: toInt(r[idxOf.price_vip]),
      price_mayorista: toInt(r[idxOf.price_mayorista]),
      price_minorista: toInt(r[idxOf.price_minorista]),
      price_revendedor: toInt(r[idxOf.price_revendedor]),
    });
  }
  return out;
}

function writeExcel(filePath, products) {
  // Generamos el Excel respetando los mismos headers del original
  const headers = [
    "Código Interno",
    "Nombre del Artículo",
    "Stock",
    "Categoría",
    "Precio de costo",
    "Principal",
    "L0",   // VIP
    "L1",   // Mayorista
    "L2",   // Minorista
    "L3",   // Sin uso (lo dejamos en 0)
    "LESP", // Revendedor
  ];
  const rows = [headers];
  for (const p of products) {
    rows.push([
      p.code || "",
      p.name || "",
      Number(p.stock) || 0,
      p.category || "",
      Number(p.cost) || 0,
      Number(p.price_publico) || 0,
      Number(p.price_vip) || 0,
      Number(p.price_mayorista) || 0,
      Number(p.price_minorista) || 0,
      0,
      Number(p.price_revendedor) || 0,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Anchos minimamente decentes
  ws["!cols"] = [
    { wch: 12 }, { wch: 38 }, { wch: 8 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Articulos");
  XLSX.writeFile(wb, filePath);
}

module.exports = { readExcel, writeExcel, COL };
