"use strict";
// Estado compartido guardado en la base (ver migracion 003). Reemplaza Maps en
// memoria y marcas en settings: funciona igual con un proceso o con varios
// sobre el mismo archivo, y no se pierde al reiniciar.
module.exports = function createSharedState(db) {
  // ---- Tareas programadas ----
  // Devuelve true solo para el primero que reclama (name, period). Atomico:
  // INSERT OR IGNORE en SQLite, aunque haya dos procesos a la vez.
  function claimJob(name, period) {
    return db.prepare("INSERT OR IGNORE INTO job_runs (name, period) VALUES (?, ?)").run(name, String(period)).changes === 1;
  }
  function lastJobPeriod(name) {
    const r = db.prepare("SELECT period FROM job_runs WHERE name = ? ORDER BY claimed_at DESC, rowid DESC LIMIT 1").get(name);
    return r ? r.period : null;
  }

  // ---- Limite de intentos de login por IP ----
  function loginLimiter(windowMs, maxAttempts) {
    return {
      ok(ip) {
        const e = db.prepare("SELECT count, first_ms FROM login_attempts WHERE ip = ?").get(ip);
        if (!e) return true;
        if (Date.now() - e.first_ms > windowMs) {
          db.prepare("DELETE FROM login_attempts WHERE ip = ?").run(ip);
          return true;
        }
        return e.count < maxAttempts;
      },
      fail(ip) {
        const now = Date.now();
        db.prepare(
          "INSERT INTO login_attempts (ip, count, first_ms) VALUES (?, 1, ?)" +
          " ON CONFLICT(ip) DO UPDATE SET" +
          "   count = CASE WHEN ? - first_ms > ? THEN 1 ELSE count + 1 END," +
          "   first_ms = CASE WHEN ? - first_ms > ? THEN ? ELSE first_ms END"
        ).run(ip, now, now, windowMs, now, windowMs, now);
      },
      clear(ip) { db.prepare("DELETE FROM login_attempts WHERE ip = ?").run(ip); },
      sweep() { db.prepare("DELETE FROM login_attempts WHERE ? - first_ms > ?").run(Date.now(), windowMs); },
    };
  }

  // ---- Marcas con vencimiento (avisos ya enviados) ----
  function markRecent(key, maxAgeMs) {
    const r = db.prepare("SELECT at_ms FROM notify_marks WHERE key = ?").get(key);
    return !!r && Date.now() - r.at_ms <= maxAgeMs;
  }
  function setMark(key) {
    db.prepare("INSERT INTO notify_marks (key, at_ms) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at_ms = excluded.at_ms").run(key, Date.now());
  }
  function sweepMarks(maxAgeMs) {
    db.prepare("DELETE FROM notify_marks WHERE ? - at_ms > ?").run(Date.now(), maxAgeMs);
  }

  return { claimJob, lastJobPeriod, loginLimiter, markRecent, setMark, sweepMarks };
};
