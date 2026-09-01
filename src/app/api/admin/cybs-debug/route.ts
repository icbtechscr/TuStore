import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, isAdminLike } from "@/lib/roles";
import {
  currentEnv,
  isPaidSummary,
  rawTransactionSearch,
  summariesOf,
} from "@/lib/cybersource";

export const dynamic = "force-dynamic";

// Diagnostico de la busqueda de transacciones en Cybersource.
// Prueba varias formas de la consulta y dice cual encuentra el pedido, para
// saber si el problema es la sintaxis, la ventana de fechas o la cuenta.
//
//   GET /api/admin/cybs-debug?order=ICB-MSE1EB65-XLE

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const order = new URL(req.url).searchParams.get("order")?.trim() ?? "";

  const variantes: { nombre: string; query: string }[] = [
    // Ultimos 7 dias, SIN filtrar por pedido: dice si la cuenta devuelve algo.
    { nombre: "cualquier transaccion (7 dias)", query: "submitTimeUtc:[NOW-7DAYS TO NOW]" },
    { nombre: "cualquier transaccion (90 dias)", query: "submitTimeUtc:[NOW-90DAYS TO NOW]" },
  ];

  if (order) {
    variantes.push(
      { nombre: "code entre comillas", query: `clientReferenceInformation.code:"${order}"` },
      { nombre: "code sin comillas", query: `clientReferenceInformation.code:${order}` },
      {
        nombre: "code + ventana 90 dias",
        query: `clientReferenceInformation.code:"${order}" AND submitTimeUtc:[NOW-90DAYS TO NOW]`,
      },
      { nombre: "texto libre", query: `"${order}"` }
    );
  }

  const resultados: Record<string, unknown>[] = [];
  for (const v of variantes) {
    try {
      const { httpStatus, data, raw } = await rawTransactionSearch(v.query, 5);
      const list = summariesOf(data);
      resultados.push({
        variante: v.nombre,
        query: v.query,
        httpStatus,
        encontrados: list.length,
        // Resumen de lo hallado, sin datos sensibles de tarjeta.
        muestra: list.slice(0, 3).map((t) => {
          const app = (t.applicationInformation ?? {}) as Record<string, unknown>;
          const cri = (t.clientReferenceInformation ?? {}) as Record<string, unknown>;
          const oi = (t.orderInformation ?? {}) as Record<string, unknown>;
          const ad = (oi.amountDetails ?? {}) as Record<string, unknown>;
          return {
            id: t.id,
            code: cri.code,
            status: app.status,
            reasonCode: app.reasonCode,
            monto: ad.totalAmount,
            moneda: ad.currency,
            fecha: t.submitTimeUtc,
            cobrada: isPaidSummary(t),
            // Clave para saber si la plata se movio de verdad:
            //   ics_auth  -> solo se AUTORIZO (bloqueada en la tarjeta)
            //   ics_bill  -> se CAPTURO (va camino a la cuenta del comercio)
            // Si solo aparece ics_auth, el cargo se libera solo a los ~7 dias.
            aplicaciones: Array.isArray(app.applications)
              ? (app.applications as Record<string, unknown>[]).map((a) => ({
                  nombre: a.name,
                  reasonCode: a.reasonCode,
                  rFlag: a.rFlag,
                  status: a.status,
                }))
              : "(la busqueda no devolvio el detalle de aplicaciones)",
          };
        }),
        // Si no hubo resultados, el cuerpo crudo ayuda a ver el motivo.
        ...(list.length === 0 ? { respuesta: raw.slice(0, 500) } : {}),
      });
    } catch (e) {
      resultados.push({
        variante: v.nombre,
        query: v.query,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    entorno: currentEnv(),
    pedidoConsultado: order || "(ninguno)",
    resultados,
  });
}
