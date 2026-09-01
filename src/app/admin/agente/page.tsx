import { Bot } from "lucide-react";
import * as QRCode from "qrcode";
import { AgentDashboard } from "@/components/admin/AgentDashboard";
import { readAgentState } from "@/lib/agent-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agente de WhatsApp - TUStore Admin" };

export default async function AgentPage() {
  const state = await readAgentState();
  const qrDataUrl = state.runtime.qr
    ? await QRCode.toDataURL(state.runtime.qr, { width: 320, margin: 1 })
    : null;
  return (
    <div>
      <div className="mb-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
          <Bot className="size-6 text-brand-600" /> Agente de WhatsApp
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Vendedor virtual conectado al cat\u00e1logo de TUStore y con acciones supervisadas para CPI.
        </p>
      </div>
      <AgentDashboard initial={{ ...state, qrDataUrl }} />
    </div>
  );
}


