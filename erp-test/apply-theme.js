/**
 * ERP Test — aplica la estética de la demo sobre el código de Maxaria.
 * Idempotente: se puede correr las veces que haga falta.
 *
 * Uso típico para traer novedades de Maxaria a la demo (en la rama erp-test):
 *   git merge master        (si hay conflictos en archivos de public/, quedarse con la versión de master)
 *   node erp-test/apply-theme.js
 *   git commit -am "erp-test: merge master + tema"
 *
 * NUNCA correr esto en master.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const KIT = __dirname;
const P = (...a) => path.join(ROOT, ...a);

try {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT }).toString().trim();
  if (branch === "master" || branch === "main") {
    console.error("apply-theme: estás en '" + branch + "'. Esto es solo para la rama erp-test. Abortado.");
    process.exit(1);
  }
} catch (_) {}

const read = (f) => fs.readFileSync(f, "utf8");
const write = (f, s) => fs.writeFileSync(f, s);

// 1) Paleta: azules de Maxaria -> petróleo de ERP Test
const COLOR_MAP = [
  ["#1e3a5f", "#0f4c5c"], ["#2c5282", "#14707f"], ["#1e3a8a", "#0b3d49"],
  ["#2563eb", "#0e7c86"], ["#1d4ed8", "#0b6670"], ["#3b82f6", "#1a98a3"],
  ["#93c5fd", "#8fd3d8"], ["#bfdbfe", "#bfe6e8"], ["#dbeafe", "#d5f1f2"],
  ["#eff6ff", "#effafa"], ["#eef3f9", "#eef7f7"], ["#d4e3f5", "#d3ecee"],
  ["#cdddee", "#c5e3e5"], ["#dde5f5", "#dcefef"], ["#e0e7ff", "#dff3f3"],
  ["#f5f7ff", "#f3fbfb"], ["#c7d2fe", "#bfe3e5"],
];
const RGBA_MAP = [
  [/rgba\(\s*37\s*,\s*99\s*,\s*235\s*,/g, "rgba(14,124,134,"],
  [/rgba\(\s*30\s*,\s*58\s*,\s*95\s*,/g, "rgba(15,76,92,"],
];
function recolor(s) {
  for (const [from, to] of COLOR_MAP) s = s.replace(new RegExp(from, "gi"), to);
  for (const [re, to] of RGBA_MAP) s = s.replace(re, to);
  return s;
}

const files = [];
for (const dir of ["public", "public/css", "public/js"]) {
  for (const f of fs.readdirSync(P(dir))) {
    if (/\.(css|html|js|json)$/.test(f) && f !== "erp-theme.css") files.push(P(dir, f));
  }
}

let changed = 0;
for (const f of files) {
  const before = read(f);
  let s = recolor(before);

  // 2) Marca: textos "Maxaria" visibles -> ERP Test
  s = s.replace(/content="Maxaria"/g, 'content="ERP Test"');
  s = s.replace(/\|\| "Maxaria"/g, '|| "ERP Test"');
  s = s.replace(/app_name: "Maxaria"/g, 'app_name: "ERP Test"');
  s = s.replace(/data\.title \|\| "Maxaria"/g, 'data.title || "ERP Test"');
  s = s.replace(/placeholder="Maxaria"/g, 'placeholder="ERP Test"');

  // 3) HTML: hoja de estilos del tema después de styles.css
  if (f.endsWith(".html") && s.indexOf("/css/erp-theme.css") === -1) {
    s = s.replace(/(<link rel="stylesheet" href="\/css\/styles\.css[^"]*" \/>)/,
      '$1\n  <link rel="stylesheet" href="/css/erp-theme.css?v=erp1" />');
  }

  if (s !== before) { write(f, s); changed++; }
}

// 4) manifest
const manPath = P("public", "manifest.json");
const man = JSON.parse(read(manPath));
man.name = "ERP Test";
man.short_name = "ERP Test";
man.description = "Demo: catálogo, pedidos, stock, caja y reportes.";
man.theme_color = "#0f4c5c";
write(manPath, JSON.stringify(man, null, 2) + "\n");

// 5) Archivos propios de la demo
fs.copyFileSync(path.join(KIT, "erp-theme.css"), P("public", "css", "erp-theme.css"));
fs.copyFileSync(path.join(KIT, "login.html"), P("public", "login.html"));
for (const ic of fs.readdirSync(path.join(KIT, "icons"))) {
  fs.copyFileSync(path.join(KIT, "icons", ic), P("public", "icons", ic));
}

// 6) server.js: nombre por defecto de la app
const srvPath = P("server.js");
let srv = read(srvPath);
const srv2 = srv
  .replace('setSetting("app_name", "Maxaria");', 'setSetting("app_name", process.env.APP_NAME || "ERP Test");')
  .replace('return getSetting("app_name", "Maxaria") || "Maxaria";', 'return getSetting("app_name", "ERP Test") || "ERP Test";');
if (srv2 !== srv) { write(srvPath, srv2); changed++; }

// 7) package.json: arranque de demo
const pkgPath = P("package.json");
const pkg = JSON.parse(read(pkgPath));
pkg.scripts.start = "node erp-test/start.js";
write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log("apply-theme: listo. Archivos modificados:", changed);
