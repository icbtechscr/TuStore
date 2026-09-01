"use client";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Mail,
  Lock,
  User,
  UserPlus,
  Trash2,
  Pencil,
  Check,
  X,
  ShieldCheck,
  Code,
  IdCard,
  Palmtree,
  MoreVertical,
  FileText,
} from "lucide-react";
import { WORK_LOCATIONS } from "@/lib/branches";
import { fullMonthsSince, fmtDate } from "@/lib/vacations";

type Role = "admin" | "colaborador" | "dev";

export type Collaborator = {
  id: string;
  email: string;
  name: string;
  role: Role;
  branchIds: string[];
  createdAt: string;
  lastSignInAt: string | null;
  // Perfil RRHH
  cedula: string;
  hireDate: string | null;
  vacationRate: number;
  entryTime: string;
  vacationAdjust: number;
  // Agregados de solicitudes (calculados en el servidor)
  vacationUsed: number;
  vacationPending: number;
};

const LOCATION_NAME: Record<string, string> = Object.fromEntries(
  WORK_LOCATIONS.map((l) => [l.id, l.remote ? "Trabajo remoto" : l.city])
);

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
  dev: "Dev",
};

/** Días acumulados a hoy (meses completos × tasa + ajuste manual). */
function accruedDays(u: Collaborator): number {
  const months = u.hireDate ? fullMonthsSince(u.hireDate) : 0;
  return Math.round((months * u.vacationRate + u.vacationAdjust) * 100) / 100;
}

function availableDays(u: Collaborator): number {
  return Math.round((accruedDays(u) - u.vacationUsed) * 100) / 100;
}

function BranchPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id]
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {WORK_LOCATIONS.map((l) => {
        const on = selected.includes(l.id);
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => toggle(l.id)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              on
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-ink-200 text-ink-600 hover:bg-ink-50"
            }`}
          >
            {l.remote ? "Trabajo remoto" : l.city}
          </button>
        );
      })}
    </div>
  );
}

function RoleBadge({ r }: { r: Role }) {
  const cls =
    r === "admin"
      ? "bg-brand-50 text-brand-600"
      : r === "dev"
        ? "bg-amber-50 text-amber-700"
        : "bg-accent-50 text-accent-700";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {ROLE_LABEL[r]}
    </span>
  );
}

type EditState = {
  name: string;
  role: Role;
  branchIds: string[];
  cedula: string;
  hireDate: string; // "" = sin fecha
  vacationRate: string;
  vacationAdjust: string;
  entryTime: string;
  password: string; // "" = no cambiar
};

type MenuState = { userId: string; x: number; y: number };

export function CollaboratorsManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: Collaborator[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<Collaborator[]>(initialUsers);
  // Alta de usuario (modal)
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("colaborador");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [cedula, setCedula] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [vacationRate, setVacationRate] = useState("1");
  const [vacationAdjust, setVacationAdjust] = useState("0");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Menú de acciones (tres puntos) de cada fila
  const [menu, setMenu] = useState<MenuState | null>(null);

  // Edición (fila expandida)
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const needsBranches = role !== "admin";

  async function reload() {
    try {
      const res = await fetch("/api/admin/collaborators", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as {
          users: Omit<Collaborator, "vacationUsed" | "vacationPending">[];
        };
        setUsers((prev) =>
          json.users.map((u) => {
            const old = prev.find((x) => x.id === u.id);
            return {
              ...u,
              vacationUsed: old?.vacationUsed ?? 0,
              vacationPending: old?.vacationPending ?? 0,
            };
          })
        );
      }
    } catch {
      /* ignore */
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (needsBranches && branchIds.length === 0) {
      setError("Asigná al menos una sede (o Trabajo remoto).");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          branchIds: role === "admin" ? [] : branchIds,
          cedula,
          hireDate: hireDate || undefined,
          vacationRate: Number(vacationRate),
          vacationAdjust: Number(vacationAdjust),
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setOk(`Usuario ${email.trim()} creado.`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("colaborador");
      setBranchIds([]);
      setCedula("");
      setHireDate("");
      setVacationRate("1");
      setVacationAdjust("0");
      setShowCreate(false);
      await reload();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(u: Collaborator) {
    setEditId(u.id);
    setEdit({
      name: u.name,
      role: u.role,
      branchIds: u.branchIds,
      cedula: u.cedula,
      hireDate: u.hireDate ?? "",
      entryTime: u.entryTime || "08:30",
      vacationRate: String(u.vacationRate),
      vacationAdjust: String(u.vacationAdjust),
      password: "",
    });
    setError(null);
    setOk(null);
  }

  async function saveEdit(u: Collaborator) {
    if (!edit) return;
    if (edit.password && edit.password.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/collaborators/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name,
          role: edit.role,
          branchIds: edit.role === "admin" ? [] : edit.branchIds,
          cedula: edit.cedula,
          hireDate: edit.hireDate || null,
          entryTime: edit.entryTime,
          vacationRate: Number(edit.vacationRate),
          vacationAdjust: Number(edit.vacationAdjust),
          ...(edit.password ? { password: edit.password } : {}),
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? {
                ...x,
                name: edit.name.trim(),
                role: edit.role,
                branchIds: edit.role === "admin" ? [] : edit.branchIds,
                cedula: edit.cedula.trim(),
                hireDate: edit.hireDate || null,
                entryTime: edit.entryTime || "08:30",
                vacationRate: Number(edit.vacationRate) || 0,
                vacationAdjust: Number(edit.vacationAdjust) || 0,
              }
            : x
        )
      );
      if (edit.password) setOk(`Contraseña de ${u.email} actualizada.`);
      setEditId(null);
      setEdit(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(u: Collaborator) {
    if (!confirm(`¿Eliminar a ${u.email}? Perderá el acceso de inmediato.`))
      return;
    setError(null);
    setOk(null);
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/collaborators/${u.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, u: Collaborator) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu(
      menu?.userId === u.id
        ? null
        : { userId: u.id, x: rect.right, y: rect.bottom }
    );
  }

  const sorted = [...users].sort((a, b) => {
    // Colaboradores primero (son el foco de RRHH), luego admins/devs.
    const rank = (r: Role) => (r === "colaborador" ? 0 : r === "dev" ? 1 : 2);
    return rank(a.role) - rank(b.role) || a.name.localeCompare(b.name);
  });

  const menuUser = menu ? users.find((u) => u.id === menu.userId) : null;

  function editorRow(u: Collaborator) {
    if (!edit) return null;
    return (
      <tr className="bg-brand-50/40">
        <td colSpan={7} className="px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Nombre
              </span>
              <input
                autoFocus
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Cédula
              </span>
              <input
                value={edit.cedula}
                onChange={(e) => setEdit({ ...edit, cedula: e.target.value })}
                placeholder="1-2345-6789"
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Rol
              </span>
              <select
                value={edit.role}
                onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
              >
                <option value="colaborador">Colaborador</option>
                <option value="admin">Administrador</option>
                <option value="dev">Dev</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Fecha de ingreso
              </span>
              <input
                type="date"
                value={edit.hireDate}
                onChange={(e) => setEdit({ ...edit, hireDate: e.target.value })}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Hora de entrada
              </span>
              <input
                type="time"
                value={edit.entryTime}
                onChange={(e) => setEdit({ ...edit, entryTime: e.target.value })}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Vacaciones: días por mes
              </span>
              <input
                type="number"
                min={0}
                step={0.25}
                value={edit.vacationRate}
                onChange={(e) =>
                  setEdit({ ...edit, vacationRate: e.target.value })
                }
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Ajuste de días (+/−)
              </span>
              <input
                type="number"
                step={0.5}
                value={edit.vacationAdjust}
                onChange={(e) =>
                  setEdit({ ...edit, vacationAdjust: e.target.value })
                }
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
              <span className="mt-1 block text-[11px] text-ink-500">
                Saldo inicial o correcciones manuales.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Nueva contraseña
              </span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={edit.password}
                  minLength={8}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  placeholder="Dejar en blanco para no cambiarla"
                  className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
                />
              </div>
            </label>
            {edit.role !== "admin" && (
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Sedes (podés elegir varias)
                </span>
                <BranchPicker
                  selected={edit.branchIds}
                  onChange={(ids) => setEdit({ ...edit, branchIds: ids })}
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => saveEdit(u)}
              disabled={busyId === u.id}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busyId === u.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setEdit(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100"
            >
              <X className="size-4" />
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  function userRow(u: Collaborator) {
    const isSelf = u.id === currentUserId;
    const Icon = u.role === "dev" ? Code : u.role === "admin" ? ShieldCheck : User;
    const accrued = accruedDays(u);
    const available = availableDays(u);
    return (
      <Fragment key={u.id}>
        <tr className="border-b border-ink-100 last:border-0">
          {/* Colaborador */}
          <td className="px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${
                  u.role === "colaborador"
                    ? "bg-accent-50 text-accent-700"
                    : u.role === "dev"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-brand-50 text-brand-600"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink-900">
                  {u.name || <span className="italic text-ink-400">Sin nombre</span>}
                  {isSelf && (
                    <span className="rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-700">
                      Vos
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-ink-500">{u.email}</p>
              </div>
            </div>
          </td>
          {/* Rol */}
          <td className="px-4 py-3">
            <RoleBadge r={u.role} />
          </td>
          {/* Cédula */}
          <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-700">
            {u.cedula || <span className="text-ink-300">—</span>}
          </td>
          {/* Sedes */}
          <td className="px-4 py-3 text-xs text-ink-600">
            {u.role === "admin" ? (
              <span className="text-ink-300">—</span>
            ) : u.branchIds.length ? (
              u.branchIds.map((id) => LOCATION_NAME[id] ?? id).join(" · ")
            ) : (
              <span className="text-ink-300">Sin sede</span>
            )}
          </td>
          {/* Ingreso */}
          <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-700">
            {fmtDate(u.hireDate)}
          </td>
          {/* Vacaciones */}
          <td className="whitespace-nowrap px-4 py-3">
            {u.hireDate || u.vacationAdjust !== 0 ? (
              <div>
                <p
                  className={`text-sm font-black ${
                    available < 0 ? "text-red-600" : "text-accent-700"
                  }`}
                >
                  {available} días
                </p>
                <p className="text-[11px] text-ink-500">
                  {accrued} acum. · {u.vacationUsed} usados
                  {u.vacationPending > 0 && (
                    <span className="font-semibold text-amber-700">
                      {" "}
                      · {u.vacationPending} en solicitud
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <span
                className="text-xs italic text-ink-400"
                title="Definí la fecha de ingreso para calcular vacaciones"
              >
                Sin fecha de ingreso
              </span>
            )}
          </td>
          {/* Acciones */}
          <td className="px-4 py-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={(e) => openMenu(e, u)}
                title="Acciones"
                className={`inline-flex size-8 items-center justify-center rounded-lg border transition ${
                  menu?.userId === u.id
                    ? "border-brand-500 bg-brand-50 text-brand-600"
                    : "border-ink-200 text-ink-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                }`}
              >
                {busyId === u.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreVertical className="size-4" />
                )}
              </button>
            </div>
          </td>
        </tr>
        {editId === u.id && editorRow(u)}
      </Fragment>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-sm text-accent-700">
          {ok}
        </div>
      )}

      {/* Barra superior */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setError(null);
            setOk(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          <UserPlus className="size-4" />
          Nuevo colaborador
        </button>
      </div>

      {/* Tabla de colaboradores */}
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Cédula</th>
                <th className="px-4 py-3">Sedes</th>
                <th className="px-4 py-3">Ingreso</th>
                <th className="px-4 py-3">Vacaciones</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length ? (
                sorted.map(userRow)
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-400">
                    Aún no hay usuarios. Agregá uno con “Nuevo colaborador”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Menú de acciones (tres puntos) */}
      {menu && menuUser && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-52 rounded-xl border border-ink-200 bg-white p-1 shadow-lift"
            style={{ top: menu.y + 4, left: Math.max(8, menu.x - 208) }}
          >
            <button
              type="button"
              onClick={() => {
                startEdit(menuUser);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-700 hover:bg-ink-100"
            >
              <Pencil className="size-4 text-ink-400" />
              Editar perfil
            </button>
            <button
              type="button"
              disabled
              title="Próximamente"
              className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-300"
            >
              <FileText className="size-4" />
              Ver contrato (PDF)
              <span className="ml-auto rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-400">
                Pronto
              </span>
            </button>
            <div className="my-1 border-t border-ink-100" />
            <button
              type="button"
              onClick={() => {
                setMenu(null);
                deleteUser(menuUser);
              }}
              disabled={menuUser.id === currentUserId}
              title={
                menuUser.id === currentUserId
                  ? "No podés eliminar tu propio usuario"
                  : undefined
              }
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="size-4" />
              Eliminar
            </button>
          </div>
        </>
      )}

      {/* Modal: nuevo colaborador */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-brand-600" />
                <h2 className="text-base font-bold text-ink-900">
                  Nuevo colaborador
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Cerrar"
                className="inline-flex size-8 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100"
              >
                <X className="size-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Nombre
                </span>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full rounded-xl border border-ink-200 bg-transparent py-2.5 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Correo
                </span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@tustorecr.com"
                    className="w-full rounded-xl border border-ink-200 bg-transparent py-2.5 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Contraseña
                </span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="mínimo 8 caracteres"
                    className="w-full rounded-xl border border-ink-200 bg-transparent py-2.5 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Cédula
                </span>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="1-2345-6789"
                    className="w-full rounded-xl border border-ink-200 bg-transparent py-2.5 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Fecha de ingreso
                </span>
                <input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Rol
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
                >
                  <option value="colaborador">Colaborador</option>
                  <option value="admin">Administrador</option>
                  <option value="dev">Dev (acceso total + marca)</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Vacaciones: días por mes
                </span>
                <div className="relative">
                  <Palmtree className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={vacationRate}
                    onChange={(e) => setVacationRate(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 bg-transparent py-2.5 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Días iniciales (ajuste)
                </span>
                <input
                  type="number"
                  step={0.5}
                  value={vacationAdjust}
                  onChange={(e) => setVacationAdjust(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
                />
              </label>
              {needsBranches && (
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                    Sedes (podés elegir varias)
                  </span>
                  <BranchPicker selected={branchIds} onChange={setBranchIds} />
                </div>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  Crear usuario
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-100"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
