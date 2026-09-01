// Worker persistente de WhatsApp para el Agente ICB.
// La sesion de Baileys queda exclusivamente en .agent-auth (PC de ICB).
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    console.warn("No se encontro .env.local");
  }
}
loadEnv();

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SECRET_KEY || "";
const AGENT_SECRET = process.env.AGENT_WORKER_SECRET || "";
const AGENT_API_URL = (process.env.AGENT_API_URL || "https://www.icbtechscr.com").replace(/\/$/, "");
const BUCKET = "agent-private";
const STATE_PATH = "state.json";
const AUTH_PATH = fileURLToPath(new URL("../.agent-auth", import.meta.url));
const WORKER_VERSION = "icb-baileys/0.1.0";
const logger = pino({ level: process.env.AGENT_LOG_LEVEL || "silent" });
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const histories = new Map();
const processed = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function defaults() {
  return {
    version: 1,
    revision: 0,
    settings: {
      connectionEnabled: false,
      autoReplyEnabled: false,
      testMode: true,
      testNumbers: [],
      agentName: "Agente ICB",
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
      workerVersion: WORKER_VERSION,
    },
    activity: [],
    actions: [],
    metrics: { received: 0, sent: 0, actionsCreated: 0, lastMessageAt: null },
    commands: { reconnectRevision: 0, resetSessionRevision: 0 },
  };
}

function normalizeState(raw) {
  const base = defaults();
  return {
    ...base,
    ...(raw || {}),
    settings: { ...base.settings, ...(raw?.settings || {}) },
    runtime: { ...base.runtime, ...(raw?.runtime || {}) },
    metrics: { ...base.metrics, ...(raw?.metrics || {}) },
    commands: { ...base.commands, ...(raw?.commands || {}) },
    activity: Array.isArray(raw?.activity) ? raw.activity.slice(0, 200) : [],
    actions: Array.isArray(raw?.actions) ? raw.actions.slice(0, 200) : [],
  };
}

async function ensureBucket() {
  const { data, error } = await sb.storage.listBuckets();
  if (error) throw error;
  if (!(data || []).some((bucket) => bucket.name === BUCKET)) {
    const result = await sb.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ["application/json"],
    });
    if (result.error && !/already exists/i.test(result.error.message)) throw result.error;
  }
}

async function writeState(state) {
  const value = normalizeState(state);
  const { error } = await sb.storage.from(BUCKET).upload(
    STATE_PATH,
    Buffer.from(JSON.stringify(value)),
    { upsert: true, contentType: "application/json", cacheControl: "0" }
  );
  if (error) throw error;
  return value;
}

async function readState() {
  const { data, error } = await sb.storage.from(BUCKET).download(STATE_PATH);
  if (error) {
    if (/not found|does not exist|object not found/i.test(error.message)) {
      return writeState(defaults());
    }
    throw error;
  }
  return normalizeState(JSON.parse(await data.text()));
}

async function patchState(mutate) {
  const state = await readState();
  mutate(state);
  state.revision += 1;
  return writeState(state);
}

