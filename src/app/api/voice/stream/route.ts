import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { buildSystemPrompt } from "@/lib/engine/prompt";
import { AnthropicProvider, streamAnthropic } from "@/lib/llm/anthropic";
import { getProvider, globalDefaultProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICE_HINT =
  "\n\nThis is a spoken voice conversation — keep every reply short and natural (1-2 sentences), the way people actually talk out loud. Avoid lists, markdown, or long explanations.";

type InMsg = { role?: string; content?: string };

/**
 * Low-latency voice turn: streams the model's reply as Server-Sent Events so
 * the client can render text and start speaking sentence-by-sentence instead of
 * waiting for the whole reply. Conversation context is supplied by the client
 * (`history`) to keep this path stateless and fast.
 */
export async function POST(req: Request) {
  seedIfEmpty();

  let body: { botId?: string; message?: string; history?: InMsg[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const bot = body.botId ? store.getBot(body.botId) : undefined;
  if (!bot) return new Response("bot not found", { status: 404 });

  const message = String(body.message ?? "").trim().slice(0, 2000);
  if (!message) return new Response("message is required", { status: 400 });

  const system = buildSystemPrompt(bot, "egyptian") + VOICE_HINT;
  const history: ChatMessage[] = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (m): m is Required<InMsg> =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string",
    )
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const messages: ChatMessage[] = [...history, { role: "user", content: message }];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const anthropic = new AnthropicProvider();
        if (anthropic.isConfigured()) {
          await streamAnthropic(
            messages,
            { system, model: bot.model || undefined, temperature: bot.temperature },
            (t) => send({ delta: t }),
          );
        } else {
          // Non-Anthropic providers: no token streaming — emit the whole reply.
          const provider = getProvider(globalDefaultProvider());
          const res = await provider.chat(messages, { system });
          send({ delta: res.text });
        }
        send({ done: true });
      } catch (err) {
        send({ error: err instanceof Error ? err.message : "stream failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
