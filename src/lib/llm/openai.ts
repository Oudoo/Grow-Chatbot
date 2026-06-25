import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";
import { LLMError } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

/** OpenAI provider via the Chat Completions REST API — no SDK required. */
export class OpenAIProvider implements LLMProvider {
  readonly id = "openai" as const;
  readonly label = "OpenAI (GPT)";

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<LLMResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new LLMError("OPENAI_API_KEY is not set", "openai");

    const model = opts?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const started = Date.now();

    const payloadMessages = [
      ...(opts?.system ? [{ role: "system", content: opts.system }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: opts?.temperature ?? 0.4,
        max_tokens: opts?.maxTokens ?? 1024,
        messages: payloadMessages,
      }),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new LLMError(`OpenAI error: ${detail}`, "openai", res.status);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = (data.choices?.[0]?.message?.content ?? "").trim();

    return {
      text,
      provider: "openai",
      model,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
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
