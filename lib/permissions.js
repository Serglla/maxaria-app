"use strict";
// Permisos del panel /admin por seccion.
//
// Es la UNICA definicion de que ruta pertenece a que seccion. requireAdmin
// (server.js) la usa en cada request a /api/admin/*. Un admin comun solo puede
// usar las secciones que tiene en users.admin_sections; el superadmin, todas.
//
// Regla para rutas nuevas: toda ruta bajo /api/admin tiene que caer en una
// seccion, o figurar en ANY_ADMIN_ROUTES con el motivo. test/permissions.test.js
// lo verifica leyendo las rutas de server.js.

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
  { key: "ctacte-prov", label: "Cuentas a pagar" },
  { key: "proveedores", label: "Proveedores" },
  { key: "cotizaciones", label: "Cotizaciones" },
  { key: "pedidos-prov", label: "Pedidos a proveedor" },
  { key: "compras",     label: "Compras" },
  { key: "recepcion",   label: "Recepción" },
  { key: "reposicion",  label: "Reposición" },
  { key: "margenes",    label: "Márgenes" },
  { key: "control-stock", label: "Control de stock" },
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
  if (has("pedidos-prov")) return "pedidos-prov";
  // Cotizaciones comparten tabla con Pedidos a proveedor pero tienen su propio
  // prefijo; la exportacion (cotizacion/pdf|xlsx) la usan las dos y queda libre.
  if (has("purchase-requests")) return "cotizaciones";
  // Cuenta corriente con proveedores: muestra deudas y registra pagos que
  // sacan plata de una caja. Antes no tenia seccion y cualquier admin la podia
  // usar por la API aunque el menu no se la mostrara.
  if (has("supplier-accounts") || has("supplier-payments")) return "ctacte-prov";
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
  if (has("reposicion"))  return "reposicion";
  if (has("margins"))     return "margenes";
  if (has("stock-control")) return "control-stock";
  if (has("purchases"))   return "compras";
  if (has("expenses") || has("expense-categories")) return "gastos";
  if (has("caja"))        return "caja";
  if (has("settings") || has("dbinfo") || has("categories")) return "config";
  return null;
}

// Secciones que se pueden LEER (solo GET) desde otras secciones que las
// necesitan para trabajar. Sin esto, un admin limitado a Pedidos abria el picker
// de productos vacio (403 silencioso), o uno limitado a Compras no veia ningun
// proveedor. Es solo lectura: para crear/editar sigue haciendo falta la seccion
// propia. "usuarios" queda AFUERA a proposito (expone datos sensibles); para
// listar clientes esta /api/clients.
const SHARED_READ_SECTIONS = {
  productos:     ["pedidos", "ventas", "compras", "recepcion", "armado", "entregas", "price-lists", "reposicion", "cotizaciones", "pedidos-prov"],
  proveedores:   ["compras", "recepcion", "gastos", "reposicion", "cotizaciones", "pedidos-prov"],
  vendedores:    ["pedidos", "ventas", "entregas", "reportes", "actividad", "cuentas", "pagos", "usuarios"],
  "price-lists": ["pedidos", "ventas", "usuarios", "productos", "vendedores"],
};

// Rutas de /api/admin que a proposito NO tienen seccion: cualquier admin las
// puede usar. Cada una dice por que es seguro.
const ANY_ADMIN_ROUTES = {
  "/api/admin/notifications": "la campana del panel: cada admin ve las suyas",
  "/api/admin/quick-client": "alta rapida de cliente desde Nuevo pedido y Ventas (tambien vendedores)",
  "/api/admin/stock-movements": "historial de stock de un producto, solo lectura",
  "/api/admin/cotizacion/pdf": "exportar cotizacion o pedido a proveedor (lo usan dos secciones)",
  "/api/admin/cotizacion/xlsx": "idem en Excel",
  "/api/admin/backup/download": "valida superadmin adentro de la ruta",
  "/api/admin/backup/offsite": "valida superadmin adentro de la ruta",
  "/api/admin/db-download": "valida superadmin adentro de la ruta",
};

module.exports = {
  ADMIN_SECTIONS,
  ADMIN_SECTION_KEYS,
  SHARED_READ_SECTIONS,
  ANY_ADMIN_ROUTES,
  sectionForAdminRequest,
};
