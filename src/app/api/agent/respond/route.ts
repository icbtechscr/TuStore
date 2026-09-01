import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { generarRespuesta, type ChatMessage } from "@/lib/ai";
import { readAgentState, mutateAgentState } from "@/lib/agent-store";
import { searchProductsLoose } from "@/lib/products";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { AgentAction, AgentActionType } from "@/lib/agent-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type InputMessage = {
  platformMessageId?: string;
  remoteJid?: string;
  phone?: string;
  pushName?: string;
  text?: string;
  history?: { role?: string; content?: string }[];
};

function authorized(req: Request): boolean {
  const expected = process.env.AGENT_WORKER_SECRET || "";
  const received = req.headers.get("x-agent-secret") || "";
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function toNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function short(value: unknown, length = 500): string {
  return String(value ?? "").trim().slice(0, length);
}

async function createAction(
  type: AgentActionType,
  phone: string,
  args: Record<string, unknown>
): Promise<{ ok: true; reference: string; status: "pending" } | { error: string }> {
  const customerName = short(args.cliente_nombre, 160);
  const products = Array.isArray(args.productos) ? args.productos : [];
  if (type !== "handoff" && (!customerName || products.length === 0)) {
    return {
      error:
        "Faltan el nombre del cliente o los productos. Pregunta esos datos antes de crear la solicitud.",
    };
  }
  const now = new Date().toISOString();
  const id = `${type}-${crypto.randomUUID()}`;
  const summary =
    type === "handoff"
      ? short(args.motivo || "Cliente solicita un asesor", 300)
      : `${customerName}: ${products.length} producto(s)`;
  const action: AgentAction = {
    id,
    type,
    status: "pending",
    phone,
    customerName: customerName || short(args.cliente || "Cliente", 160),
    summary,
    payload: { ...args, productos: products },
    createdAt: now,
    updatedAt: now,
    result: null,
  };
  await mutateAgentState((state) => {
    state.actions.unshift(action);
    state.metrics.actionsCreated += 1;
    state.activity.unshift({
      id: `action:${id}`,
      at: now,
      direction: "system",
      phone,
      name: action.customerName,
      preview: `${type === "quote" ? "Cotizaci\u00f3n" : type === "invoice" ? "Factura" : "Asesor"}: ${summary}`,
      kind: "action",
    });
  });
  return { ok: true, reference: id, status: "pending" };
}

const tools = [
  {
    type: "function" as const,
    function: {
      name: "buscar_productos",
      description:
        "Busca productos, precios y disponibilidad en el catálogo real de TUStore por nombre, marca o SKU.",
      parameters: {
        type: "object",
        properties: {
          consulta: { type: "string" },
          precio_max: { type: "number" },
          precio_min: { type: "number" },
          solo_disponibles: { type: "boolean" },
        },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "preparar_cotizacion",
      description:
        "Crea una solicitud de cotizacion pendiente de aprobacion humana. Usala solo cuando el cliente ya confirmo productos y cantidades.",
      parameters: {
        type: "object",
        properties: {
          cliente_nombre: { type: "string" },
          identificacion: { type: "string" },
          email: { type: "string" },
          telefono: { type: "string" },
          productos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                nombre: { type: "string" },
                cantidad: { type: "number" },
              },
              required: ["nombre", "cantidad"],
            },
          },
          notas: { type: "string" },
        },
        required: ["cliente_nombre", "productos"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "preparar_factura",
      description:
        "Crea una solicitud de factura pendiente de aprobacion humana. Requiere datos fiscales y productos confirmados.",
      parameters: {
        type: "object",
        properties: {
          cliente_nombre: { type: "string" },
          identificacion: { type: "string" },
          email: { type: "string" },
          telefono: { type: "string" },
          productos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                nombre: { type: "string" },
                cantidad: { type: "number" },
              },
              required: ["nombre", "cantidad"],
            },
          },
          notas: { type: "string" },
        },
        required: ["cliente_nombre", "identificacion", "email", "productos"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "solicitar_asesor",
      description: "Pasa la conversacion a una persona cuando el cliente lo pide o el caso requiere revision.",
      parameters: {
        type: "object",
        properties: {
          cliente: { type: "string" },
          motivo: { type: "string" },
        },
        required: ["motivo"],
      },
    },
  },
];

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("No autorizado", { status: 401 });
  const state = await readAgentState();
  return NextResponse.json({
    ok: true,
    connectionEnabled: state.settings.connectionEnabled,
    autoReplyEnabled: state.settings.autoReplyEnabled,
    testMode: state.settings.testMode,
    runtimeStatus: state.runtime.status,
  });
}

