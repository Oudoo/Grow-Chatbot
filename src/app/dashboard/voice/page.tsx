import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { humeConfigured } from "@/lib/hume";
import { azureConfigured } from "@/lib/azure-tts";
import { elevenLabsConfigured } from "@/lib/elevenlabs-tts";
import { buildSystemPrompt } from "@/lib/engine/prompt";
import { VoiceStudio } from "@/components/views/VoiceStudio";

export const dynamic = "force-dynamic";

const VOICE_HINT =
  "\n\nThis is a spoken voice conversation — keep every reply short and natural (1-2 sentences), the way people actually talk out loud. Avoid lists, markdown, or long explanations.";

export default function VoicePage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  const allBots = store.listBots(tenant.id);

  // Feature Maya (the general Egyptian-Arabic assistant) first.
  const bots = [...allBots].sort((a, b) =>
    a.name === "مايا" ? -1 : b.name === "مايا" ? 1 : 0,
  );

  const systemPrompts: Record<string, string> = {};
  for (const b of bots) {
    systemPrompts[b.id] = buildSystemPrompt(b, "egyptian") + VOICE_HINT;
  }

  return (
    <VoiceStudio
      bots={bots.map((b) => ({
        id: b.id,
        name: b.name,
        welcome: b.welcomeMessage,
      }))}
      systemPrompts={systemPrompts}
      humeConfigured={humeConfigured()}
      azureConfigured={elevenLabsConfigured() || azureConfigured()}
    />
  );
}
