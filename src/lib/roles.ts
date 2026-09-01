import { rewriteMediaUrl } from "./image-url";

// Rol y sedes de cada usuario viven en auth.users.user_metadata.
// Roles:
//   - admin: acceso al panel, NO marca.
//   - colaborador: solo marca hora.
//   - dev: acceso a todo (como admin) Y marca hora.
// Los usuarios sin `role` se tratan como 'admin' (compatibilidad).

export type UserRole = "admin" | "colaborador" | "dev";

type MetadataCarrier = {
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

export function getUserRole(user: MetadataCarrier | null | undefined): UserRole {
  const raw =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined);
  if (raw === "colaborador") return "colaborador";
  if (raw === "dev") return "dev";
  return "admin";
}

/** ¿Tiene acceso al panel admin? (admin o dev) */
export function isAdminLike(role: UserRole): boolean {
  return role === "admin" || role === "dev";
}

/** ¿Debe marcar hora? (colaborador o dev) */
export function mustClockIn(role: UserRole): boolean {
  return role === "colaborador" || role === "dev";
}

/** ¿Puede usar el panel de vendedor (publicar productos en Facebook)?
 *  Por ahora: colaboradores, devs y admins. */
export function canSell(role: UserRole): boolean {
  return role === "colaborador" || role === "dev" || role === "admin";
}

/** Sedes asignadas. Soporta `branch_ids` (array) y `branch_id` (legacy). */
export function getUserBranchIds(
  user: MetadataCarrier | null | undefined
): string[] {
  const arr = user?.user_metadata?.branch_ids;
  if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
  const single = user?.user_metadata?.branch_id as string | undefined;
  return single ? [single] : [];
}

/** Primera sede asignada (compatibilidad con código que espera una). */
export function getUserBranchId(
  user: MetadataCarrier | null | undefined
): string | null {
  return getUserBranchIds(user)[0] ?? null;
}

export function getUserFullName(
  user: (MetadataCarrier & { email?: string | null }) | null | undefined
): string {
  const full = user?.user_metadata?.full_name as string | undefined;
  return full || user?.email?.split("@")[0] || "";
}

/** URL de la foto de perfil del colaborador (si subió una). */
export function getUserAvatar(
  user: MetadataCarrier | null | undefined
): string | null {
  const url =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.avatar as string | undefined);
  return typeof url === "string" && url.length > 0 ? rewriteMediaUrl(url) : null;
}

/** Etiqueta legible del rol para mostrar en la interfaz. */
export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
  dev: "Desarrollador",
};

/** Iniciales para el avatar cuando no hay foto. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
