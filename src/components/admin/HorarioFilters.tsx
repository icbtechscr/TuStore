"use client";
import { useRouter } from "next/navigation";

type BranchOpt = { id: string; city: string };
type EmployeeOpt = { id: string; name: string };

export function HorarioFilters({
  basePath,
  from,
  to,
  branchId,
  userId,
  branches,
  employees,
  showDates = true,
}: {
  basePath: string;
  from: string;
  to: string;
  branchId: string;
  userId: string;
  branches: BranchOpt[];
  employees: EmployeeOpt[];
  showDates?: boolean;
}) {
  const router = useRouter();

  function update(
    next: Partial<{ from: string; to: string; branch: string; user: string }>
  ) {
    const params = new URLSearchParams();
    const f = next.from ?? from;
    const t = next.to ?? to;
    const b = next.branch ?? branchId;
    const u = next.user ?? userId;
    if (showDates && f) params.set("from", f);
    if (showDates && t) params.set("to", t);
    if (b) params.set("branch", b);
    if (u) params.set("user", u);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {showDates && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Desde
            </span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => update({ from: e.target.value })}
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Hasta
            </span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => update({ to: e.target.value })}
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
        </>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
          Sede
        </span>
        <select
          value={branchId}
          onChange={(e) => update({ branch: e.target.value })}
          className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
        >
          <option value="">Todas las sedes</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.city}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
          Colaborador
        </span>
        <select
          value={userId}
          onChange={(e) => update({ user: e.target.value })}
          className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
        >
          <option value="">Todos</option>
          {employees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
