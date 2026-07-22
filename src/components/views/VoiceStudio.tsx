"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/PageHeader";
import { MayaVoice } from "@/components/voice/MayaVoice";
import { BrowserVoice } from "@/components/voice/BrowserVoice";

interface VoiceBot {
  id: string;
  name: string;
  welcome: string;
}

type Engine = "maya" | "azure" | "browser";

export function VoiceStudio({
  bots,
  systemPrompts,
  humeConfigured,
  azureConfigured,
}: {
  bots: VoiceBot[];
  systemPrompts: Record<string, string>;
  humeConfigured: boolean;
  azureConfigured: boolean;
}) {
  const { t } = useLang();
  const [botId, setBotId] = useState(bots[0]?.id ?? "");
  const [engine, setEngine] = useState<Engine>(
    azureConfigured ? "azure" : humeConfigured ? "maya" : "browser",
  );
  const bot = bots.find((b) => b.id === botId) ?? bots[0];

  if (!bot) {
    return (
      <div>
        <PageHeader title={t.voice.title} subtitle={t.voice.subtitle} />
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t.playground.noBots}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t.voice.title} subtitle={t.voice.subtitle} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={bot.id}
          onChange={(e) => setBotId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
        >
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
          {azureConfigured && (
            <button
              onClick={() => setEngine("azure")}
              className={`px-3 py-2 text-sm ${
                engine === "azure"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              {t.voice.native}
            </button>
          )}
          <button
            onClick={() => setEngine("maya")}
            disabled={!humeConfigured}
            className={`px-3 py-2 text-sm ${
              engine === "maya"
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {t.voice.maya}
          </button>
          <button
            onClick={() => setEngine("browser")}
            className={`px-3 py-2 text-sm ${
              engine === "browser"
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600"
            }`}
          >
            {t.voice.browser}
          </button>
        </div>
      </div>

      {!humeConfigured && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {t.voice.mayaUnavailable}
        </div>
      )}

      <div className="h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {engine === "maya" && humeConfigured ? (
          <MayaPanel systemPrompt={systemPrompts[bot.id] ?? ""} />
        ) : (
          <BrowserVoice
            botId={bot.id}
            welcome={bot.welcome}
            azureTts={engine === "azure"}
            labels={{
              tapToTalk: t.voice.tapToTalk,
              listening: t.voice.listening,
              thinking: t.voice.thinking,
              speaking: t.voice.speaking,
              unsupported: t.voice.unsupported,
              stop: t.voice.stopTalk,
              hint: t.voice.hint,
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Fetches a Hume token, then mounts Maya. Falls back with a message on error. */
function MayaPanel({ systemPrompt }: { systemPrompt: string }) {
  const { t } = useLang();
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
        {t.voice.error}: {error}
      </div>
    );
  }
  if (!token) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        {t.voice.connecting}
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
        start: t.voice.start,
        end: t.voice.end,
        connecting: t.voice.connecting,
        listening: t.voice.listening,
        speaking: t.voice.speaking,
        error: t.voice.error,
      }}
    />
  );
}
