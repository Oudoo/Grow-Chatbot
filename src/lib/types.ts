// Core domain types shared across the platform (server + client safe).

export type ProviderId = "mock" | "anthropic" | "openai" | "gemini";

/** A bot's provider selection. "default" means "use the backend global default". */
export type BotProvider = ProviderId | "default";

export type Language = "ar" | "en";

/**
 * Arabic dialect hint. Today this steers the system prompt; it is the seam
 * where native dialect models / detection will plug in later.
 */
export type Dialect =
  | "auto"
  | "msa"
  | "gulf"
  | "levantine"
  | "egyptian"
  | "maghrebi";

/** Channels the engine can receive messages from. "web" powers the widget. */
export type Channel =
  | "web"
  | "whatsapp"
  | "messenger"
  | "instagram"
  | "telegram"
  | "api";

export const CHANNELS: Channel[] = [
  "web",
  "whatsapp",
  "messenger",
  "instagram",
  "telegram",
  "api",
];

export type Sentiment = "positive" | "negative" | "neutral";

export type BotStatus = "active" | "draft";

export type ConversationStatus = "open" | "closed" | "handoff";

export type MessageRole = "user" | "assistant" | "system";

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

export interface Bot {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  /** Primary language the bot replies in. */
  language: Language;
  /** Dialect steering for Arabic personas. */
  dialect: Dialect;
  /** Persona / behavioural instructions injected into the system prompt. */
  persona: string;
  /** Freeform knowledge base text the engine grounds answers in. */
  knowledge: string;
  /** First message shown to an end user when a conversation opens. */
  welcomeMessage: string;
  /** Backend-selected LLM provider. "default" defers to LLM_PROVIDER. */
  provider: BotProvider;
  /** Optional model override; falls back to the provider's default model. */
  model?: string;
  temperature: number;
  /** Names of the agentic tools this bot is allowed to call. */
  tools: string[];
  /** IDs of MCP servers whose tools this bot may call. */
  mcpServers: string[];
  status: BotStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderMeta {
  /** Provider that actually produced the reply (may differ if a fallback fired). */
  provider: ProviderId;
  model: string;
  latencyMs: number;
  /** True when the requested provider was unavailable and mock answered instead. */
  fellBack?: boolean;
  /** Number of agent loop steps taken (>1 means tools were called). */
  steps?: number;
}

/** A single agentic tool call the engine executed during a turn. */
export interface ToolInvocation {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  channel?: Channel;
  sentiment?: Sentiment;
  /** Detected Arabic dialect of a user message (when detection ran). */
  detectedDialect?: Dialect;
  meta?: ProviderMeta;
  /** Tool calls made while producing this (assistant) message. */
  tools?: ToolInvocation[];
  /** True when an assistant message was written by a human agent, not the bot. */
  byAgent?: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  botId: string;
  tenantId: string;
  channel: Channel;
  endUserName?: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

/** A single parameter of a user-defined HTTP tool (always a string input). */
export interface CustomToolParam {
  name: string;
  description: string;
}

/**
 * A tool defined by an admin in the dashboard (no code). When the model calls
 * it, the engine performs the configured HTTP request and returns the response.
 */
export interface CustomTool {
  id: string;
  tenantId: string;
  /** Unique tool name the model sees (snake_case). */
  name: string;
  description: string;
  method: "GET" | "POST";
  /** Target URL; may contain {param} placeholders. */
  url: string;
  headers?: Record<string, string>;
  params: CustomToolParam[];
  /** Optional request body template for POST; may contain {param} placeholders. */
  bodyTemplate?: string;
  createdAt: string;
}

/** A support ticket created by the `create_ticket` agentic tool. */
export interface Ticket {
  id: string;
  tenantId: string;
  botId?: string;
  conversationId?: string;
  summary: string;
  status: "open" | "closed";
  createdAt: string;
}

/** A registered MCP (Model Context Protocol) server whose tools bots can call. */
export interface McpServer {
  id: string;
  tenantId: string;
  name: string;
  /** HTTP(S) endpoint speaking MCP JSON-RPC (Streamable HTTP transport). */
  url: string;
  headers?: Record<string, string>;
  createdAt: string;
}

export type IntegrationType =
  | "shopify"
  | "woocommerce"
  | "salesforce"
  | "hubspot"
  | "zoho";

/**
 * A connected CRM / e-commerce system. When connected it exposes a set of
 * integration tools bots can call. Without a baseUrl/apiKey the tools return
 * clearly-labelled demo data; with them they call the real API.
 */
export interface Integration {
  id: string;
  tenantId: string;
  type: IntegrationType;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  status: "connected" | "disabled";
  createdAt: string;
}

/** Shape persisted by the file-backed dev store. */
export interface Database {
  tenants: Tenant[];
  bots: Bot[];
  conversations: Conversation[];
  messages: Message[];
  tickets: Ticket[];
  customTools: CustomTool[];
  mcpServers: McpServer[];
  integrations: Integration[];
}
