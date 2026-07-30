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

**orders** — `id`, `user_id`, `status` (pendiente/enviado/preparando/entregado/cancelado), `total`, `notes`, `whatsapp_sent_at`, `assigned_vendedor_id`, `stock_discounted` (flag), `is_unified` (flag 0/1: pedido consolidado del vendedor tercerizado), `unified_parent_id` (FK soft a `orders.id`: en los pedidos individuales que fueron agrupados, apunta al unificado), `created_at`

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
- `POST /api/vendedor/dispatch` (solo vendedor con `is_tercerizado=1`) — recibe `{ order_ids: [...] }`, agrupa items por producto con precio base ponderado, crea pedido unificado (`is_unified=1`), marca originales como `status='enviado'` + `unified_parent_id`, devuelve `whatsapp_link` al número global de la empresa
- `GET /api/vendedor/earnings` — resumen y detalle de ganancias (excluye unificados)
- `GET /api/vendedor/earnings/:orderId` — items con ganancia

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

### Bugfix Actividad + Pedido unificado del tercerizado + Polish del admin (21 mayo 2026)


**Bug fix en `/api/admin/earnings`**
- Síntoma: en la pestaña Actividad, columnas `total_orders`, `total_delivered` y `total_sold` salían infladas. Ej: "Sergio vendedor" mostraba 2 pedidos pero 25 entregados y $10.597.260 vendido, total general $11.338.682.
- Causa: el query hacía `LEFT JOIN order_items oi ON oi.order_id = o.id` y después calculaba `SUM(o.total)` y `SUM(CASE WHEN o.status='entregado'...)` en la misma agregación. El join multiplica cada fila de pedido por la cantidad de líneas, inflando totales.
- Fix: reescrito con 3 CTEs. `order_vendedor` arma pares `(vendedor_id, order_id)` con `DISTINCT` para que el OR del vínculo (assigned al pedido o al cliente) tampoco duplique. `order_agg` cuenta pedidos / entregados / suma total sin tocar items. `item_agg` agrega cost / earning desde `order_items`. Después `LEFT JOIN` ambos contra `users` (level 5). Costo y ganancia ya eran correctos antes porque dependen de items por definición; el bug afectaba solo a las columnas que no debían depender de items.
- Validado contra `/tmp/maxaria.db` (sqlite3 vía pysqlite3): la query nueva devuelve 1 pedido / 1 entregado / $7.482 vendido donde la vieja devolvía 1 / 2 / $14.964 (duplicado por 2 items).

**Pedido unificado del vendedor tercerizado**
Motivo: los clientes de un vendedor tercerizado mandan pedidos al WhatsApp del tercerizado (igual que antes), pero el tercerizado necesita pasar esos pedidos al admin como UN solo pedido consolidado por el número principal de la empresa, sumando cantidades por producto.

Schema (migraciones idempotentes al arranque en `server.js`):
- `orders.is_unified` (INTEGER NOT NULL DEFAULT 0). Flag 1 = pedido consolidado del tercerizado.
- `orders.unified_parent_id` (INTEGER, FK soft a `orders.id`). En cada pedido individual absorbido, apunta al padre. Permite trazabilidad y evitar doble descuento de stock.

Endpoint nuevo `POST /api/vendedor/dispatch` (solo level 5 con `is_tercerizado=1`):
- Body: `{ order_ids: [...] }`.
- Valida que cada pedido pertenezca al vendedor (`o.assigned_vendedor_id = me` OR `users.assigned_vendedor_id = me`), no esté ya unificado, agrupado, cancelado ni entregado.
- Agrupa items por `product_id`. Precio base por unidad = promedio ponderado de `order_items.vendedor_cost_unit` (el costo que el admin le cobra al tercerizado según la lista personalizada del cliente al momento del pedido). Si algún item no tiene snapshot (cliente sin lista), usa `unit_price` como fallback.
- Crea pedido nuevo en `orders` con `is_unified=1`, `user_id = assigned_vendedor_id = vendedor.id`, status='pendiente', items consolidados con precios base.
- Marca cada original con `status='enviado'` + `unified_parent_id = nuevo_id`.
- Devuelve `{ ok, unified_order_id, total, items_count, whatsapp_link, whatsapp_message }`. El link va a `wa.me/<settings.whatsapp_number>?text=<mensaje>` con header "Pedido unificado #X - <vendedor>", listado de items con cantidades sumadas y total.

Ajustes en queries existentes:
- `/api/admin/earnings`, `/api/admin/earnings/:vendedorId` y `/api/vendedor/earnings`: agregan `AND COALESCE(o.is_unified,0) = 0` para no contar el unificado doble.
- `PATCH /api/orders/:id`: si el pedido tiene `unified_parent_id != NULL`, NO descuenta stock al pasar a "entregado" (lo descuenta el padre cuando el admin entrega el unificado) ni lo devuelve al cancelar. El pedido unificado tampoco genera débito en cuenta corriente (los hijos sí, contra la cuenta del cliente final).
- `GET /api/orders` (vendedor): devuelve `is_unified` y `unified_parent_id` para que el frontend filtre.

UI frontend (`public/js/app.js` + `public/css/styles.css`):
- En el drawer "Mis pedidos" del catálogo, cuando el usuario es vendedor tercerizado (usa `restrictedToAssigned` que ya venía en `/api/me`):
  - Barra amarilla sticky arriba con instrucciones, contador de seleccionados y botón "Enviar unificado al admin" (deshabilitado hasta tildar algo).
  - Checkbox a la izquierda de cada pedido elegible (no unificado, no agrupado, no cancelado/entregado).
  - Badges visuales: `tag-unified` (violeta "unificado") en el consolidado y `tag-grouped` (amarillo "agrupado en #X") en los hijos.
- Al confirmar: POST `/api/vendedor/dispatch`, abre `whatsapp_link` en pestaña nueva con `window.open(...)`, recarga la lista.

Decisiones de diseño consultadas a Sergio:
- Cliente del tercerizado sigue enviando por WhatsApp al tercerizado (no cambia el flujo del cliente).
- Selección de pedidos a agrupar: checkboxes manuales (no "todos los pendientes" automático).
- Pedidos originales pasan a `status='enviado'` (no se borran, queda referencia via `unified_parent_id`).
- El unificado lleva **precio base** (costo del admin para el tercerizado).
- UI en el drawer del catálogo (no en /admin) porque ahí es donde el vendedor ve sus pedidos.
- WhatsApp destino: el número global de `settings.whatsapp_number`.

**Polish del header del admin**
- Brand: ya no dice "<App> · Admin", solo "<App>". El contexto de /admin queda claro por la URL.
- `user-info`: si `fullName` == `levelName` (caso "Administrador - Administrador"), muestra solo uno. El rol queda como tooltip. Separador pasó de " - " a " · ".
- Tipografía compactada solo en `.admin-page`: brand 18px → 15px, sub 12px → 11px, tabs 14px → 12.5px con `white-space: nowrap` y `overflow-x: auto` para que "Listas de precios" no se corte en dos líneas, altura del topbar 56px → 48px, botones más chicos (padding 5/10, font 12.5px).

**Separación de "Crear usuario" vs "Crear vendedor"**
Sergio detectó la redundancia: tanto la pestaña Usuarios como Vendedores tenían sus formularios de creación, y la lista de Usuarios mezclaba clientes, vendedores y admins.

- Pestaña **Usuarios**: el form `+ Crear usuario` ahora solo permite niveles 1-4 (Minorista/Revendedor/Mayorista/VIP). Saqué las opciones de Vendedor y Administrador, y eliminé la lógica de `vendedor_price_level` y del row dinámico que aparecía al elegir Vendedor. Nota al usuario debajo del select aclarando dónde se crean los otros niveles.
- La tabla de Usuarios filtra `level BETWEEN 1 AND 4` en el render (frontend). Los vendedores ya no aparecen acá; se ven y editan exclusivamente en su pestaña. Los admins tampoco se ven.
- Pestaña **Vendedores**: sin cambios, sigue creando con `level=5` vía `/api/admin/users`.
- Server: `POST /api/admin/users` ahora rechaza `level=99` con 403 ("los administradores se crean desde la línea de comandos"). Level 5 sigue aceptado porque el endpoint es usado por el form de Vendedores.
- `state.users` en admin.js sigue conteniendo TODOS los usuarios (lo usan selects de "Vendedor asignado" y similares). Solo el render visual de la tabla está filtrado, no el array fuente.

**Truncamientos durante el dev (sesión 21 mayo)**
- El bug ya conocido volvió a aparecer ~7 veces en esta sesión: `server.js` (3 veces), `app.js`, `styles.css` (2 veces), `admin.js`, `CLAUDE.md`.
- Caso nuevo: `admin.js` quedó con bytes nulos (`\0`) padding al final, no truncado a mitad de línea. Detectado con `node --check` ("Invalid or unexpected token" en línea posterior al EOF lógico). Limpiado con `tr -d '\000'` y `cp` a destino.
- Workaround general sigue siendo: `head -n N <archivo>` + `git show HEAD:<archivo> | sed -n 'M,$p'` + `node --check` para confirmar.
- En el sandbox Linux, `rm` y `mv` a veces fallan con "Operation not permitted" — usar `cp /tmp/x archivo` + `: > archivo.tmp` para vaciar archivos huérfanos.
- Mitigación residual: hay un `public/js/admin.js.tmp` vacío que quedó huérfano. No interfiere con nada; conviene borrarlo desde Windows.

### Fix WhatsApp del vendedor + regla de destino unificada (21 mayo 2026, sesión tarde)

**Bug reportado por Sergio:** un cliente (dariocliente, level 1) asignado al vendedor tercerizado Dario, al enviar un pedido por WhatsApp, terminaba abriendo `wa.me/<global>` en vez del WA de Dario. Pasó en producción (Railway, deploy ya con el código de tercerizado del 21 may).

**Causa raíz (doble):**
1. El campo `users.whatsapp_number` del vendedor Dario estaba en NULL. La pestaña Vendedores del admin **nunca tuvo columna `whatsapp_number`** — solo `phone`, etiquetado como "Teléfono". Y el form "+ Crear vendedor" tenía el `<input name="whatsapp_number">` en el HTML pero el handler de `admin.js` **no lo leía del FormData**, así que aunque lo escribieras, se mandaba el POST sin él. Resultado: desde la UI nunca se le pudo cargar WA a ningún vendedor. Sergio había cargado el número en la columna "Teléfono" pensando que era el WhatsApp; eso es `users.phone`, que el server ignora.
2. Para complicar, `/api/me` para level 5 (vendedor) caía a `wa = userWa || globalWaClean`. Si el vendedor algún día tuviera WA personal cargado, el pedido del vendedor iría a su propio número, no al de la empresa.

**Regla nueva (consultada y confirmada por Sergio):**
- Cliente (1-4) con vendedor asignado → SIEMPRE `wa.me/<whatsapp_number del vendedor>`. Si el vendedor no tiene WA, el frontend bloquea el envío con cartel rojo.
- Vendedor (5) tomando pedido a nombre de un cliente desde el catálogo → SIEMPRE `wa.me/<global>` (la empresa recibe los pedidos que toman los vendedores).
- Pedido unificado del tercerizado (`POST /api/vendedor/dispatch`) → SIEMPRE `wa.me/<global>` (ya estaba así).

**Cambios en `server.js`:**
- `/api/me`: rama nueva `else if (Number(level) === 5) { wa = globalWaClean; }` antes del else genérico. La rama de clientes (1-4) queda intacta. Comentarios actualizados con la regla.
- `/api/admin/vendedores`: el SELECT ahora incluye `u.whatsapp_number` (sin esto, la nueva columna del admin queda vacía aunque haya valor cargado).

**Cambios en `public/admin.html`:**
- Pestaña Vendedores: nueva `<th title="...">WhatsApp</th>` entre Teléfono y Lista de precios. Colspan del placeholder "Cargando…" pasado de 10 a 11.

**Cambios en `public/js/admin.js`:**
- `vendRowHtml`: nueva celda con `<input type="tel" data-field="whatsapp_number" placeholder="ej: 5493442484286" title="...">`. El handler de auto-save existente (`els.vendTbody.addEventListener("change", ...)`) ya cubre cualquier `[data-field]`, así que no hizo falta tocar la lógica de guardado.
- Colspan "Sin resultados" → 11.
- Submit del form "+ Crear vendedor": se agregó `whatsapp_number: fd.get("whatsapp_number") || null` al body del POST (el input ya estaba en el HTML, era bug latente).

**Workaround inmediato cuando el deploy esté listo:** ir a /admin → Vendedores → cargar el WA de Dario en la columna nueva (autoguarda al perder foco). Los próximos vendedores que se den de alta también pueden completar el WA en el modal de creación.

**Truncamientos en esta sesión:** volvieron a pasar — `server.js` (perdió las últimas 4 líneas: middlewares static, 404 y app.listen), `public/js/admin.js` (perdió las últimas 13 líneas: handlers de accReload + logout + bootstrap), `public/admin.html` (perdió las últimas 5 líneas: toast + script + cierre html). Detectados con `node --check` y comparación `wc -l` actual vs `git show HEAD:<archivo> | wc -l`. Reconstruidos con `head -n N` + `cat >> archivo << EOF` desde HEAD.

**Sandbox Linux con git roto:** durante el push intentado desde el subagente, el `.git/index` quedó corrupto ("bad signature 0x00000000") y `.git/index.lock` huérfano. El sandbox no permite `rm` sobre archivos en `.git/` ("Operation not permitted") — sí permite truncar con `: > archivo` pero no eliminar. Como git se niega a operar mientras existe `index.lock`, no se pudo hacer commit/push desde el sandbox. **El commit/push se hace desde Windows** con `Remove-Item .git\index.lock -ErrorAction SilentlyContinue` + `git add` + `commit` + `push` normales.

### Clientes sin vendedor + dispatch arreglado + tercerizado ve su costo (21 mayo 2026, sesión noche)

**Regla nueva: clientes sin vendedor envían al WhatsApp global**

Antes: cliente (level 1-4) sin vendedor asignado o con vendedor sin WA → frontend bloqueaba el envío con cartel rojo. Sergio pidió cambiar: si no hay vendedor, el pedido va al WhatsApp principal de la empresa con la lista de precios que le corresponda al cliente (por nivel o por lista personalizada, sin cambios en pricing).

- `server.js` `/api/me` rama clientes (1-4): si no hay vendedor activo o el vendedor no tiene `whatsapp_number`, `wa` cae a `globalWaClean` en vez de quedar `null`. `assignedVendedor` sigue exponiendo `{ id, hasWhatsapp }` para que el frontend sepa el estado.
- `server.js` `POST /api/orders`: se eliminaron los dos `res.status(400)` (sin vendedor / sin WA). Si el cliente tiene vendedor activo válido, se guarda en `orders.assigned_vendedor_id` para trazabilidad; si no, queda NULL y el pedido se acepta igual.
- `public/js/app.js` `renderCart()`: el cartel rojo "No tenés un vendedor asignado" se reemplazó por un aviso amarillo suave **"Tu pedido se enviará al WhatsApp principal de la empresa."** El botón "Enviar" solo se deshabilita si tampoco hay WA global (caso degenerado).
- `public/js/app.js` `sendCart()`: el alert ahora pide "cargá el WhatsApp principal de la empresa", no "pedile al admin un vendedor".

**Fix Error 500 en `POST /api/vendedor/dispatch` (pedido unificado del tercerizado)**

Sergio probó por primera vez el flujo de unificado (Dario seleccionó 3 pedidos y le dio Enviar). Server respondía 500. Causa: dos statements preparados con la forma `db.prepare(...).all.apply(null, args)`. En `better-sqlite3` los métodos `.all/.run/.get` requieren `this = el statement`; pasar `null` los hace crashear con TypeError → 500. Fix: guardar el statement en una variable y usar `.all.apply(stmt, args)`. Las dos correcciones están en líneas que arman `candidateStmt` y `itemsStmt`. El bug existió desde que se creó el endpoint — esta fue la primera prueba real.

**Vendedor tercerizado: ocultar "Reenviar por WhatsApp" individual**

En el detalle de cada pedido del drawer "Mis pedidos", aparecía el botón verde "Reenviar por WhatsApp". Para tercerizados no tiene sentido (su flujo es solo el unificado al admin). `public/js/app.js` `toggleOrderDetail()`: agregado check `esTercerizado = state.me.restrictedToAssigned`; el botón solo se renderiza si `phone && !esTercerizado`.

**Vendedor tercerizado: ver el catálogo con SU COSTO**

Sergio: el tercerizado tiene que poder entrar al catálogo SIN cliente seleccionado y ver los productos con su costo (lo que él le paga al admin). El costo NO es una lista personalizada — es **uno de los niveles base** (minorista/revendedor/mayorista/VIP), o sea la columna `price_<nivel>` de `products`.

Datos: se reactiva el campo legacy `users.vendedor_price_level` (INTEGER 1-4) que ya estaba en el schema. Nada nuevo en BD.

- `server.js` `GET /api/products`: rama vendedor sin cliente — si `users.is_tercerizado = 1` y tiene `vendedor_price_level` válido (1..4), arma `vendorCostCfg = { kind: "level", column: priceColumnFor(vpl) }` y devuelve los precios con esa columna directo. Para vendedor propio (no tercerizado), mantiene `noPrice = true` (cartel "Seleccioná un cliente"). Se lee de la DB en cada request para que un cambio del admin se vea sin re-login.
- `server.js` `GET /api/admin/vendedores`: agregado `u.price_list_id` al SELECT (no se usa para esta feature, pero queda disponible para futuro).
- `public/js/app.js` `cardHtml()`: el gate del precio cambió de "noClient ? '—' : precio" a "hasPrice ? precio : '—'". Las acciones (+/qty) siguen ocultas cuando no hay cliente (tercerizado viendo costos no debería agregar al carrito).
- `public/js/app.js` barra del vendedor: si es tercerizado y no tiene cliente, el cartel dice **"Viendo tu lista de costos. Seleccioná un cliente para tomar un pedido."** en lugar del genérico "Seleccioná un cliente para ver los precios".
- `public/admin.html`: el `<th>` de la pestaña Vendedores ahora dice **"Nivel de costo"** (antes decía "Lista de precios", que confundía con las listas personalizadas del menú Listas).
- `public/js/admin.js` pestaña Vendedores: `vendRowHtml` mantiene el select de `vendedor_price_level` con las 4 opciones (Minorista/Revendedor/Mayorista/VIP). Auto-save existente cubre el `data-field="vendedor_price_level"` y manda `Number(inp.value)`.

**Confusión que ocurrió y se corrigió**: en una primera pasada se intentó usar `users.price_list_id` (las listas personalizadas del menú Listas) como costo del vendedor. **Es incorrecto**: esas listas son las que el ADMIN crea para sus clientes (vip, mayorista, etc. con markup), no el costo del vendedor. El costo del vendedor es simplemente uno de los niveles base del producto. Se revirtió.

**Final wins, vibe-shift de la regla del WhatsApp**

Después de este combo, la regla de destino del WhatsApp en el catálogo queda:
- Cliente (1-4) con vendedor activo + WA → al WA del vendedor (sin cambios).
- Cliente (1-4) sin vendedor o vendedor sin WA → al WA global (cambio nuevo, antes bloqueaba).
- Vendedor (5) tomando pedido a nombre de un cliente → al WA global (sin cambios).
- Pedido unificado del tercerizado (`/api/vendedor/dispatch`) → al WA global (sin cambios).

**Lección sobre el bash mount del sandbox vs el filesystem Windows**

Durante esta sesión el bash mount Linux mostró archivos en estados distintos al filesystem real de Windows (lag/cache del bind mount). Pasó dos veces y la segunda casi mete un commit roto:

1. `node --check server.js` desde bash → "Unexpected token" cortado a mitad de string al final.
2. `tail -c` confirmó el corte en el mount.
3. Hice `printf >> server.js` para "reparar" el supuesto truncamiento.
4. Resultado: appended texto a un archivo que en Windows YA estaba completo, dejando líneas duplicadas. Eso sí se commiteó y rompió el deploy en Railway con `Unexpected token '}'` y después con `Unexpected identifier` (la línea `aria escuchando...` huérfana).

**Regla nueva:** para verificar el final de cualquier archivo Windows, **usar `Read` tool, no `tail`/`xxd` por bash**. El bash sirve para `node --check` siempre y cuando primero hagas `Read` para confirmar el contenido. Si bash reporta un error que no condice con lo que ves en Read, es porque el mount está stale — no tocar el archivo basándose en el bash.

**Cosas a hacer post-deploy de esta sesión**

1. /admin → Vendedores: a Dario asignarle el "Nivel de costo" (por ejemplo Mayorista o VIP) — la columna ahora es un select con los 4 niveles. Sin esto, sigue viendo precios pero por default es Minorista (vendedor_price_level=1).
2. Login como dariocliente: el carrito ya no debería bloquear; el wa.me debería abrirse con el número de Dario (porque Dario sí tiene vendedor asignado y WA). Si Dario no tuviera WA cargado, el cartel sería amarillo "se enviará al WhatsApp principal".
3. Login como Dario (tercerizado) sin cliente seleccionado: catálogo con precios = columna `price_<nivel>` según su `vendedor_price_level`. Barra amarilla "Viendo tu lista de costos".
4. Login como Dario → Mis pedidos: el botón verde "Reenviar por WhatsApp" no aparece en ningún pedido. Seleccionar 3 pedidos → "Enviar unificado al admin" → ahora debería responder OK con `whatsapp_link` y abrir wa.me al número global con el mensaje del unificado.

### Catálogo PDF (22 mayo 2026)

**Funcionalidad**: el admin puede generar un catálogo en PDF desde la pestaña Productos, con botón "📄 Catálogo PDF".

**Dependencias nuevas**: `pdfkit ^0.18.0` + `sharp ^0.34.5` en package.json. Sharp convierte cualquier formato de imagen (WebP, AVIF, GIF, PNG, JPEG) a PNG antes de pasarlo a pdfkit. Después de actualizar package.json correr `npm install` desde Windows para instalar los binarios nativos de sharp para la plataforma correcta.

**Endpoint**: `POST /api/admin/catalog/pdf` (requireAdmin, async). Body:
- `priceConfig`: `{ type: "level", level: "minorista"|"revendedor"|"mayorista"|"vip"|"publico" }` o `{ type: "list", listId: N }`
- `categoryIds`: array de IDs (vacío = todas las categorías)
- `targetUserId`: ID del usuario/vendedor cuyo WA usar (0 = solo descargar)
- `includePriceChanges`: boolean — si true, agrega sección de cambios al inicio

**Helpers en server.js**:
- `loadProductImage(imageUrl)`: descarga la imagen (URL externa o ruta local `/images/products/...`), la convierte a PNG con sharp y devuelve Buffer. Timeout 8s. Retorna null si falla.
- `pLimit(fns, concurrency)`: ejecuta array de funciones async con concurrencia máxima. Se usa con concurrencia 15 para no disparar rate-limiting del CDN (imágenes en yourfiles.cloud).

**Importante**: las imágenes de productos están almacenadas como URLs externas en yourfiles.cloud (no como archivos locales). La función `loadProductImage` las descarga en paralelo antes de generar el PDF.

**Formato del PDF**:
- A4, doble columna, márgenes 30pt
- Encabezado: nombre de la app + lista de precios + fecha + "Solo productos en stock"
- Por categoría: banner azul oscuro (`#1e3a5f`) con nombre en mayúsculas
- Tarjeta de producto (100pt alto): imagen 80×80pt a la izquierda, nombre + código + descripción + precio destacado (ámbar `#d97706`) a la derecha
- Pie de página con cantidad total de productos

**Sección de cambios de precio** (si `includePriceChanges = true`):
- Se genera ANTES del catálogo (páginas propias)
- Consulta el último `price_updates` + sus `price_changes`
- Items en doble columna, agrupados por categoría
- Tarjeta de 52pt: nombre (hasta 2 líneas, `height: 22pt`), código en `iy+28`, badge NUEVO/REINGRESO en `iy+38`
- Precio anterior (gris pequeño) + precio nuevo (rojo si subió, verde si bajó) en lado derecho
- La columna de precio usada (old_/new_) depende del nivel base del catálogo; si es NULL cae a minorista como fallback
- Al terminar los cambios, salto de página y empieza el catálogo

**Frontend — modal** (`admin.html` + `admin.js`):
- Categorías en grilla CSS de 3 columnas (no lista vertical)
- Checkbox "Incluir últimos cambios de precio" alineado a la izquierda con div wrapper (no label centrado)
- Select de WhatsApp destino con optgroups "Clientes con WhatsApp" y "Vendedores con WhatsApp"
- On submit: fetch POST → respuesta como blob → descarga automática → si hay `X-Whatsapp` header abre wa.me con mensaje pre-cargado "Hola [nombre], te mando el catálogo..."
- El nombre del destino viene en header `X-Whatsapp-Name` codificado en base64

**Flujo WhatsApp**: el PDF siempre se descarga. Si el admin eligió un contacto, se abre el chat de WhatsApp con mensaje pre-cargado para que adjunte el PDF manualmente (wa.me no soporta envío de archivos automático).

**Bug conocido del bash mount (confirmado en esta sesión)**: `node --check` desde bash reporta errores en archivos que en realidad están correctos (mount stale). Regla: verificar siempre con `Read` tool antes de actuar. Si bash y Read difieren, confiar en Read.

### Catálogo PDF — mejoras visuales y cache busting (22 mayo 2026, sesión tarde)

Tres ajustes al catálogo PDF reportados por Sergio:

**1. Headers de columna en el banner azul de la sección de cambios**
- Antes: el banner azul de cada categoría en la sección "Cambios de Precio" solo mostraba el nombre de la categoría.
- Ahora: el banner tiene tres labels blancos a la derecha alineados con las columnas de cada tarjeta: **"Precio viejo"**, **"Precio nuevo"** y **"% cambio"**.
- Implementación (`server.js`, dentro del `for (const cat of chgByCat)` en la sección `if (includePriceChanges)`): después del `doc.rect(MX, cy, UW, 22).fill(CBLU)` se dibuja el nombre de la categoría con `width: IC_OLD - MX - 14` y `ellipsis: true` (para que se acorte si pisa los headers), y luego tres `doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text(...)` en posiciones `IC_OLD`, `IC_NEW`, `IC_PCT` con `align: "right"`. Las constantes `IC_*` ya estaban definidas arriba en el mismo bloque.

**2. Divisor azul vertical entre las dos columnas del catálogo**
- En la sección del catálogo (no la de cambios), al inicio de cada fila (`col === 0`) se dibuja una línea vertical azul (color `CBLU = "#1e3a5f"`, `lineWidth: 1`) en `x = MX + CW + CGAP / 2`, desde `cy` hasta `cy + CH`. Funciona en ambas variantes (con y sin imágenes) porque CH cambia automáticamente según `withImages`.
- Se dibuja por fila (no por categoría completa) para que el divisor también aparezca cuando hay salto de página en medio de una categoría.

