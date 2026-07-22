import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { integrationTypes, toolsForType } from "@/lib/integrations";
import { IntegrationsView } from "@/components/views/IntegrationsView";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  const catalog = integrationTypes().map(({ type, label }) => ({
    type,
    label,
    tools: toolsForType(type),
  }));
  return (
    <IntegrationsView
      integrations={store.listIntegrations(tenant.id)}
      catalog={catalog}
    />
  );
}
