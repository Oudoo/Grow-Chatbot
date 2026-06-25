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
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  channel?: Channel;
  sentiment?: Sentiment;
  meta?: ProviderMeta;
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

/** Shape persisted by the file-backed dev store. */
export interface Database {
  tenants: Tenant[];
  bots: Bot[];
  conversations: Conversation[];
  messages: Message[];
}
