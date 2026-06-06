/**
 * debt-reminder.js
 * Consulta la base local y devuelve los clientes con deuda activa >= 30 dias.
 * Uso: node scripts/debt-reminder.js [--days=N] [--db=ruta]
 * Puede usarse también como módulo: module.exports = getDebtors(dbPath, minDays)
 */
const path = require("path");
const fs   = require("fs");

const args = process.argv.slice(2);
const argDays = args.find((a) => a.startsWith("--days="));
const argDb   = args.find((a) => a.startsWith("--db="));

const MIN_DAYS = argDays ? Number(argDays.split("=")[1]) : 30;
const DB_PATH  = argDb
  ? argDb.split("=")[1]
  : (process.env.DB_PATH || path.join(__dirname, "..", "data", "maxaria.db"));

if (!fs.existsSync(DB_PATH)) {
  console.error("ERROR: No se encontró la base de datos en:", DB_PATH);
  console.error("Asegurate de que la app esté corriendo localmente y la ruta sea correcta.");
  process.exit(1);
}

const Database = require("better-sqlite3");
const db = new Database(DB_PATH, { readonly: true });

function daysSince(str) {
  if (!str) return null;
  const t = Date.parse(String(str).replace(" ", "T") + "Z");
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function fmtArs(n) {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

function getDebtors(minDays) {
  const users = db.prepare(
    "SELECT id, username, full_name, COALESCE(credit_limit,0) AS credit_limit" +
    "  FROM users WHERE level IN (1,2,3,4) AND active = 1"
  ).all();

  const movs = db.prepare(
    "SELECT user_id, type, amount, created_at FROM account_movements ORDER BY created_at ASC"
  ).all();

  const byUser = {};
  movs.forEach((m) => { (byUser[m.user_id] = byUser[m.user_id] || []).push(m); });

  const deudores = [];
  users.forEach((u) => {
    const list = byUser[u.id] || [];
    let totalDebit = 0, totalCredit = 0, creditPool = 0;
    const openDebits = [];
    list.forEach((mv) => {
      if (mv.type === "debit") { totalDebit += mv.amount; openDebits.push({ amount: mv.amount, at: mv.created_at }); }
      else { totalCredit += mv.amount; creditPool += mv.amount; }
    });
    let pool = creditPool;
    for (let k = 0; k < openDebits.length && pool > 0; k++) {
      const pay = Math.min(pool, openDebits[k].amount);
      openDebits[k].amount -= pay; pool -= pay;
    }
    const balance = totalCredit - totalDebit;
    if (balance >= -0.0001) return;

    let oldestAt = null;
    for (let d = 0; d < openDebits.length; d++) {
      if (openDebits[d].amount > 0.0001) { oldestAt = openDebits[d].at; break; }
    }
    const daysOverdue = oldestAt ? daysSince(oldestAt) : null;
    if (daysOverdue == null || daysOverdue < minDays) return;

    deudores.push({
      id: u.id,
      nombre: u.full_name || u.username,
      username: u.username,
      saldo: Math.round(balance),
      limit: u.credit_limit || 0,
      days_overdue: daysOverdue,
      oldest_unpaid_at: oldestAt,
    });
  });

  return deudores.sort((a, b) => b.days_overdue - a.days_overdue);
}

// Cuando se ejecuta directo (no como módulo)
if (require.main === module) {
  const today = new Date().toLocaleDateString("es-AR", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const deudores = getDebtors(MIN_DAYS);

  console.log("=".repeat(60));
  console.log(`  MAXARIA — Deudores con +${MIN_DAYS} días`);
  console.log(`  ${today}`);
  console.log("=".repeat(60));

  if (!deudores.length) {
    console.log(`  ✅ Sin clientes con deuda activa mayor a ${MIN_DAYS} días.`);
  } else {
    console.log(`  ⚠️  ${deudores.length} cliente(s) con deuda vencida:\n`);
    deudores.forEach((d, i) => {
      const overLimitTxt = (d.limit > 0 && Math.abs(d.saldo) > d.limit) ? "  🔴 EXCEDE LÍMITE" : "";
      console.log(`  ${i + 1}. ${d.nombre} (@${d.username})`);
      console.log(`     Debe: ${fmtArs(Math.abs(d.saldo))}  |  Antigüedad: ${d.days_overdue} días${overLimitTxt}`);
    });
  }
  console.log("=".repeat(60));

  db.close();
}

module.exports = { getDebtors };
