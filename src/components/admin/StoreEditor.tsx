"use client";
import { useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  Search,
  ArrowUp,
  ArrowDown,
  X,
  Check,
} from "lucide-react";
import { formatCRC } from "@/lib/utils";
import { toWebp } from "@/lib/image-optimize";
import type {
  SiteContent,
  SectionKey,
  HeroContent,
  CategoriesContent,
  CategoryItem,
  ProductSectionContent,
  PromotionalBannersContent,
  PromotionalBanner,
  FooterBannerContent,
  CtaContent,
  FooterContent,
} from "@/lib/site-content";

type Category = { id: string; name: string; slug: string };
type ProductLite = {
  id: string;
  name: string;
  sku: string | null;
  image: string | null;
  priceCRC: number;
  salePriceCRC: number | null;
};

export function StoreEditor({
  content,
  categories,
  initialProducts,
  autoHeroProduct,
  autoCategories,
  autoOfertas,
  autoDestacados,
}: {
  content: SiteContent;
  categories: Category[];
  initialProducts: ProductLite[];
  autoHeroProduct: ProductLite | null;
  autoCategories: CategoryItem[];
  autoOfertas: ProductLite[];
  autoDestacados: ProductLite[];
}) {
  const productCache = useRef<Map<string, ProductLite>>(
    new Map(
      [
        ...initialProducts,
        ...(autoHeroProduct ? [autoHeroProduct] : []),
        ...autoOfertas,
        ...autoDestacados,
      ].map((p) => [p.id, p])
    )
  );

  return (
    <div className="space-y-6">
      <BannersEditor data={content.banners} cache={productCache} />
      <CategoriesEditor
        data={content.categories}
        categories={categories}
        autoItems={autoCategories}
      />
      <ProductSectionEditor
        sectionKey="ofertas"
        title="Ofertas activas"
        data={content.ofertas}
        cache={productCache}
        autoProducts={autoOfertas}
        emptyHint="Estos son los productos en oferta que se muestran ahora. Editá la lista o dejá vacío para modo automático."
      />
      <ProductSectionEditor
        sectionKey="destacados"
        title="Productos destacados"
        data={content.destacados}
        cache={productCache}
        autoProducts={autoDestacados}
        emptyHint="Estos son los productos destacados que se muestran ahora. Editá la lista o dejá vacío para modo automático."
      />
      <CtaEditor data={content.cta} />
      <FooterBannerEditor data={content.footerBanner} />
      <FooterEditor data={content.footer} />
    </div>
  );
}

/* ---------- promotional banners ---------- */

const BANNER_SLOTS: {
  key: keyof PromotionalBannersContent;
  title: string;
  description: string;
  dimensions: string;
}[] = [
  {
    key: "left",
    title: "Banner lateral izquierdo",
    description: "Se muestra en pantallas grandes, a la izquierda del banner central.",
    dimensions: "Tamaño real: 230 × 850 px. Para mayor nitidez: 460 × 1700 px.",
  },
  {
    key: "center",
    title: "Banner central",
    description: "Banner principal horizontal, arriba de la página de inicio.",
    dimensions: "Tamaño recomendado: 1600 × 500 px",
  },
  {
    key: "right",
    title: "Banner lateral derecho",
    description: "Se muestra en pantallas grandes, a la derecha del banner central.",
    dimensions: "Tamaño real: 230 × 850 px. Para mayor nitidez: 460 × 1700 px.",
  },
];

