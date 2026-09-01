import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">
            Inicio
          </Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">{title}</span>
        </nav>

        <h1 className="text-4xl font-black tracking-tight text-ink-900 md:text-5xl">
          {title}
        </h1>
        {intro && (
          <p className="mt-3 text-sm leading-relaxed text-ink-600">{intro}</p>
        )}
        {updated && (
          <p className="mt-2 text-xs text-ink-400">
            Última actualización: {updated}
          </p>
        )}

        <div className="legal-prose mt-10 space-y-6 rounded-3xl border border-ink-200 bg-white p-6 shadow-sm md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink-900">{heading}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-600">
        {children}
      </div>
    </section>
  );
}
