"use client";

import type { AnalyticsData } from "@/lib/store";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const { t } = useLang();
  const dialectLabels = t.dialects as Record<string, string>;
  const toolLabels = t.tools.labels as Record<string, string>;

  const maxDay = Math.max(1, ...data.byDay.map((d) => d.messages));
  const maxTool = Math.max(1, ...data.toolUsage.map((d) => d.count));
  const totalDialects = data.dialects.reduce((s, d) => s + d.count, 0);

  const kpis = [
    { label: t.analytics.handoffRate, value: `${Math.round(data.handoffRate * 100)}%` },
    { label: t.analytics.avgLatency, value: `${data.avgLatencyMs}ms` },
    { label: t.analytics.avgMsgs, value: data.avgMessagesPerConversation },
    { label: t.stats.messages, value: data.totals.messages },
  ];

  return (
    <div>
      <PageHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="text-2xl font-semibold text-slate-900">{k.value}</div>
            <div className="mt-1 text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Volume */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          {t.analytics.volume}
        </h2>
        <div dir="ltr" className="flex h-32 items-end gap-1.5">
          {data.byDay.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-brand-400"
                style={{ height: `${(d.messages / maxDay) * 100}%` }}
                title={`${d.date}: ${d.messages} ${t.analytics.messages}`}
              />
              <span className="text-[9px] text-slate-400">
                {d.date.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Tool usage */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {t.analytics.toolUsage}
          </h2>
          {data.toolUsage.length === 0 ? (
            <p className="text-sm text-slate-400">{t.analytics.none}</p>
          ) : (
            <ul className="space-y-2">
              {data.toolUsage.map((tool) => (
                <li key={tool.name}>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span dir="ltr">{toolLabels[tool.name] ?? tool.name}</span>
                    <span>{tool.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${(tool.count / maxTool) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Dialects */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {t.analytics.dialects}
          </h2>
          {totalDialects === 0 ? (
            <p className="text-sm text-slate-400">{t.analytics.none}</p>
          ) : (
            <ul className="space-y-2">
              {data.dialects.map((d) => (
                <li
                  key={d.dialect}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-600">
                    {dialectLabels[d.dialect] ?? d.dialect}
                  </span>
                  <span className="font-medium text-slate-900">
                    {Math.round((d.count / totalDialects) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Top bots */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {t.analytics.topBots}
        </h2>
        {data.topBots.length === 0 ? (
          <p className="text-sm text-slate-400">{t.analytics.none}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.topBots.map((b) => (
              <li
                key={b.name}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-slate-700">{b.name}</span>
                <span className="font-medium text-slate-900">
                  {b.conversations} {t.analytics.conversations}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
