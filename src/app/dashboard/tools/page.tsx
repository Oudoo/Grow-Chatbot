import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { toolNames } from "@/lib/tools";
import { CustomToolsView } from "@/components/views/CustomToolsView";

export const dynamic = "force-dynamic";

export default function ToolsPage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return (
    <CustomToolsView
      tools={store.listCustomTools(tenant.id)}
      builtinNames={toolNames()}
    />
  );
}
