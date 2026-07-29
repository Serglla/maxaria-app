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
const PDFDocument = require("pdfkit");

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
const NODE_ENV = process.env.NODE_ENV || "development";

// SESSION_SECRET: requerido en produccion. Si no esta seteado o es uno de los
// valores de ejemplo conocidos, abortamos el arranque para evitar que el server
// firme cookies con un secreto predecible (cualquiera podria forjar sesiones).
// En desarrollo permitimos un fallback pero mostramos warning bien visible.
const INSECURE_SECRETS = new Set([
  "dev-secret-cambiame",
  "cambiar-esto-por-algo-largo-y-aleatorio",
]);
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || INSECURE_SECRETS.has(SESSION_SECRET)) {
  if (NODE_ENV === "production") {
    console.error("");
    console.error("!".repeat(60));
    console.error("!! FATAL: SESSION_SECRET no configurada o con valor de ejemplo.");
    console.error("!! En produccion es obligatoria una clave aleatoria fuerte.");
    console.error("!! Genera una con:");
    console.error("!!   node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    console.error("!! y configurala como variable de entorno SESSION_SECRET.");
    console.error("!".repeat(60));
    console.error("");
    process.exit(1);
  }
  console.warn("");
  console.warn("[server] WARNING: SESSION_SECRET no configurada — usando fallback de desarrollo.");
  console.warn("[server] No deployes asi: en produccion el server abortara.");
  console.warn("");
  SESSION_SECRET = "dev-secret-cambiame";
}
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

// Migracion: snapshot del precio PUBLICO en el historial de cambios. Antes
// publico no se historizaba y las listas con base "publico" mostraban los
// numeros de minorista en "Ver cambios". Las filas anteriores a esta migracion
// quedan en NULL (el drawer las muestra sin precio viejo).
try { db.exec("ALTER TABLE price_changes ADD COLUMN old_publico REAL"); } catch (_) {}
try { db.exec("ALTER TABLE price_changes ADD COLUMN new_publico REAL"); } catch (_) {}

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

// Migracion: Superadmin + usuarios privilegiados con permisos por seccion.
// - users.is_superadmin: 1 = superadmin (acceso total + unico que gestiona admins).
// - users.admin_sections: CSV de claves de seccion del panel que puede usar un
//   admin (level 99) que NO es superadmin. NULL/'' = ninguna. El superadmin lo ignora.
// Bootstrap idempotente: si todavia no hay ningun superadmin, se marca al admin
// original (menor id con level 99) como superadmin una sola vez.
try { db.exec("ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN admin_sections TEXT"); } catch (_) {}
try {
  db.exec(
    "UPDATE users SET is_superadmin = 1" +
    " WHERE id = (SELECT MIN(id) FROM users WHERE level = 99)" +
    "   AND NOT EXISTS (SELECT 1 FROM users WHERE is_superadmin = 1)"
  );
} catch (_) {}

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
// Migracion: listas encadenadas. Una lista puede basarse en OTRA lista en vez
// de un nivel base (ej: "SuperVip" = lista "Vip" con -2% de ganancia).
// Si base_list_id es NULL, la lista se basa en base_level como siempre.
// El % efectivo se combina multiplicando divisores: (1 - m1/100) * (1 - m2/100) * ...
try { db.exec("ALTER TABLE price_lists ADD COLUMN base_list_id INTEGER REFERENCES price_lists(id)"); } catch (_) {}
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

// Cuenta corriente de PROVEEDORES (espejo de la de clientes, signo invertido):
// cada compra genera un 'debit' (le debemos al proveedor) y cada pago un 'credit'.
// Deuda = SUM(debit) - SUM(credit) (positivo = le debemos).
db.exec(
  "CREATE TABLE IF NOT EXISTS supplier_payments (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  supplier_id INTEGER NOT NULL REFERENCES suppliers(id)," +
  "  amount REAL NOT NULL," +
  "  method TEXT NOT NULL DEFAULT 'efectivo'," +
  "  reference TEXT," +
  "  notes TEXT," +
  "  caja_id INTEGER REFERENCES cash_accounts(id)," +
  "  registered_by INTEGER REFERENCES users(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_sup_pay_supplier ON supplier_payments(supplier_id);" +
  "CREATE TABLE IF NOT EXISTS supplier_movements (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  supplier_id INTEGER NOT NULL REFERENCES suppliers(id)," +
  "  type TEXT NOT NULL CHECK(type IN ('debit','credit'))," +
  "  amount REAL NOT NULL," +
  "  description TEXT," +
  "  purchase_order_id INTEGER REFERENCES purchase_orders(id)," +
  "  supplier_payment_id INTEGER REFERENCES supplier_payments(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_sm_supplier ON supplier_movements(supplier_id);"
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

// Migracion: Descuento del pedido (aplicado al entregar, solo admin).
// - discount_type: 'percent' | 'fixed' | NULL (sin descuento)
// - discount_value: el numero ingresado (ej: 10 para 10%, o 5000 para $5000)
// - discount_amount: el descuento resuelto en pesos (lo que efectivamente baja
//   del total). El total NETO que el cliente debe = orders.total - discount_amount.
//   En cuenta corriente, el descuento se registra como un credito "Descuento
//   pedido #id" para no tocar el debito original (auditable y reversible).
try { db.exec("ALTER TABLE orders ADD COLUMN discount_type TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE orders ADD COLUMN discount_value REAL"); } catch (_) {}
try { db.exec("ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0"); } catch (_) {}

// Migracion: Circuito de pedidos (Pedidos -> Armado -> Entregas -> Entregado).
// - orders.notified_status: ultimo estado del que se le notifico al cliente.
//   Sirve para avisarle al ingresar al catalogo cuando su pedido avanza a
//   "preparando" (en armado), "listo" (listo para entregar) o "entregado".
//   NULL = todavia no se le notifico de ningun estado.
// El UPDATE inicializa los pedidos ya existentes con su estado actual para que
// la primera carga despues del deploy NO dispare notificaciones retroactivas
// (solo los cambios futuros notifican). Corre una sola vez: en boots siguientes
// el ALTER lanza (la columna ya existe) y el catch evita re-ejecutar el UPDATE.
try {
  db.exec("ALTER TABLE orders ADD COLUMN notified_status TEXT");
  db.exec("UPDATE orders SET notified_status = status");
} catch (_) {}

// Migracion: Chequeo de armado (checklist de picking por item del pedido).
// - order_items.picked_qty: cantidad ya armada/juntada del item (0 = sin armar).
// - picked_by / picked_at: quien y cuando lo tildo por ultima vez (auditoria).
// Sincronizacion multi-dispositivo: los armadores postean a /api/admin/picks
// y el modal hace polling del GET; ultima escritura gana.
try { db.exec("ALTER TABLE order_items ADD COLUMN picked_qty REAL NOT NULL DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE order_items ADD COLUMN picked_by INTEGER"); } catch (_) {}
try { db.exec("ALTER TABLE order_items ADD COLUMN picked_at TEXT"); } catch (_) {}
// - order_items.pick_checked: 1 = item CONTROLADO en el chequeo (la cantidad
//   armada puede ser 0 = "no hay stock", o mayor a la pedida = "redondeo de
//   caja"). 0 = todavia sin controlar. Antes "controlado" se infería de
//   picked_qty > 0, lo que impedia controlar un item en 0; el UPDATE corre una
//   sola vez (cuando el ALTER tiene exito) para marcar lo ya tildado.
try {
  db.exec("ALTER TABLE order_items ADD COLUMN pick_checked INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE order_items SET pick_checked = 1 WHERE COALESCE(picked_qty,0) > 0");
} catch (_) {}
// - order_items.discount_percent: descuento por linea (0..100). unit_price queda
//   como el precio de lista (bruto) y subtotal = round2(unit_price*qty*(1-d/100)).
//   El descuento "general" del pedido se reparte como un % uniforme en cada linea
//   (se guarda igual por linea). El descuento TOTAL del pedido = Σ unit_price*qty − Σ subtotal.
//   Es independiente del descuento de entrega/cobro (orders.discount_*).
try { db.exec("ALTER TABLE order_items ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0"); } catch (_) {}
// Registro de los cambios confirmados del chequeo de armado: cada vez que el
// armador confirma el chequeo y hay diferencias (cantidad distinta a la pedida
// o item quitado por falta de stock), queda una fila por item. Se muestran en
// el detalle del pedido (admin y cliente) y en la notificacion del catalogo.
db.exec(
  "CREATE TABLE IF NOT EXISTS pick_changes (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  order_id INTEGER NOT NULL," +
  "  product_code TEXT," +
  "  product_name TEXT," +
  "  old_qty REAL NOT NULL," +
  "  new_qty REAL NOT NULL," +
  "  changed_by INTEGER," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ")"
);
db.exec("CREATE INDEX IF NOT EXISTS idx_pick_changes_order ON pick_changes(order_id)");

// Migracion: Control de recepcion de mercaderia (pestaña Recepcion).
// - purchase_items.checked_qty: cantidad contada al recibir la compra.
//   NULL = item sin controlar; 0 es valido ("no llego nada de este item").
// - checked_by / checked_at: quien y cuando lo conto por ultima vez.
// Mismo esquema de sync multi-dispositivo que el chequeo de armado: POST por
// item + polling del GET (ultima escritura gana).
try { db.exec("ALTER TABLE purchase_items ADD COLUMN checked_qty REAL"); } catch (_) {}
try { db.exec("ALTER TABLE purchase_items ADD COLUMN checked_by INTEGER"); } catch (_) {}
try { db.exec("ALTER TABLE purchase_items ADD COLUMN checked_at TEXT"); } catch (_) {}

// Migracion: vencimiento de mercaderia.
// - purchase_items.expiry_date: vencimiento del lote recibido, normalizado a
//   'YYYY-MM' (en la UI se carga/ muestra como MM/AA, ej: 08/28). NULL = sin
//   vencimiento (productos que no vencen).
// - products.expiry_alert_months: cuantos meses ANTES del vencimiento se empieza
//   a avisar. Configurable por producto en su panel de edicion; default 3.
try { db.exec("ALTER TABLE purchase_items ADD COLUMN expiry_date TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE products ADD COLUMN expiry_alert_months INTEGER NOT NULL DEFAULT 3"); } catch (_) {}

// Migracion: la compra ya NO impacta el stock al cargarse. El stock entra
// recien al CONFIRMAR la recepcion (el costo, los precios de venta y la deuda
// del proveedor SI se actualizan al cargar la compra, como antes).
// - purchase_orders.received: 0 = pendiente de recibir (sin stock sumado),
//   1 = recibida (stock ya impactado).
// Las compras existentes ya habian sumado stock con el modelo viejo, asi que
// el UPDATE las marca recibidas una sola vez (en boots siguientes el ALTER
// lanza y el catch evita re-ejecutar; las compras nuevas arrancan en 0).
try {
  db.exec("ALTER TABLE purchase_orders ADD COLUMN received INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE purchase_orders SET received = 1");
} catch (_) {}

// Migracion: Presupuestos / Ventas.
// - budgets: cabecera del presupuesto (cliente, vendedor, totales, estado).
// - budget_items: lineas del presupuesto (producto, cantidad, precio, descuento).
// El numero de presupuesto se genera automaticamente con formato NNNN-XXXXXXXX.
db.exec(
  "CREATE TABLE IF NOT EXISTS budgets (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  number TEXT UNIQUE NOT NULL," +
  "  client_id INTEGER REFERENCES users(id)," +
  "  client_name TEXT NOT NULL DEFAULT 'Consumidor final'," +
  "  vendedor_id INTEGER REFERENCES users(id)," +
  "  payment_method TEXT NOT NULL DEFAULT 'Efectivo'," +
  "  currency TEXT NOT NULL DEFAULT 'ARS'," +
  "  discount_percent REAL NOT NULL DEFAULT 0," +
  "  surcharge_percent REAL NOT NULL DEFAULT 0," +
  "  subtotal INTEGER NOT NULL DEFAULT 0," +
  "  total INTEGER NOT NULL DEFAULT 0," +
  "  notes TEXT," +
  "  status TEXT NOT NULL DEFAULT 'borrador'," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))," +
  "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_budgets_client   ON budgets(client_id);" +
  "CREATE INDEX IF NOT EXISTS idx_budgets_vendedor ON budgets(vendedor_id);" +
  "CREATE INDEX IF NOT EXISTS idx_budgets_status   ON budgets(status);" +
  "CREATE TABLE IF NOT EXISTS budget_items (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE," +
  "  product_id INTEGER REFERENCES products(id)," +
  "  product_code TEXT NOT NULL DEFAULT ''," +
  "  product_name TEXT NOT NULL DEFAULT ''," +
  "  quantity REAL NOT NULL DEFAULT 1," +
  "  unit_price INTEGER NOT NULL DEFAULT 0," +
  "  discount_percent REAL NOT NULL DEFAULT 0," +
  "  subtotal INTEGER NOT NULL DEFAULT 0" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_bi_budget ON budget_items(budget_id);"
);

// Migracion idempotente: al facturar un presupuesto se crea una order y se
// guarda su id aca para trazabilidad. NULL = todavia no facturado.
try { db.exec("ALTER TABLE budgets ADD COLUMN order_id INTEGER REFERENCES orders(id)"); } catch (_) {}
// Indica si el presupuesto ya descontó stock (al crearse). Evita doble descuento
// en facturar/entregar y permite devolver el stock si se cancela.
try { db.exec("ALTER TABLE budgets ADD COLUMN stock_discounted INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
// Base de precios elegida al armar el presupuesto: "base:<nivel>" (minorista,
// revendedor, mayorista, vip, publico) o "list:<id>" (lista personalizada).
// Sirve para reabrir el presupuesto mostrando la lista usada y poder recalcular.
// NULL = presupuestos viejos (se infiere del cliente al abrir).
try { db.exec("ALTER TABLE budgets ADD COLUMN price_basis TEXT"); } catch (_) {}

// Migracion: stock minimo por producto (0 = sin alerta)
try { db.exec("ALTER TABLE products ADD COLUMN stock_min INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
// Unidades por empaque de compra: cuantas unidades de venta componen el empaque
// en que el proveedor cotiza/pide el producto. 1 = se compra unitario.
// (Historicamente "por bulto"; el empaque real lo define pack_unit.)
try { db.exec("ALTER TABLE products ADD COLUMN units_per_bulto INTEGER NOT NULL DEFAULT 1"); } catch (_) {}
// Empaque en que el proveedor cotiza/pide el producto: 'unidad' | 'caja' | 'bulto'.
// units_per_bulto = unidades por ese empaque (ej. Migral: pack_unit='caja', 10 u/caja).
try { db.exec("ALTER TABLE products ADD COLUMN pack_unit TEXT NOT NULL DEFAULT 'bulto'"); } catch (_) {}
// Precio cotizado en pedidos de cotizacion (lo que responde el proveedor)
try { db.exec("ALTER TABLE purchase_request_items ADD COLUMN unit_price INTEGER"); } catch (_) {}
// Modo de empaque elegido en la cotizacion (por item, no se persiste en el producto):
// 'unidad' | 'caja' | 'bulto' | 'comprimido'. NULL = legacy (cae al pack del producto).
try { db.exec("ALTER TABLE purchase_request_items ADD COLUMN pack_mode TEXT"); } catch (_) {}
// Comprimidos por tableta usados cuando pack_mode='comprimido' (override del nombre).
try { db.exec("ALTER TABLE purchase_request_items ADD COLUMN comprimidos_per_unit INTEGER"); } catch (_) {}
// Visibilidad GLOBAL de la categoria en el catalogo (se maneja desde
// Configuracion). 0 = nadie la ve (clientes ni vendedores) hasta reactivarla.
// Es independiente de user_category_access: activar una categoria global NO
// se la muestra a un usuario que la tiene restringida por su propia config.
try { db.exec("ALTER TABLE categories ADD COLUMN active INTEGER NOT NULL DEFAULT 1"); } catch (_) {}

// Migracion: Gastos generales del negocio (transporte, alquiler, servicios,
// impuestos, etc). Distinto de purchase_orders (que son compras de mercaderia
// que ademas suman stock). Estos gastos solo afectan el flujo de caja y el
// resumen mensual.
// - expense_categories: catalogo editable de categorias. Seed con las clasicas.
// - expenses: registro de cada gasto con monto, fecha, categoria, metodo de
//   pago, descripcion y notas. Conservamos category_name como snapshot para que
//   si se renombra/borra la categoria los gastos historicos sigan siendo legibles.
db.exec(
  "CREATE TABLE IF NOT EXISTS expense_categories (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  name TEXT UNIQUE NOT NULL," +
  "  active INTEGER NOT NULL DEFAULT 1," +
  "  sort_order INTEGER NOT NULL DEFAULT 0," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE TABLE IF NOT EXISTS expenses (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  expense_category_id INTEGER REFERENCES expense_categories(id)," +
  "  category_name TEXT NOT NULL DEFAULT 'Otros'," +
  "  amount REAL NOT NULL," +
  "  description TEXT," +
  "  payment_method TEXT NOT NULL DEFAULT 'efectivo'," +
  "  reference TEXT," +
  "  notes TEXT," +
  "  expense_date TEXT NOT NULL DEFAULT (date('now'))," +
  "  registered_by INTEGER REFERENCES users(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);" +
  "CREATE INDEX IF NOT EXISTS idx_expenses_cat ON expenses(expense_category_id);"
);

// Seed de categorias clasicas si la tabla esta vacia. Se ejecuta solo la
// primera vez; despues el admin puede agregar/editar/borrar libremente.
(function seedExpenseCategories() {
  const row = db.prepare("SELECT COUNT(*) AS n FROM expense_categories").get();
  if (row && row.n > 0) return;
  const defaults = [
    "Transporte", "Flete", "Envíos", "Combustible",
    "Alquiler", "Servicios", "Luz", "Agua", "Gas", "Internet", "Teléfono",
    "Impuestos", "Sueldos", "Honorarios", "Mantenimiento",
    "Insumos de oficina", "Limpieza", "Comisiones bancarias",
    "Publicidad", "Otros",
  ];
  const ins = db.prepare("INSERT INTO expense_categories (name, sort_order) VALUES (?, ?)");
  const tx = db.transaction(() => {
    defaults.forEach((name, i) => { ins.run(name, i); });
  });
  tx();
})();

// ─── Ajustes de stock ────────────────────────────────────────────────────────
db.exec(
  "CREATE TABLE IF NOT EXISTS stock_adjustments (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  product_id INTEGER REFERENCES products(id)," +
  "  product_code TEXT NOT NULL DEFAULT ''," +
  "  product_name TEXT NOT NULL DEFAULT ''," +
  "  type TEXT NOT NULL DEFAULT 'ajuste'," + // ajuste|inventario|merma|devolucion
  "  qty_before INTEGER NOT NULL DEFAULT 0," +
  "  qty_change INTEGER NOT NULL DEFAULT 0," +  // positivo o negativo
  "  qty_after INTEGER NOT NULL DEFAULT 0," +
  "  reason TEXT," +
  "  registered_by INTEGER REFERENCES users(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments(product_id);" +
  "CREATE INDEX IF NOT EXISTS idx_stock_adj_date ON stock_adjustments(created_at);"
);

// Migracion: historial de cambios de COSTO (reporte de inflacion, solo superadmin).
// Cada vez que cambia products.cost (compra, edicion manual o import Excel) se
// registra una fila con el stock que habia EN ESE MOMENTO (antes de sumar las
// unidades de la compra, si vino de una compra). Con eso:
//   - revalorizacion del stock = stock_at_change * (new_cost - old_cost)
//     (lo que "ganaste" por tener mercaderia comprada al costo viejo)
//   - perdida por reposicion   = unidades vendidas desde el cambio ANTERIOR
//     * (new_cost - old_cost)  (lo vendido a precios basados en el costo viejo
//     cuesta delta mas reponerlo). Se calcula en el endpoint del reporte.
// Solo se mide hacia adelante (decision de Sergio, 9 jun 2026): no se
// reconstruye historial previo al deploy.
db.exec(
  "CREATE TABLE IF NOT EXISTS cost_changes (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  product_id INTEGER NOT NULL REFERENCES products(id)," +
  "  old_cost REAL NOT NULL DEFAULT 0," +
  "  new_cost REAL NOT NULL DEFAULT 0," +
  "  stock_at_change INTEGER NOT NULL DEFAULT 0," +
  "  source TEXT NOT NULL DEFAULT 'manual'," + // compra|manual|excel
  "  source_id INTEGER," + // purchase_order_id (compra) o price_updates.id (excel)
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_cost_changes_product ON cost_changes(product_id);" +
  "CREATE INDEX IF NOT EXISTS idx_cost_changes_date ON cost_changes(created_at);"
);

// Registra un cambio de costo si old != new. stockOverride permite pasar el
// stock "antes" cuando el caller ya lo conoce; si no, se lee el actual.
function logCostChange(productId, oldCost, newCost, source, sourceId, stockOverride) {
  const o = Number(oldCost) || 0;
  const n = Number(newCost) || 0;
  if (!productId || o === n) return;
  let stock = stockOverride;
  if (stock == null) {
    const row = db.prepare("SELECT stock FROM products WHERE id = ?").get(productId);
    stock = row ? Number(row.stock) || 0 : 0;
  }
  db.prepare(
    "INSERT INTO cost_changes (product_id, old_cost, new_cost, stock_at_change, source, source_id)" +
    " VALUES (?, ?, ?, ?, ?, ?)"
  ).run(productId, o, n, Math.max(0, Math.floor(Number(stock) || 0)), String(source || "manual"), sourceId || null);
}

// Historial unificado de movimientos de stock por producto (10 jun request de
// Sergio: poder ver cuando se hizo una compra, cuando aumento el stock, y si
// fue manual o por ingreso de compra). No reemplaza stock_adjustments (que
// sigue siendo la fuente de los ajustes manuales) ni cost_changes (costo) —
// es un LOG adicional, un renglon por cada vez que products.stock cambia,
// con el tipo de origen. Se llama DESPUES de cada UPDATE de stock: lee el
// stock ya actualizado (qty_after) y calcula qty_before = qty_after - delta.
db.exec(
  "CREATE TABLE IF NOT EXISTS stock_movements (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  product_id INTEGER NOT NULL REFERENCES products(id)," +
  "  type TEXT NOT NULL," + // compra|ajuste|venta|entrega|cancelacion|edicion_pedido|armado|recepcion|presupuesto|compra_eliminada
  "  delta INTEGER NOT NULL DEFAULT 0," + // positivo o negativo
  "  qty_before INTEGER NOT NULL DEFAULT 0," +
  "  qty_after INTEGER NOT NULL DEFAULT 0," +
  "  source_id INTEGER," + // id de la compra/pedido/presupuesto/ajuste segun corresponda
  "  note TEXT," +
  "  registered_by INTEGER REFERENCES users(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_stock_mov_product ON stock_movements(product_id);" +
  "CREATE INDEX IF NOT EXISTS idx_stock_mov_date ON stock_movements(created_at);"
);

// Registra un movimiento de stock. Llamar DESPUES de aplicar el UPDATE de
// products.stock correspondiente (lee el stock ya actualizado como qty_after).
// delta = 0 no se loguea (no hubo cambio real).
function logStockMovement(productId, type, delta, sourceId, note, userId) {
  const d = Math.round(Number(delta) || 0);
  if (!productId || !d) return;
  const row = db.prepare("SELECT stock FROM products WHERE id = ?").get(productId);
  const qtyAfter = row ? Math.round(Number(row.stock) || 0) : 0;
  const qtyBefore = qtyAfter - d;
  db.prepare(
    "INSERT INTO stock_movements (product_id, type, delta, qty_before, qty_after, source_id, note, registered_by)" +
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(productId, String(type || "otro"), d, qtyBefore, qtyAfter, sourceId || null, note || null, userId || null);
}

// ─── Pedidos de cotizacion ────────────────────────────────────────────────────
db.exec(
  "CREATE TABLE IF NOT EXISTS purchase_requests (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  supplier_id INTEGER REFERENCES suppliers(id)," +
  "  notes TEXT," +
  "  status TEXT NOT NULL DEFAULT 'borrador'," +
  "  created_by INTEGER REFERENCES users(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE TABLE IF NOT EXISTS purchase_request_items (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE," +
  "  product_id INTEGER REFERENCES products(id)," +
  "  product_code TEXT NOT NULL DEFAULT ''," +
  "  product_name TEXT NOT NULL DEFAULT ''," +
  "  quantity INTEGER NOT NULL DEFAULT 1" +
  ");"
);

// ─── Caja: cuentas y movimientos ─────────────────────────────────────────────
db.exec(
  "CREATE TABLE IF NOT EXISTS cash_accounts (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  name TEXT UNIQUE NOT NULL," +
  "  type TEXT NOT NULL DEFAULT 'efectivo'," +  // efectivo|banco|digital
  "  active INTEGER NOT NULL DEFAULT 1," +
  "  sort_order INTEGER NOT NULL DEFAULT 0," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE TABLE IF NOT EXISTS cash_movements (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  account_id INTEGER NOT NULL REFERENCES cash_accounts(id)," +
  "  type TEXT NOT NULL DEFAULT 'ingreso'," +  // ingreso|egreso
  "  amount REAL NOT NULL," +
  "  description TEXT," +
  "  source TEXT NOT NULL DEFAULT 'manual'," + // manual|cobro|gasto|compra|transferencia
  "  related_id INTEGER," +                    // id del pago/gasto/compra vinculado
  "  counterpart_account_id INTEGER REFERENCES cash_accounts(id)," + // transferencias
  "  movement_date TEXT NOT NULL DEFAULT (date('now'))," +
  "  registered_by INTEGER REFERENCES users(id)," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_cash_mov_account ON cash_movements(account_id);" +
  "CREATE INDEX IF NOT EXISTS idx_cash_mov_date ON cash_movements(movement_date);"
);

// Seed: crear cuentas default si la tabla esta vacia
(function seedCashAccounts() {
  const row = db.prepare("SELECT COUNT(*) AS n FROM cash_accounts").get();
  if (row && row.n > 0) return;
  const defaults = [
    { name: "Caja efectivo", type: "efectivo", sort_order: 0 },
    { name: "Banco",         type: "banco",    sort_order: 1 },
    { name: "Billeteras",    type: "digital",  sort_order: 2 },
  ];
  const ins = db.prepare("INSERT INTO cash_accounts (name, type, sort_order) VALUES (?,?,?)");
  db.transaction(() => defaults.forEach((r) => ins.run(r.name, r.type, r.sort_order)))();
})();

// ── Migraciones idempotentes: caja por persona (cajero) ──
// Cada caja de efectivo puede tener un responsable (cajero = vendedor level 5 o admin).
try { db.exec("ALTER TABLE cash_accounts ADD COLUMN responsable_user_id INTEGER REFERENCES users(id)"); } catch (_) {}
// Cada cobro (pago de cuenta corriente o entrega) imputa a una caja.
try { db.exec("ALTER TABLE payments ADD COLUMN caja_id INTEGER REFERENCES cash_accounts(id)"); } catch (_) {}
// En entregas el cobro puede partirse: efectivo a una caja (caja_id) y
// transferencia a otra (caja_transfer_id, ej. billeteras del cajero).
try { db.exec("ALTER TABLE deliveries ADD COLUMN caja_id INTEGER REFERENCES cash_accounts(id)"); } catch (_) {}
try { db.exec("ALTER TABLE deliveries ADD COLUMN caja_transfer_id INTEGER REFERENCES cash_accounts(id)"); } catch (_) {}
// Un pago puede imputarse a un pedido puntual (cobro de un pedido ya entregado).
// El vínculo real para el saldo del pedido vive en account_movements.order_id;
// esta columna es solo para mostrar en el listado de Pagos a qué pedido fue.
try { db.exec("ALTER TABLE payments ADD COLUMN order_id INTEGER REFERENCES orders(id)"); } catch (_) {}
// Cada gasto sale de una caja (egreso en cash_movements, source 'gasto').
// NULL = gastos historicos anteriores a esta migracion (sin imputar).
try { db.exec("ALTER TABLE expenses ADD COLUMN caja_id INTEGER REFERENCES cash_accounts(id)"); } catch (_) {}
// Renombrar la cuenta "Mercado Pago" -> "Billeteras" en instancias ya existentes
// (solo si no hay ya una "Billeteras", para no chocar con el UNIQUE de name).
try {
  const hasBill = db.prepare("SELECT id FROM cash_accounts WHERE name = 'Billeteras'").get();
  if (!hasBill) {
    db.prepare("UPDATE cash_accounts SET name = 'Billeteras' WHERE name = 'Mercado Pago'").run();
  }
} catch (_) {}

// Migracion: limite de credito por cliente.
// 0 = sin limite. Cuando el saldo negativo del cliente (lo que debe) supera
// este valor, se muestra una alerta en Cuentas corrientes. Editable inline
// desde la pestaña Cuentas o desde Usuarios.
try { db.exec("ALTER TABLE users ADD COLUMN credit_limit INTEGER NOT NULL DEFAULT 0"); } catch (_) {}

// Migracion: registro de actividad de usuarios (logins y eventos clave).
// event: 'login' | 'logout' | 'catalogo' | 'pedido' | 'cambios'
// Se usa sobre todo para clientes (level 1-4): saber si entran, cuando y que hacen.
db.exec(
  "CREATE TABLE IF NOT EXISTS activity_log (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  user_id INTEGER REFERENCES users(id)," +
  "  username TEXT," +
  "  event TEXT NOT NULL," +
  "  detail TEXT," +
  "  ip TEXT," +
  "  user_agent TEXT," +
  "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ")"
);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at)"); } catch (_) {}

// Registra un evento de actividad del usuario logueado. Nunca tira (best-effort).
function logActivity(req, event, detail) {
  try {
    if (!req || !req.session || !req.session.userId) return;
    var ipRaw = (req.headers && req.headers["x-forwarded-for"]) || "";
    var ip = String(ipRaw).split(",")[0].trim() ||
             (req.ip || (req.socket && req.socket.remoteAddress) || null);
    var ua = ((req.headers && req.headers["user-agent"]) || "").slice(0, 300) || null;
    db.prepare(
      "INSERT INTO activity_log (user_id, username, event, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(req.session.userId, req.session.username || null, event, detail || null, ip, ua);
  } catch (_) {}
}

// Helper: genera el proximo numero de presupuesto en formato 0001-00000001.
function nextBudgetNumber() {
  const row = db.prepare(
    "SELECT number FROM budgets ORDER BY id DESC LIMIT 1"
  ).get();
  if (!row) return "0001-00000001";
  const seq = parseInt(row.number.split("-")[1] || "0", 10) + 1;
  return "0001-" + String(seq).padStart(8, "0");
}

// Backfill: crear presupuestos para pedidos que llegaron por carrito/WhatsApp
// antes de que existiera la auto-creacion de budget en POST /api/orders.
// Idempotente: solo toca ordenes sin budget vinculado. Se ejecuta en cada
// arranque pero normalmente no hace nada tras la primera ejecucion.
(function backfillOrderBudgets() {
  try {
    const orders = db.prepare(
      "SELECT o.id, o.user_id, o.total, o.notes, o.status," +
      "       o.assigned_vendedor_id, o.created_at," +
      "       u.full_name, u.username" +
      "  FROM orders o" +
      "  JOIN users u ON u.id = o.user_id" +
      "  WHERE NOT EXISTS (SELECT 1 FROM budgets b WHERE b.order_id = o.id)" +
      "  AND COALESCE(o.is_unified, 0) = 0" +
      "  ORDER BY o.id ASC"
    ).all();
    if (!orders.length) return;
    const insBI = db.prepare(
      "INSERT INTO budget_items (budget_id, product_id, product_code, product_name," +
      "  quantity, unit_price, discount_percent, subtotal) VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
    );
    const tx = db.transaction(() => {
      for (const order of orders) {
        const items = db.prepare(
          "SELECT product_id, product_code, product_name, quantity, unit_price, subtotal" +
          "  FROM order_items WHERE order_id = ?"
        ).all(order.id);
        const clientName = order.full_name || order.username || "Consumidor final";
        const budgetStatus = order.status === "cancelado" ? "cancelado" : "enviado";
        const bNum = nextBudgetNumber();
        const bRes = db.prepare(
          "INSERT INTO budgets (number, client_id, client_name, vendedor_id, payment_method, currency," +
          "  discount_percent, surcharge_percent, subtotal, total, notes, status, order_id," +
          "  created_at, updated_at)" +
          "  VALUES (?, ?, ?, ?, 'Efectivo', 'ARS', 0, 0, ?, ?, ?, ?, ?, ?, ?)"
        ).run(bNum, order.user_id, clientName, order.assigned_vendedor_id || null,
              order.total, order.total, order.notes || null, budgetStatus, order.id,
              order.created_at, order.created_at);
        const budgetId = bRes.lastInsertRowid;
        for (const it of items) {
          insBI.run(budgetId, it.product_id, it.product_code, it.product_name,
                    it.quantity, it.unit_price, it.subtotal);
        }
      }
    });
    tx();
    console.log("[backfill] creados " + orders.length + " presupuesto(s) para pedidos existentes");
  } catch (e) {
    console.error("[backfill] error migrando pedidos a presupuestos:", e.message);
  }
})();

// Backfill idempotente de débitos de cuenta corriente para pedidos ENTREGADOS de
// clientes reales (level 1..4), no unificados, que quedaron SIN débito (creados
// por versiones que no debitaban al entregar/crear). Sin esto el saldo del pedido
// vive solo en el respaldo (total − cobrado en la entrega) y un cobro posterior no
// lo baja. Se reconstruye también el crédito del cobro de la entrega y el del
// descuento, para que el saldo resultante sea EXACTAMENTE el que ya se mostraba
// (no cambia ningún "Debe/Saldado", solo mueve la fuente de verdad a la cuenta
// corriente). Idempotente: solo toca pedidos sin débito.
(function backfillOrderDebits() {
  try {
    const orphans = db.prepare(
      "SELECT o.id, o.user_id, o.total, COALESCE(o.discount_amount,0) AS discount_amount," +
      "       (SELECT COALESCE(SUM(d.efectivo_amount + d.transferencia_amount),0)" +
      "          FROM deliveries d WHERE d.order_id = o.id) AS deliv_cobro" +
      "  FROM orders o JOIN users u ON u.id = o.user_id" +
      "  WHERE o.status = 'entregado' AND COALESCE(o.is_unified,0) = 0" +
      "    AND u.level BETWEEN 1 AND 4 AND o.total > 0" +
      "    AND NOT EXISTS (SELECT 1 FROM account_movements am" +
      "                     WHERE am.order_id = o.id AND am.type = 'debit')"
    ).all();
    if (!orphans.length) return;
    const insMov = db.prepare(
      "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
      " VALUES (?, ?, ?, ?, ?, datetime('now'))"
    );
    const hasCred = db.prepare(
      "SELECT 1 FROM account_movements WHERE order_id = ? AND type = 'credit' AND description LIKE ? LIMIT 1"
    );
    const tx = db.transaction(() => {
      for (const o of orphans) {
        insMov.run(o.user_id, "debit", o.total, "Pedido #" + o.id + " (ajuste)", o.id);
        if (o.deliv_cobro > 0 && !hasCred.get(o.id, "Cobro entrega%")) {
          insMov.run(o.user_id, "credit", o.deliv_cobro, "Cobro entrega #" + o.id + " (ajuste)", o.id);
        }
        if (o.discount_amount > 0 && !hasCred.get(o.id, "Descuento pedido%")) {
          insMov.run(o.user_id, "credit", o.discount_amount, "Descuento pedido #" + o.id + " (ajuste)", o.id);
        }
      }
    });
    tx();
    console.log("[backfill] débitos de cuenta corriente para " + orphans.length + " pedido(s) entregado(s) sin débito");
  } catch (e) {
    console.error("[backfill] error creando débitos de pedidos entregados:", e.message);
  }
})();

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

// ─── Reconstruccion historica de stock_movements (22 jul 2026) ────────────────
// El log stock_movements arranco vacio: solo registra movimientos posteriores a
// su deploy. Este backfill rellena hacia atras los movimientos ANTERIORES desde
// las fuentes que tienen fecha: compras cargadas, ajustes manuales, ventas/
// entregas y presupuestos. Corre UNA sola vez (guard en settings).
//
// Como funciona el saldo: por cada producto, el PRIMER movimiento real ya
// logueado tiene un qty_before exacto = el stock justo antes de que arrancara el
// log. Ese es el ANCLA. La reconstruccion toma los eventos con fecha < ese
// primer movimiento y camina hacia atras desde el ancla (qty_after del evento
// mas nuevo = ancla, y asi). Para productos sin ningun movimiento real logueado,
// el ancla es el stock actual. Es una ESTIMACION en el pasado (faltan
// movimientos sin fecha exacta y puede haber saldos negativos si algo se
// solapa), pero cierra contra el ancla, que es exacto. Las filas se marcan
// "(reconstruido)" en el detalle.
function backfillStockMovements() {
  if (getSetting("stock_movements_backfill_v1")) return;
  try {
    const prods = db.prepare("SELECT id, stock FROM products").all();

    // Ancla por producto: primer movimiento real logueado (menor created_at).
    const anchor = new Map(); // pid -> { boundary, startStock }
    db.prepare(
      "SELECT product_id AS pid, created_at AS d, qty_before AS qb" +
      "  FROM stock_movements ORDER BY product_id, created_at ASC, id ASC"
    ).all().forEach((r) => {
      if (!anchor.has(r.pid)) anchor.set(r.pid, { boundary: String(r.d), startStock: Number(r.qb) || 0 });
    });

    // Eventos historicos datables (delta con signo + fecha + tipo + detalle).
    const ev = new Map(); // pid -> [{ d, delta, type, note, sid }]
    const push = (pid, d, delta, type, note, sid) => {
      const dd = Math.round(Number(delta) || 0);
      if (!pid || !dd || !d) return;
      if (!ev.has(pid)) ev.set(pid, []);
      ev.get(pid).push({ d: String(d), delta: dd, type, note, sid: sid || null });
    };

    // Compras (suman stock).
    db.prepare(
      "SELECT pi.product_id AS pid, pi.quantity AS qty, pi.purchase_order_id AS poid," +
      "  COALESCE(po.received_at, po.created_at) AS d, po.reference AS ref" +
      "  FROM purchase_items pi JOIN purchase_orders po ON po.id = pi.purchase_order_id"
    ).all().forEach((r) => push(
      r.pid, r.d, Math.abs(Number(r.qty) || 0), "compra",
      "Compra #" + r.poid + (r.ref ? " · " + r.ref : "") + " (reconstruido)", r.poid
    ));

    // Ajustes manuales (qty_change ya viene con signo).
    db.prepare("SELECT product_id AS pid, qty_change AS qty, type, reason, created_at AS d, id FROM stock_adjustments")
      .all().forEach((r) => push(
        r.pid, r.d, Number(r.qty) || 0, "ajuste",
        (r.reason || ("Ajuste manual (" + (r.type || "ajuste") + ")")) + " (reconstruido)", r.id
      ));

    // Ventas: ordenes con stock descontado, sin presupuesto vinculado (ese lo
    // cuenta el presupuesto aparte), no unificadas/hijas/canceladas.
    db.prepare(
      "SELECT oi.product_id AS pid, oi.quantity AS qty, o.id AS oid," +
      "  COALESCE(d.delivered_at, o.created_at) AS dt" +
      "  FROM order_items oi JOIN orders o ON o.id = oi.order_id" +
      "  LEFT JOIN deliveries d ON d.order_id = o.id" +
      " WHERE COALESCE(o.stock_discounted,0)=1 AND COALESCE(o.is_unified,0)=0" +
      "   AND o.unified_parent_id IS NULL AND o.status != 'cancelado'" +
      "   AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.order_id = o.id)"
    ).all().forEach((r) => push(
      r.pid, r.dt, -Math.abs(Number(r.qty) || 0), "venta",
      "Pedido #" + r.oid + " (reconstruido)", r.oid
    ));

    // Presupuestos que descontaron stock (facturados o no), no cancelados.
    db.prepare(
      "SELECT bi.product_id AS pid, bi.quantity AS qty, b.id AS bid, b.created_at AS d" +
      "  FROM budget_items bi JOIN budgets b ON b.id = bi.budget_id" +
      " WHERE COALESCE(b.stock_discounted,0)=1 AND b.status != 'cancelado'"
    ).all().forEach((r) => push(
      r.pid, r.d, -Math.abs(Number(r.qty) || 0), "presupuesto",
      "Presupuesto #" + r.bid + " (reconstruido)", r.bid
    ));

    const insert = db.prepare(
      "INSERT INTO stock_movements (product_id, type, delta, qty_before, qty_after, source_id, note, created_at)" +
      " VALUES (?,?,?,?,?,?,?,?)"
    );
    let inserted = 0;
    db.transaction(() => {
      for (const p of prods) {
        const a = anchor.get(p.id);
        const boundary = a ? a.boundary : null; // null = sin log real todavia
        let running = a ? a.startStock : (Number(p.stock) || 0);
        // Solo eventos ANTERIORES al ancla (los posteriores ya estan logueados).
        let list = (ev.get(p.id) || []).filter((e) => boundary == null || e.d < boundary);
        if (!list.length) continue;
        // Mas nuevo primero para caminar hacia atras desde el ancla.
        list.sort((x, y) => (x.d < y.d ? 1 : x.d > y.d ? -1 : 0));
        for (const e of list) {
          const qtyAfter = running;
          const qtyBefore = qtyAfter - e.delta;
          insert.run(p.id, e.type, e.delta, qtyBefore, qtyAfter, e.sid, e.note, e.d);
          running = qtyBefore;
          inserted++;
        }
      }
      setSetting("stock_movements_backfill_v1", new Date().toISOString());
    })();
    console.log("[backfill] stock_movements reconstruidos: " + inserted);
  } catch (err) {
    console.error("[backfill] fallo la reconstruccion de stock_movements:", err.message);
  }
}
backfillStockMovements();

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
// "publico" tiene columnas propias desde jul 2026 (filas viejas: NULL).
function priceChangeColsForBaseLevel(baseLevel) {
  switch (String(baseLevel || "").toLowerCase()) {
    case "revendedor": return { old: "old_revendedor", new: "new_revendedor" };
    case "mayorista":  return { old: "old_mayorista",  new: "new_mayorista"  };
    case "vip":        return { old: "old_vip",        new: "new_vip"        };
    case "publico":    return { old: "old_publico",    new: "new_publico"    };
    case "minorista":
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

// Columnas de precio que se historizan en price_changes (los 5 niveles).
const TRACKED_PRICE_COLS = ["price_minorista", "price_revendedor", "price_mayorista", "price_vip", "price_publico"];

// Campos monetarios del producto: admiten 2 decimales (centavos). El stock y
// stock_min quedan SIEMPRE enteros. round2 redondea a centavos.
const PRICE_FIELDS = ["cost", "price_minorista", "price_revendedor", "price_mayorista", "price_vip", "price_publico"];
function round2(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }

// Registra un cambio MANUAL de precio (edición desde el admin) en el historial
// de "Ver cambios". A diferencia de la importación de Excel —que crea un update
// por archivo— los cambios manuales se agrupan en UN solo update por día
// (source='manual'): si en el mismo día se vuelve a tocar el precio de un mismo
// producto, se actualiza el precio "nuevo" conservando el "anterior" del inicio
// del día. before/after deben traer las 4 columnas TRACKED_PRICE_COLS.
const recordManualPriceChange = db.transaction((productId, before, after) => {
  if (!before || !after) return;
  // (Number()||0 evita falsos positivos si algun caller no trae una columna:
  // NaN !== NaN daria "changed" siempre true.)
  const changed = TRACKED_PRICE_COLS.some((c) => (Number(before[c]) || 0) !== (Number(after[c]) || 0));
  if (!changed) return;

  // Bucket diario: el update manual de HOY (hora local) o uno nuevo.
  const bucket = db.prepare(
    "SELECT id FROM price_updates" +
    " WHERE source = 'manual'" +
    "   AND date(created_at, 'localtime') = date('now', 'localtime')" +
    " ORDER BY id DESC LIMIT 1"
  ).get();
  let updateId;
  if (bucket) {
    updateId = bucket.id;
  } else {
    updateId = db.prepare(
      "INSERT INTO price_updates (source, rows_total, products_changed, products_new, products_reingreso)" +
      " VALUES ('manual', 0, 0, 0, 0)"
    ).run().lastInsertRowid;
  }

  const prod = db.prepare("SELECT code, name FROM products WHERE id = ?").get(productId) || {};
  const existing = db.prepare(
    "SELECT id FROM price_changes WHERE update_id = ? AND product_id = ?"
  ).get(updateId, productId);

  if (existing) {
    // Ya hubo un cambio hoy para este producto: conservamos old_* (línea base
    // del día) y solo actualizamos new_* al precio más reciente.
    db.prepare(
      "UPDATE price_changes SET name = ?," +
      "  new_minorista = ?, new_revendedor = ?, new_mayorista = ?, new_vip = ?, new_publico = ?" +
      " WHERE id = ?"
    ).run(
      prod.name || null,
      after.price_minorista, after.price_revendedor, after.price_mayorista, after.price_vip,
      after.price_publico != null ? after.price_publico : null,
      existing.id
    );
  } else {
    db.prepare(
      "INSERT INTO price_changes" +
      " (update_id, product_id, code, name, is_new, is_reingreso," +
      "  old_minorista, new_minorista, old_revendedor, new_revendedor," +
      "  old_mayorista, new_mayorista, old_vip, new_vip, old_publico, new_publico)" +
      " VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      updateId, productId, prod.code || null, prod.name || null,
      before.price_minorista, after.price_minorista,
      before.price_revendedor, after.price_revendedor,
      before.price_mayorista, after.price_mayorista,
      before.price_vip, after.price_vip,
      before.price_publico != null ? before.price_publico : null,
      after.price_publico != null ? after.price_publico : null
    );
  }

  // Mantener el contador de la cabecera (productos con cambio en el día).
  db.prepare(
    "UPDATE price_updates SET products_changed =" +
    " (SELECT COUNT(*) FROM price_changes WHERE update_id = ? AND COALESCE(is_new,0) = 0)" +
    " WHERE id = ?"
  ).run(updateId, updateId);
});

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

// Las respuestas del API (datos dinámicos: productos, categorías, pedidos, etc.)
// nunca se deben cachear en el navegador ni en proxies. Sin esto, algunos
// dispositivos servían una respuesta vieja del HTTP cache y los productos nuevos
// no aparecían hasta un hard refresh. El Service Worker igual guarda una copia
// en su propio cache para el modo offline (cache.put ignora este header).
app.use((req, res, next) => {
  if (req.method === "GET" && req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
  }
  next();
});

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
// "costo" usa la columna products.cost (no price_*). "publico" suele venir vacio
// en el Excel pero lo aceptamos.
const PRICE_LIST_BASE_LEVELS = ["costo", "minorista", "revendedor", "mayorista", "vip", "publico"];
function priceColumnForBaseLevel(baseLevel) {
  const b = String(baseLevel || "").trim().toLowerCase();
  if (b === "costo") return "cost";
  if (!PRICE_LIST_BASE_LEVELS.includes(b)) return "price_minorista";
  return "price_" + b;
}

// Resuelve la config efectiva de una lista de precios, siguiendo la cadena de
// listas base (price_lists.base_list_id). Devuelve:
//   { listId, name, base_level (raiz), column, markup_percent (EFECTIVO combinado), chain }
// o null si la lista no existe.
// El % efectivo combina los margenes de toda la cadena en un unico equivalente:
//   (1 - m_eff/100) = PRODUCTO de (1 - m_i/100)
// asi TODO el codigo downstream (computeEffectivePrice, priceSqlExpr, snapshots,
// preview, PDF) sigue funcionando sin cambios con la formula de siempre.
// La cadena se corta ante ciclos, padres borrados o profundidad > 6; en ese caso
// cae al base_level propio de la ultima lista alcanzada (denormalizado al guardar).
// NOTA: los padres se siguen aunque esten inactivos (una lista "base" puede
// existir solo como bloque de construccion); el flag active de la lista ASIGNADA
// al cliente si se respeta (en getEffectivePriceConfig).
function resolvePriceListConfig(listOrId) {
  const selectSql =
    "SELECT id, name, base_level, base_list_id, markup_percent, active FROM price_lists WHERE id = ?";
  let row = listOrId && typeof listOrId === "object" ? listOrId : db.prepare(selectSql).get(Number(listOrId));
  if (!row) return null;
  // Si nos pasaron un objeto sin base_list_id (SELECT viejo), re-consultamos completo.
  if (!("base_list_id" in row)) {
    const full = db.prepare(selectSql).get(row.id);
    if (full) row = full;
  }
  const visited = new Set();
  const chain = [];
  let divisor = 1;
  let rootBase = "minorista";
  let cur = row;
  while (cur) {
    if (visited.has(cur.id) || visited.size >= 6) break; // ciclo o cadena demasiado larga
    visited.add(cur.id);
    chain.push(cur.name);
    const m = Number(cur.markup_percent) || 0;
    const d = 1 - m / 100;
    if (d > 0) divisor *= d; // margen invalido (>=100): se ignora, igual que computeEffectivePrice
    rootBase = cur.base_level || "minorista";
    if (!cur.base_list_id) break;
    const parent = db.prepare(selectSql).get(Number(cur.base_list_id));
    if (!parent) break; // padre borrado: cae al base_level denormalizado de esta lista
    cur = parent;
  }
  return {
    listId: row.id,
    name: row.name,
    base_level: rootBase,
    column: priceColumnForBaseLevel(rootBase),
    markup_percent: 100 * (1 - divisor), // % efectivo equivalente de toda la cadena
    chain: chain,
  };
}

// Chequeo de ciclos al guardar: si partiendo de parentId y subiendo por
// base_list_id se llega a selfId, asignar ese padre crearia un ciclo.
function priceListWouldCycle(parentId, selfId) {
  let cur = Number(parentId);
  const seen = new Set();
  while (cur) {
    if (cur === Number(selfId) || seen.has(cur) || seen.size > 10) return true;
    seen.add(cur);
    const r = db.prepare("SELECT base_list_id FROM price_lists WHERE id = ?").get(cur);
    if (!r || !r.base_list_id) break;
    cur = Number(r.base_list_id);
  }
  return false;
}

// Devuelve la "config de precios" efectiva para un cliente (level 1-4 o vendedor
// atendiendo a un cliente). El resultado define como calcular el precio de un
// producto para ese cliente:
//   - Si tiene price_list_id valido: { kind: "list", column, markup_percent, listId }
//     -> efectivo = round(products.<column> / (1 - markup_percent/100))
//     (si la lista se basa en otra lista, column y markup_percent ya vienen
//      resueltos de toda la cadena por resolvePriceListConfig)
//   - Si no: { kind: "level", column }
//     -> efectivo = products.<column> directo
// Para nivel admin/vendedor sin contexto, devolvemos config por nivel.
function getEffectivePriceConfig(userId, level) {
  if (userId && [1, 2, 3, 4].includes(Number(level))) {
    const row = db.prepare(
      "SELECT pl.id, pl.name, pl.base_level, pl.base_list_id, pl.markup_percent, pl.active" +
      "  FROM users u JOIN price_lists pl ON pl.id = u.price_list_id" +
      "  WHERE u.id = ?"
    ).get(userId);
    if (row && row.active) {
      const r = resolvePriceListConfig(row);
      return {
        kind: "list",
        listId: row.id,
        column: r.column,
        markup_percent: r.markup_percent,
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
  return round2(p / denom);
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
        " THEN ROUND(" + a + "." + config.column + " / (1 - ? / 100.0), 2)" +
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
// ===== Superadmin / permisos por seccion del panel admin =====
// Las claves coinciden con los data-tab del sidebar de admin.html.
// "administradores" es exclusiva del superadmin y NO es asignable a un admin comun.
const ADMIN_SECTIONS = [
  { key: "dashboard",   label: "Dashboard" },
  { key: "productos",   label: "Productos" },
  { key: "price-lists", label: "Listas de precios" },
  { key: "pedidos",     label: "Pedidos" },
  { key: "armado",      label: "Armado" },
  { key: "entregas",    label: "Entregas" },
  { key: "ventas",      label: "Ventas" },
  { key: "usuarios",    label: "Usuarios" },
  { key: "vendedores",  label: "Vendedores" },
  { key: "reportes",    label: "Reportes" },
  { key: "actividad",   label: "Actividad" },
  { key: "pagos",       label: "Pagos" },
  { key: "cuentas",     label: "Cuentas" },
  { key: "proveedores", label: "Proveedores" },
  { key: "compras",     label: "Compras" },
  { key: "recepcion",   label: "Recepción" },
  { key: "gastos",      label: "Gastos" },
  { key: "caja",        label: "Caja" },
  { key: "config",      label: "Configuración" },
];
const ADMIN_SECTION_KEYS = new Set(ADMIN_SECTIONS.map((s) => s.key));

// Mapea un path de /api/admin/* a la clave de seccion que lo gobierna.
// Devuelve null si no esta mapeado (endpoints compartidos => se permiten).
function sectionForAdminRequest(p) {
  const has = (frag) => p.indexOf("/api/admin/" + frag) === 0;
  if (has("admins"))      return "administradores";
  if (has("dashboard"))   return "dashboard";
  if (has("products") || has("import-excel") || has("stock-adjustments") || has("catalog")) return "productos";
  if (has("price-lists")) return "price-lists";
  if (has("ventas"))      return "ventas";
  if (has("picks"))       return "armado";
  if (has("orders"))      return "pedidos";
  if (has("deliveries"))  return "entregas";
  if (has("users"))       return "usuarios";
  if (has("vendedores"))  return "vendedores";
  if (has("reports"))     return "reportes";
  if (has("earnings") || has("activity")) return "actividad";
  if (has("payments"))    return "pagos";
  if (has("accounts"))    return "cuentas";
  if (has("suppliers"))   return "proveedores";
  if (has("reception"))   return "recepcion";
  if (has("purchases"))   return "compras";
  if (has("expenses") || has("expense-categories")) return "gastos";
  if (has("caja"))        return "caja";
  if (has("settings") || has("dbinfo") || has("categories")) return "config";
  return null;
}

// Permisos efectivos de un usuario level 99: { isSuperadmin, sections:Set }.
function getAdminPerms(userId) {
  const row = db.prepare("SELECT is_superadmin, admin_sections FROM users WHERE id = ?").get(userId) || {};
  const isSuperadmin = Number(row.is_superadmin) === 1;
  const sections = new Set(
    String(row.admin_sections || "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  return { isSuperadmin, sections };
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
  // Enforcement por seccion: el superadmin pasa siempre. Un admin comun solo
  // puede usar las secciones que tiene en admin_sections; nunca "administradores".
  const perms = getAdminPerms(req.session.userId);
  if (!perms.isSuperadmin) {
    const section = sectionForAdminRequest(req.path);
    if (section === "administradores") {
      return res.status(403).json({ error: "Solo el superadmin puede gestionar administradores" });
    }
    if (section && !perms.sections.has(section)) {
      return res.status(403).json({ error: "Sin permiso para esta sección" });
    }
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

// Gating por seccion para rutas COMPARTIDAS (no /api/admin/*) que sirven a la vez
// a clientes (1-4), vendedores (5) y admins (99) -- p.ej. /api/orders, /api/budgets.
// El enforcement por seccion de requireAdmin NO cubre estas rutas, asi que un
// admin con secciones limitadas podia ver/tocar datos de una seccion que no tiene.
// Estos helpers cierran ese hueco aplicando el chequeo de seccion SOLO al level 99:
//   - superadmin: pasa siempre.
//   - admin comun: 403 si no tiene la(s) seccion(es) requerida(s).
//   - clientes y vendedores: pasan, y el scoping propio de la ruta sigue mandando.
// Se encadenan DESPUES de requireLogin / requireVendedorOrAdmin, que ya validan login y nivel.
function requireSectionForAdmin(sectionKey) {
  return function (req, res, next) {
    if (req.session && req.session.level === 99) {
      const perms = getAdminPerms(req.session.userId);
      if (!perms.isSuperadmin && !perms.sections.has(sectionKey)) {
        return res.status(403).json({ error: "Sin permiso para esta sección" });
      }
    }
    next();
  };
}

// Igual que requireSectionForAdmin, pero alcanza con que el admin tenga AL MENOS
// una de las secciones indicadas. Util para rutas que consumen varias pantallas
// del panel (p.ej. la lista de clientes la usan Ventas, Cuentas, Pagos, etc.).
function requireAnySectionForAdmin(sectionKeys) {
  return function (req, res, next) {
    if (req.session && req.session.level === 99) {
      const perms = getAdminPerms(req.session.userId);
      if (!perms.isSuperadmin && !sectionKeys.some((k) => perms.sections.has(k))) {
        return res.status(403).json({ error: "Sin permiso para esta sección" });
      }
    }
    next();
  };
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

// Rate limit de /login: proteccion contra fuerza bruta, sin dependencias.
// Contador en memoria por IP: maximo LOGIN_MAX_ATTEMPTS intentos FALLIDOS por
// ventana de LOGIN_WINDOW_MS. Un login exitoso resetea el contador de esa IP.
// Barrido periodico para que el Map no crezca indefinidamente.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map(); // ip -> { count, first }
function loginRateOk(ip) {
  const e = loginAttempts.get(ip);
  if (!e) return true;
  if (Date.now() - e.first > LOGIN_WINDOW_MS) { loginAttempts.delete(ip); return true; }
  return e.count < LOGIN_MAX_ATTEMPTS;
}
function loginRateFail(ip) {
  const now = Date.now();
  const e = loginAttempts.get(ip);
  if (!e || now - e.first > LOGIN_WINDOW_MS) loginAttempts.set(ip, { count: 1, first: now });
  else e.count += 1;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of loginAttempts) {
    if (now - e.first > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  }
}, 10 * 60 * 1000).unref();

app.post("/login", (req, res) => {
  const ip = req.ip || "?";
  if (!loginRateOk(ip)) {
    return res.status(429).json({ error: "Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo." });
  }
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Faltan datos" });
  const user = db
    .prepare("SELECT id, username, password_hash, full_name, level, active, vendedor_price_level FROM users WHERE username = ?")
    .get(String(username).trim().toLowerCase());
  if (!user || !user.active) {
    loginRateFail(ip);
    return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  }
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    loginRateFail(ip);
    return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  }
  loginAttempts.delete(ip);
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
  logActivity(req, "login", null);
  res.json({ ok: true, user: { id: user.id, username: user.username, fullName: user.full_name, level: user.level, levelName: levelName(user.level) } });
});

app.post("/logout", (req, res) => {
  logActivity(req, "logout", null);
  req.session.destroy(() => { res.clearCookie("maxaria.sid"); res.json({ ok: true }); });
});

app.get("/", (req, res) => {
  if (req.session && req.session.userId) return res.redirect("/catalogo");
  res.redirect("/login");
});
app.get("/catalogo", requireLogin, (req, res) => {
  // Registrar visita al catalogo solo para clientes (level 1-4).
  if (req.session.level >= 1 && req.session.level <= 4) logActivity(req, "catalogo", null);
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
  if (Number(level) === 99) {
    // Superadmin ve todas las secciones; admin comun, solo las asignadas.
    const perms = getAdminPerms(req.session.userId);
    resp.isSuperadmin = perms.isSuperadmin;
    resp.adminSections = perms.isSuperadmin
      ? ADMIN_SECTIONS.map((s) => s.key)
      : ADMIN_SECTIONS.map((s) => s.key).filter((k) => perms.sections.has(k));
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
app.get("/api/clients", requireLogin, requireAnySectionForAdmin(["ventas", "cuentas", "pagos", "pedidos", "vendedores"]), (req, res) => {
  const level = req.session.level;
  if (level !== 5 && level !== 99) {
    return res.status(403).json({ error: "Solo vendedores o admin" });
  }
  // - Admin: ve todos los clientes activos (lo usa /ventas para armar presupuestos).
  // - Vendedor propio: ve todos los clientes activos.
  // - Vendedor tercerizado: solo los clientes que tiene asignados.
  // Incluimos la lista de precios asignada (solo si está activa) para que la
  // página de presupuestos pueda preseleccionar la base de precios del cliente.
  let sql =
    "SELECT u.id, u.username, u.full_name, u.level," +
    "       pl.id AS price_list_id, pl.name AS price_list_name" +
    "  FROM users u" +
    "  LEFT JOIN price_lists pl ON pl.id = u.price_list_id AND pl.active = 1" +
    "  WHERE u.level IN (1,2,3,4) AND u.active = 1";
  const params = [];
  if (level === 5) {
    const me = db.prepare("SELECT is_tercerizado FROM users WHERE id = ?").get(req.session.userId) || {};
    if (Number(me.is_tercerizado) === 1) {
      sql += " AND u.assigned_vendedor_id = ?";
      params.push(req.session.userId);
    }
  }
  sql += " ORDER BY u.full_name, u.username";
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r) => ({
    id: r.id, username: r.username, full_name: r.full_name,
    level: r.level, levelName: levelName(r.level),
    price_list_id: r.price_list_id || null,
    price_list_name: r.price_list_name || null,
  })));
});

// Opciones de precio seleccionables al armar un presupuesto: los niveles base
// del catálogo + las listas personalizadas activas. La página de Ventas las usa
// para el selector "Lista de precios" del formulario.
app.get("/api/price-options", requireVendedorOrAdmin, (req, res) => {
  const levels = [
    { value: "base:minorista",  label: "Minorista" },
    { value: "base:revendedor", label: "Revendedor" },
    { value: "base:mayorista",  label: "Mayorista" },
    { value: "base:vip",        label: "VIP" },
    { value: "base:publico",    label: "Público" },
  ];
  const lists = db.prepare(
    "SELECT id, name, base_level, base_list_id, markup_percent FROM price_lists" +
    "  WHERE active = 1 ORDER BY name"
  ).all().map((l) => {
    // Si la lista se basa en otra lista, mostramos la base real y el % efectivo
    // combinado de la cadena (mismo criterio que el resto del sistema).
    const eff = l.base_list_id ? resolvePriceListConfig(l) : null;
    const baseDesc = eff && eff.chain && eff.chain.length > 1 ? "basada en " + eff.chain[1] : l.base_level;
    const mEff = eff ? Math.round(eff.markup_percent * 100) / 100 : (Number(l.markup_percent) || 0);
    return {
      value: "list:" + l.id,
      id: l.id,
      name: l.name,
      base_level: eff ? eff.base_level : l.base_level,
      markup_percent: mEff,
      label: l.name + " (" + baseDesc + (mEff ? " " + mEff + "%" : "") + ")",
    };
  });
  res.json({ levels, lists });
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
  const candidateStmt = db.prepare(
    "SELECT o.id, o.status, o.is_unified, o.unified_parent_id, o.user_id," +
    "       u.username AS client_username, u.full_name AS client_full_name" +
    "  FROM orders o JOIN users u ON u.id = o.user_id" +
    "  WHERE o.id IN (" + placeholders + ")" +
    "    AND (o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)"
  );
  const candidateOrders = candidateStmt.all.apply(
    candidateStmt, uniqueIds.concat([req.session.userId, req.session.userId])
  );

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
  const itemsStmt = db.prepare(
    "SELECT product_id, product_code, product_name, quantity, unit_price, vendedor_cost_unit" +
    "  FROM order_items WHERE order_id IN (" + placeholders + ")"
  );
  const allItems = itemsStmt.all.apply(itemsStmt, uniqueIds);

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
    const unit = g.quantity > 0 ? round2(g.subtotal_base / g.quantity) : 0;
    const subtotal = round2(unit * g.quantity);
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
    ).run(req.session.userId, round2(total), notesStr, req.session.userId);
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
      return "$" + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  if (level >= 1 && level <= 4) logActivity(req, "cambios", null);

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
  // El admin se queda con priceChangeCols(effectiveLevel) tradicional (sin lista),
  // a menos que pase ?as_list_id=N para mirar como una lista personalizada.
  let cfg;
  if (level === 99 && req.query.as_list_id != null) {
    const listIdQ = Number(req.query.as_list_id);
    const lstCfg = resolvePriceListConfig(listIdQ);
    if (lstCfg) {
      cfg = {
        kind: "list",
        listId: lstCfg.listId,
        column: lstCfg.column,
        markup_percent: lstCfg.markup_percent,
      };
    }
  }
  if (!cfg) {
    const useListConfig = level !== 99;
    cfg = useListConfig ? getEffectivePriceConfig(targetUserId, effectiveLevel) : { kind: "level" };
  }
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
    if (markup === 0) return round2(Number(v) || 0);
    const denom = 1 - markup / 100;
    if (denom <= 0) return round2(Number(v) || 0);
    return round2((Number(v) || 0) / denom);
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
  let rows = db.prepare("SELECT id, name, icon_url, active FROM categories ORDER BY sort_order, name").all();
  // Visibilidad global: las categorias desactivadas no las ve nadie en el
  // catalogo (clientes ni vendedores). El admin (99) ve todas: este endpoint
  // tambien alimenta los selects del panel (modales de producto, PDF, etc).
  // Excepcion: con ?preview=1 el admin pide la vista filtrada (catalogo
  // "viendo como" un nivel/lista, simula lo que ve un cliente).
  if (req.session.level !== 99 || req.query.preview === "1") {
    rows = rows.filter((c) => Number(c.active) === 1);
  }
  if (allowedIds !== null) {
    rows = rows.filter((c) => allowedIds.has(c.id));
  }
  res.json(rows);
});

app.get("/api/products", requireLogin, (req, res) => {
  // Vendedor sin cliente seleccionado:
  //   - Si tiene users.price_list_id asignada (caso tipico: tercerizado),
  //     muestra el catalogo con su COSTO = columna base de la lista directo
  //     (sin aplicar markup).
  //   - Si no tiene lista propia, muestra el catalogo sin precios (noPrice=true).
  // Vendedor con cliente: usa nivel + lista de precios del cliente.
  // Admin: puede ver "como otro nivel" via ?as_level (no aplica lista personalizada).
  // Resto de usuarios (clientes 1-4): si tienen price_list_id, ven esa lista
  //   con el % de markup aplicado; si no, ven los precios de su nivel.
  let effectiveLevel = req.session.level;
  let effectiveUserId = req.session.userId;
  let noPrice = false;
  let vendorCostCfg = null; // override para vendedor sin cliente con lista propia

  // Override de precios (admin nivel 99 o vendedor nivel 5): permite ver el
  // catálogo "como" un nivel base o una lista personalizada. Lo usa la vista
  // "ver como nivel" del catálogo (admin) y el armado de presupuestos en /ventas
  // (admin y vendedores), para que el picker muestre el precio del cliente.
  //   - as_list_id=N   → lista personalizada N (markup sobre su columna base)
  //   - as_base=<base> → nivel base directo (minorista|revendedor|mayorista|vip|publico)
  //   - as_level=N     → nivel base por número 1..4 (compat. con el catálogo)
  const canOverride = req.session.level === 99 || req.session.level === 5;
  let overrideApplied = false;
  if (canOverride && req.query.as_list_id != null) {
    const listId = Number(req.query.as_list_id);
    const listCfg = resolvePriceListConfig(listId);
    if (listCfg) {
      vendorCostCfg = {
        kind: "list",
        listId: listCfg.listId,
        column: listCfg.column,
        markup_percent: listCfg.markup_percent,
      };
      effectiveUserId = null;
      overrideApplied = true;
    }
  } else if (canOverride && req.query.as_base != null) {
    const base = String(req.query.as_base).trim().toLowerCase();
    // No exponemos "costo" como base de venta de un presupuesto.
    if (["minorista", "revendedor", "mayorista", "vip", "publico"].includes(base)) {
      vendorCostCfg = { kind: "level", column: priceColumnForBaseLevel(base) };
      effectiveUserId = null; // override explícito: ignorar lista personalizada
      overrideApplied = true;
    }
  } else if (canOverride && req.query.as_level != null) {
    const asLvl = Number(req.query.as_level);
    if ([1, 2, 3, 4].includes(asLvl)) {
      effectiveLevel = asLvl;
      effectiveUserId = null; // admin "viendo como N": ignorar lista personalizada
      overrideApplied = true;
    }
  }

  if (!overrideApplied && req.session.level === 5) {
    if (req.session.vendedorClientId) {
      effectiveLevel = req.session.vendedorClientLevel;
      effectiveUserId = req.session.vendedorClientId;
    } else {
      // Vendedor sin cliente:
      //   - Si es tercerizado, muestra catálogo con su COSTO = precio del
      //     nivel base asignado (users.vendedor_price_level, 1..4). Es uno
      //     de los niveles base, no una lista personalizada.
      //   - Si NO es tercerizado, mantiene el comportamiento clásico
      //     (cartel "Seleccioná un cliente").
      // Lo leemos de la DB para reflejar cambios del admin sin re-login.
      const vRow = db.prepare(
        "SELECT vendedor_price_level, is_tercerizado FROM users WHERE id = ?"
      ).get(req.session.userId) || {};
      const vpl = Number(vRow.vendedor_price_level) || 0;
      if (Number(vRow.is_tercerizado) === 1 && [1, 2, 3, 4].includes(vpl)) {
        vendorCostCfg = { kind: "level", column: priceColumnFor(vpl) };
      } else {
        noPrice = true; // vendedor propio sin cliente, o sin nivel: "Seleccioná un cliente"
      }
    }
  }

  // Resolver config de precios (lista personalizada, costo del vendedor, o nivel base)
  const cfg = vendorCostCfg || getEffectivePriceConfig(effectiveUserId, effectiveLevel);
  let priceExpr = "NULL";
  const priceParams = [];
  if (!noPrice) {
    const e = priceSqlExpr(cfg, "p");
    priceExpr = e.expr;
    priceParams.push(...e.params);
  }
  // getUserAllowedCategoryIds devuelve null (sin restricción) para level 5 sin cliente
  const allowedIds = getUserAllowedCategoryIds(effectiveUserId, effectiveLevel);

  // Solo el admin puede pedir el catálogo incluyendo productos sin stock
  // (lo usa el picker de presupuestos para facturar productos a reponer; el
  // stock queda negativo). Para clientes/vendedores se mantiene el filtro.
  const includeNoStock = req.session.level === 99 &&
    (req.query.include_no_stock === "1" || req.query.include_no_stock === "true");

  let sql =
    "SELECT p.id, p.code, p.category_id, c.name AS category_name," +
    "       p.name, p.description, p.image_url, " + priceExpr + " AS price, p.stock" +
    "  FROM products p LEFT JOIN categories c ON c.id = p.category_id" +
    "  WHERE p.active = 1" + (includeNoStock ? "" : " AND p.stock > 0");
  // Visibilidad global de categorias: productos de una categoria desactivada
  // no se muestran a clientes ni vendedores (el admin si los ve). Productos
  // sin categoria (c.active NULL) quedan visibles via COALESCE. Con ?preview=1
  // el admin pide la vista filtrada (catalogo "viendo como" un nivel/lista);
  // los pickers internos (/ventas, presupuestos) no mandan preview y siguen
  // viendo todo.
  if (req.session.level !== 99 || req.query.preview === "1") {
    sql += " AND COALESCE(c.active, 1) = 1";
  }
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
    const subtotal = round2(unitPrice * qty);
    // Si el cliente tenia lista personalizada, base_price es el "costo" del vendedor.
    // Si no, el costo es el mismo precio que el de venta -> guardamos NULL.
    const costUnit = cfg.kind === "list" ? round2(Number(p.base_price) || 0) : null;
    total += subtotal;
    lines.push({
      product_id: p.id, product_code: p.code, product_name: p.name,
      quantity: qty, unit_price: unitPrice, subtotal: subtotal,
      vendedor_cost_unit: costUnit,
    });
  }
  if (!lines.length)
    return res.status(400).json({ error: "Ninguno de los productos del carrito esta disponible" });

  // Nombre del cliente para el presupuesto (snapshot, igual al resto del sistema)
  const clientRowForBudget = db.prepare("SELECT full_name, username FROM users WHERE id = ?").get(orderUserId);
  const clientNameForBudget = (clientRowForBudget &&
    (clientRowForBudget.full_name || clientRowForBudget.username)) || "Consumidor final";

  const insertOrder = db.prepare(
    "INSERT INTO orders (user_id, status, total, notes, whatsapp_sent_at, assigned_vendedor_id, created_at)" +
    " VALUES (?, 'enviado', ?, ?, datetime('now'), ?, datetime('now'))"
  );
  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, subtotal, vendedor_cost_unit)" +
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  total = round2(total);
  let orderId;
  db.transaction(() => {
    const r = insertOrder.run(orderUserId, total, (notes || "").slice(0, 500) || null, assignedVendedorId);
    orderId = r.lastInsertRowid;
    for (const l of lines) {
      insertItem.run(orderId, l.product_id, l.product_code, l.product_name,
                     l.quantity, l.unit_price, l.subtotal, l.vendedor_cost_unit);
    }

    // Auto-crear presupuesto vinculado a este pedido.
    // Queda en estado 'enviado' (el WhatsApp ya fue enviado). El admin puede
    // aceptarlo y despues facturarlo desde la seccion Presupuestos del panel.
    const bNum = nextBudgetNumber();
    const bRes = db.prepare(
      "INSERT INTO budgets (number, client_id, client_name, vendedor_id, payment_method, currency," +
      "  discount_percent, surcharge_percent, subtotal, total, notes, status, order_id, stock_discounted)" +
      "  VALUES (?, ?, ?, ?, 'Efectivo', 'ARS', 0, 0, ?, ?, ?, 'enviado', ?, 1)"
    ).run(bNum, orderUserId, clientNameForBudget, assignedVendedorId || null,
          total, total, (notes || "").slice(0, 500) || null, orderId);
    const budgetId = bRes.lastInsertRowid;
    const insBI = db.prepare(
      "INSERT INTO budget_items (budget_id, product_id, product_code, product_name," +
      "  quantity, unit_price, discount_percent, subtotal) VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
    );
    const updStockOrder = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
    for (const l of lines) {
      insBI.run(budgetId, l.product_id, l.product_code, l.product_name,
                l.quantity, l.unit_price, l.subtotal);
      // Descontar stock al crear el presupuesto (no al entregar)
      if (l.product_id) {
        updStockOrder.run(l.quantity, l.product_id);
        logStockMovement(l.product_id, "venta", -l.quantity, orderId, "Pedido #" + orderId + " (catalogo)", orderUserId);
      }
    }
  })();

  logActivity(req, "pedido", "Pedido #" + orderId + " · $" + total + " · " + lines.length + " items");
  res.json({ ok: true, order: { id: orderId, total: total, items: lines.length } });
});

app.get("/api/orders", requireLogin, requireSectionForAdmin("pedidos"), (req, res) => {
  const isAdmin = req.session.level === 99;
  const isVendedor = req.session.level === 5;

  if (isAdmin) {
    const rows = db.prepare(
      "SELECT o.id, o.status, o.total, o.notes, o.created_at, o.whatsapp_sent_at," +
      "       u.username, u.full_name," +
      "       o.assigned_vendedor_id," +
      "       v.username AS vendedor_username, v.full_name AS vendedor_full_name," +
      "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at, d.caja_id, d.caja_transfer_id, d.notes AS delivery_notes," +
      // Saldo del pedido desde la cuenta corriente (incluye cobro de entrega,
      // descuentos y pagos imputados al pedido). debit_total > 0 => el pedido
      // tiene cuenta corriente y es la fuente de verdad del cobro.
      "       (SELECT COALESCE(SUM(CASE WHEN am.type='debit'  THEN am.amount ELSE 0 END),0) FROM account_movements am WHERE am.order_id = o.id) AS debit_total," +
      "       (SELECT COALESCE(SUM(CASE WHEN am.type='credit' THEN am.amount ELSE 0 END),0) FROM account_movements am WHERE am.order_id = o.id) AS amount_paid," +
      "       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS pick_total," +
      "       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND COALESCE(oi.pick_checked,0) = 1) AS pick_done," +
      "       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND COALESCE(oi.pick_checked,0) = 1) AS pick_started" +
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
      "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at, d.caja_id, d.caja_transfer_id" +
      "  FROM orders o" +
      "  JOIN users u ON u.id = o.user_id" +
      "  LEFT JOIN deliveries d ON d.order_id = o.id" +
      "  WHERE o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?" +
      "  ORDER BY o.created_at DESC LIMIT 200"
    ).all(req.session.userId, req.session.userId);
    return res.json(rows);
  }

  // Usuario normal: solo sus propios pedidos. Incluye el saldo por pedido
  // (calculado desde la cuenta corriente) para mostrar "Pagado" / "Falta pagar"
  // en los pedidos entregados.
  const rows = db.prepare(
    "SELECT o.id, o.status, o.total, o.notes, o.created_at, o.whatsapp_sent_at," +
    "       NULL AS username, NULL AS full_name," +
    "       NULL AS assigned_vendedor_id, NULL AS delivery_id," +
    "       (SELECT COALESCE(SUM(CASE WHEN am.type='debit' THEN am.amount ELSE -am.amount END),0)" +
    "          FROM account_movements am WHERE am.order_id = o.id) AS balance_due," +
    "       (SELECT COALESCE(SUM(CASE WHEN am.type='credit' THEN am.amount ELSE 0 END),0)" +
    "          FROM account_movements am WHERE am.order_id = o.id) AS amount_paid" +
    "  FROM orders o WHERE o.user_id = ?" +
    "  ORDER BY o.created_at DESC LIMIT 200"
  ).all(req.session.userId);
  res.json(rows);
});

// GET /api/admin/ventas — registro de ventas concretadas = TODOS los pedidos
// entregados. A diferencia de /api/orders (vista operativa con LIMIT 200 sobre
// pedidos recientes), Ventas es un registro historico: una venta entregada hace
// meses NO debe desaparecer al acumularse pedidos nuevos. Por eso tiene su
// propia consulta, sin el tope de 200 y ordenada por fecha de entrega.
// Se excluyen los pedidos unificados del tercerizado (los hijos individuales son
// las ventas reales; el unificado es solo el consolidado para el admin) para no
// duplicar el total vendido.
app.get("/api/admin/ventas", requireAdmin, (req, res) => {
  // Filtro opcional por fecha de entrega (fallback fecha de creación si la venta
  // no tiene registro de entrega). from/to en formato YYYY-MM-DD, inclusivos.
  const { from, to } = req.query;
  const where = ["o.status = 'entregado'", "COALESCE(o.is_unified,0) = 0"];
  const params = [];
  const dateExpr = "date(COALESCE(d.delivered_at, o.created_at))";
  if (from) { where.push(dateExpr + " >= ?"); params.push(from); }
  if (to)   { where.push(dateExpr + " <= ?"); params.push(to); }
  const sql =
    "SELECT o.id, o.status, o.total, COALESCE(o.discount_amount,0) AS discount_amount, o.notes, o.created_at, o.whatsapp_sent_at," +
    "       u.username, u.full_name," +
    "       o.assigned_vendedor_id," +
    "       v.username AS vendedor_username, v.full_name AS vendedor_full_name," +
    "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at, d.caja_id, d.caja_transfer_id," +
    // Saldo del pedido desde la cuenta corriente (cobro entrega + descuentos +
    // pagos imputados al pedido). Permite que el badge "Debe/Saldado" refleje
    // pagos posteriores a la entrega.
    "       (SELECT COALESCE(SUM(CASE WHEN am.type='debit'  THEN am.amount ELSE 0 END),0) FROM account_movements am WHERE am.order_id = o.id) AS debit_total," +
    "       (SELECT COALESCE(SUM(CASE WHEN am.type='credit' THEN am.amount ELSE 0 END),0) FROM account_movements am WHERE am.order_id = o.id) AS amount_paid," +
    // Costo del pedido al costo ACTUAL de cada producto (products.cost). Permite
    // mostrar la rentabilidad (neto - costo) directamente en la lista de Ventas.
    "       (SELECT COALESCE(SUM(COALESCE(p.cost,0) * oi.quantity),0) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) AS cost_total" +
    "  FROM orders o" +
    "  JOIN users u ON u.id = o.user_id" +
    "  LEFT JOIN users v ON v.id = o.assigned_vendedor_id" +
    "  LEFT JOIN deliveries d ON d.order_id = o.id" +
    "  WHERE " + where.join(" AND ") +
    "  ORDER BY COALESCE(d.delivered_at, o.created_at) DESC LIMIT 1000";
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// ---- CHEQUEO DE ARMADO --------------------------------------------------
// Checklist de picking por pedido (pestaña Armado). Cada armador tilda items
// con la cantidad que junto; el modal hace polling del GET para sincronizar
// entre dispositivos (ultima escritura gana). Solo admins con seccion "armado"
// (sectionForAdminRequest mapea /api/admin/picks -> armado).
app.get("/api/admin/picks/:orderId", requireAdmin, (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!orderId) return res.status(400).json({ error: "ID invalido" });
  const order = db.prepare("SELECT id, status, user_id FROM orders WHERE id = ?").get(orderId);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  const client = db.prepare("SELECT full_name, username FROM users WHERE id = ?").get(order.user_id) || {};
  const items = db.prepare(
    "SELECT oi.id, oi.product_code, oi.product_name, oi.quantity," +
    "       COALESCE(oi.picked_qty, 0) AS picked_qty," +
    "       COALESCE(oi.pick_checked, 0) AS pick_checked, oi.picked_at," +
    "       pu.full_name AS picked_by_name," +
    "       COALESCE(c.name, 'Sin categoría') AS category_name" +
    "  FROM order_items oi" +
    "  LEFT JOIN products p ON p.id = oi.product_id" +
    "  LEFT JOIN categories c ON c.id = p.category_id" +
    "  LEFT JOIN users pu ON pu.id = oi.picked_by" +
    " WHERE oi.order_id = ?" +
    " ORDER BY COALESCE(c.sort_order, 9999), category_name, oi.product_name"
  ).all(orderId);
  // "Controlado" = pick_checked (la cantidad puede ser 0 o mayor a la pedida).
  const done = items.filter((i) => Number(i.pick_checked) === 1).length;
  res.json({
    order: { id: order.id, status: order.status, client_name: client.full_name || client.username || "" },
    items: items,
    total_items: items.length,
    done_items: done,
    complete: items.length > 0 && done === items.length,
  });
});

app.post("/api/admin/picks/:orderId", requireAdmin, (req, res) => {
  const orderId = Number(req.params.orderId);
  const itemId = Number(req.body && req.body.item_id);
  // picked_qty null/"" = destildar (vuelve a "sin controlar"). Numero >= 0 =
  // controlado con esa cantidad: 0 es valido ("no hay stock") y tambien puede
  // ser MAYOR a la pedida (redondear la caja). Sin tope superior.
  const rawQty = req.body ? req.body.picked_qty : undefined;
  const uncheck = rawQty === null || rawQty === undefined || rawQty === "";
  let qty = Number(rawQty);
  if (!orderId || !itemId || (!uncheck && (!isFinite(qty) || qty < 0))) {
    return res.status(400).json({ error: "item_id y picked_qty requeridos" });
  }
  const item = db.prepare("SELECT id, quantity FROM order_items WHERE id = ? AND order_id = ?").get(itemId, orderId);
  if (!item) return res.status(404).json({ error: "Item no encontrado en este pedido" });
  if (uncheck) {
    db.prepare(
      "UPDATE order_items SET pick_checked = 0, picked_qty = 0, picked_by = NULL, picked_at = NULL WHERE id = ?"
    ).run(itemId);
    qty = 0;
  } else {
    db.prepare(
      "UPDATE order_items SET pick_checked = 1, picked_qty = ?, picked_by = ?, picked_at = datetime('now') WHERE id = ?"
    ).run(qty, req.session.userId, itemId);
  }
  const agg = db.prepare(
    "SELECT COUNT(*) AS total," +
    "       SUM(CASE WHEN COALESCE(pick_checked,0) = 1 THEN 1 ELSE 0 END) AS done" +
    "  FROM order_items WHERE order_id = ?"
  ).get(orderId);
  res.json({
    ok: true,
    item_id: itemId,
    picked_qty: qty,
    pick_checked: uncheck ? 0 : 1,
    total_items: agg.total,
    done_items: agg.done || 0,
    complete: agg.total > 0 && Number(agg.done) === Number(agg.total),
  });
});

// Confirmar el chequeo de armado (botón explícito del modal): aplica las
// cantidades controladas al pedido de origen. Items CONTROLADOS (pick_checked)
// con cantidad distinta a la pedida: quantity pasa a lo armado (puede ser
// mayor a lo pedido — redondeo de caja); controlados en 0 se QUITAN del pedido
// (no habia stock). Items sin controlar NO se tocan. Cada diferencia queda
// registrada en pick_changes (visible en el detalle del pedido y en la
// notificacion del cliente). Stock-aware como PUT /api/admin/orders/:id/items:
// si el stock ya estaba descontado (presupuesto facturado), se ajusta por la
// diferencia. Mantiene en sync el débito de cuenta corriente si existe.
app.post("/api/admin/picks/:orderId/apply", requireAdmin, (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!orderId) return res.status(400).json({ error: "ID invalido" });
  const order = db.prepare(
    "SELECT id, status, total, stock_discounted, unified_parent_id, is_unified FROM orders WHERE id = ?"
  ).get(orderId);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  if (order.status === "cancelado" || order.status === "entregado") {
    return res.status(409).json({ error: "No se puede modificar un pedido " + order.status });
  }

  const items = db.prepare(
    "SELECT id, product_id, product_code, product_name, quantity, unit_price," +
    "       COALESCE(picked_qty,0) AS picked_qty, COALESCE(pick_checked,0) AS pick_checked" +
    "  FROM order_items WHERE order_id = ?"
  ).all(orderId);
  const changes = items.filter(
    (i) => Number(i.pick_checked) === 1 && Number(i.picked_qty) !== Number(i.quantity)
  );
  if (!changes.length) {
    // Chequeo confirmado sin diferencias: igual queda asentado en actividad.
    logActivity(req, "pedido", "Pedido #" + orderId + " · chequeo de armado confirmado sin diferencias");
    return res.json({ ok: true, changed: 0, total: order.total, changes: [] });
  }

  const linkedBudgetOut = db.prepare(
    "SELECT stock_discounted FROM budgets WHERE order_id = ? AND stock_discounted = 1 LIMIT 1"
  ).get(orderId);
  const anyLinkedBudget = db.prepare("SELECT id FROM budgets WHERE order_id = ? LIMIT 1").get(orderId);
  const skipStock = order.unified_parent_id != null || !!order.is_unified;
  const stockCurrentlyOut = anyLinkedBudget ? !!linkedBudgetOut : !!order.stock_discounted;

  let total = 0;
  db.transaction(() => {
    const updItem = db.prepare("UPDATE order_items SET quantity = ?, subtotal = ? WHERE id = ?");
    const delItem = db.prepare("DELETE FROM order_items WHERE id = ?");
    const adjStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    const insChange = db.prepare(
      "INSERT INTO pick_changes (order_id, product_code, product_name, old_qty, new_qty, changed_by)" +
      " VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const it of changes) {
      const newQty = Number(it.picked_qty);
      if (newQty <= 0) {
        // Controlado en 0 = no habia stock: el item se quita del pedido.
        delItem.run(it.id);
      } else {
        updItem.run(newQty, round2(Number(it.unit_price) * newQty), it.id);
      }
      // Stock ya descontado: devolver/descontar la diferencia (viejo - nuevo).
      // Si se armo de mas (newQty > pedido) el delta es negativo y descuenta.
      if (stockCurrentlyOut && !skipStock && it.product_id) {
        const deltaPick = Number(it.quantity) - newQty;
        adjStock.run(deltaPick, it.product_id);
        logStockMovement(it.product_id, "armado", deltaPick, orderId, "Chequeo de armado del pedido #" + orderId, req.session.userId);
      }
      insChange.run(orderId, it.product_code || null, it.product_name || null,
        Number(it.quantity), newQty, req.session.userId);
    }
    total = round2(
      db.prepare("SELECT COALESCE(SUM(subtotal),0) AS t FROM order_items WHERE order_id = ?").get(orderId).t
    );
    db.prepare("UPDATE orders SET total = ? WHERE id = ?").run(total, orderId);
    if (!order.is_unified) {
      const deb = db.prepare(
        "SELECT id FROM account_movements WHERE order_id = ? AND type = 'debit' LIMIT 1"
      ).get(orderId);
      if (deb) db.prepare("UPDATE account_movements SET amount = ? WHERE id = ?").run(total, deb.id);
    }
  })();

  logActivity(req, "pedido", "Pedido #" + orderId + " · chequeo de armado confirmado (" +
    changes.length + " cambios) · nuevo total $" + total);
  res.json({
    ok: true,
    changed: changes.length,
    total: total,
    changes: changes.map((c) => ({
      product_name: c.product_name,
      old_qty: Number(c.quantity),
      new_qty: Number(c.picked_qty),
    })),
  });
});

app.get("/api/orders/:id", requireLogin, requireSectionForAdmin("pedidos"), (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const isAdmin = req.session.level === 99;
  const isVendedor = req.session.level === 5;
  let order;
  if (isAdmin) {
    order = db.prepare(
      "SELECT o.*, u.username, u.full_name, u.level AS client_level," +
      "       u.price_list_id AS client_price_list_id," +
      "       v.username AS vendedor_username, v.full_name AS vendedor_full_name," +
      "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at, d.caja_id, d.caja_transfer_id, d.notes AS delivery_notes" +
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
      "       d.id AS delivery_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount, d.delivered_at, d.caja_id, d.caja_transfer_id" +
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
    "SELECT id, product_id, product_code, product_name, quantity, unit_price, COALESCE(discount_percent,0) AS discount_percent, subtotal" +
    "  FROM order_items WHERE order_id = ? ORDER BY id"
  ).all(id);
  // Descuento total del pedido por los descuentos por linea (= Σ bruto − Σ subtotal).
  // Visible para todos los roles (el cliente tambien ve cuanto se le desconto).
  let itemsDiscountTotal = 0;
  items.forEach((it) => {
    itemsDiscountTotal += Math.max(0, round2((Number(it.unit_price) || 0) * (Number(it.quantity) || 0) - (Number(it.subtotal) || 0)));
  });
  itemsDiscountTotal = round2(itemsDiscountTotal);
  // Saldo del pedido desde la cuenta corriente: balance_due = débitos − créditos,
  // amount_paid = créditos (cobro de la entrega + pagos asociados al pedido).
  const pay = db.prepare(
    "SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END),0) AS balance_due," +
    "       COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END),0) AS amount_paid" +
    "  FROM account_movements WHERE order_id = ?"
  ).get(id);
  // Rentabilidad del pedido (SOLO admin): margen bruto contra el costo ACTUAL del
  // producto (products.cost). revenue = Σ unit_price·qty ; cost = Σ cost·qty ;
  // profit = revenue − cost ; margin% = profit/revenue·100. Items cuyo producto
  // ya no existe o tiene costo NULL cuentan costo 0 (la ganancia sale inflada;
  // conviene tener los costos cargados).
  let profitability = null;
  if (isAdmin) {
    const pr = db.prepare(
      "SELECT COALESCE(SUM(oi.unit_price * oi.quantity),0) AS gross," +
      "       COALESCE(SUM(oi.subtotal),0) AS net_items," +
      "       COALESCE(SUM(COALESCE(p.cost,0) * oi.quantity),0) AS cost_total" +
      "  FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id" +
      "  WHERE oi.order_id = ?"
    ).get(id);
    const grossItems = Number(pr.gross) || 0;       // Σ precio de lista · qty
    const netItems = Number(pr.net_items) || 0;     // Σ subtotal (con descuento por linea)
    const itemsDiscount = Math.max(0, round2(grossItems - netItems));
    const discount = Number(order.discount_amount) || 0;   // descuento de entrega/cobro (aparte)
    const revenue = Math.max(0, netItems - discount);      // ventas netas finales
    const costTotal = Number(pr.cost_total) || 0;
    const profit = revenue - costTotal;
    profitability = {
      revenue_gross: grossItems,
      items_discount: itemsDiscount,
      revenue_items: netItems,
      discount: discount,
      revenue: revenue,
      cost_total: costTotal,
      profit: profit,
      margin_pct: revenue > 0 ? round2((profit / revenue) * 100) : 0,
    };
    // Comisión del vendedor asignado (snapshot vendedor_cost_unit): lo que gana
    // el vendedor sobre la venta = Σ (unit_price − vendedor_cost_unit)·qty sobre
    // los items con snapshot. Items sin snapshot (cliente sin lista) aportan 0.
    if (order.assigned_vendedor_id) {
      const vr = db.prepare(
        "SELECT COALESCE(SUM(CASE WHEN vendedor_cost_unit IS NOT NULL" +
        "                        THEN (unit_price - vendedor_cost_unit) * quantity ELSE 0 END),0) AS earning" +
        "  FROM order_items WHERE order_id = ?"
      ).get(id);
      const v = db.prepare(
        "SELECT id, full_name, username, is_tercerizado FROM users WHERE id = ?"
      ).get(order.assigned_vendedor_id);
      if (v) {
        profitability.vendor = {
          id: v.id,
          name: v.full_name || v.username || ("Vendedor #" + v.id),
          is_tercerizado: !!v.is_tercerizado,
          earning: Number(vr.earning) || 0,
        };
      }
    }
  }
  // Cambios confirmados del chequeo de armado (visibles para todos los roles:
  // el cliente tambien tiene que enterarse si se le quito o cambio un item).
  const pickChanges = db.prepare(
    "SELECT product_code, product_name, old_qty, new_qty, created_at" +
    "  FROM pick_changes WHERE order_id = ? ORDER BY id"
  ).all(id);
  res.json(Object.assign({}, order, {
    items: items,
    items_discount_total: itemsDiscountTotal,
    balance_due: pay.balance_due,
    amount_paid: pay.amount_paid,
    // Efectivo real cobrado del pedido (entrega + pagos), para el split de comisión.
    cash_collected: isAdmin ? cashCollectedForOrder(id) : undefined,
    profitability: profitability,
    pick_changes: pickChanges,
  }));
});

// ----- Cambio de estado (admin o vendedor asignado) -----
app.patch("/api/orders/:id", requireLogin, requireSectionForAdmin("pedidos"), (req, res) => {
  const isAdmin = req.session.level === 99;
  const isVendedor = req.session.level === 5;
  if (!isAdmin && !isVendedor)
    return res.status(403).json({ error: "Solo el admin o vendedor puede cambiar estados" });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const { status } = req.body || {};
  const valid = ["pendiente", "enviado", "preparando", "listo", "entregado", "cancelado"];
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

  // Transiciones bloqueadas (rompen contabilidad/stock):
  // - "entregado" solo puede pasar a cancelado: volverlo a pendiente dejaria el
  //   debito vivo y el stock descontado en un pedido "sin entregar".
  // - "cancelado" solo puede reactivarse a pendiente: re-entra al circuito y el
  //   stock/debito se re-aplican al entregarlo (mismo camino que pedidos legacy).
  if (prevStatus === "entregado" && status !== "entregado" && status !== "cancelado")
    return res.status(409).json({ error: "Un pedido entregado solo puede cancelarse" });
  if (prevStatus === "cancelado" && status !== "cancelado" && status !== "pendiente")
    return res.status(409).json({ error: "Un pedido cancelado solo puede reactivarse a Pendiente" });

  // Los pedidos individuales que ya fueron absorbidos por un unificado NO
  // descuentan stock por su cuenta: el descuento se hace una sola vez cuando
  // el admin entrega el pedido unificado padre.
  // Tampoco descuentan si tienen un budget vinculado que ya lo hizo al crearse.
  const linkedBudgetForOrder = db.prepare(
    "SELECT stock_discounted FROM budgets WHERE order_id = ? AND stock_discounted = 1 LIMIT 1"
  ).get(id);
  const skipStock = order.unified_parent_id != null || !!linkedBudgetForOrder;

  // ¿El stock de este pedido está actualmente descontado? Los pedidos del
  // catálogo descuentan stock al ENVIARSE (al crearse), anotándolo en el
  // presupuesto vinculado (budgets.stock_discounted=1), no en orders. Si hay
  // presupuesto vinculado, ese flag es la fuente de verdad; si no (ej: pedido
  // unificado del tercerizado), usamos orders.stock_discounted. Sirve para
  // saber si al cancelar hay que devolver stock (y evitar devolverlo dos veces).
  const anyLinkedBudget = db.prepare(
    "SELECT id FROM budgets WHERE order_id = ? LIMIT 1"
  ).get(id);
  const stockCurrentlyOut = anyLinkedBudget ? !!linkedBudgetForOrder : !!order.stock_discounted;

  db.transaction(() => {
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);

    // Al marcar "entregado": descontar stock y generar debito en cuenta corriente
    if (status === "entregado" && prevStatus !== "entregado" && !order.stock_discounted) {
      if (!skipStock) {
        const items = db.prepare(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
        ).all(id);
        const updStock = db.prepare(
          "UPDATE products SET stock = stock - ? WHERE id = ?"
        );
        for (const it of items) {
          if (it.product_id) {
            updStock.run(it.quantity, it.product_id);
            logStockMovement(it.product_id, "venta", -it.quantity, id, "Pedido #" + id + " entregado", req.session.userId);
          }
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

    // Al cancelar: devolver stock (para que el producto vuelva al catálogo) y
    // eliminar el débito en cuenta corriente. El stock se descuenta al ENVIAR
    // el pedido (al crearse, anotado en el presupuesto vinculado) o al
    // entregarlo; en ambos casos hay que devolverlo acá.
    if (status === "cancelado" && prevStatus !== "cancelado" && stockCurrentlyOut) {
      // Los hijos absorbidos por un pedido unificado no devuelven stock por su
      // cuenta: lo maneja el pedido padre.
      if (order.unified_parent_id == null) {
        const items = db.prepare(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
        ).all(id);
        const retStock = db.prepare(
          "UPDATE products SET stock = stock + ? WHERE id = ?"
        );
        for (const it of items) {
          if (it.product_id) {
            retStock.run(it.quantity, it.product_id);
            logStockMovement(it.product_id, "cancelacion", it.quantity, id, "Pedido #" + id + " cancelado", req.session.userId);
          }
        }
      }
      // Mantener en sync el presupuesto vinculado: cancelarlo y limpiar su flag
      // para no devolver stock dos veces si luego se cancela desde Presupuestos.
      if (anyLinkedBudget) {
        db.prepare(
          "UPDATE budgets SET status = 'cancelado', stock_discounted = 0," +
          "  updated_at = datetime('now') WHERE id = ? AND status != 'facturado'"
        ).run(anyLinkedBudget.id);
      }
      db.prepare(
        "DELETE FROM account_movements WHERE order_id = ? AND type = 'debit'"
      ).run(id);
      db.prepare("UPDATE orders SET stock_discounted = 0 WHERE id = ?").run(id);
    }

    // Al cancelar un pedido que tenia entrega registrada: revertir la plata de
    // caja (ingresos de la entrega + egreso de comision del vendedor) y borrar
    // la entrega. Sin esto la caja quedaba sobreestimada y la tarjeta seguia
    // mostrando "Ver entrega". Los pagos (payments) NO se tocan: si el cliente
    // pago de verdad, ese registro se gestiona desde Pagos.
    if (status === "cancelado" && prevStatus !== "cancelado") {
      const dlv = db.prepare("SELECT id FROM deliveries WHERE order_id = ?").get(id);
      if (dlv) {
        db.prepare(
          "DELETE FROM cash_movements WHERE source = 'entrega' AND related_id = ?"
        ).run(dlv.id);
        db.prepare("DELETE FROM deliveries WHERE id = ?").run(dlv.id);
      }
      db.prepare(
        "DELETE FROM cash_movements WHERE source = 'comision' AND related_id = ?"
      ).run(id);
      // Anular los créditos automáticos de la entrega/descuento de este pedido.
      // Al cancelar, la plata cobrada se revierte (la caja ya se revirtió arriba),
      // así el pedido cancelado no deja saldo a favor fantasma en la cuenta
      // corriente. El "Cobro entrega" es un auto-crédito de la entrega (sin
      // payment_id); el "Descuento pedido" es una rebaja del pedido que se anula
      // venga de una entrega (sin payment_id) o de un cobro (con payment_id). Los
      // pagos reales de la pestaña Pagos ("Cobro pedido"/"Pago", con payment_id)
      // NO se tocan: esos se gestionan aparte.
      db.prepare(
        "DELETE FROM account_movements WHERE order_id = ? AND type = 'credit'" +
        "   AND ( (payment_id IS NULL AND description LIKE 'Cobro entrega%')" +
        "         OR description LIKE 'Descuento pedido%' )"
      ).run(id);
      // El descuento guardado en el pedido queda sin efecto al cancelar.
      db.prepare(
        "UPDATE orders SET discount_type = NULL, discount_value = NULL, discount_amount = 0 WHERE id = ?"
      ).run(id);
    }
  })();

  res.json({ ok: true, id: id, status: status });
});

// ----- Notificaciones de circuito para el cliente -----
// Devuelve los pedidos del usuario logueado cuyo estado avanzo a "preparando"
// (en armado), "listo" (listo para entregar) o "entregado" desde la ultima vez
// que se le notifico, y los marca como notificados. El catalogo llama a este
// endpoint al ingresar para mostrarle un aviso ("tu pedido se esta preparando").
app.get("/api/my-notifications", requireLogin, (req, res) => {
  const uid = req.session.userId;
  const rows = db.prepare(
    "SELECT id, status FROM orders" +
    "  WHERE user_id = ? AND status IN ('preparando','listo','entregado')" +
    "    AND COALESCE(is_unified,0) = 0" +
    "    AND (notified_status IS NULL OR notified_status != status)" +
    "  ORDER BY id DESC LIMIT 20"
  ).all(uid);
  if (rows.length) {
    const upd = db.prepare("UPDATE orders SET notified_status = status WHERE id = ?");
    db.transaction(() => { for (const r of rows) upd.run(r.id); })();
  }
  const MSG = {
    preparando: "se está armando",
    listo: "está para entregar",
    entregado: "fue entregado",
  };
  // Si en el armado hubo cambios confirmados (faltantes / redondeo de caja),
  // se comunican en el mismo aviso para que el cliente no se sorprenda.
  const chgStmt = db.prepare(
    "SELECT product_name, old_qty, new_qty FROM pick_changes WHERE order_id = ? ORDER BY id"
  );
  res.json(rows.map((r) => {
    let msg = "Tu pedido #" + r.id + " " + (MSG[r.status] || ("pasó a " + r.status));
    const chg = chgStmt.all(r.id);
    if (chg.length) {
      msg += ". Cambios en el armado: " + chg.map((c) =>
        c.product_name + " " + Number(c.old_qty) + " → " +
        (Number(c.new_qty) > 0 ? Number(c.new_qty) : "sin stock (quitado)")
      ).join(", ");
    }
    return { order_id: r.id, status: r.status, message: msg };
  }));
});

// Crear pedido desde el panel admin (sin restricciones de vendedor/WA).
app.post("/api/admin/orders", requireAdmin, (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return res.status(400).json({ error: "El pedido debe tener al menos un artículo" });
  const status = ["pendiente","enviado","preparando"].includes(b.status) ? b.status : "pendiente";
  const notes = String(b.notes || "").trim() || null;
  const clientId = b.client_id ? Number(b.client_id) : null;
  // Validar el cliente: tiene que existir, estar activo y ser un cliente real
  // (level 1-4). Sin esto se aceptaba cualquier id: uno inexistente reventaba
  // por FK (500) y uno de vendedor/admin generaba un debito en su cuenta.
  let assignedVendedorId = null;
  if (clientId) {
    const client = db.prepare("SELECT id, level, active, assigned_vendedor_id FROM users WHERE id = ?").get(clientId);
    if (!client) return res.status(400).json({ error: "El cliente no existe" });
    if (!client.active) return res.status(400).json({ error: "El cliente esta inactivo" });
    if (Number(client.level) < 1 || Number(client.level) > 4)
      return res.status(400).json({ error: "El usuario elegido no es un cliente (nivel 1-4)" });
    if (client.assigned_vendedor_id) assignedVendedorId = client.assigned_vendedor_id;
  }
  const userId = clientId || req.session.userId;
  // Descuento por linea (0..100). subtotal = round2(unit_price*qty*(1-d/100)).
  const clampPct = (p) => Math.max(0, Math.min(100, Number(p) || 0));
  // unit_price clampeado a >= 0: un negativo generaba total y debito negativos.
  const total = round2(items.reduce((s, it) => {
    const q = Math.max(1, Math.round(Number(it.quantity) || 1));
    const pr = Math.max(0, round2(Number(it.unit_price) || 0));
    return s + round2(pr * q * (1 - clampPct(it.discount_percent) / 100));
  }, 0));
  // Snapshot del costo del vendedor (vendedor_cost_unit): si el cliente tiene
  // lista personalizada, guardamos el precio base (price_<base_level>) por item,
  // así se puede calcular la comisión del vendedor. Mismo criterio que el
  // catálogo (POST /api/orders) y la edición de items (PUT .../items). Sin lista
  // → NULL → sin comisión diferencial.
  const orderCfg = clientId
    ? getEffectivePriceConfig(clientId, (db.prepare("SELECT level FROM users WHERE id = ?").get(clientId) || {}).level || 1)
    : { kind: "level" };
  const getCostPrice = orderCfg.kind === "list"
    ? db.prepare("SELECT " + orderCfg.column + " AS base_price FROM products WHERE id = ?")
    : null;
  const result = db.transaction(() => {
    // El pedido descuenta stock al CREARSE (stock_discounted=1), no al entregar:
    // así "En armado" ya refleja la baja de stock. Como el admin puede crear
    // pedidos de productos sin stock (se reponen y entregan luego), no se clampa
    // en 0 (misma política que facturar un presupuesto como admin).
    const orderId = db.prepare(
      "INSERT INTO orders (user_id, status, total, notes, assigned_vendedor_id, stock_discounted) VALUES (?,?,?,?,?,1)"
    ).run(userId, status, total, notes, assignedVendedorId).lastInsertRowid;
    const ins = db.prepare(
      "INSERT INTO order_items (order_id,product_id,product_code,product_name,quantity,unit_price,discount_percent,subtotal,vendedor_cost_unit) " +
      "VALUES (?,?,?,?,?,?,?,?,?)"
    );
    const updStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
    items.forEach((it) => {
      const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
      const price = Math.max(0, round2(Number(it.unit_price) || 0));
      const disc = clampPct(it.discount_percent);
      const sub = round2(price * qty * (1 - disc / 100));
      let costUnit = null;
      if (getCostPrice && it.product_id) {
        const cp = getCostPrice.get(it.product_id);
        if (cp && cp.base_price != null) costUnit = Math.round(Number(cp.base_price));
      }
      ins.run(orderId, it.product_id || null, it.product_code || "", it.product_name || "", qty, price, disc, sub, costUnit);
      if (it.product_id) {
        updStock.run(qty, it.product_id);
        logStockMovement(it.product_id, "venta", -qty, orderId, "Pedido #" + orderId + " (creado desde admin)", req.session.userId);
      }
    });
    // Si el pedido es a nombre de un cliente real, debitar su cuenta corriente
    // ahora (misma lógica que facturar un presupuesto). Al pasar a 'entregado'
    // el PATCH no vuelve a debitar ni a descontar stock porque stock_discounted
    // ya es 1; al cancelar, devuelve stock y borra este débito.
    if (clientId) {
      db.prepare(
        "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
        " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
      ).run(clientId, total, "Pedido #" + orderId, orderId);
    }
    return orderId;
  })();
  const order = db.prepare(
    "SELECT o.*, u.username, u.full_name, " +
    "v.full_name AS vendedor_full_name, v.username AS vendedor_username " +
    "FROM orders o LEFT JOIN users u ON u.id = o.user_id " +
    "LEFT JOIN users v ON v.id = o.assigned_vendedor_id WHERE o.id = ?"
  ).get(result);
  res.json(order);
});

// Eliminar un pedido (solo admin, no entregados).
app.delete("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const order = db.prepare("SELECT id, status, stock_discounted FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  if (order.status === "entregado") return res.status(409).json({ error: "No se puede eliminar un pedido ya entregado" });
  db.transaction(() => {
    // Devolver stock si ya había sido descontado.
    if (order.stock_discounted) {
      const ois = db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").all(id);
      const upd = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
      ois.forEach((it) => {
        upd.run(it.quantity, it.product_id);
        if (it.product_id) logStockMovement(it.product_id, "cancelacion", it.quantity, id, "Pedido #" + id + " eliminado", req.session.userId);
      });
    }
    // Desligar presupuestos que referencian este pedido (FK: budgets.order_id).
    db.prepare("UPDATE budgets SET order_id = NULL WHERE order_id = ?").run(id);
    // Eliminar movimiento de cuenta corriente asociado si existe.
    db.prepare("DELETE FROM account_movements WHERE order_id = ?").run(id);
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);
    db.prepare("DELETE FROM deliveries WHERE order_id = ?").run(id);
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  })();
  res.json({ ok: true });
});

// Editar items de un pedido (solo admin): reemplaza todos los items y recalcula el total
app.put("/api/admin/orders/:id/items", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const order = db.prepare(
    "SELECT id, user_id, total, status, stock_discounted, unified_parent_id, is_unified FROM orders WHERE id = ?"
  ).get(id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  // Los pedidos cancelados no se editan (estado final sin vuelta atrás).
  // Los entregados sí: puede haberse olvidado cargar un item y es necesario corregirlo.
  if (order.status === "cancelado") {
    return res.status(409).json({ error: "No se puede editar un pedido cancelado" });
  }

  const rawItems = req.body && Array.isArray(req.body.items) ? req.body.items : [];
  if (!rawItems.length) return res.status(400).json({ error: "El pedido debe tener al menos 1 item" });

  // Para recalcular el costo del vendedor (snapshot) usamos la lista actual
  // del cliente. Si no tiene lista personalizada, el costo queda NULL.
  const cliRow = db.prepare("SELECT level FROM users WHERE id = ?").get(order.user_id) || {};
  const cfg = getEffectivePriceConfig(order.user_id, cliRow.level || 1);
  const getCostPrice = cfg.kind === "list"
    ? db.prepare("SELECT " + cfg.column + " AS base_price FROM products WHERE id = ?")
    : null;

  const clampPct = (p) => Math.max(0, Math.min(100, Number(p) || 0));
  const lines = [];
  let total = 0;
  for (const it of rawItems) {
    const productId = Number(it.product_id);
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const unitPrice = round2(Math.max(0, Number(it.unit_price) || 0));
    const discPct = clampPct(it.discount_percent);
    if (!productId) continue;
    const prod = db.prepare("SELECT id, code, name FROM products WHERE id = ?").get(productId);
    if (!prod) continue;
    const productName = String(it.product_name || prod.name || "").trim().slice(0, 200);
    const productCode = String(it.product_code || prod.code || "").trim().slice(0, 50);
    const subtotal = round2(unitPrice * qty * (1 - discPct / 100));
    let costUnit = null;
    if (getCostPrice) {
      const cp = getCostPrice.get(productId);
      costUnit = cp ? round2(Number(cp.base_price) || 0) : null;
    }
    total += subtotal;
    lines.push({ product_id: productId, product_code: productCode, product_name: productName,
                 quantity: qty, unit_price: unitPrice, discount_percent: discPct, subtotal, vendedor_cost_unit: costUnit });
  }
  if (!lines.length) return res.status(400).json({ error: "Ningún item válido" });

  // ¿El stock de este pedido ya está descontado? Si lo está (p.ej. un pedido que
  // viene de un presupuesto facturado, que descuenta al crearse), al cambiar los
  // items hay que ajustar el stock por la diferencia para que quede consistente.
  // Si todavía no está descontado (pedido del catálogo pre-entrega), no se toca:
  // el descuento se hará al entregar, ya con los items nuevos. Los pedidos
  // unificados / hijos absorbidos no ajustan stock por su cuenta.
  const linkedBudgetOut = db.prepare(
    "SELECT stock_discounted FROM budgets WHERE order_id = ? AND stock_discounted = 1 LIMIT 1"
  ).get(id);
  const anyLinkedBudget = db.prepare("SELECT id FROM budgets WHERE order_id = ? LIMIT 1").get(id);
  const skipStock = order.unified_parent_id != null || !!order.is_unified;
  const stockCurrentlyOut = anyLinkedBudget ? !!linkedBudgetOut : !!order.stock_discounted;

  // MERGE (no DELETE+INSERT) para conservar el chequeo de armado de los items
  // que no cambian: items sin cambios mantienen pick_checked/picked_qty; los que
  // cambian de cantidad (o se agregan) quedan SIN chequear para re-armarlos; un
  // cambio que solo toca el precio no invalida el armado. Se matchea por
  // product_id (un producto aparece una sola vez por pedido).
  const oldItems = db.prepare(
    "SELECT id, product_id, quantity, COALESCE(pick_checked,0) AS pick_checked, product_code, product_name" +
    "  FROM order_items WHERE order_id = ?"
  ).all(id);
  const oldByProduct = new Map();
  for (const o of oldItems) if (o.product_id) oldByProduct.set(o.product_id, o);

  // Si el pedido estaba en la cola de Entregas ("listo") y la edición cambia
  // cantidades / agrega / quita items, vuelve a Armado (preparando) para preparar
  // los cambios, y estos quedan registrados en pick_changes (mismo bloque que los
  // cambios del armado).
  const wasListo = order.status === "listo";
  const changes = [];        // {product_code, product_name, old_qty, new_qty}
  let hadQtyChange = false;  // hubo cambios de cantidad / alta / baja de items

  db.transaction(() => {
    const newProductIds = new Set(lines.map((l) => l.product_id));
    const adjStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    const insItem = db.prepare(
      "INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, discount_percent, subtotal, vendedor_cost_unit, pick_checked, picked_qty)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)"
    );
    const updQtyItem = db.prepare(
      "UPDATE order_items SET product_code=?, product_name=?, quantity=?, unit_price=?, discount_percent=?, subtotal=?, vendedor_cost_unit=?," +
      " pick_checked=0, picked_qty=0, picked_by=NULL, picked_at=NULL WHERE id=?"
    );
    const updPriceItem = db.prepare(
      "UPDATE order_items SET product_code=?, product_name=?, unit_price=?, discount_percent=?, subtotal=?, vendedor_cost_unit=? WHERE id=?"
    );
    const delItem = db.prepare("DELETE FROM order_items WHERE id=?");

    // Items quitados (estaban en el pedido y ya no): borrar + devolver stock.
    for (const o of oldItems) {
      if (!o.product_id || !newProductIds.has(o.product_id)) {
        delItem.run(o.id);
        if (stockCurrentlyOut && !skipStock && o.product_id) {
          adjStock.run(o.quantity, o.product_id);
          logStockMovement(o.product_id, "edicion_pedido", o.quantity, id, "Edicion de items del pedido #" + id + " (item quitado)", req.session.userId);
        }
        hadQtyChange = true;
        changes.push({ product_code: o.product_code, product_name: o.product_name, old_qty: o.quantity, new_qty: 0 });
      }
    }
    // Items nuevos y modificados.
    for (const l of lines) {
      const old = oldByProduct.get(l.product_id);
      if (!old) {
        insItem.run(id, l.product_id, l.product_code, l.product_name, l.quantity, l.unit_price, l.discount_percent, l.subtotal, l.vendedor_cost_unit);
        if (stockCurrentlyOut && !skipStock) {
          adjStock.run(-l.quantity, l.product_id);
          logStockMovement(l.product_id, "edicion_pedido", -l.quantity, id, "Edicion de items del pedido #" + id + " (item agregado)", req.session.userId);
        }
        hadQtyChange = true;
        changes.push({ product_code: l.product_code, product_name: l.product_name, old_qty: 0, new_qty: l.quantity });
      } else if (Number(old.quantity) !== Number(l.quantity)) {
        updQtyItem.run(l.product_code, l.product_name, l.quantity, l.unit_price, l.discount_percent, l.subtotal, l.vendedor_cost_unit, old.id);
        if (stockCurrentlyOut && !skipStock) {
          const deltaEdit = Number(old.quantity) - Number(l.quantity);
          adjStock.run(deltaEdit, l.product_id);
          logStockMovement(l.product_id, "edicion_pedido", deltaEdit, id, "Edicion de items del pedido #" + id + " (cantidad cambiada)", req.session.userId);
        }
        hadQtyChange = true;
        changes.push({ product_code: l.product_code, product_name: l.product_name, old_qty: old.quantity, new_qty: l.quantity });
      } else {
        // Misma cantidad: actualizar precio/descuento/nombre/código/costo, conservar chequeo.
        updPriceItem.run(l.product_code, l.product_name, l.unit_price, l.discount_percent, l.subtotal, l.vendedor_cost_unit, old.id);
      }
    }

    total = round2(
      db.prepare("SELECT COALESCE(SUM(subtotal),0) AS t FROM order_items WHERE order_id = ?").get(id).t
    );
    db.prepare("UPDATE orders SET total = ? WHERE id = ?").run(total, id);

    // Volver a Armado + registrar los cambios (solo si venía de Entregas y hubo
    // cambios de cantidad/items; un cambio solo de precio no re-arma).
    if (wasListo && hadQtyChange) {
      db.prepare("UPDATE orders SET status = 'preparando' WHERE id = ?").run(id);
      const insChange = db.prepare(
        "INSERT INTO pick_changes (order_id, product_code, product_name, old_qty, new_qty, changed_by)" +
        " VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const c of changes) insChange.run(id, c.product_code || null, c.product_name || null, c.old_qty, c.new_qty, req.session.userId);
    }

    // Mantener en sync el débito de cuenta corriente si ya existe (pedidos
    // entregados o presupuestos facturados generan un débito por el total).
    if (!order.is_unified) {
      const deb = db.prepare("SELECT id FROM account_movements WHERE order_id = ? AND type = 'debit' LIMIT 1").get(id);
      if (deb) db.prepare("UPDATE account_movements SET amount = ? WHERE id = ?").run(total, deb.id);
    }
  })();

  const backToArmado = wasListo && hadQtyChange;
  if (backToArmado) {
    logActivity(req, "pedido", "Pedido #" + id + " · editado en Entregas, vuelve a Armado (" +
      changes.length + " cambios)");
  }
  const updatedItems = db.prepare(
    "SELECT id, product_id, product_code, product_name, quantity, unit_price, COALESCE(discount_percent,0) AS discount_percent, subtotal, vendedor_cost_unit" +
    "  FROM order_items WHERE order_id = ? ORDER BY id"
  ).all(id);
  res.json({
    ok: true,
    total,
    items: updatedItems,
    status: backToArmado ? "preparando" : order.status,
    back_to_armado: backToArmado,
  });
});

// ===== Panel admin =====
// Admin (99) accede completo; Vendedor (5) accede con funciones limitadas (solo Pedidos asignados).
app.get("/admin", requireVendedorOrAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ===== Pagina de Ventas / Presupuestos =====
// Reemplaza al overlay que vivia dentro del catalogo. Admin y vendedores.
app.get("/ventas", requireVendedorOrAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ventas.html"));
});

// Lista completa de productos (admin ve TODOS, incluso sin stock o inactivos)
app.get("/api/admin/products", requireAdmin, (req, res) => {
  const sql =
    "SELECT p.id, p.code, p.category_id, c.name AS category_name, p.name," +
    "       p.cost, p.price_minorista, p.price_revendedor, p.price_mayorista," +
    "       p.price_vip, p.price_publico, p.stock, p.stock_min, p.active, p.image_url," +
    "       p.units_per_bulto, p.pack_unit, COALESCE(p.expiry_alert_months, 3) AS expiry_alert_months" +
    "  FROM products p LEFT JOIN categories c ON c.id = p.category_id" +
    "  ORDER BY c.sort_order, c.name, p.name";
  res.json(db.prepare(sql).all());
});

// Crear producto nuevo
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { code, name, category_id, cost, price_minorista, price_revendedor,
          price_mayorista, price_vip, price_publico, stock, stock_min } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Nombre requerido" });
  if (!code || !String(code).trim()) return res.status(400).json({ error: "Código requerido" });
  // Mismo recorte que coerceProductField (el PATCH ya recortaba, el POST no).
  const codeClean = String(code).trim().slice(0, 50);
  const existing = db.prepare("SELECT id FROM products WHERE code=?").get(codeClean);
  if (existing) return res.status(409).json({ error: "Ya existe un producto con ese código" });
  // Validar la categoría si viene (igual que el PATCH): sin esto, una categoría
  // inexistente reventaba por FK con un 500 en vez de un 400 claro.
  const catId = category_id ? Number(category_id) : null;
  if (catId != null && !db.prepare("SELECT id FROM categories WHERE id = ?").get(catId)) {
    return res.status(400).json({ error: "Categoría inexistente" });
  }
  // Precios (costo + 5 niveles) admiten 2 decimales; stock / stock_min enteros.
  const numInt = (v) => { const n = Math.round(Number(v)); return isFinite(n) ? Math.max(0, n) : 0; };
  const numPrice = (v) => Math.max(0, round2(v));
  try {
    const r = db.prepare(
      "INSERT INTO products (code, name, category_id, cost, price_minorista, price_revendedor," +
      " price_mayorista, price_vip, price_publico, stock, stock_min, active)" +
      " VALUES (?,?,?,?,?,?,?,?,?,?,?,1)"
    ).run(
      codeClean,
      String(name).trim(),
      catId,
      numPrice(cost), numPrice(price_minorista), numPrice(price_revendedor),
      numPrice(price_mayorista), numPrice(price_vip), numPrice(price_publico),
      numInt(stock), numInt(stock_min)
    );
    // Devolver el producto creado (con category_name para el state del frontend)
    const created = db.prepare(
      "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?"
    ).get(r.lastInsertRowid);
    res.json({ ok: true, product: created });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return res.status(409).json({ error: "Código duplicado" });
    throw e;
  }
});

// Duplicar un producto ("crear gemelo"): crea una copia con TODOS los mismos
// campos (nombre, categoría, descripción, imagen, costo, precios/comisiones,
// stock_min, activo) pero con un código nuevo correlativo (el mayor código
// numérico + 1). El stock arranca en 0 porque es un SKU nuevo que todavía no se
// recibió: la compra que se está cargando le sumará el stock. Lo usa el menú
// contextual "Crear producto basado en este" del selector de Compras.
app.post("/api/admin/products/:id/duplicate", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const src = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!src) return res.status(404).json({ error: "Producto no encontrado" });

  // Código correlativo: el mayor valor numérico entre los códigos existentes + 1.
  const codes = db.prepare("SELECT code FROM products").all();
  let maxNum = 0;
  for (const row of codes) {
    const n = parseInt(String(row.code || "").trim(), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }
  let newCode = String(maxNum + 1);
  // Garantizar unicidad por las dudas (si hubiera un código no numérico igual).
  while (db.prepare("SELECT 1 FROM products WHERE code = ?").get(newCode)) {
    maxNum++;
    newCode = String(maxNum + 1);
  }

  const r = db.prepare(
    "INSERT INTO products (code, category_id, name, description, image_url, cost," +
    " price_minorista, price_revendedor, price_mayorista, price_vip, price_publico," +
    " stock, stock_min, active, units_per_bulto, pack_unit, expiry_alert_months)" +
    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    newCode, src.category_id, src.name, src.description || null, src.image_url || null,
    src.cost, src.price_minorista, src.price_revendedor, src.price_mayorista,
    src.price_vip, src.price_publico, 0, src.stock_min || 0,
    src.active != null ? src.active : 1,
    // Sin estos 3, el gemelo quedaba con units_per_bulto=1 y rompia la
    // conversion bultos<->unidades en Cotizaciones/Recepcion.
    src.units_per_bulto || 1, src.pack_unit || "bulto",
    src.expiry_alert_months != null ? src.expiry_alert_months : 3
  );
  const created = db.prepare(
    "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?"
  ).get(r.lastInsertRowid);
  res.json({ ok: true, product: created, source_id: id });
});

// Campos editables de un producto + su coerción. Compartido por el PATCH
// individual y por el bulk-update (selección múltiple).
const PRODUCT_EDITABLE = [
  "code", "name", "category_id", "cost", "price_minorista", "price_revendedor",
  "price_mayorista", "price_vip", "price_publico", "stock", "stock_min", "active",
  "image_url", "units_per_bulto", "pack_unit", "expiry_alert_months",
];
function coerceProductField(k, v) {
  if (k === "name") return String(v || "").trim().slice(0, 200);
  if (k === "code") return String(v || "").trim().slice(0, 50);
  if (k === "image_url") return String(v || "").trim().slice(0, 500) || null;
  if (k === "active") return v ? 1 : 0;
  if (k === "pack_unit") return ["unidad", "caja", "bulto"].includes(String(v)) ? String(v) : "bulto";
  if (k === "units_per_bulto") return Math.max(1, Math.round(Number(v)) || 1);
  if (k === "expiry_alert_months") { const n = Math.round(Number(v)); return isFinite(n) && n >= 0 ? n : 3; }
  if (k === "category_id") return (v == null || v === "" || Number(v) === 0) ? null : Math.round(Number(v));
  let n = Number(v); if (!isFinite(n)) n = 0;
  // Precios (costo + 5 niveles): 2 decimales. Stock / stock_min: enteros >= 0
  // (sin el clamp, el PATCH aceptaba stock negativo; el POST ya clampeaba).
  if (PRICE_FIELDS.includes(k)) return Math.max(0, round2(n));
  return Math.max(0, Math.round(n));
}
// Arma { cols, vals } desde un body con campos editables (no valida unicidad de código).
function buildProductUpdate(body) {
  const cols = [], vals = [];
  for (const k of PRODUCT_EDITABLE) {
    if (k in body) { cols.push(k); vals.push(coerceProductField(k, body[k])); }
  }
  return { cols, vals };
}

// Editar campos puntuales de un producto
app.patch("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const body = req.body || {};

  // El código es editable pero debe ser único: si se manda y ya lo tiene OTRO
  // producto, se rechaza con 409 (el frontend muestra el aviso y no cierra).
  if ("code" in body) {
    const code = String(body.code || "").trim();
    if (!code) return res.status(400).json({ error: "El código no puede estar vacío" });
    const dup = db.prepare("SELECT id FROM products WHERE code = ? AND id != ?").get(code, id);
    if (dup) return res.status(409).json({ error: "Ya existe un producto con el código " + code });
  }

  // Validar categoría si viene (FK), salvo que sea null (sin categoría).
  if ("category_id" in body) {
    const cid = coerceProductField("category_id", body.category_id);
    if (cid != null && !db.prepare("SELECT id FROM categories WHERE id = ?").get(cid)) {
      return res.status(400).json({ error: "Categoría inexistente" });
    }
  }
  const { cols, vals } = buildProductUpdate(body);
  if (!cols.length) return res.status(400).json({ error: "Nada para actualizar" });

  // Si el patch toca algún precio, snapshot ANTES para historizar el cambio.
  const touchesPrice = cols.some((c) => TRACKED_PRICE_COLS.includes(c));
  const priceCols = TRACKED_PRICE_COLS.join(", ");
  const before = touchesPrice
    ? db.prepare("SELECT " + priceCols + " FROM products WHERE id = ?").get(id)
    : null;
  // Si toca el costo, snapshot para el historial de inflacion (cost_changes).
  // Se usa el stock ANTES del update por si el mismo patch tambien cambia stock.
  const touchesCost = cols.includes("cost");
  const costBefore = touchesCost
    ? db.prepare("SELECT cost, stock FROM products WHERE id = ?").get(id)
    : null;
  // Si el modal de edición toca el stock directamente (no vía el modal de
  // ajuste ±), igual queda en el historial de movimientos como "ajuste manual".
  const touchesStock = cols.includes("stock");
  const stockBefore = touchesStock
    ? db.prepare("SELECT stock FROM products WHERE id = ?").get(id)
    : null;

  const sets = cols.map((c) => c + " = ?");
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  try {
    const r = db.prepare("UPDATE products SET " + sets.join(", ") + " WHERE id = ?").run(...vals);
    if (!r.changes) return res.status(404).json({ error: "Producto no encontrado" });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return res.status(409).json({ error: "Código duplicado" });
    throw e;
  }

  if (touchesPrice && before) {
    const after = db.prepare("SELECT " + priceCols + " FROM products WHERE id = ?").get(id);
    try { recordManualPriceChange(id, before, after); } catch (_) {}
  }
  if (touchesCost && costBefore) {
    const costAfter = db.prepare("SELECT cost FROM products WHERE id = ?").get(id);
    try { logCostChange(id, costBefore.cost, costAfter.cost, "manual", null, costBefore.stock); } catch (_) {}
  }
  if (touchesStock && stockBefore) {
    const delta = Math.round((Number(vals[cols.indexOf("stock")]) || 0) - (Number(stockBefore.stock) || 0));
    try { logStockMovement(id, "ajuste", delta, null, "Edición manual del producto (modal Editar producto)", req.session.userId); } catch (_) {}
  }

  res.json({ ok: true, id: id });
});

// DELETE /api/admin/products/:id — borrar un producto (solo superadmin).
// Se bloquea si el producto tiene movimientos reales (pedidos, compras,
// cotizaciones o presupuestos): ahí conviene DESACTIVARLO para no perder
// historial. Si no tiene movimientos, se borra junto con sus registros de log
// (cambios de costo, ajustes de stock, historial de cambios de precio).
app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const perms = getAdminPerms(req.session.userId);
  if (!perms.isSuperadmin) {
    return res.status(403).json({ error: "Solo el superadmin puede borrar productos" });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id invalido" });
  const prod = db.prepare("SELECT id, name FROM products WHERE id = ?").get(id);
  if (!prod) return res.status(404).json({ error: "Producto no encontrado" });

  // Referencias transaccionales (no se deben perder). Si hay alguna → 409.
  const cnt = (sql) => Number(db.prepare(sql).get(id).n) || 0;
  const inOrders = cnt("SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?");
  const inPurch  = cnt("SELECT COUNT(*) AS n FROM purchase_items WHERE product_id = ?");
  const inPReq   = cnt("SELECT COUNT(*) AS n FROM purchase_request_items WHERE product_id = ?");
  const inBudg   = cnt("SELECT COUNT(*) AS n FROM budget_items WHERE product_id = ?");
  if (inOrders || inPurch || inPReq || inBudg) {
    const partes = [];
    if (inOrders) partes.push(inOrders + " pedido(s)");
    if (inPurch)  partes.push(inPurch + " compra(s)");
    if (inPReq)   partes.push(inPReq + " cotización(es)");
    if (inBudg)   partes.push(inBudg + " presupuesto(s)");
    return res.status(409).json({
      error: "No se puede borrar: el producto está en " + partes.join(", ") +
        ". Desactivalo para sacarlo del catálogo sin perder el historial.",
    });
  }

  // Sin movimientos: borrar logs + producto en una transacción.
  db.transaction(() => {
    db.prepare("DELETE FROM cost_changes WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM stock_adjustments WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM price_changes WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
  })();
  res.json({ ok: true, deleted: id });
});

// Edición en lote (selección múltiple): aplica cambios a varios productos en UNA
// transacción. Body: { patches: [{ id, ...campos }] }. Cada patch trae solo los
// campos a tocar (el front ya computó %/sumar-restar por producto).
app.post("/api/admin/products/bulk-update", requireAdmin, (req, res) => {
  const patches = Array.isArray((req.body || {}).patches) ? req.body.patches : [];
  if (!patches.length) return res.status(400).json({ error: "Sin cambios para aplicar" });
  if (patches.length > 5000) return res.status(400).json({ error: "Demasiados productos" });

  // Validar categorías referenciadas (distintas, una sola consulta por valor).
  const catIds = new Set();
  for (const p of patches) {
    if (p && "category_id" in p) {
      const cid = coerceProductField("category_id", p.category_id);
      if (cid != null) catIds.add(cid);
    }
  }
  for (const cid of catIds) {
    if (!db.prepare("SELECT id FROM categories WHERE id = ?").get(cid)) {
      return res.status(400).json({ error: "Categoría inexistente (" + cid + ")" });
    }
  }

  const priceCols = TRACKED_PRICE_COLS.join(", ");
  let updated = 0, failed = 0;
  const run = db.transaction(() => {
    for (const p of patches) {
      const id = Number(p && p.id);
      if (!id) { failed++; continue; }
      const { cols, vals } = buildProductUpdate(p);
      if (!cols.length) { failed++; continue; }
      const touchesPrice = cols.some((c) => TRACKED_PRICE_COLS.includes(c));
      const before = touchesPrice
        ? db.prepare("SELECT " + priceCols + " FROM products WHERE id = ?").get(id)
        : null;
      const touchesCost = cols.includes("cost");
      const costBefore = touchesCost
        ? db.prepare("SELECT cost, stock FROM products WHERE id = ?").get(id)
        : null;
      const sets = cols.map((c) => c + " = ?");
      sets.push("updated_at = datetime('now')");
      vals.push(id);
      try {
        const r = db.prepare("UPDATE products SET " + sets.join(", ") + " WHERE id = ?").run(...vals);
        if (r.changes) {
          updated++;
          // Logging con try propio: si historizar falla, el UPDATE ya quedo
          // aplicado — antes el catch de abajo sumaba failed++ ADEMAS del
          // updated++ y el resumen contaba el patch dos veces.
          try {
            if (touchesPrice && before) {
              const after = db.prepare("SELECT " + priceCols + " FROM products WHERE id = ?").get(id);
              recordManualPriceChange(id, before, after);
            }
            if (touchesCost && costBefore) {
              const costAfter = db.prepare("SELECT cost FROM products WHERE id = ?").get(id);
              logCostChange(id, costBefore.cost, costAfter.cost, "manual", null, costBefore.stock);
            }
          } catch (_) {}
        } else failed++;
      } catch (_) { failed++; }
    }
  });
  run();
  res.json({ ok: true, updated, failed });
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

// Visibilidad global de categorias (Configuracion). Lista TODAS las categorias
// con su flag active y cuantos productos activos tiene cada una.
app.get("/api/admin/categories", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT c.id, c.name, c.active," +
    "       (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS products_count" +
    "  FROM categories c ORDER BY c.sort_order, c.name"
  ).all();
  res.json(rows);
});

// Activar/desactivar una categoria a nivel global. No toca user_category_access:
// las restricciones por usuario se respetan siempre por encima de este flag.
app.patch("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const body = req.body || {};
  if (!("active" in body)) return res.status(400).json({ error: "Nada para actualizar" });
  const r = db.prepare("UPDATE categories SET active = ? WHERE id = ?").run(body.active ? 1 : 0, id);
  if (!r.changes) return res.status(404).json({ error: "Categoria no encontrada" });
  res.json({ ok: true, id: id, active: body.active ? 1 : 0 });
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
    "SELECT u.id, u.username, u.full_name, u.phone, u.whatsapp_number, u.email, u.plain_password," +
    "       u.level, u.active, u.created_at, u.last_login_at," +
    "       u.assigned_vendedor_id, u.price_list_id, u.vendedor_price_level, u.is_tercerizado," +
    "       (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.event = 'login') AS login_count," +
    "       (SELECT MAX(a.created_at) FROM activity_log a WHERE a.user_id = u.id) AS last_activity_at" +
    "  FROM users u ORDER BY u.level DESC, u.username"
  ).all();
  res.json(rows);
});

// Historial de actividad de un usuario (logins y eventos clave).
app.get("/api/admin/users/:id/activity", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const u = db.prepare("SELECT id, username, full_name, level, last_login_at FROM users WHERE id = ?").get(userId);
  if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
  const events = db.prepare(
    "SELECT id, event, detail, ip, user_agent, created_at" +
    "  FROM activity_log WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?"
  ).all(userId, limit);

  const summary = db.prepare(
    "SELECT" +
    "  COUNT(*) AS total," +
    "  SUM(CASE WHEN event = 'login' THEN 1 ELSE 0 END) AS logins," +
    "  SUM(CASE WHEN event = 'pedido' THEN 1 ELSE 0 END) AS pedidos," +
    "  SUM(CASE WHEN event = 'catalogo' THEN 1 ELSE 0 END) AS catalogos," +
    "  SUM(CASE WHEN event = 'cambios' THEN 1 ELSE 0 END) AS cambios," +
    "  MAX(CASE WHEN event = 'login' THEN created_at END) AS last_login," +
    "  MAX(created_at) AS last_activity," +
    "  MIN(created_at) AS first_activity" +
    "  FROM activity_log WHERE user_id = ?"
  ).get(userId);

  // "Último ingreso": el activity_log solo tiene logins posteriores a que se
  // agregó el logging. users.last_login_at es la fuente autoritativa (se
  // actualiza en cada /login). Si no hay eventos login en el log, caemos a
  // last_login_at para que coincida con la columna de la tabla de Usuarios.
  if (summary && !summary.last_login && u.last_login_at) {
    summary.last_login = u.last_login_at;
  }

  res.json({ user: u, summary: summary, events: events });
});

// Crear cliente rápido sin credenciales (desde el form de presupuesto).
// El admin le asigna username/password después desde la pestaña Usuarios.
app.post("/api/admin/quick-client", requireVendedorOrAdmin, (req, res) => {
  const b = req.body || {};
  const fullName = String(b.full_name || "").trim();
  if (!fullName) return res.status(400).json({ error: "El nombre es obligatorio" });
  const phone = String(b.phone || "").trim() || null;
  // Precio: lista personalizada o nivel base.
  const priceListId = b.price_list_id ? Number(b.price_list_id) : null;
  if (priceListId) {
    const pl = db.prepare("SELECT id FROM price_lists WHERE id = ? AND active = 1").get(priceListId);
    if (!pl) return res.status(400).json({ error: "Lista de precios inválida" });
  }
  const LEVEL_BASE_MAP = { minorista: 1, revendedor: 2, mayorista: 3, vip: 4, publico: 1 };
  const levelBase = String(b.level_base || "").trim().toLowerCase();
  const userLevel = priceListId ? 1 : (LEVEL_BASE_MAP[levelBase] || 1);
  // Generar un username interno único, no expuesto al cliente.
  const base = "cliente_" + Date.now();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(base);
  const username = existing ? base + "_" + Math.floor(Math.random() * 1000) : base;
  const stmt = db.prepare(
    "INSERT INTO users (username, password_hash, full_name, phone, level, active, price_list_id) " +
    "VALUES (?, '', ?, ?, ?, 1, ?)"
  );
  const result = stmt.run(username, fullName, phone, userLevel, priceListId);
  const newUser = db.prepare(
    "SELECT u.id, u.full_name, u.username, u.level, u.price_list_id, pl.name AS price_list_name " +
    "FROM users u LEFT JOIN price_lists pl ON pl.id = u.price_list_id WHERE u.id = ?"
  ).get(result.lastInsertRowid);
  res.json(newUser);
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

  if ("username" in b) {
    const uname = String(b.username || "").trim().toLowerCase();
    if (!isValidUsername(uname))
      return res.status(400).json({ error: "Usuario invalido: 3-32 caracteres, solo letras, numeros, _ . -" });
    const clash = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(uname, id);
    if (clash) return res.status(409).json({ error: "Ya existe un usuario con ese nombre" });
    sets.push("username = ?");
    vals.push(uname);
  }
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
  if ("credit_limit" in b) {
    // 0 = sin limite. Solo valores enteros >= 0.
    const cl = Math.round(Math.max(0, Number(b.credit_limit) || 0));
    sets.push("credit_limit = ?");
    vals.push(cl);
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

// ===== Administradores / usuarios privilegiados (solo superadmin) =====
// El gating a superadmin lo hace requireAdmin via la seccion "administradores".
function sanitizeSections(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const s of arr) {
    const k = String(s || "").trim();
    if (ADMIN_SECTION_KEYS.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}
function adminRowOut(u) {
  return {
    id: u.id, username: u.username, full_name: u.full_name,
    active: !!u.active, is_superadmin: Number(u.is_superadmin) === 1,
    sections: String(u.admin_sections || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

app.get("/api/admin/admins", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT id, username, full_name, active, is_superadmin, admin_sections" +
    "  FROM users WHERE level = 99 ORDER BY is_superadmin DESC, username"
  ).all();
  res.json({ admins: rows.map(adminRowOut), sections: ADMIN_SECTIONS });
});

app.post("/api/admin/admins", requireAdmin, (req, res) => {
  const b = req.body || {};
  const username = String(b.username || "").trim().toLowerCase();
  const password = String(b.password || "");
  const fullName = String(b.full_name || "").trim() || null;
  const sections = sanitizeSections(b.sections);
  if (!username) return res.status(400).json({ error: "Usuario requerido" });
  if (password.length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) return res.status(409).json({ error: "Ya existe un usuario con ese nombre" });
  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare(
    "INSERT INTO users (username, password_hash, plain_password, full_name, level, active, is_superadmin, admin_sections)" +
    " VALUES (?, ?, ?, ?, 99, 1, 0, ?)"
  ).run(username, hash, password, fullName, sections.join(","));
  const row = db.prepare(
    "SELECT id, username, full_name, active, is_superadmin, admin_sections FROM users WHERE id = ?"
  ).get(r.lastInsertRowid);
  res.json({ ok: true, admin: adminRowOut(row) });
});

app.patch("/api/admin/admins/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const target = db.prepare("SELECT id, level, is_superadmin FROM users WHERE id = ?").get(id);
  if (!target || target.level !== 99) return res.status(404).json({ error: "Administrador no encontrado" });
  if (Number(target.is_superadmin) === 1) return res.status(403).json({ error: "No se puede editar al superadmin" });
  const b = req.body || {};
  const sets = [], vals = [];
  if ("full_name" in b) { sets.push("full_name = ?"); vals.push(String(b.full_name || "").trim() || null); }
  if ("active" in b) {
    if (id === req.session.userId) return res.status(400).json({ error: "No podés desactivarte a vos mismo" });
    sets.push("active = ?"); vals.push(b.active ? 1 : 0);
  }
  if ("sections" in b) { sets.push("admin_sections = ?"); vals.push(sanitizeSections(b.sections).join(",")); }
  if (!sets.length) return res.status(400).json({ error: "Nada para actualizar" });
  vals.push(id);
  db.prepare("UPDATE users SET " + sets.join(", ") + " WHERE id = ?").run(...vals);
  const row = db.prepare(
    "SELECT id, username, full_name, active, is_superadmin, admin_sections FROM users WHERE id = ?"
  ).get(id);
  res.json({ ok: true, admin: adminRowOut(row) });
});

app.post("/api/admin/admins/:id/reset-password", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const target = db.prepare("SELECT id, level, is_superadmin FROM users WHERE id = ?").get(id);
  if (!target || target.level !== 99) return res.status(404).json({ error: "Administrador no encontrado" });
  if (Number(target.is_superadmin) === 1) return res.status(403).json({ error: "No se puede resetear la clave del superadmin desde acá" });
  const password = String((req.body || {}).password || "");
  if (password.length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
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
    // Snapshot de costo+stock ANTES del import para detectar cambios de costo
    // (historial de inflacion). El import tambien puede tocar stock, por eso
    // se guarda el stock previo junto al costo.
    const beforeCosts = new Map(
      db.prepare("SELECT id, cost, stock FROM products").all().map((r) => [r.id, r])
    );
    const stats = importPrices(items, db, { source: "excel-upload" });
    try {
      const afterRows = db.prepare("SELECT id, cost FROM products").all();
      for (const r of afterRows) {
        const b = beforeCosts.get(r.id);
        if (!b) continue; // producto nuevo creado por el import: no es un "cambio"
        if ((Number(b.cost) || 0) !== (Number(r.cost) || 0)) {
          logCostChange(r.id, b.cost, r.cost, "excel", stats.updateId || null, b.stock);
        }
      }
    } catch (e2) {
      console.error("import-excel: error registrando cost_changes:", e2);
    }
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
    "SELECT pl.id, pl.name, pl.base_level, pl.base_list_id, pl.markup_percent, pl.active, pl.notes," +
    "       pl.created_at, pl.updated_at," +
    "       bl.name AS base_list_name," +
    "       (SELECT COUNT(*) FROM users u WHERE u.price_list_id = pl.id) AS users_count," +
    "       (SELECT COUNT(*) FROM price_lists d WHERE d.base_list_id = pl.id) AS dependents_count" +
    "  FROM price_lists pl LEFT JOIN price_lists bl ON bl.id = pl.base_list_id" +
    "  ORDER BY pl.active DESC, pl.name"
  ).all();
  // % efectivo combinado de la cadena (para mostrar en el front)
  for (const r of rows) {
    if (r.base_list_id) {
      const eff = resolvePriceListConfig(r);
      r.effective_markup_percent = eff ? Math.round(eff.markup_percent * 100) / 100 : null;
      r.effective_base_level = eff ? eff.base_level : null;
    } else {
      r.effective_markup_percent = Number(r.markup_percent) || 0;
      r.effective_base_level = r.base_level;
    }
  }
  res.json(rows);
});

// POST /api/admin/price-lists
// Body: { name, base_level?, base_list_id?, markup_percent, notes? }
// base_list_id != null => la lista se basa en OTRA lista (encadenada); en ese
// caso base_level se guarda igual (denormalizado con el nivel raiz de la cadena)
// como fallback por si el padre se borra.
app.post("/api/admin/price-lists", requireAdmin, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim().slice(0, 80);
  let base_level = String(b.base_level || "").trim().toLowerCase();
  const base_list_id = b.base_list_id != null && b.base_list_id !== "" ? Number(b.base_list_id) : null;
  const markup_percent = Number(b.markup_percent);
  const notes = String(b.notes || "").trim().slice(0, 300) || null;
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  if (base_list_id) {
    const parentCfg = resolvePriceListConfig(base_list_id);
    if (!parentCfg) return res.status(400).json({ error: "La lista base elegida no existe" });
    base_level = parentCfg.base_level; // fallback denormalizado (nivel raiz de la cadena)
  } else if (!PRICE_LIST_BASE_LEVELS.includes(base_level)) {
    return res.status(400).json({ error: "Lista base invalida. Valores: " + PRICE_LIST_BASE_LEVELS.join(", ") });
  }
  if (!isFinite(markup_percent) || markup_percent < -90 || markup_percent > 95)
    return res.status(400).json({ error: "Ganancia invalida (debe ser un numero entre -90 y 95)" });

  const exists = db.prepare("SELECT id FROM price_lists WHERE name = ?").get(name);
  if (exists) return res.status(409).json({ error: "Ya existe una lista con ese nombre" });

  const r = db.prepare(
    "INSERT INTO price_lists (name, base_level, base_list_id, markup_percent, notes)" +
    " VALUES (?, ?, ?, ?, ?)"
  ).run(name, base_level, base_list_id, markup_percent, notes);
  const row = db.prepare(
    "SELECT pl.id, pl.name, pl.base_level, pl.base_list_id, pl.markup_percent, pl.active," +
    "       pl.notes, pl.created_at, pl.updated_at, bl.name AS base_list_name," +
    "       0 AS users_count, 0 AS dependents_count" +
    "  FROM price_lists pl LEFT JOIN price_lists bl ON bl.id = pl.base_list_id WHERE pl.id = ?"
  ).get(r.lastInsertRowid);
  const eff = resolvePriceListConfig(row);
  row.effective_markup_percent = eff ? Math.round(eff.markup_percent * 100) / 100 : null;
  row.effective_base_level = eff ? eff.base_level : row.base_level;
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
  // base_list_id: null/""/0 desasigna (vuelve a basarse en base_level).
  // Se procesa ANTES que base_level porque al setear un padre pisamos
  // base_level con el nivel raiz de la cadena (fallback denormalizado).
  if ("base_list_id" in b) {
    const v = b.base_list_id != null && b.base_list_id !== "" ? Number(b.base_list_id) : null;
    if (v) {
      if (v === id) return res.status(400).json({ error: "Una lista no puede basarse en si misma" });
      if (priceListWouldCycle(v, id))
        return res.status(400).json({ error: "No se puede: eso crearia un ciclo entre listas (A basada en B basada en A)" });
      const parentCfg = resolvePriceListConfig(v);
      if (!parentCfg) return res.status(400).json({ error: "La lista base elegida no existe" });
      sets.push("base_list_id = ?"); vals.push(v);
      sets.push("base_level = ?"); vals.push(parentCfg.base_level);
    } else {
      sets.push("base_list_id = NULL");
    }
  }
  if ("base_level" in b && !(b.base_list_id != null && b.base_list_id !== "")) {
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
    "SELECT pl.id, pl.name, pl.base_level, pl.base_list_id, pl.markup_percent, pl.active, pl.notes," +
    "       pl.created_at, pl.updated_at, bl.name AS base_list_name," +
    "       (SELECT COUNT(*) FROM users u WHERE u.price_list_id = pl.id) AS users_count," +
    "       (SELECT COUNT(*) FROM price_lists d WHERE d.base_list_id = pl.id) AS dependents_count" +
    "  FROM price_lists pl LEFT JOIN price_lists bl ON bl.id = pl.base_list_id WHERE pl.id = ?"
  ).get(id);
  const eff = resolvePriceListConfig(row);
  row.effective_markup_percent = eff ? Math.round(eff.markup_percent * 100) / 100 : null;
  row.effective_base_level = eff ? eff.base_level : row.base_level;
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
  const deps = db.prepare("SELECT COUNT(*) AS n FROM price_lists WHERE base_list_id = ?").get(id);
  if (deps.n > 0) {
    return res.status(409).json({
      error: "No se puede borrar: hay " + deps.n + " lista(s) basadas en esta lista. " +
             "Cambiales la base primero."
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
    "SELECT id, name, base_level, base_list_id, markup_percent FROM price_lists WHERE id = ?"
  ).get(id);
  if (!list) return res.status(404).json({ error: "Lista no encontrada" });
  // Resolver la cadena (si se basa en otra lista): columna raiz + % efectivo combinado
  const cfg = resolvePriceListConfig(list);
  const col = cfg.column;
  const effMarkup = cfg.markup_percent;
  list.effective_markup_percent = Math.round(effMarkup * 100) / 100;
  list.effective_base_level = cfg.base_level;
  list.chain = cfg.chain; // nombres de la cadena, de esta lista hacia la raiz
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
  ).all(effMarkup, effMarkup, limit);
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

// ====================================================================
// ===== ACTIVIDAD - Reportes extendidos (solo admin) =================
// ====================================================================
//
// Filtro de fechas comun: ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Si falta alguno, se aplica un default razonable (ultimos 30 dias).
// Las fechas se comparan contra orders.created_at en formato ISO
// (la columna ya viene con CURRENT_TIMESTAMP que es comparable lexico).
function parseActivityRange(req) {
  function toIso(v, end) {
    if (!v || typeof v !== "string") return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return end ? (v + " 23:59:59") : (v + " 00:00:00");
  }
  let from = toIso(req.query.from, false);
  let to = toIso(req.query.to, true);
  if (!from) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    from = d.toISOString().slice(0, 10) + " 00:00:00";
  }
  if (!to) {
    to = new Date().toISOString().slice(0, 10) + " 23:59:59";
  }
  return { from: from, to: to };
}

// Ventana anterior equivalente: misma cantidad de días que [from, to], pero
// terminando el día ANTES de 'from'. Ej: si el rango es una semana, devuelve
// la semana previa; sirve para calcular variaciones de ventas. from/to vienen
// como 'YYYY-MM-DD HH:MM:SS'.
function previousActivityWindow(from, to) {
  const fromDate = new Date(from.slice(0, 10) + "T00:00:00Z");
  const toDate = new Date(to.slice(0, 10) + "T00:00:00Z");
  let days = Math.round((toDate - fromDate) / 86400000) + 1; // inclusivo
  if (!(days > 0)) days = 1;
  const prevTo = new Date(fromDate);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(fromDate);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - days);
  return {
    from: prevFrom.toISOString().slice(0, 10) + " 00:00:00",
    to: prevTo.toISOString().slice(0, 10) + " 23:59:59",
  };
}

// ----- Historial agregado por cliente -----
// Suma pedidos no cancelados (excluye unificados del tercerizado) en el
// rango. Devuelve por cliente: cantidad de pedidos, entregados, total
// vendido, costo (a partir de vendedor_cost_unit cuando esta seteado;
// sino cae a products.cost actual como aproximacion), ganancia, ticket
// promedio, ultimo pedido. Cliente = level entre 1 y 4.
app.get("/api/admin/activity/clients", requireAdmin, (req, res) => {
  const range = parseActivityRange(req);
  const rows = db.prepare(
    "WITH cli_orders AS (" +
    "  SELECT u.id AS user_id, u.username, u.full_name, u.level, u.active," +
    "         o.id AS order_id, o.status, o.total, o.created_at" +
    "    FROM users u" +
    "    JOIN orders o ON o.user_id = u.id" +
    "   WHERE u.level BETWEEN 1 AND 4" +
    "     AND o.status != 'cancelado'" +
    "     AND COALESCE(o.is_unified,0) = 0" +
    "     AND o.created_at BETWEEN ? AND ?" +
    ")," +
    "ord_agg AS (" +
    "  SELECT user_id," +
    "         COUNT(*) AS orders_count," +
    "         SUM(CASE WHEN status='entregado' THEN 1 ELSE 0 END) AS delivered_count," +
    "         SUM(total) AS total_sold," +
    "         MAX(created_at) AS last_order_at" +
    "    FROM cli_orders GROUP BY user_id" +
    ")," +
    "item_agg AS (" +
    "  SELECT co.user_id," +
    "         SUM(COALESCE(oi.vendedor_cost_unit, p.cost, 0) * oi.quantity) AS total_cost," +
    "         SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity) AS total_earning" +
    "    FROM cli_orders co" +
    "    JOIN order_items oi ON oi.order_id = co.order_id" +
    "    LEFT JOIN products p ON p.id = oi.product_id" +
    "   GROUP BY co.user_id" +
    ") " +
    "SELECT u.id AS user_id, u.username, u.full_name, u.level, u.active," +
    "       COALESCE(oa.orders_count,0) AS orders_count," +
    "       COALESCE(oa.delivered_count,0) AS delivered_count," +
    "       COALESCE(oa.total_sold,0) AS total_sold," +
    "       COALESCE(ia.total_cost,0) AS total_cost," +
    "       COALESCE(ia.total_earning,0) AS total_earning," +
    "       oa.last_order_at" +
    "  FROM users u" +
    "  LEFT JOIN ord_agg oa ON oa.user_id = u.id" +
    "  LEFT JOIN item_agg ia ON ia.user_id = u.id" +
    " WHERE u.level BETWEEN 1 AND 4" +
    "   AND COALESCE(oa.orders_count,0) > 0" +
    " ORDER BY oa.total_sold DESC, u.username"
  ).all(range.from, range.to);
  res.json({ from: range.from, to: range.to, rows: rows });
});

// Detalle de pedidos de un cliente puntual en el rango.
app.get("/api/admin/activity/clients/:userId", requireAdmin, (req, res) => {
  const uid = Number(req.params.userId);
  if (!uid) return res.status(400).json({ error: "ID invalido" });
  const range = parseActivityRange(req);
  const cliente = db.prepare(
    "SELECT id, username, full_name, level FROM users WHERE id = ? AND level BETWEEN 1 AND 4"
  ).get(uid);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  const orders = db.prepare(
    "SELECT o.id, o.status, o.total, o.created_at," +
    "       o.assigned_vendedor_id," +
    "       v.username AS vendedor_username, v.full_name AS vendedor_full_name," +
    "       COALESCE(SUM(COALESCE(oi.vendedor_cost_unit, p.cost, 0) * oi.quantity), 0) AS cost_total," +
    "       COALESCE(SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity), 0) AS earning_total," +
    "       COALESCE(SUM(oi.quantity), 0) AS items_count" +
    "  FROM orders o" +
    "  LEFT JOIN users v ON v.id = o.assigned_vendedor_id" +
    "  LEFT JOIN order_items oi ON oi.order_id = o.id" +
    "  LEFT JOIN products p ON p.id = oi.product_id" +
    " WHERE o.user_id = ? AND o.status != 'cancelado'" +
    "   AND COALESCE(o.is_unified,0) = 0" +
    "   AND o.created_at BETWEEN ? AND ?" +
    " GROUP BY o.id" +
    " ORDER BY o.created_at DESC"
  ).all(uid, range.from, range.to);
  res.json({ cliente: cliente, from: range.from, to: range.to, orders: orders });
});

// ----- Ranking de productos por ganancia -----
// Toma items de pedidos no cancelados (excluye unificados) en el rango.
// Costo: vendedor_cost_unit (snapshot) si existe, sino products.cost.
// Ganancia = (unit_price - costo_aplicado) * quantity. Devuelve por producto
// unidades vendidas, total venta, total costo, ganancia, margen %, ultima
// venta.
app.get("/api/admin/activity/products-ranking", requireAdmin, (req, res) => {
  const range = parseActivityRange(req);
  const rows = db.prepare(
    "SELECT p.id AS product_id, p.code, p.name, p.category_id," +
    "       c.name AS category_name, p.stock, p.cost AS current_cost," +
    "       SUM(oi.quantity) AS units_sold," +
    "       SUM(oi.unit_price * oi.quantity) AS total_sold," +
    "       SUM(COALESCE(oi.vendedor_cost_unit, p.cost, 0) * oi.quantity) AS total_cost," +
    "       SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity) AS total_earning," +
    "       MAX(o.created_at) AS last_sold_at," +
    "       COUNT(DISTINCT o.id) AS orders_count" +
    "  FROM order_items oi" +
    "  JOIN orders o ON o.id = oi.order_id" +
    "  LEFT JOIN products p ON p.id = oi.product_id" +
    "  LEFT JOIN categories c ON c.id = p.category_id" +
    " WHERE o.status != 'cancelado'" +
    "   AND COALESCE(o.is_unified,0) = 0" +
    "   AND o.created_at BETWEEN ? AND ?" +
    "   AND oi.product_id IS NOT NULL" +
    " GROUP BY oi.product_id" +
    " ORDER BY total_earning DESC, units_sold DESC"
  ).all(range.from, range.to);

  // Período anterior equivalente (misma cantidad de días, terminando el día
  // antes de 'from') para calcular la variación de ventas por producto.
  const prev = previousActivityWindow(range.from, range.to);
  const prevRows = db.prepare(
    "SELECT oi.product_id AS product_id," +
    "       SUM(oi.quantity) AS units_sold," +
    "       SUM(oi.unit_price * oi.quantity) AS total_sold" +
    "  FROM order_items oi" +
    "  JOIN orders o ON o.id = oi.order_id" +
    " WHERE o.status != 'cancelado'" +
    "   AND COALESCE(o.is_unified,0) = 0" +
    "   AND o.created_at BETWEEN ? AND ?" +
    "   AND oi.product_id IS NOT NULL" +
    " GROUP BY oi.product_id"
  ).all(prev.from, prev.to);
  const prevMap = new Map();
  for (const r of prevRows) prevMap.set(r.product_id, r);
  for (const r of rows) {
    const p = prevMap.get(r.product_id);
    r.prev_units_sold = p ? (Number(p.units_sold) || 0) : 0;
    r.prev_total_sold = p ? (Number(p.total_sold) || 0) : 0;
  }
  res.json({
    from: range.from, to: range.to,
    prev_from: prev.from, prev_to: prev.to,
    rows: rows,
  });
});

// ----- Valorizacion del stock -----
// KPIs globales del inventario al dia de hoy. Solo cuenta productos
// activos con stock > 0 para el "valor de stock", pero devuelve tambien
// conteos de agotados y stock bajo (<= umbral configurable via ?low=N,
// default 5). El valor a precio de venta se devuelve por cada nivel base.
app.get("/api/admin/activity/stock-valuation", requireAdmin, (req, res) => {
  const lowThreshold = Math.max(0, Number(req.query.low) || 5);
  const totals = db.prepare(
    "SELECT" +
    "  SUM(CASE WHEN active=1 AND stock>0 THEN stock ELSE 0 END) AS units_in_stock," +
    "  SUM(CASE WHEN active=1 AND stock>0 THEN cost*stock ELSE 0 END) AS value_cost," +
    "  SUM(CASE WHEN active=1 AND stock>0 THEN price_minorista*stock ELSE 0 END) AS value_minorista," +
    "  SUM(CASE WHEN active=1 AND stock>0 THEN price_revendedor*stock ELSE 0 END) AS value_revendedor," +
    "  SUM(CASE WHEN active=1 AND stock>0 THEN price_mayorista*stock ELSE 0 END) AS value_mayorista," +
    "  SUM(CASE WHEN active=1 AND stock>0 THEN price_vip*stock ELSE 0 END) AS value_vip," +
    "  SUM(CASE WHEN active=1 AND stock>0 THEN price_publico*stock ELSE 0 END) AS value_publico," +
    "  SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) AS active_products," +
    "  SUM(CASE WHEN active=1 AND stock>0 THEN 1 ELSE 0 END) AS in_stock_products," +
    "  SUM(CASE WHEN active=1 AND stock<=0 THEN 1 ELSE 0 END) AS out_of_stock_products," +
    "  SUM(CASE WHEN active=1 AND stock>0 AND stock<=? THEN 1 ELSE 0 END) AS low_stock_products," +
    "  SUM(CASE WHEN active=0 THEN 1 ELSE 0 END) AS inactive_products" +
    "  FROM products"
  ).get(lowThreshold);
  const lowList = db.prepare(
    "SELECT id, code, name, stock, cost, price_minorista, price_mayorista" +
    "  FROM products" +
    " WHERE active=1 AND stock>0 AND stock<=?" +
    " ORDER BY stock ASC, name ASC LIMIT 50"
  ).all(lowThreshold);
  const outList = db.prepare(
    "SELECT id, code, name, cost, price_minorista, price_mayorista" +
    "  FROM products" +
    " WHERE active=1 AND stock<=0" +
    " ORDER BY name ASC LIMIT 50"
  ).all();
  res.json({
    low_threshold: lowThreshold,
    totals: totals,
    low_stock: lowList,
    out_of_stock: outList,
  });
});

// ----- Evolucion mensual del valor del stock a costo (reconstruccion aproximada) -----
// El sistema NO guarda historico de stock: se reconstruye hacia atras desde el stock
// actual, revirtiendo los movimientos con fecha conocida:
//   compras (suman stock), ventas entregadas con stock descontado (restan), y
//   ajustes de stock manuales (con signo). El costo historico sale de cost_changes
//   cuando existe; si no, se usa el costo actual como constante.
// Es una ESTIMACION: faltan movimientos con fecha (presupuestos, ediciones) y costos
// viejos, sobre todo en meses previos al registro de cost_changes/stock_adjustments.
app.get("/api/admin/activity/stock-history", requireAdmin, (req, res) => {
  const months = Math.min(36, Math.max(2, Number(req.query.months) || 12));
  const prods = db.prepare("SELECT id, stock, cost FROM products WHERE active=1").all();
  const byId = new Map();
  for (const p of prods) byId.set(p.id, { stock: Number(p.stock) || 0, cost: Number(p.cost) || 0, deltas: [], changes: [] });

  const addDelta = (pid, qty, d) => {
    const e = byId.get(pid); if (!e || !d) return;
    const n = Number(qty); if (!n) return;
    e.deltas.push({ d: String(d), q: n });
  };
  // Compras: sumaron stock (delta +).
  db.prepare(
    "SELECT pi.product_id AS pid, pi.quantity AS qty, COALESCE(po.received_at, po.created_at) AS d" +
    "  FROM purchase_items pi JOIN purchase_orders po ON po.id = pi.purchase_order_id"
  ).all().forEach((r) => addDelta(r.pid, Math.abs(Number(r.qty) || 0), r.d));
  // Ajustes de stock: qty_change ya viene con signo.
  db.prepare("SELECT product_id AS pid, qty_change AS qty, created_at AS d FROM stock_adjustments")
    .all().forEach((r) => addDelta(r.pid, Number(r.qty) || 0, r.d));
  // Ventas con stock descontado: restaron stock (delta -). Excluye unificados/hijos y cancelados.
  db.prepare(
    "SELECT oi.product_id AS pid, oi.quantity AS qty, COALESCE(d.delivered_at, o.created_at) AS d" +
    "  FROM order_items oi JOIN orders o ON o.id = oi.order_id" +
    "  LEFT JOIN deliveries d ON d.order_id = o.id" +
    " WHERE COALESCE(o.stock_discounted,0)=1 AND COALESCE(o.is_unified,0)=0" +
    "   AND o.unified_parent_id IS NULL AND o.status != 'cancelado'"
  ).all().forEach((r) => addDelta(r.pid, -Math.abs(Number(r.qty) || 0), r.d));
  // Cambios de costo (costo historico por producto).
  db.prepare("SELECT product_id AS pid, old_cost, new_cost, created_at AS d FROM cost_changes ORDER BY product_id, created_at, id")
    .all().forEach((r) => { const e = byId.get(r.pid); if (e) e.changes.push({ d: String(r.d), oc: Number(r.old_cost) || 0, nc: Number(r.new_cost) || 0 }); });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const cutoffOf = (y, m) => { // inicio del mes SIGUIENTE (movimientos con date >= esto = posteriores al mes)
    const ny = m === 11 ? y + 1 : y, nm = m === 11 ? 0 : m + 1;
    return ny + "-" + pad(nm + 1) + "-01 00:00:00";
  };
  const costAt = (e, cutoff) => {
    if (!e.changes.length) return e.cost;
    let c = null;
    for (const ch of e.changes) { if (ch.d < cutoff) c = ch.nc; else break; }
    return c === null ? e.changes[0].oc : c;
  };
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  // Primer mes con datos reales de movimiento/costo: antes de esto la reconstruccion
  // asume stock constante (no hay info), asi que el frontend puede recortar esa
  // porcion plana para no mostrar meses "inventados".
  let firstMove = null;
  byId.forEach((e) => {
    for (const dl of e.deltas) { if (!firstMove || dl.d < firstMove) firstMove = dl.d; }
    for (const ch of e.changes) { if (!firstMove || ch.d < firstMove) firstMove = ch.d; }
  });
  const dataFrom = firstMove ? String(firstMove).slice(0, 7) : null;

  const out = [];
  let prevVal = null;
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = dt.getFullYear(), m = dt.getMonth();
    const cutoff = cutoffOf(y, m);
    let valueCost = 0, units = 0;
    byId.forEach((e) => {
      let s = e.stock;
      for (const dl of e.deltas) { if (dl.d >= cutoff) s -= dl.q; }
      if (s <= 0) return;
      units += s;
      valueCost += s * costAt(e, cutoff);
    });
    valueCost = Math.round(valueCost);
    const rec = {
      month: y + "-" + pad(m + 1), label: MES[m] + " " + y,
      value_cost: valueCost, units: Math.round(units),
      delta_value: prevVal === null ? null : valueCost - prevVal,
      delta_pct: prevVal ? Math.round(((valueCost - prevVal) / prevVal) * 1000) / 10 : null,
    };
    out.push(rec);
    prevVal = valueCost;
  }
  res.json({ approx: true, data_from: dataFrom, months: out });
});

// ----- Valorizacion por categoria -----
// Misma idea pero agrupado por categoria. Devuelve por cada categoria:
// productos totales, en stock, unidades, valor a costo, valor a cada nivel
// de precio, ganancia potencial (valor_minorista - valor_cost).
app.get("/api/admin/activity/stock-by-category", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT c.id AS category_id, c.name AS category_name, c.sort_order," +
    "  COUNT(p.id) AS total_products," +
    "  SUM(CASE WHEN p.active=1 AND p.stock>0 THEN 1 ELSE 0 END) AS in_stock_products," +
    "  SUM(CASE WHEN p.active=1 AND p.stock<=0 THEN 1 ELSE 0 END) AS out_of_stock_products," +
    "  SUM(CASE WHEN p.active=1 AND p.stock>0 THEN p.stock ELSE 0 END) AS units_in_stock," +
    "  SUM(CASE WHEN p.active=1 AND p.stock>0 THEN p.cost*p.stock ELSE 0 END) AS value_cost," +
    "  SUM(CASE WHEN p.active=1 AND p.stock>0 THEN p.price_minorista*p.stock ELSE 0 END) AS value_minorista," +
    "  SUM(CASE WHEN p.active=1 AND p.stock>0 THEN p.price_revendedor*p.stock ELSE 0 END) AS value_revendedor," +
    "  SUM(CASE WHEN p.active=1 AND p.stock>0 THEN p.price_mayorista*p.stock ELSE 0 END) AS value_mayorista," +
    "  SUM(CASE WHEN p.active=1 AND p.stock>0 THEN p.price_vip*p.stock ELSE 0 END) AS value_vip," +
    "  SUM(CASE WHEN p.active=1 AND p.stock>0 THEN p.price_publico*p.stock ELSE 0 END) AS value_publico" +
    "  FROM categories c" +
    "  LEFT JOIN products p ON p.category_id = c.id" +
    "  GROUP BY c.id" +
    "  ORDER BY c.sort_order, c.name"
  ).all();
  res.json({ rows: rows });
});

// ----- Ventas / Ganancias / Gastos por mes -----
// Agrega los ultimos N meses (default 12, incluye el actual). Devuelve para
// cada mes (YYYY-MM):
//   orders_count, delivered_count, gross_sales, delivered_sales,
//   cost_total, net_earning, avg_ticket,
//   purchases_total (gastos a proveedores en compras de mercaderia),
//   payments_total (cobranzas registradas en el mes)
// Excluye cancelados y unificados de las ventas.
app.get("/api/admin/activity/monthly", requireAdmin, (req, res) => {
  const months = Math.max(1, Math.min(60, Number(req.query.months) || 12));
  // Generamos la lista de meses YYYY-MM hacia atras desde el mes actual
  const monthList = [];
  const now = new Date();
  now.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    monthList.push(y + "-" + m);
  }
  const firstMonth = monthList[0] + "-01 00:00:00";
  // Para incluir todo el ultimo mes pedimos fin del mes actual
  const endOfCurrent = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endIso = endOfCurrent.toISOString().slice(0, 10) + " 23:59:59";

  // Pedidos no cancelados, no unificados, agregados por mes con sus items
  const orderRows = db.prepare(
    "SELECT strftime('%Y-%m', o.created_at) AS month," +
    "       COUNT(DISTINCT o.id) AS orders_count," +
    "       SUM(CASE WHEN o.status='entregado' THEN 1 ELSE 0 END) AS delivered_count," +
    "       SUM(o.total) AS gross_sales," +
    "       SUM(CASE WHEN o.status='entregado' THEN o.total ELSE 0 END) AS delivered_sales" +
    "  FROM orders o" +
    " WHERE o.status != 'cancelado'" +
    "   AND COALESCE(o.is_unified,0) = 0" +
    "   AND o.created_at BETWEEN ? AND ?" +
    " GROUP BY month"
  ).all(firstMonth, endIso);

  // Costo + ganancia agregados por mes desde order_items (con snapshot o
  // fallback a products.cost). Excluye cancelados y unificados.
  const itemRows = db.prepare(
    "SELECT strftime('%Y-%m', o.created_at) AS month," +
    "       SUM(COALESCE(oi.vendedor_cost_unit, p.cost, 0) * oi.quantity) AS cost_total," +
    "       SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity) AS net_earning" +
    "  FROM order_items oi" +
    "  JOIN orders o ON o.id = oi.order_id" +
    "  LEFT JOIN products p ON p.id = oi.product_id" +
    " WHERE o.status != 'cancelado'" +
    "   AND COALESCE(o.is_unified,0) = 0" +
    "   AND o.created_at BETWEEN ? AND ?" +
    " GROUP BY month"
  ).all(firstMonth, endIso);

  // Compras a proveedores: gasto en mercaderia. Usamos received_at si esta
  // seteado, sino created_at, para asignar al mes "real" del gasto.
  const purchRows = db.prepare(
    "SELECT strftime('%Y-%m', COALESCE(received_at, created_at)) AS month," +
    "       COUNT(*) AS purchases_count," +
    "       SUM(total_cost) AS purchases_total" +
    "  FROM purchase_orders" +
    " WHERE COALESCE(received_at, created_at) BETWEEN ? AND ?" +
    " GROUP BY month"
  ).all(firstMonth, endIso);

  // Cobranzas (pagos recibidos de clientes)
  const payRows = db.prepare(
    "SELECT strftime('%Y-%m', created_at) AS month," +
    "       COUNT(*) AS payments_count," +
    "       SUM(amount) AS payments_total" +
    "  FROM payments" +
    " WHERE created_at BETWEEN ? AND ?" +
    " GROUP BY month"
  ).all(firstMonth, endIso);

  // Gastos generales (expenses) por mes - distintos de compras de mercaderia
  const expRows = db.prepare(
    "SELECT strftime('%Y-%m', expense_date) AS month," +
    "       COUNT(*) AS expenses_count," +
    "       SUM(amount) AS expenses_total" +
    "  FROM expenses" +
    " WHERE expense_date BETWEEN ? AND ?" +
    " GROUP BY month"
  ).all(firstMonth.slice(0, 10), endIso.slice(0, 10));

  // Indexo cada source por mes para mergear
  function indexBy(rows) {
    const out = {};
    rows.forEach((r) => { out[r.month] = r; });
    return out;
  }
  const ordersByMonth = indexBy(orderRows);
  const itemsByMonth = indexBy(itemRows);
  const purchByMonth = indexBy(purchRows);
  const payByMonth = indexBy(payRows);
  const expByMonth = indexBy(expRows);

  // Armar la respuesta en el orden de monthList
  const rows = monthList.map((mo) => {
    const o = ordersByMonth[mo] || {};
    const i = itemsByMonth[mo] || {};
    const c = purchByMonth[mo] || {};
    const p = payByMonth[mo] || {};
    const ex = expByMonth[mo] || {};
    const ordersCount = Number(o.orders_count) || 0;
    const gross = Number(o.gross_sales) || 0;
    const avg = ordersCount > 0 ? Math.round(gross / ordersCount) : 0;
    return {
      month: mo,
      orders_count: ordersCount,
      delivered_count: Number(o.delivered_count) || 0,
      gross_sales: gross,
      delivered_sales: Number(o.delivered_sales) || 0,
      cost_total: Number(i.cost_total) || 0,
      net_earning: Number(i.net_earning) || 0,
      avg_ticket: avg,
      purchases_count: Number(c.purchases_count) || 0,
      purchases_total: Number(c.purchases_total) || 0,
      payments_count: Number(p.payments_count) || 0,
      payments_total: Number(p.payments_total) || 0,
      expenses_count: Number(ex.expenses_count) || 0,
      expenses_total: Number(ex.expenses_total) || 0,
    };
  });
  res.json({ months: months, rows: rows });
});

// ----- Productos sin movimiento -----
// Productos activos con stock>0 que no aparecen en ningun pedido (no
// cancelado, no unificado) en los ultimos N dias (default 60).
app.get("/api/admin/activity/dead-stock", requireAdmin, (req, res) => {
  const days = Math.max(1, Number(req.query.days) || 60);
  const d = new Date();
  d.setDate(d.getDate() - days);
  const since = d.toISOString().slice(0, 10) + " 00:00:00";
  const rows = db.prepare(
    "SELECT p.id, p.code, p.name, p.stock, p.cost, p.price_minorista," +
    "       c.name AS category_name," +
    "       (SELECT MAX(o.created_at)" +
    "          FROM order_items oi" +
    "          JOIN orders o ON o.id = oi.order_id" +
    "         WHERE oi.product_id = p.id" +
    "           AND o.status != 'cancelado'" +
    "           AND COALESCE(o.is_unified,0) = 0) AS last_sold_at" +
    "  FROM products p" +
    "  LEFT JOIN categories c ON c.id = p.category_id" +
    " WHERE p.active=1 AND p.stock>0" +
    "   AND p.id NOT IN (" +
    "     SELECT DISTINCT oi.product_id FROM order_items oi" +
    "     JOIN orders o ON o.id = oi.order_id" +
    "     WHERE o.status != 'cancelado' AND COALESCE(o.is_unified,0) = 0" +
    "       AND o.created_at >= ?" +
    "       AND oi.product_id IS NOT NULL" +
    "   )" +
    " ORDER BY (p.cost*p.stock) DESC, p.name ASC" +
    " LIMIT 100"
  ).all(since);
  res.json({ days: days, since: since, rows: rows });
});

// Lista de vendedores con estadisticas de pedidos y entregas (solo admin)
app.get("/api/admin/vendedores", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT u.id, u.username, u.full_name, u.phone, u.whatsapp_number, u.email, u.active," +
    "       u.vendedor_price_level, u.price_list_id, u.is_tercerizado," +
    "       u.created_at, u.last_login_at," +
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
// Reasignar vendedor y/o cliente de un pedido. Cada campo se actualiza solo si
// viene en el body (asi cambiar el cliente no desasigna el vendedor ni al reves).
app.patch("/api/admin/orders/:id/assign", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const order = db.prepare("SELECT id, user_id FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

  const body = req.body || {};
  const hasVend = Object.prototype.hasOwnProperty.call(body, "vendedor_id");
  const hasUser = Object.prototype.hasOwnProperty.call(body, "user_id");
  if (!hasVend && !hasUser) return res.status(400).json({ error: "Nada para actualizar" });

  let vendedorId = null;
  if (hasVend) {
    vendedorId = body.vendedor_id ? Number(body.vendedor_id) : null;
    if (vendedorId) {
      const vendedor = db.prepare("SELECT id FROM users WHERE id = ? AND level = 5 AND active = 1").get(vendedorId);
      if (!vendedor) return res.status(400).json({ error: "Vendedor no encontrado o inactivo" });
    }
  }
  let userId = null;
  if (hasUser) {
    userId = Number(body.user_id) || 0;
    const client = db.prepare("SELECT id FROM users WHERE id = ? AND level IN (1,2,3,4) AND active = 1").get(userId);
    if (!client) return res.status(400).json({ error: "Cliente no encontrado o inactivo" });
  }

  db.transaction(() => {
    if (hasVend) db.prepare("UPDATE orders SET assigned_vendedor_id = ? WHERE id = ?").run(vendedorId, id);
    if (hasUser && userId !== order.user_id) {
      db.prepare("UPDATE orders SET user_id = ? WHERE id = ?").run(userId, id);
      // Los movimientos de cuenta corriente del pedido (debito de la entrega,
      // cobros) siguen al nuevo cliente, sino el saldo queda en el viejo.
      db.prepare("UPDATE account_movements SET user_id = ? WHERE order_id = ?").run(userId, id);
    }
  })();
  res.json({ ok: true, id, vendedor_id: hasVend ? vendedorId : null, user_id: hasUser ? userId : null });
});

// ----- Comisión del vendedor: egreso automático de caja -----
// Cuando se cobra un pedido con vendedor asignado, la parte del vendedor (su
// comisión = Σ (unit_price − vendedor_cost_unit)·qty) sale de la caja como un
// EGRESO, así la caja neta refleja solo lo del dueño. Regla "primero lo tuyo":
// la comisión recién se paga sobre el efectivo cobrado por encima de tu parte
// (total − comisión). El egreso es ÚNICO por pedido (source='comision',
// related_id=order_id) y se recalcula (DELETE + INSERT) en cada cobro/edición
// para que el acumulado sea siempre correcto e idempotente.
function vendorCommissionForOrder(orderId) {
  const r = db.prepare(
    "SELECT COALESCE(SUM(CASE WHEN vendedor_cost_unit IS NOT NULL" +
    "                        THEN (unit_price - vendedor_cost_unit) * quantity ELSE 0 END),0) AS c" +
    "  FROM order_items WHERE order_id = ?"
  ).get(orderId);
  return Math.max(0, Math.round(Number(r && r.c) || 0));
}
function cashCollectedForOrder(orderId) {
  const d = db.prepare(
    "SELECT COALESCE(SUM(COALESCE(efectivo_amount,0) + COALESCE(transferencia_amount,0)),0) AS c" +
    "  FROM deliveries WHERE order_id = ?"
  ).get(orderId);
  const p = db.prepare(
    "SELECT COALESCE(SUM(amount),0) AS c FROM payments WHERE order_id = ?"
  ).get(orderId);
  return (Number(d && d.c) || 0) + (Number(p && p.c) || 0);
}
// Recalcula el egreso de comisión del vendedor para un pedido. cajaHint es la
// caja preferida (la del cobro que disparó el recálculo); si no se pasa, se
// busca la caja de la entrega o del último pago con caja. Debe llamarse DENTRO
// de la transacción del cobro, DESPUÉS de insertar la entrega/pago.
function syncVendorCommissionEgreso(orderId, cajaHint, registeredBy) {
  // Borrar siempre el egreso previo: se recrea abajo si corresponde.
  db.prepare("DELETE FROM cash_movements WHERE source = 'comision' AND related_id = ?").run(orderId);
  const order = db.prepare(
    "SELECT id, total, assigned_vendedor_id, is_unified FROM orders WHERE id = ?"
  ).get(orderId);
  if (!order || order.is_unified || !order.assigned_vendedor_id) return;
  const C = vendorCommissionForOrder(orderId);
  if (C <= 0) return;
  const total = Number(order.total) || 0;
  const loTuyo = Math.max(0, total - C);           // tu parte (primero lo tuyo)
  const cash = cashCollectedForOrder(orderId);     // efectivo real cobrado
  const payable = Math.max(0, Math.min(Math.round(cash - loTuyo), C));
  if (payable <= 0) return;                         // todavía no se cubrió tu parte
  // Caja del egreso: la del cobro, o la de la entrega, o la del último pago con caja.
  let cajaId = cajaHint ? Number(cajaHint) : null;
  if (!cajaId) {
    const dc = db.prepare("SELECT caja_id FROM deliveries WHERE order_id = ? AND caja_id IS NOT NULL LIMIT 1").get(orderId);
    if (dc && dc.caja_id) cajaId = dc.caja_id;
  }
  if (!cajaId) {
    const pc = db.prepare("SELECT caja_id FROM payments WHERE order_id = ? AND caja_id IS NOT NULL ORDER BY id DESC LIMIT 1").get(orderId);
    if (pc && pc.caja_id) cajaId = pc.caja_id;
  }
  if (!cajaId) return;                              // sin caja no se puede representar el egreso
  const caja = db.prepare("SELECT id FROM cash_accounts WHERE id = ?").get(cajaId);
  if (!caja) return;
  const v = db.prepare("SELECT full_name, username FROM users WHERE id = ?").get(order.assigned_vendedor_id);
  const vname = (v && (v.full_name || v.username)) || ("Vendedor #" + order.assigned_vendedor_id);
  db.prepare(
    "INSERT INTO cash_movements (account_id, type, amount, description, source, related_id, registered_by)" +
    " VALUES (?, 'egreso', ?, ?, 'comision', ?, ?)"
  ).run(cajaId, payable, "Comisión vendedor pedido #" + orderId + " (" + vname + ")", orderId, registeredBy || null);
}

// Registrar entrega de un pedido (admin o vendedor asignado)
// Body: { delivered_to, efectivo_amount, transferencia_amount, notes }
app.post("/api/orders/:id/deliver", requireVendedorOrAdmin, requireSectionForAdmin("entregas"), (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });

  const isAdmin = req.session.level === 99;
  // Verificar que el pedido existe y (si vendedor) que es suyo o de uno de sus clientes.
  // Traemos los campos necesarios para descuento de stock y movimiento de cuenta corriente.
  const order = isAdmin
    ? db.prepare(
        "SELECT id, status, stock_discounted, total, user_id, assigned_vendedor_id," +
        "       unified_parent_id, is_unified FROM orders WHERE id = ?"
      ).get(id)
    : db.prepare(
        "SELECT o.id, o.status, o.stock_discounted, o.total, o.user_id, o.assigned_vendedor_id," +
        "       o.unified_parent_id, o.is_unified" +
        "  FROM orders o JOIN users u ON u.id = o.user_id" +
        "  WHERE o.id = ? AND (o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)"
      ).get(id, req.session.userId, req.session.userId);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado o no asignado a vos" });

  // Un pedido cancelado no se entrega: sin este guard, guardar el modal de una
  // entrega vieja (p. ej. para mirar la nota) lo "resucitaba" a entregado,
  // re-descontando stock y re-debitando la cuenta corriente.
  if (order.status === "cancelado") {
    return res.status(409).json({ error: "El pedido esta cancelado. Reactivalo antes de registrar una entrega." });
  }

  const { delivered_to, efectivo_amount, transferencia_amount, notes, caja_id, caja_transfer_id } = req.body || {};
  const deliveredTo = String(delivered_to || "").trim().slice(0, 200);
  if (!deliveredTo) return res.status(400).json({ error: "Falta indicar quien recibio el pedido" });

  const efectivo = Math.max(0, Number(efectivo_amount) || 0);
  const transferencia = Math.max(0, Number(transferencia_amount) || 0);

  // Cajas donde cae el cobro (elegidas a mano). El efectivo va a una caja
  // (caja_id) y la transferencia a otra (caja_transfer_id, ej. billeteras).
  const findCaja = (cid) => {
    if (!cid) return null;
    const c = db.prepare("SELECT id, name FROM cash_accounts WHERE id = ? AND active = 1").get(Number(cid));
    if (!c) { const e = new Error("Caja invalida o inactiva"); e.code = "BADCAJA"; throw e; }
    return c;
  };
  let cajaEfectivo = null, cajaTransfer = null;
  try {
    cajaEfectivo = findCaja(caja_id);
    cajaTransfer = findCaja(caja_transfer_id);
  } catch (e) {
    if (e.code === "BADCAJA") return res.status(400).json({ error: e.message });
    throw e;
  }
  const cajaId = cajaEfectivo ? cajaEfectivo.id : null;
  const cajaTransferId = cajaTransfer ? cajaTransfer.id : null;

  const vendedorId = isAdmin
    ? (order.assigned_vendedor_id || req.session.userId)
    : req.session.userId;
  const notesStr = notes ? String(notes).trim().slice(0, 500) : null;

  // Fecha de la entrega (editable). El front manda YYYY-MM-DD; se guarda a las
  // 12:00 para que las comparaciones por date() de reportes caigan en ese día.
  // Si no se manda, en INSERT usa el default (datetime('now')) y en UPDATE NO se
  // toca la fecha existente (antes se forzaba a 'now', lo que pisaba la fecha
  // real cuando solo se editaba la nota — bug reportado).
  // Acepta "YYYY-MM-DD" (entrega con fecha elegida a mano → mediodía de ese día,
  // para que las comparaciones por día de los reportes caigan bien) o un timestamp
  // completo "YYYY-MM-DD HH:MM:SS" en UTC (entrega nueva de hoy → hora real exacta).
  const rawDate = req.body && req.body.delivered_at ? String(req.body.delivered_at).trim() : "";
  const deliveredAtSql = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate + " 12:00:00"
    : (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawDate) ? rawDate : null);
  // Entregas con fecha futura no entran (contaminan reportes y Ventas). Margen
  // de 1 dia por la diferencia entre el dia local del cliente y el UTC del server.
  if (deliveredAtSql) {
    const maxDay = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    if (deliveredAtSql.slice(0, 10) > maxDay)
      return res.status(400).json({ error: "La fecha de entrega no puede ser futura" });
  }

  // Descuento del pedido — SOLO admin. El vendedor no puede descontar; si entrega,
  // se conserva el descuento que el admin haya dejado (no se toca). discount_value
  // es el número crudo (10 → 10% ; 5000 → $5000); discountAmount es en pesos,
  // acotado entre 0 y el total del pedido.
  let discountType = null, discountValue = 0, discountAmount = 0;
  if (isAdmin) {
    const dt = req.body && req.body.discount_type ? String(req.body.discount_type) : "";
    const dv = Math.max(0, Number(req.body && req.body.discount_value) || 0);
    if ((dt === "percent" || dt === "fixed") && dv > 0) {
      discountType = dt;
      discountValue = dv;
      discountAmount = dt === "percent"
        ? Math.round((Number(order.total) || 0) * Math.min(dv, 100) / 100)
        : Math.round(dv);
      discountAmount = Math.max(0, Math.min(discountAmount, Number(order.total) || 0));
    }
  }

  const existing = db.prepare("SELECT id FROM deliveries WHERE order_id = ?").get(id);
  // Los pedidos individuales absorbidos por un unificado no descuentan stock
  // (lo hace el padre al ser entregado). Misma regla que en PATCH /api/orders/:id.
  // Tampoco si tienen un budget vinculado que ya descontó al crearse.
  const linkedBudgetForDeliver = db.prepare(
    "SELECT stock_discounted FROM budgets WHERE order_id = ? AND stock_discounted = 1 LIMIT 1"
  ).get(id);
  const skipStock = order.unified_parent_id != null || !!linkedBudgetForDeliver;
  const prevStatus = order.status;

  // Vendedor TERCERIZADO = "cobra y rinde": le cobra al cliente, se queda su
  // comisión y te rinde el neto (total − comisión). En ese caso:
  //  - el efectivo que registrás es el NETO que recibís (no el total),
  //  - el cliente queda SALDADO igual: se le acredita el cobro + la comisión
  //    (que "pagó" al quedársela el vendedor),
  //  - NO se genera egreso de comisión en tu caja (nunca tuviste esa plata).
  // Para vendedor propio (o admin) se mantiene el modelo viejo: cobrás el total
  // y la comisión sale como egreso de caja.
  const vendorRow = (!order.is_unified && order.assigned_vendedor_id)
    ? db.prepare("SELECT is_tercerizado, full_name, username FROM users WHERE id = ?").get(order.assigned_vendedor_id)
    : null;
  const orderCommission = vendorRow ? vendorCommissionForOrder(id) : 0;
  const rindeNeto = !!(vendorRow && vendorRow.is_tercerizado && orderCommission > 0);

  let deliveryId;
  db.transaction(() => {
    if (existing) {
      if (deliveredAtSql) {
        db.prepare(
          "UPDATE deliveries SET delivered_to = ?, efectivo_amount = ?, transferencia_amount = ?, notes = ?," +
          "  caja_id = ?, caja_transfer_id = ?, delivered_at = ? WHERE order_id = ?"
        ).run(deliveredTo, efectivo, transferencia, notesStr, cajaId, cajaTransferId, deliveredAtSql, id);
      } else {
        // Sin fecha nueva: se conserva la delivered_at existente (no se pisa).
        db.prepare(
          "UPDATE deliveries SET delivered_to = ?, efectivo_amount = ?, transferencia_amount = ?, notes = ?," +
          "  caja_id = ?, caja_transfer_id = ? WHERE order_id = ?"
        ).run(deliveredTo, efectivo, transferencia, notesStr, cajaId, cajaTransferId, id);
      }
      deliveryId = existing.id;
    } else if (deliveredAtSql) {
      const r = db.prepare(
        "INSERT INTO deliveries (order_id, vendedor_id, delivered_to, efectivo_amount, transferencia_amount, notes, caja_id, caja_transfer_id, delivered_at)" +
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(id, vendedorId, deliveredTo, efectivo, transferencia, notesStr, cajaId, cajaTransferId, deliveredAtSql);
      deliveryId = r.lastInsertRowid;
    } else {
      const r = db.prepare(
        "INSERT INTO deliveries (order_id, vendedor_id, delivered_to, efectivo_amount, transferencia_amount, notes, caja_id, caja_transfer_id)" +
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(id, vendedorId, deliveredTo, efectivo, transferencia, notesStr, cajaId, cajaTransferId);
      deliveryId = r.lastInsertRowid;
    }
    // Marcar el pedido como entregado automaticamente
    db.prepare("UPDATE orders SET status = 'entregado' WHERE id = ?").run(id);

    // Guardar el descuento en el pedido (solo admin; el vendedor no lo toca).
    if (isAdmin) {
      db.prepare(
        "UPDATE orders SET discount_type = ?, discount_value = ?, discount_amount = ? WHERE id = ?"
      ).run(discountType, discountType ? discountValue : null, discountAmount, id);
    }

    // Si el pedido aun no estaba entregado y no se descuento stock previamente,
    // hacer el descuento de stock + debito en cuenta corriente. Misma logica que
    // PATCH /api/orders/:id status='entregado'. Si la entrega ya existia
    // (existing != null), entonces prevStatus ya era 'entregado' y stock_discounted = 1,
    // por lo que esta rama no se ejecuta -> no hay doble descuento al editar.
    if (prevStatus !== "entregado" && !order.stock_discounted) {
      if (!skipStock) {
        const items = db.prepare(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
        ).all(id);
        const updStock = db.prepare(
          "UPDATE products SET stock = stock - ? WHERE id = ?"
        );
        for (const it of items) {
          if (it.product_id) {
            updStock.run(it.quantity, it.product_id);
            logStockMovement(it.product_id, "entrega", -it.quantity, id, "Pedido #" + id + " entregado", req.session.userId);
          }
        }
      }
      // El pedido unificado no genera debito (es solo el consolidado para el admin);
      // los hijos individuales si generan debito contra la cuenta del cliente final.
      if (!order.is_unified) {
        db.prepare(
          "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
          " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
        ).run(order.user_id, order.total, "Pedido #" + id, id);
      }
      db.prepare("UPDATE orders SET stock_discounted = 1 WHERE id = ?").run(id);
    }

    // Red de seguridad: garantizar el débito en cuenta corriente de un pedido
    // entregado de un cliente real (level 1..4), no unificado. Cubre pedidos que
    // llegaron con stock_discounted=1 pero sin débito (versiones viejas o caminos
    // que no debitaron). Idempotente: solo inserta si falta. Sin esto el saldo del
    // pedido no refleja la deuda y el cobro registrado después no la baja.
    if (!order.is_unified) {
      const hasDebit = db.prepare(
        "SELECT id FROM account_movements WHERE order_id = ? AND type = 'debit' LIMIT 1"
      ).get(id);
      if (!hasDebit) {
        const cli = db.prepare("SELECT level FROM users WHERE id = ?").get(order.user_id);
        if (cli && cli.level >= 1 && cli.level <= 4) {
          db.prepare(
            "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
            " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
          ).run(order.user_id, order.total, "Pedido #" + id, id);
        }
      }
    }

    // Crédito automático por el cobro registrado en la entrega.
    // Si es edición de entrega existente, revocar el crédito anterior y crear el nuevo.
    const cobrado = efectivo + transferencia;
    if (!order.is_unified) {
      // Revocar crédito previo de entrega (si existe)
      db.prepare(
        "DELETE FROM account_movements WHERE order_id = ? AND type = 'credit' AND description LIKE 'Cobro entrega%'"
      ).run(id);
      // Crear nuevo crédito si hay monto cobrado
      if (cobrado > 0) {
        const parts = [];
        if (efectivo > 0) parts.push("efectivo $" + efectivo.toLocaleString("es-AR"));
        if (transferencia > 0) parts.push("transferencia $" + transferencia.toLocaleString("es-AR"));
        db.prepare(
          "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
          " VALUES (?, 'credit', ?, ?, ?, datetime('now'))"
        ).run(order.user_id, cobrado, "Cobro entrega #" + id + " (" + parts.join(" + ") + ")", id);
      }
      // Comisión rendida (solo tercerizado): el cliente ya pagó esa parte al
      // quedársela el vendedor. Se acredita para saldar la cuenta del cliente.
      // Se revoca siempre primero (cubre edición o pedido que dejó de ser rinde).
      db.prepare(
        "DELETE FROM account_movements WHERE order_id = ? AND type = 'credit' AND description LIKE 'Comisión rendida%'"
      ).run(id);
      if (rindeNeto && cobrado > 0) {
        const netRinde = Math.max(0, (Number(order.total) || 0) - discountAmount - orderCommission);
        const fraction = netRinde > 0 ? Math.min(1, cobrado / netRinde) : 1;
        const commissionCovered = Math.max(0, Math.min(Math.round(orderCommission * fraction), orderCommission));
        if (commissionCovered > 0) {
          const vname = (vendorRow.full_name || vendorRow.username) || "vendedor";
          db.prepare(
            "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
            " VALUES (?, 'credit', ?, ?, ?, datetime('now'))"
          ).run(order.user_id, commissionCovered, "Comisión rendida vendedor #" + id + " (" + vname + ")", id);
        }
      }
    }

    // Descuento del pedido como CRÉDITO en cuenta corriente (baja la deuda).
    // Se registra aparte del débito original (que queda por el total bruto), así
    // queda auditable y reversible. Solo el admin lo gestiona; al editar la
    // entrega se revoca el descuento previo y se recrea con el nuevo valor.
    if (isAdmin && !order.is_unified) {
      db.prepare(
        "DELETE FROM account_movements WHERE order_id = ? AND type = 'credit' AND description LIKE 'Descuento pedido%'"
      ).run(id);
      if (discountAmount > 0) {
        const dlabel = discountType === "percent"
          ? (discountValue + "%")
          : ("$" + Math.round(discountValue).toLocaleString("es-AR"));
        db.prepare(
          "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
          " VALUES (?, 'credit', ?, ?, ?, datetime('now'))"
        ).run(order.user_id, discountAmount, "Descuento pedido #" + id + " (" + dlabel + ")", id);
      }
    }

    // Ingresos en las cajas elegidas (saldo corriente). El efectivo cae en
    // cajaEfectivo y la transferencia en cajaTransfer (pueden ser distintas).
    // Revertir los previos de esta entrega y recrear (cubre edición de entrega).
    db.prepare(
      "DELETE FROM cash_movements WHERE source = 'entrega' AND related_id = ?"
    ).run(deliveryId);
    const insCashMov = db.prepare(
      "INSERT INTO cash_movements (account_id, type, amount, description, source, related_id, registered_by)" +
      " VALUES (?, 'ingreso', ?, ?, 'entrega', ?, ?)"
    );
    if (cajaEfectivo && efectivo > 0) {
      insCashMov.run(cajaEfectivo.id, efectivo, "Cobro entrega #" + id + " (efectivo)", deliveryId, req.session.userId);
    }
    if (cajaTransfer && transferencia > 0) {
      insCashMov.run(cajaTransfer.id, transferencia, "Cobro entrega #" + id + " (transferencia)", deliveryId, req.session.userId);
    }
    // Comisión del vendedor. Tercerizado (rinde neto): el vendedor ya se la
    // quedó, no hay egreso en tu caja (limpiar cualquiera previo). Propio/admin:
    // egreso automático (la caja queda en lo tuyo).
    if (rindeNeto) {
      db.prepare("DELETE FROM cash_movements WHERE source = 'comision' AND related_id = ?").run(id);
    } else {
      syncVendorCommissionEgreso(id, cajaEfectivo ? cajaEfectivo.id : (cajaTransfer ? cajaTransfer.id : null), req.session.userId);
    }
  })();

  res.json({
    ok: true, delivery_id: deliveryId, order_id: id,
    discount_type: discountType, discount_value: discountType ? discountValue : null,
    discount_amount: discountAmount,
    net_total: Math.max(0, (Number(order.total) || 0) - discountAmount),
  });
});

// Lista completa de entregas con datos de pago (solo admin)
app.get("/api/admin/deliveries", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT d.id, d.order_id, d.delivered_to, d.efectivo_amount, d.transferencia_amount," +
    "       d.notes, d.delivered_at, d.caja_id, ca.name AS caja_name," +
    "       d.caja_transfer_id, ct.name AS caja_transfer_name," +
    "       v.id AS vendedor_id, v.username AS vendedor_username, v.full_name AS vendedor_full_name," +
    "       o.total AS order_total, o.status AS order_status," +
    "       u.username AS client_username, u.full_name AS client_full_name" +
    "  FROM deliveries d" +
    "  JOIN users v ON v.id = d.vendedor_id" +
    "  JOIN orders o ON o.id = d.order_id" +
    "  JOIN users u ON u.id = o.user_id" +
    "  LEFT JOIN cash_accounts ca ON ca.id = d.caja_id" +
    "  LEFT JOIN cash_accounts ct ON ct.id = d.caja_transfer_id" +
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
    "       COALESCE(po.received, 0) AS received," +
    "       COUNT(pi.id) AS items_count" +
    "  FROM purchase_orders po" +
    "  LEFT JOIN suppliers s ON s.id = po.supplier_id" +
    "  LEFT JOIN purchase_items pi ON pi.purchase_order_id = po.id" +
    "  GROUP BY po.id" +
    "  ORDER BY po.received_at DESC LIMIT 200"
  ).all();
  res.json(rows);
});

// Aplica la política de actualización de costo al registrar/editar una compra.
// policy: 'higher' (solo si el nuevo costo supera al actual), 'always' (siempre),
// 'never' (no tocar). Si se actualiza el costo y había un costo previo > 0, se
// ajustan los precios de venta en la misma proporción para mantener el margen.
// Debe llamarse DENTRO de una transacción.
const PURCHASE_COST_POLICIES = ["higher", "always", "never"];
function applyPurchaseCostUpdate(productId, newCostRaw, policy, purchaseId) {
  if (!productId || policy === "never") return;
  const prod = db.prepare(
    "SELECT cost, price_minorista, price_revendedor, price_mayorista, price_vip, price_publico" +
    "  FROM products WHERE id = ?"
  ).get(productId);
  if (!prod) return;
  const oldCost = Number(prod.cost) || 0;
  const newCost = Math.max(0, Number(newCostRaw) || 0);
  const shouldUpdate = policy === "always" || (policy === "higher" && newCost > oldCost);
  if (!shouldUpdate) return;
  // Historial de costos para el reporte de inflacion. IMPORTANTE: los callers
  // llaman esta funcion ANTES de sumar el stock de la compra, asi el stock
  // registrado es el que habia comprado al costo viejo (revalorizacion exacta).
  try { logCostChange(productId, oldCost, newCost, "compra", purchaseId || null); } catch (_) {}
  if (oldCost > 0 && newCost > 0) {
    // Mantener margen: cada precio de venta se mueve en la misma proporción.
    const ratio = newCost / oldCost;
    // Snapshot ANTES (los 5 niveles, publico incluido) para historizar el ajuste.
    const before = {
      price_minorista: prod.price_minorista, price_revendedor: prod.price_revendedor,
      price_mayorista: prod.price_mayorista, price_vip: prod.price_vip,
      price_publico: prod.price_publico,
    };
    db.prepare(
      "UPDATE products SET cost = ?," +
      "  price_minorista  = CAST(ROUND(price_minorista  * ?) AS INTEGER)," +
      "  price_revendedor = CAST(ROUND(price_revendedor * ?) AS INTEGER)," +
      "  price_mayorista  = CAST(ROUND(price_mayorista  * ?) AS INTEGER)," +
      "  price_vip        = CAST(ROUND(price_vip        * ?) AS INTEGER)," +
      "  price_publico    = CAST(ROUND(price_publico    * ?) AS INTEGER)" +
      "  WHERE id = ?"
    ).run(newCost, ratio, ratio, ratio, ratio, ratio, productId);
    const after = db.prepare(
      "SELECT price_minorista, price_revendedor, price_mayorista, price_vip, price_publico FROM products WHERE id = ?"
    ).get(productId);
    try { recordManualPriceChange(productId, before, after); } catch (_) {}
  } else {
    // Sin costo previo no se puede mantener margen: solo seteamos el costo.
    db.prepare("UPDATE products SET cost = ? WHERE id = ?").run(newCost, productId);
  }
}

app.post("/api/admin/purchases", requireAdmin, (req, res) => {
  const b = req.body || {};
  const supplier_id  = b.supplier_id ? Number(b.supplier_id) : null;
  const reference    = String(b.reference || "").trim().slice(0, 200) || null;
  const notes        = String(b.notes || "").trim().slice(0, 500) || null;
  const received_at  = String(b.received_at || "").trim() || null;
  const cost_policy  = PURCHASE_COST_POLICIES.includes(b.cost_policy) ? b.cost_policy : "higher";
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
    for (const l of lines) {
      insItem.run(purchaseId, l.product_id, l.product_code, l.product_name,
                  l.quantity, l.unit_cost, l.subtotal);
      if (l.product_id) {
        // El stock NO se suma aca: la compra queda pendiente (received=0) y el
        // stock entra recien al confirmar la recepcion. El costo y los precios
        // de venta SI se actualizan al cargar la compra (snapshot de stock del
        // cost_change = stock previo, sin las unidades que todavia no llegaron).
        applyPurchaseCostUpdate(l.product_id, l.unit_cost, cost_policy, purchaseId);
      }
    }

    // Cuenta corriente del proveedor: la compra genera la deuda (debit).
    if (supplier_id && totalCost > 0) {
      db.prepare(
        "INSERT INTO supplier_movements (supplier_id, type, amount, description, purchase_order_id, created_at)" +
        " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
      ).run(supplier_id, totalCost, "Compra #" + purchaseId + (reference ? " · " + reference : ""), purchaseId);
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

  const existing = db.prepare("SELECT id, received FROM purchase_orders WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Compra no encontrada" });
  // Solo si la compra ya fue recibida su stock esta impactado: al editarla hay
  // que revertir el stock viejo y sumar el nuevo. Si esta pendiente de recibir,
  // editar no toca stock (todavia no entro).
  const wasReceived = Number(existing.received) === 1;

  const b = req.body || {};
  const supplier_id = b.supplier_id ? Number(b.supplier_id) : null;
  const reference   = String(b.reference || "").trim().slice(0, 200) || null;
  const notes       = String(b.notes || "").trim().slice(0, 500) || null;
  const received_at = String(b.received_at || "").trim() || null;
  const cost_policy = PURCHASE_COST_POLICIES.includes(b.cost_policy) ? b.cost_policy : "higher";
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
    // Revertir stock de items anteriores SOLO si la compra ya estaba recibida.
    if (wasReceived) {
      const oldItems = db.prepare("SELECT product_id, quantity FROM purchase_items WHERE purchase_order_id = ?").all(id);
      const decStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
      for (const oi of oldItems) {
        if (oi.product_id) {
          decStock.run(oi.quantity, oi.product_id);
          logStockMovement(oi.product_id, "compra", -oi.quantity, id, "Edicion de compra #" + id + " (revierte items anteriores)", req.session.userId);
        }
      }
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
      if (l.product_id) {
        // Costo/precios se actualizan siempre (como en el POST). El stock solo
        // se vuelve a sumar si la compra ya estaba recibida (sino entra en la
        // recepcion).
        applyPurchaseCostUpdate(l.product_id, l.unit_cost, cost_policy, id);
        if (wasReceived) {
          incStock.run(l.quantity, l.product_id);
          logStockMovement(l.product_id, "compra", l.quantity, id, "Edicion de compra #" + id + (reference ? " · " + reference : ""), req.session.userId);
        }
      }
    }

    // Recalcular la deuda del proveedor: borrar el debit anterior de esta compra
    // y reinsertarlo con el nuevo total/proveedor. Los pagos (credits) quedan.
    db.prepare(
      "DELETE FROM supplier_movements WHERE purchase_order_id = ? AND type = 'debit'"
    ).run(id);
    if (supplier_id && totalCost > 0) {
      db.prepare(
        "INSERT INTO supplier_movements (supplier_id, type, amount, description, purchase_order_id, created_at)" +
        " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
      ).run(supplier_id, totalCost, "Compra #" + id + (reference ? " · " + reference : ""), id);
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

// Eliminar una compra (ej: pedido al proveedor que nunca llego y se cancelo).
// El sistema detecta si el stock ya habia entrado (received = 1, via confirmar
// recepcion o compras viejas pre-recepcion) y solo en ese caso lo revierte.
// Tambien elimina el debit de cuenta corriente del proveedor (los pagos quedan,
// son del proveedor, no de la compra). Los cambios de costo/precios que se
// aplicaron al CARGAR la compra (applyPurchaseCostUpdate) NO se revierten:
// pudieron pisarse con compras posteriores y revertirlos descuadraria.
app.delete("/api/admin/purchases/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const purchase = db.prepare(
    "SELECT id, supplier_id, reference, COALESCE(received, 0) AS received FROM purchase_orders WHERE id = ?"
  ).get(id);
  if (!purchase) return res.status(404).json({ error: "Compra no encontrada" });
  const wasReceived = Number(purchase.received) === 1;
  let stockReverted = 0;
  db.transaction(() => {
    if (wasReceived) {
      const items = db.prepare(
        "SELECT product_id, quantity FROM purchase_items WHERE purchase_order_id = ?"
      ).all(id);
      const decStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
      for (const it of items) {
        if (it.product_id) {
          decStock.run(it.quantity, it.product_id);
          stockReverted += Number(it.quantity) || 0;
          logStockMovement(it.product_id, "compra_eliminada", -it.quantity, id, "Compra #" + id + " eliminada (revierte stock)", req.session.userId);
        }
      }
    }
    db.prepare("DELETE FROM supplier_movements WHERE purchase_order_id = ? AND type = 'debit'").run(id);
    db.prepare("DELETE FROM purchase_items WHERE purchase_order_id = ?").run(id);
    db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(id);
  })();
  res.json({ ok: true, deleted: id, was_received: wasReceived, stock_reverted: stockReverted });
});

// ===== Control de recepcion de mercaderia (pestaña Recepcion) =====
//
// El encargado controla lo que llego de cada compra contra lo cargado, item por
// item, con la equivalencia bulto/unidad (products.units_per_bulto): el
// proveedor suele facturar por bulto y el sistema carga unidades sueltas.
// Mismo esquema de sync multi-dispositivo que el chequeo de armado: POST por
// item + polling del GET (ultima escritura gana). Las diferencias se impactan
// en la compra (cantidades, total, stock, deuda) solo con el boton explicito
// del modal (apply).

// Lista de compras con el estado del control (sin control / parcial / completo).
// Normaliza un vencimiento ingresado como MM/AA (o MM/AAAA) al formato interno
// 'YYYY-MM'. Devuelve null si esta vacio; false si es invalido (mes 1..12).
function normalizeExpiry(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return false;
  let mo = Number(m[1]); let yr = Number(m[2]);
  if (mo < 1 || mo > 12) return false;
  if (yr < 100) yr += 2000;
  return String(yr).padStart(4, "0") + "-" + String(mo).padStart(2, "0");
}
// 'YYYY-MM' -> 'MM/AA' para mostrar.
function expiryLabel(ym) {
  if (!ym) return "";
  const m = String(ym).match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(ym);
  return m[2] + "/" + m[1].slice(2);
}
// Meses que faltan para el vencimiento (negativo = ya vencido). El producto se
// considera bueno hasta el fin del mes indicado.
function monthsUntilExpiry(ym, now) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const cur = (now || new Date());
  const curIdx = cur.getFullYear() * 12 + (cur.getMonth() + 1);
  const expIdx = Number(m[1]) * 12 + Number(m[2]);
  return expIdx - curIdx;
}

app.get("/api/admin/reception", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT po.id, po.supplier_id, s.name AS supplier_name," +
    "       po.reference, po.total_cost, po.received_at, po.created_at," +
    "       COALESCE(po.received, 0) AS received," +
    "       COUNT(pi.id) AS items_count," +
    "       SUM(CASE WHEN pi.checked_qty IS NOT NULL THEN 1 ELSE 0 END) AS checked_count," +
    "       SUM(CASE WHEN pi.checked_qty IS NOT NULL AND pi.checked_qty != pi.quantity THEN 1 ELSE 0 END) AS diff_count" +
    "  FROM purchase_orders po" +
    "  LEFT JOIN suppliers s ON s.id = po.supplier_id" +
    "  LEFT JOIN purchase_items pi ON pi.purchase_order_id = po.id" +
    "  GROUP BY po.id" +
    "  ORDER BY po.received_at DESC LIMIT 200"
  ).all();
  res.json(rows);
});

// Items de una compra para el checklist de control.
app.get("/api/admin/reception/:purchaseId", requireAdmin, (req, res) => {
  const purchaseId = Number(req.params.purchaseId);
  if (!purchaseId) return res.status(400).json({ error: "ID invalido" });
  const purchase = db.prepare(
    "SELECT po.id, po.reference, po.received_at, COALESCE(po.received, 0) AS received," +
    "       s.name AS supplier_name" +
    "  FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id" +
    " WHERE po.id = ?"
  ).get(purchaseId);
  if (!purchase) return res.status(404).json({ error: "Compra no encontrada" });
  const items = db.prepare(
    "SELECT pi.id, pi.product_id, pi.product_code, pi.product_name, pi.quantity, pi.unit_cost," +
    "       pi.checked_qty, pi.checked_at, pi.expiry_date," +
    "       cu.full_name AS checked_by_name," +
    "       COALESCE(p.units_per_bulto, 1) AS units_per_bulto," +
    "       COALESCE(p.expiry_alert_months, 3) AS expiry_alert_months," +
    "       COALESCE(c.name, 'Sin categoría') AS category_name" +
    "  FROM purchase_items pi" +
    "  LEFT JOIN products p ON p.id = pi.product_id" +
    "  LEFT JOIN categories c ON c.id = p.category_id" +
    "  LEFT JOIN users cu ON cu.id = pi.checked_by" +
    " WHERE pi.purchase_order_id = ?" +
    " ORDER BY COALESCE(c.sort_order, 9999), category_name, pi.product_name"
  ).all(purchaseId);
  const done = items.filter((i) => i.checked_qty != null).length;
  const diffs = items.filter(
    (i) => i.checked_qty != null && Number(i.checked_qty) !== Number(i.quantity)
  ).length;
  res.json({
    purchase: purchase,
    items: items,
    total_items: items.length,
    done_items: done,
    diff_items: diffs,
    complete: items.length > 0 && done === items.length,
  });
});

// Guardar lo contado de un item. checked_qty >= 0 (puede superar lo cargado:
// el proveedor pudo mandar de mas); null/"" destilda (vuelve a "sin controlar").
app.post("/api/admin/reception/:purchaseId", requireAdmin, (req, res) => {
  const purchaseId = Number(req.params.purchaseId);
  const itemId = Number(req.body && req.body.item_id);
  if (!purchaseId || !itemId) return res.status(400).json({ error: "item_id requerido" });
  const item = db.prepare(
    "SELECT id FROM purchase_items WHERE id = ? AND purchase_order_id = ?"
  ).get(itemId, purchaseId);
  if (!item) return res.status(404).json({ error: "Item no encontrado en esta compra" });

  // Guardado del vencimiento (independiente del conteo): si el body trae
  // expiry_date, se actualiza solo esa columna y se responde. MM/AA -> YYYY-MM.
  if (req.body && "expiry_date" in req.body) {
    const norm = normalizeExpiry(req.body.expiry_date);
    if (norm === false) return res.status(400).json({ error: "Vencimiento inválido (usá MM/AA)" });
    db.prepare("UPDATE purchase_items SET expiry_date = ? WHERE id = ?").run(norm, itemId);
    return res.json({ ok: true, item_id: itemId, expiry_date: norm, expiry_label: expiryLabel(norm) });
  }

  const raw = req.body ? req.body.checked_qty : null;
  let qty = null;
  if (raw !== null && raw !== undefined && raw !== "") {
    qty = Number(raw);
    if (!isFinite(qty) || qty < 0) return res.status(400).json({ error: "Cantidad invalida" });
  }
  if (qty !== null) {
    db.prepare(
      "UPDATE purchase_items SET checked_qty = ?, checked_by = ?, checked_at = datetime('now') WHERE id = ?"
    ).run(qty, req.session.userId, itemId);
  } else {
    db.prepare(
      "UPDATE purchase_items SET checked_qty = NULL, checked_by = NULL, checked_at = NULL WHERE id = ?"
    ).run(itemId);
  }
  const agg = db.prepare(
    "SELECT COUNT(*) AS total," +
    "       SUM(CASE WHEN checked_qty IS NOT NULL THEN 1 ELSE 0 END) AS done," +
    "       SUM(CASE WHEN checked_qty IS NOT NULL AND checked_qty != quantity THEN 1 ELSE 0 END) AS diffs" +
    "  FROM purchase_items WHERE purchase_order_id = ?"
  ).get(purchaseId);
  res.json({
    ok: true,
    item_id: itemId,
    checked_qty: qty,
    total_items: agg.total,
    done_items: agg.done || 0,
    diff_items: agg.diffs || 0,
    complete: agg.total > 0 && Number(agg.done) === Number(agg.total),
  });
});

// Confirmar la recepcion (boton explicito del modal). Aca recien IMPACTA EL
// STOCK: se suma a cada producto lo realmente recibido (lo contado si se
// controlo el item, lo cargado si no). Los items contados con cantidad distinta
// a la cargada ajustan tambien quantity/subtotal/total_cost y la deuda del
// proveedor. La compra queda marcada received=1 y no se puede volver a recibir.
app.post("/api/admin/reception/:purchaseId/apply", requireAdmin, (req, res) => {
  const purchaseId = Number(req.params.purchaseId);
  if (!purchaseId) return res.status(400).json({ error: "ID invalido" });
  const purchase = db.prepare(
    "SELECT id, supplier_id, reference, COALESCE(received, 0) AS received FROM purchase_orders WHERE id = ?"
  ).get(purchaseId);
  if (!purchase) return res.status(404).json({ error: "Compra no encontrada" });
  if (Number(purchase.received) === 1) {
    return res.status(409).json({ error: "Esta compra ya fue recibida (el stock ya entro)." });
  }

  const items = db.prepare(
    "SELECT id, product_id, product_name, quantity, unit_cost, checked_qty" +
    "  FROM purchase_items WHERE purchase_order_id = ?"
  ).all(purchaseId);
  if (!items.length) return res.status(400).json({ error: "La compra no tiene items" });

  // Cantidad recibida por item: lo contado si se controlo, lo cargado si no.
  const recv = items.map((it) => ({
    it: it,
    rq: it.checked_qty != null ? Number(it.checked_qty) : Number(it.quantity),
  }));

  let total = 0;
  let changed = 0;
  const changeNotes = []; // resumen de diferencias para dejar en las notas
  db.transaction(() => {
    const updItem  = db.prepare("UPDATE purchase_items SET quantity = ?, subtotal = ? WHERE id = ?");
    const incStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    for (const r of recv) {
      const it = r.it, rq = r.rq;
      if (rq !== Number(it.quantity)) {
        updItem.run(rq, round2(Number(it.unit_cost) * rq), it.id);
        changed++;
        changeNotes.push((it.product_name || ("item #" + it.id)) +
          ": cargado " + Number(it.quantity) + " → recibido " + rq);
      }
      // El stock entra AHORA: la compra no lo habia sumado al cargarse.
      if (it.product_id && rq > 0) {
        incStock.run(rq, it.product_id);
        logStockMovement(it.product_id, "compra", rq, purchaseId, "Recepcion de compra #" + purchaseId + (purchase.reference ? " · " + purchase.reference : ""), req.session.userId);
      }
    }
    total = round2(
      db.prepare(
        "SELECT COALESCE(SUM(subtotal),0) AS t FROM purchase_items WHERE purchase_order_id = ?"
      ).get(purchaseId).t
    );
    db.prepare(
      "UPDATE purchase_orders SET total_cost = ?, received = 1," +
      "  received_at = COALESCE(received_at, datetime('now')) WHERE id = ?"
    ).run(total, purchaseId);
    // Dejar registrado el ajuste de la recepcion en las notas de la compra.
    if (changeNotes.length) {
      const stamp = db.prepare("SELECT datetime('now','localtime') AS d").get().d.slice(0, 16);
      const line = "[Recepción " + stamp + "] " + changeNotes.join("; ") +
        " · total ajustado a $" + total;
      const cur = (db.prepare("SELECT notes FROM purchase_orders WHERE id = ?").get(purchaseId).notes || "").trim();
      db.prepare("UPDATE purchase_orders SET notes = ? WHERE id = ?")
        .run((cur ? cur + "\n" : "") + line, purchaseId);
    }
    if (purchase.supplier_id) {
      const upd = db.prepare(
        "UPDATE supplier_movements SET amount = ? WHERE purchase_order_id = ? AND type = 'debit'"
      ).run(total, purchaseId);
      // Si la compra se creó sin deuda (total 0 → nunca se insertó el debit) y la
      // recepción la ajustó a un total > 0, no hay fila que actualizar: crear la
      // deuda del proveedor ahora, para que no quede sin registrar.
      if (upd.changes === 0 && total > 0) {
        const ref = purchase.reference ? " · " + purchase.reference : "";
        db.prepare(
          "INSERT INTO supplier_movements (supplier_id, type, amount, description, purchase_order_id, created_at)" +
          " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
        ).run(purchase.supplier_id, total, "Compra #" + purchaseId + ref, purchaseId);
      }
    }
  })();

  logActivity(req, "compra", "Compra #" + purchaseId + " · recepcion confirmada · stock impactado · total $" +
    total + (changed ? " · " + changed + " items con diferencia" : ""));
  res.json({ ok: true, received: true, changed: changed, total: total });
});

// Cambiar el producto al que apunta una linea de la recepcion (clic derecho en
// el checklist). Solo si la compra todavia NO fue recibida (si ya entro el
// stock, cambiar el producto descuadraria el inventario). Re-apunta
// product_id/code/name; el stock ira al producto nuevo al confirmar.
app.post("/api/admin/reception/:purchaseId/item/:itemId/product", requireAdmin, (req, res) => {
  const purchaseId = Number(req.params.purchaseId);
  const itemId = Number(req.params.itemId);
  const productId = Number(req.body && req.body.product_id);
  if (!purchaseId || !itemId || !productId) return res.status(400).json({ error: "Datos invalidos" });
  const po = db.prepare("SELECT COALESCE(received,0) AS received FROM purchase_orders WHERE id = ?").get(purchaseId);
  if (!po) return res.status(404).json({ error: "Compra no encontrada" });
  if (Number(po.received) === 1) {
    return res.status(409).json({ error: "La compra ya fue recibida; no se puede cambiar el producto." });
  }
  const item = db.prepare(
    "SELECT id FROM purchase_items WHERE id = ? AND purchase_order_id = ?"
  ).get(itemId, purchaseId);
  if (!item) return res.status(404).json({ error: "Item no encontrado en esta compra" });
  const prod = db.prepare("SELECT id, code, name FROM products WHERE id = ?").get(productId);
  if (!prod) return res.status(404).json({ error: "Producto no encontrado" });
  db.prepare(
    "UPDATE purchase_items SET product_id = ?, product_code = ?, product_name = ? WHERE id = ?"
  ).run(prod.id, prod.code || "", prod.name || "", itemId);
  res.json({ ok: true, item_id: itemId, product_id: prod.id, product_code: prod.code, product_name: prod.name });
});

// Centro de notificaciones del admin: agrega alertas de varias areas en una
// sola llamada (la campana del header). Cada alerta trae un id estable para que
// el frontend lleve el contador de "no leidas" en localStorage. Se filtra por
// los permisos de seccion del admin (el superadmin ve todo).
app.get("/api/admin/notifications", requireAdmin, (req, res) => {
  const perms = getAdminPerms(req.session.userId);
  const can = (sec) => perms.isSuperadmin || perms.sections.has(sec);
  const now = new Date();
  const out = { vencimientos: [], stock_bajo: [], pedidos: [], counts: {} };

  // Vencimientos: lotes recibidos cuyo vencimiento entra en la ventana de aviso
  // del producto (meses, default 3) o ya vencidos. Solo productos con stock > 0
  // (no tiene sentido avisar de algo que ya no esta en deposito).
  if (can("recepcion") || can("productos")) {
    const rows = db.prepare(
      "SELECT pi.id AS item_id, pi.purchase_order_id, pi.expiry_date," +
      "       pi.product_id, pi.product_code, pi.product_name," +
      "       COALESCE(p.stock, 0) AS stock," +
      "       COALESCE(p.expiry_alert_months, 3) AS alert_months," +
      "       COALESCE(c.name, 'Sin categoría') AS category_name" +
      "  FROM purchase_items pi" +
      "  LEFT JOIN products p ON p.id = pi.product_id" +
      "  LEFT JOIN categories c ON c.id = p.category_id" +
      " WHERE pi.expiry_date IS NOT NULL AND COALESCE(p.stock,0) > 0"
    ).all();
    for (const r of rows) {
      const ml = monthsUntilExpiry(r.expiry_date, now);
      if (ml == null) continue;
      const alert = Number(r.alert_months);
      if (ml > alert) continue; // todavia lejos del vencimiento
      out.vencimientos.push({
        id: "venc:" + r.item_id,
        item_id: r.item_id,
        purchase_id: r.purchase_order_id,
        product_id: r.product_id,
        product_code: r.product_code,
        product_name: r.product_name,
        category_name: r.category_name,
        stock: r.stock,
        expiry_date: r.expiry_date,
        expiry_label: expiryLabel(r.expiry_date),
        months_left: ml,
        alert_months: alert,
        status: ml < 0 ? "vencido" : "por_vencer",
      });
    }
    out.vencimientos.sort((a, b) => a.months_left - b.months_left);
  }

  // Stock bajo: productos activos con stock por debajo (o igual) de su minimo.
  if (can("productos")) {
    const rows = db.prepare(
      "SELECT p.id, p.code, p.name, p.stock, p.stock_min," +
      "       COALESCE(c.name, 'Sin categoría') AS category_name" +
      "  FROM products p LEFT JOIN categories c ON c.id = p.category_id" +
      " WHERE p.active = 1 AND COALESCE(p.stock_min,0) > 0 AND p.stock <= p.stock_min" +
      " ORDER BY (p.stock - p.stock_min), p.name LIMIT 200"
    ).all();
    for (const r of rows) {
      out.stock_bajo.push({
        id: "stock:" + r.id,
        product_id: r.id,
        product_code: r.code,
        product_name: r.name,
        category_name: r.category_name,
        stock: r.stock,
        stock_min: r.stock_min,
        status: r.stock <= 0 ? "sin_stock" : "bajo",
      });
    }
  }

  // Pedidos pendientes de accion: por armar (pendiente/enviado/preparando) y por
  // entregar (listo). Excluye los unificados del tercerizado.
  if (can("pedidos") || can("armado") || can("entregas")) {
    const rows = db.prepare(
      "SELECT o.id, o.status, o.created_at," +
      "       COALESCE(u.full_name, u.username, 'Cliente') AS client_name" +
      "  FROM orders o LEFT JOIN users u ON u.id = o.user_id" +
      " WHERE o.status IN ('pendiente','enviado','preparando','listo')" +
      "   AND COALESCE(o.is_unified,0) = 0" +
      " ORDER BY o.created_at DESC LIMIT 200"
    ).all();
    for (const r of rows) {
      out.pedidos.push({
        id: "ped:" + r.id + ":" + r.status,
        order_id: r.id,
        status: r.status,
        client_name: r.client_name,
        created_at: r.created_at,
      });
    }
  }

  out.counts = {
    vencimientos: out.vencimientos.length,
    stock_bajo: out.stock_bajo.length,
    pedidos: out.pedidos.length,
    total: out.vencimientos.length + out.stock_bajo.length + out.pedidos.length,
  };
  res.json(out);
});

// ===== Pedidos de cotizacion =====

app.get("/api/admin/purchase-requests", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT pr.*, s.name AS supplier_name," +
    "  (SELECT COUNT(*) FROM purchase_request_items WHERE request_id = pr.id) AS items_count" +
    "  FROM purchase_requests pr" +
    "  LEFT JOIN suppliers s ON s.id = pr.supplier_id" +
    "  ORDER BY pr.created_at DESC LIMIT 500"
  ).all();
  res.json(rows);
});

app.post("/api/admin/purchase-requests", requireAdmin, (req, res) => {
  const b = req.body || {};
  const supplier_id = Number(b.supplier_id) || null;
  const notes       = String(b.notes || "").trim().slice(0, 1000) || null;
  const items       = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return res.status(400).json({ error: "Agregar al menos un producto" });

  const ins = db.prepare(
    "INSERT INTO purchase_requests (supplier_id, notes, status, created_by) VALUES (?, ?, 'borrador', ?)"
  );
  const insItem = db.prepare(
    "INSERT INTO purchase_request_items (request_id, product_id, product_code, product_name, quantity, unit_price, pack_mode, comprimidos_per_unit)" +
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  let newId;
  db.transaction(() => {
    const info = ins.run(supplier_id, notes, req.session.userId || null);
    newId = info.lastInsertRowid;
    for (const it of items) {
      const pid   = Number(it.product_id) || null;
      const code  = String(it.product_code || "").trim();
      const name  = String(it.product_name || "").trim();
      const qty   = Math.max(1, Number(it.quantity) || 1);
      const price = Number(it.unit_price) || null;
      const pmode = ["unidad", "caja", "bulto", "comprimido"].includes(it.pack_mode) ? it.pack_mode : null;
      const cpu   = Number(it.comprimidos_per_unit) > 1 ? Math.floor(Number(it.comprimidos_per_unit)) : null;
      if (!name && !pid) continue;
      insItem.run(newId, pid, code, name, qty, price, pmode, cpu);
    }
  })();

  const created = db.prepare(
    "SELECT pr.*, s.name AS supplier_name FROM purchase_requests pr" +
    "  LEFT JOIN suppliers s ON s.id = pr.supplier_id WHERE pr.id = ?"
  ).get(newId);
  res.status(201).json({ ok: true, request: created });
});

app.get("/api/admin/purchase-requests/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(
    "SELECT pr.*, s.name AS supplier_name FROM purchase_requests pr" +
    "  LEFT JOIN suppliers s ON s.id = pr.supplier_id WHERE pr.id = ?"
  ).get(id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  const items = db.prepare(
    "SELECT * FROM purchase_request_items WHERE request_id = ? ORDER BY id"
  ).all(id);
  res.json(Object.assign({}, row, { items }));
});

app.patch("/api/admin/purchase-requests/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const b  = req.body || {};
  const row = db.prepare("SELECT id FROM purchase_requests WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  const allowed = ["status", "notes"];
  const sets = []; const params = [];
  for (const k of allowed) {
    if (k in b) { sets.push(k + " = ?"); params.push(b[k]); }
  }
  if (!sets.length) return res.status(400).json({ error: "Sin campos" });
  params.push(id);
  db.prepare("UPDATE purchase_requests SET " + sets.join(", ") + " WHERE id = ?").run(...params);
  res.json({ ok: true });
});

app.put("/api/admin/purchase-requests/:id", requireAdmin, (req, res) => {
  const id  = Number(req.params.id);
  const b   = req.body || {};
  const row = db.prepare("SELECT id FROM purchase_requests WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "No encontrado" });

  const supplier_id = Number(b.supplier_id) || null;
  const notes       = String(b.notes || "").trim().slice(0, 1000) || null;
  const status      = ["borrador","enviado"].includes(b.status) ? b.status : "borrador";
  const items       = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return res.status(400).json({ error: "Agregar al menos un producto" });

  const delItems = db.prepare("DELETE FROM purchase_request_items WHERE request_id = ?");
  const insItem  = db.prepare(
    "INSERT INTO purchase_request_items (request_id, product_id, product_code, product_name, quantity, unit_price, pack_mode, comprimidos_per_unit)" +
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  db.transaction(() => {
    db.prepare("UPDATE purchase_requests SET supplier_id=?, notes=?, status=? WHERE id=?").run(supplier_id, notes, status, id);
    delItems.run(id);
    for (const it of items) {
      const pid   = Number(it.product_id) || null;
      const code  = String(it.product_code || "").trim();
      const name  = String(it.product_name || "").trim();
      const qty   = Math.max(1, Number(it.quantity) || 1);
      const price = Number(it.unit_price) || null;
      const pmode = ["unidad", "caja", "bulto", "comprimido"].includes(it.pack_mode) ? it.pack_mode : null;
      const cpu   = Number(it.comprimidos_per_unit) > 1 ? Math.floor(Number(it.comprimidos_per_unit)) : null;
      if (!name && !pid) continue;
      insItem.run(id, pid, code, name, qty, price, pmode, cpu);
    }
  })();
  const updated = db.prepare(
    "SELECT pr.*, s.name AS supplier_name FROM purchase_requests pr" +
    "  LEFT JOIN suppliers s ON s.id = pr.supplier_id WHERE pr.id = ?"
  ).get(id);
  res.json({ ok: true, request: updated });
});

app.delete("/api/admin/purchase-requests/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM purchase_requests WHERE id = ?").run(id);
  if (!info.changes) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
});

// PDF de la cotización (pedido a proveedor, sin precios). Se arma desde el
// estado del editor (no requiere haber guardado la cotización).
app.post("/api/admin/cotizacion/pdf", requireAdmin, (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items.filter((it) => it && (it.product_name || it.product_code)) : [];
  if (!items.length) return res.status(400).json({ error: "Sin productos para exportar" });
  const appName = (db.prepare("SELECT value FROM settings WHERE key='app_name'").get() || {}).value || "Maxaria";
  const supplierName = String(b.supplier_name || "").trim();
  const notes = String(b.notes || "").trim().slice(0, 1000);
  const porBultos = !!b.porBultos;
  const date = new Date().toLocaleDateString("es-AR");
  const dateSlug = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "-");
  const safeSup = (supplierName || "Cotizacion").replace(/[^\w\s\-áéíóúüñÁÉÍÓÚÜÑ]/g, "").trim();
  res.setHeader("Content-Disposition", 'attachment; filename="Cotizacion ' + safeSup + " " + dateSlug + '.pdf"');
  buildCotizacionPdf(res, { appName, supplierName, date, porBultos, items, notes });
});

// ===== Pagos =====

app.get("/api/admin/payments", requireAdmin, (req, res) => {
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  let sql =
    "SELECT p.id, p.user_id, p.amount, p.method, p.reference, p.notes, p.created_at, p.caja_id, p.order_id," +
    "       u.username AS client_username, u.full_name AS client_full_name," +
    "       ca.name AS caja_name," +
    "       rb.username AS registered_by_username, rb.full_name AS registered_by_full_name" +
    "  FROM payments p" +
    "  JOIN users u ON u.id = p.user_id" +
    "  LEFT JOIN cash_accounts ca ON ca.id = p.caja_id" +
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
  const cajaId    = b.caja_id ? Number(b.caja_id) : null;
  const orderId   = b.order_id ? Number(b.order_id) : null;

  if (!user_id || !amount || amount <= 0)
    return res.status(400).json({ error: "Faltan datos: user_id y amount son requeridos" });

  const client = db.prepare("SELECT id, full_name, username FROM users WHERE id = ? AND active = 1").get(user_id);
  if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

  // Si el cobro es de un pedido puntual, validar que el pedido sea de ese cliente.
  let ordRow = null;
  if (orderId) {
    ordRow = db.prepare("SELECT id, total FROM orders WHERE id = ? AND user_id = ?").get(orderId, user_id);
    if (!ordRow) return res.status(400).json({ error: "El pedido no corresponde a ese cliente" });
  }

  // Descuento / comisión del pedido (ej. comisión del vendedor tercerizado).
  // Solo aplica si el cobro está imputado a un pedido. discount_value es el número
  // crudo (5 → 5% ; 5000 → $5000); discountAmount es en pesos, acotado entre 0 y
  // el total del pedido. Se calcula SIEMPRE sobre el total del pedido. Mismo
  // criterio que el endpoint de entrega (/api/orders/:id/deliver).
  let discountType = null, discountValue = 0, discountAmount = 0;
  if (orderId) {
    const dt = b.discount_type ? String(b.discount_type) : "";
    const dv = Math.max(0, Number(b.discount_value) || 0);
    if ((dt === "percent" || dt === "fixed") && dv > 0) {
      const ordTotal = Number(ordRow.total) || 0;
      discountType = dt;
      discountValue = dv;
      discountAmount = dt === "percent"
        ? Math.round(ordTotal * Math.min(dv, 100) / 100)
        : Math.round(dv);
      discountAmount = Math.max(0, Math.min(discountAmount, ordTotal));
    }
  }

  // Validar caja (si se imputa a una): debe existir y estar activa.
  let caja = null;
  if (cajaId) {
    caja = db.prepare("SELECT id, name FROM cash_accounts WHERE id = ? AND active = 1").get(cajaId);
    if (!caja) return res.status(400).json({ error: "Caja invalida o inactiva" });
  }

  let paymentId;
  db.transaction(() => {
    const r = db.prepare(
      "INSERT INTO payments (user_id, amount, method, reference, notes, caja_id, order_id, registered_by, created_at)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).run(user_id, amount, method, reference, notes, cajaId, orderId, req.session.userId);
    paymentId = r.lastInsertRowid;
    // El order_id en el movimiento es lo que hace que el pago baje el saldo del
    // pedido (y que el badge "Debe/Saldado" lo refleje). Si no se imputó a un
    // pedido, queda como cobro general a la cuenta corriente del cliente.
    const desc = (orderId ? "Cobro pedido #" + orderId + " · " : "Pago ") + method + (reference ? " · " + reference : "");
    db.prepare(
      "INSERT INTO account_movements (user_id, type, amount, description, order_id, payment_id, created_at)" +
      " VALUES (?, 'credit', ?, ?, ?, ?, datetime('now'))"
    ).run(user_id, amount, desc, orderId, paymentId);
    // Ingreso en la caja elegida (saldo corriente).
    if (caja) {
      db.prepare(
        "INSERT INTO cash_movements (account_id, type, amount, description, source, related_id, registered_by)" +
        " VALUES (?, 'ingreso', ?, ?, 'cobro', ?, ?)"
      ).run(caja.id, amount, "Cobro " + (client.full_name || client.username) + (reference ? " · " + reference : ""), paymentId, req.session.userId);
    }

    // Descuento del pedido como CRÉDITO en cuenta corriente (baja la deuda).
    // Solo si el cobro está imputado a un pedido. Se guarda en el pedido y se
    // registra/reemplaza el movimiento "Descuento pedido #N" (no se acumula con un
    // descuento previo de entrega: el último valor manda). Reversible al borrar.
    if (orderId && discountType) {
      db.prepare(
        "UPDATE orders SET discount_type = ?, discount_value = ?, discount_amount = ? WHERE id = ?"
      ).run(discountType, discountValue, discountAmount, orderId);
      db.prepare(
        "DELETE FROM account_movements WHERE order_id = ? AND type = 'credit' AND description LIKE 'Descuento pedido%'"
      ).run(orderId);
      if (discountAmount > 0) {
        const dlabel = discountType === "percent"
          ? (discountValue + "%")
          : ("$" + Math.round(discountValue).toLocaleString("es-AR"));
        db.prepare(
          "INSERT INTO account_movements (user_id, type, amount, description, order_id, payment_id, created_at)" +
          " VALUES (?, 'credit', ?, ?, ?, ?, datetime('now'))"
        ).run(user_id, discountAmount, "Descuento pedido #" + orderId + " (" + dlabel + ")", orderId, paymentId);
      }
    }
    // Egreso automático de la comisión del vendedor (la caja queda en lo tuyo).
    if (orderId) syncVendorCommissionEgreso(orderId, cajaId, req.session.userId);
  })();

  const payment = db.prepare(
    "SELECT p.*, u.username AS client_username, u.full_name AS client_full_name" +
    "  FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = ?"
  ).get(paymentId);
  res.json({
    ok: true, payment: payment,
    discount_type: discountType, discount_value: discountType ? discountValue : null,
    discount_amount: discountAmount,
  });
});

app.delete("/api/admin/payments/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const payment = db.prepare("SELECT id, order_id FROM payments WHERE id = ?").get(id);
  if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
  db.transaction(() => {
    // Si el descuento del pedido provino de este cobro (crédito "Descuento pedido"
    // con este payment_id), limpiar el descuento guardado en el pedido: al borrar
    // el cobro, el descuento deja de aplicar y no debe seguir bajando la deuda ni
    // figurando en la rentabilidad. El crédito en sí lo borra el DELETE de abajo
    // (tiene payment_id). Si el descuento vigente vino de una entrega (sin
    // payment_id), no se toca acá.
    if (payment.order_id) {
      const hadDiscount = db.prepare(
        "SELECT 1 FROM account_movements WHERE payment_id = ? AND type = 'credit'" +
        "   AND description LIKE 'Descuento pedido%' LIMIT 1"
      ).get(id);
      if (hadDiscount) {
        db.prepare(
          "UPDATE orders SET discount_type = NULL, discount_value = NULL, discount_amount = 0 WHERE id = ?"
        ).run(payment.order_id);
      }
    }
    db.prepare("DELETE FROM account_movements WHERE payment_id = ?").run(id);
    // Revertir el ingreso de caja generado por este cobro (si lo hubo).
    db.prepare("DELETE FROM cash_movements WHERE source = 'cobro' AND related_id = ?").run(id);
    db.prepare("DELETE FROM payments WHERE id = ?").run(id);
    // Recalcular la comisión del vendedor (bajó el cobrado → puede reducirse o borrarse).
    if (payment.order_id) syncVendorCommissionEgreso(payment.order_id, null, req.session.userId);
  })();
  res.json({ ok: true });
});

// ===== Cuentas corrientes =====

app.get("/api/admin/accounts", requireAdmin, (req, res) => {
  const users = db.prepare(
    "SELECT id, username, full_name, level, COALESCE(credit_limit,0) AS credit_limit FROM users" +
    "  WHERE level IN (1,2,3,4) AND active = 1"
  ).all();
  const movs = db.prepare(
    "SELECT user_id, type, amount, created_at FROM account_movements ORDER BY created_at ASC"
  ).all();
  // Parsear created_at (UTC "YYYY-MM-DD HH:MM:SS") y calcular dias transcurridos
  function daysSince(str) {
    if (!str) return null;
    var t = Date.parse(String(str).replace(" ", "T") + "Z");
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }
  var byUser = {};
  for (var i = 0; i < movs.length; i++) {
    var m = movs[i];
    (byUser[m.user_id] = byUser[m.user_id] || []).push(m);
  }
  var rows = users.map(function (u) {
    var list = byUser[u.id] || [];
    var totalDebit = 0, totalCredit = 0, lastAt = null, creditPool = 0;
    var openDebits = []; // {amount, at} en orden cronologico
    for (var j = 0; j < list.length; j++) {
      var mv = list[j];
      if (mv.type === "debit") { totalDebit += mv.amount; openDebits.push({ amount: mv.amount, at: mv.created_at }); }
      else { totalCredit += mv.amount; creditPool += mv.amount; }
      lastAt = mv.created_at;
    }
    // FIFO: aplicar creditos a los debitos mas viejos para hallar la deuda mas antigua sin saldar
    var pool = creditPool;
    for (var k = 0; k < openDebits.length && pool > 0; k++) {
      var pay = Math.min(pool, openDebits[k].amount);
      openDebits[k].amount -= pay; pool -= pay;
    }
    var balance = totalCredit - totalDebit; // negativo = debe
    var oldestUnpaidAt = null;
    for (var d = 0; d < openDebits.length; d++) {
      if (openDebits[d].amount > 0.0001) { oldestUnpaidAt = openDebits[d].at; break; }
    }
    var daysOverdue = (balance < -0.0001 && oldestUnpaidAt) ? daysSince(oldestUnpaidAt) : null;
    return {
      id: u.id, username: u.username, full_name: u.full_name, level: u.level,
      credit_limit: u.credit_limit || 0,
      total_credit: totalCredit, total_debit: totalDebit, balance: balance,
      last_movement_at: lastAt, days_since_movement: daysSince(lastAt),
      oldest_unpaid_at: oldestUnpaidAt, days_overdue: daysOverdue,
      movements_count: list.length,
    };
  });
  rows.sort(function (a, b) {
    var an = (a.full_name || a.username || "").toLowerCase();
    var bn = (b.full_name || b.username || "").toLowerCase();
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
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

// ===== Cuenta corriente de PROVEEDORES =====
// Deuda = SUM(debit) - SUM(credit). Positivo = le debemos al proveedor.

app.get("/api/admin/supplier-accounts", requireAdmin, (req, res) => {
  const suppliers = db.prepare(
    "SELECT id, name, phone FROM suppliers WHERE active = 1 ORDER BY name"
  ).all();
  const movs = db.prepare(
    "SELECT supplier_id, type, amount, created_at FROM supplier_movements ORDER BY created_at ASC"
  ).all();
  function daysSince(str) {
    if (!str) return null;
    var t = Date.parse(String(str).replace(" ", "T") + "Z");
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }
  var bySup = {};
  for (var i = 0; i < movs.length; i++) {
    var m = movs[i];
    (bySup[m.supplier_id] = bySup[m.supplier_id] || []).push(m);
  }
  var rows = suppliers.map(function (s) {
    var list = bySup[s.id] || [];
    var totalDebit = 0, totalCredit = 0, lastAt = null, creditPool = 0;
    var openDebits = [];
    for (var j = 0; j < list.length; j++) {
      var mv = list[j];
      if (mv.type === "debit") { totalDebit += mv.amount; openDebits.push({ amount: mv.amount, at: mv.created_at }); }
      else { totalCredit += mv.amount; creditPool += mv.amount; }
      lastAt = mv.created_at;
    }
    // FIFO: aplicar pagos a las compras más viejas para hallar la deuda más antigua
    var pool = creditPool;
    for (var k = 0; k < openDebits.length && pool > 0; k++) {
      var pay = Math.min(pool, openDebits[k].amount);
      openDebits[k].amount -= pay; pool -= pay;
    }
    var debt = totalDebit - totalCredit; // positivo = le debemos
    var oldestUnpaidAt = null;
    for (var d = 0; d < openDebits.length; d++) {
      if (openDebits[d].amount > 0.0001) { oldestUnpaidAt = openDebits[d].at; break; }
    }
    var daysOverdue = (debt > 0.0001 && oldestUnpaidAt) ? daysSince(oldestUnpaidAt) : null;
    return {
      id: s.id, name: s.name, phone: s.phone,
      total_debit: totalDebit, total_credit: totalCredit, balance: debt,
      last_movement_at: lastAt, days_since_movement: daysSince(lastAt),
      oldest_unpaid_at: oldestUnpaidAt, days_overdue: daysOverdue,
      movements_count: list.length,
    };
  });
  res.json(rows);
});

app.get("/api/admin/supplier-accounts/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const supplier = db.prepare("SELECT id, name, contact, phone, email FROM suppliers WHERE id = ?").get(id);
  if (!supplier) return res.status(404).json({ error: "Proveedor no encontrado" });
  const movements = db.prepare(
    "SELECT id, type, amount, description, purchase_order_id, supplier_payment_id, created_at" +
    "  FROM supplier_movements WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 200"
  ).all(id);
  const bal = db.prepare(
    "SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END),0) AS debt" +
    "  FROM supplier_movements WHERE supplier_id = ?"
  ).get(id);
  res.json({ supplier: supplier, movements: movements, balance: bal.debt });
});

app.get("/api/admin/supplier-payments", requireAdmin, (req, res) => {
  const supplierId = req.query.supplier_id ? Number(req.query.supplier_id) : null;
  let sql =
    "SELECT sp.id, sp.supplier_id, sp.amount, sp.method, sp.reference, sp.notes, sp.created_at, sp.caja_id," +
    "       s.name AS supplier_name, ca.name AS caja_name," +
    "       rb.username AS registered_by_username, rb.full_name AS registered_by_full_name" +
    "  FROM supplier_payments sp" +
    "  JOIN suppliers s ON s.id = sp.supplier_id" +
    "  LEFT JOIN cash_accounts ca ON ca.id = sp.caja_id" +
    "  LEFT JOIN users rb ON rb.id = sp.registered_by";
  const params = [];
  if (supplierId) { sql += "  WHERE sp.supplier_id = ?"; params.push(supplierId); }
  sql += "  ORDER BY sp.created_at DESC LIMIT 500";
  res.json(db.prepare(sql).all(...params));
});

app.post("/api/admin/supplier-payments", requireAdmin, (req, res) => {
  const b = req.body || {};
  const supplier_id = Number(b.supplier_id);
  const amount      = Number(b.amount);
  const method      = String(b.method || "efectivo").trim().slice(0, 50);
  const reference   = String(b.reference || "").trim().slice(0, 200) || null;
  const notes       = String(b.notes || "").trim().slice(0, 500) || null;
  const cajaId      = b.caja_id ? Number(b.caja_id) : null;

  if (!supplier_id || !amount || amount <= 0)
    return res.status(400).json({ error: "Faltan datos: supplier_id y amount son requeridos" });

  const supplier = db.prepare("SELECT id, name FROM suppliers WHERE id = ?").get(supplier_id);
  if (!supplier) return res.status(404).json({ error: "Proveedor no encontrado" });

  let caja = null;
  if (cajaId) {
    caja = db.prepare("SELECT id, name FROM cash_accounts WHERE id = ? AND active = 1").get(cajaId);
    if (!caja) return res.status(400).json({ error: "Caja invalida o inactiva" });
  }

  let paymentId;
  db.transaction(() => {
    const r = db.prepare(
      "INSERT INTO supplier_payments (supplier_id, amount, method, reference, notes, caja_id, registered_by, created_at)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).run(supplier_id, amount, method, reference, notes, cajaId, req.session.userId);
    paymentId = r.lastInsertRowid;
    const desc = "Pago " + method + (reference ? " · " + reference : "");
    db.prepare(
      "INSERT INTO supplier_movements (supplier_id, type, amount, description, supplier_payment_id, created_at)" +
      " VALUES (?, 'credit', ?, ?, ?, datetime('now'))"
    ).run(supplier_id, amount, desc, paymentId);
    // Egreso de la caja elegida (el pago al proveedor sale de la caja).
    if (caja) {
      db.prepare(
        "INSERT INTO cash_movements (account_id, type, amount, description, source, related_id, registered_by)" +
        " VALUES (?, 'egreso', ?, ?, 'pago_proveedor', ?, ?)"
      ).run(caja.id, amount, "Pago a " + supplier.name + (reference ? " · " + reference : ""), paymentId, req.session.userId);
    }
  })();

  const payment = db.prepare(
    "SELECT sp.*, s.name AS supplier_name FROM supplier_payments sp" +
    "  JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.id = ?"
  ).get(paymentId);
  res.json({ ok: true, payment: payment });
});

app.delete("/api/admin/supplier-payments/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const payment = db.prepare("SELECT id FROM supplier_payments WHERE id = ?").get(id);
  if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
  db.transaction(() => {
    db.prepare("DELETE FROM supplier_movements WHERE supplier_payment_id = ?").run(id);
    db.prepare("DELETE FROM cash_movements WHERE source = 'pago_proveedor' AND related_id = ?").run(id);
    db.prepare("DELETE FROM supplier_payments WHERE id = ?").run(id);
  })();
  res.json({ ok: true });
});

// ── Estado de cuenta PDF ────────────────────────────────────────────────────
// Genera un estado de cuenta imprimible/enviable para un cliente.
// Devuelve un PDF con el historial de movimientos y el saldo.
app.get("/api/admin/accounts/:userId/pdf", requireAdmin, (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: "ID invalido" });
  const user = db.prepare(
    "SELECT id, username, full_name, level, COALESCE(credit_limit,0) AS credit_limit FROM users WHERE id = ?"
  ).get(userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  // Movimientos en orden ASC (cronologico) para mostrar historial
  const movements = db.prepare(
    "SELECT am.id, am.type, am.amount, am.description, am.created_at" +
    "  FROM account_movements am" +
    "  WHERE am.user_id = ?" +
    "  ORDER BY am.created_at ASC"
  ).all(userId);

  const appName = (db.prepare("SELECT value FROM settings WHERE key='app_name'").get() || {}).value || "Maxaria";

  // Calcular totales
  var totalDebit = 0, totalCredit = 0;
  movements.forEach(function(m) {
    if (m.type === "debit") totalDebit += m.amount;
    else totalCredit += m.amount;
  });
  var balance = totalCredit - totalDebit; // negativo = debe

  function fmtArs(n) {
    return "$ " + Math.round(n).toLocaleString("es-AR");
  }
  function fmtDate(s) {
    if (!s) return "";
    return String(s).slice(0, 10).split("-").reverse().join("/");
  }
  const LEVEL_NAMES = { 1: "Minorista", 2: "Revendedor", 3: "Mayorista", 4: "VIP" };

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="cuenta_' + (user.username || user.id) + '_' + new Date().toISOString().slice(0,10) + '.pdf"');

  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
  doc.pipe(res);

  const BLU = "#1e3a5f", AMB = "#d97706", GRN = "#16a34a", RED = "#dc2626";
  const GREY = "#6b7280", LGR = "#f1f5f9", BLK = "#111111";
  const MX = 40, MY = 40, PW = 595, PH = 841;
  const CW = PW - MX * 2; // content width = 515

  // ── Encabezado azul ──
  doc.rect(0, 0, PW, 90).fill(BLU);
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#ffffff").text(appName, MX, MY, { width: CW / 2 });
  doc.font("Helvetica").fontSize(10).fillColor("#93c5fd").text("Estado de Cuenta Corriente", MX, MY + 26);
  doc.font("Helvetica").fontSize(9).fillColor("#93c5fd").text("Generado: " + fmtDate(new Date().toISOString()), MX, MY + 40);

  // Nombre del cliente (derecha)
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#ffffff")
     .text(user.full_name || user.username, MX, MY, { width: CW, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor("#93c5fd")
     .text("@" + user.username + "  ·  " + (LEVEL_NAMES[user.level] || "Cliente"), MX, MY + 18, { width: CW, align: "right" });

  let cy = 100;

  // ── Bloque de saldos ──
  const BOX_H = 56, BOX_W = (CW - 8) / 3;
  // Total Débitos (rojo)
  doc.rect(MX, cy, BOX_W, BOX_H).fill("#fef2f2");
  doc.font("Helvetica").fontSize(8).fillColor(RED).text("TOTAL DÉBITOS", MX + 10, cy + 10);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(RED).text(fmtArs(totalDebit), MX + 10, cy + 22, { width: BOX_W - 20 });
  // Total Créditos (verde)
  doc.rect(MX + BOX_W + 4, cy, BOX_W, BOX_H).fill("#f0fdf4");
  doc.font("Helvetica").fontSize(8).fillColor(GRN).text("TOTAL CRÉDITOS", MX + BOX_W + 14, cy + 10);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(GRN).text(fmtArs(totalCredit), MX + BOX_W + 14, cy + 22, { width: BOX_W - 20 });
  // Saldo (rojo si debe, azul si está al día)
  const balClr = balance < 0 ? RED : BLU;
  doc.rect(MX + (BOX_W + 4) * 2, cy, BOX_W, BOX_H).fill(balance < 0 ? "#fef2f2" : "#eff6ff");
  doc.font("Helvetica").fontSize(8).fillColor(balClr).text("SALDO ACTUAL", MX + (BOX_W + 4) * 2 + 10, cy + 10);
  const balLabel = balance < 0 ? "DEBE " + fmtArs(Math.abs(balance)) : "A FAVOR " + fmtArs(balance);
  doc.font("Helvetica-Bold").fontSize(balance < -99999 ? 12 : 15).fillColor(balClr)
     .text(balLabel, MX + (BOX_W + 4) * 2 + 10, cy + 22, { width: BOX_W - 20 });

  cy += BOX_H + 14;

  // ── Tabla de movimientos ──
  if (!movements.length) {
    doc.font("Helvetica").fontSize(11).fillColor(GREY).text("Sin movimientos registrados.", MX, cy + 20);
    doc.end();
    return;
  }

  const COL = { fecha: 72, tipo: 60, desc: CW - 72 - 60 - 80 - 80, deb: 80, cre: 80 };
  const CX = {
    fecha: MX,
    tipo: MX + COL.fecha,
    desc: MX + COL.fecha + COL.tipo,
    deb: MX + COL.fecha + COL.tipo + COL.desc,
    cre: MX + COL.fecha + COL.tipo + COL.desc + COL.deb,
  };

  // Header de la tabla
  function drawTableHeader(yy) {
    doc.rect(MX, yy, CW, 20).fill(BLU);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
    doc.text("FECHA",     CX.fecha, yy + 6, { width: COL.fecha });
    doc.text("TIPO",      CX.tipo,  yy + 6, { width: COL.tipo });
    doc.text("DESCRIPCIÓN", CX.desc, yy + 6, { width: COL.desc - 4 });
    doc.text("DÉBITO",    CX.deb,   yy + 6, { width: COL.deb,  align: "right" });
    doc.text("CRÉDITO",   CX.cre,   yy + 6, { width: COL.cre,  align: "right" });
    return yy + 20;
  }

  const ROW_H = 18;
  cy = drawTableHeader(cy);

  // Filas de movimientos + saldo acumulado
  var running = 0;
  movements.forEach(function(m, idx) {
    if (cy + ROW_H > PH - 60) {
      doc.addPage();
      cy = MY;
      // Header en paginas siguientes mas compacto
      doc.font("Helvetica").fontSize(8).fillColor(GREY)
         .text(appName + " — Estado de cuenta de " + (user.full_name || user.username) + " (continuacion)", MX, cy);
      cy += 14;
      cy = drawTableHeader(cy);
    }
    running += (m.type === "credit" ? m.amount : -m.amount);
    const isDebit = m.type === "debit";
    if (idx % 2 === 0) doc.rect(MX, cy, CW, ROW_H).fill(LGR);
    doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text(fmtDate(m.created_at), CX.fecha, cy + 5, { width: COL.fecha });
    const tipoLabel = isDebit ? "Débito" : "Crédito";
    const tipoClr = isDebit ? RED : GRN;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(tipoClr).text(tipoLabel, CX.tipo, cy + 5, { width: COL.tipo });
    doc.font("Helvetica").fontSize(8.5).fillColor(BLK)
       .text(String(m.description || "—"), CX.desc, cy + 5, { width: COL.desc - 4, ellipsis: true });
    if (isDebit) {
      doc.font("Helvetica").fontSize(8.5).fillColor(RED)
         .text(fmtArs(m.amount), CX.deb, cy + 5, { width: COL.deb, align: "right" });
      doc.text("—", CX.cre, cy + 5, { width: COL.cre, align: "right" });
    } else {
      doc.fillColor(GREY).text("—", CX.deb, cy + 5, { width: COL.deb, align: "right" });
      doc.font("Helvetica").fontSize(8.5).fillColor(GRN)
         .text(fmtArs(m.amount), CX.cre, cy + 5, { width: COL.cre, align: "right" });
    }
    cy += ROW_H;
  });

  // ── Línea y totales al pie ──
  cy += 4;
  doc.moveTo(MX, cy).lineTo(MX + CW, cy).lineWidth(1).strokeColor(BLU).stroke();
  cy += 6;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BLK)
     .text("TOTALES", MX, cy);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(RED)
     .text(fmtArs(totalDebit), CX.deb, cy, { width: COL.deb, align: "right" });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GRN)
     .text(fmtArs(totalCredit), CX.cre, cy, { width: COL.cre, align: "right" });
  cy += 14;

  // Saldo final prominente
  const saldoLabel = balance < 0
    ? "SALDO A PAGAR: " + fmtArs(Math.abs(balance))
    : balance === 0 ? "SALDO: CUENTA AL DÍA"
    : "SALDO A FAVOR: " + fmtArs(balance);
  doc.rect(MX, cy, CW, 28).fill(balance < 0 ? "#fef2f2" : "#f0fdf4");
  doc.font("Helvetica-Bold").fontSize(13).fillColor(balance < 0 ? RED : GRN)
     .text(saldoLabel, MX + 10, cy + 8, { width: CW - 20, align: "right" });

  // Pie de página
  cy += 40;
  doc.font("Helvetica").fontSize(7.5).fillColor(GREY)
     .text("Este documento fue generado automáticamente por " + appName + ". Los valores son informativos.", MX, cy, { width: CW, align: "center" });

  doc.end();
});

// ── Endpoint para tarea programada de deudores ─────────────────────────────
// Protegido con token (variable de entorno CRON_SECRET). No requiere sesion.
// Retorna la lista de clientes con deuda activa >= 30 dias (o el umbral
// que se pase como ?days=N). Uso: curl "URL/api/cron/debt-report?token=SECRET"
app.get("/api/cron/debt-report", (req, res) => {
  const CRON_SECRET = process.env.CRON_SECRET || "";
  const token = String(req.query.token || req.headers["x-cron-token"] || "");
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return res.status(401).json({ error: "Token invalido o no configurado" });
  }
  const minDays = Math.max(0, Number(req.query.days) || 30);

  // Reutiliza la misma logica que GET /api/admin/accounts
  const users = db.prepare(
    "SELECT id, username, full_name, COALESCE(credit_limit,0) AS credit_limit FROM users" +
    "  WHERE level IN (1,2,3,4) AND active = 1"
  ).all();
  const movs = db.prepare(
    "SELECT user_id, type, amount, created_at FROM account_movements ORDER BY created_at ASC"
  ).all();

  function daysSince(str) {
    if (!str) return null;
    var t = Date.parse(String(str).replace(" ", "T") + "Z");
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }

  var byUser = {};
  movs.forEach(function(m) { (byUser[m.user_id] = byUser[m.user_id] || []).push(m); });

  var deudores = [];
  users.forEach(function(u) {
    var list = byUser[u.id] || [];
    var totalDebit = 0, totalCredit = 0, creditPool = 0, openDebits = [];
    list.forEach(function(mv) {
      if (mv.type === "debit") { totalDebit += mv.amount; openDebits.push({ amount: mv.amount, at: mv.created_at }); }
      else { totalCredit += mv.amount; creditPool += mv.amount; }
    });
    var pool = creditPool;
    for (var k = 0; k < openDebits.length && pool > 0; k++) {
      var pay = Math.min(pool, openDebits[k].amount);
      openDebits[k].amount -= pay; pool -= pay;
    }
    var balance = totalCredit - totalDebit;
    if (balance >= -0.0001) return; // no debe nada
    var oldestAt = null;
    for (var d = 0; d < openDebits.length; d++) {
      if (openDebits[d].amount > 0.0001) { oldestAt = openDebits[d].at; break; }
    }
    var daysOverdue = oldestAt ? daysSince(oldestAt) : null;
    if (daysOverdue == null || daysOverdue < minDays) return;
    deudores.push({
      id: u.id, username: u.username, full_name: u.full_name,
      credit_limit: u.credit_limit,
      balance: Math.round(balance),
      days_overdue: daysOverdue,
      oldest_unpaid_at: oldestAt,
    });
  });

  deudores.sort(function(a, b) { return b.days_overdue - a.days_overdue; });
  const appName = (db.prepare("SELECT value FROM settings WHERE key='app_name'").get() || {}).value || "Maxaria";
  res.json({ ok: true, app: appName, min_days: minDays, count: deudores.length, deudores: deudores });
});

// ====================================================================
// ===== GASTOS (Expenses) - admin only ===============================
// ====================================================================

// ----- Categorias de gasto -----
app.get("/api/admin/expense-categories", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT ec.id, ec.name, ec.active, ec.sort_order, ec.created_at," +
    "       (SELECT COUNT(*) FROM expenses e WHERE e.expense_category_id = ec.id) AS usage_count" +
    "  FROM expense_categories ec" +
    "  ORDER BY ec.active DESC, ec.sort_order, ec.name"
  ).all();
  res.json(rows);
});

app.post("/api/admin/expense-categories", requireAdmin, (req, res) => {
  const name = String(req.body && req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });
  if (name.length > 60) return res.status(400).json({ error: "Maximo 60 caracteres" });
  const dup = db.prepare("SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?)").get(name);
  if (dup) return res.status(409).json({ error: "Ya existe una categoria con ese nombre" });
  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order),0) AS m FROM expense_categories").get();
  const info = db.prepare(
    "INSERT INTO expense_categories (name, sort_order) VALUES (?, ?)"
  ).run(name, (maxOrder.m || 0) + 1);
  const row = db.prepare("SELECT id, name, active, sort_order FROM expense_categories WHERE id = ?").get(info.lastInsertRowid);
  res.json(Object.assign({ usage_count: 0 }, row));
});

app.patch("/api/admin/expense-categories/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const cur = db.prepare("SELECT id FROM expense_categories WHERE id = ?").get(id);
  if (!cur) return res.status(404).json({ error: "Categoria no encontrada" });
  const body = req.body || {};
  const sets = [];
  const params = [];
  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n) return res.status(400).json({ error: "Nombre vacio" });
    if (n.length > 60) return res.status(400).json({ error: "Maximo 60 caracteres" });
    const dup = db.prepare("SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?) AND id != ?").get(n, id);
    if (dup) return res.status(409).json({ error: "Ya existe una categoria con ese nombre" });
    sets.push("name = ?"); params.push(n);
  }
  if (body.active !== undefined) {
    sets.push("active = ?"); params.push(body.active ? 1 : 0);
  }
  if (body.sort_order !== undefined) {
    sets.push("sort_order = ?"); params.push(Number(body.sort_order) || 0);
  }
  if (!sets.length) return res.json({ ok: true });
  params.push(id);
  const stmt = db.prepare("UPDATE expense_categories SET " + sets.join(", ") + " WHERE id = ?");
  stmt.run.apply(stmt, params);
  res.json({ ok: true, id });
});

app.delete("/api/admin/expense-categories/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const used = db.prepare("SELECT COUNT(*) AS n FROM expenses WHERE expense_category_id = ?").get(id);
  if (used && used.n > 0) {
    return res.status(409).json({
      error: "No se puede borrar: hay " + used.n + " gasto(s) con esta categoria. Desactivala en su lugar."
    });
  }
  db.prepare("DELETE FROM expense_categories WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ----- Gastos -----
// GET con filtros opcionales: from, to (YYYY-MM-DD), category_id, q (busqueda)
app.get("/api/admin/expenses", requireAdmin, (req, res) => {
  const conds = ["1=1"];
  const params = [];
  if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) {
    conds.push("e.expense_date >= ?"); params.push(req.query.from);
  }
  if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) {
    conds.push("e.expense_date <= ?"); params.push(req.query.to);
  }
  if (req.query.category_id) {
    const cid = Number(req.query.category_id);
    if (cid) { conds.push("e.expense_category_id = ?"); params.push(cid); }
  }
  if (req.query.q && typeof req.query.q === "string") {
    const q = "%" + req.query.q.trim() + "%";
    conds.push("(e.description LIKE ? OR e.reference LIKE ? OR e.notes LIKE ? OR e.category_name LIKE ?)");
    params.push(q, q, q, q);
  }
  const stmt = db.prepare(
    "SELECT e.id, e.expense_category_id, e.category_name, e.amount, e.description," +
    "       e.payment_method, e.reference, e.notes, e.expense_date," +
    "       e.registered_by, u.username AS registered_by_username," +
    "       e.caja_id, ca.name AS caja_name," +
    "       e.created_at" +
    "  FROM expenses e" +
    "  LEFT JOIN users u ON u.id = e.registered_by" +
    "  LEFT JOIN cash_accounts ca ON ca.id = e.caja_id" +
    " WHERE " + conds.join(" AND ") +
    " ORDER BY e.expense_date DESC, e.id DESC LIMIT 500"
  );
  const rows = stmt.all.apply(stmt, params);
  // Sumario adicional: total y suma por categoria del filtro aplicado
  const sumStmt = db.prepare(
    "SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count" +
    "  FROM expenses e WHERE " + conds.join(" AND ")
  );
  const summary = sumStmt.get.apply(sumStmt, params);
  const byCatStmt = db.prepare(
    "SELECT e.category_name, e.expense_category_id," +
    "       COUNT(*) AS count, SUM(e.amount) AS total" +
    "  FROM expenses e WHERE " + conds.join(" AND ") +
    " GROUP BY e.expense_category_id, e.category_name" +
    " ORDER BY total DESC"
  );
  const byCategory = byCatStmt.all.apply(byCatStmt, params);
  res.json({ rows: rows, total: summary.total, count: summary.count, by_category: byCategory });
});

app.post("/api/admin/expenses", requireAdmin, (req, res) => {
  const b = req.body || {};
  const amount = Number(b.amount);
  if (!isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "El monto debe ser mayor a 0" });
  }
  const catId = b.expense_category_id ? Number(b.expense_category_id) : null;
  let categoryName = String(b.category_name || "").trim();
  if (catId) {
    const cat = db.prepare("SELECT id, name FROM expense_categories WHERE id = ?").get(catId);
    if (!cat) return res.status(400).json({ error: "Categoria invalida" });
    categoryName = cat.name;
  }
  if (!categoryName) categoryName = "Otros";
  const date = String(b.expense_date || "").trim();
  const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const method = String(b.payment_method || "efectivo").trim();
  const description = String(b.description || "").trim();
  const reference = String(b.reference || "").trim() || null;
  const notes = String(b.notes || "").trim() || null;
  // El gasto SIEMPRE sale de una caja: se exige caja_id valida y activa,
  // y se registra el egreso en cash_movements (source 'gasto').
  const cajaId = b.caja_id ? Number(b.caja_id) : null;
  if (!cajaId) return res.status(400).json({ error: "Elegí la caja de la que sale el gasto" });
  const caja = db.prepare("SELECT id, name FROM cash_accounts WHERE id = ? AND active = 1").get(cajaId);
  if (!caja) return res.status(400).json({ error: "Caja invalida o inactiva" });
  let newId;
  db.transaction(() => {
    const info = db.prepare(
      "INSERT INTO expenses (expense_category_id, category_name, amount, description," +
      "  payment_method, reference, notes, expense_date, caja_id, registered_by)" +
      "  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(catId, categoryName, amount, description || null, method, reference, notes, expenseDate, caja.id, req.session.userId || null);
    newId = info.lastInsertRowid;
    db.prepare(
      "INSERT INTO cash_movements (account_id, type, amount, description, source, related_id, movement_date, registered_by)" +
      " VALUES (?, 'egreso', ?, ?, 'gasto', ?, ?, ?)"
    ).run(caja.id, amount, "Gasto: " + categoryName + (description ? " · " + description : ""), newId, expenseDate, req.session.userId || null);
  })();
  const row = db.prepare(
    "SELECT e.id, e.expense_category_id, e.category_name, e.amount, e.description," +
    "       e.payment_method, e.reference, e.notes, e.expense_date, e.created_at," +
    "       e.caja_id, ca.name AS caja_name" +
    "  FROM expenses e LEFT JOIN cash_accounts ca ON ca.id = e.caja_id" +
    " WHERE e.id = ?"
  ).get(newId);
  res.json(row);
});

app.patch("/api/admin/expenses/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const cur = db.prepare("SELECT id FROM expenses WHERE id = ?").get(id);
  if (!cur) return res.status(404).json({ error: "Gasto no encontrado" });
  const b = req.body || {};
  const sets = [];
  const params = [];
  if (b.amount !== undefined) {
    const a = Number(b.amount);
    if (!isFinite(a) || a <= 0) return res.status(400).json({ error: "Monto invalido" });
    sets.push("amount = ?"); params.push(a);
  }
  if (b.expense_category_id !== undefined) {
    const cid = b.expense_category_id ? Number(b.expense_category_id) : null;
    if (cid) {
      const cat = db.prepare("SELECT id, name FROM expense_categories WHERE id = ?").get(cid);
      if (!cat) return res.status(400).json({ error: "Categoria invalida" });
      sets.push("expense_category_id = ?"); params.push(cid);
      sets.push("category_name = ?"); params.push(cat.name);
    } else {
      sets.push("expense_category_id = ?"); params.push(null);
      if (b.category_name !== undefined) {
        sets.push("category_name = ?"); params.push(String(b.category_name || "Otros").trim() || "Otros");
      }
    }
  }
  if (b.expense_date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(b.expense_date))) {
    sets.push("expense_date = ?"); params.push(b.expense_date);
  }
  if (b.payment_method !== undefined) {
    sets.push("payment_method = ?"); params.push(String(b.payment_method || "efectivo").trim());
  }
  if (b.description !== undefined) {
    sets.push("description = ?"); params.push(String(b.description || "").trim() || null);
  }
  if (b.reference !== undefined) {
    sets.push("reference = ?"); params.push(String(b.reference || "").trim() || null);
  }
  if (b.notes !== undefined) {
    sets.push("notes = ?"); params.push(String(b.notes || "").trim() || null);
  }
  if (b.caja_id !== undefined) {
    const cid = b.caja_id ? Number(b.caja_id) : null;
    if (!cid) return res.status(400).json({ error: "Elegí la caja de la que sale el gasto" });
    const caja = db.prepare("SELECT id FROM cash_accounts WHERE id = ? AND active = 1").get(cid);
    if (!caja) return res.status(400).json({ error: "Caja invalida o inactiva" });
    sets.push("caja_id = ?"); params.push(cid);
  }
  if (!sets.length) return res.json({ ok: true });
  params.push(id);
  db.transaction(() => {
    const stmt = db.prepare("UPDATE expenses SET " + sets.join(", ") + " WHERE id = ?");
    stmt.run.apply(stmt, params);
    // Re-sincronizar el movimiento de caja: se borra el egreso vinculado y se
    // recrea desde el gasto ya actualizado (cubre cambios de monto, caja,
    // fecha y categoria de una sola vez). Gastos historicos sin caja_id no
    // generan movimiento.
    const e = db.prepare(
      "SELECT id, caja_id, amount, category_name, description, expense_date, registered_by FROM expenses WHERE id = ?"
    ).get(id);
    db.prepare("DELETE FROM cash_movements WHERE source = 'gasto' AND related_id = ?").run(id);
    if (e && e.caja_id) {
      db.prepare(
        "INSERT INTO cash_movements (account_id, type, amount, description, source, related_id, movement_date, registered_by)" +
        " VALUES (?, 'egreso', ?, ?, 'gasto', ?, ?, ?)"
      ).run(e.caja_id, e.amount, "Gasto: " + e.category_name + (e.description ? " · " + e.description : ""), e.id, e.expense_date, e.registered_by || null);
    }
  })();
  res.json({ ok: true, id });
});

app.delete("/api/admin/expenses/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  let changes = 0;
  db.transaction(() => {
    db.prepare("DELETE FROM cash_movements WHERE source = 'gasto' AND related_id = ?").run(id);
    changes = db.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes;
  })();
  if (changes === 0) return res.status(404).json({ error: "Gasto no encontrado" });
  res.json({ ok: true });
});

// ====== Generador de catálogo en PDF ======
// Carga una imagen de producto y la convierte a PNG via sharp
// (soporta JPEG, PNG, WebP, AVIF, GIF, etc. — todo lo que pdfkit no acepta nativamente).
// Devuelve un Buffer PNG o null si no se puede cargar/convertir.
async function loadProductImage(imageUrl) {
  if (!imageUrl) return null;
  try {
    const clean = imageUrl.split("?")[0];
    let rawBuf;
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(clean, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) return null;
      rawBuf = Buffer.from(await resp.arrayBuffer());
    } else {
      // Solo servimos archivos dentro de PRODUCT_IMAGES_DIR. Decodificamos
      // ANTES de tomar el nombre base: si se hace al reves, un "..%2F"
      // codificado sobrevive al split y escapa del directorio (path traversal).
      const fname = path.basename(decodeURIComponent(clean));
      const fpath = path.resolve(PRODUCT_IMAGES_DIR, fname);
      if (!fpath.startsWith(path.resolve(PRODUCT_IMAGES_DIR) + path.sep)) return null;
      if (!fs.existsSync(fpath)) return null;
      rawBuf = fs.readFileSync(fpath);
    }
    // Convertir a PNG para que pdfkit lo acepte siempre, sin importar el formato original
    const sharp = require("sharp");
    return await sharp(rawBuf).png().toBuffer();
  } catch (_) {
    return null;
  }
}

// Ejecuta un array de funciones async con concurrencia máxima N
async function pLimit(fns, concurrency) {
  const results = new Array(fns.length);
  let idx = 0;
  async function worker() {
    while (idx < fns.length) {
      const i = idx++;
      results[i] = await fns[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, fns.length) }, worker));
  return results;
}

// ── Helper: genera PDF de remito/presupuesto con pdfkit ──────────────────
function buildRemitoPdf(res, { title, docLabel, docNum, date, metaCells, items, total, totalUnidades, notes, extraLine }) {
  const doc = new PDFDocument({ size: "A4", margin: 36, autoFirstPage: true });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  const BLU = "#1e3a5f", GREY = "#6b7280", BLACK = "#111111", AMB = "#d97706";
  const MX = 36, MW = 595 - 72; // márgenes

  // ── Header ──
  doc.font("Helvetica-Bold").fontSize(17).fillColor(BLU).text(title, MX, 36, { continued: false });
  doc.font("Helvetica").fontSize(9).fillColor(GREY).text("Estado: " + docLabel, MX, 58);
  const rnW = doc.widthOfString("N° " + docNum);
  doc.font("Helvetica").fontSize(9).fillColor(GREY).text("REMITO DE PEDIDO", MX, 36, { align: "right" });
  doc.font("Helvetica-Bold").fontSize(20).fillColor(BLU).text("N° " + docNum, MX, 48, { align: "right" });

  // ── Línea azul superior ──
  let cy = 72;
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(2).strokeColor(BLU).stroke();

  // ── Meta row ──
  cy += 6;
  const cellW = MW / metaCells.length;
  metaCells.forEach((cell, i) => {
    const cx = MX + i * cellW;
    doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(cell.label.toUpperCase(), cx, cy);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK).text(cell.value, cx, cy + 9, { width: cellW - 4, ellipsis: true });
    if (i < metaCells.length - 1) {
      doc.moveTo(cx + cellW - 2, cy).lineTo(cx + cellW - 2, cy + 22).lineWidth(0.5).strokeColor("#d1d5db").stroke();
    }
  });

  // ── Línea azul bajo meta ──
  cy += 26;
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(1).strokeColor("#d1d5db").stroke();
  cy += 6;

  // ── Encabezado tabla ──
  // Si algún item tiene descuento por línea, se agregan dos columnas extra:
  // "Desc." (el % descontado) y "Precio" (el precio unitario ya con el
  // descuento aplicado — solo se completa en las filas que tienen descuento).
  const anyDisc = items.some((it) => (Number(it.discount_percent) || 0) > 0);
  const COL = anyDisc
    ? { cod: 42, cant: 40, price: 62, disc: 44, precio: 62, sub: 76 }
    : { cod: 50, cant: 52, price: 90, disc: 0, precio: 0, sub: 90 };
  COL.prod = MW - COL.cod - COL.cant - COL.price - COL.disc - COL.precio - COL.sub;
  const colX = { cod: MX };
  colX.prod = colX.cod + COL.cod;
  colX.cant = colX.prod + COL.prod;
  colX.price = colX.cant + COL.cant;
  colX.disc = colX.price + COL.price;
  colX.precio = colX.disc + COL.disc;
  colX.sub = colX.precio + COL.precio;
  doc.rect(MX, cy, MW, 20).fill(BLU);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  doc.text("CÓD.", colX.cod, cy + 6);
  doc.text("PRODUCTO", colX.prod, cy + 6);
  doc.text("CANT.", colX.cant, cy + 6, { width: COL.cant, align: "center" });
  doc.text("P. UNIT.", colX.price, cy + 6, { width: COL.price, align: "right" });
  if (anyDisc) {
    doc.text("DESC.", colX.disc, cy + 6, { width: COL.disc, align: "right" });
    doc.text("PRECIO", colX.precio, cy + 6, { width: COL.precio, align: "right" });
  }
  doc.text("SUBTOTAL", colX.sub, cy + 6, { width: COL.sub, align: "right" });
  cy += 20;

  // ── Filas de items ──
  const ROW_H = 18;
  const vSep = anyDisc ? [colX.prod, colX.cant, colX.price, colX.disc, colX.precio, colX.sub] : [colX.prod, colX.cant, colX.price, colX.sub];
  items.forEach((it, idx) => {
    if (cy + ROW_H > 800) { doc.addPage(); cy = 36; }
    if (idx % 2 === 1) doc.rect(MX, cy, MW, ROW_H).fill("#f8fafc");
    const disc = Number(it.discount_percent) || 0;
    const unitPrice = Number(it.unit_price) || 0;
    doc.font("Helvetica").fontSize(9).fillColor(GREY).text(String(it.product_code || ""), colX.cod, cy + 5, { width: COL.cod });
    doc.fillColor(BLACK).font("Helvetica-Bold").text(String(it.product_name || ""), colX.prod, cy + 5, { width: COL.prod - 4, ellipsis: true });
    doc.font("Helvetica-Bold").fillColor(BLACK).text(String(it.quantity), colX.cant, cy + 5, { width: COL.cant, align: "center" });
    doc.font("Helvetica").fillColor(GREY).text("$" + unitPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.price, cy + 5, { width: COL.price, align: "right" });
    if (anyDisc) {
      doc.font("Helvetica-Bold").fillColor(disc > 0 ? "#b45309" : "#9ca3af")
        .text(disc > 0 ? "-" + (Math.round(disc * 100) / 100) + "%" : "—", colX.disc, cy + 5, { width: COL.disc, align: "right" });
      const precioConDesc = round2(unitPrice * (1 - disc / 100));
      doc.font("Helvetica").fillColor(disc > 0 ? BLACK : "#9ca3af")
        .text(disc > 0 ? "$" + precioConDesc.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—", colX.precio, cy + 5, { width: COL.precio, align: "right" });
    }
    doc.font("Helvetica-Bold").fillColor(BLACK).text("$" + Number(it.subtotal != null ? it.subtotal : (it.unit_price * it.quantity)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.sub, cy + 5, { width: COL.sub, align: "right" });
    // separadores verticales azules
    vSep.forEach((x) => {
      doc.moveTo(x - 1, cy).lineTo(x - 1, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
    });
    // separador horizontal azul (marca el renglón)
    doc.moveTo(MX, cy + ROW_H).lineTo(MX + MW, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
    cy += ROW_H;
  });

  // ── Línea azul cierre ──
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(2).strokeColor(BLU).stroke();
  cy += 8;

  // ── Summary ──
  doc.font("Helvetica").fontSize(9).fillColor(GREY)
    .text(items.length + " ítems · " + totalUnidades + " unidades", MX, cy);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(BLU)
    .text("TOTAL: $" + total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), MX, cy - 2, { align: "right" });
  cy += 20;

  if (extraLine) {
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(GREY).text(extraLine, MX, cy);
    cy += 14;
  }
  if (notes) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY).text(notes, MX, cy);
  }

  doc.end();
}

// ── Helper: genera PDF de un pedido de cotización (sin precios) ───────────
// Mismo lenguaje visual que buildRemitoPdf pero pensado como pedido a un
// proveedor: columnas N° · CÓD · PRODUCTO · CANTIDAD (en unidades o bultos).
function buildCotizacionPdf(res, { appName, supplierName, date, porBultos, items, notes }) {
  const doc = new PDFDocument({ size: "A4", margin: 36, autoFirstPage: true });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  const BLU = "#1e3a5f", GREY = "#6b7280", BLACK = "#111111";
  const MX = 36, MW = 595 - 72;

  // ── Header ──
  doc.font("Helvetica-Bold").fontSize(17).fillColor(BLU).text(appName, MX, 36);
  doc.font("Helvetica").fontSize(9).fillColor(GREY)
    .text(porBultos ? "Cantidades por empaque (caja/bulto)" : "Cantidades por unidad", MX, 58);
  doc.font("Helvetica").fontSize(9).fillColor(GREY).text("PEDIDO DE COTIZACIÓN", MX, 36, { align: "right" });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(BLU).text(date, MX, 48, { align: "right" });

  // ── Línea azul superior ──
  let cy = 72;
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(2).strokeColor(BLU).stroke();

  // ── Meta row (solo Fecha; el proveedor no se imprime: la misma cotización
  //    suele pedirse a varios proveedores) ──
  cy += 6;
  const metaCells = [
    { label: "Fecha", value: date },
  ];
  const cellW = MW / metaCells.length;
  metaCells.forEach((cell, i) => {
    const cx = MX + i * cellW;
    doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(cell.label.toUpperCase(), cx, cy);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK).text(cell.value, cx, cy + 9, { width: cellW - 4, ellipsis: true });
    if (i < metaCells.length - 1) {
      doc.moveTo(cx + cellW - 2, cy).lineTo(cx + cellW - 2, cy + 22).lineWidth(0.5).strokeColor("#d1d5db").stroke();
    }
  });

  // ── Línea bajo meta ──
  cy += 26;
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(1).strokeColor("#d1d5db").stroke();
  cy += 6;

  // ── Encabezado tabla (sin columna Código: es interno) ──
  const COL = { num: 26, cant: 170 };
  COL.prod = MW - COL.num - COL.cant;
  const colX = {
    num: MX,
    prod: MX + COL.num,
    cant: MX + COL.num + COL.prod,
  };
  doc.rect(MX, cy, MW, 20).fill(BLU);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  doc.text("N°", colX.num, cy + 6, { width: COL.num - 4 });
  doc.text("PRODUCTO", colX.prod, cy + 6);
  doc.text("CANTIDAD", colX.cant, cy + 6, { width: COL.cant, align: "right" });
  cy += 20;

  // ── Filas ──
  const ROW_H = 20;
  items.forEach((it, idx) => {
    if (cy + ROW_H > 800) { doc.addPage(); cy = 36; }
    if (idx % 2 === 1) doc.rect(MX, cy, MW, ROW_H).fill("#f8fafc");
    let qty;
    const upb = Number(it.units_per_bulto) || 1;
    const q = Number(it.quantity) || 0;
    const pack = it.pack_unit || "bulto";
    // Mostrar SOLO lo que se cargó, sin aclaraciones ni equivalencias.
    if (pack === "comprimido") {
      const cpt = Math.max(1, Number(it.comprimidos_per_unit) || 1);
      qty = Math.round(q * cpt) + " comp";
    } else if (porBultos && pack !== "unidad" && upb > 1) {
      const b = Math.ceil(q / upb);
      const sing = pack === "caja" ? "caja" : "bulto";
      const plur = pack === "caja" ? "cajas" : "bultos";
      qty = b + " " + (b === 1 ? sing : plur);
    } else {
      qty = q + " und";
    }
    doc.font("Helvetica").fontSize(9).fillColor(GREY).text(String(idx + 1), colX.num, cy + 6, { width: COL.num - 4 });
    doc.fillColor(BLACK).font("Helvetica-Bold").text(String(it.product_name || ""), colX.prod, cy + 6, { width: COL.prod - 6, ellipsis: true });
    doc.font("Helvetica-Bold").fillColor(BLACK).text(qty, colX.cant, cy + 6, { width: COL.cant, align: "right" });
    [colX.prod, colX.cant].forEach((x) => {
      doc.moveTo(x - 1, cy).lineTo(x - 1, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
    });
    // separador horizontal azul (marca el renglón)
    doc.moveTo(MX, cy + ROW_H).lineTo(MX + MW, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
    cy += ROW_H;
  });

  // ── Línea azul cierre ──
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(2).strokeColor(BLU).stroke();
  cy += 8;

  // ── Pie ──
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BLU)
    .text("Total: " + items.length + " producto" + (items.length !== 1 ? "s" : ""), MX, cy);
  cy += 18;
  if (notes) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY).text(notes, MX, cy, { width: MW });
  }

  doc.end();
}

// Genera PDF del remito de un pedido — GET /api/admin/orders/:id/pdf
app.get("/api/admin/orders/:id/pdf", requireVendedorOrAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const order = db.prepare(
    "SELECT o.*, u.full_name, u.username, v.full_name AS vendedor_full_name, v.username AS vendedor_username " +
    "FROM orders o LEFT JOIN users u ON u.id=o.user_id LEFT JOIN users v ON v.id=o.assigned_vendedor_id WHERE o.id=?"
  ).get(id);
  if (!order) return res.status(404).json({ error: "No encontrado" });
  const items = db.prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY id").all(id);
  const appName = (db.prepare("SELECT value FROM settings WHERE key='app_name'").get() || {}).value || "Maxaria";
  const clientName = order.full_name || order.username || "Consumidor final";
  const vendText = order.vendedor_full_name || order.vendedor_username || "";
  const date = new Date(order.created_at || Date.now()).toLocaleDateString("es-AR");
  const STATUS_LABELS = { pendiente: "Pendiente", enviado: "Enviado", preparando: "En armado", listo: "Listo para entregar", entregado: "Entregado", cancelado: "Cancelado" };
  const total = items.reduce((s, it) => s + Number(it.subtotal != null ? it.subtotal : (it.unit_price * it.quantity)), 0);
  const totalUnidades = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const safeClient = clientName.replace(/[^\w\s\-áéíóúüñÁÉÍÓÚÜÑ]/g, "").trim();
  const dateSlug = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "-");
  res.setHeader("Content-Disposition", 'attachment; filename="' + safeClient + " " + dateSlug + '.pdf"');
  const metaCells = [
    { label: "Fecha", value: date },
    { label: "Cliente", value: clientName },
    ...(vendText ? [{ label: "Vendedor", value: vendText }] : []),
  ];
  const extraLine = order.budget_number ? "Facturado desde presupuesto " + order.budget_number : "";
  buildRemitoPdf(res, {
    title: appName, docLabel: STATUS_LABELS[order.status] || order.status,
    docNum: String(id), date, metaCells, items, total, totalUnidades,
    notes: order.notes || "", extraLine,
  });
});

// Genera PDF del presupuesto — GET /api/budgets/:id/pdf
app.get("/api/budgets/:id/pdf", requireVendedorOrAdmin, requireSectionForAdmin("ventas"), (req, res) => {
  const u = { id: req.session.userId, level: req.session.level };
  const budget = db.prepare("SELECT * FROM budgets WHERE id=?").get(req.params.id);
  if (!budget) return res.status(404).json({ error: "No encontrado" });
  if (!canAccessBudget(u, budget)) return res.status(403).json({ error: "Sin permiso" });
  const items = db.prepare("SELECT * FROM budget_items WHERE budget_id=? ORDER BY id").all(budget.id);
  const appName = (db.prepare("SELECT value FROM settings WHERE key='app_name'").get() || {}).value || "Maxaria";
  const clientName = budget.client_name || "Consumidor final";
  const date = new Date(budget.created_at || Date.now()).toLocaleDateString("es-AR");
  const STATUS_LABELS = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", cancelado: "Cancelado", facturado: "Facturado" };
  const total = Number(budget.total) || 0;
  const totalUnidades = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const safeClient = clientName.replace(/[^\w\s\-áéíóúüñÁÉÍÓÚÜÑ]/g, "").trim();
  const dateSlug = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "-");
  res.setHeader("Content-Disposition", 'attachment; filename="' + safeClient + " " + dateSlug + '.pdf"');
  const metaCells = [
    { label: "Fecha", value: date },
    { label: "Cliente", value: clientName },
    { label: "Forma de pago", value: budget.payment_method || "Efectivo" },
  ];
  buildRemitoPdf(res, {
    title: appName, docLabel: STATUS_LABELS[budget.status] || budget.status,
    docNum: budget.number || String(budget.id), date, metaCells, items, total, totalUnidades,
    notes: budget.notes || "", extraLine: "",
  });
});

app.post("/api/admin/catalog/pdf", requireAdmin, async (req, res) => {
  const body = req.body || {};
  const pConf = body.priceConfig || {};
  const categoryIds = (Array.isArray(body.categoryIds) && body.categoryIds.length > 0)
    ? body.categoryIds.map(Number) : [];
  const targetUserId = Number(body.targetUserId) || 0;
  const includePriceChanges = !!body.includePriceChanges;
  const withImages = body.withImages !== false; // default true

  // Config de precios
  const lvlMap = {
    minorista: "price_minorista", revendedor: "price_revendedor",
    mayorista: "price_mayorista", vip: "price_vip", publico: "price_publico",
  };
  let priceCol = "price_minorista", priceLabel = "Minorista", markup = null;
  let chgBaseLevel = "minorista"; // base_level usado para la sección de cambios
  const lvlNames = { 1: "minorista", 2: "revendedor", 3: "mayorista", 4: "vip" };
  if (pConf.type === "client" && pConf.userId) {
    // El catálogo se arma con la config de precios efectiva del cliente
    // (su lista personalizada si tiene, o su nivel base).
    const cu = db.prepare(
      "SELECT id, full_name, username, level FROM users WHERE id = ? AND level BETWEEN 1 AND 4"
    ).get(Number(pConf.userId));
    if (!cu) return res.status(400).json({ error: "Cliente no encontrado" });
    const cfg = getEffectivePriceConfig(cu.id, cu.level);
    priceCol = cfg.column;
    const cname = cu.full_name || cu.username || ("Cliente #" + cu.id);
    if (cfg.kind === "list") {
      markup = Number(cfg.markup_percent) || 0;
      const liCfg = resolvePriceListConfig(cfg.listId);
      priceLabel = cname + " (" + ((liCfg && liCfg.name) || "lista") + ")";
      chgBaseLevel = (liCfg && liCfg.base_level) || "minorista"; // nivel RAIZ de la cadena
    } else {
      const lk = lvlNames[cu.level] || "minorista";
      priceLabel = cname + " (" + lk.charAt(0).toUpperCase() + lk.slice(1) + ")";
      chgBaseLevel = lk;
    }
  } else if (pConf.type === "list" && pConf.listId) {
    const lst = db.prepare("SELECT * FROM price_lists WHERE id = ? AND active = 1").get(Number(pConf.listId));
    if (!lst) return res.status(400).json({ error: "Lista de precios no encontrada o inactiva" });
    const lstCfg = resolvePriceListConfig(lst); // resuelve cadena si se basa en otra lista
    priceCol = lstCfg.column;
    markup = lstCfg.markup_percent;
    priceLabel = lst.name;
    chgBaseLevel = lstCfg.base_level || "minorista";
  } else {
    priceCol = lvlMap[pConf.level] || "price_minorista";
    const lk = pConf.level || "minorista";
    priceLabel = lk.charAt(0).toUpperCase() + lk.slice(1);
    chgBaseLevel = lk;
  }

  // WA destino
  let targetWa = "", targetName = "";
  if (targetUserId) {
    const tu = db.prepare("SELECT full_name, username, whatsapp_number FROM users WHERE id = ?").get(targetUserId);
    if (tu) {
      targetWa = (tu.whatsapp_number || "").replace(/\D/g, "");
      targetName = tu.full_name || tu.username || "";
    }
  }

  // Productos en stock agrupados por categoría
  const catCond = categoryIds.length
    ? " AND c.id IN (" + categoryIds.map(() => "?").join(",") + ")" : "";
  const rows = db.prepare(
    "SELECT p.id, p.code, p.name AS pname, p.description, p.image_url," +
    "       p." + priceCol + " AS base_price," +
    "       c.id AS cat_id, c.name AS cat_name" +
    "  FROM products p JOIN categories c ON c.id = p.category_id" +
    "  WHERE p.stock > 0 AND p.active = 1" + catCond +
    "  ORDER BY c.sort_order, c.name, p.name"
  ).all(...categoryIds);

  const byCategory = [];
  const catMap = new Map();
  for (const r of rows) {
    let price = Number(r.base_price) || 0;
    if (markup !== null) {
      const d = 1 - markup / 100;
      if (d > 0) price = round2(price / d);
    }
    if (!catMap.has(r.cat_id)) {
      catMap.set(r.cat_id, byCategory.length);
      byCategory.push({ name: r.cat_name, products: [] });
    }
    byCategory[catMap.get(r.cat_id)].products.push(Object.assign({}, r, { price }));
  }

  const appRow = db.prepare("SELECT value FROM settings WHERE key = 'app_name'").get();
  const appName = (appRow && appRow.value) || "Catálogo";

  // Pre-descargar imágenes con concurrencia limitada (evita rate-limiting del CDN)
  const imgCache = new Map();
  if (withImages) {
    const uniqueUrls = [...new Set(rows.filter((r) => r.image_url).map((r) => r.image_url))];
    await pLimit(
      uniqueUrls.map((url) => async () => {
        imgCache.set(url, await loadProductImage(url));
      }),
      15  // máximo 15 descargas simultáneas
    );
  }

  // Generar PDF
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition",
    "attachment; filename=\"catalogo-" + new Date().toISOString().slice(0, 10) + ".pdf\"");
  res.setHeader("Access-Control-Expose-Headers", "X-Whatsapp,X-Whatsapp-Name");
  if (targetWa)   res.setHeader("X-Whatsapp", targetWa);
  if (targetName) res.setHeader("X-Whatsapp-Name", Buffer.from(targetName).toString("base64"));
  doc.pipe(res);

  // Layout constantes
  const PW = 595.28, PH = 841.89;
  const MX = 30, MY = 44, MB = 36;
  const UW = PW - MX * 2;
  const CGAP = 10;
  const CW = (UW - CGAP) / 2;   // ancho columna
  const CH = withImages ? 100 : 30, CGAPV = withImages ? 6 : 2;
  const ISIZ = 80;               // tamaño imagen (solo cuando withImages=true)
  const CPAD = 8;

  const CBLU = "#1e3a5f", CAMT = "#d97706", CGRY = "#6b7280", CDRK = "#111827";

  let cy = MY, col = 0;
  const colX = (c) => MX + c * (CW + CGAP);
  function flushCol() { if (col === 1) { col = 0; cy += CH + CGAPV; } }
  function chkPage(h) { if (cy + h > PH - MB) { doc.addPage(); cy = MY; col = 0; } }
  function fmtP(n) { return "$" + (Number(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  const hoy = new Date().toLocaleDateString("es-AR",
    { day: "2-digit", month: "long", year: "numeric" });

  // ── Sección de cambios de precio (páginas iniciales) ──────────────────────
  if (includePriceChanges) {
    // Determinar columnas de old/new según el nivel base del catálogo.
    // price_changes guarda old_/new_ para minorista/revendedor/mayorista/vip;
    // publico y costo no tienen columnas propias → caen a minorista.
    const chgKey = ["revendedor", "mayorista", "vip"].includes(chgBaseLevel) ? chgBaseLevel : "minorista";
    const oldCol = "old_" + chgKey, newCol = "new_" + chgKey;

    const lastUpdate = db.prepare(
      "SELECT pu.id, pu.created_at, pu.products_changed, pu.products_new, pu.products_reingreso" +
      "  FROM price_updates pu ORDER BY pu.id DESC LIMIT 1"
    ).get();

    if (lastUpdate) {
      const chgRows = db.prepare(
        "SELECT pc.code, pc.name," +
        "       COALESCE(pc.is_new, 0) AS is_new," +
        "       COALESCE(pc.is_reingreso, 0) AS is_reingreso," +
        "       pc." + oldCol + " AS old_price, pc." + newCol + " AS new_price," +
        "       pc.new_minorista," +
        "       COALESCE(c.name,'Sin categoría') AS cat_name," +
        "       COALESCE(c.sort_order, 999) AS cat_sort" +
        "  FROM price_changes pc" +
        "  LEFT JOIN products pr ON pr.id = pc.product_id" +
        "  LEFT JOIN categories c ON c.id = pr.category_id" +
        "  WHERE pc.update_id = ?" +
        "  ORDER BY cat_sort, cat_name, pc.name"
      ).all(lastUpdate.id);

      if (chgRows.length) {
        // Aplicar markup si corresponde (lista personalizada)
        function applyMkp(v, fallback) {
          // Si la columna pedida es NULL, usar minorista como fallback
          const base = (v !== null && v !== undefined) ? Number(v) : Number(fallback || 0);
          if (markup === null) return base;
          const d = 1 - markup / 100;
          return d > 0 ? Math.round(base / d) : base;
        }

        // Agrupar por categoría
        const chgByCat = [];
        const chgCatMap = new Map();
        for (const r of chgRows) {
          if (!chgCatMap.has(r.cat_name)) {
            chgCatMap.set(r.cat_name, chgByCat.length);
            chgByCat.push({ name: r.cat_name, items: [] });
          }
          chgByCat[chgCatMap.get(r.cat_name)].items.push(r);
        }

        // Encabezado de la sección de cambios
        doc.font("Helvetica-Bold").fontSize(18).fillColor(CBLU)
           .text("Cambios de Precio", MX, cy, { width: UW, align: "center" });
        cy += 26;
        const chgDate = new Date(lastUpdate.created_at.replace(" ", "T") + "Z")
          .toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
        doc.font("Helvetica").fontSize(9).fillColor(CGRY)
           .text(
             chgRows.length + " productos   ·   Actualización del " + chgDate +
             "   ·   Precios: " + priceLabel,
             MX, cy, { width: UW, align: "center" }
           );
        cy += 16;
        doc.moveTo(MX, cy).lineTo(MX + UW, cy).strokeColor("#d1d5db").lineWidth(0.5).stroke();
        cy += 12;

        // Layout de items: una fila por producto, ancho completo
        // Columnas: Código | Nombre + Descripción | Precio anterior | Precio nuevo | % cambio
        const IRH = 36;    // row height
        const IRGAP = 1;   // gap entre filas (casi ninguno, aspecto de tabla)

        // Posiciones X absolutas de cada columna
        const IC_CODE  = MX + 8;           // código
        const IC_CW    = 42;               // ancho código
        const IC_NAME  = MX + 58;          // nombre + descripción
        const IC_NW    = 220;              // ancho nombre
        const IC_OLD   = MX + 58 + 220 + 10; // precio anterior (right-aligned dentro de 75pt)
        const IC_OLDW  = 75;
        const IC_NEW   = IC_OLD + IC_OLDW + 6; // precio nuevo
        const IC_NEWW  = 85;
        const IC_PCT   = IC_NEW + IC_NEWW + 6; // porcentaje
        const IC_PCTW  = UW - (IC_PCT - MX) - 8;

        function iChkPage() {
          if (cy + IRH > PH - MB) { doc.addPage(); cy = MY; }
        }

        for (const cat of chgByCat) {
          iChkPage();
          // Header categoría full-width con headers de columna en blanco
          doc.rect(MX, cy, UW, 22).fill(CBLU);
          // Nombre de la categoría (acotado para no pisar los headers de columna)
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff")
             .text(cat.name.toUpperCase(), MX + 10, cy + 6,
               { width: IC_OLD - MX - 14, lineBreak: false, ellipsis: true });
          // Headers de columna en blanco, alineados con las columnas de cada fila
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff")
             .text("Precio viejo", IC_OLD, cy + 7,
               { width: IC_OLDW, align: "right", lineBreak: false });
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff")
             .text("Precio nuevo", IC_NEW, cy + 7,
               { width: IC_NEWW, align: "right", lineBreak: false });
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff")
             .text("% cambio", IC_PCT, cy + 7,
               { width: IC_PCTW, align: "right", lineBreak: false });
          cy += 22 + 3;

          cat.items.forEach((item, idx) => {
            iChkPage();
            const ry = cy;

            // Fila con fondo alternado
            const isNew = item.is_new || item.is_reingreso;
            const rowFill = isNew ? "#fffbeb" : (idx % 2 === 0 ? "#ffffff" : "#f8fafc");
            doc.rect(MX, ry, UW, IRH).fillColor(rowFill).fill();
            // Línea separadora inferior
            doc.moveTo(MX, ry + IRH).lineTo(MX + UW, ry + IRH)
               .strokeColor("#e5e7eb").lineWidth(0.4).stroke();

            const oldP = applyMkp(item.old_price, item.new_minorista);
            const newP = applyMkp(item.new_price, item.new_minorista);
            const diff = newP - oldP;
            const diffColor = diff > 0 ? "#dc2626" : diff < 0 ? "#059669" : CGRY;

            // ── Código (centrado verticalmente) ──
            doc.font("Helvetica").fontSize(7.5).fillColor(CGRY)
               .text((item.code || "—"), IC_CODE, ry + 14, { width: IC_CW, lineBreak: false });

            // ── Nombre + Descripción ──
            const nm3 = (item.name || "");
            doc.font("Helvetica-Bold").fontSize(9).fillColor(CDRK)
               .text(nm3, IC_NAME, ry + 5, { width: IC_NW, lineBreak: true, height: 13 });

            if (item.description) {
              const ds3 = item.description.length > 60 ? item.description.slice(0, 58) + "…" : item.description;
              doc.font("Helvetica").fontSize(7).fillColor(CGRY)
                 .text(ds3, IC_NAME, ry + 19, { width: IC_NW, lineBreak: false });
            }

            // Badge nuevo/reingreso (en lugar de descripción)
            if (item.is_new) {
              doc.rect(IC_NAME, ry + 19, 30, 9).fill("#2563eb");
              doc.font("Helvetica-Bold").fontSize(6).fillColor("#fff")
                 .text("NUEVO", IC_NAME + 2, ry + 21, { lineBreak: false });
            } else if (item.is_reingreso) {
              doc.rect(IC_NAME, ry + 19, 42, 9).fill("#7c3aed");
              doc.font("Helvetica-Bold").fontSize(6).fillColor("#fff")
                 .text("REINGRESO", IC_NAME + 2, ry + 21, { lineBreak: false });
            }

            // ── Precio anterior ──
            if (oldP && !item.is_new && !item.is_reingreso) {
              doc.font("Helvetica").fontSize(8).fillColor(CGRY)
                 .text(fmtP(oldP), IC_OLD, ry + 13, { width: IC_OLDW, align: "right", lineBreak: false });
            }

            // ── Precio nuevo ──
            const priceColor = (item.is_new || item.is_reingreso) ? CAMT : diffColor;
            doc.font("Helvetica-Bold").fontSize(11).fillColor(priceColor)
               .text(fmtP(newP), IC_NEW, ry + 11, { width: IC_NEWW, align: "right", lineBreak: false });

            // ── % de cambio ──
            if (!item.is_new && !item.is_reingreso && oldP) {
              const pct = ((diff / oldP) * 100);
              const pctStr = (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
              doc.font("Helvetica-Bold").fontSize(9).fillColor(diffColor)
                 .text(pctStr, IC_PCT, ry + 13, { width: IC_PCTW, align: "right", lineBreak: false });
            } else if (item.is_new) {
              doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#2563eb")
                 .text("NUEVO", IC_PCT, ry + 14, { width: IC_PCTW, align: "right", lineBreak: false });
            } else if (item.is_reingreso) {
              doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#7c3aed")
                 .text("REINGR.", IC_PCT, ry + 14, { width: IC_PCTW, align: "right", lineBreak: false });
            }

            cy += IRH + IRGAP;
          });

          cy += 6; // espacio extra entre categorías
        }

        // Salto de página antes del catálogo
        doc.addPage();
        cy = MY;
        col = 0;
      }
    }
  }

  // Encabezado primera página del catálogo
  doc.font("Helvetica-Bold").fontSize(22).fillColor(CBLU)
     .text(appName, MX, cy, { width: UW, align: "center" });
  cy += 30;
  doc.font("Helvetica").fontSize(9).fillColor(CGRY)
     .text("Precios: " + priceLabel + "   ·   " + hoy + "   ·   Solo productos en stock",
       MX, cy, { width: UW, align: "center" });
  cy += 18;
  doc.moveTo(MX, cy).lineTo(MX + UW, cy).strokeColor("#d1d5db").lineWidth(0.5).stroke();
  cy += 14;

  // Categorías y productos
  for (const cat of byCategory) {
    flushCol();
    chkPage(32 + CH);

    // Header categoría
    doc.rect(MX, cy, UW, 26).fill(CBLU);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff")
       .text(cat.name.toUpperCase(), MX + 10, cy + 7, { width: UW - 20, lineBreak: false });
    cy += 26 + 8;

    let pIdx = 0;
    for (const p of cat.products) {
      if (col === 0) {
        chkPage(CH);
        // Divisor azul vertical entre las dos columnas, a la altura de esta fila
        const dvX = MX + CW + CGAP / 2;
        doc.moveTo(dvX, cy).lineTo(dvX, cy + CH)
           .strokeColor(CBLU).lineWidth(1).stroke();
      }
      const cx = colX(col);
      const cardY = cy;

      if (withImages) {
        // ── Tarjeta con imagen ──────────────────────────────────────────────
        doc.rect(cx, cardY, CW, CH).fillAndStroke("#fafafa", "#e5e7eb");
        doc.lineWidth(0.5);

        const ix = cx + CPAD, iy = cardY + (CH - ISIZ) / 2;
        const imgBuf = p.image_url ? imgCache.get(p.image_url) : null;
        if (imgBuf) {
          try {
            doc.image(imgBuf, ix, iy, { fit: [ISIZ, ISIZ], align: "center", valign: "center" });
          } catch (_) {
            doc.rect(ix, iy, ISIZ, ISIZ).fillColor("#e5e7eb").fill();
          }
        } else {
          doc.rect(ix, iy, ISIZ, ISIZ).fillColor("#e5e7eb").fill();
        }

        const tx = cx + CPAD + ISIZ + 7;
        const tw = CW - CPAD - ISIZ - 7 - CPAD;

        const nm = (p.pname || "").length > 46 ? (p.pname || "").slice(0, 44) + "…" : (p.pname || "");
        doc.font("Helvetica-Bold").fontSize(10).fillColor(CDRK)
           .text(nm, tx, cardY + 8, { width: tw, lineBreak: true, height: 24 });
        doc.font("Helvetica").fontSize(7.5).fillColor(CGRY)
           .text("Cód: " + (p.code || "—"), tx, cardY + 33, { width: tw, lineBreak: false });
        if (p.description) {
          const ds = p.description.length > 68 ? p.description.slice(0, 66) + "…" : p.description;
          doc.font("Helvetica").fontSize(7.5).fillColor(CGRY)
             .text(ds, tx, cardY + 45, { width: tw, lineBreak: true, height: 18 });
        }
        doc.font("Helvetica-Bold").fontSize(15).fillColor(CAMT)
           .text(fmtP(p.price), tx, cardY + CH - 23, { width: tw, lineBreak: false });

      } else {
        // ── Fila compacta sin imagen ────────────────────────────────────────
        const rowFill = Math.floor(pIdx / 2) % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(cx, cardY, CW, CH).fillColor(rowFill).fill();
        doc.moveTo(cx, cardY + CH).lineTo(cx + CW, cardY + CH)
           .strokeColor("#e5e7eb").lineWidth(0.4).stroke();

        const LP = cx + CPAD;
        const codeW = 36, priceW = 68;
        const nameW = CW - CPAD * 2 - codeW - priceW - 10;
        const rowMid = cardY + 10;

        doc.font("Helvetica").fontSize(7).fillColor(CGRY)
           .text(p.code || "—", LP, rowMid, { width: codeW, lineBreak: false });

        const nm2 = (p.pname || "").length > 55 ? (p.pname || "").slice(0, 53) + "…" : (p.pname || "");
        doc.font("Helvetica-Bold").fontSize(9).fillColor(CDRK)
           .text(nm2, LP + codeW + 5, rowMid, { width: nameW, lineBreak: false });

        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(CAMT)
           .text(fmtP(p.price), cx + CW - CPAD - priceW, rowMid,
             { width: priceW, align: "right", lineBreak: false });
      }

      pIdx++;
      col++;
      if (col === 2) { col = 0; cy += CH + CGAPV; }
    }
  }
  flushCol();

  // Pie de página (solo última página)
  const totalProds = byCategory.reduce((s, c) => s + c.products.length, 0);
  doc.font("Helvetica").fontSize(8).fillColor(CGRY)
     .text(totalProds + " productos · Generado " + hoy, MX, PH - 24, { width: UW, align: "center" });

  try { doc.end(); } catch (_) {}
});

// ─────────────────────────────────────────────────────────────────────────────
// Presupuestos / Ventas
// Accesibles para admin (99) y vendedores (5). Los vendedores solo ven sus
// propios presupuestos; el admin ve todos.
// ─────────────────────────────────────────────────────────────────────────────

// Helper: verifica que el usuario tenga permiso sobre un presupuesto
function canAccessBudget(user, budget) {
  if (Number(user.level) === 99) return true;
  return Number(budget.vendedor_id) === Number(user.id);
}

// GET /api/budgets — lista (filtrada por vendedor si level 5)
app.get("/api/budgets", requireVendedorOrAdmin, requireSectionForAdmin("ventas"), (req, res) => {
  const u = { id: req.session.userId, level: req.session.level };
  const isAdmin = Number(u.level) === 99;
  const rows = db.prepare(
    "SELECT b.id, b.number, b.client_name, b.payment_method, b.currency," +
    "       b.discount_percent, b.surcharge_percent, b.subtotal, b.total," +
    "       b.status, b.notes, b.order_id, b.created_at, b.updated_at," +
    "       v.full_name AS vendedor_name," +
    "       u.full_name AS client_full_name" +
    "  FROM budgets b" +
    "  LEFT JOIN users v ON v.id = b.vendedor_id" +
    "  LEFT JOIN users u ON u.id = b.client_id" +
    (isAdmin ? "" : "  WHERE b.vendedor_id = @uid") +
    "  ORDER BY b.id DESC"
  ).all(isAdmin ? {} : { uid: u.id });
  res.json(rows);
});

// GET /api/budgets/:id — detalle con items
app.get("/api/budgets/:id", requireVendedorOrAdmin, requireSectionForAdmin("ventas"), (req, res) => {
  const u = { id: req.session.userId, level: req.session.level };
  const budget = db.prepare(
    "SELECT b.*, v.full_name AS vendedor_name, cl.full_name AS client_full_name" +
    "  FROM budgets b" +
    "  LEFT JOIN users v ON v.id = b.vendedor_id" +
    "  LEFT JOIN users cl ON cl.id = b.client_id" +
    "  WHERE b.id = ?"
  ).get(req.params.id);
  if (!budget) return res.status(404).json({ error: "No encontrado" });
  if (!canAccessBudget(u, budget)) return res.status(403).json({ error: "Sin permiso" });
  const items = db.prepare(
    "SELECT bi.*, p.image_url FROM budget_items bi" +
    "  LEFT JOIN products p ON p.id = bi.product_id" +
    "  WHERE bi.budget_id = ? ORDER BY bi.id"
  ).all(budget.id);
  res.json({ ...budget, items });
});

// POST /api/budgets — crear presupuesto
app.post("/api/budgets", requireVendedorOrAdmin, requireSectionForAdmin("ventas"), (req, res) => {
  const u = { id: req.session.userId, level: req.session.level };
  const b = req.body || {};
  const vendedorId = Number(u.level) === 99 ? (b.vendedor_id || u.id) : u.id;
  const clientId = b.client_id ? Number(b.client_id) : null;
  const clientName = b.client_name || "Consumidor final";
  const payMethod = b.payment_method || "Efectivo";
  const currency = b.currency || "ARS";
  const discountPct = Number(b.discount_percent) || 0;
  const surchargePct = Number(b.surcharge_percent) || 0;
  const notes = b.notes || null;
  const priceBasis = b.price_basis || null;
  const items = Array.isArray(b.items) ? b.items : [];

  // Calcular totales
  let subtotal = 0;
  const computedItems = items.map((it) => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.unit_price) || 0;
    const disc = Number(it.discount_percent) || 0;
    const sub = round2(qty * price * (1 - disc / 100));
    subtotal += sub;
    return { ...it, quantity: qty, unit_price: price, discount_percent: disc, subtotal: sub };
  });
  subtotal = round2(subtotal);
  const afterDiscount = round2(subtotal * (1 - discountPct / 100));
  const total = round2(afterDiscount * (1 + surchargePct / 100));
  const number = nextBudgetNumber();

  const VALID_BUDGET_STATUSES = ["borrador", "enviado", "aceptado", "cancelado"];
  const initialStatus = VALID_BUDGET_STATUSES.includes(b.status) ? b.status : "borrador";
  const insertBudget = db.transaction(() => {
    const r = db.prepare(
      "INSERT INTO budgets (number, client_id, client_name, vendedor_id, payment_method, currency," +
      "  discount_percent, surcharge_percent, subtotal, total, notes, price_basis, status, stock_discounted)" +
      "  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)"
    ).run(number, clientId, clientName, vendedorId, payMethod, currency,
          discountPct, surchargePct, subtotal, total, notes, priceBasis, initialStatus);
    const bid = r.lastInsertRowid;
    const insItem = db.prepare(
      "INSERT INTO budget_items (budget_id, product_id, product_code, product_name, quantity, unit_price, discount_percent, subtotal)" +
      "  VALUES (?,?,?,?,?,?,?,?)"
    );
    // El stock puede quedar negativo (sobreventa / productos a reponer). Sin clamp
    // en 0 para todos los actores: así el descuento y la devolución al cancelar son
    // simétricos y el número refleja la realidad (ej: -3 si se vendieron 3 de más).
    const updStockBudget = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
    for (const it of computedItems) {
      insItem.run(bid, it.product_id || null, it.product_code || "", it.product_name || "",
                  it.quantity, it.unit_price, it.discount_percent, it.subtotal);
      // Descontar stock al crear el presupuesto
      if (it.product_id) {
        updStockBudget.run(it.quantity, it.product_id);
        logStockMovement(it.product_id, "presupuesto", -it.quantity, bid, "Presupuesto #" + bid + " creado", u.id);
      }
    }
    return bid;
  });

  try {
    const bid = insertBudget();
    res.json({ ok: true, id: bid, number });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/budgets/:id — actualizar presupuesto completo
app.put("/api/budgets/:id", requireVendedorOrAdmin, requireSectionForAdmin("ventas"), (req, res) => {
  const u = { id: req.session.userId, level: req.session.level };
  const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(req.params.id);
  if (!budget) return res.status(404).json({ error: "No encontrado" });
  if (!canAccessBudget(u, budget)) return res.status(403).json({ error: "Sin permiso" });

  // En estados finales los items ya no se editan (facturado: los items viven en
  // el pedido; cancelado: el stock ya fue devuelto y un edit lo desincronizaría).
  if (budget.status === "facturado" || budget.status === "cancelado") {
    return res.status(409).json({ error: "No se puede editar un presupuesto " + budget.status });
  }

  const b = req.body || {};
  const clientId = b.client_id ? Number(b.client_id) : null;
  const clientName = b.client_name || "Consumidor final";
  const payMethod = b.payment_method || "Efectivo";
  const currency = b.currency || "ARS";
  const discountPct = Number(b.discount_percent) || 0;
  const surchargePct = Number(b.surcharge_percent) || 0;
  const notes = b.notes || null;
  const priceBasis = b.price_basis || null;
  const items = Array.isArray(b.items) ? b.items : [];

  let subtotal = 0;
  const computedItems = items.map((it) => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.unit_price) || 0;
    const disc = Number(it.discount_percent) || 0;
    const sub = round2(qty * price * (1 - disc / 100));
    subtotal += sub;
    return { ...it, quantity: qty, unit_price: price, discount_percent: disc, subtotal: sub };
  });
  subtotal = round2(subtotal);
  const afterDiscount = round2(subtotal * (1 - discountPct / 100));
  const total = round2(afterDiscount * (1 + surchargePct / 100));

  const updateBudget = db.transaction(() => {
    // El presupuesto descuenta stock al crearse (stock_discounted=1). Al editar
    // items hay que ajustar por la diferencia: devolver el stock de los items
    // viejos y descontar el de los nuevos, igual que PUT /api/admin/orders/:id/items.
    // Sin esto, un producto agregado en una edición nunca descontaba stock.
    if (budget.stock_discounted) {
      const oldItems = db.prepare(
        "SELECT product_id, quantity FROM budget_items WHERE budget_id = ?"
      ).all(budget.id);
      const retStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
      for (const oi of oldItems) {
        if (oi.product_id) {
          retStock.run(oi.quantity, oi.product_id);
          logStockMovement(oi.product_id, "presupuesto", oi.quantity, budget.id, "Edicion de presupuesto #" + budget.id + " (revierte items anteriores)", u.id);
        }
      }
    }
    db.prepare(
      "UPDATE budgets SET client_id=?, client_name=?, payment_method=?, currency=?," +
      "  discount_percent=?, surcharge_percent=?, subtotal=?, total=?, notes=?, price_basis=?," +
      "  updated_at=datetime('now') WHERE id=?"
    ).run(clientId, clientName, payMethod, currency, discountPct, surchargePct,
          subtotal, total, notes, priceBasis, budget.id);
    db.prepare("DELETE FROM budget_items WHERE budget_id = ?").run(budget.id);
    const insItem = db.prepare(
      "INSERT INTO budget_items (budget_id, product_id, product_code, product_name, quantity, unit_price, discount_percent, subtotal)" +
      "  VALUES (?,?,?,?,?,?,?,?)"
    );
    // Mismo criterio que al crear: el stock puede quedar negativo (sin clamp en 0
    // para ningún actor), así el descuento es simétrico con la devolución.
    const decStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
    for (const it of computedItems) {
      insItem.run(budget.id, it.product_id || null, it.product_code || "", it.product_name || "",
                  it.quantity, it.unit_price, it.discount_percent, it.subtotal);
      if (budget.stock_discounted && it.product_id) {
        decStock.run(it.quantity, it.product_id);
        logStockMovement(it.product_id, "presupuesto", -it.quantity, budget.id, "Edicion de presupuesto #" + budget.id + " (nuevos items)", u.id);
      }
    }
  });

  try {
    updateBudget();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/budgets/:id/status — cambiar estado
app.patch("/api/budgets/:id/status", requireVendedorOrAdmin, requireSectionForAdmin("ventas"), (req, res) => {
  const u = { id: req.session.userId, level: req.session.level };
  const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(req.params.id);
  if (!budget) return res.status(404).json({ error: "No encontrado" });
  if (!canAccessBudget(u, budget)) return res.status(403).json({ error: "Sin permiso" });
  const VALID = ["borrador", "enviado", "aceptado", "cancelado"];
  const status = req.body.status;
  if (!VALID.includes(status)) return res.status(400).json({ error: "Estado invalido" });
  if (budget.status === "facturado") return res.status(409).json({ error: "El presupuesto ya esta facturado" });

  db.transaction(() => {
    if (status === "cancelado" && budget.status !== "cancelado") {
      // Al cancelar: devolver stock si fue descontado al crear
      if (budget.stock_discounted) {
        const budgetItems = db.prepare(
          "SELECT product_id, quantity FROM budget_items WHERE budget_id = ?"
        ).all(budget.id);
        const retStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
        for (const it of budgetItems) {
          if (it.product_id) {
            retStock.run(it.quantity, it.product_id);
            logStockMovement(it.product_id, "cancelacion", it.quantity, budget.id, "Presupuesto #" + budget.id + " cancelado", u.id);
          }
        }
        db.prepare("UPDATE budgets SET stock_discounted = 0 WHERE id = ?").run(budget.id);
      }
      // Sincronizar el pedido vinculado: si el presupuesto nació de un pedido
      // del catálogo, cancelar también ese pedido para que no siga figurando
      // como "por entregar" en la pestaña Pedidos. Solo si el pedido sigue
      // activo (no tocar entregados ni ya cancelados). El stock ya se devolvió
      // arriba desde el presupuesto, así que no se vuelve a tocar.
      if (budget.order_id) {
        db.prepare(
          "UPDATE orders SET status = 'cancelado', stock_discounted = 0" +
          " WHERE id = ? AND status IN ('pendiente','enviado','preparando')"
        ).run(budget.order_id);
      }
    }
    db.prepare("UPDATE budgets SET status=?, updated_at=datetime('now') WHERE id=?").run(status, budget.id);
  })();
  res.json({ ok: true });
});

// POST /api/budgets/:id/invoice — facturar el presupuesto:
// crea una order con sus items, le descuenta stock y (si hay cliente real,
// distinto de "consumidor final") genera el debito en cuenta corriente.
// Marca el presupuesto como 'facturado' y guarda order_id para trazabilidad.
app.post("/api/budgets/:id/invoice", requireVendedorOrAdmin, requireSectionForAdmin("ventas"), (req, res) => {
  const u = { id: req.session.userId, level: req.session.level };
  const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(req.params.id);
  if (!budget) return res.status(404).json({ error: "No encontrado" });
  if (!canAccessBudget(u, budget)) return res.status(403).json({ error: "Sin permiso" });
  if (budget.status !== "aceptado") {
    return res.status(409).json({ error: "Solo se pueden facturar presupuestos aceptados" });
  }
  if (budget.order_id) {
    return res.status(409).json({ error: "Este presupuesto ya fue facturado" });
  }
  const items = db.prepare(
    "SELECT product_id, product_code, product_name, quantity, unit_price, COALESCE(discount_percent,0) AS discount_percent, subtotal" +
    "  FROM budget_items WHERE budget_id = ?"
  ).all(budget.id);
  if (!items.length) return res.status(400).json({ error: "El presupuesto no tiene items" });

  // Si el presupuesto fue armado a nombre de un cliente real (con cuenta), la
  // venta debita su cuenta corriente. Si es "consumidor final" (client_id NULL)
  // se asume venta pagada en el acto: descuenta stock pero no toca cuentas.
  const userIdForOrder = budget.client_id || budget.vendedor_id || u.id;
  const debitAccount = !!budget.client_id;

  let orderId;
  try {
    db.transaction(() => {
      // El pedido entra al circuito en estado 'pendiente' (seccion Pedidos) y
      // recorre Armado -> Entregas -> Entregado como cualquier otro. El stock ya
      // se desconto al crear el presupuesto (stock_discounted=1) y la cuenta se
      // debita aca abajo, asi que al llegar a 'entregado' el PATCH no vuelve a
      // procesar (chequea !order.stock_discounted).
      const r = db.prepare(
        "INSERT INTO orders (user_id, status, total, notes, assigned_vendedor_id, stock_discounted, created_at)" +
        " VALUES (?, 'pendiente', ?, ?, ?, 1, datetime('now'))"
      ).run(
        userIdForOrder,
        budget.total,
        "Facturado desde presupuesto " + budget.number,
        budget.vendedor_id || null
      );
      orderId = r.lastInsertRowid;

      const insItem = db.prepare(
        "INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, discount_percent, subtotal)" +
        " VALUES (?,?,?,?,?,?,?,?)"
      );
      for (const it of items) {
        insItem.run(orderId, it.product_id || null, it.product_code, it.product_name,
                    it.quantity, it.unit_price, it.discount_percent || 0, it.subtotal);
        // Stock YA fue descontado al crear el presupuesto (stock_discounted=1).
        // No se vuelve a descontar aqui para evitar doble descuento.
      }

      if (debitAccount) {
        db.prepare(
          "INSERT INTO account_movements (user_id, type, amount, description, order_id, created_at)" +
          " VALUES (?, 'debit', ?, ?, ?, datetime('now'))"
        ).run(budget.client_id, budget.total, "Presupuesto " + budget.number, orderId);
      }

      db.prepare(
        "UPDATE budgets SET status='facturado', order_id=?, updated_at=datetime('now') WHERE id=?"
      ).run(orderId, budget.id);
    })();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  res.json({ ok: true, order_id: orderId, debited: debitAccount });
});

// DELETE /api/budgets/:id
app.delete("/api/budgets/:id", requireVendedorOrAdmin, requireSectionForAdmin("ventas"), (req, res) => {
  const u = { id: req.session.userId, level: req.session.level };
  const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(req.params.id);
  if (!budget) return res.status(404).json({ error: "No encontrado" });
  if (!canAccessBudget(u, budget)) return res.status(403).json({ error: "Sin permiso" });

  // El presupuesto descuenta stock al crearse (stock_discounted=1): al borrarlo
  // hay que devolverlo, igual que al cancelar. Excepcion: si esta vinculado a un
  // pedido con orders.stock_discounted=1 (facturado/entregado), el descuento ya
  // es del pedido y devolverlo dejaria la venta sin descontar. Si el pedido
  // vinculado tiene stock_discounted=0 (pedido del catalogo aun no entregado),
  // si se devuelve: al entregarse, el deliver re-descuenta porque ya no habra
  // budget con stock_discounted=1.
  let returnStock = !!budget.stock_discounted;
  if (returnStock && budget.order_id) {
    const linkedOrder = db.prepare(
      "SELECT stock_discounted FROM orders WHERE id = ?"
    ).get(budget.order_id);
    if (linkedOrder && linkedOrder.stock_discounted) returnStock = false;
  }

  try {
    db.transaction(() => {
      if (returnStock) {
        const budgetItems = db.prepare(
          "SELECT product_id, quantity FROM budget_items WHERE budget_id = ?"
        ).all(budget.id);
        const retStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
        for (const it of budgetItems) {
          if (it.product_id) {
            retStock.run(it.quantity, it.product_id);
            logStockMovement(it.product_id, "presupuesto_eliminado", it.quantity, budget.id, "Presupuesto #" + budget.id + " eliminado", u.id);
          }
        }
      }
      db.prepare("DELETE FROM budgets WHERE id = ?").run(budget.id);
    })();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  res.json({ ok: true });
});

// ===== REPORTE DE INFLACION (solo superadmin) =====
//
// Mide el impacto de cada aumento (o baja) de costo registrado en cost_changes:
//  - Revalorizacion del stock: stock_at_change * (costo nuevo - costo viejo).
//    Mercaderia que tenias comprada al costo viejo y ahora vale mas.
//  - Perdida por reposicion: unidades vendidas DESDE el cambio de costo
//    anterior (o la compra anterior, lo que sea mas reciente) hasta este
//    cambio * delta. Esa mercaderia se vendio con el costo viejo y reponerla
//    cuesta delta mas. Si no hay referencia previa, se devuelve null
//    ("sin ventana": primer cambio registrado del producto).
//  - Neto = revalorizacion - perdida.
// Con deltas negativos (baja de costo) los signos se invierten solos.
app.get("/api/admin/reports/inflation", requireAdmin, (req, res) => {
  const perms = getAdminPerms(req.session.userId);
  if (!perms.isSuperadmin) {
    return res.status(403).json({ error: "Solo el superadmin puede ver este reporte" });
  }

  const { from, to } = req.query;
  const where = [];
  const params = [];
  if (from) { where.push("date(cc.created_at) >= ?"); params.push(String(from)); }
  if (to)   { where.push("date(cc.created_at) <= ?"); params.push(String(to)); }
  const wStr = where.length ? " WHERE " + where.join(" AND ") : "";

  const rows = db.prepare(
    "SELECT cc.id, cc.product_id, cc.old_cost, cc.new_cost, cc.stock_at_change," +
    "       cc.source, cc.source_id, cc.created_at," +
    "       p.code, p.name, p.stock AS stock_now" +
    "  FROM cost_changes cc JOIN products p ON p.id = cc.product_id" +
    wStr + " ORDER BY cc.created_at DESC, cc.id DESC LIMIT 1000"
  ).all(...params);

  // Limite de la ventana de "ventas a costo viejo": el cambio de costo anterior
  // del mismo producto, o la compra anterior (excluyendo la compra que origino
  // ESTE cambio), lo que sea mas reciente.
  const prevChangeStmt = db.prepare(
    "SELECT created_at FROM cost_changes" +
    " WHERE product_id = ? AND (created_at < ? OR (created_at = ? AND id < ?))" +
    " ORDER BY created_at DESC, id DESC LIMIT 1"
  );
  const prevPurchaseStmt = db.prepare(
    "SELECT MAX(po.created_at) AS d" +
    "  FROM purchase_items pi JOIN purchase_orders po ON po.id = pi.purchase_order_id" +
    " WHERE pi.product_id = ? AND po.created_at < ?" +
    "   AND (? IS NULL OR po.id != ?)"
  );
  const soldStmt = db.prepare(
    "SELECT COALESCE(SUM(oi.quantity), 0) AS q" +
    "  FROM order_items oi JOIN orders o ON o.id = oi.order_id" +
    " WHERE oi.product_id = ? AND o.status != 'cancelado'" +
    "   AND COALESCE(o.is_unified, 0) = 0" +
    "   AND o.created_at > ? AND o.created_at <= ?"
  );

  const changes = rows.map((r) => {
    const delta = (Number(r.new_cost) || 0) - (Number(r.old_cost) || 0);
    const revalorizacion = Math.round((Number(r.stock_at_change) || 0) * delta);

    const ownPurchaseId = r.source === "compra" ? (r.source_id || null) : null;
    const pc = prevChangeStmt.get(r.product_id, r.created_at, r.created_at, r.id);
    const pp = prevPurchaseStmt.get(r.product_id, r.created_at, ownPurchaseId, ownPurchaseId);
    let windowFrom = null;
    if (pc && pc.created_at) windowFrom = pc.created_at;
    if (pp && pp.d && (!windowFrom || pp.d > windowFrom)) windowFrom = pp.d;

    let soldQty = null, perdida = null;
    if (windowFrom) {
      soldQty = Number(soldStmt.get(r.product_id, windowFrom, r.created_at).q) || 0;
      perdida = Math.round(soldQty * delta);
    }

    return {
      id: r.id,
      product_id: r.product_id,
      code: r.code,
      name: r.name,
      source: r.source,
      created_at: r.created_at,
      old_cost: Number(r.old_cost) || 0,
      new_cost: Number(r.new_cost) || 0,
      delta: delta,
      delta_pct: (Number(r.old_cost) || 0) > 0 ? (delta / Number(r.old_cost)) * 100 : null,
      stock_at_change: Number(r.stock_at_change) || 0,
      stock_now: Number(r.stock_now) || 0,
      revalorizacion: revalorizacion,
      window_from: windowFrom,
      sold_qty: soldQty,
      perdida: perdida,
      neto: revalorizacion - (perdida || 0),
    };
  });

  const totals = {
    changes_count: changes.length,
    products_count: new Set(changes.map((c) => c.product_id)).size,
    revalorizacion: changes.reduce((a, c) => a + c.revalorizacion, 0),
    perdida: changes.reduce((a, c) => a + (c.perdida || 0), 0),
    sin_ventana: changes.filter((c) => c.window_from == null).length,
  };
  totals.neto = totals.revalorizacion - totals.perdida;

  // Contexto: valor actual del stock a costo de reposicion.
  const stockValue = db.prepare(
    "SELECT COALESCE(SUM(stock * COALESCE(cost, 0)), 0) AS v" +
    "  FROM products WHERE active = 1 AND stock > 0"
  ).get();

  res.json({
    from: from || null,
    to: to || null,
    totals: totals,
    stock_value_now: Math.round(Number(stockValue.v) || 0),
    changes: changes,
  });
});

// DELETE /api/admin/reports/inflation/:id — borra un registro de cambio de costo
// (solo superadmin). Sirve para limpiar cargas erroneas que distorsionan el
// reporte (ej: se cargo el costo de una caja como costo unitario). Solo afecta
// al historial de inflacion; no toca el costo actual del producto ni el stock.
app.delete("/api/admin/reports/inflation/:id", requireAdmin, (req, res) => {
  const perms = getAdminPerms(req.session.userId);
  if (!perms.isSuperadmin) {
    return res.status(403).json({ error: "Solo el superadmin puede borrar registros de inflacion" });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id invalido" });
  const row = db.prepare("SELECT id FROM cost_changes WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Registro no encontrado" });
  db.prepare("DELETE FROM cost_changes WHERE id = ?").run(id);
  res.json({ ok: true, deleted: id });
});

// ===== REPORTES DE VENTAS =====

// GET /api/admin/reports/sales — pedidos con KPIs del período
// Params: from, to, client_id, vendedor_id, status (default: todos menos cancelado)
app.get("/api/admin/reports/sales", requireAdmin, (req, res) => {
  const { from, to, client_id, vendedor_id, status } = req.query;
  const where = ["COALESCE(o.is_unified,0) = 0"];
  const params = [];

  if (from)        { where.push("date(o.created_at) >= ?"); params.push(from); }
  if (to)          { where.push("date(o.created_at) <= ?"); params.push(to); }
  if (client_id)   { where.push("o.user_id = ?");           params.push(Number(client_id)); }
  if (vendedor_id) { where.push("(o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)"); params.push(Number(vendedor_id), Number(vendedor_id)); }
  if (status === "entregado") {
    where.push("o.status = 'entregado'");
  } else if (status === "activo") {
    where.push("o.status NOT IN ('cancelado','entregado')");
  } else {
    where.push("o.status != 'cancelado'");
  }

  const wStr = " WHERE " + where.join(" AND ");

  // KPIs del período
  const kpis = db.prepare(
    "SELECT COUNT(DISTINCT o.id) AS total_orders," +
    "       SUM(CASE WHEN o.status='entregado' THEN 1 ELSE 0 END) AS entregados," +
    "       COALESCE(SUM(o.total),0) AS ventas_brutas," +
    "       COALESCE(SUM(CASE WHEN o.status='entregado' THEN o.total ELSE 0 END),0) AS ventas_entregadas," +
    "       COALESCE(SUM(oi_agg.cost_total),0) AS costo_total," +
    "       COALESCE(SUM(oi_agg.earning_total),0) AS ganancia_total" +
    " FROM orders o" +
    " JOIN users u ON u.id = o.user_id" +
    " LEFT JOIN (" +
    "   SELECT oi.order_id," +
    "     SUM(COALESCE(oi.vendedor_cost_unit, p.cost, 0) * oi.quantity) AS cost_total," +
    "     SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity) AS earning_total" +
    "   FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id GROUP BY oi.order_id" +
    " ) oi_agg ON oi_agg.order_id = o.id" +
    wStr
  ).get(...params);

  // Cobros del período
  const cobros = (() => {
    const cp = [];
    const cw = [];
    if (from) { cw.push("date(created_at) >= ?"); cp.push(from); }
    if (to)   { cw.push("date(created_at) <= ?"); cp.push(to); }
    const q = "SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt FROM payments" +
              (cw.length ? " WHERE " + cw.join(" AND ") : "");
    return db.prepare(q).get(...cp);
  })();

  // Compras del período (órdenes de compra a proveedores)
  const compras = (() => {
    const cp = [];
    const cw = [];
    if (from) { cw.push("date(created_at) >= ?"); cp.push(from); }
    if (to)   { cw.push("date(created_at) <= ?"); cp.push(to); }
    const q = "SELECT COALESCE(SUM(total_cost),0) AS total, COUNT(*) AS cnt FROM purchase_orders" +
              (cw.length ? " WHERE " + cw.join(" AND ") : "");
    return db.prepare(q).get(...cp);
  })();

  // Lista de pedidos
  const orders = db.prepare(
    "SELECT o.id, o.status, o.total, o.created_at, o.notes," +
    "       u.id AS client_id, u.full_name AS client_name, u.username AS client_username," +
    "       v.full_name AS vendedor_name, v.username AS vendedor_username," +
    "       COALESCE(oi_agg.cost_total,0) AS cost_total," +
    "       COALESCE(oi_agg.earning_total,0) AS earning_total," +
    "       COALESCE(oi_agg.items_count,0) AS items_count" +
    " FROM orders o" +
    " JOIN users u ON u.id = o.user_id" +
    " LEFT JOIN users v ON v.id = o.assigned_vendedor_id" +
    " LEFT JOIN (" +
    "   SELECT oi.order_id," +
    "     SUM(COALESCE(oi.vendedor_cost_unit, p.cost, 0) * oi.quantity) AS cost_total," +
    "     SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity) AS earning_total," +
    "     SUM(oi.quantity) AS items_count" +
    "   FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id GROUP BY oi.order_id" +
    " ) oi_agg ON oi_agg.order_id = o.id" +
    wStr +
    " ORDER BY o.id DESC LIMIT 500"
  ).all(...params);

  res.json({ kpis, cobros, compras, orders });
});

// GET /api/admin/reports/monthly-history — agregados por mes calendario (para el gráfico comparativo)
// Params: months (default 13, max 36). Devuelve { months: [{ ym, orders, entregados, ventas, ganancia, cobros, cobros_cnt, compras, compras_cnt }] } del más viejo al actual.
app.get("/api/admin/reports/monthly-history", requireAdmin, (req, res) => {
  let months = parseInt(req.query.months, 10);
  if (!isFinite(months) || months < 1) months = 13;
  if (months > 36) months = 36;

  // Lista de meses YYYY-MM, del más viejo al corriente (rellena meses sin datos con 0)
  const now = new Date();
  const list = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
  }
  const fromYm = list[0] + "-01";
  const byYm = {};
  list.forEach((ym) => {
    byYm[ym] = { ym: ym, orders: 0, entregados: 0, ventas: 0, ganancia: 0, cobros: 0, cobros_cnt: 0, compras: 0, compras_cnt: 0 };
  });

  // Pedidos + ganancia por mes (mismo criterio que /reports/sales default: sin cancelados ni unificados)
  db.prepare(
    "SELECT strftime('%Y-%m', o.created_at) AS ym," +
    "       COUNT(DISTINCT o.id) AS orders," +
    "       SUM(CASE WHEN o.status='entregado' THEN 1 ELSE 0 END) AS entregados," +
    "       COALESCE(SUM(o.total),0) AS ventas," +
    "       COALESCE(SUM(oi_agg.earning_total),0) AS ganancia" +
    " FROM orders o" +
    " LEFT JOIN (" +
    "   SELECT oi.order_id," +
    "     SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity) AS earning_total" +
    "   FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id GROUP BY oi.order_id" +
    " ) oi_agg ON oi_agg.order_id = o.id" +
    " WHERE o.status != 'cancelado' AND COALESCE(o.is_unified,0) = 0 AND date(o.created_at) >= ?" +
    " GROUP BY ym"
  ).all(fromYm).forEach((r) => {
    const t = byYm[r.ym];
    if (t) { t.orders = r.orders; t.entregados = r.entregados; t.ventas = r.ventas; t.ganancia = Math.round(r.ganancia); }
  });

  // Cobros por mes
  db.prepare(
    "SELECT strftime('%Y-%m', created_at) AS ym, COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt" +
    " FROM payments WHERE date(created_at) >= ? GROUP BY ym"
  ).all(fromYm).forEach((r) => {
    const t = byYm[r.ym];
    if (t) { t.cobros = r.total; t.cobros_cnt = r.cnt; }
  });

  // Compras por mes
  db.prepare(
    "SELECT strftime('%Y-%m', created_at) AS ym, COALESCE(SUM(total_cost),0) AS total, COUNT(*) AS cnt" +
    " FROM purchase_orders WHERE date(created_at) >= ? GROUP BY ym"
  ).all(fromYm).forEach((r) => {
    const t = byYm[r.ym];
    if (t) { t.compras = r.total; t.compras_cnt = r.cnt; }
  });

  res.json({ months: list.map((ym) => byYm[ym]) });
});

// Arma el WHERE compartido de los reportes por categoría (mismos filtros que /reports/sales)
function rptCategoryWhere(query) {
  const { from, to, client_id, vendedor_id, status } = query;
  const where = ["COALESCE(o.is_unified,0) = 0"];
  const params = [];
  if (from)        { where.push("date(o.created_at) >= ?"); params.push(from); }
  if (to)          { where.push("date(o.created_at) <= ?"); params.push(to); }
  if (client_id)   { where.push("o.user_id = ?");           params.push(Number(client_id)); }
  if (vendedor_id) { where.push("(o.assigned_vendedor_id = ? OR u.assigned_vendedor_id = ?)"); params.push(Number(vendedor_id), Number(vendedor_id)); }
  if (status === "entregado") {
    where.push("o.status = 'entregado'");
  } else if (status === "activo") {
    where.push("o.status NOT IN ('cancelado','entregado')");
  } else {
    where.push("o.status != 'cancelado'");
  }
  return { where, params };
}

// GET /api/admin/reports/by-category — ventas agrupadas por categoría de producto
// Mismos filtros que /reports/sales. Ventas = SUM(oi.subtotal); ganancia = mismo criterio del reporte.
app.get("/api/admin/reports/by-category", requireAdmin, (req, res) => {
  const { where, params } = rptCategoryWhere(req.query);
  const rows = db.prepare(
    "SELECT COALESCE(c.id, 0) AS category_id," +
    "       COALESCE(c.name, 'Sin categoría') AS category_name," +
    "       COALESCE(SUM(oi.quantity),0) AS unidades," +
    "       COUNT(DISTINCT o.id) AS pedidos," +
    "       COALESCE(SUM(oi.subtotal),0) AS ventas," +
    "       COALESCE(SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity),0) AS ganancia" +
    " FROM order_items oi" +
    " JOIN orders o ON o.id = oi.order_id" +
    " JOIN users u ON u.id = o.user_id" +
    " LEFT JOIN products p ON p.id = oi.product_id" +
    " LEFT JOIN categories c ON c.id = p.category_id" +
    " WHERE " + where.join(" AND ") +
    " GROUP BY category_id ORDER BY ventas DESC"
  ).all(...params);
  res.json({ categories: rows });
});

// GET /api/admin/reports/by-category/:categoryId/products — top productos vendidos de una categoría
// categoryId 0 = productos sin categoría o borrados. Mismos filtros de query que /reports/sales.
app.get("/api/admin/reports/by-category/:categoryId/products", requireAdmin, (req, res) => {
  const catId = Number(req.params.categoryId) || 0;
  const { where, params } = rptCategoryWhere(req.query);
  if (catId > 0) { where.push("p.category_id = ?"); params.push(catId); }
  else           { where.push("(p.id IS NULL OR p.category_id IS NULL)"); }
  const rows = db.prepare(
    "SELECT COALESCE(oi.product_code,'') AS code," +
    "       MAX(oi.product_name) AS name," +
    "       COALESCE(SUM(oi.quantity),0) AS unidades," +
    "       COALESCE(SUM(oi.subtotal),0) AS ventas," +
    "       COALESCE(SUM((oi.unit_price - COALESCE(oi.vendedor_cost_unit, p.cost, 0)) * oi.quantity),0) AS ganancia" +
    " FROM order_items oi" +
    " JOIN orders o ON o.id = oi.order_id" +
    " JOIN users u ON u.id = o.user_id" +
    " LEFT JOIN products p ON p.id = oi.product_id" +
    " WHERE " + where.join(" AND ") +
    " GROUP BY oi.product_code ORDER BY ventas DESC LIMIT 50"
  ).all(...params);
  res.json({ products: rows });
});

// GET /api/admin/reports/sales/:orderId/items — ítems de un pedido
app.get("/api/admin/reports/sales/:orderId/items", requireAdmin, (req, res) => {
  const items = db.prepare(
    "SELECT oi.*, p.image_url FROM order_items oi" +
    " LEFT JOIN products p ON p.id = oi.product_id" +
    " WHERE oi.order_id = ?"
  ).all(req.params.orderId);
  res.json(items);
});

// ===== AJUSTES DE STOCK =====

// GET /api/admin/stock-adjustments — historial (filtrable por product_id, from, to)
app.get("/api/admin/stock-adjustments", requireAdmin, (req, res) => {
  const { product_id, from, to } = req.query;
  const where = [];
  const params = [];
  if (product_id) { where.push("sa.product_id=?"); params.push(Number(product_id)); }
  if (from)       { where.push("date(sa.created_at)>=?"); params.push(from); }
  if (to)         { where.push("date(sa.created_at)<=?"); params.push(to); }
  const wStr = where.length ? " WHERE " + where.join(" AND ") : "";
  const rows = db.prepare(
    "SELECT sa.*, u.username AS registered_by_username" +
    " FROM stock_adjustments sa" +
    " LEFT JOIN users u ON u.id = sa.registered_by" +
    wStr +
    " ORDER BY sa.id DESC LIMIT 300"
  ).all(...params);
  res.json(rows);
});

// GET /api/admin/products/:id/stock-history — historial UNIFICADO de movimientos
// de stock de un producto puntual (10 jun request de Sergio: ver cuando se hizo
// una compra, cuando aumento el stock, y si fue manual o por compra). Lee de
// stock_movements (el log generico que se llena en cada punto de la app que
// toca products.stock: compras/recepcion, ventas/entregas/cancelaciones,
// ediciones de pedido, armado, presupuestos y ajustes manuales).
app.get("/api/admin/products/:id/stock-history", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const product = db.prepare("SELECT id, code, name, stock FROM products WHERE id = ?").get(id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  const { from, to, type } = req.query;
  const where = ["sm.product_id = ?"];
  const params = [id];
  if (from) { where.push("date(sm.created_at) >= ?"); params.push(from); }
  if (to)   { where.push("date(sm.created_at) <= ?"); params.push(to); }
  if (type) { where.push("sm.type = ?"); params.push(type); }
  const rows = db.prepare(
    "SELECT sm.*, u.username AS registered_by_username, u.full_name AS registered_by_name" +
    "  FROM stock_movements sm" +
    "  LEFT JOIN users u ON u.id = sm.registered_by" +
    "  WHERE " + where.join(" AND ") +
    "  ORDER BY sm.created_at DESC, sm.id DESC LIMIT 500"
  ).all(...params);
  res.json({ product: { id: product.id, code: product.code, name: product.name, stock: product.stock }, movements: rows });
});

// GET /api/admin/stock-movements — historial UNIFICADO global (todos los
// productos). Misma fuente que el modal por producto (stock_movements), para la
// vista global buscable del boton "Historial de stock" de la toolbar. Filtros:
// from/to (fecha), type (origen). El texto se filtra en el cliente (multi-word).
app.get("/api/admin/stock-movements", requireAdmin, (req, res) => {
  const { from, to, type } = req.query;
  const where = [];
  const params = [];
  if (from) { where.push("date(sm.created_at) >= ?"); params.push(from); }
  if (to)   { where.push("date(sm.created_at) <= ?"); params.push(to); }
  if (type) { where.push("sm.type = ?"); params.push(type); }
  const wStr = where.length ? " WHERE " + where.join(" AND ") : "";
  const rows = db.prepare(
    "SELECT sm.*, p.code AS product_code, p.name AS product_name," +
    "  u.username AS registered_by_username, u.full_name AS registered_by_name" +
    "  FROM stock_movements sm" +
    "  JOIN products p ON p.id = sm.product_id" +
    "  LEFT JOIN users u ON u.id = sm.registered_by" +
    wStr +
    "  ORDER BY sm.created_at DESC, sm.id DESC LIMIT 500"
  ).all(...params);
  res.json(rows);
});

// POST /api/admin/stock-adjustments — crear ajuste
app.post("/api/admin/stock-adjustments", requireAdmin, (req, res) => {
  const userId = req.session.userId;
  const { product_id, mode, qty, type, reason } = req.body;
  // mode: "set" (fijar) o "delta" (sumar/restar)
  if (!product_id) return res.status(400).json({ error: "Producto requerido" });
  const product = db.prepare("SELECT * FROM products WHERE id=?").get(product_id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });

  const validTypes = ["ajuste","inventario","merma","devolucion"];
  const adjType = validTypes.includes(type) ? type : "ajuste";
  // qty tiene que ser un numero real: sin este guard, en modo "set" un body
  // sin qty daba Math.round(NaN) = NaN directo al UPDATE de stock.
  const qtyNum = Number(qty);
  if (qty == null || qty === "" || !isFinite(qtyNum)) {
    return res.status(400).json({ error: "Cantidad invalida" });
  }
  const qtyBefore = product.stock || 0;
  let qtyAfter, qtyChange;

  if (mode === "set") {
    qtyAfter  = Math.max(0, Math.round(qtyNum));
    qtyChange = qtyAfter - qtyBefore;
  } else {
    // delta
    qtyChange = Math.round(qtyNum) || 0;
    qtyAfter  = Math.max(0, qtyBefore + qtyChange);
    qtyChange = qtyAfter - qtyBefore; // recalcular por si fue clampeado a 0
  }

  db.transaction(() => {
    db.prepare("UPDATE products SET stock=? WHERE id=?").run(qtyAfter, product_id);
    db.prepare(
      "INSERT INTO stock_adjustments (product_id, product_code, product_name, type, qty_before, qty_change, qty_after, reason, registered_by)" +
      " VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(product_id, product.code, product.name, adjType, qtyBefore, qtyChange, qtyAfter, reason || null, userId);
    logStockMovement(product_id, "ajuste", qtyChange, null, reason || ("Ajuste manual (" + adjType + ")"), userId);
  })();

  res.json({ ok: true, qty_before: qtyBefore, qty_after: qtyAfter, qty_change: qtyChange });
});

// ===== CAJA =====

// Helper: saldo de una cuenta
function cajaSaldo(accountId) {
  const r = db.prepare(
    "SELECT COALESCE(SUM(CASE WHEN type='ingreso' THEN amount ELSE -amount END),0) AS saldo" +
    " FROM cash_movements WHERE account_id=?"
  ).get(accountId);
  return r ? r.saldo : 0;
}

// GET /api/admin/caja — cuentas con saldo + orden de pestañas por responsable
app.get("/api/admin/caja", requireAdmin, (req, res) => {
  const accounts = db.prepare(
    "SELECT ca.*, " +
    " resp.full_name AS responsable_full_name, resp.username AS responsable_username, " +
    " COALESCE((SELECT SUM(CASE WHEN cm.type='ingreso' THEN cm.amount ELSE -cm.amount END)" +
    "           FROM cash_movements cm WHERE cm.account_id = ca.id), 0) AS saldo" +
    " FROM cash_accounts ca" +
    " LEFT JOIN users resp ON resp.id = ca.responsable_user_id" +
    " ORDER BY ca.sort_order, ca.id"
  ).all();
  // Orden de las pestañas de responsables en la vista Caja (CSV de user ids).
  const tabOrder = String(getSetting("caja_tab_order", "") || "")
    .split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
  res.json({ accounts: accounts, tab_order: tabOrder });
});

// POST /api/admin/caja/tab-order — guardar el orden de las pestañas de
// responsables. Body: { order: [userId, userId, ...] }.
app.post("/api/admin/caja/tab-order", requireAdmin, (req, res) => {
  const order = Array.isArray((req.body || {}).order) ? req.body.order : null;
  if (!order) return res.status(400).json({ error: "Falta el orden" });
  const ids = order.map((n) => Number(n)).filter((n) => n > 0);
  setSetting("caja_tab_order", ids.join(","));
  res.json({ ok: true, order: ids });
});

// GET /api/cajas — lista liviana de cajas activas para el selector de cobro
// (accesible para vendedor o admin, ya que los vendedores registran entregas).
app.get("/api/cajas", requireVendedorOrAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT ca.id, ca.name, ca.type, ca.responsable_user_id," +
    "       resp.full_name AS responsable_full_name" +
    " FROM cash_accounts ca" +
    " LEFT JOIN users resp ON resp.id = ca.responsable_user_id" +
    " WHERE ca.active = 1 ORDER BY ca.sort_order, ca.id"
  ).all();
  res.json(rows);
});

// POST /api/admin/caja/accounts — crear cuenta (solo superadmin)
app.post("/api/admin/caja/accounts", requireAdmin, (req, res) => {
  if (!getAdminPerms(req.session.userId).isSuperadmin) {
    return res.status(403).json({ error: "Solo el superadmin puede crear cajas" });
  }
  const { name, type, sort_order, responsable_user_id } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Nombre requerido" });
  const validTypes = ["efectivo","banco","digital"];
  const t = validTypes.includes(type) ? type : "efectivo";
  // Toda caja nueva DEBE tener un responsable (regla del 12 jun). Las cajas
  // generales viejas (responsable NULL) quedan como estan.
  const respId = responsable_user_id ? Number(responsable_user_id) : null;
  if (!respId) return res.status(400).json({ error: "Toda caja debe tener un responsable" });
  const respUser = db.prepare("SELECT id FROM users WHERE id = ? AND active = 1").get(respId);
  if (!respUser) return res.status(400).json({ error: "Responsable invalido o inactivo" });
  try {
    const r = db.prepare(
      "INSERT INTO cash_accounts (name, type, sort_order, responsable_user_id) VALUES (?,?,?,?)"
    ).run(name.trim(), t, Number(sort_order) || 0, respId);
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe una cuenta con ese nombre" });
    throw e;
  }
});

// PATCH /api/admin/caja/accounts/:id — editar cuenta
app.patch("/api/admin/caja/accounts/:id", requireAdmin, (req, res) => {
  const { name, type, active, sort_order, responsable_user_id } = req.body;
  const acc = db.prepare("SELECT * FROM cash_accounts WHERE id=?").get(req.params.id);
  if (!acc) return res.status(404).json({ error: "No encontrada" });
  const validTypes = ["efectivo","banco","digital"];
  const updates = {};
  if (name !== undefined)       updates.name       = name.trim();
  if (type !== undefined)       updates.type       = validTypes.includes(type) ? type : acc.type;
  if (active !== undefined)     updates.active     = active ? 1 : 0;
  if (sort_order !== undefined) updates.sort_order = Number(sort_order) || 0;
  if (responsable_user_id !== undefined) {
    // Cambiar el responsable de una caja es exclusivo del superadmin.
    if (!getAdminPerms(req.session.userId).isSuperadmin) {
      return res.status(403).json({ error: "Solo el superadmin puede cambiar el responsable de una caja" });
    }
    updates.responsable_user_id = responsable_user_id ? Number(responsable_user_id) : null;
  }
  if (!Object.keys(updates).length) return res.json({ ok: true });
  const sets = Object.keys(updates).map((k) => k + "=?").join(",");
  try {
    db.prepare("UPDATE cash_accounts SET " + sets + " WHERE id=?")
      .run(...Object.values(updates), acc.id);
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe una cuenta con ese nombre" });
    throw e;
  }
});

// DELETE /api/admin/caja/accounts/:id — borrar caja (solo superadmin).
// Bloqueado si la caja tiene movimientos o esta referenciada por cobros,
// entregas, gastos o pagos a proveedores: en ese caso, desactivarla.
app.delete("/api/admin/caja/accounts/:id", requireAdmin, (req, res) => {
  if (!getAdminPerms(req.session.userId).isSuperadmin) {
    return res.status(403).json({ error: "Solo el superadmin puede borrar cajas" });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID invalido" });
  const acc = db.prepare("SELECT id, name FROM cash_accounts WHERE id = ?").get(id);
  if (!acc) return res.status(404).json({ error: "No encontrada" });
  const movs = Number(db.prepare(
    "SELECT COUNT(*) AS n FROM cash_movements WHERE account_id = ? OR counterpart_account_id = ?"
  ).get(id, id).n) || 0;
  const refs =
    Number(db.prepare("SELECT COUNT(*) AS n FROM payments WHERE caja_id = ?").get(id).n) +
    Number(db.prepare("SELECT COUNT(*) AS n FROM deliveries WHERE caja_id = ? OR caja_transfer_id = ?").get(id, id).n) +
    Number(db.prepare("SELECT COUNT(*) AS n FROM expenses WHERE caja_id = ?").get(id).n) +
    Number(db.prepare("SELECT COUNT(*) AS n FROM supplier_payments WHERE caja_id = ?").get(id).n);
  if (movs > 0 || refs > 0) {
    return res.status(409).json({
      error: "La caja \"" + acc.name + "\" tiene " + movs + " movimiento(s) y " + refs +
        " cobro(s)/pago(s)/gasto(s) vinculados. No se puede borrar: desactivala en su lugar."
    });
  }
  db.prepare("DELETE FROM cash_accounts WHERE id = ?").run(id);
  res.json({ ok: true });
});

// GET /api/admin/caja/movements — listado de movimientos
app.get("/api/admin/caja/movements", requireAdmin, (req, res) => {
  const { account_id, responsable_id, from, to, limit: lim } = req.query;
  const params = [];
  const where = [];
  if (account_id && account_id !== "all") { where.push("cm.account_id=?"); params.push(Number(account_id)); }
  // Filtro por responsable de la cuenta (pestañas de la vista Caja).
  else if (responsable_id && Number(responsable_id) > 0) {
    where.push("ca.responsable_user_id=?"); params.push(Number(responsable_id));
  }
  if (from) { where.push("cm.movement_date>=?"); params.push(from); }
  if (to)   { where.push("cm.movement_date<=?"); params.push(to); }
  const wStr = where.length ? (" WHERE " + where.join(" AND ")) : "";
  const rows = db.prepare(
    "SELECT cm.*, ca.name AS account_name, ca.type AS account_type," +
    "       cp.name AS counterpart_name," +
    "       u.username AS registered_by_username" +
    " FROM cash_movements cm" +
    " JOIN cash_accounts ca ON ca.id = cm.account_id" +
    " LEFT JOIN cash_accounts cp ON cp.id = cm.counterpart_account_id" +
    " LEFT JOIN users u ON u.id = cm.registered_by" +
    wStr +
    " ORDER BY cm.movement_date DESC, cm.id DESC" +
    " LIMIT ?"
  ).all(...params, Number(lim) || 200);
  res.json(rows);
});

// POST /api/admin/caja/movements — registrar movimiento (ingreso/egreso/transferencia)
app.post("/api/admin/caja/movements", requireAdmin, (req, res) => {
  const userId = req.session.userId;
  const { account_id, type, amount, description, movement_date, counterpart_account_id } = req.body;
  if (!account_id) return res.status(400).json({ error: "Cuenta requerida" });
  if (!["ingreso","egreso","transferencia"].includes(type)) return res.status(400).json({ error: "Tipo inválido" });
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: "Monto inválido" });
  const acc = db.prepare("SELECT * FROM cash_accounts WHERE id=?").get(account_id);
  if (!acc) return res.status(404).json({ error: "Cuenta no encontrada" });
  // Permisos: el superadmin opera sobre cualquier caja. Un admin comun solo
  // puede TRANSFERIR, y solo desde una caja de la que es responsable.
  if (!getAdminPerms(userId).isSuperadmin) {
    if (type !== "transferencia") {
      return res.status(403).json({ error: "Solo el superadmin registra ingresos/egresos manuales. Vos podés transferir desde tu caja." });
    }
    if (Number(acc.responsable_user_id) !== Number(userId)) {
      return res.status(403).json({ error: "Solo podés transferir desde una caja de la que sos responsable" });
    }
  }
  const date = movement_date || new Date().toISOString().slice(0, 10);
  const ins = db.prepare(
    "INSERT INTO cash_movements (account_id, type, amount, description, source, counterpart_account_id, movement_date, registered_by)" +
    " VALUES (?,?,?,?,?,?,?,?)"
  );

  if (type === "transferencia") {
    const cpId = Number(counterpart_account_id);
    if (!cpId || cpId === Number(account_id)) return res.status(400).json({ error: "Cuenta destino inválida" });
    const cp = db.prepare("SELECT * FROM cash_accounts WHERE id=?").get(cpId);
    if (!cp) return res.status(404).json({ error: "Cuenta destino no encontrada" });
    db.transaction(() => {
      ins.run(account_id, "egreso",   amt, description || ("Transferencia a " + cp.name),   "transferencia", cpId, date, userId);
      ins.run(cpId,       "ingreso",  amt, description || ("Transferencia desde " + acc.name), "transferencia", account_id, date, userId);
    })();
  } else {
    ins.run(account_id, type, amt, description, "manual", null, date, userId);
  }
  res.json({ ok: true });
});

// DELETE /api/admin/caja/movements/:id — borrar movimiento
app.delete("/api/admin/caja/movements/:id", requireAdmin, (req, res) => {
  const mov = db.prepare("SELECT * FROM cash_movements WHERE id=?").get(req.params.id);
  if (!mov) return res.status(404).json({ error: "No encontrado" });
  // Permisos: un admin comun solo borra movimientos de SU caja (espejo de la
  // regla del POST). El superadmin borra de cualquiera.
  if (!getAdminPerms(req.session.userId).isSuperadmin) {
    const movAcc = db.prepare("SELECT responsable_user_id FROM cash_accounts WHERE id=?").get(mov.account_id);
    if (!movAcc || Number(movAcc.responsable_user_id) !== Number(req.session.userId)) {
      return res.status(403).json({ error: "Solo el superadmin puede borrar movimientos de cajas ajenas" });
    }
  }
  // Los egresos de gastos se manejan desde la pestaña Gastos: borrarlos solo
  // de la caja dejaria el gasto registrado sin su salida de plata (desync).
  if (mov.source === "gasto" && mov.related_id) {
    return res.status(409).json({ error: "Este movimiento viene de un gasto. Eliminá el gasto desde la pestaña Gastos." });
  }
  // La comisión del vendedor se gestiona automáticamente con el cobro del pedido.
  if (mov.source === "comision" && mov.related_id) {
    return res.status(409).json({ error: "Es la comisión del vendedor: se ajusta sola al editar o borrar el cobro del pedido." });
  }
  // Si es transferencia, borrar también la contraparte
  if (mov.source === "transferencia" && mov.counterpart_account_id) {
    // Buscar el movimiento espejo: mismo amount, misma fecha, cuenta = counterpart, source=transferencia, counterpart=esta cuenta
    const mirror = db.prepare(
      "SELECT id FROM cash_movements WHERE source='transferencia' AND account_id=? AND counterpart_account_id=? AND amount=? AND movement_date=? AND id!=?"
    ).get(mov.counterpart_account_id, mov.account_id, mov.amount, mov.movement_date, mov.id);
    db.transaction(() => {
      db.prepare("DELETE FROM cash_movements WHERE id=?").run(mov.id);
      if (mirror) db.prepare("DELETE FROM cash_movements WHERE id=?").run(mirror.id);
    })();
  } else {
    db.prepare("DELETE FROM cash_movements WHERE id=?").run(mov.id);
  }
  res.json({ ok: true });
});

// ===== DASHBOARD =====
// ── Historial de deuda total mes a mes ─────────────────────────────────────
// Devuelve el saldo neto de cuenta corriente (debitos - creditos) acumulado
// mes a mes durante los ultimos 12 meses. Para el grafico del Dashboard.
app.get("/api/admin/dashboard/debt-history", requireAdmin, (req, res) => {
  // Movimientos agrupados por mes (YYYY-MM), todos los clientes juntos
  const rows = db.prepare(
    "SELECT strftime('%Y-%m', created_at) AS month," +
    "       SUM(CASE WHEN type='debit'  THEN amount ELSE 0 END) AS monthly_debit," +
    "       SUM(CASE WHEN type='credit' THEN amount ELSE 0 END) AS monthly_credit" +
    "  FROM account_movements" +
    "  GROUP BY month" +
    "  ORDER BY month ASC"
  ).all();

  // Calcular saldo acumulado corriendo (positivo = a favor de la empresa = clientes deben)
  var running = 0;
  var history = rows.map(function(r) {
    running += (r.monthly_debit - r.monthly_credit);
    return { month: r.month, deuda: Math.round(running) };
  });

  // Limitar a los ultimos 12 meses si hay mas
  if (history.length > 12) history = history.slice(-12);

  // Si no hay datos, devolver los 6 meses anteriores con 0
  if (!history.length) {
    var now = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var label = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      history.push({ month: label, deuda: 0 });
    }
  }

  res.json({ history: history });
});

app.get("/api/admin/dashboard", requireAdmin, (req, res) => {
  const now = new Date();
  const todayIso  = now.toISOString().slice(0, 10);
  const monthIso  = todayIso.slice(0, 7); // YYYY-MM
  const prevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  })();
  const weekStart = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes
    return d.toISOString().slice(0, 10);
  })();

  // Ventas hoy
  const salesToday = db.prepare(
    "SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total" +
    " FROM orders WHERE status != 'cancelado' AND COALESCE(is_unified,0)=0" +
    " AND date(created_at)=?"
  ).get(todayIso);

  // Ventas esta semana
  const salesWeek = db.prepare(
    "SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total" +
    " FROM orders WHERE status != 'cancelado' AND COALESCE(is_unified,0)=0" +
    " AND date(created_at) >= ?"
  ).get(weekStart);

  // Ventas mes actual
  const salesMonth = db.prepare(
    "SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total" +
    " FROM orders WHERE status != 'cancelado' AND COALESCE(is_unified,0)=0" +
    " AND strftime('%Y-%m', created_at)=?"
  ).get(monthIso);

  // Ventas mes anterior
  const salesPrevMonth = db.prepare(
    "SELECT COALESCE(SUM(total),0) AS total" +
    " FROM orders WHERE status != 'cancelado' AND COALESCE(is_unified,0)=0" +
    " AND strftime('%Y-%m', created_at)=?"
  ).get(prevMonth);

  // Pedidos activos por estado
  const activeOrders = db.prepare(
    "SELECT status, COUNT(*) AS cnt FROM orders" +
    " WHERE status IN ('pendiente','enviado','preparando','listo') AND COALESCE(is_unified,0)=0" +
    " GROUP BY status"
  ).all();

  // Cobros del mes: pagos manuales + lo cobrado en entregas (efectivo + transferencia)
  const cobrosMonth = db.prepare(
    "SELECT COALESCE(SUM(t),0) AS total, COUNT(*) AS cnt FROM (" +
    "  SELECT amount AS t FROM payments WHERE strftime('%Y-%m',created_at)=?" +
    "  UNION ALL" +
    "  SELECT (efectivo_amount + transferencia_amount) AS t" +
    "  FROM deliveries WHERE strftime('%Y-%m',delivered_at)=? AND (efectivo_amount+transferencia_amount)>0" +
    ")"
  ).get(monthIso, monthIso);

  // Cobros hoy: pagos manuales + lo cobrado en entregas de hoy
  const cobrosToday = db.prepare(
    "SELECT COALESCE(SUM(t),0) AS total FROM (" +
    "  SELECT amount AS t FROM payments WHERE date(created_at)=?" +
    "  UNION ALL" +
    "  SELECT (efectivo_amount + transferencia_amount) AS t" +
    "  FROM deliveries WHERE date(delivered_at)=? AND (efectivo_amount+transferencia_amount)>0" +
    ")"
  ).get(todayIso, todayIso);

  // Deuda total clientes (saldo negativo = deben plata)
  const deuda = db.prepare(
    "SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END),0) AS saldo" +
    " FROM account_movements"
  ).get();

  // Stock crítico: activos con stock = 0
  const stockCero = db.prepare(
    "SELECT COUNT(*) AS cnt FROM products WHERE active=1 AND stock=0"
  ).get();

  // Stock bajo: activos con stock > 0 pero <= stock_min (si tienen mínimo definido),
  // o entre 1 y 5 como fallback para los que no tienen stock_min configurado.
  const stockBajo = db.prepare(
    "SELECT COUNT(*) AS cnt FROM products WHERE active=1 AND stock > 0 AND (" +
    "  (stock_min > 0 AND stock <= stock_min) OR (COALESCE(stock_min,0)=0 AND stock BETWEEN 1 AND 5)" +
    ")"
  ).get();

  // Total productos activos con stock > 0
  const stockOk = db.prepare(
    "SELECT COUNT(*) AS cnt FROM products WHERE active=1 AND stock > 0"
  ).get();

  // Últimos 8 pedidos
  const recentOrders = db.prepare(
    "SELECT o.id, o.status, o.total, o.created_at," +
    "       u.full_name, u.username" +
    " FROM orders o" +
    " JOIN users u ON u.id = o.user_id" +
    " WHERE COALESCE(o.is_unified,0)=0" +
    " ORDER BY o.id DESC LIMIT 8"
  ).all();

  // Top 5 deudores
  const topDeudores = db.prepare(
    "SELECT u.id, u.full_name, u.username," +
    "       COALESCE(SUM(CASE WHEN am.type='debit' THEN am.amount ELSE -am.amount END),0) AS saldo" +
    " FROM users u" +
    " LEFT JOIN account_movements am ON am.user_id = u.id" +
    " WHERE u.level BETWEEN 1 AND 4 AND u.active=1" +
    " GROUP BY u.id" +
    " HAVING saldo > 0" +
    " ORDER BY saldo DESC LIMIT 5"
  ).all();

  // Pedidos entregados hoy: usar delivered_at de la tabla deliveries,
  // no created_at del pedido (que puede ser de días/semanas atrás).
  const entregadosHoy = db.prepare(
    "SELECT COUNT(DISTINCT d.order_id) AS cnt" +
    " FROM deliveries d" +
    " JOIN orders o ON o.id = d.order_id" +
    " WHERE COALESCE(o.is_unified,0)=0 AND date(d.delivered_at)=?"
  ).get(todayIso);

  // Clientes inactivos: clientes (level 1-4) activos que no ingresan hace
  // más de N días (default 30) o que nunca ingresaron. days_inactive = NULL
  // significa "nunca ingresó". Ordena primero los que nunca entraron y luego
  // del más viejo al más reciente.
  const inactiveDays = Math.min(Math.max(Number(req.query.inactiveDays) || 30, 1), 365);
  const inactiveClients = db.prepare(
    "SELECT id, full_name, username, last_login_at," +
    "       CASE WHEN last_login_at IS NULL THEN NULL" +
    "            ELSE CAST(julianday('now') - julianday(last_login_at) AS INTEGER) END AS days_inactive" +
    "  FROM users" +
    " WHERE level BETWEEN 1 AND 4 AND active = 1" +
    "   AND (last_login_at IS NULL OR last_login_at < datetime('now', ?))" +
    " ORDER BY (last_login_at IS NULL) DESC, last_login_at ASC" +
    " LIMIT 50"
  ).all("-" + inactiveDays + " days");

  res.json({
    salesToday:     { total: salesToday.total,     cnt: salesToday.cnt },
    salesWeek:      { total: salesWeek.total,      cnt: salesWeek.cnt },
    salesMonth:     { total: salesMonth.total,     cnt: salesMonth.cnt },
    salesPrevMonth: { total: salesPrevMonth.total },
    activeOrders,
    cobrosMonth:    { total: cobrosMonth.total, cnt: cobrosMonth.cnt },
    cobrosToday:    { total: cobrosToday.total },
    deudaTotal:     deuda.saldo,
    stockCero:      stockCero.cnt,
    stockBajo:      stockBajo.cnt,
    stockOk:        stockOk.cnt,
    entregadosHoy:  entregadosHoy.cnt,
    recentOrders,
    topDeudores,
    inactiveClients,
    inactiveDays,
  });
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

// Error handler global de Express: cualquier throw en una ruta sincrona cae
// aca en vez de dejar el request colgado. Para /api respondemos JSON (el
// frontend espera { error }); para el resto, texto plano. No filtramos el
// detalle del error al cliente, solo al log del server.
app.use((err, req, res, next) => {
  console.error("[error]", req.method, req.path, err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  const isApi = req.path && req.path.startsWith("/api/");
  if (err && err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Archivo demasiado grande" : "Error al subir el archivo";
    return res.status(400).json({ error: msg });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload demasiado grande" });
  }
  if (isApi) return res.status(500).json({ error: "Error interno del servidor" });
  res.status(500).send("Error interno del servidor");
});

// Red de seguridad a nivel proceso. OJO: las rutas async de Express 4 (hoy
// solo POST /api/admin/catalog/pdf) NO llegan al error handler de arriba si
// rechazan — caen aca como unhandledRejection. Logueamos sin tirar el proceso.
// Un uncaughtException deja el proceso en estado indefinido: log + exit
// (Railway lo reinicia solo).
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason && reason.stack ? reason.stack : reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err && err.stack ? err.stack : err);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log("Maxaria escuchando en http://localhost:" + PORT + "  (" + NODE_ENV + ")");
});
