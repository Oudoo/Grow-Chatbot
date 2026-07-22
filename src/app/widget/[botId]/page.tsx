import { notFound } from "next/navigation";
import * as store from "@/lib/store";
import { WidgetChat } from "@/components/WidgetChat";

export const dynamic = "force-dynamic";

export default function WidgetPage({
  params,
}: {
  params: { botId: string };
}) {
  const bot = store.getBot(params.botId);
  if (!bot) notFound();
  // Only public, non-sensitive fields are exposed to the embedded widget.
  return (
    <WidgetChat
      botId={bot.id}
      name={bot.name}
      welcome={bot.welcomeMessage}
      language={bot.language}
    />
  );
}
