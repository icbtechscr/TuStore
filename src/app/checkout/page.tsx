"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ArrowRight,
  Truck,
  MapPin,
  Mail,
  Phone,
  User,
  Store,
  Package,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatCRC } from "@/lib/utils";
import { CheckoutStepper } from "@/components/CheckoutStepper";
import {
  LocationPicker,
  type PickedLocation,
} from "@/components/checkout/LocationPicker";
import {
  ZONE_GROUPS,
  getZone,
  zoneRate,
  zoneFromLocation,
  distanceKm,
  distanceShippingCost,
  ORIGIN,
  PER_KM_RATE,
  type PackageSize,
} from "@/lib/shipping";
import { MINIMUM_SUBTOTAL_FOR_SHIPPING, requiresShippingMinimum } from "@/lib/orders";

const STORAGE_KEY = "tustore-checkout-v1";

type ShipMethod = "recogida" | "envio" | "encomienda";

type ShippingForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  province: string;
  canton: string;
  postalCode: string;
  address: string;
  reference: string;
  lat: number | null;
  lng: number | null;
  method: ShipMethod;
  zoneId: string;
  size: PackageSize;
};

const PROVINCES = [
  "San José",
  "Alajuela",
  "Heredia",
  "Cartago",
  "Puntarenas",
  "Guanacaste",
  "Limón",
];

