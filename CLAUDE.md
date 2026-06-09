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

### Próximos pasos pendientes (en orden)

1. **🟡 Hardening del informe del 27 may**: rate limit login, validación categorías en POST orders, race condition `nextBudgetNumber`, path traversal `loadProductImage`. Sergio dejó esto fuera de la sesión inicial — retomar cuando haga falta.
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
