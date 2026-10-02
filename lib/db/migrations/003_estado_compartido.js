"use strict";
// Migracion 003: estado que antes vivia en la memoria del proceso. En la base,
// lo comparten todos los procesos que usan el mismo archivo (por ejemplo el
// viejo y el nuevo durante un deploy) y sobrevive a un reinicio.
module.exports = {
  id: 3,
  name: "estado_compartido",
  up(db) {
    // Intentos de login fallidos por IP (limite anti fuerza bruta).
    db.exec(
      "CREATE TABLE login_attempts (" +
      "  ip TEXT PRIMARY KEY," +
      "  count INTEGER NOT NULL," +
      "  first_ms INTEGER NOT NULL" +
      ")"
    );
    // Marcas con vencimiento: avisos ya enviados (ej. 'sin stock' por producto).
    db.exec(
      "CREATE TABLE notify_marks (" +
      "  key TEXT PRIMARY KEY," +
      "  at_ms INTEGER NOT NULL" +
      ")"
    );
    // Candado de tareas programadas: una fila por tarea y periodo. El primero
    // que la inserta la ejecuta; el resto la saltea.
    db.exec(
      "CREATE TABLE job_runs (" +
      "  name TEXT NOT NULL," +
      "  period TEXT NOT NULL," +
      "  claimed_at TEXT NOT NULL DEFAULT (datetime('now'))," +
      "  PRIMARY KEY (name, period)" +
      ")"
    );
    // Las tareas que ya corrieron hoy (antes se marcaban en settings) no se
    // vuelven a disparar el dia del deploy.
    const ins = db.prepare("INSERT OR IGNORE INTO job_runs (name, period) VALUES (?, ?)");
    for (const [setting, job] of [["debt_push_last_day", "debt_push"], ["stock_control_notified_at", "stock_control"]]) {
      const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(setting);
      if (r && r.value) ins.run(job, r.value);
    }
  },
};
