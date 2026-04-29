/**
 * Seed inicial: crea la base, carga productos desde el Excel y crea 5 usuarios demo.
 *
 * Uso:
 *   npm run seed                                -> busca el Excel automaticamente
 *   npm run seed -- "ruta\al\tu_excel.xlsx"     -> usa otro archivo
 *
 * Variable de entorno opcional:
 *   EXCEL_PATH=/ruta/al/excel.xlsx
 *
 * Borra y recrea la base si ya existe.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { readExcel, resolveExcelPath } = require("./excel_helper");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "maxaria.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const PRODUCTS_JSON = path.join(DATA_DIR, "products.json");

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function runSeed(opts = {}) {
  ensureDir(path.dirname(DB_PATH));

  const excelPath = resolveExcelPath(opts.excelPath || process.argv[2]);
  if (!excelPath) {
    throw new Error(
      "No encuentro el Excel. Lugares revisados:\n" +
      `  - argumento de la linea de comandos\n` +
      `  - variable de entorno EXCEL_PATH\n` +
      `  - ${path.join(ROOT, "data", "precios_maxaria.xlsx")}\n` +
      `  - ${path.join(ROOT, "..", "precios_maxaria.xlsx")}`
    );
  }
  console.log("Leyendo Excel:", excelPath);

  // Antes de borrar la base, rescatar las imagenes que el admin haya
  // cargado manualmente (image_url por código de producto). Asi al
  // re-seedear no se pierden las fotos.
  const imgByCodeFromDb = new Map();
  if (fs.existsSync(DB_PATH)) {
    try {
      const oldDb = new Database(DB_PATH, { readonly: true });
      const rows = oldDb.prepare(
        "SELECT code, image_url FROM products WHERE image_url IS NOT NULL AND image_url != ''"
      ).all();
      for (const r of rows) {
        if (r.code && r.image_url) imgByCodeFromDb.set(String(r.code).trim(), r.image_url);
      }
      oldDb.close();
      if (imgByCodeFromDb.size > 0) {
        console.log(`Imágenes rescatadas del DB anterior: ${imgByCodeFromDb.size}`);
      }
    } catch (e) {
      console.warn("WARN: no se pudieron leer imágenes del DB anterior:", e.message);
    }

    fs.unlinkSync(DB_PATH);
    console.log("Base anterior borrada.");
  }
  const wal = DB_PATH + "-wal";
  const shm = DB_PATH + "-shm";
  if (fs.existsSync(wal)) fs.unlinkSync(wal);
  if (fs.existsSync(shm)) fs.unlinkSync(shm);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  console.log("Schema aplicado.");

  const items = readExcel(excelPath);
  console.log(`Filas leidas del Excel: ${items.length}`);

  const imgByCode = new Map();
  if (fs.existsSync(PRODUCTS_JSON)) {
    try {
      const old = JSON.parse(fs.readFileSync(PRODUCTS_JSON, "utf8"));
      for (const p of old) {
        const code = String(p.price_base || "").trim();
        if (code && p.image) imgByCode.set(code, p.image);
      }
      console.log(`Imagenes recuperadas del HTML: ${imgByCode.size}`);
    } catch (e) {
      console.warn("WARN: products.json:", e.message);
    }
  }

  const cats = Array.from(new Set(items.map((x) => x.category))).sort();
  const insertCat = db.prepare("INSERT INTO categories (name, sort_order) VALUES (?, ?)");
  db.transaction(() => cats.forEach((c, i) => insertCat.run(c, i)))();
  const catIdByName = new Map(
    db.prepare("SELECT id, name FROM categories").all().map((c) => [c.name, c.id])
  );
  console.log(`Categorias insertadas: ${cats.length}`);

  const insertProd = db.prepare(`
    INSERT INTO products
      (code, category_id, name, image_url, cost,
       price_minorista, price_revendedor, price_mayorista, price_vip, price_publico,
       stock, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  let ok = 0, conImg = 0, dup = 0;
  const seenCodes = new Set();
  db.transaction(() => {
    for (const p of items) {
      if (seenCodes.has(p.code)) { dup++; continue; }
      seenCodes.add(p.code);
      // Prioridad: imagen guardada en el DB anterior > imagen del products.json legacy
      const img = imgByCodeFromDb.get(p.code) || imgByCode.get(p.code) || null;
      if (img) conImg++;
      insertProd.run(
        p.code, catIdByName.get(p.category) || null, p.name, img, p.cost,
        p.price_minorista, p.price_revendedor, p.price_mayorista, p.price_vip, p.price_publico,
        p.stock
      );
      ok++;
    }
  })();
  console.log(`Productos insertados: ${ok} (con imagen: ${conImg}, duplicados: ${dup})`);

  const visibles = db.prepare(
    "SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock > 0"
  ).get().n;
  console.log(`Productos visibles (stock > 0): ${visibles}`);

  const usuariosDemo = [
    { username: "admin",      password: "admin1234",      level: 99, full_name: "Administrador" },
    { username: "minorista",  password: "minorista1234",  level: 1,  full_name: "Cliente Minorista Demo" },
    { username: "revendedor", password: "revendedor1234", level: 2,  full_name: "Revendedor Demo" },
    { username: "mayorista",  password: "mayorista1234",  level: 3,  full_name: "Mayorista Demo" },
    { username: "vip",        password: "vip1234",        level: 4,  full_name: "Cliente VIP Demo" },
  ];
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, level, active)
    VALUES (?, ?, ?, ?, 1)
  `);
  usuariosDemo.forEach((u) => {
    insertUser.run(u.username, bcrypt.hashSync(u.password, 10), u.full_name, u.level);
    console.log(`  Usuario: ${u.username.padEnd(12)} (nivel ${u.level})  contrasena: ${u.password}`);
  });

  db.close();
  console.log("\nSeed completado. Base en:", DB_PATH);
  console.log("IMPORTANTE: cambia las contrasenas demo antes de mostrar la app a clientes.\n");
}

if (require.main === module) {
  try { runSeed(); }
  catch (e) { console.error("ERROR:", e.message); process.exit(1); }
}

module.exports = { runSeed };
