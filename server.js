/**
 * Maxaria - servidor principal
 */
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { readExcelBuffer } = require("./scripts/excel_helper");
const { importPrices } = require("./scripts/import-prices");

const ENV_PATH = path.join(__dirname, ".env");
if (fs.existsSync(ENV_PATH)) {
  fs.readFileSync(ENV_PATH, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    });
}

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-cambiame";
const NODE_ENV = process.env.NODE_ENV || "development";
const WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || "").replace(/[^0-9]/g, "");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "maxaria.db");

// Detecta si la DB esta dentro del checkout del proyecto. En hosting tipo
// Railway/Render eso significa filesystem efimero -> la base se borra en
// cada deploy. Lo usamos para mostrar advertencias en /admin.
function isEphemeralDbPath(p) {
  const abs = path.resolve(p);
  const root = path.resolve(__dirname);
  return abs === root || abs.startsWith(root + path.sep);
}

if (!fs.existsSync(DB_PATH)) {
  console.error("ERROR: no existe la base", DB_PATH, "\nCorre primero:  npm run seed");
  process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Migracion: tabla settings para config runtime editable desde el admin.
// Se crea en bases existentes la primera vez que arranca el server.
db.exec(
  "CREATE TABLE IF NOT EXISTS settings (" +
  "  key TEXT PRIMARY KEY," +
  "  value TEXT," +
  "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ")"
);

// Migracion: tablas para historial de cambios de precio. Se crean en
// bases existentes la primera vez que arranca el server con esta version.
db.exec(
  "CREATE TABLE IF NOT EXISTS price_updates (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))," +
  "  source TEXT," +
  "  rows_total INTEGER NOT NULL DEFAULT 0," +
  "  products_changed INTEGER NOT NULL DEFAULT 0," +
  "  products_new INTEGER NOT NULL DEFAULT 0" +
  ");" +
  "CREATE TABLE IF NOT EXISTS price_changes (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  update_id INTEGER NOT NULL REFERENCES price_updates(id) ON DELETE CASCADE," +
  "  product_id INTEGER REFERENCES products(id)," +
  "  code TEXT, name TEXT, is_new INTEGER NOT NULL DEFAULT 0," +
  "  old_minorista INTEGER, new_minorista INTEGER," +
  "  old_revendedor INTEGER, new_revendedor INTEGER," +
  "  old_mayorista INTEGER, new_mayorista INTEGER," +
  "  old_vip INTEGER, new_vip INTEGER" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_price_changes_update ON price_changes(update_id);" +
  "CREATE INDEX IF NOT EXISTS idx_price_changes_product ON price_changes(product_id);"
);

// Migracion: soporte para reingresos (productos que vuelven de stock 0).
try { db.exec("ALTER TABLE price_changes ADD COLUMN is_reingreso INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE price_updates ADD COLUMN products_reingreso INTEGER NOT NULL DEFAULT 0"); } catch (_) {}

// Migracion: tabla para permisos de categorias por usuario.
// Si un usuario no tiene filas en esta tabla, ve TODAS las categorias.
// Si tiene filas, solo ve las categorias permitidas.
db.exec(
  "CREATE TABLE IF NOT EXISTS user_category_access (" +
  "  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
  "  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE," +
  "  PRIMARY KEY (user_id, category_id)" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_uca_user     ON user_category_access(user_id);" +
  "CREATE INDEX IF NOT EXISTS idx_uca_category ON user_category_access(category_id);"
);

// Migracion: Vendedores (nivel 5).
// - orders.assigned_vendedor_id: vendedor asignado a entregar el pedido.
// - users.vendedor_price_level: lista de precios que ve el vendedor (1-4).
// - deliveries: registro de entrega + cobro (efectivo / transferencia).
try { db.exec("ALTER TABLE orders ADD COLUMN assigned_vendedor_id INTEGER REFERENCES users(id)"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN vendedor_price_level INTEGER NOT NULL DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN whatsapp_number TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN plain_password TEXT"); } catch (_) {}

// Migracion: Listas de precios personalizadas.
// - price_lists: lista base (minorista/revendedor/mayorista/vip/publico) + % ganancia.
//   `markup_percent` (nombre historico) representa la GANANCIA LIMPIA del vendedor
//   sobre el precio final, NO un recargo sobre el base. El precio efectivo es:
//      Math.round(products.price_<base_level> / (1 - markup_percent / 100))
//   Asi, precio_efectivo - markup_percent% del precio_efectivo == base.
// - users.assigned_vendedor_id: vendedor (level 5) que tiene asignado este cliente.
//   El pedido del cliente va al WhatsApp del vendedor asignado.
// - users.price_list_id: lista de precios que ve este cliente.
//   Si es NULL, el cliente ve los precios segun su `level` como hasta ahora.
db.exec(
  "CREATE TABLE IF NOT EXISTS price_lists (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  name TEXT UNIQUE NOT NULL," +
  "  base_level TEXT NOT NULL DEFAULT 'minorista'," +
  "  markup_percent REAL NOT NULL DEFAULT 0," +
  "  active INTEGER NOT NULL DEFAULT 1," +
  "  notes TEXT," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))," +
  "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_price_lists_active ON price_lists(active);"
);
try { db.exec("ALTER TABLE users ADD COLUMN assigned_vendedor_id INTEGER REFERENCES users(id)"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN price_list_id INTEGER REFERENCES price_lists(id)"); } catch (_) {}
db.exec(
  "CREATE TABLE IF NOT EXISTS deliveries (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  order_id INTEGER NOT NULL REFERENCES orders(id)," +
  "  vendedor_id INTEGER NOT NULL REFERENCES users(id)," +
  "  delivered_to TEXT NOT NULL DEFAULT ''," +
  "  efectivo_amount REAL NOT NULL DEFAULT 0," +
  "  transferencia_amount REAL NOT NULL DEFAULT 0," +
  "  notes TEXT," +
  "  delivered_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_deliveries_order    ON deliveries(order_id);" +
  "CREATE INDEX IF NOT EXISTS idx_deliveries_vendedor ON deliveries(vendedor_id);"
);

// Migracion: Proveedores, Compras, Pagos y Cuentas corrientes.
db.exec(
  "CREATE TABLE IF NOT EXISTS suppliers (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  name TEXT NOT NULL," +
  "  contact TEXT," +
  "  phone TEXT," +
  "  email TEXT," +
  "  notes TEXT," +
  "  active INTEGER NOT NULL DEFAULT 1," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE TABLE IF NOT EXISTS purchase_orders (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  supplier_id INTEGER REFERENCES suppliers(id)," +
  "  reference TEXT," +
  "  notes TEXT," +
  "  total_cost REAL NOT NULL DEFAULT 0," +
  "  received_at TEXT NOT NULL DEFAULT (datetime('now'))," +
  "  created_by INTEGER REFERENCES users(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);" +
  "CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(received_at);" +
  "CREATE TABLE IF NOT EXISTS purchase_items (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE," +
  "  product_id INTEGER REFERENCES products(id)," +
  "  product_code TEXT NOT NULL DEFAULT ''," +
  "  product_name TEXT NOT NULL DEFAULT ''," +
  "  quantity INTEGER NOT NULL DEFAULT 0," +
  "  unit_cost REAL NOT NULL DEFAULT 0," +
  "  subtotal REAL NOT NULL DEFAULT 0" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_pi_po ON purchase_items(purchase_order_id);" +
  "CREATE TABLE IF NOT EXISTS payments (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  user_id INTEGER NOT NULL REFERENCES users(id)," +
  "  amount REAL NOT NULL," +
  "  method TEXT NOT NULL DEFAULT 'efectivo'," +
  "  reference TEXT," +
  "  notes TEXT," +
  "  registered_by INTEGER REFERENCES users(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);" +
  "CREATE TABLE IF NOT EXISTS account_movements (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  user_id INTEGER NOT NULL REFERENCES users(id)," +
  "  type TEXT NOT NULL CHECK(type IN ('debit','credit'))," +
  "  amount REAL NOT NULL," +
  "  description TEXT," +
  "  order_id INTEGER REFERENCES orders(id)," +
  "  payment_id INTEGER REFERENCES payments(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_am_user ON account_movements(user_id);"
);
try { db.exec("ALTER TABLE orders ADD COLUMN stock_discounted INTEGER NOT NULL DEFAULT 0"); } catch (_) {}

// Migracion: Vendedor tercerizado + snapshot del costo del vendedor por item.
// - users.is_tercerizado: flag 0/1. Si vale 1, el vendedor solo ve sus clientes
//   asignados (filtrado en GET /api/clients). La denominacion "Tercerizado" solo
//   la ve el administrador; para el resto sigue siendo un vendedor mas.
// - order_items.vendedor_cost_unit: snapshot del precio "base" (price_<base_level>
//   de la lista del cliente) al momento del pedido. Permite calcular la ganancia
//   del vendedor de forma historica aunque despues cambien precios o listas.
//   NULL = el cliente no tenia lista personalizada al momento del pedido, por
//   lo que no hay ganancia diferencial para el vendedor.
try { db.exec("ALTER TABLE users ADD COLUMN is_tercerizado INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE order_items ADD COLUMN vendedor_cost_unit INTEGER"); } catch (_) {}

// Migracion: Pedido unificado del vendedor tercerizado.
// - orders.is_unified: flag 0/1. Si vale 1, este pedido es el "consolidado"
//   que el vendedor tercerizado le envio al admin agrupando varios pedidos
//   de sus clientes en uno solo. No cuenta para ganancias (sino se contaria
//   dos veces) y no participa de la UI normal de pedidos del cliente.
// - orders.unified_parent_id: para los pedidos individuales que fueron
//   absorbidos por un unificado, apunta a su pedido padre. Sirve para
//   evitar doble descuento de stock cuando se entreguen las dos puntas.
try { db.exec("ALTER TABLE orders ADD COLUMN is_unified INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE orders ADD COLUMN unified_parent_id INTEGER REFERENCES orders(id)"); } catch (_) {}

function getSetting(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (row && row.value != null) return row.value;
  return fallback === undefined ? null : fallback;
}
function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).run(key, value == null ? null : String(value));
}

// Bootstrap: si nunca hubo config de WhatsApp en la base pero hay env, migrar.
if (getSetting("whatsapp_number") == null && WHATSAPP_NUMBER) {
  setSetting("whatsapp_number", WHATSAPP_NUMBER);
}

// Default: niveles que pueden ver la solapa "Cambios de precio" en el catalogo.
// Por defecto Mayorista (3) + VIP (4). Editable desde /admin -> Configuracion.
if (getSetting("price_changes_visible_levels") == null) {
  setSetting("price_changes_visible_levels", "3,4");
}

// Default: nombre de la aplicacion. Editable desde /admin -> Configuracion.
if (getSetting("app_name") == null) {
  setSetting("app_name", "Maxaria");
}

// Devuelve el nombre de la app configurado (nunca null).
function getAppName() {
  return getSetting("app_name", "Maxaria") || "Maxaria";
}

// Devuelve un Set de IDs de categoria permitidos para el usuario dado.
// Si el usuario es admin/vendedor o no tiene restricciones, devuelve null (= acceso total).
function getUserAllowedCategoryIds(userId, level) {
  if (Number(level) === 99 || Number(level) === 5) return null; // admin/vendedor ve todo
  const rows = db.prepare(
    "SELECT category_id FROM user_category_access WHERE user_id = ?"
  ).all(userId);
  if (!rows.length) return null; // sin restricciones = ve todo
  return new Set(rows.map((r) => r.category_id));
}

// Parsea un valor del setting a un Set de niveles validos (1..4).
// Si recibe basura, devuelve un set vacio (= nadie ve la solapa).
function parseVisibleLevels(raw) {
  const out = new Set();
  if (!raw) return out;
  String(raw).split(/[,\s]+/).forEach((s) => {
    const n = Number(s);
    if ([1, 2, 3, 4].includes(n)) out.add(n);
  });
  return out;
}

function getPriceChangesVisibleLevels() {
  return parseVisibleLevels(getSetting("price_changes_visible_levels", "3,4"));
}

// Le indica al frontend (en /api/me) si este usuario tiene acceso a la
// solapa "Cambios de precio". El admin SIEMPRE puede ver (asi puede
// validar lo que se les muestra a los clientes).
function userCanSeePriceChanges(level) {
  if (Number(level) === 99 || Number(level) === 5) return true;
  return getPriceChangesVisibleLevels().has(Number(level));
}

// Mapea el nivel a las columnas old_X / new_X de la tabla price_changes.
// Devuelve las columnas (old/new) de price_changes para un base_level dado.
// "publico" cae a minorista porque no hay snapshot de publico en price_changes.
function priceChangeColsForBaseLevel(baseLevel) {
  switch (String(baseLevel || "").toLowerCase()) {
    case "revendedor": return { old: "old_revendedor", new: "new_revendedor" };
    case "mayorista":  return { old: "old_mayorista",  new: "new_mayorista"  };
    case "vip":        return { old: "old_vip",        new: "new_vip"        };
    case "minorista":
    case "publico":
    default:           return { old: "old_minorista",  new: "new_minorista"  };
  }
}

function priceChangeCols(level) {
  switch (Number(level)) {
    case 1: return { old: "old_minorista",  new: "new_minorista"  };
    case 2: return { old: "old_revendedor", new: "new_revendedor" };
    case 3: return { old: "old_mayorista",  new: "new_mayorista"  };
    case 4: return { old: "old_vip",        new: "new_vip"        };
    // Admin: por defecto le mostramos VIP (suele ser el que mas mira). El
    // ?as_level en el endpoint le permite cambiar la perspectiva.
    case 99: return { old: "old_vip", new: "new_vip" };
    default: return { old: "old_minorista", new: "new_minorista" };
  }
}

class SqliteStore extends session.Store {
  constructor(database) {
    super();
    this.db = database;
    this.getStmt = this.db.prepare("SELECT data, expires FROM sessions WHERE sid = ?");
    this.setStmt = this.db.prepare(
      "INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?) " +
      "ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires = excluded.expires"
    );
    this.delStmt = this.db.prepare("DELETE FROM sessions WHERE sid = ?");
    this.cleanStmt = this.db.prepare("DELETE FROM sessions WHERE expires < ?");
    setInterval(() => this.cleanStmt.run(Date.now()), 60 * 60 * 1000).unref();
  }
  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) return cb(null, null);
      if (row.expires < Date.now()) { this.delStmt.run(sid); return cb(null, null); }
      cb(null, JSON.parse(row.data));
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const expires = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000;
      this.setStmt.run(sid, JSON.stringify(sess), expires);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) {
    try { this.delStmt.run(sid); cb && cb(null); } catch (e) { cb && cb(e); }
  }
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  store: new SqliteStore(db),
  secret: SESSION_SECRET,
  name: "maxaria.sid",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

