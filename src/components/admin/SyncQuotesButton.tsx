"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, RefreshCw } from "lucide-react";

export function SyncQuotesButton({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  async function sync() {
    setBusy(true);
    setMsg(null);
    setErr(false);
    try {
      const res = await fetch("/api/admin/cpi-quotes/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, limit: 1000 }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Error");
      let info = "Listo";
      try {
        const json = JSON.parse(text) as { upserted: number; lines: number };
        info = `${json.upserted} cotizaciones, ${json.lines} lineas`;
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
        {busy ? "Sincronizando..." : "Sincronizar CPI"}
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
