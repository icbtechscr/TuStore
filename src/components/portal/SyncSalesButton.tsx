"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

// Boton de sincronizacion manual de ventas CPI (solo admin/dev).
export function SyncSalesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  async function sync() {
    setBusy(true);
    setMsg(null);
    setErr(false);
    try {
      const res = await fetch("/api/admin/sales/sync", { method: "POST" });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Error");
      let info = "Listo";
      try {
        const j = JSON.parse(text) as {
          sales?: { upserted: number };
          products?: { products: number };
          upserted?: number;
        };
        const invoices = j.sales?.upserted ?? j.upserted ?? 0;
        const products = j.products?.products ?? 0;
        info = `${invoices} facturas \u00b7 ${products} productos`;
      } catch {
        /* respuesta no JSON */
      }
      setMsg(info);
      router.refresh();
    } catch (e) {
      setErr(true);
      setMsg(e instanceof Error ? e.message : "No se pudo sincronizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
      >
        <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Sincronizando…" : "Sincronizar"}
      </button>
      {msg && (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
            err ? "text-red-600" : "text-accent-700"
          }`}
        >
          {err ? <AlertCircle className="size-3" /> : <Check className="size-3" />}
          {msg}
        </span>
      )}
    </div>
  );
}
