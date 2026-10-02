/* Maxaria - formulas de precio compartidas por el servidor y el navegador.
 *
 * Es la UNICA definicion de:
 *  - el precio con "ganancia sobre venta": precio = base / (1 - ganancia/100)
 *  - como se combinan las listas encadenadas (lista basada en otra lista).
 *
 * El servidor lo carga con require("./public/js/shared/pricing") y el panel con
 * <script src="/js/shared/pricing.js">, que deja window.MaxPricing.
 * Sin dependencias y sin acceso a la base: lo que cada lado necesita leer
 * (una lista por id) se pasa como funcion.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MaxPricing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Cadena mas larga que se sigue. Corta ciclos y cadenas absurdas.
  var MAX_CHAIN = 6;

  function roundTo(value, decimals) {
    var f = Math.pow(10, decimals);
    return Math.round(value * f) / f;
  }

  // Precio de venta para una ganancia sobre venta (en %).
  // Una ganancia >= 100 no es valida: se devuelve la base sin tocar.
  // decimals: 2 = centavos (servidor), 0 = pesos enteros (panel, hoy).
  function sellPrice(base, marginPct, decimals) {
    var p = Number(base) || 0;
    var denom = 1 - (Number(marginPct) || 0) / 100;
    if (denom <= 0) return p;
    return roundTo(p / denom, decimals == null ? 2 : decimals);
  }

  // Sigue la cadena de listas (cada una puede basarse en otra) y combina las
  // ganancias: (1 - efectiva/100) = producto de (1 - ganancia_i/100).
  //   list:     la lista de partida { id, name, base_level, base_list_id, markup_percent }
  //   findList: (id) -> lista o null. Una lista que no aparece corta la cadena.
  // Devuelve el nivel raiz y las tres ganancias que usa el sistema:
  //   markup_percent        efectiva de toda la cadena (precio al cliente)
  //   own_markup_percent    solo la de esta lista (comision del vendedor)
  //   parent_markup_percent la de la lista padre (costo del vendedor)
  function resolveChain(list, findList) {
    var seen = {};
    var hops = 0;
    var chain = [];
    var divisor = 1;
    var ownDivisor = 1;
    var rootBase = "minorista";
    var cur = list;
    while (cur) {
      if (seen[cur.id] || hops >= MAX_CHAIN) break;
      seen[cur.id] = true;
      hops++;
      chain.push(cur.name);
      var d = 1 - (Number(cur.markup_percent) || 0) / 100;
      if (d > 0) divisor *= d; // ganancia invalida (>= 100): se ignora
      if (hops === 1) ownDivisor = d > 0 ? d : 1;
      rootBase = cur.base_level || "minorista";
      if (!cur.base_list_id) break;
      cur = findList(Number(cur.base_list_id)) || null;
    }
    var parentDivisor = ownDivisor > 0 ? divisor / ownDivisor : divisor;
    return {
      base_level: rootBase,
      chain: chain,
      markup_percent: 100 * (1 - divisor),
      own_markup_percent: 100 * (1 - ownDivisor),
      parent_markup_percent: 100 * (1 - parentDivisor),
    };
  }

  return { MAX_CHAIN: MAX_CHAIN, sellPrice: sellPrice, resolveChain: resolveChain };
});
