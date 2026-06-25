import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { Playground } from "@/components/views/Playground";

export const dynamic = "force-dynamic";

export default function PlaygroundPage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return <Playground bots={store.listBots(tenant.id)} />;
}
