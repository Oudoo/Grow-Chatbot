import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";
import type { ToolCall } from "@/lib/tools/types";
import { LLMError } from "./types";

const DEFAULT_MODEL = "claude-sonnet-5";
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
      system: opts?.system,
      messages: toAnthropicMessages(messages),
    };
    // Current-generation Claude models (Opus 4.7/4.8 and the Sonnet/Opus/Fable/
    // Mythos 5 family) reject `temperature`/`top_p`/`top_k` with HTTP 400. Only
    // send `temperature` to models that still accept it (Opus 4.6, Sonnet 4.6,
    // Haiku 4.5 and earlier) — otherwise the whole request fails and the engine
    // silently falls back to the mock provider.
    if (acceptsTemperature(model)) {
      body.temperature = opts?.temperature ?? 0.4;
    }
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

/**
 * Stream a Claude completion, invoking `onDelta` with each text chunk as it
 * arrives. Returns the full text once the stream ends. Used by the low-latency
 * voice path so speech can begin on the first sentence instead of the whole
 * reply. No tool-calling (voice replies are plain conversational text).
 */
export async function streamAnthropic(
  messages: ChatMessage[],
  opts: { system?: string; model?: string; temperature?: number; maxTokens?: number },
  onDelta: (text: string) => void,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new LLMError("ANTHROPIC_API_KEY is not set", "anthropic");

  const model = opts.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 512,
    system: opts.system,
    messages: toAnthropicMessages(messages),
    stream: true,
  };
  if (acceptsTemperature(model)) body.temperature = opts.temperature ?? 0.5;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new LLMError(`Anthropic error: ${await safeText(res)}`, "anthropic", res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          const t = evt.delta.text ?? "";
          full += t;
          onDelta(t);
        }
      } catch {
        /* ignore keepalives / partial frames */
      }
    }
  }
  return full;
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

/**
 * Whether a Claude model still accepts the `temperature` sampling parameter.
 * The 5-family (Sonnet/Opus/Fable/Mythos 5) and Opus 4.7+ dropped it and now
 * reject it with HTTP 400; Opus 4.6, Sonnet 4.6, Haiku 4.5 and earlier keep it.
 */
function acceptsTemperature(model: string): boolean {
  const m = model.toLowerCase();
  if (/claude-[a-z]+-5(\b|-)/.test(m)) return false; // *-5 family
  if (/claude-opus-4-[7-9]/.test(m)) return false; // Opus 4.7+
  return true;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return `HTTP ${res.status}`;
  }
}
