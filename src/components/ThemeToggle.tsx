"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ initialDark = false, tone = "light" }: { initialDark?: boolean; tone?: "light" | "dark" }) {
  const [dark, setDark] = useState(initialDark);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `site-theme=${
      next ? "dark" : "light"
    }; path=/; max-age=31536000; samesite=lax`;
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Activar modo claro" : "Activar modo noche"}
      title={dark ? "Modo claro" : "Modo noche"}
      className={`inline-flex size-10 items-center justify-center rounded-md border transition-colors ${tone === "dark" ? "border-white/30 text-white hover:bg-white/10" : "border-ink-200 text-ink-700 hover:bg-ink-50"}`}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
