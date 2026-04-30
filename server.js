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
// Si el usuario es admin o no tiene restricciones, devuelve null (= acceso total).
function getUserAllowedCategoryIds(userId, level) {
  if (Number(level) === 99) return null; // admin ve todo
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
  if (Number(level) === 99) return true;
  return getPriceChangesVisibleLevels().has(Number(level));
}

// Mapea el nivel a las columnas old_X / new_X de la tabla price_changes.
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
function levelName(level) {
  switch (Number(level)) {
    case 1: return "Minorista";
    case 2: return "Revendedor";
    case 3: return "Mayorista";
    case 4: return "VIP";
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
    .prepare("SELECT id, username, password_hash, full_name, level, active FROM users WHERE username = ?")
    .get(String(username).trim().toLowerCase());
  if (!user || !user.active) return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  if (!bcrypt.compareSync(String(password), user.password_hash))
    return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.level = user.level;
  req.session.fullName = user.full_name;
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
  const wa = getSetting("whatsapp_number", WHATSAPP_NUMBER || null);
  res.json({
    id: req.session.userId, username: req.session.username,
    fullName: req.session.fullName, level: req.session.level,
    levelName: levelName(req.session.level),
    whatsapp: wa ? String(wa).replace(/[^0-9]/g, "") : null,
    canSeePriceChanges: userCanSeePriceChanges(req.session.level),
    app_name: getAppName(),
  });
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

  // Admin puede mirar como otro nivel (igual que /api/products).
  let effectiveLevel = level;
  if (level === 99 && req.query.as_level != null) {
    const asLvl = Number(req.query.as_level);
    if ([1, 2, 3, 4].includes(asLvl)) effectiveLevel = asLvl;
  }

  const updates = db.prepare(
    "SELECT id, created_at, source, rows_total, products_changed, products_new," +
    "       COALESCE(products_reingreso, 0) AS products_reingreso" +
    "  FROM price_updates ORDER BY id DESC LIMIT 10"
  ).all();

  if (!updates.length) {
    return res.json({ updates: [], level: effectiveLevel, levelName: levelName(effectiveLevel) });
  }

  const cols = priceChangeCols(effectiveLevel);
  const rowsStmt = db.prepare(
    "SELECT pc.product_id, pc.code, pc.name, pc.is_new," +
    "       COALESCE(pc.is_reingreso, 0) AS is_reingreso," +
    "       pc." + cols.old + " AS old_price," +
    "       pc." + cols.new + " AS new_price," +
    "       p.image_url, p.stock, p.active" +
    "  FROM price_changes pc" +
    "  LEFT JOIN products p ON p.id = pc.product_id" +
    "  WHERE pc.update_id = ?" +
    "  ORDER BY pc.is_new DESC, pc.name"
  );

  const result = [];
  for (const u of updates) {
    const rows = rowsStmt.all(u.id);
    const cambios = [];
    const nuevos = [];
    const reingresos = [];

    for (const r of rows) {
      // Productos inactivos no se muestran en ninguna seccion
      if (!r.active) continue;

      const newP = Number(r.new_price) || 0;
      const oldP = r.old_price == null ? null : Number(r.old_price);

      // Reingresos: vuelven de stock 0 — se muestran igual aunque ahora tengan stock
      if (r.is_reingreso) {
        reingresos.push({
          product_id: r.product_id, code: r.code, name: r.name,
          image_url: r.image_url || null, new_price: newP,
        });
        continue;
      }

      if (r.is_new) {
        nuevos.push({
          product_id: r.product_id, code: r.code, name: r.name,
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
        image_url: r.image_url || null,
        old_price: oldP, new_price: newP,
        delta: delta,
        delta_pct: pct == null ? null : Math.round(pct * 10) / 10,
      });
    }

    // Ordenamos cambios por mayor suba %, reingresos y nuevos alfabetico
    cambios.sort((a, b) => {
      const pa = a.delta_pct == null ? -Infinity : a.delta_pct;
      const pb = b.delta_pct == null ? -Infinity : b.delta_pct;
      return pb - pa;
    });
    nuevos.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    reingresos.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

    // Solo incluimos el update si tiene algo para mostrar
    if (cambios.length || nuevos.length || reingresos.length) {
      result.push({ update: u, cambios, nuevos, reingresos });
    }
  }

  res.json({
    updates: result,
    level: effectiveLevel,
    levelName: levelName(effectiveLevel),
  });
});

app.get("/api/categories", requireLogin, (req, res) => {
  const allowedIds = getUserAllowedCategoryIds(req.session.userId, req.session.level);
  let rows = db.prepare("SELECT id, name, icon_url FROM categories ORDER BY sort_order, name").all();
  if (allowedIds !== null) {
    rows = rows.filter((c) => allowedIds.has(c.id));
  }
  res.json(rows);
});

app.get("/api/products", requireLogin, (req, res) => {
  // Admin (level 99) puede ver el catalogo "como si fuera" otro nivel
  // pasando ?as_level=1|2|3|4. Util para revisar precios desde la
  // perspectiva del cliente sin tener que loguearse con otra cuenta.
  let effectiveLevel = req.session.level;
  if (req.session.level === 99 && req.query.as_level != null) {
    const asLvl = Number(req.query.as_level);
    if ([1, 2, 3, 4].includes(asLvl)) effectiveLevel = asLvl;
  }
  const col = priceColumnFor(effectiveLevel);

  // Filtro de categorias por permisos del usuario
  const allowedIds = getUserAllowedCategoryIds(req.session.userId, req.session.level);
  let sql =
    "SELECT p.id, p.code, p.category_id, c.name AS category_name," +
    "       p.name, p.image_url, p." + col + " AS price, p.stock" +
    "  FROM products p LEFT JOIN categories c ON c.id = p.category_id" +
    "  WHERE p.active = 1 AND p.stock > 0";
  const params = [];
  if (allowedIds !== null && allowedIds.size > 0) {
    const placeholders = Array.from(allowedIds).map(() => "?").join(",");
    sql += " AND p.category_id IN (" + placeholders + ")";
    params.push(...Array.from(allowedIds));
  } else if (allowedIds !== null && allowedIds.size === 0) {
    // Usuario con restriccion a 0 categorias -> no ve nada
    return res.json([]);
  }
  sql += "  ORDER BY c.sort_order, c.name, p.name";
  res.json(db.prepare(sql).all(...params));
});

// ----- Pedidos -----
app.post("/api/orders", requireLogin, (req, res) => {
  const { items, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "Carrito vacio" });

  const col = priceColumnFor(req.session.level);
  const getProd = db.prepare(
    "SELECT id, code, name, " + col + " AS price, stock FROM products WHERE id = ? AND active = 1"
  );

  const lines = [];
  let total = 0;
  for (const it of items) {
    const id = Number(it.id);
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0));
    if (!id || !qty) continue;
    const p = getProd.get(id);
    if (!p || p.stock <= 0) continue;
    const subtotal = p.price * qty;
    total += subtotal;
    lines.push({
      product_id: p.id, product_code: p.code, product_name: p.name,
      quantity: qty, unit_price: p.price, subtotal: subtotal,
    });
  }
  if (!lines.length)
    return res.status(400).json({ error: "Ninguno de los productos del carrito esta disponible" });

  const insertOrder = db.prepare(
    "INSERT INTO orders (user_id, status, total, notes, whatsapp_sent_at, created_at)" +
    " VALUES (?, 'enviado', ?, ?, datetime('now'), datetime('now'))"
  );
  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, subtotal)" +
    " VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  let orderId;
  db.transaction(() => {
    const r = insertOrder.run(req.session.userId, total, (notes || "").slice(0, 500) || null);
    orderId = r.lastInsertRowid;
    for (const l of lines) {
      insertItem.run(orderId, l.product_id, l.product_code, l.product_name,
                     l.quantity, l.unit_price, l.subtotal);
    }
  })();

  res.json({ ok: true, order: { id: orderId, total: total, items: lines.length } });
});