const DEFAULT_FORM: ShippingForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  idNumber: "",
  province: "San José",
  canton: "",
  postalCode: "",
  address: "",
  reference: "",
  lat: null,
  lng: null,
  method: "envio",
  zoneId: "correos",
  size: "moto",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, count } = useCart();
  const [form, setForm] = useState<ShippingForm>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setForm((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch {}
  }, []);

  const zone = getZone(form.zoneId);
  const shippingCost =
    form.method === "recogida"
      ? 0
      : form.method === "envio"
        ? distanceShippingCost(form.lat, form.lng)
        : zone
          ? zoneRate(zone, form.size)
          : 0;
  const total = subtotal + shippingCost;

  function set<K extends keyof ShippingForm>(key: K, value: ShippingForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function normalizeProvince(raw?: string): string | null {
    if (!raw) return null;
    const r = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    for (const p of PROVINCES) {
      const base = p
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      if (r.includes(base)) return p;
    }
    return null;
  }

  function onLocation(v: PickedLocation) {
    setForm((p) => {
      const next: ShippingForm = { ...p, lat: v.lat, lng: v.lng };
      if (v.province || v.canton) {
        const prov = normalizeProvince(v.province);
        if (prov) next.province = prov;
        if (v.canton) next.canton = v.canton;
        // Para encomienda, auto-detecta la zona según el punto del mapa.
        next.zoneId = zoneFromLocation(v.province, v.canton);
      }
      return next;
    });
  }

  const distance =
    form.lat !== null && form.lng !== null
      ? distanceKm(ORIGIN.lat, ORIGIN.lng, form.lat, form.lng)
      : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requiresShippingMinimum(form.method) && subtotal < MINIMUM_SUBTOTAL_FOR_SHIPPING) {
      setFormError("Para enviar tu compra, el subtotal mínimo es de ₡10.000. También podés elegir recoger en sucursal para comprar cualquier monto.");
      return;
    }
    setFormError(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {}
    router.push("/checkout/pago");
  }

  if (count === 0) {
    return (
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-3xl font-black text-ink-900">Tu carrito está vacío</h1>
          <p className="mt-2 text-ink-500">
            Agregá productos antes de continuar al checkout.
          </p>
          <Link
            href="/productos"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900"
          >
            Ver catálogo
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 md:pb-24">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">Inicio</Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <Link href="/carrito" className="hover:text-brand-600">Carrito</Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">Envío</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">
            Datos de envío
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Necesitamos saber dónde entregar tu pedido.
          </p>
        </div>

        <CheckoutStepper current={1} />

        <form onSubmit={onSubmit} className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {formError && (
            <div className="lg:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {formError}
            </div>
          )}
          <div className="space-y-6">
            <Card title="Información personal" Icon={User}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" value={form.firstName} required onChange={(v) => set("firstName", v)} />
                <Field label="Apellidos" value={form.lastName} required onChange={(v) => set("lastName", v)} />
                <Field label="Número de cédula o ID" value={form.idNumber} onChange={(v) => set("idNumber", v)} />
                <Field label="Email" type="email" value={form.email} required Icon={Mail} onChange={(v) => set("email", v)} />
                <Field label="Teléfono" type="tel" value={form.phone} required Icon={Phone} onChange={(v) => set("phone", v)} />
              </div>
            </Card>

            <Card title="Ubicación de entrega" Icon={MapPin}>
              <p className="mb-3 text-xs text-ink-500">
                Ubicá tu casa en el mapa usando un punto de referencia. Podés
                ingresar la dirección exacta abajo.
              </p>
              <LocationPicker
                value={form.lat !== null && form.lng !== null ? { lat: form.lat, lng: form.lng } : null}
                onChange={onLocation}
              />
              <div className="mt-4">
                <Field
                  label="Punto de referencia / señas"
                  value={form.reference}
                  placeholder="Ej: portón verde, contiguo a la pulpería"
                  onChange={(v) => set("reference", v)}
                />
              </div>
            </Card>

            <Card title="Dirección" Icon={MapPin}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-600">Provincia</span>
                  <select
                    value={form.province}
                    onChange={(e) => set("province", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition-colors focus:border-brand-500"
                  >
                    {PROVINCES.map((p) => (
                      <option key={p} value={p} className="bg-white">{p}</option>
                    ))}
                  </select>
                </label>
                <Field label="Cantón" value={form.canton} required onChange={(v) => set("canton", v)} />
                <Field label="Código postal" value={form.postalCode} onChange={(v) => set("postalCode", v)} />
                <div className="sm:col-span-2">
                  <Field label="Dirección escrita o señas" value={form.address} required onChange={(v) => set("address", v)} />
                </div>
              </div>
            </Card>

            <Card title="Método de envío" Icon={Truck}>
              <div className="grid gap-3">
                <MethodOption
                  active={form.method === "recogida"}
                  onClick={() => set("method", "recogida")}
                  Icon={Store}
                  title="Recoger en sucursal"
                  desc="Retirás en nuestra tienda de Barreal de Heredia"
                  price="Gratis"
                />
                <MethodOption
                  active={form.method === "envio"}
                  onClick={() => set("method", "envio")}
                  Icon={Truck}
                  title="Envío a domicilio"
                  desc={`Tarifa por distancia · ${formatCRC(PER_KM_RATE)}/km`}
                  price={
                    distance !== null
                      ? formatCRC(distanceShippingCost(form.lat, form.lng))
                      : "Marcá ubicación"
                  }
                />
                <MethodOption
                  active={form.method === "encomienda"}
                  onClick={() => set("method", "encomienda")}
                  Icon={Package}
                  title="Encomienda"
                  desc="Envío por encomienda según tu zona"
                  price={zone ? formatCRC(zoneRate(zone, form.size)) : "—"}
                />
              </div>

              {form.method === "envio" && (
                <div className="mt-4 rounded-2xl border border-ink-200 bg-ink-50 p-4 text-sm">
                  {distance !== null ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-ink-700">
                        <MapPin className="size-4 shrink-0 text-brand-600" />
                        ~{distance} km desde TUStore Barreal × {formatCRC(PER_KM_RATE)}
                      </span>
                      <span className="text-base font-black tabular-nums text-ink-900">
                        {formatCRC(shippingCost)}
                      </span>
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-ink-600">
                      <MapPin className="size-4 shrink-0 text-brand-600" />
                      Marcá tu ubicación en el mapa para calcular el costo del
                      envío.
                    </p>
                  )}
                </div>
              )}

              {form.method === "encomienda" && (
                <div className="mt-4 space-y-3">
                  {zone && (
                    <div className="flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-xs text-brand-700">
                      <MapPin className="size-4 shrink-0" />
                      <span>
                        {form.lat !== null
                          ? "Zona sugerida del mapa: "
                          : "Zona: "}
                        <b>{zone.zone}</b> · {zone.label}. Podés cambiarla abajo.
                      </span>
                    </div>
                  )}
                  <div className="grid gap-4 rounded-2xl border border-ink-200 bg-ink-50 p-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-600">
                        Encomienda / destino
                      </span>
                      <select
                        value={form.zoneId}
                        onChange={(e) => set("zoneId", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
                      >
                        {ZONE_GROUPS.map((g) => (
                          <optgroup key={g.zone} label={g.zone}>
                            {g.services.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {zone && (
                        <span className="mt-1 block text-[11px] text-ink-400">
                          {zone.coverage}
                        </span>
                      )}
                    </label>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-600">
                        Tamaño del pedido
                      </span>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {(["moto", "carro"] as PackageSize[]).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => set("size", s)}
                            className={`rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                              form.size === s
                                ? "border-accent-500 bg-accent-50 ring-1 ring-accent-500/30"
                                : "border-ink-200 bg-white hover:bg-ink-50"
                            }`}
                          >
                            <span className="block font-bold text-ink-900">
                              {s === "moto" ? "Pequeño" : "Grande"}
                            </span>
                            <span className="text-ink-500">
                              {s === "moto" ? "Cabe en moto" : "Requiere carro"} ·{" "}
                              {formatCRC(zone ? zoneRate(zone, s) : 0)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-3 text-[11px] text-ink-400">
                El costo de envío es estimado. TUStore confirma el monto final según el
                caso.
              </p>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-black text-ink-900">Tu pedido</h2>
              <ul className="mt-4 max-h-72 space-y-3 overflow-auto pr-2 text-sm">
                {items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3 border-b border-ink-200 pb-3 last:border-0">
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-xs font-semibold text-ink-900">{it.name}</div>
                      <div className="mt-0.5 text-[11px] text-ink-500">x{it.qty} · {formatCRC(it.unitPrice)}</div>
                    </div>
                    <div className="text-sm font-bold tabular-nums text-ink-900">{formatCRC(it.qty * it.unitPrice)}</div>
                  </li>
                ))}
              </ul>

              <dl className="mt-4 space-y-2 border-t border-ink-200 pt-4 text-sm">
                <Row label="Subtotal" value={formatCRC(subtotal)} />
                <Row label="Envío" value={shippingCost === 0 ? "Gratis" : formatCRC(shippingCost)} highlight={shippingCost === 0} />
                <div className="mt-2 flex items-end justify-between border-t border-ink-200 pt-3">
                  <div>
                    <dt className="text-sm font-bold text-ink-900">Total</dt>
                    <span className="text-[11px] text-ink-400">IVA incluido (13%)</span>
                  </div>
                  <dd className="text-2xl font-black tabular-nums text-ink-900">{formatCRC(total)}</dd>
                </div>
              </dl>

              <button
                type="submit"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3.5 text-sm font-bold text-ink-900 shadow-lg shadow-accent-500/30 transition-all hover:bg-accent-400 active:scale-95"
              >
                Continuar al pago
                <ArrowRight className="size-4" />
              </button>
            </motion.div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function MethodOption({
  active,
  onClick,
  Icon,
  title,
  desc,
  price,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  price: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-accent-500 bg-accent-50 ring-2 ring-accent-500/30"
          : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white ring-1 ring-ink-200">
          <Icon className="size-5 text-brand-600" />
        </span>
        <div>
          <div className="text-sm font-bold text-ink-900">{title}</div>
          <div className="mt-0.5 text-xs text-ink-500">{desc}</div>
        </div>
      </div>
      <div className="font-black tabular-nums text-ink-900">{price}</div>
    </button>
  );
}

function Card({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-900">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent-100 text-accent-700 ring-1 ring-accent-200">
          <Icon className="size-4" />
        </span>
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
  placeholder,
  Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  Icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-ink-600">
        {label}
        {required && <span className="ml-1 text-accent-600">*</span>}
      </span>
      <div className="relative mt-1">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        )}
        <input
          type={type}
          required={required}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border border-ink-200 bg-white py-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 ${
            Icon ? "pl-10 pr-4" : "px-4"
          }`}
        />
      </div>
    </label>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`font-semibold tabular-nums ${highlight ? "text-accent-700" : "text-ink-900"}`}>
        {value}
      </dd>
    </div>
  );
}

