"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  FolderTree,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  CornerDownRight,
} from "lucide-react";

export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  productCount: number;
};

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: AdminCategoryRow[];
}) {
  const router = useRouter();
  const [cats, setCats] = useState<AdminCategoryRow[]>(initialCategories);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");

  const parents = useMemo(
    () =>
      cats
        .filter((c) => !c.parentId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [cats]
  );
  const childrenOf = (id: string | null) =>
    cats
      .filter((c) => c.parentId === id)
      .sort((a, b) => a.name.localeCompare(b.name));

  // Opciones de "padre" para CREAR: cualquier categoría, a cualquier nivel
  // (anidado ilimitado). Indentadas según su profundidad.
  const parentOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    const walk = (pid: string | null, depth: number) => {
      cats
        .filter((c) => c.parentId === pid)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((c) => {
          out.push({ id: c.id, label: `${"— ".repeat(depth)}${c.name}` });
          walk(c.id, depth + 1);
        });
    };
    walk(null, 0);
    return out;
  }, [cats]);

  // Opciones de "padre" para EDITAR/MOVER: excluye la categoría y su
  // descendencia (no puede colgar de sí misma → evita ciclos).
  function parentOptionsForEdit(excludeId: string) {
    const banned = new Set<string>([excludeId]);
    const collect = (id: string) => {
      for (const c of cats.filter((x) => x.parentId === id)) {
        banned.add(c.id);
        collect(c.id);
      }
    };
    collect(excludeId);
    const out: { id: string; label: string }[] = [];
    const walk = (pid: string | null, depth: number) => {
      cats
        .filter((c) => c.parentId === pid && !banned.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((c) => {
          out.push({ id: c.id, label: `${"— ".repeat(depth)}${c.name}` });
          walk(c.id, depth + 1);
        });
    };
    walk(null, 0);
    return out;
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: parentId || null }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const json = (await res.json()) as {
        category: { id: string; name: string; slug: string; parent_id: string | null };
      };
      setCats((prev) => [
        ...prev,
        {
          id: json.category.id,
          name: json.category.name,
          slug: json.category.slug,
          parentId: json.category.parent_id,
          productCount: 0,
        },
      ]);
      setOk(
        parentId
          ? `Subcategoría "${json.category.name}" creada.`
          : `Categoría "${json.category.name}" creada.`
      );
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(c: AdminCategoryRow) {
    setEditId(c.id);
    setEditName(c.name);
    setEditParentId(c.parentId ?? "");
    setError(null);
    setOk(null);
  }

  async function saveEdit(c: AdminCategoryRow) {
    if (!editName.trim()) return;
    setBusyId(c.id);
    setError(null);
    try {
      const newParent = editParentId || null;
      const res = await fetch(`/api/admin/categories/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, parentId: newParent }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setCats((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? { ...x, name: editName.trim(), parentId: newParent }
            : x
        )
      );
      setEditId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCategory(c: AdminCategoryRow) {
    const kids = childrenOf(c.id);
    const warn: string[] = [];
    if (kids.length)
      warn.push(`${kids.length} subcategoría(s) pasarán a ser principales`);
    if (c.productCount)
      warn.push(`${c.productCount} producto(s) quedarán sin esta categoría`);
    const extra = warn.length ? `\n\n${warn.join(".\n")}.` : "";
    if (
      !confirm(
        `¿Eliminar "${c.name}"?${extra}\n\nLos productos NO se borran.`
      )
    )
      return;
    setError(null);
    setOk(null);
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/admin/categories/${c.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setCats((prev) =>
        prev
          // sacar la categoría borrada
          .filter((x) => x.id !== c.id)
          // sus hijos quedan como principales
          .map((x) => (x.parentId === c.id ? { ...x, parentId: null } : x))
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  function Row({
    c,
    depth = 0,
  }: {
    c: AdminCategoryRow;
    depth?: number;
  }) {
    const editing = editId === c.id;
    const child = depth > 0;
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-ink-50"
        style={{ marginLeft: depth * 22 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {child ? (
            <CornerDownRight className="size-4 shrink-0 text-ink-300" />
          ) : (
            <FolderTree className="size-4 shrink-0 text-brand-600" />
          )}
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-44 rounded-lg border border-ink-200 bg-transparent px-2 py-1 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
              <select
                value={editParentId}
                onChange={(e) => setEditParentId(e.target.value)}
                title="Mover a otro padre"
                className="max-w-[12rem] rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm text-ink-900 outline-none focus:border-brand-500 [&>option]:text-ink-900"
              >
                <option value="">— Principal —</option>
                {parentOptionsForEdit(c.id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span
              className={`truncate text-sm ${
                child ? "text-ink-700" : "font-semibold text-ink-900"
              }`}
            >
              {c.name}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-ink-400">
            {c.productCount} prod.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => saveEdit(c)}
                disabled={busyId === c.id}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-accent-300 bg-accent-50 text-accent-700 hover:bg-accent-100 disabled:opacity-50"
              >
                {busyId === c.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-100"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startEdit(c)}
                title="Renombrar"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteCategory(c)}
                disabled={busyId === c.id}
                title="Eliminar"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                {busyId === c.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function Tree({
    parentId,
    depth,
  }: {
    parentId: string | null;
    depth: number;
  }) {
    return (
      <>
        {childrenOf(parentId).map((c) => (
          <div key={c.id}>
            <Row c={c} depth={depth} />
            <Tree parentId={c.id} depth={depth + 1} />
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      {/* Crear */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="size-5 text-brand-600" />
          <h3 className="text-base font-bold text-ink-900">
            Nueva categoría / subcategoría
          </h3>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mb-4 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-sm text-accent-700">
            {ok}
          </div>
        )}

        <form onSubmit={createCategory}>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Nombre
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Routers"
              className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Categoría padre
            </span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 [&>option]:text-ink-900"
            >
              <option value="">— Categoría principal —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-400">
              Elegí un padre para crear una subcategoría, o dejalo en
              &quot;principal&quot;.
            </span>
          </label>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {creating && <Loader2 className="size-4 animate-spin" />}
            Crear
          </button>
        </form>
      </div>

      {/* Árbol */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6">
        <h3 className="mb-4 text-base font-bold text-ink-900">
          Categorías ({parents.length} principales)
        </h3>
        <div className="max-h-[32rem] space-y-0.5 overflow-y-auto pr-1">
          <Tree parentId={null} depth={0} />
          {parents.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-400">
              Aún no hay categorías.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