app.get("/api/orders", requireLogin, (req, res) => {
  const isAdmin = req.session.level === 99;
  const sql = isAdmin
    ? "SELECT o.id, o.status, o.total, o.notes, o.created_at, o.whatsapp_sent_at," +
      "       u.username, u.full_name" +
      "  FROM orders o JOIN users u ON u.id = o.user_id" +
      "  ORDER BY o.created_at DESC LIMIT 200"
    : "SELECT o.id, o.status, o.total, o.notes, o.created_at, o.whatsapp_sent_at," +
      "       NULL AS username, NULL AS full_name" +
      "  FROM orders o WHERE o.user_id = ?" +
      "  ORDER BY o.created_at DESC LIMIT 200";
  res.json(isAdmin ? db.prepare(sql).all() : db.prepare(sql).all(req.session.userId));
});

app.get("/api/orders/:id", requireLogin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const isAdmin = req.session.level === 99;
  const orderSql = isAdmin
    ? "SELECT o.*, u.username, u.full_name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?"
    : "SELECT o.*, NULL AS username, NULL AS full_name FROM orders o WHERE o.id = ? AND o.user_id = ?";
  const order = isAdmin
    ? db.prepare(orderSql).get(id)
    : db.prepare(orderSql).get(id, req.session.userId);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  const items = db.prepare(
    "SELECT product_code, product_name, quantity, unit_price, subtotal" +
    "  FROM order_items WHERE order_id = ? ORDER BY id"
  ).all(id);
  res.json(Object.assign({}, order, { items: items }));
});

