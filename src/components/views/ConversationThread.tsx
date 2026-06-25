"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  Bot,
  Conversation,
  ConversationStatus,
  Message,
  Sentiment,
} from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { IconBack } from "@/components/icons";
import { formatDateTime } from "@/lib/format";

const SENTIMENT_TONE: Record<Sentiment, string> = {
  positive: "bg-emerald-50 text-emerald-700",
  negative: "bg-red-50 text-red-600",
  neutral: "bg-slate-100 text-slate-500",
};

const STATUSES: ConversationStatus[] = ["open", "handoff", "closed"];

export function ConversationThread({
  conversation,
  messages,
  bot,
}: {
  conversation: Conversation;
  messages: Message[];
  bot: Bot | null;
}) {
  const { t } = useLang();
  const [status, setStatus] = useState<ConversationStatus>(
    conversation.status,
  );
  const msgDir = bot?.language === "ar" ? "rtl" : "ltr";

  async function changeStatus(next: ConversationStatus) {
    setStatus(next);
    await fetch(`/api/conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  return (
    <div>
      <Link
        href="/dashboard/conversations"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <IconBack className="h-4 w-4" />
        {t.conversations.backToInbox}
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <div className="font-semibold text-slate-900">
            {bot?.name ?? "—"}
          </div>
          <div className="text-xs text-slate-400">
            {t.channels[conversation.channel as keyof typeof t.channels] ??
              conversation.channel}{" "}
            · {formatDateTime(conversation.createdAt)}
          </div>
        </div>
        <select
          value={status}
          onChange={(e) => changeStatus(e.target.value as ConversationStatus)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-400"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.conversations[s]}
            </option>
          ))}
        </select>
      </div>

      <div
        dir={msgDir}
        className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5"
      >
        {messages
          .filter((m) => m.role !== "system")
          .map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[78%]">
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-800 ring-1 ring-slate-100"
                  }`}
                >
                  {m.content}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-400">
                  <span>{formatDateTime(m.createdAt)}</span>
                  {m.role === "user" && m.sentiment && (
                    <span
                      className={`rounded px-1.5 py-0.5 ${SENTIMENT_TONE[m.sentiment]}`}
                    >
                      {t.sentiment[m.sentiment]}
                    </span>
                  )}
                  {m.role === "assistant" && m.meta && (
                    <span>
                      {t.playground.via} {m.meta.provider} · {m.meta.model}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
