import type { NewBot } from "@/lib/store";
import type {
  BotProvider,
  Channel,
  Dialect,
  Language,
  BotStatus,
} from "@/lib/types";
import { CHANNELS } from "@/lib/types";

const LANGS: Language[] = ["ar", "en"];
const DIALECTS: Dialect[] = [
  "auto",
  "msa",
  "gulf",
  "levantine",
  "egyptian",
  "maghrebi",
];
const PROVIDERS: BotProvider[] = [
  "default",
  "mock",
  "anthropic",
  "openai",
  "gemini",
];
const STATUSES: BotStatus[] = ["active", "draft"];

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function pick<T extends string>(val: unknown, allowed: T[], fallback: T): T {
  return typeof val === "string" && (allowed as string[]).includes(val)
    ? (val as T)
    : fallback;
}

/** Validate and normalise an incoming bot payload into a full NewBot record. */
export function parseBotInput(body: unknown, tenantId: string): Parsed<NewBot> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) return { ok: false, error: "Name is required" };

  const language = pick<Language>(b.language, LANGS, "ar");
  let temperature = Number(b.temperature);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
    temperature = 0.4;
  }

  const value: NewBot = {
    tenantId,
    name,
    description: String(b.description ?? "").trim(),
    language,
    dialect: pick<Dialect>(b.dialect, DIALECTS, "auto"),
    persona: String(b.persona ?? "").trim(),
    knowledge: String(b.knowledge ?? "").trim(),
    welcomeMessage:
      String(b.welcomeMessage ?? "").trim() ||
      (language === "ar"
        ? "مرحباً! كيف يمكنني مساعدتك؟"
        : "Hi! How can I help you?"),
    provider: pick<BotProvider>(b.provider, PROVIDERS, "default"),
    model: b.model ? String(b.model).trim() : undefined,
    temperature,
    status: pick<BotStatus>(b.status, STATUSES, "active"),
  };
  return { ok: true, value };
}

export function parseChannel(val: unknown, fallback: Channel = "api"): Channel {
  return pick<Channel>(val, CHANNELS, fallback);
}
