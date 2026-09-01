import { redirect } from "next/navigation";

// La asignación de vendedores se movió a Configuración.
export default function VentasVendedoresRedirect() {
  redirect("/admin/ajustes");
}
