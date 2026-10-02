/**
 * Toda ruta /api/admin de server.js tiene que tener seccion (lib/permissions.js)
 * o estar declarada a proposito en ANY_ADMIN_ROUTES. Una ruta nueva sin seccion
 * la podria usar cualquier admin limitado: este test lo frena antes del deploy.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../lib/permissions");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const ROUTES = new Set();
for (const m of SERVER.matchAll(/^app\.(?:get|post|put|patch|delete)\((\[[^\]]*\]|"[^"]*")/gm)) {
  for (const r of m[1].matchAll(/"(\/api\/admin[^"]*)"/g)) ROUTES.add(r[1]);
}

test("todas las rutas del panel tienen seccion o una excepcion explicada", () => {
  assert.ok(ROUTES.size > 100, "se leyeron las rutas de server.js");
  const sinSeccion = [...ROUTES].filter((r) => {
    const concreta = r.replace(/:[A-Za-z]+/g, "1");
    return !P.sectionForAdminRequest(concreta) && !P.ANY_ADMIN_ROUTES[r];
  });
  assert.deepEqual(sinSeccion, [], "rutas sin seccion: agregarlas en lib/permissions.js");
});

test("las excepciones existen en server.js (no quedan entradas viejas)", () => {
  for (const r of Object.keys(P.ANY_ADMIN_ROUTES)) assert.ok(ROUTES.has(r), r);
});

test("cada seccion que devuelve el mapa es asignable o exclusiva del superadmin", () => {
  for (const r of ROUTES) {
    const s = P.sectionForAdminRequest(r.replace(/:[A-Za-z]+/g, "1"));
    if (s) assert.ok(P.ADMIN_SECTION_KEYS.has(s) || s === "administradores", r + " -> " + s);
  }
  for (const [s, readers] of Object.entries(P.SHARED_READ_SECTIONS)) {
    assert.ok(P.ADMIN_SECTION_KEYS.has(s), s);
    for (const x of readers) assert.ok(P.ADMIN_SECTION_KEYS.has(x), s + " <- " + x);
  }
});

test("cuenta corriente de proveedores y cotizaciones quedan en su seccion", () => {
  assert.equal(P.sectionForAdminRequest("/api/admin/supplier-payments"), "ctacte-prov");
  assert.equal(P.sectionForAdminRequest("/api/admin/supplier-accounts/4"), "ctacte-prov");
  assert.equal(P.sectionForAdminRequest("/api/admin/purchase-requests/9"), "cotizaciones");
  assert.equal(P.sectionForAdminRequest("/api/admin/pedidos-prov/9"), "pedidos-prov");
  assert.equal(P.sectionForAdminRequest("/api/admin/purchases/9"), "compras");
});
