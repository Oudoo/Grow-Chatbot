import type { Bot, Channel, Conversation, Message, ProviderMeta } from "@/lib/types";
import { resolveProvider, getProvider } from "@/lib/llm";
import * as store from "@/lib/store";
import { analyzeSentiment } from "./sentiment";
import { buildSystemPrompt, toChatHistory } from "./prompt";

export interface TurnInput {
  botId: string;
  conversationId?: string;
  channel: Channel;
  text: string;
  endUserName?: string;
}

export interface TurnResult {
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
  meta: ProviderMeta;
}

export class EngineError extends Error {}

/**
 * Runs a single conversational turn end to end:
 * find/create the conversation, persist the inbound message (with sentiment),
 * call the backend-resolved provider (with mock fallback), persist the reply.
 */
export async function processTurn(input: TurnInput): Promise<TurnResult> {
  const text = input.text?.trim();
  if (!text) throw new EngineError("Message text is required");

  const bot = store.getBot(input.botId);
  if (!bot) throw new EngineError("Bot not found");

  const conversation = resolveConversation(bot, input);

  // Build history BEFORE recording the new inbound message.
  const history = toChatHistory(store.listMessages(conversation.id));

  const userMessage = store.addMessage({
    conversationId: conversation.id,
    role: "user",
    content: text,
    channel: input.channel,
    sentiment: analyzeSentiment(text),
  });

  const system = buildSystemPrompt(bot);
  const messages = [...history, { role: "user" as const, content: text }];

  const meta = await generate(bot, system, messages);

  const assistantMessage = store.addMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: meta.text,
    channel: input.channel,
    meta: meta.providerMeta,
  });

  const refreshed = store.getConversation(conversation.id) ?? conversation;

  return {
    conversation: refreshed,
    userMessage,
    assistantMessage,
    meta: meta.providerMeta,
  };
}

function resolveConversation(bot: Bot, input: TurnInput): Conversation {
  if (input.conversationId) {
    const existing = store.getConversation(input.conversationId);
    if (existing) return existing;
  }
  return store.createConversation({
    botId: bot.id,
    tenantId: bot.tenantId,
    channel: input.channel,
    endUserName: input.endUserName,
  });
}

async function generate(
  bot: Bot,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ text: string; providerMeta: ProviderMeta }> {
  const { provider, requested, fellBack } = resolveProvider(bot.provider);
  const opts = {
    system,
    model: bot.model || undefined,
    temperature: bot.temperature,
  };

  try {
    const result = await provider.chat(messages, opts);
    return {
      text: result.text || "…",
      providerMeta: {
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        fellBack,
      },
    };
  } catch (err) {
    // Hard failure from a real provider: fall back to mock so the user always
    // gets a response, and record that the fallback fired.
    console.error(`[engine] provider "${requested}" failed:`, err);
    const mock = getProvider("mock");
    const result = await mock.chat(messages, opts);
    return {
      text: result.text,
      providerMeta: {
        provider: "mock",
        model: result.model,
        latencyMs: result.latencyMs,
        fellBack: true,
      },
    };
  }
}
