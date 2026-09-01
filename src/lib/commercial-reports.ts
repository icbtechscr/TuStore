import ExcelJS, { type Alignment, type Worksheet } from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { SalesAnalytics, VendorPerformance } from "@/lib/cpi-analytics";
import type { QuoteVendorPerformance } from "@/lib/cpi-quotes";

export type CommercialReport =
  | {
      kind: "sales";
      title: string;
      periodLabel: string;
      reference: string;
      sales: SalesAnalytics;
      vendors: VendorPerformance;
    }
  | {
      kind: "quotes";
      title: string;
      periodLabel: string;
      reference: string;
      quotes: QuoteVendorPerformance;
    };

type ReportRow = Array<string | number>;
type PdfColumn = {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
};

const BRAND = "#263AAF";
const BRAND_DARK = "#0E183F";
const ACCENT = "#43B968";
const LIGHT = "#EEF1FF";
const BORDER = "#D9DDEA";
const MUTED = "#667085";
const WHITE = "#FFFFFF";

function generatedAt(): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("es-CR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pdfText(value: unknown): string {
  return String(value ?? "")
    .replaceAll("₡", "CRC ")
    .replace(/[–—−]/g, "-")
    .replace(/[•·]/g, "/")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function currencyCRC(value: number): string {
  return `CRC ${formatNumber(Math.round(value || 0))}`;
}

function currencyUSD(value: number): string {
  return `USD ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function hexColor(hex: string) {
  const clean = hex.replace("#", "");
  return rgb(
    Number.parseInt(clean.slice(0, 2), 16) / 255,
    Number.parseInt(clean.slice(2, 4), 16) / 255,
    Number.parseInt(clean.slice(4, 6), 16) / 255
  );
}

function excelSafe(value: string): string {
  return /^[=+@]/.test(value) ? `'${value}` : value;
}

function configureWorkbook(workbook: ExcelJS.Workbook, report: CommercialReport) {
  workbook.creator = "TUStore Costa Rica";
  workbook.company = "TUStore Costa Rica";
  workbook.subject = report.title;
  workbook.title = `${report.title} - ${report.periodLabel}`;
  workbook.description = `Reporte generado desde TUStore Admin para ${report.periodLabel}.`;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
}

function styleTitle(sheet: Worksheet, title: string, subtitle: string, endColumn: string) {
  sheet.mergeCells(`A1:${endColumn}2`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { name: "Aptos Display", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E183F" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 25;

  sheet.mergeCells(`A3:${endColumn}3`);
  const subtitleCell = sheet.getCell("A3");
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "Aptos", size: 10, italic: true, color: { argb: "FF667085" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(3).height = 22;
}

function addSummarySheet(workbook: ExcelJS.Workbook, report: CommercialReport) {
  const sheet = workbook.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  styleTitle(
    sheet,
    report.title,
    `${report.periodLabel} | Generado: ${generatedAt()}`,
    "F"
  );
  sheet.columns = [
    { width: 25 }, { width: 18 }, { width: 3 },
    { width: 25 }, { width: 18 }, { width: 3 },
  ];

  const metrics =
    report.kind === "sales"
      ? [
          ["Facturas", report.sales.count],
          ["Ventas CRC", report.sales.totalCRC],
          ["Ventas USD", report.sales.totalUSD],
          ["Vendedores activos", report.vendors.vendors.length],
          ["Unidades vendidas", report.sales.productUnits],
          ["Productos vendidos", report.sales.productCount],
        ]
      : [
          ["Cotizaciones", report.quotes.count],
          ["Monto cotizado CRC", report.quotes.totalCRC],
          ["Monto cotizado USD", report.quotes.totalUSD],
          ["Vendedores activos", report.quotes.vendors.length],
          ["Clientes", report.quotes.clientes],
          ["Productos cotizados", report.quotes.productos],
        ];

  for (let index = 0; index < metrics.length; index += 1) {
    const row = 5 + Math.floor(index / 2) * 3;
    const col = index % 2 === 0 ? 1 : 4;
    const [label, value] = metrics[index];
    sheet.mergeCells(row, col, row, col + 1);
    sheet.mergeCells(row + 1, col, row + 1, col + 1);
    const labelCell = sheet.getCell(row, col);
    const valueCell = sheet.getCell(row + 1, col);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FF667085" } };
    valueCell.font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FF0E183F" } };
    labelCell.fill = valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F6FF" } };
    labelCell.alignment = valueCell.alignment = { vertical: "middle", horizontal: "left" };
    for (const cell of [labelCell, valueCell]) {
      cell.border = {
        left: { style: "thin", color: { argb: "FFD9DDEA" } },
        right: { style: "thin", color: { argb: "FFD9DDEA" } },
      };
    }
    labelCell.border = { ...labelCell.border, top: { style: "thin", color: { argb: "FFD9DDEA" } } };
    valueCell.border = { ...valueCell.border, bottom: { style: "thin", color: { argb: "FFD9DDEA" } } };
    if (String(label).includes("CRC")) valueCell.numFmt = '"CRC "#,##0';
    else if (String(label).includes("USD")) valueCell.numFmt = '"USD "#,##0.00';
    else if (String(label).includes("Unidades")) valueCell.numFmt = "#,##0.00";
    else valueCell.numFmt = "#,##0";
  }

  sheet.mergeCells("A15:F15");
  sheet.getCell("A15").value =
    report.kind === "sales"
      ? "Incluye el ranking completo de vendedores y los productos más vendidos del período."
      : "Incluye el ranking completo de cotizadores y los productos más cotizados del período.";
  sheet.getCell("A15").font = { name: "Aptos", size: 10, color: { argb: "FF667085" } };
  sheet.getCell("A15").alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(15).height = 30;
  sheet.headerFooter.oddFooter = "TUStore Costa Rica | Página &P de &N";
}

function addTableSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  columns: Array<{ header: string; key: string; width: number; numFmt?: string; align?: Alignment["horizontal"] }>,
  rows: Record<string, string | number | null>[]
) {
  const lastColumn = String.fromCharCode(64 + columns.length);
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  styleTitle(sheet, title, subtitle, lastColumn);
  sheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));
  const header = sheet.getRow(4);
  header.values = columns.map((column) => column.header);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF263AAF" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  for (const source of rows) {
    const safe = Object.fromEntries(
      Object.entries(source).map(([key, value]) => [
        key,
        typeof value === "string" ? excelSafe(value) : value,
      ])
    );
    sheet.addRow(safe);
  }

  const lastRow = Math.max(4, sheet.rowCount);
  const hasWrappedProducts = columns.some((column) => column.key === "producto");
  sheet.autoFilter = { from: "A4", to: `${lastColumn}${lastRow}` };
  for (let rowNumber = 5; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = hasWrappedProducts ? 34 : 22;
    row.eachCell((cell, columnNumber) => {
      const config = columns[columnNumber - 1];
      cell.font = { name: "Aptos", size: 10, color: { argb: "FF263238" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: config.align ?? (typeof cell.value === "number" ? "right" : "left"),
        wrapText: config.key === "producto",
      };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE9EBF2" } } };
      if (config.numFmt && typeof cell.value === "number") cell.numFmt = config.numFmt;
      if (rowNumber % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F9FC" } };
      }
    });
  }
  sheet.headerFooter.oddFooter = "TUStore Costa Rica | Página &P de &N";
  return sheet;
}

export async function buildCommercialExcel(report: CommercialReport): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  configureWorkbook(workbook, report);
  addSummarySheet(workbook, report);
  const subtitle = `${report.periodLabel} | Generado: ${generatedAt()}`;

  if (report.kind === "sales") {
    addTableSheet(
      workbook,
      "Vendedores",
      "Vendedores con más ventas",
      subtitle,
      [
        { header: "#", key: "rank", width: 7, align: "center" },
        { header: "Vendedor", key: "vendedor", width: 34 },
        { header: "Facturas", key: "facturas", width: 12, numFmt: "#,##0" },
        { header: "Ventas CRC", key: "crc", width: 19, numFmt: '"CRC "#,##0' },
        { header: "Ventas USD", key: "usd", width: 17, numFmt: '"USD "#,##0.00' },
        { header: "Ticket CRC", key: "ticketCRC", width: 18, numFmt: '"CRC "#,##0' },
        { header: "Ticket USD", key: "ticketUSD", width: 17, numFmt: '"USD "#,##0.00' },
        { header: "Aceptadas", key: "aceptadas", width: 13, numFmt: "#,##0" },
        { header: "Rechazadas", key: "rechazadas", width: 13, numFmt: "#,##0" },
        { header: "% del total", key: "participacion", width: 14, numFmt: "0.0%" },
      ],
      report.vendors.vendors.map((vendor) => ({
        rank: vendor.rank,
        vendedor: vendor.vendedor,
        facturas: vendor.count,
        crc: vendor.crc,
        usd: vendor.usd,
        ticketCRC: vendor.ticketCRC,
        ticketUSD: vendor.ticketUSD,
        aceptadas: vendor.aceptadas,
        rechazadas: vendor.rechazadas,
        participacion: vendor.sharePct / 100,
      }))
    );
    addTableSheet(
      workbook,
      "Productos vendidos",
      "Productos más vendidos",
      subtitle,
      [
        { header: "#", key: "rank", width: 7, align: "center" },
        { header: "SKU", key: "sku", width: 22 },
        { header: "Producto", key: "producto", width: 62 },
        { header: "Unidades", key: "cantidad", width: 14, numFmt: "#,##0.00" },
        { header: "Días con venta", key: "dias", width: 16, numFmt: "#,##0" },
        { header: "Ventas CRC", key: "crc", width: 19, numFmt: '"CRC "#,##0' },
        { header: "Ventas USD", key: "usd", width: 17, numFmt: '"USD "#,##0.00' },
      ],
      report.sales.topProducts.map((product, index) => ({
        rank: index + 1,
        sku: product.sku,
        producto: product.descripcion,
        cantidad: product.cantidad,
        dias: product.saleDays,
        crc: product.crc,
        usd: product.usd,
      }))
    );
  } else {
    addTableSheet(
      workbook,
      "Vendedores",
      "Vendedores con más cotizaciones",
      subtitle,
      [
        { header: "#", key: "rank", width: 7, align: "center" },
        { header: "Vendedor", key: "vendedor", width: 34 },
        { header: "COTs", key: "cots", width: 10, numFmt: "#,##0" },
        { header: "Monto CRC", key: "crc", width: 19, numFmt: '"CRC "#,##0' },
        { header: "Monto USD", key: "usd", width: 17, numFmt: '"USD "#,##0.00' },
        { header: "Ticket CRC", key: "ticket", width: 18, numFmt: '"CRC "#,##0' },
        { header: "Clientes", key: "clientes", width: 12, numFmt: "#,##0" },
        { header: "Productos", key: "productos", width: 13, numFmt: "#,##0" },
        { header: "Líneas", key: "lineas", width: 11, numFmt: "#,##0" },
        { header: "Días", key: "dias", width: 9, numFmt: "#,##0" },
        { header: "% del total", key: "participacion", width: 14, numFmt: "0.0%" },
      ],
      report.quotes.vendors.map((vendor) => ({
        rank: vendor.rank,
        vendedor: vendor.vendedor,
        cots: vendor.count,
        crc: vendor.crc,
        usd: vendor.usd,
        ticket: vendor.ticketCRC,
        clientes: vendor.clientes,
        productos: vendor.productos,
        lineas: vendor.lineas,
        dias: vendor.activeDays,
        participacion: vendor.sharePct / 100,
      }))
    );
    addTableSheet(
      workbook,
      "Productos cotizados",
      "Productos más cotizados",
      subtitle,
      [
        { header: "#", key: "rank", width: 7, align: "center" },
        { header: "SKU", key: "sku", width: 22 },
        { header: "Producto", key: "producto", width: 62 },
        { header: "Cotizaciones", key: "cots", width: 16, numFmt: "#,##0" },
        { header: "Unidades", key: "cantidad", width: 14, numFmt: "#,##0.00" },
        { header: "Monto CRC", key: "crc", width: 19, numFmt: '"CRC "#,##0' },
        { header: "Monto USD", key: "usd", width: 17, numFmt: '"USD "#,##0.00' },
      ],
      report.quotes.topProducts.map((product, index) => ({
        rank: index + 1,
        sku: product.sku,
        producto: product.descripcion,
        cots: product.quoteCount,
        cantidad: product.cantidad,
        crc: product.crc,
        usd: product.usd,
      }))
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

function wrapPdfText(text: string, font: PDFFont, size: number, width: number, maxLines = 2) {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > width) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last.trim()}...`;
  }
  return lines;
}

function drawPdfHeader(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, report: CommercialReport) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 68, width, height: 68, color: hexColor(BRAND_DARK) });
  page.drawRectangle({ x: 0, y: height - 72, width, height: 4, color: hexColor(ACCENT) });
  page.drawText("TUStore Costa Rica", {
    x: 38, y: height - 32, size: 16, font: fonts.bold, color: hexColor(WHITE),
  });
  page.drawText(pdfText(report.title), {
    x: 38, y: height - 52, size: 10, font: fonts.regular, color: rgb(0.82, 0.85, 0.96),
  });
  const period = pdfText(report.periodLabel);
  const periodWidth = fonts.bold.widthOfTextAtSize(period, 10);
  page.drawText(period, {
    x: width - periodWidth - 38, y: height - 43, size: 10, font: fonts.bold, color: hexColor(WHITE),
  });
}

function drawPdfSummary(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  metrics: Array<[string, string]>
) {
  const { width, height } = page.getSize();
  const gap = 10;
  const cardWidth = (width - 76 - gap * (metrics.length - 1)) / metrics.length;
  metrics.forEach(([label, value], index) => {
    const x = 38 + index * (cardWidth + gap);
    const y = height - 137;
    page.drawRectangle({
      x, y, width: cardWidth, height: 48,
      color: hexColor(LIGHT),
      borderColor: hexColor(BORDER),
      borderWidth: 0.6,
    });
    page.drawText(pdfText(label), { x: x + 10, y: y + 30, size: 7.5, font: fonts.bold, color: hexColor(MUTED) });
    page.drawText(pdfText(value), { x: x + 10, y: y + 11, size: 12, font: fonts.bold, color: hexColor(BRAND_DARK) });
  });
}

function drawTable(
  document: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  report: CommercialReport,
  title: string,
  columns: PdfColumn[],
  rows: ReportRow[],
  startPage: PDFPage,
  startY: number
) {
  const margin = 38;
  const headerHeight = 22;
  const rowHeight = 28;
  let page = startPage;
  let y = startY;

  const beginSection = (continued = false) => {
    page.drawText(`${pdfText(title)}${continued ? " (continuación)" : ""}`, {
      x: margin, y, size: 12, font: fonts.bold, color: hexColor(BRAND_DARK),
    });
    y -= 18;
    let x = margin;
    for (const column of columns) {
      page.drawRectangle({ x, y: y - headerHeight, width: column.width, height: headerHeight, color: hexColor(BRAND) });
      const labelWidth = fonts.bold.widthOfTextAtSize(pdfText(column.label), 7.5);
      const tx = column.align === "right"
        ? x + column.width - labelWidth - 6
        : column.align === "center"
          ? x + (column.width - labelWidth) / 2
          : x + 6;
      page.drawText(pdfText(column.label), { x: tx, y: y - 14, size: 7.5, font: fonts.bold, color: hexColor(WHITE) });
      x += column.width;
    }
    y -= headerHeight;
  };

  beginSection();
  if (rows.length === 0) {
    page.drawText("Sin datos para este período.", { x: margin + 6, y: y - 18, size: 9, font: fonts.regular, color: hexColor(MUTED) });
    return page;
  }

  rows.forEach((row, rowIndex) => {
    if (y - rowHeight < 38) {
      page = document.addPage([841.89, 595.28]);
      drawPdfHeader(page, fonts, report);
      y = 595.28 - 95;
      beginSection(true);
    }
    let x = margin;
    if (rowIndex % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - rowHeight, width: columns.reduce((sum, column) => sum + column.width, 0), height: rowHeight, color: rgb(0.975, 0.98, 0.99) });
    }
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      const value = pdfText(row[columnIndex]);
      const lines = wrapPdfText(value, fonts.regular, 7.5, column.width - 10, columnIndex === 1 || columnIndex === 2 ? 2 : 1);
      lines.forEach((line, lineIndex) => {
        const lineWidth = fonts.regular.widthOfTextAtSize(line, 7.5);
        const tx = column.align === "right"
          ? x + column.width - lineWidth - 5
          : column.align === "center"
            ? x + (column.width - lineWidth) / 2
            : x + 5;
        page.drawText(line, { x: tx, y: y - 11 - lineIndex * 9, size: 7.5, font: fonts.regular, color: hexColor(BRAND_DARK) });
      });
      page.drawLine({ start: { x, y: y - rowHeight }, end: { x: x + column.width, y: y - rowHeight }, thickness: 0.35, color: hexColor(BORDER) });
      x += column.width;
    }
    y -= rowHeight;
  });
  return page;
}

export async function buildCommercialPdf(report: CommercialReport): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`${report.title} - ${report.periodLabel}`);
  document.setAuthor("TUStore Costa Rica");
  document.setSubject(report.kind === "sales" ? "Ventas y productos más vendidos" : "Cotizaciones y productos más cotizados");
  document.setCreator("TUStore Admin");
  document.setCreationDate(new Date());
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const firstPage = document.addPage([841.89, 595.28]);
  drawPdfHeader(firstPage, fonts, report);

  if (report.kind === "sales") {
    drawPdfSummary(firstPage, fonts, [
      ["Facturas", formatNumber(report.sales.count)],
      ["Ventas CRC", currencyCRC(report.sales.totalCRC)],
      ["Ventas USD", currencyUSD(report.sales.totalUSD)],
      ["Unidades", formatNumber(report.sales.productUnits, 2)],
    ]);
    drawTable(
      document,
      fonts,
      report,
      "Vendedores con más ventas",
      [
        { label: "#", width: 25, align: "center" },
        { label: "Vendedor", width: 175 },
        { label: "Facturas", width: 55, align: "right" },
        { label: "Ventas CRC", width: 105, align: "right" },
        { label: "Ventas USD", width: 85, align: "right" },
        { label: "Ticket CRC", width: 85, align: "right" },
        { label: "Ticket USD", width: 75, align: "right" },
        { label: "Aceptadas", width: 65, align: "right" },
        { label: "% total", width: 55, align: "right" },
      ],
      report.vendors.vendors.map((vendor) => [
        vendor.rank,
        vendor.vendedor,
        formatNumber(vendor.count),
        currencyCRC(vendor.crc),
        currencyUSD(vendor.usd),
        currencyCRC(vendor.ticketCRC),
        currencyUSD(vendor.ticketUSD),
        formatNumber(vendor.aceptadas),
        `${formatNumber(vendor.sharePct, 1)}%`,
      ]),
      firstPage,
      595.28 - 166
    );
    const productPage = document.addPage([841.89, 595.28]);
    drawPdfHeader(productPage, fonts, report);
    drawTable(
      document,
      fonts,
      report,
      "Productos más vendidos",
      [
        { label: "#", width: 25, align: "center" },
        { label: "SKU", width: 95 },
        { label: "Producto", width: 270 },
        { label: "Unidades", width: 70, align: "right" },
        { label: "Días", width: 45, align: "right" },
        { label: "Ventas CRC", width: 110, align: "right" },
        { label: "Ventas USD", width: 90, align: "right" },
      ],
      report.sales.topProducts.map((product, index) => [
        index + 1,
        product.sku || "-",
        product.descripcion,
        formatNumber(product.cantidad, 2),
        formatNumber(product.saleDays),
        currencyCRC(product.crc),
        currencyUSD(product.usd),
      ]),
      productPage,
      595.28 - 100
    );
  } else {
    drawPdfSummary(firstPage, fonts, [
      ["Cotizaciones", formatNumber(report.quotes.count)],
      ["Monto CRC", currencyCRC(report.quotes.totalCRC)],
      ["Monto USD", currencyUSD(report.quotes.totalUSD)],
      ["Productos", formatNumber(report.quotes.productos)],
    ]);
    drawTable(
      document,
      fonts,
      report,
      "Vendedores con más cotizaciones",
      [
        { label: "#", width: 25, align: "center" },
        { label: "Vendedor", width: 160 },
        { label: "COTs", width: 45, align: "right" },
        { label: "Monto CRC", width: 100, align: "right" },
        { label: "Monto USD", width: 80, align: "right" },
        { label: "Ticket CRC", width: 90, align: "right" },
        { label: "Clientes", width: 55, align: "right" },
        { label: "Productos", width: 60, align: "right" },
        { label: "% total", width: 55, align: "right" },
      ],
      report.quotes.vendors.map((vendor) => [
        vendor.rank,
        vendor.vendedor,
        formatNumber(vendor.count),
        currencyCRC(vendor.crc),
        currencyUSD(vendor.usd),
        currencyCRC(vendor.ticketCRC),
        formatNumber(vendor.clientes),
        formatNumber(vendor.productos),
        `${formatNumber(vendor.sharePct, 1)}%`,
      ]),
      firstPage,
      595.28 - 166
    );
    const productPage = document.addPage([841.89, 595.28]);
    drawPdfHeader(productPage, fonts, report);
    drawTable(
      document,
      fonts,
      report,
      "Productos más cotizados",
      [
        { label: "#", width: 25, align: "center" },
        { label: "SKU", width: 95 },
        { label: "Producto", width: 265 },
        { label: "COTs", width: 60, align: "right" },
        { label: "Unidades", width: 70, align: "right" },
        { label: "Monto CRC", width: 110, align: "right" },
        { label: "Monto USD", width: 90, align: "right" },
      ],
      report.quotes.topProducts.map((product, index) => [
        index + 1,
        product.sku || "-",
        product.descripcion,
        formatNumber(product.quoteCount),
        formatNumber(product.cantidad, 2),
        currencyCRC(product.crc),
        currencyUSD(product.usd),
      ]),
      productPage,
      595.28 - 100
    );
  }

  const pages = document.getPages();
  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const footer = `Generado ${pdfText(generatedAt())} | Página ${index + 1} de ${pages.length}`;
    const footerWidth = fonts.regular.widthOfTextAtSize(footer, 7);
    page.drawText(footer, { x: width - footerWidth - 38, y: 18, size: 7, font: fonts.regular, color: hexColor(MUTED) });
  });
  return document.save();
}

