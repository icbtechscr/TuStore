import { NextResponse } from "next/server";
import * as QRCode from "qrcode";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, isAdminLike } from "@/lib/roles";
import { readAgentState, mutateAgentState } from "@/lib/agent-store";
import type { AgentActionStatus } from "@/lib/agent-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function allowed(): Promise<boolean> {
  const user = await getCurrentUser();
  return Boolean(user && isAdminLike(getUserRole(user)));
}

async function snapshot() {
  const state = await readAgentState();
  const qrDataUrl = state.runtime.qr
    ? await QRCode.toDataURL(state.runtime.qr, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "M",
      })
    : null;
  return { ...state, qrDataUrl };
}

export async function GET() {
  if (!(await allowed())) return new NextResponse("No autorizado", { status: 401 });
  try {
    return NextResponse.json(await snapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new NextResponse(message, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await allowed())) return new NextResponse("No autorizado", { status: 401 });
  try {
    const body = (await req.json()) as {
      settings?: Record<string, unknown>;
      command?: "reconnect" | "reset_session";
      actionId?: string;
      actionStatus?: AgentActionStatus;
    };
    await mutateAgentState((state) => {
      if (body.settings) {
        const source = body.settings;
        if (typeof source.connectionEnabled === "boolean") {
          state.settings.connectionEnabled = source.connectionEnabled;
        }
        if (typeof source.autoReplyEnabled === "boolean") {
          state.settings.autoReplyEnabled = source.autoReplyEnabled;
        }
        if (typeof source.testMode === "boolean") {
          state.settings.testMode = source.testMode;
        }
        if (typeof source.agentName === "string") {
          state.settings.agentName = source.agentName.trim().slice(0, 80) || "Agente TUStore";
        }
        if (Array.isArray(source.testNumbers)) {
          state.settings.testNumbers = [
            ...new Set(
              source.testNumbers
                .map((value) => String(value).replace(/\D/g, ""))
                .filter(Boolean)
            ),
          ].slice(0, 30);
        }
      }
      if (body.command === "reconnect") state.commands.reconnectRevision += 1;
      if (body.command === "reset_session") {
        state.commands.resetSessionRevision += 1;
        state.runtime = {
          ...state.runtime,
          status: "offline",
          qr: null,
          phone: null,
          connectedAt: null,
          lastError: null,
        };
      }
      if (
        body.actionId &&
        (body.actionStatus === "approved" || body.actionStatus === "rejected")
      ) {
        const action = state.actions.find((item) => item.id === body.actionId);
        if (action && action.status === "pending") {
          action.status = body.actionStatus;
          action.updatedAt = new Date().toISOString();
        }
      }
    });
    return NextResponse.json(await snapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new NextResponse(message, { status: 500 });
  }
}


