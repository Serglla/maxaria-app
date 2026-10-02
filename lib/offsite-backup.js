"use strict";
// Backup diario de la base a Cloudflare R2 (API compatible con S3).
//
// Se activa solo si estan las 4 variables de entorno:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// Opcional: R2_PREFIX (carpeta dentro del bucket; default "maxaria"). Si varios
// clientes comparten bucket, cada instancia usa su propio prefijo.
//
// Que se guarda (sin borrar nada, la cantidad de archivos queda acotada):
//   <prefijo>/diario/<n>-<dia>.db.gz   rota cada 7 dias (lunes, martes, ...)
//   <prefijo>/mensual/<AAAA-MM>.db.gz  el del dia 1 de cada mes, se conserva
// Copia consistente con la API de backup de SQLite y comprimida con gzip.
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const aws4 = require("aws4");

const DIAS = ["7-domingo", "1-lunes", "2-martes", "3-miercoles", "4-jueves", "5-viernes", "6-sabado"];

// Al copiar y pegar en Railway se cuelan espacios y saltos de linea: un espacio
// en el nombre del bucket alcanza para que R2 conteste AccessDenied.
function clean(v) { return String(v || "").trim(); }

function config(env) {
  const c = {
    accountId: clean(env.R2_ACCOUNT_ID),
    accessKeyId: clean(env.R2_ACCESS_KEY_ID),
    secretAccessKey: clean(env.R2_SECRET_ACCESS_KEY),
    bucket: clean(env.R2_BUCKET),
    prefix: clean(env.R2_PREFIX || "maxaria").replace(/^\/+|\/+$/g, ""),
  };
  c.enabled = !!(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket);
  return c;
}

// Claves del objeto para un dia local (YYYY-MM-DD). Devuelve 1 o 2.
function keysForDay(prefix, dayIso) {
  const [y, m, d] = dayIso.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const keys = [prefix + "/diario/" + DIAS[weekday] + ".db.gz"];
  if (d === 1) keys.push(prefix + "/mensual/" + dayIso.slice(0, 7) + ".db.gz");
  return keys;
}

// Resumen de lo cargado, sin revelar claves: primeros caracteres y largo, para
// compararlo con lo que muestra Cloudflare. Largos esperados: Account ID 32,
// Access Key ID 32, Secret Access Key 64.
function describe(env) {
  const c = config(env);
  const peek = (v, n) => (v ? v.slice(0, n) + "… (" + v.length + " caracteres)" : "(vacio)");
  return {
    account_id: peek(c.accountId, 6),
    access_key_id: peek(c.accessKeyId, 4),
    secret_length: c.secretAccessKey.length,
    bucket: c.bucket || "(vacio)",
    had_spaces: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
      .filter((k) => env[k] && String(env[k]) !== String(env[k]).trim()),
  };
}

// Pedido firmado (SigV4) para listar 1 objeto del bucket: sirve para saber si
// el token puede al menos leer (diagnostico cuando la subida da 403).
function signedList(cfg) {
  const opts = {
    host: cfg.accountId + ".r2.cloudflarestorage.com",
    path: "/" + cfg.bucket + "?list-type=2&max-keys=1",
    method: "GET",
    service: "s3",
    region: "auto",
  };
  aws4.sign(opts, { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey });
  return { url: "https://" + opts.host + opts.path, headers: opts.headers };
}

// Arma el pedido PUT firmado (SigV4). Separado para poder testearlo sin red.
function signedPut(cfg, key, body) {
  const opts = {
    host: cfg.accountId + ".r2.cloudflarestorage.com",
    path: "/" + cfg.bucket + "/" + key.split("/").map(encodeURIComponent).join("/"),
    method: "PUT",
    service: "s3",
    region: "auto",
    body,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(body.length),
      "X-Amz-Content-Sha256": crypto.createHash("sha256").update(body).digest("hex"),
    },
  };
  aws4.sign(opts, { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey });
  return { url: "https://" + opts.host + opts.path, headers: opts.headers };
}

module.exports = function createOffsiteBackup({ db, env, getSetting, setSetting, fetchImpl }) {
  const doFetch = fetchImpl || fetch;

  function status() {
    const c = config(env);
    return {
      enabled: c.enabled,
      prefix: c.enabled ? c.prefix : null,
      last_ok: getSetting("offsite_backup_last_ok", null),
      last_key: getSetting("offsite_backup_last_key", null),
      last_bytes: Number(getSetting("offsite_backup_last_bytes", 0)) || null,
      last_error: getSetting("offsite_backup_last_error", null),
      check: c.enabled ? describe(env) : null,
    };
  }

  // Hace el backup ahora. dayIso decide el nombre del archivo.
  async function run(dayIso) {
    const c = config(env);
    if (!c.enabled) throw new Error("Backup externo desactivado: faltan variables R2_*");
    const tmp = path.join(os.tmpdir(), "maxaria-offsite-" + Date.now() + ".db");
    try {
      await db.backup(tmp);
      const body = zlib.gzipSync(fs.readFileSync(tmp), { level: 9 });
      const keys = keysForDay(c.prefix, dayIso);
      for (const key of keys) {
        const req = signedPut(c, key, body);
        const r = await doFetch(req.url, { method: "PUT", headers: req.headers, body });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          let extra = "";
          if (r.status === 403) {
            // Diagnostico: puede leer el bucket? Distingue "sin permiso de
            // escritura" de "cuenta/bucket/claves que no corresponden".
            try {
              const l = signedList(c);
              const lr = await doFetch(l.url, { method: "GET", headers: l.headers });
              const lt = lr.ok ? "" : await lr.text().catch(() => "");
              const code = (lt.match(/<Code>([^<]+)<\/Code>/) || [])[1] || "";
              extra = lr.ok
                ? " | Lectura del bucket: OK -> el token puede leer pero no escribir (revisar 'Object Read & Write')."
                : " | Lectura del bucket: " + lr.status + (code ? " " + code : "") + " -> el token no tiene acceso a ese bucket en esa cuenta (revisar R2_ACCOUNT_ID, R2_BUCKET y que las claves sean de este token).";
            } catch (_) { /* sin diagnostico */ }
          }
          const code = (txt.match(/<Code>([^<]+)<\/Code>/) || [])[1] || "";
          throw new Error("R2 respondio " + r.status + (code ? " " + code : "") + " al subir " + key + extra);
        }
      }
      setSetting("offsite_backup_last_ok", new Date().toISOString());
      setSetting("offsite_backup_last_key", keys.join(", "));
      setSetting("offsite_backup_last_bytes", String(body.length));
      setSetting("offsite_backup_last_error", "");
      return { keys, bytes: body.length };
    } catch (e) {
      setSetting("offsite_backup_last_error", new Date().toISOString() + " · " + e.message);
      throw e;
    } finally {
      fs.unlink(tmp, () => {});
    }
  }

  return { status, run, enabled: () => config(env).enabled };
};

module.exports.config = config;
module.exports.keysForDay = keysForDay;
module.exports.signedPut = signedPut;
module.exports.describe = describe;
