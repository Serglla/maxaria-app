"use strict";
// Migracion 001: la estructura de la base tal como la armaba server.js hasta
// octubre 2026 (tablas, columnas e indices agregados desde mayo), en el mismo
// orden. Corre UNA vez: en una base existente no cambia nada (cada columna se
// agrega solo si falta) y queda anotada como version 1.
//
// Supone las tablas base de scripts/schema.sql (users, products, orders, ...).
// Las tareas de mantenimiento que deben correr en cada arranque NO estan aca:
// siguen en server.js.
const { addColumn, tolerant } = require("../helpers");

module.exports = {
  id: 1,
  name: "base",
  up(db) {
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
    addColumn(db, "price_changes", "is_reingreso", "INTEGER NOT NULL DEFAULT 0");

    addColumn(db, "price_updates", "products_reingreso", "INTEGER NOT NULL DEFAULT 0");

    // Migracion: snapshot del precio PUBLICO en el historial de cambios. Antes
    // publico no se historizaba y las listas con base "publico" mostraban los
    // numeros de minorista en "Ver cambios". Las filas anteriores a esta migracion
    // quedan en NULL (el drawer las muestra sin precio viejo).
    addColumn(db, "price_changes", "old_publico", "REAL");

    addColumn(db, "price_changes", "new_publico", "REAL");

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
    addColumn(db, "orders", "assigned_vendedor_id", "INTEGER REFERENCES users(id)");

    addColumn(db, "users", "vendedor_price_level", "INTEGER NOT NULL DEFAULT 1");

    addColumn(db, "users", "whatsapp_number", "TEXT");

    addColumn(db, "users", "plain_password", "TEXT");

    // Migracion: Superadmin + usuarios privilegiados con permisos por seccion.
    // - users.is_superadmin: 1 = superadmin (acceso total + unico que gestiona admins).
    // - users.admin_sections: CSV de claves de seccion del panel que puede usar un
    //   admin (level 99) que NO es superadmin. NULL/'' = ninguna. El superadmin lo ignora.
    // Bootstrap idempotente: si todavia no hay ningun superadmin, se marca al admin
    // original (menor id con level 99) como superadmin una sola vez.
    addColumn(db, "users", "is_superadmin", "INTEGER NOT NULL DEFAULT 0");

    addColumn(db, "users", "admin_sections", "TEXT");

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

    addColumn(db, "users", "assigned_vendedor_id", "INTEGER REFERENCES users(id)");

    addColumn(db, "users", "price_list_id", "INTEGER REFERENCES price_lists(id)");

    // Migracion: listas encadenadas. Una lista puede basarse en OTRA lista en vez
    // de un nivel base (ej: "SuperVip" = lista "Vip" con -2% de ganancia).
    // Si base_list_id es NULL, la lista se basa en base_level como siempre.
    // El % efectivo se combina multiplicando divisores: (1 - m1/100) * (1 - m2/100) * ...
    addColumn(db, "price_lists", "base_list_id", "INTEGER REFERENCES price_lists(id)");

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

    addColumn(db, "orders", "stock_discounted", "INTEGER NOT NULL DEFAULT 0");

    // Migracion: Vendedor tercerizado + snapshot del costo del vendedor por item.
    // - users.is_tercerizado: flag 0/1. Si vale 1, el vendedor solo ve sus clientes
    //   asignados (filtrado en GET /api/clients). La denominacion "Tercerizado" solo
    //   la ve el administrador; para el resto sigue siendo un vendedor mas.
    // - order_items.vendedor_cost_unit: snapshot del precio "base" (price_<base_level>
    //   de la lista del cliente) al momento del pedido. Permite calcular la ganancia
    //   del vendedor de forma historica aunque despues cambien precios o listas.
    //   NULL = el cliente no tenia lista personalizada al momento del pedido, por
    //   lo que no hay ganancia diferencial para el vendedor.
    addColumn(db, "users", "is_tercerizado", "INTEGER NOT NULL DEFAULT 0");

    // Lista de precios que define el COSTO de un vendedor (catalogo sin cliente,
    // "Ver cambios"). NULL = usa vendedor_price_level (nivel base 1..4).
    // Separada de price_list_id, que es la lista de un CLIENTE.
    addColumn(db, "users", "vendedor_cost_list_id", "INTEGER REFERENCES price_lists(id)");

    addColumn(db, "order_items", "vendedor_cost_unit", "INTEGER");

    // Migracion: Pedido unificado del vendedor tercerizado.
    // - orders.is_unified: flag 0/1. Si vale 1, este pedido es el "consolidado"
    //   que el vendedor tercerizado le envio al admin agrupando varios pedidos
    //   de sus clientes en uno solo. No cuenta para ganancias (sino se contaria
    //   dos veces) y no participa de la UI normal de pedidos del cliente.
    // - orders.unified_parent_id: para los pedidos individuales que fueron
    //   absorbidos por un unificado, apunta a su pedido padre. Sirve para
    //   evitar doble descuento de stock cuando se entreguen las dos puntas.
    addColumn(db, "orders", "is_unified", "INTEGER NOT NULL DEFAULT 0");

    addColumn(db, "orders", "unified_parent_id", "INTEGER REFERENCES orders(id)");

    // Migracion: Descuento del pedido (aplicado al entregar, solo admin).
    // - discount_type: 'percent' | 'fixed' | NULL (sin descuento)
    // - discount_value: el numero ingresado (ej: 10 para 10%, o 5000 para $5000)
    // - discount_amount: el descuento resuelto en pesos (lo que efectivamente baja
    //   del total). El total NETO que el cliente debe = orders.total - discount_amount.
    //   En cuenta corriente, el descuento se registra como un credito "Descuento
    //   pedido #id" para no tocar el debito original (auditable y reversible).
    addColumn(db, "orders", "discount_type", "TEXT");

    addColumn(db, "orders", "discount_value", "REAL");

    addColumn(db, "orders", "discount_amount", "INTEGER NOT NULL DEFAULT 0");

    // Migracion: Circuito de pedidos (Pedidos -> Armado -> Entregas -> Entregado).
    // - orders.notified_status: ultimo estado del que se le notifico al cliente.
    //   Sirve para avisarle al ingresar al catalogo cuando su pedido avanza a
    //   "preparando" (en armado), "listo" (listo para entregar) o "entregado".
    //   NULL = todavia no se le notifico de ningun estado.
    // El UPDATE inicializa los pedidos ya existentes con su estado actual para que
    // la primera carga despues del deploy NO dispare notificaciones retroactivas
    // (solo los cambios futuros notifican). Corre una sola vez: en boots siguientes
    // el ALTER lanza (la columna ya existe) y el catch evita re-ejecutar el UPDATE.
    if (addColumn(db, "orders", "notified_status", "TEXT")) {
      db.exec("UPDATE orders SET notified_status = status");
    }

    // Migracion: Chequeo de armado (checklist de picking por item del pedido).
    // - order_items.picked_qty: cantidad ya armada/juntada del item (0 = sin armar).
    // - picked_by / picked_at: quien y cuando lo tildo por ultima vez (auditoria).
    // Sincronizacion multi-dispositivo: los armadores postean a /api/admin/picks
    // y el modal hace polling del GET; ultima escritura gana.
    addColumn(db, "order_items", "picked_qty", "REAL NOT NULL DEFAULT 0");

    addColumn(db, "order_items", "picked_by", "INTEGER");

    addColumn(db, "order_items", "picked_at", "TEXT");

    // - order_items.pick_checked: 1 = item CONTROLADO en el chequeo (la cantidad
    //   armada puede ser 0 = "no hay stock", o mayor a la pedida = "redondeo de
    //   caja"). 0 = todavia sin controlar. Antes "controlado" se infería de
    //   picked_qty > 0, lo que impedia controlar un item en 0; el UPDATE corre una
    //   sola vez (cuando el ALTER tiene exito) para marcar lo ya tildado.
    if (addColumn(db, "order_items", "pick_checked", "INTEGER NOT NULL DEFAULT 0")) {
      db.exec("UPDATE order_items SET pick_checked = 1 WHERE COALESCE(picked_qty,0) > 0");
    }

    // - order_items.discount_percent: descuento por linea (0..100). unit_price queda
    //   como el precio de lista (bruto) y subtotal = round2(unit_price*qty*(1-d/100)).
    //   El descuento "general" del pedido se reparte como un % uniforme en cada linea
    //   (se guarda igual por linea). El descuento TOTAL del pedido = Σ unit_price*qty − Σ subtotal.
    //   Es independiente del descuento de entrega/cobro (orders.discount_*).
    addColumn(db, "order_items", "discount_percent", "REAL NOT NULL DEFAULT 0");

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
    addColumn(db, "purchase_items", "checked_qty", "REAL");

    addColumn(db, "purchase_items", "checked_by", "INTEGER");

    addColumn(db, "purchase_items", "checked_at", "TEXT");

    // Migracion: vencimiento de mercaderia.
    // - purchase_items.expiry_date: vencimiento del lote recibido, normalizado a
    //   'YYYY-MM' (en la UI se carga/ muestra como MM/AA, ej: 08/28). NULL = sin
    //   vencimiento (productos que no vencen).
    // - products.expiry_alert_months: cuantos meses ANTES del vencimiento se empieza
    //   a avisar. Configurable por producto en su panel de edicion; default 3.
    addColumn(db, "purchase_items", "expiry_date", "TEXT");

    addColumn(db, "products", "expiry_alert_months", "INTEGER NOT NULL DEFAULT 3");

    // Migracion: la compra ya NO impacta el stock al cargarse. El stock entra
    // recien al CONFIRMAR la recepcion (el costo, los precios de venta y la deuda
    // del proveedor SI se actualizan al cargar la compra, como antes).
    // - purchase_orders.received: 0 = pendiente de recibir (sin stock sumado),
    //   1 = recibida (stock ya impactado).
    // Las compras existentes ya habian sumado stock con el modelo viejo, asi que
    // el UPDATE las marca recibidas una sola vez (en boots siguientes el ALTER
    // lanza y el catch evita re-ejecutar; las compras nuevas arrancan en 0).
    if (addColumn(db, "purchase_orders", "received", "INTEGER NOT NULL DEFAULT 0")) {
      db.exec("UPDATE purchase_orders SET received = 1");
    }

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
    addColumn(db, "budgets", "order_id", "INTEGER REFERENCES orders(id)");

    // Indica si el presupuesto ya descontó stock (al crearse). Evita doble descuento
    // en facturar/entregar y permite devolver el stock si se cancela.
    addColumn(db, "budgets", "stock_discounted", "INTEGER NOT NULL DEFAULT 0");

    // Origen del presupuesto (23/9/2026). 'ventas' = armado en el panel Ventas (es
    // el unico que se lista ahi). 'pedido' = "sombra" que el sistema creaba solo
    // para cada pedido del catalogo / del admin: ya no se crean, y los viejos se
    // ocultan de Ventas. Clasificacion idempotente (solo filas sin origen):
    //  - vinculado a un pedido y no facturado -> sombra ('pedido'). El stock que
    //    tenia anotado pasa al pedido (orders.stock_discounted = 1) para que
    //    cancelar/borrar/editar el pedido lo maneje: NO cambia ninguna cantidad
    //    de stock, solo quien la tiene anotada.
    //  - el resto (incluye facturados y los sueltos sin pedido) -> 'ventas'.
    addColumn(db, "budgets", "source", "TEXT");

    // Base de precios elegida al armar el presupuesto: "base:<nivel>" (minorista,
    // revendedor, mayorista, vip, publico) o "list:<id>" (lista personalizada).
    // Sirve para reabrir el presupuesto mostrando la lista usada y poder recalcular.
    // NULL = presupuestos viejos (se infiere del cliente al abrir).
    addColumn(db, "budgets", "price_basis", "TEXT");

    // Migracion: stock minimo por producto (0 = sin alerta)
    addColumn(db, "products", "stock_min", "INTEGER NOT NULL DEFAULT 0");

    // Unidades por empaque de compra: cuantas unidades de venta componen el empaque
    // en que el proveedor cotiza/pide el producto. 1 = se compra unitario.
    // (Historicamente "por bulto"; el empaque real lo define pack_unit.)
    addColumn(db, "products", "units_per_bulto", "INTEGER NOT NULL DEFAULT 1");

    // Empaque en que el proveedor cotiza/pide el producto: 'unidad' | 'caja' | 'bulto'.
    // units_per_bulto = unidades por ese empaque (ej. Migral: pack_unit='caja', 10 u/caja).
    addColumn(db, "products", "pack_unit", "TEXT NOT NULL DEFAULT 'bulto'");

    // PUSH: suscripciones de notificaciones del navegador (una por dispositivo).
    // endpoint es la URL unica que da el push service del browser -> UNIQUE para
    // que reinstalar/reactivar no duplique. Al fallar el envio con 404/410 la fila
    // se borra sola (suscripcion muerta).
    db.exec(
      "CREATE TABLE IF NOT EXISTS push_subscriptions (" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "  user_id INTEGER NOT NULL REFERENCES users(id)," +
      "  endpoint TEXT NOT NULL UNIQUE," +
      "  p256dh TEXT NOT NULL," +
      "  auth TEXT NOT NULL," +
      "  user_agent TEXT," +
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))," +
      "  last_ok_at TEXT" +
      ");" +
      "CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);"
    );

    // ACCESO POR LINK: token unico por cliente para entrar sin contraseña. NULL =
    // sin link generado. UNIQUE para que no haya colisiones (el indice se crea
    // aparte porque ALTER TABLE no admite UNIQUE inline).
    addColumn(db, "users", "access_token", "TEXT");

    tolerant(db, () => db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_access_token ON users(access_token) WHERE access_token IS NOT NULL"));

    // Vencimiento del link de acceso: vence si NO se usa durante ACCESS_LINK_IDLE_DAYS
    // (vencimiento "por inactividad": un cliente que entra seguido nunca lo pierde,
    // pero un link reenviado y olvidado deja de servir). Los links que ya existian
    // arrancan a contar desde el deploy.
    addColumn(db, "users", "access_token_created_at", "TEXT");

    addColumn(db, "users", "access_token_last_used_at", "TEXT");

    // MARGENES: objetivo de margen sobre venta (%). NULL = hereda del objetivo de
    // la categoria y, si tampoco tiene, del global (settings.margin_target_default).
    addColumn(db, "products", "margin_target", "REAL");

    addColumn(db, "categories", "margin_target", "REAL");

    // REPOSICION: proveedor "oficial" del producto. NULL = se DERIVA del historial
    // de compras (el ultimo proveedor que lo vendio, via purchase_items). El campo
    // existe solo como override manual para casos en que el historico miente
    // (cambio de proveedor, compra de emergencia a otro).
    addColumn(db, "products", "supplier_id", "INTEGER REFERENCES suppliers(id)");

    // Dias de demora del proveedor entre que se le pide y llega. NULL = se calcula
    // del historico (promedio created_at -> received_at de sus ultimas compras).
    addColumn(db, "suppliers", "lead_time_days", "INTEGER");

    // Visibilidad GLOBAL de la categoria en el catalogo (se maneja desde
    // Configuracion). 0 = nadie la ve (clientes ni vendedores) hasta reactivarla.
    // Es independiente de user_category_access: activar una categoria global NO
    // se la muestra a un usuario que la tiene restringida por su propia config.
    addColumn(db, "categories", "active", "INTEGER NOT NULL DEFAULT 1");

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

    // ===== CONTROL DE STOCK (conteo fisico ciclico) =====
    // Cada N dias (settings.stock_control_days, default 10) el sistema sortea un
    // producto de alta rotacion y pide contarlo fisicamente. Lo contado se compara
    // con lo que dice el sistema; si difiere se genera el ajuste. Cada control
    // queda registrado para no repetir siempre los mismos productos.
    db.exec(
      "CREATE TABLE IF NOT EXISTS stock_counts (" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "  product_id INTEGER NOT NULL REFERENCES products(id)," +
      "  expected_qty INTEGER NOT NULL DEFAULT 0," + // lo que decia el sistema
      "  counted_qty INTEGER NOT NULL DEFAULT 0," +  // lo contado fisicamente
      "  diff INTEGER NOT NULL DEFAULT 0," +         // counted - expected
      "  adjusted INTEGER NOT NULL DEFAULT 0," +     // 1 = se aplico el ajuste
      "  note TEXT," +
      "  counted_by INTEGER REFERENCES users(id)," +
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
      ");" +
      "CREATE INDEX IF NOT EXISTS idx_stock_counts_product ON stock_counts(product_id);" +
      "CREATE INDEX IF NOT EXISTS idx_stock_counts_date ON stock_counts(created_at);"
    );

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

    // ─── Pedidos a proveedor ──────────────────────────────────────────────────────
    // Misma tabla que las cotizaciones, distinguidas por kind. Un PEDIDO es lo que
    // se le pide a un proveedor que no cotiza: se arma, se manda, y despues el
    // proveedor factura lo que tiene (a veces menos, a veces con otro precio y en
    // una o varias facturas). Cada factura se carga como una Compra vinculada
    // (purchase_orders.request_id). Estado de un pedido:
    //   borrador / enviado  -> todavia sin facturas
    //   parcial             -> hay facturas pero falta algo (queda pendiente)
    //   facturado           -> se facturo todo lo pedido
    //   cerrado             -> el admin lo dio por terminado (lo que falta ya no viene)
    // Columnas de los items de cotizacion: se repiten ACA (despues del CREATE TABLE)
    // porque las migraciones de arriba corren antes de que la tabla exista en una
    // base nueva, y ahi fallaban en silencio (instancia nueva sin unit_price).
    addColumn(db, "purchase_request_items", "unit_price", "INTEGER");

    addColumn(db, "purchase_request_items", "pack_mode", "TEXT");

    addColumn(db, "purchase_request_items", "comprimidos_per_unit", "INTEGER");

    addColumn(db, "purchase_requests", "kind", "TEXT NOT NULL DEFAULT 'cotizacion'");

    addColumn(db, "purchase_requests", "closed_at", "TEXT");

    addColumn(db, "purchase_orders", "request_id", "INTEGER REFERENCES purchase_requests(id)");

    tolerant(db, () => db.exec("CREATE INDEX IF NOT EXISTS idx_purchase_orders_request ON purchase_orders(request_id)"));

    // Faltante derivado a otro proveedor: lo que un proveedor no facturo y se le
    // pidio a otro. Deja de estar pendiente en el pedido original (no se cuenta dos
    // veces en Reposicion) y queda el rastro de a que pedido fue.
    db.exec(
      "CREATE TABLE IF NOT EXISTS purchase_request_moves (" +
      "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "  from_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE," +
      "  from_item_id INTEGER NOT NULL," +
      "  to_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE," +
      "  product_id INTEGER," +
      "  quantity REAL NOT NULL," +
      "  created_by INTEGER," +
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))" +
      ");" +
      "CREATE INDEX IF NOT EXISTS idx_prm_from ON purchase_request_moves(from_request_id);" +
      "CREATE INDEX IF NOT EXISTS idx_prm_to ON purchase_request_moves(to_request_id);"
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

    // ── Migraciones idempotentes: caja por persona (cajero) ──
    // Cada caja de efectivo puede tener un responsable (cajero = vendedor level 5 o admin).
    addColumn(db, "cash_accounts", "responsable_user_id", "INTEGER REFERENCES users(id)");

    // Cada cobro (pago de cuenta corriente o entrega) imputa a una caja.
    addColumn(db, "payments", "caja_id", "INTEGER REFERENCES cash_accounts(id)");

    // En entregas el cobro puede partirse: efectivo a una caja (caja_id) y
    // transferencia a otra (caja_transfer_id, ej. billeteras del cajero).
    addColumn(db, "deliveries", "caja_id", "INTEGER REFERENCES cash_accounts(id)");

    addColumn(db, "deliveries", "caja_transfer_id", "INTEGER REFERENCES cash_accounts(id)");

    // Un pago puede imputarse a un pedido puntual (cobro de un pedido ya entregado).
    // El vínculo real para el saldo del pedido vive en account_movements.order_id;
    // esta columna es solo para mostrar en el listado de Pagos a qué pedido fue.
    addColumn(db, "payments", "order_id", "INTEGER REFERENCES orders(id)");

    // Cada gasto sale de una caja (egreso en cash_movements, source 'gasto').
    // NULL = gastos historicos anteriores a esta migracion (sin imputar).
    addColumn(db, "expenses", "caja_id", "INTEGER REFERENCES cash_accounts(id)");

    // Migracion: limite de credito por cliente.
    // 0 = sin limite. Cuando el saldo negativo del cliente (lo que debe) supera
    // este valor, se muestra una alerta en Cuentas corrientes. Editable inline
    // desde la pestaña Cuentas o desde Usuarios.
    addColumn(db, "users", "credit_limit", "INTEGER NOT NULL DEFAULT 0");

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

    tolerant(db, () => db.exec("CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at)"));
  },
};