function priceColumnFor(level) {
  switch (Number(level)) {
    case 1: return "price_minorista";
    case 2: return "price_revendedor";
    case 3: return "price_mayorista";
    case 4: return "price_vip";
    case 99: return "price_minorista";
    default: return "price_minorista";
  }
}

// Nombres validos de columnas de precio base usadas por las listas personalizadas.
// El "publico" es opcional, suele venir vacio en el Excel, pero lo aceptamos.
const PRICE_LIST_BASE_LEVELS = ["minorista", "revendedor", "mayorista", "vip", "publico"];
function priceColumnForBaseLevel(baseLevel) {
  const b = String(baseLevel || "").trim().toLowerCase();
  if (!PRICE_LIST_BASE_LEVELS.includes(b)) return "price_minorista";
  return "price_" + b;
}

// Devuelve la "config de precios" efectiva para un cliente (level 1-4 o vendedor
// atendiendo a un cliente). El resultado define como calcular el precio de un
// producto para ese cliente:
//   - Si tiene price_list_id valido: { kind: "list", column, markup_percent, listId }
//     -> efectivo = round(products.<column> * (1 + markup_percent/100))
//   - Si no: { kind: "level", column }
//     -> efectivo = products.<column> directo
// Para nivel admin/vendedor sin contexto, devolvemos config por nivel.
function getEffectivePriceConfig(userId, level) {
  if (userId && [1, 2, 3, 4].includes(Number(level))) {
    const row = db.prepare(
      "SELECT pl.id, pl.base_level, pl.markup_percent, pl.active" +
      "  FROM users u JOIN price_lists pl ON pl.id = u.price_list_id" +
      "  WHERE u.id = ?"
    ).get(userId);
    if (row && row.active) {
      return {
        kind: "list",
        listId: row.id,
        column: priceColumnForBaseLevel(row.base_level),
        markup_percent: Number(row.markup_percent) || 0,
      };
    }
  }
  return { kind: "level", column: priceColumnFor(level) };
}

// Calcula el precio efectivo aplicando margen sobre venta (siempre entero).
// La columna se llama `markup_percent` por compatibilidad historica pero hoy
// representa la GANANCIA LIMPIA del vendedor sobre el precio final:
//   precio_venta = round(base / (1 - margen/100))
// De esa forma, precio_venta - margen% del precio_venta = base.
function computeEffectivePrice(basePrice, config) {
  const p = Number(basePrice) || 0;
  if (!config || config.kind !== "list") return p;
  const m = Number(config.markup_percent) || 0;
  const denom = 1 - m / 100;
  if (denom <= 0) return p; // proteccion: margen >= 100% no es valido
  return Math.round(p / denom);
}

// SQL expression que devuelve el precio efectivo para una columna de producto
// dada la config. Para no romper el orden de columnas en SELECTs viejos,
// devolvemos un objeto: { expr, params } para concatenar al SELECT.
// Aplica la misma formula de margen sobre venta. Si el denominador es <= 0
// (margen invalido >= 100), cae al precio base para no devolver negativos.
function priceSqlExpr(config, productAlias) {
  const a = productAlias || "p";
  if (!config) return { expr: "0", params: [] };
  if (config.kind === "list") {
    return {
      expr:
        "CASE WHEN (1 - ? / 100.0) > 0" +
        " THEN CAST(ROUND(" + a + "." + config.column + " / (1 - ? / 100.0)) AS INTEGER)" +
        " ELSE " + a + "." + config.column + " END",
      params: [Number(config.markup_percent) || 0, Number(config.markup_percent) || 0],
    };
  }
  return { expr: a + "." + config.column, params: [] };
}
function levelName(level) {
  switch (Number(level)) {
    case 1: return "Minorista";
    case 2: return "Revendedor";
    case 3: return "Mayorista";
    case 4: return "VIP";
    case 5: return "Vendedor";
    case 99: return "Administrador";
    default: return "Cliente";
  }
}
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "No autenticado" });
    return res.redirect("/login");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "No autenticado" });
    return res.redirect("/login");
  }
  if (req.session.level !== 99) {
    if (req.path.startsWith("/api/")) return res.status(403).json({ error: "Solo admin" });
    return res.status(403).send("Acceso restringido. Solo el administrador puede entrar a /admin.");
  }
  next();
}

// Vendedores (nivel 5) o admin (nivel 99) pueden acceder a estas rutas.
function requireVendedorOrAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "No autenticado" });
    return res.redirect("/login");
  }
  if (req.session.level !== 5 && req.session.level !== 99) {
    if (req.path.startsWith("/api/")) return res.status(403).json({ error: "Acceso restringido" });
    return res.redirect("/login");
  }
  next();
}

// Upload de Excel en memoria (no se escribe a disco). Limite 10MB.
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Directorio donde se guardan las imagenes de productos.
// Se guarda en el MISMO directorio que la DB (el volumen persistente en Railway/Render),
// no dentro de /public que es efimero en cada deploy.
// Ej: si DB_PATH=/data/maxaria.db -> imagenes en /data/product-images/
const PRODUCT_IMAGES_DIR = path.join(path.dirname(path.resolve(DB_PATH)), "product-images");
if (!fs.existsSync(PRODUCT_IMAGES_DIR)) fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });
console.log("Imagenes de productos en:", PRODUCT_IMAGES_DIR);

// Upload de imagen de producto en memoria. Limite 5MB. Solo imagenes.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Solo se permiten imágenes (jpg, png, webp, gif)"));
  },
});

app.get("/login", (req, res) => {
  if (req.session && req.session.userId) return res.redirect("/catalogo");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Faltan datos" });
  const user = db
    .prepare("SELECT id, username, password_hash, full_name, level, active, vendedor_price_level FROM users WHERE username = ?")
    .get(String(username).trim().toLowerCase());
  if (!user || !user.active) return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  if (!bcrypt.compareSync(String(password), user.password_hash))
    return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.level = user.level;
  req.session.fullName = user.full_name;
  // Para vendedores: guardar su lista de precios configurada
  if (user.level === 5) {
    req.session.vendedorPriceLevel = [1, 2, 3, 4].includes(Number(user.vendedor_price_level))
      ? Number(user.vendedor_price_level) : 1;
  }
  res.json({ ok: true, user: { id: user.id, username: user.username, fullName: user.full_name, level: user.level, levelName: levelName(user.level) } });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => { res.clearCookie("maxaria.sid"); res.json({ ok: true }); });
});

app.get("/", (req, res) => {
  if (req.session && req.session.userId) return res.redirect("/catalogo");
  res.redirect("/login");
});
app.get("/catalogo", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint publico (sin login) para que login.html pueda mostrar el nombre.
app.get("/api/app-info", (req, res) => {
  res.json({ app_name: getAppName() });
});

app.get("/api/me", requireLogin, (req, res) => {
  const level = req.session.level;
  const globalWa = getSetting("whatsapp_number", WHATSAPP_NUMBER || null);
  const userRow = db.prepare(
    "SELECT whatsapp_number, assigned_vendedor_id, price_list_id FROM users WHERE id = ?"
  ).get(req.session.userId);
  const userWa = userRow && userRow.whatsapp_number
    ? String(userRow.whatsapp_number).replace(/[^0-9]/g, "") : null;
  const globalWaClean = globalWa ? String(globalWa).replace(/[^0-9]/g, "") : null;

  // Reglas de destino del WhatsApp para el catalogo:
  //   - Cliente (level 1-4): si tiene vendedor asignado activo CON WA, va al WA
  //     del vendedor. Si no tiene vendedor o el vendedor no tiene WA cargado,
  //     fallback al WhatsApp global de la empresa (los precios siguen siendo los
  //     que correspondan por nivel o lista personalizada).
  //   - Vendedor (level 5): SIEMPRE el WhatsApp global de la app (los pedidos
  //     que el vendedor toma a nombre de un cliente van a la empresa, no a su
  //     numero personal).
  //   - Admin (99): WA personal o global como referencia (no envia pedidos).
  let wa = null;
  let assignedVendedor = null;
  if ([1, 2, 3, 4].includes(Number(level))) {
    if (userRow && userRow.assigned_vendedor_id) {
      const v = db.prepare(
        "SELECT id, username, full_name, whatsapp_number FROM users" +
        "  WHERE id = ? AND active = 1 AND level = 5"
      ).get(userRow.assigned_vendedor_id);
      if (v) {
        const vwa = v.whatsapp_number ? String(v.whatsapp_number).replace(/[^0-9]/g, "") : null;
        wa = vwa || null;
        // Para el frontend del catalogo NO exponemos nombre del vendedor
        // (decision: solo el admin lo ve). hasWhatsapp dice si el vendedor
        // tiene numero cargado (caso contrario el frontend muestra fallback).
        assignedVendedor = { id: v.id, hasWhatsapp: !!vwa };
      }
    }
    // Fallback: si no hay vendedor activo o el vendedor no tiene WA, el pedido
    // se manda al numero global de la empresa.
    if (!wa) wa = globalWaClean;
  } else if (Number(level) === 5) {
    wa = globalWaClean;
  } else {
    wa = userWa || globalWaClean;
  }

  const resp = {
    id: req.session.userId, username: req.session.username,
    fullName: req.session.fullName, level: level,
    levelName: levelName(level),
    whatsapp: wa || null,
    canSeePriceChanges: userCanSeePriceChanges(level),
    app_name: getAppName(),
  };
  // Solo lo enviamos para clientes (1-4) para que el frontend sepa si tiene
  // vendedor asignado y pueda mostrar/bloquear el envio.
  if ([1, 2, 3, 4].includes(Number(level))) {
    resp.assignedVendedor = assignedVendedor;
  }
  if (level === 5) {
    resp.vendedorClient = req.session.vendedorClientId
      ? { id: req.session.vendedorClientId, name: req.session.vendedorClientName,
          level: req.session.vendedorClientLevel, levelName: levelName(req.session.vendedorClientLevel) }
      : null;
    // is_tercerizado: NO se expone el nombre "tercerizado" al vendedor.
    // El flag se manda como `restrictedToAssigned` para indicar que solo ve
    // sus clientes; cualquier denominacion publica queda del lado del admin.
    const meRow = db.prepare("SELECT is_tercerizado FROM users WHERE id = ?").get(req.session.userId) || {};
    resp.restrictedToAssigned = Number(meRow.is_tercerizado) === 1;
  }
  res.json(resp);
});

// Lista de clientes (level 1-4) para que un vendedor (level 5) pueda elegir
// a quién está atendiendo. Solo accesible por vendedores.
app.get("/api/clients", requireLogin, (req, res) => {
  if (req.session.level !== 5) return res.status(403).json({ error: "Solo vendedores" });
  // Si el vendedor es tercerizado, solo ve los clientes que tiene asignados.
  // Los vendedores propios siguen viendo todos los clientes activos.
  const me = db.prepare("SELECT is_tercerizado FROM users WHERE id = ?").get(req.session.userId) || {};
  let sql =
    "SELECT id, username, full_name, level FROM users" +
    "  WHERE level IN (1,2,3,4) AND active = 1";
  const params = [];
  if (Number(me.is_tercerizado) === 1) {
    sql += " AND assigned_vendedor_id = ?";
    params.push(req.session.userId);
  }
  sql += " ORDER BY full_name, username";
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r) => ({
    id: r.id, username: r.username, full_name: r.full_name,
    level: r.level, levelName: levelName(r.level),
  })));
});

// Vendedor selecciona (o deselecciona) el cliente que está atendiendo.
// Guarda el cliente en la sesión; los endpoints de productos y categorías
// lo usan para devolver precios y restricciones del cliente.
app.post("/api/vendedor/select-client", requireLogin, (req, res) => {
  if (req.session.level !== 5) return res.status(403).json({ error: "Solo vendedores" });
  const clientId = req.body && req.body.client_id ? Number(req.body.client_id) : null;
  if (clientId) {
    const client = db.prepare(
      "SELECT id, username, full_name, level, assigned_vendedor_id FROM users" +
      " WHERE id = ? AND active = 1 AND level IN (1,2,3,4)"
    ).get(clientId);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });
    // Si el vendedor es tercerizado, solo puede atender a sus clientes asignados.
    const me = db.prepare("SELECT is_tercerizado FROM users WHERE id = ?").get(req.session.userId) || {};
    if (Number(me.is_tercerizado) === 1 && Number(client.assigned_vendedor_id) !== Number(req.session.userId)) {
      return res.status(403).json({ error: "Ese cliente no esta asignado a vos" });
    }
    req.session.vendedorClientId = client.id;
    req.session.vendedorClientName = client.full_name || client.username;
    req.session.vendedorClientLevel = client.level;
    return res.json({ ok: true, client: { id: client.id, name: client.full_name || client.username,
                                          level: client.level, levelName: levelName(client.level) } });
  }
  delete req.session.vendedorClientId;
  delete req.session.vendedorClientName;
  delete req.session.vendedorClientLevel;
  return res.json({ ok: true, client: null });
});

