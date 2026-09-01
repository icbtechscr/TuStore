"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export function AuthButton({
  initialAuthed = false,
  full = false,
  onNavigate,
  tone = "light",
}: {
  initialAuthed?: boolean;
  full?: boolean;
  onNavigate?: () => void;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const [authed, setAuthed] = useState(initialAuthed);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return;
    }
    const sb = createSupabaseBrowser();
    let active = true;
    sb.auth.getUser().then(({ data }) => {
      if (active) setAuthed(!!data.user);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) =>
      setAuthed(!!session?.user)
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    setLoading(true);
    await createSupabaseBrowser().auth.signOut();
    setAuthed(false);
    onNavigate?.();
    router.push("/");
    router.refresh();
    setLoading(false);
  }

  if (authed) {
    const chrome = tone === "dark";
    const cls = full
      ? `flex w-full items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-semibold transition-colors ${chrome ? "border-white/30 text-white hover:bg-white/10" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`
      : `inline-flex h-10 items-center gap-2 rounded-md border px-2.5 text-sm font-semibold transition-colors sm:px-3 ${chrome ? "border-white/30 text-white hover:bg-white/10" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`;
    return (
      <button
        type="button"
        onClick={logout}
        disabled={loading}
        aria-label="Cerrar sesión"
        className={cls}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        <span className={full ? "" : "hidden sm:inline"}>Cerrar sesión</span>
      </button>
    );
  }

  const cls = full
    ? "flex w-full items-center justify-center gap-2 rounded-md bg-accent-500 px-4 py-3 text-sm font-bold text-ink-900 transition-colors hover:bg-accent-400"
    : `inline-flex h-10 items-center gap-2 rounded-md border px-2.5 text-sm font-semibold transition-colors sm:px-3 ${tone === "dark" ? "border-white/30 text-white hover:bg-white/10" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`;
  return (
    <Link
      href="/ingresar"
      onClick={onNavigate}
      aria-label="Iniciar sesión"
      className={cls}
    >
      <LogIn className="size-4" />
      <span className={full ? "" : "hidden sm:inline"}>Iniciar sesión</span>
    </Link>
  );
}
