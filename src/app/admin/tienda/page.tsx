import { redirect } from "next/navigation";

// La edición de la página de inicio se movió a Configuración.
export default function AdminTiendaRedirect() {
  redirect("/admin/ajustes");
}
