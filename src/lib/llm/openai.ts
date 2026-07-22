import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";
import type { ToolCall } from "@/lib/tools/types";
import { LLMError } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

type OAMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
};

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

    const payload: Record<string, unknown> = {
      model,
      temperature: opts?.temperature ?? 0.4,
      max_tokens: opts?.maxTokens ?? 1024,
      messages: toOpenAIMessages(messages, opts?.system),
    };
    if (opts?.tools?.length) {
      payload.tools = opts.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new LLMError(`OpenAI error: ${detail}`, "openai", res.status);
    }

    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: {
            id: string;
            function?: { name?: string; arguments?: string };
          }[];
        };
      }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const message = data.choices?.[0]?.message;
    const text = (message?.content ?? "").trim();
    const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function?.name ?? "",
      arguments: safeParse(tc.function?.arguments),
    }));

    return {
      text,
      provider: "openai",
      model,
      latencyMs: Date.now() - started,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      },
    };
  }
}

function toOpenAIMessages(
  messages: ChatMessage[],
  system?: string,
): OAMessage[] {
  const out: OAMessage[] = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      });
    } else if (m.role === "assistant" && m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

function safeParse(s?: string): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return `HTTP ${res.status}`;
  }
}
