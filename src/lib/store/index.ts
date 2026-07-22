import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type {
  Bot,
  Conversation,
  CustomTool,
  Database,
  Integration,
  McpServer,
  Message,
  Sentiment,
  Tenant,
  Ticket,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// File-backed development store.
//
// This is intentionally a thin, swappable persistence layer. The repository
// functions below are the only surface the rest of the app touches, so moving
// to Postgres/Prisma later means reimplementing this file alone.
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB: Database = {
  tenants: [],
  bots: [],
  conversations: [],
  messages: [],
  tickets: [],
  customTools: [],
  mcpServers: [],
  integrations: [],
};

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

export function readDb(): Database {
  ensureFile();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return {
      tenants: parsed.tenants ?? [],
      bots: parsed.bots ?? [],
      conversations: parsed.conversations ?? [],
      messages: parsed.messages ?? [],
      tickets: parsed.tickets ?? [],
      customTools: parsed.customTools ?? [],
      mcpServers: parsed.mcpServers ?? [],
      integrations: parsed.integrations ?? [],
    };
  } catch {
    return { ...EMPTY_DB };
  }
}

export function writeDb(db: Database): void {
  ensureFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

const now = () => new Date().toISOString();
const newId = () => randomUUID();

// --- Tenants ---------------------------------------------------------------

export function listTenants(): Tenant[] {
  return readDb().tenants;
}

export function getTenant(id: string): Tenant | undefined {
  return readDb().tenants.find((t) => t.id === id);
}

export function createTenant(data: { name: string }): Tenant {
  const db = readDb();
  const tenant: Tenant = { id: newId(), name: data.name, createdAt: now() };
  db.tenants.push(tenant);
  writeDb(db);
  return tenant;
}

/** Returns the first tenant, creating a default one if none exists. */
export function defaultTenant(): Tenant {
  const db = readDb();
  if (db.tenants[0]) return db.tenants[0];
  return createTenant({ name: "Default Workspace" });
}

// --- Bots ------------------------------------------------------------------

export type NewBot = Omit<Bot, "id" | "createdAt" | "updatedAt">;

export function listBots(tenantId?: string): Bot[] {
  const bots = readDb().bots;
  return (tenantId ? bots.filter((b) => b.tenantId === tenantId) : bots).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getBot(id: string): Bot | undefined {
  return readDb().bots.find((b) => b.id === id);
}

export function createBot(data: NewBot): Bot {
  const db = readDb();
  const ts = now();
  const bot: Bot = { ...data, id: newId(), createdAt: ts, updatedAt: ts };
  db.bots.push(bot);
  writeDb(db);
  return bot;
}

export function updateBot(
  id: string,
  patch: Partial<NewBot>,
): Bot | undefined {
  const db = readDb();
  const idx = db.bots.findIndex((b) => b.id === id);
  if (idx === -1) return undefined;
  db.bots[idx] = { ...db.bots[idx], ...patch, updatedAt: now() };
  writeDb(db);
  return db.bots[idx];
}

export function deleteBot(id: string): boolean {
  const db = readDb();
  const before = db.bots.length;
  db.bots = db.bots.filter((b) => b.id !== id);
  const convoIds = new Set(
    db.conversations.filter((c) => c.botId === id).map((c) => c.id),
  );
  db.conversations = db.conversations.filter((c) => c.botId !== id);
  db.messages = db.messages.filter((m) => !convoIds.has(m.conversationId));
  writeDb(db);
  return db.bots.length < before;
}

// --- Conversations ---------------------------------------------------------

export function listConversations(filter?: {
  botId?: string;
  tenantId?: string;
}): Conversation[] {
  let convos = readDb().conversations;
  if (filter?.botId) convos = convos.filter((c) => c.botId === filter.botId);
  if (filter?.tenantId)
    convos = convos.filter((c) => c.tenantId === filter.tenantId);
  return convos.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function getConversation(id: string): Conversation | undefined {
  return readDb().conversations.find((c) => c.id === id);
}

export function createConversation(data: {
  botId: string;
  tenantId: string;
  channel: Conversation["channel"];
  endUserName?: string;
}): Conversation {
  const db = readDb();
  const ts = now();
  const convo: Conversation = {
    id: newId(),
    botId: data.botId,
    tenantId: data.tenantId,
    channel: data.channel,
    endUserName: data.endUserName,
    status: "open",
    createdAt: ts,
    updatedAt: ts,
    lastMessageAt: ts,
  };
  db.conversations.push(convo);
  writeDb(db);
  return convo;
}

export function updateConversation(
  id: string,
  patch: Partial<Pick<Conversation, "status" | "endUserName">>,
): Conversation | undefined {
  const db = readDb();
  const idx = db.conversations.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  db.conversations[idx] = {
    ...db.conversations[idx],
    ...patch,
    updatedAt: now(),
  };
  writeDb(db);
  return db.conversations[idx];
}

// --- Messages --------------------------------------------------------------

export function listMessages(conversationId: string): Message[] {
  return readDb()
    .messages.filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type NewMessage = Omit<Message, "id" | "createdAt">;

export function addMessage(data: NewMessage): Message {
  const db = readDb();
  const ts = now();
  const message: Message = { ...data, id: newId(), createdAt: ts };
  db.messages.push(message);
  const convo = db.conversations.find((c) => c.id === data.conversationId);
  if (convo) {
    convo.lastMessageAt = ts;
    convo.updatedAt = ts;
  }
  writeDb(db);
  return message;
}

// --- Tickets ---------------------------------------------------------------

export function createTicket(data: {
  tenantId: string;
  botId?: string;
  conversationId?: string;
  summary: string;
}): Ticket {
  const db = readDb();
  const ticket: Ticket = {
    id: newId().slice(0, 8).toUpperCase(),
    tenantId: data.tenantId,
    botId: data.botId,
    conversationId: data.conversationId,
    summary: data.summary,
    status: "open",
    createdAt: now(),
  };
  db.tickets.push(ticket);
  writeDb(db);
  return ticket;
}

export function listTickets(tenantId?: string): Ticket[] {
  const tickets = readDb().tickets;
  return tenantId ? tickets.filter((t) => t.tenantId === tenantId) : tickets;
}

// --- Custom (user-defined HTTP) tools --------------------------------------

export type NewCustomTool = Omit<CustomTool, "id" | "createdAt">;

export function listCustomTools(tenantId?: string): CustomTool[] {
  const tools = readDb().customTools;
  return tenantId ? tools.filter((t) => t.tenantId === tenantId) : tools;
}

export function getCustomTool(id: string): CustomTool | undefined {
  return readDb().customTools.find((t) => t.id === id);
}

export function createCustomTool(data: NewCustomTool): CustomTool {
  const db = readDb();
  const tool: CustomTool = { ...data, id: newId(), createdAt: now() };
  db.customTools.push(tool);
  writeDb(db);
  return tool;
}

export function deleteCustomTool(id: string): boolean {
  const db = readDb();
  const before = db.customTools.length;
  db.customTools = db.customTools.filter((t) => t.id !== id);
  writeDb(db);
  return db.customTools.length < before;
}

// --- MCP servers -----------------------------------------------------------

export type NewMcpServer = Omit<McpServer, "id" | "createdAt">;

export function listMcpServers(tenantId?: string): McpServer[] {
  const servers = readDb().mcpServers;
  return tenantId ? servers.filter((s) => s.tenantId === tenantId) : servers;
}

export function getMcpServer(id: string): McpServer | undefined {
  return readDb().mcpServers.find((s) => s.id === id);
}

export function createMcpServer(data: NewMcpServer): McpServer {
  const db = readDb();
  const server: McpServer = { ...data, id: newId(), createdAt: now() };
  db.mcpServers.push(server);
  writeDb(db);
  return server;
}

export function deleteMcpServer(id: string): boolean {
  const db = readDb();
  const before = db.mcpServers.length;
  db.mcpServers = db.mcpServers.filter((s) => s.id !== id);
  for (const bot of db.bots) {
    if (bot.mcpServers?.includes(id)) {
      bot.mcpServers = bot.mcpServers.filter((x) => x !== id);
    }
  }
  writeDb(db);
  return db.mcpServers.length < before;
}

// --- Integrations ----------------------------------------------------------

export type NewIntegration = Omit<Integration, "id" | "createdAt">;

export function listIntegrations(tenantId?: string): Integration[] {
  const items = readDb().integrations;
  return tenantId ? items.filter((i) => i.tenantId === tenantId) : items;
}

export function getIntegration(id: string): Integration | undefined {
  return readDb().integrations.find((i) => i.id === id);
}

export function createIntegration(data: NewIntegration): Integration {
  const db = readDb();
  const integration: Integration = { ...data, id: newId(), createdAt: now() };
  db.integrations.push(integration);
  writeDb(db);
  return integration;
}

export function deleteIntegration(id: string): boolean {
  const db = readDb();
  const before = db.integrations.length;
  db.integrations = db.integrations.filter((i) => i.id !== id);
  writeDb(db);
  return db.integrations.length < before;
}

// --- Stats -----------------------------------------------------------------

export interface DashboardStats {
  bots: number;
  activeBots: number;
  conversations: number;
  messages: number;
  sentiment: Record<Sentiment, number>;
  byChannel: { channel: string; count: number }[];
}

export function stats(tenantId?: string): DashboardStats {
  const db = readDb();
  const bots = tenantId
    ? db.bots.filter((b) => b.tenantId === tenantId)
    : db.bots;
  const convos = tenantId
    ? db.conversations.filter((c) => c.tenantId === tenantId)
    : db.conversations;
  const convoIds = new Set(convos.map((c) => c.id));
  const msgs = db.messages.filter((m) => convoIds.has(m.conversationId));

  const sentiment: Record<Sentiment, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  for (const m of msgs) {
    if (m.role === "user" && m.sentiment) sentiment[m.sentiment]++;
  }

  const channelMap = new Map<string, number>();
  for (const c of convos) {
    channelMap.set(c.channel, (channelMap.get(c.channel) ?? 0) + 1);
  }

  return {
    bots: bots.length,
    activeBots: bots.filter((b) => b.status === "active").length,
    conversations: convos.length,
    messages: msgs.length,
    sentiment,
    byChannel: [...channelMap.entries()].map(([channel, count]) => ({
      channel,
      count,
    })),
  };
}

export interface AnalyticsData {
  totals: {
    conversations: number;
    messages: number;
    bots: number;
    tickets: number;
  };
  sentiment: Record<Sentiment, number>;
  byDay: { date: string; conversations: number; messages: number }[];
  toolUsage: { name: string; count: number }[];
  dialects: { dialect: string; count: number }[];
  handoffRate: number;
  avgLatencyMs: number;
  avgMessagesPerConversation: number;
  topBots: { name: string; conversations: number }[];
}

export function analytics(tenantId?: string): AnalyticsData {
  const db = readDb();
  const bots = tenantId ? db.bots.filter((b) => b.tenantId === tenantId) : db.bots;
  const convos = tenantId
    ? db.conversations.filter((c) => c.tenantId === tenantId)
    : db.conversations;
  const convoIds = new Set(convos.map((c) => c.id));
  const msgs = db.messages.filter((m) => convoIds.has(m.conversationId));
  const tickets = tenantId
    ? db.tickets.filter((t) => t.tenantId === tenantId)
    : db.tickets;

  const sentiment: Record<Sentiment, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  const dialectMap = new Map<string, number>();
  const toolMap = new Map<string, number>();
  let latencySum = 0;
  let latencyN = 0;

  for (const m of msgs) {
    if (m.role === "user") {
      if (m.sentiment) sentiment[m.sentiment]++;
      if (m.detectedDialect) {
        dialectMap.set(m.detectedDialect, (dialectMap.get(m.detectedDialect) ?? 0) + 1);
      }
    } else if (m.role === "assistant") {
      if (m.meta?.latencyMs != null) {
        latencySum += m.meta.latencyMs;
        latencyN++;
      }
      for (const inv of m.tools ?? []) {
        toolMap.set(inv.name, (toolMap.get(inv.name) ?? 0) + 1);
      }
    }
  }

  const days: string[] = [];
  const base = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const byDay = days.map((date) => ({
    date,
    conversations: convos.filter((c) => c.createdAt.slice(0, 10) === date).length,
    messages: msgs.filter((m) => m.createdAt.slice(0, 10) === date).length,
  }));

  const convosWithAgent = new Set(
    msgs.filter((m) => m.byAgent).map((m) => m.conversationId),
  );
  const handoffRate = convos.length ? convosWithAgent.size / convos.length : 0;

  const botCount = new Map<string, number>();
  for (const c of convos) botCount.set(c.botId, (botCount.get(c.botId) ?? 0) + 1);
  const topBots = [...botCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      name: bots.find((b) => b.id === id)?.name ?? "—",
      conversations: count,
    }));

  return {
    totals: {
      conversations: convos.length,
      messages: msgs.length,
      bots: bots.length,
      tickets: tickets.length,
    },
    sentiment,
    byDay,
    toolUsage: [...toolMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    dialects: [...dialectMap.entries()].map(([dialect, count]) => ({
      dialect,
      count,
    })),
    handoffRate,
    avgLatencyMs: latencyN ? Math.round(latencySum / latencyN) : 0,
    avgMessagesPerConversation: convos.length
      ? Math.round((msgs.length / convos.length) * 10) / 10
      : 0,
    topBots,
  };
}
