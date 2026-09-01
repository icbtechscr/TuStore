"use client";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  { id: 1, label: "Envío" },
  { id: 2, label: "Pago" },
  { id: 3, label: "Confirmación" },
];

export function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mx-auto flex max-w-2xl items-center justify-between gap-2 rounded-full border border-ink-200 bg-white p-2 shadow-sm">
      {STEPS.map((s, i) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <div className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full">
              {active && (
                <motion.span
                  layoutId="step-pill"
                  className="absolute inset-0 rounded-full bg-accent-500 shadow-lg shadow-accent-500/40"
                />
              )}
              <span
                className={`relative z-10 inline-flex size-9 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "text-ink-900"
                      : "bg-ink-100 text-ink-400"
                }`}
              >
                {done ? <Check className="size-4" /> : s.id}
              </span>
            </div>
            <span
              className={`hidden text-xs font-bold uppercase tracking-wider sm:inline ${
                done || active ? "text-ink-900" : "text-ink-400"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-1 h-px flex-1 ${done ? "bg-emerald-400" : "bg-ink-200"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
