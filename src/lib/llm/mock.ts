import { randomUUID } from "crypto";
import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";
import type { ToolDef, ToolCall } from "@/lib/tools/types";

const AR_RE = /[؀-ۿ]/;

/**
 * Zero-dependency provider so the whole platform runs without any API keys.
 * It produces a believable, language-matched reply grounded in the system
 * prompt, and — crucially — simulates the full agentic tool-calling loop so
 * the feature is demoable end to end without a real model.
 */
export class MockProvider implements LLMProvider {
  readonly id = "mock" as const;
  readonly label = "Mock (no key)";

  isConfigured(): boolean {
    return true;
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<LLMResult> {
    const started = Date.now();
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userText = lastUser?.content ?? "";
    const isArabic = AR_RE.test(userText) || AR_RE.test(opts?.system ?? "");
    const tools = opts?.tools ?? [];
    const alreadyUsedTool = messages.some((m) => m.role === "tool");

    // 1) Simulate a tool call when a tool's triggers match the user's text and
    //    we haven't already called one this turn.
    if (tools.length && !alreadyUsedTool) {
      const match = pickTool(tools, userText);
      if (match) {
        const call: ToolCall = {
          id: randomUUID(),
          name: match.name,
          arguments: extractArgs(match, userText),
        };
        return {
          text: "",
          provider: "mock",
          model: "mock-1",
          latencyMs: Date.now() - started,
          toolCalls: [call],
        };
      }
    }

    // 2) Produce a final answer, grounding on the latest tool result if present.
    const lastTool = [...messages].reverse().find((m) => m.role === "tool");
    let text: string;
    if (lastTool) {
      text = isArabic
        ? `تمام ✅ إليك ما توصّلت إليه:\n\n${lastTool.content}\n\n(وضع تجريبي — أضِف مفتاح مزوّد لتفعيل ردود الذكاء الاصطناعي الحقيقية.)`
        : `Done ✅ Here's what I found:\n\n${lastTool.content}\n\n(Demo mode — add a provider key to enable real AI responses.)`;
    } else {
      text = isArabic
        ? [
            `أهلاً بك! 👋 وصلتني رسالتك: «${truncate(userText, 140)}».`,
            "أعمل حالياً في الوضع التجريبي (بدون مفتاح API)، لذلك هذا ردّ توضيحي. أضِف مفتاح مزوّد (Claude أو OpenAI أو Gemini) من إعدادات البوت لتفعيل ردود الذكاء الاصطناعي الحقيقية المبنية على قاعدة المعرفة.",
          ].join("\n\n")
        : [
            `Hi! 👋 I received your message: "${truncate(userText, 140)}".`,
            "I'm running in demo mode (no API key), so this is a placeholder reply. Add a provider key (Claude, OpenAI, or Gemini) in the bot settings to enable real, knowledge-grounded AI responses.",
          ].join("\n\n");
    }

    await new Promise((r) => setTimeout(r, 120));

    return {
      text,
      provider: "mock",
      model: "mock-1",
      latencyMs: Date.now() - started,
      usage: { inputTokens: userText.length, outputTokens: text.length },
    };
  }
}

function pickTool(tools: ToolDef[], userText: string): ToolDef | undefined {
  const t = userText.toLowerCase();
  return tools.find((tool) =>
    (tool.triggers ?? []).some((trigger) => t.includes(trigger.toLowerCase())),
  );
}

function extractArgs(
  tool: ToolDef,
  userText: string,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const param of tool.parameters.required) {
    if (/id|order/i.test(param)) {
      const m = userText.match(/[A-Za-z]*-?\d[\w-]*/);
      args[param] = m ? m[0] : "UNKNOWN";
    } else {
      args[param] = userText.trim();
    }
  }
  return args;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
