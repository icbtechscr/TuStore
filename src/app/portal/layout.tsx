import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/supabase-server";
import {
  getUserRole,
  getUserFullName,
  getUserAvatar,
  getInitials,
} from "@/lib/roles";
import { PortalShell } from "@/components/portal/PortalShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Portal del colaborador — TUStore Costa Rica",
    template: "%s — Portal TUStore",
  },
  robots: { index: false, follow: false, noarchive: true, noimageindex: true },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const dark = (await cookies()).get("site-theme")?.value === "dark";
  const name = getUserFullName(user);

  return (
    <PortalShell
      name={name}
      role={getUserRole(user)}
      avatarUrl={getUserAvatar(user)}
      initials={getInitials(name)}
      initialDark={dark}
    >
      {children}
    </PortalShell>
  );
}

