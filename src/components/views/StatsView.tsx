"use client";

import Link from "next/link";
import type { Bot, Conversation } from "@/lib/types";
import type { DashboardStats } from "@/lib/store";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/format";

export function StatsView({
  stats,
  bots,
  recent,
}: {
  stats: DashboardStats;
  bots: Bot[];
  recent: Conversation[];
}) {
  const { t } = useLang();
  const botName = (id: string) => bots.find((b) => b.id === id)?.name ?? "—";

  const cards = [
    { label: t.stats.bots, value: stats.bots },
    { label: t.stats.activeBots, value: stats.activeBots },
    { label: t.stats.conversations, value: stats.conversations },
    { label: t.stats.messages, value: stats.messages },
  ];

  const totalSentiment =
    stats.sentiment.positive +
    stats.sentiment.negative +
    stats.sentiment.neutral;

  return (
    <div>
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="text-3xl font-semibold text-slate-900">
              {c.value}
            </div>
            <div className="mt-1 text-sm text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Sentiment */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {t.stats.sentiment}
          </h2>
          {totalSentiment === 0 ? (
            <p className="text-sm text-slate-400">{t.stats.empty}</p>
          ) : (
            <div className="space-y-3">
              {(
                [
                  ["positive", "bg-emerald-500"],
                  ["neutral", "bg-slate-300"],
                  ["negative", "bg-red-400"],
                ] as const
              ).map(([key, color]) => {
                const val = stats.sentiment[key];
                const pct = Math.round((val / totalSentiment) * 100);
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>{t.sentiment[key]}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {t.stats.byChannel}
          </h2>
          {stats.byChannel.length === 0 ? (
            <p className="text-sm text-slate-400">{t.stats.empty}</p>
          ) : (
            <ul className="space-y-2">
              {stats.byChannel.map((c) => (
                <li
                  key={c.channel}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-600">
                    {t.channels[c.channel as keyof typeof t.channels] ??
                      c.channel}
                  </span>
                  <span className="font-medium text-slate-900">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent conversations */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            {t.conversations.title}
          </h2>
          <Link
            href="/dashboard/conversations"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            {t.conversations.view} →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">{t.conversations.empty}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/conversations/${c.id}`}
                  className="flex items-center justify-between py-2.5 text-sm hover:opacity-70"
                >
                  <span className="font-medium text-slate-700">
                    {botName(c.botId)}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="rounded bg-slate-100 px-2 py-0.5">
                      {t.channels[c.channel as keyof typeof t.channels] ??
                        c.channel}
                    </span>
                    {formatDateTime(c.lastMessageAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
