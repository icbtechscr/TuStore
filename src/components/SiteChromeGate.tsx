"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SiteChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  // Sin chrome de tienda en el panel admin ni en el portal del colaborador.
  if (pathname.startsWith("/admin") || pathname.startsWith("/portal"))
    return null;
  return <>{children}</>;
}
