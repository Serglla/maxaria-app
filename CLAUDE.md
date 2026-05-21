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
- Catálogo con precios dinámicos según nivel **o** lista de precios personalizada asignada al cliente
- Filtrado por categoría, búsqueda por nombre/código/categoría
- Imágenes de producto, stock visible (oculta si ≤ 0)
- Carrito con notas, total automático
- Envío de pedido por WhatsApp (link `wa.me`); el pedido se guarda en BD **antes** de abrir WhatsApp
- **El pedido va SIEMPRE al WhatsApp del vendedor asignado al cliente.** Si el cliente no tiene vendedor activo con WA, el botón Enviar queda deshabilitado y se muestra un aviso rojo "No tenés vendedor asignado".
- Historial de pedidos del usuario con estados
- Drawer de cambios de precio (visible para niveles configurables, default mayorista y VIP)

**Vendedor (nivel 5)**
- Barra para seleccionar cliente a atender
- Catálogo con precios del cliente seleccionado (aplica lista personalizada del cliente si tiene una asignada)
- Crea pedidos a nombre del cliente
- Ve los pedidos donde `orders.assigned_vendedor_id = vendedor` **O** los pedidos de sus clientes asignados (`users.assigned_vendedor_id = vendedor`)
- Configurable qué nivel de precios ve cuando atiende sin cliente (`users.vendedor_price_level`, legacy — hoy con cliente seleccionado siempre usa la config del cliente)

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
- Para cada cliente (level 1-4): asignar **Vendedor asignado** y **Lista de precios** desde dos selects editables inline
- Asignación de categorías permitidas (si tiene filas en `user_category_access`, solo ve esas)
- Export/import a JSON (incluye password_hash para restore entre instancias)
- Salvaguardas: el admin no puede bajarse de nivel ni desactivarse a sí mismo
- Al cambiar de tab y volver a Usuarios, los selects de "Vendedor asignado" y "Lista de precios" se refrescan automáticamente (`refreshUserSelects()`), para que un vendedor o lista recién creada aparezca sin recargar la página

**Admin — Vendedores**
- Lista de usuarios nivel 5 con stats de pedidos asignados y entregas

**Admin — Listas de precios**
- CRUD completo en la pestaña dedicada. Cada lista: nombre único, lista base (minorista/revendedor/mayorista/vip/publico), markup % (-90 a 500), activa, notas
- Tabla editable inline con auto-save
- Botón **Preview**: muestra hasta 30 productos con su precio base y el efectivo calculado (modal)
- DELETE bloqueado si hay clientes usando la lista (forzar desasignar o desactivar)
- La asignación a clientes se hace desde la columna "Lista de precios" de la pestaña Usuarios

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

**users** — `id`, `username UNIQUE`, `password_hash`, `full_name`, `phone`, `email`, `level`, `active`, `vendedor_price_level` (para nivel 5), `whatsapp_number` (override personal), `plain_password` (solo para export/import, NO para auth), `assigned_vendedor_id` (FK users.id — vendedor que tiene asignado este cliente), `price_list_id` (FK price_lists.id — lista personalizada del cliente; NULL = precios por nivel), `created_at`, `last_login_at`

**price_lists** — `id`, `name UNIQUE`, `base_level` ('minorista'|'revendedor'|'mayorista'|'vip'|'publico'), `markup_percent` (REAL, -90 a 500), `active`, `notes`, `created_at`, `updated_at`. Precio efectivo de un cliente con `price_list_id = X`: `round(products.price_<base_level> × (1 + markup_percent/100))`, entero. Una lista solo se puede borrar si `users_count = 0`.

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
- `GET /api/admin/users` — lista (incluye `assigned_vendedor_id`, `price_list_id`, `vendedor_price_level`)
- `POST /api/admin/users` — crear
- `PATCH /api/admin/users/:id` — editar (acepta `assigned_vendedor_id`, `price_list_id`; `null`/`""`/`"0"` desasigna)
- `POST /api/admin/users/:id/reset-password` — cambiar contraseña
- `GET /api/admin/users/:id/categories` — restricciones de categoría
- `PUT /api/admin/users/:id/categories` — asignar categorías
- `GET /api/admin/users/export` — JSON con password_hash
- `POST /api/admin/users/import` — importar JSON (no destructivo)

**Admin — Vendedores**
- `GET /api/admin/vendedores` — list level 5 con stats

