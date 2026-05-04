# Memoria sobre Sergio y el proyecto Maxaria

## Sobre Sergio
- Nombre: Sergio — email: venomyo@gmail.com
- Habla en castellano (Argentina) — preferir siempre español rioplatense
- Directo al punto: describe lo que necesita en pocas líneas, sin rodeos
- Prefiere que el trabajo se haga, no que le expliquen mucho antes de arrancar
- Trabaja solo o en equipo pequeño, es quien toca el código
- Usa GitHub para versionar el proyecto
- Tiene buen ojo funcional: sabe exactamente qué quiere aunque no lo describa en términos técnicos

---

## Sobre el proyecto — Maxaria

### Qué es
App de catálogo y gestión de pedidos para un negocio de distribución/mayorista. Tiene clientes con distintos niveles de precio, integración con WhatsApp para envío de pedidos, panel de administración completo, gestión de vendedores con cliente asignado, registro de entregas, gestión de proveedores y compras, pagos y cuenta corriente por cliente.

### Stack técnico
- **Backend**: Node.js >= 18 + Express 4
- **Base de datos**: SQLite con `better-sqlite3` (síncrono, modo WAL, foreign_keys ON)
- **Sesiones**: `express-session` con store SQLite custom (clase `SqliteStore` en server.js, cookie `maxaria.sid`, TTL 7 días)
- **Auth**: bcryptjs
- **Seguridad HTTP**: helmet (CSP y COEP deshabilitados)
- **Frontend**: HTML + CSS + JS vanilla, patrón IIFE, sin frameworks
- **Archivos**: multer en memoria (Excel 10MB, imágenes 5MB jpeg/png/webp/gif)
- **Excel**: librería `xlsx` para importar/exportar listas de precios

### Variables de entorno (.env)
- `PORT` (default 3000)
- `SESSION_SECRET` — firma de sesión (requerida)
- `NODE_ENV` — development/production (en production: cookie secure)
- `WHATSAPP_NUMBER` — número global default (puede overridarse por usuario)
- `DB_PATH` — ruta de la base SQLite (default `./data/maxaria.db`)
- `EXCEL_PATH` — ruta del Excel para seed (opcional, se busca solo)
- `BACKUP_KEEP` — cuántos backups mantener (default 7)

### Scripts npm
- `npm start` → `node scripts/boot.js` (arranque con auto-backup y auto-seed si no hay DB)
- `npm run start:plain` → `node server.js` (directo, sin boot)
- `npm run dev` → `node --watch server.js` (reload automático)
- `npm run seed` → recrea la base desde el Excel
- `npm run create-admin` → crear/resetear usuarios desde CLI
- `npm run import-prices` → importar precios desde Excel sin destruir datos
- `npm run export-prices` → exportar la base a Excel
- `npm run backup` → respaldo manual de la DB

### Estructura del proyecto
```
maxaria_app/
├── server.js                 ← Express principal (~1800 líneas, todas las rutas)
├── package.json
├── .env / .env.example
├── public/
│   ├── login.html            ← pantalla de login
│   ├── index.html            ← catálogo SPA
│   ├── admin.html            ← panel admin SPA
│   ├── css/styles.css
│   └── js/
│       ├── app.js            ← lógica del catálogo (IIFE)
│       └── admin.js          ← lógica del panel admin (IIFE)
├── scripts/
│   ├── boot.js               ← entry point para hosting (backup + seed + start)
│   ├── schema.sql            ← schema inicial
│   ├── seed.js               ← crear base desde cero usando el Excel
│   ├── import-prices.js      ← actualización no destructiva
│   ├── export-prices.js      ← export a Excel
│   ├── excel_helper.js       ← utilidades de lectura/escritura Excel
│   ├── create-admin.js       ← CLI para crear/resetear usuarios
│   └── backup-db.js          ← respaldo con rotación
└── data/
    ├── maxaria.db            ← SQLite (gitignored)
    ├── precios_maxaria.xlsx  ← lista de precios fuente
    ├── product-images/       ← imágenes (persistente, fuera de /public)
    └── backups/              ← respaldos automáticos
```

