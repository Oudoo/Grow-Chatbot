import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { toolNames } from "@/lib/tools";
import { CustomToolsView } from "@/components/views/CustomToolsView";
import { McpServersView } from "@/components/views/McpServersView";

export const dynamic = "force-dynamic";

export default function ToolsPage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return (
    <div className="space-y-10">
      <CustomToolsView
        tools={store.listCustomTools(tenant.id)}
        builtinNames={toolNames()}
      />
      <McpServersView servers={store.listMcpServers(tenant.id)} />
    </div>
  );
}
