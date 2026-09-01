import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getBranchProductRankings, type ProductRankRow } from "@/lib/cpi-products";
import { getUserRole, isAdminLike } from "@/lib/roles";
import { getCurrentUser } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAND = rgb(14 / 255, 24 / 255, 63 / 255);
const MUTED = rgb(102 / 255, 112 / 255, 133 / 255);
const BORDER = rgb(217 / 255, 221 / 255, 234 / 255);
type PdfColumn = { label: string; width: number; align?: "left" | "right" | "center" };

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date());
}

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "sucursal";
}

function number(value: number, digits = 0) {
  return Number(value || 0).toLocaleString("es-CR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("₡", "CRC ")
    .replace(/[–—−]/g, "-")
    .replace(/[•·]/g, "/")
    .replace(/[^\x20-\x7E]/g, "");
}

async function buildExcel(branch: string, rows: ProductRankRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TUStore Costa Rica";
  workbook.company = "TUStore Costa Rica";
  workbook.title = `Top 40 productos - ${branch}`;
  workbook.subject = "Productos más vendidos por sucursal";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Top 40", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.mergeCells("A1:H2");
  const title = sheet.getCell("A1");
  title.value = `Top 40 productos más vendidos - ${branch}`;
  title.font = { name: "Aptos Display", size: 19, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E183F" } };
  title.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 25;

  sheet.mergeCells("A3:H3");
  sheet.getCell("A3").value = `${rows.length} productos exportados. Acumulado histórico de la sucursal. Generado el ${today()}.`;
  sheet.getCell("A3").font = { name: "Aptos", size: 10, italic: true, color: { argb: "FF667085" } };
  sheet.getCell("A3").alignment = { vertical: "middle" };
  sheet.getRow(3).height = 22;

  sheet.addTable({
    name: "Top40Products",
    ref: "A5",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: [
      { name: "#" },
      { name: "SKU" },
      { name: "Producto" },
      { name: "Unidades" },
      { name: "Monto CRC" },
      { name: "Monto USD" },
      { name: "Días con venta" },
      { name: "Última venta" },
    ],
    rows: rows.map((row) => [
      row.rank,
      row.sku || "-",
      row.descripcion,
      row.cantidad,
      Math.round(row.crc),
      Math.round(row.usd * 100) / 100,
      row.saleDays,
      row.lastSale || "-",
    ]),
  });

  const header = sheet.getRow(5);
  header.font = { name: "Aptos", bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF263AAF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;

  rows.forEach((_, index) => {
    const added = sheet.getRow(6 + index);
    added.font = { name: "Aptos", size: 10 };
    added.alignment = { vertical: "middle" };
    added.height = 22;
    added.getCell(3).alignment = { vertical: "middle", wrapText: true };
    [1, 4, 5, 6, 7, 8].forEach((index) => {
      added.getCell(index).alignment = { vertical: "middle", horizontal: "right" };
    });
    added.getCell(5).numFmt = '"CRC "#,##0';
    added.getCell(6).numFmt = '"USD "#,##0.00';
  });

  [6, 18, 56, 13, 18, 17, 15, 15].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.pageSetup.printArea = `A1:H${5 + rows.length}`;
  sheet.pageSetup.printTitlesRow = "1:5";
  sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  const raw = await workbook.xlsx.writeBuffer();
  return new Uint8Array(raw as unknown as ArrayBuffer);
}

function lines(value: string, maxChars: number) {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      result.push(current);
      current = word;
    } else current = next;
  }
  if (current) result.push(current);
  return result.slice(0, 2).length ? result.slice(0, 2) : ["-"];
}

async function buildPdf(branch: string, rows: ProductRankRow[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Top 40 productos - ${branch}`);
  pdf.setAuthor("TUStore Costa Rica");
  pdf.setSubject("Productos más vendidos por sucursal");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const columns: PdfColumn[] = [
    { label: "#", width: 25, align: "center" }, { label: "SKU", width: 85 },
    { label: "Producto", width: 250 }, { label: "Unidades", width: 65, align: "right" },
    { label: "Monto CRC", width: 105, align: "right" }, { label: "Monto USD", width: 92, align: "right" },
    { label: "Días", width: 42, align: "right" }, { label: "Última venta", width: 65, align: "right" },
  ];
  const margin = 38;
  const pageSize: [number, number] = [841.89, 595.28];
  let page = pdf.addPage(pageSize);
  let y = 0;

  const startPage = (continuation = false) => {
    page = page.getHeight() === pageSize[1] && y === 0 ? page : pdf.addPage(pageSize);
    page.drawRectangle({ x: 0, y: page.getHeight() - 76, width: page.getWidth(), height: 76, color: BRAND });
    page.drawText("TUStore Costa Rica", { x: margin, y: page.getHeight() - 32, size: 10, font: bold, color: rgb(1, 1, 1) });
    page.drawText(pdfText(`Top 40 productos más vendidos - ${branch}${continuation ? " (continuación)" : ""}`), { x: margin, y: page.getHeight() - 54, size: 17, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Acumulado histórico de la sucursal", { x: margin, y: page.getHeight() - 96, size: 9, font: regular, color: MUTED });
    let x = margin;
    y = page.getHeight() - 122;
    columns.forEach((column) => {
      page.drawRectangle({ x, y: y - 20, width: column.width, height: 20, color: BRAND });
      const width = bold.widthOfTextAtSize(pdfText(column.label), 7);
      page.drawText(pdfText(column.label), { x: column.align === "right" ? x + column.width - width - 4 : column.align === "center" ? x + (column.width - width) / 2 : x + 4, y: y - 13, size: 7, font: bold, color: rgb(1, 1, 1) });
      x += column.width;
    });
    y -= 20;
  };

  startPage();
  rows.forEach((row, index) => {
    const values = [String(row.rank), row.sku || "-", row.descripcion, number(row.cantidad, 2), `CRC ${number(row.crc)}`, `USD ${number(row.usd, 2)}`, number(row.saleDays), row.lastSale || "-"];
    const descriptionLines = lines(values[2], 47);
    const rowHeight = Math.max(22, descriptionLines.length * 10 + 8);
    if (y - rowHeight < 38) startPage(index > 0);
    let x = margin;
    columns.forEach((column, columnIndex) => {
      page.drawLine({ start: { x, y }, end: { x: x + column.width, y }, thickness: 0.35, color: BORDER });
      const cellLines = columnIndex === 2 ? descriptionLines : lines(values[columnIndex], columnIndex === 1 ? 16 : 18);
      cellLines.forEach((line, lineIndex) => {
        const width = regular.widthOfTextAtSize(line, 7.2);
        page.drawText(line, { x: column.align === "right" ? x + column.width - width - 4 : column.align === "center" ? x + (column.width - width) / 2 : x + 4, y: y - 12 - lineIndex * 9, size: 7.2, font: regular, color: BRAND });
      });
      page.drawLine({ start: { x: x + column.width, y }, end: { x: x + column.width, y: y - rowHeight }, thickness: 0.35, color: BORDER });
      x += column.width;
    });
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x, y: y - rowHeight }, thickness: 0.35, color: BORDER });
    y -= rowHeight;
  });
  pdf.getPages().forEach((pdfPage, index, pages) => {
    const footer = `Generado ${today()} | Página ${index + 1} de ${pages.length}`;
    pdfPage.drawText(footer, { x: pdfPage.getWidth() - regular.widthOfTextAtSize(footer, 7) - margin, y: 18, size: 7, font: regular, color: MUTED });
  });
  return pdf.save();
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) return new NextResponse("No autorizado", { status: 401 });

  const params = new URL(request.url).searchParams;
  const branch = params.get("branch")?.trim();
  if (!branch || branch.length > 100) return new NextResponse("Sucursal inválida", { status: 400 });
  const format = params.get("format") === "pdf" ? "pdf" : "xlsx";
  try {
    const ranking = await getBranchProductRankings(40);
    const rows = ranking.find((item) => item.sucursal === branch)?.rows;
    if (!rows) return new NextResponse("Sucursal no encontrada", { status: 404 });

    const body = format === "pdf" ? await buildPdf(branch, rows) : await buildExcel(branch, rows);
    const extension = format === "pdf" ? "pdf" : "xlsx";
    const contentType = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const responseBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="TUStore-top-40-${safeFilename(branch)}-${today()}.${extension}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("No se pudo generar el reporte de productos por sucursal", error);
    return new NextResponse("No se pudo generar el reporte", { status: 500 });
  }
}

