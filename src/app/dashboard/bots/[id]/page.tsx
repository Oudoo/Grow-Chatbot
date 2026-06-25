import { notFound } from "next/navigation";
import * as store from "@/lib/store";
import { globalDefaultProvider, providerCatalog } from "@/lib/llm";
import { toolNames } from "@/lib/tools";
import { BotEditor } from "@/components/views/BotEditor";

export const dynamic = "force-dynamic";

export default function EditBotPage({ params }: { params: { id: string } }) {
  const bot = store.getBot(params.id);
  if (!bot) notFound();
  return (
    <BotEditor
      mode="edit"
      bot={bot}
      providers={providerCatalog()}
      defaultProvider={globalDefaultProvider()}
      availableTools={toolNames(bot.tenantId)}
    />
  );
}
