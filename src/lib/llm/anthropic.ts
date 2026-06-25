import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";
import type { ToolCall } from "@/lib/tools/types";
import { LLMError } from "./types";

const DEFAULT_MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AMessage = { role: "user" | "assistant"; content: string | Block[] };

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

    const body: Record<string, unknown> = {
      model,
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.4,
      system: opts?.system,
      messages: toAnthropicMessages(messages),
    };
    if (opts?.tools?.length) {
      body.tools = opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new LLMError(`Anthropic error: ${detail}`, "anthropic", res.status);
    }

    const data = (await res.json()) as {
      content?: {
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();

    const toolCalls: ToolCall[] = (data.content ?? [])
      .filter((c) => c.type === "tool_use")
      .map((c) => ({
        id: c.id ?? "",
        name: c.name ?? "",
        arguments: c.input ?? {},
      }));

    return {
      text,
      provider: "anthropic",
      model,
      latencyMs: Date.now() - started,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
    };
  }
}

/** Map neutral messages to Anthropic's format, grouping tool results. */
function toAnthropicMessages(messages: ChatMessage[]): AMessage[] {
  const out: AMessage[] = [];
  let pending: Block[] = [];

  const flush = () => {
    if (pending.length) {
      out.push({ role: "user", content: pending });
      pending = [];
    }
  };

  for (const m of messages) {
    if (m.role === "tool") {
      pending.push({
        type: "tool_result",
        tool_use_id: m.toolCallId ?? "",
        content: m.content,
      });
      continue;
    }
    flush();
    if (m.role === "assistant" && m.toolCalls?.length) {
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      out.push({ role: "assistant", content: blocks });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  flush();
  return out;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return `HTTP ${res.status}`;
  }
}
