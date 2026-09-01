import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole } from "@/lib/roles";
import { IngresarForm } from "@/components/IngresarForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function IngresarPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(getUserRole(user) === "admin" ? "/admin" : "/portal");
  }
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-white px-4 py-16">
      <IngresarForm />
    </div>
  );
}
