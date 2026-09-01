// Cliente de scraping de CPI (appcontadorcpi.com). SOLO servidor.
import https from "node:https";
//
// Contrato (2026-07) inspeccionando "Facturacion FE":
//   - PHP crea la sesion (PHPSESSID) en el primer GET; el POST del formulario
//     de login la autentica.
//   - Login: POST "Page Main 4.php" con Usuphp, Passphp, SocaaID.
//   - Lista COMPLETADAS: POST "ControlFacturacion - Consultas.php"
//       params: duser, d, str3, SocaaID, idiomasistema  -> HTML de la tabla.
//   - Fila (15 celdas): tipo, [recibo], CLAVE(50 dig), fecha, origen(+cod),
//     sucursal(+cod), vendedor(+cod), referencia, -, medio pago, [idcliente],
//     moneda, subtotal(CRC/USD), -, estado(ACEPTADA/RECHAZADA).

const BASE = (process.env.CPI_BASE_URL || "https://www.appcontadorcpi.com/gm/").replace(
  /\/*$/,
  "/"
);
const USER = process.env.CPI_USER || "";
const PASS = process.env.CPI_PASS || "";
const ID = process.env.CPI_ID || "20";

// Headers de navegador: sin esto el servidor responde 403 a peticiones "bot".
const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "es-CR,es;q=0.9,en;q=0.8",
  "accept-encoding": "identity",
};

type CpiHttpResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

export function cpiConfigured(): boolean {
  return Boolean(USER && PASS && ID);
}

export type CpiInvoice = {
  clave: string;
  tipo: string;
  factura: string;
  fechaIso: string | null;
  origen: string;
  sucursal: string;
  vendedor: string;
  vendedorCod: string;
  cliente: string;
  moneda: "CRC" | "USD" | "EUR" | string;
  subtotal: number;
  estado: string;
};

export type CpiQuote = {
  cpiId: string;
  quoteNumber: string;
  tipo: string;
  fechaIso: string | null;
  origen: string;
  sucursal: string;
  sucursalCode: string;
  puntoVentaCode: string;
  vendedor: string;
  vendedorCod: string;
  cliente: string;
  clienteId: string;
  medioPago: string;
  moneda: "CRC" | "USD" | "EUR" | string;
  subtotal: number;
  estado: string;
  actividad: string;
};

export type CpiQuoteLine = {
  cpiId: string;
  quoteNumber: string;
  lineId: string;
  lineNo: number;
  itemId: string;
  sku: string;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  descuento: number;
  subtotal: number;
  impuesto: number;
  total: number;
  totalConImpuesto: number;
};

export type CpiQuoteWithLines = CpiQuote & { lines: CpiQuoteLine[] };

export type CpiSoldProduct = {
  sku: string;
  descripcion: string;
  moneda: "CRC" | "USD" | "EUR" | string;
  cantidad: number;
  totalVenta: number;
  costoVenta: number;
  utilidad: number;
  stockQty: number | null;
};

export type CpiDailySoldProducts = {
  day: string;
  products: CpiSoldProduct[];
};

export type CpiInventoryItem = {
  cpiId: string;
  sku: string;
  descripcion: string;
  stockQty: number;
};

export type CpiQuoteFetchOptions = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  limit?: number;
};

function mergeCookies(...groups: string[][]): string {
  const jar = new Map<string, string>();
  for (const g of groups)
    for (const kv of g) {
      const i = kv.indexOf("=");
      if (i > 0) jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

function readNativeSetCookies(headers: CpiHttpResponse["headers"]): string[] {
  const raw = headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(";")[0]).filter(Boolean);
}

function cpiRequest(
  pathOrUrl: string,
  opts: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string } = {}
): Promise<CpiHttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(pathOrUrl, BASE);
    const body = opts.body ?? "";
    const headers: Record<string, string | number> = {
      ...BROWSER_HEADERS,
      ...(opts.headers ?? {}),
    };
    if (body && headers["content-length"] == null) {
      headers["content-length"] = Buffer.byteLength(body);
    }

    const req = https.request(
      {
        method: opts.method ?? "GET",
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as CpiHttpResponse["headers"],
            body: data,
          });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function ensureCpiOk(res: CpiHttpResponse, label: string): void {
  if (/AVISO DE BLOQUEO/i.test(res.body)) {
    throw new Error(
      `CPI: ${label} bloqueada (HTTP ${res.status}). El sitio devolvio AVISO DE BLOQUEO.`
    );
  }
  if (res.status >= 400) {
    const t = res.body.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(`CPI: ${label} fallo (HTTP ${res.status}) - ${t}`);
  }
}

// --- Login: GET para la cookie de sesion, luego POST del formulario ---
async function cpiLogin(): Promise<string> {
  if (!cpiConfigured()) {
    throw new Error("CPI sin configurar (CPI_USER/CPI_PASS/CPI_ID)");
  }
  const pre = await cpiRequest("Enter.php", {
    method: "GET",
    headers: { referer: BASE },
  });
  const c1 = readNativeSetCookies(pre.headers);
  const jar1 = mergeCookies(c1);

  const body = new URLSearchParams({ Usuphp: USER, Passphp: PASS, SocaaID: ID });
  const res = await cpiRequest("Page Main 4.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: new URL(BASE).origin,
      referer: `${BASE}Enter.php`,
      ...(jar1 ? { cookie: jar1 } : {}),
    },
    body: body.toString(),
  });
  const loginHtml = res.body;
  const c2 = readNativeSetCookies(res.headers);
  const cookie = mergeCookies(c1, c2);
  const loginLooksOk = /Aplicaciones|Facturacion|Facturaci\S*n|EXIT|Cerrar/i.test(
    loginHtml
  );
  if (/AVISO DE BLOQUEO/i.test(loginHtml)) {
    throw new Error(
      `CPI: login bloqueado (HTTP ${res.status}). El sitio devolvio AVISO DE BLOQUEO.`
    );
  }
  if (!cookie && !loginLooksOk) {
    let hint = "";
    try {
      const t = loginHtml.replace(/\s+/g, " ").slice(0, 160);
      hint = ` - ${t}`;
    } catch {
      /* ignore */
    }
    throw new Error(
      `CPI: login sin cookie de sesion (GET ${pre.status}, POST ${res.status})${hint}`
    );
  }
  return cookie;
}

