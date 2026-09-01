import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, noimageindex: true },
};

// El control de acceso (sesión + rol admin) se aplica en proxy.ts.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dark = (await cookies()).get("admin-theme")?.value === "dark";
  return <AdminShell initialDark={dark}>{children}</AdminShell>;
}
