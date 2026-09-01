"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Menu,
  X,
} from "lucide-react";
import type { NavbarItem } from "@/lib/site-content";

type CatOption = { slug: string; name: string; parentId: string | null; id: string };

export function NavbarManager({
  initialItems,
  categories,
}: {
  initialItems: NavbarItem[];
  categories: CatOption[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<NavbarItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const nameBySlug = useMemo(
    () => new Map(categories.map((c) => [c.slug, c.name])),
    [categories]
  );

  // Opciones de categoría indentadas (todos los niveles) para el selector.
  const catOptions = useMemo(() => {
    const out: { slug: string; label: string }[] = [];
    const walk = (pid: string | null, depth: number) => {
      categories
        .filter((c) => c.parentId === pid)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((c) => {
          out.push({ slug: c.slug, label: `${"— ".repeat(depth)}${c.name}` });
          walk(c.id, depth + 1);
        });
    };
    walk(null, 0);
    return out;
  }, [categories]);

  function update(i: number, patch: Partial<NavbarItem>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
  function move(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function remove(i: number) {
    setItems((prev) => prev.filter((_, j) => j !== i));
  }
  function add() {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "Nuevo botón",
        href: null,
        categorySlug: null,
        categorySlugs: [],
      },
    ]);
  }
  function addSlug(i: number, slug: string) {
    if (!slug) return;
    setItems((prev) =>
      prev.map((it, j) =>
        j === i && !it.categorySlugs.includes(slug)
          ? { ...it, categorySlugs: [...it.categorySlugs, slug] }
          : it
      )
    );
  }
  function removeSlug(i: number, slug: string) {
    setItems((prev) =>
      prev.map((it, j) =>
        j === i
          ? { ...it, categorySlugs: it.categorySlugs.filter((s) => s !== slug) }
          : it
      )
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const clean = items.map((it) => ({
      id: it.id,
      label: it.label.trim() || "Sin nombre",
      href: it.href?.trim() || null,
      categorySlug: it.categorySlug || null,
      categorySlugs: it.categorySlugs,
    }));
    try {
      const res = await fetch("/api/admin/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "navbar", value: { items: clean } }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg({ ok: true, text: "Navbar guardada. Recargá la tienda para verla." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6">
      <div className="mb-1 flex items-center gap-2">
        <Menu className="size-5 text-brand-600" />
        <h3 className="text-base font-bold text-ink-900">Botones de la barra</h3>
      </div>
      <p className="mb-4 text-sm text-ink-500">
        Asigná una <b>categoría</b> al botón y su menú mostrará{" "}
        <b>las subcategorías</b> automáticamente. Opcional: agregá categorías
        sueltas extra abajo. Si el botón no tiene categoría, es un enlace simple
        (ej. Inicio, Ofertas).
      </p>

      {msg && (
        <div
          className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${
            msg.ok
              ? "border-accent-200 bg-accent-50 text-accent-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="space-y-3">
        {items.map((it, i) => (
          <div
            key={it.id}
            className="rounded-xl border border-ink-200 bg-ink-50/40 p-3"
          >
            {/* Fila principal del botón */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-ink-400 hover:text-brand-600 disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="text-ink-400 hover:text-brand-600 disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>

              <input
                value={it.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Etiqueta del botón"
                className="w-36 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm font-semibold outline-none focus:border-brand-500"
              />

              <select
                value={it.categorySlug ?? ""}
                onChange={(e) => {
                  const slug = e.target.value || null;
                  // Un bot\u00f3n asignado a una categor\u00eda debe llevar siempre a esa
                  // categor\u00eda. As\u00ed un link manual anterior no queda apuntando a
                  // una secci\u00f3n distinta despu\u00e9s de cambiar el selector.
                  const patch: Partial<NavbarItem> = {
                    categorySlug: slug,
                    href: slug ? null : it.href,
                  };
                  const isDefaultLabel =
                    !it.label.trim() ||
                    it.label === "Nuevo botón" ||
                    it.label === "Botón";
                  if (slug && isDefaultLabel) {
                    patch.label = nameBySlug.get(slug) ?? it.label;
                  }
                  update(i, patch);
                }}
                title="Categoría del botón (muestra sus subcategorías en el menú)"
                className="w-48 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-brand-500 [&>option]:text-ink-900"
              >
                <option value="">— Sin categoría (enlace) —</option>
                {catOptions.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>

              <input
                value={it.href ?? ""}
                onChange={(e) => update(i, { href: e.target.value })}
                placeholder="Link (opcional)"
                className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-2.5 py-2 font-mono text-xs outline-none focus:border-brand-500"
              />

              <button
                type="button"
                onClick={() => remove(i)}
                title="Quitar botón"
                className="inline-flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            {/* Categorías del menú */}
            <div className="mt-2.5 border-t border-ink-200/70 pt-2.5">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Categorías sueltas extra (opcional)
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {it.categorySlugs.map((slug) => (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-brand-700"
                  >
                    {nameBySlug.get(slug) ?? slug}
                    <button
                      type="button"
                      onClick={() => removeSlug(i, slug)}
                      className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-200"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {it.categorySlugs.length === 0 && (
                  <span className="text-xs italic text-ink-400">
                    Sin categorías (enlace simple)
                  </span>
                )}
                <select
                  value=""
                  onChange={(e) => addSlug(i, e.target.value)}
                  className="rounded-full border border-dashed border-ink-300 bg-white px-2.5 py-1 text-xs text-ink-600 outline-none focus:border-brand-500 [&>option]:text-ink-900"
                >
                  <option value="">+ Agregar categoría…</option>
                  {catOptions.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-4 py-2 text-sm font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-600"
        >
          <Plus className="size-4" />
          Agregar botón
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar navbar
        </button>
      </div>
    </div>
  );
}
