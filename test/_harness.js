/**
 * Arranque compartido para tests que levantan el server real sobre una base
 * temporal creada desde scripts/schema.sql. Usado por los tests nuevos; el de
 * humo mantiene su propio arranque.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const ROOT = path.join(__dirname, "..");

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

async function startServer(seed) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maxaria-h-"));
  const dbPath = path.join(tmp, "test.db");
  const db = new Database(dbPath);
  db.exec(fs.readFileSync(path.join(ROOT, "scripts", "schema.sql"), "utf8"));
  db.prepare("INSERT INTO users (username, password_hash, full_name, level, active) VALUES ('admin', ?, 'Admin', 99, 1)")
    .run(bcrypt.hashSync("Admin123!", 4));
  if (seed) seed(db);
  db.close();
  const port = await freePort();
  const base = "http://127.0.0.1:" + port;
  const proc = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      DB_PATH: dbPath, PORT: String(port), NODE_ENV: "development",
      SESSION_SECRET: "harness-secret-0123456789abcdef",
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + "/healthz"); if (r.ok) break; } catch (_) { /* todavia no */ }
    if (i === 99) throw new Error("El server no arranco:\n" + log);
    await new Promise((r) => setTimeout(r, 100));
  }
  function client() {
    let cookie = "";
    async function call(method, url, body) {
      const res = await fetch(base + url, {
        method,
        headers: Object.assign({ "Content-Type": "application/json" }, cookie ? { Cookie: cookie } : {}),
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) { /* no JSON */ }
      return { status: res.status, json, text };
    }
    return {
      get: (u) => call("GET", u), post: (u, b) => call("POST", u, b || {}),
      patch: (u, b) => call("PATCH", u, b || {}), put: (u, b) => call("PUT", u, b || {}),
      del: (u) => call("DELETE", u),
      login: (u, p) => call("POST", "/login", { username: u, password: p }),
    };
  }
  return {
    dbPath, client, log: () => log,
    db: () => new Database(dbPath),
    stop() { proc.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* windows */ } },
  };
}

module.exports = { startServer, ROOT };
