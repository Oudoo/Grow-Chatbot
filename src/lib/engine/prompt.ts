import type { Bot, Dialect, Message } from "@/lib/types";
import type { ChatMessage } from "@/lib/llm/types";

const MAX_KNOWLEDGE_CHARS = 4000;
const MAX_HISTORY = 20;

const DIALECT_GUIDANCE: Record<Dialect, string> = {
  auto: "Mirror the dialect and register the user writes in; if they use a local Arabic dialect, respond in that same dialect rather than formal MSA.",
  msa: "Respond in clear Modern Standard Arabic (الفصحى).",
  gulf:
    "Respond in a natural Gulf (Khaleeji) Arabic dialect suitable for Saudi/UAE/Kuwaiti/Qatari users.",
  levantine:
    "Respond in a natural Levantine (Shami) Arabic dialect suitable for Syrian/Lebanese/Jordanian/Palestinian users.",
  egyptian: "Respond in a natural Egyptian (Masri) Arabic dialect.",
  maghrebi:
    "Respond in a natural North African (Maghrebi) Arabic dialect suitable for Moroccan/Algerian/Tunisian users.",
};

/**
 * Compose the full system prompt for a bot turn: identity, language/dialect
 * steering, knowledge grounding, and guardrails. `dialectOverride` lets the
 * engine inject a per-turn detected dialect when the bot is set to auto.
 */
export function buildSystemPrompt(bot: Bot, dialectOverride?: Dialect): string {
  const parts: string[] = [];

  parts.push(
    `You are "${bot.name}", an AI assistant for a business. ${bot.description}`.trim(),
  );

  if (bot.persona.trim()) {
    parts.push(`Persona and behaviour:\n${bot.persona.trim()}`);
  }

  if (bot.language === "ar") {
    const dialect =
      dialectOverride && dialectOverride !== "auto" ? dialectOverride : bot.dialect;
    parts.push(
      `Always reply in Arabic. ${DIALECT_GUIDANCE[dialect]} Keep right-to-left phrasing natural. You may understand "Arabizi" (Arabic written in Latin letters/numbers) and reply in Arabic script.`,
    );
  } else {
    parts.push(
      "Always reply in English unless the user clearly writes in another language, in which case match their language.",
    );
  }

  const knowledge = bot.knowledge.trim();
  if (knowledge) {
    const clipped =
      knowledge.length > MAX_KNOWLEDGE_CHARS
        ? `${knowledge.slice(0, MAX_KNOWLEDGE_CHARS)}…`
        : knowledge;
    parts.push(
      `Use the following knowledge base to answer. If the answer is not covered, say you don't have that information and offer to connect a human agent — do not invent facts.\n\n--- KNOWLEDGE BASE ---\n${clipped}\n--- END KNOWLEDGE BASE ---`,
    );
  } else {
    parts.push(
      "If you don't know an answer, say so honestly and offer to connect a human agent — do not invent facts.",
    );
  }

  parts.push(
    "If a relevant tool is available, call it to fetch accurate, up-to-date information (order status, product details, ticket creation) instead of guessing. Be concise, friendly, and helpful, and keep answers focused on the user's question.",
  );

  return parts.join("\n\n");
}

/**
 * Convert stored conversation messages into provider-neutral chat turns,
 * dropping system rows and capping history length.
 */
export function toChatHistory(messages: Message[]): ChatMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}