// Despachar (enviar al admin) un pedido unificado del vendedor tercerizado.
// El vendedor tercerizado selecciona varios pedidos de sus clientes; este
// endpoint agrupa los items por producto, crea un pedido nuevo "unificado"
// con el costo base (lo que el admin le cobra al tercerizado), marca los
// originales como "enviado" + unified_parent_id apuntando al nuevo, y
// devuelve un link wa.me al numero global de la empresa.
// El pedido unificado:
//   - tiene is_unified = 1 (excluido de ganancias para no contar doble)
//   - tiene user_id = assigned_vendedor_id = vendedor (es "suyo")
//   - lleva precios base ponderados (suma_subtotal / suma_quantity)
app.post("/api/vendedor/dispatch", requireLogin, (req, res) => {
  if (req.session.level !== 5)
    return res.status(403).json({ error: "Solo vendedores" });
  const me = db.prepare(
    "SELECT id, full_name, username, is_tercerizado FROM users WHERE id = ?"
  ).get(req.session.userId) || {};
  if (Number(me.is_tercerizado) !== 1) {
    return res.status(403).json({
      error: "Solo vendedores tercerizados pueden enviar pedidos unificados"
    });
  }

  const rawIds = (req.body && Array.isArray(req.body.order_ids)) ? req.body.order_ids : [];
  const orderIds = rawIds.map(function (n) { return Number(n); })
    .filter(function (n) { return n > 0; });
  if (!orderIds.length)
    return res.status(400).json({ error: "Tenes que seleccionar al menos un pedido" });
  // dedupe
  const uniqueIds = Array.from(new Set(orderIds));

  const placeholders = uniqueIds.map(function () { return "?"; }).join(",");

  // Validar que cada pedido pertenezca al vendedor (asignado al pedido o al cliente),
  // no sea ya un unificado y no haya sido absorbido por otro unificado.
  const candidateOrders = db.prepare(
    "SELECT o.id, o.status, o.is_unified, o.unified_parent_id, o.user_id," +
    "       u.username AS client_username, u.full_name AS client_full_name" +
    "  FROM orders o JOIN users u ON u.id = o.user_id" +
    "  WHERE o.id IN (" + placeholders + ")" +
    "    AND (o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)"
  ).all.apply(null, uniqueIds.concat([req.session.userId, req.session.userId]));

  if (candidateOrders.length !== uniqueIds.length) {
    return res.status(403).json({
      error: "Alguno de los pedidos no te pertenece o no existe"
    });
  }
  for (const o of candidateOrders) {
    if (o.is_unified)
      return res.status(400).json({ error: "El pedido #" + o.id + " ya es un pedido unificado" });
    if (o.unified_parent_id)
      return res.status(400).json({ error: "El pedido #" + o.id + " ya fue agrupado en otro envio" });
    if (o.status === "cancelado")
      return res.status(400).json({ error: "El pedido #" + o.id + " esta cancelado" });
    if (o.status === "entregado")
      return res.status(400).json({ error: "El pedido #" + o.id + " ya esta entregado" });
  }

  // Traer todos los items de los pedidos seleccionados.
  const allItems = db.prepare(
    "SELECT product_id, product_code, product_name, quantity, unit_price, vendedor_cost_unit" +
    "  FROM order_items WHERE order_id IN (" + placeholders + ")"
  ).all.apply(null, uniqueIds);

  if (!allItems.length)
    return res.status(400).json({ error: "Los pedidos seleccionados no tienen items" });

  // Agrupar por product_id. El precio base por unidad sale del snapshot
  // vendedor_cost_unit (lo que el admin le cobra al tercerizado por ese item
  // segun la lista personalizada del cliente al momento del pedido).
  // Si el item no tiene snapshot (cliente sin lista), usamos unit_price como
  // fallback -> precio que pago el cliente. Si dos pedidos pidieron el mismo
  // producto con precios base distintos, hacemos promedio ponderado.
  const grouped = new Map();
  for (const it of allItems) {
    const key = it.product_id || ("code:" + it.product_code);
    const cost = (it.vendedor_cost_unit != null) ? Number(it.vendedor_cost_unit) : Number(it.unit_price);
    const qty = Number(it.quantity) || 0;
    const g = grouped.get(key);
    if (g) {
      g.quantity += qty;
      g.subtotal_base += cost * qty;
    } else {
      grouped.set(key, {
        product_id: it.product_id,
        product_code: it.product_code,
        product_name: it.product_name,
        quantity: qty,
        subtotal_base: cost * qty,
      });
    }
  }

  const lines = [];
  let total = 0;
  for (const g of grouped.values()) {
    const unit = g.quantity > 0 ? Math.round(g.subtotal_base / g.quantity) : 0;
    const subtotal = unit * g.quantity;
    total += subtotal;
    lines.push({
      product_id: g.product_id,
      product_code: g.product_code,
      product_name: g.product_name,
      quantity: g.quantity,
      unit_price: unit,
      subtotal: subtotal,
    });
  }

  // Crear el pedido unificado y marcar los originales.
  let unifiedId;
  db.transaction(function () {
    const notesStr = "Unificado de " + uniqueIds.length + " pedido(s): #" + uniqueIds.join(", #");
    const r = db.prepare(
      "INSERT INTO orders (user_id, status, total, notes, assigned_vendedor_id, is_unified, created_at)" +
      " VALUES (?, 'pendiente', ?, ?, ?, 1, datetime('now'))"
    ).run(req.session.userId, total, notesStr, req.session.userId);
    unifiedId = r.lastInsertRowid;
    const insertItem = db.prepare(
      "INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, subtotal, vendedor_cost_unit)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, NULL)"
    );
    for (const l of lines) {
      insertItem.run(unifiedId, l.product_id, l.product_code, l.product_name,
                     l.quantity, l.unit_price, l.subtotal);
    }
    const updOrig = db.prepare(
      "UPDATE orders SET status = 'enviado', unified_parent_id = ? WHERE id = ?"
    );
    for (const oid of uniqueIds) updOrig.run(unifiedId, oid);
  })();

  // Armar el mensaje y link de WhatsApp al numero global de la empresa.
  const globalWaRaw = getSetting("whatsapp_number", WHATSAPP_NUMBER || "");
  const globalWa = String(globalWaRaw || "").replace(/[^0-9]/g, "");
  let whatsappLink = null;
  let whatsappMessage = null;
  if (globalWa) {
    const fmt = function (n) {
      return "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
    };
    const meName = me.full_name || me.username || "vendedor";
    const headerLines = [
      "*Pedido unificado #" + unifiedId + " - " + meName + "*",
      "Agrupa " + uniqueIds.length + " pedido(s): #" + uniqueIds.join(", #"),
      "",
    ];
    const bodyLines = lines.map(function (l) {
      return "- " + l.quantity + " x " + l.product_name +
        " (" + (l.product_code || "") + ")" +
        " @ " + fmt(l.unit_price) + " = " + fmt(l.subtotal);
    });
    const footerLines = ["", "Total: " + fmt(total)];
    whatsappMessage = headerLines.concat(bodyLines, footerLines).join("\n");
    whatsappLink = "https://wa.me/" + globalWa + "?text=" + encodeURIComponent(whatsappMessage);
  }

  res.json({
    ok: true,
    unified_order_id: unifiedId,
    total: total,
    items_count: lines.length,
    grouped_order_ids: uniqueIds,
    whatsapp_link: whatsappLink,
    whatsapp_message: whatsappMessage,
  });
});

// Ganancias del vendedor (solo level 5).
// Devuelve los pedidos visibles para el vendedor con su ganancia calculada como
// SUM(unit_price - vendedor_cost_unit) * quantity sobre los items que tienen
// snapshot de costo. Items sin snapshot (clientes sin lista personalizada) no
// generan ganancia diferencial -> aportan 0.
// Resumen totales + detalle por pedido.
// Excluye pedidos cancelados.
app.get("/api/vendedor/earnings", requireLogin, (req, res) => {
  if (req.session.level !== 5) return res.status(403).json({ error: "Solo vendedores" });
  const me = req.session.userId;
  // Pedidos visibles: assigned al vendedor O del cliente que lo tiene asignado.
  // Excluimos cancelados.
  const orders = db.prepare(
    "SELECT o.id, o.status, o.total, o.created_at," +
    "       o.user_id, u.username AS client_username, u.full_name AS client_full_name," +
    "       u.level AS client_level," +
    "       COALESCE(SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
    "                         THEN oi.vendedor_cost_unit * oi.quantity ELSE 0 END), 0) AS cost_total," +
    "       COALESCE(SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
    "                         THEN (oi.unit_price - oi.vendedor_cost_unit) * oi.quantity ELSE 0 END), 0) AS earning_total" +
    "  FROM orders o" +
    "  JOIN users u ON u.id = o.user_id" +
    "  LEFT JOIN order_items oi ON oi.order_id = o.id" +
    "  WHERE o.status != 'cancelado' AND COALESCE(o.is_unified,0) = 0" +
    "    AND (o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)" +
    "  GROUP BY o.id" +
    "  ORDER BY o.created_at DESC"
  ).all(me, me);

  let totalOrders = orders.length;
  let totalDelivered = 0;
  let totalSold = 0;
  let totalCost = 0;
  let totalEarning = 0;
  for (const o of orders) {
    totalSold += Number(o.total) || 0;
    totalCost += Number(o.cost_total) || 0;
    totalEarning += Number(o.earning_total) || 0;
    if (o.status === "entregado") totalDelivered++;
  }
  res.json({
    summary: {
      total_orders: totalOrders,
      total_delivered: totalDelivered,
      total_sold: totalSold,
      total_cost: totalCost,
      total_earning: totalEarning,
    },
    orders: orders,
  });
});

// Detalle de items con ganancia para un pedido (vendedor o admin).
// El vendedor solo puede ver pedidos que le pertenecen.
app.get("/api/vendedor/earnings/:orderId", requireLogin, (req, res) => {
  const level = req.session.level;
  if (level !== 5 && level !== 99) return res.status(403).json({ error: "No autorizado" });
  const orderId = Number(req.params.orderId);
  if (!orderId) return res.status(400).json({ error: "ID invalido" });
  const order = db.prepare(
    "SELECT o.id, o.status, o.total, o.created_at, o.assigned_vendedor_id," +
    "       o.user_id, u.username AS client_username, u.full_name AS client_full_name," +
    "       u.assigned_vendedor_id AS client_vendedor_id, u.level AS client_level" +
    "  FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?"
  ).get(orderId);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  if (level === 5 &&
      Number(order.assigned_vendedor_id) !== Number(req.session.userId) &&
      Number(order.client_vendedor_id) !== Number(req.session.userId)) {
    return res.status(403).json({ error: "No autorizado" });
  }
  const items = db.prepare(
    "SELECT id, product_code, product_name, quantity, unit_price, subtotal," +
    "       vendedor_cost_unit," +
    "       CASE WHEN vendedor_cost_unit IS NOT NULL" +
    "            THEN (unit_price - vendedor_cost_unit) * quantity ELSE 0 END AS earning" +
    "  FROM order_items WHERE order_id = ? ORDER BY id"
  ).all(orderId);
  res.json({ order: order, items: items });
});

