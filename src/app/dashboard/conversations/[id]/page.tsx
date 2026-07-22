import { notFound } from "next/navigation";
import * as store from "@/lib/store";
import { ConversationThread } from "@/components/views/ConversationThread";

export const dynamic = "force-dynamic";

export default function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const conversation = store.getConversation(params.id);
  if (!conversation) notFound();
  return (
    <ConversationThread
      conversation={conversation}
      messages={store.listMessages(conversation.id)}
      bot={store.getBot(conversation.botId) ?? null}
    />
  );
}
