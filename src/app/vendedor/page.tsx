import { redirect } from "next/navigation";

// Ruta legada: la venta en Facebook vive ahora en el Portal del Colaborador.
export default function VendedorLegacyPage() {
  redirect("/portal/vender");
}
