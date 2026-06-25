import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { StatsView } from "@/components/views/StatsView";

export const dynamic = "force-dynamic";

export default function DashboardHome() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return (
    <StatsView
      stats={store.stats(tenant.id)}
      bots={store.listBots(tenant.id)}
      recent={store.listConversations({ tenantId: tenant.id })}
    />
  );
}