### Niveles de usuario
| Nivel | Nombre        | Acceso |
|-------|---------------|--------|
| 1     | Minorista     | Catálogo, precio minorista |
| 2     | Revendedor    | Catálogo, precio revendedor |
| 3     | Mayorista     | Catálogo, precio mayorista |
| 4     | VIP           | Catálogo, precio VIP |
| 5     | Vendedor      | Catálogo con cliente seleccionado + admin limitado (solo sus pedidos asignados, registrar entregas) |
| 99    | Administrador | Acceso total |

### Funcionalidades implementadas

**Catálogo (cliente)**
- Login con username/password (bcrypt)
- Catálogo con precios dinámicos según nivel
- Filtrado por categoría, búsqueda por nombre/código/categoría
- Imágenes de producto, stock visible (oculta si ≤ 0)
- Carrito con notas, total automático
- Envío de pedido por WhatsApp (link `wa.me`); el pedido se guarda en BD **antes** de abrir WhatsApp
- Historial de pedidos del usuario con estados
- Drawer de cambios de precio (visible para niveles configurables, default mayorista y VIP)

**Vendedor (nivel 5)**
- Barra para seleccionar cliente a atender
- Catálogo con precios del cliente seleccionado
- Crea pedidos a nombre del cliente
- Solo ve pedidos que le fueron asignados
- Configurable qué nivel de precios ve (`users.vendedor_price_level`)

**Admin — Productos**
- Tabla con todos los productos (incluyendo sin stock e inactivos)
- Edición inline con auto-save al perder foco (sin botón "guardar")
- Filtros (categoría, stock, activos), búsqueda, paginación, ordenamiento
- Subida de imágenes (versionadas con timestamp para bypass cache)
- Upload de Excel para importar precios

**Admin — Pedidos**
- Lista completa con búsqueda y filtros
- Cambio de estado (pendiente, enviado, preparando, entregado, cancelado)
- Asignación de vendedor a un pedido
- Edición de items de un pedido (recalcula total)
- Descuento automático de stock al entregar; devolución si se cancela

**Admin — Usuarios**
- CRUD completo, edición inline, reset de contraseña
- Asignación de categorías permitidas (si tiene filas en `user_category_access`, solo ve esas)
- Export/import a JSON (incluye password_hash para restore entre instancias)
- Salvaguardas: el admin no puede bajarse de nivel ni desactivarse a sí mismo

**Admin — Vendedores**
- Lista de usuarios nivel 5 con stats de pedidos asignados y entregas

**Admin — Entregas**
- Registro: `delivered_to`, `efectivo_amount`, `transferencia_amount`, `notes`
- Marca el pedido como "entregado" automáticamente
- Historial completo con vendedor, cliente y montos

**Admin — Proveedores y Compras**
- CRUD de proveedores
- Órdenes de compra con items (product_id, cantidad, costo unitario)
- Auto-suma de stock al crear; al editar revierte stock anterior y suma el nuevo

**Admin — Pagos y Cuenta corriente**
- Registrar pagos a clientes (efectivo, transferencia, cheque, etc.)
- Movimientos de cuenta corriente: débito al entregar pedido, crédito al registrar pago
- Resumen de saldo por cliente y detalle de movimientos
- Eliminar pago revierte el movimiento

**Admin — Configuración**
- Nombre de la app (runtime)
- Número de WhatsApp global
- Niveles que ven cambios de precio
- Info diagnóstica de DB: ruta, tamaño, mtime, si es efímera, lista de backups

**Backups**
- Backup automático al arrancar (`boot.js`), rotación con `BACKUP_KEEP`
- Backup manual con `npm run backup`
- Restore: copiar archivo del backup a `maxaria.db`

### Esquema de la base — tablas

**categories** — `id`, `name UNIQUE`, `icon_url`, `sort_order`

**products** — `id`, `code UNIQUE` (clave Excel), `category_id`, `name`, `description`, `image_url`, `cost`, `price_minorista`, `price_revendedor`, `price_mayorista`, `price_vip`, `price_publico`, `stock`, `active`, timestamps. Todos los precios son `INTEGER` (no se dividen — `price_minorista = 10000` es $10000).

