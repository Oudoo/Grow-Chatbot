"use client";

import type { Language } from "@/lib/types";
import { ChatPanel, type ChatLabels } from "@/components/ChatPanel";

const LABELS: Record<Language, ChatLabels> = {
  ar: {
    placeholder: "اكتب رسالتك…",
    typing: "يكتب…",
    via: "عبر",
    fellBack: "وضع تجريبي",
    errorPrefix: "خطأ",
  },
  en: {
    placeholder: "Type your message…",
    typing: "typing…",
    via: "via",
    fellBack: "demo mode",
    errorPrefix: "Error",
  },
};

export function WidgetChat({
  botId,
  name,
  welcome,
  language,
}: {
  botId: string;
  name: string;
  welcome: string;
  language: Language;
}) {
  const dir = language === "ar" ? "rtl" : "ltr";

  return (
    <div dir={dir} className="flex h-screen flex-col bg-white">
      <header className="flex items-center gap-2.5 bg-brand-600 px-4 py-3 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
          {name.slice(0, 1)}
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{name}</div>
          <div className="flex items-center gap-1 text-[11px] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {language === "ar" ? "متصل الآن" : "Online"}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 bg-slate-50">
        <ChatPanel
          botId={botId}
          channel="web"
          dir={dir}
          welcomeMessage={welcome}
          labels={LABELS[language]}
        />
      </div>
    </div>
  );
}