**Admin — Listas de precios**
- `GET /api/admin/price-lists` — todas (incluye `users_count` calculado)
- `POST /api/admin/price-lists` — crear (validaciones: nombre único, base_level válido, markup -90 a 500)
- `PATCH /api/admin/price-lists/:id` — editar campos sueltos (name, base_level, markup_percent, active, notes)
- `DELETE /api/admin/price-lists/:id` — borrar (409 si tiene clientes usándola)
- `GET /api/admin/price-lists/:id/preview?limit=N` — devuelve productos con precio base y efectivo

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

---

## Estado del proyecto e historial técnico

### Branch actual de trabajo
`multi-instancia` — incluye: vendedor por cliente, listas de precios personalizadas, vendedor tercerizado, panel de Actividad (admin) + Mis ganancias (vendedor), ganancia sobre venta en la fórmula, listas personalizadas en "Ver cambios". Al cierre del 20 mayo 2026 los cambios están en disco local, pendientes de `git add/commit/push` y deploy en Railway.

### Vendedor por cliente + Listas de precios personalizadas (mayo 2026)

**Schema (migración idempotente al arranque)**
- Tabla nueva `price_lists` (ver sección "Esquema").
- `users.assigned_vendedor_id` (FK users.id) — cada cliente puede tener UN vendedor asignado.
- `users.price_list_id` (FK price_lists.id) — cada cliente puede tener UNA lista personalizada (o NULL = precios por nivel).

**Helpers en server.js**
- `PRICE_LIST_BASE_LEVELS = ["minorista","revendedor","mayorista","vip","publico"]`.
- `priceColumnForBaseLevel(baseLevel)` — devuelve `"price_<base>"`.
- `priceChangeColsForBaseLevel(baseLevel)` — devuelve `{ old, new }` para usar las columnas correctas de `price_changes` cuando se aplica una lista. `publico` cae a `minorista` (no hay snapshot de público).
- `getEffectivePriceConfig(userId, level)` — devuelve `{ kind: "list", column, markup_percent, listId }` si el cliente tiene `price_list_id` válido y activo, sino `{ kind: "level", column }`.
- `computeEffectivePrice(basePrice, config)` — aplica la fórmula de **ganancia sobre venta** (ver más abajo) y redondea a entero.
- `priceSqlExpr(config, alias)` — devuelve `{ expr, params }` para usar en SELECT inline (con la fórmula nueva).

**IMPORTANTE — Fórmula de precios:** El nombre `markup_percent` se mantuvo por compatibilidad histórica pero **NO es un markup sobre el costo**: ahora representa la **ganancia limpia del vendedor sobre el precio final**. Fórmula:
```
precio_venta = round(base / (1 - markup_percent / 100))
```
Así, `precio_venta − markup_percent% del precio_venta = base`. Ejemplo: base $1000 con 10% → vende a $1111 (gana $111 limpios sobre la venta). El rango válido es `-90..95` (antes era `-90..500`); con 100% sería división por cero. El cambio se hizo en mayo 2026 a pedido de Sergio para que el % sea la ganancia que él se queda como vendedor.

**Reglas del flujo**
- Cuando un cliente envía pedido, el WhatsApp del link `wa.me` es **siempre** el del vendedor asignado (`users.whatsapp_number` del vendedor). Si no hay vendedor activo o no tiene WA, el server devuelve 400 con mensaje claro y el botón "Enviar" del catálogo queda deshabilitado.
- En `POST /api/orders`: si el usuario es cliente (level 1-4) sin vendedor activo, se rechaza el pedido. Si lo tiene, `orders.assigned_vendedor_id` se setea automáticamente al vendedor del cliente.
- En `GET /api/orders` y `/:id`, vendedores ven pedidos donde `o.assigned_vendedor_id = vendedor` **OR** `u.assigned_vendedor_id = vendedor` (sus clientes asignados). Mismo OR en `PATCH /api/orders/:id` y `POST /api/orders/:id/deliver` para autorización.
- El admin **no** está expuesto a este bloqueo: como su WA no depende de vendedor asignado, no se aplica.
- Cuando un vendedor (level 5) atiende a un cliente desde el catálogo, los precios se calculan con la **config del cliente** (lista personalizada si tiene, sino por nivel). El campo legacy `vendedor_price_level` solo aplica si no hay cliente seleccionado.

**Frontend admin**
- Pestaña nueva "Listas de precios" en `admin.html` con tabla editable + modal "+ Nueva lista" + botón Preview.
- Pestaña Usuarios: dos columnas nuevas ("Vendedor asignado", "Lista de precios") como `<select>` con auto-save. Sólo aparecen como editables para clientes (level 1-4); para vendedores/admin se muestra `—`.
- `loadUsers()` carga en paralelo `/api/admin/users`, `/api/admin/vendedores` y `/api/admin/price-lists` para llenar los selects.
- **Bug fix:** al cambiar de tab y volver a Usuarios, los caches de vendedores y listas se refrescan automáticamente vía `refreshUserSelects()`. Sin esto, un vendedor recién creado en otra pestaña no aparecía en el select de "Vendedor asignado". El handler del tab "usuarios" llama a `refreshUserSelects` cuando `state.usersLoaded === true`.