// Historial de cambios: ultimas 10 actualizaciones (Excel subidos).
// Cada actualizacion incluye:
//   - cambios de precio (subas/bajas) de productos con stock
//   - productos nuevos (is_new = 1)
//   - reingresos (is_reingreso = 1): productos que volvieron de stock 0
// Visible solo para los niveles configurados + admin.
app.get("/api/price-changes", requireLogin, (req, res) => {
  const level = req.session.level;
  if (!userCanSeePriceChanges(level)) {
    return res.status(403).json({ error: "No tenés acceso a esta sección" });
  }

  // Resolver el "cliente target": para vendedor con cliente seleccionado,
  // es el cliente atendido. Para cliente puro (1-4) es el propio usuario.
  // Admin sin as_level: el propio admin (no aplica lista personalizada).
  let targetUserId = req.session.userId;
  let targetLevel = level;
  if (level === 5 && req.session.vendedorClientId) {
    targetUserId = req.session.vendedorClientId;
    targetLevel = Number(req.session.vendedorClientLevel) || 1;
  }

  // Admin puede mirar como otro nivel (igual que /api/products).
  // Vendedor (nivel 5): si tiene cliente seleccionado, ve los cambios
  // segun el nivel del cliente; si no, segun su vendedor_price_level.
  let effectiveLevel = level;
  if (level === 99 && req.query.as_level != null) {
    const asLvl = Number(req.query.as_level);
    if ([1, 2, 3, 4].includes(asLvl)) effectiveLevel = asLvl;
  } else if (level === 5) {
    if (req.session.vendedorClientId && [1, 2, 3, 4].includes(Number(req.session.vendedorClientLevel))) {
      effectiveLevel = Number(req.session.vendedorClientLevel);
    } else {
      const vpl = Number(req.session.vendedorPriceLevel);
      effectiveLevel = [1, 2, 3, 4].includes(vpl) ? vpl : 1;
    }
  }

  const updates = db.prepare(
    "SELECT id, created_at, source, rows_total, products_changed, products_new," +
    "       COALESCE(products_reingreso, 0) AS products_reingreso" +
    "  FROM price_updates ORDER BY id DESC LIMIT 10"
  ).all();

  // Resolver lista personalizada del target (cliente).
  // Si tiene price_list_id, usamos sus columnas base y aplicamos la ganancia.
  // El admin se queda con priceChangeCols(effectiveLevel) tradicional (sin lista).
  const useListConfig = level !== 99;
  const cfg = useListConfig ? getEffectivePriceConfig(targetUserId, effectiveLevel) : { kind: "level" };
  let cols;
  let listInfo = null; // { id, name, base_level, markup_percent } cuando aplica
  let markup = 0;
  if (cfg.kind === "list") {
    const baseLevel = String(cfg.column || "").replace(/^price_/, "");
    cols = priceChangeColsForBaseLevel(baseLevel);
    markup = Number(cfg.markup_percent) || 0;
    const lrow = db.prepare(
      "SELECT id, name, base_level, markup_percent FROM price_lists WHERE id = ?"
    ).get(cfg.listId);
    if (lrow) listInfo = lrow;
  } else {
    cols = priceChangeCols(effectiveLevel);
  }
  // Si en algun momento el margen es invalido (>=100), caemos al precio base
  // para no devolver negativos. Reportamos eso al cliente como markup=0.
  const applyMarkup = (v) => {
    if (v == null) return null;
    if (markup === 0) return Math.round(Number(v) || 0);
    const denom = 1 - markup / 100;
    if (denom <= 0) return Math.round(Number(v) || 0);
    return Math.round((Number(v) || 0) / denom);
  };

  if (!updates.length) {
    return res.json({
      updates: [], level: effectiveLevel,
      levelName: listInfo ? listInfo.name : levelName(effectiveLevel),
      listName: listInfo ? listInfo.name : null,
    });
  }

  // Categorías permitidas para este usuario (null = ve todas)
  const allowedCats = getUserAllowedCategoryIds(req.session.userId, level);
  const rowsStmt = db.prepare(
    "SELECT pc.product_id, pc.code, pc.name, pc.is_new," +
    "       COALESCE(pc.is_reingreso, 0) AS is_reingreso," +
    "       pc." + cols.old + " AS old_price," +
    "       pc." + cols.new + " AS new_price," +
    "       p.image_url, p.stock, p.active," +
    "       p.category_id," +
    "       COALESCE(c.name, '') AS category_name" +
    "  FROM price_changes pc" +
    "  LEFT JOIN products p ON p.id = pc.product_id" +
    "  LEFT JOIN categories c ON c.id = p.category_id" +
    "  WHERE pc.update_id = ?" +
    "  ORDER BY pc.is_new DESC, pc.name"
  );

  const result = [];
  for (const u of updates) {
    let rows = rowsStmt.all(u.id);
    // Filtrar por categorías permitidas si el usuario tiene restricción
    if (allowedCats !== null) {
      rows = rows.filter((r) => r.category_id != null && allowedCats.has(r.category_id));
    }
    const cambios = [];
    const nuevos = [];
    const reingresos = [];

    for (const r of rows) {
      // Productos inactivos no se muestran en ninguna seccion
      if (!r.active) continue;

      // Aplicamos la formula de ganancia limpia si el cliente tiene lista
      // personalizada. Si no, applyMarkup es identidad (markup=0).
      const newP = applyMarkup(r.new_price) || 0;
      const oldP = r.old_price == null ? null : applyMarkup(r.old_price);

      // Reingresos: vuelven de stock 0 — se muestran igual aunque ahora tengan stock
      if (r.is_reingreso) {
        reingresos.push({
          product_id: r.product_id, code: r.code, name: r.name,
          category_name: r.category_name || "",
          image_url: r.image_url || null, new_price: newP,
        });
        continue;
      }

      if (r.is_new) {
        nuevos.push({
          product_id: r.product_id, code: r.code, name: r.name,
          category_name: r.category_name || "",
          image_url: r.image_url || null, new_price: newP,
        });
        continue;
      }

      // Cambios de precio: solo mostramos si el producto tiene stock ahora
      if (r.stock != null && r.stock <= 0) continue;
      if (oldP == null || oldP === newP) continue;
      const delta = newP - oldP;
      const pct = oldP > 0 ? (delta / oldP) * 100 : null;
      cambios.push({
        product_id: r.product_id, code: r.code, name: r.name,
        category_name: r.category_name || "",
        image_url: r.image_url || null,
        old_price: oldP, new_price: newP,
        delta: delta,
        delta_pct: pct == null ? null : Math.round(pct * 10) / 10,
      });
    }

    // Ordenar todo por categoría y luego alfabéticamente por nombre
    const byCatThenName = (a, b) => {
      const catCmp = (a.category_name || "").localeCompare(b.category_name || "", "es");
      if (catCmp !== 0) return catCmp;
      return (a.name || "").localeCompare(b.name || "", "es");
    };
    cambios.sort(byCatThenName);
    nuevos.sort(byCatThenName);
    reingresos.sort(byCatThenName);

    // Solo incluimos el update si tiene algo para mostrar
    if (cambios.length || nuevos.length || reingresos.length) {
      result.push({ update: u, cambios, nuevos, reingresos });
    }
  }

  res.json({
    updates: result,
    level: effectiveLevel,
    levelName: listInfo ? listInfo.name : levelName(effectiveLevel),
    listName: listInfo ? listInfo.name : null,
  });
});

app.get("/api/categories", requireLogin, (req, res) => {
  // Vendedor con cliente seleccionado: usar restricciones del cliente.
  // Vendedor sin cliente (o cualquier otro rol): comportamiento estándar.
  let userId = req.session.userId;
  let userLevel = req.session.level;
  if (userLevel === 5 && req.session.vendedorClientId) {
    userId = req.session.vendedorClientId;
    userLevel = req.session.vendedorClientLevel;
  }
  const allowedIds = getUserAllowedCategoryIds(userId, userLevel);
  let rows = db.prepare("SELECT id, name, icon_url FROM categories ORDER BY sort_order, name").all();
  if (allowedIds !== null) {
    rows = rows.filter((c) => allowedIds.has(c.id));
  }
  res.json(rows);
});

app.get("/api/products", requireLogin, (req, res) => {
  // Vendedor sin cliente seleccionado: muestra el catálogo sin precios (noPrice=true).
  // Vendedor con cliente: usa nivel + lista de precios del cliente.
  // Admin: puede ver "como otro nivel" via ?as_level (no aplica lista personalizada).
  // Resto de usuarios (clientes 1-4): si tienen price_list_id, ven esa lista
  //   con el % de markup aplicado; si no, ven los precios de su nivel.
  let effectiveLevel = req.session.level;
  let effectiveUserId = req.session.userId;
  let noPrice = false;

  if (req.session.level === 5) {
    if (req.session.vendedorClientId) {
      effectiveLevel = req.session.vendedorClientLevel;
      effectiveUserId = req.session.vendedorClientId;
    } else {
      noPrice = true; // level 5 sin cliente: sin precios, sin restricciones de categoría
    }
  } else if (req.session.level === 99 && req.query.as_level != null) {
    const asLvl = Number(req.query.as_level);
    if ([1, 2, 3, 4].includes(asLvl)) {
      effectiveLevel = asLvl;
      effectiveUserId = null; // admin "viendo como N": ignorar lista personalizada
    }
  }

  // Resolver config de precios (lista personalizada o nivel base)
  const cfg = getEffectivePriceConfig(effectiveUserId, effectiveLevel);
  let priceExpr = "NULL";
  const priceParams = [];
  if (!noPrice) {
    const e = priceSqlExpr(cfg, "p");
    priceExpr = e.expr;
    priceParams.push(...e.params);
  }
  // getUserAllowedCategoryIds devuelve null (sin restricción) para level 5 sin cliente
  const allowedIds = getUserAllowedCategoryIds(effectiveUserId, effectiveLevel);

  let sql =
    "SELECT p.id, p.code, p.category_id, c.name AS category_name," +
    "       p.name, p.image_url, " + priceExpr + " AS price, p.stock" +
    "  FROM products p LEFT JOIN categories c ON c.id = p.category_id" +
    "  WHERE p.active = 1 AND p.stock > 0";
  const params = [...priceParams];
  if (allowedIds !== null && allowedIds.size > 0) {
    const placeholders = Array.from(allowedIds).map(() => "?").join(",");
    sql += " AND p.category_id IN (" + placeholders + ")";
    params.push(...Array.from(allowedIds));
  } else if (allowedIds !== null && allowedIds.size === 0) {
    return res.json([]);
  }
  sql += "  ORDER BY c.sort_order, c.name, p.name";
  res.json(db.prepare(sql).all(...params));
});

// ----- Pedidos -----
app.post("/api/orders", requireLogin, (req, res) => {
  const isVendedor = req.session.level === 5;
  const isAdmin = req.session.level === 99;
  // Vendedor debe tener un cliente seleccionado para poder hacer pedidos
  if (isVendedor && !req.session.vendedorClientId) {
    return res.status(400).json({ error: "Seleccioná un cliente antes de hacer un pedido" });
  }

  const { items, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "Carrito vacio" });

  // Si es vendedor: el pedido se registra bajo el cliente, con el vendedor asignado.
  // Si es cliente (level 1-4): el pedido se registra a su nombre, con el
  // vendedor asignado del cliente (campo users.assigned_vendedor_id) si existe.
  // Si el cliente no tiene vendedor activo, se acepta igual el pedido y queda
  // sin asignar; el frontend manda el WhatsApp al numero global de la empresa.
  const priceLevel = isVendedor ? req.session.vendedorClientLevel : req.session.level;
  const orderUserId = isVendedor ? req.session.vendedorClientId : req.session.userId;
  let assignedVendedorId = isVendedor ? req.session.userId : null;

  // Para clientes (no vendedor / no admin): si tienen vendedor activo, lo
  // dejamos en orders.assigned_vendedor_id para trazabilidad. Si no, NULL.
  if (!isVendedor && !isAdmin && [1, 2, 3, 4].includes(Number(req.session.level))) {
    const cliRow = db.prepare(
      "SELECT u.assigned_vendedor_id, v.id AS v_id, v.active AS v_active, v.level AS v_level" +
      "  FROM users u LEFT JOIN users v ON v.id = u.assigned_vendedor_id" +
      "  WHERE u.id = ?"
    ).get(req.session.userId);
    if (cliRow && cliRow.assigned_vendedor_id && cliRow.v_id &&
        cliRow.v_active && cliRow.v_level === 5) {
      assignedVendedorId = cliRow.assigned_vendedor_id;
    }
  }

  // Calcular precios usando la config efectiva (lista personalizada o nivel base).
  // Si el cliente tiene lista personalizada, tambien guardamos el precio base
  // (precio_<base_level>) como snapshot del "costo" del vendedor para ese item.
  const cfg = getEffectivePriceConfig(orderUserId, priceLevel);
  const getProd = db.prepare(
    "SELECT id, code, name, " + cfg.column + " AS base_price, stock" +
    "  FROM products WHERE id = ? AND active = 1"
  );

  const lines = [];
  let total = 0;
  for (const it of items) {
    const id = Number(it.id);
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0));
    if (!id || !qty) continue;
    const p = getProd.get(id);
    if (!p || p.stock <= 0) continue;
    const unitPrice = computeEffectivePrice(p.base_price, cfg);
    const subtotal = unitPrice * qty;
    // Si el cliente tenia lista personalizada, base_price es el "costo" del vendedor.
    // Si no, el costo es el mismo precio que el de venta -> guardamos NULL.
    const costUnit = cfg.kind === "list" ? Math.round(Number(p.base_price) || 0) : null;
    total += subtotal;
    lines.push({
      product_id: p.id, product_code: p.code, product_name: p.name,
      quantity: qty, unit_price: unitPrice, subtotal: subtotal,
      vendedor_cost_unit: costUnit,
    });
  }
  if (!lines.length)
    return res.status(400).json({ error: "Ninguno de los productos del carrito esta disponible" });

  const insertOrder = db.prepare(
    "INSERT INTO orders (user_id, status, total, notes, whatsapp_sent_at, assigned_vendedor_id, created_at)" +
    " VALUES (?, 'enviado', ?, ?, datetime('now'), ?, datetime('now'))"
  );
  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, subtotal, vendedor_cost_unit)" +
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  let orderId;
  db.transaction(() => {
    const r = insertOrder.run(orderUserId, total, (notes || "").slice(0, 500) || null, assignedVendedorId);
    orderId = r.lastInsertRowid;
    for (const l of lines) {
      insertItem.run(orderId, l.product_id, l.product_code, l.product_name,
                     l.quantity, l.unit_price, l.subtotal, l.vendedor_cost_unit);
    }
  })();

  res.json({ ok: true, order: { id: orderId, total: total, items: lines.length } });
});

app.get("/api/orders", requireLogin, (req, res) => {
  const isAdmin = req.session.level === 99;
  const isVendedor = req.session.level === 5;

  if (isAdmin) {
    const rows = db.prepare(
      "SELECT o.id, o.status, o.total, o.notes, o.created_at, o.whatsapp_sent_at," +
      "       u.username, u.full_name," +
      "       o.assigned_vendedor_id," +
      "       v.username AS vendedor_username, v.full_name AS vendedor_full_name," +
      "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at" +
      "  FROM orders o" +
      "  JOIN users u ON u.id = o.user_id" +
      "  LEFT JOIN users v ON v.id = o.assigned_vendedor_id" +
      "  LEFT JOIN deliveries d ON d.order_id = o.id" +
      "  ORDER BY o.created_at DESC LIMIT 200"
    ).all();
    return res.json(rows);
  }

  if (isVendedor) {
    // Vendedor ve:
    //  - Sus pedidos asignados (orders.assigned_vendedor_id = vendedor)
    //  - Pedidos de SUS clientes asignados (users.assigned_vendedor_id = vendedor),
    //    aunque el pedido no tenga vendedor en orders.assigned_vendedor_id.
    const rows = db.prepare(
      "SELECT o.id, o.status, o.total, o.notes, o.created_at, o.whatsapp_sent_at," +
      "       u.username, u.full_name," +
      "       o.assigned_vendedor_id, NULL AS vendedor_username, NULL AS vendedor_full_name," +
      "       o.is_unified, o.unified_parent_id," +
      "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at" +
      "  FROM orders o" +
      "  JOIN users u ON u.id = o.user_id" +
      "  LEFT JOIN deliveries d ON d.order_id = o.id" +
      "  WHERE o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?" +
      "  ORDER BY o.created_at DESC LIMIT 200"
    ).all(req.session.userId, req.session.userId);
    return res.json(rows);
  }

  // Usuario normal: solo sus propios pedidos
  const rows = db.prepare(
    "SELECT o.id, o.status, o.total, o.notes, o.created_at, o.whatsapp_sent_at," +
    "       NULL AS username, NULL AS full_name," +
    "       NULL AS assigned_vendedor_id, NULL AS delivery_id" +
    "  FROM orders o WHERE o.user_id = ?" +
    "  ORDER BY o.created_at DESC LIMIT 200"
  ).all(req.session.userId);
  res.json(rows);
});

