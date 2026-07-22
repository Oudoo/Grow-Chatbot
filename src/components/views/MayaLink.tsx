"use client";

import { useState } from "react";
import { ChatPanel, type ChatLabels } from "@/components/ChatPanel";
import { MayaLive } from "@/components/voice/MayaLive";

type Mode = "chat" | "voice";

const CHAT_LABELS: ChatLabels = {
  placeholder: "اكتب رسالتك…",
  typing: "يكتب…",
  via: "عبر",
  fellBack: "وضع تجريبي",
  errorPrefix: "خطأ",
  handoffNotice: "جارٍ تحويلك إلى موظف بشري…",
  agentBadge: "موظف",
};

/**
 * A clean, public, Maya-only surface: no dashboard, no bot picker, no engine
 * options — just a toggle between text chat and a hands-free voice call.
 */
export function MayaLink({
  botId,
  name,
  welcome,
}: {
  botId: string;
  name: string;
  welcome: string;
}) {
  const [mode, setMode] = useState<Mode>("voice");

  return (
    <div
      dir="rtl"
      className="mx-auto flex h-screen max-w-lg flex-col bg-white shadow-xl"
    >
      <header className="flex items-center gap-3 bg-brand-600 px-4 py-3 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-bold">
          {name.slice(0, 1)}
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{name}</div>
          <div className="flex items-center gap-1 text-[11px] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            متصلة الآن
          </div>
        </div>

        <div className="ms-auto inline-flex overflow-hidden rounded-lg bg-white/15 p-0.5 text-xs">
          <button
            onClick={() => setMode("voice")}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === "voice" ? "bg-white text-brand-700" : "text-white/90"
            }`}
          >
            مكالمة صوتية
          </button>
          <button
            onClick={() => setMode("chat")}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === "chat" ? "bg-white text-brand-700" : "text-white/90"
            }`}
          >
            محادثة
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 bg-slate-50">
        {mode === "chat" ? (
          <ChatPanel
            botId={botId}
            channel="web"
            dir="rtl"
            welcomeMessage={welcome}
            labels={CHAT_LABELS}
          />
        ) : (
          <MayaLive botId={botId} welcome={welcome} />
        )}
      </div>
    </div>
  );
}
