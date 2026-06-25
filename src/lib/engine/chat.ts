import type {
  Bot,
  Channel,
  Conversation,
  Message,
  ProviderMeta,
  ToolInvocation,
} from "@/lib/types";
import {
  resolveProvider,
  getProvider,
  type ChatMessage,
  type LLMResult,
} from "@/lib/llm";
import { getToolDefs, executeTool, type ToolContext } from "@/lib/tools";
import * as store from "@/lib/store";
import { analyzeSentiment } from "./sentiment";
import { buildSystemPrompt, toChatHistory } from "./prompt";

const MAX_STEPS = 5;

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
  /** Absent when the bot is paused (conversation handed off to a human). */
  assistantMessage?: Message;
  meta?: ProviderMeta;
  toolInvocations: ToolInvocation[];
  /** True when the bot did not reply because the conversation is handed off. */
  handoff: boolean;
}

export class EngineError extends Error {}

/**
 * Runs a single conversational turn end to end: find/create the conversation,
 * persist the inbound message (with sentiment), run the agent loop (model +
 * tools), and persist the reply.
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

  // If the conversation has been handed off to a human, pause the bot: record
  // the inbound message but do not auto-reply — a human agent answers instead.
  if (conversation.status === "handoff") {
    const paused = store.getConversation(conversation.id) ?? conversation;
    return {
      conversation: paused,
      userMessage,
      toolInvocations: [],
      handoff: true,
    };
  }

  const system = buildSystemPrompt(bot);
  const messages: ChatMessage[] = [
    ...history,
    { role: "user", content: text },
  ];

  const agent = await runAgent(bot, system, messages, conversation.id);

  const assistantMessage = store.addMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: agent.text,
    channel: input.channel,
    meta: agent.providerMeta,
    tools: agent.toolInvocations.length ? agent.toolInvocations : undefined,
  });

  const refreshed = store.getConversation(conversation.id) ?? conversation;

  return {
    conversation: refreshed,
    userMessage,
    assistantMessage,
    meta: agent.providerMeta,
    toolInvocations: agent.toolInvocations,
    handoff: false,
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

interface AgentResult {
  text: string;
  toolInvocations: ToolInvocation[];
  providerMeta: ProviderMeta;
}

/**
 * The agent loop: call the model with the bot's tools; if it requests tool
 * calls, execute them, feed results back, and repeat (bounded). Falls back to
 * the mock provider on a hard failure so a reply is always produced.
 */
async function runAgent(
  bot: Bot,
  system: string,
  baseMessages: ChatMessage[],
  conversationId: string,
): Promise<AgentResult> {
  const { provider, requested, fellBack } = resolveProvider(bot.provider);
  const toolDefs = getToolDefs(bot.tools ?? [], bot.tenantId);
  const ctx: ToolContext = { bot, conversationId };
  const messages: ChatMessage[] = [...baseMessages];
  const invocations: ToolInvocation[] = [];
  const started = Date.now();

  const opts = {
    system,
    model: bot.model || undefined,
    temperature: bot.temperature,
    tools: toolDefs.length ? toolDefs : undefined,
  };

  const finalize = (result: LLMResult, steps: number): AgentResult => ({
    text: result.text || "…",
    toolInvocations: invocations,
    providerMeta: {
      provider: result.provider,
      model: result.model,
      latencyMs: Date.now() - started,
      fellBack,
      steps,
    },
  });

  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      const result = await provider.chat(messages, opts);
      if (result.toolCalls?.length) {
        messages.push({
          role: "assistant",
          content: result.text || "",
          toolCalls: result.toolCalls,
        });
        for (const call of result.toolCalls) {
          const output = await executeTool(call.name, call.arguments, ctx);
          invocations.push({
            name: call.name,
            args: call.arguments,
            result: output,
          });
          messages.push({
            role: "tool",
            content: output,
            toolCallId: call.id,
            name: call.name,
          });
        }
        continue;
      }
      return finalize(result, step);
    }
    // Exhausted tool budget — force a final answer with tools disabled.
    const forced = await provider.chat(messages, { ...opts, tools: undefined });
    return finalize(forced, MAX_STEPS);
  } catch (err) {
    console.error(`[engine] provider "${requested}" failed:`, err);
    const mock = getProvider("mock");
    const result = await mock.chat(baseMessages, { system });
    return {
      text: result.text,
      toolInvocations: invocations,
      providerMeta: {
        provider: "mock",
        model: result.model,
        latencyMs: Date.now() - started,
        fellBack: true,
        steps: 1,
      },
    };
  }
}
