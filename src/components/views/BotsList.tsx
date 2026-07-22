"use client";

import Link from "next/link";
import type { Bot } from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";
import { IconPlus, IconBots } from "@/components/icons";

export function BotsList({ bots }: { bots: Bot[] }) {
  const { t } = useLang();

  return (
    <div>
      <PageHeader
        title={t.bots.title}
        subtitle={t.bots.subtitle}
        action={
          <Link
            href="/dashboard/bots/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <IconPlus />
            {t.bots.new}
          </Link>
        }
      />

      {bots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <IconBots className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">{t.bots.empty}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bots.map((bot) => (
            <Link
              key={bot.id}
              href={`/dashboard/bots/${bot.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">
                  {bot.name}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    bot.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {bot.status === "active" ? t.bots.active : t.bots.draft}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500">
                {bot.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{t.langNames[bot.language]}</Badge>
                {bot.language === "ar" && (
                  <Badge>{t.dialects[bot.dialect]}</Badge>
                )}
                <Badge tone="brand">
                  {bot.provider === "default"
                    ? t.bots.providerDefault
                    : bot.provider}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "brand";
}) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
        tone === "brand"
          ? "bg-brand-50 text-brand-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}
