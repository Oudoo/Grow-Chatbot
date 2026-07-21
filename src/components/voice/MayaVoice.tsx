"use client";

import { useEffect, useRef, useState } from "react";
import { VoiceProvider, useVoice } from "@humeai/voice-react";

export interface VoiceLabels {
  start: string;
  end: string;
  connecting: string;
  listening: string;
  speaking: string;
  error: string;
}

interface MayaVoiceProps {
  accessToken: string;
  configId: string;
  /** The Egyptian-Arabic persona/knowledge injected into Maya for this session. */
  systemPrompt: string;
  dir: "rtl" | "ltr";
  labels: VoiceLabels;
}

interface Line {
  role: "user" | "assistant";
  content: string;
}

function VoiceInner({
  accessToken,
  configId,
  systemPrompt,
  dir,
  labels,
  isSpeaking,
}: MayaVoiceProps & { isSpeaking: boolean }) {
  const { connect, disconnect, status, messages, micFft } = useVoice();
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines: Line[] = messages
    .map((m) => {
      const anyM = m as unknown as {
        type?: string;
        message?: { content?: string };
      };
      if (anyM.type === "user_message" && anyM.message?.content) {
        return { role: "user" as const, content: anyM.message.content };
      }
      if (anyM.type === "assistant_message" && anyM.message?.content) {
        return { role: "assistant" as const, content: anyM.message.content };
      }
      return null;
    })
    .filter((l): l is Line => l !== null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines.length]);

  const connected = status.value === "connected";
  const connecting = status.value === "connecting";
  const fft = micFft ? Math.max(...micFft) / 50 : 0;

  async function start() {
    setErr(null);
    try {
      await connect({
        auth: { type: "accessToken", value: accessToken },
        configId,
        sessionSettings: { type: "session_settings", systemPrompt },
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div dir={dir} className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4"
      >
        {lines.length === 0 && !connected && (
          <p className="mt-8 text-center text-sm text-slate-400">
            {dir === "rtl" ? "اضغط للبدء بالتحدث مع مايا" : "Press start to talk with Maya"}
          </p>
        )}
        {lines.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-800 shadow-sm ring-1 ring-slate-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Orb + controls */}
      <div className="flex flex-col items-center gap-4 border-t border-slate-200 bg-white p-5">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full transition-transform duration-150 ${
              isSpeaking ? "bg-brand-500/25" : "bg-brand-500/10"
            }`}
            style={{ transform: `scale(${1 + (isSpeaking ? 0.18 : fft * 0.5)})` }}
          />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
            مايا
          </div>
        </div>

        <div className="h-5 text-sm font-medium text-brand-700">
          {connecting && labels.connecting}
          {connected && (isSpeaking ? labels.speaking : labels.listening)}
        </div>

        {err && <div className="text-xs text-red-600">{labels.error}: {err}</div>}

        {!connected ? (
          <button
            onClick={start}
            disabled={connecting}
            className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {labels.start}
          </button>
        ) : (
          <button
            onClick={() => disconnect()}
            className="rounded-xl border-2 border-brand-600 px-6 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            {labels.end}
          </button>
        )}
      </div>
    </div>
  );
}

export function MayaVoice(props: MayaVoiceProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const clips = useRef<Set<string>>(new Set());

  return (
    <VoiceProvider
      clearMessagesOnDisconnect={false}
      onAudioStart={(id) => {
        clips.current.add(id);
        setIsSpeaking(true);
      }}
      onAudioEnd={(id) => {
        clips.current.delete(id);
        if (clips.current.size === 0) setIsSpeaking(false);
      }}
      onInterruption={() => {
        clips.current.clear();
        setIsSpeaking(false);
      }}
    >
      <VoiceInner {...props} isSpeaking={isSpeaking} />
    </VoiceProvider>
  );
}