**users** — `id`, `username UNIQUE`, `password_hash`, `full_name`, `phone`, `email`, `level`, `active`, `vendedor_price_level` (para nivel 5), `whatsapp_number` (override personal), `plain_password` (solo para export/import, NO para auth), `created_at`, `last_login_at`

**orders** — `id`, `user_id`, `status` (pendiente/enviado/preparando/entregado/cancelado), `total`, `notes`, `whatsapp_sent_at`, `assigned_vendedor_id`, `stock_discounted` (flag), `created_at`

**order_items** — `id`, `order_id` (CASCADE), `product_id`, `product_code`, `product_name` (snapshots), `quantity`, `unit_price`, `subtotal`

**deliveries** — `id`, `order_id`, `vendedor_id`, `delivered_to`, `efectivo_amount`, `transferencia_amount`, `notes`, `delivered_at`

**sessions** — `sid PK`, `data` (JSON), `expires` (limpieza automática cada hora)

**settings** — `key PK`, `value`, `updated_at`. Llaves usadas: `app_name`, `whatsapp_number`, `price_changes_visible_levels`

**price_updates** — `id`, `created_at`, `source`, `rows_total`, `products_changed`, `products_new`, `products_reingreso`

**price_changes** — `id`, `update_id`, `product_id`, `code`, `name`, `is_new`, `is_reingreso`, `old_*`/`new_*` para minorista, revendedor, mayorista, vip

**user_category_access** — `(user_id, category_id) PK`. Sin filas = ve todas las categorías

**suppliers** — `id`, `name`, `contact`, `phone`, `email`, `notes`, `active`, `created_at`

**purchase_orders** — `id`, `supplier_id`, `reference`, `notes`, `total_cost`, `received_at`, `created_by`, `created_at`

**purchase_items** — `id`, `purchase_order_id` (CASCADE), `product_id`, `product_code`, `product_name`, `quantity`, `unit_cost`, `subtotal`

**payments** — `id`, `user_id`, `amount`, `method`, `reference`, `notes`, `registered_by`, `created_at`

**account_movements** — `id`, `user_id`, `type` ('debit'|'credit'), `amount`, `description`, `order_id`, `payment_id`, `created_at`

### Rutas del API (resumen por área)

**Auth / Páginas**
- `GET /` — redirige a /login o /catalogo
- `GET /login` — login.html
- `POST /login` — autentica y crea sesión
- `POST /logout` — destruye sesión
- `GET /catalogo` — index.html (requireLogin)
- `GET /admin` — admin.html (requireVendedorOrAdmin)
- `GET /healthz` — health check
- `GET /images/products/*` — sirve imágenes desde `data/product-images/`
- `GET /api/app-info` — nombre de app (público)

**Catálogo (requireLogin)**
- `GET /api/me` — datos del usuario logueado (incluye cliente seleccionado si es vendedor)
- `GET /api/categories` — categorías visibles para el usuario
- `GET /api/products` — productos con stock > 0, precios según nivel
- `POST /api/orders` — crear pedido
- `GET /api/orders` — pedidos visibles (cliente: los suyos; vendedor: asignados; admin: todos)
- `GET /api/orders/:id` — detalle
- `PATCH /api/orders/:id` — cambiar estado
- `GET /api/price-changes` — últimas 10 actualizaciones (si el nivel tiene acceso)

**Vendedor (level 5)**
- `GET /api/clients` — clientes (level 1-4) para elegir
- `POST /api/vendedor/select-client` — guarda el cliente en sesión

**Entregas**
- `POST /api/orders/:id/deliver` (requireVendedorOrAdmin) — registrar entrega
- `GET /api/admin/deliveries` (requireAdmin) — historial completo

**Admin — Productos**
- `GET /api/admin/products` — todos
- `PATCH /api/admin/products/:id` — editar campos
- `POST /api/admin/products/:id/image` — subir imagen
- `POST /api/admin/import-excel` — importar precios desde Excel

