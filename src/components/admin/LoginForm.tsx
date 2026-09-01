"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const sb = createSupabaseBrowser();
      const { error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : error.message
        );
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-accent-400/10 to-brand-500/10 blur-2xl" />
      <form
        onSubmit={onSubmit}
        className="rounded-[2rem] border border-ink-200 bg-white p-8 shadow-xl"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-accent-100 ring-1 ring-accent-200">
            <ShieldCheck className="size-7 text-accent-700" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">TUStore Admin</h1>
          <p className="mt-1 text-sm text-ink-500">
            Ingresá tus credenciales para continuar.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-600">
            Correo
          </span>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@tustorecr.com"
              className="w-full rounded-xl border border-ink-200 bg-white py-3 pl-11 pr-4 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500"
            />
          </div>
        </label>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-600">
            Contraseña
          </span>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-ink-200 bg-white py-3 pl-11 pr-4 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500"
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900 shadow-lg shadow-accent-500/30 transition hover:bg-accent-400 disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Entrar
        </button>
      </form>
    </div>
  );
}

