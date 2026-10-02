/**
 * Etapa 6: estado compartido en la base (lib/shared-state.js) y backup externo
 * a Cloudflare R2 (lib/offsite-backup.js), con un R2 simulado.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const Database = require("better-sqlite3");
const { runMigrations } = require("../lib/db/migrate");
const createShared = require("../lib/shared-state");
const createOffsite = require("../lib/offsite-backup");

const SCHEMA = fs.readFileSync(path.join(__dirname, "..", "scripts", "schema.sql"), "utf8");
function newDbFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maxaria-e6-"));
  const file = path.join(dir, "t.db");
  const db = new Database(file);
  db.exec(SCHEMA);
  runMigrations(db, { log: () => {} });
  return { db, file, dir };
}

test("candado de tareas: con dos procesos sobre la misma base, solo uno la corre", () => {
  const { db, file, dir } = newDbFile();
  const otro = new Database(file); // segunda conexion = otro proceso
  const a = createShared(db), b = createShared(otro);
  assert.equal(a.claimJob("debt_push", "2026-10-02"), true);
  assert.equal(b.claimJob("debt_push", "2026-10-02"), false);
  assert.equal(b.claimJob("debt_push", "2026-10-03"), true, "otro dia, otro turno");
  otro.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test("la migracion 003 respeta las tareas que ya corrieron hoy", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA);
  db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)");
  db.prepare("INSERT INTO settings (key, value) VALUES ('debt_push_last_day', '2026-10-02')").run();
  runMigrations(db, { log: () => {} });
  assert.equal(createShared(db).claimJob("debt_push", "2026-10-02"), false);
});

test("limite de login: 10 fallos bloquean, vence con la ventana y se limpia al entrar", () => {
  const { db, dir } = newDbFile();
  const lim = createShared(db).loginLimiter(15 * 60 * 1000, 10);
  for (let i = 0; i < 9; i++) lim.fail("1.1.1.1");
  assert.equal(lim.ok("1.1.1.1"), true);
  lim.fail("1.1.1.1");
  assert.equal(lim.ok("1.1.1.1"), false);
  assert.equal(lim.ok("2.2.2.2"), true, "otra IP no se afecta");
  db.prepare("UPDATE login_attempts SET first_ms = first_ms - 16 * 60 * 1000").run();
  assert.equal(lim.ok("1.1.1.1"), true, "paso la ventana");
  lim.fail("3.3.3.3"); lim.clear("3.3.3.3");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip='3.3.3.3'").get().n, 0);
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test("nombres del backup: rota por dia de la semana y guarda el del dia 1", () => {
  assert.deepEqual(createOffsite.keysForDay("maxaria", "2026-10-02"), ["maxaria/diario/5-viernes.db.gz"]);
  assert.deepEqual(createOffsite.keysForDay("cli2", "2026-11-01"),
    ["cli2/diario/7-domingo.db.gz", "cli2/mensual/2026-11.db.gz"]);
});

test("pedido firmado para R2 (SigV4)", () => {
  const cfg = createOffsite.config({ R2_ACCOUNT_ID: "abc123", R2_ACCESS_KEY_ID: "KEYID", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "maxaria-backups" });
  const r = createOffsite.signedPut(cfg, "maxaria/diario/5-viernes.db.gz", Buffer.from("hola"));
  assert.equal(r.url, "https://abc123.r2.cloudflarestorage.com/maxaria-backups/maxaria/diario/5-viernes.db.gz");
  assert.match(r.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=KEYID\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]*host[a-z0-9;-]*, Signature=[0-9a-f]{64}$/);
  assert.match(r.headers["X-Amz-Date"], /^\d{8}T\d{6}Z$/);
  assert.equal(r.headers["X-Amz-Content-Sha256"], "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79");
});

test("backup externo: sube la base comprimida y anota el resultado; si R2 falla, anota el error", async () => {
  const { db, dir } = newDbFile();
  db.prepare("INSERT INTO users (username, password_hash, full_name, level, active) VALUES ('x','h','X',1,1)").run();
  const settings = new Map();
  const getSetting = (k, d) => (settings.has(k) ? settings.get(k) : d);
  const setSetting = (k, v) => settings.set(k, v);
  const env = { R2_ACCOUNT_ID: "abc", R2_ACCESS_KEY_ID: "K", R2_SECRET_ACCESS_KEY: "S", R2_BUCKET: "b", R2_PREFIX: "cli1" };
  const subidos = [];
  const fakeFetch = async (url, opts) => { subidos.push({ url, opts }); return { ok: true, status: 200, text: async () => "" }; };
  const off = createOffsite({ db, env, getSetting, setSetting, fetchImpl: fakeFetch });
  assert.equal(off.enabled(), true);
  const r = await off.run("2026-11-01");
  assert.equal(subidos.length, 2, "diario + mensual");
  assert.ok(subidos[0].url.endsWith("/b/cli1/diario/7-domingo.db.gz"));
  // Lo subido es una base SQLite valida con los datos
  const restaurada = path.join(dir, "rest.db");
  fs.writeFileSync(restaurada, zlib.gunzipSync(subidos[0].opts.body));
  const rdb = new Database(restaurada, { readonly: true });
  assert.equal(rdb.prepare("SELECT full_name FROM users WHERE username='x'").get().full_name, "X");
  rdb.close();
  assert.equal(off.status().last_bytes, r.bytes);
  assert.equal(off.status().last_error, "");

  const mal = createOffsite({ db, env, getSetting, setSetting,
    fetchImpl: async () => ({ ok: false, status: 403, text: async () => "AccessDenied" }) });
  await assert.rejects(() => mal.run("2026-11-02"), /R2 respondio 403/);
  assert.match(off.status().last_error, /AccessDenied/);
  assert.equal(createOffsite({ db, env: {}, getSetting, setSetting }).enabled(), false, "sin variables queda apagado");
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});
