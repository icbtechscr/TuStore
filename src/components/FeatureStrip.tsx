import { Truck, ShieldCheck, HandHelping, Wallet } from "lucide-react";

const FEATURES = [
  {
    Icon: Truck,
    title: "Envíos a todo el país",
    desc: "Entregas rápidas y seguras en Costa Rica",
  },
  {
    Icon: ShieldCheck,
    title: "Garantía y respaldo",
    desc: "Compras con acompañamiento de la tienda",
  },
  {
    Icon: HandHelping,
    title: "Atención personalizada",
    desc: "Te ayudamos a elegir el producto adecuado",
  },
  {
    Icon: Wallet,
    title: "Métodos de pago seguros",
    desc: "Aceptamos SINPE Móvil, Transferencia, Tarjetas y Efectivo",
  },
];

export function FeatureStrip() {
  return (
    <section className="border-y border-ink-200 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-ink-200 md:grid-cols-4">
        {FEATURES.map(({ Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-3 border-t-2 border-transparent bg-white p-5 transition-colors hover:border-accent-400 hover:bg-brand-50/40"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-accent-500">
              <Icon className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-ink-900">{title}</div>
              <div className="mt-0.5 text-xs text-ink-500">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