// --- Descarga el HTML de la lista de facturas completadas ---
export async function cpiFetchCompletadasHtml(cookie?: string): Promise<string> {
  const jar = cookie || (await cpiLogin());
  const body = new URLSearchParams({
    duser: USER,
    d: "",
    str3: "",
    SocaaID: ID,
    idiomasistema: "Espa\u00f1ol",
  });
  const res = await cpiRequest("ControlFacturacion - Consultas.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(jar ? { cookie: jar } : {}),
    },
    body: body.toString(),
  });
  ensureCpiOk(res, "consulta de facturas");
  return res.body;
}

// --- Parser tolerante del HTML a filas de factura ---
const MONEDA_MAP: Record<string, string> = {
  Colones: "CRC",
  Dolares: "USD",
  "D\u00f3lares": "USD",
  "DÃ³lares": "USD",
  Euros: "EUR",
};

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(s: string): number {
  const n = s.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function decodeHtml(s: string): string {
  const named: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    quot: '"',
    apos: "'",
    cent: "\u00a2",
    aacute: "\u00e1",
    eacute: "\u00e9",
    iacute: "\u00ed",
    oacute: "\u00f3",
    uacute: "\u00fa",
    Aacute: "\u00c1",
    Eacute: "\u00c9",
    Iacute: "\u00cd",
    Oacute: "\u00d3",
    Uacute: "\u00da",
    ntilde: "\u00f1",
    Ntilde: "\u00d1",
  };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    )
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => named[name] ?? m);
}

function cleanText(s: string): string {
  return decodeHtml(stripTags(s)).replace(/\s+/g, " ").trim();
}

function parseCpiAmount(s: string): number {
  return parseAmount(decodeHtml(s));
}

