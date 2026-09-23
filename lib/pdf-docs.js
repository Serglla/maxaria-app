/**
 * Generadores de PDF de documentos (remito / presupuesto y pedido a proveedor).
 *
 * Primer módulo separado de server.js (piloto de partición del monolito): son
 * funciones puras — reciben la respuesta HTTP y los datos ya armados, no tocan
 * la base. server.js los importa con require("./lib/pdf-docs").
 */
"use strict";
const PDFDocument = require("pdfkit");

function round2(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }

// ── Helper: genera PDF de remito/presupuesto con pdfkit ──────────────────
// hidePrices = true genera el "remito sin precios": mismas lineas y cantidades
// pero SIN importes (ni P. unit., ni subtotal, ni TOTAL) y SIN el nombre del
// negocio en el encabezado. Suma una columna CONTROL con casillero para tildar
// al armar/cargar, y lineas de firma Preparó / Entregó / Recibí conforme al pie.
// Sirve igual para armado y para entrega: es el mismo papel para los dos usos.
function buildRemitoPdf(res, { title, docLabel, docNum, date, metaCells, items, total, totalUnidades, notes, extraLine, hidePrices }) {
  const doc = new PDFDocument({ size: "A4", margin: 36, autoFirstPage: true });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  const BLU = "#1e3a5f", GREY = "#6b7280", BLACK = "#111111", AMB = "#d97706";
  const MX = 36, MW = 595 - 72; // márgenes

  // ── Header ──
  // En el remito sin precios no va el nombre del negocio (pedido de Sergio).
  if (!hidePrices) {
    doc.font("Helvetica-Bold").fontSize(17).fillColor(BLU).text(title, MX, 36, { continued: false });
  }
  doc.font("Helvetica").fontSize(9).fillColor(GREY).text("Estado: " + docLabel, MX, hidePrices ? 40 : 58);
  const rnW = doc.widthOfString("N° " + docNum);
  doc.font("Helvetica").fontSize(9).fillColor(GREY).text("REMITO DE PEDIDO", MX, 36, { align: "right" });
  doc.font("Helvetica-Bold").fontSize(20).fillColor(BLU).text("N° " + docNum, MX, 48, { align: "right" });

  // ── Línea azul superior ──
  let cy = 72;
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(2).strokeColor(BLU).stroke();

  // ── Meta row ──
  cy += 6;
  const cellW = MW / metaCells.length;
  metaCells.forEach((cell, i) => {
    const cx = MX + i * cellW;
    doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(cell.label.toUpperCase(), cx, cy);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK).text(cell.value, cx, cy + 9, { width: cellW - 4, ellipsis: true });
    if (i < metaCells.length - 1) {
      doc.moveTo(cx + cellW - 2, cy).lineTo(cx + cellW - 2, cy + 22).lineWidth(0.5).strokeColor("#d1d5db").stroke();
    }
  });

  // ── Línea azul bajo meta ──
  cy += 26;
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(1).strokeColor("#d1d5db").stroke();
  cy += 6;

  // ── Encabezado tabla ──
  // Si algún item tiene descuento por línea, se agregan dos columnas extra:
  // "Desc." (el % descontado) y "Precio" (el precio unitario ya con el
  // descuento aplicado — solo se completa en las filas que tienen descuento).
  const anyDisc = !hidePrices && items.some((it) => (Number(it.discount_percent) || 0) > 0);
  // En el remito de deposito las columnas de importes van en 0 y se agrega CONTROL.
  const COL = hidePrices
    ? { cod: 60, cant: 60, price: 0, disc: 0, precio: 0, sub: 0, control: 90 }
    : anyDisc
      ? { cod: 42, cant: 40, price: 62, disc: 44, precio: 62, sub: 76, control: 0 }
      : { cod: 50, cant: 52, price: 90, disc: 0, precio: 0, sub: 90, control: 0 };
  COL.prod = MW - COL.cod - COL.cant - COL.price - COL.disc - COL.precio - COL.sub - COL.control;
  const colX = { cod: MX };
  colX.prod = colX.cod + COL.cod;
  colX.cant = colX.prod + COL.prod;
  colX.price = colX.cant + COL.cant;
  colX.disc = colX.price + COL.price;
  colX.precio = colX.disc + COL.disc;
  colX.sub = colX.precio + COL.precio;
  colX.control = colX.sub + COL.sub;
  doc.rect(MX, cy, MW, 20).fill(BLU);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  doc.text("CÓD.", colX.cod, cy + 6);
  doc.text("PRODUCTO", colX.prod, cy + 6);
  doc.text("CANT.", colX.cant, cy + 6, { width: COL.cant, align: "center" });
  if (hidePrices) {
    doc.text("CONTROL", colX.control, cy + 6, { width: COL.control, align: "center" });
  } else {
    doc.text("P. UNIT.", colX.price, cy + 6, { width: COL.price, align: "right" });
    if (anyDisc) {
      doc.text("DESC.", colX.disc, cy + 6, { width: COL.disc, align: "right" });
      doc.text("PRECIO", colX.precio, cy + 6, { width: COL.precio, align: "right" });
    }
    doc.text("SUBTOTAL", colX.sub, cy + 6, { width: COL.sub, align: "right" });
  }
  cy += 20;

  // ── Filas de items ──
  const ROW_H = hidePrices ? 22 : 18;
  const vSep = hidePrices
    ? [colX.prod, colX.cant, colX.control]
    : (anyDisc ? [colX.prod, colX.cant, colX.price, colX.disc, colX.precio, colX.sub] : [colX.prod, colX.cant, colX.price, colX.sub]);
  items.forEach((it, idx) => {
    if (cy + ROW_H > 800) { doc.addPage(); cy = 36; }
    if (idx % 2 === 1) doc.rect(MX, cy, MW, ROW_H).fill("#f8fafc");
    const disc = Number(it.discount_percent) || 0;
    const unitPrice = Number(it.unit_price) || 0;
    doc.font("Helvetica").fontSize(9).fillColor(GREY).text(String(it.product_code || ""), colX.cod, cy + 5, { width: COL.cod });
    doc.fillColor(BLACK).font("Helvetica-Bold").text(String(it.product_name || ""), colX.prod, cy + 5, { width: COL.prod - 4, ellipsis: true });
    doc.font("Helvetica-Bold").fillColor(BLACK).fontSize(hidePrices ? 11 : 9)
      .text(String(it.quantity), colX.cant, cy + 5, { width: COL.cant, align: "center" });
    doc.fontSize(9);
    if (hidePrices) {
      // Casillero vacio para tildar al armar/cargar la mercaderia.
      const bx = colX.control + COL.control / 2 - 6;
      doc.rect(bx, cy + 5, 12, 12).lineWidth(1).strokeColor("#9ca3af").stroke();
      vSep.forEach((x) => {
        doc.moveTo(x - 1, cy).lineTo(x - 1, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
      });
      doc.moveTo(MX, cy + ROW_H).lineTo(MX + MW, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
      cy += ROW_H;
      return;
    }
    doc.font("Helvetica").fillColor(GREY).text("$" + unitPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.price, cy + 5, { width: COL.price, align: "right" });
    if (anyDisc) {
      doc.font("Helvetica-Bold").fillColor(disc > 0 ? "#b45309" : "#9ca3af")
        .text(disc > 0 ? "-" + (Math.round(disc * 100) / 100) + "%" : "—", colX.disc, cy + 5, { width: COL.disc, align: "right" });
      const precioConDesc = round2(unitPrice * (1 - disc / 100));
      doc.font("Helvetica").fillColor(disc > 0 ? BLACK : "#9ca3af")
        .text(disc > 0 ? "$" + precioConDesc.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—", colX.precio, cy + 5, { width: COL.precio, align: "right" });
    }
    doc.font("Helvetica-Bold").fillColor(BLACK).text("$" + Number(it.subtotal != null ? it.subtotal : (it.unit_price * it.quantity)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.sub, cy + 5, { width: COL.sub, align: "right" });
    // separadores verticales azules
    vSep.forEach((x) => {
      doc.moveTo(x - 1, cy).lineTo(x - 1, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
    });
    // separador horizontal azul (marca el renglón)
    doc.moveTo(MX, cy + ROW_H).lineTo(MX + MW, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
    cy += ROW_H;
  });

  // ── Línea azul cierre ──
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(2).strokeColor(BLU).stroke();
  cy += 8;

  // ── Summary ──
  doc.font("Helvetica").fontSize(9).fillColor(GREY)
    .text(items.length + " ítems · " + totalUnidades + " unidades", MX, cy);
  if (!hidePrices) {
    doc.font("Helvetica-Bold").fontSize(16).fillColor(BLU)
      .text("TOTAL: $" + total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), MX, cy - 2, { align: "right" });
  }
  cy += 20;

  if (extraLine) {
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(GREY).text(extraLine, MX, cy);
    cy += 14;
  }
  if (notes) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY).text(notes, MX, cy);
    cy += 16;
  }

  // ── Firmas (solo remito de deposito: es el papel que se firma al entregar) ──
  if (hidePrices) {
    if (cy + 60 > 800) { doc.addPage(); cy = 36; }
    cy += 24;
    const firmas = ["Preparó", "Entregó", "Recibí conforme"];
    const fw = MW / firmas.length;
    firmas.forEach((f, i) => {
      const fx = MX + i * fw;
      doc.moveTo(fx, cy).lineTo(fx + fw - 20, cy).lineWidth(0.8).strokeColor("#9ca3af").stroke();
      doc.font("Helvetica").fontSize(8).fillColor(GREY).text(f, fx, cy + 4, { width: fw - 20 });
    });
  }

  doc.end();
}

// ── Helper: genera PDF de un pedido de cotización (sin precios) ───────────
// Mismo lenguaje visual que buildRemitoPdf pero pensado como pedido a un
// proveedor: columnas N° · CÓD · PRODUCTO · CANTIDAD (en unidades o bultos).
function buildCotizacionPdf(res, { appName, supplierName, date, porBultos, items, notes, docLabel, showSupplier }) {
  const doc = new PDFDocument({ size: "A4", margin: 36, autoFirstPage: true });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  const BLU = "#1e3a5f", GREY = "#6b7280", BLACK = "#111111";
  const MX = 36, MW = 595 - 72;

  // ── Header ──
  doc.font("Helvetica-Bold").fontSize(17).fillColor(BLU).text(appName, MX, 36);
  doc.font("Helvetica").fontSize(9).fillColor(GREY)
    .text(porBultos ? "Cantidades por empaque (caja/bulto)" : "Cantidades por unidad", MX, 58);
  doc.font("Helvetica").fontSize(9).fillColor(GREY).text(docLabel || "PEDIDO DE COTIZACIÓN", MX, 36, { align: "right" });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(BLU).text(date, MX, 48, { align: "right" });

  // ── Línea azul superior ──
  let cy = 72;
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(2).strokeColor(BLU).stroke();

  // ── Meta row (solo Fecha; el proveedor no se imprime: la misma cotización
  //    suele pedirse a varios proveedores) ──
  cy += 6;
  const metaCells = showSupplier && supplierName
    ? [{ label: "Fecha", value: date }, { label: "Proveedor", value: supplierName }]
    : [{ label: "Fecha", value: date }];
  const cellW = MW / metaCells.length;
  metaCells.forEach((cell, i) => {
    const cx = MX + i * cellW;
    doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(cell.label.toUpperCase(), cx, cy);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK).text(cell.value, cx, cy + 9, { width: cellW - 4, ellipsis: true });
    if (i < metaCells.length - 1) {
      doc.moveTo(cx + cellW - 2, cy).lineTo(cx + cellW - 2, cy + 22).lineWidth(0.5).strokeColor("#d1d5db").stroke();
    }
  });

  // ── Línea bajo meta ──
  cy += 26;
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(1).strokeColor("#d1d5db").stroke();
  cy += 6;

  // ── Encabezado tabla (sin columna Código: es interno) ──
  const COL = { num: 26, cant: 170 };
  COL.prod = MW - COL.num - COL.cant;
  const colX = {
    num: MX,
    prod: MX + COL.num,
    cant: MX + COL.num + COL.prod,
  };
  doc.rect(MX, cy, MW, 20).fill(BLU);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  doc.text("N°", colX.num, cy + 6, { width: COL.num - 4 });
  doc.text("PRODUCTO", colX.prod, cy + 6);
  doc.text("CANTIDAD", colX.cant, cy + 6, { width: COL.cant, align: "right" });
  cy += 20;

  // ── Filas ──
  const ROW_H = 20;
  items.forEach((it, idx) => {
    if (cy + ROW_H > 800) { doc.addPage(); cy = 36; }
    if (idx % 2 === 1) doc.rect(MX, cy, MW, ROW_H).fill("#f8fafc");
    let qty;
    const upb = Number(it.units_per_bulto) || 1;
    if (it.qty_label) {
      // El caller ya armo la etiqueta (compra: bultos exactos, sin redondear).
      qty = String(it.qty_label);
    } else {
    const q = Number(it.quantity) || 0;
    const pack = it.pack_unit || "bulto";
    // Mostrar SOLO lo que se cargó, sin aclaraciones ni equivalencias.
    if (pack === "comprimido") {
      const cpt = Math.max(1, Number(it.comprimidos_per_unit) || 1);
      qty = Math.round(q * cpt) + " comp";
    } else if (porBultos && pack !== "unidad" && upb > 1) {
      const b = Math.ceil(q / upb);
      const sing = pack === "caja" ? "caja" : "bulto";
      const plur = pack === "caja" ? "cajas" : "bultos";
      qty = b + " " + (b === 1 ? sing : plur);
    } else {
      qty = q + " und";
    }
    }
    doc.font("Helvetica").fontSize(9).fillColor(GREY).text(String(idx + 1), colX.num, cy + 6, { width: COL.num - 4 });
    doc.fillColor(BLACK).font("Helvetica-Bold").text(String(it.product_name || ""), colX.prod, cy + 6, { width: COL.prod - 6, ellipsis: true });
    doc.font("Helvetica-Bold").fillColor(BLACK).text(qty, colX.cant, cy + 6, { width: COL.cant, align: "right" });
    [colX.prod, colX.cant].forEach((x) => {
      doc.moveTo(x - 1, cy).lineTo(x - 1, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
    });
    // separador horizontal azul (marca el renglón)
    doc.moveTo(MX, cy + ROW_H).lineTo(MX + MW, cy + ROW_H).lineWidth(0.5).strokeColor(BLU).stroke();
    cy += ROW_H;
  });

  // ── Línea azul cierre ──
  doc.moveTo(MX, cy).lineTo(MX + MW, cy).lineWidth(2).strokeColor(BLU).stroke();
  cy += 8;

  // ── Pie ──
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BLU)
    .text("Total: " + items.length + " producto" + (items.length !== 1 ? "s" : ""), MX, cy);
  cy += 18;
  if (notes) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY).text(notes, MX, cy, { width: MW });
  }

  doc.end();
}

module.exports = { buildRemitoPdf, buildCotizacionPdf };
