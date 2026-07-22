import { notFound } from "next/navigation";
import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { humeConfigured } from "@/lib/hume";
import { azureConfigured } from "@/lib/azure-tts";
import { elevenLabsConfigured } from "@/lib/elevenlabs-tts";
import { buildSystemPrompt } from "@/lib/engine/prompt";
import { MayaLink } from "@/components/views/MayaLink";

export const dynamic = "force-dynamic";

const VOICE_HINT =
  "\n\nThis is a spoken voice conversation — keep every reply short and natural (1-2 sentences), the way people actually talk out loud. Avoid lists, markdown, or long explanations.";

/**
 * Public, standalone link to talk to Maya only — no dashboard, no options.
 * Maya is resolved by name so the URL stays stable across re-seeds.
 */
export default function MayaPage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  const bots = store.listBots(tenant.id);
  const maya = bots.find((b) => b.name === "مايا") ?? bots[0];
  if (!maya) notFound();

  return (
    <MayaLink
      botId={maya.id}
      name={maya.name}
      welcome={maya.welcomeMessage}
      systemPrompt={buildSystemPrompt(maya, "egyptian") + VOICE_HINT}
      humeConfigured={humeConfigured()}
      azureConfigured={elevenLabsConfigured() || azureConfigured()}
    />
  );
}