async function runtime(patch) {
  try {
    await patchState((state) => {
      state.runtime = {
        ...state.runtime,
        ...patch,
        workerVersion: WORKER_VERSION,
        lastHeartbeatAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error("No se pudo actualizar el estado:", error.message);
  }
}

function unwrapMessage(message) {
  let content = message || {};
  if (content.ephemeralMessage?.message) content = content.ephemeralMessage.message;
  if (content.viewOnceMessage?.message) content = content.viewOnceMessage.message;
  if (content.viewOnceMessageV2?.message) content = content.viewOnceMessageV2.message;
  return content;
}

function messageText(message) {
  const content = unwrapMessage(message);
  return String(
    content.conversation ||
      content.extendedTextMessage?.text ||
      content.imageMessage?.caption ||
      content.videoMessage?.caption ||
      content.documentMessage?.caption ||
      ""
  ).trim();
}

function phoneFromJid(jid) {
  return String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, "");
}

function remember(jid, role, content) {
  const current = histories.get(jid) || [];
  current.push({ role, content: String(content).slice(0, 2500) });
  histories.set(jid, current.slice(-10));
}

async function askAgent(input) {
  const response = await fetch(`${AGENT_API_URL}/api/agent/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": AGENT_SECRET,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(55_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`API agente ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function handleIncoming(sock, item) {
  const jid = item.key?.remoteJid || "";
  const messageId = item.key?.id || "";
  if (
    !jid.endsWith("@s.whatsapp.net") ||
    item.key?.fromMe ||
    !messageId ||
    processed.has(messageId)
  ) {
    return;
  }
  const text = messageText(item.message);
  if (!text) return;
  processed.add(messageId);
  if (processed.size > 1500) processed.delete(processed.values().next().value);

  const history = [...(histories.get(jid) || []), { role: "user", content: text }].slice(-10);
  remember(jid, "user", text);
  try {
    await sock.sendPresenceUpdate("composing", jid);
    const result = await askAgent({
      platformMessageId: messageId,
      remoteJid: jid,
      phone: phoneFromJid(jid),
      pushName: item.pushName || "Cliente",
      text,
      history,
    });
    if (result.reply) {
      await sock.sendMessage(jid, { text: String(result.reply) }, { quoted: item });
      remember(jid, "assistant", result.reply);
    }
  } catch (error) {
    console.error(`[${jid}]`, error.message);
    await runtime({ status: "error", lastError: error.message.slice(0, 500) });
  } finally {
    await sock.sendPresenceUpdate("paused", jid).catch(() => {});
  }
}

async function removeAuthState() {
  const normalized = AUTH_PATH.replace(/\\/g, "/").toLowerCase();
  const expected = fileURLToPath(new URL("../", import.meta.url)).replace(/\\/g, "/").toLowerCase();
  if (!normalized.startsWith(expected) || !normalized.endsWith("/.agent-auth")) {
    throw new Error("Ruta de sesion de WhatsApp no valida");
  }
  rmSync(AUTH_PATH, { recursive: true, force: true });
}

async function connectOnce(commandState) {
  const auth = await useMultiFileAuthState(AUTH_PATH);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: auth.state,
    logger,
    browser: Browsers.windows("ICB Technologies Costa Rica"),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });
  let closed = false;
  let resetRequested = false;
  let resolveClose;
  const closedPromise = new Promise((resolve) => (resolveClose = resolve));

  sock.ev.on("creds.update", auth.saveCreds);
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const item of messages) await handleIncoming(sock, item);
  });
  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      await runtime({ status: "waiting_qr", qr: update.qr, lastError: null });
    }
    if (update.connection === "open") {
      await runtime({
        status: "online",
        qr: null,
        phone: phoneFromJid(sock.user?.id || "") || null,
        connectedAt: new Date().toISOString(),
        lastError: null,
      });
      console.log("WhatsApp conectado:", sock.user?.id || "cuenta vinculada");
    }
    if (update.connection === "close" && !closed) {
      closed = true;
      const statusCode = update.lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      await runtime({
        status: loggedOut ? "logged_out" : "offline",
        qr: null,
        lastError: loggedOut
          ? "WhatsApp cerro la sesion. Genera un QR nuevo desde el panel."
          : null,
      });
      resolveClose({ loggedOut, resetRequested });
    }
  });

  const poll = setInterval(async () => {
    try {
      const state = await readState();
      await runtime({});
      if (state.commands.resetSessionRevision !== commandState.resetSessionRevision) {
        resetRequested = true;
        clearInterval(poll);
        sock.end(new Error("reset_session"));
      } else if (
        state.commands.reconnectRevision !== commandState.reconnectRevision ||
        !state.settings.connectionEnabled
      ) {
        clearInterval(poll);
        sock.end(new Error("reconnect_or_pause"));
      }
    } catch (error) {
      console.error("Error leyendo configuracion:", error.message);
    }
  }, 5000);

  const result = await closedPromise;
  clearInterval(poll);
  return result;
}

async function main() {
  if (!SB_URL || !SB_KEY || !AGENT_SECRET) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY o AGENT_WORKER_SECRET"
    );
  }
  await ensureBucket();
  console.log(`${WORKER_VERSION} iniciado. API: ${AGENT_API_URL}`);

  let resetSeen = -1;
  for (;;) {
    const state = await readState();
    if (resetSeen < 0) resetSeen = state.commands.resetSessionRevision;
    if (state.commands.resetSessionRevision !== resetSeen) {
      await removeAuthState();
      resetSeen = state.commands.resetSessionRevision;
      console.log("Sesion local eliminada por orden del panel.");
    }
    if (!state.settings.connectionEnabled) {
      await runtime({ status: "paused", qr: null, lastError: null });
      await sleep(5000);
      continue;
    }
    await runtime({ status: "connecting", qr: null, lastError: null });
    try {
      const result = await connectOnce(state.commands);
      if (result.resetRequested) {
        await removeAuthState();
        resetSeen = (await readState()).commands.resetSessionRevision;
      }
      if (result.loggedOut && !result.resetRequested) await sleep(10_000);
      else await sleep(2000);
    } catch (error) {
      console.error("Conexion WhatsApp:", error.message);
      await runtime({ status: "error", qr: null, lastError: error.message.slice(0, 500) });
      await sleep(10_000);
    }
  }
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

main().catch(async (error) => {
  console.error("ERROR:", error.message);
  await runtime({ status: "error", lastError: error.message.slice(0, 500) });
  process.exitCode = 1;
});

