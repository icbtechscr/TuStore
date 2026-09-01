export type AgentConnectionStatus =
  | "offline"
  | "paused"
  | "connecting"
  | "waiting_qr"
  | "online"
  | "logged_out"
  | "error";

export type AgentSettings = {
  connectionEnabled: boolean;
  autoReplyEnabled: boolean;
  testMode: boolean;
  testNumbers: string[];
  agentName: string;
  quoteRequiresApproval: boolean;
  invoiceRequiresApproval: boolean;
};

export type AgentRuntime = {
  status: AgentConnectionStatus;
  qr: string | null;
  phone: string | null;
  lastHeartbeatAt: string | null;
  connectedAt: string | null;
  lastError: string | null;
  workerVersion: string | null;
};

export type AgentActivity = {
  id: string;
  at: string;
  direction: "in" | "out" | "system";
  phone: string;
  name: string;
  preview: string;
  kind: "message" | "action" | "status";
};

export type AgentActionType = "quote" | "invoice" | "handoff";
export type AgentActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "completed"
  | "failed";

export type AgentAction = {
  id: string;
  type: AgentActionType;
  status: AgentActionStatus;
  phone: string;
  customerName: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  result?: Record<string, unknown> | null;
};

export type AgentMetrics = {
  received: number;
  sent: number;
  actionsCreated: number;
  lastMessageAt: string | null;
};

export type AgentState = {
  version: 1;
  revision: number;
  settings: AgentSettings;
  runtime: AgentRuntime;
  activity: AgentActivity[];
  actions: AgentAction[];
  metrics: AgentMetrics;
  commands: {
    reconnectRevision: number;
    resetSessionRevision: number;
  };
};

export type AgentAdminSnapshot = AgentState & {
  qrDataUrl: string | null;
};

