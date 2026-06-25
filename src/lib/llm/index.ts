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

/** The backend global default, set via the LLM_PROVIDER env var. */
export function globalDefaultProvider(): ProviderId {
  const v = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  return (ALL_PROVIDER_IDS as string[]).includes(v) ? (v as ProviderId) : "mock";
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
 * credentials configured, transparently fall back to the mock provider so the
 * platform always responds. The `fellBack` flag is surfaced to the caller.
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
