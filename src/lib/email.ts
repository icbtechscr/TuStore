// Envio de correos con Resend usando su API HTTP (sin dependencias npm).
// Si falta configuracion, las funciones no hacen nada y NUNCA rompen el pedido.
const RESEND_URL = "https://api.resend.com/emails";

function cfg() {
  return {
    key: process.env.RESEND_API_KEY ?? "",
    from: process.env.ORDER_MAIL_FROM ?? "TUStore <info@tustorecr.com>",
    to: process.env.ORDER_NOTIFY_EMAIL ?? "",
  };
}

export function emailConfigured(): boolean {
  const c = cfg();
  return Boolean(c.key && c.to);
}

async function send(
  subject: string,
  html: string,
  toOverride?: string
): Promise<void> {
  if (process.env.TUSTORE_EXTERNAL_EFFECTS_ENABLED === "false") return;
  const c = cfg();
  const to = toOverride ?? c.to;
  if (!c.key || !to) return;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${c.key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: c.from,
        to: to
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[MAIL] Resend fallo:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[MAIL] Error enviando correo:", e);
  }
}

export type OrderMailInfo = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  paymentMethod: string;
  shippingMethod: string;
  items?: { name: string; qty: number; lineTotal: number }[];
};

function money(n: number): string {
  return `₡${Math.round(n).toLocaleString("es-CR")}`;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function orderHtml(o: OrderMailInfo, headline: string, color: string): string {
  const rows = (o.items ?? [])
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;color:#334">${i.qty}× ${esc(i.name)}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#111;font-weight:600">${money(i.lineTotal)}</td></tr>`
    )
    .join("");
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto">
    <div style="background:${color};color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:18px">${esc(headline)}</h2>
      <p style="margin:4px 0 0;opacity:.85;font-size:13px">Pedido ${esc(o.orderNumber)}</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:20px">
      <p style="margin:0 0 12px;font-size:22px;font-weight:800;color:#111">${money(o.total)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <hr style="border:0;border-top:1px solid #eee;margin:16px 0" />
      <p style="margin:0;font-size:14px;color:#334">
        <strong>${esc(o.customerName)}</strong><br/>
        ${esc(o.customerEmail)}<br/>
        ${esc(o.customerPhone)}
      </p>
      <p style="margin:12px 0 0;font-size:13px;color:#667">
        Pago: <strong>${esc(o.paymentMethod)}</strong> · Entrega: <strong>${esc(o.shippingMethod)}</strong>
      </p>
    </div>
  </div>`;
}

/** Aviso al admin: entro un pedido nuevo desde la tienda. */
export async function notifyNewOrder(o: OrderMailInfo): Promise<void> {
  await send(
    `Nuevo pedido ${o.orderNumber} — ${money(o.total)} (${o.paymentMethod})`,
    orderHtml(o, "Nuevo pedido — pendiente de pago", "#b45309") +
      `<p style="max-width:560px;margin:12px auto 0;font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:13px;color:#667">` +
      `El cliente eligió <strong>${esc(o.paymentMethod)}</strong>. Verificá que el dinero haya entrado antes de despachar.</p>`
  );
}

/** Aviso al admin: resultado del pago con tarjeta. */
export async function notifyPaymentResult(
  o: OrderMailInfo,
  ok: boolean,
  message?: string
): Promise<void> {
  const headline = ok ? "Pago aprobado" : "Pago rechazado";
  const color = ok ? "#047857" : "#b91c1c";
  const extra = message
    ? `<p style="margin:12px 0 0;font-size:13px;color:#667">Detalle: ${esc(message)}</p>`
    : "";
  await send(
    `${headline} — pedido ${o.orderNumber}`,
    orderHtml(o, headline, color) + extra
  );
}

/** Comprobante de compra para el CLIENTE. Solo se llama cuando el pago fue
 *  aprobado (el dinero ya se rebajo de la tarjeta). */
export async function sendCustomerReceipt(
  o: OrderMailInfo & { authCode?: string; cardBrand?: string; cardLast4?: string }
): Promise<void> {
  if (!o.customerEmail) return;

  const rows = (o.items ?? [])
    .map(
      (i) =>
        `<tr>` +
        `<td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#334">${i.qty} × ${esc(i.name)}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;color:#111;font-weight:600">${money(i.lineTotal)}</td>` +
        `</tr>`
    )
    .join("");

  const pagoCon = [o.cardBrand, o.cardLast4 ? `•••• ${o.cardLast4}` : null]
    .filter(Boolean)
    .join(" ");

  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
    <div style="background:#1b2e54;color:#fff;padding:24px;border-radius:14px 14px 0 0;text-align:center">
      <h1 style="margin:0;font-size:20px;letter-spacing:.3px">TUStore</h1>
      <p style="margin:6px 0 0;font-size:14px;opacity:.85">Comprobante de compra</p>
    </div>

    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px;padding:24px;background:#fff">
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px 16px;margin-bottom:20px">
        <p style="margin:0;font-size:14px;color:#047857"><strong>¡Pago confirmado!</strong> Gracias por su compra, ${esc(o.customerName)}.</p>
      </div>

      <table style="width:100%;font-size:13px;color:#667;margin-bottom:18px">
        <tr><td>Pedido</td><td style="text-align:right;color:#111;font-weight:700">${esc(o.orderNumber)}</td></tr>
        <tr><td>Fecha</td><td style="text-align:right;color:#111">${new Date().toLocaleDateString("es-CR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Costa_Rica" })}</td></tr>
        ${pagoCon ? `<tr><td>Pago</td><td style="text-align:right;color:#111">${esc(pagoCon)}</td></tr>` : ""}
        ${o.authCode ? `<tr><td>Autorización</td><td style="text-align:right;color:#111;font-family:monospace">${esc(o.authCode)}</td></tr>` : ""}
      </table>

      <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.6px;color:#889">Detalle</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
        <tr><td style="padding:12px 0 0;font-weight:700">Total pagado</td>
            <td style="padding:12px 0 0;text-align:right;font-size:19px;font-weight:800">${money(o.total)}</td></tr>
      </table>

      <h2 style="margin:22px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.6px;color:#889">Entrega</h2>
      <p style="margin:0;font-size:14px;color:#334">${esc(o.shippingMethod)}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#667">Le contactaremos al ${esc(o.customerPhone)} para coordinar la entrega.</p>

      <hr style="border:0;border-top:1px solid #eee;margin:22px 0" />
      <p style="margin:0;font-size:12px;color:#889;text-align:center">
        ¿Consultas? Escríbanos a info@tustorecr.com o al +506 4001 6421.<br/>
        Este comprobante no sustituye la factura electrónica.
      </p>
    </div>
  </div>`;

  await send(
    `Confirmación de su compra — pedido ${o.orderNumber}`,
    html,
    o.customerEmail
  );
}

