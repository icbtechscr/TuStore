import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type {
  InventoryRotationRow,
  RotationFilter,
} from "@/lib/inventory-analytics";

export type InventoryRotationExport = {
  rows: InventoryRotationRow[];
  requestedDays: number;
  trackedDays: number;
  from: string;
  to: string;
  branch: string | null;
  status: RotationFilter;
};

const STATUS_LABELS = {
  no_movement: "Sin movimiento",
  low: "Baja rotación",
  normal: "Rotación normal",
} as const;

const FILTER_LABELS: Record<RotationFilter, string> = {
  attention: "Requieren atención",
  no_movement: "Sin movimiento",
  low: "Baja rotación",
  normal: "Rotación normal",
  all: "Todos",
};

function generatedDate() {
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  }).format(new Date());
}

function dayLabel(day: string | null): string {
  if (!day) return "Sin venta registrada";
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

function quantity(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function metadataLine(report: InventoryRotationExport): string {
  return `${report.branch || "Todas las sucursales"} · ${FILTER_LABELS[report.status]} · ${report.trackedDays} día(s) disponibles, del ${dayLabel(report.from)} al ${dayLabel(report.to)} · ${report.rows.length} resultado(s)`;
}

export async function buildInventoryRotationExcel(
  report: InventoryRotationExport
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TUStore Costa Rica";
  workbook.company = "TUStore Costa Rica";
  workbook.title = "Analítica de rotación de inventario";
  workbook.subject = "Productos con baja rotación o sin movimiento";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Rotación", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  sheet.mergeCells("A1:J2");
  const title = sheet.getCell("A1");
  title.value = "Analítica de rotación de inventario";
  title.font = {
    name: "Aptos Display",
    size: 20,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E183F" } };
  title.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 25;

  sheet.mergeCells("A3:J3");
  const details = sheet.getCell("A3");
  details.value = `${metadataLine(report)}. Generado el ${generatedDate()}.`;
  details.font = {
    name: "Aptos",
    size: 10,
    italic: true,
    color: { argb: "FF667085" },
  };
  details.alignment = { vertical: "middle" };
  sheet.getRow(3).height = 24;

  sheet.addTable({
    name: "InventoryRotation",
    ref: "A5",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: [
      { name: "Sucursal" },
      { name: "SKU" },
      { name: "Producto" },
      { name: "Existencias" },
      { name: "Unidades vendidas" },
      { name: "Días con venta" },
      { name: "Última venta" },
      { name: "Días sin vender" },
      { name: "Cobertura estimada" },
      { name: "Clasificación" },
    ],
    rows: report.rows.map((row) => [
      row.branch,
      row.sku || "-",
      row.description,
      quantity(row.stockQty),
      quantity(row.soldUnits),
      row.saleDays,
      dayLabel(row.lastSale),
      row.lastSale ? row.daysWithoutSale : `≥ ${row.daysWithoutSale}`,
      row.coverageDays == null ? "Sin salida" : `${row.coverageDays} días`,
      STATUS_LABELS[row.status],
    ]),
  });

  const header = sheet.getRow(5);
  header.font = { name: "Aptos", bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF263AAF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 24;

  report.rows.forEach((row, index) => {
    const excelRow = sheet.getRow(6 + index);
    excelRow.font = { name: "Aptos", size: 10 };
    excelRow.height = 24;
    excelRow.alignment = { vertical: "middle" };
    excelRow.getCell(3).alignment = { vertical: "middle", wrapText: true };
    [4, 5, 6, 8].forEach((column) => {
      excelRow.getCell(column).alignment = { vertical: "middle", horizontal: "right" };
    });
    excelRow.getCell(4).numFmt = "#,##0.00";
    excelRow.getCell(5).numFmt = "#,##0.00";
    if (row.status === "no_movement") {
      excelRow.getCell(10).font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFB42318" } };
    } else if (row.status === "low") {
      excelRow.getCell(10).font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFB54708" } };
    }
  });

  [18, 19, 54, 14, 18, 15, 18, 17, 20, 20].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.pageSetup.printArea = `A1:J${Math.max(5, report.rows.length + 5)}`;
  sheet.pageSetup.printTitlesRow = "1:5";
  sheet.pageSetup.margins = {
    left: 0.25,
    right: 0.25,
    top: 0.4,
    bottom: 0.4,
    header: 0.2,
    footer: 0.2,
  };

  const raw = await workbook.xlsx.writeBuffer();
  return new Uint8Array(raw as unknown as ArrayBuffer);
}

const PDF_SIZE: [number, number] = [841.89, 595.28];
const PDF_MARGIN = 28;
const PDF_BRAND = rgb(14 / 255, 24 / 255, 63 / 255);
const PDF_BLUE = rgb(38 / 255, 58 / 255, 175 / 255);
const PDF_MUTED = rgb(102 / 255, 112 / 255, 133 / 255);
const PDF_BORDER = rgb(217 / 255, 221 / 255, 234 / 255);
const PDF_LIGHT = rgb(247 / 255, 248 / 255, 252 / 255);

type PdfColumn = {
  label: string;
  width: number;
  align?: "left" | "right";
};

const PDF_COLUMNS: PdfColumn[] = [
  { label: "Sucursal", width: 72 },
  { label: "SKU", width: 70 },
  { label: "Producto", width: 230 },
  { label: "Stock", width: 48, align: "right" },
  { label: "Vend.", width: 48, align: "right" },
  { label: "Ult. venta", width: 68, align: "right" },
  { label: "Sin vender", width: 58, align: "right" },
  { label: "Cobertura", width: 68, align: "right" },
  { label: "Estado", width: 82, align: "right" },
];

function pdfText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/≥/g, ">=")
    .replace(/[–—−]/g, "-")
    .replace(/[•·]/g, "/")
    .replace(/[^\x20-\x7E]/g, "");
}

function fitText(value: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = pdfText(value);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let result = clean;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}...`;
}

function drawTextInColumn(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  column: PdfColumn,
  font: PDFFont,
  size: number,
  color = PDF_BRAND
) {
  const text = fitText(value, font, size, column.width - 8);
  const width = font.widthOfTextAtSize(text, size);
  const textX = column.align === "right" ? x + column.width - width - 4 : x + 4;
  page.drawText(text, { x: textX, y, size, font, color });
}

function drawPdfHeader(
  page: PDFPage,
  report: InventoryRotationExport,
  bold: PDFFont,
  regular: PDFFont
): number {
  const width = page.getWidth();
  page.drawRectangle({
    x: 0,
    y: page.getHeight() - 82,
    width,
    height: 82,
    color: PDF_BRAND,
  });
  page.drawText("Analitica de rotacion de inventario", {
    x: PDF_MARGIN,
    y: page.getHeight() - 36,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(fitText(metadataLine(report), regular, 8, width - PDF_MARGIN * 2), {
    x: PDF_MARGIN,
    y: page.getHeight() - 56,
    size: 8,
    font: regular,
    color: rgb(0.88, 0.9, 0.98),
  });
  return page.getHeight() - 105;
}

function drawPdfTableHeader(page: PDFPage, y: number, bold: PDFFont): number {
  const height = 22;
  page.drawRectangle({
    x: PDF_MARGIN,
    y: y - height + 5,
    width: PDF_COLUMNS.reduce((sum, column) => sum + column.width, 0),
    height,
    color: PDF_BLUE,
  });
  let x = PDF_MARGIN;
  for (const column of PDF_COLUMNS) {
    drawTextInColumn(page, column.label, x, y - 9, column, bold, 7, rgb(1, 1, 1));
    x += column.width;
  }
  return y - height;
}

export async function buildInventoryRotationPdf(
  report: InventoryRotationExport
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Analítica de rotación de inventario");
  pdf.setAuthor("TUStore Costa Rica");
  pdf.setSubject("Productos con baja rotación o sin movimiento");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(PDF_SIZE);
  let y = drawPdfTableHeader(page, drawPdfHeader(page, report, bold, regular), bold);
  const rowHeight = 19;

  for (let index = 0; index < report.rows.length; index += 1) {
    const row = report.rows[index];
    if (y - rowHeight < 38) {
      page = pdf.addPage(PDF_SIZE);
      y = drawPdfTableHeader(page, drawPdfHeader(page, report, bold, regular), bold);
    }
    if (index % 2 === 1) {
      page.drawRectangle({
        x: PDF_MARGIN,
        y: y - rowHeight + 4,
        width: PDF_COLUMNS.reduce((sum, column) => sum + column.width, 0),
        height: rowHeight,
        color: PDF_LIGHT,
      });
    }
    const values = [
      row.branch,
      row.sku || "-",
      row.description,
      quantity(row.stockQty).toLocaleString("en-US"),
      quantity(row.soldUnits).toLocaleString("en-US"),
      dayLabel(row.lastSale),
      row.lastSale ? `${row.daysWithoutSale} dias` : `>= ${row.daysWithoutSale} dias`,
      row.coverageDays == null ? "Sin salida" : `${row.coverageDays} dias`,
      STATUS_LABELS[row.status],
    ];
    let x = PDF_MARGIN;
    PDF_COLUMNS.forEach((column, columnIndex) => {
      const isStatus = columnIndex === PDF_COLUMNS.length - 1;
      const color =
        isStatus && row.status === "no_movement"
          ? rgb(180 / 255, 35 / 255, 24 / 255)
          : isStatus && row.status === "low"
            ? rgb(181 / 255, 71 / 255, 8 / 255)
            : PDF_BRAND;
      drawTextInColumn(
        page,
        values[columnIndex],
        x,
        y - 9,
        column,
        isStatus ? bold : regular,
        6.5,
        color
      );
      x += column.width;
    });
    page.drawLine({
      start: { x: PDF_MARGIN, y: y - rowHeight + 4 },
      end: {
        x: PDF_MARGIN + PDF_COLUMNS.reduce((sum, column) => sum + column.width, 0),
        y: y - rowHeight + 4,
      },
      thickness: 0.35,
      color: PDF_BORDER,
    });
    y -= rowHeight;
  }

  pdf.getPages().forEach((pdfPage, index, pages) => {
    const footer = `Generado ${generatedDate()} | Pagina ${index + 1} de ${pages.length}`;
    pdfPage.drawText(footer, {
      x: pdfPage.getWidth() - regular.widthOfTextAtSize(footer, 7) - PDF_MARGIN,
      y: 17,
      size: 7,
      font: regular,
      color: PDF_MUTED,
    });
  });

  // Los object streams de PDF pueden producir páginas invisibles en algunos
  // visores cuando el reporte supera varias decenas de páginas.
  return pdf.save({ useObjectStreams: false });
}

