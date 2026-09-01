import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  href,
  hrefLabel = "Ver todo",
  accent = "brand",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  accent?: "brand" | "danger" | "accent";
}) {
  const accentClass =
    accent === "danger"
      ? "text-danger"
      : accent === "accent"
        ? "text-accent-800"
        : "text-brand-600";

  return (
    <div className="mb-8 flex items-end justify-between gap-6">
      <div>
        {eyebrow && (
          <span className={`text-xs font-bold uppercase tracking-[0.2em] ${accentClass}`}>
            {eyebrow}
          </span>
        )}
        <h2 className="mt-1 text-2xl font-black tracking-tight text-ink-900 md:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {hrefLabel}
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      )}
    </div>
  );
}
