"use client";

import { useEffect, useState } from "react";
import type { Bot } from "@/lib/types";
import { useLang } from "@/components/LanguageProvider";
import { IconCopy, IconCheck, IconExternal } from "@/components/icons";

export function EmbedPanel({ bot }: { bot: Bot }) {
  const { t } = useLang();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const snippet = `<script src="${origin}/embed.js" data-bot="${bot.id}" data-title="${bot.name}" async></script>`;
  const widgetUrl = `${origin}/widget/${bot.id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700">{t.embed.title}</h2>
      <p className="mt-1 text-xs text-slate-400">{t.embed.intro}</p>

      <div className="mt-3 flex items-start gap-2">
        <pre
          dir="ltr"
          className="scroll-thin flex-1 overflow-x-auto rounded-lg bg-slate-900 p-3 text-left text-[12px] leading-relaxed text-slate-100"
        >
          <code>{snippet}</code>
        </pre>
        <button
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {copied ? (
            <IconCheck className="h-4 w-4 text-emerald-600" />
          ) : (
            <IconCopy className="h-4 w-4" />
          )}
          {copied ? t.common.copied : t.common.copy}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400">{t.embed.direct}</p>
      <a
        href={widgetUrl}
        target="_blank"
        rel="noreferrer"
        dir="ltr"
        className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
      >
        {widgetUrl}
        <IconExternal className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
