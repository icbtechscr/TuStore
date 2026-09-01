"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";

export function ProductRowActions({
  id,
  slug,
  name,
}: {
  id: string;
  slug: string;
  name: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    if (!confirm(`¿Eliminar "${name}"?\n\nEsta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        alert(`Error: ${txt}`);
        return;
      }
      router.refresh();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Link
        href={`/productos/${slug}`}
        target="_blank"
        className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-brand-600"
        aria-label="Ver en sitio"
        title="Ver en sitio"
      >
        <ExternalLink className="size-4" />
      </Link>
      <Link
        href={`/admin/productos/${id}`}
        className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-600"
        aria-label="Editar"
        title="Editar"
      >
        <Pencil className="size-4" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        aria-label="Eliminar"
        title="Eliminar"
      >
        {deleting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </button>
    </div>
  );
}
