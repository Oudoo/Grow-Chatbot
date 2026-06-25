import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";
import { LLMError } from "./types";

const DEFAULT_MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";

/** Anthropic (Claude) provider via the Messages REST API — no SDK required. */
export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic" as const;
  readonly label = "Anthropic (Claude)";

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<LLMResult> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new LLMError("ANTHROPIC_API_KEY is not set", "anthropic");

    const model = opts?.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    const started = Date.now();

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts?.maxTokens ?? 1024,
        temperature: opts?.temperature ?? 0.4,
        system: opts?.system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new LLMError(`Anthropic error: ${detail}`, "anthropic", res.status);
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();

    return {
      text,
      provider: "anthropic",
      model,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
    };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return `HTTP ${res.status}`;
  }
}