**Admin — Pedidos**
- `PUT /api/admin/orders/:id/items` — reemplazar items y recalcular total
- `PATCH /api/admin/orders/:id/assign` — asignar/desasignar vendedor

**Admin — Usuarios**
- `GET /api/admin/users` — lista
- `POST /api/admin/users` — crear
- `PATCH /api/admin/users/:id` — editar
- `POST /api/admin/users/:id/reset-password` — cambiar contraseña
- `GET /api/admin/users/:id/categories` — restricciones de categoría
- `PUT /api/admin/users/:id/categories` — asignar categorías
- `GET /api/admin/users/export` — JSON con password_hash
- `POST /api/admin/users/import` — importar JSON (no destructivo)

**Admin — Vendedores**
- `GET /api/admin/vendedores` — list level 5 con stats

**Admin — Proveedores y Compras**
- `GET/POST/PATCH /api/admin/suppliers[/:id]`
- `GET /api/admin/purchases` — lista con count de items
- `POST /api/admin/purchases` — crear (auto-suma stock)
- `GET /api/admin/purchases/:id` — detalle
- `PUT /api/admin/purchases/:id` — editar (revierte stock anterior, suma nuevo)

**Admin — Pagos y Cuentas**
- `GET /api/admin/payments` — lista (filtro opcional `user_id`)
- `POST /api/admin/payments` — registrar (crea movimiento de crédito)
- `DELETE /api/admin/payments/:id` — borra pago y movimiento
- `GET /api/admin/accounts` — saldo de todos los clientes (level 1-4)
- `GET /api/admin/accounts/:userId` — detalle de movimientos

**Admin — Configuración / Diagnóstico**
- `GET /api/admin/settings` — config runtime
- `PATCH /api/admin/settings` — actualizar
- `GET /api/admin/dbinfo` — ruta, tamaño, efímera, backups, conteos

### Helpers de auth (server.js)
- `requireLogin(req, res, next)` — sesión activa (401 API, redirect HTML)
- `requireAdmin(req, res, next)` — level 99
- `requireVendedorOrAdmin(req, res, next)` — level 5 o 99

### Convenciones del proyecto
- Sin frameworks JS en el frontend — vanilla JS, IIFE, re-render manual con `innerHTML`
- Auto-save en tablas del admin al perder foco (no hay botón guardar por fila)
- Migraciones con `ALTER TABLE ... ADD COLUMN` dentro de `try/catch` (no destructivas, idempotentes en cada arranque)
- Queries SQLite síncronas con `better-sqlite3`; usar transacciones (`db.transaction(() => ...)()`) cuando hay múltiples writes
- Strings de SQL concatenados con `+` (no template literals) — convención del proyecto
- Precios como `INTEGER`, no `REAL`
- Imágenes de producto en `{dirname(DB_PATH)}/product-images/` (fuera de `/public`, persistente en hosting con volumen)
- No usar `console.log` innecesarios
- Importación de Excel es **no destructiva**: productos no presentes en el Excel pasan a `stock = 0`, no se borran
- Mensajes de WhatsApp se generan en el frontend; el pedido se guarda en BD antes de abrir el link

### Detalles importantes
- **Rutas efímeras**: si `DB_PATH` apunta al checkout del proyecto, cada deploy borra la DB. El código detecta esto con `isEphemeralDbPath()` y muestra banner rojo en `/admin`. Recomendación: montar volumen en `/data` o `/var/data`.
- **WhatsApp por usuario**: `users.whatsapp_number` tiene prioridad sobre el global de settings.
- **Cambios de precio**: `is_new` (producto nuevo con stock > 0) e `is_reingreso` (vuelve de stock 0) son flags separados; el historial guarda `old_*`/`new_*` para los 4 niveles.
- **`plain_password`**: solo se usa para export/import entre instancias y para mostrar la pass al crear usuario; la auth real es siempre con `password_hash`.
- **Cuenta corriente**: débito al entregar pedido (monto = total), crédito al registrar pago. Balance = créditos − débitos.
