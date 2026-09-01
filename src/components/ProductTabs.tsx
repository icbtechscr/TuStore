"use client";
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Tab = { id: string; label: string; content: ReactNode };

export function ProductTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  if (tabs.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white text-ink-900 shadow-sm">
      <div className="flex flex-wrap gap-1 border-b border-ink-200 bg-ink-50 p-2">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`relative rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? "text-white" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute inset-0 -z-0 rounded-full bg-brand-600 shadow-lg shadow-brand-600/40"
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>
      <div className="p-6 md:p-8">
        <AnimatePresence mode="wait">
          {tabs.map(
            (t) =>
              t.id === active && (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {t.content}
                </motion.div>
              )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
