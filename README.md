# Maxaria · Catálogo con login y precios por nivel

Aplicación web para catálogo de productos con:

- Login por usuario y contraseña (cuentas creadas por el admin).
- 4 niveles de precio por cliente: minorista, revendedor, mayorista y VIP.
- Carrito que arma el pedido y lo envía por WhatsApp.
- Base local SQLite (sin servidor de DB aparte).

> Esto es **Hito 1**. Faltan: panel admin web, historial de pedidos en DB, imágenes optimizadas y filtros avanzados (Hitos 2–4).

---

## Requisitos

- Node.js 18 o superior. (Probado con 22.)
- En Windows, la primera vez que se instala `better-sqlite3` puede pedir build tools. Si no los tenés, alcanza con `npm install --build-from-source=false` o instalar `windows-build-tools` con admin.

---

## Primer arranque

Desde la carpeta `maxaria_app`:

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar el ejemplo de configuración
copy .env.example .env
# (luego abrí .env y cambiá SESSION_SECRET y WHATSAPP_NUMBER)

# 3. Crear la base y cargar los 509 productos + usuarios demo
npm run seed

# 4. Levantar el server
npm start
```

Abrí `http://localhost:3000` en el navegador.

---

## Usuarios demo (cambiar antes de mostrar a clientes)

| Usuario      | Contraseña       | Nivel        |
|--------------|------------------|--------------|
| admin        | admin1234        | Administrador |
| minorista    | minorista1234    | Minorista     |
| revendedor   | revendedor1234   | Revendedor    |
| mayorista    | mayorista1234    | Mayorista     |
| vip          | vip1234          | VIP           |

Cada uno ve los precios correspondientes a su nivel.

### Cambiar / crear contraseñas

```bash
# Reset de la contraseña del admin:
node scripts/create-admin.js admin nuevaClave 99

# Crear un cliente revendedor nuevo:
node scripts/create-admin.js juanperez sucontraseña 2 "Juan Pérez"
```

Niveles válidos: `1` minorista, `2` revendedor, `3` mayorista, `4` vip, `99` admin.

---

## Estructura

```
maxaria_app/
  server.js              # Express + auth + API
  scripts/
    schema.sql           # Tablas (categories, products, users, orders, ...)
    seed.js              # Crea base, carga productos y usuarios demo
    create-admin.js      # Crear/resetear usuarios desde la terminal
  public/
    login.html           # Pantalla de login
    index.html           # Catálogo (tras login)
    css/styles.css
    js/app.js            # Lógica del catálogo + carrito
  data/
    products.json        # 509 productos extraídos del HTML original
    categories.json      # 28 categorías
    maxaria.db           # SQLite (se crea con `npm run seed`, no se commitea)
```

---

## Reglas de precios iniciales

El seed calcula los precios así, sobre el precio base extraído del HTML actual:

- Minorista: precio base
- Revendedor: −10 %
- Mayorista: −20 %
- VIP: −25 %

Para cambiarlos producto por producto vamos a hacer el panel admin web (Hito 3).
Mientras tanto se pueden editar a mano con cualquier visor de SQLite (DB Browser for SQLite).

---

## Próximos pasos

- **Hito 2**: guardar pedidos en la DB (tabla `orders`) cuando el cliente envía el WhatsApp; historial por cliente.
- **Hito 3**: panel admin web para productos, precios, usuarios y pedidos. Importar precios desde CSV.
- **Hito 4**: imágenes optimizadas (webp + lazy + tamaños), búsqueda con filtros (rango de precio, stock, etc.).
