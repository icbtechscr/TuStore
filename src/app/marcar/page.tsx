import { redirect } from "next/navigation";

// Ruta legada: el marcaje vive ahora en el Portal del Colaborador.
// Se mantiene porque PWAs instaladas y notificaciones push apuntan aquí.
export default function MarcarLegacyPage() {
  redirect("/portal/marcar");
}
