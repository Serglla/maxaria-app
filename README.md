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
| L2 | precio Minorista |
| L3 | (descartado) |
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

### Fly.io

- `fly volumes create maxaria_data --size 1` y montar en `/data` desde el `fly.toml`.
- En `[env]` setear `DB_PATH = "/data/maxaria.db"`.
- Resto igual.

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

## Próximos hitos

- **Hito 2**: guardar pedidos en la DB cuando el cliente envía el WhatsApp + historial por cliente.
- **Hito 3**: panel admin web (productos, precios, usuarios, pedidos) con subida de Excel.
- **Hito 4**: imágenes optimizadas (webp + lazy + tamaños) y filtros avanzados.
