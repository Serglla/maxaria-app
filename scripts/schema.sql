-- Schema de la base de datos Maxaria
-- 4 niveles de precio: 1=minorista, 2=revendedor, 3=mayorista, 4=vip
-- Codigo interno = clave usada para sincronizar con el Excel

CREATE TABLE IF NOT EXISTS categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  icon_url     TEXT,
  sort_order   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  code                TEXT UNIQUE,
  category_id         INTEGER REFERENCES categories(id),
  name                TEXT NOT NULL,
  description         TEXT,
  image_url           TEXT,
  cost                INTEGER NOT NULL DEFAULT 0,
  price_minorista     INTEGER NOT NULL DEFAULT 0,
  price_revendedor    INTEGER NOT NULL DEFAULT 0,
  price_mayorista     INTEGER NOT NULL DEFAULT 0,
  price_vip           INTEGER NOT NULL DEFAULT 0,
  price_publico       INTEGER NOT NULL DEFAULT 0,
  stock               INTEGER NOT NULL DEFAULT 0,
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_code     ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_stock    ON products(stock);
CREATE INDEX IF NOT EXISTS idx_products_name     ON products(name);

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT,
  phone           TEXT,
  email           TEXT,
  level           INTEGER NOT NULL DEFAULT 1,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'pendiente',
  total       INTEGER NOT NULL,
  notes       TEXT,
  whatsapp_sent_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  product_code TEXT,
  product_name TEXT NOT NULL,
  quantity     INTEGER NOT NULL,
  unit_price   INTEGER NOT NULL,
  subtotal     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS sessions (
  sid       TEXT PRIMARY KEY,
  data      TEXT NOT NULL,
  expires   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);

-- Configuracion runtime editable desde el admin (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cabecera de cada importacion de precios (un Excel subido = un update).
-- Se usa para mostrar a los clientes los cambios de la ULTIMA actualizacion.
CREATE TABLE IF NOT EXISTS price_updates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  source          TEXT,
  rows_total      INTEGER NOT NULL DEFAULT 0,
  products_changed INTEGER NOT NULL DEFAULT 0,
  products_new    INTEGER NOT NULL DEFAULT 0
);

-- Detalle de cambios por producto en cada update. Una fila por
-- producto que cambio (precio o nuevo) en ese update. Guardamos
-- old/new para los 4 niveles asi al reimportar podemos calcular
-- el % de aumento o baja con la base anterior, sin depender del
-- nivel del cliente al momento del import.
CREATE TABLE IF NOT EXISTS price_changes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id         INTEGER NOT NULL REFERENCES price_updates(id) ON DELETE CASCADE,
  product_id        INTEGER REFERENCES products(id),
  code              TEXT,
  name              TEXT,
  is_new            INTEGER NOT NULL DEFAULT 0,
  old_minorista     INTEGER,
  new_minorista     INTEGER,
  old_revendedor    INTEGER,
  new_revendedor    INTEGER,
  old_mayorista     INTEGER,
  new_mayorista     INTEGER,
  old_vip           INTEGER,
  new_vip           INTEGER
);

CREATE INDEX IF NOT EXISTS idx_price_changes_update ON price_changes(update_id);
CREATE INDEX IF NOT EXISTS idx_price_changes_product ON price_changes(product_id);
