import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";
import { LLMError } from "./types";

const DEFAULT_MODEL = "gemini-1.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Google Gemini provider via the generateContent REST API — no SDK required. */
export class GeminiProvider implements LLMProvider {
  readonly id = "gemini" as const;
  readonly label = "Google (Gemini)";

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<LLMResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new LLMError("GEMINI_API_KEY is not set", "gemini");

    const model = opts?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const started = Date.now();
    const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(opts?.system
          ? { systemInstruction: { parts: [{ text: opts.system }] } }
          : {}),
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: opts?.temperature ?? 0.4,
          maxOutputTokens: opts?.maxTokens ?? 1024,
        },
      }),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new LLMError(`Gemini error: ${detail}`, "gemini", res.status);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    return {
      text,
      provider: "gemini",
      model,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
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
