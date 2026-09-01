"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toWebp } from "@/lib/image-optimize";
import {
  STOCK_LABELS,
  STOCK_STATUSES,
  stockStatusToLegacyInStock,
  type StockStatus,
} from "@/lib/stock";

export type ProductFormInitial = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  short_description: string;
  description: string;
  price_crc: number;
  sale_price_crc: number | null;
  on_sale: boolean;
  in_stock: boolean;
  stock_status: StockStatus;
  stock_qty: number | null;
  brand_id: string | null;
  category_ids: string[];
  images: { url: string; alt: string; position: number }[];
};

type Option = { id: string; name: string };
type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

export function ProductForm({
  initial,
  brands,
  categories,
  mode,
}: {
  initial: ProductFormInitial;
  brands: Option[];
  categories: CategoryOption[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormInitial>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadingNew, setUploadingNew] = useState(false);
  // En modo crear, el slug sigue al nombre hasta que el usuario lo edita a mano.
  const [slugTouched, setSlugTouched] = useState(false);
  const newFileRef = useRef<HTMLInputElement | null>(null);

  // --- Árbol de categorías: Categoría (padre) → Subcategoría (hijo) ---
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const parentCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.parentId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  // Helpers de jerarquía (soporta N niveles).
  function topAncestor(id: string): string {
    let c = catById.get(id);
    while (c && c.parentId) c = catById.get(c.parentId);
    return c?.id ?? id;
  }
  function catDepth(id: string): number {
    let d = 0;
    let c = catById.get(id);
    while (c && c.parentId) {
      d++;
      c = catById.get(c.parentId);
    }
    return d;
  }

  // Estado inicial derivado de category_ids: toma la categoría más profunda
  // (sub o sub-sub) como "subcategoría" y su raíz como "categoría".
  function deriveInitialCats(): { categoryId: string; subcategoryId: string } {
    const ids = initial.category_ids ?? [];
    const nonTops = ids
      .map((id) => catById.get(id))
      .filter((c): c is CategoryOption => !!c && !!c.parentId);
    if (nonTops.length) {
      const deepest = nonTops.reduce((a, b) =>
        catDepth(b.id) >= catDepth(a.id) ? b : a
      );
      return { categoryId: topAncestor(deepest.id), subcategoryId: deepest.id };
    }
    const top = ids.map((id) => catById.get(id)).find((c) => c && !c.parentId);
    if (top) return { categoryId: top.id, subcategoryId: "" };
    return { categoryId: "", subcategoryId: "" };
  }
  const [categoryId, setCategoryId] = useState<string>(
    () => deriveInitialCats().categoryId
  );
  const [subcategoryId, setSubcategoryId] = useState<string>(
    () => deriveInitialCats().subcategoryId
  );

  // Todas las subcategorías (y sub-subcategorías) que cuelgan de la categoría
  // elegida, indentadas por nivel.
  const subOptions = useMemo(() => {
    if (!categoryId) return [] as { id: string; label: string }[];
    const out: { id: string; label: string }[] = [];
    const walk = (pid: string, depth: number) => {
      categories
        .filter((c) => c.parentId === pid)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((c) => {
          out.push({ id: c.id, label: `${"— ".repeat(depth - 1)}${c.name}` });
          walk(c.id, depth + 1);
        });
    };
    walk(categoryId, 1);
    return out;
  }, [categories, categoryId]);

  function onChangeCategory(id: string) {
    setCategoryId(id);
    setSubcategoryId(""); // al cambiar la categoría, se limpia la subcategoría
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    // Convertir a WebP en el navegador: menos peso en Storage.
    const optimizado = await toWebp(file, { maxSize: 1600, quality: 0.82 });
    fd.append("file", optimizado);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error((await res.text()) || "Error al subir");
    const json = (await res.json()) as { url: string };
    return json.url;
  }

  async function onPickForRow(i: number, file: File | null) {
    if (!file) return;
    setError(null);
    setUploadingIdx(i);
    try {
      const url = await uploadFile(file);
      updateImage(i, { url });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingIdx(null);
    }
  }

  async function onPickNew(file: File | null) {
    if (!file) return;
    setError(null);
    setUploadingNew(true);
    try {
      const url = await uploadFile(file);
      setForm((f) => ({
        ...f,
        images: [...f.images, { url, alt: "", position: f.images.length }],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingNew(false);
      if (newFileRef.current) newFileRef.current.value = "";
    }
  }

  function set<K extends keyof ProductFormInitial>(key: K, value: ProductFormInitial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setStockStatus(value: string) {
    const stockStatus: StockStatus = STOCK_STATUSES.includes(value as StockStatus)
      ? (value as StockStatus)
      : "in_stock";
    setForm((f) => ({
      ...f,
      stock_status: stockStatus,
      in_stock: stockStatusToLegacyInStock(stockStatus),
    }));
  }

  function addImage() {
    set("images", [
      ...form.images,
      { url: "", alt: "", position: form.images.length },
    ]);
  }

  function updateImage(i: number, patch: Partial<{ url: string; alt: string }>) {
    set(
      "images",
      form.images.map((img, j) => (i === j ? { ...img, ...patch } : img))
    );
  }

  function removeImage(i: number) {
    set(
      "images",
      form.images
        .filter((_, j) => j !== i)
        .map((img, j) => ({ ...img, position: j }))
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Categoría padre + subcategoría (ambas se ligan al producto).
    const category_ids = Array.from(
      new Set([categoryId, subcategoryId].filter(Boolean))
    );

    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      sku: form.sku.trim() || null,
      short_description: form.short_description || null,
      description: form.description || null,
      price_crc: Number(form.price_crc) || 0,
      sale_price_crc: form.sale_price_crc ? Number(form.sale_price_crc) : null,
      on_sale: form.on_sale,
      stock_status: form.stock_status,
      in_stock: stockStatusToLegacyInStock(form.stock_status),
      stock_qty:
        form.stock_qty === null || Number.isNaN(form.stock_qty)
          ? null
          : Number(form.stock_qty),
      brand_id: form.brand_id || null,
      category_ids,
      images: form.images
        .filter((img) => img.url.trim())
        .map((img, i) => ({ url: img.url.trim(), alt: img.alt || null, position: i })),
    };

    try {
      const url =
        mode === "create"
          ? "/api/admin/products"
          : `/api/admin/products/${initial.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Error guardando");
      }
      router.push("/admin/productos");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function slugify(s: string) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/productos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-brand-600"
        >
          <ArrowLeft className="size-4" />
          Volver a productos
        </Link>
        <div className="flex gap-2">
          <Link
            href="/admin/productos"
            className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Crear producto" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Section title="Información general">
            <div className="grid gap-4">
              <Field
                label="Nombre"
                required
                value={form.name}
                onChange={(v) => {
                  set("name", v);
                  if (mode === "create" && !slugTouched) set("slug", slugify(v));
                }}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Slug"
                  required
                  value={form.slug}
                  onChange={(v) => {
                    setSlugTouched(true);
                    set("slug", v);
                  }}
                  hint="URL: /productos/<slug>"
                  mono
                />
                <Field
                  label="SKU"
                  value={form.sku}
                  onChange={(v) => set("sku", v)}
                  mono
                />
              </div>
              <TextArea
                label="Descripción corta"
                value={form.short_description}
                onChange={(v) => set("short_description", v)}
                rows={2}
              />
              <TextArea
                label="Descripción completa"
                value={form.description}
                onChange={(v) => set("description", v)}
                rows={8}
                hint="Acepta HTML"
              />
            </div>
          </Section>

          <Section title="Imágenes">
            <div className="space-y-3">
              {form.images.length === 0 && (
                <p className="text-sm text-ink-500">Sin imágenes aún.</p>
              )}
              {form.images.map((img, i) => (
                <div
                  key={i}
                  className="grid items-start gap-3 rounded-xl border border-ink-200 bg-ink-50/40 p-3 sm:grid-cols-[80px_1fr_auto]"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-ink-200 bg-white">
                    {img.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt={img.alt}
                        className="size-full object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-ink-400">
                        Preview
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://... o subir desde dispositivo"
                        value={img.url}
                        onChange={(e) => updateImage(i, { url: e.target.value })}
                        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                      />
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:border-brand-500 hover:text-brand-600">
                        {uploadingIdx === i ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        <span>Subir</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={uploadingIdx === i}
                          onChange={(e) =>
                            onPickForRow(i, e.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="Texto alternativo (alt)"
                      value={img.alt}
                      onChange={(e) => updateImage(i, { alt: e.target.value })}
                      className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600"
                    aria-label="Eliminar imagen"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addImage}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-4 py-2 text-sm font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-600"
                >
                  <Plus className="size-4" />
                  Agregar por URL
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2 text-sm font-semibold text-brand-700 hover:border-brand-500 hover:bg-brand-50">
                  {uploadingNew ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Subir desde dispositivo
                  <input
                    ref={newFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingNew}
                    onChange={(e) => onPickNew(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Precio & Stock">
            <div className="grid gap-4">
              <Field
                label="Precio (CRC)"
                required
                type="number"
                value={String(form.price_crc)}
                onChange={(v) => set("price_crc", Number(v) || 0)}
                hint="IVA incluido"
              />
              <Field
                label="Precio oferta (CRC)"
                type="number"
                value={form.sale_price_crc ? String(form.sale_price_crc) : ""}
                onChange={(v) => set("sale_price_crc", v ? Number(v) : null)}
                hint="Dejar vacío si no aplica"
              />
              <Toggle
                label="En oferta"
                value={form.on_sale}
                onChange={(v) => set("on_sale", v)}
              />
              <Select
                label="Estado de inventario"
                value={form.stock_status}
                onChange={setStockStatus}
                options={STOCK_STATUSES.map((status) => ({
                  value: status,
                  label: STOCK_LABELS[status],
                }))}
              />
              <Field
                label="Cantidad en stock"
                type="number"
                value={form.stock_qty === null ? "" : String(form.stock_qty)}
                onChange={(v) => set("stock_qty", v === "" ? null : Number(v))}
                hint="Si se indica, el carrito no permite pedir más de esta cantidad."
              />
            </div>
          </Section>

          <Section title="Organización">
            <div className="grid gap-4">
              <Select
                label="Marca"
                value={form.brand_id ?? ""}
                onChange={(v) => set("brand_id", v || null)}
                placeholder="— Sin marca —"
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
                hint={
                  brands.length === 0
                    ? "No hay marcas. Creá marcas en Configuración → Tienda y productos."
                    : undefined
                }
              />
              <Select
                label="Categoría"
                value={categoryId}
                onChange={onChangeCategory}
                placeholder="— Elegir categoría —"
                options={parentCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
              <Select
                label="Subcategoría"
                value={subcategoryId}
                onChange={setSubcategoryId}
                placeholder={
                  !categoryId
                    ? "Elegí una categoría primero"
                    : subOptions.length === 0
                    ? "Esta categoría no tiene subcategorías"
                    : "— Sin subcategoría —"
                }
                disabled={!categoryId || subOptions.length === 0}
                options={subOptions.map((c) => ({
                  value: c.id,
                  label: c.label,
                }))}
                hint="Podés elegir una subcategoría o una sub-subcategoría (anidada)."
              />
            </div>
          </Section>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-700">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-ink-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:shadow-[var(--shadow-glow)] ${
          mono ? "font-mono" : ""
        }`}
      />
      {hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-ink-600">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:shadow-[var(--shadow-glow)]"
      />
      {hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-ink-600">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400 [&>option]:text-ink-900"
      >
        <option value="">{placeholder ?? "— Ninguno —"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2.5">
      <span className="text-sm font-semibold text-ink-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          value ? "bg-accent-500" : "bg-ink-300"
        }`}
      >
        <span
          className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
