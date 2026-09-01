import Link from "next/link";
import { ArrowLeft, Hammer, type LucideIcon } from "lucide-react";

/** Placeholder para módulos del portal que aún están en construcción. */
export function ComingSoon({
  title,
  description,
  Icon,
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-ink-200 bg-white p-8 text-center sm:p-12">
      <span className="mx-auto inline-flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-8" />
      </span>
      <h1 className="mt-5 text-2xl font-black tracking-tight text-ink-900">
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
        {description}
      </p>
      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-warn/15 px-4 py-1.5 text-xs font-bold text-amber-700">
        <Hammer className="size-3.5" />
        Estamos construyendo este módulo
      </p>
      <div className="mt-8">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100"
        >
          <ArrowLeft className="size-4" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
