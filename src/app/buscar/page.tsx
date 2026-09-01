import { redirect } from "next/navigation";

// La búsqueda ahora vive dentro del catálogo (/productos?q=...), que incluye
// la barra de filtros, orden y paginación. Mantenemos /buscar como redirect
// para no romper enlaces antiguos.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const target = q?.trim()
    ? `/productos?q=${encodeURIComponent(q.trim())}`
    : "/productos";
  redirect(target);
}