app.get("/api/orders/:id", requireLogin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const isAdmin = req.session.level === 99;
  const isVendedor = req.session.level === 5;
  let order;
  if (isAdmin) {
    order = db.prepare(
      "SELECT o.*, u.username, u.full_name," +
      "       v.username AS vendedor_username, v.full_name AS vendedor_full_name," +
      "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at" +
      "  FROM orders o JOIN users u ON u.id = o.user_id" +
      "  LEFT JOIN users v ON v.id = o.assigned_vendedor_id" +
      "  LEFT JOIN deliveries d ON d.order_id = o.id" +
      "  WHERE o.id = ?"
    ).get(id);
  } else if (isVendedor) {
    // Vendedor ve detalle si el pedido es suyo o de uno de sus clientes
    order = db.prepare(
      "SELECT o.*, u.username, u.full_name," +
      "       NULL AS vendedor_username, NULL AS vendedor_full_name," +
      "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at" +
      "  FROM orders o JOIN users u ON u.id = o.user_id" +
      "  LEFT JOIN deliveries d ON d.order_id = o.id" +
      "  WHERE o.id = ? AND (o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)"
    ).get(id, req.session.userId, req.session.userId);
  } else {
    order = db.prepare(
      "SELECT o.*, NULL AS username, NULL AS full_name FROM orders o WHERE o.id = ? AND o.user_id = ?"
    ).get(id, req.session.userId);
  }
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  const items = db.prepare(
    "SELECT id, product_id, product_code, product_name, quantity, unit_price, subtotal" +
    "  FROM order_items WHERE order_id = ? ORDER BY id"
  ).all(id);
  res.json(Object.assign({}, order, { items: items }));
});

// ----- Cambio de estado (admin o vendedor asignado) -----
app.patch("/api/orders/:id", requireLogin, (req, res) => {
  const isAdmin = req.session.level === 99;
  const isVendedor = req.session.level === 5;
  if (!isAdmin && !isVendedor)
    return res.status(403).json({ error: "Solo el admin o vendedor puede cambiar estados" });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const { status } = req.body || {};
  const valid = ["pendiente", "enviado", "preparando", "entregado", "cancelado"];
  if (!valid.includes(status))
    return res.status(400).json({ error: "Estado invalido. Valores: " + valid.join(", ") });

  // Vendedores solo pueden marcar como "entregado" en su pedido asignado
  // o en pedidos de sus clientes asignados.
  if (isVendedor) {
    if (status !== "entregado")
      return res.status(403).json({ error: "Los vendedores solo pueden marcar pedidos como entregado" });
    const order = db.prepare(
      "SELECT o.id FROM orders o JOIN users u ON u.id = o.user_id" +
      "  WHERE o.id = ? AND (o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)"
    ).get(id, req.session.userId, req.session.userId);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado o no asignado a vos" });
  }

  // Leer el pedido antes de actualizar para conocer estado anterior
  const order = db.prepare(
    "SELECT id, status, stock_discounted, total, user_id, unified_parent_id, is_unified FROM orders WHERE id = ?"
  ).get(id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

  const prevStatus = order.status;
  // Los pedidos individuales que ya fueron absorbidos por un unificado NO
  // descuentan stock por su cuenta: el descuento se hace una sola vez cuando
  // el admin entrega el pedido unificado padre.
  const skipStock = order.unified_parent_id != null;

  db.transaction(() => {
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);

    // Al marcar "entregado": descontar stock y generar debito en cuenta corriente
    if (status === "entregado" && prevStatus !== "entregado" && !order.stock_discounted) {
      if (!skipStock) {
        const items = db.prepare(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
        ).all(id);
        const updStock = db.prepare(
          "UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?"
        );
        for (const it of items) {
          if (it.product_id) updStock.run(it.quantity, it.product_id);
        }
      }
      // El pedido unificado no genera debito en cuenta corriente del vendedor
      // (es solo un consolidado para el admin); los hijos individuales si lo
      // siguen generando contra la cuenta del cliente final.
      if (!order.is_unified) {
        db.prepare(
          "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
          " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
        ).run(order.user_id, order.total, "Pedido #" + id, id);
      }
      db.prepare("UPDATE orders SET stock_discounted = 1 WHERE id = ?").run(id);
    }

    // Al cancelar: devolver stock y eliminar el movimiento de debito del pedido
    if (status === "cancelado" && prevStatus !== "cancelado" && order.stock_discounted) {
      if (!skipStock) {
        const items = db.prepare(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
        ).all(id);
        const retStock = db.prepare(
          "UPDATE products SET stock = stock + ? WHERE id = ?"
        );
        for (const it of items) {
          if (it.product_id) retStock.run(it.quantity, it.product_id);
        }
      }
      db.prepare(
        "DELETE FROM account_movements WHERE order_id = ? AND type = 'debit'"
      ).run(id);
      db.prepare("UPDATE orders SET stock_discounted = 0 WHERE id = ?").run(id);
    }
  })();

  res.json({ ok: true, id: id, status: status });
});

// Editar items de un pedido (solo admin): reemplaza todos los items y recalcula el total
app.put("/api/admin/orders/:id/items", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const order = db.prepare("SELECT id, user_id FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

  const rawItems = req.body && Array.isArray(req.body.items) ? req.body.items : [];
  if (!rawItems.length) return res.status(400).json({ error: "El pedido debe tener al menos 1 item" });

  // Para recalcular el costo del vendedor (snapshot) usamos la lista actual
  // del cliente. Si no tiene lista personalizada, el costo queda NULL.
  const cliRow = db.prepare("SELECT level FROM users WHERE id = ?").get(order.user_id) || {};
  const cfg = getEffectivePriceConfig(order.user_id, cliRow.level || 1);
  const getCostPrice = cfg.kind === "list"
    ? db.prepare("SELECT " + cfg.column + " AS base_price FROM products WHERE id = ?")
    : null;

  const lines = [];
  let total = 0;
  for (const it of rawItems) {
    const productId = Number(it.product_id);
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const unitPrice = Math.round(Math.max(0, Number(it.unit_price) || 0));
    if (!productId) continue;
    const prod = db.prepare("SELECT id, code, name FROM products WHERE id = ?").get(productId);
    if (!prod) continue;
    const productName = String(it.product_name || prod.name || "").trim().slice(0, 200);
    const productCode = String(it.product_code || prod.code || "").trim().slice(0, 50);
    const subtotal = unitPrice * qty;
    let costUnit = null;
    if (getCostPrice) {
      const cp = getCostPrice.get(productId);
      costUnit = cp ? Math.round(Number(cp.base_price) || 0) : null;
    }
    total += subtotal;
    lines.push({ product_id: productId, product_code: productCode, product_name: productName,
                 quantity: qty, unit_price: unitPrice, subtotal, vendedor_cost_unit: costUnit });
  }
  if (!lines.length) return res.status(400).json({ error: "Ningún item válido" });

  db.transaction(() => {
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);
    const ins = db.prepare(
      "INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, subtotal, vendedor_cost_unit)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const l of lines) {
      ins.run(id, l.product_id, l.product_code, l.product_name, l.quantity, l.unit_price, l.subtotal, l.vendedor_cost_unit);
    }
    db.prepare("UPDATE orders SET total = ? WHERE id = ?").run(total, id);
  })();

  const updatedItems = db.prepare(
    "SELECT id, product_id, product_code, product_name, quantity, unit_price, subtotal, vendedor_cost_unit" +
    "  FROM order_items WHERE order_id = ? ORDER BY id"
  ).all(id);
  res.json({ ok: true, total, items: updatedItems });
});

// ===== Panel admin =====
// Admin (99) accede completo; Vendedor (5) accede con funciones limitadas (solo Pedidos asignados).
app.get("/admin", requireVendedorOrAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Lista completa de productos (admin ve TODOS, incluso sin stock o inactivos)
app.get("/api/admin/products", requireAdmin, (req, res) => {
  const sql =
    "SELECT p.id, p.code, p.category_id, c.name AS category_name, p.name," +
    "       p.cost, p.price_minorista, p.price_revendedor, p.price_mayorista," +
    "       p.price_vip, p.price_publico, p.stock, p.active, p.image_url" +
    "  FROM products p LEFT JOIN categories c ON c.id = p.category_id" +
    "  ORDER BY c.sort_order, c.name, p.name";
  res.json(db.prepare(sql).all());
});

// Editar campos puntuales de un producto
app.patch("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const allowed = [
    "name", "cost", "price_minorista", "price_revendedor",
    "price_mayorista", "price_vip", "price_publico", "stock", "active", "image_url",
  ];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in (req.body || {})) {
      sets.push(k + " = ?");
      // Numericos: parsear; texto: trim. active: 0/1.
      let v = req.body[k];
      if (k === "name") v = String(v || "").trim().slice(0, 200);
      else if (k === "image_url") v = String(v || "").trim().slice(0, 500) || null;
      else if (k === "active") v = v ? 1 : 0;
      else { v = Number(v); if (!isFinite(v)) v = 0; v = Math.round(v); }
      vals.push(v);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "Nada para actualizar" });
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  const r = db.prepare("UPDATE products SET " + sets.join(", ") + " WHERE id = ?").run(...vals);
  if (!r.changes) return res.status(404).json({ error: "Producto no encontrado" });
  res.json({ ok: true, id: id });
});

// Subir imagen de un producto. Guarda en public/images/products/product-{id}.{ext}
// y actualiza image_url en la base.
app.post("/api/admin/products/:id/image", requireAdmin, imageUpload.single("image"), (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const prod = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!prod) return res.status(404).json({ error: "Producto no encontrado" });
  if (!req.file) return res.status(400).json({ error: "No se recibió imagen" });

  const origExt = path.extname(req.file.originalname || "").toLowerCase();
  const validExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const safeExt = validExts.includes(origExt) ? origExt : ".jpg";

  const filename = "product-" + id + safeExt;
  const filePath = path.join(PRODUCT_IMAGES_DIR, filename);

  // Eliminar imágenes locales anteriores del mismo producto (distinta extension)
  try {
    fs.readdirSync(PRODUCT_IMAGES_DIR).forEach((f) => {
      if (f.startsWith("product-" + id + ".") && f !== filename) {
        fs.unlinkSync(path.join(PRODUCT_IMAGES_DIR, f));
      }
    });
  } catch (_) {}

  fs.writeFileSync(filePath, req.file.buffer);
  const imageUrl = "/images/products/" + filename + "?v=" + Date.now();
  db.prepare("UPDATE products SET image_url = ?, updated_at = datetime('now') WHERE id = ?").run(imageUrl, id);
  res.json({ ok: true, image_url: imageUrl });
});

// Settings runtime: app_name + whatsapp_number + price_changes_visible_levels
app.get("/api/admin/settings", requireAdmin, (req, res) => {
  res.json({
    app_name: getAppName(),
    whatsapp_number: getSetting("whatsapp_number", WHATSAPP_NUMBER || ""),
    price_changes_visible_levels: Array.from(getPriceChangesVisibleLevels()).sort(),
  });
});

app.patch("/api/admin/settings", requireAdmin, (req, res) => {
  const body = req.body || {};
  if ("app_name" in body) {
    const name = String(body.app_name || "").trim().slice(0, 60);
    setSetting("app_name", name || "Maxaria");
  }
  if ("whatsapp_number" in body) {
    const raw = String(body.whatsapp_number || "").replace(/[^0-9]/g, "");
    if (raw && (raw.length < 8 || raw.length > 15)) {
      return res.status(400).json({ error: "Numero invalido (8 a 15 digitos)" });
    }
    setSetting("whatsapp_number", raw);
  }
  if ("price_changes_visible_levels" in body) {
    // Aceptamos tanto array [3,4] como string "3,4". Filtramos a valores validos.
    const raw = body.price_changes_visible_levels;
    const arr = Array.isArray(raw) ? raw : String(raw || "").split(/[,\s]+/);
    const valid = Array.from(new Set(arr.map(Number).filter((n) => [1, 2, 3, 4].includes(n)))).sort();
    setSetting("price_changes_visible_levels", valid.join(","));
  }
  res.json({
    ok: true,
    app_name: getAppName(),
    whatsapp_number: getSetting("whatsapp_number", ""),
    price_changes_visible_levels: Array.from(getPriceChangesVisibleLevels()).sort(),
  });
});

// ===== Usuarios =====
const VALID_LEVELS = [1, 2, 3, 4, 5, 99];

function isValidUsername(s) {
  return typeof s === "string" && /^[a-z0-9_.-]{3,32}$/i.test(s);
}

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT id, username, full_name, phone, whatsapp_number, email, plain_password," +
    "       level, active, created_at, last_login_at," +
    "       assigned_vendedor_id, price_list_id, vendedor_price_level, is_tercerizado" +
    "  FROM users ORDER BY level DESC, username"
  ).all();
  res.json(rows);
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  const b = req.body || {};
  const username = String(b.username || "").trim().toLowerCase();
  const password = String(b.password || "");
  const fullName       = String(b.full_name || "").trim().slice(0, 120) || null;
  const phone          = String(b.phone || "").trim().slice(0, 40) || null;
  const whatsappNumber = String(b.whatsapp_number || "").replace(/[^0-9+\s\-()]/g, "").trim().slice(0, 40) || null;
  const email          = String(b.email || "").trim().slice(0, 120) || null;
  const level          = Number(b.level);

  if (!isValidUsername(username))
    return res.status(400).json({ error: "Usuario invalido (3-32 caracteres, letras/numeros/_-.)" });
  if (password.length < 6)
    return res.status(400).json({ error: "La contrasena debe tener al menos 6 caracteres" });
  if (!VALID_LEVELS.includes(level))
    return res.status(400).json({ error: "Nivel invalido. Valores: " + VALID_LEVELS.join(", ") });
  // Por API solo se pueden crear clientes (1-4) y vendedores (5). Los admins
  // se crean por CLI (npm run create-admin) para evitar escalada por error
  // desde la interfaz web.
  if (level === 99)
    return res.status(403).json({ error: "Los administradores se crean desde la linea de comandos (npm run create-admin)." });

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) return res.status(409).json({ error: "Ese usuario ya existe" });

  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare(
    "INSERT INTO users (username, password_hash, plain_password, full_name, phone, whatsapp_number, email, level, active)" +
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"
  ).run(username, hash, password, fullName, phone, whatsappNumber, email, level);

  const user = db.prepare(
    "SELECT id, username, full_name, phone, whatsapp_number, email, plain_password, level, active, created_at, last_login_at, assigned_vendedor_id, price_list_id, vendedor_price_level, is_tercerizado FROM users WHERE id = ?"
  ).get(r.lastInsertRowid);
  res.json({ ok: true, user: user });
});