function BannersEditor({
  data,
  cache,
}: {
  data: PromotionalBannersContent;
  cache: React.RefObject<Map<string, ProductLite>>;
}) {
  const [form, setForm] = useState<PromotionalBannersContent>(data);
  const [, forceRender] = useState(0);
  const { save, saving, status, error } = useSave("banners");

  function update(
    key: keyof PromotionalBannersContent,
    patch: Partial<PromotionalBanner>
  ) {
    setForm((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

  function pickProduct(key: keyof PromotionalBannersContent, product: ProductLite) {
    cache.current.set(product.id, product);
    update(key, { productId: product.id, linkUrl: "" });
    forceRender((value) => value + 1);
  }

  return (
    <Card
      title="1 · Banners promocionales"
      description="Subí una imagen y definí su destino: una ficha de producto o un enlace a una categoría, catálogo, promoción o página externa."
      onSave={() => save(form)}
      saving={saving}
      status={status}
      error={error}
    >
      <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-800">
        Los laterales aparecen desde computadoras y siempre se ajustan completos,
        sin recortar el contenido. En celular se muestra únicamente el banner central.
      </p>
      <div className="grid gap-5 xl:grid-cols-3">
        {BANNER_SLOTS.map((slot) => {
          const banner = form[slot.key];
          const product = banner.productId
            ? cache.current.get(banner.productId) ?? null
            : null;
          return (
            <div
              key={slot.key}
              className="rounded-xl border border-ink-200 bg-ink-50/40 p-3"
            >
              <h3 className="text-sm font-black text-ink-900">{slot.title}</h3>
              <p className="mt-1 min-h-9 text-xs text-ink-500">
                {slot.description}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-brand-700">
                {slot.dimensions}
              </p>
              <div className="mt-3">
                <Label>Imagen</Label>
                <ImageUpload
                  url={banner.imageUrl}
                  onChange={(imageUrl) => update(slot.key, { imageUrl })}
                />
              </div>
              <div className="mt-3">
                <Text
                  label="Texto alternativo"
                  value={banner.altText}
                  placeholder="Ej.: Promoción cámara Tapo"
                  onChange={(altText) => update(slot.key, { altText })}
                />
              </div>
              <div className="mt-3">
                <Text
                  label="Enlace al que dirige (opcional)"
                  value={banner.linkUrl}
                  placeholder="Ej.: /categoria/computacion o /productos"
                  onChange={(linkUrl) =>
                    update(slot.key, {
                      linkUrl,
                      productId: linkUrl.trim() ? null : banner.productId,
                    })
                  }
                />
                <p className="mt-1 text-[11px] text-ink-500">
                  Usá una ruta como <code>/categoria/seguridad</code> o una URL completa. Al escribir un enlace se desliga el producto.
                </p>
              </div>
              <div className="mt-3">
                <Label>Producto al que dirige</Label>
                {product ? (
                  <ProductChip
                    p={product}
                    onRemove={() => update(slot.key, { productId: null })}
                  />
                ) : (
                  <p className="mb-2 text-xs text-ink-500">
                    {banner.linkUrl.trim()
                      ? "El enlace personalizado será el destino del banner."
                      : "Sin enlace ni producto: la imagen se verá, pero no llevará a una ficha."}
                  </p>
                )}
                <div className="mt-2">
                  <ProductSearch onPick={(product) => pickProduct(slot.key, product)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- shared save logic ---------- */

function useSave(key: SectionKey) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(value: unknown) {
    setSaving(true);
    setStatus("idle");
    setError(null);
    try {
      const res = await fetch("/api/admin/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Error al guardar");
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  return { save, saving, status, error };
}

/* ---------- layout primitives ---------- */

function Card({
  title,
  description,
  children,
  onSave,
  saving,
  status,
  error,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  status: "idle" | "ok" | "error";
  error: string | null;
}) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div>
          <h2 className="text-base font-black tracking-tight text-ink-900">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-ink-500">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "ok" && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
              <Check className="size-3.5" />
              Guardado
            </span>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar sección
          </button>
        </div>
      </div>
      {error && (
        <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-600">
      {children}
    </span>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500"
      />
    </label>
  );
}

/* ---------- image upload ---------- */

function ImageUpload({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File | null) {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      // Convertir a WebP en el navegador: menos peso en Storage.
      const optimizado = await toWebp(file, { maxSize: 1600, quality: 0.82 });
      fd.append("file", optimizado);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.text()) || "Error al subir");
      const json = (await res.json()) as { url: string };
      onChange(json.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-ink-50">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-contain p-1" />
        ) : (
          <div className="flex h-full items-center justify-center text-[9px] text-ink-400">
            Sin imagen
          </div>
        )}
      </div>
      <div className="grid flex-1 gap-1.5">
        <input
          type="url"
          value={url}
          placeholder="https://... o subir"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-brand-300 bg-brand-50/50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Subir imagen
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>
        {err && <span className="text-[11px] text-red-600">{err}</span>}
      </div>
    </div>
  );
}

/* ---------- product search ---------- */

function ProductSearch({ onPick }: { onPick: (p: ProductLite) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/products/search?q=${encodeURIComponent(value.trim())}`
        );
        const json = (await res.json()) as { products: ProductLite[] };
        setResults(json.products ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={q}
          placeholder="Buscar producto por nombre o SKU..."
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-400" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lift">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p);
                setQ("");
                setResults([]);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-50"
            >
              <div className="relative size-9 shrink-0 overflow-hidden rounded border border-ink-200 bg-white">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt=""
                    className="size-full object-contain p-0.5"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-semibold text-ink-900">
                  {p.name}
                </div>
                <div className="text-[11px] text-ink-500">
                  {p.sku ?? "—"} · {formatCRC(p.salePriceCRC ?? p.priceCRC)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductChip({
  p,
  onRemove,
  onUp,
  onDown,
}: {
  p: ProductLite;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-50/50 p-2">
      <div className="relative size-10 shrink-0 overflow-hidden rounded border border-ink-200 bg-white">
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="size-full object-contain p-0.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-sm font-semibold text-ink-900">
          {p.name}
        </div>
        <div className="text-[11px] text-ink-500">
          {p.sku ?? "—"} · {formatCRC(p.salePriceCRC ?? p.priceCRC)}
        </div>
      </div>
      {(onUp || onDown) && (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={onUp}
            disabled={!onUp}
            className="text-ink-400 hover:text-brand-600 disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDown}
            disabled={!onDown}
            className="text-ink-400 hover:text-brand-600 disabled:opacity-30"
          >
            <ArrowDown className="size-4" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600"
        aria-label="Quitar"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

/* ---------- hero ---------- */

function HeroEditor({
  data,
  cache,
  autoProduct,
}: {
  data: HeroContent;
  cache: React.RefObject<Map<string, ProductLite>>;
  autoProduct: ProductLite | null;
}) {
  const [form, setForm] = useState<HeroContent>({
    ...data,
    featuredProductIds: data.featuredProductIds?.length
      ? data.featuredProductIds
      : data.featuredProductId
      ? [data.featuredProductId]
      : autoProduct
      ? [autoProduct.id]
      : [],
  });
  const [, forceRender] = useState(0);
  const { save, saving, status, error } = useSave("hero");
  const set = <K extends keyof HeroContent>(k: K, v: HeroContent[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const featuredList = form.featuredProductIds
    .map((id) => cache.current.get(id))
    .filter((p): p is ProductLite => !!p);

  function addFeatured(p: ProductLite) {
    cache.current.set(p.id, p);
    if (
      !form.featuredProductIds.includes(p.id) &&
      form.featuredProductIds.length < 5
    ) {
      set("featuredProductIds", [...form.featuredProductIds, p.id]);
    }
    forceRender((n) => n + 1);
  }
  function removeFeatured(id: string) {
    set(
      "featuredProductIds",
      form.featuredProductIds.filter((x) => x !== id)
    );
  }

  return (
    <Card
      title="1 · Encabezado (Hero)"
      description="Banner principal: insignia, título, descripción, botones y producto destacado."
      onSave={() => save(form)}
      saving={saving}
      status={status}
      error={error}
    >
      <Text
        label="Insignia"
        value={form.badge}
        onChange={(v) => set("badge", v)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Título — línea 1"
          value={form.titleLine1}
          onChange={(v) => set("titleLine1", v)}
        />
        <Text
          label="Título — línea 2 (verde)"
          value={form.titleLine2}
          onChange={(v) => set("titleLine2", v)}
        />
      </div>
      <Area
        label="Descripción"
        value={form.subtitle}
        onChange={(v) => set("subtitle", v)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Botón principal — texto"
          value={form.primaryCtaLabel}
          onChange={(v) => set("primaryCtaLabel", v)}
        />
        <Text
          label="Botón principal — enlace"
          value={form.primaryCtaHref}
          onChange={(v) => set("primaryCtaHref", v)}
        />
        <Text
          label="Botón secundario — texto"
          value={form.secondaryCtaLabel}
          onChange={(v) => set("secondaryCtaLabel", v)}
        />
        <Text
          label="Botón secundario — enlace"
          value={form.secondaryCtaHref}
          onChange={(v) => set("secondaryCtaHref", v)}
        />
      </div>
      <div>
        <Label>Puntos destacados (3)</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="text"
              value={form.bullets[i] ?? ""}
              onChange={(e) => {
                const next = [...form.bullets];
                next[i] = e.target.value;
                set("bullets", next);
              }}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          ))}
        </div>
      </div>
      <div>
        <Label>Productos destacados del hero (hasta 5 · carrusel)</Label>
        {featuredList.length === 0 && (
          <p className="mb-2 text-xs text-ink-500">
            Sin selección se muestran automáticamente productos recientes.
          </p>
        )}
        <div className="space-y-2">
          {featuredList.map((p) => (
            <ProductChip key={p.id} p={p} onRemove={() => removeFeatured(p.id)} />
          ))}
        </div>
        {form.featuredProductIds.length < 5 ? (
          <div className="mt-2">
            <ProductSearch onPick={addFeatured} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-500">
            Máximo 5 productos en el carrusel.
          </p>
        )}
      </div>
    </Card>
  );
}

/* ---------- categories ---------- */

function CategoriesEditor({
  data,
  categories,
  autoItems,
}: {
  data: CategoriesContent;
  categories: Category[];
  autoItems: CategoryItem[];
}) {
  const [form, setForm] = useState<CategoriesContent>({
    ...data,
    items: data.items.length ? data.items : autoItems,
  });
  const { save, saving, status, error } = useSave("categories");
  const set = <K extends keyof CategoriesContent>(
    k: K,
    v: CategoriesContent[K]
  ) => setForm((f) => ({ ...f, [k]: v }));

  const nameOf = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "(categoría eliminada)";
  const available = categories.filter(
    (c) => !form.items.some((it) => it.categoryId === c.id)
  );

  function updateItem(i: number, patch: Partial<CategoriesContent["items"][0]>) {
    set(
      "items",
      form.items.map((it, j) => (i === j ? { ...it, ...patch } : it))
    );
  }
  function move(i: number, dir: -1 | 1) {
    const next = [...form.items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("items", next);
  }

  return (
    <Card
      title="2 · Categorías de la tienda"
      description="Carrusel de categorías. Sin elementos se muestran automáticamente las más populares."
      onSave={() => save(form)}
      saving={saving}
      status={status}
      error={error}
    >
      <Text
        label="Eyebrow"
        value={form.eyebrow}
        onChange={(v) => set("eyebrow", v)}
      />
      <Text label="Título" value={form.title} onChange={(v) => set("title", v)} />
      <Text
        label="Subtítulo"
        value={form.subtitle}
        onChange={(v) => set("subtitle", v)}
      />

      <div className="space-y-3">
        <Label>Categorías mostradas</Label>
        {form.items.length === 0 && (
          <p className="text-xs text-ink-500">
            Vacío = automático. Agregá categorías para controlarlas manualmente.
          </p>
        )}
        {form.items.map((it, i) => (
          <div
            key={it.categoryId + i}
            className="rounded-xl border border-ink-200 bg-ink-50/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-ink-800">
                {nameOf(it.categoryId)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-ink-400 hover:text-brand-600 disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === form.items.length - 1}
                  className="text-ink-400 hover:text-brand-600 disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "items",
                      form.items.filter((_, j) => j !== i)
                    )
                  }
                  className="text-ink-500 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={it.nameOverride}
              placeholder="Nombre a mostrar (vacío = nombre original)"
              onChange={(e) => updateItem(i, { nameOverride: e.target.value })}
              className="mb-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
            />
            <ImageUpload
              url={it.imageUrl}
              onChange={(url) => updateItem(i, { imageUrl: url })}
            />
          </div>
        ))}

        {available.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              set("items", [
                ...form.items,
                { categoryId: e.target.value, nameOverride: "", imageUrl: "" },
              ]);
            }}
            className="rounded-full border border-dashed border-brand-300 bg-brand-50/50 px-4 py-2 text-sm font-semibold text-brand-700"
          >
            <option value="">+ Agregar categoría...</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </Card>
  );
}

/* ---------- product sections (ofertas / destacados) ---------- */

function ProductSectionEditor({
  sectionKey,
  title,
  data,
  cache,
  autoProducts,
  emptyHint,
}: {
  sectionKey: "ofertas" | "destacados";
  title: string;
  data: ProductSectionContent;
  cache: React.RefObject<Map<string, ProductLite>>;
  autoProducts: ProductLite[];
  emptyHint: string;
}) {
  const [form, setForm] = useState<ProductSectionContent>({
    ...data,
    productIds: data.productIds.length
      ? data.productIds
      : autoProducts.map((p) => p.id),
  });
  const [, forceRender] = useState(0);
  const { save, saving, status, error } = useSave(sectionKey);
  const set = <K extends keyof ProductSectionContent>(
    k: K,
    v: ProductSectionContent[K]
  ) => setForm((f) => ({ ...f, [k]: v }));

  function move(i: number, dir: -1 | 1) {
    const next = [...form.productIds];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("productIds", next);
  }

  const num = sectionKey === "ofertas" ? "3" : "4";

  return (
    <Card
      title={`${num} · ${title}`}
      description="Título de la sección y selección manual de productos."
      onSave={() => save(form)}
      saving={saving}
      status={status}
      error={error}
    >
      <Text
        label="Eyebrow"
        value={form.eyebrow}
        onChange={(v) => set("eyebrow", v)}
      />
      <Text label="Título" value={form.title} onChange={(v) => set("title", v)} />
      <Text
        label="Subtítulo"
        value={form.subtitle}
        onChange={(v) => set("subtitle", v)}
      />

      <div className="space-y-2">
        <Label>Productos mostrados</Label>
        {form.productIds.length === 0 && (
          <p className="text-xs text-ink-500">{emptyHint}</p>
        )}
        {form.productIds.map((id, i) => {
          const p = cache.current.get(id);
          if (!p)
            return (
              <div
                key={id}
                className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50/50 px-3 py-2 text-xs text-ink-500"
              >
                Producto {id}
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "productIds",
                      form.productIds.filter((_, j) => j !== i)
                    )
                  }
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          return (
            <ProductChip
              key={id}
              p={p}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={
                i < form.productIds.length - 1 ? () => move(i, 1) : undefined
              }
              onRemove={() =>
                set(
                  "productIds",
                  form.productIds.filter((_, j) => j !== i)
                )
              }
            />
          );
        })}
        <ProductSearch
          onPick={(p) => {
            if (form.productIds.includes(p.id)) return;
            cache.current.set(p.id, p);
            set("productIds", [...form.productIds, p.id]);
            forceRender((n) => n + 1);
          }}
        />
      </div>
    </Card>
  );
}

/* ---------- cta ---------- */

function CtaEditor({ data }: { data: CtaContent }) {
  const [form, setForm] = useState<CtaContent>(data);
  const { save, saving, status, error } = useSave("cta");
  const set = <K extends keyof CtaContent>(k: K, v: CtaContent[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card
      title="5 · Llamado a la acción"
      description='Sección "Hablemos de tu proyecto" antes del footer.'
      onSave={() => save(form)}
      saving={saving}
      status={status}
      error={error}
    >
      <Text
        label="Eyebrow"
        value={form.eyebrow}
        onChange={(v) => set("eyebrow", v)}
      />
      <Text label="Título" value={form.title} onChange={(v) => set("title", v)} />
      <Area
        label="Subtítulo"
        value={form.subtitle}
        onChange={(v) => set("subtitle", v)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Botón principal — texto"
          value={form.primaryCtaLabel}
          onChange={(v) => set("primaryCtaLabel", v)}
        />
        <Text
          label="Botón principal — enlace"
          value={form.primaryCtaHref}
          onChange={(v) => set("primaryCtaHref", v)}
        />
        <Text
          label="Botón secundario — texto"
          value={form.secondaryCtaLabel}
          onChange={(v) => set("secondaryCtaLabel", v)}
        />
        <Text
          label="Botón secundario — enlace"
          value={form.secondaryCtaHref}
          onChange={(v) => set("secondaryCtaHref", v)}
        />
      </div>
    </Card>
  );
}

/* ---------- banner antes del footer ---------- */

function FooterBannerEditor({ data }: { data: FooterBannerContent }) {
  const [form, setForm] = useState<FooterBannerContent>(data);
  const { save, saving, status, error } = useSave("footerBanner");
  const set = <K extends keyof FooterBannerContent>(
    key: K,
    value: FooterBannerContent[K]
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Card
      title="6 · Banner antes del footer"
      description="Franja publicitaria ubicada entre la sección azul de asesoría y el footer. Podés reemplazarla o dejar la imagen vacía para ocultarla."
      onSave={() => save(form)}
      saving={saving}
      status={status}
      error={error}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Label>Imagen horizontal</Label>
          <ImageUpload
            url={form.imageUrl}
            onChange={(imageUrl) => set("imageUrl", imageUrl)}
          />
          <p className="mt-1 text-[11px] text-ink-500">
            Tamaño recomendado: 1600 × 150 px (franja panorámica delgada).
          </p>
        </div>
        <div className="space-y-4">
          <Text
            label="Texto alternativo"
            value={form.altText}
            placeholder="Ej.: Promoción de tecnología"
            onChange={(altText) => set("altText", altText)}
          />
          <Text
            label="Enlace al que dirige (opcional)"
            value={form.linkUrl}
            placeholder="Ej.: /productos o /categoria/seguridad"
            onChange={(linkUrl) => set("linkUrl", linkUrl)}
          />
          <p className="text-xs text-ink-500">
            Acepta rutas internas y enlaces completos. Si lo dejás vacío, la imagen solo se muestra.
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ---------- footer ---------- */

function FooterEditor({ data }: { data: FooterContent }) {
  const [form, setForm] = useState<FooterContent>(data);
  const { save, saving, status, error } = useSave("footer");
  const set = <K extends keyof FooterContent>(k: K, v: FooterContent[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function updateCol(i: number, patch: Partial<FooterContent["columns"][0]>) {
    set(
      "columns",
      form.columns.map((c, j) => (i === j ? { ...c, ...patch } : c))
    );
  }

  return (
    <Card
      title="7 · Footer"
      description="Pie de página: datos de contacto, redes y columnas de enlaces."
      onSave={() => save(form)}
      saving={saving}
      status={status}
      error={error}
    >
      <Area
        label="Descripción"
        value={form.description}
        onChange={(v) => set("description", v)}
      />
      <Text
        label="Texto de ubicaciones"
        value={form.locationsText}
        onChange={(v) => set("locationsText", v)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Teléfono"
          value={form.phone}
          onChange={(v) => set("phone", v)}
        />
        <Text
          label="Email"
          value={form.email}
          onChange={(v) => set("email", v)}
        />
        <Text
          label="Facebook (URL)"
          value={form.facebook}
          onChange={(v) => set("facebook", v)}
        />
        <Text
          label="Instagram (URL)"
          value={form.instagram}
          onChange={(v) => set("instagram", v)}
        />
        <Text
          label="YouTube (URL)"
          value={form.youtube}
          onChange={(v) => set("youtube", v)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Newsletter — título"
          value={form.newsletterTitle}
          onChange={(v) => set("newsletterTitle", v)}
        />
        <Text
          label="Newsletter — subtítulo"
          value={form.newsletterSubtitle}
          onChange={(v) => set("newsletterSubtitle", v)}
        />
      </div>

      <div className="space-y-3">
        <Label>Columnas de enlaces</Label>
        {form.columns.map((col, ci) => (
          <div
            key={ci}
            className="rounded-xl border border-ink-200 bg-ink-50/40 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                value={col.title}
                onChange={(e) => updateCol(ci, { title: e.target.value })}
                className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-bold outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() =>
                  set(
                    "columns",
                    form.columns.filter((_, j) => j !== ci)
                  )
                }
                className="text-ink-500 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              {col.items.map((it, ii) => (
                <div key={ii} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={it.label}
                    placeholder="Texto"
                    onChange={(e) =>
                      updateCol(ci, {
                        items: col.items.map((x, j) =>
                          j === ii ? { ...x, label: e.target.value } : x
                        ),
                      })
                    }
                    className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                  />
                  <input
                    type="text"
                    value={it.href}
                    placeholder="/enlace"
                    onChange={(e) =>
                      updateCol(ci, {
                        items: col.items.map((x, j) =>
                          j === ii ? { ...x, href: e.target.value } : x
                        ),
                      })
                    }
                    className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateCol(ci, {
                        items: col.items.filter((_, j) => j !== ii),
                      })
                    }
                    className="text-ink-500 hover:text-red-600"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateCol(ci, {
                    items: [...col.items, { label: "", href: "" }],
                  })
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <Plus className="size-3.5" />
                Agregar enlace
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            set("columns", [...form.columns, { title: "Nueva columna", items: [] }])
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          <Plus className="size-4" />
          Agregar columna
        </button>
      </div>
    </Card>
  );
}
