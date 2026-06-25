import { seedIfEmpty } from "@/lib/seed";
import * as store from "@/lib/store";
import { ConversationsList } from "@/components/views/ConversationsList";

export const dynamic = "force-dynamic";

export default function ConversationsPage() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return (
    <ConversationsList
      conversations={store.listConversations({ tenantId: tenant.id })}
      bots={store.listBots(tenant.id)}
    />
  );
}
