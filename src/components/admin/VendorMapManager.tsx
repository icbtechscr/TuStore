"use client";
import { useEffect, useState } from "react";
import { Loader2, Check, UserCheck, UserX, EyeOff, Eye } from "lucide-react";
import { formatCRCAmount, formatUSD } from "@/lib/utils";

type Vendor = { cpi_vendor: string; user_id: string | null; ignored: boolean; count: number; crc: number; usd: number };
type User = { id: string; name: string; email: string };

export function VendorMapManager() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/cpi-vendors");
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { vendors: Vendor[]; users: User[] };
        if (!on) return;
        setVendors(data.vendors);
        setUsers(data.users);
      } catch (e) {
        if (on) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, []);

  async function assign(cpi_vendor: string, user_id: string) {
    setSavingKey(cpi_vendor);
    setSavedKey(null);
    setVendors((vs) => vs.map((v) => (v.cpi_vendor === cpi_vendor ? { ...v, user_id: user_id || null } : v)));
    try {
      const res = await fetch("/api/admin/cpi-vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cpi_vendor, user_id: user_id || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedKey(cpi_vendor);
      setTimeout(() => setSavedKey((k) => (k === cpi_vendor ? null : k)), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleIgnored(cpi_vendor: string, ignored: boolean) {
    setSavingKey(cpi_vendor);
    setVendors((vs) => vs.map((v) => (v.cpi_vendor === cpi_vendor ? { ...v, ignored } : v)));
    try {
      const res = await fetch("/api/admin/cpi-vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cpi_vendor, ignored }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-ink-200 bg-white p-6 text-sm text-ink-500 shadow-soft">
        <Loader2 className="size-4 animate-spin" /> Cargando vendedores…
      </div>
    );
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  const asignados = vendors.filter((v) => v.user_id).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3.5">
        <p className="text-sm font-bold text-ink-900">
          {vendors.length} vendedores · {asignados} asignados
        </p>
        <p className="text-xs text-ink-500">Asigná cada vendedor de CPI a su usuario del portal.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
              <th className="px-5 py-2.5 font-bold">Vendedor en CPI</th>
              <th className="px-3 py-2.5 text-right font-bold">Facturas</th>
              <th className="px-3 py-2.5 text-right font-bold">Monto CRC</th>
              <th className="px-3 py-2.5 text-right font-bold">Monto USD</th>
              <th className="px-5 py-2.5 font-bold">Usuario del portal</th>
              <th className="px-3 py-2.5 text-center font-bold">Ranking</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.cpi_vendor} className={`border-b border-ink-50 last:border-0 ${v.ignored ? "opacity-50" : ""}`}>
                <td className="px-5 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    {v.user_id ? (
                      <UserCheck className="size-4 text-accent-600" />
                    ) : (
                      <UserX className="size-4 text-ink-300" />
                    )}
                    <span className="font-semibold text-ink-800">{v.cpi_vendor}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-ink-700">{v.count}</td>
                <td className="px-3 py-2.5 text-right font-bold text-ink-900">{formatCRCAmount(v.crc)}</td>
                <td className="px-3 py-2.5 text-right font-bold text-ink-900">{formatUSD(v.usd)}</td>
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={v.user_id ?? ""}
                      onChange={(e) => assign(v.cpi_vendor, e.target.value)}
                      className="min-w-48 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-800"
                    >
                      <option value="">— Sin asignar —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                    {savingKey === v.cpi_vendor && <Loader2 className="size-4 animate-spin text-ink-400" />}
                    {savedKey === v.cpi_vendor && <Check className="size-4 text-accent-600" />}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => toggleIgnored(v.cpi_vendor, !v.ignored)}
                    title={v.ignored ? "Incluir en el ranking" : "Excluir del ranking"}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      v.ignored
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-ink-100 text-ink-500 hover:bg-ink-200"
                    }`}
                  >
                    {v.ignored ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {v.ignored ? "Excluido" : "Excluir"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