app.patch("/api/admin/users/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const target = db.prepare("SELECT id, level FROM users WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

  const b = req.body || {};
  const sets = [];
  const vals = [];

  if ("full_name" in b) {
    sets.push("full_name = ?");
    vals.push(String(b.full_name || "").trim().slice(0, 120) || null);
  }
  if ("phone" in b) {
    sets.push("phone = ?");
    vals.push(String(b.phone || "").trim().slice(0, 40) || null);
  }
  if ("whatsapp_number" in b) {
    sets.push("whatsapp_number = ?");
    vals.push(String(b.whatsapp_number || "").replace(/[^0-9+\s\-()]/g, "").trim().slice(0, 40) || null);
  }
  if ("email" in b) {
    sets.push("email = ?");
    vals.push(String(b.email || "").trim().slice(0, 120) || null);
  }
  if ("level" in b) {
    const lvl = Number(b.level);
    if (!VALID_LEVELS.includes(lvl))
      return res.status(400).json({ error: "Nivel invalido" });
    // No permitir que el admin actual se baje a si mismo de admin
    if (id === req.session.userId && lvl !== 99)
      return res.status(400).json({ error: "No podes bajarte de Administrador a vos mismo" });
    sets.push("level = ?");
    vals.push(lvl);
  }
  if ("vendedor_price_level" in b) {
    const vpl = Number(b.vendedor_price_level);
    if (![1, 2, 3, 4].includes(vpl))
      return res.status(400).json({ error: "Lista de precios invalida. Valores: 1 (Minorista), 2 (Revendedor), 3 (Mayorista), 4 (VIP)" });
    sets.push("vendedor_price_level = ?");
    vals.push(vpl);
  }
  if ("assigned_vendedor_id" in b) {
    // null / 0 / "" desasigna; valor numerico debe existir y ser un vendedor activo
    const raw = b.assigned_vendedor_id;
    if (raw === null || raw === "" || raw === 0 || raw === "0") {
      sets.push("assigned_vendedor_id = ?");
      vals.push(null);
    } else {
      const vid = Number(raw);
      if (!vid) return res.status(400).json({ error: "Vendedor invalido" });
      const v = db.prepare("SELECT id FROM users WHERE id = ? AND level = 5 AND active = 1").get(vid);
      if (!v) return res.status(400).json({ error: "Vendedor no encontrado o inactivo" });
      if (vid === id) return res.status(400).json({ error: "Un usuario no puede ser su propio vendedor" });
      sets.push("assigned_vendedor_id = ?");
      vals.push(vid);
    }
  }
  if ("price_list_id" in b) {
    // null / 0 / "" elimina la lista personalizada (vuelve a precios por nivel)
    const raw = b.price_list_id;
    if (raw === null || raw === "" || raw === 0 || raw === "0") {
      sets.push("price_list_id = ?");
      vals.push(null);
    } else {
      const plid = Number(raw);
      if (!plid) return res.status(400).json({ error: "Lista de precios invalida" });
      const pl = db.prepare("SELECT id FROM price_lists WHERE id = ?").get(plid);
      if (!pl) return res.status(400).json({ error: "Lista de precios no encontrada" });
      sets.push("price_list_id = ?");
      vals.push(plid);
    }
  }
  if ("active" in b) {
    const act = b.active ? 1 : 0;
    if (id === req.session.userId && !act)
      return res.status(400).json({ error: "No podes desactivar tu propio usuario" });
    sets.push("active = ?");
    vals.push(act);
  }
  if ("is_tercerizado" in b) {
    // Solo tiene sentido para vendedores (level 5). Si el usuario no es nivel 5,
    // igual permitimos setearlo (la columna existe para todos) pero no tiene efecto.
    sets.push("is_tercerizado = ?");
    vals.push(b.is_tercerizado ? 1 : 0);
  }

  if (!sets.length) return res.status(400).json({ error: "Nada para actualizar" });
  vals.push(id);
  db.prepare("UPDATE users SET " + sets.join(", ") + " WHERE id = ?").run(...vals);
  const user = db.prepare(
    "SELECT id, username, full_name, phone, whatsapp_number, email, plain_password, level, active, created_at, last_login_at, assigned_vendedor_id, price_list_id, vendedor_price_level, is_tercerizado FROM users WHERE id = ?"
  ).get(id);
  res.json({ ok: true, user: user });
});

app.post("/api/admin/users/:id/reset-password", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
  const password = String((req.body || {}).password || "");
  if (password.length < 6)
    return res.status(400).json({ error: "La contrasena debe tener al menos 6 caracteres" });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ?, plain_password = ? WHERE id = ?").run(hash, password, id);
  res.json({ ok: true });
});

// Info diagnostica de la base. Sirve para detectar DB efimera y mostrar
// la advertencia en /admin antes de que el deploy se lleve los datos.
app.get("/api/admin/dbinfo", requireAdmin, (req, res) => {
  let size = null, mtime = null;
  try {
    const st = fs.statSync(DB_PATH);
    size = st.size;
    mtime = st.mtime.toISOString();
  } catch (_) {}
  const backupsDir = path.join(path.dirname(DB_PATH), "backups");
  let backups = [];
  try {
    if (fs.existsSync(backupsDir)) {
      const base = path.basename(DB_PATH, path.extname(DB_PATH));
      backups = fs.readdirSync(backupsDir)
        .filter((f) => f.startsWith(base + "-") && f.endsWith(".db"))
        .map((f) => {
          const full = path.join(backupsDir, f);
          const s = fs.statSync(full);
          return { name: f, size: s.size, mtime: s.mtime.toISOString() };
        })
        .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    }
  } catch (_) {}
  const ephemeral = isEphemeralDbPath(DB_PATH);
  const counts = {
    users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
    products: db.prepare("SELECT COUNT(*) AS n FROM products").get().n,
    orders: db.prepare("SELECT COUNT(*) AS n FROM orders").get().n,
  };
  res.json({
    dbPath: DB_PATH,
    ephemeral: ephemeral,
    nodeEnv: NODE_ENV,
    size: size,
    mtime: mtime,
    backupsDir: backupsDir,
    backups: backups,
    counts: counts,
  });
});

// Export de usuarios a JSON. Incluye password_hash para que el restore
// funcione sin que tengan que reasignar contrasenas. Es info sensible,
// solo el admin la puede bajar.
app.get("/api/admin/users/export", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT username, password_hash, full_name, phone, email, level, active, created_at, last_login_at" +
    "  FROM users ORDER BY id"
  ).all();
  const payload = {
    type: "maxaria-users-export",
    version: 1,
    exported_at: new Date().toISOString(),
    db_path: DB_PATH,
    count: rows.length,
    users: rows,
  };
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="maxaria-users-' + new Date().toISOString().replace(/[:.]/g, "-") + '.json"'
  );
  res.send(JSON.stringify(payload, null, 2));
});

// Import de usuarios desde JSON: UPSERT por username. NUNCA borra
// usuarios existentes que no esten en el archivo, asi un import parcial
// no rompe nada. Sirve para recuperar despues de un deploy que vacio la
// base, o para mover usuarios entre entornos.
app.post("/api/admin/users/import", requireAdmin, (req, res) => {
  const body = req.body || {};
  const list = Array.isArray(body) ? body : (body.users || []);
  if (!Array.isArray(list) || !list.length) {
    return res.status(400).json({ error: "JSON invalido: se esperaba un array 'users' con al menos 1 usuario" });
  }
  const stats = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const findStmt = db.prepare("SELECT id FROM users WHERE username = ?");
  const updateStmt = db.prepare(
    "UPDATE users SET password_hash = ?, full_name = ?, phone = ?, email = ?, level = ?, active = ?" +
    "  WHERE id = ?"
  );
  const insertStmt = db.prepare(
    "INSERT INTO users (username, password_hash, full_name, phone, email, level, active, created_at, last_login_at)" +
    "  VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)"
  );

  db.transaction(() => {
    for (const u of list) {
      try {
        const username = String((u.username || "")).trim().toLowerCase();
        if (!isValidUsername(username) || !u.password_hash || !VALID_LEVELS.includes(Number(u.level))) {
          stats.skipped++;
          stats.errors.push({ username: u.username, error: "Datos invalidos" });
          continue;
        }
        const fullName = u.full_name ? String(u.full_name).slice(0, 120) : null;
        const phone    = u.phone     ? String(u.phone).slice(0, 40)      : null;
        const email    = u.email     ? String(u.email).slice(0, 120)     : null;
        const level    = Number(u.level);
        const active   = u.active ? 1 : 0;
        const existing = findStmt.get(username);
        if (existing) {
          updateStmt.run(u.password_hash, fullName, phone, email, level, active, existing.id);
          stats.updated++;
        } else {
          insertStmt.run(username, u.password_hash, fullName, phone, email, level, active,
                         u.created_at || null, u.last_login_at || null);
          stats.inserted++;
        }
      } catch (e) {
        stats.skipped++;
        stats.errors.push({ username: u && u.username, error: e.message });
      }
    }
  })();

  res.json({ ok: true, stats: stats });
});

// --- Categorías por usuario -------------------------------------------

// GET  /api/admin/users/:id/categories
// Devuelve { categories: [{ id, name, allowed }] }
// allowed=true si el usuario puede verla (o si no tiene restricciones = ve todas)
app.get("/api/admin/users/:id/categories", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ error: "ID invalido" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const allCats = db.prepare("SELECT id, name FROM categories ORDER BY sort_order, name").all();
  const allowed = new Set(
    db.prepare("SELECT category_id FROM user_category_access WHERE user_id = ?")
      .all(userId).map((r) => r.category_id)
  );
  const hasRestrictions = allowed.size > 0;
  const result = allCats.map((c) => ({
    id: c.id,
    name: c.name,
    allowed: hasRestrictions ? allowed.has(c.id) : true,
  }));
  res.json({ categories: result, restricted: hasRestrictions });
});

// PUT  /api/admin/users/:id/categories
// Body: { category_ids: [1,2,3] }  — null o [] = sin restricciones (ve todas)
app.put("/api/admin/users/:id/categories", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ error: "ID invalido" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const ids = req.body && Array.isArray(req.body.category_ids)
    ? req.body.category_ids.map(Number).filter((n) => n > 0)
    : [];

  db.transaction(() => {
    db.prepare("DELETE FROM user_category_access WHERE user_id = ?").run(userId);
    if (ids.length) {
      const ins = db.prepare("INSERT OR IGNORE INTO user_category_access (user_id, category_id) VALUES (?, ?)");
      for (const catId of ids) ins.run(userId, catId);
    }
  })();

  res.json({ ok: true, restricted: ids.length > 0, category_ids: ids });
});

// Subir Excel y reimportar precios + stock (NO destructivo: preserva users y orders)
app.post("/api/admin/import-excel", requireAdmin, excelUpload.single("file"), (req, res) => {
  if (!req.file || !req.file.buffer || !req.file.buffer.length) {
    return res.status(400).json({ error: "No llego ningun archivo" });
  }
  let items;
  try {
    items = readExcelBuffer(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ error: "Excel invalido: " + e.message });
  }
  if (!items.length) return res.status(400).json({ error: "El Excel no tiene filas validas" });
  try {
    const stats = importPrices(items, db, { source: "excel-upload" });
    res.json({ ok: true, filas: items.length, stats: stats });
  } catch (e) {
    console.error("import-excel error:", e);
    res.status(500).json({ error: "Error importando: " + e.message });
  }
});

// ===== Listas de precios personalizadas =====
//
// Cada lista combina una lista base (minorista/revendedor/mayorista/vip/publico)
// con un porcentaje de markup. El precio efectivo para un cliente asignado a
// la lista X es:  round(products.price_<base_level> * (1 + markup/100))
// Las listas se asignan a clientes (level 1-4) via users.price_list_id.

// GET /api/admin/price-lists
// Devuelve todas las listas + cantidad de clientes asignados a cada una.
app.get("/api/admin/price-lists", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT pl.id, pl.name, pl.base_level, pl.markup_percent, pl.active, pl.notes," +
    "       pl.created_at, pl.updated_at," +
    "       (SELECT COUNT(*) FROM users u WHERE u.price_list_id = pl.id) AS users_count" +
    "  FROM price_lists pl ORDER BY pl.active DESC, pl.name"
  ).all();
  res.json(rows);
});

