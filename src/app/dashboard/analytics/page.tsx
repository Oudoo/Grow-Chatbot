import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { AnalyticsView } from "@/components/views/AnalyticsView";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return <AnalyticsView data={store.analytics(tenant.id)} />;
}
