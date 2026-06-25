import type { ProviderId } from "@/lib/types";

/** Provider-neutral chat message. System content is passed separately. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResult {
  text: string;
  provider: ProviderId;
  model: string;
  latencyMs: number;
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
