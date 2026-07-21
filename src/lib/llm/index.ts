import type { BotProvider, ProviderId } from "@/lib/types";
import type { LLMProvider } from "./types";
import { MockProvider } from "./mock";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";

export * from "./types";

const REGISTRY: Record<ProviderId, LLMProvider> = {
  mock: new MockProvider(),
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  gemini: new GeminiProvider(),
};

export const ALL_PROVIDER_IDS: ProviderId[] = [
  "mock",
  "anthropic",
  "openai",
  "gemini",
];

/** Real (non-mock) providers, in auto-detect preference order. */
const REAL_PROVIDERS: ProviderId[] = ["anthropic", "gemini", "openai"];

/** First real provider that has credentials configured, if any. */
function firstConfiguredProvider(): ProviderId | null {
  for (const id of REAL_PROVIDERS) {
    if (REGISTRY[id].isConfigured()) return id;
  }
  return null;
}

/**
 * The backend global default provider. An explicit, valid LLM_PROVIDER wins;
 * otherwise we auto-detect whichever real provider actually has a key
 * (preferring Anthropic) so "set one key and it just works". Falls back to the
 * mock provider only when nothing is configured.
 */
export function globalDefaultProvider(): ProviderId {
  const v = (process.env.LLM_PROVIDER || "").toLowerCase();
  if ((ALL_PROVIDER_IDS as string[]).includes(v)) return v as ProviderId;
  return firstConfiguredProvider() ?? "mock";
}

/**
 * Resolve a bot's provider selection to a concrete provider id.
 * Selection is entirely backend-driven: per-bot override, else the global
 * default. End users never influence this.
 */
export function resolveProviderId(botProvider: BotProvider): ProviderId {
  if (botProvider && botProvider !== "default") return botProvider;
  return globalDefaultProvider();
}

export function getProvider(id: ProviderId): LLMProvider {
  return REGISTRY[id] ?? REGISTRY.mock;
}

/**
 * Returns the provider to actually call. If the requested provider has no
 * credentials, prefer any other configured real provider — so a stray
 * LLM_PROVIDER pointing at an unkeyed vendor still uses your real key — and only
 * fall back to the mock provider when nothing at all is configured.
 */
export function resolveProvider(botProvider: BotProvider): {
  provider: LLMProvider;
  requested: ProviderId;
  fellBack: boolean;
} {
  const requested = resolveProviderId(botProvider);
  const provider = getProvider(requested);
  if (provider.isConfigured()) {
    return { provider, requested, fellBack: false };
  }
  const alt = firstConfiguredProvider();
  if (alt && alt !== requested) {
    return { provider: REGISTRY[alt], requested: alt, fellBack: false };
  }
  return { provider: REGISTRY.mock, requested, fellBack: requested !== "mock" };
}

/** Metadata describing every provider for the admin UI (no secrets exposed). */
export function providerCatalog(): {
  id: ProviderId;
  label: string;
  configured: boolean;
}[] {
  return ALL_PROVIDER_IDS.map((id) => ({
    id,
    label: REGISTRY[id].label,
    configured: REGISTRY[id].isConfigured(),
  }));
}
