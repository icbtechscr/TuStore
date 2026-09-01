// Lógica del asistente virtual con IA.
// Adaptado del chatbot de WhatsApp de Centralia al contexto de la tienda ICB.
//
// Soporta dos proveedores a través de su endpoint compatible con OpenAI:
//   1) Groq (primario)  2) Gemini Flash (respaldo automático).
// Si el primario falla por límite de tasa (429) o error transitorio, el bot
// cambia solo al siguiente proveedor configurado, sin que el cliente vea error.
import { TUSTORE_KNOWLEDGE } from "./chatbot-knowledge";
import { SITE_NAME } from "./site";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

// ---- Tipos mínimos al estilo OpenAI (compartidos por ambos proveedores) ----
type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
type ToolHandlers = Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
>;

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
type ApiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};
type CompletionBody = {
  messages: ApiMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDef[];
  tool_choice?: "auto" | "none";
};
type CompletionResponse = {
  choices?: { message?: ApiMessage }[];
  usage?: { total_tokens?: number };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Proveedores configurados, en orden de preferencia ----
type Provider = { label: string; url: string; apiKey: string; model: string };

function providers(): Provider[] {
  const out: Provider[] = [];
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    out.push({
      label: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    });
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    out.push({
      label: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });
  }
  return out;
}

class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function callProvider(
  provider: Provider,
  body: CompletionBody
): Promise<CompletionResponse> {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({ model: provider.model, ...body }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(
      `${provider.label} ${res.status}: ${detail.slice(0, 300)}`,
      res.status
    );
  }
  return (await res.json()) as CompletionResponse;
}

// Recorre los proveedores en orden. Cada uno reintenta una vez ante errores
// transitorios; si aun así falla, pasa al siguiente proveedor.
async function createCompletion(body: CompletionBody): Promise<CompletionResponse> {
  const provs = providers();
  if (!provs.length) {
    throw new Error(
      "No hay proveedor de IA configurado (define GROQ_API_KEY y/o GEMINI_API_KEY)."
    );
  }
  let lastErr: unknown;
  for (const p of provs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callProvider(p, body);
      } catch (e) {
        lastErr = e;
        const status = e instanceof ApiError ? e.status : undefined;
        const transient =
          status === 429 ||
          status === 408 ||
          status === undefined ||
          (typeof status === "number" && status >= 500);
        if (attempt === 0 && transient) {
          await sleep(700);
          continue;
        }
        break; // error no recuperable con este proveedor → probar el siguiente
      }
    }
    console.warn(
      `[ai] proveedor "${p.label}" falló, intentando respaldo…`,
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    );
  }
  throw lastErr;
}

