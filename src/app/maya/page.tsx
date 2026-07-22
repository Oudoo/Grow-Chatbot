import { notFound } from "next/navigation";
import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { MayaLink } from "@/components/views/MayaLink";

export const dynamic = "force-dynamic";

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

  return <MayaLink botId={maya.id} name={maya.name} welcome={maya.welcomeMessage} />;
}
