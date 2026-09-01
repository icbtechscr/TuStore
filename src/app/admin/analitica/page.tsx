import { ChartNoAxesCombined } from "lucide-react";
import { InventoryAnalyticsDashboard } from "@/components/admin/InventoryAnalyticsDashboard";
import {
  getInventoryRotationReport,
  parseRotationPeriod,
} from "@/lib/inventory-analytics";

export const revalidate = 300;
export const metadata = { title: "Rotación de productos — TUStore Admin" };

export default async function AnaliticaPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = parseRotationPeriod(params.days);
  const report = await getInventoryRotationReport(days);

  return (
    <div>
      <div className="mb-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
          <ChartNoAxesCombined className="size-6 text-brand-600" /> Rotación de productos
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-600">
          Indicadores para tomar decisiones sobre inventario y movimiento de productos. Los datos cruzan las existencias actuales de CPI con las ventas facturadas por sucursal.
        </p>
      </div>

      {report.rows.length === 0 ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-soft">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ChartNoAxesCombined className="size-7" />
          </span>
          <h2 className="mt-4 text-lg font-black text-ink-900">Sin información para analizar</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-600">
            La rotación aparecerá cuando el inventario y las ventas de CPI estén sincronizados.
          </p>
        </div>
      ) : (
        <InventoryAnalyticsDashboard report={report} />
      )}
    </div>
  );
}

