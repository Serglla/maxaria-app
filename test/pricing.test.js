/**
 * public/js/shared/pricing.js reemplazo a tres copias de la misma formula
 * (servidor y panel). Este test compara la version compartida contra las
 * implementaciones viejas, copiadas tal cual, sobre miles de casos al azar:
 * si alguna vez dan distinto, el cambio altero precios.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Pricing = require("../public/js/shared/pricing");

// ---- implementaciones viejas (copiadas de server.js y admin.js) ----
function round2(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
function oldComputeEffectivePrice(basePrice, markup) {
  const p = Number(basePrice) || 0;
  const denom = 1 - (Number(markup) || 0) / 100;
  if (denom <= 0) return p;
  return round2(p / denom);
}
function oldServerChain(row, get) {
  const visited = new Set(); const chain = [];
  let divisor = 1, ownDivisor = 1, rootBase = "minorista", cur = row;
  while (cur) {
    if (visited.has(cur.id) || visited.size >= 6) break;
    visited.add(cur.id); chain.push(cur.name);
    const d = 1 - (Number(cur.markup_percent) || 0) / 100;
    if (d > 0) divisor *= d;
    if (visited.size === 1) ownDivisor = d > 0 ? d : 1;
    rootBase = cur.base_level || "minorista";
    if (!cur.base_list_id) break;
    const parent = get(Number(cur.base_list_id));
    if (!parent) break;
    cur = parent;
  }
  const parentDivisor = ownDivisor > 0 ? divisor / ownDivisor : divisor;
  return { base_level: rootBase, chain, markup_percent: 100 * (1 - divisor),
    own_markup_percent: 100 * (1 - ownDivisor), parent_markup_percent: 100 * (1 - parentDivisor) };
}
function oldPanelChain(pl, lists) {
  let divisor = 1, base = "minorista", cur = pl, hops = 0; const seen = {};
  while (cur && !seen[cur.id] && hops < 6) {
    seen[cur.id] = true; hops++;
    const d = 1 - (Number(cur.markup_percent) || 0) / 100;
    if (d > 0) divisor *= d;
    base = cur.base_level || "minorista";
    if (!cur.base_list_id) break;
    const pid = Number(cur.base_list_id);
    cur = lists.find((l) => Number(l.id) === pid);
  }
  return { base_level: base, markup_percent: 100 * (1 - divisor) };
}

// Generador determinista (mismo resultado en cada corrida).
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const MARGINS = [0, 5, 6, -2, 10, 12.5, 33.33, -90, 95, 99.99, 100, 120, "", null, "7"];
const randBase = () => pick([0, 1, 999, 1000, 3832, 1234.56, 0.5, -10, "1500", null, Math.round(rnd() * 500000) / 100]);

test("precio con ganancia sobre venta: igual a la formula del servidor, en el servidor y en el panel", () => {
  for (let i = 0; i < 20000; i++) {
    const base = randBase(), m = pick(MARGINS);
    assert.equal(Pricing.sellPrice(Number(base) || 0, m, 2), oldComputeEffectivePrice(base, m), `servidor ${base} ${m}`);
    // Desde el 2/10/2026 el panel redondea a centavos, igual que el servidor
    // (antes a pesos enteros: oldOrderEffPrice / oldPriceViewListPrice).
    const b0 = Math.max(0, Number(base) || 0);
    const panel = !(Number(m) || 0) ? b0 : Pricing.sellPrice(b0, m, 2);
    assert.equal(panel, !(Number(m) || 0) ? b0 : oldComputeEffectivePrice(b0, m), `pedido ${base} ${m}`);
  }
});

test("listas encadenadas: misma cadena y mismas ganancias que antes", () => {
  for (let i = 0; i < 3000; i++) {
    const n = 1 + Math.floor(rnd() * 9);
    const lists = [];
    for (let id = 1; id <= n; id++) {
      lists.push({
        id, name: "L" + id,
        base_level: pick(["minorista", "vip", "mayorista", "costo", null]),
        markup_percent: pick(MARGINS),
        // padres al azar: incluye ciclos, autorreferencias y padres borrados
        base_list_id: rnd() < 0.75 ? 1 + Math.floor(rnd() * (n + 2)) : null,
      });
    }
    const find = (id) => lists.find((l) => l.id === id) || null;
    for (const l of lists) {
      assert.deepEqual(Pricing.resolveChain(l, find), oldServerChain(l, find));
      const r = Pricing.resolveChain(l, find), o = oldPanelChain(l, lists);
      assert.equal(r.base_level, o.base_level);
      assert.equal(r.markup_percent, o.markup_percent);
    }
  }
});

test("caso real: vip -> BC (-2%) -> Suc_Leon (6%)", () => {
  const lists = [
    { id: 1, name: "BC", base_level: "vip", markup_percent: -2, base_list_id: null },
    { id: 2, name: "Suc_Leon", base_level: "vip", markup_percent: 6, base_list_id: 1 },
  ];
  const r = Pricing.resolveChain(lists[1], (id) => lists.find((l) => l.id === id));
  assert.deepEqual(r.chain, ["Suc_Leon", "BC"]);
  assert.equal(Pricing.sellPrice(3832, r.markup_percent, 2), 3996.66); // 3832 / 1,02 / 0,94
  assert.equal(Pricing.sellPrice(3832, r.parent_markup_percent, 2), 3756.86); // costo del vendedor = precio BC
});
