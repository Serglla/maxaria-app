// ERP Test: login de la demo (fuera del HTML por la CSP script-src 'self').
fetch("/api/app-info")
  .then((r) => r.json())
  .then((d) => {
    if (d && d.app_name) {
      document.querySelectorAll(".js-app-name").forEach((el) => { el.textContent = d.app_name; });
      document.getElementById("page-title").textContent = d.app_name + " · Iniciar sesión";
    }
  })
  .catch(() => {});

const form = document.getElementById("login-form");
const btn = document.getElementById("login-btn");
const err = document.getElementById("login-error");

async function doLogin(data) {
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Ingresando...";
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
    const level = body.user && body.user.level;
    location.href = level === 99 ? "/admin" : "/catalogo";
  } catch (e) {
    err.textContent = "Error de conexión";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
}

form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  doLogin(Object.fromEntries(new FormData(form).entries()));
});

document.querySelectorAll(".erp-demo-btn").forEach((b) => {
  b.addEventListener("click", () => {
    form.username.value = b.dataset.u;
    form.password.value = b.dataset.p;
    doLogin({ username: b.dataset.u, password: b.dataset.p });
  });
});
