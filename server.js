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
if (!fs.existsSync(DB_PATH)) {
  console.error("ERROR: no existe la base", DB_PATH, "\nCorre primero:  npm run seed");
  process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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

app.get("/api/me", requireLogin, (req, res) => {
  res.json({
    id: req.session.userId, username: req.session.username,
    fullName: req.session.fullName, level: req.session.level,
    levelName: levelName(req.session.level), whatsapp: WHATSAPP_NUMBER || null,
  });
});

app.get("/api/categories", requireLogin, (req, res) => {
  res.json(db.prepare("SELECT id, name, icon_url FROM categories ORDER BY sort_order, name").all());
});

app.get("/api/products", requireLogin, (req, res) => {
  const col = priceColumnFor(req.session.level);
  const sql =
    "SELECT p.id, p.code, p.category_id, c.name AS category_name," +
    "       p.name, p.image_url, p." + col + " AS price, p.stock" +
    "  FROM products p LEFT JOIN categories c ON c.id = p.category_id" +
    "  WHERE p.active = 1 AND p.stock > 0" +
    "  ORDER BY c.sort_order, c.name, p.name";
  res.json(db.prepare(sql).all());
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

app.get("/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use((req, res) => res.status(404).send("No encontrado"));

app.listen(PORT, () => {
  console.log("Maxaria escuchando en http://localhost:" + PORT + "  (" + NODE_ENV + ")");
});
