import "server-only";
import { createAdminClient } from "@/lib/supabase";
import type { AgentState } from "@/lib/agent-types";

export const AGENT_BUCKET = "agent-private";
export const AGENT_STATE_PATH = "state.json";

export function defaultAgentState(): AgentState {
  return {
    version: 1,
    revision: 0,
    settings: {
      connectionEnabled: false,
      autoReplyEnabled: false,
      testMode: true,
      testNumbers: [],
      agentName: "Agente TUStore",
      quoteRequiresApproval: true,
      invoiceRequiresApproval: true,
    },
    runtime: {
      status: "offline",
      qr: null,
      phone: null,
      lastHeartbeatAt: null,
      connectedAt: null,
      lastError: null,
      workerVersion: null,
    },
    activity: [],
    actions: [],
    metrics: {
      received: 0,
      sent: 0,
      actionsCreated: 0,
      lastMessageAt: null,
    },
    commands: {
      reconnectRevision: 0,
      resetSessionRevision: 0,
    },
  };
}

let bucketReady: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const sb = createAdminClient();
    const { data, error } = await sb.storage.listBuckets();
    if (error) throw error;
    if (!(data ?? []).some((bucket) => bucket.name === AGENT_BUCKET)) {
      const { error: createError } = await sb.storage.createBucket(AGENT_BUCKET, {
        public: false,
        fileSizeLimit: 2 * 1024 * 1024,
        allowedMimeTypes: ["application/json"],
      });
      if (createError && !/already exists/i.test(createError.message)) throw createError;
    }
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

function normalizeState(raw: Partial<AgentState> | null | undefined): AgentState {
  const defaults = defaultAgentState();
  return {
    ...defaults,
    ...(raw ?? {}),
    settings: { ...defaults.settings, ...(raw?.settings ?? {}) },
    runtime: { ...defaults.runtime, ...(raw?.runtime ?? {}) },
    metrics: { ...defaults.metrics, ...(raw?.metrics ?? {}) },
    commands: { ...defaults.commands, ...(raw?.commands ?? {}) },
    activity: Array.isArray(raw?.activity) ? raw.activity.slice(0, 200) : [],
    actions: Array.isArray(raw?.actions) ? raw.actions.slice(0, 200) : [],
  };
}

export async function readAgentState(): Promise<AgentState> {
  await ensureBucket();
  const sb = createAdminClient();
  const { data, error } = await sb.storage.from(AGENT_BUCKET).download(AGENT_STATE_PATH);
  if (error) {
    if (/not found|does not exist|object not found/i.test(error.message)) {
      const state = defaultAgentState();
      await writeAgentState(state);
      return state;
    }
    throw error;
  }
  try {
    return normalizeState(JSON.parse(await data.text()) as Partial<AgentState>);
  } catch {
    const state = defaultAgentState();
    await writeAgentState(state);
    return state;
  }
}

export async function writeAgentState(state: AgentState): Promise<AgentState> {
  await ensureBucket();
  const normalized = normalizeState(state);
  const sb = createAdminClient();
  const { error } = await sb.storage.from(AGENT_BUCKET).upload(
    AGENT_STATE_PATH,
    Buffer.from(JSON.stringify(normalized)),
    { contentType: "application/json", upsert: true, cacheControl: "0" }
  );
  if (error) throw error;
  return normalized;
}

export async function mutateAgentState(
  mutate: (state: AgentState) => void | AgentState
): Promise<AgentState> {
  const current = await readAgentState();
  const result = mutate(current) ?? current;
  result.revision += 1;
  result.activity = result.activity.slice(0, 200);
  result.actions = result.actions.slice(0, 200);
  return writeAgentState(result);
}


