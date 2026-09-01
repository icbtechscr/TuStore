import { redirect } from "next/navigation";

// La garantía quedó unificada en la política de cambios y devoluciones.
export default function GarantiaPage() {
  redirect("/devoluciones");
}