export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse("No autorizado", { status: 401 });
  try {
    const body = (await req.json()) as InputMessage;
    const messageId = short(body.platformMessageId, 180);
    const remoteJid = short(body.remoteJid, 200);
    const phone = digits(short(body.phone || remoteJid.split("@")[0], 40));
    const name = short(body.pushName || "Cliente", 160);
    const text = short(body.text, 3000);
    if (!messageId || !phone || !text) {
      return NextResponse.json({ error: "Mensaje incompleto" }, { status: 400 });
    }

    const current = await readAgentState();
    if (current.activity.some((item) => item.id === `in:${messageId}`)) {
      return NextResponse.json({ duplicate: true, reply: null });
    }
    const now = new Date().toISOString();
    await mutateAgentState((state) => {
      state.activity.unshift({
        id: `in:${messageId}`,
        at: now,
        direction: "in",
        phone,
        name,
        preview: text,
        kind: "message",
      });
      state.metrics.received += 1;
      state.metrics.lastMessageAt = now;
    });

    const settings = (await readAgentState()).settings;
    if (!settings.autoReplyEnabled) {
      return NextResponse.json({ reply: null, skipped: "auto_reply_disabled" });
    }
    const allowed = settings.testNumbers.map(digits).filter(Boolean);
    if (settings.testMode && (allowed.length === 0 || !allowed.includes(phone))) {
      return NextResponse.json({ reply: null, skipped: "test_number_not_allowed" });
    }

    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const history: ChatMessage[] = rawHistory
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim()
      )
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: short(message.content, 2500),
      }))
      .slice(-10);
    if (history.at(-1)?.role !== "user" || history.at(-1)?.content !== text) {
      history.push({ role: "user", content: text });
    }

    const handlers = {
      buscar_productos: async (args: Record<string, unknown>) => {
        const query = short(args.consulta, 200);
        if (!query) return { productos: [] };
        const products = await searchProductsLoose(query, {
          limit: 8,
          maxPrice: toNumber(args.precio_max),
          minPrice: toNumber(args.precio_min),
          inStockOnly: args.solo_disponibles === true,
        });
        return {
          total: products.length,
          productos: products.map((product) => ({
            sku: product.sku,
            nombre: product.name,
            precioCRC: product.salePriceCRC ?? product.priceCRC,
            precioListaCRC: product.priceCRC,
            enOferta: product.onSale,
            disponible: product.inStock,
            existencias: product.stockQty,
            marca: product.brand,
            enlace: `${SITE_URL}/productos/${product.slug}`,
          })),
        };
      },
      preparar_cotizacion: (args: Record<string, unknown>) => createAction("quote", phone, args),
      preparar_factura: (args: Record<string, unknown>) => createAction("invoice", phone, args),
      solicitar_asesor: (args: Record<string, unknown>) => createAction("handoff", phone, args),
    };

    const systemContext = `Estas atendiendo WhatsApp como vendedor virtual de ${SITE_NAME}.
Responde mensajes breves y naturales. Puedes consultar precios y existencias reales con buscar_productos.
Nunca inventes disponibilidad, descuentos, garantias ni condiciones. No solicites numeros de tarjeta ni datos bancarios.
Si el cliente confirma productos y cantidades, puedes usar preparar_cotizacion. La cotizacion queda pendiente de aprobacion humana; dilo claramente y comparte la referencia.
Para una factura debes recopilar nombre o razon social, identificacion, correo, productos y cantidades. Usa preparar_factura, pero explica que queda pendiente de revision antes de emitirse en CPI.
No afirmes que una cotizacion o factura fue emitida si la herramienta solo indica pending.
Cuando haya una queja, una negociacion especial o el cliente pida una persona, usa solicitar_asesor.`;

    const response = await generarRespuesta(history, {
      tools,
      handlers,
      systemContext,
    });
    const reply = short(response.text, 3500);
    await mutateAgentState((state) => {
      state.activity.unshift({
        id: `out:${messageId}`,
        at: new Date().toISOString(),
        direction: "out",
        phone,
        name: settings.agentName,
        preview: reply,
        kind: "message",
      });
      state.metrics.sent += 1;
      state.metrics.lastMessageAt = new Date().toISOString();
    });
    return NextResponse.json({ reply, tokens: response.tokens });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[/api/agent/respond]", message);
    return NextResponse.json(
      { error: "No se pudo procesar el mensaje del agente." },
      { status: 500 }
    );
  }
}