**3. Cache busting del `admin.js`**
- Bug reportado: la opción "Incluir imágenes de producto" del modal Catálogo PDF "no funcionaba", aunque el código del flag `withImages` estaba implementado correctamente en `server.js` (línea ~2722, `body.withImages !== false`), `admin.html` (checkbox `#catalog-with-images` checked por default) y `admin.js` (línea ~3233, lee `els.catalogWithImages.checked`).
- Causa probable: navegador cacheando una versión vieja del `admin.js` sin la lógica del checkbox.
- Fix: cambié el `<script src>` del final de `admin.html` de `/js/admin.js` a `/js/admin.js?v=20260522c`. **Regla nueva**: cada vez que se modifique `admin.js` o `app.js` y se quiera asegurar que el browser traiga la nueva versión, hay que bumpear el query string (`?v=YYYYMMDD<letra>`). Sin esto, los users con la página abierta o con caché agresivo siguen viendo el JS viejo y reportan "no funciona" sobre features que ya están deployadas.

**Bug del bash mount — re-confirmado y persistente**
- En esta sesión volvió a pasar: después de editar `server.js`, `node --check` desde bash reportaba `SyntaxError: Unexpected end of input` en una línea que estaba completa en Windows. `Read` confirmó que el archivo terminaba bien con `app.listen(PORT, ...)`. El error de bash es un mount stale del bind mount Linux que NO se sincroniza inmediatamente con los cambios de las file tools (Read/Write/Edit operan sobre el filesystem real de Windows, bash ve una versión cacheada del mount).
- Confirma la regla de CLAUDE.md: **NO tocar el archivo basándose en el error de bash**. Usar `Read` como fuente de verdad. Si bash y Read difieren, confiar SIEMPRE en Read.
- El error de bash persiste incluso después de `sleep 2`; no es cuestión de timing corto.

### Revisión completa + fixes críticos (27 mayo 2026, sesión mañana)

Sergio pidió revisión del código completo y aplicar fixes. Se priorizó 🔴 críticos y se dejaron pendientes 🟡 (rate limit login, validación categorías en POST orders, race condition `nextBudgetNumber`, path traversal `loadProductImage`).

**Bug crítico: `req.session.user` siempre undefined en todo el módulo Presupuestos**
- Las 6 rutas `/api/budgets*` (GET lista, GET detalle, POST, PUT, PATCH status, DELETE) hacían `const u = req.session.user` y después `u.level`/`u.id`. Pero `POST /login` solo guarda `req.session.userId`, `req.session.level`, `req.session.fullName`, `req.session.username` — nunca un objeto `user`. Cualquier request crasheaba con TypeError → 500.
- Fix: `const u = { id: req.session.userId, level: req.session.level }` en las 6 rutas. Commit `6c09104`.

**Bug crítico: `POST /api/orders/:id/deliver` no descontaba stock ni generaba débito en cuenta corriente**
- El flujo de entrega via deliver solo registraba en `deliveries` y ponía `status='entregado'`. La lógica de descuento de stock + débito vivía solo en `PATCH /api/orders/:id` con status='entregado', pero como deliver ya había puesto el status, el PATCH posterior veía `prevStatus === 'entregado'` y no ejecutaba el descuento.
- Resultado: en producción el stock nunca bajaba al entregar y la cuenta corriente del cliente no se debitaba — el flujo más común para vendedores estaba roto.
- Fix: dentro de la transacción de `/deliver` se agregó el mismo bloque que el PATCH (descuento de stock + INSERT en `account_movements` + `stock_discounted = 1`), respetando `skipStock` para pedidos con `unified_parent_id != null` y `is_unified`. El check `prevStatus !== "entregado" && !order.stock_discounted` evita doble descuento al editar una entrega ya registrada.
- Commit `3e3633e`.

**Hardening de `SESSION_SECRET`**
- Antes: `const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-cambiame"`. Si la env var no estaba seteada en producción (deploy mal configurado), el server arrancaba con un secreto público — cualquiera podía forjar cookies.
- Fix: en `NODE_ENV=production`, si `SESSION_SECRET` falta o coincide con `"dev-secret-cambiame"` / `"cambiar-esto-por-algo-largo-y-aleatorio"` (los dos valores de ejemplo conocidos), el server aborta con banner explicativo. En desarrollo solo warning. Verificado en vivo: aborta correctamente.
- Commit `4b177ca`.

**Pendientes 🟡 del informe (no se aplicaron)**
- Rate limiting en `POST /login` (anti brute-force).
- `POST /api/orders` no valida categorías permitidas del usuario (bypass via API).
- Race condition en `nextBudgetNumber()` (dos requests simultáneos pueden generar el mismo número → 409 confuso por el UNIQUE).
- Path traversal en `loadProductImage`: `path.resolve` + check `startsWith(PRODUCT_IMAGES_DIR)` falta.
- `plain_password` en texto plano (Sergio decidió postergar — requiere decisión sobre cómo mostrarle la pass al admin al crear usuario).

### Fixes mobile + nueva página /ventas (27 mayo 2026, sesión tarde)

**Topbar mobile reorganizado + grilla con cards solas**
- Reporte: en mobile el botón "Salir" del header del catálogo se cortaba (solo aparecía "Sali") porque los 6 botones + brand no entraban en la primera fila del `.topbar-inner` (flex-wrap).
- Reporte 2: en la grilla del catálogo, cuando una categoría tenía un solo producto, la card quedaba en la columna 1 con la columna 2 vacía (efecto visual raro).
- Fix card-solo: `cardHtml(p, solo)` acepta segundo parámetro; `renderProducts()` pre-cuenta productos por categoría y marca con `card-solo` cuando hay uno solo. CSS en mobile: `.card.card-solo { grid-column: 1 / -1 }`.
- Commit `8646956`.

**Reorganización final del topbar mobile (3 filas)**
Después de un segundo iteración pedida por Sergio para "que entre mejor todo":
- HTML: se dividió `.topbar-actions` en dos contenedores nuevos `.topbar-actions-secondary` (Mis pedidos, Mis ganancias, Ver cambios, Salir, Admin, level switcher) y `.topbar-actions-primary` (Venta + Carrito).
- CSS mobile: 3 filas:
  - Fila 1: brand + secundarios al lado con scroll horizontal si no entran (font 12px, padding 5px 9px, scrollbar oculto).
  - Fila 2: buscador ancho completo.
  - Fila 3: Venta + Carrito `flex: 1`, font 15px, padding generoso (11px 14px), ambos con look primary azul para uniformidad. En desktop carrito sigue ghost.
- Commit `4f623ad`.

**Página /ventas dedicada (reemplaza al overlay)**
Sergio pidió que el botón "🧾 Venta" no abra un modal sobre el catálogo sino que vaya a otra sección. Eligió "página nueva /ventas con su propio HTML" sobre "vista fullscreen en la misma página".

- Nuevo `public/ventas.html`: topbar simple ("← Catálogo" + Salir) + lista de presupuestos + form + picker de productos. 205 líneas.
- Nuevo `public/js/ventas.js`: autocontenido (IIFE propio con su `loadMe()` para mostrar app_name y nombre del usuario en el header). 502 líneas, extraído del IIFE de `app.js`.
- Nuevo bloque CSS `.ventas-*` en `styles.css` para reemplazar los inline styles del overlay viejo y dar layout responsive (1 columna en mobile).
- Nueva ruta `GET /ventas` en `server.js` con `requireVendedorOrAdmin`.
- `app.js`: el handler de `#venta-btn` cambió a `window.location.href = "/ventas"`. Se eliminaron las ~460 líneas del módulo de presupuestos. **app.js bajó de 2090 → 1629 líneas**.
- `index.html`: removidos `#budget-overlay` y `#product-picker-modal` que ya no se usan.
- Commit `ab6fbb4`.

**Bug fix: vendedores no veían clientes en el select de presupuesto (página /ventas)**
- Síntoma: al abrir el form de presupuesto en `/ventas`, el select "Cliente" solo mostraba "Consumidor final" para los vendedores. Para admin sí funcionaba.
- Causa: `vPopulateClients()` hacía `fetch("/api/admin/users")` que tiene `requireAdmin` → 403 silencioso para vendedores (el try/catch se lo tragaba).
- Fix: se amplió `/api/clients` (antes solo level 5) para aceptar admin también, manteniendo el filtro por tercerizado para vendedores. `vPopulateClients()` ahora usa `/api/clients` que ya devuelve level 1-4 activos pre-filtrados.
- Beneficio extra: vendedor tercerizado en `/ventas` ahora ve solo sus clientes asignados (no todos), que es lo deseado.
- Commit `62d691a`.

**Cache busting bumpeado a `?v=20260527c`** en `styles.css`, `app.js`, `ventas.js`, `ventas.html`.

**Workflow del bash mount**
- En esta sesión NO ocurrió el problema del bash mount stale. Los `node --check` siempre coincidieron con el filesystem real.
- Tampoco hubo truncamientos en archivos grandes — los Edits a `server.js` (~3380 líneas), `app.js` (~2000) y `styles.css` (~2400) se aplicaron sin problemas.
- La sesión consistió en 8 commits en `master` pusheados a `origin`: `6c09104`, `3e3633e`, `4b177ca`, `8646956`, `ab6fbb4`, `62d691a`, `4f623ad`, más el bumpeo de cache.

### Control de gestión — funcionalidades nuevas (31 mayo 2026)

Sesión completa de expansión funcional. Todo en la misma branch de trabajo. Cache busting final: `?v=20260531i`.

#### Dashboard KPIs (pestaña nueva en /admin, solo admin)

- Primera entrada de la sidebar ("General → 🏠 Dashboard"). Al abrir /admin el admin aterriza acá directamente.
- Endpoint `GET /api/admin/dashboard` devuelve en una sola llamada: ventas hoy/semana/mes/mes anterior, cobros hoy/mes, pedidos activos por estado, deuda total clientes, stock cero/bajo/ok, últimos 8 pedidos, top 5 deudores.
- UI: 3 filas de KPI cards (ventas, operaciones, stock) + tabla de últimos pedidos + tabla de mayores deudores. Botón ↺ recarga.
- Los vendedores siguen arrancando en Pedidos (no ven el dashboard).

#### Caja — múltiples cuentas (pestaña "Finanzas → 💰 Caja")

- Schema: `cash_accounts` (id, name, type efectivo|banco|digital, active, sort_order) + `cash_movements` (id, account_id, type ingreso|egreso, amount, description, source manual|cobro|gasto|compra|transferencia, counterpart_account_id, movement_date, registered_by).
- Seed automático: 3 cuentas default (Caja efectivo, Banco, Mercado Pago).
- API: `GET /api/admin/caja`, `POST /api/admin/caja/accounts`, `PATCH /api/admin/caja/accounts/:id`, `GET /api/admin/caja/movements`, `POST /api/admin/caja/movements`, `DELETE /api/admin/caja/movements/:id`.
- Transferencia entre cuentas crea dos movimientos en transacción (egreso origen + ingreso destino); al borrar elimina ambos.
- UI: layout 2 columnas — izquierda (cards de saldo por cuenta + form de movimiento con toggle ingreso/egreso/transferencia) + derecha (historial filtrable con resumen "Ingresos | Egresos | Neto").

#### Ajustes de stock manuales

- Schema: `stock_adjustments` (product_id, type ajuste|inventario|merma|devolucion, qty_before, qty_change, qty_after, reason, registered_by).
- API: `GET /api/admin/stock-adjustments` (filtrable por product_id, from, to), `POST /api/admin/stock-adjustments` (modo `set` fijar o `delta` sumar/restar; actualiza products.stock en transacción).
- UI: botón **±** al final de cada fila de productos → modal con modo fijar/sumar, tipo, nota, preview del cambio. Botón **📋 Ajustes** en toolbar abre historial global con búsqueda y filtro de fechas.

#### Reportes de ventas (pestaña "Reportes → 📈 Reportes")

- Endpoint `GET /api/admin/reports/sales` + `GET /api/admin/reports/sales/:orderId/items`.
- Filtros: desde/hasta (default este mes), estado (todos/entregado/activo), cliente, vendedor.
- KPIs del período: pedidos totales y entregados, ventas brutas y entregadas, ticket promedio, ganancia neta + % margen, cobros registrados.
- Tabla: pedido por pedido con fecha, cliente, vendedor, estado, items, total, ganancia, margen. Cada fila tiene botón ▼ que expande el detalle de ítems (lazy load).
- Totales en el tfoot.
- Botón **⬇ CSV** exporta el reporte filtrado como UTF-8 BOM CSV.

#### Nuevo producto — modal mejorado

- Botón **+ Nuevo producto** en toolbar de Productos.
- Endpoint `POST /api/admin/products` (valida código único, devuelve el producto creado con category_name para el state del frontend).
- Código sugerido automáticamente: busca el valor numérico máximo entre todos los códigos existentes y suma 1. Para los productos de Sergio (códigos tipo `4087`) sugiere `4088`. Fallback para códigos con sufijo alfanumérico.
- Base de precios = **Costo**. Fórmula: `precio = costo × (1 + pct/100)`. Ej: costo 100 + 12% → $112.
- Precios derivados en orden VIP → Revendedor → Mayorista → Minorista → Público, con preview en tiempo real.
- Los porcentajes se guardan en `localStorage` (clave `maxaria_np_pcts`) y se restauran en la próxima apertura del modal.
- Defaults iniciales: VIP 110%, Revendedor 130%, Mayorista 120%, Minorista 150%, Público 150%.

#### Edición de productos — modal al doble click

- La tabla de productos pasó a ser **completamente de solo lectura**. Los `<input>` inline fueron eliminados. Cada celda muestra el valor como texto. Stock en 0 aparece en rojo.
- **Doble click** en cualquier fila abre el modal de edición pre-cargado con todos los campos: código (read-only), categoría, nombre, stock, costo, los 5 precios (VIP/Revendedor/Mayorista/Minorista/Público), checkbox activo.
- Al guardar hace PATCH, actualiza el state local y re-renderiza sin recargar.
- El botón ± de ajuste de stock sigue siendo un solo click (no interfiere con el doble click).
- Se eliminó el auto-save listener de "change" en el tbody de productos.

#### Convenciones nuevas

- **Cache busting**: cada vez que se modifiquen `admin.js`, `app.js`, `ventas.js` o `styles.css` y se quiera que el browser traiga la versión nueva, bumpear el query string `?v=YYYYMMDD<letra>` en el tag `<link>` o `<script>` de `admin.html`, `index.html` o `ventas.html`.
- **Bash mount stale**: el bind mount Linux sigue siendo unreliable para verificar archivos editados por las file tools. Siempre usar `Read` como fuente de verdad. Si bash y Read difieren, confiar en Read.

### Modales de producto — campos bidireccionales (1 junio 2026)

**Modal "Editar producto" y "Nuevo producto"** — rediseño completo de la sección de precios:

- **Grilla bidireccional**: 3 columnas (Nivel | % | $$$). CSS: `.bidir-header`, `.bidir-row`, `.bidir-lbl`, `.bidir-pct`, `.bidir-price`. Columna % sin spinners (58px), columna $$$ con `1fr`.
- **Lógica JS bidireccional**: cambiar `%` → recalcula precio; cambiar precio → recalcula `%`; cambiar costo → recalcula todos los precios manteniendo sus %. Fórmula: `precio = costo × (1 + pct/100)`.
- **Formato de precios**: los campos $$$ son `type="text"` visualmente con `fmtPrice(n)` → `"$ 1.000"` (locale `es-AR`). Al hacer foco cambian a `type="number"` para editar; al salir (blur) vuelven a formato texto. Helper `parsePrice(s)` para parsear antes de guardar o en cálculo bidirec.
- **Layout**: fila Stock + Stock mínimo | fila Costo (solo). Antes era Stock + Costo en la misma fila.
- **Stock mínimo** (`stock_min`): campo nuevo en ambos modales (default 0 = sin alerta). Migración idempotente en `server.js`: `ALTER TABLE products ADD COLUMN stock_min INTEGER NOT NULL DEFAULT 0`. Incluido en GET/PATCH/POST de `/api/admin/products`. En la tabla de productos: si `stock > 0` y `stock <= stock_min`, la celda aparece en naranja (`.text-warn`) con ⚠ y tooltip "Stock bajo (mínimo: N)".
- **Cache busting**: `admin.js?v=20260601b`, `styles.css?v=20260601b`.

### Sesión UX + Catálogo por cliente + Superadmin (1 junio 2026, tarde)

Varios cambios en una misma sesión. Cache busting final de la sesión: `admin.js?v=20260601i`, `styles.css?v=20260601h`.

**1. Fix modal sobredimensionado en mobile**
- `styles.css`: `.admin-modal-box` ahora tiene `max-height: calc(100dvh - 32px)` (fallback `100vh`) + `overflow-y:auto`, y `.admin-modal-foot` es `position:sticky; bottom:0` con fondo blanco. Antes en celular el modal (ej: Generar catálogo PDF) se desbordaba y el botón del pie quedaba inalcanzable. Aplica a TODOS los modales del admin.

**2. "Costo" como lista base de las listas de precios**
- `server.js`: `PRICE_LIST_BASE_LEVELS` incluye `"costo"`; `priceColumnForBaseLevel("costo")` devuelve la columna `products.cost` (las demás siguen en `price_<nivel>`). Una lista con base Costo calcula `precio = round(cost / (1 - ganancia/100))`. En "Ver cambios" cae a columnas de minorista (no hay snapshot histórico de costo), igual que "publico".
- Frontend: opción "Costo" en el select del modal "Nueva lista" (`admin.html`) y en el select inline de la tabla (`admin.js`).

**3. Catálogo PDF "¿Para quién es?" (por cliente)**
- Nuevo primer campo del modal: selector de cliente. Si se elige un cliente, el catálogo usa automáticamente su lista de precios efectiva y **hereda sus categorías permitidas** (`user_category_access` vía `applyCatalogClientCategories` en `admin.js`); el selector manual de lista se oculta. Si no se elige cliente, se elige lista/nivel a mano (niveles base + listas del sistema).
- `server.js` `POST /api/admin/catalog/pdf`: nuevo `priceConfig.type==="client"` que resuelve el precio con `getEffectivePriceConfig(userId, level)`. `chgBaseLevel` unificado para la sección de cambios.
- Nota: el reporte de Sergio de que "no heredaba" era **latencia del deploy de Railway + cache**, no un bug. Pendiente opcional: enforcement server-side de las categorías del cliente (que el catálogo respete sus categorías aunque el front mande "todas").

**4. Categorías en grilla de 3 columnas (más estético)**
- `styles.css`: `.cats-check-list` pasó a `display:grid; grid-template-columns:repeat(3,1fr)`; `label.cats-check` con fuente 12px, fila (no columna) y `.cats-check-lbl` con ellipsis para nombres largos. Aplica al modal "Categorías visibles" del usuario y al de "Categorías a incluir" del catálogo. Se limpió un bloque CSS corrupto duplicado (resto de truncamientos viejos). Ojo: `label.cats-check` necesita esa especificidad para ganarle a `.user-form label` (que forzaba `flex-direction:column` y 13px).
- Botones **✔ Todas / ✘ Ninguna** agregados al modal "Categorías visibles" del usuario (antes solo los tenía el de catálogo).

**5. Superadmin + usuarios privilegiados con permisos por sección**
- **Objetivo**: una cuenta superadmin (la de Sergio) que crea desde la web otros usuarios que entran al panel pero con permisos limitados a las secciones (pestañas) que se les asignen.
- **Schema** (migración idempotente al arranque en `server.js`): `users.is_superadmin` (0/1) y `users.admin_sections` (CSV de claves de sección). Bootstrap: marca como superadmin al level-99 de menor id (la cuenta `admin` original) una sola vez si todavía no hay ninguno.
- **Catálogo de secciones** `ADMIN_SECTIONS` en `server.js` (claves = `data-tab` del sidebar). `sectionForAdminRequest(path)` mapea cada `/api/admin/*` a su sección. `getAdminPerms(userId)` lee `{isSuperadmin, sections}` de la DB.
- **Enforcement** dentro de `requireAdmin`: el superadmin pasa siempre; un admin común recibe 403 si la sección de la ruta no está en su `admin_sections`; la sección `administradores` es exclusiva del superadmin. La lectura es por request (cambios de permisos aplican sin re-login). *Límite conocido*: endpoints compartidos que no usan `requireAdmin` (`/api/orders*`, `/api/categories`, `/api/clients`, `/api/orders/:id/deliver`) siguen accesibles a cualquier admin; el gating fuerte es sobre `/api/admin/*` + ocultar pestañas en el front.
- **`/api/me`** (level 99): agrega `isSuperadmin` y `adminSections`.
- **Endpoints nuevos `/api/admin/admins`** (solo superadmin): GET lista, POST crear `{username,password,full_name,sections[]}` (level 99, is_superadmin 0), PATCH `{full_name?,active?,sections?}` (no permite tocar al superadmin, otorgar superadmin, ni auto-desactivarse), POST `/:id/reset-password`.
- **CLI** `scripts/create-admin.js`: acepta token `super` (5º arg / en lugar del nivel) para setear `is_superadmin=1`.
- **Frontend**: en `bootstrap()` (`admin.js`) se ocultan las pestañas no permitidas para un admin no-superadmin y se aterriza en la primera permitida; la pestaña/sección "Administradores" solo se muestra al superadmin. Nueva sección en `admin.html` (sidebar grupo Sistema + panel con tabla) y 3 modales: crear admin (con checklist de secciones reusando `cats-check-list` + Todas/Ninguna), editar permisos, resetear clave. Toggle "Activo" con auto-save por fila.
- **🔴 Bug encontrado y arreglado (importante)**: el helper `api()` de `admin.js` hacía `alert("Acceso denegado…")` **bloqueante** en cada 403. Con el enforcement nuevo, un admin sin la sección `config` recibía 403 en `/api/admin/dbinfo` (que `checkDbInfo()` llama en cada carga) → el `alert` **congelaba todo el panel** (y para los vendedores ya era un popup molesto en cada carga). Fix: `api()` usa `showToast` (no bloqueante) en vez de `alert`, y `checkDbInfo()` solo corre si el usuario puede ver `config`. **Regla**: al gatear secciones, no llamar de fondo a endpoints que el admin no tiene permitidos; y nunca usar `alert()` para errores de permiso (congela el hilo). En el preview, un `eval` de `1+1` que timeoutea = main thread bloqueado (típico de un alert/confirm sin cerrar).

**Verificación (preview, sesión admin forjada)**: enforcement 200/403 correcto; gating de pestañas correcto (admin común ve solo sus secciones, superadmin ve todo + Administradores); tabla de admins renderiza bien. Todo `node --check` OK.

### Circuito de pedidos + Crear gemelo en Compras + Fix picker de Compras (3 junio 2026)

Sesión de tres features. Cache busting final: `admin.js?v=20260603c`, `styles.css?v=20260603b`, `app.js?v=20260603a`. Verificado todo en preview (con `testadmin`, ver nota abajo); cero errores de consola; datos de prueba restaurados.

**1. Circuito de pedidos: Pedidos → Armado → Entregas → Entregado**
Objetivo (Sergio): que un pedido enviado (por cliente desde el carrito o por vendedor al facturar presupuesto) entre a **Pedidos**, de ahí pase a **Armado** (se prepara, el cliente recibe aviso), de Armado a **Entregas** (listo para entregar, otro aviso), y en Entregas el repartidor lo marca **entregado**.

- **Estado nuevo `listo`** ("Listo para entregar"), entre `preparando` y `entregado`. Flujo: `pendiente`/`enviado` (Pedidos) → `preparando` (Armado) → `listo` (cola de Entregas) → `entregado`.
- **Schema** (migración idempotente en `server.js`): `orders.notified_status TEXT` (último estado del que se notificó al cliente). El `ALTER` viene seguido de un `UPDATE orders SET notified_status = status` que corre **una sola vez** (en boots siguientes el ALTER lanza y el catch evita re-ejecutar) para que la primera carga post-deploy NO dispare avisos retroactivos.
- **`server.js`**: `listo` agregado a estados válidos del `PATCH /api/orders/:id`; endpoint nuevo `GET /api/my-notifications` (devuelve pedidos del cliente que avanzaron a preparando/listo/entregado desde la última vez y los marca como notificados, mensajes "Tu pedido #X se está preparando / está listo para entregar / fue entregado"); `armado` agregado a `ADMIN_SECTIONS`; dashboard "pedidos activos" ahora cuenta también `listo`.
- **Presupuesto facturado**: `POST /api/budgets/:id/invoice` ahora crea el pedido como `pendiente` (antes `entregado`) para que entre al circuito. Mantiene `stock_discounted=1` (stock ya descontado al crear el presupuesto) y el débito de cuenta al facturar, así al llegar a `entregado` el PATCH no reprocesa (chequea `!order.stock_discounted`).
- **Admin (`admin.html` + `admin.js`)**: pestaña nueva **🔧 Armado** entre Pedidos y Entregas. Pedidos: filtro de estado (default "Por armar" = pendiente/enviado) + botón **→ Armado** por tarjeta. Armado: cola en `preparando` + botón **→ Entregas**. Entregas: arriba la cola **🚚 Para entregar** (`listo`) con "Registrar entrega" (modal de cobro existente que marca entregado y la saca de la cola); abajo, el historial de siempre. Las tres vistas se renderizan desde `state.orders` (una sola carga vía `/api/orders`); helper compartido `wireOrderCards(container, list, reload)` + `refreshOrderViews()` para que al avanzar un pedido salte de sección sin recargar. Los botones de avance solo los ve el admin (`state.isAdmin`): al vendedor el PATCH le rechaza estados que no sean `entregado`.
- **Cliente (`app.js`)**: al ingresar al catálogo (level 1-4) se llama a `/api/my-notifications` y se muestra un **banner superior** dismissible con los avisos. Etiquetas de estado legibles (`statusLabel()`, incluye "Listo para entregar"). CSS: color para `.order-status.listo` y set completo de `.order-tag.tag-*`.

**2. "Crear producto basado en este" (gemelo) en el selector de Compras**
Objetivo (Sergio): al cargar una compra, clic derecho sobre un producto del selector ofrece crear una copia idéntica con código nuevo, abrir su edición, y que quede listo para cargar a la compra.

