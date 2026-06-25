import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { BotsList } from "@/components/views/BotsList";

export const dynamic = "force-dynamic";

export default function BotsPage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return <BotsList bots={store.listBots(tenant.id)} />;
}
