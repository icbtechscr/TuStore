import type { CSSProperties } from "react";

// Adorno del Mes de la Patria inspirado en la bandera de Costa Rica. Todas las
// piezas son decorativas, no interceptan clics y se construyen con CSS para no
// agregar imágenes ni solicitudes extra.

function CostaRicaFlag({
  width,
  className,
  style,
}: {
  width: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 flex-col overflow-hidden rounded-[2px] shadow-md ring-1 ring-black/15 ${className ?? ""}`}
      style={{ width, aspectRatio: "5 / 3", ...style }}
    >
      <span className="flex-1 bg-[#002b7f]" />
      <span className="flex-1 bg-white" />
      <span className="flex-[2] bg-[#ce1126]" />
      <span className="flex-1 bg-white" />
      <span className="flex-1 bg-[#002b7f]" />
    </span>
  );
}

/** Franja delgada sobre el encabezado con el saludo de la temporada. */
export function PatrioticMonthBar() {
  return (
    <div
      className="w-full border-b border-[#002b7f]/20 dark:border-white/15"
      style={{
        background:
          "linear-gradient(90deg, rgba(0,43,127,0.16) 0%, rgba(255,255,255,0.96) 35%, rgba(255,255,255,0.96) 65%, rgba(206,17,38,0.16) 100%)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5 px-3 py-1.5 sm:px-4">
        <CostaRicaFlag width={26} style={{ transform: "rotate(-5deg)" }} />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#002b7f] sm:text-xs dark:text-blue-200">
          Mes de la Patria
        </span>
        <CostaRicaFlag width={26} style={{ transform: "rotate(5deg)" }} />
      </div>
    </div>
  );
}

/** Banderas suaves en el fondo de la parte superior de la página. */
export function PatrioticMonthPageDecor() {
  const soft = "opacity-[0.32] dark:opacity-[0.22]";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[145vh] select-none overflow-hidden"
    >
      <CostaRicaFlag
        width={136}
        className={`absolute -left-9 top-[27vh] ${soft}`}
        style={{ transform: "rotate(-12deg)" }}
      />
      <CostaRicaFlag
        width={92}
        className={`absolute right-[4vw] top-[45vh] hidden sm:inline-flex ${soft}`}
        style={{ transform: "rotate(9deg)" }}
      />
      <CostaRicaFlag
        width={68}
        className={`absolute left-[14vw] top-[78vh] hidden md:inline-flex ${soft}`}
        style={{ transform: "rotate(7deg)" }}
      />
      <CostaRicaFlag
        width={72}
        className={`absolute right-[9vw] top-[68vh] ${soft}`}
        style={{ transform: "rotate(-8deg)" }}
      />
      <CostaRicaFlag
        width={118}
        className={`absolute -right-8 top-[98vh] ${soft}`}
        style={{ transform: "rotate(-11deg)" }}
      />
      <CostaRicaFlag
        width={82}
        className={`absolute left-[38vw] top-[116vh] hidden lg:inline-flex ${soft}`}
        style={{ transform: "rotate(8deg)" }}
      />
    </div>
  );
}

/** Detalle patriótico dentro del encabezado principal. */
export function PatrioticMonthDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, rgba(0,43,127,0.13) 0%, rgba(0,43,127,0) 40%, rgba(206,17,38,0) 62%, rgba(206,17,38,0.13) 100%)",
        }}
      />

      <CostaRicaFlag
        width={86}
        className="absolute -left-5 -top-4 opacity-45 dark:opacity-30"
        style={{ transform: "rotate(-13deg)" }}
      />
      <CostaRicaFlag
        width={54}
        className="absolute left-16 top-8 hidden opacity-35 sm:inline-flex dark:opacity-25"
        style={{ transform: "rotate(7deg)" }}
      />
      <CostaRicaFlag
        width={98}
        className="absolute -bottom-5 -right-6 opacity-40 dark:opacity-25"
        style={{ transform: "rotate(12deg)" }}
      />
      <CostaRicaFlag
        width={56}
        className="absolute bottom-8 right-20 hidden opacity-35 sm:inline-flex dark:opacity-25"
        style={{ transform: "rotate(-7deg)" }}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,43,127,0) 0%, rgba(0,43,127,0.5) 25%, rgba(206,17,38,0.5) 75%, rgba(206,17,38,0) 100%)",
        }}
      />
    </div>
  );
}
