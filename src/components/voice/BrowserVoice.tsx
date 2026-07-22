"use client";

import { useEffect, useRef, useState } from "react";

export interface BrowserVoiceLabels {
  tapToTalk: string;
  listening: string;
  thinking: string;
  speaking: string;
  unsupported: string;
  stop: string;
  hint: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

type Phase = "idle" | "listening" | "thinking" | "speaking";

/**
 * Key-free voice mode: browser SpeechRecognition (STT) -> our /api/chat engine
 * (so tools, knowledge and dialect all apply) -> SpeechSynthesis (TTS).
 * Egyptian-Arabic where the browser/OS provides an Arabic voice.
 */
export function BrowserVoice({
  botId,
  welcome,
  labels,
  azureTts = false,
}: {
  botId: string;
  welcome?: string;
  labels: BrowserVoiceLabels;
  /** When true, speak replies via the native Egyptian Azure voice (/api/tts). */
  azureTts?: boolean;
}) {
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<Msg[]>(
    welcome ? [{ role: "assistant", content: welcome }] : [],
  );
  const conversationId = useRef<string | undefined>();
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;
    if (!SR || typeof window.speechSynthesis === "undefined") {
      setSupported(false);
    }
    const loadVoice = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      voiceRef.current =
        voices.find((v) => v.lang.toLowerCase().startsWith("ar-eg")) ||
        voices.find((v) => v.lang.toLowerCase().startsWith("ar")) ||
        null;
    };
    loadVoice();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoice);
    return () =>
      window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoice);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // The browser's built-in speech synthesis — the always-available fallback.
  function browserSpeak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceRef.current?.lang || "ar-EG";
      if (voiceRef.current) u.voice = voiceRef.current;
      u.onstart = () => setPhase("speaking");
      u.onend = () => setPhase("idle");
      u.onerror = () => setPhase("idle");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      setPhase("idle");
    }
  }

  async function speak(text: string) {
    // Native Egyptian voice (server-side /api/tts: ElevenLabs or Azure) — plays
    // MP3 audio. If it fails for any reason, fall back to the browser voice so
    // Maya never goes silent (e.g. if the ElevenLabs free quota is exhausted).
    if (azureTts) {
      try {
        setPhase("speaking");
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("tts failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setPhase("idle");
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => browserSpeak(text);
        await audio.play();
      } catch {
        browserSpeak(text);
      }
      return;
    }
    browserSpeak(text);
  }

  async function handleText(text: string) {
    setMessages((m) => [...m, { role: "user", content: text }]);
    setPhase("thinking");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          botId,
          message: text,
          conversationId: conversationId.current,
          channel: "web",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      conversationId.current = data.conversationId;
      const reply = data.reply || "…";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      speak(reply);
    } catch {
      setPhase("idle");
    }
  }

  function listen() {
    if (phase !== "idle") {
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      setPhase("idle");
      return;
    }
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "ar-EG";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const text = e.results?.[0]?.[0]?.transcript?.trim();
      if (text) handleText(text);
      else setPhase("idle");
    };
    rec.onerror = () => setPhase("idle");
    rec.onend = () => setPhase((p) => (p === "listening" ? "idle" : p));
    setPhase("listening");
    rec.start();
  }

  if (!supported) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
        {labels.unsupported}
      </div>
    );
  }

  const phaseLabel =
    phase === "listening"
      ? labels.listening
      : phase === "thinking"
        ? labels.thinking
        : phase === "speaking"
          ? labels.speaking
          : labels.hint;

  return (
    <div dir="rtl" className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.map((m, i) => (
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

      <div className="flex flex-col items-center gap-3 border-t border-slate-200 bg-white p-5">
        <div className="h-5 text-sm font-medium text-brand-700">{phaseLabel}</div>
        <button
          onClick={listen}
          className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition ${
            phase === "listening"
              ? "animate-pulse bg-red-500"
              : phase === "idle"
                ? "bg-brand-600 hover:bg-brand-700"
                : "bg-slate-400"
          }`}
          aria-label="microphone"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
          </svg>
        </button>
        <div className="text-[11px] text-slate-400">
          {phase === "idle" ? labels.tapToTalk : labels.stop}
        </div>
      </div>
    </div>
  );
}

// Minimal typings for the Web Speech API (not in the standard DOM lib).
interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
