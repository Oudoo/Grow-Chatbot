import type { ProviderId } from "@/lib/types";
import type { ToolDef, ToolCall } from "@/lib/tools/types";

export type { ToolDef, ToolCall };

/**
 * Provider-neutral chat message. System content is passed separately.
 * Tool-calling adds the "tool" role (a tool result) and lets an assistant
 * message carry the tool calls it requested.
 */
export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  /** Present on an assistant message that requested tool calls. */
  toolCalls?: ToolCall[];
  /** Present on a "tool" message: the id of the call it answers. */
  toolCallId?: string;
  /** Present on a "tool" message: the tool name. */
  name?: string;
}

export interface ChatOptions {
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Tools the model may call this turn. */
  tools?: ToolDef[];
}

export interface LLMResult {
  text: string;
  provider: ProviderId;
  model: string;
  latencyMs: number;
  /** When set, the model requested these tool calls instead of a final answer. */
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

/**
 * The single seam every model vendor implements. New providers (or a
 * self-hosted/sovereign model) only need to satisfy this interface.
 */
export interface LLMProvider {
  readonly id: ProviderId;
  /** Human label for the admin UI. */
  readonly label: string;
  /** True when the necessary credentials are present in the environment. */
  isConfigured(): boolean;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<LLMResult>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
