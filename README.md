# Maxaria · Catálogo con login y precios por nivel

App web para catálogo de productos con login, 4 niveles de precio (minorista,
revendedor, mayorista, VIP) y carrito que envía el pedido por WhatsApp.
Los precios se administran desde un Excel.

---

## Requisitos

- Node.js 18 o superior (probado con 22 y 24).

---

## Arranque local (en tu PC)

```
cd D:\Maxaria\WEB\maxaria_app
npm install
copy .env.example .env
```

Editá `.env` y completá `SESSION_SECRET` y `WHATSAPP_NUMBER`.

Copiá tu Excel a `data\precios_maxaria.xlsx` (dentro del proyecto):

```
copy ..\precios_maxaria.xlsx data\precios_maxaria.xlsx
```

> Si preferís dejar el Excel afuera del proyecto durante el desarrollo,
> el seed también lo busca en `D:\Maxaria\WEB\precios_maxaria.xlsx` por compatibilidad.

Después:

```
npm run seed     (solo la primera vez o si cambia el schema)
npm start
```

Abrí `http://localhost:3000`.

### Usuarios demo

| Usuario | Contraseña | Nivel |
|---|---|---|
| admin | admin1234 | Administrador |
| minorista | minorista1234 | Minorista |
| revendedor | revendedor1234 | Revendedor |
| mayorista | mayorista1234 | Mayorista |
| vip | vip1234 | VIP |

Cambiarlas con:

```
node scripts/create-admin.js admin nuevaclave 99
```

---

## Comandos disponibles

| Comando | Para qué sirve |
|---|---|
| `npm start` | Levanta el server (con auto-seed si no hay base) |
| `npm run seed` | Borra y recrea la base desde el Excel (limpia todo) |
| `npm run import-prices` | Actualiza precios y stock desde el Excel sin perder usuarios ni pedidos |
| `npm run export-prices` | Genera un Excel con la base actual |
| `npm run create-admin <user> <pass> [nivel]` | Crear o resetear un usuario |
| `npm run backup` | Hace una copia de la base en `data/backups/` (también corre solo al arrancar) |

> Antes de correr `seed` o `import-prices`, parar el server (Ctrl+C) para
> que no tenga la base bloqueada.

---

## Mapeo de columnas del Excel

El Excel debe tener estas columnas exactas en la primera fila:

| Columna en Excel | Uso en la app |
|---|---|
| Código Interno | código (clave única) |
| Nombre del Artículo | nombre |
| Stock | stock (oculto si ≤ 0) |
| Categoría | categoría (texto) |
| Precio de costo | costo (interno, no se muestra) |
| Principal | precio público (informativo) |
| L0 | precio VIP |
| L1 | precio Mayorista |
| L2 | (descartado) |
| L3 | precio Minorista |
| LESP | precio Revendedor |

---

## Despliegue en Render / Railway / Fly.io

La app está pensada para correr en un container Linux con un disco
persistente para la base SQLite.

### Render

1. **Repo en GitHub** con todo el contenido de `maxaria_app/`, incluyendo
   `data/precios_maxaria.xlsx`. (No subir `data/maxaria.db` ni `.env`.)
2. **New Web Service** -> conectar el repo.
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`  (corre `boot.js`, hace seed si no hay base)
5. **Environment variables**:
   - `SESSION_SECRET` = una clave larga y aleatoria
   - `WHATSAPP_NUMBER` = tu número (ej `5493442000000`)
   - `NODE_ENV` = `production`
   - `DB_PATH` = `/var/data/maxaria.db`  (donde se va a montar el disco)
6. **Disk** (para que la base sobreviva los reinicios):
   - Mount path: `/var/data`
   - Size: 1 GB (alcanza muchísimo)
7. Deploy. La primera vez va a hacer seed automáticamente y crear los
   usuarios demo.

### Railway

Similar, salvo que:
- El disco persistente se llama "Volume". Montalo en `/data`.
- `DB_PATH` = `/data/maxaria.db`
- El resto igual.

> **IMPORTANTÍSIMO:** si `DB_PATH` no está seteado o apunta a una ruta
> dentro del proyecto (ej `data/maxaria.db`), **cada redeploy borra la
> base y todos los usuarios creados a mano**, porque el filesystem del
> container es efímero y se reemplaza por el checkout de git.
>
> **Cómo verificar que está bien en Railway:**
> 1. En tu service → **Variables** → confirmá que `DB_PATH=/data/maxaria.db`
>    (o la ruta donde montaste el volume).
> 2. En tu service → **Settings** → **Volumes** → debe haber un volume
>    montado en `/data` (o la ruta que pusiste en `DB_PATH`).
> 3. Mirá los **logs** al arrancar. Vas a ver:
>    ```
>    [boot] DB_PATH        = /data/maxaria.db
>    [boot] Base encontrada en /data/maxaria.db (XXX KB)
>    [backup] Copia creada: /data/backups/maxaria-20260101-120000.db
>    ```
>    Si en cambio ves **`*** No existe la base en ...`** después de un
>    deploy donde antes ya había usuarios, el volume **no** está
>    persistiendo (mount path mal, DB_PATH apuntando a otro lado, etc.).

### Fly.io

- `fly volumes create maxaria_data --size 1` y montar en `/data` desde el `fly.toml`.
- En `[env]` setear `DB_PATH = "/data/maxaria.db"`.
- Resto igual.

### Backups automáticos

Al arrancar, `boot.js` hace un backup de la base en
`{dirname(DB_PATH)}/backups/maxaria-YYYYMMDD-HHmmss.db` y mantiene los
últimos `BACKUP_KEEP` (default **7**) para no llenar el disco.

**Restaurar un backup:**

```
# parar el server primero
cp /data/backups/maxaria-20260101-120000.db /data/maxaria.db
# arrancar de nuevo
```

En Railway lo podés hacer desde la pestaña "Shell" del service. Si necesitás
descargarte un backup a tu máquina, podés copiarlo a un endpoint
temporario o usar `railway run` con un comando que lo imprima en base64.

### Actualizar precios en producción

Dos opciones:

**A. Subir un Excel nuevo y redesplegar.**
Reemplazás `data/precios_maxaria.xlsx`, hacés commit y push. El deploy va
a tener el archivo nuevo. Después entrás a la consola del hosting y corrés:
```
npm run import-prices
```

**B. Más adelante (Hito 3):** botón "subir Excel" en el panel admin web.

---

## Estructura

```
maxaria_app/
  server.js              # Express + auth + API
  scripts/
    boot.js              # Auto-seed + start (entry point para hosting)
    schema.sql           # Tablas
    seed.js              # Carga inicial desde Excel
    import-prices.js     # Actualizar precios sin perder datos
    export-prices.js     # Exportar base a Excel
    excel_helper.js      # Lectura/escritura de Excel
    create-admin.js      # Crear/resetear usuarios
  public/
    login.html  index.html  css/  js/
  data/
    precios_maxaria.xlsx  # tu Excel (lo subís vos)
    maxaria.db            # SQLite (creada por seed, ignorada en git)
    products.json         # imágenes legacy del HTML
    categories.json       # legacy
