# Memoria sobre Sergio y el proyecto Maxaria

## Sobre Sergio
- Nombre: Sergio — email: venomyo@gmail.com
- Habla en castellano (Argentina) — preferir siempre español rioplatense
- Directo al punto: describe lo que necesita en pocas líneas, sin rodeos
- Prefiere que el trabajo se haga, no que le expliquen mucho antes de arrancar
- Trabaja solo o en equipo pequeño, es quien toca el código
- Usa GitHub para versionar el proyecto
- Tiene buen ojo funcional: sabe exactamente qué quiere aunque no lo describa en términos técnicos

## Sobre el proyecto — Maxaria

### Qué es
App de catálogo y gestión de pedidos para un negocio de distribución/mayorista. Tiene clientes con distintos niveles de precio, integración con WhatsApp para envío de pedidos, y panel de administración completo.

### Stack técnico
- **Backend**: Node.js + Express 4
- **Base de datos**: SQLite con `better-sqlite3` (síncrono)
- **Sesiones**: `express-session` con store SQLite propio
- **Auth**: bcryptjs
- **Frontend**: HTML + CSS + JS vanilla (sin frameworks)
- **Archivos**: multer para imágenes y Excel
- **Excel**: librería `xlsx` para importar listas de precios

### Estructura de archivos clave
```
maxaria_app/
├── server.js          ← servidor principal (Express + todas las rutas)
├── public/
│   ├── admin.html     ← panel de administración
│   ├── index.html     ← catálogo (redirige a login)
│   ├── login.html     ← pantalla de login
│   ├── css/styles.css
│   └── js/
│       ├── admin.js   ← lógica del panel admin
│       └── app.js     ← lógica del catálogo
├── scripts/           ← utilidades (seed, import/export Excel, backup)
└── data/
    ├── maxaria.db     ← base SQLite
    └── precios_maxaria.xlsx
```

### Niveles de usuario
| Nivel | Nombre       | Acceso |
|-------|-------------|--------|
| 1     | Minorista   | Catálogo, precio minorista |
| 2     | Revendedor  | Catálogo, precio revendedor |
| 3     | Mayorista   | Catálogo, precio mayorista |
| 4     | VIP         | Catálogo, precio VIP |
| 5     | Vendedor    | Admin limitado (solo pedidos asignados) + registrar entregas |
| 99    | Administrador | Acceso total |

### Funcionalidades implementadas al 2025-04-30
- Catálogo con precios por nivel, filtros por categoría, stock
- Carrito → pedido → link a WhatsApp
- Importación de precios desde Excel (no destructiva)
- Historial de cambios de precio (nuevos, reingresos, subas/bajas)
- Panel admin: productos, pedidos, usuarios, configuración
- **Vendedores** (agregado hoy): sección para gestionar vendedores nivel 5, asignar pedidos, configurar lista de precios que ven
- **Entregas** (agregado hoy): registro de entrega con quien recibió, monto efectivo, monto transferencia; tabla de historial; el pedido pasa a "entregado" automáticamente

### Base de datos — tablas principales
- `users` — con columna `vendedor_price_level` (para nivel 5)
- `products`, `categories`
- `orders` — con columna `assigned_vendedor_id`
- `order_items`
- `deliveries` — tabla nueva: efectivo_amount, transferencia_amount, delivered_to, vendedor_id
- `settings`, `price_updates`, `price_changes`, `user_category_access`, `sessions`

### Convenciones del proyecto
- Sin frameworks JS en el frontend (vanilla JS, IIFE)
- Auto-save en tablas del admin al perder foco (no hay botón guardar por fila)
- Migraciones con `ALTER TABLE ... ADD COLUMN` dentro de try/catch (no destructivas)
- Queries SQLite síncronas con better-sqlite3
- No uses `console.log` innecesarios
- Los strings de SQL se concatenan con `+` (no template literals) para consistencia con el estilo del proyecto