function buildSystemPrompt(): string {
  return `Eres el asistente virtual de atención al cliente de "${SITE_NAME}" y respondes en el chat de la tienda en línea.
Tu trabajo es contestar preguntas de clientes de forma amable, clara y breve, como lo haría un asesor competente que conoce bien el negocio.

Usa ÚNICAMENTE la información del negocio que aparece abajo y los resultados de la herramienta de búsqueda de productos. No inventes precios, productos, ni datos que no tengas.

== Cómo buscar productos (MUY IMPORTANTE) ==
Si te preguntan por un producto, marca, precio o disponibilidad, usa la herramienta "buscar_productos" ANTES de responder.
La búsqueda ya ignora mayúsculas y tildes, pero igual debes ser flexible:
- Si la primera búsqueda no devuelve nada, NO digas que no existe. Intenta de nuevo con variantes: singular/plural ("cámara"/"cámaras"), sinónimos y términos relacionados, y con palabras más cortas o más generales (por ejemplo "ip", "cámara", "vigilancia", "CCTV" si preguntan por cámaras IP).
- Prueba quitando palabras poco específicas y dejando solo lo esencial (marca o tipo de producto).
- Interpreta el lenguaje coloquial y mapéalo al catálogo: "para la casa"/"para el hogar" → productos de hogar, kits de vigilancia, cámaras; "para trabajar"/"oficina" → computadoras/PC; "para vigilar"/"seguridad" → cámaras, DVR/NVR, kits de vigilancia; "internet"/"wifi"/"red" → routers, switches, access points.

== Cómo hablan los clientes en Costa Rica (MUY IMPORTANTE) ==
Los clientes escriben de forma informal y "tica". TU TRABAJO es ENTENDER lo que quieren decir y TRADUCIRLO a los términos técnicos con que están guardados los productos ANTES de buscar. Nunca busques la frase coloquial literal; extrae el producto real y búscalo con su nombre técnico. Algunas equivalencias:
- "cámara(s) para el carro / pa'l carro / del carro / para el vehículo / para manejar" → busca "dashcam" o "cámara vehicular".
- "la compu / la máquina / computadora / pc de escritorio / torre" → "computadora" / "PC". "la laptop / portátil / la lap" → "laptop".
- "para jugar / para gaming / una máquina buena para juegos" → "gamer" / "gaming".
- "el guachimán / para cuidar / para vigilar / ojo eléctrico" → "cámara de seguridad" / "CCTV" / "kit de vigilancia".
- "el wifi / el internet / el módem / el router" → "router" / "access point". "para el cable de red / ponchar cable" → "cable de red" / "UTP".
- "el disco / dónde guardar / memoria para guardar" → "disco duro" / "SSD" / "almacenamiento". "una memoria / un USB / una llave maya" → "memoria USB" / "microSD".
- "la impre / para imprimir" → "impresora". "la tinta / los cartuchos" → "tinta" / "tóner".
- "la caja registradora / para cobrar / punto de venta / el datáfono" → "POS" / "punto de venta" / "lector".
- "audífonos / cascos / parlante / bocina" → "audífonos" / "parlante". "el mouse / el teclado / la pantalla / el monitor" → tal cual.
- "una batería pa' cuando se va la luz / UPS / regulador" → "UPS" / "batería de respaldo".
- Trata "mil"/"k" como miles de colones ("50 mil" = 50000, "100k" = 100000) y úsalo en precio_max.
Si dudas entre dos interpretaciones, busca la más probable; si no encuentras, prueba la otra antes de rendirte. Y si de plano no captás qué quiere, preguntale con amabilidad y en confianza qué anda buscando.
- Solo después de probar 2 o 3 variantes razonables y no encontrar nada, dile al cliente con honestidad que no lo ves en el catálogo en línea y ofrécele contactar a una sucursal o que un asesor le ayude.
- Presupuesto: si el cliente menciona un límite de precio ("menos de 20 mil", "hasta ₡50.000"), pásalo en el parámetro precio_max de la herramienta. Los resultados vienen ordenados de más barato a más caro, así que revisa SIEMPRE los precios devueltos antes de afirmar que algo está fuera de presupuesto. Nunca digas que no hay nada bajo cierto precio si en los resultados hay productos que sí cumplen.

== Estilo ==
Responde siempre en español de Costa Rica, con un tono cercano, servicial y profesional, como un buen vendedor que quiere ayudar (no como un buscador rígido).
Mantén las respuestas cortas (2-4 frases) salvo que pidan más detalle. Cuando muestres productos, menciona nombre y precio en colones, y si viene al caso sugiere alternativas o pregunta para afinar la recomendación.
Si te preguntan algo que no está en esta información y no puedes consultarlo, dilo con honestidad y ofrece contactar a una persona o visitar una sucursal.

================ INFORMACIÓN DEL NEGOCIO ================
${TUSTORE_KNOWLEDGE}
========================================================`;
}

/**
 * Genera la respuesta de la IA para el historial de conversación dado.
 * @param history mensajes [{role, content}] (incluye el último del usuario).
 * @param opts.tools / opts.handlers para function-calling (búsqueda de productos).
 */
export async function generarRespuesta(
  history: ChatMessage[],
  opts: {
    tools?: ToolDef[] | null;
    handlers?: ToolHandlers | null;
    systemContext?: string | null;
  } = {}
): Promise<{ text: string; tokens: number }> {
  const { tools = null, handlers = null, systemContext = null } = opts;

  const messages: ApiMessage[] = [
    {
      role: "system",
      content: systemContext
        ? `${buildSystemPrompt()}\n\n== Instrucciones adicionales del canal ==\n${systemContext}`
        : buildSystemPrompt(),
    },
    ...history.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  const fallback = "Disculpa, no pude procesar tu mensaje. ¿Puedes repetirlo?";

  // ---- Con herramientas: bucle de function-calling ----
  if (tools && tools.length && handlers) {
    let totalTokens = 0;
    for (let step = 0; step < 5; step++) {
      const completion = await createCompletion({
        messages,
        temperature: 0.4,
        max_tokens: 600,
        tools,
        tool_choice: "auto",
      });
      totalTokens += completion.usage?.total_tokens || 0;
      const msg = completion.choices?.[0]?.message;
      if (!msg) break;
      messages.push(msg);

      const calls = msg.tool_calls || [];
      if (!calls.length) {
        return { text: (msg.content || "").trim() || fallback, tokens: totalTokens };
      }
      for (const tc of calls) {
        let result: unknown;
        try {
          const args = JSON.parse(tc.function?.arguments || "{}");
          const fn = handlers[tc.function?.name];
          result = fn ? await fn(args) : { error: "herramienta desconocida" };
        } catch (e) {
          result = { error: e instanceof Error ? e.message : String(e) };
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }
    return { text: fallback, tokens: totalTokens };
  }

  // ---- Sin herramientas: Q&A simple ----
  const completion = await createCompletion({
    messages,
    temperature: 0.4,
    max_tokens: 500,
  });
  const text = completion.choices?.[0]?.message?.content?.trim() || fallback;
  return { text, tokens: completion.usage?.total_tokens || 0 };
}