function attrValue(tag: string, attr: string): string {
  const re = new RegExp(`${attr}=["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m ? decodeHtml(m[1]) : "";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inputValueByName(html: string, name: string): string {
  const re = new RegExp(
    `<input\\b[^>]*name=["']${escapeRegExp(name)}["'][^>]*>`,
    "i"
  );
  const tag = html.match(re)?.[0] ?? "";
  return attrValue(tag, "value").trim();
}

function inputValues(html: string): string[] {
  const tags = html.match(/<input\b[^>]*>/gi) ?? [];
  return tags
    .map((tag) => attrValue(tag, "value").trim())
    .filter((value) => value.length > 0);
}

function lastInputValue(html: string): string {
  const values = inputValues(html);
  return values.at(-1) ?? "";
}

function cellsOfRow(row: string): string[] {
  return row.match(/<td[\s\S]*?<\/td>/gi) ?? [];
}

function cellsOfTableRow(row: string): string[] {
  return row.match(/<(?:th|td)\b[\s\S]*?<\/(?:th|td)>/gi) ?? [];
}

function dateOnly(s?: string): string {
  const raw = (s ?? "").trim();
  const m = raw.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : raw;
}

function mapCurrency(raw: string): string {
  const text = raw.trim();
  return MONEDA_MAP[text] || MONEDA_MAP[decodeHtml(text)] || text || "CRC";
}

function selectedOption(selectHtml: string): { value: string; text: string } {
  const selected =
    selectHtml.match(/<option\b([^>]*)\bselected\b[^>]*>([\s\S]*?)<\/option>/i) ??
    selectHtml.match(/<option\b([^>]*)>([\s\S]*?)<\/option>/i);
  if (!selected) return { value: "", text: "" };
  return {
    value: attrValue(selected[1], "value"),
    text: cleanText(selected[2]),
  };
}

export function parseCompletadas(html: string): CpiInvoice[] {
  const out: CpiInvoice[] = [];
  const rowRe = /<tr[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowRe) || [];
  for (const row of rows) {
    if (!/(ACEPTADA|RECHAZADA|PROCESANDO|PENDIENTE)/i.test(row)) continue;
    if (!/(Colones|Dolares|D\u00f3lares|DÃ³lares|Euros)/.test(row)) continue;

    const fecha = row.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
    const moneda = row.match(/\b(Colones|Dolares|D\u00f3lares|DÃ³lares|Euros)\b/);
    const monto = row.match(/(?:\u00a2|\$|\u20a1|Â¢|â‚¡)\s?[\d][\d.,]*/);
    const estado = row.match(/\b(ACEPTADA|RECHAZADA|PROCESANDO|PENDIENTE)\b/i);
    const clave = row.match(/\b(\d{40,60})\b/);

    const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || []).map(stripTags);
    const inputVals = (row.match(/value="([^"]*)"/gi) || []).map((m) =>
      m.replace(/^value="/i, "").replace(/"$/, "")
    );

    const tipo = cells[0] || "Factura";
    const vendedor = cells[6] || "";
    const origen = cells[4] || "";
    const sucursal = cells[5] || "";
    const cliente = cells[7] || "";
    const vendedorCod = inputVals[5] || inputVals[4] || "";
    const monedaKey = moneda ? MONEDA_MAP[moneda[1]] || moneda[1] : "CRC";

    out.push({
      clave: clave ? clave[1] : "",
      tipo,
      factura: "",
      fechaIso: fecha ? `${fecha[1]}T${fecha[2]}` : null,
      origen,
      sucursal,
      vendedor,
      vendedorCod,
      cliente,
      moneda: monedaKey,
      subtotal: monto ? parseAmount(monto[0]) : 0,
      estado: estado ? estado[1].toUpperCase() : "",
    });
  }
  return out;
}

export async function cpiGetCompletadas(): Promise<CpiInvoice[]> {
  const html = await cpiFetchCompletadasHtml();
  return parseCompletadas(html);
}

// --- Productos vendidos e inventario --------------------------------------