// POST /api/admin/price-lists
// Body: { name, base_level, markup_percent, notes? }
app.post("/api/admin/price-lists", requireAdmin, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim().slice(0, 80);
  const base_level = String(b.base_level || "").trim().toLowerCase();
  const markup_percent = Number(b.markup_percent);
  const notes = String(b.notes || "").trim().slice(0, 300) || null;
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  if (!PRICE_LIST_BASE_LEVELS.includes(base_level))
    return res.status(400).json({ error: "Lista base invalida. Valores: " + PRICE_LIST_BASE_LEVELS.join(", ") });
  if (!isFinite(markup_percent) || markup_percent < -90 || markup_percent > 95)
    return res.status(400).json({ error: "Ganancia invalida (debe ser un numero entre -90 y 95)" });

  const exists = db.prepare("SELECT id FROM price_lists WHERE name = ?").get(name);
  if (exists) return res.status(409).json({ error: "Ya existe una lista con ese nombre" });

  const r = db.prepare(
    "INSERT INTO price_lists (name, base_level, markup_percent, notes)" +
    " VALUES (?, ?, ?, ?)"
  ).run(name, base_level, markup_percent, notes);
  const row = db.prepare(
    "SELECT id, name, base_level, markup_percent, active, notes, created_at, updated_at," +
    "       0 AS users_count FROM price_lists WHERE id = ?"
  ).get(r.lastInsertRowid);
  res.json({ ok: true, price_list: row });
});

// PATCH /api/admin/price-lists/:id
// Body: cualquier subconjunto de { name, base_level, markup_percent, active, notes }
app.patch("/api/admin/price-lists/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const exists = db.prepare("SELECT id FROM price_lists WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "Lista no encontrada" });

  const b = req.body || {};
  const sets = [];
  const vals = [];
  if ("name" in b) {
    const v = String(b.name || "").trim().slice(0, 80);
    if (!v) return res.status(400).json({ error: "Nombre requerido" });
    const dup = db.prepare("SELECT id FROM price_lists WHERE name = ? AND id != ?").get(v, id);
    if (dup) return res.status(409).json({ error: "Ya existe otra lista con ese nombre" });
    sets.push("name = ?"); vals.push(v);
  }
  if ("base_level" in b) {
    const v = String(b.base_level || "").trim().toLowerCase();
    if (!PRICE_LIST_BASE_LEVELS.includes(v))
      return res.status(400).json({ error: "Lista base invalida" });
    sets.push("base_level = ?"); vals.push(v);
  }
  if ("markup_percent" in b) {
    const v = Number(b.markup_percent);
    if (!isFinite(v) || v < -90 || v > 95)
      return res.status(400).json({ error: "Ganancia invalida (entre -90 y 95)" });
    sets.push("markup_percent = ?"); vals.push(v);
  }
  if ("active" in b) {
    sets.push("active = ?"); vals.push(b.active ? 1 : 0);
  }
  if ("notes" in b) {
    sets.push("notes = ?"); vals.push(String(b.notes || "").trim().slice(0, 300) || null);
  }
  if (!sets.length) return res.status(400).json({ error: "Nada para actualizar" });
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  db.prepare("UPDATE price_lists SET " + sets.join(", ") + " WHERE id = ?").run(...vals);

  const row = db.prepare(
    "SELECT pl.id, pl.name, pl.base_level, pl.markup_percent, pl.active, pl.notes," +
    "       pl.created_at, pl.updated_at," +
    "       (SELECT COUNT(*) FROM users u WHERE u.price_list_id = pl.id) AS users_count" +
    "  FROM price_lists pl WHERE pl.id = ?"
  ).get(id);
  res.json({ ok: true, price_list: row });
});

// DELETE /api/admin/price-lists/:id
// Solo permitido si no hay clientes asignados.
app.delete("/api/admin/price-lists/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const exists = db.prepare("SELECT id FROM price_lists WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "Lista no encontrada" });
  const usage = db.prepare("SELECT COUNT(*) AS n FROM users WHERE price_list_id = ?").get(id);
  if (usage.n > 0) {
    return res.status(409).json({
      error: "No se puede borrar: hay " + usage.n + " cliente(s) usando esta lista. " +
             "Desasignala primero o desactiva la lista."
    });
  }
  db.prepare("DELETE FROM price_lists WHERE id = ?").run(id);
  res.json({ ok: true });
});

// GET /api/admin/price-lists/:id/preview
// Devuelve hasta N productos con sus precios efectivos para esta lista.
// Util para que el admin "vea" como queda la lista antes de asignarla.
app.get("/api/admin/price-lists/:id/preview", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const list = db.prepare(
    "SELECT id, name, base_level, markup_percent FROM price_lists WHERE id = ?"
  ).get(id);
  if (!list) return res.status(404).json({ error: "Lista no encontrada" });
  const col = priceColumnForBaseLevel(list.base_level);
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  const products = db.prepare(
    "SELECT p.id, p.code, p.name, p." + col + " AS base_price," +
    "       CASE WHEN (1 - ? / 100.0) > 0" +
    "            THEN CAST(ROUND(p." + col + " / (1 - ? / 100.0)) AS INTEGER)" +
    "            ELSE p." + col + " END AS effective_price," +
    "       p.stock, c.name AS category_name" +
    "  FROM products p LEFT JOIN categories c ON c.id = p.category_id" +
    "  WHERE p.active = 1 AND p.stock > 0" +
    "  ORDER BY c.sort_order, c.name, p.name LIMIT ?"
  ).all(Number(list.markup_percent) || 0, Number(list.markup_percent) || 0, limit);
  res.json({ list: list, products: products });
});

// ===== Vendedores =====

// Actividad de vendedores: resumen de pedidos + ganancia por vendedor.
// La ganancia se calcula sobre order_items.vendedor_cost_unit (snapshot al
// momento del pedido). Items sin snapshot aportan 0 a la ganancia.
// Excluye pedidos cancelados. Solo admin.
app.get("/api/admin/earnings", requireAdmin, (req, res) => {
  // OJO: el join con order_items multiplica filas por la cantidad de items.
  // Por eso separamos la agregacion de pedidos (total_orders/delivered/sold)
  // de la de items (total_cost/earning) en dos CTEs distintas, usando
  // DISTINCT en el par (vendedor, pedido) para que el OR del vinculo
  // pedido->vendedor no duplique.
  const rows = db.prepare(
    "WITH order_vendedor AS (" +
    "  SELECT DISTINCT v.id AS vendedor_id, o.id AS order_id, o.status, o.total" +
    "    FROM users v" +
    "    JOIN orders o ON (o.assigned_vendedor_id = v.id OR" +
    "                      o.user_id IN (SELECT id FROM users WHERE assigned_vendedor_id = v.id))" +
    "   WHERE v.level = 5 AND o.status != 'cancelado' AND COALESCE(o.is_unified,0) = 0" +
    ")," +
    "order_agg AS (" +
    "  SELECT vendedor_id," +
    "         COUNT(*) AS total_orders," +
    "         SUM(CASE WHEN status = 'entregado' THEN 1 ELSE 0 END) AS total_delivered," +
    "         SUM(total) AS total_sold" +
    "    FROM order_vendedor GROUP BY vendedor_id" +
    ")," +
    "item_agg AS (" +
    "  SELECT ov.vendedor_id," +
    "         SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
    "                  THEN oi.vendedor_cost_unit * oi.quantity ELSE 0 END) AS total_cost," +
    "         SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
    "                  THEN (oi.unit_price - oi.vendedor_cost_unit) * oi.quantity ELSE 0 END) AS total_earning" +
    "    FROM order_vendedor ov" +
    "    JOIN order_items oi ON oi.order_id = ov.order_id" +
    "   GROUP BY ov.vendedor_id" +
    ") " +
    "SELECT v.id AS vendedor_id, v.username, v.full_name, v.active, v.is_tercerizado," +
    "       COALESCE(oa.total_orders, 0) AS total_orders," +
    "       COALESCE(oa.total_delivered, 0) AS total_delivered," +
    "       COALESCE(oa.total_sold, 0) AS total_sold," +
    "       COALESCE(ia.total_cost, 0) AS total_cost," +
    "       COALESCE(ia.total_earning, 0) AS total_earning" +
    "  FROM users v" +
    "  LEFT JOIN order_agg oa ON oa.vendedor_id = v.id" +
    "  LEFT JOIN item_agg ia ON ia.vendedor_id = v.id" +
    " WHERE v.level = 5" +
    " ORDER BY total_earning DESC, v.username"
  ).all();
  res.json(rows);
});

// Detalle de actividad de un vendedor: lista de pedidos con ganancia.
// Excluye cancelados. Solo admin.
app.get("/api/admin/earnings/:vendedorId", requireAdmin, (req, res) => {
  const vid = Number(req.params.vendedorId);
  if (!vid) return res.status(400).json({ error: "ID invalido" });
  const vendedor = db.prepare(
    "SELECT id, username, full_name, is_tercerizado FROM users WHERE id = ? AND level = 5"
  ).get(vid);
  if (!vendedor) return res.status(404).json({ error: "Vendedor no encontrado" });
  const orders = db.prepare(
    "SELECT o.id, o.status, o.total, o.created_at," +
    "       o.user_id, u.username AS client_username, u.full_name AS client_full_name," +
    "       COALESCE(SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
    "                         THEN oi.vendedor_cost_unit * oi.quantity ELSE 0 END), 0) AS cost_total," +
    "       COALESCE(SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
    "                         THEN (oi.unit_price - oi.vendedor_cost_unit) * oi.quantity ELSE 0 END), 0) AS earning_total" +
    "  FROM orders o" +
    "  JOIN users u ON u.id = o.user_id" +
    "  LEFT JOIN order_items oi ON oi.order_id = o.id" +
    "  WHERE o.status != 'cancelado' AND COALESCE(o.is_unified,0) = 0" +
    "    AND (o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)" +
    "  GROUP BY o.id" +
    "  ORDER BY o.created_at DESC"
  ).all(vid, vid);
  res.json({ vendedor: vendedor, orders: orders });
});

// Lista de vendedores con estadisticas de pedidos y entregas (solo admin)
app.get("/api/admin/vendedores", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT u.id, u.username, u.full_name, u.phone, u.whatsapp_number, u.email, u.active," +
    "       u.vendedor_price_level, u.is_tercerizado, u.created_at, u.last_login_at," +
    "       COUNT(DISTINCT o.id) AS total_orders," +
    "       COUNT(DISTINCT d.id) AS total_deliveries" +
    "  FROM users u" +
    "  LEFT JOIN orders o ON o.assigned_vendedor_id = u.id" +
    "  LEFT JOIN deliveries d ON d.vendedor_id = u.id" +
    "  WHERE u.level = 5" +
    "  GROUP BY u.id" +
    "  ORDER BY u.username"
  ).all();
  res.json(rows);
});

// Asignar (o desasignar) un vendedor a un pedido (solo admin)
app.patch("/api/admin/orders/:id/assign", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

  const vendedorId = req.body && req.body.vendedor_id ? Number(req.body.vendedor_id) : null;
  if (vendedorId) {
    const vendedor = db.prepare("SELECT id FROM users WHERE id = ? AND level = 5 AND active = 1").get(vendedorId);
    if (!vendedor) return res.status(400).json({ error: "Vendedor no encontrado o inactivo" });
  }
  db.prepare("UPDATE orders SET assigned_vendedor_id = ? WHERE id = ?").run(vendedorId, id);
  res.json({ ok: true, id, vendedor_id: vendedorId });
});

// Registrar entrega de un pedido (admin o vendedor asignado)
// Body: { delivered_to, efectivo_amount, transferencia_amount, notes }
app.post("/api/orders/:id/deliver", requireVendedorOrAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });

  const isAdmin = req.session.level === 99;
  // Verificar que el pedido existe y (si vendedor) que es suyo o de uno de sus clientes
  const order = isAdmin
    ? db.prepare("SELECT id, status FROM orders WHERE id = ?").get(id)
    : db.prepare(
        "SELECT o.id, o.status FROM orders o JOIN users u ON u.id = o.user_id" +
        "  WHERE o.id = ? AND (o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)"
      ).get(id, req.session.userId, req.session.userId);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado o no asignado a vos" });

  const { delivered_to, efectivo_amount, transferencia_amount, notes } = req.body || {};
  const deliveredTo = String(delivered_to || "").trim().slice(0, 200);
  if (!deliveredTo) return res.status(400).json({ error: "Falta indicar quien recibio el pedido" });

  const efectivo = Math.max(0, Number(efectivo_amount) || 0);
  const transferencia = Math.max(0, Number(transferencia_amount) || 0);

  const vendedorId = isAdmin
    ? (db.prepare("SELECT assigned_vendedor_id FROM orders WHERE id = ?").get(id).assigned_vendedor_id || req.session.userId)
    : req.session.userId;
  const notesStr = notes ? String(notes).trim().slice(0, 500) : null;

  const existing = db.prepare("SELECT id FROM deliveries WHERE order_id = ?").get(id);
  let deliveryId;
  db.transaction(() => {
    if (existing) {
      db.prepare(
        "UPDATE deliveries SET delivered_to = ?, efectivo_amount = ?, transferencia_amount = ?, notes = ?," +
        "  delivered_at = datetime('now') WHERE order_id = ?"
      ).run(deliveredTo, efectivo, transferencia, notesStr, id);
      deliveryId = existing.id;
    } else {
      const r = db.prepare(
        "INSERT INTO deliveries (order_id, vendedor_id, delivered_to, efectivo_amount, transferencia_amount, notes)" +
        " VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, vendedorId, deliveredTo, efectivo, transferencia, notesStr);
      deliveryId = r.lastInsertRowid;
    }
    // Marcar el pedido como entregado automaticamente
    db.prepare("UPDATE orders SET status = 'entregado' WHERE id = ?").run(id);
  })();

  res.json({ ok: true, delivery_id: deliveryId, order_id: id });
});

// Lista completa de entregas con datos de pago (solo admin)
app.get("/api/admin/deliveries", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT d.id, d.order_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount," +
    "       d.notes, d.delivered_at," +
    "       v.id AS vendedor_id, v.username AS vendedor_username, v.full_name AS vendedor_full_name," +
    "       o.total AS order_total, o.status AS order_status," +
    "       u.username AS client_username, u.full_name AS client_full_name" +
    "  FROM deliveries d" +
    "  JOIN users v ON v.id = d.vendedor_id" +
    "  JOIN orders o ON o.id = d.order_id" +
    "  JOIN users u ON u.id = o.user_id" +
    "  ORDER BY d.delivered_at DESC LIMIT 500"
  ).all();
  res.json(rows);
});

