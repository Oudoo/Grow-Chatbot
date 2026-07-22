import { randomUUID } from "crypto";
import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";
import type { ToolCall, ToolSchema } from "@/lib/tools/types";
import { LLMError } from "./types";

const DEFAULT_MODEL = "gemini-1.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };
type GContent = { role: "user" | "model"; parts: GPart[] };

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

    const body: Record<string, unknown> = {
      contents: toGeminiContents(messages),
      generationConfig: {
        temperature: opts?.temperature ?? 0.4,
        maxOutputTokens: opts?.maxTokens ?? 1024,
      },
    };
    if (opts?.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] };
    }
    if (opts?.tools?.length) {
      body.tools = [
        {
          functionDeclarations: opts.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: toGeminiSchema(t.parameters),
          })),
        },
      ];
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new LLMError(`Gemini error: ${detail}`, "gemini", res.status);
    }

    const data = (await res.json()) as {
      candidates?: {
        content?: {
          parts?: {
            text?: string;
            functionCall?: { name?: string; args?: Record<string, unknown> };
          }[];
        };
      }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    const toolCalls: ToolCall[] = parts
      .filter((p) => p.functionCall)
      .map((p) => ({
        id: randomUUID(),
        name: p.functionCall?.name ?? "",
        arguments: p.functionCall?.args ?? {},
      }));

    return {
      text,
      provider: "gemini",
      model,
      latencyMs: Date.now() - started,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      },
    };
  }
}

function toGeminiContents(messages: ChatMessage[]): GContent[] {
  return messages.map((m): GContent => {
    if (m.role === "tool") {
      return {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: m.name ?? "",
              response: { result: m.content },
            },
          },
        ],
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const parts: GPart[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls) {
        parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
      }
      return { role: "model", parts };
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    };
  });
}

const GEMINI_TYPE: Record<string, string> = {
  string: "STRING",
  number: "NUMBER",
  boolean: "BOOLEAN",
  object: "OBJECT",
};

/** Convert our JSON schema to Gemini's uppercase-typed Schema. */
function toGeminiSchema(schema: ToolSchema): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, p] of Object.entries(schema.properties)) {
    properties[key] = {
      type: GEMINI_TYPE[p.type] ?? "STRING",
      description: p.description,
      ...(p.enum ? { enum: p.enum } : {}),
    };
  }
  return { type: "OBJECT", properties, required: schema.required };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return `HTTP ${res.status}`;
  }
}