**Frontend catálogo (app.js)**
- `state.me.whatsapp` para clientes ahora es el WA del vendedor asignado (resuelto en el server).
- Función `isClientWithoutVendedor()` — detecta si hay que bloquear el botón Enviar.
- `renderCart()` muestra aviso rojo en el carrito si no hay vendedor o el vendedor no tiene WA.
- `sendCart()` con alert específico para clientes ("pedile al admin que te asigne un vendedor") en vez del genérico viejo de WHATSAPP_NUMBER.

**Cosa rara durante el dev:** Edits grandes en archivos grandes (server.js ~1900 líneas, admin.js ~2700 líneas, app.js ~1200 líneas) truncaban el archivo al final sin warning. Pasó 3 veces. Workaround usado: detectar con `node --check`, ubicar la última línea íntegra con `grep`, y reconstruir con `head -n N <archivo>` + `git show HEAD:<archivo> | sed -n 'M,$p'`. Para futuros refactors grandes en estos archivos, conviene partirlos o usar Edits más chicos.

### Vendedor tercerizado + Panel de Actividad + Ganancia sobre venta (20 mayo 2026, sesión noche)

**Schema (migración idempotente al arranque)**
- `users.is_tercerizado` (INTEGER NOT NULL DEFAULT 0). Flag 0/1 para marcar vendedores tercerizados.
- `order_items.vendedor_cost_unit` (INTEGER, nullable). Snapshot del precio "base" (columna `price_<base_level>` de la lista del cliente) al momento del pedido. NULL = el cliente no tenía lista personalizada → no hay ganancia diferencial.

**Vendedor tercerizado (clase especial de level 5)**
- Solo el admin ve la denominación "tercerizado". Para el vendedor, todo es transparente: simplemente ve menos clientes.
- En `/api/clients`: si el vendedor logueado tiene `is_tercerizado = 1`, solo devuelve clientes con `assigned_vendedor_id = me`. Vendedores propios siguen viendo todos.
- En `POST /api/vendedor/select-client`: si es tercerizado, valida que el cliente sea suyo (403 si no).
- En `/api/me`: para level 5 devuelve `restrictedToAssigned` (no expone el nombre "tercerizado" al vendedor).
- Admin maneja el flag desde la pestaña Vendedores → columna "Tercerizado" (checkbox con auto-save).

**Endpoints nuevos de ganancias**
- `GET /api/vendedor/earnings` (level 5): resumen + detalle por pedido para el vendedor logueado. Calcula sum(unit_price − vendedor_cost_unit) × quantity sobre los items con snapshot. Excluye cancelados.
- `GET /api/vendedor/earnings/:orderId`: items de un pedido con ganancia por línea.
- `GET /api/admin/earnings`: agregado por vendedor con tipo (propio/tercerizado), pedidos, entregados, vendido, costo, ganancia.
- `GET /api/admin/earnings/:vendedorId`: detalle de pedidos del vendedor con ganancia por pedido.

**Snapshot del costo en creación/edición de pedidos**
- `POST /api/orders`: al armar el pedido, si el cliente tiene `price_list_id`, se guarda `vendedor_cost_unit = round(price_<base_level>)` por item. Si no tiene lista, NULL.
- `PUT /api/admin/orders/:id/items`: al editar items desde admin, recalcula el snapshot con la lista actual del cliente.
- La ganancia se calcula siempre como `(unit_price − vendedor_cost_unit) × quantity` sobre items con snapshot. Items sin snapshot aportan 0.

**Frontend admin**
- Pestaña nueva **Actividad** en `admin.html` (entre Vendedores y Listas de precios): tabla con vendedor / tipo (chip "Propio" o "Tercerizado") / pedidos / entregados / total vendido / costo / ganancia + totales al pie. Botón "Ver detalle" abre modal con los pedidos individuales de ese vendedor.
- Pestaña Vendedores: columna nueva "Tercerizado" con checkbox. Colspan ajustado de 9 a 10.
- `loadActividad()` siempre recarga (datos cambian con cada pedido, no cachear).

**Frontend catálogo (vendedor)**
- Botón nuevo "Mis ganancias" en el header de `index.html`, visible solo para level 5 (`renderUser()` hace `els.earningsBtn.hidden = u.level !== 5`).
- Drawer `#earnings-drawer` con tarjetas-resumen (pedidos / entregados / vendido / costo / ganancia) + detalle por pedido con cliente, total, costo y ganancia.
- Integrado con el sistema existente de drawers.

