// Login: se sacó de un <script> inline para poder activar la CSP (script-src 'self').
// Cargar nombre de la app desde la API pública y actualizar la UI
fetch("/api/app-info")
  .then((r) => r.json())
  .then((d) => {
    if (d && d.app_name) {
      document.getElementById("login-brand-name").textContent = d.app_name;
      document.getElementById("page-title").textContent = d.app_name + " · Iniciar sesión";
    }
  })
  .catch(() => {});

const form = document.getElementById("login-form");
const btn = document.getElementById("login-btn");
const err = document.getElementById("login-error");

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Ingresando...";

  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      err.textContent = body.error || "No se pudo iniciar sesión";
      err.hidden = false;
      return;
    }
    location.href = "/catalogo";
  } catch (e) {
    err.textContent = "Error de conexión";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
});
  