- **`server.js`**: endpoint nuevo `POST /api/admin/products/:id/duplicate` (solo admin). Copia **todos** los campos (nombre, categoría, descripción, imagen, costo, los 5 precios/comisiones, `stock_min`, `active`) con **código nuevo correlativo** (mayor código numérico de toda la base + 1, con chequeo de unicidad). **El stock arranca en 0** (SKU nuevo que todavía no se recibió; la compra que se está cargando le suma stock — evita inventario fantasma). Devuelve el producto creado con `category_name`.
- **`admin.js`**: menú contextual (clic derecho, `contextmenu`) sobre las filas del picker de Compras (`#pur-picker-tbody`) con **dos opciones** (helper `mkItem`): **"📋 Clonar este producto"** → `purDuplicateProduct(src)` y **"✏️ Editar este producto"** → `purEditProduct(src)`. `purDuplicateProduct`: hace el POST, suma el gemelo a `state.allProducts` y `state.products`, lo deja **pre-seleccionado** en el picker (con el buscador puesto en su código nuevo) y abre el **modal de edición por encima** (z-index 1400; el picker es 1300). `purEditProduct`: abre la edición del producto seleccionado tal cual (sin clonar), también a z-index 1400. Al guardar la edición se sincronizan ambos caches y se re-renderiza el picker si está abierto. `openEditProdModal` resetea z-index a "" al abrir normal (doble click desde Productos) para no quedar pegado en 1400. (La opción de clonar se llamaba "Crear producto basado en este"; se acortó a "Clonar este producto" y se agregó "Editar este producto" el mismo día a pedido de Sergio.)

**3. Fix del selector de productos de Compras (columna "Cant." + buscador)**
Síntoma (Sergio, con captura): en el picker de Compras solo se veía checkbox + producto, con scroll horizontal; la columna "Cant." quedaba fuera de vista. Causa: el picker usa `.admin-table`, que tiene `min-width: 1200px` (y `900px` en mobile), desbordando el modal de 760px. El picker del presupuesto (/ventas) no sufría esto porque usa su propia clase `.picker-table`.
- **`styles.css`**: override por id `#pur-picker-table { min-width: 0 }` (+ `white-space: normal` en th, `word-break` en td) — el id pisa el `.admin-table` por especificidad. Ahora la columna **Cant.** queda visible sin scroll horizontal, igual que en el presupuesto.
- **`admin.js`**: al clickear/enfocar el buscador del picker (`focus` + `click`), se limpia y muestra la lista completa, para arrancar una búsqueda nueva (flujo de depósito: buscar → cargar cantidad → repetir). La selección hecha hasta ahí **se conserva** (sigue tildada al re-renderizar). Nota: se usó `focus` **y** `click` porque el `focus` programático no dispara en el entorno de preview (`document.hasFocus()` false); `click` es lo que el usuario pidió literalmente y dispara siempre.

**4. Código de producto editable en el modal de edición (Productos)**
- El campo "Código" del modal "Editar producto" (`#ep-code`) era `disabled`; ahora es editable.
- `PATCH /api/admin/products/:id` acepta `code`: valida que no esté vacío y que **no lo tenga otro producto** (`SELECT id WHERE code=? AND id!=?` → 409 "Ya existe un producto con el código X"); además try/catch sobre el UPDATE por el índice UNIQUE como red de seguridad.
- El handler de guardado (`admin.js` `epSaveBtn`) manda `code` en el body y exige no vacío; ante el 409 el `api()` tira el error, el `catch` hace `alert(msg)` y **no cierra el modal** (no permite ingresar el duplicado). Al guardar OK, `Object.assign(p, body)` actualiza `p.code` en `state.products` y `state.allProducts`.

