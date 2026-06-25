import type { LLMProvider, ChatMessage, ChatOptions, LLMResult } from "./types";

const AR_RE = /[؀-ۿ]/;

/**
 * Zero-dependency provider so the whole platform runs without any API keys.
 * It produces a believable, language-matched reply grounded in the system
 * prompt so the end-to-end flow (widget -> engine -> inbox) is demoable.
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

    const text = isArabic
      ? [
          `أهلاً بك! 👋 وصلتني رسالتك: «${truncate(userText, 140)}».`,
          "أعمل حالياً في الوضع التجريبي (بدون مفتاح API)، لذلك هذا ردّ توضيحي. أضِف مفتاح مزوّد (Claude أو OpenAI أو Gemini) من إعدادات البوت لتفعيل ردود الذكاء الاصطناعي الحقيقية المبنية على قاعدة المعرفة.",
        ].join("\n\n")
      : [
          `Hi! 👋 I received your message: "${truncate(userText, 140)}".`,
          "I'm running in demo mode (no API key), so this is a placeholder reply. Add a provider key (Claude, OpenAI, or Gemini) in the bot settings to enable real, knowledge-grounded AI responses.",
        ].join("\n\n");

    // Tiny artificial latency so the UI shows a realistic typing delay.
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