// ===== Proveedores =====

app.get("/api/admin/suppliers", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT id, name, contact, phone, email, notes, active, created_at" +
    "  FROM suppliers ORDER BY name"
  ).all();
  res.json(rows);
});

app.post("/api/admin/suppliers", requireAdmin, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim().slice(0, 200);
  if (!name) return res.status(400).json({ error: "El nombre es requerido" });
  const contact = String(b.contact || "").trim().slice(0, 200) || null;
  const phone   = String(b.phone   || "").trim().slice(0, 60)  || null;
  const email   = String(b.email   || "").trim().slice(0, 120) || null;
  const notes   = String(b.notes   || "").trim().slice(0, 500) || null;
  const r = db.prepare(
    "INSERT INTO suppliers (name, contact, phone, email, notes) VALUES (?, ?, ?, ?, ?)"
  ).run(name, contact, phone, email, notes);
  const row = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(r.lastInsertRowid);
  res.json({ ok: true, supplier: row });
});

app.patch("/api/admin/suppliers/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const b = req.body || {};
  const allowed = ["name", "contact", "phone", "email", "notes", "active"];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in b) {
      if (k === "name") {
        const v = String(b.name || "").trim().slice(0, 200);
        if (!v) return res.status(400).json({ error: "El nombre es requerido" });
        sets.push("name = ?"); vals.push(v);
      } else if (k === "active") {
        sets.push("active = ?"); vals.push(b.active ? 1 : 0);
      } else {
        sets.push(k + " = ?"); vals.push(String(b[k] || "").trim().slice(0, 500) || null);
      }
    }
  }
  if (!sets.length) return res.status(400).json({ error: "Nada para actualizar" });
  vals.push(id);
  const r = db.prepare("UPDATE suppliers SET " + sets.join(", ") + " WHERE id = ?").run(...vals);
  if (!r.changes) return res.status(404).json({ error: "Proveedor no encontrado" });
  const row = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
  res.json({ ok: true, supplier: row });
});

// ===== Compras =====

app.get("/api/admin/purchases", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT po.id, po.supplier_id, s.name AS supplier_name," +
    "       po.reference, po.notes, po.total_cost, po.received_at, po.created_at," +
    "       COUNT(pi.id) AS items_count" +
    "  FROM purchase_orders po" +
    "  LEFT JOIN suppliers s ON s.id = po.supplier_id" +
    "  LEFT JOIN purchase_items pi ON pi.purchase_order_id = po.id" +
    "  GROUP BY po.id" +
    "  ORDER BY po.received_at DESC LIMIT 200"
  ).all();
  res.json(rows);
});

app.post("/api/admin/purchases", requireAdmin, (req, res) => {
  const b = req.body || {};
  const supplier_id  = b.supplier_id ? Number(b.supplier_id) : null;
  const reference    = String(b.reference || "").trim().slice(0, 200) || null;
  const notes        = String(b.notes || "").trim().slice(0, 500) || null;
  const received_at  = String(b.received_at || "").trim() || null;
  const rawItems     = Array.isArray(b.items) ? b.items : [];

  if (!rawItems.length) return res.status(400).json({ error: "La compra debe tener al menos 1 item" });

  if (supplier_id) {
    const sup = db.prepare("SELECT id FROM suppliers WHERE id = ?").get(supplier_id);
    if (!sup) return res.status(400).json({ error: "Proveedor no encontrado" });
  }

  const lines = [];
  let totalCost = 0;
  for (const it of rawItems) {
    const product_id  = it.product_id ? Number(it.product_id) : null;
    const quantity    = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const unit_cost   = Math.max(0, Number(it.unit_cost) || 0);
    const subtotal    = unit_cost * quantity;
    totalCost += subtotal;
    let product_code = String(it.product_code || "").trim().slice(0, 50);
    let product_name = String(it.product_name || "").trim().slice(0, 200);
    if (product_id && (!product_code || !product_name)) {
      const prod = db.prepare("SELECT code, name FROM products WHERE id = ?").get(product_id);
      if (prod) {
        if (!product_code) product_code = prod.code || "";
        if (!product_name) product_name = prod.name || "";
      }
    }
    if (!product_name) continue;
    lines.push({ product_id, product_code, product_name, quantity, unit_cost, subtotal });
  }
  if (!lines.length) return res.status(400).json({ error: "Sin items validos" });

  let purchaseId;
  db.transaction(() => {
    const r = db.prepare(
      "INSERT INTO purchase_orders (supplier_id, reference, notes, total_cost, received_at, created_by, created_at)" +
      " VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?, datetime('now'))"
    ).run(supplier_id, reference, notes, totalCost, received_at, req.session.userId);
    purchaseId = r.lastInsertRowid;

    const insItem = db.prepare(
      "INSERT INTO purchase_items (purchase_order_id, product_id, product_code, product_name, quantity, unit_cost, subtotal)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const updStock = db.prepare(
      "UPDATE products SET stock = stock + ? WHERE id = ?"
    );
    for (const l of lines) {
      insItem.run(purchaseId, l.product_id, l.product_code, l.product_name,
                  l.quantity, l.unit_cost, l.subtotal);
      if (l.product_id) updStock.run(l.quantity, l.product_id);
    }
  })();

  const purchase = db.prepare(
    "SELECT po.*, s.name AS supplier_name FROM purchase_orders po" +
    "  LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?"
  ).get(purchaseId);
  res.json({ ok: true, purchase: purchase });
});

app.get("/api/admin/purchases/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const purchase = db.prepare(
    "SELECT po.*, s.name AS supplier_name FROM purchase_orders po" +
    "  LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?"
  ).get(id);
  if (!purchase) return res.status(404).json({ error: "Compra no encontrada" });
  const items = db.prepare(
    "SELECT id, product_id, product_code, product_name, quantity, unit_cost, subtotal" +
    "  FROM purchase_items WHERE purchase_order_id = ? ORDER BY id"
  ).all(id);
  res.json(Object.assign({}, purchase, { items: items }));
});

app.put("/api/admin/purchases/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });

  const existing = db.prepare("SELECT id FROM purchase_orders WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Compra no encontrada" });

  const b = req.body || {};
  const supplier_id = b.supplier_id ? Number(b.supplier_id) : null;
  const reference   = String(b.reference || "").trim().slice(0, 200) || null;
  const notes       = String(b.notes || "").trim().slice(0, 500) || null;
  const received_at = String(b.received_at || "").trim() || null;
  const rawItems    = Array.isArray(b.items) ? b.items : [];

  if (!rawItems.length) return res.status(400).json({ error: "La compra debe tener al menos 1 item" });

  const lines = [];
  let totalCost = 0;
  for (const it of rawItems) {
    const product_id  = it.product_id ? Number(it.product_id) : null;
    const quantity    = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const unit_cost   = Math.max(0, Number(it.unit_cost) || 0);
    const subtotal    = unit_cost * quantity;
    totalCost += subtotal;
    let product_code = String(it.product_code || "").trim().slice(0, 50);
    let product_name = String(it.product_name || "").trim().slice(0, 200);
    if (product_id && (!product_code || !product_name)) {
      const prod = db.prepare("SELECT code, name FROM products WHERE id = ?").get(product_id);
      if (prod) {
        if (!product_code) product_code = prod.code || "";
        if (!product_name) product_name = prod.name || "";
      }
    }
    if (!product_name) continue;
    lines.push({ product_id, product_code, product_name, quantity, unit_cost, subtotal });
  }
  if (!lines.length) return res.status(400).json({ error: "Sin items validos" });

  db.transaction(() => {
    // Revertir stock de items anteriores
    const oldItems = db.prepare("SELECT product_id, quantity FROM purchase_items WHERE purchase_order_id = ?").all(id);
    const decStock = db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?");
    for (const oi of oldItems) {
      if (oi.product_id) decStock.run(oi.quantity, oi.product_id);
    }

    // Borrar items anteriores
    db.prepare("DELETE FROM purchase_items WHERE purchase_order_id = ?").run(id);

    // Actualizar cabecera
    db.prepare(
      "UPDATE purchase_orders SET supplier_id = ?, reference = ?, notes = ?, total_cost = ?," +
      "  received_at = COALESCE(?, received_at) WHERE id = ?"
    ).run(supplier_id, reference, notes, totalCost, received_at, id);

    // Insertar nuevos items y sumar stock
    const insItem = db.prepare(
      "INSERT INTO purchase_items (purchase_order_id, product_id, product_code, product_name, quantity, unit_cost, subtotal)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const incStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    for (const l of lines) {
      insItem.run(id, l.product_id, l.product_code, l.product_name, l.quantity, l.unit_cost, l.subtotal);
      if (l.product_id) incStock.run(l.quantity, l.product_id);
    }
  })();

  const purchase = db.prepare(
    "SELECT po.*, s.name AS supplier_name FROM purchase_orders po" +
    "  LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?"
  ).get(id);
  const items = db.prepare(
    "SELECT id, product_id, product_code, product_name, quantity, unit_cost, subtotal" +
    "  FROM purchase_items WHERE purchase_order_id = ? ORDER BY id"
  ).all(id);
  res.json({ ok: true, purchase: Object.assign({}, purchase, { items: items }) });
});

// ===== Pagos =====

app.get("/api/admin/payments", requireAdmin, (req, res) => {
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  let sql =
    "SELECT p.id, p.user_id, p.amount, p.method, p.reference, p.notes, p.created_at," +
    "       u.username AS client_username, u.full_name AS client_full_name," +
    "       rb.username AS registered_by_username, rb.full_name AS registered_by_full_name" +
    "  FROM payments p" +
    "  JOIN users u ON u.id = p.user_id" +
    "  LEFT JOIN users rb ON rb.id = p.registered_by";
  const params = [];
  if (userId) { sql += "  WHERE p.user_id = ?"; params.push(userId); }
  sql += "  ORDER BY p.created_at DESC LIMIT 500";
  res.json(db.prepare(sql).all(...params));
});

app.post("/api/admin/payments", requireAdmin, (req, res) => {
  const b = req.body || {};
  const user_id   = Number(b.user_id);
  const amount    = Number(b.amount);
  const method    = String(b.method || "efectivo").trim().slice(0, 50);
  const reference = String(b.reference || "").trim().slice(0, 200) || null;
  const notes     = String(b.notes || "").trim().slice(0, 500) || null;

  if (!user_id || !amount || amount <= 0)
    return res.status(400).json({ error: "Faltan datos: user_id y amount son requeridos" });

  const client = db.prepare("SELECT id, full_name, username FROM users WHERE id = ? AND active = 1").get(user_id);
  if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

  let paymentId;
  db.transaction(() => {
    const r = db.prepare(
      "INSERT INTO payments (user_id, amount, method, reference, notes, registered_by, created_at)" +
      " VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    ).run(user_id, amount, method, reference, notes, req.session.userId);
    paymentId = r.lastInsertRowid;
    const desc = "Pago " + method + (reference ? " · " + reference : "");
    db.prepare(
      "INSERT INTO account_movements (user_id, type, amount, description, payment_id, created_at)" +
      " VALUES (?, 'credit', ?, ?, ?, datetime('now'))"
    ).run(user_id, amount, desc, paymentId);
  })();

  const payment = db.prepare(
    "SELECT p.*, u.username AS client_username, u.full_name AS client_full_name" +
    "  FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = ?"
  ).get(paymentId);
  res.json({ ok: true, payment: payment });
});

app.delete("/api/admin/payments/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const payment = db.prepare("SELECT id FROM payments WHERE id = ?").get(id);
  if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
  db.transaction(() => {
    db.prepare("DELETE FROM account_movements WHERE payment_id = ?").run(id);
    db.prepare("DELETE FROM payments WHERE id = ?").run(id);
  })();
  res.json({ ok: true });
});

// ===== Cuentas corrientes =====

app.get("/api/admin/accounts", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT u.id, u.username, u.full_name, u.level," +
    "       COALESCE(SUM(CASE WHEN am.type='credit' THEN am.amount ELSE 0 END),0) AS total_credit," +
    "       COALESCE(SUM(CASE WHEN am.type='debit'  THEN am.amount ELSE 0 END),0) AS total_debit," +
    "       COALESCE(SUM(CASE WHEN am.type='credit' THEN am.amount ELSE -am.amount END),0) AS balance" +
    "  FROM users u" +
    "  LEFT JOIN account_movements am ON am.user_id = u.id" +
    "  WHERE u.level IN (1,2,3,4) AND u.active = 1" +
    "  GROUP BY u.id" +
    "  ORDER BY u.full_name, u.username"
  ).all();
  res.json(rows);
});

app.get("/api/admin/accounts/:userId", requireAdmin, (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: "ID invalido" });
  const user = db.prepare("SELECT id, username, full_name, level FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  const movements = db.prepare(
    "SELECT am.id, am.type, am.amount, am.description, am.created_at," +
    "       am.order_id, am.payment_id" +
    "  FROM account_movements am" +
    "  WHERE am.user_id = ?" +
    "  ORDER BY am.created_at DESC LIMIT 200"
  ).all(userId);
  const balance = db.prepare(
    "SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END),0) AS balance" +
    "  FROM account_movements WHERE user_id = ?"
  ).get(userId);
  res.json({ user: user, movements: movements, balance: balance.balance });
});

app.get("/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));
// Servir imagenes de productos desde el volumen persistente
app.use("/images/products", express.static(PRODUCT_IMAGES_DIR));
// PWA: el service worker y el manifest no se deben cachear de forma agresiva,
// asi cualquier cambio en sw.js se detecta al toque.
app.use((req, res, next) => {
  if (req.path === "/sw.js") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Service-Worker-Allowed", "/");
  } else if (req.path === "/manifest.json") {
    res.setHeader("Cache-Control", "public, max-age=300");
  }
  next();
});
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use((req, res) => res.status(404).send("No encontrado"));

app.listen(PORT, () => {
  console.log("Maxaria escuchando en http://localhost:" + PORT + "  (" + NODE_ENV + ")");
});
