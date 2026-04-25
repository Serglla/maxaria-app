/**
 * Maxaria - servidor principal
 *
 * - Express + SQLite (better-sqlite3)
 * - Sesiones con express-session
 * - Auth por usuario/contraseña (bcrypt)
 * - 4 niveles de precio: minorista | revendedor | mayorista | vip (+ admin)
 *
 * Endpoints principales:
 *   GET  /                -> redirige a /catalogo si esta logueado, sino /login
 *   GET  /login           -> form de login
 *   POST /login           -> autentica
 *   POST /logout          -> cierra sesion
 *   GET  /catalogo        -> pagina del catalogo (requiere login)
 *   GET  /api/me          -> datos del usuario actual
 *   GET  /api/categories  -> lista de categorias
 *   GET  /api/products    -> lista de productos con el precio segun nivel
 */
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

// ----- env minimal (sin dependencias extra) -----
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

// ----- DB -----
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "maxaria.db");
if (!fs.existsSync(DB_PATH)) {
  console.error(
    "ERROR: no existe la base", DB_PATH,
    "\nCorré primero:  npm run seed"
  );
  process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ----- Session store en SQLite (simple, sin dependencia adicional) -----
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
    // Limpieza periodica
    setInterval(() => this.cleanStmt.run(Date.now()), 60 * 60 * 1000).unref();
  }
  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) return cb(null, null);
      if (row.expires < Date.now()) {
        this.delStmt.run(sid);
        return cb(null, null);
      }
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
    try { this.delStmt.run(sid); cb && cb(null); }
    catch (e) { cb && cb(e); }
  }
}

// ----- App -----
const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false, // simplificamos por ahora
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    store: new SqliteStore(db),
    secret: SESSION_SECRET,
    name: "maxaria.sid",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    },
  })
);

// ----- Helpers -----
function priceColumnFor(level) {
  switch (Number(level)) {
    case 1: return "price_minorista";
    case 2: return "price_revendedor";
    case 3: return "price_mayorista";
    case 4: return "price_vip";
    case 99: return "price_minorista"; // admin ve precios minoristas por default
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
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "No autenticado" });
    }
    return res.redirect("/login");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.level !== 99) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
}

// ----- Rutas auth -----
app.get("/login", (req, res) => {
  if (req.session && req.session.userId) return res.redirect("/catalogo");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  const user = db
    .prepare("SELECT id, username, password_hash, full_name, level, active FROM users WHERE username = ?")
    .get(String(username).trim().toLowerCase());

  if (!user || !user.active) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.level = user.level;
  req.session.fullName = user.full_name;

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      level: user.level,
      levelName: levelName(user.level),
    },
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("maxaria.sid");
    res.json({ ok: true });
  });
});

// ----- Rutas pagina -----
app.get("/", (req, res) => {
  if (req.session && req.session.userId) return res.redirect("/catalogo");
  res.redirect("/login");
});

app.get("/catalogo", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ----- API -----
app.get("/api/me", requireLogin, (req, res) => {
  res.json({
    id: req.session.userId,
    username: req.session.username,
    fullName: req.session.fullName,
    level: req.session.level,
    levelName: levelName(req.session.level),
    whatsapp: WHATSAPP_NUMBER || null,
  });
});

app.get("/api/categories", requireLogin, (req, res) => {
  const rows = db
    .prepare("SELECT id, name, icon_url FROM categories ORDER BY sort_order, name")
    .all();
  res.json(rows);
});

app.get("/api/products", requireLogin, (req, res) => {
  const col = priceColumnFor(req.session.level);
  // Solo productos activos y con stock > 0 (regla del negocio)
  const sql = `
    SELECT
      p.id,
      p.code,
      p.category_id,
      c.name AS category_name,
      p.name,
      p.image_url,
      p.${col} AS price,
      p.stock
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 AND p.stock > 0
    ORDER BY c.sort_order, c.name, p.name
  `;
  const rows = db.prepare(sql).all();
  res.json(rows);
});

// Health check (no requiere login)
app.get("/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Static (después de las rutas para que login.html y index.html los sirvamos a mano)
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// 404 final
app.use((req, res) => res.status(404).send("No encontrado"));

// ----- Start -----
app.listen(PORT, () => {
  console.log(`Maxaria escuchando en http://localhost:${PORT}  (${NODE_ENV})`);
});
