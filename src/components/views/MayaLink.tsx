"use client";

import { useEffect, useState } from "react";
import { ChatPanel, type ChatLabels } from "@/components/ChatPanel";
import { BrowserVoice } from "@/components/voice/BrowserVoice";
import { MayaVoice } from "@/components/voice/MayaVoice";

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

const VOICE_LABELS = {
  tapToTalk: "اضغط للتحدث",
  listening: "بستمع…",
  thinking: "بفكر…",
  speaking: "بتكلم…",
  unsupported: "متصفحك لا يدعم المحادثة الصوتية. جرّب Chrome.",
  stop: "اضغط للإيقاف",
  hint: "اضغط على الميكروفون وابدأ الكلام",
};

/**
 * A clean, public, Maya-only surface: no dashboard, no bot picker, no engine
 * options — just a toggle between text chat and a voice call with Maya.
 * The voice engine is chosen automatically: native Egyptian (Azure) when
 * configured, then Hume, otherwise the key-free browser voice.
 */
export function MayaLink({
  botId,
  name,
  welcome,
  systemPrompt,
  humeConfigured,
  azureConfigured,
}: {
  botId: string;
  name: string;
  welcome: string;
  systemPrompt: string;
  humeConfigured: boolean;
  azureConfigured: boolean;
}) {
  const [mode, setMode] = useState<Mode>("chat");

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
            onClick={() => setMode("chat")}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === "chat" ? "bg-white text-brand-700" : "text-white/90"
            }`}
          >
            محادثة
          </button>
          <button
            onClick={() => setMode("voice")}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === "voice" ? "bg-white text-brand-700" : "text-white/90"
            }`}
          >
            مكالمة صوتية
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
        ) : humeConfigured && !azureConfigured ? (
          <HumeCall systemPrompt={systemPrompt} />
        ) : (
          <BrowserVoice
            botId={botId}
            welcome={welcome}
            azureTts={azureConfigured}
            labels={VOICE_LABELS}
          />
        )}
      </div>
    </div>
  );
}

/** Fetches a Hume token, then mounts the premium Maya voice. */
function HumeCall({ systemPrompt }: { systemPrompt: string }) {
  const [token, setToken] = useState<{ accessToken: string; configId: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/hume-token", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.error) setError(d.error);
        else setToken({ accessToken: d.accessToken, configId: d.configId });
      })
      .catch((e) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-red-600">
        خطأ: {error}
      </div>
    );
  }
  if (!token) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        جارٍ الاتصال…
      </div>
    );
  }
  return (
    <MayaVoice
      accessToken={token.accessToken}
      configId={token.configId}
      systemPrompt={systemPrompt}
      dir="rtl"
      labels={{
        start: "ابدأ المكالمة",
        end: "إنهاء",
        connecting: "جارٍ الاتصال…",
        listening: "بستمع…",
        speaking: "بتكلم…",
        error: "خطأ",
      }}
    />
  );
}