// ----- Cambio de estado (solo admin) -----
app.patch("/api/orders/:id", requireLogin, (req, res) => {
  if (req.session.level !== 99)
    return res.status(403).json({ error: "Solo el admin puede cambiar estados" });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const { status } = req.body || {};
  const valid = ["pendiente", "enviado", "preparando", "entregado", "cancelado"];
  if (!valid.includes(status))
    return res.status(400).json({ error: "Estado invalido. Valores: " + valid.join(", ") });
  const r = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  if (!r.changes) return res.status(404).json({ error: "Pedido no encontrado" });
  res.json({ ok: true, id: id, status: status });
});

// ===== Panel admin =====
app.get("/admin", requireAdmin, (req, res) => {
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
const VALID_LEVELS = [1, 2, 3, 4, 99];

function isValidUsername(s) {
  return typeof s === "string" && /^[a-z0-9_.-]{3,32}$/i.test(s);
}

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT id, username, full_name, phone, email, level, active, created_at, last_login_at" +
    "  FROM users ORDER BY level DESC, username"
  ).all();
  res.json(rows);
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  const b = req.body || {};
  const username = String(b.username || "").trim().toLowerCase();
  const password = String(b.password || "");
  const fullName = String(b.full_name || "").trim().slice(0, 120) || null;
  const phone    = String(b.phone || "").trim().slice(0, 40) || null;
  const email    = String(b.email || "").trim().slice(0, 120) || null;
  const level    = Number(b.level);

  if (!isValidUsername(username))
    return res.status(400).json({ error: "Usuario invalido (3-32 caracteres, letras/numeros/_-.)" });
  if (password.length < 6)
    return res.status(400).json({ error: "La contrasena debe tener al menos 6 caracteres" });
  if (!VALID_LEVELS.includes(level))
    return res.status(400).json({ error: "Nivel invalido. Valores: " + VALID_LEVELS.join(", ") });

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) return res.status(409).json({ error: "Ese usuario ya existe" });

  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare(
    "INSERT INTO users (username, password_hash, full_name, phone, email, level, active)" +
    " VALUES (?, ?, ?, ?, ?, ?, 1)"
  ).run(username, hash, fullName, phone, email, level);

  const user = db.prepare(
    "SELECT id, username, full_name, phone, email, level, active, created_at, last_login_at FROM users WHERE id = ?"
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
  if ("active" in b) {
    const act = b.active ? 1 : 0;
    if (id === req.session.userId && !act)
      return res.status(400).json({ error: "No podes desactivar tu propio usuario" });
    sets.push("active = ?");
    vals.push(act);
  }

  if (!sets.length) return res.status(400).json({ error: "Nada para actualizar" });
  vals.push(id);
  db.prepare("UPDATE users SET " + sets.join(", ") + " WHERE id = ?").run(...vals);
  const user = db.prepare(
    "SELECT id, username, full_name, phone, email, level, active, created_at, last_login_at FROM users WHERE id = ?"
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
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
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

app.get("/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));
// Servir imagenes de productos desde el volumen persistente (mismo dir que la DB)
app.use("/images/products", express.static(PRODUCT_IMAGES_DIR));
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use((req, res) => res.status(404).send("No encontrado"));

app.listen(PORT, () => {
  console.log("Maxaria escuchando en http://localhost:" + PORT + "  (" + NODE_ENV + ")");
});
