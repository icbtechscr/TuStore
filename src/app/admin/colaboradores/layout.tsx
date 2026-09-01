"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, History } from "lucide-react";

const SUBTABS = [
  { href: "/admin/colaboradores/horario", label: "Control de horario", Icon: Clock },
  { href: "/admin/colaboradores/historial", label: "Historial", Icon: History },
];

export default function ColaboradoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-ink-900">
          Control de horario
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Marcajes de entrada, almuerzo y salida de los colaboradores.
        </p>
      </div>

      <div className="mb-6 inline-flex rounded-full border border-ink-200 bg-white p-1">
        {SUBTABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-brand-600 text-white"
                  : "text-ink-600 hover:text-brand-600"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
