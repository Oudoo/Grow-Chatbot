import { globalDefaultProvider, providerCatalog } from "@/lib/llm";
import { BotEditor } from "@/components/views/BotEditor";

export const dynamic = "force-dynamic";

export default function NewBotPage() {
  return (
    <BotEditor
      mode="create"
      providers={providerCatalog()}
      defaultProvider={globalDefaultProvider()}
    />
  );
}