function reportDate(day: string, endOfDay = false): string {
  const clean = dateOnly(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    throw new Error(`Fecha CPI invalida: ${day}`);
  }
  return `${clean} ${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function reportRows(html: string): string[][] {
  return (html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [])
    .map((row) => cellsOfTableRow(row).map(cleanText))
    .filter((cells) => cells.length > 0);
}

function headerIndex(headers: string[], label: string): number {
  const wanted = normalizeName(label);
  return headers.findIndex((header) => normalizeName(header) === wanted);
}

function reportNumber(value: string): number {
  const negative = /^\s*\([\s\S]*\)\s*$/.test(value);
  const parsed = parseCpiAmount(value);
  return negative ? -Math.abs(parsed) : parsed;
}

export async function cpiFetchSoldProductsHtml(
  opts: { from: string; to: string },
  cookie?: string
): Promise<string> {
  const jar = cookie || (await cpiLogin());
  const body = new URLSearchParams({
    duser: USER,
    d: USER,
    e: "",
    f: "",
    g: "",
    h: "9999",
    i: "",
    j: "",
    k: reportDate(opts.from),
    l: "",
    m: reportDate(opts.to, true),
    n: "",
    str2: "Botonplacadorada",
    str3: "2",
    str14: "",
    str15: "fechamodifica DESC",
    str16: "",
    str17: "",
    str19: "SI",
    str20: "",
    str21: "",
    str23: "",
    str24: "",
    str25: process.env.CPI_ACTIVITY_CODES || "4741.0|4759.0",
    str27: process.env.CPI_TAX_TYPES || "0|1",
    otros: "",
    familia: "",
    SocaaID: ID,
    idiomasistema: "Espanol",
  });
  for (const source of ["RT", "RS"]) body.append("str18[]", source);
  for (const column of ["tipo", "origen", "sucursal", "vendedor", "estado"]) {
    body.append("str22[]", column);
  }

  const res = await cpiRequest("ControlSpecFactUnidadesVendidas - Reportes.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(jar ? { cookie: jar } : {}),
    },
    body: body.toString(),
  });
  ensureCpiOk(res, "reporte de unidades vendidas");
  return res.body;
}

export function parseSoldProductsReport(html: string): CpiSoldProduct[] {
  const rows = reportRows(html);
  const headAt = rows.findIndex(
    (cells) =>
      headerIndex(cells, "Codigo") >= 0 &&
      headerIndex(cells, "Descripcion") >= 0 &&
      headerIndex(cells, "Unidades Total") >= 0
  );
  if (headAt < 0) {
    if (/no se encontraron datos para los filtros seleccionados/i.test(cleanText(html))) {
      return [];
    }
    throw new Error("CPI no devolvio la tabla esperada de unidades vendidas");
  }

  const headers = rows[headAt];
  const skuAt = headerIndex(headers, "Codigo");
  const descriptionAt = headerIndex(headers, "Descripcion");
  const currencyAt = headerIndex(headers, "Moneda");
  const quantityAt = headerIndex(headers, "Unidades Total");
  const salesAt = headerIndex(headers, "Valor Venta Total");
  const costAt = headerIndex(headers, "Costo Venta Total");
  const profitAt = headerIndex(headers, "Utilidad Total");
  const stockAt = headerIndex(headers, "Unid Disponibles");
  const products: CpiSoldProduct[] = [];

  for (const cells of rows.slice(headAt + 1)) {
    const sku = (cells[skuAt] ?? "").trim();
    const descripcion = (cells[descriptionAt] ?? "").trim();
    if ((!sku && !descripcion) || /SUBTOTALES?|TOTALES?/i.test(descripcion)) continue;
    const cantidad = reportNumber(cells[quantityAt] ?? "0");
    if (!Number.isFinite(cantidad) || cantidad === 0) continue;
    products.push({
      sku,
      descripcion,
      moneda: mapCurrency(cells[currencyAt] ?? "CRC"),
      cantidad,
      totalVenta: reportNumber(cells[salesAt] ?? "0"),
      costoVenta: reportNumber(cells[costAt] ?? "0"),
      utilidad: reportNumber(cells[profitAt] ?? "0"),
      stockQty: stockAt >= 0 ? reportNumber(cells[stockAt] ?? "0") : null,
    });
  }
  return products;
}

export async function cpiGetSoldProductsForDays(
  days: string[]
): Promise<CpiDailySoldProducts[]> {
  const uniqueDays = [...new Set(days.map(dateOnly))].filter((day) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day)
  );
  if (uniqueDays.length === 0) return [];
  const jar = await cpiLogin();
  return mapLimit(uniqueDays, 2, async (day) => ({
    day,
    products: parseSoldProductsReport(
      await cpiFetchSoldProductsHtml({ from: day, to: day }, jar)
    ),
  }));
}

export async function cpiFetchInventoryItemsHtml(cookie?: string): Promise<string> {
  const jar = cookie || (await cpiLogin());
  const body = new URLSearchParams({
    duser: USER,
    str1: "",
    str2: "",
    str3: "",
    str4: "",
    str5: "",
    str6: "NO",
    str99: "30000",
    ordenar: "cdescripcion_esp ASC",
    moneda: "CRC",
    otros: "",
    familia: "",
    sucursales: "",
    puntosventa: "",
    SocaaID: ID,
    idiomasistema: "Espanol",
  });
  for (const column of ["ccodigo", "cdescripcion_esp", "unidaddispo"]) {
    body.append("columnas[]", column);
  }
  const res = await cpiRequest("ControlSpecItemsProdcInventarioFactConsultaReportes.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(jar ? { cookie: jar } : {}),
    },
    body: body.toString(),
  });
  ensureCpiOk(res, "reporte de inventario");
  return res.body;
}

export function parseInventoryItemsReport(html: string): CpiInventoryItem[] {
  const rows = reportRows(html);
  const headAt = rows.findIndex(
    (cells) =>
      headerIndex(cells, "ID") >= 0 &&
      headerIndex(cells, "Codigo") >= 0 &&
      headerIndex(cells, "Descripcion") >= 0 &&
      headerIndex(cells, "Unidades") >= 0
  );
  if (headAt < 0) return [];

  const headers = rows[headAt];
  const idAt = headerIndex(headers, "ID");
  const skuAt = headerIndex(headers, "Codigo");
  const descriptionAt = headerIndex(headers, "Descripcion");
  const stockAt = headerIndex(headers, "Unidades");
  const items: CpiInventoryItem[] = [];

  for (const cells of rows.slice(headAt + 1)) {
    const cpiId = (cells[idAt] ?? "").trim();
    const sku = (cells[skuAt] ?? "").trim();
    const descripcion = (cells[descriptionAt] ?? "").trim();
    if (!/^\d+$/.test(cpiId) || (!sku && !descripcion)) continue;
    items.push({
      cpiId,
      sku,
      descripcion,
      stockQty: reportNumber(cells[stockAt] ?? "0"),
    });
  }
  return items;
}

export async function cpiGetInventoryItems(): Promise<CpiInventoryItem[]> {
  return parseInventoryItemsReport(await cpiFetchInventoryItemsHtml());
}

// --- Cotizaciones: lista, detalle y lineas de producto ---

export async function cpiFetchCotizacionesListHtml(
  opts: CpiQuoteFetchOptions = {},
  cookie?: string
): Promise<string> {
  const jar = cookie || (await cpiLogin());
  const body = new URLSearchParams({
    duser: USER,
    d: "",
    e: "",
    ee: "",
    f: "",
    ff: "",
    g: "",
    h: String(opts.limit ?? 1000),
    i: "",
    j: "",
    str3: "",
    str10: "",
    str11: "",
    str12: "",
    str13: dateOnly(opts.from),
    str14: dateOnly(opts.to),
    str21: "",
    str22: "",
    str23: "",
    str24: "",
    str25: "",
    filtrocolor: "",
    SocaaID: ID,
    idiomasistema: "Espa\u00f1ol",
  });
  const res = await cpiRequest("ControlSpecFactCotizaciones.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(jar ? { cookie: jar } : {}),
    },
    body: body.toString(),
  });
  ensureCpiOk(res, "consulta de cotizaciones");
  return res.body;
}

export function parseCotizacionesList(html: string): CpiQuote[] {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const out: CpiQuote[] = [];

  for (const row of rows) {
    if (!/numeroidctrlfacturacion/i.test(row) || !/COT-\d+/i.test(row)) continue;
    const cells = cellsOfRow(row);
    const quoteNumber =
      inputValueByName(row, "numeroclickctrlfactCotizaciones") ||
      inputValues(cells[2] ?? "").find((value) => /^COT-\d+/i.test(value)) ||
      inputValues(row).find((value) => /^COT-\d+/i.test(value)) ||
      lastInputValue(cells[2] ?? "");
    if (!quoteNumber) continue;

    const originValues = inputValues(cells[4] ?? "");
    const sucursalValues = inputValues(cells[5] ?? "");
    const clientValues = inputValues(cells[10] ?? "");
    const monedaText = lastInputValue(cells[11] ?? "");
    const estado =
      row.match(/\b(ACEPTADA|RECHAZADA|PROCESANDO|PENDIENTE|PREFACTURA)\b/i)?.[1] ??
      cleanText(cells[13] ?? "");

    out.push({
      cpiId: inputValueByName(row, "numeroidctrlfacturacion"),
      quoteNumber,
      tipo: lastInputValue(cells[0] ?? "") || "Cotizacion",
      fechaIso:
        inputValueByName(row, "fechasearchfacturacion") ||
        lastInputValue(cells[3] ?? "") ||
        null,
      origen: originValues.at(-1) ?? "",
      sucursal: sucursalValues.at(-1) ?? "",
      sucursalCode: inputValueByName(row, "sucursalsearchfacturacion") || originValues[0] || "",
      puntoVentaCode:
        inputValueByName(row, "puntoventasearchfacturacion") || sucursalValues[0] || "",
      vendedor: (inputValues(cells[6] ?? "").at(-1) ?? "").trim(),
      vendedorCod: inputValueByName(row, "codidvendedorfacturacion"),
      cliente: (clientValues.at(-1) ?? "").trim(),
      clienteId: attrValue(row, "data-clienteid") || clientValues[0] || "",
      medioPago: lastInputValue(cells[9] ?? ""),
      moneda: mapCurrency(monedaText),
      subtotal: parseCpiAmount(lastInputValue(cells[12] ?? "")),
      estado: estado.trim().toUpperCase(),
      actividad: "",
    });
  }

  return out;
}

export async function cpiFetchCotizacionDetailHtml(
  quote: Pick<CpiQuote, "cpiId" | "sucursalCode" | "puntoVentaCode">,
  cookie?: string
): Promise<string> {
  const jar = cookie || (await cpiLogin());
  const body = new URLSearchParams({
    Updated: "SI",
    eliminadefinitivo: "",
    duser: USER,
    d: "",
    e: quote.cpiId,
    str3: "",
    SocaaID: ID,
    idiomasistema: "Espa\u00f1ol",
    str12: quote.sucursalCode,
    str13: quote.puntoVentaCode,
  });
  const res = await cpiRequest("Gene New FactCotizaciones.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(jar ? { cookie: jar } : {}),
    },
    body: body.toString(),
  });
  ensureCpiOk(res, "detalle de cotizacion");
  return res.body;
}

export function parseCotizacionLines(html: string, quote: CpiQuote): CpiQuoteLine[] {
  const indexes = new Set<number>();
  const re = /name=["']lineadescripcion(\d+)facturacion["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const idx = Number(m[1]);
    if (Number.isFinite(idx)) indexes.add(idx);
  }

  const lines: CpiQuoteLine[] = [];
  for (const idx of [...indexes].sort((a, b) => a - b)) {
    const selectHtml =
      html.match(
        new RegExp(
          `<select\\b[^>]*name=["']lineaitem${idx}facturacion["'][\\s\\S]*?<\\/select>`,
          "i"
        )
      )?.[0] ?? "";
    const selected = selectedOption(selectHtml);
    const selectedWithoutStock = selected.text.replace(/\s+-\s+Saldo:.*$/i, "").trim();
    const selectedParts = selectedWithoutStock.split(/\s+-\s+/);
    const sku = selectedParts[0] ?? "";
    const fallbackDescription =
      selectedParts.length > 1 ? selectedParts.slice(1).join(" - ") : selectedWithoutStock;
    const descripcion =
      inputValueByName(html, `lineadescripcion${idx}facturacion`) ||
      fallbackDescription;

    if (!descripcion.trim() && !selected.value) continue;

    const subtotal =
      parseCpiAmount(inputValueByName(html, `lineasubtotal${idx}facturacion`)) ||
      parseCpiAmount(inputValueByName(html, `lineatotal${idx}facturacion`));

    lines.push({
      cpiId: quote.cpiId,
      quoteNumber: quote.quoteNumber,
      lineId: inputValueByName(html, `numeroidlinearelacionada${idx}facturacion`),
      lineNo: Number(inputValueByName(html, `lineano${idx}facturacion`)) || idx,
      itemId: selected.value,
      sku,
      descripcion: descripcion.trim(),
      cantidad: parseCpiAmount(inputValueByName(html, `lineacantidad${idx}facturacion`)),
      precioUnit: parseCpiAmount(inputValueByName(html, `lineavalorunitario${idx}facturacion`)),
      descuento: parseCpiAmount(inputValueByName(html, `lineadescuento${idx}facturacion`)),
      subtotal,
      impuesto: parseCpiAmount(inputValueByName(html, `lineaimpventas${idx}facturacion`)),
      total: parseCpiAmount(inputValueByName(html, `lineatotal${idx}facturacion`)) || subtotal,
      totalConImpuesto:
        parseCpiAmount(inputValueByName(html, `lineaconimpventastotal${idx}facturacion`)) ||
        subtotal,
    });
  }
  return lines;
}

async function mapLimit<T, U>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const out = new Array<U>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function cpiGetCotizacionesWithLines(
  opts: CpiQuoteFetchOptions = {}
): Promise<CpiQuoteWithLines[]> {
  const jar = await cpiLogin();
  const listHtml = await cpiFetchCotizacionesListHtml(opts, jar);
  const quotes = parseCotizacionesList(listHtml).filter((q) => q.cpiId);
  return mapLimit(quotes, 4, async (quote) => {
    const detailHtml = await cpiFetchCotizacionDetailHtml(quote, jar);
    return { ...quote, lines: parseCotizacionLines(detailHtml, quote) };
  });
}

/** Normaliza un nombre para emparejar vendedor CPI <-> usuario (sin tildes). */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
