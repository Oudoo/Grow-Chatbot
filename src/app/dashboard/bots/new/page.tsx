import * as store from "@/lib/store";
import { globalDefaultProvider, providerCatalog } from "@/lib/llm";
import { toolNames } from "@/lib/tools";
import { BotEditor } from "@/components/views/BotEditor";

export const dynamic = "force-dynamic";

export default function NewBotPage() {
  const tenant = store.defaultTenant();
  return (
    <BotEditor
      mode="create"
      providers={providerCatalog()}
      defaultProvider={globalDefaultProvider()}
      availableTools={toolNames(tenant.id)}
    />
  );
}
