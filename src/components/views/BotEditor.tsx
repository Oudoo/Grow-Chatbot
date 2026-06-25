"use client";

import Link from "next/link";
import type { Bot, ProviderId } from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";
import { BotForm } from "@/components/BotForm";
import { EmbedPanel } from "@/components/EmbedPanel";
import { IconBack, IconPlay } from "@/components/icons";
import { formatDate } from "@/lib/format";

interface ProviderInfo {
  id: ProviderId;
  label: string;
  configured: boolean;
}

export function BotEditor({
  mode,
  bot,
  providers,
  defaultProvider,
  availableTools,
}: {
  mode: "create" | "edit";
  bot?: Bot;
  providers: ProviderInfo[];
  defaultProvider: ProviderId;
  availableTools: string[];
}) {
  const { t } = useLang();

  return (
    <div>
      <Link
        href="/dashboard/bots"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <IconBack className="h-4 w-4" />
        {t.bots.title}
      </Link>

      <PageHeader
        title={mode === "create" ? t.bots.new : (bot?.name ?? "")}
        subtitle={
          mode === "edit" && bot
            ? `${t.bots.createdAt}: ${formatDate(bot.createdAt)}`
            : t.bots.subtitle
        }
        action={
          mode === "edit" ? (
            <Link
              href="/dashboard/playground"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <IconPlay className="h-4 w-4" />
              {t.bots.test}
            </Link>
          ) : undefined
        }
      />

      <BotForm
        mode={mode}
        bot={bot}
        providers={providers}
        defaultProvider={defaultProvider}
        availableTools={availableTools}
      />

      {mode === "edit" && bot && (
        <div className="mt-4">
          <EmbedPanel bot={bot} />
        </div>
      )}
    </div>
  );
}
