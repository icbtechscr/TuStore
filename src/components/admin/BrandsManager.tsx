"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Tag,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";

export type AdminBrandRow = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export function BrandsManager({
  initialBrands,
}: {
  initialBrands: AdminBrandRow[];
}) {
  const router = useRouter();
  const [brands, setBrands] = useState<AdminBrandRow[]>(initialBrands);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  async function reload() {
    try {
      const res = await fetch("/api/admin/brands", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as {
          brands: { id: string; name: string; slug: string }[];
        };
        // Conservamos los conteos que ya teníamos (no vienen en la lista simple).
        const prevCounts = new Map(brands.map((b) => [b.id, b.productCount]));
        setBrands(
          json.brands.map((b) => ({
            ...b,
            productCount: prevCounts.get(b.id) ?? 0,
          }))
        );
      }
    } catch {
      /* ignore */
    }
  }

  async function createBrand(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const json = (await res.json()) as {
        brand: { id: string; name: string; slug: string };
      };
      setBrands((prev) =>
        [...prev, { ...json.brand, productCount: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setOk(`Marca "${json.brand.name}" creada.`);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(b: AdminBrandRow) {
    setEditId(b.id);
    setEditName(b.name);
    setError(null);
    setOk(null);
  }

  async function saveEdit(b: AdminBrandRow) {
    if (!editName.trim()) return;
    setSavingId(b.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/brands/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setBrands((prev) =>
        prev
          .map((x) => (x.id === b.id ? { ...x, name: editName.trim() } : x))
          .sort((a, c) => a.name.localeCompare(c.name))
      );
      setEditId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  async function deleteBrand(b: AdminBrandRow) {
    const extra =
      b.productCount > 0
        ? `\n\n${b.productCount} producto(s) quedarán sin marca.`
        : "";
    if (!confirm(`¿Eliminar la marca "${b.name}"?${extra}`)) return;
    setError(null);
    setOk(null);
    setDeletingId(b.id);
    try {
      const res = await fetch(`/api/admin/brands/${b.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setBrands((prev) => prev.filter((x) => x.id !== b.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      {/* Crear marca */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="size-5 text-brand-600" />
          <h2 className="text-base font-bold text-ink-900">Nueva marca</h2>
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

        <form onSubmit={createBrand}>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Nombre de la marca
            </span>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: TP-Link"
                className="w-full rounded-xl border border-ink-200 bg-transparent py-2.5 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
            </div>
            <span className="mt-1 block text-xs text-ink-400">
              El slug (para URLs/filtros) se genera automáticamente.
            </span>
          </label>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {creating && <Loader2 className="size-4 animate-spin" />}
            Crear marca
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink-900">
            Marcas ({brands.length})
          </h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar marca…"
            className="w-48 rounded-xl border border-ink-200 bg-transparent px-3 py-1.5 text-sm text-ink-900 outline-none focus:border-brand-500"
          />
        </div>
        <ul className="divide-y divide-ink-100">
          {filtered.map((b) => {
            const editing = editId === b.id;
            return (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Tag className="size-4" />
                  </div>
                  <div className="min-w-0">
                    {editing ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre"
                        className="w-48 rounded-lg border border-ink-200 bg-transparent px-2 py-1 text-sm text-ink-900 outline-none focus:border-brand-500"
                      />
                    ) : (
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {b.name}
                      </p>
                    )}
                    <p className="truncate font-mono text-xs text-ink-400">
                      {b.slug} · {b.productCount} producto
                      {b.productCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveEdit(b)}
                        disabled={savingId === b.id}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-accent-300 bg-accent-50 text-accent-700 hover:bg-accent-100 disabled:opacity-50"
                      >
                        {savingId === b.id ? (
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
                        onClick={() => startEdit(b)}
                        title="Editar nombre"
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBrand(b)}
                        disabled={deletingId === b.id}
                        title="Eliminar"
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        {deletingId === b.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="py-6 text-center text-sm text-ink-400">
              {brands.length === 0
                ? "Aún no hay marcas. Creá la primera."
                : "No hay marcas que coincidan con la búsqueda."}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
