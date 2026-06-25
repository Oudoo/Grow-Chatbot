"use client";

import { useState } from "react";
import type { Bot } from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";
import { ChatPanel } from "@/components/ChatPanel";

export function Playground({ bots }: { bots: Bot[] }) {
  const { t } = useLang();
  const [botId, setBotId] = useState(bots[0]?.id ?? "");
  const [resetKey, setResetKey] = useState(0);

  const bot = bots.find((b) => b.id === botId) ?? bots[0];

  if (!bot) {
    return (
      <div>
        <PageHeader title={t.playground.title} subtitle={t.playground.subtitle} />
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t.playground.noBots}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t.playground.title}
        subtitle={t.playground.subtitle}
        action={
          <button
            onClick={() => setResetKey((k) => k + 1)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {t.playground.reset}
          </button>
        }
      />

      <div className="mb-4">
        <select
          value={bot.id}
          onChange={(e) => {
            setBotId(e.target.value);
            setResetKey((k) => k + 1);
          }}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
        >
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <ChatPanel
          botId={bot.id}
          channel="web"
          dir={bot.language === "ar" ? "rtl" : "ltr"}
          welcomeMessage={bot.welcomeMessage}
          showMeta
          resetKey={resetKey}
          labels={{
            placeholder: t.playground.placeholder,
            typing: t.playground.typing,
            via: t.playground.via,
            fellBack: t.playground.fellBack,
            errorPrefix: t.common.error,
          }}
        />
      </div>
    </div>
  );
}
