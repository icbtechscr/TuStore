"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content:
    "¡Hola! 👋 Soy el asistente virtual de TUStore Costa Rica. Puedo ayudarte con productos, precios, entregas y más. ¿En qué te ayudo?",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll al último mensaje.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Enfocar el campo al abrir.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Enviamos el historial sin el mensaje de bienvenida local.
        body: JSON.stringify({
          messages: next.filter((m) => m !== WELCOME),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || "No se pudo responder.");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Ocurrió un error. Intentá de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente virtual"}
        className="fixed bottom-5 right-5 z-[60] flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/30 transition hover:bg-brand-700 active:scale-95"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-7" />}
      </button>

      {/* Panel de chat */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[60] flex h-[min(70vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl">
          {/* Encabezado */}
          <div className="flex items-center gap-3 bg-brand-600 px-4 py-3 text-white">
            <div className="flex size-9 items-center justify-center rounded-full bg-white/15">
              <Bot className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Asistente TUStore Costa Rica</p>
              <p className="flex items-center gap-1 text-[11px] text-white/80">
                <span className="size-1.5 rounded-full bg-accent-400" />
                En línea
              </p>
            </div>
          </div>

          {/* Mensajes */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-ink-50 px-3 py-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-brand-600 text-white"
                      : "rounded-bl-sm border border-ink-200 bg-white text-ink-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-500">
                  <Loader2 className="size-4 animate-spin" />
                  Escribiendo…
                </div>
              </div>
            )}
            {error && (
              <p className="px-1 text-center text-xs text-red-500">{error}</p>
            )}
          </div>

          {/* Entrada */}
          <div className="flex items-center gap-2 border-t border-ink-200 bg-white p-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escribí tu mensaje…"
              disabled={loading}
              className="min-w-0 flex-1 rounded-full border border-ink-200 bg-ink-50 px-4 py-2 text-sm text-ink-800 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:bg-white disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Enviar mensaje"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              <Send className="size-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