**Listas personalizadas en "Ver cambios" (/api/price-changes)**
- Cuando el cliente target tiene `price_list_id`, el endpoint usa las columnas viejas/nuevas según `base_level` de la lista (via `priceChangeColsForBaseLevel`), aplica la fórmula de ganancia sobre venta a old/new, y devuelve `listName` con el nombre de la lista.
- El frontend ya usa `data.levelName` como header → muestra "LISTA L1" cuando aplica.

**Bug visual del tab activo (sesión 20 mayo)**
- Después de cambiar de tab, el browser dejaba el outline azul (`:focus`) pegado en el tab anterior. Fix en `styles.css`: hover/active solo a tabs `:not(.active)`; `:focus { outline: none }`; `:focus:not(:focus-visible) { background: transparent }`; el tab activo mantiene amarillo; el ring de teclado se preserva con `:focus-visible`. Además `admin.js` hace `btn.blur()` en el click handler.

**Deploy en Railway**
- Proyecto corre en Railway (instancia `maxaria-app-production`). Reinicio NO se hace localmente — push a GitHub dispara redeploy automático.
- Si la branch de Railway no es la branch de trabajo (ej: `multi-instancia`), mergear a la branch de deploy primero.
- Verificar volumen montado para `DB_PATH` ANTES de deployar, sino cada deploy borra la base.
- Verificación post-deploy: DevTools → Network → `/api/price-changes` → si la respuesta tiene `listName`, código nuevo OK. Si solo `levelName` y `level`, código viejo.

**Truncamientos durante el dev (sesión 20 mayo)**
- El bug de truncamiento mencionado antes en `server.js`/`admin.js`/`app.js` también afecta a `styles.css` y `CLAUDE.md`. Volvió a pasar 7 veces en esta sesión.
- Patrón: archivo se corta a mitad de línea hacia el final. `node --check` detecta JS rotos.
- Workaround: `head -n N` + `git show HEAD:<archivo> | sed -n 'M,$p'` + verificación.
- Mitigación futura: evitar Edits grandes en estos archivos.

### Hardening del arranque (branch multi-instancia, mayo 2026)

**`scripts/boot.js`**
- Variable `SEED_ON_EMPTY` (default `false` en producción, `true` en desarrollo). Si la DB no existe y `SEED_ON_EMPTY=false`, aborta con banner de error en stderr.
- Rama schema-only: si `SEED_ON_EMPTY=true` y no hay Excel disponible, crea la base desde `schema.sql` y genera un usuario `admin` con password aleatoria de 14 caracteres alfanuméricos.
- Banner consolidado de estado antes de levantar el server: ruta, estado, tamaño, conteos, último backup, flag efímera.

**`scripts/excel_helper.js`** — `resolveExcelPath` respeta jerarquía estricta:
- Argumento explícito → valida que exista, lanza `Error` si no
- `EXCEL_PATH` seteada → usa solo esa, sin fallbacks
- Sin env var ni argumento → busca en `data/` y `../`

**`scripts/create-admin.js`** — respeta `process.env.DB_PATH` (antes hardcodeado).

**`.env.example`** — documenta `DB_PATH`, `EXCEL_PATH`, `BACKUP_KEEP`, `SEED_ON_EMPTY`.

### Próximos pasos pendientes (en orden)

1. **Push + deploy a Railway** de los cambios de la sesión 20 mayo (vendedor tercerizado, panel Actividad, ganancia sobre venta, lista en Ver cambios). Verificar volumen montado en `DB_PATH` antes. Después del deploy, validar con DevTools que `/api/price-changes` devuelva `listName`.
2. **Containerización** (alternativa a Railway): Dockerfile multi-stage, `docker-compose.yml` con Caddy + N instancias, `add-client.sh`, README de despliegue.
3. **Backups externos automáticos**: rclone a B2/S3/Drive.
4. **Branding configurable por instancia**: logo + color por cliente en tabla `settings`.
5. **Wizard de primer arranque**: guía para clientes nuevos en el primer login de admin.

### Objetivo de negocio
Vender Maxaria como SaaS llave en mano a distribuidoras mayoristas chicas en Concepción del Uruguay (Entre Ríos). Modelo: setup inicial 150–250k ARS + mensualidad 25–45k ARS por cliente. Meta inicial: 3 clientes pagos para cubrir suscripciones y dejar margen.
- **Cuenta corriente**: débito al entregar pedido (monto = total), crédito al registrar pago. Balance = créditos − débitos.