```

---

## Hitos

### Hito 1 — listo
Login, catálogo con precios por nivel, carrito, envío del pedido por WhatsApp,
seed/import desde Excel.

### Hito 2 — listo
Cuando el cliente arma el carrito y aprieta **Enviar por WhatsApp**, el pedido
se guarda primero en la base (con número, fecha, ítems y total) y recién
después se abre WhatsApp. Si el navegador bloquea el popup, aparece un modal
con un botón para abrirlo manualmente; el pedido ya quedó guardado.

- Botón **Mis pedidos** en el catálogo: cada cliente ve su historial.
- El admin ve todos los pedidos (con nombre del cliente).
- Click en un pedido para ver el detalle (productos, cantidades, total, nota).
- Botón **Reenviar por WhatsApp** desde el detalle.
- Estados disponibles: `pendiente · enviado · preparando · entregado · cancelado`.
  Solo el admin puede cambiarlos (selector dentro del detalle).

Endpoints involucrados:

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/api/orders` | Guarda el pedido (cliente logueado) |
| `GET`  | `/api/orders` | Lista (cliente: solo los suyos / admin: todos) |
| `GET`  | `/api/orders/:id` | Detalle con ítems |
| `PATCH`| `/api/orders/:id` | Cambiar estado (solo admin) |

### Hito 3 — en progreso

**Etapa A (lista):** panel admin web en `/admin`, accesible solo para usuarios
con nivel 99. El admin del catálogo ahora ve un botón **Admin** arriba a la
derecha que linkea ahí.

- **Tab Productos**: tabla con TODOS los productos (visibles y ocultos).
  Búsqueda por código/nombre/categoría, filtros (solo sin stock / solo
  inactivos), paginación de 50 por página. Cada celda de stock, costo,
  precios y nombre es **editable inline** — al perder foco se guarda
  automáticamente (border amarillo = guardando, verde = guardado, rojo = error).
  Toggle de Activo/Inactivo en la última columna.
- **Tab Pedidos**: la misma vista que ya existía en el catálogo, ahora
  desde el panel. Búsqueda por número o cliente.
- Botón **📥 Subir Excel**: file picker, sube el `.xlsx` al servidor, corre
  el equivalente a `npm run import-prices` (no destructivo: preserva
  usuarios y pedidos), muestra el resumen de actualizados/nuevos/sin stock.

Endpoints nuevos:

| Método | Ruta | Para qué |
|---|---|---|
| `GET`   | `/admin` | Sirve el HTML del panel (solo level 99) |
| `GET`   | `/api/admin/products` | Lista completa de productos |
| `PATCH` | `/api/admin/products/:id` | Editar campos puntuales |
| `POST`  | `/api/admin/import-excel` | Upload + import del Excel |

Nueva dependencia: `multer` (manejo de uploads multipart). Después del pull:

```
npm install
```

**Etapa B (lista):** gestión de usuarios desde `/admin` → tab **Usuarios**.

- Tabla con todos los usuarios y edición inline de nombre, nivel, teléfono,
  email y activo (toggle). Auto-save al perder foco igual que en productos.
- Botón **+ Crear usuario**: modal con username, password, nombre, nivel,
  teléfono y email.
- Botón **Reset pass** por fila: modal para definir una contraseña nueva.
- Salvaguardas: no podés bajarte de Administrador a vos mismo ni
  desactivarte. Los toggles correspondientes salen disabled.

Endpoints nuevos:

| Método | Ruta | Para qué |
|---|---|---|
| `GET`   | `/api/admin/users` | Lista de usuarios |
| `POST`  | `/api/admin/users` | Crear nuevo usuario |
| `PATCH` | `/api/admin/users/:id` | Editar nombre/nivel/teléfono/email/active |
| `POST`  | `/api/admin/users/:id/reset-password` | Cambiar contraseña |

**Etapa pendiente:**
- C: gráficos básicos (top productos vendidos, pedidos por mes, facturado por nivel).

### Hito 4 — pendiente
Filtros (rango de precio, stock alto), búsqueda más inteligente, imágenes
optimizadas (webp + lazy + tamaños), atajos de teclado.
