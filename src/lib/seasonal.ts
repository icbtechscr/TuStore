// Temporadas del sitio. Se calculan con la fecha de Costa Rica para que el
// adorno entre y salga el dia correcto sin importar donde corra el servidor.

function crParts(ref: Date): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref);
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/**
 * Mes de la Patria en Costa Rica: todo septiembre, alrededor de la celebracion
 * de la Independencia del 15 de septiembre. Se repite todos los anos sola.
 */
export function isPatrioticMonthSeason(ref: Date = new Date()): boolean {
  // Para ver el adorno fuera de fecha: SEASON_OVERRIDE=patriotic-month (o
  // "off" para apagarlo). "mothers-day" se conserva como alias temporal para
  // que una configuracion anterior de Vercel muestre de inmediato el adorno
  // nuevo en vez de desactivarlo.
  const override = (process.env.SEASON_OVERRIDE || "").trim().toLowerCase();
  if (["patriotic-month", "patria", "mothers-day"].includes(override)) return true;
  if (override === "off") return false;

  const { m } = crParts(ref);
  return m === 9;
}
