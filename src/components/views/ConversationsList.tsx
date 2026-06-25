"use client";

import Link from "next/link";
import type { Bot, Conversation, ConversationStatus } from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";
import { IconChat } from "@/components/icons";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE: Record<ConversationStatus, string> = {
  open: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
  handoff: "bg-amber-50 text-amber-700",
};

export function ConversationsList({
  conversations,
  bots,
}: {
  conversations: Conversation[];
  bots: Bot[];
}) {
  const { t } = useLang();
  const botName = (id: string) => bots.find((b) => b.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title={t.conversations.title}
        subtitle={t.conversations.subtitle}
      />

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <IconChat className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">{t.conversations.empty}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/conversations/${c.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">
                      {botName(c.botId)}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDateTime(c.lastMessageAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {t.channels[c.channel as keyof typeof t.channels] ??
                        c.channel}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[c.status]}`}
                    >
                      {t.conversations[c.status]}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