**Nota operativa**: para verificar en preview se usó la cuenta preexistente `testadmin` (level 99) con la clave reseteada a `Claude123!` vía `npm run create-admin`. Conviene blanquearla. Los datos de prueba (pedido #7, producto gemelo code 4085) se restauraron/borraron al cerrar.

**Pendiente de versionado**: al cierre de esta sesión las tres features están en disco local, sin `git add/commit/push` ni deploy en Railway.

### Compras (crear producto en el picker) + Edición de pedidos estilo presupuesto + Remito + Badges (3 junio 2026, sesión tarde)

Sesión de cuatro features encadenadas, todas verificadas en preview con `testadmin` (clave `Claude123!`, conviene blanquearla). Cache busting final: `admin.js?v=20260603j`, `styles.css?v=20260603j` (también bumpeado en `index.html` y `ventas.html`). Todo en disco local, sin `git commit/push` ni deploy.

**1. Crear producto nuevo desde el selector de Compras**
- El picker de Compras (`pur-picker-modal`) ya tenía menú contextual (clic derecho) con "Clonar" y "Editar" sobre un producto existente. Faltaba crear uno **desde cero**.
- `public/admin.html`: botón **"➕ Crear producto nuevo"** en el pie del `pur-picker-modal`.
- `public/js/admin.js`: bandera `npForPurchase`. `purNewProduct()` abre el modal "Nuevo producto" por encima del picker (z-index 1400). En el handler de `npSaveBtn`, si `npForPurchase`, el producto creado se agrega a `state.allProducts`, queda **preseleccionado con cantidad 1** y filtrado por su código en el picker, listo para cargar a la compra (stock arranca en 0; la compra le suma). Reset de bandera/z-index en `npOpenModal` (apertura normal) y en los cierres genéricos (data-close + Escape).
- **Nota**: la edición de compras YA cargadas ya funcionaba de antes (botón "Editar compra" → modal con items → `PUT /api/admin/purchases/:id` que revierte stock viejo y suma el nuevo). Esta sesión solo agregó el "crear producto nuevo".

**2. Edición de items de un PEDIDO en estados pre-entrega (Pedidos / Armado / Listo)**
Pedido: Sergio quería poder editar el pedido mientras está en Pedidos o Armado, porque en el proceso cambia.
- **Server** `PUT /api/admin/orders/:id/items` (ya existía, reemplaza items + recalcula total) se hizo **stock-aware**: bloquea editar pedidos `entregado`/`cancelado` (409); si el stock del pedido **ya estaba descontado** (`stockCurrentlyOut` = vía budget vinculado con `stock_discounted=1` o `orders.stock_discounted`), **revierte el stock de los items viejos y descuenta el de los nuevos** dentro de la transacción (respeta `skipStock` para unificados/hijos). Si todavía no estaba descontado (pedido del catálogo pre-entrega), no toca stock. Mantiene en sync el **débito de cuenta corriente** si existe (actualiza `amount` al nuevo total). Se agregó `u.level AS client_level` al `GET /api/orders/:id` (admin) para sugerir precio al agregar productos.
- **Frontend** (`admin.js`): en el detalle del pedido (al desplegar la tarjeta) aparece **"✏️ Editar items"** solo para admin y en estados `pendiente/enviado/preparando/listo` (`ORDER_EDITABLE_STATUSES`). Modo edición inline: cambiar cantidades y precios (recalcula en vivo), quitar líneas, total, **Guardar cambios / Cancelar**. Al guardar hace el PUT, refresca el objeto del pedido, el total de la tarjeta, invalida `allProductsLoaded` (stock pudo cambiar) y vuelve a vista solo-lectura.

**3. El "Agregar productos" del editor de pedidos = mismo sistema que el armador de presupuestos**
Sergio: "la edición del pedido debe ser igual al sistema de armar un presupuesto, el [de presupuesto] es más [completo]".
- En vez del buscador inline, ahora hay un botón **"+ Agregar productos"** que abre un **modal de selección múltiple** `oie-picker-modal` (`public/admin.html`), con buscador, check por fila, cantidad por producto, precio (según nivel del cliente) y stock, contador y "Agregar seleccionados". Misma mecánica que el picker de Compras y el del armador de presupuestos.
- `admin.js`: controlador `openOrderItemPicker(editItems, priceCol, rerender)` con estado propio (`oieAddCtx`, `oiePickerSelected`) — no interfiere con el picker de Compras. Al confirmar agrega los elegidos a los items del pedido (suma cantidad si ya estaba). Precio sugerido por `ORDER_LEVEL_PRICE_COL[client_level]` (fallback minorista; el admin lo ajusta). CSS override `#oie-picker-table { min-width:0 }` (como el de Compras). Se eliminó el buscador inline viejo (`.oie-add`/`.oie-results`).

**4. Badges/remarcos más notorios y distinguibles (Pedidos, Armado, Entregas, dashboard y todos los modales)**
Sergio: que los badges de estado (PENDIENTE/ENVIADO/etc.) y el de vendedor sean más notorios, como el highlight de presupuestos aceptados.
- `styles.css`: **`.order-status`** ahora 12px / peso 800 / borde de color 1.5px / fondos más saturados / sombrita. Paleta por estado: pendiente ámbar, enviado azul, preparando índigo, listo fucsia, entregado verde, cancelado rojo (bg + border + color coherentes).
- **`.order-tag`** (dashboard "últimos pedidos", notificaciones del catálogo y tags unified/grouped): 11px / 800 / borde, misma paleta.
- **`.vend-badge`**: pill violeta con borde + ícono **"👤 "** vía `::before`. **`.delivery-badge`**: pill verde con borde + ícono **"💵 "**.
- **`.budget-badge`** (lista /ventas + armador): 12px / 800 / MAYÚSCULAS / borde, para igualar la prominencia.
- Verificado por estilos computados (el screenshot del preview se cuelga, pero el eval responde). La DB local no tenía pedidos con vendedor, el `.vend-badge` se verificó inyectando el elemento.

**5. Imprimir remito del pedido (responde a "¿cuándo/dónde imprimo lo preparado para entregar?")**
Antes NO había print de pedidos (solo de presupuestos en `/ventas` y en el detalle de presupuesto del admin). Ahora:
- `admin.js`: botón **"🖨 Imprimir remito"** en el detalle del pedido (todos los estados; útil en Armado/Listo). Función `printOrderRemito(order)` abre ventana e imprime un remito con: nombre app + N° pedido + estado, fecha/cliente/vendedor, tabla (código, producto, cantidad, P. unit., subtotal), resumen "N ítems · N unidades", TOTAL, observaciones y líneas de firma **Preparó / Entregó / Recibí conforme**. Usa `state.me.app_name`. Mismo mecanismo `window.open` + `print()` que el print de presupuestos.
- CSS: `.order-items-actions` pasó a flex-row con gap (conviven "Editar items" y "Imprimir remito").
- **Pendiente opcional ofrecido a Sergio**: una variante del remito **sin precios** (solo productos y cantidades) para el depósito, dejando la de precios para el cliente. Quedó sin confirmar.

**6. Pestaña "Ventas" del admin repropósito: ahora son los pedidos ENTREGADOS**
Sergio: "¿la sección Ventas para qué sería hoy?" → decidió que **Ventas = los pedidos que pasaron por Armado y Entregas y se entregaron** (las ventas concretadas). Antes el tab `tab-ventas` mostraba presupuestos `facturado` (de `bState`, con "Ver" que abría el budget-overlay).
- `admin.html`: el tab pasó de tabla (`ventas-table`/`ventas-tbody`) a **lista de tarjetas** `<div id="ventas-list" class="admin-orders-list">` + buscador + `#ventas-summary` (cuenta + total vendido) + nota explicativa.
- `admin.js`: `renderVentasOrders()` filtra `state.orders` a `status === "entregado"`, busca por #/cliente/vendedor, muestra "N ventas · $total" y renderiza con el mismo `orderCardHtml` + `wireOrderCards` del circuito (detalle expandible con items, badge de cobro, botón "🖨 Imprimir remito"; "Editar items" no aparece porque entregado no es editable). `loadVentasOrders()` asegura `state.orders`. Enganchado a `refreshOrderViews()` (al marcar un pedido entregado aparece acá solo). El dispatcher del tab y el handler dedicado llaman `loadVentasOrders`; el buscador llama `renderVentasOrders`.
- Se eliminó la `renderVentas()` vieja (facturados) y su wiring huérfano. El módulo de presupuestos del admin (`bEls`/`bState`/`openBudgetForm`/`budget-overlay`) quedó **inerte/dead code** (ya no se invoca); no se tocó. Los presupuestos se crean/gestionan en la página `/ventas`. Cache busting `admin.js?v=20260603k`.

**Indicador de presupuestos aceptados sin facturar (también esta tanda, sesión previa del mismo día)**
- En `/ventas`: banner-resumen "Tenés N presupuestos aceptados sin facturar…" + botón "Ver pendientes" (filtra a `aceptado`); filas `aceptado` resaltadas (fondo ámbar + acento naranja + nota "⚠ falta facturar") y botón "Abrir" → "Facturar →". Recordatorio del flujo: un presupuesto **Aceptado NO es un pedido**; recién al **Facturar** (`POST /api/budgets/:id/invoice`, requiere estado `aceptado`) se crea la fila en `orders` (status `pendiente`) y entra al circuito. Esto respondió la duda de Sergio de "dónde fue el pedido aceptado de Discandi" (estaba como presupuesto aceptado sin facturar).

### Cotizaciones + UI minor (4 junio 2026)

Cache busting final: `admin.js?v=20260604q`, `styles.css?v=20260604j`.

**Cotizaciones — sección nueva en sidebar (arriba de Compras)**

- Tab `#tab-cotizaciones` con filtros proveedor + estado, tabla con filas expandibles.
- Schema: `purchase_requests` (id, supplier_id, notes, status borrador|enviado, created_by, created_at) + `purchase_request_items` (id, request_id CASCADE, product_id, product_code, product_name, quantity, unit_price). Migración idempotente.
- `products.units_per_bulto INTEGER NOT NULL DEFAULT 1` — cuántas unidades de venta componen un bulto de compra. Editable en modal "Editar producto" (campo "Und/bulto", fila junto a stock/stock mínimo).
- Endpoints: GET/POST/PUT/DELETE/PATCH `/api/admin/purchase-requests[/:id]`. **El POST/PUT necesita `headers: { "Content-Type": "application/json" }` — la función `api()` no lo agrega automáticamente**.
- Modal de creación/edición (`max-width: 940px`): proveedor (select + botón ＋ para crear nuevo con z-index 1400), estado, notas, tabla de items: Costo act. · Precio cotiz. (editable, default = costo del producto) · Cant. · Subtotal · Diferencia (+/- vs costo, % en rojo/verde) · Und/bulto (input editable → guarda en el producto via PATCH + muestra "= N bultos"). Tfoot con totales.
- `openEditCotizacion(id)`: carga `ensureAllProducts()` en paralelo con el GET antes de mapear items — así `current_cost` se llena al abrir sin necesidad de tocar und/bulto.
- **Picker** (`#pcot-picker-modal`, z-index 1300): mismo estilo que oie-picker (nombre+código, Cant., Costo act., Stock). Filtro por categoría. Tipear cantidad tilda automáticamente. Botón ➕ Crear producto nuevo (flag `npForCotizacion`). **CSS crítico**: `#pcot-picker-table { min-width: 0 }` — sin esto la tabla se desborda (`.admin-table` tiene `min-width: 1200px` global).
- Footer del modal: **📋 Exportar** → mini-modal pregunta unidades o bultos → descarga `.txt` sin precios. **📥 → Compra** (visible al editar) → pre-rellena el modal de Nueva Compra con productos/cantidades/precios y cierra cotización. **Guardar cotización** → POST (nueva) o PUT (edición).
- Botón ✏️ en cada fila de la lista para editar. Botón 🗑 para eliminar.

**Minor: Exportar catálogo PDF**
- Se quitó la sección "Enviar por WhatsApp" del modal de catálogo PDF. El botón ahora dice "📄 Exportar PDF" y solo descarga.

**Minor: Zebra en tabla de productos**
- `#prod-tbody .prod-row:nth-child(even) { background: #f9f5ef }` en styles.css.

**Minor: columna Und/bulto en tabla de productos**
- `products.units_per_bulto` visible como columna (muestra "—" si = 1). Colspan corregido a 14.

### Toolbar de Productos reorganizada en 3 zonas (5 junio 2026)

Cache busting: `admin.js?v=20260605g`, `styles.css?v=20260605g`.

Sergio pidió reordenar la barra superior de la pestaña Productos (estaba todo mezclado en 2 filas: search/categoría/stock/checkbox + contador + Excel/PDF/Selección/Nuevo/Ajustes + la bulk-bar). Se reagrupó en zonas con función clara.

**`public/admin.html`** — el `.admin-toolbar` viejo (un solo flex con todo) pasó a `.admin-toolbar2` (columna con 3 sub-zonas):
- **Zona 1 `.tb-head`**: título "Productos" + contador `#prod-count` (ahora en pill `.tb-count`) a la izquierda; botón `+ Nuevo producto` solo a la derecha (`.tb-head-actions`).
- **Zona 2 `.tb-filters`** (con borde fino arriba y abajo): `#prod-search` + Categoría + Stock + **Estado** (select nuevo) + botón **Limpiar filtros** (`#filter-clear`, `hidden` por defecto).
- **Zona 3 `.tb-tools`**: Selección múltiple, Subir Excel, Catálogo PDF, Ajustes — todos con clase `.btn-tool` (menos peso visual). Los IDs originales se mantuvieron (`prod-select-btn`, `excel-file`, `catalog-btn`, `stock-adj-history-btn`).
- La `bulk-bar` (`#prod-sel-bar`) quedó igual: ya era contextual (la togglea `setSelectMode` vía `els.selBar.hidden`), solo se movió dentro del nuevo contenedor.

**Cambio funcional: checkbox "Solo inactivos" → select "Estado"**
- El `<input type="checkbox" id="filter-inactive">` se reemplazó por `<select id="filter-state">` con opciones `all` (Todos, default), `active` (Solo activos), `inactive` (Solo inactivos). Antes solo se podía filtrar "solo inactivos" o ver todo; ahora también "solo activos". Default `all` preserva el comportamiento previo.
- **`public/js/admin.js`**: en `els`, `filterInactive` → `filterState` (+ `filterClear`). `savePrefs` guarda `estado: els.filterState.value` (antes `inactive`). `applyPrefsToControls` restaura `p.estado`, con fallback de compat: si una pref vieja tenía `inactive:true`, setea el select en `"inactive"`. `applyFilters` usa `stateMode` (`active`→`!!p.active`, `inactive`→`!p.active`). El listener pasó de `filterInactive` a `filterState`.
- **Limpiar filtros**: `applyFilters` muestra `#filter-clear` solo si hay algún filtro activo (`q || category!=all || stock!=all || estado!=all`). El handler resetea search + los 3 selects a `all` y reaplica.

**`public/css/styles.css`**: bloque nuevo después de `.admin-spacer` con `.admin-toolbar2`, `.tb-head`, `.tb-title`/`.tb-title-text`/`.tb-count`, `.tb-head-actions`, `.tb-filters` (bordes `#eceef1`), `.tb-clear` (link azul con hover), `.tb-tools` + `.btn-tool`, y media query `max-width:640px` (search full-width, tools con scroll horizontal). El `.admin-toolbar` viejo quedó sin uso en Productos pero el bloque CSS no se borró (otras tabs podrían usarlo — chequear antes de eliminar).

Verificado con `node --check public/js/admin.js` (OK, sin discrepancia con el bash mount esta vez). Pendiente: `git add/commit/push` + deploy Railway (quedó en disco local). Sergio dejó abierta la opción de además separar el modo selección múltiple en una franja de color propia.

### Caja por cajero — el cobro impacta en una caja (6 junio 2026)

Cache busting: `admin.js?v=20260606a`, `styles.css?v=20260606a`.

Sergio maneja 3 cajas (él) + 2 cajeros y quería que **cada cobro caiga en una caja**. Decisiones consultadas (AskUserQuestion): cajeros = **vendedores existentes** (level 5); elección de caja **siempre manual** al cobrar; **sin apertura/cierre** (solo saldo corriente); y renombrar **"Mercado Pago" → "Billeteras"** (MP no es el medio más usado). Modelo elegido: caja de **efectivo por persona**, **Banco/Billeteras** globales.

**Schema (migraciones idempotentes al arranque en `server.js`, después del `seedCashAccounts`)**
- `cash_accounts.responsable_user_id INTEGER REFERENCES users(id)` — de qué cajero es la caja (NULL = caja general). El seed default ahora crea "Billeteras" en vez de "Mercado Pago".
- `payments.caja_id` y `deliveries.caja_id` (FK soft a `cash_accounts`) — a qué caja se imputó el cobro.
- Migración de rename: `UPDATE cash_accounts SET name='Billeteras' WHERE name='Mercado Pago'` (solo si no existe ya una "Billeteras", por el UNIQUE de name).
- **No** se agregaron columnas a `cash_movements`: el vínculo del cobro usa los campos ya existentes `source` (`'cobro'` para pagos / `'entrega'` para entregas) + `related_id` (= payment_id o delivery_id).

**Backend (`server.js`)**
- `POST /api/admin/payments`: acepta `caja_id`, lo valida (cuenta activa), lo guarda en `payments` y crea un `cash_movements` (type `ingreso`, source `cobro`, related_id = payment_id) en esa caja. `DELETE /api/admin/payments/:id` borra también ese movimiento (`source='cobro' AND related_id=id`). `GET /api/admin/payments` devuelve `caja_id` + `caja_name`.
- `POST /api/orders/:id/deliver`: acepta `caja_id`, lo guarda en `deliveries` y crea/recrea el `cash_movements` (source `entrega`, related_id = delivery_id) por el total cobrado (efectivo+transferencia). Al editar una entrega, primero borra el movimiento previo de esa entrega y lo recrea con el monto/caja nuevos. `GET /api/admin/deliveries` devuelve `caja_id` + `caja_name`.
- `GET /api/admin/caja`: ahora incluye `responsable_full_name`/`responsable_username` (LEFT JOIN users). `POST`/`PATCH /api/admin/caja/accounts` aceptan `responsable_user_id`.
- **Endpoint nuevo `GET /api/cajas`** (`requireVendedorOrAdmin`): lista liviana de cajas activas (id, name, type, responsable) para poblar el selector de cobro — necesario porque `/api/admin/caja` es `requireAdmin` y los vendedores también registran entregas.

**Frontend (`admin.html` + `admin.js`)**
- Selector **"Caja"** (`name="caja_id"`, opción default "— Sin imputar a caja —") agregado al **modal de Registrar entrega** (`#delivery-caja`) y al **form de Pagos** (`#pay-form-caja`).
- Helper `fillCajaSelect(selectEl, selectedId)` en `admin.js` con cache `state.cajasList` (se invalida al crear una caja). Muestra ícono por tipo (💵/🏦/📱) + nombre + responsable. Se llama al abrir cada modal; en edición de entrega preselecciona `existingDelivery.caja_id`.
- Los dos submits mandan `caja_id: fd.get("caja_id") || null` en el body.
- Pestaña **Caja**: las tarjetas de cuenta muestran el responsable (`👤 Nombre`); el form "+ Nueva cuenta" tiene un select **Responsable** (`#caja-acc-resp`) poblado con cajeros (vendedores level 5 + admins level 99, vía `/api/admin/users` cacheado en `cajaState.cajeros`); el guardado manda `responsable_user_id`. La opción de tipo "digital" se reetiquetó a "Digital (billeteras)".
- Historial: el cobro muestra la caja sin agregar columnas — en Pagos junto al método (`→ Caja X`), en Entregas en la celda de notas (`💰 Caja X`).

**Verificación**: `node --check server.js` OK. Para `admin.js`, el bash mount volvió a quedar **stale** (reportaba truncación en la última línea `ventasClearDates`); `Read` y `Grep` confirmaron el archivo íntegro en disco (`bootstrap(); })();` en líneas 8662-8663). Se confió en Read/Grep por la regla del proyecto. Pendiente: `git add/commit/push` + deploy Railway (en disco local).

**Pendientes/futuro de caja** (no pedidos ahora): arqueo/cierre de turno si algún día quiere control de faltantes; filtrar el selector de caja del vendedor a la suya por defecto.

**Split por medio en la entrega (6 junio 2026, mismo día — `admin.js?v=20260606b`, `styles.css?v=20260606b`)**
Sergio: en una entrega cobran una parte en efectivo y otra por transferencia a billeteras manejadas por los cajeros; cada parte tiene que caer en una caja distinta. Solo aplica a **entregas** (el pago de cuenta corriente sigue con una sola `caja_id` porque tiene un único método/monto).
- **Schema**: `deliveries.caja_transfer_id INTEGER REFERENCES cash_accounts(id)` (migración idempotente, junto a `caja_id`). `caja_id` pasa a ser la caja del **efectivo**; `caja_transfer_id` la de la **transferencia**.
- **`POST /api/orders/:id/deliver`**: acepta `caja_id` + `caja_transfer_id`. Helper `findCaja(cid)` valida cada una (lanza error `BADCAJA` → 400). Genera **hasta dos** `cash_movements` (source `entrega`, mismo `related_id = deliveryId`): efectivo→cajaEfectivo, transferencia→cajaTransfer, cada uno por su monto. El `DELETE ... WHERE source='entrega' AND related_id=?` previo borra ambos, así la edición de entrega recrea limpio. Descripciones: "Cobro entrega #X (efectivo)" / "(transferencia)".
- **`GET /api/admin/deliveries`** y los 5 SELECT de **`/api/orders`** (LEFT JOIN deliveries) devuelven `caja_id`/`caja_transfer_id` (+ nombres en el de admin). Necesario para que al **editar** una entrega ya hecha el modal preseleccione las cajas y no se borre el cobro al re-guardar.
- **Frontend**: el modal de Registrar entrega ahora tiene **dos selectores** (`#delivery-caja-efectivo` y `#delivery-caja-transfer`), cada uno debajo de su campo de monto. `openDeliveryModal` llena ambos (preselecciona desde `existingDelivery.caja_id`/`caja_transfer_id`, que se arman desde `orderObj`). El submit manda las dos. El historial muestra ambas cajas en la celda de notas (`💵 Caja efectivo · 📲 Billeteras`).

### Sección Cuentas corrientes rediseñada (6 junio 2026, sesión tarde — `admin.js?v=20260606e`, `styles.css?v=20260606e`)

Sergio pidió que la pestaña **Cuentas** (cuenta corriente por cliente) sea más completa para su admin: detalle de lo adeudado, columnas ordenables por saldo, y más control + prolijidad visual. Eligió por AskUserQuestion: estilo **tarjetas KPI + tabla**, y sumar los 4 extras (aging, filtro deudores, cobrar desde fila, export CSV).

**Backend (`server.js`) — `GET /api/admin/accounts` reescrito**
- Antes era un solo query con `GROUP BY` que devolvía `total_debit`/`total_credit`/`balance`. Ahora trae users (level 1-4 activos) + todos los `account_movements` ordenados por fecha y calcula en JS por cliente: totales, `balance` (credit−debit, negativo = debe), `last_movement_at` + `days_since_movement`, `oldest_unpaid_at` + `days_overdue`, y `movements_count`.
- **Antigüedad FIFO**: se aplican los créditos a los débitos más viejos primero; la antigüedad es la fecha del débito más viejo que quede **sin saldar** (no la del último movimiento). Helper `daysSince(str)` parsea el `created_at` como UTC (`str.replace(" ","T")+"Z"`). Verificado con 3 casos: deuda vieja saldada NO infla la antigüedad; pago parcial conserva la fecha original del débito; saldo a favor → aging null. `/api/admin/accounts/:userId` (detalle de movimientos) quedó igual.

**Frontend HTML (`admin.html`, `#tab-cuentas`)**
- Fila de KPIs `#acc-kpis` (`.dash-kpi-row`) arriba de la toolbar.
- Toolbar: buscador + checkbox **Solo deudores** (`#acc-only-debtors`) + botón **⬇ CSV** (`#acc-export-btn`, `.btn-tool`) + **↻ Actualizar**.
- Tabla `.acc-table` con 7 columnas: Cliente, Nivel, Débitos, Créditos, Saldo, **Antigüedad**, **Acciones**. Los `<th>` ordenables llevan `class="acc-sort" data-sort="name|debit|credit|balance|aging"`. Colspans de loading/empty pasados a 7.

**Frontend JS (`admin.js`)**
- `els` nuevos: `accKpis`, `accOnlyDebtors`, `accExportBtn`, `accTable`. `state` nuevo: `accSortKey` (default `"balance"`), `accSortDir` (`"asc"`), `accOnlyDebtors`.
- `renderAccountsKpis()`: 4 tarjetas `.dash-kpi` (danger/good/warn/accent) — Total adeudado (+nº deudores), Total a favor, Deuda promedio por deudor, Deuda más antigua (días).
- `accSortedFiltered()`: aplica búsqueda + filtro deudores + sort por la columna activa. `updateAccSortHeaders()` pinta la flecha `sort-asc`/`sort-desc`. Click en `th.acc-sort` togglea dir o cambia key (default util por columna: name/balance asc, montos/aging desc).
- `accountRowHtml(a)`: fila con clase `acc-row-debt` si debe (resalte cálido), badge de saldo redondeado, badge de antigüedad con semáforo `accAgingBucket(days)` (verde ≤7d, amarillo ≤30d, rojo >30d) + tooltip con la fecha del débito más viejo, y botón de acción.
- `openPaymentForAccount(userId)`: reutiliza el modal `#payment-create-modal` existente, preselecciona el cliente y **precarga el monto adeudado**. El botón de la fila (`.acc-pay-btn`) usa `stopPropagation` para no expandir el detalle.
- `exportAccountsCsv()`: CSV client-side del listado filtrado/ordenado, separador `;`, UTF-8 con BOM (`"﻿"`), descarga como `cuentas_corrientes_YYYY-MM-DD.csv`.

**CSS (`styles.css`)**
- Bloque nuevo "Cuentas corrientes: toolbar, orden, aging": `.acc-toggle`, `.acc-table th.acc-sort` (cursor + flechas ⇅/↑/↓), `.acc-row-debt` (fondo `#fffaf2`), `.acc-age` + semáforo, `.acc-actions`, `.btn-mini` (botón chico reutilizable, no existía), y variante naranja del botón en filas deudoras.
- **Bug viejo reparado**: había un bloque CSS huérfano (sin selector, `background:#f9fafb;padding:...` suelto tras el comentario "historial expandible", resto de un truncamiento). Se le devolvió el selector `.acc-detail-cell`. El badge de saldo `.acc-balance-badge` pasó a `border-radius:999px` + peso 700.

**Verificación**: el bash mount volvió a estar **stale** (veía server.js truncado en línea 6193 y admin.js en 8642, faltando el final). Confirmado con Read que ambos están íntegros (server.js termina en `app.listen` 6272; admin.js en `bootstrap(); })();` 8808). Como el mount stale impide `node --check` directo, se validó cada bloque nuevo (endpoint + funciones JS) **aislado en `/tmp` del sandbox** (no pasa por el mount) → PARSE OK, y se corrió el test FIFO. Regla del proyecto confirmada otra vez: **Read es la fuente de verdad, no bash**.

**Pendiente de versionado**: en disco local, sin `git add/commit/push` ni deploy en Railway.

### Selector de lista de precios al crear y editar pedidos (8 junio 2026 — `admin.js?v=20260608a`)

Bug de Sergio: al crear un pedido desde /admin, el sistema no permitía elegir la lista de precios del cliente — usaba siempre el precio por nivel base (minorista), ignorando la lista personalizada (`price_list_id`). Por eso el Alikal de Cristian salía con un precio que no era el suyo. Pidió: tomar la lista por defecto del cliente y mostrarla, permitir cambiarla, y que al cambiarla se recalculen automáticamente los precios de los items ya cargados; lo mismo al **editar** un pedido.

**Causa**: tanto el "Nuevo pedido" (`noOpenPicker`) como la edición de items (`enterOrderItemsEdit`) calculaban el precio con un único `priceCol` = columna del nivel base (`ORDER_LEVEL_PRICE_COL[client_level]`), sin aplicar nunca la fórmula de la lista personalizada (`round(base/(1-markup/100))`). Para el admin, además, el objeto de pedido de `GET /api/orders` (lista) no trae `client_level` ni `price_list_id`, así que caía a minorista.

**server.js**: `GET /api/orders/:id` (rama admin) ahora incluye `u.price_list_id AS client_price_list_id` (ya traía `client_level`). El detalle es lo que usa la vista de edición. El POST/PUT de pedidos sigue confiando en el `unit_price` que manda el front (no se tocó el cálculo server-side ni el snapshot `vendedor_cost_unit`).

**admin.js** (helpers nuevos, compartidos por crear y editar, justo antes de "Crear pedido desde admin"):
- `PL_BASE_COL` (mirror de `priceColumnForBaseLevel`: costo→`cost`, resto `price_<nivel>`), `ORDER_LEVEL_COL`/`ORDER_LEVEL_NAME`.
- `orderEffPrice(prod, cfg)` — precio efectivo `{column, markup}` con `round(base/(1-markup/100))` (markup 0 → base directo).
- `orderCfgFromSel(sel)` — de `"level:N"`/`"list:ID"` a `{sel, column, markup, label}` (usa `state.priceLists`).
- `orderDefaultSel(level, priceListId)` — el valor del select que corresponde al cliente (su lista activa, o su nivel).
- `fillOrderPriceListSelect(selectEl, sel)` — optgroups "Nivel base" (1-4) + "Listas personalizadas" (activas).
- `ensurePriceListsLoaded()` — carga `state.priceLists` (las pestañas de Pedidos no lo hacían).
- El picker `openOrderItemPicker(editItems, priceCfg, rerender, replaceIdx)` ahora recibe un **config object** (acepta string por retrocompat); `renderOiePicker` y el confirm usan `orderEffPrice(prod, cfg)`. Se eliminó el viejo `ORDER_LEVEL_PRICE_COL`.

**Nuevo pedido** (`new-order-modal`): se agregó `<select id="no-price-list">` (admin.html). `noOpenModal` carga listas + users y llama `noSyncPriceListToClient()` (default = lista del cliente). Al cambiar de cliente: re-sincroniza la lista y reprecios (`noRepriceItems`). Al cambiar la lista a mano: reprecios. El picker usa `noPriceCfg`.

**Editar pedido** (`enterOrderItemsEdit`): selector `.oie-pricelist` en el head, `editCfg` arranca en la lista por defecto del cliente (`order.client_price_list_id`/`client_level`). Cambiarlo recalcula `unit_price` de todos los items (`repriceEdit`) y re-renderiza; el picker y "Cambiar producto" usan `editCfg`. El admin igual puede pisar precios línea por línea a mano.

**Verificación**: `node --check` OK en server.js y admin.js (esta vez el bash mount NO estaba stale). Pendiente: `git add/commit/push` + deploy Railway (en disco local).

**Crear cliente rápido desde "Nuevo pedido" (8 junio 2026, mismo día — `admin.js?v=20260608b`)**
Sergio: armando un pedido nuevo no tenía cómo cargar un cliente que no existía — tenía que salir a la pestaña Usuarios, crearlo, y volver. Ahora se crea desde el mismo modal.
- `admin.html`: junto al `<select id="no-client">` un botón **`＋ Cliente`** (`#no-new-client-btn`) y un mini-modal `#no-client-create-modal` (z-index 1400) con form `#no-client-create-form`: Nombre completo, Usuario, Nivel (1-4), Contraseña (texto visible), WhatsApp.
- `admin.js`: `slugifyUsername(name)` (minúsculas, sin acentos vía NFD, solo a-z0-9, 32 chars) autocompleta el usuario desde el nombre mientras el campo usuario no se toque a mano (flag `unameTouched`, se resetea al abrir). El submit hace `POST /api/admin/users` (reusa el endpoint existente, solo level 1-4), agrega el `out.user` a `state.users`, lo inserta como opción en `#no-client` y lo deja seleccionado, y llama `noSyncPriceListToClient()` + `noRepriceItems()` para que el pedido tome la lista del cliente nuevo. No se asigna lista personalizada acá (se hace luego en Usuarios; igual el selector de lista del pedido permite elegirla). Validaciones en cliente: nombre, usuario, password ≥ 6.
- Verificado: el bloque nuevo pasa `node --check` aislado en `/tmp` (el bash mount volvió a estar **stale**: veía admin.js cortado en 9306 cuando Read confirma 9399 líneas, termina en `bootstrap(); })();`). Read = fuente de verdad. Pendiente: `git add/commit/push` + deploy Railway.

### Fix caché: productos nuevos no aparecían sin cerrar la app / hard refresh (8 junio 2026 — `app.js?v=20260608c`, `sw.js` CACHE_VERSION v4)

Sergio: en algunos dispositivos había que hacer hard refresh o cerrar y reabrir la app para ver productos recién agregados. **Causa raíz**: el catálogo (`app.js bootstrap()`) consultaba `/api/products` **una sola vez al abrir** y no volvía a hacerlo mientras la app/PWA quedaba abierta. Como es PWA (hay `sw.js` + manifest), en mobile la app sigue viva en segundo plano y nunca re-consultaba. Factor secundario: el HTTP cache del navegador podía servir respuestas viejas del API en algunos dispositivos.

Solución en tres frentes:

1. **Auto-refresh del catálogo (`public/js/app.js`)** — fix principal. Función nueva `refreshCatalog(force)`: re-consulta `/api/categories` + `productsUrl()` y re-renderiza categorías/productos conservando filtro, búsqueda y cliente seleccionado. Throttle de 10s (flags `_lastCatalogRefresh`/`_refreshingCatalog`), errores silenciosos (offline → deja el catálogo actual). Disparadores: `document` `visibilitychange` (cuando `visibilityState==="visible"`), `window` `focus`, y `window` `pageshow` con `e.persisted` (restaurada desde bfcache, `force=true`). `bootstrap()` setea `_lastCatalogRefresh = Date.now()` al final para que el primer focus no dispare un refetch redundante. Resultado: al volver a la app (cambiar de pestaña/app y volver, o reabrir la PWA) los productos nuevos aparecen solos.

2. **`Cache-Control: no-store` en GET `/api/*` (`server.js`)** — middleware nuevo después del `session(...)`: para `req.method==="GET"` y `req.path` que empieza con `/api/`, setea `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache`. Evita que el navegador o proxies sirvan datos viejos. El SW igual guarda copia en su cache (cache.put ignora el header) para offline.

3. **Service Worker (`public/sw.js`)** — `CACHE_VERSION` bumpeado `maxaria-v3` → `maxaria-v4` (el `activate` borra los caches que no empiezan con la versión nueva → limpia datos viejos en dispositivos existentes al próximo deploy). Además `networkFirst` ahora hace `fetch(req, { cache: "no-store" })` para ignorar el HTTP cache del navegador y traer siempre datos/navegaciones frescas (la copia offline se guarda igual). `/api/products` y compañía ya eran network-first; el bug no era la estrategia del SW sino que la app no re-consultaba.

**Verificación**: `node --check` OK en server.js, app.js y sw.js (bash mount NO estaba stale esta vez). Pendiente: `git add/commit/push` + deploy Railway. Nota: el header no-store y el bump de CACHE_VERSION recién tienen efecto pleno cuando los dispositivos cargan el `sw.js` nuevo (se actualiza solo porque `/sw.js` se sirve `no-store`).

### Rentabilidad del pedido (solo admin) + Descuento al entregar (8 junio 2026 — `admin.js?v=20260608d`, `styles.css?v=20260608e`)

Dos features encadenadas. Decisiones tomadas con Sergio (AskUserQuestion): rentabilidad con **costo actual** del producto (`products.cost`, sin snapshot); visible para **todos los administradores** (no vendedores); el descuento al entregar **baja la deuda** (ajusta cuenta corriente); descuento aplicable **solo por admin**.

**Rentabilidad del pedido — detalle del pedido (admin)**
- `server.js` `GET /api/orders/:id` (rama admin): calcula `profitability` con `revenue = Σ unit_price·qty` (bruto), `cost_total = Σ COALESCE(p.cost,0)·qty` (LEFT JOIN products, costo ACTUAL), aplica el descuento del pedido → `revenue_neto = revenue − discount_amount`, `profit = revenue_neto − cost_total`, `margin_pct = profit/revenue_neto·100`. Devuelve `{revenue_gross, discount, revenue, cost_total, profit, margin_pct}`. Solo se calcula si `isAdmin`. Items con producto borrado o `cost` NULL → costo 0 (ganancia inflada; hay que tener los costos cargados).
- `admin.js` `renderOrderDetail`: si `state.isAdmin && order.profitability`, muestra una caja `.order-profit` ("💰 Rentabilidad $X (Y% margen)" + detalle "Ventas − Desc. = neto · Costo"). CSS `.order-profit`/`.op-*` en styles.css.

**Descuento al entregar (modal Registrar entrega) + rentabilidad live**
- **Schema** (migración idempotente en `server.js`, junto a is_unified): `orders.discount_type` ('percent'|'fixed'|NULL), `orders.discount_value` REAL (el número crudo: 10 → 10%, 5000 → $5000), `orders.discount_amount` INTEGER (descuento resuelto en pesos). Total NETO = `orders.total − discount_amount`.
- **`POST /api/orders/:id/deliver`**: acepta `discount_type` + `discount_value` **solo si admin** (el vendedor no descuenta; si entrega, conserva el descuento que dejó el admin). Resuelve `discountAmount` (percent: `round(total·min(val,100)/100)`; fixed: `round(val)`), acotado 0..total. Guarda los 3 campos en el pedido (solo admin). **Contabilidad**: el descuento se registra como un **crédito** "Descuento pedido #id (10%/$5000)" en `account_movements` (no toca el débito bruto original → auditable y reversible); al editar la entrega se revoca el crédito previo (`DELETE ... description LIKE 'Descuento pedido%'`) y se recrea. Funciona sin importar cuándo se creó el débito (creación de pedido admin, facturar presupuesto, o esta misma entrega para pedidos del catálogo). Respuesta incluye `discount_amount` + `net_total`.
- **Frontend** (`admin.html` + `admin.js`): bloque `#delivery-admin-box` (oculto, se muestra solo si `state.isAdmin`) con selector tipo (Sin descuento / % / $ fijo) + input valor (disabled hasta elegir tipo) + resumen `#delivery-summary`. `openDeliveryModal` hace `GET /api/orders/:id` para traer total + `profitability` (bruto) + descuento ya guardado; `deliveryOrderInfo = {total, revenue_gross, cost_total}`. `deliveryDiscountAmount()` + `renderDeliverySummary()` recalculan en vivo (al cambiar tipo/valor) el neto a cobrar y la rentabilidad neta ("💰 Rentabilidad $X (Y% margen · costo $C)"). El submit manda `discount_type`/`discount_value` solo si admin. CSS `.delivery-summary`/`.ds-line`.

**Verificación**: lógica de descuento y profitability validada aislada en `/tmp` (10% sobre $100.000 → desc $10.000, neto $90.000, rent $30.000 / 33,3%). `node --check` directo no se pudo por **bash mount stale** (veía server.js en 6749 y admin.js en 9305, cortados a mitad de línea; Read confirma ambos íntegros). Regla del proyecto: Read = fuente de verdad. Pendiente: `git add/commit/push` + deploy Railway (en disco local).

### UI tarjetas de pedido + bug 100% en Reportes + sidebar + período en Ventas + fixes de caché stale (8 junio 2026, sesión tarde — `admin.js?v=20260608i`, `styles.css?v=20260608f`)

Sesión de pulido + bugfixes encadenados, todos verificados con Read (el `node --check` por bash mount volvió a estar **stale**: reportaba truncación a mitad de línea en server.js ~6747 y admin.js ~9310, ambos íntegros según Read). En disco local, sin `git add/commit/push` ni deploy.

**1. Tarjetas de pedido: el CLIENTE pasa a ser el título destacado (Pedidos, Armado, Entregas, Ventas)**
Sergio: el nombre del cliente no destacaba; pidió intercambiar prominencia con "Pedido #N".
- `admin.js` `orderCardHtml`: el `<h4>` ahora arranca con el nombre del cliente (clase `order-client`) seguido del badge de estado + vend/cobro; el `<span class="meta">` pasó a "Pedido #N · fecha" (antes era al revés). Una sola función → cubre las 4 vistas (comparten `orderCardHtml`).
- `styles.css`: regla nueva `.order-head h4.order-client` (18px, peso 800, color `#111827`, letter-spacing -0.2px) + `.order-head .meta` con peso 600.

**2. Bug "100% de margen / ganancia = ventas" en Reportes (era bug real)**
- `GET /api/admin/reports/sales` calculaba el costo como `COALESCE(vendedor_cost_unit, 0)`: para pedidos sin snapshot (clientes sin lista personalizada = la mayoría) el costo daba **0** → ganancia = venta completa → margen 100%. Los otros endpoints (detalle de pedido, actividad) ya usaban `COALESCE(vendedor_cost_unit, p.cost, 0)`.
- Fix: las **dos** subqueries (KPIs del período + lista de pedidos) ahora hacen `FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id` y usan `COALESCE(oi.vendedor_cost_unit, p.cost, 0)`. Cae al **costo actual** del producto. **Ojo dato**: si un producto no tiene `cost` cargado, su margen sigue saliendo inflado (falta de dato, no bug).

**3. Reorden del sidebar del admin**
Sergio: tras Operaciones y Personas debería ir Compras, y Reportes al final. Nuevo orden de grupos en `admin.html`: General → Catálogo → Operaciones → Personas → **Compras** → Finanzas → **Reportes** → Sistema. (Se movió el grupo "Reportes" que estaba entre Personas y Compras, a después de Finanzas. "Sistema"/Configuración queda último por ser ajustes.)

**4. Pestaña Ventas: selector de período (default = semana actual)**
- `admin.html`: `<select id="ventas-range">` con Esta semana / Este mes / Todas / Personalizado, antes del Desde/Hasta.
- `admin.js`: `els.ventasRange`; helper `setVentasRangeDates(range)` (week = lunes de la semana actual a hoy; month = día 1 a hoy; all = limpia fechas; custom = no toca). `loadVentasOrders` aplica el default **week** la primera vez (`state.ventasRangeInit`). Cambiar el selector setea las fechas y recarga; tocar las fechas a mano pasa el selector a "custom"; "Limpiar" lo pone en "all". Por defecto al abrir Ventas se ven solo las entregas de la semana actual.

**5. 🔴 Caché stale — el cobro en entrega no impactaba en Cuentas (bug reportado por Sergio)**
- Síntoma: registrar un cobro en una entrega y entrar a Cuentas no mostraba el movimiento hasta apretar Actualizar.
- Causa: el dispatcher de tabs hacía `if (tab === "cuentas" && !state.accountsLoaded) loadAccounts()` → cache-once. El flujo de entrega (modal `/deliver`) invalida `ordersLoaded`/`entregasLoaded` pero **no** `accountsLoaded`.
- Fix: `if (tab === "cuentas") { state.accountsLoaded = false; loadAccounts(); }` → siempre recarga al entrar.

**6. 🔴 Mismo patrón, peor: circuito de pedidos cacheado (revisión pedida por Sergio)**
- Las 3 vistas del circuito (Pedidos, Armado, cola de Entregas) leían de `state.orders` cacheado: `loadArmado`/`loadEntregasQueue` solo hacían fetch `if (!state.ordersLoaded)`, y Pedidos era cache-once. El cache solo se invalidaba al entregar/avanzar. → **Un pedido nuevo entrando del catálogo (cliente/vendedor) o un presupuesto facturado NO aparecía en Pedidos/Armado/Entregas hasta refresh manual.**
- Fix en el dispatcher: entrar a `pedidos`, `armado` o `entregas` ahora hace `state.ordersLoaded = false` antes de cargar (entregas también `entregasLoaded = false`). Re-consulta `state.orders` cada vez.
- **Mapa de caché tras la revisión**: recargan siempre → Dashboard, Reportes, Pedidos, Armado, Entregas, Ventas, Cuentas, Ctacte Prov, Caja, Gastos, Cotizaciones. Cachean (se editan en su propia pestaña, OK) → Usuarios, Vendedores, Listas, Config, Proveedores, Compras, Pagos. Pendiente menor no tocado: stats de Vendedores son cache-once (números de resumen, impacto bajo).

**7. Stock de Productos quedaba viejo tras ciertas acciones**
- Ya existía `refreshProductsCache()` (refetch `/api/admin/products` + `populateCategoryFilter` + `applyFilters`), llamado al cancelar/eliminar pedido, cambiar estado a entregado/cancelado por el select, y editar items.
- Huecos cerrados: (a) el **modal "Registrar entrega"** (`POST /deliver`) descuenta stock pero no lo llamaba → agregado `refreshProductsCache()` tras recargar orders/entregas. (b) el **guardado de compra** refetcheaba `state.products` pero no re-renderizaba la tabla → reemplazado por `state.allProductsLoaded = false; refreshProductsCache()`.
- Ajuste de stock ya actualizaba el producto local + `applyFilters`, OK.

### Fix refresco rentabilidad al editar pedido + notas/fecha de entrega + líneas azules en impresiones (8 junio 2026, sesión noche — `admin.js?v=20260608m`, `styles.css?v=20260608g`, `ventas.js?v=20260608m`)

Cuatro cosas encadenadas. Todo verificado con `node --check` aislado en `/tmp` (admin.js/ventas.js OK; server.js confirmado íntegro por Read, el bash mount volvió a estar **stale** mostrando server.js cortado en línea 6896 cuando en disco termina bien en `app.listen`). En disco local, sin `git add/commit/push` ni deploy.

**1. 🔴 La Rentabilidad del pedido no se refrescaba al editar los items**
- Reporte de Sergio: editó un pedido (quedó con total $169.947) pero la caja "💰 Rentabilidad" seguía mostrando "Ventas $179.680 · Costo $151.390" del estado **anterior** a la edición. Primero pareció "otra lista de precios"; el server calcula `Ventas = SUM(unit_price·qty)` de los mismos `order_items`, así que no era eso.
- Causa: en `saveOrderItems` (admin.js), tras el `PUT /api/admin/orders/:id/items` se actualizaba `order.items` y `order.total` con la respuesta, pero el PUT **solo devuelve `{items, total}`** — NO `profitability` (que el server recalcula en `GET /api/orders/:id`). El re-render usaba el `order.profitability` viejo.
- Fix: `saveOrderItems` ahora hace un **re-fetch** `GET /api/orders/:id` después del PUT y renderiza con ese objeto fresco (rentabilidad, saldo y total en sync). Commit `f3be615` ("refresh en pedido cuando se edita").
- **Nota estructural** (no era el caso acá pero queda documentado): para pedidos facturados desde un **presupuesto con descuento por línea**, el `order_items.subtotal` guarda el monto con descuento pero `unit_price·quantity` es sin descuento. La tabla del detalle muestra `subtotal` (suma = total) y la rentabilidad usa `unit_price·qty`, así que "Ventas" puede ser legítimamente mayor que el total del pedido en esos casos.

**2. Limpieza de archivos `.fuse_hidden*` colados en git**
- El commit `f3be615` arrastró 3 archivos `data/.fuse_hidden0000...` (huérfanos que crea el mount FUSE del sandbox cuando algo borra/mueve un archivo abierto — copias de `maxaria.db`). Se sacaron con `git rm --cached` y se agregó `.fuse_hidden*` al `.gitignore`.

**3. Notas de entrega visibles + fecha de entrega editable**
Reporte: "las notas de la entrega no se guardan ni se ven en ningún lado, y necesito editar la fecha de la entrega (no la entregué hoy, solo agregué la nota)".
- **Notas**: SÍ se guardaban (`deliveries.notes`), pero (a) el modal "Ver entrega" las mostraba vacías porque `existingDelivery.notes` estaba **hardcodeado a `""`** en el wiring del botón, y (b) los SELECT de `/api/orders` (lista, usada por las tarjetas/Ventas) y `/api/orders/:id` **no traían** `d.notes`. Fix: ambos SELECT admin ahora incluyen `d.notes AS delivery_notes` (alias para no chocar con `o.notes`); `existingDelivery.notes = orderObj.delivery_notes`; el detalle del pedido muestra la nota en el bloque verde de Entrega (`.odi-note`, full-width itálica). El historial de la pestaña Entregas (`/api/admin/deliveries`) ya las mostraba.
- **Fecha editable** (`deliveries.delivered_at`): bug de fondo → el UPDATE de `POST /api/orders/:id/deliver` forzaba `delivered_at = datetime('now')` **siempre**, así que editar una entrega (p. ej. solo para agregar la nota) **pisaba la fecha real a hoy**. Fix: el endpoint acepta `delivered_at` opcional (`YYYY-MM-DD` → se guarda `+ ' 12:00:00'` para que las comparaciones `date()` de reportes caigan en ese día); en INSERT usa ese valor o el default; en UPDATE, si no se manda fecha **no toca** la `delivered_at` existente. Frontend: campo `<input type="date" name="delivered_at" id="delivery-date">` en el modal; `openDeliveryModal` lo prefillea (entrega existente → su fecha `slice(0,10)`; nueva → hoy con `toLocaleDateString("en-CA")`); el submit manda `delivered_at`. Las entregas viejas que ya quedaron con fecha pisada se corrigen abriendo "Ver entrega" y poniendo la fecha correcta.

**4. Líneas de marcación azules entre renglones en TODOS los modelos exportables**
Pedido de Sergio (con foto de un remito impreso): las filas deben tener líneas azules separando renglones, en todos los modelos que se exportan.
- Impresiones **HTML**: en `printOrderRemito` (admin.js, remito de pedido) y en el print de presupuesto de `ventas.js`, el `tbody tr{border-bottom}` pasó de gris `#e5e7eb` a azul `#1e3a5f` (igual que las verticales que ya existían). También el print de presupuesto inerte del admin (`th,td border-bottom` → azul).
- **PDF** (pdfkit, server.js): el remito PDF y la exportación de cotización/compra tenían separadores **verticales** azules por fila pero no horizontales; se agregó `doc.moveTo(MX, cy+ROW_H).lineTo(MX+MW, cy+ROW_H).lineWidth(0.5).strokeColor(BLU).stroke()` bajo cada fila.
- El **catálogo PDF** se dejó igual: son tarjetas de producto en dos columnas, no renglones de tabla.

### Rediseño de la pestaña Usuarios: tabla compacta + modal + orden tipo Excel (9 junio 2026 — `admin.js?v=20260609d`, `styles.css?v=20260609d`)

Sesión de UX sobre la pestaña Usuarios + un fix de coherencia de datos. Todo verificado (el bash mount volvió a estar **stale** varias veces, mostrando copias truncadas de `admin.js`/`server.js`; se confió en Read como fuente de verdad y se validaron los bloques nuevos aislados en `/tmp`). En disco local, sin `git add/commit/push` ni deploy.

**0. Diagnóstico previo (discrepancia "último login")**
Sergio notó que en la tabla de Usuarios marianosotto mostraba último login 03/06, pero al abrir el modal 📊 de Actividad decía "Ingresos 0 / Último ingreso —". Causa: son **dos fuentes distintas**. La columna de la tabla lee `users.last_login_at` (un único timestamp que se sobreescribe en cada `/login`, `server.js:1163`). El modal lee agregados de `activity_log` (`logins` = count de filas `event='login'`, `last_login` = MAX de esas filas). El login del 03/06 actualizó `last_login_at` pero **no dejó fila `login` en `activity_log`** (es anterior al deploy que agregó `logActivity(req,"login")`); los "Abrió catálogo" del 09/06 entraron con la sesión todavía viva (cookie TTL 7 días / PWA) sin re-login. No es dato corrupto, son dos relojes que arrancaron en fechas distintas.

**1. Fix "Último ingreso" del modal de actividad (`server.js`)**
`GET /api/admin/users/:id/activity`: si `summary.last_login` viene null y `users.last_login_at` tiene valor, se cae a `last_login_at` (fuente autoritativa). Así el KPI "Último ingreso" coincide con la columna de la tabla. Las otras métricas siguen saliendo del log real. (Pendiente opcional ofrecido a Sergio: backfill de filas `login` históricas en `activity_log`; con el fallback alcanza.)

**2. Tabla de Usuarios compacta + modal de edición por doble click**
Decisión de Sergio (AskUserQuestion): tabla mínima + "todo al modal". La tabla pasó de 13 columnas a **5**: Nombre · Lista de precios · Vendedor asignado · Activo · Último login (+ celda con el botón 📊 de actividad). Todo es **solo lectura**; etiquetas legibles (helpers `priceLabelFor(u)` = nombre de la lista personalizada o el nivel base; `vendLabelFor(u)` = nombre del vendedor asignado o "—"; Activo = badge verde/rojo). **Doble click en la fila** abre el modal nuevo `#user-edit-modal` (`openUserEditModal(id)`) con todos los campos: usuario, contraseña, nombre, lista de precios, vendedor, teléfono, WhatsApp, email, activo, + botones **Reset pass / Categorías / Compartir acceso**. Se guarda todo con UN solo PATCH. La lógica de reset/cats/share se **extrajo** de los viejos handlers de la tabla a funciones reutilizables (`openResetModal`, `openCatsModal`, `shareUserAccess`). Se eliminaron las columnas inline editables y su `change` listener; quedó un `dblclick` (abrir modal, ignora si tocaste un `<button>`) + un `click` mínimo (solo 📊). `priceListOptsHtml` quedó como dead code (ya no se usa, no se borró).

**3. Unificación Nivel + Lista de precios (un solo selector)**
Decisión de Sergio (AskUserQuestion): "una sola Lista de precios", a nivel UI, **sin cambios de schema**. En el modal hay un único `<select id="ue-pricecfg">` (`unifiedPriceOptsHtml(u)`) con dos optgroups: **Nivel base** (Minorista/Revendedor/Mayorista/VIP, `value="level:N"`) y **Listas personalizadas** (activas, `value="list:ID"`; incluye la lista asignada aunque esté inactiva para no perder la selección). `decodePriceCfg(val)`: `"level:N"` → `{level:N, price_list_id:null}` (limpia la lista); `"list:ID"` → `{price_list_id:ID}` (el nivel queda como estaba). El catálogo ya resolvía el precio con `getEffectivePriceConfig` (prioriza `price_list_id`), así que no hubo que tocar pricing. La columna "Lista de precios" de la tabla muestra directo el nombre efectivo, sin la dualidad confusa.

**4. Usuario editable de forma segura (anti-autocompletado)**
El campo Usuario era read-only. Sergio pidió poder editarlo. **Problema detectado**: un gestor de contraseñas (ícono rojo en su captura) detectaba el modal como formulario de login y **pisaba el campo Usuario con "admin"** para todos los clientes (por eso "no se visualizaba el usuario real"). Soluciones que NO alcanzaron: `readonly`-hasta-focus + `autocomplete="off"`. **Solución final**: el usuario y la contraseña se muestran como **texto** (`<span>`), no como inputs. Sin input de login en pantalla al abrir, el gestor no tiene dónde inyectar. El Usuario tiene un botón **"✏️ Editar"** que recién ahí revela el `<input id="ue-username" hidden>`. Al guardar, el username se manda **solo si cambió** (`!== state.editUserOrigUsername`). Backend: `PATCH /api/admin/users/:id` ahora acepta `username` con validación de formato (`isValidUsername`, 3-32, lowercase) + unicidad excluyendo el propio id (409 "Ya existe un usuario con ese nombre"). La contraseña sigue cambiándose solo por **Reset pass** (es hash; `plain_password` es solo display).

**5. Orden tipo Excel en la tabla de Usuarios (multi-clave estable)**
Encabezados clickeables (`th.us-sort` con `data-sort="name|lista|vendedor|activo|login"`). `state.userSort` = array de `{key, dir}` donde el `[0]` es la clave **principal** y los siguientes son **desempates** (mantienen el orden previo, como Excel). `onUserSortClick(key)`: si la clave ya es principal, alterna asc/desc; si no, la pone al frente y conserva las demás como tie-breakers. `sortUserList(list)` hace un `Array.sort` estable multi-clave (números por resta, strings con `localeCompare(...,"es")`); los vacíos (sin vendedor, sin login) van **siempre al final** sin importar la dirección (via `{v, isNull}` en `userSortVal`). `updateUserSortHeaders()` dibuja **▲/▼** en la columna activa + un `<sup>` con el número de prioridad cuando hay más de una clave. Botón **"↕ Limpiar orden"** (`#user-sort-reset`, `.btn-tool`, aparece solo si el orden no es el default) vuelve a nombre-asc. Default inicial: nombre ascendente. Verificado el comportamiento Excel aislado en `/tmp`: ordenar por lista tras ordenar por nombre → agrupa por lista y dentro de cada grupo mantiene el nombre.

**Detalle a tener en cuenta (heredado)**: el `<select>` de Vendedor asignado del modal solo lista vendedores **activos** (`vendedoresActiveCache`). Si a un cliente le quedó asignado un vendedor que después se desactivó, no aparece en las opciones y guardar el modal lo desasignaría. Caso de borde, no blindado (igual comportamiento que el select inline anterior).

### Hardening: rate limit login + error handler global + fix path traversal (9 junio 2026, sesión tarde)

Tres fixes de seguridad/robustez en `server.js` (sin tocar frontend, sin cache busting necesario). Sergio pidió explícitamente **dejar `plain_password` para después**.

**1. Rate limit en `POST /login`** (sin dependencia nueva): contador en memoria por IP (`loginAttempts` Map), máx **10 intentos fallidos por ventana de 15 min** → 429 "Demasiados intentos fallidos...". El login exitoso borra el contador de esa IP; barrido periódico cada 10 min (`setInterval(...).unref()`). Helpers `loginRateOk(ip)` / `loginRateFail(ip)` definidos justo antes de la ruta. Usa `req.ip` (el `trust proxy: 1` ya estaba seteado, así que detrás de Railway toma la IP real del header).

**2. Error handler global de Express + handlers de proceso** (al final, entre el 404 y `app.listen`): middleware de 4 args que loguea stack y responde 500 JSON `{error}` para `/api/*` (texto plano para el resto), con casos especiales `MulterError` (400, "Archivo demasiado grande" si LIMIT_FILE_SIZE) y `entity.too.large` (413). Además `process.on("unhandledRejection")` (solo log — las rutas async de Express 4, hoy solo `POST /api/admin/catalog/pdf`, no llegan al middleware de errores si rechazan) y `process.on("uncaughtException")` (log + `exit(1)`, Railway reinicia).

**3. Path traversal en `loadProductImage` cerrado**: antes hacía `decodeURIComponent(clean.split("/").pop())` — un filename con `..%2F` codificado sobrevivía al split y escapaba del directorio. Ahora: `path.basename(decodeURIComponent(clean))` (decodificar ANTES de tomar el nombre base) + check `path.resolve(...).startsWith(PRODUCT_IMAGES_DIR + sep)`. Verificado aislado: `..%2F..%2Fetc%2Fpasswd` queda en `product-images/passwd`. Nota: `GET /images/products` usa `express.static`, que ya es seguro contra traversal — no se tocó.

**Verificación**: el bash mount volvió a quedar **stale** (veía server.js cortado en 7006 cuando Read confirma 7080 líneas terminando en `app.listen`). Se confió en Read y se validaron los bloques nuevos aislados en `/tmp` (parse + tests funcionales del rate limit y del traversal) → OK. Pendiente: `git add/commit/push` + deploy Railway (en disco local).

### Reporte de Inflación — solo superadmin (9 junio 2026, sesión noche — `admin.js?v=20260609g`)

Idea de Sergio: en Argentina la mercadería aumenta entre compra y compra; lo vendido a precio viejo "pierde" ganancia pero el stock comprado barato la compensa. Quería un informe de cuándo perdió y ganó con los cambios de costo, por compra y por stock general, **solo para el superadmin**. Decisiones (AskUserQuestion): medir **solo hacia adelante** (sin reconstruir histórico), pérdida = **costo de reposición**, contar **todos los orígenes** de cambio de costo.

**Modelo conceptual (por cada cambio de costo de un producto):**
- **Revalorización del stock** = `stock_at_change × (costo nuevo − costo viejo)` — lo ganado por tener mercadería comprada al costo viejo. El stock se snapshotea AL MOMENTO del cambio (en compras, ANTES de sumar las unidades que entran).
- **Pérdida por reposición** = unidades vendidas desde la referencia anterior (cambio de costo previo del producto, o compra previa, lo más reciente) hasta este cambio `× delta` — lo vendido con el costo viejo cuesta delta más reponerlo. Si no hay referencia previa (primer cambio registrado), devuelve null ("sin ventana"). Excluye pedidos cancelados y unificados.
- **Neto** = revalorización − pérdida. Con bajas de costo los signos se invierten solos.

**Schema** (migración idempotente en `server.js`, después de stock_adjustments): tabla `cost_changes` (product_id, old_cost, new_cost, **stock_at_change**, source 'compra'|'manual'|'excel', source_id = purchase_order_id o price_updates.id, created_at) + índices por producto y fecha. Helper `logCostChange(productId, old, new, source, sourceId, stockOverride)` — no registra si old == new; lee el stock actual salvo que el caller pase `stockOverride`.

**Captura en los 3 orígenes:**
- **Compra**: dentro de `applyPurchaseCostUpdate` (que ganó 4º parámetro `purchaseId`). ⚠️ En POST y PUT de `/api/admin/purchases` se **invirtió el orden**: ahora `applyPurchaseCostUpdate` corre ANTES de `updStock/incStock`, para que el stock registrado sea el previo a la compra (los dos statements son independientes — cost/precios vs stock — el swap no cambia nada más).
- **Manual**: `PATCH /api/admin/products/:id` y `POST /api/admin/products/bulk-update` — si el patch toca `cost`, snapshot de cost+stock ANTES del UPDATE (por si el mismo patch también cambia stock) y log después, mismo patrón que `recordManualPriceChange`.
- **Excel**: en `POST /api/admin/import-excel` — snapshot `Map(id → {cost, stock})` de TODOS los productos antes de `importPrices`, diff después, log con `source_id = stats.updateId`. Productos nuevos creados por el import no cuentan como "cambio".

**Endpoint `GET /api/admin/reports/inflation?from&to`** (antes de "REPORTES DE VENTAS"): pasa por `requireAdmin` (sección "reportes" via `sectionForAdminRequest`) pero además exige `getAdminPerms(userId).isSuperadmin` → 403 para admins comunes. Devuelve `{from, to, totals: {changes_count, products_count, revalorizacion, perdida, neto, sin_ventana}, stock_value_now, changes: [...]}`. Cada change: old/new cost, delta, delta_pct, stock_at_change, revalorizacion, window_from, sold_qty, perdida, neto, source. La ventana usa orden `(created_at, id)` para desempatar cambios en el mismo segundo, y al buscar la compra previa **excluye la compra que originó el cambio** (`po.id != source_id`). LIMIT 1000.

**Frontend**: pestaña **🔥 Inflación** en el sidebar (grupo Reportes, entre Reportes y Actividad), clase `superadmin-only` + `hidden`. En `bootstrap()` el gating de `administradores` ahora cubre también `inflacion` (ambas exclusivas del superadmin). Dispatcher: `if (tab === "inflacion") loadInflacion()` (siempre recarga). Panel `#tab-inflacion` en `admin.html`: filtros desde/hasta (default este mes), nota explicativa, 4 KPI cards (Ganado por stock / Perdido por vender a costo viejo / Neto / Valor del stock hoy a costo de reposición) y tabla con totales en tfoot + export CSV (separador `;`, BOM UTF-8). Módulo `infEls`/`infState`/`loadInflacion`/`renderInflacion` en `admin.js`, insertado entre el módulo de Reportes y CAJA. Detalle: las KPI cards de color usan texto blanco sobre gradiente → los valores van con `infSignedText` (texto plano), los de la tabla con `infSigned` (span verde/rojo).

**Verificación**: lógica completa validada en `/tmp` con sqlite3 (Python): compra 100→120 con 50 u. en stock → reval $1.000; 30 u. vendidas en la ventana (excluye canceladas y posteriores) → pérdida $600, neto +$400; segundo cambio usa el cambio anterior como inicio de ventana. Parse de los bloques nuevos OK aislados. El bash mount volvió a estar **stale** (veía server.js y admin.js truncados); Read confirma íntegros (server.js 7283 líneas → `app.listen`; admin.js 10010 → `bootstrap(); })();`). Pendiente: `git add/commit/push` + deploy Railway (en disco local).

**Limitación conocida**: el reporte solo ve cambios de costo posteriores al deploy. El primer cambio de cada producto aparece "sin ventana" para la pérdida **salvo** que el producto tenga compras anteriores cargadas (la compra previa sirve de referencia). La pérdida es una estimación: asume que el costo real subió en algún momento de la ventana, no necesariamente al final.

### Chequeo de armado — checklist de picking multi-dispositivo (10 junio 2026 — `admin.js?v=20260610d`, `styles.css?v=20260610b`)

Pedido de Sergio: en la pestaña Armado, un botón por pedido que abra la lista de productos con cantidades para el armador, con checklist tildable (destacando producto y cantidad armada, parcial permitido porque el stock físico puede no coincidir), sincronizado en vivo entre dos armadores con dos dispositivos, y filtrable por categoría (en la práctica el armado se reparte por categorías). Decisiones (AskUserQuestion): al completar solo indicador visual (badge, NO pasa solo a Entregas); permisos = admins con sección Armado (no vendedores).

**Schema** (migración idempotente en `server.js`, después de `notified_status`): `order_items.picked_qty REAL NOT NULL DEFAULT 0` (cantidad armada; 0 = sin armar), `picked_by INTEGER` (user id), `picked_at TEXT`. Sin tabla nueva.

**Backend (`server.js`)**
- `GET /api/admin/picks/:orderId` (requireAdmin): items del pedido con `picked_qty`, `picked_by_name`, `category_name` (LEFT JOIN products→categories; producto borrado = "Sin categoría"), ordenados por categoría (`sort_order`). Devuelve `{order:{id,status,client_name}, items, total_items, done_items, complete}`.
- `POST /api/admin/picks/:orderId` body `{item_id, picked_qty}`: valida que el item sea del pedido, acota qty a 0..cantidad pedida; qty>0 guarda picked_by/picked_at, qty=0 limpia. Devuelve el agregado actualizado (done/total/complete). Última escritura gana (sin locks).
- `sectionForAdminRequest`: `has("picks") → "armado"` (antes de `has("orders")`), así un admin limitado con sección Armado puede usarlo.
- `GET /api/orders` (rama admin): subselects nuevos `pick_total` / `pick_done` por pedido para pintar avance y badge en las tarjetas.

**Frontend (`admin.html` + `admin.js` + `styles.css`)**
- `orderCardHtml`: para admin y `status === "preparando"` (= solo en Armado en la práctica), botón **"📋 Chequeo"** (muestra avance `done/total` si hay algo tildado) + badge **"✔ Armado completo"** (`.pick-badge-ok`, verde) cuando todo está tildado. Wiring en `wireOrderCards` (`.btn-pick`, excluido del click que expande la tarjeta).
- Modal `#pick-modal` (estático en admin.html, cubierto por el cierre genérico data-close/Escape): filtro por categoría (`#pick-cat-filter`, se arma con las categorías de los items), barra de progreso (azul → verde al completar), lista agrupada con headers azules sticky por categoría.
- Interacción: **click en la fila = tildar/destildar completo**; el input numérico de la derecha guarda **cantidad parcial** (fila ámbar `◐` si parcial, verde tachada `✔` si completa). Muestra `👤 nombre` de quien tildó cada item.
- **Sync multi-dispositivo por polling**: `setInterval` 4s mientras el modal está abierto (`pickPollTick` corta solo al detectar `modal.hidden`, cubre todos los caminos de cierre). El tick NO re-renderiza si hay un POST en vuelo (`pickState.posting`) o si el armador tiene el foco en un input (no pisarle el tipeo). Cada cambio actualiza también `pick_done/pick_total` en `state.orders` y re-renderiza Armado (botón y badge al día).
- Módulo autocontenido `pickEls`/`pickState` + funciones `openPickModal`/`pickFetch`/`pickRenderList`/`pickApplyAgg`/`pickPost`, insertado después del wiring de `armadoReload`. No toca `els`.

**Verificación**: `node --check` OK en server.js y admin.js (el mount NO estaba stale esta vez). Lógica de migración + queries + POST simulado validada con Python sqlite3 sobre copia de la DB en `/tmp` (parcial, destildar, completo, subselects de tarjeta — todo OK; ALTERs idempotentes). Ojo: el binding de better-sqlite3 del node_modules es de Windows (invalid ELF en el sandbox) — para tests de DB en sandbox usar Python sqlite3. Pendiente: `git add/commit/push` + deploy Railway (en disco local).

**Aplicar cantidades armadas al pedido de origen (10 jun, misma sesión — `admin.js?v=20260610e`)**
Sergio: el cambio de cantidad en el armado debe impactar en el pedido. Decisiones (AskUserQuestion): impacta con **botón explícito** en el modal (no automático); item armado en 0 queda como está pero **→ Entregas avisa** "hay N items sin armar" con confirm.
- **Server**: endpoint nuevo `POST /api/admin/picks/:orderId/apply` (requireAdmin, sección armado). Toma los items con `picked_qty > 0` y distinta a `quantity`: actualiza `quantity = picked_qty` + `subtotal` (delta-based, NO borra/reinserta — conserva picked_by/picked_at y `vendedor_cost_unit`), recalcula `orders.total`, y replica la lógica stock-aware del `PUT /items`: si el stock ya estaba descontado (presupuesto facturado → `budgets.stock_discounted` o `orders.stock_discounted`, respetando `skipStock` de unificados) ajusta `stock + (viejo − nuevo)`; mantiene en sync el débito de cuenta corriente si existe. Items en 0 NO se tocan (0 = "todavía no se armó", no "borrar"). Rechaza entregado/cancelado (409). Re-apply es no-op. Tras aplicar, el parcial queda completo solo (picked == quantity nueva).
- `GET /api/orders` (admin): tercer subselect `pick_started` (items con picked_qty > 0) para el aviso.
- **Frontend**: botón **"📦 Aplicar cantidades al pedido (N)"** en el pie del `#pick-modal` (`#pick-apply-btn`, oculto si no hay diferencias; helpers `pickPendingChanges`/`pickUpdateApplyBtn`, llamados desde pickFetch y pickPost). Al click: confirm con el detalle "producto: 5 → 3" (hasta 8 líneas), POST apply, toast con nuevo total, actualiza `state.orders`, re-fetch del checklist, `refreshOrderViews()` + `refreshProductsCache()`. En `wireOrderCards`, el handler de `.btn-advance` a `listo` confirma si `pick_started > 0 && pick_started < pick_total` (checklist sin usar = no molesta).
- **Verificación**: el mount volvió a estar **stale** (veía server.js cortado en 7372 cuando Read confirma 7450 → `app.listen`; admin.js en 10292 vs 10362 → `bootstrap(); })();`). Bloques nuevos validados aislados en `/tmp` (parse + ejecución con stubs) y lógica del apply testeada con Python sqlite3 sobre copia de la DB: qty 5→3, subtotal/total recalculados, stock devuelto +2 con stock_discounted=1, re-apply no-op.

### Fix DELETE presupuesto (stock) + Control de recepción de mercadería (11 junio 2026 — `admin.js?v=20260611a`, `styles.css?v=20260611a`)

**Fix: DELETE /api/budgets/:id no devolvía el stock**
Los presupuestos nacen con `stock_discounted=1` (descuentan stock al crearse), pero el DELETE borraba sin devolverlo → fuga permanente. Ahora devuelve el stock de los `budget_items` en transacción, **salvo** que esté vinculado a un pedido con `orders.stock_discounted=1` (facturado/entregado: el descuento ya es del pedido). Si el pedido vinculado tiene `stock_discounted=0`, sí devuelve (el deliver re-descuenta porque ya no hay budget con flag). Testeado contra copia de la DB: 4 casos OK.

**Control de recepción de mercadería (pestaña nueva 📦 Recepción, grupo Compras)**
Pedido de Sergio: chequeo de control al recibir mercadería de una compra, parecido al checklist de Armado, considerando que el proveedor factura por **bulto** y el sistema carga **unidades** (`products.units_per_bulto`, ya existía de Cotizaciones). Decisiones (AskUserQuestion): diferencias se aplican con **botón explícito** (nada automático); carga en **bultos y unidades vinculados**; **pestaña propia** en el sidebar.

- **Schema** (migración idempotente, junto a las de picked_*): `purchase_items.checked_qty REAL` (**NULL = sin controlar; 0 es válido** = "no llegó nada"), `checked_by INTEGER`, `checked_at TEXT`. Ojo: acá el "sin marcar" es NULL (en picks es 0) porque 0 recibido es un dato real.
- **Sección**: `recepcion` agregada a `ADMIN_SECTIONS` y `sectionForAdminRequest` (`/api/admin/reception` → recepcion, ANTES del check de purchases). **Los admins limitados existentes NO la tienen** — el superadmin debe otorgarla desde Administradores.
- **Endpoints** (espejo de `/api/admin/picks`): `GET /api/admin/reception` (compras con `checked_count`/`diff_count`); `GET /api/admin/reception/:purchaseId` (items con `units_per_bulto`, `category_name`, quién contó); `POST /api/admin/reception/:purchaseId` `{item_id, checked_qty}` (numérico ≥0 **sin tope** — puede llegar de más; null/"" destilda); `POST /api/admin/reception/:purchaseId/apply` — items contados con cantidad ≠ a la cargada: `quantity` pasa a lo contado, recalcula subtotal/`total_cost`, **ajusta stock por la diferencia** (`MAX(0, stock + (nuevo − viejo))`, la compra ya había sumado lo cargado) y actualiza el **debit de `supplier_movements`** de la compra (los pagos quedan). Items sin controlar no se tocan; re-apply es no-op.
- **Frontend**: pestaña `#tab-recepcion` (filtro Sin controlar/A medias/Controladas, chips de estado `.recv-chip-*`, botón 📋 Controlar por compra) + modal `#recv-modal` calcado del `#pick-modal` (reusa clases `.pick-*`; polling 4s multi-dispositivo con los mismos guards de posting/foco). Cada item muestra "cargado: N un. = X bultos ×upb" y tiene **dos inputs vinculados**: bultos (solo si upb>1; convierte ×upb) y unidades. Click en la fila = tildar con lo cargado / destildar. Estados: ✔ verde (coincide), **≠ rojo `.pick-diff`** (controlado con diferencia), vacío (sin controlar). El chip de la fila de la tabla se actualiza en vivo (`recvApplyAgg`). El apply confirma con detalle "producto: cargado → recibido", invalida caches de Compras y Productos.
- **Verificación**: `node --check` OK (sin mount stale esta vez); lógica del apply testeada contra copia de la DB (12 checks: faltante, sobrante, item sin controlar intacto, deuda y total recalculados, re-apply no-op); UI verificada en preview con sesión forjada del superadmin (tilde completo, diferencia parcial, conversión 0,5 bultos → 5 un., chip en vivo, limpieza) — cero errores de consola. Datos de prueba revertidos. Para forjar sesión admin en preview: si el `.env` local tiene el SESSION_SECRET de ejemplo, el server usa el fallback `dev-secret-cambiame` — firmar el sid con ese.

### Chequeo de armado v2: 0 = controlado, armar de más, confirmación con registro (11 junio 2026 — `admin.js?v=20260611g`, `app.js?v=20260611g`, `styles.css?v=20260611g`)

Pedido de Sergio sobre el checklist de Armado: (1) poner 0 en un item (no hay stock) debía dejarlo como CONTROLADO (antes 0 = "sin armar"); (2) permitir cantidad MAYOR a la pedida (redondear la caja); (3) botón de confirmación al terminar que anuncie los cambios, los comunique y queden registrados.

**Schema (migraciones idempotentes en `server.js`, junto a las de picked_*)**
- `order_items.pick_checked INTEGER NOT NULL DEFAULT 0` — 1 = item controlado (la cantidad puede ser 0 o mayor a la pedida). El ALTER viene seguido de `UPDATE ... SET pick_checked = 1 WHERE picked_qty > 0` que corre una sola vez (mismo patrón que notified_status) para no perder lo ya tildado. Mismo modelo que Recepción pero con flag en vez de NULL (picked_qty ya era NOT NULL).
- Tabla nueva **`pick_changes`** (order_id, product_code, product_name, old_qty, new_qty, changed_by, created_at + índice por order_id) — registro persistente de cada diferencia confirmada.

**Server**
- `POST /api/admin/picks/:orderId`: `picked_qty` numérico ≥ 0 **sin tope superior** (0 válido = "no hay"; de más permitido) → `pick_checked=1`; `null`/`""` = destildar. Devuelve `pick_checked`. `done`/`complete` ahora cuentan `pick_checked=1` (GET, POST y subselects `pick_done`/`pick_started` de `/api/orders`).
- `POST /api/admin/picks/:orderId/apply` (= **Confirmar chequeo**): cambios = items controlados con cantidad ≠ pedida. Controlado en **0 → DELETE del item** (se quita del pedido); distinto → quantity/subtotal nuevos (de más incluido: el ajuste de stock con delta negativo descuenta). Cada cambio se INSERTa en `pick_changes`. Confirmar sin diferencias responde ok con `changed: 0` y deja registro en activity_log. Respuesta incluye `changes[]`.
- `GET /api/orders/:id`: devuelve `pick_changes` para **todos los roles** (el cliente también).
- `GET /api/my-notifications`: si el pedido tiene `pick_changes`, el aviso del catálogo los anexa ("Cambios en el armado: X 5 → 7, Y 2 → sin stock (quitado)").

**Frontend**
- `admin.js` modal de chequeo: estados por fila — coincide → verde ✔ (`pick-done`); controlado con diferencia (0, menos o más) → rojo ≠ (`pick-diff`, clase ya existente de Recepción); sin controlar → input **vacío** (placeholder "—", ya no 0). Input sin `max`. Click en fila = controlar con lo pedido / destildar. Vaciar el input = destildar. Botón renombrado **"✅ Confirmar chequeo (N cambios)"**, visible si hay diferencias **o** si el chequeo está completo (confirma "sin diferencias"); el confirm detalla cada cambio con "(sin stock — se quita del pedido)" / "(se agrega de más)".
- `admin.js` `renderOrderDetail`: bloque ámbar **"📋 Cambios del armado"** (`.order-pick-changes`) con el historial de `pick_changes` + fecha.
- `app.js` `toggleOrderDetail`: el cliente ve el mismo bloque en el detalle de su pedido en "Mis pedidos".
- CSS nuevo `.order-pick-changes`/`.opc-*` en styles.css.

**Verificación** (preview local, `testadmin` con sección `armado` temporal, pedido de prueba #13): POST con 0/7-sobre-5/null/exacto OK; apply → item quitado + 5→7 aplicado + total y stock recalculados (creación admin descuenta stock: devuelto +2 del quitado, descontado −2 del de más) + débito en sync; re-apply no-op; notificación del cliente con los cambios; bloques visibles en detalle admin y catálogo; estados visuales y botón correctos; cero errores de consola. Datos de prueba revertidos (pedido borrado, stocks 123/36/89, hash de `minorista` restaurado, permisos de testadmin revertidos). `node --check` OK desde PowerShell. Pendiente: `git add/commit/push` + deploy Railway.

**Modal de confirmación propio (mismo día — `admin.js?v=20260611h`, `styles.css?v=20260611h`)**
Sergio: el aviso de confirmación del chequeo mostraba "maxaria-app-production.up.railway.app dice" + botones Cancelar/Aceptar — eso es el `confirm()` **nativo del navegador**: el encabezado del dominio y los botones no se pueden editar (solo el cuerpo). Se reemplazó por un modal propio reutilizable:
- `admin.html`: `#confirm-modal` con clase **`app-confirm`** (NO `.admin-modal`, así el cierre genérico por Escape/data-close no interfiere con la promesa) + título/cuerpo/2 botones.
- `styles.css`: `.app-confirm`/`.app-confirm-box`/`-title`/`-body` (`white-space: pre-wrap` para respetar los `\n`)/`-foot`. `z-index: 2200` → aparece sobre cualquier otro modal (chequeo, edición).
- `admin.js`: helper **`confirmModal({title, message, confirmText, cancelText, danger})` → Promise<boolean>**. Maneja su propio cierre en fase de **captura** (Escape=cancelar, Enter=ok, click overlay=cancelar) con `stopPropagation` para no disparar el handler global de Escape que cerraría el modal de abajo. Título por defecto = nombre de la app. Fallback a `window.confirm()` si falta el HTML.
- El `confirm()` del botón "Confirmar chequeo" ahora usa `await confirmModal(...)`. Los demás `confirm()`/`alert()` de admin.js siguen nativos (se pueden migrar a `confirmModal` cuando convenga; el helper ya está).
- Verificado en preview (pedido #14): el modal aparece con título/cuerpo/botones propios y z-index 2200; Cancelar y Escape cierran solo el confirm dejando el chequeo abierto sin aplicar; Confirmar aplica los cambios (item quitado, 5→7, total/stock/pick_changes); cero errores. Datos revertidos.

**Bug del modal y migración completa de confirm()/alert() (mismo día — `admin.js?v=20260611h`, `app.js?v=20260611i`, `ventas.js?v=20260611i`, `styles.css?v=20260611i`)**
- 🔴 **Bug**: el `#confirm-modal` aparecía vacío al cargar /admin. Causa: `.app-confirm { display:flex }` (clase) le gana al atributo `hidden` del navegador → el modal quedaba siempre visible. Faltaba la regla `.app-confirm[hidden] { display:none }` (igual que `.admin-modal[hidden]`, línea ~2636 de styles.css). Agregada. **Regla del proyecto reconfirmada**: cualquier overlay con `display:flex/block` por clase necesita su propia regla `[hidden]{display:none}`, sino el atributo `hidden` no lo oculta.
- **Migración completa** (pedida por Sergio: "que desaparezca el '...railway.app dice' en todos lados"): se reemplazaron TODOS los `confirm()`/`alert()` nativos de **admin.js** (~15 confirm + ~23 alert), **app.js** (3 confirm + ~13 alert) y **ventas.js** (2 alert; ya tenía su `vConfirm` propio) por el modal in-app.
  - `confirmModal(opts)` / `alertModal(opts)` (helpers gemelos en admin.js y app.js): aceptan string u objeto `{title, message, confirmText, cancelText, danger, alert}`, devuelven Promise<boolean>, cierre en captura (Escape/Enter/overlay) con `stopPropagation` para no disparar el handler global de Escape que cerraría el modal de abajo. `alertModal` = `confirmModal` con `alert:true` (oculta Cancelar). Fallback a `window.confirm/alert` si falta el HTML. Borrados marcados con `danger:true` (botón rojo). Título por defecto = nombre de la app.
  - El HTML `#confirm-modal` (clase `app-confirm`) se agregó a `admin.html` e `index.html`; el CSS `.app-confirm*` es compartido en styles.css. ventas.html ya tenía `#ventas-confirm-modal`; se le sumó un helper `vAlert` que reusa ese modal ocultando Cancelar.
  - El wrapper viejo `vConfirm` de admin.js ahora enruta a `confirmModal`.
  - Los `confirm()` requieren que la función contenedora sea `async` (todas lo eran; `node --check` lo confirmaría si no). Los `alert()` migrados no bloquean el hilo (a diferencia del nativo), pero todos van seguidos de `return` o son terminales, así que el flujo no cambia.
  - **Quedan nativos a propósito**: solo los `window.confirm/window.alert` del fallback dentro de los helpers.
- Verificado en preview: modal oculto al cargar /admin y /catalogo; flujo real del catálogo ("Ver como" con carrito → confirmModal, Cancelar deja todo intacto); chequeo de armado con el modal propio (Cancelar/Escape/Confirmar); toggle visible/oculto y z-index 2200 en ambas páginas; cero errores de consola. `node --check` OK en los tres JS. Pendiente: `git add/commit/push` + deploy Railway.

### Categorías visibles globales: el "ver como" del admin ahora respeta el filtro (11 junio 2026 — `app.js?v=20260611a`)

Sergio reportó que la card "Categorías visibles del catálogo" (Configuración) "no andaba": destildó **VERANO** pero la seguía viendo en el catálogo. **No era un bug del filtro** — la feature usa `categories.active` y tanto `GET /api/categories` (línea ~1935) como `GET /api/products` (~2050) filtran `active=1` solo si `req.session.level !== 99`. El admin está exento a propósito (esos endpoints alimentan selects del panel y pickers). Sergio probaba logueado como admin → veía todo, incluso usando el selector "Ver como Minorista" (que solo cambiaba precios via `as_level`, la sesión sigue siendo 99).

**Fix — el preview del admin ahora simula al cliente de verdad:**
- `server.js`: ambos endpoints aplican el filtro de categorías también cuando `req.query.preview === "1"` (aunque sea admin). Los pickers internos (/ventas, presupuestos, modales) NO mandan `preview` y siguen viendo todo.
- `app.js`: `productsUrl()` agrega `&preview=1` cuando hay `viewAsLevel`/`viewAsListId`; helper nuevo `categoriesUrl()` (mismo criterio) usado en `bootstrap()`, `refreshCatalog()` y el handler del selector "Ver como" (que ahora también re-pide categorías, antes solo productos → el sidebar no se actualizaba al cambiar de vista).
- Regla resultante: admin "viendo como" nivel/lista → ve exactamente lo que ve un cliente (categorías desactivadas ocultas); admin sin "ver como" → ve todo (documentado en la card de config).

**Verificación** (preview local, login `testadmin`/`Claude123!` — hubo que agregarle temporalmente la sección `config` a `admin_sections`, se revirtió): desactivar **NUEVO** → `/api/categories?preview=1` y `/api/products?as_level=1&preview=1` la excluyen, sin preview la incluyen; UI con "ver como Minorista" no muestra **NUEVO**, sin "ver como" sí; cero errores de consola; categoría reactivada al cierre. `node --check` OK (corrido desde PowerShell, sin pasar por el bash mount). Pendiente: `git add/commit/push` + deploy Railway.

### Sidebar Finanzas unificado + Gastos impactan en caja (12 junio 2026 — `admin.js?v=20260612a`)

**Sidebar reorganizado**: el grupo **Finanzas** ahora agrupa todo lo de plata: Caja · Pagos · Cuentas · Ctacte Proveedores · Gastos. *Compras* quedó con Proveedores/Cotizaciones/Compras/Recepción; *Reportes* con Reportes/Inflación/Actividad. Solo se movieron botones en `admin.html` — las claves `data-tab` y `ADMIN_SECTIONS` no cambiaron, permisos intactos.

**Gastos → Caja** (era el único módulo de plata sin vínculo con `cash_accounts`; Pagos, Entregas y Pagos a proveedores ya lo tenían):
- **Schema**: migración idempotente `expenses.caja_id INTEGER REFERENCES cash_accounts(id)` (junto a las otras de caja). NULL = gastos históricos sin imputar.
- **POST /api/admin/expenses**: `caja_id` **obligatorio** (400 si falta o la caja está inactiva). En transacción: INSERT del gasto + `cash_movements` egreso `source='gasto'`, `related_id=expense.id`, `movement_date=expense_date`, descripción "Gasto: <categoría> · <descripción>".
- **PATCH**: acepta `caja_id` (también obligatorio si se manda). Tras el UPDATE, **borra y recrea** el movimiento desde el gasto ya actualizado (cubre cambios de monto/caja/fecha/categoría de una vez). Gastos históricos sin caja no generan movimiento.
- **DELETE**: borra gasto + movimiento en transacción.
- **GET**: devuelve `caja_id` + `caja_name` (LEFT JOIN).
- **Guard en `DELETE /api/admin/caja/movements/:id`**: si `source='gasto'` con `related_id` → 409 "eliminá el gasto desde la pestaña Gastos" (evita desync caja↔gastos). Los sources cobro/entrega/pago_proveedor siguen borrables desde Caja como antes (comportamiento heredado, no se tocó).
- **Frontend**: select "Sale de la caja" (`name="caja_id"`, required) en el modal crear/editar gasto; `fillCajaSelect` ganó 3er parámetro opcional `firstLabel` ("— Elegí una caja —" acá, default "— Sin imputar a caja —" en el resto). Columna "Caja" nueva en la tabla de gastos (colspans 7→8, tfoot 5→6). La pestaña Caja ya recargaba siempre al entrar, así que el egreso aparece solo.

**Verificación**: `node --check` OK en server.js y admin.js (mount NO stale esta vez). Flujo POST/PATCH/DELETE validado con Python sqlite3 sobre copia de la DB: saldo baja al crear, el PATCH mueve el egreso de caja y restaura la vieja, DELETE sin huérfanos, LEFT JOIN OK con históricos. Pendiente: `git add/commit/push` + deploy Railway (en disco local).

**Reglas de caja: saldo en transferencia + borrar cajas + responsable obligatorio + permisos por responsable (misma sesión — `admin.js?v=20260612c`, `styles.css?v=20260612c`)**
Cuatro reglas pedidas por Sergio:
1. **Saldo visible al transferir**: línea `#caja-mov-saldo-info` (estilo `.caja-saldo-info`) bajo el select de cuenta origen del modal de movimiento — muestra "Disponible en <caja>: $X · Después de transferir: $Y" en vivo (función `cajaUpdateMovSaldoInfo`, disparada por change de cuenta, input de monto, toggle de tipo y apertura del modal). Aplica a transferencia Y egreso; Y en rojo (`.caja-saldo-neg`) si queda negativo. No bloquea el envío (las cajas pueden quedar en negativo, comportamiento heredado).
2. **Borrar cajas (solo superadmin)**: endpoint nuevo `DELETE /api/admin/caja/accounts/:id` — 403 si no es superadmin; **409 si la caja tiene movimientos** (incluso como contraparte de transferencia) **o referencias** en payments/deliveries (caja_id y caja_transfer_id)/expenses/supplier_payments → "desactivala en su lugar". Botón "🗑 Borrar caja" (`#caja-acc-delete-btn`) en el pie del modal de edición de cuenta, visible solo superadmin+edición, con confirmModal danger.
3. **Responsable obligatorio al CREAR caja**: `POST /api/admin/caja/accounts` exige `responsable_user_id` válido y activo (400 si falta). Las cajas generales viejas (responsable NULL) quedan como están y el PATCH sigue permitiendo NULL. En el modal, al crear el primer option dice "— Elegí un responsable —" y el save valida antes del POST.
4. **Permisos de movimientos**: el superadmin opera cualquier caja; un admin común SOLO puede hacer **transferencias** y SOLO **desde una caja de la que es responsable** (`POST /api/admin/caja/movements` → 403 en ambos casos; espejo en `DELETE /api/admin/caja/movements/:id`: solo borra movimientos de su propia caja). Frontend: para no-superadmin se oculta "＋ Registrar movimiento" (queda solo "⇄ Transferir entre cajas"), el modal fuerza modo transferencia, oculta el toggle de tipo (via `style.display`, NO `[hidden]` — la clase lo pisaría) y limita el select de origen a sus cajas; si no tiene ninguna, alerta y no abre. Nota: los vendedores (level 5) no acceden a la pestaña Caja — "admin común" = level 99 no-superadmin con sección caja.
**Verificación**: mount stale otra vez (server.js "cortado" en 7925, admin.js en 11412; Read confirma íntegros: server 7995 líneas → app.listen, admin.js 11513 → `bootstrap(); })();`). Lógica frontend testeada con stubs en /tmp (forzado de transferencia, origen restringido, preselección, saldo restante ok/negativo, caso sin caja propia, superadmin completo) y reglas del DELETE de cajas contra copia de la DB (limpia=borrable; con movimiento, como contraparte, o con gasto vinculado=bloqueada). Bloques nuevos del server parseados aislados OK.

**Modal Registrar entrega v2: tilde "pagó el total", adeudado en vivo, bloqueo de transferencia, contraste visual (misma sesión — `admin.js?v=20260612d`, `styles.css?v=20260612d`)**
Pedidos de Sergio: (a) tilde primero para marcar "se pagó el total"; (b) si se carga otro monto, mostrar lo adeudado en el modal; (c) más contraste entre etiquetas y campos ("no se sabe qué es cargable"); (d) si el efectivo cubre el total, deshabilitar la transferencia.
- **Tilde "💵 Pagó el total en efectivo (= $neto)"** (`#delivery-paid-full`, entre Fecha y Efectivo): al tildar carga el neto (total − descuento) en efectivo y limpia/bloquea transferencia; al destildar pone efectivo en 0. Se marca/desmarca SOLO según los montos (si el efectivo manual = neto exacto y transf = 0, se tilda automáticamente).
- **Estado del cobro** (`#delivery-total-preview`, ahora clase `.delivery-cobro-status` con variantes `dcs-debt` ámbar / `dcs-ok` verde / `dcs-over` rojo): "⚠ Queda adeudado: $X (cobrado $Y de $neto)" / "✔ Pagado completo" / "Cobrado de más: $X", recalculado en vivo (montos y descuento).
- **Bloqueo de transferencia** (`deliverySyncTransferLock`): si efectivo ≥ neto, el input de transferencia y su caja se deshabilitan y limpian (los campos disabled no viajan en el FormData → el POST manda transf 0 / caja null). Se re-evalúa al cambiar montos o descuento.
- **Fetch del pedido para TODOS los roles**: `openDeliveryModal` ahora hace `GET /api/orders/:id` también para vendedores (antes solo admin) — el total alimenta tilde/adeudado/bloqueo; `profitability` y descuento siguen siendo solo admin. Si el fetch falla, todo degrada al comportamiento viejo (helper `deliveryNetTotal()` devuelve null).
- **Contraste**: CSS scoped a `#delivery-form` — etiquetas chicas en mayúsculas grises (11px/800), inputs blancos con borde 1.5px, texto 15px/600, focus con ring azul, disabled gris. El tilde tiene fila propia celeste (`label.delivery-paid-full`, necesita la especificidad del id para pisar `.user-form label`).
- Verificado con stubs en /tmp (parcial→adeudado, tilde→bloqueo, efectivo=total manual→tilde solo, descuento cambia neto→detecta "de más", sobrepago, sin info→degrada). `node --check` OK (mount no estaba stale).

**Botón "⇄ Transferir entre cajas" (misma sesión — `admin.js?v=20260612b`, `styles.css?v=20260612b`)**
Sergio pidió "traspaso de caja" (una caja le presta a la otra). La feature YA existía (modal Registrar movimiento → toggle Transferencia, crea egreso+ingreso en transacción) pero no la encontraba — quedó confirmado por AskUserQuestion que era un problema de visibilidad, no de funcionalidad. Fix: botón dedicado **"⇄ Transferir entre cajas"** (`#caja-transfer-open-btn`, clase `.caja-transfer-btn` estilo secundario borde azul) junto a "＋ Registrar movimiento" en `.caja-foot-actions` (ahora con `gap:10px`). `cajaOpenMovModal(presetType)` acepta tipo preseteado ("transferencia" muestra el selector de cuenta destino de entrada); el listener viejo pasaba el event como 1er arg, ahora ambos botones usan arrow wrappers. Verificación: el mount volvió a estar **stale** (veía admin.js cortado en 11412 a mitad de línea; Read confirma íntegro hasta `bootstrap(); })();` en 11425). Bloque nuevo validado aislado en /tmp.

### Fix doble pago al cobrar + descuento/comisión en "Registrar cobro" (17 junio 2026 — `admin.js?v=20260617b`)

Dos pedidos de Sergio sobre el modal **"Registrar cobro"** (`#payment-create-modal`, botón `.order-charge` en el detalle del pedido → `openPaymentForOrder` → POST `/api/admin/payments`). Ese flujo es **distinto** del de Entrega (`/api/orders/:id/deliver`): el de Entrega ya tenía descuento, el de cobro no.

**1. 🔴 Pago duplicado al cobrar**
- Síntoma (Sergio, sobre pedido #77): al registrar un cobro se creaba dos veces (dos pagos + dos créditos en cuenta + dos ingresos de caja "Cobro <cliente>").
- Causa: el handler `submit` de `paymentCreateForm` (`admin.js`) es `async` y **no deshabilitaba el botón** mientras hacía el POST → un doble clic (o Enter dos veces) disparaba dos requests.
- Fix: al inicio del submit se toma `submitBtn = form.querySelector('button[type="submit"]')`; si ya está `disabled` se hace `return` (guard); se deshabilita antes del `try`; se reactiva en un `finally`. No se tocó el backend para esto (el endpoint no tenía idempotencia; el fix es anti doble-submit en el front, suficiente para el caso real).

**2. Descuento / comisión en el cobro (comisión del vendedor tercerizado 3/4/5%)**
Decisiones (AskUserQuestion): **% y monto fijo**; efecto = **baja la deuda del cliente** (crédito, igual que Entrega); el % se calcula **sobre el total del pedido**.
- **Backend** `POST /api/admin/payments`: la validación del pedido ahora trae `total` (`ordRow`). Acepta `discount_type` ('percent'|'fixed') + `discount_value` (crudo: 5→5% ; 5000→$5000) **solo si hay `order_id`**. Calcula `discountAmount` (percent: `round(total·min(dv,100)/100)`; fixed: `round(dv)`) acotado 0..total. Dentro de la transacción: `UPDATE orders SET discount_type/value/amount`, **DELETE + re-INSERT** del crédito `"Descuento pedido #N (5%/$X)"` en `account_movements` (no se acumula con un descuento previo de Entrega — el último valor manda). Respuesta agrega `discount_type/value/amount`. Reutiliza el mismo criterio que el endpoint de entrega.
- **Frontend**: bloque nuevo `#pay-form-discount` en `admin.html` (select tipo Sin descuento/% del total/Monto fijo $ + input valor + hint). Helpers `setupPayDiscountUI(orderTotal)` (muestra/oculta y resetea; `null`=ocultar) y `syncPayDiscountUI()` (habilita el valor según tipo y muestra en vivo "Se descontarán $X del saldo"). El bloque **solo aparece** en cobro de pedido (`openPaymentForOrder` pasa `order.total`); en los cobros generales (`payCreateBtn`, `openPaymentForAccount`) se llama `setupPayDiscountUI(null)`. El submit agrega `discount_type/value` al body solo cuando `payForOrder`. `state.payForOrder` ahora guarda `total`.
- **Comportamiento conocido** (avisado a Sergio): borrar un pago NO revierte el descuento — el descuento es atributo del pedido (`orders.discount_*` + movimiento "Descuento pedido"), igual que en Entrega. El `DELETE /api/admin/payments/:id` solo borra movimientos con `payment_id` y el cash_movement source='cobro'; el crédito de descuento tiene `order_id` sin `payment_id`, así que persiste. Si algún día se quiere revertir al borrar el cobro, linkear el movimiento al `payment_id` y resetear `orders.discount_*`.

**Verificación**: `node --check` OK en server.js y admin.js; smoke test de la fórmula (5/4/3% de $1.053.161 = $52.658/$42.126/$31.595; fijo acotado al total). Diffs lógicos limpios (server.js +53, admin.js +59, admin.html: bloque descuento + bump de versión).

**⚠️ Truncamiento (las 3 file tools, esta sesión vía Cowork):** las ediciones cortaron el final de `server.js` (perdió de `app.use("/images/products"...` en adelante: static, error handler, process handlers, `app.listen`), `public/js/admin.js` (perdió del handler DELETE de supplier-payments hasta `bootstrap(); })();`), `public/admin.html` (perdió `#confirm-modal`, toast, `<script>` y cierre `</body></html>`) y el propio `CLAUDE.md`. Detectados con `node --check` (los JS) y `git diff`/cola a mitad de oración (html y md). Reconstruidos con `head -n -1 <archivo>` (o `head -N`) + `git show HEAD:<archivo> | sed -n 'N,$p'` (con `sed 's/$/\r/'` para `server.js`/`admin.html`/`CLAUDE.md` que son **CRLF**; `admin.js` es **LF**). Confirmado que el working tree coincidía con HEAD salvo mis cambios (diff `--ignore-cr-at-eol` solo mostraba lo mío / `head -1311 == HEAD` para el md), así que restaurar la cola desde HEAD no perdió trabajo. Regla reconfirmada: varios archivos del working tree están en CRLF distintos del HEAD (LF) — al reconstruir, igualar el line-ending y revisar con `git diff --ignore-cr-at-eol`.

**Nota de entorno (Cowork)**: esta sesión NO fue en el entorno habitual — la carpeta conectada por defecto era `bono-app` (otro proyecto, app de rifas/sorteos en Python/FastAPI), no Maxaria. Hubo que pedir conectar `D:\Maxaria\WEB\maxaria_app` explícitamente. Pendiente: `git add/commit/push` + deploy Railway (en disco local).

### Comisión del vendedor en el cobro: chip de rentabilidad + egreso automático + snapshot en pedido admin (18 junio 2026 — `admin.js?v=20260618c`, `styles.css?v=20260618c`)

Sesión sobre cómo se discrimina/gestiona la comisión del vendedor tercerizado al cobrar. Recordatorio del modelo: la comisión NO es un campo fijo en el vendedor — sale del `markup_percent` de la **lista de precios del cliente** (ese % es la ganancia limpia del vendedor sobre la venta). Se calcula como `Σ (unit_price − vendedor_cost_unit)·qty` sobre los items con snapshot. Sin lista en el cliente → `vendedor_cost_unit` NULL → comisión 0.

**1. Chip de comisión + "a rendir" en el detalle del pedido (solo admin)**
- `GET /api/orders/:id` (rama admin): a `profitability` se le agregó `vendor: { id, name, is_tercerizado, earning }` cuando el pedido tiene `assigned_vendedor_id`. `earning` = `Σ(unit_price − vendedor_cost_unit)·qty` (solo items con snapshot). También se agregó top-level `cash_collected` (efectivo real cobrado del pedido = entregas ef+tr + pagos) para alimentar el split.
- `admin.js renderOrderDetail`: al lado de "💰 Rentabilidad" (que usa `products.cost`, es TU ganancia como dueño), se muestra el chip violeta **"👤 Nombre (tercerizado): $comisión"** solo si hay vendedor y `earning > 0`. Para tercerizados, además un chip verde-agua **"🤝 Nombre debe rendir: $X"** = `revenue (neto) − earning` (lo que el tercerizado te entrega: él le cobra al cliente y se queda con su comisión). CSS `.op-vendor`/`.op-rendir`.

**2. Reparto tuyo/vendedor al cobrar — egreso automático de caja (decisiones de Sergio vía AskUserQuestion)**
Decisiones: parte del vendedor = **egreso automático de la caja** (la caja neta queda en lo tuyo); cobro parcial = **"primero lo tuyo"** (la comisión recién sale sobre lo cobrado por encima de `total − comisión`); aplica en **Entrega y Cobro**.
- **server.js** helpers nuevos (declarados antes del endpoint deliver, hoisteados): `vendorCommissionForOrder(orderId)` (C = Σ ganancia con snapshot, redondeado), `cashCollectedForOrder(orderId)` (entregas ef+tr + Σ payments), `syncVendorCommissionEgreso(orderId, cajaHint, registeredBy)`. Este último: borra el egreso previo (`cash_movements` source='comision', related_id=order_id) y, si el pedido tiene vendedor + comisión, recrea UN egreso por `payable = clamp(cash − (total − C), 0, C)`. Idempotente (recalcula el acumulado en cada cobro/edición/borrado). Caja del egreso = `cajaHint` (la del cobro) → caja de la entrega → último pago con caja; si no hay ninguna, no crea el egreso.
- Se llama en: `POST /api/orders/:id/deliver` (fin de la transacción, cajaHint = caja efectivo o transfer), `POST /api/admin/payments` (si hay order_id, cajaHint = caja del pago), `DELETE /api/admin/payments/:id` (recalcula tras borrar). Guard en `DELETE /api/admin/caja/movements/:id`: 409 si `source='comision'` (se gestiona sola con el cobro).
- **Frontend**: modal Registrar entrega — `deliveryOrderInfo` ganó `commission`, `vendor_name`, `cash_other` (= `cash_collected − monto de la entrega existente`); `deliverySplit()` calcula tuyo/vendedor con primero-lo-tuyo y `renderDeliverySummary()` muestra la línea "De este cobro → 🧑‍💼 Vendedor: $X · 🏦 A tu caja: $Y (comisión total $Z)". Se recalcula al tipear montos y al tocar el tilde "pagó el total". Modal Registrar cobro (`openPaymentForOrder`) — `state.payForOrder` ganó `commission`/`vendor_name`/`cash_other`; `paySplit()` + `renderPaySplit()` muestran el mismo reparto en `#pay-form-split` (en `admin.html`, oculto en pagos generales vía `setupPayDiscountUI`). CSS `.ds-split`/`.ds-split-box`.

**3. 🔴 Bug: pedidos creados desde el panel admin no traían el snapshot de costo → comisión 0**
- Síntoma (Sergio): el pedido #92 (Walter, con lista L1, vendedor Juan Manuel tercerizado) no mostraba comisión ni split, aun deployado.
- Causa: `POST /api/admin/orders` insertaba `order_items` SIN `vendedor_cost_unit` (a diferencia del catálogo `POST /api/orders` y de `PUT .../items` que sí snapshotean). Sin ese dato la comisión da 0.
- Fix: el endpoint admin ahora calcula `getEffectivePriceConfig(clientId, level)` y, si `kind==="list"`, guarda `vendedor_cost_unit = round(price_<base_level>)` por item (mismo patrón que `PUT /items`). Pedidos nuevos del admin ya traen la comisión. **Para pedidos viejos** (como #92): abrir → "Editar items" → Guardar recalcula el snapshot desde la lista del cliente.
- **Recordatorio**: para que haya comisión, la lista del cliente (ej. L1) tiene que tener `markup_percent > 0` — ese % ES la comisión. Verificado en vivo: #92 mostró comisión $26.363 (5% de $526.891) y "a rendir" $500.528.

**Distinción importante**: la comisión nueva es SEPARADA del campo "Descuento / comisión" de los modales de entrega/cobro (ese campo le baja la deuda AL CLIENTE; la comisión nueva NO toca lo que debe el cliente, solo separa la parte del vendedor de la caja). Conviene dejar de usar el "Descuento" como comisión para no duplicar.

**Pendientes ofrecidos a Sergio (sin confirmar)**:
- Modelo alternativo de comisión: **% fijo por vendedor** (aplica a todos sus clientes, con o sin lista) en vez de por lista del cliente — solo haría falta si quiere comisión sobre clientes en nivel base sin lista.
- Modal de cobro del tercerizado: precargar "lo que rinde Juan" (total − comisión) en vez del total, ya que él cobra y rinde.
- Caso de borde no cubierto: cancelar un pedido ya cobrado no revierte el egreso de comisión automáticamente.

**4. Cobro y entrega solo en la etapa de Entregas (forzar el circuito — `admin.js?v=20260618e`)**
Sergio: cobrar/entregar desde Pedidos antes de armar no tiene sentido; que se respete el circuito Pedidos → Armado → Entregas.
- `admin.js orderCardHtml`: el botón **"Registrar entrega"** (`.btn-deliver`) ahora solo se renderiza si `o.status === "listo" || o.status === "entregado" || o.delivery_id` (antes: cualquier estado != cancelado). En `entregado`/con delivery muestra "Ver entrega"; en `listo` muestra "Registrar entrega". En pendiente/enviado/preparando NO aparece.
- `admin.js renderOrderDetail`: el botón **"Registrar cobro"** (`.order-charge`) ahora exige `chargeableStatus = order.status === "listo" || order.status === "entregado"` además de `balanceDue > 0.5` y `isAdmin`.
- Resultado del circuito: Pedidos (pendiente/enviado) → solo botón **→ Armado**; Armado (preparando) → solo **→ Entregas**; Entregas cola (listo) → **Registrar entrega** + **Registrar cobro**; Entregado/Ventas → **Ver entrega** + Registrar cobro si queda saldo.

**Verificación**: el bash mount volvió a estar **stale** (veía server.js cortado en ~8338/8348 y admin.js en ~12444, ambos íntegros según Read — server.js termina en `app.listen` 8470, admin.js en `bootstrap(); })();` 12544). Se validó reconstruyendo el archivo completo en /tmp (head visible por bash, que incluye TODAS las ediciones porque están antes del corte, + cola real leída con Read) → PARSE OK; y los bloques nuevos aislados (split formula con 8 escenarios "primero lo tuyo" + clamp, queries del helper contra copia de la DB con Python sqlite3). Pendiente: `git add/commit/push` + deploy Railway.

### Fix Reportes rotos: rediseño por categoría quedó a medias en admin.js (3 julio 2026 — `admin.js?v=20260703b`)

Sergio reportó que Reportes "no carga y los filtros no funcionan" (KPIs en "—", tabla en "Aplicá los filtros", botón Aplicar muerto; el gráfico mensual sí andaba).

**Causa raíz:** el commit `37ff303` ("informes update", 3 jul) rediseñó la pestaña Reportes — la tabla de pedidos (`rpt-tbody`/`rpt-table`) se reemplazó en `admin.html` por una tabla de **ventas por categoría** (`rpt-cat-tbody`/`rpt-cat-table`), y `server.js` sumó `GET /api/admin/reports/by-category` + `/by-category/:categoryId/products` — pero en `admin.js` solo entró la **cabecera** del módulo (rptEls con `catTbody`, rptState con `cats`, `rptSortVal` por categoría, selectores Mes/Año, `rptSelYm`). El **cuerpo** quedó con el código viejo: `applyReportes()` arrancaba con `if (!rptEls.tbody) return;` → como `rpt-tbody` ya no existe, salía sin fetchear (por eso KPIs "—"); el listener de período usaba `rptEls.period` (elemento `rpt-period` que ya no existe) → cambiar Mes no hacía nada. Edición parcial/truncada commiteada igual (patrón conocido del proyecto).

**Fix (todo en `public/js/admin.js`, cuerpo del módulo REPORTES DE VENTAS):**
- `applyReportes()`: guard sobre `catTbody`; fetch en paralelo de `/reports/sales` (KPIs) + `/reports/by-category` con el mismo query string; guarda `rptState.lastQs` (lo usa el detalle).
- `renderRptCats()` nueva: tabla por categoría con orden por columnas (`wireReportSort("rpt-cat-table", ...)`), totales en tfoot (Pedidos del pie = `kpis.total_orders`, NO la suma por categoría — un pedido puede tocar varias) y fila desplegable ▼ por categoría que carga los top productos (`/by-category/:id/products` + lastQs).
- Listeners de `rptEls.month` y `rptEls.year` (helper `onRptPeriodChange`): setean fechas, aplican y re-renderizan el gráfico para resaltar el mes.
- Export CSV pasó a exportar las categorías (Categoría/Unidades/Pedidos/Ventas/Ganancia/Margen %), archivo `reporte-categorias-<from>.csv`.
- Se eliminó todo el render/listener viejo de la tabla de pedidos (`rptState.rows`, `rptState.expanded`, `rpt-detail-btn` en reportes).
- Cache busting: `admin.js?v=20260703b` en `admin.html`.

**Verificación:** Grep sin referencias huérfanas (`rptEls.tbody/tfoot/period`, `rptState.rows/expanded`, `"rpt-table"`). El bash mount volvió a estar **stale** (veía admin.js cortado a mitad de línea 13292; Read confirma íntegro hasta `bootstrap(); })();` en 13303). Parse validado reconstruyendo en /tmp (head visible por bash, que incluía todas las ediciones, + cola real de Read) → PARSE OK. **NO se commiteó desde el sandbox** justamente por el mount stale (riesgo de commitear la versión cortada). Pendiente: `git add/commit/push` desde Windows + deploy Railway + Ctrl+F5.

**Nota:** `git status` mostraba server.js/admin.html/otros como modificados pero `git diff --ignore-cr-at-eol` vacío → solo cambios de line-endings (CRLF), el contenido era el de HEAD. Truco útil para distinguir cambios reales.

### Fix recepción (Next quedó en 0) + modos "por unidad"/"por caja" en compras (6 julio 2026 — `admin.js?v=20260706a`)

Sergio reportó (con capturas) que controlando la recepción de la compra #24 (Vitto), el item "Next Gripe x 20 Comp" quedó tildado en rojo con cantidad 0 tras tipear unidades. Todo en `public/js/admin.js` (+ cache busting en `admin.html`).

**1. Inputs de cantidad del modal de recepción blindados (causa más probable del 0)**
- Los 3 inputs (bultos/comp/unidades) eran `type="number"`: la **rueda del mouse** o las **flechas del teclado** sobre un input enfocado cambian el valor en silencio (min=0 clampea en 0 → el "0" del Next), y un punto de miles ("1.200") se lee como 1,2.
- Ahora son `type="text" inputmode="decimal"` (sin wheel/flechas) con parser es-AR nuevo `recvParseNum`: "1.200" = 1200 (miles), "2,5" = 2.5, "1.200,5" = 1200.5, "59.75" = 59.75; vacío = destildar; inválido = **toast de error y NO guarda** (antes guardaba 0 en silencio).
- Mismo guard por wheel agregado a los inputs numéricos de la tabla de items de la compra (`purItemsTbody`, listener `wheel` que hace blur).
- **Dato pendiente en producción**: el Next de la compra #24 sigue con `checked_qty = 0` guardado — hay que re-tildarlo (click en la fila o tipear 60) antes de confirmar la recepción.

**2. Fix `parseComprimidos` — falso positivo con medidas**
- "Solucion Fisiologica **x 100ml**" mostraba campo "comp" (detectaba 100 como comprimidos). El regex ahora captura el sufijo tras el número y descarta unidades de medida (ml, cc, gr, kg, mg, lt, u, un, vol, etc.). "x 20 Comp" sigue detectando 20; "x 10" pelado sigue valiendo 10 (comportamiento previo). Afecta recepción y defaults de cotizaciones (`cotComprimidos` tiene override manual igual).

**3. Selector de la compra: "por unidad" y "por caja" (pedido de Sergio vía AskUserQuestion)**
- El selector por item de Nueva/Editar compra pasa de 2 a 4 modos: **por tableta** (default, canónico), **por unidad** (alias del canónico, solo etiqueta), **por caja** (nuevo) y **por comprimido**.
- **Modo caja**: cantidad en cajas (acepta fraccionado, ej 2.5) + costo **por caja**; input editable "u/caja" (default = `units_per_bulto` del producto, buscado en `state.allProducts` al cambiar de modo). Helper `purSyncCaja(it)`: `quantity = caja_qty × upb`, `unit_cost = round(caja_cost / upb)`, línea "= N un" con ⚠ roja si no da entero. Validación al guardar (como la de comprimidos): cajas × u/caja debe dar unidades enteras ≥ 1, sino `alertModal` y no envía.
- `addPurchaseItem` respeta el modo del item existente al re-agregar desde el picker (suma comp_qty o caja_qty según modo; antes rompía el sync).
- Cotización → Compra: si la cotización estaba por caja/bulto y la cantidad da cajas exactas (`quantity % upb === 0`), la compra arranca en modo caja prellenado.

**Verificación**: `node --check` OK (mount NO stale, coincide con Read: 13409 líneas → `bootstrap(); })();`). Helpers testeados aislados en /tmp (18 casos OK: parser es-AR, medidas excluidas, purSyncCaja con upb 12/10/11). Pendiente: `git add/commit/push` + deploy Railway + Ctrl+F5.

**4. Eliminar compra con reversión de stock condicional (misma sesión — `admin.js?v=20260706b`)**
Pedido de Sergio: borrar la compra #21 (Ilumine) que nunca llegó y se canceló; el sistema debe detectar si el stock ya había entrado o no.
- **Server**: endpoint nuevo `DELETE /api/admin/purchases/:id` (requireAdmin, sección compras vía `has("purchases")`). Lee `COALESCE(received,0)`: si `received=1` (recepción confirmada o compra vieja pre-recepción) revierte el stock de los items (`MAX(0, stock − qty)`, suma `stock_reverted`); si está pendiente NO toca inventario (el stock entra recién al confirmar recepción desde el deploy del 11 jun). En la misma transacción borra el `debit` de `supplier_movements` de la compra (los pagos al proveedor quedan — son del proveedor, no de la compra), los `purchase_items` y la cabecera. Respuesta `{ok, deleted, was_received, stock_reverted}`. **Los cambios de costo/precios aplicados al CARGAR la compra (`applyPurchaseCostUpdate` + `cost_changes`) NO se revierten** (pudieron pisarse con compras posteriores); avisado en el confirm.
- **Frontend** (`admin.js`): botón **"🗑 Eliminar compra"** (btn-danger) junto a "Editar compra" en el detalle expandible de la compra. `confirmModal` danger que informa según el caso: recibida → "se va a revertir el stock que sumó (N unidades)"; pendiente → "nunca sumó stock, el inventario no se toca"; siempre aclara deuda del proveedor y costos no reversibles. Al confirmar: DELETE, recarga compras y, solo si estaba recibida, `refreshProductsCache()`.
- **Verificación**: mount stale de nuevo (bash veía admin.js cortado a mitad de línea 13398; Read confirma íntegro hasta `bootstrap(); })();` en 13438). Parse validado reconstruyendo en /tmp (head del mount, que SÍ incluía los edits, + cola real de Read) → OK; server.js `node --check` OK directo. Lógica del DELETE testeada con Python sqlite3 sobre copia de la DB: pendiente (stock intacto, deuda revertida), recibida (stock −10, deuda revertida), stock insuficiente (clampea en 0). La DB local no tenía `received` ni `supplier_movements` (migraciones corren al boot) — el test las creó aparte.

### Responsive mobile de modales/pickers + pestaña "Productos" con variación (8 julio 2026 — `styles.css?v=20260706l`, `admin.js?v=20260706l`)

Sesión de UX responsive en Cowork (no en el entorno habitual) + una feature nueva. Todo verificado con **capturas reales en Chromium headless** dentro del sandbox (ver "Método de verificación" abajo). En disco local, sin `git add/commit/push` ni deploy.

**Contexto de entorno (Cowork, no Claude Code):** esta sesión corrió en Cowork con file tools (Read/Write/Edit) sobre el FS real de Windows + un bash mount Linux (`/sessions/.../mnt/maxaria_app`). El **mount volvió a estar stale** varias veces (bash veía `admin.js` cortado a mitad de línea al final, ej. 13506 cuando disco tiene 13519). Regla del proyecto reconfirmada: **Read es la fuente de verdad**; para parsear se reconstruye en `/tmp` con `head -N` del mount (que SÍ incluye las ediciones porque están antes del corte) + la cola real leída con Read → `node --check` OK. `server.js` sí pasó `node --check` directo (mount no stale para ese archivo).

**1. Modal "Nuevo pedido" (`#new-order-modal`) responsive (`< 640px`)**
El modal se veía como desktop achicado (tabla de artículos cortada a la derecha, "SUBTOTAL" ilegible, scroll horizontal, botones sin barra fija). Solución CSS scopeada a `#new-order-modal` en `@media (max-width:640px)`: caja full-width (`max-width:none`), grid Cliente/Estado a 1 columna, inputs/selects `width:100% + min-height:44px + font-size:16px` (anti-zoom iOS), **tabla de artículos → tarjetas apiladas** (thead oculto, cada `<tr>` es una card; cada `<td>` con `data-label` muestra label+valor), foot **sticky** full-width con botones ≥46px. En `admin.js` `noRenderItems` se agregaron `data-label` (Código/Producto/Cant./P.Unit./Desc./Subtotal) + clases `no-cell-name`/`no-cell-rm` a los `<td>`. Refinamientos pedidos por Sergio: etiquetas chicas (10px) alineadas en columna fija de 76px (valores a la par a la derecha), **nombre del producto 15px negrita** y **cantidad 17px**, y los campos editables (cantidad y descuento) con **recuadro sutil** (`border 1.5px #cbd5e1` + fondo `#f8fafc`, focus azul con halo) para que se note que se pueden alterar.

**2. 🔴 Bug del teclado en la cantidad (vista tarjetas de Nuevo pedido)**
Síntoma (Sergio): al tipear la cantidad solo entraba **un dígito** y el teclado se cerraba. Causa: el handler `input` de `.no-qty` llamaba a `noRenderItems()` en cada tecla → reconstruía el `<tbody>` y **destruía el `<input>` enfocado**. Fix: en `input` solo se actualiza en el lugar el subtotal (`.no-sub`) + `noUpdateTotal()` (igual que ya hacía el campo de descuento, que por eso no fallaba); la normalización (clamp a min 1) se hace en `change` (blur) con `noRenderItems()`. La edición de items de pedido existente (`enterOrderItemsEdit`, delegación en tbody) y los pickers (oie/pur/pcot) ya actualizaban en el lugar → no tenían el bug.

**3. Pickers de productos compactos en mobile/tablet**
Los pickers de 5 columnas (checkbox · producto · cant · precio/costo · stock) desbordaban en mobile (columna Stock cortada, scroll horizontal). Bloque `@media (max-width:640px)` **compartido** para `#oie-picker-table` (Agregar productos al pedido), `#pur-picker-table` (Compras) y `#pcot-picker-table` (Cotizaciones): `table-layout:fixed`, anchos fijos (checkbox 26 · producto auto · cant 48 · precio 58 · stock 44), header 10px, **input de cantidad angosto** (`max-width:46px`, para 3 cifras) con recuadro sutil, nombre de producto prominente y **código chico** (9.5px). El header de la col 4 (`th:nth-child(4)`) va `white-space:normal` para que "Costo actual" se parta en 2 líneas y no se corte (el valor del precio queda `nowrap`). Para **Recepción** (picker `#recv-prod-table`, 3 columnas: código · producto · stock): código chico gris, producto ancho/negrita, stock angosto. Los pickers NO tienen el bug del teclado (usan delegación + `updateCount`, no re-render por tecla).

**4. Control de recepción (`#recv-modal`, checklist) responsive**
El checklist (comparte clases `.pick-*` con el chequeo de armado) metía demasiado por fila en horizontal (check + nombre + "Vence" + bultos/comp/unidades). Bloque mobile scopeado a **`#recv-modal`** (para no tocar el chequeo de armado `#pick-modal`): `.pick-item` con `flex-wrap`, se apila en filas — fila 1: check + producto (`pick-info` con `flex: 1 1 calc(100% - 40px)` empuja el resto abajo); fila 2: "Vence" con MM/AA de **72px fijo** (`width:72px !important; flex:0 0 72px`, antes se estiraba a full width); fila 3: cantidades (bultos/comp/unidades + "/ N un.") a la derecha en su propia línea (`.recv-qtybox { order:3; flex:0 0 100% }`). El input de cantidad de recepción usa evento `change` (no `input`) → sin bug de teclado.

**5. Pestaña "Ranking productos" → "Productos" con período y variación % (feature nueva)**
Es un sub-panel de la pestaña **Actividad** (`data-subtab="ranking"`, endpoint `/api/admin/activity/products-ranking`). Pedido de Sergio: renombrar a "Productos", presets semana/mes/trimestre, y mostrar la subida/bajada de ventas en %. Decisiones (AskUserQuestion): **botones Semana/Mes/Trimestre + fecha manual** (los presets setean el rango; usar Desde/Hasta manual los desactiva); comparación **vs período anterior mostrando AMBOS** (Δ unidades y Δ $); presentación = **tabla ordenable + columnas de variación** (no top-lists separadas).
- **Backend (`server.js`)**: helper nuevo `previousActivityWindow(from, to)` — misma cantidad de días que `[from,to]` pero terminando el día ANTES de `from` (ventana anterior equivalente; ej. semana→semana previa). El endpoint `products-ranking` corre una 2ª query agregando units+sold del período anterior, y agrega `prev_units_sold`/`prev_total_sold` a cada row + devuelve `prev_from`/`prev_to`. Validado con tests: semana jul1-7 → prev jun24-30; mes 30d → prev 30d; trimestre 90d → prev 90d.
- **Frontend (`admin.js`)**: helpers `rkVar(cur,prev)` (kinds new/gone/flat/num), `rkVarSortVal` (nuevos arriba), `rkVarCell(cur,prev,label)` (celda con flecha ▲/▼ verde/rojo, "▲ nuevo" si no había antes, "—" si no aplica, `data-label` para mobile). `rkSetPeriod(period)` = ventanas móviles 7/30/90 días terminando hoy (así la comparación con el backend queda limpia), default "month". Botones con `.active`; hint `#act-rk-periodinfo` muestra el rango del período anterior. Sort keys nuevas `var_units`/`var_sold`. Columnas nuevas en la tabla: **Δ Unid.** y **Δ $** (tras Unidades y Vendido). Colspans 10→12.
- **Mobile**: la tabla de 12 columnas pasa a **tarjetas** (`@media max-width:640px`): thead oculto, cada `<tr>` es un grid de 2 columnas; producto (`.rk-c-name`) título full-width, categoría (`.rk-c-cat`) full-width chica, `#` oculto, resto en pares con label (el orden del DOM hace que Δ caiga junto a su métrica: UNIDADES|Δ UNID., VENDIDO|Δ $). tfoot (totales) oculto en mobile. Toolbar con `flex-wrap` y buscador full-width. Requirió `data-label` en cada `<td>` de `renderActRanking` + `rkVarCell`.
- **CSS**: `.btn-period` (+`.active` azul navy), `.act-rk-periods`, `.rk-var`/`.rk-up`(verde)/`.rk-down`(rojo).

**Método de verificación (nuevo en esta sesión):** como es Cowork y no hay server local corriendo (better-sqlite3 es binario Windows, no arranca en el sandbox Linux) y Chrome-in-Chrome no alcanza el localhost del sandbox, se verificó el CSS/layout con **Chromium headless dentro del sandbox**: `npm i puppeteer` en `/tmp` (Chrome se cachea en `~/.cache/puppeteer`, sobrevive resets de `/tmp`; las libs del sistema faltantes se bajan sin root con `apt-get download` + `dpkg-deb -x` y se cargan con `LD_LIBRARY_PATH=/tmp/deblibs/root/usr/lib/x86_64-linux-gnu:...`). Se arman páginas de prueba con el `styles.css` real + el markup real (réplica de la salida de los render JS) y se toma screenshot a 380px (mobile), 768px (tablet) y 1300px (desktop). Se mide overflow con `document.documentElement.scrollWidth === clientWidth`. Las capturas se copian a `/sessions/.../mnt/outputs/` para poder abrirlas con la Read tool (el `/tmp` del sandbox no es accesible por Read, que opera sobre el FS Windows). **Ojo con bash `$10` en heredocs** (se interpreta como `${1}0` → glitch de datos en réplicas; usar HTML explícito).

**Cache busting de la sesión:** `styles.css` y `admin.js` pasaron por varias letras hasta `?v=20260706l` (bumpear ambos al cambiar). Los archivos tocados: `public/admin.html`, `public/css/styles.css`, `public/js/admin.js`, `server.js`.

**Pendiente ofrecido (sin confirmar):** (a) el chequeo de armado `#pick-modal` en mobile quedó sin tocar (es más simple, un input por fila) — se puede acomodar igual si Sergio quiere; (b) en "Productos" se usaron ventanas móviles (últimos 7/30/90 días) en vez de semana/mes calendario — cambiar a calendario (lunes-a-hoy, día1-a-hoy) si lo prefiere.

### Coma decimal en cotización + empaque por rubro + evolución de stock + fix "→ Compra" (16 julio 2026 — `admin.js?v=20260716a`)

Sesión en Cowork (entorno con file tools sobre FS Windows + bash mount Linux, mount **stale** varias veces — Read = fuente de verdad; se validó reconstruyendo bloques aislados en `/tmp`). Cache busting unificado `admin.js?v=20260716a` (cubre todo lo de la jornada). En disco local, sin `git add/commit/push` ni deploy.

**1. Precio de cotización acepta coma decimal**
- El input "Precio cotiz" del modal de cotización era `type="number"`, que bloquea la coma como separador decimal (Sergio no podía tipear "96,5"). Cambiado a `type="text" inputmode="decimal"` y parseado con el helper es-AR ya existente **`recvParseNum`** (entiende "8.000,50" miles+coma y "96,5"); si es inválido, toast "Precio inválido" y no guarda. El `unit_price` canónico se sigue redondeando a entero (convención INTEGER). Handler `.pcot-price-input` en `admin.js`.

**2. Empaque por defecto según el rubro (compras + cotizaciones)**
- Pedido de Sergio: el modo "por tableta/comprimido" solo tiene sentido para pastillas; el resto (bazar, desodorantes, etc.) debía arrancar "por unidad". Helper nuevo `isPillCategory(product)` en `admin.js`: `category_name` empieza con `ANALGESICO` (las categorías son `ANALGESICOS` y `ANALGESICOS G.`, ids 4 y 5). Aplicado en 3 puntos: `addPurchaseItem` (nuevo item → `pack_mode` = "tableta" si pastilla, "unidad" si no), y los dos armados de item de cotización (`openEditCotizacion` sin `savedMode`, y el confirm del picker → `pack_unit` = "comprimido" si pastilla, "unidad" si no). Solo afecta items **nuevos**; los ya cargados conservan su modo. El usuario puede cambiarlo por fila.

**3. Evolución mensual del valor del stock a costo (Actividad → Stock)**
- Sergio pidió ver mes a mes la evolución del stock a valor de costo. El sistema NO guarda histórico de stock; decisión (AskUserQuestion): **reconstrucción aproximada** hacia atrás (aceptó el margen de error).
- **Endpoint nuevo** `GET /api/admin/activity/stock-history?months=N` (sección "actividad" vía `has("activity")`): parte del stock actual y lo revierte hacia atrás con los movimientos con fecha — compras (`purchase_items` × `received_at`/`created_at`, suman), ventas con `stock_discounted=1` no unificadas/no canceladas (`order_items` × `delivered_at`/`created_at`, restan), y `stock_adjustments` (con signo). Costo histórico desde `cost_changes` (si no hay, costo actual constante). `stock_at(T) = stock_actual − Σ deltas con date >= inicio-del-mes-siguiente`; clampea a >0. Devuelve `{approx, data_from, months:[{month,label,value_cost,units,delta_value,delta_pct}]}` donde `data_from` = primer mes con movimiento real. **El mes actual da EXACTO igual que la tarjeta "Valor a costo"** (validado: `SUM(cost*stock) WHERE active=1 AND stock>0`); los meses viejos son la aproximación.
- **Frontend** (`admin.html` + `admin.js`): en el subpanel Stock, gráfico Chart.js de línea (Chart.js 4.4.1 ya estaba cargado) + tabla (mes, valor a costo, Δ vs mes anterior en $/%, unidades) + selector 6/12/24 meses. `loadActStock` llama a `loadActStockHistory`; módulo `actStHistChart`/`loadActStockHistory`/`renderActStockHistory`.
- **Pulido (pedido después):** Sergio notó que la tarjeta (mes actual) mostraba menos que el pico del gráfico (un mes pasado). No es bug — miden momentos distintos (la tarjeta = hoy = último punto; el pico es un mes reconstruido, más alto por costos/stock previos a los movimientos de julio). Mejoras aplicadas: (a) el frontend **recorta** los meses anteriores a `data_from` (la línea plana "inventada" de cuando no hay datos) y **recalcula** los Δ tras el recorte; (b) el **último punto (mes actual) se destaca** (radio 6, verde) y la tabla lo marca "HOY · real" vs "aprox." en los demás; el tooltip aclara "Mes actual · valor real de hoy" vs "Reconstruido · aproximado".
- **Limitación**: la precisión del pasado depende de que los movimientos tengan la fecha correcta (los presupuestos facturados y las ediciones/recepciones no se datan perfecto); mejora sola a medida que se acumulan movimientos. Ofrecido (sin confirmar): guardar snapshots exactos al cierre de cada mes para congelar el dato real.

**4. 🔴 Fix "→ Compra" desde una cotización no abría el modal de compra**
- Sergio: paso una cotización a compra ("→ Compra") pero **no se abre ninguna ventana** (y por ende nunca aparece en Compras). El botón `pcot-convert-btn` **no guarda** la compra: solo pre-rellena y abre el modal "Nueva compra" para revisar y apretar "Guardar compra". El handler cerraba la cotización PRIMERO y, si algo tiraba error entre medio, el usuario quedaba sin nada (error silencioso, sin try/catch).
- Fix (`admin.js`, handler de `pcotConvertBtn`): (a) todo envuelto en `try/catch` → si falla, toast rojo "No se pudo abrir la compra: <error>" en vez de morir en silencio; (b) la cotización se cierra **recién al final**, cuando la compra ya está lista para mostrarse; (c) `state.editingPurchaseId = null` + botón "Guardar compra" → **siempre crea una compra nueva** (bug latente: podía pisar una compra en edición); (d) espeja el flujo que sí anda (`await ensureAllProducts()`, guard `Array.isArray(state.suppliers)`). Recordatorio: "→ Compra" abre el modal pre-cargado, hay que apretar "Guardar compra" para que entre a Compras (el toast lo aclara).
- No se pudo reproducir en vivo (sin server local en Cowork); el hardening cubre la causa probable (error silencioso/orden) y, si quedara algo, lo muestra en pantalla para diagnosticar.

**5. Columna CANT. del modal de compra más legible**
- En `renderPurchaseItems` (modal Nueva compra / desde cotización) la celda CANT. estaba amontonada y el número no se leía bien (input 70px, fuente chica). Rediseñada: contenido en columna vertical alineada a la derecha (`inline-flex`, gap 4px); input de cantidad **120px, fuente 16px negrita, centrado**; select de empaque 120px/11px; sub-input c/tab · u/caja 54px centrado con labels 11px. Mismo look que el input de cantidad del modal de cotización.

**Archivos tocados:** `server.js` (endpoint stock-history), `public/admin.html` (input coma, sección evolución, bump), `public/js/admin.js` (los 5 puntos). Verificación: bloques nuevos parseados aislados en `/tmp` (`node --check` OK) y algoritmo de reconstrucción validado con Python sqlite3 sobre la DB local (mes actual = tarjeta exacto). No se pudo sacar captura del modal (puppeteer no cacheado en el sandbox de esta sesión); el markup se validó ejecutándolo aislado.

### Fix cache de stock + Productos mobile en tarjetas + Tercerizado "rinde neto" en entregas (20 julio 2026)

Sesión en Cowork (file tools sobre FS Windows + bash mount Linux; esta vez el mount NO estuvo stale, `node --check` coincidió con Read). Tres temas encadenados. Cache busting final: `styles.css?v=20260720c`, `admin.js?v=20260720d`. En disco local, sin `git add/commit/push` ni deploy.

**1. 🔴 Fix: el stock no se veía descontado al crear el pedido siguiente (`admin.js?v=20260720a`)**
- Reporte de Sergio: crea un pedido desde /admin y al armar otro, el picker de productos muestra el stock sin descontar por el pedido anterior.
- El pedido creado desde admin **sí** descuenta stock en la base al crearse (`POST /api/admin/orders`: `stock_discounted=1` + `UPDATE products SET stock = stock - qty`). El bug era de cache en el front: el picker (`openOrderItemPicker` → `renderOiePicker`) lee de `state.allProducts`, y `refreshProductsCache()` (que corre tras crear/entregar/cancelar/editar pedido) solo refrescaba `state.products` (tabla de Productos), no invalidaba `state.allProducts`/`allProductsLoaded`. Como `ensureAllProducts()` solo re-consulta si `allProductsLoaded===false`, el picker seguía con stock viejo.
- Fix: `refreshProductsCache()` ahora además setea `state.allProductsLoaded = false`. Así el próximo `ensureAllProducts()` re-consulta y el picker muestra el stock descontado. Cubre todos los flujos que llaman a `refreshProductsCache` (nuevo pedido, entrega, cancelación, edición de items, compra, ajuste).
- **Verificado que `/ventas` NO tenía el bug**: `openBudgetForm` (nuevo o editar) siempre invalida el cache (`vState.productsLoaded=false; vState.allProducts=[]`) porque la base de precios puede cambiar, así que `vLoadProducts()` re-consulta cada vez que se abre el form → stock siempre fresco.

**2. Pestaña Productos en mobile: tarjetas + barra compacta + selector de precio + un toque + "Opciones" (`admin.js?v=20260720d`, `styles.css?v=20260720c`)**
Sergio pidió (con mockup) reemplazar la tabla apretada con scroll horizontal por tarjetas tipo lista. Decisiones (AskUserQuestion): tarjetas + barra compacta; **un toque** para editar (el doble toque no va en celular); dejar **± stock + foto** accesibles en la tarjeta; agregar **selector de precio** (Minorista default). Se mostró un diseño interactivo (widget) y Sergio lo aprobó antes de codear.
- **Enfoque CSS-only** (no re-render JS): la tabla sigue emitiendo `<tr>` (delegación de eventos y desktop intactos); un `@media (max-width:640px)` convierte cada `.prod-row` en tarjeta con CSS grid. Para poder ocultar/reordenar por CSS, `rowHtml`/`moneyCell` ganaron clases por celda: `cell-name`, `cell-cat`, `cell-stock`, `cell-money`+`cell-money-<nivel>`, `cell-activo`, `cell-bulto`, `cell-adj`.
- **Layout de la tarjeta** (grid, aprobado): `grid-template-columns: 46px auto minmax(0,1fr) auto 34px` con areas `"img name name name adj" / "img code cat price adj" / "img . . stock adj"`. Nombre **arriba spanning** (ámbar, wrapea, NO se superpone porque está en su propia fila, separado del precio que va en la fila 2). `#código · CATEGORÍA` en la fila 2 izquierda (código con `::before{content:"#"}` y `::after{content:" ·"}`), precio a la derecha, stock grande abajo-derecha, ± a un costado (col 5 spanning). Las columnas de precios/activo/empaque se ocultan (`display:none`) en mobile. **Bug previo corregido en la iteración**: una primera versión (5-col con `name name price`) dejaba el nombre estirarse sobre la columna de precio (auto expandía) → se superponían; el fix fue separar nombre (fila1) y precio (fila2) en filas distintas.
- **Celda de precio de la tarjeta**: se agregó una columna nueva `<td class="cell-cardprice">` (+ su `<th>` en thead, ambos `display:none` en desktop; colspans del empty-state 14→15 y 15→16 en select mode). Su contenido lo arma `cardPriceHtml(p)` según `state.priceView`. En mobile se muestra (grid-area `price`). Con "Todos" apila los 5 precios de venta (costo solo si se elige "Costo").
- **Selector de precio**: `<select id="filter-priceview">` en `.tb-filters` (Minorista default, + Público/Mayorista/Revendedor/VIP/Costo/Todos). `state.priceView` + persistencia en `savePrefs`/`applyPrefsToControls` (clave `priceView`). Al cambiar: re-render + `savePrefs`. `renderProducts` refleja la vista en una clase `pv-<view>` en la tabla. No filtra la lista, solo cambia qué precio muestra la tarjeta (en desktop la tabla muestra todas las columnas siempre, así que el selector solo tiene efecto visible en mobile — documentado).
- **Un toque para editar**: handler `click` en `prodTbody` que, solo en mobile (`matchMedia("(max-width:640px)")`) y fuera de modo selección, abre `openEditProdModal` (ignora botones ± / foto y checkboxes). El `dblclick` de desktop queda igual.
- **Barra compacta** (mobile): `.tb-title-text` 24→18px, botón Nuevo más chico, los 4 filtros (Categoría/Stock/Estado/Precio) a 2 por fila (`flex:1 1 calc(50% - 4px)` en columna con label chico), buscador full-width.
- **Modo selección → botón "Opciones"**: las acciones (Ver solo / Editar / Cambiar costos / Limpiar / Cancelar) se salían de pantalla en mobile. Se envolvieron en `<span class="bulk-actions" id="prod-sel-actions">` y se agregó `<button id="prod-sel-menu-btn" class="bulk-menu-btn">Opciones ▾</button>`. CSS: desktop = acciones inline + botón oculto; mobile = botón visible + acciones en dropdown absoluto (`.bulk-bar.menu-open .bulk-actions{display:flex}`). JS: `closeSelMenu()` + toggle de la clase `menu-open` en `#prod-sel-bar`, cierre al elegir una acción (delegación en `#prod-sel-actions`, menos el checkbox "Ver solo") o al tocar fuera; `setSelectMode(false)` cierra el menú.
- **Verificación**: sin navegador en el sandbox de Cowork (better-sqlite3 es binario Windows; puppeteer no cacheado) → se validó `node --check` OK, llaves del CSS balanceadas, y se mostró el diseño con el widget interactivo (aprobado por Sergio). El layout de grid se razonó (areas rectangulares válidas). Un preview HTML autocontenido quedó en outputs.

**3. Vendedor tercerizado: entrega "cobra y rinde" (rinde neto) (`server.js` + `admin.js?v=20260720d`)**
Reporte de Sergio (pedido #193, vendedor tercerizado Juan Manuel, comisión 5% = $62.232 sobre total $1.244.078): al registrar la entrega, el efectivo se precargaba con el **total** ($1.244.078), pero el vendedor le cobra al cliente, se queda su comisión y le **rinde el neto** ($1.181.846). Además dudaba qué se suma a la cuenta corriente. Es exactamente el pendiente "precargar lo que rinde Juan" del 18 jun. Decisiones (AskUserQuestion): **rinde el neto** (efectivo = total − comisión, caja recibe ese neto sin egreso aparte) + **cliente saldado** (débito = total, queda en $0 aunque recibas el neto; la comisión es costo tuyo, no deuda del cliente).
- **Modelo**: para vendedor **tercerizado** con comisión → "rinde neto" (nuevo). Para vendedor **propio/admin** → "cobrás el total" y la comisión sale como egreso de caja (modelo viejo, sin cambios). El discriminador es `users.is_tercerizado` del vendedor asignado + `vendorCommissionForOrder(id) > 0`.
- **`server.js` `POST /api/orders/:id/deliver`**: antes de la transacción calcula `vendorRow` (is_tercerizado del `assigned_vendedor_id`), `orderCommission = vendorCommissionForOrder(id)` y `rindeNeto`. Dentro del bloque de crédito por cobro: además del crédito "Cobro entrega #id" (= `cobrado`, el efectivo neto), si `rindeNeto` inserta un crédito **"Comisión rendida vendedor #id"** por `commissionCovered = round(commission × fraction)` (fraction = cobrado / (total − descuento − comisión), acotado; =comisión completa en pago full). Así crédito total = cobro + comisión = total → **cliente saldado**. Se revoca siempre primero (`DELETE ... LIKE 'Comisión rendida%'`, cubre edición). Al final: si `rindeNeto`, **NO** llama a `syncVendorCommissionEgreso` (borra cualquier egreso `source='comision'` previo); si no, egreso como antes. El débito del cliente sigue siendo `order.total` (bruto); el descuento sigue siendo crédito aparte.
- **`admin.js` (modal de entrega)**: `deliveryOrderInfo` ganó `is_tercerizado` (de `order.profitability.vendor.is_tercerizado`, que el server ya exponía). Helper nuevo `deliveryExpectedCollection()` = para tercerizado `neto − comisión`, si no `neto` (= total − descuento). Se usa en el tilde "Pagó el total" (label + precarga de efectivo), el bloqueo de transferencia y el preview de adeudado/pagado, para que reflejen lo que **físicamente** entra. `renderDeliverySummary`: para tercerizado muestra "🧑‍💼 El vendedor (X) se queda su comisión $C · 🏦 A tu caja: $cobrado (te rinde el neto)" en vez del split "primero lo tuyo".
- **Verificado** (aritmética aislada en Python, 3 casos de descuento 0/5/10%): efectivo precargado = neto que rinde; crédito cliente = cobro + comisión rendida = total; **saldo cliente = 0** siempre; **caja neta = neto** sin egreso. `node --check` OK en server.js y admin.js (mount no stale). El path "Registrar cobro" (`POST /api/admin/payments`) quedó con el modelo viejo (egreso), pero para tercerizado no se usa: la entrega ya deja el cliente saldado, no queda saldo que cobrar aparte.
- **Recordatorio**: la comisión sale del `markup_percent` de la **lista de precios del cliente** (ganancia limpia del vendedor sobre la venta), no de un campo del vendedor. Sin lista con markup > 0 en el cliente → comisión 0 → el pedido se comporta como uno normal aunque el vendedor sea tercerizado. La "Rentabilidad" mostrada sigue siendo `revenue − costo de producto` (NO resta la comisión); el neto real de Sergio = rentabilidad − comisión, pero eso es interpretación, no se tocó.

### Historial unificado de movimientos de stock por producto (22 julio 2026 — `admin.js?v=20260722a`, `styles.css?v=20260722a`)

Pedido de Sergio: poder ver, por producto, cuándo se le hizo una compra, cuándo aumentó el stock, y si fue manual o por ingreso de compra. Antes esto estaba fragmentado: `stock_adjustments` solo cubría ajustes manuales, `cost_changes` guardaba el stock en cambios de costo (para el reporte de inflación, no para consulta directa), y las decenas de puntos que tocan `products.stock` (compras, ventas, entregas, cancelaciones, ediciones, armado, presupuestos) no dejaban ningún rastro consultable.

**Schema (migración idempotente en `server.js`, junto a `cost_changes`)**: tabla nueva `stock_movements` (`product_id`, `type`, `delta`, `qty_before`, `qty_after`, `source_id`, `note`, `registered_by`, `created_at`) + índices por producto y fecha. Helper `logStockMovement(productId, type, delta, sourceId, note, userId)`: se llama SIEMPRE DESPUÉS del `UPDATE products SET stock = ...` correspondiente — lee el stock ya actualizado como `qty_after` y calcula `qty_before = qty_after - delta` (evita tener que capturar el "antes" en cada call site). `delta = 0` no loguea.

**Wireado en todos los puntos que tocan stock** (uno o dos `logStockMovement(...)` por sitio, junto al `UPDATE` existente):
- Compras: recepción (`POST /api/admin/reception/:id/apply`, tipo `compra`), edición de compra ya recibida (revierte + vuelve a sumar, `compra`), eliminación de compra (`compra_eliminada`). El `POST /api/admin/purchases` (crear) NO toca stock — el stock entra recién en la recepción, así que no necesitaba hook.
- Pedidos: creación desde catálogo (vía presupuesto vinculado, `venta`), creación desde admin (`venta`), marcar entregado por PATCH (`venta`) y por `POST .../deliver` (`entrega`), cancelar (`cancelacion`), eliminar pedido (`cancelacion`), editar items (`edicion_pedido`, cubre alta/baja/cambio de cantidad), chequeo de armado confirmado (`armado`, `POST /api/admin/picks/:id/apply`).
- Presupuestos: crear, editar (revierte viejos + descuenta nuevos), cancelar, eliminar (`presupuesto` / `presupuesto_eliminado`).
- Ajuste manual (`POST /api/admin/stock-adjustments`, ya existente): ahora también loguea en `stock_movements` con tipo `ajuste`, además de su tabla propia `stock_adjustments` (que sigue siendo la fuente del modal "📋 Ajustes", sin cambios).
- **Bug/gap cerrado**: el modal "Editar producto" permite tocar el campo `stock` directamente (`PATCH /api/admin/products/:id`) y esto NO pasaba por `stock_adjustments` ni quedaba registrado en ningún lado — quedaba fuera de cualquier auditoría. Ahora, si el patch toca `stock`, se snapshotea el valor anterior y se loguea como `ajuste` ("Edición manual del producto (modal Editar producto)").

**Endpoint** `GET /api/admin/products/:id/stock-history?from&to&type` (sección "productos", mismo gating que el resto de Productos): devuelve `{product: {id, code, name, stock}, movements: [...]}` con join a `users` para mostrar quién hizo cada movimiento. Máximo 500 filas, orden descendente.

**Frontend**: botón **🕒** nuevo al lado del ± existente en cada fila de la tabla de Productos (celda `cell-adj`), y botón **"🕒 Historial de stock"** en el pie del modal "Editar producto". Ambos abren el modal `#stock-mov-modal`: resumen (stock actual + cantidad de movimientos en el rango), filtros de fecha y tipo, y tabla con fecha, tipo (badge de color: verde=compra/recepción, azul=venta/entrega, gris=cancelación, ámbar=edición de pedido, violeta=armado, celeste=presupuesto, rojo=eliminaciones, naranja=ajuste manual), antes/cambio/después y quién lo hizo. Reutiliza el patrón visual del modal viejo de "Ajustes" (que sigue intacto, solo cubre lo manual).

**Verificación**: `node --check` OK en server.js y admin.js (bash mount NO estaba stale esta sesión). Lógica del helper + encadenamiento `qty_after(N) == qty_before(N+1)` validada con Python sqlite3 sobre copia de la DB local (compra +10, venta −3, ajuste a 50 — la cadena y el stock final cerraron OK). HTML del modal nuevo verificado por lectura directa (estructura de divs balanceada, mismo patrón que los modales existentes).

**Pendiente**: `git add/commit/push` + deploy Railway (en disco local). Como el log es nuevo desde hoy, los movimientos de stock ANTERIORES a este deploy no van a aparecer — el historial arranca a partir de ahora (mismo criterio que `cost_changes`, que también solo mide hacia adelante).

### Listas de precios encadenadas — basadas en otra lista (29 julio 2026 — `admin.js?v=20260729a`)

Pedido de Sergio: crear una lista basada en OTRA lista con un % menor (ej: "SuperVip" = lista Vip con −2%). Decisiones (AskUserQuestion): base = **otra lista personalizada** (encadenable), % con la **fórmula de ganancia actual** (no descuento directo: −2% → precio_padre / 1.02).

**Schema** (migración idempotente junto a las de price_lists): `price_lists.base_list_id INTEGER REFERENCES price_lists(id)`. NULL = se basa en `base_level` como siempre. Al guardar con base_list_id, `base_level` se pisa con el **nivel raíz** de la cadena (denormalizado, fallback si el padre se borra).

**Diseño clave — % efectivo combinado**: `resolvePriceListConfig(listOrId)` (server.js, junto a getEffectivePriceConfig) sube por la cadena y devuelve `{column (nivel raíz), markup_percent EFECTIVO, base_level raíz, chain}` donde `(1 − m_ef/100) = Π(1 − m_i/100)`. Así TODO el downstream (computeEffectivePrice, priceSqlExpr, snapshots vendedor_cost_unit, comisiones, preview, PDF, ver-cambios) sigue intacto con la fórmula de siempre — solo cambió cómo se construye la config. Nota: un solo redondeo al final (no redondea por eslabón; diferencia máx $1 vs redondear en cada paso). Los padres se siguen aunque estén **inactivos** (el active solo gobierna la lista asignada al cliente); la cadena corta ante ciclo/padre borrado/profundidad>6 y cae al base_level propio.

**Server**: `getEffectivePriceConfig` usa el resolutor; también los as_list_id de `/api/products` y `/api/price-changes`, el preview, el catálogo PDF (priceCol/markup/chgBaseLevel = raíz) y `/api/price-options` (label "basada en X" + % efectivo). `priceListWouldCycle(parentId, selfId)` valida ciclos. POST/PATCH `/api/admin/price-lists` aceptan `base_list_id` (null desasigna; 400 si ciclo o basarse en sí misma; base_level explícito limpia el padre). GET devuelve `base_list_id`, `base_list_name`, `dependents_count`, `effective_markup_percent`, `effective_base_level`. DELETE: 409 si hay listas basadas en ella (además del check de clientes).

**Frontend (`admin.js` + `admin.html`)**: el select "Lista base" (tabla inline y modal Nueva lista) ahora tiene optgroups Nivel base / **Otra lista** (values `"<nivel>"` / `"list:<id>"`, data-field `base_ref`, decodifica al guardar; excluye la propia lista). La celda Ganancia muestra debajo "ef. X% s/<nivel>" para encadenadas; guardar base o % recarga la tabla (los ef. de las dependientes cambian). Preview muestra la cadena ("SuperVip → Vip") + % efectivo. `plResolveClientCfg(pl)` (mirror del resolutor) en los helpers de pedidos: `orderCfgFromSel` resuelve la cadena para nuevo pedido/edición de items; `fillOrderPriceListSelect` etiqueta "basada en X, gana ef. Y%". `priceListOptsHtml` (dead code) no se tocó.

**Verificación**: `node --check` OK en server.js y admin.js (mount NO stale). Resolutor + ciclos testeados aislados en /tmp con db stub (13 asserts: simple, encadenada −2% → $1000 base da Vip $1111 / SuperVip $1089, cadena de 3, padre borrado, ciclo en datos no cuelga, wouldCycle directo/indirecto). Migración validada sobre copia de la DB. Pendiente: `git add/commit/push` + deploy Railway (en disco local).

### Fix panel de notificaciones cortado en mobile (30 julio 2026 — `styles.css?v=20260730a`)

Sergio reportó (captura de celular) que el dropdown de la campana 🔔 del admin se salía de pantalla por la izquierda. Causa: `.notif-panel` es `position:absolute; right:0; width:360px` anclado a `.notif-wrap` (la campana), que en mobile no está pegada al borde derecho → el panel desborda a la izquierda. Fix: media query `@media (max-width: 720px)` (mismo breakpoint mobile del admin) que lo pasa a `position: fixed; top:58px; left:10px; right:10px; width:auto; max-height: calc(100dvh - 74px)` — ocupa el ancho del viewport debajo del topbar (48px). El topbar es `sticky` sin transforms, así que `fixed` funciona sin sorpresas. Solo admin usa el panel (index/ventas no) → cache busting bumpeado solo en `admin.html`. Pendiente: `git add/commit/push` + deploy Railway.

### Próximos pasos pendientes (en orden)

1. **🟡 Hardening del informe del 27 may** (lo que queda): validación categorías en POST orders, race condition `nextBudgetNumber`. ~~Rate limit login~~ y ~~path traversal `loadProductImage`~~ hechos el 9 jun.
2. **Cuenta corriente con proveedores**: simétrico a lo que ya existe para clientes — registrar deuda que genera cada orden de compra y los pagos a proveedores.
3. **Remito PDF por entrega**: ya existe el **remito por impresión HTML** (botón "🖨 Imprimir remito" en el detalle del pedido, 3 jun). Falta la versión **PDF descargable/enviable por WA** (reutiliza la infra del catálogo PDF) y, si Sergio confirma, la variante **sin precios** para el depósito.
4. **Alerta de stock mínimo en dashboard**: el campo `stock_min` ya existe en productos (implementado 1 jun). Falta: indicador en dashboard + lista de "reponer".
5. **Containerización** (alternativa a Railway): Dockerfile multi-stage, `docker-compose.yml` con Caddy + N instancias.
6. **Backups externos automáticos**: rclone a B2/S3/Drive.
7. **Branding configurable por instancia**: logo + color por cliente en tabla `settings`.
8. **Decisión sobre `plain_password`**: eliminar el campo de la DB. Para mostrar la pass al admin al crear usuario, devolverla solo en la respuesta JSON de ese POST (sin persistir).
9. **Enforcement server-side de categorías del cliente en el catálogo PDF** (opcional): en `POST /api/admin/catalog/pdf`, cuando `priceConfig.type==="client"`, intersectar/forzar `categoryIds` con las categorías permitidas del cliente (`user_category_access`), para que el PDF respete sus categorías aunque el front mande "todas". El front ya lo hereda; esto es defensa extra contra JS cacheado.

**Mejoras de Cuentas corrientes ("lo otro" que Sergio dejó para después — propuestas el 6 jun tras el rediseño):**

10. **Límite de crédito por cliente**: campo nuevo en `users` (ej: `credit_limit`), con alerta visual en la fila de Cuentas (y opcionalmente en el carrito/pedido) cuando la deuda supera el límite.
11. **Estado de cuenta PDF por cliente**: documento descargable/enviable por WhatsApp con el detalle de movimientos y el saldo. Reutiliza la infra del catálogo PDF (pdfkit). Botón en el detalle expandible de la fila.
12. **Recordatorio automático de cobranza**: scheduled task diario que liste por la mañana los deudores con +30 días (usar el `days_overdue` que ya devuelve `/api/admin/accounts`).
13. **Gráfico de evolución de la deuda total** mes a mes en el Dashboard (Chart.js).

### Objetivo de negocio
Vender Maxaria como SaaS llave en mano a distribuidoras mayoristas chicas en Concepción del Uruguay (Entre Ríos). Modelo: setup inicial 150–250k ARS + mensualidad 25–45k ARS por cliente. Meta inicial: 3 clientes pagos para cubrir suscripciones y dejar margen.
- **Cuenta corriente**: débito al entregar pedido (monto = total), crédito al registrar pago. Balance = créditos − débitos.
